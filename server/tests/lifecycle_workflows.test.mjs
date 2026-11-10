import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from '../src/db/pool.js';

const SERVER_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 4600 + Math.floor(Math.random() * 100);
const BASE = `http://127.0.0.1:${PORT}/api`;
const APP = 'school_erp';
const pool = getPool();
const stamp = Date.now();
const created = { student: null, promotionRun: null, exitRequest: null, refund: null };

async function api(method, route, body, token) {
  const response = await fetch(`${BASE}${route}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* assertion reports raw response */ }
  return { status: response.status, body: parsed, text };
}

async function cleanup() {
  const q = (sql, params) => pool.query(sql, params).catch(() => {});
  await q('DELETE FROM school_refund_request WHERE app_id=$1 AND id=$2', [APP, created.refund]);
  await q('DELETE FROM school_transfer_certificates WHERE app_id=$1 AND request_id=$2', [APP, created.exitRequest]);
  await q('DELETE FROM school_exit_clearances WHERE app_id=$1 AND request_id=$2', [APP, created.exitRequest]);
  await q('DELETE FROM school_exit_requests WHERE app_id=$1 AND id=$2', [APP, created.exitRequest]);
  await q('DELETE FROM school_promotion_items WHERE app_id=$1 AND run_id=$2', [APP, created.promotionRun]);
  await q('DELETE FROM school_promotion_runs WHERE app_id=$1 AND id=$2', [APP, created.promotionRun]);
  await q('DELETE FROM school_student_enrollments WHERE app_id=$1 AND student_id=$2', [APP, created.student]);
  await q('DELETE FROM school_students WHERE app_id=$1 AND id=$2', [APP, created.student]);
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

  const login = await api('POST', '/auth/login', { userid: 'ADMIN', password: (process.env.ADMIN_PASSWORD || 'change-me-local'), company: APP });
  assert.equal(login.status, 200, login.text);
  const token = login.body.token;

  const years = (await pool.query(
    'SELECT id FROM school_academic_years WHERE app_id=$1 ORDER BY start_date LIMIT 2',
    [APP],
  )).rows;
  const classes = (await pool.query(
    'SELECT id FROM school_classes WHERE app_id=$1 ORDER BY id LIMIT 2',
    [APP],
  )).rows;
  assert.equal(years.length, 2, 'two academic years are required');
  assert.equal(classes.length, 2, 'two classes are required');
  const sections = [];
  for (const cls of classes) {
    const row = (await pool.query(
      'SELECT id FROM school_sections WHERE app_id=$1 AND class_id=$2 ORDER BY id LIMIT 1',
      [APP, cls.id],
    )).rows[0];
    assert.ok(row, `section required for class ${cls.id}`);
    sections.push(row);
  }

  const student = (await pool.query(`
    INSERT INTO school_students (app_id, admission_no, first_name, last_name, class_id, section_id, status)
    VALUES ($1,$2,'Lifecycle','QA',$3,$4,'active') RETURNING id
  `, [APP, `QA-LIFECYCLE-${stamp}`, classes[0].id, sections[0].id])).rows[0];
  created.student = student.id;
  await pool.query(`
    INSERT INTO school_student_enrollments
      (app_id, student_id, academic_year_id, class_id, section_id, status, joined_on)
    VALUES ($1,$2,$3,$4,$5,'studying',current_date)
  `, [APP, created.student, years[0].id, classes[0].id, sections[0].id]);

  let response = await api('POST', '/school/promotions/runs', {
    fromAcademicYearId: years[0].id,
    toAcademicYearId: years[1].id,
    fromClassId: classes[0].id,
    toClassId: classes[1].id,
    fromSectionId: sections[0].id,
    toSectionId: sections[1].id,
  }, token);
  assert.equal(response.status, 200, response.text);
  created.promotionRun = response.body.run.id;

  response = await api('POST', `/school/promotions/runs/${created.promotionRun}/generate`, null, token);
  assert.equal(response.status, 200, response.text);
  assert.equal(response.body.count, 1);
  const items = (await api('GET', `/school/promotions/runs/${created.promotionRun}/items`, null, token));
  assert.equal(items.status, 200, items.text);
  response = await api('POST', `/school/promotions/runs/${created.promotionRun}/promote`, {
    items: [{ studentId: created.student, result: 'promoted' }],
  }, token);
  assert.equal(response.status, 200, response.text);
  assert.equal(response.body.promoted, 1);

  response = await api('POST', '/school/exit/requests', {
    studentId: created.student,
    exitType: 'Transfer',
    reasonLeaving: 'Lifecycle QA transfer',
    destinationSchool: 'QA Destination',
  }, token);
  assert.equal(response.status, 201, response.text);
  created.exitRequest = response.body.request.id;

  const duplicateExit = await api('POST', '/school/exit/requests', {
    studentId: created.student,
    exitType: 'Transfer',
    reasonLeaving: 'Duplicate should be rejected',
  }, token);
  assert.equal(duplicateExit.status, 409, duplicateExit.text);

  for (const department of ['Fees', 'Library', 'Sports', 'Lab']) {
    response = await api('POST', `/school/exit/requests/${created.exitRequest}/clearance`, {
      department,
      status: 'cleared',
    }, token);
    assert.equal(response.status, 200, response.text);
  }
  response = await api('POST', `/school/exit/requests/${created.exitRequest}/issue-tc`, {}, token);
  assert.equal(response.status, 200, response.text);
  response = await api('POST', `/school/exit/requests/${created.exitRequest}/close`, {}, token);
  assert.equal(response.status, 200, response.text);

  response = await api('POST', '/school/fee/refunds', {
    studentId: created.student,
    requestedAmount: 125,
    deductions: 25,
    reasonType: 'withdrawal',
    reasonText: 'Lifecycle QA refund',
  }, token);
  assert.equal(response.status, 200, response.text);
  created.refund = response.body.refund.id;
  response = await api('POST', `/school/fee/refunds/${created.refund}/approve`, { notes: 'QA approval' }, token);
  assert.equal(response.status, 200, response.text);
  response = await api('POST', `/school/fee/refunds/${created.refund}/pay`, {
    payoutMode: 'bank_transfer',
    payoutReference: `QA-${stamp}`,
  }, token);
  assert.equal(response.status, 200, response.text);
  assert.equal(response.body.refund.status, 'paid');

  console.log('Lifecycle workflow passed: promotion, duplicate-exit protection, clearances, TC issue/close, and refund approval/payment');
} finally {
  await cleanup();
  server.kill();
}
