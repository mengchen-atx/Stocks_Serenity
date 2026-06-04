"use client";

import type { Company, TimeRange } from "@/lib/supply-chain-data";
import {
  TOP_COMPANIES_BY_HEAT,
  TOP_TRENDING_TICKERS,
  HOTTEST_STAGES,
  ALL_COMPANIES,
  getMentions,
} from "@/lib/supply-chain-data";
import type { QuoteData } from "@/app/api/supply-chain/quotes/route";

interface Props {
  timeRange: TimeRange;
  quotes: Record<string, QuoteData>;
  quotesLoading: boolean;
  onCompanyClick: (ticker: string) => void;
  onStageClick: (stageId: string) => void;
}

function getQuoteDelta(quotes: Record<string, QuoteData>, ticker: string, range: TimeRange): number | null {
  const q = quotes[ticker];
  if (!q) return null;
  if (range === "24h") return q.dp24h;
  if (range === "7d") return q.dp7d;
  return q.dp30d;
}

function CompanyRow({
  company,
  rank,
  value,
  unit,
  onClick,
}: {
  company: Company;
  rank: number;
  value: string;
  unit?: string;
  onClick: (ticker: string) => void;
}) {
  return (
    <button
      onClick={() => onClick(company.ticker)}
      className="w-full flex items-center gap-2 py-1.5 hover:bg-slate-800/60 rounded px-1.5 transition-colors group text-left"
    >
      <span className="shrink-0 w-4 font-mono text-[10px] text-slate-600">{rank}</span>
      <span className={`font-mono text-xs font-bold shrink-0 ${company.sentiment === "bullish" ? "text-emerald-400" : company.sentiment === "bearish" ? "text-red-400" : "text-slate-400"}`}>
        {company.ticker}
      </span>
      <span className="text-[10px] text-slate-500 truncate flex-1 group-hover:text-slate-300 transition-colors">
        {company.nameZh ?? company.name}
      </span>
      <span className="shrink-0 font-mono text-[10px] text-amber-400">{value}</span>
    </button>
  );
}

export function RightPanel({ timeRange, quotes, quotesLoading, onCompanyClick, onStageClick }: Props) {
  // Build trending list from real quote data, sorted by delta for current timeRange
  const trendingCompanies: { company: Company; delta: number }[] = [];
  if (!quotesLoading && Object.keys(quotes).length > 0) {
    const seen = new Set<string>();
    for (const company of ALL_COMPANIES) {
      if (seen.has(company.ticker)) continue;
      seen.add(company.ticker);
      const delta = getQuoteDelta(quotes, company.ticker, timeRange);
      if (delta !== null) trendingCompanies.push({ company, delta });
    }
    trendingCompanies.sort((a, b) => b.delta - a.delta);
  }

  const topTrending = trendingCompanies.slice(0, 10);

  // Fallback: use hardcoded tickers when quotes not loaded yet
  const fallbackTrending = TOP_TRENDING_TICKERS.map((ticker) => {
    const company = ALL_COMPANIES.find((c) => c.ticker === ticker);
    return company ?? null;
  }).filter(Boolean) as Company[];

  return (
    <aside className="hidden xl:flex flex-col w-56 shrink-0 border-l border-slate-800 bg-[#07111f] overflow-y-auto">

      {/* Top 10 by heat */}
      <div className="p-3 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-amber-500 text-sm">🔥</span>
          <span className="text-[10px] font-semibold text-slate-300 tracking-wider uppercase">热度 Top 10</span>
        </div>
        <div>
          {TOP_COMPANIES_BY_HEAT.map((company, i) => (
            <CompanyRow
              key={company.id}
              company={company}
              rank={i + 1}
              value={`${company.heat}`}
              onClick={onCompanyClick}
            />
          ))}
        </div>
      </div>

      {/* Top trending — real price data */}
      <div className="p-3 border-b border-slate-800">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-emerald-500 text-sm">📈</span>
            <span className="text-[10px] font-semibold text-slate-300 tracking-wider uppercase">
              {timeRange} 涨幅榜
            </span>
          </div>
          {quotesLoading && (
            <span className="text-[9px] font-mono text-slate-600 animate-pulse">加载中…</span>
          )}
        </div>
        <div>
          {(topTrending.length > 0 ? topTrending : fallbackTrending.map((c) => ({ company: c, delta: null as unknown as number }))).map(
            ({ company, delta }, i) => {
              const realDelta = topTrending.length > 0 ? delta : getQuoteDelta(quotes, company.ticker, timeRange);
              const displayVal =
                realDelta != null
                  ? `${realDelta > 0 ? "+" : ""}${realDelta.toFixed(2)}%`
                  : "—";
              return (
                <CompanyRow
                  key={company.id}
                  company={company}
                  rank={i + 1}
                  value={displayVal}
                  onClick={onCompanyClick}
                />
              );
            },
          )}
        </div>
      </div>

      {/* Hottest stages */}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-violet-400 text-sm">◈</span>
          <span className="text-[10px] font-semibold text-slate-300 tracking-wider uppercase">阶段热度榜</span>
        </div>
        <div className="space-y-2.5">
          {HOTTEST_STAGES.map((stage, i) => (
            <div key={stage.id}>
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 font-mono text-[9px] w-3">{i + 1}</span>
                  <button
                    onClick={() => onStageClick(stage.id)}
                    className="text-[10px] text-slate-400 hover:text-slate-200 text-left transition-colors truncate max-w-[110px]"
                  >
                    {stage.name}
                  </button>
                </div>
                <span className="font-mono text-[10px] text-amber-500">{stage.heat}</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-0.5">
                <div
                  className="h-0.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${stage.heat}%`,
                    background: stage.heat >= 75 ? "#d97706" : stage.heat >= 55 ? "#7c3aed" : "#334155",
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800 text-[9px] text-slate-600 leading-relaxed">
          涨跌幅：Finnhub 实时价格<br />
          热度/情绪：Serenity · Kova · SemiAnalysis · Gavin Baker 信号
        </div>
      </div>

      {/* Bottom hint */}
      <div className="mt-auto p-3 border-t border-slate-800">
        <p className="text-[9px] text-slate-600 leading-relaxed">
          点击公司 → 个股详情<br />
          点击阶段 → 滤镜聚焦<br />
          悬停 → 完整信息
        </p>
      </div>
    </aside>
  );
}
