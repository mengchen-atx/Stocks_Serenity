/**
 * 小红书自动发布守护进程
 *
 * 运行方式：
 *   npx dotenv -e .env.local -- npx tsx scripts/xhs-daemon.ts
 *
 * 前提：
 *   1. 已运行 setup-xhs-session.ts 保存 xhs-session.json
 *   2. .env.local 里配置了 APP_URL 和 CARD_SECRET_TOKEN
 *
 * 工作流程：
 *   每 60 秒查一次数据库 → 找到 pushed=true 且 xhsPosted=false 的推文
 *   → Playwright 截图卡片页 → 发布小红书图文笔记 → 标记 xhsPosted=true
 */

import { chromium } from "playwright";
import { prisma } from "@/lib/prisma";
import type { AiAnalysis } from "@/types";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SESSION_FILE  = path.resolve(process.cwd(), "xhs-session.json");
const SCREENSHOT_DIR = path.resolve(process.cwd(), ".xhs-screenshots");
const APP_URL        = process.env.APP_URL ?? "http://localhost:3000";
const CARD_TOKEN     = process.env.CARD_SECRET_TOKEN ?? "";
const POLL_INTERVAL  = 60_000; // 60 seconds

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildCardUrl(tweetId: string): string {
  const url = new URL(`/card/${tweetId}`, APP_URL);
  if (CARD_TOKEN) url.searchParams.set("token", CARD_TOKEN);
  return url.toString();
}

function buildTitle(tweet: { authorUsername: string; channel: { name: string } | null }, analysis: AiAnalysis | null): string {
  const author = tweet.channel?.name ?? tweet.authorUsername;
  if (analysis?.bullish_stocks.length) {
    const tickers = analysis.bullish_stocks.slice(0, 3).map((s) => `$${s.ticker}`).join(" ");
    return `${author}：看涨 ${tickers}`;
  }
  if (analysis?.summary_cn) {
    return `${author} · ${analysis.summary_cn.slice(0, 30)}`;
  }
  return `${author} 最新观点`;
}

function buildDescription(tweet: { content: string }, analysis: AiAnalysis | null): string {
  const parts: string[] = [];

  if (analysis?.translated_content_cn) {
    parts.push(analysis.translated_content_cn);
  }

  if (analysis?.summary_cn) {
    parts.push(`\n【AI 解读】${analysis.summary_cn}`);
  }

  const bulls = analysis?.bullish_stocks.slice(0, 5) ?? [];
  const bears = analysis?.bearish_stocks.slice(0, 3) ?? [];
  if (bulls.length) parts.push(`\n利好 ▲ ${bulls.map((s) => `$${s.ticker}`).join(" ")}`);
  if (bears.length) parts.push(`利空 ▼ ${bears.map((s) => `$${s.ticker}`).join(" ")}`);

  parts.push("\n#美股 #AI投资 #美股分析 #投资干货");

  const allTickers = [...bulls, ...bears].slice(0, 3);
  for (const s of allTickers) {
    parts.push(`#${s.ticker}`);
  }

  return parts.join("\n").slice(0, 1000);
}

// ─── Screenshot ───────────────────────────────────────────────────────────────

async function screenshotCard(tweetId: string): Promise<string> {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const outPath = path.join(SCREENSHOT_DIR, `${tweetId}.png`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1080, height: 1920 } });
  const page = await context.newPage();

  const url = buildCardUrl(tweetId);
  await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });

  // Screenshot only the card element (crops to content height)
  const card = await page.$("#card");
  if (card) {
    await card.screenshot({ path: outPath });
  } else {
    await page.screenshot({ path: outPath, fullPage: true });
  }

  await browser.close();
  console.log(`  📸 截图已保存：${outPath}`);
  return outPath;
}

// ─── Xiaohongshu post ─────────────────────────────────────────────────────────

