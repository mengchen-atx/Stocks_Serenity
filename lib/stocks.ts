import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { fetchJson } from "@/lib/http";
import type { StockProfile } from "@/types";

type FinnhubQuote = { c?: number };
type FinnhubProfile = {
  ticker?: string;
  name?: string;
  exchange?: string;
  currency?: string;
  marketCapitalization?: number;
  finnhubIndustry?: string;
  ipo?: string;
  weburl?: string;
};

type AlphaOverview = {
  Symbol?: string;
  Name?: string;
  Description?: string;
  MarketCapitalization?: string;
  Industry?: string;
  Exchange?: string;
  Currency?: string;
};

const themeRules: Array<[RegExp, string]> = [
  [/cpo|co-?packaged optics|silicon photonics|photonics|optical|transceiver/i, "光通信/CPO"],
  [/semiconductor|chip|asic|gpu|foundry|fabless/i, "半导体"],
  [/robot|automation|physical ai|humanoid/i, "机器人"],
  [/power|hvdc|800v|datacenter|data center/i, "AI电力/数据中心"],
  [/ai|artificial intelligence|accelerator/i, "AI基础设施"]
];

export async function enrichStocks(tickers: string[]): Promise<StockProfile[]> {
  const uniqueTickers = [...new Set(tickers.map(normalizeTicker).filter(Boolean))];
  const profiles: StockProfile[] = [];

  for (const ticker of uniqueTickers) {
    profiles.push(await getStockProfile(ticker));
  }

  return profiles;
}

export async function getStockProfile(ticker: string): Promise<StockProfile> {
  const normalized = normalizeTicker(ticker);
  const cached = await prisma.stock.findUnique({ where: { ticker: normalized } });
  const isFresh =
    cached?.lastFetchedAt &&
    cached?.price !== null &&           // 价格为空则强制重新拉取
    Date.now() - cached.lastFetchedAt.getTime() < 1000 * 60 * 30;

  if (cached && isFresh) {
    return {
      ticker: cached.ticker,
      price: cached.price,
      market_cap: cached.marketCapDisplay,
      market_cap_raw: cached.marketCap ? Number(cached.marketCap) : null,
      company: cached.companyName,
      company_description: cached.companyDescription,
      industry: cached.industry,
      theme: cached.themes,
      currency: cached.currency,
      exchange: cached.exchange
    };
  }

  const fromFinnhub = await fetchFinnhubProfile(normalized).catch(() => null);
  const fromAlpha = await fetchAlphaOverview(normalized).catch(() => null);
  const merged = mergeProfiles(normalized, fromFinnhub, fromAlpha);

  await prisma.stock.upsert({
    where: { ticker: normalized },
    create: {
      ticker: normalized,
      companyName: merged.company,
      exchange: merged.exchange,
      currency: merged.currency,
      price: merged.price,
      marketCap: merged.market_cap_raw ? BigInt(merged.market_cap_raw) : null,
      marketCapDisplay: merged.market_cap,
      companyDescription: merged.company_description,
      industry: merged.industry,
      themes: merged.theme,
      lastFetchedAt: new Date()
    },
    update: {
      companyName: merged.company || undefined, // never overwrite existing name with null
      exchange: merged.exchange,
      currency: merged.currency,
      price: merged.price,
      marketCap: merged.market_cap_raw ? BigInt(merged.market_cap_raw) : null,
      marketCapDisplay: merged.market_cap,
      companyDescription: merged.company_description,
      industry: merged.industry,
      themes: merged.theme,
      lastFetchedAt: new Date()
    }
  });

  return merged;
}

async function fetchFinnhubProfile(ticker: string) {
  if (!env.FINNHUB_API_KEY) return null;
  const quote = await fetchJson<FinnhubQuote>(
    `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${env.FINNHUB_API_KEY}`
  );
  const profile = await fetchJson<FinnhubProfile>(
    `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${env.FINNHUB_API_KEY}`
  );
  return { quote, profile };
}

async function fetchAlphaOverview(ticker: string) {
  if (!env.ALPHA_VANTAGE_API_KEY) return null;
  return fetchJson<AlphaOverview>(
    `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${env.ALPHA_VANTAGE_API_KEY}`
  );
}

function mergeProfiles(
  ticker: string,
  finnhub: { quote: FinnhubQuote; profile: FinnhubProfile } | null,
  alpha: AlphaOverview | null
): StockProfile {
  const marketCapRaw =
    parseNumber(alpha?.MarketCapitalization) ??
    (finnhub?.profile.marketCapitalization
      ? Math.round(finnhub.profile.marketCapitalization * 1_000_000)
      : null);
  const description = alpha?.Description || null;
  const industry = alpha?.Industry || finnhub?.profile.finnhubIndustry || null;
  const theme = inferThemes([description, industry, alpha?.Name, finnhub?.profile.name].filter(Boolean).join(" "));

  return {
    ticker,
    price: finnhub?.quote.c ?? null,
    market_cap: marketCapRaw ? formatMarketCap(marketCapRaw) : null,
    market_cap_raw: marketCapRaw,
    company: alpha?.Name || finnhub?.profile.name || null,
    company_description: description,
    industry,
    theme,
    currency: alpha?.Currency || finnhub?.profile.currency || null,
    exchange: alpha?.Exchange || finnhub?.profile.exchange || null
  };
}

function inferThemes(text: string): string[] {
  return themeRules.filter(([rule]) => rule.test(text)).map(([, theme]) => theme);
}

function normalizeTicker(ticker: string): string {
  return ticker.toUpperCase().replace(/^\$/, "").replace(/[^A-Z0-9.-]/g, "");
}

function parseNumber(value?: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatMarketCap(value: number): string {
  if (value >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  return String(value);
}
