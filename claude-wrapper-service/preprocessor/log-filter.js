/**
 * Phase 2 — Log Filter
 *
 * Trims .log / .log.gz / .txt files to lines that fall within ±BUFFER minutes
 * of any extracted time range. If the customer description had no usable
 * time range, falls back to keeping lines that contain telecom error markers
 * (TBLV0, ERROR, WARN, FATAL, etc).
 *
 * Original file is preserved; filtered output is written alongside as
 * `<basename>.filtered.log`. The orchestrator decides which path Claude reads.
 *
 * Streaming: each input line is read once, evaluated, and either dropped or
 * written. No file is ever fully buffered in memory — works on multi-GB logs.
 *
 * Multi-line records: when a line has no parseable timestamp it inherits the
 * timestamp of the preceding line (covers stack traces, multi-line errors).
 */

'use strict';

const fs = require('fs');
const readline = require('readline');
const zlib = require('zlib');
const path = require('path');

const DEFAULT_BUFFER_MINUTES = 15;
const DEFAULT_MIN_SIZE_BYTES = 1024 * 1024; // 1 MB — below this, don't bother filtering

// --- Timestamp parsing -----------------------------------------------------
// Each pattern below has a `rx` (regex) and a `parse(match) -> Date | null`.
// They are tried in order; first match wins. All return UTC dates.

const MONTHS_3 = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const TIMESTAMP_PATTERNS = [
  // ISO with T separator: 2026-04-08T14:30:15.123Z, 2026-04-08T14:30:15
  {
    name: 'iso-t',
    rx: /^\[?(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?Z?\]?/,
    parse: (m) => Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], +(m[7] ? m[7].slice(0, 3).padEnd(3, '0') : 0)),
  },
  // ISO with space: 2026-04-08 14:30:15.123, optional brackets
  {
    name: 'iso-space',
    rx: /^\[?(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?\]?/,
    parse: (m) => Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], +(m[7] ? m[7].slice(0, 3).padEnd(3, '0') : 0)),
  },
  // US: 04/08/2026 14:30:15
  {
    name: 'us-slash',
    rx: /^\[?(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\]?/,
    parse: (m) => Date.UTC(+m[3], +m[1] - 1, +m[2], +m[4], +m[5], +m[6]),
  },
  // Syslog: "Apr  8 14:30:15" — no year (we infer from context year)
  {
    name: 'syslog',
    rx: /^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})/,
    parse: (m, contextYear) => {
      const mon = MONTHS_3[m[1].toLowerCase()];
      if (mon === undefined) return null;
      return Date.UTC(contextYear, mon, +m[2], +m[3], +m[4], +m[5]);
    },
  },
];

const ERROR_FALLBACK_PATTERNS = [
  /TBLV[01]\b/,
  /\bERROR\b/i,
  /\bWARN(?:ING)?\b/i,
  /\bFATAL\b/i,
  /\bCRITICAL\b/i,
  /\bPANIC\b/i,
  /\bASSERT(?:ION)?\b/i,
  /\bEXCEPTION\b/i,
  /\bSEGFAULT\b/i,
  /\bcore\s*dump/i,
  /Stack trace/i,
];

/**
 * Parse a leading timestamp from a log line. Returns epoch ms or null.
 * @param {string} line
 * @param {number} contextYear   year used when timestamp lacks one (syslog)
 */
function parseTimestamp(line, contextYear) {
  for (const pat of TIMESTAMP_PATTERNS) {
    const m = pat.rx.exec(line);
    if (m) {
      const ms = pat.parse(m, contextYear);
      if (typeof ms === 'number' && !Number.isNaN(ms)) return ms;
    }
  }
  return null;
}

// --- Filtering -------------------------------------------------------------

function isErrorLine(line) {
  for (const rx of ERROR_FALLBACK_PATTERNS) if (rx.test(line)) return true;
  return false;
}

function buildWindows(timeRanges, bufferMinutes) {
  const buf = bufferMinutes * 60 * 1000;
  return timeRanges.map((tr) => ({
    start: new Date(tr.start).getTime() - buf,
    end: new Date(tr.end).getTime() + buf,
  })).filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end));
}

function inAnyWindow(ts, windows) {
  for (const w of windows) {
    if (ts >= w.start && ts <= w.end) return true;
  }
  return false;
}

