# Control de Planta — Lácteos

App de control de producción para una planta de lácteos (fasalact): captura mobile-first de cada etapa del proceso (preparación de baches, envasado, encajado, enmangado), programa de producción semanal con importación de Excel, cumplimiento planeado vs. ejecutado, estadísticas por operario, control de calidad con firma digital, e informes imprimibles con trazabilidad completa.

- **Producción:** https://control-planta-three.vercel.app
- **Repo:** [jefeplantatocancipa/control-planta](https://github.com/jefeplantatocancipa/control-planta)

## Stack

- Next.js 16 (App Router, Turbopack) + TypeScript + React 19
- Tailwind CSS v4 + shadcn/ui (`@base-ui/react`)
- Supabase (Postgres + Auth + RLS)
- Zod + Server Actions (`useActionState`)
- ExcelJS (importadores de programa y catálogos)
- Recharts (dashboards)
- Deploy: Vercel

## Roles y acceso

| Rol | Acceso |
|---|---|
| `jefe_planta` | Todo, incluida Administración |
| `supervisor` | Proceso, Baches, Envasado, Encajado, Enmangado, Programa, Cumplimiento, Estadísticas |
| `operario` | Inicio, Proceso (solo lectura, para ver el estado en vivo) |
| `planeacion` | Inicio, Proceso, Programa |
| `calidad` | Inicio, Proceso, Baches, Envasado — solo lectura del proceso; puede firmar (aprobar/rechazar) cada etapa/turno ya cerrado, sin poder iniciar ni finalizar nada |

## Módulos

- **Proceso** (`/proceso`) — tablero en vivo del proceso actual, etapa por etapa, con el envasado en curso (unidades, tiempo de inicio, paradas).
- **Baches** (`/baches`) — preparación de baches por etapas configurables por producto, con captura de insumos (checklist con lote/peso/marca), lecturas periódicas (curvas de fermentación, etc.), tanques, y balance de masa. Firma de calidad por etapa. Informe imprimible con trazabilidad completa y merma de masa (insumos vs. kg empacados, o vs. el "Kg" final de la etapa de empaque para productos que no se envasan).
- **Envasado** (`/envasado`) — inicio de envasado ligado a un bache, insumos de empaque con inventario inicial/final, turnos por franja horaria ("cortes") con lecturas de calidad (peso, sellado, fechado) y estibas, paradas de línea, firma de calidad por turno, informe imprimible.
- **Encajado** (`/encajado`) — empacado en cajas de lo ya envasado; se crea automáticamente al cerrar un envasado.
- **Enmangado** (`/enmangado`) — etiquetado de vasos, con su propio catálogo (vasos blancos, referencias) y programa, independiente de envasado.
- **Programa** (`/programa`) — programa semanal de producción (baches y envasado) con importadores de Excel, cumplimiento real vs. planeado, y estados de las órdenes automáticos (según el avance real) con override manual.
- **Cumplimiento** (`/cumplimiento`) — planeado vs. ejecutado por semana y por mes.
- **Estadísticas** (`/estadisticas`) — desempeño por operario y por proceso.
- **Administración** (`/admin`) — productos, etapas de proceso, insumos, catálogo de envasado (referencias, insumos, turnos), y usuarios (crear, cambiar rol, resetear contraseña).

## Conceptos clave

- **Etapas configurables por producto**, con parámetros propios, checklist de insumos y/o lecturas periódicas — todo definido desde Administración, sin tocar código.
- **Estados automáticos**: baches y órdenes de producción avanzan solos según el proceso real (`pendiente` → `en_proceso` → `completado`), con override manual siempre disponible.
- **Firma de calidad**: aprobación posterior (nunca bloqueante) de cada etapa de bache o turno de envasado, a cargo del rol `calidad` o `jefe_planta`. Las etapas se cierran normalmente sin importar si ya fueron firmadas.
- **"Firmado por" de cierre**: además de la firma de calidad, cada etapa/turno registra quién ejecutó su cierre (`closed_by`), no solo quién fue elegido como operario responsable al iniciarla.
- **Los timestamps de proceso nunca se editan desde la app** (`started_at`, `ended_at`, `completed_at`). Si hace falta corregir alguno, es una corrección manual por SQL directo en Supabase — a propósito, para que el registro conserve su credibilidad.
- **RLS en dos capas**: `is_staff()` (jefe_planta/supervisor) y `current_role_is(role)` como funciones base (`0002_rls.sql`); cuando distintos roles necesitan distinto acceso a una misma tabla, la política se separa por operación (`_select`/`_insert`/`_update`/`_delete`).

## Puesta en marcha

### 1. Crear el proyecto en Supabase

1. Crea una cuenta y un proyecto en [supabase.com](https://supabase.com).
2. En **Project Settings → API**, copia la `Project URL`, la `anon public key` y la `service_role key`.
3. Copia `.env.local.example` a `.env.local` y pega esos valores:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

   La `service_role key` es secreta (nunca se expone al cliente) y solo se usa en server actions ya protegidas por rol, para lo que el rol `authenticated` no puede hacer por RLS: crear usuarios, resetear contraseñas y leer correos de login en Administración → Usuarios.

### 2. Aplicar las migraciones

Con la CLI de Supabase: `supabase link` y luego `supabase db push`. Alternativamente, en el **SQL Editor** del proyecto, ejecutá en orden numérico los archivos de `supabase/migrations/`:

| Migración | Qué agrega |
|---|---|
| `0001_init.sql` | Esquema base, catálogos y las 8 etapas de bache por defecto |
| `0002_rls.sql` | Políticas de RLS por rol (`is_staff()`, `current_role_is()`) |
| `0003_views.sql` | Vistas para los dashboards (proceso actual, cumplimiento, estadísticas) |
| `0004_grants.sql` | Permisos de tabla para `authenticated` (necesario además de RLS) |
| `0005_enmangado_independiente.sql` | Programa y órdenes propias de enmangado |
| `0006_enmangado_vasos_blancos.sql` | Catálogo de vasos blancos y referencias de enmangado |
| `0007_alistamiento_insumos.sql` | Etapa "Alistamiento de insumos" con checklist (lote/peso/marca) |
| `0008_insumos_receta.sql` | Catálogo de insumos y receta por producto |
| `0009_captures_insumos.sql` | Flag independiente para etapas con checklist de insumos |
| `0010_captures_readings.sql` | Flag independiente para etapas con lecturas periódicas (curvas) |
| `0011_programa_import_baches.sql` | Columnas para el importador de Excel del programa de baches |
| `0012_volumen_por_bache.sql` | Volumen estándar por producto, para sugerir el volumen del bache |
| `0013_envasado_orders.sql` | Programa de envasado (`envasado_orders`), importador del Formato de Empaque |
| `0014_envasado_referencias.sql` | Catálogo de referencias empacadas (sku, peso unitario, multiempaque) |
| `0015_envasado_order_link.sql` | Vincula un envasado a su orden de trabajo del programa |
| `0016_envasado_turnos_cortes.sql` | Turnos, insumos de envasado y cortes (checkpoint por turno) |
| `0017_envasado_insumos_detalle.sql` | Presentación por caja y marca en insumos de envasado |
| `0018_envasado_referencia_insumos.sql` | Receta de material de empaque por referencia |
| `0019_envasado_control_horario.sql` | Cortes como inicio/fin de turno; lecturas de calidad y estibas aparte |
| `0020_bache_volumen_restante.sql` | Volumen restante del bache al finalizar un envasado |
| `0021_encajado.sql` | Módulo de encajado (empacado en cajas), autocreado al cerrar un envasado |
| `0022_tanques.sql` | Catálogo de tanques, para el parámetro "Tanque" de las etapas |
| `0023_envasado_paradas.sql` | Paradas de línea a nivel del envasado (con o sin turno activo) |
| `0024_envasado_lote.sql` | Lote de envasado capturado al iniciar |
| `0025_rol_planeacion.sql` | Nuevo rol `planeacion` |
| `0026_planeacion_rls_programa.sql` | Permisos de escritura de planeación sobre el programa |
| `0027_envasado_orders_supervisor_update.sql` | Supervisor puede actualizar el estado de órdenes de envasado |
| `0028_backfill_encajados.sql` | Backfill de encajados que habían quedado sin crear por un bug |
| `0029_envasado_insumos_inventario.sql` | Inventario inicial/final de insumos de envasado (en vez de "cantidad usada") |
| `0030_rol_calidad.sql` | Nuevo rol `calidad` |
| `0031_calidad_firmas.sql` | Tablas de firma de calidad (`bache_stage_firmas`, `envasado_corte_firmas`) y su RLS |
| `0032_cierre_firmado_por.sql` | Quién ejecuta el cierre de una etapa/turno queda registrado (`closed_by`) |
| `0033_producto_requiere_envasado.sql` | Productos que no se envasan (ej. cremado) no aparecen en "Iniciar envasado" |
| `0034_envasado_referencia_id.sql` | Vincula cada envasado a su referencia, para calcular kg empacados |

### 3. Crear el primer usuario (jefe de planta)

En **Authentication → Users → Add user**, crea tu usuario. Luego en el SQL Editor, actualiza su rol:

```sql
update profiles set role = 'jefe_planta', full_name = 'Tu Nombre'
where id = '<uuid del usuario creado>';
```

Los siguientes usuarios (supervisores, operarios, planeación, calidad) se crean y administran desde **Administración → Usuarios**: cambio de rol, activar/desactivar y reset de contraseña, todo sin tocar SQL.

### 4. Correr localmente

```
npm install
npm run dev
```

Abre `http://localhost:3000` — te pedirá iniciar sesión con el usuario creado en el paso 3.

### Antes de subir un cambio

```
npx tsc --noEmit
npm run lint
npm run build
```

Los tres deben pasar limpio antes de commitear.

## Estado actual

App en uso productivo en fasalact, con todos los módulos activos (Baches, Envasado, Encajado, Enmangado, Programa, Cumplimiento, Estadísticas, Administración, y el módulo de Calidad con firma digital). El desarrollo sigue de forma iterativa a partir de feedback operativo directo de la planta.
