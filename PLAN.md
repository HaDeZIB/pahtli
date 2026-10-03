# Pahtli — Plan técnico
> *Pahtli* = "medicina" en náhuatl. Nombre de trabajo, se puede cambiar.
> Hack-Nation 7th Global AI Hackathon · Reto #4 World Bank "Small AI for Development" · Hub Toluca-CDMX · 3–4 oct 2026

---

## 0. La tesis en una línea (esto guía TODAS las decisiones)

**Una promotora de salud en una comunidad sin señal habla con su celular de $2,000, y en menos de 10 segundos sabe si el paciente se atiende ahí, va al centro de salud hoy, o es urgencia — con la regla clínica oficial que lo justifica. Sin internet. Sin nube. Sin inventar.**

Los 3 diferenciadores que nos hacen ganar (y que el resto de equipos NO va a tener):

1. **La IA no decide sola.** El modelo pequeño *entiende* (voz → síntomas estructurados). Un **motor de reglas clínicas auditable** basado en AIEPI/OMS *decide*. Regla de oro: **el modelo solo puede subir la gravedad, nunca bajarla.** Esto es seguridad clínica real, no un chatbot.
2. **Medimos.** Un set de evaluación de casos clínicos con métricas publicadas en el README (sub-triaje, sobre-triaje, latencia en celular, tamaño en MB). Casi ningún equipo de hackathon mide. Los jueces de "technical depth" lo notan inmediato.
3. **El celular es un sensor epidemiológico.** Cuando vuelve la señal, los casos sincronizados alimentan un tablero del centro de salud que detecta brotes (ej. 5 casos de diarrea con sangre en la misma comunidad en 48 h). Pasamos de "app de triaje" a "red de vigilancia desde el borde".

---

## 1. Restricciones que dicta el reto (y cómo las cumplimos)

| Exigencia World Bank | Cómo la cumplimos |
|---|---|
| Offline-capable | PWA con Service Worker; modelos cacheados en el dispositivo; IndexedDB local. **Demo en modo avión.** |
| Dispositivos que la gente ya tiene | Corre en navegador de Android gama baja. Sin instalar desde Play Store. 3 niveles de capacidad (ver §3.4). |
| Idiomas locales | Español por voz + interfaz y frases clave en náhuatl + pictogramas para baja alfabetización. |
| Datos reales | Reglas basadas en AIEPI (Secretaría de Salud/OMS) y signos de alarma oficiales; casos de evaluación con fuente. |
| Targeted (enfocado) | Un solo usuario: **promotora de salud rural**. Un solo flujo: triaje. Nada más. |

**Exigencia de la entrega:** demo hosteada en Vercel → la app es web (PWA). Esto es una ventaja, no una limitación: un link abre la app en cualquier celular, se instala en pantalla de inicio y funciona offline.

---

## 2. Alcance — qué SÍ y qué NO (disciplina de hackathon)

### MVP obligatorio (sin esto no hay entrega)
- [ ] PWA instalable y 100% funcional en modo avión
- [ ] Captura por voz en español (STT on-device) + respaldo por texto/botones
- [ ] Extracción de síntomas estructurados (edad, síntomas, duración, signos de alarma)
- [ ] Motor de reglas → 3 niveles: 🟢 Atender aquí · 🟡 Centro de salud hoy · 🔴 Urgencia
- [ ] Explicación con la regla citada ("Porque: niño <5 años con respiración rápida — AIEPI")
- [ ] Registro local de casos (IndexedDB) + cola de sincronización
- [ ] Sincronización a la nube cuando hay señal
- [ ] Deploy en Vercel + README completo

### Diferenciadores (en orden de prioridad)
1. [ ] Set de evaluación + script de métricas + tabla en README
2. [ ] Tablero del centro de salud con mapa y alerta de brote
3. [ ] Respuesta hablada (TTS offline) y pantalla de resultado con pictogramas
4. [ ] Modo náhuatl (interfaz + frases de resultado)
5. [ ] Indicador "corre 100% en tu dispositivo" con latencia y MB visibles (para la demo)

