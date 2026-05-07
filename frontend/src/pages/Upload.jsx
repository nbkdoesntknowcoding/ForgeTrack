import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { loadSheet } from '../lib/importParse';
import { validateDataset } from '../lib/importValidate';
import { runImport } from '../lib/importWriter';

import Step1Upload from '../components/import/Step1Upload';
import Step1aSheetPicker from '../components/import/Step1aSheetPicker';
import Step1bHeaderRow from '../components/import/Step1bHeaderRow';
import Step2Mapping from '../components/import/Step2Mapping';
import Step4Preview from '../components/import/Step4Preview';
import Step5Done from '../components/import/Step5Done';
import ResetDemoDataPanel from '../components/import/ResetDemoDataPanel';

const STEPS = ['Upload', 'Sheet', 'Header row', 'Mapping', 'Preview', 'Done'];

export default function Upload() {
  const { userData } = useAuth();
  const [step, setStep] = useState(0);

  // Step 0: file picked → peek
  const [file, setFile] = useState(null);
  const [peek, setPeek] = useState(null);

  // Step 1a: sheet picked
  const [sheetName, setSheetName] = useState(null);

  // Step 1b: matrix loaded → user picks header row
  const [matrix, setMatrix] = useState(null);
  const [rawMatrix, setRawMatrix] = useState(null);
  const [suggestedHeaderRow, setSuggestedHeaderRow] = useState(0);

  // Step 2: shape + mapping
  const [headers, setHeaders] = useState([]);
  const [rawHeaders, setRawHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState(null);

  // Step 3 (preview): validation result
  const [validation, setValidation] = useState(null);
  const [existingByUsn, setExistingByUsn] = useState(new Map());
  const [existingSessions, setExistingSessions] = useState(new Set());
  const [topicsByDate, setTopicsByDate] = useState(new Map());
  const [excludedUsns, setExcludedUsns] = useState(new Set());

  // Final: import in flight
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);

  // When a sheet is picked, load it into a matrix.
  useEffect(() => {
    if (step !== 2 || !peek || !sheetName) return;
    try {
      const { matrix: m, rawMatrix: rm, suggestedHeaderRow: s } = loadSheet(peek, sheetName);
      setMatrix(m);
      setRawMatrix(rm);
      setSuggestedHeaderRow(s);
    } catch (e) {
      alert('Failed to load sheet: ' + e.message);
      setStep(1);
    }
  }, [step, peek, sheetName]);

  // Run validation + DB lookups when entering preview.
  useEffect(() => {
    if (step !== 4 || !mapping) return;
    let cancelled = false;
    (async () => {
      const v = validateDataset({ headers, rows, mapping });
      if (cancelled) return;
      setValidation(v);

      const usns = v.students.map((s) => s.usn).filter(Boolean);
      const dates = v.sessions.map((s) => s.iso_date);
      const [{ data: dbStudents }, { data: dbSessions }] = await Promise.all([
        usns.length
          ? supabase.from('students').select('usn, name, email, branch_code, admission_number, batch').in('usn', usns)
          : Promise.resolve({ data: [] }),
        dates.length
          ? supabase.from('sessions').select('date').in('date', dates)
          : Promise.resolve({ data: [] }),
      ]);
      if (cancelled) return;
      setExistingByUsn(new Map((dbStudents || []).map((r) => [r.usn, r])));
      setExistingSessions(new Set((dbSessions || []).map((r) => r.date)));
      const initialTopics = new Map();
      v.sessions.forEach((s) => initialTopics.set(s.iso_date, s.topic));
      setTopicsByDate(initialTopics);
    })();
    return () => { cancelled = true; };
  }, [step, mapping, headers, rows]);

  const toggleExclude = (usn) => {
    setExcludedUsns((prev) => {
      const next = new Set(prev);
      if (next.has(usn)) next.delete(usn); else next.add(usn);
      return next;
    });
  };

  const reset = () => {
    setStep(0);
    setFile(null); setPeek(null); setSheetName(null);
    setMatrix(null); setRawMatrix(null); setSuggestedHeaderRow(0);
    setHeaders([]); setRawHeaders([]); setRows([]);
    setMapping(null); setValidation(null);
    setExistingByUsn(new Map()); setExistingSessions(new Set());
    setTopicsByDate(new Map()); setExcludedUsns(new Set());
    setResult(null); setProgress(null);
  };

  const confirmImport = async () => {
    if (!validation) return;
    setImporting(true);
    setProgress({ message: 'Starting…', current: 0, total: 6 });

    const filteredStudents = validation.students.filter((s) => s.usn && !excludedUsns.has(s.usn));
    const filteredAttendance = validation.attendance.filter((a) => !excludedUsns.has(a.usn));
    const filteredScores = validation.scores.filter((s) => !excludedUsns.has(s.usn));
    const sessionsWithTopics = validation.sessions.map((s) => ({
      ...s,
      topic: topicsByDate.get(s.iso_date) || s.topic,
    }));

    try {
      const r = await runImport(
        {
          students: filteredStudents,
          sessions: sessionsWithTopics,
          attendance: filteredAttendance,
          scores: filteredScores,
          filename: file?.name || 'unknown',
          total_rows: rows.length,
          mapping,
          uploaded_by: userData?.display_name || userData?.email || 'mentor',
        },
        (p) => setProgress(p),
      );
      setResult(r);
      setStep(5);
    } catch (err) {
      alert('Import failed: ' + (err.message || String(err)));
    } finally {
      setImporting(false);
    }
  };

  const stepperLabel = useMemo(() => STEPS[step] || '—', [step]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display-lg text-primary tracking-tight">Upload</h1>
        <p className="text-body-sm text-secondary mt-1">
          Bulk-import students, attendance, and scores from a spreadsheet. Libraries handle parsing; AI only refines ambiguous columns.
        </p>
      </div>

      <Stepper step={step} />

      {step === 0 && (
        <Step1Upload
          onPicked={({ file, peek }) => {
            setFile(file);
            setPeek(peek);
            // If only one sheet, skip the picker.
            if (peek.sheets.length === 1) {
              setSheetName(peek.sheets[0].name);
              setStep(2);
            } else {
              setStep(1);
            }
          }}
        />
      )}

      {step === 1 && peek && (
        <Step1aSheetPicker
          peek={peek}
          onBack={() => setStep(0)}
          onPick={(name) => { setSheetName(name); setStep(2); }}
        />
      )}

      {step === 2 && matrix && (
        <Step1bHeaderRow
          matrix={matrix}
          rawMatrix={rawMatrix}
          suggestedHeaderRow={suggestedHeaderRow}
          onBack={() => setStep(peek?.sheets?.length > 1 ? 1 : 0)}
          onConfirm={({ headers, rawHeaders, rows }) => {
            setHeaders(headers);
            setRawHeaders(rawHeaders);
            setRows(rows);
            setMapping(null);
            setStep(3);
          }}
        />
      )}

      {step === 3 && (
        <Step2Mapping
          headers={headers}
          rawHeaders={rawHeaders}
          rows={rows}
          mapping={mapping}
          onChange={setMapping}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}

      {step === 4 && (
        validation ? (
          <Step4Preview
            validation={validation}
            existingByUsn={existingByUsn}
            existingSessions={existingSessions}
            topicsByDate={topicsByDate}
            setTopicsByDate={setTopicsByDate}
            excludedUsns={excludedUsns}
            toggleExclude={toggleExclude}
            onBack={() => setStep(3)}
            onConfirm={confirmImport}
            importing={importing}
          />
        ) : (
          <p className="text-secondary">Validating…</p>
        )
      )}

      {step === 5 && result && <Step5Done result={result} onAnother={reset} />}

      {importing && progress && (
        <div className="fixed bottom-6 right-6 card bg-surface-raised rounded-2xl p-4 shadow-raised border border-border-default min-w-[280px]">
          <p className="text-body-sm text-primary">{progress.message}</p>
          <div className="h-1.5 bg-surface-inset rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-accent-glow transition-all"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {step !== 5 && <ResetDemoDataPanel />}

      <p className="text-caption text-tertiary">{stepperLabel}</p>
    </div>
  );
}

function Stepper({ step }) {
  return (
    <div className="flex items-center gap-2 text-caption flex-wrap">
      {STEPS.map((label, i) => (
        <React.Fragment key={label}>
          <div
            className={`px-3 py-1 rounded-full border ${
              i === step
                ? 'bg-accent-glow/10 border-accent-glow text-primary'
                : i < step
                ? 'border-border-subtle text-secondary'
                : 'border-border-subtle text-tertiary'
            }`}
          >
            {i + 1}. {label}
          </div>
          {i < STEPS.length - 1 && <div className="h-px w-6 bg-border-subtle" />}
        </React.Fragment>
      ))}
    </div>
  );
}
