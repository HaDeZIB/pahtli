/**
 * Ronda 4 (4-oct-2026): revisión externa de la ronda 3 (docs/decisiones-clinicas.md, "Revisión ronda 3").
 * Cada bloque corresponde a un hallazgo de la revisión. Las frases son las de la revisión o variantes escritas para
 * esta ronda (no se usó ningún texto de test_v3).
 */
import { describe, expect, it } from 'vitest';
import type { Findings, FollowUpQuestion } from '../types';
import { keywordExtract } from '../ai/keywords';
import { triage } from './engine';
import { ADVICE, adviceApplies, selectAdvice } from './advice';
import { RULES_BY_ID } from './rules';
import { pregnancyPossible, years } from './rules/helpers';
import { MAX_FOLLOWUP_QUESTIONS, maxFollowUps } from './uncertainty';

const F = (sintomas: Record<string, boolean>, rest: Omit<Findings, 'sintomas'> = {}): Findings => ({ sintomas, ...rest });
const level = (text: string) => triage(keywordExtract(text)).level;
const fired = (text: string) => triage(keywordExtract(text)).fired.map((r) => r.id);
const qs = (text: string) => triage(keywordExtract(text)).preguntas.map((q) => q.campo);

/** Simula la pantalla de preguntas (con la pregunta extra cuando se preguntó el sexo). */
function flow(text: string, answer: (q: FollowUpQuestion) => unknown) {
  let f = keywordExtract(text);
  let r = triage(f);
  const asked: string[] = [];
  while (asked.length < maxFollowUps(asked)) {
    const q = r.preguntas.find((p) => !asked.includes(p.campo));
    if (!q) break;
    asked.push(q.campo);
    const v = answer(q);
    f = { ...f, sintomas: { ...f.sintomas } };
    if (v !== undefined) {
      if (q.campo === 'sexo' || q.campo === 'embarazada' || q.tipo !== 'si_no') (f as unknown as Record<string, unknown>)[q.campo] = v;
      else f.sintomas[q.campo] = v as boolean;
    }
    r = triage(f);
  }
  return { f, r, asked };
}

describe('NHS-VOM-GREEN-01: vómito verde a cualquier edad (NHS: "yellow-green or green vomit (children)")', () => {
  it.each(['niño de 3 años vomita verde', 'mi hijo de 6 años vomitó verde', 'bebé de 8 meses vomita verde', 'niña de 2 años vomita amarillo verdoso'])('%s → urgencia', (t) => {
    expect(level(t)).toBe('urgencia');
    expect(fired(t)).toContain('NHS-VOM-GREEN-01');
  });
  it('la regla ya no tiene corte de edad y cita la línea de niños', () => {
    expect(RULES_BY_ID['NHS-VOM-GREEN-01'].fuente).toContain('yellow-green or green vomit (children)');
  });
  it('"vomitó bilis" NO cuenta como verde (decisión #34)', () => {
    expect(keywordExtract('señor de 40 años vomitó pura bilis').sintomas.vomito_verde).toBeUndefined();
  });
});

describe('quemaduras, heridas y golpes en la cabeza (criterios NHS que faltaban)', () => {
  it('NHS-BURN-02: quemadura muy grande o profunda → urgencia a cualquier edad', () => {
    const t = 'señor de 30 años se quemó la espalda con aceite hirviendo, quemadura grande y profunda';
    expect(level(t)).toBe('urgencia');
    expect(fired(t)).toContain('NHS-BURN-02');
    // Con una quemadura cualquiera, la app pregunta si es muy grande o profunda.
    expect(qs('señora de 40 años se quemó el brazo con agua caliente')).toContain('quemadura_grande_profunda');
  });
  it('NHS-WOUND-01: cortada en la palma de la mano o en la cara → urgencia; un raspón en la cara no', () => {
    expect(level('señor de 50 años se cortó la palma de la mano con un machete')).toBe('urgencia');
    expect(level('el niño de 8 años se cortó la cara con un vidrio')).toBe('urgencia');
    expect(keywordExtract('se raspó la cara al caerse, tiene 9 años').sintomas.herida_cara_palma).toBeUndefined();
  });
  it('NHS-HEAD-01: caída de escaleras, hundimiento, ojo morado o cambio de comportamiento → urgencia', () => {
    expect(level('se cayó de las escaleras y se pegó en la cabeza, tiene 30 años')).toBe('urgencia');
    expect(level('señor de 40 años se pegó en la cabeza y le sale agua por la nariz')).toBe('urgencia');
    // Golpe sin señas: se pregunta primero por el golpe de alto riesgo.
    expect(qs('señor de 75 años se cayó y se pegó en la cabeza')).toContain('golpe_cabeza_alto_riesgo');
  });
  it('NHS-HEAD-02: golpe en la cabeza estando tomado → centro de salud hoy', () => {
    expect(level('señor de 35 años andaba tomado y se pegó en la cabeza')).toBe('centro_hoy');
  });
  it('ADV-GOLPE-CABEZA lista los signos NHS que faltaban', () => {
    const r = ADVICE.find((a) => a.id === 'ADV-GOLPE-CABEZA')!.regrese.join(' ');
    for (const s of ['5 escalones', 'velocidad', 'hundimiento', 'ojo morado', 'comportamiento', 'alcohol']) expect(r).toContain(s);
  });
});

