/**
 * Cuidados según la molestia ("mensajes según el contexto"). Ronda 3, 4-oct-2026.
 *
 * Qué es: datos, no reglas. NO cambian el nivel. Cuando el resultado es "Atender aquí", la pantalla de resultado
 * muestra, además de la acción de la regla por defecto, los cuidados en casa de la molestia que se detectó
 * (estreñimiento, gases, agruras, gripa…) y cuándo ir a la unidad. Con "Centro de salud hoy" muestra solo lo que
 * sirve "mientras llega al centro de salud" (primeros auxilios sin medicinas), si la molestia lo tiene.
 * Con "Urgencia" no se muestra nada aquí: manda la acción de la regla (911 / traslado).
 *
 * Selección determinista: se recorre ADVICE en orden y se toman hasta MAX_ADVICE entradas cuyas claves estén en
 * `true` y cuya edad, sexo y embarazo coincidan. Una entrada con edad mínima o máxima exige la edad CONOCIDA
 * (si no se sabe, no se muestra: el texto genérico de la regla por defecto ya pide anotar la edad).
 *
 * Reglas de contenido (probadas en advice.test.ts):
 *  - Sin medicinas ni dosis (ni paracetamol, ni antibióticos, ni laxantes): las fuentes que las mencionan se
 *    citaron sin esa parte.
 *  - De usted, español sencillo, una idea por renglón.
 *  - Ningún texto para hombre habla de embarazo, regla, lactancia o pecho materno.
 *  - Cada entrada cita las páginas que se consultaron (docs/research-common-complaints.md tiene las citas largas).
 *  - "Vaya a la unidad si" lista los signos de la fuente citada; los que en Pahtli ya son `urgencia` dicen "(es URGENCIA)"
 *    y casi todos los demás son `centro_hoy` por una regla (la regla citada en `fuente`).
 * PROVISIONAL: pendiente de revisión de la Dra. Ines.
 */
import type { Findings, TriageLevel } from '../types';
import { hasFever, isNum, pregnancyPossible, years } from './rules/helpers';
import { CITE, SRC } from './rules/sources';

export interface AdviceEntry {
  id: string;
  /** Título corto que se muestra ("Estreñimiento"). */
  titulo: string;
  /** Basta con que una de estas claves esté en true. */
  sintomas: string[];
  /** Edad mínima / máxima en meses (rango [min, max)). Si se pone, la edad debe ser conocida. */
  edadMin?: number;
  edadMax?: number;
  /** Solo para este sexo (conocido). */
  sexo?: 'F' | 'M';
  /**
   * No se muestra en embarazo ni en la cuarentena (tienen sus propias reglas y cuidados), NI cuando el embarazo es
   * posible y no se ha descartado (mujer o sexo desconocido de 10 a 49 años sin un "No" a "¿Está embarazada?").
   * Ronda 4 (revisión ADV-PRESION / ADV-ESPALDA): "siga moviéndose" o "la presión alta sin molestias no es urgencia"
   * son lo contrario de lo que dice la NOM-007 para una embarazada.
   */
  noEmbarazo?: boolean;
  /** Solo en el embarazo (embarazada === true), con cualquier molestia: `sintomas` se ignora. */
  soloEmbarazo?: boolean;
  /** No se muestra si tiene calentura (p. ej. ronchas con calentura no son un piquete: revisión ADV-RONCHAS). */
  noFiebre?: boolean;
  /** Cuidados en casa (nivel "aqui"). */
  cuidados: string[];
  /** Ir de inmediato / hoy a la unidad si… (nivel "aqui"). */
  regrese: string[];
  /** Ir a consulta, sin urgencia, si… (decisión provisional C1: no hay un 4.º nivel). */
  consulta?: string[];
  /** Lo que se puede hacer mientras se llega al centro de salud (nivel "centro_hoy"). Sin esto, no se muestra ahí. */
  mientras?: string[];
  fuente: string;
  fuente_url: string;
}

export const MAX_ADVICE = 3;
const Y = years;

