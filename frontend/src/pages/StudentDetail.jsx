import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import BackButton from '../components/BackButton';
import AttendanceHeatmap from '../components/AttendanceHeatmap';
import { format, parseISO } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function StudentDetail() {
  const { id } = useParams();
  const [student, setStudent] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: std }, { data: att }] = await Promise.all([
        supabase.from('students').select('*').eq('id', id).single(),
        supabase
          .from('attendance')
          .select('id, present, sessions(id, date, topic, duration_hours)')
          .eq('student_id', id),
      ]);
      if (cancelled) return;
      setStudent(std);
      const sorted = (att || [])
        .filter((a) => a.sessions)
        .sort((a, b) => a.sessions.date.localeCompare(b.sessions.date));
      setAttendanceData(sorted);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  const sessions = useMemo(() => attendanceData.map((a) => a.sessions), [attendanceData]);
  const attendanceMap = useMemo(() => {
    const m = new Map();
    attendanceData.forEach((a) => m.set(a.sessions.id, a.present));
    return m;
  }, [attendanceData]);

  const totalClasses = attendanceData.length;
  const presentClasses = attendanceData.filter((a) => a.present).length;
  const attPct = totalClasses === 0 ? 0 : (presentClasses / totalClasses) * 100;

  const chartData = useMemo(() => {
    let cumulative = 0;
    return attendanceData.map((record, index) => {
      if (record.present) cumulative += 1;
      return {
        date: format(parseISO(record.sessions.date), 'MMM d'),
        cumulativePct: ((cumulative / (index + 1)) * 100).toFixed(1),
      };
    });
  }, [attendanceData]);

  if (loading) {
    return <div className="space-y-6">
      <BackButton fallback="/history" label="Back to roster" />
      <div className="h-64 animate-pulse bg-surface-inset rounded-2xl w-full" />
    </div>;
  }
  if (!student) {
    return <div className="space-y-6">
      <BackButton fallback="/history" label="Back to roster" />
      <p className="text-secondary">Student not found.</p>
    </div>;
  }

  return (
    <div className="space-y-6">
      <BackButton fallback="/history" label="Back to roster" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 rounded-[24px]">
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-surface-raised border border-border-default flex items-center justify-center mb-4 text-h2 text-primary">
              {(student.name || '?').charAt(0)}
            </div>
            <h3 className="text-h3 text-primary">{student.name}</h3>
            <p className="text-body text-secondary font-mono mt-1 mb-1">{student.usn}</p>
            {student.branch_code && (
              <span className="pill text-caption mb-6">{student.branch_code}</span>
            )}

            <div className="w-full bg-surface-inset p-4 rounded-xl border border-border-subtle">
              <p className="text-caption text-tertiary uppercase mb-1">Overall Attendance</p>
              <p
                className={`text-display-lg tabular-nums ${
                  attPct >= 90 ? 'text-success-fg' : attPct >= 75 ? 'text-warning-fg' : 'text-danger-fg'
                }`}
              >
                {attPct.toFixed(1)}%
              </p>
              <p className="text-caption text-tertiary mt-1">
                {presentClasses} / {totalClasses} sessions
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 rounded-[24px]">
          <CardHeader>
            <CardTitle>Attendance heatmap</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <AttendanceHeatmap sessions={sessions} attendanceMap={attendanceMap} />
            <div className="flex gap-4 mt-4 text-caption text-tertiary">
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-success-fg inline-block" /> Present
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-danger-fg inline-block" /> Absent
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-accent-glow/40 inline-block" /> Not marked
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-surface-inset inline-block" /> No class
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[24px]">
        <CardHeader>
          <CardTitle>Attendance trajectory</CardTitle>
        </CardHeader>
        <CardContent className="h-[260px] w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPctDetail" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-glow)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--accent-glow)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--bg-surface-raised)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--accent-glow)' }}
                />
                <Area type="monotone" dataKey="cumulativePct" stroke="var(--accent-glow)" fillOpacity={1} fill="url(#colorPctDetail)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-secondary">No data available</div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[24px]">
        <CardHeader>
          <CardTitle>Session record</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-default text-label text-tertiary uppercase">
                  <th className="py-3 font-normal font-sans">Date</th>
                  <th className="py-3 font-normal font-sans">Topic</th>
                  <th className="py-3 font-normal font-sans">Duration</th>
                  <th className="py-3 font-normal font-sans text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {attendanceData.map((a) => (
                  <tr key={a.id} className="border-b border-border-subtle last:border-0 hover:bg-surface-inset transition-colors">
                    <td className="py-4 text-body text-secondary whitespace-nowrap">
                      {format(parseISO(a.sessions.date), 'MMM d, yyyy')}
                    </td>
                    <td className="py-4 text-body font-medium text-primary">{a.sessions.topic}</td>
                    <td className="py-4 text-body text-secondary">{a.sessions.duration_hours}h</td>
                    <td className="py-4 text-right">
                      <span className={`pill ${a.present ? 'pill-success' : 'pill-danger'}`}>
                        {a.present ? 'Present' : 'Absent'}
                      </span>
                    </td>
                  </tr>
                ))}
                {attendanceData.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-secondary text-body">
                      No attendance records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
