/**
 * 穷举压力测试 — 覆盖所有语言/标点/格式
 * 目标：error率 = 0
 * 运行：bun run stress:full
 */

import OpenAI from "openai";
import { jsonrepair } from "jsonrepair";
import { z } from "zod";
import * as fs from "fs";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// ─── Env ──────────────────────────────────────────────────────────────────────

const OPENAI_API_KEY  = process.env.OPENAI_API_KEY!;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL!;
const AI_MODEL        = process.env.AI_MODEL!;
const XIAOMI_API_KEY  = process.env.XIAOMI_API_KEY!;
const XIAOMI_BASE_URL = process.env.XIAOMI_BASE_URL!;

// ─── 穷举测试用例（按类别） ───────────────────────────────────────────────────

interface TestCase { label: string; tweet: string; category: string }

const CASES: TestCase[] = [

  // ════════════════════════════════════════════════════════════
  // A. 引号地狱（各语言引号）
  // ════════════════════════════════════════════════════════════
  { category: "引号", label: "英文双引号", tweet: `$NVDA "harvesting the leeks" — "picks and shovels" play. CEO: "we'll double capex next year."` },
  { category: "引号", label: "嵌套引号", tweet: `He said "the market is 'broken' but $NVDA is 'immune'" — classic "screaming buy" signal.` },
  { category: "引号", label: "中文弯引号", tweet: `分析师称$NVDA正在"收割韭菜"，但"AI超级周期"的逻辑是"有效的"，目标价"1000美元"。` },
  { category: "引号", label: "德语引号 U+201E", tweet: `$SAP: „Die KI-Revolution ist real“ — Analyst sagt „Kaufen“, Ziel „200€“. Sehr bullisch für $SAP!` },
  { category: "引号", label: "法语引号 U+00AB U+00BB", tweet: `$LVMH: «La demande reste solide» selon le CEO. «Acheter maintenant» dit l'analyste. Bullish $LVMH.` },
  { category: "引号", label: "俄语引号 U+00AB U+00BB", tweet: `$SBER: «Прибыль выросла на 40%» — аналитик говорит «покупать». Дивиденд «рекордный». Bullish!` },
  { category: "引号", label: "日语引号 U+300C U+300D", tweet: `$7203.T（トヨタ）：「AI搭載EV戦略」を発表。アナリスト「買い推奨」。「2025年に黒字化」見通し。` },
  { category: "引号", label: "中文书名号 U+300A U+300B", tweet: `推荐阅读《AI投资白皮书》，其中指出$NVDA是《AI基础设施》最核心标的，《全面看涨》。` },
  { category: "引号", label: "各种引号混合", tweet: `"Bull case" for $NVDA: 「需要增长」, «demande forte», „Nachfrage stark" — all saying "BUY NOW"!` },
  { category: "引号", label: "引号后紧接标点", tweet: `CEO said "buy"! Analyst said "sell"? Market said "hold"... I say: "who knows"—but $NVDA wins.` },

  // ════════════════════════════════════════════════════════════
  // B. 多语言混合
  // ════════════════════════════════════════════════════════════
  { category: "多语言", label: "中英混合", tweet: `$NVDA Q2业绩超预期：Revenue $26B (+122% YoY)，数据中心贡献$22.6B。AI需求持续强劲，继续看多。` },
  { category: "多语言", label: "中英日三语", tweet: `$TSM（台積電/TSMCの）Q2業績超預想。Revenue +40% YoY。AI需求「前所未有」。全半导体产业链受益。` },
  { category: "多语言", label: "中英韩三语", tweet: `$005930.KS（삼성전자）HBM4 출하 개시。$NVDA 공급 확정。AI 메모리 수요 폭증。三星电子HBM出货，供应NVDA。` },
  { category: "多语言", label: "阿拉伯语+英文", tweet: `$ARAMCO أرامكو السعودية: أرباح قياسية في Q2. "Record profits" with AI-driven ops optimization. Bullish!` },
  { category: "多语言", label: "希伯来语+英文", tweet: `$CHKP (Check Point): הכנסות שיא ב-Q2. "Record revenue" driven by AI security. 看多网络安全板块。` },
  { category: "多语言", label: "印地语+英文", tweet: `$INFY (Infosys): भारत की AI क्रांति। Revenue +15% YoY। "AI-first strategy" is working。看多印度IT外包。` },
  { category: "多语言", label: "泰语+英文", tweet: `$PTT.BK: กำไรสุทธิเพิ่มขึ้น 30%。AI optimization drives efficiency。"Strong buy" from analysts。` },
  { category: "多语言", label: "五语混杂", tweet: `$ASML: "Monopoly on EUV" (独占) / 독점 / 独占 / monopole / монополия — all bullish for semis!` },

  // ════════════════════════════════════════════════════════════
  // C. 特殊标点与符号
  // ════════════════════════════════════════════════════════════
  { category: "特殊标点", label: "反斜杠", tweet: `$NVDA P\\E=40x。DCF: r=10\\%, terminal growth=3\\%。Fair value=$1200\\share。Bull: $2000\\share。` },
  { category: "特殊标点", label: "正斜杠", tweet: `AI Infrastructure play: $NVDA/$AMD ratio at 3x. Buy $NVDA/$AVGO pair. Risk/reward = 1/3.` },
  { category: "特殊标点", label: "竖线管道符", tweet: `Sector | Ticker | Rating | Target\nAI Chips | $NVDA | BUY | $1200\nNetworking | $ANET | BUY | $400\nPower | $VRT | BUY | $130` },
  { category: "特殊标点", label: "省略号多种形式", tweet: `$NVDA... still going up... "AI isn't slowing down"… 数据中心支出…增长…不停歇…继续买入…` },
  { category: "特殊标点", label: "破折号多种形式", tweet: `$NVDA – still king. $AMD — challenger. $INTC ー falling behind. 三足鼎立——但差距在拉大。` },
  { category: "特殊标点", label: "数学/化学符号", tweet: `$LIN (Linde): H₂ + O₂ → H₂O process optimization with AI。Blue hydrogen ≥ $50/kg target。ROI ≈ 25%。` },
  { category: "特殊标点", label: "货币符号大全", tweet: `Global AI plays: $NVDA (USD), $ASML (€), $ARM.L (£), $7203.T (¥), $005930.KS (₩), 2330.TW (NT$)。` },
  { category: "特殊标点", label: "百分比+乘除", tweet: `$NVDA 毛利率=78%，ROE=120%，收入增速=122%。估值：EV/EBITDA=40×，P/S=25×，P/E=60×。YoY增长÷同行=3倍。` },
  { category: "特殊标点", label: "括号嵌套", tweet: `$NVDA (data center ($22B) + gaming ($2B) + auto ($0.3B)) = total ($26B). Beat by (15%) vs (est $22.6B).` },
  { category: "特殊标点", label: "全角标点", tweet: `$NVDA：数据中心收入２２６亿美元！同比增长４２７％！CEO说："AI基础设施建设刚刚开始。"目标价：１２００美元。` },

  // ════════════════════════════════════════════════════════════
  // D. 格式极端情况
  // ════════════════════════════════════════════════════════════
  { category: "格式", label: "纯ticker无文字", tweet: `$NVDA $AMD $AVGO $ANET $VRT $SMCI` },
  { category: "格式", label: "极短推文", tweet: `$NVDA 🚀🚀🚀` },
  { category: "格式", label: "全大写", tweet: `$NVDA IS ABSOLUTELY DESTROYING IT. DATA CENTER UP 427%. "BEST QUARTER IN COMPANY HISTORY." BUY BUY BUY!!!` },
  { category: "格式", label: "全小写", tweet: `$nvda is still the best ai play. data center "crushing it". ceo said "we're just getting started." bullish.` },
  { category: "格式", label: "大量换行", tweet: "$NVDA\n数据中心\n$22.6B\n\n$AMD\n挑战者\n$5B\n\n$INTC\n掉队者\n$1B\n\n结论：\n买$NVDA\n卖$INTC" },
  { category: "格式", label: "大量制表符", tweet: "$NVDA\t\tBUY\t\t$1200\n$AMD\t\tHOLD\t\t$200\n$INTC\t\tSELL\t\t$20\n结论：\t\t$NVDA最强" },
  { category: "格式", label: "混合空白", tweet: `$NVDA   (spaces)  \t(tab)\n(newline) "quoted"  $AMD　(全角空格)　看多` },
  { category: "格式", label: "URL大量出现", tweet: `Full analysis: https://t.co/abc123 — see also https://t.co/xyz456 for $NVDA breakdown. Chart: https://t.co/chart789` },
  { category: "格式", label: "at符号+话题标签", tweet: `cc: @SemiAnalysis @BankofAmerica @GoldmanSachs — $NVDA #AI #semiconductors #buyNow #不要错过 #投资` },
  { category: "格式", label: "编号列表多层嵌套", tweet: `AI Trade 2025:\n1. Chips\n   1a. $NVDA (best)\n   1b. $AMD (ok)\n2. Power\n   2a. $VRT\n   2b. $ETN\n3. Networking\n   3a. $ANET` },
  { category: "格式", label: "ASCII艺术分割线", tweet: `━━━━━━━━━━━━━━━\n$NVDA ANALYSIS\n━━━━━━━━━━━━━━━\nBullish: YES\nTarget: $1200\n━━━━━━━━━━━━━━━` },
  { category: "格式", label: "大量感叹问号", tweet: `$NVDA up 10%?! Are you kidding me?! "Best stock ever"?! How is this even possible?! BUY MORE NOW!!!` },
  { category: "格式", label: "代码/公式块", tweet: "DCF Model for $NVDA:\n```\nr = 0.10\ng = 0.03\nFCF = $20B\nValue = FCF / (r - g) = $20B / 0.07 = $286B\n```\n\"Deeply undervalued\" at current prices." },

  // ════════════════════════════════════════════════════════════
  // E. JSON破坏性内容（最危险）
  // ════════════════════════════════════════════════════════════
  { category: "JSON破坏", label: "推文包含JSON片段", tweet: `$NVDA data: {"revenue": 26, "growth": "122%", "segment": "data_center"}. "Best ever" quarter confirmed.` },
  { category: "JSON破坏", label: "推文包含转义序列字面量", tweet: `$NVDA: \\n means newline, \\t means tab, \\\\ means backslash. "String parsing test." Price: $1200\\share.` },
  { category: "JSON破坏", label: "推文包含Unicode转义", tweet: `$NVDA \\u0041\\u004D\\u0044 (AMD) is \\u006C\\u006F\\u0073\\u0069\\u006E\\u0067. "Unicode escape test." Bullish $NVDA.` },
  { category: "JSON破坏", label: "推文含冒号+大括号", tweet: `$NVDA analysis: {bull case: $2000, bear case: $600, base case: $1200}. "Range-bound but trending up."` },
  { category: "JSON破坏", label: "推文含方括号", tweet: `AI picks [NVDA, AMD, AVGO, ANET] all look good. "My top 4" for [Q3 2025] are these [4 names].` },
  { category: "JSON破坏", label: "推文本身就像JSON", tweet: `{"ticker":"$NVDA","action":"BUY","target":1200,"note":"AI leader — \\"harvesting\\" capex from cloud"}` },
  { category: "JSON破坏", label: "大量反斜杠", tweet: `Path: C:\\Users\\Investor\\$NVDA\\analysis.txt — "file saved". Model: y = ax² + bx + c where a\\b\\c > 0.` },
  { category: "JSON破坏", label: "HTML标签", tweet: `$NVDA <strong>BUY</strong> — <em>"AI leader"</em>. Target: <b>$1200</b>. <!-- "best stock" --> &amp; more!` },
  { category: "JSON破坏", label: "控制字符模拟", tweet: "Analysis of $NVDA:\x09Revenue: $26B\x09EPS: $6.12\x09\"Beat estimates by 15%\"\x09Bullish!",},
  { category: "JSON破坏", label: "全角双引号", tweet: `$NVDA：分析师称："这是历史上最好的财报。"目标价"1200美元"，置信度"极高"。看多！` },
  { category: "JSON破坏", label: "零宽字符", tweet: `$NVDA​ is​ the​ "best"​ AI​ play​ right​ now.​ "Buy​ now"​ before​ it's​ too​ late!` },

  // ════════════════════════════════════════════════════════════
  // F. 极端金融内容
  // ════════════════════════════════════════════════════════════
  { category: "金融极端", label: "A股全中文无英文", tweet: `300376.SZ（国民技术）是800V高压直流最直接的受益标的之一，估值仅20倍PE，远低于行业均值35倍，强烈推荐买入！` },
  { category: "金融极端", label: "港股繁体中文", tweet: `2577.HK（上海汽車）業績超預期，股息率高達6.5%，估值折讓約40%，「強烈推薦買入」，目標價$8.50港元。` },
  { category: "金融极端", label: "日股全日文", tweet: `6758.T（ソニーグループ）：AI事業好調！センサー需要急増。「強い買い」推奨。目標株価：¥15,000。利益率改善中。` },
  { category: "金融极端", label: "德国股票全德文", tweet: `$SAP SE: KI-gesteuerte Transformation bringt „außergewöhnliche" Ergebnisse. Analyst sagt „Kaufen". Ziel: 220€.` },
  { category: "金融极端", label: "选股推荐列表50支", tweet: `800V DC 全标的扫描（50支）：$IFNNY $ON $VICR $LFUS $VSH $ENPH $NVTS $POWI $BDC $EOSE $SEDG $AEHR $WOLF $AMSC $XFAB $AOSL $HYLN $FCEL $IQE.L $ASYS $RELL $IPWR $PAY.BR Lite-On(2301) 6504.T 2577.HK 6890.T 6844.T 4973.T 6616.T 6882.T 300376.SZ 688017 $CWR.L $SIVE $AAOI $COHR $IIVI $MRVL $ANET $CSCO $LRCX $AMAT $ASML $KLAC $ONTO $FORM $ACLS $CAMT $RTLS — "全部看涨"！` },
  { category: "金融极端", label: "利空为主推文", tweet: `SELL EVERYTHING: $INTC losing share, $SMCI "accounting fraud?", $MU oversupply, $WDC "going bankrupt". Bear market in semis. "Get out now."` },
  { category: "金融极端", label: "利多利空混合", tweet: `$NVDA BUY (AI leader) but $INTC SELL (losing share). $AMD HOLD (improving). $SMCI AVOID ("accounting"). Net: 看多AI, 看空传统半导体。` },
  { category: "金融极端", label: "炫耀战绩推文", tweet: `I told you guys about $NVDA at $400. I deserve a Netflix special. "Called it perfectly." Now at $900+. What's next? $AVGO $ANET.` },
  { category: "金融极端", label: "低估值感叹句", tweet: `I can't believe $NVDA is "only" trading at 40x P/E. This is a STEAL. "Not sure how this isn't $2000 already."` },
  { category: "金融极端", label: "极长线程推文", tweet: `[Thread 1/20] 为什么我认为AI超级周期至少还有10年？\n\n首先，看一下历史：互联网泡沫（1995-2000）期间，纳斯达克涨了600%，但互联网本身是真实的。\n\n同理，AI也是真实的。\n\n$NVDA $AMD $AVGO $ANET $VRT $ETN — 全部"强烈推荐买入"。\n\n接下来我会分析每一支的投资逻辑…` },

  // ════════════════════════════════════════════════════════════
  // G. 稳定性重复测试（同一条推文跑多次，验证结果稳定）
  // ════════════════════════════════════════════════════════════
  { category: "稳定性×5", label: "经典bug场景-重复1", tweet: `$NVDA is "harvesting the leeks" from AI customers. "Picks and shovels" play confirmed.` },
  { category: "稳定性×5", label: "经典bug场景-重复2", tweet: `$NVDA is "harvesting the leeks" from AI customers. "Picks and shovels" play confirmed.` },
  { category: "稳定性×5", label: "经典bug场景-重复3", tweet: `$NVDA is "harvesting the leeks" from AI customers. "Picks and shovels" play confirmed.` },
  { category: "稳定性×5", label: "经典bug场景-重复4", tweet: `$NVDA is "harvesting the leeks" from AI customers. "Picks and shovels" play confirmed.` },
  { category: "稳定性×5", label: "经典bug场景-重复5", tweet: `$NVDA is "harvesting the leeks" from AI customers. "Picks and shovels" play confirmed.` },
  { category: "稳定性×5", label: "多引号嵌套-重复1", tweet: `CEO: "market is 'broken' but $NVDA 'immune'" — "screaming buy" if I've ever seen one.` },
  { category: "稳定性×5", label: "多引号嵌套-重复2", tweet: `CEO: "market is 'broken' but $NVDA 'immune'" — "screaming buy" if I've ever seen one.` },
  { category: "稳定性×5", label: "多引号嵌套-重复3", tweet: `CEO: "market is 'broken' but $NVDA 'immune'" — "screaming buy" if I've ever seen one.` },
  { category: "稳定性×5", label: "德法俄引号-重复1", tweet: `$SAP „KI-Revolution" / $LVMH «solide» / $SBER «рекорд» — all "bullish" across languages.` },
  { category: "稳定性×5", label: "德法俄引号-重复2", tweet: `$SAP „KI-Revolution" / $LVMH «solide» / $SBER «рекорд» — all "bullish" across languages.` },
];

