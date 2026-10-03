# Sincronización y vigilancia (tablero)

## 1. Guardado local y outbox

- Cada caso se guarda primero en el celular (IndexedDB vía Dexie, `src/db/db.ts`) con un `case_id` UUID generado en el dispositivo (`crypto.randomUUID()`) y `synced=false`.
- `src/db/sync.ts` implementa el **patrón outbox**:
  - `syncNow()` envía la cola en lotes de 50 a `POST /api/sync` con la cabecera `x-pahtli-device` (token de inscripción). Solo marca `synced=true` los `case_id` que el servidor reporta en `accepted` (los inválidos se quedan en la cola). Si el servidor respondió en modo demo (no guardó) el caso queda además con `sync_demo=true`: **ese caso no existe en el servidor**, así que el borrado de "casos ya sincronizados" no debería tratarlo como respaldado.
  - **Idempotente:** el servidor hace upsert por `case_id`; si la señal se corta después de enviar y antes de marcar, reenviar no duplica.
  - `startAutoSync(onChange)` intenta al evento `online`, al volver la app a primer plano y cada 30 s mientras haya conexión. Tras un fallo aplica **backoff exponencial** (30 s, 60 s, 2 min… máx. 10 min); el evento `online` lo reinicia.
- **Privacidad por diseño (minimización, `toSyncCase` en `src/db/sync.ts`):** la app no pide nombre del paciente. Al servidor **no viaja**:
  - el texto transcrito (podría contener nombres dichos en voz alta), ni el nombre de la promotora, ni la nota libre de su decisión (`decision.note`), ni las claves guardadas;
  - la ubicación exacta: lat/lng se **redondean a 2 decimales (~1 km)** en el celular y otra vez en el servidor;
  - la edad exacta de adultos: meses exactos solo en menores de 2 años (las reglas pediátricas los usan); desde 2 años, años cumplidos. La app nunca registra fecha de nacimiento;
  - las frases de incertidumbre: solo viajan sus códigos (`age_missing`, `llm_disagree`…).

  Sí viaja: edad gruesa, sexo, síntomas estructurados (sí/no), temperatura y respiraciones, nivel sugerido, decisión de la promotora (nivel final, si cambió la sugerencia y el código del motivo), `uncertain`, síndrome, reglas disparadas, comunidad, coordenadas aproximadas y hora.

## 2. API (Vercel Functions) y seguridad

| Ruta | Qué hace |
|---|---|
| `POST /api/sync` | Exige `x-pahtli-device`. Valida `{ cases: [...] }` con esquema estricto (máx. 200 casos, 256 KB) y hace upsert en Supabase tabla `cases`. Responde `{ stored, demo, accepted, rejected }`. |
| `GET /api/cases?days=14&limit=500` | Con `x-pahtli-key` válida: casos individuales (forma `CaseRecord`, sin transcript). Sin clave configurada en el servidor: **solo conteos agregados**. |

### Variables de entorno (solo servidor)

| Variable | Si falta |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | No hay base de datos: `/api/sync` responde `demo:true`, `/api/cases` listas vacías. |
| `PAHTLI_SYNC_TOKEN` | **Modo demo**: `/api/sync` valida pero **no guarda nada** (aunque Supabase esté configurado) y responde `demo:true`. Así un despliegue sin token no acepta escrituras de cualquiera. |
| `PAHTLI_DASHBOARD_KEY` | `/api/cases` solo devuelve conteos por día × comunidad × síndrome × nivel final. Si está configurada, sin `x-pahtli-key` correcta responde `401` sin datos. |

### `POST /api/sync`

- **Autenticación del dispositivo:** cabecera `x-pahtli-device` igual a `PAHTLI_SYNC_TOKEN` (comparación en tiempo constante). Es un **token de inscripción compartido por despliegue**: suficiente para el piloto y para que el endpoint no sea una escritura abierta, pero no distingue un celular de otro. **En producción** cada celular recibiría su propia llave al inscribirlo (emitida por la Jurisdicción, guardada en el celular, revocable si se pierde o se comparte) y el servidor registraría qué dispositivo envió cada caso.
- El celular toma el token de "Acceso al servidor" (tablero → se guarda en IndexedDB, nunca se sincroniza ni se muestra) o, para demos, de `VITE_PAHTLI_SYNC_TOKEN` en el build. **Ojo:** una variable `VITE_*` queda dentro del JavaScript público; solo frena spam casual, no a alguien que lea el código.
- **Esquema estricto:** cualquier campo desconocido (p. ej. `transcript`, `promotora`, `findings.nombre`, `decision.note`) **rechaza el caso** con su motivo; el resto del lote sigue. `decision.reason` y `uncertainty_reasons` solo aceptan códigos cortos (`^[A-Za-z0-9][A-Za-z0-9_.:-]{0,59}$`), nunca texto libre.
- **Valores acotados (clamp):** edad 0–1440 meses, semanas de embarazo 0–45, duración 0–365 días, temperatura 30–45 °C, respiraciones 0–150/min; tipos incorrectos se rechazan. Coordenadas redondeadas a 2 decimales; fuera de rango → `null`. `created_at` entre 2024 y ahora + 24 h.
- **Límites:** máx. 200 casos por lote (el cliente manda 50), máx. 256 KB por petición (`413`), y **límite por IP** de 30 peticiones/min (`429` + `Retry-After`). El límite vive en memoria de cada instancia: es *best-effort* (una instancia nueva empieza en cero). En producción iría en un almacén compartido (Upstash/Redis) o en el firewall de Vercel.
- Errores de Supabase → `502` sin detalles; el celular conserva los casos y reintenta con backoff. Un `401` también deja los casos en la cola y el tablero avisa "falta el token de inscripción".

