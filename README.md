# Private Notes

Record a meeting, get a summary, decisions and action items. Transcription and note-writing both run in your browser with the [RunAnywhere Web SDK](https://github.com/RunanywhereAI/runanywhere-sdks/tree/main/bindings/web), on the GPU: speech-to-text and an LLM working together in one real flow.

**Recordings never leave this laptop.**

## Try it

Live: https://\<your-deployment\>.vercel.app (Chrome on a laptop with WebGPU)

The first visit downloads about 685 MB of models (roughly 40 s on my connection) and caches them in the browser. Later visits start in about 8 s. There is a "Use a sample meeting instead" link if you would rather not talk.

## How it works

1. **Start up.** `RunAnywhere.initialize({ environment: 'development' })`, register the llama.cpp and ONNX backends, load both models (~1 s, then 10-18 s for speech and 35-40 s for the LLM on the first visit; ~2 s and ~8 s when cached).
2. **Record.** Mic audio becomes 16 kHz mono, capped at 10 minutes.
3. **Transcribe.** Whisper tiny.en turns 29.7 s of audio into text in 2.7-3.2 s. Audio is split into pieces of at most 28 s, cut at the quietest moment, and the texts are joined.
4. **Write notes.** Qwen3.5-0.8B turns the transcript into notes in about 7 s (~40 tokens/s). The app has its own prompt and JSON parsing, checks the reply before showing it, and asks the model once more if the reply is broken or copies the prompt's example.
5. **Copy.** Notes copy as Markdown. Nothing is saved; they live on screen until you leave.

Timings are from an M4 in Chrome with WebGPU, both engines on the GPU.

## Built with RunAnywhere Web SDK

| Package | Version |
|---|---|
| `@runanywhere/web`, `web-llamacpp`, `web-onnx`, `proto-ts` | 0.20.27 (all pinned) |

| Role | Model | Size |
|---|---|---|
| Speech-to-text | `sherpa-onnx-whisper-tiny.en` | 152.8 MB |
| Notes | `qwen3.5-0.8b-q4_k_m` | 532.5 MB |

Plain Vite and TypeScript, no UI framework, no backend. Vercel serves the cross-origin isolation headers the SDK needs (`vercel.json`); `scripts/check-headers.sh <url>` checks them on a deployment.

## What I learned building it

Thank you to the RunAnywhere team: the SDK was fun to build on. These are the things I hit, in case they help the next developer.

- `llm.generateStructured` was not usable on web 0.20.27 with the LLM in the backend worker: `'repair'` and `'validationOnly'` throw `Backend not available for: structuredOutput.parse` (`'constrained'` is rejected on web by design), so the notes use a plain prompt and parse the reply myself. (draft: docs/upstream/01-web-generate-structured-unavailable.md)
- Model downloads sometimes fail near the end with a retryable code 153 and no detail; the app retries automatically. (draft: docs/upstream/02-web-model-download-code-153.md)
- `reasoning: { mode: 'off' }` did not stop Qwen3.5 from thinking on longer prompts; registering the model with `supportsThinking: false` fixed it. (draft: docs/upstream/03-web-reasoning-off-ignored-qwen3.5.md)
- The npm READMEs link to a broken `../../README.md`, show version 0.20.11 and use flat APIs rather than the namespaced `RunAnywhere.llm.*` / `RunAnywhere.stt.*` ones. (draft PR: docs/upstream/04-docs-web-npm-readmes.md)
- `stt.transcribe` stops after about 30 s of audio without an error, so I chunk the audio. (draft: docs/upstream/10-web-stt-transcribe-truncates-after-30s.md)
- `RunAnywhere.storage.refresh()` is needed on startup, or cached models are downloaded again.

## Deploy

Vercel, static: `npm run build`, then serve `dist/` with the headers in `vercel.json`. Before sharing the link, replace `<your-deployment>` in the `og:image` URL in `index.html` with the real Vercel host (the link-preview image is `public/og.png`).

## Run locally

```bash
npm ci
npm run dev      # http://localhost:3000, Chrome with WebGPU
npm test         # unit tests
npm run e2e      # end-to-end test in headless Chrome
```

Personal, non-commercial demo, in line with the RunAnywhere License.
