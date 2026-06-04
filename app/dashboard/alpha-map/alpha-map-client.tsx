"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { ForceGraph } from "./force-graph";
import {
  mockGraphData,
  narrativeHeat,
  ALL_NARRATIVES,
} from "@/lib/alpha-map-data";
import type { Sentiment } from "@/lib/alpha-map-data";
import type { QuoteData } from "@/app/api/supply-chain/quotes/route";

type TimeRange = "24h" | "7d" | "30d";

interface Props {
  firstChannelSlug: string;
}

// All stock tickers in the Alpha Map graph
const STOCK_TICKERS = [
  ...new Set(
    mockGraphData.nodes
      .filter((n) => n.type === "stock")
      .map((n) => n.id as string),
  ),
];

export function AlphaMapClient({ firstChannelSlug }: Props) {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [sentimentFilter, setSentimentFilter] = useState<"all" | Sentiment>("all");
  const [narrativeFilter, setNarrativeFilter] = useState("all");
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});

  // Fetch real price data (shared cache with Supply Chain page)
  useEffect(() => {
    fetch("/api/supply-chain/quotes")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: Record<string, QuoteData>) => setQuotes(data))
      .catch(() => {});
  }, []);

  // Build "今日升温节点" from real Finnhub dp24h, sorted by absolute move
  const trendingToday = useMemo(() => {
    return STOCK_TICKERS
      .map((ticker) => ({ ticker, dp24h: quotes[ticker]?.dp24h ?? null }))
      .filter((t) => t.dp24h !== null)
      .sort((a, b) => Math.abs(b.dp24h!) - Math.abs(a.dp24h!))
      .slice(0, 8) as { ticker: string; dp24h: number }[];
  }, [quotes]);

  const filteredData = useMemo(() => {
    const nodes = mockGraphData.nodes.filter((n) => {
      if (n.type === "stock") {
        if (sentimentFilter !== "all" && n.sentiment !== sentimentFilter) return false;
        if (narrativeFilter !== "all" && !(n.narratives ?? []).includes(narrativeFilter)) return false;
      }
      return true;
    });
    const ids = new Set(nodes.map((n) => n.id));
    const edges = mockGraphData.edges.filter(
      (e) => ids.has(e.source as string) && ids.has(e.target as string),
    );
    return { nodes, edges };
  }, [sentimentFilter, narrativeFilter]);

  const nodeCount = filteredData.nodes.filter((n) => n.type === "stock").length;

  return (
    <div className="min-h-screen bg-[#070d1a] text-slate-200 flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#070d1a]/95 backdrop-blur-md">
        <div className="mx-auto max-w-[1600px] px-4 flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white text-sm font-bold shadow-lg shadow-amber-500/20">
              ⬡
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-100 tracking-tight sm:text-base">
                Alpha Map
              </h1>
              <p className="font-mono text-xs text-slate-500">AI Infra Narrative Network · {nodeCount} stocks</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/dashboard/${firstChannelSlug}`}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-slate-600 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              ← 返回动态
            </Link>
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div className="mx-auto max-w-[1600px] px-4 pb-2.5 flex flex-wrap items-center gap-3">
          {/* Time range */}
          <div className="flex items-center gap-1 bg-slate-900 rounded-md border border-slate-800 p-0.5">
            {(["24h", "7d", "30d"] as TimeRange[]).map((t) => (
              <button
                key={t}
                onClick={() => setTimeRange(t)}
                className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                  timeRange === t ? "bg-slate-700 text-slate-100" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Sentiment */}
          <div className="flex items-center gap-1 bg-slate-900 rounded-md border border-slate-800 p-0.5">
            {([
              { v: "all", label: "全部" },
              { v: "bullish", label: "▲ 看多" },
              { v: "bearish", label: "▼ 看空" },
              { v: "neutral", label: "● 中性" },
            ] as { v: "all" | Sentiment; label: string }[]).map(({ v, label }) => (
              <button
                key={v}
                onClick={() => setSentimentFilter(v)}
                className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                  sentimentFilter === v
                    ? v === "bullish" ? "bg-emerald-900/60 text-emerald-400"
                      : v === "bearish" ? "bg-red-900/60 text-red-400"
                      : "bg-slate-700 text-slate-100"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Narrative */}
          <div className="flex items-center gap-1 bg-slate-900 rounded-md border border-slate-800 p-0.5 overflow-x-auto max-w-full">
            <button
              onClick={() => setNarrativeFilter("all")}
              className={`px-3 py-1 text-xs font-mono rounded whitespace-nowrap transition-colors ${
                narrativeFilter === "all" ? "bg-slate-700 text-slate-100" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              全部叙事
            </button>
            {ALL_NARRATIVES.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setNarrativeFilter(id)}
                className={`px-3 py-1 text-xs font-mono rounded whitespace-nowrap transition-colors ${
                  narrativeFilter === id ? "bg-amber-900/60 text-amber-400" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Main area ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Graph */}
        <div className="flex-1 relative overflow-hidden">
          <ForceGraph
            data={filteredData}
            timeRange={timeRange}
            sentimentFilter={sentimentFilter}
            narrativeFilter={narrativeFilter}
          />
        </div>

        {/* Right panel */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0 border-l border-slate-800 bg-[#07111f] overflow-y-auto">

          {/* 今日升温节点 — 真实数据 */}
          <div className="p-4 border-b border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-amber-500">🔥</span>
              <span className="text-xs font-semibold text-slate-300 tracking-wider uppercase">今日最大波动</span>
            </div>
            {trendingToday.length === 0 ? (
              <p className="text-[10px] text-slate-600 font-mono">加载中…</p>
            ) : (
              <div className="space-y-2">
                {trendingToday.map((t) => (
                  <div key={t.ticker} className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-slate-200">
                      {t.ticker}
                    </span>
                    <span
                      className={`font-mono text-xs font-semibold px-2 py-0.5 rounded ${
                        t.dp24h > 0
                          ? "bg-emerald-900/40 text-emerald-400"
                          : "bg-red-900/40 text-red-400"
                      }`}
                    >
                      {t.dp24h > 0 ? "+" : ""}{t.dp24h.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 叙事热度榜 */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-violet-400">◈</span>
              <span className="text-xs font-semibold text-slate-300 tracking-wider uppercase">叙事热度榜</span>
            </div>
            <div className="space-y-3">
              {narrativeHeat.map((n, i) => (
                <div key={n.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-600 font-mono text-xs w-4">{i + 1}</span>
                      <button
                        onClick={() => setNarrativeFilter(n.id === narrativeFilter ? "all" : n.id)}
                        className={`text-xs font-medium text-left leading-tight transition-colors ${
                          narrativeFilter === n.id ? "text-amber-400" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {n.label}
                      </button>
                    </div>
                    <span className={`font-mono text-xs ${n.delta >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {n.delta > 0 ? "+" : ""}{n.delta}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1">
                    <div
                      className="h-1 rounded-full transition-all duration-500"
                      style={{
                        width: `${n.heat}%`,
                        background: n.heat > 80 ? "#d97706" : n.heat > 60 ? "#7c3aed" : "#334155",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-600 leading-relaxed">
              今日波动：Finnhub 实时<br />
              叙事热度：编辑评分
            </div>
          </div>

          {/* Hint */}
          <div className="mt-auto p-4 border-t border-slate-800">
            <p className="text-xs text-slate-600">
              拖拽节点 · 滚轮缩放<br />
              点击股票节点 → 个股详情<br />
              点击非股票节点 → 高亮关联
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
