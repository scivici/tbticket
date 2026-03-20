import path from 'path';

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT) : 4001,
  jwtSecret: process.env.JWT_SECRET || 'smart-ticket-system-secret-key-change-in-production',
  jwtExpiresIn: '24h',
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'tickets.db'),
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'),
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  claudeServerUrl: process.env.CLAUDE_SERVER_URL || 'http://localhost:3002',
  claudeModel: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
  autoAssignThreshold: 0.7,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:4173',
};
