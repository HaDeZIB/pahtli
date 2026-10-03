import { describe, expect, it } from 'vitest';
import { groundedIn, keywordExtract, normalizeText, numericText, parseNumbers } from './keywords';
import { anchored, mergeFindings } from './extractor';
import { EXTRACTION_SCHEMA, mapParaphrase, parseLLMOutput, parseParaphrase, SYSTEM_PROMPT } from './prompt';
import { cleanTranscript, collapseRepeats } from './transcript';
import { resampleLinear } from './stt';
import { SYMPTOM_KEYS } from '../triage/findings';
import { triage } from '../triage/engine';

type Expect = {
  pos?: string[];
  neg?: string[];
  /** claves que NO deben quedar en true */
  notPos?: string[];
  /** claves que no deben aparecer en absoluto (ni true ni false) */
  absent?: string[];
  edad?: number;
  temp?: number;
  resp?: number;
  dur?: number;
  semanas?: number;
  embarazada?: boolean;
  sexo?: 'F' | 'M';
};

const CASES: [string, Expect][] = [
  // ── Demo / síntomas coloquiales ──
  ['La niña tiene un año, tiene calentura desde ayer y respira muy rápido, se le hunde el pecho.', { pos: ['fiebre', 'respira_rapido', 'tiraje'], edad: 12, dur: 1, sexo: 'F' }],
  ['Es un bebé de ocho meses, anda suelto del estómago desde hace tres días y tiene los ojitos hundidos.', { pos: ['diarrea', 'ojos_hundidos'], edad: 8, dur: 3 }],
  ['Señora de cuarenta años, le duele el pecho y tiene sudor frío.', { pos: ['dolor_pecho', 'sudor_frio'], edad: 480, sexo: 'F' }],
  ['Está embarazada de siete meses, le duele mucho la cabeza y ve lucecitas.', { pos: ['dolor_cabeza_intenso', 'vision_borrosa'], embarazada: true, semanas: 31, sexo: 'F' }],
  ['Don José tiene la boca chueca y no puede mover el brazo derecho desde hace una hora.', { pos: ['cara_caida', 'debilidad_un_lado'], sexo: 'M', dur: 0.04 }],
  ['Le dio un ataque y se le voltearon los ojos', { pos: ['convulsiones'] }],
  ['el niño está como trapito, muy dormido, cuesta despertarlo', { pos: ['letargico'], sexo: 'M' }],
  ['ya no agarra la chichi y vomita todo lo que come', { pos: ['no_puede_beber', 'vomita_todo', 'vomito'] }],
  ['tiene popó con sangre y pujo', { pos: ['sangre_heces'] }],
  ['se puso morado de los labios y le silba el pecho', { pos: ['cianosis', 'sibilancias'], notPos: ['estridor'] }],
  ['lo mordió una víbora de cascabel en el pie', { pos: ['mordedura_serpiente'] }],
  ['se tomó el líquido para fumigar, matahierba', { pos: ['intoxicacion'] }],
  ['Le duelen los huesos y detrás de los ojos, le salieron puntitos rojos y le sangran las encías', { pos: ['dolor_muscular_articular', 'dolor_detras_ojos', 'petequias', 'sangrado_mucosas'] }],
  ['recién aliviada, tiene calentura y le huele feo el sangrado', { pos: ['posparto', 'fiebre', 'flujo_mal_olor'], sexo: 'F' }],
  ['se le rompió la fuente y tiene contracciones', { pos: ['salida_liquido_vaginal', 'contracciones'] }],

  // ── Negaciones ──
  ['El niño de dos años tiene tos y mocos, no tiene fiebre, come bien.', { pos: ['tos', 'escurrimiento_nasal'], neg: ['fiebre'], edad: 24, sexo: 'M' }],
  ['diarrea sin sangre desde antier', { pos: ['diarrea'], neg: [], notPos: ['sangre_heces'], dur: 2 }],
  ['no tiene calentura ni tos', { neg: ['fiebre', 'tos'] }],
  ['ya no vomita', { absent: ['vomito'] }],
  ['no sé si tiene calentura', { absent: ['fiebre'] }],
  ['no se le quita la calentura', { pos: ['fiebre'] }],
  ['no le baja la fiebre con nada', { pos: ['fiebre'] }],
  ['calentura no tiene, pero tose mucho', { neg: ['fiebre'], pos: ['tos'] }],
  ['nunca ha convulsionado, pero tiene calentura', { neg: ['convulsiones'], pos: ['fiebre'] }],
  ['no está embarazada, le arde al orinar', { embarazada: false, pos: ['ardor_orinar'] }],
  ['no puede respirar', { pos: ['dificultad_respirar'] }], // la negación es parte del síntoma
  ['no tiene diarrea y vomita', { neg: ['diarrea'], pos: ['vomito'] }],
  ['le sale un chorro de sangre de la pierna', { pos: ['sangrado_abundante'], notPos: ['diarrea'] }],

  // ── Números ──
  ['la bebé de año y medio tiene tos', { edad: 18, pos: ['tos'], sexo: 'F' }],
  ['tiene dos años y medio', { edad: 30 }],
  ['el niño tiene 2 años y 3 meses', { edad: 27 }],
  ['bebé de 10 días de nacido, amarillito', { edad: 0.3, pos: ['ictericia'] }],
  ['bebé de tres semanas con calentura', { edad: 0.7, pos: ['fiebre'] }],
  ['es un recién nacido que no quiere mamar', { edad: 0, pos: ['no_come_bien'] }],
  ['tiene 39 de temperatura', { temp: 39 }],
  ['calentura de treinta y nueve y medio', { temp: 39.5, pos: ['fiebre'] }],
  ['el termómetro marca 38,5', { temp: 38.5 }],
  ['tiene treinta y ocho punto cinco grados', { temp: 38.5 }],
  ['respira 55 por minuto', { resp: 55 }],
  ['conté cuarenta y ocho respiraciones en un minuto', { resp: 48 }],
  ['tiene 32 semanas de embarazo y ya no siente al bebé', { semanas: 32, embarazada: true, pos: ['movimientos_fetales_disminuidos'] }],
  ['está esperando bebé, va en el octavo mes', { embarazada: true, semanas: 35 }],
  ['tose desde hace dos semanas', { pos: ['tos'], dur: 14 }],
  ['lleva una semana con diarrea', { pos: ['diarrea'], dur: 7 }],
  ['señor de 65, se desmayó', { edad: 780, pos: ['desmayo'], sexo: 'M' }],
  ['dio a luz hace dos semanas y tiene calentura', { pos: ['posparto', 'fiebre'], absent: [] }],
  ['dio a luz hace tres meses, le duele la cabeza', { absent: ['posparto'] }],

  // ── Errores típicos de Whisper ──
  ['se le unde el pecho', { pos: ['tiraje'] }],
  ['tiene su dor frío', { pos: ['sudor_frio'] }],
  ['TIENE CALENTURA Y DIARREA', { pos: ['fiebre', 'diarrea'] }],
  ['señor a de 40 años le huele el pecho y tiene su dor frío', { pos: ['dolor_pecho', 'sudor_frio'], edad: 480 }], // salida real de whisper-base
  ['Esta embarazada de siete meses le huele mucho la cabeza', { pos: ['dolor_cabeza_intenso'], embarazada: true }], // salida real de whisper-base
  ['le huele feo el sangrado', { pos: ['flujo_mal_olor'], notPos: ['dolor_cabeza'] }],

  // ── Ronda 2: huecos de 1–2 palabras de relleno dentro de la frase ──
  ['le duele todo el cuerpo y tiene calentura', { pos: ['dolor_muscular_articular', 'fiebre'] }],
  ['se le hinchan mucho las manos', { pos: ['hinchazon_cara_manos'] }],
  ['le duele bien feo la cabeza', { pos: ['dolor_cabeza'] }],
  ['habla como trabado desde la mañana', { pos: ['dificultad_hablar'] }],
  ['le duele la cabeza, pero la panza no', { pos: ['dolor_cabeza'], notPos: ['dolor_abdominal'] }],
  // el relleno no puede ser una negación ni cruzar una frontera de cláusula
  ['se le hinchan, no, las manos no', { notPos: ['hinchazon_cara_manos'] }],
  ['le duele. todo bien con el cuerpo', { notPos: ['dolor_muscular_articular'] }],

  // ── Ronda 2: "ya no" + capacidad = signo nuevo; "ya no" + síntoma = resuelto ──
  ['desde ayer ya no quiere agarrar el pecho', { pos: ['no_puede_beber'] }],
  ['el bebé ya no se pega al pecho', { pos: ['no_come_bien'] }],
  ['ya no quiere comer nada', { pos: ['no_come_bien'] }],
  ['ya no puede tragar', { pos: ['no_puede_beber'] }],
  ['casi no despierta', { pos: ['inconsciente'] }],
  ['ya no quiere vivir, dice', { pos: ['ideas_suicidas'] }],
  ['ya no tiene calentura', { absent: ['fiebre'], pos: ['fiebre_reciente'] }],
  ['tuvo diarrea pero ya no', { pos: ['diarrea'] }], // "ya no" suelto después de una coma no anula lo dicho antes
  ['ya dejó de vomitar', { absent: ['vomito'] }],
  ['no deja de vomitar', { pos: ['vomito_persistente'] }],
  ['la calentura ya se le quitó desde ayer', { notPos: ['fiebre'], pos: ['fiebre_reciente'] }],
  ['no se le quita la tos', { pos: ['tos'] }],
  // eventos: lo que ya pasó sigue contando
  ['le dio un ataque en la noche, ya se le pasó', { pos: ['convulsiones'] }],
  ['está embarazada, sangró en la mañana pero ya no le sale sangre', { embarazada: true }],
  ['nunca ha tenido ataques', { neg: ['convulsiones'] }],

  // ── Ronda 2: canonización (diminutivos, equivalentes, conjugaciones) ──
  ['lo siento calientito', { pos: ['fiebre'] }],
  ['la pancita le duele mucho', { notPos: ['dolor_pecho'] }],
  ['le duele mucho la barriga', { pos: ['dolor_abdominal_intenso'] }],
  ['tiene los ojitos sumidos y la boquita seca', { pos: ['ojos_hundidos', 'boca_seca'] }],
  ['le duelen las coyunturas', { pos: ['dolor_muscular_articular'] }],
  ['agua caliente para el té', { notPos: ['fiebre'] }], // "caliente" sin "está/siente" no es fiebre

  // ── Ronda 2: marcos de co-ocurrencia (orden libre) ──
  ['siente como un peso en el pecho', { pos: ['dolor_pecho'] }],
  ['le aprieta el pecho', { pos: ['dolor_pecho'] }],
  ['no se pega al pecho', { notPos: ['dolor_pecho'] }],
  ['un perro le mordió la pierna', { pos: ['mordedura_animal'] }],
  ['lo mordió el perro del vecino', { pos: ['mordedura_animal'] }],
  ['lo arañó un gato', { pos: ['mordedura_animal'] }],
  ['tiene la muñeca chueca', { pos: ['fractura'] }],
  ['se le quebró el tobillo', { pos: ['fractura'] }],
  ['se torció el tobillo', { notPos: ['fractura'] }], // torcedura no es fractura
  ['hace del baño con sangre', { pos: ['sangre_heces'] }],
  ['la popó no trae sangre', { neg: ['sangre_heces'] }],
  ['fue al baño y le salió sangre de la nariz', { notPos: ['sangre_heces'] }],
  ['la boca se le ve torcida', { pos: ['cara_caida'] }],
  ['le picó una culebra', { pos: ['mordedura_serpiente'] }],

  // ── Ronda 2: vocabulario coloquial nuevo ──
  ['está manchando y tiene cólico', { pos: ['sangrado_vaginal', 'dolor_abdominal'] }],
  ['ve mosquitas y le zumban los oídos', { pos: ['vision_borrosa', 'zumbido_oidos'] }],
  ['tiene un dolor constante de cabeza', { pos: ['dolor_cabeza_intenso'] }],
  ['anda con la cursera', { pos: ['diarrea'] }],
  ['se le trabó la quijada y echaba espuma por la boca', { pos: ['convulsiones'] }],
  ['se tomó todas las pastillas de la abuela', { pos: ['intoxicacion'] }],
  ['le da fatiga cuando camina', { pos: ['dificultad_respirar'] }],
  ['se cayó de la bici, nada grave', { notPos: ['trauma_grave'] }],

  // ── Ronda 2: números y embarazo/posparto ──
  ['va en su séptimo mes y le duele la cabeza', { embarazada: true, semanas: 31 }],
  ['el niño va a cumplir su primer año', { absent: [] }],
  ['tiene diez días de haberse aliviado y tiene calentura', { pos: ['posparto', 'fiebre'] }],
  ['tiene tres meses de haber dado a luz', { absent: ['posparto'] }],
];

