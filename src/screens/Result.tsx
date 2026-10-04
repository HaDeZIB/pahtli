import { useEffect, useMemo, useState } from 'react';
import type { CaseDecision, FiredRule, Lang, TriageLevel } from '../types';
import { LEVEL_RANK } from '../types';
import { useApp } from '../components/AppContext';
import { LEVELS, OVERRIDE_REASONS, UNCERTAIN_META, levelLabel, levelSub, overrideReasonLabel, t } from '../i18n/strings';
import { saveCase, getSettings } from '../db/db';
import { classifySyndrome } from '../triage/syndrome';
import { assessUncertainty } from '../triage/uncertainty';
import { selectAdvice, type SelectedAdvice } from '../triage/advice';
import { speak, stopSpeaking, ttsAvailable } from '../components/speech';
import { findingsSummary } from '../components/findingsView';
import { getCentroTel, notifyCasesChanged, telHref } from '../components/storage';
import { Alert, Check, CheckCircle, Chip, Clinic, Info, Phone, Plus, Question, Speaker, Stop } from '../components/Icons';
import { go } from '../components/router';
import { Referral } from '../components/Referral';

const LevelIcon = ({ level, size }: { level: TriageLevel; size: number }) =>
  level === 'urgencia' ? <Alert size={size} strokeWidth={2.4} /> : level === 'centro_hoy' ? <Clinic size={size} strokeWidth={2.4} /> : <CheckCircle size={size} strokeWidth={2.4} />;

const pick = (r: Record<Lang, string>, lang: Lang) => (lang === 'nah' && r.nah?.trim() ? r.nah : r.es);

const Bullets = ({ items }: { items: string[] }) => (
  <ul className="mt-1.5 flex flex-col gap-1.5">
    {items.map((x) => (
      <li key={x} className="flex gap-2 text-[17px] font-semibold leading-snug">
        <span className="mt-2 inline-block h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />{x}
      </li>
    ))}
  </ul>
);

/** Cuidados según la molestia (src/triage/advice.ts): en casa ("aqui") o mientras llega al centro ("centro_hoy"). */
function AdviceBody({ a, lang }: { a: SelectedAdvice; lang: Lang }) {
  return (
    <>
      <Bullets items={a.cuidados} />
      {a.regrese.length > 0 && (
        <>
          <p className="mt-3 text-[15px] font-extrabold">{t('adv_go_if', lang)}</p>
          <Bullets items={a.regrese} />
        </>
      )}
      {a.consulta.length > 0 && (
        <>
          <p className="mt-3 text-[15px] font-extrabold">{t('adv_consult_if', lang)}</p>
          <Bullets items={a.consulta} />
        </>
      )}
      <p className="mt-2 text-[12px] text-muted">
        <span className="font-bold">{t('result_source', lang)}:</span>{' '}
        <a href={a.fuente_url} target="_blank" rel="noreferrer" className="underline decoration-dotted">{a.fuente}</a>
      </p>
    </>
  );
}

/** La primera molestia se muestra abierta; las demás, plegadas (se abren con un toque) para no hacer larga la pantalla. */
function AdviceBlock({ a, lang, open }: { a: SelectedAdvice; lang: Lang; open: boolean }) {
  if (open) {
    return (
      <div data-testid={`advice-${a.id}`}>
        <h3 className="text-[19px] font-extrabold">{a.titulo}</h3>
        <AdviceBody a={a} lang={lang} />
      </div>
    );
  }
  return (
    <details className="mt-4 border-t border-line pt-4" data-testid={`advice-${a.id}`}>
      <summary className="min-h-11 cursor-pointer text-[19px] font-extrabold">{a.titulo}</summary>
      <AdviceBody a={a} lang={lang} />
    </details>
  );
}
const ALL_LEVELS: TriageLevel[] = ['aqui', 'centro_hoy', 'urgencia'];

function LevelPill({ level, lang }: { level: TriageLevel; lang: Lang }) {
  const m = LEVELS[level];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[15px] font-extrabold" style={{ background: m.soft, color: m.softFg }}>
      <span className="inline-block h-3 w-3 rounded-full" style={{ background: m.bg }} />
      {levelLabel(level, lang)}
    </span>
  );
}

