import { describe, expect, it } from "vitest";
import { extractJson, normalizeAnalysis } from "@/lib/ai-normalize";

const base = {
  summary_cn: "摘要",
  translated_content_cn: "译文",
  bullish_stocks: [],
  bearish_stocks: [],
  sector_tags: [],
  confidence: 80,
};

describe("extractJson", () => {
  it("strips a ```json code fence", () => {
    const raw = "```json\n{\"a\": 1}\n```";
    expect(JSON.parse(extractJson(raw))).toEqual({ a: 1 });
  });

  it("pulls the object out of surrounding prose", () => {
    const raw = 'Here is the analysis: {"a": 1} Hope this helps.';
    expect(JSON.parse(extractJson(raw))).toEqual({ a: 1 });
  });

  it("escapes literal newlines and tabs inside string values", () => {
    const raw = '{"text": "line one\nline\ttwo"}';
    expect(JSON.parse(extractJson(raw))).toEqual({ text: "line one\nline\ttwo" });
  });

  it("turns curly and fullwidth quotes inside strings into escaped quotes", () => {
    const raw = '{"text": "他说“割韭菜”和＂好＂"}';
    expect(JSON.parse(extractJson(raw))).toEqual({ text: '他说"割韭菜"和"好"' });
  });

  it("leaves already-escaped sequences untouched", () => {
    const raw = '{"text": "a \\"quoted\\" word\\n"}';
    expect(JSON.parse(extractJson(raw))).toEqual({ text: 'a "quoted" word\n' });
  });

  it("returns the input unchanged when there is no object", () => {
    expect(extractJson("no json here")).toBe("no json here");
  });
});

describe("normalizeAnalysis", () => {
  it("parses a well-formed response", () => {
    const result = normalizeAnalysis(JSON.stringify(base));
    expect(result.summary_cn).toBe("摘要");
    expect(result.confidence).toBe(80);
  });

  it("repairs unescaped ASCII quotes with jsonrepair", () => {
    const raw = '{"summary_cn": "所谓"AI泡沫"并不存在", "confidence": 70}';
    expect(normalizeAnalysis(raw).summary_cn).toContain("AI泡沫");
  });

  it("fills missing fields with defaults", () => {
    const result = normalizeAnalysis('{"summary_cn": "only summary"}');
    expect(result).toMatchObject({
      translated_content_cn: "",
      bullish_stocks: [],
      bearish_stocks: [],
      sector_tags: [],
      confidence: 0,
    });
  });

  it("scales a 0-1 float confidence to 0-100", () => {
    expect(normalizeAnalysis(JSON.stringify({ ...base, confidence: 0.85 })).confidence).toBe(85);
  });

  it("clamps confidence above 100", () => {
    expect(normalizeAnalysis(JSON.stringify({ ...base, confidence: 140 })).confidence).toBe(100);
  });

  it("uppercases tickers, strips $, and drops duplicates", () => {
    const raw = JSON.stringify({
      ...base,
      bullish_stocks: [
        { ticker: "$nvda", company: "NVIDIA", reason: "a" },
        { ticker: "NVDA", company: "NVIDIA", reason: "b" },
        { ticker: "avgo", company: "Broadcom", reason: "c" },
      ],
    });
    expect(normalizeAnalysis(raw).bullish_stocks.map((s) => s.ticker)).toEqual(["NVDA", "AVGO"]);
  });

  it("deduplicates sector tags and drops empty ones", () => {
    const raw = JSON.stringify({ ...base, sector_tags: ["CPO", "CPO", "", "HBM"] });
    expect(normalizeAnalysis(raw).sector_tags).toEqual(["CPO", "HBM"]);
  });

  it("rejects a stock signal with an empty ticker", () => {
    const raw = JSON.stringify({ ...base, bullish_stocks: [{ ticker: " ", company: "", reason: "" }] });
    expect(() => normalizeAnalysis(raw)).toThrow();
  });

  it("throws on output that is not JSON at all", () => {
    expect(() => normalizeAnalysis("I cannot help with that.")).toThrow();
  });
});
