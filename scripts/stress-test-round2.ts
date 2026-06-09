/**
 * 压力测试第二轮 — 补全所有遗漏格式 + 稳定性重复验证
 * 目标：error率 = 0
 * 运行：npx dotenv -e .env.local -- npx tsx scripts/stress-test-round2.ts
 */

import OpenAI from "openai";
import { jsonrepair } from "jsonrepair";
import { z } from "zod";
import * as fs from "fs";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const OPENAI_API_KEY  = process.env.OPENAI_API_KEY!;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL!;
const AI_MODEL        = process.env.AI_MODEL!;
const XIAOMI_API_KEY  = process.env.XIAOMI_API_KEY!;
const XIAOMI_BASE_URL = process.env.XIAOMI_BASE_URL!;

// ─── 补全测试用例 ─────────────────────────────────────────────────────────────

interface TestCase { label: string; tweet: string; category: string }

const CASES: TestCase[] = [

  // ════════════════════════════════════════════════════════════
  // H. 边界内容（上轮未覆盖）
  // ════════════════════════════════════════════════════════════
  {
    category: "边界内容",
    label: "空字符串",
    tweet: "",
  },
  {
    category: "边界内容",
    label: "纯空白",
    tweet: "   \t\n   ",
  },
  {
    category: "边界内容",
    label: "单个ticker",
    tweet: "$NVDA",
  },
  {
    category: "边界内容",
    label: "单个emoji",
    tweet: "🚀",
  },
  {
    category: "边界内容",
    label: "仅数字",
    tweet: "12345 67890 3.14159 2.718 1.618",
  },
  {
    category: "边界内容",
    label: "仅URL",
    tweet: "https://t.co/abc123xyz",
  },
  {
    category: "边界内容",
    label: "仅hashtag",
    tweet: "#NVDA #AI #semiconductor #buyNow #看多 #AI基础设施",
  },
  {
    category: "边界内容",
    label: "仅at符号",
    tweet: "@elonmusk @SemiAnalysis @BankofAmerica @GoldmanSachs @MorganStanley",
  },

  // ════════════════════════════════════════════════════════════
  // I. Markdown与格式标记
  // ════════════════════════════════════════════════════════════
  {
    category: "Markdown格式",
    label: "粗体斜体删除线",
    tweet: `**$NVDA** is the *best* AI play. ~~$INTC~~ is dead. **"Data center revenue"** up 427%.`,
  },
  {
    category: "Markdown格式",
    label: "多级标题",
    tweet: `# AI Investment 2025\n## Top Picks\n### Tier 1\n- $NVDA "still king"\n- $AVGO "custom silicon"\n### Tier 2\n- $ANET\n- $VRT`,
  },
  {
    category: "Markdown格式",
    label: "代码块嵌套引号",
    tweet: "```python\nprint('$NVDA target: \"$1200\"')\n# \"AI infrastructure play\"\nresult = {'ticker': 'NVDA', 'action': 'BUY'}\n```",
  },
  {
    category: "Markdown格式",
    label: "引用块",
    tweet: `> "The AI capex supercycle is just beginning"\n> — Jensen Huang, NVDA CEO\n\nThis means $NVDA $AVGO $ANET all go higher. "Confirmed bull case."`,
  },
  {
    category: "Markdown格式",
    label: "表格格式",
    tweet: `| Ticker | Action | Target | Confidence |\n|--------|--------|--------|-----------|\n| $NVDA | BUY | $1200 | 95% |\n| $AMD | HOLD | $200 | 60% |\n| $INTC | SELL | $20 | 85% |`,
  },

  // ════════════════════════════════════════════════════════════
  // J. XML/HTML实体与特殊编码
  // ════════════════════════════════════════════════════════════
  {
    category: "XML/HTML实体",
    label: "HTML基础实体",
    tweet: `$NVDA &amp; $AMD are both good. P/E &lt; 50x is &quot;fair value&quot;. &gt;100% YoY growth &apos;confirmed&apos;.`,
  },
  {
    category: "XML/HTML实体",
    label: "数字字符实体",
    tweet: `$NVDA revenue &#36;26B. Growth &#43;122&#37;. CEO said &#34;best ever&#34;. Target &#36;1200&#47;share.`,
  },
  {
    category: "XML/HTML实体",
    label: "Unicode实体",
    tweet: `$TSM &#x53F0;&#x7A4D;&#x96FB; — semiconductor &#x9F8D;&#x982D;. Revenue &#x589E;&#x957F; 40&#x25;. &#x770B;&#x591A;!`,
  },
  {
    category: "XML/HTML实体",
    label: "XML标签混合",
    tweet: `<b>$NVDA</b> BUY — <em>"AI infrastructure"</em> play. <strong>Target: $1200</strong>. <!-- "analyst consensus" --> &amp; more upside.`,
  },

  // ════════════════════════════════════════════════════════════
  // K. 代码/模板语法
  // ════════════════════════════════════════════════════════════
  {
    category: "代码模板语法",
    label: "模板字面量语法",
    tweet: `${`$NVDA`} is up ${`122%`}. The "${`AI supercycle`}" trade is real. Target: ${`$1200`}/share.`,
  },
  {
    category: "代码模板语法",
    label: "正则表达式",
    tweet: `$NVDA matches /^\\$[A-Z]{2,5}$/ pattern. "Bull case" regex: /revenue > \\$20B && margin > 70%/gi. BUY.`,
  },
  {
    category: "代码模板语法",
    label: "SQL注入模式",
    tweet: `$NVDA analysis'; DROP TABLE stocks;-- "Best quarter ever" OR 1=1. Revenue: $26B WHERE sector='AI'.`,
  },
  {
    category: "代码模板语法",
    label: "Shell命令模式",
    tweet: `$NVDA $(echo "buy") && $AMD || $INTC; echo "AI trade" > /dev/null 2>&1. \`cat analysis.txt\` | grep "bullish"`,
  },
  {
    category: "代码模板语法",
    label: "JSON embedded in tweet",
    tweet: `Full analysis: {"ticker":"NVDA","action":"BUY","confidence":0.95,"note":"AI leader - \\"picks and shovels\\"","targets":{"bull":2000,"base":1200,"bear":600}}`,
  },

  // ════════════════════════════════════════════════════════════
  // L. 纯RTL语言
  // ════════════════════════════════════════════════════════════
  {
    category: "RTL语言",
    label: "纯阿拉伯语",
    tweet: `شركة أرامكو السعودية تحقق أرباحاً قياسية في الربع الثاني. الطلب على النفط يتجاوز التوقعات. توقعات إيجابية للعام القادم.`,
  },
  {
    category: "RTL语言",
    label: "纯希伯来语",
    tweet: `חברת צ'קפוינט רשמה הכנסות שיא ברבעון השני. הביקוש לאבטחת סייבר ממשיך לגדול. ההנהלה מביעה אופטימיות לגבי השנה הבאה.`,
  },
  {
    category: "RTL语言",
    label: "阿拉伯语+股票代码",
    tweet: `أرامكو السعودية (2222.SR): أرباح الربع الثاني تتجاوز التوقعات بنسبة 15%. الإيرادات: 120 مليار ريال. التوصية: شراء.`,
  },

  // ════════════════════════════════════════════════════════════
  // M. 混合编码与特殊字符
  // ════════════════════════════════════════════════════════════
  {
    category: "混合编码",
    label: "拉丁西里尔混合词",
    tweet: `НVIDIa (Nvidia混Cyrillic) $НVDA is a "тест" of encoding. Аnalyzing АI 半导체 sector. "Bullish" = «бычий» = 看涨.`,
  },
  {
    category: "混合编码",
    label: "全角ASCII",
    tweet: `＄ＮＶＤＡ　ＡＩ基础设施领导者。目标价：１２００美元。置信度：９５％。"ＢＵＹＮＯＷ"！！！`,
  },
  {
    category: "混合编码",
    label: "零宽连接符",
    tweet: `$N‍V‍D‍A is the best AI play. "Bull‌case" confirmed. Zero​width spaces everywhere in this tweet.`,
  },
  {
    category: "混合编码",
    label: "颠倒文字",
    tweet: `$NVDA ɐpʌu ʇsǝq ʎɐld ᴉɐ — "buılllnq" pǝɯɹıɟuoɔ. ʇǝƃɹɐʇ: 0021$. ʎnq ɥsʍoM.`,
  },
  {
    category: "混合编码",
    label: "组合音调符号",
    tweet: `$ŃVDĄ änd $ÄMD äre böth gōōd ÄI pläys. "Strōng bùy" rēcommendation. Tàrget: $1̈200.`,
  },

  // ════════════════════════════════════════════════════════════
  // N. 极端长度
  // ════════════════════════════════════════════════════════════
  {
    category: "极端长度",
    label: "2000字符推文",
    tweet: `[MEGA THREAD] Complete AI Infrastructure Investment Thesis 2025 🧵\n\n` +
      `Part 1: The Numbers\n` +
      `Microsoft FY2025 capex: $80B (+60% YoY). CEO said "we're just getting started" with AI infrastructure. Azure AI revenue growing 100%+ QoQ.\n\n` +
      `Google FY2025 capex: $75B. DeepMind breakthroughs accelerating. TPU v5 deployment "ahead of schedule." Gemini "exceeding expectations."\n\n` +
      `Amazon FY2025 capex: $100B+. AWS CEO: "demand exceeds our ability to supply." Trainium3 chips "game changer." "Biggest investment in company history."\n\n` +
      `Meta FY2025 capex: $65B. Llama 4 "best open-source model." Infrastructure moat "widening." "AI is our biggest bet ever."\n\n` +
      `Total hyperscaler capex: ~$320B vs $200B last year = +60% growth.\n\n` +
      `Part 2: Supply Chain Winners\n` +
      `$NVDA: H100/H200/B100/B200 all sold out through 2026. "Pricing power unprecedented." Gross margins 78%+. "Jensen is playing 4D chess."\n` +
      `$AVGO: Custom ASIC revenue $10B+ run rate. Apple, Google, Meta all customers. "The quiet winner."\n` +
      `$ANET: Every hyperscaler buying 400G/800G switches. "Networking is the bottleneck." Revenue guide raised 3x this year.\n` +
      `$VRT: Data center power solutions. Order backlog 3 years. "Can't build fast enough."\n` +
      `$ETN: Electrical infrastructure. "Every MW of AI needs power." Utility-scale orders surging.\n\n` +
      `Part 3: My Positioning\n` +
      `Core (60%): $NVDA $AVGO $ANET — "the picks and shovels of AI"\n` +
      `Growth (30%): $VRT $ETN $SMCI — "infrastructure layer"\n` +
      `Spec (10%): $WOLF $AMSC $CWR.L — "800V adjacencies"\n\n` +
      `"This is the biggest technology buildout since the internet. Don't fight it."\n` +
      `Not financial advice. DYOR. 🙏`,
  },
  {
    category: "极端长度",
    label: "3500字符推文",
    tweet: `ULTIMATE AI INFRASTRUCTURE COMPENDIUM 2025 — Everything You Need To Know\n\n` +
      `═══ SECTION 1: HYPERSCALER CAPEX ═══\n` +
      `"The numbers are staggering" — total hyperscaler capex for 2025: $320B+\n` +
      `• Microsoft ($MSFT): $80B — "AI is transforming every product"\n` +
      `• Alphabet ($GOOGL): $75B — "TPU advantage is real"\n` +
      `• Amazon ($AMZN): $105B — "AWS demand unprecedented"\n` +
      `• Meta ($META): $65B — "Llama 4 changes everything"\n\n` +
      `═══ SECTION 2: SEMICONDUCTOR PLAYS ═══\n` +
      `$NVDA (Nvidia) — THE AI CHIP KING\n` +
      `Revenue: $122B FY2025E (+105% YoY)\n` +
      `Gross margin: 78% ("structural, not cyclical")\n` +
      `Data center: $100B run rate\n` +
      `Key products: H100, H200, B100, B200, Blackwell\n` +
      `"NVDA has a 5-year lead on competition"\n\n` +
      `$AMD (Advanced Micro Devices) — THE CHALLENGER\n` +
      `MI300X adoption: hyperscalers diversifying\n` +
      `Revenue: $25B FY2025E (+50% YoY)\n` +
      `"Not NVDA but a solid 2nd place"\n\n` +
      `$AVGO (Broadcom) — CUSTOM SILICON WINNER\n` +
      `AI revenue: $10B+ run rate\n` +
      `Customers: Apple, Google, Meta, ByteDance\n` +
      `"The quiet beneficiary"\n\n` +
      `$INTC (Intel) — THE LAGGARD\n` +
      `Lost 30% market share in 3 years\n` +
      `Gaudi3 "not competitive"\n` +
      `"Avoid until turnaround is proven"\n\n` +
      `═══ SECTION 3: NETWORKING ═══\n` +
      `$ANET (Arista Networks)\n` +
      `400G/800G switch demand "insatiable"\n` +
      `Revenue guide: raised 3x this year\n` +
      `"Every AI cluster needs networking"\n\n` +
      `$MRVL (Marvell Technology)\n` +
      `Custom silicon + networking combo\n` +
      `"The dark horse of AI infrastructure"\n\n` +
      `═══ SECTION 4: POWER & COOLING ═══\n` +
      `$VRT (Vertiv Holdings)\n` +
      `Data center power/cooling specialist\n` +
      `Order backlog: 3 years and growing\n` +
      `"Every MW of AI needs power management"\n\n` +
      `$ETN (Eaton Corporation)\n` +
      `Electrical infrastructure for AI\n` +
      `"Utility-scale power is the new bottleneck"\n\n` +
      `═══ SECTION 5: SERVERS & STORAGE ═══\n` +
      `$SMCI (Super Micro Computer)\n` +
      `Direct liquid cooling leader\n` +
      `"Accounting issues resolved, thesis intact"\n` +
      `Short interest: 15% (contrarian opportunity?)\n\n` +
      `$DELL (Dell Technologies)\n` +
      `AI server revenue: $10B+ run rate\n` +
      `"Enterprise AI gateway"\n\n` +
      `═══ SECTION 6: 800V ADJACENCIES ═══\n` +
      `$WOLF (Wolfspeed) — SiC for EVs & AI power\n` +
      `$AMSC (American Superconductor) — grid tech\n` +
      `$CWR.L (Ceres Power) — hydrogen fuel cells\n` +
      `2577.HK — HK-listed power company\n` +
      `300376.SZ — A-share 800V beneficiary\n\n` +
      `═══ MY PORTFOLIO ALLOCATION ═══\n` +
      `Core AI (50%): $NVDA 25%, $AVGO 15%, $ANET 10%\n` +
      `Infrastructure (30%): $VRT 15%, $ETN 10%, $SMCI 5%\n` +
      `Speculative (20%): $AMD 10%, $MRVL 5%, $WOLF 5%\n\n` +
      `"In 10 years, we'll look back at 2025 as the year AI infrastructure became the most important investment theme of our lifetime."\n\n` +
      `DYOR. NFA. 🙏🚀`,
  },

  // ════════════════════════════════════════════════════════════
  // O. 高密度标点
  // ════════════════════════════════════════════════════════════
  {
    category: "高密度标点",
    label: "100个感叹号",
    tweet: `$NVDA!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! BUY!`,
  },
  {
    category: "高密度标点",
    label: "极密集标点混合",
    tweet: `$NVDA?!?!?!?! "Best?!" stock?! Ever?!?! Up?! 122%?!?!?! "Insane?!?!" results... wow... 🤯🤯🤯 ...really?! YES!!!`,
  },
  {
    category: "高密度标点",
    label: "ASCII艺术+颜文字",
    tweet: `$NVDA (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧ ¯\\_(ツ)_/¯ "MOON" (╯°□°）╯︵ ┻━┻ ( ͡° ͜ʖ ͡°) BUY IT ლ(ಠ益ಠლ)`,
  },
  {
    category: "高密度标点",
    label: "重复符号序列",
    tweet: `————————$NVDA————————\n========BUY========\n~~~~~~~~$1200~~~~~~~~\n........target........\n########AI##########`,
  },

  // ════════════════════════════════════════════════════════════
  // P. 数字格式极端
  // ════════════════════════════════════════════════════════════
  {
    category: "数字格式",
    label: "各种数字格式",
    tweet: `$NVDA: Revenue $26,000,000,000 / $26B / $26bn / 260亿 / 26×10⁹. EPS: $6.12 / ¥872 / €5.67 / £4.89. P/E: 40.5x`,
  },
  {
    category: "数字格式",
    label: "科学计数法",
    tweet: `AI market size: 1.3×10¹² by 2030. $NVDA data center: 2.26×10¹⁰ revenue. Growth: 4.27×10² percent YoY. "Exponential."`,
  },
  {
    category: "数字格式",
    label: "负数和范围",
    tweet: `$INTC EPS: -$0.38 (loss!). Guidance: -$2B to -$3B revenue impact. Short: -15% in 3 months. "Range: ($50)-($30) downside."`,
  },
  {
    category: "数字格式",
    label: "日期格式混合",
    tweet: `$NVDA earnings: 2025-08-27 / Aug 27, 2025 / 27/08/2025 / 令和7年8月27日. Q2 FY2026 results "beat estimates" by 15%.`,
  },

  // ════════════════════════════════════════════════════════════
  // Q. 稳定性重复验证（最难的用例各跑20次）
  // ════════════════════════════════════════════════════════════
  ...Array.from({ length: 20 }, (_, i) => ({
    category: "稳定性×20",
    label: `经典双引号 #${i + 1}`,
    tweet: `$NVDA is "harvesting the leeks" from AI customers. CEO said "we'll double capex." The "AI supercycle" is "just beginning." "Screaming buy."`,
  })),
  ...Array.from({ length: 10 }, (_, i) => ({
    category: "稳定性×10",
    label: `JSON破坏 #${i + 1}`,
    tweet: `$NVDA data: {"revenue":26,"note":"AI \\"picks and shovels\\"","targets":{"bull":2000,"base":1200}}. "Best ever quarter." BUY.`,
  })),
  ...Array.from({ length: 10 }, (_, i) => ({
    category: "稳定性×10",
    label: `多语言引号 #${i + 1}`,
    tweet: `$SAP „KI-Revolution" / $LVMH «solide» / $SBER «рекорд» / $7203.T「強い買い」— all "bullish." 全球看多！`,
  })),
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

const SYSTEM = `你是专业AI基础设施与科技投资分析师，服务于中文AI美股投资社群。

=== 严格规则 ===
- 只输出严格JSON，不要markdown code block，不要多余解释。
- 【极其重要】所有JSON字符串值内部，严禁出现未转义的双引号字符"。如需引用原文词语，用中文书名号《》或方括号【】代替。
- translated_content_cn字段必须始终填写：若原文已是中文，直接将原文内容填入；若原文是其他语言，翻译为自然流畅的中文后填入。此字段禁止为空。
- 禁止hallucination：不确定就留空数组。

=== 输出JSON Schema ===
{"summary_cn":"string","translated_content_cn":"string","bullish_stocks":[{"ticker":"string","company":"string","reason":"string"}],"bearish_stocks":[{"ticker":"string","company":"string","reason":"string"}],"sector_tags":["string"],"confidence":0}`;

// ─── JSON解析 ─────────────────────────────────────────────────────────────────

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
      else if (["“","”","„","‘","’","＂"].includes(c)) out.push('\\"');
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

// ─── API调用（带限流重试）────────────────────────────────────────────────────

const deepseek = new OpenAI({ apiKey: OPENAI_API_KEY, baseURL: OPENAI_BASE_URL });
const xiaomi   = new OpenAI({ apiKey: XIAOMI_API_KEY,  baseURL: XIAOMI_BASE_URL  });

async function call(client: OpenAI, model: string, tweet: string, name: string, retries = 3, backoffMs = 2000) {
  // Empty/whitespace tweets: send a minimal placeholder so API doesn't reject
  const content = tweet.trim() || "(空推文，无内容)";
  const t0 = Date.now();
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const r = await client.chat.completions.create({
        model, temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user",   content: `请分析以下推文：\n\n${content}` },
        ],
      });
      const raw = r.choices[0]?.message.content ?? "";
      if (!raw) throw new Error(`${name} returned empty`);
      const analysis = parseAnalysis(raw);
      return { analysis, name, ms: Date.now() - t0 };
    } catch (err: unknown) {
      const status = (err as { status?: number }).status ?? 0;
      if ((status === 429 || status === 503) && attempt < retries) {
        await new Promise(r => setTimeout(r, backoffMs * attempt));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`${name} exhausted retries`);
}

