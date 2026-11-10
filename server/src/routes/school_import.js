/* ============================================================
   Import & Export — Backend Routes
   Mounted at /api/school/import
   ============================================================ */
import express from 'express';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { ensureFoundation, loadAccess, writeAudit } from '../school/foundation.js';

const importRouter = express.Router();

importRouter.use(verifyToken);
importRouter.use(async (req, _res, next) => {
  if (!req.school) {
    const pool = getPool();
    const appId = req.user?.company || DEFAULT_COMPANY_ID;
    await ensureFoundation(pool, appId);
    req.school = await loadAccess(pool, appId, req.user);
  }
  next();
});

const num = (v) => { if (v === undefined || v === null || v === '') return null; const n = Number(v); return Number.isNaN(n) ? null : n; };
const text = (v) => (v === undefined || v === null ? null : String(v).trim());
const bool = (v, def = false) => v === undefined || v === null ? def : (v === true || v === 'true' || v === 1 || v === '1');
const tsOf = (v) => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString(); };
const appIdOf = (req) => req.user?.company || DEFAULT_COMPANY_ID;
const userOf = (req) => req.user?.userid || req.user?.sub || 'SYSTEM';
const guardView = (req, res) => { if (!req.school?.permissions?.includes('import.view') && !req.school?.isSuper) { res.status(403).json({ ok: false, error: 'Insufficient permissions' }); return false; } return true; };
const guard = (req, res, perm) => { if (!req.school?.permissions?.includes(perm) && !req.school?.isSuper) { res.status(403).json({ ok: false, error: 'Insufficient permissions' }); return false; } return true; };
const fail = (code, msg) => { const e = new Error(msg); e.statusCode = code; throw e; };

function route(fn) {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (e) {
      const code = e.statusCode || 500;
      res.status(code).json({ ok: false, error: e.message || 'Internal error' });
    }
  };
}

/* ---------- Helpers: Generate CSV templates ---------- */
function generateStudentTemplate() {
  return `admission_no,first_name,last_name,middle_name,gender,dob,class_id,section_id,roll_no,guardian_name,guardian_phone,guardian_email,address,admission_date,status,blood_group,nationality,category,previous_school,national_id,house,campus_id,father_name,father_occupation,father_contact,father_email,mother_name,mother_occupation,mother_contact,mother_email
ADM001,John,Doe,,Male,2010-05-15,1,1,1,Jane Doe,9876543210,jane@email.com,"123 Main St",2023-04-01,active,O+,Indian,General,Previous School,,A,1,John Sr,Engineer,9876543211,john@email.com,Jane Sr,Teacher,9876543212,jane@email.com
ADM002,Jane,Smith,,Female,2011-08-20,1,1,2,Robert Smith,9876543213,robert@email.com,"456 Oak Ave",2023-04-01,active,A+,Indian,OBC,Another School,,B,1,Robert Sr,Doctor,9876543214,robert@email.com,Mary Sr,Nurse,9876543215,mary@email.com`;
}

function generateFeeTemplate() {
  return `admission_no,fee_head_id,amount,due_date,invoice_date,description,status
ADM001,1,5000,2024-05-15,2024-04-01,"Tuition Fee - May 2024",unpaid
ADM002,1,5000,2024-05-15,2024-04-01,"Tuition Fee - May 2024",unpaid
ADM001,2,2000,2024-06-01,2024-05-01,"Transport Fee - Jun 2024",unpaid`;
}

function generateAttendanceTemplate() {
  return `date,section_id,admission_no,status_code,late_minutes,remark
2024-05-15,1,ADM001,P,0,
2024-05-15,1,ADM002,A,0,"Sick leave"
2024-05-15,1,ADM003,L,15,"Traffic delay"`;
}

/* ---------- Import Templates (Download) ---------- */
importRouter.get('/students/template', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const csv = generateStudentTemplate();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="student_import_template.csv"');
  res.send(csv);
}));

importRouter.get('/fees/template', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const csv = generateFeeTemplate();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="fee_import_template.csv"');
  res.send(csv);
}));

importRouter.get('/attendance/template', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const csv = generateAttendanceTemplate();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="attendance_import_template.csv"');
  res.send(csv);
}));

