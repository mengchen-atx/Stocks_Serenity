export type Sentiment = "bullish" | "bearish" | "neutral";
export type ViewMode = "heat" | "sentiment" | "source";
export type TimeRange = "24h" | "7d" | "30d";

export interface Stage {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  stageIndex: number;
  accentColor: string;
}

export interface Company {
  id: string; // ticker_stageId
  ticker: string;
  name: string;
  nameZh?: string;
  stageId: string;
  heat: number;       // 0–100 editorial heat score (social signal strength)
  sentiment: Sentiment; // editorial sentiment based on KOL signals
  mentions24h: number;
  mentions7d: number;
  mentions30d: number;
  // delta24h / delta7d are REMOVED — real price data comes from /api/supply-chain/quotes
  narratives: string[];
  latestInsight: string;
  sources: string[];
}

export const STAGES: Stage[] = [
  { id: "raw-materials",        name: "原材料",      nameEn: "Raw Materials",         description: "特种气体、化学品、金属、稀土", stageIndex: 0, accentColor: "#78350f" },
  { id: "wafer-substrate",      name: "衬底/晶圆",   nameEn: "Wafer & Substrate",     description: "Si/SiC衬底、外延片、晶圆制造", stageIndex: 1, accentColor: "#1e3a5f" },
  { id: "chip-design",          name: "芯片设计",    nameEn: "Chip Design",           description: "GPU/CPU/ASIC/DSP IP 设计",     stageIndex: 2, accentColor: "#4c1d95" },
  { id: "foundry",              name: "晶圆代工",    nameEn: "Foundry",               description: "先进/成熟制程晶圆代工",         stageIndex: 3, accentColor: "#164e63" },
  { id: "packaging-test",       name: "封装测试",    nameEn: "Packaging & Test",      description: "CoWoS/HBM/SoIC 先进封装",      stageIndex: 4, accentColor: "#14532d" },
  { id: "optical-interconnect", name: "光学互联",    nameEn: "Optical Interconnect",  description: "CPO/800G硅光/EML激光器",       stageIndex: 5, accentColor: "#1e40af" },
  { id: "network-equipment",    name: "网络设备",    nameEn: "Network Equipment",     description: "交换机/路由器/SDN 骨干网",      stageIndex: 6, accentColor: "#374151" },
  { id: "server-systems",       name: "服务器整机",  nameEn: "Server Systems",        description: "AI服务器/存储/ODM 整机",        stageIndex: 7, accentColor: "#44403c" },
  { id: "data-center",          name: "数据中心",    nameEn: "Data Center",           description: "算力租赁/供电/散热/基建",       stageIndex: 8, accentColor: "#581c87" },
  { id: "ai-software",          name: "AI软件/模型", nameEn: "AI Software & Models",  description: "大模型/推理平台/AI应用",        stageIndex: 9, accentColor: "#9d174d" },
];

// ── Raw Materials ─────────────────────────────────────────────────────────────
const rawMaterials: Company[] = [
  { id: "ENTG_raw-materials", ticker: "ENTG", name: "Entegris", nameZh: "安特里斯", stageId: "raw-materials", heat: 62, sentiment: "bullish", mentions24h: 8, mentions7d: 45, mentions30d: 142, narratives: ["HBM/Memory", "Advanced Packaging"], latestInsight: "HBM3E高纯化学品需求拉动，Q4指引超预期", sources: ["Kova", "SemiAnalysis"] },
  { id: "ALB_raw-materials",  ticker: "ALB",  name: "Albemarle", nameZh: "雅宝", stageId: "raw-materials", heat: 34, sentiment: "bearish", mentions24h: 4, mentions7d: 18, mentions30d: 67, narratives: [], latestInsight: "锂价持续低迷，AI服务器用锂需求暂未规模化", sources: ["Serenity"] },
  { id: "APD_raw-materials",  ticker: "APD",  name: "Air Products", nameZh: "空气产品", stageId: "raw-materials", heat: 51, sentiment: "neutral", mentions24h: 5, mentions7d: 28, mentions30d: 89, narratives: ["Power/Grid"], latestInsight: "半导体特气合同续签，氢能拖累估值压缩", sources: ["Serenity"] },
  { id: "LIN_raw-materials",  ticker: "LIN",  name: "Linde", nameZh: "林德", stageId: "raw-materials", heat: 55, sentiment: "neutral", mentions24h: 6, mentions7d: 32, mentions30d: 104, narratives: [], latestInsight: "半导体晶圆特气市占超60%，受益台积电扩产", sources: ["SemiAnalysis"] },
  { id: "FCX_raw-materials",  ticker: "FCX",  name: "Freeport-McMoRan", nameZh: "自由港", stageId: "raw-materials", heat: 48, sentiment: "neutral", mentions24h: 7, mentions7d: 35, mentions30d: 118, narratives: ["Power/Grid"], latestInsight: "AI数据中心铜需求带动，供给端矿产资本开支滞后", sources: ["Serenity", "Kova"] },
  { id: "MP_raw-materials",   ticker: "MP",   name: "MP Materials", nameZh: "MP材料", stageId: "raw-materials", heat: 44, sentiment: "neutral", mentions24h: 3, mentions7d: 16, mentions30d: 52, narratives: ["Robotics"], latestInsight: "稀土永磁主供机器人驱动电机，关税政策边际利好", sources: ["Kova"] },
  { id: "SCCO_raw-materials", ticker: "SCCO", name: "Southern Copper", nameZh: "南方铜业", stageId: "raw-materials", heat: 40, sentiment: "neutral", mentions24h: 3, mentions7d: 14, mentions30d: 55, narratives: ["Power/Grid"], latestInsight: "铜产量拉丁美洲第一，受益数据中心基建铜需", sources: ["Serenity"] },
  { id: "AZTA_raw-materials", ticker: "AZTA", name: "Azenta", nameZh: "阿森塔", stageId: "raw-materials", heat: 38, sentiment: "neutral", mentions24h: 2, mentions7d: 12, mentions30d: 44, narratives: [], latestInsight: "晶圆传送/储存系统，布局前段材料控制", sources: ["SemiAnalysis"] },
];

