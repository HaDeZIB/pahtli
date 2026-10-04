/**
 * Catálogo cerrado de síntomas/signos (claves de Findings.sintomas).
 *
 * - `es`: etiqueta para la interfaz.
 * - `synonyms`: frases coloquiales (español de México, rural) que usa el extractor por keywords
 *   y el prompt del LLM. Son frases de búsqueda, no definiciones clínicas.
 * - `nah`: SIN DEFINIR a propósito. No hay traducción verificada por hablante nativo (ver docs/clinical-sources.md).
 * - `group`: agrupación para UI y para classifySyndrome.
 *
 * Notas de ambigüedad para el extractor:
 * - "decaído"/"anda decaído" NO se mapea a ningún signo de peligro (es malestar inespecífico).
 * - "le silba el pecho" = sibilancias (no estridor). Estridor = ruido áspero al JALAR aire estando tranquilo.
 * - "aguadito" se usa para heces (diarrea). Para un bebé flácido usar las frases de `no_se_mueve`/`letargico`.
 * - "cuarentena" = puerperio (6 semanas después del parto) en el habla de México.
 */

export type SymptomGroup =
  | 'general'
  | 'respiratorio'
  | 'digestivo'
  | 'hidratacion'
  | 'fiebre'
  | 'piel'
  | 'neurologico'
  | 'embarazo'
  | 'posparto'
  | 'recien_nacido'
  | 'cardiovascular'
  | 'trauma'
  | 'urinario';

export interface SymptomDef {
  es: string;
  nah?: string;
  synonyms: string[];
  group: SymptomGroup;
}

