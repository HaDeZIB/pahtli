import { describe, expect, it } from 'vitest';
import type { Syndrome, TriageLevel } from '../types';
import { detectOutbreaks, effectiveLevel, normalizeComunidad, type SurveillanceCase } from './outbreak';
import { generateSeedCases, isSeedCase } from './seed';
import { mergeCases } from './merge';

const NOW = Date.parse('2026-10-04T12:00:00Z');
let n = 0;
function c(hoursAgo: number, comunidad: string, sindrome: Syndrome, level: TriageLevel = 'aqui'): SurveillanceCase {
  n++;
  return {
    case_id: `id-${n}`,
    created_at: new Date(NOW - hoursAgo * 3_600_000).toISOString(),
    comunidad,
    sindrome,
    result: { level },
  };
}

describe('detectOutbreaks', () => {
  it('no alerta con 2 casos respiratorios (umbral 3)', () => {
    expect(detectOutbreaks([c(1, 'A', 'respiratorio'), c(2, 'A', 'respiratorio')], NOW)).toEqual([]);
  });

  it('alerta con 3 casos del mismo síndrome en la misma comunidad en 72 h', () => {
    const a = detectOutbreaks([c(1, 'A', 'respiratorio'), c(30, 'A', 'respiratorio'), c(70, 'A', 'respiratorio')], NOW);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ kind: 'sindrome', syndrome: 'respiratorio', comunidad: 'A', count: 3, threshold: 3, severity: 'media' });
  });

  it('diarrea con sangre y febril hemorrágico alertan desde 2 casos, con severidad alta', () => {
    const a = detectOutbreaks([c(1, 'A', 'diarrea_sangre'), c(5, 'A', 'diarrea_sangre'), c(2, 'B', 'febril_hemorragico'), c(3, 'B', 'febril_hemorragico')], NOW);
    expect(a.map((x) => x.syndrome).sort()).toEqual(['diarrea_sangre', 'febril_hemorragico']);
    expect(a.every((x) => x.severity === 'alta' && x.threshold === 2)).toBe(true);
  });

  it('ignora casos fuera de la ventana de 72 h y del futuro', () => {
    const a = detectOutbreaks([c(1, 'A', 'diarreico'), c(2, 'A', 'diarreico'), c(73, 'A', 'diarreico'), c(-5, 'A', 'diarreico')], NOW);
    expect(a).toEqual([]);
  });

  it('no mezcla comunidades distintas', () => {
    expect(detectOutbreaks([c(1, 'A', 'febril'), c(2, 'B', 'febril'), c(3, 'C', 'febril')], NOW)).toEqual([]);
  });

  it('agrupa nombres de comunidad con distinto acento/mayúsculas/espacios', () => {
    const a = detectOutbreaks([c(1, 'Xiloxóchico', 'febril'), c(2, 'xiloxochico ', 'febril'), c(3, 'XILOXOCHICO', 'febril')], NOW);
    expect(a).toHaveLength(1);
    expect(normalizeComunidad(' San  Andrés ')).toBe('san andres');
  });

  it('deduplica por case_id', () => {
    const x = c(1, 'A', 'diarrea_sangre');
    expect(detectOutbreaks([x, x, { ...x }], NOW)).toEqual([]);
  });

  it('no alerta por síndrome "otro" (inespecífico)', () => {
    expect(detectOutbreaks([c(1, 'A', 'otro'), c(2, 'A', 'otro'), c(3, 'A', 'otro')], NOW)).toEqual([]);
  });

  it('marca racimo de urgencias (>=3 en la comunidad) aunque sean síndromes distintos', () => {
    const a = detectOutbreaks([c(1, 'A', 'trauma', 'urgencia'), c(2, 'A', 'cardiovascular', 'urgencia'), c(3, 'A', 'respiratorio', 'urgencia')], NOW);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ kind: 'urgencias', count: 3, severity: 'alta' });
  });

  it('respeta umbrales y ventana configurables', () => {
    const cases = [c(1, 'A', 'febril'), c(30, 'A', 'febril')];
    expect(detectOutbreaks(cases, NOW, { defaultThreshold: 2 })).toHaveLength(1);
    expect(detectOutbreaks(cases, NOW, { defaultThreshold: 2, windowHours: 24 })).toEqual([]);
  });

  it('ordena alertas de alta severidad primero y reporta primer/último caso', () => {
    const a = detectOutbreaks(
      [c(1, 'A', 'respiratorio'), c(2, 'A', 'respiratorio'), c(3, 'A', 'respiratorio'), c(10, 'B', 'diarrea_sangre'), c(20, 'B', 'diarrea_sangre')],
      new Date(NOW),
    );
    expect(a[0].syndrome).toBe('diarrea_sangre');
    expect(Date.parse(a[0].first_at)).toBeLessThan(Date.parse(a[0].last_at));
    expect(a[0].case_ids).toHaveLength(2);
  });
});

describe('decisión humana (decision.final_level)', () => {
  const dec = (x: SurveillanceCase, final_level: TriageLevel): SurveillanceCase => ({ ...x, decision: { final_level } });

  it('effectiveLevel usa la decisión de la promotora si existe y es válida', () => {
    const x = c(1, 'A', 'trauma', 'aqui');
    expect(effectiveLevel(x)).toBe('aqui');
    expect(effectiveLevel(dec(x, 'urgencia'))).toBe('urgencia');
    expect(effectiveLevel({ ...x, decision: { final_level: 'grave' } })).toBe('aqui');
    expect(effectiveLevel({ ...x, decision: null })).toBe('aqui');
  });

  it('cuenta como urgencia lo que la promotora subió a urgencia', () => {
    const a = detectOutbreaks(
      [dec(c(1, 'A', 'trauma', 'aqui'), 'urgencia'), dec(c(2, 'A', 'cardiovascular', 'centro_hoy'), 'urgencia'), c(3, 'A', 'respiratorio', 'urgencia')],
      NOW,
    );
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ kind: 'urgencias', count: 3 });
  });

  it('no cuenta como urgencia lo que la promotora bajó', () => {
    const a = detectOutbreaks(
      [dec(c(1, 'A', 'trauma', 'urgencia'), 'centro_hoy'), c(2, 'A', 'cardiovascular', 'urgencia'), c(3, 'A', 'respiratorio', 'urgencia')],
      NOW,
    );
    expect(a).toEqual([]);
  });
});

describe('seed de demostración', () => {
  const seed = generateSeedCases(NOW);

  it('tiene ~40 casos en 6 comunidades durante los últimos 7 días', () => {
    expect(seed.length).toBeGreaterThanOrEqual(38);
    expect(new Set(seed.map((s) => s.comunidad)).size).toBe(6);
    for (const s of seed) {
      const age = NOW - Date.parse(s.created_at);
      expect(age).toBeGreaterThan(0);
      expect(age).toBeLessThanOrEqual(7 * 24 * 3_600_000);
      expect(isSeedCase(s.case_id)).toBe(true);
      expect(s.case_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
    expect(new Set(seed.map((s) => s.case_id)).size).toBe(seed.length);
  });

  it('dispara exactamente la alerta deliberada de diarrea con sangre en San Miguel Tzinacapan', () => {
    const a = detectOutbreaks(seed, NOW);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ syndrome: 'diarrea_sangre', comunidad: 'San Miguel Tzinacapan', count: 3 });
  });

  it('mergeCases deduplica entre fuentes', () => {
    const merged = mergeCases(seed, seed.slice(0, 5));
    expect(merged).toHaveLength(seed.length);
    expect(merged[0].created_at >= merged[1].created_at).toBe(true);
  });
});
