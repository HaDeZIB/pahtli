# Investigación: molestias comunes de primer nivel (para implementar en Pahtli)

> **Estado:** investigación clínica, **pendiente de revisión por la Dra. Ines**. No cambia código.
> **Fecha:** 4 de octubre de 2026. Rama `dev`.
> **Método:** cada fuente de la tabla 2 se descargó (WebFetch o `curl`) y se leyó en esta sesión. De los PDF se extrajo el texto con PyMuPDF. Las citas son fragmentos cortos (menos de 15 palabras). Lo que no se pudo leer en la fuente se marca **no verificado** y queda fuera de las tablas de reglas.
> **Principios que se respetan:** las reglas deciden y el modelo solo puede subir el nivel; un dato desconocido nunca dispara una regla; NOM > guía internacional cuando no coinciden; trato de usted; nada de dosis; "Sí" siempre significa que el signo de peligro está presente. **No se propone cambiar ningún umbral ni nivel existente.** Los conflictos con reglas que ya existen se listan como [DECIDIR] (sección 6).

---

## 0. Qué encontramos al probar el motor actual (rama `dev`, `keywordExtract` + `triage`, sin la pregunta de revisión)

Se probó con `tsx` sobre el código actual. Son hallazgos de seguridad que esta investigación ayuda a cerrar:

| Texto de prueba | Resultado hoy | Problema |
|---|---|---|
| "a mi niño de 3 años le picó un alacrán" | `aqui` (`IMCI-NOSIGNS-01`), `sintomas: {}` | **Grave.** "alacrán" no existe en el catálogo. Según la Secretaría de Salud, más del 80 % de las muertes por alacrán son de menores de 5 años (sección 4.17). |
| "señor de 40 años le picó un alacrán en la mano" | `aqui` | La guía de la Secretaría de Salud pide que lo evalúe personal médico de la unidad más cercana. |
| "lo mordió una araña viuda negra" | `aqui`, `sintomas: {}` | "araña" no existe en el catálogo. La guía la trata como urgencia médica. |
| "se le hincharon los labios y la lengua después de una picadura" | `aqui`, `sintomas: {}` | Posible reacción alérgica grave (anafilaxia). No se reconoce. |
| "mujer de 30 años con ardor al orinar" | `aqui` | `ardor_orinar` solo dispara en embarazo o posparto. Una infección urinaria necesita receta (sección 4.11). |
| "hombre de 25 con dolor de muela y la cara hinchada" | `aqui`; extrae `hinchazon_cara_manos` (clave del embarazo) | Hinchazón de la cara por infección dental no se distingue. |
| "señora de 60 años con dolor de cintura" | `aqui`, `sintomas: {}` | "cintura" no se reconoce como dolor de espalda baja. |
| "hombre de 50 diabético que tiembla y suda frío" | `aqui` con **`IMCI-NOSIGNS-01`** (texto de niño) | (1) "hombre de 50", sin la palabra "años", no da edad. (2) Posible hipoglucemia que no se reconoce. |
| "hombre de 21 años con dolor de estómago, gases y estreñido por dos días" (el caso de Brandon) | `aqui`; `sexo: 'M'`; **no** pregunta embarazo | En `dev`, "hombre" ya se detecta y la pregunta de embarazo no sale. Si salió en la prueba, probablemente fue en la versión congelada `v1.0-entrega` o por la ruta del modelo (hay que revisarlo). **"gases" y "estreñido" no se extraen** (no existen en el catálogo). |
| "joven de 21 años con dolor de panza" / "paciente de 21 años con dolor de estómago" | Pregunta **embarazo y posparto** sin preguntar antes el sexo | "joven" y "paciente" no traen sexo. **Recomendación:** si `sexo` falta y la edad es de 10 a 49 años, preguntar primero "¿Es hombre o mujer?" y solo después el embarazo. La GPC IMSS-031 dice que se descarte embarazo en "toda paciente en edad fértil" con dolor abdominal (sección 4.1), es decir, en mujeres. |

---

## 1. Convenciones para implementar

### 1.1 Niveles
Se usa la misma equivalencia de `docs/clinical-sources.md` §1. Para las fuentes nuevas:

| Fuente dice | Nivel Pahtli |
|---|---|
| NHS "Call 999" / "Go to A&E" | `urgencia` |
| NHS "urgent GP appointment" / "call 111" | `centro_hoy` |
| NHS "See a GP" / "see a pharmacist" (no urgente) | **`consulta`** (ver 1.2) |
| IITT rojo / amarillo | `urgencia` / `centro_hoy` (como en el repo) |
| IMSS GPC "referir a urgencias" / "enviar a hospital" | `urgencia` |
| IMSS GPC: necesita tratamiento que da el médico (antibiótico, valoración) | `centro_hoy` (misma lógica "adaptado" que el AIEPI amarillo en el repo) |
| Secretaría de Salud: "urgencia médica" en animales ponzoñosos | `urgencia` |

### 1.2 Nivel "consulta" (no existe hoy) [DECIDIR C1]
Muchas fuentes dicen "consulte a su médico" sin urgencia: pérdida de peso, síntomas que regresan o un dolor de 4 a 6 semanas. Pahtli no tiene ese nivel.
**Propuesta:** que no sea un nivel nuevo. Que salga como `aqui` con un texto extra: **"Además, acuda a consulta en su unidad de salud en los próximos días."** Así no se cambia la escala de 3 niveles. Las filas marcadas `consulta` en las tablas usan esta propuesta.

### 1.3 Fidelidad
- `verbatim`: el criterio y el nivel son los de la fuente.
- `adaptado`: se combinan fuentes, se traduce el nivel (por ejemplo NHS "urgent GP" → `centro_hoy`) o se extiende a otra edad.
- Las columnas "Pregunta Sí/No" están escritas para que **"Sí" = el signo de peligro está presente**.

### 1.4 Preguntas según sexo y edad (para la queja del usuario)
- Preguntas de **embarazo**: solo si `sexo` es `F` o desconocido y la edad está entre 10 y 49 años (ya existe). **Agregar:** si `sexo` es desconocido, preguntar primero el sexo.
- Preguntas de **testículos**: solo si `sexo` es `M` o desconocido (sección 4.1).
- Si se sabe que el paciente es hombre, ninguna indicación de casa debe mencionar embarazo, regla ni lactancia.

---

## 2. Fuentes nuevas consultadas (todas leídas el 4-oct-2026)

| Clave propuesta | Documento | Editor y año | URL | Vigencia |
|---|---|---|---|---|
| SSA_IAVYS_2026 | Guía de diagnóstico y tratamiento de la intoxicación por arácnidos y ofidios (alacrán, viuda negra, violinista, víboras) | Secretaría de Salud / CENAPRECE. El PDF se creó el 28-abr-2026 y cita reformas del DOF de oct-2025 | https://www.gob.mx/cms/uploads/attachment/file/1073814/Manual_de_Tratamiento_de_las_IAVyS.pdf | Vigente. Es la guía nacional más reciente encontrada |
| DGE_ALACRAN_2012 | Manual de Procedimientos Estandarizados para la Vigilancia Epidemiológica de la Intoxicación por Picadura de Alacrán | SSA, Dirección General de Epidemiología, sept. 2012 (copia publicada por CEVECE Edomex) | https://cevece.edomex.gob.mx/sites/cevece.edomex.gob.mx/files/files/docs/marco_juridico/manualesvep/Manual_Picadura_Alacran.pdf | Es uno de los instrumentos que, según el aviso de cancelación de la NOM-033, la reemplazan |
| DOF_CANCEL_NOM033 | Aviso de cancelación de la NOM-033-SSA2-2011 (alacrán) | DOF, 07-jun-2024 | https://sidof.segob.gob.mx/notas/docFuente/5732620 | **NOM-033 CANCELADA**: no se debe citar como vigente |
| CENAPRECE_LOXO | Loxoscelismo: aspectos generales, araña violinista (página web) | CENAPRECE, modificada el 20-may-2016 | http://www.cenaprece.salud.gob.mx/programas/interior/vectores/otrasenf/AspectosGeneralesAranaViolinista.html (el certificado HTTPS está vencido; se leyó con `curl -k`) | Página institucional sin fecha de baja |
| SSA_RABIA_GUIA | Guía para la atención médica y antirrábica de la persona expuesta al virus de la rabia, 2a ed. | SSA / CENAPRECE, oct. 2010 (copia publicada por el Gobierno de Jalisco) | https://transparencia.info.jalisco.gob.mx/sites/default/files/GUIA%20PARA%20LA%20PERSONA%20EXPUETA%20AL%20VIRUS%20DE%20LA%20RABIA.pdf | Es la guía a la que remite la NOM-011. Una búsqueda menciona una 3a ed. (2018) que no se leyó |
| NOM_011 | NOM-011-SSA2-2011, Para la prevención y control de la rabia humana y en los perros y gatos | DOF 08-12-2011 | https://dof.gob.mx/nota_detalle.php?codigo=5223519&fecha=08/12/2011 | Vigente (no aparece en las listas de cancelación de 2023) |
| NOM_015 | NOM-015-SSA2-2010, Para la prevención, tratamiento y control de la diabetes mellitus | DOF 23-11-2010 | https://dof.gob.mx/nota_detalle.php?codigo=5168074&fecha=23/11/2010 | Ver nota de vigencia 2.1 |
| NOM_030 | NOM-030-SSA2-2009, Para la prevención, detección, diagnóstico, tratamiento y control de la hipertensión arterial sistémica | DOF 31-05-2010 | https://dof.gob.mx/nota_detalle.php?codigo=5144642&fecha=31/05/2010 | Ver nota de vigencia 2.1 |
| NOM_006 | NOM-006-SSA2-2013, Para la prevención y control de la tuberculosis | DOF 13-11-2013 | https://dof.gob.mx/nota_detalle.php?codigo=5321934&fecha=13/11/2013 | Vigente |
| IMSS_031 | GPC Diagnóstico de Apendicitis Aguda, Guía de Referencia Rápida | IMSS | https://www.imss.gob.mx/sites/all/statics/guiasclinicas/031GRR.pdf | GPC IMSS |
| IMSS_042 | GPC IMSS-042-08 Diagnóstico y tratamiento del Intestino Irritable en el Adulto, GRR (act. 2015) | IMSS | https://www.imss.gob.mx/sites/all/statics/guiasclinicas/042GRR.pdf | GPC IMSS |
| IMSS_045 | GPC IMSS-045-08 Diagnóstico, tratamiento y prevención de Lumbalgia aguda y crónica en el primer nivel, GRR | IMSS | https://www.imss.gob.mx/sites/all/statics/guiasclinicas/045GRR.pdf | GPC IMSS |
| IMSS_062 | GPC IMSS-062-08 Infección aguda de vías aéreas superiores en pacientes mayores de 3 meses hasta 18 años, GRR (act. 2016) | IMSS | https://www.imss.gob.mx/sites/all/statics/guiasclinicas/062GRR.pdf | GPC IMSS |
| IMSS_077 | GPC Diagnóstico y Tratamiento de la Infección Aguda, no Complicada del Tracto Urinario en la Mujer, GRR | IMSS | https://www.imss.gob.mx/sites/all/statics/guiasclinicas/077GRR.pdf | GPC IMSS |
| IMSS_040 | GPC Diagnóstico y tratamiento del paciente "Gran Quemado", GRR | IMSS | https://www.imss.gob.mx/sites/all/statics/guiasclinicas/040GRR.pdf | GPC IMSS |
| IITT (ya en repo) | Tablas IITT ≥12 y <12 años + tarjeta de referencia de alto riesgo | OMS/CICR/MSF | Adulto: https://cdn.who.int/media/docs/default-source/integrated-health-services-(ihs)/csy/iitt/iitt_adult.pdf?sfvrsn=b2a91431_1 · Tarjeta: https://www.zol.be/sites/default/files/deelsites/urgentiegeneeskunde/iitt_triage.pdf | Se volvieron a leer hoy |
| IMCI_2014 (ya en repo) | Chart Booklet, "Does the child have an ear problem?" | OMS/UNICEF 2014 | (URL del repo), p. 9 del PDF | Se volvió a leer hoy |
| WHO_MHGAP_2016 (ya en repo) | mhGAP-IG 2.0, módulo OTH (otras quejas importantes de salud mental) | OMS 2016 | https://iris.who.int/server/api/core/bitstreams/6ded7ffd-9d69-493a-b48a-0b3e6250c173/content | p. 150–157 del PDF |
| WHO_BURNS_FS | Burns, fact sheet | OMS, 13-oct-2023 | https://www.who.int/news-room/fact-sheets/detail/burns | Vigente |
| NHS_* | Páginas de NHS (Reino Unido) con la fecha de revisión de cada una: stomach-ache (26-may-2023), bloating (21-ene-2026), constipation (26-oct-2023), diarrhoea-and-vomiting (21-dic-2023), heartburn-and-acid-reflux (20-nov-2023), feeling-sick-nausea (17-nov-2023), headaches (17-abr-2024), common-cold (22-mar-2024), cough (08-dic-2023), sore-throat (08-abr-2024), earache (27-oct-2025), urinary-tract-infections-utis (11-jul-2025), back-pain (05-mar-2026), toothache (01-jul-2024), cuts-and-grazes (02-abr-2026), burns-and-scalds (31-mar-2026), animal-and-human-bites (27-oct-2025), head-injury-and-concussion (29-may-2025), dizziness (21-abr-2023; **la revisión venció en abr-2026**), low-blood-sugar-hypoglycaemia (03-ago-2023), hives (26-abr-2024), insect-bites-and-stings, panic-disorder (22-ago-2023) | NHS | `https://www.nhs.uk/conditions/<página>/` (dizziness, headaches y nausea en `/symptoms/`; panic en `/mental-health/conditions/panic-disorder/`) | Vigentes |
| DEM | Diccionario del español de México (para las frases coloquiales) | El Colegio de México | `https://dem.colmex.mx/Ver/<palabra>` | — |

