/**
 * Worker de voz a texto: transformers.js + Whisper (ONNX, WASM).
 * Siempre WASM (no WebGPU): deja la GPU libre para el LLM y evita la fuga de memoria
 * GPU de Whisper en transformers.js 4.x (huggingface/transformers.js#1739).
 * Los pesos y el runtime wasm quedan en Cache Storage ("transformers-cache") -> offline.
 */
import { pipeline, env } from '@huggingface/transformers';
// Runtime ONNX servido desde nuestro propio origen (precacheado por el service worker):
// no depende de cdn.jsdelivr.net y funciona en modo avión desde la primera instalación.
import ortAsyncifyWasm from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url';
import ortAsyncifyMjs from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url';

env.allowLocalModels = false;
env.useBrowserCache = true;
try {
  const wasm = (env.backends.onnx as { wasm?: { wasmPaths?: unknown } }).wasm;
  const def = wasm?.wasmPaths as { wasm?: string } | undefined;
  // transformers.js elige la variante "asyncify" salvo en Safari < 26 sin WebGPU (ahí deja la del CDN).
  if (wasm && (!def || String(def.wasm ?? '').includes('.asyncify.'))) {
    wasm.wasmPaths = { wasm: new URL(ortAsyncifyWasm, self.location.href).href, mjs: new URL(ortAsyncifyMjs, self.location.href).href };
  }
} catch { /* se queda con el valor por defecto */ }

type InMsg =
  | { type: 'load'; repo: string; dtype: Record<string, string> }
  | { type: 'transcribe'; id: number; audio: Float32Array };

type Asr = (audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text: string } | { text: string }[]>;

let asr: Asr | null = null;
let loadedRepo = '';
let loading: Promise<void> | null = null;

const post = (m: unknown) => (self as unknown as { postMessage(m: unknown): void }).postMessage(m);

async function load(repo: string, dtype: Record<string, string>) {
  if (asr && loadedRepo === repo) return;
  let lastPct = -1;
  const p = await pipeline('automatic-speech-recognition', repo, {
    device: 'wasm',
    dtype: dtype as never,
    progress_callback: (info: { status: string; progress?: number; file?: string }) => {
      if (info.status === 'progress_total' && typeof info.progress === 'number') {
        const pct = Math.floor(info.progress);
        if (pct !== lastPct) { lastPct = pct; post({ type: 'progress', progress: Math.min(0.97, info.progress / 100), msg: 'Descargando modelo de voz' }); }
      } else if (info.status === 'initiate' && info.file) {
        post({ type: 'progress', progress: Math.max(0, lastPct / 100), msg: `Preparando ${info.file.split('/').pop()}` });
      }
    },
  });
  asr = p as unknown as Asr;
  loadedRepo = repo;
  post({ type: 'progress', progress: 0.98, msg: 'Calentando el modelo de voz' });
  // Calentamiento: compila kernels wasm para que la primera transcripción real sea rápida.
  try { await asr(new Float32Array(16000), { language: 'spanish', task: 'transcribe', max_new_tokens: 2 }); } catch { /* ignore */ }
}

self.onmessage = async (e: MessageEvent<InMsg>) => {
  const m = e.data;
  if (m.type === 'load') {
    try {
      loading = loading ?? load(m.repo, m.dtype);
      await loading;
      post({ type: 'ready', repo: m.repo });
    } catch (err) {
      loading = null;
      post({ type: 'error', error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }
  if (m.type === 'transcribe') {
    try {
      if (loading) await loading;
      if (!asr) throw new Error('Modelo de voz no cargado');
      const t0 = performance.now();
      const long = m.audio.length > 30 * 16000;
      const out = await asr(m.audio, {
        language: 'spanish',
        task: 'transcribe',
        // Evita bucles de repetición (medido: whisper-tiny entra en bucle con voces sintéticas)
        no_repeat_ngram_size: 4,
        max_new_tokens: 128,
        ...(long ? { chunk_length_s: 30, stride_length_s: 5 } : {}),
      });
      const text = Array.isArray(out) ? out.map((o) => o.text).join(' ') : out.text;
      post({ type: 'result', id: m.id, text, ms: Math.round(performance.now() - t0) });
    } catch (err) {
      post({ type: 'result', id: m.id, error: err instanceof Error ? err.message : String(err) });
    }
  }
};
