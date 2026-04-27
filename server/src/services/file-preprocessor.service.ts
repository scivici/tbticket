/**
 * File Preprocessor — Stage 1: Context Extraction
 *
 * Parses customer subject + description + questionnaire answers using regex
 * patterns to extract structured context (time ranges, IPs, phones, error
 * codes, SIP Call-IDs, frequency, affected services) before the ticket is
 * sent to Claude for analysis.
 *
 * Pure functions, no AI, no I/O. Deterministic so the same input always
 * produces the same extraction.
 *
 * See: docs/proposal-ai-preprocessing-pipeline.md (Stage 1)
 */

export interface ExtractedTimeRange {
  start: string;   // ISO 8601 (UTC)
  end: string;     // ISO 8601 (UTC) — equals start for a single moment
  raw: string;     // verbatim text that matched
  kind: 'range' | 'moment';
  confidence: 'high' | 'medium' | 'low';
}

export interface ExtractedErrorCode {
  code: string;        // e.g. "503"
  protocol: 'sip' | 'http' | 'unknown';
  description: string; // e.g. "Service Unavailable"
}

export type FrequencyHint = 'one_time' | 'intermittent' | 'continuous' | 'unknown';

export interface ExtractedContext {
  timeRanges: ExtractedTimeRange[];
  ipAddresses: string[];          // unique, IPv4
  phoneNumbers: string[];         // unique, E.164-normalized when possible
  errorCodes: ExtractedErrorCode[];
  errorKeywords: string[];        // unique, lowercase
  sipCallIds: string[];           // unique
  frequency: FrequencyHint;
  affectedServices: string[];     // unique, lowercase tags
  meta: {
    inputLength: number;
    extractedAt: string;
    patternsHit: string[];        // for telemetry
    referenceDate: string | null; // when relative time resolution was used
  };
}

export interface ExtractInput {
  subject?: string;
  description?: string;
  answers?: { question: string; answer: string }[];
  /**
   * Attachment filenames. Telecom report archives often encode the incident
   * window directly in the filename (e.g. report_..._2026-04-24_21h00_2026-04-24_23h59.tar.gz),
   * which is a more reliable signal than free-text descriptions.
   */
  filenames?: string[];
  /** Anchor for resolving relative phrases like "yesterday". Defaults to now. */
  referenceDate?: Date;
}

// --- SIP / HTTP status code lookup -----------------------------------------

const SIP_STATUS_CODES: Record<string, string> = {
  // Common 4xx
  '400': 'Bad Request',
  '401': 'Unauthorized',
  '403': 'Forbidden',
  '404': 'Not Found',
  '405': 'Method Not Allowed',
  '407': 'Proxy Authentication Required',
  '408': 'Request Timeout',
  '480': 'Temporarily Unavailable',
  '481': 'Call/Transaction Does Not Exist',
  '482': 'Loop Detected',
  '483': 'Too Many Hops',
  '484': 'Address Incomplete',
  '485': 'Ambiguous',
  '486': 'Busy Here',
  '487': 'Request Terminated',
  '488': 'Not Acceptable Here',
  '491': 'Request Pending',
  '493': 'Undecipherable',
  // 5xx
  '500': 'Server Internal Error',
  '501': 'Not Implemented',
  '502': 'Bad Gateway',
  '503': 'Service Unavailable',
  '504': 'Server Time-out',
  '505': 'Version Not Supported',
  '513': 'Message Too Large',
  // 6xx
  '600': 'Busy Everywhere',
  '603': 'Decline',
  '604': 'Does Not Exist Anywhere',
  '606': 'Not Acceptable',
};

// --- Telecom-specific error keyword vocabulary -----------------------------

const ERROR_KEYWORDS = [
  'no audio',
  'one-way audio',
  'one way audio',
  'choppy audio',
  'audio drop',
  'silence',
  'echo',
  'distortion',
  'call drop',
  'call drops',
  'dropped call',
  'disconnect',
  'disconnects',
  'reset',
  'crash',
  'reboot',
  'timeout',
  'timed out',
  'tls handshake failed',
  'rtp timeout',
  'registration failed',
  'registration loop',
  'fast busy',
  'no ring',
  'no ringback',
  'cannot transfer',
  'dtmf failure',
  'codec mismatch',
  'ptime mismatch',
  'license expired',
];

