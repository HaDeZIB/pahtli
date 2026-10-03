/**
 * LLM pequeño on-device (WebLLM / MLC sobre WebGPU) en un Web Worker.
 * Solo EXTRAE hallazgos con salida JSON restringida por esquema; nunca decide el nivel final.
 * Si algo falla (sin WebGPU, sin memoria, timeout) devuelve false/null y la app sigue con keywords.
 */
import type { DeviceTier, Findings, TriageLevel } from '../types';
import { getCapabilities } from './capability';
import { llmModelFor, type LlmModel } from './models';
import { EXTRACTION_SCHEMA, FEW_SHOT, PARAPHRASE_FEW_SHOT, PARAPHRASE_SYSTEM, SYSTEM_PROMPT, mapParaphrase, parseLLMOutput } from './prompt';

/**
 * 'paraphrase' (por defecto): el LLM reescribe síntomas presentes en español estándar y keywords los mapea.
 * 'json': el LLM llena el esquema JSON con el catálogo completo (medido: peor con modelos <=1B, ver docs/ai.md).
 */
export type LlmMode = 'paraphrase' | 'json';
function currentMode(): LlmMode {
  try { return localStorage.getItem('pahtli:llm_mode') === 'json' ? 'json' : 'paraphrase'; } catch { return 'paraphrase'; }
}

type Engine = {
  chat: { completions: { create: (req: Record<string, unknown>) => Promise<{ choices: { message: { content: string | null }; finish_reason?: string }[]; usage?: { prompt_tokens?: number; completion_tokens?: number; extra?: Record<string, number> } }> } };
  interruptGenerate: () => void;
  resetChat?: () => Promise<void>;
  unload?: () => Promise<void>;
};

let engine: Engine | null = null;
let worker: Worker | null = null;
let ready = false;
let loading: Promise<boolean> | null = null;
let busy: Promise<unknown> = Promise.resolve();

export const llmStats: {
  model: string | null; sizeMB: number | null; loadMs: number | null;
  lastMs: number | null; promptTokens: number | null; completionTokens: number | null;
  prefillTps: number | null; decodeTps: number | null; lastError: string | null; lastRaw: string | null;
} = { model: null, sizeMB: null, loadMs: null, lastMs: null, promptTokens: null, completionTokens: null, prefillTps: null, decodeTps: null, lastError: null, lastRaw: null };

export function llmReady(): boolean {
  return ready;
}

/** Tiempo máximo para una extracción (prefill + decode). Después se interrumpe y se usa solo keywords. */
export const LLM_TIMEOUT_MS = 25000;

