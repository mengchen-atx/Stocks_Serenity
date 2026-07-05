import { redirect, notFound } from "next/navigation";
import { after } from "next/server";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { getSessionUid } from "@/lib/wxpusher-auth";
import { prisma } from "@/lib/prisma";
import { getAllMentionedStocks, isLikelyAShare } from "@/lib/insights";
import { getAllChannels, checkChannelAccess } from "@/lib/channels";
import { isAdminUid } from "@/lib/admin";
import { fetchTopicSubscribersWithExpiry } from "@/lib/wxpusher";
import { SubscriptionInfoButton } from "./subscription-info-button";
import type { ChannelAccessInfo } from "./subscription-info-button";
import type { AiAnalysis } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FEED_LIMIT = 20;

// 推文列表按频道+页码缓存 60 秒，所有用户共享同一份数据
const getChannelFeedCached = unstable_cache(
  async (channelId: string, page: number) => {
    const skip = (page - 1) * FEED_LIMIT;
    const [tweets, totalCount, topMentions] = await Promise.all([
      prisma.tweet.findMany({
        where: { channelId },
        orderBy: { tweetCreatedAt: "desc" },
        take: FEED_LIMIT,
        skip,
        include: {
          stockMentions: {
            include: { stock: { select: { ticker: true, companyName: true } } },
          },
        },
      }).catch(() => []),
      prisma.tweet.count({ where: { channelId } }).catch(() => 0),
      getAllMentionedStocks(30, 9999, channelId).catch(() => []),
    ]);
    return { tweets, totalCount, topMentions };
  },
  ["channel-feed"],
  { revalidate: 60 }
);