export const ADVICE: AdviceEntry[] = [
  // ── Embarazo (ronda 4): va primero; las demás molestias del embarazo no reciben cuidados generales ─────────────
  {
    id: 'ADV-EMBARAZO',
    titulo: 'Embarazo: señales de alarma',
    sintomas: [],
    soloEmbarazo: true,
    cuidados: [
      'Acuda a todas sus consultas de control del embarazo (por lo menos 5) y lleve siempre su carnet perinatal.',
      'Tenga listo cómo llegar al hospital si aparece una señal de alarma: quién la lleva y en qué.',
    ],
    regrese: [
      'tiene dolor de cabeza fuerte, le zumban los oídos, ve borroso o lucecitas, o le duele la boca del estómago (es URGENCIA)',
      'le sale líquido o sangre por la vagina, tiene contracciones antes de las 37 semanas, o dolor de panza que no se quita (es URGENCIA)',
      'tiene calentura, se pone muy pálida, le falta el aire o convulsiona (es URGENCIA)',
      'después de las 28 semanas el bebé se mueve menos o no se mueve en más de 2 horas (es URGENCIA)',
      'tiene la presión alta (es URGENCIA)',
      'se le hinchan los pies, las manos o la cara, vomita seguido, o le arde al orinar u orina muy seguido',
    ],
    mientras: ['Llévela acompañada y con su carnet perinatal.'],
    fuente: `${CITE.IMSS_GPC_PRENATAL}, p. 9 del PDF (signos de alarma: "debe acudir inmediatamente a un hospital o centro de salud": "Fuerte dolor de cabeza", "Zumbido en el oído", "Visión borrosa con puntos de lucecitas", "Náuseas y vómitos frecuentes", movimientos fetales "por más de 2 horas" después de la semana 28, "Palidez marcada", "Hinchazón de pies, manos o cara", "Pérdida de líquido o sangre por la vagina", "Fiebre", "Contracciones uterinas… antes de las 37 semanas", "Dolor abdominal persistente", "Dificultad para respirar", "molestia al orinar", "Convulsiones"; "Preparación al parto y los preparativos en caso de posibles complicaciones"); ${CITE.NOM_007}, num. 5.2.1.15 ("como mínimo cinco consultas prenatales"), 5.3.1.3 ("hipertensión arterial", "epigastralgia") y 5.3.1.14 (carnet perinatal)`,
    fuente_url: SRC.IMSS_GPC_PRENATAL,
  },
  // ── Primeros auxilios (sirven también camino al centro de salud) ─────────────────────────────────
  {
    id: 'ADV-ALACRAN',
    titulo: 'Piquete de alacrán',
    sintomas: ['picadura_alacran'],
    cuidados: [],
    regrese: [],
    mientras: [
      'Mantenga a la persona tranquila y quieta.',
      'Lave el piquete con agua y jabón y ponga algo frío envuelto en un trapo.',
      'No corte, no chupe, no ponga torniquete ni remedios caseros.',
      'Los síntomas pueden empezar hasta 2 horas después. Si en el camino babea, siente algo atorado en la garganta, le falta el aire, vomita o los ojos se le mueven solos: es URGENCIA.',
    ],
    fuente: `${CITE.SSA_IAVYS_2026}, p. 9–10; ${CITE.DGE_ALACRAN_2012}, p. 38 del PDF ("desde los primeros minutos hasta las dos horas"); ${CITE.CENAPRECE_LOXO}, incisos a, c, g (escritos para araña; aplicados a alacrán de forma provisional, decisión D9); ${CITE.NHS} Insect bites and stings (lavar, frío 20 minutos)`,
    fuente_url: SRC.SSA_IAVYS_2026,
  },
  {
    id: 'ADV-ARANA',
    titulo: 'Mordedura de araña',
    sintomas: ['mordedura_arana', 'arana_peligrosa'],
    cuidados: [],
    regrese: [],
    mientras: [
      'Conserve la calma. Lave con agua y jabón.',
      'Ponga hielo envuelto en un trapo. Si es en un brazo o pierna, súbalo arriba del corazón y que no se mueva de más.',
      'No corte ni pique la piel, no ponga torniquete, no use remedios caseros ni desinfectantes de color.',
      'Si se puede, atrape la araña en un frasco (con pinzas, sin tocarla) y llévela.',
    ],
    fuente: `${CITE.CENAPRECE_LOXO}, "Acciones en caso de ser picado", incisos a–j`,
    fuente_url: SRC.CENAPRECE_LOXO,
  },
  {
    id: 'ADV-MORDEDURA',
    titulo: 'Mordedura o rasguño de animal',
    sintomas: ['mordedura_animal'],
    cuidados: [],
    regrese: [],
    mientras: [
      'Lave la herida con agua y jabón, a chorro, durante 10 minutos, frotando con cuidado.',
      'Si la saliva cayó en los ojos, la nariz o la boca, enjuague con mucha agua limpia por 5 minutos.',
      'Tape con un trapo limpio.',
      'Si el animal tiene dueño, pida que lo encierren y lo vigilen 10 días. No lo maten: en la unidad necesitan saber si sigue sano. Pregunte si está vacunado contra la rabia.',
      'Diga en la unidad si la mordida fue en la cabeza, la cara, el cuello, las manos o los brazos, si fueron varias o profundas, o si fue de murciélago o de un animal del monte: es de riesgo grave.',
    ],
    fuente: `${CITE.SSA_RABIA_GUIA}, p. 17 impresa / 18 del PDF ("jabón, agua a chorro durante 10 minutos"; mucosas "durante 5 minutos"), p. 23 del PDF (riesgo grave: "mordedura en cabeza, cara, cuello ó en miembros superiores", "mordeduras profundas o múltiples") y p. 33 del PDF (murciélago, zorrillo, coyote, puma y mapache)`,
    fuente_url: SRC.SSA_RABIA_GUIA,
  },
  {
    id: 'ADV-QUEMADURA',
    titulo: 'Quemadura',
    sintomas: ['quemadura', 'quemadura_grave', 'quemadura_quimica_electrica'],
    cuidados: [],
    regrese: [],
    mientras: [
      'Ponga la quemadura bajo el chorro de agua fresca de la llave por 20 minutos, lo antes posible. No use hielo.',
      'Quite la ropa, anillos o pulseras de cerca de la quemadura, pero no lo que esté pegado a la piel.',
      'No ponga pomadas, aceite, mantequilla, pasta de dientes ni remedios. No reviente las ampollas.',
      'Tape con un trapo limpio (o plástico de cocina limpio, sin darle la vuelta completa). Si la quemadura es grande, no la enfríe mucho tiempo: abrigue a la persona.',
    ],
    fuente: `${CITE.NHS} Burns and scalds (revisada 31-03-2026): "cool running water for 20 minutes", "Remove any clothing or jewellery", "lay cling film over it"; ${CITE.WHO_BURNS_FS}: no hielo, no aplicar nada sobre la herida, evitar el enfriamiento prolongado, envolver en un trapo limpio`,
    fuente_url: SRC.NHS_BURNS,
  },
  {
    id: 'ADV-HERIDA',
    titulo: 'Herida o cortada',
    sintomas: ['herida', 'herida_sucia', 'herida_infectada', 'herida_profunda', 'objeto_clavado'],
    cuidados: [
      'Apriete con un trapo limpio hasta que pare de sangrar. Si es en un brazo o pierna, súbalo más arriba del corazón. Si el trapo se moja, ponga otro encima sin quitar el primero.',
      'Lave la herida con agua limpia de la llave o de garrafón. Seque con golpecitos y tápela con una gasa o curita limpia.',
      'Mantenga la herida limpia y seca. Cambie la gasa cuando se moje o se ensucie.',
    ],
    regrese: [
      'no para de sangrar o sale a chorros',
      'tiene algo clavado (no lo saque), o la herida es muy grande o profunda',
      'no siente o no puede mover la parte de abajo de la herida',
      'la herida quedó sucia con tierra, mide más de 5 cm (como 3 dedos), o se pone roja, caliente, hinchada o con pus, o le da calentura',
    ],
    mientras: [
      'Apriete con un trapo limpio para parar la sangre y suba el brazo o la pierna. No saque lo que esté clavado.',
      'Lleve la cartilla de vacunación (puede necesitar vacuna contra el tétanos).',
    ],
    fuente: `${CITE.NHS} Cuts and grazes (revisada 02-04-2026): pasos para parar el sangrado y limpiar y tapar; "Call 999 or go to A&E" y "urgent GP appointment or NHS 111" (reglas GEN-BLEED-01, NHS-WOUND-01, NHS-WOUND-02)`,
    fuente_url: SRC.NHS_CUTS,
  },
  {
    id: 'ADV-AZUCAR',
    titulo: 'Posible azúcar baja (diabetes)',
    sintomas: ['azucar_baja', 'sintomas_hipoglucemia'],
    cuidados: [],
    regrese: [],
    mientras: [
      'Si está despierta y puede tragar: déle ya algo dulce de tomar (un vaso chico de jugo de fruta o refresco normal, no de dieta).',
      'Cuando se sienta mejor, que coma algo (pan o tortilla).',
      'Si en 10 a 15 minutos no mejora, déle otra vez algo dulce y llévela de urgencia.',
      'Si no despierta o convulsiona: no le dé nada por la boca, acuéstela de lado y llame al 911.',
    ],
    fuente: `${CITE.NOM_015}, 11.11.8.4 ("carbohidratos líquidos… seguidos de carbohidratos de absorción más lenta") y 11.11.8.5 ("cabeza volteada hacia un lado"); ${CITE.NHS} Low blood sugar (revisada 03-08-2023): "a small glass of fruit juice or sugary fizzy drink", "after 10 to 15 minutes", "Do not give them any food or drink" si está inconsciente`,
    fuente_url: SRC.NOM_015,
  },
  // ── Golpes ────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'ADV-GOLPE-CABEZA',
    titulo: 'Golpe en la cabeza',
    sintomas: ['golpe_cabeza'],
    edadMin: 12,
    cuidados: [
      'Ponga hielo envuelto en un trapo sobre el chichón, por ratos cortos, varias veces al día.',
      'Que descanse. Un adulto debe quedarse con la persona por lo menos las primeras 24 horas. Si tiene sueño puede dormir.',
      'Que no tome alcohol ni maneje hasta sentirse bien.',
    ],
    regrese: [
      'no se mantiene despierto, convulsiona, se confunde o habla raro',
      'le duele la cabeza, vomita o anda mareado',
      've o escucha mal, o le sale líquido o sangre del oído o líquido claro por la nariz',
      'toma medicina para adelgazar la sangre',
      'se cayó de más de un metro o de 5 escalones, o el golpe fue a mucha velocidad (choque) (es URGENCIA)',
      'tiene un hundimiento o algo clavado en la cabeza, o un ojo morado sin haberse pegado en el ojo (es URGENCIA)',
      'cambió su comportamiento: más irritable, distraído o sin interés en nada (es URGENCIA)',
      'había tomado alcohol o drogas cuando se golpeó',
    ],
    fuente: `${CITE.NHS} Head injury and concussion (revisada 29-05-2025): "hold an ice pack… wrapped in a tea towel", "make sure an adult stays with you… for at least the first 24 hours", "do not drink alcohol"; señales de "Call 999" ("fallen from a height of more than 1 metre or 5 stairs", "hit their head at high speed", "a dent in their head", "a black eye, but did not hit their eye", "their behaviour has changed") y "NHS 111" ("were drinking alcohol or taking drugs") (reglas NHS-HEAD-01 y NHS-HEAD-02)`,
    fuente_url: SRC.NHS_HEAD_INJURY,
  },
  // ── Digestivo ─────────────────────────────────────────────────────────────────────────────────
  {
    id: 'ADV-ESTRENIMIENTO',
    titulo: 'Estreñimiento',
    sintomas: ['estrenimiento'],
    edadMin: Y(12),
    cuidados: [
      'Tome bastante agua y otros líquidos. Evite el alcohol.',
      'Coma más fibra, poco a poco: frutas (manzana, uvas, fresas, chabacano), verduras, avena o salvado.',
      'Vaya al baño a la misma hora todos los días, sin prisa. No se aguante cuando sienta ganas.',
      'En el baño, ponga los pies sobre un banquito para que las rodillas queden más arriba que la cadera.',
      'Camine o muévase todos los días.',
    ],
    regrese: [
      'no puede hacer del baño ni echar gases',
      'el dolor de panza es muy fuerte, o la panza se le hincha y vomita',
      've sangre en la popó o la popó sale negra',
    ],
    consulta: [
      'se estriñe seguido o no mejora con estos cuidados',
      'baja de peso sin querer o anda cansado todo el tiempo',
      'cambió de pronto su forma de hacer del baño, sobre todo si tiene más de 50 años',
    ],
    fuente: `${CITE.NHS} Constipation (revisada 26-10-2023): "drink plenty of water and other fluids and avoid alcohol", "gradually increase the fibre", "Do not delay if you feel the urge to poo", "raise your knees above your hips", "A daily walk"; "When to see a GP"; ${CITE.IMSS_042}, p. 6 (datos de alarma: "sangrado rectal… pérdida de peso… aparición de síntomas después de los 50 años")`,
    fuente_url: SRC.NHS_CONSTIPATION,
  },
  {
    id: 'ADV-GASES',
    titulo: 'Gases o panza inflamada',
    sintomas: ['gases', 'distension_abdominal'],
    edadMin: Y(12),
    cuidados: [
      'Coma porciones pequeñas, varias veces al día, despacio y con la boca cerrada (para no tragar aire).',
      'Tome suficiente agua. Camine o haga ejercicio todos los días.',
      'Evite refrescos, cerveza, alcohol y café, y por un tiempo los alimentos que le inflaman (frijoles, col, lentejas).',
      'Evite comidas grandes en la noche.',
    ],
    regrese: [
      'no puede hacer del baño ni echar gases',
      'el dolor de panza es repentino o muy fuerte',
      'la panza se le hincha y además tiene dolor, vómito, diarrea o estreñimiento',
      'vomita sangre o algo como café molido',
    ],
    consulta: ['se inflama seguido aunque cambió lo que come, o baja de peso sin querer'],
    fuente: `${CITE.NHS} Bloating (revisada 21-01-2026): "eat smaller, more frequent meals", "chew with your mouth closed", "drink plenty of water", "exercise regularly"; "Don't: drink lots of fizzy drinks, alcohol or caffeine… cabbage, beans or lentils… large meals late at night"; señales de 999 y urgentes (reglas NHS-ABD-OBST-01, NHS-BLOAT-01); ${CITE.NHS} Flatulence (revisada 02-04-2026)`,
    fuente_url: SRC.NHS_BLOATING,
  },
  {
    id: 'ADV-AGRURAS',
    titulo: 'Agruras',
    sintomas: ['agruras'],
    edadMin: Y(12),
    cuidados: [
      'Coma porciones pequeñas, más veces al día.',
      'No coma en las 3 o 4 horas antes de dormir.',
      'Evite lo que le cae mal (picante, grasa, café), el alcohol y el cigarro. No use ropa apretada en la cintura.',
      'Si tiene sobrepeso, bajar de peso ayuda. Busque formas de relajarse.',
    ],
    regrese: [
      'el ardor o dolor se pasa al pecho, como peso u opresión, o se va al brazo, la espalda, el cuello o la quijada (es URGENCIA)',
      'vomita sangre o algo como café molido, o la popó sale negra',
    ],
    consulta: ['tiene agruras casi todos los días, siente que la comida se le atora, vomita seguido o baja de peso sin querer'],
    fuente: `${CITE.NHS} Heartburn and acid reflux (revisada 20-11-2023): "eat smaller, more frequent meals", "do not eat within 3 or 4 hours before bed", "do not wear clothes that are tight around your waist", "do not smoke"; "See a GP if"; ${CITE.NHS} Feeling sick (revisada 17-11-2023), 999: "chest pain that feels tight or heavy", "spreads to your arms, back, neck or jaw" (regla CDC-HEART-01)`,
    fuente_url: SRC.NHS_HEARTBURN,
  },
  {
    id: 'ADV-NAUSEA',
    titulo: 'Náusea o vómito',
    sintomas: ['nauseas', 'vomito'],
    noEmbarazo: true,
    edadMin: Y(12),
    cuidados: [
      'Tome traguitos de agua o suero seguido, aunque sea poquito. Puede tomar té de jengibre o de menta.',
      'Coma porciones pequeñas, cuando tenga hambre. Evite comida frita, grasosa o muy condimentada y los olores fuertes.',
      'Tome aire fresco. No se acueste justo después de comer.',
    ],
    regrese: [
      'no retiene nada (vomita todo lo que toma)',
      'vomita sangre, algo como café molido o vomita verde',
      'tiene dolor de pecho, dolor de cabeza muy fuerte o el dolor de panza es muy fuerte',
      'el vómito dura más de 2 días',
    ],
    fuente: `${CITE.NHS} Feeling sick (revisada 17-11-2023): "take regular sips of a cold drink", "drink ginger or peppermint tea", "eat smaller, more frequent meals", "do not eat hot, fried or greasy food", "do not lie down soon after eating"; ${CITE.NHS} Diarrhoea and vomiting (revisada 21-12-2023): 999 y 111 ("cannot keep fluid down", "green vomit", "vomiting for more than 2 days")`,
    fuente_url: SRC.NHS_NAUSEA,
  },
  {
    id: 'ADV-DOLOR-PANZA',
    titulo: 'Dolor de panza',
    sintomas: ['dolor_abdominal'],
    noEmbarazo: true,
    edadMin: Y(12),
    cuidados: [
      'Descanse. Tome líquidos a traguitos y coma poco y sencillo cuando tenga hambre.',
      'Evite comida grasosa, picante o muy condimentada, el café y el alcohol.',
      'No tome medicinas para el dolor sin que la revisen: pueden esconder una apendicitis.',
    ],
    regrese: [
      'el dolor se hace muy fuerte, o se pasa a la parte baja derecha y duele más al caminar o toser',
      'no puede hacer del baño ni echar gases',
      'le da calentura, vomita todo, o ve sangre en el vómito o en la popó',
    ],
    consulta: ['el dolor regresa seguido, lo despierta en la noche, va en aumento o baja de peso sin querer'],
    fuente: `${CITE.NHS} Stomach ache (revisada 26-05-2023): "Call 999" y "urgent GP" (reglas NHS-ABD-OBST-01, IITT-Y-PAIN-01, IITT-Y-BLEED-01); ${CITE.IMSS_031}, p. 2 (el dolor "migra a cuadrante inferior derecho", "se incrementa al caminar y al toser"; regla IMSS031-APEND-01); ${CITE.IMSS_042}, p. 6 (alimentos "altos en grasa, café, alcohol… picantes y condimentos"; datos de alarma "dolor abdominal nocturno o progresivo, pérdida de peso"); ${CITE.NHS} Diarrhoea and vomiting ("take small sips")`,
    fuente_url: SRC.NHS_STOMACH,
  },
  // ── Respiratorio, garganta, oído, dientes ─────────────────────────────────────────────────────
  {
    id: 'ADV-GRIPA',
    titulo: 'Gripa o tos',
    sintomas: ['escurrimiento_nasal', 'tos'],
    edadMin: Y(5),
    cuidados: [
      'Descanse y tome muchos líquidos.',
      'Puede tomar agua tibia con limón y miel.',
      'Lávese las manos seguido, tape la tos con el brazo y evite estar cerca de otras personas mientras tenga calentura.',
      'La gripa no se cura con antibiótico. Mejora en 1 a 2 semanas; la tos puede durar hasta 3 semanas.',
    ],
    regrese: [
      'le cuesta respirar o tiene dolor de pecho',
      'tose sangre',
      'la calentura dura más de 3 días, o empeora',
      'la tos dura 2 semanas o más (hay que descartar tuberculosis)',
    ],
    fuente: `${CITE.NHS} Common cold (revisada 22-03-2024): "get plenty of rest", "drink lots of fluid", "hot lemon and honey", "1 to 2 weeks", "high temperature for more than 3 days"; ${CITE.NHS} Cough (revisada 08-12-2023): "coughing up blood", "chest pain"; ${CITE.IMSS_062}, p. 4 (lavado de manos) y p. 6 (no antibiótico en el resfriado común); ${CITE.NOM_006}, 3.15 (tos de dos o más semanas)`,
    fuente_url: SRC.NHS_COLD,
  },
  {
    id: 'ADV-GARGANTA',
    titulo: 'Dolor de garganta',
    sintomas: ['dolor_garganta'],
    edadMin: Y(5),
    cuidados: [
      'Tome bastante agua. Coma cosas frescas o blandas. Descanse.',
      'Los adultos pueden hacer gárgaras de agua tibia con sal (los niños no).',
      'Evite el humo del cigarro y del fogón.',
      'Casi siempre se quita sola en una semana.',
    ],
    regrese: [
      'no puede tragar ni su saliva, babea, o le cuesta respirar (es URGENCIA)',
      'tiene calentura con placas blancas o pus en la garganta',
      'se le hincha el cuello o le sale una bola',
    ],
    consulta: ['no mejora en una semana o le da seguido'],
    fuente: `${CITE.NHS} Sore throat (revisada 08-04-2024): "gargle with warm, salty water (children should not try this)", "drink plenty of water", "eat cool or soft foods", "avoid smoking or smoky places", "rest"; 999: "unable to swallow", "drooling"; ${CITE.IMSS_062}, p. 4 y 6 (regla IMSS062-FARINGO-01); ${CITE.IITT} amarillo "swelling/mass of mouth, throat or neck"`,
    fuente_url: SRC.NHS_SORE_THROAT,
  },
  {
    id: 'ADV-OIDO',
    titulo: 'Dolor de oído',
    sintomas: ['dolor_oido'],
    edadMin: Y(5),
    cuidados: [
      'Ponga un trapo tibio sobre la oreja.',
      'No meta nada al oído: ni cotonetes, ni gotas caseras, ni aceite. No intente sacar la cera. Que no le entre agua.',
    ],
    regrese: [
      'le sale pus o líquido del oído, oye menos, o tiene algo atorado',
      'se le hincha detrás o alrededor de la oreja',
      'tiene calentura alta o se siente muy mal',
      'el dolor dura 3 días o más',
    ],
    fuente: `${CITE.NHS} Earache (revisada 27-10-2025): "place a warm flannel on the ear", "do not put anything inside your ear, such as cotton buds", "do not try to remove earwax", "do not let water get inside your ear"; urgente (regla NHS-EAR-01)`,
    fuente_url: SRC.NHS_EARACHE,
  },
  {
    id: 'ADV-MUELA',
    titulo: 'Dolor de muela',
    sintomas: ['dolor_muela'],
    edadMin: Y(5),
    cuidados: [
      'Enjuáguese la boca con agua con sal.',
      'Coma cosas blandas y mastique del otro lado.',
      'Evite lo muy dulce, muy caliente o muy frío. Use un cepillo suave.',
      'Busque al dentista lo antes posible, sobre todo si el dolor dura más de 2 días, le da calentura o le sangran las encías.',
    ],
    regrese: [
      'se le hincha la cara, la encía, la quijada o el cuello',
      'se le hincha alrededor del ojo, o la hinchazón no lo deja respirar, tragar o hablar (es URGENCIA)',
    ],
    fuente: `${CITE.NHS} Toothache (revisada 01-07-2024): "try rinsing your mouth with salt water", "eat soft foods", "use a soft toothbrush", "do not eat foods that are sweet, very hot or very cold"; "See a dentist"; A&E (regla NHS-TOOTH-01); ${CITE.IITT} amarillo "swelling/mass of mouth" (regla IITT-Y-NECK-01)`,
    fuente_url: SRC.NHS_TOOTHACHE,
  },
  // ── Cabeza, espalda, piel ─────────────────────────────────────────────────────────────────────
  {
    id: 'ADV-CABEZA',
    titulo: 'Dolor de cabeza',
    sintomas: ['dolor_cabeza'],
    noEmbarazo: true,
    edadMin: Y(12),
    cuidados: [
      'Tome bastante agua. Descanse, sobre todo si también tiene gripa.',
      'Trate de relajarse: el estrés empeora el dolor de cabeza.',
      'No se salte comidas. Descanse la vista del celular o la tele. No tome alcohol.',
    ],
    regrese: [
      'el dolor empezó de repente y es muy fuerte, o se le chuequea la cara o se le debilita un lado',
      'tiene calentura con el cuello tieso, se confunde o convulsiona',
      'tuvo un golpe en la cabeza en los últimos 3 meses',
      'vomita, o ve borroso',
    ],
    consulta: ['le duele la cabeza seguido o no mejora con estos cuidados'],
    fuente: `${CITE.NHS} Headaches (revisada 17-04-2024): "drink plenty of water", "get plenty of rest if you also have a cold", "try to relax", "do not skip meals", "do not strain your eyes", "do not drink alcohol"; 999 y 111 (reglas CDC-STROKE-01, IITT-R-NEURO-01, NHS-HEAD-01, NHS-HA-01, IITT-Y-VISION-01)`,
    fuente_url: SRC.NHS_HEADACHES,
  },
  {
    id: 'ADV-ESPALDA',
    titulo: 'Dolor de espalda baja (cintura)',
    sintomas: ['dolor_espalda_baja'],
    noEmbarazo: true,
    edadMin: Y(12),
    cuidados: [
      'Siga moviéndose y haciendo sus actividades como el dolor se lo permita: así se recupera más rápido.',
      'No se quede acostado más de 2 o 3 días: no ayuda y puede empeorar.',
      'Puede ponerse calor (un trapo o compresa tibia) en la espalda. El frío no se recomienda.',
      'La faja no se recomienda.',
    ],
    regrese: [
      'no puede orinar, no controla la orina o la popó, o se le duerme la entrepierna (es URGENCIA)',
      'pierde fuerza o se le duermen las dos piernas (es URGENCIA)',
      'tiene calentura, o el dolor empezó de repente y muy fuerte',
      'le arde al orinar o le duele de un lado debajo de las costillas',
    ],
    consulta: ['tiene más de 50 años y el dolor es nuevo, ha tenido cáncer, baja de peso sin querer, le duele en reposo o en la noche, o no mejora en 4 a 6 semanas'],
    fuente: `${CITE.IMSS_045}, p. 8 ("se mantienen un estado activo", "el reposo por más de 2 o 3 días es inefectivo e incluso dañino", "calor local", "frío local no se recomienda", "fajas lumbares no están recomendadas"), p. 3–4 (signos de alarma) y p. 6 (cauda equina; regla IMSS045-CAUDA-01). La NHS acepta el frío; gana la GPC mexicana`,
    fuente_url: SRC.IMSS_045,
  },
  {
    id: 'ADV-RONCHAS',
    titulo: 'Ronchas, comezón o piquete',
    sintomas: ['comezon', 'sarpullido'],
    // Ronda 4: con calentura, las ronchas no son un piquete (sarampión, dengue): sin estos cuidados.
    noFiebre: true,
    cuidados: [
      'Si fue un piquete: lave con agua y jabón y ponga algo frío envuelto en un trapo unos 20 minutos. Si es en un brazo o pierna, súbalo.',
      'No se rasque: se puede infectar.',
      'Si sabe qué se lo provocó (una comida, una planta, un animal), evítelo.',
    ],
    regrese: [
      'se le hinchan de repente los labios, la lengua o la boca, siente que se le cierra la garganta o le cuesta respirar (es URGENCIA)',
      'las ronchas se extienden en horas o la piel se le pela',
      'tiene calentura con manchas o puntitos en la piel',
      'no mejora en 2 días',
    ],
    fuente: `${CITE.NHS} Insect bites and stings (revisada 01-06-2023): "wash your skin with soap and water", "an ice pack wrapped in a cloth… for at least 20 minutes", "keep the area raised", "do not scratch"; ${CITE.NHS} Hives (revisada 26-04-2024): 999 y urgente (reglas NHS-ANAPH-01, IITT-Y-RASH-01)`,
    fuente_url: SRC.NHS_INSECT_BITES,
  },
  {
    id: 'ADV-MAREO',
    titulo: 'Mareo',
    sintomas: ['mareo', 'mareo_al_pararse'],
    noEmbarazo: true,
    edadMin: Y(12),
    cuidados: [
      'Acuéstese hasta que se le pase y luego levántese despacio.',
      'Tome bastante agua. Evite café, cigarro y alcohol.',
      'No se agache ni se pare de golpe. No maneje ni se suba a lugares altos mientras esté mareado.',
    ],
    regrese: [
      'de repente se le chuequea la cara, se le debilita un lado, no puede hablar bien o pierde el equilibrio (es URGENCIA)',
      'tiene dolor de pecho o se desmaya',
      'tiene diabetes y suda frío o tiembla',
    ],
    consulta: ['el mareo no se quita o regresa, o viene con zumbido de oídos o sordera'],
    fuente: `${CITE.NHS} Dizziness (revisada 21-04-2023; la revisión venció en abril de 2026: se usa solo para cuidados sin riesgo): "lie down until the dizziness passes, then get up slowly", "drink plenty of fluids", "do not bend down suddenly", "do not… drive"; ${CITE.CDC_STROKE} (regla CDC-STROKE-01)`,
    fuente_url: SRC.NHS_DIZZINESS,
  },
  {
    id: 'ADV-NERVIOS',
    titulo: 'Nervios o ansiedad',
    sintomas: ['nervios_ansiedad'],
    edadMin: Y(12),
    cuidados: [
      'Lo que siente es real: los nervios también pueden dar dolor de estómago, de cabeza o tensión en el cuerpo.',
      'Para calmarse: afloje brazos y hombros, ponga una mano en la panza, saque todo el aire, tome aire por la nariz contando 1, 2, 3 (la panza se infla), aguántelo 1, 2 y sáquelo por la boca contando 1, 2, 3. Hágalo un minuto, descanse un minuto, y repita dos veces más.',
      'Si le da un ataque de nervios: quédese donde está, respire despacio y recuerde que se le va a pasar.',
      'Siga con sus actividades. Platique con alguien de confianza. Evite el café y el alcohol.',
    ],
    regrese: [
      'ha pensado en quitarse la vida o hacerse daño (es URGENCIA; Línea de la Vida 800 911 2000)',
      'tiene dolor u opresión en el pecho o le falta el aire (es URGENCIA)',
    ],
    consulta: ['los nervios no lo dejan hacer sus actividades o no mejoran en 2 a 4 semanas'],
    fuente: `${CITE.WHO_MHGAP_2016}, módulo OTH p. 153 (explicar que el estrés da sensaciones en el cuerpo; apoyo social), p. 156 ("return in 2-4 weeks if their symptoms do not improve") y p. 157 (Box 1, ejercicio de respiración); ${CITE.NHS} Panic disorder (revisada 22-08-2023): "stay where you are", "breathe slowly and deeply", "remind yourself that the attack will pass"`,
    fuente_url: SRC.WHO_MHGAP_2016,
  },
  // ── Orina y presión ───────────────────────────────────────────────────────────────────────────
  {
    id: 'ADV-ORINA-MUJER',
    titulo: 'Ardor al orinar',
    sintomas: ['ardor_orinar'],
    sexo: 'F',
    noEmbarazo: true,
    edadMin: Y(16),
    edadMax: Y(65),
    cuidados: [
      'Tome suficientes líquidos para que la orina salga clarita durante el día. Descanse.',
      'Evite el café, el alcohol y los jugos.',
    ],
    regrese: [
      'le da calentura o escalofríos, o le duele la espalda de un lado debajo de las costillas',
      've sangre en la orina',
      'empeora rápido o no mejora en 2 días',
      'se confunde, está muy dormida o vomita todo (es URGENCIA)',
    ],
    consulta: ['acuda a consulta en su unidad en los próximos días: puede necesitar tratamiento con receta'],
    fuente: `${CITE.NHS} UTIs (revisada 11-07-2025): "rest and drink enough fluids so you pass pale urine", "avoid drinks that may irritate your bladder, like fruit juices, coffee and alcohol"; urgente y 999 (reglas IMSS077-PIELO-01, NHS-UTI-01); ${CITE.IMSS_077}, p. 3 (con síntomas clásicos "iniciar tratamiento": lo indica el médico)`,
    fuente_url: SRC.NHS_UTI,
  },
  {
    id: 'ADV-PRESION',
    titulo: 'Presión alta',
    sintomas: ['hipertension'],
    noEmbarazo: true,
    edadMin: Y(12),
    cuidados: [
      'Siga tomando sus medicinas como se las indicó su médico. No tome pastillas de otra persona.',
      'Coma con menos sal. Evite el alcohol y el cigarro. Haga actividad física, como caminar 30 minutos la mayoría de los días.',
    ],
    regrese: [
      'tiene dolor de pecho, le falta el aire, se le chuequea la cara, se le debilita un lado, se confunde, o le da un dolor de cabeza repentino y muy fuerte (es URGENCIA)',
      've borroso',
    ],
    consulta: ['acuda a su control en la unidad: la presión alta sin molestias no es urgencia, pero hay que vigilarla'],
    fuente: `${CITE.NOM_030}, 12.4 ("La sola elevación de la PA, en ausencia de síntomas… no se considera" urgencia), 12.1–12.3 (urgencias hipertensivas: referencia) y medidas de estilo de vida (reducción "de alcohol y de sal", "actividad física hasta alcanzar 30 minutos la mayor parte de los días"); "no tome pastillas de otra persona": decisión provisional D12`,
    fuente_url: SRC.NOM_030,
  },
];

