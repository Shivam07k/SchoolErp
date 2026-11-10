import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';

function num(v, d) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; }

/* ============================================================
   SQL audit log — batched, never blocks the request path.
   Entries queue in-memory and flush to disk once per 150ms on a
   single append stream per file (xErp did an unqueued appendFile
   per request; this removes that io costs entirely).
   ============================================================ */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.join(__dirname, '../../logs');
fs.mkdirSync(LOGS_DIR, { recursive: true });

/* Entries are buffered per file and flushed on an interval as one write per
   file. The previous implementation called fs.appendFileSync per request,
   which blocks the event loop on every call and was the main reason
   throughput stopped scaling with concurrency. */
const FLUSH_MS = num(env.SQL_LOG_FLUSH_MS, 250);
const MAX_BUFFER = num(env.SQL_LOG_MAX_BUFFER, 500);
const buffers = new Map();

function bufferFor(file) {
  let b = buffers.get(file);
  if (!b) { b = []; buffers.set(file, b); }
  return b;
}

function writeOut(file, lines) {
  const fp = path.join(LOGS_DIR, file);
  const payload = lines.join('\n') + '\n';
  /* async append: returns immediately, so the request path never waits on disk */
  fs.appendFile(fp, payload, (err) => { if (err) console.error('[SQL LOG ERROR]', err.message); });
}

const timer = setInterval(() => {
  for (const [file, lines] of buffers) {
    if (!lines.length) continue;
    buffers.set(file, []);
    writeOut(file, lines);
  }
}, FLUSH_MS);
/* never hold the process open just for the log flush */
if (typeof timer.unref === 'function') timer.unref();

function appendMaybe(file, line) {
  const b = bufferFor(file);
  b.push(line);
  if (b.length >= MAX_BUFFER) { buffers.set(file, []); writeOut(file, b); }
}

export async function clearLog(appId, userId) {
  if (!env.SQL_LOG) return;
  const suffix = `_${userId || 'anon'}.log`;
  try {
    for (const f of fs.readdirSync(LOGS_DIR)) {
      if (f.endsWith(suffix)) fs.rmSync(path.join(LOGS_DIR, f), { force: true });
    }
  } catch { /* ignore */ }
}

export function appendSqlLog(action, appId, formId, token, userId, sqlText, extra = {}) {
  if (!env.SQL_LOG) return;
  const file = `${appId || 'db'}_${userId || 'anon'}.log`;
  const entry = {
    ts: new Date().toISOString(),
    action,
    appId: appId || 'db',
    formId: formId || '',
    token: token ? token.slice(0, 8) : 'none',
    userId: userId || 'anon',
    ...extra,
    sql: sqlText || '',
  };
  appendMaybe(file, JSON.stringify(entry));
}

export function flushLogsSync() {
  /* used on shutdown so buffered lines are not lost */
  for (const [file, lines] of buffers) {
    if (!lines.length) continue;
    buffers.set(file, []);
    try { fs.appendFileSync(path.join(LOGS_DIR, file), lines.join('\n') + '\n'); }
    catch (e) { console.error('[SQL LOG ERROR]', e.message); }
  }
}

/* ============================================================
   Log entries are meant to be copied straight into psql/pgAdmin.
   Build a real, runnable SELECT instead of a bare proc signature.
   The session token is never written to disk; it is emitted as a
   subquery so the statement still executes but no credential leaks.
   ============================================================ */
export const SQL_TOKEN = Symbol('sessionToken');

export function sqlLiteral(v, userId) {
  if (v === SQL_TOKEN) {
    const uid = String(userId || '').replace(/'/g, "''");
    return `(SELECT "token" FROM "tblHO_User" WHERE "UserId" = '${uid}')`;
  }
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

export function sqlCall(name, vals, userId) {
  /* quote the proc name: xErp names are mixed case (sp_frmBrand_SAVE) and an
     unquoted identifier folds to lower case, so the logged statement would
     fail to resolve when pasted into psql/pgAdmin. */
  const ident = '"' + String(name).replace(/"/g, '""') + '"';
  const list = (vals || []).map((v) => sqlLiteral(v, userId));
  return `SELECT * FROM ${ident}(${list.join(', ')});`;
}