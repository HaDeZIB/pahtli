import type { Findings, Lang } from '../types';
import { SYMPTOMS } from '../triage/findings';

export function symptomLabel(key: string, lang: Lang = 'es'): string {
  const s = (SYMPTOMS as Record<string, { es: string; nah?: string } | undefined>)[key];
  if (!s) return key.replace(/_/g, ' ');
  return lang === 'nah' && s.nah ? s.nah : s.es;
}

export function formatAge(m?: number): string | null {
  if (m === undefined || m === null || Number.isNaN(m)) return null;
  if (m < 1) return 'Recién nacido';
  if (m < 24) return `${Math.round(m)} ${Math.round(m) === 1 ? 'mes' : 'meses'}`;
  const y = Math.floor(m / 12);
  return `${y} años`;
}

/** Lista corta legible de los datos que usó el motor. */
export function findingsSummary(f: Findings | null | undefined, lang: Lang = 'es'): string[] {
  if (!f) return [];
  const out: string[] = [];
  const age = formatAge(f.edad_meses);
  if (age) out.push(age);
  if (f.sexo) out.push(f.sexo === 'F' ? 'Mujer' : 'Hombre');
  if (f.embarazada) out.push(f.semanas_embarazo ? `Embarazada (${f.semanas_embarazo} semanas)` : 'Embarazada');
  if (f.duracion_dias !== undefined) out.push(`${f.duracion_dias} ${f.duracion_dias === 1 ? 'día' : 'días'}`);
  if (f.temperatura_c !== undefined) out.push(`${f.temperatura_c} °C`);
  if (f.resp_por_min !== undefined) out.push(`${f.resp_por_min} resp. por minuto`);
  for (const [k, v] of Object.entries(f.sintomas ?? {})) if (v) out.push(symptomLabel(k, lang));
  return out;
}

export function negativesSummary(f: Findings | null | undefined, lang: Lang = 'es'): string[] {
  if (!f) return [];
  return Object.entries(f.sintomas ?? {}).filter(([, v]) => v === false).map(([k]) => symptomLabel(k, lang));
}
