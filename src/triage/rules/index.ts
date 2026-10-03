import type { Rule } from './types';
import { GENERAL_DANGER_RULES } from './general_danger';
import { YOUNG_INFANT_RULES } from './young_infant';
import { RESPIRATORY_CHILD_RULES } from './respiratory_child';
import { PREGNANCY_RULES } from './pregnancy';
import { DENGUE_RULES } from './dengue';
import { FEVER_RULES } from './fever';
import { DIARRHEA_RULES } from './diarrhea';
import { ADULT_RULES } from './adult';
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

export const RULES_BY_ID: Record<string, Rule> = Object.fromEntries([...ALL_RULES, NO_DANGER_RULE].map((r) => [r.id, r]));