// ── Wafer & Substrate ─────────────────────────────────────────────────────────
const waferSubstrate: Company[] = [
  { id: "WOLF_wafer-substrate", ticker: "WOLF", name: "Wolfspeed", nameZh: "沃夫斯比德", stageId: "wafer-substrate", heat: 42, sentiment: "bearish", mentions24h: 6, mentions7d: 28, mentions30d: 95, narratives: ["Power/Grid"], latestInsight: "SiC晶圆产能爬坡慢于预期，融资压力较大", sources: ["Serenity", "Kova"] },
  { id: "COHR_wafer-substrate", ticker: "COHR", name: "Coherent (SiC)", nameZh: "相干", stageId: "wafer-substrate", heat: 65, sentiment: "bullish", mentions24h: 12, mentions7d: 68, mentions30d: 218, narratives: ["CPO/Photonics"], latestInsight: "SiC衬底+光学基板双布局，产线利用率持续提升", sources: ["SemiAnalysis"] },
  { id: "IPGP_wafer-substrate", ticker: "IPGP", name: "IPG Photonics", nameZh: "IPG光子", stageId: "wafer-substrate", heat: 45, sentiment: "neutral", mentions24h: 4, mentions7d: 22, mentions30d: 74, narratives: ["CPO/Photonics"], latestInsight: "高功率激光器用于晶圆切割，SiC加工需求上行", sources: ["Serenity"] },
  { id: "MKSI_wafer-substrate", ticker: "MKSI", name: "MKS Instruments", nameZh: "MKS仪器", stageId: "wafer-substrate", heat: 53, sentiment: "bullish", mentions24h: 6, mentions7d: 34, mentions30d: 108, narratives: [], latestInsight: "刻蚀/沉积气体控制，AI芯片工艺节点受益", sources: ["SemiAnalysis"] },
  { id: "ONTO_wafer-substrate", ticker: "ONTO", name: "Onto Innovation", nameZh: "Onto", stageId: "wafer-substrate", heat: 57, sentiment: "bullish", mentions24h: 7, mentions7d: 38, mentions30d: 122, narratives: ["HBM/Memory"], latestInsight: "HBM叠层检测设备，台积电/SK Hynix双供货", sources: ["SemiAnalysis"] },
  { id: "FORM_wafer-substrate", ticker: "FORM", name: "FormFactor", nameZh: "福美可", stageId: "wafer-substrate", heat: 49, sentiment: "neutral", mentions24h: 5, mentions7d: 25, mentions30d: 82, narratives: [], latestInsight: "先进探针卡，AI晶圆测试需求增长", sources: ["SemiAnalysis"] },
  { id: "ACLS_wafer-substrate", ticker: "ACLS", name: "Axcelis Technologies", nameZh: "Axcelis", stageId: "wafer-substrate", heat: 55, sentiment: "bullish", mentions24h: 7, mentions7d: 40, mentions30d: 128, narratives: [], latestInsight: "离子注入设备，SiC功率器件渗透率提升", sources: ["SemiAnalysis"] },
];

// ── Chip Design ───────────────────────────────────────────────────────────────
const chipDesign: Company[] = [
  { id: "NVDA_chip-design", ticker: "NVDA", name: "NVIDIA", nameZh: "英伟达", stageId: "chip-design", heat: 98, sentiment: "bullish", mentions24h: 65, mentions7d: 380, mentions30d: 1240, narratives: ["CPO/Photonics", "Neocloud", "HBM/Memory", "Custom ASIC"], latestInsight: "Blackwell供不应求，GB200 NVL72机架订单能见度至2026H2，CUDA护城河加宽", sources: ["Serenity", "Kova", "SemiAnalysis", "Gavin Baker"] },
  { id: "AVGO_chip-design", ticker: "AVGO", name: "Broadcom", nameZh: "博通", stageId: "chip-design", heat: 88, sentiment: "bullish", mentions24h: 42, mentions7d: 248, mentions30d: 790, narratives: ["Custom ASIC", "CPO/Photonics"], latestInsight: "XPU定制ASIC管线：Meta/Google/Apple，2027 TAM $60-90B更新超预期", sources: ["Serenity", "Kova", "SemiAnalysis", "Gavin Baker"] },
  { id: "MU_chip-design",   ticker: "MU",   name: "Micron", nameZh: "美光", stageId: "chip-design", heat: 85, sentiment: "bullish", mentions24h: 35, mentions7d: 210, mentions30d: 675, narratives: ["HBM/Memory"], latestInsight: "HBM3E份额超越SK Hynix，Q3 DRAM ASP同比+40%", sources: ["Serenity", "Kova", "SemiAnalysis"] },
  { id: "MRVL_chip-design", ticker: "MRVL", name: "Marvell", nameZh: "迈威尔", stageId: "chip-design", heat: 82, sentiment: "bullish", mentions24h: 32, mentions7d: 190, mentions30d: 608, narratives: ["Custom ASIC", "CPO/Photonics"], latestInsight: "DSP+光引擎+ASIC全栈，Amazon AWS自研芯片最大份额供应商", sources: ["Serenity", "SemiAnalysis", "Gavin Baker"] },
  { id: "ASML_chip-design", ticker: "ASML", name: "ASML", nameZh: "阿斯麦", stageId: "chip-design", heat: 79, sentiment: "bullish", mentions24h: 24, mentions7d: 142, mentions30d: 458, narratives: [], latestInsight: "EUV/High-NA出货加速，2025-2026订单能见度强劲", sources: ["Serenity", "SemiAnalysis"] },
  { id: "ARM_chip-design",  ticker: "ARM",  name: "Arm Holdings", nameZh: "ARM", stageId: "chip-design", heat: 76, sentiment: "bullish", mentions24h: 22, mentions7d: 128, mentions30d: 412, narratives: ["Custom ASIC"], latestInsight: "CSS平台+AI扩展许可，Compute Subsystem V版本提速ASIC定制", sources: ["Serenity", "Kova", "Gavin Baker"] },
  { id: "AMD_chip-design",  ticker: "AMD",  name: "AMD", nameZh: "超微半导体", stageId: "chip-design", heat: 72, sentiment: "bullish", mentions24h: 28, mentions7d: 165, mentions30d: 520, narratives: ["HBM/Memory", "Neocloud"], latestInsight: "MI300X/MI325X在Neocloud客户中份额扩大，CPU EPYC强劲", sources: ["Serenity", "Kova", "Gavin Baker"] },
  { id: "MPWR_chip-design", ticker: "MPWR", name: "Monolithic Power", nameZh: "单片电源", stageId: "chip-design", heat: 68, sentiment: "bullish", mentions24h: 15, mentions7d: 88, mentions30d: 280, narratives: ["Power/Grid"], latestInsight: "AI服务器VR/PMIC渗透率提升，NVDA Blackwell配套", sources: ["Serenity", "Kova"] },
  { id: "QCOM_chip-design", ticker: "QCOM", name: "Qualcomm", nameZh: "高通", stageId: "chip-design", heat: 61, sentiment: "bullish", mentions24h: 14, mentions7d: 78, mentions30d: 248, narratives: [], latestInsight: "Snapdragon X Elite NPU端侧AI，PC/汽车市场份额扩张", sources: ["Serenity"] },
  { id: "MXL_chip-design",  ticker: "MXL",  name: "MaxLinear", nameZh: "麦斯线性", stageId: "chip-design", heat: 58, sentiment: "bullish", mentions24h: 10, mentions7d: 55, mentions30d: 178, narratives: ["CPO/Photonics"], latestInsight: "PAM4 DSP+驱动IC，800G/1.6T光模块高速增长窗口", sources: ["SemiAnalysis", "Serenity"] },
  { id: "SMTC_chip-design", ticker: "SMTC", name: "Semtech", nameZh: "新科浦", stageId: "chip-design", heat: 52, sentiment: "neutral", mentions24h: 7, mentions7d: 38, mentions30d: 124, narratives: ["CPO/Photonics"], latestInsight: "ClearEdge DSP搭载400G PAM4，光模块基带渗透", sources: ["SemiAnalysis"] },
  { id: "INTC_chip-design", ticker: "INTC", name: "Intel", nameZh: "英特尔", stageId: "chip-design", heat: 48, sentiment: "bearish", mentions24h: 12, mentions7d: 65, mentions30d: 210, narratives: [], latestInsight: "Gaudi3 AI加速器市占率低迷，Intel 18A制程风险仍大", sources: ["Serenity", "Kova"] },
  { id: "MCHP_chip-design", ticker: "MCHP", name: "Microchip Technology", nameZh: "微芯科技", stageId: "chip-design", heat: 44, sentiment: "neutral", mentions24h: 8, mentions7d: 42, mentions30d: 138, narratives: [], latestInsight: "工业MCU，AI边缘控制器渗透率慢", sources: ["Serenity"] },
  { id: "NXPI_chip-design", ticker: "NXPI", name: "NXP Semiconductors", nameZh: "恩智浦", stageId: "chip-design", heat: 42, sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, narratives: ["Custom ASIC"], latestInsight: "汽车/工业边缘AI芯片，S32 ADAS平台，端侧推理渗透", sources: ["Serenity"] },
  { id: "ON_chip-design",   ticker: "ON",   name: "Onsemi", nameZh: "安森美", stageId: "chip-design", heat: 47, sentiment: "neutral", mentions24h: 6, mentions7d: 32, mentions30d: 105, narratives: ["Power/Grid"], latestInsight: "SiC MOSFET数据中心应用，EliteSiC拓展AI电源市场", sources: ["Serenity"] },
  { id: "SLAB_chip-design", ticker: "SLAB", name: "Silicon Labs", nameZh: "硅实验室", stageId: "chip-design", heat: 36, sentiment: "neutral", mentions24h: 3, mentions7d: 15, mentions30d: 52, narratives: [], latestInsight: "IoT/工业AI MCU，专注低功耗边缘推理", sources: ["Serenity"] },
];

