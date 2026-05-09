import React, { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Sparkles, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import AnalysisPanel from '../components/AnalysisPanel';

function tone(p) {
  if (p == null) return 'text-tertiary';
  if (p >= 80) return 'text-success-fg';
  if (p >= 50) return 'text-warning-fg';
  return 'text-danger-fg';
}

export default function StudentResults() {
  const { userData } = useAuth();
  const studentId = userData?.student_id;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    (async () => {
      // Pull submissions joined with assignments. Then analyses in a second
      // query (RLS strips out hidden ones automatically).
      const { data: subs } = await supabase
        .from('submissions')
        .select('id, submitted_at, github_url, assignment_id, assignments(id, title, due_date, show_analysis_to_student)')
        .eq('student_id', studentId);
      const subIds = (subs || []).map((s) => s.id);
      const { data: analyses } = subIds.length
        ? await supabase
            .from('submission_analyses')
            .select('*')
            .in('submission_id', subIds)
        : { data: [] };
      if (cancelled) return;

      const aBySub = new Map((analyses || []).map((a) => [a.submission_id, a]));
      const merged = (subs || [])
        .filter((s) => s.assignments?.show_analysis_to_student)
        .map((s) => ({ ...s, analysis: aBySub.get(s.id) || null }))
        .sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || ''));
      setRows(merged);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [studentId]);

  const summary = useMemo(() => {
    const done = rows.filter((r) => r.analysis?.status === 'done' && r.analysis.overall_score != null);
    if (done.length === 0) return null;
    const avg = done.reduce((s, r) => s + r.analysis.overall_score, 0) / done.length;
    return { count: done.length, avg };
  }, [rows]);

  if (!studentId) return <div className="text-secondary">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-lg text-primary tracking-tight">Results</h1>
        <p className="text-body-sm text-secondary mt-1">
          AI-generated scores and feedback for your submitted assignments.
        </p>
      </div>

      {summary && (
        <Card className="rounded-[24px]">
          <CardContent className="pt-6 pb-6 flex items-baseline gap-4">
            <div>
              <p className="text-label text-tertiary uppercase mb-1 inline-flex items-center gap-1">
                <Sparkles size={12} className="text-accent-glow" /> Average score
              </p>
              <p className={`text-display-lg tabular-nums ${tone(summary.avg)}`}>{Math.round(summary.avg)}</p>
            </div>
            <p className="text-caption text-tertiary ml-auto">across {summary.count} submission{summary.count > 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse bg-surface-inset rounded-2xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-secondary border border-dashed border-border-default rounded-2xl">
          Your mentor hasn't shared any AI analyses yet.
        </div>
      ) : (
        <Card className="rounded-[24px]">
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="text-label text-tertiary border-b border-border-subtle">
                  <th className="text-left p-4">ASSIGNMENT</th>
                  <th className="text-left p-4">SUBMITTED</th>
                  <th className="text-right p-4">SCORE</th>
                  <th className="p-4 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const an = r.analysis;
                  const score = an?.status === 'done' ? an.overall_score : null;
                  const isOpen = openId === r.id;
                  return (
                    <React.Fragment key={r.id}>
                      <tr
                        onClick={() => setOpenId(isOpen ? null : r.id)}
                        className="border-b border-border-subtle hover:bg-surface cursor-pointer"
                      >
                        <td className="p-4">
                          <div className="text-body text-primary">{r.assignments.title}</div>
                          {r.assignments.due_date && (
                            <div className="text-caption text-tertiary">
                              Due {format(parseISO(r.assignments.due_date), 'MMM d, yyyy')}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-body-sm text-secondary">
                          {r.submitted_at ? format(parseISO(r.submitted_at), 'MMM d, HH:mm') : '—'}
                        </td>
                        <td className="p-4 text-right">
                          {score != null ? (
                            <span className={`text-h3 tabular-nums ${tone(score)}`}>{score}</span>
                          ) : an?.status === 'error' ? (
                            <span className="text-caption text-danger-fg">error</span>
                          ) : an?.status === 'running' || an?.status === 'pending' ? (
                            <span className="text-caption text-tertiary">analyzing…</span>
                          ) : (
                            <span className="text-tertiary">—</span>
                          )}
                        </td>
                        <td className="p-4">
                          <ChevronRight
                            size={16}
                            className={`text-tertiary transition-transform ${isOpen ? 'rotate-90' : ''}`}
                          />
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-border-subtle bg-surface-inset/40">
                          <td colSpan={4} className="p-6">
                            <AnalysisPanel analysis={an} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
