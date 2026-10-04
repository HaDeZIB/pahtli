/**
 * Fail-safe de incertidumbre: "⚪ No estoy segura — consulta al personal de salud".
 *
 * NO cambia el nivel de triaje (las reglas clínicas mandan y siguen visibles). Detecta cuándo los datos
 * son tan pobres o contradictorios que Pahtli no debe aparentar seguridad, para que la promotora
 * consulte a una persona en vez de confiar en una adivinanza. Es un requisito "pasa / no pasa" de la
 * IA responsable (World Bank, PLAN.md §14).
 *
 * Funciones puras: sin I/O, deterministas, probadas en uncertainty.test.ts.
 */
import type { ExtractionResult, Findings, TriageLevel, TriageResult } from '../types';
import { LEVEL_RANK } from '../types';
import { keywordExtract } from '../ai/keywords';
import { cleanTranscript } from '../ai/transcript';
import { evaluateRules } from './engine';
import { ALL_RULES } from './rules';
import { isSymptomKey } from './findings';
import { days, years } from './rules/helpers';

export interface AnsweredQuestion {
  /** Campo preguntado (SymptomKey o 'edad_meses', 'resp_por_min', ...). */
  campo: string;
  /** false = la promotora respondió "No sé" (o tocó "Saltar", ver `skipped`). */
  known: boolean;
  /** true = tocó "Saltar" en esta pregunta (y en las que seguían). */
  skipped?: boolean;
  /** Texto de la pregunta, para explicar el motivo. */
  pregunta?: string;
}

export interface UncertaintyInput {
  transcript: string;
  extraction: ExtractionResult | null | undefined;
  triageResult: TriageResult;
  answeredQuestions?: AnsweredQuestion[];
  /** Hallazgos finales (después de las preguntas). Por defecto: extraction.findings. */
  findings?: Findings | null;
  /** Hallazgos solo por palabras clave, si ya se calcularon. Si no, se recalculan cuando se usó el LLM. */
  keywordFindings?: Findings;
}

export type UncertaintyCode =
  | 'no_findings'
  | 'short_transcript'
  | 'garbled_transcript'
  | 'age_missing'
  | 'answered_unknown'
  | 'questions_pending'
  | 'llm_disagree'
  | 'young_infant_few'
  | 'pregnancy_few';

export interface Uncertainty {
  uncertain: boolean;
  /** Motivos legibles en español, en el orden en que se muestran. */
  reasons: string[];
  codes: UncertaintyCode[];
}

/**
 * Máximo de preguntas de seguimiento que hace la app (src/screens/FollowUp.tsx). El motor casi siempre tiene
 * otra pregunta posible; si la promotora ya contestó este máximo, las que siguen NO cuentan como "sin responder".
 */
export const MAX_FOLLOWUP_QUESTIONS = 4;

/** Menos de estas palabras con letras = descripción demasiado corta para confiar. */
export const MIN_WORDS = 4;
/** Con menos de estos hallazgos positivos, un bebé < 2 meses o una embarazada se marcan como inciertos. */
export const FEW_FINDINGS = 2;

const BUTTONS_PREFIX = '[botones]';
/** Claves de contexto: no son una molestia del paciente. */
const CONTEXT_KEYS = new Set(['posparto', 'lejos_unidad', 'bajo_peso_nacer', 'sarampion_reciente']);
const PREGNANCY_KEYS = ['sangrado_vaginal', 'movimientos_fetales_disminuidos', 'contracciones', 'salida_liquido_vaginal'];

/** Signos que, solos o combinados, pueden llevar a urgencia: los `needs` de las reglas de urgencia. */
export const RED_FLAG_KEYS: ReadonlySet<string> = new Set(
  ALL_RULES.filter((r) => r.level === 'urgencia').flatMap((r) => (r.needs ?? []).filter((n) => isSymptomKey(n))),
);

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function rulesLevel(f: Findings): TriageLevel {
  return evaluateRules(f).reduce<TriageLevel>((acc, r) => (LEVEL_RANK[r.level] > LEVEL_RANK[acc] ? r.level : acc), 'aqui');
}

