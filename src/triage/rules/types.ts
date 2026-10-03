import type { Findings, Lang, TriageLevel } from '../../types';

export type RuleBlock =
  | 'general_danger'
  | 'respiratory_child'
  | 'diarrhea'
  | 'fever'
  | 'young_infant'
  | 'pregnancy'
  | 'dengue'
  | 'adult';

export interface Rule {
  id: string;
  block: RuleBlock;
  level: TriageLevel;
  /** Debe ser determinista y tratar undefined como "no se sabe" (nunca como positivo). */
  applies: (f: Findings) => boolean;
  explicacion: Record<Lang, string>;
  accion: Record<Lang, string>;
  /** Cita corta legible, con sección/página. */
  fuente: string;
  /** URL que se consultó realmente al construir la regla. */
  fuente_url: string;
  /** Campos que la regla lee (claves de síntomas o campos de Findings). */
  needs?: string[];
  /**
   * Síntomas que, si están presentes, hacen que valga la pena preguntar los `needs` faltantes
   * aunque ninguno de ellos sea conocido (p. ej. tos → preguntar tiraje).
   */
  context?: string[];
  /** 'verbatim' = criterio y nivel tal cual la fuente; 'adaptado' = ver docs/clinical-sources.md. */
  fidelidad: 'verbatim' | 'adaptado';
}
