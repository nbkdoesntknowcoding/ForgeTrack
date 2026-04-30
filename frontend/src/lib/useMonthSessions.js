import { useEffect, useRef, useState } from 'react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { supabase } from './supabase';

// Fetches sessions for a YYYY-MM month, joined with attendance counts.
// Caches per-month so back/forward across months is instant.
// Returns { sessions, loading, refresh }.
export function useMonthSessions(month) {
  const [state, setState] = useState({ sessions: [], loading: true });
  const cache = useRef(new Map());

  const fetchMonth = async (m, force = false) => {
    if (!force && cache.current.has(m)) {
      setState({ sessions: cache.current.get(m), loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    const date = new Date(m + '-01');
    const from = format(startOfMonth(date), 'yyyy-MM-dd');
    const to = format(endOfMonth(date), 'yyyy-MM-dd');

    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, date, topic, session_type, duration_hours')
      .gte('date', from)
      .lte('date', to)
      .order('date');

    if (!sessions || sessions.length === 0) {
      cache.current.set(m, []);
      setState({ sessions: [], loading: false });
      return;
    }

    const ids = sessions.map((s) => s.id);
    const [{ data: attRows }, { count: studentCount }] = await Promise.all([
      supabase.from('attendance').select('session_id, present').in('session_id', ids),
      supabase.from('students').select('*', { count: 'exact', head: true }).eq('is_active', true),
    ]);

    const counts = new Map();
    (attRows || []).forEach((r) => {
      const c = counts.get(r.session_id) || { present: 0, absent: 0 };
      if (r.present) c.present += 1; else c.absent += 1;
      counts.set(r.session_id, c);
    });

    const total = studentCount || 0;
    const enriched = sessions.map((s) => {
      const c = counts.get(s.id) || { present: 0, absent: 0 };
      const marked = c.present + c.absent > 0;
      const pct = total ? Math.round((c.present / total) * 100) : 0;
      return { ...s, present: c.present, absent: c.absent, total, pct, marked };
    });

    cache.current.set(m, enriched);
    setState({ sessions: enriched, loading: false });
  };

  useEffect(() => {
    if (month) fetchMonth(month);
  }, [month]);

  return {
    ...state,
    refresh: () => fetchMonth(month, true),
    invalidate: () => cache.current.delete(month),
  };
}
