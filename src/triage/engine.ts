import type { Findings, FiredRule, FollowUpQuestion, TriageLevel, TriageResult } from '../types';
import { LEVEL_RANK } from '../types';
import { NUMERIC_FIELDS, PREGUNTAS, SYMPTOMS, isSymptomKey } from './findings';
import { ALL_RULES, NO_DANGER_DIARRHEA, NO_DANGER_RULE } from './rules';
import type { Rule } from './rules';
import { coughOrDB, days, has, isNum, possiblyAge, years } from './rules/helpers';

export { ALL_RULES, NO_DANGER_DIARRHEA, NO_DANGER_RULE } from './rules';

const MAX_QUESTIONS = 2;

const maxLevel = (a: TriageLevel, b?: TriageLevel): TriageLevel =>
  b !== undefined && LEVEL_RANK[b] > LEVEL_RANK[a] ? b : a;

function normalize(f: Findings): Findings {
  return { ...f, sintomas: { ...(f?.sintomas ?? {}) } };
}

function safeApplies(r: Rule, f: Findings): boolean {
  try {
    return r.applies(f) === true;
  } catch {
    return false;
  }
}

export function toFired(r: Rule): FiredRule {
  return {
    id: r.id,
    level: r.level,
    explicacion: { ...r.explicacion },
    accion: { ...r.accion },
    fuente: r.fuente,
    fuente_url: r.fuente_url,
  };
}

/** Entrada que se muestra cuando el modelo subió el nivel por encima de las reglas. No es una regla clínica. */
export const MODEL_ESCALATION_ID = 'PAHTLI-MODEL-ESC';
function modelEscalation(level: TriageLevel): FiredRule {
  return {
    id: MODEL_ESCALATION_ID,
    level,
    explicacion: {
      es: 'El modelo de lenguaje detectó posible gravedad que las reglas clínicas no confirmaron con los datos capturados. Por seguridad se sube el nivel (el modelo solo puede subir, nunca bajar).',
      nah: '',
    },
    accion: {
      es: 'Volver a revisar los signos de peligro con el paciente. Ante la duda, seguir el nivel más alto.',
      nah: '',
    },
    fuente: 'Política de seguridad de Pahtli: nivel final = máximo(reglas, modelo). No es una regla clínica.',
  };
}

// ── Preguntas de seguimiento ────────────────────────────────────────────────

type FieldName = string;
const NUMERIC = new Set<string>(NUMERIC_FIELDS);

function isKnown(f: Findings, field: FieldName): boolean {
  if (NUMERIC.has(field)) return isNum((f as unknown as Record<string, unknown>)[field]);
  if (field === 'embarazada' || field === 'sexo') return (f as unknown as Record<string, unknown>)[field] !== undefined;
  return f.sintomas[field] !== undefined;
}

/** "Evidencia" = dato positivo conocido (no cuenta la edad ni las semanas). */
function isPositive(f: Findings, field: FieldName): boolean {
  if (field === 'edad_meses' || field === 'semanas_embarazo') return false;
  if (NUMERIC.has(field)) return isNum((f as unknown as Record<string, unknown>)[field]);
  if (field === 'embarazada') return f.embarazada === true;
  return f.sintomas[field] === true;
}

/** Valores de prueba "peor caso" para saber si un dato faltante podría hacer disparar una regla. */
const TRIALS: Record<string, unknown[]> = {
  edad_meses: [days(0.5), days(3), days(20), 1, 6, 24, years(8), years(30), years(60)],
  resp_por_min: [80, 6],
  temperatura_c: [41, 34],
  duracion_dias: [30],
  semanas_embarazo: [30, 34],
  embarazada: [true],
  sexo: ['F'],
};

function withValue(f: Findings, field: FieldName, v: unknown): Findings {
  if (NUMERIC.has(field) || field === 'embarazada' || field === 'sexo') return { ...f, [field]: v } as Findings;
  return { ...f, sintomas: { ...f.sintomas, [field]: v as boolean } };
}

function canFire(r: Rule, f: Findings, fill: FieldName[]): boolean {
  const numeric = fill.filter((x) => TRIALS[x]);
  const bools = fill.filter((x) => !TRIALS[x]);
  let base = f;
  for (const b of bools) base = withValue(base, b, true);
  const rec = (i: number, cur: Findings): boolean => {
    if (i === numeric.length) return safeApplies(r, cur);
    return TRIALS[numeric[i]].some((v) => rec(i + 1, withValue(cur, numeric[i], v)));
  };
  return rec(0, base);
}

/** ¿Tiene sentido preguntar este campo a este paciente? */
function askable(field: FieldName, f: Findings): boolean {
  if (field === 'embarazada' || field === 'posparto' || field === 'semanas_embarazo' || field === 'movimientos_fetales_disminuidos' || field === 'contracciones' || field === 'salida_liquido_vaginal' || field === 'sangrado_vaginal') {
    if (f.sexo === 'M') return false;
    if (isNum(f.edad_meses) && (f.edad_meses < years(10) || f.edad_meses >= years(55))) return false;
    if (field === 'semanas_embarazo' || field === 'movimientos_fetales_disminuidos' || field === 'contracciones' || field === 'salida_liquido_vaginal') return f.embarazada === true;
  }
  return true;
}

