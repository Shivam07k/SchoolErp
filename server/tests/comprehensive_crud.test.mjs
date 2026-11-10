/* Comprehensive cross-module CRUD smoke test.
   Run: node tests\comprehensive_crud.test.mjs
   Creates fixtures, exercises create/read/update/delete across modules,
   validates cross-module links, then tears down. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { getPool } from '../src/db/pool.js';

const SERVER_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 3900 + Math.floor(Math.random() * 300);
const BASE = `http://127.0.0.1:${PORT}`;
const APP = 'school_erp';
const STAMP = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const PREFIX = `QA_CRUD_${STAMP}`;
const PASS = 'qa-crud-pass';

const pool = getPool();
const fx = {
  users: [], staff: [], students: [], guardians: [],
  schoolUsers: [],
  years: [], classes: [], sections: [], subjects: [], rooms: [],
  feeHeads: [], invoices: [], receipts: [],
  timetables: [], homework: [], marks: [], exams: [], papers: [], sheets: [], components: [], markEntries: [],
  leave: [], attendance: [],
  certificates: [], certificateTemplates: [], inventory: [], hostels: [], hostelBlocks: [], vehicles: [], events: [], alumni: [], salaryComponents: [], advances: [], schoolStaff: [], lmsCourses: [],
};
let originalActiveYear = null;
let server, adminToken, teacherToken, studentToken;

let checks = 0;
function ok(msg) { checks++; console.log(`  ok ${checks} - ${msg}`); }
function eq(a, b, msg) { assert.equal(a, b, `${msg}: got ${a}, expected ${b}`); ok(msg); }

async function api(method, route, { token, body, query } = {}) {
  const url = new URL(`${BASE}/api${route}`);
  if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.append(k, String(v)));
  const res = await fetch(url, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { }
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
    try { if ((await fetch(`${BASE}/api/healthz`)).ok) return; } catch { }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('server did not start');
}

async function makeUser(label, roleCode) {
  const userid = `${PREFIX}_${label}`;
  const hash = await bcrypt.hash(PASS, 4);
  await pool.query(`INSERT INTO "tblHO_User" ("UserId","UserName","PasswordHash","Designation","GRP","Status") VALUES ($1,$2,$3,$4,'','1')`,
    [userid, `${PREFIX} ${label}`, hash, label]);
  fx.users.push(userid);
  const { rows: [schoolUser] } = await pool.query(
    'INSERT INTO school_users (app_id, user_id, name) VALUES ($1,$2,$3) RETURNING id',
    [APP, userid, `${PREFIX} ${label}`],
  );
  fx.schoolUsers.push(schoolUser.id);
  const { rows: [role] } = await pool.query('SELECT id FROM school_roles WHERE app_id=$1 AND code=$2', [APP, roleCode]);
  assert.ok(role, `role ${roleCode} seeded`);
  await pool.query('INSERT INTO school_user_roles (app_id, user_id, role_id) VALUES ($1,$2,$3)', [APP, userid, role.id]);
  return { userid, token: await login(userid) };
}

async function makeStaff(userid, label) {
  const { rows: [row] } = await pool.query(
    `INSERT INTO school_hr_employees (app_id, employee_no, first_name, last_name, designation, status, user_id)
     VALUES ($1,$2,$3,'QA','Teacher','active',$4) RETURNING *`,
    [APP, `${PREFIX}_${label}`, `${PREFIX} ${label}`, userid]);
  fx.staff.push(row.id);
  return row;
}

async function makeStudent(userid, classId, sectionId) {
  const { rows: [row] } = await pool.query(
    `INSERT INTO school_students (app_id, admission_no, first_name, last_name, class_id, section_id, status, user_id)
     VALUES ($1,$2,$3,'QA',$4,$5,'active',$6) RETURNING *`,
    [APP, `${PREFIX}_ADM_${userid.slice(-4)}`, `${PREFIX} Student`, classId, sectionId, userid]);
  fx.students.push(row.id);
  return row;
}

async function cleanup() {
  const q = (sql, params) => pool.query(sql, params).catch(() => {});
  await q('DELETE FROM school_mark_entry WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.markEntries]);
  await q('DELETE FROM school_marks_sheet WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.sheets]);
  await q('DELETE FROM school_paper_component WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.components]);
  await q('DELETE FROM school_exam_paper WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.papers]);
  await q('DELETE FROM school_homework_submissions WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.marks]);
  await q('DELETE FROM school_homework WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.homework]);
  await q('DELETE FROM school_exam WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.exams]);
  await q('DELETE FROM school_timetable_versions WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.timetables]);
  await q('DELETE FROM school_fee_invoices WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.invoices]);
  await q('DELETE FROM school_fee_receipts WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.receipts]);
  await q('DELETE FROM school_attendance_entry WHERE app_id=$1 AND register_id IN (SELECT id FROM school_attendance_register WHERE app_id=$1)', [APP]);
  await q('DELETE FROM school_attendance_register WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.attendance]);
  await q('DELETE FROM school_student_leave WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.leave]);
  await q('DELETE FROM school_generated_document WHERE app_id=$1 AND student_id = ANY($2::int[])', [APP, fx.students]);
  await q('DELETE FROM school_certificate_register WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.certificates]);
  await q('DELETE FROM school_document_template WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.certificateTemplates]);
  await q('DELETE FROM school_hostel_block WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.hostelBlocks]);
  await q('DELETE FROM school_hostel WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.hostels]);
  await q('DELETE FROM school_trans_vehicle WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.vehicles]);
  await q('DELETE FROM school_event WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.events]);
  await q('DELETE FROM school_alumni WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.alumni]);
  await q('DELETE FROM school_salary_component WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.salaryComponents]);
  await q('DELETE FROM school_advance WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.advances]);
  await q('DELETE FROM school_staff WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.schoolStaff]);
  await q('DELETE FROM school_lms_course WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.lmsCourses]);
  await q('DELETE FROM school_inv_item WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.inventory]);
  await q('DELETE FROM school_students WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.students]);
  await q('DELETE FROM school_guardians WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.guardians]);
  await q('DELETE FROM school_sections WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.sections]);
  await q('DELETE FROM school_classes WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.classes]);
  await q('DELETE FROM school_subjects WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.subjects]);
  await q('DELETE FROM school_rooms WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.rooms]);
  await q('DELETE FROM school_hr_employees WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.staff]);
  await q('DELETE FROM school_user_roles WHERE app_id=$1 AND user_id = ANY($2::text[])', [APP, fx.users]);
  await q('DELETE FROM school_users WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.schoolUsers]);
  await q('DELETE FROM "tblHO_User" WHERE "UserId" = ANY($1::text[])', [fx.users]);
  if (originalActiveYear) {
    await q('UPDATE school_academic_years SET is_active=false WHERE app_id=$1 AND id = ANY($2::int[])', [APP, fx.years]);
    await q('UPDATE school_academic_years SET is_active=true WHERE app_id=$1 AND id=$2', [APP, originalActiveYear]);
  }
}

async function main() {
  server = spawn(process.execPath, ['src/index.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, PORT: String(PORT), CLUSTER_WORKERS: '1', RATE_LIMIT_MAX: '100000', LOGIN_RATE_LIMIT_MAX: '100000' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = ''; server.stdout.on('data', c => log += c); server.stderr.on('data', c => log += c);

  try {
    await waitServer();
    adminToken = await login('ADMIN', (process.env.ADMIN_PASSWORD || 'change-me-local'));
    eq(adminToken?.length > 0, true, 'admin token');

    /* ---- FOUNDATION FIXTURES ---- */
    const me = await api('GET', '/school/me', { token: adminToken });
    eq(me.status, 200, '/school/me');
    const campusId = me.body.me?.campuses?.[0]?.id ?? me.body.me?.defaultCampusId;
    eq(!!campusId, true, 'campusId from /school/me');

    const years = await api('GET', '/school/academic-years', { token: adminToken });
    eq(years.status, 200, 'academic-years list');
    const activeYear = years.body.years?.find(y => y.is_active) || years.body.years?.[0];
    eq(!!activeYear, true, 'active year exists');
    originalActiveYear = activeYear.id;

    const sections = await api('GET', '/school/classes', { token: adminToken });
    eq(sections.status, 200, 'classes list');
    const cl1 = sections.body.classes?.find(c => c.name === 'Class 1');
    assert.ok(cl1, 'Class 1 seeded');

    // Sections are created via POST, not listed via GET. Use DB query for seeded sections.
    const { rows: secRows } = await pool.query(
      `SELECT id, name FROM school_sections WHERE app_id=$1 AND class_id=$2 AND is_active ORDER BY id LIMIT 1`,
      [APP, cl1.id]
    );
    assert.ok(secRows[0], 'Section A exists');
    const secA = secRows[0];

    const subjects = await api('GET', '/school/subjects', { token: adminToken });
    eq(subjects.status, 200, 'subjects list');
    const subj = subjects.body.subjects?.find(s => s.code === 'ENG');
    assert.ok(subj, 'subject ENG seeded');

    const rooms = await api('GET', '/school/rooms', { token: adminToken });
    eq(rooms.status, 200, 'rooms list');
    // No seeded rooms - create one via API
    const roomCreate = await api('POST', '/school/rooms', {
      token: adminToken,
      body: { code: `TR1_${STAMP}`, name: 'Test Room', capacity: 40, campus_id: campusId }
    });
    eq(roomCreate.status, 200, 'create room');
    const room = roomCreate.body.room;

    /* ---- USERS ---- */
    const t1 = await makeUser('T1', 'TEACHER');
    teacherToken = t1.token;
    const s1 = await makeUser('S1', 'STUDENT');
    studentToken = s1.token;
    await makeStaff(t1.userid, 'T1');
    await makeStaff(s1.userid, 'S1');

    const stu = await makeStudent(s1.userid, cl1.id, secA.id);
    fx.students.push(stu.id);

    /* ---- TEACHER -> SUBJECT ALLOCATION ---- */
    const allocR = await api('POST', '/school/subject-allocations', {
      token: adminToken,
      body: { academic_year_id: activeYear.id, class_id: cl1.id, section_id: secA.id, subject_id: subj.id, teacher_id: fx.staff[0] }
    });
    eq(allocR.status, 200, 'create subject allocation');
    const allocId = allocR.body.allocation.id;

    /* ---- TIMETABLE (via school_more.js) ---- */
    const effectiveDate = new Date(Date.UTC(2026, 3, 1 + (Number(STAMP.slice(-6)) % 330)));
    const effFrom = effectiveDate.toISOString().slice(0, 10);
    const ttDraft = await api('POST', '/school/timetable/versions', {
      token: adminToken,
      body: { academic_year_id: activeYear.id, name: `CRUD Draft ${STAMP}`, effective_from: effFrom, effective_to: '2027-03-31', status: 'draft' }
    });
    eq(ttDraft.status, 200, 'create timetable draft');
    fx.timetables.push(ttDraft.body.version.id);

    const entry = await api('POST', '/school/timetable', {
      token: adminToken,
      body: { version_id: fx.timetables[0], day_of_week: 1, period_no: 1, period_id: 99, class_id: cl1.id, section_id: secA.id, subject_id: subj.id, teacher_id: fx.staff[0], room_id: room.id, allocation_id: allocId, start_time: '08:00', end_time: '08:45' }
    });
    console.log('timetable entry response:', entry.status, JSON.stringify(entry.body));
    eq(entry.status, 200, 'create timetable entry');

    /* ---- HOMEWORK ---- */
    const hw = await api('POST', '/school/homework', {
      token: teacherToken,
      body: { academic_year_id: activeYear.id, allocation_id: allocId, title: 'CRUD HW', description: 'desc', assigned_date: '2026-11-01', due_date: '2026-11-05', max_marks: 10 }
    });
    eq(hw.status, 200, 'create homework');
    fx.homework.push(hw.body.homework.id);

    const hwPub = await api('PUT', `/school/homework/${fx.homework[0]}`, {
      token: teacherToken,
      body: { status: 'published' }
    });
    eq(hwPub.status, 200, 'publish homework');

    /* ---- STUDENT SUBMITS ---- */
    const submit = await api('POST', `/school/homework/${fx.homework[0]}/submit`, {
      token: studentToken,
      body: { content_text: 'my answer' }
    });
    eq(submit.status, 200, 'student submit');
    fx.marks.push(submit.body.submission.id);

    /* ---- TEACHER GRADES ---- */
    const grade = await api('POST', `/school/homework/submissions/${fx.marks[0]}/grade`, {
      token: teacherToken,
      body: { marks: 8, feedback: 'good' }
    });
    eq(grade.status, 200, 'teacher grade');

    /* ---- ATTENDANCE REGISTER ---- */
    const reg = await api('POST', '/school/attendance/registers', {
      token: adminToken,
      body: { date: '2026-11-01', sectionId: secA.id }
    });
    eq(reg.status, 200, 'create attendance register');
    fx.attendance.push(reg.body.register.id);

    const attEntry = await api('POST', `/school/attendance/registers/${fx.attendance[0]}/entries`, {
      token: adminToken,
      body: { entries: [{ student_id: fx.students[0], statusCode: 'P' }] }
    });
    console.log('attendance entry response:', attEntry.status, JSON.stringify(attEntry.body));
    eq(attEntry.status, 200, 'create attendance entry');

    /* ---- STUDENT LEAVE ---- */
    const leave = await api('POST', '/school/attendance/student-leave', {
      token: adminToken,
      body: { studentId: fx.students[0], startDate: '2026-11-10', endDate: '2026-11-11', reason: 'sick', leaveType: 'medical' }
    });
    console.log('student leave response:', leave.status, JSON.stringify(leave.body));
    eq(leave.status, 200, 'create student leave');
    fx.leave.push(leave.body.leave.id);

    /* ---- FEES (via school_fee.js) ---- */
    const feeHead = await api('POST', '/school/fee/heads', {
      token: adminToken,
      body: { name: 'CRUD Tuition', type: 'tuition', description: 'Monthly', isRecurring: true, frequency: 'monthly' }
    });
    eq(feeHead.status, 200, 'create fee head');
    fx.feeHeads.push(feeHead.body.head.id);

    const invoice = await api('POST', '/school/fee/invoices', {
      token: adminToken,
      body: { studentId: fx.students[0], headId: fx.feeHeads[0], amount: 5000, dueDate: '2026-12-01', date: '2026-11-01' }
    });
    eq(invoice.status, 200, 'create fee invoice');
    fx.invoices.push(invoice.body.invoice.id);

    const receipt = await api('POST', '/school/fee/receipts', {
      token: adminToken,
      body: { invoiceId: fx.invoices[0], amount: 5000, date: '2026-11-15', mode: 'cash' }
    });
    eq(receipt.status, 200, 'create fee receipt');
    fx.receipts.push(receipt.body.receipt.id);
    const receiptsBeforeOverpay = await pool.query(
      'SELECT count(*)::int AS count FROM school_receipt WHERE app_id=$1',
      [APP],
    );
    const overpayment = await api('POST', '/school/fee/receipts', {
      token: adminToken,
      body: { invoiceId: fx.invoices[0], amount: 1, date: '2026-11-16', mode: 'cash' }
    });
    eq(overpayment.status, 400, 'reject fee overpayment');
    const receiptsAfterOverpay = await pool.query(
      'SELECT count(*)::int AS count FROM school_receipt WHERE app_id=$1',
      [APP],
    );
    eq(receiptsAfterOverpay.rows[0].count, receiptsBeforeOverpay.rows[0].count, 'fee overpayment is atomic');

    /* ---- EXAMS / MARKS ---- */
    const exam = await api('POST', '/school/exams', {
      token: adminToken,
      body: { name: 'CRUD Midterm', type: 'unit_test', startDate: '2026-12-01', endDate: '2026-12-10' }
    });
    eq(exam.status, 200, 'create exam');
    fx.exams.push(exam.body.exam.id);

    const paper = await api('POST', '/school/papers', {
      token: adminToken,
      body: { examId: fx.exams[fx.exams.length - 1], subjectId: subj.id, classId: cl1.id, maxMarks: 80, passMarks: 32 }
    });
    eq(paper.status, 200, 'create exam paper');
    fx.papers.push(paper.body.paper.id);

    const component = await api('POST', `/school/exam/papers/${fx.papers[0]}/components`, {
      token: adminToken,
      body: { name: 'Written', maxMarks: 80, passMinimum: 32, isMandatory: true, sortOrder: 1 }
    });
    eq(component.status, 200, 'create paper component');
    fx.components.push(component.body.component.id);

    const ensured = await api('POST', '/school/marks-sheets/ensure', {
      token: adminToken,
      body: { examId: fx.exams[fx.exams.length - 1] }
    });
    eq(ensured.status, 200, 'ensure marks sheets');

    const sheetList = await api('GET', `/school/marks-sheets?examId=${fx.exams[fx.exams.length - 1]}&sectionId=${secA.id}`, {
      token: adminToken
    });
    eq(sheetList.status, 200, 'list marks sheets');
    const sheet = { body: { marksSheet: sheetList.body.marksSheets[0] } };
    assert.ok(sheet.body.marksSheet, 'marks sheet created');
    fx.sheets.push(sheet.body.marksSheet.id);

    const marksEntry = await api('POST', `/school/marks-sheets/${sheet.body.marksSheet.id}/entries`, {
      token: adminToken,
      body: { entries: [{ studentId: fx.students[0], componentId: fx.components[0], marks: 70 }] }
    });
    eq(marksEntry.status, 200, 'create marks entry');
    const { rows: [markEntry] } = await pool.query(
      'SELECT id FROM school_mark_entry WHERE app_id=$1 AND sheet_id=$2 AND student_id=$3',
      [APP, sheet.body.marksSheet.id, fx.students[0]]
    );
    fx.markEntries.push(markEntry.id);

    /* ---- CERTIFICATES ---- */
    const certTemplate = await api('POST', '/school/certificates/templates', {
      token: adminToken,
      body: { name: 'CRUD Bonafide', type: 'bonafide', category: 'certificate' }
    });
    eq(certTemplate.status, 200, 'create certificate template');
    fx.certificateTemplates.push(certTemplate.body.template.id);

    const cert = await api('POST', '/school/certificates/generate', {
      token: adminToken,
      body: { templateId: fx.certificateTemplates[0], studentId: fx.students[0], notes: 'CRUD test' }
    });
    eq(cert.status, 200, 'create certificate');
    const { rows: [certificate] } = await pool.query(
      'SELECT id FROM school_certificate_register WHERE app_id=$1 AND student_id=$2 ORDER BY id DESC LIMIT 1',
      [APP, fx.students[0]]
    );
    fx.certificates.push(certificate.id);

    /* ---- INVENTORY ---- */
    const inv = await api('POST', '/school/inventory/items', {
      token: adminToken,
      body: { code: 'CRUD001', name: 'Test Item', unit: 'pcs', category_id: 1, reorder_level: 10, tracking_type: 'serial' }
    });
    eq(inv.status, 200, 'create inventory item');
    fx.inventory.push(inv.body.item.id);

    /* ---- LIBRARY ---- */
    const title = await api('POST', '/school/library/titles', {
      token: adminToken,
      body: { isbn: `978-3-16-${STAMP.slice(-5)}`, title: 'CRUD Book', author: 'Tester', publisher: 'Test Pub', publish_year: 2026 }
    });
    eq(title.status, 200, 'create library title');

    /* ---- COMMUNICATION ---- */
    const tmpl = await api('POST', '/school/communication/templates', {
      token: adminToken,
      body: { name: 'CRUD Template', channel: 'sms', subject: 'Test', body_text: 'Hello {{name}}' }
    });
    eq(tmpl.status, 200, 'create communication template');

    /* ---- HOSTEL ---- */
    const hostel = await api('POST', '/school/hostel/hostels', {
      token: adminToken,
      body: { name: 'CRUD Hostel', type: 'boys', capacity: 100 }
    });
    eq(hostel.status, 200, 'create hostel');
    fx.hostels.push(hostel.body.hostel.id);

    const block = await api('POST', '/school/hostel/blocks', {
      token: adminToken,
      body: { hostelId: fx.hostels[0], name: 'CRUD Block' }
    });
    eq(block.status, 200, 'create hostel block');

    /* ---- TRANSPORT ---- */
    const vehicle = await api('POST', '/school/transport/vehicles', {
      token: adminToken,
      body: { regNo: 'CRUD001', type: 'bus', capacity: 40, ownership: 'own' }
    });
    eq(vehicle.status, 200, 'create transport vehicle');
    fx.vehicles.push(vehicle.body.vehicle.id);

    /* ---- CANTENEEN ---- */
    const menuItem = await api('POST', '/school/canteen/menu-items', {
      token: adminToken,
      body: { name: 'CRUD Sandwich', category: 'snacks', price: 50, is_veg: true }
    });
    eq(menuItem.status, 200, 'create canteen menu item');

    /* ---- EVENTS ---- */
    const event = await api('POST', '/school/events', {
      token: adminToken,
      body: { title: 'CRUD Event', description: 'Test', startDt: '2026-12-25T10:00:00Z', endDt: '2026-12-25T11:00:00Z', category: 'celebration' }
    });
    eq(event.status, 200, 'create event');
    fx.events.push(event.body.event.id);

    /* ---- ALUMNI ---- */
    const alumni = await api('POST', '/school/alumni/register', {
      token: adminToken,
      body: { studentId: fx.students[0], passingYear: 2020, email: 'alum@test.com', phone: '9999999999' }
    });
    eq(alumni.status, 200, 'create alumni');
    fx.alumni.push(alumni.body.alumni.id);

    /* ---- HR: LEAVE TYPES ---- */
    const leaveTypeCode = `CRUDL${Date.now()}`;
    const lt = await api('POST', '/school/hr/leave/types', {
      token: adminToken,
      body: { code: leaveTypeCode, name: 'CRUD Leave', max_days: 10, is_paid: true, requires_approval: true }
    });
    eq(lt.status, 200, 'create leave type');
    const duplicateLeaveType = await api('POST', '/school/hr/leave/types', {
      token: adminToken,
      body: { code: leaveTypeCode, name: 'Duplicate Leave', is_paid: true, requires_approval: true }
    });
    eq(duplicateLeaveType.status, 409, 'reject duplicate leave type code');

    /* ---- HR: SALARY COMPONENT ---- */
    const sc = await api('POST', '/school/hr/payroll/components', {
      token: adminToken,
      body: { code: 'CRUDSC', name: 'CRUD Allowance', type: 'earning', calculation: 'fixed', is_taxable: true }
    });
    eq(sc.status, 200, 'create salary component');
    fx.salaryComponents.push(sc.body.component.id);

    /* ---- HR: ADVANCE ---- */
    const { rows: [schoolStaff] } = await pool.query(
      `INSERT INTO school_staff (app_id, employee_code, name, status, hr_employee_id)
       VALUES ($1,$2,$3,'active',$4) RETURNING id`,
      [APP, `${PREFIX}_STAFF`, `${PREFIX} Staff`, fx.staff[0]]
    );
    fx.schoolStaff.push(schoolStaff.id);

    const adv = await api('POST', '/school/hr/advances', {
      token: adminToken,
      body: { staff_id: fx.schoolStaff[0], type: 'salary_advance', amount: 5000, reason: 'CRUD advance', installments: 5 }
    });
    eq(adv.status, 200, 'create advance');
    fx.advances.push(adv.body.advance.id);

    /* ---- FRONT OFFICE ---- */
    const visitor = await api('POST', '/school/frontoffice/visits', {
      token: adminToken,
      body: { name: 'Visitor', phone: '9999999999', purpose: 'meeting', whom_to_meet: 'Principal' }
    });
    eq(visitor.status, 200, 'create visitor');

    /* ---- LMS ---- */
    const course = await api('POST', '/school/lms/courses', {
      token: teacherToken,
      body: { title: 'CRUD Course', description: 'Test', classId: cl1.id, subjectId: subj.id, teacherId: fx.schoolStaff[0] }
    });
    eq(course.status, 200, 'create LMS course');
    fx.lmsCourses.push(course.body.course.id);

    /* ---- CROSS-MODULE READS ---- */
    const meT = await api('GET', '/school/me', { token: teacherToken });
    eq(meT.status, 200, 'teacher /school/me');
    eq(!!meT.body.me?.userId, true, 'teacher me.userId');

    const meS = await api('GET', '/school/me', { token: studentToken });
    eq(meS.status, 200, 'student /school/me');
    eq(!!meS.body.me?.userId, true, 'student me.userId');

    const studentProfile = await api('GET', `/school/students/${fx.students[0]}`, { token: adminToken });
    eq(studentProfile.status, 200, 'read student profile');
    eq(studentProfile.body.student.id, fx.students[0], 'student id matches');

    const studentHw = await api('GET', '/school/homework', { token: studentToken });
    eq(studentHw.status, 200, 'student homework list');
    assert.ok(studentHw.body.homework?.length > 0, 'student sees homework');

    const teacherHw = await api('GET', '/school/homework', { token: teacherToken });
    eq(teacherHw.status, 200, 'teacher homework list');
    assert.ok(teacherHw.body.homework?.length > 0, 'teacher sees homework');

    const feeList = await api('GET', '/school/fee/collection', { token: adminToken });
    eq(feeList.status, 200, 'fee invoices list');
    assert.ok(feeList.body.invoices?.some((invoice) => invoice.student_id === fx.students[0]), 'invoice visible');

    const attList = await api('GET', '/school/attendance/registers', { token: teacherToken });
    eq(attList.status, 200, 'attendance registers list');
    assert.ok(attList.body.registers?.length > 0, 'register visible');

    const leaveList = await api('GET', '/school/attendance/student-leave', { token: adminToken });
    eq(leaveList.status, 200, 'student leave list');

    const examList = await api('GET', '/school/exams', { token: adminToken });
    eq(examList.status, 200, 'exams list');
    assert.ok(examList.body.exams?.length > 0, 'exam visible');

    const certList = await api('GET', '/school/certificates/generated', { token: adminToken });
    eq(certList.status, 200, 'certificates list');

    const invList = await api('GET', '/school/inventory/items', { token: adminToken });
    eq(invList.status, 200, 'inventory items list');

    const commList = await api('GET', '/school/communication/templates', { token: adminToken });
    eq(commList.status, 200, 'communication templates list');

    const hostelList = await api('GET', '/school/hostel/blocks', { token: adminToken });
    eq(hostelList.status, 200, 'hostel blocks list');

    const transList = await api('GET', '/school/transport/vehicles', { token: adminToken });
    eq(transList.status, 200, 'transport vehicles list');

    const canteenList = await api('GET', '/school/canteen/menu-items', { token: adminToken });
    eq(canteenList.status, 200, 'canteen menu items list');

    const eventList = await api('GET', '/school/events', { token: adminToken });
    eq(eventList.status, 200, 'events list');

    const alumniList = await api('GET', '/school/alumni/directory', { token: adminToken });
    eq(alumniList.status, 200, 'alumni directory list');

    const hrLeaveTypes = await api('GET', '/school/hr/leave/types', { token: adminToken });
    eq(hrLeaveTypes.status, 200, 'hr leave types list');

    const hrSalaryComp = await api('GET', '/school/hr/payroll/components', { token: adminToken });
    eq(hrSalaryComp.status, 200, 'hr salary components list');

    const hrAdvances = await api('GET', '/school/hr/advances', { token: adminToken });
    eq(hrAdvances.status, 200, 'hr advances list');

    const visitorList = await api('GET', '/school/frontoffice/visits', { token: adminToken });
    eq(visitorList.status, 200, 'front office visitors list');

    const courseList = await api('GET', '/school/lms/courses', { token: teacherToken });
    eq(courseList.status, 200, 'LMS courses list');

    console.log(`\n=== ALL ${checks} CHECKS PASSED ===`);

  } catch (e) {
    console.error('\nFAILED:', e.message);
    console.error(log.slice(-2000));
    process.exitCode = 1;
  } finally {
    await cleanup();
    server.kill();
    await pool.end();
  }
}

main();