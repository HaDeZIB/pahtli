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
  referral_note: 'Distancia en línea recta, no por carretera; confirma que haya personal antes de salir. Catálogo CLUES, Secretaría de Salud.',
  referral_straight: 'en línea recta',
  referral_uncertain: 'Centro de salud más cercano para consultar',

  unc_title: 'No estoy segura',
  unc_sub: 'Consulta al personal de salud',
  unc_banner: '⚪ No estoy segura — consulta al personal de salud',
  unc_also: '⚪ Además, no estoy segura de todo — consulta al personal de salud',
  unc_why: 'Por qué no estoy segura',
  unc_rules_say: 'Con los datos que hay, las reglas dicen:',
  unc_call: 'Llamar al centro de salud',
  unc_no_phone: 'Agrega el teléfono del centro de salud en Ajustes para llamar desde aquí.',
  unc_hint: 'Pahtli no adivina. Revisa al paciente con una persona del centro de salud antes de decidir.',

  hitl_title: 'Pahtli sugiere. Tú decides.',
  hitl_suggests: 'Pahtli sugiere:',
  hitl_agree: 'Estoy de acuerdo · Guardar caso',
  hitl_change: 'Cambiar nivel',
  hitl_pick_level: '¿Qué nivel decides?',
  hitl_pick_reason: '¿Por qué? (obligatorio)',
  hitl_note: 'Nota (opcional, sin nombres del paciente)',
  hitl_save_change: 'Guardar con mi decisión',
  hitl_cancel: 'Cancelar',
  hitl_your_decision: 'Tu decisión',
  hitl_changed_from: 'cambiado de {from}',
  hitl_downgrade_warn: 'Vas a bajar una urgencia. Confirma que revisaste los signos de peligro con el paciente.',
  hitl_need_reason: 'Elige un motivo.',
  hitl_same_level: 'Es el mismo nivel que sugiere Pahtli. Usa “Estoy de acuerdo”.',

  about_link: 'Acerca de la IA',
  about_title: 'Acerca de la IA',

  history_export: 'Exportar para DHIS2 (JSON)',
  history_export_hint: 'Archivo en formato DHIS2 Tracker (eventos). Sin texto libre; ubicación redondeada a ~1 km.',
  history_overridden: 'Nivel cambiado por la promotora',
  history_uncertain: 'No segura',

  lock_title: 'Pahtli está bloqueado',
  lock_hint: 'Escribe tu PIN de 4 números',
  lock_wrong: 'PIN incorrecto',
  lock_wait: 'Demasiados intentos. Espera {s} s.',
  lock_forgot: '¿Olvidaste el PIN? Borra los datos desde la pantalla de bloqueo: se pierden los casos de este celular.',
  lock_wipe: 'Olvidé mi PIN: borrar datos',

  privacy_title: 'Privacidad',
  privacy_pin: 'PIN para abrir Pahtli',
  privacy_pin_hint: 'Se pide al abrir y después de 5 minutos fuera de la app.',
  privacy_pin_set: 'Poner PIN',
  privacy_pin_change: 'Cambiar PIN',
  privacy_pin_remove: 'Quitar PIN',
  privacy_pin_on: 'PIN activo',
  privacy_pin_new: 'PIN nuevo (4 números)',
  privacy_pin_repeat: 'Repite el PIN',
  privacy_pin_mismatch: 'Los PIN no coinciden.',
  privacy_pin_unsupported: 'Este navegador no permite PIN (se necesita https).',
  privacy_retention: 'Borrar casos ya enviados después de',
  privacy_retention_days: '{n} días',
  privacy_retention_hint: 'Los casos que aún no se envían nunca se borran solos.',
  privacy_centro_tel: 'Teléfono del centro de salud',
  privacy_coords: 'Al enviar, la ubicación se redondea a ~1 km. El texto libre y tu nombre nunca salen del celular.',
  privacy_wipe: 'Borrar todos los datos de este celular',
  privacy_wipe_confirm: '¿Borrar todos los casos, ajustes y el PIN de este celular? No se puede deshacer.',
  privacy_wipe_pending: 'Hay {n} casos sin enviar: se perderán.',
  privacy_wipe_pending_one: 'Hay 1 caso sin enviar: se perderá.',
  privacy_wipe_yes: 'Sí, borrar todo',
  privacy_wiped: 'Datos borrados',
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
  config_sync_title: 'Envío al centro de salud',
  config_sync_hint: 'Clave de inscripción de este celular. La da la Jurisdicción Sanitaria. Si el servidor la pide y falta, los casos se quedan guardados aquí hasta que la escribas.',
  config_sync_token: 'Clave de inscripción',
  config_sync_on: 'Inscrito',
  config_sync_save: 'Guardar clave',
  config_sync_remove: 'Quitar clave',
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

/** Estado "No estoy segura" (no es un nivel de triaje: el nivel de las reglas se sigue mostrando). Blanco sobre #475569 = 7.6:1 */
export const UNCERTAIN_META = { bg: '#475569', fg: '#ffffff', soft: '#e2e8f0', softFg: '#1e293b', emoji: '⚪' } as const;

/** Motivos cerrados para cambiar el nivel (el código se puede sincronizar; el texto libre no). */
export const OVERRIDE_REASONS: { code: string; es: string }[] = [
  { code: 'vi_mas_grave', es: 'Vi al paciente más grave' },
  { code: 'vi_menos_grave', es: 'Vi al paciente menos grave' },
  { code: 'faltaron_datos', es: 'Faltaron datos en lo que dije' },
  { code: 'app_entendio_mal', es: 'La app entendió mal' },
  { code: 'indicacion_personal', es: 'Lo indicó el personal de salud' },
  { code: 'otro', es: 'Otro motivo' },
];
export const overrideReasonLabel = (code?: string) => OVERRIDE_REASONS.find((r) => r.code === code)?.es ?? code ?? '';

export function levelLabel(l: TriageLevel, lang: Lang = 'es', short = false): string {
  return t(`level_${l}${short ? '_short' : ''}` as StringKey, lang);
}
export function levelSub(l: TriageLevel, lang: Lang = 'es'): string {
  return t(`level_${l}_sub` as StringKey, lang);
}
