import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { CaseRecord, Syndrome, TriageLevel } from '../types';
import { db, getSettings, setSettings } from '../db/db';
import { syncNow } from '../db/sync';
import { LEVELS, levelLabel } from '../i18n/strings';
import { classifySyndrome } from '../triage/syndrome';
import { detectOutbreaks, effectiveLevel, SYNDROME_LABELS, type OutbreakAlert, type SurveillanceCase } from '../surveillance/outbreak';
import { mergeCases } from '../surveillance/merge';
import { COMMUNITIES, generateSeedCases, HEALTH_CENTER, isSeedCase, MAP_CENTER } from '../surveillance/seed';

const HOUR = 3_600_000;
const LEVEL_ORDER: TriageLevel[] = ['urgencia', 'centro_hoy', 'aqui'];
const SYNDROME_SET = new Set(Object.keys(SYNDROME_LABELS));

/** Campos opcionales de decisión humana / incertidumbre (los agrega otro módulo a CaseRecord). */
type DashCase = CaseRecord & {
  decision?: { final_level?: string; overridden?: boolean } | null;
  uncertain?: boolean;
};

/** Conteo grueso que devuelve /api/cases sin clave del tablero (sin registros individuales). */
interface Bucket {
  day: string;
  comunidad: string;
  syndrome: string | null;
  level: string;
  count: number;
}

type RemoteMode = 'records' | 'aggregate' | 'locked' | 'none';

/** Convierte conteos por día en casos aproximados (mediodía, hora del centro de México) para el detector. */
function bucketsToSurveillance(buckets: Bucket[], now: number): SurveillanceCase[] {
  const out: SurveillanceCase[] = [];
  for (const b of buckets) {
    const level = (LEVEL_ORDER as string[]).includes(b.level) ? (b.level as TriageLevel) : 'aqui';
    const syn = b.syndrome && SYNDROME_SET.has(b.syndrome) ? (b.syndrome as Syndrome) : 'otro';
    const noon = Date.parse(`${b.day}T12:00:00-06:00`);
    if (!Number.isFinite(noon)) continue;
    const t = new Date(Math.min(noon, now - 60_000)).toISOString();
    const n = Math.min(Math.max(0, Math.floor(b.count)), 500);
    for (let i = 0; i < n && out.length < 5000; i++) {
      out.push({ case_id: `agg:${b.day}:${b.comunidad}:${syn}:${level}:${i}`, created_at: t, comunidad: b.comunidad, sindrome: syn, result: { level } });
    }
  }
  return out;
}

function syndromeOf(c: CaseRecord): Syndrome {
  if (c.sindrome) return c.sindrome;
  try {
    return classifySyndrome(c.findings);
  } catch {
    return 'otro';
  }
}

