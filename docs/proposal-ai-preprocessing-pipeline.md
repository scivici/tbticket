# Proposal: Smart Pre-Processing Pipeline for AI Ticket Analysis

**Date:** April 9, 2026  
**Author:** Serdar  
**Status:** Proposal  

---

## Executive Summary

Our current AI-powered ticket analysis system sends **all uploaded files in their entirety** to Claude for analysis. For a typical support ticket with 200-500MB of log files, Claude must read through everything to find the relevant sections — consuming significant time and API tokens.

This proposal introduces a **Smart Pre-Processing Pipeline** that automatically extracts key information from the customer's description (time ranges, IP addresses, error messages, call IDs) and uses it to **filter and trim files before they reach Claude**. The result: Claude receives only the relevant data, reducing analysis time and token consumption by an estimated **70-90%**.

---

## Problem Statement

### Current Flow

```
Customer submits ticket with description + files (logs, CDRs, PCAPs, configs)
                          |
                    All files sent to Claude as-is
                          |
              Claude reads everything start to finish
                          |
                   Analysis result returned
```

### Pain Points

| Issue | Impact |
|-------|--------|
| Claude reads entire log files (often 50-500MB) even when the issue spans only a few minutes | High token consumption, slow analysis |
| No pre-filtering of CDR records — Claude scans thousands of rows to find the relevant calls | Wasted processing time |
| PCAP files contain all traffic, not just the problematic flows | Unnecessary data for analysis |
| Claude has no upfront context about *what* to look for, so it must discover patterns from scratch | Repeated work across similar tickets |
| Analysis times can exceed 30 minutes for large file sets | Customer wait time, resource cost |

---

## Proposed Solution: Smart Pre-Processing Pipeline

A four-stage pipeline that progressively extracts, filters, and summarizes data **before** Claude performs its analysis.

### Architecture

```
          Customer Description + Uploaded Files
                        |
               +--------v--------+
               |    STAGE 1      |   No AI — Instant (<1 sec)
               |    EXTRACT      |
               |                 |   Parse customer description using regex/NLP:
               |                 |   - Time ranges ("between 2pm and 3pm on April 8")
               |                 |   - IP addresses (10.0.1.50, 192.168.1.1)
               |                 |   - Phone numbers (+1-514-555-1234)
               |                 |   - Error messages ("503 Service Unavailable")
               |                 |   - SIP Call-IDs, session identifiers
               |                 |   - Product keys / serial numbers
               +--------+--------+
                        |
                  Extracted Context
                        |
               +--------v--------+
               |    STAGE 2      |   No AI — Fast (5-30 sec)
               |    FILTER       |
               |                 |   Apply extracted context as filters:
               |                 |   - Trim log files to relevant time window (±15 min buffer)
               |                 |   - Filter CDR records to matching calls only
               |                 |   - Extract matching SIP dialogs from captures
               |                 |   - Keep config files as-is (already small)
               |                 |   - For archives: extract and then apply same filters
               +--------+--------+
                        |
                  Filtered Files
                        |
               +--------v--------+
               |    STAGE 3      |   No AI — Fast (2-10 sec)
               |    DIGEST       |
               |                 |   Generate statistical summary per file:
               |                 |   - Time range covered
               |                 |   - Error/warning counts and top messages
               |                 |   - Anomaly detection (error rate spikes)
               |                 |   - Call success/failure ratios
               |                 |   - File structure overview
               +--------+--------+
                        |
                  Filtered Files + Digest + Extracted Context
                        |
               +--------v--------+
               |    STAGE 4      |   AI Analysis (Claude)
               |    ANALYZE      |
               |                 |   Claude receives:
               |                 |   - Customer description (original)
               |                 |   - Pre-extracted context (time, IPs, errors)
               |                 |   - File digest (statistical overview)
               |                 |   - Filtered/trimmed files (only relevant portions)
               |                 |
               |                 |   Claude can still request full file sections
               |                 |   if the digest indicates something outside the
               |                 |   filtered window is relevant.
               +--------+--------+
                        |
                  Analysis Result
```

---

## Stage Details

### Stage 1: Context Extraction

Parses the customer's free-text description using pattern matching to extract structured data.

