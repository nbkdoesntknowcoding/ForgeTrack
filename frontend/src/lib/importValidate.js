import { parseDateBy, parseAttendance } from './importDates';

const USN_RE = /^[0-9A-Z]{5,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_DATE = '2025-08-04';

export function normalizeUsn(raw) {
  return String(raw ?? '').trim().toUpperCase();
}

// Deterministic synthetic USN from email — used when the spreadsheet row has
// a name + email but no USN. Re-imports stay idempotent because the same email
// always produces the same synthetic USN.
function syntheticUsnFromEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  // FNV-1a 32-bit
  let h = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    h ^= normalized.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return `NOUSN${h.toString(16).toUpperCase().padStart(8, '0')}`;
}

export function deriveBranch(usn) {
  const u = normalizeUsn(usn);
  if (u.length >= 7) {
    const code = u.slice(5, 7);
    if (/^[A-Z]{2}$/.test(code)) return code;
  }
  return null;
}

// Builds typed views of the dataset using the confirmed mapping.
// Position-based (column index) — handles duplicate headers correctly.
//
// Returns:
//   {
//     students:   [{usn, name, email, branch_code, admission_number, batch, _row, _issues}],
//     sessions:   [{iso_date, header, topic}],
//     attendance: [{usn, iso_date, present}],
//     scores:     [{usn, iso_date, metric, value, max_value}],
//     globalIssues, summary: {errors, warnings, infos}
//   }
export function validateDataset({ headers, rows, mapping }) {
  const cols = mapping.columns;
  const findIdx = (kind) => cols.findIndex((c) => c.kind === kind);

  const nameIdx = findIdx('student_name');
  const usnIdx  = findIdx('usn');
  const emailIdx = findIdx('email');
  const branchIdx = findIdx('branch_code');
  const admIdx = findIdx('admission_number');
  const batchIdx = findIdx('batch');

  // ALL date columns (could be many for a pivoted attendance file).
  const dateColIndices = cols.map((c, i) => (c.kind === 'date' ? i : -1)).filter((i) => i >= 0);
  // ALL attendance_value columns (long layout, or repeated like in Bootcamp Data).
  const attendanceColIndices = cols.map((c, i) => (c.kind === 'attendance_value' ? i : -1)).filter((i) => i >= 0);
  // ALL score columns.
  const scoreColIndices = cols.map((c, i) => (c.kind === 'score' ? i : -1)).filter((i) => i >= 0);

  const issues = [];
  if (nameIdx < 0) issues.push({ level: 'error', text: 'No column mapped as student_name' });
  if (usnIdx < 0)  issues.push({ level: 'error', text: 'No column mapped as usn' });

  const students = [];
  const studentByUsn = new Map();
  const attendance = [];
  const scores = [];

  rows.forEach((row, rowIdx) => {
    const cell = (i) => (i >= 0 ? row[i] : '');
    const rawUsn = cell(usnIdx);
    const rawName = cell(nameIdx);

    let usn = normalizeUsn(rawUsn);
    const name = String(rawName ?? '').trim();
    const email = emailIdx >= 0 ? String(cell(emailIdx) ?? '').trim() || null : null;

    const rowIssues = [];
    if (!name) rowIssues.push({ level: 'error', text: 'Missing name' });

    let synthetic = false;
    if (!usn) {
      // Fall back to a synthetic USN derived from email.
      const synth = email ? syntheticUsnFromEmail(email) : null;
      if (synth) {
        usn = synth;
        synthetic = true;
        rowIssues.push({
          level: 'warning',
          text: `No USN — assigned synthetic ${usn} from email. Update the spreadsheet with the real USN later.`,
        });
      } else {
        rowIssues.push({ level: 'error', text: 'Missing USN and email — cannot identify student.' });
      }
    } else if (!USN_RE.test(usn)) {
      rowIssues.push({ level: 'error', text: `Invalid USN: ${usn}` });
    }
    if (email && !EMAIL_RE.test(email)) {
      rowIssues.push({ level: 'warning', text: `Email looks malformed: ${email}` });
    }

    let branch = branchIdx >= 0
      ? String(cell(branchIdx) ?? '').trim().toUpperCase() || null
      : (usn ? deriveBranch(usn) : null);
    if (!branch) {
      branch = 'UNKNOWN';
      rowIssues.push({
        level: 'warning',
        text: 'No branch — defaulted to UNKNOWN. Update later.',
      });
    }

    const admission = admIdx >= 0 ? String(cell(admIdx) ?? '').trim() || null : null;
    const batch = batchIdx >= 0 ? String(cell(batchIdx) ?? '').trim() || null : null;

    const studentRow = {
      usn,
      name,
      email,
      branch_code: branch,
      admission_number: admission,
      batch,
      _row: rowIdx + 2, // human row number (1=header)
      _issues: rowIssues,
    };

    if (usn && !studentByUsn.has(usn)) {
      studentByUsn.set(usn, studentRow);
      students.push(studentRow);
    } else if (usn) {
      const existing = students.find((s) => s.usn === usn);
      if (existing) {
        existing._issues.push({
          level: 'warning',
          text: `Duplicate row for ${usn} at row ${rowIdx + 2}; merged.`,
        });
      }
    }

    if (!usn) return;

    // Pivoted: each `date` column has an iso_date; attendance value lives in this row at that column.
    dateColIndices.forEach((i) => {
      const dc = cols[i];
      const iso = dc.iso_date || parseDateBy(mapping.date_format, dc.header);
      if (!iso) {
        rowIssues.push({ level: 'error', text: `Date column "${dc.header}" couldn't be parsed.` });
        return;
      }
      if (iso < MIN_DATE) {
        rowIssues.push({ level: 'info', text: `Date ${iso} is before program start (${MIN_DATE}); will still import.` });
      }
      const present = parseAttendance(mapping.attendance_convention, cell(i));
      if (present === null) return; // empty → no record
      attendance.push({ usn, iso_date: iso, present });
    });

    // Repeating "Attendance" columns (like Bootcamp Data). Each was paired with the
    // nearest date column to its left in importMap → c.iso_date is set.
    attendanceColIndices.forEach((i) => {
      const c = cols[i];
      if (!c.iso_date) {
        rowIssues.push({ level: 'error', text: `Attendance column "${c.header || `col ${i + 1}`}" has no associated session date.` });
        return;
      }
      const present = parseAttendance(mapping.attendance_convention, cell(i));
      if (present === null) return;
      attendance.push({ usn, iso_date: c.iso_date, present });
    });

    // Score columns: paired with nearest date col to the left.
    scoreColIndices.forEach((i) => {
      const c = cols[i];
      if (!c.iso_date) {
        rowIssues.push({ level: 'error', text: `Score column "${c.header}" has no associated session date.` });
        return;
      }
      const raw = cell(i);
      if (raw === '' || raw == null) return;
      const value = Number(String(raw).replace(/[^\d.\-]/g, ''));
      if (Number.isNaN(value)) {
        rowIssues.push({ level: 'warning', text: `Non-numeric score "${raw}" in column "${c.header}" skipped.` });
        return;
      }
      scores.push({
        usn,
        iso_date: c.iso_date,
        metric: c.metric || 'score',
        value,
        max_value: c.max_value ?? null,
      });
    });
  });

  // Build session list from all dates referenced (attendance + scores).
  const sessionDates = Array.from(new Set([
    ...attendance.map((a) => a.iso_date),
    ...scores.map((s) => s.iso_date),
  ])).sort();
  const sessions = sessionDates.map((d) => ({
    iso_date: d,
    header: cols.find((c) => c.iso_date === d)?.header || d,
    topic: `Imported – ${d}`,
  }));

  let errorCount = issues.filter((i) => i.level === 'error').length;
  let warningCount = issues.filter((i) => i.level === 'warning').length;
  let infoCount = 0;
  students.forEach((s) => {
    s._issues.forEach((i) => {
      if (i.level === 'error') errorCount += 1;
      else if (i.level === 'warning') warningCount += 1;
      else infoCount += 1;
    });
  });

  return {
    students,
    sessions,
    attendance,
    scores,
    globalIssues: issues,
    summary: { errors: errorCount, warnings: warningCount, infos: infoCount },
  };
}
