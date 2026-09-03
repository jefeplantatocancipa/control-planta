-- Reestructura el "corte de turno": pasa a ser un inicio/fin de turno (como
-- iniciar/finalizar una etapa) en vez de un único snapshot. El control de
-- calidad (peso neto de 3 unidades, sellado, fechado) se hace por lecturas
-- repetidas (cada hora) mientras el turno está activo, y el avance de
-- producción se registra por ciclos de estiba (inicio/final + unidades),
-- en vez de un solo par de unidades inicio/final por turno.

-- El nombre exacto del check de unidades_final lo asigna Postgres al
-- crear la tabla; se busca dinámicamente en vez de asumirlo, para no
-- depender de la convención de nombres.
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'envasado_cortes'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%unidades_final%'
  loop
    execute format('alter table envasado_cortes drop constraint %I', con.conname);
  end loop;
end $$;

alter table envasado_cortes
  drop column sellado_cumple,
  drop column lote_marcado,
  drop column peso_1,
  drop column peso_2,
  drop column peso_3;

alter table envasado_cortes
  add column started_at timestamptz not null default now(),
  add column ended_at timestamptz,
  add column desperdicio numeric(12, 2);

alter table envasado_cortes
  alter column unidades_final drop not null;

create table envasado_calidad_lecturas (
  id uuid primary key default gen_random_uuid(),
  corte_id uuid not null references envasado_cortes(id) on delete cascade,
  peso_1 numeric(12, 3),
  peso_2 numeric(12, 3),
  peso_3 numeric(12, 3),
  sellado_cumple boolean not null,
  fechado_cumple boolean not null,
  observaciones text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

alter table envasado_calidad_lecturas enable row level security;
create policy "envasado_calidad_lecturas_select" on envasado_calidad_lecturas
  for select to authenticated using (is_staff());
create policy "envasado_calidad_lecturas_write" on envasado_calidad_lecturas
  for all to authenticated
  using (is_staff())
  with check (is_staff());

create table envasado_estibas (
  id uuid primary key default gen_random_uuid(),
  corte_id uuid not null references envasado_cortes(id) on delete cascade,
  inicio_estiba timestamptz not null default now(),
  final_estiba timestamptz,
  unidades_por_estiba numeric(12, 2),
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

alter table envasado_estibas enable row level security;
create policy "envasado_estibas_select" on envasado_estibas
  for select to authenticated using (is_staff());
create policy "envasado_estibas_write" on envasado_estibas
  for all to authenticated
  using (is_staff())
  with check (is_staff());
