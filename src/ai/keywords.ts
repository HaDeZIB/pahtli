/**
 * Extractor por palabras clave (español coloquial de México) — texto libre -> Findings.
 *
 * Es el respaldo cuando no hay LLM y la red de seguridad cuando sí lo hay.
 * PURO y síncrono: sin DOM, sin red, corre igual en el navegador y en Node (eval).
 *
 * Reglas de diseño:
 *  - Solo marca `true` lo que se dice explícitamente (sinónimos de SYMPTOMS + EXTRA_SYNONYMS).
 *  - Negación explícita ("no tiene calentura", "sin sangre", "ni tos") -> `false`.
 *  - "ya no vomita" (ya se resolvió) e incertidumbre ("no sé si tiene fiebre") -> no se marca.
 *  - "no se le quita / no le baja la calentura" NO es negación (la fiebre sigue).
 *  - Normalización fonética ligera para tolerar errores de ortografía de Whisper
 *    ("se le unde el pecho", "su dor frío").
 */
import type { Findings } from '../types';
import { SYMPTOMS, type SymptomKeyStrict } from '../triage/findings';

// ─────────────────────────────────────────────────────────────────────────────
// Sinónimos adicionales (variantes morfológicas y frases frecuentes). Compilados por el
// equipo, NO validados con promotoras: revisar en campo igual que los de findings.ts.
// ─────────────────────────────────────────────────────────────────────────────
export const EXTRA_SYNONYMS: Partial<Record<SymptomKeyStrict, string[]>> = {
  convulsiones: ['convulsion', 'convulsiono', 'convulsionado', 'ha convulsionado', 'convulsionando', 'se convulsiono', 'le dio una convulsion', 'le dan convulsiones', 'se puso tieso y se sacudia'],
  inconsciente: ['desmayado y no despierta', 'no contesta ni reacciona', 'esta inconsciente'],
  letargico: ['muy dormilon', 'no despierta bien', 'muy dormida', 'esta muy dormido', 'esta muy dormida', 'adormilado', 'adormilada'],
  no_puede_beber: ['no puede tomar agua', 'no puede tomar pecho', 'no puede tomar liquidos', 'ya no puede tomar'],
  vomita_todo: ['vomita todo lo que come', 'vomita todo lo que toma', 'todo lo devuelve', 'devuelve todo lo que toma', 'todo lo vomita'],
  palidez_intensa: ['muy palido', 'muy palida', 'bien palido', 'bien palida', 'blanco como la pared', 'muy palidas', 'muy palidos', 'bien palidas', 'bien palidos', 'blanquisimo', 'blanquisima', 'blanquisimas', 'blanquisimos', 'palmas muy blancas' /* eval */],
  palidez: ['palida', 'se ve palida', 'esta palido', 'esta palida'],
  debilidad_general: ['muy debil', 'muy debilitado', 'no se puede parar', 'no tiene fuerza'],
  sangrado_abundante: ['sangrado abundante', 'sangra muchisimo', 'esta sangrando mucho', 'mucho sangrado'],
  tos: ['tosio', 'tosecita', 'tose mucho', 'tos seca', 'con tos', 'toser'],
  dificultad_respirar: ['le cuesta mucho respirar', 'le cuesta mucho jalar aire', 'sin poder respirar', 'le falta la respiracion', 'se esta ahogando', 'se ahogaba', 'respira con dificultad', 'dificultad para respirar', 'no puede jalar aire', 'le cuesta jalar aire', 'le cuesta trabajo respirar', 'batalla para respirar'],
  respira_rapido: ['respirar muy rapido', 'respirar rapido', 'respiracion muy rapida', 'respira rapidito', 'respira muy rapidito', 'respiracion rapida', 'respira bien rapido', 'respirando rapido', 'respirando muy rapido', 'respira muy agitado', 'respira agitada', 'respira rapida'],
  tiraje: ['se le ven las costillas', 'se le notan las costillas', 'se le ven las costillas cuando respira', 'se le hunden las costillitas', 'se le hunde la panza al respirar', 'se le mete el pecho', 'se le hunde abajo de las costillas', 'se le hunde el pechito', 'se le sume el pechito', 'hundimiento del pecho'],
  sibilancias: ['le chilla el pecho', 'le silba el pechito', 'silbido al respirar'],
  cianosis: ['azulito', 'azulita', 'azulitos', 'azulitas', 'se puso azulito', 'unas moradas', 'unas azules', 'se puso moradito', 'labios moraditos', 'se esta poniendo morado'],
  escurrimiento_nasal: ['con mocos', 'mocosito', 'mocosita', 'resfriado'],
  diarrea: ['obrando agua', 'obrando pura agua', 'obra pura agua', 'obra agua', 'esta obrando aguado', 'diarreas', 'obra aguado', 'obra suelto', 'evacua aguado', 'anda flojo del estomago', 'esta suelto del estomago', 'chorrito', 'popo liquida', 'evacuaciones aguadas'],
  sangre_heces: ['popo con sangre', 'heces con sangre', 'obra con sangre', 'diarrea con sangre'],
  vomito: ['vomitado', 'vomitando', 'vomitos', 'esta vomitando', 'devolviendo', 'guacareando', 'ha vomitado'],
  vomito_persistente: ['vomita mucho', 'vomita muchisimo', 'no deja de vomitar'],
  dolor_abdominal: ['le duele el estomago', 'le duele la barriga', 'le duele la pancita', 'dolor de pancita', 'dolor de estomago'],
  dolor_abdominal_intenso: ['le duele mucho la panza', 'le duele mucho el estomago', 'dolor de panza fuerte'],
  ojos_hundidos: ['ojos muy hundidos', 'ojitos sumidos', 'ojos sumidos'],
  mollera_hundida: ['mollera sumida', 'mollerita sumida', 'mollera caida'],
  nauseas: ['estomago revuelto', 'tiene asco', 'ganas de devolver'],
  no_puede_orinar: ['no ha hecho pipi', 'no ha orinado', 'no ha hecho del uno', 'no orina', 'no ha podido orinar', 'no ha podido hacer pipi', 'no puede hacer pipi' /* eval */],
  boca_seca: ['labios resecos', 'boca reseca'],
  fiebre: ['trae mucha temperatura', 'trae temperatura', 'trae calentura', 'trae fiebre', 'calenturas', 'fiebres', 'calenturita', 'calenturienta', 'calenturiento', 'con calentura', 'fiebre alta', 'temperatura alta', 'mucha calentura', 'mucha fiebre'],
  dolor_muscular_articular: ['le duelen los huesos', 'le duele el cuerpo', 'le duelen los musculos', 'le duelen las articulaciones', 'dolor de cuerpo'],
  dolor_detras_ojos: ['detras de los ojos', 'detras de los ojitos', 'le duelen los ojos'],
  rigidez_nuca: ['nuca tiesa', 'cuello rigido'],
  sarpullido: ['ronchitas', 'manchitas rojas', 'granitos rojos'],
  petequias: ['puntitos rojos en la piel'],
  sangrado_mucosas: ['sangra de la nariz', 'sangra de las encias', 'le sangra la boca'],
  dolor_cabeza: ['dolor de cabeza', 'le duele su cabeza', 'dolor en la cabeza'],
  dolor_cabeza_intenso: ['le duele mucho la cabeza', 'dolor de cabeza fuerte', 'mucho dolor de cabeza', 'dolor de cabeza muy intenso', 'le duele muchisimo la cabeza'],
  vision_borrosa: ['ve luces', 've estrellas', 've manchitas', 've borrosito', 'no ve bien de repente'],
  cara_caida: ['se le durmio la mitad de la cara', 'mitad de la cara dormida', 'boca torcida', 'cara chueca', 'se le chueco la boca', 'se le torcio la cara'],
  debilidad_un_lado: ['se le durmio la mitad del cuerpo', 'no puede mover un lado', 'se le durmio un lado', 'no puede levantar el brazo'],
  dificultad_hablar: ['no le entiendo cuando habla', 'no se le entiende cuando habla', 'no se le entiende lo que dice', 'dificultad para hablar', 'no puede hablar', 'habla raro', 'habla arrastrado'],
  sangrado_vaginal: ['sangrado por abajo', 'sangrando por abajo', 'sangrando mucho por abajo', 'sangrando de abajo', 'sangra mucho por abajo', 'sangrado por la vagina', 'le esta bajando sangre', 'sangra por abajo', 'sangra de sus partes'],
  salida_liquido_vaginal: ['se le rompio la fuente', 'rompio fuente', 'se le salio el agua'],
  movimientos_fetales_disminuidos: ['no siente que se mueva el bebe', 'el bebe ya no se mueve', 'ya no se mueve el bebe', 'no se mueve el bebe', 'el bebe casi no se mueve', 'no siente al bebe'],
  hinchazon_cara_manos: ['se le hincharon los pies', 'se le hincho la cara', 'pies hinchados'],
  posparto: ['dio a luz', 'acaba de parir', 'recien aliviada', 'recien dio a luz', 'tuvo su bebe'],
  no_come_bien: ['no quiere comer nada', 'no mama', 'ya no mama', 'no quiere mamar'],
  ictericia: ['amarillito', 'amarillita', 'se ve amarillo', 'se ve amarilla', 'esta amarilla', 'amarillento'],
  dolor_pecho: ['dolor en el pecho', 'dolor del pecho', 'le duele su pecho', 'dolor de pecho'],
  sudor_frio: ['sudando frio', 'sudores frios'],
  trauma_grave: ['se cayo de la azotea', 'se cayo del arbol', 'se cayo del techo', 'lo atropello un carro', 'accidente de carro', 'accidente de moto', 'atropello', 'atropellaron', 'atropellado', 'atropellada' /* eval */],
  mordedura_serpiente: ['le pico una vibora', 'lo pico una vibora', 'la mordio una vibora', 'mordida de vibora'],
  mordedura_animal: ['la mordio un perro', 'lo mordio un perro', 'mordida de gato'],
  intoxicacion: ['se tomo un veneno', 'se tomo el veneno', 'tomo plaguicida', 'se intoxico', 'se enveneno'],
  // eval (docs/eval.md changelog): frases de casos dev que no se detectaban
  estridor: ['ruido al jalar aire', 'aspero al jalar aire', 'ruido aspero', 'ruido raro al jalar aire'],
  palmas_plantas_amarillas: ['amarillo hasta palmas', 'amarilla hasta palmas', 'amarillo hasta plantas', 'amarilla hasta plantas', 'palmas de manos amarillas', 'plantas de pies amarillas'],
  no_se_mueve: ['no se ha movido', 'no se le ha movido'],
  ardor_orinar: ['le arde cuando hace del uno', 'le arde cuando orina', 'le arde al hacer del uno', 'le arde cuando hace pipi', 'le arde mucho cuando hace del uno', 'le arde al orinar', 'ardor al hacer pipi', 'le arde la orina'],
};

