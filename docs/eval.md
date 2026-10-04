# Evaluación de Pahtli (extracción + triaje)

> Estado: **viñetas sintéticas, pendientes de validación clínica por la Dra. Ines.** Las métricas miden si el software reproduce el nivel que dictan las guías para un relato dado. No miden si el triaje es clínicamente correcto en pacientes reales.
>
> Última corrida: después de las decisiones clínicas provisionales (`docs/decisiones-clinicas.md`, 3-oct-2026), `npm run eval`. Detalle por caso en `eval/results.md` y `eval/results.json`. La línea base de la ronda 2 (antes de tocar el extractor) está en `eval/baseline-r2-pre/`.

## 0. Resumen

| Métrica | dev (60) | test_v1 (30, regresión) | **test_v2 (40, held-out vigente)** |
|---|---:|---:|---:|
| Exactitud del nivel | 100 % (60/60), IC95 94–100 % | 100 % (30/30), IC95 89–100 % | **92.5 % (37/40), IC95 80–97 %** |
| **Sub-triaje de urgencias** | **0/22** (0 %), IC95 0–15 % | **0/11** (0 %), IC95 0–26 % | **3/16 (18.8 %), IC95 7–43 %** |
| …en silencio (sin pregunta y sin aviso "no estoy segura") | 0/22 | 0/11 | **1/16** |
| Sobre-triaje total | 0 % (0/60) | 0 % | 0 % |
| Sensibilidad de referencia | 100 % (42/42) | 100 % (21/21) | 96.7 % (29/30), IC95 83–99 % |
| Síntomas anotados extraídos bien | — | — | 94.6 % (70/74) |
| Nivel con hallazgos anotados (extracción perfecta) | — | — | 100 % (36/36) |

IC95 = intervalo de Wilson. **La cifra que hay que citar es la de test_v2, y con la advertencia de la sección 3.3**: quien escribió test_v2 también escribió los cambios al extractor. Si se quitan los sinónimos nuevos que aparecen literalmente en test_v2, el resultado baja a **85 % de exactitud y 6/16 urgencias sub-triadas (IC95 19–61 %)**. La estimación honesta del desempeño en relatos nuevos está entre esos dos números, y probablemente más cerca del peor.

## 1. Qué se mide

El pipeline sin LLM, igual al del nivel C del celular (el piso que tienen todos los teléfonos):

```
texto de la promotora → keywordExtract (src/ai/keywords.ts) → triage (src/triage/engine.ts) → nivel
                                                            → assessUncertainty (src/triage/uncertainty.ts) → aviso "no estoy segura"
```

- **Sub-triaje de urgencias**, la métrica crítica: casos `urgencia` que salen como `centro_hoy` o `aqui`, con IC95 de Wilson.
- **Sub-triaje en silencio**: la urgencia sub-triada en la que la app tampoco hace una pregunta de seguimiento ni muestra el aviso "no estoy segura". Es el error que la promotora no tiene cómo detectar.
- Sub-triaje total, sobre-triaje, exactitud del nivel y sensibilidad de referencia (los casos que deben salir de la comunidad y no salen como `aqui`).
- Si dispararon las reglas esperadas (`expected_rule_ids`).
- Campos numéricos contra valores anotados (`expected_findings`).
- **Nuevo en la ronda 2:**
  - `expected_sintomas`: síntomas anotados en test_v2 (afirmados y negados). Mide la extracción síntoma por síntoma, no solo el nivel final.
  - **Nivel con hallazgos anotados**: el motor corre sobre los hallazgos anotados. Separa los errores de extracción de los errores de reglas. En test_v2 da 100 %, así que **todos los fallos de test_v2 son de extracción**.
  - `expected_uncertain` + `expected_ask`: casos en los que falta un dato que podría **subir** el nivel (no se sabe si viven lejos, falta la edad o el conteo de respiraciones, no hay termómetro en un bebé de 6 semanas). Se mide si la app muestra el aviso "no estoy segura", si pregunta algo y si pregunta el dato esperado. Es el requisito "pasa / no pasa" de IA responsable del World Bank.
  - **Ruido del aviso**: con qué frecuencia aparece el aviso "no estoy segura" en casos que sí traen la información necesaria.

