/**
 * Revisión de signos de peligro antes de "Atender aquí" (decisión provisional, docs/decisiones-clinicas.md #20).
 *
 * El verde de AIEPI ("no danger signs → treat at home") supone que el trabajador de salud REVISÓ los signos
 * generales de peligro (IMCI 2014, p. 2 impresa / p. 5 del PDF: "CHECK FOR GENERAL DANGER SIGNS" va antes de
 * cualquier otra clasificación). Un relato que no menciona un signo no prueba que no lo tenga. Por eso, cuando el
 * resultado iba a ser `aqui`, el motor pregunta primero una sola pregunta Sí/No con la lista de signos para la edad.
 *
 * `signo_peligro_general` NO está en SYMPTOMS a propósito: solo se llena respondiendo esta pregunta. Así el
 * extractor por palabras clave, el LLM (esquema y parseLLMOutput) y los botones de captura no pueden marcarlo.
 *
 * Cada signo de cada lista ya es `urgencia` por su propia regla a esa edad (`reglas`); `ejemplos` son hallazgos
 * que lo representan y engine.test.ts comprueba que disparan esas reglas con nivel urgencia. "Sí" a la pregunta
 * dispara PAHTLI-GDS-SCREEN (urgencia): el mismo nivel que daría el signo por separado.
 */
import type { Findings } from '../types';
import { isNum, knownAge, years } from './rules/helpers';

export const SCREENING_KEY = 'signo_peligro_general';
export const SCREENING_KEYS: readonly string[] = [SCREENING_KEY];
export const isScreeningKey = (k: string) => SCREENING_KEYS.includes(k);

/** Etiqueta para "datos que usó el motor". */
export const SCREENING_LABEL = 'Tiene un signo de peligro (revisión de signos de peligro)';

/** Texto de "Por qué" de la pregunta (se muestra en la pantalla de preguntas). */
export const SCREENING_WHY = 'Antes de indicar cuidados en casa hay que confirmar que no tiene ningún signo de peligro. Si tiene uno, es urgencia.';

export interface SignoConRegla {
  texto: string;
  /** Reglas de ALL_RULES que ya dan el nivel por este signo a esa edad. */
  reglas: string[];
  /** Hallazgos que representan el signo (sin edad). Las pruebas verifican que disparan `reglas`. */
  ejemplos: Omit<Findings, 'edad_meses'>[];
  /** Solo se lista desde esta edad (meses). */
  desdeMeses?: number;
}

const S = (sintomas: Record<string, boolean>, rest: Omit<Findings, 'sintomas' | 'edad_meses'> = {}) => ({ sintomas, ...rest });

/** 2 meses a <5 años: los 4 signos generales de peligro de AIEPI (IMCI 2014 p. 5 del PDF; AIEPI comunitario p. 6). */
export const SIGNOS_NINO: SignoConRegla[] = [
  { texto: 'No puede beber nada ni mamar', reglas: ['IMCI-GDS-02'], ejemplos: [S({ no_puede_beber: true })] },
  { texto: 'Vomita todo lo que come o bebe', reglas: ['IMCI-GDS-03'], ejemplos: [S({ vomita_todo: true })] },
  { texto: 'Ha tenido convulsiones (ataques) en esta enfermedad', reglas: ['GEN-CONV-01'], ejemplos: [S({ convulsiones: true })] },
  { texto: 'Tiene mucho sueño fuera de lo normal o no despierta', reglas: ['IMCI-GDS-01', 'GEN-UNC-01'], ejemplos: [S({ letargico: true }), S({ inconsciente: true })] },
];

/**
 * 5 años o más: criterios rojos del IITT (y CDC) que ya son urgencia en Pahtli a esa edad.
 * NO se incluyen "no puede beber" ni "vomita todo" (en ≥5 años son centro_hoy, IITT-Y-CIRC-01) ni "muy dormido"
 * (IITT-Y-WEAK-01, centro_hoy) ni "desmayo" (IITT-Y-FAINT-01, centro_hoy).
 */
