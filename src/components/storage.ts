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

/** Teléfono del centro de salud (lo escribe la promotora en Ajustes). Solo en este celular. */
const CENTRO_TEL = 'pahtli:centro_tel';
export function getCentroTel(): string {
  return (lsGet(CENTRO_TEL) ?? '').trim();
}
export function setCentroTel(v: string): void {
  lsSet(CENTRO_TEL, v.replace(/[^\d+\s-]/g, '').trim());
}
/** Enlace tel: limpio (solo dígitos y +). */
export const telHref = (v: string) => `tel:${v.replace(/[^\d+]/g, '')}`;