### Fuera de alcance (NO tocar aunque sobre tiempo)
- Login/usuarios reales, roles, permisos
- Diagnóstico ("tiene neumonía"). **Hacemos triaje, no diagnóstico.** Esto es tanto ético como estratégico.
- Recetas o dosis de medicamentos
- App nativa Android
- Fine-tuning de modelos (no da tiempo para hacerlo bien; mejor prompt + reglas + eval)

---

## 3. Arquitectura

### 3.1 Diagrama

```
┌──────────────────────── CELULAR DE LA PROMOTORA (offline) ────────────────────────┐
│                                                                                    │
│  🎤 Voz ──► [STT on-device]  Whisper (tiny/base) vía transformers.js (WASM/WebGPU) │
│                 │                                                                  │
│                 ▼  texto: "niña de 2 años, tiene calentura desde ayer y respira    │
│                           muy rápido, no quiere comer"                             │
│  [EXTRACTOR]  LLM pequeño on-device (Qwen 0.5–1.5B q4)  ──►  JSON estructurado      │
│               + extractor por reglas/keywords (respaldo y verificación cruzada)     │
│                 │   { edad_meses: 24, fiebre: true, duracion_h: 24,                │
│                 │     resp_rapida: true, no_come: true, ... }                      │
│                 ▼                                                                  │
│  [MOTOR DE REGLAS CLÍNICAS]  TypeScript puro, determinista, testeado               │
│     AIEPI / signos de alarma ──► nivel + reglas disparadas + preguntas faltantes   │
│                 │                                                                  │
│                 ▼  (si faltan datos críticos → hace 1–2 preguntas de seguimiento)   │
│  [RESULTADO]  🟢/🟡/🔴 + "por qué" con cita + qué hacer ahora + TTS + pictograma    │
│                 │                                                                  │
│                 ▼                                                                  │
│  [IndexedDB / Dexie]  casos + outbox de sincronización                             │
│  [Service Worker]     app shell + modelos en Cache Storage                         │
└────────────────────────────────────┬───────────────────────────────────────────────┘
                                     │  cuando vuelve la señal (online event / Background Sync)
                                     ▼
┌──────────────────────────── NUBE (Vercel) ─────────────────────────────┐
│  /api/sync   (Vercel Function)  ── idempotente por case_id             │
│  Postgres (Supabase o Neon)     ── casos anonimizados                  │
│  /tablero    Dashboard centro de salud: mapa, conteos, ALERTA DE BROTE │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Por qué "LLM extrae + reglas deciden" (el argumento para jueces)
- Un modelo de 0.5–1.5B **alucina** si le pides decidir. Pero es bueno convirtiendo lenguaje coloquial ("tiene calentura", "se le hunde el pecho", "anda muy aguado") a campos estructurados.
- Las reglas son **auditables, citables y testeables**. Un médico puede revisarlas línea por línea.
- **Asimetría de seguridad:** `nivel_final = max(nivel_reglas, nivel_sugerido_por_modelo)`. El modelo puede encender una alarma; nunca apagarla.
- Si el modelo no carga (celular viejo), el extractor por keywords + botones sigue funcionando → **degradación elegante**.

### 3.3 Stack tecnológico

| Capa | Tecnología | Razón |
|---|---|---|
| Framework | **Vite + React + TypeScript** | Rápido, Claude Code lo domina, build estático ideal para PWA |
| PWA / offline | **vite-plugin-pwa (Workbox)** | Service worker, precache, instalable |
| Estilos | **Tailwind CSS** | Velocidad; botones grandes, alto contraste para sol/campo |
| Almacenamiento local | **Dexie (IndexedDB)** | Casos + outbox; robusto offline |
| STT on-device | **transformers.js v3 + Whisper tiny/base (es)** | Corre en navegador, WebGPU con respaldo WASM |
| LLM on-device | **WebLLM (MLC)** o **transformers.js** con Qwen2.5/Qwen3 0.5B–1.5B Instruct q4 | Salida JSON; elegir el que gane en el spike de la hora 1 |
| TTS | **Web Speech API (speechSynthesis)** | Voces en español offline ya vienen en Android |
| Motor de reglas | **TypeScript puro + Vitest** | Determinista, 100% testeable |
| Backend | **Vercel Functions** (`/api/sync`) | Mismo deploy que el front |
| Base de datos | **Supabase Postgres** (o Neon) | Gratis, rápido de montar |
| Mapa del tablero | **Leaflet + OpenStreetMap** | Gratis, sin API key |
| Tests E2E | **Playwright** con emulación offline | Prueba real de "funciona en modo avión" |
| Deploy | **Vercel** + GitHub público | Requisito de entrega |

### 3.4 Niveles de capacidad del dispositivo (detección automática al abrir)
| Nivel | Requisito | Qué corre |
|---|---|---|
| **A — Completo** | WebGPU + ≥4 GB RAM | Whisper base + LLM 1.5B |
| **B — Ligero** | WASM, ≥2 GB RAM | Whisper tiny + LLM 0.5B |
| **C — Mínimo** | Cualquier navegador | Botones/pictogramas + texto + extractor por keywords + reglas |

**El triaje funciona en los 3 niveles** porque la decisión vive en las reglas, no en el modelo. Este es un argumento fuerte de "devices people already have".

### 3.5 Distribución de modelos (el problema real del offline)
- Primera carga **una sola vez** con WiFi (en el centro de salud o en la cabecera municipal). Barra de progreso: "Descargando cerebro de Pahtli: 380 MB".
- Se guarda en Cache Storage/OPFS → después, cero internet.
- Mostrar en la app: tamaño total en disco y "última sincronización".

---

## 4. Motor clínico (el corazón del proyecto)

### 4.1 Fuentes
- **AIEPI** (Atención Integrada a las Enfermedades Prevalentes de la Infancia, OMS/UNICEF, adoptada por la Secretaría de Salud de México) → signos generales de peligro, respiración rápida por edad, deshidratación, fiebre.
- **Signos de alarma en adultos y embarazo** (lineamientos de la Secretaría de Salud / OMS): sangrado, convulsiones, dolor de pecho, dificultad respiratoria, signos de alarma obstétrica, dengue con signos de alarma.
- **Cada regla lleva `fuente` y `id`** para poder citarla en pantalla y en el README.

### 4.2 Estructura de una regla (ejemplo)
```ts
{
  id: "AIEPI-RESP-01",
  nivel: "urgencia",
  aplica: (c) => c.edad_meses >= 2 && c.edad_meses < 12 && c.resp_por_min >= 50,
  explicacion_es: "Bebé de 2 a 11 meses con respiración rápida (50 o más por minuto).",
  explicacion_nah: "...",
  accion_es: "Llevar al centro de salud o al hospital AHORA. Mantenerlo abrigado.",
  fuente: "AIEPI, OPS/OMS — Evaluar tos o dificultad para respirar"
}
```

### 4.3 Bloques de reglas del MVP (aprox. 30–40 reglas)
1. Signos generales de peligro (cualquier edad): convulsiones, inconsciente, no puede beber, vomita todo
2. Respiratorio (niño <5 años): respiración rápida por edad, tiraje subcostal, estridor
3. Diarrea/deshidratación: ojos hundidos, signo del pliegue, sangre en heces, >14 días
4. Fiebre: niño <2 meses con fiebre = urgencia; fiebre >7 días; dengue con signos de alarma
5. Embarazo: sangrado, dolor de cabeza intenso + visión borrosa, hinchazón, no se mueve el bebé
6. Adulto: dolor de pecho, dificultad para respirar, debilidad de un lado del cuerpo, sangrado abundante

### 4.4 Preguntas de seguimiento inteligentes
Si un dato crítico falta (ej. edad, o "¿respira rápido?"), el motor devuelve `preguntas_faltantes` y la app hace **máximo 2 preguntas** con botones Sí/No. Incluir guía de **contar respiraciones con temporizador de 60 s** en pantalla (herramienta real de AIEPI → muy buena para la demo).

### 4.5 Validación clínica
**Acción de Brandon:** mandarle las reglas y el set de casos a Ines (o cualquier médico de confianza) para revisión rápida. Una línea en el README tipo *"Reglas revisadas por la Dra. X"* sube muchísimo la credibilidad. Si no da tiempo, decirlo honestamente en el README.

---

## 5. Evaluación (lo que nos separa del resto)

- **Set de 60–100 viñetas clínicas** en español coloquial mexicano ("mi niño anda muy decaído, no quiere el pecho y tiene calentura"), cada una con el nivel correcto y la regla esperada. Generadas con Claude Code y revisadas a mano; idealmente revisadas por un médico.
- Script `npm run eval` que corre el pipeline completo (texto → extractor → reglas) y reporta:
  - **Tasa de sub-triaje** (urgencia clasificada como menor) ← la métrica que importa; meta: 0% en casos rojos
  - Sobre-triaje
  - Exactitud por nivel (matriz de confusión)
  - Exactitud de extracción por campo
  - Latencia en celular real (STT + LLM + reglas)
- Comparativa en el README: **solo reglas con keywords vs LLM+reglas** → demuestra qué aporta el modelo. Esto es oro para "technical depth" y para el video técnico ("qué funcionó y qué no").

---

## 6. Sincronización y tablero

### 6.1 Sincronización (patrón outbox)
- Cada caso se guarda con `case_id` (UUID generado en el dispositivo), `synced=false`.
- Al detectar `online` → POST por lotes a `/api/sync` → upsert idempotente por `case_id` → marca `synced=true`.
- **Datos anonimizados:** sin nombre del paciente. Solo edad, sexo, síntomas, nivel, comunidad, timestamp. (Mencionarlo en el README: privacidad por diseño.)

### 6.2 Tablero del centro de salud (`/tablero`)
- Mapa con comunidades y casos por nivel
- Contadores del día/semana
- **Detección de brotes:** regla simple tipo *"≥ N casos del mismo síndrome en la misma comunidad en 72 h"* → tarjeta roja "Posible brote: diarrea con sangre en San Miguel (5 casos)".
- Datos sembrados (seed) para que la demo se vea viva + los casos reales que se hagan en vivo.

---

## 7. UX — diseñada para el campo
- Botón gigante de micrófono, una pantalla por paso
- Alto contraste (se usa a pleno sol), fuente grande
- Resultado a pantalla completa en color: verde / amarillo / rojo + ícono + frase corta + "Por qué"
- Pictogramas para síntomas en modo botones (baja alfabetización)
- Indicador permanente: ✈️ "Sin internet — funcionando en tu celular" / 🔄 "3 casos por sincronizar"
- Disclaimer visible y breve: "Herramienta de apoyo. No reemplaza al médico."

### Sobre náhuatl — honestidad brutal
No existe hoy un reconocimiento de voz en náhuatl que corra bien en un celular de gama baja (Meta MMS lo soporta pero el modelo pesa ~1B parámetros). Plan realista:
- **MVP:** interfaz y frases de resultado en náhuatl (texto + pictogramas). Voz en español (las promotoras suelen ser bilingües).
- **Roadmap (en README y video):** STT en náhuatl con un modelo MMS destilado/adaptador ligero.
- Las traducciones al náhuatl hay que marcarlas como "pendientes de validación por hablante nativo" a menos que consigamos uno. **No inventar idioma frente a jueces.**

---

## 8. Estructura del repo

```
pahtli/
├─ README.md                 # descripción, demo, arquitectura, métricas, setup
├─ PLAN.md                   # este documento
├─ apps/web/                 # PWA (Vite + React)
│  ├─ src/
│  │  ├─ triage/             # motor de reglas (puro, sin UI)
│  │  │  ├─ rules/           # reglas por bloque con fuente
│  │  │  ├─ engine.ts
│  │  │  └─ engine.test.ts
│  │  ├─ ai/                 # stt.ts, extractor.ts, capability.ts (niveles A/B/C)
│  │  ├─ db/                 # dexie, outbox, sync
│  │  ├─ i18n/               # es, nah
│  │  ├─ screens/            # Captura, Preguntas, Resultado, Historial, Tablero
│  │  └─ sw/                 # service worker
│  └─ api/sync.ts            # Vercel Function
├─ eval/
│  ├─ cases.jsonl            # viñetas clínicas
│  └─ run-eval.ts            # métricas
└─ docs/                     # diagramas, capturas
```

---

## 9. Cómo exprimimos Claude Code

| Uso | Cómo |
|---|---|
| **Agentes en paralelo** | Subagentes trabajando a la vez en piezas independientes: (1) motor de reglas + tests, (2) PWA/offline/UI, (3) STT/LLM on-device, (4) sync + tablero, (5) set de evaluación. Cada uno en su propio worktree de git para no pisarse. |
| **Workflow multi-agente** | Si lo autorizas (di "usa un workflow"), orquesto los 5 frentes en un solo workflow con verificación cruzada. Consume más tokens pero es lo más rápido. |
| **TDD del motor clínico** | Claude escribe primero los tests desde las viñetas, luego las reglas hasta que todo pase. |
| **Generación del set de eval** | Viñetas en español coloquial mexicano con casos borde y adversariales. |
| **Verificación en navegador** | El navegador integrado prueba la app real, emula móvil, corta la red y comprueba que todo funcione offline, con screenshots como evidencia. |
| **Playwright offline** | Test E2E automatizado: "abrir app → modo avión → triaje completo → caso guardado → reconectar → caso sincronizado". |
| **Code review** | `/code-review` antes de entregar, para cazar bugs. |
| **README y diagramas** | Generados a partir del código real y de las métricas reales del eval. |
| **Guiones de video** | Te dejo los guiones de los 3 videos de 60 s y una lista de tomas (tú grabas). |

---

## 10. Cronograma (asumiendo ~24 h; ajustar a la hora real de cierre)

| Hora | Bloque | Entregable | Riesgo que mata |
|---|---|---|---|
| **0–1** | Setup + **spike técnico en TU celular Android** | Repo, Vite+PWA desplegado en Vercel; Whisper + LLM corriendo en tu teléfono real | ⚠️ **El más importante.** Si el LLM no corre en tu teléfono, bajamos a 0.5B o al nivel C *ahora*, no a las 3 am. |
| 1–4 | Motor de reglas + tests (en paralelo: UI base) | 30+ reglas con fuente, tests verdes | |
| 4–8 | Pipeline voz → extractor → reglas → resultado | Flujo completo funcionando offline en laptop | Calidad de la extracción en español coloquial |
| 8–10 | IndexedDB + outbox + `/api/sync` + Supabase | Casos guardados y sincronizados | |
| 10–12 | Set de eval + `npm run eval` + iterar prompt | Métricas reales; 0% sub-triaje en casos rojos | |
| 12–15 | Tablero + mapa + alerta de brote + seed | `/tablero` vivo | |
| 15–17 | Pulido UX: TTS, pictogramas, náhuatl, contador de respiraciones | Demo bonita | |
| 17–19 | Prueba en celular real en modo avión + Playwright + fixes | Evidencia offline | Service worker/caché de modelos |
| 19–21 | README, diagrama, métricas, `/code-review` | Repo listo para jueces | |
| 21–23 | **Tú grabas los videos** (guiones ya listos) | 3 videos + foto | |
| 23–24 | Buffer y entrega | Submission | No dejar esto para el último minuto |

**Regla de corte:** si a la hora 12 el LLM on-device sigue dando problemas, nos quedamos con extractor por keywords + Whisper, y el LLM pasa a "nivel A experimental". La demo NO puede depender de lo más frágil.

---

## 11. Riesgos y mitigación

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| LLM demasiado pesado/lento en el celular | Alta | Spike en hora 0; niveles A/B/C; reglas funcionan sin LLM |
| Whisper entiende mal el español rural | Media | Mostrar transcripción editable; respaldo por botones |
| Service worker no cachea modelos grandes | Media | Probar temprano; Cache Storage/OPFS; precarga explícita con progreso |
| Jueces dudan de la seguridad clínica | Media | Reglas citadas, asimetría de seguridad, métricas de sub-triaje, disclaimer, revisión médica |
| Náhuatl mal traducido | Alta | Alcance honesto; marcar "pendiente de validación" |
| Vercel/Supabase falla en la demo | Baja | La demo principal es offline: no depende de la nube |

---

## 12. Guion de la demo (lo que verán los jueces en el video de 60 s)
1. Celular en **modo avión** (se ve el ícono) — "Aquí no hay señal."
2. La promotora habla: *"Niña de 1 año, tiene calentura desde ayer, respira muy rápido y se le hunde el pecho."*
3. 🔴 **URGENCIA** a pantalla completa + "Por qué: respiración rápida y tiraje subcostal en menor de 5 años (AIEPI)" + la app lo dice en voz alta.
4. Segundo caso rápido → 🟢 "Atender aquí" con indicaciones.
5. Se quita el modo avión → "2 casos sincronizados" → el tablero del centro de salud muestra **alerta de brote**.
6. Cierre con métrica: *"0% de sub-triaje en 80 casos de prueba. 380 MB. Cero internet."*

---

## 13. Decisiones pendientes de Brandon
1. **¿Cuántos son en el equipo y qué hace cada quien?** (si estás solo con Claude Code, el plan sigue igual; los agentes en paralelo hacen el trabajo del equipo)
2. **¿A qué hora exacta se cierra la entrega?** Para ajustar el cronograma.
3. **¿Qué celular Android tienes a la mano?** (modelo/RAM) — define el spike de la hora 0.
4. **¿Puedes conseguir que Ines u otro médico revise las reglas** aunque sean 20 minutos?
5. **¿Autorizas usar un workflow multi-agente** para construir los frentes en paralelo?
6. **¿Nombre final?** Pahtli u otro.

---

## 14. ACTUALIZACIÓN — Concept Note del World Bank (leído 3-oct)

La final la juzga un **panel del World Bank** (shortlist 5–6 oct, ganador por sector viaja a **Seúl, 21 oct**). Su rúbrica es distinta a la de Hack-Nation:

| Criterio WB | Peso | Qué hacemos |
|---|---|---|
| Small AI fidelity (funciona end-to-end dentro de las restricciones) | 25% | Offline total, MB del modelo publicados, demo en modo avión |
| Relevancia para el desarrollo e impacto | 20% | Problema real de atención primaria rural en México con datos citados |
| Data grounding | 15% | `docs/data.md`: fuentes, año, licencia, tamaño y **qué NO cubren los datos** (se califica) |
| Evidencia de que funciona | 15% | Eval con split separado + pruebas en iPhone real |
| Value proposition de la IA (¿lo haría un SMS o una hoja de cálculo?) | 15% | Voz coloquial → hallazgos estructurados. Un formulario o SMS no entiende "se le hunde el pecho" |
| Escalabilidad / replicabilidad | 10% | Reglas por país como datos; exportar al formato DHIS2; otros idiomas |
| **IA responsable: PASA / NO PASA** | gate | **Fail-safe obligatorio: "No estoy seguro, consulta a una persona"**, humano decide, privacidad |

### Cambios al producto
1. **Cuarto resultado: "⚪ No hay datos suficientes, consulta al personal de salud"** cuando faltan datos críticos o hay baja confianza (extractor LLM vs keywords en desacuerdo, transcripción ambigua). Esto lo pide explícitamente el pass/fail.
2. **La promotora decide:** puede aceptar o cambiar el nivel con un motivo, y queda registrado. La IA informa, no actúa.
3. **Referencia offline al centro más cercano** con el catálogo oficial CLUES (Secretaría de Salud): "Centro de Salud X, 8 km". Para urgencias, el hospital más cercano.
4. **Privacidad:** dónde viven los datos, quién los lee y qué pasa si se pierde o se comparte el celular: PIN de la app y borrado de casos ya sincronizados.
5. **Exportar casos en formato DHIS2** (tracker/event) para mostrar encaje institucional.
6. **Pantalla "Acerca de la IA"** en la app: modelo, MB, qué hace y qué no, límites.

### Cambios a la entrega
- Video del World Bank: **2 a 5 min** (distinto a los 3 videos de 60 s de Hack-Nation). Debe incluir el **problem statement** con su plantilla: *"Because of this tool, [user] will [action] by [when] that they would otherwise [not do / do late / do worse]; we know because [evidence]."* También: capacidades de IA y por qué no basta algo más simple, guardrails, demo del recorrido completo, dónde entra la herramienta en el día de la promotora, stack técnico, y **"what localizing AI development means to you"**.
- Idioma local: hay que nombrarlo (español de México y náhuatl en la interfaz) y esperar la pregunta "¿cómo le iría en un idioma con menos soporte?". La respuesta está en `docs/data.md` §C.
