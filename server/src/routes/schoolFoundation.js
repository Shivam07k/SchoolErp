import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import {
  ensureFoundation, loadAccess, can, writeAudit, PERMISSIONS, SCHOOL_MODULES,
} from '../school/foundation.js';
import { safeErrorMessage } from '../middleware/error.js';

const schoolFoundationRouter = Router();
schoolFoundationRouter.use(verifyToken);

const appIdOf = (req) => req.user?.company || DEFAULT_COMPANY_ID;
const text = (v) => (v === null || v === undefined ? '' : String(v).trim());
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
const bool = (v, def = false) => v === undefined || v === null ? def : (v === true || v === 'true' || v === 1 || v === '1');
const userOf = (req) => req.user?.userid || req.user?.id || 'SYSTEM';

function route(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error('[school foundation]', err.message);
      res.status(500).json({ error: safeErrorMessage(err, 'School API error') });
    });
  };
}

schoolFoundationRouter.use(route(async (req, _res, next) => {
  if (!req.school) {
    const pool = getPool();
    const appId = appIdOf(req);
    await ensureFoundation(pool, appId);
    req.school = await loadAccess(pool, appId, req.user);
  }
  next();
}));

function guard(req, res, permission) {
  if (can(req.school, permission)) return true;
  res.status(403).json({ error: 'You do not have permission for this action' });
  return false;
}

function selectedIds(value) {
  if (!Array.isArray(value)) return null;
  const ids = value.map(Number);
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) return null;
  return [...new Set(ids)];
}

async function saveUserGroups(client, appId, userId, groupIds, campusId, actor) {
  const validGroups = await client.query(`
    SELECT g.id FROM school_groups g
     WHERE g.app_id=$1 AND g.deleted_at IS NULL AND g.id=ANY($2::int[])
       AND (g.is_active=true OR EXISTS (
         SELECT 1 FROM school_user_groups existing
          WHERE existing.app_id=$1 AND existing.user_id=$3 AND existing.group_id=g.id
       ))
  `, [appId, groupIds, userId]);
  if (validGroups.rowCount !== groupIds.length) return false;

  await client.query('DELETE FROM school_user_groups WHERE app_id=$1 AND user_id=$2', [appId, userId]);
  for (const groupId of groupIds) {
    await client.query(`
      INSERT INTO school_user_groups (app_id, user_id, group_id, campus_id, assigned_by)
      VALUES ($1,$2,$3,$4,$5)
    `, [appId, userId, groupId, campusId, actor]);
  }
  return true;
}

const dayOf = (v) => { if (!v) return null; if (v instanceof Date) { const y = v.getFullYear(); const m = String(v.getMonth() + 1).padStart(2, '0'); const d = String(v.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; } return String(v).slice(0, 10); };
const tsOf = (v) => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString(); };

schoolFoundationRouter.get('/me', route(async (req, res) => {
  const a = req.school;
  const pool = getPool();
  const appId = appIdOf(req);
  const userId = String(req.user?.userid || '');
  
  // Check if user is a student (numeric ID)
  const numericUserId = Number(userId);
  if (!isNaN(numericUserId)) {
    const [student] = await execQ(pool, `
      SELECT s.id, s.admission_no, s.first_name, s.last_name, s.class_id, s.section_id,
             s.roll_no, s.guardian_name, s.guardian_phone, s.guardian_email, s.address,
             s.admission_date, s.status, s.photo_url, s.blood_group, s.nationality, s.category,
             s.previous_school, s.national_id, s.house, s.campus_id
      FROM school_students s WHERE s.app_id=$1 AND s.id=$2 AND s.deleted_at IS NULL
    `, [appId, numericUserId]);
    if (student) {
      a.currentStudent = student;
      a.studentId = student.id;
    }
  }
  
  res.json({ ok: true, me: a });
}));

schoolFoundationRouter.get('/settings', route(async (req, res) => {
  if (!guard(req, res, 'settings.view')) return;
  const pool = getPool();
  const rows = await execQ(pool, `
    SELECT id, campus_id, key, value, updated_at
      FROM school_settings WHERE app_id=$1 ORDER BY key
  `, [appIdOf(req)]);
  res.json({ ok: true, settings: rows });
}));

