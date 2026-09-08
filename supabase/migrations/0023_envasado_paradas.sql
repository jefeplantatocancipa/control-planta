-- Paradas de envasado: a diferencia del turno/corte (que es "quién está
-- trabajando ahora"), una parada vive a nivel del envasado completo, porque
-- puede pasar con o sin turno activo (línea sin actividad, entre turnos,
-- falla, cambio de referencia, descanso, etc.). Se inicia con el motivo
-- (opcional, se sabe al momento de parar) y se cierra sin campos extra,
-- igual que el resto de inicio/fin automáticos de la app.

create table envasado_paradas (
  id uuid primary key default gen_random_uuid(),
  envasado_id uuid not null references envasados(id) on delete cascade,
  motivo text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

alter table envasado_paradas enable row level security;
create policy "envasado_paradas_select" on envasado_paradas
  for select to authenticated using (is_staff());
create policy "envasado_paradas_write" on envasado_paradas
  for all to authenticated
  using (is_staff())
  with check (is_staff());

create index idx_envasado_paradas_envasado on envasado_paradas(envasado_id);
