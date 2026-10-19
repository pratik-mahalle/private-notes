import { RunAnywhere } from '@runanywhere/web';
import { requestPersistentStorage } from '@runanywhere/web/browser';
import { InferenceFramework, ModelCategory, ModelFormat } from '@runanywhere/proto-ts/model_types';
import { withRetry } from './retry';
import { NOTES_SYSTEM_PROMPT } from './notes';

export const MODELS = [
  {
    id: 'sherpa-onnx-whisper-tiny.en',
    name: 'Whisper tiny.en',
    framework: InferenceFramework.INFERENCE_FRAMEWORK_SHERPA,
    category: ModelCategory.MODEL_CATEGORY_SPEECH_RECOGNITION,
    format: ModelFormat.MODEL_FORMAT_ONNX,
    url: 'https://huggingface.co/runanywhere/sherpa-onnx-whisper-tiny.en/resolve/main/sherpa-onnx-whisper-tiny.en.tar.gz',
    archive: 'tarGz',
    sizeBytes: 152_777_070,
    memoryRequiredBytes: 180_000_000,
  },
  {
    id: 'qwen3.5-0.8b-q4_k_m',
    name: 'Qwen3.5 0.8B',
    framework: InferenceFramework.INFERENCE_FRAMEWORK_LLAMA_CPP,
    category: ModelCategory.MODEL_CATEGORY_LANGUAGE,
    format: ModelFormat.MODEL_FORMAT_GGUF,
    url: 'https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF/resolve/main/Qwen3.5-0.8B-Q4_K_M.gguf',
    sizeBytes: 532_517_120,
    memoryRequiredBytes: 900_000_000,
    contextLength: 4096,
    supportsThinking: false,
  },
] as const;

export async function initSdk(): Promise<void> {
  await RunAnywhere.initialize({ environment: 'development' });
  const { LlamaCPP } = await import('@runanywhere/web-llamacpp');
  await LlamaCPP.register({ acceleration: 'auto', requireBackendWorker: true, preferBackendWorker: true });
  const { ONNX } = await import('@runanywhere/web-onnx');
  await ONNX.register({ acceleration: 'auto', threads: 2, requireBackendWorker: true, preferBackendWorker: true });
  for (const m of MODELS) RunAnywhere.models.register(m);
  await RunAnywhere.storage.refresh(); // without this, cached models re-download
  void requestPersistentStorage().catch(() => {});
}

export async function ensureModels(onProgress: (doneBytes: number, totalBytes: number) => void): Promise<void> {
  const missing = MODELS.filter((m) => !RunAnywhere.models.get(m.id)?.localPath);
  const totalBytes = missing.reduce((s, m) => s + m.sizeBytes, 0);
  let finished = 0; // bytes of fully downloaded models
  onProgress(0, totalBytes);
  for (const m of missing) {
    await withRetry(async () => {
      for await (const ev of RunAnywhere.models.download(m.id)) {
        if (ev.type === 'failed') throw new Error(`download failed: ${m.id}`);
        if (ev.type === 'progress') onProgress(finished + Math.min(ev.bytesDone, m.sizeBytes), totalBytes);
      }
    });
    finished += m.sizeBytes;
    onProgress(finished, totalBytes);
  }
  for (const m of MODELS) await RunAnywhere.models.load(m.id);
}

export async function transcribeChunk(chunk: Float32Array, sampleRate: number): Promise<string> {
  return (await RunAnywhere.stt.transcribe(RunAnywhere.AudioInput.float32(chunk, sampleRate, 1))).text;
}

export async function writeNotes(transcript: string): Promise<string> {
  const res = await RunAnywhere.llm.generate(`Transcript:\n${transcript}`, {
    systemPrompt: NOTES_SYSTEM_PROMPT, maxOutputTokens: 512, temperature: 0.2, reasoning: { mode: 'off' },
  });
  return res.text;
}
