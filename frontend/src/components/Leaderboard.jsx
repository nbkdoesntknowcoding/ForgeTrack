import React, { useMemo, useState } from 'react';

const SORTS = [
  { id: 'xp',         label: 'XP' },
  { id: 'attendance', label: 'Attendance %' },
  { id: 'streak',     label: 'Streak' },
];

const RANK_EMOJI = ['🥇', '🥈', '🥉'];

// rows: [{ student_id, name, usn, xp, level, streak, presentPct, presentCount, totalCount }]
export default function Leaderboard({ rows = [], limit, defaultSort = 'xp', highlightStudentId }) {
  const [sort, setSort] = useState(defaultSort);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      if (sort === 'xp') return b.xp - a.xp;
      if (sort === 'attendance') return b.presentPct - a.presentPct;
      if (sort === 'streak') return b.streak - a.streak;
      return 0;
    });
    return limit ? arr.slice(0, limit) : arr;
  }, [rows, sort, limit]);

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="text-h3 text-primary">LEADERBOARD</h2>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="input h-8 text-caption"
        >
          {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto -mx-2">
        <table className="w-full">
          <thead>
            <tr className="text-label text-tertiary border-b-2 border-border-strong">
              <th className="text-left p-2 w-12">#</th>
              <th className="text-left p-2">STUDENT</th>
              <th className="text-right p-2">XP</th>
              <th className="text-right p-2 hidden sm:table-cell">LV</th>
              <th className="text-right p-2 hidden md:table-cell">ATT %</th>
              <th className="text-right p-2 hidden md:table-cell">STREAK</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const isMe = highlightStudentId && r.student_id === highlightStudentId;
              return (
                <tr
                  key={r.student_id}
                  className={`border-b border-border-subtle ${isMe ? 'bg-accent-glow/10' : ''}`}
                >
                  <td className="p-2 font-mono">
                    {i < 3 ? <span className="text-2xl">{RANK_EMOJI[i]}</span> : <span className="text-tertiary tabular-nums">{i + 1}</span>}
                  </td>
                  <td className="p-2">
                    <p className={`text-body font-semibold ${isMe ? 'text-accent-glow' : 'text-primary'}`}>{r.name}</p>
                    <p className="text-caption text-tertiary font-mono">{r.usn}</p>
                  </td>
                  <td className="p-2 text-right text-h3 tabular-nums text-accent-glow">{r.xp.toLocaleString()}</td>
                  <td className="p-2 text-right hidden sm:table-cell">
                    <span className="pill text-caption">LV {r.level}</span>
                  </td>
                  <td className="p-2 text-right hidden md:table-cell tabular-nums text-secondary">{r.presentPct.toFixed(0)}%</td>
                  <td className="p-2 text-right hidden md:table-cell tabular-nums text-cyber-yellow">🔥 {r.streak}</td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-tertiary">No data yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
