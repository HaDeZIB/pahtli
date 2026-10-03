/**
 * npm run eval — corre los casos de eval/cases.jsonl por keywordExtract -> triage (sin LLM)
 * y escribe eval/results.json y eval/results.md. Siempre termina con código 0.
 *
 * Variables de entorno (opcionales):
 *  - EVAL_OUT_DIR: carpeta de salida (por defecto eval/). Útil para guardar una línea base aparte.
 *  - EVAL_HIDE_FAILURES=test_v2: no imprime los fallos por caso de esos splits (solo métricas agregadas),
 *    para medir una línea base sin mirar el held-out.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeMetrics, evaluateCase, parseCases, renderMarkdown, SPLITS, type Metrics } from './lib';

const here = dirname(fileURLToPath(import.meta.url));

function main() {
  const cases = parseCases(readFileSync(join(here, 'cases.jsonl'), 'utf8'));
  const rows = cases.map(evaluateCase);
  const bySplit: Record<string, Metrics> = {};
  for (const s of SPLITS) bySplit[s] = computeMetrics(rows.filter((r) => r.split === s));
  bySplit.total = computeMetrics(rows);
  const generatedAt = new Date().toISOString();
  const outDir = process.env.EVAL_OUT_DIR || here;
  const hide = (process.env.EVAL_HIDE_FAILURES ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  const shownRows = rows.filter((r) => !hide.includes(r.split));

  writeFileSync(join(outDir, 'results.json'), JSON.stringify({ generated_at: generatedAt, pipeline: 'keywordExtract -> triage (no LLM) + assessUncertainty', hidden_failures: hide, metrics: bySplit, cases: shownRows }, null, 2) + '\n');
  writeFileSync(join(outDir, 'results.md'), renderMarkdown(rows, bySplit, generatedAt, { hideFailuresFor: hide }));

  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  console.log('\nPahtli eval — keywordExtract → triage (sin LLM)\n');
  const ci = (c: [number, number]) => `${(c[0] * 100).toFixed(0)}–${(c[1] * 100).toFixed(0)}%`;
  console.log('split    n    exactitud  sub-triaje-URG (IC95 Wilson)  sub-triaje  sobre-triaje  sens.referencia  síntomas  incierto(avisa/n)');
  for (const [s, m] of Object.entries(bySplit)) {
    console.log(
      `${s.padEnd(8)} ${String(m.n).padEnd(4)} ${pct(m.accuracy).padEnd(10)} ${`${m.urgencia_under_triage.count}/${m.urgencia_under_triage.of} (${ci(m.ci.urgencia_under_triage)})`.padEnd(29)} ${pct(m.under_triage.rate).padEnd(11)} ${pct(m.over_triage.rate).padEnd(13)} ${pct(m.referral_sensitivity.rate).padEnd(16)} ${(m.symptoms.of ? pct(m.symptoms.rate) : '—').padEnd(9)} ${m.uncertain_cases.of ? `${m.uncertain_cases.flagged}/${m.uncertain_cases.of}` : '—'}`,
    );
  }
  const fails = shownRows.filter((r) => r.outcome !== 'ok');
  if (hide.length) console.log(`\n(fallos por caso ocultos para: ${hide.join(', ')})`);
  if (fails.length) {
    console.log(`\nFallos (${fails.length}):`);
    for (const r of fails) console.log(`  ${r.id} [${r.split}] ${r.expected_level} → ${r.predicted_level}: ${r.reason}`);
  }
  console.log(`\nEscrito: ${join(outDir, 'results.json')}, ${join(outDir, 'results.md')}\n`);
}

try {
  main();
} catch (e) {
  console.error('eval falló:', e);
}
process.exitCode = 0;