/**
 * Ronda 2 (docs/eval.md §4): vocabulario coloquial de México por grupo. Fuentes de apoyo: la redacción de
 * los signos de alarma del embarazo del IMSS ("ver lucecitas", "zumbidos de oídos", "dolor constante de
 * cabeza", "hinchazón de manos o cara", "dolor intenso en la boca del estómago"; imss.gob.mx/_maternidad2/
 * estas-embarazada/signos-alarma), los términos populares de Gaceta UNAM (empacho, caída de mollera) y el
 * habla coloquial común. NO validado con promotoras: revisar en campo. Gracias a CANON, cada frase cubre
 * diminutivos ("pancita"), equivalentes ("barriga/estómago") y conjugaciones ("le duelen").
 */
export const EXTRA_SYNONYMS_R2: Partial<Record<SymptomKeyStrict, string[]>> = {
  // generales
  convulsiones: ['se puso tieso', 'se puso rigido', 'se puso duro', 'se le trabo la quijada', 'echaba espuma por la boca', 'se le fueron los ojos para arriba', 'se le fueron los ojos para atras', 'se le pusieron los ojos en blanco', 'le dieron temblorinas'],
  inconsciente: ['no vuelve en si', 'no responde cuando le hablo', 'no responde cuando le hablan', 'se quedo privado', 'se quedo privada'],
  letargico: ['aletargado', 'aletargada', 'esta como ido', 'esta como ida', 'esta como dopado', 'esta como dopada', 'no hace caso cuando le hablan', 'se la pasa dormido', 'se la pasa dormida', 'no se despabila'],
  no_puede_beber: ['no puede tomar', 'no puede traga', 'no traga nada', 'no le pasa nada', 'no puede tomar suero', 'no puede tomar agua'],
  vomita_todo: ['todo lo que le doy lo vomita', 'vomita hasta el agua', 'vomita hasta el suero', 'no le para nada', 'todo lo echa', 'no retiene ni el agua'],
  debilidad_general: ['no se puede parar', 'no se aguanta parado', 'no se aguanta parada', 'esta tirado', 'esta tirada', 'no tiene fuerzas para nada'],
  desmayo: ['le dio un vahido', 'se desvanecio', 'se cayo desmayada', 'perdio el sentido'],
  sangrado_abundante: ['sangra a chorros', 'echa mucha sangre', 'se esta desangrando', 'empapo las toallas', 'empapa los trapos', 'llena las toallas', 'bastante sangre'],
  // respiratorio
  dificultad_respirar: ['se fatiga', 'le da fatiga', 'se fatiga mucho', 'se le va el aire', 'no le entra aire', 'no jala aire', 'ahogo', 'se siente ahogado', 'se siente ahogada', 'se queda sin aire', 'respira con mucho trabajo', 'le cuesta respira'],
  respira_rapido: ['respira muy aprisa', 'respira aprisa', 'respira acelerado', 'respira acelerada', 'resuella'],
  tiraje: ['se le hunde entre las costillas', 'se le sume entre las costillas', 'se le sumen las costillas', 'se le mete entre las costillas', 'se le hunde abajo del pecho'],
  estridor: ['ronquido al jalar aire', 'hace ruido cuando jala aire', 'suena ronco al jalar aire'],
  sibilancias: ['le chifla el pecho', 'le silba al respirar', 'le chilla al respirar'],
  cianosis: ['se puso morada', 'se pone morada', 'se pone azul', 'labios azules', 'boca morada'],
  // digestivo / hidratación
  diarrea: ['cursera', 'cursiento', 'cursienta', 'anda de la cursera', 'hace del bano aguado', 'hace del bano aguadito', 'obra mucho', 'obrando aguado', 'obra aguadito', 'evacua mucho', 'popo como agua', 'del bano como agua'],
  sangre_heces: ['hace del bano con sangre', 'hizo del bano con sangre', 'evacua con sangre', 'obra con sangre', 'popo con moco y sangre', 'diarrea con moco y sangre', 'caca con sangre'],
  vomito: ['vomitadera', 'echa el vomito', 'arrojando', 'volvio el estomago'],
  vomito_persistente: ['vomita seguido', 'vomitando a cada rato', 'vomita y vomita', 'vomito tras vomito', 'no para de devolver'],
  dolor_abdominal: ['dolor de tripas', 'le duele el vientre', 'torzon', 'colico', 'le duele panza', 'dolorcito en el bajo vientre', 'dolor en el bajo vientre'],
  dolor_abdominal_intenso: ['le duele panza fuerte', 'le duele fuerte panza', 'le duele muchisimo panza', 'se retuerce de dolor', 'se dobla de dolor', 'grita del dolor de panza'],
  dolor_epigastrio: ['dolor en la boca del estomago', 'le arde la boca del estomago'],
  irritable: ['chillon', 'chillona', 'esta chillon', 'esta chillona', 'muy lloron', 'muy llorona', 'no se le quita lo chillon'],
  boca_seca: ['boca seca', 'lengua reseca', 'labios partidos'],
  bebe_con_avidez: ['toma con desesperacion', 'se lo toma con desesperacion', 'bebe con desesperacion', 'toma con ansias', 'pide agua a cada rato', 'tiene mucha sed', 'mucha sed'],
  bebe_mal: ['no quiere toma', 'toma muy poco', 'casi no quiere toma'],
  ojos_hundidos: ['ojos sumidos', 'se le sumieron los ojos', 'se le hundieron los ojos'],
  mollera_hundida: ['se le cayo la mollera', 'caida de mollera', 'mollera sumida'],
  manos_pies_frios: ['manos heladas', 'pies helados', 'manos y pies helados', 'esta frio de las manos'],
  // fiebre / piel
  fiebre: ['se siente caliente', 'lo siento caliente', 'la siento caliente', 'arde en fiebre', 'hirviendo en calentura', 'le subio la calentura', 'le subio la temperatura', 'anda con calentura', 'con temperatura', 'calenturiento', 'calenturienta'],
  rigidez_nuca: ['no puede bajar la cabeza', 'no puede agachar la cabeza', 'tiene el cuello duro', 'cuello tieso'],
  sarpullido: ['le brotaron ronchas', 'le salieron ronchas', 'le salieron granos', 'le brotaron granos', 'brotes en la piel', 'manchas rojas'],
  sangrado_mucosas: ['le sale sangre de la nariz', 'echa sangre por la nariz', 'le sale sangre de las encias', 'le sangran las encias'],
  dolor_muscular_articular: ['le duele todo el cuerpo', 'le duelen los huesos', 'tiene el cuerpo cortado', 'le duelen las coyunturas'],
  // neurológico
  dolor_cabeza_intenso: ['le duele la cabeza fuerte', 'le duele fuerte la cabeza', 'dolor de cabeza bien fuerte', 'dolor constante de cabeza', 'dolor de cabeza constante', 'le duele la cabeza todo el tiempo', 'le estalla la cabeza', 'le revienta la cabeza'],
  vision_borrosa: ['ve mosquitas', 've moscas', 've chispitas', 've lucecitas de colores', 've nublado', 've todo borroso'],
  zumbido_oidos: ['le suenan los oidos', 'le zumban los oidos', 'zumbido de oidos'],
  dificultad_hablar: ['habla enredado', 'habla mocho', 'no le salen las palabras', 'arrastra la lengua'],
  debilidad_un_lado: ['no puede mover el lado', 'se le durmio el brazo y la pierna', 'se le paralizo la mitad'],
  confusion: ['no sabe ni donde esta', 'no reconoce a nadie', 'dice cosas sin sentido', 'esta desorientado'],
  // embarazo / posparto
  sangrado_vaginal: ['esta manchando', 'anda manchando', 'le salio sangre por abajo', 'sangrado por abajo', 'le baja sangre'],
  salida_liquido_vaginal: ['le esta saliendo agua por abajo', 'le sale agua por abajo', 'se mojo sin orinar', 'se le salio la fuente'],
  movimientos_fetales_disminuidos: ['no lo siente moverse', 'no siente que se mueva', 'casi no se mueve el bebe', 'el bebe ya no patea', 'ya no lo siente patear'],
  contracciones: ['le vienen los dolores', 'le dan los dolores', 'le empezaron los dolores', 'dolores de parto'],
  hinchazon_cara_manos: ['se le hinchan las manos', 'se le hincha la cara', 'se le hinchan los pies', 'manos hinchadas', 'cara hinchada', 'los anillos no le entran'],
  posparto: ['haberse aliviado', 'haber dado a luz', 'haber parido', 'despues del parto', 'despues de parir', 'acaba de tener su bebe', 'tuvo su bebe hace', 'esta en cuarentena'],
  pechos_rojos_dolorosos: ['pecho rojo', 'pecho duro y rojo', 'se le endurecio el pecho', 'pecho inflamado', 'pechos rojos', 'pecho rojo y duro'],
  sangrado_aumenta: ['cada vez le baja mas sangre', 'le volvio a bajar sangre', 'le volvio a bajar mucha sangre', 'le volvio el sangrado'],
  depresion_grave: ['anda muy triste', 'llora todo el dia', 'no quiere hacer nada'],
  ideas_suicidas: ['no quiere vivir', 'ya no quiere vivir', 'quiere morirse', 'mejor morirse', 'se quiere colgar', 'se quiere aventar', 'quiere quitarse la vida', 'habla de matarse', 'dice que se va a matar', 'piensa en matarse', 'quiere desaparecer'],
  // recién nacido
  no_come_bien: ['no agarra pecho', 'no se pega al pecho', 'no se pega pecho', 'no quiere pecho', 'no come', 'rechaza el pecho', 'mama sin fuerza', 'mama sin ganas', 'no succiona', 'no chupa'],
  se_siente_frio: ['esta helado', 'esta helada', 'lo siento helado', 'la siento helada'],
  no_se_mueve: ['no se mueve nada', 'esta como trapo', 'esta flojo'],
  // cardiovascular
  dolor_pecho: ['peso en el pecho', 'presion en el pecho', 'punzada en el pecho', 'le oprime el pecho', 'le duele el corazon', 'dolor que se le corre al brazo', 'se le corre al brazo izquierdo'],
  sudor_frio: ['suda frio', 'sudor frio', 'esta sudando frio', 'sudadera fria'],
  // trauma / mordeduras / intoxicaciones
  trauma_grave: ['se cayo del caballo', 'lo tumbo el caballo', 'la tumbo el caballo', 'lo pateo un caballo', 'se pego fuerte en la cabeza', 'se pego duro en la cabeza', 'se dio un golpe fuerte en la cabeza', 'se descalabro', 'se volco', 'volcadura', 'le dieron un balazo', 'balazo', 'lo acuchillaron', 'navajazo', 'lo machucaron'],
  fractura: ['se le quebro', 'se le ve el hueso', 'se descoyunto', 'hueso salido', 'se le zafo'],
  quemadura: ['se le cayo agua caliente', 'se echo encima agua caliente', 'se quemo con aceite', 'se quemo con la lumbre', 'se quemo con el comal'],
  mordedura_serpiente: ['le pico una culebra', 'lo mordio una culebra', 'mordida de culebra', 'picadura de vibora'],
  mordedura_animal: ['le mordio un perro', 'un perro le mordio', 'lo mordio el perro', 'mordida de perro', 'lo araño un gato', 'mordida de murcielago'],
  intoxicacion: ['se tomo muchas pastillas', 'se tomo todas las pastillas', 'se tomo un frasco de pastillas', 'sobredosis', 'se tomo el raticida', 'tomo raticida', 'matarratas', 'tomo herbicida', 'tomo insecticida', 'tomo paraquat', 'tomo gasolina', 'tomo petroleo', 'liquido para matar la plaga', 'se tomo el liquido de la plaga'],
  // urinario
  ardor_orinar: ['le quema al orinar', 'le arde al hacer pipi', 'chistate', 'orina a cada rato', 'orina seguido'],
  no_puede_orinar: ['no puede hacer del uno', 'no le sale la orina', 'se le tapo la orina'],
};

