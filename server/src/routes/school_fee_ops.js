/* M16 Fees & Accounts — operational routes
   Collection, dues, refunds, reconciliation and accounts.
   These complement school_fee.js (setup/master data). */
import express from 'express';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { ensureFoundation, loadAccess } from '../school/foundation.js';

const feeOpsRouter = express.Router();

feeOpsRouter.use(verifyToken);

/* Ensure req.school is set for all routes */
feeOpsRouter.use(async (req, _res, next) => {
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
const dayOf = (v) => (v ? String(v).slice(0, 10) : null);
const appIdOf = (req) => req.school?.appId || 'default';
const userOf = (req) => req.user?.userid || req.user?.id || 'system';

function guard(req, res, perm) {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  const alt = perm === 'fees.view' ? 'fee.view' : perm === 'fees.manage' ? 'fee.manage' : null;
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || (alt && perms.includes(alt))) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function nextNumber(prefix, count) {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(4, '0')}`;
}

const STUDENT_COLUMNS = `
  st.admission_no, st.first_name, st.last_name, st.roll_no,
  c.name AS class_name, sec.name AS section_name`;

const STUDENT_JOINS = `
  JOIN school_students st ON st.id = i.student_id
  LEFT JOIN school_classes c ON c.id = st.class_id
  LEFT JOIN school_sections sec ON sec.id = st.section_id`;

/* ============================================================
   1. INVOICES & COLLECTION
   ============================================================ */

feeOpsRouter.get('/fee/collection', route(async (req, res) => {
  if (!guard(req, res, 'fees.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const values = [appId];
  const where = ['i.app_id=$1', 'i.deleted_at IS NULL'];
  if (text(req.query.status)) { values.push(text(req.query.status)); where.push(`i.status=$${values.length}`); }
  if (text(req.query.search)) {
    values.push(`%${text(req.query.search)}%`);
    where.push(`(st.admission_no ILIKE $${values.length} OR st.first_name ILIKE $${values.length} OR st.last_name ILIKE $${values.length} OR i.number ILIKE $${values.length})`);
  }

  const invoices = await execQ(pool, `
    SELECT i.*, ${STUDENT_COLUMNS},
           (i.total_amount - i.paid_amount - i.concession_amount + i.fine_amount) AS balance_due,
           (i.due_date < current_date AND i.status IN ('issued','partly_paid')) AS is_overdue
      FROM school_invoice i ${STUDENT_JOINS}
     WHERE ${where.join(' AND ')}
     ORDER BY i.due_date DESC, i.id DESC LIMIT 250
  `, values);

  const [summary] = await execQ(pool, `
    SELECT coalesce(sum(i.total_amount),0) AS billed,
           coalesce(sum(i.paid_amount),0) AS collected,
           coalesce(sum(i.balance),0) AS outstanding,
           coalesce(sum(i.balance) FILTER (WHERE i.due_date < current_date),0) AS overdue,
           count(*)::int AS total_invoices,
           count(*) FILTER (WHERE i.status='issued')::int AS issued,
           count(*) FILTER (WHERE i.status='partly_paid')::int AS partly_paid,
           count(*) FILTER (WHERE i.status='paid')::int AS paid
      FROM school_invoice i
     WHERE i.app_id=$1 AND i.deleted_at IS NULL AND i.status <> 'cancelled'
  `, [appId]);

  const receipts = await execQ(pool, `
    SELECT r.*, st.admission_no, st.first_name, st.last_name, c.name AS class_name
      FROM school_receipt r
      LEFT JOIN school_students st ON st.id = r.student_id
      LEFT JOIN school_classes c ON c.id = st.class_id
     WHERE r.app_id=$1 AND r.deleted_at IS NULL
     ORDER BY r.date DESC, r.id DESC LIMIT 60
  `, [appId]);

  const [today] = await execQ(pool, `
    SELECT coalesce(sum(amount),0) AS amount, count(*)::int AS count
      FROM school_receipt
     WHERE app_id=$1 AND deleted_at IS NULL AND status IN ('issued','cleared') AND date=current_date
  `, [appId]);

  const heads = await execQ(pool, `
    SELECT id, name, type FROM school_fee_head
     WHERE app_id=$1 AND deleted_at IS NULL AND is_active=true ORDER BY sort_order, name
  `, [appId]);

  res.json({ ok: true, invoices, receipts, summary, today, heads });
}));

feeOpsRouter.post('/fee/invoices', route(async (req, res) => {
  if (!guard(req, res, 'fees.manage')) return;
  const client = await getPool().connect();
  try {
    const appId = appIdOf(req);
    const b = req.body || {};
    const studentId = num(b.studentId);
    const total = Number(b.amount);
    const dueDate = dayOf(b.dueDate);
    if (!studentId || !Number.isFinite(total) || total <= 0 || !dueDate) {
      return res.status(400).json({ error: 'Student, amount and due date are required' });
    }

    await client.query('BEGIN');
    const student = await client.query('SELECT id FROM school_students WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, studentId]);
    if (!student.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Student not found' }); }

    const cnt = await client.query('SELECT count(*)::int AS n FROM school_invoice WHERE app_id=$1', [appId]);
    const number = text(b.number) || nextNumber('INV', cnt.rows[0].n);
    const installmentId = num(b.installmentId);

    const inv = await client.query(`
      INSERT INTO school_invoice (app_id, student_id, installment_id, number, date, due_date, status, total_amount, concession_amount, fine_amount, created_by)
      VALUES ($1,$2,$3,$4,coalesce($5,current_date),$6,'issued',$7,$8,$9,$10) RETURNING *
    `, [appId, studentId, installmentId, number, dayOf(b.date), dueDate, total, num(b.concessionAmount) || 0, num(b.fineAmount) || 0, userOf(req)]);

    const headId = num(b.headId);
    if (headId) {
      await client.query(`
        INSERT INTO school_invoice_line (app_id, invoice_id, head_id, amount)
        VALUES ($1,$2,$3,$4)
      `, [appId, inv.rows[0].id, headId, total]);
    }
    await client.query('COMMIT');
    res.json({ ok: true, invoice: inv.rows[0] });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}));

feeOpsRouter.post('/fee/invoices/:id/cancel', route(async (req, res) => {
  if (!guard(req, res, 'fees.manage')) return;
  const [row] = await execQ(getPool(), `
    UPDATE school_invoice
       SET status='cancelled', cancelled_by=$3, cancelled_at=now(), cancelled_reason=$4, updated_at=now()
     WHERE app_id=$1 AND id=$2 AND status IN ('issued','partly_paid','draft') AND deleted_at IS NULL
     RETURNING *
  `, [appIdOf(req), num(req.params.id), userOf(req), text(req.body?.reason)]);
  if (!row) return res.status(404).json({ error: 'Invoice not found or cannot be cancelled' });
  res.json({ ok: true, invoice: row });
}));

feeOpsRouter.post('/fee/receipts', route(async (req, res) => {
  if (!guard(req, res, 'fees.manage')) return;
  const client = await getPool().connect();
  try {
    const appId = appIdOf(req);
    const b = req.body || {};
    const invoiceId = num(b.invoiceId);
    const amount = Number(b.amount);
    const mode = text(b.mode) || 'cash';
    if (!invoiceId || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invoice and a positive amount are required' });
    }
    await client.query('BEGIN');
    const invRes = await client.query('SELECT * FROM school_invoice WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL FOR UPDATE', [appId, invoiceId]);
    const invoice = invRes.rows[0];
    if (!invoice) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Invoice not found' }); }
    if (['cancelled', 'written_off', 'paid'].includes(invoice.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Invoice is ${invoice.status}` });
    }
    const balance = Number(invoice.balance);
    if (amount > balance + 0.001) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Amount exceeds balance of ${balance.toFixed(2)}` });
    }

    const cnt = await client.query('SELECT count(*)::int AS n FROM school_receipt WHERE app_id=$1', [appId]);
    const number = text(b.number) || nextNumber('RCPT', cnt.rows[0].n);
    const receipt = await client.query(`
      INSERT INTO school_receipt (app_id, student_id, number, date, mode, amount, status, reference, cashier_id, created_by)
      VALUES ($1,$2,$3,coalesce($4,current_date),$5,$6,'issued',$7,$8,$9) RETURNING *
    `, [appId, invoice.student_id, number, dayOf(b.date), mode, amount, text(b.reference), userOf(req), userOf(req)]);

    /* Allocate to invoice lines proportionally when lines exist. */
    const lines = await client.query('SELECT * FROM school_invoice_line WHERE app_id=$1 AND invoice_id=$2 AND deleted_at IS NULL', [appId, invoice.id]);
    if (lines.rows.length) {
      const totalLine = lines.rows.reduce((s, l) => s + Number(l.amount), 0) || 1;
      for (const line of lines.rows) {
        const share = Number(((Number(line.amount) / totalLine) * amount).toFixed(2));
        if (share > 0) {
          await client.query('INSERT INTO school_receipt_allocation (app_id, receipt_id, invoice_line_id, amount) VALUES ($1,$2,$3,$4)',
            [appId, receipt.rows[0].id, line.id, share]);
        }
      }
    }

    const updated = await client.query(`
      UPDATE school_invoice
         SET paid_amount = paid_amount + $3,
             status = CASE WHEN paid_amount + $3 >= total_amount - concession_amount + fine_amount THEN 'paid'
                           WHEN paid_amount + $3 > 0 THEN 'partly_paid' ELSE 'issued' END,
             updated_at = now()
       WHERE app_id=$1 AND id=$2 RETURNING *
    `, [appId, invoiceId, amount]);

    const ledgerBalance = await client.query(`
      SELECT coalesce(sum(debit - credit),0) AS bal FROM school_ledger_entry
       WHERE app_id=$1 AND student_id=$2 AND deleted_at IS NULL
    `, [appId, invoice.student_id]);
    const newBalance = Number(ledgerBalance.rows[0].bal || 0) - amount;
    await client.query(`
      INSERT INTO school_ledger_entry (app_id, student_id, date, type, debit, credit, balance, source_type, source_id, created_by)
      VALUES ($1,$2,coalesce($3,current_date),'payment',0,$4,$5,'receipt',$6,$7)
    `, [appId, invoice.student_id, dayOf(b.date), amount, newBalance, receipt.rows[0].id, userOf(req)]);

    await client.query('COMMIT');
    res.json({ ok: true, receipt: receipt.rows[0], invoice: updated.rows[0] });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}));

/* ============================================================
   2. FEE SETUP OVERVIEW
   ============================================================ */

feeOpsRouter.get('/fee/setup-overview', route(async (req, res) => {
  if (!guard(req, res, 'fees.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const [counts] = await execQ(pool, `
    SELECT
      (SELECT count(*)::int FROM school_fee_head WHERE app_id=$1 AND deleted_at IS NULL) AS heads,
      (SELECT count(*)::int FROM school_fee_category WHERE app_id=$1 AND deleted_at IS NULL) AS categories,
      (SELECT count(*)::int FROM school_fee_structure WHERE app_id=$1 AND deleted_at IS NULL) AS structures,
      (SELECT count(*)::int FROM school_installment WHERE app_id=$1 AND deleted_at IS NULL) AS installments,
      (SELECT count(*)::int FROM school_fine_rule WHERE app_id=$1 AND deleted_at IS NULL) AS fine_rules,
      (SELECT count(*)::int FROM school_concession_type WHERE app_id=$1 AND deleted_at IS NULL) AS concessions,
      (SELECT count(*)::int FROM school_student_fee_assignment WHERE app_id=$1 AND deleted_at IS NULL) AS assignments,
      (SELECT count(*)::int FROM school_family WHERE app_id=$1 AND deleted_at IS NULL) AS families
  `, [appId]);
  const recentHeads = await execQ(pool, `
    SELECT id, name, type, is_active FROM school_fee_head WHERE app_id=$1 AND deleted_at IS NULL ORDER BY id DESC LIMIT 8
  `, [appId]);
  const structures = await execQ(pool, `
    SELECT fs.id, fs.name, fs.version, fs.effective_from, fs.is_active,
           (SELECT count(*)::int FROM school_fee_structure_line l WHERE l.structure_id=fs.id AND l.deleted_at IS NULL) AS line_count
      FROM school_fee_structure fs
     WHERE fs.app_id=$1 AND fs.deleted_at IS NULL ORDER BY fs.effective_from DESC LIMIT 8
  `, [appId]);
  res.json({ ok: true, counts, recentHeads, structures });
}));

/* ============================================================
   3. DUES & FOLLOW-UP
   ============================================================ */

feeOpsRouter.get('/fee/dues', route(async (req, res) => {
  if (!guard(req, res, 'fees.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);

  const [summary] = await execQ(pool, `
    SELECT coalesce(sum(balance),0) AS outstanding,
           coalesce(sum(balance) FILTER (WHERE due_date < current_date),0) AS overdue,
           count(DISTINCT student_id)::int AS students_with_dues,
           count(*) FILTER (WHERE due_date < current_date)::int AS overdue_invoices,
           coalesce(avg(current_date - due_date) FILTER (WHERE due_date < current_date),0)::int AS avg_days_overdue
      FROM school_invoice
     WHERE app_id=$1 AND deleted_at IS NULL AND status IN ('issued','partly_paid') AND balance > 0
  `, [appId]);

  const ageing = await execQ(pool, `
    SELECT
      coalesce(sum(balance) FILTER (WHERE current_date - due_date <= 30),0) AS d0_30,
      coalesce(sum(balance) FILTER (WHERE current_date - due_date BETWEEN 31 AND 60),0) AS d31_60,
      coalesce(sum(balance) FILTER (WHERE current_date - due_date BETWEEN 61 AND 90),0) AS d61_90,
      coalesce(sum(balance) FILTER (WHERE current_date - due_date > 90),0) AS d90_plus
      FROM school_invoice
     WHERE app_id=$1 AND deleted_at IS NULL AND status IN ('issued','partly_paid') AND balance > 0
  `, [appId]);

  const defaulters = await execQ(pool, `
    SELECT st.id AS student_id, st.admission_no, st.first_name, st.last_name,
           c.name AS class_name, sec.name AS section_name,
           count(i.id)::int AS invoice_count,
           coalesce(sum(i.balance),0) AS total_due,
           min(i.due_date) AS oldest_due,
           max(current_date - i.due_date)::int AS days_overdue,
           st.guardian_name, st.guardian_phone
      FROM school_invoice i
      JOIN school_students st ON st.id=i.student_id
      LEFT JOIN school_classes c ON c.id=st.class_id
      LEFT JOIN school_sections sec ON sec.id=st.section_id
     WHERE i.app_id=$1 AND i.deleted_at IS NULL AND i.status IN ('issued','partly_paid') AND i.balance > 0
     GROUP BY st.id, st.admission_no, st.first_name, st.last_name, c.name, sec.name, st.guardian_name, st.guardian_phone
     ORDER BY total_due DESC LIMIT 100
  `, [appId]);

  const followUps = await execQ(pool, `
    SELECT f.*, st.admission_no, st.first_name, st.last_name
      FROM school_follow_up f
      LEFT JOIN school_students st ON st.id=f.student_id
     WHERE f.app_id=$1 AND f.deleted_at IS NULL
     ORDER BY f.date DESC, f.id DESC LIMIT 60
  `, [appId]);

  const reminderRules = await execQ(pool, `
    SELECT * FROM school_reminder_rule WHERE app_id=$1 AND deleted_at IS NULL ORDER BY days, name
  `, [appId]);

  const plans = await execQ(pool, `
    SELECT p.*, st.admission_no, st.first_name, st.last_name
      FROM school_payment_plan p
      LEFT JOIN school_students st ON st.id=p.student_id
     WHERE p.app_id=$1 AND p.deleted_at IS NULL
     ORDER BY p.created_at DESC LIMIT 40
  `, [appId]);

  res.json({ ok: true, summary, ageing: ageing[0] || {}, defaulters, followUps, reminderRules, plans });
}));

feeOpsRouter.post('/fee/follow-ups', route(async (req, res) => {
  if (!guard(req, res, 'fees.manage')) return;
  const b = req.body || {};
  if (!num(b.studentId)) return res.status(400).json({ error: 'Student is required' });
  const [row] = await execQ(getPool(), `
    INSERT INTO school_follow_up (app_id, student_id, date, by_user, mode, note, promise_date, promise_amount, outcome)
    VALUES ($1,$2,coalesce($3,current_date),$4,$5,$6,$7,$8,$9) RETURNING *
  `, [appIdOf(req), num(b.studentId), dayOf(b.date), userOf(req), text(b.mode) || 'call', text(b.note), dayOf(b.promiseDate), num(b.promiseAmount), text(b.outcome)]);
  res.json({ ok: true, followUp: row });
}));

feeOpsRouter.post('/fee/reminders', route(async (req, res) => {
  if (!guard(req, res, 'fees.manage')) return;
  const b = req.body || {};
  const studentId = num(b.studentId);
  if (!studentId) return res.status(400).json({ error: 'Student is required' });
  const [row] = await execQ(getPool(), `
    INSERT INTO school_reminder_log (app_id, rule_id, student_id, channel, status, created_at)
    VALUES ($1,$2,$3,$4,'sent',now()) RETURNING *
  `, [appIdOf(req), num(b.ruleId), studentId, text(b.channel) || 'sms']);
  res.json({ ok: true, reminder: row });
}));

feeOpsRouter.post('/fee/reminder-rules', route(async (req, res) => {
  if (!guard(req, res, 'fees.manage')) return;
  const b = req.body || {};
  const [row] = await execQ(getPool(), `
    INSERT INTO school_reminder_rule (app_id, name, trigger_type, days, channel, template, is_active)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [appIdOf(req), text(b.name) || 'Fee reminder', text(b.triggerType) || 'after_due', num(b.days) || 0, text(b.channel) || 'sms', text(b.template), b.isActive !== false]);
  res.json({ ok: true, rule: row });
}));

