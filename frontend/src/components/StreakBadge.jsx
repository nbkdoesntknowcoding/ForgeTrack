import React from 'react';
import { Flame } from 'lucide-react';

export default function StreakBadge({ days = 0, compact = false }) {
  const hot = days >= 10;
  const warm = days >= 3;
  const color = hot ? 'text-cyber-yellow' : warm ? 'text-accent-glow' : 'text-tertiary';
  const borderColor = hot ? 'border-cyber-yellow' : warm ? 'border-accent-glow' : 'border-border-strong';
  if (compact) {
    return (
      <span className={`pill border-3 ${borderColor} ${color} inline-flex items-center gap-1 ${hot ? 'animate-pulse' : ''}`} style={{ borderWidth: 2 }}>
        <Flame size={12} className={color} fill={hot ? 'currentColor' : 'none'} />
        {days}
      </span>
    );
  }
  return (
    <div className={`card px-3 py-2 inline-flex items-center gap-2 ${hot ? 'shadow-brut-glow' : ''}`}>
      <Flame size={18} className={color} fill={hot ? 'currentColor' : 'none'} />
      <div className="leading-none">
        <p className="text-display-sm tabular-nums text-primary">{days}</p>
        <p className="text-caption text-tertiary mt-1">DAY STREAK</p>
      </div>
    </div>
  );
}
