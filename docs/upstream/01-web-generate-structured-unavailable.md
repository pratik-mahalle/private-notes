# Web: `llm.generateStructured` always throws when the LLM runs in the BackendWorker (it calls the sync `parse()`, not `parseAsync()`)

**Type:** GitHub issue
**Versions checked:** Checked against `@runanywhere/web` 0.20.27 (latest published, 2026-10-19), Chrome desktop with WebGPU, development environment.
**Checked main 259521e (0.20.37): still present** — `llm.generateStructured` still calls the synchronous `adapter.parse(...)` (`bindings/web/packages/core/src/Public/API/Namespaces/llm.ts:320`), which still throws for BackendWorker-owned models (`Adapters/StructuredOutputProtoAdapter.ts:39-44`); `parseAsync()` (same file, lines 63-72) is still unused by it. Not re-run on main.

## What happened
The JSDoc for `llm.generateStructured` already says that `'constrained'` fails preflight on web (no grammar-constrained decoding hook) and that the call throws when the backend cannot parse structured output. That is not what I am reporting.

With the LLM registered to run in the BackendWorker (`LlamaCPP.register({ requireBackendWorker: true, ... })`, which is how my app runs Qwen3.5 0.8B on WebGPU), `'repair'` and `'validationOnly'` also always throw `Backend not available for: structuredOutput.parse`. The published WASM does export the parse primitive (`_rac_structured_output_parse_proto` is in `racommons.js` 0.20.27), and `StructuredOutputProtoAdapter.parseAsync()` can route `structured.parse` to the worker. But `generateStructured` calls the synchronous `parse()`, which refuses BackendWorker-owned models ("Structured-output parse against a BackendWorker-owned model requires parseAsync()"). So in the worker setup, `generateStructured` is unavailable in every mode. The SDK's own runtime summary says as much: `structured: { ..., note: 'Use parseAsync under BackendWorker' }` (`Foundation/RuntimeConfig.ts:310` on main).

I have not tried a main-thread LLM, where the sync path may work.

## Minimal repro
```ts
import { RunAnywhere } from '@runanywhere/web';
import { LlamaCPP } from '@runanywhere/web-llamacpp';
await RunAnywhere.initialize({ environment: 'development' });
await LlamaCPP.register({ acceleration: 'auto', requireBackendWorker: true, preferBackendWorker: true });
// register, download and load qwen3.5-0.8b-q4_k_m (see the app's src/sdk.ts)
const schema = { json: JSON.stringify({ type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] }) };
for (const mode of ['repair', 'validationOnly'] as const) {
  try {
    await RunAnywhere.llm.generateStructured('Summarise: we ship Monday.', schema, mode);
  } catch (e) { console.log(mode, String(e)); }
}
```

## Observed
- `repair` and `validationOnly`: `Backend not available for: structuredOutput.parse` (after the full generation has run).

## Expected
`generateStructured` works with a BackendWorker-owned LLM, since the worker can parse.

## Suggested fix
In `llm.generateStructured`, call `await adapter.parseAsync(...)` instead of `adapter.parse(...)`; `parseAsync` already falls back to the sync path when no worker owns the model. Until then, a line in the web README that structured output needs a main-thread LLM would save others the detour. In my app I prompt for JSON and parse the reply myself.