/* ============================================================
   4. REFUNDS
   ============================================================ */

feeOpsRouter.get('/fee/refunds', route(async (req, res) => {
  if (!guard(req, res, 'fees.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const [summary] = await execQ(pool, `
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE status='pending')::int AS pending,
           count(*) FILTER (WHERE status='approved')::int AS approved,
           count(*) FILTER (WHERE status='paid')::int AS paid,
           coalesce(sum(net_amount) FILTER (WHERE status='paid'),0) AS paid_amount,
           coalesce(sum(net_amount) FILTER (WHERE status IN ('pending','approved')),0) AS open_amount
      FROM school_refund_request WHERE app_id=$1 AND deleted_at IS NULL
  `, [appId]);
  const requests = await execQ(pool, `
    SELECT r.*, st.admission_no, st.first_name, st.last_name, c.name AS class_name
      FROM school_refund_request r
      LEFT JOIN school_students st ON st.id=r.student_id
      LEFT JOIN school_classes c ON c.id=st.class_id
     WHERE r.app_id=$1 AND r.deleted_at IS NULL
     ORDER BY r.requested_at DESC LIMIT 100
  `, [appId]);
  const rules = await execQ(pool, `
    SELECT rr.*, h.name AS head_name, cat.name AS category_name
      FROM school_refund_rule rr
      LEFT JOIN school_fee_head h ON h.id=rr.head_id
      LEFT JOIN school_fee_category cat ON cat.id=rr.category_id
     WHERE rr.app_id=$1 AND rr.deleted_at IS NULL ORDER BY rr.reason_type
  `, [appId]);
  const creditNotes = await execQ(pool, `
    SELECT cn.*, st.admission_no, st.first_name, st.last_name
      FROM school_credit_note cn
      LEFT JOIN school_students st ON st.id=cn.student_id
     WHERE cn.app_id=$1 AND cn.deleted_at IS NULL ORDER BY cn.created_at DESC LIMIT 50
  `, [appId]);
  const deposits = await execQ(pool, `
    SELECT d.*, st.admission_no, st.first_name, st.last_name, h.name AS head_name
      FROM school_deposit d
      LEFT JOIN school_students st ON st.id=d.student_id
      LEFT JOIN school_fee_head h ON h.id=d.head_id
     WHERE d.app_id=$1 AND d.deleted_at IS NULL ORDER BY d.created_at DESC LIMIT 50
  `, [appId]);
  res.json({ ok: true, summary, requests, rules, creditNotes, deposits });
}));

feeOpsRouter.post('/fee/refunds', route(async (req, res) => {
  if (!guard(req, res, 'fees.manage')) return;
  const b = req.body || {};
  const studentId = num(b.studentId);
  const requested = Number(b.requestedAmount);
  if (!studentId || !Number.isFinite(requested) || requested <= 0) {
    return res.status(400).json({ error: 'Student and a positive requested amount are required' });
  }
  const deductions = Number(b.deductions) || 0;
  const net = requested - deductions;
  const [row] = await execQ(getPool(), `
    INSERT INTO school_refund_request
      (app_id, student_id, reason_type, reason_text, requested_amount, calculated_amount, deductions, net_amount, status, requested_by, requested_at)
    VALUES ($1,$2,$3,$4,$5,$5,$6,$7,'pending',$8,now()) RETURNING *
  `, [appIdOf(req), studentId, text(b.reasonType) || 'withdrawal', text(b.reasonText), requested, deductions, net, userOf(req)]);
  res.json({ ok: true, refund: row });
}));

feeOpsRouter.post('/fee/refunds/:id/approve', route(async (req, res) => {
  if (!guard(req, res, 'fees.manage')) return;
  const [row] = await execQ(getPool(), `
    UPDATE school_refund_request
       SET status='approved', approved_by=$3, approved_at=now(), approval_notes=$4, updated_at=now()
     WHERE app_id=$1 AND id=$2 AND status='pending' AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), num(req.params.id), userOf(req), text(req.body?.notes)]);
  if (!row) return res.status(404).json({ error: 'Pending refund not found' });
  res.json({ ok: true, refund: row });
}));

