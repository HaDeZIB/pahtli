# Resultados de la evaluación de Pahtli

> Generado por `npm run eval` el 2026-10-04T22:29:25.463Z. Pipeline: texto → `keywordExtract` → `triage` (Node, sin LLM) + fail-safe `assessUncertainty`.
> Viñetas sintéticas escritas por el equipo, **pendientes de validación clínica por la Dra. Ines**.
> `dev` se usó para ajustar. `test_v1` (held-out original) ya se vio y se usó en la ronda 2: ahora es solo regresión. `test_v2` se escribió y congeló antes de los cambios de la ronda 2. **`test_v3` es el held-out vigente** (ronda 3): 80 casos escritos a ciegas y congelados antes de los cambios de la ronda 3; 18 son `sin_regla` a propósito.

## Métricas

| Métrica | dev | test_v1 | test_v2 | test_v3 | total |
|---|---:|---:|---:|---:|---:|
| Casos | 93 | 30 | 40 | 80 | 243 |
| Exactitud (nivel exacto) | 100.0% (93/93), IC95 96–100 % | 100.0% (30/30), IC95 89–100 % | 92.5% (37/40), IC95 80–97 % | 80.0% (64/80), IC95 70–87 % | 92.2% (224/243), IC95 88–95 % |
| **Sub-triaje de urgencias** (urgencia → menor) | **0.0%** (0/37), IC95 0–9 % | **0.0%** (0/11), IC95 0–26 % | **18.8%** (3/16), IC95 7–43 % | **30.0%** (6/20), IC95 14–52 % | **10.7%** (9/84), IC95 6–19 % |
| …de ellas, sin pregunta de seguimiento que pida el dato faltante | 0/37 | 0/11 | 2/16 | 6/20 | 8/84 |
| …de ellas, **en silencio** (sin pregunta y sin aviso "no estoy segura") | 0/37 | 0/11 | 1/16 | 0/20 | 1/84 |
| Sub-triaje total (cualquier nivel → menor) | 0.0% (0/93) | 0.0% (0/30) | 7.5% (3/40) | 15.0% (12/80) | 6.2% (15/243) |
| Sobre-triaje total | 0.0% (0/93) | 0.0% (0/30) | 0.0% (0/40) | 5.0% (4/80) | 1.6% (4/243) |
| Sensibilidad de referencia (centro/urgencia ≠ aquí) | 100.0% (62/62), IC95 94–100 % | 100.0% (21/21), IC95 85–100 % | 96.7% (29/30), IC95 83–99 % | 83.3% (40/48), IC95 70–91 % | 94.4% (152/161), IC95 90–97 % |
| Reglas esperadas que dispararon (todas) | 100.0% (93/93) | 100.0% (30/30) | 92.5% (37/40) | 83.9% (52/62) | 94.2% (212/225) |
| Recall / precisión `aqui` | 100.0% / 100.0% | 100.0% / 100.0% | 100.0% / 90.9% | 96.9% / 79.5% | 98.8% / 90.0% |
| Recall / precisión `centro_hoy` | 100.0% / 100.0% | 100.0% / 100.0% | 100.0% / 87.5% | 67.9% / 82.6% | 88.3% / 91.9% |
| Recall / precisión `urgencia` | 100.0% / 100.0% | 100.0% / 100.0% | 81.3% / 100.0% | 70.0% / 77.8% | 89.3% / 94.9% |
| Síntomas anotados extraídos bien (afirmados · negados) | — | — | 94.6% (70/74) · 63/67 · 7/7 | — | 94.6% (70/74) · 63/67 · 7/7 |
| Nivel con hallazgos anotados (extracción perfecta) | — | — | 100.0% (36/36) | — | 100.0% (36/36) |
| Casos `expected_uncertain`: aviso "no estoy segura" · pregunta algo · pregunta el dato esperado | 2/2 · 2/2 · 1/2 | 2/2 · 2/2 · 2/2 | 4/4 · 3/4 · 2/4 | 5/7 · 5/7 · 5/7 | 13/15 · 12/15 · 10/15 |
| Aviso "no estoy segura" en casos sin falta de datos (ruido) — si salta las preguntas | 51/91 | 14/28 | 20/36 | 53/73 | 138/228 |
| …ruido si contesta las preguntas como en la app (hasta 4; Sí/No según lo anotado o "No") | 10/91 | 3/28 | 7/36 | 6/73 | 26/228 |
| Casos con pregunta prohibida (`expected_not_ask`, p. ej. embarazo a un hombre) | 0/15 | — | — | 0/54 | 0/69 |
| Sexo extraído igual al anotado (`expected_sexo`) | 100.0% (28/28) | — | — | 97.5% (78/80) | 98.1% (106/108) |
| Latencia extracción+triaje (media / p95, ms) | 0.54 / 0.87 | 0.53 / 0.7 | 0.49 / 0.63 | 0.51 / 0.76 | 0.52 / 0.75 |

