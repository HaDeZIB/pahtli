import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RULES_BY_ID } from '../src/triage/rules';
import { LEVEL_RANK } from '../src/types';
import { computeMetrics, evaluateCase, LEVELS, parseCases } from './lib';

const here = dirname(fileURLToPath(import.meta.url));
const cases = parseCases(readFileSync(join(here, 'cases.jsonl'), 'utf8'));

describe('eval/cases.jsonl', () => {
  it('tiene 90 casos: 60 dev y 30 test, ids únicos', () => {
    expect(cases).toHaveLength(90);
    expect(cases.filter((c) => c.split === 'dev')).toHaveLength(60);
    expect(cases.filter((c) => c.split === 'test')).toHaveLength(30);
    expect(new Set(cases.map((c) => c.id)).size).toBe(90);
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

  // Guardia de regresión: el split dev se usó para ajustar sinónimos; ninguna urgencia dev debe bajar de nivel.
  it('dev: cero urgencias sub-triadas (keywordExtract -> triage)', () => {
    const m = computeMetrics(cases.filter((c) => c.split === 'dev').map(evaluateCase));
    expect(m.urgencia_under_triage.count).toBe(0);
  });
});
