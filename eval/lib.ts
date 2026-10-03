/**
 * Evaluación de Pahtli: texto -> keywordExtract -> triage (sin LLM). Funciones puras, sin IO.
 * run-eval.ts hace la lectura/escritura de archivos; cases.test.ts valida el set de casos.
 */
import { keywordExtract, explainKeywords } from '../src/ai/keywords';
import { triage } from '../src/triage/engine';
import { assessUncertainty, MAX_FOLLOWUP_QUESTIONS, type AnsweredQuestion } from '../src/triage/uncertainty';
import { RULES_BY_ID } from '../src/triage/rules';
import { LEVEL_RANK, type Findings, type TriageLevel, type TriageResult } from '../src/types';

export const LEVELS: TriageLevel[] = ['aqui', 'centro_hoy', 'urgencia'];
/**
 * dev: se usó para ajustar el extractor. test_v1: el held-out original (30), ya visto y usado para
 * arreglar fallos generales en la ronda 2 → ahora es solo regresión. test_v2: held-out nuevo (40),
 * escrito y congelado ANTES de cambiar el extractor en la ronda 2 (ver docs/eval.md).
 */
export type Split = 'dev' | 'test_v1' | 'test_v2';
export const SPLITS: Split[] = ['dev', 'test_v1', 'test_v2'];

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
  /**
   * Síntomas anotados (referencia). Clave "a|b" = basta con cualquiera de las dos.
   * true = debe extraerse afirmado; false = debe extraerse negado.
   */
  expected_sintomas?: Record<string, boolean>;
  /**
   * El relato no trae un dato que podría SUBIR el nivel (p. ej. no se sabe si viven lejos, falta la edad o el
   * conteo de respiraciones). Lo correcto es avisar / preguntar, no aparentar seguridad.
   */
  expected_uncertain?: boolean;
  /** Campos que, idealmente, la app debería preguntar en un caso expected_uncertain. */
  expected_ask?: string[];
  tags?: string[];
}

