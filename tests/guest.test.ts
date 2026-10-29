import { afterEach, describe, expect, it, vi } from "vitest";
import { createGuestUid, guestContentCutoff, isGuestUid } from "@/lib/guest";

const HOUR_MS = 60 * 60 * 1000;

describe("guest uid", () => {
  it("creates unique GUEST_ prefixed ids", () => {
    const a = createGuestUid();
    const b = createGuestUid();
    expect(a).toMatch(/^GUEST_[0-9a-f]{16}$/);
    expect(a).not.toBe(b);
  });

  it.each([
    ["GUEST_0123456789abcdef", true],
    ["UID_abc", false],
    ["PWD_abc", false],
    ["", false],
    [null, false],
    [undefined, false],
  ])("isGuestUid(%j) is %s", (uid, expected) => {
    expect(isGuestUid(uid)).toBe(expected);
  });
});

describe("guestContentCutoff", () => {
  afterEach(() => vi.useRealTimers());

  it("is at least 24 hours old and floored to the hour so the cache key is shared", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-29T15:42:10Z"));
    expect(guestContentCutoff().toISOString()).toBe("2026-10-28T15:00:00.000Z");
  });

  it("stays the same for every request within the same hour", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-29T15:00:01Z"));
    const first = guestContentCutoff();
    vi.setSystemTime(new Date("2026-10-29T15:59:59Z"));
    expect(guestContentCutoff()).toEqual(first);
    expect(Date.now() - first.getTime()).toBeGreaterThanOrEqual(24 * HOUR_MS);
  });
});
