import { formatDistanceToNow, format } from "date-fns";
import { zhCN } from "date-fns/locale";
import Link from "next/link";
import { SignalBadge } from "@/components/SignalBadge";
import { StatCard } from "@/components/StatCard";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { AiAnalysis } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─── Types ────────────────────────────────────────────────────────────────────

type TweetWithMentions = Prisma.TweetGetPayload<{
  include: {
    stockMentions: {
      include: { stock: { select: { ticker: true; companyName: true; price: true } } };
    };
  };
}>;

type PushLogWithTweet = Prisma.PushLogGetPayload<{
  include: { tweet: { select: { content: true } } };
}>;

type TopStock = { ticker: string; companyName: string | null; stance: string; count: number };
type NarrativeTag = { tag: string; count: number };
type DashboardData = {
  tweets: TweetWithMentions[];
  pushLogs: PushLogWithTweet[];
  cronRuns: Awaited<ReturnType<typeof prisma.cronRun.findMany>>;
  totals: { tweets: number; pushed: number };
  topStocks: TopStock[];
  narrativeTags: NarrativeTag[];
  error: unknown;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const data = await getDashboardData();
  const { tweets, pushLogs, cronRuns, totals, topStocks, narrativeTags, error } = data;

  const recentBullish = tweets.reduce((sum, t) => {
    const a = t.aiAnalysis as AiAnalysis | null;
    return sum + (a?.bullish_stocks.length ?? 0);
  }, 0);
  const recentBearish = tweets.reduce((sum, t) => {
    const a = t.aiAnalysis as AiAnalysis | null;
    return sum + (a?.bearish_stocks.length ?? 0);
  }, 0);

  const lastCron = cronRuns[0];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white text-sm font-bold">S</div>
            <div>
              <h1 className="text-base font-semibold text-slate-900">Serenity Intelligence</h1>
              <p className="text-xs text-slate-500 hidden sm:block">AI Infra Narrative Terminal</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Pipeline status */}
            <div className={`hidden sm:flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
              lastCron?.status === "SUCCESS"
                ? "bg-green-50 text-green-700"
                : lastCron?.status === "RUNNING"
                ? "bg-blue-50 text-blue-700"
                : "bg-slate-100 text-slate-500"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                lastCron?.status === "SUCCESS" ? "bg-green-500" :
                lastCron?.status === "RUNNING" ? "bg-blue-500 animate-pulse" :
                "bg-slate-400"
              }`} />
              {lastCron
                ? `上次运行 ${formatDistanceToNow(lastCron.startedAt, { locale: zhCN, addSuffix: true })}`
                : "尚未运行"}
            </div>

            <a
              href="/api/cron"
              className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition-colors"
            >
              手动运行
            </a>

            <Link href="/pricing" className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              订阅
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* ── DB Warning ───────────────────────────────────────────────────── */}
        {error ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            <strong>数据库未连接：</strong>请配置 <code className="font-mono text-xs">DATABASE_URL</code> 并运行{" "}
            <code className="font-mono text-xs">npx prisma migrate deploy</code>。
          </div>
        ) : null}

        {/* ── Stats ────────────────────────────────────────────────────────── */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard label="已抓取推文" value={totals.tweets} hint="历史总数" />
          <StatCard label="已成功推送" value={totals.pushed} hint="多渠道推送" />
          <StatCard label="利好信号" value={recentBullish} hint="近 30 条" tone="bullish" />
          <StatCard label="利空信号" value={recentBearish} hint="近 30 条" tone="bearish" />
        </div>

        {/* ── Narrative Tags ─────────────────────────────────────────────── */}
        {narrativeTags.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-700 uppercase tracking-wide">
              🔥 热门 Narrative
            </h2>
            <div className="flex flex-wrap gap-2">
              {narrativeTags.map(({ tag, count }) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-sm text-teal-800"
                >
                  #{tag}
                  <span className="rounded-full bg-teal-200 px-1.5 py-0.5 text-xs font-semibold">
                    {count}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Main Grid ────────────────────────────────────────────────────── */}
        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          {/* ── Tweet Feed ─────────────────────────────────────────────────── */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold text-slate-900">推文 &amp; AI 分析</h2>
              <span className="text-xs text-slate-500">最近 {tweets.length} 条</span>
            </div>

            <div className="divide-y divide-slate-100">
              {tweets.map((tweet) => {
                const analysis = tweet.aiAnalysis as AiAnalysis | null;
                return (
                  <article key={tweet.id} className="p-5 hover:bg-slate-50/50 transition-colors">
                    {/* Meta */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-teal-700 bg-teal-50 rounded px-2 py-0.5">
                          @{tweet.authorUsername}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatDistanceToNow(tweet.tweetCreatedAt, { locale: zhCN, addSuffix: true })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {tweet.pushed ? (
                          <span className="text-xs text-emerald-600 font-medium">✓ 已推送</span>
                        ) : (
                          <span className="text-xs text-slate-400">未推送</span>
                        )}
                        {analysis && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            analysis.confidence >= 80
                              ? "bg-green-100 text-green-700"
                              : analysis.confidence >= 50
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-500"
                          }`}>
                            {analysis.confidence}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Original */}
                    <p className="text-sm leading-relaxed text-slate-700 mb-3">
                      {tweet.content}
                    </p>

                    {/* AI Analysis */}
                    {analysis ? (
                      <div className="rounded-lg bg-slate-50 border border-slate-100 p-4 space-y-3">
                        {analysis.translated_content_cn && (
                          <p className="text-sm leading-relaxed text-slate-600 italic">
                            {analysis.translated_content_cn}
                          </p>
                        )}
                        <p className="text-sm leading-relaxed text-slate-800">
                          {analysis.summary_cn}
                        </p>

                        {/* Stock signals */}
                        {tweet.stockMentions.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {tweet.stockMentions.map((mention) => (
                              <div
                                key={mention.id}
                                className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                              >
                                <SignalBadge stance={mention.stance} />
                                <span className="font-mono font-semibold text-slate-800">
                                  {mention.stock.ticker}
                                </span>
                                {mention.stock.price != null && (
                                  <span className="text-slate-500">
                                    ${mention.stock.price.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Sector tags */}
                        {analysis.sector_tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {analysis.sector_tags.map((tag) => (
                              <span key={tag} className="text-xs text-teal-600 bg-teal-50 rounded px-2 py-0.5">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">等待 AI 分析...</p>
                    )}

                    {/* Source link */}
                    {tweet.sourceUrl && (
                      <a
                        href={tweet.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-xs text-teal-600 hover:underline"
                      >
                        查看原文 →
                      </a>
                    )}
                  </article>
                );
              })}

              {tweets.length === 0 && (
                <EmptyState text="暂无推文。配置 TWITTER_BEARER_TOKEN 后运行 Pipeline。" />
              )}
            </div>
          </div>

          {/* ── Right Column ──────────────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Stock Leaderboard */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-semibold text-slate-900">📈 最热提及股票</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {topStocks.map((entry, i) => (
                  <div key={`${entry.ticker}-${entry.stance}`} className="flex items-center gap-3 px-5 py-3">
                    <span className="text-xs font-mono text-slate-400 w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono font-semibold text-sm text-slate-900">{entry.ticker}</p>
                      <p className="text-xs text-slate-500 truncate">{entry.companyName ?? ""}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <SignalBadge stance={entry.stance} />
                      <span className="text-sm font-semibold text-slate-700">{entry.count}</span>
                    </div>
                  </div>
                ))}
                {topStocks.length === 0 && <EmptyState text="暂无信号" />}
              </div>
            </div>

            {/* Push Logs */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-semibold text-slate-900">🚀 推送记录</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {pushLogs.map((log) => (
                  <div key={log.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                          log.status === "SENT"
                            ? "bg-green-100 text-green-700"
                            : log.status === "FAILED"
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-500"
                        }`}>
                          {log.status}
                        </span>
                        <span className="text-xs text-slate-500">{log.channel}</span>
                      </div>
                      <span className="text-xs text-slate-400 flex-shrink-0">
                        {formatDistanceToNow(log.createdAt, { locale: zhCN, addSuffix: true })}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                      {log.tweet.content}
                    </p>
                  </div>
                ))}
                {pushLogs.length === 0 && <EmptyState text="暂无推送记录" />}
              </div>
            </div>

            {/* Cron History */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-semibold text-slate-900">⏱ 调度历史</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {cronRuns.map((run) => (
                  <div key={run.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        run.status === "SUCCESS"
                          ? "bg-green-100 text-green-700"
                          : run.status === "RUNNING"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {run.status}
                      </span>
                      <span className="text-xs text-slate-400">
                        {format(run.startedAt, "MM-dd HH:mm", { locale: zhCN })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      拉取 {run.fetched} · 分析 {run.analyzed} · 推送 {run.pushed} · 跳过 {run.skipped}
                    </p>
                    {run.error && (
                      <p className="mt-1 text-xs text-red-500 line-clamp-1">{run.error}</p>
                    )}
                  </div>
                ))}
                {cronRuns.length === 0 && <EmptyState text="尚未运行" />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function getDashboardData(): Promise<DashboardData> {
  if (!process.env.DATABASE_URL) {
    return emptyDashboardData("DATABASE_URL is not configured");
  }

  try {
    const [tweets, pushLogs, mentionGroups, cronRuns, tweetCount, pushedCount] = await Promise.all([
      prisma.tweet.findMany({
        orderBy: { tweetCreatedAt: "desc" },
        take: 30,
        include: {
          stockMentions: {
            include: { stock: { select: { ticker: true, companyName: true, price: true } } }
          }
        }
      }),
      prisma.pushLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 15,
        include: { tweet: { select: { content: true } } }
      }),
      prisma.stockMention.groupBy({
        by: ["stockId", "stance"],
        _count: { stockId: true },
        orderBy: { _count: { stockId: "desc" } },
        take: 20
      }),
      prisma.cronRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 }),
      prisma.tweet.count(),
      prisma.tweet.count({ where: { pushed: true } })
    ]);

    const stockIds = [...new Set(mentionGroups.map((m) => m.stockId))];
    const stocks = await prisma.stock.findMany({
      where: { id: { in: stockIds } },
      select: { id: true, ticker: true, companyName: true }
    });
    const stockById = new Map(stocks.map((s) => [s.id, s]));

    const topStocks: TopStock[] = mentionGroups.map((m) => {
      const stock = stockById.get(m.stockId);
      return {
        ticker: stock?.ticker ?? "UNKNOWN",
        companyName: stock?.companyName ?? null,
        stance: m.stance,
        count: m._count.stockId
      };
    });

    // Build narrative tag frequency map from recent tweets
    const tagCounts: Record<string, number> = {};
    for (const tweet of tweets) {
      const analysis = tweet.aiAnalysis as AiAnalysis | null;
      if (!analysis) continue;
      for (const tag of analysis.sector_tags ?? []) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
      }
    }
    const narrativeTags: NarrativeTag[] = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag, count]) => ({ tag, count }));

    return {
      tweets,
      pushLogs,
      cronRuns,
      totals: { tweets: tweetCount, pushed: pushedCount },
      topStocks,
      narrativeTags,
      error: null
    };
  } catch (error) {
    return emptyDashboardData(error);
  }
}

function emptyDashboardData(error: unknown): DashboardData {
  return {
    tweets: [],
    pushLogs: [],
    cronRuns: [],
    totals: { tweets: 0, pushed: 0 },
    topStocks: [],
    narrativeTags: [],
    error
  };
}

// ─── Shared component ─────────────────────────────────────────────────────────

function EmptyState({ text }: { text: string }) {
  return <p className="px-5 py-6 text-xs text-slate-400">{text}</p>;
}