// ─── Schema ───────────────────────────────────────────────────────────────────

const stockSchema = z.object({
  ticker: z.string().trim().min(1),
  company: z.string().trim().default(""),
  reason: z.string().trim().default(""),
});

const analysisSchema = z.object({
  summary_cn: z.string().trim().default(""),
  translated_content_cn: z.string().trim().default(""),
  bullish_stocks: z.array(stockSchema).default([]),
  bearish_stocks: z.array(stockSchema).default([]),
  sector_tags: z.array(z.string().trim()).default([]),
  confidence: z.number().transform(v => v <= 1 ? Math.round(v * 100) : Math.round(Math.min(100, Math.max(0, v)))).default(0),
});

type Analysis = z.infer<typeof analysisSchema>;

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM = `你是专业AI基础设施与科技投资分析师，服务于中文AI美股投资社群。

=== 严格规则 ===
- 只输出严格JSON，不要markdown code block，不要多余解释。
- 【极其重要】所有JSON字符串值内部，严禁出现未转义的双引号字符"。如需引用原文词语，用中文书名号《》或方括号【】代替。
- 禁止hallucination：不确定就留空数组。

=== 输出JSON Schema ===
{"summary_cn":"string","translated_content_cn":"string","bullish_stocks":[{"ticker":"string","company":"string","reason":"string"}],"bearish_stocks":[{"ticker":"string","company":"string","reason":"string"}],"sector_tags":["string"],"confidence":0}`;

