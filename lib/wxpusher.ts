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
import { getAdminUids } from "@/lib/admin";
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
          <div style="font-weight:bold;font-size:15px;">${i + 1}. ${sig.ticker}（${stock?.company || sig.company || sig.ticker}）</div>
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
          <div style="font-weight:bold;font-size:15px;">${sig.ticker}（${stock?.company || sig.company || sig.ticker}）</div>
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
      <div style="font-style:italic;color:#334155;font-size:14px;line-height:1.6;white-space:pre-wrap;">"${escapeHtml(input.original)}"</div>
      ${(input.imageUrls ?? []).map((url) =>
        `<img src="${url}" style="margin-top:10px;width:100%;max-width:560px;border-radius:6px;display:block;" />`
      ).join("")}
    </div>

    <div style="margin-bottom:12px;padding:12px;background:white;border-radius:6px;border:1px solid #e2e8f0;">
      <div style="color:#64748b;font-size:12px;margin-bottom:4px;">中文翻译</div>
      <div style="font-size:14px;line-height:1.7;color:#1e293b;white-space:pre-wrap;">${escapeHtml(analysis.translated_content_cn || analysis.summary_cn)}</div>
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
export function buildWxPusherSummary(
  analysis: AiAnalysis,
  authorUsername?: string,
  newAShareTickers?: string[]
): string {
  // 首次点名的 A 股（不分多空）→ 用紧急标题抢占通知栏，提醒用户立刻查看
  // 不按多空过滤：AI 的看涨/看跌判断有时会出错，但"全新标的"本身就值得立刻关注
  // （历史教训：今天一只新点名的 A 股在 10 分钟内涨停，普通标题容易被刷掉）
  if (newAShareTickers && newAShareTickers.length > 0) {
    const tickers = newAShareTickers.slice(0, 2).join("/");
    return `🚨【A股预警】首次点名 ${tickers}！速看，机会窗口可能很短`;
  }

  const author = authorUsername ?? "Serenity";
  const bullish = analysis.bullish_stocks.slice(0, 3).map((s) => s.ticker).join(" ");
  const bearish = analysis.bearish_stocks.slice(0, 2).map((s) => s.ticker).join(" ");
  const parts: string[] = [];
  if (bullish) parts.push(`📈 ${bullish}`);
  if (bearish) parts.push(`📉 ${bearish}`);
  return parts.length > 0
    ? `${author} 新信号 ${parts.join(" ｜ ")} 置信度${analysis.confidence}%`
    : `${author} 发布新观点`;
}

// ─── Send ─────────────────────────────────────────────────────────────────────

/**
 * 话题广播推送（A类用户专用）
 *
 * 通过 topicIds 发送，来源显示为话题名（如「Serenity一手信息」）。
 * verifyPayType: 1 → WxPusher 自动过滤付费已到期的订阅者。
 */
