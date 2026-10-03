import { useEffect, useMemo, useState } from 'react';
import type { FiredRule, Lang, TriageLevel } from '../types';
import { useApp } from '../components/AppContext';
import { LEVELS, levelLabel, levelSub, t } from '../i18n/strings';
import { saveCase, getSettings } from '../db/db';
import { classifySyndrome } from '../triage/syndrome';
import { speak, stopSpeaking, ttsAvailable } from '../components/speech';
import { findingsSummary } from '../components/findingsView';
import { notifyCasesChanged } from '../components/storage';
import { Alert, Check, CheckCircle, Chip, Clinic, Plus, Save, Speaker, Stop } from '../components/Icons';
import { go } from '../components/router';
import { Referral } from '../components/Referral';

const LevelIcon = ({ level, size }: { level: TriageLevel; size: number }) =>
  level === 'urgencia' ? <Alert size={size} strokeWidth={2.4} /> : level === 'centro_hoy' ? <Clinic size={size} strokeWidth={2.4} /> : <CheckCircle size={size} strokeWidth={2.4} />;

const pick = (r: Record<Lang, string>, lang: Lang) => (lang === 'nah' && r.nah?.trim() ? r.nah : r.es);

export default function Result() {
  const { lang, session, setSession, resetSession, tier } = useApp();
  const { result, findings, extraction } = session;
  const [speaking, setSpeaking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => { if (!result || !findings) go('capture', true); }, [result, findings]);

  const meta = result ? LEVELS[result.level] : LEVELS.aqui;

  // Color de la barra del sistema = color del nivel
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

  const speech = useMemo(() => {
    if (!result) return '';
    // La voz siempre en español: no hay voz del sistema en náhuatl.
    const why = result.fired.slice(0, 3).map((r) => r.explicacion.es).join('. ');
    const todo = result.fired.length
      ? [...new Set(result.fired.map((r) => r.accion.es))].slice(0, 3).join('. ')
      : t('result_no_rules_action', 'es');
    return `${levelLabel(result.level, 'es')}. ${levelSub(result.level, 'es')}. ${why ? `Por qué: ${why}.` : ''} Qué hacer: ${todo}`;
  }, [result]);

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

  async function onSave() {
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
      });
      setSession((s) => ({ ...s, savedId: rec.case_id }));
      notifyCasesChanged();
    } catch (e) {
      console.error('[save]', e);
      setSaveErr(t('error_generic', lang));
    } finally {
      setSaving(false);
    }
  }

  const newPatient = () => { stopSpeaking(); resetSession(); go('capture', true); };
  const summary = findingsSummary(findings, lang);
  const ms = Math.round((extraction?.latency_ms ?? 0) + (session.triageMs ?? 0));
  const darkText = meta.fg !== '#ffffff';

  return (
    <div className="min-h-dvh" style={{ background: meta.bg, color: meta.fg }}>
      <div className="mx-auto max-w-xl px-4 pb-10">
        {/* Encabezado del nivel */}
        <div className="animate-rise flex flex-col items-center pb-6 pt-8 text-center">
          <div className={`flex h-24 w-24 items-center justify-center rounded-full ${darkText ? 'bg-black/10' : 'bg-white/20'}`}>
            <LevelIcon level={result.level} size={56} />
          </div>
          <h1 className="mt-4 text-[40px] font-black uppercase leading-none tracking-tight">{levelLabel(result.level, lang)}</h1>
          <p className="mt-2 text-[20px] font-semibold">{levelSub(result.level, lang)}</p>
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
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[16px] font-extrabold" style={{ background: meta.bg, color: meta.fg }}>{i + 1}</span>
                <span className="pt-0.5 text-[18px] font-semibold leading-snug">{a}</span>
              </li>
            ))}
          </ol>
        </section>

        <Referral level={result.level} lang={lang} />

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

        {/* Acciones */}
        <div className="mt-4 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving || !!session.savedId}
            className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-ink text-[19px] font-extrabold text-white shadow-lg active:bg-stone-700 disabled:opacity-100"
          >
            {session.savedId ? <><Check size={24} />{t('result_saved', lang)}</> : <><Save size={22} />{saving ? t('loading', lang) : t('result_save', lang)}</>}
          </button>
          {saveErr && <p className="rounded-xl bg-white px-4 py-2 text-[15px] font-semibold text-red-800">{saveErr}</p>}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => go('capture')}
              className={`min-h-14 rounded-2xl text-[16px] font-bold ${darkText ? 'bg-black/10' : 'bg-white/20'}`}>
              {t('result_edit', lang)}
            </button>
            <button type="button" onClick={newPatient}
              className="flex min-h-14 items-center justify-center gap-1.5 rounded-2xl bg-white text-[16px] font-bold text-ink">
              <Plus size={20} />{t('result_new', lang)}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-[14px] font-semibold opacity-90">{t('disclaimer', lang)}</p>
        <p className="mt-1 text-center text-[12px] opacity-75">
          {t('ondevice', lang, { ms })}{extraction ? ` · ${extraction.method}` : ''}
        </p>
      </div>
    </div>
  );
}
