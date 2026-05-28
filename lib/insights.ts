/**
 * 数据洞察模块
 * 从数据库中聚合投资信号统计，用于推送消息中的"热榜"板块
 */

import { prisma } from "@/lib/prisma";

export type TopMention = {
  ticker: string;
  companyName: string | null;
  bullishCount: number;
  bearishCount: number;
  totalCount: number;
};

/**
 * 查询近 N 天内被提及次数最多的股票（合并多空计数）
 * @param days   统计天数，默认 30 天
 * @param limit  返回条数，默认 8 条
 */
export async function getTopMentionedStocks(
  days = 30,
  limit = 8
): Promise<TopMention[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // 按 ticker 分组，统计多空各自次数
  const rows = await prisma.stockMention.groupBy({
    by: ["stockId", "stance"],
    where: { createdAt: { gte: since } },
    _count: { stockId: true },
    orderBy: { _count: { stockId: "desc" } }
  });

  if (rows.length === 0) return [];

  // 聚合到 ticker 维度
  const countMap = new Map<string, { bullish: number; bearish: number }>();
  for (const row of rows) {
    const cur = countMap.get(row.stockId) ?? { bullish: 0, bearish: 0 };
    if (row.stance === "bullish") cur.bullish += row._count.stockId;
    else cur.bearish += row._count.stockId;
    countMap.set(row.stockId, cur);
  }

  // 按总次数排序，取前 N
  const topIds = [...countMap.entries()]
    .sort((a, b) => (b[1].bullish + b[1].bearish) - (a[1].bullish + a[1].bearish))
    .slice(0, limit)
    .map(([id]) => id);

  const stocks = await prisma.stock.findMany({
    where: { id: { in: topIds } },
    select: { id: true, ticker: true, companyName: true }
  });
  const stockById = new Map(stocks.map((s) => [s.id, s]));

  return topIds.map((id) => {
    const stock = stockById.get(id);
    const counts = countMap.get(id) ?? { bullish: 0, bearish: 0 };
    return {
      ticker: stock?.ticker ?? "UNKNOWN",
      companyName: stock?.companyName ?? null,
      bullishCount: counts.bullish,
      bearishCount: counts.bearish,
      totalCount: counts.bullish + counts.bearish
    };
  });
}
