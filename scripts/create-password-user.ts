/**
 * 创建账号密码用户并授权频道访问
 *
 * 使用方式:
 *   npx tsx scripts/create-password-user.ts <username> [channelSlug] [days]
 *
 * 参数:
 *   username    - 用户名（必填）
 *   channelSlug - 频道 slug，默认 "serenity"
 *   days        - 有效天数，默认 365（0 表示永久）
 *
 * 示例:
 *   npx tsx scripts/create-password-user.ts alice                  # serenity 365天
 *   npx tsx scripts/create-password-user.ts bob serenity 30        # serenity 30天
 *   npx tsx scripts/create-password-user.ts carol serenity 0       # serenity 永久
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";
import { hashPassword } from "../lib/password-auth";

const prisma = new PrismaClient();

function generatePassword(length = 12): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = randomBytes(length);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("");
}

async function main() {
  const [, , usernameArg, channelSlugArg, daysArg] = process.argv;

  if (!usernameArg) {
    console.error("Usage: npx tsx scripts/create-password-user.ts <username> [channelSlug] [days]");
    process.exit(1);
  }

  const username = usernameArg;
  const channelSlug = channelSlugArg ?? "serenity";
  const days = daysArg !== undefined ? parseInt(daysArg, 10) : 365;

  const channel = await prisma.channel.findUnique({ where: { slug: channelSlug } });
  if (!channel) {
    console.error(`Channel '${channelSlug}' not found`);
    process.exit(1);
  }

  const existing = await prisma.passwordUser.findUnique({ where: { username } });
  if (existing) {
    console.error(`Username '${username}' already exists (uid: ${existing.uid})`);
    process.exit(1);
  }

  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  const uid = `PWD_${randomBytes(8).toString("hex")}`;

  const user = await prisma.passwordUser.create({
    data: { username, passwordHash, uid },
  });

  const expiresAt = days > 0 ? new Date(Date.now() + days * 86400_000) : null;

  await prisma.userChannelAccess.upsert({
    where: { uid_channelId: { uid, channelId: channel.id } },
    create: { uid, channelId: channel.id, expiresAt },
    update: { expiresAt },
  });

  console.log("✅ 用户创建成功");
  console.log(`   用户名: ${user.username}`);
  console.log(`   密  码: ${password}`);
  console.log(`   UID   : ${user.uid}`);
  console.log(`   频  道: ${channelSlug}`);
  console.log(`   有效期: ${expiresAt ? expiresAt.toLocaleDateString("zh-CN") + " 到期" : "永久"}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
