/**
 * WxPusher 推送模块
 *
 * WxPusher 是个人微信消息推送服务：
 * - 用户扫码订阅 → 收到你的消息（推到个人微信）
 * - 支持多用户，适合付费订阅产品
 * - 官网：https://wxpusher.zjiecode.com
 *
 * 接入步骤（5分钟）：
 * 1. https://wxpusher.zjiecode.com/admin/main/app/appToken 创建应用
 * 2. 复制 App Token → 填入 WXPUSHER_APP_TOKEN
 * 3. 创建应用后有一个 topicId（话题ID）→ 填入 WXPUSHER_TOPIC_ID
 *    （所有订阅该话题的用户都会收到消息）
 * 4. 把订阅二维码发给付费用户
 */

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { TopMention } from "@/lib/insights";
import type { AiAnalysis, StockProfile } from "@/types";

const WXPUSHER_API = "https://wxpusher.zjiecode.com/api/send/message";

// ─── Types ────────────────────────────────────────────────────────────────────

type WxPusherPayload = {
  appToken: string;
  content: string;
  summary: string;         // 消息预览（手机通知栏显示）
  contentType: 1 | 2 | 3; // 1=文字 2=HTML 3=Markdown
  topicIds?: number[];     // 推送给订阅该话题的所有用户
  uids?: string[];         // 推送给指定用户（付费用户的 uid）
  url?: string;            // 点击跳转链接
  /**
   * 验证付费状态后再推送（App 上架后使用）
   * 0 = 不验证（所有订阅者）
   * 1 = 只推送给付费用户
   * 2 = 只推送给未付费用户（催付款用）
   */
  verifyPayType?: 0 | 1 | 2;
};

type WxPusherResponse = {
  code: number;
  msg: string;
  success: boolean;
  data?: Array<{ uid: string; messageId: number; code: number; status: string }>;
};

// ─── Render ───────────────────────────────────────────────────────────────────

export type WxPusherInput = {
  sourceUrl?: string | null;
  original: string;
  authorUsername?: string;
  /** 推文发布时间（UTC），渲染时转换为美国中部时间显示 */
  tweetCreatedAt?: Date;
  /** 推文附带图片（来自 Twitter API media expansion） */
  imageUrls?: string[];
  analysis: AiAnalysis;
  stocks: StockProfile[];
  /** 近30天最热提及股票，来自 getTopMentionedStocks() */
  topMentions?: TopMention[];
};

/**
 * 渲染 WxPusher HTML 消息。
 * WxPusher 支持 HTML，比企业微信限制少，排版更丰富。
 */
