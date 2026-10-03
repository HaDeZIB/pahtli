import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/cases?limit=500&days=14
 * Casos recientes para el tablero, con la forma de CaseRecord (src/types.ts).
 * Sin Supabase configurado devuelve lista vacía (el tablero usa datos locales + demo).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido' });
  }
  res.setHeader('Cache-Control', 'no-store');

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(200).json({ cases: [], source: 'none' });

  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '500'), 10) || 500, 1), 2000);
  const days = Math.min(Math.max(parseInt(String(req.query.days ?? '14'), 10) || 14, 1), 90);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await sb
      .from('cases')
      .select('case_id, created_at, comunidad, lat, lng, level, escalated_by_model, syndrome, rule_ids, findings, device_tier')
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
      synced: true,
    }));
    return res.status(200).json({ cases, source: 'supabase' });
  } catch (e) {
    console.error('cases query failed', e);
    return res.status(200).json({ cases: [], source: 'error' });
  }
}
