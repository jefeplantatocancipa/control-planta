-- Nuevo rol "calidad": firma (aprueba) los valores capturados en cada etapa
-- de baches y cada turno de envasado, pero no puede iniciar/finalizar nada
-- del proceso -- solo puede leer y firmar. Va en su propia migración porque
-- Postgres no permite usar un valor de enum recién agregado en la misma
-- transacción en que se agrega.
alter type user_role add value 'calidad';
