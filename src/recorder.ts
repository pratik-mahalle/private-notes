import { AudioCapture } from '@runanywhere/web/browser';

export interface CaptureLike {
  start(onChunk?: (s: Float32Array) => void, onLevel?: (l: number) => void): Promise<void>;
  stop(): void;
  drainBuffer(): Float32Array;
  readonly actualSampleRate: number;
}

export function createRecorder(opts: {
  capMs: number;
  onTick(ms: number): void;
  onLevel(level: number): void;
  onCap(): void;
  capture?: CaptureLike;
}): { start(): Promise<void>; stop(): { samples: Float32Array; sampleRate: number } } {
  const capture = opts.capture ?? new AudioCapture({ sampleRate: 16000, channels: 1 });
  let tick: ReturnType<typeof setInterval> | undefined;
  let cap: ReturnType<typeof setTimeout> | undefined;
  return {
    async start() {
      try {
        await capture.start(undefined, (l) => opts.onLevel(l));
      } catch (e) {
        capture.stop(); // release a half-opened mic stream
        throw e;
      }
      const t0 = Date.now();
      // Wall clock, not a tick count: background tabs throttle intervals.
      tick = setInterval(() => opts.onTick(Math.round((Date.now() - t0) / 250) * 250), 250);
      cap = setTimeout(() => opts.onCap(), opts.capMs);
    },
    stop() {
      clearInterval(tick);
      clearTimeout(cap);
      const samples = capture.drainBuffer();
      const sampleRate = capture.actualSampleRate; // read before stop() closes the AudioContext
      capture.stop();
      return { samples, sampleRate };
    },
  };
}
