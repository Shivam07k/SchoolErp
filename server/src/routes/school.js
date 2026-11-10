import { Router } from 'express';
import { randomUUID } from 'crypto';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { ensureFoundation, loadAccess, can, writeAudit } from '../school/foundation.js';
import { resolveTeacher } from '../school/staff.js';
import { safeErrorMessage } from '../middleware/error.js';

/* ============================================================
   School ERP - Phase 1 API
   Tenant model: the engine already routes every request to the
   company's own PostgreSQL database (getPool reads the token's
   company). app_id is kept on every row as a second safety net and
   for the day two institutions share one database.
   ============================================================ */

export const schoolRouter = Router();
schoolRouter.use(verifyToken);
schoolRouter.use(async (req, res, next) => {
  try {
    if (!req.school) {
      const pool = getPool();
      const appId = req.user?.company || DEFAULT_COMPANY_ID;
      await ensureFoundation(pool, appId);
      req.school = await loadAccess(pool, appId, req.user);
    }
    next();
  } catch (e) {
    next(e);
  }
});

const appIdOf = (req) => req.user?.company || DEFAULT_COMPANY_ID;
const allow = (req, key) => can(req.school, key);
function guard(req, res, key) {
  if (allow(req, key)) return true;
  res.status(403).json({ error: 'You do not have permission for this action' });
  return false;
}
const text = (v) => (v === null || v === undefined ? '' : String(v).trim());
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
const day = (v) => (v === undefined || v === null || v === '') ? null : (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
const validDay = (value) => {
  const valueDay = day(value);
  if (!valueDay || !/^\d{4}-\d{2}-\d{2}$/.test(valueDay)) return false;
  const parsed = new Date(`${valueDay}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === valueDay;
};
const daySpan = (from, to) => Math.floor(
  (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 864e5
) + 1;

function route(fn) {
  return (req, res) => {
    Promise.resolve(fn(req, res)).catch((err) => {
      console.error('[school]', err.message);
      res.status(500).json({ error: safeErrorMessage(err, 'School API error') });
    });
  };
}

const seeded = new Set();

const CLASS_NAMES = [
  'Nursery', 'LKG', 'UKG',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
  'Class 11', 'Class 12',
];

async function ensureSeed(pool, appId) {
  if (seeded.has(appId)) return;
  const year = new Date().getFullYear();
  const label = `${year}-${String((year + 1) % 100).padStart(2, '0')}`;

  const [{ n: years }] = await execQ(pool,
    'SELECT count(*)::int AS n FROM school_academic_years WHERE app_id=$1', [appId]);
  if (!years) {
    await execQ(pool,
      `INSERT INTO school_academic_years (app_id, name, start_date, end_date, is_active)
       VALUES ($1,$2,$3,$4,true) ON CONFLICT DO NOTHING`,
      [appId, label, `${year}-04-01`, `${year + 1}-03-31`]);
  }

  const [{ n: classes }] = await execQ(pool,
    'SELECT count(*)::int AS n FROM school_classes WHERE app_id=$1', [appId]);
  if (!classes) {
    for (let i = 0; i < CLASS_NAMES.length; i++) {
      const rows = await execQ(pool,
        `INSERT INTO school_classes (app_id, name, sort_order)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id`,
        [appId, CLASS_NAMES[i], i]);
      const classId = rows[0]?.id;
      if (!classId) continue;
      for (const sec of ['A', 'B']) {
        await execQ(pool,
          `INSERT INTO school_sections (app_id, class_id, name, capacity)
           VALUES ($1,$2,$3,40) ON CONFLICT DO NOTHING`,
          [appId, classId, sec]);
      }
    }
  }

  const [{ n: heads }] = await execQ(pool,
    'SELECT count(*)::int AS n FROM school_fee_heads WHERE app_id=$1', [appId]);
  if (!heads) {
    for (const [name, description] of [
      ['Tuition Fee', 'Monthly tuition'],
      ['Admission Fee', 'One-time admission charge'],
      ['Transport Fee', 'Bus route charge'],
      ['Exam Fee', 'Term examination charge'],
    ]) {
      await execQ(pool,
        `INSERT INTO school_fee_heads (app_id, name, description)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [appId, name, description]);
    }
  }

  const [{ n: rules }] = await execQ(pool,
    'SELECT count(*)::int AS n FROM school_automation_rules WHERE app_id=$1', [appId]);
  if (!rules) {
    const defs = [
      ['FEE_OVERDUE', 'Fee overdue reminder', 'fee_overdue', 'whatsapp,email,push',
        'Dear {guardian}, the {invoice} for {student} is overdue by {days} day(s). Amount due: {amount}. Please pay at the earliest.',
        { daysAfterDue: 1, repeatEveryDays: 3, maxReminders: 5 }],
      ['ABSENCE_ALERT', 'Same-day absence alert', 'absence', 'whatsapp,push',
        'Dear {guardian}, {student} was marked absent today ({date}). Please contact the class teacher if this is unexpected.',
        { notifyWithinMinutes: 15, escalateAfterAbsences: 3 }],
      ['RESULT_PUBLISHED', 'Result published notice', 'result', 'email,whatsapp',
        'Dear {guardian}, the result for {student} has been published. Please check the parent portal for the summary and PDF.',
        {}],
      ['LIBRARY_OVERDUE', 'Library overdue reminder', 'library', 'whatsapp,email',
        'Dear {guardian}, a library book issued to {student} is overdue. Please return it to avoid a fine.',
        { finePerDay: 5 }],
      ['BUS_DELAY', 'Bus delay alert', 'transport', 'whatsapp,push',
        'Dear {guardian}, the bus on route {route} is delayed by more than 10 minutes. We will keep you updated.',
        { thresholdMinutes: 10 }],
    ];
    for (const [code, name, event, channels, template, config] of defs) {
      await execQ(pool,
        `INSERT INTO school_automation_rules (app_id, code, name, event_type, channels, enabled, template, config)
         VALUES ($1,$2,$3,$4,$5,true,$6,$7::jsonb) ON CONFLICT DO NOTHING`,
        [appId, code, name, event, channels, template, JSON.stringify(config)]);
    }
  }

  seeded.add(appId);
}

/* ---------- helpers ---------- */

const STUDENT_COLS = [
  'app_id', 'admission_no', 'first_name', 'last_name', 'gender', 'dob',
  'class_id', 'section_id', 'roll_no', 'guardian_name', 'guardian_phone',
  'guardian_email', 'address', 'admission_date', 'status', 'photo_url',
  'campus_id', 'middle_name', 'blood_group', 'nationality', 'category',
  'previous_school', 'national_id', 'house', 'apaar_id', 'religion', 'mother_tongue',
  'emergency_contact_name', 'emergency_contact_phone', 'medical_conditions', 'allergies',
  'transport_required', 'hostel_required', 'remarks', 'official_name',
  'name_as_per_certificate', 'place_of_birth', 'aadhaar_no', 'birth_certificate_no',
  'passport_no', 'signature_url', 'father_name', 'father_occupation', 'father_contact',
  'father_email', 'mother_name', 'mother_occupation', 'mother_contact', 'mother_email',
  'guardian_name2', 'guardian_relation', 'guardian_contact', 'chronic_conditions',
  'regular_medications', 'doctor_name', 'doctor_contact', 'preferred_hospital',
  'height_cm', 'weight_kg', 'permanent_address', 'pickup_authorized', 'route_id', 'stop_id',
];
const STUDENT_HEALTH_COLS = new Set([
  'blood_group', 'medical_conditions', 'allergies', 'chronic_conditions',
  'regular_medications', 'doctor_name', 'doctor_contact', 'preferred_hospital',
  'height_cm', 'weight_kg',
]);

function restrictStudentHealthFields(values, columns, req, existing = {}) {
  if (allow(req, 'health.manage')) return values;
  return values.map((value, index) => (
    STUDENT_HEALTH_COLS.has(columns[index]) ? (existing[columns[index]] ?? null) : value
  ));
}

function visibleStudent(req, student) {
  if (allow(req, 'health.view')) return student;
  const visible = { ...student };
  for (const column of STUDENT_HEALTH_COLS) delete visible[column];
  return visible;
}

function studentFields(body, appId, campusId) {
  return [
    appId,
    text(body.admissionNo || body.admission_no),
    text(body.firstName || body.first_name),
    text(body.lastName || body.last_name),
    text(body.gender) || null,
    day(body.dob),
    num(body.classId ?? body.class_id),
    num(body.sectionId ?? body.section_id),
    text(body.rollNo || body.roll_no) || null,
    text(body.guardianName || body.guardian_name) || null,
    text(body.guardianPhone || body.guardian_phone) || null,
    text(body.guardianEmail || body.guardian_email) || null,
    text(body.address) || null,
    day(body.admissionDate || body.admission_date) || new Date().toISOString().slice(0, 10),
    text(body.status) || 'active',
    text(body.photoUrl || body.photo_url) || null,
    campusId,
    text(body.middleName || body.middle_name) || null,
    text(body.bloodGroup || body.blood_group) || null,
    text(body.nationality) || null,
    text(body.category) || null,
    text(body.previousSchool || body.previous_school) || null,
    text(body.nationalId || body.national_id) || null,
    text(body.house) || null,
    text(body.apaarId || body.apaar_id) || null,
    text(body.religion) || null,
    text(body.motherTongue || body.mother_tongue) || null,
    text(body.emergencyContactName || body.emergency_contact_name) || null,
    text(body.emergencyContactPhone || body.emergency_contact_phone) || null,
    text(body.medicalConditions || body.medical_conditions) || null,
    text(body.allergies) || null,
    body.transportRequired === true || body.transport_required === true ? true : (body.transportRequired === false || body.transport_required === false ? false : null),
    body.hostelRequired === true || body.hostel_required === true ? true : (body.hostelRequired === false || body.hostel_required === false ? false : null),
    text(body.remarks) || null,
    text(body.officialName || body.official_name) || null,
    text(body.nameAsPerCertificate || body.name_as_per_certificate) || null,
    text(body.placeOfBirth || body.place_of_birth) || null,
    text(body.aadhaarNo || body.aadhaar_no) || null,
    text(body.birthCertificateNo || body.birth_certificate_no) || null,
    text(body.passportNo || body.passport_no) || null,
    text(body.signatureUrl || body.signature_url) || null,
    text(body.fatherName || body.father_name) || null,
    text(body.fatherOccupation || body.father_occupation) || null,
    text(body.fatherContact || body.father_contact) || null,
    text(body.fatherEmail || body.father_email) || null,
    text(body.motherName || body.mother_name) || null,
    text(body.motherOccupation || body.mother_occupation) || null,
    text(body.motherContact || body.mother_contact) || null,
    text(body.motherEmail || body.mother_email) || null,
    text(body.guardianName2 || body.guardian_name2) || null,
    text(body.guardianRelation || body.guardian_relation) || null,
    text(body.guardianContact || body.guardian_contact) || null,
    JSON.stringify(Array.isArray(body.chronicConditions || body.chronic_conditions)
      ? (body.chronicConditions || body.chronic_conditions) : []),
    text(body.regularMedications || body.regular_medications) || null,
    text(body.doctorName || body.doctor_name) || null,
    text(body.doctorContact || body.doctor_contact) || null,
    text(body.preferredHospital || body.preferred_hospital) || null,
    num(body.heightCm ?? body.height_cm),
    num(body.weightKg ?? body.weight_kg),
    text(body.permanentAddress || body.permanent_address) || null,
    JSON.stringify(Array.isArray(body.pickupAuthorized || body.pickup_authorized)
      ? (body.pickupAuthorized || body.pickup_authorized) : []),
    num(body.routeId ?? body.route_id),
    num(body.stopId ?? body.stop_id),
  ];
}

async function nextAdmissionNo(pool, appId) {
  const rows = await execQ(pool,
    `SELECT count(*)::int + 1 AS n FROM school_students WHERE app_id=$1`, [appId]);
  const year = new Date().getFullYear();
  return `ADM-${year}-${String(rows[0]?.n || 1).padStart(4, '0')}`;
}

async function resolveCampusId(db, appId, requested) {
  const id = num(requested);
  if (id) {
    const rows = await db.query(
      'SELECT id FROM school_campuses WHERE app_id=$1 AND id=$2', [appId, id]);
    if (rows.rows?.length || rows.length) return id;
  }
  const fallback = await db.query(
    `SELECT id FROM school_campuses WHERE app_id=$1 AND status='active' ORDER BY id LIMIT 1`,
    [appId]);
  const rows = fallback.rows || fallback;
  return rows[0]?.id || null;
}

async function activeYearId(db, appId) {
  const r = await db.query(`
    SELECT id FROM school_academic_years WHERE app_id=$1
     ORDER BY is_active DESC, start_date DESC LIMIT 1
  `, [appId]);
  const rows = r.rows || r;
  return rows[0]?.id || null;
}

async function upsertEnrollment(client, appId, student) {
  const yearId = await activeYearId(client, appId);
  if (!yearId) return;
  await client.query(`
    INSERT INTO school_student_enrollments
      (app_id, student_id, academic_year_id, class_id, section_id, roll_no, status, joined_on)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (app_id, student_id, academic_year_id) DO UPDATE SET
      class_id=excluded.class_id, section_id=excluded.section_id,
      roll_no=excluded.roll_no, status=excluded.status
  `, [
    appId, student.id, yearId, student.class_id, student.section_id, student.roll_no,
    student.status === 'active' ? 'studying' : (student.status || 'inactive'),
    student.admission_date,
  ]);
}

