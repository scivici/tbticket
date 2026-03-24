# TelcoBridges Smart Ticket System — Project Overview & Claude Code Server Integration Guide

## 1. Project Summary

This is an **in-house technical support ticket system** built for **TelcoBridges**, a telecom equipment manufacturer. The system handles support tickets for 7 telecom products (ProSBC, Tmedia/Tsig Gateways) with AI-powered ticket triage, automatic engineer assignment, SLA tracking, and escalation management.

- **URL**: Runs on port `4001` via Docker
- **Stack**: React 19 + Express.js + TypeScript + SQLite + TailwindCSS
- **AI**: Claude API integration for ticket analysis and intelligent engineer assignment
- **Team**: 5 support engineers with skill/expertise profiles

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Container (port 4001)              │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │  React 19     │    │  Express.js   │    │  SQLite DB   │   │
│  │  Frontend     │───▶│  REST API     │───▶│  (WAL mode)  │   │
│  │  (Vite/TW)   │    │  TypeScript   │    │              │   │
│  └──────────────┘    └──────┬───────┘    └──────────────┘   │
│                             │                                │
│                    ┌────────┴─────────┐                      │
│                    │                  │                       │
│              ┌─────▼─────┐   ┌───────▼────────┐             │
│              │ Claude API │   │ Claude SSH/SFTP │             │
│              │ (HTTP)     │   │ (CLI mode)      │             │
│              └─────┬─────┘   └───────┬────────┘             │
│                    │                  │                       │
└────────────────────┼──────────────────┼──────────────────────┘
                     │                  │
              ┌──────▼──────────────────▼───────┐
              │   In-House Claude Code Server    │
              │   claude-support-2.telcobridges  │
              │   (10.0.0.241)                   │
              └─────────────────────────────────┘
```

---

## 3. Current Claude Integration (What Exists Today)

### 3.1 Mode 1: HTTP API (Default)

The system sends structured prompts to a Claude API endpoint via HTTP POST.

**Endpoint**: `http://claude-support-2.telcobridges.lan/api/chat` (custom proxy) or `/v1/messages` (Anthropic direct)

**Authentication Options**:
- `basic` — Base64 encoded `username:password`
- `bearer` — Bearer token
- `api-key` — Anthropic `x-api-key` header

**What it sends**: A single message containing:
- Ticket metadata (product, category, subject, description)
- Customer questionnaire responses
- Attached files (text files as inline content, images as base64)
- Available engineer profiles (skills rated 1-5, product expertise rated 1-5, current workload)

**What it expects back** (JSON):
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

**Auto-assignment**: If `confidence >= 0.7` (configurable), the ticket is automatically assigned to the recommended engineer.

### 3.2 Mode 2: SSH/SFTP + Claude Code CLI

An alternative mode that leverages the Claude Code CLI on the remote server.

**Flow**:
1. Upload ticket attachments to `/home/support/tickets/{ticketNumber}/` via SFTP
2. SSH into the Claude server, `cd` to the ticket directory
3. Execute `claude -p '{prompt}'` (Claude Code CLI with print flag)
4. Parse the output (structured report + embedded JSON block)
5. Store analysis and auto-assign

**Advantage**: Claude Code CLI can directly read and analyze uploaded files (logs, configs, pcap exports) from the filesystem.

**Connection Details**:
- Host: `claude-support-2.telcobridges.lan` (IP: `10.0.0.241`)
- Port: 22
- Auth: password-based SSH
- Remote path: `/home/support/tickets/`
- Timeout: 5 minutes

---

## 4. Database Schema (Key Tables)

### Tickets
| Column | Type | Description |
|--------|------|-------------|
| `ticket_number` | TEXT | Unique ID (e.g., TKT-20260323-ABC123) |
| `product_id` | INT | FK to products |
| `category_id` | INT | FK to product_categories |
| `subject` | TEXT | One-line summary |
| `description` | TEXT | Detailed issue description |
| `product_key` | TEXT | Device serial/license key |
| `status` | TEXT | new → analyzing → assigned → in_progress → pending_info → resolved → closed |
| `priority` | TEXT | low / medium / high / critical |
| `assigned_engineer_id` | INT | FK to engineers |
| `ai_analysis` | TEXT | JSON — full Claude analysis result |
| `ai_confidence` | REAL | 0.0 to 1.0 |

