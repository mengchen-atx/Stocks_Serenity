/**
 * 批量预生成所有股票的 AI 简介 + 供应链位置
 * 运行：npx tsx scripts/generate-stock-profiles.ts
 */

import "dotenv/config";
import { prisma } from "../lib/prisma";
import { generateStockProfile } from "../lib/stock-profile";

async function main() {
  const allStocks = await prisma.stock.findMany({
    select: { ticker: true, companyName: true, aiProfile: true }
  });
  const stocks = allStocks.filter((s) => s.aiProfile === null);

  console.log(`需要生成简介的股票：${stocks.length} 只\n`);

  let done = 0, failed = 0;

  for (const stock of stocks) {
    const reasons = await prisma.stockMention
      .findMany({
        where: { stock: { ticker: stock.ticker } },
        select: { reason: true },
        take: 5
      })
      .then((ms) => ms.map((m) => m.reason).filter(Boolean) as string[]);

    try {
      const profile = await generateStockProfile(stock.ticker, stock.companyName, reasons);
      await prisma.stock.update({
        where: { ticker: stock.ticker },
        data: { aiProfile: profile }
      });
      console.log(`✅ ${stock.ticker} → ${profile.role}`);
      done++;
    } catch (err) {
      console.error(`❌ ${stock.ticker} 失败：`, err instanceof Error ? err.message : err);
      failed++;
    }

    // 避免 API 限流，每次间隔 500ms
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n完成：${done} 成功，${failed} 失败`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
