/**
 * Standalone test script for file-preprocessor.service.ts
 *
 * Run with:
 *   cd server && npx tsx src/services/file-preprocessor.test.ts
 *
 * No test framework dependency — exits 1 on first failure batch.
 */

import {
  extractContext,
  renderExtractedContextMarkdown,
  summarizeExtraction,
} from './file-preprocessor.service';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: unknown, msg: string): void {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(msg);
    console.error(`  FAIL: ${msg}`);
  }
}

function test(name: string, fn: () => void): void {
  console.log(`\n• ${name}`);
  try {
    fn();
  } catch (e) {
    failed++;
    failures.push(`${name}: ${(e as Error).message}`);
    console.error(`  THREW: ${(e as Error).message}`);
  }
}

// ---------------------------------------------------------------------------

test('full happy-path description extracts everything', () => {
  const ctx = extractContext({
    subject: 'Outbound calls dropping with 503 errors',
    description:
      "Hi, we're seeing outbound calls fail intermittently between 2:30 PM and 3:45 PM on April 8, 2026. " +
      "Our PBX at 10.0.1.50 sends INVITE to the gateway 172.16.0.1 and gets back '503 Service Unavailable'. " +
      "Affected user: +15145551234. Call-ID: abc-123@10.0.1.50. " +
      "Also seeing one-way audio on some calls.",
  });

  console.log('  summary:', summarizeExtraction(ctx));

  assert(ctx.timeRanges.length === 1, `expected 1 time range, got ${ctx.timeRanges.length}`);
  if (ctx.timeRanges[0]) {
    assert(ctx.timeRanges[0].start === '2026-04-08T14:30:00.000Z', `start was ${ctx.timeRanges[0].start}`);
    assert(ctx.timeRanges[0].end === '2026-04-08T15:45:00.000Z', `end was ${ctx.timeRanges[0].end}`);
    assert(ctx.timeRanges[0].confidence === 'high', `confidence was ${ctx.timeRanges[0].confidence}`);
  }

  assert(ctx.ipAddresses.includes('10.0.1.50'), 'missing 10.0.1.50');
  assert(ctx.ipAddresses.includes('172.16.0.1'), 'missing 172.16.0.1');
  assert(ctx.phoneNumbers.includes('+15145551234'), `phones=${JSON.stringify(ctx.phoneNumbers)}`);
  assert(ctx.errorCodes.some(e => e.code === '503'), `error codes=${JSON.stringify(ctx.errorCodes)}`);
  assert(ctx.errorKeywords.includes('one-way audio'), `keywords=${JSON.stringify(ctx.errorKeywords)}`);
  assert(ctx.sipCallIds.includes('abc-123@10.0.1.50'), `call-ids=${JSON.stringify(ctx.sipCallIds)}`);
  assert(ctx.frequency === 'intermittent', `frequency=${ctx.frequency}`);
  assert(ctx.affectedServices.includes('outbound'), `services=${JSON.stringify(ctx.affectedServices)}`);
  assert(ctx.affectedServices.includes('call_drop'), `services=${JSON.stringify(ctx.affectedServices)}`);
});

test('ISO date range extraction', () => {
  const ctx = extractContext({
    description: 'Issue window: 2026-04-08 14:30 to 15:45 UTC',
  });
  assert(ctx.timeRanges.length === 1, `got ${ctx.timeRanges.length}`);
  if (ctx.timeRanges[0]) {
    assert(ctx.timeRanges[0].start === '2026-04-08T14:30:00.000Z', `start=${ctx.timeRanges[0].start}`);
    assert(ctx.timeRanges[0].end === '2026-04-08T15:45:00.000Z', `end=${ctx.timeRanges[0].end}`);
  }
});

test('single moment with date', () => {
  const ctx = extractContext({
    description: 'The crash happened around 14:30 on April 8, 2026',
  });
  assert(ctx.timeRanges.length === 1, `got ${ctx.timeRanges.length}`);
  if (ctx.timeRanges[0]) {
    assert(ctx.timeRanges[0].kind === 'moment', `kind=${ctx.timeRanges[0].kind}`);
    assert(ctx.timeRanges[0].start === ctx.timeRanges[0].end, 'moment should have start==end');
  }
});

test('relative day "yesterday at 2pm" with reference date', () => {
  const ref = new Date('2026-04-26T10:00:00Z');
  const ctx = extractContext({
    description: 'It happened yesterday at 2pm',
    referenceDate: ref,
  });
  assert(ctx.timeRanges.length === 1, `got ${ctx.timeRanges.length}`);
  if (ctx.timeRanges[0]) {
    assert(ctx.timeRanges[0].start === '2026-04-25T14:00:00.000Z', `start=${ctx.timeRanges[0].start}`);
    assert(ctx.timeRanges[0].confidence === 'low', `confidence=${ctx.timeRanges[0].confidence}`);
  }
});

test('IP deduplication', () => {
  const ctx = extractContext({
    description: '10.0.1.50 talks to 10.0.1.50, also see 10.0.1.50 in logs',
  });
  assert(ctx.ipAddresses.length === 1, `dedup failed, got ${JSON.stringify(ctx.ipAddresses)}`);
});

