import { Pool, PoolClient, QueryResult } from 'pg';
import { config } from '../config';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    pool.on('error', (err) => {
      console.error('[DB] Unexpected pool error:', err.message);
    });
  }
  return pool;
}

/**
 * Convert SQLite-style `?` placeholders to PostgreSQL `$1, $2, ...` style.
 * Handles quoted strings and avoids replacing `?` inside them.
 */
function convertPlaceholders(sql: string): string {
  let idx = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let result = '';

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const prev = i > 0 ? sql[i - 1] : '';

    if (ch === "'" && prev !== '\\' && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      result += ch;
    } else if (ch === '"' && prev !== '\\' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      result += ch;
    } else if (ch === '?' && !inSingleQuote && !inDoubleQuote) {
      idx++;
      result += `$${idx}`;
    } else {
      result += ch;
    }
  }

  return result;
}

/**
 * Execute a query and return the full result.
 */
export async function query(sql: string, params: any[] = []): Promise<QueryResult> {
  const pgSql = convertPlaceholders(sql);
  return getPool().query(pgSql, params);
}

/**
 * Execute a query and return the first row, or null.
 */
export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const result = await query(sql, params);
  return (result.rows[0] as T) || null;
}

/**
 * Execute a query and return all rows.
 */
export async function queryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const result = await query(sql, params);
  return result.rows as T[];
}

/**
 * Execute a function within a transaction.
 * The client is passed to fn for all queries within the transaction.
 */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Helper for transaction client queries with ? placeholder conversion.
 */
export function clientQuery(client: PoolClient, sql: string, params: any[] = []): Promise<QueryResult> {
  const pgSql = convertPlaceholders(sql);
  return client.query(pgSql, params);
}

/**
 * Close the connection pool.
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
