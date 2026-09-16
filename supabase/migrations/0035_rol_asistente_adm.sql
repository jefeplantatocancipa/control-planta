-- Nuevo rol "asistente_adm": puede ver e imprimir todos los módulos de la
-- app, pero nunca puede crear, editar ni eliminar nada -- es puramente un
-- observador. Va en su propia migración porque Postgres no permite usar un
-- valor de enum recién agregado en la misma transacción en que se agrega.
alter type user_role add value 'asistente_adm';
