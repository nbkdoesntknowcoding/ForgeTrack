// Deterministic-first column mapper.
// Maps obvious columns by header regex + sample-value sniffing without any AI call.
// Returns the same shape parse-import returns, with an `_unmapped` array of headers
// that the caller can optionally send to the AI for refinement.

import * as XLSX from 'xlsx';
import { parseDateBy } from './importDates';

export const CLASS_DAY_DEFAULT = [3, 4, 6]; // Wed, Thu, Sat
export const MIN_DATE = '2024-01-01';
export const MAX_DATE = '2027-12-31';
const SERIAL_DATE_MIN = 25569;
const SERIAL_DATE_MAX = 73000;

function pad(n) { return String(n).padStart(2, '0'); }

function isClassDay(iso, classDays) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  if (iso < MIN_DATE || iso > MAX_DATE) return false;
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return false;
  return classDays.includes(d.getDay());
}

// Generate every plausible ISO date interpretation of a raw xlsx cell value.
// Strict DD/MM convention only — never tries American MM/DD.
//
// Accepted string formats:
//   DD-MM-YY       (e.g. 12-11-25)
//   DD/MM/YY       (e.g. 29/03/26)
//   D/M/YYYY       (e.g. 1/4/2026)
//   DD.MM.YYYY     (and any combination with '/', '-', '.' separators)
//   YYYY-MM-DD     (already ISO, accepted as-is)
//
// For native Date / Excel serial cells, two candidates are returned (swap-first +
// as-is) because Sheets often stores Indian DD/MM input as MM/DD due to locale.
function buildDateCandidates(rawValue) {
  // Native JS Date — try swap (Indian intent) first.
  if (rawValue instanceof Date && !Number.isNaN(rawValue.getTime())) {
    const y = rawValue.getFullYear();
    const m = rawValue.getMonth() + 1;
    const d = rawValue.getDate();
    const out = [];
    if (m !== d && d >= 1 && d <= 12 && m >= 1 && m <= 12) {
      out.push(`${y}-${pad(d)}-${pad(m)}`); // swap (recover DD/MM intent)
      out.push(`${y}-${pad(m)}-${pad(d)}`); // as-is fallback
    } else {
      out.push(`${y}-${pad(m)}-${pad(d)}`);
    }
    return out;
  }

  // Excel serial — same swap logic.
  if (typeof rawValue === 'number') {
    if (rawValue >= SERIAL_DATE_MIN && rawValue <= SERIAL_DATE_MAX) {
      const p = XLSX.SSF.parse_date_code(rawValue);
      if (p) {
        const out = [];
        if (p.m !== p.d && p.d >= 1 && p.d <= 12 && p.m >= 1 && p.m <= 12) {
          out.push(`${p.y}-${pad(p.d)}-${pad(p.m)}`); // swap
          out.push(`${p.y}-${pad(p.m)}-${pad(p.d)}`); // as-is
        } else {
          out.push(`${p.y}-${pad(p.m)}-${pad(p.d)}`);
        }
        return out;
      }
    }
    return [];
  }

  // String — strict DD/MM only.
  if (typeof rawValue === 'string') {
    const s = rawValue.trim();
    if (!s) return [];
    // ISO is always accepted unambiguously.
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
      const [y, m, d] = s.split('-').map(Number);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return [`${y}-${pad(m)}-${pad(d)}`];
      return [];
    }
    // Strict DD/MM/YY or DD/MM/YYYY (with /, -, or . separators).
    const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/);
    if (!m) return [];
    const day = Number(m[1]);
    const month = Number(m[2]);
    const yr = Number(m[3]);
    if (day < 1 || day > 31 || month < 1 || month > 12) return [];
    const year = yr < 50 ? 2000 + yr : (yr < 100 ? 1900 + yr : yr);
    return [`${year}-${pad(month)}-${pad(day)}`];
  }

  return [];
}

