/* HR & Payroll — Advances Routes */
import express from 'express';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { ensureFoundation, loadAccess } from '../school/foundation.js';

const hrAdvancesRouter = express.Router();

hrAdvancesRouter.use(verifyToken);

hrAdvancesRouter.use(async (req, _res, next) => {
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
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const n0 = (n) => Number(n) || 0;

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
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('hr.manage') || perms.includes('hr.advance_manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

function guardApprove(req, res) {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes('hr.advance_approve') || perms.includes('hr.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const q = (client, sql, values = []) => client.query({ text: sql, values }).then((r) => r.rows);

/* ============================================================
   DASHBOARD (must come before :id route)
   ============================================================ */

hrAdvancesRouter.get('/hr/advances/dashboard', route(async (req, res) => {
  if (!guardView(req, res, 'hr.advance_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);

  const [summary] = await execQ(pool, `
    SELECT
      COUNT(*) FILTER (WHERE status IN ('requested','approved','disbursed','recovering'))::int AS active_count,
      COUNT(*) FILTER (WHERE status='requested')::int AS requested_count,
      COUNT(*) FILTER (WHERE status='approved')::int AS approved_count,
      COUNT(*) FILTER (WHERE status='disbursed')::int AS disbursed_count,
      COUNT(*) FILTER (WHERE status='recovering')::int AS recovering_count,
      COUNT(*) FILTER (WHERE status='closed')::int AS closed_count,
      COUNT(*) FILTER (WHERE status='written_off')::int AS written_off_count,
      COALESCE(SUM(outstanding),0) AS total_outstanding
    FROM (
      SELECT a.*, COALESCE((
        SELECT SUM(total_amount - COALESCE(recovered_amount,0))
          FROM school_repayment_schedule rs
         WHERE rs.advance_id=a.id AND rs.deleted_at IS NULL
      ),0) AS outstanding
      FROM school_advance a
     WHERE a.app_id=$1 AND a.deleted_at IS NULL
    ) a
  `, [appId]);

  const byType = await execQ(pool, `
    SELECT type, COUNT(*)::int AS count, COALESCE(SUM(amount),0) AS total_amount
      FROM school_advance WHERE app_id=$1 AND deleted_at IS NULL
      GROUP BY type
  `, [appId]);

  const dueSoon = await execQ(pool, `
    SELECT rs.*, a.amount AS advance_amount, a.type AS advance_type, s.name AS staff_name, s.employee_code,
           (rs.total_amount - COALESCE(rs.recovered_amount,0)) AS outstanding
      FROM school_repayment_schedule rs
      JOIN school_advance a ON a.id=rs.advance_id
      JOIN school_staff s ON s.id=a.staff_id
     WHERE rs.app_id=$1 AND rs.deleted_at IS NULL AND a.deleted_at IS NULL
       AND rs.status IN ('pending','partially_recovered')
       AND rs.due_month <= (date_trunc('month', CURRENT_DATE) + interval '1 month')
     ORDER BY rs.due_month
     LIMIT 50
  `, [appId]);

  res.json({ ok: true, summary: summary[0], byType, dueSoon });
}));

/* ============================================================
   ADVANCES LIST / CREATE
   ============================================================ */

hrAdvancesRouter.get('/hr/advances', route(async (req, res) => {
  if (!guardView(req, res, 'hr.advance_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const status = text(req.query.status);
  const type = text(req.query.type);
  const staffId = num(req.query.staff_id);

  let where = ['a.app_id=$1', 'a.deleted_at IS NULL'];
  const values = [appId];
  if (status) { values.push(status); where.push(`a.status=$${values.length}`); }
  if (type) { values.push(type); where.push(`a.type=$${values.length}`); }
  if (staffId) { values.push(staffId); where.push(`a.staff_id=$${values.length}`); }

  const rows = await execQ(pool, `
    SELECT a.*, s.name AS staff_name, s.employee_code
      FROM school_advance a
      JOIN school_staff s ON s.id=a.staff_id
     WHERE ${where.join(' AND ')}
     ORDER BY a.requested_at DESC
  `, values);
  res.json({ ok: true, advances: rows });
}));

hrAdvancesRouter.post('/hr/advances', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.advance_manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};

  if (!num(b.staff_id) || !text(b.type) || !num(b.amount) || !num(b.installments)) {
    return res.status(400).json({ error: 'Staff, type, amount and installments are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const [advance] = await q(client, `
      INSERT INTO school_advance (app_id, staff_id, type, amount, reason, installments, interest_rate, interest_type, status, requested_by, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'requested',$9,$10) RETURNING *
    `, [appId, num(b.staff_id), text(b.type), num(b.amount), text(b.reason), num(b.installments), num(b.interest_rate) || 0, text(b.interest_type) || 'flat', userOf(req), userOf(req)]);

    // Create repayment schedule
    const principalPerInstallment = n0(b.amount) / n0(b.installments);
    const interestPerInstallment = (n0(b.amount) * (n0(b.interest_rate) || 0) / 100) / n0(b.installments);
    const totalPerInstallment = r2(principalPerInstallment + interestPerInstallment);

    for (let i = 1; i <= n0(b.installments); i++) {
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + i);
      const dueMonth = dueDate.toISOString().slice(0, 7) + '-01';

      await client.query(`
        INSERT INTO school_repayment_schedule (app_id, advance_id, installment_no, due_month, principal_amount, interest_amount, total_amount, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [appId, advance.id, i, dueMonth, r2(principalPerInstallment), r2(interestPerInstallment), totalPerInstallment, userOf(req)]);
    }

    await client.query('COMMIT');
    res.json({ ok: true, advance });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}));

hrAdvancesRouter.get('/hr/advances/:id', route(async (req, res, next) => {
  if (!guardView(req, res, 'hr.advance_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);

  if (!id) return next();

  const [advance] = await execQ(pool, `
    SELECT a.*, s.name AS staff_name, s.employee_code
      FROM school_advance a
      JOIN school_staff s ON s.id=a.staff_id
     WHERE a.app_id=$1 AND a.id=$2 AND a.deleted_at IS NULL
  `, [appId, id]);

  if (!advance) return res.status(404).json({ error: 'Advance not found' });

  const schedule = await execQ(pool, `
    SELECT * FROM school_repayment_schedule
     WHERE app_id=$1 AND advance_id=$2 AND deleted_at IS NULL
     ORDER BY installment_no
  `, [appId, id]);

  const ledger = await execQ(pool, `
    SELECT * FROM school_advance_ledger_entry
     WHERE app_id=$1 AND advance_id=$2
     ORDER BY date DESC, created_at DESC
  `, [appId, id]);

  res.json({ ok: true, advance, schedule, ledger });
}));

hrAdvancesRouter.put('/hr/advances/:id', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.advance_manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};

  if (b.status && !['requested','approved','rejected','disbursed','recovering','closed','written_off'].includes(b.status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const [row] = await execQ(pool, `
    UPDATE school_advance SET
      type=$3, amount=$4, reason=$5, installments=$6, interest_rate=$7, interest_type=$8,
      status=$9, rejection_reason=$10, updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appId, id, text(b.type), num(b.amount), text(b.reason), num(b.installments), num(b.interest_rate), text(b.interest_type), text(b.status), text(b.rejection_reason)]);

  if (!row) return res.status(404).json({ error: 'Advance not found' });
  res.json({ ok: true, advance: row });
}));

hrAdvancesRouter.delete('/hr/advances/:id', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.advance_manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);

  const [advance] = await execQ(pool, 'SELECT status FROM school_advance WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, id]);
  if (!advance) return res.status(404).json({ error: 'Advance not found' });
  if (!['requested', 'rejected', 'cancelled'].includes(advance.status)) return res.status(409).json({ error: 'Only requested/rejected advances can be deleted' });

  await execQ(pool, 'UPDATE school_advance SET deleted_at=now() WHERE app_id=$1 AND id=$2', [appId, id]);
  res.json({ ok: true });
}));

/* ============================================================
   APPROVE / REJECT / DISBURSE
   ============================================================ */

hrAdvancesRouter.post('/hr/advances/:id/approve', route(async (req, res) => {
  if (!guardApprove(req)) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);

  const [row] = await execQ(pool, `
    UPDATE school_advance SET status='approved', approved_by=$3, approved_at=now(), updated_at=now()
     WHERE app_id=$1 AND id=$2 AND status='requested' AND deleted_at IS NULL RETURNING *
  `, [appId, id, userOf(req)]);

  if (!row) return res.status(404).json({ error: 'Requested advance not found' });
  res.json({ ok: true, advance: row });
}));

hrAdvancesRouter.post('/hr/advances/:id/reject', route(async (req, res) => {
  if (!guardApprove(req)) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};

  const [row] = await execQ(pool, `
    UPDATE school_advance SET status='rejected', rejected_by=$3, rejected_at=now(), rejection_reason=$4, updated_at=now()
     WHERE app_id=$1 AND id=$2 AND status='requested' AND deleted_at IS NULL RETURNING *
  `, [appId, id, userOf(req), text(b.rejection_reason)]);

  if (!row) return res.status(404).json({ error: 'Requested advance not found' });
  res.json({ ok: true, advance: row });
}));

hrAdvancesRouter.post('/hr/advances/:id/disburse', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.advance_manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const [row] = await q(client, `
      UPDATE school_advance SET status='disbursed', disbursed_by=$3, disbursed_at=now(), disbursement_mode=$4, disbursement_ref=$5, updated_at=now()
       WHERE app_id=$1 AND id=$2 AND status='approved' AND deleted_at IS NULL RETURNING *
    `, [appId, id, userOf(req), text(b.disbursement_mode) || 'bank', text(b.disbursement_ref)]);

    if (!row) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Approved advance not found' }); }

    // Ledger entry for disbursement
    await client.query(`
      INSERT INTO school_advance_ledger_entry (app_id, advance_id, date, type, amount, balance_after, reference_type, remarks, created_by)
      VALUES ($1,$2,$3,'disbursement',$4,$5,'manual',$6,$7)
    `, [appId, id, dayOf(b.disbursed_at) || new Date().toISOString().slice(0,10), n0(row.amount), n0(row.amount), `Disbursed via ${b.disbursement_mode || 'bank'}`, userOf(req)]);

    // Update to recovering status
    await client.query("UPDATE school_advance SET status='recovering', updated_at=now() WHERE app_id=$1 AND id=$2", [appId, id]);

    await client.query('COMMIT');
    res.json({ ok: true, advance: { ...row, status: 'recovering' } });
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
}));

/* ============================================================
   PREPAYMENT / EARLY CLOSURE
   ============================================================ */

hrAdvancesRouter.post('/hr/advances/:id/prepay', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.advance_manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const [advance] = await q(client, 'SELECT * FROM school_advance WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, id]);
    if (!advance) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Advance not found' }); }
    if (!['disbursed', 'recovering'].includes(advance.status)) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Advance must be disbursed or recovering for prepayment' }); }

    // Get all pending schedules
    const schedules = await q(client, `
      SELECT * FROM school_repayment_schedule
       WHERE app_id=$1 AND advance_id=$2 AND deleted_at IS NULL AND status IN ('pending','partially_recovered')
       ORDER BY installment_no
    `, [appId, id]);

    let totalOutstanding = 0;
    for (const sc of schedules) {
      const remaining = r2(n0(sc.total_amount) - n0(sc.recovered_amount));
      if (remaining <= 0) continue;
      totalOutstanding += remaining;
    }

    const prepayAmount = n0(b.amount) || totalOutstanding;
    if (prepayAmount > totalOutstanding + 0.01) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Prepayment amount exceeds outstanding' }); }

    // Mark schedules as recovered
    let remainingToRecover = prepayAmount;
    for (const sc of schedules) {
      if (remainingToRecover <= 0) break;
      const rem = r2(n0(sc.total_amount) - n0(sc.recovered_amount));
      const take = Math.min(rem, remainingToRecover);
      const newRecovered = r2(n0(sc.recovered_amount) + take);
      await client.query(`
        UPDATE school_repayment_schedule
           SET recovered_amount=$3, status=$4, recovered_in_run_id=$5, recovered_at=now(), updated_at=now()
         WHERE app_id=$1 AND id=$2
      `, [appId, sc.id, newRecovered, newRecovered >= n0(sc.total_amount) - 0.01 ? 'recovered' : 'partially_recovered', b.recovered_in_run_id || null]);
      remainingToRecover = r2(remainingToRecover - take);
    }

    // Ledger entry
    const [{ balance_after }] = await q(client, `
      SELECT COALESCE(SUM(total_amount - COALESCE(recovered_amount,0)),0) AS balance_after
        FROM school_repayment_schedule WHERE app_id=$1 AND advance_id=$2 AND deleted_at IS NULL
    `, [appId, id]);
    await client.query(`
      INSERT INTO school_advance_ledger_entry (app_id, advance_id, date, type, amount, balance_after, reference_type, remarks, created_by)
      VALUES ($1,$2,$3,'prepayment',$4,$5,'manual',$6,$7)
    `, [appId, id, dayOf(b.date) || new Date().toISOString().slice(0,10), r2(prepayAmount), r2(balance_after), b.remarks || 'Prepayment', userOf(req)]);

    // Close advance if fully recovered
    if (balance_after <= 0.01) {
      await client.query("UPDATE school_advance SET status='closed', closed_at=now(), closed_reason='Prepaid in full', updated_at=now() WHERE app_id=$1 AND id=$2", [appId, id]);
    } else {
      await client.query("UPDATE school_advance SET status='recovering', updated_at=now() WHERE app_id=$1 AND id=$2", [appId, id]);
    }

    await client.query('COMMIT');
    res.json({ ok: true, message: 'Prepayment processed', prepay_amount: r2(prepayAmount) });
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
}));

/* ============================================================
   WRITE-OFF
   ============================================================ */

hrAdvancesRouter.post('/hr/advances/:id/writeoff', route(async (req, res) => {
  if (!guardApprove(req)) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const [advance] = await q(client, 'SELECT * FROM school_advance WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, id]);
    if (!advance) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Advance not found' }); }
    if (!['recovering', 'disbursed'].includes(advance.status)) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Advance must be disbursed or recovering for write-off' }); }

    const [{ outstanding }] = await q(client, `
      SELECT COALESCE(SUM(total_amount - COALESCE(recovered_amount,0)),0) AS outstanding
        FROM school_repayment_schedule WHERE app_id=$1 AND advance_id=$2 AND deleted_at IS NULL
    `, [appId, id]);

    // Mark pending schedules as skipped
    await client.query(`
      UPDATE school_repayment_schedule SET status='skipped', updated_at=now()
       WHERE app_id=$1 AND advance_id=$2 AND deleted_at IS NULL AND status IN ('pending','partially_recovered')
    `, [appId, id]);

    // Ledger entry
    await client.query(`
      INSERT INTO school_advance_ledger_entry (app_id, advance_id, date, type, amount, balance_after, reference_type, remarks, created_by)
      VALUES ($1,$2,$3,'write_off',$4,0,'manual',$5,$6)
    `, [appId, id, dayOf(b.date) || new Date().toISOString().slice(0,10), r2(outstanding), b.remarks || 'Written off', userOf(req)]);

    const [row] = await q(client, `
      UPDATE school_advance SET status='written_off', closed_at=now(), closed_reason=$3, updated_at=now()
       WHERE app_id=$1 AND id=$2 RETURNING *
    `, [appId, id, text(b.reason) || 'Written off']);

    await client.query('COMMIT');
    res.json({ ok: true, advance: row, written_off_amount: r2(outstanding) });
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
}));

/* ============================================================
   AGING REPORT
   ============================================================ */

hrAdvancesRouter.get('/hr/advances/aging', route(async (req, res) => {
  if (!guardView(req, res, 'hr.advance_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);

  const rows = await execQ(pool, `
    SELECT a.id, a.staff_id, s.name AS staff_name, s.employee_code, a.type, a.amount,
           a.status, a.disbursed_at,
           COALESCE(SUM(rs.total_amount - COALESCE(rs.recovered_amount,0)) FILTER (WHERE rs.status IN ('pending','partially_recovered')),0) AS outstanding,
           MIN(rs.due_month) FILTER (WHERE rs.status IN ('pending','partially_recovered')) AS next_due
      FROM school_advance a
      JOIN school_staff s ON s.id=a.staff_id
      LEFT JOIN school_repayment_schedule rs ON rs.app_id=a.app_id AND rs.advance_id=a.id AND rs.deleted_at IS NULL
     WHERE a.app_id=$1 AND a.deleted_at IS NULL AND a.status IN ('disbursed','recovering')
     GROUP BY a.id, a.staff_id, s.name, s.employee_code, a.type, a.amount, a.status, a.disbursed_at
     ORDER BY outstanding DESC
  `, [appId]);

  const buckets = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  const now = new Date();
  for (const r of rows) {
    if (!r.next_due) { buckets['90+'] += n0(r.outstanding); continue; }
    const diff = Math.floor((now - new Date(r.next_due)) / 86400000);
    if (diff <= 0) buckets.current += n0(r.outstanding);
    else if (diff <= 30) buckets['1-30'] += n0(r.outstanding);
    else if (diff <= 60) buckets['31-60'] += n0(r.outstanding);
    else if (diff <= 90) buckets['61-90'] += n0(r.outstanding);
    else buckets['90+'] += n0(r.outstanding);
  }

  res.json({ ok: true, advances: rows, aging: buckets });
}));

/* Backwards-compatible POST delete alias */
hrAdvancesRouter.post('/hr/advances/:id/delete', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.advance_manage')) return;
  const pool = getPool();
  const [advance] = await execQ(pool, 'SELECT status FROM school_advance WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appIdOf(req), num(req.params.id)]);
  if (!advance) return res.status(404).json({ error: 'Advance not found' });
  if (!['requested', 'rejected', 'cancelled'].includes(advance.status)) return res.status(409).json({ error: 'Only requested/rejected advances can be deleted' });
  await execQ(pool, 'UPDATE school_advance SET deleted_at=now() WHERE app_id=$1 AND id=$2', [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true });
}));

export default hrAdvancesRouter;