feeOpsRouter.post('/fee/refunds/:id/reject', route(async (req, res) => {
  if (!guard(req, res, 'fees.manage')) return;
  const [row] = await execQ(getPool(), `
    UPDATE school_refund_request
       SET status='rejected', rejected_by=$3, rejected_at=now(), rejection_reason=$4, updated_at=now()
     WHERE app_id=$1 AND id=$2 AND status='pending' AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), num(req.params.id), userOf(req), text(req.body?.reason)]);
  if (!row) return res.status(404).json({ error: 'Pending refund not found' });
  res.json({ ok: true, refund: row });
}));

feeOpsRouter.post('/fee/refunds/:id/pay', route(async (req, res) => {
  if (!guard(req, res, 'fees.manage')) return;
  const b = req.body || {};
  const [row] = await execQ(getPool(), `
    UPDATE school_refund_request
       SET status='paid', paid_by=$3, paid_at=now(), payout_mode=$4, payout_reference=$5, updated_at=now()
     WHERE app_id=$1 AND id=$2 AND status='approved' AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), num(req.params.id), userOf(req), text(b.payoutMode) || 'bank_transfer', text(b.payoutReference)]);
  if (!row) return res.status(404).json({ error: 'Approved refund not found' });
  res.json({ ok: true, refund: row });
}));