export const SYMPTOMS = {
  // ── Signos generales de peligro ──────────────────────────────────────────
  convulsiones: {
    es: 'Convulsiones (ataques)',
    synonyms: ['convulsiones', 'convulsionó', 'convulsiona', 'ataques', 'le dio un ataque', 'le dan ataques', 'se puso tieso y temblaba', 'se le fueron los ojos', 'se le voltearon los ojos', 'se sacudía', 'temblorinas', 'crisis convulsiva'],
    group: 'general',
  },
  inconsciente: {
    es: 'Inconsciente / no responde',
    synonyms: ['inconsciente', 'no responde', 'no reacciona nada', 'perdió el conocimiento', 'se desvaneció y no despierta', 'no despierta', 'está privado', 'se privó'],
    group: 'general',
  },
  letargico: {
    es: 'Muy dormido, difícil de despertar (letárgico)',
    synonyms: ['letárgico', 'muy dormido', 'anormalmente dormido', 'no se despierta bien', 'cuesta despertarlo', 'muy adormilado', 'somnoliento', 'como trapito', 'está ido', 'no reacciona'],
    group: 'general',
  },
  no_puede_beber: {
    es: 'No puede beber ni mamar',
    synonyms: ['no puede beber', 'no puede tomar nada', 'no toma nada', 'no puede mamar', 'no agarra el pecho', 'ya no agarra la chichi', 'no traga', 'no pasa nada de líquido'],
    group: 'general',
  },
  vomita_todo: {
    es: 'Vomita todo lo que come o bebe',
    synonyms: ['vomita todo', 'todo lo que come lo vomita', 'todo lo que toma lo vomita', 'no retiene nada', 'no le para nada en el estómago', 'devuelve todo'],
    group: 'general',
  },
  palidez_intensa: {
    es: 'Palidez intensa (palmas muy pálidas)',
    synonyms: ['muy pálido', 'blanco como papel', 'palidez intensa', 'las palmas blancas', 'descolorido', 'amarillo pálido de las manos'],
    group: 'general',
  },
  palidez: {
    es: 'Palidez (algo pálido)',
    synonyms: ['pálido', 'paliducho', 'se ve pálido', 'un poco pálido'],
    group: 'general',
  },
  irritable: {
    es: 'Inquieto o irritable',
    synonyms: ['inquieto', 'irritable', 'llora mucho y no se calma', 'está muy chillón', 'muy berrinchudo', 'no se está quieto'],
    group: 'general',
  },
  debilidad_general: {
    es: 'Debilidad general de inicio reciente / no se puede levantar',
    synonyms: ['muy débil', 'no se puede levantar', 'no tiene fuerzas', 'sin fuerza', 'no se para de la cama', 'tirado en la cama'],
    group: 'general',
  },
  desmayo: {
    es: 'Desmayo reciente',
    synonyms: ['se desmayó', 'desmayo', 'se cayó desmayado', 'perdió el sentido un ratito', 'se le fue el mundo'],
    group: 'general',
  },
  dolor_intenso: {
    es: 'Dolor muy fuerte',
    synonyms: ['dolor muy fuerte', 'dolor insoportable', 'grita de dolor', 'no aguanta el dolor'],
    group: 'general',
  },
  sangrado_abundante: {
    es: 'Sangrado abundante (hemorragia)',
    synonyms: ['sangra mucho', 'hemorragia', 'no para de sangrar', 'mucha sangre', 'empapa las toallas', 'chorro de sangre', 'se está desangrando'],
    group: 'general',
  },
  sangrado: {
    es: 'Sangrado que continúa (no abundante)',
    synonyms: ['está sangrando', 'le sale sangre', 'sigue sangrando poquito'],
    group: 'general',
  },
  hinchazon_ambos_pies: {
    es: 'Hinchazón de ambos pies (niño)',
    synonyms: ['pies hinchados', 'hinchado de los dos pies', 'se le hunde el dedo en el pie', 'piecitos hinchados', 'se le hinchan los dos pies', 'se le hincharon los dos pies', 'los dos pies hinchados', 'hinchados los dos pies', 'ambos pies hinchados', 'hinchazón de los dos pies'],
    group: 'general',
  },

  // ── Respiratorio ─────────────────────────────────────────────────────────
  tos: {
    es: 'Tos',
    synonyms: ['tos', 'tose', 'tosiendo', 'tosedera', 'gargajo', 'tos con flemas'],
    group: 'respiratorio',
  },
  dificultad_respirar: {
    es: 'Dificultad para respirar',
    synonyms: ['le cuesta respirar', 'no puede respirar', 'se ahoga', 'le falta el aire', 'se fatiga al respirar', 'batalla para respirar', 'respira con trabajo', 'jadea'],
    group: 'respiratorio',
  },
  respira_rapido: {
    es: 'Respira rápido (referido)',
    synonyms: ['respira rápido', 'respira muy rápido', 'respira agitado', 'respiración acelerada', 'resuella rápido', 'acezando'],
    group: 'respiratorio',
  },
  tiraje: {
    es: 'Tiraje subcostal (se le hunden las costillas al respirar)',
    synonyms: ['se le hunde el pecho', 'se le hunden las costillas', 'se le marcan las costillas', 'se le mete la panza al respirar', 'se le sume el pecho', 'tiraje', 'se le jala abajo de las costillas'],
    group: 'respiratorio',
  },
  estridor: {
    es: 'Estridor (ruido áspero al jalar aire, estando tranquilo)',
    synonyms: ['estridor', 'hace ruido al jalar aire', 'ronca al respirar despierto', 'suena como gallito al respirar', 'ruido áspero al respirar'],
    group: 'respiratorio',
  },
  sibilancias: {
    es: 'Sibilancias (le silba el pecho)',
    synonyms: ['le silba el pecho', 'silbido en el pecho', 'chilla el pecho', 'sibilancias', 'le hace como gatito el pecho', 'le suena el pecho'],
    group: 'respiratorio',
  },
  cianosis: {
    es: 'Se pone morado (cianosis)',
    synonyms: ['se puso morado', 'labios morados', 'se pone morado', 'boca morada', 'se puso azul', 'cianosis', 'amoratado', 'morado de los labios', 'morada de los labios', 'morado de la boca', 'morada de la boca', 'moradito de los labios', 'moradita de los labios'],
    group: 'respiratorio',
  },
  apnea: {
    es: 'Deja de respirar por momentos (apnea)',
    synonyms: ['deja de respirar', 'se le va la respiración', 'pausas al respirar', 'se queda sin respirar'],
    group: 'respiratorio',
  },
  escurrimiento_nasal: {
    es: 'Escurrimiento nasal (mocos)',
    synonyms: ['mocos', 'moquea', 'escurrimiento', 'le escurre la nariz', 'catarro', 'gripa'],
    group: 'respiratorio',
  },

  // ── Digestivo ────────────────────────────────────────────────────────────
  diarrea: {
    es: 'Diarrea',
    synonyms: ['diarrea', 'chorro', 'chorrillo', 'anda suelto del estómago', 'suelto del estómago', 'asientos aguados', 'muchos asientos', 'popó aguada', 'popó aguadita', 'hace aguadito', 'evacuaciones líquidas', 'del baño aguado', 'aguado del estómago'],
    group: 'digestivo',
  },
  sangre_heces: {
    es: 'Sangre en la popó',
    synonyms: ['popó con sangre', 'asientos con sangre', 'diarrea con sangre', 'sangre en el excremento', 'disentería', 'caca con sangre', 'evacuaciones con sangre', 'pujo con sangre'],
    group: 'digestivo',
  },
  vomito: {
    es: 'Vómito',
    synonyms: ['vómito', 'vomita', 'vomitó', 'devuelve', 'arroja', 'guacarea', 'basca'],
    group: 'digestivo',
  },
  vomito_persistente: {
    es: 'Vómito persistente (vomita a cada rato)',
    synonyms: ['no para de vomitar', 'vomita a cada rato', 'vomita y vomita', 'vómitos frecuentes', 'muchos vómitos'],
    group: 'digestivo',
  },
  nauseas: {
    es: 'Náuseas (asco, ganas de vomitar)',
    synonyms: ['náuseas', 'asco', 'ganas de vomitar', 'revuelto el estómago', 'basca'],
    group: 'digestivo',
  },
  dolor_abdominal: {
    es: 'Dolor de panza',
    synonyms: ['dolor de panza', 'dolor de estómago', 'dolor de barriga', 'le duele la panza', 'retortijones', 'cólico', 'dolor de vientre', 'dolor en el bajo vientre'],
    group: 'digestivo',
  },
  dolor_abdominal_intenso: {
    es: 'Dolor de panza muy fuerte o que no se quita',
    synonyms: ['dolor de panza muy fuerte', 'dolor de estómago muy fuerte', 'dolor de panza que no se quita', 'no deja que le toquen la panza', 'se dobla del dolor de panza'],
    group: 'digestivo',
  },
  distension_abdominal: {
    es: 'Panza hinchada o inflada',
    synonyms: ['panza hinchada', 'panza inflada', 'barriga inflada', 'estómago inflamado', 'panza dura e hinchada'],
    group: 'digestivo',
  },
  vomito_sangre: {
    es: 'Vomita sangre',
    synonyms: ['vomita sangre', 'vómito con sangre', 'vómito como café', 'arroja sangre'],
    group: 'digestivo',
  },
  heces_negras: {
    es: 'Popó negra como chapopote',
    synonyms: ['popó negra', 'excremento negro', 'heces negras', 'como chapopote', 'caca negra'],
    group: 'digestivo',
  },

  // ── Hidratación ──────────────────────────────────────────────────────────
  ojos_hundidos: {
    es: 'Ojos hundidos',
    synonyms: ['ojos hundidos', 'ojitos hundidos', 'se le hundieron los ojos', 'ojeroso y hundido'],
    group: 'hidratacion',
  },
  mollera_hundida: {
    es: 'Mollera hundida',
    synonyms: ['mollera hundida', 'se le cayó la mollera', 'mollerita hundida', 'fontanela hundida'],
    group: 'hidratacion',
  },
  sin_lagrimas: {
    es: 'Llora sin lágrimas',
    synonyms: ['llora sin lágrimas', 'no le salen lágrimas'],
    group: 'hidratacion',
  },
  boca_seca: {
    es: 'Boca y lengua secas',
    synonyms: ['boca seca', 'lengua seca', 'labios secos', 'saliva espesa'],
    group: 'hidratacion',
  },
  bebe_con_avidez: {
    es: 'Mucha sed, bebe con desesperación',
    synonyms: ['mucha sed', 'bebe con ganas', 'bebe desesperado', 'se lo toma todo de jalón', 'sed intensa'],
    group: 'hidratacion',
  },
  bebe_mal: {
    es: 'Bebe poco o con dificultad',
    synonyms: ['bebe poquito', 'casi no toma', 'bebe con trabajo', 'no quiere tomar'],
    group: 'hidratacion',
  },
  pliegue_lento: {
    es: 'Al pellizcar la piel de la panza regresa lento',
    synonyms: ['la piel regresa lento', 'el pellizco tarda en bajar', 'pliegue lento'],
    group: 'hidratacion',
  },
  pliegue_muy_lento: {
    es: 'Al pellizcar la piel regresa muy lento (más de 2 segundos)',
    synonyms: ['la piel se queda parada', 'el pellizco se queda marcado', 'tarda más de dos segundos en regresar', 'pliegue muy lento'],
    group: 'hidratacion',
  },
  manos_pies_frios: {
    es: 'Manos y pies fríos, piel fría y sudorosa',
    synonyms: ['manos frías', 'pies fríos', 'manitas frías', 'piel fría y sudada', 'frío y sudoroso'],
    group: 'hidratacion',
  },
  mareo_al_pararse: {
    es: 'Se marea o desmaya al pararse',
    synonyms: ['se marea al pararse', 'se desvanece al levantarse', 'se le nubla al pararse', 'se va de lado al levantarse'],
    group: 'hidratacion',
  },

  // ── Fiebre y piel ────────────────────────────────────────────────────────
  fiebre: {
    es: 'Fiebre (calentura)',
    synonyms: ['fiebre', 'calentura', 'tiene temperatura', 'está caliente', 'está hirviendo', 'arde en calentura', 'tiene calentura', 'febril'],
    group: 'fiebre',
  },
  rigidez_nuca: {
    es: 'Cuello tieso (rigidez de nuca)',
    synonyms: ['cuello tieso', 'no puede doblar el cuello', 'nuca rígida', 'le duele mover el cuello y lo tiene duro', 'cuello duro'],
    group: 'fiebre',
  },
  sarpullido: {
    es: 'Sarpullido / ronchas generalizadas',
    synonyms: ['ronchas', 'sarpullido', 'granitos por todo el cuerpo', 'manchas rojas en la piel', 'brote en la piel', 'salpullido', 'exantema'],
    group: 'piel',
  },
  ojos_rojos: {
    es: 'Ojos rojos',
    synonyms: ['ojos rojos', 'ojos irritados', 'ojos colorados'],
    group: 'fiebre',
  },
  petequias: {
    es: 'Puntitos rojos en la piel que no se borran',
    synonyms: ['puntitos rojos', 'pintitas rojas', 'petequias', 'puntos de sangre en la piel', 'manchas moradas', 'manchitas moradas', 'puntitos morados', 'moretones sin golpearse'],
    group: 'piel',
  },
  sangrado_mucosas: {
    es: 'Sangrado de encías o nariz',
    synonyms: ['sangran las encías', 'le sangra la nariz', 'sangrado de nariz', 'sangrado de encías', 'le sale sangre de la boca'],
    group: 'fiebre',
  },
  dolor_cabeza: {
    es: 'Dolor de cabeza',
    synonyms: ['dolor de cabeza', 'le duele la cabeza', 'jaqueca', 'cefalea'],
    group: 'neurologico',
  },
  dolor_detras_ojos: {
    es: 'Dolor detrás de los ojos',
    synonyms: ['dolor detrás de los ojos', 'le duelen los ojos por dentro', 'dolor de ojos al moverlos'],
    group: 'fiebre',
  },
  dolor_muscular_articular: {
    es: 'Dolor de músculos o articulaciones',
    synonyms: ['dolor de huesos', 'dolor de cuerpo', 'le duelen las coyunturas', 'dolor de articulaciones', 'cuerpo cortado', 'dolor de músculos'],
    group: 'fiebre',
  },
  ojo_nublado: {
    es: 'Ojo nublado (córnea opaca)',
    synonyms: ['ojo nublado', 'ojo blanco opaco', 'tela en el ojo'],
    group: 'fiebre',
  },
  ulceras_boca_extensas: {
    es: 'Llagas en la boca profundas o extensas',
    synonyms: ['llagas en toda la boca', 'boca llena de llagas', 'úlceras profundas en la boca'],
    group: 'fiebre',
  },

  // ── Neurológico ──────────────────────────────────────────────────────────
  confusion: {
    es: 'Confusión de inicio súbito',
    synonyms: ['está confundido', 'no sabe dónde está', 'desvaría', 'dice incoherencias', 'no reconoce', 'se le olvidó todo de repente', 'está confundida', 'confundido', 'confundida', 'desorientado', 'desorientada'],
    group: 'neurologico',
  },
  cara_caida: {
    es: 'Cara caída o boca chueca de un lado',
    synonyms: ['boca chueca', 'se le torció la boca', 'cara caída', 'se le cayó un lado de la cara', 'se le chuequeó la cara'],
    group: 'neurologico',
  },
  debilidad_un_lado: {
    es: 'Debilidad o adormecimiento de un lado del cuerpo',
    synonyms: ['no puede mover el brazo', 'no puede mover la pierna', 'se le durmió medio cuerpo', 'debilidad de un lado', 'se le paralizó un lado', 'no siente el brazo'],
    group: 'neurologico',
  },
  dificultad_hablar: {
    es: 'Dificultad para hablar o entender de repente',
    synonyms: ['no puede hablar bien', 'arrastra las palabras', 'habla trabado', 'no le entiendo lo que dice', 'se le traba la lengua'],
    group: 'neurologico',
  },
  perdida_equilibrio: {
    es: 'Pérdida súbita del equilibrio o no puede caminar',
    synonyms: ['no puede caminar de repente', 'pierde el equilibrio', 'se va de lado al caminar', 'camina como borracho sin tomar'],
    group: 'neurologico',
  },
  dolor_cabeza_subito: {
    es: 'Dolor de cabeza súbito y muy fuerte, sin causa conocida',
    synonyms: ['el peor dolor de cabeza de su vida', 'dolor de cabeza de repente muy fuerte', 'como un trancazo en la cabeza'],
    group: 'neurologico',
  },
  dolor_cabeza_intenso: {
    es: 'Dolor de cabeza muy fuerte (embarazo/posparto)',
    synonyms: ['dolor de cabeza muy fuerte', 'fuerte dolor de cabeza', 'le revienta la cabeza', 'dolor de cabeza que no se quita'],
    group: 'neurologico',
  },
  vision_borrosa: {
    es: 'Visión borrosa o ve lucecitas',
    synonyms: ['ve borroso', 'visión borrosa', 've lucecitas', 've estrellitas', 've puntitos de luz', 'se le nubla la vista'],
    group: 'neurologico',
  },
  zumbido_oidos: {
    es: 'Zumbido de oídos',
    synonyms: ['le zumban los oídos', 'zumbido', 'pitido en los oídos'],
    group: 'neurologico',
  },

  // ── Embarazo ─────────────────────────────────────────────────────────────
  sangrado_vaginal: {
    es: 'Sangrado por la vagina',
    synonyms: ['sangrado vaginal', 'sangra de abajo', 'le bajó sangre', 'manchado con sangre', 'sangrado por sus partes'],
    group: 'embarazo',
  },
  salida_liquido_vaginal: {
    es: 'Salida de líquido por la vagina (se rompió la fuente)',
    synonyms: ['se le rompió la fuente', 'se le reventó la fuente', 'le sale agua', 'se mojó sin orinar', 'salida de líquido'],
    group: 'embarazo',
  },
  movimientos_fetales_disminuidos: {
    es: 'El bebé se mueve menos o no se mueve',
    synonyms: ['el bebé no se mueve', 'ya no siente al bebé', 'el bebé se mueve poco', 'no lo siento moverse'],
    group: 'embarazo',
  },
  contracciones: {
    es: 'Contracciones / dolores de parto',
    synonyms: ['contracciones', 'dolores de parto', 'se le pone dura la panza', 'le empezaron los dolores', 'trabajo de parto'],
    group: 'embarazo',
  },
  hinchazon_cara_manos: {
    es: 'Hinchazón de cara, manos o piernas',
    synonyms: ['cara hinchada', 'manos hinchadas', 'se le hinchan los pies', 'piernas hinchadas', 'está hinchada', 'los anillos no le entran'],
    group: 'embarazo',
  },

  // ── Posparto ─────────────────────────────────────────────────────────────
  posparto: {
    es: 'Dio a luz hace menos de 6 semanas (cuarentena)',
    synonyms: ['acaba de dar a luz', 'está en la cuarentena', 'tuvo a su bebé hace', 'recién parida', 'recién aliviada', 'se alivió hace'],
    group: 'posparto',
  },
  dolor_pantorrilla: {
    es: 'Dolor, enrojecimiento o hinchazón de una pantorrilla',
    synonyms: ['le duele la pantorrilla', 'pantorrilla hinchada', 'pantorrilla roja', 'chamorro hinchado'],
    group: 'posparto',
  },
  pechos_rojos_dolorosos: {
    es: 'Pechos hinchados, rojos o dolorosos',
    synonyms: ['pecho rojo', 'senos hinchados y rojos', 'le duelen los pechos', 'pezón agrietado'],
    group: 'posparto',
  },
  flujo_mal_olor: {
    es: 'Flujo vaginal con mal olor',
    synonyms: ['flujo con mal olor', 'huele feo el sangrado', 'loquios fétidos', 'desecho apestoso'],
    group: 'posparto',
  },

  // ── Recién nacido / lactante menor de 2 meses ────────────────────────────
  no_come_bien: {
    es: 'Bebé que no come bien / mama poco',
    synonyms: ['no come bien', 'mama poquito', 'no quiere mamar', 'se cansa al mamar', 'no quiere el pecho', 'no quiere comer', 'come muy poquito', 'no agarra bien el pecho'],
    group: 'recien_nacido',
  },
  no_se_mueve: {
    es: 'Solo se mueve si lo estimulan o no se mueve',
    synonyms: ['no se mueve', 'solo se mueve si lo mueven', 'está flojito', 'no aguanta la cabeza y no se mueve', 'está como muertito'],
    group: 'recien_nacido',
  },
  se_siente_frio: {
    es: 'Bebé frío al tacto (temperatura baja)',
    synonyms: ['está frío', 'se siente frío', 'heladito', 'temperatura baja', 'está fría', 'se siente fría', 'heladita', 'muy frío', 'muy fría', 'lo siento frío', 'la siento fría', 'frío al tocarlo', 'fría al tocarla'],
    group: 'recien_nacido',
  },
  ictericia: {
    es: 'Color amarillo de piel u ojos',
    synonyms: ['está amarillo', 'ojos amarillos', 'piel amarilla', 'ictericia', 'se puso amarillito'],
    group: 'recien_nacido',
  },
  palmas_plantas_amarillas: {
    es: 'Palmas de las manos y plantas de los pies amarillas',
    synonyms: ['palmas amarillas', 'plantas de los pies amarillas', 'manos y pies amarillos'],
    group: 'recien_nacido',
  },
  ombligo_rojo_pus: {
    es: 'Ombligo rojo o con pus',
    synonyms: ['ombligo rojo', 'ombligo con pus', 'le supura el ombligo', 'ombligo apestoso'],
    group: 'recien_nacido',
  },
  pustulas_piel: {
    es: 'Granitos con pus en la piel',
    synonyms: ['granitos con pus', 'ampollitas con pus', 'pústulas'],
    group: 'recien_nacido',
  },
  llanto_inconsolable: {
    es: 'Llanto que no se calma con nada',
    synonyms: ['llora y no se calma', 'llanto inconsolable', 'no para de llorar'],
    group: 'recien_nacido',
  },

  // ── Cardiovascular ───────────────────────────────────────────────────────
  dolor_pecho: {
    es: 'Dolor u opresión en el pecho',
    synonyms: ['dolor de pecho', 'le duele el pecho', 'opresión en el pecho', 'le aprieta el pecho', 'dolor en el corazón', 'piquete en el pecho', 'angina de pecho'],
    group: 'cardiovascular',
  },
  sudor_frio: {
    es: 'Sudor frío',
    synonyms: ['sudor frío', 'sudoración fría', 'suda frío'],
    group: 'cardiovascular',
  },

  // ── Trauma, mordeduras, intoxicaciones ───────────────────────────────────
  trauma_grave: {
    es: 'Golpe o accidente grave',
    synonyms: ['se cayó de alto', 'lo atropellaron', 'choque', 'accidente', 'golpe fuerte en la cabeza', 'herida de bala', 'machetazo', 'lo apuñalaron'],
    group: 'trauma',
  },
  fractura: {
    es: 'Posible hueso roto / miembro chueco',
    synonyms: ['hueso roto', 'se quebró', 'se fracturó', 'brazo chueco', 'pierna chueca', 'se zafó el hombro'],
    group: 'trauma',
  },
  quemadura: {
    es: 'Quemadura',
    synonyms: ['quemadura', 'se quemó', 'se echó agua hirviendo', 'se quemó con el comal', 'ampollas por quemada'],
    group: 'trauma',
  },
  mordedura_serpiente: {
    es: 'Mordedura de víbora',
    synonyms: ['lo mordió una víbora', 'mordedura de serpiente', 'víbora', 'cascabel', 'nauyaca', 'coralillo'],
    group: 'trauma',
  },
  mordedura_animal: {
    es: 'Mordedura o rasguño de animal (perro, gato, murciélago)',
    synonyms: ['lo mordió un perro', 'mordida de perro', 'lo mordió un gato', 'murciélago', 'mordedura de animal', 'lo arañó un gato'],
    group: 'trauma',
  },
  intoxicacion: {
    es: 'Tomó veneno, químico o plaguicida',
    synonyms: ['tomó veneno', 'se tomó el líquido', 'plaguicida', 'matahierba', 'fumigó y se intoxicó', 'tomó cloro', 'se envenenó', 'se tomó pastillas de más', 'intoxicado'],
    group: 'trauma',
  },

  // ── Urinario ─────────────────────────────────────────────────────────────
  ardor_orinar: {
    es: 'Ardor o molestia al orinar / orina muy seguido',
    synonyms: ['ardor al orinar', 'le arde al hacer pipí', 'orina muy seguido', 'mal de orín', 'molestia al orinar'],
    group: 'urinario',
  },
  no_puede_orinar: {
    es: 'No puede orinar',
    synonyms: ['no puede orinar', 'no hace pipí', 'se le tapó la orina', 'no le sale la orina'],
    group: 'urinario',
  },
  // ── Agregadas tras la verificación de fuentes (fact-check, oct-2026) ─────
  no_orina_no_evacua: {
    es: 'Bebé que no hace pipí o no hace popó',
    synonyms: ['no moja el pañal', 'no ha mojado el pañal', 'pañal seco', 'pañales secos', 'no ha hecho popó', 'no ha evacuado', 'no ha hecho del baño'],
    group: 'recien_nacido',
  },
  bajo_peso_nacer: {
    es: 'Nació con bajo peso',
    synonyms: ['nació bajo de peso', 'nació con bajo peso', 'nació de bajo peso', 'nació muy chiquito', 'nació muy chiquita'],
    group: 'recien_nacido',
  },
  lejos_unidad: {
    es: 'Difícil llegar hoy a la unidad de salud (lejos o sin transporte)',
    synonyms: ['vive lejos', 'vivimos lejos', 'queda lejos el centro de salud', 'está lejos la clínica', 'queda lejos la clínica', 'no hay transporte', 'no tenemos transporte', 'no hay cómo llevarlo', 'no hay cómo llevarla', 'no tenemos cómo llevarlo', 'no tenemos cómo llevarla'],
    group: 'general',
  },
  desnutricion: {
    es: 'Desnutrición (muy flaquito, bajo de peso)',
    synonyms: ['desnutrido', 'desnutrida', 'desnutrición', 'muy flaquito', 'muy flaquita', 'bajo de peso', 'en los puros huesos'],
    group: 'general',
  },
  quejido: {
    es: 'Quejido al respirar (se queja con cada respiración)',
    synonyms: ['se queja al respirar', 'quejido al respirar', 'quejido', 'pujido al respirar', 'puja al respirar', 'gime al respirar', 'se queja con cada respiración'],
    group: 'respiratorio',
  },
  aleteo_nasal: {
    es: 'Aleteo nasal (se le abren las narices al respirar)',
    synonyms: ['aleteo nasal', 'se le abren las narices', 'se le abren las fosas nasales', 'le aletea la nariz', 'mueve las alitas de la nariz'],
    group: 'respiratorio',
  },
  adenomegalias: {
    es: 'Bolitas (ganglios) detrás de las orejas, en la nuca o en el cuello',
    synonyms: ['bolitas detrás de las orejas', 'bolitas en el cuello', 'bolitas en la nuca', 'ganglios inflamados', 'ganglios hinchados', 'ganglios'],
    group: 'fiebre',
  },
  sarampion_reciente: {
    es: 'Sarampión ahora o en los últimos 3 meses',
    synonyms: ['le dio sarampión', 'le dio el sarampión', 'tuvo sarampión', 'tiene sarampión', 'con sarampión', 'enfermo de sarampión', 'enferma de sarampión'],
    group: 'fiebre',
  },
  fiebre_reciente: {
    es: 'Tuvo calentura en los últimos días aunque ya se le quitó',
    synonyms: ['ya no tiene calentura', 'ya se le quitó la calentura', 'se le quitó la calentura', 'le bajó la calentura', 'tuvo calentura', 'tenía calentura', 'ya no tiene fiebre', 'se le quitó la fiebre', 'tuvo fiebre', 'tenía fiebre'],
    group: 'fiebre',
  },
  dolor_epigastrio: {
    es: 'Dolor en la boca del estómago (arriba del ombligo)',
    synonyms: ['boca del estómago', 'dolor en la boca del estómago', 'le duele la boca del estómago', 'ardor en la boca del estómago', 'epigastrio', 'epigastralgia', 'dolor arriba del ombligo'],
    group: 'digestivo',
  },
  golpe_caida: {
    es: 'Golpe o caída',
    synonyms: ['se cayó', 'se resbaló', 'se pegó en la panza', 'se golpeó la panza', 'golpe en la panza', 'le pegaron en la panza', 'le dieron un golpe en la panza', 'la golpearon', 'lo golpearon'],
    group: 'trauma',
  },
  sangrado_aumenta: {
    es: 'Después del parto, el sangrado aumenta en vez de disminuir',
    synonyms: ['cada vez sangra más', 'sangra cada vez más', 'sangra más que antes', 'le aumentó el sangrado', 'el sangrado aumenta', 'coágulos grandes', 'le volvió a bajar mucha sangre'],
    group: 'posparto',
  },
  depresion_grave: {
    es: 'Tristeza profunda / depresión grave',
    synonyms: ['muy triste', 'muy deprimida', 'muy deprimido', 'solo llora', 'no quiere al bebé', 'no se levanta y solo llora', 'depresión'],
    group: 'general',
  },
  ideas_suicidas: {
    es: 'Ideas, plan o intento de quitarse la vida o hacerse daño',
    synonyms: ['se quiere morir', 'dice que se quiere morir', 'se quiere matar', 'se va a matar', 'quiere matarse', 'quiere suicidarse', 'intentó suicidarse', 'se quiso matar', 'se quiere quitar la vida', 'quiere hacerse daño', 'piensa en suicidarse'],
    group: 'general',
  },
  perdida_vision_subita: {
    es: 'Pérdida repentina de la vista (de uno o los dos ojos)',
    synonyms: ['de repente no ve', 'no ve de un ojo', 'se le fue la vista', 'perdió la vista', 'dejó de ver', 'se quedó ciego', 'se quedó ciega'],
    group: 'neurologico',
  },
  llenado_capilar_lento: {
    es: 'Al apretar la uña, tarda más de 3 segundos en volver a ponerse rosa',
    synonyms: ['llenado capilar lento', 'la uña tarda en ponerse rosa', 'tarda en regresar el color de la uña', 'la uña se queda blanca'],
    group: 'hidratacion',
  },
  pulso_debil_rapido: {
    es: 'Pulso débil y rápido',
    synonyms: ['pulso débil', 'pulso muy débil', 'pulso rápido y débil', 'casi no se le siente el pulso', 'pulso débil y rápido'],
    group: 'cardiovascular',
  },
  oliguria: {
    es: 'Orina muy poco (no ha orinado en 6 horas)',
    synonyms: ['no ha orinado en 6 horas', 'no ha hecho pipí en todo el día', 'orina muy poquito', 'casi no orina', 'casi no hace pipí', 'orina poquito'],
    group: 'urinario',
  },

  // ── Ronda 3 (4-oct-2026): molestias comunes de primer nivel (docs/research-common-complaints.md) ──
  // Frases verificadas en el Diccionario del español de México (DEM) cuando se indica; el resto es uso común,
  // NO validado con promotoras. Las claves sin regla propia sirven para los cuidados en casa (src/triage/advice.ts)
  // y para que el relato no salga "no entendí ningún síntoma".
  gases: {
    es: 'Gases o panza "aventada"',
    // DEM "aventado": (Popular) vientre lleno de gases. "inflamado del estómago" en este sentido: uso común.
    synonyms: ['gases', 'muchos gases', 'echa muchos gases', 'echa gases', 'flatulencias', 'pedos', 'anda aventado', 'anda aventada', 'aventado', 'aventada', 'panza aventada', 'inflamado del estómago', 'inflamada del estómago', 'eructa mucho', 'eructos'],
    group: 'digestivo',
  },
  estrenimiento: {
    es: 'Estreñimiento (no ha obrado)',
    // DEM: "obrar" acep. 4 "Defecar"; "tapado" (Popular) "Que está estreñido"; "evacuar".
    synonyms: ['estreñido', 'estreñida', 'estreñimiento', 'está tapado', 'está tapada', 'anda tapado', 'anda tapada', 'no ha obrado', 'no obra', 'no puede obrar', 'no puede hacer del baño', 'no puede hacer popó', 'hace muy duro', 'popó dura', 'le cuesta hacer del baño', 'se estriñe', 'lo estriñe', 'la estriñe'],
    group: 'digestivo',
  },
  no_obra_ni_gases: {
    es: 'No puede hacer del baño ni echar gases',
    synonyms: ['no puede echar gases', 'no echa gases', 'no ha echado gases', 'ni gases echa', 'no puede sacar los gases', 'no le salen los gases', 'no ha podido echar gases', 'ni obra ni echa gases', 'no obra ni echa gases', 'no puede ni echar gases', 'no puede hacer del baño ni echar gases', 'no ha podido hacer del baño ni echar gases', 'no ha hecho del baño ni echado gases', 'no ha obrado ni echado gases', 'no puede obrar ni echar gases', 'no puede hacer popó ni echar gases'],
    group: 'digestivo',
  },
  dolor_derecha_baja: {
    es: 'Dolor de panza abajo a la derecha (o que se pasó del ombligo a la derecha)',
    synonyms: ['abajo a la derecha', 'abajito a la derecha', 'lado derecho de abajo', 'parte baja derecha', 'se le pasó el dolor a la derecha', 'se le bajó el dolor a la derecha', 'le duele del lado derecho de la panza', 'dolor del lado derecho de la panza'],
    group: 'digestivo',
  },
  dolor_al_moverse: {
    es: 'El dolor de panza aumenta al caminar o al toser',
    synonyms: ['le duele más al caminar', 'le duele al caminar', 'le duele al toser', 'le duele más al toser', 'no puede caminar derecho del dolor', 'camina agachado del dolor', 'camina encorvado del dolor'],
    group: 'digestivo',
  },
  dolor_testiculo: {
    es: 'Dolor o hinchazón de un testículo',
    synonyms: ['le duele un testículo', 'le duelen los testículos', 'dolor de testículo', 'dolor en los testículos', 'testículo hinchado', 'se le hinchó un testículo', 'le duelen los huevitos', 'dolor en los huevos', 'dolor en el escroto', 'le duele la bolsa de los testículos'],
    group: 'urinario',
  },
  vomito_verde: {
    es: 'Vomita verde',
    synonyms: ['vomita verde', 'vómito verde', 'vomitó verde', 'vomitando verde', 'vómitos verdes'],
    group: 'digestivo',
  },
  agruras: {
    es: 'Agruras o acidez',
    // DEM "agruras": dolor y ardor principalmente en la boca del estómago.
    synonyms: ['agruras', 'acidez', 'reflujo', 'le sube el ácido', 'le regresa lo agrio', 'ardor en el estómago', 'le arde el estómago'],
    group: 'digestivo',
  },
  dolor_garganta: {
    es: 'Dolor de garganta (anginas)',
    // DEM "angina" acep. 2 (amígdalas). "angina de pecho" (acep. 3) va a dolor_pecho.
    synonyms: ['dolor de garganta', 'le duele la garganta', 'anginas', 'le duelen las anginas', 'anginas inflamadas', 'garganta irritada', 'carraspera', 'garganta inflamada'],
    group: 'respiratorio',
  },
  placas_garganta: {
    es: 'Placas blancas o pus en la garganta',
    synonyms: ['placas blancas en la garganta', 'placas en la garganta', 'placas en las anginas', 'pus en las anginas', 'anginas con pus', 'garganta con pus', 'puntos blancos en la garganta', 'puntitos blancos en las anginas'],
    group: 'respiratorio',
  },
  no_traga_saliva: {
    es: 'No puede tragar ni su saliva, o siente que se le cierra la garganta',
    synonyms: ['no puede tragar ni su saliva', 'no puede pasar la saliva', 'no puede tragar saliva', 'no puede pasar ni la saliva', 'se le cerró la garganta', 'se le cierra la garganta', 'siente que se le cierra la garganta', 'siente la garganta cerrada'],
    group: 'respiratorio',
  },
  babeo: {
    es: 'Babea mucho (mucha saliva)',
    synonyms: ['babea', 'babeando', 'se le escurre la baba', 'mucha baba', 'mucha saliva', 'echa mucha saliva', 'saliva de más'],
    group: 'respiratorio',
  },
  hinchazon_boca_cuello: {
    es: 'Hinchazón o bola en la boca, la garganta, la encía, la quijada o el cuello',
    synonyms: ['bola en el cuello', 'se le hinchó el cuello', 'cuello hinchado', 'se le hinchó la encía', 'encía hinchada', 'se le hinchó la quijada', 'quijada hinchada', 'cachete hinchado', 'se le hinchó el cachete', 'absceso', 'bola en la garganta', 'se le hinchó la cara por la muela'],
    group: 'respiratorio',
  },
  hinchazon_cuello_ojo: {
    es: 'Hinchazón alrededor del ojo o del cuello',
    synonyms: ['se le hinchó el ojo', 'ojo hinchado', 'se le cerró el ojo de lo hinchado', 'se le hinchó alrededor del ojo', 'se le hinchó el cuello', 'cuello hinchado'],
    group: 'respiratorio',
  },
  dolor_muela: {
    es: 'Dolor de muela o de dientes',
    synonyms: ['dolor de muela', 'dolor de muelas', 'le duele una muela', 'le duele la muela', 'muela picada', 'dolor de dientes', 'le duele un diente', 'dolor de diente'],
    group: 'digestivo',
  },
  dolor_oido: {
    es: 'Dolor de oído',
    synonyms: ['dolor de oído', 'dolor de oídos', 'le duele el oído', 'le duelen los oídos', 'le duele su oído'],
    group: 'respiratorio',
  },
  pus_oido: {
    es: 'Le sale pus o líquido del oído',
    synonyms: ['le sale pus del oído', 'le supura el oído', 'le sale agua del oído', 'le sale líquido del oído', 'le escurre el oído', 'oído con pus', 'le sale agua por el oído'],
    group: 'respiratorio',
  },
  sangre_oido: {
    es: 'Le sale sangre del oído',
    synonyms: ['le sale sangre del oído', 'sangre por el oído', 'sangra del oído', 'le sale sangre por el oído'],
    group: 'respiratorio',
  },
  hinchazon_detras_oreja: {
    es: 'Hinchazón dolorosa detrás de la oreja',
    synonyms: ['bola detrás de la oreja', 'se le hinchó detrás de la oreja', 'hinchado detrás de la oreja', 'hinchazón detrás de la oreja'],
    group: 'respiratorio',
  },
  objeto_en_oido: {
    es: 'Tiene algo atorado en el oído',
    synonyms: ['se le metió algo al oído', 'se le metió algo en el oído', 'tiene algo en el oído', 'se le metió un bicho al oído', 'se le metió una semilla al oído'],
    group: 'respiratorio',
  },
  dolor_fosa_renal: {
    es: 'Dolor en la espalda, a un lado, debajo de las costillas (riñón)',
    synonyms: ['le duele el riñón', 'dolor de riñón', 'dolor en el riñón', 'dolor en los riñones', 'le duelen los riñones', 'abajo de las costillas en la espalda', 'dolor en el costado de la espalda'],
    group: 'urinario',
  },
  orina_sangre: {
    es: 'Sangre en la orina',
    synonyms: ['orina con sangre', 'pipí con sangre', 'sangre en la orina', 'sangre en la pipí', 'orina roja', 'orina sangre'],
    group: 'urinario',
  },
  dolor_espalda_baja: {
    es: 'Dolor de espalda baja ("dolor de cintura")',
    // DEM "cintura" como zona del cuerpo; "dolor de cintura" = lumbalgia: uso común (no verificado en DEM).
    synonyms: ['dolor de cintura', 'le duele la cintura', 'dolor de espalda', 'le duele la espalda', 'dolor en la espalda', 'dolor de espalda baja', 'dolor de la espalda baja', 'lumbago', 'se lastimó la espalda'],
    group: 'trauma',
  },
  cauda_equina: {
    es: 'No controla la orina o la popó, se le durmió la entrepierna o perdió fuerza en las dos piernas',
    synonyms: ['no siente la entrepierna', 'se le durmió la entrepierna', 'se le durmieron las nalgas', 'se le duermen las nalgas', 'se hace del baño sin sentir', 'se orina sin sentir', 'no controla la orina', 'no controla la popó', 'se le durmieron las dos piernas', 'no puede mover las dos piernas', 'se le debilitaron las dos piernas', 'no tiene fuerza en las dos piernas'],
    group: 'trauma',
  },
  comezon: {
    es: 'Comezón',
    // DEM "comezón"; "roncha" (piquetes, alergias).
    synonyms: ['comezón', 'le pica todo', 'le pica mucho', 'mucha comezón', 'le da comezón', 'ronchas que le pican', 'le pica la piel'],
    group: 'piel',
  },
  hinchazon_labios_lengua: {
    es: 'Se le hincharon de repente los labios, la lengua o la boca',
    synonyms: ['se le hincharon los labios', 'labios hinchados', 'se le hinchó la lengua', 'lengua hinchada', 'se le hinchó la boca', 'boca hinchada', 'se le hinchó la garganta'],
    group: 'piel',
  },
  erupcion_empeora: {
    es: 'Ronchas o erupción nueva que se extiende en horas, o la piel se le pela',
    synonyms: ['se le está pelando la piel', 'se le pela la piel', 'se le despelleja la piel', 'se le cae la piel', 'las ronchas se le están extendiendo', 'se le extienden las ronchas', 'se le riegan las ronchas', 'cada vez le salen más ronchas', 'le salen más y más ronchas', 'se le está regando el salpullido'],
    group: 'piel',
  },
  herida: {
    es: 'Herida o cortada',
    // DEM "cortada", "raspón".
    synonyms: ['cortada', 'se cortó', 'se rajó', 'raspón', 'se raspó', 'herida', 'tiene una herida', 'se hizo una herida'],
    group: 'trauma',
  },
  objeto_clavado: {
    es: 'Tiene algo clavado en la herida (vidrio, clavo, madera)',
    synonyms: ['tiene algo clavado', 'se le quedó clavado', 'se le quedó un vidrio adentro', 'tiene un vidrio clavado', 'tiene el clavo clavado', 'todavía tiene el clavo', 'se le quedó el clavo adentro', 'tiene una astilla grande clavada'],
    group: 'trauma',
  },
  herida_profunda: {
    es: 'Herida muy grande o profunda',
    synonyms: ['herida profunda', 'cortada profunda', 'cortada honda', 'herida honda', 'herida muy grande', 'se le ve la carne', 'se le ve el hueso de la herida', 'herida muy abierta'],
    group: 'trauma',
  },
  herida_sucia: {
    es: 'Herida grande (más de 5 cm), sucia con tierra, o por clavo',
    synonyms: ['herida grande', 'cortada grande', 'herida sucia', 'herida con tierra', 'se le metió tierra en la herida', 'pisó un clavo', 'se enterró un clavo', 'se clavó un clavo', 'se espinó con un clavo', 'clavo oxidado'],
    group: 'trauma',
  },
  herida_infectada: {
    es: 'Herida roja, caliente, hinchada o con pus',
    synonyms: ['herida con pus', 'le sale pus de la herida', 'herida infectada', 'se le infectó la herida', 'se le enconó', 'la herida está roja e hinchada', 'la herida se puso roja'],
    group: 'trauma',
  },
  herida_sin_sensibilidad: {
    es: 'Junto a la herida no siente o no puede mover (dedo, mano, pie)',
    synonyms: ['no siente el dedo', 'se le durmió el dedo', 'no puede mover el dedo', 'no siente la mano', 'no puede mover los dedos', 'se le durmieron los dedos'],
    group: 'trauma',
  },
  quemadura_grave: {
    es: 'Quemadura en la cara o el cuello, que le da toda la vuelta a un brazo, pierna o al cuerpo, o respiró humo',
    synonyms: ['se quemó la cara', 'quemadura en la cara', 'se quemó el cuello', 'quemadura en el cuello', 'respiró humo', 'respiró mucho humo', 'se quemó todo el brazo', 'se quemó toda la pierna'],
    group: 'trauma',
  },
  quemadura_quimica_electrica: {
    es: 'Quemadura por ácido, químico o electricidad, o en sus partes o nalgas',
    synonyms: ['se quemó con ácido', 'quemadura con ácido', 'se quemó con químico', 'quemadura química', 'le dio la luz', 'le dieron toques', 'se electrocutó', 'descarga eléctrica', 'le pegó la corriente', 'se quemó sus partes', 'quemadura en las nalgas'],
    group: 'trauma',
  },
  picadura_alacran: {
    es: 'Picadura de alacrán',
    // DEM "piquete": "un piquete de alacrán".
    synonyms: ['le picó un alacrán', 'lo picó un alacrán', 'la picó un alacrán', 'piquete de alacrán', 'picadura de alacrán', 'alacranazo', 'le picó un escorpión', 'picadura de escorpión'],
    group: 'trauma',
  },
  alacran_sintomas: {
    es: 'Después del piquete: algo atorado en la garganta, ojos que se mueven solos, lengua que tiembla, mucho sudor o ve rojo',
    synonyms: ['siente algo atorado en la garganta', 'siente como un pelo en la garganta', 'siente una bola en la garganta', 'los ojos se le mueven solos', 'se le mueven los ojos solos', 'le tiembla la lengua', 'suda mucho', 'está sudando mucho', 've rojo', 've halos rojos', 've todo rojo'],
    group: 'trauma',
  },
  mordedura_arana: {
    es: 'Mordedura de araña',
    synonyms: ['lo mordió una araña', 'la mordió una araña', 'le picó una araña', 'piquete de araña', 'picadura de araña', 'mordedura de araña'],
    group: 'trauma',
  },
  arana_peligrosa: {
    es: 'Fue viuda negra (capulina) o violinista (araña café, del rincón)',
    // SSA/CENAPRECE 2026 p. 4 y 14; CENAPRECE loxoscelismo.
    synonyms: ['viuda negra', 'araña capulina', 'capulina', 'araña del trasero rojo', 'araña de la colita roja', 'casampulga', 'cintlatlahua', 'araña violinista', 'violinista', 'araña del rincón', 'araña reclusa', 'araña café', 'araña parda'],
    group: 'trauma',
  },
  arana_sintomas: {
    es: 'Después de la araña: dolor que sube por el brazo o la pierna, calambres, panza dura, mordida morada o negra, orina oscura',
    synonyms: ['el dolor se le sube por el brazo', 'el dolor se le sube por la pierna', 'el dolor se le corre por el brazo', 'el dolor se le corre por la pierna', 'calambres', 'panza dura', 'se le puso morada la mordida', 'se le puso negra la mordida', 'ampolla con sangre', 'orina oscura', 'orina muy oscura'],
    group: 'trauma',
  },
  golpe_cabeza: {
    es: 'Golpe en la cabeza',
    // DEM "chichón".
    synonyms: ['se pegó en la cabeza', 'golpe en la cabeza', 'se golpeó la cabeza', 'se dio en la cabeza', 'chichón', 'chipote', 'se dio un golpe en la cabeza', 'le pegaron en la cabeza'],
    group: 'trauma',
  },
  anticoagulante: {
    es: 'Toma medicina para adelgazar la sangre (anticoagulante)',
    synonyms: ['toma medicina para adelgazar la sangre', 'toma pastillas para adelgazar la sangre', 'toma anticoagulante', 'anticoagulado', 'anticoagulada', 'medicina para la sangre espesa'],
    group: 'general',
  },
  mareo: {
    es: 'Mareo',
    synonyms: ['mareo', 'mareado', 'mareada', 'se marea', 'todo le da vueltas', 'se le va la cabeza', 'anda mareado', 'anda mareada'],
    group: 'neurologico',
  },
  diabetes: {
    es: 'Tiene diabetes',
    synonyms: ['es diabético', 'es diabética', 'diabético', 'diabética', 'tiene diabetes', 'diabetes', 'tiene azúcar', 'tiene el azúcar alta', 'se inyecta insulina', 'usa insulina'],
    group: 'general',
  },
  sintomas_hipoglucemia: {
    es: 'Señas de azúcar baja: tiembla, mucha hambre de repente, corazón acelerado',
    synonyms: ['mucha hambre de repente', 'le tiemblan las manos', 'está temblando', 'tiembla', 'tiembla mucho', 'el corazón le late muy rápido', 'palpitaciones'],
    group: 'general',
  },
  azucar_baja: {
    es: 'Se le bajó el azúcar (hipoglucemia)',
    synonyms: ['se le bajó el azúcar', 'azúcar baja', 'le bajó el azúcar', 'se le baja el azúcar', 'hipoglucemia'],
    group: 'general',
  },
  hipertension: {
    es: 'Tiene presión alta',
    // DEM "presión" acep. 4.
    synonyms: ['presión alta', 'tiene presión alta', 'es hipertenso', 'es hipertensa', 'hipertensión', 'hipertenso', 'hipertensa', 'se le subió la presión', 'padece de la presión'],
    group: 'cardiovascular',
  },
  enfermedad_cronica: {
    es: 'Enfermedad del corazón, asma, de los riñones o cirrosis',
    synonyms: ['es asmático', 'es asmática', 'tiene asma', 'enfermo del corazón', 'enferma del corazón', 'enfermedad del corazón', 'enfermo de los riñones', 'enferma de los riñones', 'insuficiencia renal', 'cirrosis'],
    group: 'general',
  },
  tos_sangre: {
    es: 'Tose o escupe sangre',
    synonyms: ['tose sangre', 'escupe sangre', 'tos con sangre', 'flemas con sangre', 'le salió sangre al toser', 'gargajo con sangre', 'tosió sangre'],
    group: 'respiratorio',
  },
  nervios_ansiedad: {
    es: 'Nervios, ansiedad o angustia',
    // DEM "nervio" acep. 2; "ansia" acep. 1.
    synonyms: ['nervios', 'anda de los nervios', 'muy nerviosa', 'muy nervioso', 'ansiedad', 'ansias', 'angustia', 'angustiado', 'angustiada', 'ataque de pánico', 'ataque de nervios', 'siente que se va a morir'],
    group: 'general',
  },
} satisfies Record<string, SymptomDef>;

