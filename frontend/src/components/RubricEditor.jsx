import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

export default function RubricEditor({ rubric, onChange }) {
  const totalWeight = rubric.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);

  const update = (idx, patch) => {
    const next = rubric.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChange(next);
  };

  const remove = (idx) => onChange(rubric.filter((_, i) => i !== idx));

  const add = () => onChange([...rubric, { criterion: '', weight: 0 }]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-label text-tertiary">RUBRIC</label>
        <span className={`text-caption ${totalWeight === 100 ? 'text-success-fg' : 'text-warning-fg'}`}>
          Total: {totalWeight} / 100
        </span>
      </div>

      {rubric.length === 0 && (
        <div className="text-body-sm text-tertiary border border-dashed border-border-subtle rounded-lg p-4 text-center">
          No criteria yet. Add at least one to enable AI analysis.
        </div>
      )}

      <div className="space-y-2">
        {rubric.map((r, idx) => (
          <div key={idx} className="flex gap-2 items-start">
            <input
              type="text"
              required
              className="input flex-1"
              placeholder="Criterion (e.g. Uses async/await correctly)"
              value={r.criterion}
              onChange={(e) => update(idx, { criterion: e.target.value })}
            />
            <input
              type="number"
              required
              min={1}
              max={100}
              className="input w-24"
              placeholder="Wt"
              value={r.weight}
              onChange={(e) => update(idx, { weight: Number(e.target.value) })}
            />
            <button
              type="button"
              onClick={() => remove(idx)}
              className="px-3 py-2 text-secondary hover:text-danger-fg transition-colors"
              aria-label="Remove criterion"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        className="btn-secondary inline-flex items-center gap-2 text-body-sm"
      >
        <Plus size={14} /> Add criterion
      </button>
    </div>
  );
}
