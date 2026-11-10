/* ============================================================
   Front Office — backend routes
   Mounted at /api/school before the legacy comprehensive router.
   ============================================================ */
import express from 'express';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { ensureFoundation, loadAccess, writeAudit } from '../school/foundation.js';

const frontofficeRouter = express.Router();

frontofficeRouter.use(verifyToken);
frontofficeRouter.use(async (req, _res, next) => {
  if (!req.school) {
    const pool = getPool();
    const appId = req.user?.company || DEFAULT_COMPANY_ID;
    await ensureFoundation(pool, appId);
    req.school = await loadAccess(pool, appId, req.user);
  }
  next();
});

const num = (v) => { if (v === undefined || v === null || v === '') return null; const n = Number(v); return Number.isNaN(n) ? null : n; };
const text = (v) => (v === undefined || v === null ? null : String(v).trim());
const bool = (v, fallback = false) => (v === undefined || v === null ? fallback : Boolean(v));
const dayOf = (v) => { if (!v) return null; if (v instanceof Date) { const y = v.getFullYear(); const m = String(v.getMonth() + 1).padStart(2, '0'); const d = String(v.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; } return String(v).slice(0, 10); };
const appIdOf = (req) => req.school?.appId || 'default';
const userOf = (req) => req.user?.userid || req.user?.id || 'system';
const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };

function guard(req, res, perm) {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('frontoffice.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}
function guardView(req, res, perm = 'frontoffice.view') {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('frontoffice.view') || perms.includes('frontoffice.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

// Dashboard
frontofficeRouter.get('/frontoffice/dashboard', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const [summary] = await execQ(pool, `
    SELECT
      (SELECT count(*)::int FROM school_frontoffice_enquiry WHERE app_id=$1 AND stage IN ('New','Contacted') AND deleted_at IS NULL) AS open_enquiries,
      (SELECT count(*)::int FROM school_frontoffice_visit WHERE app_id=$1 AND status='checked_in') AS visitors_inside,
      (SELECT count(*)::int FROM school_frontoffice_complaint WHERE app_id=$1 AND status IN ('Open','Assigned','In Progress')) AS open_complaints,
      (SELECT count(*)::int FROM school_frontoffice_call_log WHERE app_id=$1 AND call_time >= CURRENT_DATE) AS calls_today
  `, [appId]);
  res.json({ ok: true, summary });
}));

// Enquiries
frontofficeRouter.get('/frontoffice/enquiries', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const stage = text(req.query.stage);
  const rows = await execQ(getPool(), `SELECT e.*, c.name AS contact_name, c.phone FROM school_frontoffice_enquiry e LEFT JOIN school_frontoffice_contact c ON c.id=e.contact_id WHERE e.app_id=$1 AND e.deleted_at IS NULL ${stage ? 'AND e.stage=$2' : ''} ORDER BY e.created_at DESC LIMIT 200`, [appIdOf(req), stage].filter(Boolean));
  res.json({ ok: true, enquiries: rows });
}));

