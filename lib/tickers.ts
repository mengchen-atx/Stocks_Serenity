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