export interface SymptomCheck {
  key: string;
  expected: boolean;
  got: boolean | undefined;
  ok: boolean;
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
  /** Fail-safe "No estoy segura — consulta al personal de salud" (src/triage/uncertainty.ts). */
  uncertain: boolean;
  uncertainty_codes: string[];
  /** Fail-safe si la promotora contesta las preguntas como en la app (hasta 4, ver simulateFollowUp). */
  uncertain_if_answered: boolean;
  expected_uncertain: boolean;
  /** En un caso expected_uncertain: ¿alguna pregunta pide uno de expected_ask? */
  asks_expected: boolean;
  symptom_checks: SymptomCheck[];
  /** Nivel que da el motor con los hallazgos ANOTADOS (extracción perfecta). Solo si hay expected_sintomas. */
  gold_level?: TriageLevel;
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

function checkSymptoms(gold: Record<string, boolean> | undefined, f: Findings): SymptomCheck[] {
  if (!gold) return [];
  return Object.entries(gold).map(([k, v]) => {
    const keys = k.split('|');
    const vals = keys.map((x) => f.sintomas[x]);
    const ok = vals.some((x) => x === v);
    const got = ok ? v : vals.find((x) => x !== undefined);
    return { key: k, expected: v, got, ok };
  });
}

/** Hallazgos de referencia: expected_findings + expected_sintomas (primera alternativa de cada "a|b"). */
export function goldFindings(c: EvalCase): Findings | undefined {
  if (!c.expected_sintomas) return undefined;
  const f: Findings = { sintomas: {}, ...(c.expected_findings ?? {}) };
  for (const [k, v] of Object.entries(c.expected_sintomas)) f.sintomas[k.split('|')[0]] = v;
  return f;
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

const NUMERIC_FIELDS = new Set(['edad_meses', 'semanas_embarazo', 'duracion_dias', 'temperatura_c', 'resp_por_min']);

/**
 * Simula la pantalla de preguntas de la app (src/screens/FollowUp.tsx): contesta hasta MAX_FOLLOWUP_QUESTIONS,
 * re-triando después de cada respuesta. Sí/No: el valor anotado si existe, si no "No". Números: el anotado si
 * existe, si no "No sé". Solo sirve para medir el ruido del aviso en el flujo real; no cambia la exactitud.
 */
function simulateFollowUp(c: EvalCase, findings: Findings): { findings: Findings; result: TriageResult; answered: AnsweredQuestion[] } {
  const gold = goldFindings(c);
  let f: Findings = { ...findings, sintomas: { ...findings.sintomas } };
  let r = triage(f);
  const answered: AnsweredQuestion[] = [];
  while (answered.length < MAX_FOLLOWUP_QUESTIONS) {
    const q = r.preguntas.find((p) => !answered.some((a) => a.campo === p.campo));
    if (!q) break;
    f = { ...f, sintomas: { ...f.sintomas } };
    if (NUMERIC_FIELDS.has(q.campo) && q.tipo !== 'si_no') {
      const v = (gold as unknown as Record<string, unknown> | undefined)?.[q.campo] ?? (c.expected_findings as Record<string, unknown> | undefined)?.[q.campo];
      if (typeof v === 'number') { (f as unknown as Record<string, unknown>)[q.campo] = v; answered.push({ campo: q.campo, known: true }); }
      else answered.push({ campo: q.campo, known: false });
    } else if (q.campo === 'embarazada') {
      f.embarazada = gold?.embarazada ?? false;
      answered.push({ campo: q.campo, known: true });
    } else {
      f.sintomas[q.campo] = gold?.sintomas[q.campo] ?? false;
      answered.push({ campo: q.campo, known: true });
    }
    r = triage(f);
  }
  return { findings: f, result: r, answered };
}

export function evaluateCase(c: EvalCase): CaseResult {
  const t0 = performance.now();
  const findings = keywordExtract(c.text);
  const r = triage(findings);
  const latency_ms = performance.now() - t0;
  const fired = r.fired.map((x) => x.id);
  const predicted = r.level;
  let unc = { uncertain: false, codes: [] as string[], ifAnswered: false };
  try {
    const extraction = { findings, method: 'keywords' as const, latency_ms: 0 };
    const u = assessUncertainty({ transcript: c.text, extraction, triageResult: r, findings });
    const sim = simulateFollowUp(c, findings);
    const ua = assessUncertainty({ transcript: c.text, extraction, triageResult: sim.result, findings: sim.findings, answeredQuestions: sim.answered });
    unc = { uncertain: u.uncertain, codes: u.codes, ifAnswered: ua.uncertain };
  } catch {
    /* el módulo de incertidumbre es de otro equipo; si falla, se reporta como "no avisó" */
  }
  const gold = goldFindings(c);
  const asked = r.preguntas.map((p) => p.campo);
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
    uncertain: unc.uncertain,
    uncertainty_codes: unc.codes,
    uncertain_if_answered: unc.ifAnswered,
    expected_uncertain: c.expected_uncertain === true,
    asks_expected: c.expected_uncertain === true && (c.expected_ask ?? []).some((x) => asked.includes(x)),
    symptom_checks: checkSymptoms(c.expected_sintomas, findings),
    gold_level: gold ? triage(gold).level : undefined,
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
  /** IC 95 % de Wilson. */
  ci: { accuracy: [number, number]; urgencia_under_triage: [number, number]; referral_sensitivity: [number, number] };
  /** Urgencias sub-triadas SIN ninguna señal: ni pregunta de seguimiento ni fail-safe "no estoy segura". */
  urgencia_under_silent: { count: number; of: number };
  /** Síntomas anotados extraídos con la polaridad correcta (solo casos con expected_sintomas). */
  symptoms: { ok: number; of: number; rate: number; pos_ok: number; pos_of: number; neg_ok: number; neg_of: number };
  /** Casos expected_uncertain: cuántos muestran el fail-safe / preguntan algo / preguntan el dato esperado. */
  uncertain_cases: { of: number; flagged: number; asks_any: number; asks_expected: number };
  /** Fail-safe "no estoy segura" en casos NO marcados expected_uncertain (ruido / fatiga de alertas). */
  flagged_without_need: { count: number; of: number };
  /** Igual, pero si la promotora contesta las preguntas de seguimiento (en vez de "Saltar"). */
  flagged_without_need_answered: { count: number; of: number };
  /** Exactitud del motor con los hallazgos anotados (extracción perfecta). Separa errores de extracción de errores de reglas. */
  gold_accuracy?: { correct: number; of: number; rate: number };
}

/** Intervalo de confianza de Wilson al 95 % para x/n, en proporción [0,1]. */
export function wilson(x: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 0];
  const p = x / n;
  const den = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  return [r3(Math.max(0, center - half)), r3(Math.min(1, center + half))];
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

  const sc = rows.flatMap((r) => r.symptom_checks);
  const posC = sc.filter((x) => x.expected === true);
  const negC = sc.filter((x) => x.expected === false);
  const unc = rows.filter((r) => r.expected_uncertain);
  const notUnc = rows.filter((r) => !r.expected_uncertain);
  const goldRows = rows.filter((r) => r.gold_level !== undefined);
  const goldOk = goldRows.filter((r) => r.gold_level === r.expected_level).length;
  const urgSilent = urg.filter((r) => r.predicted_level !== 'urgencia' && !r.uncertain && r.preguntas.length === 0).length;

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
    ci: {
      accuracy: wilson(correct, rows.length),
      urgencia_under_triage: wilson(urgUnder, urg.length),
      referral_sensitivity: wilson(refHits, ref.length),
    },
    urgencia_under_silent: { count: urgSilent, of: urg.length },
    symptoms: {
      ok: sc.filter((x) => x.ok).length,
      of: sc.length,
      rate: rate(sc.filter((x) => x.ok).length, sc.length),
      pos_ok: posC.filter((x) => x.ok).length,
      pos_of: posC.length,
      neg_ok: negC.filter((x) => x.ok).length,
      neg_of: negC.length,
    },
    uncertain_cases: {
      of: unc.length,
      flagged: unc.filter((r) => r.uncertain).length,
      asks_any: unc.filter((r) => r.preguntas.length > 0).length,
      asks_expected: unc.filter((r) => r.asks_expected).length,
    },
    flagged_without_need: { count: notUnc.filter((r) => r.uncertain).length, of: notUnc.length },
    flagged_without_need_answered: { count: notUnc.filter((r) => r.uncertain_if_answered).length, of: notUnc.length },
    ...(goldRows.length ? { gold_accuracy: { correct: goldOk, of: goldRows.length, rate: rate(goldOk, goldRows.length) } } : {}),
  };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const LABEL: Record<TriageLevel, string> = { aqui: 'aquí', centro_hoy: 'centro hoy', urgencia: 'urgencia' };

function confusionTable(m: Metrics): string {
  const head = `| esperado \\ predicho | ${LEVELS.map((l) => LABEL[l]).join(' | ')} |\n|---|${LEVELS.map(() => '---:').join('|')}|`;
  const body = LEVELS.map((e) => `| **${LABEL[e]}** | ${LEVELS.map((p) => (e === p ? `**${m.confusion[e][p]}**` : String(m.confusion[e][p]))).join(' | ')} |`).join('\n');
  return `${head}\n${body}`;
}

const ci = (c: [number, number]) => `IC95 ${(c[0] * 100).toFixed(0)}–${(c[1] * 100).toFixed(0)} %`;

export interface RenderOptions {
  /** Splits cuyos fallos por caso NO se imprimen (para no mirar el held-out antes de tiempo). */
  hideFailuresFor?: string[];
}

export function renderMarkdown(rows: CaseResult[], bySplit: Record<string, Metrics>, generatedAt: string, opts: RenderOptions = {}): string {
  const splits = Object.keys(bySplit);
  const L: string[] = [];
  L.push('# Resultados de la evaluación de Pahtli');
  L.push('');
  L.push(`> Generado por \`npm run eval\` el ${generatedAt}. Pipeline: texto → \`keywordExtract\` → \`triage\` (Node, sin LLM) + fail-safe \`assessUncertainty\`.`);
  L.push('> Viñetas sintéticas escritas por el equipo, **pendientes de validación clínica por la Dra. Ines**.');
  L.push('> `dev` se usó para ajustar. `test_v1` (held-out original) ya se vio y se usó en la ronda 2: ahora es solo regresión. **`test_v2` es el held-out vigente**: se escribió y congeló antes de los cambios de la ronda 2.');
  L.push('');
  L.push('## Métricas');
  L.push('');
  L.push(`| Métrica | ${splits.join(' | ')} |`);
  L.push(`|---|${splits.map(() => '---:').join('|')}|`);
  const row = (name: string, f: (m: Metrics) => string) => L.push(`| ${name} | ${splits.map((s) => f(bySplit[s])).join(' | ')} |`);
  row('Casos', (m) => String(m.n));
  row('Exactitud (nivel exacto)', (m) => `${pct(m.accuracy)} (${m.correct}/${m.n}), ${ci(m.ci.accuracy)}`);
  row('**Sub-triaje de urgencias** (urgencia → menor)', (m) => `**${pct(m.urgencia_under_triage.rate)}** (${m.urgencia_under_triage.count}/${m.urgencia_under_triage.of}), ${ci(m.ci.urgencia_under_triage)}`);
  row('…de ellas, sin pregunta de seguimiento que pida el dato faltante', (m) => `${m.urgencia_under_no_followup.count}/${m.urgencia_under_no_followup.of}`);
  row('…de ellas, **en silencio** (sin pregunta y sin aviso "no estoy segura")', (m) => `${m.urgencia_under_silent.count}/${m.urgencia_under_silent.of}`);
  row('Sub-triaje total (cualquier nivel → menor)', (m) => `${pct(m.under_triage.rate)} (${m.under_triage.count}/${m.n})`);
  row('Sobre-triaje total', (m) => `${pct(m.over_triage.rate)} (${m.over_triage.count}/${m.n})`);
  row('Sensibilidad de referencia (centro/urgencia ≠ aquí)', (m) => `${pct(m.referral_sensitivity.rate)} (${m.referral_sensitivity.hits}/${m.referral_sensitivity.of}), ${ci(m.ci.referral_sensitivity)}`);
  row('Reglas esperadas que dispararon (todas)', (m) => `${pct(m.rule_recall.rate)} (${m.rule_recall.hits}/${m.rule_recall.of})`);
  for (const l of LEVELS) row(`Recall / precisión \`${l}\``, (m) => `${pct(m.per_level[l].recall)} / ${pct(m.per_level[l].precision)}`);
  row('Síntomas anotados extraídos bien (afirmados · negados)', (m) => (m.symptoms.of ? `${pct(m.symptoms.rate)} (${m.symptoms.ok}/${m.symptoms.of}) · ${m.symptoms.pos_ok}/${m.symptoms.pos_of} · ${m.symptoms.neg_ok}/${m.symptoms.neg_of}` : '—'));
  row('Nivel con hallazgos anotados (extracción perfecta)', (m) => (m.gold_accuracy ? `${pct(m.gold_accuracy.rate)} (${m.gold_accuracy.correct}/${m.gold_accuracy.of})` : '—'));
  row('Casos `expected_uncertain`: aviso "no estoy segura" · pregunta algo · pregunta el dato esperado', (m) => (m.uncertain_cases.of ? `${m.uncertain_cases.flagged}/${m.uncertain_cases.of} · ${m.uncertain_cases.asks_any}/${m.uncertain_cases.of} · ${m.uncertain_cases.asks_expected}/${m.uncertain_cases.of}` : '—'));
  row('Aviso "no estoy segura" en casos sin falta de datos (ruido) — si salta las preguntas', (m) => `${m.flagged_without_need.count}/${m.flagged_without_need.of}`);
  row('…ruido si contesta las preguntas como en la app (hasta 4; Sí/No según lo anotado o "No")', (m) => `${m.flagged_without_need_answered.count}/${m.flagged_without_need_answered.of}`);
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
  const hidden = new Set(opts.hideFailuresFor ?? []);
  const visible = rows.filter((r) => !hidden.has(r.split));
  if (hidden.size) {
    L.push(`> Fallos por caso ocultos para: ${[...hidden].join(', ')} (corrida de línea base; no se miran para no ajustar sobre el held-out).`);
    L.push('');
  }
  const fieldMisses = visible.flatMap((r) => r.field_checks.filter((fc) => !fc.ok).map((fc) => `| ${r.id} | ${r.split} | \`${String(fc.field)}\` | ${fc.expected} | ${fc.got === undefined ? '—' : fc.got} |`));
  if (fieldMisses.length) {
    L.push('Errores de campo:');
    L.push('');
    L.push('| Caso | Split | Campo | Esperado | Extraído |');
    L.push('|---|---|---|---|---|');
    L.push(...fieldMisses);
    L.push('');
  }
  const symMisses = visible.flatMap((r) => r.symptom_checks.filter((x) => !x.ok).map((x) => `| ${r.id} | ${r.split} | \`${x.key}\` | ${x.expected} | ${x.got === undefined ? '—' : x.got} |`));
  if (symMisses.length) {
    L.push('Síntomas anotados no extraídos (o con polaridad equivocada):');
    L.push('');
    L.push('| Caso | Split | Síntoma | Esperado | Extraído |');
    L.push('|---|---|---|---|---|');
    L.push(...symMisses);
    L.push('');
  }
  L.push('## Fallos de nivel');
  L.push('');
  const fails = visible.filter((r) => r.outcome !== 'ok');
  if (!fails.length) L.push('Ninguno.');
  for (const r of fails.sort((a, b) => (a.outcome === b.outcome ? a.id.localeCompare(b.id) : a.outcome === 'under' ? -1 : 1))) {
    L.push(`- **${r.id}** (${r.split}) esperado \`${r.expected_level}\`, predicho \`${r.predicted_level}\` — ${r.reason}`);
    L.push(`  - Texto: "${r.text}"`);
    L.push(`  - Reglas disparadas: ${r.fired_rule_ids.join(', ')}${r.preguntas.length ? ` · preguntas de seguimiento: ${r.preguntas.join(', ')}` : ''}${r.outcome === 'under' ? (r.followup_asks_missing ? ' · **la app pregunta el dato faltante**' : ' · la app NO pregunta el dato faltante') : ''}${r.uncertain ? ` · aviso "no estoy segura" (${r.uncertainty_codes.join(', ')})` : ''}`);
  }
  L.push('');
  const uncRows = visible.filter((r) => r.expected_uncertain);
  if (uncRows.length) {
    L.push('## Casos con datos insuficientes (`expected_uncertain`)');
    L.push('');
    L.push('| Caso | Split | Nivel esperado → predicho | Aviso "no estoy segura" | Preguntas | ¿Pide el dato esperado? |');
    L.push('|---|---|---|---|---|---|');
    for (const r of uncRows) L.push(`| ${r.id} | ${r.split} | ${r.expected_level} → ${r.predicted_level} | ${r.uncertain ? `sí (${r.uncertainty_codes.join(', ')})` : 'no'} | ${r.preguntas.join(', ') || '—'} | ${r.asks_expected ? 'sí' : 'no'} |`);
    L.push('');
  }
  return L.join('\n');
}