/* ---------- Import Validation ---------- */
async function validateStudentRows(rows, appId, pool) {
  const results = [];
  const classMap = new Map();
  const sectionMap = new Map();

  // Pre-load classes and sections for validation
  const classes = await execQ(pool, `SELECT id, name FROM school_classes WHERE app_id=$1 AND is_active=true`, [appId]);
  const sections = await execQ(pool, `SELECT id, name, class_id FROM school_sections WHERE app_id=$1 AND is_active=true`, [appId]);
  classes.forEach(c => classMap.set(c.name.toLowerCase(), c.id));
  sections.forEach(s => sectionMap.set(`${s.class_id}:${s.name}`, s.id));

  const existingAdmissions = await execQ(pool, `SELECT admission_no FROM school_students WHERE app_id=$1 AND deleted_at IS NULL`, [appId]);
  const admissionSet = new Set(existingAdmissions.map(r => r.admission_no.toLowerCase()));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const errors = [];
    const warnings = [];

    // Required fields
    if (!row.admission_no) errors.push({ field: 'admission_no', message: 'Required' });
    if (!row.first_name) errors.push({ field: 'first_name', message: 'Required' });
    if (!row.last_name) errors.push({ field: 'last_name', message: 'Required' });

    // Admission number uniqueness
    if (row.admission_no && admissionSet.has(row.admission_no.toLowerCase())) {
      errors.push({ field: 'admission_no', message: 'Already exists' });
    }
    if (row.admission_no) admissionSet.add(row.admission_no.toLowerCase());

    // Class/Section validation
    let classId = null, sectionId = null;
    if (row.class_id) {
      if (classMap.has(row.class_id.toLowerCase())) {
        classId = classMap.get(row.class_id.toLowerCase());
      } else {
        errors.push({ field: 'class_id', message: `Class "${row.class_id}" not found` });
      }
    }
    if (row.section_id && classId) {
      const key = `${classId}:${row.section_id}`;
      if (sectionMap.has(key)) {
        sectionId = sectionMap.get(key);
      } else {
        errors.push({ field: 'section_id', message: `Section "${row.section_id}" not found in class` });
      }
    }

    // Date validation
    let dob = null, admissionDate = null;
    if (row.dob) {
      const d = new Date(row.dob);
      if (isNaN(d.getTime())) errors.push({ field: 'dob', message: 'Invalid date format (YYYY-MM-DD)' });
      else dob = d.toISOString().split('T')[0];
    }
    if (row.admission_date) {
      const d = new Date(row.admission_date);
      if (isNaN(d.getTime())) errors.push({ field: 'admission_date', message: 'Invalid date format (YYYY-MM-DD)' });
      else admissionDate = d.toISOString().split('T')[0];
    }

    // Gender validation
    if (row.gender && !['Male', 'Female', 'Other'].includes(row.gender)) {
      warnings.push({ field: 'gender', message: 'Expected Male/Female/Other' });
    }

    // Status validation
    if (row.status && !['active', 'inactive', 'left', 'graduated'].includes(row.status.toLowerCase())) {
      warnings.push({ field: 'status', message: 'Expected active/inactive/left/graduated' });
    }

    results.push({
      row_number: i + 1,
      status: errors.length ? 'invalid' : (warnings.length ? 'warning' : 'valid'),
      raw_data: row,
      validated_data: { ...row, classId, sectionId, dob, admission_date: admissionDate },
      errors,
      warnings,
    });
  }
  return results;
}

async function validateFeeRows(rows, appId, pool) {
  const results = [];
  const admissionMap = new Map();
  const feeHeadMap = new Map();

  const students = await execQ(pool, `SELECT id, admission_no FROM school_students WHERE app_id=$1 AND deleted_at IS NULL`, [appId]);
  students.forEach(s => admissionMap.set(s.admission_no.toLowerCase(), s.id));

  const feeHeads = await execQ(pool, `SELECT id, name FROM school_fee_head WHERE app_id=$1 AND deleted_at IS NULL`, [appId]);
  feeHeads.forEach(f => feeHeadMap.set(f.name.toLowerCase(), f.id));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const errors = [];
    const warnings = [];

    if (!row.admission_no) errors.push({ field: 'admission_no', message: 'Required' });
    else if (!admissionMap.has(row.admission_no.toLowerCase())) {
      errors.push({ field: 'admission_no', message: `Student not found` });
    }

    if (!row.fee_head_id) errors.push({ field: 'fee_head_id', message: 'Required' });
    else if (!feeHeadMap.has(row.fee_head_id.toLowerCase())) {
      errors.push({ field: 'fee_head_id', message: `Fee head "${row.fee_head_id}" not found` });
    }

    if (!row.amount || isNaN(Number(row.amount))) errors.push({ field: 'amount', message: 'Valid number required' });

    if (!row.due_date) errors.push({ field: 'due_date', message: 'Required' });
    else {
      const d = new Date(row.due_date);
      if (isNaN(d.getTime())) errors.push({ field: 'due_date', message: 'Invalid date format (YYYY-MM-DD)' });
    }

    results.push({
      row_number: i + 1,
      status: errors.length ? 'invalid' : (warnings.length ? 'warning' : 'valid'),
      raw_data: row,
      validated_data: { ...row, student_id: admissionMap.get(row.admission_no?.toLowerCase()), fee_head_id: feeHeadMap.get(row.fee_head_id?.toLowerCase()) },
      errors,
      warnings,
    });
  }
  return results;
}

