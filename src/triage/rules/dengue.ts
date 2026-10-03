import type { Findings } from '../../types';
import type { Rule } from './types';
import { anyOf, countGroups, hadFever, isPregnant } from './helpers';
import { CITE, SRC } from './sources';

/** Manifestaciones de la definición de caso sospechoso de dengue (OPS 2020, p. 6). Cada grupo cuenta 1. */
export const DENGUE_MANIFESTATIONS: string[][] = [
  ['nauseas', 'vomito', 'vomito_persistente'],
  ['sarpullido'],
  ['dolor_cabeza', 'dolor_detras_ojos'],
  ['dolor_muscular_articular'],
  ['petequias'],
];

/** Fiebre (actual o de los últimos días) + 2 o más manifestaciones (la parte de la definición que puede evaluar una promotora). */
export const suspectedDengue = (f: Findings) => hadFever(f) && countGroups(f, DENGUE_MANIFESTATIONS) >= 2;

const WARNING = ['dolor_abdominal_intenso', 'vomito_persistente', 'vomita_todo', 'sangrado_mucosas', 'mareo_al_pararse', 'distension_abdominal'];
const SEVERE = ['manos_pies_frios', 'vomito_sangre', 'heces_negras', 'sangrado_abundante', 'dificultad_respirar'];

const REFER_NOW =
  'Referir URGENTE al hospital: conseguir transporte o llamar al 911 ahora. Dar líquidos a sorbos si los tolera. No dar aspirina ni otros antiinflamatorios.';

export const DENGUE_RULES: Rule[] = [
  {
    id: 'PAHO-DEN-01',
    block: 'dengue',
    level: 'urgencia',
    applies: (f) => hadFever(f) && anyOf(f, ...WARNING),
    explicacion: {
      es: 'Fiebre (ahora o en los últimos días, aunque ya se haya quitado) con signos de alarma de dengue: dolor de panza fuerte, vómito persistente, sangrado de encías o nariz, mareo al pararse o panza hinchada.',
      nah: '',
    },
    accion: { es: REFER_NOW, nah: '' },
    fuente: `${CITE.PAHO_DENGUE_2020}, p. 7 (p. 8 del PDF), "Dengue con signos de alarma": "cerca de y preferentemente a la caída de la fiebre" — dolor abdominal intenso, vómitos persistentes, acumulación de líquidos, sangrado de mucosas, hipotensión postural (lipotimia); p. 9: Grupo B2 → "Hospital o unidades de dengue"`,
    fuente_url: SRC.PAHO_DENGUE_2020,
    needs: ['fiebre', 'fiebre_reciente', ...WARNING],
    context: ['fiebre', 'fiebre_reciente', 'sangrado_mucosas', 'mareo_al_pararse', 'vomito_persistente', 'dolor_abdominal_intenso'],
    fidelidad: 'adaptado',
  },
  {
    id: 'PAHO-DEN-02',
    block: 'dengue',
    level: 'urgencia',
    applies: (f) => hadFever(f) && anyOf(f, ...SEVERE),
    explicacion: {
      es: 'Fiebre (ahora o en los últimos días) con signos de dengue grave: manos y pies fríos (choque), vómito con sangre, popó negra, sangrado abundante o dificultad para respirar.',
      nah: '',
    },
    accion: { es: REFER_NOW, nah: '' },
    fuente: `${CITE.PAHO_DENGUE_2020}, p. 7 (p. 8 del PDF), "Dengue grave": choque o dificultad respiratoria, sangrado grave → UCI; p. 8: Grupo C "remisión de urgencia"`,
    fuente_url: SRC.PAHO_DENGUE_2020,
    needs: ['fiebre', 'fiebre_reciente', ...SEVERE],
    context: ['manos_pies_frios', 'vomito_sangre', 'heces_negras'],
    fidelidad: 'adaptado',
  },
  {
    id: 'PAHO-DEN-03',
    block: 'dengue',
    level: 'centro_hoy',
    applies: (f) => suspectedDengue(f),
    explicacion: {
      es: 'Posible dengue: fiebre con dos o más de — náusea/vómito, ronchas, dolor de cabeza o detrás de los ojos, dolor de cuerpo, puntitos rojos.',
      nah: '',
    },
    accion: {
      es: 'Llevar HOY a la unidad de salud para confirmar y clasificar (es de notificación obligatoria). Dar muchos líquidos. No dar aspirina ni antiinflamatorios. Si aparece dolor de panza fuerte, vómito persistente, sangrado o mareo: URGENCIA.',
      nah: '',
    },
    fuente: `${CITE.PAHO_DENGUE_2020}, p. 6 (p. 7 del PDF), "Definición de caso sospechoso de dengue" y p. 8 (algoritmo de atención)`,
    fuente_url: SRC.PAHO_DENGUE_2020,
    needs: ['fiebre', 'fiebre_reciente', ...DENGUE_MANIFESTATIONS.flat()],
    fidelidad: 'adaptado',
  },
  {
    id: 'PAHO-DEN-04',
    block: 'dengue',
    level: 'urgencia',
    applies: (f) => isPregnant(f) && suspectedDengue(f),
    explicacion: { es: 'Embarazada con posible dengue.', nah: '' },
    accion: { es: REFER_NOW, nah: '' },
    fuente: `${CITE.PAHO_DENGUE_2020}, p. 10 (p. 11 del PDF), "Criterios de hospitalización": dengue + "Embarazo"`,
    fuente_url: SRC.PAHO_DENGUE_2020,
    needs: ['embarazada', 'fiebre', ...DENGUE_MANIFESTATIONS.flat()],
    fidelidad: 'verbatim',
  },
  {
    id: 'PAHO-DEN-05',
    block: 'dengue',
    level: 'urgencia',
    applies: (f) => suspectedDengue(f) && anyOf(f, 'oliguria', 'no_puede_orinar'),
    explicacion: { es: 'Posible dengue y no ha orinado en las últimas 6 horas (o casi nada).', nah: '' },
    accion: { es: REFER_NOW, nah: '' },
    fuente: `${CITE.PAHO_DENGUE_2020}, p. 9 (p. 10 del PDF): el manejo en casa (Grupo A) exige que "Orinan al menos una vez cada 6 horas"; fuera del Grupo A → "Posible remisión a hospital" (B1) u hospital (B2)`,
    fuente_url: SRC.PAHO_DENGUE_2020,
    needs: ['fiebre', 'fiebre_reciente', 'oliguria', ...DENGUE_MANIFESTATIONS.flat()],
    // adaptado: la OPS no dice "urgencia" por oliguria aislada; salir del Grupo A se mapea a urgencia por seguridad.
    fidelidad: 'adaptado',
  },
];
