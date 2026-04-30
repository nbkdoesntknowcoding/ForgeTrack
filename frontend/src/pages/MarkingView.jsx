import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Save, Search, RotateCcw, AlertTriangle } from 'lucide-react';

import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import BackButton from '../components/BackButton';
import StudentCard from '../components/StudentCard';
import Dialog from '../components/Dialog';
import UnsavedChangesGuard from '../components/UnsavedChangesGuard';

function getStatus(state, id) {
  if (state[id] === true) return 'present';
  if (state[id] === false) return 'absent';
  return 'unmarked';
}

export default function MarkingView() {
  const { date } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { userData } = useAuth();

  const [session, setSession] = useState(null);
  const [students, setStudents] = useState([]);
  const [state, setState] = useState({});      // { student_id: true|false|undefined }
  const [original, setOriginal] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  // filters
  const [query, setQuery] = useState('');
  const [branch, setBranch] = useState('all');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data: sessionRow } = await supabase
        .from('sessions').select('*').eq('date', date).maybeSingle();

      if (!sessionRow) {
        navigate(`/attendance/new?date=${date}`, {
          replace: true,
          state: location.state,
        });
        return;
      }

      const [{ data: studs }, { data: att }] = await Promise.all([
        supabase.from('students').select('*').eq('is_active', true).order('name'),
        supabase.from('attendance').select('student_id, present').eq('session_id', sessionRow.id),
      ]);

      const map = {};
      (att || []).forEach((a) => { map[a.student_id] = a.present; });
      if (!active) return;
      setSession(sessionRow);
      setStudents(studs || []);
      setState(map);
      setOriginal({ ...map });
      setLoading(false);
    })();
    return () => { active = false; };
  }, [date]);

  const branches = useMemo(() => {
    const set = new Set(students.map((s) => s.branch_code));
    return ['all', ...Array.from(set).sort()];
  }, [students]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (branch !== 'all' && s.branch_code !== branch) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.usn.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [students, query, branch]);

  const counts = useMemo(() => {
    let p = 0, a = 0, u = 0;
    students.forEach((s) => {
      const v = state[s.id];
      if (v === true) p += 1;
      else if (v === false) a += 1;
      else u += 1;
    });
    return { present: p, absent: a, unmarked: u };
  }, [students, state]);

  const dirty = useMemo(() => {
    for (const s of students) {
      if (state[s.id] !== original[s.id]) return true;
    }
    return false;
  }, [students, state, original]);

  const willOverwrite = useMemo(() => {
    for (const s of students) {
      if (original[s.id] !== undefined && state[s.id] !== original[s.id]) return true;
    }
    return false;
  }, [students, state, original]);

  const toggle = (id) => {
    setState((prev) => {
      const cur = prev[id];
      const next = cur === undefined ? true : cur === true ? false : undefined;
      return { ...prev, [id]: next };
    });
  };

  const setAll = (value) => {
    const next = {};
    students.forEach((s) => { next[s.id] = value; });
    setState(next);
  };

  const reset = () => setState({ ...original });

  const doSave = async () => {
    setSaving(true);
    setConfirmOverwrite(false);
    try {
      const payload = students
        .filter((s) => state[s.id] !== undefined)
        .map((s) => ({
          student_id: s.id,
          session_id: session.id,
          present: state[s.id],
          marked_by: userData?.display_name || 'mentor',
        }));
      const { error } = await supabase
        .from('attendance')
        .upsert(payload, { onConflict: 'student_id,session_id' });
      if (error) throw error;

      setOriginal({ ...state });

      const search = location.state?.from?.split('?')[1] ? '?' + location.state.from.split('?')[1] : '';
      navigate('/attendance' + search, { replace: true, state: { refresh: true } });
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const onSaveClick = () => {
    if (willOverwrite) setConfirmOverwrite(true);
    else doSave();
  };

  if (loading) {
    return <div className="text-secondary">Loading session…</div>;
  }
  if (!session) return null;

  return (
    <UnsavedChangesGuard dirty={dirty} onSave={doSave}>
      <div className="space-y-6 pb-32">
        <BackButton label="Back to Sessions" />

        <div>
          <h1 className="text-h1 text-primary tracking-tight">
            {format(new Date(session.date), 'MMM d, yyyy')} — {session.topic}
          </h1>
          <p className="text-body-sm text-secondary mt-1">
            {session.duration_hours} hr · {session.session_type}
            {Object.keys(original).length > 0 ? ` · last marked ${Object.keys(original).length}/${students.length}` : ' · unmarked'}
          </p>
        </div>

        <div className="card rounded-2xl p-4 flex flex-wrap gap-3 items-center">
          <button onClick={() => setAll(true)} className="btn-secondary text-body-sm">Default all present</button>
          <button onClick={() => setAll(false)} className="btn-secondary text-body-sm">All absent</button>
          <button onClick={reset} className="btn-secondary text-body-sm inline-flex items-center gap-1">
            <RotateCcw size={14} /> Reset
          </button>

          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" />
            <input
              type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Quick find by name or USN…"
              className="input pl-9 h-9 w-full"
            />
          </div>

          <div className="flex gap-1">
            {branches.map((b) => (
              <button
                key={b}
                onClick={() => setBranch(b)}
                className={`px-3 h-9 rounded-lg text-body-sm transition-colors ${
                  branch === b ? 'bg-surface-raised text-primary border border-border-subtle' : 'text-secondary hover:bg-surface'
                }`}
              >
                {b === 'all' ? 'All' : b}
              </button>
            ))}
          </div>

          <span className="text-body-sm text-secondary ml-auto">
            <strong className="text-success-fg">{counts.present}</strong> present ·{' '}
            <strong className="text-danger-fg">{counts.absent}</strong> absent ·{' '}
            <strong className="text-tertiary">{counts.unmarked}</strong> unmarked
          </span>
        </div>

        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}
        >
          {visible.map((s) => (
            <StudentCard
              key={s.id}
              student={s}
              status={getStatus(state, s.id)}
              onToggle={toggle}
            />
          ))}
          {visible.length === 0 && (
            <div className="col-span-full py-8 text-center text-secondary border border-dashed border-border-subtle rounded-2xl">
              No students match the current filter.
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 md:left-[260px] right-0 z-30 bg-surface-raised border-t border-border-default px-8 py-4 flex justify-between items-center">
          <span className="text-body-sm text-secondary">
            {dirty ? `${
              students.filter((s) => state[s.id] !== original[s.id]).length
            } unsaved changes` : 'No changes'}
          </span>
          <div className="flex gap-3">
            <button onClick={reset} className="btn-secondary" disabled={!dirty || saving}>Discard</button>
            <button
              onClick={onSaveClick}
              disabled={!dirty || saving}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Save size={16} /> {saving ? 'Saving…' : 'Save Attendance'}
            </button>
          </div>
        </div>

        {confirmOverwrite && (
          <Dialog
            open
            onClose={() => setConfirmOverwrite(false)}
            title="Overwrite saved attendance?"
            maxWidth="max-w-md"
            footer={
              <>
                <button className="btn-secondary" onClick={() => setConfirmOverwrite(false)}>Cancel</button>
                <button className="btn-primary !bg-warning-fg !text-void hover:opacity-90" onClick={doSave}>
                  Yes, overwrite
                </button>
              </>
            }
          >
            <div className="flex gap-3">
              <AlertTriangle className="text-warning-fg shrink-0 mt-1" size={20} />
              <p className="text-body text-secondary">
                You are updating attendance records that were previously saved. This overwrites the historical record.
              </p>
            </div>
          </Dialog>
        )}
      </div>
    </UnsavedChangesGuard>
  );
}
