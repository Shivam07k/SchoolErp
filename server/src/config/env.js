import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnv = path.join(__dirname, '../../../.env');
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });

function num(v, d) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; }

/* Render exposes the public service URL automatically. Using it as the CORS
   fallback means a freshly created service works without a second edit. */
const renderUrl = String(process.env.RENDER_EXTERNAL_URL || '').trim();
const defaultCors = renderUrl || 'http://localhost:5173,http://localhost:3100';

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: num(process.env.PORT, 3100),
  DB: {
    host: process.env.PG_HOST || 'localhost',
    port: num(process.env.PG_PORT, 5432),
    user: process.env.PG_USER || 'xerp',
    password: process.env.PG_PASSWORD || '',
    database: process.env.PG_DATABASE || 'xerp',
    /* Pool size per worker process. Budget: workers x max <= max_connections
       minus headroom for superuser/autovacuum. 20 suits a 4-worker node
       against the default max_connections=100. */
    max: num(process.env.PG_MAX, 20),
    min: num(process.env.PG_MIN, 0),
    idleTimeoutMillis: num(process.env.PG_POOL_IDLE_MS, 30000),
    connectionTimeoutMillis: num(process.env.PG_POOL_CONNECT_TIMEOUT_MS, 10000),
    application_name: 'pg-xerp',
    /* Supabase requires TLS. Keep this opt-in so local PostgreSQL works
       without a certificate. */
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  },
  PG_POOL_IDLE_MS: num(process.env.PG_POOL_IDLE_MS, 30000),
  PG_POOL_CONNECT_TIMEOUT_MS: num(process.env.PG_POOL_CONNECT_TIMEOUT_MS, 10000),
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  JWT_TTL: process.env.JWT_TTL || '24h',
  MASTER_PASSWORD: process.env.MASTER_PASSWORD || null,
  ALLOW_MASTER_PASSWORD: process.env.ALLOW_MASTER_PASSWORD === 'true',
  CORS_ORIGIN: process.env.CORS_ORIGIN || defaultCors,
  RATE_LIMIT_WINDOW_MS: num(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
  RATE_LIMIT_MAX: num(process.env.RATE_LIMIT_MAX, 600),
  /* the login limiter is deliberately tight, but hardcoding it locks any
     environment that logs in from a script (test runs, smoke checks) out for
     15 minutes at a time, so it follows the same override pattern */
  LOGIN_RATE_LIMIT_WINDOW_MS: num(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60_000),
  LOGIN_RATE_LIMIT_MAX: num(process.env.LOGIN_RATE_LIMIT_MAX, 10),
  SQL_LOG: process.env.SQL_LOG === undefined
    ? (process.env.NODE_ENV || 'development') !== 'production'
    : process.env.SQL_LOG === 'true',
  SQL_LOG_FLUSH_MS: num(process.env.SQL_LOG_FLUSH_MS, 250),
  SQL_LOG_MAX_BUFFER: num(process.env.SQL_LOG_MAX_BUFFER, 500),
  STORAGE: {
    url: String(process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    bucket: process.env.SUPABASE_STORAGE_BUCKET || 'school-uploads',
  },
};

export function validateProductionEnv() {
  if (env.NODE_ENV !== 'production') return;
  const problems = [];
  if (!env.DB.password) problems.push('PG_PASSWORD is required');
  if (env.JWT_SECRET === 'dev-secret-change-me' || env.JWT_SECRET.length < 32) {
    problems.push('JWT_SECRET must be a random value of at least 32 characters');
  }
  if (env.CORS_ORIGIN.split(',').some((origin) => /localhost|127\.0\.0\.1/i.test(origin.trim()))) {
    problems.push('CORS_ORIGIN must not contain localhost origins');
  }
  if (env.MASTER_PASSWORD && !env.ALLOW_MASTER_PASSWORD) {
    problems.push('MASTER_PASSWORD is disabled in production unless ALLOW_MASTER_PASSWORD=true');
  }
  const storage = env.STORAGE;
  if (!!storage.url !== !!storage.serviceKey) {
    problems.push('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set together');
  }
  if (storage.url && !storage.bucket) {
    problems.push('SUPABASE_STORAGE_BUCKET is required when Supabase Storage is enabled');
  }
  if (problems.length) {
    throw new Error(`Invalid production configuration: ${problems.join('; ')}`);
  }
}