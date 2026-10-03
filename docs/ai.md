# IA on-device de Pahtli: voz, extracción y niveles de dispositivo

> Escrito el 3 de octubre de 2026. Todo lo que sigue se midió o se leyó en una fuente que va enlazada. Lo que **no** se midió se marca como **NO MEDIDO**.
> Regla de diseño: la IA solo **extrae** hallazgos. El motor de reglas (`src/triage`) **decide** el nivel. El modelo nunca baja el nivel.

## 1. Resumen de decisiones

| Pieza | Elección | Tamaño | Por qué |
|---|---|---|---|
| Voz a texto | `onnx-community/whisper-base`, cuantizado q8, **WASM** en un Web Worker | 79 MB (encoder 23.2 + decoder 53.7 + tokenizer) | En nuestro banco, `whisper-tiny` q8 dejó sin sentido 5 de los 6 audios de una de las voces (1 de ellos en bucle de repetición). `base` transcribió con sentido los 12 audios. |
| Runtime ONNX | `ort-wasm-simd-threaded.asyncify.wasm`, servido desde nuestro propio origen | 26.9 MB (6.8 MB gzip) | No dependemos de cdn.jsdelivr.net. El service worker lo guarda en caché, así funciona en modo avión. |
| Extractor principal | `src/ai/keywords.ts`: reglas puras sobre español coloquial | 0 MB | Es determinista, auditable y corre en todos los dispositivos. También es la red de seguridad. |
| LLM (opcional, nivel A) | `Llama-3.2-1B-Instruct-q4f16_1-MLC` con WebLLM en un Worker, en **modo paráfrasis** | 705 MB de descarga; 879 MB de VRAM estimada | Fue el único de los 3 modelos probados que parafraseó con sentido en español. Qwen2.5-0.5B y Gemma-3-1B produjeron síntomas casi aleatorios. |
| Fusión | Unión de positivos. Una negación explícita de keywords gana. Los números vienen solo de keywords. Cada frase del LLM pasa por un filtro de anclaje al texto. | – | Seguridad: el LLM puede sumar síntomas, pero no puede borrar ni inventar números. |

## 2. Niveles de dispositivo (`src/ai/capability.ts`)

| Nivel | Condición detectada | Qué corre |
|---|---|---|
| **A** | Hay adaptador WebGPU con `maxBufferSize` ≥ 256 MB y `maxStorageBufferBindingSize` ≥ 128 MB (los mínimos que exige `detectGPUDevice()` de web-llm 0.2.85). Además, `deviceMemory` ≥ 4 GB donde el navegador lo expone. iOS no expone `deviceMemory`, así que un iPhone con WebGPU cuenta como A. | Whisper base (WASM) + LLM opcional (WebGPU) |
| **B** | Hay WASM y micrófono, pero no hay WebGPU utilizable, o hay poca RAM | Whisper base (WASM). Usa tiny solo si `deviceMemory` ≤ 2 GB. Sin LLM: WebLLM requiere WebGPU. |
| **C** | Sin WASM, sin micrófono, sin HTTPS, o `deviceMemory` < 2 GB | Botones, texto, keywords y reglas |

`detectTier()` nunca lanza. `requestAdapter()` tiene un timeout de 4 s. Medido en Chromium (Mac con Apple Silicon): `webgpu: true`, `shaderF16: true`, `maxBufferMB: 4096`, nivel **A**.

## 3. Voz a texto (`stt.ts`, `stt.worker.ts`, `transcript.ts`)

### 3.1 Banco de prueba

Audios sintéticos de español de México hechos con `say` de macOS, voces *Paulina* y *Eddy (es_MX)*, 16 kHz mono. Son 6 frases clínicas coloquiales × 2 voces. La lista de frases está en `src/ai/__bench__/bench.ts`.

| Modelo | Bucles o basura | Latencia por clip de 4–6 s |
|---|---|---|
| whisper-tiny q8, sin guardas | 1/12 en bucle + 4/12 sin sentido (todos de la voz Eddy) | Node CPU: 0.2–0.5 s (el bucle: 4.2 s) |
| whisper-tiny q4 | 3/12 en bucle | Node CPU: 0.3–2 s |
| whisper-base q4 | 0/12 en bucle | Node CPU: 0.45–0.67 s |
| **whisper-base q8** + guardas | **0/12**. Errores típicos: "su dor frío", "le **huele** el pecho" | **Chromium WASM de 1 hilo: 2.2–2.4 s**; Node CPU: 0.45–0.6 s |
| iPhone 14 Pro (Safari) | – | **NO MEDIDO** |

