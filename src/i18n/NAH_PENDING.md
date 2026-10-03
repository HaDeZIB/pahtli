# Náhuatl — estado de traducciones

**Regla:** no inventamos náhuatl. Solo se muestra en la interfaz una palabra si la encontramos en una fuente académica. Todo lo demás se queda en español hasta que lo revise un hablante nativo de la variante de la región donde se use la app.

## Verificadas (en uso en `strings.ts`)

| Clave | Náhuatl | Español | Fuente |
|---|---|---|---|
| `yes` | Quema | Sí | Molina 1571 ("quema. si. afirmando algo"); Karttunen 1992; Carochi 1645 — vía [Online Nahuatl Dictionary, Univ. of Oregon](https://nahuatl.wired-humanities.org/content/quema) |
| `no` | Amo (ahmō) | No | Molina 1571 ("amo. no. adverbio para negar"); Carochi 1645 — [fuente](https://nahuatl.wired-humanities.org/content/amo) |
| `app_name` | Pahtli (patli) | Medicina, remedio | Molina 1552/1571; IDIEZ — [fuente](https://nahuatl.wired-humanities.org/content/patli) |
| `NAH_THANKS` | Tlazohcamati | Gracias | [Online Nahuatl Dictionary](https://nahuatl.wired-humanities.org/content/tlazocamati) |

**Advertencia de variante:** las fuentes anteriores documentan náhuatl clásico/central. El INALI reconoce 30 variantes de náhuatl (Catálogo de las Lenguas Indígenas Nacionales, 2008). La ortografía y algunas palabras cambian entre la Huasteca, la Sierra de Puebla, Guerrero, etc. Hay que validar con un hablante de la región antes de usar la app en campo.

## Pendientes (se muestran en español)

Necesitan traducción de un hablante nativo y revisión (de preferencia de un traductor certificado por el INALI / PANITLI):

- [ ] Nombres de los tres niveles: "Atender aquí", "Centro de salud hoy", "Urgencia"
- [ ] "Por qué" / "Qué hacer ahora"
- [ ] Aviso: "Herramienta de apoyo. No sustituye la valoración médica."
- [ ] "Sin internet — todo corre en tu celular"
- [ ] Botones: "Evaluar", "Guardar caso", "Nuevo paciente", "Escuchar"
- [ ] Preguntas de seguimiento (las genera el motor clínico en `src/triage/`)
- [ ] Explicaciones y acciones de cada regla (`explicacion.nah`, `accion.nah` en `src/triage/rules/`)
- [ ] Nombres de síntomas (`SYMPTOMS[k].nah` en `src/triage/findings.ts`)
- [ ] Instrucciones para contar respiraciones

## Ruta (roadmap)

- Voz en náhuatl (STT): no hay hoy un modelo que corra bien en celular de gama baja. Meta MMS lo cubre, pero el modelo pesa ~1B parámetros.
- Lectura en voz alta (TTS) en náhuatl: no hay voz del sistema en iOS/Android.
