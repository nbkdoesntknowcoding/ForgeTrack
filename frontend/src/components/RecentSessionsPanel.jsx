import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';

function tone(s) {
  if (!s.marked) return 'bg-accent-glow';
  if (s.pct >= 75) return 'bg-success-fg';
  if (s.pct >= 60) return 'bg-warning-fg';
  return 'bg-danger-fg';
}

export default function RecentSessionsPanel({ onViewAll }) {
  const [tab, setTab] = useState('recent');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: sessions } = tab === 'recent'
        ? await supabase.from('sessions').select('id, date, topic').lte('date', today).order('date', { ascending: false }).limit(8)
        : await supabase.from('sessions').select('id, date, topic').gt('date', today).order('date').limit(8);

      if (!sessions || sessions.length === 0) {
        if (active) { setItems([]); setLoading(false); }
        return;
      }
      const ids = sessions.map((s) => s.id);
      const [{ data: attRows }, { count }] = await Promise.all([
        supabase.from('attendance').select('session_id, present').in('session_id', ids),
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('is_active', true),
      ]);
      const counts = new Map();
      (attRows || []).forEach((r) => {
        const c = counts.get(r.session_id) || { present: 0, absent: 0 };
        if (r.present) c.present += 1; else c.absent += 1;
        counts.set(r.session_id, c);
      });
      const total = count || 0;
      const enriched = sessions.map((s) => {
        const c = counts.get(s.id) || { present: 0, absent: 0 };
        const marked = c.present + c.absent > 0;
        const pct = total ? Math.round((c.present / total) * 100) : 0;
        return { ...s, present: c.present, absent: c.absent, total, pct, marked };
      });
      if (active) { setItems(enriched); setLoading(false); }
    })();
    return () => { active = false; };
  }, [tab]);

  return (
    <aside className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="inline-flex border border-border-subtle rounded-lg overflow-hidden">
          {['recent', 'upcoming'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 h-8 text-body-sm capitalize transition-colors ${
                tab === t ? 'bg-surface-raised text-primary' : 'text-secondary hover:bg-surface'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <button onClick={onViewAll} className="text-caption text-secondary hover:text-primary">
          View all ↗
        </button>
      </div>

      <div className="space-y-3">
        {loading && [1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse bg-surface-inset rounded-lg" />
        ))}
        {!loading && items.length === 0 && (
          <p className="text-body-sm text-tertiary border border-dashed border-border-subtle rounded-lg p-4 text-center">
            {tab === 'recent' ? 'No past sessions yet.' : 'No upcoming sessions scheduled.'}
          </p>
        )}
        {!loading && items.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => navigate(`/attendance/${s.date}`, { state: { from: location.pathname + location.search } })}
            className="w-full text-left p-3 bg-surface-inset hover:bg-surface rounded-lg transition-colors"
          >
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-caption text-tertiary uppercase">
                {format(new Date(s.date), 'MMM d · EEE')}
              </span>
              <span className="text-caption text-secondary">
                {s.marked ? `${s.pct}%` : '—'}
              </span>
            </div>
            <p className="text-body-sm text-primary truncate mb-2">{s.topic}</p>
            <div className="h-1 bg-surface rounded-full overflow-hidden">
              <div className={`h-full ${tone(s)}`} style={{ width: `${s.marked ? s.pct : 0}%` }} />
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
