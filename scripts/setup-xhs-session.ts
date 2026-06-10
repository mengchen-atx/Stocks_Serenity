/**
 * 一次性运行：保存小红书登录状态到 xhs-session.json
 *
 * 运行方式：
 *   npx tsx scripts/setup-xhs-session.ts
 *
 * 使用系统已安装的 Microsoft Edge，绕过小红书的自动化检测。
 * 登录完成后回到终端按 Enter，cookies 保存到 xhs-session.json。
 */

import { chromium } from "playwright";
import * as readline from "readline";
import * as path from "path";

const SESSION_FILE = path.resolve(process.cwd(), "xhs-session.json");

// macOS 上 Edge 的默认路径
const EDGE_PATH = "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge";

async function main() {
  console.log("正在启动 Microsoft Edge（绕过小红书风控）...");

  const browser = await chromium.launch({
    headless: false,
    executablePath: EDGE_PATH,
    slowMo: 50,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
  });

  // 注入脚本：隐藏 webdriver 特征
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    // @ts-ignore
    delete window.__playwright;
    // @ts-ignore
    delete window.__pwInitScripts;
  });

  const page = await context.newPage();
  await page.goto("https://creator.xiaohongshu.com/login", {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  console.log("\nEdge 已打开，请在窗口中用手机号/扫码登录小红书创作者中心。");
  console.log("登录完成后，回到这里按 Enter 保存 cookies...\n");

  await new Promise<void>((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("（登录完成后按 Enter）", () => { rl.close(); resolve(); });
  });

  const url = page.url();
  if (url.includes("login")) {
    console.warn("⚠️  当前 URL 仍是登录页，请确认已完成登录后重新运行。");
    await browser.close();
    process.exit(1);
  }

  await context.storageState({ path: SESSION_FILE });
  console.log(`\n✅ 登录状态已保存到 ${SESSION_FILE}`);
  console.log("现在可以运行守护进程：npx dotenv -e .env.local -- npx tsx scripts/xhs-daemon.ts");

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
