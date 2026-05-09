import React, { useEffect, useMemo, useState } from 'react';
import { Search, ArrowUpDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import StudentHistoryCard from '../components/StudentHistoryCard';

const STATUS_BUCKETS = [
  { id: 'all',    label: 'All',           test: () => true },
  { id: 'risk',   label: 'At-risk <75%',  test: (p, t) => t > 0 && p < 75 },
  { id: 'ok',     label: 'On-track 75-90%', test: (p, t) => t > 0 && p >= 75 && p < 90 },
  { id: 'top',    label: 'Above 90%',     test: (p, t) => t > 0 && p >= 90 },
];

const SORT_OPTIONS = [
  { id: 'name',     label: 'Name A-Z' },
  { id: 'pct_desc', label: 'Attendance ↓' },
  { id: 'pct_asc',  label: 'Attendance ↑' },
];

export default function History() {
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  // Controls
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('name');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Supabase enforces a server-side cap on a single select (typically 1000).
      // Paginate through attendance in chunks until we get them all.
      const fetchAllAttendance = async () => {
        const out = [];
        const PAGE = 1000;
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from('attendance')
            .select('student_id, session_id, present')
            .range(from, from + PAGE - 1);
          if (error) throw error;
          out.push(...(data || []));
          if (!data || data.length < PAGE) break;
          if (from > 200000) break; // safety
        }
        return out;
      };
      const [stuRes, sesRes, attRows] = await Promise.all([
        supabase.from('students').select('id, name, usn, branch_code, email').eq('is_active', true).order('name'),
        supabase.from('sessions').select('id, date').order('date'),
        fetchAllAttendance(),
      ]);
      const attRes = { data: attRows };
      if (cancelled) return;
      setStudents(stuRes.data || []);
      setSessions(sesRes.data || []);
      setAttendance(attRes.data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // student_id → Map<session_id, boolean>
  const attBy = useMemo(() => {
    const m = new Map();
    attendance.forEach((a) => {
      if (!m.has(a.student_id)) m.set(a.student_id, new Map());
      m.get(a.student_id).set(a.session_id, a.present);
    });
    return m;
  }, [attendance]);

  // Per-student stats
  const stats = useMemo(() => {
    const m = new Map();
    students.forEach((s) => {
      const am = attBy.get(s.id);
      let present = 0; let total = 0;
      if (am) {
        sessions.forEach((sess) => {
          const v = am.get(sess.id);
          if (v === true) { present += 1; total += 1; }
          else if (v === false) { total += 1; }
        });
      }
      const pct = total === 0 ? 0 : (present / total) * 100;
      m.set(s.id, { present, total, pct });
    });
    return m;
  }, [students, sessions, attBy]);

  const branches = useMemo(() => {
    const set = new Set(students.map((s) => s.branch_code).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = students.filter((s) => {
      if (branch !== 'all' && s.branch_code !== branch) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.usn.toLowerCase().includes(q)) return false;
      const st = stats.get(s.id) || { pct: 0, total: 0 };
      const bucket = STATUS_BUCKETS.find((b) => b.id === status);
      if (bucket && !bucket.test(st.pct, st.total)) return false;
      return true;
    });
    arr.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      const sa = stats.get(a.id)?.pct ?? 0;
      const sb = stats.get(b.id)?.pct ?? 0;
      return sort === 'pct_desc' ? sb - sa : sa - sb;
    });
    return arr;
  }, [students, search, branch, status, sort, stats]);

  // Aggregate counts for header
  const summary = useMemo(() => {
    let totalPct = 0; let countWithData = 0;
    students.forEach((s) => {
      const st = stats.get(s.id);
      if (st && st.total > 0) { totalPct += st.pct; countWithData += 1; }
    });
    return {
      students: students.length,
      sessions: sessions.length,
      avg: countWithData === 0 ? 0 : totalPct / countWithData,
    };
  }, [students, sessions, stats]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-lg text-primary tracking-tight">Student History</h1>
        <p className="text-body-sm text-secondary mt-1">
          {summary.students} students · {summary.sessions} sessions · avg attendance {summary.avg.toFixed(1)}%
        </p>
      </div>

      <div className="card p-4 rounded-2xl flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or USN…"
            className="input pl-9 h-9 w-full"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {branches.map((b) => (
            <button
              key={b}
              onClick={() => setBranch(b)}
              className={`px-3 h-9 rounded-lg text-body-sm transition-colors ${
                branch === b
                  ? 'bg-surface-raised text-primary border border-border-subtle'
                  : 'text-secondary hover:bg-surface'
              }`}
            >
              {b === 'all' ? 'All' : b}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1">
          {STATUS_BUCKETS.map((bk) => (
            <button
              key={bk.id}
              onClick={() => setStatus(bk.id)}
              className={`px-3 h-9 rounded-lg text-body-sm transition-colors ${
                status === bk.id
                  ? 'bg-accent-glow/10 text-primary border border-accent-glow'
                  : 'text-secondary hover:bg-surface border border-border-subtle'
              }`}
            >
              {bk.label}
            </button>
          ))}
        </div>

        <div className="ml-auto inline-flex items-center gap-2">
          <ArrowUpDown size={14} className="text-tertiary" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="input h-9 text-body-sm"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-56 animate-pulse bg-surface-inset rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-secondary border border-dashed border-border-default rounded-2xl">
          {students.length === 0
            ? 'No students yet — go to Upload to import.'
            : 'No students match the current filters.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((s) => (
            <StudentHistoryCard
              key={s.id}
              student={s}
              sessions={sessions}
              attendanceMap={attBy.get(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
