import { supabase } from './supabase';

const BATCH_STUDENTS = 100;
const BATCH_ATTENDANCE = 200;
const BATCH_SCORES = 200;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Runs the full write pipeline.
//   payload: { students[], sessions[], attendance[], scores[], filename, total_rows, mapping, uploaded_by }
//   onProgress: ({step, message, current, total}) callback
// Returns { import_id, imported_students, imported_attendance, imported_scores, status, warnings }
export async function runImport(payload, onProgress = () => {}) {
  const {
    students, sessions, attendance, scores = [],
    filename, total_rows, mapping, uploaded_by,
  } = payload;

  // 1. Insert import_log row.
  onProgress({ step: 'log', message: 'Logging import…', current: 0, total: 5 });
  const { data: logRow, error: logErr } = await supabase
    .from('import_log').insert({
      filename,
      uploaded_by,
      total_rows,
      imported_rows: 0,
      skipped_rows: 0,
      column_mapping: JSON.stringify(mapping),
      status: 'in_progress',
    }).select().single();
  if (logErr) throw logErr;
  const importId = logRow.id;

  let warnings = [];
  let imported_students = 0;
  let imported_attendance = 0;
  let imported_scores = 0;
  let status = 'completed';

  try {
    // 2. Auto-create sessions (upsert by date). Reject dates outside the valid range
    //    so we never insert garbage like year 0002 or far-future Date-cell artifacts.
    onProgress({ step: 'sessions', message: `Creating ${sessions.length} sessions…`, current: 1, total: 6 });
    const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;
    const MIN = '2024-01-01';
    const MAX = '2027-12-31';
    if (sessions.length > 0) {
      const sessionRows = sessions
        .filter((s) => {
          if (!VALID_DATE.test(s.iso_date) || s.iso_date < MIN || s.iso_date > MAX) {
            warnings.push(`Skipped session: invalid date ${s.iso_date}`);
            return false;
          }
          return true;
        })
        .map((s) => ({
          date: s.iso_date,
          topic: s.topic || `Imported – ${s.iso_date}`,
          duration_hours: 2.0,
          session_type: 'offline',
          month_number: new Date(s.iso_date).getMonth() + 1,
        }));
      if (sessionRows.length > 0) {
        const { error: sErr } = await supabase
          .from('sessions').upsert(sessionRows, { onConflict: 'date', ignoreDuplicates: false });
        if (sErr) throw sErr;
      }
    }

    // 3. Upsert students by USN.
    onProgress({ step: 'students', message: `Upserting ${students.length} students…`, current: 2, total: 5 });
    const studentRows = students
      .filter((s) => s.usn && s.name && !(s._issues?.some((i) => i.level === 'error')))
      .map((s) => ({
        usn: s.usn,
        name: s.name,
        email: s.email,
        branch_code: s.branch_code || 'UNKNOWN',
        admission_number: s.admission_number,
        batch: s.batch || '2024-2028',
        is_active: true,
      }));
    for (const batch of chunk(studentRows, BATCH_STUDENTS)) {
      const { error } = await supabase
        .from('students').upsert(batch, { onConflict: 'usn' });
      if (error) throw error;
      imported_students += batch.length;
    }

    // 4. Resolve student_id and session_id once, used by attendance + scores.
    onProgress({ step: 'attendance', message: 'Resolving IDs…', current: 3, total: 6 });
    let sIdByUsn = new Map();
    let sessIdByDate = new Map();
    if (attendance.length + scores.length > 0) {
      const usns = Array.from(new Set([
        ...attendance.map((a) => a.usn),
        ...scores.map((s) => s.usn),
      ]));
      const dates = Array.from(new Set([
        ...attendance.map((a) => a.iso_date),
        ...scores.map((s) => s.iso_date),
      ]));

      const [{ data: studentRowsDb }, { data: sessionRowsDb }] = await Promise.all([
        usns.length ? supabase.from('students').select('id, usn').in('usn', usns) : Promise.resolve({ data: [] }),
        dates.length ? supabase.from('sessions').select('id, date').in('date', dates) : Promise.resolve({ data: [] }),
      ]);
      sIdByUsn = new Map((studentRowsDb || []).map((r) => [r.usn, r.id]));
      sessIdByDate = new Map((sessionRowsDb || []).map((r) => [r.date, r.id]));
    }

    // 4a. Upsert attendance.
    if (attendance.length > 0) {
      const attRows = [];
      for (const a of attendance) {
        const sid = sIdByUsn.get(a.usn);
        const ssid = sessIdByDate.get(a.iso_date);
        if (!sid || !ssid) {
          warnings.push(`Skipped attendance: ${a.usn} on ${a.iso_date} (missing student or session row).`);
          continue;
        }
        attRows.push({
          student_id: sid,
          session_id: ssid,
          present: a.present,
          marked_by: 'csv_import',
          import_id: importId,
        });
      }
      onProgress({ step: 'attendance', message: `Writing ${attRows.length} attendance rows…`, current: 4, total: 6 });
      for (const batch of chunk(attRows, BATCH_ATTENDANCE)) {
        const { error } = await supabase
          .from('attendance').upsert(batch, { onConflict: 'student_id,session_id' });
        if (error) throw error;
        imported_attendance += batch.length;
      }
    }

    // 4b. Upsert session_scores.
    if (scores.length > 0) {
      const scoreRows = [];
      for (const s of scores) {
        const sid = sIdByUsn.get(s.usn);
        const ssid = sessIdByDate.get(s.iso_date);
        if (!sid || !ssid) {
          warnings.push(`Skipped score: ${s.usn} on ${s.iso_date} (missing student or session row).`);
          continue;
        }
        scoreRows.push({
          student_id: sid,
          session_id: ssid,
          metric: s.metric,
          value: s.value,
          max_value: s.max_value,
          marked_by: 'csv_import',
          import_id: importId,
        });
      }
      onProgress({ step: 'scores', message: `Writing ${scoreRows.length} score rows…`, current: 5, total: 6 });
      for (const batch of chunk(scoreRows, BATCH_SCORES)) {
        const { error } = await supabase
          .from('session_scores').upsert(batch, { onConflict: 'student_id,session_id,metric' });
        if (error) throw error;
        imported_scores += batch.length;
      }
    }
  } catch (err) {
    status = 'partial';
    warnings.push(`Pipeline error: ${err.message || String(err)}`);
  }

  // 5. Finalize import_log.
  onProgress({ step: 'finalize', message: 'Finalizing…', current: 6, total: 6 });
  const skipped = (total_rows || 0) - imported_students;
  await supabase.from('import_log').update({
    imported_rows: imported_students,
    skipped_rows: Math.max(0, skipped),
    warnings: warnings.length ? JSON.stringify(warnings) : null,
    status,
  }).eq('id', importId);

  return { import_id: importId, imported_students, imported_attendance, imported_scores, status, warnings };
}

// Danger-zone wipe used by ResetDemoDataPanel.
export async function resetData({ students, sessions, importLog, materials }) {
  const summary = {};
  // Students cascade attendance via FK ON DELETE CASCADE.
  if (students) {
    const { count } = await supabase.from('students').delete({ count: 'exact' }).gt('id', 0);
    summary.students = count ?? 0;
  }
  if (sessions) {
    const { count } = await supabase.from('sessions').delete({ count: 'exact' }).gt('id', 0);
    summary.sessions = count ?? 0;
  }
  if (importLog) {
    const { count } = await supabase.from('import_log').delete({ count: 'exact' }).gt('id', 0);
    summary.import_log = count ?? 0;
  }
  if (materials) {
    const { count } = await supabase.from('materials').delete({ count: 'exact' }).gt('id', 0);
    summary.materials = count ?? 0;
  }
  return summary;
}