async function validateAttendanceRows(rows, appId, pool) {
  const results = [];
  const admissionSet = new Map();
  const sectionMap = new Map();

  const students = await execQ(pool, `SELECT id, admission_no, section_id FROM school_students WHERE app_id=$1 AND deleted_at IS NULL AND status='active'`, [appId]);
  students.forEach(s => admissionSet.set(s.admission_no.toLowerCase(), { id: s.id, section_id: s.section_id }));

  const sections = await execQ(pool, `SELECT id, name FROM school_sections WHERE app_id=$1 AND is_active=true`, [appId]);
  sections.forEach(s => sectionMap.set(s.name.toLowerCase(), s.id));

  const policies = await execQ(pool, `SELECT code FROM school_attendance_policy WHERE app_id=$1 AND is_active=true`, [appId]);
  const policySet = new Set(policies.map(p => p.code));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const errors = [];
    const warnings = [];

    if (!row.date) errors.push({ field: 'date', message: 'Required' });
    else {
      const d = new Date(row.date);
      if (isNaN(d.getTime())) errors.push({ field: 'date', message: 'Invalid date format (YYYY-MM-DD)' });
    }

    if (!row.section_id) errors.push({ field: 'section_id', message: 'Required' });
    else if (!sectionMap.has(row.section_id.toLowerCase())) {
      errors.push({ field: 'section_id', message: `Section "${row.section_id}" not found` });
    }

    if (!row.admission_no) errors.push({ field: 'admission_no', message: 'Required' });
    else if (!admissionSet.has(row.admission_no.toLowerCase())) {
      errors.push({ field: 'admission_no', message: `Active student not found` });
    }

    if (!row.status_code) errors.push({ field: 'status_code', message: 'Required' });
    else if (!policySet.has(row.status_code)) {
      errors.push({ field: 'status_code', message: `Invalid status code "${row.status_code}"` });
    }

    if (row.late_minutes && isNaN(Number(row.late_minutes))) {
      warnings.push({ field: 'late_minutes', message: 'Should be a number' });
    }

    results.push({
      row_number: i + 1,
      status: errors.length ? 'invalid' : (warnings.length ? 'warning' : 'valid'),
      raw_data: row,
      validated_data: { ...row, student_id: admissionSet.get(row.admission_no?.toLowerCase())?.id, section_id: sectionMap.get(row.section_id?.toLowerCase()) },
      errors,
      warnings,
    });
  }
  return results;
}

/* ---------- Import Validate Endpoints ---------- */
importRouter.post('/students/validate', route(async (req, res) => {
  if (!guard(req, res, 'import.students')) return;
  const { rows } = req.body || {};
  if (!Array.isArray(rows)) fail(400, 'rows array required');
  const results = await validateStudentRows(rows, appIdOf(req), getPool());
  const valid = results.filter(r => r.status === 'valid').length;
  const invalid = results.filter(r => r.status === 'invalid').length;
  const warning = results.filter(r => r.status === 'warning').length;
  res.json({ ok: true, results, summary: { total: rows.length, valid, invalid, warning } });
}));

importRouter.post('/fees/validate', route(async (req, res) => {
  if (!guard(req, res, 'import.fees')) return;
  const { rows } = req.body || {};
  if (!Array.isArray(rows)) fail(400, 'rows array required');
  const results = await validateFeeRows(rows, appIdOf(req), getPool());
  const valid = results.filter(r => r.status === 'valid').length;
  const invalid = results.filter(r => r.status === 'invalid').length;
  const warning = results.filter(r => r.status === 'warning').length;
  res.json({ ok: true, results, summary: { total: rows.length, valid, invalid, warning } });
}));

