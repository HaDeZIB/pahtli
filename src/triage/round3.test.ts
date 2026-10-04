/**
 * Ronda 3 (4-oct-2026): sexo antes que embarazo, molestias comunes y cuidados según la molestia.
 * Reporte de uso real: "hombre de 21 años con dolor de estómago, gases y estreñido por dos días" → la app
 * preguntó si estaba embarazado (Whisper escribió "Nombre de 21 años").
 */
import { describe, expect, it } from 'vitest';
import type { Findings, FollowUpQuestion } from '../types';
import { keywordExtract } from '../ai/keywords';
import { ALL_RULES, triage } from './engine';
import { SYMPTOM_KEYS, isSymptomKey } from './findings';
import { ADVICE, MAX_ADVICE, adviceApplies, selectAdvice } from './advice';
import { SIGNOS_MAYOR, SIGNOS_NINO, SIGNOS_SIN_EDAD } from './screening';
import { RULES_BY_ID } from './rules';
import { years } from './rules/helpers';

const F = (sintomas: Record<string, boolean>, rest: Omit<Findings, 'sintomas'> = {}): Findings => ({ sintomas, ...rest });
const PREGNANCY_Q = ['embarazada', 'posparto', 'semanas_embarazo', 'movimientos_fetales_disminuidos', 'contracciones', 'salida_liquido_vaginal', 'sangrado_vaginal'];
const campos = (qs: FollowUpQuestion[]) => qs.map((q) => q.campo);
const PREGNANCY_TEXT = /embaraz|regla|menstru|lactan|amamant|dar pecho|mamar/i;