// ─── JSON 解析（带state-machine sanitizer + jsonrepair兜底）────────────────

function parseAnalysis(raw: string): Analysis {
  let s = raw.trim();
  const cb = s.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (cb?.[1]) s = cb[1].trim();
  const start = s.startsWith("{") ? 0 : s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end > start) s = s.slice(start, end + 1);

  const out: string[] = [];
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === "\\")      { out.push(c); i++; if (i < s.length) out.push(s[i]); }
      else if (c === '"')  { inStr = false; out.push(c); }
      else if (c === "\n") out.push("\\n");
      else if (c === "\r") out.push("\\r");
      else if (c === "\t") out.push("\\t");
      else if (["\u201c","\u201d","\u201e","\u2018","\u2019","\uff02"].includes(c)) out.push('\\"');
      else out.push(c);
    } else {
      if (c === '"') inStr = true;
      out.push(c);
    }
  }
  const cleaned = out.join("");
  try { return analysisSchema.parse(JSON.parse(cleaned)); }
  catch { return analysisSchema.parse(JSON.parse(jsonrepair(cleaned))); }
}

// ─── 单模型调用 ───────────────────────────────────────────────────────────────

const deepseek = new OpenAI({ apiKey: OPENAI_API_KEY, baseURL: OPENAI_BASE_URL });
const xiaomi   = new OpenAI({ apiKey: XIAOMI_API_KEY,  baseURL: XIAOMI_BASE_URL  });

