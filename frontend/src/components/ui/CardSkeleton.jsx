import React from 'react';

export default function CardSkeleton({ lines = 2 }) {
  return (
    <div className="space-y-3">
      <div className="h-3 w-1/3 rounded bg-surface-inset animate-pulse" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 w-full rounded bg-surface-inset animate-pulse" />
      ))}
    </div>
  );
}
