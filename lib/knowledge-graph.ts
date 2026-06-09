/**
 * AI Narrative Knowledge Graph
 *
 * Maps investment themes to relevant tickers and provides
 * supply-chain context for AI analysis.
 */

export type ThemeTickers = Record<string, string[]>;

export const THEME_TICKERS: ThemeTickers = {
  // ─── Optical / CPO ───────────────────────────────────────────────────────────
  CPO: ["SIVE", "POET", "COHR", "LITE", "IIVI", "FNSR", "NPTN", "ACIA", "CIEN", "INFN"],
  SILICON_PHOTONICS: ["SIVE", "POET", "INTC", "IBM", "COHR", "MRVL", "AMAT"],
  OPTICAL_NETWORKING: ["CIEN", "INFN", "ADTN", "CALX", "COHR", "LITE", "VIAV"],
  OPTICAL_TRANSCEIVER: ["COHR", "LITE", "FNSR", "AAOI", "IIVI"],

  // ─── AI Semiconductors ───────────────────────────────────────────────────────
  AI_GPU: ["NVDA", "AMD", "INTC", "QCOM"],
  AI_ASIC: ["MRVL", "BRCM", "AVGO", "GOOG", "AMZN"],
  HBM_MEMORY: ["SK_HYNIX", "SAMSUNG", "MCHP", "MU"],
  ADVANCED_PACKAGING: ["ASX", "AMKR", "AMAT", "LRCX", "TSM"],

  // ─── AI Infrastructure ───────────────────────────────────────────────────────
  HYPERSCALER: ["MSFT", "GOOG", "AMZN", "META", "AAPL"],
  AI_SERVER: ["SMCI", "HPE", "DELL", "ORCL", "NVDA"],
  DATA_CENTER_REIT: ["DLR", "EQIX", "AMT", "CCI", "CONE", "SBAC"],
  NETWORKING: ["ANET", "CSCO", "JNPR", "CIEN", "INFN"],

  // ─── AI Power ────────────────────────────────────────────────────────────────
  AI_POWER: ["VRT", "NVTS", "AMPS", "GEV", "ETN", "EATON", "PWR"],
  HVDC_800V: ["VRT", "ABB", "ETN", "GEV", "POWL"],
  COOLING: ["VRT", "NVENT", "TRMB", "CDNS"],
  UPS_POWER: ["VRT", "ETN", "EATON"],

  // ─── Robotics & Physical AI ──────────────────────────────────────────────────
  ROBOTICS: ["TSLA", "SERV", "IRBT", "ABB", "FANUC", "YASKAWA"],
  PHYSICAL_AI: ["TSLA", "SERV", "GOOGL", "MSFT", "AMZN"],
  HUMANOID: ["TSLA", "SERV", "AMZN", "MSFT"],
  INDUSTRIAL_AUTOMATION: ["FANUC", "KUKA", "ABB", "SIEMENS", "YASKAWA"],

  // ─── Semiconductor Supply Chain ──────────────────────────────────────────────
  EDA: ["SNPS", "CDNS", "MTOR"],
  LITHOGRAPHY: ["ASML"],
  WAFER_EQUIPMENT: ["AMAT", "LRCX", "KLAC"],
  FOUNDRY: ["TSM", "GFS", "INTC", "UMC"],
  SUBSTRATE: ["AMKR", "ASX", "SPIL"],

  // ─── Chinese AI / Domestic ───────────────────────────────────────────────────
  CHINA_AI: ["BIDU", "BABA", "TENCENT", "CAMB"],
  CHINA_SEMICONDUCTOR: ["SMIC", "YMTC", "CXMT"],

  // ─── Emerging / Meme AI ──────────────────────────────────────────────────────
  EDGE_AI: ["NVDA", "QCOM", "INTC", "MCHP", "MPWR"],
  AI_PC: ["INTC", "AMD", "QCOM", "MSFT", "AAPL"],
  AUTONOMOUS_VEHICLE: ["TSLA", "MOBILEYE", "GOOGL", "BAIDU"],

  // ─── Neocloud (AI-native cloud) ──────────────────────────────────────────────
  NEOCLOUD: ["CRWV", "NBIS", "CORZ", "WULF"],
};

// ─── Ticker → Themes mapping (reverse index) ─────────────────────────────────

export const TICKER_THEMES: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  for (const [theme, tickers] of Object.entries(THEME_TICKERS)) {
    for (const ticker of tickers) {
      map[ticker] = [...(map[ticker] ?? []), theme];
    }
  }
  return map;
})();

// ─── Theme → Chinese label mapping ───────────────────────────────────────────

