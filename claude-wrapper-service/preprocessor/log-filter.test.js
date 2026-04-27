/**
 * Tests for log-filter.js. Run with:  node --test preprocessor/log-filter.test.js
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const {
  filterLogFile,
  parseTimestamp,
  isErrorLine,
  makeFilteredOutputPath,
} = require('./log-filter');

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'logfilter-'));
}

// --- Timestamp parser ------------------------------------------------------

test('parseTimestamp handles ISO with T', () => {
  const ms = parseTimestamp('2026-04-08T14:30:15.123Z some message', 2026);
  assert.equal(ms, Date.UTC(2026, 3, 8, 14, 30, 15, 123));
});

test('parseTimestamp handles ISO with space', () => {
  const ms = parseTimestamp('2026-04-08 14:30:15.500 TBLV0: error', 2026);
  assert.equal(ms, Date.UTC(2026, 3, 8, 14, 30, 15, 500));
});

test('parseTimestamp handles bracketed ISO', () => {
  const ms = parseTimestamp('[2026-04-08 14:30:15] some message', 2026);
  assert.equal(ms, Date.UTC(2026, 3, 8, 14, 30, 15));
});

test('parseTimestamp handles syslog format with context year', () => {
  const ms = parseTimestamp('Apr  8 14:30:15 host daemon: msg', 2026);
  assert.equal(ms, Date.UTC(2026, 3, 8, 14, 30, 15));
});

test('parseTimestamp returns null for lines without timestamps', () => {
  assert.equal(parseTimestamp('  at SomeClass.method(File.java:42)', 2026), null);
  assert.equal(parseTimestamp('', 2026), null);
});

// --- isErrorLine -----------------------------------------------------------

test('isErrorLine catches TBLV0 / ERROR / WARN / FATAL / Stack trace', () => {
  assert.ok(isErrorLine('2026-04-08 14:30:15 TBLV0: failed'));
  assert.ok(isErrorLine('2026-04-08 14:30:15 ERROR: something bad'));
  assert.ok(isErrorLine('2026-04-08 14:30:15 WARN  retrying'));
  assert.ok(isErrorLine('FATAL: out of memory'));
  assert.ok(isErrorLine('Stack trace: ...'));
  assert.ok(!isErrorLine('2026-04-08 14:30:15 INFO heartbeat ok'));
});

// --- makeFilteredOutputPath ------------------------------------------------

test('makeFilteredOutputPath inserts .filtered before extension and strips .gz', () => {
  assert.equal(
    makeFilteredOutputPath('/tmp/foo/bar.log').replace(/\\/g, '/'),
    '/tmp/foo/bar.filtered.log'
  );
  assert.equal(
    makeFilteredOutputPath('/tmp/foo/bar.log.gz').replace(/\\/g, '/'),
    '/tmp/foo/bar.filtered.log'
  );
});

// --- filterLogFile end-to-end ---------------------------------------------

test('filterLogFile keeps lines within ±15min of a time range', async () => {
  const dir = tmpdir();
  const file = path.join(dir, 'big.log');
  // Build ~2MB of synthetic log data spread across two hours.
  const lines = [];
  for (let i = 0; i < 7200; i++) {
    const sec = i;
    const h = 13 + Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const ts = `2026-04-08 ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    // Pad with filler so file gets to ~2MB
    lines.push(`${ts} INFO message ${i} ` + 'x'.repeat(200));
  }
  fs.writeFileSync(file, lines.join('\n') + '\n');

  const stats = await filterLogFile(file, {
    timeRanges: [{ start: '2026-04-08T14:00:00Z', end: '2026-04-08T14:30:00Z' }],
    bufferMinutes: 15,
    minSizeBytes: 1024,
  });

  assert.equal(stats.skipped, false, `skipped: ${stats.skippedReason}`);
  assert.equal(stats.mode, 'time_window');
  assert.ok(stats.outputPath, 'should have outputPath');
  // Window is 13:45 → 14:45 = 60 minutes = 3600 lines (out of 7200)
  assert.ok(
    stats.filteredLines > 3500 && stats.filteredLines < 3700,
    `filteredLines=${stats.filteredLines}, expected ~3600`
  );
  // Verify content actually contains 14:00 lines and not 13:00 lines
  const out = fs.readFileSync(stats.outputPath, 'utf8');
  assert.ok(out.includes('14:00:00'), 'missing 14:00:00 line');
  assert.ok(!out.includes('13:00:00'), 'should not include 13:00:00 line (out of buffer)');
});

test('filterLogFile falls back to error lines when no time range given', async () => {
  const dir = tmpdir();
  const file = path.join(dir, 'big.log');
  const lines = [];
  for (let i = 0; i < 5000; i++) {
    const ts = `2026-04-08 14:${String(Math.floor(i / 60) % 60).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`;
    if (i % 100 === 0) {
      lines.push(`${ts} TBLV0: something failed at iteration ${i} ` + 'x'.repeat(200));
    } else {
      lines.push(`${ts} INFO heartbeat ${i} ` + 'x'.repeat(200));
    }
  }
  fs.writeFileSync(file, lines.join('\n') + '\n');

  const stats = await filterLogFile(file, {
    timeRanges: [],
    minSizeBytes: 1024,
  });

  assert.equal(stats.skipped, false);
  assert.equal(stats.mode, 'error_fallback');
  assert.equal(stats.filteredLines, 50, `filteredLines=${stats.filteredLines}, expected 50`);
});

test('filterLogFile skips files below size threshold', async () => {
  const dir = tmpdir();
  const file = path.join(dir, 'tiny.log');
  fs.writeFileSync(file, '2026-04-08 14:30:00 INFO small file\n');

  const stats = await filterLogFile(file, {
    timeRanges: [{ start: '2026-04-08T14:00:00Z', end: '2026-04-08T15:00:00Z' }],
    minSizeBytes: 1024,
  });
  assert.equal(stats.skipped, true);
  assert.match(stats.skippedReason, /threshold/);
});

test('filterLogFile skips when filtered output would be >90% of original', async () => {
  const dir = tmpdir();
  const file = path.join(dir, 'mostly-in.log');
  const lines = [];
  for (let i = 0; i < 5000; i++) {
    lines.push(`2026-04-08 14:${String(Math.floor(i / 60) % 60).padStart(2, '0')}:${String(i % 60).padStart(2, '0')} INFO msg ` + 'x'.repeat(200));
  }
  fs.writeFileSync(file, lines.join('\n') + '\n');

  // Wide window covers ~all lines
  const stats = await filterLogFile(file, {
    timeRanges: [{ start: '2026-04-08T13:00:00Z', end: '2026-04-08T16:00:00Z' }],
    minSizeBytes: 1024,
  });
  assert.equal(stats.skipped, true);
  assert.match(stats.skippedReason, /90%/);
});

test('filterLogFile reads .gz input and writes plain .filtered.log', async () => {
  const dir = tmpdir();
  const file = path.join(dir, 'compressed.log.gz');
  const lines = [];
  for (let i = 0; i < 5000; i++) {
    const min = String(Math.floor(i / 60) % 60).padStart(2, '0');
    const sec = String(i % 60).padStart(2, '0');
    lines.push(`2026-04-08 14:${min}:${sec} INFO line ${i} ` + 'x'.repeat(200));
  }
  fs.writeFileSync(file, zlib.gzipSync(lines.join('\n') + '\n'));

  const stats = await filterLogFile(file, {
    timeRanges: [{ start: '2026-04-08T14:00:00Z', end: '2026-04-08T14:10:00Z' }],
    minSizeBytes: 1024,
  });
  assert.equal(stats.skipped, false, `skipped: ${stats.skippedReason}`);
  assert.ok(stats.outputPath.endsWith('compressed.filtered.log'), `got ${stats.outputPath}`);
});

test('filterLogFile detects no-timestamp files and skips', async () => {
  const dir = tmpdir();
  const file = path.join(dir, 'binary-ish.log');
  fs.writeFileSync(file, 'just text\n'.repeat(200000));   // ~2MB no timestamps

  const stats = await filterLogFile(file, {
    timeRanges: [{ start: '2026-04-08T14:00:00Z', end: '2026-04-08T15:00:00Z' }],
    minSizeBytes: 1024,
  });
  assert.equal(stats.skipped, true);
  assert.match(stats.skippedReason, /timestamp/);
});

test('filterLogFile keeps multi-line records (continuation lines inherit prior timestamp)', async () => {
  const dir = tmpdir();
  const file = path.join(dir, 'multiline.log');
  const lines = [];
  // Build enough data to clear the size threshold.
  for (let i = 0; i < 2000; i++) {
    const min = String(Math.floor(i / 60) % 60).padStart(2, '0');
    const sec = String(i % 60).padStart(2, '0');
    lines.push(`2026-04-08 14:${min}:${sec} INFO event ${i} ` + 'x'.repeat(500));
  }
  // Inside the window, add a multi-line block.
  lines.push('2026-04-08 14:05:00 ERROR something bad');
  lines.push('  at module.foo (file.js:1)');
  lines.push('  at module.bar (file.js:2)');
  fs.writeFileSync(file, lines.join('\n') + '\n');

  const stats = await filterLogFile(file, {
    timeRanges: [{ start: '2026-04-08T14:00:00Z', end: '2026-04-08T14:10:00Z' }],
    minSizeBytes: 1024,
  });
  assert.equal(stats.skipped, false, `skipped: ${stats.skippedReason}`);
  const out = fs.readFileSync(stats.outputPath, 'utf8');
  assert.ok(out.includes('at module.foo'), 'continuation line should be kept');
  assert.ok(out.includes('at module.bar'), 'continuation line should be kept');
});
