import React from 'react';
import { CalendarDays, List, LayoutGrid } from 'lucide-react';

const OPTIONS = [
  { id: 'calendar', label: 'Calendar', Icon: CalendarDays },
  { id: 'list',     label: 'List',     Icon: List },
  { id: 'agenda',   label: 'Agenda',   Icon: LayoutGrid },
];

export default function ViewToggle({ view, onChange }) {
  return (
    <div className="inline-flex border border-border-subtle rounded-lg overflow-hidden">
      {OPTIONS.map(({ id, label, Icon }) => {
        const active = view === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`px-3 h-9 inline-flex items-center gap-2 text-body-sm transition-colors ${
              active
                ? 'bg-surface-raised text-primary'
                : 'text-secondary hover:bg-surface hover:text-primary'
            }`}
            aria-pressed={active}
          >
            <Icon size={14} /> {label}
          </button>
        );
      })}
    </div>
  );
}