export const THEME_LABELS_CN: Record<string, string> = {
  CPO: "共封装光学",
  SILICON_PHOTONICS: "硅光",
  OPTICAL_NETWORKING: "光网络",
  OPTICAL_TRANSCEIVER: "光模块",
  AI_GPU: "AI GPU",
  AI_ASIC: "AI ASIC",
  HBM_MEMORY: "HBM 存储",
  ADVANCED_PACKAGING: "先进封装",
  HYPERSCALER: "超大规模云厂商",
  AI_SERVER: "AI 服务器",
  DATA_CENTER_REIT: "数据中心 REIT",
  NETWORKING: "交换机/网络",
  AI_POWER: "AI 电力",
  HVDC_800V: "800V HVDC",
  COOLING: "液冷/散热",
  UPS_POWER: "UPS 供电",
  ROBOTICS: "机器人",
  PHYSICAL_AI: "具身智能",
  HUMANOID: "人形机器人",
  INDUSTRIAL_AUTOMATION: "工业自动化",
  EDA: "EDA 软件",
  LITHOGRAPHY: "光刻机",
  WAFER_EQUIPMENT: "晶圆设备",
  FOUNDRY: "晶圆代工",
  SUBSTRATE: "封装基板",
  CHINA_AI: "中国 AI",
  CHINA_SEMICONDUCTOR: "中国半导体",
  EDGE_AI: "边缘 AI",
  AI_PC: "AI PC",
  AUTONOMOUS_VEHICLE: "自动驾驶",
  NEOCLOUD: "Neocloud AI原生云"
};

// ─── Market terminology glossary ─────────────────────────────────────────────
// Only add entries that are stable, publicly verifiable facts.
// Do NOT add speculative or inferred meanings.

export const MARKET_GLOSSARY = [
  // Neocloud
  {
    term: "neocloud / neoclouds",
    cn: "AI原生云厂商",
    detail: "以GPU集群为核心基础设施、专门服务AI训练/推理的新型云厂商，区别于传统hyperscaler（微软/谷歌/亚马逊）。代表公司：CoreWeave（$CRWV）、Nebius（$NBIS）。",
  },
  // Leopold / Situational Awareness
  {
    term: "Leopold / Situational Awareness",
    cn: "利奥波德 / 形势感知",
    detail: "Leopold Aschenbrenner，前OpenAI研究员，创办Situational Awareness投研机构，因预测AI进展准确而在AI投资圈知名。其选股集中于AI基础设施（$NBIS、$BE、$TE等）。",
  },
  // Korean market code format
  {
    term: "韩国股票代码格式",
    cn: "韩国市场代码",
    detail: "韩国股票代码为6位数字，部分ETF/期货/股票类别会附加字母后缀，如285A、069500K、122630。翻译时保留原代码，无需加问号或注释。",
  },
  // "1K level" for stock prices
  {
    term: "1K level / 1K",
    cn: "1000点/1000美元关口",
    detail: "交易员口语：1K = 1000，如'$MU at the 1K level'表示美光股价接近1000美元。不是笔误，直接翻译为'1000'即可，禁止加'可能是笔误'等注释。",
  },
  // buybacks
  {
    term: "50% buybacks of their equity",
    cn: "回购50%流通股",
    detail: "指公司计划回购相当于其流通股50%的份额，是超大规模回购承诺，属看涨信号。",
  },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Given a list of tickers, return all related themes.
 */
export function getThemesForTickers(tickers: string[]): string[] {
  const themes = new Set<string>();
  for (const ticker of tickers) {
    const t = TICKER_THEMES[ticker.toUpperCase()];
    if (t) t.forEach((theme) => themes.add(theme));
  }
  return [...themes];
}

/**
 * Given a theme keyword from tweet text, return relevant tickers.
 */
export function getTickersForTheme(keyword: string): string[] {
  const normalizedKeyword = keyword.toUpperCase().replace(/[\s-]/g, "_");
  const directMatch = THEME_TICKERS[normalizedKeyword];
  if (directMatch) return directMatch;

  // Fuzzy match on theme names
  const fuzzyMatches: string[] = [];
  for (const [theme, tickers] of Object.entries(THEME_TICKERS)) {
    if (theme.includes(normalizedKeyword) || normalizedKeyword.includes(theme)) {
      fuzzyMatches.push(...tickers);
    }
  }
  return [...new Set(fuzzyMatches)];
}

/**
 * Build a knowledge context string for the AI system prompt.
 */
export function buildKnowledgeContext(): string {
  const lines = [
    "=== AI Narrative Knowledge Graph ===",
    "",
    "Key theme → ticker mappings (use this to validate and discover relevant stocks):",
    ""
  ];

  for (const [theme, tickers] of Object.entries(THEME_TICKERS)) {
    const labelCn = THEME_LABELS_CN[theme] ?? theme;
    lines.push(`${labelCn} (${theme}): ${tickers.slice(0, 6).join(", ")}`);
  }

  lines.push(
    "",
    "IMPORTANT: Only recommend tickers from this list unless you are highly confident a ticker exists and is directly relevant. Verify all tickers are real US-listed stocks.",
    "",
    "=== Market Terminology Glossary ===",
    "Use these definitions to translate accurately. Do NOT add speculative notes or question existing market codes/numbers.",
    ""
  );

  for (const entry of MARKET_GLOSSARY) {
    lines.push(`【${entry.term}】→ ${entry.cn}：${entry.detail}`);
  }

  return lines.join("\n");
}