/* ============================================================
   5. RECONCILIATION
   ============================================================ */

feeOpsRouter.get('/fee/reconciliation', route(async (req, res) => {
  if (!guard(req, res, 'fees.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const [summary] = await execQ(pool, `
    SELECT
      (SELECT count(*)::int FROM school_cashier_day WHERE app_id=$1 AND deleted_at IS NULL AND status<>'closed' AND date=current_date) AS open_cashier_days,
      (SELECT coalesce(sum(amount),0) FROM school_cheque WHERE app_id=$1 AND deleted_at IS NULL AND status IN ('pending','deposited')) AS cheques_in_hand,
      (SELECT count(*)::int FROM school_cheque WHERE app_id=$1 AND deleted_at IS NULL AND status='bounced') AS bounced_cheques,
      (SELECT coalesce(sum(net_amount),0) FROM school_gateway_settlement WHERE app_id=$1 AND deleted_at IS NULL AND status='matched') AS settled_amount,
      (SELECT count(*)::int FROM school_gateway_settlement WHERE app_id=$1 AND deleted_at IS NULL AND status='imported') AS unmatched_settlements,
      (SELECT count(*)::int FROM school_match_exception WHERE app_id=$1 AND deleted_at IS NULL AND status='open') AS open_exceptions,
      (SELECT count(*)::int FROM school_bank_statement_line WHERE app_id=$1 AND deleted_at IS NULL AND matched_flag=false) AS unmatched_bank_lines
  `, [appId]);

  const cashierDays = await execQ(pool, `
    SELECT * FROM school_cashier_day WHERE app_id=$1 AND deleted_at IS NULL ORDER BY date DESC, id DESC LIMIT 30
  `, [appId]);
  const cheques = await execQ(pool, `
    SELECT ch.*, st.admission_no, st.first_name, st.last_name, r.number AS receipt_number
      FROM school_cheque ch
      LEFT JOIN school_receipt r ON r.id=ch.receipt_id
      LEFT JOIN school_students st ON st.id=r.student_id
     WHERE ch.app_id=$1 AND ch.deleted_at IS NULL ORDER BY ch.cheque_date DESC LIMIT 60
  `, [appId]);
  const settlements = await execQ(pool, `
    SELECT * FROM school_gateway_settlement WHERE app_id=$1 AND deleted_at IS NULL ORDER BY settlement_date DESC LIMIT 40
  `, [appId]);
  const exceptions = await execQ(pool, `
    SELECT * FROM school_match_exception WHERE app_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 60
  `, [appId]);
  const bankLines = await execQ(pool, `
    SELECT * FROM school_bank_statement_line WHERE app_id=$1 AND deleted_at IS NULL ORDER BY date DESC LIMIT 40
  `, [appId]);
  res.json({ ok: true, summary, cashierDays, cheques, settlements, exceptions, bankLines });
}));

feeOpsRouter.post('/fee/cashier-days', route(async (req, res) => {
  if (!guard(req, res, 'fees.manage')) return;
  const b = req.body || {};
  const [row] = await execQ(getPool(), `
    INSERT INTO school_cashier_day (app_id, cashier_id, date, opening_cash, status)
    VALUES ($1,$2,coalesce($3,current_date),$4,'open')
    ON CONFLICT (app_id, cashier_id, date) WHERE deleted_at IS NULL DO UPDATE SET opening_cash=EXCLUDED.opening_cash, updated_at=now()
    RETURNING *
  `, [appIdOf(req), userOf(req), dayOf(b.date), num(b.openingCash) || 0]);
  res.json({ ok: true, cashierDay: row });
}));

feeOpsRouter.post('/fee/cashier-days/:id/close', route(async (req, res) => {
  if (!guard(req, res, 'fees.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const [day] = await execQ(pool, `SELECT * FROM school_cashier_day WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL`, [appId, num(req.params.id)]);
  if (!day) return res.status(404).json({ error: 'Cashier day not found' });
  const [cash] = await execQ(pool, `
    SELECT coalesce(sum(amount),0) AS total FROM school_receipt
     WHERE app_id=$1 AND deleted_at IS NULL AND cashier_day_id=$2 AND mode='cash' AND status IN ('issued','cleared')
  `, [appId, day.id]);
  const expected = Number(day.opening_cash) + Number(cash.total);
  const [row] = await execQ(pool, `
    UPDATE school_cashier_day
       SET closing_cash=$3, expected_cash=$4, status='closed', closed_by=$5, closed_at=now(), updated_at=now()
     WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appId, day.id, num(req.body?.closingCash) || 0, expected, userOf(req)]);
  res.json({ ok: true, cashierDay: row });
}));