describe('dolor muy fuerte + panza (revisión NHS-BLOAT-01)', () => {
  it('"panza hinchada y dolor muy fuerte" = dolor de panza muy fuerte; en ≥50 años → urgencia (IITT-R-ABD-01)', () => {
    const f = keywordExtract('señora de 60 años con panza hinchada y dolor muy fuerte de repente');
    expect(f.sintomas.dolor_abdominal_intenso).toBe(true);
    expect(triage(f).level).toBe('urgencia');
  });
  it('si duele otra parte (cabeza), "dolor muy fuerte" no se le pone a la panza', () => {
    expect(keywordExtract('dolor muy fuerte de cabeza y panza inflada').sintomas.dolor_abdominal_intenso).toBeUndefined();
  });
});

describe('alcance de la negación (revisión EXTRACT-NEG-SCOPE)', () => {
  it.each([
    ['niño de 3 años sin calentura con convulsiones', 'urgencia'],
    ['señor de 60 sin tos con dolor de pecho', 'urgencia'],
    ['joven de 20 sin tos con mucha dificultad para respirar', 'urgencia'],
    ['señora de 30 sin diarrea con dolor de panza muy fuerte', 'centro_hoy'],
    ['señor de 30 años no tiene calentura tiene dolor de panza muy fuerte', 'centro_hoy'],
    ['señora de 30 no está embarazada tiene dolor de panza muy fuerte', 'centro_hoy'],
    ['niño de 4 años sin diarrea con vómito de sangre', 'centro_hoy'],
  ])('%s → %s', (t, l) => expect(level(t)).toBe(l));
  it('la negación sigue negando lo suyo', () => {
    const f = keywordExtract('niño de 3 años sin calentura con convulsiones');
    expect(f.sintomas.fiebre).toBe(false);
    expect(keywordExtract('niño de 2 años no anda con calentura').sintomas.fiebre).toBe(false);
    expect(keywordExtract('no tiene calentura ni tos').sintomas).toMatchObject({ fiebre: false, tos: false });
    expect(keywordExtract('señora de 30 no está embarazada tiene dolor de panza').embarazada).toBe(false);
  });
  it('"vómito de sangre" se reconoce', () => {
    expect(keywordExtract('niño de 4 años con vómito de sangre').sintomas.vomito_sangre).toBe(true);
  });
});

