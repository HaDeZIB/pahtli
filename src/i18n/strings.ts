import type { Lang, TriageLevel } from '../types';

/**
 * Textos de la interfaz.
 * Náhuatl: SOLO palabras verificadas en fuente académica (ver NAH_PENDING.md).
 * Si una clave no tiene versión náhuatl verificada, se muestra en español.
 */
const es = {
  app_name: 'Pahtli',
  app_tagline: 'Triaje sin internet',
  nav_capture: 'Evaluar',
  nav_history: 'Casos',
  nav_dashboard: 'Tablero',
  nav_config: 'Ajustes',

  status_offline: 'Sin internet — todo corre en tu celular',
  status_online: 'Con internet',
  status_pending_one: '1 caso por enviar',
  status_pending_many: '{n} casos por enviar',
  status_all_synced: 'Todo enviado',
  status_syncing: 'Enviando…',

  capture_title: 'Nuevo paciente',
  capture_hint: 'Diga edad, síntomas y desde cuándo.',
  capture_example: 'Ej.: “Niña de 1 año, tiene calentura desde ayer y respira muy rápido.”',
  mode_voice: 'Voz',
  mode_text: 'Escribir',
  mode_buttons: 'Botones',
  mic_tap: 'Toque para hablar',
  mic_listening: 'Escuchando… toque para terminar',
  mic_transcribing: 'Pasando a texto…',
  mic_loading: 'Preparando el oído de Pahtli…',
  mic_unavailable: 'La voz no está lista en este celular. Use “Escribir” o “Botones”.',
  mic_denied: 'No hay permiso para el micrófono. Revise los ajustes del navegador.',
  transcript_label: 'Lo que se entendió (puede corregirlo)',
  text_placeholder: 'Escriba aquí lo que tiene el paciente…',
  evaluate: 'Evaluar',
  evaluating: 'Evaluando…',
  clear: 'Borrar',
  age: 'Edad',
  age_years: 'años',
  age_months: 'meses',
  sex: 'Sexo',
  female: 'Mujer',
  male: 'Hombre',
  pregnant: 'Embarazada',
  chips_hint: 'Toque todo lo que tenga el paciente',
  chips_selected: '{n} seleccionados',
  need_input: 'Escriba, hable o elija al menos un síntoma.',

  q_title: 'Una pregunta más',
  q_progress: 'Pregunta {i} de {n}',
  q_why: 'Por qué se pregunta',
  yes: 'Sí',
  no: 'No',
  dont_know: 'No sé',
  skip: 'Saltar',
  next: 'Siguiente',
  number_placeholder: 'Escriba el número',
  breath_title: 'Contar respiraciones',
  breath_instructions: 'Con el niño tranquilo, mire su pecho o panza. Toque el botón cada vez que respire. El reloj cuenta 60 segundos.',
  breath_start: 'Empezar a contar',
  breath_tap: 'Respiró',
  breath_time_left: '{s} s',
  breath_result: '{n} respiraciones por minuto',
  breath_unit: 'respiraciones por minuto',
  breath_use: 'Usar este resultado',
  breath_restart: 'Volver a contar',
  breath_manual: 'Ya las conté, escribir número',

  result_why: 'Por qué',
  result_todo: 'Qué hacer ahora',
  result_source: 'Fuente',
  result_no_rules: 'No se encontraron signos de alarma con los datos dados.',
  result_no_rules_action: 'Atienda aquí, dé recomendaciones y vuelva a revisar si empeora o aparecen signos de alarma.',
  result_model_escalated: 'El modelo de IA detectó algo que sube la gravedad. Por seguridad, se toma el nivel más alto.',
  result_listen: 'Escuchar',
  result_stop: 'Detener',
  result_save: 'Guardar caso',
  result_saved: 'Caso guardado',
  result_new: 'Nuevo paciente',
  result_findings: 'Datos usados',
  result_edit: 'Corregir datos',
  disclaimer: 'Herramienta de apoyo. No sustituye la valoración médica.',
  ondevice: 'Calculado en este celular · {ms} ms',
  referral_title: 'A dónde llevarlo',
  referral_hospital: 'Hospital más cercano',
  referral_center: 'Centro de salud más cercano',
  referral_fallback: 'Si no llega al hospital: primer contacto',
  referral_followup: 'Para seguimiento',
  referral_note: 'Distancia en línea recta (no por carretera). Catálogo CLUES, Secretaría de Salud. Confirme que esté abierto.',
  referral_no_location: 'Guarde la ubicación de la comunidad en Ajustes para ver el centro más cercano.',
  referral_none: 'No hay establecimientos del catálogo cerca de esta ubicación.',

  level_aqui: 'Atender aquí',
  level_centro_hoy: 'Centro de salud hoy',
  level_urgencia: 'Urgencia',
  level_aqui_short: 'Aquí',
  level_centro_hoy_short: 'Centro hoy',
  level_urgencia_short: 'Urgencia',
  level_aqui_sub: 'Se puede atender en la comunidad',
  level_centro_hoy_sub: 'Debe ir al centro de salud hoy mismo',
  level_urgencia_sub: 'Llevar al hospital o centro de salud AHORA',

  history_title: 'Casos guardados',
  history_empty: 'Aún no hay casos guardados.',
  history_synced: 'Enviado',
  history_pending: 'Por enviar',
  history_sync_now: 'Enviar ahora',
  history_sync_offline: 'Se enviarán solos cuando haya señal.',

  config_title: 'Ajustes',
  config_community: 'Comunidad',
  config_community_ph: 'Nombre de la comunidad',
  config_promotora: 'Promotora (opcional)',
  config_promotora_ph: 'Su nombre o clave',
  config_location: 'Ubicación de la comunidad',
  config_location_get: 'Usar mi ubicación',
  config_location_none: 'Sin ubicación',
  config_save: 'Guardar',
  config_saved: 'Guardado',
  config_device: 'Este celular',
  config_tier: 'Nivel',
  config_models: 'Inteligencia en el celular',
  config_models_hint: 'Descárguela una vez con WiFi. Después funciona sin internet.',
  config_stt: 'Voz a texto',
  config_llm: 'Entender síntomas (IA, experimental)',
  config_download: 'Descargar',
  config_ready: 'Listo',
  config_not_available: 'No disponible en este celular',
  config_storage: 'Espacio usado',
  config_airplane: 'Pruebe el modo avión: active el modo avión y haga un caso. Todo debe funcionar igual.',
  config_language: 'Idioma',
  config_nah_note: 'Náhuatl: solo palabras verificadas; lo demás sigue en español mientras lo revisa un hablante.',

  offline_ready: 'Pahtli ya funciona sin internet',
  error_generic: 'Algo falló. Intente de nuevo.',
  back: 'Regresar',
  loading: 'Cargando…',
} as const;

