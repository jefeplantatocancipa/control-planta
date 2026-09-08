-- Catálogo de tanques: para que el parámetro "Tanque" de las etapas del
-- bache se elija de una lista (como los insumos) en vez de escribirse a
-- mano en cada captura.

create table tanques (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table tanques enable row level security;

create policy "tanques_select_all" on tanques
  for select to authenticated using (true);
create policy "tanques_write_jefe" on tanques
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));
