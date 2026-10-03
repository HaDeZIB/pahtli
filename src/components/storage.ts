// localStorage puede fallar (modo privado, almacenamiento bloqueado): siempre con try/catch.
export function lsGet(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
export function lsSet(k: string, v: string): void {
  try { localStorage.setItem(k, v); } catch { /* ignore */ }
}

/** Evento global para refrescar contadores cuando cambian los casos. */
export const CASES_CHANGED = 'pahtli:cases-changed';
export function notifyCasesChanged(): void {
  window.dispatchEvent(new Event(CASES_CHANGED));
}
