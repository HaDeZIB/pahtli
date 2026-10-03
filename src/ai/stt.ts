/**
 * Voz a texto on-device (Whisper vía transformers.js en un Web Worker) + grabación del micrófono.
 *
 * Particularidades de iOS Safari que se manejan aquí:
 *  - El AudioContext se crea y se reanuda DENTRO del gesto del usuario (antes de cualquier await).
 *  - Fallback a webkitAudioContext.
 *  - El micrófono en iOS suele ir a 48 kHz: se remuestrea a 16 kHz mono con OfflineAudioContext
 *    (con filtro anti-alias del navegador) y, si falla, con promedio por ventanas.
 *  - El estado "interrupted" (llamada entrante, Siri) se trata como "suspended".
 */
import type { DeviceTier } from '../types';
import { getCapabilities } from './capability';
import { STT_MODELS, sttModelFor, type SttModelKey } from './models';
import { cleanTranscript, normalizeGain, rms } from './transcript';

const TARGET_SR = 16000;

let worker: Worker | null = null;
let ready = false;
let loadedKey: SttModelKey | null = null;
let loadPromise: Promise<void> | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (t: string) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
let progressCb: ((p: number, msg: string) => void) | undefined;
let loadResolve: (() => void) | null = null;
let loadReject: ((e: Error) => void) | null = null;

/** Última latencia de transcripción (ms) y modelo, para mostrar "corre en tu dispositivo". */
export const sttStats: { model: string | null; lastMs: number | null; sizeMB: number | null } = { model: null, lastMs: null, sizeMB: null };

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./stt.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent) => {
    const m = e.data as { type: string; progress?: number; msg?: string; id?: number; text?: string; error?: string; ms?: number };
    if (m.type === 'progress') progressCb?.(m.progress ?? 0, m.msg ?? '');
    else if (m.type === 'ready') { ready = true; progressCb?.(1, 'Listo'); loadResolve?.(); loadResolve = loadReject = null; }
    else if (m.type === 'error') { loadReject?.(new Error(m.error || 'Error al cargar el modelo de voz')); loadResolve = loadReject = null; }
    else if (m.type === 'result' && m.id !== undefined) {
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      clearTimeout(p.timer);
      if (m.error) p.reject(new Error(m.error));
      else { sttStats.lastMs = m.ms ?? null; p.resolve(m.text ?? ''); }
    }
  };
  worker.onerror = (ev) => {
    const err = new Error(ev.message || 'El proceso de voz se detuvo');
    loadReject?.(err);
    loadResolve = loadReject = null;
    for (const [, p] of pending) { clearTimeout(p.timer); p.reject(err); }
    pending.clear();
    // El worker puede haber muerto por memoria: se recrea en el siguiente uso.
    worker?.terminate();
    worker = null;
    ready = false;
    loadPromise = null;
  };
  return worker;
}

export function sttReady(): boolean {
  return ready;
}

export async function loadSTT(tier: DeviceTier, onProgress?: (p: number, msg: string) => void): Promise<void> {
  if (tier === 'C') throw new Error('Este dispositivo no tiene voz disponible (nivel C)');
  progressCb = onProgress;
  const caps = await getCapabilities().catch(() => null);
  const key = sttModelFor(tier, caps?.deviceMemoryGB);
  if (ready && loadedKey === key) { onProgress?.(1, 'Listo'); return; }
  if (loadPromise) return loadPromise;
  const model = STT_MODELS[key];
  loadPromise = new Promise<void>((resolve, reject) => {
    loadResolve = resolve;
    loadReject = reject;
    onProgress?.(0, `Descargando ${model.label} (${model.sizeMB} MB)`);
    getWorker().postMessage({ type: 'load', repo: model.repo, dtype: model.dtype });
  }).then(() => {
    loadedKey = key;
    sttStats.model = model.label;
    sttStats.sizeMB = model.sizeMB;
  }).catch((e) => {
    loadPromise = null;
    throw e;
  });
  return loadPromise;
}

/** audio: Float32Array mono 16 kHz. Devuelve texto limpio ('' si es silencio). */
export async function transcribe(audio: Float32Array): Promise<string> {
  if (!audio || audio.length < TARGET_SR * 0.3) return '';
  if (rms(audio) < 0.004) return '';
  if (!ready) {
    if (loadPromise) await loadPromise;
    else throw new Error('El modelo de voz no está cargado');
  }
  const w = getWorker();
  const id = ++seq;
  const data = normalizeGain(audio).slice();
  const timeoutMs = 20000 + (data.length / TARGET_SR) * 3000;
  const text = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('La transcripción tardó demasiado'));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    w.postMessage({ type: 'transcribe', id, audio: data }, [data.buffer]);
  });
  return cleanTranscript(text);
}

