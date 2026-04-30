-- One-off migration for the EXISTING live DB.
-- Run this once in the Supabase SQL editor. After it completes,
-- mentor + student logins should succeed without the 500
-- "Database error querying schema".
--
-- Two parts:
--   1. Backfill auth.users token columns that were left NULL by the
--      original seed. GoTrue scans these as Go strings during sign-in
--      and 500s if any are NULL.
--   2. Replace the recursive public.users RLS policy with one that
--      uses a SECURITY DEFINER helper, so fetchUserRole() in the
--      frontend stops 500ing once auth works.

-- 1. Backfill NULL token fields on existing auth.users rows
UPDATE auth.users SET
  confirmation_token         = COALESCE(confirmation_token, ''),
  recovery_token             = COALESCE(recovery_token, ''),
  email_change_token_new     = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  email_change               = COALESCE(email_change, ''),
  phone_change               = COALESCE(phone_change, ''),
  phone_change_token         = COALESCE(phone_change_token, ''),
  reauthentication_token     = COALESCE(reauthentication_token, '');

-- 2. Recursion-safe role check
CREATE OR REPLACE FUNCTION public.is_mentor()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'mentor'
    );
END;
$$;

-- Drop any prior variants of the policies regardless of which schema file was applied
DROP POLICY IF EXISTS "Mentors manage students"               ON public.students;
DROP POLICY IF EXISTS "Mentors have full access to students"  ON public.students;
DROP POLICY IF EXISTS "Students view own record"              ON public.students;
DROP POLICY IF EXISTS "Students can view only their own record" ON public.students;

DROP POLICY IF EXISTS "Mentors manage sessions"               ON public.sessions;
DROP POLICY IF EXISTS "Mentors have full access to sessions"  ON public.sessions;
DROP POLICY IF EXISTS "Everyone view sessions"                ON public.sessions;
DROP POLICY IF EXISTS "Students can view all sessions"        ON public.sessions;

DROP POLICY IF EXISTS "Mentors manage attendance"              ON public.attendance;
DROP POLICY IF EXISTS "Mentors have full access to attendance" ON public.attendance;
DROP POLICY IF EXISTS "Students view own attendance"           ON public.attendance;
DROP POLICY IF EXISTS "Students can view only their own attendance" ON public.attendance;

DROP POLICY IF EXISTS "Mentors manage materials"               ON public.materials;
DROP POLICY IF EXISTS "Mentors have full access to materials"  ON public.materials;
DROP POLICY IF EXISTS "Everyone view materials"                ON public.materials;
DROP POLICY IF EXISTS "Students can view all materials"        ON public.materials;

DROP POLICY IF EXISTS "Mentors manage import_log"              ON public.import_log;
DROP POLICY IF EXISTS "Mentors have full access to import_log" ON public.import_log;

DROP POLICY IF EXISTS "Users view own profile"                 ON public.users;
DROP POLICY IF EXISTS "Mentors can read all users"             ON public.users;
DROP POLICY IF EXISTS "Users can read themselves"              ON public.users;

-- Re-create with the helper function
CREATE POLICY "Mentors manage students" ON public.students
    FOR ALL USING (public.is_mentor());
CREATE POLICY "Students view own record" ON public.students
    FOR SELECT USING (id = (SELECT student_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Mentors manage sessions" ON public.sessions
    FOR ALL USING (public.is_mentor());
CREATE POLICY "Everyone view sessions" ON public.sessions
    FOR SELECT USING (true);

CREATE POLICY "Mentors manage attendance" ON public.attendance
    FOR ALL USING (public.is_mentor());
CREATE POLICY "Students view own attendance" ON public.attendance
    FOR SELECT USING (student_id = (SELECT student_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Mentors manage materials" ON public.materials
    FOR ALL USING (public.is_mentor());
CREATE POLICY "Everyone view materials" ON public.materials
    FOR SELECT USING (true);

CREATE POLICY "Mentors manage import_log" ON public.import_log
    FOR ALL USING (public.is_mentor());

CREATE POLICY "Users view own profile" ON public.users
    FOR SELECT USING (id = auth.uid() OR public.is_mentor());

-- If schema.sql installed the on_auth_user_created trigger, drop it.
-- The seed inserts public.users manually, so the trigger would cause
-- duplicate key violations on signup.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