No se evalúa el LLM (web-llm no corre en Node) ni la voz (Whisper; ver `docs/ai.md`).

## 2. Método

### 2.1 Splits

| Split | Casos | Uso |
|---|---:|---|
| `dev` | 60 | Se usó para ajustar el extractor (rondas 1 y 2). |
| `test_v1` | 30 | Era el held-out de la ronda 1 (antes `test`). Sus fallos se vieron en la ronda 1 y se arreglaron de forma general en la ronda 2. **Ya no es held-out: es regresión** (`eval/cases.test.ts` exige 0 urgencias sub-triadas). |
| **`test_v2`** | 40 | **Held-out vigente.** 16 urgencia / 14 centro hoy / 10 aquí; 4 marcados `expected_uncertain`. |

### 2.2 Protocolo de test_v2

1. Se renombró `test` → `test_v1`.
2. **Antes de tocar el extractor** se escribieron los 40 casos de test_v2, pensando en cómo habla una promotora: muletillas ("fíjese que", "oiga"), diminutivos ("cuerpecito", "bracitos"), orden libre ("le alcanzó a morder"), relleno dentro de las frases ("le duele **mucho** la barriga"), "ya no" con los dos sentidos, edad o datos faltantes, y vocabulario regional ("obrando aguado", "se alivió", "hacer del uno").
3. El nivel esperado se derivó de los criterios de `docs/clinical-sources.md` y de las 93 reglas actuales. Después se comprobó corriendo el motor sobre los **hallazgos anotados**, sin el extractor: 36/36 coinciden. Este test queda en `eval/cases.test.ts`.
4. Se congeló el split: **sha256 de las 40 líneas = `6e16a1af2424b6e4efc39f722893f0c9c3e30594f0b9023c084a432901d736d5`**, escrito el 2026-10-03 a las 20:34 UTC. `eval/cases.test.ts` falla si alguien lo modifica.
5. **Línea base sin mirar casos:** `EVAL_HIDE_FAILURES=test_v2 EVAL_OUT_DIR=… npm run eval` imprime solo las métricas agregadas de test_v2 (`eval/baseline-r2-pre/`).
6. El extractor se cambió mirando solo dev, test_v1, los tests unitarios y vocabulario general. Todas las corridas de desarrollo usaron `EVAL_HIDE_FAILURES=test_v2`. Hubo una excepción: una corrida intermedia imprimió por error la tabla agregada de test_v2 (77.5 %, sin detalle por caso).
7. Se congeló el extractor y se corrió una sola vez con test_v2 visible. **Los 3 fallos de test_v2 no se corrigieron** (sección 4).

### 2.3 Revisión de etiquetas contra las reglas actuales (93 reglas, post fact-check)

- **test_v2:** las 36 viñetas con síntomas anotados dan el nivel esperado con las reglas actuales (prueba automática). Las otras 4 son casos `aqui` sin signos.
- **dev y test_v1:** con la extracción correcta, las 90 viñetas dan el nivel esperado, salvo D35.
- **No se cambió ninguna etiqueta en la ronda 2.** El único cambio sigue siendo D42 (`centro_hoy` → `urgencia`, fact-check del 3-oct, NOM-031 3.32 y 8.2.5.3.1.1; ver el final del documento).
- **D35** (`centro_hoy` según la OPS) daba `urgencia` por IITT-R-NEURO-01. Con la decisión provisional #14 (`docs/decisiones-clinicas.md`) ya da `centro_hoy`; la etiqueta no se tocó.
- Se agregó `expected_uncertain` a D22, D23, T12 y T13 (respiración rápida sin saber si es difícil llegar a la unidad, o sin conteo). No cambia su nivel esperado.

## 3. Resultados

### 3.1 Antes y después (ronda 2)

