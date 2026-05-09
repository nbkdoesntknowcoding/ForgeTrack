import React from 'react';
import AchievementCard from './AchievementCard';

export default function AchievementShelf({ achievements = [] }) {
  if (achievements.length === 0) return null;
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-h3 text-primary">ACHIEVEMENTS</h2>
        <span className="text-caption text-tertiary tabular-nums">
          {unlockedCount} / {achievements.length} unlocked
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {achievements.map((a) => (
          <AchievementCard key={a.id} achievement={a} />
        ))}
      </div>
    </div>
  );
}
