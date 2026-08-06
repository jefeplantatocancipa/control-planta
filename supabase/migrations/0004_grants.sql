-- ============================================================================
-- Grants para el rol `authenticated`
--
-- Supabase ya no auto-expone tablas/vistas nuevas a los roles de la API
-- (auto_expose_new_tables quedó deprecado, ver supabase/config.toml). RLS por
-- sí sola no alcanza: Postgres primero revisa GRANT a nivel de tabla y recién
-- después evalúa las políticas de RLS. Sin esto, cualquier query desde
-- PostgREST devuelve "permission denied" aunque las políticas sean correctas.
-- ============================================================================

grant usage on schema public to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;

-- Para que las tablas que se creen en migraciones futuras hereden el mismo
-- acceso sin tener que repetir este grant a mano.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