| Métrica | test_v2 antes (línea base congelada) | test_v2 después | test_v1 antes → después | dev antes → después |
|---|---:|---:|---:|---:|
| Exactitud | 62.5 % (25/40), IC95 47–76 % | **92.5 %** (37/40), IC95 80–97 % | 76.7 % → 100 % | 98.3 % → 98.3 % |
| **Sub-triaje de urgencias** | **10/16 (62.5 %)**, IC95 39–82 % | **3/16 (18.8 %)**, IC95 7–43 % | 2/11 → 0/11 | 0/22 → 0/22 |
| …en silencio | 1/16 | 1/16 | 0/11 → 0/11 | 0/22 → 0/22 |
| Sub-triaje total | 37.5 % | 7.5 % | 23.3 % → 0 % | 0 % → 0 % |
| Sobre-triaje | 0 % | 0 % | 0 % → 0 % | 1.7 % → 1.7 % |
| Sensibilidad de referencia | 56.7 % (17/30) | 96.7 % (29/30) | 66.7 % → 100 % | 100 % → 100 % |
| Síntomas anotados bien | 62.2 % (46/74) | 94.6 % (70/74) | — | — |
| Casos `expected_uncertain` con aviso | 4/4 | 4/4 | 2/2 → 2/2 | 2/2 → 2/2 |

**Matriz de confusión de test_v2** (filas = esperado):

| | antes: aquí | centro | urg. | después: aquí | centro | urg. |
|---|---:|---:|---:|---:|---:|---:|
| **aquí** | 10 | 0 | 0 | 10 | 0 | 0 |
| **centro hoy** | 5 | 9 | 0 | 0 | 14 | 0 |
| **urgencia** | **8** | 2 | 6 | **1** | 2 | 13 |

La línea base es **la peor cifra de todo el proyecto**: con el extractor de la ronda 1, 8 de 16 urgencias nuevas salían "atender aquí". El 98 % de dev era sobreajuste a un solo estilo de redacción.

### 3.2 Qué aportó cada parte (ablación sobre test_v2)

| Versión del extractor | Exactitud test_v2 | Urgencias sub-triadas | Síntomas bien |
|---|---:|---:|---:|
| Ronda 1 (línea base) | 62.5 % | 10/16 | 62.2 % |
| + mecanismos generales (huecos, "ya no", canonización, marcos, embarazo/posparto), **sin vocabulario nuevo** | 77.5 % | 8/16 (IC95 28–72 %) | 78.4 % |
| + vocabulario nuevo, **quitando las 19 frases que aparecen literalmente en test_v2** | 85.0 % | 6/16 (IC95 19–61 %) | 83.8 % |
| + vocabulario completo (versión entregada) | 92.5 % | 3/16 (IC95 7–43 %) | 94.6 % |

dev y test_v1 quedan en 98.3 % y 100 % en las tres versiones nuevas: **los mecanismos generales, sin una sola frase nueva, arreglan los 7 fallos de test_v1.**

### 3.3 Fuga de información: por qué test_v2 es "casi" held-out

Las viñetas de test_v2 y el vocabulario nuevo los escribió el mismo autor (asistido por IA) en la misma sesión. Aunque test_v2 quedó congelado antes y sus fallos no se miraron durante el desarrollo, el autor recuerda lo que escribió. **19 sinónimos nuevos aparecen palabra por palabra en algún texto de test_v2**, entre ellos "anda manchando", "no se pega al pecho", "ya no quiere vivir", "se cayó del caballo", "bastante sangre", "haberse aliviado" y "no sabe ni dónde está" (lista completa con `npx tsx` sobre `EXTRA_SYNONYMS_R2`, como en la ablación).

- Son frases comunes del habla de México y se habrían agregado de todas formas.
- Aun así, su efecto en test_v2 no es una medición limpia, y algunos mecanismos (por ejemplo, el marco "boca … torcida") también se pensaron con ejemplos parecidos a los del set.
- **Conclusión: la cifra defendible es "entre 85 % y 92.5 % de exactitud y entre 3/16 y 6/16 urgencias sub-triadas" en relatos escritos por el equipo.**
- Para una medición limpia hace falta un **test_v3 escrito por otra persona**: la Dra. Ines o, mejor, transcripciones reales de promotoras (anonimizadas y con consentimiento).

