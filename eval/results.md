# Resultados de la evaluación de Pahtli

> Generado por `npm run eval` el 2026-10-03T20:26:47.875Z. Pipeline: texto → `keywordExtract` → `triage` (Node, sin LLM).
> Viñetas sintéticas escritas por el equipo, **pendientes de validación clínica por la Dra. Ines**. El split `test` se escribió primero y no se usó para ajustar nada.

## Métricas

| Métrica | dev | test | total |
|---|---:|---:|---:|
| Casos | 60 | 30 | 90 |
| Exactitud (nivel exacto) | 98.3% (59/60) | 76.7% (23/30) | 91.1% (82/90) |
| **Sub-triaje de urgencias** (urgencia → menor) | **0.0%** (0/22) | **18.2%** (2/11) | **6.1%** (2/33) |
| …de ellas, sin pregunta de seguimiento que lo rescate | 0.0% (0/22) | 9.1% (1/11) | 3.0% (1/33) |
| Sub-triaje total (cualquier nivel → menor) | 0.0% (0/60) | 23.3% (7/30) | 7.8% (7/90) |
| Sobre-triaje total | 1.7% (1/60) | 0.0% (0/30) | 1.1% (1/90) |
| Sensibilidad de referencia (centro/urgencia ≠ aquí) | 100.0% (42/42) | 66.7% (14/21) | 88.9% (56/63) |
| Reglas esperadas que dispararon (todas) | 98.3% (59/60) | 73.3% (22/30) | 90.0% (81/90) |
| Recall / precisión `aqui` | 100.0% / 100.0% | 100.0% / 56.3% | 100.0% / 79.4% |
| Recall / precisión `centro_hoy` | 95.0% / 100.0% | 50.0% / 100.0% | 80.0% / 100.0% |
| Recall / precisión `urgencia` | 100.0% / 95.7% | 81.8% / 100.0% | 93.9% / 96.9% |
| Latencia extracción+triaje (media / p95, ms) | 0.37 / 1.72 | 0.25 / 0.45 | 0.33 / 0.62 |

### Matriz de confusión — dev

| esperado \ predicho | aquí | centro hoy | urgencia |
|---|---:|---:|---:|
| **aquí** | **18** | 0 | 0 |
| **centro hoy** | 0 | **19** | 1 |
| **urgencia** | 0 | 0 | **22** |

### Matriz de confusión — test

| esperado \ predicho | aquí | centro hoy | urgencia |
|---|---:|---:|---:|
| **aquí** | **9** | 0 | 0 |
| **centro hoy** | 5 | **5** | 0 |
| **urgencia** | 2 | 0 | **9** |

### Matriz de confusión — total

| esperado \ predicho | aquí | centro hoy | urgencia |
|---|---:|---:|---:|
| **aquí** | **27** | 0 | 0 |
| **centro hoy** | 5 | **24** | 1 |
| **urgencia** | 2 | 0 | **31** |

## Extracción por campo (contra valores de referencia anotados en `expected_findings`)

| Campo | dev | test | total |
|---|---:|---:|---:|
| `duracion_dias` | 100.0% (2/2) | 100.0% (2/2) | 100.0% (4/4) |
| `edad_meses` | 100.0% (53/53) | 100.0% (26/26) | 100.0% (79/79) |
| `embarazada` | 100.0% (7/7) | 100.0% (4/4) | 100.0% (11/11) |
| `resp_por_min` | 100.0% (4/4) | 100.0% (3/3) | 100.0% (7/7) |
| `semanas_embarazo` | 100.0% (2/2) | 100.0% (1/1) | 100.0% (3/3) |
| `temperatura_c` | 100.0% (4/4) | — | 100.0% (4/4) |

## Fallos de nivel

- **T02** (test) esperado `urgencia`, predicho `aqui` — SUB-TRIAJE (extracción incompleta): no disparó IMCI-YI-01 [no_come_bien=?, no_puede_beber=?, edad_meses=0.7]
  - Texto: "Es un bebito de tres semanas de nacido, la mamá dice que desde la mañana ya no quiere agarrar el pecho y lo siente calientito."
  - Reglas disparadas: IMCI-NOSIGNS-01 · la app NO pregunta el dato faltante
