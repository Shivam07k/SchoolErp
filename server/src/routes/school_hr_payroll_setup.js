/* HR & Payroll — Payroll Setup Routes */
import express from 'express';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { ensureFoundation, loadAccess } from '../school/foundation.js';

const hrPayrollSetupRouter = express.Router();

hrPayrollSetupRouter.use(verifyToken);

hrPayrollSetupRouter.use(async (req, _res, next) => {
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

function guardPayroll(req, res, perm) {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('hr.payroll_setup') || perms.includes('hr.payroll_assign') || perms.includes('hr.payroll_manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ============================================================
   SALARY COMPONENTS
   ============================================================ */

hrPayrollSetupRouter.get('/hr/payroll/components', route(async (req, res) => {
  if (!guardView(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const rows = await execQ(pool, 'SELECT * FROM school_salary_component WHERE app_id=$1 AND deleted_at IS NULL ORDER BY sort_order, name', [appId]);
  res.json({ ok: true, components: rows });
}));

hrPayrollSetupRouter.post('/hr/payroll/components', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};

  if (!text(b.name) || !text(b.code) || !text(b.type) || !text(b.calculation)) {
    return res.status(400).json({ error: 'Name, code, type and calculation are required' });
  }

  const [row] = await execQ(pool, `
    INSERT INTO school_salary_component (app_id, name, code, type, calculation, formula, base_component_id, value, percent, is_taxable, is_wage_base, is_proratable, is_variable, account_id, sort_order, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *
  `, [appId, text(b.name), text(b.code), text(b.type), text(b.calculation), text(b.formula), num(b.base_component_id), num(b.value), num(b.percent), b.is_taxable === true, b.is_wage_base === true, b.is_proratable !== false, b.is_variable === true, num(b.account_id), num(b.sort_order) || 0, userOf(req)]);

  res.json({ ok: true, component: row });
}));

hrPayrollSetupRouter.put('/hr/payroll/components/:id', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};

  const [row] = await execQ(pool, `
    UPDATE school_salary_component SET
      name=$3, code=$4, type=$5, calculation=$6, formula=$7, base_component_id=$8, value=$9, percent=$10,
      is_taxable=$11, is_wage_base=$12, is_proratable=$13, is_variable=$14, account_id=$15, sort_order=$16, updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appId, id, text(b.name), text(b.code), text(b.type), text(b.calculation), text(b.formula), num(b.base_component_id), num(b.value), num(b.percent), b.is_taxable === true, b.is_wage_base === true, b.is_proratable !== false, b.is_variable === true, num(b.account_id), num(b.sort_order) || 0]);

  if (!row) return res.status(404).json({ error: 'Component not found' });
  res.json({ ok: true, component: row });
}));

hrPayrollSetupRouter.delete('/hr/payroll/components/:id', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  await execQ(pool, 'UPDATE school_salary_component SET deleted_at=now() WHERE app_id=$1 AND id=$2', [appId, num(req.params.id)]);
  res.json({ ok: true });
}));

/* ============================================================
   SALARY STRUCTURES
   ============================================================ */

hrPayrollSetupRouter.get('/hr/payroll/structures', route(async (req, res) => {
  if (!guardView(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const rows = await execQ(pool, 'SELECT * FROM school_salary_structure WHERE app_id=$1 AND deleted_at IS NULL ORDER BY effective_from DESC, name', [appId]);
  res.json({ ok: true, structures: rows });
}));

hrPayrollSetupRouter.post('/hr/payroll/structures', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};

  if (!text(b.name)) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const [row] = await execQ(pool, `
    INSERT INTO school_salary_structure (app_id, name, version, effective_from, effective_to, description, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [appId, text(b.name), num(b.version) || 1, dayOf(b.effective_from), dayOf(b.effective_to), text(b.description), userOf(req)]);

  res.json({ ok: true, structure: row });
}));

hrPayrollSetupRouter.put('/hr/payroll/structures/:id', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};

  const [row] = await execQ(pool, `
    UPDATE school_salary_structure SET
      name=$3, version=$4, effective_from=$5, effective_to=$6, description=$7, is_active=$8, updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appId, id, text(b.name), num(b.version) || 1, dayOf(b.effective_from), dayOf(b.effective_to), text(b.description), b.is_active !== false]);

  if (!row) return res.status(404).json({ error: 'Structure not found' });
  res.json({ ok: true, structure: row });
}));

hrPayrollSetupRouter.delete('/hr/payroll/structures/:id', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  await execQ(pool, 'UPDATE school_salary_structure SET deleted_at=now() WHERE app_id=$1 AND id=$2', [appId, num(req.params.id)]);
  res.json({ ok: true });
}));

hrPayrollSetupRouter.post('/hr/payroll/structures/:id/clone', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const src = await client.query('SELECT * FROM school_salary_structure WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, id]);
    if (!src.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Structure not found' }); }

    const newStruct = await client.query(`
      INSERT INTO school_salary_structure (app_id, name, version, effective_from, effective_to, description, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [appId, text(b.name) || src.rows[0].name + ' (Copy)', 1, new Date().toISOString().slice(0, 10), null, src.rows[0].description, userOf(req)]);

    const lines = await client.query('SELECT * FROM school_salary_structure_line WHERE app_id=$1 AND structure_id=$2 AND deleted_at IS NULL', [appId, id]);
    for (const line of lines.rows) {
      await client.query(`
        INSERT INTO school_salary_structure_line (app_id, structure_id, component_id, value, percent, formula, condition, sort_order, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [appId, newStruct.rows[0].id, line.component_id, line.value, line.percent, line.formula, line.condition, line.sort_order, userOf(req)]);
    }

    await client.query('COMMIT');
    res.json({ ok: true, structure: newStruct.rows[0] });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}));

/* ============================================================
   STRUCTURE LINES
   ============================================================ */

hrPayrollSetupRouter.get('/hr/payroll/structures/:id/lines', route(async (req, res) => {
  if (!guardView(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const rows = await execQ(pool, `
    SELECT l.*, c.name AS component_name, c.code AS component_code, c.type AS component_type, c.calculation, c.is_wage_base
      FROM school_salary_structure_line l
      JOIN school_salary_component c ON c.id=l.component_id
     WHERE l.app_id=$1 AND l.structure_id=$2 AND l.deleted_at IS NULL
     ORDER BY l.sort_order
  `, [appId, num(req.params.id)]);
  res.json({ ok: true, lines: rows });
}));

hrPayrollSetupRouter.post('/hr/payroll/structures/:id/lines', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};

  const [row] = await execQ(pool, `
    INSERT INTO school_salary_structure_line (app_id, structure_id, component_id, value, percent, formula, condition, sort_order, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
  `, [appId, id, num(b.component_id), num(b.value), num(b.percent), text(b.formula), text(b.condition), num(b.sort_order) || 0, userOf(req)]);

  res.json({ ok: true, line: row });
}));

hrPayrollSetupRouter.put('/hr/payroll/structures/lines/:id', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};

  const [row] = await execQ(pool, `
    UPDATE school_salary_structure_line SET
      component_id=$3, value=$4, percent=$5, formula=$6, condition=$7, sort_order=$8, updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appId, id, num(b.component_id), num(b.value), num(b.percent), text(b.formula), text(b.condition), num(b.sort_order) || 0]);

  if (!row) return res.status(404).json({ error: 'Line not found' });
  res.json({ ok: true, line: row });
}));

