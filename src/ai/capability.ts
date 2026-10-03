/**
 * Detección del nivel del dispositivo (A/B/C). Nunca lanza excepción.
 *
 *  A — WebGPU con límites suficientes para WebLLM (maxBufferSize >= 256 MB y
 *      maxStorageBufferBindingSize >= 128 MB, los mínimos que exige web-llm 0.2.x) y,
 *      donde el navegador lo expone, >= 4 GB de RAM. Whisper (WASM) + LLM (WebGPU).
 *      iOS no expone deviceMemory: un iPhone con WebGPU (Safari 26+) y esos límites cuenta como A.
 *  B — Sin WebGPU utilizable pero con WASM y micrófono: solo Whisper (WASM), sin LLM.
 *  C — Sin micrófono / sin WASM / RAM muy baja: botones + texto + extractor por keywords.
 *
 * El triaje funciona igual en los 3 niveles: la decisión vive en las reglas, no en el modelo.
 */
import type { DeviceTier } from '../types';
import { STT_MODELS, sttModelFor, llmModelFor } from './models';

export interface Capabilities {
  tier: DeviceTier;
  isIOS: boolean;
  isAndroid: boolean;
  secure: boolean;
  hasMic: boolean;
  hasWasm: boolean;
  wasmThreads: boolean;
  webgpu: boolean;
  shaderF16: boolean;
  maxBufferMB?: number;
  maxStorageBindingMB?: number;
  /** GB, solo Chrome/Android (redondeado y topado en 8 por el navegador) */
  deviceMemoryGB?: number;
  cores?: number;
  reason: string;
}

const MB = 1024 * 1024;
let cached: Promise<Capabilities> | null = null;
/** Último resultado resuelto (para funciones síncronas como tierInfo). */
export let lastCaps: Capabilities | null = null;

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const id = setTimeout(() => resolve(fallback), ms);
    p.then((v) => { clearTimeout(id); resolve(v); }, () => { clearTimeout(id); resolve(fallback); });
  });
}

async function probe(): Promise<Capabilities> {
  type Nav = {
    userAgent?: string; platform?: string; maxTouchPoints?: number; deviceMemory?: number; hardwareConcurrency?: number;
    mediaDevices?: { getUserMedia?: unknown };
    gpu?: { requestAdapter: (o?: unknown) => Promise<unknown> };
  };
  const nav: Nav | undefined = typeof navigator !== 'undefined' ? (navigator as unknown as Nav) : undefined;
  const ua = nav?.userAgent ?? '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (nav?.platform === 'MacIntel' && (nav?.maxTouchPoints ?? 0) > 1);
  const isAndroid = /Android/i.test(ua);
  const secure = typeof isSecureContext !== 'undefined' ? isSecureContext : false;
  const hasMic = !!nav?.mediaDevices?.getUserMedia && secure;
  const hasWasm = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
  const wasmThreads = typeof SharedArrayBuffer !== 'undefined' && (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated === true;
  const deviceMemoryGB = typeof nav?.deviceMemory === 'number' ? nav.deviceMemory : undefined;
  const cores = nav?.hardwareConcurrency || undefined;

  let webgpu = false;
  let shaderF16 = false;
  let maxBufferMB: number | undefined;
  let maxStorageBindingMB: number | undefined;
  try {
    if (nav?.gpu) {
      type Adapter = { limits: { maxBufferSize: number; maxStorageBufferBindingSize: number }; features: { has(f: string): boolean } };
      const adapter = (await withTimeout(nav.gpu.requestAdapter({ powerPreference: 'high-performance' }), 4000, null)) as Adapter | null;
      if (adapter) {
        webgpu = true;
        shaderF16 = !!adapter.features?.has?.('shader-f16');
        maxBufferMB = Math.round(adapter.limits.maxBufferSize / MB);
        maxStorageBindingMB = Math.round(adapter.limits.maxStorageBufferBindingSize / MB);
      }
    }
  } catch { /* sin WebGPU */ }

  const base = { isIOS, isAndroid, secure, hasMic, hasWasm, wasmThreads, webgpu, shaderF16, maxBufferMB, maxStorageBindingMB, deviceMemoryGB, cores };

  if (!hasWasm) return { ...base, tier: 'C', reason: 'Navegador sin WebAssembly' };
  if (!hasMic) return { ...base, tier: 'C', reason: secure ? 'Sin micrófono disponible' : 'Se necesita HTTPS para el micrófono' };
  if (deviceMemoryGB !== undefined && deviceMemoryGB < 2) return { ...base, tier: 'C', reason: `RAM baja (${deviceMemoryGB} GB)` };

  const gpuOk = webgpu && (maxBufferMB ?? 0) >= 256 && (maxStorageBindingMB ?? 0) >= 128;
  const ramOk = deviceMemoryGB === undefined ? isIOS || !isAndroid : deviceMemoryGB >= 4;
  if (gpuOk && ramOk) return { ...base, tier: 'A', reason: 'WebGPU disponible' };
  if (gpuOk && !ramOk) return { ...base, tier: 'B', reason: `WebGPU pero RAM ${deviceMemoryGB ?? '?'} GB` };
  return { ...base, tier: 'B', reason: webgpu ? 'WebGPU con límites insuficientes' : 'Sin WebGPU (solo WASM)' };
}

/** Capacidades detalladas (cacheadas). Nunca lanza. */
export function getCapabilities(): Promise<Capabilities> {
  if (!cached) {
    cached = probe().then((c) => { lastCaps = c; return c; }).catch((e) => ({
      tier: 'C' as DeviceTier, isIOS: false, isAndroid: false, secure: false, hasMic: false, hasWasm: false,
      wasmThreads: false, webgpu: false, shaderF16: false, reason: `Error al detectar: ${String(e)}`,
    }));
  }
  return cached;
}

export async function detectTier(): Promise<DeviceTier> {
  try {
    return (await getCapabilities()).tier;
  } catch {
    return 'C';
  }
}

/** Para la pantalla de configuración. */
export function tierInfo(t: DeviceTier): { label: string; stt: string; llm: string | null } {
  switch (t) {
    case 'A': {
      const s = STT_MODELS[sttModelFor('A', lastCaps?.deviceMemoryGB)];
      const l = llmModelFor(lastCaps?.shaderF16 ?? true);
      return { label: 'A — Completo (voz + IA de lenguaje)', stt: `${s.label} · ${s.sizeMB} MB`, llm: `${l.label} · ${l.sizeMB} MB` };
    }
    case 'B': {
      const s = STT_MODELS[sttModelFor('B', lastCaps?.deviceMemoryGB)];
      return { label: 'B — Ligero (voz, sin IA de lenguaje)', stt: `${s.label} · ${s.sizeMB} MB`, llm: null };
    }
    default:
      return { label: 'C — Mínimo (botones y texto)', stt: 'Sin voz (escriba o use botones)', llm: null };
  }
}