export async function sendWxPusherTopicBroadcast(
  html: string,
  summary: string,
  sourceUrl?: string | null,
  topicId?: string | null
): Promise<{ ok: boolean; status: number; body: string }> {
  const tid = topicId ?? env.WXPUSHER_TOPIC_ID;
  if (!env.WXPUSHER_APP_TOKEN || !tid) {
    return { ok: false, status: 400, body: "WXPUSHER_APP_TOKEN or topicId not set" };
  }

  const payload: WxPusherPayload = {
    appToken: env.WXPUSHER_APP_TOKEN,
    content: html,
    summary,
    contentType: 2,
    topicIds: [Number(tid)],
    url: sourceUrl ?? undefined,
    verifyPayType: 1, // 只推给付费有效期内的订阅者，过期自动排除
  };

  try {
    const res = await fetch(WXPUSHER_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.text();
    const json = JSON.parse(body) as WxPusherResponse;
    if (json.success) {
      logger.info({ topicId: tid, sent: json.data?.length ?? 0 }, "WxPusher topic broadcast sent");
    } else {
      logger.warn({ code: json.code, msg: json.msg }, "WxPusher topic broadcast error");
    }
    return { ok: json.success, status: res.status, body };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "WxPusher topic broadcast failed");
    return { ok: false, status: 500, body: msg };
  }
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
 * 每支股票一行，和 dashboard 一致：▲看好次数  ▼看空次数，按总次数降序
 */
function buildTopMentionsHtml(topMentions?: TopMention[]): string {
  if (!topMentions || topMentions.length === 0) return "";

  // 按总次数降序，最多取 20 支股票，每支一行
  const top = [...topMentions]
    .sort((a, b) => b.totalCount - a.totalCount)
    .slice(0, 10);

  const rows = top.map((m, i) => {
    const name = m.companyName
      ? `<span style="color:#94a3b8;font-size:11px;margin-left:4px;">${escapeHtml(m.companyName)}</span>`
      : "";
    // 主色：有看好就绿，纯看空才红
    const tickerColor = m.bullishCount > 0 ? "#15803d" : "#dc2626";

    const bullBadge = m.bullishCount > 0
      ? `<span style="display:inline-block;padding:1px 6px;border-radius:10px;background:#dcfce7;color:#166534;font-size:11px;font-weight:700;">▲${m.bullishCount}</span>`
      : "";
    const bearBadge = m.bearishCount > 0
      ? `<span style="display:inline-block;padding:1px 6px;border-radius:10px;background:#fee2e2;color:#991b1b;font-size:11px;font-weight:700;margin-left:3px;">▼${m.bearishCount}</span>`
      : "";

    return `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:6px 6px;color:#cbd5e1;font-size:11px;text-align:center;width:20px;">${i + 1}</td>
        <td style="padding:6px 4px;">
          <span style="font-family:monospace;font-weight:700;font-size:13px;color:${tickerColor};">${m.ticker}</span>${name}
        </td>
        <td style="padding:6px 6px;text-align:right;white-space:nowrap;">
          ${bullBadge}${bearBadge}
        </td>
      </tr>`;
  }).join("");

  return `
    <div style="margin-top:20px;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">
      <div style="font-weight:700;font-size:13px;color:#374151;margin-bottom:10px;">
        📊 近30天最热提及（共 ${top.length} 支股票）
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

// ─── 查询话题订阅者列表 ───────────────────────────────────────────────────────

type WxUserRecord = {
  uid: string;
  payEndTime?: number | null;
};

type WxUserListResponse = {
  code: number;
  success: boolean;
  data?: {
    records?: WxUserRecord[];
    total?: number;
    pageSize?: number;
    currentPage?: number;
  };
};

/**
 * 拉取指定话题的所有订阅者 UID 列表（自动翻页）
 * 用于定时同步：补充因 webhook 丢失而未授权的订阅者
 */
export async function fetchTopicSubscriberUids(topicId: string): Promise<string[]> {
  const subs = await fetchTopicSubscribersWithExpiry(topicId);
  return subs.map((s) => s.uid);
}

/**
 * 拉取指定话题的所有订阅者，附带 payEndTime（自动翻页）
 * 用于同步时设置正确的 expiresAt
 */
export async function fetchTopicSubscribersWithExpiry(
  topicId: string
): Promise<Array<{ uid: string; payEndTime: number | null }>> {
  if (!env.WXPUSHER_APP_TOKEN) return [];

  const result: Array<{ uid: string; payEndTime: number | null }> = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const url = `https://wxpusher.zjiecode.com/api/fun/wxuser/v2?appToken=${env.WXPUSHER_APP_TOKEN}&topicId=${topicId}&page=${page}&pageSize=${pageSize}`;
    try {
      const res = await fetch(url);
      const data = await res.json() as WxUserListResponse;
      if (!data.success || !data.data?.records?.length) break;

      for (const r of data.data.records) {
        if (r.uid) result.push({ uid: r.uid, payEndTime: r.payEndTime ?? null });
      }

      const total = data.data.total ?? 0;
      if (result.length >= total || data.data.records.length < pageSize) break;
      page++;
    } catch {
      break;
    }
  }

  return result;
}