importRouter.post('/attendance/validate', route(async (req, res) => {
  if (!guard(req, res, 'import.attendance')) return;
  const { rows } = req.body || {};
  if (!Array.isArray(rows)) fail(400, 'rows array required');
  const results = await validateAttendanceRows(rows, appIdOf(req), getPool());
  const valid = results.filter(r => r.status === 'valid').length;
  const invalid = results.filter(r => r.status === 'invalid').length;
  const warning = results.filter(r => r.status === 'warning').length;
  res.json({ ok: true, results, summary: { total: rows.length, valid, invalid, warning } });
}));

/* ---------- Import Commit ---------- */
async function commitStudentRows(jobId, validRows, appId, pool, userId) {
  let committed = 0;
  for (const row of validRows) {
    const v = row.validated_data;
    try {
      const result = await execQ(pool, `
        INSERT INTO school_students (app_id, admission_no, first_name, last_name, middle_name, gender, dob, class_id, section_id, roll_no, guardian_name, guardian_phone, guardian_email, address, admission_date, status, blood_group, nationality, category, previous_school, national_id, house, campus_id, father_name, father_occupation, father_contact, father_email, mother_name, mother_occupation, mother_contact, mother_email)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32) RETURNING id
      `, [appId, v.admission_no, v.first_name, v.last_name, v.middle_name || '', v.gender, v.dob, v.classId, v.sectionId, v.roll_no || '', v.guardian_name || '', v.guardian_phone || '', v.guardian_email || '', v.address || '', v.admission_date || new Date().toISOString().split('T')[0], v.status || 'active', v.blood_group || '', v.nationality || '', v.category || '', v.previous_school || '', v.national_id || '', v.house || '', v.campus_id || '', v.father_name || '', v.father_occupation || '', v.father_contact || '', v.father_email || '', v.mother_name || '', v.mother_occupation || '', v.mother_contact || '', v.mother_email || '']);
      await execQ(pool, `UPDATE school_import_row SET status='committed', entity_id=$1, entity_type='student' WHERE job_id=$2 AND row_number=$3`, [result[0].id, jobId, row.row_number]);
      committed++;
    } catch (e) {
      await execQ(pool, `UPDATE school_import_row SET status='error', errors=$1 WHERE job_id=$2 AND row_number=$3`, [JSON.stringify([{ message: e.message }]), jobId, row.row_number]);
    }
  }
  return committed;
}

async function commitFeeRows(jobId, validRows, appId, pool, userId) {
  let committed = 0;
  for (const row of validRows) {
    const v = row.validated_data;
    try {
      const number = `IMP-${jobId}-${row.row_number}`;
      const result = await execQ(pool, `
        INSERT INTO school_invoice (app_id, student_id, number, date, due_date, status, total_amount, paid_amount, balance, created_by)
        VALUES ($1,$2,$3,COALESCE($4::date, CURRENT_DATE),$5,'issued',$6,0,$6,$7) RETURNING id
      `, [appId, v.student_id, number, v.invoice_date || new Date().toISOString().slice(0, 10), v.due_date, Number(v.amount), userId]);
      await execQ(pool, `
        INSERT INTO school_invoice_line (app_id, invoice_id, head_id, amount)
        VALUES ($1,$2,$3,$4)
      `, [appId, result[0].id, v.fee_head_id, Number(v.amount)]);
      await execQ(pool, `UPDATE school_import_row SET status='committed', entity_id=$1, entity_type='fee_invoice' WHERE job_id=$2 AND row_number=$3`, [result[0].id, jobId, row.row_number]);
      committed++;
    } catch (e) {
      await execQ(pool, `UPDATE school_import_row SET status='error', errors=$1 WHERE job_id=$2 AND row_number=$3`, [JSON.stringify([{ message: e.message }]), jobId, row.row_number]);
    }
  }
  return committed;
}

