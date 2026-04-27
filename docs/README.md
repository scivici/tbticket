# TelcoBridges Smart Ticket System

An in-house technical support ticket system built for **TelcoBridges**, a telecom equipment manufacturer. The system handles support tickets for 7 telecom products (ProSBC, Tmedia/Tsig Gateways) with AI-powered ticket triage, automatic engineer assignment, SLA tracking, Jira integration, and lifecycle automation.

---

## Key Highlights

- **AI-Powered Triage** — Claude AI analyzes every ticket: classifies the issue, assesses severity, recommends the best-fit engineer, and auto-assigns with configurable confidence threshold
- **3 AI Modes** — HTTP API, SSH/SFTP (Claude Code CLI), or Wrapper Service for maximum flexibility
- **Dynamic Questionnaires** — Conditional question templates per product/category with 8 question types
- **Full Lifecycle Automation** — Auto-close, auto-reminders, rule-based state transitions, idle alerts
- **Jira Integration** — Create Jira issues from tickets, live status sync, AI-suggested escalation
- **Time Tracking** — Manual time entry, chargeable/non-chargeable hours, professional service hour tracking
- **SLA Management** — Per-priority SLA policies, breach detection, compliance reports
- **Multi-Channel Notifications** — In-app, email (SMTP), Slack webhooks, Teams webhooks

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, TailwindCSS, Vite |
| Backend | Express.js, TypeScript, tsx runtime |
| Database | PostgreSQL 16 |
| AI | Claude API (Anthropic) |
| Runtime | Node.js 22 Alpine |
| Container | Docker, docker-compose |
| Auth | JWT (24h expiry) |

---

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start both server and client
npm run dev

# Server: http://localhost:4001
# Client: http://localhost:5173
```

### Docker (Production)

```bash
# Build and start
docker-compose up -d --build

# Access: http://localhost:4001
```

### Default Admin Login

```
Email:    admin@telcobridges.com
Password: (set during first deployment)
```

---

## Supported Products

| Product | Models | Domain |
|---------|--------|--------|
| ProSBC | Session Border Controller | VoIP security, SIP routing, transcoding |
| Tmedia Gateway | TMG800, TMG3200, TMG7800 | Small/mid/large-scale media gateway |
| Tsig Gateway | TSG800, TSG3200 | Small/large signaling gateway |

Products, categories, and question templates are fully configurable from the admin panel.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Container (port 4001)              │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │  React 19     │    │  Express.js   │    │  PostgreSQL  │   │
│  │  Frontend     │───>│  REST API     │───>│  Database    │   │
│  │  (Vite/TW)   │    │  TypeScript   │    │              │   │
│  └──────────────┘    └──────┬───────┘    └──────────────┘   │
│                             │                                │
│                    ┌────────┴─────────┐                      │
│                    │                  │                       │
│              ┌─────▼─────┐   ┌───────▼────────┐             │
│              │ Claude API │   │ Claude SSH/SFTP │             │
│              │ (HTTP)     │   │ (CLI mode)      │             │
│              └───────────┘   └────────────────┘             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
smart-ticket-system/
├── client/                    # React frontend (Vite)
│   └── src/
│       ├── api/               # API client functions
│       ├── components/        # Reusable UI (Layout, Navbar, Toast, Pagination...)
│       ├── context/           # Auth & theme contexts
│       └── pages/
│           ├── admin/         # 18 admin pages (Dashboard, TicketList, Engineers...)
│           ├── TicketWizard/  # Step-by-step ticket creation
│           ├── MyTickets.tsx  # Customer ticket list
│           └── ...            # Login, Register, KnowledgeBase, ReleaseNotes
│
├── server/                    # Express backend (TypeScript)
│   └── src/
│       ├── controllers/       # 11 route handlers
│       ├── services/          # 18 business logic services
│       ├── routes/            # 11 route definitions
│       ├── middleware/        # Auth, error handling
│       ├── db/                # Database setup & migrations
│       ├── types/             # TypeScript definitions
│       └── config.ts          # Environment configuration
│
├── shared/                    # Shared types (client + server)
├── docs/                      # Project documentation
├── docker-compose.yml         # PostgreSQL + App containers
├── Dockerfile                 # Multi-stage build (Node 22 Alpine)
└── package.json               # npm workspace root
```

