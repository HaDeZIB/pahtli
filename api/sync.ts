import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * POST /api/sync  { cases: SyncCase[] }
 *
 * Upsert idempotente por case_id en Supabase. Seguridad (ver docs/sync.md §2):
 *  - Cabecera `x-pahtli-device` = token de inscripción compartido del despliegue
 *    (env PAHTLI_SYNC_TOKEN, opcional: si existe se exige). Sin SUPABASE_SERVICE_ROLE_KEY
 *    el servidor valida pero NO guarda nada y responde demo:true (modo demostración).
 *    En producción esto sería una llave por dispositivo emitida al inscribirlo.
 *  - Esquema estricto: campos desconocidos => caso rechazado; valores numéricos acotados.
 *  - Máximo 200 casos por lote, máximo 256 KB por petición.
 *  - Límite de peticiones por IP (en memoria, best-effort: cada instancia lleva su cuenta).
 *
 * Autocontenido a propósito (sin imports relativos) para el bundler de Vercel.
 */

/** URL pública del proyecto Supabase (no es secreta; la llave sí, y va solo en env). */
const DEFAULT_SUPABASE_URL = 'https://txkcfeqytaemfjxfcxor.supabase.co';

const LEVELS = ['aqui', 'centro_hoy', 'urgencia'] as const;
const SYNDROMES = [
  'respiratorio', 'diarreico', 'diarrea_sangre', 'febril', 'febril_hemorragico',
  'obstetrico', 'neurologico', 'cardiovascular', 'trauma', 'otro',
] as const;
const TIERS = ['A', 'B', 'C'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Códigos cortos (reglas, motivos, síntomas). Nunca texto libre. */
const CODE = /^[a-z0-9][a-z0-9_.:-]{0,59}$/i;
const SYMPTOM_KEY = /^[a-z][a-z0-9_]{0,59}$/;

export const MAX_BATCH = 200;
export const MAX_BODY_BYTES = 256 * 1024;
export const RATE_LIMIT = { windowMs: 60_000, max: 30 };

export type Level = (typeof LEVELS)[number];

export interface CaseRow {
  case_id: string;
  created_at: string;
  comunidad: string;
  lat: number | null;
  lng: number | null;
  level: Level;
  escalated_by_model: boolean;
  syndrome: (typeof SYNDROMES)[number] | null;
  rule_ids: string[];
  findings: Record<string, unknown>;
  device_tier: (typeof TIERS)[number];
  decision_final_level: Level | null;
  decision_overridden: boolean | null;
  decision_reason: string | null;
  uncertain: boolean | null;
  uncertainty_reasons: string[];
}

const CASE_FIELDS = new Set([
  'case_id', 'created_at', 'comunidad', 'lat', 'lng', 'level', 'escalated_by_model', 'syndrome',
  'rule_ids', 'findings', 'device_tier', 'decision', 'uncertain', 'uncertainty_reasons',
]);
const DECISION_FIELDS = new Set(['final_level', 'overridden', 'reason']);
/** Rango permitido por hallazgo numérico; fuera de rango se acota (clamp). */
const FINDING_NUMBERS: Record<string, [number, number]> = {
  edad_meses: [0, 1440],
  semanas_embarazo: [0, 45],
  duracion_dias: [0, 365],
  temperatura_c: [30, 45],
  resp_por_min: [0, 150],
};
const FINDING_FIELDS = new Set([...Object.keys(FINDING_NUMBERS), 'sexo', 'embarazada', 'sintomas']);
const MAX_SYMPTOMS = 150;

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round2 = (v: number) => Math.round(v * 100) / 100;
const unknownKey = (o: Record<string, unknown>, allowed: Set<string>) => Object.keys(o).find((k) => !allowed.has(k));

function coord(x: unknown, max: number): number | null | 'bad' {
  if (x == null) return null;
  if (typeof x !== 'number' || !Number.isFinite(x)) return 'bad';
  if (Math.abs(x) > max) return null;
  return round2(x); // ~1 km: nunca guardamos la ubicación exacta de una casa
}

function validateFindings(f: unknown): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  if (!isObj(f)) return { ok: false, error: 'findings inválido' };
  const extra = unknownKey(f, FINDING_FIELDS);
  if (extra) return { ok: false, error: `findings: campo no permitido (${extra.slice(0, 40)})` };
  const out: Record<string, unknown> = {};
  for (const [k, [min, max]] of Object.entries(FINDING_NUMBERS)) {
    const v = f[k];
    if (v == null) continue;
    if (typeof v !== 'number' || !Number.isFinite(v)) return { ok: false, error: `findings.${k} inválido` };
    out[k] = k === 'temperatura_c' ? Math.round(clamp(v, min, max) * 10) / 10 : Math.round(clamp(v, min, max));
  }
  if (f.sexo != null) {
    if (f.sexo !== 'F' && f.sexo !== 'M') return { ok: false, error: 'findings.sexo inválido' };
    out.sexo = f.sexo;
  }
  if (f.embarazada != null) {
    if (typeof f.embarazada !== 'boolean') return { ok: false, error: 'findings.embarazada inválido' };
    out.embarazada = f.embarazada;
  }
  const s = f.sintomas ?? {};
  if (!isObj(s)) return { ok: false, error: 'findings.sintomas inválido' };
  const keys = Object.keys(s);
  if (keys.length > MAX_SYMPTOMS) return { ok: false, error: 'findings.sintomas demasiados' };
  const sintomas: Record<string, boolean> = {};
  for (const k of keys) {
    if (!SYMPTOM_KEY.test(k) || typeof s[k] !== 'boolean') return { ok: false, error: 'findings.sintomas inválido' };
    sintomas[k] = s[k] as boolean;
  }
  out.sintomas = sintomas;
  return { ok: true, value: out };
}

