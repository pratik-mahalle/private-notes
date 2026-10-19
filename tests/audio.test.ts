import { test, expect } from 'vitest';
import { splitAtQuietPoints, transcribeLong, wavToFloat32 } from '../src/audio';

const sr = 16000;
const tone = (sec: number) => Float32Array.from({ length: sec * sr }, (_, i) => 0.5 * Math.sin(i / 5));

function makeWav(pcm: number[], rate: number, opts: { extraChunk?: string } = {}): Uint8Array {
  const extra = opts.extraChunk ? 8 + 4 : 0;
  const buf = new ArrayBuffer(12 + extra + 8 + 16 + 8 + pcm.length * 2);
  const v = new DataView(buf);
  const tag = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  let o = 0;
  tag(o, 'RIFF'); v.setUint32(o + 4, buf.byteLength - 8, true); tag(o + 8, 'WAVE'); o += 12;
  if (opts.extraChunk) { tag(o, opts.extraChunk); v.setUint32(o + 4, 4, true); o += 12; }
  tag(o, 'fmt '); v.setUint32(o + 4, 16, true);
  v.setUint16(o + 8, 1, true); v.setUint16(o + 10, 1, true); v.setUint32(o + 12, rate, true);
  v.setUint32(o + 16, rate * 2, true); v.setUint16(o + 20, 2, true); v.setUint16(o + 22, 16, true); o += 24;
  tag(o, 'data'); v.setUint32(o + 4, pcm.length * 2, true); o += 8;
  pcm.forEach((s, i) => v.setInt16(o + i * 2, s, true));
  return new Uint8Array(buf);
}

test('audio of 28 s or less stays one chunk', () => {
  expect(splitAtQuietPoints(tone(28), sr).map((c) => c.length)).toEqual([28 * sr]);
});
test('cuts at the quietest frame between 20 s and 28 s', () => {
  const s = tone(60); s.fill(0, 23 * sr, 23 * sr + 1600);           // 100 ms of silence at 23.0 s
  const chunks = splitAtQuietPoints(s, sr);
  expect(chunks[0].length).toBe(23 * sr + 800);                      // cut at the silent frame's centre
  expect(chunks.reduce((n, c) => n + c.length, 0)).toBe(60 * sr);    // nothing lost or duplicated
  expect(chunks.every((c) => c.length <= 28 * sr)).toBe(true);
});
test('wavToFloat32 skips extra RIFF chunks', () => {
  const { samples, sampleRate } = wavToFloat32(makeWav([0, 16384, -32768], 16000, { extraChunk: 'FLLR' }));
  expect(sampleRate).toBe(16000); expect(Array.from(samples)).toEqual([0, 0.5, -1]);
});
test('transcribeLong joins non-empty trimmed chunk texts in order', async () => {
  const s = tone(60); s.fill(0, 23 * sr, 23 * sr + 1600);
  const texts = [' first ', '', 'third'];
  let i = 0;
  expect(await transcribeLong(s, sr, async () => texts[i++])).toBe('first third');
});
