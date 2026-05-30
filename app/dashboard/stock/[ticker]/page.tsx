import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionUid } from "@/lib/wxpusher-auth";
import { prisma } from "@/lib/prisma";
import { generateStockProfile, SUPPLY_CHAIN, type StockAiProfile } from "@/lib/stock-profile";
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

  const stock = await prisma.stock.findUnique({ where: { ticker: upperTicker } });
  if (!stock) notFound();

  // 所有提及该股票的 mentions，按推文时间倒序
  const mentions = await prisma.stockMention.findMany({
    where: { stock: { ticker: upperTicker } },
    include: {
      tweet: {
        select: {
          id: true, content: true, tweetCreatedAt: true,
          sourceUrl: true, aiAnalysis: true, imageUrls: true, authorUsername: true
        }
      }
    },
    orderBy: { tweet: { tweetCreatedAt: "desc" } }
  });

  const bullishCount = mentions.filter((m) => m.stance === "bullish").length;
  const bearishCount = mentions.filter((m) => m.stance === "bearish").length;

  // ── AI 公司简介（有缓存用缓存，没有则生成并存库）─────────────────────────
  let profile: StockAiProfile;
  if (stock.aiProfile) {
    profile = stock.aiProfile as StockAiProfile;
  } else {
    const reasons = mentions.map((m) => m.reason).filter(Boolean) as string[];
    try {
      profile = await generateStockProfile(upperTicker, stock.companyName, reasons);
      await prisma.stock.update({
        where: { ticker: upperTicker },
        data: { aiProfile: profile }
      });
    } catch {
      profile = { description: "", role: "", segments: [] };
    }
  }

  const activeSegmentIds = new Set(profile.segments);

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
          <div className="flex min-w-0 items-center gap-2">
            <span className="font-mono text-lg font-bold text-slate-900">${upperTicker}</span>
            {stock.companyName && (
              <span className="truncate text-sm text-slate-500">{stock.companyName}</span>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4 space-y-5">

        {/* ── 公司简介 ── */}
        {profile.description && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">公司简介</span>
              {profile.role && (
                <span className="rounded-full bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-xs font-medium text-teal-700">
                  {profile.role}
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-slate-700">{profile.description}</p>
          </div>
        )}

        {/* ── AI 供应链图 ── */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">AI 基础设施供应链</p>

          {/* 手机：2列网格；桌面：5列 */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {SUPPLY_CHAIN.map((seg, i) => {
              const isActive = activeSegmentIds.has(seg.id);
              return (
                <div
                  key={seg.id}
                  className={`relative rounded-lg border px-3 py-2.5 transition-all ${
                    isActive
                      ? "border-teal-400 bg-teal-50 shadow-sm ring-2 ring-teal-300"
                      : "border-slate-100 bg-slate-50"
                  }`}
                >
                  {isActive && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-teal-500 px-1.5 py-0.5 text-[10px] font-bold text-white whitespace-nowrap">
                      ← 在这里
                    </span>
                  )}
                  <div className="text-lg mb-1">{seg.emoji}</div>
                  <div className={`text-xs font-semibold leading-tight ${isActive ? "text-teal-800" : "text-slate-600"}`}>
                    {seg.label}
                  </div>
                  <div className="mt-0.5 text-[10px] leading-tight text-slate-400">{seg.desc}</div>
                  {/* 箭头（最后一个不显示） */}
                  {i < SUPPLY_CHAIN.length - 1 && (
                    <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 text-slate-300 text-xs hidden lg:block">›</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 流程方向说明 */}
          <p className="mt-2 text-center text-[10px] text-slate-300">← 上游原材料 ············ 下游应用 →</p>
        </div>

        {/* ── 多空统计 ── */}
        <div className="flex flex-wrap gap-3">
          {bullishCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-sm font-semibold text-green-700">
              📈 看好 {bullishCount} 次
            </span>
          )}
          {bearishCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-semibold text-red-700">
              📉 看空 {bearishCount} 次
            </span>
          )}
          <span className="text-xs text-slate-400 self-center">共 {mentions.length} 条推文提及</span>
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

                  {/* 提及该股票的理由 */}
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
                    <a href={tweet.sourceUrl} target="_blank" rel="noopener noreferrer"
                      className="block text-xs text-teal-600 hover:underline">
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
