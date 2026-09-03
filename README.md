# Control de Planta — Lácteos

App de control de procesos para planta de lácteos: captura de datos desde el celular (preparación de baches, envasado, vasos enmangados), programa de producción semanal, cumplimiento y estadísticas.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- Supabase (Postgres + Auth + RLS)
- Recharts para los dashboards

## Puesta en marcha

### 1. Crear el proyecto en Supabase

1. Crea una cuenta y un proyecto en [supabase.com](https://supabase.com).
2. En **Project Settings → API**, copia la `Project URL` y la `anon public key`.
3. Copia `.env.local.example` a `.env.local` y pega esos valores:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

### 2. Aplicar las migraciones

En el **SQL Editor** del proyecto Supabase, ejecuta en orden los archivos de `supabase/migrations/`:

1. `0001_init.sql` — esquema, catálogos y seed de las 8 etapas de bache.
2. `0002_rls.sql` — políticas de seguridad por rol.
3. `0003_views.sql` — vistas para los dashboards.
4. `0004_grants.sql` — permisos de tabla para el rol `authenticated` (Supabase ya no auto-expone tablas nuevas a la API; sin este paso, cualquier consulta falla con "permission denied" aunque las políticas de RLS sean correctas).
5. `0005_enmangado_independiente.sql` — programa y órdenes propias de enmangado, desacoplado de envasado_id.
6. `0006_enmangado_vasos_blancos.sql` — catálogo de vasos blancos (con stock) y de referencias de enmangado; el enmangado queda totalmente desligado del catálogo de productos de baches.
7. `0007_alistamiento_insumos.sql` — nueva etapa "Alistamiento de insumos" (pesaje) al inicio de la preparación de bache, con captura de una lista de insumos (lote, peso, marca) en vez de parámetros fijos.
8. `0008_insumos_receta.sql` — catálogo de insumos y receta por producto (qué insumos le corresponden a cada producto), para que el alistamiento de insumos sea un checklist en vez de texto libre.
9. `0009_captures_insumos.sql` — reemplaza el modo de captura exclusivo (parámetros o insumos) por un flag independiente, para que una etapa pueda tener parámetros propios y checklist de insumos a la vez.
10. `0010_captures_readings.sql` — flag independiente `captures_readings` para que una etapa admita varias lecturas periódicas mientras está en curso (cada una con su hora automática), en vez de un valor único al finalizar — por ejemplo una curva de fermentación.
11. `0011_programa_import_baches.sql` — columnas nuevas en `production_orders` (`orden_codigo`, `tanque`, `baches_planeados`, horas planeadas) para el importador de Excel del programa de Baches; `planned_quantity` deja de ser obligatoria.
12. `0012_volumen_por_bache.sql` — columna `volumen_por_bache` en `products`: volumen estándar de un bache de ese producto, para sugerir el volumen al crear un bache desde una orden de producción (que planea por cantidad de baches, no por litros).
13. `0013_envasado_orders.sql` — tabla `envasado_orders` (programa de Envasado, comparte semana con `production_programs`) para el importador de Excel del "Formato de Empaque": producto (sku), línea, fecha, unidades programadas y gramaje por unidad.
14. `0014_envasado_referencias.sql` — el sku del formato de empaque identifica una presentación empacada (no el producto a granel), así que se agrega el catálogo `envasado_referencias` (sku, nombre, producto, peso unitario, multiempaque) y `envasado_orders` pasa a planear por `referencia_id` en vez de `product_id`.
15. `0015_envasado_order_link.sql` — columna `envasado_order_id` en `envasados`, igual que `baches.production_order_id`: permite iniciar un envasado a partir de una orden de trabajo del programa.
16. `0016_envasado_turnos_cortes.sql` — control de envasado por turno: tabla `turnos` (franjas horarias fijas, con A/B/C precargados), catálogo `envasado_insumos` (envases/empaques), `envasado_insumos_uso` (lote/vencimiento/proveedor/cantidad/desperdicio capturados al iniciar el envasado) y `envasado_cortes` (checkpoint por turno: unidades inicio/final, operarios, sellado cumple/no cumple, lote C/NC, peso de 3 unidades).
17. `0017_envasado_insumos_detalle.sql` — columnas `presentacion_caja` y `marca` en `envasado_insumos`, para el importador de Excel del catálogo de material de empaque.
18. `0018_envasado_referencia_insumos.sql` — tabla `envasado_referencia_insumos`: receta de material de empaque por referencia (sku), igual que `product_insumos` para la receta de materia prima por producto. Filtra el checklist de "Iniciar envasado" a solo los insumos que corresponden a la referencia elegida.

(Alternativamente, con la CLI de Supabase: `supabase link` y luego `supabase db push`.)

### 3. Crear el primer usuario (jefe de planta)

En **Authentication → Users → Add user**, crea tu usuario. Luego en el SQL Editor, actualiza su rol:

```sql
update profiles set role = 'jefe_planta', full_name = 'Tu Nombre'
where id = '<uuid del usuario creado>';
```

Los siguientes usuarios (supervisores, operarios) se pueden invitar igual y luego administrar sus roles desde el módulo de Administración (una vez construido en la Fase 2) o por SQL mientras tanto.

### 4. Correr localmente

```
npm install
npm run dev
```

Abre `http://localhost:3000` — te pedirá iniciar sesión con el usuario creado en el paso 3.

## Estado actual

Fase 1 (Fundación) completada: scaffold, esquema de base de datos, autenticación con roles (`jefe_planta`, `supervisor`, `operario`) y navegación mobile-first. Los módulos de captura y dashboards están planteados como pantallas placeholder, a construir en las siguientes fases.