async function commitAttendanceRows(jobId, validRows, appId, pool, userId) {
  let committed = 0;
  const policies = await execQ(pool, `SELECT id, code FROM school_attendance_policy WHERE app_id=$1 AND is_active=true`, [appId]).catch(() => []);
  const policyByCode = new Map(policies.map((p) => [String(p.code).toUpperCase(), p.id]));
  for (const row of validRows) {
    const v = row.validated_data;
    try {
      // Find or create register
      let regResult = await execQ(pool, `
        SELECT id FROM school_attendance_register WHERE app_id=$1 AND section_id=$2 AND register_date=$3 AND cancelled_at IS NULL
      `, [appId, v.section_id, v.date]);
      let registerId;
      if (regResult.length === 0) {
        const newReg = await execQ(pool, `
          INSERT INTO school_attendance_register (app_id, section_id, register_date, state, version, created_by, source)
          VALUES ($1,$2,$3,'open',1,$4,'import') RETURNING id
        `, [appId, v.section_id, v.date, userId]);
        registerId = newReg[0].id;
      } else {
        registerId = regResult[0].id;
      }

      const policyId = policyByCode.get(String(v.status_code || '').toUpperCase()) || null;
      const result = await execQ(pool, `
        INSERT INTO school_attendance_entry (app_id, register_id, student_id, policy_id, late_minutes, remark, marked_by, source)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'import') RETURNING id
      `, [appId, registerId, v.student_id, policyId, v.late_minutes || 0, v.remark || '', userId]);
      await execQ(pool, `UPDATE school_import_row SET status='committed', entity_id=$1, entity_type='attendance_entry' WHERE job_id=$2 AND row_number=$3`, [result[0].id, jobId, row.row_number]);
      committed++;
    } catch (e) {
      await execQ(pool, `UPDATE school_import_row SET status='error', errors=$1 WHERE job_id=$2 AND row_number=$3`, [JSON.stringify([{ message: e.message }]), jobId, row.row_number]);
    }
  }
  return committed;
}

importRouter.post('/students/commit', route(async (req, res) => {
  if (!guard(req, res, 'import.students')) return;
  const { jobId, rows } = req.body || {};
  if (!num(jobId) || !Array.isArray(rows)) fail(400, 'jobId and rows array required');
  const validRows = rows.filter(r => r.status === 'valid');
  const committed = await commitStudentRows(jobId, validRows, appIdOf(req), getPool(), userOf(req));
  await execQ(getPool(), `UPDATE school_import_job SET committed_rows=$1, status='completed', completed_at=now() WHERE id=$2`, [committed, jobId]);
  res.json({ ok: true, committed });
}));

importRouter.post('/fees/commit', route(async (req, res) => {
  if (!guard(req, res, 'import.fees')) return;
  const { jobId, rows } = req.body || {};
  if (!num(jobId) || !Array.isArray(rows)) fail(400, 'jobId and rows array required');
  const validRows = rows.filter(r => r.status === 'valid');
  const committed = await commitFeeRows(jobId, validRows, appIdOf(req), getPool(), userOf(req));
  await execQ(getPool(), `UPDATE school_import_job SET committed_rows=$1, status='completed', completed_at=now() WHERE id=$2`, [committed, jobId]);
  res.json({ ok: true, committed });
}));

importRouter.post('/attendance/commit', route(async (req, res) => {
  if (!guard(req, res, 'import.attendance')) return;
  const { jobId, rows } = req.body || {};
  if (!num(jobId) || !Array.isArray(rows)) fail(400, 'jobId and rows array required');
  const validRows = rows.filter(r => r.status === 'valid');
  const committed = await commitAttendanceRows(jobId, validRows, appIdOf(req), getPool(), userOf(req));
  await execQ(getPool(), `UPDATE school_import_job SET committed_rows=$1, status='completed', completed_at=now() WHERE id=$2`, [committed, jobId]);
  res.json({ ok: true, committed });
}));

/* ---------- Import History ---------- */
importRouter.get('/students/history', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `SELECT * FROM school_import_job WHERE app_id=$1 AND import_type='students' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 50`, [appIdOf(req)]);
  res.json({ ok: true, jobs: rows });
}));

importRouter.get('/fees/history', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `SELECT * FROM school_import_job WHERE app_id=$1 AND import_type='fees' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 50`, [appIdOf(req)]);
  res.json({ ok: true, jobs: rows });
}));

importRouter.get('/attendance/history', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `SELECT * FROM school_import_job WHERE app_id=$1 AND import_type='attendance' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 50`, [appIdOf(req)]);
  res.json({ ok: true, jobs: rows });
}));

/* ---------- Export Templates ---------- */
importRouter.get('/export/templates', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `SELECT * FROM school_export_template WHERE app_id=$1 AND deleted_at IS NULL ORDER BY is_system DESC, name`, [appIdOf(req)]);
  res.json({ ok: true, templates: rows });
}));

