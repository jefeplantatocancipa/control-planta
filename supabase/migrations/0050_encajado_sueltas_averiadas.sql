-- Al finalizar un encajado, además de las cajas completas se registra
-- cuántas unidades quedaron sueltas (no alcanzaron para armar una caja
-- más) y cuántas salieron averiadas (se detectan en el encajado, no antes).
alter table encajados add column unidades_sueltas integer not null default 0;
alter table encajados add column unidades_averiadas integer not null default 0;
