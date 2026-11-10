import { Router } from 'express';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { ensureFoundation, loadAccess, can, writeAudit } from '../school/foundation.js';
import { resolveTeacher } from '../school/staff.js';

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

function route(fn) {
  return (req, res) => {
    Promise.resolve(fn(req, res)).catch((err) => {
      console.error('[school]', err.message);
      res.status(500).json({ error: err.message || 'School API error' });
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
});

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
});

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
});

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
});

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
});

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
});

/* ---------- documents ---------- */

schoolRouter.get('/document-types', route(async (req, res) => {
  if (!guard(req, res, 'students.view')) return;
  const pool = getPool();
  const rows = await execQ(pool,
    'SELECT * FROM school_document_types WHERE app_id=$1 ORDER BY sort_order, name', [appIdOf(req)]);
  res.json({ ok: true, types: rows });
});

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
});

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
});

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
});

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
});

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
});

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
});

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
});

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
});

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
});

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
});

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
});

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
});

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
});

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
  return r.rows[0]?.id || null;
}

async function validateSectionAndYear(pool, appId, sectionId, yearId) {
  const r = await execQ(pool, `
    SELECT s.id, c.id AS class_id, c.name AS class_name, sec.name AS section_name
      FROM school_sections sec
      JOIN school_classes c ON c.id = sec.class_id AND c.app_id = sec.app_id
     WHERE sec.app_id=$1 AND sec.id=$2
  `, [appId, sectionId]);
  if (!r.rows[0]) return null;
  if (yearId && r.rows[0].class_id) {
    const y = await execQ(pool, 'SELECT id FROM school_academic_years WHERE id=$1 AND app_id=$2', [yearId, appId]);
    if (!y.rows[0]) return null;
  }
  return r.rows[0];
}