### 2.1 Notas de vigencia (importantes para todo el repo)
1. **NOM-033-SSA2-2011 (alacrán) está CANCELADA.** El aviso salió en el DOF el 07-jun-2024. Según el aviso, su contenido queda en un programa de acción, guías de práctica clínica y procedimientos estandarizados de vigilancia. Para alacrán se usan SSA_IAVYS_2026 y DGE_ALACRAN_2012. No se debe citar la NOM-033.
2. **NOM-015 (diabetes), NOM-030 (hipertensión) y NOM-031 (salud del niño; el repo la cita mucho):** el Programa Nacional de Infraestructura de la Calidad 2023 las propuso para cancelar. Según Expansión (11-jul-2023, https://politica.expansion.mx/mexico/2023/07/11/salud-acuerda-desaparecer-cuatro-normas-oficiales-evaluar-26-y-crear-dos-nuevas), después Salud acordó cancelar solo 4 normas (entre ellas la NOM-033) y **"evaluar" las otras 26**, incluidas estas tres. No encontramos aviso de cancelación de la NOM-015, la NOM-030 ni la NOM-031 en el DOF. **La vigencia actual de estas tres queda como no verificada de forma definitiva.** Recomendación: que alguien consulte el DOF o el catálogo de normas vigentes de la Secretaría de Salud.
3. **`cenetec-difusion.com` ya no sirve guías.** Las URL `cenetec-difusion.com/CMGPC/...` devuelven una página de casinos en línea (se probó con IMSS-045-08, GPC-SS-027-21 y SSA-148-08). **No se debe enlazar ese dominio.** Las GRR del IMSS en `imss.gob.mx/sites/all/statics/guiasclinicas/` sí funcionan.

---

## 3. Glosario coloquial verificado (para `synonyms` en `src/triage/findings.ts`)

"DEM ✔" quiere decir que el Diccionario del español de México confirma ese sentido (cita corta). "uso común (no verificado en DEM)" quiere decir que la frase es habitual pero no se encontró en el diccionario. Se puede usar como frase de búsqueda, pero no como definición clínica.

| Frase de la gente | Significado | Verificación |
|---|---|---|
| "no ha obrado", "no obra" | no ha evacuado (defecado) | DEM ✔ *obrar*: acepción 4, "Defecar" |
| "no ha evacuado", "no ha hecho del baño", "no puede hacer del baño", "no puede hacer popó" | estreñimiento | DEM ✔ *evacuar*: "Expulsar el organismo los excrementos"; las demás frases son de uso común |
| "está tapado", "anda tapado" | estreñido | DEM ✔ *tapado*: (Popular) "Que está estreñido" |
| "estreñido", "me estriñe" | estreñimiento | DEM ✔ *estreñir* |
| "aventado", "anda aventado" | panza llena de gases | DEM ✔ *aventado*: (Popular) "vientre lleno de gases o flatulencias" |
| "inflamado", "panza inflamada", "panza hinchada", "barriga inflada", "gases", "echa muchos gases", "pedos" | distensión o gases | *inflamado* DEM ✔ en su sentido general. El sentido "inflamado = con gases" es de uso común (no verificado en DEM) |
| "torzón" | en el DEM es abultamiento del vientre por gases **en el ganado** | DEM ✔ (de animales). En personas: no verificado. No usar |
| "retortijones", "retorcijones" | cólico intestinal | DEM ✔ *retortijón* (Popular) |
| "cólico" | dolor agudo en el abdomen | DEM ✔ |
| "empacho", "empachado" | malestar digestivo; también es un concepto de la medicina tradicional | DEM ✔ *empacho*. Ojo: "curar/tronar el empacho" es una práctica tradicional |
| "agruras", "acidez", "ardor en la boca del estómago" | pirosis | DEM ✔ *agruras*: "dolor y ardor principalmente en la boca del estómago" |
| "basca", "bascas", "ganas de vomitar", "asco" | náusea | DEM ✔ *basca*: "Sensación de asco o náusea" |
| "chorrillo", "soltura", "suelto del estómago", "aguadito" | diarrea | DEM ✔ *chorrillo* (Popular) y *soltura* (Rural) = "Diarrea" |
| "anginas", "le duelen las anginas" | amígdalas inflamadas | DEM ✔ *angina* acepción 2. **Cuidado:** "angina de pecho" (acepción 3) es dolor de pecho del corazón → `dolor_pecho` |
| "carraspera", "garganta irritada" | dolor o irritación de garganta | no verificado en DEM (la página no cargó) |
| "flemas", "echa flemas" | tos con flema | DEM ✔ *flema* |
| "gripa" | catarro o gripe | DEM ✔ *gripa* |
| "jaqueca" | dolor de cabeza fuerte, a veces de un lado | DEM ✔ *jaqueca* (ya está en `dolor_cabeza`) |
| "mareo", "todo le da vueltas" | mareo o vértigo | DEM ✔ *mareo* |
| "vahído", "váguido", "le dio un vahído" | desmayo de un momento | DEM ✔ *vahído*: "Desvanecimiento momentáneo" → mapear a `desmayo` |
| "desguanzado", "sin fuerzas" | debilidad | DEM ✔ *desguanzado* |
| "dolor de cintura", "le duele la cintura", "dolor de riñones" (en la espalda baja) | dolor de espalda baja | *cintura* DEM ✔ como zona del cuerpo. "dolor de cintura = lumbalgia" es de uso común (no verificado en DEM). "dolor de riñones" es ambiguo: puede ser espalda baja o fosa renal |
| "ardor al orinar", "le arde la pipí", "mal de orín" | disuria | DEM ✔ *ardor*, *pipí*. "mal de orín" ya está en `ardor_orinar` (no verificado en DEM) |
| "dolor de muela", "muela picada" | dolor dental | DEM ✔ *muela* ("dolor de muelas") |
| "comezón", "le pica" | prurito | DEM ✔ *comezón* |
| "ronchas" | habones (urticaria) o piquetes | DEM ✔ *roncha* (piquetes, alergias) |
| "salpullido", "sarpullido" | erupción leve con granitos | DEM ✔ *salpullido* |
| "jiotes" | manchas resecas con escamas en la piel | DEM ✔ *jiote* |
| "piquete", "le picó" | picadura (de insecto o de alacrán) | DEM ✔ *piquete*: "un piquete de alacrán" |
| "cortada", "raspón" | herida cortante o superficial | DEM ✔ |
| "chichón", "chipote" | bulto en la cabeza por un golpe | DEM ✔ *chichón* |
| "descalabrado", "se descalabró" | herida en el cuero cabelludo | DEM ✔ *descalabrar* |
| "torcedura", "se torció" | esguince | DEM ✔ |
| "ampolla(s)" | ampolla (por quemadura o por roce) | DEM ✔ |
| "calentura" | fiebre | DEM ✔ (ya está) |
| "nervios", "anda de los nervios", "ansias" | ansiedad o angustia | DEM ✔ *nervio* acep. 2; *ansia* acep. 1 |
| "susto", "espanto" | concepto de la medicina tradicional (perturbación emocional) | DEM ✔ *susto* acep. 2. No tratar como diagnóstico |
| "muina", "bilis", "hizo bilis" | enojo o disgusto fuerte (creencia popular de que enferma) | DEM ✔ |
| "la presión", "se le subió la presión" | tensión arterial | DEM ✔ *presión* acep. 4 |
| "el azúcar", "se le bajó el azúcar" | glucosa | uso común (no verificado en DEM con ese sentido) |
| "viuda negra", "araña capulina", "araña del trasero rojo/colorado", "casampulga", "cintlatlahua" | Latrodectus | ✔ SSA_IAVYS_2026 p. 4 y 14 |
| "araña violinista", "araña del rincón", "araña reclusa", "araña de los cuadros", "araña café/parda" | Loxosceles | ✔ SSA_IAVYS_2026 p. 4; CENAPRECE_LOXO |
| "cruda" | malestar después de tomar alcohol | DEM ✔ *cruda* (útil para no confundirlo con una enfermedad nueva) |

---

## 4. Molestias, una por una

Formato de cada molestia: **(a)** señales de alarma, con nivel, criterio, fuente y si ya existe en Pahtli; **(b)** cuidados en casa en lenguaje sencillo (sin medicinas ni dosis), con su fuente; **(c)** cuándo regresar; **(d)** frases y notas para el extractor.
Los ID que empiezan con una fuente nueva (`NHS-`, `SSA-`, `IMSS0xx-`, etc.) son **propuestas**. Los que ya existen se escriben tal cual.

---

### 4.1 Dolor de panza (dolor abdominal) en mayores de 12 años

**(a) Señales de alarma**

| ID propuesto | Nivel | Pregunta Sí/No (Sí = peligro) | Fuente (sección / página) | Fidelidad | ¿Existe? |
|---|---|---|---|---|---|
| `NHS-ABD-OBST-01` | urgencia | ¿Lleva horas o días **sin poder hacer del baño ni echar gases**, con la panza hinchada o con vómito? | NHS stomach-ache, "Call 999 or go to A&E if": "you cannot poo or fart"; NHS bloating, urgente: no puede orinar, evacuar ni echar gases | adaptado | **No** |
| `IMSS031-APEND-01` | urgencia | ¿El dolor empezó alrededor del ombligo y **se pasó a la parte baja derecha**, y le duele más al caminar o al toser? | IMSS_031 p. 2: inicia periumbilical y "antes de 24 horas migra a cuadrante inferior derecho"; "se incrementa al caminar y al toser". Nivel: NHS stomach-ache 999 "it hurts when you touch your stomach" | adaptado | **No** |
| `IITT-R-ABD-01` | urgencia | Mayor de 50 años con dolor de panza fuerte de inicio reciente | IITT ≥12, rojo "Acute chest or abdominal pain (>50 years old)" | (existe) | Sí |
| `IITT-R-TESTIS-01` | urgencia | **Niño o adolescente hombre menor de 12 años:** ¿le duele o se le hinchó un testículo (huevito) de repente? | IITT <12, rojo "Acute testicular/scrotal pain or priapism" | verbatim | **No** |
| `IITT-Y-TESTIS-01` | centro_hoy | **Hombre de 12 años o más:** ¿le duele un testículo de repente? | IITT ≥12, amarillo "Acute testicular/scrotal pain or priapism" | verbatim | **No** |
| `NHS-DM-VOM-01` | urgencia [DECIDIR D4] | ¿Tiene diabetes **y** está vomitando? | NHS stomach-ache, 999: "you have diabetes and you're vomiting" | adaptado | **No** |
| `IITT-Y-PAIN-01` | centro_hoy | Dolor muy fuerte o que no se quita | IITT amarillo "Severe pain" | (existe) | Sí |
| `NHS-ABD-01` | centro_hoy | ¿El dolor **empeoró mucho**, o **no se quita o regresa**? | NHS stomach-ache, urgente (111): "it gets much worse", "does not go away or keeps coming back" | adaptado | **No** |
| `NHS-ABD-02` | centro_hoy | ¿Tiene dolor de panza **con calentura o escalofríos**? | NHS bloating, urgente: fiebre o escalofríos; IMSS_031 p. 2 (fiebre ≥38 °C en apendicitis) | adaptado | **No** (fiebre sola cae en otras reglas) |
| embarazo | (existe) | Mujer de 10 a 49 años: ¿podría estar embarazada? → `NOM007-EMB-04` (`urgencia`) | IMSS_031 p. 4: "Toda paciente en edad fértil con amenorrea y dolor abdominal… descartar gestación" | (existe) | Sí. **Preguntar solo a mujeres** (1.4) |
| sangre | (existe) | Vómito con sangre o popó negra → `IITT-Y-BLEED-01` (`centro_hoy`) | NHS dice 999 → [DECIDIR D2] | (existe) | Sí |
| `consulta` | consulta | Baja de peso sin querer; dolor que despierta en la noche o que va en aumento; la molestia empezó después de los 50 años | IMSS_042 p. 6 "datos de alarma": pérdida de peso, dolor nocturno o progresivo, inicio después de los 50 años | adaptado | **No** |
| aviso | — | En personas mayores el dolor puede ser poco intenso y sin fiebre aunque sea grave | IMSS_031 p. 3: "forma atípica e insidiosa… dolor constante poco intenso" | — | Texto educativo |

**(b) Cuidados en casa** (solo si no hay ninguna señal de alarma)
- "Descanse y tome líquidos a traguitos. Coma poco y cosas sencillas cuando tenga hambre." (NHS diarrhoea-and-vomiting: líquidos a sorbos y comer cuando pueda; NHS feeling-sick: comidas pequeñas y frecuentes)
- "Evite comida grasosa, muy condimentada o picante, café y alcohol." (IMSS_042 p. 6; NHS bloating)
- **No** dar recomendaciones de medicinas para el dolor (pueden esconder una apendicitis). Nota: en la NHS el analgésico lo recomienda la farmacia; aquí se excluye a propósito.

**(c) Regresar o ir de inmediato si:** el dolor se hace más fuerte, se pasa a la parte baja derecha, le da calentura, vomita todo, no puede hacer del baño ni echar gases, o ve sangre en el vómito o en la popó. (Fuentes de las filas de arriba)

**(d) Frases:** ya existen "dolor de panza/estómago/barriga", "retortijones", "cólico". Agregar: "dolor de tripas", "me duele el estómago", "se le pasó el dolor para abajo a la derecha", "le duele al caminar", "le duele al toser", "le duelen los huevitos/testículos" (solo hombres).

---

### 4.2 Gases, panza inflamada o "aventada" (distensión)

**(a) Señales de alarma**

| ID propuesto | Nivel | Pregunta Sí/No | Fuente | Fidelidad | ¿Existe? |
|---|---|---|---|---|---|
| `NHS-ABD-OBST-01` | urgencia | (la misma de 4.1) ¿No puede hacer del baño **ni** echar gases? | NHS bloating y stomach-ache (999) | adaptado | No |
| `NHS-BLOAT-01` | urgencia | ¿La panza hinchada vino con un **dolor de panza repentino y muy fuerte**, o vomita sangre? | NHS bloating, "Call 999": dolor de panza repentino y fuerte, vómito con sangre | adaptado | Parcial (`IITT-Y-PAIN-01` es `centro_hoy`) → [DECIDIR D2] |
| `NHS-BLOAT-02` | centro_hoy | ¿Además de la panza hinchada tiene **vómito, diarrea, estreñimiento, dolor de panza o calentura**? | NHS bloating, urgente (111): hinchazón con vómito, diarrea o estreñimiento; "with a stomach ache"; fiebre o escalofríos | adaptado | **No** |
| `NHS-BLOAT-03` | centro_hoy | ¿Siente una **bola o bulto** en la panza? | NHS bloating, urgente: "Stomach swelling or lump" | adaptado | **No** |
| `consulta` | consulta | Se le inflama seguido, ya cambió lo que come y no mejora, o está bajando de peso | NHS bloating, "See a GP if"; IMSS_042 p. 6 | adaptado | No |
| bebé | (existe) | Recién nacido con panza inflada → `NOM007-RN-01` | — | (existe) | Sí |

**(b) Cuidados en casa** (NHS bloating, "Things you can do"; IMSS_042 p. 6–7)
- "Coma porciones pequeñas varias veces al día, en lugar de comidas grandes. Mastique con la boca cerrada para no tragar aire."
- "Tome suficiente agua."
- "Camine o haga ejercicio todos los días."
- "Evite refrescos, alcohol y café, y por un tiempo los frijoles, la col y las lentejas si le inflaman."
- "Evite comidas grandes en la noche y comer encorvado."
- "Puede sobarse la panza suavemente para ayudar a sacar los gases." (NHS: "massage your stomach from right to left") **Nota:** la dirección de la NHS ("de derecha a izquierda") no se pasa al texto porque puede confundir; la Dra. Ines decide si se agrega.

**(c) Regresar si:** no puede hacer del baño ni echar gases, aparece dolor fuerte, vómito o calentura, o se le inflama seguido.

**(d) Frases (nueva clave `gases`, sin nivel propio):** "gases", "echa muchos gases", "anda aventado", "panza aventada", "inflamado del estómago", "se siente inflamado", "panza hinchada" (ya está en `distension_abdominal`), "eructa mucho". **Nota de diseño:** `distension_abdominal` cuenta como signo de alarma en dengue (`dengue.ts` WARNING). La palabra suelta "inflamado" en un adulto sin fiebre **no** debe mapearse a `distension_abdominal`, porque haría saltar dengue en un caso de gases. Proponemos que "gases / aventado / inflamado del estómago" vayan a la nueva clave `gases`.

---

### 4.3 Estreñimiento ("no ha obrado")

**(a) Señales de alarma**

| ID propuesto | Nivel | Pregunta Sí/No | Fuente | Fidelidad | ¿Existe? |
|---|---|---|---|---|---|
| `NHS-ABD-OBST-01` | urgencia | ¿No puede hacer del baño **ni echar gases**, y tiene la panza hinchada o vomita? | NHS stomach-ache 999 "you cannot poo or fart"; NHS bloating | adaptado | No |
| sangre | (existe) | ¿Tiene sangre en la popó? → `IITT-Y-BLEED-01` | NHS constipation, "See a GP": sangre en la popó; IMSS_042 p. 6: "sangrado rectal" | (existe) | Sí |
| `NHS-CONST-01` | centro_hoy | ¿Está estreñido **y además tiene dolor de panza fuerte o vómito**? | NHS bloating, urgente: hinchazón con estreñimiento o vómito; NHS stomach-ache | adaptado | **No** |
| `consulta` | consulta | Se estriñe seguido; no mejora con los cuidados; bajó de peso; anda muy cansado; cambió de pronto cómo hace del baño (sobre todo después de los 50) | NHS constipation, "When to see a GP"; IMSS_042 p. 6 | adaptado | No |

**(b) Cuidados en casa** (NHS constipation; IMSS_042 p. 6 "Fibra" y p. 15 "Incrementar fibra")
- "Tome bastante agua y otros líquidos. Evite el alcohol."
- "Coma más fibra **poco a poco**: frutas, verduras, avena, salvado." (NHS: "gradually increase the fibre")
- "Haga del baño a la misma hora todos los días, sin prisa. **No se aguante** cuando sienta ganas."
- "Al sentarse en el baño, ponga los pies sobre un banquito para que las rodillas queden más altas que la cadera."
- "Camine todos los días."

**(c) Regresar si:** no puede echar gases, tiene vómito o dolor fuerte, sale sangre o no mejora.

**(d) Frases (nueva clave `estrenimiento`):** "estreñido", "estreñida", "está tapado", "no ha obrado", "no obra", "no ha hecho del baño", "no puede hacer del baño", "no ha evacuado", "no puede hacer popó", "hace muy duro", "le cuesta hacer del baño", "días sin ir al baño". Y para la señal de alarma: "no echa gases", "no puede sacar los gases", "ni gases echa".
**No verificado y excluido:** estreñimiento en niños (la GPC IMSS 643GER existe pero no se leyó). Para menores de 5 años se siguen usando las reglas AIEPI que ya existen.

---

### 4.4 Diarrea en adultos (mayores de 12 años)

**(a) Señales de alarma** (las reglas de deshidratación y sangre ya existen y aplican a todas las edades)

| ID propuesto | Nivel | Pregunta Sí/No | Fuente | Fidelidad | ¿Existe? |
|---|---|---|---|---|---|
| deshidratación | (existe) | `IMCI-DIAR-01` / `IMCI-DIAR-02` | WHO_DIARRHOEA_2005 (repo) | (existe) | Sí |
| vomita todo | (existe) | `IITT-Y-CIRC-01` | NHS diarrhoea-and-vomiting, 111: "cannot keep fluid down" | (existe) | Sí |
| sangre | (existe) | `IITT-Y-BLEED-01` | NHS 111: "bloody diarrhoea" | (existe) | Sí |
| `NHS-DIAR-01` | centro_hoy [DECIDIR D3] | ¿Lleva **más de 7 días** con diarrea, o **más de 2 días** vomitando? | NHS diarrhoea-and-vomiting, 111: "diarrhoea for more than 7 days or vomiting for more than 2 days" | adaptado | **No** (hoy `IMCI-DIAR-03` usa 14 días) |
| `NHS-DIAR-02` | urgencia | ¿Vomita **verde**? (adulto **y niño**) | NHS diarrhoea-and-vomiting, 999: "green vomit (adults)" y "yellow-green or green vomit (children)" (**corregido en la ronda 4**: la primera versión de esta tabla omitió la línea de niños; implementado como `NHS-VOM-GREEN-01` a toda edad) | verbatim | **No** |
| `NHS-DM-VOM-01` | urgencia [D4] | Diabético que vomita | NHS stomach-ache 999 | adaptado | No |
| embarazo | (existe) | `WHO-PCPNC-EMB-01`, `IMSS-EMB-04` | — | — | Sí |

**(b) Cuidados en casa** (NHS diarrhoea-and-vomiting)
- "Descanse en casa. Tome muchos líquidos (agua o Vida Suero Oral), a traguitos si tiene ganas de vomitar."
- "Coma cuando pueda. Evite comida grasosa o muy condimentada."
- "**No** tome jugos ni refrescos: empeoran la diarrea."
- "Lávese las manos con agua y jabón después de ir al baño y antes de comer." (IMSS_062 p. 4: lavarse las manos es lo que más evita contagios. Esa guía es de infecciones respiratorias; aquí se usa como medida general.)
- Normalmente la diarrea se quita en 5 a 7 días y el vómito en 1 o 2 días (NHS).

**(c) Regresar si:** no puede retener líquidos, aparece sangre, tiene mucha sed, orina muy poco, la diarrea dura más de 7 días o el vómito más de 2.

**(d) Frases:** agregar a `diarrea`: "chorrillo", "soltura", "suelto del estómago", "anda suelto". A `vomito`: "bascas", "devuelve todo". "vómito verde" es una frase nueva (bilis).

---

### 4.5 Agruras (acidez)

**(a) Señales de alarma**

| ID propuesto | Nivel | Pregunta Sí/No | Fuente | Fidelidad | ¿Existe? |
|---|---|---|---|---|---|
| corazón | (existe) | ¿El ardor o dolor es **en el pecho**, como peso u opresión, o se va a los brazos, la espalda, el cuello o la quijada? → `CDC-HEART-01` | NHS feeling-sick, 999: "chest pain that feels tight or heavy", "spreads to your arms, back, neck or jaw" | (existe) | Sí. **Recomendación:** que "agruras" en un adulto haga siempre la pregunta de `dolor_pecho` (el umbral de edad queda sin fuente: D13) |
| embarazo | (existe) | Embarazada con dolor en la boca del estómago → `NOM007-EMB-07` | — | (existe) | Sí |
| `NHS-HB-01` | consulta | ¿Siente que **la comida se le atora** al tragar, vomita seguido o está bajando de peso? | NHS heartburn, "See a GP": "food getting stuck in your throat, frequently being sick, or losing weight" | adaptado | **No** |
| `consulta` | consulta | Tiene agruras casi todos los días o no mejora con los cuidados | NHS heartburn, "See a GP" | adaptado | No |
| sangre | (existe) | Vómito con sangre o como café molido, popó negra → `IITT-Y-BLEED-01` | — | — | Sí |

**(b) Cuidados en casa** (NHS heartburn)
- "Coma porciones pequeñas, más veces al día."
- "No coma en las 3 o 4 horas antes de dormir."
- "Evite lo que le cae mal (por ejemplo la salsa o el picante), el alcohol y el cigarro." (El ejemplo de la salsa verde viene del DEM *agruras*. Es solo un ejemplo de habla, no una recomendación clínica.)
- "No use ropa apretada en la cintura."
- "Levante la cabecera de la cama de 10 a 20 cm (con bloques o libros). No ponga más almohadas."
- "Si tiene sobrepeso, bajar de peso ayuda."

**(c) Regresar si:** el dolor pasa al pecho o se va al brazo o la quijada (ir de inmediato), le cuesta tragar, vomita sangre o empeora.

**(d) Frases (nueva clave `agruras`):** "agruras", "acidez", "ardor en el estómago", "le regresa lo agrio", "le sube el ácido", "reflujo". Ya existe "ardor en la boca del estómago" en `dolor_epigastrio`. **Cuidado:** `dolor_epigastrio` dispara `NOM007-EMB-07` en el embarazo. Está bien así, pero en un hombre no debe salir texto de embarazo.

---

### 4.6 Náusea (ganas de vomitar)

**(a) Señales de alarma**

| ID | Nivel | Pregunta | Fuente | ¿Existe? |
|---|---|---|---|---|
| corazón | urgencia | Náusea **de repente** con dolor u opresión en el pecho, dolor que se va al brazo, la espalda, el cuello o la quijada, o falta de aire → `CDC-HEART-01` / `IITT-R-RESP-01` | NHS feeling-sick, 999 | Sí |
| vomita todo | centro_hoy | `IITT-Y-CIRC-01` | — | Sí |
| `consulta` | consulta | La náusea dura más de unos días o regresa seguido | NHS feeling-sick, "See a GP" | No |

**(b) Cuidados en casa** (NHS feeling-sick, "Do")
- "Tome aire fresco. Distráigase (por ejemplo, con música)."
- "Tome traguitos de algo frío. Puede tomar té de jengibre o de menta."
- "Coma porciones pequeñas, más veces al día."
- "Evite olores fuertes, comida caliente, frita o grasosa, comer rápido y acostarse justo después de comer."

**(d) Frases:** `nauseas` ya existe. Agregar "basca", "bascas", "asco", "ganas de devolver", "revuelto el estómago".

---

### 4.7 Dolor de cabeza (sin embarazo)

**(a) Señales de alarma** (casi todas existen; se agregan 2)

| ID | Nivel | Pregunta | Fuente | ¿Existe? |
|---|---|---|---|---|
| `CDC-STROKE-01` | urgencia | Dolor de cabeza **repentino y muy fuerte**, o con cara chueca, debilidad de un lado o dificultad para hablar | CDC_STROKE (repo); NHS headaches 999 "Sudden, severe headache" | Sí |
| `IITT-R-NEURO-01` / `IMCI-FEV-01` | urgencia | Con calentura y cuello tieso, o confusión | NHS headaches 999 (fiebre alta y cuello tieso); IITT | Sí |
| `GEN-CONV-01` | urgencia | Con convulsiones | NHS headaches 999 "seizures" | Sí |
| `NHS-HA-TRAUMA-01` | urgencia | ¿Le empezó el dolor de cabeza **después de un golpe en la cabeza**? | NHS headaches, 999: "recent head injury" | adaptado. **No** (hoy solo existe "golpe fuerte en la cabeza" en `trauma_grave`) |
| `NICE-FEV-RASH-01` | urgencia | Con manchas que no se borran al apretar | NHS headaches 999 "non-fading rash" | Sí |
| `IITT-Y-VISION-01` | centro_hoy | Ve borroso o pierde la vista | NHS headaches 111 "vision problems" | Sí |
| `NHS-HA-01` | centro_hoy | ¿El dolor de cabeza viene **con vómito**? | NHS headaches, urgente (111): "vomiting" | adaptado. **No** |
| `NHS-HA-02` | centro_hoy | Con dolor de cabeza: ¿le duele la quijada al masticar? | NHS headaches, 111: "jaw pain when eating" | adaptado. **No**. **Nota:** la NHS no pone edad. Limitarlo a una edad sería una propuesta sin fuente [DECIDIR D6]; mientras no se decida, **aplicar a cualquier edad** |
| dengue | (existe) | Fiebre + dolor de cabeza o detrás de los ojos + dolor de cuerpo → `PAHO-DEN-03` (`centro_hoy`) | PAHO_DENGUE_2020 (repo) | Sí. Recomendación: en zonas con dengue, si hay dolor de cabeza preguntar siempre "¿ha tenido calentura en estos días?" |
| embarazo | (existe) | `NOM007-EMB-02`, `IMSS-EMB-01` | — | Sí. Preguntar solo a mujeres |
| `consulta` | consulta | Le duele la cabeza seguido, o no mejora con los cuidados | NHS headaches, "See a GP" | No |

**(b) Cuidados en casa** (NHS headaches)
- "Tome bastante agua. Descanse, sobre todo si también tiene gripa."
- "Trate de relajarse: el estrés empeora el dolor de cabeza."
- "No se salte comidas. Descanse los ojos de pantallas."

**(c) Regresar de inmediato si:** el dolor se vuelve repentino y muy fuerte, aparece calentura con cuello tieso, confusión, convulsiones, debilidad, ve borroso o vomita.

**(d) Frases:** ya están "jaqueca" y "cefalea". Agregar "dolor de cabeza después del golpe", "se pegó en la cabeza y le duele", "le duele la quijada al comer".

---

### 4.8 Gripa, catarro y tos en adultos y niños mayores

**(a) Señales de alarma**

| ID | Nivel | Pregunta | Fuente | Fidelidad | ¿Existe? |
|---|---|---|---|---|---|
| respiración | urgencia | Dificultad para respirar, labios morados, estridor → `IITT-R-RESP-01`, `GEN-CYAN-01`, `GEN-STRIDOR-01` | NHS cough (urgente); IMSS_062 p. 5 "obstrucción de vía aérea superior / inferior" | (existe) | Sí |
| pecho | urgencia | Dolor de pecho (12 años o más) → `CDC-HEART-01` | NHS common-cold "chest pain" | (existe) | Sí |
| `IMSS062-ALARM-01` | urgencia | (De 3 meses a 18 años) ¿Tiene **vómito que no para**, **orina mucho menos** de lo normal, o está **muy dormido o confundido**? | IMSS_062 p. 5 "signos de alarma" (síntomas neurológicos, alteración en el volumen urinario, vómito persistente, exantema petequial) y p. 7: "Referir al servicio de urgencias… datos de alarma" | adaptado (la promotora pregunta, no explora) | Parcial (confusión y petequias existen; vómito persistente y orina con IVAS no) |
| `NHS-COUGH-01` | centro_hoy | ¿Escupe o tose **sangre**? | NHS cough, urgente: "you're coughing up blood"; NOM_006 3.15 (hemoptisis) | adaptado | **No** |
| `NOM006-TB-01` | centro_hoy [DECIDIR D5] | ¿Tiene tos **con flema desde hace 2 semanas o más**? | NOM_006 3.15 "Caso probable de tuberculosis pulmonar": "tos con expectoración o hemoptisis, de dos o más semanas" | adaptado (la NOM define el caso, no la urgencia) | Para menores de 5 años ya existe `IMCI-RESP-04`. Para mayores, **No** |
| `NOM006-TB-02` | centro_hoy [D5] | **Niño:** ¿tiene tos (con o sin flema) desde hace 2 semanas o más, con calentura, sudor en la noche o baja de peso? | NOM_006 3.15 (niñas y niños) | adaptado | Parcial |
| `IMSS062-FIEB3D-01` | centro_hoy [DECIDIR D7] | ¿Tiene calentura **desde hace más de 3 días**? | IMSS_062 p. 7: "La fiebre persista durante más de 3 días" → nueva valoración médica; NHS common-cold: "high temperature for more than 3 days" | adaptado | **No** (en menores de 5 años, `IMCI-FEV-02` usa 7 días) |
| `IMSS062-WORSE-01` | centro_hoy | ¿Empeoró o le salieron síntomas nuevos después de 3 a 5 días? | IMSS_062 p. 7 | adaptado | **No** |
| `consulta` | consulta | Tos de más de 3 semanas sin flema; no mejora en 7 a 10 días; baja de peso; defensas bajas | NHS cough "See a GP" (más de 3 semanas); IMSS_062 p. 7 (7 a 10 días) | adaptado | No |

**(b) Cuidados en casa** (NHS common-cold, cough; IMSS_062 p. 4 y 6)
- "Descanse y tome muchos líquidos."
- "Para la garganta: haga gárgaras con agua tibia con sal (solo adultos y niños grandes que sepan hacer gárgaras)."
- "Puede tomar agua tibia con limón y miel. **No le dé miel a bebés menores de 1 año.**" (NHS cough)
- "Lávese las manos seguido y tape la tos con el brazo. Evite el contacto con otras personas enfermas." (IMSS_062 p. 4)
- "La gripa no se cura con antibiótico." (IMSS_062 p. 6 y NHS: no se recomiendan antimicrobianos en el resfriado común)
- La gripa mejora en 1 a 2 semanas; la tos puede durar 3 a 4 semanas (NHS).
- **Excluido a propósito:** la inhalación de vapor (NHS common-cold). Hay riesgo de quemaduras con agua hirviendo en casa (decisión editorial; la Dra. Ines decide).

**(d) Frases:** "gripa", "catarro", "resfriado", "flemas", "echa flemas", "tos con flema", "carraspera", "escupe sangre", "tose sangre", "le salió sangre al toser".

---

### 4.9 Dolor de garganta ("anginas")

**(a) Señales de alarma**

| ID | Nivel | Pregunta | Fuente | Fidelidad | ¿Existe? |
|---|---|---|---|---|---|
| `NHS-THROAT-01` | urgencia | ¿**No puede tragar** ni su saliva (se le escurre la baba) o le cuesta respirar? | NHS sore-throat, 999: "unable to swallow", "drooling" | verbatim | **No** (estridor y respiración sí existen) |
| estridor | urgencia | `GEN-STRIDOR-01` | NHS sore-throat 999 "high-pitched sound" | (existe) | Sí |
| `IITT-Y-NECK-01` | centro_hoy | ¿Tiene **hinchazón o bola** en la boca, la garganta o el cuello? | IITT ≥12 y <12, amarillo: "Any swelling/mass of mouth, throat or neck" | verbatim | **No** |
| `IMSS062-STREP-01` | centro_hoy | ¿Tiene calentura **y** placas blancas o pus en las anginas, o bolitas dolorosas en el cuello, **sin** tos? | IMSS_062 p. 4 (sospecha de faringoamigdalitis estreptocócica: fiebre, exudado, adenopatía anterior dolorosa, ausencia de tos); p. 6: "tratamiento antimicrobiano inmediato" | adaptado (necesita médico) | **No** |
| `consulta` | consulta | Dura más de 7 días, le da seguido, o tiene una llaga o bolita que dura más de 3 semanas | NHS sore-throat | adaptado | No |

**(b) Cuidados en casa** (NHS sore-throat)
- "Haga gárgaras con agua tibia con sal (no en niños pequeños)."
- "Tome bastante agua. Coma cosas frescas o blandas. Descanse."
- Se quita sola en una semana, casi siempre (NHS).

**(d) Frases (nueva clave `dolor_garganta`):** "dolor de garganta", "le duele la garganta", "anginas", "le duelen las anginas", "anginas inflamadas", "placas en la garganta", "garganta con pus", "no puede tragar", "se le escurre la baba". **Cuidado:** "angina de pecho" debe ir a `dolor_pecho` y no a garganta (DEM *angina* acep. 3).

---

### 4.10 Dolor de oído

**(a) Señales de alarma**

| ID | Nivel | Pregunta | Fuente | Fidelidad | ¿Existe? |
|---|---|---|---|---|---|
| `IMCI-EAR-01` | urgencia | ¿Tiene **hinchazón dolorosa detrás de la oreja**? | IMCI_2014 p. 9 del PDF: "Tender swelling behind the ear" → MASTOIDITIS, "Refer URGENTLY" (2 meses a 5 años); NHS earache (urgente): "swelling around the ear" | verbatim (<5 años); adaptado (otras edades) | **No** |
| `IMCI-EAR-02` | centro_hoy | **Menor de 5 años:** ¿le duele el oído o le sale pus? | IMCI_2014 p. 9: "Ear pain" o pus → ACUTE EAR INFECTION (amarillo: antibiótico) | adaptado (amarillo → `centro_hoy`, como en el repo) | **No** |
| `NHS-EAR-01` | centro_hoy | ¿Le sale **líquido o pus** del oído, oye menos, o tiene algo **atorado** en el oído? | NHS earache, urgente: "fluid coming from the ear", "hearing loss", "something stuck in the ear"; IMSS_062 p. 6 (otitis con otorrea → antibiótico) | adaptado | **No** |
| `NHS-EAR-02` | centro_hoy | Niño **menor de 2 años** con dolor en **los dos** oídos | NHS earache, urgente; IMSS_062 p. 6 "Otitis media aguda bilateral en niños menores de 2 años" → antibiótico inmediato | adaptado | **No** |
| calentura | centro_hoy | Con calentura alta o se siente muy mal | NHS earache urgente | adaptado | Lo cubren las reglas de fiebre |
| `consulta` | consulta | No mejora en 2 o 3 días (12 años o más) | NHS earache, "See a GP" | adaptado | No |

**(b) Cuidados en casa** (NHS earache; 12 años o más y sin señales de alarma)
- "Ponga un trapo tibio sobre la oreja."
- "**No** meta nada al oído: ni cotonetes, ni gotas caseras, ni aceite. No intente sacar la cera. No deje que le entre agua."

**(d) Frases (nuevas claves `dolor_oido`, `pus_oido`, `hinchazon_detras_oreja`):** "le duele el oído", "dolor de oído", "le supura el oído", "le sale pus/agua del oído", "le salió una bola detrás de la oreja", "no oye bien", "se le metió algo al oído".

---

### 4.11 Ardor al orinar

**(a) Señales de alarma**

| ID | Nivel | Pregunta | Fuente | Fidelidad | ¿Existe? |
|---|---|---|---|---|---|
| `IMSS077-SIST-01` | urgencia | Con ardor al orinar: ¿está **muy mal**: confundido, muy dormido, no puede hablar bien, o vomita todo? | IMSS_077 p. 6: "Si el paciente tiene síntomas de afección sistémica enviar a hospital"; NHS UTI, 999: "confused, drowsy, or have difficulty speaking" | adaptado | **No** (confusión sola ya es urgencia) |
| `IMSS077-PIELO-01` | centro_hoy | ¿Tiene ardor al orinar **y** calentura, **o** dolor en la espalda debajo de las costillas (a un lado)? | IMSS_077 p. 3 (pielonefritis): "dolor en fosa renal y fiebre mayor de 38°C"; NHS UTI urgente: "pain… in the back, just under the ribs" | adaptado | **No** |
| `NHS-UTI-MALE-01` | centro_hoy | **Hombre** con ardor al orinar | NHS UTI, urgente: "A man" | adaptado | **No** |
| `NHS-UTI-01` | centro_hoy | ¿Tiene **sangre en la orina**, diabetes, o 65 años o más? | NHS UTI, urgente: "blood in your pee", diabetes, "aged 65 or older" | adaptado | **No** |
| `IMSS077-CIST-01` | centro_hoy | **Mujer no embarazada** con ardor al orinar, orinar muy seguido o urgencia para orinar | IMSS_077 p. 3: con estos síntomas, "no realizar ninguna prueba diagnóstica, e iniciar tratamiento" (antibiótico con receta) | adaptado (la promotora no da antibiótico) | **No** |
| embarazo | (existe) | `IMSS-EMB-04` | — | (existe) | Sí. Preguntar solo a mujeres |
| no orina | (existe) | `IITT-Y-URINE-01` | — | — | Sí |
| niños | — | Menor de 5 años con ardor al orinar: **no se investigó** (no verificado). Usar fiebre y AIEPI | — | — | — |

**(b) Cuidados mientras llega a la consulta** (NHS UTI)
- "Tome suficientes líquidos para que la orina salga clarita durante el día. Descanse."
- "Evite el café y el alcohol."

**(c) Regresar de inmediato si:** le da calentura, dolor de espalda a un lado, vómito, o se pone confundido.

**(d) Frases:** ya existen "ardor al orinar", "le arde al hacer pipí", "mal de orín". Agregar "orina con sangre", "pipí con sangre", "orina turbia", "dolor de riñón" (preguntar **dónde**: espalda debajo de las costillas = fosa renal), "orina a cada rato".

---

### 4.12 Dolor de espalda baja ("dolor de cintura")

**(a) Señales de alarma**

| ID | Nivel | Pregunta | Fuente | Fidelidad | ¿Existe? |
|---|---|---|---|---|---|
| `IMSS045-CAUDA-01` | urgencia | Con dolor de espalda: ¿**no puede orinar o no controla la orina o la popó**, o tiene **adormecida la entrepierna o las nalgas**, o **se le debilitaron las dos piernas**? | IMSS_045 p. 6: cauda equina, "retención urinaria… anestesia en silla de montar", "dolor en ambas piernas, déficit sensitivo-motor"; NHS back-pain, 999 (adormecimiento genital o anal, debilidad de ambas piernas, cambios al orinar o evacuar) | adaptado | **No** |
| trauma | urgencia | Después de un accidente grave → `IITT-R-TRAUMA-01` | NHS back-pain 999 "serious trauma"; IMSS_045 p. 4 "traumatismo previo" | (existe) | Sí |
| pecho | urgencia | Con dolor de pecho → `CDC-HEART-01` | NHS back-pain 999 | (existe) | Sí |
| `IMSS045-FIEBRE-01` | centro_hoy | ¿Tiene dolor de espalda **con calentura**? | IMSS_045 p. 4 (signo de alarma "fiebre"); NHS back-pain urgente: "feverish and unwell" | adaptado | **No** |
| `NHS-BACK-01` | centro_hoy | ¿El dolor empezó **de repente y muy fuerte**, o empeora muy rápido? | NHS back-pain, urgente | adaptado | **No** |
| fosa renal | centro_hoy | Dolor a un lado debajo de las costillas con ardor al orinar o calentura → `IMSS077-PIELO-01` | IMSS_077 p. 3 | adaptado | No |
| `consulta` | consulta | Mayor de 50 años con dolor nuevo; ha tenido cáncer; baja de peso; dolor en reposo o en la noche; usa esteroides o tiene osteoporosis; no mejora en 4 a 6 semanas | IMSS_045 p. 3 ("edad > 50 años, antecedente de cáncer, pérdida de peso, no mejoría después de 4-6 semanas… dolor en reposo y nocturno") y p. 4 | adaptado | No |

**(b) Cuidados en casa** (IMSS_045 p. 8. **NOM/GPC mexicana > NHS** en el punto del frío)
- "Siga moviéndose y haciendo sus actividades normales como el dolor se lo permita. Así se recupera más rápido." (IMSS_045 p. 8: los pacientes que se mantienen activos se recuperan antes)
- "**No** se quede acostado más de 2 o 3 días: no ayuda y puede empeorar." (IMSS_045 p. 8: "el reposo por más de 2 o 3 días es inefectivo e incluso dañino")
- "Puede ponerse **calor** (un trapo o compresa tibia) en la espalda." (IMSS_045 p. 8)
- **No** recomendar frío: la IMSS_045 p. 8 dice "La aplicación de frío local no se recomienda". La NHS sí lo acepta; **gana la GPC mexicana.** Tampoco recomendar faja: "Las fajas lumbares no están recomendadas" (p. 8).

**(d) Frases (nueva clave `dolor_espalda_baja`):** "dolor de cintura", "le duele la cintura", "dolor de espalda baja", "dolor de la espalda", "lumbago", "se lastimó la espalda", "dolor de riñones" (ambiguo: preguntar si es abajo en el centro o a un lado debajo de las costillas). Para la señal de alarma (`cauda_equina`): "no siente la entrepierna", "se le duermen las nalgas", "no puede orinar", "se hace del baño sin sentir", "no puede mover las dos piernas".

---

### 4.13 Dolor de muela

**(a) Señales de alarma**

| ID | Nivel | Pregunta | Fuente | Fidelidad | ¿Existe? |
|---|---|---|---|---|---|
| `NHS-TOOTH-01` | urgencia | ¿Se le **hinchó alrededor del ojo o el cuello**, o la hinchazón no lo deja **respirar, tragar o hablar**? | NHS toothache, A&E/999: "the area around your eye or your neck is swollen"; "difficult… to breathe, swallow or speak" | verbatim | **No** |
| `IITT-Y-NECK-01` | centro_hoy | ¿Tiene la **cara, la quijada o la encía hinchada**? | IITT amarillo "Any swelling/mass of mouth, throat or neck"; NHS toothache: hinchazón de la mejilla o la quijada → dentista | adaptado | **No** |
| `NHS-TOOTH-02` | centro_hoy | ¿Dolor de muela **con calentura**? | NHS toothache: fiebre → dentista; IITT | adaptado | **No** |
| `consulta` | consulta (dentista) | El dolor dura más de 2 días; encías rojas; mal sabor | NHS toothache, "See a dentist" | adaptado | No |

**(b) Cuidados en casa** (NHS toothache)
- "Enjuáguese la boca con agua con sal."
- "Coma cosas blandas y mastique del otro lado."
- "Evite lo muy dulce, muy caliente o muy frío. Use un cepillo suave."
- "Busque al dentista lo antes posible."

**(d) Frases (nueva clave `dolor_muela`):** "dolor de muela", "le duele una muela", "muela picada", "dolor de dientes", "se le hinchó la cara por la muela", "tiene un absceso". **Ojo:** hoy "cara hinchada" va a `hinchazon_cara_manos` (clave del embarazo). En un hombre, o si se menciona la muela, debe ir a la nueva clave `hinchazon_boca_cuello`.

---

### 4.14 Ronchas, comezón y salpullido

**(a) Señales de alarma**

| ID | Nivel | Pregunta | Fuente | Fidelidad | ¿Existe? |
|---|---|---|---|---|---|
| `NHS-ANAPH-01` | urgencia [DECIDIR D8] | ¿Se le hincharon **de repente los labios, la boca, la lengua o la garganta**, o le cuesta respirar? | NHS hives, 999: "lips, mouth, throat or tongue suddenly become swollen"; NHS insect-bites, 999 (anafilaxia) | adaptado (el IITT pone la hinchazón de boca o garganta en amarillo; la NHS la pone en 999) | **No** |
| `IITT-Y-RASH-01` | centro_hoy | ¿Le salió una erupción **nueva que empeora en horas**, o la piel **se está pelando**? | IITT ≥12 y <12, amarillo: "New rash worsening over hours or peeling" | verbatim | **No** |
| fiebre + manchas | urgencia o centro_hoy | `NICE-FEV-RASH-01`, `IMCI-MEAS-01`, `PAHO-DEN-03` | repo | (existe) | Sí |
| `NHS-HIVES-01` | centro_hoy | ¿Las ronchas **no mejoran en 2 días**, se extienden, o tiene calentura y se siente mal? | NHS hives, urgente (111): no mejora en 2 días, se extiende, fiebre | adaptado | **No** |
| `consulta` | consulta | Le salen ronchas seguido | NHS hives | adaptado | No |

**(b) Cuidados en casa** (NHS insect-bites para piquetes; NHS hives)
- "Si fue un piquete: lave con agua y jabón y ponga algo frío envuelto en un trapo por unos 20 minutos. Si es en un brazo o pierna, súbalo."
- "No se rasque." 
- "Si sabe qué se lo provocó (una comida, una planta, un animal), evítelo."
- Las ronchas suelen quitarse en unos días (NHS hives).

**(d) Frases:** "ronchas", "comezón", "le pica todo", "salpullido", "le salieron granos", "se le hinchó la boca", "se le hinchó la lengua", "se le cerró la garganta", "se le está pelando la piel", "jiotes" (manchas con escamas; por sí solos no son alarma). **Ojo:** hoy "ronchas" va a `sarpullido` (grupo fiebre). Recomendamos separar `ronchas_comezon` (sin fiebre) de `sarpullido` (con fiebre), para que unas ronchas sin fiebre no activen preguntas de sarampión o dengue.

---

### 4.15 Cortadas y heridas

**(a) Señales de alarma**

| ID | Nivel | Pregunta | Fuente | Fidelidad | ¿Existe? |
|---|---|---|---|---|---|
| `GEN-BLEED-01` | urgencia | ¿Sangra mucho, sale **a chorros** o no para aunque apriete? | NHS cuts-and-grazes, 999: no se controla el sangrado, "blood spurts"; IITT rojo "Heavy bleeding" | (existe) | Sí ("chorro de sangre" ya es sinónimo) |
| `NHS-WOUND-01` | urgencia | ¿Tiene **algo clavado** en la herida, o **se le durmió o no puede mover** la parte de abajo de la herida? | NHS cuts-and-grazes, 999/A&E: objeto incrustado, entumecimiento o pérdida de movimiento; IITT rojo "Threatened limb" (tarjeta: "pale, weak, numb") | adaptado | **No** |
| `NHS-WOUND-02` | centro_hoy | ¿La herida es **profunda o larga** (más de 5 cm, como 3 dedos), está **en la cara o en la palma** de la mano, o quedó **sucia** (tierra) aunque la lavó? | NHS cuts-and-grazes, urgente: más de 5 cm, sucia; 999: cortada grave de la cara o la palma | adaptado | **No** |
| `NHS-WOUND-03` | centro_hoy | ¿La herida está **roja, caliente, hinchada, con pus**, o tiene calentura? | NHS cuts-and-grazes, urgente: signos de infección, fiebre | adaptado | **No** |
| `NHS-TETANUS-01` | centro_hoy | ¿Hace **más de 10 años** de su última vacuna contra el tétanos, o no sabe? (herida sucia o mordida) | NHS animal-and-human-bites, 111: tétanos sin vacuna en 10 años; SSA_RABIA_GUIA p. 19 (aplicar toxoide tetánico Td en la unidad) | adaptado | **No** |
| embarazo | (existe) | `IITT-R-PREG-TRAUMA-01` | — | — | Sí |

**(b) Cuidados en casa** (NHS cuts-and-grazes)
- "Apriete con un trapo limpio hasta que pare de sangrar. Si es en un brazo o pierna, súbalo más arriba del corazón. Si el trapo se moja, ponga otro encima, sin quitar el primero."
- "Lave la herida con agua limpia de la llave o embotellada. Seque dando golpecitos con un trapo limpio y tápela con una gasa o curita limpia."
- "Mantenga la herida limpia y seca. Cambie la gasa cuando se moje o se ensucie."
- **No** poner tierra, café, pasta de dientes ni remedios en la herida. (El "no" general viene de la OMS para quemaduras, WHO_BURNS_FS: "Do not apply any material directly to the wound". **Para heridas no se encontró la misma frase en una fuente: no verificado.** Se deja como propuesta para la Dra. Ines.)

**(d) Frases (nueva clave `herida`):** "cortada", "se cortó", "se rajó", "raspón", "se descalabró", "machetazo" (ya es `trauma_grave`), "se enterró un clavo", "tiene algo clavado", "se le durmió el dedo".

---

### 4.16 Quemaduras

**(a) Señales de alarma**

| ID | Nivel | Pregunta | Fuente | Fidelidad | ¿Existe? |
|---|---|---|---|---|---|
| `IITT-R-BURN-01` | urgencia | ¿La quemadura está en la **cara o el cuello**, **o** le da la vuelta completa a un brazo, pierna o al cuerpo, **o** respiró humo o fuego, **o** es un bebé menor de 2 años o una persona mayor de 70? (y, si la promotora sabe calcularlo, más del 15 % del cuerpo) | Tarjeta de referencia IITT "Major Burns": ">15% body surface area", "Circumferential or involving face or neck", "Inhalation injury", "Any burn in age < 2 or age > 70" (quemaduras de espesor parcial o total) | adaptado. **No verificado:** cómo explicarle el 15 % a una promotora (la tarjeta no da un método sencillo). Por eso la pregunta usa solo cara, cuello, vuelta completa, humo y edad | **No** (hoy toda quemadura es `centro_hoy`) |
| `IMSS040-BURN-01` | urgencia | ¿Fue por **electricidad de alta tensión** (cables de luz), o la persona además se golpeó o se lastimó otras partes? | IMSS_040 p. 2 ("Gran quemado": quemaduras eléctricas por alta tensión; asociadas a politraumatismo; quemaduras respiratorias o por inhalación) | adaptado | **No** |
| `NHS-BURN-CHEM-01` | urgencia | ¿Fue por **ácido o químico**, o en los **genitales o las nalgas**? | NHS burns-and-scalds, 999/A&E: "on your face, genitals or bottom", "acid or chemical, or by electricity" | adaptado | **No** |
| `IITT-Y-TRAUMA-01` | centro_hoy | Cualquier otra quemadura | IITT amarillo "Other trauma/burns" | (existe) | Sí |

**(b) Primeros auxilios** (NHS burns-and-scalds; WHO_BURNS_FS)
- "Ponga la quemadura bajo el chorro de agua fresca de la llave por 20 minutos, lo antes posible (en las primeras 3 horas)." (NHS)
- "**No** use hielo: hace más profunda la quemadura." (WHO)
- "Quite la ropa y anillos de cerca de la quemadura, **pero no** lo que esté pegado a la piel." (NHS)
- "**No** ponga pomadas, aceite, mantequilla, pasta de dientes ni remedios. **No** reviente las ampollas." (NHS; WHO)
- "Si es un químico, enjuague con mucha agua." (WHO)
- "Si la quemadura es grande, no la enfríe por mucho tiempo: la persona puede enfriarse demasiado. Tápela con una sábana o trapo limpio y llévela a la unidad." (WHO: "Avoid prolonged cooling… hypothermia"; "Wrap the patient in a clean cloth")
- "Si hay plástico de cocina limpio, póngalo encima sin darle vuelta completa." (NHS: "lay cling film over it… Do not wrap")
- El texto de hoy en `IITT-Y-TRAUMA-01` ("enfriar con agua limpia (no hielo, no pomadas caseras)") es coherente con estas fuentes. Se puede agregar "20 minutos" y "no reventar ampollas".

**(d) Frases:** ya están "se quemó", "se echó agua hirviendo", "con el comal". Agregar "se le levantó ampolla", "le cayó aceite", "se quemó con la estufa / el anafre / la lumbre", "le dio la luz / toques" (eléctrica), "respiró humo".

---

### 4.17 Picadura de alacrán (**prioridad 1: hoy da `aqui`**)

**(a) Señales de alarma**

| ID | Nivel | Pregunta | Fuente | Fidelidad | ¿Existe? |
|---|---|---|---|---|---|
| `SSA-ALAC-01` | **urgencia** | **Niño menor de 5 años** al que le picó un alacrán, **aunque no tenga síntomas** | DGE_ALACRAN_2012 p. 33 del PDF (impresa 31): "más del 80 % de las defunciones… en menores de 5 años"; "recomendable aplicar una dosis de suero antialacrán… en todo menor de cinco años… presente, o no presente, síntomas"; SSA_IAVYS_2026 p. 13: en menores de 5 años con intoxicación moderada, antídoto "de forma inmediata" y traslado a segundo nivel | adaptado (la fuente indica antídoto inmediato; en Pahtli = traslado ya) | **No** |
| `SSA-ALAC-02` | **urgencia** | Le picó un alacrán y tiene **cualquiera** de estos: **mucha saliva o baba**, **sensación de algo atorado en la garganta**, **ojos que se mueven solos**, **la lengua le tiembla**, **le falta el aire**, **sudor abundante**, **vómito**, **ve borroso o ve rojo**, **dolor de pecho**, **la panza se le infla**, **convulsiones** | SSA_IAVYS_2026 p. 10 (cuadro por grados: moderado o grado II = "sensación de cuerpo extraño… sialorrea, diaforesis, nistagmo, fasciculaciones linguales, disnea, distención abdominal"; severo o grado III = "visión de halos rojos, ceguera transitoria, vómitos… dolor retroesternal"); p. 6: "se considera una urgencia médica" | adaptado | **No** |
| `SSA-ALAC-03` | **urgencia** | Le picó un alacrán y es **mayor de 65 años, embarazada**, o tiene **enfermedad del corazón, asma, diabetes, presión alta, enfermedad de los riñones o desnutrición** | SSA_IAVYS_2026 p. 13: grupo con manejo especial ("Mayores de 65 años, mujeres embarazadas y pacientes con cardiopatía, asma…"); p. 29: el promotor "canalizará al paciente a la unidad médica más cercana" | adaptado | **No** |
| `SSA-ALAC-04` | **centro_hoy** | Le picó un alacrán (5 años o más), **solo** tiene dolor, hormigueo o comezón de nariz o garganta | SSA_IAVYS_2026 p. 9: "evaluada por un personal médico de la unidad de salud más cercana"; p. 10 grado I (leve); DGE_ALACRAN_2012 p. 33: observación "no menor a dos horas" | adaptado | **No** |

**Notas para implementar:**
- Los síntomas pueden aparecer **en minutos y hasta 2 horas después** (DGE_ALACRAN_2012 p. 38 del PDF: "desde los primeros minutos hasta las dos horas"). El texto de `SSA-ALAC-04` debe decir: "Llévelo **ahora** a la unidad de salud para que lo revisen y lo observen. Si en el camino aparece babeo, falta de aire, sensación de algo en la garganta u ojos que se mueven solos, es urgencia."
- **Promotores con antídoto:** SSA_IAVYS_2026 p. 28–29 dice que, en comunidades a más de 30 minutos de una unidad, se puede capacitar a promotores para aplicar el antídoto. **Pahtli no debe dar dosis.** Puede decir "Si en su comunidad hay un promotor capacitado con antídoto (suero antialacrán), avísele ya" [DECIDIR D9].
- El dato desconocido no dispara: si no se sabe la edad, preguntar la edad primero (como hace hoy el motor).

**(b) Mientras lo llevan** (fuentes: NHS insect-bites; para "no cortar / no torniquete" ver la nota)
- "Mantenga a la persona tranquila y en reposo." (CENAPRECE_LOXO "Conservar la calma"; está escrito para arañas)
- "Lave el piquete con agua y jabón y ponga algo frío envuelto en un trapo." (NHS insect-bites)
- "**No** corte, no chupe, no ponga torniquete y no use remedios caseros: retrasan la atención." **Fuente:** CENAPRECE_LOXO incisos c) y g), escritos **para arañas**. **Para alacrán no se encontró el mismo texto en una fuente vigente** (la NOM-033 está cancelada): **no verificado para alacrán.** Se propone usarlo igual, porque son medidas de no hacer daño, y marcarlo [DECIDIR D9].

