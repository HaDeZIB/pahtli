import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { hasPin, lockoutRemaining, shouldRelock, verifyPin } from '../privacy/pin';
import { wipeAllData } from '../privacy/retention';
import { t } from '../i18n/strings';
import { useApp } from './AppContext';
import { LogoMark } from './Brand';
import { Lock } from './Icons';

/** Evento para bloquear desde cualquier parte (p. ej. al poner un PIN nuevo no hace falta). */
export const LOCK_NOW = 'pahtli:lock-now';

function PinPad({ onUnlock }: { onUnlock: () => void }) {
  const { lang } = useApp();
  const [pin, setPin] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(() => Math.ceil(lockoutRemaining() / 1000));
  const [confirmWipe, setConfirmWipe] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setInterval(() => setWait(Math.ceil(lockoutRemaining() / 1000)), 500);
    return () => window.clearInterval(id);
  }, [wait]);

  const busyRef = useRef(false);
  const submit = useCallback(async (value: string) => {
    if (busyRef.current || value.length !== 4) return;
    busyRef.current = true;
    setBusy(true);
    const r = await verifyPin(value);
    busyRef.current = false;
    setBusy(false);
    if (r.ok) { onUnlock(); return; }
    setPin('');
    if (r.waitMs > 0) { setWait(Math.ceil(r.waitMs / 1000)); setErr(null); } else setErr(t('lock_wrong', lang));
    inputRef.current?.focus();
  }, [lang, onUnlock]);
  const submitRef = useRef(submit);
  useEffect(() => { submitRef.current = submit; }, [submit]);

  // Actualización funcional: toques rápidos no pierden dígitos. Al llegar a 4, se verifica una sola vez.
  const press = (d: string) => {
    if (wait > 0 || busyRef.current) return;
    setPin((p) => (p.length >= 4 ? p : p + d));
    setErr(null);
  };
  useEffect(() => { if (pin.length === 4) void submitRef.current(pin); }, [pin]);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-y-auto bg-cream px-4 py-8" role="dialog" aria-modal="true" aria-labelledby="lock-title">
      <LogoMark size={56} />
      <h1 id="lock-title" className="mt-4 flex items-center gap-2 text-[24px] font-extrabold"><Lock size={24} />{t('lock_title', lang)}</h1>
      <p className="mt-1 text-[16px] text-muted">{t('lock_hint', lang)}</p>
      <input
        ref={inputRef} type="password" inputMode="numeric" autoComplete="off" autoFocus maxLength={4} value={pin}
        aria-label={t('lock_hint', lang)}
        onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setErr(null); }}
        className="sr-only"
      />
      <div className="mt-5 flex gap-4" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => <span key={i} className={`h-4 w-4 rounded-full ${i < pin.length ? 'bg-ink' : 'border-2 border-stone-400'}`} />)}
      </div>
      <p className="mt-3 min-h-6 text-[15px] font-semibold text-red-800" role="alert">
        {wait > 0 ? t('lock_wait', lang, { s: wait }) : err}
      </p>
      <div className="mt-2 grid w-full max-w-xs grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} disabled={wait > 0 || busy}
            className="h-16 rounded-2xl bg-white text-[26px] font-bold shadow-sm active:bg-sand disabled:opacity-40">{d}</button>
        ))}
        <span />
        <button type="button" onClick={() => press('0')} disabled={wait > 0 || busy} className="h-16 rounded-2xl bg-white text-[26px] font-bold shadow-sm active:bg-sand disabled:opacity-40">0</button>
        <button type="button" onClick={() => setPin((p) => p.slice(0, -1))} aria-label={t('clear', lang)} className="h-16 rounded-2xl text-[22px] font-bold text-muted active:bg-sand">⌫</button>
      </div>

      <div className="mt-8 w-full max-w-xs text-center">
        {!confirmWipe ? (
          <button type="button" onClick={() => setConfirmWipe(true)} className="min-h-11 text-[14px] font-bold text-muted underline">{t('lock_wipe', lang)}</button>
        ) : (
          <div className="rounded-2xl bg-white p-4 text-left shadow-sm">
            <p className="text-[14px] font-semibold">{t('privacy_wipe_confirm', lang)}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmWipe(false)} className="min-h-12 rounded-xl border-2 border-line font-bold">{t('hitl_cancel', lang)}</button>
              <button type="button" onClick={() => { void wipeAllData().then(() => { window.location.replace('#/'); window.location.reload(); }); }}
                className="min-h-12 rounded-xl bg-red-700 font-bold text-white">{t('privacy_wipe_yes', lang)}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Bloqueo con PIN: al abrir la app y después de 5 minutos en segundo plano.
 * La app queda montada debajo (oculta) para no perder un caso a medias.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(() => hasPin());
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') { hiddenAt.current = Date.now(); return; }
      if (hasPin() && shouldRelock(hiddenAt.current)) setLocked(true);
      hiddenAt.current = null;
    };
    const onLock = () => { if (hasPin()) setLocked(true); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener(LOCK_NOW, onLock);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener(LOCK_NOW, onLock); };
  }, []);

  return (
    <>
      <div hidden={locked} aria-hidden={locked}>{children}</div>
      {locked && <PinPad onUnlock={() => setLocked(false)} />}
    </>
  );
}
