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

  // Future migrations can be added here using pattern:
  // const colExists = await query(
  //   "SELECT column_name FROM information_schema.columns WHERE table_name = 'X' AND column_name = 'Y'"
  // );
  // if (colExists.rows.length === 0) {
  //   await query("ALTER TABLE X ADD COLUMN Y ...");
  // }
}
