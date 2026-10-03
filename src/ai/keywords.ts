/**
 * Extractor por palabras clave (español coloquial de México) — texto libre -> Findings.
 *
 * Es el respaldo cuando no hay LLM y la red de seguridad cuando sí lo hay.
 * PURO y síncrono: sin DOM, sin red, corre igual en el navegador y en Node (eval).
 *
 * Reglas de diseño:
 *  - Solo marca `true` lo que se dice explícitamente (sinónimos de SYMPTOMS + EXTRA_SYNONYMS).
 *  - Negación explícita ("no tiene calentura", "sin sangre", "ni tos") -> `false`.
 *  - "ya no vomita" (ya se resolvió) e incertidumbre ("no sé si tiene fiebre") -> no se marca.
 *  - "no se le quita / no le baja la calentura" NO es negación (la fiebre sigue).
 *  - Normalización fonética ligera para tolerar errores de ortografía de Whisper
 *    ("se le unde el pecho", "su dor frío").
 */
import type { Findings } from '../types';
import { SYMPTOMS, type SymptomKeyStrict } from '../triage/findings';

// ─────────────────────────────────────────────────────────────────────────────
// Sinónimos adicionales (variantes morfológicas y frases frecuentes). Compilados por el
// equipo, NO validados con promotoras: revisar en campo igual que los de findings.ts.
// ─────────────────────────────────────────────────────────────────────────────
export const EXTRA_SYNONYMS: Partial<Record<SymptomKeyStrict, string[]>> = {
  convulsiones: ['convulsion', 'convulsiono', 'convulsionado', 'ha convulsionado', 'convulsionando', 'se convulsiono', 'le dio una convulsion', 'le dan convulsiones', 'se puso tieso y se sacudia'],
  inconsciente: ['desmayado y no despierta', 'no contesta ni reacciona', 'esta inconsciente'],
  letargico: ['muy dormilon', 'no despierta bien', 'muy dormida', 'esta muy dormido', 'esta muy dormida', 'adormilado', 'adormilada'],
  no_puede_beber: ['no puede tomar agua', 'no puede tomar pecho', 'no puede tomar liquidos', 'ya no puede tomar'],
  vomita_todo: ['vomita todo lo que come', 'vomita todo lo que toma', 'todo lo devuelve', 'devuelve todo lo que toma', 'todo lo vomita'],
  palidez_intensa: ['muy palido', 'muy palida', 'bien palido', 'bien palida', 'blanco como la pared', 'muy palidas', 'muy palidos', 'bien palidas', 'bien palidos', 'blanquisimo', 'blanquisima', 'blanquisimas', 'blanquisimos', 'palmas muy blancas' /* eval */],
  palidez: ['palida', 'se ve palida', 'esta palido', 'esta palida'],
  debilidad_general: ['muy debil', 'muy debilitado', 'no se puede parar', 'no tiene fuerza'],
  sangrado_abundante: ['sangrado abundante', 'sangra muchisimo', 'esta sangrando mucho', 'mucho sangrado'],
  tos: ['tosio', 'tosecita', 'tose mucho', 'tos seca', 'con tos', 'toser'],
  dificultad_respirar: ['le cuesta mucho respirar', 'le cuesta mucho jalar aire', 'sin poder respirar', 'le falta la respiracion', 'se esta ahogando', 'se ahogaba', 'respira con dificultad', 'dificultad para respirar', 'no puede jalar aire', 'le cuesta jalar aire', 'le cuesta trabajo respirar', 'batalla para respirar'],
  respira_rapido: ['respirar muy rapido', 'respirar rapido', 'respiracion muy rapida', 'respira rapidito', 'respira muy rapidito', 'respiracion rapida', 'respira bien rapido', 'respirando rapido', 'respirando muy rapido', 'respira muy agitado', 'respira agitada', 'respira rapida'],
  tiraje: ['se le ven las costillas', 'se le notan las costillas', 'se le ven las costillas cuando respira', 'se le hunden las costillitas', 'se le hunde la panza al respirar', 'se le mete el pecho', 'se le hunde abajo de las costillas', 'se le hunde el pechito', 'se le sume el pechito', 'hundimiento del pecho'],
  sibilancias: ['le chilla el pecho', 'le silba el pechito', 'silbido al respirar'],
  cianosis: ['azulito', 'azulita', 'azulitos', 'azulitas', 'se puso azulito', 'unas moradas', 'unas azules', 'se puso moradito', 'labios moraditos', 'se esta poniendo morado'],
  escurrimiento_nasal: ['con mocos', 'mocosito', 'mocosita', 'resfriado'],
  diarrea: ['obrando agua', 'obrando pura agua', 'obra pura agua', 'obra agua', 'esta obrando aguado', 'diarreas', 'obra aguado', 'obra suelto', 'evacua aguado', 'anda flojo del estomago', 'esta suelto del estomago', 'chorrito', 'popo liquida', 'evacuaciones aguadas'],
  sangre_heces: ['popo con sangre', 'heces con sangre', 'obra con sangre', 'diarrea con sangre'],
  vomito: ['vomitado', 'vomitando', 'vomitos', 'esta vomitando', 'devolviendo', 'guacareando', 'ha vomitado'],
  vomito_persistente: ['vomita mucho', 'vomita muchisimo', 'no deja de vomitar'],
  dolor_abdominal: ['le duele el estomago', 'le duele la barriga', 'le duele la pancita', 'dolor de pancita', 'dolor de estomago'],
  dolor_abdominal_intenso: ['le duele mucho la panza', 'le duele mucho el estomago', 'dolor de panza fuerte'],
  ojos_hundidos: ['ojos muy hundidos', 'ojitos sumidos', 'ojos sumidos'],
  mollera_hundida: ['mollera sumida', 'mollerita sumida', 'mollera caida'],
  nauseas: ['estomago revuelto', 'tiene asco', 'ganas de devolver'],
  no_puede_orinar: ['no ha hecho pipi', 'no ha orinado', 'no ha hecho del uno', 'no orina', 'no ha podido orinar', 'no ha podido hacer pipi', 'no puede hacer pipi' /* eval */],
  boca_seca: ['labios resecos', 'boca reseca'],
  fiebre: ['trae mucha temperatura', 'trae temperatura', 'trae calentura', 'trae fiebre', 'calenturas', 'fiebres', 'calenturita', 'calenturienta', 'calenturiento', 'con calentura', 'fiebre alta', 'temperatura alta', 'mucha calentura', 'mucha fiebre'],
  dolor_muscular_articular: ['le duelen los huesos', 'le duele el cuerpo', 'le duelen los musculos', 'le duelen las articulaciones', 'dolor de cuerpo'],
  dolor_detras_ojos: ['detras de los ojos', 'detras de los ojitos', 'le duelen los ojos'],
  rigidez_nuca: ['nuca tiesa', 'cuello rigido'],
  sarpullido: ['ronchitas', 'manchitas rojas', 'granitos rojos'],
  petequias: ['puntitos rojos en la piel'],
  sangrado_mucosas: ['sangra de la nariz', 'sangra de las encias', 'le sangra la boca'],
  dolor_cabeza: ['dolor de cabeza', 'le duele su cabeza', 'dolor en la cabeza'],
  dolor_cabeza_intenso: ['le duele mucho la cabeza', 'dolor de cabeza fuerte', 'mucho dolor de cabeza', 'dolor de cabeza muy intenso', 'le duele muchisimo la cabeza'],
  vision_borrosa: ['ve luces', 've estrellas', 've manchitas', 've borrosito', 'no ve bien de repente'],
  cara_caida: ['se le durmio la mitad de la cara', 'mitad de la cara dormida', 'boca torcida', 'cara chueca', 'se le chueco la boca', 'se le torcio la cara'],
  debilidad_un_lado: ['se le durmio la mitad del cuerpo', 'no puede mover un lado', 'se le durmio un lado', 'no puede levantar el brazo'],
  dificultad_hablar: ['no le entiendo cuando habla', 'no se le entiende cuando habla', 'no se le entiende lo que dice', 'dificultad para hablar', 'no puede hablar', 'habla raro', 'habla arrastrado'],
  sangrado_vaginal: ['sangrado por abajo', 'sangrando por abajo', 'sangrando mucho por abajo', 'sangrando de abajo', 'sangra mucho por abajo', 'sangrado por la vagina', 'le esta bajando sangre', 'sangra por abajo', 'sangra de sus partes'],
  salida_liquido_vaginal: ['se le rompio la fuente', 'rompio fuente', 'se le salio el agua'],
  movimientos_fetales_disminuidos: ['no siente que se mueva el bebe', 'el bebe ya no se mueve', 'ya no se mueve el bebe', 'no se mueve el bebe', 'el bebe casi no se mueve', 'no siente al bebe'],
  hinchazon_cara_manos: ['se le hincharon los pies', 'se le hincho la cara', 'pies hinchados'],
  posparto: ['dio a luz', 'acaba de parir', 'recien aliviada', 'recien dio a luz', 'tuvo su bebe'],
  no_come_bien: ['no quiere comer nada', 'no mama', 'ya no mama', 'no quiere mamar'],
  ictericia: ['amarillito', 'amarillita', 'se ve amarillo', 'se ve amarilla', 'esta amarilla', 'amarillento'],
  dolor_pecho: ['dolor en el pecho', 'dolor del pecho', 'le duele su pecho', 'dolor de pecho'],
  sudor_frio: ['sudando frio', 'sudores frios'],
  trauma_grave: ['se cayo de la azotea', 'se cayo del arbol', 'se cayo del techo', 'lo atropello un carro', 'accidente de carro', 'accidente de moto', 'atropello', 'atropellaron', 'atropellado', 'atropellada' /* eval */],
  mordedura_serpiente: ['le pico una vibora', 'lo pico una vibora', 'la mordio una vibora', 'mordida de vibora'],
  mordedura_animal: ['la mordio un perro', 'lo mordio un perro', 'mordida de gato'],
  intoxicacion: ['se tomo un veneno', 'se tomo el veneno', 'tomo plaguicida', 'se intoxico', 'se enveneno'],
  // eval (docs/eval.md changelog): frases de casos dev que no se detectaban
  estridor: ['ruido al jalar aire', 'aspero al jalar aire', 'ruido aspero', 'ruido raro al jalar aire'],
  palmas_plantas_amarillas: ['amarillo hasta palmas', 'amarilla hasta palmas', 'amarillo hasta plantas', 'amarilla hasta plantas', 'palmas de manos amarillas', 'plantas de pies amarillas'],
  no_se_mueve: ['no se ha movido', 'no se le ha movido'],
  ardor_orinar: ['le arde cuando hace del uno', 'le arde cuando orina', 'le arde al hacer del uno', 'le arde cuando hace pipi', 'le arde mucho cuando hace del uno', 'le arde al orinar', 'ardor al hacer pipi', 'le arde la orina'],
};

