# Evaluación de Pahtli (extracción + triaje)

> Estado: **viñetas sintéticas, pendientes de validación clínica por la Dra. Ines.** Las métricas miden si el software reproduce el nivel que dictan las guías para un relato dado. No miden si el triaje es clínicamente correcto en pacientes reales.

## 1. Qué se mide

El pipeline sin LLM, igual al del nivel C del celular (el piso que tienen todos los teléfonos):

```
texto de la promotora → keywordExtract (src/ai/keywords.ts) → triage (src/triage/engine.ts) → nivel
```

- **Sub-triaje de urgencias**, la métrica crítica: casos `urgencia` que salen como `centro_hoy` o `aqui`.
- Sub-triaje total, sobre-triaje y exactitud del nivel.
- Sensibilidad de referencia: los casos que deben salir de la comunidad (`centro_hoy` o `urgencia`) y no salen como `aqui`.
- Si dispararon las reglas esperadas (`expected_rule_ids`).
- La extracción de campos numéricos contra valores anotados (`expected_findings`: edad, embarazo, semanas, respiraciones, temperatura, duración).
- Si, en un sub-triaje, la app **pregunta** el dato que falta (preguntas de seguimiento del motor). Así se distingue un error silencioso de uno que la promotora todavía puede corregir respondiendo.

No se evalúa el LLM (web-llm no corre en Node) ni la voz (Whisper). Según `docs/ai.md`, el LLM en su modo actual no agregó hallazgos en 12 casos, así que esta evaluación cubre el camino que decide en la práctica.

## 2. Método

- **`eval/cases.jsonl`**: 90 viñetas en español coloquial de México, como las diría en voz alta una promotora. Cada una tiene `id`, `text`, `expected_level`, `expected_rule_ids`, `source_rule` (criterio de la guía y fuente), `expected_findings`, `split` y `tags`.
  - Distribución: 32 urgencia (35.6 %), 31 centro_hoy (34.4 %), 27 aquí (30 %).
  - Edades de 4 días a 70 años; embarazo, posparto, recién nacido, adulto y trauma.
  - Vocabulario regional: "calentura", "se alivió", "le picó una víbora", "se le chueó la boca", "chamaco", "hace del baño", "paliducho".
- **Casos adversariales** (en `tags`):
  - Signo de peligro al final del relato (T07, D14).
  - Signos de peligro negados ("no se le hunde el pecho", "no le sale mucha sangre").
  - "Ya se le quitó" y "ya no vomita".
  - Umbrales exactos: 40 respiraciones a los 3 años, 50 a los 6 meses, 44 a los 10 meses, 1.5 meses de edad, 21 días con 64 respiraciones.
  - Datos faltantes, como la edad sin decir.
- **Split `test` (30 casos), escrito primero.** Se escribió antes de abrir `keywords.ts` o el código de las reglas, usando solo las guías de `docs/clinical-sources.md` para fijar el nivel. Después se escribió el split `dev` (60).
- **Iteración solo sobre `dev`.** Se agregaron sinónimos para los fallos de dev y se volvió a correr. No se cambió ningún umbral ni nivel de las reglas.
  - **Aviso:** el script imprime todos los fallos, así que los fallos de test se vieron en la primera corrida.
  - No se hizo ningún cambio motivado por ellos. Las métricas de test son **idénticas** antes y después de los cambios (sección 3), lo que confirma que no hubo filtración.
- **El nivel esperado sale de la guía, no del código.** Donde la guía y el motor no coinciden, se dejó la etiqueta de la guía y el caso se documenta en "Problemas de reglas" (sección 5).

## 3. Resultados

Corrida final: `npm run eval`. El detalle por caso está en `eval/results.md` y `eval/results.json`.