export default function Result() {
  const { lang, session, setSession, resetSession, tier } = useApp();
  const { result, findings, extraction } = session;
  const [speaking, setSpeaking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  // Decisión humana
  const [changing, setChanging] = useState(false);
  const [pickLevel, setPickLevel] = useState<TriageLevel | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [formErr, setFormErr] = useState<string | null>(null);

  useEffect(() => { if (!result || !findings) go('capture', true); }, [result, findings]);

  // Fail-safe: ¿hay datos suficientes para confiar en la sugerencia? No cambia el nivel.
  const unc = useMemo(() => (result
    ? assessUncertainty({ transcript: session.transcript, extraction, triageResult: result, answeredQuestions: session.answers ?? [], findings })
    : { uncertain: false, reasons: [], codes: [] }), [result, findings, extraction, session.transcript, session.answers]);

  const level: TriageLevel = result?.level ?? 'aqui';
  // Urgencia domina visualmente; en los demás niveles, la incertidumbre es el estado principal.
  const showUnc = unc.uncertain && level !== 'urgencia';
  const meta = showUnc ? UNCERTAIN_META : LEVELS[level];

  // Color de la barra del sistema = color del estado
  useEffect(() => {
    const tag = document.querySelector('meta[name="theme-color"]');
    const prev = tag?.getAttribute('content');
    tag?.setAttribute('content', meta.bg);
    return () => { if (prev) tag?.setAttribute('content', prev); stopSpeaking(); };
  }, [meta.bg]);

  const actions = useMemo(() => {
    if (!result) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of result.fired) {
      const a = pick(r.accion, lang);
      if (a && !seen.has(a)) { seen.add(a); out.push(a); }
    }
    if (!out.length) out.push(t('result_no_rules_action', lang));
    return out;
  }, [result, lang]);

  // Cuidados según la molestia: no cambian el nivel; con urgencia no se muestran (manda la acción de la regla).
  const advice = useMemo(() => (result && findings ? selectAdvice(findings, result.level) : []), [result, findings]);

  const speech = useMemo(() => {
    if (!result) return '';
    // La voz siempre en español: no hay voz del sistema en náhuatl.
    const why = result.fired.slice(0, 3).map((r) => r.explicacion.es).join('. ');
    const todo = result.fired.length
      ? [...new Set(result.fired.map((r) => r.accion.es))].slice(0, 3).join('. ')
      : t('result_no_rules_action', 'es');
    const uncWhy = unc.reasons.join(' ');
    if (showUnc) {
      return `${t('unc_title', 'es')}. ${t('unc_sub', 'es')}. ${uncWhy} ${t('unc_rules_say', 'es')} ${levelLabel(result.level, 'es')}. Qué hacer: ${todo}`;
    }
    const care = advice[0] ? ` ${advice[0].modo === 'casa' ? 'Cuidados' : 'Mientras llega'}: ${advice[0].cuidados.join(' ')}` : '';
    const base = `${levelLabel(result.level, 'es')}. ${levelSub(result.level, 'es')}. ${why ? `Por qué: ${why}.` : ''} Qué hacer: ${todo}${care}`;
    return unc.uncertain ? `${base}. ${t('unc_also', 'es').replace('⚪ ', '')}: ${uncWhy}` : base;
  }, [result, unc, showUnc, advice]);

  // Intentar hablar al llegar (iOS puede bloquearlo sin un toque; queda el botón "Escuchar").
  useEffect(() => {
    if (!speech || !ttsAvailable()) return;
    const id = window.setTimeout(() => { setSpeaking(true); speak(speech, () => setSpeaking(false)); }, 350);
    return () => window.clearTimeout(id);
  }, [speech]);

  if (!result || !findings) return null;

  const toggleSpeak = () => {
    if (speaking) { stopSpeaking(); setSpeaking(false); return; }
    setSpeaking(true);
    speak(speech, () => setSpeaking(false));
  };

  async function onSave(decision: CaseDecision) {
    if (!result || !findings || session.savedId) return;
    setSaving(true);
    setSaveErr(null);
    try {
      let comunidad = 'Sin comunidad';
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const s = await getSettings();
        if (s?.comunidad) comunidad = s.comunidad;
        lat = s?.lat ?? undefined;
        lng = s?.lng ?? undefined;
      } catch { /* sin ajustes */ }
      let sindrome;
      try { sindrome = classifySyndrome(findings); } catch { sindrome = undefined; }
      const rec = await saveCase({
        comunidad, lat, lng,
        transcript: session.transcript,
        findings,
        result: { level: result.level, escalated_by_model: result.escalated_by_model, rule_ids: result.fired.map((r) => r.id) },
        sindrome,
        device_tier: tier ?? 'C',
        decision,
        uncertain: unc.uncertain,
        uncertainty_reasons: unc.uncertain ? unc.reasons : undefined,
        uncertainty_codes: unc.uncertain ? unc.codes : undefined,
      });
      setSession((s) => ({ ...s, savedId: rec.case_id, decision }));
      setChanging(false);
      notifyCasesChanged();
    } catch (e) {
      console.error('[save]', e);
      setSaveErr(t('error_generic', lang));
    } finally {
      setSaving(false);
    }
  }

  const agree = () => void onSave({ final_level: result.level, overridden: false, decided_at: new Date().toISOString() });
  const saveChange = () => {
    if (!pickLevel) { setFormErr(t('hitl_pick_level', lang)); return; }
    if (pickLevel === result.level) { setFormErr(t('hitl_same_level', lang)); return; }
    if (!reason) { setFormErr(t('hitl_need_reason', lang)); return; }
    setFormErr(null);
    void onSave({ final_level: pickLevel, overridden: true, reason, note: note.trim() || undefined, decided_at: new Date().toISOString() });
  };

  const decision = session.decision;
  // Referencia: el nivel más alto entre lo sugerido y lo que decidió la promotora (nunca esconde el hospital).
  const refLevel: TriageLevel = decision && LEVEL_RANK[decision.final_level] > LEVEL_RANK[level] ? decision.final_level : level;
  const newPatient = () => { stopSpeaking(); resetSession(); go('capture', true); };
  const summary = findingsSummary(findings, lang);
  const ms = Math.round((extraction?.latency_ms ?? 0) + (session.triageMs ?? 0));
  const darkText = meta.fg !== '#ffffff';
  const tel = getCentroTel();
  const downgradeUrgency = level === 'urgencia' && pickLevel !== null && LEVEL_RANK[pickLevel] < LEVEL_RANK.urgencia;

  const uncReasons = (
    <ul className="mt-2 flex flex-col gap-1.5">
      {unc.reasons.map((r) => (
        <li key={r} className="flex gap-2 text-[16px] font-semibold leading-snug">
          <span className="mt-2 inline-block h-2 w-2 shrink-0 rounded-full bg-slate-500" />{r}
        </li>
      ))}
    </ul>
  );
  const callBlock = tel ? (
    <a href={telHref(tel)} className="mt-4 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-slate-700 text-[18px] font-extrabold text-white active:bg-slate-800">
      <Phone size={22} />{t('unc_call', lang)}
    </a>
  ) : (
    <p className="mt-3 text-[14px] text-muted">
      {t('unc_no_phone', lang)}{' '}
      <button type="button" onClick={() => go('config')} className="font-bold text-brand-dark underline">{t('nav_config', lang)}</button>
    </p>
  );

  return (
    <div className="min-h-dvh" style={{ background: meta.bg, color: meta.fg }}>
      <div className="mx-auto max-w-xl px-4 pb-10">
        {/* Encabezado del estado */}
        <div className="animate-rise flex flex-col items-center pb-6 pt-8 text-center" data-testid={showUnc ? 'result-uncertain' : `result-${level}`}>
          <div className={`flex h-24 w-24 items-center justify-center rounded-full ${darkText ? 'bg-black/10' : 'bg-white/20'}`}>
            {showUnc ? <Question size={56} strokeWidth={2.4} /> : <LevelIcon level={level} size={56} />}
          </div>
          <h1 className="mt-4 text-[40px] font-black uppercase leading-none tracking-tight">{showUnc ? t('unc_title', lang) : levelLabel(level, lang)}</h1>
          <p className="mt-2 text-[20px] font-semibold">{showUnc ? t('unc_sub', lang) : levelSub(level, lang)}</p>
          {showUnc && (
            <div className="mt-4 flex flex-col items-center gap-1.5">
              <span className="text-[14px] font-semibold opacity-90">{t('unc_rules_say', lang)}</span>
              <LevelPill level={level} lang={lang} />
            </div>
          )}
          <button
            type="button"
            onClick={toggleSpeak}
            disabled={!ttsAvailable()}
            className={`mt-5 inline-flex min-h-14 items-center gap-2 rounded-full px-6 text-[18px] font-bold ${darkText ? 'bg-black/10 active:bg-black/20' : 'bg-white/20 active:bg-white/30'}`}
          >
            {speaking ? <Stop size={22} /> : <Speaker size={22} />}
            {speaking ? t('result_stop', lang) : t('result_listen', lang)}
          </button>
        </div>

        {/* Fail-safe: no estoy segura */}
        {unc.uncertain && (
          <section className={`mb-3 rounded-3xl bg-white p-5 text-ink ${showUnc ? 'shadow-lg' : 'border-4 border-slate-400'}`} data-testid="uncertainty" role="status">
            <h2 className="text-[17px] font-extrabold">{showUnc ? t('unc_banner', lang) : t('unc_also', lang)}</h2>
            <p className="mt-1 text-[13px] font-bold uppercase tracking-wider text-muted">{t('unc_why', lang)}</p>
            {uncReasons}
            {showUnc && <p className="mt-3 text-[15px]">{t('unc_hint', lang)}</p>}
            {callBlock}
          </section>
        )}

        {result.escalated_by_model && (
          <div className="mb-3 flex gap-3 rounded-2xl bg-white p-4 text-ink">
            <Chip size={22} className="mt-0.5 shrink-0 text-clay" />
            <p className="text-[15px] font-semibold">{t('result_model_escalated', lang)}</p>
          </div>
        )}

        {/* Qué hacer ahora */}
        <section className="rounded-3xl bg-white p-5 text-ink shadow-lg">
          <h2 className="text-[14px] font-extrabold uppercase tracking-wider text-muted">{t('result_todo', lang)}</h2>
          <ol className="mt-3 flex flex-col gap-3">
            {actions.map((a, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[16px] font-extrabold" style={{ background: LEVELS[level].bg, color: LEVELS[level].fg }}>{i + 1}</span>
                <span className="pt-0.5 text-[18px] font-semibold leading-snug">{a}</span>
              </li>
            ))}
          </ol>
        </section>

        {advice.length > 0 && (
          <section className="mt-3 rounded-3xl bg-white p-5 text-ink shadow-lg" data-testid="advice">
            <h2 className="text-[14px] font-extrabold uppercase tracking-wider text-muted">
              {advice[0].modo === 'casa' ? t('adv_home', lang) : t('adv_meanwhile', lang)}
            </h2>
            <div className="mt-3">
              {advice.map((a, i) => <AdviceBlock key={a.id} a={a} lang={lang} open={i === 0} />)}
            </div>
          </section>
        )}

        <Referral level={refLevel} lang={lang} uncertain={unc.uncertain} />

        {/* Por qué */}
        <section className="mt-3 rounded-3xl bg-white p-5 text-ink">
          <h2 className="text-[14px] font-extrabold uppercase tracking-wider text-muted">{t('result_why', lang)}</h2>
          {result.fired.length === 0 ? (
            <p className="mt-2 text-[17px]">{t('result_no_rules', lang)}</p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-line">
              {result.fired.map((r: FiredRule) => (
                <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-2">
                    <span className="mt-1.5 inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: LEVELS[r.level].bg }} />
                    <p className="text-[17px] font-semibold leading-snug">{pick(r.explicacion, lang)}</p>
                  </div>
                  <p className="mt-1 pl-5 text-[13px] text-muted">
                    <span className="font-bold">{t('result_source', lang)}:</span>{' '}
                    {r.fuente_url ? <a href={r.fuente_url} target="_blank" rel="noreferrer" className="underline decoration-dotted">{r.fuente}</a> : r.fuente}
                    <span className="ml-1 rounded bg-sand px-1.5 py-0.5 font-mono text-[11px]">{r.id}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
          {summary.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <h3 className="text-[13px] font-bold text-muted">{t('result_findings', lang)}</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {summary.map((s) => <span key={s} className="rounded-full bg-sand px-2.5 py-1 text-[13px] font-semibold">{s}</span>)}
              </div>
            </div>
          )}
        </section>

        {/* La promotora decide */}
        <section className="mt-4 rounded-3xl bg-white p-5 text-ink shadow-lg" data-testid="decision">
          <h2 className="text-[20px] font-black tracking-tight">{t('hitl_title', lang)}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[15px] font-semibold text-muted">
            {t('hitl_suggests', lang)} <LevelPill level={level} lang={lang} />
          </p>

          {session.savedId && decision ? (
            <div className="mt-4 flex flex-col gap-3">
              <p className="flex flex-wrap items-center gap-2 text-[16px] font-bold">
                {t('hitl_your_decision', lang)}: <LevelPill level={decision.final_level} lang={lang} />
                {decision.overridden && <span className="text-[14px] font-semibold text-muted">({t('hitl_changed_from', lang, { from: levelLabel(level, lang) })} · {overrideReasonLabel(decision.reason)})</span>}
              </p>
              <button type="button" disabled className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-ink text-[19px] font-extrabold text-white disabled:opacity-100">
                <Check size={24} />{t('result_saved', lang)}
              </button>
            </div>
          ) : !changing ? (
            <div className="mt-4 flex flex-col gap-3">
              <button type="button" onClick={agree} disabled={saving}
                className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-ink px-3 text-center text-[18px] font-extrabold text-white shadow-lg active:bg-stone-700 disabled:opacity-70">
                <Check size={22} className="shrink-0" />
                {saving ? t('loading', lang) : (
                  // "Estoy de acuerdo · Guardar caso": si no cabe, se parte en el "·", nunca a media frase.
                  <span>{t('hitl_agree', lang).split(' · ').map((part, i, arr) => (
                    <span key={i}><span className="whitespace-nowrap">{part}{i < arr.length - 1 ? ' ·' : ''}</span>{i < arr.length - 1 ? ' ' : ''}</span>
                  ))}</span>
                )}
              </button>
              <button type="button" onClick={() => { setChanging(true); setPickLevel(null); setReason(''); setFormErr(null); }}
                className="min-h-14 rounded-2xl border-2 border-line text-[17px] font-bold active:bg-sand">
                {t('hitl_change', lang)}
              </button>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-[15px] font-bold">{t('hitl_pick_level', lang)}</p>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('hitl_pick_level', lang)}>
                {ALL_LEVELS.map((l) => {
                  const on = pickLevel === l;
                  return (
                    <button key={l} type="button" role="radio" aria-checked={on} onClick={() => setPickLevel(l)} disabled={l === level}
                      className="min-h-16 rounded-2xl border-2 px-1 text-[15px] font-extrabold leading-tight disabled:opacity-40"
                      style={on ? { background: LEVELS[l].bg, color: LEVELS[l].fg, borderColor: LEVELS[l].bg } : { borderColor: LEVELS[l].bg, color: LEVELS[l].softFg }}>
                      {levelLabel(l, lang, true)}
                    </button>
                  );
                })}
              </div>
              {downgradeUrgency && <p className="rounded-xl bg-red-50 px-3 py-2 text-[14px] font-semibold text-red-800">{t('hitl_downgrade_warn', lang)}</p>}
              <label htmlFor="reason" className="text-[15px] font-bold">{t('hitl_pick_reason', lang)}</label>
              <select id="reason" value={reason} onChange={(e) => setReason(e.target.value)}
                className="h-14 rounded-xl border-2 border-line bg-white px-3 text-[17px] outline-none focus:border-brand">
                <option value="">—</option>
                {OVERRIDE_REASONS.map((r) => <option key={r.code} value={r.code}>{r.es}</option>)}
              </select>
              <label htmlFor="note" className="text-[15px] font-bold">{t('hitl_note', lang)}</label>
              <input id="note" value={note} maxLength={140} onChange={(e) => setNote(e.target.value)}
                className="h-14 rounded-xl border-2 border-line px-3 text-[17px] outline-none focus:border-brand" />
              {formErr && <p className="text-[14px] font-semibold text-red-800" role="alert">{formErr}</p>}
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setChanging(false)} className="min-h-14 rounded-2xl border-2 border-line text-[16px] font-bold active:bg-sand">
                  {t('hitl_cancel', lang)}
                </button>
                <button type="button" onClick={saveChange} disabled={saving}
                  className="min-h-14 rounded-2xl bg-ink text-[16px] font-extrabold text-white active:bg-stone-700 disabled:opacity-70">
                  {saving ? t('loading', lang) : t('hitl_save_change', lang)}
                </button>
              </div>
            </div>
          )}
          {saveErr && <p className="mt-2 rounded-xl bg-red-50 px-4 py-2 text-[15px] font-semibold text-red-800">{saveErr}</p>}
        </section>

        {/* Acciones */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => go('capture')}
            className={`min-h-14 rounded-2xl text-[16px] font-bold ${darkText ? 'bg-black/10' : 'bg-white/20'}`}>
            {t('result_edit', lang)}
          </button>
          <button type="button" onClick={newPatient}
            className="flex min-h-14 items-center justify-center gap-1.5 rounded-2xl bg-white text-[16px] font-bold text-ink">
            <Plus size={20} />{t('result_new', lang)}
          </button>
        </div>

        <p className="mt-6 text-center text-[14px] font-semibold opacity-90">{t('disclaimer', lang)}</p>
        <p className="mt-1 text-center text-[12px] opacity-75">
          {t('ondevice', lang, { ms })}{extraction ? ` · ${extraction.method.includes('llm') ? 'IA + palabras clave' : 'palabras clave'}` : ''}
        </p>
        <p className="mt-2 text-center">
          <a href="#/acerca" className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-bold underline opacity-90">
            <Info size={16} />{t('about_link', lang)}
          </a>
        </p>
      </div>
    </div>
  );
}
