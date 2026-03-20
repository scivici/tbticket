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
}