// ─────────────────────────────────────────────────────────────────────────────
// Grabación
// ─────────────────────────────────────────────────────────────────────────────

type AC = typeof AudioContext;

function concat(chunks: Float32Array[]): Float32Array {
  const n = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Float32Array(n);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

/** Remuestreo por promedio de ventana (fallback sin OfflineAudioContext). */
export function resampleLinear(input: Float32Array, fromSr: number, toSr = TARGET_SR): Float32Array {
  if (fromSr === toSr) return input;
  const ratio = fromSr / toSr;
  const n = Math.floor(input.length / ratio);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let s = 0;
    for (let j = start; j < end; j++) s += input[j];
    out[i] = end > start ? s / (end - start) : input[start] ?? 0;
  }
  return out;
}

async function resample(input: Float32Array, fromSr: number): Promise<Float32Array> {
  if (fromSr === TARGET_SR || !input.length) return input;
  try {
    const OAC: typeof OfflineAudioContext | undefined =
      (globalThis as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext ??
      (globalThis as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    if (!OAC) throw new Error('no OAC');
    const len = Math.ceil((input.length * TARGET_SR) / fromSr);
    const off = new OAC(1, len, TARGET_SR);
    const buf = off.createBuffer(1, input.length, fromSr);
    buf.getChannelData(0).set(input);
    const src = off.createBufferSource();
    src.buffer = buf;
    src.connect(off.destination);
    src.start(0);
    const rendered = await off.startRendering();
    return rendered.getChannelData(0).slice();
  } catch {
    return resampleLinear(input, fromSr);
  }
}

/**
 * Empieza a grabar. Llamar directamente desde el manejador del toque (iOS exige el gesto
 * para crear/reanudar el AudioContext). stop() devuelve Float32Array mono 16 kHz.
 */
export async function recordAudio(): Promise<{ stop: () => Promise<Float32Array> }> {
  const Ctor: AC | undefined = (globalThis as { AudioContext?: AC }).AudioContext ?? (globalThis as { webkitAudioContext?: AC }).webkitAudioContext;
  if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
    const e = new Error('Micrófono no disponible en este navegador');
    e.name = 'NotSupportedError';
    throw e;
  }
  // 1) Sincrónico dentro del gesto: crear y reanudar el contexto.
  const ctx = new Ctor();
  const resumeP = ctx.state !== 'running' ? ctx.resume().catch(() => undefined) : Promise.resolve();

  // 2) Pedir el micrófono.
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (e) {
    void ctx.close().catch(() => undefined);
    throw e;
  }
  // resume() puede quedarse colgado sin salida de audio (p.ej. otro app tiene el audio): no bloquear la UI.
  const settle = (p: Promise<unknown>) => Promise.race([p, new Promise((r) => setTimeout(r, 1500))]);
  await settle(resumeP);
  if ((ctx.state as string) !== 'running') await settle(ctx.resume().catch(() => undefined));

  const source = ctx.createMediaStreamSource(stream);
  const chunks: Float32Array[] = [];
  // ScriptProcessorNode: obsoleto pero universal (incluido iOS) y sin archivo extra de worklet.
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  proc.onaudioprocess = (ev) => { chunks.push(new Float32Array(ev.inputBuffer.getChannelData(0))); };
  const mute = ctx.createGain();
  mute.gain.value = 0;
  source.connect(proc);
  proc.connect(mute);
  mute.connect(ctx.destination); // Safari solo procesa si el grafo llega a destination

  const onState = () => { if ((ctx.state as string) === 'interrupted' || ctx.state === 'suspended') void ctx.resume().catch(() => undefined); };
  ctx.addEventListener('statechange', onState);

  let stopped = false;
  return {
    stop: async () => {
      if (stopped) return new Float32Array(0);
      stopped = true;
      ctx.removeEventListener('statechange', onState);
      try { source.disconnect(); proc.disconnect(); mute.disconnect(); } catch { /* ignore */ }
      proc.onaudioprocess = null;
      stream.getTracks().forEach((t) => t.stop());
      const sr = ctx.sampleRate;
      void ctx.close().catch(() => undefined);
      return resample(concat(chunks), sr);
    },
  };
}
