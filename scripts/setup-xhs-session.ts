/**
 * 一次性运行：保存小红书登录状态到 xhs-session.json
 *
 * 运行方式：
 *   npx tsx scripts/setup-xhs-session.ts
 *
 * 运行后会打开一个 Chromium 浏览器窗口。
 * 如果你已经在 Edge 登录了小红书，直接在这个窗口里也登录一次即可（扫码/账号密码均可）。
 * 登录完成后回到终端，按 Enter，cookies 会保存到 xhs-session.json。
 */

import { chromium } from "playwright";
import * as readline from "readline";
import * as path from "path";

const SESSION_FILE = path.resolve(process.cwd(), "xhs-session.json");

async function main() {
  console.log("正在启动浏览器...");
  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();
  await page.goto("https://creator.xiaohongshu.com/login", { waitUntil: "domcontentloaded" });

  console.log("\n浏览器已打开，请在窗口中登录你的小红书创作者账号。");
  console.log("登录完成后，回到这里按 Enter 保存 cookies...\n");

  await new Promise<void>((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("（登录完成后按 Enter）", () => { rl.close(); resolve(); });
  });

  // Verify we're logged in by checking for creator center elements
  const url = page.url();
  if (url.includes("login")) {
    console.warn("⚠️  当前 URL 仍是登录页，请确认已完成登录后重新运行。");
    await browser.close();
    process.exit(1);
  }

  await context.storageState({ path: SESSION_FILE });
  console.log(`✅ 登录状态已保存到 ${SESSION_FILE}`);
  console.log("现在可以运行 xhs-daemon 了：npx tsx scripts/xhs-daemon.ts");

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