const PREGNANCY_TEXT = /embaraz|regla|menstru|lactan|amamant|dar pecho|mamar/i;

/** ¿La entrada aplica a estos hallazgos? */
export function adviceApplies(a: AdviceEntry, f: Findings): boolean {
  if (a.soloEmbarazo) return f.embarazada === true && pregnancyPossible(f);
  if (!a.sintomas.some((k) => f.sintomas?.[k] === true)) return false;
  const age = f.edad_meses;
  if (a.edadMin !== undefined && !(isNum(age) && age >= a.edadMin)) return false;
  if (a.edadMax !== undefined && !(isNum(age) && age < a.edadMax)) return false;
  if (a.sexo && f.sexo !== a.sexo) return false;
  // Ronda 4: también cuando el embarazo es posible y no se descartó con un "No" (no se sabe si está embarazada).
  if (a.noEmbarazo && (f.embarazada === true || f.sintomas?.posparto === true || (pregnancyPossible(f) && f.embarazada !== false))) return false;
  if (a.noFiebre && hasFever(f)) return false;
  return true;
}

export interface SelectedAdvice {
  id: string;
  titulo: string;
  /** "aqui": cuidados en casa; "centro_hoy": mientras llega al centro de salud. */
  modo: 'casa' | 'mientras';
  cuidados: string[];
  regrese: string[];
  consulta: string[];
  fuente: string;
  fuente_url: string;
}

