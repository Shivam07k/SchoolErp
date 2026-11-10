/* Full cross-module CRUD test â€” exercises every major school module.
   Run from server/: node tests\full_module_crud.test.mjs */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { getPool } from '../src/db/pool.js';

const SERVER_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 5000 + Math.floor(Math.random() * 300);
const BASE = `http://127.0.0.1:${PORT}`;
const APP = 'school_erp';
const STAMP = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const PREFIX = `QA_FULL_${STAMP}`;
const PASS = 'qa-full-pass';

const pool = getPool();
let activeYear = null, campusId = null, cl1 = null, secA = null, subj = null;
let adminToken = null, teacherToken = null, studentToken = null;
let server, checks = 0, log = '';

const ids = {
  users: [], staff: [], hrStaff: [], students: [], feeHeads: [], invoices: [], receipts: [],
  versions: [], timetableEntries: [], homework: [], submissions: [],
  attendance: [], leaves: [], exams: [], papers: [], components: [], sheets: [],
  templates: [], documents: [], invItems: [], libTitles: [], libCopies: [],
  libMembers: [], libLoans: [], commTemplates: [], hostels: [], hostelBlocks: [],
  vehicles: [], routes: [], stops: [], allocations: [], canteenItems: [],
  events: [], alumni: [], jobs: [], advances: [], visits: [], lmsCourses: [],
  groups: [], schoolUsers: [], dashSlugs: [], rooms: [],
};

function ok(msg) { checks++; console.log(`  ok ${checks} - ${msg}`); }
function eq(a, b, msg) { assert.equal(a, b, `${msg}: got ${a}, expected ${b}`); ok(msg); }