**(d) Frases (nuevas claves `picadura_alacran`, `alacran_sintomas_sistemicos`):** "le picó un alacrán", "piquete de alacrán", "lo picó un escorpión", "alacranazo", "le picó un güero/alacrán güero" (uso regional, no verificado). Síntomas: "se le traba la lengua", "siente como un pelo o una bola en la garganta", "babea mucho", "los ojos se le mueven solos", "le tiembla la lengua", "ve rojo", "se le hinchó la panza".

---

### 4.18 Mordedura de araña (viuda negra o violinista; **hoy da `aqui`**)

| ID | Nivel | Pregunta | Fuente | Fidelidad | ¿Existe? |
|---|---|---|---|---|---|
| `SSA-ARANA-01` | urgencia | ¿Lo mordió una **viuda negra o araña capulina** (negra con una mancha roja) o una **araña violinista** (café, araña del rincón)? | SSA_IAVYS_2026 p. 6 ("se considera una urgencia médica") y p. 20 (el loxoscelismo "debe ser considerada una urgencia médica"); CENAPRECE_LOXO b) "acudir lo más pronto posible a la unidad de salud más cercana" | adaptado | **No** |
| `SSA-ARANA-02` | urgencia | Lo mordió una araña (no sabe cuál) y tiene **dolor fuerte que sube por el brazo o la pierna**, **calambres o la panza dura**, **mucho sudor**, **dolor de pecho**, o la mordida se pone **morada o negra con ampolla**, o **orina oscura o casi no orina** | SSA_IAVYS_2026 p. 15–16 (latrodectismo: dolor que se irradia por la extremidad, dolor abdominal o torácico, contracturas, diaforesis), p. 19 (loxoscelismo: lesión "roja, blanca y azul", vesícula hemorrágica; forma sistémica: hemoglobinuria, oliguria) | adaptado | **No** |
| `centro_hoy` | centro_hoy | Mordida de una araña desconocida, sin ninguno de esos síntomas | **No verificado** (ninguna fuente leída da un nivel para una araña desconocida sin síntomas). Proponemos `centro_hoy` porque la mordida de violinista puede no doler al principio (SSA_IAVYS_2026 p. 19: "puede ser indolora y pasar desapercibida") [DECIDIR D10] | — | No |

