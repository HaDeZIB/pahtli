import { useEffect, useMemo, useRef, useState } from 'react';
import type { ExtractionResult, Findings } from '../types';
import { useApp } from '../components/AppContext';
import { t } from '../i18n/strings';
import { recordAudio, transcribe } from '../ai/stt';
import { llmReady } from '../ai/llm';
import { extract } from '../ai/extractor';
import { triage } from '../triage/engine';
import { SYMPTOMS } from '../triage/findings';
import { Button, Card, ProgressBar, TopBar } from '../components/ui';
import { Grid, Keyboard, Mic, Sparkle, Stop } from '../components/Icons';
import { go } from '../components/router';
import { lsGet, lsSet } from '../components/storage';

type Mode = 'voice' | 'text' | 'buttons';
type MicState = 'idle' | 'recording' | 'transcribing';

const MAX_REC_S = 60;

const EXAMPLES = [
  'Niña de 1 año, tiene calentura desde ayer, respira muy rápido y se le hunde el pecho.',
  'Señora embarazada de 7 meses, le duele mucho la cabeza y ve lucecitas.',
  'Niño de 4 años con tos y mocos desde hace dos días, come y juega bien.',
];

const GROUP_LABEL: Record<string, string> = {
  peligro: 'Signos de peligro', general: 'Signos de peligro y generales', respiratorio: 'Respiración', resp: 'Respiración',
  digestivo: 'Estómago y diarrea', diarrea: 'Diarrea', gastro: 'Estómago y diarrea', fiebre: 'Fiebre', febril: 'Fiebre',
  embarazo: 'Embarazo', obstetrico: 'Embarazo', neurologico: 'Cabeza y nervios', neuro: 'Cabeza y nervios',
  cardiovascular: 'Corazón y pecho', cardio: 'Corazón y pecho', piel: 'Piel', trauma: 'Golpes y heridas',
  hidratacion: 'Hidratación', deshidratacion: 'Deshidratación', nutricion: 'Alimentación', otro: 'Otros',
  posparto: 'Después del parto', recien_nacido: 'Recién nacido (menos de 2 meses)', urinario: 'Orina',
};
const GROUP_EMOJI: Record<string, string> = {
  peligro: '⚠️', respiratorio: '🫁', resp: '🫁', digestivo: '💧', diarrea: '💧', gastro: '💧', fiebre: '🌡️', febril: '🌡️',
  embarazo: '🤰', obstetrico: '🤰', neurologico: '🧠', neuro: '🧠', cardiovascular: '❤️', cardio: '❤️', piel: '✋',
  trauma: '🩹', general: '⚠️', hidratacion: '💧', deshidratacion: '💧', nutricion: '🍲', otro: '•',
  posparto: '🤱', recien_nacido: '👶', urinario: '🚻',
};
const groupLabel = (g: string) => GROUP_LABEL[g] ?? g.charAt(0).toUpperCase() + g.slice(1).replace(/_/g, ' ');

