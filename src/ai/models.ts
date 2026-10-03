/**
 * Catálogo de modelos on-device. Tamaños medidos en Hugging Face (API de archivos, oct-2026);
 * ver docs/ai.md para fuentes y criterios.
 */
import type { DeviceTier } from '../types';

export type SttModelKey = 'whisper-base' | 'whisper-tiny';

export interface SttModel {
  repo: string;
  label: string;
  /** descarga aprox. (encoder + decoder_merged cuantizados q8 + tokenizer/config) */
  sizeMB: number;
  dtype: Record<string, string>;
}

export const STT_MODELS: Record<SttModelKey, SttModel> = {
  // encoder_model_quantized 23.2 MB + decoder_model_merged_quantized 53.7 MB
  'whisper-base': { repo: 'onnx-community/whisper-base', label: 'Whisper base (multilingüe, q8)', sizeMB: 79, dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' } },
  // encoder_model_quantized 10.1 MB + decoder_model_merged_quantized 30.7 MB
  'whisper-tiny': { repo: 'onnx-community/whisper-tiny', label: 'Whisper tiny (multilingüe, q8)', sizeMB: 43, dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' } },
};

export interface LlmModel {
  id: string;
  label: string;
  /** descarga (suma de shards en HF) */
  sizeMB: number;
  /** vram_required_MB de prebuiltAppConfig de @mlc-ai/web-llm 0.2.85 */
  vramMB: number;
  needsF16: boolean;
}

export const LLM_MODELS: Record<string, LlmModel> = {
  'Qwen2.5-0.5B-Instruct-q4f16_1-MLC': { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 0.5B Instruct (q4f16)', sizeMB: 290, vramMB: 945, needsF16: true },
  'Qwen2.5-0.5B-Instruct-q4f32_1-MLC': { id: 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC', label: 'Qwen2.5 0.5B Instruct (q4f32)', sizeMB: 290, vramMB: 1060, needsF16: false },
  'Llama-3.2-1B-Instruct-q4f16_1-MLC': { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 1B Instruct (q4f16)', sizeMB: 705, vramMB: 879, needsF16: true },
  'Llama-3.2-1B-Instruct-q4f32_1-MLC': { id: 'Llama-3.2-1B-Instruct-q4f32_1-MLC', label: 'Llama 3.2 1B Instruct (q4f32)', sizeMB: 705, vramMB: 1129, needsF16: false },
  // Medido peor en nuestro banco (ver docs/ai.md). Seleccionable con localStorage 'pahtli:llm_model'.
  'gemma3-1b-it-q4f16_1-MLC': { id: 'gemma3-1b-it-q4f16_1-MLC', label: 'Gemma 3 1B IT (q4f16)', sizeMB: 602, vramMB: 711, needsF16: true },
};

/** Único de los probados que parafrasea con sentido en español (banco del 3-oct-2026, docs/ai.md). */
export const LLM_DEFAULT = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
export const LLM_FALLBACK_F32 = 'Llama-3.2-1B-Instruct-q4f32_1-MLC';

function lsGet(k: string): string | null {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null; } catch { return null; }
}

/** Whisper base en A y B (tiny alucina bucles en español, ver docs/ai.md); tiny solo si la RAM reportada es <= 2 GB. */
export function sttModelFor(tier: DeviceTier, deviceMemoryGB?: number): SttModelKey {
  const o = lsGet('pahtli:stt_model');
  if (o === 'whisper-base' || o === 'whisper-tiny') return o;
  if (tier === 'C') return 'whisper-tiny';
  if (deviceMemoryGB !== undefined && deviceMemoryGB <= 2) return 'whisper-tiny';
  return 'whisper-base';
}

export function llmModelFor(shaderF16: boolean): LlmModel {
  const o = lsGet('pahtli:llm_model');
  if (o && LLM_MODELS[o] && (shaderF16 || !LLM_MODELS[o].needsF16)) return LLM_MODELS[o];
  return LLM_MODELS[shaderF16 ? LLM_DEFAULT : LLM_FALLBACK_F32];
}
