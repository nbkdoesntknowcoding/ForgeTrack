import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Check, X, CircleDot, Plus } from 'lucide-react';
import { format, isToday, isFuture, isPast, startOfDay } from 'date-fns';

// Day cell renders one of these states:
//   'past-empty' | 'future-empty' | 'session-good' | 'session-warn' | 'session-bad' | 'session-unmarked'
function classifySession(session) {
  if (!session) return null;
  if (!session.marked) return 'session-unmarked';
  if (session.pct >= 75) return 'session-good';
  if (session.pct >= 60) return 'session-warn';
  return 'session-bad';
}

const TONE = {
  'session-good':     { border: 'border-l-success-fg', bg: 'bg-success-fg/10',  Icon: Check,      iconCls: 'text-success-fg' },
  'session-warn':     { border: 'border-l-warning-fg', bg: 'bg-warning-fg/10',  Icon: CircleDot,  iconCls: 'text-warning-fg' },
  'session-bad':      { border: 'border-l-danger-fg',  bg: 'bg-danger-fg/10',   Icon: X,          iconCls: 'text-danger-fg' },
  'session-unmarked': { border: 'border-l-accent-glow',bg: 'bg-accent-glow/10', Icon: CircleDot,  iconCls: 'text-accent-glow' },
};

export default function DayCell({ date, session, inMonth, compact = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const today = isToday(date);
  const past = isPast(startOfDay(date)) && !today;
  const future = isFuture(startOfDay(date));
  const dateStr = format(date, 'yyyy-MM-dd');
  const state = classifySession(session) || (future ? 'future-empty' : 'past-empty');

  const navState = { state: { from: location.pathname + location.search } };

  const baseCls = `relative h-full min-h-[88px] rounded-lg p-2 border border-border-subtle border-l-[3px] flex flex-col transition-colors ${
    today ? 'ring-1 ring-accent-glow' : ''
  } ${inMonth ? '' : 'opacity-40'}`;

  if (state === 'past-empty') {
    return (
      <div className={`${baseCls} bg-surface-inset`}>
        <span className="text-body-sm text-tertiary">{format(date, 'd')}</span>
      </div>
    );
  }

  if (state === 'future-empty') {
    return (
      <button
        type="button"
        onClick={() => navigate(`/attendance/new?date=${dateStr}`, navState)}
        className={`${baseCls} bg-surface hover:bg-surface-raised text-left group`}
      >
        <span className="text-body-sm text-secondary">{format(date, 'd')}</span>
        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Plus size={20} className="text-accent-glow" />
        </span>
      </button>
    );
  }

  const tone = TONE[state];
  const Icon = tone.Icon;
  return (
    <button
      type="button"
      onClick={() => navigate(`/attendance/${dateStr}`, navState)}
      className={`${baseCls} ${tone.bg} ${tone.border} hover:bg-surface-raised text-left`}
    >
      <div className="flex justify-between items-start">
        <span className={`text-body-sm font-medium ${today ? 'text-primary' : 'text-secondary'}`}>
          {format(date, 'd')}
        </span>
        <Icon size={14} className={tone.iconCls} />
      </div>
      {!compact && (
        <p className="text-body-sm text-primary mt-1 line-clamp-2 leading-tight">{session.topic}</p>
      )}
      <p className="text-caption text-tertiary mt-auto">
        {session.marked ? `${session.present}/${session.total} · ${session.pct}%` : 'Not marked'}
      </p>
    </button>
  );
}
