-- 0052 quitó el EXECUTE de handle_new_user() a public. El trigger de
-- auth.users lo dispara supabase_auth_admin al crear un usuario, así que se le
-- da el permiso explícito para que el alta de usuarios no dependa de public.
grant execute on function handle_new_user() to supabase_auth_admin;
