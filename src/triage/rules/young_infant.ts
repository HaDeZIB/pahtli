import type { Rule } from './types';
import { anyComplaint, anyOf, days, has, isNum, isPostpartum, isPregnant, knownAge } from './helpers';
import { CITE, SRC } from './sources';

/** Lactante menor de 2 meses: estas reglas exigen edad CONOCIDA (< 2 meses). */
const YI = (f: Parameters<Rule['applies']>[0]) => knownAge(f, 0, 2);

const REFER_YI =
  'Referir URGENTE al hospital: conseguir transporte o llamar al 911 ahora. Mantener al bebé calientito (piel con piel con la mamá, bien tapado) y seguir dándole pecho en el camino si puede.';

export const YOUNG_INFANT_RULES: Rule[] = [
  {
    id: 'IMCI-YI-01',
    block: 'young_infant',
    level: 'urgencia',
    applies: (f) => YI(f) && anyOf(f, 'no_come_bien', 'no_puede_beber'),
    explicacion: { es: 'Bebé menor de 2 meses que no come bien o no puede mamar.', nah: '' },
    accion: { es: REFER_YI, nah: '' },
    fuente: `${CITE.IMCI_YI_2019}, p. 1 impresa / p. 5 del PDF ("Not able to feed at all or not feeding well" → POSSIBLE SERIOUS BACTERIAL INFECTION OR VERY SEVERE DISEASE, refer URGENTLY)`,
    fuente_url: SRC.IMCI_YI_2019,
    needs: ['no_come_bien', 'no_puede_beber', 'edad_meses'],
    fidelidad: 'verbatim',
  },
  {
    id: 'IMCI-YI-02',
    block: 'young_infant',
    level: 'urgencia',
    applies: (f) => YI(f) && (f.edad_meses as number) < days(7) && isNum(f.resp_por_min) && f.resp_por_min >= 60,
    explicacion: { es: 'Recién nacido de menos de 7 días con respiración rápida (60 o más por minuto).', nah: '' },
    accion: { es: REFER_YI, nah: '' },
    fuente: `${CITE.IMCI_YI_2019}, p. 1 impresa / p. 5 del PDF ("Fast breathing (60 breaths per minute or more) in infants less than 7 days old" → refer URGENTLY)`,
    fuente_url: SRC.IMCI_YI_2019,
    needs: ['edad_meses', 'resp_por_min'],
    fidelidad: 'verbatim',
  },
  {
    id: 'IMCI-YI-03',
    block: 'young_infant',
    level: 'centro_hoy',
    applies: (f) => YI(f) && (f.edad_meses as number) >= days(7) && isNum(f.resp_por_min) && f.resp_por_min >= 60,
    explicacion: { es: 'Bebé de 7 a 59 días con respiración rápida (60 o más por minuto).', nah: '' },
    accion: {
      es: 'La guía de la OMS (2019) lo trata en la unidad de salud, pero la norma mexicana NOM-031 manda al hospital a todo bebé menor de 2 meses con respiración rápida: seguir la indicación de URGENCIA. Mantenerlo calientito y con pecho.',
      nah: '',
    },
    fuente: `${CITE.IMCI_YI_2019}, p. 1 impresa / p. 5 del PDF ("Fast breathing (60 breaths per minute or more) in infants 7–59 days old" → PNEUMONIA, amoxicilina oral, control en 3 días)`,
    fuente_url: SRC.IMCI_YI_2019,
    needs: ['edad_meses', 'resp_por_min'],
    fidelidad: 'adaptado',
  },
  {
    id: 'IMCI-YI-04',
    block: 'young_infant',
    level: 'urgencia',
    // Decisión provisional #1 (docs/decisiones-clinicas.md): umbral medido >= 38 °C (NOM-031 3.33 + IMCI 2019).
    // La calentura referida por la familia sigue disparando (NOM-007 5.6.1.9: "fiebre" sin umbral). 37.5–37.9 °C medido → piso IITT-Y-YI-01.
    applies: (f) => YI(f) && (has(f, 'fiebre') || (isNum(f.temperatura_c) && f.temperatura_c >= 38)),
    explicacion: { es: 'Bebé menor de 2 meses con fiebre (calentura referida o 38 °C o más en la axila).', nah: '' },
    accion: { es: `${REFER_YI} No abrigar de más si está muy caliente.`, nah: '' },
    fuente: `${CITE.NOM_031}, num. 3.33 ("Fiebre… arriba de 38.0ºC"); ${CITE.IMCI_YI_2019}, p. 1 impresa / p. 5 del PDF ("High body temperature (38°C* or above)" → POSSIBLE SERIOUS BACTERIAL INFECTION, refer URGENTLY); ${CITE.NOM_007}, num. 5.6.1.9 ("fiebre" de la persona recién nacida, sin umbral, "amerita atención médica urgente")`,
    fuente_url: SRC.IMCI_YI_2019,
    needs: ['fiebre', 'temperatura_c', 'edad_meses'],
    // adaptado: además del umbral medido, dispara con calentura referida (la promotora a menudo no tiene termómetro).
    fidelidad: 'adaptado',
  },
  {
    id: 'IMCI-YI-05',
    block: 'young_infant',
    level: 'urgencia',
    applies: (f) => YI(f) && (has(f, 'se_siente_frio') || (isNum(f.temperatura_c) && f.temperatura_c < 35.5)),
    explicacion: { es: 'Bebé menor de 2 meses con temperatura baja (frío al tacto o menos de 35.5 °C).', nah: '' },
    accion: { es: `${REFER_YI} Calentarlo piel con piel con la mamá durante el traslado.`, nah: '' },
    fuente: `${CITE.IMCI_YI_2019}, p. 1 impresa / p. 5 del PDF ("Low body temperature (less than 35.5°C)" → refer URGENTLY); ${CITE.NOM_007}, num. 5.6.1.9 (hipotermia del recién nacido)`,
    fuente_url: SRC.IMCI_YI_2019,
    needs: ['se_siente_frio', 'temperatura_c', 'edad_meses'],
    // adaptado: la fuente exige temperatura axilar medida; aquí también dispara con "frío al tacto".
    fidelidad: 'adaptado',
  },
  {
    id: 'IMCI-YI-06',
    block: 'young_infant',
    level: 'urgencia',
    applies: (f) => YI(f) && anyOf(f, 'no_se_mueve', 'letargico', 'debilidad_general'),
    explicacion: { es: 'Bebé menor de 2 meses que solo se mueve si lo estimulan, no se mueve o está sin fuerza (flojito).', nah: '' },
    accion: { es: REFER_YI, nah: '' },
    fuente: `${CITE.IMCI_YI_2019}, p. 1 impresa / p. 5 del PDF ("Movement only when stimulated or no movement at all" → refer URGENTLY)`,
    fuente_url: SRC.IMCI_YI_2019,
    needs: ['no_se_mueve', 'letargico', 'edad_meses'],
    // adaptado: se agregó "sin fuerza" (debilidad_general) como equivalente referido de "solo se mueve si lo estimulan".
    fidelidad: 'adaptado',
  },
  {
    id: 'IMCI-YI-07',
    block: 'young_infant',
    level: 'urgencia',
    applies: (f) =>
      YI(f) && (has(f, 'palmas_plantas_amarillas') || (has(f, 'ictericia') && (f.edad_meses as number) < days(1))),
    explicacion: { es: 'Ictericia grave (color amarillo): palmas y plantas amarillas, o color amarillo en las primeras 24 horas de vida.', nah: '' },
    accion: { es: REFER_YI, nah: '' },
    fuente: `${CITE.IMCI_2014}, p. 46 del PDF ("Any jaundice if age less than 24 hours or Yellow palms and soles at any age → SEVERE JAUNDICE, refer URGENTLY")`,
    fuente_url: SRC.IMCI_2014,
    needs: ['ictericia', 'palmas_plantas_amarillas', 'edad_meses'],
    context: ['ictericia'],
    fidelidad: 'verbatim',
  },
  {
    id: 'IMCI-YI-08',
    block: 'young_infant',
    level: 'centro_hoy',
    applies: (f) => YI(f) && has(f, 'ictericia'),
    explicacion: { es: 'Bebé menor de 2 meses con color amarillo de piel u ojos.', nah: '' },
    accion: {
      es: 'Llevar HOY a la unidad de salud (revisión en 1 día). Si el bebé tiene más de 14 días (OMS 2019: más de 3 semanas), necesita valoración en hospital. Si las palmas y plantas se ponen amarillas: URGENCIA.',
      nah: '',
    },
    fuente: `${CITE.IMCI_2014}, p. 46 del PDF ("Jaundice appearing after 24 hours… → JAUNDICE, follow-up in 1 day"; "If the young infant is older than 14 days, refer to a hospital for assessment"); ${CITE.IMCI_YI_2019}, p. 5 del PDF ("older than 3 weeks, refer to a hospital for assessment")`,
    fuente_url: SRC.IMCI_2014,
    needs: ['ictericia', 'edad_meses'],
    fidelidad: 'adaptado',
  },
  {
    id: 'IMCI-YI-09',
    block: 'young_infant',
    level: 'centro_hoy',
    applies: (f) => YI(f) && anyOf(f, 'ombligo_rojo_pus', 'pustulas_piel'),
    explicacion: { es: 'Bebé menor de 2 meses con ombligo rojo o con pus, o granitos con pus en la piel (infección local).', nah: '' },
    accion: { es: 'Llevar HOY a la unidad de salud (necesita antibiótico y revisión en 2 días). No poner nada en el ombligo.', nah: '' },
    fuente: `${CITE.IMCI_YI_2019}, p. 1 impresa / p. 5 del PDF ("Umbilicus red or draining pus; Skin pustules" → LOCAL BACTERIAL INFECTION)`,
    fuente_url: SRC.IMCI_YI_2019,
    needs: ['ombligo_rojo_pus', 'pustulas_piel', 'edad_meses'],
    fidelidad: 'adaptado',
  },
  {
    id: 'NOM007-RN-01',
    block: 'young_infant',
    level: 'centro_hoy',
    applies: (f) =>
      knownAge(f, 0, days(28)) && anyOf(f, 'llanto_inconsolable', 'distension_abdominal', 'vomito', 'vomito_persistente', 'no_orina_no_evacua'),
    explicacion: { es: 'Recién nacido (menos de 28 días) con llanto que no se calma, panza inflada, vómito, o que no hace pipí o popó.', nah: '' },
    accion: { es: 'Llevar HOY a la unidad de salud, lo antes posible. Si además no come, está muy dormido o tiene fiebre: URGENCIA.', nah: '' },
    fuente: `${CITE.NOM_007}, num. 5.6.1.9 (signos de alarma de la persona recién nacida: "micción y evacuación presente… llanto inconsolable… vómito, distensión abdominal" que "ameritan atención médica urgente")`,
    fuente_url: SRC.NOM_007,
    needs: ['llanto_inconsolable', 'distension_abdominal', 'vomito', 'no_orina_no_evacua', 'edad_meses'],
    fidelidad: 'adaptado',
  },
  {
    id: 'NOM007-RN-02',
    block: 'young_infant',
    level: 'urgencia',
    applies: (f) => YI(f) && anyOf(f, 'dificultad_respirar', 'quejido', 'aleteo_nasal'),
    explicacion: { es: 'Bebé menor de 2 meses con dificultad para respirar (incluye quejido o aleteo de la nariz).', nah: '' },
    accion: { es: REFER_YI, nah: '' },
    fuente: `${CITE.NOM_007}, num. 5.6.1.9 ("dificultad respiratoria" de la persona recién nacida "amerita atención médica urgente"); ${CITE.IITT} pediátrico (<12 años), rojo "Respiratory distress"`,
    fuente_url: SRC.NOM_007,
    needs: ['dificultad_respirar', 'quejido', 'aleteo_nasal', 'edad_meses'],
    fidelidad: 'adaptado',
  },
  {
    id: 'IITT-R-YI-TEMP-01',
    block: 'young_infant',
    level: 'urgencia',
    applies: (f) => YI(f) && isNum(f.temperatura_c) && (f.temperatura_c < 36 || f.temperatura_c > 39),
    explicacion: { es: 'Bebé menor de 2 meses con temperatura medida menor de 36 °C o mayor de 39 °C.', nah: '' },
    accion: { es: `${REFER_YI} Si está frío, calentarlo piel con piel con la mamá.`, nah: '' },
    fuente: `${CITE.IITT} pediátrico (<12 años), criterio rojo "Age <2 months and temp <36 or >39°C"`,
    fuente_url: SRC.IITT_PED,
    needs: ['temperatura_c', 'edad_meses'],
    fidelidad: 'verbatim',
  },
  {
    id: 'IITT-R-NEONATE-01',
    block: 'young_infant',
    level: 'urgencia',
    // IITT pone en rojo a cualquier bebé <8 días solo por la edad; aquí se exige además que se reporte alguna molestia.
    applies: (f) => knownAge(f, 0, days(8)) && !isPregnant(f) && !isPostpartum(f) && anyComplaint(f),
    explicacion: { es: 'Recién nacido de menos de 8 días con cualquier molestia o signo de enfermedad.', nah: '' },
    accion: { es: REFER_YI, nah: '' },
    fuente: `${CITE.IITT} pediátrico (<12 años), criterio rojo "Any infant <8 days old"`,
    fuente_url: SRC.IITT_PED,
    needs: ['edad_meses'],
    fidelidad: 'adaptado',
  },
  {
    id: 'IITT-Y-YI-01',
    block: 'young_infant',
    level: 'centro_hoy',
    // Piso para el lactante enfermo: la promotora no puede completar la exploración del AIEPI del lactante
    // (temperatura axilar, respiraciones, tiraje grave, movimiento), así que "infección poco probable" no aplica.
    // También con temperatura medida de 37.5 a 37.9 °C (decisión provisional #1): el IMCI 2014 (p. 45) la consideraba fiebre; no se deja en "aquí".
    applies: (f) =>
      YI(f) && !isPregnant(f) && !isPostpartum(f) && (anyComplaint(f) || (isNum(f.temperatura_c) && f.temperatura_c >= 37.5)),
    explicacion: { es: 'Bebé menor de 2 meses con alguna molestia o temperatura de 37.5 °C o más: a esta edad lo debe revisar personal de salud el mismo día.', nah: '' },
    accion: {
      es: 'Llevar HOY a la unidad de salud. Mantenerlo calientito y seguir con el pecho. Si no come, está frío o caliente, respira con dificultad o casi no se mueve: URGENCIA.',
      nah: '',
    },
    fuente: `${CITE.IITT} pediátrico (<12 años), criterio amarillo "Any infant 8 days to 6 months old"; ${CITE.IMCI_2014}, p. 45 del PDF ("Fever (37.5°C or above)", umbral anterior al de 2019); ${CITE.ICCM}, p. 3 (el AIEPI comunitario cubre de 2 meses a 5 años; "any condition you cannot manage → Refer child to health facility")`,
    fuente_url: SRC.IITT_PED,
    needs: ['edad_meses'],
    fidelidad: 'adaptado',
  },
];
