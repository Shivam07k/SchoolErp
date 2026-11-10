/* M16 Fees & Accounts — Backend Routes */
import express from 'express';
import { randomUUID } from 'crypto';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { ensureFoundation, loadAccess } from '../school/foundation.js';

const feeRouter = express.Router();

feeRouter.use(verifyToken);

/* Ensure req.school is set for all routes */
feeRouter.use(async (req, _res, next) => {
  if (!req.school) {
    const pool = getPool();
    const appId = req.user?.company || DEFAULT_COMPANY_ID;
    await ensureFoundation(pool, appId);
    req.school = await loadAccess(pool, appId, req.user);
  }
  next();
});

/* ---- Helpers ---- */
function num(v) { return v === undefined || v === null || v === '' ? null : Number(v); }
function text(v) { return v === undefined || v === null ? null : String(v).trim(); }
function dayOf(v) { return v ? String(v).slice(0, 10) : null; }
function appIdOf(req) { return req.school?.appId || 'default'; }
function guard(req, res, perm) {
  if (!req.school || !req.user) return res.status(401).json({ error: 'Unauthorized' });
  const perms = req.school.permissions || [];
  const alt = perm === 'fee.setup'
    ? ['fees.manage', 'fees.view', 'fee.manage']
    : perm === 'fee.view' ? ['fees.view', 'fees.manage'] : [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || alt.some((p) => perms.includes(p))) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

/* ============================================================
   1. FEE HEADS
   ============================================================ */

feeRouter.get('/fee/heads', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const rows = await execQ(getPool(), `
    SELECT * FROM school_fee_head WHERE app_id=$1 AND deleted_at IS NULL ORDER BY sort_order, name
  `, [appIdOf(req)]);
  res.json({ ok: true, heads: rows });
});

feeRouter.post('/fee/heads', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    INSERT INTO school_fee_head (app_id, name, type, is_taxable, tax_rate, income_account_id, is_refundable, is_active, sort_order, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
  `, [appIdOf(req), text(b.name), text(b.type), b.isTaxable===true, num(b.taxRate)||0, num(b.incomeAccountId), b.isRefundable===true, b.isActive!==false, num(b.sortOrder)||0, text(req.user?.userid)]);
  res.json({ ok: true, head: row[0] });
});

feeRouter.put('/fee/heads/:id', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    UPDATE school_fee_head SET
      name=$3, type=$4, is_taxable=$5, tax_rate=$6, income_account_id=$7, is_refundable=$8, is_active=$9, sort_order=$10, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), text(b.name), text(b.type), b.isTaxable===true, num(b.taxRate)||0, num(b.incomeAccountId), b.isRefundable===true, b.isActive!==false, num(b.sortOrder)||0]);
  res.json({ ok: true, head: row[0] });
});

/* ============================================================
   2. FEE CATEGORIES
   ============================================================ */

feeRouter.get('/fee/categories', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const rows = await execQ(getPool(), `SELECT * FROM school_fee_category WHERE app_id=$1 AND deleted_at IS NULL ORDER BY name`, [appIdOf(req)]);
  res.json({ ok: true, categories: rows });
});

feeRouter.post('/fee/categories', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    INSERT INTO school_fee_category (app_id, name, description, created_by)
    VALUES ($1,$2,$3,$4) RETURNING *
  `, [appIdOf(req), text(b.name), text(b.description), text(req.user?.userid)]);
  res.json({ ok: true, category: row[0] });
});

feeRouter.put('/fee/categories/:id', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    UPDATE school_fee_category SET name=$3, description=$4, is_active=$5, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), text(b.name), text(b.description), b.isActive!==false]);
  res.json({ ok: true, category: row[0] });
});

/* ============================================================
   3. FEE STRUCTURES
   ============================================================ */

feeRouter.get('/fee/structures', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const yearId = num(req.query.academicYearId);
  const where = ['fs.app_id=$1', 'fs.deleted_at IS NULL'];
  const vals = [appIdOf(req)];
  if (yearId) { vals.push(yearId); where.push(`fs.academic_year_id=$${vals.length}`); }
  const rows = await execQ(getPool(), `
    SELECT fs.*, ay.name AS academic_year_name
    FROM school_fee_structure fs
    LEFT JOIN school_academic_years ay ON ay.id=fs.academic_year_id
    WHERE ${where.join(' AND ')}
    ORDER BY fs.effective_from DESC, fs.name
  `, vals);
  res.json({ ok: true, structures: rows });
});

