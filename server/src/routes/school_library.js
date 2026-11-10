/* ============================================================
   School Library — backend routes
   Mounted at /api/school/library through the main app
   ============================================================ */
import express from 'express';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { ensureFoundation, loadAccess, writeAudit } from '../school/foundation.js';

const libraryRouter = express.Router();

libraryRouter.use(verifyToken);
libraryRouter.use(async (req, _res, next) => {
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
const bool = (v, fallback = false) => (v === undefined || v === null ? fallback : Boolean(v));
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
const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => { throw new HttpError(status, message); };

function guard(req, res, perm) {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('library.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}
function guardView(req, res, perm = 'library.view') {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('library.view') || perms.includes('library.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

/* ============================================================
   Dashboard
   ============================================================ */
libraryRouter.get('/library/dashboard', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const [summary] = await execQ(pool, `
    SELECT
      (SELECT count(*)::int FROM school_library_title WHERE app_id=$1 AND deleted_at IS NULL) AS titles,
      (SELECT count(*)::int FROM school_library_copy WHERE app_id=$1 AND deleted_at IS NULL) AS copies,
      (SELECT count(*)::int FROM school_library_copy WHERE app_id=$1 AND status='available' AND deleted_at IS NULL) AS available_copies,
      (SELECT count(*)::int FROM school_library_loan WHERE app_id=$1 AND status='issued') AS active_loans,
      (SELECT count(*)::int FROM school_library_loan WHERE app_id=$1 AND status='issued' AND due_date < CURRENT_DATE) AS overdue_loans,
      (SELECT count(*)::int FROM school_library_reservation WHERE app_id=$1 AND status='active') AS active_reservations,
      (SELECT coalesce(sum(fine_amount),0) FROM school_library_fine WHERE app_id=$1 AND waived_by IS NULL AND posted_to_fees = false) AS pending_fines
  `, [appId]);
  res.json({ ok: true, summary });
}));

/* ============================================================
   Titles
   ============================================================ */
libraryRouter.get('/library/titles', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const appId = appIdOf(req);
  const q = text(req.query.q);
  const rows = await execQ(getPool(), `
    SELECT * FROM school_library_title
     WHERE app_id=$1 AND deleted_at IS NULL
       AND ($2::text IS NULL OR title ILIKE '%' || $2 || '%' OR author ILIKE '%' || $2 || '%' OR isbn ILIKE '%' || $2 || '%')
     ORDER BY created_at DESC LIMIT 500
  `, [appId, q]);
  res.json({ ok: true, titles: rows });
}));

libraryRouter.post('/library/titles', route(async (req, res) => {
  if (!guard(req, res, 'library.manage')) return;
  const b = req.body || {};
  if (!text(b.title)) fail(400, 'Title is required');
  const appId = appIdOf(req);
  const rows = await execQ(getPool(), `
    INSERT INTO school_library_title
      (app_id, title, subtitle, author, isbn, publisher, book_category_id, subject, edition,
       publication_year, language, pages, price, rack_id, acc_no, status, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *
  `, [appId, text(b.title), text(b.subtitle), text(b.author), text(b.isbn), text(b.publisher),
    num(b.categoryId) ?? (Number.isFinite(Number(b.category)) ? Number(b.category) : null),
    text(b.subject), text(b.edition), num(b.publishedYear ?? b.publicationYear),
    text(b.language) || 'en', num(b.pages), num(b.price), num(b.rackId), text(b.accNo),
    text(b.status) || 'active', text(b.notes)]);
  await writeAudit(getPool(), req, { action: 'library.title.create', entity: 'school_library_title', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, title: rows[0] });
}));

libraryRouter.get('/library/titles/:id', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const id = num(req.params.id);
  const [row] = await execQ(getPool(), 'SELECT * FROM school_library_title WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appIdOf(req), id]);
  if (!row) fail(404, 'Title not found');
  res.json({ ok: true, title: row });
}));

libraryRouter.put('/library/titles/:id', route(async (req, res) => {
  if (!guard(req, res, 'library.manage')) return;
  const id = num(req.params.id);
  const b = req.body || {};
  const appId = appIdOf(req);
  const before = (await execQ(getPool(), 'SELECT * FROM school_library_title WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, id]))[0];
  if (!before) fail(404, 'Title not found');
  const rows = await execQ(getPool(), `
    UPDATE school_library_title SET
      title=coalesce($3,title), subtitle=coalesce($4,subtitle), author=coalesce($5,author), isbn=coalesce($6,isbn),
      publisher=coalesce($7,publisher), book_category_id=coalesce($8,book_category_id), subject=coalesce($9,subject),
      edition=coalesce($10,edition), publication_year=coalesce($11,publication_year), language=coalesce($12,language),
      pages=coalesce($13,pages), price=coalesce($14,price), rack_id=coalesce($15,rack_id), status=coalesce($16,status),
      notes=coalesce($17,notes), updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appId, id, text(b.title), text(b.subtitle), text(b.author), text(b.isbn), text(b.publisher),
    num(b.categoryId) ?? (Number.isFinite(Number(b.category)) ? Number(b.category) : null),
    text(b.subject), text(b.edition), num(b.publishedYear ?? b.publicationYear), text(b.language),
    num(b.pages), num(b.price), num(b.rackId), text(b.status), text(b.notes)]);
  await writeAudit(getPool(), req, { action: 'library.title.update', entity: 'school_library_title', entityId: id, before, after: rows[0] });
  res.json({ ok: true, title: rows[0] });
}));

libraryRouter.delete('/library/titles/:id', route(async (req, res) => {
  if (!guard(req, res, 'library.manage')) return;
  const id = num(req.params.id);
  const appId = appIdOf(req);
  const active = await execQ(getPool(), 'SELECT count(*)::int AS n FROM school_library_copy WHERE app_id=$1 AND title_id=$2 AND deleted_at IS NULL', [appId, id]);
  if (active[0].n) fail(400, 'Title has copies; remove copies first');
  const rows = await execQ(getPool(), 'UPDATE school_library_title SET deleted_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id', [appId, id]);
  if (!rows[0]) fail(404, 'Title not found');
  await writeAudit(getPool(), req, { action: 'library.title.delete', entity: 'school_library_title', entityId: id });
  res.json({ ok: true });
}));

/* ============================================================
   Copies
   ============================================================ */
libraryRouter.get('/library/copies', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const appId = appIdOf(req);
  const rows = await execQ(getPool(), `
    SELECT c.*, t.title, t.author
      FROM school_library_copy c
      LEFT JOIN school_library_title t ON t.id=c.title_id
     WHERE c.app_id=$1 AND c.deleted_at IS NULL
     ORDER BY c.created_at DESC LIMIT 1000
  `, [appId]);
  res.json({ ok: true, copies: rows });
}));

libraryRouter.post('/library/copies', route(async (req, res) => {
  if (!guard(req, res, 'library.manage')) return;
  const b = req.body || {};
  const appId = appIdOf(req);
  if (!num(b.titleId)) fail(400, 'Title is required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_library_copy (app_id, title_id, copy_code, barcode, status, condition, rack_id, added_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::timestamptz, now())) RETURNING *
  `, [appId, num(b.titleId), text(b.copyNo) || text(b.copyCode) || `COPY-${Date.now()}`, text(b.barcode),
    text(b.status) || 'available', text(b.condition) || 'good', num(b.rackId),
    b.acquiredDate ? new Date(b.acquiredDate).toISOString() : null]);
  await writeAudit(getPool(), req, { action: 'library.copy.create', entity: 'school_library_copy', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, copy: rows[0] });
}));

/* ============================================================
   Members
   ============================================================ */
libraryRouter.get('/library/members', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `
    SELECT * FROM school_library_member
     WHERE app_id=$1 AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 1000
  `, [appIdOf(req)]);
  res.json({ ok: true, members: rows });
}));

