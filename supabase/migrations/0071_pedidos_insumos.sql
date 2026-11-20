-- Pedido de insumos: desde Programa se eligen órdenes de baches/envasado,
-- se calculan los insumos que piden sus recetas y se arma un correo con
-- Excel adjunto para Alexander. Esta migración solo crea las tablas base
-- (sin las cantidades de receta de envasado todavía, eso es 0072).

create type pedido_insumos_estado as enum ('enviado', 'recibido_parcial', 'recibido');
create type pedido_insumos_orden_tipo as enum ('bache', 'envasado');

create table pedidos_insumos (
  id uuid primary key default gen_random_uuid(),
  folio integer generated always as identity,
  program_id uuid not null references production_programs(id),
  fecha_requerida date,
  observaciones text,
  estado pedido_insumos_estado not null default 'enviado',
  enviado_por uuid not null references profiles(id),
  enviado_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Una fila por orden incluida en el pedido -- permite detectar "esta orden
-- ya se pidió antes" buscando su id acá. Exactamente una de las dos
-- referencias va llena, según `tipo`.
create table pedidos_insumos_ordenes (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos_insumos(id) on delete cascade,
  tipo pedido_insumos_orden_tipo not null,
  production_order_id uuid references production_orders(id),
  envasado_order_id uuid references envasado_orders(id),
  check (
    (tipo = 'bache' and production_order_id is not null and envasado_order_id is null) or
    (tipo = 'envasado' and envasado_order_id is not null and production_order_id is null)
  )
);

-- insumo_tipo/insumo_id sin FK literal (puede apuntar a `insumos` o a
-- `envasado_insumos` según el tipo) -- mismo patrón que ya usa
-- inventario_movimientos para lo mismo.
create table pedidos_insumos_lineas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos_insumos(id) on delete cascade,
  insumo_tipo text not null check (insumo_tipo in ('materia_prima', 'empaque')),
  insumo_id uuid not null,
  cantidad_requerida numeric(12, 2) not null,
  cantidad_pedida numeric(12, 2) not null
);

alter table pedidos_insumos enable row level security;
create policy "pedidos_insumos_select" on pedidos_insumos
  for select to authenticated
  using (current_role_is('jefe_planta') or current_role_is('asistente_adm') or current_role_is('planeacion'));
create policy "pedidos_insumos_insert" on pedidos_insumos
  for insert to authenticated
  with check (current_role_is('jefe_planta') or current_role_is('asistente_adm') or current_role_is('planeacion'));
create policy "pedidos_insumos_update" on pedidos_insumos
  for update to authenticated
  using (current_role_is('jefe_planta') or current_role_is('asistente_adm') or current_role_is('planeacion'))
  with check (current_role_is('jefe_planta') or current_role_is('asistente_adm') or current_role_is('planeacion'));

alter table pedidos_insumos_ordenes enable row level security;
create policy "pedidos_insumos_ordenes_select" on pedidos_insumos_ordenes
  for select to authenticated
  using (current_role_is('jefe_planta') or current_role_is('asistente_adm') or current_role_is('planeacion'));
create policy "pedidos_insumos_ordenes_insert" on pedidos_insumos_ordenes
  for insert to authenticated
  with check (current_role_is('jefe_planta') or current_role_is('asistente_adm') or current_role_is('planeacion'));

alter table pedidos_insumos_lineas enable row level security;
create policy "pedidos_insumos_lineas_select" on pedidos_insumos_lineas
  for select to authenticated
  using (current_role_is('jefe_planta') or current_role_is('asistente_adm') or current_role_is('planeacion'));
create policy "pedidos_insumos_lineas_insert" on pedidos_insumos_lineas
  for insert to authenticated
  with check (current_role_is('jefe_planta') or current_role_is('asistente_adm') or current_role_is('planeacion'));
