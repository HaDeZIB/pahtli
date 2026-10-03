import type { CaseRecord, DeviceTier, Findings, Syndrome, TriageLevel } from '../types';
import { triage } from '../triage/engine';
import { classifySyndrome } from '../triage/syndrome';

/**
 * Datos de DEMOSTRACIÓN para el tablero (no son pacientes reales).
 * Comunidades reales del municipio de Cuetzalan del Progreso, Sierra Nororiental
 * de Puebla; coordenadas aproximadas de OpenStreetMap (Nominatim, consultado oct-2026).
 * Las fechas se generan relativas al momento actual para que la demo siempre
 * se vea "viva". Incluye a propósito un racimo de diarrea con sangre en
 * San Miguel Tzinacapan para que se dispare la alerta de brote.
 */

export interface Community {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
}

export const COMMUNITIES: Community[] = [
  { id: 'TZI', nombre: 'San Miguel Tzinacapan', lat: 20.0306, lng: -97.5406 },
  { id: 'YOH', nombre: 'Yohualichan', lat: 20.0619, lng: -97.5037 },
  { id: 'XIL', nombre: 'Xiloxochico', lat: 20.0466, lng: -97.4912 },
  { id: 'CUA', nombre: 'Cuauhtamazaco', lat: 20.025, lng: -97.4872 },
  { id: 'TZC', nombre: 'San Andrés Tzicuilan', lat: 20.0142, lng: -97.5075 },
  { id: 'XOC', nombre: 'Xocoyolo', lat: 19.9764, lng: -97.5464 },
];

/** Cabecera municipal (ubicación aproximada del centro de salud de referencia). */
export const HEALTH_CENTER = { nombre: 'Cuetzalan (cabecera)', lat: 20.0186, lng: -97.5211 };
export const MAP_CENTER: [number, number] = [20.025, -97.515];

/** Los case_id de la demo empiezan con este prefijo (para distinguirlos en pantalla). */
export const SEED_PREFIX = '5eed0000-';
export const isSeedCase = (id: string) => id.startsWith(SEED_PREFIX);

type Row = [
  hoursAgo: number,
  com: string,
  syn: Syndrome,
  level: TriageLevel,
  edadMeses: number,
  sexo: 'F' | 'M',
  sintomas: string[],
  extra?: Partial<Findings>,
];

const Y = 12; // meses por año

