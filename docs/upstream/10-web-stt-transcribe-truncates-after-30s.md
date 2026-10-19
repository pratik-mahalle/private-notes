# Web: `stt.transcribe` silently drops audio after about 30 s (Whisper tiny.en)

**Type:** GitHub issue
**Versions checked:** Checked against `@runanywhere/web` 0.20.27 (latest published, 2026-10-19), Chrome desktop with WebGPU, development environment.
**Checked main 259521e (0.20.37): appears still present (from reading the code, not re-run)** — `stt.transcribe` passes the whole buffer to `transcribeLifecycle` (`bindings/web/packages/core/src/Public/API/Namespaces/stt.ts:273-286`), and the Sherpa backend decodes it as one offline Whisper stream with no windowing (`engines/sherpa/sherpa_backend.cpp:1051-1062`).

## What happened
`RunAnywhere.stt.transcribe` on a clip longer than about 30 s with `sherpa-onnx-whisper-tiny.en` returns text for roughly the first 30 s and nothing for the rest. No warning or error.

## Minimal repro
```ts
const pcm: Float32Array = /* 16 kHz mono samples, e.g. 60 s of speech */;
const { text } = await RunAnywhere.stt.transcribe(RunAnywhere.AudioInput.float32(pcm, 16000, 1));
console.log(text); // covers only about the first 30 s
```

## Expected
Either the full transcript (internal windowing) or an error/warning stating the 30 s limit. The app works around it by cutting at the quietest 100 ms frame between 20 s and 28 s (`src/audio.ts`).

## Suggested fix
Chunk internally, or surface a `truncated`/warning flag and mention the window in the STT docs.
