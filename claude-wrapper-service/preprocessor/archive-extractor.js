/**
 * Phase 6 — Archive-aware Preprocessor
 *
 * Telecom tickets typically arrive as .tar.gz / .tbreport / .zip archives
 * containing logs, CDR exports, configs and pcap captures. The base pipeline
 * (Phase 2-4) only sees the archive as a single opaque file and skips it.
 *
 * This module:
 *   1. Extracts the archive to a sandboxed dir under /tmp/preprocess-<ticket>/
 *   2. Walks the extracted tree
 *   3. Runs the appropriate per-file filter (log / cdr / pcap)
 *   4. Returns a structured report so the digest can list filtered children
 *
 * Strategy: NO re-packaging. The extracted+filtered files sit on disk; the
 * digest tells Claude their absolute paths so it reads them directly without
 * its own `tar xzf` step. server.js Step 5 cleans up /tmp/preprocess-* after
 * Claude finishes.
 *
 * Security:
 *   - archives are pre-validated by server.js Step 1.5 (validateArchive /
 *     validateZipArchive) so path traversal can't escape the sandbox dir
 *   - hard caps on extracted size + file count to prevent zip bombs
 *   - tar/unzip are invoked via execFile (no shell), with timeouts
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const { filterLogFile } = require('./log-filter');
const { filterCdrFile } = require('./cdr-filter');
const { filterPcapFile } = require('./pcap-filter');

const DEFAULT_MAX_EXTRACTED_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB
const DEFAULT_MAX_FILES = 10000;
const DEFAULT_EXTRACT_TIMEOUT_MS = 5 * 60 * 1000; // 5 min

// --- Helpers ---------------------------------------------------------------

function classifyExtractedFile(filename) {
  const lower = filename.toLowerCase();
  if (/\.log(\.gz)?$/.test(lower) || /\.txt$/.test(lower)) return 'log';
  if (/\.csv$/.test(lower)) return 'cdr';
  if (/\.pcap(ng)?$/.test(lower)) return 'pcap';
  return 'other';
}

function isArchive(filename) {
  const lower = filename.toLowerCase();
  return /\.(tar\.gz|tgz|tar|zip)$/.test(lower) || lower.endsWith('.tbreport');
}

function extractCommandFor(archivePath) {
  const lower = archivePath.toLowerCase();
  if (lower.endsWith('.zip')) {
    return { bin: 'unzip', args: ['-q', '-o', archivePath, '-d'] };
  }
  // tar handles .tar, .tar.gz, .tgz, .tbreport (which are gzipped tar)
  // -x extract, -f file, -p preserve perms, -C target dir.
  // Don't use -z explicitly so tar auto-detects gzip vs plain tar.
  return { bin: 'tar', args: ['xf', archivePath, '-C'] };
}

function execFileP(bin, args, options) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, options, (err, stdout, stderr) => {
      if (err) {
        const e = new Error(`${bin} failed: ${err.message} | stderr: ${stderr || '(empty)'}`);
        e.cause = err;
        return reject(e);
      }
      resolve({ stdout, stderr });
    });
  });
}

function* walkSync(dir, opts = {}) {
  const stack = [dir];
  let count = 0;
  let bytes = 0;
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); }
    catch { continue; }
    for (const ent of entries) {
      const full = path.join(current, ent.name);
      // Don't follow symlinks — they could escape the sandbox.
      if (ent.isSymbolicLink()) continue;
      if (ent.isDirectory()) { stack.push(full); continue; }
      if (!ent.isFile()) continue;
      let st;
      try { st = fs.statSync(full); } catch { continue; }
      count++;
      bytes += st.size;
      if (opts.maxFiles && count > opts.maxFiles) {
        return { aborted: true, reason: `>${opts.maxFiles} files` };
      }
      if (opts.maxBytes && bytes > opts.maxBytes) {
        return { aborted: true, reason: `>${opts.maxBytes} bytes extracted` };
      }
      yield { path: full, size: st.size };
    }
  }
}

async function processChildFile(filePath, ctx) {
  const kind = classifyExtractedFile(filePath);
  let stat;
  try { stat = fs.statSync(filePath); }
  catch (e) {
    return { kind: 'other', filePath, originalBytes: 0, skipped: true, skippedReason: `stat failed: ${e.message}` };
  }

  try {
    if (kind === 'log') {
      const r = await filterLogFile(filePath, { timeRanges: ctx.timeRanges || [] });
      return {
        kind: 'log', filePath,
        originalBytes: r.originalBytes, filteredBytes: r.filteredBytes,
        mode: r.mode, outputPath: r.outputPath,
        skipped: r.skipped, skippedReason: r.skippedReason,
      };
    }
    if (kind === 'cdr') {
      const r = await filterCdrFile(filePath, {
        timeRanges: ctx.timeRanges || [],
        phoneNumbers: ctx.phoneNumbers || [],
      });
      return {
        kind: 'cdr', filePath,
        originalBytes: r.originalBytes, filteredBytes: r.filteredBytes,
        originalRows: r.originalRows, filteredRows: r.filteredRows,
        successCount: r.successCount, failureCount: r.failureCount,
        outputPath: r.outputPath,
        skipped: r.skipped, skippedReason: r.skippedReason,
      };
    }
    if (kind === 'pcap') {
      const r = await filterPcapFile(filePath, {
        ipAddresses: ctx.ipAddresses || [],
        sipCallIds: ctx.sipCallIds || [],
        timeRanges: ctx.timeRanges || [],
      });
      return {
        kind: 'pcap', filePath,
        originalBytes: r.originalBytes, filteredBytes: r.filteredBytes,
        displayFilter: r.displayFilter, outputPath: r.outputPath,
        skipped: r.skipped, skippedReason: r.skippedReason,
      };
    }
    return {
      kind: 'other', filePath,
      originalBytes: stat.size,
      skipped: true, skippedReason: 'pass-through inside archive (config/other)',
    };
  } catch (e) {
    return {
      kind, filePath, originalBytes: stat.size,
      skipped: true, skippedReason: `child preprocessing error: ${e.message}`,
    };
  }
}

// --- Main ------------------------------------------------------------------

/**
 * @param {string} archivePath  absolute path to the archive on disk
 * @param {object} options
 * @param {string} options.ticketNumber
 * @param {object} options.extractedContext  ExtractedContext from Stage 1
 * @param {string} [options.extractRoot=/tmp/preprocess-<ticket>]
 * @param {number} [options.maxExtractedBytes]
 * @param {number} [options.maxFiles]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<object>} archive report (see shape below)
 */
