import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { getPool } from '../src/db/pool.js';

const SERVER_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 4600 + Math.floor(Math.random() * 100);
const BASE = `http://127.0.0.1:${PORT}`;
const APP = 'school_erp';
const PASSWORD = 'matrix-pass';
const PREFIX = `QA_MATRIX_${Date.now()}`;
const ROLE_CODES = [
  'SUPER_ADMIN', 'OWNER', 'PRINCIPAL', 'ADMIN_OFFICER', 'ACCOUNTANT', 'TEACHER',
  'CLASS_TEACHER', 'ADMISSION_COUNSELOR', 'HEALTH_OFFICER', 'DISCIPLINE_OFFICER',
  'HR_MANAGER', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'HOSTEL_WARDEN', 'FRONT_OFFICE',
  'INVENTORY_MANAGER', 'CANTEEN_MANAGER', 'PARENT', 'STUDENT', 'ALUMNI',
];
const pool = getPool();
const created = [];
let server;

function discoverRoutes() {
  const routes = [];
  const dir = path.join(SERVER_DIR, 'src', 'routes');
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.js') || file === 'school_lf.js') continue;
    const source = fs.readFileSync(path.join(dir, file), 'utf8');
    const prefix = file === 'auth.js' ? '/api/auth'
      : file === 'school_reports.js' ? '/api/school/reports'
        : file === 'school_automation.js' ? '/api/school/automation'
          : file === 'school_import.js' ? '/api/school/import'
            : file.startsWith('school') ? '/api/school' : '/api';
    const pattern = /\b[A-Za-z_$][\w$]*\s*\.\s*get\s*\(\s*[`'"]([^`'"]+)[`'"]/g;
    let match;
    while ((match = pattern.exec(source))) {
      if (!match[1].includes(':')) routes.push(prefix + match[1]);
    }
  }
  return [...new Set(routes)];
}

async function api(method, route, token) {
  const response = await fetch(`${BASE}${route}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: response.status, text: await response.text() };
}

async function waitForServer() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${BASE}/api/healthz`)).ok) return;
    } catch { /* retry while starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('role matrix server did not start');
}

async function createRoleUser(roleCode) {
  const userid = `${PREFIX}_${roleCode}`;
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  await pool.query(
    `INSERT INTO "tblHO_User" ("UserId","UserName","PasswordHash","Designation","GRP","Status")
     VALUES ($1,$2,$3,$4,'','1')`,
    [userid, userid, passwordHash, roleCode],
  );
  const user = await pool.query(
    `INSERT INTO school_users (app_id,user_id,name) VALUES ($1,$2,$3) RETURNING id`,
    [APP, userid, userid],
  );
  const role = await pool.query(
    'SELECT id FROM school_roles WHERE app_id=$1 AND code=$2',
    [APP, roleCode],
  );
  assert.ok(role.rows[0], `missing role ${roleCode}`);
  await pool.query(
    'INSERT INTO school_user_roles (app_id,user_id,role_id) VALUES ($1,$2,$3)',
    [APP, userid, role.rows[0].id],
  );
  created.push({ userid, schoolUserId: user.rows[0].id });
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userid, password: PASSWORD, company: APP }),
  });
  assert.equal(response.status, 200, `${roleCode} login failed`);
  return (await response.json()).token;
}

async function cleanup() {
  for (const user of created) {
    await pool.query('DELETE FROM school_user_roles WHERE app_id=$1 AND user_id=$2', [APP, user.userid]).catch(() => {});
    await pool.query('DELETE FROM school_users WHERE app_id=$1 AND id=$2', [APP, user.schoolUserId]).catch(() => {});
    await pool.query('DELETE FROM "tblHO_User" WHERE "UserId"=$1', [user.userid]).catch(() => {});
  }
}

try {
  server = spawn(process.execPath, ['src/index.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, PORT: String(PORT), CLUSTER_WORKERS: '1', RATE_LIMIT_MAX: '100000', LOGIN_RATE_LIMIT_MAX: '100000' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (chunk) => process.stderr.write(chunk));
  await waitForServer();

  const routes = discoverRoutes();
  const results = [];
  for (const roleCode of ROLE_CODES) {
    const token = await createRoleUser(roleCode);
    for (const route of routes) {
      try {
        const result = await api('GET', route, token);
        results.push({ roleCode, route, status: result.status });
      } catch (error) {
        results.push({ roleCode, route, status: 'ERR', error: error.message });
      }
    }
  }

  const failures = results.filter((result) => result.status === 'ERR' || result.status >= 500);
  assert.equal(failures.length, 0, `role matrix had server/network failures: ${JSON.stringify(failures.slice(0, 10))}`);
  const counts = results.reduce((out, result) => {
    const key = String(result.status);
    out[key] = (out[key] || 0) + 1;
    return out;
  }, {});
  console.log(JSON.stringify({ roles: ROLE_CODES.length, routes: routes.length, requests: results.length, statuses: counts }));
} finally {
  await cleanup();
  if (server) server.kill();
  await pool.end();
}
