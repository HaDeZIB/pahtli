/**
 * Evaluación de Pahtli: texto -> keywordExtract -> triage (sin LLM). Funciones puras, sin IO.
 * run-eval.ts hace la lectura/escritura de archivos; cases.test.ts valida el set de casos.
 */
import { keywordExtract, explainKeywords } from '../src/ai/keywords';
import { triage } from '../src/triage/engine';
import { RULES_BY_ID } from '../src/triage/rules';
import { LEVEL_RANK, type Findings, type TriageLevel } from '../src/types';

export const LEVELS: TriageLevel[] = ['aqui', 'centro_hoy', 'urgencia'];
export type Split = 'dev' | 'test';

export interface GoldFindings {
  edad_meses?: number;
  embarazada?: boolean;
  semanas_embarazo?: number;
  resp_por_min?: number;
  temperatura_c?: number;
  duracion_dias?: number;
}

export interface EvalCase {
  id: string;
  split: Split;
  text: string;
  expected_level: TriageLevel;
  expected_rule_ids: string[];
  source_rule: string;
  expected_findings?: GoldFindings;
  tags?: string[];
}

export type Outcome = 'ok' | 'under' | 'over';

export interface FieldCheck {
  field: keyof GoldFindings;
  expected: number | boolean;
  got: number | boolean | undefined;
  ok: boolean;
}

export interface CaseResult {
  id: string;
  split: Split;
  text: string;
  expected_level: TriageLevel;
  predicted_level: TriageLevel;
  outcome: Outcome;
  expected_rule_ids: string[];
  fired_rule_ids: string[];
  missing_rule_ids: string[];
  /** Reglas disparadas con nivel MAYOR al esperado (explican el sobre-triaje). */
  unexpected_higher_rule_ids: string[];
  findings: Findings;
  field_checks: FieldCheck[];
  preguntas: string[];
  /** En un sub-triaje: ¿alguna pregunta de seguimiento pide un dato que necesita una regla esperada que no disparó? */
  followup_asks_missing: boolean;
  reason?: string;
  tags: string[];
  latency_ms: number;
}

export function parseCases(jsonl: string): EvalCase[] {
  return jsonl
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l, i) => {
      try {
        return JSON.parse(l) as EvalCase;
      } catch (e) {
        throw new Error(`cases.jsonl línea ${i + 1}: ${(e as Error).message}`);
      }
    });
}

const AGE_TOL = (m: number) => Math.max(0.25, m * 0.05);

function checkFields(gold: GoldFindings | undefined, f: Findings): FieldCheck[] {
  if (!gold) return [];
  const out: FieldCheck[] = [];
  for (const [k, v] of Object.entries(gold) as [keyof GoldFindings, number | boolean][]) {
    const got = f[k] as number | boolean | undefined;
    let ok: boolean;
    if (typeof v === 'boolean') ok = got === v;
    else if (typeof got !== 'number') ok = false;
    else if (k === 'edad_meses') ok = Math.abs(got - v) <= AGE_TOL(v);
    else if (k === 'temperatura_c') ok = Math.abs(got - v) < 0.05;
    else if (k === 'duracion_dias') ok = Math.abs(got - v) <= Math.max(0.5, v * 0.1);
    else ok = got === v;
    out.push({ field: k, expected: v, got, ok });
  }
  return out;
}

function describeNeeds(ruleId: string, f: Findings): string {
  const r = RULES_BY_ID[ruleId];
  if (!r) return `${ruleId}: regla inexistente`;
  const needs = r.needs ?? [];
  const parts = needs.map((n) => {
    const v = n in f && n !== 'sintomas' ? (f as unknown as Record<string, unknown>)[n] : f.sintomas[n];
    return `${n}=${v === undefined ? '?' : String(v)}`;
  });
  return `${ruleId} [${parts.join(', ')}]`;
}

