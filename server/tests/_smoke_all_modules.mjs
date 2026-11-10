/* GET smoke across every parameterless endpoint, plus server error capture.
   Run: node tests/_smoke_all_modules.mjs
   Not a permanent suite: used to locate runtime failures after the data reset. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 4300 + Math.floor(Math.random() * 300);
const BASE = `http://127.0.0.1:${PORT}`;
const APP = 'school_erp';

const routes = [];
{
  const txt = fs.readFileSync(path.join(SERVER_DIR, 'scripts', '_routes.mjs'), 'utf8');
  // re-derive directly from route files to avoid a separate inventory file
  const dir = path.join(SERVER_DIR, 'src', 'routes');
  const pref = (f) => f === 'school_reports.js' ? '/api/school/reports'
    : f === 'school_automation.js' ? '/api/school/automation'
    : f === 'school_import.js' ? '/api/school/import'
    : f === 'auth.js' ? '/api/auth'
    : f.startsWith('school') ? '/api/school' : '/api';
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.js')) continue;
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const re = /\b(?:[A-Za-z_$][\w$]*)\s*\.\s*(get|post|put|patch|delete)\s*\(\s*[`'"]([^`'"]+)[`'"]/g;
    let m;
    while ((m = re.exec(src))) {
      if (m[1] !== 'get' || m[2].includes(':')) continue;
      routes.push({ file: f, url: pref(f) + m[2] });
    }
  }
}
const seen = new Set();
const uniq = routes.filter((r) => (seen.has(r.url) ? false : seen.add(r.url)));

const server = spawn(process.execPath, ['src/index.js'], {
  cwd: SERVER_DIR,
  env: { ...process.env, PORT: String(PORT), CLUSTER_WORKERS: '1', RATE_LIMIT_MAX: '100000', LOGIN_RATE_LIMIT_MAX: '100000' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (c) => { serverLog += c; });
server.stderr.on('data', (c) => { serverLog += c; });

async function wait() {
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    try { if ((await fetch(`${BASE}/api/healthz`)).ok) return; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('server did not start\n' + serverLog);
}

async function api(method, url, { token, body } = {}) {
  const res = await fetch(BASE + url, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-json */ }
  return { status: res.status, body: json, text };
}

const results = [];
async function worker(queue, token) {
  while (queue.length) {
    const r = queue.shift();
    const started = Date.now();
    try {
      const res = await api('GET', r.url, { token });
      const err = res.body?.error || res.body?.message || '';
      results.push({ ...r, status: res.status, error: String(err).slice(0, 200), ms: Date.now() - started });
    } catch (e) {
      results.push({ ...r, status: 'ERR', error: e.message, ms: Date.now() - started });
    }
  }
}

try {
  await wait();
  const login = await api('POST', '/api/auth/login', { body: { userid: 'ADMIN', password: (process.env.ADMIN_PASSWORD || 'change-me-local'), company: APP } });
  if (!login.body?.token) throw new Error('login failed: ' + login.text);
  const token = login.body.token;

  const queue = [...uniq];
  await Promise.all(Array.from({ length: 6 }, () => worker(queue, token)));

  const bad = results.filter((r) => r.status === 'ERR' || r.status >= 500);
  const four = results.filter((r) => r.status === 400 || r.status === 404 || r.status === 403);
  const ok = results.filter((r) => r.status === 200);

  console.log(`\nTOTAL ${results.length}  OK ${ok.length}  4xx ${four.length}  5xx/ERR ${bad.length}`);
  if (bad.length) {
    console.log('\n=== 5xx / network ===');
    for (const r of bad) console.log(`${r.status}  ${r.url}  (${r.file}) ${r.error}`);
  }
  console.log('\n=== 400/403/404 (inspect whether params/permissions expected) ===');
  const byStatus = {};
  for (const r of four) (byStatus[r.status] ||= []).push(r);
  for (const s of Object.keys(byStatus).sort()) {
    console.log(`\n-- ${s} (${byStatus[s].length})`);
    for (const r of byStatus[s]) console.log(`${r.url}  ${r.error}`);
  }
  const slow = results.filter((r) => r.ms > 3000).sort((a, b) => b.ms - a.ms).slice(0, 20);
  if (slow.length) {
    console.log('\n=== SLOW > 3s ===');
    for (const r of slow) console.log(`${r.ms}ms  ${r.url}`);
  }
  const distinctErrors = [...new Set(bad.map((r) => r.error.split('\n')[0]))];
  if (distinctErrors.length) {
    console.log('\n=== DISTINCT 5xx MESSAGES ===');
    for (const e of distinctErrors.slice(0, 40)) console.log(e);
  }
  if (bad.length) {
    const idx = serverLog.indexOf('Error');
    console.log('\n=== SERVER LOG TAIL ===\n' + serverLog.slice(-4000));
  }
} finally {
  server.kill();
}
