import { useEffect, useState } from 'react';
import { useApp, type ModelStatus } from '../components/AppContext';
import { NAH_THANKS, t } from '../i18n/strings';
import { getSettings, pendingCount, setSettings } from '../db/db';
import { tierInfo } from '../ai/capability';
import { Button, Card, ProgressBar, TopBar } from '../components/ui';
import { go } from '../components/router';
import { Check, Info, Lock, Pin, Plane, Shield } from '../components/Icons';
import { COMMUNITIES } from '../surveillance/seed';
import { getCentroTel, setCentroTel } from '../components/storage';
import { clearPin, hasPin, isValidPin, pinSupported, setPin } from '../privacy/pin';
import { getRetentionDays, RETENTION_OPTIONS, setRetentionDays, wipeAllData } from '../privacy/retention';

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

/** Clave de inscripción (cabecera x-pahtli-device de /api/sync). Se guarda en Dexie; nunca se muestra ni se sincroniza. */
function SyncTokenCard() {
  const { lang } = useApp();
  const [has, setHas] = useState(false);
  const [draft, setDraft] = useState('');
  useEffect(() => { getSettings().then((s) => setHas(!!s.syncToken)).catch(() => {}); }, []);
  const save = async (v: string | undefined) => {
    try { await setSettings({ syncToken: v }); setHas(!!v); setDraft(''); } catch (e) { console.error('[settings]', e); }
  };
  return (
    <Card>
      <div className="flex items-center gap-3">
        <h2 className="min-w-0 flex-1 text-[16px] font-extrabold">{t('config_sync_title', lang)}</h2>
        {has && <span className="flex items-center gap-1 rounded-full bg-brand-soft px-3 py-1.5 text-[13px] font-bold text-brand-dark"><Check size={14} />{t('config_sync_on', lang)}</span>}
      </div>
      <p className="mt-1 text-[13px] text-muted">{t('config_sync_hint', lang)}</p>
      <form className="mt-2 flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) void save(draft.trim()); }}>
        <label htmlFor="sync-token" className="text-[13px] font-bold text-muted">{t('config_sync_token', lang)}</label>
        <input id="sync-token" type="password" autoComplete="off" value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-12 w-full rounded-xl border-2 border-line px-3 text-[16px] outline-none focus:border-brand" />
        <Button type="submit" variant="secondary" className="min-h-12 w-full text-[15px]" disabled={!draft.trim()}>{t('config_sync_save', lang)}</Button>
      </form>
      {has && (
        <button type="button" onClick={() => void save(undefined)} className="mt-1 min-h-11 text-[14px] font-bold text-muted underline">{t('config_sync_remove', lang)}</button>
      )}
    </Card>
  );
}

