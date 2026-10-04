import type { Findings } from '../../types';
import type { Rule } from './types';
import { years } from './helpers';
import { GENERAL_DANGER_RULES } from './general_danger';
import { YOUNG_INFANT_RULES } from './young_infant';
import { RESPIRATORY_CHILD_RULES } from './respiratory_child';
import { PREGNANCY_RULES } from './pregnancy';
import { DENGUE_RULES } from './dengue';
import { FEVER_RULES } from './fever';
import { DIARRHEA_RULES } from './diarrhea';
import { ADULT_RULES } from './adult';
import { COMMON_RULES } from './common';
import { CITE, SRC } from './sources';

export type { Rule, RuleBlock } from './types';

/** Orden = prioridad clínica para desempatar preguntas de seguimiento. */
export const ALL_RULES: Rule[] = [
  ...GENERAL_DANGER_RULES,
  ...YOUNG_INFANT_RULES,
  ...RESPIRATORY_CHILD_RULES,
  ...PREGNANCY_RULES,
  ...DENGUE_RULES,
  ...FEVER_RULES,
  ...DIARRHEA_RULES,
  ...ADULT_RULES,
  ...COMMON_RULES,
];

/** Regla por defecto cuando ninguna otra dispara (clasificaciones "verdes" de AIEPI / AIEPI comunitario). */
export const NO_DANGER_RULE: Rule = {
  id: 'IMCI-NOSIGNS-01',
  block: 'general_danger',
  level: 'aqui',
  applies: () => true,
  explicacion: { es: 'Con la información disponible no se encontraron signos de peligro.', nah: '' },
  accion: {
    es: 'Atender aquí con cuidados en casa: dar más líquidos y seguir alimentando (seguir con el pecho si es bebé). Llevar DE INMEDIATO a la unidad de salud si no puede beber o mamar, empeora o le da fiebre; si tiene tos: si respira rápido o con dificultad; si tiene diarrea: si hay sangre en la popó o bebe poco. Volver a revisar en 2 a 3 días.',
    nah: '',
  },
  fuente: `${CITE.ICCM}, p. 8 ("If SICK but NO danger sign: treat at home and advise caregiver"; el AIEPI comunitario cubre de 2 meses a 5 años — al bebé menor de 2 meses enfermo lo cubre IITT-Y-YI-01); ${CITE.IMCI_2014}, p. 43 del PDF ("When to return immediately")`,
  fuente_url: SRC.ICCM,
  needs: [],
  fidelidad: 'adaptado',
};

/** Variante de la acción por defecto cuando hay diarrea sin deshidratación (Plan A de la NOM-031). */
export const NO_DANGER_DIARRHEA = {
  accion: {
    es: 'Atender aquí con Plan A: después de cada evacuación dar Vida Suero Oral a cucharadas o sorbos pequeños — media taza si es menor de 1 año, una taza si es mayor — y más líquidos de los que se usan en casa. Seguir con el pecho y la comida de siempre. Dar zinc si el centro de salud lo indicó. Llevar DE INMEDIATO a la unidad de salud si hay sangre en la popó, bebe poco o no puede beber, tiene mucha sed, muchas evacuaciones aguadas, fiebre o vómito. Volver a revisar en 2 días.',
    nah: '',
  },
  fuente: `${CITE.NOM_031}, num. 7.2.6.1 (Plan A: Vida Suero Oral "media taza… una taza… después de cada evacuación") y 7.2.6.1.3 (signos de alarma: "sed intensa, poca ingesta de líquidos… numerosas heces líquidas, fiebre, vómito y sangre"); ${CITE.ICCM}, p. 8 y ${CITE.IMCI_2014}, p. 7 (Plan A con zinc)`,
  fuente_url: SRC.NOM_031,
} as const;

// ── Acción por defecto según la edad ────────────────────────────────────────
// 2 meses a <5 años (y <2 meses sin molestias): NO_DANGER_RULE / NO_DANGER_DIARRHEA tal cual (AIEPI, NOM-031).
// Edad desconocida: el mismo texto sin indicaciones de lactancia (NO_DANGER_NEUTRAL*), con id IMCI-NOSIGNS-01.
// 5 años o más: IITT-NOSIGNS-01 (abajo). Su lista "ir de inmediato si" SOLO tiene signos que ya son urgencia o
// centro_hoy en ALL_RULES a esa edad; engine.test.ts lo comprueba con los `ejemplos` de cada signo.