feeRouter.post('/fee/structures', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    INSERT INTO school_fee_structure (app_id, academic_year_id, name, version, effective_from, created_by)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
  `, [appIdOf(req), num(b.academicYearId), text(b.name), num(b.version)||1, dayOf(b.effectiveFrom), text(req.user?.userid)]);
  res.json({ ok: true, structure: row[0] });
});

feeRouter.put('/fee/structures/:id', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    UPDATE school_fee_structure SET
      name=$3, version=$4, effective_from=$5, is_active=$6, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), text(b.name), num(b.version)||1, dayOf(b.effectiveFrom), b.isActive!==false]);
  res.json({ ok: true, structure: row[0] });
});

feeRouter.post('/fee/structures/:id/clone', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const [src] = await client.query('SELECT * FROM school_fee_structure WHERE app_id=$1 AND id=$2', [appIdOf(req), num(req.params.id)]);
    if (!src) throw new Error('Structure not found');
    const newStruct = await client.query(`
      INSERT INTO school_fee_structure (app_id, academic_year_id, name, version, effective_from, created_by)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [appIdOf(req), src.academic_year_id, src.name + ' (Copy)', 1, dayOf(new Date()), text(req.user?.userid)]);
    const lines = await client.query('SELECT * FROM school_fee_structure_line WHERE app_id=$1 AND structure_id=$2 AND deleted_at IS NULL', [appIdOf(req), src.id]);
    for (const line of lines.rows) {
      await client.query(`
        INSERT INTO school_fee_structure_line (app_id, structure_id, class_id, category_id, head_id, amount, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [appIdOf(req), newStruct.rows[0].id, line.class_id, line.category_id, line.head_id, line.amount, text(req.user?.userid)]);
    }
    const inst = await client.query('SELECT * FROM school_installment WHERE app_id=$1 AND structure_id=$2 AND deleted_at IS NULL', [appIdOf(req), src.id]);
    for (const i of inst.rows) {
      await client.query(`
        INSERT INTO school_installment (app_id, structure_id, name, due_date, share_percent, grace_days, sort_order)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [appIdOf(req), newStruct.rows[0].id, i.name, i.due_date, i.share_percent, i.grace_days, i.sort_order]);
    }
    await client.query('COMMIT');
    res.json({ ok: true, structure: newStruct.rows[0] });
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});

/* ============================================================
   4. STRUCTURE LINES
   ============================================================ */

feeRouter.get('/fee/structures/:id/lines', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const rows = await execQ(getPool(), `
    SELECT l.*, c.name AS class_name, cat.name AS category_name, h.name AS head_name, h.type AS head_type
    FROM school_fee_structure_line l
    LEFT JOIN school_classes c ON c.id=l.class_id
    LEFT JOIN school_fee_category cat ON cat.id=l.category_id
    LEFT JOIN school_fee_head h ON h.id=l.head_id
    WHERE l.app_id=$1 AND l.structure_id=$2 AND l.deleted_at IS NULL
    ORDER BY c.sort_order NULLS LAST, c.name, cat.name, h.sort_order
  `, [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true, lines: rows });
});

feeRouter.post('/fee/structures/:id/lines', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    INSERT INTO school_fee_structure_line (app_id, structure_id, class_id, category_id, head_id, amount, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [appIdOf(req), num(req.params.id), num(b.classId), num(b.categoryId), num(b.headId), num(b.amount), text(req.user?.userid)]);
  res.json({ ok: true, line: row[0] });
});

feeRouter.put('/fee/structures/lines/:id', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    UPDATE school_fee_structure_line SET
      class_id=$3, category_id=$4, head_id=$5, amount=$6, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), num(b.classId), num(b.categoryId), num(b.headId), num(b.amount)]);
  res.json({ ok: true, line: row[0] });
});

feeRouter.delete('/fee/structures/lines/:id', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  await execQ(getPool(), `UPDATE school_fee_structure_line SET deleted_at=now() WHERE app_id=$1 AND id=$2`, [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true });
});

/* ============================================================
   5. INSTALLMENTS
   ============================================================ */

feeRouter.get('/fee/installments', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const structureId = num(req.query.structureId);
  const where = ['i.app_id=$1', 'i.deleted_at IS NULL'];
  const vals = [appIdOf(req)];
  if (structureId) { vals.push(structureId); where.push(`i.structure_id=$${vals.length}`); }
  const rows = await execQ(getPool(), `
    SELECT i.*, s.name AS structure_name
    FROM school_installment i
    LEFT JOIN school_fee_structure s ON s.id=i.structure_id
    WHERE ${where.join(' AND ')}
    ORDER BY s.effective_from DESC, i.sort_order
  `, vals);
  res.json({ ok: true, installments: rows });
});

feeRouter.post('/fee/installments', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    INSERT INTO school_installment (app_id, structure_id, name, due_date, share_percent, grace_days, sort_order)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [appIdOf(req), num(b.structureId), text(b.name), dayOf(b.dueDate), num(b.sharePercent), num(b.graceDays)||0, num(b.sortOrder)||0]);
  res.json({ ok: true, installment: row[0] });
});

