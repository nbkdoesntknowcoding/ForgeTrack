import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';

const STATUS_COLOR = {
  error:   'text-danger-fg',
  warning: 'text-warning-fg',
  info:    'text-secondary',
};

function rowLevel(student) {
  const levels = student._issues.map((i) => i.level);
  if (levels.includes('error')) return 'error';
  if (levels.includes('warning')) return 'warning';
  if (levels.includes('info')) return 'info';
  return 'ok';
}

const ROW_TINT = {
  error:   'bg-danger-fg/5',
  warning: 'bg-warning-fg/5',
  info:    'bg-info-fg/5',
  ok:      '',
};

export default function Step4Preview({
  validation,        // output of validateDataset()
  existingByUsn,     // Map<string, {name,email,branch_code,admission_number,batch}>
  existingSessions,  // Set<iso_date>
  topicsByDate,      // Map<iso_date, string> editable
  setTopicsByDate,
  excludedUsns,      // Set<string>
  toggleExclude,
  onBack, onConfirm, importing,
}) {
  const [studentsCollapsed, setStudentsCollapsed] = useState(false);

  const { students, sessions, attendance, scores = [], summary } = validation;

  const counts = useMemo(() => {
    let neu = 0, upd = 0, unc = 0;
    students.forEach((s) => {
      if (excludedUsns.has(s.usn)) return;
      const ex = existingByUsn.get(s.usn);
      if (!ex) neu += 1;
      else {
        const same = ex.name === s.name && ex.email === s.email
          && ex.branch_code === s.branch_code && ex.admission_number === s.admission_number;
        if (same) unc += 1; else upd += 1;
      }
    });
    return { neu, upd, unc };
  }, [students, existingByUsn, excludedUsns]);

  const newSessions = sessions.filter((s) => !existingSessions.has(s.iso_date));
  const reusedSessions = sessions.filter((s) => existingSessions.has(s.iso_date));

  const attendancePerDate = useMemo(() => {
    const m = new Map();
    attendance.forEach((a) => {
      const c = m.get(a.iso_date) || { present: 0, absent: 0 };
      if (a.present) c.present += 1; else c.absent += 1;
      m.set(a.iso_date, c);
    });
    return m;
  }, [attendance]);

  const errorCount = summary.errors;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-h2 text-primary">Preview</h2>
        <p className="text-body-sm text-secondary mt-1">
          Review what will be written. Uncheck any row to exclude it from the import.
        </p>
      </div>

      <div className="card rounded-2xl p-4 grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
        <SummaryCell label="New" value={counts.neu} tone="success" />
        <SummaryCell label="Update" value={counts.upd} tone="info" />
        <SummaryCell label="Unchanged" value={counts.unc} tone="muted" />
        <SummaryCell label="Sessions (new)" value={newSessions.length} tone="info" />
        <SummaryCell label="Attendance" value={attendance.length} tone="info" />
        <SummaryCell label="Scores" value={scores.length} tone="info" />
      </div>

      {scores.length > 0 && (
        <div className="card rounded-2xl p-4">
          <h3 className="text-h3 text-primary mb-3">Scores ({scores.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {Array.from(scoreMetricSummary(scores)).map(([metric, info]) => (
              <div key={metric} className="card bg-surface-inset p-3 rounded-lg">
                <p className="text-body-sm text-primary capitalize">{metric}</p>
                <p className="text-caption text-tertiary mt-1">
                  {info.cells} cells · {info.dates} sessions
                  {info.max_value ? ` · max ${info.max_value}` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(errorCount > 0 || summary.warnings > 0) && (
        <div className="card rounded-xl p-3 inline-flex items-center gap-3 text-body-sm">
          {errorCount > 0 && <span className="inline-flex items-center gap-1 text-danger-fg"><XCircle size={14} /> {errorCount} errors</span>}
          {summary.warnings > 0 && <span className="inline-flex items-center gap-1 text-warning-fg"><AlertTriangle size={14} /> {summary.warnings} warnings</span>}
          {errorCount === 0 && summary.warnings === 0 && (
            <span className="inline-flex items-center gap-1 text-success-fg"><CheckCircle2 size={14} /> All checks passed</span>
          )}
        </div>
      )}

      {(newSessions.length > 0 || reusedSessions.length > 0) && (
        <div className="card rounded-2xl p-4">
          <h3 className="text-h3 text-primary mb-3">Sessions ({sessions.length})</h3>
          <div className="space-y-2">
            {sessions.map((s) => {
              const exists = existingSessions.has(s.iso_date);
              const counts = attendancePerDate.get(s.iso_date) || { present: 0, absent: 0 };
              return (
                <div key={s.iso_date} className="flex items-center gap-3 py-2 border-b border-border-subtle last:border-0">
                  <span className="text-body-sm text-secondary w-32 shrink-0">
                    {format(new Date(s.iso_date), 'EEE, MMM d, yyyy')}
                  </span>
                  <input
                    type="text"
                    className="input flex-1 h-9 text-body-sm"
                    value={topicsByDate.get(s.iso_date) || s.topic}
                    onChange={(e) => {
                      const next = new Map(topicsByDate);
                      next.set(s.iso_date, e.target.value);
                      setTopicsByDate(next);
                    }}
                    disabled={exists}
                  />
                  <span className={`pill text-caption ${exists ? 'text-tertiary' : 'text-success-fg'}`}>
                    {exists ? 'Exists' : 'Will create'}
                  </span>
                  <span className="text-caption text-secondary w-32 text-right">
                    {counts.present + counts.absent} marks ({counts.present}P / {counts.absent}A)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card rounded-2xl p-4">
        <button
          onClick={() => setStudentsCollapsed((v) => !v)}
          className="flex items-center justify-between w-full text-h3 text-primary mb-3"
        >
          <span>Students ({students.length})</span>
          <span className="text-body-sm text-tertiary">{studentsCollapsed ? 'Show' : 'Hide'}</span>
        </button>

        {!studentsCollapsed && (
          <div className="overflow-x-auto -mx-4">
            <table className="w-full">
              <thead>
                <tr className="text-label text-tertiary border-b border-border-subtle">
                  <th className="p-2 text-left w-8">✓</th>
                  <th className="p-2 text-left">USN</th>
                  <th className="p-2 text-left">NAME</th>
                  <th className="p-2 text-left">BRANCH</th>
                  <th className="p-2 text-left">EMAIL</th>
                  <th className="p-2 text-left">STATUS</th>
                  <th className="p-2 text-left">ISSUES</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const level = rowLevel(s);
                  const ex = existingByUsn.get(s.usn);
                  const action = !ex ? 'New' : (
                    ex.name === s.name && ex.email === s.email
                    && ex.branch_code === s.branch_code && ex.admission_number === s.admission_number
                      ? 'Unchanged' : 'Update'
                  );
                  const excluded = excludedUsns.has(s.usn);
                  return (
                    <tr
                      key={s.usn || s._row}
                      className={`border-b border-border-subtle ${ROW_TINT[level]} ${excluded ? 'opacity-40' : ''}`}
                    >
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={!excluded}
                          onChange={() => toggleExclude(s.usn)}
                          disabled={!s.usn}
                        />
                      </td>
                      <td className="p-2 font-mono text-body-sm text-primary">{s.usn || '—'}</td>
                      <td className="p-2 text-body-sm text-primary">{s.name || '—'}</td>
                      <td className="p-2 text-body-sm text-secondary">{s.branch_code || '—'}</td>
                      <td className="p-2 text-body-sm text-secondary">{s.email || '—'}</td>
                      <td className="p-2 text-body-sm">
                        <span className={`pill text-caption ${
                          action === 'New' ? 'text-success-fg' : action === 'Update' ? 'text-info-fg' : 'text-tertiary'
                        }`}>{action}</span>
                      </td>
                      <td className="p-2 text-caption">
                        {s._issues.length === 0 ? (
                          <span className="text-tertiary">—</span>
                        ) : (
                          s._issues.map((i, idx) => (
                            <div key={idx} className={STATUS_COLOR[i.level]}>{i.text}</div>
                          ))
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="btn-secondary" disabled={importing}>Back</button>
        <button
          onClick={onConfirm}
          disabled={errorCount > 0 || importing}
          className="btn-primary inline-flex items-center gap-2"
        >
          {importing ? <><Loader2 className="animate-spin" size={16} /> Importing…</> : 'Confirm import'}
        </button>
      </div>
    </div>
  );
}

function scoreMetricSummary(scores) {
  const map = new Map();
  scores.forEach((s) => {
    if (!map.has(s.metric)) {
      map.set(s.metric, { cells: 0, dates: new Set(), max_value: s.max_value });
    }
    const info = map.get(s.metric);
    info.cells += 1;
    info.dates.add(s.iso_date);
  });
  // convert Set → count
  for (const [k, v] of map) {
    map.set(k, { cells: v.cells, dates: v.dates.size, max_value: v.max_value });
  }
  return map;
}

function SummaryCell({ label, value, tone }) {
  const toneCls = {
    success: 'text-success-fg',
    info:    'text-accent-glow',
    muted:   'text-tertiary',
  }[tone] || 'text-primary';
  return (
    <div>
      <p className={`text-h2 ${toneCls}`}>{value}</p>
      <p className="text-caption text-tertiary uppercase">{label}</p>
    </div>
  );
}