// ── Foundry ───────────────────────────────────────────────────────────────────
const foundry: Company[] = [
  { id: "TSM_foundry",  ticker: "TSM",  name: "TSMC", nameZh: "台积电", stageId: "foundry", heat: 91, sentiment: "bullish", mentions24h: 48, mentions7d: 280, mentions30d: 890, narratives: ["Custom ASIC", "HBM/Memory"], latestInsight: "N2满产时间表提前，CoWoS产能扩建×3，2nm AI芯片独家代工优势", sources: ["Serenity", "Kova", "SemiAnalysis", "Gavin Baker"] },
  { id: "AMAT_foundry", ticker: "AMAT", name: "Applied Materials", nameZh: "应用材料", stageId: "foundry", heat: 73, sentiment: "bullish", mentions24h: 20, mentions7d: 118, mentions30d: 378, narratives: [], latestInsight: "ICAPS+先进制程设备双驱动，AI代工扩产最大受益者之一", sources: ["SemiAnalysis", "Serenity"] },
  { id: "LRCX_foundry", ticker: "LRCX", name: "Lam Research", nameZh: "泛林", stageId: "foundry", heat: 70, sentiment: "bullish", mentions24h: 18, mentions7d: 105, mentions30d: 340, narratives: [], latestInsight: "HARC刻蚀+ALD沉积设备，高带宽存储制程关键", sources: ["SemiAnalysis"] },
  { id: "KLAC_foundry", ticker: "KLAC", name: "KLA Corp", nameZh: "科磊", stageId: "foundry", heat: 68, sentiment: "bullish", mentions24h: 15, mentions7d: 88, mentions30d: 282, narratives: [], latestInsight: "量测检测设备随制程节点微缩需求增倍", sources: ["SemiAnalysis"] },
  { id: "GFS_foundry",  ticker: "GFS",  name: "GlobalFoundries", nameZh: "格芯", stageId: "foundry", heat: 45, sentiment: "neutral", mentions24h: 8, mentions7d: 42, mentions30d: 138, narratives: [], latestInsight: "成熟制程受益美国本土化政策，8/12英寸混合订单稳定", sources: ["Serenity"] },
  { id: "UMC_foundry",  ticker: "UMC",  name: "UMC", nameZh: "联华电子", stageId: "foundry", heat: 41, sentiment: "neutral", mentions24h: 5, mentions7d: 28, mentions30d: 92, narratives: [], latestInsight: "22/28nm成熟制程，模拟芯片及电源管理稳定受益", sources: ["SemiAnalysis"] },
];