/** Edad desconocida: texto de NO_DANGER_RULE sin "pecho"/"mamar" (válido para cualquier edad). */
export const NO_DANGER_NEUTRAL_ACCION =
  'Atender aquí con cuidados en casa: dar más líquidos y seguir dando de comer. Llevar DE INMEDIATO a la unidad de salud si no puede beber, empeora o le da fiebre; si tiene tos: si respira rápido o con dificultad; si tiene diarrea: si hay sangre en la popó o bebe poco. Volver a revisar en 2 a 3 días. Anote la edad: las indicaciones cambian según la edad.';

/** Edad desconocida con diarrea: Plan A de NO_DANGER_DIARRHEA sin "pecho". */
export const NO_DANGER_NEUTRAL_DIARRHEA_ACCION =
  'Atender aquí con Plan A: después de cada evacuación dar Vida Suero Oral a cucharadas o sorbos pequeños — media taza si es menor de 1 año, una taza si es mayor — y más líquidos de los que se usan en casa. Seguir dando la comida de siempre. Dar zinc si el centro de salud lo indicó. Llevar DE INMEDIATO a la unidad de salud si hay sangre en la popó, bebe poco o no puede beber, tiene mucha sed, muchas evacuaciones aguadas, fiebre o vómito. Volver a revisar en 2 días. Anote la edad: las indicaciones cambian según la edad.';

/** Signo para ir de inmediato (≥5 años) y las reglas que ya lo cubren a esa edad. */
export interface ReturnSign {
  texto: string;
  reglas: string[];
  ejemplos: Omit<Findings, 'edad_meses'>[];
  desdeMeses?: number;
}
const RS = (sintomas: Record<string, boolean>, rest: Omit<Findings, 'sintomas' | 'edad_meses'> = {}) => ({ sintomas, ...rest });

/** ≥5 años, sin diarrea. Reglas: urgencia salvo IITT-Y-CIRC-01, IITT-Y-PAIN-01, IITT-VS-01/IITT-VS-PED-01 (centro_hoy). */
export const OLDER_RETURN_SIGNS: ReturnSign[] = [
  { texto: 'le cuesta trabajo respirar o se le ponen morados los labios', reglas: ['IITT-R-RESP-01', 'GEN-CYAN-01'], ejemplos: [RS({ dificultad_respirar: true }), RS({ cianosis: true })] },
  { texto: 'tiene dolor u opresión en el pecho', reglas: ['CDC-HEART-01'], ejemplos: [RS({ dolor_pecho: true })], desdeMeses: years(12) },
  { texto: 'tiene convulsiones (ataques)', reglas: ['GEN-CONV-01'], ejemplos: [RS({ convulsiones: true })] },
  { texto: 'no despierta, no responde o de repente se confunde', reglas: ['GEN-UNC-01', 'CDC-STROKE-01'], ejemplos: [RS({ inconsciente: true }), RS({ confusion: true })] },
  { texto: 'de repente se le chuequea la cara, no puede mover un lado del cuerpo o no puede hablar bien', reglas: ['CDC-STROKE-01'], ejemplos: [RS({ cara_caida: true }), RS({ debilidad_un_lado: true }), RS({ dificultad_hablar: true })] },
  { texto: 'sangra mucho', reglas: ['GEN-BLEED-01'], ejemplos: [RS({ sangrado_abundante: true })] },
  { texto: 'no puede beber o vomita todo', reglas: ['IITT-Y-CIRC-01'], ejemplos: [RS({ no_puede_beber: true }), RS({ vomita_todo: true })] },
  { texto: 'tiene un dolor muy fuerte', reglas: ['IITT-Y-PAIN-01'], ejemplos: [RS({ dolor_intenso: true })] },
  { texto: 'el termómetro marca más de 39 °C', reglas: ['IITT-VS-01', 'IITT-VS-PED-01'], ejemplos: [RS({}, { temperatura_c: 39.5 })] },
];

