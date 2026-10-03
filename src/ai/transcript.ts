/**
 * Limpieza de transcripciones de Whisper (puro, testeable en Node).
 * Whisper alucina frases de subtítulos con silencio o ruido y a veces repite en bucle.
 */

/** Frases que Whisper inventa en español con silencio (vistas en datasets de subtítulos). */
const HALLUCINATIONS = [
  /subt[ií]tulos? (realizados|hechos|creados)? ?por.*$/i,
  /amara\.org/i,
  /suscr[ií]bete.*$/i,
  /gracias por (ver|mirar)( el v[ií]deo)?\.?/i,
  /^\s*¡?gracias\.?!?\s*$/i,
  /^\s*\.+\s*$/,
  /\[(m[uú]sica|aplausos|risas|silencio)\]/gi,
  /\((m[uú]sica|aplausos|risas|silencio)\)/gi,
];

/** Quita repeticiones consecutivas de 1 a 6 palabras ("de la historia de la historia ..."). */
export function collapseRepeats(text: string): string {
  let words = text.split(/\s+/).filter(Boolean);
  for (let n = 6; n >= 1; n--) {
    const out: string[] = [];
    let i = 0;
    while (i < words.length) {
      out.push(...words.slice(i, i + n));
      let j = i + n;
      const key = (a: number) => words.slice(a, a + n).join(' ').toLowerCase().replace(/[.,;!?¡¿]/g, '');
      const k = key(i);
      // salta copias consecutivas (deja máximo 2)
      let reps = 1;
      while (j + n <= words.length && key(j) === k) {
        reps++;
        if (reps <= 2) out.push(...words.slice(j, j + n));
        j += n;
      }
      i = j;
    }
    words = out;
  }
  return words.join(' ');
}

export function cleanTranscript(text: string): string {
  let t = (text ?? '').replace(/\s+/g, ' ').trim();
  for (const re of HALLUCINATIONS) t = t.replace(re, ' ');
  t = collapseRepeats(t.replace(/\s+/g, ' ').trim());
  return t.replace(/\s+([.,;!?])/g, '$1').trim();
}

/** RMS de la señal: por debajo de ~0.004 es prácticamente silencio (no vale la pena transcribir). */
export function rms(audio: Float32Array): number {
  if (!audio.length) return 0;
  let s = 0;
  for (let i = 0; i < audio.length; i++) s += audio[i] * audio[i];
  return Math.sqrt(s / audio.length);
}

/** Normaliza el volumen (pico a ~0.9) para voces bajas; no amplifica ruido de silencio. */
export function normalizeGain(audio: Float32Array): Float32Array {
  let peak = 0;
  for (let i = 0; i < audio.length; i++) { const a = Math.abs(audio[i]); if (a > peak) peak = a; }
  if (peak < 0.02 || peak > 0.5) return audio;
  const g = Math.min(0.9 / peak, 10);
  const out = new Float32Array(audio.length);
  for (let i = 0; i < audio.length; i++) out[i] = audio[i] * g;
  return out;
}
