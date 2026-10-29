import { randomBytes } from "crypto";

const GUEST_PREFIX = "GUEST_";

export const GUEST_SESSION_DAYS = 1;

// Guests only see content older than this, so the real-time feed stays a paid feature.
const GUEST_CONTENT_DELAY_MS = 24 * 60 * 60 * 1000;

export function createGuestUid(): string {
  return `${GUEST_PREFIX}${randomBytes(8).toString("hex")}`;
}

export function isGuestUid(uid: string | null | undefined): boolean {
  return !!uid && uid.startsWith(GUEST_PREFIX);
}

/** Latest tweet time a guest may see, floored to the hour so cached queries stay shared. */
export function guestContentCutoff(): Date {
  const hourMs = 60 * 60 * 1000;
  return new Date(Math.floor((Date.now() - GUEST_CONTENT_DELAY_MS) / hourMs) * hourMs);
}
