// Lectura en voz alta con Web Speech API (voces del sistema; en iOS funcionan sin internet).
let cachedVoice: SpeechSynthesisVoice | null | undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const by = (re: RegExp) => voices.filter((v) => re.test(v.lang.replace('_', '-')));
  const mx = by(/^es-MX/i);
  const us = by(/^es-US/i);
  const es = by(/^es/i);
  const pool = mx.length ? mx : us.length ? us : es;
  return pool.find((v) => v.localService) ?? pool[0] ?? null;
}

export function ttsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text: string, onEnd?: () => void): void {
  if (!ttsAvailable()) { onEnd?.(); return; }
  const synth = window.speechSynthesis;
  synth.cancel();
  if (cachedVoice === undefined || cachedVoice === null) cachedVoice = pickVoice();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = cachedVoice?.lang ?? 'es-MX';
  if (cachedVoice) u.voice = cachedVoice;
  u.rate = 0.95;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  synth.speak(u);
}

export function stopSpeaking(): void {
  if (ttsAvailable()) window.speechSynthesis.cancel();
}

if (ttsAvailable()) {
  window.speechSynthesis.addEventListener?.('voiceschanged', () => { cachedVoice = pickVoice(); });
}
