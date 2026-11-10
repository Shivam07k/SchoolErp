/* HR & Payroll — Payroll Run Routes */
import express from 'express';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { ensureFoundation, loadAccess } from '../school/foundation.js';

const hrPayrollRunRouter = express.Router();

hrPayrollRunRouter.use(verifyToken);

hrPayrollRunRouter.use(async (req, _res, next) => {
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
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('hr.payroll_view') || perms.includes('hr.payroll_manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

function guardManage(req, res, perm) {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('hr.payroll_manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const q = (client, sql, values = []) => client.query({ text: sql, values }).then((r) => r.rows);

function daysBetween(a, b) {
  const s = new Date(`${String(a).slice(0, 10)}T00:00:00Z`).getTime();
  const e = new Date(`${String(b).slice(0, 10)}T00:00:00Z`).getTime();
  return Math.floor((e - s) / 86400000) + 1;
}

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

async function getSetting(pool, appId, key, fallback) {
  const rows = await execQ(pool, 'SELECT value FROM school_hr_setting WHERE key=$1 AND app_id IN ($2, \'default\') ORDER BY (app_id=$2) DESC LIMIT 1', [key, appId]);
  if (!rows[0]) return fallback;
  return rows[0].value;
}

async function ensureComponent(client, appId, def) {
  const existing = await q(client, 'SELECT id FROM school_salary_component WHERE app_id=$1 AND code=$2 AND deleted_at IS NULL', [appId, def.code]);
  if (existing[0]) return existing[0].id;
  const inserted = await q(client, `
    INSERT INTO school_salary_component (app_id, name, code, type, calculation, is_taxable, is_wage_base, is_proratable, is_variable, sort_order)
    VALUES ($1,$2,$3,$4,'fixed',false,false,false,false,$5) RETURNING id
  `, [appId, def.name, def.code, def.type, def.sort_order || 90]);
  return inserted[0].id;
}

function evalFormula(formula, ctx) {
  if (!formula) return 0;
  try {
    const keys = Object.keys(ctx);
    // eslint-disable-next-line no-new-func
    const fn = new Function(...keys, `"use strict"; return (${formula});`);
    const out = fn(...keys.map((k) => ctx[k]));
    return Number.isFinite(Number(out)) ? Number(out) : 0;
  } catch {
    return 0;
  }
}

function activeRule(rules, code, onDate) {
  const d = dayOf(onDate);
  return rules.find((r) => r.rule_code === code && dayOf(r.effective_from) <= d && (!r.effective_to || dayOf(r.effective_to) >= d)) || null;
}

function slabTax(config, gross) {
  const slabs = Array.isArray(config?.slabs) ? config.slabs : null;
  if (slabs && slabs.length) {
    const slab = slabs.find((s) => gross >= n0(s.min) && gross <= n0(s.max === undefined ? 1e15 : s.max));
    if (slab) return r2(n0(slab.monthly ?? slab.fixed_amount) + (n0(slab.rate) / 100) * Math.max(0, gross - n0(slab.min)));
    return 0;
  }
  return 0;
}

function tdsMonthly(annualGross, regime, decl) {
  const std = regime === 'new' ? 75000 : 50000;
  let taxable = annualGross - std;
  if (regime === 'old') {
    if (decl) {
      taxable -= Math.min(n0(decl.section_80c), 150000);
      taxable -= n0(decl.section_80d);
      taxable -= Math.min(n0(decl.section_80ccd1b), 50000);
      taxable -= n0(decl.section_24b);
      taxable -= n0(decl.professional_tax);
    }
  }
  taxable = Math.max(0, taxable);
  let tax = 0;
  if (regime === 'new') {
    const slabs = [[300000, 0], [700000, 0.05], [1000000, 0.10], [1200000, 0.15], [1500000, 0.20], [Infinity, 0.30]];
    let prev = 0;
    for (const [cap, rate] of slabs) { if (taxable > prev) tax += (Math.min(taxable, cap) - prev) * rate; prev = cap; }
    if (taxable <= 700000) tax = 0;
  } else {
    const slabs = [[250000, 0], [500000, 0.05], [1000000, 0.20], [Infinity, 0.30]];
    let prev = 0;
    for (const [cap, rate] of slabs) { if (taxable > prev) tax += (Math.min(taxable, cap) - prev) * rate; prev = cap; }
    if (taxable <= 500000) tax = 0;
  }
  tax *= 1.04; // health & education cess
  return r2(tax / 12);
}

/* ============================================================
   PAYROLL RUNS
   ============================================================ */

hrPayrollRunRouter.get('/hr/payroll/runs', route(async (req, res) => {
  if (!guardView(req, res, 'hr.payroll_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const status = text(req.query.status);
  const values = [appId];
  let where = 'app_id=$1 AND deleted_at IS NULL';
  if (status) { values.push(status); where += ` AND status=$${values.length}`; }
  const rows = await execQ(pool, `SELECT * FROM school_payroll_run WHERE ${where} ORDER BY period_start DESC`, values);
  res.json({ ok: true, runs: rows });
}));

hrPayrollRunRouter.post('/hr/payroll/runs', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.payroll_manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};

  const periodStart = dayOf(b.period_start);
  const periodEnd = dayOf(b.period_end);
  if (!periodStart || !periodEnd) return res.status(400).json({ error: 'period_start and period_end are required' });
  if (new Date(periodStart) > new Date(periodEnd)) return res.status(400).json({ error: 'period_start must be before period_end' });

  const periodName = text(b.period_name) || periodStart.slice(0, 7);
  const basisDays = num(b.basis_days) || daysBetween(periodStart, periodEnd);

  let wageBaseDays = num(b.wage_base_days);
  if (!wageBaseDays) {
    const mode = await getSetting(pool, appId, 'salary_day_basis', 'calendar');
    if (mode === 'thirty') wageBaseDays = 30;
    else if (mode === 'working') {
      let c = 0;
      for (let t = new Date(`${periodStart}T00:00:00Z`).getTime(); t <= new Date(`${periodEnd}T00:00:00Z`).getTime(); t += 86400000) {
        const day = new Date(t).getUTCDay();
        if (day !== 0 && day !== 6) c++;
      }
      wageBaseDays = c || basisDays;
    } else wageBaseDays = basisDays;
  }

  const existing = await execQ(pool, 'SELECT id FROM school_payroll_run WHERE app_id=$1 AND period_start=$2 AND period_end=$3 AND deleted_at IS NULL', [appId, periodStart, periodEnd]);
  if (existing[0]) return res.status(409).json({ error: 'A payroll run already exists for this period' });

  const [row] = await execQ(pool, `
    INSERT INTO school_payroll_run (app_id, period_start, period_end, period_name, status, basis_days, wage_base_days, run_by)
    VALUES ($1,$2,$3,$4,'draft',$5,$6,$7) RETURNING *
  `, [appId, periodStart, periodEnd, periodName, basisDays, wageBaseDays, userOf(req)]);

  res.json({ ok: true, run: row });
}));

hrPayrollRunRouter.get('/hr/payroll/runs/:id', route(async (req, res) => {
  if (!guardView(req, res, 'hr.payroll_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [run] = await execQ(pool, 'SELECT * FROM school_payroll_run WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, id]);
  if (!run) return res.status(404).json({ error: 'Payroll run not found' });

  const payslips = await execQ(pool, `
    SELECT p.*, s.name AS staff_name, s.employee_code,
           e.designation, e.department
      FROM school_payslip p
      JOIN school_staff s ON s.id=p.staff_id
      LEFT JOIN LATERAL (
        SELECT designation, department FROM school_staff_employment e
         WHERE e.app_id=p.app_id AND e.staff_id=p.staff_id AND e.deleted_at IS NULL
         ORDER BY e.effective_from DESC LIMIT 1
      ) e ON true
     WHERE p.app_id=$1 AND p.run_id=$2 AND p.deleted_at IS NULL
     ORDER BY s.employee_code
  `, [appId, id]);

  const [totals] = await execQ(pool, `
    SELECT COUNT(*)::int AS staff_count,
           COALESCE(SUM(gross_earnings),0) AS total_gross,
           COALESCE(SUM(total_deductions),0) AS total_deductions,
           COALESCE(SUM(employer_contrib),0) AS total_employer,
           COALESCE(SUM(net_pay),0) AS total_net
      FROM school_payslip WHERE app_id=$1 AND run_id=$2 AND deleted_at IS NULL
  `, [appId, id]);

  res.json({ ok: true, run, payslips, totals });
}));

/* ---- checks ---- */
hrPayrollRunRouter.get('/hr/payroll/runs/:id/checks', route(async (req, res) => {
  if (!guardView(req, res, 'hr.payroll_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [run] = await execQ(pool, 'SELECT * FROM school_payroll_run WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, id]);
  if (!run) return res.status(404).json({ error: 'Payroll run not found' });

  const base = [appId, run.period_start, run.period_end];

  const activeStaff = await execQ(pool, `
    SELECT s.id, s.name, s.employee_code, s.hr_employee_id,
           e.joining_date, e.exit_date,
           a.id AS assignment_id
      FROM school_staff s
      LEFT JOIN LATERAL (
        SELECT * FROM school_staff_employment e
         WHERE e.app_id=s.app_id AND e.staff_id=s.id AND e.deleted_at IS NULL
           AND e.effective_from <= $3 AND (e.effective_to IS NULL OR e.effective_to >= $2)
         ORDER BY e.effective_from DESC LIMIT 1
      ) e ON true
      LEFT JOIN LATERAL (
        SELECT * FROM school_staff_salary a
         WHERE a.app_id=s.app_id AND a.staff_id=s.id AND a.deleted_at IS NULL
           AND a.effective_from <= $3 AND (a.effective_to IS NULL OR a.effective_to >= $2)
         ORDER BY a.effective_from DESC LIMIT 1
      ) a ON true
     WHERE s.app_id=$1 AND s.deleted_at IS NULL AND s.status='active'
       AND e.id IS NOT NULL
       AND e.joining_date <= $3 AND (e.exit_date IS NULL OR e.exit_date >= $2)
     ORDER BY s.employee_code
  `, base);

  const missingAssignment = activeStaff.filter((s) => !s.assignment_id).map((s) => ({ id: s.id, name: s.name, employee_code: s.employee_code }));

  const bank = await execQ(pool, 'SELECT staff_id FROM school_staff_bank WHERE app_id=$1 AND deleted_at IS NULL AND is_primary=true', [appId]);
  const bankSet = new Set(bank.map((b) => b.staff_id));
  const missingBank = activeStaff.filter((s) => !bankSet.has(s.id)).map((s) => ({ id: s.id, name: s.name, employee_code: s.employee_code }));

  const stat = await execQ(pool, "SELECT staff_id FROM school_staff_statutory WHERE app_id=$1 AND deleted_at IS NULL AND pan IS NOT NULL AND pan <> ''", [appId]);
  const panSet = new Set(stat.map((b) => b.staff_id));
  const missingPan = activeStaff.filter((s) => !panSet.has(s.id)).map((s) => ({ id: s.id, name: s.name, employee_code: s.employee_code }));

  const attendance = await execQ(pool, `
    SELECT s.id, s.name, s.employee_code, COUNT(a.*)::int AS records
      FROM school_staff s
      LEFT JOIN school_staff_attendance a ON a.app_id=s.app_id AND a.employee_id=s.hr_employee_id
        AND a.attendance_date BETWEEN $2 AND $3
     WHERE s.app_id=$1 AND s.deleted_at IS NULL AND s.status='active' AND s.hr_employee_id IS NOT NULL
     GROUP BY s.id, s.name, s.employee_code
  `, base);
  const missingAttendance = attendance.filter((a) => a.records === 0).map((a) => ({ id: a.id, name: a.name, employee_code: a.employee_code }));

  const newJoiners = activeStaff.filter((s) => dayOf(s.joining_date) >= dayOf(run.period_start)).map((s) => ({ id: s.id, name: s.name, employee_code: s.employee_code, joining_date: s.joining_date }));
  const leavers = activeStaff.filter((s) => s.exit_date && dayOf(s.exit_date) <= dayOf(run.period_end)).map((s) => ({ id: s.id, name: s.name, employee_code: s.employee_code, exit_date: s.exit_date }));

  const openAdjustments = await execQ(pool, `
    SELECT a.id, a.staff_id, s.name AS staff_name, a.amount, a.type, a.reason
      FROM school_payroll_adjustment a JOIN school_staff s ON s.id=a.staff_id
     WHERE a.app_id=$1 AND a.deleted_at IS NULL AND a.status='pending'
       AND a.period_end < $2
  `, [appId, run.period_start]);

  const negativeNet = await execQ(pool, `
    SELECT p.id, s.name AS staff_name, p.net_pay FROM school_payslip p JOIN school_staff s ON s.id=p.staff_id
     WHERE p.app_id=$1 AND p.run_id=$2 AND p.deleted_at IS NULL AND p.net_pay < 0
  `, [appId, id]);

  res.json({
    ok: true,
    checks: { missingAssignment, missingBank, missingPan, missingAttendance, newJoiners, leavers, openAdjustments, negativeNet },
    counts: {
      activeStaff: activeStaff.length,
      missingAssignment: missingAssignment.length,
      missingBank: missingBank.length,
      missingPan: missingPan.length,
      missingAttendance: missingAttendance.length,
      newJoiners: newJoiners.length,
      leavers: leavers.length,
      openAdjustments: openAdjustments.length,
      negativeNet: negativeNet.length,
    },
  });
}));

/* ---- compute ---- */
hrPayrollRunRouter.post('/hr/payroll/runs/:id/compute', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.payroll_prepare')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const [run] = await q(client, 'SELECT * FROM school_payroll_run WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL FOR UPDATE', [appId, id]);
    if (!run) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Payroll run not found' }); }
    if (!['draft', 'computed', 'previewed'].includes(run.status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Cannot compute a run in status "${run.status}"` });
    }

    // Idempotent reset: remove previous payslips and reverse earlier recovery
    await client.query('DELETE FROM school_payslip WHERE app_id=$1 AND run_id=$2', [appId, id]);
    await client.query(`
      UPDATE school_payroll_adjustment SET status='pending', source_run_id=NULL, updated_at=now()
       WHERE app_id=$1 AND source_run_id=$2 AND status='applied'
    `, [appId, id]);
    await client.query(`
      UPDATE school_repayment_schedule SET status='pending', recovered_amount=0, recovered_in_run_id=NULL, recovered_at=NULL, updated_at=now()
       WHERE app_id=$1 AND recovered_in_run_id=$2
    `, [appId, id]);
    await client.query("DELETE FROM school_advance_ledger_entry WHERE app_id=$1 AND reference_type='payroll_run' AND reference_id=$2", [appId, id]);
    // restore advance status if it had been auto-closed by this run
    await client.query(`
      UPDATE school_advance SET status='recovering', closed_at=NULL, closed_reason=NULL, updated_at=now()
       WHERE app_id=$1 AND status='closed' AND closed_reason='Recovered in payroll'
         AND EXISTS (SELECT 1 FROM school_repayment_schedule rs WHERE rs.advance_id=school_advance.id AND rs.deleted_at IS NULL AND rs.status <> 'recovered')
    `, [appId]);

    const periodStart = dayOf(run.period_start);
    const periodEnd = dayOf(run.period_end);
    const basisDays = n0(run.wage_base_days) || n0(run.basis_days) || 30;

    const rules = await q(client, 'SELECT * FROM school_statutory_rule WHERE app_id=$1 AND deleted_at IS NULL AND is_active=true', [appId]);
    const lossPolicy = await getSetting(pool, appId, 'loss_of_pay_policy', {});

    const staff = await q(client, `
      SELECT s.id, s.employee_code, s.name, s.hr_employee_id,
             e.designation, e.department, e.type AS employment_type, e.joining_date, e.exit_date,
             a.structure_id, a.overrides
        FROM school_staff s
        JOIN LATERAL (
          SELECT * FROM school_staff_employment e
           WHERE e.app_id=s.app_id AND e.staff_id=s.id AND e.deleted_at IS NULL
             AND e.effective_from <= $3 AND (e.effective_to IS NULL OR e.effective_to >= $2)
           ORDER BY e.effective_from DESC LIMIT 1
        ) e ON true
        JOIN LATERAL (
          SELECT * FROM school_staff_salary a
           WHERE a.app_id=s.app_id AND a.staff_id=s.id AND a.deleted_at IS NULL
             AND a.effective_from <= $3 AND (a.effective_to IS NULL OR a.effective_to >= $2)
           ORDER BY a.effective_from DESC LIMIT 1
        ) a ON true
       WHERE s.app_id=$1 AND s.deleted_at IS NULL AND s.status='active'
         AND e.joining_date <= $3 AND (e.exit_date IS NULL OR e.exit_date >= $2)
       ORDER BY s.employee_code
    `, [appId, periodStart, periodEnd]);

    const ruleVersions = {};
    for (const r of rules) ruleVersions[r.rule_code] = r.version;

    const advRecComp = await ensureComponent(client, appId, { code: 'ADV_REC', name: 'Advance / Loan Recovery', type: 'deduction', sort_order: 80 });
    const pfEmp = await ensureComponent(client, appId, { code: 'PF_EMP', name: 'PF Employee', type: 'deduction', sort_order: 90 });
    const pfEmpr = await ensureComponent(client, appId, { code: 'PF_EMPR', name: 'PF Employer', type: 'employer_contribution', sort_order: 91 });
    const esiEmp = await ensureComponent(client, appId, { code: 'ESI_EMP', name: 'ESI Employee', type: 'deduction', sort_order: 92 });
    const esiEmpr = await ensureComponent(client, appId, { code: 'ESI_EMPR', name: 'ESI Employer', type: 'employer_contribution', sort_order: 93 });
    const ptComp = await ensureComponent(client, appId, { code: 'PT', name: 'Professional Tax', type: 'deduction', sort_order: 94 });
    const tdsComp = await ensureComponent(client, appId, { code: 'TDS', name: 'Tax Deducted at Source', type: 'deduction', sort_order: 95 });
    const gratuityComp = await ensureComponent(client, appId, { code: 'GRATUITY', name: 'Gratuity Provision', type: 'employer_contribution', sort_order: 96 });
    const bonusComp = await ensureComponent(client, appId, { code: 'BONUS', name: 'Bonus Provision', type: 'employer_contribution', sort_order: 97 });

    let computed = 0;
    const runMonth = `${periodStart.slice(0, 7)}-01`;

    for (const s of staff) {
      const lines = await q(client, `
        SELECT l.component_id, l.value AS line_value, l.percent AS line_percent, l.formula AS line_formula, l.condition,
               c.code, c.name AS comp_name, c.type, c.calculation, c.value AS comp_value, c.percent AS comp_percent,
               c.formula AS comp_formula, c.base_component_id, c.is_wage_base, c.is_proratable, c.is_variable, c.is_taxable,
               COALESCE(c.sort_order, 0) AS sort_order
          FROM school_salary_structure_line l
          JOIN school_salary_component c ON c.id=l.component_id AND c.deleted_at IS NULL
         WHERE l.app_id=$1 AND l.structure_id=$2 AND l.deleted_at IS NULL
         ORDER BY l.sort_order, c.sort_order
      `, [appId, s.structure_id]);

      const overrides = s.overrides || {};

      // ---- LOP ----
      let lop = 0;
      const leaveRows = await q(client, `
        SELECT la.from_date, la.to_date, la.days, la.half_day
          FROM school_leave_application la
          JOIN school_leave_type lt ON lt.id=la.leave_type_id
         WHERE la.app_id=$1 AND la.staff_id=$2 AND la.deleted_at IS NULL
           AND la.status IN ('approved','taken') AND lt.is_paid=false
           AND la.from_date <= $4 AND la.to_date >= $3
      `, [appId, s.id, periodStart, periodEnd]);
      for (const lv of leaveRows) {
        const from = new Date(Math.max(new Date(lv.from_date).getTime(), new Date(`${periodStart}T00:00:00Z`).getTime()));
        const to = new Date(Math.min(new Date(lv.to_date).getTime(), new Date(`${periodEnd}T00:00:00Z`).getTime()));
        const d = Math.floor((to - from) / 86400000) + 1;
        lop += Math.max(0, d) - (lv.half_day ? 0.5 : 0);
      }

      if (s.hr_employee_id) {
        const [att] = await q(client, `
          SELECT COUNT(*)::int AS records,
                 COUNT(*) FILTER (WHERE status='absent')::int AS absent,
                 COUNT(*) FILTER (WHERE status='half_day')::int AS half_day,
                 COUNT(*) FILTER (WHERE status='late')::int AS late
            FROM school_staff_attendance
           WHERE app_id=$1 AND employee_id=$2 AND attendance_date BETWEEN $3 AND $4
        `, [appId, s.hr_employee_id, periodStart, periodEnd]);
        if (att && att.records > 0) {
          lop += n0(att.absent) + n0(att.half_day) * 0.5;
          const threshold = n0(lossPolicy?.late_marks_as_half_day) || 3;
          if (threshold > 0) lop += Math.floor(n0(att.late) / threshold) * 0.5;
        }
      }
      lop = Math.min(lop, basisDays);
      const paidDays = Math.max(0, basisDays - lop);

      // ---- earnings / fixed deductions from structure ----
      const payslipLines = [];
      const amountsById = {};
      let gross = 0;
      let wageBase = 0;
      const ctxBase = { paid_days: paidDays, basis_days: basisDays, lop_days: lop, gross_earnings: 0, wage_base: 0 };

      for (const line of lines) {
        const ov = overrides[line.code] !== undefined ? overrides[line.code] : overrides[String(line.component_id)];
        let value = line.line_value !== null && line.line_value !== undefined ? Number(line.line_value) : (line.comp_value !== null && line.comp_value !== undefined ? Number(line.comp_value) : null);
        let percent = line.line_percent !== null && line.line_percent !== undefined ? Number(line.line_percent) : (line.comp_percent !== null && line.comp_percent !== undefined ? Number(line.comp_percent) : null);
        let formula = line.line_formula || line.comp_formula || '';
        if (ov !== undefined && ov !== null) {
          if (typeof ov === 'number') value = ov;
          else if (typeof ov === 'object') {
            if (ov.value !== undefined) value = Number(ov.value);
            if (ov.percent !== undefined) percent = Number(ov.percent);
            if (ov.formula !== undefined) formula = ov.formula;
          }
        }

        let amount = 0;
        const calc = line.calculation;
        if (calc === 'fixed') amount = n0(value);
        else if (calc === 'percent') {
          const base = line.base_component_id ? n0(amountsById[line.base_component_id]) : (line.is_wage_base ? wageBase : (wageBase || gross));
          amount = (n0(percent) / 100) * base;
        } else if (calc === 'formula') {
          if (!formula) continue; // statutory-style components are handled below
          const ctx = { ...ctxBase, gross_earnings: gross, wage_base: wageBase };
          for (const [code, amt] of Object.entries(amountsById)) {
            ctx[code] = amt; ctx[code.toLowerCase()] = amt;
          }
          amount = evalFormula(formula, ctx);
        }

        if (line.type === 'earning' && line.is_proratable !== false && (line.is_variable === false || line.is_variable === null)) {
          amount = basisDays > 0 ? amount * (paidDays / basisDays) : amount;
        }
        amount = r2(amount);

        if (line.type === 'earning') { gross += amount; amountsById[line.component_id] = amount; if (line.is_wage_base) wageBase += amount; }
        else amountsById[line.component_id] = amount;

        if (amount !== 0 || line.type === 'earning') {
          payslipLines.push({
            component_id: line.component_id, code: line.code, name: line.comp_name, type: line.type, amount,
            sort_order: line.sort_order || 0,
            details: { basis: calc, value, percent, paid_days: paidDays, basis_days: basisDays, formula: formula || null },
          });
        }
      }

      // ---- adjustments ----
      const adjustments = await q(client, `
        SELECT a.*, c.code, c.name AS comp_name, c.type
          FROM school_payroll_adjustment a
          JOIN school_salary_component c ON c.id=a.component_id AND c.deleted_at IS NULL
         WHERE a.app_id=$1 AND a.staff_id=$2 AND a.deleted_at IS NULL AND a.status='pending'
           AND a.period_start <= $4 AND a.period_end >= $3
      `, [appId, s.id, periodStart, periodEnd]);
      for (const adj of adjustments) {
        const amt = r2(adj.amount);
        payslipLines.push({ component_id: adj.component_id, code: adj.code, name: adj.comp_name, type: adj.type, amount: amt, sort_order: 70, details: { basis: 'adjustment', type: adj.type, reason: adj.reason, adjustment_id: adj.id } });
        if (adj.type === 'earning') gross += amt;
        await client.query('UPDATE school_payroll_adjustment SET status=\'applied\', source_run_id=$3, updated_at=now() WHERE app_id=$1 AND id=$2', [appId, adj.id, id]);
      }

      let deductions = 0;
      let employerContrib = 0;
      const addLine = (componentId, code, name, type, amount, details) => {
        const amt = r2(amount);
        if (amt === 0) return;
        payslipLines.push({ component_id: componentId, code, name, type, amount: amt, sort_order: 90, details });
        if (type === 'deduction') deductions += amt;
        else if (type === 'employer_contribution') employerContrib += amt;
      };
      // accumulate already-present structure deductions
      for (const l of payslipLines) {
        if (l.type === 'deduction') deductions += l.amount;
        else if (l.type === 'employer_contribution') employerContrib += l.amount;
      }

      // ---- statutory: PF ----
      const pfRule = activeRule(rules, 'PF', periodEnd);
      if (pfRule && wageBase > 0) {
        const cfg = pfRule.config || {};
        const ceiling = n0(cfg.wage_ceiling) || 15000;
        const base = Math.min(wageBase, ceiling);
        addLine(pfEmp, 'PF_EMP', 'PF Employee', 'deduction', base * n0(cfg.employee_rate ?? 12) / 100, { basis: 'statutory_pf', wage_base: base, rate: cfg.employee_rate });
        addLine(pfEmpr, 'PF_EMPR', 'PF Employer', 'employer_contribution', base * n0(cfg.employer_rate ?? 12) / 100, { basis: 'statutory_pf', wage_base: base, rate: cfg.employer_rate });
      }

      // ---- statutory: ESI ----
      const esiRule = activeRule(rules, 'ESI', periodEnd);
      if (esiRule && gross > 0) {
        const cfg = esiRule.config || {};
        const threshold = n0(cfg.eligibility_threshold ?? cfg.wage_ceiling) || 21000;
        if (gross <= threshold) {
          addLine(esiEmp, 'ESI_EMP', 'ESI Employee', 'deduction', gross * n0(cfg.employee_rate ?? 0.75) / 100, { basis: 'statutory_esi', gross, rate: cfg.employee_rate });
          addLine(esiEmpr, 'ESI_EMPR', 'ESI Employer', 'employer_contribution', gross * n0(cfg.employer_rate ?? 3.25) / 100, { basis: 'statutory_esi', gross, rate: cfg.employer_rate });
        }
      }

      // ---- statutory: PT ----
      const ptRule = activeRule(rules, 'PT', periodEnd);
      if (ptRule && gross > 0) {
        let pt = 0;
        const pslabs = Array.isArray(ptRule.config?.slabs) ? ptRule.config.slabs : null;
        if (pslabs) pt = slabTax(ptRule.config, gross);
        else {
          const dbSlabs = await q(client, 'SELECT * FROM school_statutory_rule_slab WHERE app_id=$1 AND rule_id=$2 AND deleted_at IS NULL ORDER BY min_amount', [appId, ptRule.id]);
          const slab = dbSlabs.find((sl) => gross >= n0(sl.min_amount) && (sl.max_amount === null || gross <= n0(sl.max_amount)));
          if (slab) pt = n0(slab.fixed_amount) + (n0(slab.rate) / 100) * Math.max(0, gross - n0(slab.min_amount));
        }
        addLine(ptComp, 'PT', 'Professional Tax', 'deduction', pt, { basis: 'statutory_pt', gross });
      }

      // ---- statutory: TDS ----
      const tdsRule = activeRule(rules, 'TDS', periodEnd);
      if (tdsRule && gross > 0) {
        const [decl] = await q(client, `
          SELECT * FROM school_tax_declaration
           WHERE app_id=$1 AND staff_id=$2 AND deleted_at IS NULL AND status IN ('submitted','verified')
           ORDER BY declared_at DESC LIMIT 1
        `, [appId, s.id]);
        const regime = decl?.regime || tdsRule.config?.default_regime || 'new';
        const annual = gross * 12;
        const tds = tdsMonthly(annual, regime, decl);
        addLine(tdsComp, 'TDS', 'Tax Deducted at Source', 'deduction', tds, { basis: 'statutory_tds', regime, annual_gross: annual });
      }

      // ---- employer provisions ----
      const gratuityRule = activeRule(rules, 'GRATUITY', periodEnd);
      if (gratuityRule && wageBase > 0) {
        const rate = n0(gratuityRule.config?.rate) || 4.81;
        addLine(gratuityComp, 'GRATUITY', 'Gratuity Provision', 'employer_contribution', wageBase * rate / 100, { basis: 'gratuity', wage_base: wageBase, rate });
      }
      const bonusRule = activeRule(rules, 'BONUS', periodEnd);
      if (bonusRule && wageBase > 0) {
        const ceiling = n0(bonusRule.config?.pay_ceiling) || 21000;
        const rate = n0(bonusRule.config?.rate) || 8.33;
        addLine(bonusComp, 'BONUS', 'Bonus Provision', 'employer_contribution', Math.min(wageBase, ceiling) * rate / 100 / 12, { basis: 'bonus', wage_base: Math.min(wageBase, ceiling), rate });
      }

      // ---- advances / loans recovery ----
      const dueSchedules = await q(client, `
        SELECT rs.*, a.type AS advance_type
          FROM school_repayment_schedule rs
          JOIN school_advance a ON a.id=rs.advance_id AND a.deleted_at IS NULL
         WHERE rs.app_id=$1 AND a.staff_id=$2 AND rs.deleted_at IS NULL
           AND a.status IN ('disbursed','recovering')
           AND rs.status IN ('pending','partially_recovered')
           AND rs.due_month <= $3
         ORDER BY rs.due_month, rs.installment_no
      `, [appId, s.id, runMonth]);
      let advanceRecovery = 0;
      for (const sc of dueSchedules) {
        const remaining = r2(n0(sc.total_amount) - n0(sc.recovered_amount));
        if (remaining <= 0) continue;
        advanceRecovery += remaining;
        const newRecovered = r2(n0(sc.recovered_amount) + remaining);
        const status = newRecovered >= n0(sc.total_amount) - 0.01 ? 'recovered' : 'partially_recovered';
        await client.query(`
          UPDATE school_repayment_schedule
             SET recovered_amount=$3, status=$4, recovered_in_run_id=$5, recovered_at=now(), updated_at=now()
           WHERE app_id=$1 AND id=$2
        `, [appId, sc.id, newRecovered, status, id]);

        // outstanding after this recovery across the advance schedule
        const [{ outstanding }] = await q(client, `
          SELECT COALESCE(SUM(total_amount - recovered_amount),0) AS outstanding
            FROM school_repayment_schedule WHERE app_id=$1 AND advance_id=$2 AND deleted_at IS NULL AND status <> 'pending'::text OR (app_id=$1 AND advance_id=$2 AND deleted_at IS NULL AND status='pending')
        `, [appId, sc.advance_id]);
        await client.query(`
          INSERT INTO school_advance_ledger_entry (app_id, advance_id, date, type, amount, balance_after, reference_id, reference_type, remarks, created_by)
          VALUES ($1,$2,$3,'recovery',$4,$5,$6,'payroll_run',$7,$8)
        `, [appId, sc.advance_id, periodEnd, r2(remaining), r2(outstanding), id, `Recovered in payroll ${run.period_name}`, userOf(req)]);
      }
      if (advanceRecovery > 0) {
        addLine(advRecComp, 'ADV_REC', 'Advance / Loan Recovery', 'deduction', advanceRecovery, { basis: 'advance_recovery', installments: dueSchedules.length });
        // close fully recovered advances
        await client.query(`
          UPDATE school_advance SET status='closed', closed_at=now(), closed_reason='Recovered in payroll', updated_at=now()
           WHERE app_id=$1 AND staff_id=$2 AND status IN ('disbursed','recovering')
             AND NOT EXISTS (
               SELECT 1 FROM school_repayment_schedule rs
                WHERE rs.advance_id=school_advance.id AND rs.deleted_at IS NULL AND rs.status NOT IN ('recovered','skipped')
             )
        `, [appId, s.id]);
      }

      // ---- totals ----
      // recompute deductions/employer after all lines added (avoid double count)
      deductions = 0; employerContrib = 0;
      for (const l of payslipLines) {
        if (l.type === 'deduction') deductions += l.amount;
        else if (l.type === 'employer_contribution') employerContrib += l.amount;
      }
      gross = r2(gross);
      deductions = r2(deductions);
      employerContrib = r2(employerContrib);
      const net = r2(gross - deductions);

      const [payslip] = await q(client, `
        INSERT INTO school_payslip (app_id, run_id, staff_id, paid_days, lop_days, gross_earnings, total_deductions, employer_contrib, net_pay, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'computed') RETURNING id
      `, [appId, id, s.id, r2(paidDays), r2(lop), gross, deductions, employerContrib, net]);

      for (const l of payslipLines) {
        await client.query(`
          INSERT INTO school_payslip_line (app_id, payslip_id, component_id, component_code, component_name, component_type, amount, calculation_details, sort_order)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `, [appId, payslip.id, l.component_id, l.code, l.name, l.type, r2(l.amount), JSON.stringify(l.details || {}), l.sort_order || 0]);
      }
      computed++;
    }

    const [updated] = await q(client, `
      UPDATE school_payroll_run SET status='computed', run_by=$3, run_at=now(), rule_versions=$4, updated_at=now()
       WHERE app_id=$1 AND id=$2 RETURNING *
    `, [appId, id, userOf(req), JSON.stringify(ruleVersions)]);

    await client.query('COMMIT');
    res.json({ ok: true, run: updated, computed });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}));

/* ---- preview with variance ---- */
hrPayrollRunRouter.get('/hr/payroll/runs/:id/preview', route(async (req, res) => {
  if (!guardView(req, res, 'hr.payroll_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [run] = await execQ(pool, 'SELECT * FROM school_payroll_run WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, id]);
  if (!run) return res.status(404).json({ error: 'Payroll run not found' });

  const [prevRun] = await execQ(pool, `
    SELECT * FROM school_payroll_run
     WHERE app_id=$1 AND deleted_at IS NULL AND period_start < $2 AND status NOT IN ('cancelled','draft')
     ORDER BY period_start DESC LIMIT 1
  `, [appId, run.period_start]);

  const rows = await execQ(pool, `
    SELECT p.*, s.name AS staff_name, s.employee_code,
           pp.gross_earnings AS prev_gross, pp.total_deductions AS prev_deductions, pp.net_pay AS prev_net,
           (p.gross_earnings - COALESCE(pp.gross_earnings,0)) AS gross_variance,
           (p.net_pay - COALESCE(pp.net_pay,0)) AS net_variance,
           CASE WHEN COALESCE(pp.net_pay,0) > 0 THEN ROUND(((p.net_pay - pp.net_pay) / pp.net_pay) * 100, 2) ELSE NULL END AS net_pct_change
      FROM school_payslip p
      JOIN school_staff s ON s.id=p.staff_id
      LEFT JOIN school_payslip pp ON pp.app_id=p.app_id AND pp.staff_id=p.staff_id AND pp.run_id=$3 AND pp.deleted_at IS NULL
     WHERE p.app_id=$1 AND p.run_id=$2 AND p.deleted_at IS NULL
     ORDER BY s.employee_code
  `, [appId, id, prevRun?.id || 0]);

  res.json({ ok: true, run, prevRun: prevRun || null, payslips: rows });
}));

/* ---- adjustments ---- */
hrPayrollRunRouter.get('/hr/payroll/runs/:id/adjustments', route(async (req, res) => {
  if (!guardView(req, res, 'hr.payroll_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const rows = await execQ(pool, `
    SELECT a.*, s.name AS staff_name, s.employee_code, c.code AS component_code, c.name AS component_name, c.type AS component_type
      FROM school_payroll_adjustment a
      JOIN school_staff s ON s.id=a.staff_id
      JOIN school_salary_component c ON c.id=a.component_id
     WHERE a.app_id=$1 AND a.deleted_at IS NULL
       AND (a.source_run_id=$2 OR (a.status='pending' AND a.period_start <= (SELECT period_end FROM school_payroll_run WHERE id=$2) AND a.period_end >= (SELECT period_start FROM school_payroll_run WHERE id=$2)))
     ORDER BY a.created_at DESC
  `, [appId, id]);
  res.json({ ok: true, adjustments: rows });
}));

hrPayrollRunRouter.post('/hr/payroll/runs/:id/adjustments', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.payroll_prepare')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};
  const [run] = await execQ(pool, 'SELECT * FROM school_payroll_run WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, id]);
  if (!run) return res.status(404).json({ error: 'Payroll run not found' });
  if (!num(b.staff_id) || !num(b.component_id) || !num(b.amount) || !text(b.reason)) {
    return res.status(400).json({ error: 'staff_id, component_id, amount and reason are required' });
  }
  const [row] = await execQ(pool, `
    INSERT INTO school_payroll_adjustment (app_id, staff_id, period_start, period_end, component_id, amount, reason, type, status, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9) RETURNING *
  `, [appId, num(b.staff_id), dayOf(b.period_start) || run.period_start, dayOf(b.period_end) || run.period_end, num(b.component_id), num(b.amount), text(b.reason), text(b.type) || 'other', userOf(req)]);
  res.json({ ok: true, adjustment: row });
}));

hrPayrollRunRouter.put('/hr/payroll/adjustments/:id', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.payroll_prepare')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  const [row] = await execQ(pool, `
    UPDATE school_payroll_adjustment SET component_id=$3, amount=$4, reason=$5, type=$6,
           period_start=COALESCE($7, period_start), period_end=COALESCE($8, period_end), updated_at=now()
     WHERE app_id=$1 AND id=$2 AND status='pending' AND deleted_at IS NULL RETURNING *
  `, [appId, num(req.params.id), num(b.component_id), num(b.amount), text(b.reason), text(b.type) || 'other', dayOf(b.period_start), dayOf(b.period_end)]);
  if (!row) return res.status(404).json({ error: 'Pending adjustment not found' });
  res.json({ ok: true, adjustment: row });
}));

hrPayrollRunRouter.delete('/hr/payroll/adjustments/:id', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.payroll_prepare')) return;
  const pool = getPool();
  await execQ(pool, "UPDATE school_payroll_adjustment SET deleted_at=now(), status='cancelled' WHERE app_id=$1 AND id=$2 AND status='pending'", [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true });
}));

/* Backwards-compatible POST delete alias (Payroll Wizard uses POST). */
hrPayrollRunRouter.post('/hr/payroll/adjustments/:id/delete', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.payroll_prepare')) return;
  const pool = getPool();
  await execQ(pool, "UPDATE school_payroll_adjustment SET deleted_at=now(), status='cancelled' WHERE app_id=$1 AND id=$2 AND status='pending'", [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true });
}));

/* ---- lifecycle ---- */
hrPayrollRunRouter.post('/hr/payroll/runs/:id/approve', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.payroll_approve')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [run] = await execQ(pool, `
    UPDATE school_payroll_run SET status='approved', approved_by=$3, approved_at=now(), updated_at=now()
     WHERE app_id=$1 AND id=$2 AND status IN ('computed','previewed') AND deleted_at IS NULL RETURNING *
  `, [appId, id, userOf(req)]);
  if (!run) return res.status(404).json({ error: 'Computed payroll run not found' });
  res.json({ ok: true, run });
}));

hrPayrollRunRouter.post('/hr/payroll/runs/:id/lock', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.payroll_lock')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [run] = await execQ(pool, `
    UPDATE school_payroll_run SET status='locked', locked_by=$3, locked_at=now(), updated_at=now()
     WHERE app_id=$1 AND id=$2 AND status='approved' AND deleted_at IS NULL RETURNING *
  `, [appId, id, userOf(req)]);
  if (!run) return res.status(404).json({ error: 'Approved payroll run not found' });
  res.json({ ok: true, run });
}));

hrPayrollRunRouter.post('/hr/payroll/runs/:id/unlock', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.payroll_unlock')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [run] = await execQ(pool, `
    UPDATE school_payroll_run SET status='approved', locked_by=NULL, locked_at=NULL, updated_at=now()
     WHERE app_id=$1 AND id=$2 AND status='locked' AND deleted_at IS NULL RETURNING *
  `, [appId, id]);
  if (!run) return res.status(404).json({ error: 'Locked payroll run not found' });
  await execQ(pool, `INSERT INTO school_audit_log (app_id, user_id, action, entity, entity_id, after_json) VALUES ($1,$2,'unlock','school_payroll_run',$3,$4)`, [appId, userOf(req), String(id), JSON.stringify({ run_id: id, period_name: run.period_name })]);
  res.json({ ok: true, run });
}));

hrPayrollRunRouter.post('/hr/payroll/runs/:id/mark-paid', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.payroll_post')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const [run] = await q(client, `
      UPDATE school_payroll_run SET status='paid', paid_by=$3, paid_at=now(), updated_at=now()
       WHERE app_id=$1 AND id=$2 AND status='locked' AND deleted_at IS NULL RETURNING *
    `, [appId, id, userOf(req)]);
    if (!run) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Locked payroll run not found' }); }
    await client.query("UPDATE school_payslip SET status='paid', updated_at=now() WHERE app_id=$1 AND run_id=$2 AND deleted_at IS NULL", [appId, id]);
    await client.query('COMMIT');
    res.json({ ok: true, run });
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
}));

hrPayrollRunRouter.post('/hr/payroll/runs/:id/post-to-accounts', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.payroll_post')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const [run] = await q(client, 'SELECT * FROM school_payroll_run WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL FOR UPDATE', [appId, id]);
    if (!run) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Payroll run not found' }); }
    if (run.status !== 'paid') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Run must be marked paid before posting' }); }

    const [vType] = await q(client, "SELECT id FROM school_voucher_type WHERE app_id=$1 AND deleted_at IS NULL AND (code ILIKE '%JOURNAL%' OR name ILIKE '%journal%') ORDER BY id LIMIT 1", [appId]);
    if (!vType) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Voucher type "JOURNAL" is not configured in Fees & Accounts' });
    }
    const [bank] = await q(client, 'SELECT id FROM school_account WHERE app_id=$1 AND deleted_at IS NULL AND is_cash_or_bank=true ORDER BY id LIMIT 1', [appId]);
    if (!bank) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'No cash/bank account configured in Fees & Accounts' });
    }

    const lines = await q(client, `
      SELECT pl.component_type, pl.amount, c.account_id
        FROM school_payslip_line pl
        JOIN school_payslip p ON p.id=pl.payslip_id
        JOIN school_salary_component c ON c.id=pl.component_id
       WHERE pl.app_id=$1 AND p.run_id=$2
    `, [appId, id]);

    const [tot] = await q(client, 'SELECT COALESCE(SUM(net_pay),0) AS net, COALESCE(SUM(employer_contrib),0) AS employer FROM school_payslip WHERE app_id=$1 AND run_id=$2 AND deleted_at IS NULL', [appId, id]);

    const debit = {}; const credit = {};
    for (const l of lines) {
      if (!l.account_id) continue;
      if (l.component_type === 'earning' || l.component_type === 'employer_contribution') debit[l.account_id] = r2(n0(debit[l.account_id]) + n0(l.amount));
      else if (l.component_type === 'deduction') credit[l.account_id] = r2(n0(credit[l.account_id]) + n0(l.amount));
    }
    credit[bank.id] = r2(n0(credit[bank.id]) + n0(tot.net));

    // balancing account: salary payable / clearing
    const [clearing] = await q(client, "SELECT id FROM school_account WHERE app_id=$1 AND deleted_at IS NULL AND (code ILIKE '%PAYABLE%' OR name ILIKE '%payable%' OR name ILIKE '%salary%' OR name ILIKE '%payroll%') ORDER BY id LIMIT 1", [appId]);
    const totalDebit = r2(Object.values(debit).reduce((a, b) => a + b, 0));
    const totalCredit = r2(Object.values(credit).reduce((a, b) => a + b, 0));
    const diff = r2(totalDebit - totalCredit);
    if (Math.abs(diff) > 0.01) {
      if (!clearing) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Voucher would be unbalanced by ${diff}. Configure a salary payable/clearing account or component account mappings.` });
      }
      if (diff > 0) credit[clearing.id] = r2(n0(credit[clearing.id]) + diff);
      else debit[clearing.id] = r2(n0(debit[clearing.id]) + Math.abs(diff));
    }
    const finalDebit = r2(Object.values(debit).reduce((a, b) => a + b, 0));
    const finalCredit = r2(Object.values(credit).reduce((a, b) => a + b, 0));
    if (Math.abs(finalDebit - finalCredit) > 0.01) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Could not balance payroll voucher' });
    }

    const [voucher] = await q(client, `
      INSERT INTO school_voucher (app_id, type_id, number, date, source_type, source_id, narration, status, total_debit, total_credit, posted_by, posted_at, created_by)
      VALUES ($1,$2,$3,$4,'payroll_run',$5,$6,'posted',$7,$8,$9,now(),$9) RETURNING *
    `, [appId, vType.id, `PAY-${run.period_name}`, run.period_end, id, `Payroll for ${run.period_name}`, finalDebit, finalCredit, userOf(req)]);

    let sort = 0;
    for (const [acc, amt] of Object.entries(debit)) {
      if (amt === 0) continue;
      await q(client, 'INSERT INTO school_voucher_line (app_id, voucher_id, account_id, debit, credit, sort_order) VALUES ($1,$2,$3,$4,0,$5)', [appId, voucher.id, Number(acc), amt, sort++]);
    }
    for (const [acc, amt] of Object.entries(credit)) {
      if (amt === 0) continue;
      await q(client, 'INSERT INTO school_voucher_line (app_id, voucher_id, account_id, debit, credit, sort_order) VALUES ($1,$2,$3,0,$4,$5)', [appId, voucher.id, Number(acc), amt, sort++]);
    }

    const [updated] = await q(client, `
      UPDATE school_payroll_run SET status='posted', posted_by=$3, posted_at=now(), updated_at=now()
       WHERE app_id=$1 AND id=$2 RETURNING *
    `, [appId, id, userOf(req)]);
    await client.query("UPDATE school_payslip SET status='paid', updated_at=now() WHERE app_id=$1 AND run_id=$2 AND deleted_at IS NULL", [appId, id]);
    await client.query('COMMIT');
    res.json({ ok: true, run: updated, voucher });
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
}));