## 4. Análisis de fallos

### 4.1 test_v2, después de la ronda 2 (sin corregir a propósito)

| Caso | Esperado → predicho | Qué pasó | ¿La app avisa? |
|---|---|---|---|
| **T2-V13** | urgencia → centro hoy | "ahorita **no puede ni hablar** de lo que **le cuesta respirar**" → `dificultad_respirar = false`. La negación "no… ni" de la primera mitad alcanza a "le cuesta respirar". Error de **negación**, el peor tipo. | **No: es el único fallo en silencio.** |
| **T2-V02** | urgencia → aquí | "se le **mete** bien **la piel entre las costillas**" (tiraje) no se reconoce. | Sí: pregunta por tiraje y muestra el aviso. |
| **T2-V09** | urgencia → centro hoy | "se tomó un frasco **entero** de pastillas": "entero" no es relleno permitido y no hay sinónimo para "frasco entero de pastillas". "Muy dormida" sí se detecta → `centro_hoy` (IITT-Y-WEAK-01). | Sí muestra el aviso, pero pregunta otras cosas (cuello tieso, dolor de cabeza), no por la intoxicación. |

Arreglos recomendados, **no aplicados** para no ajustar sobre test_v2. Aplicarlos junto con un test_v3:

1. La negación no debe cruzar una subordinada causal o consecutiva ("de lo que…", "de tanto…", "porque…"). Agregar "de lo que" como frontera de negación, y tratar "no puede ni [verbo]" como intensificador y no como negación del síntoma que sigue.
2. Tiraje: "se le mete la piel entre las costillas" / "se le hunde la piel".
3. Intoxicación: un marco "se tomó + (frasco|pastillas|veneno|líquido)" con relleno libre.

### 4.2 test_v1 (ronda 1 → ronda 2)

Los 7 fallos de la ronda 1 se corrigieron **sin agregar sinónimos para esas frases**, con los mecanismos generales de la sección 5:

| Caso | Fallo de la ronda 1 | Qué lo arregló |
|---|---|---|
| T02 | "ya no quiere agarrar el pecho", "calientito" | Verbo modal dentro de la frase ("no **quiere** agarrar" = "no agarra") + canonización "calientito" → "caliente" + marco "siente … caliente". |
| T04 | "un peso en el pecho" | Marco pecho + {peso, presión, aprieta, duele…}. |
| T14 | "hace del baño con sangre" | Marco heces/"del baño" … sangre, con negación interna ("la popó no trae sangre" = negado). |
| T15 | "un perro le mordió" | Marco animal + mordió en cualquier orden; canonización de "morder/mordida/mordió". |
| T17 | "se le hinchan mucho las manos" | Marco {cara, manos…} + hinchado, en cualquier orden. |
| T18 | "la muñeca chueca" | Marco {muñeca, tobillo, dedo, hueso…} + {chueco, quebrado, roto…}. |
| T19 | "le duele todo el cuerpo" | Hueco de relleno ("todo") + marco cuerpo + duele. |

### 4.3 dev

Sin fallos: D35 ya no es sobre-triaje tras la decisión provisional #14 (sección 2.3).

### 4.4 Aviso "no estoy segura" (`src/triage/uncertainty.ts`, módulo de otro equipo)

