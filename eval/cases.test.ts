import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RULES_BY_ID } from '../src/triage/rules';
import { LEVEL_RANK } from '../src/types';
import { computeMetrics, evaluateCase, goldFindings, LEVELS, parseCases, wilson } from './lib';
import { triage } from '../src/triage/engine';

const here = dirname(fileURLToPath(import.meta.url));
const cases = parseCases(readFileSync(join(here, 'cases.jsonl'), 'utf8'));

describe('eval/cases.jsonl', () => {
  it('tiene 130 casos: 60 dev, 30 test_v1 y 40 test_v2, ids únicos', () => {
    expect(cases).toHaveLength(130);
    expect(cases.filter((c) => c.split === 'dev')).toHaveLength(60);
    expect(cases.filter((c) => c.split === 'test_v1')).toHaveLength(30);
    expect(cases.filter((c) => c.split === 'test_v2')).toHaveLength(40);
    expect(new Set(cases.map((c) => c.id)).size).toBe(130);
  });

  it('test_v2 sigue congelado (mismo contenido que al escribirlo, antes de los cambios al extractor)', async () => {
    const { createHash } = await import('node:crypto');
    const lines = readFileSync(join(here, 'cases.jsonl'), 'utf8').split('\n').filter((l) => l.includes('"split":"test_v2"'));
    const sha = createHash('sha256').update(lines.join('\n') + '\n').digest('hex');
    expect(sha).toBe('6e16a1af2424b6e4efc39f722893f0c9c3e30594f0b9023c084a432901d736d5');
  });

  it('test_v2: con los hallazgos anotados, el motor da el nivel esperado (las etiquetas son coherentes con las reglas)', () => {
    for (const c of cases.filter((x) => x.split === 'test_v2')) {
      const g = goldFindings(c);
      if (!g) continue;
      expect(triage(g).level, c.id).toBe(c.expected_level);
    }
  });

  it('expected_ask solo aparece en casos expected_uncertain', () => {
    for (const c of cases) if (c.expected_ask) expect(c.expected_uncertain, c.id).toBe(true);
  });

  it('distribución ~35% urgencia / ~35% centro_hoy / ~30% aquí', () => {
    for (const l of LEVELS) {
      const share = cases.filter((c) => c.expected_level === l).length / cases.length;
      expect(share).toBeGreaterThan(0.25);
      expect(share).toBeLessThan(0.4);
    }
  });

  it('cada caso tiene texto, fuente y reglas esperadas que existen en el motor', () => {
    for (const c of cases) {
      expect(c.text.length, c.id).toBeGreaterThan(10);
      expect(c.source_rule.length, c.id).toBeGreaterThan(5);
      expect(c.expected_rule_ids.length, c.id).toBeGreaterThan(0);
      for (const id of c.expected_rule_ids) expect(RULES_BY_ID[id], `${c.id}: ${id}`).toBeDefined();
    }
  });

  it('el nivel esperado coincide con la regla esperada de mayor nivel', () => {
    for (const c of cases) {
      const top = Math.max(...c.expected_rule_ids.map((id) => LEVEL_RANK[RULES_BY_ID[id].level]));
      expect(top, c.id).toBe(LEVEL_RANK[c.expected_level]);
    }
  });
});

describe('métricas', () => {
  it('cuenta sub- y sobre-triaje en la matriz de confusión', () => {
    const rows = cases.slice(0, 5).map(evaluateCase);
    const m = computeMetrics(rows);
    const total = LEVELS.reduce((a, e) => a + LEVELS.reduce((b, p) => b + m.confusion[e][p], 0), 0);
    expect(total).toBe(5);
    expect(m.correct + m.under_triage.count + m.over_triage.count).toBe(5);
  });

  it('IC de Wilson', () => {
    expect(wilson(0, 22)).toEqual([0, 0.149]);
    expect(wilson(2, 11)[0]).toBeCloseTo(0.051, 2);
    expect(wilson(2, 11)[1]).toBeCloseTo(0.477, 2);
  });

  // Guardia de regresión: el split dev se usó para ajustar sinónimos; ninguna urgencia dev debe bajar de nivel.
  it('dev: cero urgencias sub-triadas (keywordExtract -> triage)', () => {
    const m = computeMetrics(cases.filter((c) => c.split === 'dev').map(evaluateCase));
    expect(m.urgencia_under_triage.count).toBe(0);
  });

  // test_v1 se vio y sus fallos se corrigieron de forma general en la ronda 2: ahora es regresión.
  // test_v2 (held-out vigente) NO tiene guardia a propósito: ponerle una invitaría a ajustar sobre él.
  it('test_v1 (regresión): cero urgencias sub-triadas', () => {
    const m = computeMetrics(cases.filter((c) => c.split === 'test_v1').map(evaluateCase));
    expect(m.urgencia_under_triage.count).toBe(0);
  });
});