/** Si se detecta la clave de la izquierda, también se marca la de la derecha (más general). */
const IMPLIES: Partial<Record<SymptomKeyStrict, SymptomKeyStrict[]>> = {
  dolor_cabeza_intenso: ['dolor_cabeza'],
  dolor_cabeza_subito: ['dolor_cabeza'],
  palidez_intensa: ['palidez'],
  vomito_persistente: ['vomito'],
  vomita_todo: ['vomito'],
  vomito_sangre: ['vomito'],
  dolor_abdominal_intenso: ['dolor_abdominal'],
  sangrado_abundante: ['sangrado'],
  pliegue_muy_lento: ['pliegue_lento'],
  // Ronda 3
  dolor_derecha_baja: ['dolor_abdominal'],
  no_obra_ni_gases: ['estrenimiento'],
  herida_profunda: ['herida'],
  herida_sucia: ['herida'],
  herida_infectada: ['herida'],
  objeto_clavado: ['herida'],
  quemadura_grave: ['quemadura'],
  quemadura_quimica_electrica: ['quemadura'],
  tos_sangre: ['tos'],
  placas_garganta: ['dolor_garganta'],
  arana_sintomas: [],
};

/**
 * Coincidencias que, si quedan DENTRO de una frase más larga de otra clave, se descartan
 * (p. ej. "chorro" -> diarrea dentro de "chorro de sangre" -> sangrado abundante).
 * clave contenida -> claves contenedoras que la anulan.
 */
const SUPPRESSED_INSIDE: Partial<Record<SymptomKeyStrict, SymptomKeyStrict[]>> = {
  diarrea: ['sangrado_abundante'],
  no_se_mueve: ['movimientos_fetales_disminuidos'],
  letargico: ['inconsciente'],
  sangrado: ['sangrado_mucosas', 'sangrado_vaginal', 'sangre_heces', 'vomito_sangre', 'sangrado_abundante', 'flujo_mal_olor', 'sangre_oido', 'orina_sangre', 'tos_sangre', 'arana_sintomas'],
  // "le sale agua del oído" no es "se le rompió la fuente" (que implica embarazo).
  salida_liquido_vaginal: ['pus_oido'],
  // "angina de pecho" (DEM acep. 3) es dolor de pecho, no de garganta.
  dolor_garganta: ['dolor_pecho'],
  // "se le hinchó la cara por la muela" no es la hinchazón de cara del embarazo.
  hinchazon_cara_manos: ['hinchazon_ambos_pies', 'hinchazon_boca_cuello', 'hinchazon_labios_lengua', 'hinchazon_cuello_ojo'],
  // "no puede tragar ni su saliva": el signo es de garganta.
  no_puede_beber: ['no_traga_saliva'],
  // "no echa gases" dentro de "no obra ni echa gases": ya cuenta la clave más específica.
  gases: ['no_obra_ni_gases'],
  vomito: ['vomito_sangre'],
  se_siente_frio: ['manos_pies_frios', 'sudor_frio'],
  dolor_pecho: ['pechos_rojos_dolorosos'],
  zumbido_oidos: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Normalización
// ─────────────────────────────────────────────────────────────────────────────

/** minúsculas, sin acentos, puntuación -> " | " (frontera de cláusula), decimales "38,5" -> "38.5". */
export function normalizeText(s: string): string {
  return ` ${s} `
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/°\s*c?(?![a-z])/g, ' grados ')
    .replace(/(\d)\s*,\s*(\d)/g, '$1.$2')
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' | ')
    .replace(/[,;:!?¡¿()"“”«»…\n\r\t-]+/g, ' | ')
    .replace(/[^a-z0-9.| ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Fonética ligera del español para tolerar ortografía de ASR. Se aplica igual a texto y sinónimos. */
export function phonetic(word: string): string {
  return word
    .replace(/ch/g, '§')
    .replace(/h/g, '')
    .replace(/§/g, 'ch')
    .replace(/ll/g, 'y')
    .replace(/v/g, 'b')
    .replace(/z/g, 's')
    .replace(/c([ei])/g, 's$1');
}

const toTokens = (s: string) => normalizeText(s).split(' ').filter(Boolean);
const phonTokens = (s: string) => toTokens(s).map(phonetic);
/** Artículos que se ignoran al buscar síntomas ("le cuesta jalar EL aire" = "le cuesta jalar aire"). */
const ARTICLES = new Set(['el', 'la', 'los', 'las', 'un', 'una']);
const BODY = '(?:pecho|cabeza|panza|pancita|estomago|barriga|vientre|huesos|cuerpo|garganta|oidos?|ojos?|espalda|piernas?|brazos?|muelas?|nuca|cuello|costado|rinones?)';
const HUELE_BODY = new RegExp(`\\bhuele(n)?\\b(?= (?:mucho |muchisimo |bien |harto )?(?:el |la |los |las |su |sus )?${BODY}\\b)`, 'g');
/**
 * Correcciones de errores típicos de Whisper medidos en el banco (docs/ai.md):
 * "le HUELE el pecho / la cabeza" (no existe en español para olor) = "le DUELE".
 */
export function asrFix(normalized: string): string {
  return normalized.replace(HUELE_BODY, 'duele$1');
}
/**
 * Formas canónicas (ronda 2, docs/eval.md): se aplican IGUAL al texto y a los sinónimos, así que una
 * sola frase de sinónimo cubre diminutivos ("ojitos", "pancita", "calientito"), variantes de la misma
 * parte del cuerpo ("barriga", "estómago" = "panza") y conjugaciones ("le duelen" = "le duele",
 * "mordió/morder/mordida", "se le hinchan/hinchada/inflamada").
 * Los colores ("amarillito", "moradito", "azulito") NO se canonizan: "amarillo" o "azul" solos
 * no deben bastar para un signo.
 */
const CANON: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  const set = (to: string, ...from: string[]) => { for (const f of from) m[f] = to; };
  // partes del cuerpo (diminutivos y equivalentes)
  set('ojos', 'ojitos'); set('ojo', 'ojito');
  set('pecho', 'pechito');
  set('panza', 'pancita', 'panzita', 'barriga', 'barriguita', 'estomago', 'estomaguito', 'tripita', 'tripitas');
  set('manos', 'manitas', 'manitos'); set('mano', 'manita', 'manito');
  set('pies', 'piecitos', 'patitas'); set('pie', 'piecito');
  set('brazos', 'bracitos'); set('brazo', 'bracito');
  set('piernas', 'piernitas'); set('pierna', 'piernita');
  set('cara', 'carita'); set('boca', 'boquita'); set('cabeza', 'cabecita'); set('cuerpo', 'cuerpecito', 'cuerpito');
  set('dedos', 'deditos'); set('dedo', 'dedito'); set('labios', 'labiecitos', 'labiecito', 'labiesitos');
  set('nariz', 'naricita'); set('costillas', 'costillitas'); set('mollera', 'mollerita'); set('ombligo', 'ombliguito');
  set('lengua', 'lenguita'); set('cuello', 'cuellito'); set('muneca', 'munequita'); set('tobillo', 'tobillito');
  set('palmas', 'palmitas'); set('unas', 'unitas');
  // estados y cantidades
  set('caliente', 'calientito', 'calientita', 'calientitos', 'calientitas');
  set('duro', 'durito'); set('dura', 'durita');
  set('rapido', 'rapidito', 'rapidita'); set('poco', 'poquito', 'poquita');
  set('tos', 'tosecita'); set('calentura', 'calenturita');
  set('ronchas', 'ronchitas'); set('granos', 'granitos'); set('puntos', 'puntitos'); set('pintas', 'pintitas'); set('manchas', 'manchitas');
  set('agua', 'aguita'); set('sangre', 'sangrita');
  set('helado', 'heladito'); set('helada', 'heladita'); set('flojo', 'flojito'); set('floja', 'flojita');
  set('dormido', 'dormidito'); set('dormida', 'dormidita');
  // verbos (una forma por verbo)
  set('duele', 'duelen', 'dolia', 'dolian', 'dolio', 'doliendo');
  set('mordio', 'morder', 'mordida', 'mordido', 'mordidas', 'mordia', 'mordieron', 'muerde', 'muerden', 'mordedura');
  set('hinchado', 'hinchada', 'hinchados', 'hinchadas', 'hincha', 'hinchan', 'hincho', 'hincharon', 'hinchando', 'hinchazon', 'hinchandose',
    'inflamado', 'inflamada', 'inflamados', 'inflamadas', 'inflama', 'inflaman', 'inflamo', 'inflamaron');
  set('agarra', 'agarrar', 'agarro', 'agarraba', 'agarrando');
  set('mama', 'mamar', 'mamo', 'mamaba', 'mamando');
  set('come', 'comer', 'comio', 'comia', 'comiendo');
  set('toma', 'tomar', 'tomo', 'tomaba', 'tomando');
  set('traga', 'tragar', 'trago');
  set('sangra', 'sangrar', 'sangrando', 'sangro', 'sangraba');
  set('quiere', 'quiso', 'queria'); set('puede', 'pudo', 'podia');
  return m;
})();
const canon = (t: string) => CANON[t] ?? t;
const symptomTokens = (s: string) => asrFix(normalizeText(s)).split(' ').filter((t) => t && !ARTICLES.has(t)).map(canon).map(phonetic);

// ─────────────────────────────────────────────────────────────────────────────
// Índice de sinónimos (se construye una vez)
// ─────────────────────────────────────────────────────────────────────────────
interface SynEntry { key: SymptomKeyStrict; toks: string[]; compact: string }

const SYN_INDEX: SynEntry[] = (() => {
  const out: SynEntry[] = [];
  const seen = new Set<string>();
  const add = (key: SymptomKeyStrict, phrase: string) => {
    const toks = symptomTokens(phrase).filter((t) => t !== '|');
    if (!toks.length) return;
    const id = `${key}::${toks.join(' ')}`;
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ key, toks, compact: toks.join('') });
  };
  for (const [key, def] of Object.entries(SYMPTOMS) as [SymptomKeyStrict, { synonyms: string[] }][]) {
    for (const s of def.synonyms) add(key, s);
  }
  for (const extra of [EXTRA_SYNONYMS, EXTRA_SYNONYMS_R2]) {
    for (const [key, list] of Object.entries(extra) as [SymptomKeyStrict, string[]][]) {
      for (const s of list) add(key, s);
    }
  }
  // Etiquetas del catálogo (sin paréntesis) y la clave en palabras: sirven para mapear
  // texto "estándar" (p. ej. la salida parafraseada del LLM) además del coloquial.
  for (const [key, def] of Object.entries(SYMPTOMS) as [SymptomKeyStrict, { es: string }][]) {
    for (const part of def.es.replace(/\([^)]*\)/g, ' ').split(/\s*\/\s*/)) {
      const t = part.trim();
      if (t.split(/\s+/).length >= 1 && !/^(no|sin|mas|menos)\b/i.test(t)) add(key, t);
    }
    add(key, key.replace(/_/g, ' '));
  }
  // Más largas primero: las frases específicas ganan.
  return out.sort((a, b) => b.compact.length - a.compact.length);
})();