| Métrica | dev (60) | **test (30, held-out)** | total (90) |
|---|---:|---:|---:|
| Exactitud del nivel | 98.3 % (59/60) | **76.7 %** (23/30), IC95 59–88 % | 91.1 % (82/90) |
| **Sub-triaje de urgencias** | **0 %** (0/21), IC95 0–15 % | **18.2 %** (2/11), IC95 5–48 % | 6.3 % (2/32) |
| …sin pregunta de seguimiento que lo rescate | 0/21 | 1/11 | 1/32 |
| Sub-triaje total | 0 % (0/60) | 23.3 % (7/30) | 7.8 % (7/90) |
| Sobre-triaje total | 1.7 % (1/60) | 0 % (0/30) | 1.1 % (1/90) |
| Sensibilidad de referencia | 100 % (42/42) | 66.7 % (14/21) | 88.9 % (56/63) |
| Reglas esperadas que dispararon | 98.3 % | 73.3 % | 90.0 % |
| Campos numéricos (edad, respiraciones, temperatura, semanas, duración, embarazo) | 100 % (72/72) | 100 % (36/36) | 100 % (108/108) |
| Latencia de extracción y triaje en Node (media) | 0.3 ms | 0.2 ms | 0.3 ms |

**Antes de los cambios (línea base, mismo set):**

| Métrica | dev | test |
|---|---:|---:|
| Exactitud | 88.3 % | 76.7 % |
| Sub-triaje de urgencias | 23.8 % (5/21) | 18.2 % (2/11) |
| Sub-triaje total | 10.0 % | 23.3 % |
| Sensibilidad de referencia | 85.7 % | 66.7 % |

**Matriz de confusión (test)**, con filas = esperado y columnas = predicho:

| | aquí | centro hoy | urgencia |
|---|---:|---:|---:|
| **aquí** | **9** | 0 | 0 |
| **centro hoy** | 5 | **5** | 0 |
| **urgencia** | 2 | 0 | **9** |

### Lectura honesta

- **El motor de reglas no falló en ningún caso.** Cada vez que el extractor entregó los hallazgos correctos, el nivel fue el de la guía. La excepción es D35, donde dos guías se contradicen (sección 5).
- **Los campos numéricos se extraen bien** (100 %): edad en palabras ("año y medio", "tres semanas de nacido", "mes y medio"), respiraciones contadas, temperatura y semanas de embarazo. Lo mismo vale para la negación simple ("no se le hunde el pecho" → tiraje = falso).
- **El punto débil es el vocabulario de síntomas.** Todos los fallos de test son frases que no están en la lista de sinónimos o que traen una palabra intercalada ("le duele **todo** el cuerpo", "un perro **le** mordió", "se le hinchan **mucho** las manos"). El extractor por palabras clave es exacto pero frágil. Pasó de 76.7 % en test a 98.3 % en dev **porque dev se usó para ajustarlo**. El número que hay que citar es el de test.
- **El sobre-triaje es casi nulo y el sub-triaje no.** Cuando el extractor no reconoce algo, el motor cae en "atender aquí". El sistema es conservador con lo que entiende y ciego a lo que no.
- **Mitigación que ya existe:** en T04 (posible infarto), la app pregunta "¿dolor de pecho?" porque detectó sudor frío en un adulto. T02 (recién nacido) no tiene ninguna pregunta y es el fallo más grave.

## 4. Análisis de fallos

### Test (held-out, sin corregir a propósito)

| Caso | Esperado → predicho | Frase no reconocida | Causa |
|---|---|---|---|
| **T02** | urgencia → aquí | "**ya no** quiere agarrar el pecho", "lo siente **calientito**" | Dos fallas juntas. (1) La heurística de negación trata "ya no" como "ya se resolvió", pero en un recién nacido "ya no quiere mamar" es un signo de peligro **nuevo**. (2) "calientito" no está en los sinónimos de fiebre. El bebé de 21 días queda sin hallazgos y sin preguntas: **el fallo más peligroso del set.** |
| **T04** | urgencia → aquí | "como un **peso** en el pecho que se le corre al brazo" | No hay sinónimo de dolor de pecho con "peso". La app sí pregunta por dolor de pecho porque detectó sudor frío. |
| T14 | centro_hoy → aquí | "hace del baño con sangre" | Falta el sinónimo para sangre en heces. |
| T15 | centro_hoy → aquí | "un perro **le** mordió la pierna" | Los sinónimos son "lo/la mordió un perro". El orden de palabras y el "le" no coinciden. |
| T17 | centro_hoy → aquí | "se le hinchan **mucho** las manos y la cara" | Los sinónimos son "manos hinchadas", "cara hinchada" o "se le hinchan los pies". La palabra intercalada rompe la coincidencia. |
| T18 | centro_hoy → aquí | "la **muñeca** chueca" | Solo existen "brazo chueco" y "pierna chueca". |
| T19 | centro_hoy → aquí | "le duele **todo** el cuerpo" | "le duele el cuerpo" existe, pero "todo" rompe la coincidencia. Solo se detectó una de las dos manifestaciones de dengue que se necesitan. |