async function upsertPrimaryGuardian(client, appId, student, body) {
  const name = text(body.guardianName || body.guardian_name);
  if (!name) return null;
  const phone = text(body.guardianPhone || body.guardian_phone) || null;
  const email = text(body.guardianEmail || body.guardian_email) || null;
  const relation = text(body.guardianRelation || body.guardian_relation) || 'Parent';
  const occupation = text(body.guardianOccupation || body.guardian_occupation) || null;

  let guardian = null;
  if (phone) {
    const found = await client.query(`
      SELECT * FROM school_guardians WHERE app_id=$1 AND phone=$2
       ORDER BY id LIMIT 1
    `, [appId, phone]);
    guardian = found.rows[0] || null;
  }
  if (guardian) {
    const upd = await client.query(`
      UPDATE school_guardians
         SET name=$3, relation=$4, email=coalesce($5,email), occupation=coalesce($6,occupation), updated_at=now()
       WHERE id=$1 AND app_id=$2 RETURNING *
    `, [guardian.id, appId, name, relation, email, occupation]);
    guardian = upd.rows[0];
  } else {
    const ins = await client.query(`
      INSERT INTO school_guardians (app_id, name, relation, phone, email, occupation, address)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [appId, name, relation, phone, email, occupation, text(body.address) || null]);
    guardian = ins.rows[0];
  }

  let familyId = guardian.family_id;
  if (!familyId) {
    const fam = await client.query(`
      INSERT INTO school_families (app_id, name, primary_guardian_id)
      VALUES ($1,$2,$3) RETURNING *
    `, [appId, `${name} family`, guardian.id]);
    familyId = fam.rows[0].id;
    await client.query('UPDATE school_guardians SET family_id=$2 WHERE id=$1', [guardian.id, familyId]);
    guardian.family_id = familyId;
  }

  await client.query(`
    UPDATE school_student_guardians SET is_primary=false
     WHERE student_id=$1 AND guardian_id<>$2
  `, [student.id, guardian.id]);
  await client.query(`
    INSERT INTO school_student_guardians
      (student_id, guardian_id, relation, is_primary, is_emergency, can_pickup, is_fee_payer)
    VALUES ($1,$2,$3,true,true,true,true)
    ON CONFLICT (student_id, guardian_id) DO UPDATE SET
      relation=excluded.relation, is_primary=true, is_emergency=true,
      can_pickup=true, is_fee_payer=true
  `, [student.id, guardian.id, relation]);
  await client.query('UPDATE school_students SET family_id=$2 WHERE app_id=$1 AND id=$3', [appId, familyId, student.id]);
  return guardian;
}

async function studentAuditRow(pool, appId, id) {
  const [row] = await execQ(pool, 'SELECT * FROM school_students WHERE app_id=$1 AND id=$2', [appId, id]);
  return row || null;
}

function render(template, vars) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

/* ---------- dashboard ---------- */

schoolRouter.get('/dashboard', route(async (req, res) => {
  if (!guard(req, res, 'dashboard.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  await ensureSeed(pool, appId);

  const [row] = await execQ(pool, `
    SELECT
      (SELECT count(*) FROM school_students WHERE app_id=$1 AND status='active' AND deleted_at IS NULL)::int AS students,
      (SELECT count(*) FROM school_classes  WHERE app_id=$1)::int                              AS classes,
      (SELECT count(*) FROM school_sections WHERE app_id=$1)::int                              AS sections,
      (SELECT count(*) FROM school_attendance_entry e
       JOIN school_attendance_register r ON r.id = e.register_id AND r.app_id = e.app_id
       WHERE e.app_id=$1 AND r.register_date=current_date
         AND EXISTS (SELECT 1 FROM school_attendance_policy p WHERE p.id=e.policy_id AND p.app_id=e.app_id AND p.category='present'))::int AS present_today,
      (SELECT count(*) FROM school_attendance_entry e
       JOIN school_attendance_register r ON r.id = e.register_id AND r.app_id = e.app_id
       WHERE e.app_id=$1 AND r.register_date=current_date
         AND EXISTS (SELECT 1 FROM school_attendance_policy p WHERE p.id=e.policy_id AND p.app_id=e.app_id AND p.category='absent'))::int  AS absent_today,
      (SELECT coalesce(sum(amount-paid_amount),0) FROM school_fee_invoices WHERE app_id=$1 AND status<>'paid')            AS outstanding,
      (SELECT coalesce(sum(amount),0) FROM school_fee_payments WHERE app_id=$1 AND paid_at::date=current_date)            AS collected_today,
      (SELECT count(*) FROM school_notification_log WHERE app_id=$1 AND created_at::date=current_date)::int               AS notifications_today
  `, [appId]);

  const recentStudents = await execQ(pool, `
    SELECT s.id, s.admission_no, s.first_name, s.last_name, s.admission_date,
           c.name AS class_name, sec.name AS section_name
      FROM school_students s
      LEFT JOIN school_classes c  ON c.id = s.class_id
      LEFT JOIN school_sections sec ON sec.id = s.section_id
     WHERE s.app_id=$1 AND s.deleted_at IS NULL
     ORDER BY s.id DESC LIMIT 6
  `, [appId]);

  const recentPayments = await execQ(pool, `
    SELECT p.id, p.amount, p.method, p.paid_at,
           s.first_name, s.last_name, i.title
      FROM school_fee_payments p
      JOIN school_students s ON s.id = p.student_id
      JOIN school_fee_invoices i ON i.id = p.invoice_id
     WHERE p.app_id=$1 AND s.deleted_at IS NULL
     ORDER BY p.paid_at DESC LIMIT 6
  `, [appId]);

  const feeBuckets = await execQ(pool, `
    SELECT status, count(*)::int AS n, coalesce(sum(amount),0) AS amount
      FROM school_fee_invoices WHERE app_id=$1 GROUP BY status
  `, [appId]);

  const attendanceTrend = await execQ(pool, `
    SELECT r.register_date AS attendance_date,
           count(*) FILTER (WHERE EXISTS (SELECT 1 FROM school_attendance_policy p WHERE p.id=e.policy_id AND p.app_id=e.app_id AND p.category='present'))::int AS present,
           count(*) FILTER (WHERE EXISTS (SELECT 1 FROM school_attendance_policy p WHERE p.id=e.policy_id AND p.app_id=e.app_id AND p.category='absent'))::int  AS absent
      FROM school_attendance_entry e
      JOIN school_attendance_register r ON r.id = e.register_id AND r.app_id = e.app_id
     WHERE e.app_id=$1 AND r.register_date >= current_date - interval '6 days'
     GROUP BY r.register_date ORDER BY r.register_date
  `, [appId]);

  res.json({
    ok: true,
    stats: {
      students: row.students, classes: row.classes, sections: row.sections,
      presentToday: row.present_today, absentToday: row.absent_today,
      outstanding: Number(row.outstanding), collectedToday: Number(row.collected_today),
      notificationsToday: row.notifications_today,
    },
    recentStudents, recentPayments, feeBuckets, attendanceTrend,
  });
}));

/* ---------- students ---------- */

schoolRouter.get('/students', route(async (req, res) => {
  if (!guard(req, res, 'students.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  await ensureSeed(pool, appId);

  const where = ['s.app_id=$1', 's.deleted_at IS NULL'];
  const values = [appId];
  const add = (sql, v) => { values.push(v); where.push(sql.replace('?', `$${values.length}`)); };

  const q = text(req.query.q);
  if (q) {
    values.push(`%${q}%`);
    const p = `$${values.length}`;
    where.push(`(s.first_name ILIKE ${p} OR s.last_name ILIKE ${p} OR s.admission_no ILIKE ${p} OR s.guardian_name ILIKE ${p} OR s.guardian_phone ILIKE ${p})`);
  }
  if (num(req.query.campusId)) add('s.campus_id = ?', num(req.query.campusId));
  if (num(req.query.classId)) add('s.class_id = ?', num(req.query.classId));
  if (num(req.query.sectionId)) add('s.section_id = ?', num(req.query.sectionId));
  if (text(req.query.status)) add('s.status = ?', text(req.query.status));
  if (text(req.query.category)) add('s.category = ?', text(req.query.category));

  const rows = await execQ(pool, `
    SELECT s.*, c.name AS class_name, sec.name AS section_name, cp.name AS campus_name,
           (SELECT count(*) FROM school_student_documents d
             WHERE d.app_id=s.app_id AND d.student_id=s.id)::int AS documents
      FROM school_students s
      LEFT JOIN school_classes c    ON c.id = s.class_id
      LEFT JOIN school_sections sec ON sec.id = s.section_id
      LEFT JOIN school_campuses cp  ON cp.id = s.campus_id
     WHERE ${where.join(' AND ')}
     ORDER BY c.sort_order NULLS LAST, sec.name, s.roll_no NULLS LAST, s.first_name
     LIMIT 500
  `, values);
  res.json({ ok: true, students: rows.map((row) => visibleStudent(req, row)) });
}));

schoolRouter.get('/students/:id', route(async (req, res) => {
  if (!guard(req, res, 'students.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [student] = await execQ(pool, `
    SELECT s.*, c.name AS class_name, sec.name AS section_name, cp.name AS campus_name,
           f.name AS family_name
      FROM school_students s
      LEFT JOIN school_classes c    ON c.id = s.class_id
      LEFT JOIN school_sections sec ON sec.id = s.section_id
      LEFT JOIN school_campuses cp  ON cp.id = s.campus_id
      LEFT JOIN school_families f   ON f.id = s.family_id
     WHERE s.app_id=$1 AND s.id=$2 AND s.deleted_at IS NULL
  `, [appId, id]);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const guardians = await execQ(pool, `
    SELECT g.*, sg.relation AS link_relation, sg.is_primary, sg.is_emergency,
           sg.can_pickup, sg.is_fee_payer
      FROM school_student_guardians sg
      JOIN school_guardians g ON g.id = sg.guardian_id
     WHERE g.app_id=$1 AND sg.student_id=$2
     ORDER BY sg.is_primary DESC, g.name
  `, [appId, id]);

  const documents = await execQ(pool, `
    SELECT d.*, t.name AS type_name
      FROM school_student_documents d
      LEFT JOIN school_document_types t ON t.id = d.document_type_id
     WHERE d.app_id=$1 AND d.student_id=$2
     ORDER BY d.created_at DESC
  `, [appId, id]);

  const enrollments = await execQ(pool, `
    SELECT e.*, y.name AS academic_year, c.name AS class_name, sec.name AS section_name
      FROM school_student_enrollments e
      LEFT JOIN school_academic_years y ON y.id = e.academic_year_id
      LEFT JOIN school_classes c         ON c.id = e.class_id
      LEFT JOIN school_sections sec      ON sec.id = e.section_id
     WHERE e.app_id=$1 AND e.student_id=$2
     ORDER BY y.start_date DESC NULLS LAST, e.id DESC
  `, [appId, id]);

  const attendance = await execQ(pool, `
    SELECT p.category AS status, count(*)::int AS n
      FROM school_attendance_entry e
      JOIN school_attendance_register r ON r.id = e.register_id AND r.app_id = e.app_id
      JOIN school_attendance_policy p ON p.id = e.policy_id AND p.app_id = e.app_id
     WHERE e.app_id=$1 AND e.student_id=$2
     GROUP BY p.category
  `, [appId, id]);
  const attendanceRecent = await execQ(pool, `
    SELECT r.register_date AS attendance_date, p.category AS status, e.remark
      FROM school_attendance_entry e
      JOIN school_attendance_register r ON r.id = e.register_id AND r.app_id = e.app_id
      JOIN school_attendance_policy p ON p.id = e.policy_id AND p.app_id = e.app_id
     WHERE e.app_id=$1 AND e.student_id=$2
     ORDER BY r.register_date DESC LIMIT 30
  `, [appId, id]);

  const invoices = await execQ(pool, `
    SELECT * FROM school_fee_invoices WHERE app_id=$1 AND student_id=$2 ORDER BY due_date DESC
  `, [appId, id]);
  const payments = await execQ(pool, `
    SELECT p.*, i.title FROM school_fee_payments p
      JOIN school_fee_invoices i ON i.id=p.invoice_id
     WHERE p.app_id=$1 AND p.student_id=$2 ORDER BY p.paid_at DESC LIMIT 30
  `, [appId, id]);

  const notifications = await execQ(pool, `
    SELECT * FROM school_notification_log
     WHERE app_id=$1 AND student_id=$2 ORDER BY created_at DESC LIMIT 20
  `, [appId, id]);

  const audit = await execQ(pool, `
    SELECT id, action, user_id, before_json, after_json, created_at
      FROM school_audit_log
     WHERE app_id=$1 AND entity='school_students' AND entity_id=$2
     ORDER BY created_at DESC LIMIT 25
  `, [appId, String(id)]);

  const siblings = await execQ(pool, `
    SELECT id, admission_no, first_name, last_name, class_id
      FROM school_students
     WHERE app_id=$1 AND family_id = $2 AND id <> $3 AND deleted_at IS NULL
  `, [appId, student.family_id, id]);

  res.json({
    ok: true, student: visibleStudent(req, student), guardians, documents, enrollments, attendance,
    attendanceRecent, invoices, payments, notifications, siblings, audit,
  });
}));

schoolRouter.post('/students', route(async (req, res) => {
  if (!guard(req, res, 'students.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const body = req.body || {};
  if (!text(body.firstName || body.first_name)) return res.status(400).json({ error: 'First name is required' });

  let admissionNo = text(body.admissionNo || body.admission_no);
  if (!admissionNo) admissionNo = await nextAdmissionNo(pool, appId);
  body.admissionNo = admissionNo;
  const campusId = await resolveCampusId(
    pool, appId, body.campusId ?? body.campus_id ?? req.school?.defaultCampusId,
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const values = restrictStudentHealthFields(studentFields(body, appId, campusId), STUDENT_COLS, req);
    const inserted = await client.query(
      `INSERT INTO school_students (${STUDENT_COLS.join(',')})
       VALUES (${STUDENT_COLS.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`,
      values);
    let student = inserted.rows[0];
      if (!student.student_code) {
        student = (await client.query(
          `UPDATE school_students SET student_code=$3
            WHERE app_id=$1 AND id=$2 RETURNING *`,
          [appId, student.id, `STU-${new Date().getFullYear()}-${String(student.id).padStart(6, '0')}`],
        )).rows[0] || student;
      }
    await upsertPrimaryGuardian(client, appId, student, body);
    const refreshed = await client.query('SELECT * FROM school_students WHERE id=$1', [student.id]);
    student = refreshed.rows[0] || student;
    await upsertEnrollment(client, appId, student);
    await client.query('COMMIT');
    await writeAudit(pool, req, {
      action: 'student.create', entity: 'school_students', entityId: student.id, after: student,
    });
    res.json({ ok: true, student });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    if (String(e.message).includes('duplicate key')) {
      return res.status(409).json({ error: `Admission number ${admissionNo} already exists` });
    }
    throw e;
  } finally {
    client.release();
  }
}));

schoolRouter.put('/students/:id', route(async (req, res) => {
  if (!guard(req, res, 'students.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const body = req.body || {};
  if (!text(body.firstName || body.first_name)) return res.status(400).json({ error: 'First name is required' });

  const before = await studentAuditRow(pool, appId, id);
  if (!before || before.deleted_at) return res.status(404).json({ error: 'Student not found' });

  const requestedCampus = body.campusId ?? body.campus_id;
  const campusId = requestedCampus !== undefined && requestedCampus !== null && requestedCampus !== ''
    ? await resolveCampusId(pool, appId, requestedCampus)
    : before.campus_id;

  const fields = restrictStudentHealthFields(
    studentFields(body, appId, campusId).slice(1),
    STUDENT_COLS.slice(1),
    req,
    before,
  );
  const sets = STUDENT_COLS.slice(1).map((c, i) => `${c}=$${i + 2}`).join(',');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE school_students SET ${sets}, updated_at=now()
        WHERE app_id=$1 AND id=$${fields.length + 2} AND deleted_at IS NULL RETURNING *`,
      [appId, ...fields, id]);
    let student = updated.rows[0];
    if (!student) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Student not found' }); }
    await upsertPrimaryGuardian(client, appId, student, body);
    const refreshed = await client.query('SELECT * FROM school_students WHERE id=$1', [student.id]);
    student = refreshed.rows[0] || student;
    await upsertEnrollment(client, appId, student);
    await client.query('COMMIT');
    await writeAudit(pool, req, {
      action: 'student.update', entity: 'school_students', entityId: id, before, after: student,
    });
    res.json({ ok: true, student: visibleStudent(req, student) });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}));

schoolRouter.delete('/students/:id', route(async (req, res) => {
  if (!guard(req, res, 'students.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const before = await studentAuditRow(pool, appId, id);
  if (!before || before.deleted_at) return res.status(404).json({ error: 'Student not found' });
  await execQ(pool, `
    UPDATE school_students SET deleted_at=now(), status='inactive', updated_at=now()
     WHERE app_id=$1 AND id=$2
  `, [appId, id]);
  await execQ(pool, `
    UPDATE school_student_enrollments SET status='left', left_on=current_date
     WHERE app_id=$1 AND student_id=$2 AND status='studying'
  `, [appId, id]);
  await writeAudit(pool, req, {
    action: 'student.archive', entity: 'school_students', entityId: id, before,
    after: { ...before, deleted_at: new Date().toISOString(), status: 'inactive' },
  });
  res.json({ ok: true });
}));

/* ---------- guardians ---------- */

schoolRouter.post('/students/:id/guardians', route(async (req, res) => {
  if (!guard(req, res, 'students.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const studentId = num(req.params.id);
  const body = req.body || {};
  const name = text(body.name);
  if (!name) return res.status(400).json({ error: 'Guardian name is required' });
  const [student] = await execQ(pool,
    'SELECT * FROM school_students WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, studentId]);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const phone = text(body.phone) || null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let guardian = null;
    if (num(body.guardianId)) {
      const found = await client.query('SELECT * FROM school_guardians WHERE app_id=$1 AND id=$2', [appId, num(body.guardianId)]);
      guardian = found.rows[0];
    } else if (phone) {
      const found = await client.query('SELECT * FROM school_guardians WHERE app_id=$1 AND phone=$2 ORDER BY id LIMIT 1', [appId, phone]);
      guardian = found.rows[0];
    }
    if (guardian) {
      const upd = await client.query(`
        UPDATE school_guardians SET name=$3, relation=coalesce($4,relation), email=coalesce($5,email),
               occupation=coalesce($6,occupation), address=coalesce($7,address), updated_at=now()
         WHERE id=$1 AND app_id=$2 RETURNING *
      `, [guardian.id, appId, name, text(body.relation) || null, text(body.email) || null,
          text(body.occupation) || null, text(body.address) || null]);
      guardian = upd.rows[0];
    } else {
      const ins = await client.query(`
        INSERT INTO school_guardians (app_id, name, relation, phone, email, occupation, address)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
      `, [appId, name, text(body.relation) || 'Guardian', phone, text(body.email) || null,
          text(body.occupation) || null, text(body.address) || null]);
      guardian = ins.rows[0];
    }
    const primary = body.isPrimary === true;
    if (primary) {
      await client.query('UPDATE school_student_guardians SET is_primary=false WHERE student_id=$1', [studentId]);
    }
    await client.query(`
      INSERT INTO school_student_guardians
        (student_id, guardian_id, relation, is_primary, is_emergency, can_pickup, is_fee_payer)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (student_id, guardian_id) DO UPDATE SET
        relation=excluded.relation, is_primary=excluded.is_primary,
        is_emergency=excluded.is_emergency, can_pickup=excluded.can_pickup,
        is_fee_payer=excluded.is_fee_payer
    `, [studentId, guardian.id, text(body.relation) || guardian.relation || 'Guardian', primary,
        body.isEmergency === true, body.canPickup !== false, body.isFeePayer === true]);
    await client.query('COMMIT');
    await writeAudit(pool, req, {
      action: 'student.guardian.add', entity: 'school_students', entityId: studentId, after: guardian,
    });
    res.json({ ok: true, guardian });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}));

schoolRouter.put('/students/:id/guardians/:guardianId', route(async (req, res) => {
  if (!guard(req, res, 'students.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const studentId = num(req.params.id);
  const guardianId = num(req.params.guardianId);
  const body = req.body || {};
  if (!text(body.name)) return res.status(400).json({ error: 'Guardian name is required' });
  const client = await pool.connect();
  let before;
  let guardian;
  try {
    await client.query('BEGIN');
    const linked = await client.query(`
      SELECT g.*, sg.relation AS link_relation, sg.is_primary, sg.is_emergency,
             sg.can_pickup, sg.is_fee_payer
        FROM school_student_guardians sg
      JOIN school_guardians g ON g.id=sg.guardian_id AND g.app_id=$3
      JOIN school_students s ON s.id=sg.student_id AND s.app_id=$3 AND s.deleted_at IS NULL
      WHERE sg.student_id=$1 AND sg.guardian_id=$2
      FOR UPDATE OF sg
    `, [studentId, guardianId, appId]);
    before = linked.rows[0];
    if (!before) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Linked guardian not found' });
    }
    const updatedGuardian = await client.query(`
      UPDATE school_guardians
         SET name=$3, relation=$4, phone=$5, email=$6, occupation=$7,
             address=$8, updated_at=now()
       WHERE app_id=$1 AND id=$2 RETURNING *
    `, [appId, guardianId, text(body.name), text(body.relation) || before.relation,
        text(body.phone) || null, text(body.email) || null,
        text(body.occupation) || null, text(body.address) || null]);
    guardian = updatedGuardian.rows[0];
    const isPrimary = typeof body.isPrimary === 'boolean' ? body.isPrimary : before.is_primary;
    if (isPrimary) {
      await client.query(
        'UPDATE school_student_guardians SET is_primary=false WHERE student_id=$1 AND guardian_id<>$2',
        [studentId, guardianId]);
    }
    await client.query(`
      UPDATE school_student_guardians
         SET relation=$3, is_primary=$4, is_emergency=$5, can_pickup=$6, is_fee_payer=$7
       WHERE student_id=$1 AND guardian_id=$2
    `, [studentId, guardianId, text(body.relation) || before.link_relation || before.relation,
        isPrimary,
        typeof body.isEmergency === 'boolean' ? body.isEmergency : before.is_emergency,
        typeof body.canPickup === 'boolean' ? body.canPickup : before.can_pickup,
        typeof body.isFeePayer === 'boolean' ? body.isFeePayer : before.is_fee_payer]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  await writeAudit(pool, req, {
    action: 'student.guardian.update', entity: 'school_students', entityId: studentId,
    before, after: guardian,
  });
  res.json({ ok: true, guardian });
}));

schoolRouter.delete('/students/:id/guardians/:guardianId', route(async (req, res) => {
  if (!guard(req, res, 'students.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const studentId = num(req.params.id);
  const guardianId = num(req.params.guardianId);
  const rows = await execQ(pool, `
    DELETE FROM school_student_guardians
     WHERE student_id=$1 AND guardian_id=$2
       AND EXISTS (SELECT 1 FROM school_students WHERE app_id=$3 AND id=$1)
     RETURNING guardian_id
  `, [studentId, guardianId, appId]);
  if (!rows.length) return res.status(404).json({ error: 'Guardian link not found' });
  await writeAudit(pool, req, {
    action: 'student.guardian.remove', entity: 'school_students', entityId: studentId,
    before: { guardianId },
  });
  res.json({ ok: true });
}));

/* ---------- documents ---------- */

schoolRouter.get('/document-types', route(async (req, res) => {
  if (!guard(req, res, 'students.view')) return;
  const pool = getPool();
  const rows = await execQ(pool,
    'SELECT * FROM school_document_types WHERE app_id=$1 ORDER BY sort_order, name', [appIdOf(req)]);
  res.json({ ok: true, types: rows });
}));

schoolRouter.post('/students/:id/documents', route(async (req, res) => {
  if (!guard(req, res, 'students.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const studentId = num(req.params.id);
  const fileName = text(req.body?.fileName || req.body?.file_name);
  if (!fileName) return res.status(400).json({ error: 'File name is required' });
  const [student] = await execQ(pool,
    'SELECT id FROM school_students WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, studentId]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const [row] = await execQ(pool, `
    INSERT INTO school_student_documents
      (app_id, student_id, document_type_id, file_name, file_url, status, expires_on, verified_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
  `, [
    appId, studentId, num(req.body?.documentTypeId), fileName, text(req.body?.fileUrl) || null,
    text(req.body?.status) || 'pending', day(req.body?.expiresOn),
    text(req.body?.verifiedBy) || null,
  ]);
  await writeAudit(pool, req, {
    action: 'student.document.add', entity: 'school_students', entityId: studentId, after: row,
  });
  res.json({ ok: true, document: row });
}));

schoolRouter.put('/students/:id/documents/:docId', route(async (req, res) => {
  if (!guard(req, res, 'students.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const studentId = num(req.params.id);
  const docId = num(req.params.docId);
  const [before] = await execQ(pool,
    'SELECT * FROM school_student_documents WHERE app_id=$1 AND id=$2 AND student_id=$3',
    [appId, docId, studentId]);
  if (!before) return res.status(404).json({ error: 'Document not found' });
  const [row] = await execQ(pool, `
    UPDATE school_student_documents
       SET document_type_id=coalesce($4,document_type_id), file_name=coalesce($5,file_name),
           file_url=coalesce($6,file_url), status=coalesce($7,status),
           expires_on=coalesce($8,expires_on), verified_by=coalesce($9,verified_by)
     WHERE app_id=$1 AND id=$2 AND student_id=$3 RETURNING *
  `, [appId, docId, studentId, num(req.body?.documentTypeId), text(req.body?.fileName) || null,
      text(req.body?.fileUrl) || null, text(req.body?.status) || null, day(req.body?.expiresOn),
      text(req.body?.verifiedBy) || null]);
  await writeAudit(pool, req, {
    action: 'student.document.update', entity: 'school_students', entityId: studentId,
    before, after: row,
  });
  res.json({ ok: true, document: row });
}));

schoolRouter.delete('/students/:id/documents/:docId', route(async (req, res) => {
  if (!guard(req, res, 'students.manage')) return;
  const pool = getPool();
  const rows = await execQ(pool, `
    DELETE FROM school_student_documents
     WHERE app_id=$1 AND id=$2 AND student_id=$3 RETURNING *
  `, [appIdOf(req), num(req.params.docId), num(req.params.id)]);
  if (!rows.length) return res.status(404).json({ error: 'Document not found' });
  await writeAudit(pool, req, {
    action: 'student.document.remove', entity: 'school_students', entityId: num(req.params.id), before: rows[0],
  });
  res.json({ ok: true });
}));

/* ---------- classes + sections + subjects ---------- */

const includeInactive = (req) => ['1', 'true', 'yes'].includes(String(req.query.includeInactive ?? req.query.include_inactive ?? '').toLowerCase());

function sortOrderOf(body, fallback = 0) {
  const raw = body?.sortOrder ?? body?.sort_order;
  if (raw === undefined || raw === null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isInteger(value) ? value : NaN;
}

function capacityOf(body, fallback = 40) {
  const raw = body?.capacity;
  if (raw === undefined || raw === null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : NaN;
}

async function classTeacherOf(pool, appId, body) {
  const raw = body?.classTeacherId ?? body?.class_teacher_id ?? body?.classTeacher ?? body?.class_teacher;
  const id = text(raw);
  if (!id) return { id: null, name: null, employeeId: null };
  const teacher = await resolveTeacher(pool, appId, id);
  if (!teacher) return { error: 'Class teacher not found or inactive' };
  return { id: teacher.id, name: teacher.name, employeeId: teacher.employeeId };
}

async function duplicateClass(pool, appId, name, excludeId = null) {
  const params = [appId, name.trim().toLowerCase()];
  let q = `SELECT id FROM school_classes WHERE app_id=$1 AND lower(btrim(name))=$2`;
  if (excludeId) { params.push(excludeId); q += ` AND id <> $${params.length}`; }
  return execQ(pool, q, params);
}

async function duplicateSection(pool, appId, classId, name, excludeId = null) {
  const params = [appId, classId, name.trim().toLowerCase()];
  let q = `SELECT id FROM school_sections WHERE app_id=$1 AND class_id=$2 AND lower(btrim(name))=$3`;
  if (excludeId) { params.push(excludeId); q += ` AND id <> $${params.length}`; }
  return execQ(pool, q, params);
}

async function classReferenceCount(pool, appId, classId) {
  const [{ n }] = await execQ(pool, `
    SELECT (
      (SELECT count(*) FROM school_sections WHERE app_id=$1 AND class_id=$2) +
      (SELECT count(*) FROM school_students WHERE app_id=$1 AND class_id=$2) +
      (SELECT count(*) FROM school_student_enrollments WHERE app_id=$1 AND class_id=$2) +
      (SELECT count(*) FROM school_subjects WHERE app_id=$1 AND class_id=$2) +
      (SELECT count(*) FROM school_subject_allocations WHERE app_id=$1 AND class_id=$2) +
      (SELECT count(*) FROM school_timetables WHERE app_id=$1 AND class_id=$2) +
      (SELECT count(*) FROM school_homework WHERE app_id=$1 AND class_id=$2) +
      (SELECT count(*) FROM school_exam_schedules WHERE app_id=$1 AND class_id=$2)
    )::int AS n
  `, [appId, classId]);
  return n;
}

async function sectionReferenceCount(pool, appId, sectionId) {
  const [{ n }] = await execQ(pool, `
    SELECT (
      (SELECT count(*) FROM school_students WHERE app_id=$1 AND section_id=$2) +
      (SELECT count(*) FROM school_student_enrollments WHERE app_id=$1 AND section_id=$2) +
      (SELECT count(*) FROM school_subject_allocations WHERE app_id=$1 AND section_id=$2) +
      (SELECT count(*) FROM school_timetables WHERE app_id=$1 AND section_id=$2) +
      (SELECT count(*) FROM school_homework WHERE app_id=$1 AND section_id=$2)
    )::int AS n
  `, [appId, sectionId]);
  return n;
}

async function sectionStrength(pool, appId, sectionId) {
  const [{ n }] = await execQ(pool, `
    SELECT count(*)::int AS n FROM school_students
     WHERE app_id=$1 AND section_id=$2 AND status='active' AND deleted_at IS NULL
  `, [appId, sectionId]);
  return n;
}

schoolRouter.get('/classes', route(async (req, res) => {
  if (!guard(req, res, 'academics.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  await ensureSeed(pool, appId);
  const showInactive = includeInactive(req);

  const classes = await execQ(pool, `
    SELECT c.id, c.name, c.stream, c.sort_order, c.is_active,
           (SELECT count(*) FROM school_students s WHERE s.app_id=c.app_id AND s.class_id=c.id AND s.status='active' AND s.deleted_at IS NULL)::int AS students,
           coalesce((
             SELECT json_agg(json_build_object(
               'id', sec.id, 'name', sec.name, 'capacity', sec.capacity,
               'is_active', sec.is_active,
               'classTeacher', sec.class_teacher,
               'classTeacherId', sec.class_teacher_id,
               'classTeacherName', coalesce(nullif(trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')), ''), u."UserName", sec.class_teacher),
               'students', (SELECT count(*) FROM school_students s WHERE s.app_id=sec.app_id AND s.section_id=sec.id AND s.status='active' AND s.deleted_at IS NULL)
             ) ORDER BY sec.name)
             FROM school_sections sec
             LEFT JOIN school_hr_employees e ON e.id=sec.class_teacher_id AND e.app_id=sec.app_id
             LEFT JOIN "tblHO_User" u ON u."UserId"::text=sec.class_teacher AND sec.class_teacher_id IS NULL
             WHERE sec.app_id=c.app_id AND sec.class_id=c.id AND ($2 OR sec.is_active)
           ), '[]'::json) AS sections
      FROM school_classes c
     WHERE c.app_id=$1 AND ($2 OR c.is_active)
     ORDER BY c.is_active DESC, c.sort_order, c.name
  `, [appId, showInactive]);

  const subjects = await execQ(pool, `
    SELECT s.*, c.name AS class_name
      FROM school_subjects s LEFT JOIN school_classes c ON c.id=s.class_id AND c.app_id=s.app_id
     WHERE s.app_id=$1 AND ($2 OR s.is_active)
     ORDER BY s.is_active DESC, c.sort_order NULLS LAST, s.name
  `, [appId, showInactive]);

  res.json({ ok: true, classes, subjects });
}));

schoolRouter.post('/classes', route(async (req, res) => {
  if (!guard(req, res, 'academics.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const name = text(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Class name is required' });
  const sortOrder = sortOrderOf(req.body);
  if (Number.isNaN(sortOrder)) return res.status(400).json({ error: 'Sort order must be a whole number' });
  if ((await duplicateClass(pool, appId, name)).length) {
    return res.status(409).json({ error: 'A class with this name already exists' });
  }
  const isActive = req.body?.isActive === undefined && req.body?.is_active === undefined
    ? true : (req.body.isActive === true || req.body.isActive === 'true' || req.body.is_active === true || req.body.is_active === 'true');
  const [row] = await execQ(pool,
    `INSERT INTO school_classes (app_id, name, stream, sort_order, is_active)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [appId, name, text(req.body?.stream) || null, sortOrder, isActive]);
  await writeAudit(pool, req, { action: 'class.create', entity: 'school_classes', entityId: row.id, after: row });
  res.json({ ok: true, class: row });
}));

schoolRouter.put('/classes/:id', route(async (req, res) => {
  if (!guard(req, res, 'academics.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [before] = await execQ(pool, 'SELECT * FROM school_classes WHERE app_id=$1 AND id=$2', [appId, id]);
  if (!before) return res.status(404).json({ error: 'Class not found' });
  const name = req.body?.name === undefined ? before.name : text(req.body.name);
  if (!name) return res.status(400).json({ error: 'Class name is required' });
  const sortOrder = sortOrderOf(req.body, before.sort_order);
  if (Number.isNaN(sortOrder)) return res.status(400).json({ error: 'Sort order must be a whole number' });
  if ((await duplicateClass(pool, appId, name, id)).length) {
    return res.status(409).json({ error: 'A class with this name already exists' });
  }
  const nextActive = req.body?.isActive === undefined && req.body?.is_active === undefined
    ? before.is_active
    : (req.body.isActive === true || req.body.isActive === 'true' || req.body.is_active === true || req.body.is_active === 'true');
  const [row] = await execQ(pool,
    `UPDATE school_classes SET name=$3, stream=$4, sort_order=$5, is_active=$6, updated_at=now()
      WHERE app_id=$1 AND id=$2 RETURNING *`,
    [appId, id, name, text(req.body?.stream ?? before.stream) || null, sortOrder, nextActive]);
  await writeAudit(pool, req, { action: 'class.update', entity: 'school_classes', entityId: id, before, after: row });
  res.json({ ok: true, class: row });
}));

schoolRouter.delete('/classes/:id', route(async (req, res) => {
  if (!guard(req, res, 'academics.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [before] = await execQ(pool, 'SELECT * FROM school_classes WHERE app_id=$1 AND id=$2', [appId, id]);
  if (!before) return res.status(404).json({ error: 'Class not found' });
  if (await classReferenceCount(pool, appId, id)) {
    return res.status(409).json({ error: 'This class is used by sections, students, timetable or academic records; archive it instead of deleting it' });
  }
  await execQ(pool, 'DELETE FROM school_classes WHERE app_id=$1 AND id=$2', [appId, id]);
  await writeAudit(pool, req, { action: 'class.delete', entity: 'school_classes', entityId: id, before });
  res.json({ ok: true });
}));

schoolRouter.post('/sections', route(async (req, res) => {
  if (!guard(req, res, 'academics.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const classId = num(req.body?.classId ?? req.body?.class_id);
  const name = text(req.body?.name);
  if (!classId) return res.status(400).json({ error: 'Class is required' });
  if (!name) return res.status(400).json({ error: 'Section name is required' });
  const [schoolClass] = await execQ(pool,
    'SELECT * FROM school_classes WHERE app_id=$1 AND id=$2', [appId, classId]);
  if (!schoolClass) return res.status(400).json({ error: 'Class not found' });
  if (!schoolClass.is_active) return res.status(409).json({ error: 'The selected class is archived' });
  const capacity = capacityOf(req.body);
  if (Number.isNaN(capacity)) return res.status(400).json({ error: 'Capacity must be a whole number greater than zero' });
  const teacher = await classTeacherOf(pool, appId, req.body);
  if (teacher.error) return res.status(400).json({ error: teacher.error });
  if ((await duplicateSection(pool, appId, classId, name)).length) {
    return res.status(409).json({ error: 'A section with this name already exists in the class' });
  }
  const isActive = req.body?.isActive === undefined && req.body?.is_active === undefined
    ? true : (req.body.isActive === true || req.body.isActive === 'true' || req.body.is_active === true || req.body.is_active === 'true');
  const [row] = await execQ(pool,
    `INSERT INTO school_sections (app_id, class_id, name, capacity, class_teacher, class_teacher_id, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [appId, classId, name, capacity, teacher.id, teacher.employeeId, isActive]);
  await writeAudit(pool, req, { action: 'section.create', entity: 'school_sections', entityId: row.id, after: row });
  res.json({ ok: true, section: row });
}));

schoolRouter.put('/sections/:id', route(async (req, res) => {
  if (!guard(req, res, 'academics.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [before] = await execQ(pool, 'SELECT * FROM school_sections WHERE app_id=$1 AND id=$2', [appId, id]);
  if (!before) return res.status(404).json({ error: 'Section not found' });
  const classId = num(req.body?.classId ?? req.body?.class_id) ?? before.class_id;
  const name = req.body?.name === undefined ? before.name : text(req.body.name);
  if (!name) return res.status(400).json({ error: 'Section name is required' });
  const [schoolClass] = await execQ(pool,
    'SELECT * FROM school_classes WHERE app_id=$1 AND id=$2', [appId, classId]);
  if (!schoolClass) return res.status(400).json({ error: 'Class not found' });
  if (Number(classId) !== Number(before.class_id) && await sectionReferenceCount(pool, appId, id)) {
    return res.status(409).json({ error: 'A section with students or academic records cannot be moved to another class' });
  }
  const capacity = capacityOf(req.body, before.capacity);
  if (Number.isNaN(capacity)) return res.status(400).json({ error: 'Capacity must be a whole number greater than zero' });
  if (capacity < await sectionStrength(pool, appId, id)) {
    return res.status(409).json({ error: 'Capacity cannot be lower than the current active student count' });
  }
  const teacher = await classTeacherOf(pool, appId, req.body);
  if (teacher.error) return res.status(400).json({ error: teacher.error });
  if ((await duplicateSection(pool, appId, classId, name, id)).length) {
    return res.status(409).json({ error: 'A section with this name already exists in the class' });
  }
  const nextActive = req.body?.isActive === undefined && req.body?.is_active === undefined
    ? before.is_active
    : (req.body.isActive === true || req.body.isActive === 'true' || req.body.is_active === true || req.body.is_active === 'true');
  const teacherId = teacher.id === null ? null : teacher.id;
  const teacherEmployeeId = teacher.id === null ? null : teacher.employeeId;
  const [row] = await execQ(pool,
    `UPDATE school_sections
        SET class_id=$3, name=$4, capacity=$5, class_teacher=$6, class_teacher_id=$7,
            is_active=$8, updated_at=now()
      WHERE app_id=$1 AND id=$2 RETURNING *`,
    [appId, id, classId, name, capacity, teacherId, teacherEmployeeId, nextActive]);
  await writeAudit(pool, req, { action: 'section.update', entity: 'school_sections', entityId: id, before, after: row });
  res.json({ ok: true, section: row });
}));

schoolRouter.delete('/sections/:id', route(async (req, res) => {
  if (!guard(req, res, 'academics.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [before] = await execQ(pool, 'SELECT * FROM school_sections WHERE app_id=$1 AND id=$2', [appId, id]);
  if (!before) return res.status(404).json({ error: 'Section not found' });
  if (await sectionReferenceCount(pool, appId, id)) {
    return res.status(409).json({ error: 'This section is used by students, timetable or academic records; archive it instead of deleting it' });
  }
  await execQ(pool, 'DELETE FROM school_sections WHERE app_id=$1 AND id=$2', [appId, id]);
  await writeAudit(pool, req, { action: 'section.delete', entity: 'school_sections', entityId: id, before });
  res.json({ ok: true });
}));

function subjectCode(v) {
  const code = text(v).toUpperCase();
  if (!code) return { code: null };
  if (!/^[A-Z0-9._-]{1,30}$/.test(code)) {
    return { error: 'Subject code may only use letters, numbers, dot, dash and underscore (max 30 characters)' };
  }
  return { code };
}

async function subjectClass(pool, appId, classId) {
  if (!classId) return { classId: null };
  const [schoolClass] = await execQ(pool,
    'SELECT id, is_active FROM school_classes WHERE app_id=$1 AND id=$2', [appId, classId]);
  if (!schoolClass) return { error: 'Class not found' };
  return { classId };
}

schoolRouter.post('/subjects', route(async (req, res) => {
  if (!guard(req, res, 'academics.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const name = text(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Subject name is required' });
  const codeInput = subjectCode(req.body?.code);
  if (codeInput.error) return res.status(400).json({ error: codeInput.error });
  const maxMarks = num(req.body?.maxMarks ?? req.body?.max_marks);
  if (maxMarks !== null && (!Number.isInteger(maxMarks) || maxMarks <= 0)) {
    return res.status(400).json({ error: 'Maximum marks must be a whole number greater than zero' });
  }
  const classInput = await subjectClass(pool, appId, num(req.body?.classId ?? req.body?.class_id));
  if (classInput.error) return res.status(400).json({ error: classInput.error });
  if (codeInput.code) {
    const dup = await execQ(pool,
      'SELECT id FROM school_subjects WHERE app_id=$1 AND lower(code)=lower($2)', [appId, codeInput.code]);
    if (dup.length) return res.status(409).json({ error: 'A subject with this code already exists' });
  }
  const isActive = req.body?.isActive === undefined && req.body?.is_active === undefined
    ? true : (req.body.isActive === true || req.body.isActive === 'true' || req.body.is_active === true || req.body.is_active === 'true');
  const [row] = await execQ(pool,
    `INSERT INTO school_subjects (app_id, code, name, class_id, max_marks, is_active)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [appId, codeInput.code, name, classInput.classId, maxMarks ?? 100, isActive]);
  await writeAudit(pool, req, { action: 'subject.create', entity: 'school_subjects', entityId: row.id, after: row });
  res.json({ ok: true, subject: row });
}));

schoolRouter.put('/subjects/:id', route(async (req, res) => {
  if (!guard(req, res, 'academics.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [before] = await execQ(pool, 'SELECT * FROM school_subjects WHERE app_id=$1 AND id=$2', [appId, id]);
  if (!before) return res.status(404).json({ error: 'Subject not found' });
  const name = req.body?.name === undefined ? before.name : text(req.body.name);
  if (!name) return res.status(400).json({ error: 'Subject name is required' });
  const codeInput = req.body?.code === undefined ? { code: before.code } : subjectCode(req.body.code);
  if (codeInput.error) return res.status(400).json({ error: codeInput.error });
  const hasClassInput = Boolean(req.body && ('classId' in req.body || 'class_id' in req.body));
  const classValue = hasClassInput ? (req.body.classId ?? req.body.class_id ?? null) : undefined;
  const classInput = classValue === undefined
    ? { classId: before.class_id }
    : await subjectClass(pool, appId, num(classValue));
  if (classInput.error) return res.status(400).json({ error: classInput.error });
  const maxValue = req.body?.maxMarks ?? req.body?.max_marks;
  const maxMarks = maxValue === undefined ? Number(before.max_marks) : num(maxValue);
  if (maxMarks !== null && (!Number.isInteger(maxMarks) || maxMarks <= 0)) {
    return res.status(400).json({ error: 'Maximum marks must be a whole number greater than zero' });
  }
  if (codeInput.code) {
    const dup = await execQ(pool,
      'SELECT id FROM school_subjects WHERE app_id=$1 AND lower(code)=lower($2) AND id<>$3',
      [appId, codeInput.code, id]);
    if (dup.length) return res.status(409).json({ error: 'A subject with this code already exists' });
  }
  const nextActive = req.body?.isActive === undefined && req.body?.is_active === undefined
    ? before.is_active
    : (req.body.isActive === true || req.body.isActive === 'true' || req.body.is_active === true || req.body.is_active === 'true');
  const [row] = await execQ(pool, `
    UPDATE school_subjects
       SET code=$3, name=$4, class_id=$5, max_marks=$6, is_active=$7, updated_at=now()
     WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appId, id, codeInput.code, name, classInput.classId || null, maxMarks ?? 100, nextActive]);
  await writeAudit(pool, req, { action: 'subject.update', entity: 'school_subjects', entityId: id, before, after: row });
  res.json({ ok: true, subject: row });
}));

schoolRouter.delete('/subjects/:id', route(async (req, res) => {
  if (!guard(req, res, 'academics.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [before] = await execQ(pool, 'SELECT * FROM school_subjects WHERE app_id=$1 AND id=$2', [appId, id]);
  if (!before) return res.status(404).json({ error: 'Subject not found' });
  const [{ n }] = await execQ(pool, `
    SELECT (
      (SELECT count(*) FROM school_subject_allocations WHERE app_id=$1 AND subject_id=$2) +
      (SELECT count(*) FROM school_timetables WHERE app_id=$1 AND subject_id=$2) +
      (SELECT count(*) FROM school_exam_timetable WHERE app_id=$1 AND subject_id=$2) +
      (SELECT count(*) FROM school_homework WHERE app_id=$1 AND subject_id=$2) +
      (SELECT count(*) FROM school_marks WHERE app_id=$1 AND subject_id=$2)
    )::int AS n
  `, [appId, id]);
  if (n > 0) {
    return res.status(409).json({ error: 'This subject is used by timetable, exams, homework or marks; archive it instead of deleting it' });
  }
  await execQ(pool, 'DELETE FROM school_subjects WHERE app_id=$1 AND id=$2', [appId, id]);
  await writeAudit(pool, req, { action: 'subject.delete', entity: 'school_subjects', entityId: id, before });
  res.json({ ok: true });
}));

/* ---------- attendance helpers ---------- */

async function ensureAttendanceSeed(pool, appId) {
  await ensureSeed(pool, appId);
}

function validatePolicyCategory(category) {
  return ['present', 'absent', 'late', 'partial', 'excused', 'activity', 'other'].includes(category);
}

async function resolveAcademicYearForDate(pool, appId, registerDate) {
  const r = await execQ(pool, `
    SELECT id FROM school_academic_years
     WHERE app_id=$1 AND $2 BETWEEN start_date AND end_date
     ORDER BY is_active DESC, start_date DESC LIMIT 1
  `, [appId, registerDate]);
  return r[0]?.id || null;
}

async function validateSectionAndYear(pool, appId, sectionId, yearId) {
  const r = await execQ(pool, `
    SELECT sec.id, sec.class_id, c.name AS class_name, sec.name AS section_name
      FROM school_sections sec
      JOIN school_classes c ON c.id = sec.class_id AND c.app_id = sec.app_id
     WHERE sec.app_id=$1 AND sec.id=$2
  `, [appId, sectionId]);
  if (!r[0]) return null;
  if (yearId && r[0].class_id) {
    const y = await execQ(pool, 'SELECT id FROM school_academic_years WHERE id=$1 AND app_id=$2', [yearId, appId]);
    if (!y[0]) return null;
  }
  return r[0];
}

function dayOf(v) {
  if (v === undefined || v === null || v === '') return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    // pg returns DATE columns as local-midnight Date objects; use local parts so
    // the calendar day is preserved in non-UTC time zones.
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  return String(v).slice(0, 10);
}

/* ---------- roster + premark helpers ---------- */

/* Resolve students enrolled in a section on a specific date, using dated enrollment history.
   Falls back to student's current section_id/class_id when no dated enrollment exists. */
async function resolveRosterForDate(pool, appId, sectionId, registerDate) {
  const rows = await execQ(pool, `
    SELECT s.id, s.admission_no, s.first_name, s.last_name, s.roll_no,
           s.photo_url, s.campus_id,
           COALESCE(en.class_id, s.class_id) AS class_id,
           COALESCE(en.section_id, s.section_id) AS section_id
      FROM school_students s
      LEFT JOIN LATERAL (
        SELECT e.class_id, e.section_id, e.student_id
          FROM school_student_enrollments e
         WHERE e.student_id=s.id AND e.app_id=s.app_id AND e.status='studying'
           AND e.joined_on <= $3::date AND (e.left_on IS NULL OR e.left_on >= $3::date)
         ORDER BY e.joined_on DESC, e.id DESC
         LIMIT 1
      ) en ON true
     WHERE s.app_id=$1 AND s.deleted_at IS NULL
       AND (en.section_id=$2::int OR (
         en.student_id IS NULL AND s.section_id=$2::int AND s.status='active'
       ))
     ORDER BY s.roll_no NULLS LAST, s.first_name
  `, [appId, sectionId, registerDate]);
  return rows;
}

/* Get calendar context (holiday/closure/half_day/event/exam) for a date. */
async function getCalendarContext(pool, appId, registerDate, sectionId) {
  const rows = await execQ(pool, `
    SELECT id, event_date, event_type, label, description, applies_to_all, section_ids
      FROM school_calendar_event
     WHERE app_id=$1 AND event_date=$2
       AND (applies_to_all=true OR ($3::int IS NOT NULL AND section_ids && $4::int[]))
  `, [appId, registerDate, sectionId || null, sectionId ? [sectionId] : null]);
  return rows;
}

/* Get approved student leave covering a date for students in a section. */
async function getApprovedLeaveForDate(pool, appId, sectionId, registerDate) {
  const rows = await execQ(pool, `
    SELECT l.student_id, l.leave_type, l.reason
      FROM school_student_leave l
      JOIN school_students s ON s.app_id=l.app_id AND s.id=l.student_id AND s.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT e.section_id, e.student_id
          FROM school_student_enrollments e
         WHERE e.app_id=l.app_id AND e.student_id=l.student_id AND e.status='studying'
           AND e.joined_on <= $2::date AND (e.left_on IS NULL OR e.left_on >= $2::date)
         ORDER BY e.joined_on DESC, e.id DESC
         LIMIT 1
      ) en ON true
     WHERE l.app_id=$1 AND l.status='approved'
       AND l.start_date <= $2::date AND l.end_date >= $2::date
       AND COALESCE(en.section_id, s.section_id)=$3::int
  `, [appId, registerDate, sectionId]);
  return rows;
}

/* Map calendar event type to attendance policy category + code. */
function calendarToPolicy(eventType) {
  switch (eventType) {
    case 'holiday': return { category: 'excused', code: 'HOLIDAY', countsAsPresent: false };
    case 'closure': return { category: 'excused', code: 'HOLIDAY', countsAsPresent: false };
    case 'half_day': return { category: 'partial', code: 'HALFDAY', countsAsPresent: true };
    case 'event': return { category: 'activity', code: 'EVENT', countsAsPresent: true };
    case 'exam': return { category: 'activity', code: 'EXAM', countsAsPresent: true };
    case 'break': return { category: 'excused', code: 'BREAK', countsAsPresent: false };
    default: return { category: 'excused', code: 'OTHER', countsAsPresent: false };
  }
}

/* Map leave type to attendance policy category + code. */
function leaveToPolicy(leaveType) {
  switch (leaveType) {
    case 'medical': return { category: 'excused', code: 'MEDICAL', countsAsPresent: false };
    case 'personal': return { category: 'excused', code: 'LEAVE', countsAsPresent: false };
    case 'emergency': return { category: 'excused', code: 'LEAVE', countsAsPresent: false };
    case 'family': return { category: 'excused', code: 'LEAVE', countsAsPresent: false };
    case 'other': return { category: 'excused', code: 'LEAVE', countsAsPresent: false };
    default: return { category: 'excused', code: 'LEAVE', countsAsPresent: false };
  }
}

function attendancePolicyForCode(policies, ...codes) {
  for (const code of codes) {
    const policy = policies.find((item) => item.code === code);
    if (policy) return policy;
  }
  return null;
}

function attendancePolicyForCategory(policies, category) {
  return policies.find((item) => item.category === category) || null;
}

/* Queue a notification event via the Communication module (fire-and-forget). */
async function queueNotification(pool, appId, { ruleCode, studentId, channel = 'app', recipient, message, config = {} }) {
  try {
    await execQ(pool, `
      INSERT INTO school_notification_log
        (app_id, rule_code, student_id, channel, recipient, message, status, config)
      VALUES ($1,$2,$3,$4,$5,$6,'queued',$7::jsonb)
    `, [appId, ruleCode, studentId || null, channel, recipient || null, message, JSON.stringify(config || {})]);
  } catch (e) {
    console.error('[attendance notification queue]', e.message);
  }
}

/* Insert an idempotent attendance notification outbox event.
   Uses db.query so it participates in the caller's transaction when db is a client. */
async function enqueueAttendanceOutbox(db, appId, evt) {
  await db.query(`
    INSERT INTO school_attendance_outbox
      (app_id, idempotency_key, event_type, student_id, employee_id, register_id,
       correction_id, recipient, channel, template_code, payload, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,'pending')
    ON CONFLICT (app_id, idempotency_key) DO NOTHING
  `, [appId, evt.idempotencyKey, evt.eventType, evt.studentId || null, evt.employeeId || null,
    evt.registerId || null, evt.correctionId || null, evt.recipient || null,
    evt.channel || 'app', evt.templateCode || null, JSON.stringify(evt.payload || {})]);
}

/* Load attendance settings with safe defaults. */
async function loadAttendanceSettings(db, appId, campusId = null) {
  const r = await db.query(`
    SELECT * FROM school_attendance_settings
     WHERE app_id=$1 AND (campus_id IS NULL OR campus_id=$2::int)
     ORDER BY CASE
                WHEN $2::int IS NULL AND campus_id IS NULL THEN 0
                WHEN campus_id=$2::int THEN 0
                WHEN campus_id IS NULL THEN 1
                ELSE 2
              END
     LIMIT 1
  `, [appId, campusId || null]);
  const rows = r.rows || r;
  return rows[0] || {
    separation_of_duties: true,
    report_cutoff_days: 2,
    min_attendance_percent: 75,
    late_threshold_minutes: 15,
    notify_parents_on: ['absent', 'late'],
    notification_channels: ['app'],
  };
}

/* Resolve the effective shift for an employee on a date (explicit shift wins). */
async function resolveStaffShift(db, appId, attendanceDate, explicitShiftId, campusId = null) {
  if (explicitShiftId) {
    const r = await db.query(`
      SELECT * FROM school_staff_shift
       WHERE app_id=$1 AND id=$2 AND is_active=true
         AND effective_from <= $3::date AND (effective_to IS NULL OR effective_to >= $3::date)
         AND (campus_id IS NULL OR campus_id=$4::int)
    `, [appId, explicitShiftId, attendanceDate, campusId]);
    const rows = r.rows || r;
    if (rows[0]) return rows[0];
  }
  const r = await db.query(`
    SELECT s.* FROM school_staff_shift s
     WHERE s.app_id=$1 AND s.is_active=true
       AND s.effective_from <= $2::date AND (s.effective_to IS NULL OR s.effective_to >= $2::date)
       AND (s.campus_id IS NULL OR s.campus_id=$3::int)
     ORDER BY CASE WHEN s.campus_id=$3::int THEN 0 ELSE 1 END, s.id
     LIMIT 1
  `, [appId, attendanceDate, campusId]);
  const rows = r.rows || r;
  return rows[0] || null;
}

/* Return every ISO date between two dates (inclusive), capped for safety. */
function eachDate(from, to, cap = 180) {
  const out = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  for (let d = start, i = 0; d <= end && i < cap; d = new Date(d.getTime() + 864e5), i++) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/* Which policy code should represent an approved leave type. */
function leavePolicyCode(leaveType) {
  if (leaveType === 'medical') return 'MED';
  return 'LV';
}

/* ---------- attendance policies ---------- */

function attendanceRole(req, ...codes) {
  return (req.school?.roles || []).some((role) => codes.includes(role.code));
}

function isAttendanceTeacher(req) {
  return attendanceRole(req, 'TEACHER', 'CLASS_TEACHER')
    && !attendanceRole(req, 'SUPER_ADMIN', 'OWNER', 'PRINCIPAL', 'ADMIN_OFFICER');
}

async function resolveAttendanceScope(pool, appId, req) {
  const userId = text(req.user?.userid);
  if (attendanceRole(req, 'PARENT', 'STUDENT')) {
    const students = await execQ(pool, `
      SELECT DISTINCT s.id
        FROM school_students s
        LEFT JOIN school_users u
          ON u.app_id=s.app_id
         AND (u.id::text=s.user_id::text OR u.user_id=s.user_id::text)
       WHERE s.app_id=$1 AND s.deleted_at IS NULL
         AND (s.user_id::text=$2 OR u.user_id=$2)
      UNION
      SELECT DISTINCT s.id
        FROM school_students s
        JOIN school_student_guardians sg ON sg.student_id=s.id
        JOIN school_guardians g ON g.id=sg.guardian_id AND g.app_id=s.app_id
        LEFT JOIN school_users u
          ON u.app_id=g.app_id
         AND (u.id::text=g.user_id::text OR u.user_id=g.user_id::text)
       WHERE s.app_id=$1 AND s.deleted_at IS NULL
         AND (g.user_id=$2 OR u.user_id=$2)
    `, [appId, userId]);
    return { kind: 'student', studentIds: students.map((row) => row.id), sectionIds: [] };
  }

  if (isAttendanceTeacher(req)) {
    const employees = await execQ(pool, `
      SELECT id::text AS id
        FROM school_hr_employees
       WHERE app_id=$1 AND user_id=$2 AND coalesce(status,'active')='active'
    `, [appId, userId]);
    const teacherIds = [...new Set([userId, ...employees.map((row) => row.id)])];
    const sections = await execQ(pool, `
      SELECT DISTINCT sec.id
        FROM school_sections sec
       WHERE sec.app_id=$1 AND (
         sec.class_teacher=$2
         OR sec.class_teacher_id::text=ANY($3::text[])
         OR EXISTS (
           SELECT 1 FROM school_subject_allocations a
            WHERE a.app_id=sec.app_id AND a.section_id=sec.id
              AND a.is_active AND a.teacher_id=ANY($3::text[])
         )
       )
    `, [appId, userId, teacherIds]);
    return { kind: 'teacher', studentIds: [], sectionIds: sections.map((row) => row.id) };
  }

  return { kind: 'all', studentIds: [], sectionIds: [] };
}

function attendanceScopeCondition(req, values, column, kind = req.attendanceScope?.kind) {
  const scope = req.attendanceScope;
  if (kind === 'student') {
    values.push(scope.studentIds);
    return `${column}=ANY($${values.length}::int[])`;
  }
  if (kind === 'teacher') {
    values.push(scope.sectionIds);
    return `${column}=ANY($${values.length}::int[])`;
  }
  return null;
}

function attendanceSectionAllowed(req, sectionId) {
  const scope = req.attendanceScope;
  return scope?.kind !== 'teacher' || scope.sectionIds.some((id) => Number(id) === Number(sectionId));
}

function denyStaffAttendanceForNonManagers(req, res) {
  if (req.attendanceScope?.kind === 'teacher' || req.attendanceScope?.kind === 'student') {
    res.status(403).json({ error: 'Staff attendance is restricted to HR and attendance administrators' });
    return true;
  }
  return false;
}

schoolRouter.use('/attendance', (req, res, next) => {
  resolveAttendanceScope(getPool(), appIdOf(req), req)
    .then((scope) => {
      req.attendanceScope = scope;
      const attendancePath = `${req.baseUrl}${req.path}`;
      if (scope.kind === 'student' && scope.studentIds.length === 0) {
        return res.status(403).json({ error: 'No students are linked to this account' });
      }
      if (scope.kind === 'student' && req.method !== 'GET' && req.method !== 'HEAD'
          && !(req.method === 'POST' && attendancePath.endsWith('/attendance/student-leave'))
          && !(req.method === 'PUT' && /\/attendance\/student-leave\/\d+$/.test(attendancePath))) {
        return res.status(403).json({ error: 'Student and parent accounts cannot modify attendance records' });
      }
      if (scope.kind === 'teacher' && req.method !== 'GET' && req.method !== 'HEAD'
          && !/\/attendance\/registers(?:\/|$)/.test(attendancePath)
          && !(req.method === 'POST' && /\/attendance\/corrections(?:\/bulk)?$/.test(attendancePath))) {
        return res.status(403).json({ error: 'Teachers may only manage attendance registers and request attendance corrections' });
      }
      if ((scope.kind === 'teacher' || scope.kind === 'student')
          && /\/attendance\/(?:staff(?:-|\/|$)|reports\/staff(?:-|\/|$)|outbox(?:\/|$))/.test(attendancePath)) {
        return res.status(403).json({ error: 'Staff attendance and notification operations are restricted to administrators' });
      }
      next();
    })
    .catch(next);
});

schoolRouter.get('/attendance/policies', route(async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const rows = await execQ(pool, `
    SELECT id, app_id, code, label, category, is_active, requires_reason,
           counts_as_present, sort_order, created_at, updated_at
      FROM school_attendance_policy
     WHERE app_id=$1
     ORDER BY sort_order, code
  `, [appId]);
  res.json({ ok: true, policies: rows });
}));

schoolRouter.post('/attendance/policies', route(async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const body = req.body || {};
  const code = text(body.code);
  const label = text(body.label);
  const category = text(body.category);
  if (!code || !label || !category) return res.status(400).json({ error: 'code, label and category are required' });
  if (!validatePolicyCategory(category)) return res.status(400).json({ error: 'Invalid category' });
  const markedBy = text(req.user?.userid) || null;
  const row = await execQ(pool, `
    INSERT INTO school_attendance_policy
      (app_id, code, label, category, is_active, requires_reason, counts_as_present, sort_order)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (app_id, code) DO UPDATE SET
      label=excluded.label, category=excluded.category,
      is_active=excluded.is_active, requires_reason=excluded.requires_reason,
      counts_as_present=excluded.counts_as_present, sort_order=excluded.sort_order,
      updated_at=now()
    RETURNING *
  `, [appId, code, label, category,
    body.isActive !== false, body.requiresReason === true,
    body.countsAsPresent !== false, num(body.sortOrder) || 0]);
  await writeAudit(pool, req, { action: 'attendance.policy.upsert', entity: 'school_attendance_policy', entityId: row[0].id, after: row[0] });
  res.json({ ok: true, policy: row[0] });
}));

/* ---------- attendance settings ---------- */

schoolRouter.get('/attendance/settings', route(async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const campusId = num(req.query.campusId);
  const rows = await execQ(pool, `
    SELECT id, app_id, campus_id, default_session_type, late_threshold_minutes,
           partial_threshold_minutes, auto_finalize_at, finalize_days_after,
           require_reason_for, notify_parents_on, notification_channels,
           separation_of_duties, report_cutoff_days, min_attendance_percent,
           created_at, updated_at
      FROM school_attendance_settings
     WHERE app_id=$1 AND ($2::int IS NULL OR campus_id=$2::int)
     ORDER BY campus_id NULLS FIRST
  `, [appId, campusId || null]);
  res.json({ ok: true, settings: rows });
}));

schoolRouter.put('/attendance/settings', route(async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const body = req.body || {};
  const campusId = num(body.campusId);
  const sessionType = text(body.defaultSessionType) || 'daily';
  const lateThreshold = num(body.lateThresholdMinutes) ?? 15;
  const partialThreshold = num(body.partialThresholdMinutes) ?? 120;
  const autoFinalizeAt = dayOf(body.autoFinalizeAt);
  const finalizeDaysAfter = num(body.finalizeDaysAfter) ?? 0;
  const toTextArray = (value, fallback) => {
    if (value === undefined) return fallback;
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) return null;
    return value.map((item) => item.trim());
  };
  const requireReasonFor = toTextArray(body.requireReasonFor, ['absent', 'late', 'excused']);
  const notifyParentsOn = toTextArray(body.notifyParentsOn, ['absent', 'late']);
  const notificationChannels = toTextArray(body.notificationChannels, ['app']);
  if (!requireReasonFor || !notifyParentsOn || !notificationChannels) {
    return res.status(400).json({ error: 'Attendance settings lists must be arrays of non-empty strings' });
  }
  const separationOfDuties = body.separationOfDuties === undefined ? true : Boolean(body.separationOfDuties);
  const reportCutoffDays = num(body.reportCutoffDays) ?? 2;
  const minAttendancePercent = num(body.minAttendancePercent) ?? 75;

  let row;
  if (campusId) {
    /* Per-campus override. The unique index makes this idempotent. */
    row = await execQ(pool, `
      INSERT INTO school_attendance_settings
        (app_id, campus_id, default_session_type, late_threshold_minutes,
         partial_threshold_minutes, auto_finalize_at, finalize_days_after,
         require_reason_for, notify_parents_on, notification_channels,
         separation_of_duties, report_cutoff_days, min_attendance_percent)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (app_id, campus_id) DO UPDATE SET
        default_session_type=excluded.default_session_type,
        late_threshold_minutes=excluded.late_threshold_minutes,
        partial_threshold_minutes=excluded.partial_threshold_minutes,
        auto_finalize_at=excluded.auto_finalize_at,
        finalize_days_after=excluded.finalize_days_after,
        require_reason_for=excluded.require_reason_for,
        notify_parents_on=excluded.notify_parents_on,
        notification_channels=excluded.notification_channels,
        separation_of_duties=excluded.separation_of_duties,
        report_cutoff_days=excluded.report_cutoff_days,
        min_attendance_percent=excluded.min_attendance_percent,
        updated_at=now()
      RETURNING *
    `, [appId, campusId, sessionType, lateThreshold, partialThreshold, autoFinalizeAt,
      finalizeDaysAfter, requireReasonFor, notifyParentsOn, notificationChannels,
      separationOfDuties, reportCutoffDays, minAttendancePercent]);
  } else {
    /* Tenant-wide default row. NULL campus rows do not collide in a unique
       index, so update the oldest one explicitly instead of inserting a copy. */
    const [existing] = await execQ(pool, `
      SELECT id FROM school_attendance_settings
       WHERE app_id=$1 AND campus_id IS NULL ORDER BY id LIMIT 1
    `, [appId]);
    if (existing) {
      row = await execQ(pool, `
        UPDATE school_attendance_settings SET
          default_session_type=$3, late_threshold_minutes=$4,
          partial_threshold_minutes=$5, auto_finalize_at=$6, finalize_days_after=$7,
          require_reason_for=$8, notify_parents_on=$9, notification_channels=$10,
          separation_of_duties=$11, report_cutoff_days=$12, min_attendance_percent=$13,
          updated_at=now()
        WHERE app_id=$1 AND id=$2
        RETURNING *
      `, [appId, existing.id, sessionType, lateThreshold, partialThreshold, autoFinalizeAt,
        finalizeDaysAfter, requireReasonFor, notifyParentsOn, notificationChannels,
        separationOfDuties, reportCutoffDays, minAttendancePercent]);
    } else {
      row = await execQ(pool, `
        INSERT INTO school_attendance_settings
          (app_id, campus_id, default_session_type, late_threshold_minutes,
           partial_threshold_minutes, auto_finalize_at, finalize_days_after,
           require_reason_for, notify_parents_on, notification_channels,
           separation_of_duties, report_cutoff_days, min_attendance_percent)
        VALUES ($1,NULL,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING *
      `, [appId, sessionType, lateThreshold, partialThreshold, autoFinalizeAt,
        finalizeDaysAfter, requireReasonFor, notifyParentsOn, notificationChannels,
        separationOfDuties, reportCutoffDays, minAttendancePercent]);
    }
  }
  await writeAudit(pool, req, { action: 'attendance.settings.update', entity: 'school_attendance_settings', entityId: row[0].id, after: row[0] });
  res.json({ ok: true, settings: row[0] });
}));

/* ---------- calendar events ---------- */

schoolRouter.get('/attendance/calendar', route(async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const from = dayOf(req.query.from) || new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const to = dayOf(req.query.to) || new Date().toISOString().slice(0, 10);
  const rows = await execQ(pool, `
    SELECT id, app_id, campus_id, event_date, event_type, label, description,
           applies_to_all, section_ids, created_by, created_at, updated_at
      FROM school_calendar_event
     WHERE app_id=$1 AND event_date BETWEEN $2 AND $3
     ORDER BY event_date, event_type
  `, [appId, from, to]);
  res.json({ ok: true, calendar: rows, from, to });
}));

schoolRouter.post('/attendance/calendar', route(async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const body = req.body || {};
  const eventDate = dayOf(body.eventDate);
  const eventType = text(body.eventType);
  const label = text(body.label);
  if (!eventDate || !eventType || !label) return res.status(400).json({ error: 'eventDate, eventType and label are required' });
  if (!['holiday', 'closure', 'half_day', 'event', 'exam', 'break'].includes(eventType)) return res.status(400).json({ error: 'Invalid event type' });
  const appliesToAll = body.appliesToAll !== false;
  const sectionIds = body.sectionIds === undefined || body.sectionIds === null
    ? null
    : Array.isArray(body.sectionIds) && body.sectionIds.every((value) => Number.isInteger(Number(value)) && Number(value) > 0)
      ? [...new Set(body.sectionIds.map(Number))]
      : null;
  if (body.sectionIds !== undefined && body.sectionIds !== null && !sectionIds) {
    return res.status(400).json({ error: 'sectionIds must be an array of positive section IDs' });
  }
  if (!appliesToAll && !sectionIds?.length) {
    return res.status(400).json({ error: 'Select at least one section or apply the event to all sections' });
  }
  if (sectionIds?.length) {
    const [validSections] = await execQ(pool, `
      SELECT count(*)::int AS n FROM school_sections
       WHERE app_id=$1 AND id=ANY($2::int[])
    `, [appId, sectionIds]);
    if (validSections.n !== sectionIds.length) return res.status(400).json({ error: 'One or more sections do not belong to this school' });
  }
  const campusId = num(body.campusId) || null;
  if (campusId) {
    const [campus] = await execQ(pool, 'SELECT id FROM school_campuses WHERE app_id=$1 AND id=$2', [appId, campusId]);
    if (!campus) return res.status(400).json({ error: 'Invalid campusId' });
  }
  const row = await execQ(pool, `
    INSERT INTO school_calendar_event
      (app_id, campus_id, event_date, event_type, label, description, applies_to_all, section_ids, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (app_id, event_date, event_type) DO UPDATE SET
      label=excluded.label, description=excluded.description,
      applies_to_all=excluded.applies_to_all, section_ids=excluded.section_ids,
      updated_at=now()
    RETURNING *
  `, [appId, num(body.campusId), eventDate, eventType, label, text(body.description) || null,
    appliesToAll, sectionIds,
    text(req.user?.userid) || null]);
  await writeAudit(pool, req, { action: 'attendance.calendar.upsert', entity: 'school_calendar_event', entityId: row[0].id, after: row[0] });
  res.json({ ok: true, calendar: row[0] });
}));

schoolRouter.delete('/attendance/calendar/:id', route(async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  await execQ(pool, 'DELETE FROM school_calendar_event WHERE app_id=$1 AND id=$2', [appId, id]);
  await writeAudit(pool, req, { action: 'attendance.calendar.delete', entity: 'school_calendar_event', entityId: id });
  res.json({ ok: true });
}));

/* ---------- student leave ---------- */

schoolRouter.get('/attendance/student-leave', route(async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const studentId = num(req.query.studentId);
  const from = dayOf(req.query.from);
  const to = dayOf(req.query.to);
  const where = ['l.app_id=$1'];
  const values = [appId];
  if (studentId) { values.push(studentId); where.push(`l.student_id=$${values.length}`); }
  if (from) { values.push(from); where.push(`l.end_date >= $${values.length}`); }
  if (to) { values.push(to); where.push(`l.start_date <= $${values.length}`); }
  const scope = req.attendanceScope;
  if (scope?.kind === 'student') {
    values.push(scope.studentIds);
    where.push(`l.student_id=ANY($${values.length}::int[])`);
  } else if (scope?.kind === 'teacher') {
    values.push(scope.sectionIds);
    where.push(`EXISTS (
      SELECT 1 FROM school_students s
       WHERE s.app_id=l.app_id AND s.id=l.student_id
         AND (s.section_id=ANY($${values.length}::int[]) OR EXISTS (
           SELECT 1 FROM school_student_enrollments en
            WHERE en.app_id=s.app_id AND en.student_id=s.id AND en.section_id=ANY($${values.length}::int[])
         ))
    )`);
  }
  const rows = await execQ(pool, `
    SELECT l.id, l.student_id, l.leave_type, l.start_date, l.end_date, l.reason,
           l.status, l.approved_by, l.approved_at, l.rejection_reason,
           l.supporting_doc, l.created_by, l.created_at, l.updated_at,
           s.admission_no, s.first_name, s.last_name
      FROM school_student_leave l
      JOIN school_students s ON s.id = l.student_id AND s.app_id = l.app_id
     WHERE ${where.join(' AND ')}
     ORDER BY l.start_date DESC, l.id DESC
  `, values);
  res.json({ ok: true, leave: rows });
}));

schoolRouter.post('/attendance/student-leave', route(async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const body = req.body || {};
  const studentId = num(body.studentId);
  const leaveType = text(body.leaveType);
  const startDate = dayOf(body.startDate);
  const endDate = dayOf(body.endDate);
  const reason = text(body.reason);
  if (!studentId || !leaveType || !startDate || !endDate) return res.status(400).json({ error: 'studentId, leaveType, startDate and endDate are required' });
  if (req.attendanceScope?.kind === 'student'
      && !req.attendanceScope.studentIds.some((linkedId) => Number(linkedId) === studentId)) {
    return res.status(404).json({ error: 'Student not found' });
  }
  if (!validDay(startDate) || !validDay(endDate) || endDate < startDate) {
    return res.status(400).json({ error: 'Provide valid dates and ensure endDate is on or after startDate' });
  }
  if (daySpan(startDate, endDate) > 180) return res.status(400).json({ error: 'A leave request cannot exceed 180 days' });
  if (endDate < startDate) return res.status(400).json({ error: 'endDate must be on or after startDate' });
  if (!['medical', 'personal', 'emergency', 'family', 'other'].includes(leaveType)) return res.status(400).json({ error: 'Invalid leave type' });
  const [student] = await execQ(pool, 'SELECT id FROM school_students WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, studentId]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const row = await execQ(pool, `
    INSERT INTO school_student_leave
      (app_id, student_id, leave_type, start_date, end_date, reason, status, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,'pending',$7)
    RETURNING *
  `, [appId, studentId, leaveType, startDate, endDate, reason || null, text(req.user?.userid) || null]);
  await writeAudit(pool, req, { action: 'attendance.student_leave.create', entity: 'school_student_leave', entityId: row[0].id, after: row[0] });
  res.json({ ok: true, leave: row[0] });
}));

schoolRouter.put('/attendance/student-leave/:id', route(async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const body = req.body || {};
  const actor = text(req.user?.userid) || null;
  const status = text(body.status) || (body.approved ? 'approved' : '');
  if (!['approved', 'rejected', 'cancelled'].includes(status)) return res.status(400).json({ error: 'status must be approved, rejected or cancelled' });
  if (req.attendanceScope?.kind === 'student' && status !== 'cancelled') {
    return res.status(403).json({ error: 'Student and parent accounts may only cancel their own pending leave requests' });
  }
  if (status === 'rejected' && !text(body.rejectionReason)) return res.status(400).json({ error: 'Rejection reason is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query('SELECT * FROM school_student_leave WHERE app_id=$1 AND id=$2 FOR UPDATE', [appId, id]);
    const leave = cur.rows[0];
    if (!leave) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Leave request not found' }); }
    if (req.attendanceScope?.kind === 'student'
        && !req.attendanceScope.studentIds.some((studentId) => Number(studentId) === Number(leave.student_id))) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Leave request not found' });
    }
    if (req.attendanceScope?.kind === 'student' && leave.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Only pending leave requests can be cancelled' });
    }
    if (status === 'approved' && daySpan(dayOf(leave.start_date), dayOf(leave.end_date)) > 180) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This leave period exceeds the supported 180-day attendance processing window' });
    }

    const updated = await client.query(`
      UPDATE school_student_leave
         SET status=$3, approved_by=$4, approved_at=$5, rejection_reason=$6, updated_at=now()
       WHERE app_id=$1 AND id=$2
       RETURNING *
    `, [appId, id, status, status === 'approved' ? (actor || 'system') : null,
      status === 'approved' ? new Date().toISOString() : null, text(body.rejectionReason) || null]);
    const leaveRow = updated.rows[0];

    let correctionsCreated = 0;
    let premarked = 0;

    /* Approving leave adjusts already-recorded attendance through corrections,
       never by rewriting submitted/finalized entries in place. */
    if (status === 'approved' && leave.status !== 'approved') {
      const enr = await client.query(`
        SELECT section_id FROM school_student_enrollments
         WHERE app_id=$1 AND student_id=$2 AND status='studying'
           AND start_date <= $3::date AND (end_date IS NULL OR end_date >= $3::date)
         ORDER BY start_date DESC LIMIT 1
      `, [appId, leave.student_id, dayOf(leave.start_date)]);
      let sectionId = enr.rows[0]?.section_id || null;
      if (!sectionId) {
        const st = await client.query('SELECT section_id FROM school_students WHERE app_id=$1 AND id=$2', [appId, leave.student_id]);
        sectionId = st.rows[0]?.section_id || null;
      }

      const pol = await client.query(
        'SELECT id, category FROM school_attendance_policy WHERE app_id=$1 AND code=$2 AND is_active=true LIMIT 1',
        [appId, leavePolicyCode(leave.leave_type)]
      );
      const leavePolicy = pol.rows[0] || (await client.query(
        "SELECT id, category FROM school_attendance_policy WHERE app_id=$1 AND category='excused' AND is_active=true ORDER BY sort_order LIMIT 1",
        [appId]
      )).rows[0];

      const settings = await loadAttendanceSettings(client, appId);
      const cutoffDays = Number(settings.report_cutoff_days ?? 2);

      if (sectionId && leavePolicy) {
        const dates = eachDate(dayOf(leave.start_date), dayOf(leave.end_date));
        for (const d of dates) {
          const regs = await client.query(`
            SELECT id, state, register_date, finalized_at
              FROM school_attendance_register
             WHERE app_id=$1 AND section_id=$2 AND register_date=$3::date AND state <> 'cancelled'
             FOR UPDATE
          `, [appId, sectionId, d]);
          for (const reg of regs.rows) {
            const existing = await client.query(
              'SELECT * FROM school_attendance_entry WHERE register_id=$1 AND student_id=$2',
              [reg.id, leave.student_id]
            );
            const entry = existing.rows[0];
            if (reg.state === 'draft') {
              if (entry) {
                if (entry.policy_id !== leavePolicy.id) {
                  await client.query(`
                    UPDATE school_attendance_entry
                       SET policy_id=$3, remark=$4, source='system_premark', marked_by=$5, marked_at=now(), updated_at=now()
                     WHERE id=$1 AND app_id=$2
                  `, [entry.id, appId, leavePolicy.id, `Approved ${leave.leave_type} leave`, actor]);
                  premarked++;
                }
              } else {
                await client.query(`
                  INSERT INTO school_attendance_entry
                    (app_id, register_id, student_id, policy_id, remark, marked_by, source)
                  VALUES ($1,$2,$3,$4,$5,$6,'system_premark')
                `, [appId, reg.id, leave.student_id, leavePolicy.id, `Approved ${leave.leave_type} leave`, actor]);
                premarked++;
              }
            } else if (entry && entry.policy_id !== leavePolicy.id) {
              const ageDays = Math.floor((Date.now() - new Date(reg.register_date).getTime()) / 864e5);
              await client.query(`
                INSERT INTO school_attendance_correction
                  (app_id, entry_id, register_id, student_id, old_policy_id, new_policy_id,
                   old_remark, new_remark, reason, requested_by, after_cutoff, source)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'leave_approval')
              `, [appId, entry.id, reg.id, leave.student_id, entry.policy_id, leavePolicy.id,
                entry.remark, `Approved ${leave.leave_type} leave`, `Leave #${leave.id} approved`, actor || 'system',
                ageDays > cutoffDays]);
              correctionsCreated++;
            }
          }
        }
      }
    }

    /* Decision notification is queued, never sent synchronously. */
    await enqueueAttendanceOutbox(client, appId, {
      idempotencyKey: `leave:${id}:${status}`,
      eventType: `leave.${status}`,
      studentId: leave.student_id,
      channel: 'app',
      templateCode: 'LEAVE_DECISION',
      payload: { leaveId: id, status, reason: text(body.rejectionReason) || null },
    });

    await writeAudit(pool, req, {
      action: 'attendance.student_leave.update', entity: 'school_student_leave', entityId: id,
      after: { ...leaveRow, correctionsCreated, premarked },
    });
    await client.query('COMMIT');
    res.json({ ok: true, leave: leaveRow, correctionsCreated, premarked });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Register already exists for this section/date' });
    }
    throw e;
  } finally {
    client.release();
  }
}));

/* ---------- registers ---------- */

schoolRouter.get('/attendance/registers', route(async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const date = dayOf(req.query.date);
  const sectionId = num(req.query.sectionId);
  const state = text(req.query.state);
  const where = ['r.app_id=$1'];
  const values = [appId];
  let studentEntryScope = null;
  if (date) { values.push(date); where.push(`r.register_date=$${values.length}`); }
  if (sectionId) { values.push(sectionId); where.push(`r.section_id=$${values.length}`); }
  if (state) { values.push(state); where.push(`r.state=$${values.length}`); }
  const scope = req.attendanceScope;
  if (scope?.kind === 'teacher') {
    values.push(scope.sectionIds);
    where.push(`r.section_id=ANY($${values.length}::int[])`);
  } else if (scope?.kind === 'student') {
    values.push(scope.studentIds);
    studentEntryScope = values.length;
    where.push(`EXISTS (
      SELECT 1 FROM school_attendance_entry e
       WHERE e.app_id=r.app_id AND e.register_id=r.id AND e.student_id=ANY($${values.length}::int[])
    )`);
  }
  const entryCountFilter = studentEntryScope === null
    ? 'TRUE'
    : `e.student_id=ANY($${studentEntryScope}::int[])`;
  const rows = await execQ(pool, `
    SELECT r.id, r.app_id, r.academic_year_id, r.campus_id, r.section_id, r.session_id,
           r.register_date, r.state, r.version, r.created_by, r.submitted_by, r.finalized_by,
           r.submitted_at, r.finalized_at, r.cancelled_at, r.created_at, r.updated_at,
           c.name AS class_name, sec.name AS section_name,
           ay.name AS academic_year,
           (SELECT count(*) FROM school_attendance_entry e WHERE e.register_id=r.id
              AND ${entryCountFilter})::int AS entry_count
      FROM school_attendance_register r
      LEFT JOIN school_classes c ON c.id = (SELECT class_id FROM school_sections WHERE id=r.section_id)
      LEFT JOIN school_sections sec ON sec.id = r.section_id
      LEFT JOIN school_academic_years ay ON ay.id = r.academic_year_id
     WHERE ${where.join(' AND ')}
     ORDER BY r.register_date DESC, sec.name, r.id DESC
  `, values);
  res.json({ ok: true, registers: rows });
}));

schoolRouter.post('/attendance/registers', route(async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const body = req.body || {};
  const registerDate = dayOf(body.date);
  const sectionId = num(body.sectionId);
  const sessionId = num(body.sessionId) || null;
  if (!registerDate) return res.status(400).json({ error: 'date is required' });
  if (!sectionId) return res.status(400).json({ error: 'sectionId is required' });

  /* Verify the date is an instructional day */
  const calendar = await execQ(pool, `
    SELECT event_type, label FROM school_calendar_event
     WHERE app_id=$1 AND event_date=$2 AND applies_to_all=true
  `, [appId, registerDate]);
  const holidayRow = calendar.find((x) => x.event_type === 'holiday' || x.event_type === 'closure');
  if (holidayRow) {
    return res.status(409).json({ error: `Not an instructional day: ${holidayRow.label}`, registerDate });
  }

  const yearId = await resolveAcademicYearForDate(pool, appId, registerDate);
  if (!yearId) return res.status(400).json({ error: 'No active academic year for this date' });
  const section = await validateSectionAndYear(pool, appId, sectionId, yearId);
  if (!section) return res.status(400).json({ error: 'Invalid section' });
  if (!attendanceSectionAllowed(req, sectionId)) return res.status(403).json({ error: 'You can only mark attendance for your assigned sections' });

  const markedBy = text(req.user?.userid) || null;
  const registerCampusId = await resolveCampusId(pool, appId, req.school?.defaultCampusId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(`
      SELECT id, state, version FROM school_attendance_register
       WHERE app_id=$1 AND academic_year_id=$2 AND section_id=$3 AND register_date=$4 AND COALESCE(session_id,0)=COALESCE($5,0)
    `, [appId, yearId, sectionId, registerDate, sessionId]);
    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Register already exists for this section/date', registerId: existing.rows[0].id, state: existing.rows[0].state });
    }
    const inserted = await client.query(`
      INSERT INTO school_attendance_register
        (app_id, academic_year_id, campus_id, section_id, session_id, register_date, state, version, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,'draft',1,$7)
        RETURNING *
    `, [appId, yearId, registerCampusId, sectionId, sessionId, registerDate, markedBy]);
    const register = inserted.rows[0];

    /* Resolve roster using dated enrollment history */
    const roster = await resolveRosterForDate(client, appId, sectionId, registerDate);

    /* Get calendar context (holiday, closure, event, exam, half_day) */
    const calendarEvents = await getCalendarContext(client, appId, registerDate, sectionId);
    const isHolidayOrClosure = calendarEvents.some((x) => x.event_type === 'holiday' || x.event_type === 'closure');

    /* Get approved leave covering this date for students in this section */
    const approvedLeave = await getApprovedLeaveForDate(client, appId, sectionId, registerDate);
    const leaveByStudent = {};
    approvedLeave.forEach((l) => { leaveByStudent[l.student_id] = l; });

    /* Load all active policies for lookup */
    const policyResult = await client.query('SELECT id, code, category, counts_as_present FROM school_attendance_policy WHERE app_id=$1 AND is_active=true', [appId]);
    const policies = policyResult.rows;
    const hasEvent = calendarEvents.some((x) => x.event_type === 'event' || x.event_type === 'exam');
    const hasHalfDay = calendarEvents.some((x) => x.event_type === 'half_day');
    const hasBreak = calendarEvents.some((x) => x.event_type === 'break');

    /* Pre-mark entries using the seeded policy codes, with category fallbacks. */
    const premarkedStudentIds = new Set();
    for (const student of roster) {
      let policy = null;

      if (isHolidayOrClosure) {
        policy = attendancePolicyForCode(policies, 'HOLIDAY', 'E')
          || attendancePolicyForCategory(policies, 'excused');
      } else if (leaveByStudent[student.id]) {
        policy = attendancePolicyForCode(policies, leavePolicyCode(leaveByStudent[student.id].leave_type), 'E')
          || attendancePolicyForCategory(policies, 'excused');
      } else if (hasHalfDay) {
        policy = attendancePolicyForCode(policies, 'HALFDAY', 'HD', 'EA')
          || attendancePolicyForCategory(policies, 'partial');
      } else if (hasEvent) {
        policy = attendancePolicyForCode(policies, 'EVENT', 'EVT', 'SA')
          || attendancePolicyForCategory(policies, 'activity');
      } else if (hasBreak) {
        policy = attendancePolicyForCode(policies, 'BREAK', 'E')
          || attendancePolicyForCategory(policies, 'excused');
      }

      if (policy) {
        premarkedStudentIds.add(student.id);
        await client.query(`
          INSERT INTO school_attendance_entry
            (app_id, register_id, student_id, policy_id, late_minutes, partial_minutes, remark, marked_by, source)
            VALUES ($1,$2,$3,$4,0,0,$5,$6,'system_premark')
          ON CONFLICT (register_id, student_id) DO NOTHING
        `, [appId, register.id, student.id, policy.id,
          isHolidayOrClosure ? `${calendarEvents.find((x) => x.event_type === 'holiday' || x.event_type === 'closure')?.label || 'Holiday/Closure'}` :
          leaveByStudent[student.id] ? `Approved ${leaveByStudent[student.id].leave_type} leave` :
          hasHalfDay ? `Half day: ${calendarEvents.find((x) => x.event_type === 'half_day')?.label || 'Half day'}` :
          hasEvent ? `Event: ${calendarEvents.find((x) => x.event_type === 'event' || x.event_type === 'exam')?.label || 'Event'}` :
          `Break: ${calendarEvents.find((x) => x.event_type === 'break')?.label || 'Break'}`,
          markedBy]);
      }
    }

    await writeAudit(pool, req, { action: 'attendance.register.create', entity: 'school_attendance_register', entityId: register.id, after: register });
    await client.query('COMMIT');

    res.json({ ok: true, register, instructional: !isHolidayOrClosure, premarkedCount: premarkedStudentIds.size, rosterCount: roster.length });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}));

schoolRouter.get('/attendance/registers/:id', route(async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [reg] = await execQ(pool, `
    SELECT r.id, r.app_id, r.academic_year_id, r.campus_id, r.section_id, r.session_id,
           r.register_date, r.state, r.version, r.created_by, r.submitted_by, r.finalized_by,
           r.submitted_at, r.finalized_at, r.cancelled_at, r.created_at, r.updated_at,
           c.name AS class_name, sec.name AS section_name, ay.name AS academic_year
      FROM school_attendance_register r
      LEFT JOIN school_classes c ON c.id = (SELECT class_id FROM school_sections WHERE id=r.section_id)
      LEFT JOIN school_sections sec ON sec.id = r.section_id
      LEFT JOIN school_academic_years ay ON ay.id = r.academic_year_id
     WHERE r.app_id=$1 AND r.id=$2
  `, [appId, id]);
  if (!reg) return res.status(404).json({ error: 'Register not found' });
  if (!attendanceSectionAllowed(req, reg.section_id)) return res.status(404).json({ error: 'Register not found' });

  /* Resolve the enrolled roster for this register date using dated enrollment history */
  let roster = await resolveRosterForDate(pool, appId, reg.section_id, reg.register_date);
  if (req.attendanceScope?.kind === 'student') {
    const allowed = new Set(req.attendanceScope.studentIds.map(Number));
    roster = roster.filter((student) => allowed.has(Number(student.id)));
    if (!roster.length) return res.status(404).json({ error: 'Register not found' });
  }

  /* Get existing entries */
  const entries = await execQ(pool, `
    SELECT e.id, e.register_id, e.student_id, e.policy_id, p.code AS status_code,
           p.label AS status_label, p.category AS status_category, p.counts_as_present,
           e.late_minutes, e.partial_minutes, e.remark, e.marked_by, e.marked_at, e.source,
           s.admission_no, s.first_name, s.last_name, s.roll_no, s.photo_url
      FROM school_attendance_entry e
      JOIN school_students s ON s.id = e.student_id AND s.app_id = e.app_id
      JOIN school_attendance_policy p ON p.id = e.policy_id AND p.app_id = e.app_id
     WHERE e.app_id=$1 AND e.register_id=$2
       AND ($3::int[] IS NULL OR e.student_id=ANY($3::int[]))
     ORDER BY s.roll_no NULLS LAST, s.first_name
  `, [appId, id, req.attendanceScope?.kind === 'student' ? req.attendanceScope.studentIds : null]);

  const entryByStudent = {};
  entries.forEach((e) => { entryByStudent[e.student_id] = e; });

  /* Build full roster: marked students + unmarked students */
  const fullRoster = roster.map((s) => {
    const e = entryByStudent[s.id];
    if (e) return { ...e, is_marked: true };
    return {
      id: s.id,
      student_id: s.id,
      admission_no: s.admission_no,
      first_name: s.first_name,
      last_name: s.last_name,
      roll_no: s.roll_no,
      photo_url: s.photo_url,
      status_code: null,
      status_label: null,
      status_category: null,
      counts_as_present: null,
      late_minutes: 0,
      partial_minutes: 0,
      remark: null,
      marked_by: null,
      marked_at: null,
      source: null,
      is_marked: false,
    };
  });

  const markedCount = fullRoster.filter((r) => r.is_marked).length;
  const premarkedCount = fullRoster.filter((r) => r.source === 'system_premark').length;

  res.json({ ok: true, register: reg, entries: fullRoster, counts: { total: fullRoster.length, marked: markedCount, unmarked: fullRoster.length - markedCount, premarked: premarkedCount } });
}));

schoolRouter.post('/attendance/registers/:id/entries', route(async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const body = req.body || {};
  const entries = Array.isArray(body.entries) ? body.entries : [];
  const expectedVersion = num(body.version) || null;
  if (!entries.length) return res.status(400).json({ error: 'No entries supplied' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const regResult = await client.query('SELECT * FROM school_attendance_register WHERE app_id=$1 AND id=$2 FOR UPDATE', [appId, id]);
    const reg = regResult.rows[0];
    if (!reg) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Register not found' }); }
    if (!attendanceSectionAllowed(req, reg.section_id)) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'You can only mark attendance for your assigned sections' }); }
    if (reg.state !== 'draft') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Register is not in draft state', state: reg.state }); }
    if (expectedVersion !== null && reg.version !== expectedVersion) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Version conflict - register was modified by another user', currentVersion: reg.version });
    }

    /* Validate all entries first */
    const errors = [];
    const validEntries = [];
    const roster = await resolveRosterForDate(client, appId, reg.section_id, dayOf(reg.register_date));
    const rosterIds = new Set(roster.map((student) => student.id));
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const studentId = num(e.studentId ?? e.student_id);
      if (!studentId) { errors.push({ index: i, error: 'studentId is required' }); continue; }
      if (!rosterIds.has(studentId)) { errors.push({ index: i, error: 'Student is not enrolled in this section on the register date', studentId }); continue; }
      const policyCode = text(e.statusCode ?? e.status ?? 'P');
      const policyResult = await client.query('SELECT id, category, requires_reason, counts_as_present FROM school_attendance_policy WHERE app_id=$1 AND code=$2 AND is_active=true', [appId, policyCode]);
      const policy = policyResult.rows[0];
      if (!policy) { errors.push({ index: i, error: `Invalid or inactive status code: ${policyCode}`, studentId }); continue; }
      if (policy.requires_reason && !text(e.reason) && !text(e.remark)) {
        errors.push({ index: i, error: `Reason required for ${policyCode}`, studentId });
        continue;
      }
      const lateMinutes = num(e.lateMinutes ?? e.late_minutes) ?? 0;
      const partialMinutes = num(e.partialMinutes ?? e.partial_minutes) ?? 0;
      if (!Number.isInteger(lateMinutes) || lateMinutes < 0 || !Number.isInteger(partialMinutes) || partialMinutes < 0) {
        errors.push({ index: i, error: 'Late and partial minutes must be non-negative whole numbers', studentId });
        continue;
      }
      validEntries.push({ studentId, policyId: policy.id, lateMinutes, partialMinutes,
        remark: text(e.remark ?? e.reason) || null });
    }
    if (errors.length) { await client.query('ROLLBACK'); return res.status(422).json({ ok: false, errors, saved: 0 }); }

    const markedBy = text(req.user?.userid) || null;
    for (const e of validEntries) {
      await client.query(`
        INSERT INTO school_attendance_entry
          (app_id, register_id, student_id, policy_id, late_minutes, partial_minutes, remark, marked_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (register_id, student_id) DO UPDATE SET
          policy_id=excluded.policy_id, late_minutes=excluded.late_minutes,
          partial_minutes=excluded.partial_minutes, remark=excluded.remark,
          marked_by=excluded.marked_by, marked_at=now(), updated_at=now()
      `, [appId, id, e.studentId, e.policyId, e.lateMinutes, e.partialMinutes, e.remark, markedBy]);
    }
    const updatedRegister = await client.query(`
      UPDATE school_attendance_register
         SET version=version+1, updated_at=now()
       WHERE app_id=$1 AND id=$2
       RETURNING version
    `, [appId, id]);
    const savedCount = await client.query('SELECT count(*)::int AS n FROM school_attendance_entry WHERE app_id=$1 AND register_id=$2', [appId, id]);
    await writeAudit(pool, req, { action: 'attendance.register.entries.save', entity: 'school_attendance_register', entityId: id, after: { entryCount: validEntries.length } });
    await client.query('COMMIT');
    res.json({ ok: true, saved: validEntries.length, registerId: id, version: updatedRegister.rows[0].version, totalEntries: savedCount.rows[0].n });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}));

schoolRouter.post('/attendance/registers/:id/submit', route(async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const body = req.body || {};
  const expectedVersion = num(body.version) || null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const regResult = await client.query('SELECT * FROM school_attendance_register WHERE app_id=$1 AND id=$2 FOR UPDATE', [appId, id]);
    const reg = regResult.rows[0];
    if (!reg) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Register not found' }); }
    if (!attendanceSectionAllowed(req, reg.section_id)) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'You can only submit attendance for your assigned sections' }); }
    if (reg.state !== 'draft') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Register is not in draft state', state: reg.state }); }
    if (expectedVersion !== null && reg.version !== expectedVersion) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Version conflict', currentVersion: reg.version });
    }
    const roster = await resolveRosterForDate(client, appId, reg.section_id, dayOf(reg.register_date));
    if (!roster.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot submit a register with an empty roster' });
    }
    const entryCount = await client.query(`
      SELECT count(DISTINCT e.student_id)::int AS marked
        FROM school_attendance_entry e
        JOIN school_students s ON s.id=e.student_id AND s.app_id=e.app_id
       WHERE e.app_id=$1 AND e.register_id=$2
         AND e.student_id=ANY($3::int[])
    `, [appId, id, roster.map((student) => student.id)]);
    if (entryCount.rows[0].marked < roster.length) {
      await client.query('ROLLBACK');
      return res.status(422).json({
        error: 'Every student on the register roster must have an attendance status before submission',
        marked: entryCount.rows[0].marked,
        total: roster.length,
        unmarked: roster.length - entryCount.rows[0].marked,
      });
    }
    const submitted = await client.query(`
      UPDATE school_attendance_register
         SET state='submitted', version=version+1, submitted_by=$3,
             submitted_at=now(), updated_at=now()
       WHERE app_id=$1 AND id=$2
       RETURNING version
    `, [appId, id, text(req.user?.userid) || null]);

    /* Queue parent notifications transactionally via the outbox.
       Marking never blocks on provider delivery. */
    const settings = await loadAttendanceSettings(client, appId, reg.campus_id);
    const notifyCategories = Array.isArray(settings.notify_parents_on) ? settings.notify_parents_on : ['absent', 'late'];
    const channels = Array.isArray(settings.notification_channels) && settings.notification_channels.length
      ? settings.notification_channels : ['app'];
    const flagged = await client.query(`
      SELECT e.student_id, p.category, st.first_name, st.last_name, st.guardian_name,
             st.guardian_phone, st.guardian_email
        FROM school_attendance_entry e
        JOIN school_attendance_policy p ON p.id = e.policy_id AND p.app_id = e.app_id
        JOIN school_students st ON st.id = e.student_id AND st.app_id = e.app_id
       WHERE e.app_id=$1 AND e.register_id=$2
    `, [appId, id]);
    let notificationsQueued = 0;
    for (const row of flagged.rows) {
      if (!notifyCategories.includes(row.category)) continue;
      for (const channel of channels) {
        const recipient = channel === 'email' ? row.guardian_email : row.guardian_phone;
        await enqueueAttendanceOutbox(client, appId, {
          idempotencyKey: `attendance:${id}:${row.student_id}:${channel}`,
          eventType: `attendance.${row.category}`,
          studentId: row.student_id,
          registerId: id,
          recipient,
          channel,
          templateCode: 'ATTENDANCE_STATUS',
          payload: {
            student: `${row.first_name} ${row.last_name || ''}`.trim(),
            guardian: row.guardian_name || 'Parent',
            category: row.category,
            date: dayOf(reg.register_date),
          },
        });
        notificationsQueued++;
      }
    }

    await writeAudit(pool, req, { action: 'attendance.register.submit', entity: 'school_attendance_register', entityId: id, after: { state: 'submitted', version: submitted.rows[0].version, notificationsQueued } });
    await client.query('COMMIT');
    res.json({ ok: true, registerId: id, state: 'submitted', version: submitted.rows[0].version, notificationsQueued });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}));

schoolRouter.post('/attendance/registers/:id/finalize', route(async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const expectedVersion = num(req.body?.version) || null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const regResult = await client.query('SELECT * FROM school_attendance_register WHERE app_id=$1 AND id=$2 FOR UPDATE', [appId, id]);
    const reg = regResult.rows[0];
    if (!reg) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Register not found' }); }
    if (!attendanceSectionAllowed(req, reg.section_id)) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'You can only finalize attendance for your assigned sections' }); }
    if (reg.state !== 'submitted') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Only a submitted register can be finalized', state: reg.state }); }
    if (expectedVersion !== null && reg.version !== expectedVersion) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Version conflict', currentVersion: reg.version });
    }
    const finalized = await client.query(`
      UPDATE school_attendance_register
         SET state='finalized', version=version+1, finalized_by=$3,
             finalized_at=now(), updated_at=now()
       WHERE app_id=$1 AND id=$2 AND state='submitted'
       RETURNING version
    `, [appId, id, text(req.user?.userid) || null]);
    await writeAudit(pool, req, { action: 'attendance.register.finalize', entity: 'school_attendance_register', entityId: id, after: { state: 'finalized', version: finalized.rows[0].version } });
    await client.query('COMMIT');
    res.json({ ok: true, registerId: id, state: 'finalized', version: finalized.rows[0].version });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}));

