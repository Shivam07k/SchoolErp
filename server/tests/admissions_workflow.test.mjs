import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from '../src/db/pool.js';

const SERVER_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 4300 + Math.floor(Math.random() * 200);
const BASE = `http://127.0.0.1:${PORT}`;
const APP = 'school_erp';
const pool = getPool();
let server;
const ids = { inquiry: null, application: null, student: null, guardian: null };

async function api(method, route, body, token) {
  const response = await fetch(`${BASE}/api${route}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* report raw response below */ }
  return { status: response.status, body: json, text };
}

async function login() {
  const response = await api('POST', '/auth/login', { userid: 'ADMIN', password: (process.env.ADMIN_PASSWORD || 'change-me-local'), company: APP });
  assert.equal(response.status, 200, response.text);
  return response.body.token;
}

async function waitForServer() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${BASE}/api/healthz`)).ok) return;
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('admissions test server did not start');
}

async function cleanup() {
  await pool.query('DELETE FROM school_student_enrollments WHERE app_id=$1 AND student_id=$2', [APP, ids.student]).catch(() => {});
  await pool.query('DELETE FROM school_student_guardians WHERE student_id=$1', [ids.student]).catch(() => {});
  await pool.query('DELETE FROM school_admissions WHERE app_id=$1 AND application_id=$2', [APP, ids.application]).catch(() => {});
  await pool.query('DELETE FROM school_students WHERE app_id=$1 AND id=$2', [APP, ids.student]).catch(() => {});
  await pool.query('DELETE FROM school_families WHERE app_id=$1 AND primary_guardian_id=$2', [APP, ids.guardian]).catch(() => {});
  await pool.query('DELETE FROM school_guardians WHERE app_id=$1 AND id=$2', [APP, ids.guardian]).catch(() => {});
  await pool.query('DELETE FROM school_applications WHERE app_id=$1 AND id=$2', [APP, ids.application]).catch(() => {});
  await pool.query('DELETE FROM school_inquiries WHERE app_id=$1 AND id=$2', [APP, ids.inquiry]).catch(() => {});
}

try {
  server = spawn(process.execPath, ['src/index.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (chunk) => process.stderr.write(chunk));
  await waitForServer();
  const token = await login();
  const classes = await pool.query('SELECT id FROM school_classes WHERE app_id=$1 ORDER BY id LIMIT 1', [APP]);
  const sections = await pool.query('SELECT id FROM school_sections WHERE app_id=$1 ORDER BY id LIMIT 1', [APP]);
  assert.ok(classes.rows[0] && sections.rows[0], 'staging class and section are required');

  let response = await api('POST', '/school/admissions/inquiries', {
    parentContact: `qa-admission-${Date.now()}`,
    parentName: 'QA Parent',
    studentFirstName: 'QA',
    studentLastName: 'Admission',
    classInterested: classes.rows[0].id,
  }, token);
  assert.equal(response.status, 201, response.text);
  ids.inquiry = response.body.inquiry.id;

  response = await api('PUT', `/school/admissions/inquiries/${ids.inquiry}`, { status: 'contacted' }, token);
  assert.equal(response.status, 200, response.text);

  response = await api('POST', '/school/admissions/applications', { inquiryId: ids.inquiry }, token);
  assert.equal(response.status, 201, response.text);
  ids.application = response.body.application.id;

  response = await api('PUT', `/school/admissions/applications/${ids.application}`, {
    officialName: 'QA Admission',
    dob: '2015-06-15',
    gender: 'female',
    guardianName: 'QA Parent',
    guardianContact: `qa-admission-${Date.now()}`,
  }, token);
  assert.equal(response.status, 200, response.text);

  response = await api('POST', `/school/admissions/applications/${ids.application}/submit`, {}, token);
  assert.equal(response.status, 200, response.text);
  response = await api('POST', `/school/admissions/applications/${ids.application}/approve`, { sectionId: sections.rows[0].id }, token);
  assert.equal(response.status, 200, response.text);
  ids.student = response.body.student.id;

  response = await api('POST', `/school/admissions/applications/${ids.application}/approve`, { sectionId: sections.rows[0].id }, token);
  assert.equal(response.status, 200, response.text);
  assert.equal(response.body.alreadyEnrolled, true);

  const linked = await pool.query(`
    SELECT a.id AS admission_id, e.student_id, s.app_id, s.class_id, s.section_id,
           g.id AS guardian_id
      FROM school_admissions a
      JOIN school_student_enrollments e ON e.student_id=a.student_id AND e.app_id=a.app_id
      JOIN school_students s ON s.id=a.student_id AND s.app_id=a.app_id
      LEFT JOIN school_student_guardians sg ON sg.student_id=s.id
      LEFT JOIN school_guardians g ON g.id=sg.guardian_id AND g.app_id=s.app_id
     WHERE a.app_id=$1 AND a.application_id=$2
  `, [APP, ids.application]);
  assert.equal(linked.rows.length, 1);
  assert.equal(linked.rows[0].student_id, ids.student);
  assert.equal(linked.rows[0].app_id, APP);
  assert.equal(linked.rows[0].class_id, classes.rows[0].id);
  assert.equal(linked.rows[0].section_id, sections.rows[0].id);
  ids.guardian = linked.rows[0].guardian_id;
  console.log('Admissions workflow passed: inquiry -> application -> submit -> approve -> enrollment -> guardian linkage');
} finally {
  await cleanup();
  if (server) server.kill();
  await pool.end();
}