schoolFoundationRouter.put('/settings/:key', route(async (req, res) => {
  if (!guard(req, res, 'settings.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const key = text(req.params.key);
  if (!key) return res.status(400).json({ error: 'Setting key is required' });
  const campusId = num(req.body?.campusId);
  const value = req.body?.value ?? {};
  const [before] = await execQ(pool, `
    SELECT * FROM school_settings
     WHERE app_id=$1 AND coalesce(campus_id,0)=coalesce($2,0) AND key=$3
  `, [appId, campusId, key]);
  const [row] = await execQ(pool, `
    INSERT INTO school_settings (app_id, campus_id, key, value)
    VALUES ($1,$2,$3,$4::jsonb)
    ON CONFLICT (app_id, (coalesce(campus_id, 0)), key)
    DO UPDATE SET value=excluded.value, updated_at=now()
    RETURNING *
  `, [appId, campusId, key, JSON.stringify(value)]);
  await writeAudit(pool, req, {
    action: 'settings.update', entity: 'school_settings', entityId: key,
    before: before?.value || null, after: value,
  });
  res.json({ ok: true, setting: row });
}));

schoolFoundationRouter.get('/campuses', route(async (req, res) => {
  if (!guard(req, res, 'settings.view')) return;
  const pool = getPool();
  const campuses = await execQ(pool, `
    SELECT c.*,
           (SELECT count(*) FROM school_students s
             WHERE s.app_id=c.app_id AND s.campus_id=c.id AND s.deleted_at IS NULL)::int AS students
      FROM school_campuses c
     WHERE c.app_id=$1 ORDER BY c.id
  `, [appIdOf(req)]);
  res.json({ ok: true, campuses });
}));

schoolFoundationRouter.post('/campuses', route(async (req, res) => {
  if (!guard(req, res, 'settings.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const name = text(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Campus name is required' });
  const code = text(req.body?.code).toUpperCase() || name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 20);
  try {
    const [row] = await execQ(pool, `
      INSERT INTO school_campuses (app_id, name, code, type, address, phone, email, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [
      appId, name, code, text(req.body?.type) || 'campus',
      text(req.body?.address) || null, text(req.body?.phone) || null,
      text(req.body?.email) || null, text(req.body?.status) || 'active',
    ]);
    await writeAudit(pool, req, { action: 'campus.create', entity: 'school_campuses', entityId: row.id, after: row });
    res.json({ ok: true, campus: row });
  } catch (e) {
    if (String(e.message).includes('duplicate key')) return res.status(409).json({ error: `Campus code ${code} already exists` });
    throw e;
  }
}));

schoolFoundationRouter.put('/campuses/:id', route(async (req, res) => {
  if (!guard(req, res, 'settings.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [before] = await execQ(pool, 'SELECT * FROM school_campuses WHERE app_id=$1 AND id=$2', [appId, id]);
  if (!before) return res.status(404).json({ error: 'Campus not found' });
  const [row] = await execQ(pool, `
    UPDATE school_campuses
       SET name=$3, code=$4, type=$5, address=$6, phone=$7, email=$8, status=$9
     WHERE app_id=$1 AND id=$2 RETURNING *
  `, [
    appId, id, text(req.body?.name) || before.name,
    text(req.body?.code).toUpperCase() || before.code,
    text(req.body?.type) || before.type, text(req.body?.address) || null,
    text(req.body?.phone) || null, text(req.body?.email) || null,
    text(req.body?.status) || before.status,
  ]);
  await writeAudit(pool, req, { action: 'campus.update', entity: 'school_campuses', entityId: id, before, after: row });
  res.json({ ok: true, campus: row });
}));

/* ---------- roles + permissions ---------- */

schoolFoundationRouter.get('/roles', route(async (req, res) => {
  if (!guard(req, res, 'settings.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const roles = await execQ(pool, `
    SELECT r.*,
           coalesce((
             SELECT json_agg(rp.permission_key ORDER BY rp.permission_key)
               FROM school_role_permissions rp WHERE rp.role_id=r.id
           ), '[]'::json) AS permissions,
           (SELECT count(*) FROM school_user_roles ur WHERE ur.role_id=r.id)::int AS users
      FROM school_roles r WHERE r.app_id=$1 ORDER BY r.is_system DESC, r.name
  `, [appId]);
  res.json({ ok: true, roles, catalogue: PERMISSIONS, modules: SCHOOL_MODULES });
}));

schoolFoundationRouter.post('/roles', route(async (req, res) => {
  if (!guard(req, res, 'settings.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const name = text(req.body?.name);
  const code = text(req.body?.code).toUpperCase().replace(/[^A-Z0-9_]+/g, '_');
  if (!name || !code) return res.status(400).json({ error: 'Role name and code are required' });
  const [row] = await execQ(pool, `
    INSERT INTO school_roles (app_id, name, code, description, is_system)
    VALUES ($1,$2,$3,$4,false) RETURNING *
  `, [appId, name, code, text(req.body?.description) || null]);
  await writeAudit(pool, req, { action: 'role.create', entity: 'school_roles', entityId: row.id, after: row });
  res.json({ ok: true, role: row });
}));

schoolFoundationRouter.put('/roles/:id/permissions', route(async (req, res) => {
  if (!guard(req, res, 'settings.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [role] = await execQ(pool, 'SELECT * FROM school_roles WHERE app_id=$1 AND id=$2', [appId, id]);
  if (!role) return res.status(404).json({ error: 'Role not found' });
  if (role.code === 'SUPER_ADMIN') {
    return res.status(400).json({ error: 'Super Admin always has every permission' });
  }
  const keys = Array.isArray(req.body?.permissions)
    ? [...new Set(req.body.permissions.map((k) => text(k)).filter(Boolean))] : [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM school_role_permissions WHERE role_id=$1', [id]);
    if (keys.length) {
      await client.query(`
        INSERT INTO school_role_permissions (role_id, permission_key, scope)
        SELECT $1, key, 'campus' FROM school_permissions WHERE key = ANY($2::text[])
      `, [id, keys]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  await writeAudit(pool, req, { action: 'role.permissions', entity: 'school_roles', entityId: id, before: role.permissions, after: keys });
  res.json({ ok: true, permissions: keys });
}));

/* ---------- audit + approvals ---------- */

schoolFoundationRouter.get('/audit', route(async (req, res) => {
  if (!can(req.school, 'settings.view') && !can(req.school, 'reports.view')) {
    return res.status(403).json({ error: 'You do not have permission for this action' });
  }
  const pool = getPool();
  const where = ['app_id=$1'];
  const values = [appIdOf(req)];
  const add = (sql, v) => { values.push(v); where.push(sql.replace('?', `$${values.length}`)); };
  if (text(req.query.entity)) add('entity=?', text(req.query.entity));
  if (text(req.query.entityId)) add('entity_id=?', text(req.query.entityId));
  if (text(req.query.action)) add('action=?', text(req.query.action));
  if (text(req.query.userId)) add('user_id=?', text(req.query.userId));
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const rows = await execQ(pool, `
    SELECT * FROM school_audit_log WHERE ${where.join(' AND ')}
     ORDER BY created_at DESC LIMIT ${limit}
  `, values);
  res.json({ ok: true, audit: rows });
}));

schoolFoundationRouter.get('/approval-flows', route(async (req, res) => {
  if (!guard(req, res, 'settings.view')) return;
  const pool = getPool();
  const flows = await execQ(pool,
    'SELECT * FROM school_approval_flows WHERE app_id=$1 ORDER BY entity_type', [appIdOf(req)]);
  res.json({ ok: true, flows });
}));

schoolFoundationRouter.get('/approval-requests', route(async (req, res) => {
  if (!guard(req, res, 'settings.view')) return;
  const pool = getPool();
  const rows = await execQ(pool, `
    SELECT r.*, r.current_step AS current_level, r.acted_at AS completed_at, coalesce((
      SELECT json_agg(a ORDER BY a.acted_at) FROM school_approval_actions a WHERE a.request_id=r.id
    ), '[]'::json) AS actions
    FROM school_approval_requests r
   WHERE r.app_id=$1 ORDER BY r.created_at DESC LIMIT 200
  `, [appIdOf(req)]);
  res.json({ ok: true, requests: rows });
}));

schoolFoundationRouter.post('/approval-requests/:id/approve', route(async (req, res) => {
  if (!guard(req, res, 'settings.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const [reqRow] = await client.query('SELECT * FROM school_approval_requests WHERE app_id=$1 AND id=$2 FOR UPDATE', [appId, id]);
    if (!reqRow) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Request not found' }); }
    if (reqRow.status !== 'pending') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Request already processed' }); }
    
    const [flow] = await client.query('SELECT * FROM school_approval_flows WHERE app_id=$1 AND entity_type=$2 AND is_active=true', [appId, reqRow.entity_type]);
    if (!flow) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'No active flow for this entity type' }); }
    const steps = Array.isArray(flow.steps) ? flow.steps : [];
    const currentStep = Number(reqRow.current_step) || 1;
    
    if (currentStep < steps.length) {
      await client.query('UPDATE school_approval_requests SET current_step=current_step+1 WHERE app_id=$1 AND id=$2', [appId, id]);
    } else {
      await client.query("UPDATE school_approval_requests SET status='approved', acted_at=now() WHERE app_id=$1 AND id=$2", [appId, id]);
    }
    await client.query('INSERT INTO school_approval_actions (request_id, step_no, approver_id, decision, remark) VALUES ($1,$2,$3,$4,$5)',
      [id, currentStep, userOf(req), 'approved', text(req.body?.comment)]);
    await client.query('COMMIT');
    res.json({ ok: true, action: 'approve' });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}));

schoolFoundationRouter.post('/approval-requests/:id/reject', route(async (req, res) => {
  if (!guard(req, res, 'settings.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const [reqRow] = await client.query('SELECT * FROM school_approval_requests WHERE app_id=$1 AND id=$2 FOR UPDATE', [appId, id]);
    if (!reqRow) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Request not found' }); }
    if (reqRow.status !== 'pending') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Request already processed' }); }
    
    await client.query("UPDATE school_approval_requests SET status='rejected', acted_at=now() WHERE app_id=$1 AND id=$2", [appId, id]);
    await client.query('INSERT INTO school_approval_actions (request_id, step_no, approver_id, decision, remark) VALUES ($1,$2,$3,$4,$5)',
      [id, Number(reqRow.current_step) || 1, userOf(req), 'rejected', text(req.body?.comment)]);
    await client.query('COMMIT');
    res.json({ ok: true, action: 'reject' });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}));

/* ---------- custom options ---------- */

schoolFoundationRouter.get('/options', route(async (req, res) => {
  const pool = getPool();
  const appId = appIdOf(req);
  const code = text(req.query.code);
  if (!code) return res.json({ ok: true, items: [] });
  const rows = await execQ(pool, `
    SELECT oi.value, oi.label, oi.sort_order, oi.is_active
      FROM school_option_items oi
      JOIN school_option_sets os ON os.id = oi.set_id
     WHERE os.app_id=$1 AND os.code=$2 AND oi.is_active=true
     ORDER BY oi.sort_order, oi.label
  `, [appId, code]);
  res.json({ ok: true, items: rows });
}));

schoolFoundationRouter.post('/options', route(async (req, res) => {
  if (!can(req.school, 'settings.manage')) return res.status(403).json({ error: 'Permission denied' });
  const pool = getPool();
  const appId = appIdOf(req);
  const code = text(req.body.code);
  const label = text(req.body.label) || code;
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!code) return res.status(400).json({ error: 'code required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const setRes = await client.query(`
      INSERT INTO school_option_sets (app_id, code, label, created_by)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (app_id, code) DO UPDATE SET label=EXCLUDED.label, updated_at=now()
      RETURNING id
    `, [appId, code, label, req.user?.UserId]);
    const setId = setRes.rows[0].id;
    for (let i = 0; i < items.length; i++) {
      const it = items[i] || {};
      const v = text(it.value) || text(it.label);
      const l = text(it.label) || v;
      if (!v) continue;
      await client.query(`
        INSERT INTO school_option_items (app_id, set_id, value, label, sort_order)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (set_id, value) DO UPDATE SET label=EXCLUDED.label, sort_order=EXCLUDED.sort_order, is_active=true
      `, [appId, setId, v, l, i]);
    }
    await client.query('COMMIT');
    const rows = await client.query(`
      SELECT oi.value, oi.label, oi.sort_order FROM school_option_items oi
      WHERE oi.set_id=$1 AND oi.is_active=true ORDER BY oi.sort_order, oi.label
    `, [setId]);
    await writeAudit(pool, appId, req.user, { action: 'options.update', entity: 'school_option_sets', entityId: setId, meta: { code } });
    res.json({ ok: true, items: rows.rows });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
}));

/* ---------- admission/enquiry ---------- */

schoolFoundationRouter.get('/admission/enquiries', route(async (req, res) => {
  const pool = getPool();
  const appId = appIdOf(req);
  const rows = await execQ(pool, `SELECT * FROM school_enquiries WHERE app_id=$1 ORDER BY id DESC LIMIT 200`, [appId]);
  res.json({ ok: true, enquiries: rows });
}));

schoolFoundationRouter.post('/admission/enquiries', route(async (req, res) => {
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  if (!text(b.firstName) && !text(b.first_name)) return res.status(400).json({ error: 'first name required' });
  const [row] = await execQ(pool, `
    INSERT INTO school_enquiries (app_id, enquiry_no, first_name, last_name, phone, email, class_applied, source, status, assigned_to, follow_up_date, remarks)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'enquiry',$9,$10,$11) RETURNING *
  `, [appId, b.enquiryNo||b.enquiry_no||('ENQ-'+Date.now()), text(b.firstName||b.first_name), text(b.lastName||b.last_name), text(b.phone), text(b.email), num(b.classApplied||b.class_applied), text(b.source), text(b.assignedTo||b.assigned_to), day(b.followUpDate||b.follow_up_date), text(b.remarks)]);
  await writeAudit(pool, appId, req.user, { action: 'enquiry.create', entity: 'school_enquiries', entityId: row.id });
  res.json({ ok: true, enquiry: row });
}));

schoolFoundationRouter.put('/admission/enquiries/:id', route(async (req, res) => {
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};
  const [row] = await execQ(pool, `UPDATE school_enquiries SET status=$3, assigned_to=$4, follow_up_date=$5, remarks=$6, updated_at=now() WHERE app_id=$1 AND id=$2 RETURNING *`, [appId, id, text(b.status)||'enquiry', text(b.assignedTo||b.assigned_to), day(b.followUpDate||b.follow_up_date), text(b.remarks)]);
  await writeAudit(pool, appId, req.user, { action: 'enquiry.update', entity: 'school_enquiries', entityId: id, meta: { status: b.status } });
  res.json({ ok: true, enquiry: row });
}));

schoolFoundationRouter.get('/admission/applications', route(async (req, res) => {
  const pool = getPool();
  const appId = appIdOf(req);
  const rows = await execQ(pool, `SELECT * FROM school_applications WHERE app_id=$1 ORDER BY id DESC LIMIT 200`, [appId]);
  res.json({ ok: true, applications: rows });
}));

schoolFoundationRouter.post('/admission/applications', route(async (req, res) => {
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  if (!text(b.firstName||b.first_name)) return res.status(400).json({ error: 'first name required' });
  const [row] = await execQ(pool, `
    INSERT INTO school_applications (app_id, application_no, enquiry_id, first_name, last_name, dob, gender, phone, email, class_applied, section_preference, father_name, mother_name, guardian_phone, address, documents, application_fee_amount, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'applied') RETURNING *
  `, [appId, b.applicationNo||b.application_no||('APP-'+Date.now()), num(b.enquiryId||b.enquiry_id), text(b.firstName||b.first_name), text(b.lastName||b.last_name), day(b.dob), text(b.gender), text(b.phone), text(b.email), num(b.classApplied||b.class_applied), text(b.sectionPreference||b.section_preference), text(b.fatherName||b.father_name), text(b.motherName||b.mother_name), text(b.guardianPhone||b.guardian_phone), text(b.address), JSON.stringify(b.documents||[]), num(b.applicationFeeAmount||b.application_fee_amount)||0]);
  await writeAudit(pool, appId, req.user, { action: 'application.create', entity: 'school_applications', entityId: row.id });
  res.json({ ok: true, application: row });
}));

schoolFoundationRouter.post('/admission/applications/:id/offer', route(async (req, res) => {
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [row] = await execQ(pool, `UPDATE school_applications SET status='offer_sent', offer_sent_at=now(), updated_at=now() WHERE app_id=$1 AND id=$2 RETURNING *`, [appId,id]);
  await writeAudit(pool, appId, req.user, { action: 'application.offer_sent', entity: 'school_applications', entityId: id });
  res.json({ ok: true, application: row });
}));

schoolFoundationRouter.post('/admission/applications/:id/admit', route(async (req, res) => {
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const appRes = await client.query(`SELECT * FROM school_applications WHERE app_id=$1 AND id=$2 FOR UPDATE`, [appId,id]);
    const app = appRes.rows[0];
    if (!app) throw new Error('Application not found');
    const yearRes = await client.query(`SELECT id FROM school_academic_years WHERE app_id=$1 ORDER BY is_active DESC,id LIMIT 1`, [appId]);
    const ayId = yearRes.rows[0]?.id;
    const studentRes = await client.query(`INSERT INTO school_students (app_id, admission_no, first_name, last_name, gender, dob, guardian_phone, address, class_id, status, admission_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',current_date) RETURNING *`, [appId, app.application_no || ('ADM-'+Date.now()), app.first_name, app.last_name, app.gender, app.dob, app.guardian_phone, app.address, app.class_applied]);
    const student = studentRes.rows[0];
    await client.query(`UPDATE school_applications SET status='admitted', student_id=$3, admitted_at=now(), updated_at=now() WHERE app_id=$1 AND id=$2`, [appId,id,student.id]);
    if (ayId && app.class_applied) {
      const secRes = await client.query(`SELECT id FROM school_sections WHERE app_id=$1 AND class_id=$2 ORDER BY id LIMIT 1`, [appId, app.class_applied]);
      await client.query(`INSERT INTO school_student_enrollments (app_id, student_id, academic_year_id, class_id, section_id, status) VALUES ($1,$2,$3,$4,$5,'active') ON CONFLICT DO NOTHING`, [appId, student.id, ayId, app.class_applied, secRes.rows[0]?.id]);
    }
    await client.query('COMMIT');
    await writeAudit(pool, appId, req.user, { action: 'application.admit', entity: 'school_applications', entityId: id, meta: { studentId: student.id } });
    res.json({ ok: true, student });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
}));

/* ---------- users ---------- */

schoolFoundationRouter.get('/users', route(async (req, res) => {
  if (!guard(req, res, 'settings.view')) return;
  const pool = getPool();
  const rows = await execQ(pool, `
    SELECT u.id, u.app_id, u.user_id, u.name, u.email, u.phone, u.avatar_url,
           u.status, u.last_login, u.created_by, u.created_at, u.updated_at,
           u.campus_id,
           COALESCE((SELECT json_agg(r.name ORDER BY r.name)
             FROM school_roles r
             JOIN school_user_roles ur ON ur.role_id=r.id AND ur.app_id=u.app_id
             WHERE ur.user_id=u.user_id), '[]'::json) AS roles,
           COALESCE((SELECT array_agg(DISTINCT r.id ORDER BY r.id)
             FROM school_roles r
             JOIN school_user_roles ur ON ur.role_id=r.id AND ur.app_id=u.app_id
             WHERE ur.user_id=u.user_id), ARRAY[]::int[]) AS role_ids,
           COALESCE((SELECT json_agg(g.name ORDER BY g.name)
             FROM school_user_groups ug
             JOIN school_groups g ON g.id=ug.group_id AND g.app_id=ug.app_id
             WHERE ug.app_id=u.app_id AND ug.user_id=u.id AND g.deleted_at IS NULL), '[]'::json) AS group_names,
           COALESCE((SELECT array_agg(DISTINCT g.id ORDER BY g.id)
             FROM school_user_groups ug
             JOIN school_groups g ON g.id=ug.group_id AND g.app_id=ug.app_id
             WHERE ug.app_id=u.app_id AND ug.user_id=u.id AND g.deleted_at IS NULL), ARRAY[]::int[]) AS group_ids
    FROM school_users u 
    WHERE u.app_id=$1 AND u.deleted_at IS NULL
    ORDER BY u.created_at DESC
  `, [appIdOf(req)]);
  res.json({ ok: true, users: rows });
}));

schoolFoundationRouter.post('/users', route(async (req, res) => {
  if (!guard(req, res, 'settings.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  if (!text(b.user_id) || !text(b.name)) return res.status(400).json({ error: 'User ID and name required' });
  if (!text(b.password)) return res.status(400).json({ error: 'Password required' });
  if (b.status !== undefined && !['active', 'inactive', 'suspended'].includes(text(b.status))) {
    return res.status(400).json({ error: 'Invalid user status' });
  }
  const roleIds = selectedIds(b.roles ?? []);
  const groupIds = selectedIds(b.groups ?? []);
  if (!roleIds || !groupIds) return res.status(400).json({ error: 'Roles and groups must contain valid IDs' });
  const passwordHash = await bcrypt.hash(text(b.password), 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userId = text(b.user_id);
    await client.query(`
      INSERT INTO "tblHO_User" ("UserId","UserName","PasswordHash","Designation","GRP","Status")
      VALUES ($1,$2,$3,'','',$4)
    `, [userId, text(b.name), passwordHash, text(b.status) === 'active' ? '1' : '0']);
    const { rows: [userRow] } = await client.query(`
      INSERT INTO school_users (app_id, user_id, name, email, phone, password_hash, status, campus_id, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [appId, userId, text(b.name), text(b.email), text(b.phone), passwordHash, text(b.status) || 'active', num(b.campus_id), userOf(req)]);

    for (const roleId of roleIds) {
      const { rowCount } = await client.query(`
        INSERT INTO school_user_roles (app_id, user_id, role_id, campus_id, assigned_by)
        SELECT $1,$2,r.id,$4,$5 FROM school_roles r
        WHERE r.app_id=$1 AND r.id=$3
        ON CONFLICT DO NOTHING
      `, [appId, userId, roleId, num(b.campus_id), userOf(req)]);
      if (!rowCount) {
        const role = await client.query('SELECT 1 FROM school_roles WHERE app_id=$1 AND id=$2', [appId, roleId]);
        if (!role.rowCount) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Role ${roleId} was not found` });
        }
      }
    }

    if (!(await saveUserGroups(client, appId, userRow.id, groupIds, num(b.campus_id), userOf(req)))) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'One or more selected groups are unavailable' });
    }

    await client.query('COMMIT');
    const [newUser] = await execQ(pool, `
      SELECT id, app_id, user_id, name, email, phone, status, campus_id, created_at, updated_at
        FROM school_users WHERE app_id=$1 AND id=$2
    `, [appId, userRow.id]);
    await writeAudit(pool, req, { action: 'user.create', entity: 'school_users', entityId: userRow.id, after: newUser });
    res.json({ ok: true, user: newUser });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    if (String(e.message).includes('duplicate key')) return res.status(409).json({ error: 'User ID already exists' });
    throw e;
  } finally {
    client.release();
  }
}));

