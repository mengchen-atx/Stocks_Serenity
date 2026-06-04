"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";
import type { MapNode, MapEdge, GraphData, Sentiment } from "@/lib/alpha-map-data";

// ─── D3 simulation types ──────────────────────────────────────────────────────
interface SimNode extends MapNode, d3.SimulationNodeDatum {}
interface SimEdge {
  id: string;
  source: SimNode | string;
  target: SimNode | string;
  type: string;
  weight: number;
  reason: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  node: SimNode | null;
  edge: SimEdge | null;
}

// ─── Visual helpers ───────────────────────────────────────────────────────────
function nodeRadius(n: SimNode): number {
  if (n.type === "narrative") return 16;
  if (n.type === "chain") return 12;
  const m = n.mentions30d ?? 0;
  return Math.max(8, Math.min(24, 8 + (m / 160) * 16));
}

function nodeColor(n: SimNode): string {
  if (n.type === "narrative") return "#d97706"; // amber-600
  if (n.type === "chain") return "#7c3aed";     // violet-700
  const s = n.sentiment ?? "neutral";
  if (s === "bullish") return "#059669";         // emerald-600
  if (s === "bearish") return "#dc2626";         // red-600
  return "#475569";                               // slate-600
}

function edgeColor(type: string): string {
  if (type === "co-mention")       return "#1e40af"; // blue-800
  if (type === "narrative-belongs") return "#92400e"; // amber-800
  if (type === "chain-belongs")     return "#4c1d95"; // violet-900
  if (type === "cross-source")      return "#065f46"; // emerald-900
  return "#1e293b";
}

function edgeOpacity(type: string): number {
  if (type === "cross-source") return 0.9;
  if (type === "co-mention")   return 0.7;
  return 0.5;
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  data: GraphData;
  timeRange: "24h" | "7d" | "30d";
  sentimentFilter: "all" | Sentiment;
  narrativeFilter: string;
}

