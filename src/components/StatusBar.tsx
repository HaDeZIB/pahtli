import { useEffect, useState } from 'react';
import { pendingCount } from '../db/db';
import { startAutoSync } from '../db/sync';
import { t } from '../i18n/strings';
import { useApp } from './AppContext';
import { CASES_CHANGED } from './storage';
import { CloudUp, Plane, CheckCircle } from './Icons';
import { go } from './router';

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

export function usePending(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    const refresh = () => { pendingCount().then((c) => { if (alive) setN(c); }).catch(() => {}); };
    refresh();
    window.addEventListener(CASES_CHANGED, refresh);
    const id = window.setInterval(refresh, 15000);
    return () => { alive = false; window.removeEventListener(CASES_CHANGED, refresh); window.clearInterval(id); };
  }, []);
  return n;
}

/** Barra persistente: estado de conexión + casos por enviar. Arranca la sincronización automática. */
export function StatusBar() {
  const { lang } = useApp();
  const online = useOnline();
  const pending = usePending();

  useEffect(() => {
    let stop: (() => void) | undefined;
    try {
      stop = startAutoSync(() => window.dispatchEvent(new Event(CASES_CHANGED)));
    } catch (e) { console.error('[sync]', e); }
    return () => { stop?.(); };
  }, []);

  const pendingText = pending === 0
    ? t('status_all_synced', lang)
    : pending === 1 ? t('status_pending_one', lang) : t('status_pending_many', lang, { n: pending });

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2 px-4 py-2 text-[14px] font-semibold ${online ? 'bg-brand-soft text-brand-dark' : 'bg-ink text-white'}`}
    >
      {online ? (
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-brand" />{t('status_online', lang)}</span>
      ) : (
        <span className="flex min-w-0 items-center gap-1.5"><Plane size={16} /><span className="truncate">{t('status_offline', lang)}</span></span>
      )}
      <button
        type="button"
        onClick={() => go('historial')}
        aria-label={pendingText}
        title={pendingText}
        className={`ml-auto flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 ${pending ? (online ? 'bg-white/80' : 'bg-white/15') : ''}`}
      >
        {pending ? <CloudUp size={16} /> : <CheckCircle size={16} />}
        {pending > 0 && <span className="tabular-nums">{pending}</span>}
      </button>
    </div>
  );
}
