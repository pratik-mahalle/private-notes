// Pure audio helpers (no SDK, no DOM). Whisper truncates after ~30 s, so long audio is split at quiet points.

export function wavToFloat32(bytes: Uint8Array): { samples: Float32Array; sampleRate: number } {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (bytes.length < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('Not a WAV file');
  let sampleRate = 0;
  for (let o = 12; o + 8 <= bytes.length; ) {
    const id = tag(o);
    const size = v.getUint32(o + 4, true);
    const body = o + 8;
    if (id === 'fmt ') {
      if (v.getUint16(body, true) !== 1 || v.getUint16(body + 2, true) !== 1 || v.getUint16(body + 14, true) !== 16)
        throw new Error('Only 16-bit PCM mono WAV is supported');
      sampleRate = v.getUint32(body + 4, true);
    } else if (id === 'data') {
      if (!sampleRate) throw new Error('WAV data chunk before fmt chunk');
      const n = Math.floor((Math.min(size, bytes.length - body)) / 2);
      const samples = new Float32Array(n);
      for (let i = 0; i < n; i++) samples[i] = v.getInt16(body + i * 2, true) / 32768;
      return { samples, sampleRate };
    }
    o = body + size + (size & 1); // chunks are word-aligned
  }
  throw new Error('WAV has no data chunk');
}

export function splitAtQuietPoints(samples: Float32Array, sampleRate: number, maxSec = 28, minSec = 20, frameSec = 0.1): Float32Array[] {
  const max = Math.round(maxSec * sampleRate), min = Math.round(minSec * sampleRate), frame = Math.round(frameSec * sampleRate);
  const chunks: Float32Array[] = [];
  let start = 0;
  while (samples.length - start > max) {
    let best = start + min, bestE = Infinity;
    for (let f = start + min; f < start + max; f += frame) {
      let e = 0;
      for (let i = f; i < f + frame; i++) e += samples[i] * samples[i];
      if (e < bestE) { bestE = e; best = f; }
    }
    const cut = best + (frame >> 1);
    chunks.push(samples.subarray(start, cut));
    start = cut;
  }
  chunks.push(samples.subarray(start));
  return chunks;
}

export async function transcribeLong(
  samples: Float32Array,
  sampleRate: number,
  transcribe: (chunk: Float32Array, sampleRate: number) => Promise<string>,
): Promise<string> {
  const texts: string[] = [];
  for (const chunk of splitAtQuietPoints(samples, sampleRate)) texts.push((await transcribe(chunk, sampleRate)).trim());
  return texts.filter(Boolean).join(' ');
}
