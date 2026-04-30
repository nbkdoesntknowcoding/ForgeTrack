import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format, startOfWeek, isSameWeek, subWeeks } from 'date-fns';

function weekLabel(date) {
  const now = new Date();
  if (isSameWeek(date, now, { weekStartsOn: 1 })) return 'This Week';
  if (isSameWeek(date, subWeeks(now, 1), { weekStartsOn: 1 })) return 'Last Week';
  return `Week of ${format(startOfWeek(date, { weekStartsOn: 1 }), 'MMM d')}`;
}

function toneClasses(s) {
  if (!s.marked) return 'border-l-accent-glow';
  if (s.pct >= 75) return 'border-l-success-fg';
  if (s.pct >= 60) return 'border-l-warning-fg';
  return 'border-l-danger-fg';
}

function barColor(s) {
  if (!s.marked) return 'bg-accent-glow';
  if (s.pct >= 75) return 'bg-success-fg';
  if (s.pct >= 60) return 'bg-warning-fg';
  return 'bg-danger-fg';
}

export default function AgendaView({ sessions }) {
  const navigate = useNavigate();
  const location = useLocation();

  const groups = useMemo(() => {
    const map = new Map();
    [...sessions]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .forEach((s) => {
        const d = new Date(s.date);
        const key = format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        if (!map.has(key)) map.set(key, { label: weekLabel(d), items: [] });
        map.get(key).items.push(s);
      });
    return Array.from(map.values());
  }, [sessions]);

  if (sessions.length === 0) return null;

  return (
    <div className="space-y-6">
      {groups.map((g, i) => (
        <div key={i}>
          <p className="text-label text-tertiary mb-3 uppercase">{g.label}</p>
          <div className="space-y-3">
            {g.items.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => navigate(`/attendance/${s.date}`, { state: { from: location.pathname + location.search } })}
                className={`w-full card p-4 rounded-2xl border-l-[3px] ${toneClasses(s)} text-left hover:bg-surface-raised transition-colors`}
              >
                <div className="flex items-baseline justify-between mb-2">
                  <div>
                    <p className="text-body font-semibold text-primary">{s.topic}</p>
                    <p className="text-caption text-tertiary">
                      {format(new Date(s.date), 'EEE, MMM d')} · {s.duration_hours}hr · {s.session_type}
                    </p>
                  </div>
                  <span className="text-body-sm text-secondary">
                    {s.marked ? `${s.present}/${s.total}` : 'Not marked'}
                  </span>
                </div>
                <div className="h-2 bg-surface-inset rounded-full overflow-hidden">
                  <div className={`h-full ${barColor(s)}`} style={{ width: `${s.marked ? s.pct : 0}%` }} />
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
