"use client";

import type { Company } from "@/lib/supply-chain-data";
import { STAGES } from "@/lib/supply-chain-data";
import type { QuoteData } from "@/app/api/supply-chain/quotes/route";

interface Props {
  company: Company;
  quote: QuoteData | null;
  onClose: () => void;
}

function DeltaBlock({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  const isNull = value === null;
  const isPos = !isNull && value! > 0;
  const isNeg = !isNull && value! < 0;
  return (
    <div className="flex flex-col items-center rounded-lg bg-slate-800/60 px-3 py-2.5 gap-0.5">
      <span
        className={`font-mono text-sm font-bold ${
          isNull ? "text-slate-600" : isPos ? "text-emerald-400" : isNeg ? "text-red-400" : "text-slate-300"
        }`}
      >
        {isNull ? "—" : `${isPos ? "+" : ""}${value!.toFixed(2)}%`}
      </span>
      <span className="text-[10px] text-slate-500">{label}</span>
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  const cls: Record<string, string> = {
    Serenity: "bg-teal-900/60 text-teal-400 border-teal-800",
    Kova: "bg-violet-900/60 text-violet-400 border-violet-800",
    SemiAnalysis: "bg-blue-900/60 text-blue-400 border-blue-800",
    "Gavin Baker": "bg-amber-900/60 text-amber-400 border-amber-800",
  };
  return (
    <span
      className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${cls[source] ?? "bg-slate-800 text-slate-400 border-slate-700"}`}
    >
      {source}
    </span>
  );
}

const SENTIMENT_MAP = {
  bullish: { label: "▲ 看多", cls: "text-emerald-400 bg-emerald-900/40 border-emerald-800" },
  bearish: { label: "▼ 看空", cls: "text-red-400 bg-red-900/40 border-red-800" },
  neutral: { label: "● 中性", cls: "text-slate-400 bg-slate-800/60 border-slate-700" },
};

export function CompanyDetailPanel({ company, quote, onClose }: Props) {
  const stage = STAGES.find((s) => s.id === company.stageId);
  const sent = SENTIMENT_MAP[company.sentiment];

  return (
    <div className="flex flex-col w-72 shrink-0 border-l border-slate-700 bg-[#08101e] overflow-y-auto animate-slide-in">

      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#08101e]/95 backdrop-blur-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex flex-col min-w-0">
            <span className="font-mono text-lg font-bold text-white tracking-tight">
              {company.ticker}
            </span>
            {quote?.price != null && (
              <span className="font-mono text-xs text-slate-400">
                ${quote.price.toFixed(2)}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 flex items-center justify-center h-7 w-7 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors text-sm"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-5 p-4">

        {/* Company name + stage */}
        <div>
          <p className="text-sm font-medium text-slate-200">
            {company.nameZh ?? company.name}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {company.name}
          </p>
          {stage && (
            <div className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-slate-700/60 bg-slate-800/40 px-2 py-0.5">
              <span className="text-[10px] text-slate-500">
                {stage.stageIndex + 1}. {stage.name}
              </span>
            </div>
          )}
        </div>

        {/* Sentiment + heat */}
        <div className="flex items-center gap-2">
          <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${sent.cls}`}>
            {sent.label}
          </span>
          <div className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/40 px-2.5 py-1">
            <span className="text-[10px] text-slate-500">热度</span>
            <span className="font-mono text-xs font-bold text-amber-400">{company.heat}</span>
          </div>
        </div>

        {/* Price deltas */}
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            价格涨跌幅 · Finnhub 实时
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            <DeltaBlock label="今日" value={quote?.dp24h ?? null} />
            <DeltaBlock label="7日" value={quote?.dp7d ?? null} />
            <DeltaBlock label="30日" value={quote?.dp30d ?? null} />
          </div>
        </div>

        {/* Mentions */}
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            KOL 提及次数
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: "24小时", v: company.mentions24h },
              { label: "7天", v: company.mentions7d },
              { label: "30天", v: company.mentions30d },
            ].map(({ label, v }) => (
              <div
                key={label}
                className="flex flex-col items-center rounded-lg bg-slate-800/40 px-3 py-2.5 gap-0.5"
              >
                <span className="font-mono text-sm font-bold text-slate-300">{v}</span>
                <span className="text-[10px] text-slate-500">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Narratives */}
        {company.narratives.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              关联叙事
            </p>
            <div className="flex flex-wrap gap-1.5">
              {company.narratives.map((n) => (
                <span
                  key={n}
                  className="rounded-full border border-amber-800/50 bg-amber-950/40 px-2.5 py-0.5 text-[10px] font-medium text-amber-400"
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Latest insight */}
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            最新洞察
          </p>
          <p className="text-xs text-slate-300 leading-relaxed border-l-2 border-violet-700/50 pl-3">
            {company.latestInsight}
          </p>
        </div>

        {/* Sources */}
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            信号来源
          </p>
          <div className="flex flex-wrap gap-1.5">
            {company.sources.map((s) => (
              <SourceBadge key={s} source={s} />
            ))}
          </div>
        </div>

        {/* External links */}
        <div className="pt-1 pb-2 border-t border-slate-800 flex flex-wrap gap-2">
          <a
            href={`https://finance.yahoo.com/quote/${company.ticker}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-slate-700 px-3 py-1.5 text-[10px] font-medium text-slate-400 hover:border-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            Yahoo Finance ↗
          </a>
          <a
            href={`https://www.tradingview.com/symbols/${company.ticker}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-slate-700 px-3 py-1.5 text-[10px] font-medium text-slate-400 hover:border-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            TradingView ↗
          </a>
        </div>
      </div>
    </div>
  );
}
