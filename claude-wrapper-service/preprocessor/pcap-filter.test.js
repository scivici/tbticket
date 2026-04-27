/**
 * Tests for pcap-filter.js. Only the filter-string builder is unit-tested;
 * end-to-end tshark execution requires the binary and a real .pcap.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { buildDisplayFilter } = require('./pcap-filter');

test('buildDisplayFilter returns null when nothing to filter on', () => {
  assert.equal(buildDisplayFilter({}), null);
  assert.equal(buildDisplayFilter({ ipAddresses: [], sipCallIds: [], timeRanges: [] }), null);
});

test('buildDisplayFilter combines IPs with OR', () => {
  const f = buildDisplayFilter({ ipAddresses: ['10.0.1.50', '172.16.0.1'] });
  assert.equal(f, '(ip.addr == 10.0.1.50 || ip.addr == 172.16.0.1)');
});

test('buildDisplayFilter combines Call-IDs with OR', () => {
  const f = buildDisplayFilter({ sipCallIds: ['abc-123@10.0.1.50', 'xyz@host'] });
  assert.equal(f, '(sip.Call-ID == "abc-123@10.0.1.50" || sip.Call-ID == "xyz@host")');
});

test('buildDisplayFilter strips embedded double-quotes in Call-IDs', () => {
  const f = buildDisplayFilter({ sipCallIds: ['evil"id@host'] });
  assert.ok(f && !f.includes('evil"id@host'), `filter should not contain raw quote: ${f}`);
});

test('buildDisplayFilter applies time window with buffer', () => {
  const f = buildDisplayFilter({
    timeRanges: [{ start: '2026-04-08T14:30:00Z', end: '2026-04-08T15:00:00Z' }],
    bufferMinutes: 15,
  });
  assert.match(f, /frame.time >= "2026-04-08 14:15:00"/);
  assert.match(f, /frame.time <= "2026-04-08 15:15:00"/);
});

test('buildDisplayFilter ANDs the components', () => {
  const f = buildDisplayFilter({
    ipAddresses: ['10.0.1.50'],
    sipCallIds: ['abc@host'],
    timeRanges: [{ start: '2026-04-08T14:00:00Z', end: '2026-04-08T15:00:00Z' }],
    bufferMinutes: 0,
  });
  // IP && Call-ID && time
  assert.match(f, /ip\.addr == 10\.0\.1\.50.*&&.*sip\.Call-ID == "abc@host".*&&.*frame\.time/);
});
