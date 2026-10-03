/** Redondea coordenadas a 2 decimales (~1 km) para no ubicar una casa. Puro, sin dependencias. */
export const roundCoord = (v: number, decimals = 2) => Math.round(v * 10 ** decimals) / 10 ** decimals;
