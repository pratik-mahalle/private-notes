const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 1000,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<T> {
  for (let k = 1; ; k++) {
    try {
      return await fn();
    } catch (e) {
      if (k >= attempts) throw e;
      await sleep(baseDelayMs * 2 ** (k - 1));
    }
  }
}
