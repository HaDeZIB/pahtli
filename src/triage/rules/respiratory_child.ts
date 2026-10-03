import type { Rule } from './types';
import type { Findings } from '../../types';
import { anyOf, coughOrDB, has, isNum, knownAge, possiblyAge, years } from './helpers';
import { CITE, SRC } from './sources';

/** Respiración rápida contada (neumonía leve / polipnea): NOM-031 3.64 y AIEPI. */
export const fastBreathing = (f: Findings): boolean => {
  if (!isNum(f.resp_por_min)) return false;
  if (knownAge(f, 0, 2)) return f.resp_por_min >= 60;
  if (!coughOrDB(f)) return false;
  if (knownAge(f, 2, 12)) return f.resp_por_min >= 50;
  return possiblyAge(f, 12, 60) && f.resp_por_min >= 40;
};

/** Factores de mal pronóstico de la NOM-031 (3.32) que la promotora puede saber. */
const poorPrognosis = (f: Findings) =>
  knownAge(f, 0, 2) ||
  anyOf(f, 'lejos_unidad', 'desnutricion', 'hinchazon_ambos_pies') ||
  (possiblyAge(f, 0, 12) && has(f, 'bajo_peso_nacer'));

const CENTRO_HOY_RESP =
  'Llevar HOY a la unidad de salud (necesita valoración y probablemente antibiótico que da el centro de salud). Seguir dándole pecho y líquidos. Si aparece tiraje, ruido al respirar, se pone morado o no puede beber: es URGENCIA.';

