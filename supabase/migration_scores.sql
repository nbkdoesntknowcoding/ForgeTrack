-- Adds session_scores table for Knowledge / Skill / Pre-assessment scores.
-- Apply on top of schema.sql + migration_assignments.sql.

CREATE TABLE IF NOT EXISTS public.session_scores (
    id           SERIAL PRIMARY KEY,
    student_id   INTEGER NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    session_id   INTEGER NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    metric       TEXT NOT NULL,        -- 'knowledge' | 'skill' | 'pre_assessment' | etc.
    value        NUMERIC NOT NULL,
    max_value    NUMERIC,              -- e.g. 25 for Knowledge(25)
    marked_by    TEXT DEFAULT 'csv_import',
    import_id    INTEGER REFERENCES public.import_log(id) ON DELETE SET NULL,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, session_id, metric)
);

ALTER TABLE public.session_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mentors manage scores" ON public.session_scores
    FOR ALL USING (public.is_mentor());

CREATE POLICY "Students view own scores" ON public.session_scores
    FOR SELECT USING (
        student_id = (SELECT student_id FROM public.users WHERE id = auth.uid())
    );
