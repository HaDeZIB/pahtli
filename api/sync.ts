import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/sync  { cases: SyncCase[] }
 * Upsert idempotente por case_id. Si Supabase no está configurado responde
 * 200 { stored:false, demo:true } para que la demo nunca se rompa.
 * Autocontenido a propósito (sin imports relativos) para el bundler de Vercel.
 */

const LEVELS = ['aqui', 'centro_hoy', 'urgencia'] as const;
const SYNDROMES = [
  'respiratorio', 'diarreico', 'diarrea_sangre', 'febril', 'febril_hemorragico',
  'obstetrico', 'neurologico', 'cardiovascular', 'trauma', 'otro',
] as const;
const TIERS = ['A', 'B', 'C'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_BATCH = 500;

export interface CaseRow {
  case_id: string;
  created_at: string;
  comunidad: string;
  lat: number | null;
  lng: number | null;
  level: (typeof LEVELS)[number];
  escalated_by_model: boolean;
  syndrome: (typeof SYNDROMES)[number] | null;
  rule_ids: string[];
  findings: Record<string, unknown>;
  device_tier: (typeof TIERS)[number];
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const num = (x: unknown, min: number, max: number) => (typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max ? x : null);

export function validateCase(x: unknown): { ok: true; row: CaseRow } | { ok: false; error: string } {
  if (!isObj(x)) return { ok: false, error: 'no es objeto' };
  if (typeof x.case_id !== 'string' || !UUID.test(x.case_id)) return { ok: false, error: 'case_id inválido' };
  const t = typeof x.created_at === 'string' ? Date.parse(x.created_at) : NaN;
  if (!Number.isFinite(t)) return { ok: false, error: 'created_at inválido' };
  if (t > Date.now() + 24 * 3_600_000) return { ok: false, error: 'created_at en el futuro' };
  if (typeof x.comunidad !== 'string' || !x.comunidad.trim() || x.comunidad.length > 120) return { ok: false, error: 'comunidad inválida' };
  if (!LEVELS.includes(x.level as never)) return { ok: false, error: 'level inválido' };
  if (x.syndrome != null && !SYNDROMES.includes(x.syndrome as never)) return { ok: false, error: 'syndrome inválido' };
  if (!TIERS.includes(x.device_tier as never)) return { ok: false, error: 'device_tier inválido' };
  if (!isObj(x.findings)) return { ok: false, error: 'findings inválido' };
  if (JSON.stringify(x.findings).length > 8_000) return { ok: false, error: 'findings demasiado grande' };
  const rule_ids = Array.isArray(x.rule_ids) ? x.rule_ids : [];
  if (rule_ids.length > 50 || !rule_ids.every((r) => typeof r === 'string' && r.length <= 80)) return { ok: false, error: 'rule_ids inválido' };
  // Privacidad: solo se guardan los campos de la lista; cualquier otro (p.ej. transcript) se descarta.
  return {
    ok: true,
    row: {
      case_id: x.case_id.toLowerCase(),
      created_at: new Date(t).toISOString(),
      comunidad: x.comunidad.trim(),
      lat: num(x.lat, -90, 90),
      lng: num(x.lng, -180, 180),
      level: x.level as CaseRow['level'],
      escalated_by_model: x.escalated_by_model === true,
      syndrome: (x.syndrome ?? null) as CaseRow['syndrome'],
      rule_ids: rule_ids as string[],
      findings: x.findings,
      device_tier: x.device_tier as CaseRow['device_tier'],
    },
  };
}

export function validateBatch(body: unknown) {
  const cases = isObj(body) && Array.isArray(body.cases) ? body.cases : null;
  if (!cases) return { error: 'Se esperaba { cases: [...] }' } as const;
  if (cases.length > MAX_BATCH) return { error: `Máximo ${MAX_BATCH} casos por lote` } as const;
  const rows: CaseRow[] = [];
  const rejected: { index: number; case_id?: unknown; error: string }[] = [];
  const seen = new Set<string>();
  cases.forEach((c, index) => {
    const r = validateCase(c);
    if (!r.ok) rejected.push({ index, case_id: isObj(c) ? c.case_id : undefined, error: r.error });
    else if (!seen.has(r.row.case_id)) {
      seen.add(r.row.case_id);
      rows.push(r.row);
    }
  });
  return { rows, rejected } as const;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  let body: unknown = req.body;
  if (typeof body === 'string') {
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

  const url = process.env.SUPABASE_URL;
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
    console.error('sync upsert failed', e);
    // 502: el cliente conserva los casos en su cola y reintenta con backoff
    return res.status(502).json({ error: 'No se pudo guardar; reintentar' });
  }
}
