import { useCallback, useEffect, useState } from 'react';
import type { CaseRecord } from '../types';
import { useApp } from '../components/AppContext';
import { t } from '../i18n/strings';
import { listCases } from '../db/db';
import { syncNow } from '../db/sync';
import { findingsSummary } from '../components/findingsView';
import { CASES_CHANGED, notifyCasesChanged } from '../components/storage';
import { useOnline } from '../components/StatusBar';
import { Button, Card, LevelChip, TopBar } from '../components/ui';
import { Cloud, CloudUp, Pin } from '../components/Icons';

const fmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function History() {
  const { lang } = useApp();
  const online = useOnline();
  const [cases, setCases] = useState<CaseRecord[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    listCases()
      .then((c) => setCases([...c].sort((a, b) => b.created_at.localeCompare(a.created_at))))
      .catch((e) => { console.error('[history]', e); setCases([]); });
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(CASES_CHANGED, load);
    return () => window.removeEventListener(CASES_CHANGED, load);
  }, [load]);

  const pending = cases?.filter((c) => !c.synced).length ?? 0;

  async function doSync() {
    setSyncing(true);
    setMsg(null);
    try {
      const r = await syncNow();
      setMsg(r.ok ? (r.sent ? `${r.sent} enviados` : t('status_all_synced', lang)) : t('history_sync_offline', lang));
    } catch {
      setMsg(t('history_sync_offline', lang));
    } finally {
      setSyncing(false);
      notifyCasesChanged();
    }
  }

  return (
    <div className="pb-28">
      <TopBar title={t('history_title', lang)} />
      <div className="mx-auto max-w-xl px-4">
        {pending > 0 && (
          <Card className="mb-4 flex items-center gap-3">
            <CloudUp size={28} className="shrink-0 text-brand" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">{pending === 1 ? t('status_pending_one', lang) : t('status_pending_many', lang, { n: pending })}</p>
              {!online && <p className="text-[14px] text-muted">{t('history_sync_offline', lang)}</p>}
              {msg && <p className="text-[14px] text-muted">{msg}</p>}
            </div>
            <Button className="shrink-0 px-4" disabled={!online || syncing} onClick={() => void doSync()}>
              {syncing ? t('status_syncing', lang) : t('history_sync_now', lang)}
            </Button>
          </Card>
        )}

        {cases === null && <p className="text-muted">{t('loading', lang)}</p>}
        {cases?.length === 0 && (
          <Card className="py-10 text-center">
            <p className="text-[17px] text-muted">{t('history_empty', lang)}</p>
          </Card>
        )}

        <ul className="flex flex-col gap-3">
          {cases?.map((c) => {
            const summary = findingsSummary(c.findings, lang).slice(0, 5);
            return (
              <li key={c.case_id}>
                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <LevelChip level={c.result.level} />
                    <span className="ml-auto flex items-center gap-1 text-[13px] font-semibold text-muted">
                      {c.synced ? <><Cloud size={16} className="text-brand" />{t('history_synced', lang)}</> : <><CloudUp size={16} className="text-clay" />{t('history_pending', lang)}</>}
                    </span>
                  </div>
                  <p className="mt-2 text-[15px] font-semibold leading-snug">{summary.join(' · ') || c.transcript}</p>
                  <p className="mt-1 flex items-center gap-1 text-[13px] text-muted">
                    <span>{fmt.format(new Date(c.created_at))}</span>
                    <span>·</span>
                    <Pin size={13} /><span className="truncate">{c.comunidad}</span>
                    {c.sindrome && c.sindrome !== 'otro' && <><span>·</span><span className="truncate">{c.sindrome.replace(/_/g, ' ')}</span></>}
                  </p>
                </Card>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
