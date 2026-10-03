-- Pahtli: tabla de casos anonimizados (Supabase / Postgres)
-- Ejecutar en Supabase > SQL Editor (es idempotente: se puede correr otra vez para migrar).
-- Luego configurar en Vercel (Project > Settings > Environment Variables), SOLO del lado servidor:
--   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (NUNCA en el front ni con prefijo VITE_)
--   PAHTLI_SYNC_TOKEN       token de inscripción de los celulares (sin él /api/sync no guarda: modo demo)
--   PAHTLI_DASHBOARD_KEY    clave del tablero (sin ella /api/cases solo da conteos agregados)

create table if not exists public.cases (
  case_id            uuid primary key,              -- generado en el celular (idempotencia)
  created_at         timestamptz not null,          -- cuándo se atendió (reloj del celular)
  comunidad          text not null,
  lat                double precision,              -- redondeada a 2 decimales (~1 km) en celular y servidor
  lng                double precision,
  level              text not null check (level in ('aqui','centro_hoy','urgencia')),  -- sugerido por las reglas
  escalated_by_model boolean not null default false, -- el modelo subió el nivel
  syndrome           text check (syndrome in ('respiratorio','diarreico','diarrea_sangre','febril',
                       'febril_hemorragico','obstetrico','neurologico','cardiovascular','trauma','otro')),
  rule_ids           text[] not null default '{}',
  findings           jsonb not null,                -- edad (gruesa desde 2 años), sexo, síntomas; SIN nombre ni transcript
  device_tier        text check (device_tier in ('A','B','C')),
  received_at        timestamptz not null default now()
);

-- Decisión humana e incertidumbre (migración: agrega columnas si la tabla ya existía)
alter table public.cases add column if not exists decision_final_level text
  check (decision_final_level in ('aqui','centro_hoy','urgencia'));   -- lo que decidió la promotora
alter table public.cases add column if not exists decision_overridden boolean;  -- true = cambió la sugerencia
alter table public.cases add column if not exists decision_reason text
  check (decision_reason is null or decision_reason ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,59}$'); -- solo código, nunca texto libre
alter table public.cases add column if not exists uncertain boolean;            -- se mostró "consulta a una persona"
alter table public.cases add column if not exists uncertainty_reasons text[] not null default '{}'; -- códigos (no_findings, age_missing...)

create index if not exists cases_created_at_idx on public.cases (created_at desc);
create index if not exists cases_comunidad_created_idx on public.cases (comunidad, created_at desc);
create index if not exists cases_comunidad_syndrome_idx on public.cases (comunidad, syndrome, created_at desc);

-- Seguridad: RLS activada y SIN políticas para anon/authenticated => la llave pública
-- no puede leer ni escribir nada. Solo las funciones /api/* (service_role, que omite RLS)
-- acceden a la tabla. Además se revocan los privilegios por si alguien agrega una política.
alter table public.cases enable row level security;
alter table public.cases force row level security;
revoke all on table public.cases from anon, authenticated;

-- Nota de producción: el tablero completo (/api/cases con x-pahtli-key) usa una sola clave
-- compartida. En producción iría detrás de cuentas individuales del personal de la
-- Jurisdicción Sanitaria (Supabase Auth + políticas por jurisdicción) y cada celular tendría
-- su propia llave emitida al inscribirlo (revocable si se pierde). Ver docs/sync.md §2.