### Engineers
| Column | Type | Description |
|--------|------|-------------|
| `name` | TEXT | Full name |
| `email` | TEXT | Unique email |
| `location` | TEXT | Office/timezone |
| `is_active` | INT | 0/1 |
| `current_workload` | INT | Active ticket count |
| `max_workload` | INT | Capacity limit |

### Engineer Skills & Expertise
- `engineer_skills`: Maps engineers to skills (SIP, VoIP, SS7, TLS, etc.) with proficiency 1-5
- `engineer_product_expertise`: Maps engineers to product+category with expertise level 1-5

### Other Important Tables
- `ticket_answers` — Customer responses to dynamic questionnaires
- `ticket_attachments` — Uploaded files (logs, configs, screenshots, pcaps)
- `ticket_responses` — Conversation thread (internal + external messages)
- `ticket_activity_log` — Full audit trail of all actions
- `ticket_tags` — Free-form labels
- `ticket_satisfaction` — Customer ratings (1-5) after resolution
- `sla_policies` — Response/resolution time targets per priority
- `escalation_rules` — Auto-escalation triggers
- `canned_responses` — Pre-made reply templates
- `settings` — Key-value configuration store

---

## 5. Full API Endpoint Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register customer |
| POST | `/api/auth/login` | Login (returns JWT) |
| POST | `/api/auth/anonymous` | Create anonymous session |
| GET | `/api/auth/me` | Current user info |
| PATCH | `/api/auth/profile` | Update profile |
| PATCH | `/api/auth/password` | Change password |

### Tickets
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tickets` | Create ticket (triggers AI analysis) |
| GET | `/api/tickets` | List user's tickets |
| GET | `/api/tickets/track/:ticketNumber` | Public tracking (no auth) |
| GET | `/api/tickets/:id` | Ticket details |
| GET | `/api/tickets/:id/responses` | Get conversation |
| POST | `/api/tickets/:id/responses` | Add response |
| GET | `/api/tickets/:id/activities` | Activity log |
| GET/POST/DELETE | `/api/tickets/:id/tags` | Manage tags |
| POST | `/api/tickets/:id/satisfaction` | Submit survey |
| PATCH | `/api/tickets/:id/status` | Update status (admin) |
| PATCH | `/api/tickets/:id/assign` | Assign engineer (admin) |
| PATCH | `/api/tickets/:id/priority` | Change priority (admin) |
| POST | `/api/tickets/:id/analyze` | Re-trigger AI analysis (admin) |
| DELETE | `/api/tickets/:id` | Delete (admin) |
| POST | `/api/tickets/bulk/status` | Bulk status update (admin) |
| POST | `/api/tickets/bulk/assign` | Bulk assign (admin) |
| POST | `/api/tickets/bulk/delete` | Bulk delete (admin) |

### Engineers (Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/engineers` | List engineers |
| POST | `/api/engineers` | Create engineer |
| PATCH | `/api/engineers/:id` | Update engineer |
| DELETE | `/api/engineers/:id` | Delete engineer |
| PUT | `/api/engineers/:id/skills` | Set skill proficiencies |
| PUT | `/api/engineers/:id/expertise` | Set product expertise |
| GET | `/api/engineers/skills` | List available skills |

### Admin Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Stats, charts data |
| GET | `/api/admin/customers` | Customer list |
| GET/PATCH | `/api/admin/sla-policies` | SLA configuration |
| GET | `/api/admin/sla-breached` | Breached SLA tickets |
| GET/POST/PATCH/DELETE | `/api/admin/escalation-rules` | Escalation rules |
| GET | `/api/admin/escalation-alerts` | Active alerts |
| GET | `/api/admin/recurring-tickets` | Recurring patterns |