/** Si se detecta la clave de la izquierda, también se marca la de la derecha (más general). */
const IMPLIES: Partial<Record<SymptomKeyStrict, SymptomKeyStrict[]>> = {
  dolor_cabeza_intenso: ['dolor_cabeza'],
  dolor_cabeza_subito: ['dolor_cabeza'],
  palidez_intensa: ['palidez'],
  vomito_persistente: ['vomito'],
  vomita_todo: ['vomito'],
  vomito_sangre: ['vomito'],
  dolor_abdominal_intenso: ['dolor_abdominal'],
  sangrado_abundante: ['sangrado'],
  pliegue_muy_lento: ['pliegue_lento'],
};

/**
 * Coincidencias que, si quedan DENTRO de una frase más larga de otra clave, se descartan
 * (p. ej. "chorro" -> diarrea dentro de "chorro de sangre" -> sangrado abundante).
 * clave contenida -> claves contenedoras que la anulan.
 */
const SUPPRESSED_INSIDE: Partial<Record<SymptomKeyStrict, SymptomKeyStrict[]>> = {
  diarrea: ['sangrado_abundante'],
  no_se_mueve: ['movimientos_fetales_disminuidos'],
  letargico: ['inconsciente'],
  sangrado: ['sangrado_mucosas', 'sangrado_vaginal', 'sangre_heces', 'vomito_sangre', 'sangrado_abundante', 'flujo_mal_olor'],
  vomito: ['vomito_sangre'],
  se_siente_frio: ['manos_pies_frios', 'sudor_frio'],
  dolor_pecho: ['pechos_rojos_dolorosos'],
  hinchazon_cara_manos: ['hinchazon_ambos_pies'],
  zumbido_oidos: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Normalización
// ─────────────────────────────────────────────────────────────────────────────

/** minúsculas, sin acentos, puntuación -> " | " (frontera de cláusula), decimales "38,5" -> "38.5". */
export function normalizeText(s: string): string {
  return ` ${s} `
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/°\s*c?(?![a-z])/g, ' grados ')
    .replace(/(\d)\s*,\s*(\d)/g, '$1.$2')
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' | ')
    .replace(/[,;:!?¡¿()"“”«»…\n\r\t-]+/g, ' | ')
    .replace(/[^a-z0-9.| ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Fonética ligera del español para tolerar ortografía de ASR. Se aplica igual a texto y sinónimos. */
export function phonetic(word: string): string {
  return word
    .replace(/ch/g, '§')
    .replace(/h/g, '')
    .replace(/§/g, 'ch')
    .replace(/ll/g, 'y')
    .replace(/v/g, 'b')
    .replace(/z/g, 's')
    .replace(/c([ei])/g, 's$1');
}

const toTokens = (s: string) => normalizeText(s).split(' ').filter(Boolean);
const phonTokens = (s: string) => toTokens(s).map(phonetic);
/** Artículos que se ignoran al buscar síntomas ("le cuesta jalar EL aire" = "le cuesta jalar aire"). */
const ARTICLES = new Set(['el', 'la', 'los', 'las', 'un', 'una']);
const BODY = '(?:pecho|cabeza|panza|pancita|estomago|barriga|vientre|huesos|cuerpo|garganta|oidos?|ojos?|espalda|piernas?|brazos?|muelas?|nuca|cuello|costado|rinones?)';
const HUELE_BODY = new RegExp(`\\bhuele(n)?\\b(?= (?:mucho |muchisimo |bien |harto )?(?:el |la |los |las |su |sus )?${BODY}\\b)`, 'g');
/**
 * Correcciones de errores típicos de Whisper medidos en el banco (docs/ai.md):
 * "le HUELE el pecho / la cabeza" (no existe en español para olor) = "le DUELE".
 */
export function asrFix(normalized: string): string {
  return normalized.replace(HUELE_BODY, 'duele$1');
}
const symptomTokens = (s: string) => asrFix(normalizeText(s)).split(' ').filter((t) => t && !ARTICLES.has(t)).map(phonetic);

// ─────────────────────────────────────────────────────────────────────────────
// Índice de sinónimos (se construye una vez)
// ─────────────────────────────────────────────────────────────────────────────
interface SynEntry { key: SymptomKeyStrict; toks: string[]; compact: string }

const SYN_INDEX: SynEntry[] = (() => {
  const out: SynEntry[] = [];
  const seen = new Set<string>();
  const add = (key: SymptomKeyStrict, phrase: string) => {
    const toks = symptomTokens(phrase).filter((t) => t !== '|');
    if (!toks.length) return;
    const id = `${key}::${toks.join(' ')}`;
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ key, toks, compact: toks.join('') });
  };
  for (const [key, def] of Object.entries(SYMPTOMS) as [SymptomKeyStrict, { synonyms: string[] }][]) {
    for (const s of def.synonyms) add(key, s);
  }
  for (const [key, list] of Object.entries(EXTRA_SYNONYMS) as [SymptomKeyStrict, string[]][]) {
    for (const s of list) add(key, s);
  }
  // Etiquetas del catálogo (sin paréntesis) y la clave en palabras: sirven para mapear
  // texto "estándar" (p. ej. la salida parafraseada del LLM) además del coloquial.
  for (const [key, def] of Object.entries(SYMPTOMS) as [SymptomKeyStrict, { es: string }][]) {
    for (const part of def.es.replace(/\([^)]*\)/g, ' ').split(/\s*\/\s*/)) {
      const t = part.trim();
      if (t.split(/\s+/).length >= 1 && !/^(no|sin|mas|menos)\b/i.test(t)) add(key, t);
    }
    add(key, key.replace(/_/g, ' '));
  }
  // Más largas primero: las frases específicas ganan.
  return out.sort((a, b) => b.compact.length - a.compact.length);
})();

// ─────────────────────────────────────────────────────────────────────────────
// Negación
// ─────────────────────────────────────────────────────────────────────────────
const NEG_CUES = new Set(['no', 'sin', 'nunca', 'ni', 'tampoco', 'jamas', 'niega', 'nada']);
const BREAKERS = new Set(['|', 'pero', 'aunque', 'y', 'e', 'sino', 'porque', 'pues', 'entonces', 'tambien', 'ademas', 'si']);
/** "no se le QUITA la calentura" = sigue con calentura. */
const PERSIST_VERBS = new Set(['quita', 'quito', 'baja', 'bajo', 'para', 'paro', 'calma', 'calmo', 'pasa', 'paso', 'mejora', 'mejoro', 'compone', 'cede', 'cedio', 'sede', 'sedio', 'deja', 'dejo', 'controla', 'corta', 'corto']);
/** Tras una negación, la palabra "si" de "no sé si" marca incertidumbre. */
const UNCERTAIN_AFTER_NO = new Set(['se', 'sabe', 'sabemos', 'saben', 'estoy', 'esta', 'recuerdo', 'acuerdo']);

type Polarity = 'pos' | 'neg' | 'unknown';

/**
 * Mira hasta 4 palabras antes del inicio de la coincidencia (sin cruzar fronteras de cláusula)
 * y 1-2 palabras después ("calentura no tiene").
 */
function polarityAt(toks: string[], start: number, end: number): Polarity {
  // Incertidumbre: "no sé si tiene calentura" / "quién sabe si"
  for (let i = start - 1, n = 0; i >= 0 && n < 6; i--, n++) {
    const w = toks[i];
    if (w === '|') break;
    if (w === 'si' && i >= 1 && (UNCERTAIN_AFTER_NO.has(toks[i - 1]) || toks[i - 1] === 'sabe')) {
      if (i >= 2 && (toks[i - 2] === 'no' || toks[i - 2] === 'quien' || toks[i - 1] === 'sabe')) return 'unknown';
    }
  }
  for (let i = start - 1, n = 0; i >= 0 && n < 5; i--, n++) {
    const w = toks[i];
    if (BREAKERS.has(w)) break;
    if (NEG_CUES.has(w)) {
      // "ya no" = ya se resolvió (antes sí lo tenía): no marcar.
      if (w === 'no' && i >= 1 && toks[i - 1] === 'ya') return 'unknown';
      // "no se le quita la calentura" / "no le baja"
      for (let j = i + 1; j < start; j++) if (PERSIST_VERBS.has(toks[j])) return 'pos';
      // "nada" solo niega como "nada de X" inmediatamente antes
      if (w === 'nada' && !(toks[i + 1] === 'de' && i + 2 === start)) continue;
      return 'neg';
    }
  }
  // Post-negación: "calentura no", "calentura no tiene", "tos no ha tenido"
  const a = toks[end], b = toks[end + 1], c = toks[end + 2];
  if (a === 'no' && (b === undefined || b === '|' || ((b === 'tiene' || b === 'ha' || b === 'hay' || b === 'presenta') && (c === undefined || c === '|' || c === 'tenido' || c === 'pero')))) {
    return 'neg';
  }
  return 'pos';
}

// ─────────────────────────────────────────────────────────────────────────────
// Números en palabras -> dígitos
// ─────────────────────────────────────────────────────────────────────────────
const UNITS: Record<string, number> = { cero: 0, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9 };
const ONE = new Set(['un', 'uno', 'una']);
const TEENS: Record<string, number> = {
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
};
const TENS: Record<string, number> = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };
const ORDINAL_MONTH: Record<string, number> = { primer: 1, primero: 1, segundo: 2, tercer: 3, tercero: 3, cuarto: 4, quinto: 5, sexto: 6, septimo: 7, setimo: 7, octavo: 8, noveno: 9 };
const UNIT_WORD = /^(ano|anos|anito|anitos|mes|meses|mesecito|mesecitos|semana|semanas|semanita|semanitas|dia|dias|diita|diitas|hora|horas|horita|horitas|minuto|minutos)$/;