// ─────────────────────────────────────────────────────────────────────────────
// Negación
// ─────────────────────────────────────────────────────────────────────────────
const NEG_CUES = new Set(['no', 'sin', 'nunca', 'ni', 'tampoco', 'jamas', 'niega', 'nada']);
const BREAKERS = new Set(['|', 'pero', 'aunque', 'y', 'e', 'sino', 'porque', 'pues', 'entonces', 'tambien', 'ademas', 'si']);
/** "no se le QUITA la calentura" = sigue con calentura. */
const PERSIST_VERBS = new Set(['quita', 'quito', 'baja', 'bajo', 'para', 'paro', 'calma', 'calmo', 'pasa', 'paso', 'mejora', 'mejoro', 'compone', 'cede', 'cedio', 'sede', 'sedio', 'deja', 'dejo', 'controla', 'corta', 'corto']);
/** Tras una negación, la palabra "si" de "no sé si" marca incertidumbre. */
const UNCERTAIN_AFTER_NO = new Set(['se', 'sabe', 'sabemos', 'saben', 'estoy', 'esta', 'recuerdo', 'acuerdo']);

/** 'resolved' = lo tuvo y ya se le quitó ("ya no vomita"): no se marca (la fiebre resuelta → fiebre_reciente). */
type Polarity = 'pos' | 'neg' | 'unknown' | 'resolved';

/**
 * Mira hasta 4 palabras antes del inicio de la coincidencia (sin cruzar fronteras de cláusula)
 * y 1-2 palabras después ("calentura no tiene").
 */
function polarityAt(toks: string[], start: number, end: number): Polarity {
  // Incertidumbre: "no sé si tiene calentura" / "quién sabe si"
  for (let i = start - 1, n = 0; i >= 0 && n < 6; i--, n++) {
    const w = toks[i];
    if (w === '|') break;
    if (w === 'si' && i >= 1 && (UNCERTAIN_AFTER_NO.has(toks[i - 1]) || toks[i - 1] === 'sabe')) {
      if (i >= 2 && (toks[i - 2] === 'no' || toks[i - 2] === 'quien' || toks[i - 1] === 'sabe')) return 'unknown';
    }
  }
  for (let i = start - 1, n = 0; i >= 0 && n < 5; i--, n++) {
    const w = toks[i];
    if (BREAKERS.has(w)) break;
    if (NEG_CUES.has(w)) {
      // "ya no" = ya se resolvió (antes sí lo tenía): no marcar.
      if (w === 'no' && i >= 1 && toks[i - 1] === 'ya') return 'unknown';
      // "no se le quita la calentura" / "no le baja"
      for (let j = i + 1; j < start; j++) if (PERSIST_VERBS.has(toks[j])) return 'pos';
      // "nada" solo niega como "nada de X" inmediatamente antes
      if (w === 'nada' && !(toks[i + 1] === 'de' && i + 2 === start)) continue;
      return 'neg';
    }
  }
  // Post-negación: "calentura no", "calentura no tiene", "tos no ha tenido"
  const a = toks[end], b = toks[end + 1], c = toks[end + 2];
  if (a === 'no' && (b === undefined || b === '|' || ((b === 'tiene' || b === 'ha' || b === 'hay' || b === 'presenta') && (c === undefined || c === '|' || c === 'tenido' || c === 'pero')))) {
    return 'neg';
  }
  return 'pos';
}

// ─────────────────────────────────────────────────────────────────────────────
// Ronda 2: huecos, "ya no", eventos y marcos de co-ocurrencia (docs/eval.md)
// ─────────────────────────────────────────────────────────────────────────────

/** Palabras de relleno que pueden ir DENTRO de una frase de sinónimo sin cambiar su sentido. */
const FILLERS = new Set(
  ['mucho', 'mucha', 'muchos', 'muchas', 'muchisimo', 'muchisima', 'bien', 'muy', 'bastante', 'harto', 'harta', 'todo', 'toda', 'todos', 'todas',
    'su', 'sus', 'mi', 'mis', 'le', 'les', 'se', 'me', 'te', 'lo', 'nos', 'tan', 're', 'medio', 'algo', 'tantito', 'como', 'ya', 'demasiado', 'asi', 'feo', 'horrible', 'otra', 'vez']
    .map(phonetic),
);
/** Verbos modales que pueden ir justo después de un "no" del sinónimo: "no QUIERE agarrar" = "no agarra". */
const MODAL_AFTER_NO = new Set(['quiere', 'puede', 'ha', 'han', 'he', 'a', 'an'].map(phonetic));
const MAX_GAP = 2;

/** Fin (exclusivo) de una coincidencia con hasta MAX_GAP palabras de relleno en total; 0 si no hay. */
function gappedMatchEnd(toks: string[], start: number, syn: string[]): number {
  let j = start + 1;
  let gaps = 0;
  for (let k = 1; k < syn.length; k++) {
    while (j < toks.length && toks[j] !== syn[k]) {
      const w = toks[j];
      const modalOk = syn[k - 1] === 'no' && MODAL_AFTER_NO.has(w);
      if (w === '|' || gaps >= MAX_GAP || !(FILLERS.has(w) || modalOk)) return 0;
      gaps++;
      j++;
    }
    if (j >= toks.length) return 0;
    j++;
  }
  return gaps > 0 ? j : 0;
}

/**
 * Signos que cuentan aunque ya hayan pasado ("ya se le pasó el ataque" sigue siendo convulsión en esta
 * enfermedad; un sangrado en el embarazo cuenta aunque ya paró). Para estas claves, "ya no / ya dejó de /
 * ya se le pasó" NO anula el hallazgo. Una negación simple ("no ha tenido ataques") sí lo niega.
 */