schoolFoundationRouter.put('/users/:id', route(async (req, res) => {
  if (!guard(req, res, 'settings.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};
  if (b.status !== undefined && !['active', 'inactive', 'suspended'].includes(text(b.status))) {
    return res.status(400).json({ error: 'Invalid user status' });
  }
  const roleIds = b.roles === undefined ? undefined : selectedIds(b.roles);
  const groupIds = b.groups === undefined ? undefined : selectedIds(b.groups);
  if (roleIds === null || groupIds === null) return res.status(400).json({ error: 'Roles and groups must contain valid IDs' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [before] } = await client.query(
      'SELECT * FROM school_users WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL FOR UPDATE',
      [appId, id]
    );
    if (!before) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = [];
    const params = [appId, id];
    let paramIdx = 3;
    for (const [field, column] of [['name', 'name'], ['email', 'email'], ['phone', 'phone'], ['status', 'status']]) {
      if (b[field] !== undefined) {
        updates.push(`${column}=$${paramIdx}`);
        params.push(text(b[field]));
        paramIdx++;
      }
    }
    if (b.campus_id !== undefined) {
      updates.push(`campus_id=$${paramIdx}`);
      params.push(num(b.campus_id));
      paramIdx++;
    }

    let passwordHash = null;
    if (text(b.password)) passwordHash = await bcrypt.hash(text(b.password), 10);
    if (passwordHash) {
      updates.push(`password_hash=$${paramIdx}`);
      params.push(passwordHash);
      paramIdx++;
    }
    if (updates.length) {
      updates.push('updated_at=now()');
      await client.query(`UPDATE school_users SET ${updates.join(', ')} WHERE app_id=$1 AND id=$2`, params);
    }

    const displayName = b.name === undefined ? before.name : text(b.name);
    const accountStatus = (b.status === undefined ? before.status : text(b.status)) === 'active' ? '1' : '0';
    const account = await client.query(`
      UPDATE "tblHO_User"
         SET "UserName"=$2, "Status"=$3,
             "PasswordHash"=COALESCE($4,"PasswordHash")
       WHERE lower(btrim("UserId"))=lower(btrim($1))
       RETURNING "UserId"
    `, [before.user_id, displayName, accountStatus, passwordHash]);
    if (!account.rowCount) {
      if (!passwordHash) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Login account is missing; set a new password to restore access' });
      }
      await client.query(`
        INSERT INTO "tblHO_User" ("UserId","UserName","PasswordHash","Designation","GRP","Status")
        VALUES ($1,$2,$3,'','',$4)
      `, [before.user_id, displayName, passwordHash, accountStatus]);
    }

    if (roleIds !== undefined) {
      await client.query('DELETE FROM school_user_roles WHERE app_id=$1 AND user_id=$2', [appId, before.user_id]);
      for (const roleId of roleIds) {
        const { rowCount } = await client.query(`
          INSERT INTO school_user_roles (app_id, user_id, role_id, campus_id, assigned_by)
          SELECT $1,$2,r.id,$4,$5 FROM school_roles r
          WHERE r.app_id=$1 AND r.id=$3
          ON CONFLICT DO NOTHING
        `, [appId, before.user_id, roleId, b.campus_id === undefined ? before.campus_id : num(b.campus_id), userOf(req)]);
        if (!rowCount) {
          const role = await client.query('SELECT 1 FROM school_roles WHERE app_id=$1 AND id=$2', [appId, roleId]);
          if (!role.rowCount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Role ${roleId} was not found` });
          }
        }
      }
    }

    if (groupIds !== undefined && !(await saveUserGroups(
      client,
      appId,
      id,
      groupIds,
      b.campus_id === undefined ? before.campus_id : num(b.campus_id),
      userOf(req)
    ))) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'One or more selected groups are unavailable' });
    }

    await client.query('COMMIT');
    const [updated] = await execQ(pool, `
      SELECT id, app_id, user_id, name, email, phone, status, campus_id, created_at, updated_at
        FROM school_users WHERE app_id=$1 AND id=$2
    `, [appId, id]);
    await writeAudit(pool, req, { action: 'user.update', entity: 'school_users', entityId: id, before, after: updated });
    res.json({ ok: true, user: updated });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}));

schoolFoundationRouter.delete('/users/:id', route(async (req, res) => {
  if (!guard(req, res, 'settings.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const client = await pool.connect();
  let userId;
  try {
    await client.query('BEGIN');
    const user = await client.query(
      'DELETE FROM school_users WHERE app_id=$1 AND id=$2 RETURNING user_id',
      [appId, id]
    );
    if (!user.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    userId = user.rows[0].user_id;
    await client.query('DELETE FROM school_user_roles WHERE app_id=$1 AND user_id=$2', [appId, userId]);
    await client.query('DELETE FROM "tblHO_User" WHERE lower(btrim("UserId"))=lower(btrim($1))', [userId]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  await writeAudit(pool, req, { action: 'user.delete', entity: 'school_users', entityId: id, before: { user_id: userId } });
  res.json({ ok: true });
}));

/* ---------- approval flows CRUD ---------- */

schoolFoundationRouter.post('/approval-flows', route(async (req, res) => {
  if (!guard(req, res, 'settings.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  if (!text(b.entity_type) || !text(b.name)) return res.status(400).json({ error: 'Entity type and name required' });
  if (!Array.isArray(b.steps) || !b.steps.length) return res.status(400).json({ error: 'At least one step required' });
  const steps = b.steps.filter((s) => text(s?.role)).map((s) => ({ role: text(s.role), label: text(s.label) || null }));

  const [flow] = await execQ(pool, `
    INSERT INTO school_approval_flows (app_id, entity_type, name, steps, is_active)
    VALUES ($1,$2,$3,$4::jsonb,$5)
    ON CONFLICT (app_id, entity_type) DO UPDATE SET
      name=EXCLUDED.name, steps=EXCLUDED.steps, is_active=EXCLUDED.is_active, updated_at=now()
    RETURNING *
  `, [appId, text(b.entity_type), text(b.name), JSON.stringify(steps), bool(b.is_active, true)]);
  res.json({ ok: true, flow });
}));

schoolFoundationRouter.put('/approval-flows/:id', route(async (req, res) => {
  if (!guard(req, res, 'settings.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};
  const before = (await execQ(pool, 'SELECT * FROM school_approval_flows WHERE app_id=$1 AND id=$2', [appId, id]))[0];
  if (!before) return res.status(404).json({ error: 'Flow not found' });

  const steps = Array.isArray(b.steps)
    ? b.steps.filter((s) => text(s?.role)).map((s) => ({ role: text(s.role), label: text(s.label) || null }))
    : before.steps;
  const [updated] = await execQ(pool, `
    UPDATE school_approval_flows SET
      name=COALESCE($3,name), steps=$4::jsonb, is_active=COALESCE($5,is_active), updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appId, id, text(b.name) || null, JSON.stringify(steps), b.is_active === undefined ? null : bool(b.is_active, true)]);
  res.json({ ok: true, flow: updated });
}));

schoolFoundationRouter.delete('/approval-flows/:id', route(async (req, res) => {
  if (!guard(req, res, 'settings.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const rows = await execQ(pool, 'DELETE FROM school_approval_flows WHERE app_id=$1 AND id=$2 RETURNING id', [appId, id]);
  if (!rows[0]) return res.status(404).json({ error: 'Flow not found' });
  res.json({ ok: true });
}));

/* ---------- custom options ---------- */

schoolFoundationRouter.get('/options', route(async (req, res) => {
  const pool = getPool();
  const appId = appIdOf(req);
  const code = text(req.query.code);
  if (!code) return res.json({ ok: true, items: [] });
  const rows = await execQ(pool, `
    SELECT oi.value, oi.label, oi.sort_order, oi.is_active
      FROM school_option_items oi
      JOIN school_option_sets os ON os.id = oi.set_id
     WHERE os.app_id=$1 AND os.code=$2 AND oi.is_active=true
     ORDER BY oi.sort_order, oi.label
  `, [appId, code]);
  res.json({ ok: true, items: rows });
}));

schoolFoundationRouter.post('/options', route(async (req, res) => {
  if (!can(req.school, 'settings.manage')) return res.status(403).json({ error: 'Permission denied' });
  const pool = getPool();
  const appId = appIdOf(req);
  const code = text(req.body.code);
  const label = text(req.body.label) || code;
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!code) return res.status(400).json({ error: 'code required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const setRes = await client.query(`
      INSERT INTO school_option_sets (app_id, code, label, created_by)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (app_id, code) DO UPDATE SET label=EXCLUDED.label, updated_at=now()
      RETURNING id
    `, [appId, code, label, req.user?.UserId]);
    const setId = setRes.rows[0].id;
    for (let i = 0; i < items.length; i++) {
      const it = items[i] || {};
      const v = text(it.value) || text(it.label);
      const l = text(it.label) || v;
      if (!v) continue;
      await client.query(`
        INSERT INTO school_option_items (app_id, set_id, value, label, sort_order)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (set_id, value) DO UPDATE SET label=EXCLUDED.label, sort_order=EXCLUDED.sort_order, is_active=true
      `, [appId, setId, v, l, i]);
    }
    await client.query('COMMIT');
    const rows = await client.query(`
      SELECT oi.value, oi.label, oi.sort_order FROM school_option_items oi
      WHERE oi.set_id=$1 AND oi.is_active=true ORDER BY oi.sort_order, oi.label
    `, [setId]);
    await writeAudit(pool, appId, req.user, { action: 'options.update', entity: 'school_option_sets', entityId: setId, meta: { code } });
    res.json({ ok: true, items: rows.rows });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
}));

/* ---------- admission/enquiry ---------- */

schoolFoundationRouter.get('/admission/enquiries', route(async (req, res) => {
  const pool = getPool();
  const appId = appIdOf(req);
  const rows = await execQ(pool, `SELECT * FROM school_enquiries WHERE app_id=$1 ORDER BY id DESC LIMIT 200`, [appId]);
  res.json({ ok: true, enquiries: rows });
}));

schoolFoundationRouter.post('/admission/enquiries', route(async (req, res) => {
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  if (!text(b.firstName) && !text(b.first_name)) return res.status(400).json({ error: 'first name required' });
  const [row] = await execQ(pool, `
    INSERT INTO school_enquiries (app_id, enquiry_no, first_name, last_name, phone, email, class_applied, source, status, assigned_to, follow_up_date, remarks)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'enquiry',$9,$10,$11) RETURNING *
  `, [appId, b.enquiryNo||b.enquiry_no||('ENQ-'+Date.now()), text(b.firstName||b.first_name), text(b.lastName||b.last_name), text(b.phone), text(b.email), num(b.classApplied||b.class_applied), text(b.source), text(b.assignedTo||b.assigned_to), day(b.followUpDate||b.follow_up_date), text(b.remarks)]);
  await writeAudit(pool, appId, req.user, { action: 'enquiry.create', entity: 'school_enquiries', entityId: row.id });
  res.json({ ok: true, enquiry: row });
}));

schoolFoundationRouter.put('/admission/enquiries/:id', route(async (req, res) => {
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};
  const [row] = await execQ(pool, `UPDATE school_enquiries SET status=$3, assigned_to=$4, follow_up_date=$5, remarks=$6, updated_at=now() WHERE app_id=$1 AND id=$2 RETURNING *`, [appId, id, text(b.status)||'enquiry', text(b.assignedTo||b.assigned_to), day(b.followUpDate||b.follow_up_date), text(b.remarks)]);
  await writeAudit(pool, appId, req.user, { action: 'enquiry.update', entity: 'school_enquiries', entityId: id, meta: { status: b.status } });
  res.json({ ok: true, enquiry: row });
}));

schoolFoundationRouter.get('/admission/applications', route(async (req, res) => {
  const pool = getPool();
  const appId = appIdOf(req);
  const rows = await execQ(pool, `SELECT * FROM school_applications WHERE app_id=$1 ORDER BY id DESC LIMIT 200`, [appId]);
  res.json({ ok: true, applications: rows });
}));

schoolFoundationRouter.post('/admission/applications', route(async (req, res) => {
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  if (!text(b.firstName||b.first_name)) return res.status(400).json({ error: 'first name required' });
  const [row] = await execQ(pool, `
    INSERT INTO school_applications (app_id, application_no, enquiry_id, first_name, last_name, dob, gender, phone, email, class_applied, section_preference, father_name, mother_name, guardian_phone, address, documents, application_fee_amount, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'applied') RETURNING *
  `, [appId, b.applicationNo||b.application_no||('APP-'+Date.now()), num(b.enquiryId||b.enquiry_id), text(b.firstName||b.first_name), text(b.lastName||b.last_name), day(b.dob), text(b.gender), text(b.phone), text(b.email), num(b.classApplied||b.class_applied), text(b.sectionPreference||b.section_preference), text(b.fatherName||b.father_name), text(b.motherName||b.mother_name), text(b.guardianPhone||b.guardian_phone), text(b.address), JSON.stringify(b.documents||[]), num(b.applicationFeeAmount||b.application_fee_amount)||0]);
  await writeAudit(pool, appId, req.user, { action: 'application.create', entity: 'school_applications', entityId: row.id });
  res.json({ ok: true, application: row });
}));

schoolFoundationRouter.post('/admission/applications/:id/offer', route(async (req, res) => {
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [row] = await execQ(pool, `UPDATE school_applications SET status='offer_sent', offer_sent_at=now(), updated_at=now() WHERE app_id=$1 AND id=$2 RETURNING *`, [appId,id]);
  await writeAudit(pool, appId, req.user, { action: 'application.offer_sent', entity: 'school_applications', entityId: id });
  res.json({ ok: true, application: row });
}));

schoolFoundationRouter.post('/admission/applications/:id/admit', route(async (req, res) => {
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const appRes = await client.query(`SELECT * FROM school_applications WHERE app_id=$1 AND id=$2 FOR UPDATE`, [appId,id]);
    const app = appRes.rows[0];
    if (!app) throw new Error('Application not found');
    const yearRes = await client.query(`SELECT id FROM school_academic_years WHERE app_id=$1 ORDER BY is_active DESC,id LIMIT 1`, [appId]);
    const ayId = yearRes.rows[0]?.id;
    const studentRes = await client.query(`INSERT INTO school_students (app_id, admission_no, first_name, last_name, gender, dob, guardian_phone, address, class_id, status, admission_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',current_date) RETURNING *`, [appId, app.application_no || ('ADM-'+Date.now()), app.first_name, app.last_name, app.gender, app.dob, app.guardian_phone, app.address, app.class_applied]);
    const student = studentRes.rows[0];
    await client.query(`UPDATE school_applications SET status='admitted', student_id=$3, admitted_at=now(), updated_at=now() WHERE app_id=$1 AND id=$2`, [appId,id,student.id]);
    if (ayId && app.class_applied) {
      const secRes = await client.query(`SELECT id FROM school_sections WHERE app_id=$1 AND class_id=$2 ORDER BY id LIMIT 1`, [appId, app.class_applied]);
      await client.query(`INSERT INTO school_student_enrollments (app_id, student_id, academic_year_id, class_id, section_id, status) VALUES ($1,$2,$3,$4,$5,'active') ON CONFLICT DO NOTHING`, [appId, student.id, ayId, app.class_applied, secRes.rows[0]?.id]);
    }
    await client.query('COMMIT');
    await writeAudit(pool, appId, req.user, { action: 'application.admit', entity: 'school_applications', entityId: id, meta: { studentId: student.id } });
    res.json({ ok: true, student });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
}));

/* ---------- Groups CRUD ---------- */

schoolFoundationRouter.get('/groups', route(async (req, res) => {
  if (!guard(req, res, 'settings.view')) return;
  const pool = getPool();
  const rows = await execQ(pool, `
    SELECT g.*, 
      (SELECT count(*) FROM school_user_groups ug WHERE ug.group_id = g.id AND ug.app_id = g.app_id)::int AS member_count,
      (SELECT count(*) FROM school_group_permissions gp WHERE gp.group_id = g.id AND gp.app_id = g.app_id)::int AS permission_count
    FROM school_groups g
    WHERE g.app_id = $1 AND g.deleted_at IS NULL
    ORDER BY g.created_at DESC
  `, [appIdOf(req)]);
  res.json({ ok: true, groups: rows });
}));

schoolFoundationRouter.post('/groups', route(async (req, res) => {
  if (!guard(req, res, 'settings.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  if (!text(b.name)) return res.status(400).json({ error: 'Name required' });
  const code = text(b.code) || text(b.name).toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
  const [row] = await execQ(pool, `
    INSERT INTO school_groups (app_id, code, name, description, type, is_active, is_system, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (app_id, code) DO NOTHING RETURNING *
  `, [appIdOf(req), code, text(b.name), text(b.description), text(b.type) || 'custom', bool(b.is_active, true), false, userOf(req)]);
  if (!row) return res.status(409).json({ error: 'A group with this code already exists' });
  await writeAudit(pool, req, { action: 'group.create', entity: 'school_groups', entityId: row.id, after: row });
  res.json({ ok: true, group: row });
}));

schoolFoundationRouter.get('/groups/:id', route(async (req, res, next) => {
  if (!guard(req, res, 'settings.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  // Let static sibling routes such as /groups/check-permission match instead.
  if (!Number.isFinite(id)) return next();
  const [row] = await execQ(pool, 'SELECT * FROM school_groups WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, id]);
  if (!row) return res.status(404).json({ error: 'Group not found' });
  res.json({ ok: true, group: row });
}));

schoolFoundationRouter.put('/groups/:id', route(async (req, res) => {
  if (!guard(req, res, 'settings.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};
  const [row] = await execQ(pool, `
    UPDATE school_groups SET
      name=coalesce($3,name), description=coalesce($4,description), type=coalesce($5,type),
      is_active=coalesce($6,is_active), updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appId, id, text(b.name), text(b.description), text(b.type), b.isActive === undefined ? null : bool(b.is_active)]);
  if (!row) return res.status(404).json({ error: 'Group not found' });
  await writeAudit(pool, req, { action: 'group.update', entity: 'school_groups', entityId: id, after: row });
  res.json({ ok: true, group: row });
}));

schoolFoundationRouter.delete('/groups/:id', route(async (req, res) => {
  if (!guard(req, res, 'settings.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const rows = await execQ(pool, 'UPDATE school_groups SET deleted_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id', [appId, id]);
  if (!rows[0]) return res.status(404).json({ error: 'Group not found' });
  await writeAudit(pool, req, { action: 'group.delete', entity: 'school_groups', entityId: id });
  res.json({ ok: true });
}));

/* ---------- Group Permissions ---------- */

schoolFoundationRouter.get('/groups/:id/permissions', route(async (req, res) => {
  if (!guard(req, res, 'settings.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const rows = await execQ(pool, `
    SELECT gp.*, g.name as group_name
    FROM school_group_permissions gp
    JOIN school_groups g ON g.id = gp.group_id
    WHERE gp.app_id=$1 AND gp.group_id=$2
    ORDER BY gp.module, gp.action, gp.scope
  `, [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true, permissions: rows });
}));

schoolFoundationRouter.put('/groups/:id/permissions', route(async (req, res) => {
  if (!guard(req, res, 'settings.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};
  if (!Array.isArray(b.permissions)) return res.status(400).json({ error: 'Permissions array required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Delete existing permissions for this group
    await client.query('DELETE FROM school_group_permissions WHERE app_id=$1 AND group_id=$2', [appId, id]);
    // Insert new permissions
    for (const p of b.permissions) {
      if (!text(p.module) || !text(p.action)) continue;
      await client.query(`
        INSERT INTO school_group_permissions (app_id, group_id, module, action, scope, conditions)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb)
        ON CONFLICT (group_id, module, action, scope) DO UPDATE SET conditions=EXCLUDED.conditions
      `, [appId, id, text(p.module), text(p.action), text(p.scope) || 'campus', JSON.stringify(p.conditions || {})]);
    }
    await client.query('COMMIT');
    const rows = await execQ(pool, 'SELECT * FROM school_group_permissions WHERE app_id=$1 AND group_id=$2', [appId, id]);
    res.json({ ok: true, permissions: rows });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}));

/* ---------- User-Group Assignments ---------- */

schoolFoundationRouter.get('/users/:id/groups', route(async (req, res) => {
  if (!guard(req, res, 'settings.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const rows = await execQ(pool, `
    SELECT ug.*, g.name as group_name, g.code as group_code, g.type as group_type
    FROM school_user_groups ug
    JOIN school_groups g ON g.id = ug.group_id
    WHERE ug.app_id=$1 AND ug.user_id=$2
  `, [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true, groups: rows });
}));

schoolFoundationRouter.post('/users/:id/groups', route(async (req, res) => {
  if (!guard(req, res, 'settings.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};
  if (!num(b.groupId)) return res.status(400).json({ error: 'Group ID required' });
  const [row] = await execQ(pool, `
    INSERT INTO school_user_groups (app_id, user_id, group_id, campus_id, assigned_by)
    VALUES ($1,$2,$3,$4,$5) ON CONFLICT (app_id, user_id, group_id, campus_id) DO NOTHING RETURNING *
  `, [appId, id, num(b.groupId), num(b.campusId), userOf(req)]);
  if (!row) return res.status(409).json({ error: 'User already in this group' });
  await writeAudit(pool, req, { action: 'user_group.add', entity: 'school_user_groups', entityId: row.id, after: row });
  res.json({ ok: true, assignment: row });
}));

schoolFoundationRouter.delete('/users/:id/groups/:groupId', route(async (req, res) => {
  if (!guard(req, res, 'settings.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const groupId = num(req.params.groupId);
  const rows = await execQ(pool, 'DELETE FROM school_user_groups WHERE app_id=$1 AND user_id=$2 AND group_id=$3 RETURNING id', [appId, id, groupId]);
  if (!rows[0]) return res.status(404).json({ error: 'Assignment not found' });
  await writeAudit(pool, req, { action: 'user_group.remove', entity: 'school_user_groups', entityId: rows[0].id });
  res.json({ ok: true });
}));

/* ---------- Group Permissions Check ---------- */

schoolFoundationRouter.get('/groups/check-permission', route(async (req, res) => {
  if (!guard(req, res, 'settings.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const { userId, module, action, scope = 'campus' } = req.query;
  if (!num(userId) || !text(module) || !text(action)) return res.status(400).json({ error: 'userId, module, action required' });
  
  const rows = await execQ(pool, `
    SELECT 1 FROM school_user_groups ug
    JOIN school_group_permissions gp ON gp.group_id = ug.group_id AND gp.app_id = ug.app_id
    WHERE ug.app_id=$1 AND ug.user_id=$2
    AND gp.module=$3 AND gp.action=$4
    AND (gp.scope=$5 OR gp.scope='global')
  `, [appIdOf(req), num(userId), text(module), text(action), text(scope)]);
  
  res.json({ ok: true, hasPermission: rows.length > 0 });
}));

/* ---------- Effective Permissions for User ---------- */

schoolFoundationRouter.get('/users/:id/effective-permissions', route(async (req, res) => {
  if (!guard(req, res, 'settings.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  
  const rows = await execQ(pool, `
    SELECT DISTINCT gp.module, gp.action, gp.scope, gp.conditions, g.name as group_name
    FROM school_user_groups ug
    JOIN school_group_permissions gp ON gp.group_id = ug.group_id AND gp.app_id = ug.app_id
    JOIN school_groups g ON g.id = ug.group_id
    WHERE ug.app_id=$1 AND ug.user_id=$2
  `, [appId, num(req.params.id)]);
  
  res.json({ ok: true, permissions: rows });
}));

/* ---------- Integrations and Subscription ---------- */

schoolFoundationRouter.get('/integrations', route(async (req, res) => {
  if (!guard(req, res, 'settings.view')) return;
  const rows = await execQ(getPool(), `
    SELECT id, type, name, config, is_active, is_test_mode, last_tested_at, test_status, test_message
      FROM school_integrations
     WHERE app_id=$1 AND deleted_at IS NULL
     ORDER BY type, name
  `, [appIdOf(req)]);
  res.json({ ok: true, integrations: rows });
}));

schoolFoundationRouter.post('/integrations', route(async (req, res) => {
  if (!guard(req, res, 'settings.manage')) return;
  const b = req.body || {};
  const type = text(b.type);
  const name = text(b.name);
  if (!type || !name) return res.status(400).json({ error: 'Integration type and name are required' });
  const config = { ...(b.config && typeof b.config === 'object' ? b.config : {}) };
  if (text(b.provider)) config.provider = text(b.provider);
  try {
    const [row] = await execQ(getPool(), `
      INSERT INTO school_integrations (app_id, type, name, config, is_active, is_test_mode, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, type, name, config, is_active, is_test_mode, last_tested_at, test_status, test_message
    `, [appIdOf(req), type, name, JSON.stringify(config), bool(b.isActive), bool(b.isTestMode), userOf(req)]);
    res.status(201).json({ ok: true, integration: row });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Integration already exists' });
    throw error;
  }
}));

schoolFoundationRouter.put('/integrations/:id', route(async (req, res) => {
  if (!guard(req, res, 'settings.manage')) return;
  const b = req.body || {};
  const config = { ...(b.config && typeof b.config === 'object' ? b.config : {}) };
  if (text(b.provider)) config.provider = text(b.provider);
  const [row] = await execQ(getPool(), `
    UPDATE school_integrations
       SET type=$3, name=$4, config=$5, is_active=$6, is_test_mode=$7, updated_at=now()
     WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL
     RETURNING id, type, name, config, is_active, is_test_mode, last_tested_at, test_status, test_message
  `, [appIdOf(req), num(req.params.id), text(b.type), text(b.name), JSON.stringify(config), bool(b.isActive), bool(b.isTestMode)]);
  if (!row) return res.status(404).json({ error: 'Integration not found' });
  res.json({ ok: true, integration: row });
}));

schoolFoundationRouter.post('/integrations/:id/test', route(async (req, res) => {
  if (!guard(req, res, 'settings.manage')) return;
  const [row] = await execQ(getPool(), `
    UPDATE school_integrations
       SET last_tested_at=now(), test_status='success', test_message='Configuration saved; connectivity test queued', updated_at=now()
     WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL
     RETURNING id, last_tested_at, test_status, test_message
  `, [appIdOf(req), num(req.params.id)]);
  if (!row) return res.status(404).json({ error: 'Integration not found' });
  res.json({ ok: true, test: row });
}));

schoolFoundationRouter.delete('/integrations/:id', route(async (req, res) => {
  if (!guard(req, res, 'settings.manage')) return;
  const [row] = await execQ(getPool(), `
    UPDATE school_integrations SET deleted_at=now(), updated_at=now()
     WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id
  `, [appIdOf(req), num(req.params.id)]);
  if (!row) return res.status(404).json({ error: 'Integration not found' });
  res.json({ ok: true });
}));

schoolFoundationRouter.get('/subscription', route(async (req, res) => {
  if (!guard(req, res, 'settings.view')) return;
  const [row] = await execQ(getPool(), `
    SELECT sub.*,
           (SELECT count(*)::int FROM school_students s WHERE s.app_id=sub.app_id AND s.deleted_at IS NULL) AS students_count,
           (SELECT count(*)::int FROM school_staff st WHERE st.app_id=sub.app_id AND st.deleted_at IS NULL) AS staff_count,
           (SELECT count(*)::int FROM school_campuses c WHERE c.app_id=sub.app_id AND c.status='active') AS campuses_count
      FROM school_subscription sub
     WHERE sub.app_id=$1
     ORDER BY sub.id DESC
     LIMIT 1
  `, [appIdOf(req)]);
  res.json({ ok: true, subscription: row || { plan_name: 'Free Trial', status: 'trial', billing_cycle: 'monthly', features: [] } });
}));

schoolFoundationRouter.post('/subscription/upgrade', route(async (req, res) => {
  if (!guard(req, res, 'settings.manage')) return;
  const plans = {
    basic: { name: 'Basic', price: 999, features: ['basic_student_mgmt', 'basic_attendance', 'basic_fees'] },
    pro: { name: 'Professional', price: 2499, features: ['basic_student_mgmt', 'basic_attendance', 'basic_fees', 'reports', 'communication'] },
    enterprise: { name: 'Enterprise', price: 5999, features: ['all_modules', 'priority_support', 'advanced_reports'] },
  };
  const code = text(req.body?.plan_code).toLowerCase();
  const plan = plans[code];
  if (!plan) return res.status(400).json({ error: 'Unknown subscription plan' });
  const [row] = await execQ(getPool(), `
    INSERT INTO school_subscription (app_id, plan_name, plan_code, status, billing_cycle, price, currency, features, renewal_date, created_by)
    VALUES ($1,$2,$3,'active','monthly',$4,'INR',$5,current_date + interval '1 month',$6)
    RETURNING *
  `, [appIdOf(req), plan.name, code, plan.price, JSON.stringify(plan.features), userOf(req)]);
  res.json({ ok: true, subscription: row });
}));

schoolFoundationRouter.post('/subscription/cancel', route(async (req, res) => {
  if (!guard(req, res, 'settings.manage')) return;
  const [row] = await execQ(getPool(), `
    UPDATE school_subscription SET status='cancelled', updated_at=now()
     WHERE app_id=$1 AND status IN ('active','trial') RETURNING *
  `, [appIdOf(req)]);
  if (!row) return res.status(404).json({ error: 'Active subscription not found' });
  res.json({ ok: true, subscription: row });
}));

export { schoolFoundationRouter };