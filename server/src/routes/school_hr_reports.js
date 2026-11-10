/* HR & Payroll — Reports Routes */
import express from 'express';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { ensureFoundation, loadAccess } from '../school/foundation.js';

const hrReportsRouter = express.Router();

hrReportsRouter.use(verifyToken);

hrReportsRouter.use(async (req, _res, next) => {
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
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('hr.view') || perms.includes('hr.reports')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

function guardManage(req, res, perm) {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('hr.manage') || perms.includes('hr.reports')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}
function toCsv(rows, cols) {
  const head = cols.map((c) => csvEscape(c.label)).join(',');
  const body = rows.map((row) => cols.map((c) => csvEscape(typeof c.value === 'function' ? c.value(row) : row[c.key])).join(','));
  return [head, ...body].join('\r\n');
}

/* ============================================================
   HR REPORTS (all with optional CSV export)
   ============================================================ */

hrReportsRouter.get('/hr/reports/staff-strength', route(async (req, res) => {
  if (!guardView(req, res, 'hr.reports')) return;
  const pool = getPool();
  const appId = appIdOf(req);

  const rows = await execQ(pool, `
    SELECT e.department, e.designation, e.type,
           COUNT(*)::int AS staff_count
      FROM school_staff s
      JOIN school_staff_employment e ON e.app_id=s.app_id AND e.staff_id=s.id AND e.deleted_at IS NULL
     WHERE s.app_id=$1 AND s.deleted_at IS NULL AND s.status='active'
       AND (e.effective_to IS NULL OR e.effective_to >= CURRENT_DATE)
       AND e.effective_from <= CURRENT_DATE
     GROUP BY e.department, e.designation, e.type
     ORDER BY e.department, e.designation
  `, [appId]);
  if (text(req.query.format) === 'csv') return res.setHeader('Content-Disposition', 'attachment; filename="staff-strength.csv"'), res.type('text/csv').send(toCsv(rows, [
    { key: 'department', label: 'Department' }, { key: 'designation', label: 'Designation' }, { key: 'type', label: 'Type' }, { key: 'staff_count', label: 'Count' }
  ]));
  res.json({ ok: true, data: rows });
}));

hrReportsRouter.get('/hr/reports/attrition', route(async (req, res) => {
  if (!guardView(req, res, 'hr.reports')) return;
  const pool = getPool();
  const appId = appIdOf(req);

  const rows = await execQ(pool, `
    SELECT DATE_TRUNC('month', e.exit_date)::date AS month,
           COUNT(*)::int AS exits,
           COUNT(*) FILTER (WHERE e.exit_reason = 'resignation')::int AS resignations,
           COUNT(*) FILTER (WHERE e.exit_reason = 'termination')::int AS terminations,
           COUNT(*) FILTER (WHERE e.exit_reason = 'retirement')::int AS retirements
      FROM school_staff_employment e
      JOIN school_staff s ON s.id = e.staff_id
     WHERE e.app_id=$1 AND e.deleted_at IS NULL AND e.exit_date IS NOT NULL
     GROUP BY DATE_TRUNC('month', e.exit_date)
     ORDER BY month DESC
     LIMIT 24
  `, [appId]);
  if (text(req.query.format) === 'csv') return res.setHeader('Content-Disposition', 'attachment; filename="attrition.csv"'), res.type('text/csv').send(toCsv(rows, [
    { key: 'month', label: 'Month' }, { key: 'exits', label: 'Exits' }, { key: 'resignations', label: 'Resignations' }, { key: 'terminations', label: 'Terminations' }, { key: 'retirements', label: 'Retirements' }
  ]));
  res.json({ ok: true, data: rows });
}));

hrReportsRouter.get('/hr/reports/leave-balances', route(async (req, res) => {
  if (!guardView(req, res, 'hr.reports')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const staffId = num(req.query.staff_id);
  const leaveTypeId = num(req.query.leave_type_id);

  let where = ['lbe.app_id=$1', 'lbe.deleted_at IS NULL'];
  const values = [appId];
  if (staffId) { values.push(staffId); where.push(`lbe.staff_id=$${values.length}`); }
  if (leaveTypeId) { values.push(leaveTypeId); where.push(`lbe.leave_type_id=$${values.length}`); }

  const balances = await execQ(pool, `
    SELECT lbe.staff_id, s.name AS staff_name, s.employee_code,
           lbe.leave_type_id, lt.name AS type_name, lt.code AS type_code,
           SUM(lbe.change) AS balance,
           SUM(lbe.change) FILTER (WHERE lbe.source='accrual') AS accrued,
           SUM(lbe.change) FILTER (WHERE lbe.source='usage') AS used,
           SUM(lbe.change) FILTER (WHERE lbe.source='adjustment') AS adjusted,
           SUM(lbe.change) FILTER (WHERE lbe.source='encashment') AS encashed,
           SUM(lbe.change) FILTER (WHERE lbe.source='carry_forward') AS carried_forward,
           SUM(lbe.change) FILTER (WHERE lbe.source='opening') AS opening
      FROM school_leave_balance_entry lbe
      JOIN school_leave_type lt ON lt.id=lbe.leave_type_id
      JOIN school_staff s ON s.id=lbe.staff_id
     WHERE ${where.join(' AND ')}
     GROUP BY lbe.staff_id, s.name, s.employee_code, lbe.leave_type_id, lt.name, lt.code, lt.sort_order
     ORDER BY lbe.staff_id, lt.sort_order
  `, values);
  if (text(req.query.format) === 'csv') return res.setHeader('Content-Disposition', 'attachment; filename="leave-balances.csv"'), res.type('text/csv').send(toCsv(balances, [
    { key: 'staff_id', label: 'Staff ID' }, { key: 'staff_name', label: 'Staff Name' }, { key: 'employee_code', label: 'Code' },
    { key: 'type_code', label: 'Leave Type' }, { key: 'type_name', label: 'Type Name' },
    { key: 'opening', label: 'Opening' }, { key: 'accrued', label: 'Accrued' }, { key: 'used', label: 'Used' },
    { key: 'adjusted', label: 'Adjusted' }, { key: 'encashed', label: 'Encashed' }, { key: 'carried_forward', label: 'Carried Fwd' },
    { key: 'balance', label: 'Balance' }
  ]));
  res.json({ ok: true, data: balances });
}));

hrReportsRouter.get('/hr/reports/leave-taken', route(async (req, res) => {
  if (!guardView(req, res, 'hr.reports')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const from = req.query.from || new Date(Date.now() - 365*86400000).toISOString().slice(0,10);
  const to = req.query.to || new Date().toISOString().slice(0,10);
  const staffId = num(req.query.staff_id);
  const leaveTypeId = num(req.query.leave_type_id);

  let where = ['la.app_id=$1', 'la.deleted_at IS NULL', 'la.from_date >= $2', 'la.to_date <= $3', "la.status IN ('approved','taken')"];
  const values = [appId, from, to];
  if (staffId) { values.push(staffId); where.push(`la.staff_id=$${values.length}`); }
  if (leaveTypeId) { values.push(leaveTypeId); where.push(`la.leave_type_id=$${values.length}`); }

  const rows = await execQ(pool, `
    SELECT s.name AS staff_name, s.employee_code, e.department,
           lt.name AS leave_type, lt.code AS type_code,
           la.from_date, la.to_date, la.days, la.half_day, la.status
      FROM school_leave_application la
      JOIN school_leave_type lt ON lt.id=la.leave_type_id
      JOIN school_staff s ON s.id=la.staff_id
      LEFT JOIN LATERAL (
        SELECT department FROM school_staff_employment e
         WHERE e.app_id=s.app_id AND e.staff_id=s.id AND e.deleted_at IS NULL
         ORDER BY e.effective_from DESC LIMIT 1
      ) e ON true
     WHERE ${where.join(' AND ')}
     ORDER BY la.from_date DESC
  `, values);
  if (text(req.query.format) === 'csv') return res.setHeader('Content-Disposition', 'attachment; filename="leave-taken.csv"'), res.type('text/csv').send(toCsv(rows, [
    { key: 'staff_name', label: 'Staff Name' }, { key: 'employee_code', label: 'Code' }, { key: 'department', label: 'Department' },
    { key: 'leave_type', label: 'Leave Type' }, { key: 'from_date', label: 'From' }, { key: 'to_date', label: 'To' },
    { key: 'days', label: 'Days' }, { key: 'half_day', label: 'Half Day' }, { key: 'status', label: 'Status' }
  ]));
  res.json({ ok: true, data: rows });
}));

hrReportsRouter.get('/hr/reports/absence-patterns', route(async (req, res) => {
  if (!guardView(req, res, 'hr.reports')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const from = req.query.from || new Date(Date.now() - 90*86400000).toISOString().slice(0,10);
  const to = req.query.to || new Date().toISOString().slice(0,10);
  const threshold = num(req.query.threshold) || 3;

  const rows = await execQ(pool, `
    SELECT s.id, s.name, s.employee_code, e.department,
           COUNT(*) FILTER (WHERE a.status='absent')::int AS absent_days,
           COUNT(*) FILTER (WHERE a.status='late')::int AS late_days,
           COUNT(*) FILTER (WHERE a.status='half_day')::int AS half_days,
           COUNT(*) FILTER (WHERE a.status IN ('absent','late','half_day'))::int AS incident_count
      FROM school_staff_attendance a
      JOIN school_hr_employees e_hr ON e_hr.id=a.employee_id
      JOIN school_staff s ON s.hr_employee_id=e_hr.id
      LEFT JOIN LATERAL (
        SELECT department FROM school_staff_employment e
         WHERE e.app_id=s.app_id AND e.staff_id=s.id AND e.deleted_at IS NULL
         ORDER BY e.effective_from DESC LIMIT 1
      ) e ON true
     WHERE a.app_id=$1 AND a.attendance_date BETWEEN $2 AND $3
       AND s.deleted_at IS NULL
     GROUP BY s.id, s.name, s.employee_code, e.department
     HAVING COUNT(*) FILTER (WHERE a.status IN ('absent','late','half_day')) >= $4
     ORDER BY incident_count DESC
  `, [appId, from, to, threshold]);
  if (text(req.query.format) === 'csv') return res.setHeader('Content-Disposition', 'attachment; filename="absence-patterns.csv"'), res.type('text/csv').send(toCsv(rows, [
    { key: 'name', label: 'Staff Name' }, { key: 'employee_code', label: 'Code' }, { key: 'department', label: 'Department' },
    { key: 'absent_days', label: 'Absent' }, { key: 'late_days', label: 'Late' }, { key: 'half_days', label: 'Half Day' }, { key: 'incident_count', label: 'Total Incidents' }
  ]));
  res.json({ ok: true, data: rows });
}));

hrReportsRouter.get('/hr/reports/salary-register', route(async (req, res) => {
  if (!guardView(req, res, 'hr.reports')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const runId = num(req.query.run_id);

  if (!runId) return res.status(400).json({ error: 'run_id is required' });

  const rows = await execQ(pool, `
    SELECT p.*, s.name AS staff_name, s.employee_code,
           e.designation, e.department
      FROM school_payslip p
      JOIN school_staff s ON s.id=p.staff_id
      LEFT JOIN LATERAL (
        SELECT designation, department FROM school_staff_employment e
         WHERE e.app_id=s.app_id AND e.staff_id=s.id AND e.deleted_at IS NULL
         ORDER BY e.effective_from DESC LIMIT 1
      ) e ON true
     WHERE p.app_id=$1 AND p.run_id=$2 AND p.deleted_at IS NULL
     ORDER BY s.employee_code
  `, [appId, runId]);
  if (text(req.query.format) === 'csv') return res.setHeader('Content-Disposition', 'attachment; filename="salary-register.csv"'), res.type('text/csv').send(toCsv(rows, [
    { key: 'employee_code', label: 'Employee Code' }, { key: 'staff_name', label: 'Name' }, { key: 'designation', label: 'Designation' },
    { key: 'department', label: 'Department' }, { key: 'paid_days', label: 'Paid Days' }, { key: 'lop_days', label: 'LOP Days' },
    { key: 'gross_earnings', label: 'Gross' }, { key: 'total_deductions', label: 'Deductions' }, { key: 'net_pay', label: 'Net Pay' }, { key: 'employer_contrib', label: 'Employer Contrib' }
  ]));
  res.json({ ok: true, data: rows });
}));

hrReportsRouter.get('/hr/reports/salary-abstract', route(async (req, res) => {
  if (!guardView(req, res, 'hr.reports')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const runId = num(req.query.run_id);

  if (!runId) return res.status(400).json({ error: 'run_id is required' });

  const [run] = await execQ(pool, 'SELECT * FROM school_payroll_run WHERE app_id=$1 AND id=$2', [appId, runId]);
  if (!run) return res.status(404).json({ error: 'Payroll run not found' });

  const summary = await execQ(pool, `
    SELECT COUNT(*)::int AS total_payslips,
           COALESCE(SUM(gross_earnings),0) AS total_gross,
           COALESCE(SUM(total_deductions),0) AS total_deductions,
           COALESCE(SUM(employer_contrib),0) AS total_employer_contrib,
           COALESCE(SUM(net_pay),0) AS total_net_pay
      FROM school_payslip
     WHERE app_id=$1 AND run_id=$2 AND deleted_at IS NULL
  `, [appId, runId]);

  const deptSummary = await execQ(pool, `
    SELECT e.department,
           COUNT(*)::int AS staff_count,
           COALESCE(SUM(p.gross_earnings),0) AS total_gross,
           COALESCE(SUM(p.net_pay),0) AS total_net
      FROM school_payslip p
      JOIN school_staff s ON s.id=p.staff_id
      LEFT JOIN LATERAL (
        SELECT department FROM school_staff_employment e
         WHERE e.app_id=s.app_id AND e.staff_id=s.id AND e.deleted_at IS NULL
         ORDER BY e.effective_from DESC LIMIT 1
      ) e ON true
     WHERE p.app_id=$1 AND p.run_id=$2 AND p.deleted_at IS NULL
     GROUP BY e.department
  `, [appId, runId]);

  const compSummary = await execQ(pool, `
    SELECT pl.component_code, pl.component_name, pl.component_type,
           COALESCE(SUM(pl.amount),0) AS total_amount
      FROM school_payslip_line pl
      JOIN school_payslip p ON p.id=pl.payslip_id
     WHERE pl.app_id=$1 AND p.run_id=$2 AND p.deleted_at IS NULL
     GROUP BY pl.component_code, pl.component_name, pl.component_type
     ORDER BY pl.component_type, pl.component_code
  `, [appId, runId]);

  res.json({ ok: true, run, summary: summary[0], deptSummary, compSummary });
}));

hrReportsRouter.get('/hr/reports/dept-cost', route(async (req, res) => {
  if (!guardView(req, res, 'hr.reports')) return;
  const pool = getPool();
  const appId = appIdOf(req);

  const rows = await execQ(pool, `
    SELECT e.department,
           COUNT(*)::int AS staff_count,
           COALESCE(SUM(p.gross_earnings),0) AS total_gross,
           COALESCE(SUM(p.total_deductions),0) AS total_deductions,
           COALESCE(SUM(p.employer_contrib),0) AS employer_contrib,
           COALESCE(SUM(p.net_pay),0) AS net_pay
      FROM school_payslip p
      JOIN school_staff s ON s.id=p.staff_id
      LEFT JOIN LATERAL (
        SELECT department FROM school_staff_employment e
         WHERE e.app_id=s.app_id AND e.staff_id=s.id AND e.deleted_at IS NULL
         ORDER BY e.effective_from DESC LIMIT 1
      ) e ON true
     WHERE p.app_id=$1 AND p.deleted_at IS NULL
     GROUP BY e.department
     ORDER BY total_gross DESC
  `, [appId]);
  if (text(req.query.format) === 'csv') return res.setHeader('Content-Disposition', 'attachment; filename="dept-cost.csv"'), res.type('text/csv').send(toCsv(rows, [
    { key: 'department', label: 'Department' }, { key: 'staff_count', label: 'Staff' }, { key: 'total_gross', label: 'Gross' },
    { key: 'total_deductions', label: 'Deductions' }, { key: 'employer_contrib', label: 'Employer' }, { key: 'net_pay', label: 'Net' }
  ]));
  res.json({ ok: true, data: rows });
}));

hrReportsRouter.get('/hr/reports/month-variance', route(async (req, res) => {
  if (!guardView(req, res, 'hr.reports')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const runId = num(req.query.run_id);
  const prevRunId = num(req.query.prev_run_id);

  if (!runId || !prevRunId) return res.status(400).json({ error: 'run_id and prev_run_id are required' });

  const rows = await execQ(pool, `
    SELECT p.staff_id, s.name, s.employee_code,
           p.gross_earnings AS current_gross, p.total_deductions AS current_deductions, p.net_pay AS current_net,
           pp.gross_earnings AS prev_gross, pp.total_deductions AS prev_deductions, pp.net_pay AS prev_net,
           (p.gross_earnings - pp.gross_earnings) AS gross_variance,
           (p.net_pay - pp.net_pay) AS net_variance,
           CASE WHEN pp.gross_earnings > 0 THEN ROUND(((p.gross_earnings - pp.gross_earnings) / pp.gross_earnings) * 100, 2) ELSE 0 END AS gross_pct_change,
           CASE WHEN pp.net_pay > 0 THEN ROUND(((p.net_pay - pp.net_pay) / pp.net_pay) * 100, 2) ELSE 0 END AS net_pct_change
      FROM school_payslip p
      JOIN school_payslip pp ON pp.app_id=p.app_id AND pp.staff_id=p.staff_id AND pp.run_id=$3
      JOIN school_staff s ON s.id=p.staff_id
     WHERE p.app_id=$1 AND p.run_id=$2 AND p.deleted_at IS NULL AND pp.deleted_at IS NULL
  `, [appId, runId, prevRunId]);
  if (text(req.query.format) === 'csv') return res.setHeader('Content-Disposition', 'attachment; filename="month-variance.csv"'), res.type('text/csv').send(toCsv(rows, [
    { key: 'employee_code', label: 'Code' }, { key: 'name', label: 'Name' },
    { key: 'current_gross', label: 'Current Gross' }, { key: 'prev_gross', label: 'Prev Gross' }, { key: 'gross_variance', label: 'Gross Var' }, { key: 'gross_pct_change', label: 'Gross %' },
    { key: 'current_net', label: 'Current Net' }, { key: 'prev_net', label: 'Prev Net' }, { key: 'net_variance', label: 'Net Var' }, { key: 'net_pct_change', label: 'Net %' }
  ]));
  res.json({ ok: true, data: rows });
}));

hrReportsRouter.get('/hr/reports/arrears', route(async (req, res) => {
  if (!guardView(req, res, 'hr.reports')) return;
  const pool = getPool();
  const appId = appIdOf(req);

  const rows = await execQ(pool, `
    SELECT a.*, s.name AS staff_name, s.employee_code
      FROM school_payroll_adjustment a
      JOIN school_staff s ON s.id=a.staff_id
     WHERE a.app_id=$1 AND a.deleted_at IS NULL AND a.type='arrears'
     ORDER BY a.period_start DESC, a.created_at DESC
  `, [appId]);
  if (text(req.query.format) === 'csv') return res.setHeader('Content-Disposition', 'attachment; filename="arrears.csv"'), res.type('text/csv').send(toCsv(rows, [
    { key: 'staff_name', label: 'Staff Name' }, { key: 'employee_code', label: 'Code' }, { key: 'period_start', label: 'Period Start' },
    { key: 'period_end', label: 'Period End' }, { key: 'component_id', label: 'Component ID' }, { key: 'amount', label: 'Amount' },
    { key: 'reason', label: 'Reason' }, { key: 'status', label: 'Status' }
  ]));
  res.json({ ok: true, data: rows });
}));

hrReportsRouter.get('/hr/reports/advances-outstanding', route(async (req, res) => {
  if (!guardView(req, res, 'hr.reports')) return;
  const pool = getPool();
  const appId = appIdOf(req);

  const rows = await execQ(pool, `
    SELECT a.*, s.name AS staff_name, s.employee_code,
           COALESCE(SUM(rs.total_amount) FILTER (WHERE rs.status IN ('pending','partially_recovered')), 0) AS outstanding
      FROM school_advance a
      JOIN school_staff s ON s.id=a.staff_id
      LEFT JOIN school_repayment_schedule rs ON rs.app_id=a.app_id AND rs.advance_id=a.id AND rs.deleted_at IS NULL
     WHERE a.app_id=$1 AND a.deleted_at IS NULL AND a.status IN ('disbursed','recovering')
     GROUP BY a.id, s.name, s.employee_code
     ORDER BY outstanding DESC
  `, [appId]);
  if (text(req.query.format) === 'csv') return res.setHeader('Content-Disposition', 'attachment; filename="advances-outstanding.csv"'), res.type('text/csv').send(toCsv(rows, [
    { key: 'staff_name', label: 'Staff Name' }, { key: 'employee_code', label: 'Code' }, { key: 'type', label: 'Type' },
    { key: 'amount', label: 'Amount' }, { key: 'installments', label: 'Installments' }, { key: 'status', label: 'Status' },
    { key: 'outstanding', label: 'Outstanding' }
  ]));
  res.json({ ok: true, data: rows });
}));

hrReportsRouter.get('/hr/reports/advances-aging', route(async (req, res) => {
  if (!guardView(req, res, 'hr.reports')) return;
  const pool = getPool();
  const appId = appIdOf(req);

  const rows = await execQ(pool, `
    SELECT a.id, s.name AS staff_name, s.employee_code, a.type, a.amount, a.disbursed_at,
           COALESCE(SUM(rs.total_amount - COALESCE(rs.recovered_amount,0)) FILTER (WHERE rs.status IN ('pending','partially_recovered')),0) AS outstanding,
           MIN(rs.due_month) FILTER (WHERE rs.status IN ('pending','partially_recovered')) AS next_due
      FROM school_advance a
      JOIN school_staff s ON s.id=a.staff_id
      LEFT JOIN school_repayment_schedule rs ON rs.app_id=a.app_id AND rs.advance_id=a.id AND rs.deleted_at IS NULL
     WHERE a.app_id=$1 AND a.deleted_at IS NULL AND a.status IN ('disbursed','recovering')
     GROUP BY a.id, s.name, s.employee_code, a.type, a.amount, a.disbursed_at
  `, [appId]);

  const now = new Date();
  const buckets = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  for (const r of rows) {
    if (!r.next_due) { buckets['90+'] += n0(r.outstanding); continue; }
    const diff = Math.floor((now - new Date(r.next_due)) / 86400000);
    if (diff <= 0) buckets.current += n0(r.outstanding);
    else if (diff <= 30) buckets['1-30'] += n0(r.outstanding);
    else if (diff <= 60) buckets['31-60'] += n0(r.outstanding);
    else if (diff <= 90) buckets['61-90'] += n0(r.outstanding);
    else buckets['90+'] += n0(r.outstanding);
  }

  if (text(req.query.format) === 'csv') return res.setHeader('Content-Disposition', 'attachment; filename="advances-aging.csv"'), res.type('text/csv').send(toCsv(rows, [
    { key: 'staff_name', label: 'Staff Name' }, { key: 'employee_code', label: 'Code' }, { key: 'type', label: 'Type' },
    { key: 'amount', label: 'Amount' }, { key: 'disbursed_at', label: 'Disbursed' }, { key: 'outstanding', label: 'Outstanding' },
    { key: 'next_due', label: 'Next Due' }
  ]));
  res.json({ ok: true, data: rows, aging: buckets });
}));

hrReportsRouter.get('/hr/reports/statutory-registers', route(async (req, res) => {
  if (!guardView(req, res, 'hr.statutory_reports')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const period = req.query.period || new Date().toISOString().slice(0,7);

  const pfRule = await execQ(pool, "SELECT config FROM school_statutory_rule WHERE app_id=$1 AND rule_code='PF' AND deleted_at IS NULL AND is_active=true ORDER BY version DESC LIMIT 1", [appId]);
  const pfCfg = pfRule[0]?.config || { wage_ceiling: 15000, employee_rate: 12, employer_rate: 12, wage_base_components: ['BASIC','DA'] };
  const pfCeiling = n0(pfCfg.wage_ceiling) || 15000;

  const pf = await execQ(pool, `
    SELECT s.employee_code, s.name, p.gross_earnings,
           COALESCE(SUM(pl.amount) FILTER (WHERE pl.component_code='PF_EMP'),0) AS pf_employee,
           COALESCE(SUM(pl.amount) FILTER (WHERE pl.component_code='PF_EMPR'),0) AS pf_employer,
           pl_calc.calculation_details AS pf_basis
      FROM school_payslip p
      JOIN school_staff s ON s.id=p.staff_id
      JOIN school_payroll_run r ON r.id=p.run_id
      LEFT JOIN school_payslip_line pl ON pl.payslip_id=p.id AND pl.component_code IN ('PF_EMP','PF_EMPR')
      LEFT JOIN LATERAL (
        SELECT calculation_details FROM school_payslip_line WHERE payslip_id=p.id AND component_code='PF_EMP' LIMIT 1
      ) pl_calc ON true
     WHERE p.app_id=$1 AND r.period_name=$2 AND p.deleted_at IS NULL
     GROUP BY s.employee_code, s.name, p.gross_earnings, pl_calc.calculation_details
  `, [appId, period]);

  const esiRule = await execQ(pool, "SELECT config FROM school_statutory_rule WHERE app_id=$1 AND rule_code='ESI' AND deleted_at IS NULL AND is_active=true ORDER BY version DESC LIMIT 1", [appId]);
  const esiCfg = esiRule[0]?.config || { wage_ceiling: 21000, employee_rate: 0.75, employer_rate: 3.25, wage_base_components: ['BASIC','DA','HRA'] };
  const esiThreshold = n0(esiCfg.eligibility_threshold) || n0(esiCfg.wage_ceiling) || 21000;

  const esi = await execQ(pool, `
    SELECT s.employee_code, s.name, p.gross_earnings,
           COALESCE(SUM(pl.amount) FILTER (WHERE pl.component_code='ESI_EMP'),0) AS esi_employee,
           COALESCE(SUM(pl.amount) FILTER (WHERE pl.component_code='ESI_EMPR'),0) AS esi_employer
      FROM school_payslip p
      JOIN school_staff s ON s.id=p.staff_id
      JOIN school_payroll_run r ON r.id=p.run_id
      LEFT JOIN school_payslip_line pl ON pl.payslip_id=p.id AND pl.component_code IN ('ESI_EMP','ESI_EMPR')
     WHERE p.app_id=$1 AND r.period_name=$2 AND p.deleted_at IS NULL
     GROUP BY s.employee_code, s.name, p.gross_earnings
  `, [appId, period]);

  const ptRule = await execQ(pool, "SELECT config FROM school_statutory_rule WHERE app_id=$1 AND rule_code='PT' AND deleted_at IS NULL AND is_active=true ORDER BY version DESC LIMIT 1", [appId]);
  const ptCfg = ptRule[0]?.config || { state: 'MH' };

  const pt = await execQ(pool, `
    SELECT s.employee_code, s.name, p.gross_earnings,
           COALESCE(SUM(pl.amount) FILTER (WHERE pl.component_code='PT'),0) AS pt
      FROM school_payslip p
      JOIN school_staff s ON s.id=p.staff_id
      JOIN school_payroll_run r ON r.id=p.run_id
      LEFT JOIN school_payslip_line pl ON pl.payslip_id=p.id AND pl.component_code='PT'
     WHERE p.app_id=$1 AND r.period_name=$2 AND p.deleted_at IS NULL
     GROUP BY s.employee_code, s.name, p.gross_earnings
  `, [appId, period]);

  const tds = await execQ(pool, `
    SELECT s.employee_code, s.name, p.gross_earnings,
           COALESCE(SUM(pl.amount) FILTER (WHERE pl.component_code='TDS'),0) AS tds
      FROM school_payslip p
      JOIN school_staff s ON s.id=p.staff_id
      JOIN school_payroll_run r ON r.id=p.run_id
      LEFT JOIN school_payslip_line pl ON pl.payslip_id=p.id AND pl.component_code='TDS'
     WHERE p.app_id=$1 AND r.period_name=$2 AND p.deleted_at IS NULL
     GROUP BY s.employee_code, s.name, p.gross_earnings
  `, [appId, period]);

  res.json({ ok: true, period, pf, esi, pt, tds });
}));

hrReportsRouter.get('/hr/reports/form16', route(async (req, res) => {
  if (!guardView(req, res, 'hr.form16')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const financialYear = req.query.financial_year || '2026-27';

  const fyStart = `${financialYear.slice(0,4)}-04`;
  const fyEnd = `${Number(financialYear.slice(5,7)) + 1}-03`;

  const rows = await execQ(pool, `
    SELECT s.name, s.employee_code, st.pan,
           COALESCE(SUM(p.gross_earnings) FILTER (WHERE r.period_name BETWEEN $2 AND $3), 0) AS total_gross,
           COALESCE(SUM(pl.amount) FILTER (WHERE pl.component_code='TDS' AND r.period_name BETWEEN $2 AND $3), 0) AS total_tds
      FROM school_payslip p
      JOIN school_staff s ON s.id=p.staff_id
      JOIN school_payroll_run r ON r.id=p.run_id
      LEFT JOIN school_staff_statutory st ON st.app_id=s.app_id AND st.staff_id=s.id
      LEFT JOIN school_payslip_line pl ON pl.payslip_id=p.id
     WHERE p.app_id=$1 AND p.deleted_at IS NULL
       AND r.period_name BETWEEN $2 AND $3
     GROUP BY s.id, s.name, s.employee_code, st.pan
     HAVING COALESCE(SUM(p.gross_earnings) FILTER (WHERE r.period_name BETWEEN $2 AND $3), 0) > 0
  `, [appId, fyStart, fyEnd]);
  if (text(req.query.format) === 'csv') return res.setHeader('Content-Disposition', 'attachment; filename="form16.csv"'), res.type('text/csv').send(toCsv(rows, [
    { key: 'employee_code', label: 'Employee Code' }, { key: 'name', label: 'Name' }, { key: 'pan', label: 'PAN' },
    { key: 'total_gross', label: 'Total Gross' }, { key: 'total_tds', label: 'Total TDS' }
  ]));
  res.json({ ok: true, financialYear, data: rows });
}));

hrReportsRouter.get('/hr/reports/gratuity-liability', route(async (req, res) => {
  if (!guardView(req, res, 'hr.reports')) return;
  const pool = getPool();
  const appId = appIdOf(req);

  const rows = await execQ(pool, `
    SELECT s.name, s.employee_code, e.designation, e.joining_date,
           CURRENT_DATE - e.joining_date AS days_of_service,
           FLOOR((CURRENT_DATE - e.joining_date) / 365.25) AS years_of_service,
           CASE WHEN FLOOR((CURRENT_DATE - e.joining_date) / 365.25) >= 5 THEN 'Eligible' ELSE 'Not Eligible' END AS eligibility
      FROM school_staff s
      JOIN school_staff_employment e ON e.app_id=s.app_id AND e.staff_id=s.id AND e.deleted_at IS NULL
     WHERE s.app_id=$1 AND s.deleted_at IS NULL AND s.status='active'
       AND (e.effective_to IS NULL OR e.effective_to >= CURRENT_DATE)
       AND e.effective_from <= CURRENT_DATE
     ORDER BY years_of_service DESC
  `, [appId]);
  if (text(req.query.format) === 'csv') return res.setHeader('Content-Disposition', 'attachment; filename="gratuity-liability.csv"'), res.type('text/csv').send(toCsv(rows, [
    { key: 'name', label: 'Name' }, { key: 'employee_code', label: 'Code' }, { key: 'designation', label: 'Designation' },
    { key: 'joining_date', label: 'Joining Date' }, { key: 'years_of_service', label: 'Years' }, { key: 'eligibility', label: 'Eligibility' }
  ]));
  res.json({ ok: true, data: rows });
}));

hrReportsRouter.get('/hr/reports/overtime', route(async (req, res) => {
  if (!guardView(req, res, 'hr.reports')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const runId = num(req.query.run_id);

  if (!runId) return res.status(400).json({ error: 'run_id is required' });

  const rows = await execQ(pool, `
    SELECT s.name, s.employee_code, e.department,
           pl.amount AS overtime_amount, pl.calculation_details
      FROM school_payslip_line pl
      JOIN school_payslip p ON p.id=pl.payslip_id
      JOIN school_staff s ON s.id=p.staff_id
      LEFT JOIN LATERAL (
        SELECT department FROM school_staff_employment e
         WHERE e.app_id=s.app_id AND e.staff_id=s.id AND e.deleted_at IS NULL
         ORDER BY e.effective_from DESC LIMIT 1
      ) e ON true
      JOIN school_salary_component c ON c.id=pl.component_id
     WHERE pl.app_id=$1 AND p.run_id=$2 AND p.deleted_at IS NULL
       AND c.type='earning' AND c.is_variable=true
     ORDER BY s.employee_code
  `, [appId, runId]);
  if (text(req.query.format) === 'csv') return res.setHeader('Content-Disposition', 'attachment; filename="overtime.csv"'), res.type('text/csv').send(toCsv(rows, [
    { key: 'name', label: 'Name' }, { key: 'employee_code', label: 'Code' }, { key: 'department', label: 'Department' },
    { key: 'overtime_amount', label: 'Overtime' }, { key: 'calculation_details', label: 'Details' }
  ]));
  res.json({ ok: true, data: rows });
}));

hrReportsRouter.get('/hr/reports/substitution-impact', route(async (req, res) => {
  if (!guardView(req, res, 'hr.reports')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const from = req.query.from || new Date(Date.now() - 30*86400000).toISOString().slice(0,10);
  const to = req.query.to || new Date().toISOString().slice(0,10);

  const rows = await execQ(pool, `
    SELECT s.name AS teacher_name, s.employee_code,
           COUNT(*) AS substitution_count,
           SUM(CASE WHEN sub.status='completed' THEN 1 ELSE 0 END) AS completed_count
      FROM school_substitutions sub
      JOIN school_staff s ON s.id = sub.substitute_teacher_id::int
     WHERE sub.app_id=$1
       AND sub.sub_date BETWEEN $2 AND $3
       AND sub.substitute_teacher_id ~ '^\d+$'
     GROUP BY s.id, s.name, s.employee_code
     ORDER BY substitution_count DESC
  `, [appId, from, to]);
  if (text(req.query.format) === 'csv') return res.setHeader('Content-Disposition', 'attachment; filename="substitution-impact.csv"'), res.type('text/csv').send(toCsv(rows, [
    { key: 'teacher_name', label: 'Substitute Teacher' }, { key: 'employee_code', label: 'Code' },
    { key: 'substitution_count', label: 'Total Substitutions' }, { key: 'completed_count', label: 'Completed' }
  ]));
  res.json({ ok: true, data: rows });
}));

hrReportsRouter.get('/hr/reports/salary-audit', route(async (req, res) => {
  if (!guardView(req, res, 'hr.audit')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const from = req.query.from || new Date(Date.now() - 30*86400000).toISOString().slice(0,10);
  const to = req.query.to || new Date().toISOString().slice(0,10);

  const rows = await execQ(pool, `
    SELECT al.*, s.name AS staff_name, s.employee_code
      FROM school_audit_log al
      JOIN school_staff s ON s.id = al.entity_id::int
     WHERE al.app_id=$1 AND al.entity IN ('school_staff_salary','school_payroll_run','school_payslip','school_salary_structure','school_salary_component')
       AND al.created_at BETWEEN $2 AND $3
     ORDER BY al.created_at DESC
     LIMIT 500
  `, [appId, from, to]);
  if (text(req.query.format) === 'csv') return res.setHeader('Content-Disposition', 'attachment; filename="salary-audit.csv"'), res.type('text/csv').send(toCsv(rows, [
    { key: 'created_at', label: 'Timestamp' }, { key: 'user_id', label: 'User' }, { key: 'action', label: 'Action' },
    { key: 'entity', label: 'Entity' }, { key: 'entity_id', label: 'Entity ID' },
    { key: 'staff_name', label: 'Staff Name' }, { key: 'employee_code', label: 'Code' }
  ]));
  res.json({ ok: true, data: rows });
}));

hrReportsRouter.get('/hr/reports/unlock-audit', route(async (req, res) => {
  if (!guardView(req, res, 'hr.audit')) return;
  const pool = getPool();
  const appId = appIdOf(req);

  const rows = await execQ(pool, `
    SELECT al.*, COALESCE(u."UserName", al.user_id) AS unlocked_by
      FROM school_audit_log al
      LEFT JOIN "tblHO_User" u ON u."UserId" = al.user_id
     WHERE al.app_id=$1 AND al.entity='school_payroll_run' AND al.action='unlock'
     ORDER BY al.created_at DESC
     LIMIT 100
  `, [appId]);
  if (text(req.query.format) === 'csv') return res.setHeader('Content-Disposition', 'attachment; filename="unlock-audit.csv"'), res.type('text/csv').send(toCsv(rows, [
    { key: 'created_at', label: 'Timestamp' }, { key: 'user_id', label: 'User ID' }, { key: 'unlocked_by', label: 'Unlocked By' },
    { key: 'entity_id', label: 'Run ID' }, { key: 'before_json', label: 'Before' }, { key: 'after_json', label: 'After' }
  ]));
  res.json({ ok: true, data: rows });
}));

hrReportsRouter.get('/hr/reports/doc-expiry', route(async (req, res) => {
  if (!guardView(req, res, 'hr.reports')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const withinDays = num(req.query.days) || 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + withinDays);

  const rows = await execQ(pool, `
    SELECT s.name, s.employee_code, e.department, d.type, d.expiry_date,
           d.expiry_date - CURRENT_DATE AS days_until_expiry
      FROM school_staff_document d
      JOIN school_staff s ON s.id=d.staff_id
      LEFT JOIN LATERAL (
        SELECT department FROM school_staff_employment e
         WHERE e.app_id=s.app_id AND e.staff_id=s.id AND e.deleted_at IS NULL
         ORDER BY e.effective_from DESC LIMIT 1
      ) e ON true
     WHERE d.app_id=$1 AND d.deleted_at IS NULL AND d.expiry_date IS NOT NULL
       AND d.expiry_date <= $2
     ORDER BY d.expiry_date
  `, [appId, cutoff.toISOString().slice(0,10)]);
  if (text(req.query.format) === 'csv') return res.setHeader('Content-Disposition', 'attachment; filename="doc-expiry.csv"'), res.type('text/csv').send(toCsv(rows, [
    { key: 'name', label: 'Staff Name' }, { key: 'employee_code', label: 'Code' }, { key: 'department', label: 'Department' },
    { key: 'type', label: 'Document Type' }, { key: 'expiry_date', label: 'Expiry Date' }, { key: 'days_until_expiry', label: 'Days Until Expiry' }
  ]));
  res.json({ ok: true, data: rows });
}));

hrReportsRouter.get('/hr/reports/bank-advice', route(async (req, res) => {
  if (!guardView(req, res, 'hr.reports')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const runId = num(req.query.run_id);
  if (!runId) return res.status(400).json({ error: 'run_id is required' });

  const [run] = await execQ(pool, 'SELECT * FROM school_payroll_run WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, runId]);
  if (!run) return res.status(404).json({ error: 'Payroll run not found' });

  const rows = await execQ(pool, `
    SELECT s.employee_code, s.name AS staff_name, b.bank_name, b.account_number, b.ifsc_code, b.account_holder_name,
           p.net_pay
      FROM school_payslip p
      JOIN school_staff s ON s.id=p.staff_id
      LEFT JOIN school_staff_bank b ON b.app_id=p.app_id AND b.staff_id=p.staff_id AND b.deleted_at IS NULL AND b.is_primary=true
     WHERE p.app_id=$1 AND p.run_id=$2 AND p.deleted_at IS NULL
     ORDER BY s.employee_code
  `, [appId, runId]);

  if (text(req.query.format) === 'csv') return res.setHeader('Content-Disposition', `attachment; filename="bank-advice-${run.period_name}.csv"`), res.type('text/csv').send(toCsv(rows, [
    { key: 'employee_code', label: 'Employee Code' }, { key: 'staff_name', label: 'Beneficiary' }, { key: 'account_holder_name', label: 'Account Holder' },
    { key: 'bank_name', label: 'Bank' }, { key: 'account_number', label: 'Account Number' }, { key: 'ifsc_code', label: 'IFSC' }, { key: 'net_pay', label: 'Amount' }
  ]));
  const total = rows.reduce((a, r) => a + n0(r.net_pay), 0);
  res.json({ ok: true, run, rows, total: r2(total), missing_bank: rows.filter((r) => !r.account_number).length });
}));

export default hrReportsRouter;