### Matriz de confusión — dev

| esperado \ predicho | aquí | centro hoy | urgencia |
|---|---:|---:|---:|
| **aquí** | **31** | 0 | 0 |
| **centro hoy** | 0 | **25** | 0 |
| **urgencia** | 0 | 0 | **37** |

### Matriz de confusión — test_v1

| esperado \ predicho | aquí | centro hoy | urgencia |
|---|---:|---:|---:|
| **aquí** | **9** | 0 | 0 |
| **centro hoy** | 0 | **10** | 0 |
| **urgencia** | 0 | 0 | **11** |

### Matriz de confusión — test_v2

| esperado \ predicho | aquí | centro hoy | urgencia |
|---|---:|---:|---:|
| **aquí** | **10** | 0 | 0 |
| **centro hoy** | 0 | **14** | 0 |
| **urgencia** | 1 | 2 | **13** |

### Matriz de confusión — test_v3

| esperado \ predicho | aquí | centro hoy | urgencia |
|---|---:|---:|---:|
| **aquí** | **31** | 0 | 1 |
| **centro hoy** | 6 | **19** | 3 |
| **urgencia** | 2 | 4 | **14** |

### Matriz de confusión — total

| esperado \ predicho | aquí | centro hoy | urgencia |
|---|---:|---:|---:|
| **aquí** | **81** | 0 | 1 |
| **centro hoy** | 6 | **68** | 3 |
| **urgencia** | 3 | 6 | **75** |

## Extracción por campo (contra valores de referencia anotados en `expected_findings`)

| Campo | dev | test_v1 | test_v2 | test_v3 | total |
|---|---:|---:|---:|---:|---:|
| `duracion_dias` | 100.0% (2/2) | 100.0% (2/2) | 100.0% (3/3) | — | 100.0% (7/7) |
| `edad_meses` | 100.0% (64/64) | 100.0% (26/26) | 100.0% (31/31) | 100.0% (77/77) | 100.0% (198/198) |
| `embarazada` | 100.0% (8/8) | 100.0% (4/4) | 100.0% (6/6) | 100.0% (1/1) | 100.0% (19/19) |
| `resp_por_min` | 100.0% (4/4) | 100.0% (3/3) | 100.0% (3/3) | — | 100.0% (10/10) |
| `semanas_embarazo` | 100.0% (3/3) | 100.0% (1/1) | 100.0% (4/4) | — | 100.0% (8/8) |
| `temperatura_c` | 100.0% (4/4) | — | 100.0% (1/1) | 100.0% (2/2) | 100.0% (7/7) |

Síntomas anotados no extraídos (o con polaridad equivocada):

| Caso | Split | Síntoma | Esperado | Extraído |
|---|---|---|---|---|
| T2-V02 | test_v2 | `tiraje` | true | — |
| T2-V09 | test_v2 | `intoxicacion` | true | — |
| T2-V13 | test_v2 | `dificultad_respirar` | true | false |
| T2-C02 | test_v2 | `bebe_con_avidez` | true | — |

## Fallos de nivel

- **T2-V02** (test_v2) esperado `urgencia`, predicho `aqui` — SUB-TRIAJE (extracción incompleta): no disparó IMCI-RESP-03 [tiraje=?]
  - Texto: "Oiga, el niño de Lupita tiene dos años, trae tos y calentura desde hace tres días, y ahorita que le levanté la camisa se le mete bien la piel entre las costillas cuando jala aire."
  - Reglas disparadas: IMCI-NOSIGNS-01 · preguntas de seguimiento: signo_peligro_general, resp_por_min, tiraje · **la app pregunta el dato faltante** · aviso "no estoy segura" (danger_signs_unchecked, questions_pending)
