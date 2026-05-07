import React, { useEffect, useState } from 'react';
import { classifyText } from '../../lib/importMap';

const KIND_OPTIONS = [
  { value: 'ignore',           label: 'Ignore' },
  { value: 'student_name',     label: 'Student name' },
  { value: 'usn',              label: 'USN' },
  { value: 'email',            label: 'Email' },
  { value: 'branch_code',      label: 'Branch code' },
  { value: 'admission_number', label: 'Admission #' },
  { value: 'batch',            label: 'Batch' },
  { value: 'date',             label: 'Date column (pivoted)' },
  { value: 'attendance_value', label: 'Attendance value' },
  { value: 'score',            label: 'Score' },
  { value: 'custom',           label: 'Custom (clarify…)' },
];

const KIND_LABEL = Object.fromEntries(KIND_OPTIONS.map((o) => [o.value, o.label]));

const DATE_REQUIRING_KINDS = new Set(['date', 'attendance_value', 'score']);
const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dowOf(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  return d.getDay();
}

function pad(n) { return String(n).padStart(2, '0'); }

// Parses common Indian / ISO date input formats into YYYY-MM-DD.
// Accepts: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY, DD.MM.YYYY, etc.
function parseManualDate(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2024 && y <= 2027) {
      return `${y}-${pad(m)}-${pad(d)}`;
    }
    return null;
  }
  const parts = s.split(/[\/\-.]/);
  if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  let [d, m, y] = parts.map(Number); // assume DD/MM/YYYY (Indian)
  if (y < 100) y = y < 50 ? 2000 + y : 1900 + y;
  if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2024 && y <= 2027) {
    return `${y}-${pad(m)}-${pad(d)}`;
  }
  return null;
}

// Free-text date input that doesn't auto-confirm on partial year typing.
function ManualDateInput({ value, onCommit }) {
  const [draft, setDraft] = useState(value || '');
  const [error, setError] = useState(false);
  useEffect(() => { setDraft(value || ''); }, [value]);

  const commit = () => {
    const t = draft.trim();
    if (!t) { onCommit(null); setError(false); return; }
    const parsed = parseManualDate(t);
    if (parsed) {
      onCommit(parsed);
      setDraft(parsed);
      setError(false);
    } else {
      setError(true);
    }
  };

  return (
    <div className="space-y-1">
      <input
        type="text"
        value={draft}
        placeholder="DD/MM/YYYY or YYYY-MM-DD"
        onChange={(e) => { setDraft(e.target.value); setError(false); }}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
        className={`input w-full text-body-sm font-mono ${error ? 'border-danger-fg' : ''}`}
        spellCheck={false}
        autoComplete="off"
      />
      {error && (
        <p className="text-caption text-danger-fg">
          Couldn't parse — try DD/MM/YYYY (e.g. 15/04/2026) or YYYY-MM-DD.
        </p>
      )}
    </div>
  );
}

