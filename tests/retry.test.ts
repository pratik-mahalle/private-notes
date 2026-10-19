import { test, expect } from 'vitest';
import { withRetry } from '../src/retry';

test('returns the first success without sleeping', async () => {
  const sleeps: number[] = [];
  await expect(withRetry(async () => 7, 3, 1000, async (ms) => { sleeps.push(ms); })).resolves.toBe(7);
  expect(sleeps).toEqual([]);
});
test('retries with doubling delays then succeeds', async () => {
  const sleeps: number[] = []; let n = 0;
  const r = await withRetry(async () => { if (++n < 3) throw new Error('x'); return 'ok'; }, 3, 1000, async (ms) => { sleeps.push(ms); });
  expect(r).toBe('ok'); expect(sleeps).toEqual([1000, 2000]);
});
test('rethrows the last error after the final attempt', async () => {
  let n = 0;
  await expect(withRetry(async () => { throw new Error(`e${++n}`); }, 3, 1, async () => {})).rejects.toThrow('e3');
});