**Mientras lo llevan** (CENAPRECE_LOXO, incisos a–j)
- "Conserve la calma. Lávele con agua y jabón. Póngale hielo envuelto. Si es en un brazo o pierna, súbalo arriba del corazón. Que no se mueva de más."
- "**No** corte, no pique la piel, no ponga torniquete, **no** use remedios caseros ni desinfectantes de color (tapan cómo se ve la herida)."
- "Si se puede, atrape la araña en un frasco (con pinzas, sin tocarla) y llévela."

**Frases:** "lo mordió una araña", "viuda negra", "araña capulina", "araña del trasero rojo/colorado", "casampulga", "cintlatlahua", "araña violinista", "araña del rincón", "araña café", "araña reclusa".

---

### 4.19 Mordedura de perro, gato o murciélago (rabia)

Ya existe `IITT-Y-BITE-01` (`centro_hoy`). Se proponen el texto de primeros auxilios y la clasificación de riesgo.

| ID | Nivel | Pregunta | Fuente | ¿Existe? |
|---|---|---|---|---|
| `IITT-Y-BITE-01` | centro_hoy | Mordida, rasguño o lamida en una herida, de perro, gato, murciélago u otro animal | IITT amarillo "Exposure requiring time-sensitive prophylaxis (eg. animal bite)"; SSA_RABIA_GUIA p. 22–23 (impresa 21–22): riesgo **leve** = lamida en piel con herida, o mordida superficial en tronco o piernas; riesgo **grave** = mordida en "cabeza, cara, cuello ó en miembros superiores", mordidas "profundas o múltiples", saliva en ojos, nariz o boca | Sí |
| texto | (mismo nivel) | Riesgo grave (cabeza, cara, cuello, manos o brazos, varias mordidas o profundas, murciélago o animal del monte): "Dígale a la unidad que es mordida **grave**; puede necesitar inmunoglobulina además de la vacuna." | SSA_RABIA_GUIA p. 23–24 (riesgo grave: inmunoglobulina y vacuna) y p. 33 (murciélago, zorrillo, coyote, puma y mapache "en su hábitat"… = "riesgo grave") | Agregar al texto (no cambia el nivel) |
| sangrado | urgencia | Sangra mucho → `GEN-BLEED-01`; herida grande o profunda → NHS animal-bites A&E | NHS animal-and-human-bites, A&E: "the wound is large or deep", "cannot stop the bleeding" | Parcial |

