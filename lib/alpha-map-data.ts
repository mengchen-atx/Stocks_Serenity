/**
 * Alpha Map — AI Infra Narrative Network
 * Data types + mock data (easy to swap for a real /api/alpha-map endpoint)
 */

export type NodeType = "narrative" | "stock" | "chain";
export type Sentiment = "bullish" | "bearish" | "neutral";
export type EdgeType = "co-mention" | "narrative-belongs" | "chain-belongs" | "cross-source";

export interface MapNode {
  id: string;
  label: string;
  type: NodeType;
  // stock-specific
  ticker?: string;
  companyName?: string;
  sentiment?: Sentiment;
  mentions24h?: number;
  mentions7d?: number;
  mentions30d?: number;
  narratives?: string[];
  supplyChainStage?: string;
  latestInsight?: string;
  targetUrl?: string;
  // trending delta (0-100 %)
  trendDelta?: number;
}

export interface MapEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  weight: number; // 1-10
  reason: string;
}

export interface GraphData {
  nodes: MapNode[];
  edges: MapEdge[];
}

// ─── Narrative theme nodes ────────────────────────────────────────────────────
const narrativeNodes: MapNode[] = [
  { id: "n-cpo",      label: "CPO / Photonics",     type: "narrative" },
  { id: "n-neocloud", label: "Neocloud",             type: "narrative" },
  { id: "n-hbm",      label: "HBM / Memory",         type: "narrative" },
  { id: "n-power",    label: "Power / Grid",          type: "narrative" },
  { id: "n-asic",     label: "Custom ASIC",           type: "narrative" },
  { id: "n-cooling",  label: "DC Cooling",            type: "narrative" },
  { id: "n-space",    label: "Space Datacenter",      type: "narrative" },
  { id: "n-robotics", label: "Robotics",              type: "narrative" },
];

// ─── Supply-chain stage nodes ─────────────────────────────────────────────────
const chainNodes: MapNode[] = [
  { id: "c-design",     label: "Chip Design",          type: "chain" },
  { id: "c-foundry",    label: "Foundry",               type: "chain" },
  { id: "c-packaging",  label: "Adv. Packaging",        type: "chain" },
  { id: "c-optical",    label: "Optical Interconnect",  type: "chain" },
  { id: "c-power",      label: "Power Infrastructure",  type: "chain" },
  { id: "c-datacenter", label: "Cloud / Datacenter",    type: "chain" },
  { id: "c-ai",         label: "AI Models",             type: "chain" },
];

