import "dotenv/config";
import { prisma } from "@/lib/prisma";
async function main() {
  // Check if any tweet has bearish stocks in aiAnalysis
  const tweets = await prisma.tweet.findMany({
    take: 5,
    select: { aiAnalysis: true, tweetCreatedAt: true }
  });
  for (const t of tweets) {
    const a = t.aiAnalysis as any;
    if (a) {
      console.log(`${t.tweetCreatedAt.toISOString()} | bullish:${a.bullish_stocks?.length ?? 0} bearish:${a.bearish_stocks?.length ?? 0}`);
    }
  }
  await prisma.$disconnect();
}
main();