**Arreglos recomendados, no aplicados para no contaminar test.** Hacerlos después junto con un set held-out **nuevo**:

1. Coincidencia con huecos: permitir 1 o 2 palabras de relleno ("todo", "mucho", "bien", "le", "se") dentro de una frase de sinónimo. Esto resolvería T17 y T19, y probablemente muchos casos reales.
2. "ya no + comer, mamar, beber o moverse" debería marcarse **positivo**, no "resuelto", porque indica un cambio reciente hacia peor. "ya no vomita" y "ya no tiene calentura" sí deben seguir como resueltos.
3. Sinónimos que faltan:
   - "calientito/calientita" → fiebre
   - "peso en el pecho" → dolor de pecho
   - "hace del baño con sangre" → sangre en heces
   - "le mordió un perro / perro le mordió" → mordedura de animal
   - "muñeca, tobillo o dedo chueco" → fractura
4. Que un recién nacido sin ningún hallazgo genere al menos la pregunta "¿mama bien?", para que T02 nunca termine en silencio.

### Dev: cambios aplicados (changelog)

Todos están en `src/ai/keywords.ts` (`EXTRA_SYNONYMS`, marcados con `/* eval */` o con un comentario `eval`). No se tocó `src/triage/findings.ts` ni ninguna regla.

| Caso dev | Fallo | Cambio |
|---|---|---|
| D06 | "el bebé no se le ha movido" (embarazada de 34 semanas) → no detectado | `no_se_mueve` += "no se ha movido", "no se le ha movido". El código existente ya lo convierte en `movimientos_fetales_disminuidos` cuando hay embarazo. En un recién nacido queda como `no_se_mueve`, que es correcto. |
| D10 | "el bebé **tiene** tres semanas" → edad no extraída, y la regla de ictericia grave exige edad conocida | `parseNumbers`: el patrón de edad del bebé acepta "bebé tiene/ya tiene/cumplió N días/semanas", además de "bebé de N…", salvo en contexto de embarazo. `palmas_plantas_amarillas` += "amarillo hasta (las) palmas/plantas", "palmas de (las) manos amarillas", "plantas de (los) pies amarillas". |
| D16 | "lo atropelló una camioneta" → no detectado | `trauma_grave` += "atropello", "atropellaron", "atropellado", "atropellada". |
| D17 | "las palmas muy pálidas, blanquísimas" → no detectado (plural) | `palidez_intensa` += "muy/bien pálidas/pálidos", "blanquísimo/a/os/as", "palmas muy blancas". |
| D19 | "ruido raro y áspero al jalar aire" → no detectado | `estridor` += "ruido al jalar aire", "áspero al jalar aire", "ruido áspero", "ruido raro al jalar aire". "Tos de perro" **no** se mapeó a estridor, porque por sí sola no es estridor. |
| D27 | "no ha podido orinar" → no detectado | `no_puede_orinar` += "no ha podido orinar", "no ha podido hacer pipí", "no puede hacer pipí". |

Resultado en dev: el sub-triaje de urgencias pasó de 5/21 a **0/21**. Los 82 tests de `src/ai` y los 121 de `src/triage` siguen pasando.

## 5. Problemas de reglas (para la revisora clínica; no se cambiaron)

1. **IITT-R-NEURO-01 se dispara con "fiebre + dolor de cabeza" en cualquier persona de 12 años o más, o de edad desconocida** (caso D35: mujer de 38 años con calentura de 3 días, dolor de cabeza, ronchas y náusea → `urgencia`).
   - Es fiel a la letra del IITT ("Any two of: altered mental status, stiff neck, hypothermia or fever, headache").
   - Choca con la OPS: el mismo cuadro es un dengue sospechoso sin signos de alarma (Grupo A).
   - En zona de dengue, o en temporada de influenza, buena parte de los adultos con fiebre saldrían como urgencia.
   - Sugerencia: que la Dra. Ines decida si el IITT aplica fuera de un servicio de urgencias. Una opción es exigir alteración del estado mental o rigidez de nuca como uno de los dos criterios.
   - Es sobre-triaje, no sub-triaje, así que es seguro pero costoso para la comunidad (traslados).
