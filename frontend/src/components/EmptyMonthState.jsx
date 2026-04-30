import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CalendarPlus } from 'lucide-react';
import { format } from 'date-fns';

export default function EmptyMonthState({ month }) {
  const navigate = useNavigate();
  const location = useLocation();
  const label = format(new Date(month + '-01'), 'MMMM yyyy');
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="card bg-surface-raised/95 backdrop-blur-sm border border-border-default rounded-2xl p-8 max-w-sm text-center pointer-events-auto">
        <div className="w-12 h-12 rounded-xl bg-surface-inset border border-border-subtle flex items-center justify-center mx-auto mb-4">
          <CalendarPlus className="text-accent-glow" size={22} />
        </div>
        <h3 className="text-h3 text-primary mb-2">No sessions in {label}</h3>
        <p className="text-body-sm text-secondary mb-6">Sessions typically run Wed & Thu.</p>
        <button
          onClick={() => navigate('/attendance/new', { state: { from: location.pathname + location.search } })}
          className="btn-primary w-full"
        >
          + New Session
        </button>
      </div>
    </div>
  );
}