- Las guardas son `no_repeat_ngram_size: 4` y `max_new_tokens: 128`. Con ellas, tiny dejó de entrar en bucle, pero siguió transcribiendo mal a la voz Eddy.
- Whisper siempre procesa una ventana de 30 s. Por eso la latencia es casi constante para clips cortos.
- La carga desde caché tarda unos 3 s. El calentamiento con 1 s de silencio está incluido.
- **De voz a nivel:** con las 12 transcripciones reales de whisper-base, keywords y reglas dieron **el mismo nivel que con el texto de referencia en 12 de 12 casos**. Para llegar ahí se añadió una corrección medida: "le huele el pecho / la cabeza" se lee como "le duele" (`asrFix` en `keywords.ts`). Sin ella, 2 casos de urgencia salían como "aquí". Ese fue el hallazgo más importante del banco.

### 3.2 Por qué WASM y no WebGPU para Whisper

1. transformers.js 4.x tiene una fuga de memoria GPU en Whisper, de unos 650 MB por cada bloque de 30 s. El issue sigue abierto y el arreglo todavía no está publicado: [transformers.js#1739](https://github.com/huggingface/transformers.js/issues/1739) y [PR #1755](https://github.com/huggingface/transformers.js/pull/1755). Usamos la 4.3.0.
2. La memoria GPU del iPhone queda libre para el LLM.
3. El q8 de Whisper "timestamped" fallaba en la versión 4.2 ([#1707](https://github.com/huggingface/transformers.js/issues/1707), corregido en 4.3.0). Nosotros usamos el export **no** timestamped, y q8 carga bien en 4.3.0. Lo verificamos en Node y en Chromium.

### 3.3 Grabación en iOS Safari

- El `AudioContext` se crea y se reanuda **de forma síncrona dentro del toque**, antes del `await getUserMedia`. Hay fallback a `webkitAudioContext`.
- La captura usa `ScriptProcessorNode` conectado a `destination` con ganancia 0. Safari solo procesa el grafo si llega a `destination`, y así no hace falta un archivo de worklet.
- El remuestreo de 48 kHz a 16 kHz usa `OfflineAudioContext`, que trae filtro anti-alias. Si falla, se usa promedio por ventana.
- El estado `interrupted` (llamada, Siri) se trata como `suspended`.
- Si el audio es silencio (RMS < 0.004), se devuelve `''` sin correr el modelo, para evitar las alucinaciones de Whisper. La salida se limpia de frases de subtítulos ("Amara.org", "suscríbete") y de repeticiones (`cleanTranscript`).
- **NO PROBADO en un iPhone real.** Esta sección se basa en el conocimiento documentado de la Web Audio API, no en una prueba en el teléfono.

## 4. LLM on-device (`llm.ts`, `llm.worker.ts`, `prompt.ts`)

### 4.1 Candidatos

Las cifras de VRAM vienen de `prebuiltAppConfig` en `node_modules/@mlc-ai/web-llm` 0.2.85. Las descargas son la suma de archivos de la API de Hugging Face.

| Modelo MLC | Descarga | VRAM estimada |
|---|---|---|
| SmolLM2-360M-Instruct-q4f16_1 | 207 MB | 376 MB |
| Qwen2.5-0.5B-Instruct-q4f16_1 | 290 MB | 945 MB |
| Qwen3-0.6B-q4f16_1 | 352 MB | 1403 MB |
| gemma3-1b-it-q4f16_1 | 602 MB | 711 MB |
| **Llama-3.2-1B-Instruct-q4f16_1** | **705 MB** | **879 MB** |
| Qwen2.5-1.5B-Instruct-q4f16_1 | 880 MB | 1630 MB |

- SmolLM2 se descartó sin probarlo: su entrenamiento está centrado en inglés.
- Qwen3-0.6B se descartó por su VRAM de 1.4 GB, demasiado cerca del límite del iPhone (ver §5).
- Qwen2.5-1.5B también se descartó por memoria.
- Llama 3.2 declara soporte oficial de español (`language: [..., 'es', ...]` en su model card) y su licencia es `llama3.2`.

### 4.2 Resultados del banco

Medido en Chromium con WebGPU (Mac con Apple Silicon), 12 frases clínicas, `temperature: 0`.

| Modelo / modo | Prompt | Prefill | Decode | Latencia | Calidad |
|---|---|---|---|---|---|
| Qwen2.5-0.5B, **JSON con esquema** (101 claves en enum) | ~1830 tok | ~1480 tok/s | ~40 tok/s | 2.7–3.0 s | **Inútil.** Marcó `embarazada: true` en 10 de 12 casos, incluido el de un niño. Los síntomas salieron casi aleatorios: "tiraje" en un niño con tos, "palidez" en un infarto. `level_hint` siempre fue "aqui". |
| Gemma-3-1B, JSON | ~1670 tok | ~515 tok/s | ~21 tok/s | ~11 s | **Inútil.** Entró en bucle repitiendo la misma clave del enum ("sibilancias" ×30). |
| Qwen2.5-0.5B, **paráfrasis** | ~235 tok | – | – | 0.23–0.31 s | Mala: inventó términos como "hipoventura" y "paroxísmico". |
| Gemma-3-1B, paráfrasis | ~200 tok | ~950 tok/s | ~48 tok/s | 0.2–0.9 s | Mala: copió los ejemplos del prompt ("ojos hundidos", "tos") y a veces devolvió salida vacía. |
| **Llama-3.2-1B, paráfrasis** | ~235 tok | **~790 tok/s** | **~57 tok/s** | **0.48–0.76 s** | **Razonable.** Algunas alucinaciones, como "dolor en el pecho" a partir de "se le hunde el pecho", o "vómitos". Todas las alucinaciones observadas las descarta el **filtro de anclaje**. Carga: 44 s la primera vez (705 MB) y 2.1 s desde caché. |

En iPhone 14 Pro, el prefill, el decode y la latencia están **NO MEDIDOS**. Por la diferencia de GPU se espera que sea varias veces más lento que en la Mac, pero no tenemos el número.

**Resultado con Llama-3.2-1B, paráfrasis y filtro de anclaje** sobre las 12 frases del banco:

- 0 falsos positivos añadidos.
- 0 hallazgos nuevos que keywords no tuviera ya.

Sobre 8 frases "difíciles" fuera del vocabulario:

- Keywords falló en 7 de 8 la primera vez. Después se añadieron sinónimos para esas frases. Esto es sobreajuste a ese banco y lo declaramos: hay que medir la generalización con el set de evaluación independiente (`eval/`).
- El LLM aportó **1** hallazgo correcto ("dificultad para hablar" en un caso de EVC).

**Conclusión honesta:** con modelos de 1B o menos en el navegador, el LLM **no mejora** de forma medible lo que ya extraen las reglas de keywords. Lo dejamos como **opción experimental del nivel A** y no lo usamos como argumento de la demo. La decisión vive en las reglas, y la extracción que importa es la de keywords.

### 4.3 Modo paráfrasis

Es el modo por defecto. El modo JSON sigue disponible con `localStorage['pahtli:llm_mode'] = 'json'`.

1. El LLM recibe un prompt corto (unos 200 tokens) con 2 ejemplos. Devuelve una lista "- síntoma" en español estándar, solo con lo que está presente.
2. Cada línea pasa por `groundedIn()`: al menos 2/3 de sus palabras de contenido deben aparecer en el relato. Se compara la raíz fonética sin diminutivos, de modo que "ojitos" coincide con "ojos" y "sangrando" con "sangrado".
3. Las líneas que pasan se mapean a claves del catálogo **con el mismo extractor determinista** (`keywordExtract`). El catálogo cerrado nunca lo decide el LLM.
4. Este modo no aporta números ni `level_hint`. En el banco, el `level_hint` de los modelos pequeños siempre fue "aqui", así que no aportaba nada. Con esto, `PAHTLI-MODEL-ESC` del motor queda disponible pero no se activa en este modo.

Otras protecciones:

- Timeout de 25 s con `interruptGenerate()` y `resetChat()`.
- Una sola extracción a la vez.
- Si algo falla, se devuelve `null` y la app sigue solo con keywords.

## 5. iOS / Safari: lo que sabemos y lo que no

| Hecho | Fuente |
|---|---|
| WebGPU viene activado por defecto en Safari 26 para iOS, iPadOS, macOS y visionOS | [WebKit: Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/) |
| El proceso WebContent de un iPhone tiene un límite de **unos 1.5 GB**, que varía por equipo y que el SO impone por experiencia de usuario. Además está el Gigacage de unos 2 GB para TypedArray/WASM | Comentario de un ingeniero de WebKit en [WebKit bug 268816](https://bugs.webkit.org/show_bug.cgi?id=268816) |
| Un artículo de 2026 afirma que en iOS la memoria de una pestaña de Safari es **< 500 MB**. Con su backend llama.cpp+WebGPU solo corrieron modelos de hasta Qwen3-0.6B y Bonsai-1.7B en iPhone 15 y 17 Pro Max, a 4–17 tok/s. También reportan fugas de WebLLM en Safari | [LlamaWeb, arXiv 2605.20706](https://arxiv.org/abs/2605.20706) |
| En iOS 26, Safari cerró la pestaña al cargar Qwen2.5-3B, mientras SmolLM2-135M sí funcionó | [web-llm#753](https://github.com/mlc-ai/web-llm/issues/753) |
| El proceso GPU de WebKit en la versión 26 tenía una fuga, corregida el 5 de diciembre de 2025 | [WebKit bug 303203](https://bugs.webkit.org/show_bug.cgi?id=303203) |
| `maxBufferSize` en Safari: 100% de los equipos ≥ 256 MB, 97% ≥ 512 MB, 80% ≥ 858 MB | [web3dsurvey maxBufferSize](https://web3dsurvey.com/webgpu/limits/maxBufferSize) |
| `shader-f16` está disponible en el 100% de los navegadores iOS medidos (la muestra no se publica) | [web3dsurvey shader-f16 iOS](https://web3dsurvey.com/webgpu/features/shader-f16/platform/iOS) |

**Lo que no sabemos:** si Llama-3.2-1B (879 MB de VRAM) más Whisper base en WASM caben juntos en un iPhone 14 Pro (6 GB de RAM) sin que Safari cierre la pestaña. Las fuentes se contradicen: una dice < 500 MB y otra unos 1.5 GB.

**Recomendación para la demo:** probar en el teléfono antes de grabar.

- Si Safari cierra la pestaña ("Ocurrió un problema con esta página web"), dejar el LLM apagado.
- La demo funciona igual con voz, keywords y reglas.
- No activar el LLM durante la grabación sin haberlo probado antes.

## 6. Náhuatl por voz: no es viable on-device hoy

[facebook/mms-1b-all](https://huggingface.co/facebook/mms-1b-all) sí incluye variantes de náhuatl: `nch`, `ncj`, `ngu`, `nhe`, `nhi`, `nhw`, `azz`. Pero tiene **964,845,850 parámetros en F32**, según los metadatos safetensors de Hugging Face. Eso son unos **3.9 GB** de pesos, más de 10 veces Whisper base, y no cabe en un celular de gama baja ni en una pestaña de Safari. Una versión destilada o cuantizada para el navegador queda en la hoja de ruta.

## 7. Limitaciones conocidas

- **Sinónimos coloquiales no validados.** Los de `findings.ts` y `EXTRA_SYNONYMS` los compilamos nosotros y hay que revisarlos con promotoras.
- **Banco pequeño y sintético.** Usa voces TTS, no acentos rurales reales, sin ruido de fondo y sin niños llorando. Las cifras de WER y de latencia en iPhone están **NO MEDIDAS**.
- **Negación heurística.** La ventana mira 5 palabras hacia atrás y se corta en "y", "pero" y la puntuación. En listas con comas ("no tiene tos, mocos ni fiebre") puede no negar el elemento del medio. Cuando no se sabe, el sistema prefiere no marcar `false`. Además, "ya no X" no se niega (cuenta como "lo tuvo").
- **Edad de adultos sin número.** "La señora" sin edad queda con edad desconocida. Por diseño del motor, eso puede disparar reglas pediátricas, es decir, sobre-triaje en la dirección segura.
- **Meses de embarazo a semanas.** Se convierte como `ceil(meses × 4.345)`, una aproximación. Por ejemplo, 7 meses da 31 semanas.
- **Hilos WASM.** Sin cabeceras COOP/COEP no hay `crossOriginIsolated` y ONNX corre con 1 hilo. Activarlas aceleraría Whisper, pero puede romper la descarga de modelos desde Hugging Face. No lo cambiamos.
- **Precache grande.** El precache del service worker pesa unos 40 MB: el runtime ONNX (27 MB) más los chunks de los workers. Lo descarga todo visitante en la primera carga, incluso en nivel C. Es necesario para la voz offline. La configuración vive en `vite.config.ts`, que no es de este módulo.
- **Carga automática del LLM.** `AppContext` lo carga al iniciar si ya se había descargado antes. En iPhone eso deja Whisper y el LLM en memoria a la vez (ver §5).

## 8. Cómo reproducir

```bash
npx vitest run src/ai          # 82 pruebas: keywords, negación, números, fusión, parser del LLM, paráfrasis real
npx tsc -b --noEmit

# Banco en navegador (solo desarrollo; no entra al build):
npx vite --port 5199
# abrir http://localhost:5199/src/ai/__bench__/bench.html  (#hard = frases difíciles)
# Audios de prueba (no se versionan): en src/ai/__bench__/
#   say -v Paulina -o p1_Paul.wav --data-format=LEI16@16000 "La niña tiene un año, ..."
#   say -v "Eddy (Spanish (Mexico))" -o p1_Eddy.wav --data-format=LEI16@16000 "..."
# Cambiar de modelo: localStorage['pahtli:llm_model'] = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC' | 'gemma3-1b-it-q4f16_1-MLC'
#                    localStorage['pahtli:stt_model'] = 'whisper-tiny'
```
