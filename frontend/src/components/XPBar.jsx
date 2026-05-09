import React from 'react';
import LevelBadge from './LevelBadge';

export default function XPBar({ levelInfo, compact = false }) {
  if (!levelInfo) return null;
  const { level, xpInLevel, xpNeeded, progressPct, currentXP } = levelInfo;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <LevelBadge level={level} />
        <div className="flex-1 min-w-[80px]">
          <div className="h-2 bg-surface-inset border-2 border-border-strong overflow-hidden">
            <div
              className="h-full bg-accent-glow transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-caption text-tertiary mt-1 font-mono">
            {xpInLevel} / {xpNeeded} XP
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <LevelBadge level={level} />
        <p className="text-caption text-tertiary">
          {currentXP.toLocaleString()} XP
        </p>
      </div>
      <div className="h-3 bg-surface-inset border-2 border-border-strong overflow-hidden">
        <div
          className="h-full bg-accent-glow transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <p className="text-caption text-tertiary font-mono">
        {xpInLevel} / {xpNeeded} TO NEXT LEVEL
      </p>
    </div>
  );
}