describe('keywordExtract — frases coloquiales', () => {
  it('tiene 30+ casos', () => expect(CASES.length).toBeGreaterThanOrEqual(30));
  for (const [text, e] of CASES) {
    it(text, () => {
      const f = keywordExtract(text);
      for (const k of e.pos ?? []) expect(f.sintomas[k], `${k} debe ser true`).toBe(true);
      for (const k of e.neg ?? []) expect(f.sintomas[k], `${k} debe ser false`).toBe(false);
      for (const k of e.notPos ?? []) expect(f.sintomas[k], `${k} no debe ser true`).not.toBe(true);
      for (const k of e.absent ?? []) expect(f.sintomas[k], `${k} no debe marcarse`).toBeUndefined();
      if (e.edad !== undefined) expect(f.edad_meses).toBeCloseTo(e.edad, 1);
      if (e.temp !== undefined) expect(f.temperatura_c).toBe(e.temp);
      if (e.resp !== undefined) expect(f.resp_por_min).toBe(e.resp);
      if (e.dur !== undefined) expect(f.duracion_dias).toBeCloseTo(e.dur, 2);
      if (e.semanas !== undefined) expect(f.semanas_embarazo).toBe(e.semanas);
      if (e.embarazada !== undefined) expect(f.embarazada).toBe(e.embarazada);
      if (e.sexo !== undefined) expect(f.sexo).toBe(e.sexo);
    });
  }

  it('texto vacío -> sin hallazgos', () => {
    expect(keywordExtract('')).toEqual({ sintomas: {} });
    expect(keywordExtract('   ')).toEqual({ sintomas: {} });
  });

  it('nunca produce claves fuera del catálogo', () => {
    const all = CASES.map(([t]) => keywordExtract(t));
    for (const f of all) for (const k of Object.keys(f.sintomas)) expect(SYMPTOM_KEYS).toContain(k);
  });

  it('la edad de 7 meses de embarazo no se confunde con la edad del paciente', () => {
    const f = keywordExtract('señora embarazada de 7 meses');
    expect(f.edad_meses).toBeUndefined();
    expect(f.semanas_embarazo).toBe(31);
  });

  it('"hace 3 meses" (duración) no es edad', () => {
    const f = keywordExtract('tiene tos desde hace 3 meses');
    expect(f.edad_meses).toBeUndefined();
    expect(f.duracion_dias).toBe(90);
  });

  it('temperatura y respiraciones no se confunden con la edad', () => {
    const f = keywordExtract('niña de 3 años, 39 grados, respira 45 por minuto');
    expect(f).toMatchObject({ edad_meses: 36, temperatura_c: 39, resp_por_min: 45 });
  });
});

