-- Corrección del cremado histórico de agosto 2026: la suma de los 6 días
-- con Cremado en produccion_historica daba 4.741,17 kg (861+861+861+
-- 780.17+689+689), pero el dato real reportado por planta es 4.400 kg
-- (diferencia de -341,17 kg). Se ajusta el último día de cremado del mes
-- (26 de agosto) -- si el día real al que corresponde el ajuste es otro,
-- corregir ese registro puntual en vez de este.
update produccion_historica
set
  produccion = '[{"referencia":"Cremado","kilos":347.83,"documento":"IPTT 127"}]'::jsonb,
  observaciones = 'Cremado ajustado de 689 a 347.83 kg (-341.17) para que el total de cremado de agosto cierre en 4.400 kg reportados por planta.'
where fecha = '2026-08-26';
