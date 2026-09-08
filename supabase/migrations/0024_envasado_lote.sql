-- El lote de envasado se captura al iniciar (como la presentación), para
-- poder identificar la producción de ese día en el empaque final.
alter table envasados
  add column lote text;
