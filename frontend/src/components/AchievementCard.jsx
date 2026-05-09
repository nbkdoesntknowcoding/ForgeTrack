import React from 'react';

export default function AchievementCard({ achievement }) {
  const { name, icon, desc, hint, unlocked } = achievement;
  return (
    <div
      title={unlocked ? `${name}: ${desc}` : `Locked: ${hint}`}
      className={`shrink-0 w-32 h-32 p-3 flex flex-col items-center justify-center text-center border-3 ${
        unlocked
          ? 'bg-accent-glow/10 border-accent-glow shadow-brut-glow'
          : 'bg-surface-inset border-dashed border-border-strong opacity-50'
      } transition-transform tactile`}
    >
      <span className={`text-4xl mb-1 ${unlocked ? '' : 'grayscale'}`}>{icon}</span>
      <p className={`text-caption tabular-nums ${unlocked ? 'text-accent-glow' : 'text-tertiary'}`}>
        {name}
      </p>
      {!unlocked && <p className="text-micro text-tertiary mt-1 line-clamp-2">{hint}</p>}
    </div>
  );
}
