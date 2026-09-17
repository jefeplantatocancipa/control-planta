-- Además del tiempo, el encajado ahora registra cuántas cajas salieron de
-- cada estiba (se captura al finalizarla, igual que las unidades por
-- estiba en envasado).
alter table encajado_estibas add column cajas_por_estiba integer;
