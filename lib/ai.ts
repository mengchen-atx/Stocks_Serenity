import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
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

  // Custom providers (e.g. Xiaomi MiMo) may not support response_format at all.
  // Standard OpenAI uses strict json_schema mode.
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: INVESTMENT_ANALYST_SYSTEM_PROMPT },
    { role: "user", content: buildTweetAnalysisPrompt(content) }
  ];

  // Custom providers (e.g. Xiaomi MiMo) don't support response_format.
  // Standard OpenAI uses strict json_schema mode for reliable structured output.
  const completion = env.OPENAI_BASE_URL
    ? await client.chat.completions.create({ model: env.AI_MODEL, temperature: 0.1, messages })
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
  const parsed = JSON.parse(json);
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
 */
function extractJson(raw: string): string {
  let trimmed = raw.trim();

  // Strip markdown code blocks: ```json ... ``` or ``` ... ```
  const codeBlockMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (codeBlockMatch?.[1]) trimmed = codeBlockMatch[1].trim();

  // Replace Unicode curly/smart quotes with escaped ASCII double quotes.
  // AI models writing Chinese sometimes emit “ “ ' ' inside JSON string values,
  // which breaks JSON.parse. Cover all common variants.
  trimmed = trimmed.replace(/[“”‘’«»＂]/g, '\\”');

  // If it starts with { it's likely clean JSON
  if (trimmed.startsWith("{")) return trimmed;

  // Try to find the first complete JSON object in the text
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    return trimmed.slice(jsonStart, jsonEnd + 1);
  }

  // Give up and let JSON.parse throw a meaningful error
  return trimmed;
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
