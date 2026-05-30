import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "../lib/prisma";

async function main() {
  const uid = process.argv[2];
  const slugFilter = process.argv[3];

  if (!uid) { console.error("用法: npx tsx scripts/grant-access.ts <UID> [slug]"); process.exit(1); }

  const channels = slugFilter
    ? await prisma.channel.findMany({ where: { slug: slugFilter } })
    : await prisma.channel.findMany();

  for (const ch of channels) {
    await prisma.userChannelAccess.upsert({
      where: { uid_channelId: { uid, channelId: ch.id } },
      create: { uid, channelId: ch.id },
      update: {},
    });
    console.log(`✅ 已授权 ${uid} → ${ch.slug} (${ch.name})`);
  }
  await prisma.$disconnect();
}
main().catch(console.error);
