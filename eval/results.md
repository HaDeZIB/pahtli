# Resultados de la evaluación de Pahtli

> Generado por `npm run eval` el 2026-10-03T21:47:45.903Z. Pipeline: texto → `keywordExtract` → `triage` (Node, sin LLM) + fail-safe `assessUncertainty`.
> Viñetas sintéticas escritas por el equipo, **pendientes de validación clínica por la Dra. Ines**.
> `dev` se usó para ajustar. `test_v1` (held-out original) ya se vio y se usó en la ronda 2: ahora es solo regresión. **`test_v2` es el held-out vigente**: se escribió y congeló antes de los cambios de la ronda 2.

## Métricas

| Métrica | dev | test_v1 | test_v2 | total |
|---|---:|---:|---:|---:|
| Casos | 60 | 30 | 40 | 130 |
| Exactitud (nivel exacto) | 100.0% (60/60), IC95 94–100 % | 100.0% (30/30), IC95 89–100 % | 92.5% (37/40), IC95 80–97 % | 97.7% (127/130), IC95 93–99 % |
| **Sub-triaje de urgencias** (urgencia → menor) | **0.0%** (0/22), IC95 0–15 % | **0.0%** (0/11), IC95 0–26 % | **18.8%** (3/16), IC95 7–43 % | **6.1%** (3/49), IC95 2–17 % |
| …de ellas, sin pregunta de seguimiento que pida el dato faltante | 0/22 | 0/11 | 2/16 | 2/49 |
| …de ellas, **en silencio** (sin pregunta y sin aviso "no estoy segura") | 0/22 | 0/11 | 1/16 | 1/49 |
| Sub-triaje total (cualquier nivel → menor) | 0.0% (0/60) | 0.0% (0/30) | 7.5% (3/40) | 2.3% (3/130) |
| Sobre-triaje total | 0.0% (0/60) | 0.0% (0/30) | 0.0% (0/40) | 0.0% (0/130) |
| Sensibilidad de referencia (centro/urgencia ≠ aquí) | 100.0% (42/42), IC95 92–100 % | 100.0% (21/21), IC95 85–100 % | 96.7% (29/30), IC95 83–99 % | 98.9% (92/93), IC95 94–100 % |
| Reglas esperadas que dispararon (todas) | 100.0% (60/60) | 100.0% (30/30) | 92.5% (37/40) | 97.7% (127/130) |
| Recall / precisión `aqui` | 100.0% / 100.0% | 100.0% / 100.0% | 100.0% / 90.9% | 100.0% / 97.4% |
| Recall / precisión `centro_hoy` | 100.0% / 100.0% | 100.0% / 100.0% | 100.0% / 87.5% | 100.0% / 95.7% |
| Recall / precisión `urgencia` | 100.0% / 100.0% | 100.0% / 100.0% | 81.3% / 100.0% | 93.9% / 100.0% |
| Síntomas anotados extraídos bien (afirmados · negados) | — | — | 94.6% (70/74) · 63/67 · 7/7 | 94.6% (70/74) · 63/67 · 7/7 |
| Nivel con hallazgos anotados (extracción perfecta) | — | — | 100.0% (36/36) | 100.0% (36/36) |
| Casos `expected_uncertain`: aviso "no estoy segura" · pregunta algo · pregunta el dato esperado | 2/2 · 2/2 · 1/2 | 2/2 · 2/2 · 2/2 | 4/4 · 3/4 · 2/4 | 8/8 · 7/8 · 5/8 |
| Aviso "no estoy segura" en casos sin falta de datos (ruido) — si salta las preguntas | 30/58 | 11/28 | 20/36 | 61/122 |
| …ruido si contesta las preguntas como en la app (hasta 4; Sí/No según lo anotado o "No") | 11/58 | 4/28 | 9/36 | 24/122 |
| Latencia extracción+triaje (media / p95, ms) | 0.56 / 2 | 0.38 / 0.5 | 0.38 / 0.69 | 0.46 / 0.84 |

### Matriz de confusión — dev

| esperado \ predicho | aquí | centro hoy | urgencia |
|---|---:|---:|---:|
| **aquí** | **18** | 0 | 0 |
| **centro hoy** | 0 | **20** | 0 |
| **urgencia** | 0 | 0 | **22** |

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

### Matriz de confusión — total

| esperado \ predicho | aquí | centro hoy | urgencia |
|---|---:|---:|---:|
| **aquí** | **37** | 0 | 0 |
| **centro hoy** | 0 | **44** | 0 |
| **urgencia** | 1 | 2 | **46** |

## Extracción por campo (contra valores de referencia anotados en `expected_findings`)

| Campo | dev | test_v1 | test_v2 | total |
|---|---:|---:|---:|---:|
| `duracion_dias` | 100.0% (2/2) | 100.0% (2/2) | 100.0% (3/3) | 100.0% (7/7) |
| `edad_meses` | 100.0% (53/53) | 100.0% (26/26) | 100.0% (31/31) | 100.0% (110/110) |
| `embarazada` | 100.0% (7/7) | 100.0% (4/4) | 100.0% (6/6) | 100.0% (17/17) |
| `resp_por_min` | 100.0% (4/4) | 100.0% (3/3) | 100.0% (3/3) | 100.0% (10/10) |
| `semanas_embarazo` | 100.0% (2/2) | 100.0% (1/1) | 100.0% (4/4) | 100.0% (7/7) |
| `temperatura_c` | 100.0% (4/4) | — | 100.0% (1/1) | 100.0% (5/5) |

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
  - Reglas disparadas: IMCI-NOSIGNS-01 · preguntas de seguimiento: resp_por_min, tiraje · **la app pregunta el dato faltante** · aviso "no estoy segura" (questions_pending)
- **T2-V09** (test_v2) esperado `urgencia`, predicho `centro_hoy` — SUB-TRIAJE (extracción incompleta): no disparó IITT-R-POISON-01 [intoxicacion=?]
  - Texto: "La señora de 40 años se tomó un frasco entero de pastillas de su mamá, la encontraron muy dormida en su cuarto."
  - Reglas disparadas: IITT-Y-WEAK-01 · preguntas de seguimiento: rigidez_nuca, dolor_cabeza · la app NO pregunta el dato faltante · aviso "no estoy segura" (questions_pending)
- **T2-V13** (test_v2) esperado `urgencia`, predicho `centro_hoy` — SUB-TRIAJE (negación errónea): no disparó IITT-R-RESP-01 [dificultad_respirar=false, edad_meses=96]
  - Texto: "Mi sobrino de 8 años es asmático y ahorita no puede ni hablar de lo que le cuesta respirar, le chilla el pecho."
  - Reglas disparadas: IITT-Y-WHEEZE-01 · la app NO pregunta el dato faltante

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