schoolRouter.post('/attendance/registers/:id/reopen', route(async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const body = req.body || {};
  const reason = text(body.reason);
  if (!reason) return res.status(400).json({ error: 'reason is required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const regResult = await client.query('SELECT * FROM school_attendance_register WHERE app_id=$1 AND id=$2 FOR UPDATE', [appId, id]);
    const reg = regResult.rows[0];
    if (!reg) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Register not found' }); }
    if (!attendanceSectionAllowed(req, reg.section_id)) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'You can only reopen attendance for your assigned sections' }); }
    if (reg.state !== 'finalized' && reg.state !== 'submitted') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Cannot reopen register in state: ' + reg.state }); }
    await client.query(`
      UPDATE school_attendance_register SET state='draft', version=version+1, updated_at=now()
      WHERE app_id=$1 AND id=$2 RETURNING *
    `, [appId, id]);
    await writeAudit(pool, req, { action: 'attendance.register.reopen', entity: 'school_attendance_register', entityId: id, after: { reason, state: 'draft' } });
    await client.query('COMMIT');
    res.json({ ok: true, registerId: id, state: 'draft', version: reg.version + 1 });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}));

/* ---------- corrections ---------- */

schoolRouter.get('/attendance/corrections', route(async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const registerId = num(req.query.registerId);
  const studentId = num(req.query.studentId);
  const decision = text(req.query.decision);
  const where = ['c.app_id=$1'];
  const values = [appId];
  if (registerId) { values.push(registerId); where.push(`c.register_id=$${values.length}`); }
  if (studentId) { values.push(studentId); where.push(`c.student_id=$${values.length}`); }
  if (decision) { values.push(decision); where.push(`c.decision=$${values.length}`); }
  const scope = req.attendanceScope;
  if (scope?.kind === 'student') {
    values.push(scope.studentIds);
    where.push(`c.student_id=ANY($${values.length}::int[])`);
  } else if (scope?.kind === 'teacher') {
    values.push(scope.sectionIds);
    where.push(`r.section_id=ANY($${values.length}::int[])`);
  }
  const rows = await execQ(pool, `
    SELECT c.id, c.entry_id, c.register_id, c.student_id, c.old_policy_id, c.new_policy_id,
           c.old_late_minutes, c.new_late_minutes, c.old_partial_minutes, c.new_partial_minutes,
           c.old_remark, c.new_remark, c.reason, c.requested_by, c.requested_at,
           c.reviewed_by, c.reviewed_at, c.decision, c.decision_reason, c.processed_at,
           c.after_cutoff, c.source, c.batch_id,
           s.admission_no, s.first_name, s.last_name,
           r.register_date, r.section_id,
           po.code AS old_code, po.label AS old_label,
           pn.code AS new_code, pn.label AS new_label
      FROM school_attendance_correction c
      JOIN school_students s ON s.id = c.student_id AND s.app_id = c.app_id
      LEFT JOIN school_attendance_register r ON r.id = c.register_id AND r.app_id = c.app_id
      LEFT JOIN school_attendance_policy po ON po.id = c.old_policy_id AND po.app_id = c.app_id
      LEFT JOIN school_attendance_policy pn ON pn.id = c.new_policy_id AND pn.app_id = c.app_id
     WHERE ${where.join(' AND ')}
     ORDER BY c.requested_at DESC
  `, values);
  res.json({ ok: true, corrections: rows });
}));

