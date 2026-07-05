/**
 * 数据洞察模块
 * 从数据库中聚合投资信号统计，用于推送消息中的"热榜"板块
 */

import { prisma } from "@/lib/prisma";

export type TopMention = {
  ticker: string;
  companyName: string | null;
  exchange: string | null;
  bullishCount: number;
  bearishCount: number;
  totalCount: number;
};

/**
 * 查询近 N 天内被提及次数最多的股票（合并多空计数），用于推送热榜
 * @param days   统计天数，默认 30 天
 * @param limit  返回条数，默认 8 条
 */
export async function getTopMentionedStocks(
  days = 30,
  limit = 8,
  channelId?: string
): Promise<TopMention[]> {
  return getAllMentionedStocks(days, limit, channelId);
}

/**
 * 查询所有被提及过的股票（含多空），按总次数降序，用于 Dashboard 完整列表
 * @param days  统计天数，默认 30 天
 * @param limit 最大返回条数，默认不限（9999）
 */
export async function getAllMentionedStocks(
  days = 30,
  limit = 9999,
  channelId?: string
): Promise<TopMention[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // 如果指定了频道，先找出该频道的 tweet IDs
  let tweetIdFilter: { in: string[] } | undefined;
  if (channelId) {
    const tweetIds = await prisma.tweet.findMany({
      where: { channelId, tweetCreatedAt: { gte: since } },
      select: { id: true },
    });
    if (tweetIds.length === 0) return [];
    tweetIdFilter = { in: tweetIds.map((t) => t.id) };
  }

  const rows = await prisma.stockMention.groupBy({
    by: ["stockId", "stance"],
    where: {
      createdAt: { gte: since },
      ...(tweetIdFilter ? { tweetId: tweetIdFilter } : {}),
    },
    _count: { stockId: true },
    orderBy: { _count: { stockId: "desc" } }
  });

  if (rows.length === 0) return [];

  const countMap = new Map<string, { bullish: number; bearish: number }>();
  for (const row of rows) {
    const cur = countMap.get(row.stockId) ?? { bullish: 0, bearish: 0 };
    if (row.stance === "bullish") cur.bullish += row._count.stockId;
    else cur.bearish += row._count.stockId;
    countMap.set(row.stockId, cur);
  }

  const sortedIds = [...countMap.entries()]
    .sort((a, b) => (b[1].bullish + b[1].bearish) - (a[1].bullish + a[1].bearish))
    .slice(0, limit)
    .map(([id]) => id);

  const stocks = await prisma.stock.findMany({
    where: { id: { in: sortedIds } },
    select: { id: true, ticker: true, companyName: true, exchange: true }
  });
  const stockById = new Map(stocks.map((s) => [s.id, s]));

  return sortedIds.map((id) => {
    const stock = stockById.get(id);
    const counts = countMap.get(id) ?? { bullish: 0, bearish: 0 };
    return {
      ticker: stock?.ticker ?? "UNKNOWN",
      companyName: stock?.companyName ?? null,
      exchange: stock?.exchange ?? null,
      bullishCount: counts.bullish,
      bearishCount: counts.bearish,
      totalCount: counts.bullish + counts.bearish
    };
  });
}

const A_SHARE_TICKER_REGEX = /^\d{6}(\.(SZ|SH|SS))?$/i;

// Finnhub 对中国大陆交易所（上交所/深交所）的 exchange 字段关键词
export const CHINESE_EXCHANGE_PATTERNS = /SHH|SHA|SHSE|SHE|SZSE|CNE|XSHG|XSHE/i;

export function isAShareTicker(ticker: string): boolean {
  return A_SHARE_TICKER_REGEX.test(ticker);
}

/**
 * 综合判断：ticker 格式符合 A 股 + exchange 未被确认为非中国交易所
 * 用于 dashboard 侧边栏过滤，避免将韩国/日本等 6 位代码误判为 A 股
 */
export function isLikelyAShare(ticker: string, exchange: string | null): boolean {
  if (!isAShareTicker(ticker)) return false;
  // exchange 已设置且明确不是中国交易所 → 排除
  if (exchange && !CHINESE_EXCHANGE_PATTERNS.test(exchange)) return false;
  return true;
}

/**
 * 找出本条推文中"该频道历史上从未被提及过"的 A 股代码（不区分多空）。
 * 用于在推送标题中触发紧急提醒——首次点名的 A 股往往是信息差最大的窗口期。
 *
 * 故意不按多空过滤：AI 的看涨/看跌判断有时会出错，但"这是个全新的 A 股标的"
 * 这件事本身就值得让用户立刻点进去看一眼，不应该因为 AI 判断错了方向而错过。
 *
 * @param tickers        当前推文 AI 分析出的全部 ticker（看涨+看跌）
 * @param channelId      当前频道 ID（用于限定"历史"范围，跨频道不互相影响）
 * @param excludeTweetId 当前推文的内部 id（排除本条推文刚创建的 mention 记录）
 */
export async function findNewlyMentionedAShareTickers(
  tickers: string[],
  channelId: string | null | undefined,
  excludeTweetId: string
): Promise<string[]> {
  const candidates = [...new Set(tickers.filter(isAShareTicker))];
  if (candidates.length === 0) return [];

  const stocks = await prisma.stock.findMany({
    where: { ticker: { in: candidates } },
    select: { id: true, ticker: true, exchange: true }
  });

  // 如果 exchange 已被 Finnhub 补充，且明确不是中国交易所，直接排除
  // 中国交易所关键词：SHH/SHA/SHSE（上交所）、SHE/SZSE（深交所）、CNE、null（未知，保留）
  const CHINESE_EXCHANGE_PATTERNS = /SHH|SHA|SHSE|SHE|SZSE|CNE|XSHG|XSHE/i;
  const confirmedAShareStocks = stocks.filter(
    (s) => !s.exchange || CHINESE_EXCHANGE_PATTERNS.test(s.exchange)
  );

  const stockIdByTicker = new Map(confirmedAShareStocks.map((s) => [s.ticker, s.id]));
  const knownStockIds = confirmedAShareStocks.map((s) => s.id);

  const seenStockIds = new Set(
    knownStockIds.length === 0
      ? []
      : (
          await prisma.stockMention.findMany({
            where: {
              stockId: { in: knownStockIds },
              tweetId: { not: excludeTweetId },
              tweet: channelId ? { channelId } : {}
            },
            select: { stockId: true },
            distinct: ["stockId"]
          })
        ).map((m) => m.stockId)
  );

  return candidates.filter((ticker) => {
    const stockId = stockIdByTicker.get(ticker);
    return !stockId || !seenStockIds.has(stockId);
  });
}
