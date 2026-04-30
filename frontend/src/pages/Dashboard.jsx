import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Calendar, Users, Percent, Clock, Plus, Activity, Upload as UploadIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import StatCard from '../components/dashboard/StatCard';
import CardSkeleton from '../components/ui/CardSkeleton';
import {
  getTickerStats,
  getTodaySession,
  getProgramOverview,
  getRecentActivity,
} from '../services/dashboard';
import { formatRelative } from '../lib/format';

const initialTicker = { totalSessions: 0, overallAttendance: 0, activeStudents: 0, lastSessionDate: null };
const initialToday = { session: null, attendance: [], presentCount: 0 };
const initialOverview = { totalSessions: 0, avgAttendancePct: 0, highest: null, lowest: null };

export default function Dashboard() {
  const { userData } = useAuth();

  const [ticker, setTicker] = useState({ data: initialTicker, loading: true });
  const [today, setToday] = useState({ data: initialToday, loading: true });
  const [overview, setOverview] = useState({ data: initialOverview, loading: true });
  const [activity, setActivity] = useState({ data: [], loading: true });

  useEffect(() => {
    let mounted = true;
    getTickerStats().then((d) => mounted && setTicker({ data: d, loading: false })).catch(() => mounted && setTicker((p) => ({ ...p, loading: false })));
    getTodaySession().then((d) => mounted && setToday({ data: d, loading: false })).catch(() => mounted && setToday((p) => ({ ...p, loading: false })));
    getProgramOverview().then((d) => mounted && setOverview({ data: d, loading: false })).catch(() => mounted && setOverview((p) => ({ ...p, loading: false })));
    getRecentActivity().then((d) => mounted && setActivity({ data: d, loading: false })).catch(() => mounted && setActivity((p) => ({ ...p, loading: false })));
    return () => { mounted = false; };
  }, []);

  const firstName = userData?.display_name?.split(' ')[0] || '';
  const todayLabel = format(new Date(), 'EEEE, MMM d');
  const { session, attendance, presentCount } = today.data;
  const totalToday = attendance.length;
  const presentPct = totalToday > 0 ? (presentCount / totalToday) * 100 : 0;
  const absentList = attendance.filter((a) => !a.present);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display-md text-primary tracking-tight">Welcome back, {firstName}</h1>
        <p className="text-body-sm text-tertiary mt-2">{todayLabel}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Calendar}
          label="Total Sessions"
          value={ticker.data.totalSessions}
          loading={ticker.loading}
        />
        <StatCard
          icon={Percent}
          label="Overall Attendance"
          value={`${ticker.data.overallAttendance.toFixed(1)}%`}
          loading={ticker.loading}
        />
        <StatCard
          icon={Users}
          label="Active Students"
          value={ticker.data.activeStudents}
          loading={ticker.loading}
        />
        <StatCard
          icon={Clock}
          label="Last Session"
          value={ticker.data.lastSessionDate ? format(new Date(ticker.data.lastSessionDate), 'MMM d, yyyy') : '—'}
          loading={ticker.loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <p className="text-label text-tertiary uppercase">Today's Session</p>
          </CardHeader>
          <CardContent>
            {today.loading ? (
              <CardSkeleton lines={3} />
            ) : session ? (
              <div>
                <CardTitle className="text-h2">{session.topic}</CardTitle>
                <div className="flex flex-wrap gap-3 mt-4">
                  <span className="pill pill-info capitalize">{session.session_type}</span>
                  <span className="text-body-sm text-secondary inline-flex items-center gap-2">
                    <Clock size={14} className="text-tertiary" /> {session.duration_hours}h
                  </span>
                  <span className="text-body-sm text-secondary">{format(new Date(session.date), 'EEEE, MMM d')}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-body text-secondary">No session scheduled for today.</p>
                <Link to="/attendance" className="btn-primary">
                  <Plus size={16} /> Create Session
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-label text-tertiary uppercase">Today's Attendance</p>
          </CardHeader>
          <CardContent>
            {today.loading ? (
              <CardSkeleton lines={3} />
            ) : !session ? (
              <p className="text-body text-secondary">Create a session first to mark attendance.</p>
            ) : totalToday === 0 ? (
              <div className="space-y-4">
                <p className="text-body text-secondary">Not yet marked.</p>
                <Link to="/attendance" className="btn-secondary">Mark Attendance</Link>
              </div>
            ) : (
              <div>
                <div className="flex items-end justify-between mb-3">
                  <p className="text-display-sm tabular-nums text-primary">
                    {presentCount}<span className="text-h3 text-tertiary"> / {totalToday}</span>
                  </p>
                  <span className="pill pill-success">{presentPct.toFixed(0)}% present</span>
                </div>
                <div className="h-2 rounded-full bg-surface-inset overflow-hidden">
                  <div className="h-full bg-success-fg" style={{ width: `${presentPct}%` }} />
                </div>
                {absentList.length > 0 && (
                  <div className="mt-5">
                    <p className="text-label text-tertiary uppercase mb-2">Absent</p>
                    <div className="flex flex-wrap gap-2">
                      {absentList.slice(0, 5).map((a) => (
                        <span key={a.id} className="pill pill-danger">{a.students?.name?.split(' ')[0]}</span>
                      ))}
                      {absentList.length > 5 && (
                        <span className="text-caption text-secondary self-center">+ {absentList.length - 5} more</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <p className="text-label text-tertiary uppercase">Program Overview</p>
          </CardHeader>
          <CardContent>
            {overview.loading ? (
              <CardSkeleton lines={4} />
            ) : (
              <div className="divide-y divide-border-subtle">
                <Row label="Total Sessions" value={overview.data.totalSessions} />
                <Row label="Average Attendance" value={`${overview.data.avgAttendancePct.toFixed(1)}%`} />
                <Row
                  label="Highest Attendance"
                  value={overview.data.highest?.name || '—'}
                  meta={overview.data.highest ? `${overview.data.highest.pct.toFixed(1)}%` : null}
                  metaTone="success"
                />
                <Row
                  label="Lowest Attendance"
                  value={overview.data.lowest?.name || '—'}
                  meta={overview.data.lowest ? `${overview.data.lowest.pct.toFixed(1)}%` : null}
                  metaTone="danger"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-label text-tertiary uppercase">Recent Activity</p>
          </CardHeader>
          <CardContent>
            {activity.loading ? (
              <CardSkeleton lines={4} />
            ) : activity.data.length === 0 ? (
              <p className="text-body text-tertiary">No recent activity.</p>
            ) : (
              <ul className="space-y-4">
                {activity.data.map((event, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full bg-surface-inset border border-border-subtle flex items-center justify-center shrink-0">
                      {event.kind === 'import' ? (
                        <UploadIcon size={14} className="text-secondary" />
                      ) : (
                        <Activity size={14} className="text-secondary" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-body text-primary truncate">{event.desc}</p>
                      <p className="text-caption text-tertiary mt-0.5">{formatRelative(event.time)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, meta, metaTone }) {
  const toneClass = metaTone === 'success' ? 'text-success-fg' : metaTone === 'danger' ? 'text-danger-fg' : 'text-secondary';
  return (
    <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
      <p className="text-body text-secondary">{label}</p>
      <div className="text-right">
        <p className="text-body text-primary font-medium">{value}</p>
        {meta ? <p className={`text-caption ${toneClass}`}>{meta}</p> : null}
      </div>
    </div>
  );
}