- **T2-V09** (test_v2) esperado `urgencia`, predicho `centro_hoy` — SUB-TRIAJE (extracción incompleta): no disparó IITT-R-POISON-01 [intoxicacion=?]
  - Texto: "La señora de 40 años se tomó un frasco entero de pastillas de su mamá, la encontraron muy dormida en su cuarto."
  - Reglas disparadas: IITT-Y-WEAK-01 · preguntas de seguimiento: rigidez_nuca, dolor_cabeza · la app NO pregunta el dato faltante · aviso "no estoy segura" (questions_pending)
- **T2-V13** (test_v2) esperado `urgencia`, predicho `centro_hoy` — SUB-TRIAJE (negación errónea): no disparó IITT-R-RESP-01 [dificultad_respirar=false, edad_meses=96]
  - Texto: "Mi sobrino de 8 años es asmático y ahorita no puede ni hablar de lo que le cuesta respirar, le chilla el pecho."
  - Reglas disparadas: IITT-Y-WHEEZE-01 · la app NO pregunta el dato faltante
- **T3-01** (test_v3) esperado `urgencia`, predicho `centro_hoy` — SUB-TRIAJE (extracción incompleta): no disparó (ninguna regla esperada listada)
  - Texto: "Señor de 45 años, trae la panza muy inflamada y dura, lleva tres días sin obrar y ya ni echa gases, y ahorita vomitó dos veces."
  - Reglas disparadas: NHS-BLOAT-01 · preguntas de seguimiento: no_obra_ni_gases, no_puede_beber · la app NO pregunta el dato faltante · aviso "no estoy segura" (questions_pending)
- **T3-02** (test_v3) esperado `urgencia`, predicho `centro_hoy` — SUB-TRIAJE (extracción incompleta): no disparó (ninguna regla esperada listada)
  - Texto: "Muchacha de 23 años con dolor muy fuerte abajo de la panza, del lado izquierdo; la regla se le atrasó como seis semanas y está manchando poquito."
  - Reglas disparadas: IITT-Y-PAIN-01 · preguntas de seguimiento: embarazada · la app NO pregunta el dato faltante · aviso "no estoy segura" (questions_pending)
- **T3-03** (test_v3) esperado `urgencia`, predicho `aqui` — SUB-TRIAJE (extracción incompleta): no disparó CDC-STROKE-01 [cara_caida=?, debilidad_un_lado=?, dificultad_hablar=?, confusion=?, perdida_equilibrio=?, dolor_cabeza_subito=?, perdida_vision_subita=?]
  - Texto: "Doña Chela, como de 50 años, dice que de repente le dio un dolor de cabeza horrible, el peor de su vida, mientras lavaba."
  - Reglas disparadas: IITT-NOSIGNS-01 · preguntas de seguimiento: signo_peligro_general, letargico, rigidez_nuca · la app NO pregunta el dato faltante · aviso "no estoy segura" (danger_signs_unchecked, questions_pending)
- **T3-09** (test_v3) esperado `urgencia`, predicho `aqui` — SUB-TRIAJE (extracción incompleta): no disparó IITT-R-TRAUMA-01 [trauma_grave=?]
  - Texto: "Al abuelito de 80 años, que toma pastilla para adelgazar la sangre, se cayó en el baño y se pegó en la cabeza; ahorita está despierto y platica."
  - Reglas disparadas: IITT-NOSIGNS-01 · preguntas de seguimiento: signo_peligro_general, golpe_cabeza_alto_riesgo, vision_borrosa · la app NO pregunta el dato faltante · aviso "no estoy segura" (danger_signs_unchecked, questions_pending)
- **T3-17** (test_v3) esperado `urgencia`, predicho `centro_hoy` — SUB-TRIAJE (extracción incompleta): no disparó (ninguna regla esperada listada)
  - Texto: "El niño de 10 años tiene un dolor muy fuerte en un testículo desde hace dos horas; empezó de repente y vomitó."
  - Reglas disparadas: IITT-Y-PAIN-01 · preguntas de seguimiento: no_puede_beber, letargico · la app NO pregunta el dato faltante · aviso "no estoy segura" (questions_pending)
