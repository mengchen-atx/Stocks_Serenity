/**
 * 本地端到端推送测试脚本
 *
 * 用法：
 *   npx tsx scripts/test-push.ts                    # 用假 tweet 跑完整流程
 *   npx tsx scripts/test-push.ts --real              # 用真实 Twitter API 抓最新推文
 *   npx tsx scripts/test-push.ts --format            # 只渲染消息格式，不调用 AI 和推送
 *
 * 环境变量（只填你有的）：
 *   OPENAI_API_KEY 或 ANTHROPIC_API_KEY
 *   WECHAT_WEBHOOK
 *   DATABASE_URL（可不填，跳过 DB 操作）
 */

import "dotenv/config";
import { renderWechatMarkdown } from "@/lib/wechat";

const args = process.argv.slice(2);
const MODE_REAL = args.includes("--real");
const MODE_FORMAT_ONLY = args.includes("--format");

// ─── 测试用假 tweet ───────────────────────────────────────────────────────────

const FAKE_TWEET = {
  tweetId: "test-001",
  authorUsername: "serenity",
  content:
    "CPO bottlenecks are misunderstood. The real constraint isn't the optics — it's the driver IC ecosystem. POET and Sivers are the only ones with a credible path here.",
  tweetCreatedAt: new Date(),
  sourceUrl: "https://x.com/serenity/status/test-001"
};

// ─── 测试用假 AI 分析（不需要 API Key）──────────────────────────────────────

const FAKE_ANALYSIS: import("@/types").AiAnalysis = {
  summary_cn:
    "Serenity 指出市场对 CPO（共封装光学）瓶颈的理解存在根本性误区：真正的制约因素不是光学器件本身，而是驱动芯片（driver IC）生态系统的缺失。POET Technologies 和 Sivers Semiconductors 是目前唯一具备可信技术路径的企业，有望成为 AI 数据中心光互联升级的核心供应商。",
  translated_content_cn:
    "CPO（共封装光学）的瓶颈被市场严重误读了。真正的制约不是光学，而是驱动 IC 生态。POET 和 Sivers 是唯二有可信路径的公司。",
  bullish_stocks: [
    {
      ticker: "POET",
      company: "POET Technologies",
      reason:
        "POET 是光引擎与驱动 IC 一体化平台的领头羊。随着 AI 数据中心进入 CPO 架构时代，POET 的光子集成平台是少数能同时解决光学与驱动 IC 问题的方案，直接受益于 Serenity 所指出的核心瓶颈。"
    },
    {
      ticker: "SIVI",
      company: "Sivers Semiconductors",
      reason:
        "Sivers 的硅光芯片与驱动 IC 技术在 CPO 生态中具有稀缺性。作为 Serenity 点名的双雄之一，其 AI 光互联产品线的订单可见度有望随 CPO 需求升温而大幅提升。"
    },
    {
      ticker: "COHR",
      company: "Coherent Corp",
      reason:
        "Coherent 是光模块与 CPO 的规模化供应商，受益于 CPO 渗透率提升。驱动 IC 生态问题一旦被攻克，Coherent 的大客户订单将加速落地。"
    }
  ],
  bearish_stocks: [],
  sector_tags: ["CPO", "光通信", "AI数据中心", "半导体"],
  confidence: 82
};

// ─── 测试用假股票数据（不需要 Finnhub）──────────────────────────────────────

const FAKE_STOCKS: import("@/types").StockProfile[] = [
  {
    ticker: "POET",
    price: 5.18,
    market_cap: "180M",
    market_cap_raw: 180_000_000,
    company: "POET Technologies",
    company_description:
      "POET Technologies 开发光子集成电路平台，将激光器、调制器、探测器和驱动 IC 集成在单一芯片上，是 AI 数据中心 CPO 架构的核心器件供应商。",
    industry: "Semiconductors",
    theme: ["光通信/CPO", "AI基础设施"],
    currency: "USD",
    exchange: "OTC"
  },
  {
    ticker: "SIVI",
    price: 12.33,
    market_cap: "450M",
    market_cap_raw: 450_000_000,
    company: "Sivers Semiconductors",
    company_description:
      "Sivers Semiconductors 是瑞典硅光与毫米波芯片公司，专注于 AI 数据中心高速光互联解决方案，其 CPO 驱动 IC 技术在行业内具有独特性。",
    industry: "Semiconductors",
    theme: ["光通信/CPO", "半导体"],
    currency: "SEK",
    exchange: "Nasdaq Stockholm"
  },
  {
    ticker: "COHR",
    price: 89.45,
    market_cap: "11.2B",
    market_cap_raw: 11_200_000_000,
    company: "Coherent Corp",
    company_description:
      "Coherent Corp（前身 II-VI）是全球最大的光模块与光器件供应商之一，客户覆盖 NVIDIA、微软、谷歌等超大规模云厂商，是 AI 数据中心光通信升级的核心受益者。",
    industry: "Electronic Equipment & Components",
    theme: ["光通信/CPO", "AI基础设施"],
    currency: "USD",
    exchange: "NYSE"
  }
];

