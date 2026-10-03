import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import syncHandler, { RATE_LIMIT, resetRateLimit as resetSyncRL } from '../../api/sync';
import casesHandler, { aggregate, resetRateLimit as resetCasesRL } from '../../api/cases';
import { toSyncCase } from './sync';
import { generateSeedCases } from '../surveillance/seed';

/** Pruebas de los handlers de Vercel con req/res simulados (sin red ni Supabase). */

interface MockRes {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
}

function call(
  handler: (req: VercelRequest, res: VercelResponse) => unknown,
  req: { method?: string; headers?: Record<string, string>; body?: unknown; query?: Record<string, string>; ip?: string },
): Promise<MockRes> {
  const out: MockRes = { statusCode: 200, body: undefined, headers: {} };
  const res = {
    status(code: number) {
      out.statusCode = code;
      return res;
    },
    json(b: unknown) {
      out.body = b;
      return res;
    },
    end() {
      return res;
    },
    setHeader(k: string, v: string) {
      out.headers[k.toLowerCase()] = v;
      return res;
    },
  };
  const r = {
    method: req.method ?? 'POST',
    headers: { 'x-forwarded-for': req.ip ?? '10.0.0.1', ...(req.headers ?? {}) },
    body: req.body,
    query: req.query ?? {},
    socket: { remoteAddress: '127.0.0.1' },
  };
  return Promise.resolve(handler(r as unknown as VercelRequest, res as unknown as VercelResponse)).then(() => out);
}

const seed = generateSeedCases();
const payload = { cases: seed.slice(0, 5).map(toSyncCase) };

beforeEach(() => {
  resetSyncRL();
  resetCasesRL();
  vi.stubEnv('SUPABASE_URL', '');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
  vi.stubEnv('PAHTLI_SYNC_TOKEN', '');
  vi.stubEnv('PAHTLI_DASHBOARD_KEY', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/sync', () => {
  it('sin PAHTLI_SYNC_TOKEN acepta, marca demo:true y no guarda', async () => {
    const r = await call(syncHandler, { body: payload });
    expect(r.statusCode).toBe(200);
    expect(r.body).toMatchObject({ stored: false, demo: true });
    expect((r.body as { accepted: string[] }).accepted).toHaveLength(5);
  });

  it('sin token no guarda aunque Supabase esté configurado', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://ejemplo.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-de-prueba');
    const r = await call(syncHandler, { body: payload });
    expect(r.body).toMatchObject({ stored: false, demo: true });
  });

  it('con PAHTLI_SYNC_TOKEN exige x-pahtli-device correcto', async () => {
    vi.stubEnv('PAHTLI_SYNC_TOKEN', 'token-de-prueba');
    expect((await call(syncHandler, { body: payload })).statusCode).toBe(401);
    expect((await call(syncHandler, { body: payload, headers: { 'x-pahtli-device': 'otro' } })).statusCode).toBe(401);
    const ok = await call(syncHandler, { body: payload, headers: { 'x-pahtli-device': 'token-de-prueba' } });
    expect(ok.statusCode).toBe(200);
    // Token válido pero sin Supabase: sigue sin guardar (demo)
    expect(ok.body).toMatchObject({ stored: false, demo: true });
  });

  it('rechaza métodos distintos de POST, JSON inválido y cuerpos grandes', async () => {
    expect((await call(syncHandler, { method: 'GET' })).statusCode).toBe(405);
    expect((await call(syncHandler, { body: '{no es json' })).statusCode).toBe(400);
    expect((await call(syncHandler, { body: payload, headers: { 'content-length': String(300 * 1024) } })).statusCode).toBe(413);
    expect((await call(syncHandler, { body: 'x'.repeat(300 * 1024) })).statusCode).toBe(413);
    const big = { cases: Array.from({ length: 201 }, () => payload.cases[0]) };
    expect((await call(syncHandler, { body: big })).statusCode).toBe(400);
  });

  it('acepta el cuerpo como string JSON y reporta rechazados por campo desconocido', async () => {
    const body = JSON.stringify({ cases: [payload.cases[0], { ...payload.cases[1], transcript: 'Juan' }] });
    const r = await call(syncHandler, { body });
    expect(r.statusCode).toBe(200);
    const b = r.body as { accepted: string[]; rejected: { error: string }[] };
    expect(b.accepted).toHaveLength(1);
    expect(b.rejected[0].error).toContain('campo no permitido');
  });

  it('limita peticiones por IP (429 con Retry-After)', async () => {
    for (let i = 0; i < RATE_LIMIT.max; i++) {
      expect((await call(syncHandler, { body: payload, ip: '1.2.3.4' })).statusCode).toBe(200);
    }
    const r = await call(syncHandler, { body: payload, ip: '1.2.3.4' });
    expect(r.statusCode).toBe(429);
    expect(r.headers['retry-after']).toBeTruthy();
    // Otra IP no se ve afectada
    expect((await call(syncHandler, { body: payload, ip: '5.6.7.8' })).statusCode).toBe(200);
  });
});

describe('GET /api/cases', () => {
  it('sin PAHTLI_DASHBOARD_KEY responde modo agregado, sin registros individuales', async () => {
    const r = await call(casesHandler, { method: 'GET' });
    expect(r.statusCode).toBe(200);
    expect(r.body).toMatchObject({ mode: 'aggregate', buckets: [] });
    expect(r.body).not.toHaveProperty('cases');
  });

  it('con PAHTLI_DASHBOARD_KEY exige x-pahtli-key; sin ella 401 sin datos', async () => {
    vi.stubEnv('PAHTLI_DASHBOARD_KEY', 'clave-de-prueba');
    const no = await call(casesHandler, { method: 'GET' });
    expect(no.statusCode).toBe(401);
    expect(no.body).not.toHaveProperty('cases');
    expect(no.body).not.toHaveProperty('buckets');
    expect((await call(casesHandler, { method: 'GET', headers: { 'x-pahtli-key': 'mala' } })).statusCode).toBe(401);
    const ok = await call(casesHandler, { method: 'GET', headers: { 'x-pahtli-key': 'clave-de-prueba' } });
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toMatchObject({ mode: 'records', cases: [] });
  });

  it('rechaza métodos distintos de GET', async () => {
    expect((await call(casesHandler, { method: 'POST' })).statusCode).toBe(405);
  });

  it('aggregate: cuenta por día (hora de México) × comunidad × síndrome × nivel final', () => {
    const rows = [
      { created_at: '2026-10-02T18:00:00Z', comunidad: 'A', syndrome: 'febril', level: 'aqui' },
      { created_at: '2026-10-02T20:00:00Z', comunidad: 'A', syndrome: 'febril', level: 'aqui' },
      // 03:00 UTC del 3-oct = 21:00 del 2-oct en Ciudad de México
      { created_at: '2026-10-03T03:00:00Z', comunidad: 'A', syndrome: 'febril', level: 'centro_hoy', decision_final_level: 'aqui' },
      { created_at: '2026-10-02T18:00:00Z', comunidad: 'B', syndrome: null, level: 'urgencia' },
    ];
    const b = aggregate(rows);
    expect(b).toContainEqual({ day: '2026-10-02', comunidad: 'A', syndrome: 'febril', level: 'aqui', count: 3 });
    expect(b).toContainEqual({ day: '2026-10-02', comunidad: 'B', syndrome: null, level: 'urgencia', count: 1 });
    for (const x of b) expect(Object.keys(x).sort()).toEqual(['comunidad', 'count', 'day', 'level', 'syndrome']);
  });
});
