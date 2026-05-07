import * as XLSX from 'xlsx';
import Papa from 'papaparse';

const MAX_BYTES = 5 * 1024 * 1024;

// Excel date serial range (typical values land between 1970 and 2100).
const SERIAL_DATE_MIN = 25569;   // 1970-01-01
const SERIAL_DATE_MAX = 73000;   // ~2099

// Step 1 of upload: peek at the file, return the list of sheets so the user
// can pick one. Heavy parsing is deferred to loadSheet().
export async function peekFile(file) {
  if (!file) throw new Error('No file selected');
  if (file.size > MAX_BYTES) throw new Error('File exceeds 5 MB limit');
  if (file.size === 0) throw new Error('File is empty');

  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return peekXlsx(file);
  }
  if (name.endsWith('.csv')) {
    return peekCsv(file);
  }
  throw new Error('Unsupported file type. Use .xlsx or .csv');
}

async function peekXlsx(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true, cellNF: true });
  const sheets = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const ref = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null;
    const rowCount = ref ? ref.e.r - ref.s.r + 1 : 0;
    const colCount = ref ? ref.e.c - ref.s.c + 1 : 0;
    // Sniff the first ~3 non-empty rows for a hint label.
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
    const sample = aoa.slice(0, 5).flat();
    const hint = sniffHint(sample);
    return { name, rowCount, colCount, hint };
  });
  return { kind: 'xlsx', sheets, _wb: wb };
}

async function peekCsv(file) {
  const text = await file.text();
  const result = Papa.parse(text, { skipEmptyLines: true });
  if (result.errors?.length) {
    const fatal = result.errors.find((e) => e.type === 'Delimiter' || e.type === 'FieldMismatch');
    if (fatal) throw new Error(`CSV parse: ${fatal.message}`);
  }
  const rows = result.data;
  const colCount = rows[0]?.length || 0;
  const sample = rows.slice(0, 5).flat();
  return {
    kind: 'csv',
    sheets: [{ name: 'CSV', rowCount: rows.length, colCount, hint: sniffHint(sample) }],
    _csvRows: rows,
  };
}

function sniffHint(values) {
  const stringy = values.filter((v) => typeof v === 'string' && v.trim() !== '');
  const dateish = stringy.filter((v) =>
    /^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/.test(v) || /^\d{4}-\d{2}-\d{2}$/.test(v),
  ).length;
  const hasUsn = stringy.some((v) => /usn|roll|admission/i.test(v));
  const hasName = stringy.some((v) => /\bname\b/i.test(v));
  const hasEmail = stringy.some((v) => /e[-_\s]?mail/i.test(v));
  const hasDates = dateish > 2 || values.some((v) => v instanceof Date);
  const tags = [];
  if (hasName || hasUsn || hasEmail) tags.push('roster');
  if (hasDates) tags.push('attendance');
  return tags.join(' + ') || 'unknown';
}

// Step 2: extract a chosen sheet as parallel matrices.
//   matrix: string[][]  — normalized for display & data parsing (TRUE/FALSE etc.)
//   rawMatrix: any[][]  — preserves Date / number / string types for downstream
//                          date resolution against class-day constraints
// Returns { matrix, rawMatrix, width, suggestedHeaderRow }.
export function loadSheet(peek, sheetName) {
  let aoa;
  let hiddenCols = new Set();
  let hiddenRows = new Set();

  if (peek.kind === 'xlsx') {
    const ws = peek._wb.Sheets[sheetName];
    if (!ws) throw new Error(`Sheet "${sheetName}" not found`);
    if (Array.isArray(ws['!cols'])) {
      ws['!cols'].forEach((c, i) => { if (c?.hidden) hiddenCols.add(i); });
    }
    if (Array.isArray(ws['!rows'])) {
      ws['!rows'].forEach((r, i) => { if (r?.hidden) hiddenRows.add(i); });
    }
    // Get raw values + formatted display strings in parallel so date cells can be
    // parsed by what the user actually SEES (cell.w), not by SheetJS's locale-shifted
    // JS Date object. Critical: many xlsx files have American mm/dd cell formats
    // even when the data is Indian DD/MM — the display string is the source of truth.
    const aoaRaw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
    const aoaDisplay = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
    aoa = aoaRaw.map((row, r) => row.map((v, c) => {
      // For date or number cells, prefer the display string the user sees in Excel.
      if (v instanceof Date || typeof v === 'number') {
        const disp = aoaDisplay[r]?.[c];
        if (typeof disp === 'string' && disp.trim()) return disp.trim();
      }
      return v;
    }));
  } else {
    aoa = peek._csvRows;
  }

  const rawSrc = aoa.filter((_, i) => !hiddenRows.has(i));
  if (rawSrc.length === 0) throw new Error('No content found in sheet');

  const width = rawSrc.reduce((m, r) => Math.max(m, r.length), 0);

  // Pad rows to common width preserving raw types.
  const padded = rawSrc.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''));

  // Trim fully-empty leading rows.
  let lead = 0;
  while (
    lead < padded.length &&
    padded[lead].every((v) => v === '' || v == null)
  ) lead += 1;
  const trimmed = padded.slice(lead);
  if (trimmed.length === 0) throw new Error('No content found in sheet');

  // Project to visible columns: drop hidden + fully-empty.
  const visible = [];
  for (let c = 0; c < width; c += 1) {
    if (hiddenCols.has(c)) continue;
    const hasContent = trimmed.some((row) => {
      const v = row[c];
      return v !== '' && v != null;
    });
    if (!hasContent) continue;
    visible.push(c);
  }

  let rawProjected = trimmed.map((row) => visible.map((c) => row[c]));
  // De-dupe based on a string signature so date and TRUE values still match across rows.
  rawProjected = dropDuplicateColumns(rawProjected, sigOfRow);

  if (rawProjected.length === 0 || rawProjected[0].length === 0) {
    throw new Error('No usable columns found in sheet');
  }

  // Now build the display matrix: strings, with serial numbers resolved when the
  // column looks like an attendance column.
  const projectedWidth = rawProjected[0].length;
  const booleanCols = new Set();
  for (let c = 0; c < projectedWidth; c += 1) {
    let hits = 0;
    let total = 0;
    for (let r = 1; r < Math.min(rawProjected.length, 20); r += 1) {
      const v = rawProjected[r]?.[c];
      if (v === '' || v == null) continue;
      total += 1;
      if (looksBoolean(v)) hits += 1;
    }
    if (total > 0 && hits / total > 0.5) booleanCols.add(c);
  }

  const matrix = rawProjected.map((row) =>
    row.map((v, i) => normalizeCell(v, { isBooleanCol: booleanCols.has(i) }))
  );

  return {
    matrix,
    rawMatrix: rawProjected,
    width: projectedWidth,
    suggestedHeaderRow: detectHeaderRow(matrix),
  };
}