describe('¿quién es el paciente? edad y sexo (revisión EXTRACT-PATIENT-AGE / SEX-*)', () => {
  it.each([
    ['la señora de 30 años trae a su bebé de 1 mes con calentura', 1],
    ['mi hija de 16 años trae a su bebé de 1 mes con calentura', 1],
    ['señora de 30 con su bebé de 1 mes, el bebé tiene calentura', 1],
    ['mi esposa de 25 años dice que el niño de 3 años tiene tos', 36],
    ['la mamá trae al niño de 2 años con diarrea', 24],
    ['el bebé de 10 meses tiene calentura, la mamá tiene 19 años', 10],
  ])('%s → edad %d meses', (t, m) => expect(keywordExtract(t).edad_meses).toBeCloseTo(m, 0));
  it('el bebé de 1 mes con calentura que trae la señora de 30 años → urgencia (IMCI-YI-04), sin preguntar embarazo', () => {
    const t = 'la señora de 30 años trae a su bebé de 1 mes con calentura';
    expect(level(t)).toBe('urgencia');
    expect(qs(t)).not.toContain('embarazada');
  });
  it('dos edades que no se sabe de quién son → la edad queda sin llenar (la app la pregunta)', () => {
    expect(keywordExtract('señora de 30 con su bebé de 1 mes con calentura').edad_meses).toBeUndefined();
  });
  it.each([
    ['la señora trae a su niño, ella tiene 25 años y dolor de panza con sangrado vaginal', 'F'],
    ['viene doña María de 32 años con su niño en brazos ella tiene dolor de panza y le baja sangre', 'F'],
    ['mujer de 25 años, su hijo la trajo, tiene dolor de panza', 'F'],
    ['le traigo a mi hijo, yo tengo dolor de panza, tengo 25 años y soy mujer', 'F'],
    ['La señora dice que su esposo tiene dolor de panza', 'M'],
    ['el señor dice que su esposa está embarazada, él tiene dolor de panza', 'M'],
    ['mi mamá de 45 años tiene dolor de panza', 'F'],
    ['El señor dice que le duele el pecho', 'M'],
    ['La muchacha dice que le duele mucho la cabeza', 'F'],
  ])('%s → sexo %s', (t, s) => expect(keywordExtract(t).sexo).toBe(s));
  it('si no se sabe quién habla de sus molestias, el sexo queda sin llenar', () => {
    expect(keywordExtract('le traigo a mi hijo, yo tengo dolor de panza').sexo).toBeUndefined();
  });
  it('la mujer que trae a su hijo y tiene sangrado: se pregunta embarazo (con "Sí" → urgencia)', () => {
    const t = 'la señora trae a su niño, ella tiene 25 años y dolor de panza con sangrado vaginal';
    expect(qs(t)).toContain('embarazada');
    const { r } = flow(t, (q) => (q.campo === 'embarazada' ? true : false));
    expect(r.level).toBe('urgencia');
  });
  it('el embarazo de otra persona no es del paciente', () => {
    const f = keywordExtract('el señor dice que su esposa está embarazada, él tiene dolor de panza');
    expect(f.embarazada).toBeUndefined();
    expect(triage(f).level).not.toBe('urgencia');
    expect(qs('La señora dice que su esposo tiene dolor de panza')).not.toContain('embarazada');
  });
  it('"Nombre, 21 años" (Whisper) = hombre; "mi mamá de 45 años" no pregunta el sexo', () => {
    expect(keywordExtract('Nombre, 21 años, dolor de estómago y gases').sexo).toBe('M');
    expect(keywordExtract('nombre 21 años, dolor de estómago').sexo).toBe('M');
    expect(qs('mi mamá de 45 años tiene dolor de panza')).not.toContain('sexo');
  });
  it('"5 meses de embarazo" no es la edad', () => {
    const f = keywordExtract('La señora tiene cinco meses de embarazo y tiene calentura desde ayer.');
    expect(f.edad_meses).toBeUndefined();
    expect(triage(f).level).toBe('urgencia');
  });
});

describe('embarazo y edad (revisión ENGINE-PREG-AGE)', () => {
  it('con edad conocida de 2 meses a 9 años, "embarazada" se ignora (es de la mamá)', () => {
    const t = 'mi hija de 3 años tiene diarrea, yo estoy embarazada';
    const f = keywordExtract(t);
    expect(f.edad_meses).toBe(36);
    expect(f.embarazada).toBeUndefined();
    // Aunque el extractor lo marcara, el motor no pregunta ni dispara reglas del embarazo.
    const forced = { ...f, embarazada: true };
    const r = triage(forced);
    expect(r.preguntas.map((q) => q.campo)).not.toContain('sangrado_vaginal');
    expect(triage({ ...forced, sintomas: { ...forced.sintomas, sangrado_vaginal: true } }).fired.map((x) => x.id)).not.toContain('NOM007-EMB-01');
    expect(pregnancyPossible({ sintomas: {}, edad_meses: 36, embarazada: true })).toBe(false);
  });
  it('menor de 2 meses + cuarentena sigue siendo el caso de la mamá (sin cambio)', () => {
    expect(pregnancyPossible({ sintomas: { posparto: true }, edad_meses: 0 })).toBe(true);
  });
});

