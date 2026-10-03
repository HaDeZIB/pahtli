import { useEffect, useState } from 'react';
import { useApp, type ModelStatus } from '../components/AppContext';
import { NAH_THANKS, t } from '../i18n/strings';
import { getSettings, setSettings } from '../db/db';
import { tierInfo } from '../ai/capability';
import { Button, Card, ProgressBar, TopBar } from '../components/ui';
import { Check, Pin, Plane } from '../components/Icons';
import { COMMUNITIES } from '../surveillance/seed';

type SettingsArg = Parameters<typeof setSettings>[0];

function fmtBytes(b?: number): string {
  if (!b) return '0 MB';
  if (b > 1e9) return `${(b / 1e9).toFixed(2)} GB`;
  return `${Math.round(b / 1e6)} MB`;
}

function ModelRow({ title, detail, status, onDownload }: { title: string; detail: string | null; status: ModelStatus; onDownload: () => void }) {
  const { lang } = useApp();
  return (
    <div className="py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-bold">{title}</p>
          <p className="truncate text-[13px] text-muted">{detail ?? t('config_not_available', lang)}</p>
        </div>
        {status.state === 'ready' ? (
          <span className="flex items-center gap-1 rounded-full bg-brand-soft px-3 py-1.5 text-[14px] font-bold text-brand-dark"><Check size={16} />{t('config_ready', lang)}</span>
        ) : status.state === 'unavailable' || !detail ? (
          <span className="text-[13px] font-semibold text-muted">—</span>
        ) : (
          <Button className="min-h-12 px-4 text-[15px]" disabled={status.state === 'loading'} onClick={onDownload}>
            {status.state === 'loading' ? `${Math.round(status.progress * 100)}%` : t('config_download', lang)}
          </Button>
        )}
      </div>
      {status.state === 'loading' && (
        <div className="mt-2">
          <ProgressBar value={status.progress} />
          {status.msg && <p className="mt-1 truncate text-[12px] text-muted">{status.msg}</p>}
        </div>
      )}
      {status.state === 'error' && <p className="mt-1 text-[13px] font-semibold text-red-800">{t('error_generic', lang)} {status.msg}</p>}
    </div>
  );
}

