# Architecture

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, TailwindCSS, Vite |
| Backend | Express.js, TypeScript, tsx runtime |
| Database | PostgreSQL 16 (Docker), SQLite (legacy) |
| AI | Claude API (HTTP / SSH / Wrapper modes) |
| Runtime | Node.js 22 Alpine |
| Container | Docker, docker-compose |
| Auth | JWT (24h expiry) |

## High-Level Architecture

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

## Monorepo Structure

```
smart-ticket-system/
├── client/                    # React frontend
│   └── src/
│       ├── api/               # API client functions
│       ├── components/        # Reusable UI components
│       │   ├── Layout.tsx
│       │   ├── AdminLayout.tsx
│       │   ├── Navbar.tsx
│       │   ├── ChatWidget.tsx
│       │   ├── NotificationBell.tsx
│       │   ├── Pagination.tsx
│       │   ├── StatusBadge.tsx
│       │   ├── Stepper.tsx
│       │   ├── ThemeToggle.tsx
│       │   └── Toast.tsx
│       ├── context/           # React contexts (auth, theme)
│       ├── pages/
│       │   ├── admin/         # Admin panel pages
│       │   │   ├── Dashboard.tsx
│       │   │   ├── TicketList.tsx
│       │   │   ├── TicketDetail.tsx
│       │   │   ├── EngineerManager.tsx
│       │   │   ├── ProductManager.tsx
│       │   │   ├── CategoryManager.tsx
│       │   │   ├── QuestionManager.tsx
│       │   │   ├── SkillManager.tsx
│       │   │   ├── SetupPage.tsx
│       │   │   ├── SlaDashboard.tsx
│       │   │   ├── EscalationManager.tsx
│       │   │   ├── CannedResponseManager.tsx
│       │   │   ├── RecurringTickets.tsx
│       │   │   ├── CustomerList.tsx
│       │   │   ├── UserManager.tsx
│       │   │   ├── HealthDashboard.tsx
│       │   │   ├── TimeReports.tsx
│       │   │   └── TicketPrint.tsx
│       │   ├── HomePage.tsx
│       │   ├── LoginPage.tsx
│       │   ├── RegisterPage.tsx
│       │   ├── TicketWizard/     # Step-by-step ticket creation
│       │   ├── MyTickets.tsx
│       │   ├── CustomerTicketDetail.tsx
│       │   ├── TicketTracker.tsx  # Public tracking (no auth)
│       │   ├── KnowledgeBase.tsx
│       │   ├── ReleaseNotes.tsx
│       │   ├── ProfilePage.tsx
│       │   └── NotFound.tsx
│       ├── App.tsx
│       └── main.tsx
│
├── server/                    # Express backend
│   └── src/
│       ├── controllers/       # Route handlers
│       │   ├── auth.controller.ts
│       │   ├── tickets.controller.ts
│       │   ├── engineers.controller.ts
│       │   ├── admin.controller.ts
│       │   ├── admin-products.controller.ts
│       │   ├── admin-categories.controller.ts
│       │   ├── admin-questions.controller.ts
│       │   ├── admin-skills.controller.ts
│       │   ├── admin-users.controller.ts
│       │   ├── canned-responses.controller.ts
│       │   └── products.controller.ts
│       ├── services/          # Business logic
│       │   ├── ticket.service.ts
│       │   ├── claude.service.ts         # HTTP API mode
│       │   ├── claude-ssh.service.ts     # SSH/SFTP mode
│       │   ├── claude-wrapper.service.ts # Wrapper service mode
│       │   ├── assignment.service.ts     # Engineer matching
│       │   ├── sla.service.ts
│       │   ├── escalation.service.ts
│       │   ├── jira.service.ts
│       │   ├── email.service.ts
│       │   ├── email-receiver.service.ts
│       │   ├── notification.service.ts
│       │   ├── webhook.service.ts
│       │   ├── scheduler.service.ts      # Background tasks
│       │   ├── activity.service.ts
│       │   ├── recurring.service.ts
│       │   ├── license.service.ts
│       │   ├── chat.service.ts
│       │   ├── cache.service.ts
│       │   ├── logger.service.ts
│       │   └── settings.service.ts
│       ├── routes/            # Express route definitions
│       ├── middleware/        # Auth, error handling
│       ├── db/                # Database setup, migrations
│       ├── types/             # TypeScript type definitions
│       ├── config.ts          # Environment configuration
│       └── index.ts           # Entry point
│
├── shared/                    # Shared types between client/server
│   └── types.ts
│
├── docs/                      # Project documentation
├── docker-compose.yml
├── Dockerfile
└── package.json               # Workspace root
```

## Key Design Decisions

1. **Monorepo with npm workspaces** — client, server, shared packages in one repo
2. **tsx runtime** — TypeScript runs directly without pre-compilation in production
3. **Static file serving** — Built React app served by Express (no separate web server)
4. **PostgreSQL** — Production database with Docker health checks
5. **JWT auth** — Stateless authentication, 24h token expiry
6. **Background scheduler** — In-process task runner (5-min interval) for SLA checks, auto-close, reminders
