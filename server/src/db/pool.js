import pg from 'pg';
import { getCompanyDb, DEFAULT_COMPANY_ID } from '../config/companies.js';
import { als } from '../logging/als.js';
import { env } from '../config/env.js';

/* One connection pool per company (per PostgreSQL database).
   Lazy-created and cached; a failed connect evicts the pool so a
   later request can retry fresh.

   A pool is also evicted when its company's entry in config/companies.json
   changes, so editing a host, port, user or password in that file takes effect
   without a restart - the next request rebuilds the pool and drains the old one.

   The pool size comes from env.DB.max (PG_MAX, default 20). It must be budgeted
   against the server's max_connections:  workers x PG_MAX + headroom <=
   max_connections, otherwise workers start failing to get a connection before
   the database is actually saturated. */
const pools = new Map();

const configKey = (cfg) => JSON.stringify(cfg);

export function getPoolFor(companyId) {
  const id = companyId || DEFAULT_COMPANY_ID;
  const cfg = getCompanyDb(id);
  if (!cfg) throw new Error(`Unknown company database: ${id}`);

  const key = configKey(cfg);
  const held = pools.get(id);
  if (held && held.key === key) return held.pool;
  if (held) {
    /* the connection details changed - drain the old pool, do not reuse it */
    console.log(`[pool ${id}] connection settings changed, rebuilding the pool`);
    pools.delete(id);
    held.pool.end().catch(() => {});
  }

  const pool = new pg.Pool({
    ...cfg,
    idleTimeoutMillis: env.PG_POOL_IDLE_MS,
    connectionTimeoutMillis: env.PG_POOL_CONNECT_TIMEOUT_MS,
  });
  pool.on('error', (err) => console.error(`[pool ${id}]`, err.message));
  pools.set(id, { pool, key });
  return pool;
}

export function getPool() {
  const company = als.getStore()?.company || DEFAULT_COMPANY_ID;
  return getPoolFor(company);
}

/* Drop one company's pool, or all of them. Used when a database is renamed or
   removed, and on shutdown. */
export async function closePool(companyId) {
  const id = companyId || DEFAULT_COMPANY_ID;
  const held = pools.get(id);
  if (!held) return false;
  pools.delete(id);
  await held.pool.end().catch(() => {});
  return true;
}

export async function closeAllPools() {
  const all = [...pools.keys()];
  await Promise.all(all.map((id) => closePool(id)));
  return all;
}

export async function ping() {
  const pool = getPool();
  await pool.query('SELECT 1');
}

export { pg };