/* HR & Payroll — Staff Directory Routes */
import express from 'express';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { ensureFoundation, loadAccess } from '../school/foundation.js';
import { syncStaffToEmployee, deactivateStaffEmployee } from '../school/staff.js';

const hrStaffRouter = express.Router();

hrStaffRouter.use(verifyToken);

/* Ensure req.school is set for all routes */
hrStaffRouter.use(async (req, _res, next) => {
  if (!req.school) {
    const pool = getPool();
    const appId = req.user?.company || DEFAULT_COMPANY_ID;
    await ensureFoundation(pool, appId);
    req.school = await loadAccess(pool, appId, req.user);
  }
  next();
});

/* ---- helpers ---- */
const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
const text = (v) => (v === undefined || v === null ? null : String(v).trim());
const dayOf = (v) => {
  if (!v) return null;
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);
const appIdOf = (req) => req.school?.appId || 'default';
const userOf = (req) => req.user?.userid || req.user?.id || 'system';

function guard(req, res, perm) {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  const alt = perm === 'hr.manage' ? ['hr.payroll_manage'] : [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || alt.some(p => perms.includes(p))) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

function guardView(req, res, perm) {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('hr.view') || perms.includes('hr.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ============================================================
   STAFF LIST & CRUD
   ============================================================ */

hrStaffRouter.get('/hr/staff', route(async (req, res) => {
  if (!guardView(req, res, 'hr.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const values = [appId];
  const where = ['s.app_id=$1', 's.deleted_at IS NULL'];
  
  const add = (sql, v) => { values.push(v); where.push(sql.replace('?', `$${values.length}`)); };
  
  if (text(req.query.q)) {
    const q = `%${text(req.query.q)}%`;
    values.push(q);
    const p = `$${values.length}`;
    where.push(`(s.name ILIKE ${p} OR s.employee_code ILIKE ${p} OR s.contact_phone ILIKE ${p} OR s.contact_email ILIKE ${p})`);
  }
  if (text(req.query.department)) add('e.department = ?', text(req.query.department));
  if (text(req.query.designation)) add('e.designation = ?', text(req.query.designation));
  if (text(req.query.type)) add('e.type = ?', text(req.query.type));
  if (text(req.query.status)) add('s.status = ?', text(req.query.status));
  
  const limit = num(req.query.limit) || 50;
  const offset = num(req.query.offset) || 0;
  
  const rows = await execQ(pool, `
    SELECT s.*, 
           e.designation, e.department, e.type, e.joining_date, e.exit_date, e.reports_to
      FROM school_staff s
      LEFT JOIN LATERAL (
        SELECT designation, department, type, joining_date, exit_date, reports_to
          FROM school_staff_employment e
         WHERE e.app_id=s.app_id AND e.staff_id=s.id AND e.deleted_at IS NULL
         ORDER BY e.effective_from DESC LIMIT 1
      ) e ON true
     WHERE ${where.join(' AND ')}
     ORDER BY s.employee_code
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}
  `, [...values, limit, offset]);
  
  const [{ total }] = await execQ(pool, `
    SELECT count(*)::int AS total
      FROM school_staff s
      LEFT JOIN LATERAL (
        SELECT designation, department, type
          FROM school_staff_employment e
         WHERE e.app_id=s.app_id AND e.staff_id=s.id AND e.deleted_at IS NULL
         ORDER BY e.effective_from DESC LIMIT 1
      ) e ON true
     WHERE ${where.join(' AND ')}
  `, values);
  
  res.json({ ok: true, staff: rows, total, limit, offset });
}));

hrStaffRouter.post('/hr/staff', route(async (req, res) => {
  if (!guard(req, res, 'hr.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Create staff
    const staff = await client.query(`
      INSERT INTO school_staff (app_id, employee_code, name, date_of_birth, gender, contact_phone, contact_email, address, user_id, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [appId, text(b.employee_code), text(b.name), dayOf(b.date_of_birth), text(b.gender) || null, text(b.contact_phone), text(b.contact_email), text(b.address), text(b.user_id) || null, userOf(req)]);
    
    const staffId = staff.rows[0].id;
    
    // Create initial employment record
    if (b.designation || b.department) {
      await client.query(`
        INSERT INTO school_staff_employment (app_id, staff_id, designation, department, type, joining_date, confirmation_date, reports_to, effective_from, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `, [appId, staffId, text(b.designation), text(b.department) || 'General', text(b.type) || 'permanent', dayOf(b.joining_date) || today(), dayOf(b.confirmation_date), num(b.reports_to), dayOf(b.joining_date) || today(), userOf(req)]);
    }
    
    // Bank details
    if (b.bank_name || b.account_number) {
      await client.query(`
        INSERT INTO school_staff_bank (app_id, staff_id, bank_name, account_number, ifsc_code, account_holder_name, is_primary, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [appId, staffId, text(b.bank_name), text(b.account_number), text(b.ifsc_code), text(b.account_holder_name), true, userOf(req)]);
    }
    
    // Statutory
    if (b.pan || b.pf_number) {
      await client.query(`
        INSERT INTO school_staff_statutory (app_id, staff_id, pan, pf_number, pf_join_date, esi_number, esi_join_date, pt_registration, pt_state, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `, [appId, staffId, text(b.pan), text(b.pf_number), dayOf(b.pf_join_date), text(b.esi_number), dayOf(b.esi_join_date), text(b.pt_registration), text(b.pt_state), userOf(req)]);
    }
    
    // Mirror the record into the operational teacher table used by Timetable,
    // Attendance, Exams and class-teacher links.
    await syncStaffToEmployee(client, appId, staffId);

    // Re-read so the response carries hr_employee_id and the other columns the
    // sync just filled in (the profile page uses it for "View Timetable").
    const [saved] = await execQ(client,
      'SELECT * FROM school_staff WHERE app_id=$1 AND id=$2', [appId, staffId]);

    await client.query('COMMIT');
    res.json({ ok: true, staff: saved });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}));

hrStaffRouter.get('/hr/staff/:id', route(async (req, res, next) => {
  if (!guardView(req, res, 'hr.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  // Let static sibling routes such as /hr/staff/export match instead.
  if (!Number.isFinite(id)) return next();
  
  const [staff] = await execQ(pool, 'SELECT * FROM school_staff WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, id]);
  if (!staff) return res.status(404).json({ error: 'Staff not found' });
  
  const employment = await execQ(pool, 'SELECT * FROM school_staff_employment WHERE app_id=$1 AND staff_id=$2 AND deleted_at IS NULL ORDER BY effective_from DESC', [appId, id]);
  const qualifications = await execQ(pool, 'SELECT * FROM school_staff_qualification WHERE app_id=$1 AND staff_id=$2 AND deleted_at IS NULL', [appId, id]);
  const documents = await execQ(pool, 'SELECT * FROM school_staff_document WHERE app_id=$1 AND staff_id=$2 AND deleted_at IS NULL', [appId, id]);
  const bank = await execQ(pool, 'SELECT * FROM school_staff_bank WHERE app_id=$1 AND staff_id=$2 AND deleted_at IS NULL', [appId, id]);
  const statutory = await execQ(pool, 'SELECT * FROM school_staff_statutory WHERE app_id=$1 AND staff_id=$2 AND deleted_at IS NULL', [appId, id]);
  const nominees = await execQ(pool, 'SELECT * FROM school_staff_nominee WHERE app_id=$1 AND staff_id=$2 AND deleted_at IS NULL', [appId, id]);
  const emergency = await execQ(pool, 'SELECT * FROM school_staff_emergency_contact WHERE app_id=$1 AND staff_id=$2 AND deleted_at IS NULL', [appId, id]);
  
  res.json({ ok: true, staff, employment, qualifications, documents, bank, statutory, nominees, emergency });
}));

hrStaffRouter.put('/hr/staff/:id', route(async (req, res) => {
  if (!guard(req, res, 'hr.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const [row] = await execQ(client, `
      UPDATE school_staff SET
        name=$3, date_of_birth=$4, gender=$5, contact_phone=$6, contact_email=$7, address=$8, status=$9, user_id=$10, updated_at=now()
      WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
    `, [appId, id, text(b.name), dayOf(b.date_of_birth), text(b.gender) || null, text(b.contact_phone), text(b.contact_email), text(b.address), text(b.status), text(b.user_id) || null]);

    if (!row) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Staff not found' });
    }

    await syncStaffToEmployee(client, appId, id);
    await client.query('COMMIT');
    res.json({ ok: true, staff: row });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}));

hrStaffRouter.delete('/hr/staff/:id', route(async (req, res) => {
  if (!guard(req, res, 'hr.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await execQ(client, 'UPDATE school_staff SET deleted_at=now(), updated_at=now() WHERE app_id=$1 AND id=$2', [appId, id]);
    await deactivateStaffEmployee(client, appId, id);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}));

/* ============================================================
   EMPLOYMENT HISTORY
   ============================================================ */

hrStaffRouter.get('/hr/staff/:id/employment', route(async (req, res) => {
  if (!guardView(req, res, 'hr.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const rows = await execQ(pool, 'SELECT * FROM school_staff_employment WHERE app_id=$1 AND staff_id=$2 AND deleted_at IS NULL ORDER BY effective_from DESC', [appId, id]);
  res.json({ ok: true, employment: rows });
}));

hrStaffRouter.post('/hr/staff/:id/employment', route(async (req, res) => {
  if (!guard(req, res, 'hr.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Close previous employment record if overlapping
    await execQ(client, `
      UPDATE school_staff_employment
         SET effective_to = $3 - interval '1 day', updated_at=now()
       WHERE app_id=$1 AND staff_id=$2 AND deleted_at IS NULL
         AND effective_from <= $3 AND (effective_to IS NULL OR effective_to >= $3)
    `, [appId, id, dayOf(b.joining_date) || dayOf(b.effective_from)]);

    const [row] = await execQ(client, `
      INSERT INTO school_staff_employment (app_id, staff_id, designation, department, type, joining_date, confirmation_date, reports_to, effective_from, effective_to, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
    `, [appId, id, text(b.designation), text(b.department), text(b.type) || 'permanent', dayOf(b.joining_date), dayOf(b.confirmation_date), num(b.reports_to), dayOf(b.effective_from) || dayOf(b.joining_date), dayOf(b.effective_to), userOf(req)]);

    await syncStaffToEmployee(client, appId, id);
    await client.query('COMMIT');
    res.json({ ok: true, employment: row });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}));

hrStaffRouter.put('/hr/staff/:staffId/employment/:empId', route(async (req, res) => {
  if (!guard(req, res, 'hr.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  const staffId = num(req.params.staffId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const [row] = await execQ(client, `
      UPDATE school_staff_employment SET
        designation=$4, department=$5, type=$6, joining_date=$7, confirmation_date=$8, reports_to=$9, effective_from=$10, effective_to=$11, updated_at=now()
      WHERE app_id=$1 AND staff_id=$2 AND id=$3 AND deleted_at IS NULL RETURNING *
    `, [appId, staffId, num(req.params.empId), text(b.designation), text(b.department), text(b.type), dayOf(b.joining_date), dayOf(b.confirmation_date), num(b.reports_to), dayOf(b.effective_from), dayOf(b.effective_to)]);

    if (!row) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Employment record not found' });
    }

    await syncStaffToEmployee(client, appId, staffId);
    await client.query('COMMIT');
    res.json({ ok: true, employment: row });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}));

/* ============================================================
   QUALIFICATIONS
   ============================================================ */

hrStaffRouter.get('/hr/staff/:id/qualifications', route(async (req, res) => {
  if (!guardView(req, res, 'hr.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const rows = await execQ(pool, 'SELECT * FROM school_staff_qualification WHERE app_id=$1 AND staff_id=$2 AND deleted_at IS NULL', [appId, id]);
  res.json({ ok: true, qualifications: rows });
}));

hrStaffRouter.post('/hr/staff/:id/qualifications', route(async (req, res) => {
  if (!guard(req, res, 'hr.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};
  
  const [row] = await execQ(pool, `
    INSERT INTO school_staff_qualification (app_id, staff_id, degree, subject, institute, year, teachable_subjects, teachable_classes, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
  `, [appId, id, text(b.degree), text(b.subject), text(b.institute), num(b.year), b.teachable_subjects || [], b.teachable_classes || [], userOf(req)]);
  
  res.json({ ok: true, qualification: row });
}));

hrStaffRouter.put('/hr/staff/:staffId/qualifications/:qualId', route(async (req, res) => {
  if (!guard(req, res, 'hr.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  
  const [row] = await execQ(pool, `
    UPDATE school_staff_qualification SET
      degree=$4, subject=$5, institute=$6, year=$7, teachable_subjects=$8, teachable_classes=$9, updated_at=now()
    WHERE app_id=$1 AND staff_id=$2 AND id=$3 AND deleted_at IS NULL RETURNING *
  `, [appId, num(req.params.staffId), num(req.params.qualId), text(b.degree), text(b.subject), text(b.institute), num(b.year), b.teachable_subjects || [], b.teachable_classes || []]);
  
  if (!row) return res.status(404).json({ error: 'Qualification not found' });
  res.json({ ok: true, qualification: row });
}));

hrStaffRouter.delete('/hr/staff/:staffId/qualifications/:qualId', route(async (req, res) => {
  if (!guard(req, res, 'hr.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  await execQ(pool, 'UPDATE school_staff_qualification SET deleted_at=now() WHERE app_id=$1 AND staff_id=$2 AND id=$3', [appId, num(req.params.staffId), num(req.params.qualId)]);
  res.json({ ok: true });
}));

/* ============================================================
   DOCUMENTS
   ============================================================ */

hrStaffRouter.get('/hr/staff/:id/documents', route(async (req, res) => {
  if (!guardView(req, res, 'hr.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const rows = await execQ(pool, 'SELECT * FROM school_staff_document WHERE app_id=$1 AND staff_id=$2 AND deleted_at IS NULL', [appId, id]);
  res.json({ ok: true, documents: rows });
}));

hrStaffRouter.post('/hr/staff/:id/documents', route(async (req, res) => {
  if (!guard(req, res, 'hr.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};
  
  const [row] = await execQ(pool, `
    INSERT INTO school_staff_document (app_id, staff_id, type, file_url, expiry_date, verified, verified_by, verified_at, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
  `, [appId, id, text(b.type), text(b.file_url), dayOf(b.expiry_date), b.verified === true, text(b.verified_by), b.verified ? new Date() : null, userOf(req)]);
  
  res.json({ ok: true, document: row });
}));

hrStaffRouter.put('/hr/staff/:staffId/documents/:docId', route(async (req, res) => {
  if (!guard(req, res, 'hr.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  
  const [row] = await execQ(pool, `
    UPDATE school_staff_document SET
      type=$4, file_url=$5, expiry_date=$6, verified=$7, verified_by=$8, verified_at=$9, updated_at=now()
    WHERE app_id=$1 AND staff_id=$2 AND id=$3 AND deleted_at IS NULL RETURNING *
  `, [appId, num(req.params.staffId), num(req.params.docId), text(b.type), text(b.file_url), dayOf(b.expiry_date), b.verified === true, text(b.verified_by), b.verified ? new Date() : null]);
  
  if (!row) return res.status(404).json({ error: 'Document not found' });
  res.json({ ok: true, document: row });
}));

hrStaffRouter.delete('/hr/staff/:staffId/documents/:docId', route(async (req, res) => {
  if (!guard(req, res, 'hr.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  await execQ(pool, 'UPDATE school_staff_document SET deleted_at=now() WHERE app_id=$1 AND staff_id=$2 AND id=$3', [appId, num(req.params.staffId), num(req.params.docId)]);
  res.json({ ok: true });
}));

/* ============================================================
   BANK DETAILS
   ============================================================ */

hrStaffRouter.get('/hr/staff/:id/bank', route(async (req, res) => {
  if (!guard(req, res, 'hr.payroll_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const rows = await execQ(pool, 'SELECT * FROM school_staff_bank WHERE app_id=$1 AND staff_id=$2 AND deleted_at IS NULL', [appId, id]);
  res.json({ ok: true, bank: rows });
}));

hrStaffRouter.put('/hr/staff/:id/bank', route(async (req, res) => {
  if (!guard(req, res, 'hr.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};
  
  // Upsert primary bank
  const [row] = await execQ(pool, `
    INSERT INTO school_staff_bank (app_id, staff_id, bank_name, account_number, ifsc_code, account_holder_name, is_primary, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (app_id, staff_id) WHERE is_primary = true
    DO UPDATE SET bank_name=$3, account_number=$4, ifsc_code=$5, account_holder_name=$6, updated_at=now()
    RETURNING *
  `, [appId, id, text(b.bank_name), text(b.account_number), text(b.ifsc_code), text(b.account_holder_name), true, userOf(req)]);
  
  res.json({ ok: true, bank: row });
}));

/* ============================================================
   STATUTORY DETAILS
   ============================================================ */

hrStaffRouter.get('/hr/staff/:id/statutory', route(async (req, res) => {
  if (!guard(req, res, 'hr.payroll_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const rows = await execQ(pool, 'SELECT * FROM school_staff_statutory WHERE app_id=$1 AND staff_id=$2 AND deleted_at IS NULL', [appId, id]);
  res.json({ ok: true, statutory: rows });
}));

hrStaffRouter.put('/hr/staff/:id/statutory', route(async (req, res) => {
  if (!guard(req, res, 'hr.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};
  
  const [row] = await execQ(pool, `
    INSERT INTO school_staff_statutory (app_id, staff_id, pan, pf_number, pf_join_date, esi_number, esi_join_date, pt_registration, pt_state, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (app_id, staff_id) DO UPDATE SET
      pan=$3, pf_number=$4, pf_join_date=$5, esi_number=$6, esi_join_date=$7, pt_registration=$8, pt_state=$9, updated_at=now()
    RETURNING *
  `, [appId, id, text(b.pan), text(b.pf_number), dayOf(b.pf_join_date), text(b.esi_number), dayOf(b.esi_join_date), text(b.pt_registration), text(b.pt_state), userOf(req)]);
  
  res.json({ ok: true, statutory: row });
}));

/* ============================================================
   NOMINEES
   ============================================================ */

hrStaffRouter.get('/hr/staff/:id/nominees', route(async (req, res) => {
  if (!guardView(req, res, 'hr.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const rows = await execQ(pool, 'SELECT * FROM school_staff_nominee WHERE app_id=$1 AND staff_id=$2 AND deleted_at IS NULL', [appId, id]);
  res.json({ ok: true, nominees: rows });
}));

hrStaffRouter.post('/hr/staff/:id/nominees', route(async (req, res) => {
  if (!guard(req, res, 'hr.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};
  
  const [row] = await execQ(pool, `
    INSERT INTO school_staff_nominee (app_id, staff_id, name, relation, share_percent, phone, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [appId, id, text(b.name), text(b.relation), num(b.share_percent), text(b.phone), userOf(req)]);
  
  res.json({ ok: true, nominee: row });
}));

/* ============================================================
   EMERGENCY CONTACTS
   ============================================================ */

hrStaffRouter.get('/hr/staff/:id/emergency', route(async (req, res) => {
  if (!guardView(req, res, 'hr.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const rows = await execQ(pool, 'SELECT * FROM school_staff_emergency_contact WHERE app_id=$1 AND staff_id=$2 AND deleted_at IS NULL', [appId, id]);
  res.json({ ok: true, emergency: rows });
}));

hrStaffRouter.post('/hr/staff/:id/emergency', route(async (req, res) => {
  if (!guard(req, res, 'hr.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};
  
  const [row] = await execQ(pool, `
    INSERT INTO school_staff_emergency_contact (app_id, staff_id, name, relation, phone, is_primary, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [appId, id, text(b.name), text(b.relation), text(b.phone), b.is_primary === true, userOf(req)]);
  
  res.json({ ok: true, emergency: row });
}));

/* ============================================================
   IMPORT / EXPORT
   ============================================================ */

hrStaffRouter.post('/hr/staff/check-duplicates', route(async (req, res) => {
  if (!guard(req, res, 'hr.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const items = req.body?.items || [];
  
  if (!items.length) return res.json({ ok: true, duplicates: [] });
  
  const codes = items.map(i => text(i.employee_code)).filter(Boolean);
  const phones = items.map(i => text(i.contact_phone)).filter(Boolean);
  const emails = items.map(i => text(i.contact_email)).filter(Boolean);
  
  const existing = await execQ(pool, `
    SELECT employee_code, contact_phone, contact_email
      FROM school_staff
     WHERE app_id=$1 AND deleted_at IS NULL
       AND (employee_code = ANY($2) OR contact_phone = ANY($3) OR contact_email = ANY($4))
  `, [appId, codes, phones, emails]);
  
  const existingCodes = new Set(existing.map(r => r.employee_code));
  const existingPhones = new Set(existing.map(r => r.contact_phone));
  const existingEmails = new Set(existing.map(r => r.contact_email));
  
  const duplicates = items.map((item, idx) => ({
    row: idx + 1,
    employee_code: item.employee_code,
    duplicate_code: existingCodes.has(text(item.employee_code)),
    duplicate_phone: text(item.contact_phone) && existingPhones.has(text(item.contact_phone)),
    duplicate_email: text(item.contact_email) && existingEmails.has(text(item.contact_email)),
  })).filter(d => d.duplicate_code || d.duplicate_phone || d.duplicate_email);
  
  res.json({ ok: true, duplicates });
}));

hrStaffRouter.post('/hr/staff/import', route(async (req, res) => {
  if (!guard(req, res, 'hr.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const items = req.body?.items || [];
  
  if (!items.length) return res.status(400).json({ error: 'No items to import' });
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results = [];
    
    for (const item of items) {
      const empCode = text(item.employee_code);
      if (!empCode) continue;
      
      // Check if exists
      const existing = await client.query('SELECT id FROM school_staff WHERE app_id=$1 AND employee_code=$2 AND deleted_at IS NULL', [appId, empCode]);
      let staffId;
      
      if (existing.rows[0]) {
        staffId = existing.rows[0].id;
        await client.query('UPDATE school_staff SET name=$3, contact_phone=$4, contact_email=$5, address=$6, updated_at=now() WHERE app_id=$1 AND id=$2', [appId, staffId, text(item.name), text(item.contact_phone), text(item.contact_email), text(item.address)]);
      } else {
        const staff = await client.query(`
          INSERT INTO school_staff (app_id, employee_code, name, date_of_birth, gender, contact_phone, contact_email, address, user_id, created_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
        `, [appId, empCode, text(item.name), dayOf(item.date_of_birth), text(item.gender) || null, text(item.contact_phone), text(item.contact_email), text(item.address), text(item.user_id) || null, userOf(req)]);
        staffId = staff.rows[0].id;
      }
      
      if (staffId && (item.designation || item.department)) {
        await client.query(`
          INSERT INTO school_staff_employment (app_id, staff_id, designation, department, type, joining_date, confirmation_date, reports_to, effective_from, created_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          ON CONFLICT DO NOTHING
        `, [appId, staffId, text(item.designation), text(item.department) || 'General', text(item.type) || 'permanent', dayOf(item.joining_date) || today(), dayOf(item.confirmation_date), num(item.reports_to), dayOf(item.joining_date) || today(), userOf(req)]);
      }

      if (staffId) await syncStaffToEmployee(client, appId, staffId);

      results.push({ employee_code: empCode, status: 'success' });
    }
    
    await client.query('COMMIT');
    res.json({ ok: true, imported: results.length, results });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}));

hrStaffRouter.get('/hr/staff/export', route(async (req, res) => {
  if (!guardView(req, res, 'hr.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  
  const rows = await execQ(pool, `
    SELECT s.employee_code, s.name, s.date_of_birth, s.gender, s.contact_phone, s.contact_email, s.address, s.status,
           e.designation, e.department, e.type, e.joining_date, e.confirmation_date, e.exit_date, e.exit_reason
      FROM school_staff s
      LEFT JOIN LATERAL (
        SELECT designation, department, type, joining_date, confirmation_date, exit_date, exit_reason
          FROM school_staff_employment e
         WHERE e.app_id=s.app_id AND e.staff_id=s.id AND e.deleted_at IS NULL
         ORDER BY e.effective_from DESC LIMIT 1
      ) e ON true
     WHERE s.app_id=$1 AND s.deleted_at IS NULL
     ORDER BY s.employee_code
  `, [appId]);
  
  res.json({ ok: true, staff: rows });
}));

export default hrStaffRouter;