'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const {
  extractAndFilterArchive,
  cleanupExtractedDir,
  isArchive,
  classifyExtractedFile,
  extractCommandFor,
} = require('./archive-extractor');

// Use /tmp/ directly — works on Linux (prod) and on bash-on-Windows where
// os.tmpdir() returns a Windows-style path that GNU tar can't parse.
function tmpdir() {
  fs.mkdirSync('/tmp', { recursive: true });
  return fs.mkdtempSync('/tmp/archtest-');
}

// --- isArchive -------------------------------------------------------------

test('isArchive recognizes telecom archive types', () => {
  assert.ok(isArchive('report.tar.gz'));
  assert.ok(isArchive('foo.tgz'));
  assert.ok(isArchive('foo.tar'));
  assert.ok(isArchive('foo.zip'));
  assert.ok(isArchive('something.tbreport'));
  assert.ok(isArchive('a.TAR.GZ'));
  assert.ok(!isArchive('foo.log'));
  assert.ok(!isArchive('foo.log.gz'));      // single gzipped log, not an archive
  assert.ok(!isArchive('foo.csv'));
  assert.ok(!isArchive('foo.pcap'));
});

test('classifyExtractedFile works for nested files', () => {
  assert.equal(classifyExtractedFile('messages.log'), 'log');
  assert.equal(classifyExtractedFile('cdr.csv'), 'cdr');
  assert.equal(classifyExtractedFile('cap.pcap'), 'pcap');
  assert.equal(classifyExtractedFile('config.cfg'), 'other');
  assert.equal(classifyExtractedFile('logs.log.gz'), 'log');
});

test('extractCommandFor picks tar vs unzip', () => {
  assert.equal(extractCommandFor('/tmp/x.tar.gz').bin, 'tar');
  assert.equal(extractCommandFor('/tmp/x.tgz').bin, 'tar');
  assert.equal(extractCommandFor('/tmp/x.tar').bin, 'tar');
  assert.equal(extractCommandFor('/tmp/x.tbreport').bin, 'tar');
  assert.equal(extractCommandFor('/tmp/x.zip').bin, 'unzip');
});

// --- end-to-end with a real tar.gz -----------------------------------------

function buildSyntheticArchive(workDir) {
  // Build a tar.gz with three files: a big-enough log, a small CSV, and a config.
  const stagingDir = path.join(workDir, 'staging');
  fs.mkdirSync(stagingDir, { recursive: true });

  // big log: ~1.5MB, all timestamps within window
  const logLines = [];
  for (let i = 0; i < 5000; i++) {
    const min = String(Math.floor(i / 60) % 60).padStart(2, '0');
    const sec = String(i % 60).padStart(2, '0');
    logLines.push(`2026-04-24 21:${min}:${sec} INFO call ${i} ` + 'x'.repeat(220));
  }
  fs.writeFileSync(path.join(stagingDir, 'messages.log'), logLines.join('\n') + '\n');

  // a passthrough config
  fs.writeFileSync(path.join(stagingDir, 'gateway.cfg'), 'sip_profile = default\n');

  // CSV (under 100KB threshold so it'll be skipped — that's fine, we test the dispatch)
  fs.writeFileSync(path.join(stagingDir, 'cdr.csv'), 'StartTime,Caller\n2026-04-24 21:00:00,+15145551234\n');

  const archivePath = path.join(workDir, 'report_1777078090_2026-04-24_21h00_2026-04-24_23h59.tar.gz');
  execFileSync('tar', ['czf', archivePath, '-C', stagingDir, '.'], { stdio: 'ignore' });
  return archivePath;
}

// Skipped on Windows: Node's /tmp/ and bash's /tmp/ resolve to different
// physical directories, so a tar.gz built via execFileSync lives somewhere
// extractAndFilterArchive can't read. The wrapper runs on Linux in production
// where this test is the load-bearing e2e check.
const SKIP_LINUX_ONLY = process.platform === 'win32'
  ? 'requires Linux-style /tmp namespace; runs in production CI only'
  : false;

test('extractAndFilterArchive extracts tar.gz and filters child log', { skip: SKIP_LINUX_ONLY }, async () => {
  const work = tmpdir();
  const archivePath = buildSyntheticArchive(work);
  const ticketNumber = 'TBT-TEST-' + Date.now();
  const extractRoot = path.posix.join(work, 'preprocess');

  const report = await extractAndFilterArchive(archivePath, {
    ticketNumber,
    extractRoot,
    extractedContext: {
      timeRanges: [{ start: '2026-04-24T21:30:00Z', end: '2026-04-24T21:35:00Z' }],
    },
  });

  assert.equal(report.kind, 'archive');
  assert.equal(report.skipped, false, `skipped: ${report.skippedReason}`);
  assert.ok(report.totalExtractedFiles >= 3, `extractedFiles=${report.totalExtractedFiles}`);

  // Locate the log child report
  const logChild = report.childReports.find((c) => c.kind === 'log');
  assert.ok(logChild, 'no log child found');
  assert.equal(logChild.skipped, false, `log skipped: ${logChild.skippedReason}`);
  assert.ok(logChild.outputPath, 'log child should have outputPath');
  assert.ok(logChild.outputPath.endsWith('messages.filtered.log'), `outputPath=${logChild.outputPath}`);

  // Config file should be present as 'other' pass-through
  const cfgChild = report.childReports.find((c) => c.filePath.endsWith('gateway.cfg'));
  assert.ok(cfgChild, 'config child missing');
  assert.equal(cfgChild.kind, 'other');
  assert.equal(cfgChild.skipped, true);

  // Filtered log file actually exists on disk
  assert.ok(fs.existsSync(logChild.outputPath), 'filtered file not on disk');

  // Cleanup leaves no /tmp/preprocess-* dirs behind
  cleanupExtractedDir(ticketNumber, extractRoot);
  assert.ok(!fs.existsSync(extractRoot), 'cleanup did not remove extract root');
});

test('extractAndFilterArchive handles missing archive gracefully', async () => {
  const report = await extractAndFilterArchive('/nonexistent/path/file.tar.gz', {
    ticketNumber: 'TBT-NOPE',
    extractRoot: path.join(tmpdir(), 'pp'),
  });
  assert.equal(report.skipped, true);
  assert.match(report.skippedReason, /stat failed/);
});

test('extractAndFilterArchive aborts on extraction failure', async () => {
  // Write a non-archive file with .tar.gz extension. tar will fail.
  const work = tmpdir();
  const fake = path.join(work, 'fake.tar.gz');
  fs.writeFileSync(fake, 'this is not actually an archive\n');

  const report = await extractAndFilterArchive(fake, {
    ticketNumber: 'TBT-FAKE',
    extractRoot: path.join(work, 'pp'),
  });
  assert.equal(report.skipped, true);
  assert.match(report.skippedReason, /extraction failed/);
});

test('cleanupExtractedDir is idempotent and safe on missing dirs', () => {
  // Should not throw
  cleanupExtractedDir('TBT-NEVER-EXISTED');
  cleanupExtractedDir('TBT-AGAIN', '/tmp/definitely-not-here-' + Date.now());
});
