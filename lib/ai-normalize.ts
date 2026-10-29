/**
 * Turns raw LLM output into a validated AiAnalysis.
 * Kept free of network and database imports so it can be unit tested.
 */
import { jsonrepair } from "jsonrepair";
import { z } from "zod";
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
  // Models sometimes return 0.85 (float 0-1) instead of 85 (int 0-100)
  confidence: z.number().transform(v => v <= 1 ? Math.round(v * 100) : Math.round(Math.min(100, Math.max(0, v)))).default(0)
});

export function normalizeAnalysis(raw: string): AiAnalysis {
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
export function extractJson(raw: string): string {
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
