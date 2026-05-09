import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { computeStreak, computeXP, computeLevel } from '../lib/gamification';
import LeaderboardTable from '../components/Leaderboard';

export default function Leaderboard() {
  const [students, setStudents] = useState([]);
  const [attendanceByStudent, setAttendanceByStudent] = useState(new Map());
  const [submissionsByStudent, setSubmissionsByStudent] = useState(new Map());
  const [analysesBySubmission, setAnalysesBySubmission] = useState(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Paginate attendance like history page does.
      const fetchAllAttendance = async () => {
        const out = [];
        const PAGE = 1000;
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from('attendance')
            .select('student_id, present, sessions(date)')
            .range(from, from + PAGE - 1);
          if (error) throw error;
          out.push(...(data || []));
          if (!data || data.length < PAGE) break;
          if (from > 200000) break;
        }
        return out;
      };

      const [stuRes, attRows, subRes, anRes] = await Promise.all([
        supabase.from('students').select('id, name, usn, branch_code').eq('is_active', true).order('name'),
        fetchAllAttendance(),
        supabase.from('submissions').select('id, student_id, submitted_at, assignment_id'),
        supabase.from('submission_analyses').select('submission_id, status, overall_score'),
      ]);
      if (cancelled) return;

      const attByStu = new Map();
      attRows.forEach((a) => {
        if (!attByStu.has(a.student_id)) attByStu.set(a.student_id, []);
        attByStu.get(a.student_id).push(a);
      });

      const subByStu = new Map();
      (subRes.data || []).forEach((s) => {
        if (!subByStu.has(s.student_id)) subByStu.set(s.student_id, []);
        subByStu.get(s.student_id).push(s);
      });

      const anBySub = new Map((anRes.data || []).map((a) => [a.submission_id, a]));

      setStudents(stuRes.data || []);
      setAttendanceByStudent(attByStu);
      setSubmissionsByStudent(subByStu);
      setAnalysesBySubmission(anBySub);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const rows = useMemo(() => {
    return students.map((s) => {
      const att = attendanceByStudent.get(s.id) || [];
      const subs = submissionsByStudent.get(s.id) || [];
      const aiScores = subs
        .map((sub) => analysesBySubmission.get(sub.id))
        .filter((a) => a?.status === 'done' && typeof a.overall_score === 'number')
        .map((a) => a.overall_score);

      const presentCount = att.filter((a) => a.present).length;
      const totalCount = att.filter((a) => a.present === true || a.present === false).length;
      const presentPct = totalCount === 0 ? 0 : (presentCount / totalCount) * 100;
      const xp = computeXP({ presentCount, submittedCount: subs.length, aiScores });
      const { level } = computeLevel(xp);
      const { days: streak } = computeStreak(att);
      return {
        student_id: s.id,
        name: s.name,
        usn: s.usn,
        xp,
        level,
        streak,
        presentPct,
        presentCount,
        totalCount,
      };
    });
  }, [students, attendanceByStudent, submissionsByStudent, analysesBySubmission]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-lg text-primary tracking-tight">LEADERBOARD</h1>
        <p className="text-body-sm text-secondary mt-1">Cohort rankings by XP, attendance, and streak.</p>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-secondary">Loading scores…</div>
      ) : (
        <LeaderboardTable rows={rows} />
      )}
    </div>
  );
}