function codeList(x: unknown, max: number): string[] | null {
  if (x == null) return [];
  if (!Array.isArray(x) || x.length > max || !x.every((r) => typeof r === 'string' && CODE.test(r))) return null;
  return [...new Set(x as string[])];
}

export function validateCase(x: unknown): { ok: true; row: CaseRow } | { ok: false; error: string } {
  if (!isObj(x)) return { ok: false, error: 'no es objeto' };
  // Esquema estricto: un campo desconocido (p.ej. transcript, promotora) rechaza el caso.
  const extra = unknownKey(x, CASE_FIELDS);
  if (extra) return { ok: false, error: `campo no permitido (${extra.slice(0, 40)})` };
  if (typeof x.case_id !== 'string' || !UUID.test(x.case_id)) return { ok: false, error: 'case_id inválido' };
  const t = typeof x.created_at === 'string' && x.created_at.length <= 40 ? Date.parse(x.created_at) : NaN;
  if (!Number.isFinite(t)) return { ok: false, error: 'created_at inválido' };
  if (t > Date.now() + 24 * 3_600_000) return { ok: false, error: 'created_at en el futuro' };
  if (t < Date.parse('2024-01-01T00:00:00Z')) return { ok: false, error: 'created_at demasiado antiguo' };
  if (typeof x.comunidad !== 'string' || !x.comunidad.trim() || x.comunidad.length > 120) return { ok: false, error: 'comunidad inválida' };
  if (!LEVELS.includes(x.level as never)) return { ok: false, error: 'level inválido' };
  if (x.syndrome != null && !SYNDROMES.includes(x.syndrome as never)) return { ok: false, error: 'syndrome inválido' };
  if (!TIERS.includes(x.device_tier as never)) return { ok: false, error: 'device_tier inválido' };
  if (x.escalated_by_model != null && typeof x.escalated_by_model !== 'boolean') return { ok: false, error: 'escalated_by_model inválido' };
  const lat = coord(x.lat, 90);
  const lng = coord(x.lng, 180);
  if (lat === 'bad' || lng === 'bad') return { ok: false, error: 'coordenadas inválidas' };
  const f = validateFindings(x.findings);
  if (!f.ok) return f;
  const rule_ids = codeList(x.rule_ids, 50);
  if (!rule_ids) return { ok: false, error: 'rule_ids inválido' };

  // Decisión de la promotora (opcional). El motivo solo viaja como código corto;
  // el texto libre se queda en el celular (igual que el transcript).
  let decision_final_level: Level | null = null;
  let decision_overridden: boolean | null = null;
  let decision_reason: string | null = null;
  if (x.decision != null) {
    const d = x.decision;
    if (!isObj(d)) return { ok: false, error: 'decision inválida' };
    const dx = unknownKey(d, DECISION_FIELDS);
    if (dx) return { ok: false, error: `decision: campo no permitido (${dx.slice(0, 40)})` };
    if (!LEVELS.includes(d.final_level as never)) return { ok: false, error: 'decision.final_level inválido' };
    if (typeof d.overridden !== 'boolean') return { ok: false, error: 'decision.overridden inválido' };
    if (d.reason != null && (typeof d.reason !== 'string' || !CODE.test(d.reason))) return { ok: false, error: 'decision.reason debe ser un código' };
    decision_final_level = d.final_level as Level;
    decision_overridden = d.overridden;
    decision_reason = (d.reason as string | undefined) ?? null;
  }
  if (x.uncertain != null && typeof x.uncertain !== 'boolean') return { ok: false, error: 'uncertain inválido' };
  const uncertainty_reasons = codeList(x.uncertainty_reasons, 10);
  if (!uncertainty_reasons) return { ok: false, error: 'uncertainty_reasons inválido' };

  return {
    ok: true,
    row: {
      case_id: x.case_id.toLowerCase(),
      created_at: new Date(t).toISOString(),
      comunidad: x.comunidad.trim().replace(/\s+/g, ' '),
      lat,
      lng,
      level: x.level as Level,
      escalated_by_model: x.escalated_by_model === true,
      syndrome: (x.syndrome ?? null) as CaseRow['syndrome'],
      rule_ids,
      findings: f.value,
      device_tier: x.device_tier as CaseRow['device_tier'],
      decision_final_level,
      decision_overridden,
      decision_reason,
      uncertain: typeof x.uncertain === 'boolean' ? x.uncertain : null,
      uncertainty_reasons,
    },
  };
}