describe('presión alta en el embarazo y cuidados que no aplican al embarazo (revisión ADV-PRESION, ADV-ESPALDA…)', () => {
  it('embarazada con presión alta → urgencia (NOM-007 5.3.1.3)', () => {
    const t = 'mujer de 25 años embarazada de 30 semanas con presión alta';
    expect(level(t)).toBe('urgencia');
    expect(fired(t)).toContain('NOM007-EMB-09');
  });
  it('en la cuarentena con presión alta → centro de salud hoy, sin preguntar "¿Está embarazada?"', () => {
    const t = 'dio a luz hace 2 semanas con presión alta';
    expect(level(t)).toBe('centro_hoy');
    expect(qs(t)).not.toContain('embarazada');
  });
  it('ningún cuidado general (cabeza, cintura, mareo, panza, náusea, presión, orina) a una embarazada ni sin descartar embarazo', () => {
    const ids = ['ADV-CABEZA', 'ADV-ESPALDA', 'ADV-MAREO', 'ADV-DOLOR-PANZA', 'ADV-NAUSEA', 'ADV-PRESION', 'ADV-ORINA-MUJER'];
    const all = F({ dolor_cabeza: true, dolor_espalda_baja: true, mareo: true, dolor_abdominal: true, nauseas: true, hipertension: true, ardor_orinar: true });
    for (const id of ids) {
      const a = ADVICE.find((x) => x.id === id)!;
      expect(a.noEmbarazo, id).toBe(true);
      expect(adviceApplies(a, { ...all, sexo: 'F', edad_meses: years(30), embarazada: true }), id).toBe(false);
      expect(adviceApplies(a, { ...all, sexo: 'F', edad_meses: years(30) }), `${id} sin descartar`).toBe(false);
      expect(adviceApplies(a, { ...all, edad_meses: years(30) }), `${id} sexo desconocido`).toBe(false);
      expect(adviceApplies(a, { ...all, sexo: 'F', edad_meses: years(30), embarazada: false }), `${id} con "No"`).toBe(true);
    }
    // Hombre y mujer de 55: sí.
    expect(adviceApplies(ADVICE.find((x) => x.id === 'ADV-CABEZA')!, { ...all, sexo: 'M', edad_meses: years(30) })).toBe(true);
    expect(adviceApplies(ADVICE.find((x) => x.id === 'ADV-CABEZA')!, { ...all, sexo: 'F', edad_meses: years(55) })).toBe(true);
  });
  it('embarazada: sale la lista de señales de alarma (IMSS-028 p. 9) en vez de cuidados generales', () => {
    const adv = selectAdvice(F({ dolor_espalda_baja: true }, { embarazada: true, semanas_embarazo: 34, sexo: 'F', edad_meses: years(28) }), 'aqui');
    expect(adv.map((a) => a.id)).toEqual(['ADV-EMBARAZO']);
    expect(adv[0].regrese.join(' ')).toMatch(/contracciones antes de las 37 semanas/);
    expect(adv[0].regrese.join(' ')).toMatch(/presión alta/);
  });
  it('embarazada de 34 semanas con dolor de cintura: se pregunta por contracciones; con "Sí" → urgencia', () => {
    const t = 'embarazada de 34 semanas con dolor de cintura, tiene 28 años';
    expect(qs(t)).toContain('contracciones');
    expect(flow(t, (q) => q.campo === 'contracciones').r.level).toBe('urgencia');
  });
  it('mujer de 24 años con dolor de panza y mareo: se pregunta embarazo antes de dar cuidados', () => {
    expect(qs('mujer de 24 años con dolor de panza y mareo')).toContain('embarazada');
    expect(qs('mujer de 25 años con dolor de cabeza')).toContain('embarazada');
  });
});

describe('ronchas con calentura (revisión ADV-RONCHAS)', () => {
  it('con calentura no se dan los cuidados de piquete', () => {
    const a = ADVICE.find((x) => x.id === 'ADV-RONCHAS')!;
    expect(adviceApplies(a, F({ sarpullido: true, fiebre: true }, { edad_meses: 36 }))).toBe(false);
    expect(adviceApplies(a, F({ sarpullido: true }, { edad_meses: 36 }))).toBe(true);
  });
});

describe('preguntas: el sexo no le quita lugar a una pregunta clínica (revisión FLOW-SEX-GATE-CAP)', () => {
  it('maxFollowUps suma 1 solo si se preguntó el sexo', () => {
    expect(maxFollowUps(['signo_peligro_general', 'tos'])).toBe(MAX_FOLLOWUP_QUESTIONS);
    expect(maxFollowUps(['signo_peligro_general', 'sexo'])).toBe(MAX_FOLLOWUP_QUESTIONS + 1);
  });
  it('sexo desconocido + ronchas: después de "Mujer" sí llega la pregunta de embarazo', () => {
    const { asked } = flow('tiene 25 años y ronchas', (q) => (q.campo === 'sexo' ? 'F' : false));
    expect(asked).toContain('sexo');
    expect(asked).toContain('embarazada');
  });
});