schoolRouter.post('/attendance/corrections', route(async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const body = req.body || {};
  const entryId = num(body.entryId);
  const registerId = num(body.registerId);
  const studentId = num(body.studentId);
  const newPolicyId = num(body.newPolicyId);
  const reason = text(body.reason);
  if (!entryId || !registerId || !studentId || !newPolicyId || !reason) return res.status(400).json({ error: 'entryId, registerId, studentId, newPolicyId and reason are required' });
  const [entry] = await execQ(pool, `
    SELECT e.*, r.section_id, r.register_date FROM school_attendance_entry e
    JOIN school_attendance_register r ON r.app_id=e.app_id AND r.id=e.register_id
     WHERE e.id=$1 AND e.app_id=$2 AND e.register_id=$3 AND e.student_id=$4
       AND r.state IN ('submitted','finalized')
  `, [entryId, appId, registerId, studentId]);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  if (!attendanceSectionAllowed(req, entry.section_id)) return res.status(404).json({ error: 'Entry not found' });
  const [policy] = await execQ(pool, 'SELECT id FROM school_attendance_policy WHERE app_id=$1 AND id=$2 AND is_active=true', [appId, newPolicyId]);
  if (!policy) return res.status(400).json({ error: 'Invalid or inactive newPolicyId' });
  const settings = await loadAttendanceSettings(pool, appId);
  const cutoffDays = Number(settings.report_cutoff_days ?? 2);
  const ageDays = Math.floor((Date.now() - new Date(dayOf(entry.register_date) + 'T00:00:00Z').getTime()) / 864e5);
  const afterCutoff = ageDays > cutoffDays;
  const row = await execQ(pool, `
    INSERT INTO school_attendance_correction
      (app_id, entry_id, register_id, student_id, old_policy_id, new_policy_id,
       old_late_minutes, new_late_minutes, old_partial_minutes, new_partial_minutes,
       old_remark, new_remark, reason, requested_by, after_cutoff, source)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'manual')
    RETURNING *
  `, [appId, entryId, registerId, studentId, entry.policy_id, newPolicyId,
    entry.late_minutes, num(body.newLateMinutes) ?? null,
    entry.partial_minutes, num(body.newPartialMinutes) ?? null,
    entry.remark, text(body.newRemark) || null, reason, text(req.user?.userid) || null, afterCutoff]);
  await writeAudit(pool, req, { action: 'attendance.correction.request', entity: 'school_attendance_correction', entityId: row[0].id, after: row[0] });
  res.json({ ok: true, correction: row[0], afterCutoff });
}));