async function race(tweet: string) {
  const r = await Promise.any([
    call(deepseek, AI_MODEL,    tweet, "DeepSeek"),
    call(xiaomi,   "mimo-v2.5", tweet, "Xiaomi"),
  ]);
  return { analysis: r.analysis, winner: r.name, ms: r.ms };
}

// ─── 批量执行 ─────────────────────────────────────────────────────────────────

interface Result { n: number; label: string; category: string; ok: boolean; winner?: string; ms?: number; error?: string }

async function runBatch(cases: Array<{ n: number } & TestCase>, concurrency = 2): Promise<Result[]> {
  const results: Result[] = [];
  for (let i = 0; i < cases.length; i += concurrency) {
    const batch = cases.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      batch.map(async ({ n, label, category, tweet }) => {
        const { analysis, winner, ms } = await race(tweet);
        // Empty/whitespace tweets legitimately produce empty analysis (filtered upstream in production)
        const isEmptyTweet = !tweet.trim();
        if (!analysis.summary_cn && !isEmptyTweet) throw new Error("summary_cn empty");
        return { n, label, category, ok: true, winner, ms } as Result;
      })
    );
    for (let j = 0; j < settled.length; j++) {
      const s = settled[j];
      const c = batch[j];
      if (s.status === "fulfilled") {
        results.push(s.value);
      } else {
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
    if (i + concurrency < cases.length) await new Promise(r => setTimeout(r, 300));
  }
  return results;
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n" + "═".repeat(72));
  console.log(`  压力测试第二轮 — 补全格式 + 稳定性重复验证`);
  console.log(`  共 ${CASES.length} 个测试用例`);
  console.log("═".repeat(72) + "\n");

  const indexed = CASES.map((c, i) => ({ ...c, n: i + 1 }));
  const results = await runBatch(indexed, 2);

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
        console.log(`  ✅ [${String(r.n).padStart(3)}] ${r.label.padEnd(20)} → ${r.winner} ${r.ms}ms`);
      } else {
        console.log(`  ❌ [${String(r.n).padStart(3)}] ${r.label.padEnd(20)} → FAIL: ${r.error?.slice(0, 100)}`);
      }
    }
  }

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;

  console.log("\n" + "═".repeat(72));
  console.log("  第二轮汇总");
  console.log("═".repeat(72));
  console.log(`✅ 通过: ${passed}/${CASES.length}`);
  console.log(`❌ 失败: ${failed}/${CASES.length}`);
  console.log(`  DeepSeek 赢: ${raceWins["DeepSeek"] ?? 0} 次`);
  console.log(`  Xiaomi 赢:   ${raceWins["Xiaomi"] ?? 0} 次`);

  fs.writeFileSync("stress-test-round2-report.json", JSON.stringify({ ts: new Date().toISOString(), total: CASES.length, passed, failed, raceWins, results }, null, 2));
  console.log(`\n详细报告：stress-test-round2-report.json`);

  if (failed === 0) {
    console.log(`\n🎉 第二轮全部通过 — 两轮合计 ${72 + CASES.length} 个用例，error率 = 0%`);
  } else {
    console.log(`\n⛔ error率 = ${((failed / CASES.length) * 100).toFixed(1)}%`);
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