/**
 * ¿Hay algún dato clínico (síntoma afirmado o negado, o medición)? La edad sola no cuenta, y la duración
 * sola tampoco: "le duele el oído desde hace 3 días" sin ningún síntoma reconocido es "no entendí nada",
 * no un caso para "Atender aquí".
 */
export function hasClinicalData(f: Findings | null | undefined): boolean {
  if (!f) return false;
  if (Object.entries(f.sintomas ?? {}).some(([k, v]) => typeof v === 'boolean' && !CONTEXT_KEYS.has(k))) return true;
  return isNum(f.temperatura_c) || isNum(f.resp_por_min);
}

/** Hallazgos positivos: síntomas en true (sin claves de contexto) + mediciones. */
export function positiveCount(f: Findings | null | undefined): number {
  if (!f) return 0;
  const sym = Object.entries(f.sintomas ?? {}).filter(([k, v]) => v === true && !CONTEXT_KEYS.has(k)).length;
  return sym + (isNum(f.temperatura_c) ? 1 : 0) + (isNum(f.resp_por_min) ? 1 : 0);
}

const words = (s: string) => s.split(/\s+/).filter((w) => /\p{L}{2,}/u.test(w));

/** Transcripción con señales de basura: alucinación de Whisper, bucles, pocos caracteres de texto. */
export function looksGarbled(text: string): boolean {
  const raw = text.replace(/\s+/g, ' ').trim();
  if (!raw) return false;
  const cleaned = cleanTranscript(raw);
  if (cleaned.length < raw.length * 0.6) return true; // se fue mucho en limpieza (frases de subtítulos / repeticiones)
  const chars = raw.replace(/\s/g, '');
  const letters = (chars.match(/\p{L}/gu) ?? []).length;
  if (chars.length >= 6 && letters / chars.length < 0.6) return true;
  const ws = words(raw.toLowerCase());
  if (ws.length >= 4) {
    const counts = new Map<string, number>();
    for (const w of ws) counts.set(w, (counts.get(w) ?? 0) + 1);
    const top = Math.max(...counts.values());
    if (top / ws.length > 0.5) return true; // una palabra domina: bucle
  }
  return false;
}

/** Edades de prueba para saber si el resultado depende de la edad (no tocan las reglas, solo las consultan). */
function trialAges(f: Findings): number[] {
  const pregnancyContext = f.embarazada === true || f.sintomas?.posparto === true || PREGNANCY_KEYS.some((k) => f.sintomas?.[k] === true);
  if (pregnancyContext) return [years(16), years(30), years(44)];
  return [days(3), days(20), 1, 6, 24, 48, years(8), years(30), years(70)];
}

/**
 * Sin edad: ¿alguna edad plausible SUBIRÍA el nivel de las reglas? Solo importa el riesgo de quedarse corto
 * (falsa tranquilidad); si una edad lo bajara, el resultado actual ya es el más prudente.
 */
export function resultDependsOnAge(f: Findings): boolean {
  if (isNum(f.edad_meses)) return false;
  const base = LEVEL_RANK[rulesLevel(f)];
  return trialAges(f).some((a) => LEVEL_RANK[rulesLevel({ ...f, edad_meses: a })] > base);
}

function llmFindingsFrom(extraction: ExtractionResult): Partial<Findings> | null {
  if (!extraction.raw) return null;
  try {
    const parsed = JSON.parse(extraction.raw) as { findings?: Partial<Findings> };
    return parsed && typeof parsed === 'object' && parsed.findings ? parsed.findings : null;
  } catch {
    return null;
  }
}