- **T3-18** (test_v3) esperado `urgencia`, predicho `centro_hoy` — SUB-TRIAJE (extracción incompleta): no disparó (ninguna regla esperada listada)
  - Texto: "Niño de 7 años, le duele la panza muy fuerte del lado derecho desde ayer; ahorita tiene la panza dura, no deja que se la toquen y ya vomitó."
  - Reglas disparadas: IITT-Y-PAIN-01 · preguntas de seguimiento: no_puede_beber, letargico · la app NO pregunta el dato faltante · aviso "no estoy segura" (questions_pending)
- **T3-28** (test_v3) esperado `centro_hoy`, predicho `aqui` — SUB-TRIAJE (extracción incompleta): no disparó (ninguna regla esperada listada)
  - Texto: "Se cortó la mano con un vidrio; la herida está abierta y honda, como de dos dedos de largo, ya no sangra."
  - Reglas disparadas: IMCI-NOSIGNS-01 · preguntas de seguimiento: signo_peligro_general, objeto_clavado, herida_profunda · la app NO pregunta el dato faltante · aviso "no estoy segura" (age_missing, danger_signs_unchecked, questions_pending)
- **T3-36** (test_v3) esperado `centro_hoy`, predicho `aqui` — SUB-TRIAJE (extracción incompleta): no disparó IITT-Y-PAIN-01 [dolor_intenso=?, dolor_abdominal_intenso=?]
  - Texto: "Señor de 40 años con dolor de cintura muy fuerte desde ayer que se le baja por la pierna; no lo deja moverse ni dormir."
  - Reglas disparadas: IITT-NOSIGNS-01 · preguntas de seguimiento: signo_peligro_general, cauda_equina, no_puede_orinar · la app NO pregunta el dato faltante · aviso "no estoy segura" (danger_signs_unchecked, questions_pending)
- **T3-40** (test_v3) esperado `centro_hoy`, predicho `aqui` — SUB-TRIAJE (extracción incompleta): no disparó IITT-Y-FAINT-01 [desmayo=?, mareo_al_pararse=?, edad_meses=852]
  - Texto: "Don Chuy, de 71, se marea cuando se para de la cama desde que tiene diarrea; ayer casi se cae."
  - Reglas disparadas: IITT-NOSIGNS-01 · preguntas de seguimiento: signo_peligro_general, no_puede_beber, letargico · la app NO pregunta el dato faltante · aviso "no estoy segura" (danger_signs_unchecked, questions_pending)
- **T3-42** (test_v3) esperado `centro_hoy`, predicho `aqui` — SUB-TRIAJE (extracción incompleta): no disparó (ninguna regla esperada listada)
  - Texto: "Muchacha de 22 años: le salieron ronchas en los brazos y la panza hace dos horas y cada vez son más; le pican mucho, pero respira bien y no tiene la cara hinchada."
  - Reglas disparadas: IITT-NOSIGNS-01 · preguntas de seguimiento: signo_peligro_general, no_traga_saliva, hinchazon_labios_lengua · la app NO pregunta el dato faltante · aviso "no estoy segura" (danger_signs_unchecked, questions_pending)
- **T3-43** (test_v3) esperado `centro_hoy`, predicho `aqui` — SUB-TRIAJE (extracción incompleta): no disparó IITT-Y-BLEED-01 [sangrado=?, vomito_sangre=?, heces_negras=?, sangre_heces=?, sangrado_mucosas=?]
  - Texto: "Adolescente de 13 años, muchacha: le bajó la regla por primera vez hace 10 días y no se le quita, le baja más de lo normal; anda pálida y cansada."
  - Reglas disparadas: IITT-NOSIGNS-01 · preguntas de seguimiento: signo_peligro_general · la app NO pregunta el dato faltante · aviso "no estoy segura" (danger_signs_unchecked, questions_pending)
- **T3-45** (test_v3) esperado `centro_hoy`, predicho `aqui` — SUB-TRIAJE (extracción incompleta): no disparó IITT-Y-TRAUMA-01 [fractura=?, quemadura=?]
  - Texto: "Chava de 15 años se torció el tobillo jugando fut; está muy hinchado, morado y no puede apoyar el pie."
  - Reglas disparadas: IITT-NOSIGNS-01 · preguntas de seguimiento: signo_peligro_general, embarazada, posparto · la app NO pregunta el dato faltante · aviso "no estoy segura" (danger_signs_unchecked, questions_pending)
