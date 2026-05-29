import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkDashboardAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getTopMentionedStocks } from "@/lib/insights";
import type { AiAnalysis } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  // ── 访问控制 ────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/dashboard");
  }

  const access = await checkDashboardAccess(session.user.id);
  if (!access.ok) {
    // 订阅过期或未订阅 → 跳转到付费墙页面
    redirect(`/dashboard/subscribe?reason=${access.reason}`);
  }

  const [tweets, topMentions] = await Promise.all([
    prisma.tweet.findMany({
      orderBy: { tweetCreatedAt: "desc" },
      include: {
        stockMentions: {
          include: { stock: { select: { ticker: true, companyName: true } } }
        }
      }
    }).catch(() => []),
    getTopMentionedStocks(30, 15).catch(() => [])
  ]);

  const total = tweets.length;
  const pushed = tweets.filter((t) => t.pushed).length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white text-sm font-bold">S</div>
            <div>
              <h1 className="text-base font-semibold text-slate-900">Serenity Intelligence</h1>
              <p className="text-xs text-slate-500">历史归档 · {total} 条推文 · {pushed} 条已推送</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/admin" className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              手动分析
            </a>
            <Link href="/pricing" className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700">
              订阅
            </Link>
          </div>
        </div>
      </header>

      {/* ── Body: Feed + Sidebar ── */}
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex gap-6 items-start">

          {/* ── 主推文 Feed ── */}
          <div className="flex-1 min-w-0 space-y-4">
            {tweets.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
                暂无推文记录
              </div>
            )}

            {tweets.map((tweet) => {
              const analysis = tweet.aiAnalysis as AiAnalysis | null;
              return (
                <article key={tweet.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">

                  {/* 顶部深色栏：作者 / 时间 / 置信度 / 推送状态 */}
                  <div className="flex items-center justify-between px-5 py-3 bg-slate-900 text-white">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-teal-300">@{tweet.authorUsername}</span>
                      <span className="text-xs text-slate-400">{formatCST(tweet.tweetCreatedAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
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

                  <div className="px-5 py-4 space-y-4">
                    {/* 原文 */}
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">原文</p>
                      <p className="text-sm italic text-slate-600 leading-relaxed">&ldquo;{tweet.content}&rdquo;</p>
                    </div>

                    {analysis ? (
                      <>
                        {/* 中文翻译 */}
                        {analysis.translated_content_cn && (
                          <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
                            <p className="text-xs uppercase tracking-wide text-blue-400 mb-1">中文翻译</p>
                            <p className="text-sm text-blue-900 leading-relaxed">{analysis.translated_content_cn}</p>
                          </div>
                        )}

                        {/* AI 解读 */}
                        <div className="rounded-lg bg-slate-50 border border-slate-100 px-4 py-3">
                          <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">AI 核心解读</p>
                          <p className="text-sm text-slate-800 leading-relaxed">{analysis.summary_cn}</p>
                        </div>

                        {/* 利好股票 */}
                        {analysis.bullish_stocks.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-green-700 mb-2">📈 AI 判断利好</p>
                            <div className="space-y-2">
                              {analysis.bullish_stocks.map((s) => (
                                <div key={s.ticker} className="rounded-lg bg-green-50 border-l-4 border-green-500 px-3 py-2">
                                  <span className="font-mono font-bold text-sm text-green-900">{s.ticker}</span>
                                  {s.company && <span className="text-xs text-green-700 ml-2">{s.company}</span>}
                                  <p className="text-xs text-green-800 mt-1 leading-relaxed">{s.reason}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 利空股票 */}
                        {analysis.bearish_stocks.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-red-700 mb-2">📉 AI 判断利空</p>
                            <div className="space-y-2">
                              {analysis.bearish_stocks.map((s) => (
                                <div key={s.ticker} className="rounded-lg bg-red-50 border-l-4 border-red-500 px-3 py-2">
                                  <span className="font-mono font-bold text-sm text-red-900">{s.ticker}</span>
                                  {s.company && <span className="text-xs text-red-700 ml-2">{s.company}</span>}
                                  <p className="text-xs text-red-800 mt-1 leading-relaxed">{s.reason}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 标签 */}
                        {analysis.sector_tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {analysis.sector_tags.map((tag) => (
                              <span key={tag} className="text-xs bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-2.5 py-0.5">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-slate-400 italic">等待 AI 分析...</p>
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

          {/* ── 右侧边栏 ── */}
          <div className="w-72 flex-shrink-0 space-y-4">

            {/* 统计卡片 */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">数据总览</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
                  <p className="text-xl font-bold text-slate-800">{total}</p>
                  <p className="text-xs text-slate-500 mt-0.5">归档推文</p>
                </div>
                <div className="rounded-lg bg-emerald-50 px-3 py-2 text-center">
                  <p className="text-xl font-bold text-emerald-700">{pushed}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">已推送</p>
                </div>
              </div>
            </div>

            {/* 近30天热门股票 */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
                🔥 近30天热门股票
              </h2>
              {topMentions.length === 0 ? (
                <p className="text-xs text-slate-400 italic">暂无数据</p>
              ) : (
                <div className="space-y-2">
                  {topMentions.map((m, i) => (
                    <div key={m.ticker} className="flex items-center gap-2">
                      {/* 排名 */}
                      <span className={`w-5 text-center text-xs font-bold flex-shrink-0 ${
                        i === 0 ? "text-yellow-500" :
                        i === 1 ? "text-slate-400" :
                        i === 2 ? "text-amber-600" :
                        "text-slate-300"
                      }`}>
                        {i + 1}
                      </span>
                      {/* Ticker + 公司名 */}
                      <div className="flex-1 min-w-0">
                        <span className="font-mono font-bold text-sm text-slate-800">{m.ticker}</span>
                        {m.companyName && (
                          <span className="text-xs text-slate-400 ml-1 truncate">{m.companyName}</span>
                        )}
                      </div>
                      {/* 利好 / 利空 次数 */}
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {m.bullishCount > 0 && (
                          <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                            <span>📈</span>
                            <span>利好 {m.bullishCount}次</span>
                          </span>
                        )}
                        {m.bearishCount > 0 && (
                          <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                            <span>📉</span>
                            <span>利空 {m.bearishCount}次</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