feeOpsRouter.post('/fee/cheques/:id/status', route(async (req, res) => {
  if (!guard(req, res, 'fees.manage')) return;
  const b = req.body || {};
  const status = text(b.status);
  if (!['pending', 'deposited', 'cleared', 'bounced', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid cheque status' });
  }
  const [row] = await execQ(getPool(), `
    UPDATE school_cheque
       SET status=$3, deposit_date=coalesce($4,deposit_date), clearance_date=coalesce($5,clearance_date),
           bounce_reason=coalesce($6,bounce_reason), bounce_charge=coalesce($7,bounce_charge), updated_at=now()
     WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), num(req.params.id), status, dayOf(b.depositDate), dayOf(b.clearanceDate), text(b.bounceReason), num(b.bounceCharge)]);
  if (!row) return res.status(404).json({ error: 'Cheque not found' });
  res.json({ ok: true, cheque: row });
}));

feeOpsRouter.post('/fee/exceptions/:id/resolve', route(async (req, res) => {
  if (!guard(req, res, 'fees.manage')) return;
  const [row] = await execQ(getPool(), `
    UPDATE school_match_exception
       SET status='resolved', resolved_by=$3, resolved_at=now(), resolution_note=$4, updated_at=now()
     WHERE app_id=$1 AND id=$2 AND status='open' AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), num(req.params.id), userOf(req), text(req.body?.note)]);
  if (!row) return res.status(404).json({ error: 'Open exception not found' });
  res.json({ ok: true, exception: row });
}));