export function renderWxPusherHtml(input: WxPusherInput): string {
  const { analysis, stocks } = input;
  const stockMap = new Map(stocks.map((s) => [s.ticker, s]));
  const author = input.authorUsername ?? "Serenity";

  const bullishHtml = analysis.bullish_stocks
    .slice(0, 5)
    .map((sig, i) => {
      const stock = stockMap.get(sig.ticker);
      return `
        <div style="margin:12px 0;padding:12px;background:#f0fdf4;border-left:3px solid #22c55e;border-radius:4px;">
          <div style="font-weight:bold;font-size:15px;">${i + 1}. ${sig.ticker}（${sig.company || stock?.company || sig.ticker}）</div>
          <div style="color:#166534;font-size:13px;margin-top:6px;">📈 ${sig.reason}</div>
        </div>`;
    })
    .join("");

  const bearishHtml = analysis.bearish_stocks
    .slice(0, 3)
    .map((sig) => {
      const stock = stockMap.get(sig.ticker);
      return `
        <div style="margin:12px 0;padding:12px;background:#fff1f2;border-left:3px solid #ef4444;border-radius:4px;">
          <div style="font-weight:bold;font-size:15px;">${sig.ticker}（${sig.company || stock?.company || sig.ticker}）</div>
          <div style="color:#991b1b;font-size:13px;margin-top:6px;">📉 ${sig.reason}</div>
        </div>`;
    })
    .join("");

  const tags = analysis.sector_tags
    .slice(0, 6)
    .map((t) => `<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:12px;font-size:12px;margin:2px;">#${t}</span>`)
    .join(" ");

  const confidence = analysis.confidence;
  const barFilled = Math.round(confidence / 10);
  const bar = "█".repeat(barFilled) + "░".repeat(10 - barFilled);

  const sourceLink = input.sourceUrl
    ? `<a href="${input.sourceUrl}" style="color:#2563eb;font-size:12px;">查看原文 →</a>`
    : "";

  // ── 近30天热榜 ──────────────────────────────────────────────────────────────
  const topMentionsHtml = buildTopMentionsHtml(input.topMentions);

  // ── 美国中部时间（CST/CDT，America/Chicago）─────────────────────────────────
  const cstTime = input.tweetCreatedAt
    ? formatCST(input.tweetCreatedAt)
    : null;

  return `
<div style="font-family:-apple-system,sans-serif;max-width:600px;color:#1a1a1a;">

  <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);color:white;padding:16px;border-radius:8px 8px 0 0;">
    <div style="font-size:18px;font-weight:bold;">🚨 @${author} 最新观点</div>
    ${cstTime ? `<div style="font-size:12px;color:#94a3b8;margin-top:4px;">🕐 ${cstTime}</div>` : ""}
  </div>

  <div style="padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;">

    <div style="margin-bottom:12px;">
      <div style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">原文</div>
      <div style="font-style:italic;color:#334155;font-size:14px;line-height:1.6;">"${escapeHtml(input.original)}"</div>
      ${(input.imageUrls ?? []).map((url) =>
        `<img src="${url}" style="margin-top:10px;width:100%;max-width:560px;border-radius:6px;display:block;" />`
      ).join("")}
    </div>

    <div style="margin-bottom:12px;padding:12px;background:white;border-radius:6px;border:1px solid #e2e8f0;">
      <div style="color:#64748b;font-size:12px;margin-bottom:4px;">中文翻译</div>
      <div style="font-size:14px;line-height:1.7;color:#1e293b;">${escapeHtml(analysis.translated_content_cn || analysis.summary_cn)}</div>
    </div>

    <div style="margin-bottom:16px;padding:12px;background:white;border-radius:6px;border:1px solid #e2e8f0;">
      <div style="color:#64748b;font-size:12px;margin-bottom:4px;">AI 核心解读</div>
      <div style="font-size:14px;line-height:1.7;color:#1e293b;">${escapeHtml(analysis.summary_cn)}</div>
    </div>

    ${analysis.bullish_stocks.length > 0 ? `
    <div style="margin-bottom:8px;font-weight:bold;color:#15803d;">📈 AI 判断利好股票</div>
    ${bullishHtml}` : ""}

    ${analysis.bearish_stocks.length > 0 ? `
    <div style="margin:16px 0 8px;font-weight:bold;color:#dc2626;">📉 AI 判断潜在利空</div>
    ${bearishHtml}` : `
    <div style="margin:16px 0;padding:8px 12px;background:#f0fdf4;border-radius:4px;color:#166534;font-size:13px;">
      暂无明显利空信号
    </div>`}

    ${topMentionsHtml}

    <div style="margin-top:16px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <div style="font-size:12px;color:#64748b;">置信度：<span style="font-family:monospace;color:#0f172a;">${bar}</span> ${confidence}/100</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">${tags}</div>
    </div>

    <div style="margin-top:12px;text-align:right;">${sourceLink}</div>

    <div style="margin-top:16px;padding:12px 16px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;text-align:center;">
      <span style="font-size:12px;color:#0369a1;">📊 查看所有历史分析 → </span>
      <a href="https://alphaline.fit/auth/wxpusher" style="font-size:12px;color:#2563eb;font-weight:600;">alphaline.fit</a>
    </div>

  </div>
</div>`.trim();
}

/**
 * 生成推送预览文字（出现在手机通知栏）
 */
export function buildWxPusherSummary(analysis: AiAnalysis): string {
  const bullish = analysis.bullish_stocks.slice(0, 3).map((s) => s.ticker).join(" ");
  const bearish = analysis.bearish_stocks.slice(0, 2).map((s) => s.ticker).join(" ");
  const parts: string[] = [];
  if (bullish) parts.push(`📈 ${bullish}`);
  if (bearish) parts.push(`📉 ${bearish}`);
  return parts.length > 0
    ? `Serenity新信号 ${parts.join(" ｜ ")} 置信度${analysis.confidence}%`
    : "Serenity 发布新观点";
}

// ─── Send ─────────────────────────────────────────────────────────────────────

/**
 * 推送到 WxPusher 话题（所有订阅用户都能收到）
 */
export async function sendWxPusherTopic(
  html: string,
  summary: string,
  sourceUrl?: string | null
): Promise<{ ok: boolean; status: number; body: string }> {
  if (!env.WXPUSHER_APP_TOKEN || !env.WXPUSHER_TOPIC_ID) {
    return { ok: false, status: 400, body: "WXPUSHER_APP_TOKEN or WXPUSHER_TOPIC_ID not set" };
  }

  // ── 1. 发给话题订阅者（verifyPayType:1 只推给付费用户）────────────────────
  const topicPayload: WxPusherPayload = {
    appToken: env.WXPUSHER_APP_TOKEN,
    content: html,
    summary,
    contentType: 2,
    topicIds: [Number(env.WXPUSHER_TOPIC_ID)],
    url: sourceUrl ?? undefined,
    verifyPayType: 1
  };

  let topicOk = false;
  let lastStatus = 500;
  let lastBody = "";

  try {
    const res = await fetch(WXPUSHER_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(topicPayload)
    });
    lastStatus = res.status;
    lastBody = await res.text();
    const json = JSON.parse(lastBody) as WxPusherResponse;
    if (json.success) {
      topicOk = true;
      logger.info({ sent: json.data?.length ?? 0 }, "WxPusher pushed");
    } else {
      logger.warn({ code: json.code, msg: json.msg }, "WxPusher topic error");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "WxPusher topic send failed");
    lastBody = msg;
  }

  // ── 2. 单独发给 owner UID（不校验付费，管理员始终收到）──────────────────────
  if (env.WXPUSHER_OWNER_UID) {
    const ownerPayload: WxPusherPayload = {
      appToken: env.WXPUSHER_APP_TOKEN,
      content: html,
      summary,
      contentType: 2,
      uids: [env.WXPUSHER_OWNER_UID],
      url: sourceUrl ?? undefined
      // 不带 verifyPayType，默认 0（不验证付费）
    };
    try {
      const res = await fetch(WXPUSHER_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ownerPayload)
      });
      const body = await res.text();
      const json = JSON.parse(body) as WxPusherResponse;
      // 打印完整响应，方便排查 UID 未收到的原因
      console.log("[WxPusher owner] 完整响应:", JSON.stringify(json, null, 2));
      if (json.success) {
        logger.info({ uid: env.WXPUSHER_OWNER_UID, data: json.data }, "WxPusher owner pushed");
      } else {
        logger.warn({ code: json.code, msg: json.msg }, "WxPusher owner error");
      }
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : err }, "WxPusher owner send failed");
    }
  }

  return topicOk
    ? { ok: true, status: lastStatus, body: lastBody }
    : { ok: false, status: lastStatus, body: lastBody };
}

