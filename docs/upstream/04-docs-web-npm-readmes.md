# Docs: web package READMEs on npm have broken links, an old pinned version and flat-API examples

**Type:** pull request (docs only)
**Versions checked:** `RunanywhereAI/runanywhere-sdks` main at 259521e299bb28292c8d150b18fc17964f1dcd14 (package version 0.20.37 on main); published READMEs of `@runanywhere/web`, `web-llamacpp`, `web-onnx` 0.20.27 (latest published, 2026-10-19). Files: `bindings/web/packages/{core,llamacpp,onnx}/README.md`, `bindings/web/README.md`.

## What happened
1. Links to `../../README.md` resolve on GitHub but 404 on npmjs.com.
2. Install lines pin `@0.20.11`; the latest published version is 0.20.27.
3. Examples use the flat verbs (`RunAnywhere.generateStream({ prompt })` with `.stream`, `RunAnywhere.transcribe(samples, { sampleRate })`, `RunAnywhere.speak(text)`), introduced as "the flat public facade". In `Deprecated.ts` the flat `generateStream` is marked deprecated and returns an async iterable directly, so `generation.stream` as written does not match; `RunAnywhere.llm.generateStream`, `RunAnywhere.stt.transcribe` and `RunAnywhere.tts.speak` are the current form.

## Proposed diff
Generated with `diff -u` against main at 259521e299bb28292c8d150b18fc17964f1dcd14; applies with `patch -p1`. The `maxOutputTokens` and `AudioInput.float32` forms match what I use in a working app on 0.20.27; `RunAnywhere.tts.speak` exists in 0.20.27 and on main but I have not run it.

```diff
--- a/bindings/web/README.md
+++ b/bindings/web/README.md
@@ -54,18 +54,16 @@
-After registering backends and loading models through the core lifecycle API, use the flat public facade:
+After registering backends and loading models through the core lifecycle API, use the namespaced public API:
 
 ```ts