export function ForceGraph({ data, timeRange, sentimentFilter, narrativeFilter }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<d3.Simulation<SimNode, SimEdge> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const router = useRouter();

  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, node: null, edge: null,
  });
  const [selected, setSelected] = useState<string | null>(null);

  const mentionKey = timeRange === "24h" ? "mentions24h" : timeRange === "7d" ? "mentions7d" : "mentions30d";

  // ── Filter nodes & edges ─────────────────────────────────────────────────
  const filteredNodes = data.nodes.filter((n) => {
    if (n.type === "stock") {
      if (sentimentFilter !== "all" && n.sentiment !== sentimentFilter) return false;
      if (narrativeFilter !== "all" && !(n.narratives ?? []).includes(narrativeFilter)) return false;
    }
    return true;
  });

  const filteredIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = data.edges.filter(
    (e) => filteredIds.has(e.source as string) && filteredIds.has(e.target as string)
  );

  const fitView = useCallback(() => {
    if (!svgRef.current || !zoomRef.current || !containerRef.current) return;
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    d3.select(svgRef.current)
      .transition().duration(600)
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(w / 2, h / 2).scale(0.75));
  }, []);

  const resetView = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current)
      .transition().duration(500)
      .call(zoomRef.current.transform, d3.zoomIdentity);
  }, []);

  // ── Build graph ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const W = containerRef.current.clientWidth || 900;
    const H = containerRef.current.clientHeight || 600;

    // Clone nodes / edges for D3 mutation
    const simNodes: SimNode[] = filteredNodes.map((n) => ({ ...n }));
    const nodeMap = new Map<string, SimNode>(simNodes.map((n) => [n.id, n]));
    const simEdges: SimEdge[] = filteredEdges
      .map((e) => ({
        ...e,
        source: nodeMap.get(e.source as string) ?? e.source,
        target: nodeMap.get(e.target as string) ?? e.target,
      }))
      .filter((e) => typeof e.source !== "string" && typeof e.target !== "string");

    // ── SVG setup ────────────────────────────────────────────────────────
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", W).attr("height", H);

    const defs = svg.append("defs");
    defs.append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -4 8 8")
      .attr("refX", 18).attr("refY", 0)
      .attr("markerWidth", 4).attr("markerHeight", 4)
      .attr("orient", "auto")
      .append("path").attr("d", "M0,-4L8,0L0,4").attr("fill", "#334155");

    const g = svg.append("g");

    // ── Zoom ─────────────────────────────────────────────────────────────
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (e) => { g.attr("transform", e.transform); });
    svg.call(zoom);
    zoomRef.current = zoom;

    // ── Force simulation ─────────────────────────────────────────────────
    const sim = d3.forceSimulation<SimNode>(simNodes)
      .force("link", d3.forceLink<SimNode, SimEdge>(simEdges)
        .id((d) => d.id)
        .distance((e) => {
          if (e.type === "narrative-belongs" || e.type === "chain-belongs") return 120;
          if (e.type === "cross-source") return 70;
          return 100;
        })
        .strength((e) => e.weight / 14))
      .force("charge", d3.forceManyBody<SimNode>().strength((d) =>
        d.type === "narrative" ? -500 : d.type === "chain" ? -350 : -200))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collide", d3.forceCollide<SimNode>().radius((d) => nodeRadius(d) + 6))
      .alphaDecay(0.03);

    simRef.current = sim;

    // ── Edges ────────────────────────────────────────────────────────────
    const edgeG = g.append("g").attr("class", "edges");
    const edgeEl = edgeG.selectAll<SVGLineElement, SimEdge>("line")
      .data(simEdges)
      .join("line")
      .attr("stroke", (d) => edgeColor(d.type))
      .attr("stroke-width", (d) => Math.max(0.5, (d.weight / 10) * 2.5))
      .attr("stroke-opacity", (d) => edgeOpacity(d.type))
      .style("cursor", "pointer")
      .on("mousemove", (event, d) => {
        setTooltip({ visible: true, x: event.pageX, y: event.pageY, node: null, edge: d });
      })
      .on("mouseleave", () => setTooltip((t) => ({ ...t, visible: false, edge: null })));

    // ── Nodes ────────────────────────────────────────────────────────────
    const nodeG = g.append("g").attr("class", "nodes");
    const nodeEl = nodeG.selectAll<SVGGElement, SimNode>("g.node")
      .data(simNodes, (d) => d.id)
      .join("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .call(
        d3.drag<SVGGElement, SimNode>()
          .on("start", (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on("end", (event, d) => {
            if (!event.active) sim.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
      );

    // Glow filter
    const glow = defs.append("filter").attr("id", "glow");
    glow.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "coloredBlur");
    const merge = glow.append("feMerge");
    merge.append("feMergeNode").attr("in", "coloredBlur");
    merge.append("feMergeNode").attr("in", "SourceGraphic");

    // Circle
    nodeEl.append("circle")
      .attr("r", nodeRadius)
      .attr("fill", nodeColor)
      .attr("stroke", (d) => d.type === "narrative" ? "#f59e0b" : d.type === "chain" ? "#a78bfa" : "none")
      .attr("stroke-width", (d) => d.type !== "stock" ? 2 : 0);

    // Label
    nodeEl.append("text")
      .text((d) => d.label)
      .attr("dy", (d) => nodeRadius(d) + 13)
      .attr("text-anchor", "middle")
      .attr("fill", "#94a3b8")
      .attr("font-size", (d) => d.type === "stock" ? 10 : 9)
      .attr("font-family", "monospace")
      .attr("font-weight", (d) => d.type === "stock" ? "bold" : "normal")
      .attr("pointer-events", "none");

    // Mention count badge for stocks
    nodeEl.filter((d) => d.type === "stock" && (d[mentionKey as keyof SimNode] as number ?? 0) > 0)
      .append("text")
      .text((d) => String(d[mentionKey as keyof SimNode] ?? ""))
      .attr("dy", (d) => -nodeRadius(d) - 4)
      .attr("text-anchor", "middle")
      .attr("fill", "#64748b")
      .attr("font-size", 8)
      .attr("font-family", "monospace")
      .attr("pointer-events", "none");

    // Hover
    nodeEl
      .on("mousemove", (event, d) => {
        setTooltip({ visible: true, x: event.pageX, y: event.pageY, node: d, edge: null });
      })
      .on("mouseleave", () => setTooltip((t) => ({ ...t, visible: false, node: null })));

    // Click
    nodeEl.on("click", (event, d) => {
      event.stopPropagation();
      if (d.type === "stock" && d.targetUrl) {
        router.push(d.targetUrl);
        return;
      }
      setSelected((prev) => (prev === d.id ? null : d.id));
    });

    svg.on("click", () => setSelected(null));

    // ── Tick ─────────────────────────────────────────────────────────────
    sim.on("tick", () => {
      edgeEl
        .attr("x1", (d) => (d.source as SimNode).x ?? 0)
        .attr("y1", (d) => (d.source as SimNode).y ?? 0)
        .attr("x2", (d) => (d.target as SimNode).x ?? 0)
        .attr("y2", (d) => (d.target as SimNode).y ?? 0);

      nodeEl.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => { sim.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredNodes.length, filteredEdges.length, sentimentFilter, narrativeFilter]);

  // ── Selection highlight ──────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    if (!selected) {
      svg.selectAll<SVGGElement, SimNode>("g.node").attr("opacity", 1);
      svg.selectAll<SVGLineElement, SimEdge>("line").attr("opacity", (d) => edgeOpacity(d.type));
      return;
    }

    // Find connected IDs
    const connectedIds = new Set<string>([selected]);
    d3.select(svgRef.current).selectAll<SVGLineElement, SimEdge>("line").each((d) => {
      const src = typeof d.source === "string" ? d.source : d.source.id;
      const tgt = typeof d.target === "string" ? d.target : d.target.id;
      if (src === selected) connectedIds.add(tgt);
      if (tgt === selected) connectedIds.add(src);
    });

    svg.selectAll<SVGGElement, SimNode>("g.node")
      .attr("opacity", (d) => connectedIds.has(d.id) ? 1 : 0.08);
    svg.selectAll<SVGLineElement, SimEdge>("line")
      .attr("opacity", (d) => {
        const src = typeof d.source === "string" ? d.source : d.source.id;
        const tgt = typeof d.target === "string" ? d.target : d.target.id;
        return src === selected || tgt === selected ? 0.9 : 0.03;
      });
  }, [selected]);

  const mentionLabel = timeRange === "24h" ? "24h" : timeRange === "7d" ? "7d" : "30d";

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {/* Graph controls */}
      <div className="absolute top-3 left-3 z-10 flex gap-2">
        <button
          onClick={fitView}
          className="rounded px-2.5 py-1 text-xs font-mono bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
        >
          Fit
        </button>
        <button
          onClick={resetView}
          className="rounded px-2.5 py-1 text-xs font-mono bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
        >
          Reset
        </button>
        {selected && (
          <button
            onClick={() => setSelected(null)}
            className="rounded px-2.5 py-1 text-xs font-mono bg-amber-900/40 border border-amber-700/50 text-amber-400 hover:bg-amber-900/60 transition-colors"
          >
            ✕ 取消选中
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-3 z-10 bg-[#0a1628]/90 border border-slate-800 rounded-lg p-3 text-xs text-slate-400 space-y-1.5 backdrop-blur-sm">
        <div className="text-slate-500 font-semibold mb-2 font-mono">图例</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block bg-emerald-600" /> 看多 Bullish</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block bg-red-600" /> 看空 Bearish</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block bg-slate-600" /> 中性 Neutral</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block bg-amber-600" /> 叙事主题</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block bg-violet-700" /> 产业链环节</div>
        <div className="mt-2 pt-2 border-t border-slate-800 space-y-1">
          <div className="flex items-center gap-2"><span className="w-4 h-0.5 inline-block bg-blue-800" /> 共同提及</div>
          <div className="flex items-center gap-2"><span className="w-4 h-0.5 inline-block bg-amber-800" /> 叙事归属</div>
          <div className="flex items-center gap-2"><span className="w-4 h-0.5 inline-block bg-violet-900" /> 产业链归属</div>
          <div className="flex items-center gap-2"><span className="w-4 h-0.5 inline-block bg-emerald-900" /> 跨源共现</div>
        </div>
        <div className="mt-1 pt-2 border-t border-slate-800 text-slate-600">
          节点大小 = {mentionLabel} 提及次数<br />
          点击股票节点 → 个股页
        </div>
      </div>

      <svg ref={svgRef} className="w-full h-full" />

      {/* Tooltip */}
      {tooltip.visible && (tooltip.node || tooltip.edge) && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
        >
          {tooltip.node ? (
            <NodeTooltip node={tooltip.node} mentionKey={mentionKey} />
          ) : tooltip.edge ? (
            <EdgeTooltip edge={tooltip.edge} />
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── Tooltip components ───────────────────────────────────────────────────────
function NodeTooltip({ node, mentionKey }: { node: SimNode; mentionKey: string }) {
  const sentimentColor = node.sentiment === "bullish" ? "text-emerald-400"
    : node.sentiment === "bearish" ? "text-red-400" : "text-slate-400";

  return (
    <div className="bg-[#0d1f3c] border border-slate-700 rounded-lg shadow-2xl p-3 min-w-[220px] max-w-[280px]">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono font-bold text-sm text-white">{node.label}</span>
        {node.type === "stock" && (
          <span className={`text-xs font-semibold ${sentimentColor}`}>
            {node.sentiment === "bullish" ? "▲ 看多" : node.sentiment === "bearish" ? "▼ 看空" : "● 中性"}
          </span>
        )}
      </div>
      {node.companyName && (
        <div className="text-xs text-slate-400 mb-2">{node.companyName}</div>
      )}
      {node.type === "stock" && (
        <div className="grid grid-cols-3 gap-1 mb-2">
          {[["24h", node.mentions24h], ["7d", node.mentions7d], ["30d", node.mentions30d]].map(([k, v]) => (
            <div key={k as string} className={`text-center rounded p-1 ${mentionKey === `mentions${k}` ? "bg-teal-900/50 border border-teal-700/50" : "bg-slate-800/60"}`}>
              <div className="text-xs text-slate-500">{k as string}</div>
              <div className="font-mono font-bold text-sm text-slate-200">{v as number ?? 0}</div>
            </div>
          ))}
        </div>
      )}
      {node.latestInsight && (
        <div className="text-xs text-slate-400 border-t border-slate-700/50 pt-2 mt-1 leading-relaxed line-clamp-3">
          {node.latestInsight}
        </div>
      )}
      {node.type === "stock" && (
        <div className="text-xs text-teal-500 mt-2">点击 → 个股详情</div>
      )}
    </div>
  );
}

function EdgeTooltip({ edge }: { edge: SimEdge }) {
  const typeLabel: Record<string, string> = {
    "co-mention": "同一推文共同提及",
    "narrative-belongs": "同一叙事主题",
    "chain-belongs": "同属产业链环节",
    "cross-source": "多位博主同时提及",
  };
  return (
    <div className="bg-[#0d1f3c] border border-slate-700 rounded-lg shadow-xl p-2.5 min-w-[180px] max-w-[240px]">
      <div className="text-xs text-slate-500 mb-1">{typeLabel[edge.type] ?? edge.type}</div>
      <div className="text-xs text-slate-300 leading-relaxed">{edge.reason}</div>
      <div className="flex items-center gap-1 mt-1.5">
        <span className="text-slate-600 text-xs">关联强度</span>
        <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-teal-600 rounded-full" style={{ width: `${edge.weight * 10}%` }} />
        </div>
        <span className="text-slate-500 text-xs font-mono">{edge.weight}/10</span>
      </div>
    </div>
  );
}