// ── Packaging & Test ──────────────────────────────────────────────────────────
const packagingTest: Company[] = [
  { id: "ATEYY_packaging-test", ticker: "ATEYY", name: "Advantest", nameZh: "爱德万", stageId: "packaging-test", heat: 72, sentiment: "bullish", mentions24h: 16, mentions7d: 94, mentions30d: 302, narratives: ["HBM/Memory"], latestInsight: "V93000 AI芯片测试主力平台，HBM测试市占超70%", sources: ["SemiAnalysis", "Serenity"] },
  { id: "AMKR_packaging-test", ticker: "AMKR", name: "Amkor Technology", nameZh: "安靠科技", stageId: "packaging-test", heat: 68, sentiment: "bullish", mentions24h: 14, mentions7d: 82, mentions30d: 265, narratives: ["HBM/Memory", "Custom ASIC"], latestInsight: "3D SiP/FOPLP量产，AI手机+PC封装订单能见度至2026", sources: ["SemiAnalysis", "Serenity"] },
  { id: "ASX_packaging-test",  ticker: "ASX",  name: "ASE Technology", nameZh: "日月光", stageId: "packaging-test", heat: 63, sentiment: "bullish", mentions24h: 10, mentions7d: 58, mentions30d: 188, narratives: ["Custom ASIC"], latestInsight: "VIPkg协作台积电CoWoS，高端AI封装扩产", sources: ["SemiAnalysis"] },
  { id: "TER_packaging-test",  ticker: "TER",  name: "Teradyne", nameZh: "泰瑞达", stageId: "packaging-test", heat: 66, sentiment: "bullish", mentions24h: 12, mentions7d: 68, mentions30d: 220, narratives: ["HBM/Memory"], latestInsight: "HBM测试周期增长，AI芯片验证需求推高测试时间", sources: ["SemiAnalysis", "Kova"] },
  { id: "KLIC_packaging-test", ticker: "KLIC", name: "Kulicke & Soffa", nameZh: "科利克索法", stageId: "packaging-test", heat: 54, sentiment: "bullish", mentions24h: 8, mentions7d: 45, mentions30d: 148, narratives: [], latestInsight: "铜线键合+混合键合设备，先进封装迁移受益", sources: ["SemiAnalysis"] },
  { id: "COHU_packaging-test", ticker: "COHU", name: "Cohu", nameZh: "Cohu", stageId: "packaging-test", heat: 48, sentiment: "neutral", mentions24h: 5, mentions7d: 28, mentions30d: 92, narratives: [], latestInsight: "SoC/内存测试设备，中端市场稳定增长", sources: ["Serenity"] },
  { id: "ONTO_packaging-test", ticker: "ONTO", name: "Onto Innovation", nameZh: "Onto", stageId: "packaging-test", heat: 59, sentiment: "bullish", mentions24h: 8, mentions7d: 44, mentions30d: 142, narratives: [], latestInsight: "键合后检测及量测，CoWoS良率控制关键", sources: ["SemiAnalysis"] },
  { id: "FORM_packaging-test", ticker: "FORM", name: "FormFactor", nameZh: "FormFactor", stageId: "packaging-test", heat: 52, sentiment: "neutral", mentions24h: 6, mentions7d: 32, mentions30d: 108, narratives: [], latestInsight: "3D堆叠探针卡，芯片间互联测试", sources: ["SemiAnalysis"] },
];

// ── Optical Interconnect ──────────────────────────────────────────────────────
const opticalInterconnect: Company[] = [
  { id: "COHR_optical-interconnect", ticker: "COHR", name: "Coherent", nameZh: "相干", stageId: "optical-interconnect", heat: 81, sentiment: "bullish", mentions24h: 20, mentions7d: 115, mentions30d: 368, narratives: ["CPO/Photonics"], latestInsight: "800G/1.6T硅光集成，CPO量产路线图明确，超预期放量", sources: ["Serenity", "SemiAnalysis", "Kova"] },
  { id: "LITE_optical-interconnect", ticker: "LITE", name: "Lumentum", nameZh: "Lumentum", stageId: "optical-interconnect", heat: 74, sentiment: "bullish", mentions24h: 16, mentions7d: 92, mentions30d: 296, narratives: ["CPO/Photonics"], latestInsight: "EML激光器+VCSEL大客户收入可见度强，800G需求超供给", sources: ["Serenity", "SemiAnalysis"] },
  { id: "MRVL_optical-interconnect", ticker: "MRVL", name: "Marvell (DSP)", nameZh: "迈威尔", stageId: "optical-interconnect", heat: 76, sentiment: "bullish", mentions24h: 18, mentions7d: 108, mentions30d: 348, narratives: ["CPO/Photonics"], latestInsight: "光DSP +硅光引擎，CPO核心芯片供应商", sources: ["Serenity", "SemiAnalysis"] },
  { id: "POET_optical-interconnect", ticker: "POET", name: "POET Technologies", nameZh: "POET科技", stageId: "optical-interconnect", heat: 55, sentiment: "bullish", mentions24h: 9, mentions7d: 48, mentions30d: 155, narratives: ["CPO/Photonics"], latestInsight: "光子集成平台POET OI引擎，LightBar量产进展", sources: ["Serenity", "Kova"] },
  { id: "MXL_optical-interconnect",  ticker: "MXL",  name: "MaxLinear", nameZh: "麦斯线性", stageId: "optical-interconnect", heat: 60, sentiment: "bullish", mentions24h: 11, mentions7d: 62, mentions30d: 200, narratives: ["CPO/Photonics"], latestInsight: "PAM4 DSP在800G模块渗透，竞争格局利好", sources: ["SemiAnalysis"] },
  { id: "AAOI_optical-interconnect", ticker: "AAOI", name: "Applied Optoelectronics", nameZh: "应用光电", stageId: "optical-interconnect", heat: 47, sentiment: "neutral", mentions24h: 6, mentions7d: 32, mentions30d: 104, narratives: ["CPO/Photonics"], latestInsight: "100G/400G模块进入数据中心，差异化竞争压力大", sources: ["Serenity"] },
  { id: "HLIT_optical-interconnect", ticker: "HLIT", name: "Harmonic", nameZh: "和谐", stageId: "optical-interconnect", heat: 38, sentiment: "neutral", mentions24h: 3, mentions7d: 18, mentions30d: 62, narratives: [], latestInsight: "媒体+宽带平台，AI工作负载流量管理", sources: ["Serenity"] },
  { id: "VIAV_optical-interconnect", ticker: "VIAV", name: "Viavi Solutions", nameZh: "VIAVI", stageId: "optical-interconnect", heat: 42, sentiment: "neutral", mentions24h: 4, mentions7d: 22, mentions30d: 75, narratives: [], latestInsight: "光纤测试仪器，800G部署验证需求增长", sources: ["Serenity"] },
];