- **T3-31** (test_v3) esperado `centro_hoy`, predicho `urgencia` — SOBRE-TRIAJE: disparó SSA-ARANA-02 [mordedura_arana=true, arana_sintomas=true]. Frases detectadas: "le duele toda pansa"→dolor_abdominal, "le pico arana"→mordedura_arana, "calambres"→arana_sintomas, "pico arana"→mordedura_arana
  - Texto: "Señor de 30 años: le picó una araña negra con una manchita roja en la panza; le dan calambres muy fuertes y le duele toda la panza."
  - Reglas disparadas: SSA-ARANA-02, SSA-ARANA-03
- **T3-47** (test_v3) esperado `centro_hoy`, predicho `urgencia` — SOBRE-TRIAJE: disparó IITT-R-ABD-01 [dolor_abdominal_intenso=true, edad_meses=?]. Frases detectadas: "le duele mucho pansa"→dolor_abdominal_intenso, "le duele mucho pansa"→dolor_abdominal
  - Texto: "Le duele mucho la panza desde la mañana; es un señor, no sé cuántos años tiene."
  - Reglas disparadas: IITT-R-ABD-01, IITT-Y-PAIN-01
- **T3-48** (test_v3) esperado `centro_hoy`, predicho `urgencia` — SOBRE-TRIAJE: disparó SSA-ALAC-01 [picadura_alacran=true, edad_meses=?]. Frases detectadas: "le pico alacran"→picadura_alacran, "pico alacran"→picadura_alacran, "pico alacran"→picadura_alacran
  - Texto: "Le picó un alacrán al chamaco en la mano; está llorando, nomás le duele."
  - Reglas disparadas: SSA-ALAC-01, SSA-ALAC-04
- **T3-68** (test_v3) esperado `aqui`, predicho `urgencia` — SOBRE-TRIAJE: disparó GEN-CYAN-01 [cianosis=true, apnea=?]. Frases detectadas: "se le puso morado"→cianosis
  - Texto: "Don Pancho, de 66, se dio un golpe en la rodilla con la mesa; se le puso morado, pero camina bien y no está hinchado."
  - Reglas disparadas: GEN-CYAN-01

## Casos con datos insuficientes (`expected_uncertain`)

| Caso | Split | Nivel esperado → predicho | Aviso "no estoy segura" | Preguntas | ¿Pide el dato esperado? |
|---|---|---|---|---|---|
| D22 | dev | centro_hoy → centro_hoy | sí (questions_pending) | tiraje, estridor | no |
| D23 | dev | centro_hoy → centro_hoy | sí (questions_pending) | tiraje, lejos_unidad | sí |
| T12 | test_v1 | centro_hoy → centro_hoy | sí (questions_pending) | lejos_unidad, estridor | sí |
| T13 | test_v1 | centro_hoy → centro_hoy | sí (questions_pending) | tiraje, lejos_unidad | sí |
| T2-C01 | test_v2 | centro_hoy → centro_hoy | sí (questions_pending) | lejos_unidad, estridor | sí |
| T2-C13 | test_v2 | centro_hoy → centro_hoy | sí (questions_pending, pregnancy_few) | sangrado_vaginal, dolor_cabeza_intenso | sí |
| T2-C14 | test_v2 | centro_hoy → centro_hoy | sí (age_missing, questions_pending) | tiraje, estridor | no |
| T2-A10 | test_v2 | aqui → aqui | sí (no_findings, young_infant_few) | — | no |
| T3-02 | test_v3 | urgencia → centro_hoy | sí (questions_pending) | embarazada | sí |
| T3-21 | test_v3 | centro_hoy → centro_hoy | sí (questions_pending) | embarazada, cauda_equina | sí |
| T3-37 | test_v3 | centro_hoy → centro_hoy | sí (questions_pending) | embarazada, no_puede_beber | sí |
| T3-44 | test_v3 | centro_hoy → centro_hoy | sí (questions_pending) | sexo, embarazada, vomita_todo | sí |
| T3-47 | test_v3 | centro_hoy → urgencia | no | — | no |
| T3-48 | test_v3 | centro_hoy → urgencia | no | — | no |
| T3-51 | test_v3 | aqui → aqui | sí (danger_signs_unchecked, questions_pending) | signo_peligro_general, sexo, embarazada, dolor_derecha_baja | sí |