/** Desacuerdo LLM vs palabras clave en signos de alarma o en el nivel. Solo aplica si se usó el LLM. */
export function llmDisagreement(extraction: ExtractionResult, transcript: string, keywordFindings?: Findings): string[] {
  if (!extraction.method.includes('llm')) return [];
  const kw = keywordFindings ?? keywordExtract(transcript);
  const llm = llmFindingsFrom(extraction);
  const llmSym = llm?.sintomas ?? extraction.findings.sintomas ?? {};
  const out = new Set<string>();
  for (const k of RED_FLAG_KEYS) {
    const a = kw.sintomas?.[k] === true;
    const b = llmSym[k] === true;
    if (a !== b) out.add(k);
  }
  const hint = extraction.model_level_hint;
  if (hint && hint !== rulesLevel(kw)) out.add('__level__');
  return [...out];
}

export function assessUncertainty(input: UncertaintyInput): Uncertainty {
  const { triageResult, extraction } = input;
  const transcript = (input.transcript ?? '').trim();
  const fromButtons = transcript.startsWith(BUTTONS_PREFIX);
  const findings: Findings = input.findings ?? extraction?.findings ?? { sintomas: {} };
  const answered = input.answeredQuestions ?? [];
  const codes: UncertaintyCode[] = [];
  const reasons: string[] = [];
  const add = (c: UncertaintyCode, r: string) => { if (!codes.includes(c)) { codes.push(c); reasons.push(r); } };

  // 1) Texto vacío de hallazgos, muy corto o con pinta de basura (solo voz / texto, no botones).
  if (!fromButtons && transcript) {
    if (!hasClinicalData(findings)) add('no_findings', 'No entendí ningún síntoma en lo que se dijo.');
    if (words(transcript).length < MIN_WORDS) add('short_transcript', 'La descripción es muy corta.');
    if (looksGarbled(transcript)) add('garbled_transcript', 'El texto parece mal entendido (ruido o palabras repetidas). Revíselo.');
  } else if (fromButtons && !hasClinicalData(findings)) {
    add('no_findings', 'No se marcó ningún síntoma.');
  }

  // 2) Falta información clave.
  if (resultDependsOnAge(findings)) add('age_missing', 'Falta la edad y el resultado podría cambiar con ella.');
  const unknown = answered.filter((q) => !q.known && !q.skipped && !(q.campo === 'edad_meses' && codes.includes('age_missing')));
  if (unknown.length) {
    const list = unknown.map((q) => q.pregunta ?? q.campo).join(' · ');
    add('answered_unknown', `Respondió “No sé” a: ${list}`);
  }
  // Sin responder = tocó "Saltar", o quedaron preguntas antes de llegar al máximo (p. ej. volvió atrás).
  // Si ya contestó el máximo, las que el motor aún podría hacer no cuentan (si no, el aviso saldría siempre).
  const answeredSet = new Set(answered.filter((q) => !q.skipped).map((q) => q.campo));
  const pending = (triageResult.preguntas ?? []).filter((q) => !answeredSet.has(q.campo));
  const skipped = answered.some((q) => q.skipped);
  if (skipped || (pending.length && answeredSet.size < MAX_FOLLOWUP_QUESTIONS)) {
    add('questions_pending', 'Quedaron preguntas sin responder que podrían subir el nivel.');
  }

  // 3) El modelo de lenguaje y las palabras clave no coinciden en signos de alarma.
  if (extraction && !fromButtons && llmDisagreement(extraction, transcript, input.keywordFindings).length) {
    add('llm_disagree', 'La IA y las palabras clave no coinciden en un signo de alarma.');
  }

  // 4) Grupos de alto riesgo con pocos datos: pueden estar más graves de lo que parece. Si ya es urgencia,
  //    no hay nivel más alto al cual subir y el aviso solo sumaría ruido (fatiga de alertas).
  const n = positiveCount(findings);
  const canRise = triageResult.level !== 'urgencia';
  if (canRise && isNum(findings.edad_meses) && findings.edad_meses < 2 && n < FEW_FINDINGS) {
    add('young_infant_few', 'Bebé de menos de 2 meses con pocos datos: puede enfermar grave sin muchos signos.');
  }
  if (canRise && findings.embarazada === true && n < FEW_FINDINGS) {
    add('pregnancy_few', 'Embarazo con pocos datos: revise los signos de alarma del embarazo.');
  }

  return { uncertain: codes.length > 0, reasons, codes };
}