function explainFailure(c: EvalCase, res: Omit<CaseResult, 'reason'>): string {
  const f = res.findings;
  if (res.outcome === 'under') {
    const misses = res.missing_rule_ids.filter((id) => id !== 'IMCI-NOSIGNS-01');
    const negated = misses.some((id) => (RULES_BY_ID[id]?.needs ?? []).some((n) => f.sintomas[n] === false));
    const kind = negated ? 'negación errónea' : 'extracción incompleta';
    return `SUB-TRIAJE (${kind}): no disparó ${misses.map((id) => describeNeeds(id, f)).join('; ') || '(ninguna regla esperada listada)'}`;
  }
  if (res.outcome === 'over') {
    const why = res.unexpected_higher_rule_ids.map((id) => describeNeeds(id, f)).join('; ');
    const phrases = explainKeywords(c.text)
      .filter((h) => h.polarity === 'pos')
      .map((h) => `"${h.phrase}"→${h.key}`)
      .join(', ');
    return `SOBRE-TRIAJE: disparó ${why}. Frases detectadas: ${phrases || '—'}`;
  }
  return '';
}

export function evaluateCase(c: EvalCase): CaseResult {
  const t0 = performance.now();
  const findings = keywordExtract(c.text);
  const r = triage(findings);
  const latency_ms = performance.now() - t0;
  const fired = r.fired.map((x) => x.id);
  const predicted = r.level;
  const diff = LEVEL_RANK[predicted] - LEVEL_RANK[c.expected_level];
  const outcome: Outcome = diff === 0 ? 'ok' : diff < 0 ? 'under' : 'over';
  const base = {
    id: c.id,
    split: c.split,
    text: c.text,
    expected_level: c.expected_level,
    predicted_level: predicted,
    outcome,
    expected_rule_ids: c.expected_rule_ids,
    fired_rule_ids: fired,
    missing_rule_ids: c.expected_rule_ids.filter((id) => !fired.includes(id)),
    unexpected_higher_rule_ids: r.fired
      .filter((x) => LEVEL_RANK[x.level] > LEVEL_RANK[c.expected_level])
      .map((x) => x.id),
    findings,
    field_checks: checkFields(c.expected_findings, findings),
    preguntas: r.preguntas.map((p) => p.campo),
    followup_asks_missing:
      outcome === 'under' &&
      r.preguntas.some((p) => c.expected_rule_ids.some((id) => !fired.includes(id) && (RULES_BY_ID[id]?.needs ?? []).includes(p.campo))),
    tags: c.tags ?? [],
    latency_ms: Math.round(latency_ms * 100) / 100,
  };
  return { ...base, reason: outcome === 'ok' ? undefined : explainFailure(c, base) };
}

export interface Metrics {
  n: number;
  accuracy: number;
  correct: number;
  /** confusion[expected][predicted] */
  confusion: Record<TriageLevel, Record<TriageLevel, number>>;
  under_triage: { count: number; rate: number };
  over_triage: { count: number; rate: number };
  /** Casos 'urgencia' clasificados por debajo: LA métrica crítica. */
  urgencia_under_triage: { count: number; of: number; rate: number };
  /** Urgencias sub-triadas en las que la app TAMPOCO pregunta el dato faltante (no hay rescate posible). */
  urgencia_under_no_followup: { count: number; of: number; rate: number };
  /** Sensibilidad para "necesita salir de la comunidad" (centro_hoy o urgencia). */
  referral_sensitivity: { hits: number; of: number; rate: number };
  /** Casos donde TODAS las reglas esperadas dispararon. */
  rule_recall: { hits: number; of: number; rate: number };
  per_level: Record<TriageLevel, { n: number; recall: number; precision: number }>;
  fields: Record<string, { ok: number; of: number; rate: number }>;
  latency_ms: { mean: number; p95: number; max: number };
}

const rate = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 1000) / 1000);