**Extraction targets:**

| Data Type | Example Input | Extracted Value |
|-----------|---------------|-----------------|
| Time range | "The issue started around 2:30 PM and lasted until 3:45 PM on April 8" | `2026-04-08T14:30 → 2026-04-08T15:45` |
| IP address | "calls from our PBX at 10.0.1.50 to the gateway" | `10.0.1.50` |
| Phone number | "caller +15145551234 experiences no audio" | `+15145551234` |
| Error message | "we see '503 Service Unavailable' on our end" | `503 Service Unavailable` |
| SIP Call-ID | "Call-ID: abc123@10.0.1.50" | `abc123@10.0.1.50` |
| Frequency | "happens every 5-10 minutes" | `intermittent` |
| Affected service | "outbound calls are dropping" | `outbound`, `call drop` |

**Implementation:** Regex-based with predefined patterns for telecom-specific formats. No AI needed — deterministic, fast, and free.

### Stage 2: File Filtering

Uses Stage 1 output to trim files to only relevant content.

**Per file type:**

| File Type | Filter Strategy | Example |
|-----------|----------------|---------|
| `.log` files | Keep only lines within the extracted time window (±15 min buffer). If no time found, keep error/warning lines only. | 500MB log → 3MB relevant section |
| `.csv` CDR files | Filter rows by time range, caller/callee numbers, or failure status codes | 50,000 records → 200 matching records |
| `.pcap` / `.pcapng` | Use `tshark` to filter by IP addresses, SIP Call-IDs, or time range | 100MB capture → 5MB filtered capture |
| `.cfg` / `.conf` / `.xml` | No filtering — config files are typically small and fully relevant | Passed through as-is |
| `.html` (call traces) | No filtering — already scoped to a single call | Passed through as-is |
| Archives (`.tar.gz`, `.zip`) | Extract first, then apply above filters to individual files | Recursive processing |

**Fallback:** If Stage 1 extracts no time range or identifiers, Stage 2 applies a default strategy: extract the last N hours of logs and all error/warning lines.

### Stage 3: File Digest Generation

Creates a machine-readable summary of each file's contents.

**Example output (`_file_digest.md`):**

```markdown
# File Digest — Ticket TKT-2026-0412

## Extracted Context from Customer Description
- **Time Range:** 2026-04-08 14:30 → 15:45 UTC
- **IP Addresses:** 10.0.1.50, 172.16.0.1
- **Phone Numbers:** +15145551234
- **Error Keywords:** "503 Service Unavailable", "no audio"
- **Affected Service:** Outbound calls

## File Summary

### system.log (original: 487 MB → filtered: 2.8 MB)
- **Filtered time range:** 14:15 — 16:00 UTC (±15 min buffer applied)
- **Error count (TBLV0):** 47 in filtered window
  - "SIP 503 Service Unavailable" — 31 occurrences
  - "RTP stream timeout" — 12 occurrences
  - "TLS handshake failed" — 4 occurrences
- **Warning count (TBLV1):** 128 in filtered window
- **Notable pattern:** Error rate spikes at 14:42 (23 errors/min vs baseline 2/min)

### cdr_20260408.csv (original: 8,432 records → filtered: 156 records)
- **Filter applied:** time range + caller number +15145551234
- **Success rate in window:** 78.2% (vs 97.1% daily average)
- **Common failure codes:** 503 (24x), 486 (8x), 408 (2x)

### gateway_config.cfg (4.2 KB — not filtered)
- **Type:** ProSBC configuration
- **SIP profiles:** 3 defined
- **Media gateways:** 2 configured
- **Codec list:** G.711 (primary), G.729 (secondary)

### capture_20260408.pcap (original: 112 MB → filtered: 4.1 MB)
- **Filter applied:** ip.addr == 10.0.1.50 && time range
- **SIP transactions in window:** 87
- **Failed transactions:** 19 (21.8%)
- **RTP streams detected:** 34
```

### Stage 4: Claude AI Analysis (Enhanced)

