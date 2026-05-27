import { env } from "@/lib/env";
import { sha256 } from "@/lib/hash";
import type { AiAnalysis, StockProfile } from "@/types";

export type WechatArticleInput = {
  sourceUrl?: string | null;
  original: string;
  authorUsername?: string;
  analysis: AiAnalysis;
  stocks: StockProfile[];
};

// ─── WeChat Work Bot markdown limit: 4096 bytes ───────────────────────────────
const WECHAT_MAX_BYTES = 4000; // 留 96 字节余量

const DIVIDER = "━━━━━━━━━━━━━━━━━━━━";
const NUMBER_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣"];

/**
 * 渲染微信企业机器人 Markdown 消息。
 * 格式完全按照产品要求，与金融情报媒体风格对齐。
 */
export function renderWechatMarkdown(input: WechatArticleInput): string {
  const { analysis } = input;
  const stockMap = new Map(input.stocks.map((s) => [s.ticker, s]));
  const author = input.authorUsername ?? "Serenity";
  const lines: string[] = [];

  // ── Header ─────────────────────────────────────────────────────────────────
  lines.push(`🚨 **@${author} 最新观点**`);
  lines.push("");

  // ── Original tweet ─────────────────────────────────────────────────────────
  lines.push("**【原文】**");
  lines.push(`"${truncate(input.original, 280)}"`);
  lines.push("");

  // ── Chinese translation ────────────────────────────────────────────────────
  lines.push("**【中文翻译】**");
  lines.push(analysis.translated_content_cn || analysis.summary_cn);
  lines.push("");

  // ── AI core analysis ───────────────────────────────────────────────────────
  lines.push("**【AI核心解读】**");
  lines.push(analysis.summary_cn);
  lines.push("");

  // ── Bullish stocks ─────────────────────────────────────────────────────────
  if (analysis.bullish_stocks.length > 0) {
    lines.push(DIVIDER);
    lines.push("");
    lines.push("**📈 AI判断利好股票**");
    lines.push("");

    analysis.bullish_stocks.slice(0, 5).forEach((signal, i) => {
      const stock = stockMap.get(signal.ticker);
      const numEmoji = NUMBER_EMOJIS[i] ?? `${i + 1}.`;
      const company = stock?.company || signal.company || "待补充";
      const description = stock?.company_description
        ? truncate(stock.company_description, 120)
        : signal.company
        ? `${signal.company} — AI 光通信与半导体相关公司。`
        : "待补充公司简介。";

      lines.push(`${numEmoji} **${signal.ticker}（${company}）**`);
      lines.push("");
      lines.push("**公司业务：**");
      lines.push(description);
      lines.push("");
      lines.push("**利好逻辑：**");
      lines.push(truncate(signal.reason, 200));
      lines.push("");
    });
  }

  // ── Bearish stocks ─────────────────────────────────────────────────────────
  lines.push(DIVIDER);
  lines.push("");

  if (analysis.bearish_stocks.length > 0) {
    lines.push("**📉 AI判断潜在利空**");
    lines.push("");
    analysis.bearish_stocks.slice(0, 3).forEach((signal, i) => {
      const stock = stockMap.get(signal.ticker);
      const numEmoji = NUMBER_EMOJIS[i] ?? `${i + 1}.`;
      const company = stock?.company || signal.company || "待补充";
      lines.push(`${numEmoji} **${signal.ticker}（${company}）**`);
      lines.push("");
      lines.push("**利空原因：**");
      lines.push(truncate(signal.reason, 160));
      lines.push("");
    });
  } else {
    lines.push("**📉 AI判断潜在利空**");
    lines.push("");
    lines.push("暂无明显利空个股。");
    lines.push("");
  }

  // ── Tags ───────────────────────────────────────────────────────────────────
  if (analysis.sector_tags.length > 0) {
    lines.push(DIVIDER);
    lines.push("");
    lines.push("🏷️ **Tags**");
    lines.push("");
    lines.push(analysis.sector_tags.slice(0, 6).map((t) => `#${t.replace(/^#/, "")}`).join("  "));
    lines.push("");
  }

  // ── Confidence + source ────────────────────────────────────────────────────
  lines.push(DIVIDER);
  lines.push("");
  const confidenceBar = buildConfidenceBar(analysis.confidence);
  lines.push(`置信度：${confidenceBar} ${analysis.confidence}/100`);

  if (input.sourceUrl) {
    lines.push(`[查看原文 →](${input.sourceUrl})`);
  }

  const full = lines.join("\n");

  // Guard against 4096 byte limit — truncate stocks if needed
  return ensureByteLimit(full, lines, input, WECHAT_MAX_BYTES);
}

