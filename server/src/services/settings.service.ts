import { query, queryOne, queryAll, transaction, clientQuery } from '../db/connection';
import { cache } from './cache.service';

const SETTINGS_TTL = 60_000; // 60 seconds
const CACHE_PREFIX = 'settings:';

export async function getSetting(key: string): Promise<string> {
  const cacheKey = CACHE_PREFIX + key;
  const cached = cache.get<string>(cacheKey);
  if (cached !== undefined) return cached;

  const row = await queryOne<any>('SELECT value FROM settings WHERE key = ?', [key]);
  const value = row?.value || '';
  cache.set(cacheKey, value, SETTINGS_TTL);
  return value;
}

export async function getSettings(prefix?: string): Promise<Record<string, string>> {
  const cacheKey = CACHE_PREFIX + 'all:' + (prefix || '*');
  const cached = cache.get<Record<string, string>>(cacheKey);
  if (cached !== undefined) return cached;

  const rows = prefix
    ? await queryAll<any>("SELECT key, value FROM settings WHERE key LIKE ?", [prefix + '%'])
    : await queryAll<any>('SELECT key, value FROM settings');
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  cache.set(cacheKey, result, SETTINGS_TTL);
  return result;
}

export async function getAllSettings() {
  return await queryAll('SELECT key, value, description, updated_at FROM settings ORDER BY key');
}

export async function updateSetting(key: string, value: string) {
  await query("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP", [key, value, value]);
  cache.delByPrefix(CACHE_PREFIX);
}

export async function updateSettings(settings: Record<string, string>) {
  await transaction(async (client) => {
    for (const [key, value] of Object.entries(settings)) {
      await clientQuery(client, "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP", [key, value, value]);
    }
  });
  cache.delByPrefix(CACHE_PREFIX);
}