libraryRouter.post('/library/members', route(async (req, res) => {
  if (!guard(req, res, 'library.manage')) return;
  const b = req.body || {};
  const appId = appIdOf(req);
  const rows = await execQ(getPool(), `
    INSERT INTO school_library_member (app_id, member_code, member_type, person_id, category_id, status)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
  `, [appId, text(b.memberCode) || `LIB-${Date.now()}`, text(b.memberType) || 'student',
    num(b.personId) ?? num(b.memberRefId), num(b.categoryId), text(b.status) || 'active']);
  await writeAudit(getPool(), req, { action: 'library.member.create', entity: 'school_library_member', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, member: rows[0] });
}));

/* ============================================================
   Loans
   ============================================================ */
libraryRouter.get('/library/loans', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const appId = appIdOf(req);
  const rows = await execQ(getPool(), `
    SELECT l.*, c.barcode, t.title,
           COALESCE(s.first_name || ' ' || s.last_name, st.name) AS member_name
      FROM school_library_loan l
      LEFT JOIN school_library_copy c ON c.id=l.copy_id
      LEFT JOIN school_library_title t ON t.id=l.title_id
      LEFT JOIN school_library_member m ON m.id=l.member_id
      LEFT JOIN school_students s ON s.id=m.person_id AND m.member_type='student'
      LEFT JOIN school_staff st ON st.id=m.person_id AND m.member_type='staff'
     WHERE l.app_id=$1
     ORDER BY l.issue_date DESC LIMIT 1000
  `, [appId]);
  res.json({ ok: true, loans: rows });
}));