// ─── Send functions ───────────────────────────────────────────────────────────

export async function sendWechatMarkdown(content: string) {
  if (!env.WECHAT_WEBHOOK) {
    throw new Error("WECHAT_WEBHOOK is required");
  }

  const response = await fetch(env.WECHAT_WEBHOOK, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      msgtype: "markdown",
      markdown: { content }
    })
  });

  const body = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    body,
    payloadHash: sha256(content)
  };
}

export async function sendServerChan(content: string) {
  if (!env.SERVER_CHAN_SENDKEY) {
    throw new Error("SERVER_CHAN_SENDKEY is required");
  }

  const response = await fetch(
    `https://sctapi.ftqq.com/${env.SERVER_CHAN_SENDKEY}.send`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        title: "🚨 Serenity 最新观点",
        desp: content
      })
    }
  );

  const body = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    body,
    payloadHash: sha256(content)
  };
}

export async function sendWechatTemplate(content: string) {
  if (!env.WECHAT_TEMPLATE_ENDPOINT) {
    throw new Error("WECHAT_TEMPLATE_ENDPOINT is required");
  }

  const response = await fetch(env.WECHAT_TEMPLATE_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "🚨 Serenity 最新观点", content })
  });

  const body = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    body,
    payloadHash: sha256(content)
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncate(text: string, maxChars: number): string {
  if (!text) return "";
  const t = text.trim();
  return t.length > maxChars ? `${t.slice(0, maxChars)}…` : t;
}

function buildConfidenceBar(confidence: number): string {
  const filled = Math.round(confidence / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

/**
 * If the full message exceeds WeChat's byte limit, rebuild with shorter
 * stock descriptions (drop company_description, keep only reason).
 */
function ensureByteLimit(
  full: string,
  _lines: string[],
  input: WechatArticleInput,
  limit: number
): string {
  if (byteLength(full) <= limit) return full;

  // Rebuild with truncated descriptions
  const { analysis } = input;
  const author = input.authorUsername ?? "Serenity";
  const truncLines: string[] = [];

  truncLines.push(`🚨 **@${author} 最新观点**`, "");
  truncLines.push("**【原文】**", `"${truncate(input.original, 200)}"`, "");
  truncLines.push(
    "**【中文翻译】**",
    truncate(analysis.translated_content_cn || analysis.summary_cn, 150),
    ""
  );
  truncLines.push("**【AI核心解读】**", truncate(analysis.summary_cn, 200), "");

  if (analysis.bullish_stocks.length > 0) {
    truncLines.push(DIVIDER, "", "**📈 AI判断利好股票**", "");
    analysis.bullish_stocks.slice(0, 4).forEach((signal, i) => {
      const stockMap = new Map(input.stocks.map((s) => [s.ticker, s]));
      const stock = stockMap.get(signal.ticker);
      const price =
        stock?.price != null ? `$${stock.price.toFixed(2)}` : "—";
      const company = stock?.company || signal.company || "";
      truncLines.push(
        `${NUMBER_EMOJIS[i] ?? `${i + 1}.`} **${signal.ticker}（${company}）** ${price}`,
        truncate(signal.reason, 100),
        ""
      );
    });
  }

  if (analysis.bearish_stocks.length === 0) {
    truncLines.push(DIVIDER, "", "**📉 AI判断潜在利空**", "", "暂无明显利空。", "");
  }

  if (analysis.sector_tags.length > 0) {
    truncLines.push(
      DIVIDER,
      "",
      analysis.sector_tags
        .slice(0, 5)
        .map((t) => `#${t.replace(/^#/, "")}`)
        .join("  "),
      ""
    );
  }

  if (input.sourceUrl) {
    truncLines.push(`[查看原文](${input.sourceUrl})`);
  }

  return truncLines.join("\n");
}

function byteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}