describe('normalización', () => {
  it('quita acentos y mayúsculas, conserva decimales', () => {
    expect(normalizeText('Está CALIENTE, 38,5°')).toBe('esta caliente | 38.5 grados');
  });
  it('números en palabras', () => {
    expect(numericText('tiene cuarenta y ocho respiraciones')).toContain('48 respiraciones');
    expect(numericText('un año y medio')).toContain('1.5 ano');
    expect(parseNumbers('veintidós días de nacido').edad_meses).toBeCloseTo(0.7, 1);
  });
});

describe('demo end-to-end (keywords -> reglas)', () => {
  it('niña de 1 año con calentura, respiración rápida y tiraje -> urgencia', () => {
    const f = keywordExtract('La niña tiene un año, tiene calentura desde ayer y respira muy rápido, se le hunde el pecho.');
    expect(triage(f).level).toBe('urgencia');
  });
  it('señora de 40 con dolor de pecho y sudor frío -> urgencia', () => {
    expect(triage(keywordExtract('Señora de cuarenta años, le duele el pecho y tiene sudor frío.')).level).toBe('urgencia');
  });
});

describe('fusión keywords + LLM', () => {
  const text = 'el niño no tiene calentura, tose y anda muy decaído';
  const kw = keywordExtract(text);
  it('negación explícita de keywords gana sobre positivo del LLM', () => {
    const m = mergeFindings(kw, { sintomas: { fiebre: true, letargico: true } }, text);
    expect(m.sintomas.fiebre).toBe(false);
    expect(m.sintomas.letargico).toBe(true); // unión de positivos
    expect(m.sintomas.tos).toBe(true);
  });
  it('números del LLM solo si están anclados al texto', () => {
    const t2 = 'niña de 2 años con tos';
    const k2 = keywordExtract(t2);
    delete k2.edad_meses;
    expect(mergeFindings(k2, { sintomas: {}, edad_meses: 24, resp_por_min: 60 }, t2)).toMatchObject({ edad_meses: 24 });
    expect(mergeFindings(k2, { sintomas: {}, resp_por_min: 60 }, t2).resp_por_min).toBeUndefined();
  });
  it('keywords gana en números', () => {
    expect(mergeFindings(keywordExtract('respira 55 por minuto'), { sintomas: {}, resp_por_min: 50 }, 'respira 55 por minuto').resp_por_min).toBe(55);
  });
  it('LLM no puede poner embarazada=false', () => {
    expect(mergeFindings({ sintomas: {} }, { sintomas: {}, embarazada: false }, 'x').embarazada).toBeUndefined();
  });
  it('anchored', () => {
    expect(anchored(480, [40], 'edad_meses')).toBe(true);
    expect(anchored(60, [40], 'resp_por_min')).toBe(false);
  });
});

