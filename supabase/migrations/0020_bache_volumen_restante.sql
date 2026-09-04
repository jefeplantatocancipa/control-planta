-- Para saber si un bache sigue teniendo producto sin envasar (y por lo
-- tanto debe seguir apareciendo para elegir en "Iniciar envasado"), o si
-- ya se agotó.
alter table baches
  add column volumen_restante_litros numeric(12, 2);

update baches
  set volumen_restante_litros = volumen_total_litros
  where volumen_total_litros is not null;