- **Sensibilidad:** aparece en 8/8 casos `expected_uncertain`. La app pregunta el dato esperado en 5/8. En T2-A10 (bebé de 6 semanas, "no sabe si tiene calentura porque no tiene termómetro") aparece el aviso, pero **no hay ninguna pregunta**. El motor no pregunta temperatura en un menor de 2 meses sin otro hallazgo: es el mismo hueco que T02 en la ronda 1.
- **Ruido (medido en la ronda 2):** aparecía en **66/122 (54 %)** de los casos que sí traen la información necesaria. Ese número supone que la promotora toca "Saltar" en todas las preguntas: `questions_pending` solo aparece en la app si se salta una pregunta que, según el motor, podría subir el nivel. El eval ahora reporta los dos escenarios.
- **Ajuste de integración (ronda 2, sin tocar reglas):** (a) si el resultado ya es **urgencia**, no se agregan `pregnancy_few` ni `young_infant_few` (no hay nivel más alto al cual subir); (b) `age_missing` solo cuenta si alguna edad plausible **subiría** el nivel (si lo bajara, el resultado actual ya es el más prudente) y en puerperio se prueban edades de mujer adulta; (c) la duración sola ya no cuenta como "dato clínico": "le sale algo del oído desde hace 3 días" sin ningún síntoma reconocido ahora avisa `no_findings` en vez de mostrar "Atender aquí" en verde.
- **Bug de flujo corregido:** el motor casi siempre tiene "otra pregunta" posible y la app se detiene en 4. Antes, en 37/122 casos el aviso salía *aunque la promotora contestara las 4 preguntas*, porque las siguientes contaban como "sin responder". Ahora solo cuentan si tocó "Saltar" (queda registrado) o si quedaron antes de llegar al máximo (`MAX_FOLLOWUP_QUESTIONS`).
- **Resultado:** ruido **60/122 (49 %)** si salta todas las preguntas y **24/122 (20 %)** simulando el flujo real de la app (contesta hasta 4 preguntas; Sí/No según lo anotado o "No"; números solo si están anotados, si no "No sé"); sigue avisando en 8/8 `expected_uncertain` y el sub-triaje silencioso sigue en 1/16 (T2-V13). Lo que queda es sobre todo `no_findings` (molestias sin vocabulario ni regla: muela, piojos, rozaduras, cólicos), `pregnancy_few`, `young_infant_few` y "No sé" a conteos de respiración no anotados.

## 5. Cambios al extractor en la ronda 2 (`src/ai/keywords.ts`)

Todos son generales. No se cambió ningún umbral ni nivel de las reglas, y `src/triage/findings.ts` no se tocó.

1. **Coincidencia con huecos:** dentro de una frase de sinónimo de 2 o más palabras se permiten hasta 2 palabras de una lista cerrada de relleno (mucho, bien, todo, su, le, se, muy, como, ya, bastante…). Justo después del "no" del sinónimo también se permiten los modales "quiere / puede / ha" ("no **quiere** agarrar el pecho" = "no agarra el pecho"). El relleno nunca puede ser una negación ni cruzar una frontera de cláusula.
2. **"ya no", de forma general:**
   - "ya no + capacidad" ("ya no quiere comer", "ya no se pega al pecho", "ya no despierta", "ya no quiere vivir") = **signo nuevo**: el sinónimo empieza con "no" y el "ya" no lo niega.
   - "ya no + síntoma" ("ya no vomita"), "ya dejó de…" y "… ya se le quitó / pasó / bajó" = **resuelto**: no se marca. La fiebre resuelta se marca como `fiebre_reciente`, que es lo que pide la OPS para dengue.
   - "no deja de vomitar" y "no se le quita" siguen como síntoma presente.
3. **Eventos que cuentan aunque ya pasaron** (convulsión, desmayo, sangrado en el embarazo, mordeduras, intoxicación, ideas suicidas, signos de evento cerebral…): "le dio un ataque, ya se le pasó" sigue siendo convulsión en esta enfermedad (AIEPI). Antes, la regla de "ya no" podía borrarlos.
4. **Canonización** (se aplica igual al texto y a los sinónimos):
   - Diminutivos: ojitos, pancita, calientito, bracitos, boquita…
   - Equivalentes: barriga y estómago = panza.
   - Conjugaciones: duelen/dolía = duele; morder/mordida = mordió; se le hinchan/inflamada = hinchado; mamar/mamó = mama…
   - Los colores no se canonizan ("amarillo" o "azul" solos no bastan para un signo).
