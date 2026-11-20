-- Destinatario del correo de Pedido de insumos, editable desde Administración
-- -- no existía ninguna tabla de configuración general en el sistema antes
-- de esta (el único precedente, el destinatario de Transportes, está fijo
-- en el código). Una sola fila, forzada por el check de `id`.
create table pedido_insumos_config (
  id boolean primary key default true check (id),
  destinatario_email text not null,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

alter table pedido_insumos_config enable row level security;
create policy "pedido_insumos_config_select" on pedido_insumos_config
  for select to authenticated
  using (current_role_is('jefe_planta') or current_role_is('asistente_adm') or current_role_is('planeacion'));
create policy "pedido_insumos_config_write" on pedido_insumos_config
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));