hrPayrollSetupRouter.delete('/hr/payroll/structures/lines/:id', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  await execQ(pool, 'UPDATE school_salary_structure_line SET deleted_at=now() WHERE app_id=$1 AND id=$2', [appId, num(req.params.id)]);
  res.json({ ok: true });
}));

/* ============================================================
   STAFF SALARY ASSIGNMENTS
   ============================================================ */

hrPayrollSetupRouter.get('/hr/payroll/assignments', route(async (req, res) => {
  if (!guardView(req, res, 'hr.payroll_assign')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const staffId = num(req.query.staff_id);
  const structureId = num(req.query.structure_id);

  let where = ['a.app_id=$1', 'a.deleted_at IS NULL'];
  const values = [appIdOf(req)];

  if (staffId) { values.push(staffId); where.push(`a.staff_id=$${values.length}`); }
  if (structureId) { values.push(structureId); where.push(`a.structure_id=$${values.length}`); }

  const rows = await execQ(pool, `
    SELECT a.*, s.name AS staff_name, s.employee_code, st.name AS structure_name, st.version
      FROM school_staff_salary a
      JOIN school_staff s ON s.id=a.staff_id
      JOIN school_salary_structure st ON st.id=a.structure_id
     WHERE ${where.join(' AND ')}
     ORDER BY a.effective_from DESC
  `, values);

  res.json({ ok: true, assignments: rows });
}));

hrPayrollSetupRouter.post('/hr/payroll/assignments', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_assign')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};

  await execQ(pool, `
    UPDATE school_staff_salary
       SET effective_to = $3 - interval '1 day', updated_at=now()
     WHERE app_id=$1 AND staff_id=$2 AND deleted_at IS NULL
       AND effective_from <= $3 AND (effective_to IS NULL OR effective_to >= $3)
  `, [appId, num(b.staff_id), dayOf(b.effective_from)]);

  const [row] = await execQ(pool, `
    INSERT INTO school_staff_salary (app_id, staff_id, structure_id, overrides, effective_from, effective_to, approved_by, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
  `, [appId, num(b.staff_id), num(b.structure_id), b.overrides || {}, dayOf(b.effective_from), dayOf(b.effective_to), text(b.approved_by), userOf(req)]);

  res.json({ ok: true, assignment: row });
}));

