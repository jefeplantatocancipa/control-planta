-- ============================================================================
-- El enmangado no tiene relación con la línea de baches/yogurt: entra un
-- vaso blanco, se le pone una etiqueta y sale un vaso fajillado (producto
-- terminado). Le damos su propio catálogo de materia prima (vasos blancos,
-- con control de stock) y su propio catálogo de producto terminado
-- (referencias), en vez de reutilizar el catálogo de productos de baches.
--
-- Las tablas enmangado_orders/vasos_enmangados creadas en 0005 apuntaban a
-- products (el catálogo de baches), lo cual estaba mal; se truncan porque
-- solo tienen datos de prueba y se re-apuntan al catálogo nuevo.
-- ============================================================================

truncate table vasos_enmangados;
truncate table enmangado_orders, enmangado_programs cascade;

create table vasos_blancos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'unidades',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table vasos_blancos_entradas (
  id uuid primary key default gen_random_uuid(),
  vaso_blanco_id uuid not null references vasos_blancos(id),
  cantidad numeric(12, 2) not null check (cantidad > 0),
  notes text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table enmangado_referencias (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  vaso_blanco_id uuid not null references vasos_blancos(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table enmangado_orders
  drop column product_id,
  add column referencia_id uuid not null references enmangado_referencias(id);

alter table vasos_enmangados
  drop column product_id,
  add column referencia_id uuid not null references enmangado_referencias(id);

create index idx_vasos_blancos_entradas_vaso on vasos_blancos_entradas(vaso_blanco_id);
create index idx_enmangado_referencias_vaso_blanco on enmangado_referencias(vaso_blanco_id);
create index idx_enmangado_orders_referencia on enmangado_orders(referencia_id);
create index idx_vasos_enmangados_referencia on vasos_enmangados(referencia_id);

alter table vasos_blancos enable row level security;
alter table vasos_blancos_entradas enable row level security;
alter table enmangado_referencias enable row level security;

-- Catálogos: lectura para todos los autenticados, escritura solo jefe_planta.
create policy "vasos_blancos_select_all" on vasos_blancos
  for select to authenticated using (true);
create policy "vasos_blancos_write_jefe" on vasos_blancos
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

create policy "enmangado_referencias_select_all" on enmangado_referencias
  for select to authenticated using (true);
create policy "enmangado_referencias_write_jefe" on enmangado_referencias
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

-- Entradas de stock: las registra el personal de planta (jefe_planta o
-- supervisor), igual que el resto de la captura de proceso.
create policy "vasos_blancos_entradas_select" on vasos_blancos_entradas
  for select to authenticated using (true);
create policy "vasos_blancos_entradas_write_staff" on vasos_blancos_entradas
  for all to authenticated
  using (is_staff())
  with check (is_staff());
