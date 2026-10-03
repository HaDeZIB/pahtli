/**
 * Retención de datos en el celular.
 *  - Auto-borrado: al abrir la app se eliminan los casos YA ENVIADOS con más de N días (por defecto 30).
 *    Los casos sin enviar nunca se borran solos (se perderían para el centro de salud), ni los que
 *    "se enviaron" a un servidor de demostración que no guarda (sync_demo).
 *  - "Borrar todos los datos de este celular": casos, ajustes, PIN y preferencias. Los modelos de IA
 *    descargados (Cache Storage) se conservan: no contienen datos de pacientes y volver a bajarlos cuesta datos.
 */
import type { CaseRecord } from '../types';
import { db } from '../db/db';

const DAYS_KEY = 'pahtli:retention_days';
export const DEFAULT_RETENTION_DAYS = 30;
export const RETENTION_OPTIONS = [7, 30, 90] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Preferencias que sobreviven al borrado total: no son datos de pacientes. */
const KEEP_ON_WIPE = new Set(['pahtli:stt-downloaded', 'pahtli:llm-downloaded', 'pahtli:lang']);

export function getRetentionDays(): number {
  try {
    const n = Number(localStorage.getItem(DAYS_KEY));
    return Number.isFinite(n) && n > 0 ? Math.round(n) : DEFAULT_RETENTION_DAYS;
  } catch { return DEFAULT_RETENTION_DAYS; }
}

export function setRetentionDays(days: number): void {
  try { localStorage.setItem(DAYS_KEY, String(Math.max(1, Math.round(days)))); } catch { /* ignore */ }
}

/** Casos que el auto-borrado eliminaría: enviados y más viejos que `days`. Puro, para pruebas. */
export function selectExpired<T extends Pick<CaseRecord, 'case_id' | 'created_at' | 'synced'> & { sync_demo?: boolean }>(cases: readonly T[], days: number, now = Date.now()): T[] {
  if (!(days > 0)) return [];
  const cutoff = now - days * DAY_MS;
  // sync_demo = el servidor de demostración respondió "aceptado" pero NO guardó: esos casos solo existen aquí.
  return cases.filter((c) => c.synced === true && c.sync_demo !== true && Date.parse(c.created_at) < cutoff);
}

/** Borra del celular los casos enviados con más de `days` días. Devuelve cuántos borró. */
export async function purgeExpired(days = getRetentionDays(), now = Date.now()): Promise<number> {
  const synced = await db.cases.where('sync_state').equals(1).toArray();
  const ids = selectExpired(synced, days, now).map((c) => c.case_id);
  if (ids.length) await db.cases.bulkDelete(ids);
  return ids.length;
}

/** Borra todos los datos de Pahtli en este celular (casos, ajustes, PIN, preferencias). */
export async function wipeAllData(): Promise<void> {
  await db.transaction('rw', db.cases, db.settings, async () => {
    await db.cases.clear();
    await db.settings.clear();
  });
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('pahtli:') && !KEEP_ON_WIPE.has(k)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
  try { sessionStorage.clear(); } catch { /* ignore */ }
}

export { roundCoord } from './geo';
