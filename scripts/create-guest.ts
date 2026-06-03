/**
 * 创建一次性访客链接
 * 用法：
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/create-guest.ts
 *
 * 生成一个 GUEST UID，授权访问 serenity 频道 30 天，
 * 输出可直接发送给对方的登录链接。
 */

import "dotenv/config";
import { prisma } from "../lib/prisma";
import { grantChannelAccess } from "../lib/channels";
import { generateGuestUid, generateGuestToken } from "../lib/guest-auth";

const BASE_URL = process.env.APP_BASE_URL ?? "https://www.alphaline.fit";
const DAYS = 30;

async function main() {
  const uid = generateGuestUid();
  const expiresAt = new Date(Date.now() + DAYS * 24 * 60 * 60 * 1000);

  await grantChannelAccess(uid, "serenity", expiresAt);

  const token = generateGuestToken(uid, expiresAt);
  const url = `${BASE_URL}/api/auth/guest?token=${token}`;

  console.log("");
  console.log("✅ 访客账号已创建");
  console.log("─────────────────────────────────────────────────");
  console.log(`UID        : ${uid}`);
  console.log(`有效期至   : ${expiresAt.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
  console.log(`频道       : Serenity`);
  console.log("");
  console.log("登录链接（发给对方，点击即可进入 Dashboard）：");
  console.log(url);
  console.log("─────────────────────────────────────────────────");
  console.log("");
  console.log("说明：");
  console.log("  • 链接本身 30 天有效");
  console.log("  • Session Cookie 7 天，过期后重新点链接续期");
  console.log("  • 只能访问 Serenity 频道");
  console.log("");
}

main().catch(console.error).finally(() => prisma.$disconnect());
