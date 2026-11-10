/* End-to-end Academics workflows against a self-started server.

   Run: node tests/academics_workflows.test.mjs

   Creates uniquely named fixtures in the configured default company database,
   exercises the HTTP API as manager, teacher and student, then removes the
   fixtures. Covers academic-year lifecycle and archive restrictions, class/
   section/subject validation, allocation and room rules, homework lifecycle
   and privacy, submissions/grading, referential history and permission denial.
*/
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { getPool } from '../src/db/pool.js';

const SERVER_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 3800 + Math.floor(Math.random() * 300);
const BASE = `http://127.0.0.1:${PORT}/api`;
const APP_ID = 'school_erp';
const STAMP = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const PREFIX = `QA_AC_${STAMP}`;
const CODE = STAMP.slice(-6).toUpperCase();
const PASSWORD = 'qa-test-pass';

const pool = getPool();
const fixtures = {
  users: [], roles: [], employees: [], students: [],
  schoolUsers: [],
  years: [], classes: [], sections: [], subjects: [], rooms: [], allocations: [],
  homework: [], submissions: [], timetables: [],
};
let originalActiveYearId = null;
let server;
let checks = 0;

function pass(message) {
  checks += 1;
  console.log(`  ok ${checks} - ${message}`);
}

async function api(method, route, { token, body } = {}) {
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  return { status: res.status, body: json, text };
}

