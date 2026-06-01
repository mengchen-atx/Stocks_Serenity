import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionUid } from "@/lib/wxpusher-auth";
import { prisma } from "@/lib/prisma";
import { generateStockProfile, SUPPLY_CHAIN, type StockAiProfile } from "@/lib/stock-profile";
import { fetchEarnings } from "@/lib/earnings";
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

/** "2025-08-15" → "2025年8月15日" */
function fmtDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("zh-CN", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });
}

/** "2025-08-15" → "45 天后" / "3 天前" */
function daysUntil(iso: string): string {
  const target = new Date(iso + "T12:00:00Z");
  const diff = Math.ceil((target.getTime() - Date.now()) / 86_400_000);
  if (diff < 0) return `${Math.abs(diff)} 天前`;
  if (diff === 0) return "今天";
  if (diff === 1) return "明天";
  return `${diff} 天后`;
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

  // AI 公司简介 + 财报数据（并行）
  let profile: StockAiProfile;
  const [earnings] = await Promise.all([
    fetchEarnings(upperTicker),
    (async () => {
      if (stock.aiProfile) {
        profile = stock.aiProfile as StockAiProfile;
        return;
      }
      const reasons = mentions.map((m) => m.reason).filter(Boolean) as string[];
      try {
        profile = await generateStockProfile(upperTicker, stock.companyName, reasons);
        await prisma.stock.update({ where: { ticker: upperTicker }, data: { aiProfile: profile } });
      } catch {
        profile = { description: "", role: "", segments: [] };
      }
    })(),
  ]);
  profile ??= { description: "", role: "", segments: [] };

  const activeSegmentIds = new Set(profile.segments);

  return (
    <div className="min-h-screen bg-[#070d1a] text-slate-200">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#070d1a]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:border-slate-600 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            ← 返回
          </Link>
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="font-mono text-xl font-bold text-white tracking-tight">${upperTicker}</span>
            {stock.companyName && (
              <span className="truncate text-sm text-slate-500">{stock.companyName}</span>
            )}
          </div>
          {/* 多空倾向指示 */}
          {mentions.length > 0 && (
            <div className="ml-auto flex-shrink-0">
              {bullishCount > bearishCount ? (
                <span className="flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-mono text-xs font-bold text-emerald-400">
                  ▲ 偏多
                </span>
              ) : bearishCount > bullishCount ? (
                <span className="flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 font-mono text-xs font-bold text-red-400">
                  ▼ 偏空
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-xs font-bold text-slate-500">
                  — 中性
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4 space-y-4">

        {/* ── 公司简介 ── */}
        {profile.description && (
          <div className="rounded-xl border border-slate-800 bg-[#0d1628] p-4 shadow-xl">
            <div className="mb-2.5 flex items-center gap-2.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">公司简介</span>
              {profile.role && (
                <span className="rounded border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-xs font-semibold text-teal-400">
                  {profile.role}
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-slate-300">{profile.description}</p>
          </div>
        )}

        {/* ── 多空统计 ── */}
        <div className="flex flex-wrap items-center gap-2.5">
          {bullishCount > 0 && (
            <span className="flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-mono text-sm font-bold text-emerald-400">
              ▲ 看好 {bullishCount} 次
            </span>
          )}
          {bearishCount > 0 && (
            <span className="flex items-center gap-1.5 rounded border border-red-500/30 bg-red-500/10 px-3 py-1.5 font-mono text-sm font-bold text-red-400">
              ▼ 看空 {bearishCount} 次
            </span>
          )}
          <span className="font-mono text-xs text-slate-600">共 {mentions.length} 条推文提及</span>
        </div>

        {/* ── AI 供应链图 ── */}
        <div className="rounded-xl border border-slate-800 bg-[#0d1628] p-4 shadow-xl">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            AI 基础设施供应链
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {SUPPLY_CHAIN.map((seg, i) => {
              const isActive = activeSegmentIds.has(seg.id);
              return (
                <div
                  key={seg.id}
                  className={`relative rounded-lg border px-3 py-2.5 transition-all ${
                    isActive
                      ? "border-teal-500/50 bg-teal-500/10 shadow-lg shadow-teal-500/10 ring-1 ring-teal-500/30"
                      : "border-slate-800 bg-slate-900/40"
                  }`}
                >
                  {isActive && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full border border-teal-500/50 bg-teal-500 px-2 py-0.5 text-[10px] font-bold text-white whitespace-nowrap shadow-lg shadow-teal-500/30">
                      ← 在这里
                    </span>
                  )}
                  <div className="mb-1 text-base">{seg.emoji}</div>
                  <div className={`text-xs font-bold leading-tight ${isActive ? "text-teal-300" : "text-slate-500"}`}>
                    {seg.label}
                  </div>
                  <div className="mt-0.5 text-[10px] leading-tight text-slate-600">{seg.desc}</div>
                  {i < SUPPLY_CHAIN.length - 1 && (
                    <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 text-slate-700 text-xs hidden lg:block">›</div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-3 text-center text-[10px] text-slate-700 font-mono">
            ← 上游原材料 ············ 下游应用 →
          </p>
        </div>

        {/* ── 财报 ── */}
        <div className="rounded-xl border border-slate-800 bg-[#0d1628] p-4 shadow-xl">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            📅 财报
          </p>

          {earnings ? (
            <div className="space-y-4">
              {/* 下次财报 */}
              {earnings.nextDate && (
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    下次财报
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-amber-300">
                      {fmtDate(earnings.nextDate)}
                    </span>
                    {earnings.callTime && (
                      <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                        {earnings.callTime === "amc" ? "盘后发布"
                          : earnings.callTime === "bmo" ? "盘前发布"
                          : "盘中发布"}
                      </span>
                    )}
                    <span className="font-mono text-xs text-slate-500">
                      {daysUntil(earnings.nextDate)}
                    </span>
                  </div>
                  {earnings.epsEstimate !== null && (
                    <p className="mt-1 text-xs text-slate-600">
                      市场 EPS 预期：
                      <span className="font-mono text-slate-400">
                        {earnings.epsEstimate >= 0 ? "+" : ""}
                        {earnings.epsEstimate.toFixed(2)}
                      </span>
                    </p>
                  )}
                </div>
              )}

              {/* 上次财报 */}
              {earnings.lastDate && (
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    上次财报
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm text-slate-400">
                      {fmtDate(earnings.lastDate)}
                    </span>
                    {earnings.lastCallTime && (
                      <span className="rounded border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        {earnings.lastCallTime === "amc" ? "盘后发布"
                          : earnings.lastCallTime === "bmo" ? "盘前发布"
                          : "盘中发布"}
                      </span>
                    )}
                    <span className="font-mono text-xs text-slate-600">
                      {daysUntil(earnings.lastDate)}
                    </span>
                  </div>
                </div>
              )}

              {/* 近期季报 EPS */}
              {earnings.history.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    近期季报 EPS
                  </p>
                  <div className="divide-y divide-slate-800/60 rounded-lg border border-slate-800 overflow-hidden">
                    {earnings.history.map((q, i) => {
                      const beat =
                        q.epsActual !== null &&
                        q.epsEstimate !== null &&
                        q.epsActual >= q.epsEstimate;
                      const miss =
                        q.epsActual !== null &&
                        q.epsEstimate !== null &&
                        q.epsActual < q.epsEstimate;
                      const surprisePct =
                        q.surprisePct !== null
                          ? (q.surprisePct * 100).toFixed(1)
                          : null;
                      return (
                        <div
                          key={i}
                          className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 text-xs"
                        >
                          <span className="w-14 font-mono text-[11px] text-slate-500 flex-shrink-0">
                            {q.period}
                          </span>
                          {q.epsActual !== null && (
                            <span
                              className={`font-mono font-bold ${
                                beat
                                  ? "text-emerald-400"
                                  : miss
                                    ? "text-red-400"
                                    : "text-slate-300"
                              }`}
                            >
                              {q.epsActual >= 0 ? "+" : ""}
                              {q.epsActual.toFixed(2)}
                            </span>
                          )}
                          {q.epsEstimate !== null && (
                            <span className="text-slate-600">
                              预期 {q.epsEstimate >= 0 ? "+" : ""}
                              {q.epsEstimate.toFixed(2)}
                            </span>
                          )}
                          {surprisePct !== null && (
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                beat
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : "bg-red-500/10 text-red-400"
                              }`}
                            >
                              {parseFloat(surprisePct) >= 0 ? "+" : ""}
                              {surprisePct}%
                            </span>
                          )}
                          {q.epsActual === null && (
                            <span className="text-slate-700 italic">暂无数据</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs italic text-slate-600">
              财报数据加载中，请直接访问下方链接查看
            </p>
          )}

          {/* 固定外部链接（始终显示） */}
          <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-800 pt-3">
            <a
              href={`https://finance.yahoo.com/quote/${upperTicker}/financials/`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-teal-500 hover:text-teal-400 hover:underline transition-colors"
            >
              Yahoo Finance 财报 →
            </a>
            <a
              href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${upperTicker}&type=10-Q&dateb=&owner=include&count=4`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 hover:underline transition-colors"
            >
              SEC 10-Q 文件 →
            </a>
            <a
              href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${upperTicker}&type=10-K&dateb=&owner=include&count=4`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 hover:underline transition-colors"
            >
              SEC 10-K 文件 →
            </a>
          </div>
        </div>

        {/* ── 推文列表 ── */}
        <div className="space-y-3">
          {mentions.length === 0 && (
            <div className="rounded-xl border border-slate-800 bg-[#0d1628] p-10 text-center text-slate-600">
              暂无相关推文
            </div>
          )}

          {mentions.map((mention) => {
            const tweet = mention.tweet;
            const analysis = tweet.aiAnalysis as AiAnalysis | null;
            const isBullish = mention.stance === "bullish";

            return (
              <article
                key={mention.id}
                className="overflow-hidden rounded-xl border border-slate-800 bg-[#0d1628] shadow-xl transition-all hover:border-slate-700"
              >
                {/* 顶部色条 */}
                <div className={`h-0.5 w-full ${isBullish ? "bg-emerald-500/50" : "bg-red-500/50"}`} />

                {/* meta 栏 */}
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 bg-slate-950/60 px-3 py-2.5 sm:px-5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-cyan-400">@{tweet.authorUsername}</span>
                    <span className="font-mono text-[11px] text-slate-600">{formatCST(tweet.tweetCreatedAt)}</span>
                  </div>
                  <span className={`flex-shrink-0 rounded border px-2.5 py-0.5 font-mono text-xs font-bold ${
                    isBullish
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-red-500/30 bg-red-500/10 text-red-400"
                  }`}>
                    {isBullish ? "▲ 看好" : "▼ 看空"}
                  </span>
                </div>

                <div className="space-y-3 px-3 py-3 sm:px-5 sm:py-4">

                  {/* 原文 */}
                  <p className="text-sm italic leading-relaxed text-slate-400">
                    &ldquo;{stripTcoLinks(tweet.content)}&rdquo;
                  </p>

                  {/* 图片 */}
                  {tweet.imageUrls.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {tweet.imageUrls.map((url, i) => (
                        <img key={i} src={url} alt="" className="w-full rounded-lg object-cover opacity-90" />
                      ))}
                    </div>
                  )}

                  {/* AI 分析理由 */}
                  <div className={`rounded-lg border-l-2 px-3 py-2 ${
                    isBullish
                      ? "border-emerald-500 bg-emerald-500/5"
                      : "border-red-500 bg-red-500/5"
                  }`}>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">AI 分析理由</p>
                    <p className={`text-xs leading-relaxed ${isBullish ? "text-emerald-300/80" : "text-red-300/80"}`}>
                      {mention.reason}
                    </p>
                  </div>

                  {/* AI 核心解读 */}
                  {analysis?.summary_cn && (
                    <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-2.5">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">AI 核心解读</p>
                      <p className="text-sm leading-relaxed text-slate-300">{analysis.summary_cn}</p>
                    </div>
                  )}

                  {/* 查看原文 */}
                  {tweet.sourceUrl && (
                    <a
                      href={tweet.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs font-medium text-teal-500 hover:text-teal-400 hover:underline transition-colors"
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