describe('salida del LLM', () => {
  it('valida claves y rangos', () => {
    const r = parseLLMOutput('{"sintomas":["fiebre","inventado","tos"],"edad_meses":12,"sexo":"F","embarazada":null,"semanas_embarazo":null,"duracion_dias":1,"temperatura_c":80,"resp_por_min":55,"level_hint":"urgencia"}');
    expect(r?.findings.sintomas).toEqual({ fiebre: true, tos: true });
    expect(r?.findings.temperatura_c).toBeUndefined();
    expect(r?.findings).toMatchObject({ edad_meses: 12, sexo: 'F', resp_por_min: 55 });
    expect(r?.level_hint).toBe('urgencia');
  });
  it('JSON roto -> null', () => {
    expect(parseLLMOutput('lo siento, no puedo')).toBeNull();
    expect(parseLLMOutput('{"sintomas": [')).toBeNull();
  });
  it('prompt y esquema incluyen todo el catálogo', () => {
    for (const k of SYMPTOM_KEYS) expect(SYSTEM_PROMPT).toContain(`${k}:`);
    expect(EXTRACTION_SCHEMA.properties.sintomas.items.enum.length).toBe(SYMPTOM_KEYS.length);
  });
});

describe('transcripción', () => {
  it('colapsa bucles de Whisper', () => {
    expect(collapseRepeats('de la historia de la historia de la historia de la historia')).toBe('de la historia de la historia');
  });
  it('quita alucinaciones de subtítulos', () => {
    expect(cleanTranscript('tiene calentura. Subtítulos realizados por la comunidad de Amara.org')).toBe('tiene calentura.');
  });
  it('remuestrea 48k -> 16k', () => {
    const a = new Float32Array(48000).fill(0.5);
    const r = resampleLinear(a, 48000);
    expect(r.length).toBe(16000);
    expect(r[100]).toBeCloseTo(0.5);
  });
});