// ─── Stock nodes ──────────────────────────────────────────────────────────────
const stockNodes: MapNode[] = [
  {
    id: "NVDA", ticker: "NVDA", label: "NVDA", companyName: "NVIDIA", type: "stock",
    sentiment: "bullish", mentions24h: 8, mentions7d: 42, mentions30d: 156, trendDelta: 12,
    narratives: ["n-neocloud", "n-asic"],
    supplyChainStage: "c-design",
    latestInsight: "Blackwell 产能约束缓解，CoWoS 订单超预期，下季度 data-center 收入指引上调。",
    targetUrl: "/dashboard/serenity/stock/NVDA",
  },
  {
    id: "MRVL", ticker: "MRVL", label: "MRVL", companyName: "Marvell Tech", type: "stock",
    sentiment: "bullish", mentions24h: 6, mentions7d: 38, mentions30d: 124, trendDelta: 21,
    narratives: ["n-cpo", "n-asic"],
    supplyChainStage: "c-design",
    latestInsight: "CPO 方案进入量产阶段，AWS/Google ASIC 大单落地，2026 AI infra 收入预期上调 35%。",
    targetUrl: "/dashboard/serenity/stock/MRVL",
  },
  {
    id: "AVGO", ticker: "AVGO", label: "AVGO", companyName: "Broadcom", type: "stock",
    sentiment: "bullish", mentions24h: 5, mentions7d: 28, mentions30d: 98, trendDelta: 8,
    narratives: ["n-cpo", "n-asic"],
    supplyChainStage: "c-design",
    latestInsight: "XPU 定制芯片份额持续扩大，三大超大规模云商均是客户，AI ASIC 收入 FY2025 翻倍。",
    targetUrl: "/dashboard/serenity/stock/AVGO",
  },
  {
    id: "SIVE", ticker: "SIVE", label: "SIVE", companyName: "Sivers Semiconductors", type: "stock",
    sentiment: "bullish", mentions24h: 4, mentions7d: 22, mentions30d: 67, trendDelta: 38,
    narratives: ["n-cpo"],
    supplyChainStage: "c-optical",
    latestInsight: "CPO 光引擎核心供应商，800G/1.6T 需求爆发，与 MRVL 协同验证进展顺利。",
    targetUrl: "/dashboard/serenity/stock/SIVE",
  },
  {
    id: "COHR", ticker: "COHR", label: "COHR", companyName: "Coherent Corp", type: "stock",
    sentiment: "bullish", mentions24h: 3, mentions7d: 19, mentions30d: 74, trendDelta: 14,
    narratives: ["n-cpo"],
    supplyChainStage: "c-optical",
    latestInsight: "EML 激光芯片拿下 Meta Infra 大单，800G 光模块出货量季增 60%。",
    targetUrl: "/dashboard/serenity/stock/COHR",
  },
  {
    id: "LITE", ticker: "LITE", label: "LITE", companyName: "Lumentum", type: "stock",
    sentiment: "bullish", mentions24h: 2, mentions7d: 14, mentions30d: 52, trendDelta: 9,
    narratives: ["n-cpo"],
    supplyChainStage: "c-optical",
    latestInsight: "CPO 光源供应商，与 COHR 构成双寡头，2H25 订单能见度优于预期。",
    targetUrl: "/dashboard/serenity/stock/LITE",
  },
  {
    id: "NBIS", ticker: "NBIS", label: "NBIS", companyName: "Nebius Group", type: "stock",
    sentiment: "bullish", mentions24h: 5, mentions7d: 32, mentions30d: 88, trendDelta: 17,
    narratives: ["n-neocloud"],
    supplyChainStage: "c-datacenter",
    latestInsight: "欧洲 Neocloud 龙头，H100/H200 扩产 3× 计划明确，EBITDA margin 已转正。",
    targetUrl: "/dashboard/serenity/stock/NBIS",
  },
  {
    id: "IREN", ticker: "IREN", label: "IREN", companyName: "Iris Energy", type: "stock",
    sentiment: "bullish", mentions24h: 4, mentions7d: 25, mentions30d: 79, trendDelta: 11,
    narratives: ["n-neocloud"],
    supplyChainStage: "c-datacenter",
    latestInsight: "比特币矿转型 AI 算力，低电价优势明显，GPU 租用业务毛利率超 70%。",
    targetUrl: "/dashboard/serenity/stock/IREN",
  },
  {
    id: "CRWV", ticker: "CRWV", label: "CRWV", companyName: "CoreWeave", type: "stock",
    sentiment: "bullish", mentions24h: 3, mentions7d: 21, mentions30d: 65, trendDelta: 6,
    narratives: ["n-neocloud"],
    supplyChainStage: "c-datacenter",
    latestInsight: "专注 GPU-as-a-Service，Microsoft 长期协议锁定 60% 产能，IPO 后流动性改善。",
    targetUrl: "/dashboard/serenity/stock/CRWV",
  },
  {
    id: "STRL", ticker: "STRL", label: "STRL", companyName: "Sterling Infrastructure", type: "stock",
    sentiment: "bullish", mentions24h: 3, mentions7d: 18, mentions30d: 58, trendDelta: 25,
    narratives: ["n-power"],
    supplyChainStage: "c-power",
    latestInsight: "数据中心基础建设承包商，电网扩容订单积压创历史新高，FY25 backlog 同比+62%。",
    targetUrl: "/dashboard/serenity/stock/STRL",
  },
  {
    id: "VRT", ticker: "VRT", label: "VRT", companyName: "Vertiv Holdings", type: "stock",
    sentiment: "bullish", mentions24h: 4, mentions7d: 26, mentions30d: 82, trendDelta: 13,
    narratives: ["n-power", "n-cooling"],
    supplyChainStage: "c-power",
    latestInsight: "液冷 + 电源管理双驱动，AI DC 扩建浪潮受益最直接，Q4 订单同比翻倍。",
    targetUrl: "/dashboard/serenity/stock/VRT",
  },
  {
    id: "ETN", ticker: "ETN", label: "ETN", companyName: "Eaton Corp", type: "stock",
    sentiment: "bullish", mentions24h: 2, mentions7d: 15, mentions30d: 49, trendDelta: 7,
    narratives: ["n-power"],
    supplyChainStage: "c-power",
    latestInsight: "电气设备龙头，UPS + PDU 需求随 AI DC 建设同步爆发，分析师目标价上调。",
    targetUrl: "/dashboard/serenity/stock/ETN",
  },
  {
    id: "TSM", ticker: "TSM", label: "TSM", companyName: "TSMC", type: "stock",
    sentiment: "bullish", mentions24h: 5, mentions7d: 30, mentions30d: 112, trendDelta: 10,
    narratives: ["n-asic"],
    supplyChainStage: "c-foundry",
    latestInsight: "N2 量产时间表确认，CoWoS 产能满载至 2026 Q2，AI 相关收入占比超 40%。",
    targetUrl: "/dashboard/serenity/stock/TSM",
  },
  {
    id: "MU", ticker: "MU", label: "MU", companyName: "Micron Tech", type: "stock",
    sentiment: "bullish", mentions24h: 4, mentions7d: 28, mentions30d: 95, trendDelta: 16,
    narratives: ["n-hbm"],
    supplyChainStage: "c-packaging",
    latestInsight: "HBM3E 8-Hi 大规模量产，NVIDIA H200/B200 唯一 HBM 供应商之一，ASP 大幅提升。",
    targetUrl: "/dashboard/serenity/stock/MU",
  },
  {
    id: "ASML", ticker: "ASML", label: "ASML", companyName: "ASML Holding", type: "stock",
    sentiment: "neutral", mentions24h: 2, mentions7d: 12, mentions30d: 41, trendDelta: 2,
    narratives: ["n-asic"],
    supplyChainStage: "c-design",
    latestInsight: "EUV 设备出口管制风险犹存，但 HV-EUV 订单依然强劲，长期护城河无虞。",
    targetUrl: "/dashboard/serenity/stock/ASML",
  },
  {
    id: "ARM", ticker: "ARM", label: "ARM", companyName: "Arm Holdings", type: "stock",
    sentiment: "bullish", mentions24h: 3, mentions7d: 20, mentions30d: 71, trendDelta: 5,
    narratives: ["n-asic"],
    supplyChainStage: "c-design",
    latestInsight: "Cortex-X925 授权费创新高，Neoverse 平台主导 AI 推理芯片设计，版税收入持续上行。",
    targetUrl: "/dashboard/serenity/stock/ARM",
  },
  {
    id: "MXL", ticker: "MXL", label: "MXL", companyName: "MaxLinear", type: "stock",
    sentiment: "bullish", mentions24h: 2, mentions7d: 16, mentions30d: 48, trendDelta: 18,
    narratives: ["n-cpo"],
    supplyChainStage: "c-optical",
    latestInsight: "高速 DSP 芯片进入 CPO 光引擎核心，下半年 800G 出货量预期上调，估值重估空间大。",
    targetUrl: "/dashboard/serenity/stock/MXL",
  },
  {
    id: "INTC", ticker: "INTC", label: "INTC", companyName: "Intel", type: "stock",
    sentiment: "bearish", mentions24h: 2, mentions7d: 11, mentions30d: 38, trendDelta: -4,
    narratives: ["n-asic"],
    supplyChainStage: "c-foundry",
    latestInsight: "晶圆代工转型进展缓慢，18A 量产时间再度推迟，AI GPU 市占率持续被 NVDA/AMD 蚕食。",
    targetUrl: "/dashboard/serenity/stock/INTC",
  },
  {
    id: "AMD", ticker: "AMD", label: "AMD", companyName: "AMD", type: "stock",
    sentiment: "neutral", mentions24h: 2, mentions7d: 13, mentions30d: 44, trendDelta: -2,
    narratives: ["n-asic"],
    supplyChainStage: "c-design",
    latestInsight: "MI300X 在推理端有市场，但 training 端难以撼动 NVDA，下半年指引低于预期。",
    targetUrl: "/dashboard/serenity/stock/AMD",
  },
  {
    id: "SMCI", ticker: "SMCI", label: "SMCI", companyName: "Super Micro", type: "stock",
    sentiment: "neutral", mentions24h: 1, mentions7d: 9, mentions30d: 32, trendDelta: 3,
    narratives: ["n-cooling"],
    supplyChainStage: "c-datacenter",
    latestInsight: "液冷服务器出货量大幅增长，但财报延迟风险仍在，审计师更换令机构持仓谨慎。",
    targetUrl: "/dashboard/serenity/stock/SMCI",
  },
  {
    id: "GFS", ticker: "GFS", label: "GFS", companyName: "GlobalFoundries", type: "stock",
    sentiment: "neutral", mentions24h: 1, mentions7d: 7, mentions30d: 24, trendDelta: 1,
    narratives: ["n-asic"],
    supplyChainStage: "c-foundry",
    latestInsight: "专注特殊制程代工，AI 边缘芯片受益，但先进制程缺席限制估值上限。",
    targetUrl: "/dashboard/serenity/stock/GFS",
  },
  {
    id: "BE", ticker: "BE", label: "BE", companyName: "Bloom Energy", type: "stock",
    sentiment: "bullish", mentions24h: 2, mentions7d: 13, mentions30d: 41, trendDelta: 9,
    narratives: ["n-power"],
    supplyChainStage: "c-power",
    latestInsight: "固态氧化物燃料电池方案获 AI 数据中心备用电源合同，微电网业务加速扩张。",
    targetUrl: "/dashboard/serenity/stock/BE",
  },
  {
    id: "POET", ticker: "POET", label: "POET", companyName: "POET Technologies", type: "stock",
    sentiment: "bearish", mentions24h: 1, mentions7d: 6, mentions30d: 18, trendDelta: -6,
    narratives: ["n-cpo"],
    supplyChainStage: "c-optical",
    latestInsight: "光子平台量产进度延迟，客户验证周期拉长，现金消耗速度引发流动性担忧。",
    targetUrl: "/dashboard/serenity/stock/POET",
  },
];

