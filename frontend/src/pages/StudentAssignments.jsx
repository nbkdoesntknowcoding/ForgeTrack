import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { ClipboardList, Calendar, CheckCircle2, X, Upload as UploadIcon } from 'lucide-react';
import { format, isAfter } from 'date-fns';
import { isValidRepoUrl } from '../lib/github';

export default function StudentAssignments() {
  const { userData } = useAuth();
  const studentId = userData?.student_id;

  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState({}); // {assignment_id: submission}
  const [loading, setLoading] = useState(true);

  const [activeAssignment, setActiveAssignment] = useState(null);
  const [githubUrl, setGithubUrl] = useState('');
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
    setLoading(false);
  };

  const openModal = (a) => {
    const existing = submissions[a.id];
    setActiveAssignment(a);
    setGithubUrl(existing?.github_url || '');
    setPdfFile(null);
  };

  const closeModal = () => { setActiveAssignment(null); setGithubUrl(''); setPdfFile(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValidRepoUrl(githubUrl)) {
      alert('Please enter a valid GitHub repo URL (https://github.com/owner/repo).');
      return;
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
        pdf_path: pdfPath,
        submitted_at: new Date().toISOString(),
      }, { onConflict: 'assignment_id,student_id' });
      if (error) throw error;

      closeModal();
      fetchAll();
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
                  <div className="mt-6 pt-4 border-t border-border-subtle flex justify-between items-center">
                    {submissions[a.id] ? (
                      <span className="text-caption text-secondary inline-flex items-center gap-1">
                        <CheckCircle2 size={12} className="text-success-fg" />
                        Submitted {format(new Date(submissions[a.id].submitted_at), 'MMM d, HH:mm')}
                      </span>
                    ) : <span />}
                    <button onClick={() => openModal(a)} className="btn-primary text-body-sm">
                      {submissions[a.id] ? 'Re-submit' : 'Submit'}
                    </button>
                  </div>
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