export type SymptomKeyStrict = keyof typeof SYMPTOMS;

export const SYMPTOM_KEYS = Object.keys(SYMPTOMS) as SymptomKeyStrict[];

export function isSymptomKey(k: string): k is SymptomKeyStrict {
  return Object.prototype.hasOwnProperty.call(SYMPTOMS, k);
}

/** Campos numéricos/no booleanos de Findings que el motor puede preguntar. */
export const NUMERIC_FIELDS = ['edad_meses', 'resp_por_min', 'temperatura_c', 'duracion_dias', 'semanas_embarazo'] as const;

/**
 * Pregunta de seguimiento (sí/no o número) para cada campo. Español sencillo, para leerse en voz alta.
 * Se exporta aparte para no alterar la forma de SYMPTOMS que consumen otros módulos.
 */
export const PREGUNTAS: Record<string, string> = {
  edad_meses: '¿Qué edad tiene? (en meses si es menor de 2 años)',
  resp_por_min: 'Cuente las respiraciones durante 1 minuto con el paciente tranquilo. ¿Cuántas fueron?',
  temperatura_c: 'Si tiene termómetro: ¿cuánta temperatura marca (en la axila)?',
  duracion_dias: '¿Cuántos días lleva así?',
  semanas_embarazo: '¿De cuántas semanas (o meses) es el embarazo?',
  embarazada: '¿Está embarazada?',
  convulsiones: '¿Ha tenido convulsiones (ataques) en esta enfermedad?',
  inconsciente: '¿Está inconsciente o no responde cuando le habla o le toca el hombro?',
  letargico: '¿Tiene mucho sueño fuera de lo normal o le cuesta despertar?',
  no_puede_beber: 'Ofrézcale agua o el pecho: ¿le es imposible beber o mamar?',
  vomita_todo: '¿Vomita todo lo que come o bebe?',
  palidez_intensa: '¿Las palmas de las manos se ven muy pálidas, casi blancas?',
  palidez: '¿Tiene pálidas las palmas de las manos?',
  irritable: '¿Está irritable o con mucha inquietud, y no se calma?',
  debilidad_general: '¿Está tan débil que no se puede levantar?',
  desmayo: '¿Se desmayó hace poco?',
  dolor_intenso: '¿Tiene un dolor muy fuerte?',
  sangrado_abundante: '¿Está sangrando mucho (empapa trapos o toallas)?',
  sangrado: '¿Está sangrando?',
  hinchazon_ambos_pies: '¿Tiene hinchados los dos pies (se queda marcado al apretar)?',
  tos: '¿Tiene tos?',
  dificultad_respirar: '¿Le cuesta trabajo respirar?',
  respira_rapido: '¿Respira rápido?',
  tiraje: 'Levante la ropa: ¿se le hunden las costillas (la parte de abajo del pecho) cuando jala aire?',
  estridor: 'En calma, ¿hace un ruido áspero cuando jala aire?',
  sibilancias: '¿Le silba el pecho al sacar el aire?',
  cianosis: '¿Se le ponen morados los labios o la cara?',
  apnea: '¿Deja de respirar por momentos?',
  escurrimiento_nasal: '¿Le escurre la nariz (mocos)?',
  diarrea: '¿Tiene diarrea (3 o más asientos aguados en un día)?',
  sangre_heces: '¿Hay sangre en la popó?',
  vomito: '¿Ha vomitado?',
  vomito_persistente: '¿Vomita a cada rato, sin parar?',
  nauseas: '¿Tiene náuseas o asco?',
  dolor_abdominal: '¿Tiene dolor de panza?',
  dolor_abdominal_intenso: '¿El dolor de panza es muy fuerte o no se le quita?',
  distension_abdominal: '¿Tiene la panza hinchada o inflada?',
  vomito_sangre: '¿Ha vomitado sangre o algo como café molido?',
  heces_negras: '¿La popó sale negra como chapopote?',
  ojos_hundidos: '¿Tiene los ojos hundidos?',
  mollera_hundida: '¿Tiene la mollera hundida?',
  sin_lagrimas: '¿Llora sin lágrimas?',
  boca_seca: '¿Tiene la boca y la lengua secas?',
  bebe_con_avidez: 'Ofrézcale agua o suero: ¿bebe con mucha sed, con desesperación?',
  bebe_mal: 'Ofrézcale agua o suero: ¿bebe muy poquito o con trabajo?',
  pliegue_lento: 'Pellizque suavemente la piel de la panza: ¿tarda en regresar?',
  pliegue_muy_lento: 'Pellizque la piel de la panza: ¿tarda más de 2 segundos en regresar?',
  manos_pies_frios: '¿Tiene las manos y los pies fríos?',
  mareo_al_pararse: '¿Se marea o se desvanece al pararse?',
  fiebre: '¿Tiene calentura ahora, o la tuvo en los últimos días aunque ya se le quitó?',
  rigidez_nuca: '¿Tiene el cuello tieso, no puede bajar la barbilla al pecho?',
  sarpullido: '¿Tiene ronchas o manchas rojas en todo el cuerpo?',
  ojos_rojos: '¿Tiene los ojos rojos?',
  petequias: '¿Tiene puntitos rojos en la piel que no se borran al apretar?',
  sangrado_mucosas: '¿Le sangran las encías o la nariz?',
  dolor_cabeza: '¿Le duele la cabeza?',
  dolor_detras_ojos: '¿Le duele detrás de los ojos?',
  dolor_muscular_articular: '¿Le duelen los músculos o las articulaciones?',
  ojo_nublado: '¿Tiene un ojo nublado u opaco?',
  ulceras_boca_extensas: '¿Tiene llagas profundas o en toda la boca?',
  confusion: '¿De repente se confunde o no sabe dónde está?',
  cara_caida: 'Pídale que sonría: ¿se le cae un lado de la cara?',
  debilidad_un_lado: 'Pídale que levante los dos brazos: ¿uno se le cae o no lo puede mover?',
  dificultad_hablar: '¿Habla raro, arrastra las palabras o no entiende lo que le dicen?',
  perdida_equilibrio: '¿De repente no puede caminar o pierde el equilibrio?',
  dolor_cabeza_subito: '¿Le empezó de repente un dolor de cabeza muy fuerte, el peor de su vida?',
  dolor_cabeza_intenso: '¿Tiene un dolor de cabeza muy fuerte?',
  vision_borrosa: '¿Ve borroso o ve lucecitas?',
  zumbido_oidos: '¿Le zumban los oídos?',
  sangrado_vaginal: '¿Tiene sangrado por la vagina?',
  salida_liquido_vaginal: '¿Le sale líquido por la vagina (se le rompió la fuente)?',
  movimientos_fetales_disminuidos: '¿El bebé se mueve menos o no se ha movido en más de 2 horas?',
  contracciones: '¿Tiene contracciones o dolores de parto?',
  hinchazon_cara_manos: '¿Se le hinchan la cara, las manos o las piernas?',
  posparto: '¿Dio a luz en las últimas 6 semanas (está en la cuarentena)?',
  dolor_pantorrilla: '¿Le duele, está roja o hinchada una pantorrilla?',
  pechos_rojos_dolorosos: '¿Tiene los pechos hinchados, rojos o adoloridos?',
  flujo_mal_olor: '¿El flujo o sangrado huele mal?',
  no_come_bien: '¿El bebé come mal o mama poco?',
  no_se_mueve: '¿El bebé solo se mueve si lo tocan o lo mueven, o ya no se mueve nada?',
  se_siente_frio: '¿El bebé se siente frío al tocarlo?',
  ictericia: '¿Tiene la piel o los ojos amarillos?',
  palmas_plantas_amarillas: '¿Las palmas de las manos y las plantas de los pies están amarillas?',
  ombligo_rojo_pus: '¿El ombligo está rojo o le sale pus?',
  pustulas_piel: '¿Tiene granitos con pus en la piel?',
  llanto_inconsolable: '¿Llora y no se calma con nada?',
  dolor_pecho: '¿Tiene dolor u opresión en el pecho?',
  sudor_frio: '¿Tiene sudor frío?',
  trauma_grave: '¿Tuvo un golpe fuerte o accidente grave?',
  fractura: '¿Parece tener un hueso roto o un brazo/pierna chueco?',
  quemadura: '¿Tiene una quemadura?',
  mordedura_serpiente: '¿Le mordió una víbora?',
  mordedura_animal: '¿Le mordió o le arañó un animal (perro, gato, murciélago)?',
  intoxicacion: '¿Tomó veneno, plaguicida, cloro u otro químico?',
  ardor_orinar: '¿Le arde al orinar u orina muy seguido?',
  no_puede_orinar: '¿Quiere orinar y no le sale nada?',
  no_orina_no_evacua: '¿El bebé ha dejado de hacer pipí (pañal seco) o de hacer popó?',
  bajo_peso_nacer: '¿Nació con bajo peso?',
  lejos_unidad: '¿Es difícil llegar HOY a la unidad de salud (queda lejos o no hay transporte)?',
  desnutricion: '¿Tiene desnutrición o está muy bajo de peso?',
  quejido: 'Escuche su respiración: ¿se queja (hace un quejido) cada vez que saca el aire?',
  aleteo_nasal: '¿Se le abren las alitas de la nariz cada vez que respira?',
  adenomegalias: '¿Tiene bolitas detrás de las orejas, en la nuca o en el cuello?',
  sarampion_reciente: '¿Le dio sarampión ahora o en los últimos 3 meses?',
  fiebre_reciente: '¿Tuvo calentura en los últimos días aunque ya se le quitó?',
  dolor_epigastrio: '¿Le duele la boca del estómago (arriba del ombligo)?',
  golpe_caida: '¿Se cayó o recibió un golpe (sobre todo en la panza)?',
  sangrado_aumenta: '¿El sangrado está aumentando en vez de disminuir?',
  depresion_grave: '¿La ve muy triste, sin ganas de nada, o llora todo el tiempo?',
  ideas_suicidas: '¿Ha dicho que se quiere morir, hacerse daño o quitarse la vida?',
  perdida_vision_subita: '¿De repente dejó de ver de uno o de los dos ojos?',
  llenado_capilar_lento: 'Apriete una uña 5 segundos y suéltela: ¿tarda más de 3 segundos en volver a ponerse rosa?',
  pulso_debil_rapido: '¿El pulso se siente débil y rápido?',
  oliguria: '¿Lleva 6 horas o más sin orinar, u orina casi nada?',
  // Ronda 3 (molestias comunes). "Sí" = el signo está presente.
  sexo: '¿Es hombre o mujer?',
  gases: '¿Tiene muchos gases o la panza "aventada"?',
  estrenimiento: '¿Está estreñido (no ha podido hacer del baño)?',
  no_obra_ni_gases: '¿Lleva horas o días sin poder hacer del baño NI echar gases?',
  dolor_derecha_baja: '¿El dolor de panza está abajo a la derecha, o empezó en el ombligo y se pasó a la derecha?',
  dolor_al_moverse: '¿El dolor de panza aumenta al caminar o al toser?',
  dolor_testiculo: '¿Le duele o se le hinchó un testículo?',
  vomito_verde: '¿Vomita verde?',
  agruras: '¿Tiene agruras o acidez?',
  dolor_garganta: '¿Le duele la garganta?',
  placas_garganta: 'Pídale que abra la boca: ¿se ven placas blancas o pus en la garganta?',
  no_traga_saliva: '¿No puede tragar ni su propia saliva, o siente que se le cierra la garganta?',
  babeo: '¿Babea mucho o se le escurre la saliva?',
  hinchazon_boca_cuello: '¿Tiene hinchada o con una bola la boca, la encía, la quijada, la garganta o el cuello?',
  hinchazon_cuello_ojo: '¿Se le hinchó alrededor del ojo o el cuello?',
  dolor_muela: '¿Le duele una muela o un diente?',
  dolor_oido: '¿Le duele el oído?',
  pus_oido: '¿Le sale pus o líquido del oído?',
  sangre_oido: '¿Le sale sangre del oído?',
  hinchazon_detras_oreja: '¿Tiene una hinchazón dolorosa detrás de la oreja?',
  objeto_en_oido: '¿Tiene algo atorado dentro del oído?',
  dolor_fosa_renal: '¿Le duele la espalda de un lado, debajo de las costillas?',
  orina_sangre: '¿Tiene sangre en la orina (orina roja o color café)?',
  dolor_espalda_baja: '¿Le duele la espalda baja (la cintura)?',
  cauda_equina: '¿No puede orinar o no controla la orina o la popó, se le durmió la entrepierna, o perdió fuerza en las dos piernas?',
  comezon: '¿Tiene comezón?',
  hinchazon_labios_lengua: '¿Se le hincharon de repente los labios, la lengua o la boca?',
  erupcion_empeora: '¿Las ronchas o manchas se le están extendiendo en horas, o se le está pelando la piel?',
  herida: '¿Tiene una herida o cortada?',
  objeto_clavado: '¿Tiene algo clavado en la herida (vidrio, clavo, madera)? No se lo saque.',
  herida_profunda: '¿La herida es muy grande o profunda (se ve la carne)?',
  herida_sucia: '¿La herida es de más de 5 cm (como 3 dedos), quedó sucia con tierra aunque la lavó, o fue con un clavo?',
  herida_infectada: '¿La herida está roja, caliente, hinchada o con pus?',
  herida_sin_sensibilidad: 'Junto a la herida, ¿no siente o no puede mover el dedo, la mano o el pie?',
  quemadura_grave: '¿La quemadura está en la cara o el cuello, le da toda la vuelta a un brazo, pierna o al cuerpo, o respiró humo?',
  quemadura_quimica_electrica: '¿La quemadura fue por ácido, químico o electricidad, o está en sus partes o las nalgas?',
  picadura_alacran: '¿Le picó un alacrán?',
  alacran_sintomas: '¿Babea, siente algo atorado en la garganta, los ojos se le mueven solos, le tiembla la lengua, suda mucho, vomita, ve borroso o rojo, o le falta el aire?',
  mordedura_arana: '¿Le mordió una araña?',
  arana_peligrosa: '¿Fue una viuda negra (negra con mancha roja, capulina) o una violinista (café, del rincón)?',
  arana_sintomas: '¿El dolor le sube por el brazo o la pierna, tiene calambres o la panza dura, la mordida se puso morada o negra, o la orina sale oscura?',
  golpe_cabeza: '¿Se golpeó la cabeza?',
  anticoagulante: '¿Toma medicina para adelgazar la sangre (anticoagulante)?',
  mareo: '¿Está mareado?',
  diabetes: '¿Tiene diabetes (azúcar)?',
  sintomas_hipoglucemia: '¿Tiembla, tiene mucha hambre de repente o el corazón le late muy rápido?',
  azucar_baja: '¿Se le bajó el azúcar (le midieron el azúcar baja o tiene las señas de siempre)?',
  hipertension: '¿Tiene presión alta?',
  enfermedad_cronica: '¿Tiene asma, enfermedad del corazón, de los riñones o cirrosis?',
  tos_sangre: '¿Tose o escupe sangre?',
  nervios_ansiedad: '¿Anda con muchos nervios, ansiedad o angustia?',
};