// Salidas REALES de Llama-3.2-1B-Instruct-q4f16_1-MLC (WebLLM, modo paráfrasis, 3-oct-2026).
// Verifican que el filtro de anclaje descarta lo inventado y conserva lo dicho.
describe('paráfrasis del LLM (salidas reales capturadas)', () => {
  const REAL: [string, string, { keep: string[]; drop: string[] }][] = [
    ['La niña tiene un año, tiene calentura desde ayer y respira muy rápido, se le hunde el pecho.', '- un año de edad\n- calentura\n- respirar muy rápido\n- dolor en el pecho', { keep: ['fiebre', 'respira_rapido'], drop: ['dolor_pecho'] }],
    ['Es un bebé de ocho meses, anda suelto del estómago desde hace tres días y tiene los ojitos hundidos.', '- diarrea\n- ojos hundidos\n- vómitos', { keep: ['ojos_hundidos'], drop: ['vomito'] }],
    ['El niño de dos años tiene tos y mocos, no tiene fiebre, come bien.', '- tos\n- mocos\n- no tiene fiebre\n- come bien', { keep: ['tos', 'escurrimiento_nasal'], drop: ['fiebre'] }],
    ['Don José tiene la boca chueca y no puede mover el brazo derecho desde hace una hora.', '- dolor de cabeza\n- hiperactividad', { keep: [], drop: ['dolor_cabeza'] }],
    ['El chamaco anda muy decaído, no quiere ni el agua y lo veo como privado, no despierta bien.', '- no quiere ni el agua\n- decaído\n- no despierta bien\n- ojos hundidos', { keep: ['inconsciente'], drop: ['ojos_hundidos'] }],
    ['Tiene calentura bien alta, le duelen los huesos y detrás de los ojos, y le salieron puntitos rojos.', '- calentura alta\n- dolor de dientes\n- puntitos rojos en la piel', { keep: ['fiebre', 'petequias'], drop: [] }],
  ];
  for (const [text, raw, e] of REAL) {
    it(text.slice(0, 50), () => {
      const s = mapParaphrase(raw, text);
      for (const k of e.keep) expect(s[k], `${k} debe quedar`).toBe(true);
      for (const k of e.drop) expect(s[k], `${k} debe descartarse`).toBeUndefined();
    });
  }
  it('parseParaphrase ignora "ninguno" y viñetas', () => {
    expect(parseParaphrase('- ninguno')).toEqual([]);
    expect(parseParaphrase('1. tos\n* calentura')).toEqual(['tos', 'calentura']);
  });
  it('groundedIn', () => {
    expect(groundedIn('ojos hundidos', 'tiene los ojitos hundidos')).toBe(true);
    expect(groundedIn('dolor en el pecho', 'se le hunde el pecho')).toBe(false);
  });
});