hrPayrollRunRouter.post('/hr/payroll/runs/:id/cancel', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.payroll_manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [run] = await execQ(pool, `
    UPDATE school_payroll_run SET status='cancelled', updated_at=now()
     WHERE app_id=$1 AND id=$2 AND status IN ('draft','computed','previewed') AND deleted_at IS NULL RETURNING *
  `, [appId, id]);
  if (!run) return res.status(404).json({ error: 'Payroll run not found or cannot be cancelled' });
  res.json({ ok: true, run });
}));

hrPayrollRunRouter.delete('/hr/payroll/runs/:id', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.payroll_manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [run] = await execQ(pool, 'SELECT status FROM school_payroll_run WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, id]);
  if (!run) return res.status(404).json({ error: 'Payroll run not found' });
  if (!['draft', 'cancelled'].includes(run.status)) return res.status(409).json({ error: 'Only draft or cancelled runs can be deleted' });
  await execQ(pool, 'UPDATE school_payroll_run SET deleted_at=now() WHERE app_id=$1 AND id=$2', [appId, id]);
  res.json({ ok: true });
}));

/* ============================================================
   PAYSLIPS
   ============================================================ */

hrPayrollRunRouter.get('/hr/payroll/payslips', route(async (req, res) => {
  if (!guardView(req, res, 'hr.payroll_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const runId = num(req.query.run_id);
  const staffId = num(req.query.staff_id);

  const values = [appId];
  const where = ['p.app_id=$1', 'p.deleted_at IS NULL'];
  if (runId) { values.push(runId); where.push(`p.run_id=$${values.length}`); }
  if (staffId) { values.push(staffId); where.push(`p.staff_id=$${values.length}`); }

  const rows = await execQ(pool, `
    SELECT p.*, s.name AS staff_name, s.employee_code
      FROM school_payslip p
      JOIN school_staff s ON s.id=p.staff_id
     WHERE ${where.join(' AND ')}
     ORDER BY s.employee_code
  `, values);

  res.json({ ok: true, payslips: rows });
}));

hrPayrollRunRouter.get('/hr/payroll/runs/:id/payslips', route(async (req, res) => {
  if (!guardView(req, res, 'hr.payroll_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const rows = await execQ(pool, `
    SELECT p.*, s.name AS staff_name, s.employee_code
      FROM school_payslip p JOIN school_staff s ON s.id=p.staff_id
     WHERE p.app_id=$1 AND p.run_id=$2 AND p.deleted_at IS NULL
     ORDER BY s.employee_code
  `, [appId, id]);
  res.json({ ok: true, payslips: rows });
}));

hrPayrollRunRouter.get('/hr/payroll/runs/:id/payslips/:staffId', route(async (req, res) => {
  if (!guardView(req, res, 'hr.payroll_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const [payslip] = await execQ(pool, `
    SELECT p.*, s.name AS staff_name, s.employee_code
      FROM school_payslip p JOIN school_staff s ON s.id=p.staff_id
     WHERE p.app_id=$1 AND p.run_id=$2 AND p.staff_id=$3 AND p.deleted_at IS NULL
  `, [appId, num(req.params.id), num(req.params.staffId)]);
  if (!payslip) return res.status(404).json({ error: 'Payslip not found' });
  const lines = await execQ(pool, 'SELECT * FROM school_payslip_line WHERE app_id=$1 AND payslip_id=$2 ORDER BY sort_order, id', [appId, payslip.id]);
  res.json({ ok: true, payslip, lines });
}));

hrPayrollRunRouter.get('/hr/payroll/payslips/:id', route(async (req, res) => {
  if (!guardView(req, res, 'hr.payroll_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);

  const [payslip] = await execQ(pool, `
    SELECT p.*, s.name AS staff_name, s.employee_code, s.contact_email,
           r.period_name, r.period_start, r.period_end, r.status AS run_status
      FROM school_payslip p
      JOIN school_staff s ON s.id=p.staff_id
      JOIN school_payroll_run r ON r.id=p.run_id
     WHERE p.app_id=$1 AND p.id=$2 AND p.deleted_at IS NULL
  `, [appId, id]);

  if (!payslip) return res.status(404).json({ error: 'Payslip not found' });

  const lines = await execQ(pool, 'SELECT * FROM school_payslip_line WHERE app_id=$1 AND payslip_id=$2 ORDER BY sort_order, id', [appId, id]);
  res.json({ ok: true, payslip, lines });
}));

hrPayrollRunRouter.get('/hr/payroll/payslips/:id/print', route(async (req, res) => {
  if (!guardView(req, res, 'hr.payroll_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [payslip] = await execQ(pool, `
    SELECT p.*, s.name AS staff_name, s.employee_code, r.period_name, r.period_start, r.period_end
      FROM school_payslip p JOIN school_staff s ON s.id=p.staff_id JOIN school_payroll_run r ON r.id=p.run_id
     WHERE p.app_id=$1 AND p.id=$2 AND p.deleted_at IS NULL
  `, [appId, id]);
  if (!payslip) return res.status(404).json({ error: 'Payslip not found' });
  const lines = await execQ(pool, 'SELECT * FROM school_payslip_line WHERE app_id=$1 AND payslip_id=$2 ORDER BY sort_order, id', [appId, id]);
  const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const row = (l) => `<tr><td>${l.component_name} <span class="muted">(${l.component_code})</span></td><td class="num">${l.component_type === 'deduction' ? '' : money(l.amount)}</td><td class="num">${l.component_type === 'deduction' ? money(l.amount) : ''}</td></tr>`;
  res.type('text/html').send(`<!doctype html><html><head><meta charset="utf-8"><title>Payslip ${payslip.employee_code} ${payslip.period_name}</title>
  <style>body{font-family:system-ui,Arial,sans-serif;margin:24px;color:#222}h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #ccc;padding:6px 8px;font-size:13px;text-align:left}.num{text-align:right}.muted{color:#888;font-size:11px}.tot{font-weight:700;background:#f4f4f4}</style></head><body>
  <h1>Payslip — ${payslip.period_name}</h1>
  <div>Employee: <b>${payslip.staff_name}</b> (${payslip.employee_code})</div>
  <div>Paid days: ${payslip.paid_days} &nbsp; LOP days: ${payslip.lop_days}</div>
  <table><thead><tr><th>Component</th><th class="num">Earnings</th><th class="num">Deductions</th></tr></thead><tbody>
  ${lines.filter((l) => l.component_type !== 'employer_contribution').map(row).join('')}
  <tr class="tot"><td>Gross / Deductions</td><td class="num">${money(payslip.gross_earnings)}</td><td class="num">${money(payslip.total_deductions)}</td></tr>
  <tr class="tot"><td>Net Pay</td><td class="num" colspan="2">${money(payslip.net_pay)}</td></tr>
  </tbody></table>
  <p class="muted">Employer contributions: ${money(payslip.employer_contrib)}. Generated ${new Date().toISOString().slice(0, 10)}.</p>
  <script>window.print && setTimeout(()=>window.print(),300);</script></body></html>`);
}));

hrPayrollRunRouter.post('/hr/payroll/payslips/:id/generate-pdf', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.payroll_payslip')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const url = `/api/school/hr/payroll/payslips/${id}/print`;
  const [row] = await execQ(pool, 'UPDATE school_payslip SET pdf_url=$3, pdf_generated_at=now(), updated_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *', [appId, id, url]);
  if (!row) return res.status(404).json({ error: 'Payslip not found' });
  res.json({ ok: true, payslip: row, pdf_url: url });
}));

hrPayrollRunRouter.post('/hr/payroll/runs/:id/payslips/generate', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.payroll_payslip')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const updated = await execQ(pool, `
    UPDATE school_payslip SET pdf_url='/api/school/hr/payroll/payslips/' || id || '/print', pdf_generated_at=now(), updated_at=now()
     WHERE app_id=$1 AND run_id=$2 AND deleted_at IS NULL RETURNING id
  `, [appId, id]);
  res.json({ ok: true, generated: updated.length });
}));

hrPayrollRunRouter.post('/hr/payroll/payslips/email', route(async (req, res) => {
  if (!guardManage(req, res, 'hr.payroll_payslip')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  const ids = Array.isArray(b.payslip_ids) ? b.payslip_ids.map((x) => num(x)).filter(Boolean) : [];
  if (!ids.length) return res.status(400).json({ error: 'payslip_ids is required' });
  const rows = await execQ(pool, `
    UPDATE school_payslip SET emailed_at=now(), updated_at=now()
     WHERE app_id=$1 AND id = ANY($2::int[]) AND deleted_at IS NULL RETURNING id
  `, [appId, ids]);
  for (const r of rows) {
    await execQ(pool, `INSERT INTO school_hr_notification (app_id, type, subject, message, reference_id, reference_type, channels, status) VALUES ($1,'payslip_released','Payslip released','Your payslip is available for download.',$2,'payslip','{"email"}','pending')`, [appId, r.id]);
  }
  res.json({ ok: true, queued: rows.length, message: 'Payslip release notifications queued' });
}));

/* ---- bank advice ---- */
hrPayrollRunRouter.get('/hr/payroll/runs/:id/bank-advice', route(async (req, res) => {
  if (!guardView(req, res, 'hr.payroll_view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [run] = await execQ(pool, 'SELECT * FROM school_payroll_run WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, id]);
  if (!run) return res.status(404).json({ error: 'Payroll run not found' });

  const rows = await execQ(pool, `
    SELECT s.employee_code, s.name AS staff_name, b.bank_name, b.account_number, b.ifsc_code, b.account_holder_name,
           p.net_pay, p.status
      FROM school_payslip p
      JOIN school_staff s ON s.id=p.staff_id
      LEFT JOIN school_staff_bank b ON b.app_id=p.app_id AND b.staff_id=p.staff_id AND b.deleted_at IS NULL AND b.is_primary=true
     WHERE p.app_id=$1 AND p.run_id=$2 AND p.deleted_at IS NULL
     ORDER BY s.employee_code
  `, [appId, id]);

  const cols = [
    { key: 'employee_code', label: 'Employee Code' },
    { key: 'staff_name', label: 'Beneficiary' },
    { key: 'account_holder_name', label: 'Account Holder' },
    { key: 'bank_name', label: 'Bank' },
    { key: 'account_number', label: 'Account Number' },
    { key: 'ifsc_code', label: 'IFSC' },
    { key: 'net_pay', label: 'Amount' },
  ];
  if (text(req.query.format) === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="bank-advice-${run.period_name}.csv"`);
    return res.send(toCsv(rows, cols));
  }
  const total = rows.reduce((a, r) => a + n0(r.net_pay), 0);
  res.json({ ok: true, run, rows, total: r2(total), missing_bank: rows.filter((r) => !r.account_number).length });
}));

/* ---- statutory reports for a run ---- */
hrPayrollRunRouter.get('/hr/payroll/runs/:id/statutory-reports', route(async (req, res) => {
  if (!guardView(req, res, 'hr.statutory_reports')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [run] = await execQ(pool, 'SELECT * FROM school_payroll_run WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, id]);
  if (!run) return res.status(404).json({ error: 'Payroll run not found' });

  const rows = await execQ(pool, `
    SELECT s.employee_code, s.name AS staff_name,
           COALESCE(SUM(pl.amount) FILTER (WHERE pl.component_code='PF_EMP'),0) AS pf_employee,
           COALESCE(SUM(pl.amount) FILTER (WHERE pl.component_code='PF_EMPR'),0) AS pf_employer,
           COALESCE(SUM(pl.amount) FILTER (WHERE pl.component_code='ESI_EMP'),0) AS esi_employee,
           COALESCE(SUM(pl.amount) FILTER (WHERE pl.component_code='ESI_EMPR'),0) AS esi_employer,
           COALESCE(SUM(pl.amount) FILTER (WHERE pl.component_code='PT'),0) AS pt,
           COALESCE(SUM(pl.amount) FILTER (WHERE pl.component_code='TDS'),0) AS tds,
           p.gross_earnings, p.net_pay
      FROM school_payslip p
      JOIN school_staff s ON s.id=p.staff_id
      LEFT JOIN school_payslip_line pl ON pl.payslip_id=p.id
     WHERE p.app_id=$1 AND p.run_id=$2 AND p.deleted_at IS NULL
     GROUP BY s.employee_code, s.name, p.gross_earnings, p.net_pay
     ORDER BY s.employee_code
  `, [appId, id]);
  res.json({ ok: true, run, rows });
}));

export default hrPayrollRunRouter;
