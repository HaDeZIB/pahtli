import { describe, expect, it } from 'vitest';
import { coarseAgeMonths, toSyncCase, uncertaintyCode } from './sync';
import { assessUncertainty } from '../triage/uncertainty';
import { MAX_BATCH, validateBatch, validateCase } from '../../api/sync';
import { generateSeedCases } from '../surveillance/seed';
import type { CaseRecord } from '../types';

describe('contrato cliente -> /api/sync', () => {
  const seed = generateSeedCases();

  it('el payload del cliente pasa la validación estricta del servidor y no incluye transcript', () => {
    const payload = seed.map((c) => toSyncCase({ ...c, transcript: 'Doña María dice que su niño Juan...' }));
    expect(JSON.stringify(payload)).not.toContain('María');
    expect(JSON.stringify(payload)).not.toContain('transcript');
    const v = validateBatch({ cases: payload });
    expect('error' in v).toBe(false);
    if ('error' in v) return;
    expect(v.rejected).toEqual([]);
    expect(v.rows).toHaveLength(seed.length);
  });

  it('minimiza: coordenadas a 2 decimales, edad gruesa desde 2 años, sin campos extra en findings', () => {
    const base = seed[0];
    const c = {
      ...base,
      lat: 20.030612,
      lng: -97.540649,
      findings: { ...base.findings, edad_meses: 31 * 12 + 7, nombre: 'Juan', fecha_nacimiento: '1995-03-02' },
      promotora: 'Rosa',
    } as unknown as CaseRecord;
    const s = toSyncCase(c);
    expect(s.lat).toBe(20.03);
    expect(s.lng).toBe(-97.54);
    expect(s.findings.edad_meses).toBe(31 * 12);
    expect(Object.keys(s.findings)).not.toContain('nombre');
    expect(Object.keys(s.findings)).not.toContain('fecha_nacimiento');
    expect(JSON.stringify(s)).not.toContain('Rosa');
    expect(validateCase(s).ok).toBe(true);
  });

  it('edad: meses exactos en menores de 2 años', () => {
    expect(coarseAgeMonths(7)).toBe(7);
    expect(coarseAgeMonths(23.9)).toBe(23);
    expect(coarseAgeMonths(25)).toBe(24);
    expect(coarseAgeMonths(59)).toBe(48);
  });

  it('incluye decisión e incertidumbre si existen; descarta motivo en texto libre', () => {
    const c = {
      ...seed[0],
      decision: { final_level: 'urgencia', overridden: true, reason: 'La mamá de Juan dice que empeoró', note: 'Juan, casa azul', decided_at: '2026-10-03T10:00:00Z' },
      uncertain: true,
      uncertainty_reasons: ['Falta la edad y el resultado podría cambiar con ella.', 'Respondiste “No sé” a: ¿Juan tiene fiebre?', 'texto raro con nombre Juan'],
    } as unknown as CaseRecord;
    const s = toSyncCase(c);
    expect(s.decision).toEqual({ final_level: 'urgencia', overridden: true });
    expect(s.uncertain).toBe(true);
    expect(s.uncertainty_reasons).toEqual(['age_missing', 'answered_unknown', 'otro']);
    expect(JSON.stringify(s)).not.toContain('Juan');
    const v = validateCase(s);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.row.decision_final_level).toBe('urgencia');
      expect(v.row.decision_overridden).toBe(true);
      expect(v.row.uncertain).toBe(true);
    }
    // Con código corto el motivo sí viaja
    const s2 = toSyncCase({ ...c, decision: { final_level: 'aqui', overridden: true, reason: 'ya_mejoro' } } as unknown as CaseRecord);
    expect(s2.decision?.reason).toBe('ya_mejoro');
  });

  it('prefiere los códigos guardados (uncertainty_codes) sobre las frases', () => {
    const c = { ...seed[0], uncertain: true, uncertainty_reasons: ['Frase reescrita por alguien'], uncertainty_codes: ['questions_pending', 'young_infant_few'] } as unknown as CaseRecord;
    expect(toSyncCase(c).uncertainty_reasons).toEqual(['questions_pending', 'young_infant_few']);
  });

  it('cada motivo que produce assessUncertainty se traduce a su código (no a "otro")', () => {
    const base = { level: 'aqui' as const, fired: [], escalated_by_model: false };
    const q = { campo: 'tiraje', tipo: 'si_no' as const, pregunta: { es: '¿Se le hunde el pecho?', nah: '' }, porque: 'x' };
    const u = assessUncertainty({
      transcript: 'mmm',
      extraction: null,
      triageResult: { ...base, preguntas: [q] },
      answeredQuestions: [{ campo: 'fiebre', known: false, pregunta: '¿Tiene calentura?' }],
      findings: { edad_meses: 1, sintomas: {} },
    });
    expect(u.codes.length).toBeGreaterThanOrEqual(4);
    expect(u.reasons.map(uncertaintyCode)).toEqual(u.codes);
  });

  it('uncertaintyCode mapea frases conocidas y deja pasar códigos', () => {
    expect(uncertaintyCode('La IA y las palabras clave no coinciden en un signo de alarma.')).toBe('llm_disagree');
    expect(uncertaintyCode('no_findings')).toBe('no_findings');
    expect(uncertaintyCode('Algo nuevo')).toBe('otro');
  });

  it('sin campos opcionales, el payload no los inventa', () => {
    const s = toSyncCase(seed[0]);
    expect('decision' in s).toBe(false);
    expect('uncertain' in s).toBe(false);
  });

  it('rechaza casos inválidos sin tumbar el lote y deduplica case_id', () => {
    const good = toSyncCase(seed[0]);
    const v = validateBatch({ cases: [good, good, { ...good, case_id: 'x' }, { ...good, case_id: crypto.randomUUID(), level: 'grave' }] });
    if ('error' in v) throw new Error(v.error);
    expect(v.rows).toHaveLength(1);
    expect(v.rejected.map((r) => r.error)).toEqual(['case_id inválido', 'level inválido']);
  });

  it('rechaza campos desconocidos (esquema estricto, privacidad)', () => {
    const good = toSyncCase(seed[0]);
    expect(validateCase({ ...good, transcript: 'nombre' })).toEqual({ ok: false, error: 'campo no permitido (transcript)' });
    expect(validateCase({ ...good, promotora: 'Rosa' }).ok).toBe(false);
    expect(validateCase({ ...good, findings: { ...good.findings, nombre: 'Juan' } }).ok).toBe(false);
    expect(validateCase({ ...good, decision: { final_level: 'aqui', overridden: false, nota: 'x' } }).ok).toBe(false);
    expect(validateCase({ ...good, decision: { final_level: 'aqui', overridden: true, reason: 'texto libre con espacios' } }).ok).toBe(false);
    expect('error' in validateBatch({ cases: [], extra: 1 })).toBe(true);
  });

  it('acota valores (clamp) y redondea coordenadas en el servidor', () => {
    const good = toSyncCase(seed[0]);
    const v = validateCase({
      ...good,
      lat: 20.123456,
      lng: -97.987654,
      findings: { ...good.findings, temperatura_c: 52, resp_por_min: 999, edad_meses: -3, duracion_dias: 4000 },
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.row.lat).toBe(20.12);
    expect(v.row.lng).toBe(-97.99);
    expect(v.row.findings).toMatchObject({ temperatura_c: 45, resp_por_min: 150, edad_meses: 0, duracion_dias: 365 });
    expect(validateCase({ ...good, findings: { ...good.findings, temperatura_c: '38' } }).ok).toBe(false);
    expect(validateCase({ ...good, findings: { sintomas: { tos: 'si' } } }).ok).toBe(false);
    expect(validateCase({ ...good, lat: 'x' }).ok).toBe(false);
  });

  it('rechaza lotes de más de 200 casos y cuerpos mal formados', () => {
    expect(MAX_BATCH).toBe(200);
    const good = toSyncCase(seed[0]);
    expect('error' in validateBatch({ cases: Array.from({ length: 201 }, () => good) })).toBe(true);
    expect('error' in validateBatch({})).toBe(true);
    expect('error' in validateBatch(null)).toBe(true);
  });
});