const EVENT_KEYS = new Set<SymptomKeyStrict>([
  'convulsiones', 'desmayo', 'inconsciente', 'cianosis', 'apnea', 'trauma_grave', 'golpe_caida', 'fractura', 'quemadura',
  'mordedura_serpiente', 'mordedura_animal', 'intoxicacion', 'vomito_sangre', 'heces_negras', 'sangrado_vaginal',
  'salida_liquido_vaginal', 'ideas_suicidas', 'cara_caida', 'debilidad_un_lado', 'dificultad_hablar', 'perdida_vision_subita',
  'sangre_heces', 'posparto',
  // Ronda 3: el piquete, la mordedura, el golpe o la herida cuentan aunque "ya se le pasó" el dolor.
  'picadura_alacran', 'mordedura_arana', 'arana_peligrosa', 'golpe_cabeza', 'herida', 'herida_sucia', 'herida_profunda',
  'quemadura_grave', 'quemadura_quimica_electrica', 'tos_sangre', 'orina_sangre', 'hinchazon_labios_lengua', 'azucar_baja',
]);
const RESOLVE_VERBS = new Set(['quito', 'paso', 'bajo', 'calmo', 'compuso', 'corto', 'sano', 'curo', 'alibio'].map(phonetic));

/** ¿Hay "ya ... se le quitó / pasó / bajó" justo después de la coincidencia (misma cláusula)? */
function resolvedAfter(toks: string[], end: number): boolean {
  for (let i = end, n = 0; i < toks.length && n < 5; i++, n++) {
    const w = toks[i];
    if (w === '|' || w === 'pero' || w === 'aunque') return false;
    if (RESOLVE_VERBS.has(w)) {
      // "no se le quita" = persiste
      for (let j = Math.max(end, i - 3); j < i; j++) if (toks[j] === 'no') return false;
      return true;
    }
  }
  return false;
}

/** ¿"ya dejó de <síntoma>" / "dejó de <síntoma>" justo antes? ("no deja de vomitar" = persiste). */
function stoppedBefore(toks: string[], start: number): boolean {
  if (toks[start - 1] !== 'de' || !['dejo', 'deja', 'dejaba'].includes(toks[start - 2])) return false;
  return toks[start - 3] !== 'no';
}

/** ¿El "no" que niega está precedido por "ya"? (polarityAt devuelve 'unknown' en ese caso). */
function yaNoBefore(toks: string[], start: number): boolean {
  for (let i = start - 1, n = 0; i >= 1 && n < 5; i--, n++) {
    if (BREAKERS.has(toks[i])) return false;
    if (toks[i] === 'no') return toks[i - 1] === 'ya';
  }
  return false;
}

/**
 * Polaridad con la lógica de "ya no" de la ronda 2:
 *  - "ya no + capacidad" ("ya no quiere agarrar el pecho", "ya no despierta") = signo NUEVO: el sinónimo
 *    empieza con "no" ("no agarra el pecho"), así que el "ya" de antes no lo niega → 'pos'.
 *  - "ya no + síntoma" ("ya no vomita", "ya no tiene calentura"), "ya dejó de sangrar", "la calentura ya
 *    se le quitó" = resuelto → 'resolved' (no se marca; la fiebre resuelta pasa a fiebre_reciente).
 *  - En EVENT_KEYS lo resuelto sigue contando → 'pos'.
 */
function polarityFor(key: SymptomKeyStrict, toks: string[], start: number, end: number): Polarity {
  const base = polarityAt(toks, start, end);
  const resolved = (base === 'unknown' && yaNoBefore(toks, start)) || (base === 'pos' && (stoppedBefore(toks, start) || resolvedAfter(toks, end)));
  if (!resolved) return base;
  return EVENT_KEYS.has(key) ? 'pos' : 'resolved';
}

/**
 * Marcos de co-ocurrencia: dos grupos de palabras en la misma cláusula, a pocas palabras, en cualquier
 * orden (o A antes de B). Cubren el orden libre del habla ("un perro le mordió" / "lo mordió el perro",
 * "la muñeca chueca", "la boca se le ve torcida", "hace del baño con sangre"). Si entre A y B hay
 * una negación ("la popó no trae sangre"), el hallazgo queda negado.
 */
interface Frame { key: SymptomKeyStrict; a: string[]; b: string[]; dist: number; order?: 'ab'; guardA?: (toks: string[], i: number) => boolean }
const FRAMES: Frame[] = ([
  { key: 'dolor_pecho', a: ['pecho'], b: ['duele', 'dolor', 'aprieta', 'apretado', 'apretando', 'oprime', 'opresion', 'peso', 'presion', 'punzada', 'piquete', 'aplasta', 'aplastan'], dist: 3 },
  { key: 'hinchazon_cara_manos', a: ['cara', 'manos', 'mano', 'parpados', 'piernas', 'dedos'], b: ['hinchado'], dist: 3 },
  { key: 'mordedura_animal', a: ['perro', 'perrito', 'perra', 'gato', 'gatito', 'murcielago', 'raton', 'rata', 'mapache', 'tlacuache', 'zorro', 'zorrillo', 'coyote', 'chango', 'mono', 'ardilla', 'tejon', 'puerco', 'cerdo', 'burro', 'caballo', 'animal'], b: ['mordio', 'arano', 'aranazo', 'rasguno'], dist: 4 },
  { key: 'mordedura_serpiente', a: ['vibora', 'culebra', 'serpiente', 'cascabel', 'nauyaca', 'coralillo'], b: ['mordio', 'pico', 'picadura', 'pica'], dist: 4 },
  { key: 'fractura', a: ['brazo', 'pierna', 'muneca', 'tobillo', 'dedo', 'mano', 'pie', 'hueso', 'codo', 'rodilla', 'hombro', 'clavicula', 'cadera', 'muslo', 'espinilla', 'antebrazo'], b: ['chueco', 'chueca', 'quebro', 'quebrado', 'quebrada', 'roto', 'rota', 'fracturo', 'fracturado', 'fracturada', 'deforme', 'zafo', 'zafado', 'zafada'], dist: 3 },
  { key: 'dolor_muscular_articular', a: ['cuerpo', 'huesos', 'musculos', 'coyunturas', 'articulaciones'], b: ['duele', 'dolor', 'cortado', 'molido'], dist: 3 },
  {
    key: 'sangre_heces', order: 'ab', dist: 4, b: ['sangre', 'sangrado', 'sangra'],
    a: ['popo', 'caca', 'heces', 'excremento', 'evacuacion', 'evacuaciones', 'evacua', 'asientos', 'diarrea', 'diarreas', 'obra', 'obrando', 'pupu', 'bano'],
    // "baño" solo como "hace/hizo del baño"
    guardA: (t: string[], i: number) => t[i] !== phonetic('bano') || t[i - 1] === 'del',
  },
  { key: 'fiebre', order: 'ab', dist: 3, a: ['siente', 'siento', 'sentimos', 'sentia', 'anda', 'amanecio', 'nota', 'noto', 'puso', 'esta'], b: ['caliente', 'hirviendo'] },
  { key: 'cara_caida', a: ['boca', 'cara'], b: ['torcida', 'torcido', 'chueca', 'chueco', 'caida', 'ladeada', 'jalada', 'colgada'], dist: 3 },
  // Ronda 3 (docs/research-common-complaints.md): orden libre ("un alacrán le picó", "le picó en el pie un alacrán").
  { key: 'picadura_alacran', a: ['alacran', 'alacrancito', 'escorpion', 'alacranes'], b: ['pico', 'picado', 'picada', 'picadura', 'piquete', 'pica', 'mordio'], dist: 4 },
  { key: 'mordedura_arana', a: ['arana', 'aranita', 'aranas', 'viuda', 'capulina', 'violinista'], b: ['mordio', 'pico', 'picado', 'picada', 'picadura', 'piquete', 'pica'], dist: 4 },
  { key: 'golpe_cabeza', a: ['cabeza'], b: ['pego', 'pegaron', 'golpeo', 'golpe', 'golpazo', 'madrazo', 'trancazo', 'descalabro'], dist: 3 },
  { key: 'hinchazon_labios_lengua', a: ['labios', 'labio', 'lengua', 'boca'], b: ['hinchado'], dist: 3 },
  { key: 'quemadura_grave', a: ['quemo', 'quemada', 'quemado', 'quemadura', 'quemaduras'], b: ['cara', 'cuello'], dist: 3 },
  { key: 'dolor_espalda_baja', a: ['espalda', 'cintura'], b: ['duele', 'dolor'], dist: 3 },
  { key: 'dolor_oido', a: ['oido', 'oidos', 'oreja'], b: ['duele', 'dolor'], dist: 3 },
  { key: 'dolor_garganta', a: ['garganta'], b: ['duele', 'dolor', 'arde'], dist: 3 },
] as Frame[]).map((f) => ({ ...f, a: f.a.map(phonetic), b: f.b.map(phonetic) }));

const NEG_INSIDE = new Set(['no', 'sin', 'ni', 'nunca']);
const FRAME_STOP = new Set(['|', 'pero', 'aunque', 'sino']);

