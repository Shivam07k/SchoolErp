/* HR & Payroll — Leave Management Routes */
import express from 'express';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { ensureFoundation, loadAccess } from '../school/foundation.js';

const hrLeaveRouter = express.Router();

hrLeaveRouter.use(verifyToken);

hrLeaveRouter.use(async (req, _res, next) => {
  if (!req.school) {
    const pool = getPool();
    const appId = req.user?.company || DEFAULT_COMPANY_ID;
    await ensureFoundation(pool, appId);
    req.school = await loadAccess(pool, appId, req.user);
  }
  next();
});

/* ---- helpers ---- */
const num = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};
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
const appIdOf = (req) => req.school?.appId || 'default';
const userOf = (req) => req.user?.userid || req.user?.id || 'system';

function guardView(req, res, perm) {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('hr.view') || perms.includes('hr.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

function guardManage(req, res, perm) {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('hr.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

function guardApprove(req, res) {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes('hr.leave_approve') || perms.includes('hr.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ============================================================
   LEAVE TYPES
   ============================================================ */

hrLeaveRouter.get('/hr/leave/types', route(async (req, res) => {
  if (!guardView(req, res, 'hr.leave_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const rows = await execQ(pool, 'SELECT * FROM school_leave_type WHERE app_id=$1 AND deleted_at IS NULL ORDER BY sort_order, name', [appId]);
  res.json({ ok: true, types: rows });
}));

hrLeaveRouter.post('/hr/leave/types', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.leave_manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};

  if (!text(b.name) || !text(b.code)) {
    return res.status(400).json({ error: 'Name and code are required' });
  }

  const code = text(b.code).toUpperCase();
  const [existing] = await execQ(pool, `
    SELECT id FROM school_leave_type
    WHERE app_id=$1 AND code=$2 AND deleted_at IS NULL
    LIMIT 1
  `, [appId, code]);
  if (existing) return res.status(409).json({ error: 'Leave type code already exists' });

  const [row] = await execQ(pool, `
    INSERT INTO school_leave_type (app_id, name, code, is_paid, accrual_rule, carry_forward_max, encashable, half_day_allowed, document_required_after_days, requires_approval, approval_roles, is_active, sort_order, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *
  `, [appId, text(b.name), code, b.is_paid !== false, b.accrual_rule || null, num(b.carry_forward_max) || 0, b.encashable === true, b.half_day_allowed !== false, num(b.document_required_after_days) || 3, b.requires_approval !== false, b.approval_roles || [], b.is_active !== false, num(b.sort_order) || 0, userOf(req)]);

  res.json({ ok: true, type: row });
}));

hrLeaveRouter.put('/hr/leave/types/:id', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.leave_manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};

  const [row] = await execQ(pool, `
    UPDATE school_leave_type SET
      name=$3, code=$4, is_paid=$5, accrual_rule=$6, carry_forward_max=$7, encashable=$8, half_day_allowed=$9,
      document_required_after_days=$10, requires_approval=$11, approval_roles=$12, is_active=$13, sort_order=$14, updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appId, id, text(b.name), text(b.code).toUpperCase(), b.is_paid !== false, b.accrual_rule || null, num(b.carry_forward_max) || 0, b.encashable === true, b.half_day_allowed !== false, num(b.document_required_after_days) || 3, b.requires_approval !== false, b.approval_roles || [], b.is_active !== false, num(b.sort_order) || 0]);

  if (!row) return res.status(404).json({ error: 'Leave type not found' });
  res.json({ ok: true, type: row });
}));

hrLeaveRouter.delete('/hr/leave/types/:id', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.leave_manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  await execQ(pool, 'UPDATE school_leave_type SET deleted_at=now() WHERE app_id=$1 AND id=$2', [appId, num(req.params.id)]);
  res.json({ ok: true });
}));

/* ============================================================
   LEAVE POLICIES
   ============================================================ */

hrLeaveRouter.get('/hr/leave/policies', route(async (req, res) => {
  if (!guardView(req, res, 'hr.leave_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const rows = await execQ(pool, `
    SELECT p.*, lt.name AS type_name, lt.code AS type_code
      FROM school_leave_policy p
      JOIN school_leave_type lt ON lt.id=p.leave_type_id
     WHERE p.app_id=$1 AND p.deleted_at IS NULL
     ORDER BY lt.sort_order, p.staff_category
  `, [appId]);
  res.json({ ok: true, policies: rows });
}));

hrLeaveRouter.post('/hr/leave/policies', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.leave_manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};

  const [row] = await execQ(pool, `
    INSERT INTO school_leave_policy (app_id, leave_type_id, staff_category, yearly_quota, accrual_frequency, rules, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [appId, num(b.leave_type_id), text(b.staff_category), num(b.yearly_quota), text(b.accrual_frequency) || 'monthly', b.rules || {}, userOf(req)]);

  res.json({ ok: true, policy: row });
}));

hrLeaveRouter.put('/hr/leave/policies/:id', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.leave_manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};

  const [row] = await execQ(pool, `
    UPDATE school_leave_policy SET
      yearly_quota=$3, accrual_frequency=$4, rules=$5, updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appId, id, num(b.yearly_quota), text(b.accrual_frequency) || 'monthly', b.rules || {}]);

  if (!row) return res.status(404).json({ error: 'Policy not found' });
  res.json({ ok: true, policy: row });
}));

hrLeaveRouter.delete('/hr/leave/policies/:id', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.leave_manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  await execQ(pool, 'UPDATE school_leave_policy SET deleted_at=now() WHERE app_id=$1 AND id=$2', [appId, num(req.params.id)]);
  res.json({ ok: true });
}));

/* ============================================================
   LEAVE BALANCES
   ============================================================ */

hrLeaveRouter.get('/hr/leave/balances', route(async (req, res) => {
  if (!guardView(req, res, 'hr.leave_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const staffId = num(req.query.staff_id);
  const leaveTypeId = num(req.query.leave_type_id);

  let where = ['lbe.app_id=$1', 'lbe.deleted_at IS NULL'];
  const values = [appIdOf(req)];

  if (staffId) { values.push(staffId); where.push(`lbe.staff_id=$${values.length}`); }
  if (leaveTypeId) { values.push(leaveTypeId); where.push(`lbe.leave_type_id=$${values.length}`); }

  const balances = await execQ(pool, `
    SELECT lbe.staff_id, lbe.leave_type_id, lt.name AS type_name, lt.code AS type_code,
           SUM(lbe.change) AS balance,
           SUM(lbe.change) FILTER (WHERE lbe.source='accrual') AS accrued,
           SUM(lbe.change) FILTER (WHERE lbe.source='usage') AS used,
           SUM(lbe.change) FILTER (WHERE lbe.source='adjustment') AS adjusted,
           SUM(lbe.change) FILTER (WHERE lbe.source='encashment') AS encashed,
           SUM(lbe.change) FILTER (WHERE lbe.source='carry_forward') AS carried_forward,
           SUM(lbe.change) FILTER (WHERE lbe.source='opening') AS opening
      FROM school_leave_balance_entry lbe
      JOIN school_leave_type lt ON lt.id=lbe.leave_type_id
     WHERE ${where.join(' AND ')}
     GROUP BY lbe.staff_id, lbe.leave_type_id, lt.name, lt.code, lt.sort_order
     ORDER BY lbe.staff_id, lt.sort_order
  `, values);

  res.json({ ok: true, balances });
}));

hrLeaveRouter.get('/hr/leave/balance-ledger/:staffId', route(async (req, res) => {
  if (!guardView(req, res, 'hr.leave_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const staffId = num(req.params.staffId);
  const leaveTypeId = num(req.query.leave_type_id);

  let where = ['lbe.app_id=$1', 'lbe.staff_id=$2', 'lbe.deleted_at IS NULL'];
  const values = [appIdOf(req), num(req.params.staffId)];

  if (leaveTypeId) { values.push(leaveTypeId); where.push(`lbe.leave_type_id=$${values.length}`); }

  const ledger = await execQ(pool, `
    SELECT lbe.*, lt.name AS type_name, lt.code AS type_code
      FROM school_leave_balance_entry lbe
      JOIN school_leave_type lt ON lt.id=lbe.leave_type_id
     WHERE ${where.join(' AND ')}
     ORDER BY lbe.date DESC, lbe.created_at DESC
  `, values);

  res.json({ ok: true, ledger });
}));

/* ============================================================
   ACCRUAL / CARRY FORWARD / ENCASHMENT JOBS
   ============================================================ */

hrLeaveRouter.post('/hr/leave/accrual/run', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.leave_manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const accrualDate = dayOf(req.body?.date) || new Date().toISOString().slice(0, 10);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const policies = await client.query(`
      SELECT p.*, lt.accrual_rule, lt.code
        FROM school_leave_policy p
        JOIN school_leave_type lt ON lt.id=p.leave_type_id
       WHERE p.app_id=$1 AND p.deleted_at IS NULL AND lt.deleted_at IS NULL AND lt.is_active=true
    `, [appId]);

    let created = 0;

    for (const policy of policies.rows) {
      const rule = policy.accrual_rule || {};
      if (!rule.days_per_period) continue;

      const staff = await client.query(`
        SELECT s.id, e.type AS staff_type
          FROM school_staff s
          JOIN school_staff_employment e ON e.app_id=s.app_id AND e.staff_id=s.id AND e.deleted_at IS NULL
         WHERE s.app_id=$1 AND s.deleted_at IS NULL AND s.status='active'
           AND (e.effective_to IS NULL OR e.effective_to >= current_date)
           AND e.effective_from <= current_date
           AND e.type = $2
      `, [appId, policy.staff_category]);

      for (const s of staff.rows) {
        const accrualDays = num(rule.days_per_period);
        if (!accrualDays) continue;

        await client.query(`
          INSERT INTO school_leave_balance_entry (app_id, staff_id, leave_type_id, date, change, source, remarks, created_by)
          VALUES ($1,$2,$3,$4,$5,'accrual',$6,$7)
          ON CONFLICT DO NOTHING
        `, [appId, s.id, policy.leave_type_id, accrualDate, accrualDays, `Monthly accrual for ${policy.code}`, userOf(req)]);
        created++;
      }
    }

    await client.query('COMMIT');
    res.json({ ok: true, entries_created: created });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}));

hrLeaveRouter.post('/hr/leave/carry-forward', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.leave_manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const yearEnd = dayOf(req.body?.date) || new Date().toISOString().slice(0, 10);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const balances = await client.query(`
      SELECT lbe.staff_id, lbe.leave_type_id, SUM(lbe.change) AS balance, lt.carry_forward_max
        FROM school_leave_balance_entry lbe
        JOIN school_leave_type lt ON lt.id=lbe.leave_type_id
       WHERE lbe.app_id=$1 AND lbe.deleted_at IS NULL AND lt.deleted_at IS NULL
       GROUP BY lbe.staff_id, lbe.leave_type_id, lt.carry_forward_max
    `, [appId]);

    let carried = 0;
    for (const b of balances.rows) {
      const carry = Math.min(num(b.balance) || 0, num(b.carry_forward_max) || 0);
      if (carry > 0) {
        await client.query(`
          INSERT INTO school_leave_balance_entry (app_id, staff_id, leave_type_id, date, change, source, remarks, created_by)
          VALUES ($1,$2,$3,$4,$5,'carry_forward',$6,$7)
        `, [appId, b.staff_id, b.leave_type_id, yearEnd, carry, 'Year-end carry forward', userOf(req)]);
        carried++;
      }
    }

    await client.query('COMMIT');
    res.json({ ok: true, carried_forward: carried });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}));

hrLeaveRouter.post('/hr/leave/encashment', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.leave_manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const yearEnd = dayOf(req.body?.date) || new Date().toISOString().slice(0, 10);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const balances = await client.query(`
      SELECT lbe.staff_id, lbe.leave_type_id, SUM(lbe.change) AS balance, lt.encashable
        FROM school_leave_balance_entry lbe
        JOIN school_leave_type lt ON lt.id=lbe.leave_type_id
       WHERE lbe.app_id=$1 AND lbe.deleted_at IS NULL AND lt.deleted_at IS NULL AND lt.encashable=true
       GROUP BY lbe.staff_id, lbe.leave_type_id, lt.encashable
    `, [appId]);

    let encashed = 0;
    for (const b of balances.rows) {
      const balance = num(b.balance) || 0;
      if (balance > 0) {
        await client.query(`
          INSERT INTO school_leave_balance_entry (app_id, staff_id, leave_type_id, date, change, source, remarks, created_by)
          VALUES ($1,$2,$3,$4,-$5,'encashment',$6,$7)
        `, [appId, b.staff_id, b.leave_type_id, yearEnd, balance, 'Year-end encashment', userOf(req)]);
        encashed++;
      }
    }

    await client.query('COMMIT');
    res.json({ ok: true, encashed });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}));

/* ============================================================
   LEAVE APPLICATIONS
   ============================================================ */

hrLeaveRouter.get('/hr/leave/applications', route(async (req, res) => {
  if (!guardView(req, res, 'hr.leave_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);

  const values = [appId];
  const where = ['la.app_id=$1', 'la.deleted_at IS NULL'];

  if (num(req.query.staff_id)) { values.push(num(req.query.staff_id)); where.push(`la.staff_id=$${values.length}`); }
  if (num(req.query.leave_type_id)) { values.push(num(req.query.leave_type_id)); where.push(`la.leave_type_id=$${values.length}`); }
  if (text(req.query.status)) { values.push(text(req.query.status)); where.push(`la.status=$${values.length}`); }
  if (dayOf(req.query.from_date)) { values.push(dayOf(req.query.from_date)); where.push(`la.from_date >= $${values.length}`); }
  if (dayOf(req.query.to_date)) { values.push(dayOf(req.query.to_date)); where.push(`la.to_date <= $${values.length}`); }

  const rows = await execQ(pool, `
    SELECT la.*, lt.name AS type_name, lt.code AS type_code,
           s.name AS staff_name, s.employee_code,
           e.designation, e.department
      FROM school_leave_application la
      JOIN school_leave_type lt ON lt.id=la.leave_type_id
      JOIN school_staff s ON s.id=la.staff_id
      LEFT JOIN LATERAL (
        SELECT designation, department FROM school_staff_employment e
         WHERE e.app_id=s.app_id AND e.staff_id=s.id AND e.deleted_at IS NULL
         ORDER BY e.effective_from DESC LIMIT 1
      ) e ON true
     WHERE ${where.join(' AND ')}
     ORDER BY la.applied_at DESC
     LIMIT 100
  `, [appId]);

  res.json({ ok: true, applications: rows });
}));

hrLeaveRouter.post('/hr/leave/applications', route(async (req, res) => {
  if (!guardView(req, res, 'hr.leave_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  const staffId = num(b.staff_id) || req.school?.userId;

  if (!staffId) return res.status(400).json({ error: 'Staff ID required' });
  if (!num(b.leave_type_id)) return res.status(400).json({ error: 'Leave type required' });
  if (!dayOf(b.from_date) || !dayOf(b.to_date)) return res.status(400).json({ error: 'From and to dates required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const days = num(b.days) || calculateDays(dayOf(b.from_date), dayOf(b.to_date), b.half_day, b.half_day_session);

    const balance = await client.query(`
      SELECT COALESCE(SUM(change),0) AS balance
        FROM school_leave_balance_entry
       WHERE app_id=$1 AND staff_id=$2 AND leave_type_id=$3 AND deleted_at IS NULL
    `, [appId, staffId, num(b.leave_type_id)]);

    const leaveType = await client.query('SELECT requires_approval, approval_roles FROM school_leave_type WHERE app_id=$1 AND id=$2', [appId, num(b.leave_type_id)]);
    const requiresApproval = leaveType.rows[0]?.requires_approval !== false;

    const [app] = await execQ(pool, `
      INSERT INTO school_leave_application (app_id, staff_id, leave_type_id, from_date, to_date, half_day, half_day_session, days, reason, attachment_url, status, approver_chain, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *
    `, [appId, staffId, num(b.leave_type_id), dayOf(b.from_date), dayOf(b.to_date), b.half_day === true, b.half_day_session || null, days, text(b.reason), text(b.attachment_url), requiresApproval ? 'pending' : 'approved', requiresApproval ? [{role: 'HOD', status: 'pending'}] : [], userOf(req)]);

    if (!requiresApproval) {
      await client.query(`
        INSERT INTO school_leave_balance_entry (app_id, staff_id, leave_type_id, date, change, source, source_id, remarks, created_by)
        VALUES ($1,$2,$3,$4,-$5,'usage',$6,$7,$8)
      `, [appId, staffId, num(b.leave_type_id), dayOf(b.to_date), days, app.id, 'Leave application', userOf(req)]);
    }

    await client.query('COMMIT');
    res.json({ ok: true, application: app });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}));

hrLeaveRouter.post('/hr/leave/applications/:id/approve', route(async (req, res) => {
  if (!guardApprove(req, res)) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const [app] = await execQ(pool, `
      UPDATE school_leave_application SET
        status='approved', approved_by=$3, approved_at=now(), updated_at=now()
      WHERE app_id=$1 AND id=$2 AND status='pending' AND deleted_at IS NULL RETURNING *
    `, [appId, id, userOf(req)]);

    if (!app) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pending application not found' }); }

    await client.query(`
      INSERT INTO school_leave_balance_entry (app_id, staff_id, leave_type_id, date, change, source, source_id, remarks, created_by)
      VALUES ($1,$2,$3,$4,-$5,'usage',$6,$7,$8)
    `, [appId, app.staff_id, app.leave_type_id, app.to_date, app.days, app.id, 'Approved leave', userOf(req)]);

    await client.query('COMMIT');
    res.json({ ok: true, application: app });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}));

hrLeaveRouter.post('/hr/leave/applications/:id/reject', route(async (req, res) => {
  if (!guardApprove(req, res)) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};

  const [row] = await execQ(pool, `
    UPDATE school_leave_application SET
      status='rejected', rejected_by=$3, rejected_at=now(), rejection_reason=$4, updated_at=now()
    WHERE app_id=$1 AND id=$2 AND status='pending' AND deleted_at IS NULL RETURNING *
  `, [appId, id, userOf(req), text(b.reason)]);

  if (!row) return res.status(404).json({ error: 'Pending application not found' });
  res.json({ ok: true, application: row });
}));

hrLeaveRouter.post('/hr/leave/applications/:id/cancel', route(async (req, res) => {
  if (!guardView(req, res, 'hr.leave_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const [app] = await execQ(pool, `
      UPDATE school_leave_application SET
        status='cancelled', cancelled_by=$3, cancelled_at=now(), cancellation_reason=$4, updated_at=now()
      WHERE app_id=$1 AND id=$2 AND status IN ('approved','pending') AND deleted_at IS NULL RETURNING *
    `, [appId, id, userOf(req), text(b.reason)]);

    if (!app) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Application not found or cannot be cancelled' }); }

    if (app.status === 'approved') {
      await client.query(`
        INSERT INTO school_leave_balance_entry (app_id, staff_id, leave_type_id, date, change, source, source_id, remarks, created_by)
        VALUES ($1,$2,$3,$4,$5,'adjustment',$6,$7,$8)
      `, [appId, app.staff_id, app.leave_type_id, app.to_date, app.days, app.id, 'Cancelled leave', userOf(req)]);
    }

    await client.query('COMMIT');
    res.json({ ok: true, application: app });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}));

/* ============================================================
   CALENDAR
   ============================================================ */

hrLeaveRouter.get('/hr/leave/calendar', route(async (req, res) => {
  if (!guardView(req, res, 'hr.leave_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const from = dayOf(req.query.from) || new Date().toISOString().slice(0, 10);
  const to = dayOf(req.query.to) || new Date(Date.now() + 30*86400000).toISOString().slice(0, 10);

  const applications = await execQ(pool, `
    SELECT la.*, lt.name AS type_name, lt.code AS type_code, s.name AS staff_name, s.employee_code
      FROM school_leave_application la
      JOIN school_leave_type lt ON lt.id=la.leave_type_id
      JOIN school_staff s ON s.id=la.staff_id
     WHERE la.app_id=$1 AND la.deleted_at IS NULL AND la.status IN ('approved','taken')
       AND la.to_date >= $2 AND la.from_date <= $3
     ORDER BY la.from_date
  `, [appId, from, to]);

  const holidays = await execQ(pool, 'SELECT * FROM school_holiday WHERE app_id=$1 AND deleted_at IS NULL AND date BETWEEN $2 AND $3', [appId, from, to]);

  res.json({ ok: true, applications, holidays });
}));

/* ============================================================
   COMP-OFF
   ============================================================ */

hrLeaveRouter.get('/hr/leave/compoff', route(async (req, res) => {
  if (!guardView(req, res, 'hr.leave_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const rows = await execQ(pool, 'SELECT * FROM school_comp_off WHERE app_id=$1 AND deleted_at IS NULL ORDER BY earned_date DESC', [appId]);
  res.json({ ok: true, compoff: rows });
}));

hrLeaveRouter.post('/hr/leave/compoff', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.leave_manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};

  const [row] = await execQ(pool, `
    INSERT INTO school_comp_off (app_id, staff_id, earned_date, reason, expiry_date, created_by)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
  `, [appId, num(b.staff_id), dayOf(b.earned_date), text(b.reason), dayOf(b.expiry_date), userOf(req)]);

  res.json({ ok: true, compoff: row });
}));

/* ============================================================
   HOLIDAYS
   ============================================================ */

hrLeaveRouter.get('/hr/leave/holidays', route(async (req, res) => {
  if (!guardView(req, res, 'hr.leave_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const rows = await execQ(pool, 'SELECT * FROM school_holiday WHERE app_id=$1 AND deleted_at IS NULL ORDER BY date', [appId]);
  res.json({ ok: true, holidays: rows });
}));

hrLeaveRouter.post('/hr/leave/holidays', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.leave_manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};

  const [row] = await execQ(pool, `
    INSERT INTO school_holiday (app_id, name, date, is_recurring, recurring_rule, applicable_to, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [appId, text(b.name), dayOf(b.date), b.is_recurring === true, text(b.recurring_rule), b.applicable_to || [], userOf(req)]);

  res.json({ ok: true, holiday: row });
}));

hrLeaveRouter.put('/hr/leave/holidays/:id', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.leave_manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};

  const [row] = await execQ(pool, `
    UPDATE school_holiday SET name=$3, date=$4, is_recurring=$5, recurring_rule=$6, applicable_to=$7, updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appId, num(req.params.id), text(b.name), dayOf(b.date), b.is_recurring === true, text(b.recurring_rule), b.applicable_to || []]);

  if (!row) return res.status(404).json({ error: 'Holiday not found' });
  res.json({ ok: true, holiday: row });
}));

hrLeaveRouter.delete('/hr/leave/holidays/:id', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.leave_manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  await execQ(pool, 'UPDATE school_holiday SET deleted_at=now() WHERE app_id=$1 AND id=$2', [appId, num(req.params.id)]);
  res.json({ ok: true });
}));

/* ============================================================
   HELPER FUNCTION
   ============================================================ */

function calculateDays(fromDate, toDate, halfDay, halfDaySession) {
  if (!fromDate || !toDate) return 0;
  const from = new Date(fromDate);
  const to = new Date(toDate);
  if (from > to) return 0;

  const diffTime = to - from;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

  if (halfDay && halfDaySession) return 0.5;
  if (halfDay) return 0.5;
  return diffDays;
}

export default hrLeaveRouter;