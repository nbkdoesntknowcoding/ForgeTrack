import React, { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import AttendanceHeatmap from '../components/AttendanceHeatmap';

function pctTone(p) {
  if (p >= 90) return 'text-success-fg';
  if (p >= 75) return 'text-warning-fg';
  return 'text-danger-fg';
}

export default function StudentAttendance() {
  const { userData } = useAuth();
  const studentId = userData?.student_id;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('attendance')
        .select('id, present, sessions(id, date, topic, duration_hours, session_type)')
        .eq('student_id', studentId);
      if (cancelled) return;
      const sorted = (data || [])
        .filter((a) => a.sessions)
        .sort((a, b) => a.sessions.date.localeCompare(b.sessions.date));
      setRows(sorted);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [studentId]);

  const sessions = useMemo(() => rows.map((r) => r.sessions), [rows]);
  const attendanceMap = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => m.set(r.sessions.id, r.present));
    return m;
  }, [rows]);

  const total = rows.length;
  const present = rows.filter((r) => r.present).length;
  const pct = total === 0 ? 0 : (present / total) * 100;

  if (!studentId) return <div className="text-secondary">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-lg text-primary tracking-tight">My Attendance</h1>
        <p className="text-body-sm text-secondary mt-1">Your attendance across the bootcamp.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-[24px]">
          <CardContent className="pt-6 pb-6">
            <p className="text-label text-tertiary uppercase mb-1">Overall</p>
            <p className={`text-display-lg tabular-nums ${pctTone(pct)}`}>
              {total === 0 ? '—' : `${pct.toFixed(1)}%`}
            </p>
            <p className="text-caption text-tertiary mt-1">{present} / {total} present</p>
          </CardContent>
        </Card>
        <Card className="md:col-span-2 rounded-[24px]">
          <CardHeader><CardTitle>Heatmap</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? (
              <div className="h-24 animate-pulse bg-surface-inset rounded-lg" />
            ) : (
              <>
                <AttendanceHeatmap sessions={sessions} attendanceMap={attendanceMap} />
                <div className="flex gap-4 mt-4 text-caption text-tertiary">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-success-fg inline-block" /> Present
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-danger-fg inline-block" /> Absent
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-surface-inset inline-block" /> No class
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[24px]">
        <CardHeader><CardTitle>Session record</CardTitle></CardHeader>
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
                {[...rows].reverse().map((r) => (
                  <tr key={r.id} className="border-b border-border-subtle last:border-0 hover:bg-surface-inset transition-colors">
                    <td className="py-4 text-body text-secondary whitespace-nowrap">
                      {format(parseISO(r.sessions.date), 'MMM d, yyyy')}
                    </td>
                    <td className="py-4 text-body font-medium text-primary">{r.sessions.topic}</td>
                    <td className="py-4 text-body text-secondary">{r.sessions.duration_hours}h</td>
                    <td className="py-4 text-right">
                      <span className={`pill ${r.present ? 'pill-success' : 'pill-danger'}`}>
                        {r.present ? 'Present' : 'Absent'}
                      </span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-secondary text-body">No attendance recorded yet.</td>
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
