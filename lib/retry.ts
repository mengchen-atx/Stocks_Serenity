export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; delayMs?: number; factor?: number } = {}
): Promise<T> {
  const retries = options.retries ?? 3;
  const delayMs = options.delayMs ?? 500;
  const factor = options.factor ?? 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await new Promise((resolve) =>
        setTimeout(resolve, delayMs * Math.pow(factor, attempt))
      );
    }
  }

  throw lastError;
}