function dayOf(v) {
  return v === undefined || v === null || v === '' ? null : (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
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
      LEFT JOIN school_student_enrollments en
        ON en.student_id = s.id AND en.app_id = s.app_id
       AND en.status = 'studying'
       AND en.joined_on <= $3 AND (en.left_on IS NULL OR en.left_on >= $3)
     WHERE s.app_id=$1 AND s.section_id=$2 AND s.status='active' AND s.deleted_at IS NULL
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
       AND (applies_to_all=true OR ($3 IS NOT NULL AND section_ids && $4::int[]))
  `, [appId, registerDate, sectionId, sectionId ? JSON.stringify([sectionId]) : '{}']);
  return rows;
}

/* Get approved student leave covering a date for students in a section. */
async function getApprovedLeaveForDate(pool, appId, sectionId, registerDate) {
  const rows = await execQ(pool, `
    SELECT l.student_id, l.leave_type, l.reason
      FROM school_student_leave l
      JOIN school_students s ON s.id = l.student_id AND s.app_id = l.app_id
      LEFT JOIN school_student_enrollments en ON en.app_id=l.app_id AND en.student_id=l.student_id
         AND en.status='studying' AND en.joined_on <= $2 AND (en.left_on IS NULL OR en.left_on >= $2)
     WHERE l.app_id=$1 AND l.status='approved'
       AND l.start_date <= $2 AND l.end_date >= $2
       AND COALESCE(en.section_id, s.section_id) = $3
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

/* Find policy id by code for an app. */
async function findPolicyByCode(pool, appId, code) {
  const r = await execQ(pool, 'SELECT id, category, counts_as_present FROM school_attendance_policy WHERE app_id=$1 AND code=$2 AND is_active=true LIMIT 1', [appId, code]);
  return r.rows[0] || null;
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

/* ---------- attendance policies ---------- */

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
});

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
  await writeAudit(pool, req, { action: 'attendance.policy.upsert', entity: 'school_attendance_policy', entityId: row.rows[0].id, after: row.rows[0] });
  res.json({ ok: true, policy: row.rows[0] });
});

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
           created_at, updated_at
      FROM school_attendance_settings
     WHERE app_id=$1 AND ($2 IS NULL OR campus_id=$2)
     ORDER BY campus_id NULLS LAST
  `, [appId, campusId || null]);
  res.json({ ok: true, settings: rows });
});

schoolRouter.put('/attendance/settings', route(async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const body = req.body || {};
  const campusId = num(body.campusId);
  if (!campusId) return res.status(400).json({ error: 'campusId is required' });
  const row = await execQ(pool, `
    INSERT INTO school_attendance_settings
      (app_id, campus_id, default_session_type, late_threshold_minutes,
       partial_threshold_minutes, auto_finalize_at, finalize_days_after,
       require_reason_for, notify_parents_on, notification_channels)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (app_id, campus_id) DO UPDATE SET
      default_session_type=excluded.default_session_type,
      late_threshold_minutes=excluded.late_threshold_minutes,
      partial_threshold_minutes=excluded.partial_threshold_minutes,
      auto_finalize_at=excluded.auto_finalize_at,
      finalize_days_after=excluded.finalize_days_after,
      require_reason_for=excluded.require_reason_for,
      notify_parents_on=excluded.notify_parents_on,
      notification_channels=excluded.notification_channels,
      updated_at=now()
    RETURNING *
  `, [appId, campusId, text(body.defaultSessionType) || 'daily',
    num(body.lateThresholdMinutes) || 15, num(body.partialThresholdMinutes) || 120,
    dayOf(body.autoFinalizeAt), num(body.finalizeDaysAfter) || 0,
    body.requireReasonFor ? JSON.stringify(body.requireReasonFor) : '["absent","late","excused"]',
    body.notifyParentsOn ? JSON.stringify(body.notifyParentsOn) : '["absent","late"]',
    body.notificationChannels ? JSON.stringify(body.notificationChannels) : '["app"]']);
  await writeAudit(pool, req, { action: 'attendance.settings.update', entity: 'school_attendance_settings', entityId: row.rows[0].id, after: row.rows[0] });
  res.json({ ok: true, settings: row.rows[0] });
});

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
});

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
    body.appliesToAll !== false, body.sectionIds ? JSON.stringify(body.sectionIds) : null,
    text(req.user?.userid) || null]);
  await writeAudit(pool, req, { action: 'attendance.calendar.upsert', entity: 'school_calendar_event', entityId: row.rows[0].id, after: row.rows[0] });
  res.json({ ok: true, calendar: row.rows[0] });
});

schoolRouter.delete('/attendance/calendar/:id', route(async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  await execQ(pool, 'DELETE FROM school_calendar_event WHERE app_id=$1 AND id=$2', [appId, id]);
  await writeAudit(pool, req, { action: 'attendance.calendar.delete', entity: 'school_calendar_event', entityId: id });
  res.json({ ok: true });
});

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
});

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
  if (!['medical', 'personal', 'emergency', 'family', 'other'].includes(leaveType)) return res.status(400).json({ error: 'Invalid leave type' });
  const [student] = await execQ(pool, 'SELECT id FROM school_students WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, studentId]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const row = await execQ(pool, `
    INSERT INTO school_student_leave
      (app_id, student_id, leave_type, start_date, end_date, reason, status, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,'pending',$7)
    RETURNING *
  `, [appId, studentId, leaveType, startDate, endDate, reason || null, text(req.user?.userid) || null]);
  await writeAudit(pool, req, { action: 'attendance.student_leave.create', entity: 'school_student_leave', entityId: row.rows[0].id, after: row.rows[0] });
  res.json({ ok: true, leave: row.rows[0] });
});

schoolRouter.put('/attendance/student-leave/:id', route(async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const body = req.body || {};
  const row = await execQ(pool, `
    UPDATE school_student_leave
       SET status=coalesce($3,status), approved_by=coalesce($4,approved_by),
           approved_at=coalesce($5,approved_at), rejection_reason=coalesce($6,rejection_reason),
           updated_at=now()
     WHERE app_id=$1 AND id=$2
     RETURNING *
  `, [appId, id, text(body.status), body.approvedBy ? text(body.approvedBy) : null,
    body.approved ? new Date().toISOString() : null, text(body.rejectionReason) || null]);
  if (!row.rows[0]) return res.status(404).json({ error: 'Leave request not found' });
  await writeAudit(pool, req, { action: 'attendance.student_leave.update', entity: 'school_student_leave', entityId: id, after: row.rows[0] });
  res.json({ ok: true, leave: row.rows[0] });
});

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
  if (date) { values.push(date); where.push(`r.register_date=$${values.length}`); }
  if (sectionId) { values.push(sectionId); where.push(`r.section_id=$${values.length}`); }
  if (state) { values.push(state); where.push(`r.state=$${values.length}`); }
  const rows = await execQ(pool, `
    SELECT r.id, r.app_id, r.academic_year_id, r.campus_id, r.section_id, r.session_id,
           r.register_date, r.state, r.version, r.created_by, r.submitted_by, r.finalized_by,
           r.submitted_at, r.finalized_at, r.cancelled_at, r.created_at, r.updated_at,
           c.name AS class_name, sec.name AS section_name,
           ay.name AS academic_year,
           (SELECT count(*) FROM school_attendance_entry e WHERE e.register_id=r.id)::int AS entry_count
      FROM school_attendance_register r
      LEFT JOIN school_classes c ON c.id = (SELECT class_id FROM school_sections WHERE id=r.section_id)
      LEFT JOIN school_sections sec ON sec.id = r.section_id
      LEFT JOIN school_academic_years ay ON ay.id = r.academic_year_id
     WHERE ${where.join(' AND ')}
     ORDER BY r.register_date DESC, sec.name, r.id DESC
  `, values);
  res.json({ ok: true, registers: rows });
});

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

  const markedBy = text(req.user?.userid) || null;
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
        VALUES ($1,$2,(SELECT campus_id FROM school_sections WHERE id=$3 AND app_id=$1),$3,$4,$5,'draft',1,$6)
        RETURNING *
    `, [appId, yearId, sectionId, sessionId, registerDate, markedBy]);
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
    const policies = await client.query('SELECT id, code, category, counts_as_present FROM school_attendance_policy WHERE app_id=$1 AND is_active=true', [appId]);
    const policyByCode = {};
    policies.rows.forEach((p) => { policyByCode[p.code] = p; });

    /* Pre-mark entries: holiday/closure -> all students excused; approved leave -> that student; event -> all students */
    const premarkedStudentIds = new Set();
    for (const student of roster) {
      let policy = null;
      let source = 'calendar';

      if (isHolidayOrClosure) {
        policy = policyByCode['HOLIDAY'] || policyByCode['A'] || null;
        premarkedStudentIds.add(student.id);
      } else if (leaveByStudent[student.id]) {
        policy = policyByCode['MEDICAL'] || policyByCode['LEAVE'] || policyByCode['E'] || null;
        premarkedStudentIds.add(student.id);
      } else if (calendarEvents.some((x) => x.event_type === 'event' || x.event_type === 'exam')) {
        policy = policyByCode['EVENT'] || policyByCode['SA'] || null;
        premarkedStudentIds.add(student.id);
      }

      if (policy) {
        await client.query(`
          INSERT INTO school_attendance_entry
            (app_id, register_id, student_id, policy_id, late_minutes, partial_minutes, remark, marked_by, source)
            VALUES ($1,$2,$3,$4,0,0,$5,$6,'system_premark')
          ON CONFLICT (register_id, student_id) DO NOTHING
        `, [appId, register.id, student.id, policy.id,
          isHolidayOrClosure ? `${calendarEvents.find((x) => x.event_type === 'holiday' || x.event_type === 'closure')?.label || 'Holiday/Closure'}` :
          leaveByStudent[student.id] ? `Approved ${leaveByStudent[student.id].leave_type} leave` :
          `Event: ${calendarEvents.find((x) => x.event_type === 'event' || x.event_type === 'exam')?.label || 'Event'}`,
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

  /* Resolve the enrolled roster for this register date using dated enrollment history */
  const roster = await resolveRosterForDate(pool, appId, reg.section_id, reg.register_date);

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
     ORDER BY s.roll_no NULLS LAST, s.first_name
  `, [appId, id]);

  const entryByStudent = {};
  entries.rows.forEach((e) => { entryByStudent[e.student_id] = e; });

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
});

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
    const [reg] = await execQ(pool, 'SELECT * FROM school_attendance_register WHERE app_id=$1 AND id=$2 FOR UPDATE', [appId, id]);
    if (!reg) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Register not found' }); }
    if (reg.state !== 'draft') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Register is not in draft state', state: reg.state }); }
    if (expectedVersion !== null && reg.version !== expectedVersion) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Version conflict - register was modified by another user', currentVersion: reg.version });
    }

    /* Validate all entries first */
    const errors = [];
    const validEntries = [];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const studentId = num(e.studentId ?? e.student_id);
      if (!studentId) { errors.push({ index: i, error: 'studentId is required' }); continue; }
      const [student] = await execQ(pool, 'SELECT id FROM school_students WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, studentId]);
      if (!student) { errors.push({ index: i, error: 'Student not found', studentId }); continue; }
      const policyCode = text(e.statusCode ?? e.status ?? 'P');
      const [policy] = await execQ(pool, 'SELECT id, category, requires_reason, counts_as_present FROM school_attendance_policy WHERE app_id=$1 AND code=$2 AND is_active=true', [appId, policyCode]);
      if (!policy) { errors.push({ index: i, error: `Invalid or inactive status code: ${policyCode}`, studentId }); continue; }
      if (policy.requires_reason && !text(e.reason) && !text(e.remark)) {
        errors.push({ index: i, error: `Reason required for ${policyCode}`, studentId });
        continue;
      }
      validEntries.push({ studentId, policyId: policy.id, lateMinutes: num(e.lateMinutes ?? e.late_minutes) || 0,
        partialMinutes: num(e.partialMinutes ?? e.partial_minutes) || 0, remark: text(e.remark ?? e.reason) || null });
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
    await client.query('UPDATE school_attendance_register SET updated_at=now() WHERE id=$1', [id]);
    await writeAudit(pool, req, { action: 'attendance.register.entries.save', entity: 'school_attendance_register', entityId: id, after: { entryCount: validEntries.length } });
    await client.query('COMMIT');
    const saved = await execQ(pool, 'SELECT count(*)::int AS n FROM school_attendance_entry WHERE register_id=$1', [id]);
    res.json({ ok: true, saved: validEntries.length, registerId: id, version: reg.version, totalEntries: saved.rows[0].n });
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
    const [reg] = await execQ(pool, 'SELECT * FROM school_attendance_register WHERE app_id=$1 AND id=$2 FOR UPDATE', [appId, id]);
    if (!reg) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Register not found' }); }
    if (reg.state !== 'draft') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Register is not in draft state', state: reg.state }); }
    if (expectedVersion !== null && reg.version !== expectedVersion) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Version conflict', currentVersion: reg.version });
    }
    const entryCount = await execQ(pool, 'SELECT count(*)::int AS n FROM school_attendance_entry WHERE register_id=$1', [id]);
    if (entryCount.rows[0].n === 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'No entries to submit' }); }
    await client.query(`
      UPDATE school_attendance_register SET state='submitted', submitted_by=$2, submitted_at=now(), updated_at=now()
      WHERE id=$1 RETURNING *
    `, [id, text(req.user?.userid) || null]);
    await writeAudit(pool, req, { action: 'attendance.register.submit', entity: 'school_attendance_register', entityId: id, after: { state: 'submitted', version: reg.version } });
    await client.query('COMMIT');
    res.json({ ok: true, registerId: id, state: 'submitted', version: reg.version });
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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const [reg] = await execQ(pool, 'SELECT * FROM school_attendance_register WHERE app_id=$1 AND id=$2 FOR UPDATE', [appId, id]);
    if (!reg) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Register not found' }); }
    if (reg.state === 'finalized') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Register already finalized' }); }
    await client.query(`
      UPDATE school_attendance_register SET state='finalized', finalized_by=$2, finalized_at=now(), updated_at=now()
      WHERE id=$1 AND state IN ('draft','submitted') RETURNING *
    `, [id, text(req.user?.userid) || null]);
    await writeAudit(pool, req, { action: 'attendance.register.finalize', entity: 'school_attendance_register', entityId: id, after: { state: 'finalized' } });
    await client.query('COMMIT');
    res.json({ ok: true, registerId: id, state: 'finalized' });
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
    const [reg] = await execQ(pool, 'SELECT * FROM school_attendance_register WHERE app_id=$1 AND id=$2 FOR UPDATE', [appId, id]);
    if (!reg) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Register not found' }); }
    if (reg.state !== 'finalized' && reg.state !== 'submitted') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Cannot reopen register in state: ' + reg.state }); }
    await client.query(`
      UPDATE school_attendance_register SET state='draft', version=version+1, updated_at=now()
      WHERE id=$1 RETURNING *
    `, [id]);
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
  const rows = await execQ(pool, `
    SELECT c.id, c.entry_id, c.register_id, c.student_id, c.old_policy_id, c.new_policy_id,
           c.old_late_minutes, c.new_late_minutes, c.old_partial_minutes, c.new_partial_minutes,
           c.old_remark, c.new_remark, c.reason, c.requested_by, c.requested_at,
           c.reviewed_by, c.reviewed_at, c.decision, c.decision_reason, c.processed_at,
           s.admission_no, s.first_name, s.last_name
      FROM school_attendance_correction c
      JOIN school_students s ON s.id = c.student_id AND s.app_id = c.app_id
     WHERE ${where.join(' AND ')}
     ORDER BY c.requested_at DESC
  `, values);
  res.json({ ok: true, corrections: rows });
});

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
  const [entry] = await execQ(pool, 'SELECT * FROM school_attendance_entry WHERE id=$1 AND app_id=$2', [entryId, appId]);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  const row = await execQ(pool, `
    INSERT INTO school_attendance_correction
      (app_id, entry_id, register_id, student_id, old_policy_id, new_policy_id,
       old_late_minutes, new_late_minutes, old_partial_minutes, new_partial_minutes,
       old_remark, new_remark, reason, requested_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    RETURNING *
  `, [appId, entryId, registerId, studentId, entry.policy_id, newPolicyId,
    entry.late_minutes, num(body.newLateMinutes) || null,
    entry.partial_minutes, num(body.newPartialMinutes) || null,
    entry.remark, text(body.newRemark) || null, reason, text(req.user?.userid) || null]);
  await writeAudit(pool, req, { action: 'attendance.correction.request', entity: 'school_attendance_correction', entityId: row.rows[0].id, after: row.rows[0] });
  res.json({ ok: true, correction: row.rows[0] });
});

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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      UPDATE school_attendance_correction
       SET decision=$3, reviewed_by=$4, reviewed_at=now(), decision_reason=$5, processed_at=now()
       WHERE app_id=$1 AND id=$2
    `, [appId, id, decision, text(req.user?.userid) || null, text(body.decisionReason) || null]);
    if (decision === 'approved') {
      await client.query(`
        UPDATE school_attendance_entry
           SET policy_id=$2, late_minutes=coalesce($3,late_minutes), partial_minutes=coalesce($4,partial_minutes),
               remark=coalesce($5,remark), marked_by=coalesce($6,marked_by), updated_at=now()
           WHERE id=$1
      `, [corr.entry_id, corr.new_policy_id, corr.new_late_minutes, corr.new_partial_minutes, corr.new_remark, text(req.user?.userid) || null]);
    }
    await writeAudit(pool, req, { action: 'attendance.correction.decision', entity: 'school_attendance_correction', entityId: id, after: { decision } });
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
           e.name AS employee_name, e.employee_code, e.designation
      FROM school_staff_attendance a
      JOIN school_hr_employees e ON e.id = a.employee_id AND e.app_id = a.app_id
     WHERE ${where.join(' AND ')}
     ORDER BY a.attendance_date DESC, e.name
  `, values);
  res.json({ ok: true, staff: rows });
});

schoolRouter.post('/attendance/staff', route(async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const body = req.body || {};
  const employeeId = num(body.employeeId);
  const attendanceDate = dayOf(body.attendanceDate);
  if (!employeeId || !attendanceDate) return res.status(400).json({ error: 'employeeId and attendanceDate are required' });
  const [emp] = await execQ(pool, 'SELECT id FROM school_hr_employees WHERE app_id=$1 AND id=$2', [appId, employeeId]);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });
  const row = await execQ(pool, `
    INSERT INTO school_staff_attendance
      (app_id, employee_id, attendance_date, check_in, check_out, status, leave_id, shift_id, marked_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (app_id, employee_id, attendance_date) DO UPDATE SET
      check_in=excluded.check_in, check_out=excluded.check_out, status=excluded.status,
      leave_id=excluded.leave_id, shift_id=excluded.shift_id, marked_by=excluded.marked_by,
      updated_at=now()
    RETURNING *
  `, [appId, employeeId, attendanceDate, dayOf(body.checkIn), dayOf(body.checkOut),
    text(body.status) || 'present', num(body.leaveId) || null, num(body.shiftId) || null,
    text(req.user?.userid) || null]);
  await writeAudit(pool, req, { action: 'attendance.staff.upsert', entity: 'school_staff_attendance', entityId: row.rows[0].id, after: row.rows[0] });
  res.json({ ok: true, staff: row.rows[0] });
});

/* ---------- staff leave ---------- */

schoolRouter.get('/attendance/staff-leave', route(async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const employeeId = num(req.query.employeeId);
  const rows = await execQ(pool, `
    SELECT l.id, l.employee_id, l.leave_type, l.start_date, l.end_date, l.reason,
           l.status, l.approved_by, l.approved_at, l.created_by, l.created_at, l.updated_at,
           e.name AS employee_name
      FROM school_staff_leave l
      JOIN school_hr_employees e ON e.id = l.employee_id AND e.app_id = l.app_id
     WHERE l.app_id=$1 AND ($2 IS NULL OR l.employee_id=$2)
     ORDER BY l.start_date DESC
  `, [appId, employeeId || null]);
  res.json({ ok: true, staffLeave: rows });
});

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
  if (!['casual', 'sick', 'earned', 'maternity', 'paternity', 'study', 'other'].includes(leaveType)) return res.status(400).json({ error: 'Invalid leave type' });
  const row = await execQ(pool, `
    INSERT INTO school_staff_leave
      (app_id, employee_id, leave_type, start_date, end_date, reason, status, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,'pending',$7)
    RETURNING *
  `, [appId, employeeId, leaveType, startDate, endDate, text(body.reason) || null, text(req.user?.userid) || null]);
  await writeAudit(pool, req, { action: 'attendance.staff_leave.create', entity: 'school_staff_leave', entityId: row.rows[0].id, after: row.rows[0] });
  res.json({ ok: true, staffLeave: row.rows[0] });
});

/* ---------- summary (new model) ---------- */

schoolRouter.get('/attendance/summary', route(async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const from = dayOf(req.query.from) || new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  const to = dayOf(req.query.to) || new Date().toISOString().slice(0, 10);
  const sectionId = num(req.query.sectionId);
  const where = ['r.app_id=$1', 'r.register_date BETWEEN $2 AND $3'];
  const values = [appId, from, to];
  if (sectionId) { values.push(sectionId); where.push(`r.section_id=$${values.length}`); }
  const rows = await execQ(pool, `
    SELECT st.id, st.admission_no, st.first_name, st.last_name,
           c.name AS class_name, sec.name AS section_name,
           count(e.*)::int AS marked,
           count(*) FILTER (WHERE p.category='present')::int AS present,
           count(*) FILTER (WHERE p.category='absent')::int AS absent,
           count(*) FILTER (WHERE p.category='late')::int AS late,
           count(*) FILTER (WHERE p.category='excused')::int AS excused,
           count(*) FILTER (WHERE p.category='activity')::int AS activity,
           count(*) FILTER (WHERE p.category='partial')::int AS partial
      FROM school_students st
      LEFT JOIN school_student_enrollments en ON en.app_id=st.app_id AND en.student_id=st.id
           AND en.status='studying'
      LEFT JOIN school_attendance_register r ON r.app_id=st.app_id AND r.section_id=en.section_id
           AND r.register_date BETWEEN $2 AND $3
      LEFT JOIN school_attendance_entry e ON e.register_id=r.id AND e.student_id=st.id
      LEFT JOIN school_attendance_policy p ON p.id=e.policy_id AND p.app_id=e.app_id
      LEFT JOIN school_classes c ON c.id = st.class_id
      LEFT JOIN school_sections sec ON sec.id = st.section_id
     WHERE st.app_id=$1 AND st.status='active' AND st.deleted_at IS NULL
     GROUP BY st.id, c.name, sec.name, c.sort_order
     ORDER BY c.sort_order NULLS LAST, sec.name, st.first_name
  `, values);
  res.json({ ok: true, from, to, students: rows });
});

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
});

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
});

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
});

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
});

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
});

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
});

schoolRouter.delete('/automations/logs', route(async (req, res) => {
  if (!guard(req, res, 'automation.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  await execQ(pool, 'DELETE FROM school_notification_log WHERE app_id=$1', [appId]);
  res.json({ ok: true });
});
