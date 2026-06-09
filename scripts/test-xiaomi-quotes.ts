#!/usr/bin/env bun
/**
 * 测试 Xiaomi mimo-v2.5 处理含双引号推文的能力
 * 运行：bun run scripts/test-xiaomi-quotes.ts
 */

import OpenAI from "openai";
import { jsonrepair } from "jsonrepair";

const XIAOMI_API_KEY = process.env.XIAOMI_API_KEY!;
const XIAOMI_BASE_URL = process.env.XIAOMI_BASE_URL!;

if (!XIAOMI_API_KEY || !XIAOMI_BASE_URL) {
  console.error("需要设置 XIAOMI_API_KEY 和 XIAOMI_BASE_URL");
  process.exit(1);
}

// 专门选含双引号的推文，这类推文最容易让DeepSeek出错
const TEST_TWEETS = [
  // 1. 直接含英文双引号（经典"harvesting the leeks"场景）
  `$NVDA is "harvesting the leeks" from its data center customers. Margins at 78% are insane. Long $NVDA`,

  // 2. 股票列表里含引号
  `Okay chat, here's your compiled "best picks" for AI infra:
1. $NVDA - still the "picks and shovels" play
2. $AVGO - "custom silicon" winner
3. $ANET - networking "moat" stock`,

  // 3. 引号+中文内容混合
  `$SMCI shares down 30% after "accounting irregularities" surface. This is the "Enron moment" for AI infra. Avoid.`,

  // 4. 多重嵌套引号
  `CEO said "we expect to 'double' capex next year" - $MSFT Azure going parabolic. Bull case intact.`,

  // 5. 带中文翻译场景的引号
  `$TSM says "pricing power is back" - ASML, AMAT, LRCX all benefit from this "supercycle" narrative`,

  // 6. 引号在ticker附近
  `"Risk off" day but $NVDA held $900. Market calling it "AI fatigue" but this is just profit taking. Buy the dip.`,

  // 7. 带百分比和引号
  `$INTC down 8% after "disappointing" guidance. Management called it "transitional headwinds". Translation: they're losing share to $AMD and $NVDA.`,

  // 8. 长推文带引号
  `Thread: Why $WOLF (Wolfspeed) is a "screaming buy" at these levels 🧵
1/ Market is calling this a "distressed" name but the 800V EV thesis is intact
2/ The "Siler City" fab is a game changer
3/ Every "bear case" assumes SiC demand stays flat - wrong
4/ "Generational buy" at current prices IMO`,

  // 9. 对话体推文带引号
  `Just got off call with $ASML IR. They said "demand visibility extends into 2027".
"EUV capacity is fully booked".
"China headwinds are manageable".
This is bullish for the whole semis supply chain.`,

  // 10. 最复杂：含各种标点的推文
  `The "AI capex supercycle" isn't slowing down. $NVDA $AMD $AVGO are the "infrastructure layer".
SMCI is the "picks and shovels" for picks and shovels.
$DELL's "AI-optimized servers" business growing 200% YoY.
"This time is different" - but for real this time.`,
];

const SYSTEM_PROMPT = `你是专业 AI 基础设施与科技投资分析师。分析推文并输出 JSON。

=== 严格规则 ===
- 只输出严格 JSON，不要 markdown code block，不要多余解释。
- 【极其重要】所有 JSON 字符串值内部，严禁出现未转义的双引号字符 "。如需引用原文词语，用中文书名号《》或方括号【】代替，绝对不允许在 JSON 字符串中使用 " 字符，否则会导致 JSON 解析失败、推送中断、用户投诉。

=== 输出 JSON Schema ===
{
  "summary_cn": "string (50-200字，投资分析摘要)",
  "translated_content_cn": "string (自然中文翻译)",
  "bullish_stocks": [{"ticker":"string","company":"string","reason":"string"}],
  "bearish_stocks": [{"ticker":"string","company":"string","reason":"string"}],
  "sector_tags": ["string"],
  "confidence": 0
}`;

function extractJson(raw: string): string {
  let trimmed = raw.trim();
  const codeBlockMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (codeBlockMatch?.[1]) trimmed = codeBlockMatch[1].trim();
  trimmed = trimmed.replace(/[""''«»＂]/g, '\\"');
  if (trimmed.startsWith("{")) return trimmed;
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd > jsonStart) return trimmed.slice(jsonStart, jsonEnd + 1);
  return trimmed;
}

async function testTweet(client: OpenAI, index: number, tweet: string): Promise<{
  pass: boolean;
  error?: string;
  usedRepair: boolean;
  rawSnippet: string;
}> {
  const completion = await client.chat.completions.create({
    model: "mimo-v2.5",
    temperature: 0.1,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `请分析以下推文：\n\n${tweet}` }
    ]
  });

  const raw = completion.choices[0]?.message.content ?? "";
  const json = extractJson(raw);
  const rawSnippet = raw.slice(0, 120).replace(/\n/g, " ");

  let usedRepair = false;
  try {
    JSON.parse(json);
    return { pass: true, usedRepair: false, rawSnippet };
  } catch {
    try {
      JSON.parse(jsonrepair(json));
      usedRepair = true;
      return { pass: true, usedRepair: true, rawSnippet };
    } catch (e2) {
      return { pass: false, error: e2 instanceof Error ? e2.message : String(e2), rawSnippet };
    }
  }
}

async function main() {
  const client = new OpenAI({ apiKey: XIAOMI_API_KEY, baseURL: XIAOMI_BASE_URL });

  console.log(`\n${"=".repeat(60)}`);
  console.log("  Xiaomi mimo-v2.5 引号稳定性测试（10条推文）");
  console.log(`${"=".repeat(60)}\n`);

  let passed = 0;
  let usedRepairCount = 0;
  let failed = 0;

  for (let i = 0; i < TEST_TWEETS.length; i++) {
    const tweet = TEST_TWEETS[i];
    process.stdout.write(`[${i + 1}/10] 测试中... `);

    try {
      const result = await testTweet(client, i, tweet);
      if (result.pass) {
        passed++;
        if (result.usedRepair) {
          usedRepairCount++;
          console.log(`⚠️  PASS (jsonrepair修复)`);
        } else {
          console.log(`✅ PASS`);
        }
      } else {
        failed++;
        console.log(`❌ FAIL: ${result.error}`);
        console.log(`   推文: ${tweet.slice(0, 80)}...`);
        console.log(`   原始输出: ${result.rawSnippet}`);
      }
    } catch (err) {
      failed++;
      console.log(`❌ 网络/API错误: ${err instanceof Error ? err.message : err}`);
    }

    // 避免频率限制
    if (i < TEST_TWEETS.length - 1) await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("  测试结果汇总");
  console.log(`${"=".repeat(60)}`);
  console.log(`✅ 直接通过:        ${passed - usedRepairCount}/10`);
  console.log(`⚠️  jsonrepair修复:  ${usedRepairCount}/10`);
  console.log(`❌ 彻底失败:        ${failed}/10`);
  console.log(`\n结论: ${failed === 0 ? "🎉 Xiaomi mimo-v2.5 全部通过，可以作为主模型使用" : `⛔ 有 ${failed} 条失败，需要继续观察`}`);
  console.log();
}

main().catch(console.error);