/**
 * Cuidados para mostrar según el nivel. Determinista: orden de ADVICE, hasta `max` entradas.
 * Un hombre nunca recibe texto de embarazo, regla o lactancia (se filtra por si acaso; las pruebas lo exigen).
 */
export function selectAdvice(f: Findings, level: TriageLevel, max = MAX_ADVICE): SelectedAdvice[] {
  if (level === 'urgencia') return [];
  const out: SelectedAdvice[] = [];
  for (const a of ADVICE) {
    if (out.length >= max) break;
    if (!adviceApplies(a, f)) continue;
    const mientras = level === 'centro_hoy';
    const cuidados = mientras ? a.mientras ?? [] : a.cuidados.length ? a.cuidados : a.mientras ?? [];
    if (!cuidados.length) continue;
    const clean = (xs: string[]) => (f.sexo === 'M' ? xs.filter((x) => !PREGNANCY_TEXT.test(x)) : xs);
    out.push({
      id: a.id,
      titulo: a.titulo,
      modo: mientras ? 'mientras' : 'casa',
      cuidados: clean(cuidados),
      regrese: mientras ? [] : clean(a.regrese),
      consulta: mientras ? [] : clean(a.consulta ?? []),
      fuente: a.fuente,
      fuente_url: a.fuente_url,
    });
  }
  return out;
}