### `GET /api/cases`

- **Modo `records`** (requiere `PAHTLI_DASHBOARD_KEY` + cabecera `x-pahtli-key`): casos individuales para el tablero del personal, incluye decisión e incertidumbre.
- **Modo `aggregate`** (sin `PAHTLI_DASHBOARD_KEY` en el servidor): `{ day, comunidad, syndrome, level, count }`, con `level` = nivel final (decisión de la promotora si existe). Sin edad, sexo, coordenadas, hora ni `case_id`. El día se calcula en hora del centro de México.
- El tablero envía la clave si está guardada en "Acceso al servidor"; si no, muestra los conteos de la red en una sección aparte ("Resumen de la red") y calcula alertas también sobre esos conteos (con horas aproximadas a mediodía). Si el servidor responde `401`, usa solo casos locales + demo.
- **Riesgo conocido:** en comunidades muy pequeñas un conteo de 1 caso obstétrico en un día puede apuntar a una persona. No suprimimos celdas pequeñas porque romperían la alerta de brote (umbral 2); por eso en un despliegue real `PAHTLI_DASHBOARD_KEY` debe estar configurada y el modo agregado queda solo para demos.

### Supabase

`docs/supabase.sql` crea la tabla con **RLS activada y forzada, sin políticas, y privilegios revocados a `anon`/`authenticated`**: la llave pública no puede leer ni escribir. Solo las funciones `/api/*` con `service_role` acceden. Índices por `created_at` y por `(comunidad, created_at)`.

Configurar: ejecutar `docs/supabase.sql` (idempotente, también migra tablas viejas), poner las variables en Vercel (Project → Settings → Environment Variables) y, opcionalmente, sembrar: `npx tsx scripts/seed-remote.ts https://<app>.vercel.app` (si hay `PAHTLI_SYNC_TOKEN`, el script debe mandar la cabecera `x-pahtli-device`).

En desarrollo local con `npm run dev` (Vite) no existen las rutas `/api/*`; la sincronización falla y reintenta con backoff (comportamiento correcto). Para probarlas localmente: `vercel dev`.

## 3. Alerta temprana de brotes (`src/surveillance/outbreak.ts`)

Función pura `detectOutbreaks(cases, now, opts)`:

- **≥ 3 casos del mismo síndrome en la misma comunidad dentro de 72 h** → alerta.
- **≥ 2** si el síndrome es `diarrea_sangre` o `febril_hemorragico` (alto potencial epidémico/gravedad) → severidad alta.
- **≥ 3 urgencias** en la misma comunidad en 72 h, sin importar el síndrome → "racimo de urgencias". Cuenta el **nivel final**: si la promotora cambió la sugerencia (`decision.final_level`), manda su decisión (`effectiveLevel`).
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

- Une y deduplica por `case_id`: casos del celular (Dexie, en vivo) + red (`/api/cases` en modo `records`, si hay señal y clave) + **datos de demostración** (`src/surveillance/seed.ts`, se pueden ocultar con una casilla). En modo agregado los conteos de la red se muestran aparte (no se pueden deduplicar contra los casos del celular).
- Todos los conteos, el mapa y la tabla usan el **nivel final** (decisión de la promotora si existe); la tabla marca "cambió la promotora" y "datos dudosos" (`uncertain`).
- "Acceso al servidor" (al final del tablero): guarda en este equipo la clave del tablero y el token de inscripción del celular. Campos tipo contraseña; nunca se muestran de vuelta.
- KPIs (hoy, 7 días, urgencias, pendientes), alertas, mapa Leaflet/OpenStreetMap, barras por síndrome y tabla filtrable.
- Datos de demostración: 40 casos ficticios en 6 comunidades reales del municipio de **Cuetzalan del Progreso, Puebla** (San Miguel Tzinacapan, Yohualichan, Xiloxochico, Cuauhtamazaco, San Andrés Tzicuilan, Xocoyolo), coordenadas aproximadas de OpenStreetMap/Nominatim. Incluye un racimo deliberado de diarrea con sangre en San Miguel Tzinacapan para mostrar la alerta. Los `case_id` de demostración empiezan con `5eed0000-` y la tabla los marca como "Demo".
- El mapa base (teselas OSM) necesita internet; sin señal el resto del tablero sigue funcionando.