hrPayrollSetupRouter.put('/hr/payroll/assignments/:id', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_assign')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};

  const [row] = await execQ(pool, `
    UPDATE school_staff_salary SET
      structure_id=$3, overrides=$4, effective_from=$5, effective_to=$6, approved_by=$7, updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appId, id, num(b.structure_id), b.overrides || {}, dayOf(b.effective_from), dayOf(b.effective_to), text(b.approved_by)]);

  if (!row) return res.status(404).json({ error: 'Assignment not found' });
  res.json({ ok: true, assignment: row });
}));

hrPayrollSetupRouter.delete('/hr/payroll/assignments/:id', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_assign')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  await execQ(pool, 'UPDATE school_staff_salary SET deleted_at=now() WHERE app_id=$1 AND id=$2', [appId, num(req.params.id)]);
  res.json({ ok: true });
}));

/* ============================================================
   STATUTORY RULES
   ============================================================ */

hrPayrollSetupRouter.get('/hr/payroll/statutory', route(async (req, res) => {
  if (!guardView(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const rows = await execQ(pool, 'SELECT * FROM school_statutory_rule WHERE app_id=$1 AND deleted_at IS NULL ORDER BY rule_code, version', [appId]);
  res.json({ ok: true, rules: rows });
}));

hrPayrollSetupRouter.get('/hr/payroll/statutory/:ruleCode', route(async (req, res) => {
  if (!guardView(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const ruleCode = text(req.params.ruleCode).toUpperCase();
  const rows = await execQ(pool, 'SELECT * FROM school_statutory_rule WHERE app_id=$1 AND rule_code=$2 AND deleted_at IS NULL ORDER BY version DESC', [appId, ruleCode]);
  res.json({ ok: true, rules: rows });
}));

hrPayrollSetupRouter.post('/hr/payroll/statutory', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};

  const [row] = await execQ(pool, `
    INSERT INTO school_statutory_rule (app_id, rule_code, name, version, effective_from, effective_to, config, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
  `, [appId, text(b.rule_code).toUpperCase(), text(b.name), num(b.version) || 1, dayOf(b.effective_from), dayOf(b.effective_to), b.config || {}, userOf(req)]);

  res.json({ ok: true, rule: row });
}));

hrPayrollSetupRouter.put('/hr/payroll/statutory/:id', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};

  const [row] = await execQ(pool, `
    UPDATE school_statutory_rule SET
      name=$3, version=$4, effective_from=$5, effective_to=$6, config=$7, is_active=$8, updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appId, id, text(b.name), num(b.version) || 1, dayOf(b.effective_from), dayOf(b.effective_to), b.config || {}, b.is_active !== false]);

  if (!row) return res.status(404).json({ error: 'Rule not found' });
  res.json({ ok: true, rule: row });
}));

hrPayrollSetupRouter.delete('/hr/payroll/statutory/:id', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  await execQ(pool, 'UPDATE school_statutory_rule SET deleted_at=now() WHERE app_id=$1 AND id=$2', [appId, num(req.params.id)]);
  res.json({ ok: true });
}));

/* ============================================================
   STATUTORY RULE SLABS (for PT, TDS)
   ============================================================ */