-const generation = await RunAnywhere.generateStream({
-  prompt: 'Explain why on-device inference improves privacy.',
-  maxTokens: 128,
-});
-
-for await (const token of generation.stream) {
-  renderToken(token);
+for await (const event of RunAnywhere.llm.generateStream(
+  'Explain why on-device inference improves privacy.',
+  { maxOutputTokens: 128 },
+)) {
+  renderEvent(event);
 }
 
-const transcript = await RunAnywhere.transcribe(audioSamples, {
-  sampleRate: 16_000,
-});
+const transcript = await RunAnywhere.stt.transcribe(
+  RunAnywhere.AudioInput.float32(audioSamples, 16_000, 1),
+);
 
-await RunAnywhere.speak('This audio was synthesized locally.');
+await RunAnywhere.tts.speak('This audio was synthesized locally.');
 ```
--- a/bindings/web/packages/core/README.md
+++ b/bindings/web/packages/core/README.md
@@ -7,10 +7,10 @@
 ## Installation
 
 ```bash
-npm install @runanywhere/web@0.20.11
+npm install @runanywhere/web
 ```
 
-Add `@runanywhere/web-llamacpp` and/or `@runanywhere/web-onnx` for inference backends. See the [Web SDK README](../../README.md) for COOP/COEP headers, Vite config, and bundler setup.
+Add `@runanywhere/web-llamacpp` and/or `@runanywhere/web-onnx` for inference backends. See the [Web SDK README](https://github.com/RunanywhereAI/runanywhere-sdks/blob/main/bindings/web/README.md) for COOP/COEP headers, Vite config, and bundler setup.
 
 ---
 
@@ -24,13 +24,13 @@
 });
 ```
 
-Register backends, then call `RunAnywhere.completeServicesInitialization()`. See the [Web SDK README](../../README.md) for full initialization and inference examples.
+Register backends, then call `RunAnywhere.completeServicesInitialization()`. See the [Web SDK README](https://github.com/RunanywhereAI/runanywhere-sdks/blob/main/bindings/web/README.md) for full initialization and inference examples.
 
 ---
 
 ## Support
 
-- [Web SDK documentation](../../README.md)
+- [Web SDK documentation](https://github.com/RunanywhereAI/runanywhere-sdks/blob/main/bindings/web/README.md)
 - [Discord](https://discord.gg/N359FBbDVd)
 - [founders@runanywhere.ai](mailto:founders@runanywhere.ai)
 
--- a/bindings/web/packages/llamacpp/README.md
+++ b/bindings/web/packages/llamacpp/README.md
@@ -7,10 +7,10 @@
 ## Installation
 
 ```bash
-npm install @runanywhere/web@0.20.11 @runanywhere/web-llamacpp@0.20.11
+npm install @runanywhere/web @runanywhere/web-llamacpp
 ```
 
-See the [Web SDK README](../../README.md) for bundler configuration and cross-origin isolation headers.
+See the [Web SDK README](https://github.com/RunanywhereAI/runanywhere-sdks/blob/main/bindings/web/README.md) for bundler configuration and cross-origin isolation headers.
 
 ---
 
@@ -26,22 +26,20 @@
 await LlamaCPP.register({ acceleration: 'auto' });
 await RunAnywhere.completeServicesInitialization();
 
-const stream = await RunAnywhere.generateStream({
-  prompt: 'Write a haiku about local AI.',
-  maxTokens: 64,
-});
-for await (const token of stream.stream) {
-  renderToken(token);
+for await (const event of RunAnywhere.llm.generateStream('Write a haiku about local AI.', {
+  maxOutputTokens: 64,
+})) {
+  renderEvent(event);
 }
 ```
 
-See the [Web SDK README](../../README.md) for model lifecycle and Vite setup.
+See the [Web SDK README](https://github.com/RunanywhereAI/runanywhere-sdks/blob/main/bindings/web/README.md) for model lifecycle and Vite setup.
 
 ---
 
 ## Support
 
-- [Web SDK documentation](../../README.md)
+- [Web SDK documentation](https://github.com/RunanywhereAI/runanywhere-sdks/blob/main/bindings/web/README.md)
 - [Discord](https://discord.gg/N359FBbDVd)
 - [founders@runanywhere.ai](mailto:founders@runanywhere.ai)
 
--- a/bindings/web/packages/onnx/README.md
+++ b/bindings/web/packages/onnx/README.md
@@ -7,10 +7,10 @@
 ## Installation
 
 ```bash
-npm install @runanywhere/web@0.20.11 @runanywhere/web-onnx@0.20.11
+npm install @runanywhere/web @runanywhere/web-onnx
 ```
 
-See the [Web SDK README](../../README.md) for bundler configuration and cross-origin isolation headers.
+See the [Web SDK README](https://github.com/RunanywhereAI/runanywhere-sdks/blob/main/bindings/web/README.md) for bundler configuration and cross-origin isolation headers.
 
 ---
 
@@ -26,18 +26,18 @@
 await ONNX.register();
 await RunAnywhere.completeServicesInitialization();
 
-const transcript = await RunAnywhere.transcribe(audioSamples, {
-  sampleRate: 16_000,
-});
+const transcript = await RunAnywhere.stt.transcribe(
+  RunAnywhere.AudioInput.float32(audioSamples, 16_000, 1),
+);
 ```
 
-See the [Web SDK README](../../README.md) for model lifecycle and Vite setup.
+See the [Web SDK README](https://github.com/RunanywhereAI/runanywhere-sdks/blob/main/bindings/web/README.md) for model lifecycle and Vite setup.
 
 ---
 
 ## Support
 
-- [Web SDK documentation](../../README.md)
+- [Web SDK documentation](https://github.com/RunanywhereAI/runanywhere-sdks/blob/main/bindings/web/README.md)
 - [Discord](https://discord.gg/N359FBbDVd)
 - [founders@runanywhere.ai](mailto:founders@runanywhere.ai)
 
```

## Suggested fix
As above: absolute GitHub link, unpinned install, namespaced examples and lead-in.