// ─── 主流程 ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("  Serenity Push Format Test");
  console.log("=".repeat(60) + "\n");

  if (MODE_FORMAT_ONLY) {
    // 只渲染格式，不调 AI 也不推送
    await testFormatOnly();
    return;
  }

  if (MODE_REAL) {
    await testWithRealTweet();
    return;
  }

  // 默认：用假数据跑完整流程
  await testWithFakeData();
}

async function testFormatOnly() {
  console.log("▸ 模式: FORMAT_ONLY（不调 AI，不推送）\n");

  const rendered = renderWechatMarkdown({
    sourceUrl: FAKE_TWEET.sourceUrl,
    original: FAKE_TWEET.content,
    authorUsername: FAKE_TWEET.authorUsername,
    analysis: FAKE_ANALYSIS,
    stocks: FAKE_STOCKS
  });

  printRendered(rendered);
}

async function testWithFakeData() {
  console.log("▸ 模式: FAKE_DATA（用假 tweet + 真实 AI 分析）\n");

  let analysis = FAKE_ANALYSIS;

  // 如果有 AI Key，用真实 AI
  if (process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY) {
    console.log("▸ 调用 AI 分析...");
    try {
      const { analyzeTweetWithAi } = await import("@/lib/ai");
      analysis = await analyzeTweetWithAi(FAKE_TWEET.content);
      console.log("✓ AI 分析完成");
      console.log("  Bullish:", analysis.bullish_stocks.map((s) => s.ticker).join(", ") || "无");
      console.log("  Bearish:", analysis.bearish_stocks.map((s) => s.ticker).join(", ") || "无");
      console.log("  Tags:", analysis.sector_tags.join(", "));
      console.log("  Confidence:", analysis.confidence);
      console.log();
    } catch (err) {
      console.warn("⚠ AI 分析失败，使用假数据:", err instanceof Error ? err.message : err);
    }
  } else {
    console.log("⚠ 无 AI Key，使用内置假分析数据\n");
  }

  // 获取股票数据（如果有 DB + API Key）
  let stocks = FAKE_STOCKS;
  if (process.env.DATABASE_URL && (process.env.FINNHUB_API_KEY || process.env.ALPHA_VANTAGE_API_KEY)) {
    console.log("▸ 获取股票数据...");
    try {
      const { enrichStocks } = await import("@/lib/stocks");
      const tickers = [
        ...analysis.bullish_stocks.map((s) => s.ticker),
        ...analysis.bearish_stocks.map((s) => s.ticker)
      ];
      stocks = tickers.length > 0 ? await enrichStocks(tickers) : FAKE_STOCKS;
      console.log("✓ 股票数据获取完成");
      stocks.forEach((s) =>
        console.log(`  ${s.ticker}: $${s.price ?? "—"} | ${s.company ?? "—"}`)
      );
      console.log();
    } catch (err) {
      console.warn("⚠ 股票数据获取失败，使用假数据:", err instanceof Error ? err.message : err);
    }
  } else {
    console.log("⚠ 无 DB/股票 API Key，使用内置假股票数据\n");
  }

  // 渲染消息
  const rendered = renderWechatMarkdown({
    sourceUrl: FAKE_TWEET.sourceUrl,
    original: FAKE_TWEET.content,
    authorUsername: FAKE_TWEET.authorUsername,
    analysis,
    stocks
  });

  printRendered(rendered);

  // ── WxPusher 推送（个人微信，推荐）────────────────────────────────────────
  if (process.env.WXPUSHER_APP_TOKEN && process.env.WXPUSHER_TOPIC_ID) {
    console.log("▸ 推送到个人微信（WxPusher）...");
    try {
      const { renderWxPusherHtml, buildWxPusherSummary, sendWxPusherTopicBroadcast } =
        await import("@/lib/wxpusher");
      const html = renderWxPusherHtml({
        sourceUrl: FAKE_TWEET.sourceUrl,
        original: FAKE_TWEET.content,
        authorUsername: FAKE_TWEET.authorUsername,
        analysis,
        stocks
      });
      const summary = buildWxPusherSummary(analysis);
      const result = await sendWxPusherTopicBroadcast(html, summary, FAKE_TWEET.sourceUrl);
      if (result.ok) {
        console.log("✅ WxPusher 推送成功！手机微信应有通知");
        console.log("   Response:", result.body.slice(0, 200));
      } else {
        console.log("❌ WxPusher 推送失败");
        console.log("   Status:", result.status);
        console.log("   Body:", result.body.slice(0, 300));
      }
    } catch (err) {
      console.error("❌ WxPusher 推送异常:", err);
    }
  } else {
    console.log("⚠ 未配置 WXPUSHER_APP_TOKEN / WXPUSHER_TOPIC_ID，跳过个人微信推送");
    console.log("  → 注册：https://wxpusher.zjiecode.com");
  }

  // ── 企业微信 Webhook（可选）────────────────────────────────────────────────
  if (process.env.WECHAT_WEBHOOK) {
    console.log("▸ 推送到企业微信...");
    try {
      const { sendWechatMarkdown } = await import("@/lib/wechat");
      const result = await sendWechatMarkdown(rendered);
      if (result.ok) {
        console.log("✅ 企业微信推送成功！");
      } else {
        console.log("❌ 企业微信推送失败:", result.status, result.body);
      }
    } catch (err) {
      console.error("❌ 企业微信推送异常:", err);
    }
  }
}

