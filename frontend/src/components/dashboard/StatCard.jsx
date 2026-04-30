import React from 'react';
import { Card } from '../ui/card';

export default function StatCard({ icon: Icon, label, value, sublabel, loading }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-label text-tertiary uppercase">{label}</p>
        {Icon ? <Icon size={16} className="text-tertiary" strokeWidth={1.75} /> : null}
      </div>
      <p className="text-display-sm text-primary tabular-nums mt-3">
        {loading ? <span className="text-tertiary">—</span> : value}
      </p>
      {sublabel ? <p className="text-caption text-tertiary mt-1">{sublabel}</p> : null}
    </Card>
  );
}
