import React, { useEffect, useState } from 'react';
import { Sparkles, Wand2, CheckCircle2, Loader2, CalendarDays } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { deterministicMap, reresolveDates, CLASS_DAY_DEFAULT } from '../../lib/importMap';
import MappingRow from './MappingRow';

const WEEKDAYS = [
  { id: 0, label: 'Sun' },
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
];

const CONVENTION_OPTIONS = [
  { value: 'TRUE_FALSE',     label: 'TRUE / FALSE' },
  { value: 'PA',             label: 'P / A' },
  { value: 'PRESENT_ABSENT', label: 'Present / Absent' },
  { value: '10',             label: '1 / 0' },
  { value: 'YN',             label: 'Y / N' },
  { value: 'UNKNOWN',        label: 'Other / unknown' },
];

const FORMAT_OPTIONS = ['DD/M/YY', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'UNKNOWN'];

function DateStatusBanner({ mapping }) {
  const KINDS = new Set(['date', 'attendance_value', 'score']);
  const dateCols = mapping.columns.filter((c) => KINDS.has(c.kind));
  if (dateCols.length === 0) return null;
  let resolved = 0, ambiguous = 0, badDay = 0, missing = 0;
  dateCols.forEach((c) => {
    if (!c.iso_date) {
      if (c._dateStatus === 'not-class-day') badDay += 1;
      else missing += 1;
    } else if (c._dateStatus === 'inferred' || c._dateStatus === 'best-guess') {
      ambiguous += 1; resolved += 1;
    } else {
      resolved += 1;
    }
  });
  return (
    <div className="text-caption text-secondary flex flex-wrap gap-3">
      <span className="text-success-fg">{resolved} resolved</span>
      {ambiguous > 0 && <span className="text-info-fg">({ambiguous} via inference)</span>}
      {badDay > 0 && <span className="text-danger-fg">{badDay} not on a class day</span>}
      {missing > 0 && <span className="text-warning-fg">{missing} need a manual date</span>}
    </div>
  );
}

// If the column at `idx` shares its header with earlier columns, returns the
// 1-based occurrence number (2 = second column with this header). Otherwise null.
function duplicateOccurrence(columns, idx) {
  const header = columns[idx]?.header || '';
  if (!header) return null;
  let count = 0;
  let myOccurrence = 0;
  columns.forEach((c, i) => {
    if (c.header === header) {
      count += 1;
      if (i === idx) myOccurrence = count;
    }
  });
  return count > 1 ? myOccurrence : null;
}

