import React, { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';

export default function Step1aSheetPicker({ peek, onPick, onBack }) {
  const [selected, setSelected] = useState(peek.sheets[0]?.name || '');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-h2 text-primary">Choose a sheet</h2>
        <p className="text-body-sm text-secondary mt-1">
          Your file has {peek.sheets.length} sheets. Pick the one to import.
        </p>
      </div>

      <div className="space-y-2">
        {peek.sheets.map((s) => {
          const isActive = selected === s.name;
          return (
            <label
              key={s.name}
              className={`block p-4 border rounded-2xl cursor-pointer transition-colors ${
                isActive
                  ? 'border-accent-glow bg-accent-glow/5'
                  : 'border-border-subtle hover:bg-surface-raised'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="sheet"
                  className="mt-1"
                  checked={isActive}
                  onChange={() => setSelected(s.name)}
                />
                <FileSpreadsheet
                  size={18}
                  className={isActive ? 'text-accent-glow mt-0.5' : 'text-tertiary mt-0.5'}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-body text-primary font-medium truncate">{s.name}</p>
                  <p className="text-caption text-tertiary mt-0.5">
                    {s.colCount} cols · {s.rowCount} rows
                    {s.hint && s.hint !== 'unknown' ? ` · ${s.hint}` : ''}
                  </p>
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="btn-secondary">Back</button>
        <button
          onClick={() => onPick(selected)}
          className="btn-primary"
          disabled={!selected}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
