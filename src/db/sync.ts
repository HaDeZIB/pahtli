import type { CaseRecord, DeviceTier, Findings, Syndrome, TriageLevel } from '../types';
import { markSynced, pendingCases } from './db';

/**
 * Forma de un caso en la red. Privacidad por diseño: NO viaja el transcript
 * (texto libre que podría contener nombres) ni el nombre de la promotora.
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
}

export function toSyncCase(c: CaseRecord): SyncCase {
  return {
    case_id: c.case_id,
    created_at: c.created_at,
    comunidad: c.comunidad,
    lat: typeof c.lat === 'number' ? c.lat : null,
    lng: typeof c.lng === 'number' ? c.lng : null,
    level: c.result.level,
    escalated_by_model: !!c.result.escalated_by_model,
    syndrome: c.sindrome ?? null,
    rule_ids: c.result.rule_ids ?? [],
    findings: c.findings,
    device_tier: c.device_tier,
  };
}

const ENDPOINT = '/api/sync';
const BATCH = 50;
const INTERVAL_MS = 30_000;
const MAX_BACKOFF_MS = 10 * 60_000;

let inFlight: Promise<{ sent: number; ok: boolean; demo?: boolean }> | null = null;
let failures = 0;
let nextAllowedAt = 0;
let lastSyncAt: string | null = null;
let lastDemo = false;

export function syncStatus() {
  return { failures, nextAllowedAt, lastSyncAt, demo: lastDemo, syncing: !!inFlight };
}

function online(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

async function postBatch(batch: CaseRecord[]): Promise<{ accepted: string[]; demo: boolean }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cases: batch.map(toSyncCase) }),
      signal: ctrl.signal,
    });
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
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
export function syncNow(): Promise<{ sent: number; ok: boolean; demo?: boolean }> {
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
        await markSynced(ok);
        sent += ok.length;
        if (ok.length < batch.length) break; // hubo rechazados: no ciclar sobre ellos
      }
      failures = 0;
      nextAllowedAt = 0;
      lastSyncAt = new Date().toISOString();
      if (sent) lastDemo = demo;
      return { sent, ok: true, demo };
    } catch {
      failures++;
      const delay = Math.min(INTERVAL_MS * 2 ** (failures - 1), MAX_BACKOFF_MS);
      nextAllowedAt = Date.now() + delay;
      return { sent, ok: false };
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
