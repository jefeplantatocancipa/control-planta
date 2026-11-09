-- Reinicios/cambios de medidor que quedaron en Control.xlsx como ajustes
-- contables (un valor negativo o un salto enorme en un solo día para
-- "cuadrar" el total), no como consumo real de ese día. Sumados en el
-- rango completo se cancelan y dan el total real, pero al cortar por mes
-- calendario (resumen de Estadísticas) caen en un solo mes y lo distorsionan
-- (jul./ago. mostraban consumos negativos y saltos de miles de m³).
--
-- Se anula el consumo de esos días puntuales -- la lectura queda intacta
-- como registro histórico, pero ese día pasa a "sin dato" en vez de un
-- número inventado, y las sumas mensuales ya ignoran los nulos.

-- Gas: el medidor viejo llegó a 6218 m³ el 22/jul y se cambió de medidor.
-- El 23/jul se anotó -6218 (cierre del medidor viejo) y el 10/ago se
-- anotó 7418 (lectura completa del medidor nuevo, sin lectura previa
-- contra la cual restar) -- ninguno de los dos es consumo real de un día.
update consumos_servicios set gas_consumo_m3 = null
where fecha in ('2026-07-23', '2026-08-10');

-- Agua producción: el medidor marcó lecturas disparatadas del 31/jul al
-- 9/ago (subiendo 46.242 m³ idéntico los 10 días, algo físicamente
-- imposible) y el 10/ago se corrigió de un salto (-462.371) al volver al
-- valor real (1.363, coherente con la tendencia real de antes del 31/jul).
update consumos_servicios set agua_produccion_consumo_m3 = null
where fecha between '2026-07-31' and '2026-08-10';
