/**
 * 完整流水线压力测试
 * 测试内容：各种奇葩格式推文 → AI并行分析 → WxPusher渲染
 * 运行：bun run stress-test
 */

import OpenAI from "openai";
import { jsonrepair } from "jsonrepair";
import { z } from "zod";

// ─── 读取环境变量 ─────────────────────────────────────────────────────────────

const env = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL!,
  AI_MODEL: process.env.AI_MODEL!,
  XIAOMI_API_KEY: process.env.XIAOMI_API_KEY!,
  XIAOMI_BASE_URL: process.env.XIAOMI_BASE_URL!,
};

// ─── 测试推文（覆盖所有极端情况）────────────────────────────────────────────

const TEST_CASES: Array<{ label: string; tweet: string }> = [
  {
    label: "英文双引号（经典bug场景）",
    tweet: `$NVDA is "harvesting the leeks" from its AI customers. The "picks and shovels" play is real. CEO said "we'll double capex" — I'm "not surprised" at all.`,
  },
  {
    label: "嵌套引号",
    tweet: `CEO said "the market is 'broken' but $NVDA is 'immune'" — that's a "screaming buy" if I've ever seen one. Not financial advice, but "come on."`,
  },
  {
    label: "多行+编号列表",
    tweet: `Top 5 AI infra picks for 2025:
1. $NVDA — still the "king"
2. $AVGO — custom silicon
3. $ANET — networking
4. $SMCI — servers
5. $VRT — power

"None of these are going away anytime soon."
Thread 🧵`,
  },
  {
    label: "中英日混合",
    tweet: `$TSM (台積電) Q2業績超預想。TSMCの売上が急増。Revenue up 40% YoY — "unprecedented" demand from AI customers. 半导体供应链全面受益。`,
  },
  {
    label: "反斜杠+数学公式",
    tweet: `$NVDA P/E ratio: P\\E = 40x vs historical avg of 25x. The EV\\EBITDA spread is "insane" right now. If you model DCF with r=10%, you get fair value of ~$1200\\share. Bull case: $2000+`,
  },
  {
    label: "大量emoji+特殊符号",
    tweet: `🚨🚨🚨 BREAKING: $NVDA beats estimates!!!
📈 Revenue: $26B (+122% YoY) ✅
📈 EPS: $6.12 (est. $5.59) ✅
🔥 Data center: $22.6B (+427%!!!) 🤯
⚠️ Next Q guidance: $28B ± $1B
💡 "The AI infrastructure buildout is just beginning" — CEO
#NVDA #AI #semiconductors 🇺🇸`,
  },
  {
    label: "百分比+货币+括号混合",
    tweet: `$SMCI down 30% after "accounting issues" (again). Short interest at 25% (!) vs sector avg 5%.
Comp: $DELL (+15%), $HPE (+8%) — market rotating out of SMCI.
Risk/reward: (upside 50%) vs (downside 70%) — I'm staying out.
P.S. 300376.SZ (A-stock equivalent) also worth watching.`,
  },
  {
    label: "纯A股+港股推文",
    tweet: `今天重点关注几个标的：
- 300376.SZ（国民技术）：800V DC直接受益，估值只有20倍PE
- 2577.HK（上汽集团）：港股折价明显，股息率6%+
- 688017（绿的谐波）：机器人减速器龙头，"确定性最强"的一个
注意：这些都是A/H股，美股券商不一定能买，请自行确认！`,
  },
  {
    label: "极长推文+分割线",
    tweet: `MEGA THREAD: Everything you need to know about the AI capex supercycle 🧵

━━━━━━━━━━━━━━━━━━━━
PART 1: THE NUMBERS
━━━━━━━━━━━━━━━━━━━━

Microsoft: $80B capex FY2025 ("we're just getting started")
Google: $75B capex ("demand exceeds supply")
Amazon: $100B+ ("biggest investment in company history")
Meta: $60-65B ("infrastructure is the moat")

Total: ~$315B — up from $200B last year (+57%)

━━━━━━━━━━━━━━━━━━━━
PART 2: WHO BENEFITS
━━━━━━━━━━━━━━━━━━━━

Chips: $NVDA $AMD $INTC $AVGO
Networking: $ANET $CSCO $MRVL
Power: $VRT $ETN $EATON
Cooling: $SMCI $DELL
Storage: $WDC $STX

━━━━━━━━━━━━━━━━━━━━
PART 3: MY POSITIONING
━━━━━━━━━━━━━━━━━━━━

70% in "core" AI infra ($NVDA $AVGO $ANET)
20% in "picks & shovels" ($VRT $ETN)
10% cash — waiting for "pullback"

"This is the biggest infrastructure buildout in human history."
Not financial advice. DYOR.`,
  },
  {
    label: "反讽+复杂语气",
    tweet: `"Wow, $INTC only lost 20% market share this quarter — incredible execution!" 🙄
I can't believe the street is still giving this a $90B market cap.
Meanwhile $AMD is just... *checks notes* ...eating their lunch, dinner, AND breakfast.
"But the turnaround is coming!" — sure buddy, been saying that since 2021.
Short $INTC, long $AMD. Simple.`,
  },
  {
    label: "URL+at符号+特殊格式",
    tweet: `Just published my full analysis: https://t.co/abc123
Key points re: $NVDA vs $AMD debate:
- NVDA H100 @ $30k/unit → margin ~70%
- AMD MI300X @ $15k/unit → margin ~50%
cc: @SemiconductorPro @AIInvestor
P.S. $SMCI chart looks like a "falling knife" 📉 — avoid!`,
  },
  {
    label: "制表符+不规则空白",
    tweet: "Sector\t\tTicker\t\tRating\nAI Chips\t$NVDA\t\tBUY\nNetworking\t$ANET\t\tBUY\nPower\t\t$VRT\t\tBUY\nServers\t\t$SMCI\t\tSELL\n\n\"The AI trade is NOT over.\"",
  },
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
  confidence: z.number().int().min(0).max(100).default(0),
});