export function validateBatch(body: unknown) {
  if (!isObj(body) || unknownKey(body, new Set(['cases'])) || !Array.isArray(body.cases)) {
    return { error: 'Se esperaba { cases: [...] }' } as const;
  }
  const cases = body.cases;
  if (cases.length > MAX_BATCH) return { error: `Máximo ${MAX_BATCH} casos por lote` } as const;
  const rows: CaseRow[] = [];
  const rejected: { index: number; case_id?: string; error: string }[] = [];
  const seen = new Set<string>();
  cases.forEach((c, index) => {
    const r = validateCase(c);
    if (!r.ok) {
      const id = isObj(c) && typeof c.case_id === 'string' && UUID.test(c.case_id) ? c.case_id : undefined;
      rejected.push({ index, case_id: id, error: r.error });
    } else if (!seen.has(r.row.case_id)) {
      seen.add(r.row.case_id);
      rows.push(r.row);
    }
  });
  return { rows, rejected } as const;
}

// ---------- utilidades de seguridad (duplicadas en api/cases.ts a propósito) ----------

function header(req: VercelRequest, name: string): string | undefined {
  const v = req.headers?.[name];
  return Array.isArray(v) ? v[0] : v;
}

/** Comparación en tiempo constante (sobre hashes, para no filtrar la longitud). */
export function safeEqual(a: string | undefined, b: string): boolean {
  if (typeof a !== 'string' || !a) return false;
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function clientIp(req: VercelRequest): string {
  const xff = header(req, 'x-forwarded-for');
  return (xff?.split(',')[0] || header(req, 'x-real-ip') || req.socket?.remoteAddress || 'unknown').trim();
}

const hits = new Map<string, { start: number; count: number }>();
export function resetRateLimit() {
  hits.clear();
}
/** Ventana fija por IP. En memoria: best-effort (se reinicia con cada instancia fría). */
export function rateLimited(ip: string, now = Date.now()): boolean {
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v.start > RATE_LIMIT.windowMs) hits.delete(k);
  const h = hits.get(ip);
  if (!h || now - h.start > RATE_LIMIT.windowMs) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  h.count++;
  return h.count > RATE_LIMIT.max;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido' });
  }
  if (rateLimited(clientIp(req))) {
    res.setHeader('Retry-After', String(Math.ceil(RATE_LIMIT.windowMs / 1000)));
    return res.status(429).json({ error: 'Demasiadas peticiones; reintentar más tarde' });
  }
  const len = Number(header(req, 'content-length') ?? 0);
  if (Number.isFinite(len) && len > MAX_BODY_BYTES) return res.status(413).json({ error: 'Petición demasiado grande' });

  // Token de inscripción compartido (opcional). Si está configurado se exige; en una PWA
  // ese token viaja en el bundle, así que NO es autenticación real: producción = llave por dispositivo.
  const token = process.env.PAHTLI_SYNC_TOKEN;
  if (token && !safeEqual(header(req, 'x-pahtli-device'), token)) {
    return res.status(401).json({ error: 'Dispositivo no inscrito (x-pahtli-device inválido)' });
  }

  let body: unknown = req.body;
  if (typeof body === 'string') {
    if (body.length > MAX_BODY_BYTES) return res.status(413).json({ error: 'Petición demasiado grande' });
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'JSON inválido' });
    }
  }
  const v = validateBatch(body);
  if ('error' in v) return res.status(400).json({ error: v.error });
  const { rows, rejected } = v;
  const accepted = rows.map((r) => r.case_id);

  const url = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return res.status(200).json({ stored: false, demo: true, accepted, rejected });
  }
  if (!rows.length) return res.status(200).json({ stored: true, demo: false, accepted, rejected });

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await sb.from('cases').upsert(rows, { onConflict: 'case_id' });
    if (error) throw error;
    return res.status(200).json({ stored: true, demo: false, accepted, rejected });
  } catch (e) {
    console.error('sync upsert failed', (e as { message?: string })?.message ?? 'error');
    // 502: el cliente conserva los casos en su cola y reintenta con backoff
    return res.status(502).json({ error: 'No se pudo guardar; reintentar' });
  }
}
