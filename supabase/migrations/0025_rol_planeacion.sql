-- Nuevo rol "planeacion": solo tiene acceso a Programa (crear/editar
-- ordenes, importar Excel) y a Proceso actual (de solo lectura para
-- cualquier rol autenticado, no necesita permisos especiales). Va en su
-- propia migración porque Postgres no permite usar un valor de enum recién
-- agregado en la misma transacción en que se agrega.
alter type user_role add value 'planeacion';
