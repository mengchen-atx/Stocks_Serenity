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

import { chromium, type BrowserContext } from "playwright";
import { prisma } from "@/lib/prisma";
import type { AiAnalysis } from "@/types";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import sharp from "sharp";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SESSION_FILE  = path.resolve(process.cwd(), "xhs-session.json");
const EDGE_PATH     = "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge";
const SCREENSHOT_DIR = path.resolve(process.cwd(), ".xhs-screenshots");
const APP_URL        = process.env.APP_URL ?? "http://localhost:3000";
const CARD_TOKEN     = process.env.CARD_SECRET_TOKEN ?? "";
const POLL_INTERVAL  = 60_000; // 60 seconds
const SERENITY_CHANNEL_ID = "cmpswr3350000ap123upcit90"; // 只发 Serenity 频道的推文
const PUBLISH_AFTER = new Date(); // 只发布此时间之后产生的新推文，历史积压不发

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildCardUrl(tweetId: string): string {
  const url = new URL(`/card/${tweetId}`, APP_URL);
  if (CARD_TOKEN) url.searchParams.set("token", CARD_TOKEN);
  return url.toString();
}

const MAX_TITLE_LENGTH = 20; // 小红书标题限制 20 字以内

export function buildTitle(tweet: { authorUsername: string; channel: { name: string } | null }, analysis: AiAnalysis | null): string {
  const author = tweet.channel?.name ?? tweet.authorUsername;
  if (analysis?.bullish_stocks.length) {
    const tickers = analysis.bullish_stocks.slice(0, 3).map((s) => `$${s.ticker}`).join(" ");
    return `${author}看涨${tickers}`.slice(0, MAX_TITLE_LENGTH);
  }
  if (analysis?.summary_cn) {
    return `${author}·${analysis.summary_cn}`.slice(0, MAX_TITLE_LENGTH);
  }
  return `${author}最新观点`.slice(0, MAX_TITLE_LENGTH);
}

