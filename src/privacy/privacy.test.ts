import { describe, expect, it } from 'vitest';
import { clearPin, hasPin, LOCK_AFTER_MS, LOCKOUT_MS, MAX_FAILS, setPin, shouldRelock, verifyPin, type KV } from './pin';
import { roundCoord, selectExpired } from './retention';

function memKV(): KV & { dump: () => Record<string, string> } {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

describe('PIN', () => {
  it('guarda solo un hash con sal, nunca el PIN', async () => {
    const kv = memKV();
    await setPin('4821', kv);
    expect(hasPin(kv)).toBe(true);
    const stored = JSON.stringify(kv.dump());
    expect(stored).not.toContain('4821');
    expect(stored).toContain('PBKDF2-SHA-256');
  });

  it('dos PIN iguales dan hashes distintos (sal aleatoria)', async () => {
    const a = memKV(); const b = memKV();
    await setPin('1111', a); await setPin('1111', b);
    expect(a.dump()['pahtli:pin']).not.toEqual(b.dump()['pahtli:pin']);
  });

  it('verifica el correcto y rechaza el incorrecto', async () => {
    const kv = memKV();
    await setPin('2468', kv);
    expect(await verifyPin('2468', kv)).toEqual({ ok: true });
    expect((await verifyPin('1357', kv)).ok).toBe(false);
  });

  it('rechaza PIN que no son 4 números', async () => {
    await expect(setPin('12a4', memKV())).rejects.toThrow();
    await expect(setPin('123', memKV())).rejects.toThrow();
  });

  it(`tras ${MAX_FAILS} intentos fallidos espera ${LOCKOUT_MS / 1000} s`, async () => {
    const kv = memKV();
    await setPin('0000', kv);
    const t0 = 1_000_000;
    let last;
    for (let i = 0; i < MAX_FAILS; i++) last = await verifyPin('9999', kv, t0);
    expect(last).toEqual({ ok: false, waitMs: LOCKOUT_MS });
    // aún bloqueado, incluso con el PIN correcto
    expect((await verifyPin('0000', kv, t0 + 1000)).ok).toBe(false);
    // pasado el tiempo, el correcto entra
    expect(await verifyPin('0000', kv, t0 + LOCKOUT_MS + 1)).toEqual({ ok: true });
  });

  it('sin PIN configurado no bloquea; clearPin lo quita', async () => {
    const kv = memKV();
    expect(await verifyPin('', kv)).toEqual({ ok: true });
    await setPin('1234', kv);
    clearPin(kv);
    expect(hasPin(kv)).toBe(false);
  });

  it('se vuelve a bloquear tras 5 min en segundo plano', () => {
    expect(shouldRelock(null, 10)).toBe(false);
    expect(shouldRelock(0, LOCK_AFTER_MS - 1)).toBe(false);
    expect(shouldRelock(0, LOCK_AFTER_MS)).toBe(true);
  });
});

describe('retención', () => {
  const now = Date.parse('2026-10-03T12:00:00Z');
  const day = 86_400_000;
  const mk = (id: string, ageDays: number, synced: boolean) => ({ case_id: id, created_at: new Date(now - ageDays * day).toISOString(), synced });

  it('solo borra casos ENVIADOS más viejos que N días', () => {
    const cases = [mk('a', 40, true), mk('b', 40, false), mk('c', 10, true), mk('d', 31, true)];
    expect(selectExpired(cases, 30, now).map((c) => c.case_id)).toEqual(['a', 'd']);
  });

  it('no borra casos "enviados" a un servidor de demostración (no se guardaron allá)', () => {
    const cases = [{ ...mk('demo', 400, true), sync_demo: true }, { ...mk('real', 400, true), sync_demo: false }];
    expect(selectExpired(cases, 30, now).map((c) => c.case_id)).toEqual(['real']);
  });

  it('nunca borra pendientes, aunque sean muy viejos', () => {
    expect(selectExpired([mk('x', 400, false)], 7, now)).toEqual([]);
  });

  it('días inválidos no borran nada', () => {
    expect(selectExpired([mk('a', 400, true)], 0, now)).toEqual([]);
  });

  it('redondea coordenadas a ~1 km', () => {
    expect(roundCoord(20.04637)).toBe(20.05);
    expect(roundCoord(-97.51234)).toBe(-97.51);
  });
});