/**
 * Variantes por edad de las preguntas que usan palabras de bebé (mamar, el pecho, mollera, "levante la ropa").
 * PREGUNTAS es el texto para menores de 5 años. Aquí:
 *  - `mayor5`: 5 años o más (edad_meses >= 60). `null` = no se pregunta a esa edad (no aplica).
 *  - `sin_edad`: edad desconocida; válida para cualquier edad.
 * Los campos que no están aquí usan PREGUNTAS a cualquier edad (ya son neutrales).
 */
export const PREGUNTAS_EDAD: Record<string, { mayor5: string | null; sin_edad: string }> = {
  no_puede_beber: {
    mayor5: 'Ofrézcale agua: ¿le es imposible beber?',
    sin_edad: 'Ofrézcale agua: ¿le es imposible beber (o mamar, si es bebé)?',
  },
  tiraje: {
    mayor5: 'Mire el pecho mientras respira (con permiso, si hay que levantar la ropa): ¿se le hunden las costillas, la parte de abajo del pecho, cuando jala aire?',
    sin_edad: 'Mire el pecho mientras respira (con permiso, si hay que levantar la ropa): ¿se le hunden las costillas, la parte de abajo del pecho, cuando jala aire?',
  },
  // La mollera se cierra antes de los 2 años; las lágrimas son un signo de AIEPI/NOM-031 para niños pequeños.
  mollera_hundida: { mayor5: null, sin_edad: 'Si es bebé: ¿tiene la mollera hundida?' },
  sin_lagrimas: { mayor5: null, sin_edad: 'Si es menor de 5 años: ¿llora sin lágrimas?' },
  // Signos del lactante menor de 2 meses: sus reglas exigen la edad conocida, así que a 5 años o más no se preguntan.
  no_come_bien: { mayor5: null, sin_edad: 'Si es bebé: ¿come mal o mama poco?' },
  no_se_mueve: { mayor5: null, sin_edad: 'Si es bebé: ¿solo se mueve si lo tocan o lo mueven, o ya no se mueve nada?' },
  se_siente_frio: { mayor5: null, sin_edad: 'Si es bebé: ¿se siente frío al tocarlo?' },
  no_orina_no_evacua: { mayor5: null, sin_edad: 'Si es bebé: ¿ha dejado de hacer pipí (pañal seco) o de hacer popó?' },
};

/** Texto de la pregunta para esta edad (meses). Sin variante: PREGUNTAS. `null` = no se pregunta a esa edad. */
export function preguntaPorEdad(field: string, edadMeses?: number): string | null | undefined {
  const v = PREGUNTAS_EDAD[field];
  if (!v) return PREGUNTAS[field];
  if (typeof edadMeses !== 'number' || !Number.isFinite(edadMeses)) return v.sin_edad;
  return edadMeses >= 60 ? v.mayor5 : PREGUNTAS[field];
}
