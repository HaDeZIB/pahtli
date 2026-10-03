import { describe, expect, it } from 'vitest';
import type { CaseRecord } from '../types';
import { caseToEvent, DHIS2_PLACEHOLDERS, dhis2Uid, toDhis2Payload } from './dhis2';

const base: CaseRecord = {
  case_id: '3f2a9c1e-8b7d-4e6f-a5b4-c3d2e1f0a9b8',
  created_at: '2026-10-03T15:20:00.000Z',
  comunidad: 'Xiloxochico',
  lat: 20.04637,
  lng: -97.51234,
  transcript: 'Niña de 1 año, se llama María, tiene calentura y se le hunde el pecho',
  findings: { edad_meses: 12, sexo: 'F', temperatura_c: 38.5, sintomas: { fiebre: true, tiraje: true } },
  result: { level: 'urgencia', escalated_by_model: false, rule_ids: ['IMCI-RESP-01', 'IMCI-GEN-01'] },
  sindrome: 'respiratorio',
  device_tier: 'B',
  synced: false,
  uncertain: false,
  decision: { final_level: 'urgencia', overridden: false, note: 'mamá muy preocupada, se llama Rosa' },
};

const dv = (ev: ReturnType<typeof caseToEvent>, key: keyof typeof DHIS2_PLACEHOLDERS.dataElements) =>
  ev.dataValues.find((d) => d.dataElement === DHIS2_PLACEHOLDERS.dataElements[key])?.value;

describe('DHIS2 tracker export', () => {
  it('genera la forma { events: [...] } con los campos requeridos de un programa de eventos', () => {
    const p = toDhis2Payload([base]);
    expect(Object.keys(p)).toEqual(['events']);
    const ev = p.events[0];
    expect(ev.program).toBe(DHIS2_PLACEHOLDERS.program);
    expect(ev.programStage).toBe(DHIS2_PLACEHOLDERS.programStage);
    expect(ev.orgUnit).toBe(DHIS2_PLACEHOLDERS.orgUnit);
    expect(ev.occurredAt).toBe(base.created_at);
    expect(['ACTIVE', 'COMPLETED']).toContain(ev.status);
    expect(ev).not.toHaveProperty('enrollment');
    for (const d of ev.dataValues) expect(typeof d.value).toBe('string');
  });

  it('mapea nivel, síndrome, reglas, edad y sexo', () => {
    const ev = caseToEvent(base);
    expect(dv(ev, 'level')).toBe('urgencia');
    expect(dv(ev, 'final_level')).toBe('urgencia');
    expect(dv(ev, 'overridden')).toBe('false');
    expect(dv(ev, 'syndrome')).toBe('respiratorio');
    expect(dv(ev, 'rule_ids')).toBe('IMCI-RESP-01,IMCI-GEN-01');
    expect(dv(ev, 'age_months')).toBe('12');
    expect(dv(ev, 'sex')).toBe('F');
    expect(dv(ev, 'temperature_c')).toBe('38.5');
    expect(dv(ev, 'uncertain')).toBe('false');
  });

  it('registra la decisión humana cuando la promotora cambia el nivel', () => {
    const ev = caseToEvent({ ...base, decision: { final_level: 'centro_hoy', overridden: true, reason: 'vi_menos_grave', note: 'texto libre' } });
    expect(dv(ev, 'final_level')).toBe('centro_hoy');
    expect(dv(ev, 'overridden')).toBe('true');
    expect(dv(ev, 'override_reason')).toBe('vi_menos_grave');
  });

  it('no exporta texto libre (transcripción ni nota) y redondea coordenadas a ~1 km', () => {
    const json = JSON.stringify(toDhis2Payload([base]));
    expect(json).not.toContain('María');
    expect(json).not.toContain('Rosa');
    expect(caseToEvent(base).geometry).toEqual({ type: 'Point', coordinates: [-97.51, 20.05] });
  });

  it('omite valores desconocidos y la geometría si no hay coordenadas', () => {
    const ev = caseToEvent({ ...base, lat: undefined, lng: undefined, findings: { sintomas: {} }, sindrome: undefined, decision: undefined, uncertain: undefined });
    expect(ev.geometry).toBeUndefined();
    expect(dv(ev, 'age_months')).toBeUndefined();
    expect(dv(ev, 'overridden')).toBeUndefined();
    expect(dv(ev, 'final_level')).toBe('urgencia');
  });

  it('UID de evento válido para DHIS2 (11 caracteres, empieza con letra) y determinista', () => {
    const uid = dhis2Uid(base.case_id);
    expect(uid).toMatch(/^[A-Za-z][A-Za-z0-9]{10}$/);
    expect(dhis2Uid(base.case_id)).toBe(uid);
    expect(dhis2Uid('9f2a9c1e-8b7d-4e6f-a5b4-c3d2e1f0a9b8')).not.toBe(uid);
    expect(dhis2Uid('caso-demo-1')).toMatch(/^[A-Za-z][A-Za-z0-9]{10}$/);
  });

  it('permite mapear comunidad -> orgUnit', () => {
    const ev = caseToEvent(base, { ...DHIS2_PLACEHOLDERS, orgUnitByComunidad: { Xiloxochico: 'Abc123Def45' } });
    expect(ev.orgUnit).toBe('Abc123Def45');
  });
});
