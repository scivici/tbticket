import { query, queryOne, queryAll, transaction, clientQuery } from '../db/connection';

export async function getSetting(key: string): Promise<string> {
  const row = await queryOne<any>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value || '';
}

export async function getSettings(prefix?: string): Promise<Record<string, string>> {
  const rows = prefix
    ? await queryAll<any>("SELECT key, value FROM settings WHERE key LIKE ?", [prefix + '%'])
    : await queryAll<any>('SELECT key, value FROM settings');
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  return result;
}

export async function getAllSettings() {
  return await queryAll('SELECT key, value, description, updated_at FROM settings ORDER BY key');
}

export async function updateSetting(key: string, value: string) {
  await query("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP", [key, value, value]);
}

export async function updateSettings(settings: Record<string, string>) {
  await transaction(async (client) => {
    for (const [key, value] of Object.entries(settings)) {
      await clientQuery(client, "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP", [key, value, value]);
    }
  });
}
