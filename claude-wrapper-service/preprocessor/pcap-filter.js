/**
 * Phase 4 — PCAP Filter (tshark wrapper)
 *
 * Builds a tshark display filter from the extracted context (IPs, time range,
 * SIP Call-IDs) and produces a trimmed .pcap. If tshark is not installed, the
 * function logs a warning and returns a "skipped" result so the pipeline
 * still moves forward — Claude can read the original capture instead.
 *
 * Cannot be exercised end-to-end without a tshark binary and a real .pcap
 * file. The filter-string builder is unit-tested in isolation.
 */

'use strict';

const { execFile, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEFAULT_MIN_SIZE_BYTES = 1024 * 1024; // 1 MB

let tsharkAvailableCache = null;

function isTsharkAvailable() {
  if (tsharkAvailableCache !== null) return tsharkAvailableCache;
  try {
    execFileSync('tshark', ['-v'], { stdio: 'ignore', timeout: 5000 });
    tsharkAvailableCache = true;
  } catch {
    tsharkAvailableCache = false;
  }
  return tsharkAvailableCache;
}

/**
 * Build a tshark display filter expression from the extracted context.
 * Components are AND-ed together; multiple values within a component are OR-ed.
 * Returns null if there's nothing to filter on.
 *
 * @param {object} ctx
 * @param {string[]} [ctx.ipAddresses]
 * @param {string[]} [ctx.sipCallIds]
 * @param {Array<{start:string,end:string}>} [ctx.timeRanges]
 * @param {number} [ctx.bufferMinutes=15]
 */
function buildDisplayFilter(ctx) {
  const parts = [];
  const bufferMs = (ctx.bufferMinutes ?? 15) * 60 * 1000;

  if (ctx.ipAddresses && ctx.ipAddresses.length > 0) {
    const ipPart = ctx.ipAddresses.map((ip) => `ip.addr == ${ip}`).join(' || ');
    parts.push(`(${ipPart})`);
  }

  if (ctx.sipCallIds && ctx.sipCallIds.length > 0) {
    // SIP Call-ID values can contain @, hyphens, etc. tshark accepts a quoted
    // string; double-quotes inside the value would break it, so we strip them.
    const callIdPart = ctx.sipCallIds
      .map((id) => `sip.Call-ID == "${String(id).replace(/"/g, '')}"`)
      .join(' || ');
    parts.push(`(${callIdPart})`);
  }

  if (ctx.timeRanges && ctx.timeRanges.length > 0) {
    const timePart = ctx.timeRanges
      .map((tr) => {
        const start = new Date(new Date(tr.start).getTime() - bufferMs);
        const end = new Date(new Date(tr.end).getTime() + bufferMs);
        const fmt = (d) =>
          d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
        return `(frame.time >= "${fmt(start)}" && frame.time <= "${fmt(end)}")`;
      })
      .join(' || ');
    parts.push(`(${timePart})`);
  }

  if (parts.length === 0) return null;
  return parts.join(' && ');
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

/**
 * Run tshark to filter a single pcap.
 * @param {string} filePath
 * @param {object} options  same shape as buildDisplayFilter ctx, plus minSizeBytes
 * @returns {Promise<object>}
 */
async function filterPcapFile(filePath, options = {}) {
  const minSize = options.minSizeBytes ?? DEFAULT_MIN_SIZE_BYTES;
  const stat = fs.statSync(filePath);
  const result = {
    file: filePath,
    skipped: false,
    skippedReason: null,
    originalBytes: stat.size,
    filteredBytes: 0,
    displayFilter: null,
    outputPath: null,
  };

  if (stat.size < minSize) {
    result.skipped = true;
    result.skippedReason = `below ${minSize}-byte threshold`;
    return result;
  }

  const filter = buildDisplayFilter(options);
  if (!filter) {
    result.skipped = true;
    result.skippedReason = 'no IPs / Call-IDs / time ranges to filter on';
    return result;
  }
  result.displayFilter = filter;

  if (!isTsharkAvailable()) {
    result.skipped = true;
    result.skippedReason = 'tshark binary not found in PATH';
    return result;
  }

  const outputPath = makeFilteredOutputPath(filePath);
  await new Promise((resolve, reject) => {
    execFile(
      'tshark',
      ['-r', filePath, '-Y', filter, '-w', outputPath],
      { timeout: 5 * 60 * 1000, maxBuffer: 16 * 1024 * 1024 },
      (err, _stdout, stderr) => {
        if (err) return reject(new Error(`tshark failed: ${err.message} | stderr: ${stderr}`));
        resolve();
      }
    );
  });

  if (!fs.existsSync(outputPath)) {
    result.skipped = true;
    result.skippedReason = 'tshark produced no output file';
    return result;
  }

  result.filteredBytes = fs.statSync(outputPath).size;

  // Same safety net as log filter — if filter retained almost everything, drop it.
  if (result.filteredBytes > result.originalBytes * 0.9) {
    fs.unlinkSync(outputPath);
    result.skipped = true;
    result.skippedReason = 'filter retained >90% of original bytes; not worth a duplicate file';
    return result;
  }

  result.outputPath = outputPath;
  return result;
}

module.exports = {
  filterPcapFile,
  buildDisplayFilter,
  isTsharkAvailable,
  makeFilteredOutputPath,
  // For test injection
  _resetTsharkCache: () => { tsharkAvailableCache = null; },
};