function PrivacyCard() {
  const { lang } = useApp();
  const [pinOn, setPinOn] = useState(() => hasPin());
  const [editing, setEditing] = useState(false);
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [pinErr, setPinErr] = useState<string | null>(null);
  const [retention, setRetention] = useState(() => getRetentionDays());
  const [tel, setTel] = useState(() => getCentroTel());
  const [wipeAsk, setWipeAsk] = useState(false);
  const [pending, setPending] = useState(0);
  const supported = pinSupported();

  const savePin = async () => {
    if (!isValidPin(p1)) { setPinErr(t('privacy_pin_new', lang)); return; }
    if (p1 !== p2) { setPinErr(t('privacy_pin_mismatch', lang)); return; }
    try {
      await setPin(p1);
      setPinOn(true); setEditing(false); setP1(''); setP2(''); setPinErr(null);
    } catch (e) { setPinErr(e instanceof Error ? e.message : t('error_generic', lang)); }
  };

  const askWipe = async () => {
    try { setPending(await pendingCount()); } catch { setPending(0); }
    setWipeAsk(true);
  };
  const doWipe = async () => {
    try {
      await wipeAllData();
      window.location.replace('#/');
      window.location.reload();
    } catch (e) { console.error('[wipe]', e); }
  };

  const pinInput = (id: string, v: string, set: (x: string) => void, label: string) => (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="block text-[13px] font-bold text-muted">{label}</label>
      <input id={id} type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={v}
        onChange={(e) => set(e.target.value.replace(/\D/g, '').slice(0, 4))}
        className="mt-1 h-14 w-full rounded-xl border-2 border-line px-4 text-center text-[24px] tracking-[0.5em] outline-none focus:border-brand" />
    </div>
  );

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-[18px] font-extrabold"><Shield size={20} />{t('privacy_title', lang)}</h2>

      {/* PIN */}
      <div className="mt-3 border-t border-line pt-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-bold"><Lock size={16} />{t('privacy_pin', lang)}</p>
            <p className="text-[13px] text-muted">{supported ? t('privacy_pin_hint', lang) : t('privacy_pin_unsupported', lang)}</p>
          </div>
          {pinOn && <span className="flex items-center gap-1 rounded-full bg-brand-soft px-3 py-1.5 text-[13px] font-bold text-brand-dark"><Check size={14} />{t('privacy_pin_on', lang)}</span>}
        </div>
        {supported && !editing && (
          <div className="mt-2 flex gap-2">
            <Button variant="secondary" className="min-h-12 flex-1 px-3 text-[15px]" onClick={() => { setEditing(true); setPinErr(null); }}>
              {pinOn ? t('privacy_pin_change', lang) : t('privacy_pin_set', lang)}
            </Button>
            {pinOn && (
              <Button variant="ghost" className="min-h-12 px-3 text-[15px]" onClick={() => { clearPin(); setPinOn(false); }}>{t('privacy_pin_remove', lang)}</Button>
            )}
          </div>
        )}
        {editing && (
          <form className="mt-2" onSubmit={(e) => { e.preventDefault(); void savePin(); }}>
            <div className="flex gap-2">
              {pinInput('pin1', p1, setP1, t('privacy_pin_new', lang))}
              {pinInput('pin2', p2, setP2, t('privacy_pin_repeat', lang))}
            </div>
            {pinErr && <p className="mt-1 text-[13px] font-semibold text-red-800" role="alert">{pinErr}</p>}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button variant="secondary" className="min-h-12 text-[15px]" onClick={() => { setEditing(false); setP1(''); setP2(''); setPinErr(null); }}>{t('hitl_cancel', lang)}</Button>
              <Button type="submit" className="min-h-12 text-[15px]" disabled={p1.length !== 4 || p2.length !== 4}>{t('config_save', lang)}</Button>
            </div>
          </form>
        )}
      </div>

      {/* Retención */}
      <div className="mt-3 border-t border-line pt-3">
        <p className="font-bold">{t('privacy_retention', lang)}</p>
        <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label={t('privacy_retention', lang)}>
          {RETENTION_OPTIONS.map((d) => (
            <button key={d} type="button" aria-pressed={retention === d} onClick={() => { setRetention(d); setRetentionDays(d); }}
              className={`min-h-12 rounded-xl border-2 text-[15px] font-bold ${retention === d ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line'}`}>
              {t('privacy_retention_days', lang, { n: d })}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[13px] text-muted">{t('privacy_retention_hint', lang)}</p>
      </div>

      {/* Teléfono del centro */}
      <div className="mt-3 border-t border-line pt-3">
        <label htmlFor="centro-tel" className="block font-bold">{t('privacy_centro_tel', lang)}</label>
        <input id="centro-tel" type="tel" inputMode="tel" value={tel} placeholder="233 000 0000"
          onChange={(e) => setTel(e.target.value)} onBlur={() => setCentroTel(tel)}
          className="mt-1 h-14 w-full rounded-xl border-2 border-line px-4 text-[18px] outline-none focus:border-brand" />
      </div>

      <p className="mt-3 rounded-xl bg-sand px-3 py-2 text-[13px]">{t('privacy_coords', lang)}</p>

      {/* Borrar todo */}
      <div className="mt-3 border-t border-line pt-3">
        {!wipeAsk ? (
          <Button variant="secondary" className="w-full border-red-200 text-red-800" onClick={() => void askWipe()}>{t('privacy_wipe', lang)}</Button>
        ) : (
          <div className="rounded-2xl bg-red-50 p-3" role="alertdialog" aria-label={t('privacy_wipe', lang)}>
            <p className="text-[15px] font-semibold text-red-900">{t('privacy_wipe_confirm', lang)}</p>
            {pending > 0 && <p className="mt-1 text-[14px] font-bold text-red-900">{pending === 1 ? t('privacy_wipe_pending_one', lang) : t('privacy_wipe_pending', lang, { n: pending })}</p>}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="secondary" className="min-h-12 text-[15px]" onClick={() => setWipeAsk(false)}>{t('hitl_cancel', lang)}</Button>
              <button type="button" onClick={() => void doWipe()} className="min-h-12 rounded-2xl bg-red-700 text-[15px] font-bold text-white active:bg-red-800">{t('privacy_wipe_yes', lang)}</button>
            </div>
          </div>
        )}
      </div>
    </Card>
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

        <SyncTokenCard />

        <PrivacyCard />

        <button type="button" onClick={() => go('acerca')} className="flex min-h-16 items-center gap-3 rounded-3xl border border-line bg-white px-4 text-left active:bg-sand">
          <Info size={24} className="shrink-0 text-brand" />
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-extrabold">{t('about_link', lang)}</span>
            <span className="block text-[13px] text-muted">Modelos, tamaño, qué hace y qué no, evaluación, privacidad y límites</span>
          </span>
          <span aria-hidden="true" className="text-[22px] text-muted">›</span>
        </button>

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
          <br />
          <a href="#/acerca" className="mt-1 inline-flex min-h-11 items-center font-bold text-brand-dark underline">{t('about_link', lang)}</a>
        </p>
      </div>
    </div>
  );
}
