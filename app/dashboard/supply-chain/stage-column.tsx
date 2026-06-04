"use client";

import { useState } from "react";
import type { Stage, Company, ViewMode, TimeRange } from "@/lib/supply-chain-data";
import { stageHeat, stageSentiment } from "@/lib/supply-chain-data";
import type { QuoteData } from "@/app/api/supply-chain/quotes/route";
import { CompanyCard } from "./company-card";

const COLLAPSED_COUNT = 8;

interface Props {
  stage: Stage;
  companies: Company[];
  viewMode: ViewMode;
  timeRange: TimeRange;
  searchQuery: string;
  quotes: Record<string, QuoteData>;
  selectedTicker: string | null;
  onCompanyHover: (e: React.MouseEvent, company: Company) => void;
  onCompanyLeave: () => void;
  onCompanyClick: (ticker: string) => void;
}

function HeatBar({ stageId }: { stageId: string }) {
  const heat = stageHeat(stageId);
  const color =
    heat >= 75 ? "#d97706" : heat >= 55 ? "#7c3aed" : heat >= 35 ? "#1d4ed8" : "#334155";
  return (
    <div className="w-full bg-slate-800 rounded-full h-1 mt-1.5">
      <div className="h-1 rounded-full transition-all duration-500" style={{ width: `${heat}%`, background: color }} />
    </div>
  );
}

export function StageColumn({
  stage,
  companies,
  viewMode,
  timeRange,
  searchQuery,
  quotes,
  selectedTicker,
  onCompanyHover,
  onCompanyLeave,
  onCompanyClick,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const heat = stageHeat(stage.id);
  const sentiment = stageSentiment(stage.id);
  const isHot = heat >= 75;

  const visible = expanded ? companies : companies.slice(0, COLLAPSED_COUNT);
  const remaining = companies.length - COLLAPSED_COUNT;
  const query = searchQuery.trim().toUpperCase();

  return (
    <div
      className={`
        flex flex-col shrink-0 w-[196px] rounded-xl border
        ${isHot
          ? "border-amber-700/40 bg-gradient-to-b from-amber-950/30 to-[#070d1a]"
          : "border-slate-800 bg-[#070d1a]"
        }
      `}
    >
      {/* ── Stage header ── */}
      <div className="p-3 border-b border-slate-800/80 rounded-t-xl">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {isHot && <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />}
              <h2 className="text-sm font-bold text-slate-100 truncate">{stage.name}</h2>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-tight truncate">{stage.description}</p>
          </div>
          <div className="shrink-0 text-right">
            <span className={`font-mono text-xs font-semibold ${heat >= 75 ? "text-amber-400" : heat >= 55 ? "text-violet-400" : "text-slate-500"}`}>
              {heat}
            </span>
            <div className={`text-[9px] font-medium mt-0.5 ${sentiment === "bullish" ? "text-emerald-500" : sentiment === "bearish" ? "text-red-500" : "text-slate-600"}`}>
              {sentiment === "bullish" ? "▲多" : sentiment === "bearish" ? "▼空" : "●中"}
            </div>
          </div>
        </div>
        <HeatBar stageId={stage.id} />
        <p className="text-[9px] text-slate-600 mt-1.5 font-mono">{companies.length} companies</p>
      </div>

      {/* ── Company cards ── */}
      <div className="flex flex-col gap-1.5 p-2 flex-1">
        {visible.map((company) => {
          const isSelected = selectedTicker === company.ticker;
          const isHighlighted = isSelected || (query.length > 0 && company.ticker.includes(query));
          const isDimmed = !isSelected && query.length > 0 && !company.ticker.includes(query);
          return (
            <CompanyCard
              key={company.id}
              company={company}
              viewMode={viewMode}
              timeRange={timeRange}
              quote={quotes[company.ticker] ?? null}
              isHighlighted={isHighlighted}
              isDimmed={isDimmed}
              onMouseEnter={onCompanyHover}
              onMouseLeave={onCompanyLeave}
              onClick={onCompanyClick}
            />
          );
        })}

        {companies.length > COLLAPSED_COUNT && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-0.5 w-full rounded-md border border-slate-800 py-1 text-[10px] font-mono text-slate-500 hover:border-slate-600 hover:text-slate-300 transition-colors"
          >
            {expanded ? "▲ 收起" : `＋${remaining} 更多`}
          </button>
        )}
      </div>
    </div>
  );
}
