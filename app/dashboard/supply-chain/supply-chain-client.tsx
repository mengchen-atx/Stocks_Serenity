"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import {
  STAGES,
  ALL_COMPANIES,
  getCompaniesByStage,
  type Company,
  type ViewMode,
  type TimeRange,
} from "@/lib/supply-chain-data";
import type { QuoteData } from "@/app/api/supply-chain/quotes/route";
import { StageColumn } from "./stage-column";
import { CompanyTooltip } from "./company-tooltip";
import { CompanyDetailPanel } from "./company-detail-panel";
import { RightPanel } from "./right-panel";

interface Props {
  firstChannelSlug: string;
}

interface TooltipState {
  company: Company;
  x: number;
  y: number;
}

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: "heat", label: "热度" },
  { value: "sentiment", label: "情绪" },
  { value: "source", label: "来源" },
];

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
];

export function SupplyChainClient({ firstChannelSlug }: Props) {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [viewMode, setViewMode] = useState<ViewMode>("heat");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Real price quotes from Finnhub (via cached API route)
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [quotesError, setQuotesError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/supply-chain/quotes")
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json() as Promise<Record<string, QuoteData>>;
      })
      .then((data) => {
        if (!cancelled) {
          setQuotes(data);
          setQuotesLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQuotesLoading(false);
          setQuotesError(true);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const visibleStages =
    stageFilter === "all" ? STAGES : STAGES.filter((s) => s.id === stageFilter);

  const handleCompanyHover = useCallback(
    (e: React.MouseEvent, company: Company) => {
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
      // Don't show tooltip if this company is already open in the panel
      if (selectedCompany?.id === company.id) return;
      setTooltip({ company, x: e.clientX, y: e.clientY });
    },
    [selectedCompany],
  );

  const handleCompanyLeave = useCallback(() => {
    tooltipTimeoutRef.current = setTimeout(() => setTooltip(null), 80);
  }, []);

  // Click → open detail panel (no navigation)
  const handleCompanyClick = useCallback((ticker: string) => {
    const company = ALL_COMPANIES.find((c) => c.ticker === ticker && c.stageId);
    if (!company) return;
    setTooltip(null);
    setSelectedCompany((prev) => (prev?.ticker === ticker ? null : company));
  }, []);

  const handleStageClick = useCallback((stageId: string) => {
    setStageFilter((prev) => (prev === stageId ? "all" : stageId));
  }, []);

  const matchCount =
    searchQuery.trim().length > 0
      ? ALL_COMPANIES.filter((c) =>
          c.ticker.toUpperCase().includes(searchQuery.trim().toUpperCase()),
        ).length
      : null;

  const loadedCount = Object.keys(quotes).length;

  return (
    <div className="min-h-screen bg-[#070d1a] text-slate-200 flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#070d1a]/95 backdrop-blur-md">
        <div className="mx-auto max-w-[1800px] px-4 flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-700 text-white text-sm font-bold shadow-lg shadow-violet-500/20">
              ⬡
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-100 tracking-tight sm:text-base">
                AI Infra Supply Chain
              </h1>
              <p className="font-mono text-xs text-slate-500">
                供应链图谱 · {ALL_COMPANIES.length} 家公司 · {STAGES.length} 阶段
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quote status */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs">
              {quotesLoading ? (
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
                  </span>
                  价格加载中…
                </span>
              ) : quotesError ? (
                <span className="text-red-500 text-[10px]">价格获取失败</span>
              ) : loadedCount > 0 ? (
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-teal-500" />
                  实时价格
                </span>
              ) : null}
            </div>
            <Link
              href="/dashboard/alpha-map"
              className="hidden sm:flex items-center gap-1.5 rounded-md border border-amber-700/40 px-3 py-1.5 text-xs font-medium text-amber-500/80 hover:border-amber-600 hover:text-amber-400 hover:bg-amber-900/20 transition-colors"
            >
              ⬡ Alpha Map
            </Link>
            <Link
              href={`/dashboard/${firstChannelSlug}`}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-slate-600 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              ← 返回动态
            </Link>
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div className="mx-auto max-w-[1800px] px-4 pb-2.5 flex flex-wrap items-center gap-2.5">
          {/* Time range */}
          <div className="flex items-center gap-0.5 bg-slate-900 rounded-md border border-slate-800 p-0.5">
            {TIME_RANGES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTimeRange(value)}
                className={`px-3 py-1 text-xs font-mono rounded transition-colors ${timeRange === value ? "bg-slate-700 text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* View mode */}
          <div className="flex items-center gap-0.5 bg-slate-900 rounded-md border border-slate-800 p-0.5">
            {VIEW_MODES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setViewMode(value)}
                className={`px-3 py-1 text-xs font-mono rounded transition-colors ${viewMode === value ? "bg-slate-700 text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Stage filter */}
          <div className="flex items-center gap-0.5 bg-slate-900 rounded-md border border-slate-800 p-0.5 overflow-x-auto max-w-full">
            <button
              onClick={() => setStageFilter("all")}
              className={`px-2.5 py-1 text-xs font-mono rounded whitespace-nowrap transition-colors ${stageFilter === "all" ? "bg-slate-700 text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
            >
              全部阶段
            </button>
            {STAGES.map((stage) => (
              <button
                key={stage.id}
                onClick={() => handleStageClick(stage.id)}
                className={`px-2.5 py-1 text-xs font-mono rounded whitespace-nowrap transition-colors ${stageFilter === stage.id ? "bg-violet-900/60 text-violet-300" : "text-slate-500 hover:text-slate-300"}`}
              >
                {stage.name}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex items-center">
            <span className="absolute left-2.5 text-slate-500 text-xs pointer-events-none">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索 Ticker…"
              className="w-32 bg-slate-900 border border-slate-800 rounded-md pl-7 pr-3 py-1 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-600 transition-colors"
            />
            {matchCount !== null && (
              <span className="absolute right-2 text-[9px] font-mono text-violet-400 pointer-events-none">
                {matchCount}
              </span>
            )}
          </div>

          {(stageFilter !== "all" || searchQuery) && (
            <button
              onClick={() => { setStageFilter("all"); setSearchQuery(""); }}
              className="text-xs text-slate-500 hover:text-slate-300 font-mono transition-colors"
            >
              ✕ 清除
            </button>
          )}
        </div>
      </header>

      {/* ── Main area ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Horizontal scroll area */}
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <div className={`flex gap-3 p-4 ${stageFilter !== "all" ? "justify-center" : "min-w-max"}`}>
            {visibleStages.map((stage) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                companies={getCompaniesByStage(stage.id)}
                viewMode={viewMode}
                timeRange={timeRange}
                searchQuery={searchQuery}
                quotes={quotes}
                selectedTicker={selectedCompany?.ticker ?? null}
                onCompanyHover={handleCompanyHover}
                onCompanyLeave={handleCompanyLeave}
                onCompanyClick={handleCompanyClick}
              />
            ))}
          </div>
        </div>

        {/* Detail panel (replaces right-panel when a company is selected) */}
        {selectedCompany ? (
          <CompanyDetailPanel
            key={selectedCompany.id}
            company={selectedCompany}
            quote={quotes[selectedCompany.ticker] ?? null}
            onClose={() => setSelectedCompany(null)}
          />
        ) : (
          <RightPanel
            timeRange={timeRange}
            quotes={quotes}
            quotesLoading={quotesLoading}
            onCompanyClick={handleCompanyClick}
            onStageClick={handleStageClick}
          />
        )}
      </div>

      {/* Hover tooltip (only when no panel open) */}
      {tooltip && !selectedCompany && (
        <CompanyTooltip
          company={tooltip.company}
          quote={quotes[tooltip.company.ticker] ?? null}
          x={tooltip.x}
          y={tooltip.y}
        />
      )}
    </div>
  );
}