// Returns the nearest class-day ISO within ±maxDistance days, or null if none
// fall within that window. Distance prefers BACKWARD (older date) on tie.
function snapToClassDay(iso, classDays, maxDistance = 2) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  if (classDays.includes(d.getDay())) return { iso, distance: 0 };
  for (let off = 1; off <= maxDistance; off += 1) {
    const back = new Date(d); back.setDate(d.getDate() - off);
    if (classDays.includes(back.getDay())) return { iso: dateToIso(back), distance: -off };
    const fwd = new Date(d); fwd.setDate(d.getDate() + off);
    if (classDays.includes(fwd.getDay())) return { iso: dateToIso(fwd), distance: off };
  }
  return null;
}

function dateToIso(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Resolve a single date column to its best ISO interpretation given:
//   rawValue: the original cell (Date/number/string)
//   classDays: array of allowed weekday numbers (0=Sun … 6=Sat)
//   leftIso/rightIso: ISO dates of the resolved date columns immediately
//                     to the left and right (used to pick among ambiguous
//                     candidates that all fall on class days)
//
// Returns { iso, status, candidates } where status is one of:
//   'resolved'        — single class-day match
//   'inferred'        — multiple class-day matches, picked one via neighbors
//   'best-guess'      — multiple class-day matches, no neighbors, picked recent past
//   'not-class-day'   — has candidates but none fall on a class day → must be set manually
//   'unparseable'     — no candidates at all
export function resolveDateCandidates(rawValue, {
  classDays = CLASS_DAY_DEFAULT,
  leftIso = null,
  rightIso = null,
} = {}) {
  const candidates = buildDateCandidates(rawValue);
  if (candidates.length === 0) return { iso: null, status: 'unparseable', candidates: [] };

  const valid = candidates.filter((c) => isClassDay(c, classDays));
  if (valid.length === 0) {
    // Try to snap each candidate to the nearest class day within ±2 days.
    for (const cand of candidates) {
      const snap = snapToClassDay(cand, classDays, 2);
      if (snap) {
        return {
          iso: snap.iso,
          status: 'snapped',
          candidates,
          snappedFrom: cand,
          snapDistance: snap.distance,
        };
      }
    }
    return { iso: null, status: 'not-class-day', candidates };
  }
  if (valid.length === 1) {
    return { iso: valid[0], status: 'resolved', candidates };
  }

  // Multiple class-day matches — disambiguate.
  if (leftIso && rightIso) {
    const desc = leftIso > rightIso;
    const inRange = valid.filter((iso) =>
      desc ? iso < leftIso && iso > rightIso : iso > leftIso && iso < rightIso,
    );
    if (inRange.length === 1) return { iso: inRange[0], status: 'inferred', candidates };
    if (inRange.length > 1) {
      // Multiple in range — keep candidate-order preference (DD/MM first).
      return { iso: inRange[0], status: 'inferred', candidates };
    }
  }
  if (leftIso) {
    const matching = valid.filter((iso) => iso < leftIso); // assume descending
    if (matching.length > 0) {
      // Prefer the one closest to leftIso (next class day backward).
      matching.sort((x, y) => Math.abs(new Date(x) - new Date(leftIso)) - Math.abs(new Date(y) - new Date(leftIso)));
      return { iso: matching[0], status: 'inferred', candidates };
    }
  }

  // No useful neighbor context — keep the FIRST candidate (DD/MM is preferred by
  // construction in buildDateCandidates), constrained to past dates if possible.
  const today = new Date().toISOString().slice(0, 10);
  const past = valid.filter((iso) => iso <= today);
  if (past.length > 0) return { iso: past[0], status: 'best-guess', candidates };
  return { iso: valid[0], status: 'best-guess', candidates };
}

// Re-resolve every date-kind column in a mapping using the current classDays.
// Useful when the user toggles class days in the UI.
export function reresolveDates(mapping, rawHeaders, classDays) {
  const KINDS = new Set(['date']);
  const out = { ...mapping, columns: mapping.columns.map((c) => ({ ...c })) };
  // Build leftIso lookup: walk left-to-right, tracking last resolved date.
  let lastIso = null;
  const dateIndices = [];
  out.columns.forEach((c, i) => { if (KINDS.has(c.kind)) dateIndices.push(i); });
  // First pass: fill what we can with single-candidate certainty + snap.
  dateIndices.forEach((i) => {
    const r = resolveDateCandidates(rawHeaders[i], { classDays });
    if (r.status === 'resolved' || r.status === 'snapped' || r.status === 'best-guess') {
      out.columns[i].iso_date = r.iso;
    }
    out.columns[i]._dateStatus = r.status;
    out.columns[i]._dateCandidates = r.candidates;
    out.columns[i]._snappedFrom = r.snappedFrom || null;
    out.columns[i]._snapDistance = r.snapDistance ?? null;
  });
  // Second pass: refine ambiguous via neighbor context.
  dateIndices.forEach((i, idx) => {
    if (out.columns[i].iso_date) return;
    const leftI = dateIndices[idx - 1];
    const rightI = dateIndices[idx + 1];
    const leftIso = leftI != null ? out.columns[leftI].iso_date : null;
    const rightIso = rightI != null ? out.columns[rightI].iso_date : null;
    const r = resolveDateCandidates(rawHeaders[i], { classDays, leftIso, rightIso });
    if (r.iso) out.columns[i].iso_date = r.iso;
    out.columns[i]._dateStatus = r.status;
    out.columns[i]._dateCandidates = r.candidates;
    out.columns[i]._snappedFrom = r.snappedFrom || null;
    out.columns[i]._snapDistance = r.snapDistance ?? null;
  });
  // Re-pair attendance_value / score columns to nearest left date.
  let lastDate = null;
  out.columns.forEach((c) => {
    if (c.kind === 'date') { lastDate = c.iso_date; return; }
    if (c.kind === 'attendance_value' || c.kind === 'score') {
      c.iso_date = lastDate;
    }
  });
  return out;
}

const HEADER_PATTERNS = [
  { kind: 'student_name',     re: /^(student\s*)?name$|full\s*name|^naem$|^naam$|^stundent\s*name|name\s*of\s*student/i },
  { kind: 'usn',              re: /^usn$|^u\.?s\.?n\.?$|university.*seat|roll\s*(no|number)?|reg(istration)?\.?\s*(no|number)?/i },
  { kind: 'email',            re: /^e[-_\s]?mail$|email\s*(id|address)?/i },
  { kind: 'branch_code',      re: /^branch$|department|^dept\.?$|stream/i },
  { kind: 'admission_number', re: /admission\s*(no|number)?|admn\.?\s*no/i },
  { kind: 'batch',            re: /batch|cohort|class\s*of/i },
  { kind: 'attendance_value', re: /^\s*attendance\s*$/i },
  { kind: 'ignore',           re: /^sl\.?\s*no\.?$|serial\s*(no|number)?|^sno$|^s\.?\s*no\.?$|^#$|n8n|invite\s*link|^link$|\bnotes?\b|\btotal\b|\baverage\b|^avg$|\bstatus\b|joined.*batch/i },
];

// Score-kind columns: capture metric and optional max value from header like "Knowledge(25)".
const SCORE_RE = /\b(knowledge|skill|score|assessment|test|quiz|marks?)\b/i;
const SCORE_MAX_RE = /\((\d{1,4})\)/;

const DATE_LIKE = [
  /^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/,                    // 15/4/26, 15-04-2026
  /^\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}$/,                      // 2026-04-15
  /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,      // Apr 15
];

const ATTENDANCE_TOKENS = new Set([
  'true', 'false', 't', 'f',
  'yes', 'no', 'y', 'n',
  'p', 'a',
  'present', 'absent',
  '1', '0', '',
]);

function isDateLike(s) {
  if (!s) return false;
  return DATE_LIKE.some((re) => re.test(s));
}

function detectDateFormat(samples) {
  // samples: array of header strings that look date-like
  for (const s of samples) {
    if (!s) continue;
    if (/^\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}$/.test(s)) return 'YYYY-MM-DD';
    const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (m) {
      const yLen = m[3].length;
      if (yLen === 4) return Number(m[1]) > 12 ? 'DD/MM/YYYY' : 'MM/DD/YYYY';
      return 'DD/M/YY';
    }
  }
  return 'UNKNOWN';
}