**Primeros auxilios** (SSA_RABIA_GUIA p. 18, impresa 17, "IV. Atención médica inmediata")
- "Lave la herida **con agua y jabón, a chorro, durante 10 minutos**, frotando con cuidado." (Guía: "jabón, agua a chorro durante 10 minutos")
- "Si la saliva cayó en los ojos, la nariz o la boca, enjuague con mucha agua por 5 minutos." (Guía p. 18: mucosas "durante 5 minutos"; la guía dice "solución fisiológica"; en casa, agua limpia. Esto es adaptado)
- "Tape con un trapo limpio y vaya **hoy** a la unidad de salud."
- "Si el perro o gato tiene dueño, pida que lo tengan encerrado y lo vigilen. **No lo maten**: la unidad necesita saber si sigue sano en los próximos 10 días." (SSA_RABIA_GUIA p. 21–22: observación del perro por 10 días)
- "Pregunte si el animal está vacunado contra la rabia y lleve el comprobante." (p. 20)

**Frases:** ya existen. Agregar "lo mordió un perro callejero", "lo lamió un perro en una herida", "entró un murciélago al cuarto", "lo mordió un zorrillo / mapache / coyote", "lo rasguñó un gato".

---

### 4.20 Caídas y golpes

**(a) Señales de alarma**