hrPayrollSetupRouter.get('/hr/payroll/statutory/:ruleCode/slabs', route(async (req, res) => {
  if (!guardView(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const ruleCode = text(req.params.ruleCode).toUpperCase();

  const rule = await execQ(pool, 'SELECT id FROM school_statutory_rule WHERE app_id=$1 AND rule_code=$2 AND deleted_at IS NULL ORDER BY version DESC LIMIT 1', [appId, text(req.params.ruleCode).toUpperCase()]);
  if (!rule[0]) return res.status(404).json({ error: 'Rule not found' });

  const rows = await execQ(pool, 'SELECT * FROM school_statutory_rule_slab WHERE app_id=$1 AND rule_id=$2 AND deleted_at IS NULL ORDER BY min_amount', [appId, rule[0].id]);
  res.json({ ok: true, slabs: rows });
}));

hrPayrollSetupRouter.post('/hr/payroll/statutory/:ruleCode/slabs', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const ruleCode = text(req.params.ruleCode).toUpperCase();

  const rule = await execQ(pool, 'SELECT id FROM school_statutory_rule WHERE app_id=$1 AND rule_code=$2 AND deleted_at IS NULL ORDER BY version DESC LIMIT 1', [appId, ruleCode]);
  if (!rule[0]) return res.status(404).json({ error: 'Rule not found' });

  const b = req.body || {};
  const [row] = await execQ(pool, `
    INSERT INTO school_statutory_rule_slab (app_id, rule_id, min_amount, max_amount, rate, fixed_amount, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [appId, rule[0].id, num(b.min_amount), num(b.max_amount), num(b.rate), num(b.fixed_amount), userOf(req)]);

  res.json({ ok: true, slab: row });
}));

hrPayrollSetupRouter.put('/hr/payroll/statutory/:ruleCode/slabs/:id', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};

  const [row] = await execQ(pool, `
    UPDATE school_statutory_rule_slab SET
      min_amount=$3, max_amount=$4, rate=$5, fixed_amount=$6, updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appId, num(req.params.id), num(b.min_amount), num(b.max_amount), num(b.rate), num(b.fixed_amount)]);

  if (!row) return res.status(404).json({ error: 'Slab not found' });
  res.json({ ok: true, slab: row });
}));

hrPayrollSetupRouter.delete('/hr/payroll/statutory/:ruleCode/slabs/:id', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  await execQ(pool, 'UPDATE school_statutory_rule_slab SET deleted_at=now() WHERE app_id=$1 AND id=$2', [appId, num(req.params.id)]);
  res.json({ ok: true });
}));

/* ============================================================
   STRUCTURE VALIDATION (wage-base check before assignment)
   ============================================================ */

hrPayrollSetupRouter.post('/hr/payroll/validate-structure', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  const structureId = num(b.structure_id);

  if (!structureId) return res.status(400).json({ error: 'structure_id is required' });

  const [structure] = await execQ(pool, 'SELECT * FROM school_salary_structure WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, structureId]);
  if (!structure) return res.status(404).json({ error: 'Structure not found' });

  const lines = await execQ(pool, `
    SELECT l.*, c.code, c.name, c.type, c.calculation, c.is_wage_base, c.is_proratable
      FROM school_salary_structure_line l
      JOIN school_salary_component c ON c.id=l.component_id AND c.deleted_at IS NULL
     WHERE l.app_id=$1 AND l.structure_id=$2 AND l.deleted_at IS NULL
     ORDER BY l.sort_order, c.sort_order
  `, [appId, structureId]);

  const warnings = [];
  const errors = [];
  const amounts = {};
  let gross = 0;
  let wageBase = 0;

  for (const line of lines) {
    const calc = line.calculation;
    const value = line.value !== null && line.value !== undefined ? Number(line.value) : 0;
    const percent = line.percent !== null && line.percent !== undefined ? Number(line.percent) : 0;
    let amount = 0;
    if (calc === 'fixed') amount = value;
    else if (calc === 'percent') amount = (percent / 100) * (wageBase || 0);
    else if (calc === 'formula') amount = 0;

    if (line.type === 'earning') {
      gross += amount;
      if (line.is_wage_base) wageBase += amount;
    }
    amounts[line.code] = amount;
  }

  if (!lines.length) errors.push('Structure has no components');
  if (!lines.some((l) => l.type === 'earning')) errors.push('Structure has no earning components');
  if (wageBase <= 0) warnings.push('Wage base is zero — PF/ESI may compute as zero');
  if (wageBase > 15000) warnings.push('Wage base exceeds the typical PF ceiling of ₹15,000; PF will be capped');

  res.json({ ok: true, valid: errors.length === 0, structure, errors, warnings, gross, wage_base: wageBase, amounts });
}));

/* ============================================================
   TAX DECLARATIONS
   ============================================================ */

