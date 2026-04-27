/**
 * Preprocessor Orchestrator
 *
 * Runs Stage 2 (filtering) and Stage 3 (digest) for a ticket directory.
 * The TS server is responsible for Stage 1 (context extraction); the result
 * is passed in as `extractedContext`.
 *
 * Public entry point:
 *   await runPreprocessor({
 *     ticketNumber, ticketDir, files, extractedContext
 *   }) → { fileReports, digestPath, totals }
 *
 * Best-effort: per-file failures are logged and the file is treated as
 * skipped, so a single bad file doesn't blow up the analysis.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { filterLogFile } = require('./log-filter');
const { filterCdrFile } = require('./cdr-filter');
const { filterPcapFile } = require('./pcap-filter');
const { renderDigestMarkdown, scanLogStats } = require('./digest');

function classifyFile(filename) {
  const lower = filename.toLowerCase();
  if (/\.log(\.gz)?$/.test(lower) || /\.txt$/.test(lower)) return 'log';
  if (/\.csv$/.test(lower)) return 'cdr';
  if (/\.pcap(ng)?$/.test(lower)) return 'pcap';
  return 'other';
}

async function processOne(filePath, extractedContext) {
  const kind = classifyFile(filePath);
  const ctx = extractedContext || {};
  let stat;
  try { stat = fs.statSync(filePath); }
  catch (e) {
    return { kind: 'other', filePath, originalBytes: 0, skipped: true, skippedReason: `stat failed: ${e.message}` };
  }

  try {
    if (kind === 'log') {
      const r = await filterLogFile(filePath, { timeRanges: ctx.timeRanges || [] });
      const report = {
        kind: 'log',
        filePath,
        originalBytes: r.originalBytes,
        filteredBytes: r.filteredBytes,
        mode: r.mode,
        outputPath: r.outputPath,
        skipped: r.skipped,
        skippedReason: r.skippedReason,
      };
      // Run a stats pass on whichever file Claude will actually read.
      const scanTarget = r.outputPath || filePath;
      try {
        report.stats = await scanLogStats(scanTarget);
      } catch (e) {
        report.stats = null;
        report.statsError = e.message;
      }
      return report;
    }

    if (kind === 'cdr') {
      const r = await filterCdrFile(filePath, {
        timeRanges: ctx.timeRanges || [],
        phoneNumbers: ctx.phoneNumbers || [],
      });
      return {
        kind: 'cdr',
        filePath,
        originalBytes: r.originalBytes,
        filteredBytes: r.filteredBytes,
        originalRows: r.originalRows,
        filteredRows: r.filteredRows,
        successCount: r.successCount,
        failureCount: r.failureCount,
        outputPath: r.outputPath,
        skipped: r.skipped,
        skippedReason: r.skippedReason,
      };
    }

    if (kind === 'pcap') {
      const r = await filterPcapFile(filePath, {
        ipAddresses: ctx.ipAddresses || [],
        sipCallIds: ctx.sipCallIds || [],
        timeRanges: ctx.timeRanges || [],
      });
      return {
        kind: 'pcap',
        filePath,
        originalBytes: r.originalBytes,
        filteredBytes: r.filteredBytes,
        displayFilter: r.displayFilter,
        outputPath: r.outputPath,
        skipped: r.skipped,
        skippedReason: r.skippedReason,
      };
    }

    return { kind: 'other', filePath, originalBytes: stat.size, skipped: true, skippedReason: 'pass-through (config/other)' };
  } catch (e) {
    return {
      kind,
      filePath,
      originalBytes: stat.size,
      skipped: true,
      skippedReason: `preprocessing error: ${e.message}`,
    };
  }
}

/**
 * @param {object} input
 * @param {string} input.ticketNumber
 * @param {string} input.ticketDir
 * @param {string[]} input.files                 filenames inside ticketDir to process
 * @param {object} [input.extractedContext]      ExtractedContext from Stage 1
 * @returns {Promise<{fileReports: object[], digestPath: string, totals: object}>}
 */
async function runPreprocessor({ ticketNumber, ticketDir, files, extractedContext }) {
  const fileReports = [];
  for (const filename of files || []) {
    const fp = path.join(ticketDir, filename);
    const report = await processOne(fp, extractedContext || {});
    fileReports.push(report);
  }

  const totals = fileReports.reduce(
    (acc, r) => {
      acc.originalBytes += r.originalBytes || 0;
      acc.filteredBytes += r.filteredBytes || 0;
      if (!r.skipped && r.outputPath) acc.filteredCount += 1;
      else acc.skippedCount += 1;
      return acc;
    },
    { originalBytes: 0, filteredBytes: 0, filteredCount: 0, skippedCount: 0 }
  );

  const digestMd = renderDigestMarkdown({
    ticketNumber,
    extractedContext: extractedContext || {},
    fileReports,
  });
  const digestPath = path.join(ticketDir, '_file_digest.md');
  fs.writeFileSync(digestPath, digestMd);

  return { fileReports, digestPath, totals };
}

module.exports = { runPreprocessor, processOne, classifyFile };
