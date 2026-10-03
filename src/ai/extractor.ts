/**
 * Extractor combinado: keywords (siempre) + LLM (si está cargado).
 *
 * Política de fusión (seguridad primero):
 *  - Síntomas: UNIÓN de positivos. Una negación EXPLÍCITA de keywords ("no tiene calentura")
 *    gana sobre un positivo del LLM; un "no se sabe" nunca borra un positivo.
 *  - Números: gana el que keywords leyó literalmente del texto. El número del LLM solo se usa si
 *    keywords no encontró nada y el valor está "anclado" a un número dicho en el texto
 *    (evita números alucinados).
 *  - embarazada: del LLM solo se acepta true (subir), nunca false.
 *  - level_hint del LLM solo se pasa si el modelo encontró al menos un hallazgo.
 */
import type { ExtractionResult, Findings, TriageLevel } from '../types';
import { keywordExtract, numericText } from './keywords';
import { llmExtract, llmReady } from './llm';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function numbersIn(text: string): number[] {
  return [...numericText(text).matchAll(/\d+(?:\.\d+)?/g)].map((m) => parseFloat(m[0]));
}

/** ¿El valor del LLM se puede derivar de algún número dicho (con conversiones de unidades comunes)? */
export function anchored(v: number, said: number[], field: keyof Findings): boolean {
  const factors: Record<string, number[]> = {
    edad_meses: [1, 12, 7 / 30.4375, 1 / 30.4375],
    semanas_embarazo: [1, 4.345, 4.3, 4],
    duracion_dias: [1, 7, 30, 365, 1 / 24],
    temperatura_c: [1],
    resp_por_min: [1, 2, 4], // "en 30 segundos conté 25" -> 50
  };
  const fs = factors[field as string] ?? [1];
  return said.some((n) => fs.some((k) => Math.abs(n * k - v) <= Math.max(1, Math.abs(v) * 0.05)));
}

export function mergeFindings(kw: Findings, llm: Partial<Findings> | null | undefined, text: string): Findings {
  const out: Findings = { ...kw, sintomas: { ...kw.sintomas } };
  if (!llm) return out;
  for (const [k, v] of Object.entries(llm.sintomas ?? {})) {
    if (v !== true) continue;
    if (kw.sintomas[k] === false) continue; // negación explícita en el texto
    out.sintomas[k] = true;
  }
  const said = numbersIn(text);
  for (const field of ['edad_meses', 'semanas_embarazo', 'duracion_dias', 'temperatura_c', 'resp_por_min'] as const) {
    const lv = llm[field];
    if (out[field] === undefined && typeof lv === 'number') {
      // Edad 0 = recién nacido: no necesita número en el texto
      if (anchored(lv, said, field) || (field === 'edad_meses' && lv === 0 && /nacid|nacio|nacer/.test(numericText(text)))) out[field] = lv;
    }
  }
  if (out.sexo === undefined && llm.sexo) out.sexo = llm.sexo;
  if (out.embarazada === undefined && llm.embarazada === true && out.sexo !== 'M') {
    out.embarazada = true;
    out.sexo = 'F';
  }
  return out;
}

export async function extract(text: string, opts: { useLLM?: boolean } = {}): Promise<ExtractionResult> {
  const t0 = now();
  const kw = keywordExtract(text);
  let llm: { findings: Partial<Findings>; level_hint?: TriageLevel } | null = null;
  if (opts.useLLM && llmReady()) {
    try { llm = await llmExtract(text); } catch { llm = null; }
  }
  const findings = mergeFindings(kw, llm?.findings, text);
  const llmFound = !!llm && (Object.keys(llm.findings.sintomas ?? {}).length > 0 || llm.findings.edad_meses !== undefined);
  const res: ExtractionResult = {
    findings,
    method: llm ? 'llm+keywords' : 'keywords',
    latency_ms: Math.round(now() - t0),
  };
  if (llm && llmFound && llm.level_hint) res.model_level_hint = llm.level_hint;
  if (llm) res.raw = JSON.stringify(llm);
  return res;
}