// ── Network Equipment ─────────────────────────────────────────────────────────
const networkEquipment: Company[] = [
  { id: "ANET_network-equipment", ticker: "ANET", name: "Arista Networks", nameZh: "Arista网络", stageId: "network-equipment", heat: 86, sentiment: "bullish", mentions24h: 36, mentions7d: 212, mentions30d: 680, narratives: ["Neocloud"], latestInsight: "AI后端网络400G/800G主力交换机，超大规模客户扩容不停", sources: ["Serenity", "Kova", "Gavin Baker"] },
  { id: "CSCO_network-equipment", ticker: "CSCO", name: "Cisco", nameZh: "思科", stageId: "network-equipment", heat: 62, sentiment: "neutral", mentions24h: 18, mentions7d: 105, mentions30d: 338, narratives: [], latestInsight: "AI优先网络战略推进，订阅转型持续", sources: ["Serenity", "Kova"] },
  { id: "CIEN_network-equipment", ticker: "CIEN", name: "Ciena", nameZh: "Ciena", stageId: "network-equipment", heat: 58, sentiment: "bullish", mentions24h: 11, mentions7d: 62, mentions30d: 200, narratives: [], latestInsight: "WaveLogic 6波分复用，骨干网AI流量激增受益", sources: ["Serenity"] },
  { id: "HPE_network-equipment",  ticker: "HPE",  name: "HP Enterprise (Net)", nameZh: "惠普企业", stageId: "network-equipment", heat: 50, sentiment: "neutral", mentions24h: 9, mentions7d: 50, mentions30d: 165, narratives: [], latestInsight: "ProLiant+Slingshot互联，AI集群网络解决方案", sources: ["Serenity"] },
  { id: "JNPR_network-equipment", ticker: "JNPR", name: "Juniper Networks", nameZh: "瞻博网络", stageId: "network-equipment", heat: 44, sentiment: "neutral", mentions24h: 7, mentions7d: 38, mentions30d: 128, narratives: [], latestInsight: "HPE收购整合期，AI驱动网络管理产品差异化", sources: ["Serenity"] },
  { id: "KEYS_network-equipment", ticker: "KEYS", name: "Keysight", nameZh: "是德科技", stageId: "network-equipment", heat: 48, sentiment: "neutral", mentions24h: 6, mentions7d: 33, mentions30d: 110, narratives: [], latestInsight: "800G光网络测试仪器需求随部署加速增长", sources: ["SemiAnalysis"] },
  { id: "CALX_network-equipment", ticker: "CALX", name: "Calix", nameZh: "Calix", stageId: "network-equipment", heat: 35, sentiment: "neutral", mentions24h: 3, mentions7d: 16, mentions30d: 55, narratives: [], latestInsight: "宽带接入+云平台，AI运营商网络整合", sources: ["Serenity"] },
  { id: "INFN_network-equipment", ticker: "INFN", name: "Infinera", nameZh: "Infinera", stageId: "network-equipment", heat: 40, sentiment: "neutral", mentions24h: 4, mentions7d: 20, mentions30d: 68, narratives: [], latestInsight: "光传输网络，被Nokia收购整合中", sources: ["Serenity"] },
];

// ── Server Systems ────────────────────────────────────────────────────────────
const serverSystems: Company[] = [
  { id: "SMCI_server-systems", ticker: "SMCI", name: "Super Micro", nameZh: "超微电脑", stageId: "server-systems", heat: 80, sentiment: "bullish", mentions24h: 28, mentions7d: 165, mentions30d: 530, narratives: ["Neocloud", "DC Cooling"], latestInsight: "液冷AI服务器ODM全球领先，Blackwell GB200机架最大份额", sources: ["Serenity", "Kova", "Gavin Baker"] },
  { id: "DELL_server-systems", ticker: "DELL", name: "Dell Technologies", nameZh: "戴尔", stageId: "server-systems", heat: 70, sentiment: "bullish", mentions24h: 22, mentions7d: 128, mentions30d: 412, narratives: [], latestInsight: "PowerEdge AI服务器积压订单创历史高位，ISG业务加速", sources: ["Serenity", "Kova"] },
  { id: "PSTG_server-systems", ticker: "PSTG", name: "Pure Storage", nameZh: "普尔存储", stageId: "server-systems", heat: 65, sentiment: "bullish", mentions24h: 14, mentions7d: 80, mentions30d: 258, narratives: ["Neocloud"], latestInsight: "DirectFlash AI存储，Neocloud配套订单爆发增长", sources: ["Kova", "Serenity"] },
  { id: "STX_server-systems",  ticker: "STX",  name: "Seagate", nameZh: "希捷", stageId: "server-systems", heat: 58, sentiment: "bullish", mentions24h: 12, mentions7d: 68, mentions30d: 220, narratives: [], latestInsight: "HAMR硬盘密度提升，AI冷数据存储需求爆发", sources: ["Serenity"] },
  { id: "NTAP_server-systems", ticker: "NTAP", name: "NetApp", nameZh: "NetApp", stageId: "server-systems", heat: 52, sentiment: "neutral", mentions24h: 8, mentions7d: 44, mentions30d: 145, narratives: [], latestInsight: "AI数据管道存储，ONTAP配套GPU集群", sources: ["Serenity"] },
  { id: "HPE_server-systems",  ticker: "HPE",  name: "HP Enterprise (Srv)", nameZh: "惠普企业", stageId: "server-systems", heat: 55, sentiment: "neutral", mentions24h: 10, mentions7d: 58, mentions30d: 188, narratives: [], latestInsight: "ProLiant Gen11/GreenLake，AI工作负载HPC渗透", sources: ["Serenity"] },
  { id: "WDC_server-systems",  ticker: "WDC",  name: "Western Digital", nameZh: "西部数据", stageId: "server-systems", heat: 54, sentiment: "neutral", mentions24h: 9, mentions7d: 50, mentions30d: 165, narratives: [], latestInsight: "NAND+HDD双线，AI训练数据存储拆分潜力", sources: ["Serenity"] },
  { id: "IBM_server-systems",  ticker: "IBM",  name: "IBM", nameZh: "IBM", stageId: "server-systems", heat: 48, sentiment: "neutral", mentions24h: 8, mentions7d: 45, mentions30d: 148, narratives: [], latestInsight: "Z系列+Power AI，混合云+AI集成战略", sources: ["Serenity"] },
  { id: "SNX_server-systems",  ticker: "SNX",  name: "TD Synnex", nameZh: "TD Synnex", stageId: "server-systems", heat: 44, sentiment: "neutral", mentions24h: 5, mentions7d: 28, mentions30d: 92, narratives: [], latestInsight: "AI服务器配送渠道商，Blackwell需求拉动分销收入", sources: ["Serenity"] },
  { id: "FLEX_server-systems", ticker: "FLEX", name: "Flex Ltd", nameZh: "Flex", stageId: "server-systems", heat: 42, sentiment: "neutral", mentions24h: 4, mentions7d: 22, mentions30d: 75, narratives: [], latestInsight: "合同制造商，AI服务器代工订单增加", sources: ["Serenity"] },
  { id: "APH_server-systems",  ticker: "APH",  name: "Amphenol", nameZh: "安费诺", stageId: "server-systems", heat: 55, sentiment: "bullish", mentions24h: 0, mentions7d: 0, mentions30d: 0, narratives: ["CPO/Photonics"], latestInsight: "高速AI服务器互联连接器，800G/1.6T数据中心背板接口核心供应商", sources: ["Serenity"] },
];

