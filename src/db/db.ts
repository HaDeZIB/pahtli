import Dexie, { type Table } from 'dexie';
import type { CaseRecord } from '../types';

/**
 * IndexedDB local (Dexie). Fuente de verdad en el celular: todo se guarda aquí
 * primero y se sincroniza después (patrón outbox).
 *
 * IndexedDB no puede indexar booleanos, así que además de `synced` guardamos
 * `sync_state` (0 = pendiente, 1 = enviado) para consultar la cola rápido.
 */
export interface StoredCase extends CaseRecord {
  sync_state: 0 | 1;
}

export interface Settings {
  comunidad: string;
  lat?: number;
  lng?: number;
  /** Nombre o clave de la promotora. Se queda en el dispositivo; nunca se sincroniza. */
  promotora?: string;
}

interface SettingsRow extends Settings {
  id: 'main';
}

class PahtliDB extends Dexie {
  cases!: Table<StoredCase, string>;
  settings!: Table<SettingsRow, string>;

  constructor() {
    super('pahtli');
    this.version(1).stores({
      cases: 'case_id, created_at, sync_state, comunidad',
      settings: 'id',
    });
  }
}

export const db = new PahtliDB();

const DEFAULT_SETTINGS: Settings = { comunidad: '' };

function strip(c: StoredCase): CaseRecord {
  const { sync_state: _s, ...rest } = c;
  void _s;
  return rest;
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Respaldo para navegadores viejos / contextos no seguros (http en LAN)
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Guarda un caso nuevo. Si no trae comunidad/coords, usa las de la configuración. */
export async function saveCase(c: Omit<CaseRecord, 'case_id' | 'created_at' | 'synced'>): Promise<CaseRecord> {
  const s = await getSettings();
  const record: StoredCase = {
    ...c,
    comunidad: c.comunidad || s.comunidad || 'Sin comunidad',
    lat: c.lat ?? s.lat,
    lng: c.lng ?? s.lng,
    case_id: uuid(),
    created_at: new Date().toISOString(),
    synced: false,
    sync_state: 0,
  };
  await db.cases.add(record);
  return strip(record);
}

/** Todos los casos locales, más recientes primero. */
export async function listCases(): Promise<CaseRecord[]> {
  const rows = await db.cases.orderBy('created_at').reverse().toArray();
  return rows.map(strip);
}

export async function pendingCount(): Promise<number> {
  return db.cases.where('sync_state').equals(0).count();
}

/** Casos que faltan por enviar (más viejos primero). */
export async function pendingCases(limit = 50): Promise<CaseRecord[]> {
  const rows = await db.cases.where('sync_state').equals(0).sortBy('created_at');
  return rows.slice(0, limit).map(strip);
}

export async function markSynced(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await db.transaction('rw', db.cases, async () => {
    await db.cases.where('case_id').anyOf(ids).modify({ synced: true, sync_state: 1 });
  });
}

export async function getSettings(): Promise<Settings> {
  const row = await db.settings.get('main');
  if (!row) return { ...DEFAULT_SETTINGS };
  const { id: _id, ...rest } = row;
  void _id;
  return rest;
}

export async function setSettings(s: Partial<Settings>): Promise<Settings> {
  const next: Settings = { ...(await getSettings()), ...s };
  await db.settings.put({ id: 'main', ...next });
  return next;
}