/** Simula la pantalla de preguntas: contesta con `answer` hasta 4 preguntas, re-triando cada vez. */
function flow(f0: Findings, answer: (q: FollowUpQuestion) => unknown) {
  let f: Findings = { ...f0, sintomas: { ...f0.sintomas } };
  let r = triage(f);
  const asked: string[] = [];
  while (asked.length < 4) {
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

describe('sexo antes que embarazo', () => {
  it('sexo desconocido, 21 años, dolor de panza: pregunta "¿Es hombre o mujer?" justo antes del embarazo', () => {
    const q = campos(triage(F({ dolor_abdominal: true }, { edad_meses: years(21) })).preguntas);
    expect(q).toContain('sexo');
    expect(q).toContain('embarazada');
    expect(q.indexOf('sexo')).toBeLessThan(q.indexOf('embarazada'));
    const sx = triage(F({ dolor_abdominal: true }, { edad_meses: years(21) })).preguntas.find((x) => x.campo === 'sexo')!;
    expect(sx.pregunta.es).toBe('¿Es hombre o mujer?');
  });

  it('si contesta "Hombre", ya no pregunta embarazo ni cuarentena', () => {
    const { asked } = flow(F({ dolor_abdominal: true }, { edad_meses: years(21) }), (q) => (q.campo === 'sexo' ? 'M' : q.tipo === 'si_no' ? false : undefined));
    expect(asked).toContain('sexo');
    for (const p of PREGNANCY_Q) expect(asked).not.toContain(p);
  });

  it('si contesta "Mujer", sí pregunta embarazo; si contesta "No sé", el embarazo se pregunta igual', () => {
    const mujer = flow(F({ dolor_abdominal: true }, { edad_meses: years(21) }), (q) => (q.campo === 'sexo' ? 'F' : q.tipo === 'si_no' ? false : undefined));
    expect(mujer.asked).toContain('embarazada');
    const noSe = flow(F({ dolor_abdominal: true }, { edad_meses: years(21) }), (q) => (q.campo === 'sexo' ? undefined : q.tipo === 'si_no' ? false : undefined));
    expect(noSe.asked).toContain('embarazada');
  });

  it('con el sexo conocido no se pregunta el sexo', () => {
    expect(campos(triage(F({ dolor_abdominal: true }, { edad_meses: years(21), sexo: 'F' })).preguntas)).not.toContain('sexo');
    expect(campos(triage(F({ dolor_abdominal: true }, { edad_meses: years(21), sexo: 'M' })).preguntas)).not.toContain('sexo');
  });

  it('nunca pregunta embarazo a un hombre, ni a una mujer fuera de 10–49 años, para ninguna molestia del catálogo', () => {
    for (const k of SYMPTOM_KEYS) {
      if (k === 'posparto') continue;
      for (const f of [F({ [k]: true }, { sexo: 'M', edad_meses: years(21) }), F({ [k]: true }, { sexo: 'M' }), F({ [k]: true }, { sexo: 'F', edad_meses: years(60) }), F({ [k]: true }, { edad_meses: years(8) })]) {
        const q = campos(triage(f).preguntas);
        for (const p of PREGNANCY_Q) expect(q, `${k} ${JSON.stringify(f)}`).not.toContain(p);
        if (f.sexo) expect(q, k).not.toContain('sexo');
      }
    }
  });

  it('a un hombre no le dispara ninguna regla de embarazo aunque diga "le sale agua del oído" o "le duele la boca del estómago"', () => {
    for (const t of ['hombre de 30 años, le sale agua del oído', 'señor de 40 con dolor en la boca del estómago', 'muchacho de 17 con la cara hinchada por la muela']) {
      const f = keywordExtract(t);
      expect(f.sexo, t).toBe('M');
      expect(f.embarazada, t).not.toBe(true);
      const ids = triage(f).fired.map((r) => r.id);
      expect(ids.some((id) => /EMB|PP-|PREG/.test(id)), `${t}: ${ids}`).toBe(false);
    }
  });
});

describe('el caso reportado: hombre de 21 años con dolor de estómago, gases y estreñido', () => {
  for (const text of [
    'Hombre de 21 años con dolor de estómago, gases y estreñido por dos días',
    'Nombre de 21 años con dolor de estómago, gases y estreñido por dos días', // como lo transcribió Whisper
  ]) {
    it(`"${text}": hombre, sin preguntas de embarazo, aquí con cuidados de estreñimiento y gases`, () => {
      const f = keywordExtract(text);
      expect(f.sexo).toBe('M');
      expect(f.edad_meses).toBe(years(21));
      expect(f.duracion_dias).toBe(2);
      expect(f.sintomas).toMatchObject({ dolor_abdominal: true, gases: true, estrenimiento: true });
      const { r, asked } = flow(f, (q) => (q.tipo === 'si_no' ? false : undefined));
      for (const p of [...PREGNANCY_Q, 'sexo']) expect(asked).not.toContain(p);
      expect(asked[0]).toBe('signo_peligro_general');
      expect(asked).toContain('no_obra_ni_gases');
      expect(r.level).toBe('aqui');
      const adv = selectAdvice({ ...f }, r.level);
      expect(adv.map((a) => a.id)).toEqual(['ADV-ESTRENIMIENTO', 'ADV-GASES', 'ADV-DOLOR-PANZA']);
      for (const a of adv) for (const x of [...a.cuidados, ...a.regrese, ...a.consulta]) expect(x).not.toMatch(PREGNANCY_TEXT);
      expect(adv[0].cuidados.join(' ')).toMatch(/agua/);
      expect(adv[0].cuidados.join(' ')).toMatch(/fibra/);
    });
  }

  it('si no puede echar gases → urgencia (posible obstrucción)', () => {
    const { r } = flow(keywordExtract('Hombre de 21 años con dolor de estómago, gases y estreñido por dos días'), (q) => (q.campo === 'no_obra_ni_gases' ? true : q.tipo === 'si_no' ? false : undefined));
    expect(r.level).toBe('urgencia');
    expect(r.fired[0].id).toBe('NHS-ABD-OBST-01');
  });

  it('"joven" o "paciente" sin artículo de sexo: primero pregunta el sexo', () => {
    for (const t of ['joven de 21 años con dolor de panza', 'paciente de 21 años con dolor de estómago']) {
      const q = campos(triage(keywordExtract(t)).preguntas);
      expect(q.indexOf('sexo'), t).toBeGreaterThanOrEqual(0);
      expect(q.indexOf('sexo'), t).toBeLessThan(q.indexOf('embarazada'));
    }
  });
});

describe('alacrán, araña y alergia (antes salían "Atender aquí")', () => {
  it('niño de 3 años picado por alacrán → urgencia (SSA-ALAC-01) aunque no tenga síntomas', () => {
    const r = triage(keywordExtract('a mi niño de 3 años le picó un alacrán'));
    expect(r.level).toBe('urgencia');
    expect(r.fired[0].id).toBe('SSA-ALAC-01');
  });
  it('alacrán sin edad → urgencia (la edad desconocida solo puede subir)', () => {
    expect(triage(keywordExtract('le picó un alacrán en el pie')).level).toBe('urgencia');
  });
  it('adulto de 40 picado por alacrán, sin síntomas → centro hoy, y pregunta por los síntomas de intoxicación', () => {
    const r = triage(keywordExtract('señor de 40 años le picó un alacrán en la mano'));
    expect(r.level).toBe('centro_hoy');
    expect(campos(r.preguntas)[0]).toBe('alacran_sintomas');
  });
  it('adulto picado por alacrán que babea o es diabético → urgencia', () => {
    expect(triage(keywordExtract('señor de 40 años, un alacrán le picó y está babeando')).level).toBe('urgencia');
    expect(triage(keywordExtract('señora de 50 años diabética, le picó un alacrán')).level).toBe('urgencia');
  });
  it('viuda negra → urgencia; araña desconocida → centro hoy', () => {
    expect(triage(keywordExtract('lo mordió una araña viuda negra')).level).toBe('urgencia');
    expect(triage(keywordExtract('a la señora de 30 años la mordió una araña en el brazo')).level).toBe('centro_hoy');
  });
  it('labios y lengua hinchados → urgencia', () => {
    expect(triage(keywordExtract('se le hincharon los labios y la lengua después de una picadura')).level).toBe('urgencia');
  });
});

describe('otras molestias comunes', () => {
  const lvl = (t: string) => triage(keywordExtract(t)).level;
  it('ardor al orinar: hombre → centro hoy; mujer de 30 sin otros datos → aquí con cuidados y consulta', () => {
    expect(lvl('hombre de 30 años con ardor al orinar')).toBe('centro_hoy');
    const f = keywordExtract('mujer de 30 años con ardor al orinar');
    const r = triage(f);
    expect(r.level).toBe('aqui');
    const adv = selectAdvice({ ...f, embarazada: false }, 'aqui');
    expect(adv[0].id).toBe('ADV-ORINA-MUJER');
    expect(adv[0].consulta.join(' ')).toMatch(/receta/);
  });
  it('ardor al orinar con calentura → centro hoy (IMSS077-PIELO-01)', () => {
    expect(lvl('señora de 30 años con ardor al orinar y calentura')).toBe('centro_hoy');
  });
  it('dolor de cintura con fiebre → centro hoy; sin poder orinar → urgencia', () => {
    expect(lvl('señora de 60 años con dolor de cintura y calentura')).toBe('centro_hoy');
    expect(lvl('señor de 50 con dolor de espalda y no puede orinar')).toBe('urgencia');
  });
  it('dolor abajo a la derecha que duele al caminar → urgencia (apendicitis)', () => {
    expect(lvl('muchacha de 19 años con dolor de panza abajo a la derecha, le duele más al caminar')).toBe('urgencia');
  });
  it('muela con la cara hinchada → centro hoy; con el ojo hinchado → urgencia', () => {
    expect(lvl('hombre de 25 con dolor de muela y la cara hinchada')).toBe('centro_hoy');
    expect(lvl('hombre de 25 con dolor de muela y se le hinchó el ojo')).toBe('urgencia');
  });
  it('golpe en la cabeza con vómito → centro hoy; tomando anticoagulante → urgencia', () => {
    expect(lvl('señor de 40 años se pegó en la cabeza y vomitó')).toBe('centro_hoy');
    expect(lvl('señora de 75 años se cayó y se pegó en la cabeza, toma medicina para adelgazar la sangre')).toBe('urgencia');
  });
  it('quemadura en la cara → urgencia; quemadura en la mano de un adulto → centro hoy', () => {
    expect(lvl('señor de 30 años se quemó la cara con aceite')).toBe('urgencia');
    expect(lvl('señor de 30 años se quemó la mano con el comal')).toBe('centro_hoy');
  });
  it('cortada con algo clavado → urgencia; pisó un clavo → centro hoy', () => {
    expect(lvl('se cortó la mano y tiene un vidrio clavado')).toBe('urgencia');
    expect(lvl('muchacho de 15 años pisó un clavo')).toBe('centro_hoy');
  });
  it('diabético que suda frío y tiembla → centro hoy con la acción de algo dulce', () => {
    const r = triage(keywordExtract('hombre de 50 diabético que tiembla y suda frío'));
    expect(r.level).toBe('centro_hoy');
    expect(r.fired.map((x) => x.id)).toContain('NOM015-HIPO-01');
    expect(r.fired.find((x) => x.id === 'NOM015-HIPO-01')!.accion.es).toMatch(/algo dulce/);
  });
  it('tos con sangre → centro hoy; tos de 3 semanas en adulto → centro hoy (tuberculosis)', () => {
    expect(lvl('señor de 60 años que tose sangre')).toBe('centro_hoy');
    expect(lvl('señor de 45 años con tos desde hace 3 semanas')).toBe('centro_hoy');
  });
  it('gripa de un adulto sin signos → aquí con cuidados de gripa', () => {
    const f = keywordExtract('señora de 40 años con gripa y tos desde hace dos días');
    expect(triage(f).level).toBe('aqui');
    expect(selectAdvice(f, 'aqui')[0].id).toBe('ADV-GRIPA');
  });
});

describe('reglas nuevas: integridad', () => {
  const NEW = ALL_RULES.filter((r) => r.block === 'common');
  it('hay reglas nuevas y cada una cita página o sección y una URL https', () => {
    expect(NEW.length).toBeGreaterThanOrEqual(30);
    for (const r of NEW) {
      expect(r.fuente, r.id).toMatch(/p\. ?\d|\d+\.\d+|revisada|criterio|tarjeta/);
      expect(r.fuente_url, r.id).toMatch(/^https:\/\//);
    }
  });
  it('ninguna acción nueva menciona medicinas ni dosis', () => {
    for (const r of NEW) expect(r.accion.es, r.id).not.toMatch(/\d+\s*(mg|ml|mcg|UI|gotas)\b|paracetamol|ibuprofeno|aspirina|antihistam/i);
  });
  it('la revisión de signos de peligro sigue válida: cada signo listado sigue siendo urgencia por su regla', () => {
    for (const list of [SIGNOS_NINO, SIGNOS_MAYOR, SIGNOS_SIN_EDAD]) {
      for (const s of list) for (const id of s.reglas) expect(RULES_BY_ID[id]?.level, id).toBe('urgencia');
    }
  });
});

describe('cuidados según la molestia (advice.ts)', () => {
  it('cada entrada usa claves del catálogo, cita una fuente https y no da medicinas ni dosis', () => {
    for (const a of ADVICE) {
      for (const k of a.sintomas) expect(isSymptomKey(k), `${a.id}: ${k}`).toBe(true);
      expect(a.fuente.length, a.id).toBeGreaterThan(20);
      expect(a.fuente_url, a.id).toMatch(/^https:\/\//);
      for (const x of [...a.cuidados, ...a.regrese, ...(a.consulta ?? []), ...(a.mientras ?? [])]) {
        expect(x, a.id).not.toMatch(/\d+\s*(mg|ml|mcg|UI|gotas)\b|paracetamol|ibuprofeno|aspirina|antihistam|laxante|pomada para/i);
      }
      expect(a.cuidados.length + (a.mientras?.length ?? 0), a.id).toBeGreaterThan(0);
    }
  });

  it('a un hombre nunca le sale texto de embarazo, regla o lactancia', () => {
    for (const a of ADVICE) {
      const f = F(Object.fromEntries(a.sintomas.map((k) => [k, true])), { sexo: 'M', edad_meses: years(30) });
      for (const level of ['aqui', 'centro_hoy'] as const) {
        for (const s of selectAdvice(f, level, 99)) for (const x of [...s.cuidados, ...s.regrese, ...s.consulta]) expect(x, s.id).not.toMatch(PREGNANCY_TEXT);
      }
    }
  });

  it('determinista, máximo 3, y nada en urgencia', () => {
    const f = F({ estrenimiento: true, gases: true, dolor_abdominal: true, agruras: true, nauseas: true }, { edad_meses: years(30), sexo: 'M' });
    expect(selectAdvice(f, 'aqui')).toEqual(selectAdvice(f, 'aqui'));
    expect(selectAdvice(f, 'aqui')).toHaveLength(MAX_ADVICE);
    expect(selectAdvice(f, 'urgencia')).toEqual([]);
  });

  it('centro hoy: solo "mientras llega" (sin la lista de cuidados en casa)', () => {
    const adv = selectAdvice(F({ picadura_alacran: true, estrenimiento: true }, { edad_meses: years(40) }), 'centro_hoy');
    expect(adv.map((a) => a.id)).toEqual(['ADV-ALACRAN']);
    expect(adv[0].modo).toBe('mientras');
    expect(adv[0].regrese).toEqual([]);
  });

  it('respeta edad y sexo: estreñimiento no a un niño de 3 años; ardor al orinar de mujer no a hombre, ni en embarazo, ni sin edad', () => {
    const est = ADVICE.find((a) => a.id === 'ADV-ESTRENIMIENTO')!;
    expect(adviceApplies(est, F({ estrenimiento: true }, { edad_meses: 36 }))).toBe(false);
    expect(adviceApplies(est, F({ estrenimiento: true }))).toBe(false);
    const uti = ADVICE.find((a) => a.id === 'ADV-ORINA-MUJER')!;
    expect(adviceApplies(uti, F({ ardor_orinar: true }, { sexo: 'M', edad_meses: years(30) }))).toBe(false);
    expect(adviceApplies(uti, F({ ardor_orinar: true }, { sexo: 'F', edad_meses: years(30), embarazada: true }))).toBe(false);
    expect(adviceApplies(uti, F({ ardor_orinar: true }, { sexo: 'F' }))).toBe(false);
    expect(adviceApplies(uti, F({ ardor_orinar: true }, { sexo: 'F', edad_meses: years(30) }))).toBe(true);
  });

  it('sin molestia reconocida no hay cuidados específicos (queda el texto general de la regla por defecto)', () => {
    expect(selectAdvice(F({}, { edad_meses: years(30) }), 'aqui')).toEqual([]);
  });
});