frontofficeRouter.post('/frontoffice/enquiries', route(async (req, res) => {
  if (!guard(req, res, 'frontoffice.enquiry')) return;
  const b = req.body || {};
  const appId = appIdOf(req);
  let contactId = num(b.contactId);
  if (!contactId && text(b.phone)) {
    const existing = await execQ(getPool(), `SELECT id FROM school_frontoffice_contact WHERE app_id=$1 AND phone=$2 AND deleted_at IS NULL`, [appId, text(b.phone)]);
    if (existing[0]) contactId = existing[0].id;
    else {
      const contact = await execQ(getPool(), `INSERT INTO school_frontoffice_contact (app_id, name, phone, email, relation, address) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [appId, text(b.contactName), text(b.phone), text(b.email), text(b.relation), text(b.address)]);
      contactId = contact[0].id;
    }
  }
  const rows = await execQ(getPool(), `
    INSERT INTO school_frontoffice_enquiry (app_id, contact_id, child_name, class_sought, source_id, stage, owner, next_follow_up_date)
    VALUES ($1,$2,$3,$4,$5,'New',$6,$7) RETURNING *
  `, [appId, contactId, text(b.childName), text(b.classSought), num(b.sourceId), userOf(req), dayOf(b.nextFollowUp)]);
  res.json({ ok: true, enquiry: rows[0] });
}));

// Visits
frontofficeRouter.get('/frontoffice/visits', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const status = text(req.query.status);
  const rows = await execQ(getPool(), `SELECT v.*, c.name AS contact_name FROM school_frontoffice_visit v LEFT JOIN school_frontoffice_contact c ON c.id=v.contact_id WHERE v.app_id=$1 ${status ? 'AND v.status=$2' : ''} ORDER BY v.created_at DESC LIMIT 200`, [appIdOf(req), status].filter(Boolean));
  res.json({ ok: true, visits: rows });
}));

frontofficeRouter.post('/frontoffice/visits', route(async (req, res) => {
  if (!guard(req, res, 'frontoffice.visitor')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), `
    INSERT INTO school_frontoffice_visit (app_id, contact_id, purpose, host_user, expected, id_type, photo, items_carried, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'expected') RETURNING *
  `, [appIdOf(req), num(b.contactId), text(b.purpose), text(b.hostUser), bool(b.expected), text(b.idType), text(b.photo), text(b.itemsCarried)]);
  res.json({ ok: true, visit: rows[0] });
}));

frontofficeRouter.post('/frontoffice/visits/:id/check-in', route(async (req, res) => {
  if (!guard(req, res, 'frontoffice.visitor')) return;
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `UPDATE school_frontoffice_visit SET check_in=now(), status='checked_in', pass_number=$3 WHERE app_id=$1 AND id=$2 RETURNING *`, [appIdOf(req), id, 'P-' + Date.now().toString(36).toUpperCase()]);
  if (!rows[0]) fail(404, 'Visit not found');
  await writeAudit(getPool(), req, { action: 'frontoffice.visit.checkin', entity: 'school_frontoffice_visit', entityId: id, after: rows[0] });
  res.json({ ok: true, visit: rows[0] });
}));

frontofficeRouter.post('/frontoffice/visits/:id/check-out', route(async (req, res) => {
  if (!guard(req, res, 'frontoffice.visitor')) return;
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `UPDATE school_frontoffice_visit SET check_out=now(), status='checked_out' WHERE app_id=$1 AND id=$2 RETURNING *`, [appIdOf(req), id]);
  if (!rows[0]) fail(404, 'Visit not found');
  await writeAudit(getPool(), req, { action: 'frontoffice.visit.checkout', entity: 'school_frontoffice_visit', entityId: id, after: rows[0] });
  res.json({ ok: true, visit: rows[0] });
}));

// Complaints
frontofficeRouter.get('/frontoffice/complaints', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const status = text(req.query.status);
  const rows = await execQ(getPool(), `SELECT c.*, cat.name AS category_name, co.name AS contact_name FROM school_frontoffice_complaint c LEFT JOIN school_frontoffice_complaint_category cat ON cat.id=c.category_id LEFT JOIN school_frontoffice_contact co ON co.id=c.contact_id WHERE c.app_id=$1 ${status ? 'AND c.status=$2' : ''} ORDER BY c.created_at DESC LIMIT 200`, [appIdOf(req), status].filter(Boolean));
  res.json({ ok: true, complaints: rows });
}));

frontofficeRouter.post('/frontoffice/complaints', route(async (req, res) => {
  if (!guard(req, res, 'frontoffice.complaint')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), `
    INSERT INTO school_frontoffice_complaint (app_id, contact_id, student_id, category_id, priority, description, channel, owner, due_date, confidential)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
  `, [appIdOf(req), num(b.contactId), num(b.studentId), num(b.categoryId), text(b.priority) || 'medium', text(b.description), text(b.channel) || 'walk-in', text(b.owner) || userOf(req), dayOf(b.dueDate), bool(b.confidential)]);
  res.json({ ok: true, complaint: rows[0] });
}));

// Call Log
frontofficeRouter.get('/frontoffice/calls', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `SELECT cl.*, c.name AS contact_name FROM school_frontoffice_call_log cl LEFT JOIN school_frontoffice_contact c ON c.id=cl.contact_id WHERE cl.app_id=$1 ORDER BY cl.call_time DESC LIMIT 200`, [appIdOf(req)]);
  res.json({ ok: true, calls: rows });
}));

frontofficeRouter.post('/frontoffice/calls', route(async (req, res) => {
  if (!guard(req, res, 'frontoffice.call')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), `
    INSERT INTO school_frontoffice_call_log (app_id, direction, contact_id, number, call_time, duration, purpose, handled_by, outcome, linked_enquiry_id, linked_complaint_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
  `, [appIdOf(req), text(b.direction) || 'in', num(b.contactId), text(b.number), b.callTime ? dayOf(b.callTime) : dayOf(new Date()), num(b.duration), text(b.purpose), userOf(req), text(b.outcome), num(b.linkedEnquiryId), num(b.linkedComplaintId)]);
  res.json({ ok: true, call: rows[0] });
}));

// Appointments
frontofficeRouter.get('/frontoffice/appointments', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const date = text(req.query.date);
  const rows = await execQ(getPool(), `SELECT a.*, c.name AS contact_name FROM school_frontoffice_appointment a LEFT JOIN school_frontoffice_contact c ON c.id=a.contact_id WHERE a.app_id=$1 ${date ? 'AND a.appointment_date=$2' : ''} ORDER BY a.appointment_date, a.slot_time`, [appIdOf(req), date].filter(Boolean));
  res.json({ ok: true, appointments: rows });
}));

frontofficeRouter.post('/frontoffice/appointments', route(async (req, res) => {
  if (!guard(req, res, 'frontoffice.appointment')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), `
    INSERT INTO school_frontoffice_appointment (app_id, contact_id, student_id, host_user, purpose, appointment_date, slot_time, status, notes, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,'Requested',$8,$9) RETURNING *
  `, [appIdOf(req), num(b.contactId), num(b.studentId), text(b.hostUser), text(b.purpose), dayOf(b.appointmentDate), text(b.slotTime), text(b.notes), userOf(req)]);
  res.json({ ok: true, appointment: rows[0] });
}));

export { frontofficeRouter };