Claude receives the same prompt structure as today, **plus**:
1. The extracted context (so Claude knows what the customer reported without re-parsing)
2. The file digest (so Claude knows what's in each file without opening them)
3. Filtered files (so Claude reads only relevant content)

Claude retains access to the original files and can request broader data if the digest reveals something outside the filtered window requires attention.

---

## Expected Impact

### Token Consumption

| Metric | Current | With Pipeline | Reduction |
|--------|---------|---------------|-----------|
| Average data sent to Claude per ticket | ~50-200 MB of files | ~2-10 MB filtered + digest | **~90-95%** |
| Estimated tokens per analysis | ~500K-2M+ | ~50K-200K | **~80-90%** |
| Cost per analysis (estimated) | High | Significantly lower | **~80-90%** |

### Analysis Speed

| Metric | Current | With Pipeline | Improvement |
|--------|---------|---------------|-------------|
| Average analysis time | 10-30 minutes | 3-8 minutes | **~60-70% faster** |
| Pre-processing overhead | N/A | 10-40 seconds | Negligible vs savings |
| Time to first result | 10-30 minutes | 3-8 minutes | Customers get faster responses |

### Analysis Quality

| Aspect | Impact |
|--------|--------|
| **Focused context** | Claude starts with the relevant time window and patterns already identified, leading to more targeted analysis |
| **Statistical overview** | The digest gives Claude anomaly data (error spikes, failure rates) that it would otherwise need to calculate manually |
| **Reduced noise** | By removing irrelevant log lines, Claude is less likely to be distracted by unrelated errors outside the incident window |
| **Retained depth** | Claude can still access full files when needed — the pipeline assists, it doesn't restrict |

---

## Implementation Plan

### Phase 1: Context Extraction (Stage 1)
- New service: `file-preprocessor.service.ts`
- Regex patterns for time, IP, phone, error extraction
- Integration with ticket creation flow
- **Effort:** ~3-4 days
- **Risk:** Low — additive change, no impact on existing flow

### Phase 2: Log Filtering (Stage 2 — Logs Only)
- Time-based log trimming with configurable buffer
- Error/warning line extraction as fallback
- **Effort:** ~3-4 days
- **Risk:** Low — operates on copies, originals preserved

### Phase 3: File Digest (Stage 3)
- Statistical summary generation per file type
- Integration with `_ticket_context.md`
- **Effort:** ~2-3 days
- **Risk:** Low — additive metadata

### Phase 4: CDR and PCAP Filtering (Stage 2 — Extended)
- CSV row filtering for CDR files
- `tshark`-based PCAP filtering
- **Effort:** ~3-4 days
- **Risk:** Medium — requires `tshark` availability on the analysis server

### Phase 5: Claude Prompt Enhancement (Stage 4)
- Update Claude wrapper to include digest and extracted context
- Update prompt to instruct Claude to use digest-first strategy
- **Effort:** ~2 days
- **Risk:** Low — prompt modification only

**Total estimated effort:** ~2-3 weeks  
**Incremental delivery:** Each phase delivers independent value. Phase 1+2+3 alone covers the majority of the benefit.

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Regex fails to extract time range from ambiguous descriptions | Medium | Low — falls back to default filtering (last N hours + errors) | Iterative improvement of patterns; optional Haiku-based extraction as future enhancement |
| Filtering removes relevant data | Low | Medium — could miss root cause context | ±15 min buffer on time windows; Claude retains access to originals; digest flags anomalies outside the window |
| Pre-processing adds latency for small files | Low | Low — overhead is 10-40 sec | Skip filtering for files under a configurable size threshold (e.g., <1 MB) |
| `tshark` not available on analysis server | Medium | Low — PCAP filtering skipped | Phase 4 is optional; raw PCAPs still work as today |

---

## Summary

The Smart Pre-Processing Pipeline is a **low-risk, high-reward** optimization that:

1. **Reduces AI cost by ~80-90%** through targeted file filtering
2. **Speeds up analysis by ~60-70%** by eliminating unnecessary file reading
3. **Improves analysis quality** by giving Claude focused context upfront
4. **Requires no AI for pre-processing** — Stages 1-3 are deterministic and essentially free
5. **Is fully backward-compatible** — Claude can still access original files when needed
6. **Can be delivered incrementally** — each phase adds independent value

The pipeline transforms our approach from "send everything, let AI figure it out" to "identify what matters, send AI the essentials."
