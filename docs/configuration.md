# Configuration Reference

All settings can be configured via environment variables (for Docker deployment) or the admin Setup page (runtime).

---

## Environment Variables

These are set in `docker-compose.yml` or a `.env` file.

### Application

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4001` | Server port |
| `NODE_ENV` | `production` | Environment mode |
| `JWT_SECRET` | (change in prod!) | JWT signing secret — must be unique per deployment |
| `CORS_ORIGIN` | `http://localhost:4001` | Allowed CORS origin |
| `APP_URL` | `http://localhost:4001` | Public URL (used in emails and links) |

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://ticketuser:ticketpass@postgres:5432/tickets` | Full PostgreSQL connection string |
| `POSTGRES_PASSWORD` | `ticketpass` | PostgreSQL password (for docker-compose) |

### Claude AI

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_SERVER_URL` | `http://claude-support-2.telcobridges.lan` | Claude API endpoint |
| `CLAUDE_USER` | `support` | Claude server username |
| `CLAUDE_PASS` | `support` | Claude server password |
| `CLAUDE_MODEL` | `claude-sonnet-4-20250514` | Claude model ID |

### Email (SMTP)

| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_HOST` | (empty) | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_SECURE` | `false` | Use TLS |
| `SMTP_USER` | (empty) | SMTP username |
| `SMTP_PASS` | (empty) | SMTP password |
| `SMTP_FROM` | `support@telcobridges.com` | From email address |

### Webhooks

| Variable | Default | Description |
|----------|---------|-------------|
| `SLACK_WEBHOOK_URL` | (empty) | Slack incoming webhook URL |
| `TEAMS_WEBHOOK_URL` | (empty) | Microsoft Teams webhook URL |

### File Uploads

| Variable | Default | Description |
|----------|---------|-------------|
| `UPLOAD_DIR` | `/app/server/uploads` | File storage directory |
| `UPLOAD_HOST_PATH` | (empty) | Host path mapping for Claude server file access |

---

## Runtime Settings (Admin Setup Page)

These are stored in the `settings` database table and configurable at `/admin/setup`.

### Claude AI Settings

| Key | Description |
|-----|-------------|
| `claude_server_url` | API endpoint URL |
| `claude_auth_type` | basic / bearer / api-key |
| `claude_username` | Username for basic auth |
| `claude_password` | Password for basic auth |
| `claude_bearer_token` | Token for bearer auth |
| `claude_api_key` | Key for api-key auth |
| `claude_model` | Model ID |
| `claude_max_tokens` | Max response tokens |
| `claude_analysis_mode` | api / ssh / wrapper |
| `auto_assign_threshold` | Confidence threshold (0.0-1.0) |

### SSH/SFTP Settings

| Key | Description |
|-----|-------------|
| `ssh_host` | SSH server hostname |
| `ssh_port` | SSH port (default: 22) |
| `ssh_username` | SSH username |
| `ssh_password` | SSH password |
| `ssh_remote_path` | Remote ticket directory |
| `ssh_timeout` | Timeout in ms |

### Jira Settings

| Key | Description |
|-----|-------------|
| `jira_base_url` | Jira instance URL |
| `jira_api_email` | Jira API email |
| `jira_api_token` | Jira API token |
| `jira_project_key` | Default project key |
| `jira_issue_type` | Default issue type |

### Automation Settings

| Key | Description |
|-----|-------------|
| `auto_close_days` | Days of inactivity before auto-close |
| `auto_state_transitions` | Enable rule-based status changes |
| `idle_ticket_alert_hours` | Hours before idle alert |
| `customer_reminder_hours` | Hours before customer reminder |

### License Validation

| Key | Description |
|-----|-------------|
| `license_api_url` | External license validation API |
| `license_api_key` | API key for license validation |

---

## Application Defaults (config.ts)

Hardcoded defaults in `server/src/config.ts`:

| Setting | Value |
|---------|-------|
| Max file size | 100 MB |
| Max files per upload | 10 |
| JWT expiry | 24 hours |
| Auto-assign threshold | 0.7 |
| Scheduler interval | 5 minutes |