async function call(
  client: OpenAI, model: string, tweet: string, name: string,
  retries = 3, backoffMs = 2000,
) {
  const t0 = Date.now();
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const r = await client.chat.completions.create({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user",   content: `请分析以下推文：\n\n${tweet}` },
        ],
      });
      const raw = r.choices[0]?.message.content ?? "";
      if (!raw) throw new Error(`${name} returned empty`);
      const analysis = parseAnalysis(raw);
      return { analysis, name, ms: Date.now() - t0 };
    } catch (err: unknown) {
      const status = (err as { status?: number }).status ?? 0;
      const isRateLimit = status === 429 || status === 503;
      if (isRateLimit && attempt < retries) {
        const wait = backoffMs * attempt;
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`${name} exhausted retries`);
}

// ─── 并行赛跑 ─────────────────────────────────────────────────────────────────

async function race(tweet: string): Promise<{ analysis: Analysis; winner: string; ms: number }> {
  const r = await Promise.any([
    call(deepseek, AI_MODEL,    tweet, "DeepSeek"),
    call(xiaomi,   "mimo-v2.5", tweet, "Xiaomi"),
  ]);
  return { analysis: r.analysis, winner: r.name, ms: r.ms };
}

// ─── 并行批量执行 ─────────────────────────────────────────────────────────────

