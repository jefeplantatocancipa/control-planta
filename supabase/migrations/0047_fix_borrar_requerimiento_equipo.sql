-- Al editar los equipos de una etapa, se borra la lista vieja y se inserta
-- la nueva (igual que parameter_schema). Pero si algún bache ya usó un
-- equipo para un requerimiento puntual, quedaba una fila en
-- bache_stage_record_equipos apuntándolo, y el borrado fallaba por la
-- referencia (sin "on delete"). El error no se revisaba, así que el
-- guardado seguía igual e insertaba la lista nueva encima de la vieja --
-- por eso la lista de equipos de una etapa solo crecía y nunca bajaba.
-- Con "on delete set null" el borrado ya no falla; el registro histórico
-- de qué equipo se usó queda igual (equipo_id no se toca), solo se pierde
-- la referencia a CUÁL requerimiento puntual era.
alter table bache_stage_record_equipos
  drop constraint bache_stage_record_equipos_requirement_id_fkey;
alter table bache_stage_record_equipos
  add constraint bache_stage_record_equipos_requirement_id_fkey
  foreign key (requirement_id) references stage_equipo_requirements(id) on delete set null;