/* ============================================================
   6. ACCOUNTS
   ============================================================ */

feeOpsRouter.get('/fee/accounts', route(async (req, res) => {
  if (!guard(req, res, 'fees.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const [summary] = await execQ(pool, `
    SELECT
      (SELECT count(*)::int FROM school_account WHERE app_id=$1 AND deleted_at IS NULL) AS accounts,
      (SELECT count(*)::int FROM school_voucher WHERE app_id=$1 AND deleted_at IS NULL) AS vouchers,
      (SELECT count(*)::int FROM school_voucher WHERE app_id=$1 AND deleted_at IS NULL AND status='posted') AS posted,
      (SELECT count(*)::int FROM school_voucher WHERE app_id=$1 AND deleted_at IS NULL AND status='draft') AS drafts,
      (SELECT coalesce(sum(current_balance),0) FROM school_account WHERE app_id=$1 AND deleted_at IS NULL AND type='asset' AND is_cash_or_bank=true) AS cash_and_bank,
      (SELECT coalesce(sum(current_balance),0) FROM school_account WHERE app_id=$1 AND deleted_at IS NULL AND type='income') AS income_balance,
      (SELECT coalesce(sum(current_balance),0) FROM school_account WHERE app_id=$1 AND deleted_at IS NULL AND type='expense') AS expense_balance
  `, [appId]);
  const accounts = await execQ(pool, `
    SELECT a.*, g.name AS group_name FROM school_account a
      LEFT JOIN school_account_group g ON g.id=a.group_id
     WHERE a.app_id=$1 AND a.deleted_at IS NULL
     ORDER BY a.type, a.code
  `, [appId]);
  const vouchers = await execQ(pool, `
    SELECT v.*, t.name AS type_name,
           (SELECT count(*)::int FROM school_voucher_line l WHERE l.voucher_id=v.id AND l.deleted_at IS NULL) AS line_count
      FROM school_voucher v
      LEFT JOIN school_voucher_type t ON t.id=v.type_id
     WHERE v.app_id=$1 AND v.deleted_at IS NULL
     ORDER BY v.date DESC, v.id DESC LIMIT 60
  `, [appId]);
  const groups = await execQ(pool, `
    SELECT * FROM school_account_group WHERE app_id=$1 AND deleted_at IS NULL ORDER BY type, sort_order, name
  `, [appId]);
  const [trial] = await execQ(pool, `
    SELECT coalesce(sum(l.debit),0) AS total_debit, coalesce(sum(l.credit),0) AS total_credit
      FROM school_voucher_line l
      JOIN school_voucher v ON v.id=l.voucher_id AND v.status='posted' AND v.deleted_at IS NULL
     WHERE l.app_id=$1 AND l.deleted_at IS NULL
  `, [appId]);
  res.json({ ok: true, summary, accounts, vouchers, groups, trial });
}));

feeOpsRouter.post('/fee/accounts', route(async (req, res) => {
  if (!guard(req, res, 'fees.manage')) return;
  const b = req.body || {};
  if (!text(b.code) || !text(b.name) || !text(b.type)) {
    return res.status(400).json({ error: 'Code, name and type are required' });
  }
  const [row] = await execQ(getPool(), `
    INSERT INTO school_account (app_id, code, name, group_id, type, is_cash_or_bank, opening_balance, current_balance, is_active)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$7,true)
    ON CONFLICT (app_id, code) WHERE deleted_at IS NULL DO UPDATE SET name=EXCLUDED.name, group_id=EXCLUDED.group_id,
      type=EXCLUDED.type, is_cash_or_bank=EXCLUDED.is_cash_or_bank, updated_at=now()
    RETURNING *
  `, [appIdOf(req), text(b.code), text(b.name), num(b.groupId), text(b.type), b.isCashOrBank === true, num(b.openingBalance) || 0]);
  res.json({ ok: true, account: row });
}));

feeOpsRouter.post('/fee/vouchers', route(async (req, res) => {
  if (!guard(req, res, 'fees.manage')) return;
  const b = req.body || {};
  const lines = Array.isArray(b.lines) ? b.lines : [];
  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  if (!lines.length || Math.abs(totalDebit - totalCredit) > 0.001 || totalDebit <= 0) {
    return res.status(400).json({ error: 'Voucher lines must balance and be non-zero' });
  }
  const client = await getPool().connect();
  try {
    const appId = appIdOf(req);
    await client.query('BEGIN');
    const cnt = await client.query('SELECT count(*)::int AS n FROM school_voucher WHERE app_id=$1', [appId]);
    const number = text(b.number) || nextNumber('VCH', cnt.rows[0].n);
    const voucher = await client.query(`
      INSERT INTO school_voucher (app_id, type_id, number, date, period_id, source_type, source_id, narration, status, total_debit, total_credit, posted_by, posted_at, created_by)
      VALUES ($1,$2,$3,coalesce($4,current_date),$5,$6,$7,$8,$9,$10,$10,$11,now(),$11) RETURNING *
    `, [appId, num(b.typeId), number, dayOf(b.date), num(b.periodId), text(b.sourceType) || 'manual', num(b.sourceId), text(b.narration), text(b.status) === 'draft' ? 'draft' : 'posted', totalDebit, userOf(req)]);

    for (const line of lines) {
      const accountId = num(line.accountId);
      if (!accountId) continue;
      const debit = Number(line.debit) || 0;
      const credit = Number(line.credit) || 0;
      await client.query(`
        INSERT INTO school_voucher_line (app_id, voucher_id, account_id, debit, credit, narration)
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [appId, voucher.rows[0].id, accountId, debit, credit, text(line.narration)]);
      if (voucher.rows[0].status === 'posted') {
        await client.query(`
          UPDATE school_account SET current_balance = current_balance + $3 - $4, updated_at=now()
           WHERE app_id=$1 AND id=$2
        `, [appId, accountId, debit, credit]);
      }
    }
    await client.query('COMMIT');
    res.json({ ok: true, voucher: voucher.rows[0] });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}));

export const schoolFeeOpsRouter = feeOpsRouter;
