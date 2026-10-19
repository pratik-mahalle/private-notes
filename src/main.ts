import './styles.css';
import { render, setBadge, type AppState, type Step } from './ui';
import { transcribeLong, wavToFloat32 } from './audio';
import { hasEnoughSpeech, notesToMarkdown, parseNotes } from './notes';
import { isSupported, readEnv } from './support';
import { notesLabel, transcribedLabel, RECORDING_CAP_MS } from './format';

// SDK and recorder are imported only once the browser passes the support check: phones never load them.
let sdk: typeof import('./sdk');
let createRecorder: typeof import('./recorder').createRecorder;

let state: AppState = { kind: 'loading', doneBytes: 0, totalBytes: 0 };
const show = (s: AppState) => render((state = s));
declare global { interface Window { __pnForceNotesFailure?: boolean } } // test-only hook
let recorder: ReturnType<typeof createRecorder> | null = null;
let busy = false;
let transcript = ''; // of the current pipeline run; lets a late failure fall back to the transcript
let sampleBytes: Promise<ArrayBuffer> | undefined; // fetched at ready, so the sample also works offline

// One pipeline at a time: buttons are no-ops while one runs.
function run(fn: () => Promise<unknown>) {
  if (busy) return;
  busy = true;
  transcript = '';
  fn().catch((e) => {
    console.error(e);
    show(transcript ? { kind: 'notes-failed', steps: [], transcript } : { kind: 'ready', error: "Couldn't transcribe that. Try again." });
  }).finally(() => (busy = false));
}

function fetchSample() {
  const p = fetch('/sample-meeting.wav').then((r) => {
    if (!r.ok) throw new Error(`sample fetch failed: ${r.status}`);
    return r.arrayBuffer();
  });
  p.catch(() => { if (sampleBytes === p) sampleBytes = undefined; }); // fetch again on the next click
  return (sampleBytes = p);
}

async function startRecording() {
  const r = createRecorder({
    capMs: RECORDING_CAP_MS,
    onTick: (elapsedMs) => { if (state.kind === 'recording') show({ ...state, elapsedMs }); },
    onLevel: (level) => { if (state.kind === 'recording') show({ ...state, level }); },
    onCap: () => run(stopRecording),
  });
  try {
    await r.start(); // permission denied, no device, device busy...
  } catch (e) {
    console.error(e);
    return show({ kind: 'mic-denied' });
  }
  recorder = r;
  show({ kind: 'recording', elapsedMs: 0, level: 0 });
}

async function stopRecording() {
  const r = recorder;
  recorder = null; // clear first so a throwing stop() leaves no stale state
  if (!r) return;
  const { samples, sampleRate } = r.stop();
  await makeNotes(samples, sampleRate);
}

async function useSample() {
  let bytes: ArrayBuffer;
  try {
    bytes = await (sampleBytes ?? fetchSample());
  } catch (e) {
    console.error(e);
    return show({ kind: 'ready', error: "Couldn't load the sample meeting." });
  }
  const { samples, sampleRate } = wavToFloat32(new Uint8Array(bytes));
  await makeNotes(samples, sampleRate);
}

async function makeNotes(samples: Float32Array, sampleRate: number) {
  show({ kind: 'processing', steps: [{ label: 'Transcribing…', done: false }] });
  const t = performance.now();
  const text = samples.length < sampleRate / 2 ? '' : await transcribeLong(samples, sampleRate, sdk.transcribeChunk);
  if (!hasEnoughSpeech(text)) return show({ kind: 'no-speech' });
  await writeResult([{ label: transcribedLabel((samples.length / sampleRate) * 1000, performance.now() - t), done: true }], text);
}

async function writeResult(done: Step[], text: string) {
  transcript = text;
  show({ kind: 'processing', steps: [...done, { label: 'Writing notes…', done: false }] });
  const t = performance.now();
  const ask = async () => window.__pnForceNotesFailure ? '' : sdk.writeNotes(text).catch((e) => { console.error(e); return ''; });
  // The 0.8B model sometimes returns broken JSON or copies the prompt example; a second sample usually works.
  const notes = parseNotes(await ask(), text) ?? parseNotes(await ask(), text);
  const steps = [...done, { label: notesLabel(performance.now() - t), done: true }];
  show(notes ? { kind: 'result', steps, notes, transcript: text } : { kind: 'notes-failed', steps: done, transcript: text });
}

function copyNotes(btn: HTMLButtonElement) {
  if (state.kind !== 'result') return;
  navigator.clipboard.writeText(notesToMarkdown(state.notes)).then(() => {
    btn.textContent = 'Copied ✓';
    setTimeout(() => (btn.textContent = 'Copy notes'), 2000);
  }, (e) => {
    console.error(e);
    btn.textContent = 'Copy failed';
    setTimeout(() => (btn.textContent = 'Copy notes'), 2000);
  });
}

function toggleTranscript(btn: HTMLButtonElement) {
  const box = document.querySelector<HTMLElement>('[data-testid=transcript]')!;
  box.hidden = !box.hidden;
  btn.textContent = box.hidden ? 'Show transcript' : 'Hide transcript';
  btn.setAttribute('aria-expanded', String(!box.hidden));
}

document.getElementById('app')!.addEventListener('click', (e) => {
  const btn = (e.target as Element).closest<HTMLButtonElement>('button[data-testid]');
  if (!btn || btn.disabled) return;
  switch (btn.dataset.testid) {
    // The second click of a double click would stop the recording it just started.
    case 'record': return e.detail > 1 || run(state.kind === 'recording' ? stopRecording : startRecording);
    case 'use-sample': return run(useSample);
    case 'retry-notes': {
      const s = state;
      return s.kind === 'notes-failed' && run(() => writeResult(s.steps, s.transcript));
    }
    case 'new-recording': return busy || show({ kind: 'ready' });
    case 'copy': return copyNotes(btn);
    case 'transcript-toggle': return toggleTranscript(btn);
  }
});

async function main() {
  if (!isSupported(readEnv())) {
    show({ kind: 'unsupported' });
    // Optional demo: the host may answer 200 with index.html for a missing file, so check the type too.
    const demo = await fetch('/demo.mp4', { method: 'HEAD' }).then((r) => r.ok && !!r.headers.get('content-type')?.startsWith('video/'), () => false);
    if (demo) show({ kind: 'unsupported', demo });
    return; // never load the SDK or fetch models
  }
  show(state);
  try {
    [sdk, { createRecorder }] = await Promise.all([import('./sdk'), import('./recorder')]);
    await sdk.initSdk();
    await sdk.ensureModels((doneBytes, totalBytes) => show({ kind: 'loading', doneBytes, totalBytes }));
    show({ kind: 'ready' });
    void fetchSample();
  } catch (e) {
    console.error(e);
    show({ kind: 'setup-error' });
  }
}
window.addEventListener('online', setBadge);
window.addEventListener('offline', setBadge);
void main();
