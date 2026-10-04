import type { Findings } from '../../types';

/** Meses por día (año juliano / 12 / días). */
export const MONTHS_PER_DAY = 1 / 30.4375;
export const days = (d: number) => d * MONTHS_PER_DAY;
export const years = (y: number) => y * 12;

export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Síntoma presente SOLO si es true explícito. undefined/false nunca disparan. */
export const has = (f: Findings, k: string) => f.sintomas?.[k] === true;
export const anyOf = (f: Findings, ...ks: string[]) => ks.some((k) => has(f, k));
/** Cuenta grupos de signos: cada grupo vale 1 si cualquiera de sus claves es true. */
export const countGroups = (f: Findings, groups: string[][]) => groups.filter((g) => anyOf(f, ...g)).length;

/**
 * Edad POSIBLEMENTE en [min, max) meses. Si la edad no se conoce devuelve true:
 * una edad desconocida solo puede hacer que más reglas apliquen (sube, nunca baja).
 */
export function possiblyAge(f: Findings, min: number, max = Infinity): boolean {
  const a = f.edad_meses;
  if (!isNum(a)) return true;
  return a >= min && a < max;
}

/** Edad CONOCIDA en [min, max) meses. Para reglas que no deben dispararse sin edad (lactante <2 meses). */
export function knownAge(f: Findings, min: number, max = Infinity): boolean {
  const a = f.edad_meses;
  return isNum(a) && a >= min && a < max;
}

/** Fiebre referida o temperatura axilar >= 37.5 °C (definición de AIEPI/IMCI 2014, p. 8). */
export const hasFever = (f: Findings) => has(f, 'fiebre') || (isNum(f.temperatura_c) && f.temperatura_c >= 37.5);

/** Fiebre ahora, o fiebre en los últimos días aunque ya se quitó (dengue: los signos de alarma aparecen a la caída de la fiebre, OPS 2020 p. 7). */
export const hadFever = (f: Findings) => hasFever(f) || has(f, 'fiebre_reciente');

/** Claves que describen contexto, no una molestia del paciente (no cuentan para "lactante enfermo"). */
const NON_COMPLAINT = new Set(['posparto', 'lejos_unidad', 'bajo_peso_nacer', 'sarampion_reciente']);
/** ¿Se reportó al menos una molestia o signo (true explícito)? */
export const anyComplaint = (f: Findings) =>
  Object.entries(f.sintomas ?? {}).some(([k, v]) => v === true && !NON_COMPLAINT.has(k));

export const isPregnant = (f: Findings) => f.embarazada === true;
export const isPostpartum = (f: Findings) => has(f, 'posparto');

/** Tos o dificultad para respirar (entrada del cuadro respiratorio de AIEPI). */
export const coughOrDB = (f: Findings) => anyOf(f, 'tos', 'dificultad_respirar', 'respira_rapido');

export const EMPTY = { nah: '' } as const;

/**
 * ¿Puede estar embarazada o en el puerperio? No si es hombre o si la edad conocida está fuera de 10–49 años
 * ("mujeres en edad fértil (de 15 a 49 años)": PEF 2019, Ramo 12 Salud, Estrategia programática, p. 3; el mismo
 * documento cuenta el embarazo adolescente desde los 12 años, así que se amplía hacia abajo hasta los 10).
 * Con la edad desconocida, sí. Si ya se dijo que está embarazada o en la cuarentena, se respeta.
 */
export function pregnancyPossible(f: Findings): boolean {
  // Ronda 4: de 2 meses a 9 años no hay embarazo posible aunque el relato lo diga (es de otra persona). Con menos de
  // 2 meses y embarazo o cuarentena, el caso es de la mamá (la edad es la del recién nacido).
  if (isNum(f.edad_meses) && f.edad_meses >= 2 && f.edad_meses < years(10)) return false;
  if (f.embarazada === true || has(f, 'posparto')) return true;
  if (f.sexo === 'M') return false;
  return !(isNum(f.edad_meses) && (f.edad_meses < years(10) || f.edad_meses >= years(50)));
}

