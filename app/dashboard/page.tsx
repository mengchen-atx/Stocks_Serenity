import { redirect } from "next/navigation";
import { getSessionUid } from "@/lib/wxpusher-auth";
import { prisma } from "@/lib/prisma";
import { getAllMentionedStocks } from "@/lib/insights";
import type { AiAnalysis } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─── 展示层清理：去掉遗留的 t.co 短链 ────────────────────────────────────────────

function stripTcoLinks(text: string): string {
  return text.replace(/https?:\/\/t\.co\/\S+/g, "").replace(/\s{2,}/g, " ").trim();
}

// ─── CST 时间格式化 ────────────────────────────────────────────────────────────

function formatCST(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}/${get("month")}/${get("day")} ${get("hour")}:${get("minute")} CST`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  if (!process.env.DATABASE_URL) {
    return <div className="p-8 text-amber-700">请配置 DATABASE_URL</div>;
  }

  const uid = await getSessionUid();
  if (!uid) redirect("/auth/wxpusher");

  const [tweets, topMentions] = await Promise.all([
    prisma.tweet.findMany({
      orderBy: { tweetCreatedAt: "desc" },
      include: {
        stockMentions: {
          include: { stock: { select: { ticker: true, companyName: true } } }
        }
      }
    }).catch(() => []),
    getAllMentionedStocks(30).catch(() => [])
  ]);

  const total = tweets.length;

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white text-sm font-bold">S</div>
            <div>
              <h1 className="text-sm font-semibold text-slate-900 sm:text-base">Serenity Intelligence</h1>
              <p className="text-xs text-slate-500">{total} 条推文</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-slate-400 font-mono">{uid.slice(0, 12)}…</span>
            <form action="/api/auth/wxpusher/logout" method="POST">
              <button
                type="submit"
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                退出
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        {/* 手机：单列（feed 在上，侧边栏在下）；桌面：双列 */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">

          {/* ── 主推文 Feed（手机排第二，桌面排第一）── */}
          <div className="order-2 min-w-0 flex-1 space-y-3 sm:space-y-4 lg:order-1">
            {tweets.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
                暂无推文记录
              </div>
            )}

            {tweets.map((tweet) => {
              const analysis = tweet.aiAnalysis as AiAnalysis | null;
              return (
                <article key={tweet.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

                  {/* 顶部深色栏 */}
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 bg-slate-900 px-3 py-2.5 text-white sm:px-5 sm:py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex-shrink-0 text-xs font-medium text-teal-300">@{tweet.authorUsername}</span>
                      <span className="truncate text-xs text-slate-400">{formatCST(tweet.tweetCreatedAt)}</span>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      {analysis && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          analysis.confidence >= 80 ? "bg-green-500/20 text-green-300" :
                          analysis.confidence >= 50 ? "bg-yellow-500/20 text-yellow-300" :
                          "bg-slate-500/20 text-slate-400"
                        }`}>
                          {analysis.confidence}%
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        tweet.pushed ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-500/20 text-slate-400"
                      }`}>
                        {tweet.pushed ? "✓ 已推送" : "未推送"}
                      </span>
                    </div>
                  </div>

                  {/* 卡片内容 */}
                  <div className="space-y-3 px-3 py-3 sm:space-y-4 sm:px-5 sm:py-4">

                    {/* 原文 */}
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">原文</p>
                      <p className="text-sm italic leading-relaxed text-slate-600">&ldquo;{stripTcoLinks(tweet.content)}&rdquo;</p>
                      {tweet.imageUrls.length > 0 && (
                        <div className="mt-2 flex flex-col gap-2">
                          {tweet.imageUrls.map((url, i) => (
                            <img key={i} src={url} alt="" className="w-full rounded-lg object-cover" />
                          ))}
                        </div>
                      )}
                    </div>

                    {analysis ? (
                      <>
                        {/* 中文翻译 */}
                        {analysis.translated_content_cn && (
                          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 sm:px-4 sm:py-3">
                            <p className="mb-1 text-xs uppercase tracking-wide text-blue-400">中文翻译</p>
                            <p className="text-sm leading-relaxed text-blue-900">{analysis.translated_content_cn}</p>
                          </div>
                        )}

                        {/* AI 解读 */}
                        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 sm:px-4 sm:py-3">
                          <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">AI 核心解读</p>
                          <p className="text-sm leading-relaxed text-slate-800">{analysis.summary_cn}</p>
                        </div>

                        {/* 利好股票 */}
                        {analysis.bullish_stocks.length > 0 && (
                          <div>
                            <p className="mb-2 text-xs font-semibold text-green-700">📈 AI 判断利好</p>
                            <div className="space-y-2">
                              {analysis.bullish_stocks.map((s) => (
                                <div key={s.ticker} className="rounded-lg border-l-4 border-green-500 bg-green-50 px-3 py-2">
                                  <div className="flex flex-wrap items-baseline gap-x-2">
                                    <span className="font-mono font-bold text-sm text-green-900">{s.ticker}</span>
                                    {s.company && <span className="text-xs text-green-700">{s.company}</span>}
                                  </div>
                                  <p className="mt-1 text-xs leading-relaxed text-green-800">{s.reason}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 利空股票 */}
                        {analysis.bearish_stocks.length > 0 && (
                          <div>
                            <p className="mb-2 text-xs font-semibold text-red-700">📉 AI 判断利空</p>
                            <div className="space-y-2">
                              {analysis.bearish_stocks.map((s) => (
                                <div key={s.ticker} className="rounded-lg border-l-4 border-red-500 bg-red-50 px-3 py-2">
                                  <div className="flex flex-wrap items-baseline gap-x-2">
                                    <span className="font-mono font-bold text-sm text-red-900">{s.ticker}</span>
                                    {s.company && <span className="text-xs text-red-700">{s.company}</span>}
                                  </div>
                                  <p className="mt-1 text-xs leading-relaxed text-red-800">{s.reason}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 标签 */}
                        {analysis.sector_tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {analysis.sector_tags.map((tag) => (
                              <span key={tag} className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs text-teal-700">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-xs italic text-slate-400">等待 AI 分析...</p>
                    )}

                    {/* 查看原文 */}
                    {tweet.sourceUrl && (
                      <div className="pt-1">
                        <a href={tweet.sourceUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-teal-600 hover:underline">
                          查看原文 →
                        </a>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {/* ── 侧边栏（手机排第一在上，桌面排第二靠右）── */}
          <div className="order-1 w-full space-y-4 lg:order-2 lg:w-72 lg:flex-shrink-0">

            {/* 近30天全部股票 */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                📊 近30天提及股票（{topMentions.length} 只）
              </h2>
              {topMentions.length === 0 ? (
                <p className="text-xs italic text-slate-400">暂无数据</p>
              ) : (
                <>
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1 lg:max-h-[70vh]">
                  {topMentions.map((m, i) => (
                    <div key={m.ticker} className="flex items-center gap-2">
                      <span className={`w-5 flex-shrink-0 text-center text-xs font-bold ${
                        i === 0 ? "text-yellow-500" :
                        i === 1 ? "text-slate-400" :
                        i === 2 ? "text-amber-600" :
                        "text-slate-300"
                      }`}>
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="font-mono font-bold text-sm text-slate-800">{m.ticker}</span>
                        {m.companyName && (
                          <span className="ml-1 truncate text-xs text-slate-400">{m.companyName}</span>
                        )}
                      </div>
                      <div className="flex flex-shrink-0 flex-col items-end gap-1">
                        {m.bullishCount > 0 && (
                          <span className="flex items-center gap-1 rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700">
                            <span>📈</span><span>{m.bullishCount}</span>
                          </span>
                        )}
                        {m.bearishCount > 0 && (
                          <span className="flex items-center gap-1 rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700">
                            <span>📉</span><span>{m.bearishCount}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-2">
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <span>📈</span> 看好
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <span>📉</span> 看空
                  </span>
                  <span className="ml-auto text-xs text-slate-300">次数 = AI 分析次数</span>
                </div>
                </>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
