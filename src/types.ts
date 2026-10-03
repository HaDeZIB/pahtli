/**
 * CONTRATO COMPARTIDO — todos los módulos dependen de estos tipos.
 * No cambiar sin coordinar: UI, ai/, triage/, db/ y eval/ los usan.
 */

export type TriageLevel = 'aqui' | 'centro_hoy' | 'urgencia';
export const LEVEL_RANK: Record<TriageLevel, number> = { aqui: 0, centro_hoy: 1, urgencia: 2 };

export type Lang = 'es' | 'nah';

/** Hallazgos clínicos estructurados. undefined = no se sabe (no preguntado). */
export interface Findings {
  edad_meses?: number;
  sexo?: 'F' | 'M';
  embarazada?: boolean;
  semanas_embarazo?: number;
  /** Duración del cuadro principal en días */
  duracion_dias?: number;
  temperatura_c?: number;
  resp_por_min?: number;
  // Las claves booleanas de síntomas/signos se definen en src/triage/findings.ts (SYMPTOM_KEYS).
  sintomas: Partial<Record<SymptomKey, boolean>>;
}

/** Catálogo cerrado de síntomas/signos. Definido y documentado en src/triage/findings.ts */
export type SymptomKey = string;

export interface FiredRule {
  id: string;
  level: TriageLevel;
  explicacion: Record<Lang, string>;
  accion: Record<Lang, string>;
  fuente: string;        // cita corta legible
  fuente_url?: string;
}

export interface FollowUpQuestion {
  /** Campo que responde: una SymptomKey o 'edad_meses' | 'resp_por_min' | 'embarazada' | ... */
  campo: string;
  tipo: 'si_no' | 'numero' | 'contar_respiraciones';
  pregunta: Record<Lang, string>;
  porque: string; // qué regla la necesita
}

export interface TriageResult {
  level: TriageLevel;
  fired: FiredRule[];            // reglas que dispararon (ordenadas por gravedad)
  preguntas: FollowUpQuestion[]; // máximo 2, solo si cambian el resultado
  /** nivel sugerido por el modelo (solo puede subir) */
  model_level?: TriageLevel;
  escalated_by_model: boolean;
}

/** Salida del extractor (texto libre -> Findings) */
export interface ExtractionResult {
  findings: Findings;
  method: 'llm' | 'keywords' | 'llm+keywords';
  model_level_hint?: TriageLevel;
  latency_ms: number;
  raw?: string;
}

export interface CaseRecord {
  case_id: string;          // uuid generado en el dispositivo
  created_at: string;       // ISO
  comunidad: string;
  lat?: number; lng?: number;
  transcript: string;
  findings: Findings;
  result: Pick<TriageResult, 'level' | 'escalated_by_model'> & { rule_ids: string[] };
  sindrome?: Syndrome;      // para vigilancia epidemiológica
  device_tier: DeviceTier;
  synced: boolean;
  /** Decisión humana sobre el nivel sugerido (la promotora decide). Opcional: casos viejos no la tienen. */
  decision?: CaseDecision;
  /** true si Pahtli mostró "No estoy segura — consulta al personal de salud" (src/triage/uncertainty.ts). */
  uncertain?: boolean;
  /** Motivos legibles de la incertidumbre (español). Se quedan en el celular. */
  uncertainty_reasons?: string[];
  /** Códigos cortos de los motivos (UncertaintyCode en src/triage/uncertainty.ts). Es lo que se sincroniza. */
  uncertainty_codes?: string[];
}

/** Decisión de la promotora sobre el nivel. `result.level` sigue siendo lo que sugirieron las reglas. */
export interface CaseDecision {
  final_level: TriageLevel;
  overridden: boolean;
  /** Código del motivo de una lista cerrada (ver OVERRIDE_REASONS en src/i18n/strings.ts). Seguro para sincronizar. */
  reason?: string;
  /** Texto libre opcional de la promotora. Puede contener nombres: se queda en el celular, no se sincroniza. */
  note?: string;
  decided_at?: string;
}

export type Syndrome =
  | 'respiratorio' | 'diarreico' | 'diarrea_sangre' | 'febril' | 'febril_hemorragico'
  | 'obstetrico' | 'neurologico' | 'cardiovascular' | 'trauma' | 'otro';

export type DeviceTier = 'A' | 'B' | 'C';
