-- Equipo fijo por etapa: para equipos de los que solo hay una unidad
-- (pasteurizador, homogeneizador, etc.), se asigna una vez en la etapa y
-- no hace falta que el operario elija nada al iniciarla -- se usa
-- automáticamente. "requires_equipo" + "equipo_tipo" (de la migración
-- anterior) quedan para equipos de los que hay varios y el operario elige
-- el que esté libre (ej. tanques de almacenamiento).
alter table process_stage_templates add column equipo_id uuid references equipos(id);
