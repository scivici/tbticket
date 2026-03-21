import fs from 'fs';
import path from 'path';
import { getDb } from './connection';

export function runMigrations(): void {
  const db = getDb();

  const schemaPath = path.join(__dirname, 'schema.sql');
  const seedPath = path.join(__dirname, 'seed.sql');

  // Check if tables already exist
  const tablesExist = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='products'"
  ).get();

  if (!tablesExist) {
    console.log('[DB] Running schema migration...');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
    console.log('[DB] Schema created successfully.');

    console.log('[DB] Running seed data...');
    const seed = fs.readFileSync(seedPath, 'utf-8');
    db.exec(seed);
    console.log('[DB] Seed data inserted successfully.');
  } else {
    console.log('[DB] Database already initialized.');
  }

  // Migration: add ticket_responses table if it doesn't exist
  const responsesTableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='ticket_responses'"
  ).get();

  if (!responsesTableExists) {
    console.log('[DB] Running ticket_responses migration...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS ticket_responses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ticket_id INTEGER NOT NULL REFERENCES tickets(id),
          author_id INTEGER NOT NULL REFERENCES customers(id),
          author_name TEXT NOT NULL,
          author_role TEXT NOT NULL CHECK(author_role IN ('admin', 'customer', 'engineer')),
          message TEXT NOT NULL,
          is_internal INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_ticket_responses_ticket ON ticket_responses(ticket_id);
    `);
    console.log('[DB] ticket_responses table created successfully.');
  }

  // Migration: add notifications table if it doesn't exist
  const notificationsTableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='notifications'"
  ).get();

  if (!notificationsTableExists) {
    console.log('[DB] Running notifications migration...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id INTEGER NOT NULL REFERENCES customers(id),
          ticket_id INTEGER NOT NULL REFERENCES tickets(id),
          type TEXT NOT NULL CHECK(type IN ('status_change', 'assigned', 'response', 'resolved')),
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          is_read INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_customer ON notifications(customer_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(customer_id, is_read);
    `);
    console.log('[DB] notifications table created successfully.');
  }

  // Migration: add sla_policies table if it doesn't exist
  const slaPoliciesTableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='sla_policies'"
  ).get();

  if (!slaPoliciesTableExists) {
    console.log('[DB] Running sla_policies migration...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS sla_policies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          priority TEXT NOT NULL UNIQUE CHECK(priority IN ('low', 'medium', 'high', 'critical')),
          response_time_hours INTEGER NOT NULL,
          resolution_time_hours INTEGER NOT NULL
      );
      INSERT OR IGNORE INTO sla_policies (priority, response_time_hours, resolution_time_hours) VALUES
      ('critical', 4, 24),
      ('high', 8, 48),
      ('medium', 24, 72),
      ('low', 48, 168);
    `);
    console.log('[DB] sla_policies table created and seeded successfully.');
  }

  // Migration: add product_key column to tickets if it doesn't exist
  const hasProductKey = db.prepare("PRAGMA table_info(tickets)").all().find((c: any) => c.name === 'product_key');
  if (!hasProductKey) {
    console.log('[DB] Adding product_key column to tickets...');
    db.exec('ALTER TABLE tickets ADD COLUMN product_key TEXT');
    console.log('[DB] product_key column added.');
  }

  // Migration: add company column to customers if it doesn't exist
  const hasCompany = db.prepare("PRAGMA table_info(customers)").all().find((c: any) => c.name === 'company');
  if (!hasCompany) {
    console.log('[DB] Adding company column to customers...');
    db.exec('ALTER TABLE customers ADD COLUMN company TEXT');
    console.log('[DB] company column added.');
  }

  // Migration: add settings table if it doesn't exist
  const settingsTableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='settings'"
  ).get();

  if (!settingsTableExists) {
    console.log('[DB] Running settings migration...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL,
          description TEXT,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT OR IGNORE INTO settings (key, value, description) VALUES
      ('license_api_url', '', 'License validation API endpoint URL'),
      ('license_api_method', 'GET', 'HTTP method for license API (GET or POST)'),
      ('license_api_headers', '{"Content-Type":"application/json"}', 'JSON headers for license API'),
      ('license_api_body_template', '{"productKey":"{{productKey}}"}', 'Request body template. Use {{productKey}} placeholder'),
      ('license_api_response_path', 'valid', 'JSON path in response that indicates validity (e.g., valid, data.hasSupport)'),
      ('license_api_auth_type', 'none', 'Auth type: none, basic, bearer'),
      ('license_api_auth_value', '', 'Auth credentials (username:password for basic, token for bearer)'),
      ('license_no_support_url', 'https://telcobridges.com/support-options/', 'URL to redirect customers without support agreement'),
      ('license_no_support_message', 'Your product does not have an active support agreement. Please visit our support options page to purchase one.', 'Message shown to customers without support'),
      ('smtp_host', '', 'SMTP server hostname'),
      ('smtp_port', '587', 'SMTP server port'),
      ('smtp_user', '', 'SMTP username'),
      ('smtp_pass', '', 'SMTP password'),
      ('smtp_from', 'support@telcobridges.com', 'From email address'),
      ('smtp_secure', 'false', 'Use TLS (true/false)'),
      ('slack_webhook_url', '', 'Slack incoming webhook URL'),
      ('teams_webhook_url', '', 'Microsoft Teams webhook URL'),
      ('company_name', 'TelcoBridges', 'Company name used in emails and UI'),
      ('support_email', 'support@telcobridges.com', 'Support contact email'),
      ('claude_server_url', '', 'Claude API server URL'),
      ('claude_auth_type', 'basic', 'Claude auth: none, basic, bearer, api-key'),
      ('claude_auth_value', '', 'Auth credentials (user:pass for basic, key for bearer/api-key)'),
      ('claude_model', 'claude-sonnet-4-20250514', 'Claude model to use'),
      ('claude_max_tokens', '2000', 'Max tokens for Claude response'),
      ('claude_auto_assign_threshold', '0.7', 'Min confidence to auto-assign (0-1)');
    `);
    console.log('[DB] settings table created and seeded successfully.');
  }

  // Migration: add Claude settings if missing (for existing DBs)
  const hasClaudeUrl = db.prepare("SELECT key FROM settings WHERE key = 'claude_server_url'").get();
  if (!hasClaudeUrl) {
    console.log('[DB] Adding Claude settings...');
    db.exec(`
      INSERT OR IGNORE INTO settings (key, value, description) VALUES
      ('claude_server_url', '', 'Claude API server URL'),
      ('claude_auth_type', 'basic', 'Claude auth: none, basic, bearer, api-key'),
      ('claude_auth_value', '', 'Auth credentials (user:pass for basic, key for bearer/api-key)'),
      ('claude_model', 'claude-sonnet-4-20250514', 'Claude model to use'),
      ('claude_max_tokens', '2000', 'Max tokens for Claude response'),
      ('claude_auto_assign_threshold', '0.7', 'Min confidence to auto-assign (0-1)');
    `);
    console.log('[DB] Claude settings added.');
  }
}
