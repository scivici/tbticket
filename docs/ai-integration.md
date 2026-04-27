# AI Integration (Claude)

The system uses Claude AI for automatic ticket analysis, engineer recommendation, and intelligent assistance.

---

## Analysis Modes

The system supports 3 modes for communicating with Claude. Mode is configured in the admin Setup page.

### Mode 1: HTTP API (Default)

Direct HTTP POST to a Claude API endpoint.

**Endpoint**: `http://claude-support-2.telcobridges.lan/api/chat` (custom proxy) or Anthropic API directly

**Authentication options**:
- `basic` — Base64 encoded username:password
- `bearer` — Bearer token
- `api-key` — Anthropic `x-api-key` header

**Service**: `server/src/services/claude.service.ts`

### Mode 2: SSH/SFTP + Claude Code CLI

Uses SSH to execute Claude Code CLI on the remote server.

**Flow**:
1. Upload ticket attachments to `/home/support/tickets/{ticketNumber}/` via SFTP
2. SSH into the Claude server
3. Execute `claude -p '{prompt}'` (non-interactive mode)
4. Parse structured JSON output
5. Store analysis result

**Connection**:
- Host: `claude-support-2.telcobridges.lan` (10.0.0.241)
- Port: 22
- Auth: password-based SSH
- Timeout: 5 minutes

**Service**: `server/src/services/claude-ssh.service.ts`

**Advantage**: Claude Code CLI can directly read uploaded files (logs, configs, pcaps) from the filesystem and access product documentation on the server.

### Mode 3: Wrapper Service

A lightweight HTTP API running on the Claude server that invokes Claude Code CLI internally.

```
POST http://claude-support-2.telcobridges.lan:4002/analyze
Body: { ticketNumber, subject, description, product, category, attachments, engineers }
```

**Service**: `server/src/services/claude-wrapper.service.ts`

This combines the ease of HTTP API with the power of CLI (file access, repo access, documentation access).

---

## What Claude Analyzes

When a ticket is created, the system sends:

1. **Ticket metadata** — product, category, subject, description
2. **Customer questionnaire responses** — answers to dynamic questions
3. **Attached files** — text files as inline content, images as base64
4. **Engineer profiles** — skills (1-5), product expertise (1-5), current workload

## Claude's Response

```json
{
  "classification": "SIP Registration Failure",
  "severity": "high",
  "rootCauseHypothesis": "TLS certificate mismatch on SBC interface...",
  "recommendedEngineerId": 3,
  "recommendedEngineerName": "John Smith",
  "confidence": 0.85,
  "reasoning": "John has 5/5 SIP expertise and 4/5 ProSBC experience...",
  "suggestedSkills": ["SIP", "TLS", "Certificate Management"],
  "estimatedComplexity": "medium"
}
```

## Auto-Assignment

If `confidence >= 0.7` (configurable threshold), the ticket is automatically assigned to the recommended engineer. Otherwise, it stays in `assigned` status for manual review.

**Fallback**: When Claude is unavailable, a scoring algorithm (`assignment.service.ts`) calculates the best engineer match based on skill proficiency, product expertise, and current workload.

---

## AI-Powered Features

| Feature | Description |
|---------|-------------|
| Ticket Classification | Categorizes the technical issue type |
| Severity Assessment | Determines priority level |
| Root Cause Hypothesis | Best guess at what's wrong |
| Engineer Recommendation | Picks best-fit engineer |
| Complexity Estimation | Rates issue complexity |
| File Analysis | Reads logs, configs, screenshots |
| Suggested Replies | Drafts response for engineers |
| Jira Escalation Suggestion | Recommends when to escalate |
| Working Session / RMA Suggestion | Suggests hands-on sessions or hardware return |
| Knowledge Base | Converts resolved tickets to KB articles |
| Similar Ticket Matching | Finds solutions from past tickets |
| Data Extraction | Parses structured data from log files |

---

## Configuration (Setup Page)

All Claude settings are configurable from the admin **Setup** page:

| Setting | Description |
|---------|-------------|
| Server URL | Claude API endpoint |
| Auth Type | basic / bearer / api-key |
| Auth Credentials | Username/password or token |
| Model | Claude model ID |
| Max Tokens | Maximum response length |
| Auto-Assign Threshold | Confidence threshold (default: 0.7) |
| Analysis Mode | API / SSH / Wrapper |
| SSH Host / Port / User / Password | SSH connection details |
| Remote Path | Ticket directory on Claude server |
