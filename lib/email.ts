import { Resend } from "resend";
import { env } from "@/lib/env";
import { sha256 } from "@/lib/hash";

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is required");
  resendClient ??= new Resend(env.RESEND_API_KEY);
  return resendClient;
}

export type EmailAlertParams = {
  to: string | string[];
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
    industry: string | null;
  }>;
};

export async function sendEmailAlert(params: EmailAlertParams) {
  const resend = getResend();
  const recipients = env.EMAIL_TO_OVERRIDE
    ? [env.EMAIL_TO_OVERRIDE]
    : Array.isArray(params.to)
    ? params.to
    : [params.to];

  const html = renderEmailHtml(params);
  const subject = buildSubject(params);

  const response = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: recipients,
    subject,
    html
  });

  const ok = !response.error;
  const body = JSON.stringify(response);

  return {
    ok,
    status: ok ? 200 : 500,
    body,
    payloadHash: sha256(html)
  };
}

function buildSubject(params: EmailAlertParams): string {
  const tickers = [
    ...params.analysis.bullish_stocks.slice(0, 2).map((s) => s.ticker),
    ...params.analysis.bearish_stocks.slice(0, 1).map((s) => s.ticker)
  ].join(" / ");
  const suffix = tickers ? ` — ${tickers}` : "";
  return `🔍 @${params.authorUsername} 最新观点${suffix}`;
}

function renderEmailHtml(params: EmailAlertParams): string {
  const { analysis, stocks } = params;
  const stockMap = new Map(stocks.map((s) => [s.ticker, s]));

  const bullishRows = analysis.bullish_stocks
    .slice(0, 6)
    .map((signal) => {
      const stock = stockMap.get(signal.ticker);
      const price = stock?.price != null ? `$${stock.price.toFixed(2)}` : "—";
      const mktCap = stock?.market_cap ?? "—";
      return `
        <tr style="border-bottom:1px solid #f0f0f0">
          <td style="padding:10px 12px;font-weight:600;color:#047857;font-family:monospace">${signal.ticker}</td>
          <td style="padding:10px 12px;color:#374151">${signal.company || (stock?.company ?? "")}</td>
          <td style="padding:10px 12px;color:#374151">${price}</td>
          <td style="padding:10px 12px;color:#374151">${mktCap}</td>
          <td style="padding:10px 12px;color:#6b7280;font-size:13px">${signal.reason.slice(0, 200)}</td>
        </tr>`;
    })
    .join("");

  const bearishRows = analysis.bearish_stocks
    .slice(0, 3)
    .map((signal) => {
      const stock = stockMap.get(signal.ticker);
      const price = stock?.price != null ? `$${stock.price.toFixed(2)}` : "—";
      return `
        <tr style="border-bottom:1px solid #f0f0f0">
          <td style="padding:10px 12px;font-weight:600;color:#be123c;font-family:monospace">${signal.ticker}</td>
          <td style="padding:10px 12px;color:#374151">${signal.company || (stock?.company ?? "")}</td>
          <td style="padding:10px 12px;color:#374151">${price}</td>
          <td style="padding:10px 12px;color:#6b7280;font-size:13px">${signal.reason.slice(0, 200)}</td>
        </tr>`;
    })
    .join("");

  const tagPills = analysis.sector_tags
    .map(
      (tag) =>
        `<span style="display:inline-block;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;border-radius:4px;padding:2px 8px;font-size:12px;margin:2px">#${tag}</span>`
    )
    .join(" ");

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Serenity Intelligence</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:680px;margin:0 auto;padding:24px 16px">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0f766e,#0369a1);border-radius:12px;padding:24px;margin-bottom:20px">
    <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.7);margin-bottom:6px">AI 投资情报</div>
    <div style="font-size:22px;font-weight:700;color:#fff">@${params.authorUsername} 最新观点</div>
  </div>

  <!-- Original Tweet -->
  <div style="background:#fff;border-radius:10px;padding:20px;margin-bottom:16px;border-left:4px solid #0f766e;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <div style="font-size:11px;color:#6b7280;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">原文</div>
    <div style="font-size:15px;color:#374151;line-height:1.6;font-style:italic">"${params.original}"</div>
  </div>

  <!-- Translation + Analysis -->
  <div style="background:#fff;border-radius:10px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <div style="font-size:11px;color:#6b7280;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">中文解读</div>
    <div style="font-size:15px;color:#374151;line-height:1.7;margin-bottom:16px">${analysis.translated_content_cn || analysis.summary_cn}</div>
    <div style="font-size:11px;color:#6b7280;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">AI 投资分析</div>
    <div style="font-size:14px;color:#4b5563;line-height:1.7">${analysis.summary_cn}</div>
  </div>

  ${
    bullishRows
      ? `<!-- Bullish Stocks -->
  <div style="background:#fff;border-radius:10px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <div style="font-size:14px;font-weight:600;color:#047857;margin-bottom:12px">🟢 利好个股</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:#f0fdf4">
          <th style="padding:8px 12px;text-align:left;color:#374151">代码</th>
          <th style="padding:8px 12px;text-align:left;color:#374151">公司</th>
          <th style="padding:8px 12px;text-align:left;color:#374151">价格</th>
          <th style="padding:8px 12px;text-align:left;color:#374151">市值</th>
          <th style="padding:8px 12px;text-align:left;color:#374151">逻辑</th>
        </tr>
      </thead>
      <tbody>${bullishRows}</tbody>
    </table>
  </div>`
      : ""
  }

  ${
    bearishRows
      ? `<!-- Bearish Stocks -->
  <div style="background:#fff;border-radius:10px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <div style="font-size:14px;font-weight:600;color:#be123c;margin-bottom:12px">🔴 利空个股</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:#fff1f2">
          <th style="padding:8px 12px;text-align:left;color:#374151">代码</th>
          <th style="padding:8px 12px;text-align:left;color:#374151">公司</th>
          <th style="padding:8px 12px;text-align:left;color:#374151">价格</th>
          <th style="padding:8px 12px;text-align:left;color:#374151">逻辑</th>
        </tr>
      </thead>
      <tbody>${bearishRows}</tbody>
    </table>
  </div>`
      : ""
  }

  <!-- Tags + Footer -->
  <div style="background:#fff;border-radius:10px;padding:16px 20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <div style="margin-bottom:10px">${tagPills || '<span style="color:#9ca3af;font-size:13px">无主题标签</span>'}</div>
    <div style="font-size:12px;color:#9ca3af">置信度 ${analysis.confidence}/100</div>
  </div>

  ${
    params.sourceUrl
      ? `<div style="text-align:center;margin-bottom:24px">
    <a href="${params.sourceUrl}" style="display:inline-block;background:#0f766e;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600">查看原文 →</a>
  </div>`
      : ""
  }

  <div style="text-align:center;font-size:11px;color:#9ca3af;padding-top:16px;border-top:1px solid #f3f4f6">
    Serenity Intelligence · AI Infra Narrative Terminal<br>
    <a href="${env.APP_BASE_URL}/dashboard" style="color:#6b7280">查看 Dashboard</a>
    · <a href="${env.APP_BASE_URL}/settings" style="color:#6b7280">管理通知设置</a>
  </div>
</div>
</body>
</html>`;
}