| ID | Nivel | Pregunta | Fuente | Fidelidad | ¿Existe? |
|---|---|---|---|---|---|
| `IITT-R-TRAUMA-01` | urgencia | Golpe o accidente grave | IITT tarjeta "High-Risk Trauma": "Fall from twice person's height", atropellado, salió del vehículo, herida penetrante, varias partes del cuerpo, embarazada, **"bleeding disorder or on anticoagulation"** | (existe) | Sí. **Agregar sinónimos y una pregunta:** "¿toma medicina para adelgazar la sangre?" (anticoagulante) |
| `NHS-HEAD-01` | urgencia | Después de un **golpe en la cabeza**: ¿se desmayó y no despierta, **no puede mantenerse despierto**, tuvo **convulsión**, **ve o escucha mal**, le sale **agua clara o sangre por los oídos o la nariz**, o se cayó de **más de 1 metro o 5 escalones**? | NHS head-injury, "Call 999 if": "knocked out and has not woken up", "cannot stay awake", "fit (seizure)", "fallen from a height of more than 1 metre or 5 stairs", "problems with their vision or hearing", "clear fluid coming from their ears or nose", "bleeding from their ears" | verbatim (lista) | Parcial (convulsiones, inconsciente) |
| `NHS-HA-TRAUMA-01` | urgencia | Dolor de cabeza después del golpe | NHS headaches 999 "recent head injury" | adaptado | **No** |
| `NHS-HEAD-02` | centro_hoy | Después del golpe en la cabeza: ¿está **vomitando**, **mareado**, o toma medicina para adelgazar la sangre? | NHS head-injury, 111: "being sick (vomiting)", "feel dizzy", blood-thinning medication | adaptado. **Nota:** el IITT pone los anticoagulantes en trauma de alto riesgo (rojo). Proponemos `urgencia` si toma anticoagulante [D11] | **No** |
| `IITT-R-LIMB-01` | urgencia | ¿El brazo o la pierna lastimados están **pálidos, fríos, dormidos, sin fuerza o muy hinchados**? | IITT tarjeta "Threatened Limb": "Painful and one of: pale, weak, numb, or with massive swelling after trauma" | verbatim | **No** |
| `IITT-Y-TRAUMA-01` | centro_hoy | Posible hueso roto o miembro chueco | IITT | (existe) | Sí |
| embarazo | urgencia | `IITT-R-PREG-TRAUMA-01` | — | (existe) | Sí |

