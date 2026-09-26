-- "Envasado por operario" en Estadísticas dejó de usar esta vista: agrupaba
-- por envasados.operario_id, que le cargaba TODAS las unidades del envasado
-- a un solo operario elegido al iniciar. Ahora se calcula por turno
-- (envasado_cortes + envasado_estibas), acreditando cada turno a los
-- operarios que realmente lo trabajaron.
drop view if exists v_estadisticas_envasado_operario;