export function computeMetrics(rows: CaseResult[]): Metrics {
  const confusion = Object.fromEntries(LEVELS.map((e) => [e, Object.fromEntries(LEVELS.map((p) => [p, 0]))])) as Metrics['confusion'];
  for (const r of rows) confusion[r.expected_level][r.predicted_level]++;
  const correct = rows.filter((r) => r.outcome === 'ok').length;
  const under = rows.filter((r) => r.outcome === 'under').length;
  const over = rows.filter((r) => r.outcome === 'over').length;
  const urg = rows.filter((r) => r.expected_level === 'urgencia');
  const urgUnder = urg.filter((r) => r.predicted_level !== 'urgencia').length;
  const urgUnderNoQ = urg.filter((r) => r.predicted_level !== 'urgencia' && !r.followup_asks_missing).length;
  const ref = rows.filter((r) => r.expected_level !== 'aqui');
  const refHits = ref.filter((r) => r.predicted_level !== 'aqui').length;
  const ruleCases = rows.filter((r) => r.expected_rule_ids.length > 0);
  const ruleHits = ruleCases.filter((r) => r.missing_rule_ids.length === 0).length;

  const per_level = Object.fromEntries(
    LEVELS.map((l) => {
      const exp = rows.filter((r) => r.expected_level === l);
      const pred = rows.filter((r) => r.predicted_level === l);
      const tp = exp.filter((r) => r.predicted_level === l).length;
      return [l, { n: exp.length, recall: rate(tp, exp.length), precision: rate(tp, pred.length) }];
    }),
  ) as Metrics['per_level'];

  const fields: Metrics['fields'] = {};
  for (const r of rows) {
    for (const fc of r.field_checks) {
      const k = String(fc.field);
      fields[k] ??= { ok: 0, of: 0, rate: 0 };
      fields[k].of++;
      if (fc.ok) fields[k].ok++;
    }
  }
  for (const v of Object.values(fields)) v.rate = rate(v.ok, v.of);

  const lat = rows.map((r) => r.latency_ms).sort((a, b) => a - b);
  const mean = lat.length ? lat.reduce((a, b) => a + b, 0) / lat.length : 0;
  return {
    n: rows.length,
    accuracy: rate(correct, rows.length),
    correct,
    confusion,
    under_triage: { count: under, rate: rate(under, rows.length) },
    over_triage: { count: over, rate: rate(over, rows.length) },
    urgencia_under_triage: { count: urgUnder, of: urg.length, rate: rate(urgUnder, urg.length) },
    urgencia_under_no_followup: { count: urgUnderNoQ, of: urg.length, rate: rate(urgUnderNoQ, urg.length) },
    referral_sensitivity: { hits: refHits, of: ref.length, rate: rate(refHits, ref.length) },
    rule_recall: { hits: ruleHits, of: ruleCases.length, rate: rate(ruleHits, ruleCases.length) },
    per_level,
    fields,
    latency_ms: {
      mean: Math.round(mean * 100) / 100,
      p95: lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * 0.95))] : 0,
      max: lat.length ? lat[lat.length - 1] : 0,
    },
  };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const LABEL: Record<TriageLevel, string> = { aqui: 'aquí', centro_hoy: 'centro hoy', urgencia: 'urgencia' };

function confusionTable(m: Metrics): string {
  const head = `| esperado \\ predicho | ${LEVELS.map((l) => LABEL[l]).join(' | ')} |\n|---|${LEVELS.map(() => '---:').join('|')}|`;
  const body = LEVELS.map((e) => `| **${LABEL[e]}** | ${LEVELS.map((p) => (e === p ? `**${m.confusion[e][p]}**` : String(m.confusion[e][p]))).join(' | ')} |`).join('\n');
  return `${head}\n${body}`;
}