- **T04** (test) esperado `urgencia`, predicho `aqui` — SUB-TRIAJE (extracción incompleta): no disparó CDC-HEART-01 [dolor_pecho=?, edad_meses=696]
  - Texto: "Un señor de 58 años dice que siente como un peso en el pecho que se le corre al brazo izquierdo, y está sudando frío."
  - Reglas disparadas: IMCI-NOSIGNS-01 · preguntas de seguimiento: dolor_pecho, llenado_capilar_lento · **la app pregunta el dato faltante**
- **T14** (test) esperado `centro_hoy`, predicho `aqui` — SUB-TRIAJE (extracción incompleta): no disparó IMCI-DIAR-05 [sangre_heces=?, edad_meses=24]
  - Texto: "La niña de 2 años hace del baño con sangre desde ayer, pero sí toma agua y está despierta."
  - Reglas disparadas: IMCI-NOSIGNS-01 · la app NO pregunta el dato faltante
- **T15** (test) esperado `centro_hoy`, predicho `aqui` — SUB-TRIAJE (extracción incompleta): no disparó IITT-Y-BITE-01 [mordedura_animal=?]
  - Texto: "Un perro le mordió la pierna a un niño de 9 años, no le sale mucha sangre."
  - Reglas disparadas: IMCI-NOSIGNS-01 · la app NO pregunta el dato faltante
- **T17** (test) esperado `centro_hoy`, predicho `aqui` — SUB-TRIAJE (extracción incompleta): no disparó WHO-PCPNC-EMB-02 [embarazada=true, posparto=?, hinchazon_cara_manos=?]
  - Texto: "Señora de 25 años embarazada de seis meses, se le hinchan mucho las manos y la cara."
  - Reglas disparadas: IMCI-NOSIGNS-01 · preguntas de seguimiento: sangrado_vaginal, dolor_cabeza_intenso · la app NO pregunta el dato faltante
- **T18** (test) esperado `centro_hoy`, predicho `aqui` — SUB-TRIAJE (extracción incompleta): no disparó IITT-Y-TRAUMA-01 [fractura=?, quemadura=?]
  - Texto: "El señor de 40 años se tropezó en el camino y se cayó, tiene la muñeca chueca y bien hinchada."
  - Reglas disparadas: IMCI-NOSIGNS-01 · la app NO pregunta el dato faltante
- **T19** (test) esperado `centro_hoy`, predicho `aqui` — SUB-TRIAJE (extracción incompleta): no disparó PAHO-DEN-03 [fiebre=true, fiebre_reciente=?, nauseas=?, vomito=?, vomito_persistente=?, sarpullido=?, dolor_cabeza=?, dolor_detras_ojos=true, dolor_muscular_articular=?, petequias=?]
  - Texto: "Muchacha de 20 años con calentura desde hace dos días, le duele detrás de los ojos y le duele todo el cuerpo, no tiene ningún sangrado."
  - Reglas disparadas: IMCI-NOSIGNS-01 · preguntas de seguimiento: embarazada, vomita_todo · la app NO pregunta el dato faltante
- **D35** (dev) esperado `centro_hoy`, predicho `urgencia` — SOBRE-TRIAJE: disparó IITT-R-NEURO-01 [letargico=?, confusion=?, rigidez_nuca=?, dolor_cabeza=true, fiebre=true, temperatura_c=?, edad_meses=456]. Frases detectadas: "dolor de cabesa fuerte"→dolor_cabeza_intenso, "dolor de cabesa"→dolor_cabeza, "con calentura"→fiebre, "calentura"→fiebre, "ronchas"→sarpullido
  - Texto: "Señora de 38 años con calentura de tres días, dolor de cabeza fuerte, ronchas y náusea."
  - Reglas disparadas: IITT-R-NEURO-01, PAHO-DEN-03
