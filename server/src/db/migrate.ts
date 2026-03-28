import fs from 'fs';
import path from 'path';
import { query } from './connection';

export async function runMigrations(): Promise<void> {
  // Check if tables already exist
  const result = await query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'products'"
  );

  if (result.rows.length === 0) {
    console.log('[DB] Running schema migration...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await query(schema);
    console.log('[DB] Schema created successfully.');

    console.log('[DB] Running seed data...');
    const seedPath = path.join(__dirname, 'seed.sql');
    const seed = fs.readFileSync(seedPath, 'utf-8');
    await query(seed);
    console.log('[DB] Seed data inserted successfully.');
  } else {
    console.log('[DB] Database already initialized.');
  }

  // Migration: add ai_analysis_history column
  const historyCol = await query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'ai_analysis_history'"
  );
  if (historyCol.rows.length === 0) {
    await query("ALTER TABLE tickets ADD COLUMN ai_analysis_history JSONB DEFAULT '[]'::jsonb");
    console.log('[DB] Migration: added ai_analysis_history column');
  }

  // Migration: add activity_type to time_entries
  const activityTypeCol = await query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'time_entries' AND column_name = 'activity_type'"
  );
  if (activityTypeCol.rows.length === 0) {
    await query("ALTER TABLE time_entries ADD COLUMN activity_type TEXT NOT NULL DEFAULT 'general'");
    console.log('[DB] Migration: added activity_type column to time_entries');
  }

  // Migration: add active_timers table for start/stop timer
  const timerTable = await query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'active_timers'"
  );
  if (timerTable.rows.length === 0) {
    await query(`
      CREATE TABLE active_timers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES customers(id),
        ticket_id INTEGER NOT NULL REFERENCES tickets(id),
        activity_type TEXT NOT NULL DEFAULT 'general',
        description TEXT,
        started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      )
    `);
    console.log('[DB] Migration: created active_timers table');
  }

  // Migration: custom_fields table
  const customFieldsTable = await query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'custom_fields'"
  );
  if (customFieldsTable.rows.length === 0) {
    await query(`
      CREATE TABLE IF NOT EXISTS custom_fields (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        field_key TEXT UNIQUE NOT NULL,
        field_type TEXT NOT NULL CHECK(field_type IN ('text', 'number', 'select', 'checkbox', 'date', 'textarea')),
        options JSONB,
        is_required BOOLEAN NOT NULL DEFAULT FALSE,
        display_order INTEGER NOT NULL DEFAULT 0,
        product_id INTEGER REFERENCES products(id),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS ticket_custom_field_values (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id),
        field_id INTEGER NOT NULL REFERENCES custom_fields(id),
        value TEXT,
        UNIQUE(ticket_id, field_id)
      )
    `);
    console.log('[DB] Migration: created custom_fields and ticket_custom_field_values tables');
  }
}
