import type { CaseRecord } from '../types';

/** Une varias fuentes de casos sin duplicar por case_id. La primera fuente gana. Ordena por fecha desc. */
export function mergeCases(...sources: CaseRecord[][]): CaseRecord[] {
  const out = new Map<string, CaseRecord>();
  for (const list of sources) for (const c of list ?? []) if (c?.case_id && !out.has(c.case_id)) out.set(c.case_id, c);
  return [...out.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}
