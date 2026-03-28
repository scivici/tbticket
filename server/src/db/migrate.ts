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
}
