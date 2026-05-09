import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '../components/ui/card';
import { ArrowLeft, ExternalLink, FileText, Sparkles, Loader2, X } from 'lucide-react';
import { format } from 'date-fns';
import AnalysisPanel from '../components/AnalysisPanel';

export default function AssignmentDetail() {
  const { id } = useParams();
  const [assignment, setAssignment] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzingId, setAnalyzingId] = useState(null);
  const [selected, setSelected] = useState(null); // submission id for side panel

  useEffect(() => { fetchAll(); }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: a }, { data: subs }] = await Promise.all([
      supabase.from('assignments').select('*').eq('id', id).single(),
      supabase
        .from('submissions')
        .select('*, students(id, name, usn), submission_analyses(*)')
        .eq('assignment_id', id)
        .order('submitted_at', { ascending: false }),
    ]);
    setAssignment(a);
    setRows(subs || []);
    setLoading(false);
  };

  const getAnalysis = (sub) => {
    const arr = sub.submission_analyses;
    if (!arr) return null;
    return Array.isArray(arr) ? arr[0] || null : arr;
  };

  const handleAnalyze = async (submissionId) => {
    setAnalyzingId(submissionId);
    try {
      const { error } = await supabase.functions.invoke('analyze-submission', {
        body: { submission_id: submissionId },
      });
      if (error) throw error;
      await fetchAll();
    } catch (err) {
      alert('Analysis failed: ' + (err.message || err));
    } finally {
      setAnalyzingId(null);
    }
  };

  const getPdfUrl = async (key) => {
    try {
      const { data, error } = await supabase.functions.invoke('r2-presign', {
        body: { op: 'get', key },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, '_blank');
    } catch (err) {
      alert('Failed to get download URL: ' + (err.message || err));
    }
  };

  const selectedRow = rows.find(r => r.id === selected);
  const selectedAnalysis = selectedRow ? getAnalysis(selectedRow) : null;

  if (loading) return <div className="text-secondary">Loading...</div>;
  if (!assignment) return <div className="text-secondary">Assignment not found.</div>;

  return (
    <div className="space-y-8">
      <Link to="/assignments" className="inline-flex items-center gap-2 text-secondary hover:text-primary text-body-sm">
        <ArrowLeft size={16} /> Back to assignments
      </Link>

      <div>
        <h1 className="text-display-lg text-primary tracking-tight">{assignment.title}</h1>
        {assignment.description && (
          <p className="text-body text-secondary mt-3 max-w-3xl whitespace-pre-wrap">{assignment.description}</p>
        )}
        <div className="flex gap-2 flex-wrap mt-4">
          {(assignment.rubric || []).map((r, i) => (
            <span key={i} className="pill text-caption">
              {r.criterion} <span className="text-tertiary">· {r.weight}</span>
            </span>
          ))}
        </div>

        <label className="inline-flex items-center gap-2 mt-4 text-body-sm cursor-pointer text-secondary hover:text-primary">
          <input
            type="checkbox"
            checked={!!assignment.show_analysis_to_student}
            onChange={async (e) => {
              const next = e.target.checked;
              const { error } = await supabase
                .from('assignments')
                .update({ show_analysis_to_student: next })
                .eq('id', assignment.id);
              if (error) { alert('Failed to update: ' + error.message); return; }
              setAssignment({ ...assignment, show_analysis_to_student: next });
            }}
          />
          Share AI analysis with students
        </label>
      </div>

      <div>
        <h2 className="text-h2 text-primary mb-4">Submissions ({rows.length})</h2>

        {rows.length === 0 ? (
          <div className="py-12 text-center text-secondary border border-dashed border-border-default rounded-2xl">
            No submissions yet.
          </div>
        ) : (
          <Card className="rounded-[24px]">
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="text-label text-tertiary border-b border-border-subtle">
                    <th className="text-left p-4">STUDENT</th>
                    <th className="text-left p-4">SUBMITTED</th>
                    <th className="text-left p-4">REPO</th>
                    <th className="text-left p-4">LIVE</th>
                    <th className="text-left p-4">PDF</th>
                    <th className="text-left p-4">SCORE</th>
                    <th className="text-right p-4">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(sub => {
                    const an = getAnalysis(sub);
                    const score = an?.status === 'done' ? an.overall_score : null;
                    return (
                      <tr
                        key={sub.id}
                        className="border-b border-border-subtle hover:bg-surface cursor-pointer"
                        onClick={() => setSelected(sub.id)}
                      >
                        <td className="p-4">
                          <div className="text-body text-primary">{sub.students?.name}</div>
                          <div className="text-caption text-tertiary">{sub.students?.usn}</div>
                        </td>
                        <td className="p-4 text-body-sm text-secondary">
                          {sub.submitted_at ? format(new Date(sub.submitted_at), 'MMM d, yyyy HH:mm') : '—'}
                        </td>
                        <td className="p-4">
                          {sub.github_url ? (
                            <a href={sub.github_url} target="_blank" rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-accent-glow hover:underline text-body-sm">
                              repo <ExternalLink size={12} />
                            </a>
                          ) : <span className="text-tertiary">—</span>}
                        </td>
                        <td className="p-4">
                          {sub.frontend_url ? (
                            <a href={sub.frontend_url} target="_blank" rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-info-fg hover:underline text-body-sm">
                              live <ExternalLink size={12} />
                            </a>
                          ) : <span className="text-tertiary">—</span>}
                        </td>
                        <td className="p-4">
                          {sub.pdf_path ? (
                            <button onClick={(e) => { e.stopPropagation(); getPdfUrl(sub.pdf_path); }}
                              className="inline-flex items-center gap-1 text-accent-glow hover:underline text-body-sm">
                              <FileText size={12} /> view
                            </button>
                          ) : <span className="text-tertiary">—</span>}
                        </td>
                        <td className="p-4">
                          {score !== null && score !== undefined ? (
                            <span className="text-body font-semibold text-primary">{score}</span>
                          ) : an?.status === 'error' ? (
                            <span className="text-caption text-danger-fg">error</span>
                          ) : (
                            <span className="text-tertiary">—</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAnalyze(sub.id); }}
                            disabled={analyzingId === sub.id || !sub.github_url}
                            className="btn-secondary inline-flex items-center gap-2 text-body-sm disabled:opacity-50"
                          >
                            {analyzingId === sub.id ? (
                              <><Loader2 size={14} className="animate-spin" /> Analyzing</>
                            ) : (
                              <><Sparkles size={14} /> {an ? 'Re-analyze' : 'Analyze'}</>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      {selectedRow && (
        <div className="fixed inset-0 bg-void/80 backdrop-blur-sm z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div
            className="bg-surface-raised border-l border-border-default w-full max-w-xl h-full overflow-y-auto p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-label text-tertiary">SUBMISSION</p>
                <h2 className="text-h2 text-primary">{selectedRow.students?.name}</h2>
                <p className="text-caption text-secondary">{selectedRow.students?.usn}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-secondary hover:text-primary">
                <X size={24} />
              </button>
            </div>
            <AnalysisPanel analysis={selectedAnalysis} />
          </div>
        </div>
      )}
    </div>
  );
}