feeRouter.put('/fee/installments/:id', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    UPDATE school_installment SET
      name=$3, due_date=$4, share_percent=$5, grace_days=$6, sort_order=$7, is_active=$8, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), text(b.name), dayOf(b.dueDate), num(b.sharePercent), num(b.graceDays)||0, num(b.sortOrder)||0, b.isActive!==false]);
  res.json({ ok: true, installment: row[0] });
});

feeRouter.delete('/fee/installments/:id', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  await execQ(getPool(), 'UPDATE school_installment SET deleted_at=now() WHERE app_id=$1 AND id=$2', [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true });
});

/* ============================================================
   6. FINE RULES
   ============================================================ */

feeRouter.get('/fee/fine-rules', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const rows = await execQ(getPool(), `
    SELECT fr.*, h.name AS head_name, i.name AS installment_name
    FROM school_fine_rule fr
    LEFT JOIN school_fee_head h ON h.id=fr.head_id
    LEFT JOIN school_installment i ON i.id=fr.installment_id
    WHERE fr.app_id=$1 AND fr.deleted_at IS NULL
    ORDER BY fr.name
  `, [appIdOf(req)]);
  res.json({ ok: true, fineRules: rows });
});

feeRouter.post('/fee/fine-rules', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    INSERT INTO school_fine_rule (app_id, name, scope, head_id, installment_id, grace_days, type, flat_amount, per_day_amount, percent_rate, cap_amount, waiver_allowed, waiver_roles)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *
  `, [appIdOf(req), text(b.name), text(b.scope), num(b.headId), num(b.installmentId), num(b.graceDays)||0, text(b.type), num(b.flatAmount), num(b.perDayAmount), num(b.percentRate), num(b.capAmount), b.waiverAllowed!==false, b.waiverRoles||[]]);
  res.json({ ok: true, fineRule: row[0] });
});

feeRouter.put('/fee/fine-rules/:id', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    UPDATE school_fine_rule SET
      name=$3, scope=$4, head_id=$4, installment_id=$5, grace_days=$6, type=$7, flat_amount=$8, per_day_amount=$9, percent_rate=$10, cap_amount=$11, waiver_allowed=$12, waiver_roles=$13, is_active=$14, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), text(b.name), text(b.scope), num(b.headId), num(b.installmentId), num(b.graceDays)||0, text(b.type), num(b.flatAmount), num(b.perDayAmount), num(b.percentRate), num(b.capAmount), b.waiverAllowed!==false, b.waiverRoles||[], b.isActive!==false]);
  res.json({ ok: true, fineRule: row[0] });
});

feeRouter.delete('/fee/fine-rules/:id', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  await execQ(getPool(), 'UPDATE school_fine_rule SET deleted_at=now() WHERE app_id=$1 AND id=$2', [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true });
});

/* ============================================================
   7. CONCESSION TYPES
   ============================================================ */

feeRouter.get('/fee/concession-types', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const rows = await execQ(getPool(), `
    SELECT ct.*, h.name AS head_name
    FROM school_concession_type ct
    LEFT JOIN school_fee_head h ON h.id=ct.head_id
    WHERE ct.app_id=$1 AND ct.deleted_at IS NULL
    ORDER BY ct.name
  `, [appIdOf(req)]);
  res.json({ ok: true, concessionTypes: rows });
});

feeRouter.post('/fee/concession-types', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    INSERT INTO school_concession_type (app_id, name, rule_type, rule_value, head_scope, head_id, approval_required, approval_roles, max_amount, validity_from, validity_to)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
  `, [appIdOf(req), text(b.name), text(b.ruleType), num(b.ruleValue), text(b.headScope), num(b.headId), b.approvalRequired===true, b.approvalRoles||[], num(b.maxAmount), dayOf(b.validityFrom), dayOf(b.validityTo)]);
  res.json({ ok: true, concessionType: row[0] });
});

feeRouter.put('/fee/concession-types/:id', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    UPDATE school_concession_type SET
      name=$3, rule_type=$4, rule_value=$5, head_scope=$6, head_id=$7, approval_required=$8, approval_roles=$9, max_amount=$10, validity_from=$11, validity_to=$12, is_active=$13, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), text(b.name), text(b.ruleType), num(b.ruleValue), text(b.headScope), num(b.headId), b.approvalRequired===true, b.approvalRoles||[], num(b.maxAmount), dayOf(b.validityFrom), dayOf(b.validityTo), b.isActive!==false]);
  res.json({ ok: true, concessionType: row[0] });
});

feeRouter.delete('/fee/concession-types/:id', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  await execQ(getPool(), 'UPDATE school_concession_type SET deleted_at=now() WHERE app_id=$1 AND id=$2', [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true });
});

