import { describe, expect, it } from 'vitest';
import type { Findings, TriageLevel } from '../types';
import { LEVEL_RANK } from '../types';
import { ALL_RULES, MODEL_ESCALATION_ID, NO_DANGER_RULE, evaluateRules, followUpQuestions, triage } from './engine';
import { NUMERIC_FIELDS, PREGUNTAS, SYMPTOMS, isSymptomKey } from './findings';
import { classifySyndrome } from './syndrome';
import { days, years } from './rules/helpers';

type S = Record<string, boolean>;
const F = (sintomas: S, rest: Omit<Findings, 'sintomas'> = {}): Findings => ({ sintomas, ...rest });
const ids = (f: Findings) => evaluateRules(f).map((r) => r.id);

/** Un caso positivo por regla. La prueba de cobertura exige que TODAS las reglas tengan uno. */
const POSITIVE: Record<string, Findings> = {
  'GEN-CONV-01': F({ convulsiones: true }, { edad_meses: years(25) }),
  'GEN-UNC-01': F({ inconsciente: true }),
  'IMCI-GDS-01': F({ letargico: true }, { edad_meses: 24 }),
  'IMCI-GDS-02': F({ no_puede_beber: true }, { edad_meses: 24 }),
  'IMCI-GDS-03': F({ vomita_todo: true }, { edad_meses: 24 }),
  'GEN-STRIDOR-01': F({ estridor: true }, { edad_meses: 18 }),
  'GEN-CYAN-01': F({ cianosis: true }),
  'GEN-BLEED-01': F({ sangrado_abundante: true }, { edad_meses: years(30) }),
  'IMCI-ANEM-01': F({ palidez_intensa: true }, { edad_meses: 24 }),
  'IMCI-ANEM-02': F({ palidez: true }, { edad_meses: 24 }),
  'IMCI-NUT-01': F({ hinchazon_ambos_pies: true }, { edad_meses: 30 }),
  'IITT-Y-CIRC-01': F({ vomita_todo: true }, { edad_meses: years(25) }),
  'IMCI-RESP-01': F({ tos: true }, { edad_meses: 6, resp_por_min: 52 }),
  'IMCI-RESP-02': F({ tos: true }, { edad_meses: 24, resp_por_min: 44 }),
  'NOM031-IRA-01': F({ respira_rapido: true }, { edad_meses: 24 }),
  'IMCI-RESP-03': F({ tiraje: true }, { edad_meses: 12 }),
  'NOM031-IRA-02': F({ dificultad_respirar: true }, { edad_meses: 36 }),
  'IMCI-RESP-04': F({ tos: true }, { edad_meses: 36, duracion_dias: 15 }),
  'IITT-Y-WHEEZE-01': F({ sibilancias: true }, { edad_meses: 48 }),
  'IMCI-DIAR-01': F({ diarrea: true, ojos_hundidos: true, pliegue_muy_lento: true }, { edad_meses: 18 }),
  'IMCI-DIAR-02': F({ diarrea: true, irritable: true, bebe_con_avidez: true }, { edad_meses: 18 }),
  'IMCI-DIAR-03': F({ diarrea: true }, { edad_meses: 24, duracion_dias: 16 }),
  'IMCI-DIAR-04': F({ diarrea: true, irritable: true, ojos_hundidos: true }, { edad_meses: 24, duracion_dias: 16 }),
  'IMCI-DIAR-05': F({ diarrea: true, sangre_heces: true }, { edad_meses: 30 }),
  'IMCI-FEV-01': F({ fiebre: true, rigidez_nuca: true }, { edad_meses: 36 }),
  'IITT-R-NEURO-01': F({ letargico: true, dolor_cabeza: true }, { edad_meses: years(30) }),
  'IMCI-FEV-02': F({ fiebre: true }, { edad_meses: 24, duracion_dias: 8 }),
  'IMCI-MEAS-01': F({ fiebre: true, sarpullido: true, tos: true }, { edad_meses: 24 }),
  'IMCI-MEAS-02': F({ fiebre: true, sarpullido: true, ojo_nublado: true }, { edad_meses: 24 }),
  'IMCI-YI-01': F({ no_come_bien: true }, { edad_meses: 1 }),
  'IMCI-YI-02': F({}, { edad_meses: days(3), resp_por_min: 64 }),
  'IMCI-YI-03': F({}, { edad_meses: 1, resp_por_min: 64 }),
  'IMCI-YI-04': F({ fiebre: true }, { edad_meses: 1 }),
  'IMCI-YI-05': F({}, { edad_meses: 1, temperatura_c: 35.0 }),
  'IMCI-YI-06': F({ no_se_mueve: true }, { edad_meses: 1 }),
  'IMCI-YI-07': F({ palmas_plantas_amarillas: true }, { edad_meses: 1 }),
  'IMCI-YI-08': F({ ictericia: true }, { edad_meses: 0.5 }),
  'IMCI-YI-09': F({ ombligo_rojo_pus: true }, { edad_meses: 0.5 }),
  'NOM007-RN-01': F({ distension_abdominal: true }, { edad_meses: days(10) }),
  'NOM007-EMB-01': F({ sangrado_vaginal: true }, { embarazada: true, edad_meses: years(25) }),
  'NOM007-EMB-02': F({ dolor_cabeza_intenso: true }, { embarazada: true }),
  'IMSS-EMB-01': F({ zumbido_oidos: true }, { embarazada: true }),
  'NOM007-EMB-03': F({ salida_liquido_vaginal: true }, { embarazada: true }),
  'NOM007-EMB-04': F({ dolor_abdominal: true }, { embarazada: true }),
  'NOM007-EMB-05': F({ fiebre: true }, { embarazada: true }),
  'NOM007-EMB-06': F({ palidez_intensa: true }, { embarazada: true }),
  'IMSS-EMB-02': F({ movimientos_fetales_disminuidos: true }, { embarazada: true, semanas_embarazo: 32 }),
  'IMSS-EMB-03': F({ contracciones: true }, { embarazada: true, semanas_embarazo: 33 }),
  'WHO-PCPNC-EMB-01': F({ vomita_todo: true }, { embarazada: true }),
  'WHO-PCPNC-EMB-02': F({ hinchazon_cara_manos: true }, { embarazada: true }),
  'IMSS-EMB-04': F({ ardor_orinar: true }, { embarazada: true }),
  'WHO-PCPNC-PP-01': F({ posparto: true, dolor_pantorrilla: true }, { edad_meses: years(28) }),
  'WHO-PCPNC-PP-02': F({ posparto: true, fiebre: true, debilidad_general: true }),
  'WHO-PCPNC-PP-03': F({ posparto: true, flujo_mal_olor: true }),
  'PAHO-DEN-01': F({ fiebre: true, sangrado_mucosas: true }, { edad_meses: years(25) }),
  'PAHO-DEN-02': F({ fiebre: true, heces_negras: true }, { edad_meses: years(25) }),
  'PAHO-DEN-03': F({ fiebre: true, dolor_detras_ojos: true, dolor_muscular_articular: true }, { edad_meses: years(25) }),
  'PAHO-DEN-04': F({ fiebre: true, dolor_cabeza: true, sarpullido: true }, { embarazada: true }),
  'IITT-R-RESP-01': F({ dificultad_respirar: true }, { edad_meses: years(30) }),
  'CDC-STROKE-01': F({ cara_caida: true }, { edad_meses: years(65) }),
  'CDC-HEART-01': F({ dolor_pecho: true }, { edad_meses: years(50) }),
  'IITT-R-SNAKE-01': F({ mordedura_serpiente: true }),
  'IITT-R-POISON-01': F({ intoxicacion: true }),
  'IITT-R-TRAUMA-01': F({ trauma_grave: true }),
  'IITT-R-SHOCK-01': F({ manos_pies_frios: true }, { edad_meses: 48 }),
  'IITT-Y-BITE-01': F({ mordedura_animal: true }, { edad_meses: years(9) }),
  'IITT-Y-TRAUMA-01': F({ fractura: true }, { edad_meses: years(9) }),
  'IITT-Y-BLEED-01': F({ sangrado: true }, { edad_meses: years(30) }),
  'IITT-Y-FAINT-01': F({ desmayo: true }, { edad_meses: years(25) }),
  'IITT-Y-WEAK-01': F({ debilidad_general: true }, { edad_meses: years(70) }),
  'IITT-Y-PAIN-01': F({ dolor_intenso: true }, { edad_meses: years(30) }),
  'IITT-Y-URINE-01': F({ no_puede_orinar: true }, { edad_meses: years(70) }),
  'IITT-VS-01': F({}, { edad_meses: years(30), resp_por_min: 34 }),
  // Reglas agregadas tras el fact-check (oct-2026)
  'NOM007-RN-02': F({ dificultad_respirar: true }, { edad_meses: days(20) }),
  'IITT-R-YI-TEMP-01': F({}, { edad_meses: days(20), temperatura_c: 35.8 }),
  'IITT-R-NEONATE-01': F({ diarrea: true }, { edad_meses: days(5) }),
  'IITT-Y-YI-01': F({ escurrimiento_nasal: true }, { edad_meses: 1 }),
  'NOM031-IRA-03': F({ tos: true, lejos_unidad: true }, { edad_meses: 24, resp_por_min: 44 }),
  'NICE-RESP-01': F({ quejido: true }, { edad_meses: 18 }),
  'NICE-RESP-02': F({ aleteo_nasal: true }, { edad_meses: 18 }),
  'IITT-VS-PED-01': F({ tos: true }, { edad_meses: years(7), resp_por_min: 45 }),
  'WHO-PCPNC-PP-04': F({ posparto: true, depresion_grave: true }),
  'NOM007-EMB-07': F({ dolor_epigastrio: true }, { embarazada: true, semanas_embarazo: 30 }),
  'NOM007-EMB-08': F({ desmayo: true }, { embarazada: true, semanas_embarazo: 20 }),
  'IITT-R-PREG-TRAUMA-01': F({ golpe_caida: true }, { embarazada: true, semanas_embarazo: 32 }),
  'PAHO-DEN-05': F({ fiebre: true, dolor_cabeza: true, dolor_muscular_articular: true, oliguria: true }, { edad_meses: years(25) }),
  'NICE-FEV-RASH-01': F({ fiebre: true, petequias: true }, { edad_meses: 36 }),
  'IITT-Y-YI-DIAR-01': F({ diarrea: true }, { edad_meses: 1 }),
  'IITT-VS-02': F({}, { edad_meses: years(40), resp_por_min: 8 }),
  'IITT-R-ABD-01': F({ dolor_abdominal_intenso: true }, { edad_meses: years(60) }),
  'IITT-R-SHOCK-02': F({ manos_pies_frios: true, sudor_frio: true }, { edad_meses: years(45) }),
  'IITT-Y-VISION-01': F({ vision_borrosa: true }, { edad_meses: years(50) }),
  'MHGAP-SUI-01': F({ ideas_suicidas: true }, { edad_meses: years(30) }),
};

