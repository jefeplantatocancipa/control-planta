-- Bitácora del día: un registro simple y único (no un módulo aparte por
-- tipo) para no llenarse de pantallas -- cada entrada es un lavado o una
-- novedad, distinguidas por "tipo", en el mismo feed cronológico.
create table bitacora_entradas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('lavado', 'novedad')),
  turno_id uuid references turnos(id),
  equipo_id uuid references equipos(id),
  texto text not null,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

alter table bitacora_entradas enable row level security;
create policy "bitacora_entradas_select" on bitacora_entradas
  for select to authenticated
  using (is_staff() or current_role_is('calidad') or current_role_is('asistente_adm'));
create policy "bitacora_entradas_write" on bitacora_entradas
  for all to authenticated
  using (is_staff())
  with check (is_staff());

create index idx_bitacora_entradas_created_at on bitacora_entradas(created_at);
