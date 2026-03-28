import path from 'path';

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT) : 4001,
  jwtSecret: process.env.JWT_SECRET || 'smart-ticket-system-secret-key-change-in-production',
  jwtExpiresIn: '24h',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://ticketuser:ticketpass@localhost:5432/tickets',
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'),
  uploadHostPath: process.env.UPLOAD_HOST_PATH || '', // Host path mapping for shared filesystem with Claude server
  maxFileSize: 100 * 1024 * 1024, // 100MB per file
  maxFiles: 10,
  claudeServerUrl: process.env.CLAUDE_SERVER_URL || 'http://claude-support-2.telcobridges.lan',
  claudeUser: process.env.CLAUDE_USER || 'support',
  claudePass: process.env.CLAUDE_PASS || 'support',
  claudeModel: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
  autoAssignThreshold: 0.7,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:4173',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'support@telcobridges.com',
  },
  appUrl: process.env.APP_URL || 'http://localhost:4001',
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',
  teamsWebhookUrl: process.env.TEAMS_WEBHOOK_URL || '',
};