### Admin Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| CRUD | `/api/admin/manage/products` | Manage products |
| CRUD | `/api/admin/manage/categories` | Manage categories |
| CRUD | `/api/admin/manage/questions` | Manage questionnaires |
| CRUD | `/api/admin/manage/skills` | Manage skill definitions |

### Settings & Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/PATCH | `/api/settings` | System settings |
| CRUD | `/api/admin/users` | Admin user management |
| CRUD | `/api/canned-responses` | Response templates |
| GET/PATCH | `/api/notifications` | User notifications |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server health check |

---

## 6. Supported Products

| # | Product | Model | Domain |
|---|---------|-------|--------|
| 1 | ProSBC | Session Border Controller | VoIP security, SIP routing, transcoding |
| 2 | Tmedia Gateway | TMG800 | Small-scale media gateway |
| 3 | Tmedia Gateway | TMG3200 | Mid-scale media gateway |
| 4 | Tmedia Gateway | TMG7800 | Large-scale media gateway |
| 5 | Tsig Gateway | TSG800 | Signaling gateway (small) |
| 6 | Tsig Gateway | TSG3200 | Signaling gateway (large) |
| 7 | (Additional) | Configurable | Dynamic product management |

Each product has **categories** (e.g., Configuration, Troubleshooting, Performance, Installation) and each category has a **dynamic questionnaire** with conditional logic.

---

## 7. Claude Code Server Integration — Current Capabilities & Expansion Opportunities

### 7.1 What Claude Currently Does
1. **Ticket Classification** — Categorizes the technical issue
2. **Severity Assessment** — Determines priority level
3. **Root Cause Hypothesis** — Best guess at what's wrong
4. **Engineer Recommendation** — Picks best-fit engineer based on skills, expertise, workload
5. **Complexity Estimation** — Rates issue complexity
6. **File Analysis** — Reads log files, config files, and screenshots attached to tickets

### 7.2 Ideas for Deeper Integration (What We Want to Explore)

#### A. Knowledge Base & Solution Suggestion
- Claude could access a knowledge base of past resolved tickets
- Suggest solutions based on similar historical issues
- Generate initial troubleshooting steps for the customer automatically
- Build a searchable FAQ from resolved ticket patterns

#### B. Automated First Response
- Generate an intelligent first response to the customer when a ticket is created
- Include preliminary troubleshooting steps based on the analysis
- Reduce time-to-first-response SLA pressure

#### C. Recurring Issue Detection Enhancement
- Current: Simple pattern matching (same customer + product + category)
- Enhanced: Claude analyzes ticket descriptions semantically to find truly related issues
- Detect product-wide issues affecting multiple customers (not just same customer)

#### D. Live Chat / Conversational Support
- Real-time Claude-powered chat for customers before they submit a ticket
- Could resolve simple issues without creating a ticket at all
- Escalate to human engineer when needed

#### E. Ticket Response Drafting
- When an engineer opens a ticket, Claude drafts a response based on:
  - The ticket content and analysis
  - Similar past tickets and their resolutions
  - Product documentation
  - Canned response templates

#### F. SLA Risk Prediction
- Predict which tickets are likely to breach SLA based on complexity analysis
- Proactive alerts before breaches happen (not just after)

#### G. Engineer Performance & Workload Optimization
- Analyze ticket resolution patterns per engineer
- Suggest optimal ticket distribution beyond simple workload counting
- Factor in ticket complexity vs engineer skill match

#### H. Multi-Turn Analysis
- Instead of single-shot analysis, allow Claude to ask clarifying questions
- "The log shows X but I need to see Y to confirm — can you upload the SIP trace?"
- Iterative refinement of the diagnosis

#### I. Product Documentation Integration
- Give Claude access to TelcoBridges product documentation
- More accurate analysis grounded in actual product specs and known issues
- Reference specific documentation sections in responses

#### J. Webhook-Triggered Analysis
- Analyze incoming Slack/Teams messages for urgent issues
- Auto-create tickets from external communication channels
- Summarize long email threads into structured tickets

---

## 8. Technical Integration Points

