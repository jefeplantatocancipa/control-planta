-- Para calcular kilos empacados (unidades x peso unitario) y compararlos
-- contra el balance de masa de insumos en el informe del bache, cada
-- envasado necesita quedar vinculado a su referencia (presentación), no
-- solo al texto libre que hoy se muestra en pantalla.
alter table envasados add column referencia_id uuid references envasado_referencias(id);