function fmtTime(iso: string, now: number): string {
  const d = new Date(iso);
  const h = (now - d.getTime()) / HOUR;
  if (h < 1) return `hace ${Math.max(1, Math.round(h * 60))} min`;
  if (h < 24) return `hace ${Math.round(h)} h`;
  return d.toLocaleString('es-MX', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtEdad(m?: number): string {
  if (m == null) return '—';
  if (m < 24) return `${m} m`;
  return `${Math.floor(m / 12)} a`;
}

function startOfToday(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function useOnline() {
  const [on, setOn] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const u = () => setOn(navigator.onLine);
    window.addEventListener('online', u);
    window.addEventListener('offline', u);
    return () => {
      window.removeEventListener('online', u);
      window.removeEventListener('offline', u);
    };
  }, []);
  return on;
}

function Kpi({ label, value, sub, tone }: { label: string; value: number | string; sub?: string; tone?: 'red' | 'amber' }) {
  const color = tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700' : 'text-ink';
  return (
    <div className="rounded-2xl border border-line bg-white p-3 sm:p-4">
      <div className="text-[13px] font-semibold text-muted">{label}</div>
      <div className={`mt-1 text-3xl font-extrabold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[12px] text-muted">{sub}</div>}
    </div>
  );
}

function AlertCard({ a, now }: { a: OutbreakAlert & { fuente?: 'red' }; now: number }) {
  const high = a.severity === 'alta';
  return (
    <div className={`rounded-2xl border-2 p-4 ${high ? 'border-red-700 bg-red-50' : 'border-amber-500 bg-amber-50'}`} role="alert">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-black text-white ${high ? 'bg-red-700' : 'bg-amber-500'}`} aria-hidden="true">!</div>
        <div className="min-w-0">
          <div className={`text-[17px] font-extrabold leading-snug ${high ? 'text-red-900' : 'text-amber-900'}`}>
            {a.kind === 'urgencias' ? 'Racimo de urgencias' : `Posible brote: ${SYNDROME_LABELS[a.syndrome!].toLowerCase()}`}
          </div>
          <div className="mt-0.5 text-[15px] font-semibold text-ink">
            {a.comunidad} · {a.count} casos en {a.window_hours} h <span className="font-normal text-muted">(umbral {a.threshold})</span>
          </div>
          <div className="mt-1 text-[13px] text-muted">
            {a.fuente === 'red'
              ? 'Conteo de la red por día (sin registros individuales); las horas son aproximadas.'
              : <>Primer caso {fmtTime(a.first_at, now)} · último {fmtTime(a.last_at, now)}</>}
          </div>
          <div className="mt-2 text-[13px] text-ink">
            Sugerencia: verificar los casos y notificar a la Jurisdicción Sanitaria (NOM-017-SSA2-2012 pide avisar brotes de inmediato).
          </div>
        </div>
      </div>
    </div>
  );
}

/** Referencia estable: `?? []` crearía un arreglo nuevo en cada render y rompería los useMemo. */
const NO_CASES: CaseRecord[] = [];

export default function Dashboard() {
  const online = useOnline();
  const [now, setNow] = useState(() => Date.now());
  const [remote, setRemote] = useState<CaseRecord[]>([]);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [remoteMode, setRemoteMode] = useState<RemoteMode>('none');
  const [remoteSource, setRemoteSource] = useState<string>('—');
  const [dashKey, setDashKey] = useState<string | null>(null); // null = aún no se lee
  const [keyDraft, setKeyDraft] = useState('');
  const [tokenDraft, setTokenDraft] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [accessMsg, setAccessMsg] = useState<string | null>(null);
  const [showSeed, setShowSeed] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<'todos' | TriageLevel>('todos');

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const local = useLiveQuery(async () => {
    try {
      const rows = await db.cases.toArray();
      return rows.map(({ sync_state: _s, ...c }) => (void _s, c as CaseRecord));
    } catch {
      return NO_CASES;
    }
  }, []) ?? NO_CASES;
  const pending = local.filter((c) => !c.synced).length;

  // Claves guardadas en este equipo (Dexie). Nunca se muestran ni se sincronizan.
  useEffect(() => {
    getSettings()
      .then((s) => {
        setDashKey(s.dashboardKey ?? '');
        setHasToken(!!s.syncToken);
      })
      .catch(() => setDashKey(''));
  }, []);

  // Casos de toda la red (si hay señal y Supabase está configurado).
  // Con clave del tablero: registros individuales. Sin clave: solo conteos por día.
  useEffect(() => {
    if (!online || dashKey === null) return;
    let alive = true;
    const load = async () => {
      try {
        const headers: Record<string, string> = {};
        if (dashKey) headers['x-pahtli-key'] = dashKey;
        const r = await fetch('/api/cases?days=14', { cache: 'no-store', headers });
        if (r.status === 401) {
          if (!alive) return;
          setRemote([]);
          setBuckets([]);
          setRemoteMode('locked');
          setRemoteSource(dashKey ? 'clave incorrecta' : 'requiere clave');
          return;
        }
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as { mode?: string; cases?: CaseRecord[]; buckets?: Bucket[]; source?: string };
        if (!alive) return;
        if (j.mode === 'aggregate') {
          setRemote([]);
          setBuckets(Array.isArray(j.buckets) ? j.buckets.filter((b) => b && typeof b.count === 'number') : []);
          setRemoteMode('aggregate');
        } else {
          setRemote(Array.isArray(j.cases) ? j.cases : []);
          setBuckets([]);
          setRemoteMode('records');
        }
        setRemoteSource(j.source ?? '—');
      } catch {
        if (alive) setRemoteSource('sin conexión al servidor');
      }
    };
    void load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [online, dashKey]);

  // La demo se genera una vez al abrir, relativa a la hora actual
  const seed = useMemo(() => generateSeedCases(), []);

  const all = useMemo(() => {
    const cases = mergeCases(local, remote, showSeed ? seed : []);
    return cases
      .filter((c) => now - Date.parse(c.created_at) <= 7 * 24 * HOUR)
      .map((c) => ({ ...(c as DashCase), sindrome: syndromeOf(c), level: effectiveLevel(c as DashCase) }));
  }, [local, remote, seed, showSeed, now]);

  // Conteos de la red (modo agregado), últimos 7 días
  const recentBuckets = useMemo(() => {
    const cutoff = now - 7 * 24 * HOUR;
    return buckets.filter((b) => Date.parse(`${b.day}T23:59:59-06:00`) >= cutoff);
  }, [buckets, now]);

  // Alertas: casos locales/demo/red (registros) + red agregada. Mismo id => se queda la de mayor conteo.
  const alerts = useMemo(() => {
    const own = detectOutbreaks(all, now);
    const net = recentBuckets.length ? detectOutbreaks(bucketsToSurveillance(recentBuckets, now), now).map((a) => ({ ...a, case_ids: [], fuente: 'red' as const })) : [];
    const byId = new Map<string, OutbreakAlert & { fuente?: 'red' }>();
    for (const a of [...own, ...net]) {
      const prev = byId.get(a.id);
      if (!prev || a.count > prev.count) byId.set(a.id, a);
    }
    return [...byId.values()].sort((a, b) => (a.severity === b.severity ? b.count / b.threshold - a.count / a.threshold : a.severity === 'alta' ? -1 : 1));
  }, [all, recentBuckets, now]);

  const netByCommunity = useMemo(() => {
    const m = new Map<string, { total: number; urgencia: number; syn: Map<string, number> }>();
    for (const b of recentBuckets) {
      if (!m.has(b.comunidad)) m.set(b.comunidad, { total: 0, urgencia: 0, syn: new Map() });
      const e = m.get(b.comunidad)!;
      e.total += b.count;
      if (b.level === 'urgencia') e.urgencia += b.count;
      const s = b.syndrome ?? 'otro';
      e.syn.set(s, (e.syn.get(s) ?? 0) + b.count);
    }
    return [...m.entries()]
      .map(([comunidad, e]) => ({ comunidad, ...e, top: [...e.syn.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2) }))
      .sort((a, b) => b.total - a.total);
  }, [recentBuckets]);

  const saveAccess = async (kind: 'key' | 'token', value: string | undefined) => {
    try {
      if (kind === 'key') {
        await setSettings({ dashboardKey: value });
        setDashKey(value ?? '');
        setKeyDraft('');
        setAccessMsg(value ? 'Clave del tablero guardada en este equipo.' : 'Clave del tablero borrada de este equipo.');
      } else {
        await setSettings({ syncToken: value });
        setHasToken(!!value);
        setTokenDraft('');
        setAccessMsg(value ? 'Token de inscripción guardado en este equipo.' : 'Token de inscripción borrado de este equipo.');
      }
    } catch {
      setAccessMsg('No se pudo guardar en este equipo.');
    }
  };
  const alertIds = useMemo(() => new Set(alerts.flatMap((a) => a.case_ids)), [alerts]);

  const today0 = startOfToday(now);
  const hoy = all.filter((c) => Date.parse(c.created_at) >= today0).length;
  const urg = all.filter((c) => c.level === 'urgencia').length;
  const urg72 = all.filter((c) => c.level === 'urgencia' && now - Date.parse(c.created_at) <= 72 * HOUR).length;

  const bySyndrome = useMemo(() => {
    const m = new Map<Syndrome, Record<TriageLevel, number>>();
    for (const c of all) {
      const s = c.sindrome!;
      if (!m.has(s)) m.set(s, { aqui: 0, centro_hoy: 0, urgencia: 0 });
      m.get(s)![c.level]++;
    }
    return [...m.entries()]
      .map(([s, v]) => ({ s, v, total: v.aqui + v.centro_hoy + v.urgencia }))
      .sort((a, b) => b.total - a.total);
  }, [all]);
  const maxSyn = Math.max(1, ...bySyndrome.map((x) => x.total));

  const byCommunity = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of all) m.set(c.comunidad, (m.get(c.comunidad) ?? 0) + 1);
    return m;
  }, [all]);

  const tableRows = all.filter((c) => filter === 'todos' || c.level === filter).slice(0, 60);
  // Urgencias encima en el mapa
  const mapCases = [...all]
    .filter((c) => typeof c.lat === 'number' && typeof c.lng === 'number')
    .sort((a, b) => LEVEL_ORDER.indexOf(b.level) - LEVEL_ORDER.indexOf(a.level));

  const doSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await syncNow();
      setSyncMsg(
        !r.ok && r.error === 'no_inscrito' ? 'El servidor no reconoce este celular: falta o es incorrecto el token de inscripción (ver "Acceso al servidor").' :
        !r.ok ? 'No se pudo sincronizar; se reintentará solo.' : r.sent === 0 ? 'No hay casos pendientes.' : `${r.sent} caso(s) sincronizado(s)${r.demo ? ' (modo demo: el servidor no guarda)' : ''}.`,
      );
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-dvh bg-cream text-ink">
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-4 sm:px-6">
        <header className="flex flex-wrap items-center gap-3">
          <a href="#/" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full active:bg-sand" aria-label="Volver">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          </a>
          <div className="min-w-0 flex-1 basis-60">
            <h1 className="text-[22px] font-extrabold leading-tight tracking-tight sm:text-[26px]">Tablero del Centro de Salud</h1>
            <div className="text-[13px] text-muted">Cuetzalan del Progreso, Sierra Nororiental de Puebla · últimos 7 días</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold ${online ? 'bg-brand-soft text-brand-dark' : 'bg-stone-200 text-stone-700'}`}>
              <span className={`h-2 w-2 rounded-full ${online ? 'bg-brand' : 'bg-stone-500'}`} />
              {online ? 'En línea' : 'Sin internet'}
            </span>
            <button
              type="button"
              onClick={doSync}
              disabled={syncing || !online}
              className="min-h-11 rounded-xl bg-brand px-4 text-[15px] font-bold text-white disabled:bg-stone-300 disabled:text-stone-600"
            >
              {syncing ? 'Sincronizando…' : 'Sincronizar'}
            </button>
          </div>
        </header>
        {syncMsg && <div className="mt-2 text-[13px] text-muted" aria-live="polite">{syncMsg}</div>}

        <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Indicadores">
          <Kpi label="Casos hoy" value={hoy} />
          <Kpi label="Casos en 7 días" value={all.length} sub={`${byCommunity.size} comunidades`} />
          <Kpi label="Urgencias (7 días)" value={urg} sub={`${urg72} en las últimas 72 h`} tone={urg ? 'red' : undefined} />
          <Kpi label="Pendientes de sincronizar" value={pending} sub="en este celular" tone={pending ? 'amber' : undefined} />
        </section>

        <section className="mt-4" aria-label="Alertas">
          <h2 className="mb-2 text-[17px] font-extrabold">Alertas tempranas</h2>
          {alerts.length ? (
            <div className="grid gap-3 md:grid-cols-2">{alerts.map((a) => <AlertCard key={a.id} a={a} now={now} />)}</div>
          ) : (
            <div className="rounded-2xl border border-line bg-white p-4 text-[15px] text-muted">Sin alertas en las últimas 72 h.</div>
          )}
          <p className="mt-2 text-[12px] leading-snug text-muted">
            Heurística de alerta temprana (≥3 casos del mismo síndrome en una comunidad en 72 h; ≥2 si es diarrea con sangre o fiebre con sangrado). No es una definición oficial de brote: requiere verificación por epidemiología.
          </p>
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-5">
          <section className="overflow-hidden rounded-2xl border border-line bg-white lg:col-span-3" aria-label="Mapa">
            <div className="h-[320px] sm:h-[420px]">
              <MapContainer center={MAP_CENTER} zoom={12} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <CircleMarker center={[HEALTH_CENTER.lat, HEALTH_CENTER.lng]} radius={11} pathOptions={{ color: '#1c1917', weight: 3, fillColor: '#ffffff', fillOpacity: 1 }}>
                  <Tooltip direction="top">{HEALTH_CENTER.nombre} · centro de salud</Tooltip>
                </CircleMarker>
                {COMMUNITIES.map((c) => (
                  <CircleMarker key={c.id} center={[c.lat, c.lng]} radius={4} pathOptions={{ color: '#57534e', weight: 1, fillOpacity: 0 }}>
                    <Tooltip permanent direction="bottom" offset={[0, 6]} className="!text-[11px]">{c.nombre}</Tooltip>
                  </CircleMarker>
                ))}
                {mapCases.map((c) => {
                  const m = LEVELS[c.level];
                  const inAlert = alertIds.has(c.case_id);
                  return (
                    <CircleMarker
                      key={c.case_id}
                      center={[c.lat!, c.lng!]}
                      radius={c.level === 'urgencia' ? 8 : 6}
                      pathOptions={{ color: inAlert ? '#7f1d1d' : '#ffffff', weight: inAlert ? 3 : 1.5, fillColor: m.bg, fillOpacity: 0.9 }}
                    >
                      <Popup>
                        <strong>{levelLabel(c.level)}</strong> · {SYNDROME_LABELS[c.sindrome!]}
                        <br />
                        {c.comunidad} · {fmtEdad(c.findings.edad_meses)} · {fmtTime(c.created_at, now)}
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-line px-3 py-2 text-[12px] text-muted">
              {LEVEL_ORDER.map((l) => (
                <span key={l} className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full" style={{ background: LEVELS[l].bg }} />
                  {levelLabel(l, 'es', true)}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-[3px] border-red-900" />en alerta</span>
              {!online && <span className="ml-auto">Mapa base requiere internet; los puntos sí se muestran.</span>}
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-white p-4 lg:col-span-2" aria-label="Casos por síndrome">
            <h2 className="mb-3 text-[17px] font-extrabold">Casos por síndrome</h2>
            <ul className="space-y-2.5">
              {bySyndrome.map(({ s, v, total }) => (
                <li key={s}>
                  <div className="flex justify-between text-[14px]">
                    <span className="font-semibold">{SYNDROME_LABELS[s]}</span>
                    <span className="tabular-nums text-muted">{total}</span>
                  </div>
                  <div className="mt-1 flex h-3 overflow-hidden rounded-full bg-sand" style={{ width: `${(total / maxSyn) * 100}%`, minWidth: 8 }}>
                    {LEVEL_ORDER.map((l) => v[l] > 0 && <div key={l} style={{ width: `${(v[l] / total) * 100}%`, background: LEVELS[l].bg }} title={`${levelLabel(l)}: ${v[l]}`} />)}
                  </div>
                </li>
              ))}
              {!bySyndrome.length && <li className="text-[14px] text-muted">Sin casos.</li>}
            </ul>
          </section>
        </div>

        {(remoteMode === 'aggregate' || remoteMode === 'locked') && (
          <section className="mt-4 rounded-2xl border border-line bg-white p-4" aria-label="Resumen de la red">
            <h2 className="text-[17px] font-extrabold">Resumen de la red (7 días)</h2>
            {remoteMode === 'locked' ? (
              <p className="mt-1 text-[14px] text-muted">
                El servidor pide la clave del tablero. Mientras tanto se muestran solo los casos de este equipo y los de demostración.
              </p>
            ) : (
              <>
                <p className="mt-1 text-[13px] text-muted">
                  Este servidor no tiene clave del tablero configurada, así que solo comparte conteos por día, comunidad, síndrome y nivel: sin edad, sexo, ubicación ni hora de cada caso.
                  Estos conteos pueden incluir casos que ya aparecen abajo como "Este celular".
                </p>
                {netByCommunity.length ? (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[420px] text-left text-[14px]">
                      <thead className="border-y border-line bg-sand/60 text-[12px] uppercase tracking-wide text-muted">
                        <tr>
                          <th className="px-3 py-2 font-bold">Comunidad</th>
                          <th className="px-2 py-2 font-bold">Casos</th>
                          <th className="px-2 py-2 font-bold">Urgencias</th>
                          <th className="px-3 py-2 font-bold">Síndromes principales</th>
                        </tr>
                      </thead>
                      <tbody>
                        {netByCommunity.map((r) => (
                          <tr key={r.comunidad} className="border-b border-line/70">
                            <td className="px-3 py-2 font-semibold">{r.comunidad}</td>
                            <td className="px-2 py-2 tabular-nums">{r.total}</td>
                            <td className={`px-2 py-2 tabular-nums ${r.urgencia ? 'font-bold text-red-700' : ''}`}>{r.urgencia}</td>
                            <td className="px-3 py-2 text-muted">
                              {r.top.map(([syn, n]) => `${SYNDROME_LABELS[syn as Syndrome] ?? syn} (${n})`).join(' · ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-2 text-[14px] text-muted">Sin conteos de la red.</p>
                )}
              </>
            )}
          </section>
        )}

        <section className="mt-4 rounded-2xl border border-line bg-white" aria-label="Casos recientes">
          <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
            <h2 className="mr-auto text-[17px] font-extrabold">Casos recientes</h2>
            {(['todos', ...LEVEL_ORDER] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`min-h-9 rounded-full px-3 text-[13px] font-bold ${filter === f ? 'bg-ink text-white' : 'bg-sand text-ink'}`}
              >
                {f === 'todos' ? 'Todos' : levelLabel(f, 'es', true)}
              </button>
            ))}
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[14px]">
              <thead className="border-y border-line bg-sand/60 text-[12px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2 font-bold">Cuándo</th>
                  <th className="px-2 py-2 font-bold">Comunidad</th>
                  <th className="px-2 py-2 font-bold">Edad</th>
                  <th className="px-2 py-2 font-bold">Síndrome</th>
                  <th className="px-2 py-2 font-bold">Nivel</th>
                  <th className="px-4 py-2 font-bold">Origen</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((c) => {
                  const m = LEVELS[c.level];
                  return (
                    <tr key={c.case_id} className={`border-b border-line/70 ${alertIds.has(c.case_id) ? 'bg-red-50' : ''}`}>
                      <td className="whitespace-nowrap px-4 py-2 text-muted">{fmtTime(c.created_at, now)}</td>
                      <td className="px-2 py-2 font-semibold">{c.comunidad}</td>
                      <td className="px-2 py-2 tabular-nums">{fmtEdad(c.findings.edad_meses)}{c.findings.embarazada ? ' · emb.' : ''}</td>
                      <td className="px-2 py-2">{SYNDROME_LABELS[c.sindrome!]}</td>
                      <td className="px-2 py-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-bold" style={{ background: m.soft, color: m.softFg }}>
                          <span className="h-2 w-2 rounded-full" style={{ background: m.bg }} />
                          {levelLabel(c.level, 'es', true)}
                          {c.result.escalated_by_model ? ' ↑IA' : ''}
                        </span>
                        {c.decision?.overridden && (
                          <span className="ml-1 text-[11px] font-semibold text-muted" title={`Sugerido: ${levelLabel(c.result.level, 'es', true)}`}>
                            cambió la promotora
                          </span>
                        )}
                        {c.uncertain && <span className="ml-1 text-[11px] font-semibold text-muted">· datos dudosos</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-[12px] text-muted">
                        {isSeedCase(c.case_id) ? 'Demo' : c.synced ? 'Sincronizado' : 'Este celular · pendiente'}
                      </td>
                    </tr>
                  );
                })}
                {!tableRows.length && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">Sin casos.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="mt-4 flex flex-col gap-2 text-[12px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={showSeed} onChange={(e) => setShowSeed(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
            Incluir datos de demostración (no son pacientes reales)
          </label>
          <span>
            Locales: {local.length} · Red: {remoteMode === 'aggregate' ? `${recentBuckets.reduce((n, b) => n + b.count, 0)} en conteos` : remote.length} ({remoteSource}) · Sin nombres de pacientes: privacidad por diseño
          </span>
        </footer>

        <details className="mt-3 rounded-2xl border border-line bg-white p-4 text-[14px]">
          <summary className="cursor-pointer font-bold">Acceso al servidor</summary>
          <p className="mt-2 text-[13px] text-muted">
            Las claves se guardan solo en este equipo y nunca se muestran. Sin clave del tablero se ven conteos agregados de la red; con clave, los casos (sin transcripción ni nombres).
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (keyDraft.trim()) void saveAccess('key', keyDraft.trim());
              }}
            >
              <label htmlFor="dash-key" className="font-semibold">
                Clave del tablero {dashKey ? <span className="font-normal text-brand-dark">· guardada</span> : null}
              </label>
              <input
                id="dash-key"
                type="password"
                autoComplete="off"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                className="min-h-11 rounded-xl border border-line px-3"
                placeholder={dashKey ? '••••••••' : 'Personal de la Jurisdicción'}
              />
              <div className="flex gap-2">
                <button type="submit" disabled={!keyDraft.trim()} className="min-h-11 rounded-xl bg-ink px-4 font-bold text-white disabled:bg-stone-300 disabled:text-stone-600">Guardar</button>
                {dashKey ? (
                  <button type="button" onClick={() => void saveAccess('key', undefined)} className="min-h-11 rounded-xl bg-sand px-4 font-bold text-ink">Borrar</button>
                ) : null}
              </div>
            </form>
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (tokenDraft.trim()) void saveAccess('token', tokenDraft.trim());
              }}
            >
              <label htmlFor="sync-token" className="font-semibold">
                Token de inscripción del celular {hasToken ? <span className="font-normal text-brand-dark">· guardado</span> : null}
              </label>
              <input
                id="sync-token"
                type="password"
                autoComplete="off"
                value={tokenDraft}
                onChange={(e) => setTokenDraft(e.target.value)}
                className="min-h-11 rounded-xl border border-line px-3"
                placeholder={hasToken ? '••••••••' : 'Lo entrega la Jurisdicción'}
              />
              <div className="flex gap-2">
                <button type="submit" disabled={!tokenDraft.trim()} className="min-h-11 rounded-xl bg-ink px-4 font-bold text-white disabled:bg-stone-300 disabled:text-stone-600">Guardar</button>
                {hasToken ? (
                  <button type="button" onClick={() => void saveAccess('token', undefined)} className="min-h-11 rounded-xl bg-sand px-4 font-bold text-ink">Borrar</button>
                ) : null}
              </div>
            </form>
          </div>
          {accessMsg && <p className="mt-2 text-[13px] text-muted" aria-live="polite">{accessMsg}</p>}
        </details>
      </div>
    </div>
  );
}
