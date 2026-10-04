import type { Findings, FiredRule, FollowUpQuestion, TriageLevel, TriageResult } from '../types';
import { LEVEL_RANK } from '../types';
import { NUMERIC_FIELDS, PREGUNTAS, SYMPTOMS, isSymptomKey, preguntaPorEdad } from './findings';
import {
  ALL_RULES, NO_DANGER_DIARRHEA, NO_DANGER_NEUTRAL_ACCION, NO_DANGER_NEUTRAL_DIARRHEA_ACCION, NO_DANGER_OLDER_DIARRHEA,
  NO_DANGER_OLDER_RULE, NO_DANGER_RULE, olderNoDangerAccion,
} from './rules';
import type { Rule } from './rules';
import { coughOrDB, days, has, isNum, possiblyAge, pregnancyPossible, years } from './rules/helpers';
import { SCREENING_KEY, SCREENING_WHY, screeningApplies, screeningQuestionText } from './screening';

export { ALL_RULES, NO_DANGER_DIARRHEA, NO_DANGER_OLDER_RULE, NO_DANGER_RULE } from './rules';

const MAX_QUESTIONS = 2;

const maxLevel = (a: TriageLevel, b?: TriageLevel): TriageLevel =>
  b !== undefined && LEVEL_RANK[b] > LEVEL_RANK[a] ? b : a;

/**
 * Ronda 4 (revisión ENGINE-PREG-AGE): con la edad CONOCIDA de 2 meses a menos de 10 años, "embarazada" y "cuarentena" no son de
 * este paciente (p. ej. "mi hija de 3 años tiene diarrea, yo estoy embarazada"): se ignoran. Así un "Sí" pensado para
 * la mamá no dispara reglas de urgencia obstétrica en una niña de 3 años.
 */
