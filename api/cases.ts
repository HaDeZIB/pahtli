import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * GET /api/cases?days=14&limit=500
 *
 * Dos modos (ver docs/sync.md §2):
 *  - `records`  : casos individuales (forma CaseRecord, sin transcript). SOLO si el
 *                 despliegue tiene PAHTLI_DASHBOARD_KEY y la petición trae la cabecera
 *                 `x-pahtli-key` igual. Con la variable configurada, una petición sin
 *                 clave o con clave incorrecta recibe 401 (nada de datos).
 *  - `aggregate`: si PAHTLI_DASHBOARD_KEY NO está configurada, solo conteos gruesos
 *                 por día × comunidad × síndrome × nivel. Sin edad, sexo, coordenadas,
 *                 hora ni case_id.
 * Sin Supabase configurado devuelve listas vacías (el tablero usa datos locales + demo).
 *
 * Autocontenido a propósito (sin imports relativos) para el bundler de Vercel.
 */

export const RATE_LIMIT = { windowMs: 60_000, max: 60 };
const TZ = 'America/Mexico_City';

export interface AggregateBucket {
  /** Día calendario en hora del centro de México, YYYY-MM-DD */
  day: string;
  comunidad: string;
  syndrome: string | null;
  /** Nivel final: el de la promotora si lo cambió, si no el sugerido */
  level: string;
  count: number;
}

function header(req: VercelRequest, name: string): string | undefined {
  const v = req.headers?.[name];
  return Array.isArray(v) ? v[0] : v;
}

function safeEqual(a: string | undefined, b: string): boolean {
  if (typeof a !== 'string' || !a) return false;
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}

function clientIp(req: VercelRequest): string {
  const xff = header(req, 'x-forwarded-for');
  return (xff?.split(',')[0] || header(req, 'x-real-ip') || req.socket?.remoteAddress || 'unknown').trim();
}

const hits = new Map<string, { start: number; count: number }>();
export function resetRateLimit() {
  hits.clear();
}
function rateLimited(ip: string, now = Date.now()): boolean {
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v.start > RATE_LIMIT.windowMs) hits.delete(k);
  const h = hits.get(ip);
  if (!h || now - h.start > RATE_LIMIT.windowMs) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  h.count++;
  return h.count > RATE_LIMIT.max;
}

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Agrega filas a conteos gruesos. Exportada para pruebas. */
export function aggregate(
  rows: { created_at: string; comunidad: string; syndrome: string | null; level: string; decision_final_level?: string | null }[],
): AggregateBucket[] {
  const m = new Map<string, AggregateBucket>();
  for (const r of rows) {
    const t = Date.parse(r.created_at);
    if (!Number.isFinite(t)) continue;
    const day = dayFmt.format(new Date(t));
    const level = r.decision_final_level || r.level;
    const k = `${day}|${r.comunidad}|${r.syndrome ?? ''}|${level}`;
    const b = m.get(k);
    if (b) b.count++;
    else m.set(k, { day, comunidad: r.comunidad, syndrome: r.syndrome ?? null, level, count: 1 });
  }
  return [...m.values()].sort((a, b) => b.day.localeCompare(a.day) || a.comunidad.localeCompare(b.comunidad));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'x-pahtli-key');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido' });
  }
  if (rateLimited(clientIp(req))) {
    res.setHeader('Retry-After', String(Math.ceil(RATE_LIMIT.windowMs / 1000)));
    return res.status(429).json({ error: 'Demasiadas peticiones; reintentar más tarde' });
  }

  const dashKey = process.env.PAHTLI_DASHBOARD_KEY;
  let mode: 'records' | 'aggregate' = 'aggregate';
  if (dashKey) {
    if (!safeEqual(header(req, 'x-pahtli-key'), dashKey)) {
      return res.status(401).json({ error: 'Clave del tablero requerida o incorrecta', mode: 'locked' });
    }
    mode = 'records';
  }

  const limit = Math.min(Math.max(parseInt(String(req.query?.limit ?? '500'), 10) || 500, 1), 2000);
  const days = Math.min(Math.max(parseInt(String(req.query?.days ?? '14'), 10) || 14, 1), 90);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const url = process.env.SUPABASE_URL || 'https://txkcfeqytaemfjxfcxor.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const empty = mode === 'records' ? { cases: [] } : { buckets: [] };
  if (!url || !key) return res.status(200).json({ mode, ...empty, days, source: 'none' });

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(url, key, { auth: { persistSession: false } });

    if (mode === 'aggregate') {
      // Solo las columnas necesarias para contar; nunca salen filas individuales.
      const { data, error } = await sb
        .from('cases')
        .select('created_at, comunidad, syndrome, level, decision_final_level')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(10_000);
      if (error) throw error;
      return res.status(200).json({ mode, buckets: aggregate(data ?? []), days, source: 'supabase' });
    }

    const { data, error } = await sb
      .from('cases')
      .select(
        'case_id, created_at, comunidad, lat, lng, level, escalated_by_model, syndrome, rule_ids, findings, device_tier, decision_final_level, decision_overridden, decision_reason, uncertain, uncertainty_reasons',
      )
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    const cases = (data ?? []).map((r) => ({
      case_id: r.case_id,
      created_at: new Date(r.created_at).toISOString(),
      comunidad: r.comunidad,
      lat: r.lat ?? undefined,
      lng: r.lng ?? undefined,
      transcript: '',
      findings: r.findings ?? { sintomas: {} },
      result: { level: r.level, escalated_by_model: !!r.escalated_by_model, rule_ids: r.rule_ids ?? [] },
      sindrome: r.syndrome ?? undefined,
      device_tier: r.device_tier,
      ...(r.decision_final_level
        ? { decision: { final_level: r.decision_final_level, overridden: !!r.decision_overridden, ...(r.decision_reason ? { reason: r.decision_reason } : {}) } }
        : {}),
      ...(typeof r.uncertain === 'boolean' ? { uncertain: r.uncertain } : {}),
      ...(Array.isArray(r.uncertainty_reasons) && r.uncertainty_reasons.length ? { uncertainty_reasons: r.uncertainty_reasons } : {}),
      synced: true,
    }));
    return res.status(200).json({ mode, cases, days, source: 'supabase' });
  } catch (e) {
    const err = e as { message?: string; code?: string };
    console.error('cases query failed', err?.code ?? '', err?.message ?? 'error');
    return res.status(200).json({ mode, ...empty, days, source: 'error', error_code: err?.code ?? 'unknown' });
  }
}