/* Bulk corrections: explicit, previewed, individually attributable records.
   Body: { registerId, entryIds?: number[], studentIds?: number[], newPolicyId,
           reason, preview?: boolean, newRemark? } */
schoolRouter.post('/attendance/corrections/bulk', route(async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const body = req.body || {};
  const registerId = num(body.registerId);
  const newPolicyId = num(body.newPolicyId);
  const reason = text(body.reason);
  const preview = body.preview === true;
  const entryIds = Array.isArray(body.entryIds) ? body.entryIds.map(Number).filter(Boolean) : [];
  const studentIds = Array.isArray(body.studentIds) ? body.studentIds.map(Number).filter(Boolean) : [];
  if (!registerId || !newPolicyId || !reason) return res.status(400).json({ error: 'registerId, newPolicyId and reason are required' });
  if (!entryIds.length && !studentIds.length) return res.status(400).json({ error: 'entryIds or studentIds are required' });

  const [reg] = await execQ(pool, 'SELECT * FROM school_attendance_register WHERE app_id=$1 AND id=$2', [appId, registerId]);
  if (!reg) return res.status(404).json({ error: 'Register not found' });
  if (!attendanceSectionAllowed(req, reg.section_id)) return res.status(403).json({ error: 'You can only correct attendance for your assigned sections' });
  if (!['submitted', 'finalized'].includes(reg.state)) return res.status(409).json({ error: 'Only submitted or finalized registers can use corrections' });
  const [policy] = await execQ(pool, 'SELECT id, code, label FROM school_attendance_policy WHERE app_id=$1 AND id=$2 AND is_active=true', [appId, newPolicyId]);
  if (!policy) return res.status(400).json({ error: 'Invalid or inactive newPolicyId' });

  const params = [appId, registerId];
  let scope = '';
  if (entryIds.length) { params.push(entryIds); scope += ` AND e.id = ANY($${params.length}::int[])`; }
  else { params.push(studentIds); scope += ` AND e.student_id = ANY($${params.length}::int[])`; }
  const affected = await execQ(pool, `
    SELECT e.id AS entry_id, e.student_id, e.policy_id, e.remark,
           s.admission_no, s.first_name, s.last_name, p.code AS current_code, p.label AS current_label
      FROM school_attendance_entry e
      JOIN school_students s ON s.id = e.student_id AND s.app_id = e.app_id
      JOIN school_attendance_policy p ON p.id = e.policy_id AND p.app_id = e.app_id
     WHERE e.app_id=$1 AND e.register_id=$2 ${scope}
     ORDER BY s.roll_no NULLS LAST, s.first_name
  `, params);

  if (!affected.length) return res.status(404).json({ error: 'No matching entries in this register' });
  const changes = affected.filter((e) => e.policy_id !== newPolicyId);

  if (preview) {
    return res.json({ ok: true, preview: true, registerId, newPolicy: policy, wouldChange: changes.length, entries: changes });
  }
  if (!changes.length) return res.json({ ok: true, changed: 0, batchId: null });

  const batchId = randomUUID();
  const actor = text(req.user?.userid) || null;
  const settings = await loadAttendanceSettings(pool, appId);
  const cutoffDays = Number(settings.report_cutoff_days ?? 2);
  const ageDays = Math.floor((Date.now() - new Date(dayOf(reg.register_date) + 'T00:00:00Z').getTime()) / 864e5);
  const afterCutoff = ageDays > cutoffDays;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const e of changes) {
      await client.query(`
        INSERT INTO school_attendance_correction
          (app_id, entry_id, register_id, student_id, old_policy_id, new_policy_id,
           old_remark, new_remark, reason, requested_by, after_cutoff, source, batch_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'bulk',$12)
      `, [appId, e.entry_id, registerId, e.student_id, e.policy_id, newPolicyId,
        e.remark, text(body.newRemark) || null, reason, actor, afterCutoff, batchId]);
    }
    await writeAudit(pool, req, {
      action: 'attendance.correction.bulk_request', entity: 'school_attendance_register',
      entityId: registerId, after: { batchId, changed: changes.length, newPolicyId, afterCutoff },
    });
    await client.query('COMMIT');
    res.json({ ok: true, changed: changes.length, batchId, afterCutoff });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}));

