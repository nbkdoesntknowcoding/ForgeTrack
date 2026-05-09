import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { ClipboardList, Calendar, CheckCircle2, X, Upload as UploadIcon, Sparkles, Loader2, Lock, ExternalLink } from 'lucide-react';
import AnalysisPanel from '../components/AnalysisPanel';
import { format, isAfter } from 'date-fns';
import { isValidRepoUrl } from '../lib/github';

export default function StudentAssignments() {
  const { userData } = useAuth();
  const studentId = userData?.student_id;

  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState({}); // {assignment_id: submission}
  const [analyses, setAnalyses] = useState({}); // {submission_id: analysis row}
  const [loading, setLoading] = useState(true);

  const [activeAssignment, setActiveAssignment] = useState(null);
  const [githubUrl, setGithubUrl] = useState('');
  const [frontendUrl, setFrontendUrl] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (studentId) fetchAll(); }, [studentId]);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: aList }, { data: sList }] = await Promise.all([
      supabase.from('assignments').select('*').order('created_at', { ascending: false }),
      supabase.from('submissions').select('*').eq('student_id', studentId),
    ]);
    setAssignments(aList || []);
    const map = {};
    (sList || []).forEach(s => { map[s.assignment_id] = s; });
    setSubmissions(map);

    // Fetch analyses for our submissions (RLS filters out hidden ones automatically).
    const subIds = (sList || []).map((s) => s.id);
    if (subIds.length > 0) {
      const { data: aData } = await supabase
        .from('submission_analyses')
        .select('*')
        .in('submission_id', subIds);
      const aMap = {};
      (aData || []).forEach((a) => { aMap[a.submission_id] = a; });
      setAnalyses(aMap);
    }
    setLoading(false);
  };

  const openModal = (a) => {
    const existing = submissions[a.id];
    setActiveAssignment(a);
    setGithubUrl(existing?.github_url || '');
    setFrontendUrl(existing?.frontend_url || '');
    setPdfFile(null);
  };

  const closeModal = () => {
    setActiveAssignment(null);
    setGithubUrl(''); setFrontendUrl(''); setPdfFile(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValidRepoUrl(githubUrl)) {
      alert('Please enter a valid GitHub repo URL (https://github.com/owner/repo).');
      return;
    }
    const fe = frontendUrl.trim();
    if (fe) {
      try {
        const u = new URL(fe);
        if (!/^https?:$/.test(u.protocol)) throw new Error('Must be http or https');
      } catch {
        alert('Frontend link must be a valid http(s) URL (e.g. https://my-app.vercel.app).');
        return;
      }
    }
    if (pdfFile && pdfFile.size > 10 * 1024 * 1024) {
      alert('PDF must be under 10 MB.');
      return;
    }

    setSubmitting(true);
    try {
      let pdfPath = submissions[activeAssignment.id]?.pdf_path || null;

      if (pdfFile) {
        // 1. Get presigned PUT URL from r2-presign Edge Function
        const { data: presign, error: pErr } = await supabase.functions.invoke('r2-presign', {
          body: {
            op: 'put',
            assignment_id: activeAssignment.id,
            filename: pdfFile.name,
            content_type: 'application/pdf',
          },
        });
        if (pErr) throw pErr;
        if (!presign?.url) throw new Error('Failed to get upload URL');

        // 2. Upload directly to R2
        const putRes = await fetch(presign.url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/pdf' },
          body: pdfFile,
        });
        if (!putRes.ok) throw new Error(`R2 upload failed (${putRes.status})`);

        pdfPath = presign.key;
      }

      const { error } = await supabase.from('submissions').upsert({
        assignment_id: activeAssignment.id,
        student_id: studentId,
        github_url: githubUrl,
        frontend_url: frontendUrl.trim() || null,
        pdf_path: pdfPath,
        submitted_at: new Date().toISOString(),
      }, { onConflict: 'assignment_id,student_id' });
      if (error) throw error;

      // Fetch the (just-upserted) submission row to get its id, then fire-and-forget
      // the AI analysis. Don't block the UI on it.
      const { data: sub } = await supabase
        .from('submissions')
        .select('id')
        .eq('assignment_id', activeAssignment.id)
        .eq('student_id', studentId)
        .single();
      if (sub?.id) {
        supabase.functions
          .invoke('analyze-submission', { body: { submission_id: sub.id } })
          .then(() => fetchAll())
          .catch((e) => console.error('Auto-analyze failed:', e));
      }

      closeModal();
      fetchAll();
      // Refresh again ~12s later to pick up the analysis result.
      setTimeout(() => fetchAll(), 12000);
    } catch (err) {
      alert('Submission failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const statusFor = (a) => {
    const sub = submissions[a.id];
    if (sub) return { label: 'Submitted', tone: 'success' };
    if (a.due_date && isAfter(new Date(), new Date(a.due_date))) return { label: 'Overdue', tone: 'danger' };
    return { label: 'Not submitted', tone: 'neutral' };
  };

  // Submissions are open until the END of the due date (23:59:59 local time).
  // No due date = always open.
  const isPastDeadline = (dueDate) => {
    if (!dueDate) return false;
    const eod = new Date(dueDate);
    eod.setHours(23, 59, 59, 999);
    return new Date() > eod;
  };

  if (!studentId) return <div className="text-secondary">Loading profile...</div>;

  return (
    <div className="space-y-8">
      <h1 className="text-display-lg text-primary tracking-tight">My Assignments</h1>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map(i => <div key={i} className="h-40 animate-pulse bg-surface-inset rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {assignments.map(a => {
            const status = statusFor(a);
            return (
              <Card key={a.id} className="rounded-[24px]">
                <CardContent className="pt-6 pb-6 flex flex-col h-full">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-surface-inset flex items-center justify-center shrink-0 border border-border-subtle">
                      <ClipboardList className="text-accent-glow" size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-body font-semibold text-primary">{a.title}</h3>
                      <p className="text-caption text-secondary mt-1 inline-flex items-center gap-1">
                        <Calendar size={12} />
                        {a.due_date ? `Due ${format(new Date(a.due_date), 'MMM d, yyyy')}` : 'No due date'}
                      </p>
                    </div>
                    <span
                      className={`pill text-caption ${
                        status.tone === 'success' ? 'text-success-fg'
                        : status.tone === 'danger' ? 'text-danger-fg'
                        : 'text-secondary'
                      }`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <p className="text-body-sm text-tertiary mb-auto line-clamp-3">
                    {a.description || 'No description.'}
                  </p>
                  <div className="mt-6 pt-4 border-t border-border-subtle space-y-3">
                    {submissions[a.id] && (
                      <div className="space-y-1">
                        <p className="text-caption text-secondary inline-flex items-center gap-1">
                          <CheckCircle2 size={12} className="text-success-fg" />
                          Submitted {format(new Date(submissions[a.id].submitted_at), 'MMM d, HH:mm')}
                        </p>
                        {submissions[a.id].frontend_url && (
                          <a
                            href={submissions[a.id].frontend_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-caption text-info-fg inline-flex items-center gap-1 hover:underline truncate max-w-full"
                          >
                            <ExternalLink size={11} />
                            {submissions[a.id].frontend_url.replace(/^https?:\/\//, '').slice(0, 50)}
                          </a>
                        )}
                      </div>
                    )}
                    {(() => {
                      const locked = isPastDeadline(a.due_date);
                      const hasSub = !!submissions[a.id];
                      let label, disabled = false;
                      if (locked && !hasSub) {
                        label = (<><Lock size={12} /> Closed</>);
                        disabled = true;
                      } else if (locked && hasSub) {
                        label = (<><Lock size={12} /> Locked · {format(new Date(a.due_date), 'MMM d')}</>);
                        disabled = true;
                      } else {
                        label = hasSub ? 'Re-submit' : 'Submit';
                      }
                      return (
                        <div className="flex items-center justify-between gap-2">
                          {locked && hasSub
                            ? <span className="text-caption text-tertiary">Resubmissions closed</span>
                            : <span />}
                          <button
                            onClick={() => !disabled && openModal(a)}
                            disabled={disabled}
                            className="btn-primary text-body-sm inline-flex items-center gap-2 disabled:opacity-50"
                          >
                            {label}
                          </button>
                        </div>
                      );
                    })()}
                  </div>

                  {/* AI analysis (visible only when mentor toggled it on) */}
                  {a.show_analysis_to_student && submissions[a.id] && (() => {
                    const an = analyses[submissions[a.id].id];
                    if (!an) {
                      return (
                        <div className="mt-4 text-caption text-tertiary inline-flex items-center gap-2 border-t border-border-subtle pt-3">
                          <Loader2 size={12} className="animate-spin text-accent-glow" />
                          AI is analyzing your submission…
                        </div>
                      );
                    }
                    if (an.status === 'pending' || an.status === 'running') {
                      return (
                        <div className="mt-4 text-caption text-tertiary inline-flex items-center gap-2 border-t border-border-subtle pt-3">
                          <Loader2 size={12} className="animate-spin text-accent-glow" />
                          Analyzing… this usually takes 10–30 seconds.
                        </div>
                      );
                    }
                    if (an.status === 'error') {
                      return (
                        <div className="mt-4 text-caption text-danger-fg border-t border-border-subtle pt-3">
                          Analysis failed. Re-submit or contact your mentor.
                        </div>
                      );
                    }
                    if (an.status === 'done') {
                      return (
                        <details className="mt-4 border-t border-border-subtle pt-3">
                          <summary className="cursor-pointer text-body-sm text-primary inline-flex items-center gap-2">
                            <Sparkles size={14} className="text-accent-glow" />
                            AI score: <span className={
                              an.overall_score >= 80 ? 'text-success-fg'
                              : an.overall_score >= 50 ? 'text-warning-fg' : 'text-danger-fg'
                            }>{an.overall_score}</span> / 100 — click for details
                          </summary>
                          <div className="mt-3">
                            <AnalysisPanel analysis={an} />
                          </div>
                        </details>
                      );
                    }
                    return null;
                  })()}
                </CardContent>
              </Card>
            );
          })}

          {assignments.length === 0 && (
            <div className="col-span-full py-12 text-center text-secondary border border-dashed border-border-default rounded-2xl">
              No assignments posted yet.
            </div>
          )}
        </div>
      )}

      {activeAssignment && (
        <div className="fixed inset-0 bg-void/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            className="card bg-surface-raised border border-border-default rounded-[24px] shadow-raised p-8 max-w-md w-full"
            onSubmit={handleSubmit}
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <p className="text-label text-tertiary">SUBMIT</p>
                <h2 className="text-h2 text-primary">{activeAssignment.title}</h2>
              </div>
              <button type="button" onClick={closeModal} className="text-secondary hover:text-primary">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-label text-tertiary block mb-1">GITHUB REPO URL</label>
                <input
                  required type="url" className="input w-full"
                  placeholder="https://github.com/owner/repo"
                  value={githubUrl}
                  onChange={e => setGithubUrl(e.target.value)}
                />
                <p className="text-caption text-tertiary mt-1">Must be a public GitHub repository.</p>
              </div>

              <div>
                <label className="text-label text-tertiary block mb-1">FRONTEND LINK (OPTIONAL)</label>
                <input
                  type="url" className="input w-full"
                  placeholder="https://my-app.vercel.app"
                  value={frontendUrl}
                  onChange={e => setFrontendUrl(e.target.value)}
                />
                <p className="text-caption text-tertiary mt-1">
                  Live deployment URL (Vercel, Netlify, GitHub Pages, etc.). The AI will fetch and verify it.
                </p>
              </div>

              <div>
                <label className="text-label text-tertiary block mb-1">PDF (OPTIONAL, MAX 10 MB)</label>
                <label className="flex items-center gap-3 px-4 py-3 border border-dashed border-border-subtle rounded-lg cursor-pointer hover:border-accent-glow transition-colors">
                  <UploadIcon size={18} className="text-secondary" />
                  <span className="text-body-sm text-secondary truncate">
                    {pdfFile ? pdfFile.name : 'Click to choose PDF...'}
                  </span>
                  <input
                    type="file" accept="application/pdf" className="hidden"
                    onChange={e => setPdfFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full mt-8" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
