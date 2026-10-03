import { describe, expect, it } from 'vitest';
import type { ExtractionResult, Findings } from '../types';
import { keywordExtract } from '../ai/keywords';
import { triage } from './engine';
import { assessUncertainty, looksGarbled, MAX_FOLLOWUP_QUESTIONS, RED_FLAG_KEYS, resultDependsOnAge, type AnsweredQuestion } from './uncertainty';

function run(text: string, opts: { answered?: AnsweredQuestion[]; extraction?: Partial<ExtractionResult>; findings?: Findings } = {}) {
  const f = opts.findings ?? keywordExtract(text);
  const extraction: ExtractionResult = { findings: f, method: 'keywords', latency_ms: 0, ...opts.extraction };
  const triageResult = triage(f, extraction.model_level_hint);
  const answered = opts.answered ?? triageResult.preguntas.map((q) => ({ campo: q.campo, known: true }));
  return { triageResult, u: assessUncertainty({ transcript: text, extraction, triageResult, answeredQuestions: answered, findings: f }) };
}

describe('assessUncertainty', () => {
  it('un relato claro y completo NO es incierto', () => {
    const { u } = run('Niño de 4 años con tos y mocos desde hace dos días, come y juega bien.');
    expect(u.uncertain).toBe(false);
    expect(u.reasons).toEqual([]);
  });

  it('solo edad y duración, sin síntoma reconocido, también es incierto', () => {
    const { u, triageResult } = run('Niño de 4 años, le sale algo raro del oído desde hace 3 días.');
    expect(triageResult.level).toBe('aqui');
    expect(u.codes).toContain('no_findings');
  });

  it('texto sin ningún síntoma reconocido es incierto (no adivina "atender aquí" en silencio)', () => {
    const { u, triageResult } = run('La señora vino porque su hijo anda raro desde la fiesta del pueblo, quién sabe qué será.');
    expect(u.codes).toContain('no_findings');
    expect(u.uncertain).toBe(true);
    expect(triageResult.level).toBe('aqui'); // el nivel no se toca
  });

  it('transcripción muy corta es incierta', () => {
    const { u } = run('tos');
    expect(u.codes).toContain('short_transcript');
  });

  it('alucinación / bucle de Whisper se detecta como texto mal entendido', () => {
    expect(looksGarbled('Subtítulos realizados por la comunidad de Amara.org')).toBe(true);
    expect(looksGarbled('la la la la la la la la')).toBe(true);
    expect(looksGarbled('?? ... 123 456 ## !!')).toBe(true);
    expect(looksGarbled('Niña de 1 año con calentura desde ayer y respira rápido.')).toBe(false);
  });

  it('sin edad y con un resultado que depende de la edad: incierto', () => {
    const f = keywordExtract('Tiene calentura desde ayer y no quiere comer.');
    expect(f.edad_meses).toBeUndefined();
    expect(resultDependsOnAge(f)).toBe(true);
    const { u } = run('Tiene calentura desde ayer y no quiere comer.', { answered: [] });
    expect(u.codes).toContain('age_missing');
  });

  it('con la edad dicha, la edad no es motivo', () => {
    const { u } = run('Niño de 6 años con tos y mocos desde hace dos días, come y juega bien.');
    expect(u.codes).not.toContain('age_missing');
  });

  it('responder "No sé" a una pregunta de seguimiento hace el caso incierto y lo explica', () => {
    const text = 'Niño de 3 años con tos desde hace tres días.';
    const { u } = run(text, { answered: [{ campo: 'tiraje', known: false, pregunta: '¿Se le hunde el pecho?' }] });
    expect(u.codes).toContain('answered_unknown');
    expect(u.reasons.join(' ')).toContain('¿Se le hunde el pecho?');
  });

  it('preguntas que podían subir el nivel y se saltaron: incierto', () => {
    const text = 'Niño de 3 años con tos desde hace tres días.';
    const { triageResult, u } = run(text, { answered: [] });
    expect(triageResult.preguntas.length).toBeGreaterThan(0);
    expect(u.codes).toContain('questions_pending');
  });

  it('desacuerdo LLM vs palabras clave en un signo de alarma: incierto', () => {
    const text = 'Niño de 2 años con tos desde ayer, come bien.';
    const kw = keywordExtract(text);
    const llmFindings: Partial<Findings> = { sintomas: { tos: true, convulsiones: true } };
    expect(RED_FLAG_KEYS.has('convulsiones')).toBe(true);
    const { u } = run(text, {
      extraction: { method: 'llm+keywords', raw: JSON.stringify({ findings: llmFindings }) },
      findings: { ...kw, sintomas: { ...kw.sintomas, convulsiones: true } },
    });
    expect(u.codes).toContain('llm_disagree');
  });

  it('sin LLM no hay desacuerdo posible', () => {
    const { u } = run('Niño de 2 años con tos desde ayer, come bien.');
    expect(u.codes).not.toContain('llm_disagree');
  });

  it('nivel sugerido por el LLM distinto al de las palabras clave: incierto', () => {
    const text = 'Niño de 2 años con tos desde ayer, come bien.';
    const { u } = run(text, { extraction: { method: 'llm+keywords', model_level_hint: 'urgencia', raw: JSON.stringify({ findings: { sintomas: { tos: true } } }) } });
    expect(u.codes).toContain('llm_disagree');
  });

  it('bebé de menos de 2 meses con pocos datos: incierto', () => {
    const { u } = run('Bebé de tres semanas de nacido, la mamá dice que está chillón.', { answered: [] });
    expect(u.codes).toContain('young_infant_few');
  });

  it('embarazo con pocos datos: incierto', () => {
    const f: Findings = { edad_meses: 300, sexo: 'F', embarazada: true, sintomas: {} };
    const { u } = run('[botones] ', { findings: f });
    expect(u.codes).toContain('pregnancy_few');
  });

  it('urgencia con datos completos no se marca incierta; urgencia con texto dudoso sí, sin bajar el nivel', () => {
    const clear = run('Niña de 1 año, tiene calentura desde ayer, respira muy rápido, se le hunde el pecho y no puede tomar nada.');
    expect(clear.triageResult.level).toBe('urgencia');
    expect(clear.u.uncertain).toBe(false);
    // Embarazo con un solo signo que ya es urgencia: no hay nivel más alto, no se agrega ruido.
    const preg = run('Señora embarazada de 7 meses, ve lucecitas.');
    expect(preg.triageResult.level).toBe('urgencia');
    expect(preg.u.codes).not.toContain('pregnancy_few');
    // Pero "No sé" a una pregunta sí se avisa aunque ya sea urgencia.
    const unk = run('Señora embarazada de 7 meses, ve lucecitas.', { answered: [{ campo: 'sangrado_vaginal', known: false, pregunta: '¿Tiene sangrado?' }] });
    expect(unk.triageResult.level).toBe('urgencia');
    expect(unk.u.uncertain).toBe(true);
  });

  it('si ya contestó el máximo de preguntas, las que el motor aún podría hacer no cuentan como pendientes', () => {
    const text = 'Niño de 3 años con diarrea desde hace 15 días.';
    const four = ['no_puede_beber', 'letargico', 'ojos_hundidos', 'pliegue_muy_lento'].map((campo) => ({ campo, known: true }));
    expect(four).toHaveLength(MAX_FOLLOWUP_QUESTIONS);
    const f = { ...keywordExtract(text) };
    f.sintomas = { ...f.sintomas, no_puede_beber: false, letargico: false, ojos_hundidos: false, pliegue_muy_lento: false };
    const { u, triageResult } = run(text, { findings: f, answered: four });
    expect(triageResult.preguntas.length).toBeGreaterThan(0); // el motor tendría otra pregunta
    expect(u.codes).not.toContain('questions_pending');
  });

  it('"Saltar" se registra como pendiente, no como "No sé"', () => {
    const text = 'Niño de 3 años con diarrea desde hace 15 días.';
    const { u } = run(text, { answered: [{ campo: 'no_puede_beber', known: false, skipped: true, pregunta: '¿Puede beber?' }] });
    expect(u.codes).toContain('questions_pending');
    expect(u.codes).not.toContain('answered_unknown');
  });

  it('falta de edad solo cuenta si alguna edad SUBIRÍA el nivel', () => {
    // Puerperio: las edades de prueba son de mujer en edad reproductiva, no de recién nacido.
    const f = keywordExtract('La señora se alivió hace cinco días y tiene calentura y los pechos rojos y le duelen.');
    expect(f.edad_meses).toBeUndefined();
    expect(resultDependsOnAge(f)).toBe(false);
  });

  it('modo botones: no evalúa el texto (no hay transcripción)', () => {
    const f: Findings = { edad_meses: 48, sintomas: { tos: true, mocos: true } };
    const { u } = run('[botones] tos, mocos', { findings: f });
    expect(u.codes).not.toContain('short_transcript');
    expect(u.codes).not.toContain('no_findings');
  });

  it('es determinista y no lanza con entradas vacías', () => {
    const triageResult = triage({ sintomas: {} });
    const u = assessUncertainty({ transcript: '', extraction: null, triageResult });
    expect(u).toEqual(assessUncertainty({ transcript: '', extraction: null, triageResult }));
  });
});