// ── Data Center ───────────────────────────────────────────────────────────────
const dataCenter: Company[] = [
  { id: "VRT_data-center",   ticker: "VRT",  name: "Vertiv", nameZh: "维谛", stageId: "data-center", heat: 88, sentiment: "bullish", mentions24h: 38, mentions7d: 225, mentions30d: 720, narratives: ["Power/Grid", "DC Cooling"], latestInsight: "液冷+UPS+PDU三重受益，2026订单积压比已超2025全年营收", sources: ["Serenity", "Kova", "Gavin Baker"] },
  { id: "CRWV_data-center",  ticker: "CRWV", name: "CoreWeave", nameZh: "CoreWeave", stageId: "data-center", heat: 84, sentiment: "bullish", mentions24h: 32, mentions7d: 190, mentions30d: 612, narratives: ["Neocloud"], latestInsight: "IPO后GPU-as-a-Service扩张，OpenAI/Meta大客户锁定长期合同", sources: ["Serenity", "Kova", "Gavin Baker"] },
  { id: "GEV_data-center",   ticker: "GEV",  name: "GE Vernova", nameZh: "GE维诺瓦", stageId: "data-center", heat: 82, sentiment: "bullish", mentions24h: 28, mentions7d: 168, mentions30d: 542, narratives: ["Power/Grid"], latestInsight: "电网设备+Gas Turbine，超大规模DC电力供应瓶颈解决者", sources: ["Serenity", "Kova", "Gavin Baker"] },
  { id: "STRL_data-center",  ticker: "STRL", name: "Sterling Infrastructure", nameZh: "斯特林基建", stageId: "data-center", heat: 79, sentiment: "bullish", mentions24h: 24, mentions7d: 142, mentions30d: 458, narratives: ["Neocloud"], latestInsight: "数据中心地基+钢构，积压订单可见度超过18个月", sources: ["Serenity", "Kova"] },
  { id: "EQIX_data-center",  ticker: "EQIX", name: "Equinix", nameZh: "Equinix", stageId: "data-center", heat: 75, sentiment: "bullish", mentions24h: 20, mentions7d: 118, mentions30d: 380, narratives: ["Neocloud"], latestInsight: "全球256个数据中心，AI租赁需求驱动同店收入+18%", sources: ["Serenity", "Kova"] },
  { id: "ETN_data-center",   ticker: "ETN",  name: "Eaton", nameZh: "伊顿", stageId: "data-center", heat: 76, sentiment: "bullish", mentions24h: 22, mentions7d: 130, mentions30d: 420, narratives: ["Power/Grid"], latestInsight: "UPS+配电+断路器，数据中心电力基础设施主力供应商", sources: ["Serenity", "Kova"] },
  { id: "PWR_data-center",   ticker: "PWR",  name: "Quanta Services", nameZh: "Quanta服务", stageId: "data-center", heat: 74, sentiment: "bullish", mentions24h: 20, mentions7d: 118, mentions30d: 382, narratives: ["Power/Grid"], latestInsight: "电力传输+DC建设双主线，AI基建高速增长执行者", sources: ["Serenity", "Kova"] },
  { id: "NBIS_data-center",  ticker: "NBIS", name: "Nebius Group", nameZh: "Nebius", stageId: "data-center", heat: 69, sentiment: "bullish", mentions24h: 15, mentions7d: 88, mentions30d: 285, narratives: ["Neocloud"], latestInsight: "欧洲AI云崛起，Yandex脱胎+NVDA早期合作伙伴", sources: ["Serenity", "Kova"] },
  { id: "DLR_data-center",   ticker: "DLR",  name: "Digital Realty", nameZh: "Digital Realty", stageId: "data-center", heat: 68, sentiment: "bullish", mentions24h: 16, mentions7d: 92, mentions30d: 298, narratives: ["Neocloud"], latestInsight: "PlatformDigital+超大规模预租，AI需求可见度24个月", sources: ["Serenity", "Kova"] },
  { id: "IREN_data-center",  ticker: "IREN", name: "Iris Energy", nameZh: "虹能", stageId: "data-center", heat: 72, sentiment: "bullish", mentions24h: 18, mentions7d: 105, mentions30d: 340, narratives: ["Neocloud"], latestInsight: "GPU云计算+比特币挖矿，新能源算力双主线", sources: ["Serenity", "Kova"] },
  { id: "NEE_data-center",   ticker: "NEE",  name: "NextEra Energy", nameZh: "下一代能源", stageId: "data-center", heat: 60, sentiment: "bullish", mentions24h: 14, mentions7d: 82, mentions30d: 265, narratives: ["Power/Grid"], latestInsight: "可再生能源+储能，AI数据中心绿色电力采购最大签约方", sources: ["Serenity"] },
  { id: "NRG_data-center",   ticker: "NRG",  name: "NRG Energy", nameZh: "NRG能源", stageId: "data-center", heat: 55, sentiment: "bullish", mentions24h: 10, mentions7d: 58, mentions30d: 190, narratives: ["Power/Grid"], latestInsight: "传统电力+新能源转型，超大DC电力PPA签约增加", sources: ["Serenity"] },
  { id: "CORZ_data-center",  ticker: "CORZ", name: "Core Scientific", nameZh: "Core Scientific", stageId: "data-center", heat: 58, sentiment: "bullish", mentions24h: 0, mentions7d: 0, mentions30d: 0, narratives: ["Neocloud"], latestInsight: "比特币矿场转型AI算力租赁，CoreWeave长期合同锁定收入", sources: ["Serenity"] },
  { id: "HUT_data-center",   ticker: "HUT",  name: "Hut 8", nameZh: "Hut 8", stageId: "data-center", heat: 52, sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, narratives: ["Neocloud"], latestInsight: "GPU云算力+比特币双主线，北美自建电力数据中心扩张", sources: ["Serenity"] },
  { id: "BE_data-center",    ticker: "BE",   name: "Bloom Energy", nameZh: "Bloom能源", stageId: "data-center", heat: 50, sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, narratives: ["Power/Grid"], latestInsight: "固体氧化物燃料电池为数据中心提供清洁备用电源，微软/谷歌合同增加", sources: ["Serenity"] },
  { id: "POWL_data-center",  ticker: "POWL", name: "Powell Industries", nameZh: "鲍威尔工业", stageId: "data-center", heat: 48, sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, narratives: ["Power/Grid"], latestInsight: "定制配电开关柜，超大规模数据中心电力分配基础设施", sources: ["Serenity"] },
  { id: "HUBB_data-center",  ticker: "HUBB", name: "Hubbell", nameZh: "哈贝尔", stageId: "data-center", heat: 46, sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, narratives: ["Power/Grid"], latestInsight: "电气基础设施组件，数据中心建设受益，电网升级双主线", sources: ["Serenity"] },
  { id: "JCI_data-center",   ticker: "JCI",  name: "Johnson Controls", nameZh: "江森自控", stageId: "data-center", heat: 50, sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, narratives: ["DC Cooling"], latestInsight: "楼宇自控+精密空调，数据中心热管理与HVAC系统供应商", sources: ["Serenity"] },
  { id: "CARR_data-center",  ticker: "CARR", name: "Carrier Global", nameZh: "开利", stageId: "data-center", heat: 48, sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, narratives: ["DC Cooling"], latestInsight: "数据中心精密空调与冷却系统，AI散热需求提升合同价值", sources: ["Serenity"] },
  { id: "TT_data-center",    ticker: "TT",   name: "Trane Technologies", nameZh: "特灵科技", stageId: "data-center", heat: 52, sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, narratives: ["DC Cooling"], latestInsight: "冷冻机组+液冷方案，超大规模数据中心温控订单增长", sources: ["Serenity"] },
];

