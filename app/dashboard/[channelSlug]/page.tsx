import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionUid } from "@/lib/wxpusher-auth";
import { prisma } from "@/lib/prisma";
import { getAllMentionedStocks } from "@/lib/insights";
import { getUserChannels, checkChannelAccess } from "@/lib/channels";
import { isAdminUid } from "@/lib/admin";
import type { AiAnalysis } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function stripTcoLinks(text: string): string {
  return text.replace(/https?:\/\/t\.co\/\S+/g, "").replace(/\s{2,}/g, " ").trim();
}

function formatCST(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}/${get("month")}/${get("day")} ${get("hour")}:${get("minute")} CST`;
}

export default async function ChannelDashboardPage({
  params,
}: {
  params: Promise<{ channelSlug: string }>;
}) {
  const uid = await getSessionUid();
  if (!uid) redirect("/auth/wxpusher");

  const { channelSlug } = await params;

  // 权限检查
  const channel = await checkChannelAccess(uid, channelSlug);
  if (!channel) notFound();

  // 用户有权限的所有频道（用于顶部 Tab）
  const userChannels = await getUserChannels(uid);

  const [tweets, topMentions] = await Promise.all([
    prisma.tweet.findMany({
      where: { channelId: channel.id },
      orderBy: { tweetCreatedAt: "desc" },
      include: {
        stockMentions: {
          include: { stock: { select: { ticker: true, companyName: true } } },
        },
      },
    }).catch(() => []),
    getAllMentionedStocks(30, 9999, channel.id).catch(() => []),
  ]);

  const total = tweets.length;

  return (
    <div className="min-h-screen bg-[#070d1a] text-slate-200 overflow-x-hidden">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#070d1a]/95 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4">

          {/* 顶行：品牌 + live + 退出 */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              {channel.avatarUrl ? (
                <img
                  src={channel.avatarUrl}
                  alt={channel.name}
                  className="h-8 w-8 flex-shrink-0 rounded-lg object-cover shadow-lg shadow-teal-500/20"
                />
              ) : (
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-teal-500 text-white text-sm font-bold shadow-lg shadow-teal-500/30">
                  {channel.name[0]}
                </div>
              )}
              <div>
                <h1 className="text-sm font-semibold text-slate-100 tracking-tight sm:text-base">
                  {channel.name}
                </h1>
                <p className="font-mono text-xs text-slate-500">{total} signals</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
                </span>
                LIVE
              </span>
              <Link
                href="/dashboard/alpha-map"
                className="hidden sm:flex items-center gap-1.5 rounded-md border border-amber-700/40 px-3 py-1.5 text-xs font-medium text-amber-500/80 hover:border-amber-600 hover:text-amber-400 hover:bg-amber-900/20 transition-colors"
              >
                ⬡ Alpha Map
              </Link>
              <Link
                href="/dashboard/supply-chain"
                className="hidden sm:flex items-center gap-1.5 rounded-md border border-violet-700/40 px-3 py-1.5 text-xs font-medium text-violet-500/80 hover:border-violet-600 hover:text-violet-400 hover:bg-violet-900/20 transition-colors"
              >
                ⬡ Supply Chain
              </Link>
              {isAdminUid(uid) && (
                <Link
                  href="/ops"
                  className="hidden sm:flex items-center gap-1.5 rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  ⚙️ 后台
                </Link>
              )}
              <form action="/api/auth/wxpusher/logout" method="POST">
                <button
                  type="submit"
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-slate-600 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  退出
                </button>
              </form>
            </div>
          </div>

          {/* 频道 Tab 栏（有多个频道才显示） */}
          {userChannels.length > 1 && (
            <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-none -mx-4 px-4">
              {userChannels.map((ch) => {
                const isActive = ch.slug === channelSlug;
                return (
                  <Link
                    key={ch.slug}
                    href={`/dashboard/${ch.slug}`}
                    className={`relative flex-shrink-0 px-3 py-2 text-xs font-semibold transition-colors rounded-t-md whitespace-nowrap ${
                      isActive
                        ? "text-teal-400 bg-slate-900 border border-b-0 border-slate-700"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {ch.name}
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500 rounded-t" />
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">

          {/* ── 主推文 Feed ── */}
          <div className="order-2 min-w-0 flex-1 space-y-3 sm:space-y-4 lg:order-1">
            {tweets.length === 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center text-slate-600">
                暂无推文记录
              </div>
            )}

            {tweets.map((tweet) => {
              const analysis = tweet.aiAnalysis as AiAnalysis | null;
              const hasBullish = analysis && analysis.bullish_stocks.length > 0;
              const hasBearish = analysis && analysis.bearish_stocks.length > 0;
              const gradientFrom =
                hasBullish && !hasBearish
                  ? "from-emerald-500/10"
                  : hasBearish && !hasBullish
                    ? "from-red-500/10"
                    : "from-slate-800/40";

              return (
                <article
                  key={tweet.id}
                  className="overflow-hidden rounded-xl border border-slate-800 bg-[#0d1628] shadow-xl transition-all hover:border-slate-700"
                >
                  <div className={`h-0.5 w-full bg-gradient-to-r ${gradientFrom} to-transparent`} />

                  {/* meta */}
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 bg-slate-950/60 px-3 py-2.5 sm:px-5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex-shrink-0 text-xs font-semibold text-cyan-400">@{tweet.authorUsername}</span>
                      <span className="truncate font-mono text-[11px] text-slate-600">{formatCST(tweet.tweetCreatedAt)}</span>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {analysis && (
                        <span className={`font-mono text-xs px-2 py-0.5 rounded font-bold ${
                          analysis.confidence >= 80
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : analysis.confidence >= 50
                              ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"
                              : "bg-slate-700/50 text-slate-500 border border-slate-700"
                        }`}>
                          {analysis.confidence}%
                        </span>
                      )}
                      <span className={`text-[11px] px-2 py-0.5 rounded font-medium border ${
                        tweet.pushed
                          ? "bg-teal-500/10 text-teal-400 border-teal-500/30"
                          : "bg-slate-800/50 text-slate-600 border-slate-700"
                      }`}>
                        {tweet.pushed ? "✓ 已推送" : "未推"}
                      </span>
                    </div>
                  </div>

                  {/* 内容 */}
                  <div className="space-y-3 px-3 py-3 sm:space-y-4 sm:px-5 sm:py-4">
                    <div>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">原文</p>
                      <p className="text-sm italic leading-relaxed text-slate-400">
                        &ldquo;{stripTcoLinks(tweet.content)}&rdquo;
                      </p>
                      {tweet.imageUrls.length > 0 && (
                        <div className="mt-2 flex flex-col gap-2">
                          {tweet.imageUrls.map((url, i) => (
                            <img key={i} src={url} alt="" className="w-full rounded-lg object-cover opacity-90" />
                          ))}
                        </div>
                      )}
                    </div>

                    {analysis ? (
                      <>
                        {analysis.translated_content_cn && (
                          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2.5 sm:px-4">
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-blue-500/70">中文翻译</p>
                            <p className="text-sm leading-relaxed text-blue-300/80">{analysis.translated_content_cn}</p>
                          </div>
                        )}

                        <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-2.5 sm:px-4">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">AI 核心解读</p>
                          <p className="text-sm leading-relaxed text-slate-300">{analysis.summary_cn}</p>
                        </div>

                        {analysis.bullish_stocks.length > 0 && (
                          <div>
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-emerald-500">▲ 利好信号</p>
                            <div className="space-y-2">
                              {analysis.bullish_stocks.map((s) => (
                                <div key={s.ticker} className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 hover:border-emerald-500/40 transition-colors">
                                  <div className="flex flex-wrap items-baseline gap-x-2">
                                    <Link href={`/dashboard/${channelSlug}/stock/${s.ticker}`} className="font-mono text-sm font-bold text-emerald-400 hover:text-emerald-300 hover:underline">
                                      ${s.ticker}
                                    </Link>
                                    {s.company && <span className="text-[11px] text-emerald-600">{s.company}</span>}
                                  </div>
                                  <p className="mt-1 text-xs leading-relaxed text-emerald-300/70">{s.reason}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {analysis.bearish_stocks.length > 0 && (
                          <div>
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-red-500">▼ 利空信号</p>
                            <div className="space-y-2">
                              {analysis.bearish_stocks.map((s) => (
                                <div key={s.ticker} className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 hover:border-red-500/40 transition-colors">
                                  <div className="flex flex-wrap items-baseline gap-x-2">
                                    <Link href={`/dashboard/${channelSlug}/stock/${s.ticker}`} className="font-mono text-sm font-bold text-red-400 hover:text-red-300 hover:underline">
                                      ${s.ticker}
                                    </Link>
                                    {s.company && <span className="text-[11px] text-red-600">{s.company}</span>}
                                  </div>
                                  <p className="mt-1 text-xs leading-relaxed text-red-300/70">{s.reason}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {analysis.sector_tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {analysis.sector_tags.map((tag) => (
                              <span key={tag} className="rounded border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-400">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-xs italic text-slate-600">等待 AI 分析...</p>
                    )}

                    {tweet.sourceUrl && (
                      <div className="pt-1">
                        <a href={tweet.sourceUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs font-medium text-teal-500 hover:text-teal-400 hover:underline transition-colors">
                          查看原文 →
                        </a>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {/* ── 侧边栏 ── */}
          <div className="order-1 w-full space-y-4 lg:order-2 lg:w-72 lg:flex-shrink-0">
            <div className="rounded-xl border border-slate-800 bg-[#0d1628] p-4 shadow-xl">
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    📊 近30天提及股票
                  </span>
                  <span className="rounded border border-teal-500/30 bg-teal-500/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-teal-400">
                    {topMentions.length}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-slate-600">点击股票代码查看详情 →</p>
              </div>

              {topMentions.length === 0 ? (
                <p className="text-xs italic text-slate-600">暂无数据</p>
              ) : (
                <>
                  <div className="max-h-64 space-y-1 overflow-y-auto pr-1 lg:max-h-[70vh]">
                    {topMentions.map((m, i) => (
                      <div key={m.ticker} className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-slate-800/60">
                        <span className={`w-5 flex-shrink-0 text-center font-mono text-xs font-bold ${
                          i === 0 ? "text-yellow-400" :
                          i === 1 ? "text-slate-400" :
                          i === 2 ? "text-amber-600" :
                          "text-slate-700"
                        }`}>{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/dashboard/${channelSlug}/stock/${m.ticker}`}
                            className="font-mono text-sm font-bold text-slate-300 transition-colors hover:text-teal-400"
                          >
                            {m.ticker}
                          </Link>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-1">
                          {m.bullishCount > 0 && (
                            <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-400">
                              ▲{m.bullishCount}
                            </span>
                          )}
                          {m.bearishCount > 0 && (
                            <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-red-400">
                              ▼{m.bearishCount}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-3 border-t border-slate-800 pt-2.5">
                    <span className="font-mono text-[11px] text-emerald-600">▲ 看好</span>
                    <span className="font-mono text-[11px] text-red-600">▼ 看空</span>
                    <span className="ml-auto text-[10px] text-slate-700">次数 = AI分析次数</span>
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
