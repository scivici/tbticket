/**
 * Phase 4 — CDR (CSV) Filter
 *
 * Streams a CDR-like CSV row-by-row, keeping only records that match the
 * extracted context (time range, caller/callee numbers). Designed for the
 * common TelcoBridges CDR shape but tolerant of unknown column layouts.
 *
 * Detection strategy:
 *   1. Read the header row.
 *   2. Identify columns by name (case-insensitive substring match):
 *        time      → contains "time", "date", "start", "setup", "answer"
 *        caller    → contains "caller", "calling", "from", "src", "ani"
 *        callee    → contains "callee", "called", "to", "dst", "dnis"
 *        status    → contains "status", "result", "disposition", "code"
 *   3. For each row: keep if any matched column value matches a filter.
 *      A row passes if at least one filter matches.
 *
 * Output: <basename>.filtered.csv (header + matched rows). Original retained.
 *
 * Limitations:
 *   - Doesn't handle quoted fields with embedded newlines (rare in CDRs).
 *   - Doesn't normalize phone formats beyond stripping non-digits and an
 *     optional "+1" prefix; if the customer wrote "+15145551234" and the
 *     CDR stores "5145551234", they still match.
 */

'use strict';

const fs = require('fs');
const readline = require('readline');
const path = require('path');

const DEFAULT_MIN_SIZE_BYTES = 100 * 1024; // 100 KB — below this, don't bother
const DEFAULT_MIN_ROWS = 100;              // below this, don't bother

// --- Helpers ---------------------------------------------------------------

function parseCsvLine(line, delimiter) {
  // Minimal CSV: handles quoted fields and "" escapes; no embedded newlines.
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === delimiter) { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function detectDelimiter(headerLine) {
  const candidates = [',', ';', '\t', '|'];
  let best = ',';
  let bestCount = -1;
  for (const d of candidates) {
    const count = (headerLine.match(new RegExp(escapeRegex(d), 'g')) || []).length;
    if (count > bestCount) { best = d; bestCount = count; }
  }
  return best;
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function findColumn(headers, needles) {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase();
    for (const n of needles) if (h.includes(n)) return i;
  }
  return -1;
}

function normalizePhone(s) {
  if (!s) return '';
  // Keep digits and a leading +; strip everything else.
  let v = String(s).trim();
  v = v.replace(/[^\d+]/g, '');
  if (v.startsWith('+')) v = v.slice(1);
  // Strip leading "1" for North American 11-digit numbers so +15145551234 ≈ 5145551234.
  if (v.length === 11 && v.startsWith('1')) v = v.slice(1);
  return v;
}

function parseRowTime(value) {
  if (!value) return null;
  const v = String(value).trim();
  // Try ISO and common SQL-style formats.
  const m = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/.exec(v);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  // Epoch seconds or millis (10 or 13 digits)
  if (/^\d{13}$/.test(v)) return parseInt(v, 10);
  if (/^\d{10}$/.test(v)) return parseInt(v, 10) * 1000;
  // US: 04/08/2026 14:30:15
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/.exec(v);
  if (us) return Date.UTC(+us[3], +us[1] - 1, +us[2], +us[4], +us[5], +us[6]);
  return null;
}

function makeFilteredOutputPath(filePath) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const dot = base.lastIndexOf('.');
  const out = dot > 0
    ? base.slice(0, dot) + '.filtered' + base.slice(dot)
    : base + '.filtered';
  return path.join(dir, out);
}

// --- Main ------------------------------------------------------------------

/**
 * @param {string} filePath
 * @param {object} options
 * @param {Array<{start:string,end:string}>} [options.timeRanges]
 * @param {string[]} [options.phoneNumbers]   E.164 or any format
 * @param {number} [options.bufferMinutes=15]
 * @param {number} [options.minSizeBytes]
 */
