import { afterEach, describe, expect, it, vi } from "vitest";
import { withRetry } from "@/lib/retry";

describe("withRetry", () => {
  afterEach(() => vi.useRealTimers());

  it("returns the first successful result without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries with exponential backoff until success", async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockRejectedValueOnce(new Error("1")).mockRejectedValueOnce(new Error("2")).mockResolvedValue("ok");

    const promise = withRetry(fn, { retries: 3, delayMs: 100, factor: 2 });
    await vi.advanceTimersByTimeAsync(99);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(200);

    await expect(promise).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws the last error after exhausting retries", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("first")).mockRejectedValue(new Error("last"));
    await expect(withRetry(fn, { retries: 2, delayMs: 0 })).rejects.toThrow("last");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