async function extractAndFilterArchive(archivePath, options = {}) {
  const ticketNumber = options.ticketNumber || 'unknown';
  const extractRoot = options.extractRoot || `/tmp/preprocess-${ticketNumber}`;
  const maxBytes = options.maxExtractedBytes ?? DEFAULT_MAX_EXTRACTED_BYTES;
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_EXTRACT_TIMEOUT_MS;
  const ctx = options.extractedContext || {};

  let stat;
  try { stat = fs.statSync(archivePath); }
  catch (e) {
    return {
      kind: 'archive', filePath: archivePath, originalBytes: 0,
      skipped: true, skippedReason: `stat failed: ${e.message}`,
    };
  }

  // Per-archive subdir keeps multiple archives in one ticket separated.
  // Use posix.join because the path is fed to bash tar/unzip on the Linux
  // wrapper host — Node's default path.join would emit backslashes when
  // tests run on a Windows dev box and break the shell-out.
  const archiveBase = path.basename(archivePath).replace(/\.(tar\.gz|tgz|tar|zip|tbreport)$/i, '');
  const extractDir = path.posix.join(extractRoot, archiveBase);

  const report = {
    kind: 'archive',
    filePath: archivePath,
    originalBytes: stat.size,
    extractedAt: extractDir,
    totalExtractedBytes: 0,
    totalExtractedFiles: 0,
    childReports: [],
    filteredBytes: 0,
    skipped: false,
    skippedReason: null,
  };

  try { fs.mkdirSync(extractDir, { recursive: true }); }
  catch (e) {
    report.skipped = true;
    report.skippedReason = `mkdir failed: ${e.message}`;
    return report;
  }

  const { bin, args } = extractCommandFor(archivePath);
  try {
    await execFileP(bin, [...args, extractDir], { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 });
  } catch (e) {
    report.skipped = true;
    report.skippedReason = `extraction failed: ${e.message}`;
    return report;
  }

  // Walk and process each file. The walker enforces the size/count cap.
  const walker = walkSync(extractDir, { maxBytes, maxFiles });
  let aborted = null;
  for (;;) {
    const next = walker.next();
    if (next.done) {
      // The generator's return value (when it returns non-undefined) appears
      // here. Our walker yields `{path,size}` but uses `return` for aborts.
      if (next.value && next.value.aborted) aborted = next.value.reason;
      break;
    }
    const entry = next.value;
    report.totalExtractedFiles++;
    report.totalExtractedBytes += entry.size;
    const childReport = await processChildFile(entry.path, ctx);
    report.childReports.push(childReport);
    if (childReport.outputPath) report.filteredBytes += (childReport.filteredBytes || 0);
  }

  if (aborted) {
    report.skipped = true;
    report.skippedReason = `extraction aborted: ${aborted}`;
    return report;
  }

  if (report.totalExtractedFiles === 0) {
    report.skipped = true;
    report.skippedReason = 'archive contained no readable files';
  }

  return report;
}

/**
 * Best-effort cleanup of /tmp/preprocess-<ticket>. Safe to call even if the
 * dir doesn't exist.
 */
function cleanupExtractedDir(ticketNumber, extractRoot) {
  const target = extractRoot || `/tmp/preprocess-${ticketNumber}`;
  try {
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
    }
  } catch {
    // ignore — cleanup is best-effort
  }
}

module.exports = {
  extractAndFilterArchive,
  cleanupExtractedDir,
  isArchive,
  classifyExtractedFile,
  // Internals exposed for tests
  extractCommandFor,
};