**(b) Cuidados en casa** (golpe en la cabeza leve, sin señales; NHS head-injury)
- "Póngase hielo envuelto en un trapo sobre el chichón, varias veces al día."
- "Descanse. Un adulto debe **quedarse con la persona por lo menos las primeras 24 horas**."
- "No tome alcohol. No maneje hasta sentirse bien."
- "Los síntomas pueden durar hasta 2 semanas. Si duran más, vaya a consulta."

**(d) Frases:** "se cayó", "se pegó en la cabeza", "chichón", "chipote", "se descalabró", "se cayó de la escalera / del techo / del árbol / del caballo", "le sale agua por la nariz", "le sale sangre del oído", "toma medicina para la sangre / anticoagulante".

---

### 4.21 Mareo

**(a) Señales de alarma**

| ID | Nivel | Pregunta | Fuente | ¿Existe? |
|---|---|---|---|---|
| derrame | urgencia | Mareo **de repente** con cara chueca, debilidad de un lado, dificultad para hablar, pérdida del equilibrio o de la vista → `CDC-STROKE-01` | CDC_STROKE (repo); NHS dizziness | Sí |
| corazón | urgencia | Con dolor de pecho → `CDC-HEART-01` | NHS feeling-sick | Sí |
| desmayo | centro_hoy | Se desmayó o casi se desmaya → `IITT-Y-FAINT-01` | IITT amarillo "Recent fainting" | Sí. Agregar "vahído" (DEM) |
| azúcar | ver 4.22 | Diabético con mareo, sudor frío, temblor → `NOM015-HIPO-*` | NOM_015 3.41 | No |
| dengue | (existe) | Con calentura reciente, mareo al pararse → `PAHO-DEN-01` | repo | Sí |
| embarazo | (existe) | — | — | Sí |
| `consulta` | consulta | Mareo que no se quita, empeora, o viene con sordera o zumbido | NHS dizziness, "See a GP" | No |

**(b) Cuidados en casa** (NHS dizziness)
- "Acuéstese hasta que se le pase y luego levántese despacio."
- "Tome bastante agua."
- "Evite movimientos bruscos o agacharse rápido. No maneje ni se suba a lugares altos mientras esté mareado."

**(d) Frases (nueva clave `mareo`, sin nivel propio):** "mareo", "mareado", "todo le da vueltas", "se le va la cabeza", "vahído", "le dio un vahído" (→ `desmayo`).

---

### 4.22 Diabético que se siente mal

| ID | Nivel | Pregunta | Fuente | Fidelidad | ¿Existe? |
|---|---|---|---|---|---|
| `NOM015-HIPO-01` | urgencia | Persona con diabetes que **no despierta, está confundida o tiene convulsiones** | NOM_015 11.11.8.5: con "pérdida del estado de alerta"… "llevar con urgencia al paciente al segundo nivel"; IITT rojo "Hypoglycaemia" | adaptado | Lo cubren `GEN-UNC-01` y `GEN-CONV-01`. Falta el texto: **"no le dé nada de comer ni de beber, acuéstelo de lado"** (NHS low-blood-sugar: "Do not give them any food or drink"; NOM_015 11.11.8.5: "cabeza volteada hacia un lado") |
| `NOM015-HIPO-02` | centro_hoy | Persona con diabetes **despierta** que tiene **sudor frío, tiembla, tiene mucha hambre, el corazón acelerado, ve borroso o se siente muy débil** | NOM_015 3.41 (hipoglucemia: "sudoración fría, temblor, hambre, palpitaciones y ansiedad" o "visión borrosa, debilidad, mareos"); 11.11.8.4 (carbohidratos líquidos si está consciente); 12.1.3 y 12.1.4 (hipoglucemia severa o frecuente → referencia) | adaptado | **No** |
| `NOM015-HIPO-03` | urgencia | Igual que la anterior, pero **no mejora** después de tomar algo dulce, o se va poniendo adormilado | NOM_015 11.11.8.4 ("pudiendo llegar a ser necesario repetir") y 11.11.8.5; NHS low-blood-sugar (revisar a los 10–15 minutos) | adaptado | **No** |
| `NHS-DM-VOM-01` | urgencia [D4] | Diabético que vomita | NHS stomach-ache 999 | adaptado | No |

**Qué hacer ya (si está despierto y puede tragar)** (NOM_015 11.11.8.4; NHS low-blood-sugar)
- "Dele **algo dulce de tomar**: un vaso chico de jugo de fruta o de refresco normal (no de dieta)." (NOM: "carbohidratos líquidos"; los ejemplos son de la NHS: "a small glass of fruit juice or sugary fizzy drink")
- "Cuando se sienta mejor, que coma algo (pan, tortilla) y vaya hoy a la unidad." (NOM: "seguidos de carbohidratos de absorción más lenta")
- "Si en 10 a 15 minutos no mejora, dele otra vez algo dulce y llévelo de urgencia." (NHS)
- La NOM habla de 10–20 g de carbohidrato. **Pahtli no da cantidades**: se usan los ejemplos de la NHS.

**Frases (nuevas claves `diabetes` como antecedente y `sintomas_hipoglucemia`):** "es diabético", "tiene azúcar", "tiene diabetes", "se inyecta insulina", "se le bajó el azúcar", "tiembla", "suda frío" (ya existe `sudor_frio`), "tiene mucha hambre de repente", "anda como borracho sin tomar".

---

### 4.23 Persona con presión alta que se siente mal

| ID | Nivel | Pregunta | Fuente | ¿Existe? |
|---|---|---|---|---|
| daño a órganos | urgencia | Dolor de pecho, falta de aire, cara chueca o debilidad de un lado, confusión, dolor de cabeza repentino y muy fuerte, pérdida de la vista → `CDC-HEART-01`, `IITT-R-RESP-01`, `CDC-STROKE-01` | NOM_030 12.1–12.3: las urgencias hipertensivas "no corresponden al primer nivel" → "referencia inmediata" | Sí |
| solo presión alta | consulta | Presión alta medida **sin** síntomas | NOM_030 12.4: "La sola elevación de la PA, en ausencia de síntomas… no se considera como urgencia" | **No** (texto de `consulta`) |
| embarazo | (existe) | Presión ≥160/110 o síntomas en embarazada (IITT rojo; `NOM007-EMB-02`) | — | Sí |