type Analysis = z.infer<typeof analysisSchema>;

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM = `你是专业 AI 基础设施与科技投资分析师，服务于中文 AI 美股投资社群。

=== 严格规则 ===
- 只输出严格 JSON，不要 markdown code block，不要多余解释。
- 【极其重要】所有 JSON 字符串值内部，严禁出现未转义的双引号字符 "。如需引用原文词语，用中文书名号《》或方括号【】代替，绝对不允许在 JSON 字符串中使用 " 字符，否则会导致 JSON 解析失败、推送中断、用户投诉。

=== 输出 JSON Schema ===
{"summary_cn":"string","translated_content_cn":"string","bullish_stocks":[{"ticker":"string","company":"string","reason":"string"}],"bearish_stocks":[{"ticker":"string","company":"string","reason":"string"}],"sector_tags":["string"],"confidence":0}`;

// ─── JSON 提取+修复 ───────────────────────────────────────────────────────────

function sanitizeAndParse(raw: string): Analysis {
  let s = raw.trim();

  // 去掉 markdown code block
  const cb = s.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (cb?.[1]) s = cb[1].trim();

  // 定位 JSON 对象
  const start = s.startsWith("{") ? 0 : s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end > start) s = s.slice(start, end + 1);

  // 状态机：只在字符串值内部修复危险字符
  const out: string[] = [];
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === "\\") { out.push(c); i++; if (i < s.length) out.push(s[i]); }
      else if (c === '"') { inStr = false; out.push(c); }
      else if (c === "\n") out.push("\\n");
      else if (c === "\r") out.push("\\r");
      else if (c === "\t") out.push("\\t");
      else if (c === "“" || c === "”" || c === "„" ||
               c === "‘" || c === "’" || c === "＂") out.push('\\"');
      else out.push(c);
    } else {
      if (c === '"') inStr = true;
      out.push(c);
    }
  }
  const cleaned = out.join("");

  // 先直接parse，失败再jsonrepair
  try {
    return analysisSchema.parse(JSON.parse(cleaned));
  } catch {
    return analysisSchema.parse(JSON.parse(jsonrepair(cleaned)));
  }
}

// ─── 单个模型调用 ─────────────────────────────────────────────────────────────

async function callModel(
  client: OpenAI,
  model: string,
  tweet: string,
  label: string,
): Promise<{ analysis: Analysis; provider: string; ms: number }> {
  const t0 = Date.now();
  const r = await client.chat.completions.create({
    model,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `请分析以下推文：\n\n${tweet}` },
    ],
  });
  const raw = r.choices[0]?.message.content ?? "";
  if (!raw) throw new Error(`${label} returned empty content`);
  const analysis = sanitizeAndParse(raw);
  return { analysis, provider: label, ms: Date.now() - t0 };
}

// ─── 并行赛跑 ─────────────────────────────────────────────────────────────────

const deepseekClient = new OpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_BASE_URL });
const xiaomiClient   = new OpenAI({ apiKey: env.XIAOMI_API_KEY,  baseURL: env.XIAOMI_BASE_URL  });

