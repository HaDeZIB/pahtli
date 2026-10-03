import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n/strings';
import { useApp } from './AppContext';
import { Lungs } from './Icons';
import { Button } from './ui';

const DURATION = 60;

/**
 * Conteo de respiraciones durante 60 segundos completos (técnica AIEPI):
 * la promotora toca una vez por cada respiración.
 */
export function BreathCounter({ onDone, onManual }: { onDone: (rpm: number) => void; onManual?: () => void }) {
  const { lang } = useApp();
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [count, setCount] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [pulse, setPulse] = useState(0);
  const endAt = useRef(0);

  useEffect(() => {
    if (phase !== 'running') return;
    const id = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining <= 0) {
        setPhase('done');
        try { navigator.vibrate?.([120, 80, 120]); } catch { /* iOS no soporta vibrate */ }
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [phase]);

  const start = () => {
    setCount(0);
    setLeft(DURATION);
    endAt.current = Date.now() + DURATION * 1000;
    setPhase('running');
  };
  const tap = () => {
    if (phase !== 'running') return;
    setCount((c) => c + 1);
    setPulse((p) => p + 1);
    try { navigator.vibrate?.(15); } catch { /* ignore */ }
  };

  const progress = 1 - left / DURATION;
  const R = 46, C = 2 * Math.PI * R;

  return (
    <div className="flex flex-col items-center gap-4">
      {phase === 'idle' && (
        <>
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-soft text-brand"><Lungs size={40} /></div>
          <p className="text-center text-[17px] text-muted">{t('breath_instructions', lang)}</p>
          <Button className="w-full" onClick={start}>{t('breath_start', lang)}</Button>
          {onManual && <Button variant="ghost" className="w-full" onClick={onManual}>{t('breath_manual', lang)}</Button>}
        </>
      )}

      {phase === 'running' && (
        <>
          <div className="relative h-36 w-36">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="50" cy="50" r={R} fill="none" stroke="var(--color-sand)" strokeWidth="7" />
              <circle cx="50" cy="50" r={R} fill="none" stroke="var(--color-brand)" strokeWidth="7" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - progress)} style={{ transition: 'stroke-dashoffset 0.2s linear' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center" aria-live="polite">
              <span key={pulse} className="animate-pop text-[40px] font-extrabold tabular-nums leading-none">{count}</span>
              <span className="mt-1 text-[14px] font-semibold text-muted tabular-nums">{t('breath_time_left', lang, { s: left })}</span>
            </div>
          </div>
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); tap(); }}
            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tap(); } }}
            className="flex h-44 w-full select-none items-center justify-center rounded-3xl bg-brand text-[28px] font-extrabold text-white shadow-lg transition-transform active:scale-[0.98] active:bg-brand-dark"
          >
            {t('breath_tap', lang)}
          </button>
        </>
      )}

      {phase === 'done' && (
        <>
          <div className="text-center">
            <div className="text-[56px] font-extrabold tabular-nums leading-none text-brand-dark">{count}</div>
            <div className="mt-1 text-[17px] font-semibold text-muted">{t('breath_unit', lang)}</div>
          </div>
          <Button className="w-full" onClick={() => onDone(count)}>{t('breath_use', lang)}</Button>
          <Button variant="secondary" className="w-full" onClick={start}>{t('breath_restart', lang)}</Button>
        </>
      )}
    </div>
  );
}
