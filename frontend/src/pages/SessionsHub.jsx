import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';

import MonthNav from '../components/MonthNav';
import ViewToggle from '../components/ViewToggle';
import CalendarGrid from '../components/CalendarGrid';
import SessionsListView from '../components/SessionsListView';
import AgendaView from '../components/AgendaView';
import RecentSessionsPanel from '../components/RecentSessionsPanel';
import EmptyMonthState from '../components/EmptyMonthState';
import { useMonthSessions } from '../lib/useMonthSessions';

function useViewportWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return w;
}

export default function SessionsHub() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const width = useViewportWidth();
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;

  const month = params.get('month') || format(new Date(), 'yyyy-MM');
  const urlView = params.get('view');
  const view = isMobile ? 'agenda' : (urlView || 'calendar');
  const q = (params.get('q') || '').trim().toLowerCase();

  const { sessions, loading, refresh } = useMonthSessions(month);

  // Refresh when returning from a route that mutated data (e.g., after save).
  useEffect(() => {
    if (location.state?.refresh) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const filtered = useMemo(() => {
    if (!q) return sessions;
    return sessions.filter((s) => s.topic.toLowerCase().includes(q) || s.date.includes(q));
  }, [sessions, q]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value == null || value === '') next.delete(key); else next.set(key, value);
    setParams(next);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-primary tracking-tight">Mark Attendance</h1>
        <p className="text-body-sm text-secondary mt-1">
          Track sessions and student attendance across the bootcamp.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <MonthNav month={month} onChange={(m) => setParam('month', m)} />
          {!isMobile && <ViewToggle view={view} onChange={(v) => setParam('view', v)} />}
        </div>
        <div className="flex gap-3 items-center">
          <input
            type="text"
            placeholder="Search topic or date…"
            className="input h-9 w-56"
            value={params.get('q') || ''}
            onChange={(e) => setParam('q', e.target.value)}
          />
          <button
            onClick={() => navigate('/attendance/new', { state: { from: location.pathname + location.search } })}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus size={16} /> New Session
          </button>
        </div>
      </div>

      <div className={`grid gap-6 ${!isMobile && !isTablet ? 'lg:grid-cols-[1fr_300px]' : ''}`}>
        <div className="relative min-h-[400px]">
          {loading ? (
            <div className="h-[480px] animate-pulse bg-surface-inset rounded-2xl" />
          ) : (
            <>
              {view === 'calendar' && <CalendarGrid month={month} sessions={filtered} compact={isTablet} />}
              {view === 'list' && <SessionsListView sessions={filtered} />}
              {view === 'agenda' && <AgendaView sessions={filtered} />}
              {filtered.length === 0 && view !== 'list' && <EmptyMonthState month={month} />}
            </>
          )}
        </div>

        {!isMobile && !isTablet && (
          <RecentSessionsPanel onViewAll={() => setParam('view', 'list')} />
        )}
      </div>

      {/* Renders <CreateSessionDialog /> when on /attendance/new */}
      <Outlet context={{ refreshSessions: refresh, month }} />
    </div>
  );
}