libraryRouter.post('/library/loans/issue', route(async (req, res) => {
  if (!guard(req, res, 'library.issue')) return;
  const b = req.body || {};
  const appId = appIdOf(req);
  const copyId = num(b.copyId);
  const memberId = num(b.memberId);
  if (!copyId || !memberId) fail(400, 'Copy and member are required');
  const [copy] = await execQ(getPool(), 'SELECT * FROM school_library_copy WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL FOR UPDATE', [appId, copyId]);
  if (!copy) fail(404, 'Copy not found');
  if (copy.status !== 'available') fail(400, 'Copy is not available');

  const dueDays = num(b.dueDays) || 14;
  const issuedAt = dayOf(b.issuedAt) || dayOf(new Date());
  const dueAt = new Date(new Date(issuedAt).getTime() + dueDays * 86400000);
  const rows = await execQ(getPool(), `
    INSERT INTO school_library_loan (app_id, loan_no, copy_id, title_id, member_id, issue_date, due_date, renewal_count, status, issued_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,0,'issued',$8) RETURNING *
  `, [appId, text(b.loanNo) || `LN-${Date.now()}`, copyId, copy.title_id, memberId, issuedAt, dayOf(dueAt), userOf(req)]);
  await execQ(getPool(), 'UPDATE school_library_copy SET status=$2 WHERE app_id=$1 AND id=$3', [appId, 'issued', copyId]);
  await writeAudit(getPool(), req, { action: 'library.loan.issue', entity: 'school_library_loan', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, loan: rows[0] });
}));

libraryRouter.post('/library/loans/return', route(async (req, res) => {
  if (!guard(req, res, 'library.issue')) return;
  const loanId = num(req.body?.loanId);
  if (!loanId) fail(400, 'Loan id is required');
  const appId = appIdOf(req);
  const [loan] = await execQ(getPool(), 'SELECT * FROM school_library_loan WHERE app_id=$1 AND id=$2', [appId, loanId]);
  if (!loan) fail(404, 'Loan not found');
  const nowDay = dayOf(new Date());
  const updated = await execQ(getPool(), `
    UPDATE school_library_loan SET return_date=$3, status='returned', updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appId, loanId, nowDay]);
  await execQ(getPool(), 'UPDATE school_library_copy SET status=$2 WHERE app_id=$1 AND id=$3', [appId, 'available', loan.copy_id]);
  await writeAudit(getPool(), req, { action: 'library.loan.return', entity: 'school_library_loan', entityId: loanId, after: updated[0] });
  res.json({ ok: true, loan: updated[0] });
}));

libraryRouter.post('/library/loans/renew', route(async (req, res) => {
  if (!guard(req, res, 'library.issue')) return;
  const loanId = num(req.body?.loanId);
  if (!loanId) fail(400, 'Loan id is required');
  const appId = appIdOf(req);
  const [loan] = await execQ(getPool(), 'SELECT * FROM school_library_loan WHERE app_id=$1 AND id=$2', [appId, loanId]);
  if (!loan) fail(404, 'Loan not found');
  const days = num(req.body?.days) || 14;
  const newDue = new Date(new Date(loan.due_date).getTime() + days * 86400000);
  const updated = await execQ(getPool(), `
    UPDATE school_library_loan SET due_date=$3, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appId, loanId, dayOf(newDue)]);
  await writeAudit(getPool(), req, { action: 'library.loan.renew', entity: 'school_library_loan', entityId: loanId, after: updated[0] });
  res.json({ ok: true, loan: updated[0] });
}));

/* ============================================================
   Reservations
   ============================================================ */
libraryRouter.get('/library/reservations', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `
    SELECT r.*, t.title,
           COALESCE(s.first_name || ' ' || s.last_name, st.name) AS member_name
      FROM school_library_reservation r
      LEFT JOIN school_library_title t ON t.id=r.title_id
      LEFT JOIN school_library_member m ON m.id=r.member_id
      LEFT JOIN school_students s ON s.id=m.person_id AND m.member_type='student'
      LEFT JOIN school_staff st ON st.id=m.person_id AND m.member_type='staff'
     WHERE r.app_id=$1
     ORDER BY r.created_at DESC LIMIT 1000
  `, [appIdOf(req)]);
  res.json({ ok: true, reservations: rows });
}));

