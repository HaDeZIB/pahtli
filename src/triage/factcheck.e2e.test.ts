/**
 * Frases reales del fact-check clínico (oct-2026): texto → keywordExtract → triage.
 * Cada una salía "aquí" (o un nivel menor que la guía) antes de la corrección.
 * No forman parte del set de eval (90 casos fijos); son una red de regresión aparte.
 */
import { describe, expect, it } from 'vitest';
import { keywordExtract } from '../ai/keywords';
import { triage } from './engine';
import type { TriageLevel } from '../types';

const CASES: [string, TriageLevel][] = [
  ['el recién nacido está muy frío y no quiere comer', 'urgencia'],
  ['bebé de un mes, lo siento frío y morado de los labios', 'urgencia'],
  ['se le hinchan los dos pies al niño de 3 años', 'urgencia'],
  ['el bebé de 20 días está muy aguadito, no tiene fuerza', 'urgencia'],
  ['mi bebé de mes y medio está muy pálido', 'centro_hoy'],
  ['señora embarazada de 30 semanas, le duele la boca del estómago', 'urgencia'],
  ['embarazada de 30 semanas, dolor en el epigastrio', 'urgencia'],
  ['señora embarazada de 20 semanas, se desmayó hace rato', 'urgencia'],
  ['embarazada de 30 semanas, está confundida', 'urgencia'],
  ['señora embarazada de 32 semanas se cayó y se pegó en la panza', 'urgencia'],
  ['dio a luz hace 5 días y cada vez sangra más', 'urgencia'],
  ['recién parida hace 2 semanas, está muy triste, dice que se quiere morir', 'urgencia'],
  ['dio a luz hace 10 días y tiene la cara y las manos hinchadas', 'centro_hoy'],
  ['Hombre de 40 años, ya no tiene calentura, le sangran las encías y se marea al pararse', 'urgencia'],
  ['Señor de 60 años con dolor de panza muy fuerte de repente', 'urgencia'],
  ['Señora de 50 años, de repente no ve de un ojo', 'urgencia'],
  ['niño de 3 años con calentura y manchas moradas en la piel', 'urgencia'],
  ['el niño de 2 años se queja al respirar', 'urgencia'],
  ['bebé de 10 días que no moja el pañal desde ayer', 'centro_hoy'],
];

describe('fact-check: frases que antes se sub-triaban', () => {
  for (const [text, level] of CASES) {
    it(`${level}: ${text}`, () => {
      expect(triage(keywordExtract(text)).level).toBe(level);
    });
  }
});
