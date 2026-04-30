import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';

export default function MonthNav({ month, onChange }) {
  const date = new Date(month + '-01');
  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(format(subMonths(date, 1), 'yyyy-MM'))}
        className="w-9 h-9 rounded-lg border border-border-subtle hover:bg-surface text-secondary hover:text-primary flex items-center justify-center transition-colors"
        aria-label="Previous month"
      >
        <ChevronLeft size={18} />
      </button>
      <span className="text-body font-medium text-primary min-w-[140px] text-center">
        {format(date, 'MMMM yyyy')}
      </span>
      <button
        type="button"
        onClick={() => onChange(format(addMonths(date, 1), 'yyyy-MM'))}
        className="w-9 h-9 rounded-lg border border-border-subtle hover:bg-surface text-secondary hover:text-primary flex items-center justify-center transition-colors"
        aria-label="Next month"
      >
        <ChevronRight size={18} />
      </button>
      <button
        type="button"
        onClick={() => onChange(format(new Date(), 'yyyy-MM'))}
        className="ml-2 px-3 h-9 rounded-lg border border-border-subtle hover:bg-surface text-secondary hover:text-primary text-body-sm transition-colors"
      >
        Today
      </button>
    </div>
  );
}
