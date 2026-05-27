import { env } from "@/lib/env";
import { sha256 } from "@/lib/hash";

const TELEGRAM_API = "https://api.telegram.org";

type TelegramResponse = {
  ok: boolean;
  result?: unknown;
  description?: string;
};

/**
 * Send a Telegram message to the configured channel/chat.
 * Uses MarkdownV2 parse mode.
 */
export async function sendTelegramMessage(content: string) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is required");
  }
  if (!env.TELEGRAM_CHANNEL_ID) {
    throw new Error("TELEGRAM_CHANNEL_ID is required");
  }

  const url = `${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHANNEL_ID,
      text: content,
      parse_mode: "HTML",
      disable_web_page_preview: false
    })
  });

  const body = await response.text();
  let parsed: TelegramResponse;
  try {
    parsed = JSON.parse(body) as TelegramResponse;
  } catch {
    parsed = { ok: false, description: body };
  }

  return {
    ok: response.ok && parsed.ok,
    status: response.status,
    body,
    payloadHash: sha256(content)
  };
}

/**
 * Render tweet analysis as Telegram HTML message.
 */
export function renderTelegramMessage(params: {
  sourceUrl?: string | null;
  original: string;
  authorUsername: string;
  analysis: {
    summary_cn: string;
    translated_content_cn: string;
    bullish_stocks: Array<{ ticker: string; company: string; reason: string }>;
    bearish_stocks: Array<{ ticker: string; company: string; reason: string }>;
    sector_tags: string[];
    confidence: number;
  };
  stocks: Array<{
    ticker: string;
    price: number | null;
    market_cap: string | null;
    company: string | null;
  }>;
}): string {
  const { analysis, stocks } = params;
  const stockMap = new Map(stocks.map((s) => [s.ticker, s]));
  const lines: string[] = [];

  lines.push(`🔍 <b>@${params.authorUsername} 最新观点</b>`);
  lines.push("");
  lines.push(`<i>原文：${escapeHtml(params.original.slice(0, 280))}</i>`);
  lines.push("");
  lines.push(`📌 <b>中文解读</b>`);
  lines.push(escapeHtml(analysis.translated_content_cn || analysis.summary_cn));
  lines.push("");
  lines.push(`🧠 <b>AI 投资分析</b>`);
  lines.push(escapeHtml(analysis.summary_cn));
  lines.push("");

  if (analysis.bullish_stocks.length > 0) {
    lines.push("🟢 <b>利好个股</b>");
    analysis.bullish_stocks.slice(0, 5).forEach((signal, i) => {
      const stock = stockMap.get(signal.ticker);
      const price = stock?.price != null ? `$${stock.price.toFixed(2)}` : "—";
      const mktCap = stock?.market_cap ?? "—";
      lines.push(
        `${i + 1}. <code>${signal.ticker}</code> ${escapeHtml(signal.company || (stock?.company ?? ""))} | ${price} | ${mktCap}`
      );
      lines.push(`   └ ${escapeHtml(signal.reason.slice(0, 150))}`);
    });
    lines.push("");
  }

  if (analysis.bearish_stocks.length > 0) {
    lines.push("🔴 <b>利空个股</b>");
    analysis.bearish_stocks.slice(0, 3).forEach((signal, i) => {
      lines.push(`${i + 1}. <code>${signal.ticker}</code> ${escapeHtml(signal.company)}`);
      lines.push(`   └ ${escapeHtml(signal.reason.slice(0, 150))}`);
    });
    lines.push("");
  }

  if (analysis.sector_tags.length > 0) {
    lines.push(analysis.sector_tags.map((tag) => `#${tag.replace(/\s+/g, "")}`).join(" "));
    lines.push("");
  }

  lines.push(`置信度 ${analysis.confidence}/100`);
  if (params.sourceUrl) {
    lines.push(`<a href="${params.sourceUrl}">查看原文 →</a>`);
  }

  return lines.join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