function wordsToDigits(toks: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < toks.length; ) {
    const w = toks[i];
    let val: number | null = null;
    let j = i;
    if (w === 'cien' || w === 'ciento') {
      val = 100; j++;
    }
    const t = toks[j];
    if (t !== undefined && TENS[t] !== undefined) {
      val = (val ?? 0) + TENS[t]; j++;
      if (toks[j] === 'y' && toks[j + 1] !== undefined && (UNITS[toks[j + 1]] !== undefined || ONE.has(toks[j + 1]))) {
        val += UNITS[toks[j + 1]] ?? 1; j += 2;
      }
    } else if (t !== undefined && TEENS[t] !== undefined) {
      val = (val ?? 0) + TEENS[t]; j++;
    } else if (t !== undefined && UNITS[t] !== undefined) {
      val = (val ?? 0) + UNITS[t]; j++;
    } else if (t !== undefined && ONE.has(t) && toks[j + 1] !== undefined && UNIT_WORD.test(toks[j + 1])) {
      val = (val ?? 0) + 1; j++;
    }
    if (val === null) { out.push(w); i++; continue; }
    out.push(String(val));
    i = j;
  }
  return out;
}

/** Texto numérico: palabras->dígitos, "y medio", "punto", sin fronteras. */
export function numericText(raw: string): string {
  const toks = wordsToDigits(toTokens(raw));
  return ` ${toks.join(' ')} `
    .replace(/\|/g, ' ')
    .replace(/\bmedio (ano|anito)\b/g, '0.5 ano')
    .replace(/\bmedia hora\b/g, '0.5 hora')
    .replace(/(\d+(?:\.\d+)?) (anos?|anitos?|mes|meses|semanas?|dias?|horas?) y medi[oa]\b/g, (_m, n: string, u: string) => `${parseFloat(n) + 0.5} ${u}`)
    .replace(/(^|[^\d] )(ano|anito|mes|semana|dia|hora) y medi[oa]\b/g, (_m, p: string, u: string) => `${p}1.5 ${u}`)
    .replace(/(\d+) (?:punto|con) (\d)\b/g, '$1.$2')
    .replace(/(\d+) y medio\b/g, (_m, n: string) => `${parseInt(n, 10) + 0.5}`)
    .replace(/\s+/g, ' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Extracción numérica
// ─────────────────────────────────────────────────────────────────────────────
const NUM = '(\\d+(?:\\.\\d+)?)';
const DAYS_PER_MONTH = 30.4375;
const round1 = (n: number) => Math.round(n * 10) / 10;

function unitToDays(n: number, unit: string): number | undefined {
  if (/^hora|^horita/.test(unit)) return n / 24;
  if (/^dia|^diita/.test(unit)) return n;
  if (/^semana/.test(unit)) return n * 7;
  if (/^mes/.test(unit)) return n * 30;
  if (/^an/.test(unit)) return n * 365;
  return undefined;
}

/** Borra un tramo del texto (para que la edad no confunda "7 meses de embarazo" o "hace 3 meses"). */
const blank = (s: string, idx: number, len: number) => s.slice(0, idx) + ' '.repeat(len) + s.slice(idx + len);

interface NumericOut {
  temperatura_c?: number;
  resp_por_min?: number;
  semanas_embarazo?: number;
  embarazo_por_numero?: boolean;
  duracion_dias?: number;
  edad_meses?: number;
  /** días desde el parto ("dio a luz hace 2 semanas") */
  posparto_dias?: number;
}

const BIRTH_CTX = /(dio a luz|se alivio|tuvo (?:a )?(?:su |el |la )?(?:bebe|nino|nina|hijo|hija)|parto|nacio|cesarea|aliviada|parida)\s*(?:\S+\s+){0,2}$/;
const PERSON = '(?:senora|senor|nino|nina|ninito|ninita|bebe|bebito|bebita|nene|nena|muchacho|muchacha|chamaco|chamaca|chamaquito|chamaquita|joven|abuelo|abuela|abuelito|abuelita|don|dona|hombre|mujer|paciente|chavo|chava|chiquillo|chiquilla|morro|morra|criatura|hijo|hija|senorita|viejito|viejita|anciano|anciana|chiquito|chiquita|escuincle|muchachito|muchachita)';

export function parseNumbers(raw: string): NumericOut {
  let s = numericText(raw);
  const o: NumericOut = {};

  // Temperatura (34–43.5 °C)
  const tempRes = [
    new RegExp(`${NUM} (?:grados|de temperatura|de fiebre|de calentura|centigrados)`, 'g'),
    new RegExp(`(?:temperatura|fiebre|calentura|termometro|marca|marco|marcaba|marcaron)(?: [a-z]+){0,3}? (?:de |en |a )?${NUM}\\b`, 'g'),
  ];
  for (const re of tempRes) {
    for (const m of s.matchAll(re)) {
      const v = parseFloat(m[1]);
      if (v >= 34 && v <= 43.5 && o.temperatura_c === undefined) { o.temperatura_c = round1(v); }
      if (v >= 34 && v <= 43.5) s = blank(s, m.index!, m[0].length);
    }
  }

  // Frecuencia respiratoria (5–150 /min)
  const hasResp = /respir|resuell/.test(s);
  const respRes = [
    new RegExp(`${NUM} (?:respiraciones|respiros|resp|veces|respira)(?: [a-z]+){0,3}? (?:por|en un|en el|al|cada|x) minuto`, 'g'),
    new RegExp(`(?:respira|respiraba|respiracion|respiraciones|resuella)(?: [a-z]+){0,3}? ${NUM} (?:veces |respiraciones )?(?:por|en un|en el|al|cada|x) minuto`, 'g'),
    new RegExp(`frecuencia respiratoria (?:de |es de |en )?${NUM}`, 'g'),
    new RegExp(`${NUM} respiraciones`, 'g'),
    ...(hasResp ? [new RegExp(`(?:conte|contamos|conto|saco|salieron|dio)(?: [a-z]+){0,2}? ${NUM}\\b`, 'g'), new RegExp(`${NUM} (?:por|en un|al) minuto`, 'g')] : []),
  ];
  for (const re of respRes) {
    for (const m of s.matchAll(re)) {
      const pre = s.slice(Math.max(0, m.index! - 25), m.index!);
      if (/(latido|pulso|corazon)\s*\S*\s*$/.test(pre)) continue;
      const v = parseFloat(m[1]);
      if (v >= 5 && v <= 150) {
        if (o.resp_por_min === undefined) o.resp_por_min = Math.round(v);
        s = blank(s, m.index!, m[0].length);
      }
    }
  }

  // Embarazo: semanas / meses
  const pregRes = [
    new RegExp(`${NUM} (semanas?|meses?) (?:de embarazo|de gestacion|de embarazada|embarazada|de encinta)`, 'g'),
    new RegExp(`(?:embarazada|embarazo|encinta|esperando(?: bebe| un bebe)?|gestacion) (?:de |con |va en )?${NUM} (semanas?|meses?)`, 'g'),
  ];
  for (const re of pregRes) {
    for (const m of s.matchAll(re)) {
      const n = parseFloat(m[1]);
      const unit = m[2];
      const weeks = /^semana/.test(unit) ? n : Math.ceil(n * 4.345);
      if (weeks >= 1 && weeks <= 45 && o.semanas_embarazo === undefined) { o.semanas_embarazo = Math.round(weeks); o.embarazo_por_numero = true; }
      s = blank(s, m.index!, m[0].length);
    }
  }
  if (o.semanas_embarazo === undefined && /embaraz|encinta|esperando bebe|gestacion|fuente|contraccion|dolores de parto|parto|se mueve el bebe|el bebe no se mueve/.test(s)) {
    const wk = new RegExp(`(?:tiene|va en|va para|lleva|ya tiene|cumple|cumplio) (?:las |sus )?${NUM} semanas\\b(?! (?:con|de nacid))`).exec(s);
    if (wk && parseFloat(wk[1]) >= 6 && parseFloat(wk[1]) <= 45) {
      o.semanas_embarazo = Math.round(parseFloat(wk[1]));
      o.embarazo_por_numero = true;
      s = blank(s, wk.index, wk[0].length);
    }
  }
  const ord = s.match(/\b(primer|primero|segundo|tercer|tercero|cuarto|quinto|sexto|septimo|setimo|octavo|noveno) mes(?: de embarazo| de gestacion)?\b/);
  if (ord && o.semanas_embarazo === undefined && /embaraz|encinta|esperando|gestacion/.test(s)) {
    o.semanas_embarazo = Math.ceil(ORDINAL_MONTH[ord[1]] * 4.345);
    o.embarazo_por_numero = true;
    s = blank(s, ord.index!, ord[0].length);
  }

  // Edad en días/semanas de nacido (antes de la duración: "tiene 10 dias de nacido")
  let m2: RegExpExecArray | null = null;
  const newborn = new RegExp(`${NUM} (dias?|diitas?|semanas?|semanitas?|mes(?:es)?) de (?:nacid[oa]|vida|edad|naciod[oa])`).exec(s);
  if (newborn) {
    const n = parseFloat(newborn[1]);
    const d = unitToDays(n, newborn[2]);
    if (d !== undefined) o.edad_meses = round1(/^mes/.test(newborn[2]) ? n : d / DAYS_PER_MONTH);
    s = blank(s, newborn.index, newborn[0].length);
  } else if ((m2 = new RegExp(`\\b(?:bebe|bebito|bebita|nene|nena|criatura|nino|nina|ninito|ninita|recien nacid[oa]) (?:de|tiene|ya tiene|tiene ya|cumplio) ${NUM} (dias?|diitas?|semanas?|semanitas?)\\b`).exec(s)) && (/ de \\d/.test(m2[0]) || !/embaraz|encinta|gestacion/.test(s))) {
    // "el bebé tiene 3 semanas" es edad salvo en contexto de embarazo (eval D10)
    const d = unitToDays(parseFloat(m2[1]), m2[2]);
    if (d !== undefined) o.edad_meses = round1(d / DAYS_PER_MONTH);
    s = blank(s, m2.index, m2[0].length);
  } else if (/\b(recien nacid[oa]|acaba de nacer|nacio hoy|recien nacidito|recien nacidita)\b/.test(s)) {
    o.edad_meses = 0;
  } else if (/\bnacio ayer\b/.test(s)) {
    o.edad_meses = round1(1 / DAYS_PER_MONTH);
  }

  // Duración
  const durations: number[] = [];
  const durRes = [
    new RegExp(`(?:desde hace|hace|lleva|llevan|llevamos|ya van|ya va|ya tiene|tiene|con|desde) (?:ya )?(?:como |unos |unas |mas de )?${NUM} (horas?|horitas?|dias?|diitas?|semanas?|semanitas?|mes(?:es)?|anos?)`, 'g'),
    new RegExp(`${NUM} (horas?|dias?|semanas?) (?:con|de|que|asi|enferm)`, 'g'),
  ];
  for (const re of durRes) {
    for (const m of s.matchAll(re)) {
      const after = s.slice(m.index! + m[0].length, m.index! + m[0].length + 14);
      if (/^\s*de (?:nacid|edad|vida)/.test(after)) continue;
      const verb = m[0].split(' ')[0];
      const unit = m[2];
      // "tiene/con 8 meses" o "tiene 2 años" es edad, no duración
      if ((verb === 'tiene' || verb === 'con' || verb === 'ya') && /^(mes|an)/.test(unit)) continue;
      // "tiene 36 semanas" sin "con/de <síntoma>" suele ser edad gestacional o edad del bebé, no duración
      if ((verb === 'tiene' || verb === 'ya') && /^semana/.test(unit) && !/^\s*(con|de|que|asi|enferm)/.test(after)) continue;
      if (BIRTH_CTX.test(s.slice(0, m.index!))) {
        const bd = unitToDays(parseFloat(m[1]), unit);
        if (bd !== undefined) o.posparto_dias = bd;
        s = blank(s, m.index!, m[0].length);
        continue;
      }
      const d = unitToDays(parseFloat(m[1]), unit);
      if (d !== undefined && d >= 0 && d <= 3650) durations.push(d);
      s = blank(s, m.index!, m[0].length);
    }
  }
  if (/\bdesde (?:antier|anteayer|antes de ayer)\b/.test(s)) durations.push(2);
  else if (/\bdesde ayer\b|\bdesde el dia de ayer\b/.test(s)) durations.push(1);
  else if (/\bdesde anoche\b|\bdesde la noche\b/.test(s)) durations.push(0.5);
  else if (/\bdesde (?:hoy|esta manana|la manana|en la manana|temprano|hace rato|hace un rato)\b/.test(s)) durations.push(0.2);
  if (durations.length) o.duracion_dias = Math.round(Math.max(...durations) * 100) / 100;

  // Edad (si no salió de "días de nacido")
  if (o.edad_meses === undefined) {
    const ym = new RegExp(`${NUM} (?:anos?|anitos?) (?:y|con) ${NUM} (?:mes(?:es)?|mesecitos?)`).exec(s);
    const y = new RegExp(`${NUM} (?:anos?|anitos?)\\b`).exec(s);
    const mo = new RegExp(`${NUM} (?:mes(?:es)?|mesecitos?)\\b`).exec(s);
    const person = new RegExp(`\\b${PERSON}(?: [a-z]+){0,2}? de ${NUM}(?![\\d.])(?! (?:anos?|anitos?|mes(?:es)?|mesecitos?|semanas?|dias?|horas?|grados))`).exec(s);
    const cands: { idx: number; months: number }[] = [];
    if (ym) cands.push({ idx: ym.index, months: parseFloat(ym[1]) * 12 + parseFloat(ym[2]) });
    if (y && !(ym && ym.index === y.index)) cands.push({ idx: y.index, months: parseFloat(y[1]) * 12 });
    if (mo && !(ym && mo.index > ym.index && mo.index < ym.index + ym[0].length)) cands.push({ idx: mo.index, months: parseFloat(mo[1]) });
    if (person) {
      const n = parseFloat(person[1]);
      const babyish = /^(bebe|bebito|bebita|nene|nena|criatura)/.test(person[0].trim());
      cands.push({ idx: person.index, months: babyish && n <= 24 ? n : n * 12 });
    }
    cands.sort((a, b) => a.idx - b.idx);
    const first = cands.find((c) => c.months >= 0 && c.months <= 120 * 12);
    if (first) o.edad_meses = round1(first.months);
  }
  return o;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sexo y embarazo
// ─────────────────────────────────────────────────────────────────────────────
const FEMALE = /^(nina|ninita|senora|senorita|mujer|muchacha|muchachita|chamaca|chamaquita|abuela|abuelita|dona|nena|bebita|hija|chava|morra|viejita|anciana|chiquita|embarazada|ella|mama|madre|seno)$/;
const MALE = /^(nino|ninito|senor|hombre|muchacho|muchachito|chamaco|chamaquito|abuelo|abuelito|don|nene|bebito|hijo|chavo|morro|viejito|anciano|chiquito|el|papa|padre)$/;

const CHILD_F = /^(nina|ninita|bebita|nena|hija|chamaca|chamaquita|chiquita|muchachita)$/;
const CHILD_M = /^(nino|ninito|bebito|nene|hijo|chamaco|chamaquito|chiquito|muchachito)$/;

function detectSex(toks: string[]): 'F' | 'M' | undefined {
  // Si se habla de un niño/a, la paciente es la criatura (no "la señora" que la trae)
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i];
    if (/^(bebe|criatura|paciente)$/.test(w) && (toks[i - 1] === 'la' || toks[i - 1] === 'una')) return 'F';
    if (/^(bebe|paciente)$/.test(w) && (toks[i - 1] === 'el' || toks[i - 1] === 'un')) return 'M';
    if (CHILD_F.test(w)) return 'F';
    if (CHILD_M.test(w)) return 'M';
  }
  for (const w of toks) {
    if (w === 'el' || w === 'ella' || w === 'mama' || w === 'madre' || w === 'papa' || w === 'padre' || w === 'seno') continue; // demasiado ambiguos
    if (FEMALE.test(w)) return 'F';
    if (MALE.test(w)) return 'M';
  }
  return undefined;
}

const PREG_PHRASES: string[][] = [
  ['embarazada'], ['embarazo'], ['encinta'], ['en', 'cinta'], ['gestante'], ['en', 'estado'],
  ['esta', 'esperando', 'bebe'], ['esta', 'esperando', 'un', 'bebe'], ['esta', 'esperando', 'familia'],
  ['esperando', 'bebe'], ['va', 'a', 'tener', 'un', 'bebe'], ['va', 'a', 'tener', 'bebe'], ['esta', 'panzona'],
];

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

interface Hit { key: SymptomKeyStrict; start: number; end: number; pol: Polarity }

function findSymptomHits(toks: string[]): Hit[] {
  const hits: Hit[] = [];
  // Mapa compacto (sin espacios) para tolerar "su dor frio", "se leunde"
  let compact = '';
  const charTok: number[] = [];
  toks.forEach((t, i) => {
    if (t === '|') return;
    for (let k = 0; k < t.length; k++) charTok.push(i);
    compact += t;
  });

  for (const e of SYN_INDEX) {
    const n = e.toks.length;
    let found = false;
    for (let i = 0; i + n <= toks.length; i++) {
      let ok = true;
      for (let k = 0; k < n; k++) if (toks[i + k] !== e.toks[k]) { ok = false; break; }
      if (ok) { hits.push({ key: e.key, start: i, end: i + n, pol: polarityAt(toks, i, i + n) }); found = true; }
    }
    if (!found && e.compact.length >= 9) {
      let from = 0;
      for (;;) {
        const at = compact.indexOf(e.compact, from);
        if (at < 0) break;
        const st = charTok[at];
        const en = charTok[at + e.compact.length - 1] + 1;
        // debe empezar y terminar en frontera de palabra del texto compacto
        const startsAtWord = at === 0 || charTok[at - 1] !== st;
        const endsAtWord = at + e.compact.length >= charTok.length || charTok[at + e.compact.length] !== en - 1;
        if (startsAtWord && endsAtWord) hits.push({ key: e.key, start: st, end: en, pol: polarityAt(toks, st, en) });
        from = at + 1;
      }
    }
  }
  // Anular coincidencias contenidas en frases de claves que las contradicen
  return hits.filter((h) => {
    const killers = SUPPRESSED_INSIDE[h.key];
    if (!killers?.length) return true;
    return !hits.some((o) => o !== h && killers.includes(o.key) && o.start <= h.start && o.end >= h.end && o.end - o.start > h.end - h.start);
  });
}

/**
 * Extrae hallazgos de texto libre. Puro y síncrono.
 * sintomas[k] = true (afirmado) | false (negado explícitamente); ausente = no se sabe.
 */
export function keywordExtract(text: string): Findings {
  const f: Findings = { sintomas: {} };
  if (!text || !text.trim()) return f;
  const normToks = toTokens(text);
  const toks = symptomTokens(text);

  // Síntomas
  const hits = findSymptomHits(toks);
  const pos = new Set<SymptomKeyStrict>();
  const neg = new Set<SymptomKeyStrict>();
  for (const h of hits) {
    if (h.pol === 'pos') pos.add(h.key);
    else if (h.pol === 'neg') neg.add(h.key);
  }
  for (const k of [...pos]) for (const p of IMPLIES[k] ?? []) pos.add(p);
  for (const k of neg) if (!pos.has(k)) f.sintomas[k] = false;
  for (const k of pos) f.sintomas[k] = true;

  // Números
  const nums = parseNumbers(text);
  if (nums.edad_meses !== undefined) f.edad_meses = nums.edad_meses;
  if (nums.temperatura_c !== undefined) f.temperatura_c = nums.temperatura_c;
  if (nums.resp_por_min !== undefined) f.resp_por_min = nums.resp_por_min;
  if (nums.duracion_dias !== undefined) f.duracion_dias = nums.duracion_dias;
  if (nums.semanas_embarazo !== undefined) f.semanas_embarazo = nums.semanas_embarazo;

  // Embarazo
  const ptoks = normToks; // sin fonética para frases fijas
  let preg: Polarity | null = null;
  for (const ph of PREG_PHRASES) {
    for (let i = 0; i + ph.length <= ptoks.length; i++) {
      if (ph.every((w, k) => ptoks[i + k] === w)) {
        const p = polarityAt(ptoks, i, i + ph.length);
        if (p === 'pos') preg = 'pos';
        else if (p === 'neg' && preg !== 'pos') preg = 'neg';
      }
    }
  }
  // Signos que solo existen en el embarazo implican embarazo (salvo negación explícita)
  const impliesPreg = f.sintomas.salida_liquido_vaginal === true || f.sintomas.contracciones === true || f.sintomas.movimientos_fetales_disminuidos === true;
  if (preg === 'pos' || nums.embarazo_por_numero || (impliesPreg && preg !== 'neg')) f.embarazada = true;
  else if (preg === 'neg') f.embarazada = false;

  // Sexo
  const sex = f.embarazada === true || f.sintomas.posparto === true ? 'F' : detectSex(normToks);
  if (sex) f.sexo = sex;

  // "dio a luz hace 3 meses" ya no es puerperio (> 6 semanas)
  if (f.sintomas.posparto === true && nums.posparto_dias !== undefined && nums.posparto_dias > 42) delete f.sintomas.posparto;

  // Embarazada adulta: "no se mueve el bebé" es movimiento fetal, no signo del recién nacido
  if (f.embarazada === true && f.sintomas.no_se_mueve === true && /\bbebe\b/.test(normToks.join(' '))) {
    delete f.sintomas.no_se_mueve;
    f.sintomas.movimientos_fetales_disminuidos = true;
  }
  return f;
}

/** Útil para la UI/eval: qué frases dispararon qué clave. */
export function explainKeywords(text: string): { key: SymptomKeyStrict; phrase: string; polarity: Polarity }[] {
  const toks = symptomTokens(text);
  return findSymptomHits(toks).map((h) => ({ key: h.key, phrase: toks.slice(h.start, h.end).join(' '), polarity: h.pol }));
}

const STOP = new Set(['tiene', 'tener', 'esta', 'estar', 'para', 'como', 'muy', 'mucho', 'mucha', 'poco', 'desde', 'hace', 'sobre', 'entre', 'cuando', 'donde', 'pero', 'porque', 'paciente', 'senora', 'senor', 'nino', 'nina', 'bebe', 'los', 'las', 'del', 'con', 'sin', 'por', 'que', 'una', 'uno', 'unos', 'unas', 'mas', 'muy', 'bien', 'esta', 'este', 'ese', 'esa', 'sus', 'ella', 'severo', 'severa', 'fuerte', 'leve', 'dificultad', 'problema', 'problemas', 'falta'].map(phonetic));

/** "ojitos" -> "ojos", "pechito" -> "pecho", "calenturita" -> "calentura" */
const undim = (w: string) => w.replace(/(?:s)?it(o|a|os|as)$/, '$1');
/** Mismo arranque: los primeros min(5, |a|, |b|) caracteres (mín. 3) sin diminutivo. */
function sameRoot(a: string, b: string): boolean {
  const x = undim(a), y = undim(b);
  const n = Math.min(5, x.length, y.length);
  return n >= 3 && x.slice(0, n) === y.slice(0, n);
}

/**
 * ¿Una frase producida por el LLM está anclada en el texto original? Al menos 2/3 de sus
 * palabras de contenido (>= 3 letras) deben aparecer en el texto, comparando el arranque (hasta 5 letras)
 * en forma fonética y sin diminutivos ("sangrado" ~ "sangrando", "ojos" ~ "ojitos").
 * Filtra síntomas copiados de los ejemplos del prompt o inventados ("dolor en el pecho" cuando
 * el relato dice "se le hunde el pecho").
 */
export function groundedIn(phrase: string, text: string): boolean {
  const src = phonTokens(text).filter((w) => w.length >= 3);
  const words = phonTokens(phrase).filter((w) => w.length >= 3 && w !== '|' && !STOP.has(w));
  if (!words.length) return false;
  const hit = words.filter((w) => src.some((t) => sameRoot(w, t))).length;
  return hit >= 1 && hit / words.length >= 2 / 3;
}
