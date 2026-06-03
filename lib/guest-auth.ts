/**
 * Guest token — one-click login link for users without WxPusher.
 *
 * Token format (URL-safe base64): `uid|expiresAtMs|hmac`
 * Same HMAC key as session cookie → no new secret needed.
 * Reusable: user can click the link multiple times to renew their 7-day session.
 */

import { createHmac, randomBytes } from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET ?? "fallback-secret";

/** Generate a synthetic guest UID */
export function generateGuestUid(): string {
  return "GUEST_" + randomBytes(8).toString("hex");
}

/** Encode uid + expiry into a URL-safe signed token */
export function generateGuestToken(uid: string, expiresAt: Date): string {
  const payload = `${uid}|${expiresAt.getTime()}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}|${sig}`).toString("base64url");
}

/** Decode and verify a guest token. Returns null if invalid or expired. */
export function verifyGuestToken(
  token: string,
): { uid: string; expiresAt: Date } | null {
  try {
    const raw = Buffer.from(token, "base64url").toString();
    const parts = raw.split("|");
    if (parts.length !== 3) return null;
    const [uid, expMs, sig] = parts;
    const payload = `${uid}|${expMs}`;
    const expected = createHmac("sha256", SECRET)
      .update(payload)
      .digest("hex");
    if (expected !== sig) return null;
    const expiresAt = new Date(parseInt(expMs, 10));
    if (expiresAt < new Date()) return null;
    return { uid, expiresAt };
  } catch {
    return null;
  }
}
