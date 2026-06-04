import { NextResponse } from "next/server";
import { ALL_COMPANIES } from "@/lib/supply-chain-data";

// Cache for 15 minutes server-side; stale-while-revalidate lets old data serve
// while background revalidation runs.
export const revalidate = 900;

export type QuoteData = {
  dp24h: number | null;
  dp7d: number | null;
  dp30d: number | null;
  price: number | null;
};

const UNIQUE_TICKERS = [...new Set(ALL_COMPANIES.map((c) => c.ticker))];

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://finance.yahoo.com/",
};

/**
 * Fetch 35 days of daily candle from Yahoo Finance chart API.
 * Returns dp24h, dp7d, dp30d computed from close prices.
 */
async function fetchYahooChart(ticker: string): Promise<{ ticker: string; data: QuoteData | null }> {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=35d`;

  try {
    const res = await fetch(url, {
      headers: YAHOO_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { ticker, data: null };

    const json = (await res.json()) as {
      chart?: {
        result?: Array<{
          meta?: { regularMarketPrice?: number };
          timestamp?: number[];
          indicators?: {
            quote?: Array<{ close?: (number | null)[] }>;
          };
        }>;
      };
    };

    const result = json?.chart?.result?.[0];
    if (!result) return { ticker, data: null };

    const closes = result.indicators?.quote?.[0]?.close ?? [];
    const timestamps = result.timestamp ?? [];
    const price = result.meta?.regularMarketPrice ?? null;

    if (closes.length < 2) return { ticker, data: null };

    // Find the most recent non-null close
    let lastClose: number | null = null;
    let lastIdx = -1;
    for (let i = closes.length - 1; i >= 0; i--) {
      if (closes[i] != null) { lastClose = closes[i] as number; lastIdx = i; break; }
    }
    if (lastClose === null || lastIdx < 1) return { ticker, data: null };

    // Previous trading day close (for dp24h)
    let prevClose: number | null = null;
    for (let i = lastIdx - 1; i >= 0; i--) {
      if (closes[i] != null) { prevClose = closes[i] as number; break; }
    }

    const now = timestamps[lastIdx] ?? Date.now() / 1000;
    const ts7dAgo  = now - 7  * 24 * 3600;
    const ts30dAgo = now - 30 * 24 * 3600;

    // Find last close before a timestamp threshold
    const closeAtOrBefore = (tsThreshold: number): number | null => {
      for (let i = lastIdx - 1; i >= 0; i--) {
        if ((timestamps[i] ?? Infinity) <= tsThreshold && closes[i] != null) {
          return closes[i] as number;
        }
      }
      return null;
    };

    const close7d  = closeAtOrBefore(ts7dAgo);
    const close30d = closeAtOrBefore(ts30dAgo);

    const pct = (curr: number, base: number | null): number | null =>
      base ? +((((curr - base) / base) * 100).toFixed(2)) : null;

    return {
      ticker,
      data: {
        price: price ?? +lastClose.toFixed(2),
        dp24h: pct(lastClose, prevClose),
        dp7d:  pct(lastClose, close7d),
        dp30d: pct(lastClose, close30d),
      },
    };
  } catch {
    return { ticker, data: null };
  }
}

/** Run tasks with bounded concurrency. */
async function withConcurrency<T>(
  items: string[],
  limit: number,
  fn: (item: string) => Promise<T>,
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchResults = await Promise.allSettled(batch.map(fn));
    for (const r of batchResults) {
      if (r.status === "fulfilled") results.push(r.value);
    }
  }
  return results;
}

export async function GET() {
  // 15 concurrent calls — Yahoo Finance chart is lenient; no API key needed.
  const entries = await withConcurrency(UNIQUE_TICKERS, 15, fetchYahooChart);

  const map: Record<string, QuoteData> = {};
  for (const { ticker, data } of entries) {
    if (data) map[ticker] = data;
  }

  return NextResponse.json(map, {
    headers: {
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
    },
  });
}
