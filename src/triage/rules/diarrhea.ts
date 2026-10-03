import type { Findings } from '../../types';
import type { Rule } from './types';
import { anyOf, countGroups, has, isNum, knownAge, possiblyAge, years } from './helpers';
import { CITE, SRC } from './sources';

/** Signos de deshidratación GRAVE (AIEPI p. 7; IITT pediátrico rojo; NOM-031 7.2.5 choque). Cada grupo cuenta 1. */
export const SEVERE_DEHYDRATION_GROUPS: string[][] = [
  ['letargico', 'inconsciente', 'no_se_mueve'],
  ['ojos_hundidos'],
  ['no_puede_beber', 'bebe_mal'],
  ['pliegue_muy_lento'],
];

/** Signos de ALGÚN GRADO de deshidratación (AIEPI p. 7 + NOM-031 num. 7.2.4). Cada grupo cuenta 1. */
export const SOME_DEHYDRATION_GROUPS: string[][] = [
  ['irritable'],
  ['ojos_hundidos', 'sin_lagrimas'],
  ['bebe_con_avidez'],
  ['pliegue_lento', 'pliegue_muy_lento'],
  ['boca_seca'],
  ['mollera_hundida'],
];

export const severeDehydration = (f: Findings) => countGroups(f, SEVERE_DEHYDRATION_GROUPS) >= 2;
export const someDehydration = (f: Findings) =>
  anyOf(f, 'diarrea', 'vomito', 'vomito_persistente', 'vomita_todo') && countGroups(f, SOME_DEHYDRATION_GROUPS) >= 2;

const GI = (f: Findings) => anyOf(f, 'diarrea', 'vomito', 'vomito_persistente', 'vomita_todo');

const DEHY_NEEDS = [...new Set([...SEVERE_DEHYDRATION_GROUPS.flat(), ...SOME_DEHYDRATION_GROUPS.flat()])];

