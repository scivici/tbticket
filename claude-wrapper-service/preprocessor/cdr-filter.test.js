'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  filterCdrFile,
  parseCsvLine,
  detectDelimiter,
  findColumn,
  normalizePhone,
  parseRowTime,
} = require('./cdr-filter');

function tmpdir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'cdrfilter-')); }

// --- helpers ---------------------------------------------------------------

test('parseCsvLine handles quoted fields with embedded comma', () => {
  assert.deepEqual(parseCsvLine('a,"b,c",d', ','), ['a', 'b,c', 'd']);
});

test('parseCsvLine handles "" escape', () => {
  assert.deepEqual(parseCsvLine('a,"b""c",d', ','), ['a', 'b"c', 'd']);
});

test('detectDelimiter picks the most frequent', () => {
  assert.equal(detectDelimiter('a;b;c;d'), ';');
  assert.equal(detectDelimiter('a\tb\tc\td'), '\t');
  assert.equal(detectDelimiter('a,b,c,d'), ',');
});

test('findColumn matches by substring (case insensitive)', () => {
  const headers = ['CallStartTime', 'CallerNumber', 'CalledNumber', 'Disposition'];
  assert.equal(findColumn(headers, ['time']), 0);
  assert.equal(findColumn(headers, ['caller']), 1);
  assert.equal(findColumn(headers, ['called']), 2);
  assert.equal(findColumn(headers, ['disposition']), 3);
  assert.equal(findColumn(headers, ['nope']), -1);
});

test('normalizePhone strips formatting and leading 1', () => {
  assert.equal(normalizePhone('+1 (514) 555-1234'), '5145551234');
  assert.equal(normalizePhone('15145551234'), '5145551234');
  assert.equal(normalizePhone('5145551234'), '5145551234');
  assert.equal(normalizePhone('+33123456789'), '33123456789');
});

test('parseRowTime handles ISO, SQL, US, epoch formats', () => {
  assert.equal(parseRowTime('2026-04-08 14:30:15'), Date.UTC(2026, 3, 8, 14, 30, 15));
  assert.equal(parseRowTime('2026-04-08T14:30:15Z'), Date.UTC(2026, 3, 8, 14, 30, 15));
  assert.equal(parseRowTime('04/08/2026 14:30:15'), Date.UTC(2026, 3, 8, 14, 30, 15));
  assert.equal(parseRowTime('1712587815'), 1712587815 * 1000);
});

// --- end-to-end filtering --------------------------------------------------

test('filterCdrFile keeps rows in time window and matching phone', async () => {
  const dir = tmpdir();
  const file = path.join(dir, 'cdr.csv');
  const lines = [
    'StartTime,CallerNumber,CalledNumber,Disposition',
  ];
  for (let i = 0; i < 5000; i++) {
    const min = String(Math.floor(i / 60) % 60).padStart(2, '0');
    const sec = String(i % 60).padStart(2, '0');
    const caller = i % 10 === 0 ? '+15145551234' : `+1438555${String(i).padStart(4, '0').slice(0, 4)}`;
    lines.push(`2026-04-08 14:${min}:${sec},${caller},+15149999999,200 OK`);
  }
  fs.writeFileSync(file, lines.join('\n') + '\n');

  const stats = await filterCdrFile(file, {
    timeRanges: [{ start: '2026-04-08T14:05:00Z', end: '2026-04-08T14:10:00Z' }],
    phoneNumbers: ['+15145551234'],
    bufferMinutes: 0,
    minSizeBytes: 1024,
  });

  assert.equal(stats.skipped, false, `skipped: ${stats.skippedReason}`);
  assert.ok(stats.filteredRows > 0, 'should match some rows');
  assert.ok(stats.outputPath.endsWith('cdr.filtered.csv'), `outputPath=${stats.outputPath}`);
  assert.ok(stats.successCount > 0, 'should classify some as success');

  const content = fs.readFileSync(stats.outputPath, 'utf8');
  // Header preserved
  assert.ok(content.startsWith('StartTime,'), 'header missing');
});

test('filterCdrFile detects status column and counts failures', async () => {
  const dir = tmpdir();
  const file = path.join(dir, 'cdr.csv');
  const lines = ['StartTime,Caller,Called,Result'];
  for (let i = 0; i < 200; i++) {
    const min = String(Math.floor(i / 60) % 60).padStart(2, '0');
    const sec = String(i % 60).padStart(2, '0');
    const status = i % 3 === 0 ? '503 Service Unavailable' : '200 OK';
    lines.push(`2026-04-08 14:${min}:${sec},+15145551234,+15149999999,${status}`);
  }
  // Pad to clear 100KB threshold
  while (lines.join('\n').length < 110 * 1024) {
    const i = lines.length;
    const min = String(Math.floor(i / 60) % 60).padStart(2, '0');
    const sec = String(i % 60).padStart(2, '0');
    lines.push(`2026-04-08 14:${min}:${sec},+15145551234,+15149999999,200 OK ` + 'x'.repeat(100));
  }
  fs.writeFileSync(file, lines.join('\n') + '\n');

  const stats = await filterCdrFile(file, {
    timeRanges: [{ start: '2026-04-08T13:00:00Z', end: '2026-04-08T16:00:00Z' }],
    bufferMinutes: 0,
    minSizeBytes: 1024,
  });

  assert.equal(stats.skipped, false);
  assert.ok(stats.failureCount > 0, `failureCount=${stats.failureCount}`);
  assert.ok(stats.successCount > 0, `successCount=${stats.successCount}`);
});

test('filterCdrFile skips when no filters provided', async () => {
  const dir = tmpdir();
  const file = path.join(dir, 'cdr.csv');
  fs.writeFileSync(file, 'StartTime,Caller\n2026-04-08 14:00:00,+1\n'.repeat(10000));

  const stats = await filterCdrFile(file, {
    timeRanges: [],
    phoneNumbers: [],
    minSizeBytes: 1024,
  });
  assert.equal(stats.skipped, true);
  assert.match(stats.skippedReason, /no.+filter/);
});

test('filterCdrFile skips small files', async () => {
  const dir = tmpdir();
  const file = path.join(dir, 'tiny.csv');
  fs.writeFileSync(file, 'a,b\n1,2\n');

  const stats = await filterCdrFile(file, {
    timeRanges: [{ start: '2026-04-08T14:00:00Z', end: '2026-04-08T15:00:00Z' }],
    minSizeBytes: 1024,
  });
  assert.equal(stats.skipped, true);
  assert.match(stats.skippedReason, /threshold/);
});