async function login(userid) {
  const res = await api('POST', '/auth/login', { body: { userid, password: PASSWORD, company: APP_ID } });
  assert.equal(res.status, 200, `login ${userid}: ${res.text}`);
  return res.body.token;
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/healthz`);
      if (res.ok) return;
    } catch { /* not yet listening */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('server did not become healthy');
}

async function makeUser(label, roleCode) {
  const userid = `${PREFIX}_${label}`;
  const hash = await bcrypt.hash(PASSWORD, 4);
  await pool.query(
    `INSERT INTO "tblHO_User" ("UserId","UserName","PasswordHash","Designation","GRP","Status")
     VALUES ($1,$2,$3,$4,'','1')`,
    [userid, `${PREFIX} ${label}`, hash, label],
  );
  fixtures.users.push(userid);
  const { rows: [schoolUser] } = await pool.query(
    'INSERT INTO school_users (app_id, user_id, name) VALUES ($1,$2,$3) RETURNING id',
    [APP_ID, userid, `${PREFIX} ${label}`],
  );
  fixtures.schoolUsers.push(schoolUser.id);
  const { rows: [role] } = await pool.query(
    'SELECT id FROM school_roles WHERE app_id=$1 AND code=$2', [APP_ID, roleCode]);
  assert.ok(role, `role ${roleCode} is seeded`);
  await pool.query(
    'INSERT INTO school_user_roles (app_id, user_id, role_id) VALUES ($1,$2,$3)',
    [APP_ID, userid, role.id],
  );
  fixtures.roles.push({ userid, roleId: role.id });
  return { userid, token: await login(userid) };
}

async function makeEmployee(label, userid = null) {
  const { rows: [row] } = await pool.query(
    `INSERT INTO school_hr_employees (app_id, employee_no, first_name, last_name, designation, status, user_id)
     VALUES ($1,$2,$3,'QA','Teacher','active',$4) RETURNING *`,
    [APP_ID, `${PREFIX}_${label}`, `${PREFIX} ${label}`, userid],
  );
  fixtures.employees.push(row.id);
  return row;
}

async function makeStudent(userid, classId, sectionId) {
  const { rows: [row] } = await pool.query(
    `INSERT INTO school_students
       (app_id, admission_no, first_name, last_name, class_id, section_id, status, user_id)
     VALUES ($1,$2,$3,'QA',$4,$5,'active',$6) RETURNING *`,
    [APP_ID, `${PREFIX}_ADM_${userid.slice(-4)}`, `${PREFIX} Student`, classId, sectionId, userid],
  );
  fixtures.students.push(row.id);
  return row;
}

async function cleanup() {
  const q = (sql, params) => pool.query(sql, params).catch(() => {});
  await q('DELETE FROM school_homework_submissions WHERE app_id=$1 AND id = ANY($2::int[])',
    [APP_ID, fixtures.submissions]);
  await q('DELETE FROM school_homework_submissions WHERE app_id=$1 AND homework_id = ANY($2::int[])',
    [APP_ID, fixtures.homework]);
  await q('DELETE FROM school_homework WHERE app_id=$1 AND id = ANY($2::int[])', [APP_ID, fixtures.homework]);
  await q('DELETE FROM school_timetables WHERE app_id=$1 AND id = ANY($2::int[])', [APP_ID, fixtures.timetables]);
  await q('DELETE FROM school_subject_allocations WHERE app_id=$1 AND id = ANY($2::int[])',
    [APP_ID, fixtures.allocations]);
  await q('DELETE FROM school_rooms WHERE app_id=$1 AND id = ANY($2::int[])', [APP_ID, fixtures.rooms]);
  await q('DELETE FROM school_subjects WHERE app_id=$1 AND id = ANY($2::int[])', [APP_ID, fixtures.subjects]);
  await q('DELETE FROM school_students WHERE app_id=$1 AND id = ANY($2::int[])', [APP_ID, fixtures.students]);
  await q('DELETE FROM school_sections WHERE app_id=$1 AND id = ANY($2::int[])', [APP_ID, fixtures.sections]);
  await q('DELETE FROM school_classes WHERE app_id=$1 AND id = ANY($2::int[])', [APP_ID, fixtures.classes]);
  await q('DELETE FROM school_academic_years WHERE app_id=$1 AND id = ANY($2::int[])', [APP_ID, fixtures.years]);
  await q('DELETE FROM school_hr_employees WHERE app_id=$1 AND id = ANY($2::int[])', [APP_ID, fixtures.employees]);
  await q('DELETE FROM school_user_roles WHERE app_id=$1 AND user_id = ANY($2::text[])', [APP_ID, fixtures.users]);
  await q('DELETE FROM school_users WHERE app_id=$1 AND id = ANY($2::int[])', [APP_ID, fixtures.schoolUsers]);
  await q('DELETE FROM "tblHO_User" WHERE "UserId" = ANY($1::text[])', [fixtures.users]);
  // The activate endpoint deactivates the previously active year; put it back.
  if (originalActiveYearId) {
    await q('UPDATE school_academic_years SET is_active=false WHERE app_id=$1 AND id = ANY($2::int[])',
      [APP_ID, fixtures.years]);
    await q('UPDATE school_academic_years SET is_active=true WHERE app_id=$1 AND id=$2',
      [APP_ID, originalActiveYearId]);
  }
}

async function main() {
  server = spawn(process.execPath, ['src/index.js'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      PORT: String(PORT),
      CLUSTER_WORKERS: '1',
      RATE_LIMIT_MAX: '10000',
      LOGIN_RATE_LIMIT_MAX: '10000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (chunk) => {
    if (process.env.QA_VERBOSE) process.stdout.write(chunk);
  });
  server.stderr.on('data', (chunk) => process.stderr.write(chunk));
  await waitForServer();

  const adminToken = (await api('POST', '/auth/login', {
    body: { userid: 'ADMIN', password: 'admin123', company: APP_ID },
  })).body.token;
  assert.ok(adminToken, 'admin login');
  const me = await api('GET', '/school/me', { token: adminToken });
  assert.equal(me.status, 200, 'admin /school/me');
  const campusId = me.body.me?.defaultCampusId ?? me.body.defaultCampusId;
  assert.ok(campusId, 'a default campus is configured');

  const activeBefore = await pool.query(
    'SELECT id FROM school_academic_years WHERE app_id=$1 AND is_active LIMIT 1', [APP_ID]);
  originalActiveYearId = activeBefore.rows[0]?.id || null;

  /* ---------- fixtures ---------- */
  const teacher1 = await makeUser('T1', 'TEACHER');
  const teacher2 = await makeUser('T2', 'TEACHER');
  const teacher3 = await makeUser('T3', 'TEACHER');
  const unlinkedTeacher = await makeUser('UT', 'TEACHER');
  const student1 = await makeUser('S1', 'STUDENT');
  const student2 = await makeUser('S2', 'STUDENT');
  const unlinkedStudent = await makeUser('US', 'STUDENT');
  const parent = await makeUser('P1', 'PARENT');
  const employee1 = await makeEmployee('E1', teacher1.userid);
  const employee2 = await makeEmployee('E2', teacher2.userid);
  const employee3 = await makeEmployee('E3', teacher3.userid);
  pass('created isolated users, roles and staff identities');

  const { rows: [{ base_year: baseYearValue }] } = await pool.query(`
    SELECT (EXTRACT(YEAR FROM COALESCE(MAX(end_date), DATE '2095-03-31'))::int + 1) AS base_year
      FROM school_academic_years
     WHERE app_id=$1
  `, [APP_ID]);
  const baseYear = Number(baseYearValue);
  const yearRange = (offset) => ({
    startDate: `${baseYear + offset}-04-01`,
    endDate: `${baseYear + offset + 1}-03-31`,
  });

  async function makeYear(name, startDate, endDate) {
    const res = await api('POST', '/school/academic-years', {
      token: adminToken, body: { name, startDate, endDate },
    });
    assert.equal(res.status, 200, res.text);
    fixtures.years.push(res.body.year.id);
    return res.body.year;
  }

  /* ---------- academic years ---------- */
  const missingYearName = await api('POST', '/school/academic-years', {
    token: adminToken, body: { startDate: '2095-04-01', endDate: '2096-03-31' },
  });
  assert.equal(missingYearName.status, 400);
  const reversedYear = await api('POST', '/school/academic-years', {
    token: adminToken, body: { name: `${PREFIX} Bad`, startDate: `${baseYear}-06-01`, endDate: `${baseYear}-05-01` },
  });
  assert.equal(reversedYear.status, 400);
  pass('academic year rejects missing names and reversed dates');

  const year1 = await makeYear(`${PREFIX} Year 1`, ...Object.values(yearRange(0)));
  const year2 = await makeYear(`${PREFIX} Year 2`, ...Object.values(yearRange(1)));
  const year3 = await makeYear(`${PREFIX} Year 3`, ...Object.values(yearRange(2)));
  let year4 = await makeYear(`${PREFIX} Year 4`, ...Object.values(yearRange(3)));

  const overlapping = await api('POST', '/school/academic-years', {
    token: adminToken,
    body: { name: `${PREFIX} Overlap`, startDate: `${baseYear}-10-01`, endDate: `${baseYear + 1}-10-01` },
  });
  assert.equal(overlapping.status, 409);
  assert.match(overlapping.body.error, /overlap/i);
  pass('academic year rejects overlapping date ranges');

  const activate2 = await api('POST', `/school/academic-years/${year2.id}/activate`, { token: adminToken });
  assert.equal(activate2.status, 200, activate2.text);
  assert.equal(activate2.body.year.is_active, true);
  const year1AfterActivate = await api('GET', '/school/academic-years', { token: adminToken });
  assert.equal(year1AfterActivate.body.years.find((y) => y.id === year1.id).is_active, false);
  await api('POST', `/school/academic-years/${year1.id}/activate`, { token: adminToken });
  pass('activating a year makes it the single active year');

  const close3 = await api('POST', `/school/academic-years/${year3.id}/close`, { token: adminToken });
  assert.equal(close3.status, 200, close3.text);
  assert.equal(close3.body.year.is_closed, true);
  assert.equal(close3.body.year.is_active, false);
  const activateClosed = await api('POST', `/school/academic-years/${year3.id}/activate`, { token: adminToken });
  assert.equal(activateClosed.status, 409);
  const year1StillActive = await api('GET', '/school/academic-years', { token: adminToken });
  assert.equal(year1StillActive.body.years.find((y) => y.id === year1.id).is_active, true);
  const reopen3 = await api('POST', `/school/academic-years/${year3.id}/reopen`, { token: adminToken });
  assert.equal(reopen3.status, 200, reopen3.text);
  assert.equal(reopen3.body.year.is_closed, false);
  pass('a closed year cannot be activated until it is reopened');

  const activate4 = await api('POST', `/school/academic-years/${year4.id}/activate`, { token: adminToken });
  assert.equal(activate4.status, 200, activate4.text);
  assert.equal(activate4.body.year.is_active, true);
  const deleteOnlyActive = await api('DELETE', `/school/academic-years/${year4.id}`, { token: adminToken });
  assert.equal(deleteOnlyActive.status, 409);
  assert.match(deleteOnlyActive.body.error, /only active/i);
  await api('POST', `/school/academic-years/${year2.id}/activate`, { token: adminToken });
  const deleteYear4 = await api('DELETE', `/school/academic-years/${year4.id}`, { token: adminToken });
  assert.equal(deleteYear4.status, 200, deleteYear4.text);
  fixtures.years = fixtures.years.filter((id) => id !== year4.id);
  year4 = null;
  await api('POST', `/school/academic-years/${year1.id}/activate`, { token: adminToken });
  pass('the only active year cannot be deleted; an unused inactive year can');

  /* ---------- classes, sections, subjects ---------- */
  const missingClass = await api('POST', '/school/classes', { token: adminToken, body: {} });
  assert.equal(missingClass.status, 400);
  const classARes = await api('POST', '/school/classes', {
    token: adminToken, body: { name: `${PREFIX} Class A`, sortOrder: 910 },
  });
  assert.equal(classARes.status, 200, classARes.text);
  const classA = classARes.body.class;
  fixtures.classes.push(classA.id);
  const duplicateClass = await api('POST', '/school/classes', {
    token: adminToken, body: { name: ` ${classA.name} ` },
  });
  assert.equal(duplicateClass.status, 409);
  pass('classes require a name and reject duplicates');

  const classBRes = await api('POST', '/school/classes', {
    token: adminToken, body: { name: `${PREFIX} Class B`, sortOrder: 911 },
  });
  assert.equal(classBRes.status, 200, classBRes.text);
  const classB = classBRes.body.class;
  fixtures.classes.push(classB.id);

  const classCRes = await api('POST', '/school/classes', {
    token: adminToken, body: { name: `${PREFIX} Class C`, sortOrder: 912 },
  });
  assert.equal(classCRes.status, 200, classCRes.text);
  const classC = classCRes.body.class;
  fixtures.classes.push(classC.id);

  const missingSectionClass = await api('POST', '/school/sections', {
    token: adminToken, body: { name: 'A' },
  });
  assert.equal(missingSectionClass.status, 400);
  const sectionARes = await api('POST', '/school/sections', {
    token: adminToken, body: { classId: classA.id, name: 'A', capacity: 60 },
  });
  assert.equal(sectionARes.status, 200, sectionARes.text);
  const sectionA = sectionARes.body.section;
  fixtures.sections.push(sectionA.id);
  const duplicateSection = await api('POST', '/school/sections', {
    token: adminToken, body: { classId: classA.id, name: 'a', capacity: 60 },
  });
  assert.equal(duplicateSection.status, 409);
  const sectionBRes = await api('POST', '/school/sections', {
    token: adminToken, body: { classId: classB.id, name: 'B', capacity: 60 },
  });
  assert.equal(sectionBRes.status, 200, sectionBRes.text);
  const sectionB = sectionBRes.body.section;
  fixtures.sections.push(sectionB.id);

  const archiveC = await api('PUT', `/school/classes/${classC.id}`, {
    token: adminToken, body: { isActive: false },
  });
  assert.equal(archiveC.status, 200, archiveC.text);
  const sectionInArchived = await api('POST', '/school/sections', {
    token: adminToken, body: { classId: classC.id, name: 'C', capacity: 30 },
  });
  assert.equal(sectionInArchived.status, 409);
  assert.match(sectionInArchived.body.error, /archived/i);
  await api('PUT', `/school/classes/${classC.id}`, { token: adminToken, body: { isActive: true } });
  const deleteClassC = await api('DELETE', `/school/classes/${classC.id}`, { token: adminToken });
  assert.equal(deleteClassC.status, 200, deleteClassC.text);
  fixtures.classes = fixtures.classes.filter((id) => id !== classC.id);
  pass('archived classes reject new sections and unreferenced classes can be deleted');

  const invalidCode = await api('POST', '/school/subjects', {
    token: adminToken, body: { name: `${PREFIX} Bad Code`, code: 'bad code!' },
  });
  assert.equal(invalidCode.status, 400);
  const subjectARes = await api('POST', '/school/subjects', {
    token: adminToken,
    body: { name: `${PREFIX} Math`, code: `QA${CODE}M`, classId: classA.id, maxMarks: 100 },
  });
  assert.equal(subjectARes.status, 200, subjectARes.text);
  const subjectA = subjectARes.body.subject;
  fixtures.subjects.push(subjectA.id);
  const duplicateSubject = await api('POST', '/school/subjects', {
    token: adminToken, body: { name: `${PREFIX} Math Copy`, code: `qa${CODE}m` },
  });
  assert.equal(duplicateSubject.status, 409);
  const subjectBRes = await api('POST', '/school/subjects', {
    token: adminToken, body: { name: `${PREFIX} Science`, code: `QA${CODE}S`, classId: classA.id },
  });
  assert.equal(subjectBRes.status, 200, subjectBRes.text);
  const subjectB = subjectBRes.body.subject;
  fixtures.subjects.push(subjectB.id);
  const subjectCRes = await api('POST', '/school/subjects', {
    token: adminToken, body: { name: `${PREFIX} English`, code: `QA${CODE}E`, classId: classB.id },
  });
  assert.equal(subjectCRes.status, 200, subjectCRes.text);
  const subjectC = subjectCRes.body.subject;
  fixtures.subjects.push(subjectC.id);
  pass('subjects validate codes, reject duplicates and scope subjects to classes');

  /* ---------- students ---------- */
  await makeStudent(student1.userid, classA.id, sectionA.id);
  await makeStudent(student2.userid, classB.id, sectionB.id);
  pass('created linked active students in distinct classes');

  const moveSection = await api('PUT', `/school/sections/${sectionA.id}`, {
    token: adminToken, body: { classId: classB.id },
  });
  assert.equal(moveSection.status, 409);
  assert.match(moveSection.body.error, /cannot be moved/i);
  const deleteSection = await api('DELETE', `/school/sections/${sectionA.id}`, { token: adminToken });
  assert.equal(deleteSection.status, 409);
  pass('referenced sections cannot be moved or deleted');

  /* ---------- rooms ---------- */
  const missingCampus = await api('POST', '/school/rooms', {
    token: adminToken, body: { code: `${PREFIX}-X`, name: 'No campus' },
  });
  assert.equal(missingCampus.status, 400);
  const badCapacity = await api('POST', '/school/rooms', {
    token: adminToken, body: { campusId, code: `${PREFIX}-X`, name: 'Bad capacity', capacity: 0 },
  });
  assert.equal(badCapacity.status, 400);
  const roomARes = await api('POST', '/school/rooms', {
    token: adminToken,
    body: { campusId, code: `${PREFIX}-R1`, name: `${PREFIX} Room 1`, capacity: 60 },
  });
  assert.equal(roomARes.status, 200, roomARes.text);
  const roomA = roomARes.body.room;
  fixtures.rooms.push(roomA.id);
  const duplicateRoom = await api('POST', '/school/rooms', {
    token: adminToken, body: { campusId, code: `${PREFIX}-r1`.toLowerCase(), name: 'Duplicate' },
  });
  assert.equal(duplicateRoom.status, 409);
  const roomBRes = await api('POST', '/school/rooms', {
    token: adminToken,
    body: { campusId, code: `${PREFIX}-R2`, name: `${PREFIX} Room 2`, capacity: 40 },
  });
  assert.equal(roomBRes.status, 200, roomBRes.text);
  const roomB = roomBRes.body.room;
  fixtures.rooms.push(roomB.id);
  pass('rooms require a campus and capacity and reject duplicate codes');

  /* ---------- subject allocations ---------- */
  const missingTeacher = await api('POST', '/school/subject-allocations', {
    token: adminToken,
    body: {
      academicYearId: year1.id, classId: classA.id, sectionId: sectionA.id, subjectId: subjectA.id,
    },
  });
  assert.equal(missingTeacher.status, 400);
  const wrongSection = await api('POST', '/school/subject-allocations', {
    token: adminToken,
    body: {
      academicYearId: year1.id, classId: classA.id, sectionId: sectionB.id,
      subjectId: subjectA.id, teacherId: String(employee1.id),
    },
  });
  assert.equal(wrongSection.status, 400);
  assert.match(wrongSection.body.error, /section does not belong/i);
  const wrongSubjectClass = await api('POST', '/school/subject-allocations', {
    token: adminToken,
    body: {
      academicYearId: year1.id, classId: classA.id, sectionId: sectionA.id,
      subjectId: subjectC.id, teacherId: String(employee1.id),
    },
  });
  assert.equal(wrongSubjectClass.status, 400);
  assert.match(wrongSubjectClass.body.error, /not eligible/i);
  const inactiveTeacher = await api('POST', '/school/subject-allocations', {
    token: adminToken,
    body: {
      academicYearId: year1.id, classId: classA.id, sectionId: sectionA.id,
      subjectId: subjectA.id, teacherId: 'NOT_AN_ACTIVE_TEACHER',
    },
  });
  assert.equal(inactiveTeacher.status, 400);
  pass('allocations validate teacher, class/section membership and subject eligibility');

  async function makeAllocation(fields) {
    const res = await api('POST', '/school/subject-allocations', { token: adminToken, body: fields });
    assert.equal(res.status, 200, res.text);
    fixtures.allocations.push(res.body.allocation.id);
    return res.body.allocation;
  }

  const allocation1 = await makeAllocation({
    academicYearId: year1.id, classId: classA.id, sectionId: sectionA.id,
    subjectId: subjectA.id, teacherId: String(employee1.id),
  });
  const allocation2 = await makeAllocation({
    academicYearId: year1.id, classId: classA.id, sectionId: sectionA.id,
    subjectId: subjectB.id, teacherId: String(employee2.id),
  });
  const allocation3 = await makeAllocation({
    academicYearId: year1.id, classId: classB.id, sectionId: sectionB.id,
    subjectId: subjectC.id, teacherId: String(employee2.id),
  });
  const allocationYear2 = await makeAllocation({
    academicYearId: year2.id, classId: classA.id, sectionId: sectionA.id,
    subjectId: subjectA.id, teacherId: String(employee2.id),
  });
  const allocationClosed = await makeAllocation({
    academicYearId: year3.id, classId: classA.id, sectionId: sectionA.id,
    subjectId: subjectB.id, teacherId: String(employee2.id),
  });

  const duplicateAllocation = await api('POST', '/school/subject-allocations', {
    token: adminToken,
    body: {
      academicYearId: year1.id, classId: classA.id, sectionId: sectionA.id,
      subjectId: subjectA.id, teacherId: String(employee1.id),
    },
  });
  assert.equal(duplicateAllocation.status, 409);
  const tempAllocation = await makeAllocation({
    academicYearId: year1.id, classId: classA.id, sectionId: sectionA.id,
    subjectId: subjectA.id, teacherId: String(employee3.id),
  });
  const deleteTempAllocation = await api('DELETE', `/school/subject-allocations/${tempAllocation.id}`,
    { token: adminToken });
  assert.equal(deleteTempAllocation.status, 200, deleteTempAllocation.text);
  fixtures.allocations = fixtures.allocations.filter((id) => id !== tempAllocation.id);
  pass('allocations reject duplicates and unreferenced allocations can be deleted');

  const deactivateAlloc2 = await api('PUT', `/school/subject-allocations/${allocation2.id}`, {
    token: adminToken, body: { isActive: false },
  });
  assert.equal(deactivateAlloc2.status, 200, deactivateAlloc2.text);
  const homeworkOnInactive = await api('POST', '/school/homework', {
    token: adminToken,
    body: {
      allocationId: allocation2.id, title: `${PREFIX} Inactive`, assignedDate: '2095-04-05',
      dueDate: '2095-05-10',
    },
  });
  assert.equal(homeworkOnInactive.status, 409);
  assert.match(homeworkOnInactive.body.error, /inactive/i);
  await api('PUT', `/school/subject-allocations/${allocation2.id}`, {
    token: adminToken, body: { isActive: true },
  });
  pass('homework cannot be created against an inactive allocation');

  /* ---------- homework lifecycle ---------- */
  const teacherForeignHomework = await api('POST', '/school/homework', {
    token: teacher1.token,
    body: {
      allocationId: allocation2.id, title: `${PREFIX} Foreign`, assignedDate: '2095-04-05',
      dueDate: '2095-05-10',
    },
  });
  assert.equal(teacherForeignHomework.status, 403);
  pass('a teacher cannot author homework on another teacher\'s allocation');

  const createHw1 = await api('POST', '/school/homework', {
    token: teacher1.token,
    body: {
      allocationId: allocation1.id,
      classId: classB.id, sectionId: sectionB.id, teacherId: employee2.id,
      title: `${PREFIX} Homework 1`,
      description: 'Read chapter one',
      assignedDate: '2095-04-05',
      dueDate: '2095-05-10',
      maxMarks: 10,
    },
  });
  assert.equal(createHw1.status, 200, createHw1.text);
  const hw1 = createHw1.body.homework;
  fixtures.homework.push(hw1.id);
  assert.equal(hw1.class_id, classA.id);
  assert.equal(hw1.section_id, sectionA.id);
  assert.equal(hw1.subject_id, subjectA.id);
  assert.equal(hw1.teacher_id, String(employee1.id));
  assert.equal(hw1.academic_year_id, year1.id);
  assert.equal(hw1.status, 'draft');
  pass('homework derives class, section, subject, teacher and year from the allocation');

  const badDates = await api('POST', '/school/homework', {
    token: teacher1.token,
    body: {
      allocationId: allocation1.id, title: `${PREFIX} Bad dates`,
      assignedDate: '2095-04-10', dueDate: '2095-04-09',
    },
  });
  assert.equal(badDates.status, 400);
  const badMarks = await api('POST', '/school/homework', {
    token: teacher1.token,
    body: {
      allocationId: allocation1.id, title: `${PREFIX} Bad marks`,
      assignedDate: '2095-04-05', dueDate: '2095-05-10', maxMarks: 0,
    },
  });
  assert.equal(badMarks.status, 400);
  pass('homework validates dates and marks');

  async function adminHomework(title, allocationId, extra = {}) {
    const res = await api('POST', '/school/homework', {
      token: adminToken,
      body: {
        allocationId, title: `${PREFIX} ${title}`,
        assignedDate: '2095-04-05', dueDate: '2095-05-10', ...extra,
      },
    });
    assert.equal(res.status, 200, res.text);
    fixtures.homework.push(res.body.homework.id);
    return res.body.homework;
  }

  const hwDraft = await adminHomework('Draft', allocation1.id, { maxMarks: 20 });
  const hw2 = await adminHomework('Homework 2', allocation2.id);
  const hwDerive = await adminHomework('Derive', allocation2.id);

  const updateDerive = await api('PUT', `/school/homework/${hwDerive.id}`, {
    token: adminToken, body: { allocationId: allocationYear2.id },
  });
  assert.equal(updateDerive.status, 200, updateDerive.text);
  assert.equal(updateDerive.body.homework.academic_year_id, year2.id);
  assert.equal(updateDerive.body.homework.subject_id, subjectA.id);
  assert.equal(updateDerive.body.homework.teacher_id, String(employee2.id));
  pass('moving a draft to another allocation updates its year, subject and teacher');

  const teacherOtherDraft = await api('GET', `/school/homework/${hw2.id}`, { token: teacher1.token });
  assert.equal(teacherOtherDraft.status, 404);
  const teacherOtherList = await api('GET', '/school/homework', { token: teacher2.token });
  assert.equal(teacherOtherList.status, 200);
  assert.equal(teacherOtherList.body.homework.some((h) => h.id === hw1.id), false);
  pass('teachers cannot read another teacher\'s homework');

  const studentDraftList = await api('GET', '/school/homework', { token: student1.token });
  assert.equal(studentDraftList.status, 200);
  assert.equal(studentDraftList.body.homework.some((h) => h.id === hw1.id), false);
  const studentDraftDetail = await api('GET', `/school/homework/${hw1.id}`, { token: student1.token });
  assert.equal(studentDraftDetail.status, 404);
  pass('students cannot see draft homework');

  const unlinkedTeacherList = await api('GET', '/school/homework', { token: unlinkedTeacher.token });
  assert.equal(unlinkedTeacherList.status, 200);
  assert.equal(unlinkedTeacherList.body.homework.length, 0);
  const parentList = await api('GET', '/school/homework', { token: parent.token });
  assert.equal(parentList.status, 200);
  assert.equal(parentList.body.homework.length, 0);
  pass('unlinked teachers and parents fail closed to an empty homework list');

  const publishHw1 = await api('POST', `/school/homework/${hw1.id}/publish`, { token: teacher1.token });
  assert.equal(publishHw1.status, 200, publishHw1.text);
  assert.equal(publishHw1.body.homework.status, 'published');
  assert.ok(publishHw1.body.homework.published_at);
  pass('a teacher can publish homework on their own allocation');

  const studentPublishedList = await api('GET', '/school/homework', { token: student1.token });
  assert.equal(studentPublishedList.status, 200);
  assert.ok(studentPublishedList.body.homework.some((h) => h.id === hw1.id));
  const otherClassDetail = await api('GET', `/school/homework/${hw1.id}`, { token: student2.token });
  assert.equal(otherClassDetail.status, 404);
  const otherClassList = await api('GET', '/school/homework', { token: student2.token });
  assert.equal(otherClassList.body.homework.some((h) => h.id === hw1.id), false);
  pass('published homework is visible only to its class and section');

  const forgedStudentList = await api('GET', `/school/homework?classId=${classB.id}&academicYearId=${year2.id}`,
    { token: student1.token });
  assert.equal(forgedStudentList.status, 200);
  assert.ok(forgedStudentList.body.homework.every((h) => h.class_id === classA.id));
  pass('student homework scope ignores forged class and year filters');

  const submit1 = await api('POST', `/school/homework/${hw1.id}/submit`, {
    token: student1.token,
    body: { submissionText: 'First attempt', classId: classB.id },
  });
  assert.equal(submit1.status, 200, submit1.text);
  const submission1 = submit1.body.submission;
  fixtures.submissions.push(submission1.id);
  assert.equal(submission1.student_id, fixtures.students[0]);
  assert.equal(submission1.revision, 1);
  const resubmit = await api('POST', `/school/homework/${hw1.id}/submit`, {
    token: student1.token, body: { submissionText: 'Second attempt' },
  });
  assert.equal(resubmit.status, 200, resubmit.text);
  assert.equal(resubmit.body.submission.revision, 2);
  assert.equal(resubmit.body.submission.id, submission1.id);
  pass('students submit for themselves and resubmission increments the revision');

  const foreignSubmit = await api('POST', `/school/homework/${hw1.id}/submit`, {
    token: student2.token, body: { submissionText: 'Not mine' },
  });
  assert.equal(foreignSubmit.status, 403);
  const unlinkedSubmit = await api('POST', `/school/homework/${hw1.id}/submit`, {
    token: unlinkedStudent.token, body: { studentId: fixtures.students[0], submissionText: 'Forged' },
  });
  assert.equal(unlinkedSubmit.status, 403);
  pass('other-class and unlinked students cannot submit');

  const studentSubmissions = await api('GET', `/school/homework/${hw1.id}/submissions`, { token: student1.token });
  assert.equal(studentSubmissions.status, 200);
  assert.equal(studentSubmissions.body.submissions.length, 1);
  assert.equal(studentSubmissions.body.submissions[0].student_id, fixtures.students[0]);
  const foreignTeacherSubmissions = await api('GET', `/school/homework/${hw1.id}/submissions`,
    { token: teacher2.token });
  assert.equal(foreignTeacherSubmissions.status, 200);
  assert.equal(foreignTeacherSubmissions.body.submissions.length, 0);
  const ownerSubmissions = await api('GET', `/school/homework/${hw1.id}/submissions`, { token: teacher1.token });
  assert.ok(ownerSubmissions.body.submissions.some((s) => s.id === submission1.id));
  pass('submissions are visible only to the student and the owning teacher');

  const eligibleForStudent = await api('GET', `/school/homework/${hw1.id}/eligible-students`,
    { token: student1.token });
  assert.deepEqual(eligibleForStudent.body.students.map((s) => s.id), [fixtures.students[0]]);
  const eligibleForOutsider = await api('GET', `/school/homework/${hw1.id}/eligible-students`,
    { token: student2.token });
  assert.equal(eligibleForOutsider.body.students.length, 0);
  pass('eligible-student derivation is limited to the homework class/section');

  const foreignGrade = await api('POST', `/school/homework/submissions/${submission1.id}/grade`, {
    token: teacher2.token, body: { marks: 5 },
  });
  assert.equal(foreignGrade.status, 403);
  const negativeGrade = await api('POST', `/school/homework/submissions/${submission1.id}/grade`, {
    token: teacher1.token, body: { marks: -1 },
  });
  assert.equal(negativeGrade.status, 400);
  const tooHighGrade = await api('POST', `/school/homework/submissions/${submission1.id}/grade`, {
    token: teacher1.token, body: { marks: 11 },
  });
  assert.equal(tooHighGrade.status, 400);
  const grade = await api('POST', `/school/homework/submissions/${submission1.id}/grade`, {
    token: teacher1.token, body: { marks: 9, feedback: 'Good work' },
  });
  assert.equal(grade.status, 200, grade.text);
  assert.equal(grade.body.submission.status, 'graded');
  assert.equal(Number(grade.body.submission.marks), 9);
  pass('grading is owner-scoped and enforces mark bounds');

  const gradeAgain = await api('POST', `/school/homework/${hw1.id}/submit`, {
    token: student1.token, body: { submissionText: 'After grading' },
  });
  assert.equal(gradeAgain.status, 409);
  pass('graded submissions cannot be resubmitted');

  const publishOnInactive = await (async () => {
    await api('PUT', `/school/subject-allocations/${allocation2.id}`, { token: adminToken, body: { isActive: false } });
    const res = await api('POST', `/school/homework/${hw2.id}/publish`, { token: adminToken });
    await api('PUT', `/school/subject-allocations/${allocation2.id}`, { token: adminToken, body: { isActive: true } });
    return res;
  })();
  assert.equal(publishOnInactive.status, 409);
  assert.match(publishOnInactive.body.error, /active allocation/i);
  pass('homework cannot be published against an inactive allocation');

  const publishHw2 = await api('POST', `/school/homework/${hw2.id}/publish`, { token: adminToken });
  assert.equal(publishHw2.status, 200, publishHw2.text);

  const hwClosedDraft = await adminHomework('Closed year', allocationClosed.id);
  await api('POST', `/school/academic-years/${year3.id}/close`, { token: adminToken });
  const homeworkInClosedYear = await api('POST', '/school/homework', {
    token: adminToken,
    body: {
      allocationId: allocationClosed.id, title: `${PREFIX} Closed`, assignedDate: '2097-04-05',
      dueDate: '2097-05-10',
    },
  });
  assert.equal(homeworkInClosedYear.status, 409);
  assert.match(homeworkInClosedYear.body.error, /closed/i);
  const publishInClosedYear = await api('POST', `/school/homework/${hwClosedDraft.id}/publish`,
    { token: adminToken });
  assert.equal(publishInClosedYear.status, 409);
  assert.match(publishInClosedYear.body.error, /open academic year/i);
  const deleteClosedDraft = await api('DELETE', `/school/homework/${hwClosedDraft.id}`, { token: adminToken });
  assert.equal(deleteClosedDraft.status, 200, deleteClosedDraft.text);
  fixtures.homework = fixtures.homework.filter((id) => id !== hwClosedDraft.id);
  await api('POST', `/school/academic-years/${year3.id}/reopen`, { token: adminToken });
  pass('homework cannot be created or published in a closed year while drafts stay deletable');

  const returnToDraft = await api('PUT', `/school/homework/${hw1.id}`, {
    token: teacher1.token, body: { status: 'draft' },
  });
  assert.equal(returnToDraft.status, 409);
  assert.match(returnToDraft.body.error, /submissions/i);
  pass('homework with submissions cannot return to draft');

  const closeHw1 = await api('POST', `/school/homework/${hw1.id}/close`, { token: teacher1.token });
  assert.equal(closeHw1.status, 200, closeHw1.text);
  assert.equal(closeHw1.body.homework.status, 'closed');
  const editClosed = await api('PUT', `/school/homework/${hw1.id}`, {
    token: teacher1.token, body: { description: 'Changed' },
  });
  assert.equal(editClosed.status, 409);
  const lateSubmit = await api('POST', `/school/homework/${hw1.id}/submit`, {
    token: student1.token, body: { submissionText: 'Too late' },
  });
  assert.equal(lateSubmit.status, 409);
  const closedVisible = await api('GET', `/school/homework/${hw1.id}`, { token: student1.token });
  assert.equal(closedVisible.status, 200);
  pass('closed homework is read-only but remains visible to its students');

  const archiveHw1 = await api('POST', `/school/homework/${hw1.id}/archive`, { token: teacher1.token });
  assert.equal(archiveHw1.status, 200, archiveHw1.text);
  const gradeArchived = await api('POST', `/school/homework/submissions/${submission1.id}/grade`, {
    token: teacher1.token, body: { marks: 7 },
  });
  assert.equal(gradeArchived.status, 409);
  const editArchived = await api('PUT', `/school/homework/${hw1.id}`, {
    token: teacher1.token, body: { description: 'Changed' },
  });
  assert.equal(editArchived.status, 409);
  const deleteArchived = await api('DELETE', `/school/homework/${hw1.id}`, { token: adminToken });
  assert.equal(deleteArchived.status, 409);
  assert.match(deleteArchived.body.error, /archived/i);
  pass('archived homework is immutable and its submission history is preserved');

  const invalidTransition = await api('POST', `/school/homework/${hwDraft.id}/close`, { token: adminToken });
  assert.equal(invalidTransition.status, 409);
  const teacherDelete = await api('DELETE', `/school/homework/${hwDraft.id}`, { token: teacher1.token });
  assert.equal(teacherDelete.status, 403);
  const deleteDraft = await api('DELETE', `/school/homework/${hwDraft.id}`, { token: adminToken });
  assert.equal(deleteDraft.status, 200, deleteDraft.text);
  fixtures.homework = fixtures.homework.filter((id) => id !== hwDraft.id);
  pass('invalid status transitions are rejected and only managers may delete drafts');

  /* ---------- referential history ---------- */
  /* Create a draft timetable version for testing */
  const versionRes = await api('POST', '/school/timetable/versions', {
    token: adminToken,
    body: {
      academicYearId: year1.id,
      name: `${PREFIX} Test Version`,
      effectiveFrom: '2090-04-01',
      effectiveTo: '2091-03-31',
      status: 'draft',
    },
  });
  assert.equal(versionRes.status, 200, versionRes.text);
  const testVersionId = versionRes.body.version.id;

  const timetableRes = await api('POST', '/school/timetable', {
    token: adminToken,
    body: {
      versionId: testVersionId,
      classId: classA.id, sectionId: sectionA.id, allocationId: allocation1.id,
      roomId: roomA.id, dayOfWeek: 5, periodNo: 5, startTime: '10:00', endTime: '10:45',
    },
  });
  assert.equal(timetableRes.status, 200, timetableRes.text);
  const timetableEntry = timetableRes.body.entry;
  fixtures.timetables.push(timetableEntry.id);

  const conflicts = await api('GET',
    `/school/rooms/${roomA.id}/conflicts?dayOfWeek=5&periodNo=5`, { token: adminToken });
  assert.equal(conflicts.status, 200);
  assert.ok(conflicts.body.conflicts.some((c) => c.id === timetableEntry.id));
  pass('room conflict lookup reports an existing booking');

  const deleteAllocation = await api('DELETE', `/school/subject-allocations/${allocation1.id}`,
    { token: adminToken });
  assert.equal(deleteAllocation.status, 409);
  assert.match(deleteAllocation.body.error, /deactivate/i);
  const deleteRoom = await api('DELETE', `/school/rooms/${roomA.id}`, { token: adminToken });
  assert.equal(deleteRoom.status, 409);
  assert.match(deleteRoom.body.error, /archive/i);
  const deleteSubject = await api('DELETE', `/school/subjects/${subjectA.id}`, { token: adminToken });
  assert.equal(deleteSubject.status, 409);
  const deleteClass = await api('DELETE', `/school/classes/${classA.id}`, { token: adminToken });
  assert.equal(deleteClass.status, 409);
  pass('referenced allocations, rooms, subjects and classes are restricted, not cascaded');

  const changeYearDates = await api('PUT', `/school/academic-years/${year2.id}`, {
    token: adminToken, body: { startDate: '2096-05-01', endDate: '2097-04-30' },
  });
  assert.equal(changeYearDates.status, 409);
  assert.match(changeYearDates.body.error, /close it instead/i);
  const deleteYear2 = await api('DELETE', `/school/academic-years/${year2.id}`, { token: adminToken });
  assert.equal(deleteYear2.status, 409);
  pass('a year with academic records cannot have dates changed or be deleted');

  const archiveRoom = await api('PUT', `/school/rooms/${roomA.id}`, {
    token: adminToken, body: { isActive: false },
  });
  assert.equal(archiveRoom.status, 200, archiveRoom.text);
  const activeRooms = await api('GET', '/school/rooms', { token: adminToken });
  assert.equal(activeRooms.body.rooms.some((r) => r.id === roomA.id), false);
  const archiveAllocation = await api('PUT', `/school/subject-allocations/${allocation1.id}`, {
    token: adminToken, body: { isActive: false },
  });
  assert.equal(archiveAllocation.status, 200, archiveAllocation.text);
  await api('PUT', `/school/subject-allocations/${allocation1.id}`, {
    token: adminToken, body: { isActive: true },
  });
  pass('referenced rooms and allocations can be archived instead of deleted');

  const deleteTimetable = await api('DELETE', `/school/timetable/${timetableEntry.id}`, { token: adminToken });
  assert.equal(deleteTimetable.status, 200, deleteTimetable.text);
  fixtures.timetables = fixtures.timetables.filter((id) => id !== timetableEntry.id);
  pass('the timetable entry can be removed after archival decisions');

  /* ---------- permissions ---------- */
  const teacherClassWrite = await api('POST', '/school/classes', {
    token: teacher1.token, body: { name: `${PREFIX} Nope` },
  });
  assert.equal(teacherClassWrite.status, 403);
  const teacherAllocationWrite = await api('POST', '/school/subject-allocations', {
    token: teacher1.token,
    body: {
      academicYearId: year1.id, classId: classA.id, sectionId: sectionA.id,
      subjectId: subjectB.id, teacherId: String(employee1.id),
    },
  });
  assert.equal(teacherAllocationWrite.status, 403);
  const teacherRoomWrite = await api('POST', '/school/rooms', {
    token: teacher1.token, body: { campusId, code: `${PREFIX}-NO`, name: 'Nope' },
  });
  assert.equal(teacherRoomWrite.status, 403);
  const teacherYearDelete = await api('DELETE', `/school/academic-years/${year3.id}`, { token: teacher1.token });
  assert.equal(teacherYearDelete.status, 403);
  const studentHomeworkWrite = await api('POST', '/school/homework', {
    token: student1.token, body: { allocationId: allocation1.id, title: 'Nope' },
  });
  assert.equal(studentHomeworkWrite.status, 403);
  const studentGrade = await api('POST', `/school/homework/submissions/${submission1.id}/grade`, {
    token: student1.token, body: { marks: 10 },
  });
  assert.equal(studentGrade.status, 403);
  pass('teachers and students are denied management and grading permissions');

  const teacherYears = await api('GET', '/school/academic-years', { token: teacher1.token });
  assert.equal(teacherYears.status, 200);
  assert.ok(teacherYears.body.years.some((y) => y.id === year1.id));
  pass('teachers retain read access to academics');

  /* ---------- tenant scoping ---------- */
  const spoofedClass = await api('POST', '/school/classes', {
    token: adminToken,
    body: { name: `${PREFIX} Spoofed`, app_id: 'xerp', appId: 'xerp' },
  });
  assert.equal(spoofedClass.status, 200, spoofedClass.text);
  const spoofRow = await pool.query('SELECT app_id FROM school_classes WHERE id=$1', [spoofedClass.body.class.id]);
  assert.equal(spoofRow.rows[0]?.app_id, APP_ID);
  await api('DELETE', `/school/classes/${spoofedClass.body.class.id}`, { token: adminToken });
  pass('tenant app_id is taken from the authenticated session, not the request body');

  assert.ok(checks >= 35, `expected a meaningful suite, ran ${checks} checks`);
  console.log(`\nAcademics workflow tests passed (${checks} checks).`);
}

try {
  await main();
} finally {
  await cleanup();
  await pool.end();
  if (server && !server.killed) {
    server.kill();
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}