const ROWS: Row[] = [
  // --- últimas 72 h ---
  [3, 'TZI', 'diarrea_sangre', 'centro_hoy', 30, 'F', ['diarrea', 'sangre_heces', 'fiebre'], { duracion_dias: 1 }],
  [14, 'TZI', 'diarrea_sangre', 'urgencia', 18, 'M', ['diarrea', 'sangre_heces', 'ojos_hundidos', 'no_puede_beber'], { duracion_dias: 2 }],
  [29, 'TZI', 'diarrea_sangre', 'centro_hoy', 6 * Y, 'F', ['diarrea', 'sangre_heces'], { duracion_dias: 1 }],
  [8, 'TZI', 'respiratorio', 'aqui', 48, 'M', ['tos', 'escurrimiento_nasal'], { duracion_dias: 2 }],
  [40, 'TZI', 'febril', 'aqui', 30 * Y, 'F', ['fiebre', 'dolor_cabeza'], { duracion_dias: 1, temperatura_c: 38.2 }],
  [5, 'YOH', 'respiratorio', 'urgencia', 10, 'F', ['tos', 'respira_rapido', 'tiraje'], { resp_por_min: 58, duracion_dias: 3 }],
  [22, 'YOH', 'respiratorio', 'centro_hoy', 36, 'M', ['tos', 'fiebre', 'respira_rapido'], { resp_por_min: 44, duracion_dias: 2 }],
  [50, 'YOH', 'obstetrico', 'urgencia', 22 * Y, 'F', ['dolor_cabeza_intenso', 'vision_borrosa'], { embarazada: true, semanas_embarazo: 34 }],
  [11, 'XIL', 'diarreico', 'aqui', 24, 'M', ['diarrea'], { duracion_dias: 1 }],
  [33, 'XIL', 'febril', 'centro_hoy', 45 * Y, 'M', ['fiebre'], { duracion_dias: 8, temperatura_c: 38.5 }],
  [60, 'XIL', 'otro', 'aqui', 55 * Y, 'F', ['dolor_cabeza'], { duracion_dias: 1 }],
  [2, 'CUA', 'cardiovascular', 'urgencia', 62 * Y, 'M', ['dolor_pecho', 'dificultad_respirar'], { duracion_dias: 0 }],
  [26, 'CUA', 'respiratorio', 'aqui', 7 * Y, 'F', ['tos', 'escurrimiento_nasal'], { duracion_dias: 3 }],
  [45, 'CUA', 'diarreico', 'centro_hoy', 14, 'F', ['diarrea', 'vomito', 'ojos_hundidos'], { duracion_dias: 2 }],
  [18, 'TZC', 'trauma', 'centro_hoy', 35 * Y, 'M', ['fractura'], { duracion_dias: 0 }],
  [38, 'TZC', 'febril', 'aqui', 9 * Y, 'M', ['fiebre'], { duracion_dias: 1, temperatura_c: 38 }],
  [66, 'TZC', 'respiratorio', 'centro_hoy', 70 * Y, 'F', ['tos', 'fiebre', 'dificultad_respirar'], { duracion_dias: 4 }],
  [9, 'XOC', 'obstetrico', 'centro_hoy', 19 * Y, 'F', ['hinchazon_cara_manos'], { embarazada: true, semanas_embarazo: 28 }],
  [31, 'XOC', 'respiratorio', 'aqui', 5 * Y, 'M', ['tos'], { duracion_dias: 2 }],
  [55, 'XOC', 'diarreico', 'aqui', 40 * Y, 'F', ['diarrea'], { duracion_dias: 1 }],
  // --- días 3 a 7 ---
  [80, 'TZI', 'respiratorio', 'aqui', 3 * Y, 'F', ['tos', 'escurrimiento_nasal']],
  [96, 'TZI', 'diarreico', 'aqui', 4 * Y, 'M', ['diarrea']],
  [130, 'TZI', 'otro', 'aqui', 28 * Y, 'F', ['dolor_abdominal']],
  [135, 'TZI', 'febril', 'aqui', 12 * Y, 'M', ['fiebre'], { temperatura_c: 38.1 }],
  [85, 'YOH', 'febril', 'aqui', 33 * Y, 'M', ['fiebre', 'dolor_muscular_articular']],
  [105, 'YOH', 'respiratorio', 'centro_hoy', 66 * Y, 'M', ['tos', 'fiebre'], { duracion_dias: 15 }],
  [110, 'YOH', 'respiratorio', 'aqui', 8 * Y, 'F', ['tos']],
  [150, 'YOH', 'diarreico', 'centro_hoy', 9, 'M', ['diarrea', 'vomito']],
  [78, 'XIL', 'respiratorio', 'centro_hoy', 20, 'F', ['tos', 'respira_rapido'], { resp_por_min: 46 }],
  [120, 'XIL', 'neurologico', 'urgencia', 2 * Y, 'M', ['convulsiones', 'fiebre']],
  [160, 'XIL', 'febril', 'aqui', 25 * Y, 'F', ['fiebre']],
  [75, 'CUA', 'otro', 'aqui', 50 * Y, 'M', []],
  [90, 'CUA', 'febril_hemorragico', 'urgencia', 17 * Y, 'F', ['fiebre', 'sangrado_mucosas', 'dolor_abdominal_intenso'], { duracion_dias: 4 }],
  [140, 'CUA', 'respiratorio', 'aqui', 6 * Y, 'M', ['tos', 'escurrimiento_nasal']],
  [100, 'TZC', 'diarreico', 'aqui', 3 * Y, 'F', ['diarrea']],
  [125, 'TZC', 'obstetrico', 'aqui', 24 * Y, 'F', [], { embarazada: true, semanas_embarazo: 20 }],
  [165, 'TZC', 'respiratorio', 'aqui', 10 * Y, 'M', ['tos']],
  [88, 'XOC', 'febril', 'aqui', 38 * Y, 'M', ['fiebre']],
  [115, 'XOC', 'trauma', 'aqui', 14 * Y, 'M', ['quemadura']],
  [145, 'XOC', 'respiratorio', 'centro_hoy', 2 * Y, 'F', ['tos', 'fiebre', 'respira_rapido'], { resp_por_min: 45 }],
];

const TIERS: DeviceTier[] = ['A', 'B', 'B', 'C'];

/** Desplazamiento pequeño y determinista (~±300 m) para que los puntos no se encimen. */
function jitter(i: number, axis: number): number {
  const x = Math.sin((i + 1) * (axis ? 12.9898 : 78.233)) * 43758.5453;
  return ((x - Math.floor(x)) - 0.5) * 0.006;
}

export function generateSeedCases(now: number = Date.now()): CaseRecord[] {
  return ROWS.map(([h, comId, syn, level, edad, sexo, sintomas, extra], i) => {
    const com = COMMUNITIES.find((c) => c.id === comId)!;
    const t = now - h * 3_600_000 - ((i * 7919) % 50) * 60_000; // minutos "irregulares"
    const findings: Findings = {
      edad_meses: edad,
      sexo,
      ...extra,
      sintomas: Object.fromEntries(sintomas.map((s) => [s, true])),
    };
    // Nivel, reglas y síndrome salen del motor real, para que el tablero sea coherente con el triaje.
    // `syn`/`level` de la fila quedan solo como referencia de lo que se quiso sembrar.
    void syn; void level;
    const r = triage(findings);
    return {
      case_id: `${SEED_PREFIX}0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      created_at: new Date(t).toISOString(),
      comunidad: com.nombre,
      lat: +(com.lat + jitter(i, 0)).toFixed(5),
      lng: +(com.lng + jitter(i, 1)).toFixed(5),
      transcript: '',
      findings,
      result: { level: r.level, escalated_by_model: false, rule_ids: r.fired.map((x) => x.id) },
      sindrome: classifySyndrome(findings),
      device_tier: TIERS[i % TIERS.length],
      synced: true,
    } satisfies CaseRecord;
  });
}
