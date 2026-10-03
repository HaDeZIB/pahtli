import type { Rule } from './types';
import { anyOf, countGroups, has, hasFever, isNum, possiblyAge, years } from './helpers';
import { CITE, SRC } from './sources';

const REFER_NOW = 'Referir URGENTE al hospital: conseguir transporte o llamar al 911 ahora.';

export const FEVER_RULES: Rule[] = [
  {
    id: 'IMCI-FEV-01',
    block: 'fever',
    level: 'urgencia',
    applies: (f) => hasFever(f) && has(f, 'rigidez_nuca'),
    explicacion: { es: 'Fiebre con cuello tieso (rigidez de nuca): posible infección grave como meningitis.', nah: '' },
    accion: { es: `${REFER_NOW} Mantenerlo abrigado si es bebé.`, nah: '' },
    fuente: `${CITE.IMCI_2014}, p. 8 del PDF ("Any general danger sign or Stiff neck → VERY SEVERE FEBRILE DISEASE, refer URGENTLY"); ${CITE.IITT}, rojo "Any two of: altered mental status, stiff neck, hypothermia or fever, headache"`,
    fuente_url: SRC.IMCI_2014,
    needs: ['fiebre', 'temperatura_c', 'rigidez_nuca'],
    context: ['fiebre', 'dolor_cabeza'],
    fidelidad: 'verbatim',
  },
  {
    id: 'IITT-R-NEURO-01',
    block: 'fever',
    level: 'urgencia',
    applies: (f) => {
      // 'irritable' se excluye a propósito (ver docs/clinical-sources.md, limitaciones).
      const ams = anyOf(f, 'letargico', 'confusion');
      const hypo = isNum(f.temperatura_c) && f.temperatura_c < 36;
      if (possiblyAge(f, years(12))) {
        const n = countGroups(f, [['letargico', 'confusion'], ['rigidez_nuca'], ['dolor_cabeza', 'dolor_cabeza_intenso', 'dolor_cabeza_subito']]) +
          (hasFever(f) || hypo ? 1 : 0);
        // Decisión provisional #14 (docs/decisiones-clinicas.md): en ≥12 años, fiebre + dolor de cabeza SOLOS no bastan;
        // uno de los dos signos debe ser alteración mental o cuello tieso (el dengue típico queda en PAHO-DEN-03).
        if (n >= 2 && (ams || has(f, 'rigidez_nuca'))) return true;
      }
      // < 12 años: alteración del estado mental + rigidez de nuca, hipotermia o fiebre
      if (possiblyAge(f, 0, years(12)) && ams && (has(f, 'rigidez_nuca') || hypo || hasFever(f))) return true;
      return false;
    },
    explicacion: {
      es: 'Combinación de alarma del triaje IITT: confusión o muy dormido, o cuello tieso, junto con otro de — fiebre o temperatura baja, dolor de cabeza, confusión, cuello tieso (en niños: confusión o muy dormido junto con fiebre, cuello tieso o temperatura baja). Puede ser una infección grave del cerebro o sus cubiertas.',
      nah: '',
    },
    accion: { es: REFER_NOW, nah: '' },
    fuente: `${CITE.IITT}: adulto, rojo "Any two of: altered mental status, stiff neck, hypothermia or fever, headache" (en ≥12 años no basta fiebre + dolor de cabeza: ver decisiones-clinicas.md #14; ${CITE.PAHO_DENGUE_2020}, p. 6–9: fiebre con cefalea sin signos de alarma = dengue sin signos de alarma); pediátrico, rojo "Altered mental status… with stiff neck, hypothermia or fever"`,
    fuente_url: SRC.IITT_ADULT,
    needs: ['letargico', 'confusion', 'rigidez_nuca', 'dolor_cabeza', 'fiebre', 'temperatura_c', 'edad_meses'],
    context: ['fiebre', 'dolor_cabeza'],
    // adaptado: en ≥12 años se excluye la pareja fiebre + dolor de cabeza sola (decisión provisional #14); se excluye 'irritable' (#13).
    fidelidad: 'adaptado',
  },
  {
    id: 'IMCI-FEV-02',
    block: 'fever',
    level: 'centro_hoy',
    applies: (f) => possiblyAge(f, 0, 60) && hasFever(f) && isNum(f.duracion_dias) && f.duracion_dias >= 7,
    explicacion: { es: 'Niño menor de 5 años con fiebre de 7 días o más.', nah: '' },
    accion: { es: 'Llevar HOY a la unidad de salud para buscar la causa de la fiebre.', nah: '' },
    fuente: `${CITE.ICCM}, p. 6 ("Fever for last 7 days or more" = DANGER SIGN, refer); ${CITE.IMCI_2014}, p. 8 del PDF ("If fever is present every day for more than 7 days, refer for assessment")`,
    fuente_url: SRC.ICCM,
    needs: ['fiebre', 'duracion_dias', 'edad_meses'],
    fidelidad: 'adaptado',
  },
  {
    id: 'IMCI-MEAS-01',
    block: 'fever',
    level: 'centro_hoy',
    applies: (f) => hasFever(f) && has(f, 'sarpullido') && anyOf(f, 'tos', 'escurrimiento_nasal', 'ojos_rojos', 'adenomegalias'),
    explicacion: { es: 'Fiebre con ronchas en todo el cuerpo y tos, mocos, ojos rojos o bolitas detrás de las orejas o en el cuello: posible sarampión (caso probable).', nah: '' },
    accion: {
      es: 'Llevar HOY a la unidad de salud (necesita vitamina A y notificación en 24 horas). Avisar al centro de salud antes de llegar; tapar boca y nariz; no esperar en la sala junto a bebés o embarazadas.',
      nah: '',
    },
    fuente: `${CITE.IMCI_2014}, p. 8 del PDF ("Generalized rash and one of these: cough, runny nose, or red eyes" → MEASLES, dar vitamina A); ${CITE.IMSS_SARAMPION}: "Caso probable de sarampión": fiebre y exantema con "tos, coriza, conjuntivitis o adenomegalias", cualquier edad; "Notificar inmediatamente los casos probables en las primeras 24 horas"`,
    fuente_url: SRC.IMCI_2014,
    needs: ['fiebre', 'sarpullido', 'tos', 'escurrimiento_nasal', 'ojos_rojos', 'adenomegalias'],
    context: ['sarpullido'],
    fidelidad: 'adaptado',
  },
  {
    id: 'IMCI-MEAS-02',
    block: 'fever',
    level: 'urgencia',
    applies: (f) =>
      has(f, 'ojo_nublado') ||
      (has(f, 'ulceras_boca_extensas') && ((hasFever(f) && has(f, 'sarpullido')) || has(f, 'sarampion_reciente'))),
    explicacion: { es: 'Ojo nublado (córnea opaca), o llagas profundas/extensas en la boca con sarampión ahora o en los últimos 3 meses: posible sarampión complicado.', nah: '' },
    accion: { es: REFER_NOW, nah: '' },
    fuente: `${CITE.IMCI_2014}, p. 8 del PDF ("If the child has measles now or within the last 3 months… Clouding of cornea or Deep or extensive mouth ulcers → SEVERE COMPLICATED MEASLES, refer URGENTLY")`,
    fuente_url: SRC.IMCI_2014,
    needs: ['fiebre', 'sarpullido', 'sarampion_reciente', 'ojo_nublado', 'ulceras_boca_extensas'],
    context: ['ulceras_boca_extensas'],
    // adaptado: el ojo nublado solo basta (sin exigir sarampión confirmado), porque es urgente por cualquier causa.
    fidelidad: 'adaptado',
  },
  {
    id: 'NICE-FEV-RASH-01',
    block: 'fever',
    level: 'urgencia',
    applies: (f) => hasFever(f) && has(f, 'petequias'),
    explicacion: { es: 'Fiebre con puntitos rojos o manchas moradas que no se borran al apretar: posible infección grave (meningococo, sepsis), dengue grave o rickettsiosis.', nah: '' },
    accion: { es: `${REFER_NOW} No dar aspirina ni antiinflamatorios.`, nah: '' },
    fuente: `${CITE.NICE_NG143}, tabla 2 (alto riesgo, "rojo": "Non-blanching rash") y rec. 1.2.18 ("Consider meningococcal disease in any child with fever and a non-blanching rash"); rec. 1.4.3 ("red" → referir urgentemente)`,
    fuente_url: SRC.NICE_NG143,
    needs: ['fiebre', 'temperatura_c', 'petequias'],
    context: ['fiebre'],
    // adaptado: guía británica para <5 años; aquí aplica a cualquier edad. Choca con OPS (petequias = dengue sin signos de alarma).
    fidelidad: 'adaptado',
  },
];
