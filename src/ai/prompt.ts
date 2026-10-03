/**
 * Prompt y esquema JSON del extractor LLM (puros, testeables en Node).
 * El modelo SOLO extrae; el motor de reglas decide. El esquema limita las claves de síntomas
 * al catálogo cerrado (decodificación restringida por gramática de WebLLM/XGrammar).
 */
import type { Findings, TriageLevel } from '../types';
import { SYMPTOMS, SYMPTOM_KEYS, isSymptomKey } from '../triage/findings';
import { groundedIn, keywordExtract } from './keywords';

/** Etiqueta corta (sin paréntesis largos) para ahorrar tokens de prefill. */
function shortLabel(es: string): string {
  return es.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

export const SYMPTOM_LIST_FOR_PROMPT = SYMPTOM_KEYS.map((k) => `${k}: ${shortLabel(SYMPTOMS[k].es)}`).join('\n');

export const SYSTEM_PROMPT = `Eres un extractor de datos. Lees lo que dice una promotora de salud rural de México sobre un paciente y respondes SOLO con JSON.
Reglas:
1. "sintomas": solo claves de la lista que se digan como PRESENTES. Si se niegan ("no tiene", "sin", "ya no", "ni"), NO las pongas. No inventes.
2. Palabras del pueblo: calentura = fiebre; anda suelto o chorrillo = diarrea; se le hunde el pecho = tiraje; ataques = convulsiones; boca chueca = cara_caida; cuarentena = posparto.
3. edad_meses: convierte a meses ("8 meses"=8, "año y medio"=18, "señora de 40"=480, "recién nacido"=0). Si no se dice, null.
4. semanas_embarazo: semanas de embarazo (meses x 4.3). embarazada: true solo si se dice. Si no, null.
5. temperatura_c (grados), resp_por_min (respiraciones contadas en un minuto), duracion_dias ("desde ayer"=1). Si no se dicen, null.
6. sexo: "F", "M" o null.
7. No diagnostiques ni des tratamiento. level_hint: "urgencia" solo si hay peligro de muerte evidente; "centro_hoy" si necesita médico hoy; si no, "aqui".
Lista de claves (clave: significado):
${SYMPTOM_LIST_FOR_PROMPT}`;

export const FEW_SHOT: { user: string; assistant: string }[] = [
  {
    user: 'El niño de 3 años tiene calentura desde antier y tose mucho, no tiene diarrea.',
    assistant: '{"sintomas":["fiebre","tos"],"edad_meses":36,"sexo":"M","embarazada":null,"semanas_embarazo":null,"duracion_dias":2,"temperatura_c":null,"resp_por_min":null,"level_hint":"aqui"}',
  },
];

const nullable = (type: 'number' | 'boolean' | 'string') => ({ type: [type, 'null'] });

export const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    sintomas: { type: 'array', items: { type: 'string', enum: SYMPTOM_KEYS } },
    edad_meses: nullable('number'),
    sexo: { type: ['string', 'null'], enum: ['F', 'M', null] },
    embarazada: nullable('boolean'),
    semanas_embarazo: nullable('number'),
    duracion_dias: nullable('number'),
    temperatura_c: nullable('number'),
    resp_por_min: nullable('number'),
    level_hint: { type: 'string', enum: ['aqui', 'centro_hoy', 'urgencia'] },
  },
  required: ['sintomas', 'edad_meses', 'sexo', 'embarazada', 'semanas_embarazo', 'duracion_dias', 'temperatura_c', 'resp_por_min', 'level_hint'],
  additionalProperties: false,
} as const;

const LEVELS: TriageLevel[] = ['aqui', 'centro_hoy', 'urgencia'];
const inRange = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** Extrae el primer objeto JSON del texto (por si el modelo agrega algo alrededor). */
function firstJsonObject(raw: string): unknown {
  const start = raw.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try { return JSON.parse(raw.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

/** Valida y convierte la salida del modelo. Descarta todo lo que no esté en el catálogo o fuera de rango. */
export function parseLLMOutput(raw: string): { findings: Partial<Findings>; level_hint?: TriageLevel } | null {
  const o = firstJsonObject(raw) as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') return null;
  const sintomas: Findings['sintomas'] = {};
  const list = Array.isArray(o.sintomas) ? o.sintomas : o.sintomas && typeof o.sintomas === 'object' ? Object.keys(o.sintomas).filter((k) => (o.sintomas as Record<string, unknown>)[k] === true) : [];
  for (const k of list) if (typeof k === 'string' && isSymptomKey(k)) sintomas[k] = true;
  const f: Partial<Findings> = { sintomas };
  if (inRange(o.edad_meses, 0, 1440)) f.edad_meses = Math.round(o.edad_meses * 10) / 10;
  if (o.sexo === 'F' || o.sexo === 'M') f.sexo = o.sexo;
  if (typeof o.embarazada === 'boolean') f.embarazada = o.embarazada;
  if (inRange(o.semanas_embarazo, 1, 45)) f.semanas_embarazo = Math.round(o.semanas_embarazo);
  if (inRange(o.duracion_dias, 0, 3650)) f.duracion_dias = o.duracion_dias;
  if (inRange(o.temperatura_c, 34, 43.5)) f.temperatura_c = o.temperatura_c;
  if (inRange(o.resp_por_min, 5, 150)) f.resp_por_min = Math.round(o.resp_por_min);
  const level_hint = typeof o.level_hint === 'string' && (LEVELS as string[]).includes(o.level_hint) ? (o.level_hint as TriageLevel) : undefined;
  return { findings: f, level_hint };
}

// ─────────────────────────────────────────────────────────────────────────────
// Modo "paráfrasis": el LLM solo reescribe en español estándar los síntomas PRESENTES,
// uno por línea; el mapeo a claves lo hace el extractor por keywords (determinista).
// Prompt corto (~200 tokens): prefill rápido en el celular y sin catálogo que confunda al modelo.
// ─────────────────────────────────────────────────────────────────────────────
export const PARAPHRASE_SYSTEM = `Ayudas a una promotora de salud en México. Lee lo que cuenta y escribe SOLO la lista de síntomas o signos que el paciente SÍ tiene, en español sencillo y estándar, uno por línea, empezando cada línea con "- ".
No pongas lo que se niega ("no tiene", "sin", "ya no"). No agregues nada que no se diga. No des diagnóstico ni tratamiento. Si no hay síntomas escribe "- ninguno".`;

export const PARAPHRASE_FEW_SHOT: { user: string; assistant: string }[] = [
  {
    user: 'El chamaco anda como privado y no quiere ni el agua, no tiene calentura pero tose.',
    assistant: '- inconsciente\n- no puede beber\n- tos',
  },
  {
    user: 'La señora anda con chorrillo desde ayer y se le hundieron los ojos.',
    assistant: '- diarrea\n- ojos hundidos',
  },
];

/** Líneas "- síntoma" de la salida del modelo (máx. 12, sin "ninguno"). */
export function parseParaphrase(raw: string): string[] {
  return raw
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-*•\d.)]+\s*/, '').trim())
    .filter((l) => l && l.length <= 80 && !/^ningun[oa]?$/i.test(l))
    .slice(0, 12);
}

/** Paráfrasis del LLM -> síntomas positivos (solo líneas ancladas al relato original). */
export function mapParaphrase(raw: string, text: string): Findings['sintomas'] {
  const sintomas: Findings['sintomas'] = {};
  for (const line of parseParaphrase(raw)) {
    if (!groundedIn(line, text)) continue;
    for (const [k, v] of Object.entries(keywordExtract(line).sintomas)) if (v === true) sintomas[k] = true;
  }
  return sintomas;
}