function stripTcoLinks(text: string): string {
  // 注意：不能用 \s{2,} 整体压缩空白——会把作者的换行排版（一行一个股票）
  // 也压成一行。只压缩行内多余空格，保留换行结构。
  return text
    .replace(/https?:\/\/t\.co\/\S+/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatCST(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}/${get("month")}/${get("day")} ${get("hour")}:${get("minute")} CST`;
}

export default async function ChannelDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ channelSlug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const uid = await getSessionUid();
  if (!uid) redirect("/auth/wxpusher");

  const { channelSlug } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1") || 1);

  // 频率限制：每小时最多 200 次，超出直接拒绝（防爬虫）
  const RATE_LIMIT = 200;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await prisma.accessLog.count({
    where: { uid, createdAt: { gte: oneHourAgo } },
  }).catch(() => 0);
  if (recentCount >= RATE_LIMIT) {
    return (
      <div style={{ minHeight: "100vh", background: "#070d1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#94a3b8", padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚦</div>
          <h2 style={{ color: "#f1f5f9", fontSize: 20, marginBottom: 8 }}>访问过于频繁</h2>
          <p style={{ fontSize: 14, marginBottom: 4 }}>您的访问频率超出限制，请稍后再试。</p>
          <p style={{ fontSize: 12, color: "#475569" }}>每小时最多访问 {RATE_LIMIT} 次</p>
        </div>
      </div>
    );
  }

  // 响应发出后异步记录访问日志（不阻塞渲染）
  after(async () => {
    try {
      await prisma.accessLog.create({ data: { uid, path: `/dashboard/${channelSlug}` } });
    } catch { /* 日志写入失败不影响用户 */ }
  });

  // 所有频道（Tab 栏全部显示），以及当前用户的访问权限
  const [allChannels, channel] = await Promise.all([
    getAllChannels(),
    checkChannelAccess(uid, channelSlug),
  ]);

  // slug 不存在 → 404
  const channelExists = allChannels.some((c) => c.slug === channelSlug);
  if (!channelExists) notFound();

  // 当前频道基础信息（即使无权限也需要展示名称）
  const channelBasic = allChannels.find((c) => c.slug === channelSlug)!;

  // 为 Tab 栏获取用户所有有权限的 slug
  const now = new Date();
  const myAccesses = await prisma.userChannelAccess.findMany({
    where: {
      uid,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { channel: { select: { slug: true } } },
  });
  const mySlugs = new Set(myAccesses.map((a) => a.channel.slug));

  // 无权限 → 显示锁定页（共享 header + tab 栏）
  if (!channel) {
    return (
      <div className="min-h-screen bg-[#070d1a] text-slate-200">
        <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#070d1a]/95 backdrop-blur-md">
          <div className="mx-auto max-w-6xl px-4">
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                {channelBasic.avatarUrl ? (
                  <img src={channelBasic.avatarUrl} alt={channelBasic.name} className="h-8 w-8 flex-shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-700 text-white text-sm font-bold">
                    🔒
                  </div>
                )}
                <div>
                  <h1 className="text-sm font-semibold text-slate-400 tracking-tight">{channelBasic.name}</h1>
                  <p className="font-mono text-xs text-slate-600">无访问权限</p>
                </div>
              </div>
              <form action="/api/auth/wxpusher/logout" method="POST">
                <button type="submit" className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-slate-600 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer">
                  退出
                </button>
              </form>
            </div>
            {/* Tab 栏：全部频道，锁定的灰显 */}
            {allChannels.length > 1 && (
              <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-none -mx-4 px-4">
                {allChannels.map((ch) => {
                  const hasAccess = mySlugs.has(ch.slug);
                  const isActive = ch.slug === channelSlug;
                  return hasAccess ? (
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
                    </Link>
                  ) : (
                    <Link
                      key={ch.slug}
                      href={`/dashboard/${ch.slug}`}
                      className={`relative flex-shrink-0 px-3 py-2 text-xs font-semibold transition-colors rounded-t-md whitespace-nowrap flex items-center gap-1 ${
                        isActive
                          ? "text-slate-400 bg-slate-900 border border-b-0 border-slate-700"
                          : "text-slate-600 hover:text-slate-500"
                      }`}
                    >
                      🔒 {ch.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </header>
        <div className="mx-auto max-w-6xl px-4 py-24 text-center">
          <div className="inline-flex flex-col items-center gap-5 rounded-2xl border border-slate-700/60 bg-[#0d1628] px-10 py-12 shadow-2xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 text-3xl">
              🔒
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-200">暂未订阅此博主</h2>
              <p className="text-sm text-slate-500">
                您的 UID 尚未开通&nbsp;
                <span className="font-semibold text-slate-300">「{channelBasic.name}」</span>
                &nbsp;的访问权限
              </p>
            </div>
            <div className="rounded-xl border border-amber-700/40 bg-amber-900/10 px-6 py-4 text-sm text-amber-300/80">
              如需订阅，请联系管理员&nbsp;
              <span className="font-bold text-amber-300 select-all">Wx：PM112629</span>
            </div>
            {/* 跳转到用户已有权限的第一个频道 */}
            {myAccesses.length > 0 && (
              <Link
                href={`/dashboard/${myAccesses[0].channel.slug}`}
                className="mt-1 text-xs text-teal-500 hover:text-teal-400 hover:underline transition-colors"
              >
                ← 返回我的频道
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 用户各频道访问权限详情（用于「我的订阅」弹窗）
  const accessRecords = await prisma.userChannelAccess.findMany({
    where: { uid },
    include: { channel: true },
  });
  const accessInfoList: ChannelAccessInfo[] = await Promise.all(
    accessRecords
      .filter((a) => a.expiresAt === null || a.expiresAt > now)
      .map(async (a) => {
        // 检查是否是付费主题订阅者
        let isTopicSubscriber = false;
        let topicPushExpiresAt: string | null = null;
        if (a.channel.wxpusherTopicId) {
          const subs = await fetchTopicSubscribersWithExpiry(a.channel.wxpusherTopicId).catch(() => []);
          const sub = subs.find((s) => s.uid === uid);
          if (sub) {
            isTopicSubscriber = true;
            topicPushExpiresAt = sub.payEndTime ? new Date(sub.payEndTime).toISOString() : null;
          }
        }
        // DB 里的 pushExpiresAt 优先于 WxPusher 的 payEndTime（管理员主动设置的限期）
        const dbPushExpiresAt = a.pushExpiresAt?.toISOString() ?? null;
        const effectivePushExpiresAt = dbPushExpiresAt !== null
          ? dbPushExpiresAt          // 管理员设了限期，以此为准
          : topicPushExpiresAt;      // 否则用 WxPusher 的（null = 永久）

        return {
          slug: a.channel.slug,
          name: a.channel.name,
          expiresAt: a.expiresAt?.toISOString() ?? null,
          pushEnabled: a.pushEnabled,
          pushExpiresAt: effectivePushExpiresAt,
          isTopicSubscriber,
        };
      })
  );

  const { tweets, totalCount, topMentions } = await getChannelFeedCached(channel.id, currentPage);
  const total = totalCount;
  const totalPages = Math.ceil(total / FEED_LIMIT);
  const aShareMentions = topMentions.filter((m) => isLikelyAShare(m.ticker, m.exchange));

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
              <div className="hidden sm:block">
                <SubscriptionInfoButton accesses={accessInfoList} />
              </div>
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

          {/* 手机端导航条（sm 以下显示） */}
          <div className="sm:hidden flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
            <span className="flex flex-shrink-0 items-center gap-1.5 text-xs text-slate-500">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
              </span>
              LIVE
            </span>
            <Link
              href="/dashboard/alpha-map"
              className="flex-shrink-0 flex items-center gap-1 rounded-md border border-amber-700/40 px-2.5 py-1 text-xs font-medium text-amber-500/80 hover:border-amber-600 hover:text-amber-400 transition-colors"
            >
              ⬡ Alpha Map
            </Link>
            <Link
              href="/dashboard/supply-chain"
              className="flex-shrink-0 flex items-center gap-1 rounded-md border border-violet-700/40 px-2.5 py-1 text-xs font-medium text-violet-500/80 hover:border-violet-600 hover:text-violet-400 transition-colors"
            >
              ⬡ Supply Chain
            </Link>
            <div className="flex-shrink-0">
              <SubscriptionInfoButton accesses={accessInfoList} mobile />
            </div>
            {isAdminUid(uid) && (
              <Link
                href="/ops"
                className="flex-shrink-0 flex items-center gap-1 rounded-md border border-slate-600 px-2.5 py-1 text-xs font-medium text-slate-400 hover:border-slate-400 hover:text-slate-200 transition-colors"
              >
                ⚙️ 后台
              </Link>
            )}
          </div>

          {/* 频道 Tab 栏（有多个频道才显示，包含所有频道，无权限的灰显+锁） */}
          {allChannels.length > 1 && (
            <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-none -mx-4 px-4">
              {allChannels.map((ch) => {
                const hasAccess = mySlugs.has(ch.slug);
                const isActive = ch.slug === channelSlug;
                return (
                  <Link
                    key={ch.slug}
                    href={`/dashboard/${ch.slug}`}
                    className={`relative flex-shrink-0 px-3 py-2 text-xs font-semibold transition-colors rounded-t-md whitespace-nowrap flex items-center gap-1 ${
                      isActive && hasAccess
                        ? "text-teal-400 bg-slate-900 border border-b-0 border-slate-700"
                        : hasAccess
                          ? "text-slate-500 hover:text-slate-300"
                          : isActive
                            ? "text-slate-500 bg-slate-900 border border-b-0 border-slate-700"
                            : "text-slate-600 hover:text-slate-500"
                    }`}
                  >
                    {!hasAccess && <span className="text-[10px]">🔒</span>}
                    {ch.name}
                    {isActive && hasAccess && (
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
                      <p className="text-sm italic leading-relaxed text-slate-400 whitespace-pre-wrap">
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
                            <p className="text-sm leading-relaxed text-blue-300/80 whitespace-pre-wrap">{analysis.translated_content_cn}</p>
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

          {/* ── 翻页 ── */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              {currentPage > 1 ? (
                <Link
                  href={`/dashboard/${channelSlug}?page=${currentPage - 1}`}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-teal-500/50 hover:text-teal-400"
                >
                  ← 上一页
                </Link>
              ) : (
                <span className="flex items-center gap-1.5 rounded-lg border border-slate-800 px-4 py-2 text-sm text-slate-700 cursor-not-allowed">
                  ← 上一页
                </span>
              )}

              <span className="font-mono text-xs text-slate-500">
                {currentPage} / {totalPages}
              </span>

              {currentPage < totalPages ? (
                <Link
                  href={`/dashboard/${channelSlug}?page=${currentPage + 1}`}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-teal-500/50 hover:text-teal-400"
                >
                  下一页 →
                </Link>
              ) : (
                <span className="flex items-center gap-1.5 rounded-lg border border-slate-800 px-4 py-2 text-sm text-slate-700 cursor-not-allowed">
                  下一页 →
                </span>
              )}
            </div>
          )}

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
                <p className="mt-1.5 text-xs font-medium text-teal-400/80">👉 点击任意股票查看详情</p>
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

            {aShareMentions.length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-[#0d1628] p-4 shadow-xl">
                <div className="mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                      🇨🇳 近30天提及 A股
                    </span>
                    <span className="rounded border border-teal-500/30 bg-teal-500/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-teal-400">
                      {aShareMentions.length}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs font-medium text-teal-400/80">👉 点击任意股票查看详情</p>
                </div>

                <div className="space-y-1">
                  {aShareMentions.map((m) => (
                    <div key={m.ticker} className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-slate-800/60">
                      <Link
                        href={`/dashboard/${channelSlug}/stock/${m.ticker}`}
                        className="group min-w-0 flex-1"
                      >
                        {m.companyName && (
                          <span className="mr-1.5 text-sm text-slate-300 transition-colors group-hover:text-teal-400">{m.companyName}</span>
                        )}
                        <span className="font-mono text-sm font-bold text-slate-400 transition-colors group-hover:text-teal-400">
                          {m.ticker}
                        </span>
                      </Link>
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
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
