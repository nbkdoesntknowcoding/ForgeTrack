// Date parsing utilities for the import flow.
// The AI returns date_format as one of:
//   DD/M/YY, DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, or "other".
// For pivoted columns, the AI also returns iso_date per column header — we trust
// that when present and only fall back to format-based parsing when missing.

const TWO_DIGIT_PIVOT = 50; // 0–49 → 20xx, 50–99 → 19xx (rare in practice)

export function expandTwoDigitYear(yy) {
  const n = Number(yy);
  if (Number.isNaN(n)) return null;
  if (n >= 100) return n;
  return n < TWO_DIGIT_PIVOT ? 2000 + n : 1900 + n;
}

function pad(n) { return String(n).padStart(2, '0'); }

export function toIso({ year, month, day }) {
  if (!year || !month || !day) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseDateBy(format, value) {
  if (value == null || value === '') return null;
  const v = String(value).trim();
  if (!v) return null;

  const sep = /[\/\-.]/;
  const parts = v.split(sep).map((s) => s.trim()).filter(Boolean);

  switch ((format || '').toUpperCase()) {
    case 'DD/M/YY':
    case 'DD/MM/YY':
    case 'D/M/YY': {
      if (parts.length !== 3) return null;
      const day = Number(parts[0]);
      const month = Number(parts[1]);
      const year = expandTwoDigitYear(parts[2]);
      return toIso({ year, month, day });
    }
    case 'DD/MM/YYYY':
    case 'D/M/YYYY': {
      if (parts.length !== 3) return null;
      return toIso({ day: Number(parts[0]), month: Number(parts[1]), year: Number(parts[2]) });
    }
    case 'MM/DD/YYYY':
    case 'M/D/YYYY': {
      if (parts.length !== 3) return null;
      return toIso({ month: Number(parts[0]), day: Number(parts[1]), year: Number(parts[2]) });
    }
    case 'YYYY-MM-DD':
    case 'YYYY/MM/DD': {
      if (parts.length !== 3) return null;
      return toIso({ year: Number(parts[0]), month: Number(parts[1]), day: Number(parts[2]) });
    }
    default: {
      // Heuristic fallback: try YMD, then DMY, then MDY.
      if (parts.length !== 3) return null;
      const [a, b, c] = parts.map(Number);
      if (a > 1900) return toIso({ year: a, month: b, day: c });
      if (a > 12)   return toIso({ day: a, month: b, year: c < 100 ? expandTwoDigitYear(c) : c });
      return toIso({ month: a, day: b, year: c < 100 ? expandTwoDigitYear(c) : c });
    }
  }
}

export function parseAttendance(convention, raw) {
  if (raw == null || raw === '') return null;
  const v = String(raw).trim().toLowerCase();
  if (!v) return null;
  switch ((convention || '').toUpperCase()) {
    case 'TRUE_FALSE':
      if (['true', 't', 'yes'].includes(v)) return true;
      if (['false', 'f', 'no'].includes(v)) return false;
      break;
    case 'PA':
      if (v === 'p') return true;
      if (v === 'a') return false;
      break;
    case 'PRESENT_ABSENT':
      if (v.startsWith('pres')) return true;
      if (v.startsWith('abs')) return false;
      break;
    case '10':
      if (v === '1') return true;
      if (v === '0') return false;
      break;
    case 'YN':
      if (v === 'y') return true;
      if (v === 'n') return false;
      break;
    default:
      // Last-resort heuristic: try common values regardless of declared convention.
      if (['true', 't', 'yes', 'y', 'p', '1', 'present'].includes(v)) return true;
      if (['false', 'f', 'no', 'n', 'a', '0', 'absent'].includes(v)) return false;
  }
  return null; // unparseable → treated as "no record"
}
