-- Encajado: empacar en cajas las unidades ya envasadas. No tiene programa
-- propio (no se agenda a mano) — se crea automáticamente al cerrar un
-- envasado (uno por envasado), y arranca "pendiente" (sin started_at) hasta
-- que alguien lo inicia desde /encajado capturando el lote. El avance se
-- controla igual que en envasado: ciclos de estiba con inicio/final
-- automáticos, pero acá solo importa el tiempo (no se cuentan unidades por
-- estiba, eso ya quedó registrado en el envasado).

create table encajados (
  id uuid primary key default gen_random_uuid(),
  envasado_id uuid not null unique references envasados(id) on delete cascade,
  bache_id uuid not null references baches(id),
  lote text,
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

alter table encajados enable row level security;
create policy "encajados_select" on encajados
  for select to authenticated using (is_staff());
create policy "encajados_write" on encajados
  for all to authenticated
  using (is_staff())
  with check (is_staff());

create table encajado_estibas (
  id uuid primary key default gen_random_uuid(),
  encajado_id uuid not null references encajados(id) on delete cascade,
  inicio_estiba timestamptz not null default now(),
  final_estiba timestamptz,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

alter table encajado_estibas enable row level security;
create policy "encajado_estibas_select" on encajado_estibas
  for select to authenticated using (is_staff());
create policy "encajado_estibas_write" on encajado_estibas
  for all to authenticated
  using (is_staff())
  with check (is_staff());

create index idx_encajados_bache on encajados(bache_id);
create index idx_encajado_estibas_encajado on encajado_estibas(encajado_id);
