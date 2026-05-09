import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO, isToday } from 'date-fns';
import { CheckCircle2, XCircle, ClipboardList, Calendar, Sparkles, BookOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from '../components/ui/card';

function pctTone(p) {
  if (p >= 90) return 'text-success-fg';
  if (p >= 75) return 'text-warning-fg';
  return 'text-danger-fg';
}

export default function StudentOverview() {
  const { userData } = useAuth();
  const studentId = userData?.student_id;
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    (async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const [att, asgs, subs, nextSess] = await Promise.all([
        supabase
          .from('attendance')
          .select('id, present, sessions(id, date, topic, duration_hours, session_type)')
          .eq('student_id', studentId),
        supabase.from('assignments').select('*').order('due_date', { ascending: true, nullsFirst: false }),
        supabase.from('submissions').select('id, assignment_id, submitted_at').eq('student_id', studentId),
        supabase.from('sessions').select('*').gte('date', today).order('date').limit(1),
      ]);
      const subIds = (subs.data || []).map((s) => s.id);
      const { data: analyses } = subIds.length
        ? await supabase.from('submission_analyses').select('submission_id, status, overall_score').in('submission_id', subIds)
        : { data: [] };
      if (cancelled) return;
      setData({
        attendance: att.data || [],
        assignments: asgs.data || [],
        submissions: subs.data || [],
        nextSession: nextSess.data?.[0] || null,
        analyses: analyses || [],
      });
    })();
    return () => { cancelled = true; };
  }, [studentId]);

  const stats = useMemo(() => {
    if (!data) return null;
    const total = data.attendance.length;
    const present = data.attendance.filter((a) => a.present).length;
    const pct = total === 0 ? 0 : (present / total) * 100;

    const submittedIds = new Set(data.submissions.map((s) => s.assignment_id));
    const pending = data.assignments.filter((a) => !submittedIds.has(a.id));
    const submitted = data.assignments.filter((a) => submittedIds.has(a.id));

    const doneAnalyses = data.analyses.filter((a) => a.status === 'done' && a.overall_score != null);
    const avgScore = doneAnalyses.length === 0
      ? null
      : doneAnalyses.reduce((s, a) => s + a.overall_score, 0) / doneAnalyses.length;

    const recent = [...data.attendance]
      .filter((a) => a.sessions)
      .sort((a, b) => b.sessions.date.localeCompare(a.sessions.date))
      .slice(0, 5);

    const todaySession = data.nextSession && isToday(parseISO(data.nextSession.date))
      ? data.nextSession
      : null;

    return { pct, present, total, pending, submitted, avgScore, recent, todaySession, nextSession: data.nextSession };
  }, [data]);

  if (!studentId) return <div className="text-secondary">Loading profile…</div>;
  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 animate-pulse bg-surface-inset rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-lg text-primary tracking-tight">
          Welcome back, {userData?.display_name?.split(' ')[0] || 'student'}
        </h1>
        <p className="text-body-sm text-secondary mt-1">{format(new Date(), 'EEEE, MMM d')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Attendance */}
        <Card className="rounded-[24px]">
          <CardContent className="pt-6 pb-6">
            <p className="text-label text-tertiary uppercase mb-1">Attendance</p>
            <p className={`text-display-lg tabular-nums ${pctTone(stats.pct)}`}>
              {stats.total === 0 ? '—' : `${stats.pct.toFixed(0)}%`}
            </p>
            <p className="text-caption text-tertiary mt-1">
              {stats.total === 0 ? 'No sessions yet' : `${stats.present} / ${stats.total} present`}
            </p>
          </CardContent>
        </Card>

        {/* Today / next session */}
        <Card className="rounded-[24px]">
          <CardContent className="pt-6 pb-6">
            <p className="text-label text-tertiary uppercase mb-1">
              {stats.todaySession ? 'Today' : 'Next session'}
            </p>
            {stats.nextSession ? (
              <>
                <p className="text-h3 text-primary truncate">{stats.nextSession.topic}</p>
                <p className="text-caption text-tertiary mt-1">
                  {format(parseISO(stats.nextSession.date), 'EEE, MMM d')} ·
                  {' '}{stats.nextSession.duration_hours}h · {stats.nextSession.session_type}
                </p>
              </>
            ) : (
              <p className="text-body text-secondary">No upcoming sessions.</p>
            )}
          </CardContent>
        </Card>

        {/* Assignments */}
        <Card className="rounded-[24px]">
          <CardContent className="pt-6 pb-6">
            <p className="text-label text-tertiary uppercase mb-1">Assignments</p>
            <p className="text-display-lg tabular-nums text-primary">{stats.pending.length}</p>
            <p className="text-caption text-tertiary mt-1">
              pending · {stats.submitted.length} submitted
            </p>
          </CardContent>
        </Card>

        {/* Avg AI score */}
        <Card className="rounded-[24px]">
          <CardContent className="pt-6 pb-6">
            <p className="text-label text-tertiary uppercase mb-1 inline-flex items-center gap-1">
              <Sparkles size={12} className="text-accent-glow" /> AI score
            </p>
            <p className={`text-display-lg tabular-nums ${stats.avgScore == null ? 'text-tertiary' : pctTone(stats.avgScore)}`}>
              {stats.avgScore == null ? '—' : Math.round(stats.avgScore)}
            </p>
            <p className="text-caption text-tertiary mt-1">average across submissions</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-[24px]">
          <CardContent className="pt-6 pb-6 space-y-3">
            <div className="flex justify-between items-baseline">
              <h2 className="text-h3 text-primary">Recent sessions</h2>
              <Link to="/me/attendance" className="text-caption text-accent-glow hover:underline">View all →</Link>
            </div>
            {stats.recent.length === 0 ? (
              <p className="text-body-sm text-tertiary">No attendance recorded yet.</p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {stats.recent.map((a) => (
                  <li key={a.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-body text-primary truncate">{a.sessions.topic}</p>
                      <p className="text-caption text-tertiary">{format(parseISO(a.sessions.date), 'EEE, MMM d')}</p>
                    </div>
                    {a.present ? (
                      <span className="pill text-caption text-success-fg inline-flex items-center gap-1">
                        <CheckCircle2 size={12} /> Present
                      </span>
                    ) : (
                      <span className="pill text-caption text-danger-fg inline-flex items-center gap-1">
                        <XCircle size={12} /> Absent
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[24px]">
          <CardContent className="pt-6 pb-6 space-y-3">
            <div className="flex justify-between items-baseline">
              <h2 className="text-h3 text-primary">Pending assignments</h2>
              <Link to="/me/assignments" className="text-caption text-accent-glow hover:underline">View all →</Link>
            </div>
            {stats.pending.length === 0 ? (
              <p className="text-body-sm text-tertiary inline-flex items-center gap-2">
                <CheckCircle2 size={14} className="text-success-fg" /> All caught up.
              </p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {stats.pending.slice(0, 5).map((a) => (
                  <li key={a.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-body text-primary truncate inline-flex items-center gap-2">
                        <ClipboardList size={14} className="text-accent-glow shrink-0" />
                        {a.title}
                      </p>
                      {a.due_date && (
                        <p className="text-caption text-tertiary mt-0.5 inline-flex items-center gap-1">
                          <Calendar size={10} /> Due {format(parseISO(a.due_date), 'MMM d')}
                        </p>
                      )}
                    </div>
                    <Link to="/me/assignments" className="text-caption text-accent-glow hover:underline shrink-0">
                      Submit →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
