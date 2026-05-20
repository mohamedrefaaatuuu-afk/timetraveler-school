
-- Trigger functions: never need to be called by any client role
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;

-- Helper functions used inside RLS policies: keep authenticated, drop anon/public
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_school(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_school_manager(uuid, uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_school(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_manager(uuid, uuid) TO authenticated;
