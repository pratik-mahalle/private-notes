export const RECORDING_CAP_MS = 600_000; // 10 minutes

export function formatClock(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const secs = (ms: number) => Math.max(1, Math.round(ms / 1000)); // "in 0 s" reads like a bug

export const transcribedLabel = (audioMs: number, tookMs: number) => `Transcribed ${formatClock(audioMs)} in ${secs(tookMs)} s`;
export const notesLabel = (tookMs: number) => `Notes written in ${secs(tookMs)} s`;
