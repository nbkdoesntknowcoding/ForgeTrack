-- Adds per-assignment visibility flag for AI analysis to students,
-- and tightens the existing student-view RLS policy on submission_analyses
-- so the toggle is honored at the database layer.

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS show_analysis_to_student BOOLEAN NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Students view own analyses" ON public.submission_analyses;

CREATE POLICY "Students view own analyses"
  ON public.submission_analyses FOR SELECT
  USING (
    submission_id IN (
      SELECT s.id FROM public.submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE s.student_id = (SELECT student_id FROM public.users WHERE id = auth.uid())
        AND a.show_analysis_to_student = true
    )
  );
