/**
 * Signed session token: base64url("uid|expiresMs|hmacSha256(uid|expiresMs)").
 * Pure functions with an explicit secret so they can be unit tested.
 */
import { createHmac, timingSafeEqual } from "crypto";

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function encodeSessionToken(uid: string, expiresAt: Date, secret: string): string {
  const payload = `${uid}|${expiresAt.getTime()}`;
  return Buffer.from(`${payload}|${sign(payload, secret)}`).toString("base64url");
}

/** Returns null when the token is malformed, tampered with, or expired. */
export function decodeSessionToken(
  token: string,
  secret: string,
  now: Date = new Date()
): { uid: string; expiresAt: Date } | null {
  const parts = Buffer.from(token, "base64url").toString().split("|");
  if (parts.length !== 3) return null;

  const [uid, expMs, sig] = parts;
  if (!uid || !/^\d+$/.test(expMs)) return null;
  if (!safeEqual(sign(`${uid}|${expMs}`, secret), sig)) return null;

  const expiresAt = new Date(Number(expMs));
  if (expiresAt < now) return null;
  return { uid, expiresAt };
}
