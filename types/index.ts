export type TweetInput = {
  tweetId: string;
  authorUsername: string;
  content: string;
  tweetCreatedAt: Date;
  sourceUrl?: string;
  /** 推文附带的图片 URL 列表（来自 Twitter API media expansion） */
  imageUrls?: string[];
};

export type StockSignal = {
  ticker: string;
  company: string;
  reason: string;
};

export type AiAnalysis = {
  summary_cn: string;
  translated_content_cn: string;
  bullish_stocks: StockSignal[];
  bearish_stocks: StockSignal[];
  sector_tags: string[];
  confidence: number;
};

export type StockProfile = {
  ticker: string;
  price: number | null;
  market_cap: string | null;
  market_cap_raw: number | null;
  company: string | null;
  company_description: string | null;
  industry: string | null;
  theme: string[];
  currency: string | null;
  exchange: string | null;
};
