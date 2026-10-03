import { Component, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { TriageLevel } from '../types';
import { LEVELS, levelLabel, t } from '../i18n/strings';
import { useApp } from './AppContext';
import { LogoMark } from './Brand';
import { Chart, Gear, List, Mic } from './Icons';
import { go, type Route } from './router';

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'dark';
export function Button({ variant = 'primary', className = '', children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const v: Record<BtnVariant, string> = {
    primary: 'bg-brand text-white shadow-sm active:bg-brand-dark disabled:bg-stone-300 disabled:text-stone-600',
    secondary: 'bg-white text-ink border-2 border-line active:bg-sand disabled:opacity-50',
    ghost: 'bg-transparent text-brand-dark active:bg-brand-soft disabled:opacity-50',
    dark: 'bg-ink text-white active:bg-stone-700 disabled:opacity-50',
  };
  return (
    <button
      type="button"
      className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-5 text-[17px] font-bold transition-colors ${v[variant]} ${className}`}
      {...p}
    >
      {children}
    </button>
  );
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-3xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(28,25,23,0.04)] ${className}`}>{children}</div>;
}

export function ProgressBar({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'light' }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={`h-2.5 w-full overflow-hidden rounded-full ${tone === 'light' ? 'bg-white/30' : 'bg-sand'}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-[width] duration-300 ${tone === 'light' ? 'bg-white' : 'bg-brand'}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function LevelChip({ level, short = true }: { level: TriageLevel; short?: boolean }) {
  const { lang } = useApp();
  const m = LEVELS[level];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-bold" style={{ background: m.soft, color: m.softFg }}>
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: m.bg }} />
      {levelLabel(level, lang, short)}
    </span>
  );
}

export function TopBar({ title, onBack }: { title?: string; onBack?: () => void }) {
  const { lang, setLang } = useApp();
  return (
    <header className="flex items-center gap-3 px-4 pb-2 pt-3">
      {onBack ? (
        <button type="button" onClick={onBack} className="-ml-2 flex h-12 w-12 items-center justify-center rounded-full active:bg-sand" aria-label={t('back', lang)}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
      ) : (
        <LogoMark size={36} />
      )}
      <div className="min-w-0 flex-1">
        {title ? (
          <h1 className={`truncate font-extrabold tracking-tight ${onBack ? 'text-[19px]' : 'text-[22px]'}`}>{title}</h1>
        ) : (
          <div className="leading-tight">
            <div className="text-[22px] font-extrabold tracking-tight text-brand-dark">Pahtli</div>
            <div className="text-[13px] font-medium text-muted">{t('app_tagline', 'es')}</div>
          </div>
        )}
      </div>
      <div className="flex rounded-full border border-line bg-white p-1 text-[13px] font-bold" role="group" aria-label={t('config_language', lang)}>
        {(['es', 'nah'] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-pressed={lang === l}
            className={`min-h-9 rounded-full px-3 uppercase ${lang === l ? 'bg-brand text-white' : 'text-muted'}`}
          >
            {l}
          </button>
        ))}
      </div>
    </header>
  );
}

const NAV: { route: Route; key: 'nav_capture' | 'nav_history' | 'nav_dashboard' | 'nav_config'; Icon: typeof Mic }[] = [
  { route: 'capture', key: 'nav_capture', Icon: Mic },
  { route: 'historial', key: 'nav_history', Icon: List },
  { route: 'tablero', key: 'nav_dashboard', Icon: Chart },
  { route: 'config', key: 'nav_config', Icon: Gear },
];

export function BottomNav({ current }: { current: Route }) {
  const { lang } = useApp();
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur">
      <div className="mx-auto grid max-w-xl grid-cols-4">
        {NAV.map(({ route, key, Icon }) => {
          const active = current === route || (route === 'config' && current === 'acerca');
          return (
            <button
              key={route}
              type="button"
              onClick={() => go(route)}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-[12px] font-bold ${active ? 'text-brand' : 'text-muted'}`}
            >
              <Icon size={24} strokeWidth={active ? 2.4 : 2} />
              {t(key, lang)}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('[ui]', error); }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6">
          <Card>
            <p className="text-lg font-bold">{t('error_generic')}</p>
            <p className="mt-1 text-sm text-muted break-words">{this.state.error.message}</p>
            <Button className="mt-4 w-full" onClick={() => { this.setState({ error: null }); go('capture'); }}>{t('result_new')}</Button>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
