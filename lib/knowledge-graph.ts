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
  HBM_MEMORY: ["MU", "000660.KS", "005930.KS"],  // SK Hynix, Samsung
  ADVANCED_PACKAGING: ["ASX", "AMKR", "AMAT", "LRCX", "2330.TW"],
  MEMORY_STORAGE: ["MU", "WDC", "STX", "SNDK"],

  // ─── AI Infrastructure ───────────────────────────────────────────────────────
  HYPERSCALER: ["MSFT", "GOOG", "AMZN", "META", "AAPL"],
  AI_SERVER: ["SMCI", "HPE", "DELL", "ORCL", "NVDA"],
  DATA_CENTER_REIT: ["DLR", "EQIX", "AMT", "CCI", "CONE", "SBAC"],
  NETWORKING: ["ANET", "CSCO", "JNPR", "CIEN", "INFN"],

  // ─── Neocloud (AI-native cloud) ──────────────────────────────────────────────
  NEOCLOUD: ["CRWV", "NBIS", "CORZ", "WULF"],

  // ─── AI Power & Energy ───────────────────────────────────────────────────────
  AI_POWER: ["VRT", "NVTS", "AMPS", "GEV", "ETN", "PWR"],
  HVDC_800V: ["VRT", "ABB", "ETN", "GEV", "POWL"],
  COOLING: ["VRT", "NVENT", "TRMB"],
  UPS_POWER: ["VRT", "ETN"],
  NUCLEAR_POWER: ["CEG", "VST", "NRG", "SMR", "OKLO", "BWXT", "CCJ", "LEU"],
  FUEL_CELL: ["BE", "FCEL", "PLUG", "BLDP", "HTOO"],
  UTILITY_AI: ["AEE", "SO", "NRG", "ETR", "NEE"],

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

  // ─── Emerging themes ─────────────────────────────────────────────────────────
  EDGE_AI: ["NVDA", "QCOM", "INTC", "MCHP", "MPWR"],
  AI_PC: ["INTC", "AMD", "QCOM", "MSFT", "AAPL"],
  AUTONOMOUS_VEHICLE: ["TSLA", "MOBILEYE", "GOOGL", "BAIDU"],
  CYBERSECURITY: ["CRWD", "PANW", "ZS", "FTNT", "S", "OKTA"],
  QUANTUM_COMPUTING: ["IONQ", "RGTI", "QBTS", "IBM", "GOOG"],
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
  MEMORY_STORAGE: "存储芯片",
  HYPERSCALER: "超大规模云厂商",
  AI_SERVER: "AI 服务器",
  DATA_CENTER_REIT: "数据中心 REIT",
  NETWORKING: "交换机/网络",
  NEOCLOUD: "Neocloud AI原生云",
  AI_POWER: "AI 电力",
  HVDC_800V: "800V HVDC",
  COOLING: "液冷/散热",
  UPS_POWER: "UPS 供电",
  NUCLEAR_POWER: "核电",
  FUEL_CELL: "燃料电池",
  UTILITY_AI: "公用事业/AI用电",
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
  CYBERSECURITY: "网络安全",
  QUANTUM_COMPUTING: "量子计算",
};

// ─── Market terminology glossary ─────────────────────────────────────────────
// Rule: only add entries that are stable, publicly verifiable facts.
// Organised by category so the AI model can locate relevant context quickly.

