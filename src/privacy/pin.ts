/**
 * PIN opcional de 4 dígitos para abrir Pahtli (celular compartido o perdido).
 *
 * Se guarda SOLO un hash con sal: PBKDF2-HMAC-SHA-256 (WebCrypto), sal aleatoria de 16 bytes, 100 000 iteraciones.
 * Nunca se guarda el PIN. Límite honesto: un PIN de 4 dígitos protege contra el acceso casual (alguien que
 * toma el celular), no contra un ataque forense con acceso al almacenamiento del navegador.
 */

const KEY = 'pahtli:pin';
const FAIL_KEY = 'pahtli:pin_fails';
export const PIN_ITERATIONS = 100_000;
/** Bloquear de nuevo tras este tiempo en segundo plano. */
export const LOCK_AFTER_MS = 5 * 60 * 1000;
/** Después de estos intentos fallidos se espera LOCKOUT_MS antes de volver a intentar. */
export const MAX_FAILS = 5;
export const LOCKOUT_MS = 30_000;

export interface StoredPin {
  v: 1;
  alg: 'PBKDF2-SHA-256';
  iter: number;
  salt: string; // hex
  hash: string; // hex
}

/** Almacenamiento mínimo (localStorage en el navegador; un Map en pruebas). */
export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function defaultKV(): KV | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

const toHex = (b: ArrayBuffer | Uint8Array) => Array.from(b instanceof Uint8Array ? b : new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
const fromHex = (h: string) => new Uint8Array((h.match(/../g) ?? []).map((x) => parseInt(x, 16)));

export const isValidPin = (pin: string) => /^\d{4}$/.test(pin);

/** WebCrypto solo existe en contextos seguros (https o localhost). */
export function pinSupported(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle && typeof crypto.getRandomValues === 'function';
}

export async function hashPin(pin: string, saltHex: string, iterations = PIN_ITERATIONS): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations }, key, 256);
  return toHex(bits);
}

function readStored(kv: KV | null): StoredPin | null {
  if (!kv) return null;
  try {
    const raw = kv.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as StoredPin;
    return p && typeof p.hash === 'string' && typeof p.salt === 'string' ? p : null;
  } catch { return null; }
}

export function hasPin(kv: KV | null = defaultKV()): boolean {
  return readStored(kv) !== null;
}

export async function setPin(pin: string, kv: KV | null = defaultKV()): Promise<void> {
  if (!isValidPin(pin)) throw new Error('El PIN debe tener 4 números.');
  if (!pinSupported()) throw new Error('Este navegador no permite PIN (se necesita https).');
  if (!kv) throw new Error('No hay almacenamiento disponible.');
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await hashPin(pin, salt);
  const rec: StoredPin = { v: 1, alg: 'PBKDF2-SHA-256', iter: PIN_ITERATIONS, salt, hash };
  kv.setItem(KEY, JSON.stringify(rec));
  kv.removeItem(FAIL_KEY);
}

export function clearPin(kv: KV | null = defaultKV()): void {
  try { kv?.removeItem(KEY); kv?.removeItem(FAIL_KEY); } catch { /* ignore */ }
}

interface Fails { n: number; until: number }
function readFails(kv: KV | null): Fails {
  try { const f = JSON.parse(kv?.getItem(FAIL_KEY) ?? 'null') as Fails | null; return f ?? { n: 0, until: 0 }; } catch { return { n: 0, until: 0 }; }
}

/** Milisegundos que faltan para poder intentar de nuevo (0 = ya se puede). */
export function lockoutRemaining(kv: KV | null = defaultKV(), now = Date.now()): number {
  return Math.max(0, readFails(kv).until - now);
}

/** Comparación en tiempo constante de dos hex de igual largo. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export type VerifyResult = { ok: true } | { ok: false; waitMs: number };

export async function verifyPin(pin: string, kv: KV | null = defaultKV(), now = Date.now()): Promise<VerifyResult> {
  const stored = readStored(kv);
  if (!stored) return { ok: true };
  const wait = lockoutRemaining(kv, now);
  if (wait > 0) return { ok: false, waitMs: wait };
  const hash = isValidPin(pin) ? await hashPin(pin, stored.salt, stored.iter) : '';
  if (hash && safeEqual(hash, stored.hash)) {
    kv?.removeItem(FAIL_KEY);
    return { ok: true };
  }
  const f = readFails(kv);
  const n = f.n + 1;
  const until = n >= MAX_FAILS ? now + LOCKOUT_MS : 0;
  try { kv?.setItem(FAIL_KEY, JSON.stringify({ n: n >= MAX_FAILS ? 0 : n, until })); } catch { /* ignore */ }
  return { ok: false, waitMs: until ? LOCKOUT_MS : 0 };
}

/** ¿Hay que bloquear al volver del segundo plano? */
export function shouldRelock(hiddenAt: number | null, now = Date.now(), after = LOCK_AFTER_MS): boolean {
  return hiddenAt !== null && now - hiddenAt >= after;
}
