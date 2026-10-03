import type { Findings, Syndrome } from '../types';
import { anyOf, hasFever, isNum, isPostpartum, isPregnant } from './rules/helpers';

const OBSTETRIC_SIGNS = [
  'sangrado_vaginal', 'salida_liquido_vaginal', 'movimientos_fetales_disminuidos', 'contracciones',
  'hinchazon_cara_manos', 'dolor_cabeza_intenso', 'vision_borrosa', 'zumbido_oidos', 'dolor_abdominal',
  'dolor_abdominal_intenso', 'sangrado_abundante', 'dolor_pantorrilla', 'pechos_rojos_dolorosos', 'flujo_mal_olor',
  'dolor_epigastrio', 'sangrado_aumenta', 'golpe_caida',
];
const HEMORRHAGIC = ['sangrado_mucosas', 'petequias', 'vomito_sangre', 'heces_negras', 'sangrado_abundante'];
const TRAUMA = ['trauma_grave', 'golpe_caida', 'fractura', 'quemadura', 'mordedura_serpiente', 'mordedura_animal', 'intoxicacion'];
const NEURO = ['convulsiones', 'inconsciente', 'rigidez_nuca', 'cara_caida', 'debilidad_un_lado', 'dificultad_hablar', 'confusion', 'perdida_equilibrio', 'dolor_cabeza_subito', 'perdida_vision_subita'];
const RESP = ['tos', 'dificultad_respirar', 'respira_rapido', 'tiraje', 'estridor', 'sibilancias', 'cianosis', 'apnea', 'quejido', 'aleteo_nasal'];

/**
 * Síndrome para vigilancia epidemiológica (no es diagnóstico). Orden de prioridad pensado para
 * detectar brotes: diarrea con sangre y febril hemorrágico primero.
 */
export function classifySyndrome(findings: Findings): Syndrome {
  const f: Findings = { ...findings, sintomas: findings?.sintomas ?? {} };
  const fever = hasFever(f);

  if (anyOf(f, 'sangre_heces')) return 'diarrea_sangre';
  if (fever && anyOf(f, ...HEMORRHAGIC)) return 'febril_hemorragico';
  if ((isPregnant(f) || isPostpartum(f)) && anyOf(f, ...OBSTETRIC_SIGNS)) return 'obstetrico';
  if (anyOf(f, ...TRAUMA)) return 'trauma';
  if (anyOf(f, 'dolor_pecho')) return 'cardiovascular';
  if (anyOf(f, ...NEURO)) return 'neurologico';
  if (anyOf(f, ...RESP) || (isNum(f.resp_por_min) && anyOf(f, 'tos'))) return 'respiratorio';
  if (anyOf(f, 'diarrea')) return 'diarreico';
  if (fever) return 'febril';
  if (isPregnant(f) || isPostpartum(f)) return 'obstetrico';
  return 'otro';
}
