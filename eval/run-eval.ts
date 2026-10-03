/**
 * npm run eval — corre los 90 casos de eval/cases.jsonl por keywordExtract -> triage (sin LLM)
 * y escribe eval/results.json y eval/results.md. Siempre termina con código 0.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeMetrics, evaluateCase, parseCases, renderMarkdown, type Metrics } from './lib';

const here = dirname(fileURLToPath(import.meta.url));

function main() {
  const cases = parseCases(readFileSync(join(here, 'cases.jsonl'), 'utf8'));
  const rows = cases.map(evaluateCase);
  const bySplit: Record<string, Metrics> = {
    dev: computeMetrics(rows.filter((r) => r.split === 'dev')),
    test: computeMetrics(rows.filter((r) => r.split === 'test')),
    total: computeMetrics(rows),
  };
  const generatedAt = new Date().toISOString();

  writeFileSync(join(here, 'results.json'), JSON.stringify({ generated_at: generatedAt, pipeline: 'keywordExtract -> triage (no LLM)', metrics: bySplit, cases: rows }, null, 2) + '\n');
  writeFileSync(join(here, 'results.md'), renderMarkdown(rows, bySplit, generatedAt));

  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  console.log('\nPahtli eval — keywordExtract → triage (sin LLM)\n');
  console.log('split  n   exactitud  sub-triaje-URG  sub-triaje  sobre-triaje  sens.referencia');
  for (const [s, m] of Object.entries(bySplit)) {
    console.log(
      `${s.padEnd(6)} ${String(m.n).padEnd(3)} ${pct(m.accuracy).padEnd(10)} ${`${m.urgencia_under_triage.count}/${m.urgencia_under_triage.of}`.padEnd(15)} ${pct(m.under_triage.rate).padEnd(11)} ${pct(m.over_triage.rate).padEnd(13)} ${pct(m.referral_sensitivity.rate)}`,
    );
  }
  const fails = rows.filter((r) => r.outcome !== 'ok');
  if (fails.length) {
    console.log(`\nFallos (${fails.length}):`);
    for (const r of fails) console.log(`  ${r.id} [${r.split}] ${r.expected_level} → ${r.predicted_level}: ${r.reason}`);
  }
  console.log('\nEscrito: eval/results.json, eval/results.md\n');
}

try {
  main();
} catch (e) {
  console.error('eval falló:', e);
}
process.exitCode = 0;