/* ============================================================
   8. STUDENT FEE ASSIGNMENTS
   ============================================================ */

feeRouter.get('/fee/student-assignments', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const studentId = num(req.query.studentId);
  const classId = num(req.query.classId);
  const yearId = num(req.query.academicYearId);
  const where = ['sa.app_id=$1', 'sa.deleted_at IS NULL'];
  const vals = [appIdOf(req)];
  if (studentId) { vals.push(studentId); where.push(`sa.student_id=$${vals.length}`); }
  if (classId) { vals.push(classId); where.push(`s.class_id=$${vals.length}`); }
  if (yearId) { vals.push(yearId); where.push(`sa.academic_year_id=$${vals.length}`); }
  const rows = await execQ(getPool(), `
    SELECT sa.*, s.admission_no, s.first_name, s.last_name, s.class_id, s.section_id, fsc.name AS structure_name, fc.name AS category_name
    FROM school_student_fee_assignment sa
    JOIN school_students s ON s.id=sa.student_id AND s.app_id=sa.app_id
    LEFT JOIN school_fee_structure fsc ON fsc.id=sa.structure_id
    LEFT JOIN school_fee_category fc ON fc.id=sa.category_id
    WHERE ${where.join(' AND ')}
    ORDER BY s.roll_no NULLS LAST, s.first_name
  `, vals);
  res.json({ ok: true, studentAssignments: rows });
});

feeRouter.post('/fee/student-assignments', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const b = req.body || {};
  const items = Array.isArray(b.items) ? b.items : [b];
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const results = [];
    for (const item of items) {
      const row = await client.query(`
        INSERT INTO school_student_fee_assignment (app_id, student_id, structure_id, category_id, effective_from, effective_to, transport_stop_id, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (app_id, student_id, effective_from) DO UPDATE SET
          structure_id=EXCLUDED.structure_id, category_id=EXCLUDED.category_id, effective_to=EXCLUDED.effective_to, transport_stop_id=EXCLUDED.transport_stop_id, updated_at=now()
        RETURNING *
      `, [appIdOf(req), num(item.studentId), num(item.structureId), num(item.categoryId), dayOf(item.effectiveFrom), dayOf(item.effectiveTo), num(item.transportStopId), text(req.user?.userid)]);
      results.push(row[0]);
    }
    await client.query('COMMIT');
    res.json({ ok: true, studentAssignments: results });
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});

feeRouter.put('/fee/student-assignments/:id', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    UPDATE school_student_fee_assignment SET
      structure_id=$3, category_id=$4, effective_from=$5, effective_to=$6, transport_stop_id=$7, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), num(b.structureId), num(b.categoryId), dayOf(b.effectiveFrom), dayOf(b.effectiveTo), num(b.transportStopId)]);
  res.json({ ok: true, studentAssignment: row[0] });
});

/* ============================================================
   9. FAMILIES
   ============================================================ */

feeRouter.get('/fee/families', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const rows = await execQ(getPool(), `
    SELECT f.*, COUNT(fm.student_id) AS member_count
    FROM school_family f
    LEFT JOIN school_family_member fm ON fm.family_id=f.id AND fm.deleted_at IS NULL
    WHERE f.app_id=$1 AND f.deleted_at IS NULL
    GROUP BY f.id
    ORDER BY f.guardian_name
  `, [appIdOf(req)]);
  res.json({ ok: true, families: rows });
});

feeRouter.post('/fee/families', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    INSERT INTO school_family (app_id, guardian_name, guardian_phone, guardian_email, created_by)
    VALUES ($1,$2,$3,$4,$5) RETURNING *
  `, [appIdOf(req), text(b.guardianName), text(b.guardianPhone), text(b.guardianEmail), text(req.user?.userid)]);
  res.json({ ok: true, family: row[0] });
});

feeRouter.post('/fee/families/:id/members', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    INSERT INTO school_family_member (app_id, family_id, student_id, is_primary, created_by)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (app_id, student_id) DO UPDATE SET family_id=EXCLUDED.family_id, is_primary=EXCLUDED.is_primary, updated_at=now()
    RETURNING *
  `, [appIdOf(req), num(req.params.id), num(b.studentId), b.isPrimary===true, text(req.user?.userid)]);
  res.json({ ok: true, member: row[0] });
});

feeRouter.delete('/fee/families/:familyId/members/:studentId', async (req, res) => {
  if (!guard(req, res, 'fee.setup')) return;
  await execQ(getPool(), 'UPDATE school_family_member SET deleted_at=now() WHERE app_id=$1 AND family_id=$2 AND student_id=$3', [appIdOf(req), num(req.params.familyId), num(req.params.studentId)]);
  res.json({ ok: true });
});

/* ============================================================
   EXPORT
   ============================================================ */

export const schoolFeeRouter = feeRouter;