function detectConvention(samplesByCol) {
  // Flatten all sample cells from suspected attendance columns.
  const seen = new Set();
  samplesByCol.flat().forEach((v) => {
    const t = String(v ?? '').trim().toLowerCase();
    if (t) seen.add(t);
  });
  if (seen.size === 0) return 'UNKNOWN';

  const has = (...vals) => vals.every((v) => seen.has(v));
  if (has('true', 'false') || seen.has('true') || seen.has('false')) return 'TRUE_FALSE';
  if (has('present', 'absent') || (seen.has('present') && !seen.has('p'))) return 'PRESENT_ABSENT';
  if (has('p', 'a')) return 'PA';
  if (has('y', 'n')) return 'YN';
  if (has('1', '0')) return '10';
  return 'UNKNOWN';
}

function classifyByHeader(header) {
  const h = String(header || '').trim();
  if (!h || /^column\s*\d+$/i.test(h)) return null; // synthetic
  // Score detection (must come before generic patterns since "Score" can collide).
  if (SCORE_RE.test(h)) return 'score';
  for (const { kind, re } of HEADER_PATTERNS) {
    if (re.test(h)) return kind;
  }
  return null;
}

// Returns { metric, max_value } for a score header.
function parseScoreHeader(header) {
  const h = String(header || '').toLowerCase();
  const max = SCORE_MAX_RE.exec(header)?.[1];
  let metric = 'score';
  if (/knowledge/.test(h)) metric = 'knowledge';
  else if (/skill/.test(h)) metric = 'skill';
  else if (/assessment|test|quiz/.test(h)) metric = 'pre_assessment';
  return { metric, max_value: max ? Number(max) : null };
}

