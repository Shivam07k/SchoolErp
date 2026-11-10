import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './env.js';

/* ============================================================
   Company (database) registry.

   Every company and its connection lives in server/config/companies.json.
   This module is the only reader of that file; the rest of the server asks it
   for a company or a connection and never hardcodes a list. So adding a
   company - on this server or another one - is a one-line edit to the JSON
   and nothing else.

   The file is re-read whenever its mtime changes, so edits apply without a
   restart. A missing or malformed file falls back to a single company built
   from the environment, because a bad edit must never stop the server booting.
   ============================================================ */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REGISTRY_FILE = path.join(__dirname, '..', '..', 'config', 'companies.json');

/* Live binding: reassigned whenever the file is re-read, so importers see the
   new value. Every use of this is inside a function, never captured at module
   load, which is what makes that safe. */
export let DEFAULT_COMPANY_ID = env.DB.database || 'xerp';

let cache = null;
let revision = 0;
let warned = new Set();

function warnOnce(key, msg) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[companies] ${msg}`);
}

/* Fill in the blanks: anything the entry omits comes from the environment,
   and the database name defaults to the id so the common case is one line. */
function resolveEntry(raw) {
  const id = String(raw?.id ?? '').trim();
  if (!id) throw new Error('every company entry needs an "id"');

  const secret = raw.passwordEnv ? process.env[raw.passwordEnv] : undefined;
  if (raw.passwordEnv && secret === undefined) {
    warnOnce(`pass:${id}`, `"${raw.passwordEnv}" is not set, so company '${id}' falls back to PG_PASSWORD`);
  }

  /* Cloud databases (Supabase, Neon, Render Postgres) are usually selected by
     an environment variable instead of a hard-coded name, so the same registry
     can be committed without pinning one staging database. */
  const databaseFromEnv = raw.databaseEnv ? process.env[raw.databaseEnv] : undefined;
  if (raw.databaseEnv && !databaseFromEnv) {
    warnOnce(`db:${id}`, `"${raw.databaseEnv}" is not set, so company '${id}' falls back to its id as the database name`);
  }

  const db = {
    host: raw.host ?? env.DB.host,
    port: Number(raw.port ?? env.DB.port),
    user: raw.user ?? env.DB.user,
    password: secret ?? raw.password ?? env.DB.password,
    database: databaseFromEnv || raw.database || id,
    max: Number(raw.max ?? env.DB.max),
  };
  if (raw.url) db.connectionString = raw.url;
  const ssl = raw.ssl ?? env.DB.ssl;
  if (ssl) db.ssl = typeof ssl === 'object' ? ssl : { rejectUnauthorized: false };

  return {
    id,
    label: String(raw.label ?? '').trim() || id,
    /* true when this company needs nothing beyond its id, so the JSON stays tidy */
    inherited: !raw.host && !raw.port && !raw.user && !raw.password && !raw.passwordEnv
      && !raw.url && !raw.database && !raw.databaseEnv,
    db,
  };
}

function build() {
  let text;
  try {
    text = fs.readFileSync(REGISTRY_FILE, 'utf8');
  } catch {
    warnOnce('missing', `${REGISTRY_FILE} not found - falling back to a single company from the environment`);
    return [{ id: DEFAULT_COMPANY_ID, label: DEFAULT_COMPANY_ID, inherited: true, db: { ...env.DB } }];
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    warnOnce('badjson', `${REGISTRY_FILE} is not valid JSON (${e.message}); falling back to the environment`);
    return [{ id: DEFAULT_COMPANY_ID, label: DEFAULT_COMPANY_ID, inherited: true, db: { ...env.DB } }];
  }

  const list = Array.isArray(parsed) ? parsed : parsed?.companies;
  if (!Array.isArray(list)) {
    warnOnce('shape', `${REGISTRY_FILE} has no "companies" array; falling back to the environment`);
    return [{ id: DEFAULT_COMPANY_ID, label: DEFAULT_COMPANY_ID, inherited: true, db: { ...env.DB } }];
  }

  const companies = [];
  const seen = new Set();
  for (const raw of list) {
    let entry;
    try {
      entry = resolveEntry(raw);
    } catch (e) {
      warnOnce(`entry:${JSON.stringify(raw)}`, `skipping a company entry: ${e.message}`);
      continue;
    }
    if (seen.has(entry.id)) {
      warnOnce(`dup:${entry.id}`, `company '${entry.id}' is listed twice; keeping the first`);
      continue;
    }
    seen.add(entry.id);
    companies.push(entry);
  }
  if (!companies.length) {
    warnOnce('empty', 'no usable companies in the registry; falling back to the environment');
    return [{ id: DEFAULT_COMPANY_ID, label: DEFAULT_COMPANY_ID, inherited: true, db: { ...env.DB } }];
  }

  const want = String(parsed?.default ?? '').trim();
  DEFAULT_COMPANY_ID = want && seen.has(want) ? want : companies[0].id;
  if (want && !seen.has(want)) {
    warnOnce(`default:${want}`, `"default": "${want}" is not a listed company; using '${companies[0].id}'`);
  }
  return companies;
}

/* Re-read only when the file actually changed; statSync is cheap and this runs
   on the hot path. */
function registry() {
  let mtimeMs = 0;
  try {
    mtimeMs = fs.statSync(REGISTRY_FILE).mtimeMs;
  } catch { /* absent - rebuild to the fallback below */ }

  if (!cache || cache.mtimeMs !== mtimeMs) {
    const companies = build();
    const changed = !cache || JSON.stringify(cache.companies) !== JSON.stringify(companies);
    cache = { mtimeMs, companies };
    if (changed) {
      revision += 1;
      if (cache.companies.length) {
        console.log(`[companies] ${cache.companies.length} company(ies) loaded from ${path.basename(REGISTRY_FILE)}: ${cache.companies.map((c) => c.id).join(', ')} (default ${DEFAULT_COMPANY_ID})`);
      }
    }
  }
  return cache.companies;
}

export function getCompanies() {
  return registry().map((c) => ({ id: c.id, label: c.label }));
}

export function getCompany(id) {
  const cid = String(id || DEFAULT_COMPANY_ID).trim();
  return registry().find((c) => c.id === cid) || null;
}

export function getCompanyDb(id) {
  return getCompany(id)?.db ?? null;
}

/* Bumped whenever the registry content changes, so caches keyed on the company
   list (login labels, pools) can invalidate themselves. */
export function getRegistryRevision() {
  registry();
  return revision;
}

/* Resolve the registry once at load. DEFAULT_COMPANY_ID otherwise starts as
   the database name and is only corrected the first time registry() runs, so
   a shared database (PG_DATABASE=postgres on Supabase) would briefly look like
   a tenant called "postgres". */
getRegistryRevision();