// ─── Edges ────────────────────────────────────────────────────────────────────
const edges: MapEdge[] = [
  // Stock → Narrative (narrative-belongs)
  { id: "e1",  source: "NVDA", target: "n-neocloud", type: "narrative-belongs", weight: 8, reason: "NVDA GPU 是 Neocloud 基础算力" },
  { id: "e2",  source: "NVDA", target: "n-asic",     type: "narrative-belongs", weight: 6, reason: "NVDA 与 ASIC 叙事形成竞合" },
  { id: "e3",  source: "MRVL", target: "n-cpo",      type: "narrative-belongs", weight: 9, reason: "MRVL CPO 方案量产，核心受益" },
  { id: "e4",  source: "MRVL", target: "n-asic",     type: "narrative-belongs", weight: 7, reason: "MRVL 承接 Google/Amazon ASIC 大单" },
  { id: "e5",  source: "AVGO", target: "n-cpo",      type: "narrative-belongs", weight: 7, reason: "AVGO 光子集成产品线完善" },
  { id: "e6",  source: "AVGO", target: "n-asic",     type: "narrative-belongs", weight: 9, reason: "AVGO XPU 定制芯片份额扩张" },
  { id: "e7",  source: "SIVE", target: "n-cpo",      type: "narrative-belongs", weight: 9, reason: "SIVE 是 CPO 光引擎核心器件供应商" },
  { id: "e8",  source: "COHR", target: "n-cpo",      type: "narrative-belongs", weight: 8, reason: "COHR EML 激光是 CPO 关键光源" },
  { id: "e9",  source: "LITE", target: "n-cpo",      type: "narrative-belongs", weight: 7, reason: "LITE 光源与 COHR 形成双寡头" },
  { id: "e10", source: "NBIS", target: "n-neocloud", type: "narrative-belongs", weight: 9, reason: "NBIS 是欧洲 Neocloud 龙头" },
  { id: "e11", source: "IREN", target: "n-neocloud", type: "narrative-belongs", weight: 8, reason: "IREN 矿场转型 AI 算力" },
  { id: "e12", source: "CRWV", target: "n-neocloud", type: "narrative-belongs", weight: 8, reason: "CRWV GPU-as-a-Service 代表" },
  { id: "e13", source: "MU",   target: "n-hbm",      type: "narrative-belongs", weight: 9, reason: "MU HBM3E 是叙事核心标的" },
  { id: "e14", source: "VRT",  target: "n-power",    type: "narrative-belongs", weight: 8, reason: "VRT 液冷 + 电源管理双受益" },
  { id: "e15", source: "VRT",  target: "n-cooling",  type: "narrative-belongs", weight: 8, reason: "VRT 液冷方案市占率第一" },
  { id: "e16", source: "STRL", target: "n-power",    type: "narrative-belongs", weight: 8, reason: "STRL 数据中心电网基建" },
  { id: "e17", source: "ETN",  target: "n-power",    type: "narrative-belongs", weight: 7, reason: "ETN UPS + PDU 电气设备龙头" },
  { id: "e18", source: "TSM",  target: "n-asic",     type: "narrative-belongs", weight: 8, reason: "TSM 是所有 ASIC 的独家代工" },
  { id: "e19", source: "ARM",  target: "n-asic",     type: "narrative-belongs", weight: 8, reason: "ARM 架构主导 AI 推理 ASIC" },
  { id: "e20", source: "MXL",  target: "n-cpo",      type: "narrative-belongs", weight: 7, reason: "MXL DSP 进入 CPO 光引擎" },
  { id: "e21", source: "SMCI", target: "n-cooling",  type: "narrative-belongs", weight: 7, reason: "SMCI 液冷服务器系统集成" },
  { id: "e22", source: "BE",   target: "n-power",    type: "narrative-belongs", weight: 6, reason: "BE 固态燃料电池备用电源" },
  { id: "e23", source: "POET", target: "n-cpo",      type: "narrative-belongs", weight: 5, reason: "POET 光子平台量产延迟" },
  { id: "e24", source: "INTC", target: "n-asic",     type: "narrative-belongs", weight: 4, reason: "INTC 代工 ASIC 转型进展缓慢" },
  { id: "e25", source: "AMD",  target: "n-asic",     type: "narrative-belongs", weight: 5, reason: "AMD MI300X 推理端有市场" },
  { id: "e26", source: "GFS",  target: "n-asic",     type: "narrative-belongs", weight: 4, reason: "GFS 特殊制程代工 AI 边缘芯片" },

  // Stock → Supply Chain (chain-belongs)
  { id: "e27", source: "NVDA", target: "c-design",     type: "chain-belongs", weight: 9, reason: "NVDA 无晶圆厂芯片设计" },
  { id: "e28", source: "MRVL", target: "c-design",     type: "chain-belongs", weight: 8, reason: "MRVL 网络 + CPO 芯片设计" },
  { id: "e29", source: "MRVL", target: "c-optical",    type: "chain-belongs", weight: 8, reason: "MRVL 集成 CPO 光引擎" },
  { id: "e30", source: "AVGO", target: "c-design",     type: "chain-belongs", weight: 8, reason: "AVGO ASIC + 网络芯片设计" },
  { id: "e31", source: "SIVE", target: "c-optical",    type: "chain-belongs", weight: 9, reason: "SIVE 光学半导体器件" },
  { id: "e32", source: "COHR", target: "c-optical",    type: "chain-belongs", weight: 9, reason: "COHR 激光器件 + 光模块" },
  { id: "e33", source: "LITE", target: "c-optical",    type: "chain-belongs", weight: 8, reason: "LITE 光子集成器件" },
  { id: "e34", source: "MXL",  target: "c-optical",    type: "chain-belongs", weight: 7, reason: "MXL 高速光通信 DSP" },
  { id: "e35", source: "TSM",  target: "c-foundry",    type: "chain-belongs", weight: 9, reason: "TSM 全球最先进晶圆代工" },
  { id: "e36", source: "TSM",  target: "c-packaging",  type: "chain-belongs", weight: 8, reason: "TSM CoWoS/SoIC 先进封装" },
  { id: "e37", source: "MU",   target: "c-packaging",  type: "chain-belongs", weight: 8, reason: "MU HBM 高级封装工艺" },
  { id: "e38", source: "VRT",  target: "c-power",      type: "chain-belongs", weight: 9, reason: "VRT 数据中心供电 + 散热" },
  { id: "e39", source: "STRL", target: "c-power",      type: "chain-belongs", weight: 8, reason: "STRL 电网及基础设施施工" },
  { id: "e40", source: "ETN",  target: "c-power",      type: "chain-belongs", weight: 7, reason: "ETN 电气设备和系统" },
  { id: "e41", source: "ARM",  target: "c-design",     type: "chain-belongs", weight: 8, reason: "ARM 芯片架构 IP 授权" },
  { id: "e42", source: "NBIS", target: "c-datacenter", type: "chain-belongs", weight: 8, reason: "NBIS GPU 云算力服务" },
  { id: "e43", source: "IREN", target: "c-datacenter", type: "chain-belongs", weight: 8, reason: "IREN AI 算力租用" },
  { id: "e44", source: "CRWV", target: "c-datacenter", type: "chain-belongs", weight: 8, reason: "CRWV GPU-as-a-Service" },
  { id: "e45", source: "SMCI", target: "c-datacenter", type: "chain-belongs", weight: 7, reason: "SMCI 服务器系统集成" },

  // Co-mention edges (同一推文共同出现)
  { id: "e46", source: "NVDA", target: "MU",   type: "co-mention", weight: 7, reason: "HBM 叙事中 NVDA + MU 频繁共同提及" },
  { id: "e47", source: "MRVL", target: "COHR", type: "co-mention", weight: 8, reason: "CPO 供应链 MRVL + COHR 搭配分析" },
  { id: "e48", source: "MRVL", target: "AVGO", type: "co-mention", weight: 7, reason: "CPO 竞争格局 MRVL vs AVGO 对比" },
  { id: "e49", source: "MRVL", target: "SIVE", type: "co-mention", weight: 9, reason: "Kova + SemiAnalysis 同时推荐 CPO 组合" },
  { id: "e50", source: "SIVE", target: "COHR", type: "co-mention", weight: 8, reason: "CPO 光引擎 SIVE 器件 + COHR 激光源" },
  { id: "e51", source: "SIVE", target: "LITE", type: "co-mention", weight: 7, reason: "CPO 光源双寡头 COHR / LITE 竞对" },
  { id: "e52", source: "NBIS", target: "IREN", type: "co-mention", weight: 8, reason: "Neocloud 组合 NBIS + IREN 同向分析" },
  { id: "e53", source: "NBIS", target: "CRWV", type: "co-mention", weight: 7, reason: "Kova 多次将 NBIS CRWV 配对讨论" },
  { id: "e54", source: "VRT",  target: "STRL", type: "co-mention", weight: 8, reason: "Power / Grid 叙事双标的" },
  { id: "e55", source: "VRT",  target: "ETN",  type: "co-mention", weight: 7, reason: "Gavin Baker 电力基建组合" },
  { id: "e56", source: "TSM",  target: "ASML", type: "co-mention", weight: 7, reason: "前沿制程设备 + 代工链条分析" },
  { id: "e57", source: "ARM",  target: "NVDA", type: "co-mention", weight: 6, reason: "AI 芯片架构 ARM + NVDA 生态" },
  { id: "e58", source: "MXL",  target: "COHR", type: "co-mention", weight: 7, reason: "CPO 系统 DSP + 光源同框讨论" },
  { id: "e59", source: "INTC", target: "AMD",  type: "co-mention", weight: 6, reason: "传统 x86 竞争格局 bear case" },
  { id: "e60", source: "NVDA", target: "SMCI", type: "co-mention", weight: 5, reason: "企业 AI 服务器系统集成商" },

  // Cross-source (多个博主同时提及)
  { id: "e61", source: "MRVL", target: "SIVE", type: "cross-source", weight: 9, reason: "Kova + SemiAnalysis + Degen 三方同时推荐" },
  { id: "e62", source: "NBIS", target: "CRWV", type: "cross-source", weight: 8, reason: "Kova 频繁配对 Neocloud 双标的" },
  { id: "e63", source: "VRT",  target: "ETN",  type: "cross-source", weight: 7, reason: "Gavin Baker + Kova 电力基建组合" },
];