/** Orden de preferencia entre preguntas del mismo nivel (más útiles primero). */
const FIELD_PRIORITY = [
  'edad_meses', 'tiraje', 'lejos_unidad', 'resp_por_min', 'embarazada', 'sangrado_vaginal', 'dolor_cabeza_intenso', 'vision_borrosa',
  'movimientos_fetales_disminuidos', 'convulsiones', 'no_puede_beber', 'vomita_todo', 'letargico', 'estridor',
  'cianosis', 'ojos_hundidos', 'pliegue_muy_lento', 'rigidez_nuca', 'sangrado_mucosas', 'dolor_abdominal_intenso',
];
const prio = (field: string) => {
  const i = FIELD_PRIORITY.indexOf(field);
  return i === -1 ? FIELD_PRIORITY.length : i;
};

interface Candidate {
  field: FieldName;
  rank: number;
  ruleIndex: number;
  rule: Rule;
}

function buildQuestion(field: FieldName, rule: Rule): FollowUpQuestion {
  const tipo: FollowUpQuestion['tipo'] = field === 'resp_por_min' ? 'contar_respiraciones' : NUMERIC.has(field) ? 'numero' : 'si_no';
  const es = PREGUNTAS[field] ?? (isSymptomKey(field) ? `¿${SYMPTOMS[field].es}?` : `¿${field}?`);
  return { campo: field, tipo, pregunta: { es, nah: '' }, porque: rule.explicacion.es };
}

export function followUpQuestions(f: Findings, currentLevel: TriageLevel, max = MAX_QUESTIONS): FollowUpQuestion[] {
  const cur = LEVEL_RANK[currentLevel];
  const cands: Candidate[] = [];
  ALL_RULES.forEach((r, ruleIndex) => {
    if (LEVEL_RANK[r.level] <= cur) return;
    const needs = r.needs ?? [];
    const missing = needs.filter((n) => !isKnown(f, n));
    if (missing.length === 0) return;
    const evidence = needs.some((n) => isPositive(f, n)) || (r.context ?? []).some((k) => f.sintomas[k] === true);
    if (!evidence) return;
    if (!canFire(r, f, missing)) return;
    const necessary = missing.filter((m) => !canFire(r, f, missing.filter((x) => x !== m)));
    let ask = necessary.length ? necessary : missing.filter((m) => canFire(r, f, [m]));
    if (!ask.length) ask = missing;
    for (const field of ask) {
      if (askable(field, f)) cands.push({ field, rank: LEVEL_RANK[r.level], ruleIndex, rule: r });
    }
  });

  cands.sort((a, b) => b.rank - a.rank || prio(a.field) - prio(b.field) || a.ruleIndex - b.ruleIndex);

  const out: FollowUpQuestion[] = [];
  const seen = new Set<string>();
  // AIEPI: en menores de 5 años con tos/dificultad para respirar, contar respiraciones va primero.
  const rr = cands.find((c) => c.field === 'resp_por_min');
  if (rr && coughOrDB(f) && possiblyAge(f, 0, 60)) {
    out.push(buildQuestion('resp_por_min', rr.rule));
    seen.add('resp_por_min');
  }
  for (const c of cands) {
    if (out.length >= max) break;
    if (seen.has(c.field)) continue;
    seen.add(c.field);
    out.push(buildQuestion(c.field, c.rule));
  }
  return out.slice(0, max);
}

// ── API pública ─────────────────────────────────────────────────────────────

/** Reglas que disparan (sin la regla por defecto), ordenadas por gravedad y luego por prioridad clínica. */
export function evaluateRules(findings: Findings): Rule[] {
  const f = normalize(findings);
  return ALL_RULES.map((r, i) => ({ r, i }))
    .filter(({ r }) => safeApplies(r, f))
    .sort((a, b) => LEVEL_RANK[b.r.level] - LEVEL_RANK[a.r.level] || a.i - b.i)
    .map(({ r }) => r);
}

export function triage(findings: Findings, modelHint?: TriageLevel): TriageResult {
  const f = normalize(findings);
  const rules = evaluateRules(f);
  const rulesLevel = rules.reduce<TriageLevel>((acc, r) => maxLevel(acc, r.level), 'aqui');
  const hint = modelHint && modelHint in LEVEL_RANK ? modelHint : undefined;
  const level = maxLevel(rulesLevel, hint);
  const escalated = hint !== undefined && LEVEL_RANK[hint] > LEVEL_RANK[rulesLevel];

  const fired: FiredRule[] = rules.map(toFired);
  if (escalated) fired.unshift(modelEscalation(level));
  if (fired.length === 0) {
    const d = toFired(NO_DANGER_RULE);
    // Diarrea sin signos de deshidratación: la acción por defecto es el Plan A (Vida Suero Oral tras cada evacuación).
    if (has(f, 'diarrea')) fired.push({ ...d, accion: { ...NO_DANGER_DIARRHEA.accion }, fuente: `${d.fuente}; ${NO_DANGER_DIARRHEA.fuente}` });
    else fired.push(d);
  }

  return {
    level,
    fired,
    preguntas: followUpQuestions(f, level),
    model_level: hint,
    escalated_by_model: escalated,
  };
}