schoolRouter.put('/attendance/corrections/:id', route(async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const body = req.body || {};
  const decision = text(body.decision);
  if (!decision || !['approved', 'rejected'].includes(decision)) return res.status(400).json({ error: 'decision must be approved or rejected' });
  const [corr] = await execQ(pool, 'SELECT * FROM school_attendance_correction WHERE app_id=$1 AND id=$2 AND decision IS NULL', [appId, id]);
  if (!corr) return res.status(404).json({ error: 'Correction request not found or already decided' });
  if (req.attendanceScope?.kind === 'teacher') {
    const [register] = await execQ(pool,
      'SELECT section_id FROM school_attendance_register WHERE app_id=$1 AND id=$2',
      [appId, corr.register_id]);
    if (!register || !attendanceSectionAllowed(req, register.section_id)) {
      return res.status(404).json({ error: 'Correction request not found or unavailable' });
    }
  }
  const actor = text(req.user?.userid) || null;
  const settings = await loadAttendanceSettings(pool, appId);
  let decisionReason = text(body.decisionReason) || null;

  if (decision === 'approved') {
    /* Separation of duties: requester cannot approve their own request unless
       a platform administrator explicitly overrides, audited below. */
    if (settings.separation_of_duties && corr.requested_by && actor && corr.requested_by === actor) {
      if (!(req.school?.isSuper && body.override === true)) {
        return res.status(403).json({
          error: 'Separation of duties: the requester cannot approve their own correction. A different reviewer or an audited administrator override is required.',
        });
      }
      decisionReason = `${decisionReason || 'Administrator override'} [admin override: self-approval]`;
    }
    /* Corrections after the reporting cutoff need elevated permission. */
    if (corr.after_cutoff && !req.school?.isSuper) {
      return res.status(403).json({ error: 'This correction is after the reporting cutoff and requires elevated permission' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const decisionUpdate = await client.query(`
      UPDATE school_attendance_correction
       SET decision=$3, reviewed_by=$4, reviewed_at=now(), decision_reason=$5, processed_at=now()
       WHERE app_id=$1 AND id=$2 AND decision IS NULL
       RETURNING id
    `, [appId, id, decision, actor, decisionReason]);
    if (!decisionUpdate.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Correction request was already decided' });
    }
    if (decision === 'approved') {
      const applied = await client.query(`
        UPDATE school_attendance_entry
           SET policy_id=$2, late_minutes=coalesce($3,late_minutes), partial_minutes=coalesce($4,partial_minutes),
               remark=coalesce($5,remark), marked_by=coalesce($6,marked_by), updated_at=now()
         WHERE app_id=$1 AND id=$7 AND register_id=$8 AND student_id=$9
      `, [appId, corr.new_policy_id, corr.new_late_minutes, corr.new_partial_minutes,
        corr.new_remark, actor, corr.entry_id, corr.register_id, corr.student_id]);
      if (!applied.rowCount) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Attendance entry no longer matches this correction request' });
      }
      const activePolicy = await client.query(
        'SELECT id FROM school_attendance_policy WHERE app_id=$1 AND id=$2 AND is_active=true',
        [appId, corr.new_policy_id]
      );
      if (!activePolicy.rowCount) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'The requested attendance status is no longer active' });
      }

      /* A changed absence notifies only after the correction commits. */
      const changed = (await client.query(`
        SELECT p.category FROM school_attendance_policy p WHERE p.app_id=$1 AND p.id=$2
      `, [appId, corr.new_policy_id])).rows[0];
      if (changed && ['absent', 'late', 'partial'].includes(changed.category)) {
        await enqueueAttendanceOutbox(client, appId, {
          idempotencyKey: `correction:${id}:${corr.student_id}`,
          eventType: `attendance.correction.${changed.category}`,
          studentId: corr.student_id,
          registerId: corr.register_id,
          correctionId: id,
          channel: 'app',
          templateCode: 'ATTENDANCE_CORRECTED',
          payload: { category: changed.category, correctionId: id },
        });
      }
    }
    await writeAudit(pool, req, { action: 'attendance.correction.decision', entity: 'school_attendance_correction', entityId: id, after: { decision, decisionReason } });
    await client.query('COMMIT');
    res.json({ ok: true, correctionId: id, decision });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}));

/* ---------- staff attendance ---------- */

schoolRouter.get('/attendance/staff', route(async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const date = dayOf(req.query.date);
  const employeeId = num(req.query.employeeId);
  const where = ['a.app_id=$1'];
  const values = [appId];
  if (date) { values.push(date); where.push(`a.attendance_date=$${values.length}`); }
  if (employeeId) { values.push(employeeId); where.push(`a.employee_id=$${values.length}`); }
  const rows = await execQ(pool, `
    SELECT a.id, a.employee_id, a.attendance_date, a.check_in, a.check_out, a.status,
           a.leave_id, a.shift_id, a.marked_by, a.marked_at, a.created_at, a.updated_at,
           e.first_name || ' ' || e.last_name AS employee_name, e.employee_no, e.designation
      FROM school_staff_attendance a
      JOIN school_hr_employees e ON e.id = a.employee_id AND e.app_id = a.app_id
     WHERE ${where.join(' AND ')}
     ORDER BY a.attendance_date DESC, e.first_name
  `, values);
  res.json({ ok: true, staff: rows });
}));

