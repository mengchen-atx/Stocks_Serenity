import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionUid } from "@/lib/wxpusher-auth";
import { prisma } from "@/lib/prisma";
import type { AiAnalysis } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatCST(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}/${get("month")}/${get("day")} ${get("hour")}:${get("minute")} CST`;
}

function stripTcoLinks(text: string): string {
  return text.replace(/https?:\/\/t\.co\/\S+/g, "").replace(/\s{2,}/g, " ").trim();
}

export default async function StockDetailPage({
  params
}: {
  params: Promise<{ ticker: string }>;
}) {
  const uid = await getSessionUid();
  if (!uid) redirect("/auth/wxpusher");

  const { ticker } = await params;
  const upperTicker = ticker.toUpperCase();

  const stock = await prisma.stock.findUnique({
    where: { ticker: upperTicker }
  });
  if (!stock) notFound();

  // 所有提及该股票的 mentions，关联推文，按推文时间倒序
  const mentions = await prisma.stockMention.findMany({
    where: { stock: { ticker: upperTicker } },
    include: {
      tweet: {
        select: {
          id: true,
          content: true,
          tweetCreatedAt: true,
          sourceUrl: true,
          aiAnalysis: true,
          imageUrls: true,
          authorUsername: true
        }
      }
    },
    orderBy: { tweet: { tweetCreatedAt: "desc" } }
  });

  const bullishCount = mentions.filter((m) => m.stance === "bullish").length;
  const bearishCount = mentions.filter((m) => m.stance === "bearish").length;

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            ← 返回
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold text-slate-900">${upperTicker}</span>
            {stock.companyName && (
              <span className="text-sm text-slate-500">{stock.companyName}</span>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4">

        {/* ── 统计 + 外部链接 ── */}
        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            {bullishCount > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-sm font-semibold text-green-700">
                📈 看好 {bullishCount} 次
              </span>
            )}
            {bearishCount > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-sm font-semibold text-red-700">
                📉 看空 {bearishCount} 次
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <a
                href={`https://finance.yahoo.com/quote/${upperTicker}/news/`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                📰 Yahoo 新闻
              </a>
              <a
                href={`https://finance.yahoo.com/quote/${upperTicker}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100"
              >
                📊 行情
              </a>
            </div>
          </div>
        </div>

        {/* ── 推文列表 ── */}
        <div className="space-y-4">
          {mentions.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-400">
              暂无相关推文
            </div>
          )}

          {mentions.map((mention) => {
            const tweet = mention.tweet;
            const analysis = tweet.aiAnalysis as AiAnalysis | null;
            const isBullish = mention.stance === "bullish";

            return (
              <article key={mention.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

                {/* 顶部栏 */}
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 bg-slate-900 px-3 py-2.5 text-white sm:px-5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-teal-300">@{tweet.authorUsername}</span>
                    <span className="text-xs text-slate-400">{formatCST(tweet.tweetCreatedAt)}</span>
                  </div>
                  <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    isBullish ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"
                  }`}>
                    {isBullish ? "📈 看好" : "📉 看空"}
                  </span>
                </div>

                <div className="space-y-3 px-3 py-3 sm:px-5 sm:py-4">

                  {/* 原文 */}
                  <p className="text-sm italic leading-relaxed text-slate-600">
                    &ldquo;{stripTcoLinks(tweet.content)}&rdquo;
                  </p>

                  {/* 图片 */}
                  {tweet.imageUrls.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {tweet.imageUrls.map((url, i) => (
                        <img key={i} src={url} alt="" className="w-full rounded-lg object-cover" />
                      ))}
                    </div>
                  )}

                  {/* 这条推文提及该股票的原因 */}
                  <div className={`rounded-lg border-l-4 px-3 py-2 ${
                    isBullish ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"
                  }`}>
                    <p className="mb-0.5 text-xs font-semibold text-slate-500">AI 分析理由</p>
                    <p className={`text-xs leading-relaxed ${isBullish ? "text-green-800" : "text-red-800"}`}>
                      {mention.reason}
                    </p>
                  </div>

                  {/* AI 整体解读 */}
                  {analysis?.summary_cn && (
                    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                      <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">AI 核心解读</p>
                      <p className="text-sm leading-relaxed text-slate-700">{analysis.summary_cn}</p>
                    </div>
                  )}

                  {/* 查看原文 */}
                  {tweet.sourceUrl && (
                    <a
                      href={tweet.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-teal-600 hover:underline"
                    >
                      查看原文 →
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