async function filterCdrFile(filePath, options = {}) {
  const bufferMs = (options.bufferMinutes ?? 15) * 60 * 1000;
  const minSize = options.minSizeBytes ?? DEFAULT_MIN_SIZE_BYTES;
  const timeRanges = (options.timeRanges || []).map((tr) => ({
    start: new Date(tr.start).getTime() - bufferMs,
    end: new Date(tr.end).getTime() + bufferMs,
  })).filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end));
  const phones = (options.phoneNumbers || []).map(normalizePhone).filter(Boolean);

  const stat = fs.statSync(filePath);
  const result = {
    file: filePath,
    skipped: false,
    skippedReason: null,
    originalBytes: stat.size,
    filteredBytes: 0,
    originalRows: 0,
    filteredRows: 0,
    columns: { time: -1, caller: -1, callee: -1, status: -1 },
    successCount: 0,        // rows where status looks like "200" / "ANSWER"
    failureCount: 0,        // rows with explicit failure status
    outputPath: null,
  };

  if (stat.size < minSize) {
    result.skipped = true;
    result.skippedReason = `below ${minSize}-byte threshold`;
    return result;
  }

  if (timeRanges.length === 0 && phones.length === 0) {
    result.skipped = true;
    result.skippedReason = 'no time range or phone filters available';
    return result;
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });

  const outputPath = makeFilteredOutputPath(filePath);
  const out = fs.createWriteStream(outputPath);

  let headers = null;
  let delimiter = ',';
  let cols = result.columns;

  for await (const line of rl) {
    if (line === '') continue;
    if (headers === null) {
      delimiter = detectDelimiter(line);
      headers = parseCsvLine(line, delimiter);
      cols.time = findColumn(headers, ['time', 'date', 'start', 'setup', 'answer']);
      cols.caller = findColumn(headers, ['caller', 'calling', 'from ', 'src', 'ani']);
      cols.callee = findColumn(headers, ['callee', 'called', 'to ', 'dst', 'dnis']);
      cols.status = findColumn(headers, ['status', 'result', 'disposition', 'code']);
      out.write(line);
      out.write('\n');
      continue;
    }

    result.originalRows++;
    const fields = parseCsvLine(line, delimiter);

    let keep = false;

    // Time-range match (only checked if a time column was found)
    if (timeRanges.length > 0 && cols.time >= 0) {
      const t = parseRowTime(fields[cols.time]);
      if (t !== null) {
        for (const w of timeRanges) {
          if (t >= w.start && t <= w.end) { keep = true; break; }
        }
      }
    }

    // Phone match (if not yet kept)
    if (!keep && phones.length > 0) {
      const candidates = [];
      if (cols.caller >= 0) candidates.push(normalizePhone(fields[cols.caller]));
      if (cols.callee >= 0) candidates.push(normalizePhone(fields[cols.callee]));
      for (const p of phones) {
        if (candidates.includes(p)) { keep = true; break; }
      }
    }

    if (keep) {
      result.filteredRows++;
      out.write(line);
      out.write('\n');
      result.filteredBytes += Buffer.byteLength(line) + 1;

      // Stat: classify by status column
      if (cols.status >= 0) {
        const s = String(fields[cols.status] || '').toLowerCase();
        if (/^200\b|answer|ok|connect|success/.test(s)) result.successCount++;
        else if (/^[4-6]\d\d\b|fail|error|busy|noanswer|cancel|reject/.test(s)) result.failureCount++;
      }
    }
  }

  await new Promise((resolve, reject) => {
    out.end((err) => (err ? reject(err) : resolve()));
  });

  if (result.filteredRows < DEFAULT_MIN_ROWS && result.filteredRows < result.originalRows * 0.05) {
    // Very low yield — keep the file anyway since CDR filtering is high-signal,
    // but fall through. (Even 10 matching rows out of 50k is useful.)
  }

  if (result.filteredRows === 0) {
    fs.unlinkSync(outputPath);
    result.skipped = true;
    result.skippedReason = 'no rows matched filters';
    return result;
  }

  result.outputPath = outputPath;
  return result;
}

module.exports = {
  filterCdrFile,
  parseCsvLine,
  detectDelimiter,
  findColumn,
  normalizePhone,
  parseRowTime,
};
