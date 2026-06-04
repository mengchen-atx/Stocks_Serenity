"use client";

import type { Company } from "@/lib/supply-chain-data";
import { STAGES } from "@/lib/supply-chain-data";
import type { QuoteData } from "@/app/api/supply-chain/quotes/route";

interface Props {
  company: Company;
  quote: QuoteData | null;
  x: number;
  y: number;
}

const SENTIMENT_LABEL: Record<string, string> = {
  bullish: "▲ 看多",
  bearish: "▼ 看空",
  neutral: "● 中性",
};

const SENTIMENT_COLOR: Record<string, string> = {
  bullish: "text-emerald-400",
  bearish: "text-red-400",
  neutral: "text-slate-400",
};

function SourceBadge({ source }: { source: string }) {
  const cls: Record<string, string> = {
    Serenity: "bg-teal-900/60 text-teal-400 border-teal-800",
    Kova: "bg-violet-900/60 text-violet-400 border-violet-800",
    SemiAnalysis: "bg-blue-900/60 text-blue-400 border-blue-800",
    "Gavin Baker": "bg-amber-900/60 text-amber-400 border-amber-800",
  };
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[9px] font-medium ${cls[source] ?? "bg-slate-800 text-slate-400 border-slate-700"}`}>
      {source}
    </span>
  );
}

function DeltaCell({
  label,
  value,
  isReal,
}: {
  label: string;
  value: number | null;
  isReal: boolean;
}) {
  return (
    <div className="rounded-md bg-slate-800/60 px-2 py-1.5 text-center">
      <div className={`font-mono text-xs font-bold ${value === null ? "text-slate-600" : value > 0 ? "text-emerald-400" : value < 0 ? "text-red-400" : "text-slate-300"}`}>
        {value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`}
      </div>
      <div className="text-[9px] text-slate-500">{label}</div>
      {isReal && value !== null && (
        <div className="text-[8px] text-slate-600 mt-0.5">实时</div>
      )}
    </div>
  );
}

export function CompanyTooltip({ company, quote, x, y }: Props) {
  const stage = STAGES.find((s) => s.id === company.stageId);

  // Keep tooltip inside viewport
  const rightEdge = typeof window !== "undefined" ? window.innerWidth : 1200;
  const left = x + 280 > rightEdge ? x - 290 : x + 14;

  return (
    <div className="fixed z-50 pointer-events-none" style={{ left, top: y - 8 }}>
      <div className="w-64 rounded-xl border border-slate-700 bg-[#0a1628]/95 backdrop-blur-md shadow-2xl shadow-black/60 p-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <div className="font-mono text-base font-bold text-slate-100">{company.ticker}</div>
            <div className="text-xs text-slate-400 leading-tight">
              {company.nameZh ?? company.name}
            </div>
            {quote?.price != null && (
              <div className="font-mono text-xs text-slate-500 mt-0.5">
                ${quote.price.toFixed(2)}
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className={`text-xs font-semibold ${SENTIMENT_COLOR[company.sentiment]}`}>
              {SENTIMENT_LABEL[company.sentiment]}
            </div>
            <div className="font-mono text-xs text-amber-400 mt-0.5">热度 {company.heat}</div>
          </div>
        </div>

        {/* Stage */}
        {stage && (
          <div className="text-[10px] text-slate-500 mb-2.5 pb-2.5 border-b border-slate-800">
            {stage.stageIndex + 1}. {stage.name} — {stage.nameEn}
          </div>
        )}

        {/* Price deltas — real data */}
        <div className="grid grid-cols-3 gap-1 mb-2.5">
          <DeltaCell label="24h" value={quote?.dp24h ?? null} isReal={!!quote} />
          <DeltaCell label="7d" value={quote?.dp7d ?? null} isReal={!!quote} />
          <DeltaCell label="30d" value={quote?.dp30d ?? null} isReal={!!quote} />
        </div>

        {/* Mentions (editorial) */}
        <div className="grid grid-cols-3 gap-1 mb-2.5">
          {[
            { label: "提及/24h", v: company.mentions24h },
            { label: "提及/7d", v: company.mentions7d },
            { label: "提及/30d", v: company.mentions30d },
          ].map(({ label, v }) => (
            <div key={label} className="rounded-md bg-slate-800/40 px-2 py-1 text-center">
              <div className="font-mono text-xs font-bold text-slate-400">{v}</div>
              <div className="text-[9px] text-slate-600">{label}</div>
            </div>
          ))}
        </div>

        {/* Narratives */}
        {company.narratives.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2.5">
            {company.narratives.map((n) => (
              <span key={n} className="rounded-full border border-amber-800/50 bg-amber-950/40 px-1.5 py-0.5 text-[9px] font-medium text-amber-400">
                {n}
              </span>
            ))}
          </div>
        )}

        {/* Latest insight */}
        <div className="text-[10px] text-slate-300 leading-relaxed mb-2.5 border-l-2 border-slate-700 pl-2">
          {company.latestInsight}
        </div>

        {/* Sources */}
        <div className="flex flex-wrap gap-1">
          {company.sources.map((s) => (
            <SourceBadge key={s} source={s} />
          ))}
        </div>
      </div>
    </div>
  );
}
