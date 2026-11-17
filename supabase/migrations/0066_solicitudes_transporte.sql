-- Solicitudes de transporte entre sedes -- antes el módulo solo mandaba un
-- correo con un Excel armado al vuelo y no quedaba nada guardado; ahora
-- cada solicitud se guarda acá (para el listado/historial de la pantalla)
-- y el correo se sigue mandando igual que antes.
--
-- Mismo control de acceso que ya tenía el módulo (ver
-- src/lib/transportes-acceso.ts): personal, por correo, no por rol --
-- se replica acá contra auth.jwt() ->> 'email' en vez de agregar un rol
-- nuevo solo para esto.
create table solicitudes_transporte (
  id uuid primary key default gen_random_uuid(),
  fecha_solicitud date not null,
  hora_solicitud time not null,
  solicitante_id uuid not null references profiles(id),
  solicitante_nombre text not null,
  area_solicitante text not null,
  descripcion_objeto text not null,
  cantidad integer not null check (cantidad >= 1),
  peso_aprox_kg integer check (peso_aprox_kg >= 1),
  requiere_refrigeracion boolean not null default false,
  origen text not null,
  destino text not null,
  fecha_traslado date not null,
  hora_traslado time not null,
  quien_recibe text not null,
  urgencia text not null check (urgencia in ('Urgente', 'No Urgente')),
  created_at timestamptz not null default now()
);

alter table solicitudes_transporte enable row level security;
create policy "solicitudes_transporte_select" on solicitudes_transporte
  for select to authenticated
  using (auth.jwt() ->> 'email' = 'jefeplantatocancipa@fasalact.com');
create policy "solicitudes_transporte_insert" on solicitudes_transporte
  for insert to authenticated
  with check (auth.jwt() ->> 'email' = 'jefeplantatocancipa@fasalact.com');

create index idx_solicitudes_transporte_fecha on solicitudes_transporte(fecha_solicitud);
