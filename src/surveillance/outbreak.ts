import type { Syndrome, TriageLevel } from '../types';

/**
 * Alerta temprana sindrómica (heurística, NO definición oficial de brote).
 *
 * Inspirada en la vigilancia basada en indicadores de la OMS (EWAR) y en la
 * NOM-017-SSA2-2012 (brote = 2 o más casos asociados epidemiológicamente;
 * notificación inmediata). Ver docs/sync.md para fuentes y limitaciones.
 *
 * Regla: >= N casos del mismo síndrome en la misma comunidad dentro de una
 * ventana de 72 h (N = 3; 2 para diarrea con sangre y febril hemorrágico).
 * Además: >= 3 urgencias en la misma comunidad en la ventana, sin importar síndrome.
 * El nivel que cuenta es el FINAL: el que decidió la promotora (decision.final_level)
 * si existe; si no, el sugerido por el motor de reglas.
 */

/** Lo mínimo que necesita el detector (CaseRecord lo cumple). */
export interface SurveillanceCase {
  case_id: string;
  created_at: string;
  comunidad: string;
  sindrome?: Syndrome;
  result: { level: TriageLevel };
  /** Decisión humana (opcional): la promotora puede aceptar o cambiar el nivel. */
  decision?: { final_level?: string | null } | null;
}

const VALID_LEVELS: readonly TriageLevel[] = ['aqui', 'centro_hoy', 'urgencia'];

/** Nivel final de un caso: la decisión de la promotora manda sobre la sugerencia. */
export function effectiveLevel(c: { result: { level: TriageLevel }; decision?: { final_level?: string | null } | null }): TriageLevel {
  const f = c.decision?.final_level;
  return f && (VALID_LEVELS as readonly string[]).includes(f) ? (f as TriageLevel) : c.result?.level;
}

export interface OutbreakOptions {
  windowHours?: number;
  defaultThreshold?: number;
  thresholds?: Partial<Record<Syndrome, number>>;
  urgenciaThreshold?: number;
  /** Síndromes que no generan alerta por sí solos (demasiado inespecíficos). */
  ignore?: Syndrome[];
}

export interface OutbreakAlert {
  id: string;
  kind: 'sindrome' | 'urgencias';
  syndrome?: Syndrome;
  comunidad: string;
  count: number;
  threshold: number;
  window_hours: number;
  first_at: string;
  last_at: string;
  case_ids: string[];
  severity: 'alta' | 'media';
  mensaje: string;
}

export const DEFAULT_THRESHOLDS: Partial<Record<Syndrome, number>> = {
  diarrea_sangre: 2,
  febril_hemorragico: 2,
};

/** Síndromes de alto riesgo: una alerta de estos es severidad alta. */
const HIGH_RISK: Syndrome[] = ['diarrea_sangre', 'febril_hemorragico', 'neurologico'];

export const SYNDROME_LABELS: Record<Syndrome, string> = {
  respiratorio: 'Respiratorio',
  diarreico: 'Diarrea',
  diarrea_sangre: 'Diarrea con sangre',
  febril: 'Fiebre',
  febril_hemorragico: 'Fiebre con sangrado',
  obstetrico: 'Embarazo',
  neurologico: 'Neurológico',
  cardiovascular: 'Corazón / pecho',
  trauma: 'Lesión / trauma',
  otro: 'Otro',
};

export function normalizeComunidad(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function toMs(now: Date | number): number {
  return typeof now === 'number' ? now : now.getTime();
}

function mostCommon(names: string[]): string {
  const m = new Map<string, number>();
  for (const n of names) m.set(n, (m.get(n) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

export function detectOutbreaks(
  cases: SurveillanceCase[],
  now: Date | number = Date.now(),
  opts: OutbreakOptions = {},
): OutbreakAlert[] {
  const windowHours = opts.windowHours ?? 72;
  const defaultThreshold = opts.defaultThreshold ?? 3;
  const thresholds = { ...DEFAULT_THRESHOLDS, ...opts.thresholds };
  const urgThreshold = opts.urgenciaThreshold ?? 3;
  const ignore = new Set<Syndrome>(opts.ignore ?? ['otro']);
  const end = toMs(now);
  const start = end - windowHours * 3_600_000;
  const SKEW = 10 * 60_000; // tolera relojes de celular ligeramente adelantados

  // Dedupe por case_id y filtra a la ventana
  const seen = new Set<string>();
  const inWindow: (SurveillanceCase & { t: number; key: string })[] = [];
  for (const c of cases) {
    if (!c || seen.has(c.case_id)) continue;
    seen.add(c.case_id);
    const t = Date.parse(c.created_at);
    if (!Number.isFinite(t) || t <= start || t > end + SKEW) continue;
    const key = normalizeComunidad(c.comunidad);
    if (!key) continue;
    inWindow.push({ ...c, t, key });
  }

  const alerts: OutbreakAlert[] = [];
  const build = (
    kind: OutbreakAlert['kind'],
    group: typeof inWindow,
    threshold: number,
    syndrome?: Syndrome,
  ): OutbreakAlert => {
    const sorted = [...group].sort((a, b) => a.t - b.t);
    const comunidad = mostCommon(sorted.map((c) => c.comunidad.trim()));
    const count = sorted.length;
    const severity: OutbreakAlert['severity'] =
      kind === 'urgencias' || (syndrome && HIGH_RISK.includes(syndrome)) ? 'alta' : 'media';
    const mensaje =
      kind === 'urgencias'
        ? `${count} urgencias en ${comunidad} en las últimas ${windowHours} h`
        : `Posible brote: ${SYNDROME_LABELS[syndrome!].toLowerCase()} en ${comunidad} (${count} casos en ${windowHours} h)`;
    return {
      id: `${kind}:${syndrome ?? 'all'}:${sorted[0].key}`,
      kind,
      syndrome,
      comunidad,
      count,
      threshold,
      window_hours: windowHours,
      first_at: new Date(sorted[0].t).toISOString(),
      last_at: new Date(sorted[count - 1].t).toISOString(),
      case_ids: sorted.map((c) => c.case_id),
      severity,
      mensaje,
    };
  };

  // Por (comunidad, síndrome)
  const bySyn = new Map<string, typeof inWindow>();
  for (const c of inWindow) {
    const syn = c.sindrome ?? 'otro';
    if (ignore.has(syn)) continue;
    const k = `${c.key}|${syn}`;
    if (!bySyn.has(k)) bySyn.set(k, []);
    bySyn.get(k)!.push(c);
  }
  for (const [k, group] of bySyn) {
    const syn = k.split('|')[1] as Syndrome;
    const th = thresholds[syn] ?? defaultThreshold;
    if (group.length >= th) alerts.push(build('sindrome', group, th, syn));
  }

  // Racimo de urgencias por comunidad
  const byCom = new Map<string, typeof inWindow>();
  for (const c of inWindow) {
    if (effectiveLevel(c) !== 'urgencia') continue;
    if (!byCom.has(c.key)) byCom.set(c.key, []);
    byCom.get(c.key)!.push(c);
  }
  for (const group of byCom.values()) {
    if (group.length >= urgThreshold) alerts.push(build('urgencias', group, urgThreshold));
  }

  const sev = { alta: 0, media: 1 };
  return alerts.sort(
    (a, b) => sev[a.severity] - sev[b.severity] || b.count / b.threshold - a.count / a.threshold || b.last_at.localeCompare(a.last_at),
  );
}
