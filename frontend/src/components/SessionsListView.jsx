import React, { useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowUp, ArrowDown } from 'lucide-react';

const COLS = [
  { key: 'date',    label: 'Date',    align: 'left'  },
  { key: 'topic',   label: 'Topic',   align: 'left'  },
  { key: 'session_type', label: 'Type', align: 'left' },
  { key: 'present', label: 'Present', align: 'right' },
  { key: 'absent',  label: 'Absent',  align: 'right' },
  { key: 'pct',     label: '%',       align: 'right' },
];

function toneFor(s) {
  if (!s.marked) return 'text-accent-glow';
  if (s.pct >= 75) return 'text-success-fg';
  if (s.pct >= 60) return 'text-warning-fg';
  return 'text-danger-fg';
}

export default function SessionsListView({ sessions }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const sortKey = params.get('sort') || 'date';
  const dir = params.get('dir') || 'desc';

  const sorted = useMemo(() => {
    const arr = [...sessions];
    arr.sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [sessions, sortKey, dir]);

  const setSort = (key) => {
    const next = new URLSearchParams(params);
    if (key === sortKey) {
      next.set('dir', dir === 'asc' ? 'desc' : 'asc');
    } else {
      next.set('sort', key);
      next.set('dir', 'asc');
    }
    setParams(next);
  };

  return (
    <div className="card rounded-2xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border-subtle">
            {COLS.map((c) => (
              <th
                key={c.key}
                onClick={() => setSort(c.key)}
                className={`text-label text-tertiary p-4 cursor-pointer hover:text-primary text-${c.align}`}
              >
                <span className="inline-flex items-center gap-1">
                  {c.label}
                  {sortKey === c.key && (dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => (
            <tr
              key={s.id}
              onClick={() => navigate(`/attendance/${s.date}`, { state: { from: location.pathname + location.search } })}
              className="border-b border-border-subtle hover:bg-surface cursor-pointer"
            >
              <td className="p-4 text-body text-primary">{format(new Date(s.date), 'MMM d, yyyy')}</td>
              <td className="p-4 text-body text-primary">{s.topic}</td>
              <td className="p-4"><span className="pill capitalize">{s.session_type}</span></td>
              <td className="p-4 text-right text-body text-secondary">{s.present}</td>
              <td className="p-4 text-right text-body text-secondary">{s.absent}</td>
              <td className={`p-4 text-right text-body font-medium ${toneFor(s)}`}>
                {s.marked ? `${s.pct}%` : '—'}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={COLS.length} className="p-12 text-center text-secondary">
                No sessions in this month.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
