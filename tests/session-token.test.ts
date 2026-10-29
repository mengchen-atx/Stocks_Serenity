import { describe, expect, it } from "vitest";
import { decodeSessionToken, encodeSessionToken } from "@/lib/session-token";

const SECRET = "test-secret";
const NOW = new Date("2026-10-01T00:00:00Z");
const LATER = new Date("2026-10-08T00:00:00Z");

describe("session token", () => {
  it("round-trips uid and expiry", () => {
    const token = encodeSessionToken("UID_abc", LATER, SECRET);
    expect(decodeSessionToken(token, SECRET, NOW)).toEqual({ uid: "UID_abc", expiresAt: LATER });
  });

  it("rejects a token signed with a different secret", () => {
    const token = encodeSessionToken("UID_abc", LATER, "other-secret");
    expect(decodeSessionToken(token, SECRET, NOW)).toBeNull();
  });

  it("rejects a token whose uid was swapped", () => {
    const token = encodeSessionToken("UID_abc", LATER, SECRET);
    const [, exp, sig] = Buffer.from(token, "base64url").toString().split("|");
    const forged = Buffer.from(`UID_admin|${exp}|${sig}`).toString("base64url");
    expect(decodeSessionToken(forged, SECRET, NOW)).toBeNull();
  });

  it("rejects a token whose expiry was extended", () => {
    const token = encodeSessionToken("UID_abc", NOW, SECRET);
    const [uid, , sig] = Buffer.from(token, "base64url").toString().split("|");
    const forged = Buffer.from(`${uid}|${LATER.getTime()}|${sig}`).toString("base64url");
    expect(decodeSessionToken(forged, SECRET, NOW)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = encodeSessionToken("UID_abc", NOW, SECRET);
    expect(decodeSessionToken(token, SECRET, LATER)).toBeNull();
  });

  it.each(["", "garbage", Buffer.from("a|b").toString("base64url"), Buffer.from("UID_x|notanumber|sig").toString("base64url")])(
    "rejects malformed token %j",
    (token) => {
      expect(decodeSessionToken(token, SECRET, NOW)).toBeNull();
    }
  );
});
