
-- 1. Fix privilege escalation in user_roles
DROP POLICY IF EXISTS "roles_insert_manager_or_self_initial" ON public.user_roles;

CREATE POLICY "roles_insert_manager_or_self_initial"
ON public.user_roles
FOR INSERT
WITH CHECK (
  public.is_school_manager(auth.uid(), school_id)
  OR (
    user_id = auth.uid()
    AND role = 'teacher'::app_role
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.school_id = user_roles.school_id
    )
  )
);

-- 2. Restrict teachers SELECT to school managers (sensitive contact data)
DROP POLICY IF EXISTS "teachers_select_school" ON public.teachers;

CREATE POLICY "teachers_select_managers"
ON public.teachers
FOR SELECT
USING (public.is_school_manager(auth.uid(), school_id));

CREATE POLICY "teachers_select_self"
ON public.teachers
FOR SELECT
USING (user_id = auth.uid());

-- 3. Restrict audit_logs INSERT to authentic identity
DROP POLICY IF EXISTS "audit_insert_auth" ON public.audit_logs;

CREATE POLICY "audit_insert_self"
ON public.audit_logs
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND (school_id IS NULL OR school_id = public.get_user_school(auth.uid()))
);

-- 4. Add Realtime authorization policies scoped by school topic
-- Topic convention: "school:<school_id>" or "user:<user_id>"
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "realtime_school_read" ON realtime.messages;
CREATE POLICY "realtime_school_read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (
    realtime.topic() = ('school:' || public.get_user_school(auth.uid())::text)
  )
  OR (
    realtime.topic() = ('user:' || auth.uid()::text)
  )
);

DROP POLICY IF EXISTS "realtime_school_write" ON realtime.messages;
CREATE POLICY "realtime_school_write"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (
    realtime.topic() = ('school:' || public.get_user_school(auth.uid())::text)
    AND public.is_school_manager(auth.uid(), public.get_user_school(auth.uid()))
  )
  OR (
    realtime.topic() = ('user:' || auth.uid()::text)
  )
);

-- 5. Revoke EXECUTE from anon on security definer helpers (only authenticated needs them for RLS)
REVOKE EXECUTE ON FUNCTION public.get_user_school(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_school_manager(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_user_school(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_manager(uuid, uuid) TO authenticated;