export function renderMarkdown(rows: CaseResult[], bySplit: Record<string, Metrics>, generatedAt: string): string {
  const splits = Object.keys(bySplit);
  const L: string[] = [];
  L.push('# Resultados de la evaluación de Pahtli');
  L.push('');
  L.push(`> Generado por \`npm run eval\` el ${generatedAt}. Pipeline: texto → \`keywordExtract\` → \`triage\` (Node, sin LLM).`);
  L.push('> Viñetas sintéticas escritas por el equipo, **pendientes de validación clínica por la Dra. Ines**. El split `test` se escribió primero y no se usó para ajustar nada.');
  L.push('');
  L.push('## Métricas');
  L.push('');
  L.push(`| Métrica | ${splits.join(' | ')} |`);
  L.push(`|---|${splits.map(() => '---:').join('|')}|`);
  const row = (name: string, f: (m: Metrics) => string) => L.push(`| ${name} | ${splits.map((s) => f(bySplit[s])).join(' | ')} |`);
  row('Casos', (m) => String(m.n));
  row('Exactitud (nivel exacto)', (m) => `${pct(m.accuracy)} (${m.correct}/${m.n})`);
  row('**Sub-triaje de urgencias** (urgencia → menor)', (m) => `**${pct(m.urgencia_under_triage.rate)}** (${m.urgencia_under_triage.count}/${m.urgencia_under_triage.of})`);
  row('…de ellas, sin pregunta de seguimiento que lo rescate', (m) => `${pct(m.urgencia_under_no_followup.rate)} (${m.urgencia_under_no_followup.count}/${m.urgencia_under_no_followup.of})`);
  row('Sub-triaje total (cualquier nivel → menor)', (m) => `${pct(m.under_triage.rate)} (${m.under_triage.count}/${m.n})`);
  row('Sobre-triaje total', (m) => `${pct(m.over_triage.rate)} (${m.over_triage.count}/${m.n})`);
  row('Sensibilidad de referencia (centro/urgencia ≠ aquí)', (m) => `${pct(m.referral_sensitivity.rate)} (${m.referral_sensitivity.hits}/${m.referral_sensitivity.of})`);
  row('Reglas esperadas que dispararon (todas)', (m) => `${pct(m.rule_recall.rate)} (${m.rule_recall.hits}/${m.rule_recall.of})`);
  for (const l of LEVELS) row(`Recall / precisión \`${l}\``, (m) => `${pct(m.per_level[l].recall)} / ${pct(m.per_level[l].precision)}`);
  row('Latencia extracción+triaje (media / p95, ms)', (m) => `${m.latency_ms.mean} / ${m.latency_ms.p95}`);
  L.push('');
  for (const s of splits) {
    L.push(`### Matriz de confusión — ${s}`);
    L.push('');
    L.push(confusionTable(bySplit[s]));
    L.push('');
  }
  L.push('## Extracción por campo (contra valores de referencia anotados en `expected_findings`)');
  L.push('');
  L.push(`| Campo | ${splits.join(' | ')} |`);
  L.push(`|---|${splits.map(() => '---:').join('|')}|`);
  const fieldNames = [...new Set(splits.flatMap((s) => Object.keys(bySplit[s].fields)))].sort();
  for (const k of fieldNames) {
    L.push(`| \`${k}\` | ${splits.map((s) => { const v = bySplit[s].fields[k]; return v ? `${pct(v.rate)} (${v.ok}/${v.of})` : '—'; }).join(' | ')} |`);
  }
  L.push('');
  const fieldMisses = rows.flatMap((r) => r.field_checks.filter((fc) => !fc.ok).map((fc) => `| ${r.id} | ${r.split} | \`${String(fc.field)}\` | ${fc.expected} | ${fc.got === undefined ? '—' : fc.got} |`));
  if (fieldMisses.length) {
    L.push('Errores de campo:');
    L.push('');
    L.push('| Caso | Split | Campo | Esperado | Extraído |');
    L.push('|---|---|---|---|---|');
    L.push(...fieldMisses);
    L.push('');
  }
  L.push('## Fallos de nivel');
  L.push('');
  const fails = rows.filter((r) => r.outcome !== 'ok');
  if (!fails.length) L.push('Ninguno.');
  for (const r of fails.sort((a, b) => (a.outcome === b.outcome ? a.id.localeCompare(b.id) : a.outcome === 'under' ? -1 : 1))) {
    L.push(`- **${r.id}** (${r.split}) esperado \`${r.expected_level}\`, predicho \`${r.predicted_level}\` — ${r.reason}`);
    L.push(`  - Texto: "${r.text}"`);
    L.push(`  - Reglas disparadas: ${r.fired_rule_ids.join(', ')}${r.preguntas.length ? ` · preguntas de seguimiento: ${r.preguntas.join(', ')}` : ''}${r.outcome === 'under' ? (r.followup_asks_missing ? ' · **la app pregunta el dato faltante**' : ' · la app NO pregunta el dato faltante') : ''}`);
  }
  L.push('');
  return L.join('\n');
}
