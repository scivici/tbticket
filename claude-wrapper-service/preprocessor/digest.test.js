'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { renderDigestMarkdown, scanLogStats, bytesHuman, reductionPct } = require('./digest');

function tmpdir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'digest-')); }

test('bytesHuman renders KB/MB/GB', () => {
  assert.equal(bytesHuman(0), '0 B');
  assert.equal(bytesHuman(1024), '1.0 KB');
  assert.equal(bytesHuman(1024 * 1024), '1.0 MB');
  assert.equal(bytesHuman(2 * 1024 ** 3), '2.00 GB');
});

test('reductionPct caps at 0 for non-shrinking outputs', () => {
  assert.equal(reductionPct(0, 0), 0);
  assert.equal(reductionPct(100, 100), 0);
  assert.equal(reductionPct(100, 200), 0);
  assert.equal(reductionPct(100, 10), 90);
});

test('scanLogStats counts errors/warnings and top messages', async () => {
  const dir = tmpdir();
  const file = path.join(dir, 'sample.log');
  const lines = [];
  for (let i = 0; i < 200; i++) {
    if (i % 5 === 0) lines.push(`2026-04-08 14:30:${i % 60} TBLV0: SIP 503 Service Unavailable`);
    else if (i % 7 === 0) lines.push(`2026-04-08 14:30:${i % 60} TBLV1: retrying`);
    else lines.push(`2026-04-08 14:30:${i % 60} INFO heartbeat`);
  }
  fs.writeFileSync(file, lines.join('\n') + '\n');

  const stats = await scanLogStats(file);
  assert.equal(stats.errorLines, 40, `errors=${stats.errorLines}`);
  assert.ok(stats.warnLines > 0, `warns=${stats.warnLines}`);
  assert.ok(stats.topMessages.length > 0);
  assert.match(stats.topMessages[0].msg, /503/);
});

test('renderDigestMarkdown includes context, file blocks, and filtered/original paths', () => {
  const md = renderDigestMarkdown({
    ticketNumber: 'TKT-2026-0099',
    extractedContext: {
      timeRanges: [{ start: '2026-04-08T14:30:00.000Z', end: '2026-04-08T15:45:00.000Z', kind: 'range', confidence: 'high' }],
      ipAddresses: ['10.0.1.50'],
      phoneNumbers: ['+15145551234'],
      errorCodes: [{ code: '503', description: 'Service Unavailable', protocol: 'sip' }],
      errorKeywords: ['one-way audio'],
      sipCallIds: ['abc@host'],
      affectedServices: ['outbound', 'media'],
      frequency: 'intermittent',
    },
    fileReports: [
      {
        kind: 'log',
        filePath: '/tmp/tkt/big.log',
        originalBytes: 487 * 1024 * 1024,
        filteredBytes: 2.8 * 1024 * 1024,
        outputPath: '/tmp/tkt/big.filtered.log',
        mode: 'time_window',
        stats: { errorLines: 47, warnLines: 128, topMessages: [{ msg: 'SIP 503 Service Unavailable', count: 31 }] },
      },
      {
        kind: 'cdr',
        filePath: '/tmp/tkt/cdr.csv',
        originalBytes: 2 * 1024 * 1024,
        filteredBytes: 100 * 1024,
        outputPath: '/tmp/tkt/cdr.filtered.csv',
        originalRows: 8432,
        filteredRows: 156,
        successCount: 122,
        failureCount: 34,
      },
      {
        kind: 'pcap',
        filePath: '/tmp/tkt/cap.pcap',
        originalBytes: 100 * 1024 * 1024,
        skipped: true,
        skippedReason: 'tshark binary not found in PATH',
      },
      {
        kind: 'other',
        filePath: '/tmp/tkt/config.cfg',
        originalBytes: 4096,
        skipped: true,
        skippedReason: 'config file — passed through',
      },
    ],
  });

  assert.match(md, /TKT-2026-0099/);
  assert.match(md, /Time references/);
  assert.match(md, /10\.0\.1\.50/);
  assert.match(md, /503 Service Unavailable/);
  assert.match(md, /big\.filtered\.log/);
  assert.match(md, /Errors in window:\*\* 47/);
  assert.match(md, /78\.2%|78\.20%/);  // 122/156 = 78.2%
  assert.match(md, /tshark binary not found/);
});

test('renderDigestMarkdown handles empty file list', () => {
  const md = renderDigestMarkdown({
    ticketNumber: 'TKT-EMPTY',
    extractedContext: {},
    fileReports: [],
  });
  assert.match(md, /No files attached/);
});