async function postToXhs(imagePath: string, title: string, description: string): Promise<void> {
  if (!fs.existsSync(SESSION_FILE)) {
    throw new Error(`找不到 ${SESSION_FILE}，请先运行 setup-xhs-session.ts`);
  }

  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const context = await browser.newContext({
    storageState: SESSION_FILE,
    viewport: { width: 1280, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  try {
    // 1. Open publish page
    await page.goto("https://creator.xiaohongshu.com/publish/publish", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    // Check if redirected to login
    if (page.url().includes("login")) {
      await browser.close();
      throw new Error("小红书 session 已过期，请重新运行 setup-xhs-session.ts");
    }

    // 2. Click the image post tab (图文)
    const imageTab = page.locator("text=图文").first();
    if (await imageTab.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await imageTab.click();
      await page.waitForTimeout(1000);
    }

    // 3. Upload image via file input
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(imagePath);
    console.log("  📤 图片上传中...");

    // Wait for upload preview to appear
    await page.waitForSelector(".upload-item, .img-container, [class*='upload']", {
      timeout: 30_000,
    }).catch(() => console.warn("  ⚠️  等待图片预览超时，继续..."));
    await page.waitForTimeout(2000);

    // 4. Fill title
    const titleInput = page.locator('input[placeholder*="标题"], textarea[placeholder*="标题"], [class*="title"] input').first();
    await titleInput.click({ timeout: 10_000 });
    await titleInput.fill(title);
    console.log(`  ✏️  标题：${title}`);
    await page.waitForTimeout(500);

    // 5. Fill description (rich text editor)
    // XHS uses a div[contenteditable] editor
    const descEditor = page.locator(
      'div[contenteditable="true"], [class*="content"] textarea, [placeholder*="正文"]'
    ).first();
    await descEditor.click({ timeout: 10_000 });
    await page.keyboard.type(description, { delay: 20 });
    console.log("  ✏️  正文填写完成");
    await page.waitForTimeout(500);

    // 6. Publish
    const publishBtn = page.locator('button:has-text("发布"), button:has-text("提交")').first();
    await publishBtn.click({ timeout: 10_000 });
    console.log("  🚀 发布中...");

    // Wait for success state
    await page.waitForURL(/creator\.xiaohongshu\.com\/(home|manage|creator)/, {
      timeout: 30_000,
    }).catch(async () => {
      // Fallback: check for success toast
      await page.waitForSelector('[class*="success"], [class*="toast"]', {
        timeout: 15_000,
      }).catch(() => {});
    });

    console.log("  ✅ 发布成功！");
  } finally {
    await page.waitForTimeout(2000);
    await browser.close();
  }
}

// ─── Main loop ────────────────────────────────────────────────────────────────

async function processNewTweets(): Promise<number> {
  const pending = await prisma.tweet.findMany({
    where: { pushed: true, xhsPosted: false, aiAnalysis: { not: "JsonNull" } },
    orderBy: { tweetCreatedAt: "asc" },
    take: 5,
    include: { channel: { select: { name: true, slug: true } } },
  });

  if (pending.length === 0) return 0;

  console.log(`\n[${new Date().toLocaleTimeString()}] 发现 ${pending.length} 条待发布推文`);

  for (const tweet of pending) {
    const analysis = tweet.aiAnalysis as AiAnalysis | null;
    console.log(`\n处理：${tweet.authorUsername} / ${tweet.id}`);

    try {
      const imgPath  = await screenshotCard(tweet.id);
      const title    = buildTitle(tweet, analysis);
      const desc     = buildDescription(tweet, analysis);

      await postToXhs(imgPath, title, desc);

      await prisma.tweet.update({ where: { id: tweet.id }, data: { xhsPosted: true } });
      console.log(`  ✅ xhsPosted = true`);

      // Rate-limit: wait 30s between posts to avoid spam detection
      await new Promise((r) => setTimeout(r, 30_000));
    } catch (err) {
      console.error(`  ❌ 发布失败：${err instanceof Error ? err.message : err}`);
      // Continue with next tweet — don't abort the batch
    }
  }

  return pending.length;
}

async function main() {
  console.log("🌸 小红书自动发布守护进程启动");
  console.log(`   APP_URL      = ${APP_URL}`);
  console.log(`   Session 文件 = ${SESSION_FILE}`);
  console.log(`   轮询间隔     = ${POLL_INTERVAL / 1000}s\n`);

  if (!fs.existsSync(SESSION_FILE)) {
    console.error("❌ 找不到 xhs-session.json，请先运行：npx tsx scripts/setup-xhs-session.ts");
    process.exit(1);
  }

  // Run immediately on start, then poll
  await processNewTweets();

  setInterval(async () => {
    try {
      await processNewTweets();
    } catch (err) {
      console.error("Poll error:", err);
    }
  }, POLL_INTERVAL);
}

main().catch((e) => { console.error(e); process.exit(1); });