export default function Step2Mapping({ headers, rawHeaders, rows, mapping, onChange, onBack, onNext }) {
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiUsed, setAiUsed] = useState(false);
  const classDays = mapping?.classDays || CLASS_DAY_DEFAULT;

  // Run the deterministic mapper once on mount if no mapping yet.
  useEffect(() => {
    if (mapping) return;
    const det = deterministicMap({
      headers,
      rawHeaders,
      rows,
      classDays: CLASS_DAY_DEFAULT,
    });
    onChange(det);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setClassDays = (next) => {
    if (!mapping) return;
    const sorted = Array.from(new Set(next)).sort();
    const updated = reresolveDates({ ...mapping, classDays: sorted }, rawHeaders, sorted);
    onChange(updated);
  };

  const toggleClassDay = (id) => {
    const has = classDays.includes(id);
    const next = has ? classDays.filter((d) => d !== id) : [...classDays, id];
    setClassDays(next);
  };

  const refineWithAI = async () => {
    setAiBusy(true);
    setAiError(null);
    try {
      const { data, error } = await supabase.functions.invoke('parse-import', {
        body: { headers, sample_rows: rows.slice(0, 8) },
      });
      if (error) {
        let detail = error.message;
        try {
          const body = await error.context?.json?.();
          if (body?.error) detail = body.error;
        } catch { /* not JSON */ }
        throw new Error(detail);
      }
      if (data?.error) throw new Error(data.error);

      // Merge AI suggestions into the current mapping. Only override columns that
      // the user hasn't already touched (kind === 'ignore' and AI has a stronger guess).
      const aiByHeader = new Map(data.columns.map((c) => [c.header, c]));
      const merged = {
        ...mapping,
        is_pivoted: data.is_pivoted ?? mapping.is_pivoted,
        date_format: mapping.date_format === 'UNKNOWN' ? data.date_format : mapping.date_format,
        attendance_convention:
          mapping.attendance_convention === 'UNKNOWN' ? data.attendance_convention : mapping.attendance_convention,
        columns: mapping.columns.map((c) => {
          const ai = aiByHeader.get(c.header);
          if (!ai) return c;
          if (c.kind !== 'ignore') return c; // keep heuristic / user choice
          return { ...c, kind: ai.kind, iso_date: ai.iso_date ?? c.iso_date };
        }),
      };
      onChange(merged);
      setAiUsed(true);
    } catch (e) {
      setAiError(e.message || String(e));
    } finally {
      setAiBusy(false);
    }
  };

  if (!mapping) {
    return (
      <div className="text-center py-12 text-secondary">
        <Loader2 className="animate-spin mx-auto mb-3 text-accent-glow" size={28} />
        <p className="text-body">Analyzing columns…</p>
      </div>
    );
  }

  const updateColumn = (idx, col) => {
    onChange({ ...mapping, columns: mapping.columns.map((c, i) => (i === idx ? col : c)) });
  };

  const sampleByIndex = (i) => rows.slice(0, 8).map((r) => r[i]);

  const requiredOk =
    mapping.columns.some((c) => c.kind === 'student_name') &&
    mapping.columns.some((c) => c.kind === 'usn');

  const dateRequired = ['date', 'attendance_value', 'score'];
  const isClassDay = (iso) => {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    const d = new Date(iso + 'T00:00:00');
    return classDays.includes(d.getDay());
  };
  const missingDateCount = mapping.columns.filter(
    (c) => dateRequired.includes(c.kind) && !c.iso_date,
  ).length;
  const badDayCount = mapping.columns.filter(
    (c) => c.kind === 'date' && c.iso_date && !isClassDay(c.iso_date),
  ).length;

  const unmappedCount = mapping._unmapped?.length ?? 0;
  const mappedCount = mapping.columns.filter((c) => c.kind !== 'ignore').length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-h2 text-primary">Column mapping</h2>
        <p className="text-body-sm text-secondary mt-1">
          {mappedCount} of {mapping.columns.length} columns mapped from header names.
          {unmappedCount > 0 && ` ${unmappedCount} ambiguous — refine with AI or set them manually.`}
        </p>
      </div>

      <div className="card rounded-2xl p-4 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2 text-body-sm text-secondary">
          {aiUsed ? (
            <><CheckCircle2 size={14} className="text-success-fg" /> AI refinement applied</>
          ) : (
            <><Sparkles size={14} className="text-accent-glow" /> Library-based mapping (no AI yet)</>
          )}
        </div>
        <button
          onClick={refineWithAI}
          disabled={aiBusy}
          className="btn-secondary inline-flex items-center gap-2 text-body-sm"
        >
          {aiBusy
            ? <><Loader2 size={14} className="animate-spin" /> Asking Gemini…</>
            : <><Wand2 size={14} /> Refine with AI</>
          }
        </button>
      </div>


      {aiError && (
        <div className="card p-3 rounded-xl border border-warning-fg/40 bg-warning-fg/5 text-body-sm text-secondary">
          AI refine failed: {aiError}. Library-based mapping is still active — set anything else manually.
        </div>
      )}

      <div className="card rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-accent-glow" />
          <label className="text-label text-tertiary">CLASS DAYS — every imported date must fall on one</label>
        </div>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => {
            const active = classDays.includes(d.id);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleClassDay(d.id)}
                className={`px-3 h-9 rounded-lg text-body-sm border transition-colors ${
                  active
                    ? 'bg-accent-glow/10 border-accent-glow text-primary'
                    : 'border-border-subtle text-secondary hover:bg-surface'
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
        <DateStatusBanner mapping={mapping} />
      </div>

      <div className="card rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-label text-tertiary block mb-1">LAYOUT</label>
          <select
            className="input w-full"
            value={mapping.is_pivoted ? 'pivoted' : 'long'}
            onChange={(e) => onChange({ ...mapping, is_pivoted: e.target.value === 'pivoted' })}
          >
            <option value="pivoted">Pivoted (date columns)</option>
            <option value="long">Long (one row per attendance)</option>
          </select>
        </div>
        <div>
          <label className="text-label text-tertiary block mb-1">DATE FORMAT</label>
          <select
            className="input w-full"
            value={mapping.date_format || 'UNKNOWN'}
            onChange={(e) => onChange({ ...mapping, date_format: e.target.value })}
          >
            {FORMAT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="text-label text-tertiary block mb-1">ATTENDANCE CONVENTION</label>
          <select
            className="input w-full"
            value={mapping.attendance_convention || 'UNKNOWN'}
            onChange={(e) => onChange({ ...mapping, attendance_convention: e.target.value })}
          >
            {CONVENTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="card rounded-2xl p-4">
        <div className="grid grid-cols-12 gap-3 text-label text-tertiary pb-2 border-b border-border-subtle">
          <div className="col-span-4">SOURCE COLUMN</div>
          <div className="col-span-4">SAMPLE VALUES</div>
          <div className="col-span-4">MAP TO</div>
        </div>
        {mapping.columns.map((c, i) => (
          <MappingRow
            key={i}
            column={c}
            columnIndex={i}
            duplicateIndex={duplicateOccurrence(mapping.columns, i)}
            sampleValues={sampleByIndex(i)}
            classDays={classDays}
            onChange={(next) => updateColumn(i, next)}
          />
        ))}
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="btn-secondary">Back</button>
        <button
          onClick={onNext}
          className="btn-primary"
          disabled={!requiredOk || missingDateCount > 0 || badDayCount > 0}
        >
          {!requiredOk
            ? 'Map student_name and usn first'
            : missingDateCount > 0
            ? `Set dates for ${missingDateCount} column${missingDateCount === 1 ? '' : 's'}`
            : badDayCount > 0
            ? `Fix ${badDayCount} date${badDayCount === 1 ? '' : 's'} not on a class day`
            : 'Validate'}
        </button>
      </div>
    </div>
  );
}
