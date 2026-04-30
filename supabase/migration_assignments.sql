-- Adds: assignments, submissions, submission_analyses + RLS + storage bucket.
-- Apply on top of schema.sql in the Supabase SQL editor. Idempotent where possible.

-- 1. Assignments (mentor-authored)
CREATE TABLE IF NOT EXISTS public.assignments (
    id          SERIAL PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT,
    rubric      JSONB NOT NULL DEFAULT '[]'::jsonb,
                -- shape: [{ "criterion": "Uses async/await", "weight": 20 }, ...]
    due_date    DATE,
    created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Submissions (one per student per assignment; upsert on resubmit)
CREATE TABLE IF NOT EXISTS public.submissions (
    id            SERIAL PRIMARY KEY,
    assignment_id INTEGER NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    student_id    INTEGER NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    github_url    TEXT,
    pdf_path      TEXT, -- key inside the 'submissions' storage bucket
    submitted_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(assignment_id, student_id)
);

-- 3. Submission analyses (one row per submission; overwritten on re-analyze via UNIQUE)
CREATE TABLE IF NOT EXISTS public.submission_analyses (
    id              SERIAL PRIMARY KEY,
    submission_id   INTEGER NOT NULL UNIQUE REFERENCES public.submissions(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'done', 'error')),
    overall_score   INTEGER,
    rubric_scores   JSONB,
    summary         TEXT,
    strengths       TEXT[],
    weaknesses      TEXT[],
    raw_response    JSONB,
    error_message   TEXT,
    analyzed_at     TIMESTAMP WITH TIME ZONE,
    analyzed_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- RLS
ALTER TABLE public.assignments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_analyses  ENABLE ROW LEVEL SECURITY;

-- Assignments: mentors full CRUD; students read only.
CREATE POLICY "Mentors manage assignments" ON public.assignments
    FOR ALL USING (public.is_mentor());
CREATE POLICY "Students view assignments" ON public.assignments
    FOR SELECT USING (true);

-- Submissions: mentors full read/write; students manage their own row only.
CREATE POLICY "Mentors manage submissions" ON public.submissions
    FOR ALL USING (public.is_mentor());
CREATE POLICY "Students view own submissions" ON public.submissions
    FOR SELECT USING (
        student_id = (SELECT student_id FROM public.users WHERE id = auth.uid())
    );
CREATE POLICY "Students insert own submissions" ON public.submissions
    FOR INSERT WITH CHECK (
        student_id = (SELECT student_id FROM public.users WHERE id = auth.uid())
    );
CREATE POLICY "Students update own submissions" ON public.submissions
    FOR UPDATE USING (
        student_id = (SELECT student_id FROM public.users WHERE id = auth.uid())
    );

-- Submission analyses: mentors full; students read their own.
CREATE POLICY "Mentors manage analyses" ON public.submission_analyses
    FOR ALL USING (public.is_mentor());
CREATE POLICY "Students view own analyses" ON public.submission_analyses
    FOR SELECT USING (
        submission_id IN (
            SELECT id FROM public.submissions
            WHERE student_id = (SELECT student_id FROM public.users WHERE id = auth.uid())
        )
    );

-- File storage: we use Cloudflare R2, not Supabase Storage. PDFs are uploaded
-- directly from the browser via presigned PUT URLs returned by the
-- `r2-presign` Edge Function. The R2 object key is stored in
-- `submissions.pdf_path` (the column name is kept for historical reasons).
--
-- Required Supabase project secrets (set via `supabase secrets set ...`):
--   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
--
-- Required R2 bucket CORS (Cloudflare dashboard → R2 → bucket → Settings → CORS):
--   AllowedOrigins: your frontend origin(s)
--   AllowedMethods: PUT, GET
--   AllowedHeaders: content-type
--   ExposeHeaders: ETag
