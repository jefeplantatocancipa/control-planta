-- El checklist de insumos de envasado pasa de pedir "cantidad usada" al
-- iniciar (una estimación antes de haber envasado nada) a un control de
-- inventario real: inventario inicial al iniciar el envasado, e inventario
-- final al cerrarlo -- el consumo real queda implícito en la diferencia.
alter table envasado_insumos_uso
  rename column cantidad_usada to inventario_inicial;

alter table envasado_insumos_uso
  add column inventario_final numeric(12, 2);