### 8.1 How to Connect (for the Claude Code Server)

**Option A: Direct API Integration**
```
POST http://{ticket-system-host}:4001/api/tickets/:id/analyze
Authorization: Bearer {admin-jwt-token}
```
This re-triggers analysis for any ticket. The system will call back to Claude.

**Option B: Database Access (Read-Only)**
The SQLite database is at `/app/server/data/tickets.db` inside the Docker container (volume: `ticket_data`). A read-only connection could allow Claude to:
- Query historical tickets for pattern matching
- Access engineer profiles and skills
- Review ticket activity logs

**Option C: REST API Consumption**
Claude Code Server could call any of the REST APIs listed above using an admin JWT token to:
- Read tickets and their full context
- Post responses on behalf of the system
- Update ticket status/priority/assignment
- Access dashboard statistics

**Option D: File System Access (SSH Mode)**
When using SSH mode, Claude Code CLI runs in `/home/support/tickets/{ticketNumber}/` and can:
- Read all uploaded attachments directly
- Create analysis report files
- Access any shared documentation mounted on the server

### 8.2 Authentication for API Access
```javascript
// Get admin JWT token
POST /api/auth/login
Body: { "email": "admin@telcobridges.com", "password": "..." }
Response: { "token": "eyJhbG...", "user": { "role": "admin" } }

// Use token for all subsequent calls
Headers: { "Authorization": "Bearer eyJhbG..." }
```

### 8.3 Settings Configurable via UI
All Claude integration settings are manageable from the admin **Setup** page:
- Server URL, auth type, auth credentials
- Model selection, max tokens
- Auto-assign confidence threshold
- SSH/SFTP connection details
- Analysis mode toggle (API vs SSH)

---

## 9. Current Limitations & Pain Points

1. **Single-shot analysis** — Claude analyzes once; no follow-up or refinement
2. **No historical context** — Each analysis is independent; doesn't learn from past tickets
3. **Limited file type support** — Only text, JSON, log, config, and image files are analyzed
4. **No proactive monitoring** — Claude only acts when explicitly triggered
5. **No customer-facing AI** — All AI interaction is backend-only for admin/engineer use
6. **Static prompts** — The analysis prompt is hardcoded, not tunable per product/category
7. **No feedback loop** — Engineers can't rate or correct Claude's analysis to improve future results

---

## 10. Docker Deployment

```yaml
# docker-compose.yml
services:
  app:
    build: .
    container_name: tbticket
    ports: ["4001:4001"]
    environment:
      - CLAUDE_SERVER_URL=http://claude-support-2.telcobridges.lan
      - CLAUDE_USER=support
      - CLAUDE_PASS=support
      - CLAUDE_MODEL=claude-sonnet-4-20250514
    volumes:
      - ticket_data:/app/server/data      # SQLite DB
      - ticket_uploads:/app/server/uploads # Attached files
    extra_hosts:
      - "claude-support-2.telcobridges.lan:10.0.0.241"
```

---

## 11. Questions for the Claude Code Server Team

1. **Can we implement a persistent context/memory** so Claude remembers past ticket analyses and resolutions for the same product?
2. **Can Claude Code Server expose a webhook endpoint** that our system can call with structured ticket data, instead of us SSHing in?
3. **Is there a way to give Claude access to our product documentation** (PDFs, wikis) as a persistent knowledge base?
4. **Can we set up MCP (Model Context Protocol) tools** that let Claude directly query our ticket database or call our APIs?
5. **What's the best approach for multi-turn conversations** — should we manage conversation state on our side or can Claude Code Server handle sessions?
6. **Can Claude Code Server run scheduled tasks** (e.g., nightly analysis of all open tickets for SLA risk)?
7. **What are the rate limits and concurrency constraints** for our in-house deployment?
8. **Can we implement a feedback mechanism** where engineer corrections improve future analyses?

---

*Document generated: 2026-03-23*
*System version: TelcoBridges Smart Ticket System v1.0*
*Contact: TelcoBridges Support Engineering Team*