export const MARKET_GLOSSARY = [

  // ══════════════════════════════════════════════════════════
  // 1. 知名人物与机构（Key figures & institutions）
  // ══════════════════════════════════════════════════════════
  {
    term: "Leopold / Situational Awareness",
    cn: "利奥波德 / 形势感知",
    detail: "Leopold Aschenbrenner，前OpenAI研究员，创办Situational Awareness投研机构，因预测AGI进展准确而在AI投资圈知名。其选股集中于AI基础设施（$NBIS、$BE、$TE等）。常出现在推特AI投资讨论中。",
  },
  {
    term: "SemiAnalysis / Dylan Patel",
    cn: "SemiAnalysis / 迪伦·帕特尔",
    detail: "Dylan Patel主笔的半导体行业深度研究Newsletter，是华尔街和科技圈最受重视的半导体供应链分析来源，常被机构引用。",
  },
  {
    term: "Doug O'Laughlin / Fabricated Knowledge",
    cn: "道格 / Fabricated Knowledge",
    detail: "半导体行业独立分析师，主理Fabricated Knowledge Newsletter，专注芯片供应链深度分析，在X(Twitter)影响力较大。",
  },
  {
    term: "Ives / Dan Ives",
    cn: "丹·艾夫斯",
    detail: "Wedbush证券科技行业首席分析师，以坚定看涨苹果、微软等大型科技股著称，在CNBC/Bloomberg频繁亮相。",
  },
  {
    term: "Cathie Wood / ARK",
    cn: "凯西·伍德 / ARK Invest",
    detail: "ARK Invest创始人，以颠覆性科技ETF（ARKK等）著称，重仓特斯拉、太空、基因组等主题。ARK的买卖操作每日公开披露。",
  },
  {
    term: "Jensen / Jensen Huang",
    cn: "黄仁勋",
    detail: "Nvidia（$NVDA）CEO兼联合创始人，AI芯片时代的核心人物。推文提到'Jensen said'即指Nvidia官方表态。",
  },
  {
    term: "Lisa Su",
    cn: "苏姿丰",
    detail: "AMD（$AMD）CEO，带领AMD从濒临破产到与Nvidia竞争AI芯片市场的核心人物。",
  },
  {
    term: "Sam Altman",
    cn: "萨姆·奥特曼",
    detail: "OpenAI CEO，AI领域最具影响力的人物之一。其公开言论常直接影响AI概念股走势。",
  },
  {
    term: "David Tepper / Appaloosa",
    cn: "大卫·泰珀 / Appaloosa",
    detail: "知名对冲基金Appaloosa Management创始人，宏观和科技股投资老手，其仓位变动常引发市场关注。",
  },
  {
    term: "Masayoshi Son / SoftBank",
    cn: "孙正义 / 软银",
    detail: "软银集团创始人，AI时代最激进的科技投资人之一，宣布对美国AI投资数千亿美元（Stargate项目参与方）。",
  },

  // ══════════════════════════════════════════════════════════
  // 2. 亚洲市场代码规范（Asian market code conventions）
  // ══════════════════════════════════════════════════════════
  {
    term: "韩国股票代码格式",
    cn: "韩国市场代码",
    detail: "韩国股票代码为6位数字，可附字母后缀区分股份类别（如285A、122630）。常见ETF代码：069500（KODEX 200）、122630（KODEX Leverage 2x）、252670（KODEX Inverse 2x）。翻译时保留原代码，不加问号。KOSPI=韩国综合股价指数，KOSDAQ=韩国创业板。",
  },
  {
    term: "日本股票代码格式",
    cn: "日本市场代码",
    detail: "日本股票代码为4位数字+.T后缀。常见：6758.T=Sony，7203.T=Toyota，6861.T=Keyence，9984.T=SoftBank，6702.T=Fujitsu，8306.T=Mitsubishi UFJ，7974.T=Nintendo，6857.T=Advantest（半导体测试设备）。",
  },
  {
    term: "港股代码格式",
    cn: "香港市场代码",
    detail: "港股代码为4位数字+.HK后缀（有时仅写数字）。常见：0700.HK=腾讯，9988.HK=阿里巴巴，0005.HK=汇丰，2318.HK=中国平安，0941.HK=中国移动，3690.HK=美团，9626.HK=哔哩哔哩。",
  },
  {
    term: "A股代码格式",
    cn: "A股市场代码",
    detail: "A股6位数字代码。沪市主板：600xxx/601xxx/603xxx；科创板（STAR Market）：688xxx；深市主板：000xxx/001xxx；中小板：002xxx；创业板（ChiNext）：300xxx/301xxx。例：688019=安集科技，300750=宁德时代，600519=贵州茅台，300015=爱尔眼科，601318=中国平安，688981=中芯国际（A股），002594=比亚迪。",
  },
  {
    term: "A股核心AI/半导体标的",
    cn: "A股AI及半导体重点公司",
    detail: "688981=中芯国际，688012=中微公司，688041=海光信息，688256=寒武纪，688065=凯迪利德，300750=宁德时代，300759=康龙化成，002371=北方华创，300274=阳光电源，688516=奥比中光，300454=深信服，688111=金山办公，600703=三安光电，002049=紫光国微，688798=艾为电子。",
  },
  {
    term: "A股市场术语",
    cn: "A股专有术语",
    detail: "沪深300=沪深两市市值前300大公司指数（对标S&P500）；创业板指=深市创业板综合指数；科创50=科创板前50大公司指数；北向资金=通过沪港通/深港通流入A股的境外资金（俗称外资）；南向资金=经港股通流向港股的内地资金；涨停=单日涨幅达到上限（主板±10%，科创板/创业板±20%）；跌停=相反；打板=追买涨停股；割肉=亏损平仓。",
  },
  {
    term: "港股通/沪港通/深港通",
    cn: "互联互通机制",
    detail: "沪港通=上交所与港交所互联；深港通=深交所与港交所互联；港股通=内地投资者通过这两个通道买港股；北向资金/南向资金是观察机构动向的重要指标。",
  },
  {
    term: "台湾股票代码格式",
    cn: "台湾市场代码",
    detail: "台股代码为4位数字（有时带.TW后缀）。常见：2330=台积电（TSMC），2317=鸿海（Foxconn），2454=联发科（MediaTek），3008=大立光，2308=台达电，3711=日月光。",
  },
  {
    term: "英国/欧洲股票代码格式",
    cn: "欧洲市场代码",
    detail: "英股带.L后缀（如CWR.L=Ceres Power），德股带.DE后缀，法股带.PA后缀，荷股带.AS后缀，瑞典带.ST后缀。",
  },

  // ══════════════════════════════════════════════════════════
  // 3. 价格/估值术语（Price & valuation terms）
  // ══════════════════════════════════════════════════════════
  {
    term: "1K level / 1K",
    cn: "1000美元/点关口",
    detail: "交易员口语：1K=1000。'$MU at the 1K level'=美光股价接近1000美元。不是笔误，直接翻译为'1000'，禁止加'可能是笔误'等注释。",
  },
  {
    term: "fwd P/E / fwd PEG / NTM P/E",
    cn: "远期市盈率 / 远期PEG",
    detail: "fwd P/E=forward P/E=远期市盈率（基于未来12个月预测利润）；NTM=next twelve months（未来12个月）；fwd PEG=远期市盈率除以增长率，用于衡量估值是否合理。",
  },
  {
    term: "EV/EBITDA / EV/Sales",
    cn: "企业价值倍数",
    detail: "EV=enterprise value（企业总价值=市值+净债务）；EV/EBITDA和EV/Sales是比P/E更适合高成长公司的估值指标。",
  },
  {
    term: "re-rate / re-rating",
    cn: "估值重估/市盈率扩张",
    detail: "公司基本面改善后，市场给予更高估值倍数的过程。'NVDA is re-rating higher'=市场重新给英伟达更高估值。",
  },
  {
    term: "multiple compression / expansion",
    cn: "估值压缩 / 估值扩张",
    detail: "multiple compression=估值倍数下降（股价跑输盈利增速）；multiple expansion=估值倍数上升（股价跑赢盈利增速）。",
  },
  {
    term: "run rate / annualized run rate",
    cn: "年化运营率",
    detail: "将某季度收入乘以4估算出的年化收入。'$10B run rate'=年化100亿美元收入。",
  },
  {
    term: "TAM / SAM / SOM",
    cn: "市场规模",
    detail: "TAM=total addressable market（总可寻址市场）；SAM=serviceable available market（可服务市场）；SOM=serviceable obtainable market（实际可获取市场）。",
  },

  // ══════════════════════════════════════════════════════════
  // 4. 交易员行话（Trader slang）
  // ══════════════════════════════════════════════════════════
  {
    term: "ripping / rip",
    cn: "暴拉",
    detail: "股价快速上涨。'NVDA is ripping'=英伟达暴涨。",
  },
  {
    term: "melting up",
    cn: "缓慢持续上涨/融涨",
    detail: "股价在市场情绪推动下缓慢但持续上涨，通常无明显催化剂。属看涨描述。",
  },
  {
    term: "fade / fading",
    cn: "逆势做空/反向交易",
    detail: "'fading the rally'=在反弹时做空。'I'm fading NVDA'=我在英伟达上涨时反向做空。",
  },
  {
    term: "puke / puking",
    cn: "恐慌性抛售/斩仓",
    detail: "在巨大亏损压力下被迫平仓。'longs are puking'=多头在恐慌性抛售。",
  },
  {
    term: "bagholding / bags",
    cn: "套牢/被套",
    detail: "'holding the bag'=持有亏损仓位无法脱身。'I'm bagging INTC'=我被英特尔套牢了。",
  },
  {
    term: "FOMO",
    cn: "追涨恐慌/错失恐惧",
    detail: "fear of missing out，错失恐惧。'pure FOMO buying'=纯粹因为怕踏空而追涨。",
  },
  {
    term: "diamond hands",
    cn: "钻石手/死拿不动",
    detail: "无论市场多么波动都坚持持仓不动。源自Reddit散户文化。",
  },
  {
    term: "paper hands",
    cn: "纸手/一跌就跑",
    detail: "稍有下跌就卖出的投资者。与diamond hands相对。",
  },
  {
    term: "degen / degenerate",
    cn: "赌徒式投机者",
    detail: "高风险高杠杆投机者的自嘲称呼，源自加密货币/期权社区。",
  },
  {
    term: "whale",
    cn: "大户/巨鲸",
    detail: "持仓巨大、能影响市场的机构或个人投资者。",
  },
  {
    term: "dark pool",
    cn: "暗池",
    detail: "机构间进行大宗交易的私有交易所，不公开显示在订单簿上。'dark pool prints'=暗池成交记录，常被解读为机构动向信号。",
  },
  {
    term: "flow / options flow",
    cn: "期权流/资金流向",
    detail: "期权市场的大额买卖记录，常被解读为聪明钱的动向信号。'bullish flow in NVDA'=英伟达有看涨期权大单。",
  },
  {
    term: "unwind",
    cn: "平仓/解仓",
    detail: "逐步减少或关闭仓位。'unwinding long positions'=逐步减持多头仓位。",
  },
  {
    term: "set up",
    cn: "布局时机/入场信号",
    detail: "'nice setup for NVDA'=英伟达当前是好的入场时机。",
  },
  {
    term: "printing money",
    cn: "稳定盈利/像印钞机一样",
    detail: "'NVDA is printing money'=英伟达在持续大量盈利，形容业绩极好。",
  },
  {
    term: "going parabolic",
    cn: "走出抛物线行情/暴涨",
    detail: "股价加速上涨，形如抛物线。极度看涨用语。",
  },
  {
    term: "grind higher",
    cn: "缓慢磨涨",
    detail: "股价缓慢而稳定地向上爬升，无剧烈波动。",
  },
  {
    term: "front-running",
    cn: "抢先交易",
    detail: "在预期大订单到来之前提前买入/卖出。在某些语境下指合法的预判交易，也可指不合规操作。",
  },
  {
    term: "squeeze / gamma squeeze / short squeeze",
    cn: "轧空/期权逼仓",
    detail: "short squeeze=空头被迫回补推高股价；gamma squeeze=期权做市商为对冲不得不大量买入正股，进一步推高股价。",
  },
  {
    term: "PM / portfolio manager",
    cn: "基金经理/投资组合经理",
    detail: "负责管理投资组合的专业投资人。'PM is buying'=机构基金经理在买入。",
  },

  // ══════════════════════════════════════════════════════════
  // 5. 期权术语（Options terms）
  // ══════════════════════════════════════════════════════════
  {
    term: "puts / buying puts",
    cn: "看跌期权",
    detail: "put option=看跌期权，赌股价下跌时盈利。'buying puts on NVDA'=买入英伟达看跌期权，即看空英伟达。",
  },
  {
    term: "calls / buying calls",
    cn: "看涨期权",
    detail: "call option=看涨期权，赌股价上涨时盈利。'buying calls'=买入看涨期权，看多信号。",
  },
  {
    term: "LEAPS",
    cn: "长期期权",
    detail: "Long-Term Equity Anticipation Securities，到期日超过1年的长期期权，常被机构用于长期看多建仓。",
  },
  {
    term: "OTM / ITM / ATM",
    cn: "价外/价内/平价期权",
    detail: "OTM=out of the money（价外，当前无内在价值）；ITM=in the money（价内，有内在价值）；ATM=at the money（平价，执行价≈股价）。",
  },
  {
    term: "IV / implied volatility",
    cn: "隐含波动率",
    detail: "市场预期未来波动性的指标。IV高=市场预期大波动（通常在财报前）；IV crush=财报后隐含波动率骤降，期权价值缩水。",
  },
  {
    term: "theta / theta decay",
    cn: "时间价值衰减",
    detail: "期权随时间流逝自然损失价值的速度。'theta is killing me'=持有的期权因时间流逝不断亏损。",
  },
  {
    term: "delta / gamma / vega",
    cn: "期权希腊字母",
    detail: "delta=期权对股价变动的敏感度；gamma=delta变化速度；vega=对隐含波动率的敏感度。这些是期权定价的核心参数。",
  },
  {
    term: "covered call / collar",
    cn: "备兑认购 / 领口策略",
    detail: "covered call=持有正股的同时卖出看涨期权，收取权利金但限制上涨收益；collar=同时买入看跌+卖出看涨，锁定盈亏区间。",
  },
  {
    term: "straddle / strangle",
    cn: "跨式/宽跨式期权",
    detail: "同时买入看涨和看跌期权，押注大幅波动（不管方向）。常在财报前买入。",
  },

  // ══════════════════════════════════════════════════════════
  // 6. 行业/公司特定术语（Sector-specific terms）
  // ══════════════════════════════════════════════════════════
  {
    term: "neocloud / neoclouds",
    cn: "AI原生云厂商",
    detail: "以GPU集群为核心、专服务AI训练/推理的新型云厂商，区别于传统hyperscaler。代表：CoreWeave（$CRWV）、Nebius（$NBIS）。股价波动剧烈，常与$NVDA订单量正相关。",
  },
  {
    term: "picks and shovels",
    cn: "镐和铲/基础设施受益股",
    detail: "淘金热中卖铲子比淘金更稳。AI语境中指不直接做AI应用、而是提供AI基础设施的公司（如$NVDA、$ANET、$VRT），相对更确定性地受益。",
  },
  {
    term: "capex cycle / AI capex supercycle",
    cn: "资本支出周期/AI资本支出超级周期",
    detail: "超大规模云厂商持续数年、规模数千亿的AI基础设施投资浪潮。受益方：$NVDA、$AVGO、$ANET、$VRT等。",
    },
  {
    term: "HBM / HBM3 / HBM3e",
    cn: "高带宽存储",
    detail: "High Bandwidth Memory，AI GPU必备的高速存储。H100/H200/B200 GPU均大量使用HBM。供应商：SK Hynix（000660.KS）、Samsung（005930.KS）、Micron（$MU）。",
  },
  {
    term: "CoWoS / SoIC",
    cn: "CoWoS先进封装技术",
    detail: "台积电（$TSM）的先进封装技术，将GPU与HBM集成在同一基板上。AI芯片需求爆发导致CoWoS产能严重紧缺。",
  },
  {
    term: "Stargate",
    cn: "Stargate项目",
    detail: "由OpenAI、SoftBank、Oracle、微软等联合宣布的5000亿美元美国AI基础设施投资计划，将建设大规模AI数据中心。直接受益：$ORCL、$NVDA、$VRT、$ANET等。",
  },
  {
    term: "NRE",
    cn: "非经常性工程费",
    detail: "Non-Recurring Engineering，客户委托定制芯片时支付的前期设计/工程费用。ASIC业务中的重要收入来源（如$AVGO、$MRVL的AI ASIC业务）。",
  },
  {
    term: "SiC / silicon carbide",
    cn: "碳化硅",
    detail: "用于高效率电力转换的宽禁带半导体材料，广泛应用于EV和AI数据中心电源。代表公司：$WOLF（Wolfspeed）、$ON（onsemi）、$STM（ST Micro）。",
  },
  {
    term: "rack-scale / rack-level",
    cn: "机架级",
    detail: "以整个服务器机架为单位进行计算/散热/供电设计。$NVDA的NVL72等产品是rack-scale架构，需要特殊液冷和供电解决方案，受益$VRT、$SMCI。",
  },
  {
    term: "inference / training",
    cn: "推理 / 训练",
    detail: "training=训练AI模型（高算力、一次性）；inference=用已训练模型对外提供服务（持续算力需求）。AI从训练转向推理阶段意味着对$NVDA芯片的需求更加持久。",
  },
  {
    term: "sovereign AI",
    cn: "主权AI",
    detail: "各国政府主导的国家级AI基础设施建设，不依赖美国hyperscaler。$NVDA直接受益（向各国政府销售GPU集群）。",
  },

  // ══════════════════════════════════════════════════════════
  // 6b. 美股核心指数与常用代码（US market indices & ETFs）
  // ══════════════════════════════════════════════════════════
  {
    term: "SPX / SPY / S&P500",
    cn: "标普500指数",
    detail: "SPX=S&P 500指数（现货）；SPY=跟踪SPX的最大ETF；ES=S&P 500期货合约。'SPX at 6000'=标普500在6000点。",
  },
  {
    term: "NDX / QQQ / Nasdaq 100",
    cn: "纳斯达克100指数",
    detail: "NDX=纳斯达克100指数（科技股重仓）；QQQ=跟踪NDX的最大ETF；NQ=纳斯达克100期货。科技股行情代名词。",
  },
  {
    term: "DJIA / DJI / Dow",
    cn: "道琼斯工业平均指数",
    detail: "30只蓝筹股组成，YM=道指期货。相较于SPX/NDX，Dow的科技股权重较低。",
  },
  {
    term: "Russell 2000 / IWM / RUT",
    cn: "罗素2000小盘股指数",
    detail: "美国中小盘股代表性指数。RUT=指数；IWM=ETF。小盘股表现常被用于判断市场风险偏好。",
  },
  {
    term: "VIX",
    cn: "恐慌指数",
    detail: "CBOE Volatility Index，基于S&P 500期权隐含波动率计算的市场恐慌程度指标。VIX>30=高度恐慌；VIX<15=市场平静。",
  },
  {
    term: "ARKK / ARK ETFs",
    cn: "ARK创新ETF",
    detail: "Cathie Wood旗下的颠覆性科技ETF，重仓TSLA、COIN、ROKU、CRSP等。ARKK=主动管理创新ETF；ARKX=太空ETF；ARKG=基因组ETF。",
  },
  {
    term: "SMH / SOXX",
    cn: "半导体ETF",
    detail: "SMH=VanEck Semiconductor ETF（重仓NVDA/TSMC/ASML）；SOXX=iShares Semiconductor ETF。半导体板块行情的代表性ETF。",
  },
  {
    term: "pre-market / after-hours / AH",
    cn: "盘前/盘后",
    detail: "pre-market=美股盘前交易（美东时间4:00-9:30 AM）；after-hours/AH=盘后（4:00-8:00 PM）。财报通常在盘后或盘前公布，此时波动剧烈。",
  },
  {
    term: "earnings / EPS beat / miss",
    cn: "财报/每股盈利超预期/不及预期",
    detail: "earnings=财报；EPS=每股盈利；beat=超过华尔街预期；miss=低于预期；guide/guidance=公司给出的下季度/全年业绩指引；guide higher/lower=上调/下调指引。",
  },
  {
    term: "buyback / share repurchase",
    cn: "股票回购",
    detail: "公司用自有资金回购流通股，减少股本，提升每股盈利。属于股东回报方式之一，通常是看涨信号。'$10B buyback authorization'=授权100亿美元回购计划。",
  },
  {
    term: "ex-dividend / cum-dividend",
    cn: "除息日/含息",
    detail: "ex-dividend date=除息日，该日之后买入不再享有本次分红；cum-dividend=含息（仍可享有分红）。",
  },

  // ══════════════════════════════════════════════════════════
  // 7. 宏观/债市术语（Macro & fixed income）
  // ══════════════════════════════════════════════════════════
  {
    term: "yields / US yields / bps",
    cn: "美债收益率 / 基点",
    detail: "US yields=美国国债收益率；bps=basis points（基点），1bps=0.01%。'yields softened 2bps'=收益率下降0.02个百分点，通常对科技股有利。",
  },
  {
    term: "the Fed / FOMC",
    cn: "美联储",
    detail: "Federal Reserve（美联储）；FOMC=联邦公开市场委员会（决定利率的会议体）。'Fed pivot'=美联储转向降息。",
  },
  {
    term: "equity issuance",
    cn: "股权融资/增发新股",
    detail: "公司通过增发新股筹集资金。'equity issuance to finance capex'=通过增发股票来支付资本支出，会稀释现有股东，属短期利空。",
  },
  {
    term: "YTD / QTD / MTD",
    cn: "年初至今 / 季初至今 / 月初至今",
    detail: "YTD=year-to-date；QTD=quarter-to-date；MTD=month-to-date。'up 260% YTD'=年初至今上涨260%。",
  },
  {
    term: "risk-on / risk-off",
    cn: "风险偏好开启 / 风险规避",
    detail: "risk-on=市场情绪好转，资金流向高风险资产（科技股/成长股）；risk-off=避险情绪，资金流向债券/黄金/防御性股票。",
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
 * Injected into INVESTMENT_ANALYST_SYSTEM_PROMPT via buildKnowledgeContext().
 */
export function buildKnowledgeContext(): string {
  const lines = [
    "=== AI Narrative Knowledge Graph ===",
    "",
    "Key theme → ticker mappings (use this to validate and discover relevant stocks):",
    "",
  ];

  for (const [theme, tickers] of Object.entries(THEME_TICKERS)) {
    const labelCn = THEME_LABELS_CN[theme] ?? theme;
    lines.push(`${labelCn} (${theme}): ${tickers.slice(0, 6).join(", ")}`);
  }

  lines.push(
    "",
    "IMPORTANT: Only recommend tickers from this list unless you are highly confident a ticker exists and is directly relevant.",
    "",
    "=== Market Terminology Glossary ===",
    "Use these definitions when translating. Do NOT add speculative notes or question the author's numbers/market codes.",
    "",
  );

  for (const entry of MARKET_GLOSSARY) {
    lines.push(`【${entry.term}】${entry.cn}：${entry.detail}`);
  }

  return lines.join("\n");
}
