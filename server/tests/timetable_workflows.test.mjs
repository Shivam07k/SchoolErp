/* End-to-end Timetable workflows against a self-started server.

   Run: node tests/timetable_workflows.test.mjs

   The test creates uniquely named fixtures in the configured default company
   database, exercises the HTTP API as manager, teacher and student, and removes
   its fixtures again. It covers draft/published visibility, self-scoped views,
   conflict rules, atomic concurrent booking, substitution validation and
   history preservation.
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
const PREFIX = `QA_TT_${STAMP}`;
const PASSWORD = 'qa-test-pass';

const pool = getPool();
const fixtures = {
  users: [], roles: [], employees: [], students: [],
  schoolUsers: [],
  years: [], classes: [], sections: [], subjects: [], rooms: [], allocations: [],
  timetables: [], substitutions: [], versions: [],
};

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
    `INSERT INTO school_user_roles (app_id, user_id, role_id) VALUES ($1,$2,$3)`,
    [APP_ID, userid, role.id],
  );
  fixtures.roles.push({ userid, roleId: role.id });
  const token = await login(userid);
  return { userid, token };
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

async function makeStudent(userid, classId, sectionId, academicYearId) {
  const { rows: [row] } = await pool.query(
    `INSERT INTO school_students
       (app_id, admission_no, first_name, last_name, class_id, section_id, status, user_id)
     VALUES ($1,$2,$3,'QA',$4,$5,'active',$6) RETURNING *`,
    [APP_ID, `${PREFIX}_ADM`, `${PREFIX} Student`, classId, sectionId, userid],
  );
  fixtures.students.push(row.id);
  // Create enrollment for the student in the specified academic year
  if (academicYearId) {
    await pool.query(
      `INSERT INTO school_student_enrollments
         (app_id, student_id, academic_year_id, class_id, section_id, status, joined_on)
       VALUES ($1,$2,$3,$4,$5,'studying',CURRENT_DATE)`,
      [APP_ID, row.id, academicYearId, classId, sectionId],
    );
  }
  return row;
}

function dateOnWeekday(start, weekday) {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + ((weekday - date.getUTCDay() + 7) % 7));
  return date.toISOString().slice(0, 10);
}

async function cleanup() {
  // Direct cleanup is deliberately belt-and-braces: assertions above may have
  // failed after creating partial data, so each delete is best-effort.
  const q = (sql, params) => pool.query(sql, params).catch(() => {});
  await q('DELETE FROM school_substitutions WHERE app_id=$1 AND (timetable_id = ANY($2::int[]) OR absent_teacher_id = ANY($3::text[]) OR substitute_teacher_id = ANY($3::text[]))',
    [APP_ID, fixtures.timetables, fixtures.users]);
  await q('DELETE FROM school_timetables WHERE app_id=$1 AND id = ANY($2::int[])', [APP_ID, fixtures.timetables]);
  await q('DELETE FROM school_timetable_versions WHERE app_id=$1 AND id = ANY($2::int[])', [APP_ID, fixtures.versions]);
  await q('DELETE FROM school_homework WHERE app_id=$1 AND allocation_id = ANY($2::int[])', [APP_ID, fixtures.allocations]);
  await q('DELETE FROM school_subject_allocations WHERE app_id=$1 AND id = ANY($2::int[])', [APP_ID, fixtures.allocations]);
  await q('DELETE FROM school_rooms WHERE app_id=$1 AND id = ANY($2::int[])', [APP_ID, fixtures.rooms]);
  await q('DELETE FROM school_subjects WHERE app_id=$1 AND id = ANY($2::int[])', [APP_ID, fixtures.subjects]);
  await q('DELETE FROM school_students WHERE app_id=$1 AND id = ANY($2::int[])', [APP_ID, fixtures.students]);
  await q('DELETE FROM school_sections WHERE app_id=$1 AND id = ANY($2::int[])', [APP_ID, fixtures.sections]);
  await q('DELETE FROM school_classes WHERE app_id=$1 AND id = ANY($2::int[])', [APP_ID, fixtures.classes]);
  await q('DELETE FROM school_academic_years WHERE app_id=$1 AND id = ANY($2::int[])', [APP_ID, fixtures.years]);
  // Also clean up any test years by the fixed dates used in this test suite
  await q(`DELETE FROM school_academic_years WHERE app_id=$1 AND start_date IN ('2090-04-01','2091-04-01','2092-04-01','2093-04-01')`, [APP_ID]);
  await q('DELETE FROM school_hr_employees WHERE app_id=$1 AND id = ANY($2::int[])', [APP_ID, fixtures.employees]);
  await q('DELETE FROM school_user_roles WHERE app_id=$1 AND user_id = ANY($2::text[])', [APP_ID, fixtures.users]);
  await q('DELETE FROM school_users WHERE app_id=$1 AND id = ANY($2::int[])', [APP_ID, fixtures.schoolUsers]);
  await q('DELETE FROM "tblHO_User" WHERE "UserId" = ANY($1::text[])', [fixtures.users]);
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

  /* ---------- fixtures ---------- */
  const teacher1 = await makeUser('T1', 'TEACHER');
  const teacher2 = await makeUser('T2', 'TEACHER');
  const teacher3 = await makeUser('T3', 'TEACHER');
  const unlinkedTeacher = await makeUser('UT', 'TEACHER');
  const studentUser = await makeUser('S1', 'STUDENT');
  const unlinkedStudent = await makeUser('US', 'STUDENT');

  const year1Res = await api('POST', '/school/academic-years', {
    token: adminToken,
    body: { name: `${PREFIX} Year 1`, startDate: '2090-04-01', endDate: '2091-03-31' },
  });
  assert.equal(year1Res.status, 200, year1Res.text);
  const year1 = year1Res.body.year;
  fixtures.years.push(year1.id);
  const year2Res = await api('POST', '/school/academic-years', {
    token: adminToken,
    body: { name: `${PREFIX} Year 2`, startDate: '2091-04-01', endDate: '2092-03-31' },
  });
  assert.equal(year2Res.status, 200, year2Res.text);
  const year2 = year2Res.body.year;
  fixtures.years.push(year2.id);

  const employee1 = await makeEmployee('E1', teacher1.userid);
  const employee2 = await makeEmployee('E2', teacher2.userid);
  const employee3 = await makeEmployee('E3', teacher3.userid);

  const classARes = await api('POST', '/school/classes', {
    token: adminToken, body: { name: `${PREFIX} Class A`, sortOrder: 900 },
  });
  assert.equal(classARes.status, 200, classARes.text);
  const classA = classARes.body.class;
  fixtures.classes.push(classA.id);

  const classBRes = await api('POST', '/school/classes', {
    token: adminToken, body: { name: `${PREFIX} Class B`, sortOrder: 901 },
  });
  assert.equal(classBRes.status, 200, classBRes.text);
  const classB = classBRes.body.class;
  fixtures.classes.push(classB.id);

  const sectionARes = await api('POST', '/school/sections', {
    token: adminToken, body: { classId: classA.id, name: 'A', capacity: 60 },
  });
  assert.equal(sectionARes.status, 200, sectionARes.text);
  const sectionA = sectionARes.body.section;
  fixtures.sections.push(sectionA.id);

  const sectionBRes = await api('POST', '/school/sections', {
    token: adminToken, body: { classId: classB.id, name: 'B', capacity: 60 },
  });
  assert.equal(sectionBRes.status, 200, sectionBRes.text);
  const sectionB = sectionBRes.body.section;
  fixtures.sections.push(sectionB.id);

  const subjectARes = await api('POST', '/school/subjects', {
    token: adminToken, body: { name: `${PREFIX} Math`, code: `Q${STAMP.slice(-8)}M`, classId: classA.id },
  });
  assert.equal(subjectARes.status, 200, subjectARes.text);
  const subjectA = subjectARes.body.subject;
  fixtures.subjects.push(subjectA.id);

  const subjectBRes = await api('POST', '/school/subjects', {
    token: adminToken, body: { name: `${PREFIX} Science`, code: `Q${STAMP.slice(-8)}S`, classId: classA.id },
  });
  assert.equal(subjectBRes.status, 200, subjectBRes.text);
  const subjectB = subjectBRes.body.subject;
  fixtures.subjects.push(subjectB.id);

  const subjectCRes = await api('POST', '/school/subjects', {
    token: adminToken, body: { name: `${PREFIX} English`, code: `Q${STAMP.slice(-8)}E`, classId: classB.id },
  });
  assert.equal(subjectCRes.status, 200, subjectCRes.text);
  const subjectC = subjectCRes.body.subject;
  fixtures.subjects.push(subjectC.id);

  const roomARes = await api('POST', '/school/rooms', {
    token: adminToken,
    body: { campusId, code: `${PREFIX}-R1`, name: `${PREFIX} Room 1`, capacity: 60 },
  });
  assert.equal(roomARes.status, 200, roomARes.text);
  const roomA = roomARes.body.room;
  fixtures.rooms.push(roomA.id);

  const roomBRes = await api('POST', '/school/rooms', {
    token: adminToken,
    body: { campusId, code: `${PREFIX}-R2`, name: `${PREFIX} Room 2`, capacity: 60 },
  });
  assert.equal(roomBRes.status, 200, roomBRes.text);
  const roomB = roomBRes.body.room;
  fixtures.rooms.push(roomB.id);

  const roomCRes = await api('POST', '/school/rooms', {
    token: adminToken,
    body: { campusId, code: `${PREFIX}-R3`, name: `${PREFIX} Room 3`, capacity: 60 },
  });
  assert.equal(roomCRes.status, 200, roomCRes.text);
  const roomC = roomCRes.body.room;
  fixtures.rooms.push(roomC.id);

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
    academicYearId: year1.id, classId: classA.id, sectionId: sectionA.id,
    subjectId: subjectA.id, teacherId: String(employee3.id),
  });
  const allocationB = await makeAllocation({
    academicYearId: year1.id, classId: classB.id, sectionId: sectionB.id,
    subjectId: subjectC.id, teacherId: String(employee2.id),
  });
  const allocationYear2 = await makeAllocation({
    academicYearId: year2.id, classId: classA.id, sectionId: sectionA.id,
    subjectId: subjectB.id, teacherId: String(employee2.id),
  });

  await makeStudent(studentUser.userid, classA.id, sectionA.id, year1.id);
  pass('created isolated academic fixtures through the API');

  /* Create a draft timetable version for testing */
  const versionRes = await api('POST', '/school/timetable/versions', {
    token: adminToken,
    body: {
      academicYearId: year1.id,
      name: `${PREFIX} Draft v1`,
      effectiveFrom: '2090-04-01',
      effectiveTo: '2091-03-31',
      status: 'draft',
    },
  });
  assert.equal(versionRes.status, 200, versionRes.text);
  const draftVersion = versionRes.body.version;
  const draftVersionId = draftVersion.id;
  fixtures.versions.push(draftVersionId);
  pass('created draft timetable version');

  /* ---------- timetable validation ---------- */
  const baseSlot = { dayOfWeek: 1, periodNo: 1, startTime: '09:00', endTime: '09:45' };
  const missingAllocation = await api('POST', '/school/timetable', {
    token: adminToken,
    body: { versionId: draftVersionId, classId: classA.id, sectionId: sectionA.id, roomId: roomA.id, ...baseSlot },
  });
  assert.equal(missingAllocation.status, 400);
  assert.match(missingAllocation.body.error, /allocation/i);
  pass('timetable rejects a missing subject allocation');

  const missingRoom = await api('POST', '/school/timetable', {
    token: adminToken,
    body: { versionId: draftVersionId, classId: classA.id, sectionId: sectionA.id, allocationId: allocation1.id, ...baseSlot },
  });
  assert.equal(missingRoom.status, 400);
  assert.match(missingRoom.body.error, /room/i);
  pass('timetable rejects a missing room');

  /* ---------- atomic concurrent booking ---------- */
  const createBody = {
    versionId: draftVersionId,
    classId: classA.id, sectionId: sectionA.id, allocationId: allocation1.id,
    roomId: roomA.id, ...baseSlot,
  };
  const concurrent = await Promise.all([
    api('POST', '/school/timetable', { token: adminToken, body: createBody }),
    api('POST', '/school/timetable', { token: adminToken, body: createBody }),
  ]);
  const statuses = concurrent.map((r) => r.status).sort((a, b) => a - b);
  assert.deepEqual(statuses, [200, 409], `concurrent booking statuses: ${JSON.stringify(statuses)}`);
  const winner = concurrent.find((r) => r.status === 200);
  const mainEntry = winner.body.entry;
  fixtures.timetables.push(mainEntry.id);
  assert.equal(mainEntry.is_published, false);
  assert.equal(mainEntry.academic_year_id, year1.id);
  assert.equal(mainEntry.teacher_id, String(employee1.id));
  pass('simultaneous bookings for one slot produce exactly one entry');

  /* ---------- conflict rules ---------- */
  const roomConflict = await api('POST', '/school/timetable', {
    token: adminToken,
    body: { versionId: draftVersionId, classId: classA.id, sectionId: sectionA.id, allocationId: allocation3.id, roomId: roomA.id, ...baseSlot },
  });
  assert.equal(roomConflict.status, 409);
  assert.match(roomConflict.body.error, /room/i);
  pass('room overlap is rejected');

  const teacherConflict = await api('POST', '/school/timetable', {
    token: adminToken,
    body: { versionId: draftVersionId, classId: classA.id, sectionId: sectionA.id, allocationId: allocation1.id, roomId: roomC.id, ...baseSlot },
  });
  assert.equal(teacherConflict.status, 409);
  assert.match(teacherConflict.body.error, /teacher/i);
  pass('teacher overlap is rejected');

  const classConflict = await api('POST', '/school/timetable', {
    token: adminToken,
    body: { versionId: draftVersionId, classId: classA.id, sectionId: sectionA.id, allocationId: allocation3.id, roomId: roomC.id, ...baseSlot },
  });
  assert.equal(classConflict.status, 409);
  assert.match(classConflict.body.error, /class/i);
  pass('class/section overlap is rejected');

  /* ---------- draft visibility and self scope ---------- */
  const draftTeacherView = await api('GET', `/school/timetable?date=2090-04-07`, { token: teacher1.token }); // date within draft version range but draft
  assert.equal(draftTeacherView.status, 200);
  assert.equal(draftTeacherView.body.timetable.length, 0);
  pass('teacher cannot see an unpublished draft');

  const draftStudentView = await api('GET', `/school/timetable?date=2090-04-07`, { token: studentUser.token });
  assert.equal(draftStudentView.status, 200);
  assert.equal(draftStudentView.body.timetable.length, 0);
  pass('student cannot see an unpublished draft');

  /* Publish the version instead of individual entry */
  const publishVersion = await api('PUT', `/school/timetable/versions/${draftVersionId}`, {
    token: adminToken,
    body: { status: 'published' },
  });
  assert.equal(publishVersion.status, 200, publishVersion.text);
  assert.equal(publishVersion.body.version.status, 'published');

  /* Also publish the main entry so substitutions can reference it */
  const publishMainEntry = await api('POST', `/school/timetable/${mainEntry.id}/publish`, { token: adminToken });
  assert.equal(publishMainEntry.status, 200, publishMainEntry.text);
  assert.equal(publishMainEntry.body.entry.is_published, true);

  const teacherView = await api('GET',
    `/school/timetable?date=2090-04-07&classId=${classB.id}&teacherId=${employee2.id}`,
    { token: teacher1.token });
  assert.equal(teacherView.status, 200);
  assert.ok(teacherView.body.timetable.length >= 1);
  assert.ok(teacherView.body.timetable.every((row) => row.teacher_id === String(employee1.id)));
  pass('teacher view ignores caller-supplied class and teacher filters');

  const studentView = await api('GET',
    `/school/timetable?date=2090-04-07&classId=${classB.id}&sectionId=${sectionB.id}`,
    { token: studentUser.token });
  assert.equal(studentView.status, 200);
  assert.ok(studentView.body.timetable.length >= 1);
  assert.ok(studentView.body.timetable.every((row) => row.class_id === classA.id && row.section_id === sectionA.id));
  pass('student view ignores forged class/section filters');

  const unlinkedTeacherView = await api('GET', '/school/timetable?date=2090-04-07', { token: unlinkedTeacher.token });
  assert.equal(unlinkedTeacherView.status, 200);
  assert.equal(unlinkedTeacherView.body.timetable.length, 0);
  pass('teacher with no timetable assignment fails closed to an empty view');

  const unlinkedStudentView = await api('GET', '/school/timetable?date=2090-04-07&classId=999999', { token: unlinkedStudent.token });
  assert.equal(unlinkedStudentView.status, 200);
  assert.equal(unlinkedStudentView.body.timetable.length, 0);
  assert.equal(unlinkedStudentView.body.reason, 'no_enrollment');
  pass('student with no enrollment fails closed and ignores filters');

  /* ---------- permissions ---------- */
  const teacherWrite = await api('POST', '/school/timetable', { token: teacher1.token, body: createBody });
  assert.equal(teacherWrite.status, 403);
  const studentWrite = await api('POST', '/school/timetable', { token: studentUser.token, body: createBody });
  assert.equal(studentWrite.status, 403);
  const teacherSubWrite = await api('POST', '/school/substitutions', { token: teacher1.token, body: {} });
  assert.equal(teacherSubWrite.status, 403);
  pass('non-managers cannot author timetable or substitution records');

  /* Clone published version to a draft for modifications */
  const cloneVersionRes = await api('POST', `/school/timetable/versions/${draftVersionId}/clone`, {
    token: adminToken,
    body: { name: `${PREFIX} Draft v2`, effectiveFrom: '2090-07-01' },
  });
  assert.equal(cloneVersionRes.status, 200, cloneVersionRes.text);
  const draftVersion2Id = cloneVersionRes.body.version.id;
  fixtures.versions.push(draftVersion2Id);
  assert.equal(cloneVersionRes.body.version.status, 'draft');
  pass('published version can be cloned to a draft');

  /* Track cloned timetable entries for cleanup */
  const clonedEntries = await api('GET', `/school/timetable?versionId=${draftVersion2Id}`, { token: adminToken });
  if (clonedEntries?.body?.timetable) {
    for (const entry of clonedEntries.body.timetable) {
      fixtures.timetables.push(entry.id);
    }
  }

  /* ---------- timetable update derives from allocation ---------- */
  const updateEntryRes = await api('POST', '/school/timetable', {
    token: adminToken,
    body: {
      versionId: draftVersion2Id,
      classId: classA.id, sectionId: sectionA.id, allocationId: allocation1.id,
      roomId: roomB.id, dayOfWeek: 2, periodNo: 3, startTime: '11:00', endTime: '11:45',
    },
  });
  assert.equal(updateEntryRes.status, 200, updateEntryRes.text);
  const updateEntry = updateEntryRes.body.entry;
  fixtures.timetables.push(updateEntry.id);

  const updateRes = await api('PUT', `/school/timetable/${updateEntry.id}`, {
    token: adminToken,
    body: { versionId: draftVersion2Id, allocationId: allocation3.id, roomId: roomB.id },
  });
  assert.equal(updateRes.status, 200, updateRes.text);
  assert.equal(updateRes.body.entry.subject_id, subjectA.id);
  assert.equal(updateRes.body.entry.teacher_id, String(employee3.id));
  assert.equal(updateRes.body.entry.academic_year_id, year1.id);
  assert.equal(updateRes.body.entry.allocation_id, allocation3.id);
  pass('changing the allocation updates subject, teacher and academic year within same year');

  /* ---------- substitutions ---------- */
  const subDate = dateOnWeekday('2090-04-01', baseSlot.dayOfWeek);
  const publishB = await api('POST', '/school/timetable', {
    token: adminToken,
    body: {
      versionId: draftVersion2Id,
      classId: classB.id, sectionId: sectionB.id, allocationId: allocationB.id,
      roomId: roomB.id, ...baseSlot,
    },
  });
  assert.equal(publishB.status, 200, publishB.text);
  const entryB = publishB.body.entry;
  fixtures.timetables.push(entryB.id);
  /* Entry is already published via version */

  const unpublishedSub = await api('POST', '/school/substitutions', {
    token: adminToken,
    body: {
      timetableId: updateEntry.id, subDate: dateOnWeekday('2091-04-01', 2),
      substituteTeacherId: String(employee3.id),
    },
  });
  assert.equal(unpublishedSub.status, 409);
  assert.match(unpublishedSub.body.error, /publish/i);
  pass('substitution requires a published timetable occurrence');

  const wrongWeekday = new Date(`${subDate}T00:00:00Z`);
  wrongWeekday.setUTCDate(wrongWeekday.getUTCDate() + 1);
  const wrongWeekdayRes = await api('POST', '/school/substitutions', {
    token: adminToken,
    body: {
      timetableId: mainEntry.id, subDate: wrongWeekday.toISOString().slice(0, 10),
      substituteTeacherId: String(employee3.id),
    },
  });
  assert.equal(wrongWeekdayRes.status, 409);
  assert.match(wrongWeekdayRes.body.error, /weekday/i);
  pass('substitution rejects a date on the wrong weekday');

  const forgedOccurrence = await api('POST', '/school/substitutions', {
    token: adminToken,
    body: {
      timetableId: mainEntry.id, subDate,
      substituteTeacherId: String(employee3.id), classId: classB.id,
    },
  });
  assert.equal(forgedOccurrence.status, 400);
  assert.match(forgedOccurrence.body.error, /Class does not match/i);
  pass('substitution rejects forged class/section/subject/period values');

  const sameTeacher = await api('POST', '/school/substitutions', {
    token: adminToken,
    body: { timetableId: mainEntry.id, subDate, substituteTeacherId: String(employee1.id) },
  });
  assert.equal(sameTeacher.status, 400);

  const inactiveSubstitute = await api('POST', '/school/substitutions', {
    token: adminToken,
    body: { timetableId: mainEntry.id, subDate, substituteTeacherId: 'NOT_AN_ACTIVE_TEACHER' },
  });
  assert.equal(inactiveSubstitute.status, 400);
  pass('substitution validates the absent and substitute teachers');

  const unavailableSubstitute = await api('POST', '/school/substitutions', {
    token: adminToken,
    body: { timetableId: mainEntry.id, subDate, substituteTeacherId: String(employee2.id) },
  });
  assert.equal(unavailableSubstitute.status, 409);
  assert.match(unavailableSubstitute.body.error, /already has a class/i);
  pass('substitution rejects a substitute already teaching that slot');

  const createdSub = await api('POST', '/school/substitutions', {
    token: adminToken,
    body: { timetableId: mainEntry.id, subDate, substituteTeacherId: String(employee3.id) },
  });
  assert.equal(createdSub.status, 200, createdSub.text);
  const substitution = createdSub.body.substitution;
  fixtures.substitutions.push(substitution.id);
  assert.equal(substitution.class_id, classA.id);
  assert.equal(substitution.section_id, sectionA.id);
  assert.equal(substitution.subject_id, subjectA.id);
  assert.equal(substitution.period_no, baseSlot.periodNo);

  const duplicateSub = await api('POST', '/school/substitutions', {
    token: adminToken,
    body: { timetableId: mainEntry.id, subDate, substituteTeacherId: String(employee3.id) },
  });
  assert.equal(duplicateSub.status, 409);
  pass('substitution derives the occurrence and rejects duplicates');

  const absentTeacherSubs = await api('GET', '/school/substitutions', { token: teacher1.token });
  assert.equal(absentTeacherSubs.status, 200);
  assert.ok(absentTeacherSubs.body.substitutions.some((row) => row.id === substitution.id));
  const substituteTeacherSubs = await api('GET', '/school/substitutions', { token: teacher3.token });
  assert.ok(substituteTeacherSubs.body.substitutions.some((row) => row.id === substitution.id));
  const uninvolvedTeacherSubs = await api('GET', '/school/substitutions', { token: teacher2.token });
  assert.equal(uninvolvedTeacherSubs.body.substitutions.length, 0);
  const studentSubs = await api('GET', '/school/substitutions', { token: studentUser.token });
  assert.ok(studentSubs.body.substitutions.some((row) => row.id === substitution.id));
  pass('substitutions are visible only to the affected teacher, substitute and class');

  const deleteBlocked = await api('DELETE', `/school/timetable/${mainEntry.id}`, { token: adminToken });
  assert.equal(deleteBlocked.status, 409);
  assert.match(deleteBlocked.body.error, /active substitutions/i);
  pass('timetable deletion is blocked by live substitutions');

  const cancelled = await api('DELETE', `/school/substitutions/${substitution.id}`, { token: adminToken });
  assert.equal(cancelled.status, 200, cancelled.text);
  assert.equal(cancelled.body.substitution.status, 'cancelled');
  const cancelAgain = await api('DELETE', `/school/substitutions/${substitution.id}`, { token: adminToken });
  assert.equal(cancelAgain.status, 409);
  const history = await pool.query('SELECT status, sub_date FROM school_substitutions WHERE app_id=$1 AND id=$2',
    [APP_ID, substitution.id]);
  assert.equal(history.rows[0]?.status, 'cancelled');
  pass('cancelling a substitution preserves its history');

  const deleteMain = await api('DELETE', `/school/timetable/${mainEntry.id}`, { token: adminToken });
  assert.equal(deleteMain.status, 200, deleteMain.text);
  fixtures.timetables = fixtures.timetables.filter((id) => id !== mainEntry.id);
  const orphanHistory = await pool.query('SELECT status FROM school_substitutions WHERE app_id=$1 AND id=$2',
    [APP_ID, substitution.id]);
  assert.equal(orphanHistory.rows[0]?.status, 'cancelled');
  pass('deleting the timetable keeps cancelled substitution history');

  assert.ok(checks >= 25, `expected a meaningful suite, ran ${checks} checks`);
  console.log(`\nTimetable workflow tests passed (${checks} checks).`);
}

// Ensure cleanup runs on any exit
process.on('exit', () => { cleanup().catch(() => {}); });
process.on('SIGINT', () => { cleanup().then(() => process.exit(1)).catch(() => process.exit(1)); });
process.on('SIGTERM', () => { cleanup().then(() => process.exit(1)).catch(() => process.exit(1)); });
process.on('unhandledRejection', (reason) => { console.error('Unhandled rejection:', reason); cleanup().catch(() => {}); process.exit(1); });

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