schoolRouter.post('/attendance/staff', route(async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const body = req.body || {};
  const employeeId = num(body.employeeId);
  const attendanceDate = dayOf(body.attendanceDate);
  if (!employeeId || !attendanceDate) return res.status(400).json({ error: 'employeeId and attendanceDate are required' });
  if (!validDay(attendanceDate)) return res.status(400).json({ error: 'attendanceDate must be a valid calendar date' });
  const [emp] = await execQ(pool, 'SELECT id, user_id, designation FROM school_hr_employees WHERE app_id=$1 AND id=$2 AND status <> \'inactive\'', [appId, employeeId]);
  if (!emp) return res.status(404).json({ error: 'Active employee not found' });

  const explicitShiftId = num(body.shiftId) || null;
  const campusId = num(req.school?.defaultCampusId) || null;
  if (explicitShiftId) {
    const [validShift] = await execQ(pool, `
      SELECT id FROM school_staff_shift
       WHERE app_id=$1 AND id=$2 AND is_active=true
         AND effective_from <= $3::date AND (effective_to IS NULL OR effective_to >= $3::date)
         AND (campus_id IS NULL OR campus_id=$4::int)
    `, [appId, explicitShiftId, attendanceDate, campusId]);
    if (!validShift) return res.status(400).json({ error: 'Selected shift is inactive or not effective on the attendance date' });
  }
  const shift = await resolveStaffShift(pool, appId, attendanceDate, explicitShiftId, campusId);
  const checkInTs = body.checkIn ? new Date(body.checkIn) : null;
  const checkOutTs = body.checkOut ? new Date(body.checkOut) : null;
  const validIn = checkInTs && !Number.isNaN(checkInTs.getTime()) ? checkInTs : null;
  const validOut = checkOutTs && !Number.isNaN(checkOutTs.getTime()) ? checkOutTs : null;
  if ((body.checkIn && !validIn) || (body.checkOut && !validOut)) {
    return res.status(400).json({ error: 'checkIn and checkOut must be valid timestamps' });
  }
  if (validIn && validOut && validOut <= validIn) {
    return res.status(400).json({ error: 'checkOut must be after checkIn' });
  }

  /* Derive late/early/worked minutes from the effective shift; never guess. */
  let lateMinutes = 0;
  let earlyMinutes = 0;
  let workedMinutes = 0;
  if (shift && validIn) {
    const [sh, sm] = String(shift.start_time).split(':').map(Number);
    const shiftStart = new Date(`${attendanceDate}T00:00:00Z`);
    shiftStart.setUTCHours(sh, sm || 0, 0, 0);
    const graceMs = Number(shift.grace_minutes || 0) * 60000;
    lateMinutes = Math.max(0, Math.round((validIn.getTime() - shiftStart.getTime() - graceMs) / 60000));
  }
  if (shift && validOut) {
    const [eh, em] = String(shift.end_time).split(':').map(Number);
    const shiftEnd = new Date(`${attendanceDate}T00:00:00Z`);
    shiftEnd.setUTCHours(eh, em || 0, 0, 0);
    earlyMinutes = Math.max(0, Math.round((shiftEnd.getTime() - validOut.getTime()) / 60000));
  }
  if (validIn && validOut) workedMinutes = Math.max(0, Math.round((validOut.getTime() - validIn.getTime()) / 60000));

  let status = text(body.status);
  if (!status) {
    if (num(body.leaveId)) status = 'on_leave';
    else if (lateMinutes > 0) status = 'late';
    else status = 'present';
  }
  if (!['present', 'absent', 'late', 'half_day', 'on_leave', 'on_duty'].includes(status)) {
    return res.status(400).json({ error: 'Invalid staff attendance status' });
  }
  const leaveId = num(body.leaveId) || null;
  if (status === 'on_leave' && !leaveId) return res.status(400).json({ error: 'An approved leave request is required for on-leave status' });
  if (leaveId) {
    const [leave] = await execQ(pool, `
      SELECT id FROM school_staff_leave
       WHERE app_id=$1 AND id=$2 AND employee_id=$3 AND status='approved'
         AND start_date <= $4::date AND end_date >= $4::date
    `, [appId, leaveId, employeeId, attendanceDate]);
    if (!leave) return res.status(400).json({ error: 'Selected leave is not approved for this employee and date' });
  }
  if (shift && lateMinutes > 0 && status === 'present') status = 'late';
  if (shift && shift.half_day_after_minutes && workedMinutes > 0 && workedMinutes < Number(shift.half_day_after_minutes) && status === 'present') status = 'half_day';

  const row = await execQ(pool, `
    INSERT INTO school_staff_attendance
      (app_id, employee_id, attendance_date, check_in, check_out, status, leave_id, shift_id,
       late_minutes, early_minutes, worked_minutes, source, marked_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'manual',$12)
    ON CONFLICT (app_id, employee_id, attendance_date) DO UPDATE SET
      check_in=excluded.check_in, check_out=excluded.check_out, status=excluded.status,
      leave_id=excluded.leave_id, shift_id=excluded.shift_id, late_minutes=excluded.late_minutes,
      early_minutes=excluded.early_minutes, worked_minutes=excluded.worked_minutes,
      marked_by=excluded.marked_by, updated_at=now()
    RETURNING *
  `, [appId, employeeId, attendanceDate, validIn ? validIn.toISOString() : null, validOut ? validOut.toISOString() : null,
    status, leaveId, shift?.id || explicitShiftId, lateMinutes, earlyMinutes, workedMinutes,
    text(req.user?.userid) || null]);

  /* Publish an unavailability signal for the timetable substitution workflow.
     Attendance does not create substitutions itself. */
  const availabilityType = status === 'absent' ? 'absent'
    : status === 'on_leave' ? 'leave'
    : status === 'on_duty' ? 'on_duty'
    : status === 'half_day' ? 'partial' : null;
  if (availabilityType) {
    await execQ(pool, `
      INSERT INTO school_staff_availability
        (app_id, employee_id, availability_date, availability_type, source, staff_attendance_id, staff_leave_id, note)
      VALUES ($1,$2,$3,$4,'attendance',$5,$6,$7)
      ON CONFLICT (app_id, employee_id, availability_date) DO UPDATE SET
        source='attendance',
        availability_type=excluded.availability_type, staff_attendance_id=excluded.staff_attendance_id,
        staff_leave_id=excluded.staff_leave_id, note=excluded.note,
        published=false, published_at=NULL, updated_at=now()
    `, [appId, employeeId, attendanceDate, availabilityType, row[0].id, leaveId, status]);
  } else {
    await execQ(pool, `
      DELETE FROM school_staff_availability
       WHERE app_id=$1 AND employee_id=$2 AND availability_date=$3
    `, [appId, employeeId, attendanceDate]);
  }

  await writeAudit(pool, req, { action: 'attendance.staff.upsert', entity: 'school_staff_attendance', entityId: row[0].id, after: row[0] });
  res.json({ ok: true, staff: row[0], availabilityType });
}));

/* ---------- staff leave ---------- */

schoolRouter.get('/attendance/staff-leave', route(async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const employeeId = num(req.query.employeeId);
  const campusId = num(req.query.campusId);
  const rows = await execQ(pool, `
    SELECT l.id, l.employee_id, l.leave_type, l.start_date, l.end_date, l.reason,
           l.status, l.approved_by, l.approved_at, l.created_by, l.created_at, l.updated_at,
           e.first_name || ' ' || e.last_name AS employee_name
      FROM school_staff_leave l
      JOIN school_hr_employees e ON e.id = l.employee_id AND e.app_id = l.app_id
     WHERE l.app_id=$1 AND ($2::int IS NULL OR l.employee_id=$2::int)
     ORDER BY l.start_date DESC
  `, [appId, employeeId || null]);
  res.json({ ok: true, staffLeave: rows });
}));

schoolRouter.post('/attendance/staff-leave', route(async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const body = req.body || {};
  const employeeId = num(body.employeeId);
  const leaveType = text(body.leaveType);
  const startDate = dayOf(body.startDate);
  const endDate = dayOf(body.endDate);
  if (!employeeId || !leaveType || !startDate || !endDate) return res.status(400).json({ error: 'employeeId, leaveType, startDate and endDate are required' });
  if (!validDay(startDate) || !validDay(endDate) || endDate < startDate) {
    return res.status(400).json({ error: 'Provide valid dates and ensure endDate is on or after startDate' });
  }
  if (daySpan(startDate, endDate) > 180) return res.status(400).json({ error: 'A leave request cannot exceed 180 days' });
  if (!['casual', 'sick', 'earned', 'maternity', 'paternity', 'study', 'other'].includes(leaveType)) return res.status(400).json({ error: 'Invalid leave type' });
  const [employee] = await execQ(pool, 'SELECT id FROM school_hr_employees WHERE app_id=$1 AND id=$2 AND status <> \'inactive\'', [appId, employeeId]);
  if (!employee) return res.status(404).json({ error: 'Active employee not found' });
  const row = await execQ(pool, `
    INSERT INTO school_staff_leave
      (app_id, employee_id, leave_type, start_date, end_date, reason, status, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,'pending',$7)
    RETURNING *
  `, [appId, employeeId, leaveType, startDate, endDate, text(body.reason) || null, text(req.user?.userid) || null]);
  await writeAudit(pool, req, { action: 'attendance.staff_leave.create', entity: 'school_staff_leave', entityId: row[0].id, after: row[0] });
  res.json({ ok: true, staffLeave: row[0] });
}));

/* ---------- staff shift policy ---------- */

schoolRouter.get('/attendance/staff-shifts', route(async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const campusId = num(req.query.campusId);
  const rows = await execQ(pool, `
    SELECT s.*, c.name AS campus_name
      FROM school_staff_shift s
      LEFT JOIN school_campuses c ON c.id = s.campus_id
     WHERE s.app_id=$1 AND ($2::int IS NULL OR s.campus_id IS NULL OR s.campus_id=$2::int)
      ORDER BY s.is_active DESC, CASE WHEN s.campus_id=$2::int THEN 0 ELSE 1 END, s.name
  `, [appId, campusId || null]);
  res.json({ ok: true, shifts: rows });
}));

schoolRouter.post('/attendance/staff-shifts', route(async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const body = req.body || {};
  const name = text(body.name);
  const startTime = text(body.startTime);
  const endTime = text(body.endTime);
  if (!name || !startTime || !endTime) return res.status(400).json({ error: 'name, startTime and endTime are required' });
  if (endTime <= startTime) return res.status(400).json({ error: 'endTime must be after startTime' });
  const row = await execQ(pool, `
    INSERT INTO school_staff_shift
      (app_id, campus_id, name, start_time, end_time, grace_minutes, half_day_after_minutes,
       expected_minutes, effective_from, effective_to, is_active)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,coalesce($9::date,current_date),$10::date,coalesce($11,true))
    RETURNING *
  `, [appId, num(body.campusId) || null, name, startTime, endTime,
    num(body.graceMinutes) ?? 10, num(body.halfDayAfterMinutes) ?? 240, num(body.expectedMinutes) ?? 480,
    dayOf(body.effectiveFrom), dayOf(body.effectiveTo), body.isActive]);
  await writeAudit(pool, req, { action: 'attendance.staff_shift.create', entity: 'school_staff_shift', entityId: row[0].id, after: row[0] });
  res.json({ ok: true, shift: row[0] });
}));

schoolRouter.put('/attendance/staff-shifts/:id', route(async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const body = req.body || {};
  const row = await execQ(pool, `
    UPDATE school_staff_shift
       SET name=coalesce($3,name), start_time=coalesce($4::time,start_time), end_time=coalesce($5::time,end_time),
           grace_minutes=coalesce($6,grace_minutes), half_day_after_minutes=coalesce($7,half_day_after_minutes),
           expected_minutes=coalesce($8,expected_minutes), effective_from=coalesce($9::date,effective_from),
           effective_to=$10::date, is_active=coalesce($11,is_active), campus_id=coalesce($12,campus_id),
           updated_at=now()
     WHERE app_id=$1 AND id=$2
     RETURNING *
  `, [appId, id, text(body.name) || null, text(body.startTime) || null, text(body.endTime) || null,
    num(body.graceMinutes), num(body.halfDayAfterMinutes), num(body.expectedMinutes),
    dayOf(body.effectiveFrom), dayOf(body.effectiveTo), body.isActive, num(body.campusId)]);
  if (!row[0]) return res.status(404).json({ error: 'Shift not found' });
  await writeAudit(pool, req, { action: 'attendance.staff_shift.update', entity: 'school_staff_shift', entityId: id, after: row[0] });
  res.json({ ok: true, shift: row[0] });
}));

/* ---------- staff leave decision + availability signal ---------- */

schoolRouter.put('/attendance/staff-leave/:id', route(async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const body = req.body || {};
  const status = text(body.status);
  const actor = text(req.user?.userid) || null;
  if (!['approved', 'rejected', 'cancelled'].includes(status)) return res.status(400).json({ error: 'status must be approved, rejected or cancelled' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query('SELECT * FROM school_staff_leave WHERE app_id=$1 AND id=$2 FOR UPDATE', [appId, id]);
    const leave = cur.rows[0];
    if (!leave) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Staff leave not found' }); }
    if (status === 'approved' && daySpan(dayOf(leave.start_date), dayOf(leave.end_date)) > 180) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This leave period exceeds the supported 180-day availability window' });
    }
    const updated = await client.query(`
      UPDATE school_staff_leave
         SET status=$3, approved_by=$4, approved_at=$5, updated_at=now()
       WHERE app_id=$1 AND id=$2 RETURNING *
    `, [appId, id, status, status === 'approved' ? actor : null, status === 'approved' ? new Date().toISOString() : null]);

    let availabilityPublished = 0;
    if (status === 'approved') {
      for (const d of eachDate(dayOf(leave.start_date), dayOf(leave.end_date))) {
        await client.query(`
          INSERT INTO school_staff_availability
            (app_id, employee_id, availability_date, availability_type, source, staff_leave_id, note)
          VALUES ($1,$2,$3,'leave','leave',$4,$5)
          ON CONFLICT (app_id, employee_id, availability_date) DO UPDATE SET
            availability_type=CASE WHEN school_staff_availability.source='attendance'
                                   THEN school_staff_availability.availability_type ELSE 'leave' END,
            source=CASE WHEN school_staff_availability.source='attendance' THEN 'attendance' ELSE 'leave' END,
            staff_leave_id=CASE WHEN school_staff_availability.source='attendance'
                                THEN school_staff_availability.staff_leave_id ELSE excluded.staff_leave_id END,
            published=CASE WHEN school_staff_availability.source='attendance'
                           THEN school_staff_availability.published ELSE false END,
            published_at=CASE WHEN school_staff_availability.source='attendance'
                              THEN school_staff_availability.published_at ELSE NULL END,
            updated_at=now()
        `, [appId, leave.employee_id, d, id, leave.leave_type]);
        availabilityPublished++;
      }
    } else if (status === 'rejected' || status === 'cancelled') {
      await client.query(`
        DELETE FROM school_staff_availability
         WHERE app_id=$1 AND employee_id=$2 AND staff_leave_id=$3 AND source='leave'
      `, [appId, leave.employee_id, id]);
    }

    await enqueueAttendanceOutbox(client, appId, {
      idempotencyKey: `staff_leave:${id}:${status}`,
      eventType: `staff_leave.${status}`,
      employeeId: leave.employee_id,
      channel: 'app',
      templateCode: 'STAFF_LEAVE_DECISION',
      payload: { leaveId: id, status },
    });

    await writeAudit(pool, req, { action: 'attendance.staff_leave.decision', entity: 'school_staff_leave', entityId: id, after: { status, availabilityPublished } });
    await client.query('COMMIT');
    res.json({ ok: true, staffLeave: updated.rows[0], availabilityPublished });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}));

schoolRouter.get('/attendance/staff-availability', route(async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const date = dayOf(req.query.date);
  const employeeId = num(req.query.employeeId);
  const where = ['a.app_id=$1'];
  const values = [appId];
  if (date) { values.push(date); where.push(`a.availability_date=$${values.length}`); }
  if (employeeId) { values.push(employeeId); where.push(`a.employee_id=$${values.length}`); }
  const rows = await execQ(pool, `
    SELECT a.*, e.employee_no, e.first_name || ' ' || e.last_name AS employee_name
      FROM school_staff_availability a
      JOIN school_hr_employees e ON e.id = a.employee_id AND e.app_id = a.app_id
     WHERE ${where.join(' AND ')}
     ORDER BY a.availability_date DESC, e.first_name
  `, values);
  res.json({ ok: true, availability: rows });
}));

schoolRouter.post('/attendance/staff-availability/publish', route(async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const body = req.body || {};
  const date = dayOf(body.date);
  const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean) : [];
  const params = [appId];
  let scope = '';
  if (ids.length) { params.push(ids); scope += ` AND id = ANY($${params.length}::int[])`; }
  if (date) { params.push(date); scope += ` AND availability_date = $${params.length}::date`; }
  const rows = await execQ(pool, `
    UPDATE school_staff_availability
       SET published=true, published_at=now(), updated_at=now()
     WHERE app_id=$1 ${scope}
     RETURNING id
  `, params);
  await writeAudit(pool, req, { action: 'attendance.staff_availability.publish', entity: 'school_staff_availability', after: { count: rows.length, date, ids } });
  res.json({ ok: true, published: rows.length });
}));

/* ---------- notification outbox ---------- */

schoolRouter.get('/attendance/outbox', route(async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  if (denyStaffAttendanceForNonManagers(req, res)) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const status = text(req.query.status);
  const rows = await execQ(pool, `
    SELECT * FROM school_attendance_outbox
     WHERE app_id=$1 ${status ? 'AND status=$2' : ''}
     ORDER BY created_at DESC LIMIT 200
  `, status ? [appId, status] : [appId]);
  res.json({ ok: true, outbox: rows });
}));

schoolRouter.post('/attendance/outbox/process', route(async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  if (denyStaffAttendanceForNonManagers(req, res)) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const parsedBatch = Number(req.body?.limit);
  const batch = Number.isFinite(parsedBatch) && parsedBatch > 0 ? Math.min(Math.floor(parsedBatch), 200) : 50;
  const failed = await execQ(pool, `
    WITH due AS (
      SELECT id
        FROM school_attendance_outbox
       WHERE app_id=$1 AND status='pending' AND (next_retry_at IS NULL OR next_retry_at <= now())
       ORDER BY created_at
       LIMIT $2
       FOR UPDATE SKIP LOCKED
    )
    UPDATE school_attendance_outbox o
       SET status='failed', attempts=o.attempts+1,
           last_error=CASE WHEN o.recipient IS NULL OR btrim(o.recipient)=''
                           THEN 'No recipient on file'
                           ELSE 'No notification delivery adapter is configured'
                      END,
           next_retry_at=NULL, processed_at=now()
      FROM due
     WHERE o.id=due.id AND o.app_id=$1
     RETURNING o.id
  `, [appId, batch]);
  res.json({
    ok: true,
    processed: failed.length,
    delivered: 0,
    failed: failed.length,
    error: failed.length ? 'No notification delivery adapter is configured; events were marked failed.' : null,
  });
}));

/* ---------- reports (accepted entries only) ---------- */

function reportRange(req) {
  const month = text(req.query.month);
  if (/^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    const from = `${month}-01`;
    const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    return { from, to, month };
  }
  const from = dayOf(req.query.from) || new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  const to = dayOf(req.query.to) || new Date().toISOString().slice(0, 10);
  return { from, to, month: null };
}

async function monthlyRows(pool, appId, { from, to, sectionId, studentIds, sectionIds }) {
  const values = [appId, from, to];
  const filters = [];
  if (studentIds) {
    values.push(studentIds);
    filters.push(`AND st.id=ANY($${values.length}::int[])`);
  } else if (sectionId) {
    values.push(sectionId);
    filters.push(`AND COALESCE(en.section_id, st.section_id)=$${values.length}`);
  } else if (sectionIds) {
    values.push(sectionIds);
    filters.push(`AND COALESCE(en.section_id, st.section_id)=ANY($${values.length}::int[])`);
  }
  return execQ(pool, `
    SELECT st.id, st.admission_no, st.first_name, st.last_name,
           c.name AS class_name, sec.name AS section_name,
           count(DISTINCT r.id)::int AS sessions,
           count(e.id)::int AS marked,
           count(e.id) FILTER (WHERE p.category='present')::int AS present,
           count(e.id) FILTER (WHERE p.category='absent')::int AS absent,
           count(e.id) FILTER (WHERE p.category='late')::int AS late,
           count(e.id) FILTER (WHERE p.category='excused')::int AS excused,
           count(e.id) FILTER (WHERE p.category='activity')::int AS activity,
           count(e.id) FILTER (WHERE p.category='partial')::int AS partial,
           count(e.id) FILTER (WHERE p.counts_as_present)::int AS present_equivalent
      FROM school_students st
      LEFT JOIN school_student_enrollments en ON en.app_id=st.app_id AND en.student_id=st.id
           AND en.status='studying' AND en.joined_on <= $3::date AND (en.left_on IS NULL OR en.left_on >= $2::date)
      LEFT JOIN school_attendance_register r ON r.app_id=st.app_id AND r.section_id=COALESCE(en.section_id, st.section_id)
           AND r.register_date BETWEEN $2::date AND $3::date AND r.state IN ('submitted','finalized')
      LEFT JOIN school_attendance_entry e ON e.register_id=r.id AND e.student_id=st.id AND e.app_id=st.app_id
      LEFT JOIN school_attendance_policy p ON p.id=e.policy_id AND p.app_id=e.app_id
      LEFT JOIN school_classes c ON c.id=COALESCE(en.class_id, st.class_id)
      LEFT JOIN school_sections sec ON sec.id=COALESCE(en.section_id, st.section_id)
     WHERE st.app_id=$1 AND st.status='active' AND st.deleted_at IS NULL ${filters.join(' ')}
     GROUP BY st.id, c.name, sec.name, c.sort_order
     ORDER BY c.sort_order NULLS LAST, sec.name, st.first_name
  `, values);
}

schoolRouter.get('/attendance/reports/monthly', route(async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const { from, to, month } = reportRange(req);
  const scope = req.attendanceScope;
  const rows = await monthlyRows(pool, appId, {
    from, to, sectionId: num(req.query.sectionId),
    studentIds: scope?.kind === 'student' ? scope.studentIds : null,
    sectionIds: scope?.kind === 'teacher' ? scope.sectionIds : null,
  });
  res.json({ ok: true, from, to, month, registerCountScope: 'submitted+finalized', students: rows });
}));

schoolRouter.get('/attendance/reports/defaulters', route(async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const { from, to } = reportRange(req);
  const settings = await loadAttendanceSettings(pool, appId);
  const threshold = num(req.query.threshold) ?? Number(settings.min_attendance_percent ?? 75);
  const scope = req.attendanceScope;
  const rows = await monthlyRows(pool, appId, {
    from, to, sectionId: num(req.query.sectionId),
    studentIds: scope?.kind === 'student' ? scope.studentIds : null,
    sectionIds: scope?.kind === 'teacher' ? scope.sectionIds : null,
  });
  const defaulters = rows
    .map((r) => ({
      ...r,
      percent: r.sessions > 0 ? Math.round((r.present_equivalent / r.sessions) * 10000) / 100 : 0,
    }))
    .filter((r) => r.sessions > 0 && r.percent < threshold)
    .sort((a, b) => a.percent - b.percent);
  res.json({ ok: true, from, to, threshold, defaulters });
}));

schoolRouter.get('/attendance/reports/absentees', route(async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const date = dayOf(req.query.date) || new Date().toISOString().slice(0, 10);
  const sectionId = num(req.query.sectionId);
  const values = [appId, date];
  let sectionFilter = '';
  if (req.attendanceScope?.kind === 'student') {
    values.push(req.attendanceScope.studentIds);
    sectionFilter = `AND st.id=ANY($${values.length}::int[])`;
  } else if (req.attendanceScope?.kind === 'teacher') {
    values.push(req.attendanceScope.sectionIds);
    sectionFilter = `AND r.section_id=ANY($${values.length}::int[])`;
  } else if (sectionId) { values.push(sectionId); sectionFilter = `AND r.section_id=$${values.length}`; }
  const rows = await execQ(pool, `
    SELECT st.id, st.admission_no, st.first_name, st.last_name, p.code AS status_code, p.label AS status_label,
           e.remark, r.section_id, sec.name AS section_name, c.name AS class_name, e.marked_by, e.marked_at
      FROM school_attendance_entry e
      JOIN school_attendance_register r ON r.id=e.register_id AND r.app_id=e.app_id
      JOIN school_attendance_policy p ON p.id=e.policy_id AND p.app_id=e.app_id
      JOIN school_students st ON st.id=e.student_id AND st.app_id=e.app_id
      LEFT JOIN school_sections sec ON sec.id=r.section_id
      LEFT JOIN school_classes c ON c.id=sec.class_id
     WHERE e.app_id=$1 AND r.register_date=$2::date AND r.state IN ('submitted','finalized')
       AND p.category='absent' ${sectionFilter}
     ORDER BY c.sort_order NULLS LAST, sec.name, st.first_name
  `, values);
  res.json({ ok: true, date, absentees: rows });
}));