---

## Ticket Workflow

```
New → Analyzing (AI) → Assigned → In Progress → Pending Info → Escalated to Jira → Resolved → Closed
```

| Status | Description |
|--------|-------------|
| `new` | Ticket just created |
| `analyzing` | Claude AI is analyzing the ticket |
| `assigned` | Assigned to an engineer (auto or manual) |
| `in_progress` | Engineer is working on it |
| `pending_info` | Waiting for customer response |
| `escalated_to_jira` | Escalated to Jira for development team |
| `resolved` | Issue resolved, awaiting customer confirmation |
| `closed` | Ticket closed |

---

## Feature Summary

### Core (62 features implemented)

| Area | Features |
|------|----------|
| **Ticket Management** | Creation wizard, bulk ops, CSV export, audit trail, tags, attachments, ticket linking, CC support |
| **AI Integration** | Classification, severity assessment, root cause hypothesis, engineer recommendation, auto-assignment, suggested replies, KB generation |
| **Engineer Matching** | Skill proficiency (1-5), product expertise (1-5), workload balancing, shift-based routing |
| **SLA & Escalation** | Per-priority SLA, breach detection, escalation rules, compliance reports |
| **Jira Integration** | Create issues, status sync, AI-suggested escalation |
| **Time Tracking** | Manual entry, chargeable/non-chargeable, per-customer reports, PS hours |
| **Notifications** | In-app, email (SMTP), Slack, Teams webhooks |
| **Lifecycle** | Auto-close, auto-reminders, state transitions, idle/inactivity alerts |
| **Knowledge Base** | Resolved ticket → KB article conversion, similar ticket matching |
| **Customer Portal** | Registration, ticket creation, company visibility, profile, release notes |

### Completion Status

| Phase | Status |
|-------|--------|
| Quick Wins & Core UX | Done |
| Field Enforcement | Done |
| Company & Accounts | Done |
| Ticket Linking | Done |
| Lifecycle Automation | Done |
| Jira Integration | Done |
| AI Enhancements | Done |
| Time Tracking | Done |
| Notifications | Done |
| File Handling | Done |
| Advanced Integrations | 20% (Teams, WebSocket chat, Kimai pending) |

**Overall: 49/53 features (92%) implemented**

---

## Environment Variables

Key variables for Docker deployment:

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | JWT signing secret (change in production!) |
| `DATABASE_URL` | PostgreSQL connection string |
| `CLAUDE_SERVER_URL` | Claude AI endpoint |
| `CLAUDE_MODEL` | Claude model ID |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Email configuration |
| `SLACK_WEBHOOK_URL` | Slack notifications |
| `TEAMS_WEBHOOK_URL` | Teams notifications |
| `APP_URL` | Public application URL |

See [Configuration](configuration.md) for the full list.

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [Architecture](architecture.md) | System architecture, tech stack, detailed folder structure |
| [Installation & Deployment](installation.md) | Local dev setup, Docker deployment, environment variables |
| [API Reference](api-reference.md) | Full REST API endpoint documentation (60+ endpoints) |
| [Database Schema](database-schema.md) | All tables, columns, relationships, and data types |
| [AI Integration](ai-integration.md) | Claude API/SSH/Wrapper modes, analysis flow, configuration |
| [Feature Guide](features.md) | Complete feature list with customer and admin functionality |
| [Admin Guide](admin-guide.md) | Admin panel usage: engineers, products, SLA, Jira, setup |
| [Configuration](configuration.md) | All configurable settings (env vars + runtime settings) |

---

## Network & Deployment Info

| Item | Value |
|------|-------|
| Application Port | 4001 |
| Claude Server | claude-support-2.telcobridges.lan (10.0.0.241) |
| Docker Container | tbticket |
| Database Container | tbticket-db |
| Support Team | 5 engineers with skill/expertise profiles |

---

*TelcoBridges Smart Ticket System v1.0*
*Last updated: 2026-03-29*
*Contact: TelcoBridges Support Engineering Team*