function frameHits(toks: string[]): Hit[] {
  const out: Hit[] = [];
  for (const fr of FRAMES) {
    for (let i = 0; i < toks.length; i++) {
      const isA = fr.a.includes(toks[i]) && (!fr.guardA || fr.guardA(toks, i));
      const isB = fr.order !== 'ab' && fr.b.includes(toks[i]);
      if (!isA && !isB) continue;
      const other = isA ? fr.b : fr.a;
      for (let j = i + 1, n = 0; j < toks.length && n <= fr.dist; j++, n++) {
        if (FRAME_STOP.has(toks[j])) break;
        if (!other.includes(toks[j])) continue;
        if (!isA && fr.guardA && !fr.guardA(toks, j)) continue;
        const between = toks.slice(i + 1, j);
        const pol: Polarity = between.some((w) => NEG_INSIDE.has(w)) ? 'neg' : polarityFor(fr.key, toks, i, j + 1);
        out.push({ key: fr.key, start: i, end: j + 1, pol });
        break;
      }
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Números en palabras -> dígitos
// ─────────────────────────────────────────────────────────────────────────────
const UNITS: Record<string, number> = { cero: 0, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9 };
const ONE = new Set(['un', 'uno', 'una']);
const TEENS: Record<string, number> = {
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
};
const TENS: Record<string, number> = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };
const ORDINAL_MONTH: Record<string, number> = { primer: 1, primero: 1, segundo: 2, tercer: 3, tercero: 3, cuarto: 4, quinto: 5, sexto: 6, septimo: 7, setimo: 7, octavo: 8, noveno: 9 };
const UNIT_WORD = /^(ano|anos|anito|anitos|mes|meses|mesecito|mesecitos|semana|semanas|semanita|semanitas|dia|dias|diita|diitas|hora|horas|horita|horitas|minuto|minutos)$/;

function wordsToDigits(toks: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < toks.length; ) {
    const w = toks[i];
    let val: number | null = null;
    let j = i;
    if (w === 'cien' || w === 'ciento') {
      val = 100; j++;
    }
    const t = toks[j];
    if (t !== undefined && TENS[t] !== undefined) {
      val = (val ?? 0) + TENS[t]; j++;
      if (toks[j] === 'y' && toks[j + 1] !== undefined && (UNITS[toks[j + 1]] !== undefined || ONE.has(toks[j + 1]))) {
        val += UNITS[toks[j + 1]] ?? 1; j += 2;
      }
    } else if (t !== undefined && TEENS[t] !== undefined) {
      val = (val ?? 0) + TEENS[t]; j++;
    } else if (t !== undefined && UNITS[t] !== undefined) {
      val = (val ?? 0) + UNITS[t]; j++;
    } else if (t !== undefined && ONE.has(t) && toks[j + 1] !== undefined && UNIT_WORD.test(toks[j + 1])) {
      val = (val ?? 0) + 1; j++;
    }
    if (val === null) { out.push(w); i++; continue; }
    out.push(String(val));
    i = j;
  }
  return out;
}

/** Texto numérico: palabras->dígitos, "y medio", "punto", sin fronteras. */
export function numericText(raw: string): string {
  const toks = wordsToDigits(toTokens(raw));
  return ` ${toks.join(' ')} `
    .replace(/\|/g, ' ')
    .replace(/\bmedio (ano|anito)\b/g, '0.5 ano')
    .replace(/\bmedia hora\b/g, '0.5 hora')
    .replace(/(\d+(?:\.\d+)?) (anos?|anitos?|mes|meses|semanas?|dias?|horas?) y medi[oa]\b/g, (_m, n: string, u: string) => `${parseFloat(n) + 0.5} ${u}`)
    .replace(/(^|[^\d] )(ano|anito|mes|semana|dia|hora) y medi[oa]\b/g, (_m, p: string, u: string) => `${p}1.5 ${u}`)
    .replace(/(\d+) (?:punto|con) (\d)\b/g, '$1.$2')
    .replace(/(\d+) y medio\b/g, (_m, n: string) => `${parseInt(n, 10) + 0.5}`)
    .replace(/\s+/g, ' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Extracción numérica
// ─────────────────────────────────────────────────────────────────────────────
const NUM = '(\\d+(?:\\.\\d+)?)';
const DAYS_PER_MONTH = 30.4375;
const round1 = (n: number) => Math.round(n * 10) / 10;

function unitToDays(n: number, unit: string): number | undefined {
  if (/^hora|^horita/.test(unit)) return n / 24;
  if (/^dia|^diita/.test(unit)) return n;
  if (/^semana/.test(unit)) return n * 7;
  if (/^mes/.test(unit)) return n * 30;
  if (/^an/.test(unit)) return n * 365;
  return undefined;
}

/** Borra un tramo del texto (para que la edad no confunda "7 meses de embarazo" o "hace 3 meses"). */
const blank = (s: string, idx: number, len: number) => s.slice(0, idx) + ' '.repeat(len) + s.slice(idx + len);

interface NumericOut {
  temperatura_c?: number;
  resp_por_min?: number;
  semanas_embarazo?: number;
  embarazo_por_numero?: boolean;
  duracion_dias?: number;
  edad_meses?: number;
  /** días desde el parto ("dio a luz hace 2 semanas") */
  posparto_dias?: number;
}

const BIRTH_CTX = /(dio a luz|se alivio|tuvo (?:a )?(?:su |el |la )?(?:bebe|nino|nina|hijo|hija)|parto|nacio|cesarea|aliviada|parida)\s*(?:\S+\s+){0,2}$/;
const PERSON = '(?:senora|senor|nino|nina|ninito|ninita|bebe|bebito|bebita|nene|nena|muchacho|muchacha|chamaco|chamaca|chamaquito|chamaquita|joven|abuelo|abuela|abuelito|abuelita|don|dona|hombre|mujer|paciente|chavo|chava|chiquillo|chiquilla|morro|morra|criatura|hijo|hija|senorita|viejito|viejita|anciano|anciana|chiquito|chiquita|escuincle|muchachito|muchachita)';

export function parseNumbers(raw: string): NumericOut {
  let s = numericText(raw);
  const o: NumericOut = {};

  // Temperatura (34–43.5 °C)
  const tempRes = [
    new RegExp(`${NUM} (?:grados|de temperatura|de fiebre|de calentura|centigrados)`, 'g'),
    new RegExp(`(?:temperatura|fiebre|calentura|termometro|marca|marco|marcaba|marcaron)(?: [a-z]+){0,3}? (?:de |en |a )?${NUM}\\b`, 'g'),
  ];
  for (const re of tempRes) {
    for (const m of s.matchAll(re)) {
      const v = parseFloat(m[1]);
      if (v >= 34 && v <= 43.5 && o.temperatura_c === undefined) { o.temperatura_c = round1(v); }
      if (v >= 34 && v <= 43.5) s = blank(s, m.index!, m[0].length);
    }
  }

  // Frecuencia respiratoria (5–150 /min)
  const hasResp = /respir|resuell/.test(s);
  const respRes = [
    new RegExp(`${NUM} (?:respiraciones|respiros|resp|veces|respira)(?: [a-z]+){0,3}? (?:por|en un|en el|al|cada|x) minuto`, 'g'),
    new RegExp(`(?:respira|respiraba|respiracion|respiraciones|resuella)(?: [a-z]+){0,3}? ${NUM} (?:veces |respiraciones )?(?:por|en un|en el|al|cada|x) minuto`, 'g'),
    new RegExp(`frecuencia respiratoria (?:de |es de |en )?${NUM}`, 'g'),
    new RegExp(`${NUM} respiraciones`, 'g'),
    ...(hasResp ? [new RegExp(`(?:conte|contamos|conto|saco|salieron|dio)(?: [a-z]+){0,2}? ${NUM}\\b`, 'g'), new RegExp(`${NUM} (?:por|en un|al) minuto`, 'g')] : []),
  ];
  for (const re of respRes) {
    for (const m of s.matchAll(re)) {
      const pre = s.slice(Math.max(0, m.index! - 25), m.index!);
      if (/(latido|pulso|corazon)\s*\S*\s*$/.test(pre)) continue;
      const v = parseFloat(m[1]);
      if (v >= 5 && v <= 150) {
        if (o.resp_por_min === undefined) o.resp_por_min = Math.round(v);
        s = blank(s, m.index!, m[0].length);
      }
    }
  }

  // Embarazo: semanas / meses
  const pregRes = [
    new RegExp(`${NUM} (semanas?|meses?) (?:de embarazo|de gestacion|de embarazada|embarazada|de encinta)`, 'g'),
    new RegExp(`(?:embarazada|embarazo|encinta|esperando(?: bebe| un bebe)?|gestacion) (?:de |con |va en )?${NUM} (semanas?|meses?)`, 'g'),
  ];
  for (const re of pregRes) {
    for (const m of s.matchAll(re)) {
      const n = parseFloat(m[1]);
      const unit = m[2];
      const weeks = /^semana/.test(unit) ? n : Math.ceil(n * 4.345);
      if (weeks >= 1 && weeks <= 45 && o.semanas_embarazo === undefined) { o.semanas_embarazo = Math.round(weeks); o.embarazo_por_numero = true; }
      s = blank(s, m.index!, m[0].length);
    }
  }
  if (o.semanas_embarazo === undefined && /embaraz|encinta|esperando bebe|gestacion|fuente|contraccion|dolores de parto|parto|se mueve el bebe|el bebe no se mueve/.test(s)) {
    const wk = new RegExp(`(?:tiene|va en|va para|lleva|ya tiene|cumple|cumplio) (?:las |sus )?${NUM} semanas\\b(?! (?:con|de nacid))`).exec(s);
    if (wk && parseFloat(wk[1]) >= 6 && parseFloat(wk[1]) <= 45) {
      o.semanas_embarazo = Math.round(parseFloat(wk[1]));
      o.embarazo_por_numero = true;
      s = blank(s, wk.index, wk[0].length);
    }
  }
  const ord = s.match(/\b(primer|primero|segundo|tercer|tercero|cuarto|quinto|sexto|septimo|setimo|octavo|noveno) mes(?: de embarazo| de gestacion)?\b/);
  // "va en su octavo mes" / "ya está en su séptimo mes": el mes ordinal con "su" solo se usa para el embarazo
  // (a un bebé se le dice "de 8 meses").
  const ordPreg = ord && new RegExp(`\\b(?:va en|esta en|anda en|ya va en|ya esta en|cumple|cumplio|entro a|entro en) (?:su|el) ${ord[1]} mes\\b`).test(s);
  if (ord && o.semanas_embarazo === undefined && (ordPreg || /embaraz|encinta|esperando|gestacion/.test(s))) {
    o.semanas_embarazo = Math.ceil(ORDINAL_MONTH[ord[1]] * 4.345);
    o.embarazo_por_numero = true;
    s = blank(s, ord.index!, ord[0].length);
  }

  // Días desde el parto: "tiene 2 semanas de haberse aliviado / de haber dado a luz / de que se alivió"
  const pp = new RegExp(`${NUM} (dias?|diitas?|semanas?|semanitas?|mes(?:es)?) de (?:haberse aliviado|haber dado a luz|haber parido|que se alivio|que dio a luz|que tuvo (?:a )?(?:su |el |la )?(?:bebe|nino|nina)|parida|aliviada)`).exec(s);
  if (pp) {
    const d = unitToDays(parseFloat(pp[1]), pp[2]);
    if (d !== undefined) o.posparto_dias = d;
    s = blank(s, pp.index, pp[0].length);
  }

  // Edad en días/semanas de nacido (antes de la duración: "tiene 10 dias de nacido")
  let m2: RegExpExecArray | null = null;
  const newborn = new RegExp(`${NUM} (dias?|diitas?|semanas?|semanitas?|mes(?:es)?) de (?:nacid[oa]|vida|edad|naciod[oa])`).exec(s);
  if (newborn) {
    const n = parseFloat(newborn[1]);
    const d = unitToDays(n, newborn[2]);
    if (d !== undefined) o.edad_meses = round1(/^mes/.test(newborn[2]) ? n : d / DAYS_PER_MONTH);
    s = blank(s, newborn.index, newborn[0].length);
  } else if ((m2 = new RegExp(`\\b(?:bebe|bebito|bebita|nene|nena|criatura|nino|nina|ninito|ninita|recien nacid[oa]) (?:de|tiene|ya tiene|tiene ya|cumplio) ${NUM} (dias?|diitas?|semanas?|semanitas?)\\b`).exec(s)) && (/ de \\d/.test(m2[0]) || !/embaraz|encinta|gestacion/.test(s))) {
    // "el bebé tiene 3 semanas" es edad salvo en contexto de embarazo (eval D10)
    const d = unitToDays(parseFloat(m2[1]), m2[2]);
    if (d !== undefined) o.edad_meses = round1(d / DAYS_PER_MONTH);
    s = blank(s, m2.index, m2[0].length);
  } else if (/\b(recien nacid[oa]|acaba de nacer|nacio hoy|recien nacidito|recien nacidita)\b/.test(s)) {
    o.edad_meses = 0;
  } else if (/\bnacio ayer\b/.test(s)) {
    o.edad_meses = round1(1 / DAYS_PER_MONTH);
  }

  // Duración
  const durations: number[] = [];
  const durRes = [
    new RegExp(`(?:desde hace|hace|lleva|llevan|llevamos|ya van|ya va|ya tiene|tiene|con|desde|por|durante) (?:ya )?(?:como |unos |unas |mas de )?${NUM} (horas?|horitas?|dias?|diitas?|semanas?|semanitas?|mes(?:es)?|anos?)`, 'g'),
    new RegExp(`${NUM} (horas?|dias?|semanas?) (?:con|de|que|asi|enferm)`, 'g'),
  ];
  for (const re of durRes) {
    for (const m of s.matchAll(re)) {
      const after = s.slice(m.index! + m[0].length, m.index! + m[0].length + 14);
      if (/^\s*de (?:nacid|edad|vida)/.test(after)) continue;
      const verb = m[0].split(' ')[0];
      const unit = m[2];
      // "tiene/con 8 meses" o "tiene 2 años" es edad, no duración
      if ((verb === 'tiene' || verb === 'con' || verb === 'ya') && /^(mes|an)/.test(unit)) continue;
      // "tiene 36 semanas" sin "con/de <síntoma>" suele ser edad gestacional o edad del bebé, no duración
      if ((verb === 'tiene' || verb === 'ya') && /^semana/.test(unit) && !/^\s*(con|de|que|asi|enferm)/.test(after)) continue;
      if (BIRTH_CTX.test(s.slice(0, m.index!))) {
        const bd = unitToDays(parseFloat(m[1]), unit);
        if (bd !== undefined) o.posparto_dias = bd;
        s = blank(s, m.index!, m[0].length);
        continue;
      }
      const d = unitToDays(parseFloat(m[1]), unit);
      if (d !== undefined && d >= 0 && d <= 3650) durations.push(d);
      s = blank(s, m.index!, m[0].length);
    }
  }
  if (/\bdesde (?:antier|anteayer|antes de ayer)\b/.test(s)) durations.push(2);
  else if (/\bdesde ayer\b|\bdesde el dia de ayer\b/.test(s)) durations.push(1);
  else if (/\bdesde anoche\b|\bdesde la noche\b/.test(s)) durations.push(0.5);
  else if (/\bdesde (?:hoy|esta manana|la manana|en la manana|temprano|hace rato|hace un rato)\b/.test(s)) durations.push(0.2);
  if (durations.length) o.duracion_dias = Math.round(Math.max(...durations) * 100) / 100;

  // Edad (si no salió de "días de nacido")
  if (o.edad_meses === undefined) {
    const ym = new RegExp(`${NUM} (?:anos?|anitos?) (?:y|con) ${NUM} (?:mes(?:es)?|mesecitos?)`).exec(s);
    const y = new RegExp(`${NUM} (?:anos?|anitos?)\\b`).exec(s);
    const mo = new RegExp(`${NUM} (?:mes(?:es)?|mesecitos?)\\b`).exec(s);
    const person = new RegExp(`\\b${PERSON}(?: [a-z]+){0,2}? de ${NUM}(?![\\d.])(?! (?:anos?|anitos?|mes(?:es)?|mesecitos?|semanas?|dias?|horas?|grados)\\b)`).exec(s);
    const cands: { idx: number; months: number }[] = [];
    if (ym) cands.push({ idx: ym.index, months: parseFloat(ym[1]) * 12 + parseFloat(ym[2]) });
    if (y && !(ym && ym.index === y.index)) cands.push({ idx: y.index, months: parseFloat(y[1]) * 12 });
    if (mo && !(ym && mo.index > ym.index && mo.index < ym.index + ym[0].length)) cands.push({ idx: mo.index, months: parseFloat(mo[1]) });
    if (person) {
      const n = parseFloat(person[1]);
      const babyish = /^(bebe|bebito|bebita|nene|nena|criatura)/.test(person[0].trim());
      cands.push({ idx: person.index, months: babyish && n <= 24 ? n : n * 12 });
    }
    cands.sort((a, b) => a.idx - b.idx);
    const first = cands.find((c) => c.months >= 0 && c.months <= 120 * 12);
    if (first) o.edad_meses = round1(first.months);
  }
  return o;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sexo y embarazo
// ─────────────────────────────────────────────────────────────────────────────
// Ronda 3: parentescos ("mi esposo", "su suegra") y "varón/caballero". "joven", "adolescente" y "paciente" solo
// tienen sexo con artículo femenino o masculino explícito ("la joven", "el joven"); "el paciente" es genérico en
// español y NO se toma como hombre (si fuera mujer, se perdería la pregunta de embarazo).
const FEMALE = /^(nina|ninita|senora|senorita|mujer|muchacha|muchachita|chamaca|chamaquita|abuela|abuelita|dona|nena|bebita|hija|chava|morra|viejita|anciana|chiquita|embarazada|ella|mama|madre|seno|esposa|hermana|tia|suegra|cunada|sobrina|nieta|comadre|prima|femenino)$/;
const MALE = /^(nino|ninito|senor|hombre|muchacho|muchachito|chamaco|chamaquito|abuelo|abuelito|don|nene|bebito|hijo|chavo|morro|viejito|anciano|chiquito|el|papa|padre|esposo|marido|hermano|tio|suegro|cunado|sobrino|nieto|compadre|primo|varon|caballero|masculino)$/;

const CHILD_F = /^(nina|ninita|bebita|nena|hija|chamaca|chamaquita|chiquita|muchachita)$/;
const CHILD_M = /^(nino|ninito|bebito|nene|hijo|chamaco|chamaquito|chiquito|muchachito)$/;
/** Sustantivos sin sexo propio: lo da el artículo ("la joven" / "el joven"). "paciente" solo con "la". */
const BY_ARTICLE = /^(bebe|criatura|joven|adolescente|paciente)$/;
/** Demasiado ambiguos para decidir el sexo del paciente (puede ser quien lo trae). */
const AMBIGUOUS = new Set(['el', 'ella', 'mama', 'madre', 'papa', 'padre', 'seno']);
const sexOf = (w: string): 'F' | 'M' | undefined => (FEMALE.test(w) ? 'F' : MALE.test(w) ? 'M' : undefined);
const isAgeAfter = (toks: string[], i: number) => toks[i + 1] === 'de' && /^\d/.test(toks[i + 2] ?? '');

function detectSex(toks: string[]): 'F' | 'M' | undefined {
  // Si se habla de un niño/a, la paciente es la criatura (no "la señora" que la trae)
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i];
    if (BY_ARTICLE.test(w) && (toks[i - 1] === 'la' || toks[i - 1] === 'una')) return 'F';
    if (BY_ARTICLE.test(w) && w !== 'paciente' && w !== 'criatura' && (toks[i - 1] === 'el' || toks[i - 1] === 'un')) return 'M';
    if (CHILD_F.test(w)) return 'F';
    if (CHILD_M.test(w)) return 'M';
  }
  // La persona de la que se da la edad ("su esposa de 30 años", "señor de 40") o a la que "traen" es el paciente.
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i];
    if (AMBIGUOUS.has(w)) continue;
    const sx = sexOf(w);
    if (!sx) continue;
    if (isAgeAfter(toks, i)) return sx;
    if (['trae', 'traen', 'traigo', 'trajo', 'trajeron', 'lleva', 'llevan', 'llevo'].includes(toks[i - 3] ?? '') && toks[i - 2] === 'a') return sx;
    if (['trae', 'traen', 'traigo', 'trajo', 'trajeron', 'lleva', 'llevan', 'llevo'].includes(toks[i - 2] ?? '') && toks[i - 1] === 'a') return sx;
  }
  for (const w of toks) {
    if (AMBIGUOUS.has(w)) continue; // demasiado ambiguos
    const sx = sexOf(w);
    if (sx) return sx;
  }
  return undefined;
}