schoolRouter.get('/attendance/reports/late', route(async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const { from, to } = reportRange(req);
  const sectionId = num(req.query.sectionId);
  const values = [appId, from, to];
  let sectionFilter = '';
  if (req.attendanceScope?.kind === 'student') {
    values.push(req.attendanceScope.studentIds);
    sectionFilter = `AND st.id=ANY($${values.length}::int[])`;
  } else if (req.attendanceScope?.kind === 'teacher') {
    values.push(req.attendanceScope.sectionIds);
    sectionFilter = `AND r.section_id=ANY($${values.length}::int[])`;
  } else if (sectionId) { values.push(sectionId); sectionFilter = `AND r.section_id=$${values.length}`; }
  const rows = await execQ(pool, `
    SELECT st.id, st.admission_no, st.first_name, st.last_name, r.register_date,
           p.code AS status_code, p.label AS status_label, e.late_minutes, e.partial_minutes, e.remark,
           sec.name AS section_name, c.name AS class_name
      FROM school_attendance_entry e
      JOIN school_attendance_register r ON r.id=e.register_id AND r.app_id=e.app_id
      JOIN school_attendance_policy p ON p.id=e.policy_id AND p.app_id=e.app_id
      JOIN school_students st ON st.id=e.student_id AND st.app_id=e.app_id
      LEFT JOIN school_sections sec ON sec.id=r.section_id
      LEFT JOIN school_classes c ON c.id=sec.class_id
     WHERE e.app_id=$1 AND r.register_date BETWEEN $2::date AND $3::date
       AND r.state IN ('submitted','finalized')
       AND (p.category='late' OR e.late_minutes > 0) ${sectionFilter}
     ORDER BY r.register_date DESC, st.first_name
  `, values);
  res.json({ ok: true, from, to, late: rows });
}));

schoolRouter.get('/attendance/reports/leave', route(async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const { from, to } = reportRange(req);
  const status = text(req.query.status);
  const values = [appId, from, to];
  let statusFilter = '';
  if (status) { values.push(status); statusFilter = `AND l.status=$${values.length}`; }
  let scopeFilter = '';
  if (req.attendanceScope?.kind === 'student') {
    values.push(req.attendanceScope.studentIds);
    scopeFilter = `AND l.student_id=ANY($${values.length}::int[])`;
  } else if (req.attendanceScope?.kind === 'teacher') {
    values.push(req.attendanceScope.sectionIds);
    scopeFilter = `AND EXISTS (
      SELECT 1 FROM school_students s
       WHERE s.app_id=l.app_id AND s.id=l.student_id
         AND (s.section_id=ANY($${values.length}::int[]) OR EXISTS (
           SELECT 1 FROM school_student_enrollments en
            WHERE en.app_id=s.app_id AND en.student_id=s.id AND en.section_id=ANY($${values.length}::int[])
         ))
    )`;
  }
  const rows = await execQ(pool, `
    SELECT l.*, st.admission_no, st.first_name, st.last_name
      FROM school_student_leave l
      JOIN school_students st ON st.id=l.student_id AND st.app_id=l.app_id
     WHERE l.app_id=$1 AND l.start_date <= $3::date AND l.end_date >= $2::date ${statusFilter} ${scopeFilter}
     ORDER BY l.start_date DESC
  `, values);
  res.json({ ok: true, from, to, leave: rows });
}));

schoolRouter.get('/attendance/reports/missing', route(async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const date = dayOf(req.query.date) || new Date().toISOString().slice(0, 10);
  if (req.attendanceScope?.kind === 'student') {
    return res.status(403).json({ error: 'Missing-register reports are restricted to attendance administrators and teachers' });
  }
  const values = [appId, date];
  let sectionFilter = '';
  if (req.attendanceScope?.kind === 'teacher') {
    values.push(req.attendanceScope.sectionIds);
    sectionFilter = `AND sec.id=ANY($${values.length}::int[])`;
  }
  const rows = await execQ(pool, `
    SELECT sec.id AS section_id, c.name AS class_name, sec.name AS section_name,
           count(DISTINCT COALESCE(en.student_id, st.id))::int AS students,
           r.id AS register_id, r.state
      FROM school_sections sec
      JOIN school_classes c ON c.id=sec.class_id AND c.app_id=sec.app_id
      LEFT JOIN school_student_enrollments en ON en.section_id=sec.id AND en.app_id=sec.app_id AND en.status='studying'
           AND en.joined_on <= $2::date AND (en.left_on IS NULL OR en.left_on >= $2::date)
      LEFT JOIN school_students st ON st.app_id=sec.app_id AND st.section_id=sec.id AND st.status='active' AND st.deleted_at IS NULL
      LEFT JOIN school_attendance_register r ON r.app_id=sec.app_id AND r.section_id=sec.id AND r.register_date=$2::date
     WHERE sec.app_id=$1 AND sec.is_active=true ${sectionFilter}
     GROUP BY sec.id, c.name, c.sort_order, sec.name, r.id, r.state
    HAVING r.id IS NULL OR r.state IN ('draft')
     ORDER BY c.sort_order NULLS LAST, sec.name
  `, values);
  res.json({ ok: true, date, missing: rows });
}));

schoolRouter.get('/attendance/reports/staff', route(async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  if (denyStaffAttendanceForNonManagers(req, res)) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const { from, to } = reportRange(req);
  const department = text(req.query.department);
  const values = [appId, from, to];
  let deptFilter = '';
  if (department) { values.push(department); deptFilter = `AND e.department=$${values.length}`; }
  const rows = await execQ(pool, `
    SELECT e.id, e.employee_no, e.first_name, e.last_name, e.department, e.designation,
           count(a.id)::int AS marked,
           count(*) FILTER (WHERE a.status='present')::int AS present,
           count(*) FILTER (WHERE a.status='absent')::int AS absent,
           count(*) FILTER (WHERE a.status='late')::int AS late,
           count(*) FILTER (WHERE a.status='half_day')::int AS half_day,
           count(*) FILTER (WHERE a.status='on_leave')::int AS on_leave,
           count(*) FILTER (WHERE a.status='on_duty')::int AS on_duty,
           coalesce(sum(a.late_minutes),0)::int AS late_minutes,
           coalesce(sum(a.early_minutes),0)::int AS early_minutes,
           coalesce(sum(a.worked_minutes),0)::int AS worked_minutes
      FROM school_hr_employees e
      LEFT JOIN school_staff_attendance a ON a.employee_id=e.id AND a.app_id=e.app_id
           AND a.attendance_date BETWEEN $2::date AND $3::date
     WHERE e.app_id=$1 ${deptFilter}
     GROUP BY e.id, e.employee_no, e.first_name, e.last_name, e.department, e.designation
     ORDER BY e.department, e.first_name
  `, values);
  res.json({ ok: true, from, to, staff: rows });
}));

schoolRouter.get('/attendance/reports/staff-payroll', route(async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  if (denyStaffAttendanceForNonManagers(req, res)) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const { from, to } = reportRange(req);
  const department = text(req.query.department);
  const values = [appId, from, to];
  let deptFilter = '';
  if (department) { values.push(department); deptFilter = `AND e.department=$${values.length}`; }
  const rows = await execQ(pool, `
    SELECT e.employee_no, e.first_name, e.last_name, e.department, e.designation,
           a.attendance_date, a.status, a.check_in, a.check_out, a.late_minutes, a.early_minutes,
           a.worked_minutes, l.leave_type
      FROM school_hr_employees e
      JOIN school_staff_attendance a ON a.employee_id=e.id AND a.app_id=e.app_id
           AND a.attendance_date BETWEEN $2::date AND $3::date
      LEFT JOIN school_staff_leave l ON l.id=a.leave_id AND l.app_id=a.app_id AND l.status='approved'
     WHERE e.app_id=$1 ${deptFilter}
     ORDER BY e.employee_no, a.attendance_date
  `, values);
  await writeAudit(pool, req, {
    action: 'attendance.export.staff_payroll', entity: 'school_staff_attendance',
    after: { from, to, department: department || null, rows: rows.length },
  });
  res.json({ ok: true, reportType: 'staff_attendance_source', note: 'Source report only. Payroll calculation is owned by HR.', from, to, rows });
}));

/* ---------- summary (new model) ---------- */

schoolRouter.get('/attendance/summary', route(async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const from = dayOf(req.query.from) || new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  const to = dayOf(req.query.to) || new Date().toISOString().slice(0, 10);
  const sectionId = num(req.query.sectionId);
  const values = [appId, from, to];
  let sectionFilter = '';
  let studentFilter = '';
  if (sectionId) { values.push(sectionId); sectionFilter = `AND r.section_id=$${values.length}`; }
  if (req.attendanceScope?.kind === 'student') {
    values.push(req.attendanceScope.studentIds);
    studentFilter = `AND st.id=ANY($${values.length}::int[])`;
  } else if (req.attendanceScope?.kind === 'teacher') {
    values.push(req.attendanceScope.sectionIds);
    sectionFilter += ` AND r.section_id=ANY($${values.length}::int[])`;
  }
  const rows = await execQ(pool, `
    SELECT st.id, st.admission_no, st.first_name, st.last_name,
           c.name AS class_name, sec.name AS section_name,
           count(e.id)::int AS marked,
           count(e.id) FILTER (WHERE p.category='present')::int AS present,
           count(e.id) FILTER (WHERE p.category='absent')::int AS absent,
           count(e.id) FILTER (WHERE p.category='late')::int AS late,
           count(e.id) FILTER (WHERE p.category='excused')::int AS excused,
           count(e.id) FILTER (WHERE p.category='activity')::int AS activity,
           count(e.id) FILTER (WHERE p.category='partial')::int AS partial
      FROM school_students st
      LEFT JOIN school_student_enrollments en ON en.app_id=st.app_id AND en.student_id=st.id
           AND en.status='studying' AND en.joined_on <= $3 AND (en.left_on IS NULL OR en.left_on >= $2)
      LEFT JOIN school_attendance_register r ON r.app_id=st.app_id AND r.section_id=COALESCE(en.section_id, st.section_id)
           AND r.register_date BETWEEN $2 AND $3 AND r.state IN ('submitted','finalized') ${sectionFilter}
      LEFT JOIN school_attendance_entry e ON e.register_id=r.id AND e.student_id=st.id
      LEFT JOIN school_attendance_policy p ON p.id=e.policy_id AND p.app_id=e.app_id
      LEFT JOIN school_classes c ON c.id = COALESCE(en.class_id, st.class_id)
      LEFT JOIN school_sections sec ON sec.id = COALESCE(en.section_id, st.section_id)
     WHERE st.app_id=$1 AND st.status='active' AND st.deleted_at IS NULL ${studentFilter}
     GROUP BY st.id, c.name, sec.name, c.sort_order
     ORDER BY c.sort_order NULLS LAST, sec.name, st.first_name
  `, values);
  res.json({ ok: true, from, to, students: rows });
}));

/* ---------- fees ---------- */

schoolRouter.get('/fees', route(async (req, res) => {
  if (!guard(req, res, 'fees.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  await ensureSeed(pool, appId);

  const heads = await execQ(pool,
    'SELECT * FROM school_fee_heads WHERE app_id=$1 ORDER BY name', [appId]);

  const where = ['i.app_id=$1'];
  const values = [appId];
  if (text(req.query.status)) { values.push(text(req.query.status)); where.push(`i.status=$${values.length}`); }
  if (num(req.query.studentId)) { values.push(num(req.query.studentId)); where.push(`i.student_id=$${values.length}`); }

  const invoices = await execQ(pool, `
    SELECT i.*, st.admission_no, st.first_name, st.last_name,
           c.name AS class_name, sec.name AS section_name,
           (i.amount - i.paid_amount) AS balance
      FROM school_fee_invoices i
      JOIN school_students st ON st.id = i.student_id
      LEFT JOIN school_classes c    ON c.id = st.class_id
      LEFT JOIN school_sections sec ON sec.id = st.section_id
     WHERE ${where.join(' AND ')} AND st.deleted_at IS NULL
     ORDER BY i.due_date DESC, i.id DESC LIMIT 300
  `, values);

  const payments = await execQ(pool, `
    SELECT p.*, st.first_name, st.last_name, i.title
      FROM school_fee_payments p
      JOIN school_students st ON st.id = p.student_id
      JOIN school_fee_invoices i ON i.id = p.invoice_id
     WHERE p.app_id=$1 AND st.deleted_at IS NULL ORDER BY p.paid_at DESC LIMIT 50
  `, [appId]);

  const [summary] = await execQ(pool, `
    SELECT coalesce(sum(i.amount),0) AS billed,
           coalesce(sum(i.paid_amount),0) AS collected,
           coalesce(sum(i.amount-i.paid_amount),0) AS outstanding,
           count(*) FILTER (WHERE i.status='unpaid')::int  AS unpaid,
           count(*) FILTER (WHERE i.status='partial')::int AS partial,
           count(*) FILTER (WHERE i.status='paid')::int    AS paid
      FROM school_fee_invoices i
      JOIN school_students st ON st.id=i.student_id
     WHERE i.app_id=$1 AND st.deleted_at IS NULL
  `, [appId]);

  res.json({ ok: true, heads, invoices, payments, summary });
}));

schoolRouter.post('/fees/heads', route(async (req, res) => {
  if (!guard(req, res, 'fees.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const name = text(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Fee head name is required' });
  const [row] = await execQ(pool,
    `INSERT INTO school_fee_heads (app_id, name, description) VALUES ($1,$2,$3)
     ON CONFLICT (app_id, name) DO UPDATE SET description=excluded.description RETURNING *`,
    [appId, name, text(req.body?.description) || null]);
  res.json({ ok: true, head: row });
}));

schoolRouter.post('/fees/invoices', route(async (req, res) => {
  if (!guard(req, res, 'fees.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const studentId = num(req.body?.studentId);
  const title = text(req.body?.title);
  const amount = Number(req.body?.amount);
  const dueDate = day(req.body?.dueDate);
  if (!studentId || !title || !Number.isFinite(amount) || amount <= 0 || !dueDate) {
    return res.status(400).json({ error: 'Student, title, amount and due date are required' });
  }
  const [row] = await execQ(pool, `
    INSERT INTO school_fee_invoices (app_id, student_id, title, amount, due_date, notes)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
  `, [appId, studentId, title, amount, dueDate, text(req.body?.notes) || null]);
  res.json({ ok: true, invoice: row });
}));

schoolRouter.post('/fees/payments', route(async (req, res) => {
  if (!guard(req, res, 'fees.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const invoiceId = num(req.body?.invoiceId);
  const amount = Number(req.body?.amount);
  if (!invoiceId || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Invoice and a positive amount are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inv = await client.query(
      'SELECT * FROM school_fee_invoices WHERE app_id=$1 AND id=$2 FOR UPDATE', [appId, invoiceId]);
    const invoice = inv.rows[0];
    if (!invoice) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Invoice not found' }); }

    const balance = Number(invoice.amount) - Number(invoice.paid_amount);
    if (amount > balance + 0.001) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Amount exceeds balance of ${balance.toFixed(2)}` });
    }

    const pay = await client.query(`
      INSERT INTO school_fee_payments (app_id, invoice_id, student_id, amount, method, reference)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [appId, invoiceId, invoice.student_id, amount, text(req.body?.method) || 'cash', text(req.body?.reference) || null]);

    const updated = await client.query(`
      UPDATE school_fee_invoices
         SET paid_amount = paid_amount + $3,
             status = CASE WHEN paid_amount + $3 >= amount THEN 'paid'
                           WHEN paid_amount + $3 > 0 THEN 'partial' ELSE 'unpaid' END
       WHERE app_id=$1 AND id=$2 RETURNING *
    `, [appId, invoiceId, amount]);

    await client.query('COMMIT');
    res.json({ ok: true, payment: pay.rows[0], invoice: updated.rows[0] });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}));

/* ---------- automation ---------- */

schoolRouter.get('/automations', route(async (req, res) => {
  if (!guard(req, res, 'automation.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  await ensureSeed(pool, appId);

  const rules = await execQ(pool,
    'SELECT * FROM school_automation_rules WHERE app_id=$1 ORDER BY id', [appId]);
  const logs = await execQ(pool, `
    SELECT l.*, st.first_name, st.last_name
      FROM school_notification_log l
      LEFT JOIN school_students st ON st.id=l.student_id
     WHERE l.app_id=$1 ORDER BY l.created_at DESC LIMIT 50
  `, [appId]);
  const [counts] = await execQ(pool, `
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE created_at::date=current_date)::int AS today
      FROM school_notification_log WHERE app_id=$1
  `, [appId]);

  res.json({ ok: true, rules, logs, counts });
}));

schoolRouter.post('/automations', route(async (req, res) => {
  if (!guard(req, res, 'automation.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const code = text(req.body?.code).toUpperCase();
  if (!code) return res.status(400).json({ error: 'Rule code is required' });
  const [row] = await execQ(pool, `
    INSERT INTO school_automation_rules (app_id, code, name, event_type, channels, enabled, template, config)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
    ON CONFLICT (app_id, code) DO UPDATE SET
      name=excluded.name, event_type=excluded.event_type, channels=excluded.channels,
      enabled=excluded.enabled, template=excluded.template, config=excluded.config
    RETURNING *
  `, [
    appId, code,
    text(req.body?.name) || code,
    text(req.body?.eventType) || 'custom',
    text(req.body?.channels) || 'whatsapp',
    req.body?.enabled !== false,
    text(req.body?.template) || '',
    JSON.stringify(req.body?.config || {}),
  ]);
  res.json({ ok: true, rule: row });
}));

schoolRouter.post('/automations/run', route(async (req, res) => {
  if (!guard(req, res, 'automation.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  await ensureSeed(pool, appId);

  const rules = await execQ(pool,
    'SELECT * FROM school_automation_rules WHERE app_id=$1 AND enabled=true', [appId]);
  const byCode = Object.fromEntries(rules.map((r) => [r.code, r]));
  const channelsOf = (rule) => String(rule.channels || 'whatsapp').split(',').map((s) => s.trim()).filter(Boolean);

  let feeReminders = 0;
  const feeRule = byCode.FEE_OVERDUE;
  if (feeRule) {
    const cfg = feeRule.config || {};
    const invoices = await execQ(pool, `
      SELECT i.id, i.student_id, i.title, i.due_date, (i.amount - i.paid_amount) AS balance,
             st.first_name, st.last_name, st.guardian_name, st.guardian_phone, st.guardian_email,
             (SELECT count(*) FROM school_notification_log l
               WHERE l.app_id=i.app_id AND l.rule_code='FEE_OVERDUE' AND l.invoice_id=i.id)::int AS reminders,
             (SELECT max(created_at) FROM school_notification_log l
               WHERE l.app_id=i.app_id AND l.rule_code='FEE_OVERDUE' AND l.invoice_id=i.id) AS last_sent
        FROM school_fee_invoices i
        JOIN school_students st ON st.id=i.student_id
       WHERE i.app_id=$1 AND i.status<>'paid' AND i.due_date < current_date AND st.deleted_at IS NULL
    `, [appId]);

    for (const inv of invoices) {
      const days = Math.max(1, Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 864e5));
      if (days < Number(cfg.daysAfterDue ?? 1)) continue;
      if (inv.reminders >= Number(cfg.maxReminders ?? 5)) continue;
      if (inv.last_sent) {
        const since = (Date.now() - new Date(inv.last_sent).getTime()) / 864e5;
        if (since < Number(cfg.repeatEveryDays ?? 3)) continue;
      }
      const vars = {
        guardian: inv.guardian_name || 'Parent',
        student: `${inv.first_name} ${inv.last_name || ''}`.trim(),
        invoice: inv.title,
        days,
        amount: Number(inv.balance).toFixed(2),
      };
      const message = render(feeRule.template, vars);
      for (const channel of channelsOf(feeRule)) {
        const recipient = channel === 'email' ? inv.guardian_email : inv.guardian_phone;
        await execQ(pool, `
          INSERT INTO school_notification_log
            (app_id, rule_code, student_id, invoice_id, channel, recipient, message, status)
          VALUES ($1,'FEE_OVERDUE',$2,$3,$4,$5,$6,'queued')
        `, [appId, inv.student_id, inv.id, channel, recipient, message]);
        feeReminders++;
      }
    }
  }

  let absenceAlerts = 0;
  const absenceRule = byCode.ABSENCE_ALERT;
  if (absenceRule) {
    const rows = await execQ(pool, `
      SELECT e.student_id, r.register_date AS attendance_date, st.first_name, st.last_name,
             st.guardian_name, st.guardian_phone, st.guardian_email
        FROM school_attendance_entry e
        JOIN school_attendance_register r ON r.id = e.register_id AND r.app_id = e.app_id
        JOIN school_attendance_policy p ON p.id = e.policy_id AND p.app_id = e.app_id
        JOIN school_students st ON st.id = e.student_id AND st.app_id = e.app_id
       WHERE e.app_id=$1 AND r.register_date=current_date AND p.category='absent' AND st.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM school_notification_log l
            WHERE l.app_id=e.app_id AND l.rule_code='ABSENCE_ALERT'
              AND l.student_id=e.student_id AND l.created_at::date=current_date)
    `, [appId]);

    for (const row of rows) {
      const vars = {
        guardian: row.guardian_name || 'Parent',
        student: `${row.first_name} ${row.last_name || ''}`.trim(),
        date: new Date(row.attendance_date).toISOString().slice(0, 10),
      };
      const message = render(absenceRule.template, vars);
      for (const channel of channelsOf(absenceRule)) {
        const recipient = channel === 'email' ? row.guardian_email : row.guardian_phone;
        await execQ(pool, `
          INSERT INTO school_notification_log
            (app_id, rule_code, student_id, channel, recipient, message, status)
          VALUES ($1,'ABSENCE_ALERT',$2,$3,$4,$5,'queued')
        `, [appId, row.student_id, channel, recipient, message]);
        absenceAlerts++;
      }
    }
  }

  const [today] = await execQ(pool, `
    SELECT count(*)::int AS n FROM school_notification_log
     WHERE app_id=$1 AND created_at::date=current_date
  `, [appId]);

  res.json({ ok: true, feeReminders, absenceAlerts, todayTotal: today.n, simulated: true });
}));

schoolRouter.delete('/automations/logs', route(async (req, res) => {
  if (!guard(req, res, 'automation.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  await execQ(pool, 'DELETE FROM school_notification_log WHERE app_id=$1', [appId]);
  res.json({ ok: true });
}));