async function testWithRealTweet() {
  if (!process.env.TWITTER_BEARER_TOKEN) {
    console.error("❌ TWITTER_BEARER_TOKEN 未配置");
    process.exit(1);
  }

  console.log("▸ 模式: REAL（调用真实 Twitter API）\n");
  console.log("▸ 抓取 @serenity 最新推文...");

  const { fetchLatestTweets } = await import("@/lib/twitter");
  const tweets = await fetchLatestTweets({
    username: process.env.TWITTER_USERNAME ?? "serenity",
    maxResults: 5,
    includeReplies: false,
    includeRetweets: false
  });

  if (tweets.length === 0) {
    console.log("⚠ 没有抓到推文（可能已是最新）");
    return;
  }

  console.log(`✓ 抓到 ${tweets.length} 条推文\n`);
  tweets.forEach((t, i) =>
    console.log(`  ${i + 1}. ${t.content.slice(0, 80)}...`)
  );

  const tweet = tweets[0];
  console.log(`\n▸ 分析第 1 条: "${tweet.content.slice(0, 100)}..."\n`);

  // AI 分析
  const { analyzeTweetWithAi } = await import("@/lib/ai");
  const analysis = await analyzeTweetWithAi(tweet.content);
  console.log("✓ AI 分析完成");

  // 用假股票数据（快速验证）
  const rendered = renderWechatMarkdown({
    sourceUrl: tweet.sourceUrl,
    original: tweet.content,
    authorUsername: tweet.authorUsername,
    analysis,
    stocks: FAKE_STOCKS.filter((s) =>
      [...analysis.bullish_stocks, ...analysis.bearish_stocks].some(
        (sig) => sig.ticker === s.ticker
      )
    )
  });

  printRendered(rendered);
}

// ─── Display helpers ──────────────────────────────────────────────────────────

function printRendered(rendered: string) {
  const byteLen = new TextEncoder().encode(rendered).length;
  const charLen = rendered.length;

  console.log("\n" + "─".repeat(60));
  console.log("  渲染结果预览");
  console.log("─".repeat(60));
  console.log(rendered);
  console.log("─".repeat(60));
  console.log(`\n  字符数: ${charLen}  |  字节数: ${byteLen}  |  限制: 4096 bytes`);

  if (byteLen > 4096) {
    console.log("  ⚠️  超过微信限制！需要截断。");
  } else {
    console.log("  ✅ 在微信字节限制内");
  }
  console.log();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
