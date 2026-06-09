import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { jsonrepair } from "jsonrepair";
import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { z } from "zod";
import { env } from "@/lib/env";
import { INVESTMENT_ANALYST_SYSTEM_PROMPT, buildTweetAnalysisPrompt } from "@/lib/prompts";
import type { AiAnalysis } from "@/types";

const stockSignalSchema = z.object({
  ticker: z.string().trim().min(1),
  company: z.string().trim().default(""),
  reason: z.string().trim().default("")
});

const aiAnalysisSchema = z.object({
  summary_cn: z.string().trim().default(""),
  translated_content_cn: z.string().trim().default(""),
  bullish_stocks: z.array(stockSignalSchema).default([]),
  bearish_stocks: z.array(stockSignalSchema).default([]),
  sector_tags: z.array(z.string().trim()).default([]),
  confidence: z.number().int().min(0).max(100).default(0)
});

// ─── OpenAI JSON schema (strict mode) ────────────────────────────────────────

const openaiJsonSchema = {
  name: "tweet_investment_analysis",
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "summary_cn",
      "translated_content_cn",
      "bullish_stocks",
      "bearish_stocks",
      "sector_tags",
      "confidence"
    ],
    properties: {
      summary_cn: { type: "string" },
      translated_content_cn: { type: "string" },
      bullish_stocks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["ticker", "company", "reason"],
          properties: {
            ticker: { type: "string" },
            company: { type: "string" },
            reason: { type: "string" }
          }
        }
      },
      bearish_stocks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["ticker", "company", "reason"],
          properties: {
            ticker: { type: "string" },
            company: { type: "string" },
            reason: { type: "string" }
          }
        }
      },
      sector_tags: { type: "array", items: { type: "string" } },
      confidence: { type: "integer", minimum: 0, maximum: 100 }
    }
  },
  strict: true
} as const;

// ─── Gemini response schema ───────────────────────────────────────────────────

const geminiResponseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    summary_cn: { type: SchemaType.STRING },
    translated_content_cn: { type: SchemaType.STRING },
    bullish_stocks: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          ticker: { type: SchemaType.STRING },
          company: { type: SchemaType.STRING },
          reason: { type: SchemaType.STRING }
        },
        required: ["ticker", "company", "reason"]
      }
    },
    bearish_stocks: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          ticker: { type: SchemaType.STRING },
          company: { type: SchemaType.STRING },
          reason: { type: SchemaType.STRING }
        },
        required: ["ticker", "company", "reason"]
      }
    },
    sector_tags: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING }
    },
    confidence: { type: SchemaType.INTEGER }
  },
  required: [
    "summary_cn",
    "translated_content_cn",
    "bullish_stocks",
    "bearish_stocks",
    "sector_tags",
    "confidence"
  ]
};

// ─── Provider routing ─────────────────────────────────────────────────────────

export async function analyzeTweetWithAi(content: string): Promise<AiAnalysis> {
  // If Xiaomi backup is configured and primary is OpenAI (DeepSeek), race them in parallel.
  // First successful result wins. This defends against deterministic JSON failures from one provider.
  if (env.AI_PROVIDER === "openai" && env.XIAOMI_API_KEY && env.XIAOMI_BASE_URL) {
    try {
      return await Promise.any([
        analyzeWithOpenAI(content).then(r => { console.log("[ai] primary (DeepSeek) won the race"); return r; }),
        analyzeWithXiaomi(content).then(r => { console.log("[ai] backup (Xiaomi mimo-v2.5) won the race"); return r; })
      ]);
    } catch (aggErr) {
      // Both failed — log both errors and throw
      const errors = aggErr instanceof AggregateError ? aggErr.errors : [aggErr];
      console.error("[ai] both primary and backup failed:", errors.map((e: unknown) => e instanceof Error ? e.message : e));
      throw errors[0];
    }
  }

  // Single-provider path (non-OpenAI, or Xiaomi not configured)
  const MAX_ATTEMPTS = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      switch (env.AI_PROVIDER) {
        case "anthropic": return await analyzeWithAnthropic(content);
        case "gemini":    return await analyzeWithGemini(content);
        default:          return await analyzeWithOpenAI(content);
      }
    } catch (err) {
      lastError = err;
      console.warn(`[ai] analysis attempt ${attempt}/${MAX_ATTEMPTS} failed:`, err instanceof Error ? err.message : err);
    }
  }
  throw lastError;
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

async function analyzeWithOpenAI(content: string): Promise<AiAnalysis> {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required when AI_PROVIDER=openai");
  }

  const clientOptions: ConstructorParameters<typeof OpenAI>[0] = {
    apiKey: env.OPENAI_API_KEY
  };
  // Support custom OpenAI-compatible endpoints (e.g. Xiaomi MiMo, Azure, etc.)
  if (env.OPENAI_BASE_URL) {
    clientOptions.baseURL = env.OPENAI_BASE_URL;
  }

  const client = new OpenAI(clientOptions);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: INVESTMENT_ANALYST_SYSTEM_PROMPT },
    { role: "user", content: buildTweetAnalysisPrompt(content) }
  ];

  // DeepSeek and other OpenAI-compatible providers support json_object mode,
  // which forces the API to return valid JSON regardless of model output.
  // Standard OpenAI supports the stricter json_schema mode.
  const completion = env.OPENAI_BASE_URL
    ? await client.chat.completions.create({
        model: env.AI_MODEL,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages
      })
    : await client.chat.completions.create({
        model: env.AI_MODEL,
        temperature: 0.1,
        response_format: { type: "json_schema", json_schema: openaiJsonSchema },
        messages
      });

  const raw = completion.choices[0]?.message.content;
  if (!raw) throw new Error("OpenAI returned empty content");
  return normalizeAnalysis(raw);
}

