# Installation & Deployment

## Prerequisites

- Node.js 22+
- npm 10+
- Docker & Docker Compose (for production)
- PostgreSQL 16 (Docker provides this automatically)

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start both server and client in dev mode
npm run dev

# Server runs on: http://localhost:4001
# Client runs on: http://localhost:5173 (Vite dev server)

# Or start individually:
npm run dev:server
npm run dev:client
```

## Docker Deployment (Production)

```bash
# 1. Copy and configure environment variables
#    Edit docker-compose.yml or create a .env file

# 2. Build and start
docker-compose up -d --build

# 3. Access the application
#    http://localhost:4001
```

### Docker Services

| Service | Container | Port | Description |
|---------|-----------|------|-------------|
| `app` | tbticket | 4001 | Application (Express + React) |
| `postgres` | tbticket-db | 5432 (internal) | PostgreSQL database |

### Docker Volumes

| Volume | Mount Point | Description |
|--------|-------------|-------------|
| `pg_data` | `/var/lib/postgresql/data` | PostgreSQL data |
| Host uploads dir | `/app/server/uploads` | File attachments |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4001` | Application port |
| `NODE_ENV` | `production` | Environment mode |
| `JWT_SECRET` | (change in prod) | JWT signing secret |
| `DATABASE_URL` | `postgresql://ticketuser:ticketpass@postgres:5432/tickets` | PostgreSQL connection string |
| `CLAUDE_SERVER_URL` | `http://claude-support-2.telcobridges.lan` | Claude server endpoint |
| `CLAUDE_USER` | `support` | Claude server username |
| `CLAUDE_PASS` | `support` | Claude server password |
| `CLAUDE_MODEL` | `claude-sonnet-4-20250514` | Claude model ID |
| `CORS_ORIGIN` | `http://localhost:4001` | Allowed CORS origin |
| `SMTP_HOST` | (empty) | SMTP server for email |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | (empty) | SMTP username |
| `SMTP_PASS` | (empty) | SMTP password |
| `SMTP_FROM` | `support@telcobridges.com` | From email address |
| `SLACK_WEBHOOK_URL` | (empty) | Slack notification webhook |
| `TEAMS_WEBHOOK_URL` | (empty) | Teams notification webhook |
| `APP_URL` | `http://localhost:4001` | Public application URL |
| `UPLOAD_DIR` | `/app/server/uploads` | File upload directory |
| `UPLOAD_HOST_PATH` | (empty) | Host path for shared filesystem with Claude server |

## Build for Production

```bash
# Build all packages (shared -> server -> client)
npm run build
```

## DNS Configuration

The Docker container uses custom DNS and host entries:

```yaml
dns:
  - 10.0.0.1
extra_hosts:
  - "host.docker.internal:host-gateway"
  - "claude-support-2.telcobridges.lan:10.0.0.241"
```

Ensure `claude-support-2.telcobridges.lan` resolves to `10.0.0.241` in your network.