// Build {headers, rawHeaders, rows} from matrix + rawMatrix and a header-row index.
// rawHeaders preserve native types (Date / number / string) so the mapper can
// resolve date columns against class-day constraints without losing info.
export function shapeWithHeaderRow(matrix, rawMatrix, headerRowIndex) {
  if (!Array.isArray(matrix) || matrix.length === 0) {
    return { headers: [], rawHeaders: [], rows: [] };
  }
  const idx = Math.max(0, Math.min(headerRowIndex, matrix.length - 1));
  const headers = matrix[idx].map((c, i) => c || `Column ${i + 1}`);
  const rawHeaders = rawMatrix ? rawMatrix[idx] : matrix[idx];
  const rows = matrix
    .slice(idx + 1)
    .filter((r) => r.some((v) => v !== ''));
  return { headers, rawHeaders, rows };
}

// --- helpers -------------------------------------------------------------

function looksBoolean(v) {
  if (typeof v === 'boolean') return true;
  if (v instanceof Date) return false;
  const s = String(v ?? '').trim().toLowerCase();
  return ['true', 'false', 't', 'f', 'yes', 'no', 'y', 'n', 'p', 'a', 'present', 'absent', '1', '0'].includes(s);
}

function pad(n) { return String(n).padStart(2, '0'); }

function dateToIso(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function serialToIso(serial) {
  // SheetJS internal helper: convert Excel serial date number to JS Date.
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed) return null;
  return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}`;
}

function normalizeCell(value, { isBooleanCol = false } = {}) {
  if (value == null || value === '') return '';
  if (value instanceof Date) return dateToIso(value);
  if (typeof value === 'number') {
    // Header cells appear in row 0/1; the column boolean signal tells us this column
    // contains attendance values, so a numeric header in date-serial range is a date.
    if (isBooleanCol && value >= SERIAL_DATE_MIN && value <= SERIAL_DATE_MAX) {
      const iso = serialToIso(value);
      if (iso) return iso;
    }
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value).trim();
}

function sigOfRow(row, c) {
  const v = row[c];
  if (v instanceof Date) return `D${v.getTime()}`;
  if (typeof v === 'number') return `N${v}`;
  if (typeof v === 'boolean') return v ? 'T' : 'F';
  return `S${String(v ?? '').trim()}`;
}

function dropDuplicateColumns(matrix, signer = (row, c) => String(row[c] ?? '')) {
  if (matrix.length === 0) return matrix;
  const cols = matrix[0].length;
  const seen = new Map();
  const keep = [];
  for (let c = 0; c < cols; c += 1) {
    const sig = matrix.map((r) => signer(r, c)).join('|');
    if (!seen.has(sig)) {
      seen.set(sig, c);
      keep.push(c);
    }
  }
  if (keep.length === cols) return matrix;
  return matrix.map((row) => keep.map((c) => row[c]));
}

function detectHeaderRow(matrix) {
  const candidates = matrix.slice(0, Math.min(5, matrix.length));
  let best = 0;
  let bestScore = -Infinity;
  candidates.forEach((row, i) => {
    const filled = row.filter((v) => v !== '');
    if (filled.length === 0) return;
    const distinct = new Set(filled).size;
    const numericish = filled.filter((v) => /^-?\d+(\.\d+)?$/.test(v)).length;
    const avgLen = filled.reduce((s, v) => s + v.length, 0) / filled.length;
    const score = distinct * 2 - numericish * 3 - Math.max(0, avgLen - 20);
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}