// ─── Xiaomi MiMo (backup racing provider) ────────────────────────────────────

async function analyzeWithXiaomi(content: string): Promise<AiAnalysis> {
  if (!env.XIAOMI_API_KEY || !env.XIAOMI_BASE_URL) {
    throw new Error("XIAOMI_API_KEY and XIAOMI_BASE_URL are required for Xiaomi backup");
  }

  const client = new OpenAI({ apiKey: env.XIAOMI_API_KEY, baseURL: env.XIAOMI_BASE_URL });
  const completion = await client.chat.completions.create({
    model: "mimo-v2.5",
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: INVESTMENT_ANALYST_SYSTEM_PROMPT },
      { role: "user", content: buildTweetAnalysisPrompt(content) }
    ]
  });

  const raw = completion.choices[0]?.message.content;
  if (!raw) throw new Error("Xiaomi returned empty content");
  return normalizeAnalysis(raw);
}

// ─── Anthropic ────────────────────────────────────────────────────────────────

async function analyzeWithAnthropic(content: string): Promise<AiAnalysis> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic");
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: env.AI_MODEL,
    max_tokens: 1800,
    temperature: 0.1,
    system: INVESTMENT_ANALYST_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildTweetAnalysisPrompt(content) }]
  });

  const raw = message.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
  return normalizeAnalysis(raw);
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

async function analyzeWithGemini(content: string): Promise<AiAnalysis> {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required when AI_PROVIDER=gemini");
  }

  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: env.AI_MODEL,
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: geminiResponseSchema
    },
    systemInstruction: INVESTMENT_ANALYST_SYSTEM_PROMPT
  });

  const result = await model.generateContent(buildTweetAnalysisPrompt(content));
  const raw = result.response.text();
  if (!raw) throw new Error("Gemini returned empty content");
  return normalizeAnalysis(raw);
}

// ─── Shared normalization ─────────────────────────────────────────────────────

function normalizeAnalysis(raw: string): AiAnalysis {
  const json = extractJson(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    parsed = JSON.parse(jsonrepair(json));
  }
  const analysis = aiAnalysisSchema.parse(parsed);
  return {
    ...analysis,
    bullish_stocks: dedupeSignals(analysis.bullish_stocks),
    bearish_stocks: dedupeSignals(analysis.bearish_stocks),
    sector_tags: [...new Set(analysis.sector_tags.filter(Boolean))],
    confidence: Math.round(analysis.confidence)
  };
}

/**
 * Robustly extract JSON from model output.
 * Handles raw JSON, ```json code blocks, and JSON embedded in explanatory text.
 *
 * LLMs commonly emit these invalid characters inside JSON string values:
 *   "   – unescaped double quote  (e.g. "harvesting the leeks")
 *   \n  – literal newline         (multi-line tweet copied verbatim)
 *   \r  – literal carriage return
 *   \t  – literal tab
 *   \   – unescaped backslash     (LaTeX, Windows paths)
 * We fix them with a state-machine pass that only rewrites characters
 * that are inside a JSON string literal.
 */
function extractJson(raw: string): string {
  let trimmed = raw.trim();

  // Strip markdown code blocks: ```json ... ``` or ``` ... ```
  const codeBlockMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (codeBlockMatch?.[1]) trimmed = codeBlockMatch[1].trim();

  // Locate the outermost JSON object
  const jsonStart = trimmed.startsWith("{") ? 0 : trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd <= jsonStart) return trimmed;
  const candidate = trimmed.slice(jsonStart, jsonEnd + 1);

  // State-machine: walk character-by-character and fix unescaped
  // dangerous characters only when we're inside a JSON string value.
  const out: string[] = [];
  let inString = false;
  let i = 0;
  while (i < candidate.length) {
    const ch = candidate[i];

    if (inString) {
      if (ch === "\\") {
        // Already-escaped sequence — copy both chars verbatim
        out.push(ch);
        i++;
        if (i < candidate.length) out.push(candidate[i]);
      } else if (ch === '"') {
        // Closing quote — end of string
        inString = false;
        out.push(ch);
      } else if (ch === "\n") {
        out.push("\\n");
      } else if (ch === "\r") {
        out.push("\\r");
      } else if (ch === "\t") {
        out.push("\\t");
      } else if (ch === "\u201c" || ch === "\u201d" || ch === "\u201e" ||
                 ch === "\u2018" || ch === "\u2019" || ch === "\uff02") {
        // Unicode curly/fullwidth quotes inside a string value -> escaped "
        out.push('\\"');
      } else {
        out.push(ch);
      }
    } else {
      if (ch === '"') {
        inString = true;
        out.push(ch);
      } else {
        out.push(ch);
      }
    }
    i++;
  }

  return out.join("");
}

function dedupeSignals(signals: AiAnalysis["bullish_stocks"]) {
  const seen = new Set<string>();
  return signals
    .map((signal) => ({ ...signal, ticker: signal.ticker.toUpperCase().replace(/^\$/, "") }))
    .filter((signal) => {
      if (seen.has(signal.ticker)) return false;
      seen.add(signal.ticker);
      return true;
    });
}