async function api(method, route, { token, body } = {}) {
  const res = await fetch(`${BASE}/api${route}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  return { status: res.status, body: json, text };
}

async function login(userid, password = PASS) {
  const r = await api('POST', '/auth/login', { body: { userid, password, company: APP } });
  eq(r.status, 200, `login ${userid}`);
  return r.body.token;
}

async function waitServer() {
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    try { if ((await fetch(`${BASE}/api/healthz`)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('server did not start');
}

async function makeUser(label, roleCode) {
  const userid = `${PREFIX}_${label}`;
  const hash = await bcrypt.hash(PASS, 4);
  await pool.query(`INSERT INTO "tblHO_User" ("UserId","UserName","PasswordHash","Designation","GRP","Status") VALUES ($1,$2,$3,$4,'','1')`, [userid, `${PREFIX} ${label}`, hash, label]);
  ids.users.push(userid);
  const { rows: [schoolUser] } = await pool.query(
    'INSERT INTO school_users (app_id, user_id, name) VALUES ($1,$2,$3) RETURNING id',
    [APP, userid, `${PREFIX} ${label}`]
  );
  ids.schoolUsers.push(schoolUser.id);
  const { rows: [role] } = await pool.query('SELECT id FROM school_roles WHERE app_id=$1 AND code=$2', [APP, roleCode]);
  assert.ok(role, `role ${roleCode} exists`);
  await pool.query('INSERT INTO school_user_roles (app_id, user_id, role_id) VALUES ($1,$2,$3)', [APP, userid, role.id]);
  return { userid, token: await login(userid) };
}

async function makeStaff(userid, label) {
  const { rows: [emp] } = await pool.query(
    `INSERT INTO school_hr_employees (app_id, employee_no, first_name, last_name, designation, status, user_id)
     VALUES ($1,$2,$3,'QA','Teacher','active',$4) RETURNING *`,
    [APP, `${PREFIX}_${label}`, `${PREFIX} ${label}`, userid]
  );
  const { rows: [row] } = await pool.query(
    `INSERT INTO school_staff (app_id, employee_code, name, contact_email, user_id, hr_employee_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [APP, `${PREFIX}_${label}`, `${PREFIX} ${label}`, `${label.toLowerCase()}@qa.test`, userid, emp.id]
  );
  ids.staff.push(emp.id);
  ids.hrStaff.push(row.id);
  return emp;
}

async function makeStudent(userid) {
  const { rows: [row] } = await pool.query(
    `INSERT INTO school_students (app_id, admission_no, first_name, last_name, class_id, section_id, status, user_id)
     SELECT $1,$2,$3,'QA',$4,$5,'active',u.id FROM school_users u
     WHERE u.app_id=$1 AND u.user_id=$6 RETURNING *`,
    [APP, `${PREFIX}_ADM_${userid.slice(-4)}`, `${PREFIX} Student`, cl1.id, secA.id, userid]
  );
  ids.students.push(row.id);
  return row;
}

async function preCleanup() {
  const q = (sql, params) => pool.query(sql, params).catch(() => {});
  // Rows created by previous test runs (prefix-scoped, safe for config data).
  await q('DELETE FROM school_user_roles WHERE app_id=$1 AND user_id LIKE $2', [APP, 'QA_FULL_%']);
  await q('DELETE FROM school_user_roles WHERE app_id=$1 AND user_id LIKE $2', [APP, 'crud_user_%']);
  await q('DELETE FROM "tblHO_User" WHERE "UserId" LIKE $1', ['crud_user_%']);
  await q('DELETE FROM "tblHO_User" WHERE "UserId" LIKE $1', ['QA_FULL_%']);
  await q('DELETE FROM school_staff WHERE app_id=$1 AND employee_code LIKE $2', [APP, 'QA_FULL_%']);
  await q('DELETE FROM school_hr_employees WHERE app_id=$1 AND employee_no LIKE $2', [APP, 'QA_FULL_%']);
  await q('DELETE FROM school_students WHERE app_id=$1 AND admission_no LIKE $2', [APP, 'QA_FULL_%']);
  await q('DELETE FROM school_users WHERE app_id=$1 AND user_id LIKE $2', [APP, 'QA_FULL_%']);
  // Purely operational tables: empty after the tenant reset, so a full clear is safe.
  const tables = [
    'school_mark_entry', 'school_marks_sheet', 'school_paper_component', 'school_exam_paper', 'school_exam',
    'school_generated_document', 'school_document_template',
    'school_homework_submissions', 'school_homework',
    'school_timetables', 'school_timetable_versions', 'school_subject_allocations',
    'school_attendance_entry', 'school_attendance_register', 'school_student_leave',
    'school_receipt_allocation', 'school_receipt', 'school_invoice_line', 'school_invoice',
    'school_inv_item', 'school_library_loan', 'school_library_copy', 'school_library_title', 'school_library_member',
    'school_communication_template', 'school_hostel_block', 'school_hostel',
    'school_trans_allocation', 'school_trans_trip', 'school_trans_stop', 'school_trans_route', 'school_trans_vehicle',
    'school_canteen_menu_item', 'school_event', 'school_job_posting', 'school_alumni_profile', 'school_alumni',
    'school_repayment_schedule', 'school_advance', 'school_frontoffice_visit', 'school_lms_course', 'school_rooms',
  ];
  for (const t of tables) {
    if (t === 'school_attendance_entry') {
      await q(`DELETE FROM ${t} WHERE register_id IN (SELECT id FROM school_attendance_register WHERE app_id=$1)`, [APP]);
    } else {
      await q(`DELETE FROM ${t} WHERE app_id=$1`, [APP]);
    }
  }
  await q("DELETE FROM school_fee_head WHERE app_id=$1 AND name LIKE 'CRUD %'", [APP]);
  await q("DELETE FROM school_groups WHERE app_id=$1 AND name LIKE 'CRUD %'", [APP]);
  await q("DELETE FROM school_users WHERE app_id=$1 AND user_id LIKE 'crud_user_%'", [APP]);
}

async function cleanup() {
  const q = (sql, params) => pool.query(sql, params).catch(() => {});
  // Explicit deletes for created fixtures (keeps config data untouched).
  await q('DELETE FROM school_mark_entry WHERE app_id=$1 AND sheet_id = ANY($2::int[])', [APP, ids.sheets]);
  await q('DELETE FROM school_marks_sheet WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.sheets]);
  await q('DELETE FROM school_paper_component WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.components]);
  await q('DELETE FROM school_exam_paper WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.papers]);
  await q('DELETE FROM school_exam WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.exams]);
  await q('DELETE FROM school_generated_document WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.documents]);
  await q('DELETE FROM school_document_template WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.templates]);
  await q('DELETE FROM school_homework_submissions WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.submissions]);
  await q('DELETE FROM school_homework WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.homework]);
  await q('DELETE FROM school_timetables WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.timetableEntries]);
  await q('DELETE FROM school_timetable_versions WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.versions]);
  await q('DELETE FROM school_attendance_entry WHERE register_id = ANY($1::int[])', [ids.attendance]);
  await q('DELETE FROM school_attendance_register WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.attendance]);
  await q('DELETE FROM school_student_leave WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.leaves]);
  await q('DELETE FROM school_receipt_allocation WHERE receipt_id = ANY($1::int[])', [ids.receipts]);
  await q('DELETE FROM school_receipt WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.receipts]);
  await q('DELETE FROM school_invoice_line WHERE invoice_id = ANY($1::int[])', [ids.invoices]);
  await q('DELETE FROM school_invoice WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.invoices]);
  await q('DELETE FROM school_fee_head WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.feeHeads]);
  await q('DELETE FROM school_inv_item WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.invItems]);
  await q('DELETE FROM school_library_loan WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.libLoans]);
  await q('DELETE FROM school_library_copy WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.libCopies]);
  await q('DELETE FROM school_library_title WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.libTitles]);
  await q('DELETE FROM school_library_member WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.libMembers]);
  await q('DELETE FROM school_communication_template WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.commTemplates]);
  await q('DELETE FROM school_hostel_block WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.hostelBlocks]);
  await q('DELETE FROM school_hostel WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.hostels]);
  await q('DELETE FROM school_trans_allocation WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.allocations]);
  await q('DELETE FROM school_trans_stop WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.stops]);
  await q('DELETE FROM school_trans_route WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.routes]);
  await q('DELETE FROM school_trans_vehicle WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.vehicles]);
  await q('DELETE FROM school_canteen_menu_item WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.canteenItems]);
  await q('DELETE FROM school_event WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.events]);
  await q('DELETE FROM school_job_posting WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.jobs]);
  await q('DELETE FROM school_alumni_profile WHERE alumni_id = ANY($1::int[])', [ids.alumni]);
  await q('DELETE FROM school_alumni WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.alumni]);
  await q('DELETE FROM school_advance WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.advances]);
  await q('DELETE FROM school_frontoffice_visit WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.visits]);
  await q('DELETE FROM school_lms_course WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.lmsCourses]);
  await q('DELETE FROM school_rooms WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.rooms]);
  await q('DELETE FROM school_groups WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.groups]);
  await q('DELETE FROM school_users WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.schoolUsers]);
  await q('DELETE FROM school_user_roles WHERE app_id=$1 AND user_id = ANY($2::text[])', [APP, ids.users]);
  await q('DELETE FROM "tblHO_User" WHERE "UserId" = ANY($1::text[])', [ids.users]);
  await q('DELETE FROM school_staff WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.hrStaff]);
  await q('DELETE FROM school_hr_employees WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.staff]);
  await q('DELETE FROM school_students WHERE app_id=$1 AND id = ANY($2::int[])', [APP, ids.students]);
}

async function main() {
  await preCleanup();
  server = spawn(process.execPath, ['src/index.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, PORT: String(PORT), CLUSTER_WORKERS: '1', RATE_LIMIT_MAX: '100000', LOGIN_RATE_LIMIT_MAX: '100000' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (c) => { log += c; });
  server.stderr.on('data', (c) => { log += c; });

  try {
    await waitServer();
    adminToken = await login('ADMIN', (process.env.ADMIN_PASSWORD || 'change-me-local'));

    /* ---------------- FOUNDATION ---------------- */
    const me = await api('GET', '/school/me', { token: adminToken });
    eq(me.status, 200, '/school/me');
    campusId = me.body.me?.campuses?.[0]?.id ?? me.body.me?.defaultCampusId;
    eq(!!campusId, true, 'campus id available');

    const years = await api('GET', '/school/academic-years', { token: adminToken });
    eq(years.status, 200, 'list academic years');
    activeYear = years.body.years?.find((y) => y.is_active) || years.body.years?.[0];
    assert.ok(activeYear, 'active academic year');

    const classes = await api('GET', '/school/classes', { token: adminToken });
    eq(classes.status, 200, 'list classes');
    cl1 = classes.body.classes?.find((c) => c.name === 'Class 1');
    assert.ok(cl1, 'Class 1 exists');

    const { rows: secRows } = await pool.query('SELECT id, name FROM school_sections WHERE app_id=$1 AND class_id=$2 AND is_active ORDER BY id LIMIT 1', [APP, cl1.id]);
    secA = secRows[0];
    assert.ok(secA, 'section A exists');

    const subjects = await api('GET', '/school/subjects', { token: adminToken });
    eq(subjects.status, 200, 'list subjects');
    subj = subjects.body.subjects?.find((s) => s.code === 'ENG');
    assert.ok(subj, 'English subject exists');

    const roomRes = await api('POST', '/school/rooms', { token: adminToken, body: { campusId, code: `TR_${STAMP}`, name: 'CRUD Room', capacity: 40 } });
    eq(roomRes.status, 200, 'create room');
    const room = roomRes.body.room;
    ids.rooms.push(room.id);

    const { rows: periodRows } = await pool.query('SELECT id FROM school_periods WHERE app_id=$1 AND campus_id=$2 AND is_active ORDER BY sort_order LIMIT 1', [APP, campusId]);
    const periodId = periodRows[0]?.id;
    assert.ok(periodId, 'period exists');

    /* ---------------- USERS & ROLES ---------------- */
    const teacher = await makeUser('T1', 'TEACHER');
    teacherToken = teacher.token;
    const studentUser = await makeUser('S1', 'STUDENT');
    studentToken = studentUser.token;
    await makeStaff(teacher.userid, 'T1');
    await makeStaff(studentUser.userid, 'S1');
    await makeStudent(studentUser.userid);

    /* ---------------- ACADEMICS ---------------- */
    const alloc = await api('POST', '/school/subject-allocations', {
      token: adminToken,
      body: { academic_year_id: activeYear.id, class_id: cl1.id, section_id: secA.id, subject_id: subj.id, teacher_id: ids.staff[0] },
    });
    eq(alloc.status, 200, 'create subject allocation');
    const allocId = alloc.body.allocation.id;

    const version = await api('POST', '/school/timetable/versions', {
      token: adminToken,
      body: { academic_year_id: activeYear.id, name: `CRUD Version ${STAMP}`, effective_from: '2026-05-01', effective_to: '2027-03-31', status: 'draft' },
    });
    eq(version.status, 200, 'create timetable version');
    ids.versions.push(version.body.version.id);

    const ttEntry = await api('POST', '/school/timetable', {
      token: adminToken,
      body: {
        version_id: ids.versions[0], allocation_id: allocId, day_of_week: 1, period_no: 1,
        period_id: periodId, class_id: cl1.id, section_id: secA.id, subject_id: subj.id,
        teacher_id: ids.staff[0], room_id: room.id, start_time: '08:00', end_time: '08:45',
      },
    });
    eq(ttEntry.status, 200, 'create timetable entry');
    ids.timetableEntries.push(ttEntry.body.entry.id);

    const ttList = await api('GET', `/school/timetable?version_id=${ids.versions[0]}`, { token: adminToken });
    eq(ttList.status, 200, 'list timetable entries');
    assert.ok(ttList.body.timetable?.length > 0, 'timetable entry visible');

    /* ---------------- HOMEWORK ---------------- */
    const hw = await api('POST', '/school/homework', {
      token: adminToken,
      body: { academic_year_id: activeYear.id, allocation_id: allocId, title: 'CRUD Homework', description: 'desc', assigned_date: '2026-11-01', due_date: '2026-11-05', max_marks: 10 },
    });
    eq(hw.status, 200, 'create homework');
    ids.homework.push(hw.body.homework.id);

    eq((await api('PUT', `/school/homework/${ids.homework[0]}`, { token: adminToken, body: { status: 'published' } })).status, 200, 'publish homework');
    eq((await api('GET', '/school/homework', { token: adminToken })).status, 200, 'list homework');

    const submit = await api('POST', `/school/homework/${ids.homework[0]}/submit`, { token: studentToken, body: { content_text: 'my answer' } });
    eq(submit.status, 200, 'student submits homework');
    ids.submissions.push(submit.body.submission.id);

    eq((await api('POST', `/school/homework/submissions/${ids.submissions[0]}/grade`, { token: adminToken, body: { marks: 8, feedback: 'good' } })).status, 200, 'teacher grades homework');
    eq((await api('DELETE', `/school/homework/${ids.homework[0]}`, { token: adminToken })).status, 409, 'delete homework blocked while submissions exist');

    /* ---------------- ATTENDANCE ---------------- */
    const { rows: availableAttendanceDates } = await pool.query(`
      SELECT days.date::date::text AS date
        FROM generate_series(CURRENT_DATE, CURRENT_DATE + interval '365 days', interval '1 day') AS days(date)
        JOIN school_academic_years ay ON ay.app_id=$1 AND ay.id=$3
                                  AND days.date::date BETWEEN ay.start_date AND ay.end_date
       WHERE NOT EXISTS (
               SELECT 1 FROM school_attendance_register r
                WHERE r.app_id=$1 AND r.academic_year_id=ay.id AND r.section_id=$2
                  AND r.register_date=days.date::date AND COALESCE(r.session_id,0)=0
             )
         AND NOT EXISTS (
               SELECT 1 FROM school_calendar_event e
                WHERE e.app_id=$1 AND e.event_date=days.date::date AND e.applies_to_all=true
                  AND e.event_type IN ('holiday','closure')
             )
       ORDER BY days.date
       LIMIT 1
    `, [APP, secA.id, activeYear.id]);
    assert.ok(availableAttendanceDates[0], 'available instructional attendance date');
    const register = await api('POST', '/school/attendance/registers', {
      token: adminToken,
      body: { date: availableAttendanceDates[0].date, sectionId: secA.id },
    });
    eq(register.status, 200, 'create attendance register');
    ids.attendance.push(register.body.register.id);

    const attEntry = await api('POST', `/school/attendance/registers/${ids.attendance[0]}/entries`, {
      token: adminToken,
      body: { entries: [{ student_id: ids.students[0], statusCode: 'P' }] },
    });
    eq(attEntry.status, 200, 'save attendance entry');
    eq((await api('GET', '/school/attendance/registers', { token: adminToken })).status, 200, 'list attendance registers');

    const leave = await api('POST', '/school/attendance/student-leave', {
      token: adminToken,
      body: { studentId: ids.students[0], startDate: '2026-11-10', endDate: '2026-11-11', reason: 'sick', leaveType: 'medical' },
    });
    eq(leave.status, 200, 'create student leave');
    ids.leaves.push(leave.body.leave.id);
    eq((await api('GET', '/school/attendance/student-leave', { token: adminToken })).status, 200, 'list student leave');

    /* ---------------- FEES ---------------- */
    const feeHead = await api('POST', '/school/fee/heads', { token: adminToken, body: { name: 'CRUD Tuition', type: 'tuition', description: 'Monthly' } });
    eq(feeHead.status, 200, 'create fee head');
    ids.feeHeads.push(feeHead.body.head.id);

    const invoice = await api('POST', '/school/fee/invoices', {
      token: adminToken,
      body: { studentId: ids.students[0], amount: 5000, dueDate: '2026-12-01', date: '2026-11-01', headId: ids.feeHeads[0] },
    });
    eq(invoice.status, 200, 'create fee invoice');
    ids.invoices.push(invoice.body.invoice.id);

    const receipt = await api('POST', '/school/fee/receipts', {
      token: adminToken,
      body: { invoiceId: ids.invoices[0], amount: 5000, date: '2026-11-15', mode: 'cash' },
    });
    eq(receipt.status, 200, 'create fee receipt');
    ids.receipts.push(receipt.body.receipt.id);
    eq((await api('GET', '/school/fee/collection', { token: adminToken })).status, 200, 'list fee collection');

    /* ---------------- EXAMS: full marks lifecycle ---------------- */
    const exam = await api('POST', '/school/exams', {
      token: adminToken,
      body: { name: 'CRUD Midterm', type: 'unit_test', startDate: '2026-12-01', endDate: '2026-12-10' },
    });
    eq(exam.status, 200, 'create exam');
    const examId = exam.body.exam.id;
    ids.exams.push(examId);

    const paper = await api('POST', '/school/papers', { token: adminToken, body: { examId, classId: cl1.id, subjectId: subj.id, maxMarks: 80, passMarks: 32 } });
    eq(paper.status, 200, 'create exam paper');
    const paperId = paper.body.paper.id;
    ids.papers.push(paperId);

    const component = await api('POST', `/school/exam/papers/${paperId}/components`, { token: adminToken, body: { name: 'Theory', maxMarks: 80, passMinimum: 32 } });
    eq(component.status, 200, 'create paper component');
    ids.components.push(component.body.component.id);

    const ensure = await api('POST', '/school/marks-sheets/ensure', { token: adminToken, body: { examId } });
    eq(ensure.status, 200, 'ensure marks sheets');

    const sheets = await api('GET', `/school/marks-sheets?examId=${examId}`, { token: adminToken });
    eq(sheets.status, 200, 'list marks sheets');
    const sheet = sheets.body.marksSheets?.find((row) => Number(row.section_id) === Number(secA.id));
    const sheetId = sheet?.id;
    assert.ok(sheetId, 'marks sheet generated');
    ids.sheets.push(sheetId);

    const sheetGrid = await api('GET', `/school/marks-sheets/${sheetId}`, { token: adminToken });
    eq(sheetGrid.status, 200, 'load marks sheet grid');
    assert.ok(sheetGrid.body.grid.some((row) => Number(row.student.id) === Number(ids.students[0])), 'marks grid includes enrolled student');
    const entries = sheetGrid.body.grid.flatMap((row) => row.components.map((cell) => ({
      studentId: row.student.id,
      componentId: cell.component.id,
      marks: 70,
    })));
    const entry = await api('POST', `/school/marks-sheets/${sheetId}/entries`, {
      token: adminToken,
      body: { entries },
    });
    eq(entry.status, 200, `enter marks ${JSON.stringify(entry.body)}`);

    eq((await api('POST', `/school/marks-sheets/${sheetId}/submit`, { token: adminToken })).status, 200, 'submit marks sheet');
    eq((await api('POST', `/school/marks-sheets/${sheetId}/verify`, { token: adminToken })).status, 200, 'verify marks sheet');
    eq((await api('POST', `/school/marks-sheets/${sheetId}/lock`, { token: adminToken })).status, 200, 'lock marks sheet');
    eq((await api('POST', `/school/marks-sheets/${sheetId}/reopen`, { token: adminToken, body: { reason: 'CRUD correction' } })).status, 200, 'reopen marks sheet');
    eq((await api('GET', '/school/exams', { token: adminToken })).status, 200, 'list exams');

    /* ---------------- CERTIFICATES ---------------- */
    const template = await api('POST', '/school/certificates/templates', { token: adminToken, body: { name: 'CRUD Bonafide', type: 'bonafide' } });
    eq(template.status, 200, 'create certificate template');
    ids.templates.push(template.body.template.id);

    const doc = await api('POST', '/school/certificates/generate', { token: adminToken, body: { templateId: ids.templates[0], studentId: ids.students[0] } });
    eq(doc.status, 200, 'generate certificate');
    ids.documents.push(doc.body.document.id);
    eq((await api('GET', '/school/certificates/generated', { token: adminToken })).status, 200, 'list generated certificates');

    /* ---------------- INVENTORY ---------------- */
    const item = await api('POST', '/school/inventory/items', { token: adminToken, body: { code: `CRUD_IT_${STAMP}`, name: 'CRUD Item', unit: 'pcs', trackingType: 'serial', reorderLevel: 10 } });
    eq(item.status, 200, 'create inventory item');
    ids.invItems.push(item.body.item.id);
    eq((await api('GET', '/school/inventory/items', { token: adminToken })).status, 200, 'list inventory items');

    /* ---------------- LIBRARY ---------------- */
    const title = await api('POST', '/school/library/titles', { token: adminToken, body: { title: `CRUD Book ${STAMP}`, author: 'Tester', isbn: `978-${STAMP.slice(-10)}`, publisher: 'Test Pub', publishedYear: 2026 } });
    eq(title.status, 200, 'create library title');
    ids.libTitles.push(title.body.title.id);

    const copy = await api('POST', '/school/library/copies', { token: adminToken, body: { titleId: ids.libTitles[0], copyNo: `C_${STAMP}`, barcode: `BC_${STAMP}` } });
    eq(copy.status, 200, 'create library copy');
    ids.libCopies.push(copy.body.copy.id);

    const member = await api('POST', '/school/library/members', { token: adminToken, body: { memberType: 'student', personId: ids.students[0] } });
    eq(member.status, 200, 'create library member');
    ids.libMembers.push(member.body.member.id);

    const loan = await api('POST', '/school/library/loans/issue', { token: adminToken, body: { copyId: ids.libCopies[0], memberId: ids.libMembers[0], dueDays: 14 } });
    eq(loan.status, 200, 'issue library loan');
    ids.libLoans.push(loan.body.loan.id);
    eq((await api('GET', '/school/library/loans', { token: adminToken })).status, 200, 'list library loans');
    eq((await api('POST', '/school/library/loans/return', { token: adminToken, body: { loanId: ids.libLoans[0] } })).status, 200, 'return library loan');

    /* ---------------- COMMUNICATION ---------------- */
    const comm = await api('POST', '/school/communication/templates', { token: adminToken, body: { name: 'CRUD SMS', channel: 'sms', subject: 'Hello', bodyText: 'Hi {{name}}' } });
    eq(comm.status, 200, 'create communication template');
    ids.commTemplates.push(comm.body.template.id);
    eq((await api('GET', '/school/communication/templates', { token: adminToken })).status, 200, 'list communication templates');

    /* ---------------- HOSTEL ---------------- */
    const hostel = await api('POST', '/school/hostel/hostels', { token: adminToken, body: { name: `CRUD Hostel ${STAMP}`, type: 'boys' } });
    eq(hostel.status, 200, 'create hostel');
    ids.hostels.push(hostel.body.hostel.id);

    const block = await api('POST', '/school/hostel/blocks', { token: adminToken, body: { hostelId: ids.hostels[0], name: 'CRUD Block' } });
    eq(block.status, 200, 'create hostel block');
    ids.hostelBlocks.push(block.body.block.id);
    eq((await api('GET', '/school/hostel/blocks', { token: adminToken })).status, 200, 'list hostel blocks');

    /* ---------------- TRANSPORT ---------------- */
    const vehicle = await api('POST', '/school/transport/vehicles', { token: adminToken, body: { regNo: `CRUD-${STAMP}`, type: 'bus', capacity: 40 } });
    eq(vehicle.status, 200, 'create transport vehicle');
    ids.vehicles.push(vehicle.body.vehicle.id);

    const route = await api('POST', '/school/transport/routes', { token: adminToken, body: { code: `R_${STAMP}`, name: 'CRUD Route' } });
    eq(route.status, 200, 'create transport route');
    ids.routes.push(route.body.route.id);

    const stop = await api('POST', '/school/transport/stops', { token: adminToken, body: { name: 'CRUD Stop' } });
    eq(stop.status, 200, 'create transport stop');
    ids.stops.push(stop.body.stop.id);

    const allocation = await api('POST', '/school/transport/allocations', { token: adminToken, body: { studentId: ids.students[0], routeId: ids.routes[0], pickStopId: ids.stops[0], dropStopId: ids.stops[0] } });
    eq(allocation.status, 200, 'create transport allocation');
    ids.allocations.push(allocation.body.allocation.id);
    eq((await api('GET', '/school/transport/allocations', { token: adminToken })).status, 200, 'list transport allocations');

    /* ---------------- CANTEEN ---------------- */
    const menuItem = await api('POST', '/school/canteen/menu-items', { token: adminToken, body: { name: 'CRUD Sandwich', category: 'snacks', price: 50 } });
    eq(menuItem.status, 200, 'create canteen menu item');
    ids.canteenItems.push(menuItem.body.item.id);
    eq((await api('GET', '/school/canteen/menu-items', { token: adminToken })).status, 200, 'list canteen menu items');

    /* ---------------- EVENTS ---------------- */
    const event = await api('POST', '/school/events', { token: adminToken, body: { title: 'CRUD Event', startDt: '2026-12-25T09:00:00', category: 'celebration' } });
    eq(event.status, 200, 'create event');
    ids.events.push(event.body.event.id);
    eq((await api('PUT', `/school/events/${ids.events[0]}/status`, { token: adminToken, body: { status: 'published' } })).status, 200, 'publish event');
    eq((await api('GET', '/school/events', { token: adminToken })).status, 200, 'list events');

    /* ---------------- ALUMNI ---------------- */
    const alumni = await api('POST', '/school/alumni/register', { token: adminToken, body: { studentId: ids.students[0], passingYear: 2026 } });
    eq(alumni.status, 200, 'register alumni');
    ids.alumni.push(alumni.body.alumni.id);

    const job = await api('POST', '/school/alumni/jobs', { token: adminToken, body: { company: 'CRUD Corp', title: 'Engineer' } });
    eq(job.status, 200, 'create alumni job');
    ids.jobs.push(job.body.job.id);
    eq((await api('GET', '/school/alumni/directory', { token: adminToken })).status, 200, 'list alumni directory');

    /* ---------------- HR ADVANCES ---------------- */
    const advance = await api('POST', '/school/hr/advances', { token: adminToken, body: { staff_id: ids.hrStaff[0], type: 'salary_advance', amount: 5000, installments: 5, reason: 'CRUD advance' } });
    eq(advance.status, 200, 'create salary advance');
    ids.advances.push(advance.body.advance.id);
    eq((await api('GET', '/school/hr/advances', { token: adminToken })).status, 200, 'list salary advances');

    /* ---------------- FRONT OFFICE ---------------- */
    const visit = await api('POST', '/school/frontoffice/visits', { token: adminToken, body: { purpose: 'meeting', hostUser: 'Principal' } });
    eq(visit.status, 200, 'create front-office visit');
    ids.visits.push(visit.body.visit.id);
    eq((await api('POST', `/school/frontoffice/visits/${ids.visits[0]}/check-in`, { token: adminToken })).status, 200, 'check in visit');
    eq((await api('POST', `/school/frontoffice/visits/${ids.visits[0]}/check-out`, { token: adminToken })).status, 200, 'check out visit');
    eq((await api('GET', '/school/frontoffice/visits', { token: adminToken })).status, 200, 'list front-office visits');

    /* ---------------- LMS ---------------- */
    const course = await api('POST', '/school/lms/courses', { token: adminToken, body: { title: 'CRUD Course', description: 'Test', subjectId: subj.id, classId: cl1.id, sectionId: secA.id } });
    eq(course.status, 200, 'create LMS course');
    ids.lmsCourses.push(course.body.course.id);
    eq((await api('GET', '/school/lms/courses', { token: adminToken })).status, 200, 'list LMS courses');

    /* ---------------- DASHBOARD ---------------- */
    eq((await api('GET', '/dash/bootstrap', { token: adminToken })).status, 200, 'dashboard bootstrap');
    const pageSlug = `crud_${STAMP}`.slice(0, 60);
    eq((await api('POST', '/dash/page/save', { token: adminToken, body: { slug: pageSlug, title: 'CRUD Page', kind: 'page', isHome: false, layout: {}, style: {}, sort: 1 } })).status, 200, 'save dashboard page');
    ids.dashSlugs.push(pageSlug);
    eq((await api('DELETE', `/dash/page/${pageSlug}`, { token: adminToken })).status, 200, 'delete dashboard page');

    /* ---------------- SETTINGS / ACCESS ---------------- */
    const group = await api('POST', '/school/groups', { token: adminToken, body: { name: 'CRUD Group', description: 'test' } });
    eq(group.status, 200, 'create group');
    ids.groups.push(group.body.group.id);
    eq((await api('GET', '/school/groups', { token: adminToken })).status, 200, 'list groups');

    const settingsUserId = `crud_user_${STAMP}`;
    ids.users.push(settingsUserId);
    const { rows: [studentRole] } = await pool.query(
      'SELECT id FROM school_roles WHERE app_id=$1 AND code=$2',
      [APP, 'STUDENT']
    );
    assert.ok(studentRole, 'student role exists');
    const user = await api('POST', '/school/users', {
      token: adminToken,
      body: { user_id: settingsUserId, name: 'CRUD User', email: 'crud@test.com', password: PASS, status: 'active', groups: [group.body.group.id], roles: [studentRole.id] },
    });
    eq(user.status, 200, 'create settings user');
    assert.equal(Object.hasOwn(user.body.user, 'password_hash'), false, 'user response does not expose password hash');
    ids.schoolUsers.push(user.body.user.id);
    const groupLinks = await api('GET', `/school/users/${user.body.user.id}/groups`, { token: adminToken });
    eq(groupLinks.status, 200, 'list user group assignments');
    eq(groupLinks.body.groups?.[0]?.group_id, group.body.group.id, 'created user linked to selected group');
    const userList = await api('GET', '/school/users', { token: adminToken });
    eq(userList.status, 200, 'list settings users');
    const listedUser = userList.body.users?.find((row) => row.id === user.body.user.id);
    assert.ok(listedUser?.group_ids?.includes(group.body.group.id), 'user list includes group linkage');
    assert.ok(listedUser?.role_ids?.includes(studentRole.id), 'user list includes role linkage');
    assert.equal(Object.hasOwn(listedUser, 'password_hash'), false, 'user list does not expose password hash');

    const secondGroup = await api('POST', '/school/groups', { token: adminToken, body: { name: 'CRUD Secondary Group' } });
    eq(secondGroup.status, 200, 'create second group for user edit');
    ids.groups.push(secondGroup.body.group.id);
    eq((await api('PUT', `/school/users/${user.body.user.id}`, {
      token: adminToken,
      body: { name: 'Updated CRUD User', groups: [group.body.group.id, secondGroup.body.group.id], roles: [studentRole.id], password: `${PASS}-updated` },
    })).status, 200, 'update user details, password, roles and groups');
    const editedGroups = await api('GET', `/school/users/${user.body.user.id}/groups`, { token: adminToken });
    eq(editedGroups.body.groups.length, 2, 'multiple group assignments saved on edit');
    eq((await api('PUT', `/school/users/${user.body.user.id}`, {
      token: adminToken,
      body: { groups: [999999999], roles: [] },
    })).status, 400, 'reject unavailable group without partial update');
    eq((await api('GET', `/school/users/${user.body.user.id}/groups`, { token: adminToken })).body.groups.length, 2, 'invalid group update preserves prior assignments');
    eq((await api('PUT', `/school/users/${user.body.user.id}`, { token: adminToken, body: { groups: [], roles: [] } })).status, 200, 'remove user group and role assignments');
    eq((await api('GET', `/school/users/${user.body.user.id}/groups`, { token: adminToken })).body.groups.length, 0, 'user group removal persisted');
    eq((await api('POST', '/auth/login', { body: { userid: settingsUserId, password: PASS, company: APP } })).status, 401, 'old password rejected after password change');
    await login(settingsUserId, `${PASS}-updated`);
    eq((await api('PUT', `/school/users/${user.body.user.id}`, { token: adminToken, body: { status: 'inactive' } })).status, 200, 'deactivate settings user');
    eq((await api('POST', '/auth/login', { body: { userid: settingsUserId, password: `${PASS}-updated`, company: APP } })).status, 401, 'inactive account cannot login');
    eq((await api('PUT', `/school/users/${user.body.user.id}`, { token: adminToken, body: { status: 'active' } })).status, 200, 'reactivate settings user');
    await login(settingsUserId, `${PASS}-updated`);
    eq((await api('DELETE', `/school/users/${user.body.user.id}`, { token: adminToken })).status, 200, 'delete settings user');
    const deletedLogin = await pool.query('SELECT 1 FROM "tblHO_User" WHERE "UserId"=$1', [settingsUserId]);
    eq(deletedLogin.rowCount, 0, 'delete removes linked login account');

    eq((await api('GET', '/school/roles', { token: adminToken })).status, 200, 'list roles');
    eq((await api('GET', '/school/audit', { token: adminToken })).status, 200, 'read audit log');

    /* ---------------- SERVER STILL HEALTHY ---------------- */
    eq((await api('GET', '/healthz')).status, 200, 'server healthy after all modules');

    console.log(`\n=== ALL ${checks} CHECKS PASSED ===`);
  } catch (e) {
    console.error('\nFAILED:', e.message);
    console.error(log.slice(-4000));
    process.exitCode = 1;
  } finally {
    await cleanup();
    server.kill();
    await pool.end();
  }
}

main();
