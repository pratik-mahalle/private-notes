# Web: `reasoning: { mode: 'off' }` does not stop Qwen3.5 from emitting only thinking text

**Type:** GitHub issue
**Versions checked:** Checked against `@runanywhere/web` 0.20.27 (latest published, 2026-10-19), Chrome desktop with WebGPU, development environment.
**Checked main 259521e (0.20.37): appears still present (from reading the code, not re-run)** — for llama.cpp, `reasoning: { mode: 'off' }` still only prepends the Qwen `/no_think` soft directive (`core/src/features/llm/llm_thinking_directive_internal.h:67-73`); only QHexRT is treated as suppressing thinking natively (line 36), and its comment notes Qwen3.5 needs a "hard switch" (line 27). `engines/llamacpp/llamacpp_backend.cpp` has no `enable_thinking` chat-template switch.

## What happened
With Qwen3.5-2B (always) and Qwen3.5-0.8B (on longer prompts), `llm.generate(..., { reasoning: { mode: 'off' } })` returned only thinking text and no answer. Registering the model with `supportsThinking: false` fixes it.

## Minimal repro
```ts
RunAnywhere.models.register({
  id: 'qwen3.5-2b-q4_k_m', name: 'Qwen3.5 2B',
  framework: InferenceFramework.INFERENCE_FRAMEWORK_LLAMA_CPP,
  category: ModelCategory.MODEL_CATEGORY_LANGUAGE, format: ModelFormat.MODEL_FORMAT_GGUF,
  url: 'https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf',
  contextLength: 4096, supportsThinking: true, // true (or omitted) triggers it
});
// download + load, then:
const out = await RunAnywhere.llm.generate(`Transcript:\n${longTranscript}`, {
  maxOutputTokens: 512, temperature: 0.2, reasoning: { mode: 'off' },
});
console.log(out.text); // thinking text only
```

## Observed
Only thinking text in `out.text`.

## Expected
`reasoning: { mode: 'off' }` suppresses thinking regardless of the registration flag, or the docs say that `supportsThinking: false` is needed for models that think by default.

## Suggested fix
Honor `mode: 'off'` for models registered with `supportsThinking: true` (for example by applying the chat template's no-think switch), or document the workaround.
