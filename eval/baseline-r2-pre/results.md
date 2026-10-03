# Resultados de la evaluación de Pahtli

> Generado por `npm run eval` el 2026-10-03T20:36:30.332Z. Pipeline: texto → `keywordExtract` → `triage` (Node, sin LLM) + fail-safe `assessUncertainty`.
> Viñetas sintéticas escritas por el equipo, **pendientes de validación clínica por la Dra. Ines**.
> `dev` se usó para ajustar. `test_v1` (held-out original) ya se vio y se usó en la ronda 2: ahora es solo regresión. **`test_v2` es el held-out vigente**: se escribió y congeló antes de los cambios de la ronda 2.

## Métricas

| Métrica | dev | test_v1 | test_v2 | total |
|---|---:|---:|---:|---:|
| Casos | 60 | 30 | 40 | 130 |
| Exactitud (nivel exacto) | 98.3% (59/60), IC95 91–100 % | 76.7% (23/30), IC95 59–88 % | 62.5% (25/40), IC95 47–76 % | 82.3% (107/130), IC95 75–88 % |
| **Sub-triaje de urgencias** (urgencia → menor) | **0.0%** (0/22), IC95 0–15 % | **18.2%** (2/11), IC95 5–48 % | **62.5%** (10/16), IC95 39–82 % | **24.5%** (12/49), IC95 15–38 % |
| …de ellas, sin pregunta de seguimiento que pida el dato faltante | 0/22 | 1/11 | 5/16 | 6/49 |
| …de ellas, **en silencio** (sin pregunta y sin aviso "no estoy segura") | 0/22 | 0/11 | 1/16 | 1/49 |
| Sub-triaje total (cualquier nivel → menor) | 0.0% (0/60) | 23.3% (7/30) | 37.5% (15/40) | 16.9% (22/130) |
| Sobre-triaje total | 1.7% (1/60) | 0.0% (0/30) | 0.0% (0/40) | 0.8% (1/130) |
| Sensibilidad de referencia (centro/urgencia ≠ aquí) | 100.0% (42/42), IC95 92–100 % | 66.7% (14/21), IC95 45–83 % | 56.7% (17/30), IC95 39–73 % | 78.5% (73/93), IC95 69–86 % |
| Reglas esperadas que dispararon (todas) | 98.3% (59/60) | 73.3% (22/30) | 57.5% (23/40) | 80.0% (104/130) |
| Recall / precisión `aqui` | 100.0% / 100.0% | 100.0% / 56.3% | 100.0% / 43.5% | 100.0% / 64.9% |
| Recall / precisión `centro_hoy` | 95.0% / 100.0% | 50.0% / 100.0% | 64.3% / 81.8% | 75.0% / 94.3% |
| Recall / precisión `urgencia` | 100.0% / 95.7% | 81.8% / 100.0% | 37.5% / 100.0% | 75.5% / 97.4% |
| Síntomas anotados extraídos bien (afirmados · negados) | — | — | 62.2% (46/74) · 39/67 · 7/7 | 62.2% (46/74) · 39/67 · 7/7 |
| Nivel con hallazgos anotados (extracción perfecta) | — | — | 100.0% (36/36) | 100.0% (36/36) |
| Casos `expected_uncertain`: aviso "no estoy segura" · pregunta algo · pregunta el dato esperado | 2/2 · 2/2 · 1/2 | 2/2 · 2/2 · 2/2 | 4/4 · 3/4 · 2/4 | 8/8 · 7/8 · 5/8 |
| Aviso "no estoy segura" en casos sin falta de datos (ruido) | 34/58 | 14/28 | 29/36 | 77/122 |
| Latencia extracción+triaje (media / p95, ms) | 0.36 / 1.57 | 0.24 / 0.45 | 0.25 / 0.46 | 0.3 / 0.5 |

### Matriz de confusión — dev

| esperado \ predicho | aquí | centro hoy | urgencia |
|---|---:|---:|---:|
| **aquí** | **18** | 0 | 0 |
| **centro hoy** | 0 | **19** | 1 |
| **urgencia** | 0 | 0 | **22** |

### Matriz de confusión — test_v1

| esperado \ predicho | aquí | centro hoy | urgencia |
|---|---:|---:|---:|
| **aquí** | **9** | 0 | 0 |
| **centro hoy** | 5 | **5** | 0 |
| **urgencia** | 2 | 0 | **9** |

### Matriz de confusión — test_v2

| esperado \ predicho | aquí | centro hoy | urgencia |
|---|---:|---:|---:|
| **aquí** | **10** | 0 | 0 |
| **centro hoy** | 5 | **9** | 0 |
| **urgencia** | 8 | 2 | **6** |

### Matriz de confusión — total

| esperado \ predicho | aquí | centro hoy | urgencia |
|---|---:|---:|---:|
| **aquí** | **37** | 0 | 0 |
| **centro hoy** | 10 | **33** | 1 |
| **urgencia** | 10 | 2 | **37** |

## Extracción por campo (contra valores de referencia anotados en `expected_findings`)

| Campo | dev | test_v1 | test_v2 | total |
|---|---:|---:|---:|---:|
| `duracion_dias` | 100.0% (2/2) | 100.0% (2/2) | 100.0% (3/3) | 100.0% (7/7) |
| `edad_meses` | 100.0% (53/53) | 100.0% (26/26) | 100.0% (31/31) | 100.0% (110/110) |
| `embarazada` | 100.0% (7/7) | 100.0% (4/4) | 83.3% (5/6) | 94.1% (16/17) |
| `resp_por_min` | 100.0% (4/4) | 100.0% (3/3) | 100.0% (3/3) | 100.0% (10/10) |
| `semanas_embarazo` | 100.0% (2/2) | 100.0% (1/1) | 100.0% (4/4) | 100.0% (7/7) |
| `temperatura_c` | 100.0% (4/4) | — | 100.0% (1/1) | 100.0% (5/5) |

