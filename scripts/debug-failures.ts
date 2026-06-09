import OpenAI from "openai";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const deepseek = new OpenAI({ apiKey: process.env.OPENAI_API_KEY!, baseURL: process.env.OPENAI_BASE_URL! });
const xiaomi   = new OpenAI({ apiKey: process.env.XIAOMI_API_KEY!,  baseURL: process.env.XIAOMI_BASE_URL! });

// The actual content from the test cases (template literals evaluated)
const tweets: Array<[string, string]> = [
  ["反斜杠",     `$NVDA P\\E=40x。DCF: r=10\\%, terminal growth=3\\%。Fair value=$1200\\share。Bull: $2000\\share。`],
  ["混合空白",   `$NVDA   (spaces)  \t(tab)\n(newline) "quoted"  $AMD　(全角空格)　看多`],
  ["日股全日文", `$6758.T（ソニーグループ）：AI事業好調！センサー需要急増。「強い買い」推奨。目標株価：¥15,000。利益率改善中。`],
  ["德法俄引号", `$SAP „KI-Revolution" / $LVMH «solide» / $SBER «рекорд» — all "bullish" across languages.`],
];

async function main() {
  for (const [label, tweet] of tweets) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`[${label}]`);
    console.log(`推文: ${JSON.stringify(tweet).slice(0, 100)}`);

    for (const [name, client, model] of [
      ["DeepSeek", deepseek, process.env.AI_MODEL!],
      ["Xiaomi",   xiaomi,   "mimo-v2.5"],
    ] as const) {
      try {
        const r = await client.chat.completions.create({
          model,
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "只输出JSON：{\"summary_cn\":\"string\",\"bullish_stocks\":[]}" },
            { role: "user",   content: `分析以下推文：\n${tweet}` },
          ],
        });
        const raw = r.choices[0]?.message.content ?? "";
        JSON.parse(raw); // verify
        console.log(`  ✅ ${name}: OK (${raw.length} chars)`);
      } catch (e: unknown) {
        const err = e as { status?: number; message?: string; code?: string };
        console.log(`  ❌ ${name}: status=${err.status} code=${err.code} msg=${String(err.message).slice(0, 150)}`);
      }
    }
  }
}

main().catch(console.error);
