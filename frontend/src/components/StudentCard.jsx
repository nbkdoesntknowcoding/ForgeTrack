import React from 'react';
import { Check, X, Circle } from 'lucide-react';

const STATE_CLS = {
  present: 'border-l-success-fg bg-success-fg/10',
  absent:  'border-l-danger-fg bg-danger-fg/10',
  unmarked: 'border-l-border-subtle bg-surface',
};

export default function StudentCard({ student, status, onToggle }) {
  const Icon = status === 'present' ? Check : status === 'absent' ? X : Circle;
  const iconCls =
    status === 'present' ? 'text-success-fg'
    : status === 'absent' ? 'text-danger-fg'
    : 'text-tertiary';

  return (
    <button
      type="button"
      onClick={() => onToggle(student.id)}
      className={`w-full min-h-[88px] p-3 rounded-lg border border-border-subtle border-l-[3px] text-left transition-all hover:bg-surface-raised ${STATE_CLS[status]}`}
      aria-pressed={status === 'present'}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="pill text-caption">{student.branch_code}</span>
        <Icon size={16} className={iconCls} />
      </div>
      <p className="text-body-sm font-medium text-primary truncate leading-tight">{student.name}</p>
      <p className="text-caption text-tertiary font-mono mt-0.5 truncate">{student.usn}</p>
    </button>
  );
}