const AFFECTED_SERVICE_PATTERNS: { tag: string; rx: RegExp }[] = [
  { tag: 'outbound', rx: /\boutbound\b|\boutgoing\b/i },
  { tag: 'inbound', rx: /\binbound\b|\bincoming\b/i },
  { tag: 'registration', rx: /\bregistrat\w+\b|\bre-?register\b/i },
  { tag: 'media', rx: /\b(rtp|media|audio)\b/i },
  { tag: 'call_drop', rx: /\bdrop(?:ped|ping|s)?\s+calls?|\bcalls?\s+(?:are\s+)?(?:drop|dropping)/i },
  { tag: 'one_way_audio', rx: /\bone[-\s]?way\s+audio\b/i },
  { tag: 'transfer', rx: /\b(blind|attended)?\s*transfer\b/i },
  { tag: 'dtmf', rx: /\bdtmf\b/i },
  { tag: 'voicemail', rx: /\bvoicemail\b|\bvoice\s*mail\b/i },
  { tag: 'fax', rx: /\bfax\b|\bt\.?38\b/i },
  { tag: 'echo', rx: /\becho\b/i },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function extractContext(input: ExtractInput): ExtractedContext {
  const referenceDate = input.referenceDate ?? new Date();
  const text = combineText(input);
  const patternsHit: string[] = [];

  const timeRanges = extractTimeRanges(text, referenceDate, patternsHit);
  const ipAddresses = extractIpv4(text, patternsHit);
  const phoneNumbers = extractPhoneNumbers(text, patternsHit);
  const { errorCodes, errorKeywords } = extractErrors(text, patternsHit);
  const sipCallIds = extractSipCallIds(text, patternsHit);
  const frequency = extractFrequency(text, patternsHit);
  const affectedServices = extractAffectedServices(text, patternsHit);

  return {
    timeRanges,
    ipAddresses,
    phoneNumbers,
    errorCodes,
    errorKeywords,
    sipCallIds,
    frequency,
    affectedServices,
    meta: {
      inputLength: text.length,
      extractedAt: new Date().toISOString(),
      patternsHit,
      referenceDate: input.referenceDate ? referenceDate.toISOString() : null,
    },
  };
}

/**
 * Render the extracted context as a markdown block for inclusion in
 * _ticket_context.md. Returns an empty string if nothing was extracted so
 * Claude doesn't see a noisy empty section.
 */
export function renderExtractedContextMarkdown(ctx: ExtractedContext): string {
  const lines: string[] = [];
  const has = (arr: unknown[]) => arr.length > 0;

  if (
    !has(ctx.timeRanges) &&
    !has(ctx.ipAddresses) &&
    !has(ctx.phoneNumbers) &&
    !has(ctx.errorCodes) &&
    !has(ctx.errorKeywords) &&
    !has(ctx.sipCallIds) &&
    !has(ctx.affectedServices) &&
    ctx.frequency === 'unknown'
  ) {
    return '';
  }

  lines.push('## Extracted Context (auto-generated, Stage 1)');
  lines.push('');
  lines.push('_Parsed from the customer description before AI analysis. Use these as starting hints; verify against the raw files._');
  lines.push('');

  if (has(ctx.timeRanges)) {
    lines.push('**Time References:**');
    for (const tr of ctx.timeRanges) {
      const label = tr.kind === 'range' ? `${tr.start} → ${tr.end}` : `at ${tr.start}`;
      lines.push(`- ${label}  _(confidence: ${tr.confidence}, raw: "${tr.raw}")_`);
    }
    lines.push('');
  }
  if (has(ctx.ipAddresses)) {
    lines.push(`**IP Addresses:** ${ctx.ipAddresses.join(', ')}`);
    lines.push('');
  }
  if (has(ctx.phoneNumbers)) {
    lines.push(`**Phone Numbers:** ${ctx.phoneNumbers.join(', ')}`);
    lines.push('');
  }
  if (has(ctx.errorCodes)) {
    lines.push('**Error Codes:**');
    for (const ec of ctx.errorCodes) {
      lines.push(`- ${ec.code} ${ec.description} _(${ec.protocol})_`);
    }
    lines.push('');
  }
  if (has(ctx.errorKeywords)) {
    lines.push(`**Error Keywords:** ${ctx.errorKeywords.join(', ')}`);
    lines.push('');
  }
  if (has(ctx.sipCallIds)) {
    lines.push('**SIP Call-IDs:**');
    for (const id of ctx.sipCallIds) lines.push(`- \`${id}\``);
    lines.push('');
  }
  if (has(ctx.affectedServices)) {
    lines.push(`**Affected Services:** ${ctx.affectedServices.join(', ')}`);
    lines.push('');
  }
  if (ctx.frequency !== 'unknown') {
    lines.push(`**Frequency:** ${ctx.frequency}`);
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

/**
 * One-line telemetry summary, suitable for logging.
 * e.g. "extracted: 1 time range, 2 IPs, 1 phone, 1 error code, frequency=intermittent"
 */
export function summarizeExtraction(ctx: ExtractedContext): string {
  const parts: string[] = [];
  if (ctx.timeRanges.length) parts.push(`${ctx.timeRanges.length} time ref${ctx.timeRanges.length === 1 ? '' : 's'}`);
  if (ctx.ipAddresses.length) parts.push(`${ctx.ipAddresses.length} IP${ctx.ipAddresses.length === 1 ? '' : 's'}`);
  if (ctx.phoneNumbers.length) parts.push(`${ctx.phoneNumbers.length} phone${ctx.phoneNumbers.length === 1 ? '' : 's'}`);
  if (ctx.errorCodes.length) parts.push(`${ctx.errorCodes.length} error code${ctx.errorCodes.length === 1 ? '' : 's'}`);
  if (ctx.errorKeywords.length) parts.push(`${ctx.errorKeywords.length} error kw`);
  if (ctx.sipCallIds.length) parts.push(`${ctx.sipCallIds.length} call-id${ctx.sipCallIds.length === 1 ? '' : 's'}`);
  if (ctx.affectedServices.length) parts.push(`services=${ctx.affectedServices.join('|')}`);
  if (ctx.frequency !== 'unknown') parts.push(`freq=${ctx.frequency}`);
  return parts.length ? parts.join(', ') : 'nothing extracted';
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function combineText(input: ExtractInput): string {
  const chunks: string[] = [];
  if (input.subject) chunks.push(input.subject);
  if (input.description) chunks.push(input.description);
  if (input.answers) {
    for (const a of input.answers) {
      if (a.answer) chunks.push(`${a.question}: ${a.answer}`);
    }
  }
  if (input.filenames) {
    // Filenames go through the same regex pipeline as free-text. Replacing
    // underscores with spaces lets word-boundary patterns work; the filename
    // itself stays intact for filename-specific patterns thanks to the
    // dedicated rxFilename below.
    for (const fn of input.filenames) {
      if (fn) chunks.push(fn);
    }
  }
  return chunks.join('\n');
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

// --- IPv4 ------------------------------------------------------------------

const IPV4_RX = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;

function extractIpv4(text: string, hits: string[]): string[] {
  const matches = text.match(IPV4_RX) ?? [];
  // Filter out version-number-looking IPs (e.g. "1.2.3.4" in a sentence about
  // a software version) is hard without context — keep them; Stage 2 can decide.
  const result = uniq(matches);
  if (result.length) hits.push('ipv4');
  return result;
}

// --- Phone numbers ---------------------------------------------------------

// E.164: + followed by 8-15 digits. Also tolerate hyphens/spaces/dots/parens.
const PHONE_E164_RX = /\+\d[\d\s().\-]{7,20}\d/g;
// North American formatted without country code: (514) 555-1234 or 514-555-1234
const PHONE_NA_RX = /\(?\b[2-9]\d{2}\)?[\s.\-]\d{3}[\s.\-]\d{4}\b/g;

function extractPhoneNumbers(text: string, hits: string[]): string[] {
  const found: string[] = [];
  for (const raw of text.match(PHONE_E164_RX) ?? []) {
    const digits = raw.replace(/[^\d+]/g, '');
    if (digits.length >= 9 && digits.length <= 16) found.push(digits);
  }
  for (const raw of text.match(PHONE_NA_RX) ?? []) {
    const digits = raw.replace(/[^\d]/g, '');
    if (digits.length === 10) found.push('+1' + digits);
  }
  const result = uniq(found);
  if (result.length) hits.push('phone');
  return result;
}

// --- Error codes & keywords ------------------------------------------------

function extractErrors(
  text: string,
  hits: string[]
): { errorCodes: ExtractedErrorCode[]; errorKeywords: string[] } {
  const codes: ExtractedErrorCode[] = [];
  const seenCodes = new Set<string>();

  // SIP/HTTP: 3-digit code with optional reason phrase. Anchor to common
  // contexts so we don't grab arbitrary 3-digit numbers (years, ports, etc).
  // Patterns:
  //   "503 Service Unavailable"
  //   "SIP/2.0 503"
  //   "got a 486"
  //   "error 408"
  const codeRx = /\b(?:sip(?:\/2\.0)?\s+|error\s+|got\s+(?:a|an)\s+|status\s+|response\s+|returned\s+)?(\d{3})\s*(?:\(([^)]+)\)|[A-Z][A-Za-z\s\-/]{3,40})?/g;
  // Simpler: just match known SIP codes anywhere (with word boundary), and use
  // contextual phrase if present right after.
  const knownCodeRx = new RegExp('\\b(' + Object.keys(SIP_STATUS_CODES).join('|') + ')\\b', 'g');
  let m: RegExpExecArray | null;
  while ((m = knownCodeRx.exec(text)) !== null) {
    const code = m[1];
    if (seenCodes.has(code)) continue;
    seenCodes.add(code);
    codes.push({
      code,
      protocol: 'sip',
      description: SIP_STATUS_CODES[code],
    });
  }
  if (codes.length) hits.push('sip_status');

  // suppress unused-variable lint by referencing codeRx in a comment-style noop
  void codeRx;

  // Keyword scan (case-insensitive substring)
  const lower = text.toLowerCase();
  const keywords: string[] = [];
  for (const kw of ERROR_KEYWORDS) {
    if (lower.includes(kw)) keywords.push(kw);
  }
  if (keywords.length) hits.push('error_kw');

  return { errorCodes: codes, errorKeywords: uniq(keywords) };
}

// --- SIP Call-IDs ----------------------------------------------------------

// Only match with explicit "Call-ID:" prefix to avoid email false positives.
const CALL_ID_RX = /Call-ID\s*[:=]\s*([^\s,;<>"']+)/gi;

function extractSipCallIds(text: string, hits: string[]): string[] {
  const found: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = CALL_ID_RX.exec(text)) !== null) {
    // Strip trailing sentence punctuation. Periods may be legal inside a
    // Call-ID, but a trailing one is almost always end-of-sentence.
    const cleaned = m[1].replace(/[.,;!?]+$/, '');
    if (cleaned) found.push(cleaned);
  }
  const result = uniq(found);
  if (result.length) hits.push('call_id');
  return result;
}

// --- Frequency -------------------------------------------------------------

function extractFrequency(text: string, hits: string[]): FrequencyHint {
  const t = text.toLowerCase();
  if (/\b(intermittent\w*|sporadic\w*|occasional\w*|sometimes|every\s+\d+\s*(min|sec|hour))/.test(t)) {
    hits.push('frequency');
    return 'intermittent';
  }
  if (/\b(continuous\w*|constant\w*|all\s+the\s+time|non[-\s]?stop|persistent\w*)/.test(t)) {
    hits.push('frequency');
    return 'continuous';
  }
  if (/\b(once|one[-\s]?time|single\s+(incident|occurrence|event)|happened\s+only\s+once)\b/.test(t)) {
    hits.push('frequency');
    return 'one_time';
  }
  return 'unknown';
}

// --- Affected services -----------------------------------------------------

function extractAffectedServices(text: string, hits: string[]): string[] {
  const found = new Set<string>();
  for (const { tag, rx } of AFFECTED_SERVICE_PATTERNS) {
    if (rx.test(text)) found.add(tag);
  }
  if (found.size) hits.push('services');
  return Array.from(found);
}

// --- Time ranges -----------------------------------------------------------
//
// Phase 1 supports common patterns. Edge cases (timezone names, weekday names
// like "last Monday at 3pm") are deferred — when extraction fails, Stage 2
// falls back to "last N hours + error lines".

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};

interface ParsedClock { h: number; m: number; }

function parseClock(s: string): ParsedClock | null {
  // "14:30", "2:30pm", "2pm", "14h30"
  const m = s.trim().toLowerCase().match(/^(\d{1,2})(?::|h)?(\d{2})?\s*(am|pm)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const mer = m[3];
  if (mer === 'pm' && h < 12) h += 12;
  if (mer === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return { h, m: min };
}

function parseDate(s: string, refYear: number): { year: number; month: number; day: number } | null {
  // ISO: 2026-04-08
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return { year: +iso[1], month: +iso[2] - 1, day: +iso[3] };
  }
  // "April 8" or "April 8, 2026" or "April 8 2026" or "Apr 8"
  const named = s.toLowerCase().match(/^(\w+)\s+(\d{1,2})(?:,?\s*(\d{4}))?$/);
  if (named && MONTHS[named[1]] !== undefined) {
    return {
      year: named[3] ? +named[3] : refYear,
      month: MONTHS[named[1]],
      day: +named[2],
    };
  }
  // "8 April" / "8 April 2026"
  const dmy = s.toLowerCase().match(/^(\d{1,2})\s+(\w+)(?:\s+(\d{4}))?$/);
  if (dmy && MONTHS[dmy[2]] !== undefined) {
    return {
      year: dmy[3] ? +dmy[3] : refYear,
      month: MONTHS[dmy[2]],
      day: +dmy[1],
    };
  }
  return null;
}

function makeIso(
  year: number, month: number, day: number, h: number, m: number
): string {
  return new Date(Date.UTC(year, month, day, h, m, 0)).toISOString();
}

// Clock pattern: bare numbers like "10" must NOT match (would collide with
// IPs, ports, version numbers). Require either an explicit colon-minute or
// an am/pm marker.
const CLOCK = String.raw`(?:\d{1,2}:\d{2}(?:\s*(?:am|pm))?|\d{1,2}\s*(?:am|pm))`;

function extractTimeRanges(
  text: string,
  refDate: Date,
  hits: string[]
): ExtractedTimeRange[] {
  const out: ExtractedTimeRange[] = [];
  const refYear = refDate.getUTCFullYear();
  // Track character spans consumed by higher-priority patterns so we don't
  // double-count (e.g. Pattern D "yesterday at 2pm" overlapping Pattern C "at 2pm").
  const consumedSpans: [number, number][] = [];
  const overlapsConsumed = (start: number, end: number) =>
    consumedSpans.some(([s, e]) => start < e && end > s);

  // Pattern A: "between 2pm and 3pm on April 8" / "from 14:30 to 15:45 on 2026-04-08"
  const rxA = new RegExp(
    String.raw`\b(?:between|from)\s+(${CLOCK})\s+(?:and|to|until|till|-)\s+(${CLOCK})(?:\s+(?:on|of)\s+([\w\s,]+?\d{1,2}(?:,?\s*\d{4})?|\d{4}-\d{1,2}-\d{1,2}))?`,
    'gi'
  );
  let mA: RegExpExecArray | null;
  while ((mA = rxA.exec(text)) !== null) {
    const t1 = parseClock(mA[1]);
    const t2 = parseClock(mA[2]);
    const dateStr = mA[3]?.trim();
    if (!t1 || !t2) continue;
    const d = dateStr
      ? parseDate(dateStr, refYear)
      : { year: refDate.getUTCFullYear(), month: refDate.getUTCMonth(), day: refDate.getUTCDate() };
    if (!d) continue;
    out.push({
      start: makeIso(d.year, d.month, d.day, t1.h, t1.m),
      end: makeIso(d.year, d.month, d.day, t2.h, t2.m),
      raw: mA[0],
      kind: 'range',
      confidence: dateStr ? 'high' : 'medium',
    });
    consumedSpans.push([mA.index, mA.index + mA[0].length]);
  }

  // Pattern B-filename: telecom report archive convention
  //   ..._YYYY-MM-DD_HHhMM_YYYY-MM-DD_HHhMM...
  // Customer descriptions rarely include precise times, but tbreport-style
  // filenames encode the exact incident window. Run this BEFORE Pattern B so
  // its high-confidence match takes precedence.
  const rxFilename = /(\d{4})-(\d{2})-(\d{2})_(\d{1,2})h(\d{2})_(\d{4})-(\d{2})-(\d{2})_(\d{1,2})h(\d{2})/g;
  let mF: RegExpExecArray | null;
  while ((mF = rxFilename.exec(text)) !== null) {
    out.push({
      start: makeIso(+mF[1], +mF[2] - 1, +mF[3], +mF[4], +mF[5]),
      end: makeIso(+mF[6], +mF[7] - 1, +mF[8], +mF[9], +mF[10]),
      raw: mF[0],
      kind: 'range',
      confidence: 'high',
    });
    consumedSpans.push([mF.index, mF.index + mF[0].length]);
  }

  // Pattern B: ISO datetime range "2026-04-08 14:30 to 15:45" / "2026-04-08T14:30:00Z to 2026-04-08T15:45:00Z"
  const rxB = /(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})(?::\d{2})?Z?\s*(?:to|-|until|→)\s*(?:(\d{4}-\d{2}-\d{2})[T\s])?(\d{2}:\d{2})(?::\d{2})?Z?/gi;
  let mB: RegExpExecArray | null;
  while ((mB = rxB.exec(text)) !== null) {
    const d1 = parseDate(mB[1], refYear);
    const t1 = parseClock(mB[2]);
    const d2 = mB[3] ? parseDate(mB[3], refYear) : d1;
    const t2 = parseClock(mB[4]);
    if (!d1 || !d2 || !t1 || !t2) continue;
    out.push({
      start: makeIso(d1.year, d1.month, d1.day, t1.h, t1.m),
      end: makeIso(d2.year, d2.month, d2.day, t2.h, t2.m),
      raw: mB[0],
      kind: 'range',
      confidence: 'high',
    });
    consumedSpans.push([mB.index, mB.index + mB[0].length]);
  }

  // Pattern D first (before C) so C can skip spans it already consumed.
  // "yesterday at 2pm" / "this morning at 9:30"
  const rxD = new RegExp(
    String.raw`\b(yesterday|today|this\s+morning|this\s+afternoon|this\s+evening|tonight|last\s+night)(?:\s+(?:at|around)\s+(${CLOCK}))?\b`,
    'gi'
  );
  let mD: RegExpExecArray | null;
  while ((mD = rxD.exec(text)) !== null) {
    const phrase = mD[1].toLowerCase();
    const tStr = mD[2];
    const t = tStr ? parseClock(tStr) : defaultClockFor(phrase);
    if (!t) continue;
    const d = resolveRelativeDay(phrase, refDate);
    const iso = makeIso(d.year, d.month, d.day, t.h, t.m);
    out.push({
      start: iso,
      end: iso,
      raw: mD[0],
      kind: 'moment',
      confidence: 'low',
    });
    consumedSpans.push([mD.index, mD.index + mD[0].length]);
  }

  // Pattern C: single moment "around 14:30 on April 8" / "at 2:30pm"
  const rxC = new RegExp(
    String.raw`\b(?:around|at|circa|approximately|approx\.?)\s+(${CLOCK})(?:\s+(?:on|of)\s+([\w\s,]+?\d{1,2}(?:,?\s*\d{4})?|\d{4}-\d{1,2}-\d{1,2}))?`,
    'gi'
  );
  let mC: RegExpExecArray | null;
  while ((mC = rxC.exec(text)) !== null) {
    if (overlapsConsumed(mC.index, mC.index + mC[0].length)) continue;
    const t = parseClock(mC[1]);
    const dateStr = mC[2]?.trim();
    if (!t) continue;
    const d = dateStr
      ? parseDate(dateStr, refYear)
      : { year: refDate.getUTCFullYear(), month: refDate.getUTCMonth(), day: refDate.getUTCDate() };
    if (!d) continue;
    const iso = makeIso(d.year, d.month, d.day, t.h, t.m);
    out.push({
      start: iso,
      end: iso,
      raw: mC[0],
      kind: 'moment',
      confidence: dateStr ? 'medium' : 'low',
    });
  }

  if (out.length) hits.push('time');
  return dedupeTimeRanges(out);
}

function defaultClockFor(phrase: string): ParsedClock | null {
  if (phrase.startsWith('this morning')) return { h: 9, m: 0 };
  if (phrase.startsWith('this afternoon')) return { h: 14, m: 0 };
  if (phrase.startsWith('this evening') || phrase === 'tonight') return { h: 19, m: 0 };
  if (phrase.startsWith('last night')) return { h: 22, m: 0 };
  return null;
}

function resolveRelativeDay(
  phrase: string,
  ref: Date
): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));
  if (phrase === 'yesterday' || phrase === 'last night') {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate() };
}

function dedupeTimeRanges(arr: ExtractedTimeRange[]): ExtractedTimeRange[] {
  const seen = new Set<string>();
  const out: ExtractedTimeRange[] = [];
  for (const tr of arr) {
    const key = `${tr.start}|${tr.end}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tr);
  }
  return out;
}
