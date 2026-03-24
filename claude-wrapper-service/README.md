# Claude Analysis Wrapper Service

Thin HTTP wrapper around the Claude Code CLI. Deploy on the Claude Code server to enable automated ticket analysis.

## Quick Start

```bash
# On claude-support-2.telcobridges.lan
cd /opt/claude-wrapper
npm install
AUTH_TOKEN=your-secret-token npm start
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WRAPPER_PORT` | `4002` | HTTP port |
| `TICKETS_DIR` | `/home/support/incoming/tickets` | Where ticket files are stored |
| `CLAUDE_BIN` | `claude` | Path to Claude Code CLI binary |
| `ALLOWED_TOOLS` | `Read,Grep,Glob,Bash(grep:*),...` | Pre-approved tools (no human approval needed) |
| `AUTH_TOKEN` | `tb-claude-wrapper-secret` | Shared secret for authentication |
| `ANALYSIS_TIMEOUT` | `300000` | CLI timeout in ms (5 min) |

## API

### `POST /analyze`
Send ticket data, get Claude's analysis back.

```bash
curl -X POST http://localhost:4002/analyze \
  -H "Content-Type: application/json" \
  -H "x-auth-token: your-secret-token" \
  -d '{
    "ticketNumber": "TKT-20260323-ABC",
    "subject": "ProSBC SIP registration failure",
    "description": "Calls dropping after TLS cert renewal...",
    "productName": "ProSBC",
    "productModel": "SBC",
    "categoryName": "Configuration",
    "engineers": [
      { "id": 1, "name": "John", "skills": "SIP(5/5)", "expertise": "ProSBC/Config(4/5)", "workload": "2/5" }
    ],
    "attachments": [
      { "filename": "sip.log", "content": "<base64-encoded-content>" }
    ]
  }'
```

### `POST /upload/:ticketNumber`
Upload files separately (multipart form).

### `GET /tickets`
List all analyzed ticket directories.

### `DELETE /tickets/:ticketNumber`
Cleanup ticket files after analysis.

### `GET /health`
Health check.

## systemd Service (Optional)

```ini
# /etc/systemd/system/claude-wrapper.service
[Unit]
Description=Claude Analysis Wrapper
After=network.target

[Service]
Type=simple
User=support
WorkingDirectory=/opt/claude-wrapper
ExecStart=/usr/bin/node server.js
Environment=AUTH_TOKEN=your-secret-token
Environment=WRAPPER_PORT=4002
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable claude-wrapper
sudo systemctl start claude-wrapper
```