> Fallos por caso ocultos para: test_v2 (corrida de línea base; no se miran para no ajustar sobre el held-out).

## Fallos de nivel

- **T02** (test_v1) esperado `urgencia`, predicho `aqui` — SUB-TRIAJE (extracción incompleta): no disparó IMCI-YI-01 [no_come_bien=?, no_puede_beber=?, edad_meses=0.7]
  - Texto: "Es un bebito de tres semanas de nacido, la mamá dice que desde la mañana ya no quiere agarrar el pecho y lo siente calientito."
  - Reglas disparadas: IMCI-NOSIGNS-01 · la app NO pregunta el dato faltante · aviso "no estoy segura" (young_infant_few)
- **T04** (test_v1) esperado `urgencia`, predicho `aqui` — SUB-TRIAJE (extracción incompleta): no disparó CDC-HEART-01 [dolor_pecho=?, edad_meses=696]
  - Texto: "Un señor de 58 años dice que siente como un peso en el pecho que se le corre al brazo izquierdo, y está sudando frío."
  - Reglas disparadas: IMCI-NOSIGNS-01 · preguntas de seguimiento: dolor_pecho, llenado_capilar_lento · **la app pregunta el dato faltante** · aviso "no estoy segura" (questions_pending)
- **T14** (test_v1) esperado `centro_hoy`, predicho `aqui` — SUB-TRIAJE (extracción incompleta): no disparó IMCI-DIAR-05 [sangre_heces=?, edad_meses=24]
  - Texto: "La niña de 2 años hace del baño con sangre desde ayer, pero sí toma agua y está despierta."
  - Reglas disparadas: IMCI-NOSIGNS-01 · la app NO pregunta el dato faltante
- **T15** (test_v1) esperado `centro_hoy`, predicho `aqui` — SUB-TRIAJE (extracción incompleta): no disparó IITT-Y-BITE-01 [mordedura_animal=?]
  - Texto: "Un perro le mordió la pierna a un niño de 9 años, no le sale mucha sangre."
  - Reglas disparadas: IMCI-NOSIGNS-01 · la app NO pregunta el dato faltante
- **T17** (test_v1) esperado `centro_hoy`, predicho `aqui` — SUB-TRIAJE (extracción incompleta): no disparó WHO-PCPNC-EMB-02 [embarazada=true, posparto=?, hinchazon_cara_manos=?]
  - Texto: "Señora de 25 años embarazada de seis meses, se le hinchan mucho las manos y la cara."
  - Reglas disparadas: IMCI-NOSIGNS-01 · preguntas de seguimiento: sangrado_vaginal, dolor_cabeza_intenso · la app NO pregunta el dato faltante · aviso "no estoy segura" (no_findings, questions_pending, pregnancy_few)
- **T18** (test_v1) esperado `centro_hoy`, predicho `aqui` — SUB-TRIAJE (extracción incompleta): no disparó IITT-Y-TRAUMA-01 [fractura=?, quemadura=?]
  - Texto: "El señor de 40 años se tropezó en el camino y se cayó, tiene la muñeca chueca y bien hinchada."
  - Reglas disparadas: IMCI-NOSIGNS-01 · la app NO pregunta el dato faltante
- **T19** (test_v1) esperado `centro_hoy`, predicho `aqui` — SUB-TRIAJE (extracción incompleta): no disparó PAHO-DEN-03 [fiebre=true, fiebre_reciente=?, nauseas=?, vomito=?, vomito_persistente=?, sarpullido=?, dolor_cabeza=?, dolor_detras_ojos=true, dolor_muscular_articular=?, petequias=?]
  - Texto: "Muchacha de 20 años con calentura desde hace dos días, le duele detrás de los ojos y le duele todo el cuerpo, no tiene ningún sangrado."
  - Reglas disparadas: IMCI-NOSIGNS-01 · preguntas de seguimiento: embarazada, vomita_todo · la app NO pregunta el dato faltante · aviso "no estoy segura" (questions_pending)
- **D35** (dev) esperado `centro_hoy`, predicho `urgencia` — SOBRE-TRIAJE: disparó IITT-R-NEURO-01 [letargico=?, confusion=?, rigidez_nuca=?, dolor_cabeza=true, fiebre=true, temperatura_c=?, edad_meses=456]. Frases detectadas: "dolor de cabesa fuerte"→dolor_cabeza_intenso, "dolor de cabesa"→dolor_cabeza, "con calentura"→fiebre, "calentura"→fiebre, "ronchas"→sarpullido
  - Texto: "Señora de 38 años con calentura de tres días, dolor de cabeza fuerte, ronchas y náusea."
  - Reglas disparadas: IITT-R-NEURO-01, PAHO-DEN-03

## Casos con datos insuficientes (`expected_uncertain`)

| Caso | Split | Nivel esperado → predicho | Aviso "no estoy segura" | Preguntas | ¿Pide el dato esperado? |
|---|---|---|---|---|---|
| D22 | dev | centro_hoy → centro_hoy | sí (questions_pending) | tiraje, estridor | no |
| D23 | dev | centro_hoy → centro_hoy | sí (questions_pending) | tiraje, lejos_unidad | sí |
| T12 | test_v1 | centro_hoy → centro_hoy | sí (questions_pending) | lejos_unidad, estridor | sí |
| T13 | test_v1 | centro_hoy → centro_hoy | sí (questions_pending) | tiraje, lejos_unidad | sí |
