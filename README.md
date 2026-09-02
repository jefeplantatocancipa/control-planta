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