export default function Config() {
  const { lang, setLang, tier, stt, llm, ensureSTT, ensureLLM } = useApp();
  const [comunidad, setComunidad] = useState('');
  const [promotora, setPromotora] = useState('');
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [locating, setLocating] = useState(false);
  const [locErr, setLocErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [storage, setStorage] = useState<{ usage?: number; quota?: number; persisted?: boolean } | null>(null);

  useEffect(() => {
    getSettings().then((s) => {
      if (!s) return;
      setComunidad(s.comunidad ?? '');
      setPromotora(s.promotora ?? '');
      setLat(s.lat ?? undefined);
      setLng(s.lng ?? undefined);
    }).catch(() => {});
  }, []);

  const refreshStorage = async () => {
    try {
      const est = await navigator.storage?.estimate?.();
      const persisted = await navigator.storage?.persisted?.();
      setStorage({ usage: est?.usage, quota: est?.quota, persisted });
    } catch { setStorage(null); }
  };
  useEffect(() => { void refreshStorage(); }, [stt.state, llm.state]);

  const info = tier ? tierInfo(tier) : null;

  const locate = () => {
    if (!('geolocation' in navigator)) { setLocErr('Este celular no permite ubicación.'); return; }
    setLocating(true);
    setLocErr(null);
    navigator.geolocation.getCurrentPosition(
      (p) => { setLat(+p.coords.latitude.toFixed(4)); setLng(+p.coords.longitude.toFixed(4)); setLocating(false); },
      (e) => { setLocErr(e.code === e.PERMISSION_DENIED ? 'Sin permiso de ubicación.' : 'No se pudo obtener la ubicación.'); setLocating(false); },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    );
  };

  const save = async () => {
    try {
      await setSettings({ comunidad: comunidad.trim(), lat, lng, promotora: promotora.trim() } as SettingsArg);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error('[settings]', e); }
  };

  const download = async (which: 'stt' | 'llm') => {
    // Pedir almacenamiento persistente para que el navegador no borre los modelos.
    try { await navigator.storage?.persist?.(); } catch { /* ignore */ }
    if (which === 'stt') await ensureSTT(); else await ensureLLM();
    void refreshStorage();
  };

  return (
    <div className="pb-28">
      <TopBar title={t('config_title', lang)} />
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4">
        {/* Comunidad */}
        <Card>
          <label htmlFor="comunidad" className="block text-[15px] font-bold text-muted">{t('config_community', lang)}</label>
          <input id="comunidad" list="comunidades-demo" value={comunidad} placeholder={t('config_community_ph', lang)}
            onChange={(e) => {
              const v = e.target.value;
              setComunidad(v);
              // Comunidades del piloto (Cuetzalan): llenar coordenadas aproximadas si aún no hay ubicación.
              const c = COMMUNITIES.find((x) => x.nombre.toLowerCase() === v.trim().toLowerCase());
              if (c && (lat === undefined || lng === undefined)) { setLat(c.lat); setLng(c.lng); }
            }}
            className="mt-1 h-14 w-full rounded-xl border-2 border-line px-4 text-[18px] outline-none focus:border-brand" />
          <datalist id="comunidades-demo">
            {COMMUNITIES.map((c) => <option key={c.id} value={c.nombre} />)}
          </datalist>
          <label htmlFor="promotora" className="mt-3 block text-[15px] font-bold text-muted">{t('config_promotora', lang)}</label>
          <input id="promotora" value={promotora} onChange={(e) => setPromotora(e.target.value)} placeholder={t('config_promotora_ph', lang)}
            className="mt-1 h-14 w-full rounded-xl border-2 border-line px-4 text-[18px] outline-none focus:border-brand" />
          <p className="mt-3 text-[15px] font-bold text-muted">{t('config_location', lang)}</p>
          <div className="mt-1 flex items-center gap-3">
            <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[15px]">
              <Pin size={18} className="shrink-0 text-brand" />
              <span className="truncate tabular-nums">{lat !== undefined && lng !== undefined ? `${lat}, ${lng}` : t('config_location_none', lang)}</span>
            </span>
            <Button variant="secondary" className="min-h-12 px-4 text-[15px]" disabled={locating} onClick={locate}>
              {locating ? t('loading', lang) : t('config_location_get', lang)}
            </Button>
          </div>
          {locErr && <p className="mt-1 text-[13px] text-red-800">{locErr}</p>}
          <Button className="mt-4 w-full" onClick={() => void save()}>{saved ? <><Check size={20} />{t('config_saved', lang)}</> : t('config_save', lang)}</Button>
        </Card>

        {/* Modelos */}
        <Card>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[18px] font-extrabold">{t('config_models', lang)}</h2>
            <span className="rounded-full bg-sand px-3 py-1 text-[13px] font-bold">
              {t('config_tier', lang)} {tier ?? '…'}{info ? ` · ${info.label}` : ''}
            </span>
          </div>
          <p className="mt-1 text-[14px] text-muted">{t('config_models_hint', lang)}</p>
          <div className="mt-1 divide-y divide-line">
            <ModelRow title={t('config_stt', lang)} detail={info ? info.stt : null} status={stt} onDownload={() => void download('stt')} />
            <ModelRow title={t('config_llm', lang)} detail={info ? info.llm : null} status={llm} onDownload={() => void download('llm')} />
          </div>
          <p className="mt-2 text-[13px] text-muted">
            Sin IA, Pahtli sigue funcionando: entiende palabras clave y las reglas clínicas deciden igual.
          </p>
        </Card>

        {/* Almacenamiento */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-extrabold">{t('config_storage', lang)}</h2>
            <span className="text-[15px] font-bold tabular-nums">
              {storage ? `${fmtBytes(storage.usage)}${storage.quota ? ` / ${fmtBytes(storage.quota)}` : ''}` : '—'}
            </span>
          </div>
          {storage?.quota ? <div className="mt-2"><ProgressBar value={(storage.usage ?? 0) / storage.quota} /></div> : null}
          {storage?.persisted !== undefined && (
            <p className="mt-2 text-[13px] text-muted">{storage.persisted ? 'Almacenamiento protegido: el navegador no borrará los modelos.' : 'El navegador podría borrar los modelos si falta espacio. Instale Pahtli en la pantalla de inicio.'}</p>
          )}
        </Card>

        {/* Modo avión */}
        <div className="flex gap-3 rounded-3xl bg-ink p-4 text-white">
          <Plane size={28} className="shrink-0" />
          <p className="text-[15px] font-semibold">{t('config_airplane', lang)}</p>
        </div>

        {/* Idioma */}
        <Card>
          <h2 className="text-[16px] font-extrabold">{t('config_language', lang)}</h2>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(['es', 'nah'] as const).map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l}
                className={`min-h-14 rounded-2xl border-2 text-[16px] font-bold ${lang === l ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line'}`}>
                {l === 'es' ? 'Español' : 'Náhuatl'}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-muted">{t('config_nah_note', lang)}</p>
        </Card>

        <p className="pb-4 text-center text-[13px] text-muted">
          Pahtli · “pahtli” = medicina en náhuatl · {NAH_THANKS}
        </p>
      </div>
    </div>
  );
}
