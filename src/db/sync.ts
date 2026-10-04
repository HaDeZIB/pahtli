import type { CaseRecord, DeviceTier, Findings, Syndrome, TriageLevel } from '../types';
import { getSettings, markSynced, pendingCases } from './db';

/**
 * Forma de un caso en la red. Minimización de datos por diseño:
 *  - NO viaja el transcript (texto libre que podría contener nombres) ni la promotora.
 *  - Coordenadas redondeadas a 2 decimales (~1 km), nunca la casa exacta.
 *  - Edad: meses exactos solo en menores de 2 años (las reglas pediátricas lo usan);
 *    de 2 años en adelante se redondea hacia abajo a años cumplidos (×12).
 *  - Hallazgos: solo los campos estructurados conocidos.
 *  - Decisión de la promotora: nivel final y si cambió la sugerencia; el motivo solo
 *    si es un código corto (la nota en texto libre `decision.note` se queda en el celular).
 *  - Incertidumbre: `uncertain` y los CÓDIGOS de los motivos (no las frases).
 * El servidor (api/sync.ts) rechaza cualquier campo fuera de esta lista.
 */
export interface SyncCase {
  case_id: string;
  created_at: string;
  comunidad: string;
  lat: number | null;
  lng: number | null;
  level: TriageLevel;
  escalated_by_model: boolean;
  syndrome: Syndrome | null;
  rule_ids: string[];
  findings: Findings;
  device_tier: DeviceTier;
  decision?: { final_level: TriageLevel; overridden: boolean; reason?: string };
  uncertain?: boolean;
  uncertainty_reasons?: string[];
}

/**
 * Campos opcionales que otros módulos agregan a CaseRecord (decisión humana e
 * incertidumbre). Se leen de forma defensiva: pueden no existir.
 */
interface OptionalCaseFields {
  decision?: { final_level?: unknown; overridden?: unknown; reason?: unknown } | null;
  uncertain?: unknown;
  uncertainty_reasons?: unknown;
  /** Si el módulo de incertidumbre guarda los códigos, se prefieren sobre los textos. */
  uncertainty_codes?: unknown;
}

/**
 * Los motivos de incertidumbre se guardan en el celular como frases en español
 * (src/triage/uncertainty.ts). A la red solo viaja el CÓDIGO: es más corto, se puede
 * contar en el tablero y no arrastra texto (p.ej. la lista de preguntas respondidas).
 * Frase no reconocida => 'otro' (se conserva el conteo, no el texto).
 */
const UNCERTAINTY_PREFIXES: [string, string][] = [
  ['No entendí ningún síntoma', 'no_findings'],
  ['No se marcó ningún síntoma', 'no_findings'],
  ['La descripción es muy corta', 'short_transcript'],
  ['El texto parece mal entendido', 'garbled_transcript'],
  ['Falta la edad', 'age_missing'],
  ['Respondió', 'answered_unknown'],
  ['Respondiste', 'answered_unknown'], // frase anterior (casos guardados antes del cambio)
  ['Quedaron preguntas sin responder', 'questions_pending'],
  ['La IA y las palabras clave no coinciden', 'llm_disagree'],
  ['Bebé de menos de 2 meses', 'young_infant_few'],
  ['Embarazo con pocos datos', 'pregnancy_few'],
];

export function uncertaintyCode(reason: string): string {
  const r = reason.trim();
  if (/^[a-z][a-z0-9_]{0,59}$/.test(r)) return r; // ya es código
  return UNCERTAINTY_PREFIXES.find(([p]) => r.startsWith(p))?.[1] ?? 'otro';
}

const LEVELS: TriageLevel[] = ['aqui', 'centro_hoy', 'urgencia'];
const CODE = /^[a-z0-9][a-z0-9_.:-]{0,59}$/i;
const SYMPTOM_KEY = /^[a-z][a-z0-9_]{0,59}$/;

export const round2 = (v: number) => Math.round(v * 100) / 100;

/** Meses exactos < 24; desde 2 años, años cumplidos × 12. */
export function coarseAgeMonths(m: number): number {
  const v = Math.max(0, Math.floor(m));
  return v < 24 ? v : Math.floor(v / 12) * 12;
}

function minimizeFindings(f: Findings | undefined): Findings {
  const src = (f ?? { sintomas: {} }) as Findings & Record<string, unknown>;
  const out: Findings = { sintomas: {} };
  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  if (num(src.edad_meses)) out.edad_meses = coarseAgeMonths(src.edad_meses);
  if (src.sexo === 'F' || src.sexo === 'M') out.sexo = src.sexo;
  if (typeof src.embarazada === 'boolean') out.embarazada = src.embarazada;
  if (num(src.semanas_embarazo)) out.semanas_embarazo = Math.round(src.semanas_embarazo);
  if (num(src.duracion_dias)) out.duracion_dias = Math.round(src.duracion_dias);
  if (num(src.temperatura_c)) out.temperatura_c = Math.round(src.temperatura_c * 10) / 10;
  if (num(src.resp_por_min)) out.resp_por_min = Math.round(src.resp_por_min);
  for (const [k, v] of Object.entries(src.sintomas ?? {})) {
    if (typeof v === 'boolean' && SYMPTOM_KEY.test(k)) out.sintomas[k] = v;
  }
  return out;
}

