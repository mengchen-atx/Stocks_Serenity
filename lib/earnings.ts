/**
 * Earnings data via Finnhub API (free tier, 60 req/min).
 * Requires FINNHUB_API_KEY in environment.
 * Returns null when key is missing or on any fetch error.
 *
 * Endpoints used:
 *   GET /calendar/earnings  — upcoming earnings window
 *   GET /stock/earnings     — past quarterly EPS history
 */

export interface QuarterlyEarning {
  /** e.g. "Q2 2025" */
  period: string;
  epsActual: number | null;
  epsEstimate: number | null;
  /** e.g. 6.3 means +6.3% beat */
  surprisePct: number | null;
}

export interface EarningsData {
  /** Next confirmed earnings date (ISO date string) */
  nextDate: string | null;
  /** "amc" = after market close, "bmo" = before market open, "dmh" = during market hours */
  callTime: "amc" | "bmo" | "dmh" | null;
  /** Consensus EPS estimate for the upcoming quarter */
  epsEstimate: number | null;
  /** Most recent quarters, newest first */
  history: QuarterlyEarning[];
}

const BASE = "https://finnhub.io/api/v1";

function apiKey(): string {
  return process.env.FINNHUB_API_KEY ?? "";
}

export async function fetchEarnings(ticker: string): Promise<EarningsData | null> {
  const key = apiKey();
  if (!key) return null;

  const sym = encodeURIComponent(ticker.toUpperCase());

  // Query a 9-month forward window for next earnings
  const today = new Date();
  const from = isoDate(today);
  const to = isoDate(addMonths(today, 9));

  const [calData, histData] = await Promise.all([
    finnhubGet(`${BASE}/calendar/earnings?symbol=${sym}&from=${from}&to=${to}&token=${key}`),
    finnhubGet(`${BASE}/stock/earnings?symbol=${sym}&limit=5&token=${key}`),
  ]);

  if (!calData && !histData) return null;

  // ── Next earnings ────────────────────────────────────────────────────────
  let nextDate: string | null = null;
  let callTime: EarningsData["callTime"] = null;
  let epsEstimate: number | null = null;

  const calObj = calData as Record<string, unknown> | null;
  const upcoming = Array.isArray(calObj?.earningsCalendar)
    ? (calObj.earningsCalendar as Record<string, unknown>[])
    : [];

  if (upcoming.length > 0) {
    const next = upcoming[0]; // already sorted by date asc from Finnhub
    nextDate = typeof next.date === "string" ? next.date : null;
    callTime = normalizeHour(next.hour);
    epsEstimate = toNum(next.epsEstimate);
  }

  // ── History ──────────────────────────────────────────────────────────────
  const rawHistory = (Array.isArray(histData) ? histData : []) as Record<string, unknown>[];
  const history: QuarterlyEarning[] = rawHistory.slice(0, 4).map((h) => ({
    period: formatPeriod(String(h.period ?? ""), Number(h.quarter ?? 0), Number(h.year ?? 0)),
    epsActual: toNum(h.actual),
    epsEstimate: toNum(h.estimate),
    surprisePct: toNum(h.surprisePercent),
  }));

  return { nextDate, callTime, epsEstimate, history };
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function finnhubGet(url: string): Promise<Record<string, unknown> | unknown[] | null> {
  try {
    const res = await fetch(url, {
      headers: { "X-Finnhub-Token": apiKey() },
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

function toNum(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}

function normalizeHour(h: unknown): EarningsData["callTime"] {
  if (h === "amc" || h === "bmo" || h === "dmh") return h;
  return null;
}

/**
 * Build a human-readable period string.
 * Finnhub returns period as "2025-03-31" (quarter-end date),
 * plus separate quarter (1-4) and year fields.
 */
function formatPeriod(period: string, quarter: number, year: number): string {
  if (quarter >= 1 && quarter <= 4 && year > 2000) {
    return `Q${quarter} ${year}`;
  }
  // Fallback: parse from the date string "YYYY-MM-DD"
  const m = period.match(/^(\d{4})-(\d{2})/);
  if (m) {
    const q = Math.ceil(parseInt(m[2], 10) / 3);
    return `Q${q} ${m[1]}`;
  }
  return period;
}
