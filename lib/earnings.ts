/**
 * Earnings data fetcher using Yahoo Finance unofficial API.
 * Falls back gracefully — caller always gets null on failure.
 */

export interface QuarterlyEarning {
  /** e.g. "Q1 2025" */
  period: string;
  epsActual: number | null;
  epsEstimate: number | null;
  /** decimal fraction, e.g. 0.12 = +12% surprise */
  surprisePct: number | null;
}

export interface EarningsData {
  /** Earliest expected date for next earnings */
  nextDate: Date | null;
  /** Latest expected date (Yahoo gives a window), null if single day */
  nextDateEnd: Date | null;
  /** Timing hint: "amc" = after market close, "bmo" = before market open */
  callTime: "amc" | "bmo" | null;
  /** Consensus EPS estimate for upcoming quarter */
  epsEstimate: number | null;
  /** Most recent quarters, newest first */
  history: QuarterlyEarning[];
}

export async function fetchEarnings(ticker: string): Promise<EarningsData | null> {
  try {
    const encoded = encodeURIComponent(ticker.toUpperCase());
    const url =
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encoded}` +
      `?modules=calendarEvents%2CearningsHistory&corsDomain=finance.yahoo.com&formatted=false`;

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://finance.yahoo.com/",
        Origin: "https://finance.yahoo.com",
      },
      signal: AbortSignal.timeout(6000),
      // Next.js cache: revalidate every hour
      next: { revalidate: 3600 },
    } as RequestInit);

    if (!res.ok) return null;

    const json = await res.json();
    const result = json?.quoteSummary?.result?.[0];
    if (!result) return null;

    const cal = result.calendarEvents?.earnings;
    const historyRaw: unknown[] = result.earningsHistory?.history ?? [];

    // ── Next earnings date ──────────────────────────────────────────────────
    let nextDate: Date | null = null;
    let nextDateEnd: Date | null = null;

    if (Array.isArray(cal?.earningsDate) && cal.earningsDate.length > 0) {
      const ts0 = rawTs(cal.earningsDate[0]);
      if (ts0) nextDate = new Date(ts0 * 1000);
      if (cal.earningsDate.length > 1) {
        const ts1 = rawTs(cal.earningsDate[1]);
        if (ts1) nextDateEnd = new Date(ts1 * 1000);
      }
    }

    const callTime =
      cal?.earningsCallTime === "amc"
        ? "amc"
        : cal?.earningsCallTime === "bmo"
          ? "bmo"
          : null;

    const epsEstimate =
      typeof cal?.earningsAverage === "number"
        ? cal.earningsAverage
        : (cal?.earningsAverage?.raw ?? null);

    // ── Quarterly history ───────────────────────────────────────────────────
    const history: QuarterlyEarning[] = (historyRaw as Record<string, unknown>[])
      .slice(-4)
      .reverse()
      .map((h) => ({
        period: parsePeriod(String(h.period ?? "")),
        epsActual: numOf(h.epsActual),
        epsEstimate: numOf(h.epsEstimate),
        surprisePct: numOf(h.surprisePercent),
      }));

    return { nextDate, nextDateEnd, callTime, epsEstimate, history };
  } catch {
    return null;
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function rawTs(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "raw" in v) return (v as { raw: number }).raw ?? null;
  return null;
}

function numOf(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "raw" in v) {
    const r = (v as { raw: unknown }).raw;
    return typeof r === "number" ? r : null;
  }
  return null;
}

/**
 * "3M2025"  → "Q1 2025"
 * "6M2025"  → "Q2 2025"
 * "9M2025"  → "Q3 2025"
 * "12M2025" → "Q4 2025"
 */
function parsePeriod(raw: string): string {
  const m = raw.match(/^(\d+)M(\d{4})$/);
  if (!m) return raw;
  const q = Math.ceil(parseInt(m[1], 10) / 3);
  return `Q${q} ${m[2]}`;
}