// ── AI Software / Models ──────────────────────────────────────────────────────
const aiSoftware: Company[] = [
  { id: "MSFT_ai-software",  ticker: "MSFT", name: "Microsoft", nameZh: "微软", stageId: "ai-software", heat: 88, sentiment: "bullish", mentions24h: 45, mentions7d: 268, mentions30d: 858, narratives: ["Neocloud"], latestInsight: "Copilot渗透率Q2超预期，Azure AI增速45%+，OpenAI护城河加深", sources: ["Serenity", "Kova", "Gavin Baker"] },
  { id: "GOOG_ai-software",  ticker: "GOOG", name: "Alphabet", nameZh: "谷歌", stageId: "ai-software", heat: 85, sentiment: "bullish", mentions24h: 40, mentions7d: 238, mentions30d: 762, narratives: ["Custom ASIC"], latestInsight: "Gemini Ultra+TPU v5p自供，AI搜索防御性比预期强", sources: ["Serenity", "Kova", "Gavin Baker"] },
  { id: "META_ai-software",  ticker: "META", name: "Meta", nameZh: "Meta", stageId: "ai-software", heat: 83, sentiment: "bullish", mentions24h: 38, mentions7d: 225, mentions30d: 720, narratives: ["Custom ASIC"], latestInsight: "Llama开源生态+MTIA定制芯片，广告推荐AI效率飞轮", sources: ["Serenity", "Kova", "Gavin Baker"] },
  { id: "AMZN_ai-software",  ticker: "AMZN", name: "Amazon", nameZh: "亚马逊", stageId: "ai-software", heat: 80, sentiment: "bullish", mentions24h: 32, mentions7d: 190, mentions30d: 610, narratives: ["Custom ASIC", "Neocloud"], latestInsight: "AWS Bedrock+Trainium2，AI云基础设施投资翻倍", sources: ["Serenity", "Kova", "Gavin Baker"] },
  { id: "PLTR_ai-software",  ticker: "PLTR", name: "Palantir", nameZh: "Palantir", stageId: "ai-software", heat: 78, sentiment: "bullish", mentions24h: 28, mentions7d: 165, mentions30d: 530, narratives: [], latestInsight: "AIP政府+商业双轮驱动，AI平台单价扩张", sources: ["Serenity", "Kova"] },
  { id: "ORCL_ai-software",  ticker: "ORCL", name: "Oracle", nameZh: "甲骨文", stageId: "ai-software", heat: 72, sentiment: "bullish", mentions24h: 22, mentions7d: 130, mentions30d: 418, narratives: ["Neocloud"], latestInsight: "OCI AI超级集群，Stargate参与方之一，RPO突破$130B", sources: ["Serenity", "Kova", "Gavin Baker"] },
  { id: "DDOG_ai-software",  ticker: "DDOG", name: "Datadog", nameZh: "Datadog", stageId: "ai-software", heat: 70, sentiment: "bullish", mentions24h: 18, mentions7d: 105, mentions30d: 340, narratives: [], latestInsight: "AI工作负载可观测性+LLM监控，AI原生企业客户增长加速", sources: ["Serenity", "Kova"] },
  { id: "NET_ai-software",   ticker: "NET",  name: "Cloudflare", nameZh: "Cloudflare", stageId: "ai-software", heat: 65, sentiment: "bullish", mentions24h: 16, mentions7d: 95, mentions30d: 308, narratives: [], latestInsight: "Workers AI+R2边缘推理，AI inference全球分发网络", sources: ["Serenity", "Kova"] },
  { id: "SNOW_ai-software",  ticker: "SNOW", name: "Snowflake", nameZh: "Snowflake", stageId: "ai-software", heat: 62, sentiment: "bullish", mentions24h: 16, mentions7d: 92, mentions30d: 298, narratives: [], latestInsight: "Cortex AI+Arctic LLM，企业数据+AI平台整合加速", sources: ["Serenity"] },
  { id: "CRM_ai-software",   ticker: "CRM",  name: "Salesforce", nameZh: "Salesforce", stageId: "ai-software", heat: 60, sentiment: "bullish", mentions24h: 15, mentions7d: 88, mentions30d: 285, narratives: [], latestInsight: "Agentforce企业AI代理平台，Q1接单量超预期", sources: ["Serenity"] },
  { id: "PATH_ai-software",  ticker: "PATH", name: "UiPath", nameZh: "UiPath", stageId: "ai-software", heat: 50, sentiment: "neutral", mentions24h: 8, mentions7d: 45, mentions30d: 148, narratives: [], latestInsight: "AI驱动RPA，企业自动化平台渗透率稳步提升", sources: ["Serenity"] },
  { id: "AI_ai-software",    ticker: "AI",   name: "C3.ai", nameZh: "C3.ai", stageId: "ai-software", heat: 42, sentiment: "neutral", mentions24h: 6, mentions7d: 32, mentions30d: 108, narratives: [], latestInsight: "企业AI应用，政府/国防订单增加，扭亏为盈进程中", sources: ["Serenity"] },
  { id: "TSLA_ai-software",  ticker: "TSLA", name: "Tesla", nameZh: "特斯拉", stageId: "ai-software", heat: 62, sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, narratives: ["Robotics"], latestInsight: "Dojo超级计算机+Optimus人形机器人，AI推理+自动驾驶数据飞轮", sources: ["Serenity"] },
  { id: "ISRG_ai-software",  ticker: "ISRG", name: "Intuitive Surgical", nameZh: "直觉外科", stageId: "ai-software", heat: 45, sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, narratives: ["Robotics"], latestInsight: "da Vinci手术机器人+AI辅助导航，医疗机器人龙头受益外科AI化", sources: ["Serenity"] },
  { id: "ROK_ai-software",   ticker: "ROK",  name: "Rockwell Automation", nameZh: "罗克韦尔", stageId: "ai-software", heat: 40, sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, narratives: ["Robotics"], latestInsight: "工业自动化+AI可编程控制器，制造业机器人化加速受益", sources: ["Serenity"] },
  { id: "CGNX_ai-software",  ticker: "CGNX", name: "Cognex", nameZh: "康耐视", stageId: "ai-software", heat: 42, sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, narratives: ["Robotics"], latestInsight: "AI机器视觉系统，半导体/物流/汽车自动化检测龙头", sources: ["Serenity"] },
  { id: "RKLB_ai-software",  ticker: "RKLB", name: "Rocket Lab", nameZh: "火箭实验室", stageId: "ai-software", heat: 38, sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, narratives: ["Space"], latestInsight: "小型卫星发射+Neutron中型火箭，低轨道卫星互联网基础设施", sources: ["Serenity"] },
  { id: "ASTS_ai-software",  ticker: "ASTS", name: "AST SpaceMobile", nameZh: "AST太空移动", stageId: "ai-software", heat: 40, sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, narratives: ["Space"], latestInsight: "直连手机卫星宽带，BlueBird星座商业化，AT&T/Verizon合作", sources: ["Serenity"] },
  { id: "LUNR_ai-software",  ticker: "LUNR", name: "Intuitive Machines", nameZh: "直觉机器", stageId: "ai-software", heat: 35, sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, narratives: ["Space"], latestInsight: "NASA月球着陆器合同，商业月球运输服务先行者", sources: ["Serenity"] },
  { id: "LMT_ai-software",   ticker: "LMT",  name: "Lockheed Martin", nameZh: "洛克希德·马丁", stageId: "ai-software", heat: 44, sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, narratives: ["Space"], latestInsight: "AI驱动国防系统+卫星平台，军事AI与太空防御双主线", sources: ["Serenity"] },
  { id: "NOC_ai-software",   ticker: "NOC",  name: "Northrop Grumman", nameZh: "诺斯罗普·格鲁曼", stageId: "ai-software", heat: 42, sentiment: "neutral", mentions24h: 0, mentions7d: 0, mentions30d: 0, narratives: ["Space"], latestInsight: "B-21轰炸机+航天系统，AI加持国防自主平台", sources: ["Serenity"] },
];

