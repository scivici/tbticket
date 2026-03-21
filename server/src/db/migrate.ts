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
}
