import React, { useMemo } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, format,
} from 'date-fns';
import DayCell from './DayCell';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarGrid({ month, sessions, compact = false }) {
  const monthDate = new Date(month + '-01');

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const sessionByDate = useMemo(() => {
    const map = new Map();
    sessions.forEach((s) => map.set(s.date, s));
    return map;
  }, [sessions]);

  return (
    <div>
      <div className="grid grid-cols-7 gap-2 mb-2">
        {DOW.map((d) => (
          <div key={d} className="text-label text-tertiary text-center py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2 auto-rows-fr">
        {days.map((d) => {
          const key = format(d, 'yyyy-MM-dd');
          return (
            <DayCell
              key={key}
              date={d}
              session={sessionByDate.get(key)}
              inMonth={isSameMonth(d, monthDate)}
              compact={compact}
            />
          );
        })}
      </div>
    </div>
  );
}