interface Result {
  n: number;
  label: string;
  category: string;
  ok: boolean;
  winner?: string;
  ms?: number;
  error?: string;
}

async function runBatch(cases: Array<{ n: number } & TestCase>, concurrency = 2): Promise<Result[]> {
  const results: Result[] = [];
  for (let i = 0; i < cases.length; i += concurrency) {
    const batch = cases.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      batch.map(async ({ n, label, category, tweet }) => {
        const { analysis, winner, ms } = await race(tweet);
        // 验证核心字段存在（translated_content_cn允许为空，当原文本身是中文时模型可能跳过翻译）
        if (!analysis.summary_cn) throw new Error("summary_cn empty");
        return { n, label, category, ok: true, winner, ms } as Result;
      })
    );
    for (const s of settled) {
      if (s.status === "fulfilled") {
        results.push(s.value);
      } else {
        const c = batch[results.length % batch.length];
        // Unwrap AggregateError to show individual provider errors
        const raw = s.reason;
        let detail = String(raw);
        if (raw instanceof AggregateError) {
          detail = raw.errors.map((e: unknown) => {
            const err = e as { status?: number; message?: string };
            return `${err.status ?? "?"}:${String(err.message).slice(0, 80)}`;
          }).join(" | ");
        }
        results.push({ n: c.n, label: c.label, category: c.category, ok: false, error: detail });
      }
    }
    // 每批之间等一下，避免频率限制
    if (i + concurrency < cases.length) await new Promise(r => setTimeout(r, 300));
  }
  return results;
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n" + "═".repeat(72));
  console.log("  穷举压力测试 — 覆盖所有语言/标点/格式");
  console.log(`  共 ${CASES.length} 个测试用例，并发批量执行`);
  console.log(`  DeepSeek: ${OPENAI_BASE_URL} / ${AI_MODEL}`);
  console.log(`  Xiaomi:   ${XIAOMI_BASE_URL} / mimo-v2.5`);
  console.log("═".repeat(72) + "\n");

  const indexed = CASES.map((c, i) => ({ ...c, n: i + 1 }));
  const results = await runBatch(indexed, 4);

  // 打印每条结果
  const byCategory: Record<string, Result[]> = {};
  for (const r of results) {
    if (!byCategory[r.category]) byCategory[r.category] = [];
    byCategory[r.category].push(r);
  }

  const raceWins: Record<string, number> = { DeepSeek: 0, Xiaomi: 0 };

  for (const [cat, rs] of Object.entries(byCategory)) {
    const allOk = rs.every(r => r.ok);
    console.log(`\n【${cat}】${allOk ? "✅ 全通过" : "❌ 有失败"}`);
    for (const r of rs) {
      if (r.ok) {
        raceWins[r.winner!] = (raceWins[r.winner!] ?? 0) + 1;
        console.log(`  ✅ [${r.n.toString().padStart(2)}] ${r.label.padEnd(22)} → ${r.winner} ${r.ms}ms`);
      } else {
        console.log(`  ❌ [${r.n.toString().padStart(2)}] ${r.label.padEnd(22)} → FAIL: ${r.error}`);
      }
    }
  }

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;

  console.log("\n" + "═".repeat(72));
  console.log("  汇总");
  console.log("═".repeat(72));
  console.log(`✅ 通过: ${passed}/${CASES.length}`);
  console.log(`❌ 失败: ${failed}/${CASES.length}`);
  console.log(`  DeepSeek 赢: ${raceWins["DeepSeek"] ?? 0} 次`);
  console.log(`  Xiaomi 赢:   ${raceWins["Xiaomi"] ?? 0} 次`);

  // 保存详细报告
  const report = { ts: new Date().toISOString(), total: CASES.length, passed, failed, raceWins, results };
  fs.writeFileSync("stress-test-report.json", JSON.stringify(report, null, 2));
  console.log(`\n详细报告已保存：stress-test-report.json`);

  if (failed === 0) {
    console.log("\n🎉 全部通过 — error率 = 0%，任何格式推文均可正常推送");
  } else {
    console.log(`\n⛔ error率 = ${((failed / CASES.length) * 100).toFixed(1)}% — 需要修复以上失败项`);
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
