import { useEffect, useState } from 'react';
import type { Lang, TriageLevel } from '../types';
import { getSettings } from '../db/db';
import { loadFacilities } from '../referral/loadFacilities';
import { formatKm, referralFor, type FacilityWithDistance, type Referral as Ref } from '../referral/nearest';
import { t } from '../i18n/strings';
import { Clinic, Pin } from './Icons';

type State =
  | { kind: 'loading' }
  | { kind: 'no_location' }
  | { kind: 'error' }
  | { kind: 'ok'; ref: Ref };

function Row({ f, label }: { f: FacilityWithDistance; label: string }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <Clinic size={22} className="mt-0.5 shrink-0 text-brand" />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold uppercase tracking-wide text-muted">{label}</p>
        <p className="text-[17px] font-bold leading-snug">{f.nombre}</p>
        <p className="text-[13px] text-muted">{f.tipo} · {f.institucion} · {f.localidad}, {f.municipio}</p>
      </div>
      <span className="shrink-0 rounded-full bg-sand px-2.5 py-1 text-[14px] font-extrabold tabular-nums">{formatKm(f.km)}</span>
    </li>
  );
}

/** Centro o hospital más cercano (catálogo CLUES precacheado), según el nivel de triaje. Funciona sin internet. */
export function Referral({ level, lang }: { level: TriageLevel; lang: Lang }) {
  const [st, setSt] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getSettings();
        if (typeof s.lat !== 'number' || typeof s.lng !== 'number') { if (alive) setSt({ kind: 'no_location' }); return; }
        const fac = await loadFacilities();
        if (alive) setSt({ kind: 'ok', ref: referralFor(level, s.lat, s.lng, fac, 1) });
      } catch (e) {
        console.error('[referral]', e);
        if (alive) setSt({ kind: 'error' });
      }
    })();
    return () => { alive = false; };
  }, [level]);

  if (st.kind === 'loading' || st.kind === 'error') return null;
  if (level === 'aqui') return null; // se atiende en la comunidad: no saturar la pantalla

  return (
    <section className="mt-3 rounded-3xl bg-white p-5 text-ink" data-testid="referral">
      <h2 className="flex items-center gap-1.5 text-[14px] font-extrabold uppercase tracking-wider text-muted">
        <Pin size={16} />{t('referral_title', lang)}
      </h2>
      {st.kind === 'no_location' ? (
        <p className="mt-2 text-[15px]">{t('referral_no_location', lang)}</p>
      ) : st.ref.primary.length === 0 && st.ref.alternative.length === 0 ? (
        <p className="mt-2 text-[15px]">{t('referral_none', lang)}</p>
      ) : (
        <>
          <ul className="mt-1 divide-y divide-line">
            {st.ref.primary.map((f) => (
              <Row key={f.clues} f={f} label={t(level === 'urgencia' ? 'referral_hospital' : 'referral_center', lang)} />
            ))}
            {st.ref.alternative.map((f) => (
              <Row key={`alt-${f.clues}`} f={f} label={t(level === 'urgencia' ? 'referral_fallback' : 'referral_followup', lang)} />
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-muted">{t('referral_note', lang)}</p>
        </>
      )}
    </section>
  );
}
