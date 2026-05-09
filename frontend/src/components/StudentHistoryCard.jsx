import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Card, CardContent } from './ui/card';
import AttendanceHeatmap from './AttendanceHeatmap';
import { format, parseISO } from 'date-fns';

function statusToneCls(pct, count) {
  if (count === 0) return 'text-tertiary';
  if (pct >= 90) return 'text-success-fg';
  if (pct >= 75) return 'text-warning-fg';
  return 'text-danger-fg';
}

export default function StudentHistoryCard({ student, sessions, attendanceMap }) {
  const location = useLocation();

  const { presentCount, totalCount, pct, lastPresent } = useMemo(() => {
    let present = 0; let total = 0; let lastPresent = null;
    sessions.forEach((s) => {
      const v = attendanceMap?.get(s.id);
      if (v === true || v === false) {
        total += 1;
        if (v) {
          present += 1;
          lastPresent = s.date;
        }
      }
    });
    return {
      presentCount: present,
      totalCount: total,
      pct: total === 0 ? 0 : (present / total) * 100,
      lastPresent,
    };
  }, [sessions, attendanceMap]);

  const tone = statusToneCls(pct, totalCount);
  const initial = (student.name || '?').charAt(0).toUpperCase();

  return (
    <Link
      to={`/history/${student.id}`}
      state={{ from: location.pathname + location.search }}
      className="block group"
    >
      <Card className="h-full rounded-[24px] hover:-translate-y-1 transition-transform duration-300">
        <CardContent className="pt-5 pb-5 flex flex-col h-full gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-inset border border-border-subtle flex items-center justify-center text-body font-medium text-primary shrink-0">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-body font-semibold text-primary truncate">{student.name}</p>
              <p className="text-caption text-tertiary font-mono truncate">{student.usn}</p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-h2 tabular-nums leading-none ${tone}`}>
                {totalCount === 0 ? '—' : `${pct.toFixed(0)}%`}
              </p>
              {student.branch_code && (
                <span className="pill text-caption mt-1 inline-block">{student.branch_code}</span>
              )}
            </div>
          </div>

          <div className="overflow-hidden">
            <AttendanceHeatmap
              sessions={sessions}
              attendanceMap={attendanceMap}
              compact
            />
          </div>

          <div className="text-caption text-tertiary mt-auto pt-1 border-t border-border-subtle flex justify-between">
            <span>
              {totalCount === 0
                ? 'No attendance yet'
                : `${presentCount}/${totalCount} present`}
            </span>
            {lastPresent && (
              <span>last: {format(parseISO(lastPresent), 'MMM d')}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
