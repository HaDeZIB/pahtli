/**
 * Exportación de casos al formato de importación de DHIS2 Tracker (programa de eventos, WITHOUT_REGISTRATION).
 *
 * Estructura verificada en la documentación oficial (oct-2026):
 *   https://docs.dhis2.org/en/develop/using-the-api/dhis-core-version-master/tracker.html
 *   POST /api/tracker?importStrategy=CREATE_AND_UPDATE&atomicMode=OBJECT
 *   { "events": [ { event, program, programStage, orgUnit, occurredAt, status, dataValues: [{dataElement, value}], geometry } ] }
 *   - Requeridos: program, programStage, orgUnit, occurredAt. `enrollment` se omite en programas de eventos.
 *   - En programas de eventos solo se permiten los estados ACTIVE y COMPLETED.
 *   - `event` es opcional; si se manda debe ser un UID de DHIS2 (11 caracteres, empieza con letra).
 *
 * Los UID de programa, etapa, unidad organizacional y elementos de datos son MARCADORES: cada Secretaría
 * de Salud estatal los reemplaza con los de su instancia (o pasa `config`). Sin eso, DHIS2 rechazará el archivo.
 *
 * Privacidad: no se exporta el texto libre (transcripción ni nota de la promotora); coordenadas redondeadas a ~1 km.
 */
import type { CaseRecord } from '../types';
import { roundCoord } from '../privacy/geo';

export interface Dhis2Config {
  program: string;
  programStage: string;
  /** Unidad organizacional por defecto (p. ej. el centro de salud que recibe los reportes). */
  orgUnit: string;
  /** Opcional: nombre de comunidad -> UID de orgUnit. */
  orgUnitByComunidad?: Record<string, string>;
  dataElements: Record<DataKey, string>;
  status: 'ACTIVE' | 'COMPLETED';
}

export type DataKey =
  | 'level' | 'final_level' | 'overridden' | 'override_reason' | 'uncertain' | 'syndrome' | 'rule_ids'
  | 'age_months' | 'sex' | 'pregnant' | 'pregnancy_weeks' | 'temperature_c' | 'resp_rate' | 'escalated_by_model' | 'device_tier';

/** MARCADORES — reemplazar con los UID reales de la instancia DHIS2. */
export const DHIS2_PLACEHOLDERS: Dhis2Config = {
  program: 'REPLACE_PROGRAM_UID',
  programStage: 'REPLACE_STAGE_UID',
  orgUnit: 'REPLACE_ORGUNIT_UID',
  status: 'COMPLETED',
  dataElements: {
    level: 'DE_PAHTLI_LEVEL',
    final_level: 'DE_PAHTLI_FINAL_LEVEL',
    overridden: 'DE_PAHTLI_OVERRIDDEN',
    override_reason: 'DE_PAHTLI_OVERRIDE_REASON',
    uncertain: 'DE_PAHTLI_UNCERTAIN',
    syndrome: 'DE_PAHTLI_SYNDROME',
    rule_ids: 'DE_PAHTLI_RULE_IDS',
    age_months: 'DE_PAHTLI_AGE_MONTHS',
    sex: 'DE_PAHTLI_SEX',
    pregnant: 'DE_PAHTLI_PREGNANT',
    pregnancy_weeks: 'DE_PAHTLI_PREG_WEEKS',
    temperature_c: 'DE_PAHTLI_TEMP_C',
    resp_rate: 'DE_PAHTLI_RESP_RATE',
    escalated_by_model: 'DE_PAHTLI_MODEL_ESC',
    device_tier: 'DE_PAHTLI_DEVICE_TIER',
  },
};

export interface Dhis2DataValue { dataElement: string; value: string }
export interface Dhis2Event {
  event: string;
  program: string;
  programStage: string;
  orgUnit: string;
  occurredAt: string;
  status: 'ACTIVE' | 'COMPLETED';
  dataValues: Dhis2DataValue[];
  geometry?: { type: 'Point'; coordinates: [number, number] };
}
export interface Dhis2Payload { events: Dhis2Event[] }

/** Endpoint sugerido (idempotente: el UID del evento sale del case_id). */
export const DHIS2_IMPORT_PATH = '/api/tracker?importStrategy=CREATE_AND_UPDATE&atomicMode=OBJECT';

const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ALNUM = `${LETTERS}0123456789`;

/** UID de DHIS2 determinista a partir del case_id (11 caracteres, el primero letra). Re-exportar no duplica. */
export function dhis2Uid(caseId: string): string {
  const hex = caseId.replace(/[^0-9a-f]/gi, '');
  let n: bigint;
  if (hex.length >= 16) n = BigInt(`0x${hex.slice(0, 32)}`);
  else {
    // case_id no-UUID: FNV-1a de 64 bits
    n = 0xcbf29ce484222325n;
    for (const ch of caseId) n = ((n ^ BigInt(ch.codePointAt(0)!)) * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  let out = LETTERS[Number(n % 52n)];
  n /= 52n;
  for (let i = 0; i < 10; i++) { out += ALNUM[Number(n % 62n)]; n /= 62n; }
  return out;
}

export function caseToEvent(c: CaseRecord, cfg: Dhis2Config = DHIS2_PLACEHOLDERS): Dhis2Event {
  const de = cfg.dataElements;
  const dv: Dhis2DataValue[] = [];
  const put = (k: DataKey, v: string | number | boolean | undefined | null) => {
    if (v === undefined || v === null || v === '') return;
    dv.push({ dataElement: de[k], value: String(v) });
  };
  const f = c.findings ?? { sintomas: {} };
  put('level', c.result.level);
  put('final_level', c.decision?.final_level ?? c.result.level);
  put('overridden', c.decision ? c.decision.overridden : undefined);
  put('override_reason', c.decision?.overridden ? c.decision.reason : undefined);
  put('uncertain', typeof c.uncertain === 'boolean' ? c.uncertain : undefined);
  put('syndrome', c.sindrome);
  put('rule_ids', c.result.rule_ids?.length ? c.result.rule_ids.join(',') : undefined);
  put('age_months', typeof f.edad_meses === 'number' ? Math.round(f.edad_meses * 10) / 10 : undefined);
  put('sex', f.sexo);
  put('pregnant', f.embarazada);
  put('pregnancy_weeks', f.semanas_embarazo);
  put('temperature_c', f.temperatura_c);
  put('resp_rate', f.resp_por_min);
  put('escalated_by_model', c.result.escalated_by_model);
  put('device_tier', c.device_tier);

  const ev: Dhis2Event = {
    event: dhis2Uid(c.case_id),
    program: cfg.program,
    programStage: cfg.programStage,
    orgUnit: cfg.orgUnitByComunidad?.[c.comunidad] ?? cfg.orgUnit,
    occurredAt: c.created_at,
    status: cfg.status,
    dataValues: dv,
  };
  if (typeof c.lat === 'number' && typeof c.lng === 'number' && Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
    // GeoJSON: [longitud, latitud]
    ev.geometry = { type: 'Point', coordinates: [roundCoord(c.lng), roundCoord(c.lat)] };
  }
  return ev;
}

export function toDhis2Payload(cases: readonly CaseRecord[], cfg: Dhis2Config = DHIS2_PLACEHOLDERS): Dhis2Payload {
  return { events: cases.map((c) => caseToEvent(c, cfg)) };
}

/** Descarga el JSON en el navegador (funciona sin internet). */
export function downloadDhis2(cases: readonly CaseRecord[], now = new Date()): void {
  const blob = new Blob([JSON.stringify(toDhis2Payload(cases), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pahtli-dhis2-${now.toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