5. **Marcos de co-ocurrencia** (dos grupos de palabras en la misma cláusula, a 3 o 4 palabras, en cualquier orden; si hay una negación entre ellas, queda negado): dolor de pecho, hinchazón de cara o manos, mordedura de animal y de víbora, fractura, dolor de cuerpo, sangre en heces, "se siente caliente" (fiebre) y boca o cara torcida.
6. **Embarazo y posparto:** "va en su octavo mes" implica embarazo (el mes ordinal con "su" solo se usa para el embarazo). "Tiene 10 días de haberse aliviado" = posparto con su fecha (deja de serlo después de 42 días).
7. **Vocabulario coloquial nuevo** (`EXTRA_SYNONYMS_R2`: 357 frases en 62 claves).
   - Apoyo: la redacción de los signos de alarma del embarazo del **IMSS** (consultada en imss.gob.mx/_maternidad2/estas-embarazada/signos-alarma: "ver lucecitas", "zumbidos de oídos", "dolor constante de cabeza", "hinchazón de manos o cara", "dolor intenso en la boca del estómago"), los términos populares de la **Gaceta UNAM** (empacho, caída de mollera) y el habla común ("cursera", "fatiga" por falta de aire, "chistate", "ve mosquitas", "se le trabó la quijada", "anda manchando").
   - **No están validadas con promotoras.**
   - Se descartaron a propósito, por ambiguas: "fatiga" sola, "manchado" solo, "está ardiendo", "se cayó de la escalera" y "atarantado".

Tests: más de 50 casos nuevos en `src/ai/keywords.test.ts`. Incluyen adversariales: "se torció el tobillo" no es fractura, "agua caliente para el té" no es fiebre, "fue al baño y le salió sangre de la nariz" no es sangre en heces, "se cayó de la bici, nada grave" no es trauma grave, y el relleno no cruza negaciones ni fronteras.

## 6. Limitaciones

- **Viñetas sintéticas, de un solo autor.** test_v2 tiene más variedad que la ronda 1, pero lo escribió el mismo equipo que el extractor (sección 3.3). Las promotoras reales dicen las cosas en otro orden, con más relleno, en variantes regionales o mezclando náhuatl u otras lenguas. Hay que validarlas con la Dra. Ines y después con transcripciones reales.
- **El texto es limpio.** No incluye errores de Whisper. `docs/ai.md` mide la voz aparte.
- **No se simulan las respuestas a las preguntas de seguimiento.** Solo se reporta si la app pregunta.
- **Muestras pequeñas.** Con 16 urgencias en test_v2, el IC95 del sub-triaje va de 7 % a 43 %. No hay que presentar estos números como desempeño clínico.
- **Falta medir la precisión síntoma por síntoma** (los hallazgos extra que el extractor marca de más). Solo se mide su efecto en el sobre-triaje del nivel (0 % en test_v2).
- **Más vocabulario y marcos = más riesgo de falsos positivos en relatos reales.** El sobre-triaje medido es bajo (1/130), pero el set no tiene muchos relatos largos con contexto irrelevante.
- Algunas etiquetas dependen de las decisiones clínicas provisionales de `docs/decisiones-clinicas.md` (pendientes de revisión de la Dra. Ines).
- No se evaluó el LLM.

## 7. Cómo correrlo

```bash
cd /Users/brandongarcia/pahtli
npm run eval                      # tabla por split; escribe eval/results.json y eval/results.md (siempre termina con código 0)
EVAL_HIDE_FAILURES=test_v2 npm run eval        # solo métricas agregadas de test_v2 (para desarrollar sin mirar el held-out)
EVAL_OUT_DIR=/tmp/x npm run eval              # escribe la salida en otra carpeta
npx vitest run src/ai src/triage eval          # extractor, motor e integridad del set (incluye el hash de test_v2)
```

Archivos:
- `eval/cases.jsonl`: los 130 casos.
- `eval/lib.ts`: métricas (Wilson, síntomas, nivel con hallazgos anotados, aviso de incertidumbre), sin entrada/salida de archivos.
- `eval/run-eval.ts`: el script.
- `eval/cases.test.ts`: integridad, hash de test_v2, coherencia etiqueta–regla y guardias de regresión de dev y test_v1.
- `eval/results.{json,md}`: la última corrida.
- `eval/baseline-r2-pre/`: la línea base de la ronda 2, con los fallos por caso de test_v2 ocultos.