test('phone number formats', () => {
  const ctx = extractContext({
    description: 'Customers: +1 514 555 1234, also (514) 555-9999, and 438.555.1111',
  });
  assert(ctx.phoneNumbers.includes('+15145551234'), `phones=${JSON.stringify(ctx.phoneNumbers)}`);
  assert(ctx.phoneNumbers.includes('+15145559999'), `phones=${JSON.stringify(ctx.phoneNumbers)}`);
  assert(ctx.phoneNumbers.includes('+14385551111'), `phones=${JSON.stringify(ctx.phoneNumbers)}`);
});

test('SIP status codes are mapped to descriptions', () => {
  const ctx = extractContext({
    description: 'Got 503 on outbound, 486 on busy, 408 timeout',
  });
  const codes = ctx.errorCodes.map(c => c.code);
  assert(codes.includes('503'), `missing 503, got=${JSON.stringify(codes)}`);
  assert(codes.includes('486'), `missing 486, got=${JSON.stringify(codes)}`);
  assert(codes.includes('408'), `missing 408, got=${JSON.stringify(codes)}`);
  const e503 = ctx.errorCodes.find(c => c.code === '503');
  assert(e503?.description === 'Service Unavailable', `503 desc=${e503?.description}`);
});

test('Call-ID requires explicit prefix (no email false positives)', () => {
  const ctx = extractContext({
    description: 'Contact me at user@example.com. The Call-ID: real-call-id@10.0.1.50 was logged.',
  });
  assert(!ctx.sipCallIds.includes('user@example.com'), 'email leaked into call-ids');
  assert(ctx.sipCallIds.includes('real-call-id@10.0.1.50'), `call-ids=${JSON.stringify(ctx.sipCallIds)}`);
});

test('frequency: every N minutes → intermittent', () => {
  const ctx = extractContext({ description: 'Happens every 5 minutes or so' });
  assert(ctx.frequency === 'intermittent', `freq=${ctx.frequency}`);
});

test('frequency: continuous', () => {
  const ctx = extractContext({ description: 'The issue is constant, calls fail all the time' });
  assert(ctx.frequency === 'continuous', `freq=${ctx.frequency}`);
});

test('frequency: one-time', () => {
  const ctx = extractContext({ description: 'It happened only once on Tuesday' });
  assert(ctx.frequency === 'one_time', `freq=${ctx.frequency}`);
});

test('affected services tagging', () => {
  const ctx = extractContext({
    description: 'Inbound calls have one-way audio, also DTMF transfer fails',
  });
  assert(ctx.affectedServices.includes('inbound'), `services=${JSON.stringify(ctx.affectedServices)}`);
  assert(ctx.affectedServices.includes('one_way_audio'), `services=${JSON.stringify(ctx.affectedServices)}`);
  assert(ctx.affectedServices.includes('dtmf'), `services=${JSON.stringify(ctx.affectedServices)}`);
  assert(ctx.affectedServices.includes('transfer'), `services=${JSON.stringify(ctx.affectedServices)}`);
});

test('empty input → renderMarkdown returns empty string', () => {
  const ctx = extractContext({ subject: '', description: '' });
  const md = renderExtractedContextMarkdown(ctx);
  assert(md === '', `expected empty, got: ${md}`);
});

test('answers contribute to extraction', () => {
  const ctx = extractContext({
    subject: 'Issue',
    description: 'See answers.',
    answers: [
      { question: 'When?', answer: 'between 9am and 10am on April 8 2026' },
      { question: 'Affected IP?', answer: '10.0.1.50' },
    ],
  });
  assert(ctx.timeRanges.length === 1, `time ranges=${ctx.timeRanges.length}`);
  assert(ctx.ipAddresses.includes('10.0.1.50'), `ips=${JSON.stringify(ctx.ipAddresses)}`);
});

test('rendered markdown contains the key sections', () => {
  const ctx = extractContext({
    description: 'Issue between 14:30 and 15:45 on April 8, 2026 from 10.0.1.50, got 503',
  });
  const md = renderExtractedContextMarkdown(ctx);
  assert(md.includes('## Extracted Context'), 'missing heading');
  assert(md.includes('Time References'), 'missing time refs');
  assert(md.includes('IP Addresses'), 'missing IPs');
  assert(md.includes('503'), 'missing 503');
});

test('mixed-language description still extracts structured data', () => {
  const ctx = extractContext({
    // Reality: customers write half-French/half-English. Structured fields
    // (IPs, codes, phones, Call-ID) should still come through.
    description:
      "Bonjour, nous voyons un problème — la passerelle à 192.168.10.20 retourne 503 Service Unavailable " +
      "pour les appels du +15145551234. Call-ID: xyz-789@192.168.10.20.",
  });
  assert(ctx.ipAddresses.includes('192.168.10.20'), 'missed IP in French sentence');
  assert(ctx.phoneNumbers.includes('+15145551234'), 'missed phone in French sentence');
  assert(ctx.errorCodes.some(c => c.code === '503'), 'missed 503 in French sentence');
  assert(ctx.sipCallIds.includes('xyz-789@192.168.10.20'), 'missed Call-ID');
});

// ---------------------------------------------------------------------------

console.log(`\n${'='.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('All tests passed.');
