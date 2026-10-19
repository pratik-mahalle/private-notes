import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRecorder } from '../src/recorder';

let fake: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; drainBuffer: () => Float32Array; actualSampleRate: number };
beforeEach(() => {
  vi.useFakeTimers();
  fake = { start: vi.fn(async () => {}), stop: vi.fn(), drainBuffer: () => new Float32Array(32000), actualSampleRate: 16000 };
});
afterEach(() => { vi.useRealTimers(); });

test('ticks every 250 ms and fires onCap once at capMs', async () => {
  const ticks: number[] = []; let caps = 0;
  const r = createRecorder({ capMs: 1000, onTick: (ms) => ticks.push(ms), onLevel: () => {}, onCap: () => caps++, capture: fake });
  await r.start(); vi.advanceTimersByTime(1500);
  expect(ticks.slice(0, 4)).toEqual([250, 500, 750, 1000]); expect(caps).toBe(1);
});
test('stop returns the drained samples and sample rate and stops capture', async () => {
  const r = createRecorder({ capMs: 1000, onTick() {}, onLevel() {}, onCap() {}, capture: fake });
  await r.start(); const out = r.stop();
  expect(out.samples.length).toBe(32000); expect(out.sampleRate).toBe(16000); expect(fake.stop).toHaveBeenCalled();
});

test('a failed start stops capture and rethrows', async () => {
  fake.start.mockRejectedValue(new Error('NotAllowedError'));
  const r = createRecorder({ capMs: 1000, onTick() {}, onLevel() {}, onCap() {}, capture: fake });
  await expect(r.start()).rejects.toThrow('NotAllowedError');
  expect(fake.stop).toHaveBeenCalledTimes(1);
});
