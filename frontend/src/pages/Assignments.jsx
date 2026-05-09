import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Plus, X, ClipboardList, Calendar, Sparkles, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import RubricEditor from '../components/RubricEditor';

export default function Assignments() {
  const { session } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [rubric, setRubric] = useState([{ criterion: '', weight: 100 }]);
  const [showAnalysisToStudent, setShowAnalysisToStudent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenError] = useState(null);

  useEffect(() => { fetchAssignments(); }, []);

  const fetchAssignments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('assignments')
      .select('*, submissions(count)')
      .order('created_at', { ascending: false });
    setAssignments(data || []);
    setLoading(false);
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setDueDate('');
    setRubric([{ criterion: '', weight: 100 }]);
    setShowAnalysisToStudent(false);
    setGenError(null);
  };

  const generateRubric = async () => {
    setGenBusy(true);
    setGenError(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-rubric', {
        body: { title, description, count: 6 },
      });
      if (error) {
        let msg = error.message;
        try { const body = await error.context?.json?.(); if (body?.error) msg = body.error; } catch { /* */ }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      if (Array.isArray(data?.rubric) && data.rubric.length > 0) {
        setRubric(data.rubric);
      } else {
        throw new Error('Empty rubric returned.');
      }
    } catch (err) {
      setGenError(err.message || String(err));
    } finally {
      setGenBusy(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const total = rubric.reduce((s, r) => s + (Number(r.weight) || 0), 0);
    if (total !== 100) {
      alert('Rubric weights must sum to 100.');
      return;
    }
    if (rubric.some(r => !r.criterion.trim())) {
      alert('All criteria must have text.');
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.from('assignments').insert({
        title,
        description: description || null,
        due_date: dueDate || null,
        rubric,
        show_analysis_to_student: showAnalysisToStudent,
        created_by: session?.user?.id ?? null,
      });
      if (error) throw error;
      setShowModal(false);
      resetForm();
      fetchAssignments();
    } catch (err) {
      console.error('Create assignment failed:', err);
      const msg = err?.message || String(err);
      const hint = /relation .* does not exist/i.test(msg)
        ? '\n\nLooks like the assignments tables aren\'t created yet. Run supabase/migration_assignments.sql in the Supabase SQL editor.'
        : /row-level security/i.test(msg)
        ? '\n\nRLS policy blocked the insert. Make sure your user row in public.users has role = "mentor".'
        : '';
      alert('Failed to create assignment:\n\n' + msg + hint);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <h1 className="text-display-lg text-primary tracking-tight">Assignments</h1>
        <button className="btn-primary inline-flex gap-2 items-center" onClick={() => setShowModal(true)}>
          <Plus size={16} /> New Assignment
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <div key={i} className="h-40 animate-pulse bg-surface-inset rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assignments.map(a => (
            <Link key={a.id} to={`/assignments/${a.id}`} className="block group">
              <Card className="h-full rounded-[24px] hover:-translate-y-1 transition-transform duration-300">
                <CardContent className="pt-6 pb-6 flex flex-col h-full">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-surface-inset flex items-center justify-center shrink-0 border border-border-subtle group-hover:border-accent-glow transition-colors">
                      <ClipboardList className="text-accent-glow" size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-body font-semibold text-primary line-clamp-2">{a.title}</h3>
                      <p className="text-caption text-secondary mt-1">{(a.rubric || []).length} rubric items</p>
                    </div>
                  </div>
                  <p className="text-body-sm text-tertiary mb-auto line-clamp-2">
                    {a.description || 'No description.'}
                  </p>
                  <div className="mt-6 pt-4 border-t border-border-subtle flex justify-between items-center text-caption text-secondary">
                    <span className="pill uppercase tracking-wider">
                      {a.submissions?.[0]?.count ?? 0} submissions
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={12} />
                      {a.due_date ? format(new Date(a.due_date), 'MMM d, yyyy') : 'No due date'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}

          {assignments.length === 0 && (
            <div className="col-span-full py-12 text-center text-secondary border border-dashed border-border-default rounded-2xl">
              No assignments yet. Create one to get started.
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-void/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            className="card bg-surface-raised border border-border-default rounded-[24px] shadow-raised p-8 max-w-2xl w-full my-8"
            onSubmit={handleCreate}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-h2 text-primary">New Assignment</h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-secondary hover:text-primary">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-label text-tertiary block mb-1">TITLE</label>
                <input required type="text" className="input w-full" value={title}
                  onChange={e => setTitle(e.target.value)} placeholder="e.g. Build a TODO API" />
              </div>
              <div>
                <div className="flex justify-between items-end mb-1">
                  <label className="text-label text-tertiary">DESCRIPTION</label>
                  <button
                    type="button"
                    onClick={generateRubric}
                    disabled={genBusy || !title.trim() || !description.trim()}
                    className="text-caption text-accent-glow hover:underline inline-flex items-center gap-1 disabled:opacity-50 disabled:no-underline"
                    title={!title.trim() || !description.trim()
                      ? 'Add a title and description first'
                      : 'Generate rubric from this description'}
                  >
                    {genBusy
                      ? <><Loader2 size={12} className="animate-spin" /> Generating…</>
                      : <><Sparkles size={12} /> Generate rubric</>}
                  </button>
                </div>
                <textarea className="input w-full min-h-[100px]" value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What students should build, deliverables, constraints..." />
                {genError && (
                  <p className="text-caption text-danger-fg mt-1">Generate failed: {genError}</p>
                )}
              </div>
              <div>
                <label className="text-label text-tertiary block mb-1">DUE DATE (OPTIONAL)</label>
                <input type="date" className="input w-full" value={dueDate}
                  onChange={e => setDueDate(e.target.value)} />
              </div>
              <RubricEditor rubric={rubric} onChange={setRubric} />
              <label className="flex items-start gap-2 text-body-sm text-secondary cursor-pointer pt-2 border-t border-border-subtle">
                <input
                  type="checkbox"
                  checked={showAnalysisToStudent}
                  onChange={(e) => setShowAnalysisToStudent(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="text-primary">Share AI analysis with students</span>
                  <span className="block text-caption text-tertiary mt-0.5">
                    When students submit, they'll see their score, rubric breakdown, and AI feedback.
                  </span>
                </span>
              </label>
            </div>

            <button type="submit" className="btn-primary w-full mt-8" disabled={isSaving}>
              {isSaving ? 'Creating...' : 'Create Assignment'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
