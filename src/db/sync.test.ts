import { describe, expect, it } from 'vitest';
import { toSyncCase } from './sync';
import { validateBatch } from '../../api/sync';
import { generateSeedCases } from '../surveillance/seed';

describe('contrato cliente -> /api/sync', () => {
  const seed = generateSeedCases();

  it('el payload del cliente pasa la validación del servidor y no incluye transcript', () => {
    const payload = seed.map((c) => toSyncCase({ ...c, transcript: 'Doña María dice que su niño Juan...' }));
    expect(JSON.stringify(payload)).not.toContain('María');
    const v = validateBatch({ cases: payload });
    expect('error' in v).toBe(false);
    if ('error' in v) return;
    expect(v.rejected).toEqual([]);
    expect(v.rows).toHaveLength(seed.length);
  });

  it('rechaza casos inválidos sin tumbar el lote y deduplica case_id', () => {
    const good = toSyncCase(seed[0]);
    const v = validateBatch({ cases: [good, good, { ...good, case_id: 'x' }, { ...good, case_id: crypto.randomUUID(), level: 'grave' }] });
    if ('error' in v) throw new Error(v.error);
    expect(v.rows).toHaveLength(1);
    expect(v.rejected.map((r) => r.error)).toEqual(['case_id inválido', 'level inválido']);
  });

  it('descarta campos no permitidos (privacidad)', () => {
    const v = validateBatch({ cases: [{ ...toSyncCase(seed[0]), transcript: 'nombre', promotora: 'Rosa' }] });
    if ('error' in v) throw new Error(v.error);
    expect(Object.keys(v.rows[0])).not.toContain('transcript');
    expect(Object.keys(v.rows[0])).not.toContain('promotora');
  });

  it('rechaza cuerpo mal formado', () => {
    expect('error' in validateBatch({})).toBe(true);
    expect('error' in validateBatch(null)).toBe(true);
  });
});
