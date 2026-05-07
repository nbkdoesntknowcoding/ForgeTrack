import React, { useMemo, useState } from 'react';
import { shapeWithHeaderRow } from '../../lib/importParse';

const PREVIEW_ROWS = 6;

export default function Step1bHeaderRow({ matrix, rawMatrix, suggestedHeaderRow, onConfirm, onBack }) {
  const [headerRow, setHeaderRow] = useState(suggestedHeaderRow);
  const preview = useMemo(() => matrix.slice(0, PREVIEW_ROWS), [matrix]);

  const proceed = () => {
    const { headers, rawHeaders, rows } = shapeWithHeaderRow(matrix, rawMatrix, headerRow);
    onConfirm({ headers, rawHeaders, rows, headerRow });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-h2 text-primary">Confirm the header row</h2>
        <p className="text-body-sm text-secondary mt-1">
          Click the row that contains your column names. Rows above it are dropped, rows below become data.
        </p>
      </div>

      <div className="card rounded-2xl p-4">
        <div className="overflow-x-auto -mx-4">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="text-label text-tertiary">
                <th className="px-2 py-2 text-left w-24">USE AS HEADER</th>
                {preview[0]?.map((_, i) => (
                  <th key={i} className="px-2 py-2 text-left text-tertiary font-mono">{colLetter(i)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => {
                const isHeader = i === headerRow;
                const isData = i > headerRow;
                return (
                  <tr
                    key={i}
                    onClick={() => setHeaderRow(i)}
                    className={`cursor-pointer border-t border-border-subtle ${
                      isHeader ? 'bg-accent-glow/10 ring-1 ring-accent-glow' : ''
                    } ${isData ? '' : 'opacity-60'}`}
                  >
                    <td className="px-2 py-2">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="header-row"
                          checked={isHeader}
                          onChange={() => setHeaderRow(i)}
                        />
                        <span className="text-tertiary">Row {i + 1}</span>
                      </label>
                    </td>
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        className={`px-2 py-2 max-w-[160px] truncate ${
                          isHeader ? 'text-primary font-medium' : 'text-secondary'
                        }`}
                        title={cell}
                      >
                        {cell || <span className="text-tertiary/60">—</span>}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="btn-secondary">Back</button>
        <button onClick={proceed} className="btn-primary">
          Use row {headerRow + 1} as header
        </button>
      </div>
    </div>
  );
}

function colLetter(i) {
  let n = i;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}