export function buildDescription(tweet: { content: string }, analysis: AiAnalysis | null): string {
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

export async function screenshotCard(tweetId: string): Promise<string> {
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

// ─── Note count (publish verification) ────────────────────────────────────────

async function getNoteCount(context: BrowserContext): Promise<number> {
  const page = await context.newPage();
  try {
    await page.goto("https://creator.xiaohongshu.com/new/note-manager", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForTimeout(2000);
    const text = await page.locator("body").innerText();
    const match = text.match(/全部\s*(\d+)/);
    return match ? parseInt(match[1], 10) : -1;
  } finally {
    await page.close();
  }
}

// ─── Xiaohongshu post ─────────────────────────────────────────────────────────

export async function postToXhs(imagePath: string, title: string, description: string): Promise<void> {
  if (!fs.existsSync(SESSION_FILE)) {
    throw new Error(`找不到 ${SESSION_FILE}，请先运行 setup-xhs-session.ts`);
  }

  const browser = await chromium.launch({
    headless: false,
    executablePath: EDGE_PATH,
    slowMo: 80,
    args: ["--disable-blink-features=AutomationControlled", "--no-first-run", "--no-default-browser-check"],
  });
  const context = await browser.newContext({
    storageState: SESSION_FILE,
    viewport: { width: 1280, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const page = await context.newPage();
  page.on("dialog", (d) => d.accept().catch(() => {}));

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

    // 2. Click the image post tab (上传图文) — retry until the file input accepts images
    await page.waitForTimeout(2000);
    for (let attempt = 0; attempt < 3; attempt++) {
      const accept = await page.locator('input[type="file"]').first().getAttribute("accept").catch(() => null);
      if (accept?.includes("image")) break;
      const tabs = page.getByText("上传图文", { exact: true });
      const tabCount = await tabs.count();
      const idx = attempt < tabCount ? attempt : 0;
      await tabs.nth(idx).click({ timeout: 5_000 }).catch(() => {});
      await page.waitForTimeout(1500);
    }

    // 3. Upload image via file input
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(imagePath);
    console.log("  📤 图片上传中...");
    await page.waitForTimeout(5000);

    // 4. Fill title
    const titleInput = page.locator('input[placeholder*="标题"]').first();
    await titleInput.click({ timeout: 15_000 });
    await titleInput.fill(title);
    console.log(`  ✏️  标题：${title}`);
    await page.waitForTimeout(500);

    // 5. Fill description (Tiptap rich text editor)
    const descEditor = page.locator('div.tiptap.ProseMirror').first();
    await descEditor.click({ timeout: 10_000 });
    await page.keyboard.type(description, { delay: 20 });
    // Close the #话题 autocomplete dropdown that "#" triggers, which covers the publish button
    await page.keyboard.press("Escape");
    console.log("  ✏️  正文填写完成");
    await page.waitForTimeout(500);

    // 6. Publish — wait for the upload-processing overlay to clear first
    await page.locator("text=加载中").first().waitFor({ state: "hidden", timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Capture the note count BEFORE publishing, so we can verify the
    // publish actually went through afterwards (a "success" toast or URL
    // change is not reliable — XHS can navigate without actually publishing).
    const countBefore = await getNoteCount(context);

    // The publish/save controls are rendered inside a custom element
    // <xhs-publish-btn submit-text="发布" save-text="暂存离开"> with a
    // closed shadow root — its internal "发布"/"暂存离开" buttons aren't
    // reachable via DOM queries. Locate the red "发布" button by its
    // brand color within the widget's own bounding box.
    const widgetRect = await page.evaluate(() => {
      const widget = document.querySelector("xhs-publish-btn");
      if (!widget) return null;
      const r = widget.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    });
    if (!widgetRect) {
      await page.screenshot({ path: "/tmp/xhs-debug-final.png", fullPage: true });
      throw new Error("找不到发布按钮");
    }

    const clip = {
      x: Math.max(0, Math.round(widgetRect.x)),
      y: Math.max(0, Math.round(widgetRect.y)),
      width: Math.round(widgetRect.width),
      height: Math.round(widgetRect.height),
    };
    const widgetShot = await page.screenshot({ clip });
    const { data, info } = await sharp(widgetShot).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    // The "发布" button's accent color varies (observed both XHS brand red
    // and blue) depending on page state, so detect any saturated, non-gray,
    // non-white/black pixel rather than a fixed hue.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const idx = (y * info.width + x) * info.channels;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const saturation = max - min;
        const isColorful = saturation > 40 && max > 100;
        if (isColorful) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    let clickX: number, clickY: number;
    if (maxX >= minX) {
      clickX = clip.x + (minX + maxX) / 2;
      clickY = clip.y + (minY + maxY) / 2;
    } else {
      // Fallback to the previously-measured fixed offset from the widget's bottom-right corner
      clickX = widgetRect.right - 59;
      clickY = widgetRect.bottom - 20;
    }

    await page.mouse.click(clickX, clickY);
    console.log("  🚀 发布中...");
    await page.waitForTimeout(2000);

    // Verify: the note count in 笔记管理 must increase by 1
    let countAfter = countBefore;
    for (let attempt = 0; attempt < 10; attempt++) {
      await page.waitForTimeout(2000);
      countAfter = await getNoteCount(context);
      if (countAfter > countBefore) break;
    }

    if (countAfter <= countBefore) {
      await page.screenshot({ path: "/tmp/xhs-debug-publish-failed.png", fullPage: true }).catch(() => {});
      throw new Error(`发布未生效（笔记数 ${countBefore} → ${countAfter}）`);
    }

    console.log("  ✅ 发布成功！");
  } finally {
    await page.waitForTimeout(2000);
    await browser.close();
  }
}

// ─── Main loop ────────────────────────────────────────────────────────────────

async function processNewTweets(): Promise<number> {
  const pending = await prisma.tweet.findMany({
    where: {
      pushed: true,
      xhsPosted: false,
      aiAnalysis: { not: "JsonNull" },
      channelId: SERENITY_CHANNEL_ID,
      tweetCreatedAt: { gte: PUBLISH_AFTER },
    },
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

if (process.argv[1] && process.argv[1].endsWith("xhs-daemon.ts")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