async function raceAnalyze(tweet: string): Promise<{
  analysis: Analysis;
  winner: string;
  winnerMs: number;
  loserResult: "also_ok" | "failed" | "slower";
}> {
  type Result = { analysis: Analysis; provider: string; ms: number };
  const results: Array<{ provider: string; ms: number; ok: boolean }> = [];

  const deepseekPromise = callModel(deepseekClient, env.AI_MODEL, tweet, "DeepSeek")
    .then(r => { results.push({ provider: r.provider, ms: r.ms, ok: true }); return r; });
  const xiaomiPromise = callModel(xiaomiClient, "mimo-v2.5", tweet, "Xiaomi")
    .then(r => { results.push({ provider: r.provider, ms: r.ms, ok: true }); return r; });

  let winner: Result;
  try {
    winner = await Promise.any([deepseekPromise, xiaomiPromise]);
  } catch (aggErr) {
    const errs = aggErr instanceof AggregateError ? aggErr.errors : [aggErr];
    throw new Error(`Both providers failed: ${errs.map((e: unknown) => e instanceof Error ? e.message : String(e)).join(" | ")}`);
  }

  // 等另一个也完成（不管成败），记录对比
  const loserOk = await Promise.allSettled([deepseekPromise, xiaomiPromise])
    .then(rs => rs.filter(r => r.status === "fulfilled" && (r.value as Result).provider !== winner.provider)
      .some(() => true));

  return {
    analysis: winner.analysis,
    winner: winner.provider,
    winnerMs: winner.ms,
    loserResult: loserOk ? "also_ok" : "failed",
  };
}

// ─── 渲染WxPusher消息（简化版，验证字段完整性）──────────────────────────────

function renderPreview(tweet: string, analysis: Analysis, winner: string, ms: number): string {
  const bullish = analysis.bullish_stocks.map(s => `  📈 ${s.ticker} — ${s.reason.slice(0, 40)}`).join("\n") || "  （无）";
  const bearish = analysis.bearish_stocks.map(s => `  📉 ${s.ticker} — ${s.reason.slice(0, 40)}`).join("\n") || "  （无）";
  return [
    `  原文长度: ${tweet.length} 字符`,
    `  AI模型: ${winner} (${ms}ms)`,
    `  summary_cn: ${analysis.summary_cn.slice(0, 60)}...`,
    `  translated_cn 长度: ${analysis.translated_content_cn.length} 字符`,
    `  利好:\n${bullish}`,
    `  利空:\n${bearish}`,
    `  板块: ${analysis.sector_tags.join(", ") || "（无）"}`,
    `  置信度: ${analysis.confidence}/100`,
  ].join("\n");
}

// ─── 主测试循环 ───────────────────────────────────────────────────────────────

async function main() {
  console.log("\n" + "═".repeat(70));
  console.log("  Serenity 流水线压力测试 — 并行AI赛跑 + 全格式覆盖");
  console.log("  DeepSeek: " + env.OPENAI_BASE_URL + " / " + env.AI_MODEL);
  console.log("  Xiaomi:   " + env.XIAOMI_BASE_URL + " / mimo-v2.5");
  console.log("═".repeat(70));

  let passed = 0;
  let failed = 0;
  const raceWins: Record<string, number> = { DeepSeek: 0, Xiaomi: 0 };

  for (let i = 0; i < TEST_CASES.length; i++) {
    const { label, tweet } = TEST_CASES[i];
    const n = `[${i + 1}/${TEST_CASES.length}]`;
    console.log(`\n${n} ${label}`);
    console.log("─".repeat(60));

    const t0 = Date.now();
    try {
      const { analysis, winner, winnerMs, loserResult } = await raceAnalyze(tweet);
      const total = Date.now() - t0;

      raceWins[winner] = (raceWins[winner] ?? 0) + 1;
      passed++;

      const loserIcon = loserResult === "also_ok" ? "✅ 另一个也OK" : "❌ 另一个失败";
      console.log(`✅ PASS  |  赢家: ${winner} (${winnerMs}ms)  |  ${loserIcon}  |  总耗时: ${total}ms`);
      console.log(renderPreview(tweet, analysis, winner, winnerMs));
    } catch (err) {
      failed++;
      console.log(`❌ FAIL: ${err instanceof Error ? err.message : err}`);
    }

    // 避免频率限制
    if (i < TEST_CASES.length - 1) await new Promise(r => setTimeout(r, 500));
  }

  console.log("\n" + "═".repeat(70));
  console.log("  测试结果汇总");
  console.log("═".repeat(70));
  console.log(`✅ 通过: ${passed}/${TEST_CASES.length}`);
  console.log(`❌ 失败: ${failed}/${TEST_CASES.length}`);
  console.log(`\n赛跑赢家统计:`);
  console.log(`  DeepSeek 赢: ${raceWins["DeepSeek"] ?? 0} 次`);
  console.log(`  Xiaomi 赢:   ${raceWins["Xiaomi"] ?? 0} 次`);

  if (failed === 0) {
    console.log("\n🎉 全部通过 — 任何格式的推文都能正常推送");
  } else {
    console.log(`\n⛔ 有 ${failed} 条失败 — 需要修复`);
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
