# Sincronización y vigilancia (tablero)

## 1. Guardado local y outbox

- Cada caso se guarda primero en el celular (IndexedDB vía Dexie, `src/db/db.ts`) con un `case_id` UUID generado en el dispositivo (`crypto.randomUUID()`) y `synced=false`.
- `src/db/sync.ts` implementa el **patrón outbox**:
  - `syncNow()` envía la cola en lotes de 50 a `POST /api/sync`. Solo marca `synced=true` los `case_id` que el servidor reporta en `accepted` (los inválidos se quedan en la cola).
  - **Idempotente:** el servidor hace upsert por `case_id`; si la señal se corta después de enviar y antes de marcar, reenviar no duplica.
  - `startAutoSync(onChange)` intenta al evento `online`, al volver la app a primer plano y cada 30 s mientras haya conexión. Tras un fallo aplica **backoff exponencial** (30 s, 60 s, 2 min… máx. 10 min); el evento `online` lo reinicia.
- **Privacidad por diseño:** la app no pide nombre del paciente. Al servidor **no viaja** el texto transcrito (podría contener nombres dichos en voz alta) ni el nombre de la promotora; solo edad, sexo, síntomas estructurados, nivel, síndrome, reglas disparadas, comunidad, coordenadas aproximadas y hora. El servidor además descarta cualquier campo fuera de esa lista.

## 2. API (Vercel Functions)

| Ruta | Qué hace |
|---|---|
| `POST /api/sync` | Valida `{ cases: [...] }` (máx. 500), hace upsert en Supabase tabla `cases`. Responde `{ stored, demo, accepted, rejected }`. |
| `GET /api/cases?days=14&limit=500` | Casos recientes con forma `CaseRecord` para el tablero. |

Sin `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, `/api/sync` responde `200 { stored:false, demo:true }` y `/api/cases` devuelve `[]`: **la demo nunca se rompe**, el tablero usa los casos locales + datos de demostración.

Configurar Supabase: ejecutar `docs/supabase.sql`, poner las dos variables en Vercel (Project → Settings → Environment Variables) y, opcionalmente, sembrar: `npx tsx scripts/seed-remote.ts https://<app>.vercel.app`.

En desarrollo local con `npm run dev` (Vite) no existen las rutas `/api/*`; la sincronización falla y reintenta con backoff (comportamiento correcto). Para probarlas localmente: `vercel dev`.

## 3. Alerta temprana de brotes (`src/surveillance/outbreak.ts`)

Función pura `detectOutbreaks(cases, now, opts)`:

- **≥ 3 casos del mismo síndrome en la misma comunidad dentro de 72 h** → alerta.
- **≥ 2** si el síndrome es `diarrea_sangre` o `febril_hemorragico` (alto potencial epidémico/gravedad) → severidad alta.
- **≥ 3 urgencias** en la misma comunidad en 72 h, sin importar el síndrome → "racimo de urgencias".
- Ignora el síndrome `otro` (inespecífico), deduplica por `case_id`, normaliza nombres de comunidad (acentos/mayúsculas) y descarta casos fuera de la ventana. Umbrales y ventana configurables.

### Fundamento y límites (honestidad)

Esto es una **heurística de alerta temprana sindrómica**, no una definición oficial de brote ni un sustituto del sistema oficial. Se inspira en:

1. **NOM-017-SSA2-2012, Para la vigilancia epidemiológica** (DOF, 19-feb-2013). Define *brote* como la ocurrencia de dos o más casos asociados epidemiológicamente entre sí, y exige notificar brotes de inmediato (antes de 24 h) al nivel superior. Por eso el umbral de 2 para los síndromes de mayor riesgo y el texto de la tarjeta sugiere notificar a la Jurisdicción Sanitaria.
   https://dof.gob.mx/nota_detalle.php?codigo=5288225&fecha=19/02/2013
2. **OMS — Early warning alert and response (EWAR) in emergencies: an operational guide** (2023, ISBN 978-92-4-006358-7). Marco de vigilancia basada en indicadores con umbrales de alerta simples para detectar eventos agudos temprano en entornos con pocos recursos.
   https://www.who.int/publications/i/item/9789240063587

Para comparar: el ACNUR (Emergency Handbook, "Disease surveillance", https://emergency.unhcr.org/node/552, consultado 3-oct-2026) usa como umbral de alerta para diarrea con sangre **5 casos en una localidad en un día**, en contextos de emergencia humanitaria (campamentos de refugiados). Nuestro umbral es **más sensible a propósito** porque las comunidades son pequeñas (cientos a pocos miles de habitantes) y la herramienta solo genera una *señal para verificar*, no una confirmación. Más falsos positivos es el costo aceptado; cada alerta requiere verificación por epidemiología.

Limitaciones conocidas: no usa línea base histórica (no hay datos previos), depende de que el síndrome se clasifique bien a partir de lo que reporta la promotora, y la hora proviene del reloj del celular.

## 4. Tablero (`#/tablero`, `src/screens/Dashboard.tsx`)

- Une y deduplica por `case_id`: casos del celular (Dexie, en vivo) + red (`/api/cases`, si hay señal) + **datos de demostración** (`src/surveillance/seed.ts`, se pueden ocultar con una casilla).
- KPIs (hoy, 7 días, urgencias, pendientes), alertas, mapa Leaflet/OpenStreetMap, barras por síndrome y tabla filtrable.
- Datos de demostración: 40 casos ficticios en 6 comunidades reales del municipio de **Cuetzalan del Progreso, Puebla** (San Miguel Tzinacapan, Yohualichan, Xiloxochico, Cuauhtamazaco, San Andrés Tzicuilan, Xocoyolo), coordenadas aproximadas de OpenStreetMap/Nominatim. Incluye un racimo deliberado de diarrea con sangre en San Miguel Tzinacapan para mostrar la alerta. Los `case_id` de demostración empiezan con `5eed0000-` y la tabla los marca como "Demo".
- El mapa base (teselas OSM) necesita internet; sin señal el resto del tablero sigue funcionando.
