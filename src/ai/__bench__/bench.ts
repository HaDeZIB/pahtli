// Banco de pruebas de desarrollo (no entra al build). Abrir /src/ai/__bench__/bench.html con `vite`.
// Los .wav no se versionan: generarlos con `say` (ver docs/ai.md §8).
import { getCapabilities } from '../capability';
import { loadSTT, transcribe, sttStats } from '../stt';
import { loadLLM, llmExtract, llmStats } from '../llm';
import { keywordExtract } from '../keywords';
import { mergeFindings } from '../extractor';

const out = document.getElementById('out')!;
const log = (s: string) => { out.textContent += s + '\n'; console.log(s); };
(window as unknown as { benchResults: unknown[] }).benchResults = [];
const results = (window as unknown as { benchResults: unknown[] }).benchResults;

function readWav(buf: ArrayBuffer): Float32Array {
  const dv = new DataView(buf);
  let off = 12;
  while (off < dv.byteLength) {
    const id = String.fromCharCode(dv.getUint8(off), dv.getUint8(off + 1), dv.getUint8(off + 2), dv.getUint8(off + 3));
    const sz = dv.getUint32(off + 4, true);
    if (id === 'data') {
      const n = sz / 2;
      const f = new Float32Array(n);
      for (let i = 0; i < n; i++) f[i] = dv.getInt16(off + 8 + i * 2, true) / 32768;
      return f;
    }
    off += 8 + sz;
  }
  return new Float32Array(0);
}

document.getElementById('caps')!.onclick = async () => log(JSON.stringify(await getCapabilities(), null, 1));

document.getElementById('stt')!.onclick = async () => {
  const t0 = performance.now();
  await loadSTT('A', (p, m) => { if (Math.round(p * 100) % 20 === 0) log(`stt ${Math.round(p * 100)}% ${m}`); });
  log(`STT cargado en ${Math.round(performance.now() - t0)} ms (${sttStats.model})`);
  for (const i of [1, 2, 3, 4, 5, 6]) for (const v of ['Paul', 'Eddy']) {
    const a = readWav(await (await fetch(`./p${i}_${v}.wav`)).arrayBuffer());
    const t1 = performance.now();
    const text = await transcribe(a);
    const ms = Math.round(performance.now() - t1);
    results.push({ kind: 'stt', file: `p${i}_${v}`, audio_s: a.length / 16000, ms, text });
    log(`p${i}_${v} (${(a.length / 16000).toFixed(1)} s audio) ${ms} ms | ${text}`);
  }
};

const HARD = [
  'La criatura está bien aguadita, no tiene fuerzas ni para llorar.',
  'Le cuesta mucho jalar el aire y se le ven las costillas cuando respira.',
  'Anda con el estómago revuelto y obrando pura agua desde la mañana.',
  'Se le pusieron las uñas y la boca azulitas.',
  'El bebé tiene la mollera sumida y no ha hecho pipí en todo el día.',
  'Le arde mucho cuando hace del uno.',
  'Se le durmió la mitad de la cara y no le entiendo cuando habla.',
  'Trae mucha temperatura y está temblando, no quiere comer.',
];
const PHRASES0 = [
  'La niña tiene un año, tiene calentura desde ayer y respira muy rápido, se le hunde el pecho.',
  'Es un bebé de ocho meses, anda suelto del estómago desde hace tres días y tiene los ojitos hundidos.',
  'Señora de cuarenta años, le duele el pecho y tiene sudor frío.',
  'Está embarazada de siete meses, le duele mucho la cabeza y ve lucecitas.',
  'El niño de dos años tiene tos y mocos, no tiene fiebre, come bien.',
  'Don José tiene la boca chueca y no puede mover el brazo derecho desde hace una hora.',
  'El chamaco anda muy decaído, no quiere ni el agua y lo veo como privado, no despierta bien.',
  'A la señora se le rompió la fuente y está sangrando mucho por abajo, tiene 36 semanas.',
  'Mi niño de tres años se cayó de la azotea y está vomitando, tiene sangre en la cabeza.',
  'Tiene calentura bien alta, le duelen los huesos y detrás de los ojos, y le salieron puntitos rojos.',
  'El bebé de tres semanas no quiere mamar, está frío y casi no se mueve.',
  'Doña Rosa tiene tos con flemas desde hace tres semanas y ha bajado de peso, no tiene calentura.',
];

document.getElementById('llm')!.onclick = async () => {
  const t0 = performance.now();
  const ok = await loadLLM('A', (p, m) => { const pc = Math.round(p * 100); if (pc % 10 === 0) log(`llm ${pc}% ${m}`); });
  log(`LLM ok=${ok} en ${Math.round(performance.now() - t0)} ms ${llmStats.model ?? ''} ${llmStats.lastError ?? ''}`);
  if (!ok) return;
  for (const p of (location.hash === '#hard' ? HARD : PHRASES0)) {
    const t1 = performance.now();
    const r = await llmExtract(p);
    const ms = Math.round(performance.now() - t1);
    const kw = keywordExtract(p);
    const merged = mergeFindings(kw, r?.findings, p);
    results.push({ kind: 'llm', text: p, ms, raw: llmStats.lastRaw, llm: r, kw, merged, stats: { ...llmStats } });
    log(`\n${p}\n  ${ms} ms · prompt ${llmStats.promptTokens} tok · prefill ${llmStats.prefillTps?.toFixed(0)} tok/s · decode ${llmStats.decodeTps?.toFixed(1)} tok/s\n  raw: ${llmStats.lastRaw}\n  kw : ${JSON.stringify(kw)}\n  mix: ${JSON.stringify(merged)}\n  hint: ${r?.level_hint}`);
  }
};
