-- Cultivos, lactasa y leche cruda se piden aparte (cultivos/lactasa una vez
-- por semana, leche cruda con otro manejo) y nunca deben aparecer en el
-- Pedido de insumos armado desde Programa.
create type motivo_exclusion_pedido as enum ('pedido_semanal', 'otro_manejo');

alter table insumos
  add column excluir_pedido_programa boolean not null default false,
  add column excluir_pedido_programa_motivo motivo_exclusion_pedido;

-- Antes de correr estos dos UPDATE, corré el SELECT de previsualización que
-- te pasamos aparte para confirmar que la lista que coincide es la correcta.
update insumos
  set excluir_pedido_programa = true, excluir_pedido_programa_motivo = 'pedido_semanal'
  where upper(name) similar to '%(CULTIVO|LACTASA)%';

update insumos
  set excluir_pedido_programa = true, excluir_pedido_programa_motivo = 'otro_manejo'
  where upper(name) similar to '%LECHE CRUDA%';
