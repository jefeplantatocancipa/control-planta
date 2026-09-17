-- Módulo de Inventario: un libro de movimientos (no un contador que se
-- pisa) para materia prima (insumos), material de empaque
-- (envasado_insumos) y vasos blancos (enmangado). El stock actual de
-- cualquier insumo es siempre la suma de sus movimientos -- nunca un
-- campo que alguien edita directo -- así queda trazabilidad completa y
-- nunca se puede desincronizar de la realidad.
--
-- insumo_tipo/insumo_id no tienen FK real porque apuntan a tres catálogos
-- distintos (insumos, envasado_insumos, vasos_blancos) -- Postgres no
-- soporta una FK condicional a una tabla u otra. La integridad queda a
-- cargo del código de la app (siempre inserta el tipo correcto).
create table inventario_movimientos (
  id uuid primary key default gen_random_uuid(),
  insumo_tipo text not null check (insumo_tipo in ('materia_prima', 'empaque', 'vaso_blanco')),
  insumo_id uuid not null,
  tipo text not null check (tipo in ('entrada', 'consumo', 'ajuste')),
  -- Siempre firmado: positivo suma al stock (entrada, ajuste hacia arriba),
  -- negativo resta (consumo, ajuste hacia abajo). El stock actual es la
  -- suma simple de esta columna.
  cantidad numeric(12, 2) not null,
  origen_tipo text check (origen_tipo in ('bache', 'envasado', 'enmangado', 'manual')),
  origen_id uuid,
  proveedor text,
  notas text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

alter table inventario_movimientos enable row level security;
create policy "inventario_movimientos_select" on inventario_movimientos
  for select to authenticated using (is_staff() or current_role_is('asistente_adm'));
create policy "inventario_movimientos_insert" on inventario_movimientos
  for insert to authenticated with check (is_staff());
create policy "inventario_movimientos_delete" on inventario_movimientos
  for delete to authenticated using (current_role_is('jefe_planta'));

create index idx_inventario_movimientos_insumo on inventario_movimientos(insumo_tipo, insumo_id);
create index idx_inventario_movimientos_origen on inventario_movimientos(origen_tipo, origen_id);

-- Stock mínimo configurable por insumo, en cada catálogo existente (no un
-- catálogo de inventario aparte): se edita desde la misma pantalla de
-- Administración donde ya se crea cada insumo.
alter table insumos add column stock_minimo numeric(12, 2);
alter table envasado_insumos add column stock_minimo numeric(12, 2);
alter table vasos_blancos add column stock_minimo numeric(12, 2);

-- Stock actual = catálogo (activos) + su saldo de movimientos (0 si nunca
-- tuvo ninguno).
create view v_inventario_stock as
select
  'materia_prima'::text as insumo_tipo,
  i.id as insumo_id,
  i.name,
  i.stock_minimo,
  coalesce(sum(m.cantidad), 0) as stock_actual
from insumos i
left join inventario_movimientos m
  on m.insumo_tipo = 'materia_prima' and m.insumo_id = i.id
where i.active
group by i.id, i.name, i.stock_minimo
union all
select
  'empaque',
  ei.id,
  ei.name,
  ei.stock_minimo,
  coalesce(sum(m.cantidad), 0)
from envasado_insumos ei
left join inventario_movimientos m
  on m.insumo_tipo = 'empaque' and m.insumo_id = ei.id
where ei.active
group by ei.id, ei.name, ei.stock_minimo
union all
select
  'vaso_blanco',
  vb.id,
  vb.name,
  vb.stock_minimo,
  coalesce(sum(m.cantidad), 0)
from vasos_blancos vb
left join inventario_movimientos m
  on m.insumo_tipo = 'vaso_blanco' and m.insumo_id = vb.id
where vb.active
group by vb.id, vb.name, vb.stock_minimo;

-- Backfill de vasos blancos: es el único de los tres que ya tenía datos
-- estructurados de entradas y consumo (no texto libre ni JSON), así que se
-- puede reconstruir su historial completo sin riesgo. Materia prima y
-- material de empaque arrancan a contar desde ahora -- para esos dos, la
-- primera carga real es hacer un conteo físico y registrarlo como entrada
-- o ajuste inicial.
insert into inventario_movimientos
  (insumo_tipo, insumo_id, tipo, cantidad, origen_tipo, notas, created_by, created_at)
select
  'vaso_blanco',
  e.vaso_blanco_id,
  'entrada',
  e.cantidad,
  'manual',
  e.notes,
  e.created_by,
  e.created_at
from vasos_blancos_entradas e;

insert into inventario_movimientos
  (insumo_tipo, insumo_id, tipo, cantidad, origen_tipo, origen_id, created_by, created_at)
select
  'vaso_blanco',
  r.vaso_blanco_id,
  'consumo',
  -v.cantidad_unidades,
  'enmangado',
  v.id,
  v.created_by,
  v.created_at
from vasos_enmangados v
join enmangado_referencias r on r.id = v.referencia_id;
