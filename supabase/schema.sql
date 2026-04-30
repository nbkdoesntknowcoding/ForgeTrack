-- ForgeTrack canonical schema
-- Single source of truth. Apply this in the Supabase SQL editor on a fresh project,
-- then run seed.sql.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Students
CREATE TABLE IF NOT EXISTS public.students (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    usn TEXT UNIQUE NOT NULL,
    admission_number TEXT,
    email TEXT,
    branch_code TEXT NOT NULL,
    batch TEXT DEFAULT '2024-2028',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Sessions
CREATE TABLE IF NOT EXISTS public.sessions (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    topic TEXT NOT NULL,
    month_number INTEGER NOT NULL,
    duration_hours DECIMAL(3,1) DEFAULT 2.0,
    session_type TEXT DEFAULT 'offline',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT date_check CHECK (date >= '2025-08-04')
);

-- 3. ImportLog
CREATE TABLE IF NOT EXISTS public.import_log (
    id SERIAL PRIMARY KEY,
    filename TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_rows INTEGER NOT NULL,
    imported_rows INTEGER NOT NULL,
    skipped_rows INTEGER NOT NULL,
    warnings TEXT,
    column_mapping TEXT,
    status TEXT NOT NULL CHECK (status IN ('completed', 'partial', 'failed', 'in_progress'))
);

-- 4. Attendance
CREATE TABLE IF NOT EXISTS public.attendance (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    session_id INTEGER NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    present BOOLEAN NOT NULL,
    marked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    marked_by TEXT DEFAULT 'system',
    import_id INTEGER REFERENCES public.import_log(id) ON DELETE SET NULL,
    UNIQUE(student_id, session_id)
);

-- 5. Materials
CREATE TABLE IF NOT EXISTS public.materials (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('slides', 'recording', 'document', 'link')),
    url TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Users (profile, 1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('mentor', 'student')),
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recursion-safe role check. SECURITY DEFINER bypasses RLS on public.users
-- so the policy below can call it without re-triggering itself.
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

-- Enable RLS on every table
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Students
CREATE POLICY "Mentors manage students" ON public.students
    FOR ALL USING (public.is_mentor());
CREATE POLICY "Students view own record" ON public.students
    FOR SELECT USING (id = (SELECT student_id FROM public.users WHERE id = auth.uid()));

-- Sessions
CREATE POLICY "Mentors manage sessions" ON public.sessions
    FOR ALL USING (public.is_mentor());
CREATE POLICY "Everyone view sessions" ON public.sessions
    FOR SELECT USING (true);

-- Attendance
CREATE POLICY "Mentors manage attendance" ON public.attendance
    FOR ALL USING (public.is_mentor());
CREATE POLICY "Students view own attendance" ON public.attendance
    FOR SELECT USING (student_id = (SELECT student_id FROM public.users WHERE id = auth.uid()));

-- Materials
CREATE POLICY "Mentors manage materials" ON public.materials
    FOR ALL USING (public.is_mentor());
CREATE POLICY "Everyone view materials" ON public.materials
    FOR SELECT USING (true);

-- ImportLog
CREATE POLICY "Mentors manage import_log" ON public.import_log
    FOR ALL USING (public.is_mentor());

-- Users (own row, or any row if mentor)
CREATE POLICY "Users view own profile" ON public.users
    FOR SELECT USING (id = auth.uid() OR public.is_mentor());

-- Note: no on_auth_user_created trigger here. The seed manually inserts public.users
-- rows alongside the auth.users rows. If you later move signup to a self-serve flow,
-- add the trigger then — but make sure the seed no longer inserts public.users
-- manually, or you will hit a duplicate key violation.