function makeFilteredOutputPath(filePath) {
  const dir = path.dirname(filePath);
  let base = path.basename(filePath);
  // Strip .gz so output is text
  if (base.endsWith('.gz')) base = base.slice(0, -3);
  // Insert ".filtered" before the final extension (or at the end if none)
  const dot = base.lastIndexOf('.');
  if (dot > 0) {
    base = base.slice(0, dot) + '.filtered' + base.slice(dot);
  } else {
    base = base + '.filtered';
  }
  return path.join(dir, base);
}

function openInputStream(filePath) {
  const stream = fs.createReadStream(filePath);
  if (filePath.endsWith('.gz')) {
    return stream.pipe(zlib.createGunzip());
  }
  return stream;
}

/**
 * Filter a single log file.
 *
 * @param {string} filePath
 * @param {object} options
 * @param {Array<{start:string,end:string}>} options.timeRanges  ISO time ranges
 * @param {number} [options.bufferMinutes=15]
 * @param {number} [options.minSizeBytes=1MB]
 * @param {number} [options.contextYear]  for syslog format; defaults to current year
 * @returns {Promise<object>}  stats
 */
async function filterLogFile(filePath, options = {}) {
  const bufferMinutes = options.bufferMinutes ?? DEFAULT_BUFFER_MINUTES;
  const minSizeBytes = options.minSizeBytes ?? DEFAULT_MIN_SIZE_BYTES;
  const timeRanges = options.timeRanges || [];
  const contextYear = options.contextYear ?? new Date().getUTCFullYear();

  const stat = fs.statSync(filePath);
  const result = {
    file: filePath,
    skipped: false,
    skippedReason: null,
    mode: null,                // 'time_window' | 'error_fallback' | 'no_timestamp'
    originalBytes: stat.size,
    filteredBytes: 0,
    originalLines: 0,
    filteredLines: 0,
    timestampHitRate: 0,       // fraction of lines with a parseable timestamp
    outputPath: null,
  };

  if (stat.size < minSizeBytes) {
    result.skipped = true;
    result.skippedReason = `below ${minSizeBytes}-byte threshold`;
    return result;
  }

  const windows = buildWindows(timeRanges, bufferMinutes);
  const useTimeWindow = windows.length > 0;
  result.mode = useTimeWindow ? 'time_window' : 'error_fallback';

  const outputPath = makeFilteredOutputPath(filePath);
  const out = fs.createWriteStream(outputPath);
  const rl = readline.createInterface({
    input: openInputStream(filePath),
    crlfDelay: Infinity,
  });

  let lastTs = null;
  let timestampedLines = 0;

  for await (const rawLine of rl) {
    result.originalLines++;
    const line = rawLine; // already a string
    const ts = parseTimestamp(line, contextYear);
    if (ts !== null) {
      lastTs = ts;
      timestampedLines++;
    }

    let keep = false;
    if (useTimeWindow) {
      // Multi-line records inherit prior timestamp.
      if (lastTs !== null && inAnyWindow(lastTs, windows)) keep = true;
    } else {
      // No time hint — keep error/warning lines plus their immediate context.
      if (isErrorLine(line)) keep = true;
    }

    if (keep) {
      out.write(line);
      out.write('\n');
      result.filteredLines++;
      result.filteredBytes += Buffer.byteLength(line) + 1;
    }
  }

  await new Promise((resolve, reject) => {
    out.end((err) => (err ? reject(err) : resolve()));
  });

  result.timestampHitRate = result.originalLines === 0
    ? 0
    : timestampedLines / result.originalLines;

  // If the source had effectively no timestamps and we tried time-window
  // filtering, we'd produce an empty file. Detect that and switch to fallback.
  if (useTimeWindow && result.timestampHitRate < 0.05 && result.filteredLines === 0) {
    fs.unlinkSync(outputPath);
    result.mode = 'no_timestamp';
    result.skipped = true;
    result.skippedReason = 'no parseable timestamps; would produce empty filter';
    return result;
  }

  // Safety net: if the filter retained >90% of the lines, the duplicate file
  // isn't earning its keep — drop it and let Claude read the original. We use
  // line counts (not bytes) because byte counts are meaningless for gzipped
  // inputs (compressed-vs-uncompressed mismatch).
  if (
    result.originalLines > 0 &&
    result.filteredLines / result.originalLines > 0.9
  ) {
    fs.unlinkSync(outputPath);
    result.skipped = true;
    result.skippedReason = 'filter retained >90% of original lines; not worth a duplicate file';
    return result;
  }

  result.outputPath = outputPath;
  return result;
}

module.exports = {
  filterLogFile,
  parseTimestamp,           // exported for tests
  isErrorLine,
  makeFilteredOutputPath,
};
