-- Bulk-create auth.users + public.users rows for every active student in
-- public.students that doesn't already have a profile.
-- Email convention matches Login.jsx: <usn-lowercase>@forge.local
-- Initial password = USN (case-sensitive). Students can change later from
-- the Account page.

DO $$
DECLARE r RECORD; new_id UUID;
BEGIN
  FOR r IN
    SELECT s.id, s.usn, s.name FROM public.students s
    WHERE s.is_active = true
      AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.student_id = s.id)
      AND s.usn IS NOT NULL
  LOOP
    new_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, email, encrypted_password, email_confirmed_at, aud, role,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      reauthentication_token, phone_change_token, email_change_token_current, phone_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_id,
      lower(r.usn) || '@forge.local',
      crypt(r.usn, gen_salt('bf')),
      now(), 'authenticated', 'authenticated',
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', '', '', '', '', ''
    );
    INSERT INTO public.users (id, email, role, display_name, student_id)
    VALUES (new_id, lower(r.usn) || '@forge.local', 'student', r.name, r.id);
  END LOOP;
END $$;

SELECT COUNT(*) AS student_logins FROM public.users WHERE role = 'student';