libraryRouter.post('/library/reservations', route(async (req, res) => {
  if (!guard(req, res, 'library.manage')) return;
  const b = req.body || {};
  const appId = appIdOf(req);
  if (!num(b.titleId) || !num(b.memberId)) fail(400, 'Title and member required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_library_reservation (app_id, title_id, member_id, copy_id, status, priority)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
  `, [appId, num(b.titleId), num(b.memberId), num(b.copyId), text(b.status) || 'active', num(b.priority) || 1]);
  await writeAudit(getPool(), req, { action: 'library.reservation.create', entity: 'school_library_reservation', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, reservation: rows[0] });
}));

/* ============================================================
   Fines
   ============================================================ */
libraryRouter.get('/library/fines', route(async (req, res) => {
  if (!guardView(req, res, 'library.fines')) return;
  const rows = await execQ(getPool(), `
    SELECT f.*, 
      COALESCE(s.first_name || ' ' || s.last_name, st.name) AS member_name,
      l.id AS loan_id
      FROM school_library_fine f
      LEFT JOIN school_library_member m ON m.id=f.member_id
      LEFT JOIN school_students s ON s.id=m.person_id AND m.member_type='student'
      LEFT JOIN school_staff st ON st.id=m.person_id AND m.member_type='staff'
      LEFT JOIN school_library_loan l ON l.id=f.loan_id
     WHERE f.app_id=$1
     ORDER BY f.created_at DESC LIMIT 1000
  `, [appIdOf(req)]);
  res.json({ ok: true, fines: rows });
}));

libraryRouter.post('/library/fines/collect', route(async (req, res) => {
  if (!guard(req, res, 'library.fines')) return;
  const fineId = num(req.body?.fineId);
  if (!fineId) fail(400, 'Fine id required');
  const appId = appIdOf(req);
  const rows = await execQ(getPool(), `
    UPDATE school_library_fine SET status='collected', collected_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appId, fineId]);
  if (!rows[0]) fail(404, 'Fine not found');
  await writeAudit(getPool(), req, { action: 'library.fine.collect', entity: 'school_library_fine', entityId: fineId, after: rows[0] });
  res.json({ ok: true, fine: rows[0] });
}));

libraryRouter.post('/library/fines/waive', route(async (req, res) => {
  if (!guard(req, res, 'library.fines')) return;
  const fineId = num(req.body?.fineId);
  if (!fineId) fail(400, 'Fine id required');
  const appId = appIdOf(req);
  const rows = await execQ(getPool(), `
    UPDATE school_library_fine SET status='waived', waived_at=now(), waived_by=$3
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appId, fineId, userOf(req)]);
  if (!rows[0]) fail(404, 'Fine not found');
  await writeAudit(getPool(), req, { action: 'library.fine.waive', entity: 'school_library_fine', entityId: fineId, after: rows[0] });
  res.json({ ok: true, fine: rows[0] });
}));

/* ============================================================
   Reports
   ============================================================ */
libraryRouter.get('/library/reports/circulation', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const appId = appIdOf(req);
  const rows = await execQ(getPool(), `
    SELECT date_trunc('month', issue_date) AS month, count(*)::int AS loans
      FROM school_library_loan
     WHERE app_id=$1
     GROUP BY 1 ORDER BY 1 DESC LIMIT 24
  `, [appId]);
  res.json({ ok: true, circulation: rows });
}));

libraryRouter.get('/library/reports/overdue', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const appId = appIdOf(req);
  const rows = await execQ(getPool(), `
    SELECT l.*, c.barcode, t.title,
      COALESCE(s.first_name || ' ' || s.last_name, st.name) AS member_name
      FROM school_library_loan l
      LEFT JOIN school_library_copy c ON c.id=l.copy_id
      LEFT JOIN school_library_title t ON t.id=l.title_id
      LEFT JOIN school_library_member m ON m.id=l.member_id
      LEFT JOIN school_students s ON s.id=m.person_id AND m.member_type='student'
      LEFT JOIN school_staff st ON st.id=m.person_id AND m.member_type='staff'
     WHERE l.app_id=$1 AND l.status IN ('active','overdue') AND l.due_date < current_date
     ORDER BY l.due_date ASC
  `, [appId]);
  res.json({ ok: true, overdue: rows });
}));

/* ---- error middleware ---- */
libraryRouter.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[library]', err);
  res.status(status).json({ error: err.message || 'Library request failed' });
});

export { libraryRouter };
