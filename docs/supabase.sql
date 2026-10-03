-- Pahtli: tabla de casos anonimizados (Supabase / Postgres)
-- Ejecutar en Supabase > SQL Editor. Luego configurar en Vercel:
--   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (solo del lado servidor; NUNCA en el front)

create table if not exists public.cases (
  case_id            uuid primary key,              -- generado en el celular (idempotencia)
  created_at         timestamptz not null,          -- cuándo se atendió (reloj del celular)
  comunidad          text not null,
  lat                double precision,
  lng                double precision,
  level              text not null check (level in ('aqui','centro_hoy','urgencia')),
  escalated_by_model boolean not null default false, -- (agregado) el modelo subió el nivel
  syndrome           text check (syndrome in ('respiratorio','diarreico','diarrea_sangre','febril',
                       'febril_hemorragico','obstetrico','neurologico','cardiovascular','trauma','otro')),
  rule_ids           text[] not null default '{}',
  findings           jsonb not null,                -- edad, sexo, síntomas; SIN nombre ni transcript
  device_tier        text check (device_tier in ('A','B','C')),
  received_at        timestamptz not null default now()
);

create index if not exists cases_created_at_idx on public.cases (created_at desc);
create index if not exists cases_comunidad_syndrome_idx on public.cases (comunidad, syndrome, created_at desc);

-- RLS: activada y SIN políticas => la llave anon/pública no puede leer ni escribir.
-- Solo las funciones /api/* (con service_role, que omite RLS) acceden a la tabla.
alter table public.cases enable row level security;

-- Nota: /api/cases es público (sin login) para la demo del hackathon. Los datos no
-- tienen identificadores personales, pero en producción el tablero debe ir detrás
-- de autenticación del personal de la Jurisdicción Sanitaria.