/**
 * Error típico de Whisper (reporte de uso real, 4-oct-2026): "Hombre de 21 años" → "Nombre de 21 años". Solo se
 * corrige cuando sigue "de <número> años" (así "su nombre es…" no cambia).
 */
const NOMBRE_HOMBRE = /\bnombre(?=\s+de\s+[0-9a-záéíóúñ]+(?:\s+y\s+[a-záéíóúñ]+)?\s+a(?:ñ|n)(?:it)?os?\b)/giu;
export function asrFixSex(text: string): string {
  return text.replace(NOMBRE_HOMBRE, (m) => (m[0] === 'N' ? 'Hombre' : 'hombre'));
}

const PREG_PHRASES: string[][] = [
  ['embarazada'], ['embarazo'], ['encinta'], ['en', 'cinta'], ['gestante'], ['en', 'estado'],
  ['esta', 'esperando', 'bebe'], ['esta', 'esperando', 'un', 'bebe'], ['esta', 'esperando', 'familia'],
  ['esperando', 'bebe'], ['va', 'a', 'tener', 'un', 'bebe'], ['va', 'a', 'tener', 'bebe'], ['esta', 'panzona'],
];

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

interface Hit { key: SymptomKeyStrict; start: number; end: number; pol: Polarity }

function findSymptomHits(toks: string[]): Hit[] {
  const hits: Hit[] = [];
  // Mapa compacto (sin espacios) para tolerar "su dor frio", "se leunde"
  let compact = '';
  const charTok: number[] = [];
  toks.forEach((t, i) => {
    if (t === '|') return;
    for (let k = 0; k < t.length; k++) charTok.push(i);
    compact += t;
  });

  for (const e of SYN_INDEX) {
    const n = e.toks.length;
    let found = false;
    for (let i = 0; i + n <= toks.length; i++) {
      let ok = true;
      for (let k = 0; k < n; k++) if (toks[i + k] !== e.toks[k]) { ok = false; break; }
      if (ok) { hits.push({ key: e.key, start: i, end: i + n, pol: polarityFor(e.key, toks, i, i + n) }); found = true; }
    }
    // Coincidencia con huecos: 1–2 palabras de relleno dentro de la frase ("le duele TODO el cuerpo",
    // "se le hinchan MUCHO las manos", "no QUIERE agarrar el pecho").
    if (!found && n >= 2) {
      for (let i = 0; i < toks.length; i++) {
        if (toks[i] !== e.toks[0]) continue;
        const end = gappedMatchEnd(toks, i, e.toks);
        if (end > 0) { hits.push({ key: e.key, start: i, end, pol: polarityFor(e.key, toks, i, end) }); found = true; }
      }
    }
    if (!found && e.compact.length >= 9) {
      let from = 0;
      for (;;) {
        const at = compact.indexOf(e.compact, from);
        if (at < 0) break;
        const st = charTok[at];
        const en = charTok[at + e.compact.length - 1] + 1;
        // debe empezar y terminar en frontera de palabra del texto compacto
        const startsAtWord = at === 0 || charTok[at - 1] !== st;
        const endsAtWord = at + e.compact.length >= charTok.length || charTok[at + e.compact.length] !== en - 1;
        if (startsAtWord && endsAtWord) hits.push({ key: e.key, start: st, end: en, pol: polarityFor(e.key, toks, st, en) });
        from = at + 1;
      }
    }
  }
  hits.push(...frameHits(toks));
  // Anular coincidencias contenidas en frases de claves que las contradicen
  return hits.filter((h) => {
    const killers = SUPPRESSED_INSIDE[h.key];
    if (!killers?.length) return true;
    return !hits.some((o) => o !== h && killers.includes(o.key) && o.start <= h.start && o.end >= h.end && o.end - o.start > h.end - h.start);
  });
}