export async function loadLLM(tier: DeviceTier, onProgress?: (p: number, msg: string) => void): Promise<boolean> {
  if (ready) { onProgress?.(1, 'Listo'); return true; }
  if (tier !== 'A') return false;
  if (loading) return loading;
  loading = (async () => {
    const caps = await getCapabilities().catch(() => null);
    if (!caps?.webgpu) return false;
    const model: LlmModel = llmModelFor(caps.shaderF16);
    const t0 = performance.now();
    try {
      const webllm = await import('@mlc-ai/web-llm');
      const base = webllm.prebuiltAppConfig.model_list.find((m) => m.model_id === model.id);
      if (!base) throw new Error(`Modelo ${model.id} no está en prebuiltAppConfig`);
      // Gemma trae sliding_window_size: web-llm exige que solo uno de los dos sea positivo.
      const sliding = /gemma/i.test(model.id);
      const ctxOverride = sliding ? { context_window_size: 4096, sliding_window_size: -1 } : { context_window_size: 2048 };
      const appConfig = {
        ...webllm.prebuiltAppConfig,
        model_list: [{ ...base, overrides: { ...(base.overrides ?? {}), ...ctxOverride } }],
      };
      worker = new Worker(new URL('./llm.worker.ts', import.meta.url), { type: 'module' });
      onProgress?.(0, `Descargando ${model.label} (${model.sizeMB} MB)`);
      const eng = await webllm.CreateWebWorkerMLCEngine(worker, model.id, {
        appConfig,
        initProgressCallback: (r: { progress: number; text: string }) => {
          onProgress?.(Math.min(0.99, r.progress), r.text.includes('Fetching') || r.text.includes('Loading') ? 'Descargando modelo de lenguaje' : 'Preparando modelo de lenguaje');
        },
      }, ctxOverride);
      engine = eng as unknown as Engine;
      // Calentamiento (compila shaders): una petición mínima con el mismo esquema.
      await runExtraction('niño con tos', 90000, 8).catch(() => null);
      ready = true;
      llmStats.model = model.label;
      llmStats.sizeMB = model.sizeMB;
      llmStats.loadMs = Math.round(performance.now() - t0);
      llmStats.lastError = null;
      onProgress?.(1, 'Listo');
      return true;
    } catch (e) {
      llmStats.lastError = e instanceof Error ? e.message : String(e);
      console.warn('[llm] no se pudo cargar', e);
      try { worker?.terminate(); } catch { /* ignore */ }
      worker = null;
      engine = null;
      ready = false;
      return false;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

async function runExtraction(text: string, timeoutMs: number, maxTokens = 220, mode: LlmMode = currentMode()): Promise<string | null> {
  if (!engine) return null;
  const eng = engine;
  const t0 = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      timedOut = true;
      try { eng.interruptGenerate(); } catch { /* ignore */ }
      resolve(null);
    }, timeoutMs);
  });
  const json = mode === 'json';
  const messages: { role: string; content: string }[] = [{ role: 'system', content: json ? SYSTEM_PROMPT : PARAPHRASE_SYSTEM }];
  for (const ex of json ? FEW_SHOT : PARAPHRASE_FEW_SHOT) messages.push({ role: 'user', content: ex.user }, { role: 'assistant', content: ex.assistant });
  messages.push({ role: 'user', content: text.slice(0, 1200) });
  const req = eng.chat.completions.create({
    messages,
    temperature: 0,
    max_tokens: json ? maxTokens : Math.min(maxTokens, 96),
    ...(json ? { response_format: { type: 'json_object', schema: JSON.stringify(EXTRACTION_SCHEMA) } } : { frequency_penalty: 0.4 }),
  }).then((r) => {
    llmStats.promptTokens = r.usage?.prompt_tokens ?? null;
    llmStats.completionTokens = r.usage?.completion_tokens ?? null;
    llmStats.prefillTps = r.usage?.extra?.prefill_tokens_per_s ?? null;
    llmStats.decodeTps = r.usage?.extra?.decode_tokens_per_s ?? null;
    return r.choices[0]?.message?.content ?? null;
  });
  try {
    const out = await Promise.race([req, timeout]);
    llmStats.lastMs = Math.round(performance.now() - t0);
    if (timedOut) {
      // Espera a que la generación interrumpida termine y limpia el estado antes de la siguiente.
      await req.catch(() => null);
      try { await eng.resetChat?.(); } catch { /* ignore */ }
    }
    return out;
  } finally {
    clearTimeout(timer);
  }
}

/** Texto -> hallazgos parciales + nivel sugerido. null si el modelo no está, falla o tarda demasiado. */
export async function llmExtract(text: string): Promise<{ findings: Partial<Findings>; level_hint?: TriageLevel } | null> {
  if (!ready || !engine || !text.trim()) return null;
  // Una extracción a la vez (el motor no es reentrante).
  const run = busy.then(async () => {
    try {
      const mode = currentMode();
      const raw = await runExtraction(text, LLM_TIMEOUT_MS, 220, mode);
      llmStats.lastRaw = raw;
      if (!raw) return null;
      if (mode === 'json') return parseLLMOutput(raw);
      // Paráfrasis -> claves con el extractor determinista; solo positivos, sin números.
      return { findings: { sintomas: mapParaphrase(raw, text) } };
    } catch (e) {
      llmStats.lastError = e instanceof Error ? e.message : String(e);
      console.warn('[llm] extracción falló', e);
      return null;
    }
  });
  busy = run.catch(() => undefined);
  return run;
}

/** Libera memoria de GPU (p. ej. si iOS avisa presión de memoria). */
export async function unloadLLM(): Promise<void> {
  try { await engine?.unload?.(); } catch { /* ignore */ }
  try { worker?.terminate(); } catch { /* ignore */ }
  engine = null;
  worker = null;
  ready = false;
}
