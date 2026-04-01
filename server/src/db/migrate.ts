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

  // Migration: custom_fields table (feature removed - duplicates Question Templates; tables kept for backward compatibility)
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

  // Migration: add is_chat column to ticket_responses for live chat messages
  const isChatCol = await query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'ticket_responses' AND column_name = 'is_chat'"
  );
  if (isChatCol.rows.length === 0) {
    await query("ALTER TABLE ticket_responses ADD COLUMN is_chat BOOLEAN NOT NULL DEFAULT FALSE");
    console.log('[DB] Migration: added is_chat column to ticket_responses');
  }

  // Migration: release_notes table
  const releaseNotesTable = await query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'release_notes'"
  );
  if (releaseNotesTable.rows.length === 0) {
    await query(`
      CREATE TABLE IF NOT EXISTS release_notes (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id),
        version TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        published BOOLEAN NOT NULL DEFAULT FALSE,
        created_by INTEGER REFERENCES customers(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[DB] Migration: created release_notes table');
  }

  // Migration: customer_diagrams table
  const customerDiagramsTable = await query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'customer_diagrams'"
  );
  if (customerDiagramsTable.rows.length === 0) {
    await query(`
      CREATE TABLE IF NOT EXISTS customer_diagrams (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        path TEXT NOT NULL,
        label TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[DB] Migration: created customer_diagrams table');
  }

  // Migration: add Jira credentials per engineer
  const jiraEmailCol = await query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'engineers' AND column_name = 'jira_email'"
  );
  if (jiraEmailCol.rows.length === 0) {
    await query("ALTER TABLE engineers ADD COLUMN jira_email TEXT");
    await query("ALTER TABLE engineers ADD COLUMN jira_api_token TEXT");
    await query("ALTER TABLE engineers ADD COLUMN jira_base_url TEXT");
    await query("ALTER TABLE engineers ADD COLUMN jira_project_key TEXT");
    console.log('[DB] Migration: added Jira credential columns to engineers');
  }

  // Migration: add professional_service_hours column to customers
  const psHoursCol = await query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'professional_service_hours'"
  );
  if (psHoursCol.rows.length === 0) {
    await query("ALTER TABLE customers ADD COLUMN professional_service_hours NUMERIC(10,2) DEFAULT 0");
    console.log('[DB] Migration: added professional_service_hours column to customers');
  }

  // Migration: ai_usage_log table for token tracking
  const aiUsageTable = await query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_usage_log'"
  );
  if (aiUsageTable.rows.length === 0) {
    await query(`
      CREATE TABLE ai_usage_log (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER REFERENCES tickets(id),
        action TEXT NOT NULL,
        model TEXT,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        execution_seconds NUMERIC(10,2),
        actor_id INTEGER,
        actor_name TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query('CREATE INDEX idx_ai_usage_ticket ON ai_usage_log(ticket_id)');
    await query('CREATE INDEX idx_ai_usage_created ON ai_usage_log(created_at)');
    console.log('[DB] Migration: created ai_usage_log table');
  }

  // Migration: convert jira_issue_key TEXT to jira_issue_keys JSONB (multi-key support) + add bugzilla_issue_keys
  const jiraKeysCol = await query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'jira_issue_keys'"
  );
  if (jiraKeysCol.rows.length === 0) {
    // Create new JSONB columns
    await query("ALTER TABLE tickets ADD COLUMN jira_issue_keys JSONB DEFAULT '[]'::jsonb");
    await query("ALTER TABLE tickets ADD COLUMN bugzilla_issue_keys JSONB DEFAULT '[]'::jsonb");
    // Migrate existing single jira_issue_key to the new array column
    await query(`
      UPDATE tickets SET jira_issue_keys = jsonb_build_array(jira_issue_key)
      WHERE jira_issue_key IS NOT NULL AND jira_issue_key != ''
    `);
    console.log('[DB] Migration: added jira_issue_keys and bugzilla_issue_keys JSONB columns, migrated existing data');
  }

  // Migration: add password_hash to engineers (for engineer login)
  const engPwCol = await query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'engineers' AND column_name = 'password_hash'"
  );
  if (engPwCol.rows.length === 0) {
    await query("ALTER TABLE engineers ADD COLUMN password_hash TEXT");
    console.log('[DB] Migration: added password_hash column to engineers');
  }
}