export default function Capture() {
  const { lang, tier, session, setSession, stt, ensureSTT } = useApp();
  const [mode, setMode] = useState<Mode>(() => {
    const saved = lsGet('pahtli:mode');
    return saved === 'text' || saved === 'buttons' || saved === 'voice' ? saved : 'voice';
  });
  const [transcript, setTranscript] = useState(session.transcript.startsWith('[botones]') ? '' : session.transcript);
  const [mic, setMic] = useState<MicState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const recRef = useRef<{ stop: () => Promise<Float32Array> } | null>(null);
  const stoppingRef = useRef(false);

  // Botones
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ageVal, setAgeVal] = useState('');
  const [ageUnit, setAgeUnit] = useState<'years' | 'months'>('years');
  const [sexo, setSexo] = useState<'F' | 'M' | undefined>();
  const [embarazada, setEmbarazada] = useState(false);

  const voiceAllowed = tier !== 'C' && stt.state !== 'unavailable';
  useEffect(() => {
    if (tier === 'C' && mode === 'voice') setMode('buttons');
  }, [tier, mode]);
  const changeMode = (m: Mode) => { setMode(m); lsSet('pahtli:mode', m); setErr(null); };

  // Temporizador de grabación
  useEffect(() => {
    if (mic !== 'recording') return;
    const t0 = Date.now();
    setElapsed(0);
    const id = window.setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      setElapsed(s);
      if (s >= MAX_REC_S) void stopRec();
    }, 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mic]);

  async function startRec() {
    setErr(null);
    void ensureSTT(); // carga en paralelo mientras se graba
    try {
      recRef.current = await recordAudio();
      stoppingRef.current = false;
      setMic('recording');
    } catch (e) {
      console.error('[mic]', e);
      const name = e instanceof Error ? e.name : '';
      setErr(name === 'NotAllowedError' || name === 'SecurityError' ? t('mic_denied', lang) : t('mic_unavailable', lang));
      setMic('idle');
    }
  }

  async function stopRec() {
    if (!recRef.current || stoppingRef.current) return;
    stoppingRef.current = true;
    setMic('transcribing');
    try {
      const audio = await recRef.current.stop();
      recRef.current = null;
      const ok = await ensureSTT();
      if (!ok) { setErr(t('mic_unavailable', lang)); setMic('idle'); return; }
      const text = (await transcribe(audio)).trim();
      if (text) setTranscript((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
    } catch (e) {
      console.error('[stt]', e);
      setErr(t('error_generic', lang));
    } finally {
      setMic('idle');
    }
  }

  const groups = useMemo(() => {
    const g = new Map<string, [string, { es: string; nah?: string }][]>();
    for (const [k, v] of Object.entries(SYMPTOMS as Record<string, { es: string; nah?: string; group: string }>)) {
      const arr = g.get(v.group) ?? [];
      arr.push([k, v]);
      g.set(v.group, arr);
    }
    // Signos de peligro primero; el resto en el orden del catálogo clínico.
    const order = ['peligro', 'general'];
    const rank = (k: string) => { const i = order.indexOf(k); return i === -1 ? order.length : i; };
    return [...g.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
  }, []);

  const toggle = (k: string) => setSelected((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const ageMonths = (): number | undefined => {
    const n = parseFloat(ageVal.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) return undefined;
    return ageUnit === 'years' ? Math.round(n * 12) : Math.round(n);
  };

  const canEvaluate = mode === 'buttons' ? selected.size > 0 || ageVal !== '' : transcript.trim().length > 0;

  async function evaluate() {
    if (!canEvaluate) { setErr(t('need_input', lang)); return; }
    setBusy(true);
    setErr(null);
    try {
      let extraction: ExtractionResult;
      let text = transcript.trim();
      if (mode === 'buttons') {
        const sintomas: Findings['sintomas'] = {};
        selected.forEach((k) => { sintomas[k] = true; });
        const findings: Findings = { sintomas };
        const m = ageMonths();
        if (m !== undefined) findings.edad_meses = m;
        if (sexo) findings.sexo = sexo;
        if (sexo === 'F' && embarazada) findings.embarazada = true;
        extraction = { findings, method: 'keywords', latency_ms: 0 };
        text = `[botones] ${[...selected].join(', ')}`;
      } else {
        extraction = await extract(text, { useLLM: llmReady() });
      }
      const t1 = performance.now();
      const result = triage(extraction.findings, extraction.model_level_hint);
      const triageMs = performance.now() - t1;
      setSession({ transcript: text, findings: extraction.findings, extraction, result, asked: [], answers: [], triageMs });
      go(result.preguntas.length ? 'preguntas' : 'resultado');
    } catch (e) {
      console.error('[evaluate]', e);
      setErr(t('error_generic', lang));
    } finally {
      setBusy(false);
    }
  }

  const modes: { m: Mode; label: string; Icon: typeof Mic; show: boolean }[] = [
    { m: 'voice', label: t('mode_voice', lang), Icon: Mic, show: voiceAllowed },
    { m: 'text', label: t('mode_text', lang), Icon: Keyboard, show: true },
    { m: 'buttons', label: t('mode_buttons', lang), Icon: Grid, show: true },
  ];

  const mm = String(Math.floor(elapsed / 60)).padStart(1, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div className="pb-40">
      <TopBar />
      <div className="mx-auto max-w-xl px-4">
        <h2 className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight">{t('capture_title', lang)}</h2>
        <p className="text-[17px] text-muted">{t('capture_hint', lang)}</p>

        {/* Selector de modo */}
        <div className="mt-4 flex gap-1 rounded-2xl bg-sand p-1" role="tablist">
          {modes.filter((x) => x.show).map(({ m, label, Icon }) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => changeMode(m)}
              className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl text-[15px] font-bold ${mode === m ? 'bg-white text-ink shadow-sm' : 'text-muted'}`}
            >
              <Icon size={20} />{label}
            </button>
          ))}
        </div>

        {mode === 'voice' && (
          <div className="mt-6 flex flex-col items-center">
            <div className="relative flex h-56 w-56 items-center justify-center">
              {mic === 'recording' && (
                <>
                  <span className="animate-ring absolute inset-6 rounded-full bg-red-500/40" />
                  <span className="animate-ring absolute inset-6 rounded-full bg-red-500/30 [animation-delay:0.8s]" />
                </>
              )}
              <button
                type="button"
                onClick={() => (mic === 'recording' ? void stopRec() : mic === 'idle' ? void startRec() : undefined)}
                disabled={mic === 'transcribing' || busy}
                aria-label={mic === 'recording' ? t('mic_listening', lang) : t('mic_tap', lang)}
                className={`relative z-10 flex h-44 w-44 items-center justify-center rounded-full text-white shadow-xl transition-transform active:scale-95 ${
                  mic === 'recording' ? 'bg-red-600' : 'bg-brand'} disabled:opacity-80`}
              >
                {mic === 'recording' ? <Stop size={64} /> : mic === 'transcribing' ? (
                  <span className="h-14 w-14 animate-spin rounded-full border-[6px] border-white/30 border-t-white" />
                ) : <Mic size={72} strokeWidth={1.8} />}
              </button>
            </div>
            <p className="mt-1 text-center text-[18px] font-bold" aria-live="polite">
              {mic === 'recording' ? <>{t('mic_listening', lang)} <span className="tabular-nums text-red-700">{mm}:{ss}</span></>
                : mic === 'transcribing' ? t('mic_transcribing', lang) : t('mic_tap', lang)}
            </p>
            {stt.state === 'loading' && (
              <div className="mt-3 w-full max-w-xs">
                <p className="mb-1 text-center text-[14px] text-muted">{t('mic_loading', lang)} {Math.round(stt.progress * 100)}%</p>
                <ProgressBar value={stt.progress} />
              </div>
            )}
            {mic === 'idle' && !transcript && <p className="mt-3 px-2 text-center text-[15px] italic text-muted">{t('capture_example', lang)}</p>}
          </div>
        )}

        {(mode === 'text' || (mode === 'voice' && (transcript || mic === 'transcribing'))) && (
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label htmlFor="transcript" className="text-[15px] font-bold text-muted">
                {mode === 'voice' ? t('transcript_label', lang) : t('mode_text', lang)}
              </label>
              {transcript && (
                <button type="button" onClick={() => setTranscript('')} className="min-h-9 rounded-full px-3 text-[14px] font-bold text-muted active:bg-sand">
                  {t('clear', lang)}
                </button>
              )}
            </div>
            <div>
              <textarea
                id="transcript"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={mode === 'text' ? 5 : 4}
                placeholder={t('text_placeholder', lang)}
                className="w-full resize-none rounded-2xl border-2 border-line bg-white p-4 text-[18px] leading-snug outline-none focus:border-brand"
              />
            </div>
          </div>
        )}

        {mode === 'text' && !transcript && (
          <div className="mt-3">
            <p className="mb-2 flex items-center gap-1.5 text-[14px] font-bold text-muted"><Sparkle size={16} />Ejemplos para probar</p>
            <div className="flex flex-col gap-2">
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" onClick={() => setTranscript(ex)} className="rounded-2xl border border-line bg-white px-4 py-3 text-left text-[15px] active:bg-sand">
                  “{ex}”
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'buttons' && (
          <div className="mt-5 flex flex-col gap-4">
            <Card>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1">
                  <label htmlFor="age" className="mb-1 block text-[15px] font-bold text-muted">{t('age', lang)}</label>
                  <input
                    id="age" inputMode="decimal" value={ageVal}
                    onChange={(e) => setAgeVal(e.target.value.replace(/[^\d.,]/g, ''))}
                    className="h-14 w-full rounded-xl border-2 border-line px-4 text-[20px] font-bold outline-none focus:border-brand"
                    placeholder="0"
                  />
                </div>
                <div className="flex rounded-xl bg-sand p-1">
                  {(['years', 'months'] as const).map((u) => (
                    <button key={u} type="button" onClick={() => setAgeUnit(u)} aria-pressed={ageUnit === u}
                      className={`h-12 rounded-lg px-3 text-[15px] font-bold ${ageUnit === u ? 'bg-white shadow-sm' : 'text-muted'}`}>
                      {u === 'years' ? t('age_years', lang) : t('age_months', lang)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                {(['F', 'M'] as const).map((s) => (
                  <button key={s} type="button" onClick={() => { setSexo(sexo === s ? undefined : s); if (s === 'M') setEmbarazada(false); }} aria-pressed={sexo === s}
                    className={`min-h-12 flex-1 rounded-xl border-2 text-[16px] font-bold ${sexo === s ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line'}`}>
                    {s === 'F' ? t('female', lang) : t('male', lang)}
                  </button>
                ))}
                {sexo === 'F' && (
                  <button type="button" onClick={() => setEmbarazada(!embarazada)} aria-pressed={embarazada}
                    className={`min-h-12 flex-1 rounded-xl border-2 text-[16px] font-bold ${embarazada ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line'}`}>
                    🤰 {t('pregnant', lang)}
                  </button>
                )}
              </div>
            </Card>

            <p className="text-[15px] font-bold text-muted">
              {t('chips_hint', lang)}{selected.size > 0 && <span className="text-brand"> · {t('chips_selected', lang, { n: selected.size })}</span>}
            </p>
            {groups.length === 0 && <p className="text-muted">{t('loading', lang)}</p>}
            {groups.map(([g, items]) => (
              <section key={g}>
                <h3 className="mb-2 text-[16px] font-extrabold">{GROUP_EMOJI[g] ?? '•'} {groupLabel(g)}</h3>
                <div className="flex flex-wrap gap-2">
                  {items.map(([k, v]) => {
                    const on = selected.has(k);
                    return (
                      <button key={k} type="button" onClick={() => toggle(k)} aria-pressed={on}
                        className={`min-h-14 rounded-2xl border-2 px-4 text-left text-[16px] font-semibold leading-tight ${on ? 'border-brand bg-brand text-white' : 'border-line bg-white'}`}>
                        {on && '✓ '}{lang === 'nah' && v.nah ? v.nah : v.es}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        <p className="mt-6 text-center text-[12px] text-muted">
          Actualizada el 4-oct-2026, después de la entrega del hackathon ·{' '}
          <a className="underline" href="https://github.com/HaDeZIB/pahtli/blob/main/CHANGELOG.md" target="_blank" rel="noopener">ver cambios</a>
        </p>

        {err && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-[15px] font-semibold text-red-800" role="alert">{err}</p>}
      </div>

      {/* Botón Evaluar fijo sobre la navegación */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 bg-gradient-to-t from-cream via-cream/95 to-transparent px-4 pb-3 pt-6">
        <div className="mx-auto max-w-xl">
          <Button className="h-16 w-full text-[20px]" disabled={!canEvaluate || busy || mic !== 'idle'} onClick={() => void evaluate()}>
            {busy ? <><span className="h-6 w-6 animate-spin rounded-full border-4 border-white/30 border-t-white" />{t('evaluating', lang)}</> : t('evaluate', lang)}
          </Button>
        </div>
      </div>
    </div>
  );
}