2. **IMCI-YI-07 (ictericia grave) exige edad conocida menor de 2 meses.** El IMCI dice "Yellow palms and soles **at any age**" (dentro del cuadro del lactante).
   - En D10, antes de arreglar la edad, "amarillo hasta las palmas y las plantas" daba `aqui` solo porque no se extrajo la edad.
   - Sugerencia: que `palmas_plantas_amarillas` dispare aunque la edad sea desconocida (sube, nunca baja), como hacen las reglas de signos de peligro.
3. **No hay pregunta de seguimiento en un recién nacido sin hallazgos** (T02). No es una regla incorrecta, pero los signos de peligro del lactante (mama bien, se mueve, temperatura) merecen una pregunta por defecto cuando la edad es menor de 2 meses.

## 6. Limitaciones

- **Viñetas sintéticas.** Las escribió el mismo equipo (asistido por IA) que construyó el extractor, en un solo estilo. Las promotoras reales dicen las cosas en otro orden, con más relleno, en variantes regionales o mezclando náhuatl u otras lenguas. Hay que validarlas con la Dra. Ines y, después, con transcripciones reales de promotoras, con consentimiento y anonimizadas.
- **El texto es limpio.** No incluye los errores de Whisper ("le huele el pecho"). `docs/ai.md` mide la voz aparte (12 clips sintéticos).
- **No se simulan las respuestas a las preguntas de seguimiento.** Solo se reporta si la app pregunta el dato que falta. El nivel final real después de preguntar podría ser mejor.
- **Muestras pequeñas.** Con 11 urgencias en test, el intervalo de confianza del sub-triaje va de 5 % a 48 %. No hay que presentar estos números como desempeño clínico.
- **Algunas etiquetas dependen de decisiones de nivel que siguen marcadas [DECIDIR]** en `docs/clinical-sources.md` (por ejemplo, tiraje → urgencia, fiebre en el embarazo → urgencia). Si la Dra. Ines cambia esas decisiones, cambian las etiquetas.
- **No se evaluó el LLM.** La unión LLM + palabras clave, en el nivel A, podría recuperar parte de los fallos de vocabulario, pero eso no está medido.

## 7. Cómo correrlo

```bash
cd /Users/brandongarcia/pahtli
npm run eval      # imprime la tabla y escribe eval/results.json y eval/results.md (siempre termina con código 0)
npx vitest run    # incluye eval/cases.test.ts: integridad del set y guardia "0 urgencias sub-triadas en dev"
```

Archivos:
- `eval/cases.jsonl`: los casos.
- `eval/lib.ts`: evaluación y métricas, sin entrada/salida de archivos.
- `eval/run-eval.ts`: el script.
- `eval/cases.test.ts`: los tests.
- `eval/results.{json,md}`: la salida de la última corrida.

Para agregar casos, añade líneas a `cases.jsonl`. Un caso nuevo de test no debe usarse para ajustar sinónimos. Si se ajusta con él, hay que moverlo a dev.

## Cambio de etiqueta tras el fact-check clínico (3-oct-2026)

- **D42** ("Bebé de tres semanas, le conté 64 respiraciones por minuto") pasó de `centro_hoy` a `urgencia`, con reglas esperadas `NOM031-IRA-03` + `IMCI-YI-03`. Motivo: la NOM-031 cuenta "menor de dos meses" como factor de mal pronóstico (3.32) y manda la neumonía leve con factor de mal pronóstico a "Envío inmediato a un hospital" (8.2.5.3.1.1). El IMCI 2019 la maneja ambulatoria; queda como [DECIDIR] para la Dra. Ines (docs/clinical-sources.md 4.1, punto 14).
- No se agregaron sinónimos motivados por fallos del split `test`. Las métricas de test no cambian (76.7 %, 2/11 urgencias sub-triadas). Dev: 98.3 %, 0/22. Las frases del fact-check se prueban aparte en `src/triage/factcheck.e2e.test.ts`.
