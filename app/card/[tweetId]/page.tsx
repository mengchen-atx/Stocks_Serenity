/**
 * /card/[tweetId]?token=CARD_SECRET_TOKEN
 *
 * A clean, auth-free card page designed for Playwright screenshots.
 * Protected by a secret token so it isn't publicly scrape-able.
 * Optimised for 1080px wide capture → Xiaohongshu image post.
 */

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { AiAnalysis } from "@/types";

export const dynamic = "force-dynamic";

// Strip t.co tracking links and normalise whitespace
function cleanText(text: string): string {
  return text
    .replace(/https?:\/\/t\.co\/\S+/g, "")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(date).replace(/\//g, "-");
}

export default async function CardPage({
  params,
  searchParams,
}: {
  params: Promise<{ tweetId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { tweetId } = await params;
  const { token } = await searchParams;

  // Token guard — must match CARD_SECRET_TOKEN env var
  const secret = process.env.CARD_SECRET_TOKEN;
  if (secret && token !== secret) return notFound();

  const tweet = await prisma.tweet.findUnique({
    where: { id: tweetId },
    include: { channel: { select: { name: true, slug: true } } },
  });
  if (!tweet) return notFound();

  const analysis = tweet.aiAnalysis as AiAnalysis | null;
  const originalText = cleanText(tweet.content);

  return (
    <html lang="zh">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=1080" />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            width: 1080px;
            background: #0f172a;
            font-family: -apple-system, "PingFang SC", "Helvetica Neue", sans-serif;
            color: #e2e8f0;
          }
          .card {
            width: 1080px;
            min-height: 600px;
            padding: 64px 72px 72px;
            background: linear-gradient(160deg, #0f172a 0%, #1e293b 100%);
            position: relative;
            overflow: hidden;
          }
          .card::before {
            content: '';
            position: absolute;
            top: -200px; right: -200px;
            width: 500px; height: 500px;
            background: radial-gradient(circle, rgba(56,189,248,0.08) 0%, transparent 70%);
            pointer-events: none;
          }
          .header {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 36px;
          }
          .avatar {
            width: 56px; height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, #38bdf8, #818cf8);
            display: flex; align-items: center; justify-content: center;
            font-size: 22px; font-weight: 700; color: white;
            flex-shrink: 0;
          }
          .author-info { flex: 1; }
          .author-name {
            font-size: 20px; font-weight: 600; color: #f1f5f9;
          }
          .author-meta {
            font-size: 14px; color: #64748b; margin-top: 3px;
          }
          .badge {
            font-size: 12px; font-weight: 600;
            padding: 4px 12px; border-radius: 20px;
            background: rgba(56,189,248,0.12);
            color: #38bdf8; border: 1px solid rgba(56,189,248,0.25);
          }
          .section { margin-bottom: 28px; }
          .section-label {
            font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
            color: #475569; text-transform: uppercase; margin-bottom: 10px;
          }
          .original-text {
            font-size: 18px; line-height: 1.7; color: #94a3b8;
            white-space: pre-wrap; word-break: break-word;
          }
          .translated-text {
            font-size: 20px; line-height: 1.75; color: #e2e8f0;
            white-space: pre-wrap; word-break: break-word;
          }
          .summary-text {
            font-size: 17px; line-height: 1.7; color: #cbd5e1;
            white-space: pre-wrap; word-break: break-word;
          }
          .divider {
            height: 1px;
            background: linear-gradient(90deg, rgba(148,163,184,0.15) 0%, transparent 100%);
            margin: 28px 0;
          }
          .stocks-row {
            display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px;
          }
          .stock-chip {
            display: flex; align-items: center; gap: 6px;
            padding: 6px 14px; border-radius: 8px;
            font-size: 14px; font-weight: 600;
          }
          .stock-chip.bullish {
            background: rgba(34,197,94,0.12);
            border: 1px solid rgba(34,197,94,0.25);
            color: #4ade80;
          }
          .stock-chip.bearish {
            background: rgba(239,68,68,0.12);
            border: 1px solid rgba(239,68,68,0.25);
            color: #f87171;
          }
          .stock-reason {
            font-size: 12px; font-weight: 400; color: inherit; opacity: 0.75;
          }
          .footer {
            display: flex; align-items: center; justify-content: space-between;
            margin-top: 48px; padding-top: 24px;
            border-top: 1px solid rgba(148,163,184,0.1);
          }
          .footer-brand {
            font-size: 13px; color: #475569; font-weight: 500;
          }
          .footer-brand span { color: #38bdf8; }
          .confidence-pill {
            font-size: 12px; font-weight: 700; padding: 4px 12px;
            border-radius: 20px; background: rgba(148,163,184,0.08);
            color: #94a3b8; border: 1px solid rgba(148,163,184,0.15);
          }
        `}</style>
      </head>
      <body>
        <div className="card" id="card">
          {/* Header */}
          <div className="header">
            <div className="avatar">
              {(tweet.channel?.name ?? tweet.authorUsername).charAt(0).toUpperCase()}
            </div>
            <div className="author-info">
              <div className="author-name">
                {tweet.channel?.name ?? tweet.authorUsername}
              </div>
              <div className="author-meta">
                @{tweet.authorUsername} · {formatDate(tweet.tweetCreatedAt)}
              </div>
            </div>
            <div className="badge">AI 解读</div>
          </div>

          {/* Original */}
          {originalText && (
            <div className="section">
              <div className="section-label">原文</div>
              <p className="original-text">{originalText}</p>
            </div>
          )}

          {analysis && (
            <>
              {/* Chinese translation */}
              {analysis.translated_content_cn && (
                <>
                  <div className="divider" />
                  <div className="section">
                    <div className="section-label">中文翻译</div>
                    <p className="translated-text">{analysis.translated_content_cn}</p>
                  </div>
                </>
              )}

              {/* AI summary */}
              {analysis.summary_cn && (
                <>
                  <div className="divider" />
                  <div className="section">
                    <div className="section-label">AI 解读</div>
                    <p className="summary-text">{analysis.summary_cn}</p>
                  </div>
                </>
              )}

              {/* Bullish stocks */}
              {analysis.bullish_stocks.length > 0 && (
                <div className="section">
                  <div className="section-label">利好 ▲</div>
                  <div className="stocks-row">
                    {analysis.bullish_stocks.slice(0, 6).map((s) => (
                      <div key={s.ticker} className="stock-chip bullish">
                        <span>${s.ticker}</span>
                        {s.reason && (
                          <span className="stock-reason">· {s.reason.slice(0, 20)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bearish stocks */}
              {analysis.bearish_stocks.length > 0 && (
                <div className="section">
                  <div className="section-label">利空 ▼</div>
                  <div className="stocks-row">
                    {analysis.bearish_stocks.slice(0, 6).map((s) => (
                      <div key={s.ticker} className="stock-chip bearish">
                        <span>${s.ticker}</span>
                        {s.reason && (
                          <span className="stock-reason">· {s.reason.slice(0, 20)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Footer */}
          <div className="footer">
            <div className="footer-brand">
              <span>Serenity</span> · AI 美股情报
            </div>
            {analysis?.confidence != null && (
              <div className="confidence-pill">
                AI 置信度 {analysis.confidence}%
              </div>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