hrPayrollSetupRouter.get('/hr/payroll/tax-declarations', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const fyId = num(req.query.financial_year_id);
  const staffId = num(req.query.staff_id);

  let where = ['td.app_id=$1', 'td.deleted_at IS NULL'];
  const values = [appId];
  if (fyId) { values.push(fyId); where.push(`td.financial_year_id=$${values.length}`); }
  if (staffId) { values.push(staffId); where.push(`td.staff_id=$${values.length}`); }

  const rows = await execQ(pool, `
    SELECT td.*, s.name AS staff_name, s.employee_code, fy.name AS fy_name
      FROM school_tax_declaration td
      JOIN school_staff s ON s.id=td.staff_id
      JOIN school_financial_year fy ON fy.id=td.financial_year_id
     WHERE ${where.join(' AND ')}
     ORDER BY td.declared_at DESC
  `, values);
  res.json({ ok: true, declarations: rows });
}));

hrPayrollSetupRouter.post('/hr/payroll/tax-declarations', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};

  if (!num(b.staff_id) || !num(b.financial_year_id)) {
    return res.status(400).json({ error: 'Staff and financial year are required' });
  }

  const [row] = await execQ(pool, `
    INSERT INTO school_tax_declaration (app_id, staff_id, financial_year_id, regime, section_80c, section_80d, section_80ccd1b, section_24b, professional_tax, other_deductions)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
  `, [appId, num(b.staff_id), num(b.financial_year_id), text(b.regime) || 'new', num(b.section_80c) || 0, num(b.section_80d) || 0, num(b.section_80ccd1b) || 0, num(b.section_24b) || 0, num(b.professional_tax) || 0, b.other_deductions || {}]);

  res.json({ ok: true, declaration: row });
}));

hrPayrollSetupRouter.put('/hr/payroll/tax-declarations/:id', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};

  const [row] = await execQ(pool, `
    UPDATE school_tax_declaration SET
      regime=$3, section_80c=$4, section_80d=$5, section_80ccd1b=$6, section_24b=$7, professional_tax=$8, other_deductions=$9, status=$10, updated_at=now()
     WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appId, id, text(b.regime) || 'new', num(b.section_80c) || 0, num(b.section_80d) || 0, num(b.section_80ccd1b) || 0, num(b.section_24b) || 0, num(b.professional_tax) || 0, b.other_deductions || {}, text(b.status) || 'draft']);

  if (!row) return res.status(404).json({ error: 'Declaration not found' });
  res.json({ ok: true, declaration: row });
}));

hrPayrollSetupRouter.delete('/hr/payroll/tax-declarations/:id', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  await execQ(pool, 'UPDATE school_tax_declaration SET deleted_at=now() WHERE app_id=$1 AND id=$2', [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true });
}));

hrPayrollSetupRouter.post('/hr/payroll/tax-declarations/:id/delete', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  await execQ(pool, 'UPDATE school_tax_declaration SET deleted_at=now() WHERE app_id=$1 AND id=$2', [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true });
}));

hrPayrollSetupRouter.get('/hr/payroll/financial-years', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const rows = await execQ(pool, 'SELECT id, name FROM school_financial_year WHERE app_id=$1 AND deleted_at IS NULL ORDER BY start_date DESC', [appId]);
  res.json({ ok: true, years: rows });
}));

hrPayrollSetupRouter.post('/hr/payroll/financial-years', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  const name = text(b.name);
  const start = dayOf(b.start_date);
  const end = dayOf(b.end_date);
  if (!name || !start || !end) return res.status(400).json({ error: 'name, start_date and end_date are required' });
  if (start > end) return res.status(400).json({ error: 'start_date must be before end_date' });
  const [existing] = await execQ(pool, 'SELECT id FROM school_financial_year WHERE app_id=$1 AND name=$2 AND deleted_at IS NULL', [appId, name]);
  if (existing) return res.status(409).json({ error: 'A financial year with this name already exists' });
  const [row] = await execQ(pool, `
    INSERT INTO school_financial_year (app_id, name, start_date, end_date)
    VALUES ($1,$2,$3,$4) RETURNING id, name, start_date, end_date
  `, [appId, name, start, end]);
  res.json({ ok: true, year: row });
}));

/* Backwards-compatible POST delete aliases (older screens used POST). */
hrPayrollSetupRouter.post('/hr/payroll/components/:id/delete', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  await execQ(pool, 'UPDATE school_salary_component SET deleted_at=now() WHERE app_id=$1 AND id=$2', [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true });
}));

hrPayrollSetupRouter.post('/hr/payroll/structures/:id/delete', route(async (req, res) => {
  if (!guardPayroll(req, res, 'hr.payroll_setup')) return;
  const pool = getPool();
  await execQ(pool, 'UPDATE school_salary_structure SET deleted_at=now() WHERE app_id=$1 AND id=$2', [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true });
}));

export default hrPayrollSetupRouter;