export const RESPIRATORY_CHILD_RULES: Rule[] = [
  {
    id: 'IMCI-RESP-01',
    block: 'respiratory_child',
    level: 'centro_hoy',
    applies: (f) => coughOrDB(f) && knownAge(f, 2, 12) && isNum(f.resp_por_min) && f.resp_por_min >= 50,
    explicacion: { es: 'Bebé de 2 a 11 meses con tos o dificultad para respirar y respiración rápida (50 o más por minuto).', nah: '' },
    accion: { es: CENTRO_HOY_RESP, nah: '' },
    fuente: `${CITE.IMCI_2014}, p. 6 del PDF: "2 months up to 12 months: 50 breaths per minute or more" → PNEUMONIA (amarillo)`,
    fuente_url: SRC.IMCI_2014,
    needs: ['tos', 'dificultad_respirar', 'edad_meses', 'resp_por_min'],
    fidelidad: 'adaptado',
  },
  {
    id: 'IMCI-RESP-02',
    block: 'respiratory_child',
    level: 'centro_hoy',
    applies: (f) => coughOrDB(f) && possiblyAge(f, 12, 60) && isNum(f.resp_por_min) && f.resp_por_min >= 40,
    explicacion: { es: 'Niño (de 1 a 4 años, o con edad aún no confirmada) con tos o dificultad para respirar y respiración rápida (40 o más por minuto). Confirmar la edad.', nah: '' },
    accion: { es: CENTRO_HOY_RESP, nah: '' },
    fuente: `${CITE.IMCI_2014}, p. 6 del PDF: "12 months up to 5 years: 40 breaths per minute or more" → PNEUMONIA (amarillo); ${CITE.ICCM}, p. 8`,
    fuente_url: SRC.IMCI_2014,
    needs: ['tos', 'dificultad_respirar', 'edad_meses', 'resp_por_min'],
    fidelidad: 'adaptado',
  },
  {
    id: 'NOM031-IRA-01',
    block: 'respiratory_child',
    level: 'centro_hoy',
    // Respiración rápida referida por la madre y aún no contada: se trata como signo de alarma hasta contarla.
    applies: (f) => possiblyAge(f, 0, years(12)) && has(f, 'respira_rapido') && !isNum(f.resp_por_min),
    explicacion: { es: 'La familia refiere que el niño respira rápido (aún no se han contado las respiraciones).', nah: '' },
    accion: {
      es: 'Contar las respiraciones 1 minuto completo con el niño tranquilo. Mientras tanto, llevar HOY a la unidad de salud. Si hay tiraje, ruido al respirar o se pone morado: URGENCIA.',
      nah: '',
    },
    fuente: `${CITE.NOM_031}, num. 8.2.5.1.3.1: signos de alarma "(respiración rápida, tiraje, dificultad para respirar…)" → "acuda urgentemente a la unidad de salud más cercana"; ${CITE.IMCI_2014}, p. 43 del PDF ("Return immediately… Fast breathing"); de 5 a 11 años: ${CITE.IITT} pediátrico, signo vital de alto riesgo "RR 5-12 years High 30"`,
    fuente_url: SRC.NOM_031,
    needs: ['respira_rapido', 'resp_por_min', 'edad_meses'],
    // adaptado: la NOM-031 cubre menores de 5 años; se extiende a <12 años con el IITT pediátrico.
    fidelidad: 'adaptado',
  },
  {
    id: 'IMCI-RESP-03',
    block: 'respiratory_child',
    level: 'urgencia',
    applies: (f) => has(f, 'tiraje'),
    explicacion: { es: 'Tiraje subcostal: se le hunde la parte baja del pecho al respirar. Dificultad respiratoria grave.', nah: '' },
    accion: { es: 'Referir URGENTE al hospital: conseguir transporte o llamar al 911 ahora. Mantenerlo abrigado y seguir dándole pecho si puede.', nah: '' },
    fuente: `${CITE.ICCM}, p. 6 ("Chest indrawing" = DANGER SIGN, "refer urgently"); ${CITE.NOM_031}, num. 8.2.3 y 8.2.5.3.1.1 (tiraje = neumonía grave, "Envío inmediato a un hospital"); ${CITE.IITT}, rojo "Respiratory distress"`,
    fuente_url: SRC.ICCM,
    needs: ['tiraje'],
    context: ['tos', 'dificultad_respirar', 'respira_rapido'],
    fidelidad: 'adaptado',
  },
  {
    id: 'NOM031-IRA-02',
    block: 'respiratory_child',
    level: 'centro_hoy',
    applies: (f) => possiblyAge(f, 0, 60) && has(f, 'dificultad_respirar'),
    explicacion: { es: 'Niño menor de 5 años con dificultad para respirar.', nah: '' },
    accion: {
      es: 'Contar las respiraciones y buscar tiraje. Llevar HOY a la unidad de salud. Si hay tiraje, ruido al respirar o se pone morado: URGENCIA.',
      nah: '',
    },
    fuente: `${CITE.NOM_031}, num. 8.2.5.1.3.1 y 8.2.5.2.3.1 ("dificultad para respirar" → "acuda urgentemente a la unidad de salud más cercana"); ${CITE.IMCI_2014}, p. 43 del PDF ("Return immediately… Difficult breathing")`,
    fuente_url: SRC.NOM_031,
    needs: ['dificultad_respirar', 'edad_meses'],
    fidelidad: 'verbatim',
  },
  {
    id: 'NOM031-IRA-03',
    block: 'respiratory_child',
    level: 'urgencia',
    applies: (f) => fastBreathing(f) && poorPrognosis(f),
    explicacion: {
      es: 'Respiración rápida (neumonía leve) con un factor de mal pronóstico: menor de 2 meses, desnutrición, bajo peso al nacer (menor de 1 año) o dificultad para llegar a la unidad de salud.',
      nah: '',
    },
    accion: { es: 'Referir URGENTE al hospital: conseguir transporte o llamar al 911 ahora. Mantenerlo abrigado y seguir dándole pecho o líquidos.', nah: '' },
    fuente: `${CITE.NOM_031}, num. 3.32 (factores de mal pronóstico: "menor de dos meses, desnutrición… dificultad para trasladarse a una unidad de salud y menor de un año con bajo peso al nacer") y 8.2.5.3 ("Plan C… neumonía leve, con factores de mal pronóstico": "Envío inmediato a un hospital")`,
    fuente_url: SRC.NOM_031,
    needs: ['resp_por_min', 'edad_meses', 'lejos_unidad', 'desnutricion', 'bajo_peso_nacer'],
    // adaptado: no se capturan madre <17 años o analfabeta ni muerte previa de un menor de 5 años en el hogar.
    fidelidad: 'adaptado',
  },
  {
    id: 'NICE-RESP-01',
    block: 'respiratory_child',
    level: 'urgencia',
    applies: (f) => possiblyAge(f, 0, 60) && has(f, 'quejido'),
    explicacion: { es: 'Niño menor de 5 años que se queja (quejido) al respirar: dificultad respiratoria grave.', nah: '' },
    accion: { es: 'Referir URGENTE al hospital: conseguir transporte o llamar al 911 ahora. Mantenerlo abrigado y en la posición en que respire mejor.', nah: '' },
    fuente: `${CITE.NICE_NG143}, rec. 1.2.5 y tabla 2 (alto riesgo, "rojo": "grunting"; rec. 1.4.3: "red" → referir urgentemente)`,
    fuente_url: SRC.NICE_NG143,
    needs: ['quejido', 'edad_meses'],
    context: ['tos', 'dificultad_respirar', 'respira_rapido', 'fiebre'],
    // adaptado: guía británica para niños <5 con fiebre; se aplica aunque no haya fiebre.
    fidelidad: 'adaptado',
  },
  {
    id: 'NICE-RESP-02',
    block: 'respiratory_child',
    // Decisión provisional #12 (docs/decisiones-clinicas.md): se sigue el IITT (rojo), más protector que NICE (ámbar).
    level: 'urgencia',
    applies: (f) => possiblyAge(f, 0, 60) && has(f, 'aleteo_nasal'),
    explicacion: { es: 'Niño menor de 5 años con aleteo nasal (se le abren las narices al respirar): signo de dificultad respiratoria.', nah: '' },
    accion: { es: 'Referir URGENTE al hospital: conseguir transporte o llamar al 911 ahora. Mantenerlo abrigado, en la posición en que respire mejor, y seguir dándole pecho o líquidos si puede.', nah: '' },
    fuente: `${CITE.IITT} pediátrico (<12 años), rojo "Respiratory distress*"; tarjeta de referencia del IITT, "Signs of Respiratory Distress", niño: "Nasal flaring, grunting"; ${CITE.NICE_NG143}, rec. 1.2.6 y tabla 2 ("nasal flaring" = riesgo intermedio, ámbar: la guía británica es menos protectora)`,
    fuente_url: SRC.IITT_REFCARD,
    needs: ['aleteo_nasal', 'edad_meses'],
    context: ['tos', 'dificultad_respirar', 'respira_rapido'],
    fidelidad: 'adaptado',
  },
  {
    id: 'IITT-VS-PED-01',
    block: 'respiratory_child',
    level: 'centro_hoy',
    applies: (f) =>
      knownAge(f, 60, years(12)) &&
      ((isNum(f.resp_por_min) && f.resp_por_min > 30) || (isNum(f.temperatura_c) && (f.temperatura_c > 39 || f.temperatura_c < 36))),
    explicacion: { es: 'Niño de 5 a 11 años con signos vitales de alto riesgo (más de 30 respiraciones por minuto, o temperatura mayor de 39 °C o menor de 36 °C).', nah: '' },
    accion: { es: 'Llevar HOY a la unidad de salud para valoración por personal clínico. Si aparece dificultad para respirar, se pone morado o está muy dormido: URGENCIA.', nah: '' },
    fuente: `${CITE.IITT} pediátrico (<12 años), "High-risk vital signs": "RR 5-12 years High 30", "Temp <36° or >39°" → "up-triage or immediate review by supervising clinician"`,
    fuente_url: SRC.IITT_PED,
    needs: ['resp_por_min', 'temperatura_c', 'edad_meses'],
    fidelidad: 'adaptado',
  },
  {
    id: 'IMCI-RESP-04',
    block: 'respiratory_child',
    level: 'centro_hoy',
    applies: (f) => possiblyAge(f, 0, 60) && has(f, 'tos') && isNum(f.duracion_dias) && f.duracion_dias >= 14,
    explicacion: { es: 'Niño menor de 5 años con tos de 14 días o más.', nah: '' },
    accion: { es: 'Llevar HOY a la unidad de salud para valorar tuberculosis, asma u otra causa.', nah: '' },
    fuente: `${CITE.IMCI_2014}, p. 6 del PDF ("If coughing for more than 14 days… refer for possible TB or asthma assessment"); ${CITE.ICCM}, p. 6 ("Cough for 14 days or more" = DANGER SIGN)`,
    fuente_url: SRC.ICCM,
    needs: ['tos', 'duracion_dias', 'edad_meses'],
    fidelidad: 'adaptado',
  },
  {
    id: 'IITT-Y-WHEEZE-01',
    block: 'respiratory_child',
    level: 'centro_hoy',
    applies: (f) => has(f, 'sibilancias'),
    explicacion: { es: 'Le silba el pecho (sibilancias).', nah: '' },
    accion: { es: 'Llevar HOY a la unidad de salud (puede necesitar broncodilatador inhalado). Si hay tiraje o se pone morado: URGENCIA.', nah: '' },
    fuente: `${CITE.IITT}, criterio amarillo "Wheezing (no red criteria)" (tablas adulto y pediátrica); ${CITE.IMCI_2014}, p. 6 del PDF (sibilancias → broncodilatador inhalado)`,
    fuente_url: SRC.IITT_PED,
    needs: ['sibilancias'],
    context: ['tos', 'dificultad_respirar'],
    fidelidad: 'verbatim',
  },
];
