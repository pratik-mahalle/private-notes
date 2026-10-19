import type { Notes } from './notes';
import { formatClock, RECORDING_CAP_MS } from './format';
import { REPO_URL } from './support';

export type Step = { label: string; done: boolean };
export type AppState =
  | { kind: 'loading'; doneBytes: number; totalBytes: number }
  | { kind: 'setup-error' }
  | { kind: 'ready'; error?: string }
  | { kind: 'unsupported'; demo?: boolean }
  | { kind: 'mic-denied' }
  | { kind: 'no-speech' }
  | { kind: 'notes-failed'; steps: Step[]; transcript: string }
  | { kind: 'recording'; elapsedMs: number; level: number }
  | { kind: 'processing'; steps: Step[] }
  | { kind: 'result'; steps: Step[]; notes: Notes; transcript: string };

const mb = (b: number) => Math.round(b / 1e6);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const svg = (body: string, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${body}</svg>`;
const line = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICON = {
  mic: svg('<rect x="9" y="2.5" width="6" height="11.5" rx="3"/><path d="M5.5 10.5a6.5 6.5 0 0 0 13 0M12 17v4"/>', line),
  stop: svg('<rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/>'),
  play: svg('<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>', line),
};

const BARS = 40;
const calm = matchMedia('(prefers-reduced-motion: reduce)');
let shown = '';
let wave: number[] = [];
let lastShift = 0;

const privacy = `<p class="privacy">${ICON.lock}Recordings never leave this laptop.</p>`;

function steps(list: Step[]): string {
  const li = (s: Step) => `<li class="${s.done ? 'done' : 'busy'}"><span class="ico">${s.done ? '✓' : ''}</span>${esc(s.label)}</li>`;
  return `<ul data-testid="steps" class="steps" aria-live="polite">${list.map(li).join('')}</ul>`;
}

function notesCard(notes: Notes, transcript: string): string {
  const item = (i: Notes['actionItems'][number]) =>
    `<li><label><input type="checkbox"><span>${i.owner ? `<strong>${esc(i.owner)}</strong> — ` : ''}${esc(i.task)}${i.due ? ` <span class="due">· ${esc(i.due)}</span>` : ''}</span></label></li>`;
  const body = `<h2>Summary</h2><p data-testid="summary">${esc(notes.summary)}</p>${
    notes.decisions.length ? `<h2>Decisions</h2><ul data-testid="decisions" class="bullets">${notes.decisions.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''
  }<h2>Action items</h2><ul data-testid="action-items" class="checklist">${
    notes.actionItems.map(item).join('') || '<li class="none">No action items.</li>'
  }</ul>`;
  return `<article data-testid="notes" class="card">${body}
    <div class="actions">
      <button data-testid="copy" class="btn primary">Copy notes</button>
      <button data-testid="transcript-toggle" class="btn" aria-expanded="false" aria-controls="transcript">Show transcript</button>
      <button data-testid="new-recording" class="btn end">New recording</button>
    </div>
    <div data-testid="transcript" id="transcript" class="transcript" hidden>${esc(transcript) || '<span class="none">No speech captured.</span>'}</div>
  </article>`;
}

function screen(state: AppState): string {
  switch (state.kind) {
    case 'unsupported':
      return `<div data-testid="fallback" class="fallback">
        <p class="lede">Record a meeting. Get the notes.</p>
        <p class="why">Private Notes runs AI on your laptop's GPU. Open this link in Chrome on a laptop to try it.</p>
        ${privacy}
        ${state.demo ? '<video data-testid="demo-video" src="/demo.mp4" controls playsinline preload="metadata"></video>' : ''}
        <a class="btn code" href="${REPO_URL}">See the code</a>
      </div>`;
    case 'setup-error':
      return `<p data-testid="setup-error" class="error">Couldn't download the AI models. Connect to the internet and reload — it's a one-time ~690 MB setup.</p>`;
    case 'no-speech':
      return `<p data-testid="no-speech" class="error">I didn't catch any speech. Try again a little closer to the mic.</p>
        <button data-testid="new-recording" class="btn end">New recording</button>`;
    case 'notes-failed':
      return `${steps(state.steps)}<article class="card"><p data-testid="notes-failed" class="error">Couldn't turn this into notes. Here's the transcript.</p>
        <div data-testid="transcript" id="transcript" class="transcript">${esc(state.transcript)}</div>
        <div class="actions"><button data-testid="retry-notes" class="btn primary">Try again</button><button data-testid="new-recording" class="btn end">New recording</button></div></article>`;
    case 'loading':
    case 'mic-denied':
    case 'ready': {
      const loading = state.kind === 'loading';
      const pct = loading && state.totalBytes ? Math.floor((state.doneBytes / state.totalBytes) * 100) : 0;
      // Cached models (0 / 0 bytes) or a finished download: the models are loading into memory, so show a spinner, not a stuck bar.
      const download = loading && state.doneBytes < state.totalBytes
        ? `<p>Preparing your private AI… <b>${pct}%</b></p><progress max="100" value="${pct}"></progress><p class="sub">${mb(state.doneBytes)} / ${mb(state.totalBytes)} MB · one-time download</p>`
        : '<p class="models"><span class="spinner"></span>Loading the models…</p>';
      const status = loading ? `<div data-testid="progress" class="progress">${download}</div>`
        : state.kind === 'mic-denied' ? `<p data-testid="mic-denied" class="error">Microphone access is blocked. Allow it in your browser's address bar, or try the sample meeting.</p>`
        : state.error ? `<p data-testid="ready-error" class="error">${esc(state.error)}</p>`
        : `<p class="hint">Click to start recording</p>`;
      return `<p class="lede">Record a meeting. Get the notes.</p>
        <button data-testid="record" class="mic-btn" aria-label="Record" ${loading ? 'disabled' : ''}>${ICON.mic}</button>
        ${status}${privacy}
        <button data-testid="use-sample" class="sample" ${loading ? 'disabled' : ''}>${ICON.play}Use a sample meeting instead</button>`;
    }
    case 'recording':
      return `<p class="lede"><span class="rec-dot"></span>Recording</p>
        <button data-testid="record" class="mic-btn stop" aria-label="Stop">${ICON.stop}</button>
        <p data-testid="timer" class="timer"><span class="now">${formatClock(state.elapsedMs)}</span> <span class="cap">/ ${formatClock(RECORDING_CAP_MS)}</span></p>
        <div data-testid="level" class="level" aria-hidden="true">${'<i></i>'.repeat(BARS)}</div>
        ${privacy}`;
    case 'processing':
      return `<p class="lede">Turning your meeting into notes</p>${steps(state.steps)}${privacy}`;
    case 'result':
      return steps(state.steps) + notesCard(state.notes, state.transcript);
  }
}

// Timer and level change many times a second: patch them in place so the stop button keeps focus and hover.
function updateRecording(app: HTMLElement, state: { elapsedMs: number; level: number }): void {
  const now = app.querySelector('.timer .now')!;
  const clock = formatClock(state.elapsedMs);
  if (now.textContent !== clock) now.textContent = clock;
  const t = performance.now();
  if (t - lastShift < (calm.matches ? 250 : 70)) return;
  lastShift = t;
  wave.shift();
  // Measured (Chrome fake mic, TTS speech): level p10 0.16, median 0.33, p90 0.42. Map 0.08–0.48 onto the bar.
  wave.push(Math.min(1, Math.max(0, (state.level - 0.08) / 0.4)));
  app.querySelectorAll<HTMLElement>('.level i').forEach((bar, i) => (bar.style.height = `${8 + wave[i] * 92}%`));
}

export const setBadge = () => {
  const b = document.querySelector('[data-testid=badge]');
  if (b) b.textContent = navigator.onLine ? '100% on-device' : 'Offline ✓ · 100% on-device';
};

export function render(state: AppState): void {
  const app = document.getElementById('app')!;
  if (state.kind === 'recording' && shown === 'recording') return updateRecording(app, state);
  shown = state.kind;
  app.innerHTML = `<header class="top"><h1 class="brand"><span class="logo" aria-hidden="true"></span>Private Notes</h1><span data-testid="badge" class="badge">100% on-device</span></header>
    <section class="stage ${state.kind}">${screen(state)}</section>
    <footer class="foot">Built with <strong>RunAnywhere Web SDK</strong> · <a href="${REPO_URL}">Source</a></footer>`;
  setBadge();
  if (state.kind === 'recording') {
    wave = Array(BARS).fill(0);
    app.querySelector<HTMLElement>('[data-testid=record]')!.focus();
  }
}
