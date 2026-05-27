import { withRetry } from "@/lib/retry";

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string
  ) {
    super(message);
  }
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  retries = 2
): Promise<T> {
  return withRetry(async () => {
    const response = await fetch(url, init);
    const text = await response.text();
    if (!response.ok) {
      throw new HttpError(`HTTP ${response.status} for ${url}`, response.status, text);
    }
    return text ? (JSON.parse(text) as T) : ({} as T);
  }, { retries, delayMs: 700 });
}
