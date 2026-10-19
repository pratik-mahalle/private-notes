# Web: model download occasionally fails near completion with a generic code 153 ("download failed")

**Type:** GitHub issue
**Versions checked:** Checked against `@runanywhere/web` 0.20.27 (latest published, 2026-10-19), Chrome desktop with WebGPU, development environment.
**Checked main 259521e (0.20.37): still present** — the `failed` event still spreads the commons `progress.error` (`bindings/web/packages/core/src/Public/API/Namespaces/models.ts:319-338`), which carries code 153 (`ERROR_CODE_DOWNLOAD_FAILED`, `idl/errors.proto:89`) and no HTTP status or cause. Already answered on both 0.20.27 and main: the event sets `error.retryable: true` for transfer failures (`DOWNLOAD_TRANSFER_FAILURE_RETRYABLE`, `Public/SDKCore.ts:847`), so I dropped the retryable-codes ask. Not re-run on main.

## What happened
While downloading models (Whisper tiny.en tar.gz, about 153 MB, and a Qwen3.5 0.8B GGUF, about 532 MB) via `RunAnywhere.models.download(id)`, the stream occasionally ends with a `failed` event, code 153, message "download failed", close to 100%. It is intermittent, and a retry succeeds. There is no detail about the cause (network, HTTP status, storage quota, integrity check).

## Minimal repro
Intermittent, so no deterministic repro. The loop below is what the app runs (`src/sdk.ts`):
```ts
for await (const ev of RunAnywhere.models.download('sherpa-onnx-whisper-tiny.en')) {
  if (ev.type === 'failed') console.log(ev); // code 153, "download failed"
}
```

## Expected
A `failed` event that carries some detail (underlying error or HTTP status). (The event already says `retryable: true`, which is what my retry loop needed.)

## Suggested fix
Include the underlying cause in the failed event's message or a `details` field.
