import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { formatKm, haversineKm, nearestFacilities, referralFor, type Facility } from './nearest';

const f = (clues: string, nivel: 1 | 2 | 3, lat: number, lng: number): Facility => ({
  clues, nombre: clues, tipo: nivel > 1 ? 'Hospital' : 'Centro de salud', nivel,
  municipio: 'M', localidad: 'L', lat, lng, institucion: 'SSA',
});

// Cuetzalan centro ≈ 20.0175, -97.5222
const ORIGIN = { lat: 20.0175, lng: -97.5222 };
const FAC: Facility[] = [
  f('CS_NEAR', 1, 20.0273, -97.5427),   // ~2.4 km
  f('CS_MID', 1, 20.0634, -97.5356),    // ~5.3 km
  f('HOSP_NEAR', 2, 20.0098, -97.5311), // ~1.2 km
  f('HOSP_FAR', 2, 19.8998, -97.5891),  // ~15 km (Zacapoaxtla)
  f('HAE', 3, 19.0436, -98.1981),       // Puebla capital, ~130 km
];

describe('haversineKm', () => {
  it('is 0 for the same point and symmetric', () => {
    expect(haversineKm(20, -97, 20, -97)).toBe(0);
    expect(haversineKm(20, -97, 19, -98)).toBeCloseTo(haversineKm(19, -98, 20, -97), 9);
  });
  it('matches known distances', () => {
    // 1 degree of latitude ≈ 111.2 km
    expect(haversineKm(0, 0, 1, 0)).toBeCloseTo(111.19, 1);
    // CDMX Zócalo -> Puebla Zócalo ≈ 105 km straight line
    expect(haversineKm(19.4326, -99.1332, 19.0433, -98.1981)).toBeGreaterThan(100);
    expect(haversineKm(19.4326, -99.1332, 19.0433, -98.1981)).toBeLessThan(110);
  });
});

describe('nearestFacilities', () => {
  it('sorts by distance and respects k', () => {
    const r = nearestFacilities(ORIGIN.lat, ORIGIN.lng, FAC, { k: 3 });
    expect(r.map((x) => x.clues)).toEqual(['HOSP_NEAR', 'CS_NEAR', 'CS_MID']);
    expect(r[0].km).toBeLessThan(r[1].km);
  });
  it('needHospital=true keeps only nivel >= 2', () => {
    const r = nearestFacilities(ORIGIN.lat, ORIGIN.lng, FAC, { needHospital: true, k: 5 });
    expect(r.map((x) => x.clues)).toEqual(['HOSP_NEAR', 'HOSP_FAR', 'HAE']);
  });
  it('needHospital=false keeps only primer nivel', () => {
    const r = nearestFacilities(ORIGIN.lat, ORIGIN.lng, FAC, { needHospital: false, k: 5 });
    expect(r.every((x) => x.nivel === 1)).toBe(true);
    expect(r[0].clues).toBe('CS_NEAR');
  });
  it('maxKm filters far facilities; bad input returns []', () => {
    expect(nearestFacilities(ORIGIN.lat, ORIGIN.lng, FAC, { needHospital: true, maxKm: 50, k: 5 })).toHaveLength(2);
    expect(nearestFacilities(NaN, 0, FAC)).toEqual([]);
    expect(nearestFacilities(ORIGIN.lat, ORIGIN.lng, [], { k: 3 })).toEqual([]);
  });
  it('does not mutate the input', () => {
    const copy = JSON.stringify(FAC);
    nearestFacilities(ORIGIN.lat, ORIGIN.lng, FAC, { k: 5 });
    expect(JSON.stringify(FAC)).toBe(copy);
  });
});

describe('referralFor', () => {
  it('urgencia -> hospitals first, nearest primer nivel as fallback', () => {
    const r = referralFor('urgencia', ORIGIN.lat, ORIGIN.lng, FAC);
    expect(r.primary.every((x) => x.nivel >= 2)).toBe(true);
    expect(r.primary[0].clues).toBe('HOSP_NEAR');
    expect(r.alternative.map((x) => x.clues)).toEqual(['CS_NEAR']);
  });
  it('centro_hoy -> nearest primer nivel', () => {
    const r = referralFor('centro_hoy', ORIGIN.lat, ORIGIN.lng, FAC);
    expect(r.primary[0].clues).toBe('CS_NEAR');
    expect(r.primary.every((x) => x.nivel === 1)).toBe(true);
  });
  it('centro_hoy falls back to any facility when no primer nivel exists', () => {
    const r = referralFor('centro_hoy', ORIGIN.lat, ORIGIN.lng, FAC.filter((x) => x.nivel > 1));
    expect(r.primary[0].clues).toBe('HOSP_NEAR');
  });
  it('aqui -> no referral', () => {
    expect(referralFor('aqui', ORIGIN.lat, ORIGIN.lng, FAC).primary).toEqual([]);
  });
});

describe('formatKm', () => {
  it('formats meters and km', () => {
    expect(formatKm(0.85)).toBe('850 m');
    expect(formatKm(12.44)).toBe('12.4 km');
  });
});

describe('shipped public/data/facilities.json', () => {
  const path = fileURLToPath(new URL('../../public/data/facilities.json', import.meta.url));
  const data = JSON.parse(readFileSync(path, 'utf8')) as Facility[];
  it('is well-formed and small', () => {
    expect(data.length).toBeGreaterThan(1000);
    expect(readFileSync(path).byteLength).toBeLessThan(1.5 * 1024 * 1024);
    for (const x of data) {
      expect(x.clues).toMatch(/^[A-Z]{2}[A-Z0-9]{3}\d{6}$/);
      expect([1, 2, 3]).toContain(x.nivel);
      expect(x.lat).toBeGreaterThan(14);
      expect(x.lng).toBeLessThan(-86);
    }
  });
  it('finds a hospital near Cuetzalan (Sierra Norte de Puebla) and Huejutla (Huasteca)', () => {
    const c = nearestFacilities(20.0175, -97.5222, data, { needHospital: true, k: 1 })[0];
    expect(c.km).toBeLessThan(10);
    const h = nearestFacilities(21.1406, -98.4198, data, { needHospital: true, k: 1 })[0];
    expect(h.km).toBeLessThan(10);
  });
});