/**
 * 推送到指定 UID 列表（付费用户精准推送）
 */
export async function sendWxPusherToUids(
  uids: string[],
  html: string,
  summary: string,
  sourceUrl?: string | null
): Promise<{ ok: boolean; status: number; body: string }> {
  if (!env.WXPUSHER_APP_TOKEN) {
    return { ok: false, status: 400, body: "WXPUSHER_APP_TOKEN not set" };
  }
  if (uids.length === 0) {
    return { ok: true, status: 200, body: "no_uids" };
  }

  const payload: WxPusherPayload = {
    appToken: env.WXPUSHER_APP_TOKEN,
    content: html,
    summary,
    contentType: 2,
    uids,
    url: sourceUrl ?? undefined
  };

  try {
    const res = await fetch(WXPUSHER_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await res.text();
    const json = JSON.parse(body) as WxPusherResponse;
    return { ok: json.success, status: res.status, body };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 500, body: msg };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * 渲染「近30天最热提及股票」板块
 * 和 dashboard 一致：利好、利空分行显示，每行附上中文标签
 */
function buildTopMentionsHtml(topMentions?: TopMention[]): string {
  if (!topMentions || topMentions.length === 0) return "";

  // 展开为每个 (ticker, stance) 独立一行，按次数降序，最多显示 10 行
  const lines: Array<{ ticker: string; company: string | null; stance: "bullish" | "bearish"; count: number }> = [];
  for (const m of topMentions) {
    if (m.bullishCount > 0) lines.push({ ticker: m.ticker, company: m.companyName, stance: "bullish", count: m.bullishCount });
    if (m.bearishCount > 0) lines.push({ ticker: m.ticker, company: m.companyName, stance: "bearish", count: m.bearishCount });
  }
  lines.sort((a, b) => b.count - a.count);
  const top = lines.slice(0, 20);

  const rows = top.map((line, i) => {
    const isBullish = line.stance === "bullish";
    const stanceBadge = isBullish
      ? `<span style="display:inline-block;padding:1px 7px;border-radius:10px;background:#dcfce7;color:#166534;font-size:11px;font-weight:600;">利好</span>`
      : `<span style="display:inline-block;padding:1px 7px;border-radius:10px;background:#fee2e2;color:#991b1b;font-size:11px;font-weight:600;">利空</span>`;
    const tickerColor = isBullish ? "#15803d" : "#dc2626";
    const name = line.company
      ? `<span style="color:#94a3b8;font-size:11px;margin-left:4px;">${escapeHtml(line.company)}</span>`
      : "";
    return `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:6px 6px;color:#cbd5e1;font-size:11px;text-align:center;width:20px;">${i + 1}</td>
        <td style="padding:6px 4px;">${stanceBadge}</td>
        <td style="padding:6px 4px;">
          <span style="font-family:monospace;font-weight:700;font-size:13px;color:${tickerColor};">${line.ticker}</span>${name}
        </td>
        <td style="padding:6px 6px;text-align:right;font-weight:600;font-size:13px;color:#374151;white-space:nowrap;">
          ${line.count} 次
        </td>
      </tr>`;
  }).join("");

  return `
    <div style="margin-top:20px;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">
      <div style="font-weight:700;font-size:13px;color:#374151;margin-bottom:10px;">
        📊 近30天最热提及（共 ${top.length} 条信号）
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/**
 * 把 UTC 时间转换为美国中部时间字符串（自动处理夏令时 CST/CDT）
 * 输出格式：2026/05/27 14:30 CST
 */
function formatCST(date: Date): string {
  // 时间转换用 America/Chicago（自动处理夏令时），标签统一显示 CST
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}/${get("month")}/${get("day")} ${get("hour")}:${get("minute")} CST`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