**Notas:**
- **No verificado y excluido:** ningún umbral numérico de presión para urgencia **fuera del embarazo**. Ni la NOM_030 ni el IITT de adultos no embarazados dan un número para la promotora. No inventar un corte.
- La NOM_030 12.4 también dice que no se use nifedipino debajo de la lengua. Es relevante si en la comunidad se usa como remedio: el texto puede decir "no tome pastillas de otra persona para bajar la presión" [DECIDIR D12; la NOM habla de un fármaco en el primer nivel, no de la población].

**Cuidados en casa** (NOM_030 numerales de estilo de vida, por ejemplo 11.11.5.1 y 14): "Coma con menos sal, evite el alcohol y el cigarro, haga actividad física, y siga tomando sus medicinas como se las indicó su médico."

**Frases:** "tiene presión alta", "es hipertenso", "se le subió la presión", "se le bajó la presión" (ojo: en el habla común "se le bajó la presión" se usa para mareo o desmayo → preguntar desmayo).

---

### 4.24 Nervios, ansiedad, "ansias"

| ID | Nivel | Pregunta | Fuente | ¿Existe? |
|---|---|---|---|---|
| suicidio | urgencia | ¿Ha pensado en quitarse la vida o hacerse daño? → `MHGAP-SUI-01` | mhGAP OTH p. 152: "IF THERE IS IMMINENT RISK OF SUICIDE, ASSESS AND MANAGE" primero | Sí. **Recomendación:** siempre preguntar esto cuando haya "nervios", "tristeza" o "angustia" |
| corazón | urgencia | ¿Tiene **dolor u opresión en el pecho** o le falta el aire? → `CDC-HEART-01` / `IITT-R-RESP-01` | NHS panic-disorder: los síntomas de pánico "can also be symptoms of other conditions", y si hay duda, buscar atención inmediata; mhGAP OTH p. 150: "Rule out physical causes" | Sí |
| `consulta` | consulta | Nervios que no lo dejan hacer sus actividades, o que no mejoran en 2 a 4 semanas | mhGAP OTH p. 156: "return in 2-4 weeks if their symptoms do not improve"; p. 156: si no mejora, "Consider consulting a specialist" | No |

**Cuidados en casa** (mhGAP OTH p. 153, 157 "Box 1"; NHS panic-disorder)
- "Lo que siente es real, y los nervios también pueden causar dolor de estómago, de cabeza o tensión en el cuerpo." (mhGAP p. 153: explicar que el estrés da sensaciones en el cuerpo)
- **Respiración para calmarse** (mhGAP Box 1, p. 157): "Afloje brazos y hombros. Ponga una mano en la panza. Saque todo el aire. Tome aire por la nariz contando 1, 2, 3 (la panza se infla). Aguántelo 1, 2. Sáquelo por la boca contando 1, 2, 3. Hágalo por un minuto, descanse un minuto, y repita dos veces más."
- "Durante un ataque de nervios: quédese donde está, respire despacio y recuerde que se le va a pasar." (NHS panic-disorder)
- "Siga con sus actividades de todos los días. Platique con alguien de confianza o con su familia." (mhGAP p. 153: reducir el estrés y fortalecer el apoyo social)
- **No** recomendar pastillas para los nervios ni inyecciones de vitaminas (mhGAP p. 153: "DO NOT prescribe anti-anxiety…", "DO NOT give vitamin injections").

**Frases (nueva clave `nervios_ansiedad`):** "nervios", "anda de los nervios", "ansias", "angustia", "ataque de pánico", "siente que se va a morir", "susto", "espanto" (concepto tradicional: no es diagnóstico, preguntar los síntomas), "muina", "hizo bilis".

---

## 5. Claves nuevas sugeridas para `findings.ts` (resumen para ingeniería)

| Clave | Grupo | Para qué | Dispara regla |
|---|---|---|---|
| `gases` | digestivo | Gases o "aventado", sin activar dengue | No (cuidados en casa) |
| `estrenimiento` | digestivo | No ha obrado | No (cuidados en casa) |
| `no_obra_ni_gases` | digestivo | Posible obstrucción | `NHS-ABD-OBST-01` (urgencia) |
| `dolor_migra_derecha` | digestivo | Patrón de apendicitis | `IMSS031-APEND-01` (urgencia) |
| `dolor_testiculo` | urinario | Solo hombres | `IITT-R/Y-TESTIS-01` |
| `agruras` | digestivo | Pirosis | Pregunta de dolor de pecho en adultos (D13) |
| `vomito_verde` | digestivo | Vómito verde (en niños también amarillo verdoso), a cualquier edad (corregido en la ronda 4) | `NHS-DIAR-02` → `NHS-VOM-GREEN-01` |
| `dolor_garganta`, `no_puede_tragar_babea` | respiratorio | Garganta | `NHS-THROAT-01`, `IMSS062-STREP-01` |
| `hinchazon_boca_cuello` | respiratorio | Separarla de la hinchazón del embarazo | `IITT-Y-NECK-01`, `NHS-TOOTH-01` |
| `dolor_oido`, `pus_oido`, `hinchazon_detras_oreja` | respiratorio | Oído | `IMCI-EAR-01/02`, `NHS-EAR-*` |
| `dolor_fosa_renal`, `orina_con_sangre` | urinario | IVU alta | `IMSS077-PIELO-01`, `NHS-UTI-01` |
| `dolor_espalda_baja`, `cauda_equina` | trauma | Lumbalgia | `IMSS045-*` |
| `dolor_muela` | digestivo | Dental | `NHS-TOOTH-*` |
| `ronchas_comezon`, `hinchazon_labios_lengua`, `piel_se_pela` | piel | Separarlas del sarpullido con fiebre | `NHS-ANAPH-01`, `IITT-Y-RASH-01` |
| `herida`, `objeto_clavado`, `herida_sucia`, `herida_infectada`, `entumecido_sin_movimiento` | trauma | Heridas | `NHS-WOUND-*`, `IITT-R-LIMB-01` |
| `quemadura_grave` (cara o cuello, vuelta completa, humo, eléctrica, química, <2 o >70 años) | trauma | Quemaduras mayores | `IITT-R-BURN-01`, `IMSS040-BURN-01` |
| `picadura_alacran`, `alacran_sintomas_sistemicos` | trauma | Alacrán | `SSA-ALAC-01..04` |
| `mordedura_arana`, `arana_sintomas` | trauma | Araña | `SSA-ARANA-01/02` |
| `golpe_cabeza`, `anticoagulante` | trauma | Golpe en la cabeza | `NHS-HEAD-01/02` |
| `mareo` | neurologico | Mareo general | No (preguntas) |
| `diabetes`, `sintomas_hipoglucemia`, `hipertension` | general | Antecedentes | `NOM015-HIPO-*` |
| `tos_sangre` | respiratorio | Hemoptisis | `NHS-COUGH-01` |
| `nervios_ansiedad` | general | Ansiedad | Pregunta de suicidio y de pecho |

**Edad y sexo.** Todas las reglas `*-TESTIS-*` exigen `sexo !== 'F'` (es decir, `M` o desconocido). Las de embarazo ya exigen `F` o desconocido. **Si el sexo es desconocido, preguntar el sexo antes que el embarazo.**

---

## 6. Decisiones para la Dra. Ines [DECIDIR]

| # | Pregunta | Opciones | Recomendación provisional |
|---|---|---|---|
| C1 | ¿Cómo representar "consulta no urgente"? | (a) `aqui` + texto "acuda a consulta en los próximos días"; (b) un 4.º nivel | (a): no cambia la escala |
| D2 | Dolor de panza repentino y muy fuerte en **menores de 50 años**, y vómito con sangre o popó negra: la NHS dice 999; el IITT dice amarillo (`IITT-Y-PAIN-01`, `IITT-Y-BLEED-01`, que hoy son `centro_hoy`) | (a) mantener `centro_hoy` (IITT); (b) `urgencia` (NHS) | Pendiente. Subirlo cambiaría reglas existentes: queda para usted |
| D3 | Diarrea en adultos: ¿`centro_hoy` a los 7 días (NHS) además de los 14 días de AIEPI? | (a) agregar `NHS-DIAR-01` para 12 años o más; (b) no | (a), solo para ≥12 años (no toca la regla de niños) |
| D4 | Diabético que vomita: ¿`urgencia` (NHS 999) o `centro_hoy`? | — | `urgencia` (literal de la NHS); no hay fuente mexicana leída |
| D5 | Tos con flema de 2 semanas o más en mayores de 5 años (NOM-006 "caso probable de TB"): ¿`centro_hoy` o `consulta`? | — | `centro_hoy`, igual que la `IMCI-RESP-04` que ya existe |
| D6 | Dolor de quijada al comer: ¿limitarlo a mayores de 50 años? | — | La NHS no pone edad; sin decisión, todas las edades |
| D7 | Fiebre de más de 3 días con gripa (IMSS-062) contra fiebre de 7 días en menores de 5 años (`IMCI-FEV-02`) | (a) agregar la regla de 3 días con gripa para 3 meses a 18 años; (b) no | (a): es una GPC mexicana; no cambia `IMCI-FEV-02`, se agrega una regla aparte con contexto de gripa |
| D8 | Hinchazón repentina de labios, lengua o garganta: el IITT dice amarillo y la NHS dice 999 | — | `urgencia` (es la opción más protectora y aplica en la comunidad) |
| D9 | Alacrán: ¿mencionar al promotor con antídoto? ¿Usar "no cortar / no torniquete" aunque la fuente sea de arañas? | — | Sí a los dos, con la etiqueta "adaptado" |
| D10 | Araña desconocida sin síntomas: ¿`centro_hoy`? | — | `centro_hoy` (no verificado; la violinista puede no doler al principio) |
| D11 | Golpe en la cabeza y toma anticoagulante: ¿`urgencia` (IITT, trauma de alto riesgo) o `centro_hoy` (NHS 111)? | — | `urgencia` (IITT) |
| D12 | ¿Advertir "no tome pastillas de otra persona para la presión"? | — | Opcional |
| D13 | ¿"Agruras" en un adulto debe preguntar siempre por dolor de pecho? ¿Con qué edad mínima? (ninguna fuente leída da una edad) | — | Sí; la edad la decide usted |

---

## 7. No verificado o excluido

- **NOM-033-SSA2-2011:** cancelada (DOF 07-jun-2024). No se cita.
- **GPC SSA-148-08 (alacrán), GPC de arañas venenosas y GPC-SS-027-21 (IVU):** las copias en `cenetec-difusion.com` ya no existen (el dominio muestra casinos). No se leyeron. Se usó SSA_IAVYS_2026, que las cita.
- **Conversión "1 palma ≈ 1 % de la superficie corporal"** para quemaduras: no se leyó en ninguna fuente de esta sesión. Excluida.
- **Umbral de presión arterial** para urgencia fuera del embarazo: ninguna fuente leída lo da. Excluido.
- **"No cortar / no torniquete" para alacrán:** solo se verificó para araña (CENAPRECE_LOXO). Se marca adaptado (D9).
- **Que la vigencia de la NOM-015, la NOM-030 y la NOM-031 esté confirmada:** solo hay evidencia secundaria (Expansión, 2023) de que se iban a "evaluar". No es definitiva.
- **Estreñimiento infantil (IMSS 643GER), ardor al orinar en menores de 5 años y faringitis en adultos con GPC mexicana:** no se investigaron.
- **NHS dizziness:** la revisión de la página venció (abr-2026). Se usó solo para cuidados en casa que no tienen riesgo.
- **La 3a edición (2018) de la guía de rabia:** no se leyó. Se cita la 2a edición (2010).
- **Frases "torzón" en personas, "carraspera", "alacrán güero", "dolor de cintura = lumbalgia" y "el azúcar = glucosa":** no se verificaron en el DEM (se marcan en la tabla 3).
- **Analgésicos y medicamentos de farmacia** que aparecen en las páginas de la NHS (paracetamol, ibuprofeno, antihistamínicos, gotas): excluidos a propósito. No hay dosis ni medicinas.
