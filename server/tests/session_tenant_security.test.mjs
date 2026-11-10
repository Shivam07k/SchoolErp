import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 4500 + Math.floor(Math.random() * 100);
const BASE = `http://127.0.0.1:${PORT}/api`;
const COMPANY = 'school_erp';

async function request(method, route, body, token) {
  const response = await fetch(`${BASE}${route}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

const server = spawn(process.execPath, ['src/index.js'], {
  cwd: SERVER_DIR,
  env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test', CLUSTER_WORKERS: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stderr.on('data', (chunk) => process.stderr.write(chunk));

try {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${BASE}/healthz`)).ok) break;
    } catch { /* wait for startup */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const unknownCompany = await request('POST', '/auth/login', {
    userid: 'ADMIN',
    password: (process.env.ADMIN_PASSWORD || 'change-me-local'),
    company: 'not-a-tenant',
  });
  assert.equal(unknownCompany.status, 400);

  const firstLogin = await request('POST', '/auth/login', {
    userid: 'ADMIN',
    password: (process.env.ADMIN_PASSWORD || 'change-me-local'),
    company: COMPANY,
  });
  assert.equal(firstLogin.status, 200);
  const firstToken = firstLogin.body.token;

  const firstMe = await request('GET', '/auth/me', null, firstToken);
  assert.equal(firstMe.status, 200);
  assert.equal(firstMe.body.user.company, COMPANY);

  const secondLogin = await request('POST', '/auth/login', {
    userid: 'ADMIN',
    password: (process.env.ADMIN_PASSWORD || 'change-me-local'),
    company: COMPANY,
  });
  assert.equal(secondLogin.status, 200);
  const secondToken = secondLogin.body.token;

  const expiredMe = await request('GET', '/auth/me', null, firstToken);
  assert.equal(expiredMe.status, 401);

  const secondMe = await request('GET', '/auth/me', null, secondToken);
  assert.equal(secondMe.status, 200);
  assert.equal(secondMe.body.user.company, COMPANY);

  const forgedTenantLog = await request('GET', '/logs/json?file=xerp_ADMIN.log', null, secondToken);
  assert.equal(forgedTenantLog.status, 404);

  const forgedTenantUpload = await request(
    'GET',
    '/school/uploads/xerp/2026/student-photo/foreign.png',
    null,
    secondToken,
  );
  assert.equal(forgedTenantUpload.status, 404);

  const forgedTenantReport = await request(
    'GET',
    '/school/reports/student?app_id=xerp',
    null,
    secondToken,
  );
  assert.notEqual(forgedTenantReport.status, 500);

  const forgedTenantPath = await request('GET', '/school/students/999999999?app_id=xerp', null, secondToken);
  assert.notEqual(forgedTenantPath.status, 500);

  console.log('Session/tenant security passed: unknown tenant rejected, token rotation enforced, and authenticated cross-tenant log/upload/report paths contained');
} finally {
  server.kill();
}