Reglas para agregar casos:
- **Un caso de test_v2 no se edita ni se usa para ajustar el extractor.** El hash lo vigila.
- Si se ajusta con un caso, ese caso pasa a dev.
- El próximo held-out (test_v3) debe escribirlo otra persona.

## Historial de etiquetas

- **Fact-check clínico (3-oct-2026):** D42 ("Bebé de tres semanas, le conté 64 respiraciones por minuto") pasó de `centro_hoy` a `urgencia`, con reglas esperadas NOM031-IRA-03 + IMCI-YI-03. Motivo: la NOM-031 cuenta "menor de dos meses" como factor de mal pronóstico (3.32) y manda la neumonía leve con factor de mal pronóstico a "Envío inmediato a un hospital" (8.2.5.3.1.1). Ahora: decisión provisional #2 de `docs/decisiones-clinicas.md` (se mantiene `urgencia`).
- **Ronda 2 (3-oct-2026):** no cambió ninguna etiqueta. Se renombró `test` → `test_v1`. Se agregó `expected_uncertain` a D22, D23, T12 y T13. D35 se mantiene en `centro_hoy` (después resuelto por la decisión provisional #14).
- **Decisiones clínicas provisionales (3-oct-2026, `docs/decisiones-clinicas.md`):** **no cambió ninguna etiqueta.** Se revisaron los 130 casos contra los 3 cambios de regla: #1 (fiebre del lactante: ≥38 °C medido o calentura referida → urgencia; 37.5–37.9 °C → centro hoy) no afecta a ningún caso (D21 tiene 38.2 °C y "calentura"; T2-V01 y T2-A10 no traen temperatura medida); #12 (aleteo nasal → urgencia) no aparece en ningún caso; #14 (fiebre + dolor de cabeza en ≥12 años ya no basta para IITT-R-NEURO-01) hace que **D35 pase de sobre-triaje a acierto** sin tocar su etiqueta (`centro_hoy`, PAHO-DEN-03). Métricas después: dev 100 % (60/60), test_v1 100 %, test_v2 92.5 % (sin cambio, 3/16 urgencias sub-triadas por extracción), total 97.7 % (127/130), sobre-triaje 0/130, sensibilidad de referencia 98.9 %. El hash de test_v2 no cambió.
- **Revisión de signos de peligro y acción por edad (4-oct-2026, decisión provisional #20 de `docs/decisiones-clinicas.md`):** **no cambió ninguna etiqueta ni ningún nivel predicho** (130/130 iguales; exactitud, sub-triaje, sobre-triaje y sensibilidad sin cambio). La regla por defecto ahora tiene variante por edad (`IITT-NOSIGNS-01` en ≥5 años); `eval/lib.ts` la cuenta como `IMCI-NOSIGNS-01` al comparar reglas esperadas (las etiquetas de test_v2 están congeladas), así que "reglas esperadas que dispararon" no cambia. La pregunta de revisión va **además** de las 2 preguntas clínicas de cada vuelta, así que "sub-triadas sin pregunta que pida el dato" sigue en 2/16 (test_v2) y el sub-triaje en silencio en 1/16. Aviso "no estoy segura": 37 de los 38 casos que salen `aqui` traen ahora `danger_signs_unchecked` si no se contesta (el 38 es T2-A10, bebé de 6 semanas: la revisión no aplica a menores de 2 meses); ruido si salta todas las preguntas 61/122 → **65/122**; ruido simulando la app (contesta "No" a la revisión) **24/122, sin cambio**; `expected_uncertain` 8/8, sin cambio. D38 dejó de preguntar "¿calentura?" a una señora de 65 años: la única regla que la motivaba era la del puerperio, y el embarazo ya no se considera fuera de 10–49 años.
