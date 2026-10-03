import { useEffect, useState } from 'react';
import type { Findings, FollowUpQuestion } from '../types';
import { useApp } from '../components/AppContext';
import { t } from '../i18n/strings';
import { BreathCounter } from '../components/BreathCounter';
import { Button, Card, TopBar } from '../components/ui';
import { go } from '../components/router';
import { MAX_FOLLOWUP_QUESTIONS as MAX_QUESTIONS } from '../triage/uncertainty';
const NUMERIC_TOP = new Set(['edad_meses', 'semanas_embarazo', 'duracion_dias', 'temperatura_c', 'resp_por_min']);
const BOOL_TOP = new Set(['embarazada']);

function applyAnswer(f: Findings, q: FollowUpQuestion, value: boolean | number | string | undefined): Findings {
  const next: Findings = { ...f, sintomas: { ...f.sintomas } };
  if (value === undefined) return next;
  const rec = next as unknown as Record<string, unknown>;
  if (q.campo === 'sexo') rec.sexo = value;
  else if (NUMERIC_TOP.has(q.campo) && typeof value === 'number') rec[q.campo] = value;
  else if (BOOL_TOP.has(q.campo) && typeof value === 'boolean') rec[q.campo] = value;
  else if (typeof value === 'boolean') next.sintomas[q.campo] = value;
  else if (typeof value === 'number') rec[q.campo] = value;
  return next;
}

export default function FollowUp() {
  const { lang, session, setSession, retriage } = useApp();
  const { result, findings, asked } = session;
  const pending = (result?.preguntas ?? []).filter((q) => !asked.includes(q.campo));
  const q = asked.length < MAX_QUESTIONS ? pending[0] : undefined;

  const [num, setNum] = useState('');
  const [unit, setUnit] = useState<'years' | 'months'>('years');
  const [manualBreaths, setManualBreaths] = useState(false);

  useEffect(() => {
    if (!result || !findings) go('capture', true);
    else if (!q) go('resultado', true);
  }, [result, findings, q]);

  useEffect(() => { setNum(''); setManualBreaths(false); }, [q?.campo]);

  if (!result || !findings || !q) return null;

  const answer = (value: boolean | number | string | undefined) => {
    const f = applyAnswer(findings, q, value);
    const r = retriage(f);
    const nextAsked = [...asked, q.campo];
    // "No sé" (undefined) queda registrado: alimenta el aviso "No estoy segura" del resultado.
    const answers = [...(session.answers ?? []).filter((a) => a.campo !== q.campo), { campo: q.campo, known: value !== undefined, pregunta: q.pregunta.es }];
    setSession({ ...session, findings: f, result: r, asked: nextAsked, answers });
    const remaining = r.preguntas.filter((x) => !nextAsked.includes(x.campo));
    if (!remaining.length || nextAsked.length >= MAX_QUESTIONS) go('resultado', true);
  };

  // "Saltar": queda registrado para que el resultado avise "No estoy segura" (preguntas sin responder).
  const skip = () => {
    const answers = [...(session.answers ?? []).filter((a) => a.campo !== q.campo), { campo: q.campo, known: false, skipped: true, pregunta: q.pregunta.es }];
    setSession({ ...session, answers });
    go('resultado', true);
  };

  const submitNumber = () => {
    const n = parseFloat(num.replace(',', '.'));
    if (!Number.isFinite(n)) return;
    answer(q.campo === 'edad_meses' && unit === 'years' ? Math.round(n * 12) : n);
  };

  const total = Math.min(MAX_QUESTIONS, asked.length + pending.length);
  const isBreath = q.tipo === 'contar_respiraciones' || (q.campo === 'resp_por_min' && q.tipo !== 'si_no');
  const pregunta = (lang === 'nah' && q.pregunta.nah) || q.pregunta.es;

  return (
    <div className="pb-10">
      <TopBar title={t('q_title', lang)} onBack={() => go('capture')} />
      <div className="mx-auto max-w-xl px-4">
        <div className="mb-3 flex items-center gap-2" aria-hidden="true">
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= asked.length ? 'bg-brand' : 'bg-sand'}`} />
          ))}
        </div>
        <p className="text-[14px] font-bold uppercase tracking-wide text-muted">{t('q_progress', lang, { i: asked.length + 1, n: total })}</p>

        <Card className="animate-rise mt-2" key={q.campo}>
          <h2 className="text-[26px] font-extrabold leading-tight">{pregunta}</h2>
          {q.porque && (
            <p className="mt-2 text-[14px] text-muted"><span className="font-bold">{t('q_why', lang)}:</span> {q.porque}</p>
          )}

          <div className="mt-5">
            {q.tipo === 'si_no' && q.campo !== 'sexo' && (
              <div className="grid grid-cols-3 gap-3">
                <Button className="h-20 px-2 text-[24px]" onClick={() => answer(true)}>{t('yes', lang)}</Button>
                <Button variant="dark" className="h-20 px-2 text-[24px]" onClick={() => answer(false)}>{t('no', lang)}</Button>
                <Button variant="secondary" className="h-20 px-2 text-[20px]" onClick={() => answer(undefined)}>{t('dont_know', lang)}</Button>
              </div>
            )}

            {q.campo === 'sexo' && (
              <div className="grid grid-cols-2 gap-3">
                <Button className="h-20 text-[20px]" onClick={() => answer('F')}>{t('female', lang)}</Button>
                <Button className="h-20 text-[20px]" onClick={() => answer('M')}>{t('male', lang)}</Button>
              </div>
            )}

            {isBreath && !manualBreaths && (
              <BreathCounter onDone={(rpm) => answer(rpm)} onManual={() => setManualBreaths(true)} />
            )}

            {((q.tipo === 'numero' && !isBreath) || (isBreath && manualBreaths)) && (
              <form onSubmit={(e) => { e.preventDefault(); submitNumber(); }} className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <input
                    autoFocus inputMode="decimal" value={num}
                    onChange={(e) => setNum(e.target.value.replace(/[^\d.,]/g, ''))}
                    placeholder={t('number_placeholder', lang)}
                    className="h-16 min-w-0 flex-1 rounded-2xl border-2 border-line px-4 text-[24px] font-bold outline-none focus:border-brand"
                  />
                  {q.campo === 'edad_meses' && (
                    <div className="flex rounded-2xl bg-sand p-1">
                      {(['years', 'months'] as const).map((u) => (
                        <button key={u} type="button" onClick={() => setUnit(u)} aria-pressed={unit === u}
                          className={`rounded-xl px-3 text-[15px] font-bold ${unit === u ? 'bg-white shadow-sm' : 'text-muted'}`}>
                          {u === 'years' ? t('age_years', lang) : t('age_months', lang)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={!num}>{t('next', lang)}</Button>
              </form>
            )}
          </div>
        </Card>

        <div className={`mt-4 grid gap-3 ${q.tipo === 'si_no' && q.campo !== 'sexo' ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {!(q.tipo === 'si_no' && q.campo !== 'sexo') && (
            <Button variant="secondary" onClick={() => answer(undefined)}>{t('dont_know', lang)}</Button>
          )}
          <Button variant="ghost" onClick={skip}>{t('skip', lang)}</Button>
        </div>
        <p className="mt-3 text-center text-[13px] text-muted">“{t('dont_know', lang)}” y “{t('skip', lang)}” están bien: Pahtli te avisará que no está segura.</p>
      </div>
    </div>
  );
}
