/**
 * Offline referral: nearest health facility from the CLUES registry (DGIS, Secretaría de Salud).
 * Pure functions, no I/O. Data built by scripts/build-facilities.py -> public/data/facilities.json.
 * Distances are straight-line (great-circle) km — NOT road distance or travel time.
 */
import type { TriageLevel } from '../types';

/** 1 = primer nivel (consulta externa) · 2 = hospital (2º nivel) · 3 = hospital de alta especialidad */
export type FacilityLevel = 1 | 2 | 3;

export interface Facility {
  clues: string;
  nombre: string;
  tipo: string;
  nivel: FacilityLevel;
  municipio: string;
  localidad: string;
  estado?: string;
  lat: number;
  lng: number;
  institucion: string;
}

export interface FacilityWithDistance extends Facility {
  km: number;
}

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in km between two WGS84 points. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export const hasHospitalization = (f: Facility) => f.nivel >= 2;

export interface NearestOptions {
  /** true = only facilities with hospitalization (nivel >= 2); false = only primer nivel; undefined = any */
  needHospital?: boolean;
  /** max results (default 3) */
  k?: number;
  /** ignore facilities farther than this (km). Default: no limit */
  maxKm?: number;
}

/** Facilities sorted by straight-line distance (ascending), ties broken by CLUES for determinism. */
export function nearestFacilities(
  lat: number,
  lng: number,
  facilities: readonly Facility[],
  opts: NearestOptions = {},
): FacilityWithDistance[] {
  const { needHospital, k = 3, maxKm = Infinity } = opts;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || k <= 0) return [];
  const out: FacilityWithDistance[] = [];
  for (const f of facilities) {
    if (needHospital === true && !hasHospitalization(f)) continue;
    if (needHospital === false && hasHospitalization(f)) continue;
    const km = haversineKm(lat, lng, f.lat, f.lng);
    if (km <= maxKm) out.push({ ...f, km: Math.round(km * 10) / 10 });
  }
  out.sort((a, b) => a.km - b.km || a.clues.localeCompare(b.clues));
  return out.slice(0, k);
}

export interface Referral {
  level: TriageLevel;
  /** Where to send the patient first (empty for 'aqui'). */
  primary: FacilityWithDistance[];
  /** For 'urgencia': nearest primer nivel as a stabilization / fallback point. */
  alternative: FacilityWithDistance[];
}

/**
 * Referral policy by triage level:
 *  - urgencia   -> nearest facilities WITH hospitalization (nivel 2/3) + nearest primer nivel as fallback
 *  - centro_hoy -> nearest primer nivel (centro de salud / UMR); if none, any facility
 *  - aqui       -> nothing to refer (still returns nearest primer nivel as "alternative" for follow-up)
 */
export function referralFor(
  level: TriageLevel,
  lat: number,
  lng: number,
  facilities: readonly Facility[],
  k = 3,
): Referral {
  const firstLevel = nearestFacilities(lat, lng, facilities, { needHospital: false, k });
  if (level === 'urgencia') {
    return { level, primary: nearestFacilities(lat, lng, facilities, { needHospital: true, k }), alternative: firstLevel.slice(0, 1) };
  }
  if (level === 'centro_hoy') {
    return { level, primary: firstLevel.length ? firstLevel : nearestFacilities(lat, lng, facilities, { k }), alternative: [] };
  }
  return { level, primary: [], alternative: firstLevel.slice(0, 1) };
}

/** Human-readable distance, e.g. "850 m" / "12.4 km". */
export function formatKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}