// ─── Trending (升温节点 mock) ─────────────────────────────────────────────────
export interface TrendingNode {
  ticker: string;
  label: string;
  delta: number; // percentage change in mention rate
  sentiment: Sentiment;
}

export const trendingNodes: TrendingNode[] = [
  { ticker: "SIVE",  label: "SIVE",  delta: 38, sentiment: "bullish" },
  { ticker: "STRL",  label: "STRL",  delta: 25, sentiment: "bullish" },
  { ticker: "MRVL",  label: "MRVL",  delta: 21, sentiment: "bullish" },
  { ticker: "MXL",   label: "MXL",   delta: 18, sentiment: "bullish" },
  { ticker: "MU",    label: "MU",    delta: 16, sentiment: "bullish" },
  { ticker: "POET",  label: "POET",  delta: -6, sentiment: "bearish" },
];

// ─── Narrative heat (叙事热度 mock) ──────────────────────────────────────────
export interface NarrativeHeat {
  id: string;
  label: string;
  heat: number; // 0-100
  delta: number;
}

export const narrativeHeat: NarrativeHeat[] = [
  { id: "n-cpo",      label: "CPO / Photonics",  heat: 92, delta: 14 },
  { id: "n-neocloud", label: "Neocloud",          heat: 85, delta: 8  },
  { id: "n-power",    label: "Power / Grid",      heat: 78, delta: 11 },
  { id: "n-hbm",      label: "HBM / Memory",      heat: 74, delta: 5  },
  { id: "n-asic",     label: "Custom ASIC",        heat: 68, delta: 3  },
  { id: "n-cooling",  label: "DC Cooling",         heat: 55, delta: -2 },
  { id: "n-space",    label: "Space Datacenter",   heat: 32, delta: 1  },
  { id: "n-robotics", label: "Robotics",           heat: 28, delta: 4  },
];

// ─── Full graph data export ───────────────────────────────────────────────────
export const mockGraphData: GraphData = {
  nodes: [...narrativeNodes, ...chainNodes, ...stockNodes],
  edges,
};

export const ALL_NARRATIVES = [
  { id: "n-cpo",      label: "CPO" },
  { id: "n-neocloud", label: "Neocloud" },
  { id: "n-hbm",      label: "HBM" },
  { id: "n-power",    label: "Power" },
  { id: "n-asic",     label: "ASIC" },
  { id: "n-cooling",  label: "Datacenter" },
];
