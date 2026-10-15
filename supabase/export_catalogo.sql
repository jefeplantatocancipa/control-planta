-- ============================================================================
-- Exportar el catálogo (productos, etapas, insumos, equipos, turnos,
-- referencias de envasado/enmangado) para copiarlo a una sede nueva.
--
-- CÓMO USARLO:
-- 1. Corré este script en el SQL Editor del proyecto ACTUAL (Sede 1).
--    Es de solo lectura, no modifica nada acá.
-- 2. El resultado es una lista de filas con una columna "sql_line": cada
--    fila es una sentencia INSERT. Copiá TODAS las filas de esa columna
--    (seleccioná el resultado completo y copiá, o usá el botón de
--    exportar/copiar resultados del SQL Editor).
-- 3. Pegá ese texto en el SQL Editor del proyecto NUEVO (Sede 2), dentro
--    de un "begin;" ... "commit;" (ver más abajo), y corré.
-- ============================================================================

select 1 as sort_order,
  format('insert into inventario_categorias (id, nombre, tabla_destino, created_at) values (%L, %L, %L, %L);',
    id, nombre, tabla_destino, created_at) as sql_line
from inventario_categorias

union all
select 2,
  format('insert into products (id, code, name, unit, active, created_at, volumen_por_bache, requiere_envasado) values (%L, %L, %L, %L, %L, %L, %L, %L);',
    id, code, name, unit, active, created_at, volumen_por_bache, requiere_envasado)
from products

union all
select 3,
  format('insert into equipos (id, name, tipo, capacidad, unidad, active, created_at) values (%L, %L, %L, %L, %L, %L, %L);',
    id, name, tipo, capacidad, unidad, active, created_at)
from equipos

union all
select 4,
  format('insert into turnos (id, name, hora_inicio, hora_fin, active, created_at) values (%L, %L, %L, %L, %L, %L);',
    id, name, hora_inicio, hora_fin, active, created_at)
from turnos

union all
select 5,
  format('insert into tanques (id, name, active, created_at) values (%L, %L, %L, %L);',
    id, name, active, created_at)
from tanques

union all
select 6,
  format('insert into insumos (id, name, active, created_at, stock_minimo, codigo, categoria_id, unit) values (%L, %L, %L, %L, %L, %L, %L, %L);',
    id, name, active, created_at, stock_minimo, codigo, categoria_id, unit)
from insumos

union all
select 7,
  format('insert into envasado_insumos (id, name, active, created_at, presentacion_caja, marca, stock_minimo, codigo, categoria_id, unit) values (%L, %L, %L, %L, %L, %L, %L, %L, %L, %L);',
    id, name, active, created_at, presentacion_caja, marca, stock_minimo, codigo, categoria_id, unit)
from envasado_insumos

union all
select 8,
  format('insert into vasos_blancos (id, name, unit, active, created_at, stock_minimo, codigo, categoria_id) values (%L, %L, %L, %L, %L, %L, %L, %L);',
    id, name, unit, active, created_at, stock_minimo, codigo, categoria_id)
from vasos_blancos

union all
select 9,
  format('insert into process_stage_templates (id, product_id, process_type, name, sequence_order, parameter_schema, active, created_at, captures_insumos, captures_readings) values (%L, %L, %L, %L, %L, %L::jsonb, %L, %L, %L, %L);',
    id, product_id, process_type, name, sequence_order, parameter_schema, active, created_at, captures_insumos, captures_readings)
from process_stage_templates

union all
select 10,
  format('insert into product_insumos (product_id, insumo_id) values (%L, %L);',
    product_id, insumo_id)
from product_insumos

union all
select 11,
  format('insert into envasado_referencias (id, product_id, sku, name, peso_unitario, multiempaque, active, created_at) values (%L, %L, %L, %L, %L, %L, %L, %L);',
    id, product_id, sku, name, peso_unitario, multiempaque, active, created_at)
from envasado_referencias

union all
select 12,
  format('insert into enmangado_referencias (id, code, name, vaso_blanco_id, active, created_at) values (%L, %L, %L, %L, %L, %L);',
    id, code, name, vaso_blanco_id, active, created_at)
from enmangado_referencias

union all
select 13,
  format('insert into stage_equipo_requirements (id, stage_template_id, modo, equipo_id, equipo_tipo, orden, created_at) values (%L, %L, %L, %L, %L, %L, %L);',
    id, stage_template_id, modo, equipo_id, equipo_tipo, orden, created_at)
from stage_equipo_requirements

union all
select 14,
  format('insert into envasado_referencia_insumos (referencia_id, envasado_insumo_id) values (%L, %L);',
    referencia_id, envasado_insumo_id)
from envasado_referencia_insumos

union all
select 15,
  format('insert into envasado_referencia_productos (referencia_id, product_id) values (%L, %L);',
    referencia_id, product_id)
from envasado_referencia_productos

order by sort_order;