/**
 * Extrae hallazgos de texto libre. Puro y síncrono.
 * sintomas[k] = true (afirmado) | false (negado explícitamente); ausente = no se sabe.
 */
export function keywordExtract(text: string): Findings {
  const f: Findings = { sintomas: {} };
  if (!text || !text.trim()) return f;
  text = asrFixSex(text);
  const normToks = toTokens(text);
  const toks = symptomTokens(text);

  // Síntomas
  const hits = findSymptomHits(toks);
  const pos = new Set<SymptomKeyStrict>();
  const neg = new Set<SymptomKeyStrict>();
  for (const h of hits) {
    if (h.pol === 'pos') pos.add(h.key);
    else if (h.pol === 'neg') neg.add(h.key);
    // "ya no tiene calentura" / "la calentura ya se le quitó": fiebre en los últimos días (cuenta para dengue)
    else if (h.pol === 'resolved' && h.key === 'fiebre') pos.add('fiebre_reciente');
  }
  for (const k of [...pos]) for (const p of IMPLIES[k] ?? []) pos.add(p);
  for (const k of neg) if (!pos.has(k)) f.sintomas[k] = false;
  for (const k of pos) f.sintomas[k] = true;

  // Números
  const nums = parseNumbers(text);
  if (nums.edad_meses !== undefined) f.edad_meses = nums.edad_meses;
  if (nums.temperatura_c !== undefined) f.temperatura_c = nums.temperatura_c;
  if (nums.resp_por_min !== undefined) f.resp_por_min = nums.resp_por_min;
  if (nums.duracion_dias !== undefined) f.duracion_dias = nums.duracion_dias;
  if (nums.semanas_embarazo !== undefined) f.semanas_embarazo = nums.semanas_embarazo;

  // Embarazo
  const ptoks = normToks; // sin fonética para frases fijas
  let preg: Polarity | null = null;
  for (const ph of PREG_PHRASES) {
    for (let i = 0; i + ph.length <= ptoks.length; i++) {
      if (ph.every((w, k) => ptoks[i + k] === w)) {
        const p = polarityAt(ptoks, i, i + ph.length);
        if (p === 'pos') preg = 'pos';
        else if (p === 'neg' && preg !== 'pos') preg = 'neg';
      }
    }
  }
  // Signos que solo existen en el embarazo implican embarazo (salvo negación explícita)
  const impliesPreg = f.sintomas.salida_liquido_vaginal === true || f.sintomas.contracciones === true || f.sintomas.movimientos_fetales_disminuidos === true;
  if (preg === 'pos' || nums.embarazo_por_numero || (impliesPreg && preg !== 'neg')) f.embarazada = true;
  else if (preg === 'neg') f.embarazada = false;

  // Sexo
  const sex = f.embarazada === true || f.sintomas.posparto === true ? 'F' : detectSex(wordsToDigits(normToks));
  if (sex) f.sexo = sex;

  // "tiene 10 días de haberse aliviado" = posparto aunque no se diga "dio a luz"
  if (nums.posparto_dias !== undefined && nums.posparto_dias <= 42 && f.sintomas.posparto === undefined && f.embarazada !== true) f.sintomas.posparto = true;
  // "dio a luz hace 3 meses" ya no es puerperio (> 6 semanas)
  if (f.sintomas.posparto === true && nums.posparto_dias !== undefined && nums.posparto_dias > 42) delete f.sintomas.posparto;

  // "dolor de muela y la cara hinchada": la hinchazón es por la muela (IITT "swelling of mouth, throat or neck"),
  // no la hinchazón de cara del embarazo.
  if (f.sintomas.dolor_muela === true && f.sintomas.hinchazon_cara_manos === true) {
    delete f.sintomas.hinchazon_cara_manos;
    f.sintomas.hinchazon_boca_cuello = true;
  }

  // Embarazada adulta: "no se mueve el bebé" es movimiento fetal, no signo del recién nacido
  if (f.embarazada === true && f.sintomas.no_se_mueve === true && /\bbebe\b/.test(normToks.join(' '))) {
    delete f.sintomas.no_se_mueve;
    f.sintomas.movimientos_fetales_disminuidos = true;
  }
  return f;
}

/** Útil para la UI/eval: qué frases dispararon qué clave. */
export function explainKeywords(text: string): { key: SymptomKeyStrict; phrase: string; polarity: Polarity }[] {
  const toks = symptomTokens(text);
  return findSymptomHits(toks).map((h) => ({ key: h.key, phrase: toks.slice(h.start, h.end).join(' '), polarity: h.pol }));
}

const STOP = new Set(['tiene', 'tener', 'esta', 'estar', 'para', 'como', 'muy', 'mucho', 'mucha', 'poco', 'desde', 'hace', 'sobre', 'entre', 'cuando', 'donde', 'pero', 'porque', 'paciente', 'senora', 'senor', 'nino', 'nina', 'bebe', 'los', 'las', 'del', 'con', 'sin', 'por', 'que', 'una', 'uno', 'unos', 'unas', 'mas', 'muy', 'bien', 'esta', 'este', 'ese', 'esa', 'sus', 'ella', 'severo', 'severa', 'fuerte', 'leve', 'dificultad', 'problema', 'problemas', 'falta'].map(phonetic));

/** "ojitos" -> "ojos", "pechito" -> "pecho", "calenturita" -> "calentura" */
const undim = (w: string) => w.replace(/(?:s)?it(o|a|os|as)$/, '$1');
/** Mismo arranque: los primeros min(5, |a|, |b|) caracteres (mín. 3) sin diminutivo. */
function sameRoot(a: string, b: string): boolean {
  const x = undim(a), y = undim(b);
  const n = Math.min(5, x.length, y.length);
  return n >= 3 && x.slice(0, n) === y.slice(0, n);
}

/**
 * ¿Una frase producida por el LLM está anclada en el texto original? Al menos 2/3 de sus
 * palabras de contenido (>= 3 letras) deben aparecer en el texto, comparando el arranque (hasta 5 letras)
 * en forma fonética y sin diminutivos ("sangrado" ~ "sangrando", "ojos" ~ "ojitos").
 * Filtra síntomas copiados de los ejemplos del prompt o inventados ("dolor en el pecho" cuando
 * el relato dice "se le hunde el pecho").
 */
export function groundedIn(phrase: string, text: string): boolean {
  const src = phonTokens(text).filter((w) => w.length >= 3);
  const words = phonTokens(phrase).filter((w) => w.length >= 3 && w !== '|' && !STOP.has(w));
  if (!words.length) return false;
  const hit = words.filter((w) => src.some((t) => sameRoot(w, t))).length;
  return hit >= 1 && hit / words.length >= 2 / 3;
}
