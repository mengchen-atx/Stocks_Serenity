"use client";

import type { Company, ViewMode, TimeRange } from "@/lib/supply-chain-data";
import { getMentions } from "@/lib/supply-chain-data";
import type { QuoteData } from "@/app/api/supply-chain/quotes/route";

interface Props {
  company: Company;
  viewMode: ViewMode;
  timeRange: TimeRange;
  quote: QuoteData | null;
  isHighlighted: boolean;
  isDimmed: boolean;
  onMouseEnter: (e: React.MouseEvent, company: Company) => void;
  onMouseLeave: () => void;
  onClick: (ticker: string) => void;
}

/** Card background color = direction of the currently selected time range. */
function cardCls(delta: number | null): string {
  if (delta === null) return "bg-slate-800/50 border-slate-700/50";
  if (delta > 0)     return "bg-emerald-900/40 border-emerald-700/50";
  if (delta < 0)     return "bg-red-900/40 border-red-700/50";
  return "bg-slate-800/50 border-slate-600/50"; // flat
}

function getDelta(quote: QuoteData | null, range: TimeRange): number | null {
  if (!quote) return null;
  if (range === "24h") return quote.dp24h;
  if (range === "7d")  return quote.dp7d;
  return quote.dp30d;
}

function sourceTag(source: string): string {
  const map: Record<string, string> = {
    Serenity:       "bg-teal-900/50 text-teal-400 border-teal-800",
    Kova:           "bg-violet-900/50 text-violet-400 border-violet-800",
    SemiAnalysis:   "bg-blue-900/50 text-blue-400 border-blue-800",
    "Gavin Baker":  "bg-amber-900/50 text-amber-400 border-amber-800",
  };
  return map[source] ?? "bg-slate-800 text-slate-400 border-slate-700";
}

function heatColor(heat: number): string {
  if (heat >= 75) return "text-amber-400";
  if (heat >= 55) return "text-violet-400";
  if (heat >= 35) return "text-blue-400";
  return "text-slate-500";
}

function sentimentTag(sentiment: string): { label: string; cls: string } {
  if (sentiment === "bullish") return { label: "▲多", cls: "text-emerald-400" };
  if (sentiment === "bearish") return { label: "▼空", cls: "text-red-400" };
  return { label: "●中", cls: "text-slate-500" };
}

export function CompanyCard({
  company,
  viewMode,
  timeRange,
  quote,
  isHighlighted,
  isDimmed,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: Props) {
  const delta   = getDelta(quote, timeRange);
  const mentions = getMentions(company, timeRange);

  const deltaStr = delta === null
    ? "—"
    : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}%`;

  const deltaCls = delta === null
    ? "text-slate-600"
    : delta > 0 ? "text-emerald-300"
    : delta < 0 ? "text-red-300"
    : "text-slate-400";

  const sentiment = sentimentTag(company.sentiment);

  return (
    <div
      onMouseEnter={(e) => onMouseEnter(e, company)}
      onMouseLeave={onMouseLeave}
      onClick={() => onClick(company.ticker)}
      className={`
        rounded-md border px-2.5 py-2 cursor-pointer select-none
        transition-all duration-200
        ${cardCls(delta)}
        ${isHighlighted ? "ring-2 ring-amber-400/70 scale-[1.03]" : ""}
        ${isDimmed ? "opacity-25" : "opacity-100"}
        hover:brightness-125 hover:scale-[1.02]
      `}
    >
      {/* Row 1: ticker + delta */}
      <div className="flex items-center justify-between gap-1 min-w-0">
        <span className="font-mono text-sm font-bold text-slate-100 truncate">
          {company.ticker}
        </span>
        <span className={`font-mono text-[11px] font-semibold shrink-0 ${deltaCls}`}>
          {deltaStr}
        </span>
      </div>

      {/* Row 2: secondary info based on viewMode */}
      <div className="mt-0.5 flex items-center justify-between gap-1">
        {viewMode === "source" ? (
          <div className="flex gap-0.5 flex-wrap">
            {company.sources.slice(0, 2).map((s) => (
              <span key={s} className={`rounded border px-1 text-[9px] font-medium py-0.5 ${sourceTag(s)}`}>
                {s === "Gavin Baker" ? "GB" : s}
              </span>
            ))}
          </div>
        ) : viewMode === "sentiment" ? (
          <span className={`font-mono text-[10px] font-semibold ${sentiment.cls}`}>
            {sentiment.label}
          </span>
        ) : viewMode === "heat" ? (
          <span className={`font-mono text-[10px] font-bold ${heatColor(company.heat)}`}>
            🔥{company.heat}
          </span>
        ) : (
          /* default: mentions count */
          <span className="font-mono text-[10px] text-slate-500">{mentions}×</span>
        )}
      </div>
    </div>
  );
}
