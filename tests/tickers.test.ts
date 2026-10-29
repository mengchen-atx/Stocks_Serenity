import { describe, expect, it } from "vitest";
import { isAShareTicker, isLikelyAShare } from "@/lib/tickers";

describe("isAShareTicker", () => {
  it.each(["600519", "000001", "300750.SZ", "688981.sh", "600000.SS"])("accepts %s", (ticker) => {
    expect(isAShareTicker(ticker)).toBe(true);
  });

  it.each(["NVDA", "60051", "6005190", "0700.HK", "600519.HK"])("rejects %s", (ticker) => {
    expect(isAShareTicker(ticker)).toBe(false);
  });
});

describe("isLikelyAShare", () => {
  it("keeps a 6-digit code whose exchange is unknown", () => {
    expect(isLikelyAShare("600519", null)).toBe(true);
  });

  it("keeps a 6-digit code listed on a mainland exchange", () => {
    expect(isLikelyAShare("300750", "SHENZHEN STOCK EXCHANGE (SZSE)")).toBe(true);
  });

  it("drops a Korean 6-digit code", () => {
    expect(isLikelyAShare("005930", "KOREA EXCHANGE (KRX)")).toBe(false);
  });

  it("drops a non-numeric ticker regardless of exchange", () => {
    expect(isLikelyAShare("NVDA", null)).toBe(false);
  });
});
