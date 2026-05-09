import React, { useMemo } from 'react';
import { format, startOfWeek, parseISO, differenceInCalendarWeeks } from 'date-fns';

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Calendar-style attendance heatmap. Rows = class days (default Wed/Thu/Sat),
// columns = weeks. Each cell is colored by status:
//   present  → success
//   absent   → danger
//   no record (session exists, no attendance row) → accent
//   no class that week+day → faded surface
//
// Props:
//   sessions      Array<{ id, date }> sorted by date asc
//   attendanceMap Map<session_id, boolean>  (true=present, false=absent)
//   classDays     int[]  (default [3,4,6])
//   compact       bool   (8px cells for cards, 14px otherwise)
export default function AttendanceHeatmap({
  sessions,
  attendanceMap,
  classDays = [3, 4, 6],
  compact = false,
}) {
  const cellPx = compact ? 8 : 14;
  const gapPx = compact ? 2 : 3;

  const sortedClassDays = useMemo(() => [...classDays].sort((a, b) => a - b), [classDays]);

  const grid = useMemo(() => {
    if (!sessions || sessions.length === 0) return null;
    // Determine the week range covering all sessions.
    const first = parseISO(sessions[0].date);
    const last = parseISO(sessions[sessions.length - 1].date);
    const firstWeekStart = startOfWeek(first, { weekStartsOn: 1 });
    const totalWeeks = differenceInCalendarWeeks(last, first, { weekStartsOn: 1 }) + 1;

    // sessionsByWeekDay[weekIdx][dow] → session
    const sessionsByWeekDay = {};
    sessions.forEach((s) => {
      const d = parseISO(s.date);
      const wIdx = differenceInCalendarWeeks(d, firstWeekStart, { weekStartsOn: 1 });
      const dow = d.getDay();
      if (!sessionsByWeekDay[wIdx]) sessionsByWeekDay[wIdx] = {};
      sessionsByWeekDay[wIdx][dow] = s;
    });

    return { totalWeeks, firstWeekStart, sessionsByWeekDay };
  }, [sessions]);

  const monthLabels = useMemo(() => {
    if (!grid) return [];
    const labels = [];
    let lastMonth = null;
    for (let w = 0; w < grid.totalWeeks; w += 1) {
      const weekDate = new Date(grid.firstWeekStart);
      weekDate.setDate(weekDate.getDate() + w * 7);
      const month = weekDate.getMonth();
      if (month !== lastMonth) {
        labels.push({ weekIdx: w, label: format(weekDate, 'MMM') });
        lastMonth = month;
      }
    }
    return labels;
  }, [grid]);

  if (!grid) {
    return (
      <div className="text-caption text-tertiary py-4 text-center">
        No sessions yet.
      </div>
    );
  }

  const renderCell = (wIdx, dow) => {
    const session = grid.sessionsByWeekDay[wIdx]?.[dow];
    let cls = 'bg-surface-inset/60';
    let title = '';
    if (session) {
      const present = attendanceMap?.get(session.id);
      if (present === true) {
        cls = 'bg-success-fg';
        title = `${DOW_LABELS[dow]}, ${format(parseISO(session.date), 'MMM d')} — Present`;
      } else if (present === false) {
        cls = 'bg-danger-fg';
        title = `${DOW_LABELS[dow]}, ${format(parseISO(session.date), 'MMM d')} — Absent`;
      } else {
        cls = 'bg-accent-glow/40';
        title = `${DOW_LABELS[dow]}, ${format(parseISO(session.date), 'MMM d')} — Not marked`;
      }
    }
    return (
      <div
        key={`${wIdx}-${dow}`}
        title={title}
        className={`${cls} rounded-sm transition-colors`}
        style={{ width: cellPx, height: cellPx }}
      />
    );
  };

  return (
    <div className="inline-block">
      {!compact && monthLabels.length > 0 && (
        <div
          className="relative text-caption text-tertiary mb-1"
          style={{ height: 14, marginLeft: 24 }}
        >
          {monthLabels.map((m) => (
            <span
              key={m.weekIdx}
              className="absolute"
              style={{ left: m.weekIdx * (cellPx + gapPx) }}
            >
              {m.label}
            </span>
          ))}
        </div>
      )}
      <div className="flex" style={{ gap: gapPx }}>
        {!compact && (
          <div
            className="flex flex-col text-caption text-tertiary justify-around pr-1"
            style={{ width: 20, height: sortedClassDays.length * (cellPx + gapPx) - gapPx }}
          >
            {sortedClassDays.map((d) => (
              <span key={d}>{DOW_LABELS[d].slice(0, 1)}</span>
            ))}
          </div>
        )}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${grid.totalWeeks}, ${cellPx}px)`,
            gridTemplateRows: `repeat(${sortedClassDays.length}, ${cellPx}px)`,
            gridAutoFlow: 'column',
            gap: gapPx,
          }}
        >
          {Array.from({ length: grid.totalWeeks }).map((_, w) =>
            sortedClassDays.map((d) => renderCell(w, d))
          )}
        </div>
      </div>
    </div>
  );
}
