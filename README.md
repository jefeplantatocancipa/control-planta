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