/** ≥5 años con diarrea sin deshidratación. Reglas: todas centro_hoy salvo GEN-UNC-01 (urgencia). */
export const OLDER_DIARRHEA_RETURN_SIGNS: ReturnSign[] = [
  { texto: 'hay sangre en la popó', reglas: ['IITT-Y-BLEED-01'], ejemplos: [RS({ diarrea: true, sangre_heces: true })] },
  { texto: 'no puede beber o vomita todo', reglas: ['IITT-Y-CIRC-01'], ejemplos: [RS({ diarrea: true, no_puede_beber: true }), RS({ diarrea: true, vomita_todo: true })] },
  { texto: 'tiene mucha sed y además los ojos hundidos o la boca seca', reglas: ['IMCI-DIAR-02'], ejemplos: [RS({ diarrea: true, bebe_con_avidez: true, ojos_hundidos: true }), RS({ diarrea: true, bebe_con_avidez: true, boca_seca: true })] },
  { texto: 'tiene mucho sueño fuera de lo normal o no despierta', reglas: ['IITT-Y-WEAK-01', 'GEN-UNC-01'], ejemplos: [RS({ diarrea: true, letargico: true }), RS({ diarrea: true, inconsciente: true })] },
  { texto: 'la diarrea dura 14 días o más', reglas: ['IMCI-DIAR-03'], ejemplos: [RS({ diarrea: true }, { duracion_dias: 14 })] },
];

const listaSi = (signs: ReturnSign[], edadMeses: number) => {
  const t = signs.filter((s) => edadMeses >= (s.desdeMeses ?? 0)).map((s) => s.texto);
  return t.length > 1 ? `${t.slice(0, -1).join('; ')}; o ${t[t.length - 1]}` : t.join('');
};

/** Acción de IITT-NOSIGNS-01 para esta edad (≥5 años), con o sin diarrea. */
export function olderNoDangerAccion(edadMeses: number, diarrea: boolean): string {
  if (!diarrea) {
    return `Atender aquí con cuidados en casa: descansar, tomar más líquidos y comer lo de siempre. Ir DE INMEDIATO a la unidad de salud o al hospital si: ${listaSi(OLDER_RETURN_SIGNS, edadMeses)}. Si no mejora o aparece otra molestia, volver a evaluar.`;
  }
  // OMS 2005, Plan A regla 1: 2 a 10 años "a half to one large cup"; "older children and adults: as much fluid as they want".
  const cantidad = edadMeses < years(10) ? 'dar Vida Suero Oral a sorbos, de media taza a una taza' : 'tomar Vida Suero Oral a sorbos, todo lo que quiera';
  return `Atender aquí con Plan A: después de cada evacuación ${cantidad}, y más líquidos de los que toma normalmente. Seguir comiendo lo de siempre. Ir DE INMEDIATO a la unidad de salud si: ${listaSi(OLDER_DIARRHEA_RETURN_SIGNS, edadMeses)}. Llevar a consulta a la unidad de salud si no mejora en 3 días.`;
}

const IITT_GREEN = `${CITE.IITT}: sin criterios rojos ni amarillos ni signos vitales de alto riesgo → "Move to low acuity or waiting area" (verde, no urgente; tablas ≥12 años y <12 años). Los signos para ir de inmediato son los de las reglas de urgencia y de centro de salud de Pahtli para esta edad`;

/** "Sin signos de peligro" para 5 años o más (el AIEPI comunitario solo cubre de 2 meses a 5 años). */
export const NO_DANGER_OLDER_RULE: Rule = {
  id: 'IITT-NOSIGNS-01',
  block: 'adult',
  level: 'aqui',
  applies: () => true,
  explicacion: { es: 'Con la información disponible no se encontraron signos de peligro.', nah: '' },
  accion: { es: olderNoDangerAccion(years(30), false), nah: '' },
  fuente: IITT_GREEN,
  fuente_url: SRC.IITT_ADULT,
  needs: [],
  // adaptado: el IITT es triaje dentro de un servicio de urgencias; aquí su verde se usa como "atender en casa".
  fidelidad: 'adaptado',
};

/** Variante de IITT-NOSIGNS-01 con diarrea sin deshidratación (Plan A de la OMS 2005 para niños mayores y adultos). */
export const NO_DANGER_OLDER_DIARRHEA = {
  fuente: `${CITE.WHO_DIARRHOEA_2005}, Plan A, p. 9–11 impresas / p. 13–15 del PDF (regla 1: "older children and adults: as much fluid as they want"; 2 a 10 años: "a half to one large cup"; regla 3: seguir alimentando; regla 4: "does not get better in three days"); ${IITT_GREEN}`,
  fuente_url: SRC.WHO_DIARRHOEA_2005,
} as const;

export const RULES_BY_ID: Record<string, Rule> = Object.fromEntries([...ALL_RULES, NO_DANGER_RULE, NO_DANGER_OLDER_RULE].map((r) => [r.id, r]));
