import { getDb } from '../db/connection';

export function getSetting(key: string): string {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
  return row?.value || '';
}

export function getSettings(prefix?: string): Record<string, string> {
  const db = getDb();
  const rows = prefix
    ? db.prepare("SELECT key, value FROM settings WHERE key LIKE ?").all(prefix + '%') as any[]
    : db.prepare('SELECT key, value FROM settings').all() as any[];
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  return result;
}

export function getAllSettings() {
  const db = getDb();
  return db.prepare('SELECT key, value, description, updated_at FROM settings ORDER BY key').all();
}

export function updateSetting(key: string, value: string) {
  const db = getDb();
  db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')").run(key, value, value);
}

export function updateSettings(settings: Record<string, string>) {
  const db = getDb();
  const stmt = db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')");
  db.transaction(() => {
    for (const [key, value] of Object.entries(settings)) {
      stmt.run(key, value, value);
    }
  })();
}
