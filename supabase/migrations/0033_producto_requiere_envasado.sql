-- Algunos productos (ej. cremado) no se envasan: no deben aparecer en el
-- selector de "Iniciar envasado" aunque el bache ya esté completo. Por
-- defecto todos los productos sí se envasan (comportamiento actual).
alter table products add column requiere_envasado boolean not null default true;