importRouter.post('/export/templates', route(async (req, res) => {
  if (!guard(req, res, 'import.export')) return;
  const b = req.body || {};
  if (!text(b.name) || !text(b.export_type)) fail(400, 'Name and export_type required');
  const code = text(b.code) || text(b.name).toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
  const rows = await execQ(getPool(), `
    INSERT INTO school_export_template (app_id, code, name, description, export_type, query_config, format, is_system, created_by)
    VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,false,$8) RETURNING *
  `, [appIdOf(req), code, text(b.name), text(b.description), text(b.export_type), JSON.stringify(b.query_config || {}), text(b.format) || 'csv', userOf(req)]);
  res.json({ ok: true, template: rows[0] });
}));

importRouter.put('/export/templates/:id', route(async (req, res) => {
  if (!guard(req, res, 'import.export')) return;
  const id = num(req.params.id);
  const b = req.body || {};
  const rows = await execQ(getPool(), `
    UPDATE school_export_template SET name=coalesce($3,name), description=coalesce($4,description), export_type=coalesce($5,export_type), query_config=coalesce($6::jsonb,query_config), format=coalesce($7,format), is_active=coalesce($8,is_active), updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), id, text(b.name), text(b.description), text(b.export_type), b.query_config ? JSON.stringify(b.query_config) : null, text(b.format), b.isActive === undefined ? null : bool(b.isActive)]);
  if (!rows[0]) return fail(404, 'Template not found');
  res.json({ ok: true, template: rows[0] });
}));

importRouter.delete('/export/templates/:id', route(async (req, res) => {
  if (!guard(req, res, 'import.export')) return;
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `UPDATE school_export_template SET deleted_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL AND is_system=false RETURNING id`, [appIdOf(req), id]);
  if (!rows[0]) return fail(404, 'Template not found or is a system template');
  res.json({ ok: true });
}));

/* ---------- Export Run ---------- */
importRouter.post('/export/run', route(async (req, res) => {
  if (!guard(req, res, 'import.export')) return;
  const b = req.body || {};
  if (!text(b.export_type)) fail(400, 'export_type required');

  const jobRows = await execQ(getPool(), `
    INSERT INTO school_export_job (app_id, code, name, export_type, format, filters, columns, created_by, status)
    VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,'running') RETURNING *
  `, [appIdOf(req), text(b.code) || `exp_${Date.now().toString(36)}`, text(b.name) || 'Ad-hoc Export', text(b.export_type), text(b.format) || 'csv', JSON.stringify(b.filters || {}), JSON.stringify(b.columns || []), userOf(req)]);
  const job = jobRows[0];

  // For now return job immediately (async implementation would be more complex)
  // In production, this would be a background job
  res.json({ ok: true, job, message: 'Export started (synchronous implementation - returns empty for now)' });
}));

importRouter.get('/export/status/:jobId', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const id = num(req.params.jobId);
  const rows = await execQ(getPool(), `SELECT * FROM school_export_job WHERE app_id=$1 AND id=$2`, [appIdOf(req), id]);
  if (!rows[0]) return fail(404, 'Job not found');
  res.json({ ok: true, job: rows[0] });
}));

importRouter.get('/export/download/:jobId', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const id = num(req.params.jobId);
  const rows = await execQ(getPool(), `SELECT * FROM school_export_job WHERE app_id=$1 AND id=$2`, [appIdOf(req), id]);
  if (!rows[0]) return fail(404, 'Job not found');
  const job = rows[0];
  // Generate CSV based on export_type
  let csv = 'No data';
  if (job.export_type === 'students') {
    const data = await execQ(getPool(), `SELECT admission_no, first_name, last_name, gender, dob, class_name, section_name, roll_no, status, admission_date FROM school_v_student_summary WHERE app_id=$1`, [appIdOf(req)]);
    const headers = ['admission_no','first_name','last_name','gender','dob','class_name','section_name','roll_no','status','admission_date'];
    csv = [headers.join(','), ...data.map(r => headers.map(h => r[h] || '').join(','))].join('\n');
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${job.file_name || 'export.csv'}"`);
  res.send(csv);
}));

importRouter.get('/export/history', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `SELECT * FROM school_export_job WHERE app_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 50`, [appIdOf(req)]);
  res.json({ ok: true, jobs: rows });
}));

export { importRouter };