export default function MappingRow({ column, columnIndex, duplicateIndex, sampleValues, classDays = [3, 4, 6], onChange }) {
  const isPlaceholder = !column.header || /^column\s*\d+$/i.test(column.header);
  const isCustom = column.kind === 'custom';
  const suggestedKind = isCustom && column.label ? classifyText(column.label) : null;
  const needsDate = DATE_REQUIRING_KINDS.has(column.kind) && !column.iso_date;
  const dow = dowOf(column.iso_date);
  const isClassDay = dow != null && classDays.includes(dow);
  const isDateKind = DATE_REQUIRING_KINDS.has(column.kind);
  const colLetter = (() => {
    let n = columnIndex; let s = '';
    do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
    return s;
  })();

  const acceptSuggestion = () => {
    onChange({ ...column, kind: suggestedKind, label: undefined });
  };

  return (
    <div className="grid grid-cols-12 gap-3 items-start py-3 border-b border-border-subtle">
      <div className="col-span-4 pt-2">
        <p className={`text-body font-medium truncate ${isPlaceholder ? 'text-tertiary italic' : 'text-primary'}`}>
          {column.header || `(blank header — column ${colLetter})`}
          {duplicateIndex && (
            <span className="text-caption text-tertiary ml-2">#{duplicateIndex} · col {colLetter}</span>
          )}
        </p>
        {column.iso_date && (
          <>
            <p className={`text-caption inline-flex items-center gap-1 flex-wrap ${
              isDateKind && !isClassDay ? 'text-danger-fg' : 'text-tertiary'
            }`}>
              → {column.iso_date}
              {dow != null && (
                <span className={`pill text-caption ${
                  isDateKind && !isClassDay ? 'text-danger-fg border-danger-fg/40' : ''
                }`}>
                  {DOW_LABELS[dow]}{isDateKind && !isClassDay ? ' · not a class day' : ''}
                </span>
              )}
              {column._dateStatus === 'snapped' && (
                <span className="pill text-caption text-warning-fg border-warning-fg/40">
                  auto-shifted {column._snapDistance > 0 ? '+' : ''}{column._snapDistance}d
                </span>
              )}
            </p>
            {column._dateStatus === 'snapped' && column._snappedFrom && (
              <p className="text-caption text-tertiary">
                originally parsed as <span className="font-mono">{column._snappedFrom}</span> ({DOW_LABELS[dowOf(column._snappedFrom)]}) — auto-shifted to nearest class day
              </p>
            )}
          </>
        )}
        {isDateKind && !column.iso_date && column._dateStatus === 'not-class-day' && (
          <p className="text-caption text-danger-fg">
            none of the parses fall on a class day — set manually
          </p>
        )}
        {column.kind === 'score' && (
          <p className="text-caption text-accent-glow">
            {column.metric || 'score'}{column.max_value ? ` / ${column.max_value}` : ''}
          </p>
        )}
      </div>
      <div className="col-span-4 pt-2 text-caption text-tertiary truncate">
        {sampleValues
          .filter((v) => v !== '' && v != null)
          .slice(0, 3)
          .map((v) => String(v).slice(0, 20))
          .join(' · ') || <span className="text-tertiary/60">empty</span>}
      </div>
      <div className="col-span-4 space-y-2">
        <select
          className="input w-full"
          value={column.kind}
          onChange={(e) => {
            const next = e.target.value;
            onChange({
              ...column,
              kind: next,
              label: next === 'custom' ? (column.label || '') : undefined,
            });
          }}
        >
          {KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {isCustom && (
          <div className="space-y-1">
            <input
              type="text"
              autoFocus
              placeholder="Describe this column (e.g. 'phone number', 'roll number')"
              className="input w-full text-body-sm"
              value={column.label || ''}
              onChange={(e) => onChange({ ...column, label: e.target.value })}
            />
            {suggestedKind ? (
              <button
                type="button"
                onClick={acceptSuggestion}
                className="text-caption text-accent-glow hover:underline inline-flex items-center gap-1"
              >
                Looks like {KIND_LABEL[suggestedKind]} — apply?
              </button>
            ) : column.label ? (
              <p className="text-caption text-tertiary">
                No matching schema field; this column will be excluded from import (your label is kept in the import log).
              </p>
            ) : null}
          </div>
        )}

        {needsDate && (
          <div className="space-y-2 p-2 rounded-lg border border-warning-fg/40 bg-warning-fg/5">
            {column._dateStatus === 'not-class-day' && column._dateCandidates?.length > 0 ? (
              <>
                <p className="text-caption text-warning-fg">
                  Parsed but not on a class day. Pick the right date below.
                </p>
                <div className="space-y-1">
                  {column._dateCandidates.map((iso) => {
                    const cdow = dowOf(iso);
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => onChange({ ...column, iso_date: iso })}
                        className="w-full text-left px-2 py-1 rounded border border-border-subtle bg-surface hover:bg-surface-raised text-caption text-secondary inline-flex items-center justify-between"
                      >
                        <span className="font-mono">{iso}</span>
                        <span className="pill text-caption text-danger-fg border-danger-fg/40">
                          {cdow != null ? DOW_LABELS[cdow] : '?'} · not a class day
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-caption text-tertiary">Or type the actual date:</p>
              </>
            ) : (
              <p className="text-caption text-warning-fg">
                This {column.kind === 'date' ? 'date column' : column.kind === 'score' ? 'score column' : 'attendance column'} has no date — set one:
              </p>
            )}
            <ManualDateInput
              value={column.iso_date}
              onCommit={(iso) => onChange({ ...column, iso_date: iso })}
            />
            {column.header && /^day\s*\d+$/i.test(column.header) && (
              <p className="text-caption text-tertiary">
                Header looks like a session ordinal ("{column.header}") — pick the actual class date.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