// ── Master list ───────────────────────────────────────────────────────────────
export const ALL_COMPANIES: Company[] = [
  ...rawMaterials,
  ...waferSubstrate,
  ...chipDesign,
  ...foundry,
  ...packagingTest,
  ...opticalInterconnect,
  ...networkEquipment,
  ...serverSystems,
  ...dataCenter,
  ...aiSoftware,
];

// ── Derived helpers ───────────────────────────────────────────────────────────
export function getCompaniesByStage(stageId: string): Company[] {
  return ALL_COMPANIES.filter((c) => c.stageId === stageId);
}

export function getMentions(c: Company, range: TimeRange): number {
  if (range === "24h") return c.mentions24h;
  if (range === "7d") return c.mentions7d;
  return c.mentions30d;
}

export function stageHeat(stageId: string): number {
  const companies = getCompaniesByStage(stageId);
  if (companies.length === 0) return 0;
  return Math.round(companies.reduce((sum, c) => sum + c.heat, 0) / companies.length);
}

export function stageSentiment(stageId: string): Sentiment {
  const companies = getCompaniesByStage(stageId);
  const bullish = companies.filter((c) => c.sentiment === "bullish").length;
  const bearish = companies.filter((c) => c.sentiment === "bearish").length;
  if (bullish > bearish + 2) return "bullish";
  if (bearish > bullish + 2) return "bearish";
  return "neutral";
}

export const TOP_COMPANIES_BY_HEAT: Company[] = [...ALL_COMPANIES]
  .sort((a, b) => b.heat - a.heat)
  .slice(0, 10);

// TOP_TRENDING is now computed client-side using real quote data
export const TOP_TRENDING_TICKERS: string[] = [
  "NVDA", "AVGO", "MU", "MRVL", "TSM", "COHR", "VRT", "ANET", "CRWV", "STRL",
];

export const HOTTEST_STAGES = STAGES.map((s) => ({ ...s, heat: stageHeat(s.id) }))
  .sort((a, b) => b.heat - a.heat);