export function toSyncCase(c: CaseRecord): SyncCase {
  const x = c as CaseRecord & OptionalCaseFields;
  const out: SyncCase = {
    case_id: c.case_id,
    created_at: c.created_at,
    comunidad: c.comunidad,
    lat: typeof c.lat === 'number' && Number.isFinite(c.lat) ? round2(c.lat) : null,
    lng: typeof c.lng === 'number' && Number.isFinite(c.lng) ? round2(c.lng) : null,
    level: c.result.level,
    escalated_by_model: !!c.result.escalated_by_model,
    syndrome: c.sindrome ?? null,
    rule_ids: (c.result.rule_ids ?? []).filter((r) => typeof r === 'string' && CODE.test(r)).slice(0, 50),
    findings: minimizeFindings(c.findings),
    device_tier: c.device_tier,
  };
  const d = x.decision;
  if (d && LEVELS.includes(d.final_level as TriageLevel)) {
    out.decision = { final_level: d.final_level as TriageLevel, overridden: d.overridden === true };
    if (typeof d.reason === 'string' && CODE.test(d.reason)) out.decision.reason = d.reason;
  }
  if (typeof x.uncertain === 'boolean') out.uncertain = x.uncertain;
  const rawReasons = Array.isArray(x.uncertainty_codes) ? x.uncertainty_codes : Array.isArray(x.uncertainty_reasons) ? x.uncertainty_reasons : [];
  const codes = [...new Set(rawReasons.filter((r): r is string => typeof r === 'string').map(uncertaintyCode))].slice(0, 10);
  if (codes.length) out.uncertainty_reasons = codes;
  return out;
}

/** Token de inscripción: el guardado en el celular, o el del build (VITE_PAHTLI_SYNC_TOKEN, solo demo). */
async function syncToken(): Promise<string | undefined> {
  try {
    const s = await getSettings();
    if (s.syncToken) return s.syncToken;
  } catch {
    /* sin IndexedDB */
  }
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  return env?.VITE_PAHTLI_SYNC_TOKEN || undefined;
}

const ENDPOINT = '/api/sync';
const BATCH = 50; // el servidor acepta máx. 200
const INTERVAL_MS = 30_000;
const MAX_BACKOFF_MS = 10 * 60_000;

let inFlight: Promise<{ sent: number; ok: boolean; demo?: boolean; error?: string | null }> | null = null;
let failures = 0;
let nextAllowedAt = 0;
let lastSyncAt: string | null = null;
let lastDemo = false;
let lastError: 'no_inscrito' | 'limite' | 'servidor' | 'red' | null = null;

export function syncStatus() {
  return { failures, nextAllowedAt, lastSyncAt, demo: lastDemo, syncing: !!inFlight, lastError };
}

class HttpError extends Error {
  status: number;
  constructor(status: number) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}

function online(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

async function postBatch(batch: CaseRecord[]): Promise<{ accepted: string[]; demo: boolean }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = await syncToken();
    if (token) headers['x-pahtli-device'] = token;
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ cases: batch.map(toSyncCase) }),
      signal: ctrl.signal,
    });
    if (res.status !== 200) throw new HttpError(res.status);
    const body = (await res.json().catch(() => ({}))) as { accepted?: unknown; demo?: unknown };
    // El servidor devuelve qué case_id aceptó; los inválidos se quedan en la cola.
    const accepted = Array.isArray(body.accepted)
      ? body.accepted.filter((x): x is string => typeof x === 'string')
      : batch.map((c) => c.case_id);
    return { accepted, demo: body.demo === true };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Envía la cola local en lotes. Idempotente: el servidor hace upsert por case_id,
 * así que reenviar un caso (p.ej. si se cortó la señal antes de marcarlo) no duplica.
 */
export function syncNow(): Promise<{ sent: number; ok: boolean; demo?: boolean; error?: string | null }> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    if (!online()) return { sent: 0, ok: false };
    let sent = 0;
    let demo = false;
    try {
      for (let guard = 0; guard < 100; guard++) {
        const batch = await pendingCases(BATCH);
        if (!batch.length) break;
        const r = await postBatch(batch);
        demo = demo || r.demo;
        const ids = new Set(batch.map((c) => c.case_id));
        const ok = r.accepted.filter((id) => ids.has(id));
        await markSynced(ok, r.demo);
        sent += ok.length;
        if (ok.length < batch.length) break; // hubo rechazados: no ciclar sobre ellos
      }
      failures = 0;
      nextAllowedAt = 0;
      lastSyncAt = new Date().toISOString();
      if (sent) lastDemo = demo;
      lastError = null;
      return { sent, ok: true, demo };
    } catch (e) {
      const st = e instanceof HttpError ? e.status : 0;
      lastError = st === 401 ? 'no_inscrito' : st === 429 ? 'limite' : st ? 'servidor' : 'red';
      failures++;
      const delay = Math.min(INTERVAL_MS * 2 ** (failures - 1), MAX_BACKOFF_MS);
      nextAllowedAt = Date.now() + delay;
      return { sent, ok: false, error: lastError };
    }
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * Sincroniza al volver la señal ('online'), al regresar a la app y cada 30 s
 * mientras haya conexión. Respeta backoff exponencial tras fallos.
 * Devuelve una función para detenerlo.
 */
export function startAutoSync(onChange?: () => void): () => void {
  let stopped = false;

  const run = async (force = false) => {
    if (stopped || !online()) return;
    if (!force && Date.now() < nextAllowedAt) return;
    const r = await syncNow();
    if (!stopped && (r.sent > 0 || !r.ok)) onChange?.();
  };

  const onOnline = () => {
    nextAllowedAt = 0; // volvió la señal: intenta ya, sin esperar el backoff
    onChange?.();
    void run(true);
  };
  const onOffline = () => onChange?.();
  const onVisible = () => {
    if (document.visibilityState === 'visible') void run();
  };

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisible);
  const timer = setInterval(() => void run(), INTERVAL_MS);
  void run();

  return () => {
    stopped = true;
    clearInterval(timer);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
