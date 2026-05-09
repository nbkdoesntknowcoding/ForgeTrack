import React from 'react';

export default function LevelBadge({ level = 0, className = '' }) {
  return (
    <span
      className={`inline-flex items-center justify-center px-2 py-1 bg-accent-glow text-void font-display font-bold text-caption tracking-wider border-3 border-black shadow-brut-sm ${className}`}
      style={{ minWidth: 40 }}
    >
      LV {level}
    </span>
  );
}
