/**
 * Alpha Map — AI Infra Narrative Network
 * Data types + mock data (easy to swap for a real /api/alpha-map endpoint)
 *
 * mentioned: true  → 博主主动提及，有情绪判断
 * mentioned: false → 叙事背景股，博主未提及，默认中性
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
  trendDelta?: number;
  mentioned?: boolean; // false = 叙事背景股（博主未提及）
}

export interface MapEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  weight: number;
  reason: string;
}

export interface GraphData {
  nodes: MapNode[];
  edges: MapEdge[];
}

// ─── Narrative theme nodes ────────────────────────────────────────────────────
const narrativeNodes: MapNode[] = [
  { id: "n-cpo",      label: "CPO / Photonics",    type: "narrative" },
  { id: "n-neocloud", label: "Neocloud",            type: "narrative" },
  { id: "n-hbm",      label: "HBM / Memory",        type: "narrative" },
  { id: "n-power",    label: "Power / Grid",         type: "narrative" },
  { id: "n-asic",     label: "Custom ASIC",          type: "narrative" },
  { id: "n-cooling",  label: "DC Cooling",           type: "narrative" },
  { id: "n-space",    label: "Space Datacenter",     type: "narrative" },
  { id: "n-robotics", label: "Robotics",             type: "narrative" },
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

// ─── Stocks mentioned by bloggers (mentioned: true) ───────────────────────────
const mentionedStocks: MapNode[] = [
  {
    id: "NVDA", ticker: "NVDA", label: "NVDA", companyName: "NVIDIA", type: "stock",
    sentiment: "bullish", mentions24h: 8, mentions7d: 42, mentions30d: 156, trendDelta: 12,
    narratives: ["n-neocloud", "n-asic"],
    supplyChainStage: "c-design",
    latestInsight: "Blackwell 产能约束缓解，CoWoS 订单超预期，下季度 data-center 收入指引上调。",
    targetUrl: "/dashboard/serenity/stock/NVDA", mentioned: true,
  },
  {
    id: "MRVL", ticker: "MRVL", label: "MRVL", companyName: "Marvell Tech", type: "stock",
    sentiment: "bullish", mentions24h: 6, mentions7d: 38, mentions30d: 124, trendDelta: 21,
    narratives: ["n-cpo", "n-asic"],
    supplyChainStage: "c-design",
    latestInsight: "CPO 方案进入量产阶段，AWS/Google ASIC 大单落地，2026 AI infra 收入预期上调 35%。",
    targetUrl: "/dashboard/serenity/stock/MRVL", mentioned: true,
  },
  {
    id: "AVGO", ticker: "AVGO", label: "AVGO", companyName: "Broadcom", type: "stock",
    sentiment: "bullish", mentions24h: 5, mentions7d: 28, mentions30d: 98, trendDelta: 8,
    narratives: ["n-cpo", "n-asic"],
    supplyChainStage: "c-design",
    latestInsight: "XPU 定制芯片份额持续扩大，三大超大规模云商均是客户，AI ASIC 收入 FY2025 翻倍。",
    targetUrl: "/dashboard/serenity/stock/AVGO", mentioned: true,
  },
  {
    id: "SIVE", ticker: "SIVE", label: "SIVE", companyName: "Sivers Semiconductors", type: "stock",
    sentiment: "bullish", mentions24h: 4, mentions7d: 22, mentions30d: 67, trendDelta: 38,
    narratives: ["n-cpo"],
    supplyChainStage: "c-optical",
    latestInsight: "CPO 光引擎核心供应商，800G/1.6T 需求爆发，与 MRVL 协同验证进展顺利。",
    targetUrl: "/dashboard/serenity/stock/SIVE", mentioned: true,
  },
  {
    id: "COHR", ticker: "COHR", label: "COHR", companyName: "Coherent Corp", type: "stock",
    sentiment: "bullish", mentions24h: 3, mentions7d: 19, mentions30d: 74, trendDelta: 14,
    narratives: ["n-cpo"],
    supplyChainStage: "c-optical",
    latestInsight: "EML 激光芯片拿下 Meta Infra 大单，800G 光模块出货量季增 60%。",
    targetUrl: "/dashboard/serenity/stock/COHR", mentioned: true,
  },
  {
    id: "LITE", ticker: "LITE", label: "LITE", companyName: "Lumentum", type: "stock",
    sentiment: "bullish", mentions24h: 2, mentions7d: 14, mentions30d: 52, trendDelta: 9,
    narratives: ["n-cpo"],
    supplyChainStage: "c-optical",
    latestInsight: "CPO 光源供应商，与 COHR 构成双寡头，2H25 订单能见度优于预期。",
    targetUrl: "/dashboard/serenity/stock/LITE", mentioned: true,
  },
  {
    id: "MXL", ticker: "MXL", label: "MXL", companyName: "MaxLinear", type: "stock",
    sentiment: "bullish", mentions24h: 2, mentions7d: 16, mentions30d: 48, trendDelta: 18,
    narratives: ["n-cpo"],
    supplyChainStage: "c-optical",
    latestInsight: "高速 DSP 芯片进入 CPO 光引擎核心，下半年 800G 出货量预期上调，估值重估空间大。",
    targetUrl: "/dashboard/serenity/stock/MXL", mentioned: true,
  },
  {
    id: "POET", ticker: "POET", label: "POET", companyName: "POET Technologies", type: "stock",
    sentiment: "bearish", mentions24h: 1, mentions7d: 6, mentions30d: 18, trendDelta: -6,
    narratives: ["n-cpo"],
    supplyChainStage: "c-optical",
    latestInsight: "光子平台量产进度延迟，客户验证周期拉长，现金消耗速度引发流动性担忧。",
    targetUrl: "/dashboard/serenity/stock/POET", mentioned: true,
  },
  {
    id: "NBIS", ticker: "NBIS", label: "NBIS", companyName: "Nebius Group", type: "stock",
    sentiment: "bullish", mentions24h: 5, mentions7d: 32, mentions30d: 88, trendDelta: 17,
    narratives: ["n-neocloud"],
    supplyChainStage: "c-datacenter",
    latestInsight: "欧洲 Neocloud 龙头，H100/H200 扩产 3× 计划明确，EBITDA margin 已转正。",
    targetUrl: "/dashboard/serenity/stock/NBIS", mentioned: true,
  },
  {
    id: "IREN", ticker: "IREN", label: "IREN", companyName: "Iris Energy", type: "stock",
    sentiment: "bullish", mentions24h: 4, mentions7d: 25, mentions30d: 79, trendDelta: 11,
    narratives: ["n-neocloud"],
    supplyChainStage: "c-datacenter",
    latestInsight: "比特币矿转型 AI 算力，低电价优势明显，GPU 租用业务毛利率超 70%。",
    targetUrl: "/dashboard/serenity/stock/IREN", mentioned: true,
  },
  {
    id: "CRWV", ticker: "CRWV", label: "CRWV", companyName: "CoreWeave", type: "stock",
    sentiment: "bullish", mentions24h: 3, mentions7d: 21, mentions30d: 65, trendDelta: 6,
    narratives: ["n-neocloud"],
    supplyChainStage: "c-datacenter",
    latestInsight: "专注 GPU-as-a-Service，Microsoft 长期协议锁定 60% 产能，IPO 后流动性改善。",
    targetUrl: "/dashboard/serenity/stock/CRWV", mentioned: true,
  },
  {
    id: "MU", ticker: "MU", label: "MU", companyName: "Micron Tech", type: "stock",
    sentiment: "bullish", mentions24h: 4, mentions7d: 28, mentions30d: 95, trendDelta: 16,
    narratives: ["n-hbm"],
    supplyChainStage: "c-packaging",
    latestInsight: "HBM3E 8-Hi 大规模量产，NVIDIA H200/B200 唯一 HBM 供应商之一，ASP 大幅提升。",
    targetUrl: "/dashboard/serenity/stock/MU", mentioned: true,
  },
  {
    id: "STRL", ticker: "STRL", label: "STRL", companyName: "Sterling Infrastructure", type: "stock",
    sentiment: "bullish", mentions24h: 3, mentions7d: 18, mentions30d: 58, trendDelta: 25,
    narratives: ["n-power"],
    supplyChainStage: "c-power",
    latestInsight: "数据中心基础建设承包商，电网扩容订单积压创历史新高，FY25 backlog 同比+62%。",
    targetUrl: "/dashboard/serenity/stock/STRL", mentioned: true,
  },
  {
    id: "VRT", ticker: "VRT", label: "VRT", companyName: "Vertiv Holdings", type: "stock",
    sentiment: "bullish", mentions24h: 4, mentions7d: 26, mentions30d: 82, trendDelta: 13,
    narratives: ["n-power", "n-cooling"],
    supplyChainStage: "c-power",
    latestInsight: "液冷 + 电源管理双驱动，AI DC 扩建浪潮受益最直接，Q4 订单同比翻倍。",
    targetUrl: "/dashboard/serenity/stock/VRT", mentioned: true,
  },
  {
    id: "ETN", ticker: "ETN", label: "ETN", companyName: "Eaton Corp", type: "stock",
    sentiment: "bullish", mentions24h: 2, mentions7d: 15, mentions30d: 49, trendDelta: 7,
    narratives: ["n-power"],
    supplyChainStage: "c-power",
    latestInsight: "电气设备龙头，UPS + PDU 需求随 AI DC 建设同步爆发，分析师目标价上调。",
    targetUrl: "/dashboard/serenity/stock/ETN", mentioned: true,
  },
  {
    id: "BE", ticker: "BE", label: "BE", companyName: "Bloom Energy", type: "stock",
    sentiment: "bullish", mentions24h: 2, mentions7d: 13, mentions30d: 41, trendDelta: 9,
    narratives: ["n-power"],
    supplyChainStage: "c-power",
    latestInsight: "固态氧化物燃料电池方案获 AI 数据中心备用电源合同，微电网业务加速扩张。",
    targetUrl: "/dashboard/serenity/stock/BE", mentioned: true,
  },
  {
    id: "TSM", ticker: "TSM", label: "TSM", companyName: "TSMC", type: "stock",
    sentiment: "bullish", mentions24h: 5, mentions7d: 30, mentions30d: 112, trendDelta: 10,
    narratives: ["n-asic"],
    supplyChainStage: "c-foundry",
    latestInsight: "N2 量产时间表确认，CoWoS 产能满载至 2026 Q2，AI 相关收入占比超 40%。",
    targetUrl: "/dashboard/serenity/stock/TSM", mentioned: true,
  },
  {
    id: "ARM", ticker: "ARM", label: "ARM", companyName: "Arm Holdings", type: "stock",
    sentiment: "bullish", mentions24h: 3, mentions7d: 20, mentions30d: 71, trendDelta: 5,
    narratives: ["n-asic"],
    supplyChainStage: "c-design",
    latestInsight: "Cortex-X925 授权费创新高，Neoverse 平台主导 AI 推理芯片设计，版税收入持续上行。",
    targetUrl: "/dashboard/serenity/stock/ARM", mentioned: true,
  },
  {
    id: "ASML", ticker: "ASML", label: "ASML", companyName: "ASML Holding", type: "stock",
    sentiment: "neutral", mentions24h: 2, mentions7d: 12, mentions30d: 41, trendDelta: 2,
    narratives: ["n-asic"],
    supplyChainStage: "c-design",
    latestInsight: "EUV 设备出口管制风险犹存，但 HV-EUV 订单依然强劲，长期护城河无虞。",
    targetUrl: "/dashboard/serenity/stock/ASML", mentioned: true,
  },
  {
    id: "INTC", ticker: "INTC", label: "INTC", companyName: "Intel", type: "stock",
    sentiment: "bearish", mentions24h: 2, mentions7d: 11, mentions30d: 38, trendDelta: -4,
    narratives: ["n-asic"],
    supplyChainStage: "c-foundry",
    latestInsight: "晶圆代工转型进展缓慢，18A 量产时间再度推迟，AI GPU 市占率持续被 NVDA/AMD 蚕食。",
    targetUrl: "/dashboard/serenity/stock/INTC", mentioned: true,
  },
  {
    id: "AMD", ticker: "AMD", label: "AMD", companyName: "AMD", type: "stock",
    sentiment: "neutral", mentions24h: 2, mentions7d: 13, mentions30d: 44, trendDelta: -2,
    narratives: ["n-asic"],
    supplyChainStage: "c-design",
    latestInsight: "MI300X 在推理端有市场，但 training 端难以撼动 NVDA，下半年指引低于预期。",
    targetUrl: "/dashboard/serenity/stock/AMD", mentioned: true,
  },
  {
    id: "SMCI", ticker: "SMCI", label: "SMCI", companyName: "Super Micro", type: "stock",
    sentiment: "neutral", mentions24h: 1, mentions7d: 9, mentions30d: 32, trendDelta: 3,
    narratives: ["n-cooling"],
    supplyChainStage: "c-datacenter",
    latestInsight: "液冷服务器出货量大幅增长，但财报延迟风险仍在，审计师更换令机构持仓谨慎。",
    targetUrl: "/dashboard/serenity/stock/SMCI", mentioned: true,
  },
  {
    id: "GFS", ticker: "GFS", label: "GFS", companyName: "GlobalFoundries", type: "stock",
    sentiment: "neutral", mentions24h: 1, mentions7d: 7, mentions30d: 24, trendDelta: 1,
    narratives: ["n-asic"],
    supplyChainStage: "c-foundry",
    latestInsight: "专注特殊制程代工，AI 边缘芯片受益，但先进制程缺席限制估值上限。",
    targetUrl: "/dashboard/serenity/stock/GFS", mentioned: true,
  },
];

// ─── Background stocks (mentioned: false) — 叙事背景龙头，博主未点评，默认中性 ──

// CPO / Photonics
const cpoBg: MapNode[] = [
  {
    id: "CSCO", ticker: "CSCO", label: "CSCO", companyName: "Cisco Systems", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-cpo"], supplyChainStage: "c-optical",
    latestInsight: "全球最大网络设备商，800G 光模块最大采购方之一，CPO 标准制定的主导力量。",
    mentioned: false,
  },
  {
    id: "ANET", ticker: "ANET", label: "ANET", companyName: "Arista Networks", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-cpo"], supplyChainStage: "c-optical",
    latestInsight: "超大规模云厂商首选交换机供应商，400G→800G 升级浪潮核心受益，CPO 整合研发中。",
    mentioned: false,
  },
  {
    id: "VIAV", ticker: "VIAV", label: "VIAV", companyName: "Viavi Solutions", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-cpo"], supplyChainStage: "c-optical",
    latestInsight: "光网络测试与测量设备龙头，CPO 大规模部署必须依赖其校准工具，隐性受益标的。",
    mentioned: false,
  },
  {
    id: "IPGP", ticker: "IPGP", label: "IPGP", companyName: "IPG Photonics", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-cpo"], supplyChainStage: "c-optical",
    latestInsight: "光纤激光器全球市占率超 50%，高功率激光技术向 CPO 光引擎迁移路径清晰。",
    mentioned: false,
  },
];

// Neocloud
const neocloudBg: MapNode[] = [
  {
    id: "EQIX", ticker: "EQIX", label: "EQIX", companyName: "Equinix", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-neocloud"], supplyChainStage: "c-datacenter",
    latestInsight: "全球最大中立数据中心 REIT，AI workload 对高密度机柜需求推动租金与利用率双升。",
    mentioned: false,
  },
  {
    id: "DLR", ticker: "DLR", label: "DLR", companyName: "Digital Realty", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-neocloud"], supplyChainStage: "c-datacenter",
    latestInsight: "全球第二大数据中心 REIT，PlatformDIGITAL 生态系统锁定超大规模租户，AI 需求驱动 ACV 新高。",
    mentioned: false,
  },
  {
    id: "CORZ", ticker: "CORZ", label: "CORZ", companyName: "Core Scientific", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-neocloud"], supplyChainStage: "c-datacenter",
    latestInsight: "比特币矿场转型 HPC/AI 算力，低电价自建设施优势明显，与 CoreWeave 签订长期 HPC 合同。",
    mentioned: false,
  },
  {
    id: "HUT", ticker: "HUT", label: "HUT", companyName: "Hut 8", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-neocloud"], supplyChainStage: "c-datacenter",
    latestInsight: "加拿大 AI 算力基础设施运营商，NVIDIA GPU 集群扩容中，AI cloud 收入占比快速提升。",
    mentioned: false,
  },
  {
    id: "MSFT", ticker: "MSFT", label: "MSFT", companyName: "Microsoft", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-neocloud", "n-asic"], supplyChainStage: "c-datacenter",
    latestInsight: "全球最大云计算 + AI 平台之一，Azure AI 服务高速增长，OpenAI 独家云合作方，Maia ASIC 自研中。",
    mentioned: false,
  },
  {
    id: "AMZN", ticker: "AMZN", label: "AMZN", companyName: "Amazon", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-neocloud", "n-asic"], supplyChainStage: "c-datacenter",
    latestInsight: "AWS 全球最大云平台，Trainium/Inferentia 自研 AI 芯片加速部署，资本支出 2025 年超 1000 亿美元。",
    mentioned: false,
  },
  {
    id: "GOOGL", ticker: "GOOGL", label: "GOOGL", companyName: "Alphabet", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-neocloud", "n-asic"], supplyChainStage: "c-datacenter",
    latestInsight: "GCP + TPU v5 自研 AI 芯片，Gemini 系列模型竞争力回升，AI 搜索广告业务防御性强。",
    mentioned: false,
  },
];

// HBM / Memory
const hbmBg: MapNode[] = [
  {
    id: "LRCX", ticker: "LRCX", label: "LRCX", companyName: "Lam Research", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-hbm"], supplyChainStage: "c-packaging",
    latestInsight: "HBM 制造关键设备供应商，原子层沉积与刻蚀工艺不可替代，每一片 HBM 都需要其设备。",
    mentioned: false,
  },
  {
    id: "AMAT", ticker: "AMAT", label: "AMAT", companyName: "Applied Materials", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-hbm"], supplyChainStage: "c-packaging",
    latestInsight: "全球最大半导体设备商，HBM 堆叠封装与 CMP 工序的核心设备供应方，内存资本支出双向受益。",
    mentioned: false,
  },
  {
    id: "KLAC", ticker: "KLAC", label: "KLAC", companyName: "KLA Corp", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-hbm"], supplyChainStage: "c-packaging",
    latestInsight: "HBM 制程工艺控制与缺陷检测设备龙头，良率压力推动客户持续加大过程控制投入。",
    mentioned: false,
  },
  {
    id: "WDC", ticker: "WDC", label: "WDC", companyName: "Western Digital", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-hbm"], supplyChainStage: "c-packaging",
    latestInsight: "NAND Flash 巨头，存储周期回升受益，AI 数据存储需求驱动企业级 SSD 价量双升。",
    mentioned: false,
  },
  {
    id: "ONTO", ticker: "ONTO", label: "ONTO", companyName: "Onto Innovation", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-hbm"], supplyChainStage: "c-packaging",
    latestInsight: "先进封装检测设备专家，HBM 和 CoWoS 的良率管控对其光学量测工具需求强劲。",
    mentioned: false,
  },
];

// Power / Grid
const powerBg: MapNode[] = [
  {
    id: "PWR", ticker: "PWR", label: "PWR", companyName: "Quanta Services", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-power"], supplyChainStage: "c-power",
    latestInsight: "北美最大电力基础设施承包商，AI 数据中心高压接入和变电站施工订单创历史峰值。",
    mentioned: false,
  },
  {
    id: "GEV", ticker: "GEV", label: "GEV", companyName: "GE Vernova", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-power"], supplyChainStage: "c-power",
    latestInsight: "电力设备巨头，变压器与电网设备交货期延伸至 2027，AI DC 扩容是最大需求驱动。",
    mentioned: false,
  },
  {
    id: "NVT", ticker: "NVT", label: "NVT", companyName: "nVent Electric", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-power", "n-cooling"], supplyChainStage: "c-power",
    latestInsight: "数据中心热管理与电气保护设备，液冷机架封装解决方案进入超大规模部署阶段。",
    mentioned: false,
  },
  {
    id: "POWL", ticker: "POWL", label: "POWL", companyName: "Powell Industries", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-power"], supplyChainStage: "c-power",
    latestInsight: "中压开关设备细分市场领导者，AI 数据中心电力分配系统订单积压 2 年以上。",
    mentioned: false,
  },
  {
    id: "HUBB", ticker: "HUBB", label: "HUBB", companyName: "Hubbell", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-power"], supplyChainStage: "c-power",
    latestInsight: "电气基础设施连接器与配电设备，数据中心与电网现代化是增长的双引擎。",
    mentioned: false,
  },
];

// Custom ASIC
const asicBg: MapNode[] = [
  {
    id: "QCOM", ticker: "QCOM", label: "QCOM", companyName: "Qualcomm", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-asic"], supplyChainStage: "c-design",
    latestInsight: "Snapdragon 边缘 AI 芯片市场领导者，端侧推理需求爆发打开新市场，PC/汽车 AI 双线扩张。",
    mentioned: false,
  },
  {
    id: "MPWR", ticker: "MPWR", label: "MPWR", companyName: "Monolithic Power", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-asic", "n-power"], supplyChainStage: "c-design",
    latestInsight: "AI GPU 供电电源管理芯片核心供应商，NVDA GB200 电源方案 MPWR 深度绑定，ASP 大幅提升。",
    mentioned: false,
  },
  {
    id: "META", ticker: "META", label: "META", companyName: "Meta Platforms", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-asic", "n-neocloud"], supplyChainStage: "c-datacenter",
    latestInsight: "MTIA 自研 AI 推理芯片持续迭代，2025 年资本支出指引 600-650 亿美元，Llama 系列开源生态最大受益方。",
    mentioned: false,
  },
  {
    id: "MCHP", ticker: "MCHP", label: "MCHP", companyName: "Microchip Technology", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-asic"], supplyChainStage: "c-design",
    latestInsight: "混合信号与嵌入式控制 MCU/FPGA 龙头，AI 边缘控制器和汽车电子双核驱动，库存调整接近尾声。",
    mentioned: false,
  },
  {
    id: "NXPI", ticker: "NXPI", label: "NXPI", companyName: "NXP Semiconductors", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-asic"], supplyChainStage: "c-design",
    latestInsight: "汽车 + 工业 ASIC 全球第一，ADAS 与机器人末端执行器对其 i.MX 系列芯片需求快速增长。",
    mentioned: false,
  },
];

// DC Cooling
const coolingBg: MapNode[] = [
  {
    id: "JCI", ticker: "JCI", label: "JCI", companyName: "Johnson Controls", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-cooling"], supplyChainStage: "c-datacenter",
    latestInsight: "全球最大建筑自动化与 HVAC 系统公司，数据中心精密空调和楼宇节能管理的主要供应商。",
    mentioned: false,
  },
  {
    id: "TT", ticker: "TT", label: "TT", companyName: "Trane Technologies", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-cooling"], supplyChainStage: "c-datacenter",
    latestInsight: "HVAC 行业头部玩家，AI 数据中心冷冻水机组和精密空调需求激增，订单能见度超 18 个月。",
    mentioned: false,
  },
  {
    id: "CARR", ticker: "CARR", label: "CARR", companyName: "Carrier Global", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-cooling"], supplyChainStage: "c-datacenter",
    latestInsight: "收购 Viessmann 后成为全球最大气候控制公司，数据中心液冷解决方案布局完整。",
    mentioned: false,
  },
  {
    id: "APH", ticker: "APH", label: "APH", companyName: "Amphenol", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-cooling", "n-cpo"], supplyChainStage: "c-datacenter",
    latestInsight: "高速连接器与液冷热管理接头核心供应商，AI 服务器密度提升直接拉动连接器单价和用量。",
    mentioned: false,
  },
];

// Robotics
const roboticsBg: MapNode[] = [
  {
    id: "TSLA", ticker: "TSLA", label: "TSLA", companyName: "Tesla", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-robotics"], supplyChainStage: "c-ai",
    latestInsight: "Optimus 人形机器人 2025 年工厂量产在即，AI 训练数据积累规模最大，FSD 技术向 Optimus 迁移。",
    mentioned: false,
  },
  {
    id: "ISRG", ticker: "ISRG", label: "ISRG", companyName: "Intuitive Surgical", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-robotics"], supplyChainStage: "c-ai",
    latestInsight: "手术机器人市场绝对龙头，da Vinci 系统全球装机超 9000 台，耗材与服务收入提供稳定现金流。",
    mentioned: false,
  },
  {
    id: "ROK", ticker: "ROK", label: "ROK", companyName: "Rockwell Automation", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-robotics"], supplyChainStage: "c-ai",
    latestInsight: "工业自动化 + PLC 控制系统龙头，AI 驱动的工厂数字化转型浪潮核心受益标的。",
    mentioned: false,
  },
  {
    id: "CGNX", ticker: "CGNX", label: "CGNX", companyName: "Cognex", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-robotics"], supplyChainStage: "c-ai",
    latestInsight: "机器视觉系统全球市占率超 30%，AI 机器视觉升级将所有产线检测系统替换为高价智能相机。",
    mentioned: false,
  },
  {
    id: "TER", ticker: "TER", label: "TER", companyName: "Teradyne", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-robotics"], supplyChainStage: "c-ai",
    latestInsight: "Universal Robots 协作机器人母公司，半导体测试设备 + 协作机器人双主业，AI 芯片测试需求持续旺盛。",
    mentioned: false,
  },
  {
    id: "PATH", ticker: "PATH", label: "PATH", companyName: "UiPath", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-robotics"], supplyChainStage: "c-ai",
    latestInsight: "RPA 软件机器人龙头，Agentic AI 转型加速，企业自动化渗透率提升带来 ARR 持续增长。",
    mentioned: false,
  },
];

// Space Datacenter
const spaceBg: MapNode[] = [
  {
    id: "RKLB", ticker: "RKLB", label: "RKLB", companyName: "Rocket Lab", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-space"], supplyChainStage: "c-datacenter",
    latestInsight: "小型卫星发射频率最高的私人公司，Neutron 中型火箭开发加速，太空数据基础设施建设受益方。",
    mentioned: false,
  },
  {
    id: "ASTS", ticker: "ASTS", label: "ASTS", companyName: "AST SpaceMobile", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-space"], supplyChainStage: "c-datacenter",
    latestInsight: "直连手机的宽带卫星星座，BlueBird Block 2 开始部署，AT&T/Verizon 合作验证商业模式可行性。",
    mentioned: false,
  },
  {
    id: "LUNR", ticker: "LUNR", label: "LUNR", companyName: "Intuitive Machines", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-space"], supplyChainStage: "c-datacenter",
    latestInsight: "NASA 月球商业服务合同执行方，月球中继通信基础设施建设者，空间数据中心概念早期布局。",
    mentioned: false,
  },
  {
    id: "LMT", ticker: "LMT", label: "LMT", companyName: "Lockheed Martin", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-space"], supplyChainStage: "c-datacenter",
    latestInsight: "美国最大国防承包商，卫星与太空基础设施领域数十年经验，政府太空数据中心合同重要受益方。",
    mentioned: false,
  },
  {
    id: "NOC", ticker: "NOC", label: "NOC", companyName: "Northrop Grumman", type: "stock",
    sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, trendDelta: 0,
    narratives: ["n-space"], supplyChainStage: "c-datacenter",
    latestInsight: "Space Systems 部门承担多项国家安全太空任务，天基 AI 计算节点技术储备深厚。",
    mentioned: false,
  },
];

const backgroundStocks: MapNode[] = [
  ...cpoBg, ...neocloudBg, ...hbmBg, ...powerBg,
  ...asicBg, ...coolingBg, ...roboticsBg, ...spaceBg,
];

// ─── Edges ────────────────────────────────────────────────────────────────────

// Helper to auto-generate narrative + chain edges for background stocks
function bgEdges(stocks: MapNode[], startId: number): MapEdge[] {
  const result: MapEdge[] = [];
  let i = startId;
  for (const s of stocks) {
    for (const n of (s.narratives ?? [])) {
      result.push({ id: `eb${i++}`, source: s.id, target: n, type: "narrative-belongs", weight: 5, reason: `${s.companyName} 是 ${n} 叙事头部标的` });
    }
    if (s.supplyChainStage) {
      result.push({ id: `eb${i++}`, source: s.id, target: s.supplyChainStage, type: "chain-belongs", weight: 5, reason: `${s.companyName} 属于 ${s.supplyChainStage} 产业链环节` });
    }
  }
  return result;
}

const mentionedEdges: MapEdge[] = [
  // Stock → Narrative
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

  // Stock → Supply Chain
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

  // Co-mention
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

  // Cross-source
  { id: "e61", source: "MRVL", target: "SIVE", type: "cross-source", weight: 9, reason: "Kova + SemiAnalysis + Degen 三方同时推荐" },
  { id: "e62", source: "NBIS", target: "CRWV", type: "cross-source", weight: 8, reason: "Kova 频繁配对 Neocloud 双标的" },
  { id: "e63", source: "VRT",  target: "ETN",  type: "cross-source", weight: 7, reason: "Gavin Baker + Kova 电力基建组合" },
];

const backgroundEdges = bgEdges(backgroundStocks, 100);

// ─── Trending & Narrative Heat ────────────────────────────────────────────────
export interface TrendingNode {
  ticker: string;
  label: string;
  delta: number;
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

export interface NarrativeHeat {
  id: string;
  label: string;
  heat: number;
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
  nodes: [...narrativeNodes, ...chainNodes, ...mentionedStocks, ...backgroundStocks],
  edges: [...mentionedEdges, ...backgroundEdges],
};

export const ALL_NARRATIVES = [
  { id: "n-cpo",      label: "CPO" },
  { id: "n-neocloud", label: "Neocloud" },
  { id: "n-hbm",      label: "HBM" },
  { id: "n-power",    label: "Power" },
  { id: "n-asic",     label: "ASIC" },
  { id: "n-cooling",  label: "Datacenter" },
  { id: "n-robotics", label: "Robotics" },
  { id: "n-space",    label: "Space" },
];