export const DIARRHEA_RULES: Rule[] = [
  {
    id: 'IMCI-DIAR-01',
    block: 'diarrhea',
    level: 'urgencia',
    // <12 años: como el IITT pediátrico (no exige diarrea). ≥12 años: tabla OMS 2005 para pacientes con diarrea.
    applies: (f) => severeDehydration(f) && (possiblyAge(f, 0, years(12)) || GI(f)),
    explicacion: {
      es: 'Deshidratación grave: dos o más de estos signos — muy dormido/no se mueve, ojos hundidos, no puede beber o bebe muy poco, la piel pellizcada regresa muy lento.',
      nah: '',
    },
    accion: {
      es: 'Referir URGENTE al hospital: conseguir transporte o llamar al 911 ahora. En el camino, dar sorbos frecuentes de Vida Suero Oral si puede beber y seguir con el pecho.',
      nah: '',
    },
    fuente: `${CITE.IMCI_2014}, p. 7 del PDF ("Two of the following signs… → SEVERE DEHYDRATION"); ${CITE.IITT} pediátrico, rojo "Any two of: lethargy, sunken eyes, very slow skin pinch, drinks poorly"; ${CITE.WHO_DIARRHOEA_2005}, tabla 1 "Assessment of diarrhoea patients for dehydration" (mismos signos, niños y adultos); ${CITE.NOM_031}, num. 7.2.5 (choque hipovolémico: "Inconsciente o hipotónico; No puede beber…" — criterios solo parcialmente coincidentes)`,
    fuente_url: SRC.IMCI_2014,
    needs: [...new Set(SEVERE_DEHYDRATION_GROUPS.flat()), 'edad_meses'],
    context: ['diarrea', 'vomito', 'vomito_persistente'],
    // adaptado: se extiende a ≥12 años con la tabla OMS 2005 (exige diarrea o vómito) y en <12 no exige diarrea.
    fidelidad: 'adaptado',
  },
  {
    id: 'IMCI-DIAR-02',
    block: 'diarrhea',
    level: 'centro_hoy',
    applies: (f) => someDehydration(f),
    explicacion: {
      es: 'Diarrea o vómito con algún grado de deshidratación (dos o más: inquieto/irritable, ojos hundidos o llora sin lágrimas, mucha sed, piel que regresa lento, boca seca, mollera hundida).',
      nah: '',
    },
    accion: {
      es: 'Llevar HOY a la unidad de salud para hidratarlo con Vida Suero Oral bajo vigilancia (Plan B). Mientras tanto dar Vida Suero Oral a sorbos y seguir con el pecho/comida.',
      nah: '',
    },
    fuente: `${CITE.IMCI_2014}, p. 7 del PDF ("Two of the following signs… → SOME DEHYDRATION, Plan B"); ${CITE.NOM_031}, num. 7.2.4 (dos o más signos = "caso con deshidratación") y 7.2.6.2 ("Plan B… con atención en la unidad de salud"); ${CITE.WHO_DIARRHOEA_2005}, tabla 1 (≥12 años: "two or more signs in B… SOME DEHYDRATION")`,
    fuente_url: SRC.NOM_031,
    needs: [...DEHY_NEEDS, 'diarrea', 'edad_meses'],
    context: ['diarrea', 'vomito', 'vomito_persistente'],
    // adaptado: mezcla los signos del IMCI con los de la NOM-031 7.2.4, dispara también con vómito sin diarrea y aplica a cualquier edad.
    fidelidad: 'adaptado',
  },
  {
    id: 'IMCI-DIAR-03',
    block: 'diarrhea',
    level: 'centro_hoy',
    applies: (f) => has(f, 'diarrea') && isNum(f.duracion_dias) && f.duracion_dias >= 14,
    explicacion: { es: 'Diarrea de 14 días o más (diarrea persistente).', nah: '' },
    accion: { es: 'Llevar HOY a la unidad de salud. Seguir alimentándolo y dar líquidos/Vida Suero Oral.', nah: '' },
    fuente: `${CITE.IMCI_2014}, p. 7 del PDF ("diarrhoea 14 days or more… No dehydration → PERSISTENT DIARRHOEA"); ${CITE.ICCM}, p. 6 ("Diarrhoea for 14 days or more" = DANGER SIGN); ≥5 años: ${CITE.IITT}, amarillo "Ongoing diarrhoea" (pediátrico) / "ongoing diarrhoea" (≥12 años)`,
    fuente_url: SRC.IMCI_2014,
    needs: ['diarrea', 'duracion_dias', 'edad_meses'],
    fidelidad: 'adaptado',
  },
  {
    id: 'IMCI-DIAR-04',
    block: 'diarrhea',
    level: 'urgencia',
    applies: (f) =>
      possiblyAge(f, 0, 60) &&
      has(f, 'diarrea') &&
      isNum(f.duracion_dias) &&
      f.duracion_dias >= 14 &&
      (someDehydration(f) || severeDehydration(f)),
    explicacion: { es: 'Diarrea de 14 días o más CON deshidratación (diarrea persistente grave).', nah: '' },
    accion: { es: 'Referir al hospital hoy mismo, sin demora. Dar Vida Suero Oral a sorbos en el camino.', nah: '' },
    fuente: `${CITE.IMCI_2014}, p. 7 del PDF ("Dehydration present → SEVERE PERSISTENT DIARRHOEA… Refer to hospital", rosa)`,
    fuente_url: SRC.IMCI_2014,
    needs: ['diarrea', 'duracion_dias', 'edad_meses', ...DEHY_NEEDS],
    fidelidad: 'verbatim',
  },
  {
    id: 'IMCI-DIAR-05',
    block: 'diarrhea',
    level: 'centro_hoy',
    applies: (f) => possiblyAge(f, 0, 60) && has(f, 'sangre_heces'),
    explicacion: { es: 'Niño menor de 5 años con sangre en la popó (disentería).', nah: '' },
    accion: { es: 'Llevar HOY a la unidad de salud (necesita valoración y antibiótico). Dar líquidos y Vida Suero Oral. Reportar: puede ser parte de un brote.', nah: '' },
    fuente: `${CITE.IMCI_2014}, p. 7 del PDF ("Blood in the stool → DYSENTERY", amarillo); ${CITE.ICCM}, p. 6 ("Blood in stool" = DANGER SIGN); ${CITE.NOM_031}, num. 7.2.6.1.3 (sangre en evacuaciones = signo de alarma)`,
    fuente_url: SRC.IMCI_2014,
    needs: ['sangre_heces', 'edad_meses'],
    context: ['diarrea'],
    fidelidad: 'adaptado',
  },
  {
    id: 'IITT-Y-YI-DIAR-01',
    block: 'diarrhea',
    level: 'centro_hoy',
    applies: (f) => knownAge(f, 0, 2) && has(f, 'diarrea'),
    explicacion: { es: 'Bebé menor de 2 meses con diarrea.', nah: '' },
    accion: { es: 'Llevar HOY a la unidad de salud. Seguir con el pecho más seguido; dar Vida Suero Oral a cucharaditas si se lo indican. Si bebe mal, tiene ojos hundidos o casi no se mueve: URGENCIA.', nah: '' },
    fuente: `${CITE.ICCM}, p. 3 (cubre de 2 meses a 5 años; "any condition you cannot manage → Refer child to health facility"); ${CITE.IITT} pediátrico, amarillo "Any infant 8 days to 6 months old" y "Ongoing diarrhoea"`,
    fuente_url: SRC.IITT_PED,
    needs: ['diarrea', 'edad_meses'],
    fidelidad: 'adaptado',
  },
];