// Public helper used by the UI when the user types a free-text clarification.
export function classifyText(text) {
  return classifyByHeader(text);
}


function classifyBySamples(values) {
  // values is the column's values across sample rows.
  const cleaned = values.map((v) => String(v ?? '').trim()).filter((v) => v !== '');
  if (cleaned.length === 0) return null;

  // USN-ish: alphanumeric uppercase, length 7-12.
  const usnHits = cleaned.filter((v) => /^[0-9A-Z]{7,12}$/.test(v.toUpperCase())).length;
  if (usnHits / cleaned.length > 0.6) return 'usn';

  // Email-ish.
  const emailHits = cleaned.filter((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)).length;
  if (emailHits / cleaned.length > 0.6) return 'email';

  // Name-ish: mostly letters + spaces, multiple words common.
  const nameHits = cleaned.filter((v) => /^[A-Za-z][A-Za-z .'\-]{2,}$/.test(v) && /\s/.test(v)).length;
  if (nameHits / cleaned.length > 0.6) return 'student_name';

  // Branch code-ish: 2-4 uppercase letters.
  const branchHits = cleaned.filter((v) => /^[A-Z]{2,4}$/.test(v)).length;
  if (branchHits / cleaned.length > 0.6) return 'branch_code';

  return null;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Returns: { is_pivoted, date_format, attendance_convention, classDays, columns, _unmapped }
export function deterministicMap({ headers, rawHeaders, rows, classDays = CLASS_DAY_DEFAULT }) {
  const safeRaw = rawHeaders || headers;
  const samplesPerCol = headers.map((_, i) => rows.slice(0, 10).map((r) => r[i]));

  // First pass: kind classification (no date resolution yet).
  const columns = headers.map((header, i) => {
    let kind = classifyByHeader(header);
    let metric = null;
    let max_value = null;

    // String header that looks date-like → date (resolved later).
    if (!kind && isDateLike(header)) {
      kind = 'date';
    }
    // Raw value is a native Date or Excel serial in date range → date.
    if (!kind) {
      const raw = safeRaw[i];
      if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
        kind = 'date';
      } else if (typeof raw === 'number' && raw >= SERIAL_DATE_MIN && raw <= SERIAL_DATE_MAX) {
        kind = 'date';
      }
    }
    // Sample-value sniffing for unclassified columns.
    if (!kind) {
      kind = classifyBySamples(samplesPerCol[i]);
    }
    if (kind === 'score') {
      ({ metric, max_value } = parseScoreHeader(header));
    }

    return {
      header,
      kind: kind || 'ignore',
      iso_date: null,
      metric,
      max_value,
      optional: false,
    };
  });

  // Second pass: resolve every date column against class-day constraint.
  const dateIndices = columns.map((c, i) => (c.kind === 'date' ? i : -1)).filter((i) => i >= 0);
  // 2a: single-candidate resolutions first (including snap-to-nearest-class-day).
  dateIndices.forEach((i) => {
    const r = resolveDateCandidates(safeRaw[i], { classDays });
    if (r.status === 'resolved' || r.status === 'snapped') columns[i].iso_date = r.iso;
    columns[i]._dateStatus = r.status;
    columns[i]._dateCandidates = r.candidates;
    if (r.snappedFrom) {
      columns[i]._snappedFrom = r.snappedFrom;
      columns[i]._snapDistance = r.snapDistance;
    }
  });
  // 2b: ambiguous resolutions using neighbor context.
  dateIndices.forEach((i, idx) => {
    if (columns[i].iso_date) return;
    const leftI = dateIndices[idx - 1];
    const rightI = dateIndices[idx + 1];
    const leftIso = leftI != null ? columns[leftI].iso_date : null;
    const rightIso = rightI != null ? columns[rightI].iso_date : null;
    const r = resolveDateCandidates(safeRaw[i], { classDays, leftIso, rightIso });
    if (r.iso) columns[i].iso_date = r.iso;
    columns[i]._dateStatus = r.status;
    columns[i]._dateCandidates = r.candidates;
    if (r.snappedFrom) {
      columns[i]._snappedFrom = r.snappedFrom;
      columns[i]._snapDistance = r.snapDistance;
    }
  });

  // Pair attendance_value / score columns to nearest left date column.
  let lastDate = null;
  columns.forEach((c) => {
    if (c.kind === 'date') { lastDate = c.iso_date; return; }
    if (c.kind === 'attendance_value' || c.kind === 'score') {
      c.iso_date = lastDate;
    }
  });

  const dateCols = columns.filter((c) => c.kind === 'date');
  const dateFormat = detectDateFormat(dateCols.map((c) => c.header)) || 'UNKNOWN';

  const attendanceSamples = dateCols.map((c) => samplesPerCol[columns.indexOf(c)] || []);
  const convention = detectConvention(attendanceSamples);

  // Unmapped headers (still 'ignore' but we want AI to take a second look).
  const _unmapped = columns
    .filter((c) => c.kind === 'ignore' && c.header && !/^column\s*\d+$/i.test(c.header)
                   && !HEADER_PATTERNS.find((p) => p.kind === 'ignore').re.test(c.header))
    .map((c) => c.header);

  return {
    is_pivoted: dateCols.length > 0 || columns.some((c) => c.kind === 'attendance_value'),
    date_format: dateFormat,
    attendance_convention: convention,
    classDays,
    columns,
    _unmapped,
  };
}