const FINDINGS_FIELDS = new Set(['edad_meses', 'sexo', 'embarazada', 'semanas_embarazo', 'duracion_dias', 'temperatura_c', 'resp_por_min']);

describe('integridad del catálogo de reglas', () => {
  it('ids únicos', () => {
    const all = ALL_RULES.map((r) => r.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it('cada regla tiene fuente, URL https, explicación y acción en español, nah vacío', () => {
    for (const r of [...ALL_RULES, NO_DANGER_RULE]) {
      expect(r.fuente.length, r.id).toBeGreaterThan(10);
      expect(r.fuente_url, r.id).toMatch(/^https:\/\//);
      expect(r.explicacion.es.length, r.id).toBeGreaterThan(5);
      expect(r.accion.es.length, r.id).toBeGreaterThan(5);
      expect(r.explicacion.nah, r.id).toBe('');
      expect(r.accion.nah, r.id).toBe('');
    }
  });

  it('las acciones no contienen dosis de medicamentos', () => {
    for (const r of ALL_RULES) expect(r.accion.es, r.id).not.toMatch(/\d+\s*(mg|ml|mcg|UI|gotas)\b/i);
  });

  it('needs/context solo usan síntomas del catálogo o campos de Findings', () => {
    for (const r of ALL_RULES) {
      for (const n of [...(r.needs ?? []), ...(r.context ?? [])]) {
        expect(isSymptomKey(n) || FINDINGS_FIELDS.has(n), `${r.id} → ${n}`).toBe(true);
      }
    }
  });

  it('cada síntoma del catálogo tiene etiqueta, sinónimos y pregunta; nah sin inventar', () => {
    for (const [k, v] of Object.entries(SYMPTOMS)) {
      expect(v.es.length, k).toBeGreaterThan(2);
      expect(v.synonyms.length, k).toBeGreaterThan(0);
      expect((v as { nah?: string }).nah, k).toBeUndefined();
      expect(PREGUNTAS[k], k).toBeTruthy();
    }
    for (const n of NUMERIC_FIELDS) expect(PREGUNTAS[n]).toBeTruthy();
  });

  it('cantidad razonable de reglas y síntomas', () => {
    expect(ALL_RULES.length).toBeGreaterThanOrEqual(35);
    expect(Object.keys(SYMPTOMS).length).toBeGreaterThanOrEqual(50);
  });
});

describe('cada regla dispara con su caso positivo', () => {
  it('todas las reglas tienen caso de prueba', () => {
    const missing = ALL_RULES.map((r) => r.id).filter((id) => !(id in POSITIVE));
    expect(missing).toEqual([]);
  });

  for (const r of ALL_RULES) {
    it(`${r.id} (${r.level})`, () => {
      const f = POSITIVE[r.id];
      expect(f, `falta caso para ${r.id}`).toBeDefined();
      expect(ids(f)).toContain(r.id);
      const res = triage(f);
      expect(LEVEL_RANK[res.level]).toBeGreaterThanOrEqual(LEVEL_RANK[r.level]);
      expect(res.fired.map((x) => x.id)).toContain(r.id);
    });
  }
});

describe('datos desconocidos nunca disparan (undefined ≠ false ≠ true)', () => {
  it('hallazgos vacíos → aquí con la regla por defecto', () => {
    const res = triage(F({}));
    expect(res.level).toBe('aqui');
    expect(res.fired.map((x) => x.id)).toEqual(['IMCI-NOSIGNS-01']);
    expect(res.escalated_by_model).toBe(false);
  });

  it('sintomas ausente o con valores false/undefined no dispara nada', () => {
    const allFalse = Object.fromEntries(Object.keys(SYMPTOMS).map((k) => [k, false]));
    expect(ids(F(allFalse, { edad_meses: 24 }))).toEqual([]);
    expect(ids({ sintomas: { tiraje: undefined as unknown as boolean } })).toEqual([]);
    expect(triage({} as Findings).level).toBe('aqui');
  });

  it('embarazada undefined no activa reglas obstétricas', () => {
    expect(ids(F({ sangrado_vaginal: true }))).not.toContain('NOM007-EMB-01');
    expect(ids(F({ dolor_abdominal: true }, { embarazada: false }))).not.toContain('NOM007-EMB-04');
  });

  it('reglas del lactante <2 meses exigen edad conocida', () => {
    expect(ids(F({ fiebre: true }))).not.toContain('IMCI-YI-04');
    expect(ids(F({ fiebre: true }, { edad_meses: 1.99 }))).toContain('IMCI-YI-04');
    expect(ids(F({ fiebre: true }, { edad_meses: 2 }))).not.toContain('IMCI-YI-04');
  });

  it('edad desconocida puede subir (signo de peligro pediátrico aplica), nunca bajar', () => {
    expect(triage(F({ tiraje: true })).level).toBe('urgencia');
    expect(triage(F({ vomita_todo: true })).level).toBe('urgencia');
  });
});

describe('umbrales de edad y respiración (AIEPI)', () => {
  const resp = (edad: number, rpm: number) => ids(F({ tos: true }, { edad_meses: edad, resp_por_min: rpm }));
  it('2–11 meses: 50/min', () => {
    expect(resp(2, 49)).not.toContain('IMCI-RESP-01');
    expect(resp(2, 50)).toContain('IMCI-RESP-01');
    expect(resp(11.9, 50)).toContain('IMCI-RESP-01');
    expect(resp(11.9, 45)).toEqual([]);
  });
  it('12–59 meses: 40/min', () => {
    expect(resp(12, 39)).toEqual([]);
    expect(resp(12, 40)).toContain('IMCI-RESP-02');
    expect(resp(59, 40)).toContain('IMCI-RESP-02');
    expect(resp(60, 45)).not.toContain('IMCI-RESP-02');
  });
  it('<2 meses: 60/min; <7 días urgencia, 7–59 días centro hoy', () => {
    expect(triage(F({}, { edad_meses: days(3), resp_por_min: 59 })).level).toBe('aqui');
    expect(triage(F({}, { edad_meses: days(3), resp_por_min: 60 })).level).toBe('urgencia');
    // 7–59 días: IMCI 2019 = neumonía ambulatoria (IMCI-YI-03), pero la NOM-031 (3.32, 8.2.5.3) manda al hospital
    // a la neumonía leve del menor de 2 meses (factor de mal pronóstico) → urgencia por NOM031-IRA-03.
    const r = triage(F({}, { edad_meses: days(8), resp_por_min: 60 }));
    expect(r.level).toBe('urgencia');
    expect(r.fired.map((x) => x.id)).toEqual(expect.arrayContaining(['NOM031-IRA-03', 'IMCI-YI-03']));
  });
  it('respiración rápida referida sin contar → centro hoy; contada normal → ya no aplica', () => {
    expect(triage(F({ tos: true, respira_rapido: true }, { edad_meses: 24 })).level).toBe('centro_hoy');
    expect(ids(F({ tos: true, respira_rapido: true }, { edad_meses: 24, resp_por_min: 30 }))).toEqual([]);
  });
  it('temperatura del lactante: 37.5 sí, 37.4 no; <35.5 hipotermia', () => {
    expect(ids(F({}, { edad_meses: 1, temperatura_c: 37.5 }))).toContain('IMCI-YI-04');
    expect(ids(F({}, { edad_meses: 1, temperatura_c: 37.4 }))).not.toContain('IMCI-YI-04');
    expect(ids(F({}, { edad_meses: 1, temperatura_c: 35.5 }))).not.toContain('IMCI-YI-05');
  });
  it('movimientos fetales: antes de 28 semanas no dispara; semanas desconocidas sí (conservador)', () => {
    expect(ids(F({ movimientos_fetales_disminuidos: true }, { embarazada: true, semanas_embarazo: 20 }))).not.toContain('IMSS-EMB-02');
    expect(ids(F({ movimientos_fetales_disminuidos: true }, { embarazada: true }))).toContain('IMSS-EMB-02');
  });
  it('diarrea y fiebre por duración', () => {
    expect(ids(F({ diarrea: true }, { edad_meses: 24, duracion_dias: 13 }))).not.toContain('IMCI-DIAR-03');
    expect(ids(F({ fiebre: true }, { edad_meses: 24, duracion_dias: 6 }))).not.toContain('IMCI-FEV-02');
  });
  it('deshidratación: un solo signo no basta', () => {
    expect(triage(F({ diarrea: true, ojos_hundidos: true }, { edad_meses: 18 })).level).toBe('aqui');
  });
});

describe('asimetría de seguridad con el modelo', () => {
  it('el modelo puede subir el nivel y queda marcado', () => {
    const res = triage(F({ tos: true }, { edad_meses: 24, resp_por_min: 30 }), 'urgencia');
    expect(res.level).toBe('urgencia');
    expect(res.escalated_by_model).toBe(true);
    expect(res.model_level).toBe('urgencia');
    expect(res.fired[0].id).toBe(MODEL_ESCALATION_ID);
    expect(res.fired.map((x) => x.id)).not.toContain('IMCI-NOSIGNS-01');
  });

  it('el modelo NUNCA baja el nivel', () => {
    const res = triage(POSITIVE['IMCI-RESP-03'], 'aqui');
    expect(res.level).toBe('urgencia');
    expect(res.escalated_by_model).toBe(false);
  });

  it('para todo caso y toda pista: nivel final = max(reglas, modelo)', () => {
    const hints: (TriageLevel | undefined)[] = [undefined, 'aqui', 'centro_hoy', 'urgencia'];
    for (const f of Object.values(POSITIVE)) {
      const base = triage(f).level;
      for (const h of hints) {
        const res = triage(f, h);
        const expected = h && LEVEL_RANK[h] > LEVEL_RANK[base] ? h : base;
        expect(res.level).toBe(expected);
        expect(res.escalated_by_model).toBe(Boolean(h && LEVEL_RANK[h] > LEVEL_RANK[base]));
      }
    }
  });

  it('pista inválida se ignora', () => {
    expect(triage(F({}), 'grave' as TriageLevel).level).toBe('aqui');
  });

  it('las reglas disparadas van ordenadas de mayor a menor gravedad', () => {
    const res = triage(F({ tos: true, tiraje: true, sibilancias: true }, { edad_meses: 24, resp_por_min: 50 }));
    const ranks = res.fired.map((x) => LEVEL_RANK[x.level]);
    expect([...ranks].sort((a, b) => b - a)).toEqual(ranks);
  });
});

describe('preguntas de seguimiento', () => {
  it('niño <5 con tos sin contar respiraciones → primero contar respiraciones', () => {
    const q = triage(F({ tos: true }, { edad_meses: 24 })).preguntas;
    expect(q.length).toBeGreaterThan(0);
    expect(q.length).toBeLessThanOrEqual(2);
    expect(q[0]).toMatchObject({ campo: 'resp_por_min', tipo: 'contar_respiraciones' });
    expect(q.map((x) => x.campo)).toContain('tiraje');
  });

  it('responder la pregunta cambia el resultado', () => {
    expect(triage(F({ tos: true }, { edad_meses: 24 })).level).toBe('aqui');
    expect(triage(F({ tos: true }, { edad_meses: 24, resp_por_min: 45 })).level).toBe('centro_hoy');
    expect(triage(F({ tos: true, tiraje: true }, { edad_meses: 24 })).level).toBe('urgencia');
  });

  it('fiebre sin edad → pregunta la edad (puede ser lactante <2 meses)', () => {
    const q = triage(F({ fiebre: true })).preguntas;
    expect(q[0]).toMatchObject({ campo: 'edad_meses', tipo: 'numero' });
  });

  it('nunca más de 2 preguntas y sin campos repetidos', () => {
    for (const f of [F({ fiebre: true }), F({ tos: true }), F({ diarrea: true }), F({}, { embarazada: true })]) {
      const q = triage(f).preguntas;
      expect(q.length).toBeLessThanOrEqual(2);
      expect(new Set(q.map((x) => x.campo)).size).toBe(q.length);
    }
  });

  it('sin preguntas cuando ya es urgencia (nada puede subirlo)', () => {
    expect(triage(POSITIVE['GEN-CONV-01']).preguntas).toEqual([]);
  });

  it('solo pregunta lo que puede subir el nivel actual', () => {
    const res = triage(F({ tos: true }, { edad_meses: 24, resp_por_min: 45 }));
    expect(res.level).toBe('centro_hoy');
    for (const q of res.preguntas) expect(q.campo).not.toBe('resp_por_min');
  });

  it('no pregunta embarazo a un niño varón', () => {
    const q = followUpQuestions(F({ dolor_abdominal: true }, { edad_meses: 36, sexo: 'M' }), 'aqui');
    expect(q.map((x) => x.campo)).not.toContain('embarazada');
  });

  it('embarazada sin síntomas → pregunta signos de alarma obstétrica', () => {
    const q = triage(F({}, { embarazada: true, edad_meses: years(24) })).preguntas;
    expect(q.length).toBe(2);
    expect(q.every((x) => x.tipo === 'si_no')).toBe(true);
  });

  it('cada pregunta trae texto y la regla que la motiva', () => {
    const q = triage(F({ diarrea: true, ojos_hundidos: true }, { edad_meses: 18 })).preguntas;
    expect(q.length).toBeGreaterThan(0);
    for (const x of q) {
      expect(x.pregunta.es.length).toBeGreaterThan(5);
      expect(x.pregunta.nah).toBe('');
      expect(x.porque).toMatch(/^[A-Z0-9-]+: /);
    }
  });
});

describe('casos del guion de demo', () => {
  it('niña de 1 año con calentura, respira muy rápido y se le hunde el pecho → urgencia por tiraje', () => {
    const res = triage(F({ fiebre: true, respira_rapido: true, tiraje: true }, { edad_meses: 12, sexo: 'F' }));
    expect(res.level).toBe('urgencia');
    expect(res.fired[0].level).toBe('urgencia');
    expect(res.fired.map((x) => x.id)).toContain('IMCI-RESP-03');
  });

  it('niño de 3 años con mocos y tos leve, respiración normal → atender aquí', () => {
    const res = triage(F({ tos: true, escurrimiento_nasal: true, tiraje: false, estridor: false }, { edad_meses: 36, resp_por_min: 28 }));
    expect(res.level).toBe('aqui');
  });

  it('adulto mayor con boca chueca → urgencia', () => {
    expect(triage(F({ cara_caida: true, dificultad_hablar: true }, { edad_meses: years(72) })).level).toBe('urgencia');
  });
});

describe('classifySyndrome', () => {
  it.each([
    [F({ diarrea: true, sangre_heces: true }), 'diarrea_sangre'],
    [F({ fiebre: true, sangrado_mucosas: true }), 'febril_hemorragico'],
    [F({ sangrado_vaginal: true }, { embarazada: true }), 'obstetrico'],
    [F({ mordedura_serpiente: true }), 'trauma'],
    [F({ dolor_pecho: true }), 'cardiovascular'],
    [F({ convulsiones: true }), 'neurologico'],
    [F({ tos: true, fiebre: true }), 'respiratorio'],
    [F({ diarrea: true, fiebre: true }), 'diarreico'],
    [F({ fiebre: true }), 'febril'],
    [F({}, { temperatura_c: 38.2 }), 'febril'],
    [F({}), 'otro'],
  ] as [Findings, string][])('%#', (f, expected) => {
    expect(classifySyndrome(f)).toBe(expected);
  });
});

describe('regresiones del fact-check clínico (oct-2026)', () => {
  const lvl = (f: Findings) => triage(f).level;

  it('lactante <2 meses: vómito todo / palidez intensa ya no salen "aquí"', () => {
    expect(lvl(F({ vomita_todo: true }, { edad_meses: days(40) }))).not.toBe('aqui');
    expect(ids(F({ palidez_intensa: true }, { edad_meses: 1.5 }))).toContain('IITT-Y-CIRC-01');
  });

  it('lactante <2 meses con dificultad respiratoria → urgencia', () => {
    expect(lvl(F({ dificultad_respirar: true }, { edad_meses: days(20) }))).toBe('urgencia');
  });

  it('lactante <2 meses: cualquier molestia → al menos centro hoy; <8 días → urgencia', () => {
    expect(lvl(F({ diarrea: true }, { edad_meses: days(20) }))).toBe('centro_hoy');
    expect(lvl(F({ diarrea: true }, { edad_meses: days(5) }))).toBe('urgencia');
    expect(lvl(F({}, { edad_meses: days(20), temperatura_c: 35.8 }))).toBe('urgencia');
    // Sin molestias (consulta de niño sano) no se fuerza el piso.
    expect(lvl(F({}, { edad_meses: days(20) }))).toBe('aqui');
    // El piso no aplica a la mamá en el posparto.
    expect(ids(F({ posparto: true, fiebre: true }, { edad_meses: 0 }))).not.toContain('IITT-Y-YI-01');
  });

  it('bebé sin fuerza (<2 meses) → urgencia', () => {
    expect(lvl(F({ debilidad_general: true }, { edad_meses: days(20) }))).toBe('urgencia');
  });

  it('recién nacido que no moja el pañal → centro hoy (NOM-007 5.6.1.9)', () => {
    expect(ids(F({ no_orina_no_evacua: true }, { edad_meses: days(10) }))).toContain('NOM007-RN-01');
  });

  it('NOM-031 Plan C: respiración rápida + factor de mal pronóstico → urgencia; sin factor → centro hoy', () => {
    expect(lvl(F({ tos: true }, { edad_meses: 24, resp_por_min: 44 }))).toBe('centro_hoy');
    expect(lvl(F({ tos: true, lejos_unidad: true }, { edad_meses: 24, resp_por_min: 44 }))).toBe('urgencia');
    expect(lvl(F({ tos: true, desnutricion: true }, { edad_meses: 8, resp_por_min: 52 }))).toBe('urgencia');
    expect(lvl(F({ tos: true, bajo_peso_nacer: true }, { edad_meses: 8, resp_por_min: 52 }))).toBe('urgencia');
    expect(lvl(F({ tos: true, bajo_peso_nacer: true }, { edad_meses: 24, resp_por_min: 44 }))).toBe('centro_hoy');
  });

  it('niño con respiración rápida contada → pregunta si puede llegar hoy a la unidad', () => {
    const q = triage(F({ tos: true }, { edad_meses: 24, resp_por_min: 44 })).preguntas.map((x) => x.campo);
    expect(q).toContain('lejos_unidad');
  });

  it('5–11 años: signos vitales y respiración rápida referida ya no salen "aquí"', () => {
    expect(lvl(F({ tos: true }, { edad_meses: years(7), resp_por_min: 45 }))).toBe('centro_hoy');
    expect(lvl(F({ respira_rapido: true }, { edad_meses: years(7) }))).toBe('centro_hoy');
    expect(lvl(F({}, { edad_meses: years(7), temperatura_c: 39.6 }))).toBe('centro_hoy');
  });

  it('dificultad para respirar: <5 centro hoy (AIEPI), ≥5 urgencia (IITT)', () => {
    expect(lvl(F({ dificultad_respirar: true }, { edad_meses: 36 }))).toBe('centro_hoy');
    expect(lvl(F({ dificultad_respirar: true }, { edad_meses: years(8) }))).toBe('urgencia');
  });

  it('fiebre + petequias → urgencia a cualquier edad', () => {
    expect(lvl(F({ fiebre: true, petequias: true }, { edad_meses: 36 }))).toBe('urgencia');
  });

  it('ojo nublado solo → urgencia; llagas extensas con sarampión reciente → urgencia', () => {
    expect(lvl(F({ ojo_nublado: true }, { edad_meses: 30 }))).toBe('urgencia');
    expect(lvl(F({ ulceras_boca_extensas: true, sarampion_reciente: true }, { edad_meses: 30 }))).toBe('urgencia');
  });

  it('sarampión: bolitas en el cuello cuentan como criterio (caso probable SSA/IMSS)', () => {
    expect(ids(F({ fiebre: true, sarpullido: true, adenomegalias: true }, { edad_meses: years(20) }))).toContain('IMCI-MEAS-01');
  });

  it('quejido → urgencia; aleteo nasal → centro hoy (<5 años)', () => {
    expect(lvl(F({ quejido: true }, { edad_meses: 18 }))).toBe('urgencia');
    expect(lvl(F({ aleteo_nasal: true }, { edad_meses: 18 }))).toBe('centro_hoy');
  });

  it('adulto con diarrea y deshidratación ya no sale "aquí" (OMS 2005 tabla 1)', () => {
    expect(lvl(F({ diarrea: true, ojos_hundidos: true, bebe_mal: true, pliegue_muy_lento: true }, { edad_meses: years(70) }))).toBe('urgencia');
    expect(lvl(F({ diarrea: true, ojos_hundidos: true, boca_seca: true, bebe_con_avidez: true }, { edad_meses: years(30) }))).toBe('centro_hoy');
    // Adulto sin diarrea ni vómito: los signos de deshidratación solos no disparan IMCI-DIAR-01.
    expect(ids(F({ ojos_hundidos: true, bebe_mal: true }, { edad_meses: years(30) }))).not.toContain('IMCI-DIAR-01');
    expect(lvl(F({ diarrea: true }, { edad_meses: years(30) }))).toBe('aqui');
  });

  it('diarrea persistente (≥14 días) a cualquier edad → centro hoy', () => {
    expect(lvl(F({ diarrea: true }, { edad_meses: years(8), duracion_dias: 15 }))).toBe('centro_hoy');
  });

  it('diarrea sin deshidratación en "aquí" → acción de Plan A con Vida Suero Oral', () => {
    const r = triage(F({ diarrea: true }, { edad_meses: 24 }));
    expect(r.level).toBe('aqui');
    expect(r.fired[0].id).toBe('IMCI-NOSIGNS-01');
    expect(r.fired[0].accion.es).toMatch(/Vida Suero Oral/);
    expect(r.fired[0].accion.es).not.toMatch(/\d+\s*(mg|ml|mcg|UI|gotas)\b/i);
    expect(triage(F({ tos: true }, { edad_meses: 24 })).fired[0].accion.es).not.toMatch(/Plan A/);
  });

  it('embarazo: epigastralgia, desmayo y golpe → urgencia', () => {
    expect(lvl(F({ dolor_epigastrio: true }, { embarazada: true }))).toBe('urgencia');
    expect(lvl(F({ desmayo: true }, { embarazada: true }))).toBe('urgencia');
    expect(lvl(F({ golpe_caida: true }, { embarazada: true }))).toBe('urgencia');
    expect(ids(F({ golpe_caida: true }, { edad_meses: years(16), sexo: 'M' }))).toEqual([]);
  });

  it('posparto: sangrado que aumenta → urgencia; hinchazón → centro hoy; depresión → centro hoy; ideas suicidas → urgencia', () => {
    expect(lvl(F({ posparto: true, sangrado_aumenta: true }))).toBe('urgencia');
    expect(lvl(F({ posparto: true, hinchazon_cara_manos: true }))).toBe('centro_hoy');
    expect(lvl(F({ posparto: true, depresion_grave: true }))).toBe('centro_hoy');
    expect(lvl(F({ posparto: true, ideas_suicidas: true }))).toBe('urgencia');
  });

  it('dengue: signos de alarma a la caída de la fiebre (fiebre reciente) → urgencia', () => {
    expect(lvl(F({ fiebre_reciente: true, sangrado_mucosas: true, mareo_al_pararse: true }, { edad_meses: years(40) }))).toBe('urgencia');
    // Sin fiebre ni fiebre reciente: sangrado de encías/nariz → centro hoy (IITT "ongoing bleeding"), no dengue.
    const r = triage(F({ sangrado_mucosas: true }, { edad_meses: years(40) }));
    expect(r.level).toBe('centro_hoy');
    expect(r.preguntas.map((x) => x.campo)).toEqual(expect.arrayContaining(['fiebre']));
  });

  it('adulto >50 con dolor de panza fuerte → urgencia; 30 años → centro hoy', () => {
    expect(lvl(F({ dolor_abdominal_intenso: true }, { edad_meses: years(60) }))).toBe('urgencia');
    expect(lvl(F({ dolor_abdominal_intenso: true }, { edad_meses: years(30) }))).toBe('centro_hoy');
  });

  it('pérdida súbita de la vista → urgencia (CDC); visión borrosa → centro hoy (IITT)', () => {
    expect(lvl(F({ perdida_vision_subita: true }, { edad_meses: years(50) }))).toBe('urgencia');
    expect(lvl(F({ vision_borrosa: true }, { edad_meses: years(50), sexo: 'M' }))).toBe('centro_hoy');
  });

  it('choque en adulto: manos frías solas no bastan; con sudor frío o llenado capilar lento → urgencia', () => {
    expect(ids(F({ manos_pies_frios: true }, { edad_meses: years(40) }))).not.toContain('IITT-R-SHOCK-02');
    expect(lvl(F({ manos_pies_frios: true, sudor_frio: true }, { edad_meses: years(40) }))).toBe('urgencia');
    expect(lvl(F({ llenado_capilar_lento: true }, { edad_meses: years(40) }))).toBe('urgencia');
  });

  it('respiraciones <10 → urgencia; >30 en adulto → centro hoy', () => {
    expect(lvl(F({}, { edad_meses: years(40), resp_por_min: 8 }))).toBe('urgencia');
    expect(lvl(F({}, { edad_meses: years(40), resp_por_min: 34 }))).toBe('centro_hoy');
  });

  it('IMCI-RESP-02 con edad desconocida no afirma "1 a 4 años" como hecho', () => {
    expect(RULE_TEXT('IMCI-RESP-02')).toMatch(/edad aún no confirmada/);
  });
});

function RULE_TEXT(id: string): string {
  return ALL_RULES.find((r) => r.id === id)?.explicacion.es ?? '';
}