export const SIGNOS_MAYOR: SignoConRegla[] = [
  { texto: 'Le cuesta mucho trabajo respirar o se le ponen morados los labios', reglas: ['IITT-R-RESP-01', 'GEN-CYAN-01'], ejemplos: [S({ dificultad_respirar: true }), S({ cianosis: true })] },
  // CDC-HEART-01 es urgencia solo desde los 12 años.
  { texto: 'Tiene dolor u opresión en el pecho', reglas: ['CDC-HEART-01'], ejemplos: [S({ dolor_pecho: true })], desdeMeses: years(12) },
  { texto: 'Ha tenido convulsiones (ataques)', reglas: ['GEN-CONV-01'], ejemplos: [S({ convulsiones: true })] },
  { texto: 'No despierta, no responde o de repente se confunde', reglas: ['GEN-UNC-01', 'CDC-STROKE-01'], ejemplos: [S({ inconsciente: true }), S({ confusion: true })] },
  { texto: 'De repente se le chuequeó la cara, no puede mover un lado del cuerpo o no puede hablar bien', reglas: ['CDC-STROKE-01'], ejemplos: [S({ cara_caida: true }), S({ debilidad_un_lado: true }), S({ dificultad_hablar: true })] },
  { texto: 'Está sangrando mucho', reglas: ['GEN-BLEED-01'], ejemplos: [S({ sangrado_abundante: true })] },
];

/**
 * Edad desconocida: la unión de las dos listas, con palabras válidas para cualquier edad. Con la edad desconocida
 * todas son urgencia: las reglas pediátricas usan possiblyAge (IMCI-GDS-01/02/03) y las de adulto también
 * (IITT-R-RESP-01 ≥5 años, CDC-HEART-01 ≥12 años).
 */
export const SIGNOS_SIN_EDAD: SignoConRegla[] = [
  { texto: 'No puede beber nada (ni mamar, si es bebé)', reglas: ['IMCI-GDS-02'], ejemplos: [S({ no_puede_beber: true })] },
  { texto: 'Vomita todo lo que come o bebe', reglas: ['IMCI-GDS-03'], ejemplos: [S({ vomita_todo: true })] },
  { texto: 'Ha tenido convulsiones (ataques)', reglas: ['GEN-CONV-01'], ejemplos: [S({ convulsiones: true })] },
  { texto: 'Tiene mucho sueño fuera de lo normal, no despierta o de repente se confunde', reglas: ['IMCI-GDS-01', 'GEN-UNC-01', 'CDC-STROKE-01'], ejemplos: [S({ letargico: true }), S({ inconsciente: true }), S({ confusion: true })] },
  { texto: 'Le cuesta mucho trabajo respirar o se le ponen morados los labios', reglas: ['IITT-R-RESP-01', 'GEN-CYAN-01'], ejemplos: [S({ dificultad_respirar: true }), S({ cianosis: true })] },
  { texto: 'Tiene dolor u opresión en el pecho', reglas: ['CDC-HEART-01'], ejemplos: [S({ dolor_pecho: true })] },
  { texto: 'Está sangrando mucho', reglas: ['GEN-BLEED-01'], ejemplos: [S({ sangrado_abundante: true })] },
  { texto: 'De repente se le chuequeó la cara, no puede mover un lado del cuerpo o no puede hablar bien', reglas: ['CDC-STROKE-01'], ejemplos: [S({ cara_caida: true }), S({ debilidad_un_lado: true }), S({ dificultad_hablar: true })] },
];

/** Signos que aplican a esta edad (meses). Menores de 2 meses: no se usa (tienen sus propias reglas). */
export function screeningSigns(edadMeses?: number): SignoConRegla[] {
  if (!isNum(edadMeses)) return SIGNOS_SIN_EDAD;
  if (edadMeses < years(5)) return SIGNOS_NINO;
  return SIGNOS_MAYOR.filter((s) => edadMeses >= (s.desdeMeses ?? 0));
}

/** Pregunta Sí/No en varias líneas: título + una línea "• signo" por cada signo. */
export function screeningQuestionText(edadMeses?: number): string {
  return ['¿Tiene alguno de estos signos de peligro?', ...screeningSigns(edadMeses).map((s) => `• ${s.texto}`)].join('\n');
}

/**
 * ¿Aplica la revisión? A cualquier edad salvo el lactante menor de 2 meses CONOCIDO: con alguna molestia nunca
 * llega a `aqui` (IITT-Y-YI-01) y su exploración es otra (AIEPI del lactante).
 */
export const screeningApplies = (f: Findings) => !knownAge(f, 0, 2);