export type StringKey = keyof typeof es;

/**
 * Vocabulario náhuatl verificado. Variante: náhuatl clásico/central.
 * Fuente: Online Nahuatl Dictionary, Wired Humanities Projects, Univ. of Oregon
 * (https://nahuatl.wired-humanities.org/), que reúne Molina (1571), Carochi (1645) y Karttunen (1992).
 */
const nah: Partial<Record<StringKey, string>> = {
  yes: 'Quema',          // "quema. si. afirmando algo" — Molina 1571
  no: 'Amo',             // "amo. no. adverbio para negar" — Molina 1571
  app_name: 'Pahtli',    // pahtli/patli = medicina, remedio
};

/** Palabra de agradecimiento verificada (tlazohcamati = gracias, Wired Humanities). */
export const NAH_THANKS = 'Tlazohcamati';

const dict: Record<Lang, Partial<Record<StringKey, string>>> = { es, nah };

export function t(key: StringKey, lang: Lang = 'es', vars?: Record<string, string | number>): string {
  let s = dict[lang]?.[key] ?? es[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

export interface LevelMeta {
  key: TriageLevel;
  bg: string;      // full-screen background
  fg: string;      // text on bg
  soft: string;    // light tint for chips
  softFg: string;
  emoji: string;
}

// Contrast (WCAG): white on #15803d = 5.0:1, #1c1917 on #f59e0b = 8.9:1, white on #b91c1c = 6.5:1
export const LEVELS: Record<TriageLevel, LevelMeta> = {
  aqui: { key: 'aqui', bg: '#15803d', fg: '#ffffff', soft: '#dcfce7', softFg: '#14532d', emoji: '🟢' },
  centro_hoy: { key: 'centro_hoy', bg: '#f59e0b', fg: '#1c1917', soft: '#fef3c7', softFg: '#78350f', emoji: '🟡' },
  urgencia: { key: 'urgencia', bg: '#b91c1c', fg: '#ffffff', soft: '#fee2e2', softFg: '#7f1d1d', emoji: '🔴' },
};

export function levelLabel(l: TriageLevel, lang: Lang = 'es', short = false): string {
  return t(`level_${l}${short ? '_short' : ''}` as StringKey, lang);
}
export function levelSub(l: TriageLevel, lang: Lang = 'es'): string {
  return t(`level_${l}_sub` as StringKey, lang);
}