function normalize(f: Findings): Findings {
  const out: Findings = { ...f, sintomas: { ...(f?.sintomas ?? {}) } };
  // Menor de 2 meses + embarazo/cuarentena: el caso es de la MAMÁ y la edad es la del recién nacido (las reglas del
  // lactante ya lo excluyen); eso no se toca.
  if (isNum(out.edad_meses) && out.edad_meses >= 2 && out.edad_meses < years(10)) {
    delete out.embarazada;
    delete out.semanas_embarazo;
    delete out.sintomas.posparto;
  }
  return out;
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
  // Las reglas que leen `sexo` pueden pedir hombre (ardor al orinar, NHS-UTI-01) o mujer: se prueban los dos.
  sexo: ['F', 'M'],
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

const PREGNANCY_FIELDS = new Set(['embarazada', 'posparto', 'semanas_embarazo', 'movimientos_fetales_disminuidos', 'contracciones', 'salida_liquido_vaginal', 'sangrado_vaginal']);

/** ¿Tiene sentido preguntar este campo a este paciente? */
function askable(field: FieldName, f: Findings): boolean {
  // En la cuarentena no se pregunta "¿Está embarazada?" (ya dio a luz).
  if (field === 'embarazada' && has(f, 'posparto')) return false;
  if (PREGNANCY_FIELDS.has(field)) {
    if (!pregnancyPossible(f)) return false;
    if (field === 'semanas_embarazo' || field === 'movimientos_fetales_disminuidos' || field === 'contracciones' || field === 'salida_liquido_vaginal') return f.embarazada === true;
  }
  // Signos que no aplican a esta edad (p. ej. mollera hundida a los 30 años): PREGUNTAS_EDAD[...].mayor5 = null.
  if (preguntaPorEdad(field, f.edad_meses) === null) return false;
  return true;
}

/** Orden de preferencia entre preguntas del mismo nivel (más útiles primero). */
const FIELD_PRIORITY = [
  // Ronda 3: la pregunta que resume los signos de cada molestia común va primero dentro de su nivel.
  'alacran_sintomas', 'arana_peligrosa', 'no_obra_ni_gases', 'dolor_al_moverse', 'cauda_equina', 'no_traga_saliva',
  'hinchazon_labios_lengua', 'objeto_clavado', 'herida_profunda', 'quemadura_grave',
  // Ronda 4
  'golpe_cabeza_alto_riesgo', 'quemadura_grande_profunda', 'herida_cara_palma', 'vomito_verde',
  'edad_meses', 'tiraje', 'lejos_unidad', 'resp_por_min', 'embarazada', 'sangrado_vaginal', 'dolor_cabeza_intenso', 'vision_borrosa',
  'movimientos_fetales_disminuidos', 'convulsiones', 'no_puede_beber', 'vomita_todo', 'letargico', 'estridor',
  'cianosis', 'ojos_hundidos', 'pliegue_muy_lento', 'rigidez_nuca', 'sangrado_mucosas', 'dolor_abdominal_intenso',
  'sexo',
];
const prio = (field: string) => {
  const i = FIELD_PRIORITY.indexOf(field);
  return i === -1 ? FIELD_PRIORITY.length : i;
};

interface Candidate {
  field: FieldName;
  rank: number;
  /**
   * Ronda 4: regla del embarazo cuyo `context` es una molestia que SÍ se dijo (dolor de cintura → contracciones; dolor de
   * cabeza → ¿muy fuerte?; y "¿Está embarazada?" para saberlo). Solo en el bloque de embarazo: no cambia el orden de AIEPI.
   */
  ctx: number;
  ruleIndex: number;
  rule: Rule;
}

function buildQuestion(field: FieldName, rule: Rule, f: Findings): FollowUpQuestion {
  const tipo: FollowUpQuestion['tipo'] = field === 'resp_por_min' ? 'contar_respiraciones' : NUMERIC.has(field) ? 'numero' : 'si_no';
  const es = preguntaPorEdad(field, f.edad_meses) ?? (isSymptomKey(field) ? `¿${SYMPTOMS[field].es}?` : `¿${field}?`);
  return { campo: field, tipo, pregunta: { es, nah: '' }, porque: rule.explicacion.es };
}

/**
 * Sexo antes que embarazo (reporte de uso real, 4-oct-2026: a "nombre de 21 años" —"hombre" mal transcrito— la app le
 * preguntó si estaba embarazado). Si el sexo no se sabe, antes de una pregunta de embarazo o puerperio se pregunta
 * "¿Es hombre o mujer?". La GPC IMSS-031 (apendicitis, p. 4) pide descartar embarazo en "Toda paciente en edad
 * fértil", es decir, en mujeres. Si responde "Hombre", el motor ya no pregunta embarazo (pregnancyPossible).
 * Si responde "No sé", la pregunta de embarazo sigue en la lista (va justo después): no se pierde.
 */
export const SEX_WHY = 'Para saber si hay que preguntar por embarazo: solo se pregunta a mujeres de 10 a 49 años.';
function needsSexFirst(field: FieldName, f: Findings): boolean {
  return PREGNANCY_FIELDS.has(field) && f.sexo === undefined && f.embarazada !== true && !has(f, 'posparto');
}
function sexQuestion(): FollowUpQuestion {
  return { campo: 'sexo', tipo: 'si_no', pregunta: { es: PREGUNTAS.sexo, nah: '' }, porque: SEX_WHY };
}

/** Pregunta de revisión de signos de peligro (src/triage/screening.ts): una sola, Sí/No, lista según la edad. */
function screeningQuestion(f: Findings): FollowUpQuestion {
  return { campo: SCREENING_KEY, tipo: 'si_no', pregunta: { es: screeningQuestionText(f.edad_meses), nah: '' }, porque: SCREENING_WHY };
}

/** ¿Hay que revisar los signos de peligro antes de dar "Atender aquí"? */
export function needsScreening(f: Findings, currentLevel: TriageLevel): boolean {
  return currentLevel === 'aqui' && screeningApplies(f) && f.sintomas?.[SCREENING_KEY] === undefined;
}

export function followUpQuestions(findings: Findings, currentLevel: TriageLevel, max = MAX_QUESTIONS): FollowUpQuestion[] {
  const f = normalize(findings);
  const cur = LEVEL_RANK[currentLevel];
  const cands: Candidate[] = [];
  ALL_RULES.forEach((r, ruleIndex) => {
    if (LEVEL_RANK[r.level] <= cur) return;
    const needs = r.needs ?? [];
    // Si no puede haber embarazo (hombre, o edad fuera de 10–49 años), una regla que lo exige no motiva preguntas.
    const missing = needs.filter((n) => !isKnown(f, n) && !((n === 'embarazada' || n === 'posparto') && !pregnancyPossible(f)));
    if (missing.length === 0) return;
    const ctxHit = (r.context ?? []).some((k) => f.sintomas[k] === true);
    const evidence = (r.trigger ?? needs).some((n) => isPositive(f, n)) || ctxHit;
    if (!evidence) return;
    if (!canFire(r, f, missing)) return;
    const necessary = missing.filter((m) => !canFire(r, f, missing.filter((x) => x !== m)));
    let ask = necessary.length ? necessary : missing.filter((m) => canFire(r, f, [m]));
    if (!ask.length) ask = missing;
    for (const field of ask) {
      if (askable(field, f)) cands.push({ field, rank: LEVEL_RANK[r.level], ctx: ctxHit && r.block === 'pregnancy' && (field === 'embarazada' || f.embarazada === true || has(f, 'posparto')) ? 1 : 0, ruleIndex, rule: r });
    }
  });

  // Dentro del mismo nivel: primero lo que pregunta por la molestia que se dijo (embarazada con dolor de cintura →
  // contracciones; con dolor de cabeza → ¿muy fuerte?), luego el orden de FIELD_PRIORITY.
  cands.sort((a, b) => b.rank - a.rank || b.ctx - a.ctx || prio(a.field) - prio(b.field) || a.ruleIndex - b.ruleIndex);

  const out: FollowUpQuestion[] = [];
  const seen = new Set<string>();
  const push = (q: FollowUpQuestion) => { out.push(q); seen.add(q.campo); };
  // Antes de "Atender aquí": revisar los signos de peligro (AIEPI los revisa antes que todo lo demás).
  // Excepción: si falta la edad y el motor la necesita, va antes, porque la lista de signos depende de la edad
  // y el lactante menor de 2 meses no usa esta revisión (tiene sus propias reglas).
  // La revisión es una compuerta, no un dato clínico faltante: va ADEMÁS de las `max` preguntas clínicas.
  const screen = needsScreening(f, currentLevel);
  let limit = max + (screen ? 1 : 0);
  if (screen) {
    const age = cands.find((c) => c.field === 'edad_meses');
    if (age) push(buildQuestion('edad_meses', age.rule, f));
    push(screeningQuestion(f));
  }
  // AIEPI: en menores de 5 años con tos/dificultad para respirar, contar respiraciones va primero (después de los signos de peligro).
  const rr = cands.find((c) => c.field === 'resp_por_min');
  if (rr && !seen.has('resp_por_min') && coughOrDB(f) && possiblyAge(f, 0, 60)) push(buildQuestion('resp_por_min', rr.rule, f));
  for (const c of cands) {
    if (out.length >= limit) break;
    if (seen.has(c.field)) continue;
    // Sexo antes que embarazo: es una compuerta (como la revisión), no cuenta entre las `max` preguntas clínicas.
    if (needsSexFirst(c.field, f) && !seen.has('sexo')) {
      push(sexQuestion());
      limit++;
    }
    push(buildQuestion(c.field, c.rule, f));
  }
  return out.slice(0, limit);
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

/**
 * Regla por defecto ("sin signos de peligro") según la edad:
 *  - menor de 5 años: IMCI-NOSIGNS-01 (AIEPI comunitario; con diarrea, Plan A de la NOM-031);
 *  - edad desconocida: IMCI-NOSIGNS-01 con texto neutral, sin indicaciones de lactancia;
 *  - 5 años o más: IITT-NOSIGNS-01 (verde del IITT; con diarrea, Plan A de la OMS 2005).
 */
function noDangerDefault(f: Findings): FiredRule {
  const diarrea = has(f, 'diarrea');
  const age = f.edad_meses;
  if (isNum(age) && age >= years(5)) {
    const d = toFired(NO_DANGER_OLDER_RULE);
    const accion = { es: olderNoDangerAccion(age, diarrea), nah: '' };
    return diarrea ? { ...d, accion, fuente: NO_DANGER_OLDER_DIARRHEA.fuente, fuente_url: NO_DANGER_OLDER_DIARRHEA.fuente_url } : { ...d, accion };
  }
  const d = toFired(NO_DANGER_RULE);
  const known = isNum(age);
  // Diarrea sin signos de deshidratación: la acción por defecto es el Plan A (Vida Suero Oral tras cada evacuación).
  if (diarrea) {
    return {
      ...d,
      accion: known ? { ...NO_DANGER_DIARRHEA.accion } : { es: NO_DANGER_NEUTRAL_DIARRHEA_ACCION, nah: '' },
      fuente: `${d.fuente}; ${NO_DANGER_DIARRHEA.fuente}`,
    };
  }
  return known ? d : { ...d, accion: { es: NO_DANGER_NEUTRAL_ACCION, nah: '' } };
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
  if (fired.length === 0) fired.push(noDangerDefault(f));

  return {
    level,
    fired,
    preguntas: followUpQuestions(f, level),
    model_level: hint,
    escalated_by_model: escalated,
  };
}
