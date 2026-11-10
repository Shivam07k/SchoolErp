/* ============================================================
   Alumni & Placement — backend routes
   Mounted at /api/school before the legacy comprehensive router.
   ============================================================ */
import express from 'express';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { ensureFoundation, loadAccess, writeAudit } from '../school/foundation.js';

const alumniRouter = express.Router();

alumniRouter.use(verifyToken);
alumniRouter.use(async (req, _res, next) => {
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
const tsOf = (v) => { if (!v) return null; if (v instanceof Date) return v.toISOString(); return String(v); };
const skillsOf = (v) => {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map((x) => x.trim()).filter(Boolean);
  return null;
};
const appIdOf = (req) => req.school?.appId || 'default';
const userOf = (req) => req.user?.userid || req.user?.id || 'system';
const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };

function guard(req, res, perm) {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('alumni.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}
function guardView(req, res, perm = 'alumni.view') {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('alumni.view') || perms.includes('alumni.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

// Dashboard
alumniRouter.get('/alumni/dashboard', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const [summary] = await execQ(pool, `
    SELECT
      (SELECT count(*)::int FROM school_alumni WHERE app_id=$1 AND status IN ('active','verified')) AS total_alumni,
      (SELECT count(*)::int FROM school_alumni WHERE app_id=$1 AND status='verified') AS verified_alumni,
      (SELECT count(*)::int FROM school_alumni WHERE app_id=$1 AND status='pending_registration') AS pending_verification,
      (SELECT count(*)::int FROM school_alumni_event WHERE app_id=$1 AND status IN ('published','registration_open')) AS active_events,
      (SELECT count(*)::int FROM school_job_posting WHERE app_id=$1 AND status='active') AS active_jobs,
      (SELECT count(*)::int FROM school_donation_campaign WHERE app_id=$1 AND status='active') AS active_campaigns
  `, [appId]);
  res.json({ ok: true, summary });
}));

// Alumni Directory
alumniRouter.get('/alumni/directory', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const status = text(req.query.status);
  const batch = num(req.query.batch);
  const company = text(req.query.company);
  const location = text(req.query.location);
  const rows = await execQ(getPool(), `
    SELECT a.*, p.company, p.designation, p.industry, p.location, s.first_name, s.last_name, s.admission_no
    FROM school_alumni a
    LEFT JOIN school_alumni_profile p ON p.alumni_id=a.id
    LEFT JOIN school_students s ON s.id=a.student_id
    WHERE a.app_id=$1 AND a.deleted_at IS NULL
    ${status ? 'AND a.status=$2' : ''}
    ${batch ? 'AND a.passing_year=$' + (status ? '3' : '2') : ''}
    ${company ? 'AND p.company ILIKE $' + (status || batch ? '3' : '2') : ''}
    ${location ? 'AND p.location ILIKE $' + (status || batch || company ? '4' : '2') : ''}
    ORDER BY a.passing_year DESC, a.id DESC LIMIT 500
  `, [appIdOf(req), status, batch, company, location].filter(Boolean));
  res.json({ ok: true, alumni: rows });
}));

alumniRouter.get('/alumni/directory/:id', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const id = num(req.params.id);
  const alumni = (await execQ(getPool(), `SELECT a.*, s.first_name, s.last_name, s.admission_no, s.photo_url FROM school_alumni a LEFT JOIN school_students s ON s.id=a.student_id WHERE a.app_id=$1 AND a.id=$2 AND a.deleted_at IS NULL`, [appIdOf(req), num(req.params.id)]))[0];
  if (!alumni) return res.status(404).json({ error: 'Not found' });
  const [profile, education] = await Promise.all([
    execQ(getPool(), `SELECT * FROM school_alumni_profile WHERE app_id=$1 AND alumni_id=$2`, [appIdOf(req), num(req.params.id)]),
    execQ(getPool(), `SELECT * FROM school_alumni_education WHERE app_id=$1 AND alumni_id=$2`, [appIdOf(req), num(req.params.id)])
  ]);
  res.json({ ok: true, alumni: { ...alumni, profile: profile[0], education: education } });
}));

alumniRouter.post('/alumni/register', route(async (req, res) => {
  if (!guard(req, res, 'alumni.directory')) return;
  const b = req.body || {};
  if (!num(b.studentId)) fail(400, 'Student ID required');
  const existing = (await execQ(getPool(), `SELECT * FROM school_alumni WHERE app_id=$1 AND student_id=$2 AND deleted_at IS NULL`, [appIdOf(req), num(b.studentId)]))[0];
  if (existing) fail(400, 'Alumni record already exists');
  const student = (await execQ(getPool(), `SELECT * FROM school_students WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL`, [appIdOf(req), num(b.studentId)]))[0];
  if (!student) fail(404, 'Student not found');
  const rows = await execQ(getPool(), `
    INSERT INTO school_alumni (app_id, student_id, passing_year, last_class_id, session_id, status)
    VALUES ($1,$2,$3,$4,$5,'pending_registration') RETURNING *
  `, [appIdOf(req), num(b.studentId), num(b.passingYear) || new Date().getFullYear(), num(b.lastClassId), num(b.sessionId)]);
  // Create profile if provided
  if (b.company || b.designation || b.location) {
    await execQ(getPool(), `
      INSERT INTO school_alumni_profile (app_id, alumni_id, company, designation, industry, location, linkedin_url, privacy_level)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, [appIdOf(req), rows[0].id, text(b.company), text(b.designation), text(b.industry), text(b.location), text(b.linkedinUrl), text(b.privacyLevel) || 'alumni_only']);
  }
  res.json({ ok: true, alumni: rows[0] });
}));  // <-- Note: three closing chars

alumniRouter.put('/alumni/profile/:id', route(async (req, res) => {
  if (!guard(req, res, 'alumni.directory')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `
    INSERT INTO school_alumni_profile (app_id, alumni_id, company, designation, industry, location, linkedin_url, privacy_level)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (app_id, alumni_id) DO UPDATE SET
      company=coalesce($3,company), designation=coalesce($4,designation), industry=coalesce($5,industry),
      location=coalesce($6,location), linkedin_url=coalesce($7,linkedin_url), privacy_level=coalesce($8,privacy_level), updated_at=now()
    RETURNING *
  `, [appIdOf(req), num(req.params.id), text(b.company), text(b.designation), text(b.industry), text(b.location), text(b.linkedinUrl), text(b.privacyLevel) || 'alumni_only']);
  res.json({ ok: true, profile: rows[0] });
}));  // <-- Note: three closing chars

alumniRouter.post('/alumni/verification/:id', route(async (req, res) => {
  if (!guard(req, res, 'alumni.directory')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  const status = text(b.status);
  if (!['verified','rejected'].includes(status)) fail(400, 'Invalid status');
  const rows = await execQ(getPool(), `UPDATE school_alumni SET status=$3, verified_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *`, [appIdOf(req), id, status === 'verified' ? 'verified' : 'rejected']);
  if (!rows[0]) fail(404, 'Alumni not found');
  res.json({ ok: true, alumni: rows[0] });
}));  // <-- Note: three closing chars

// Events
alumniRouter.get('/alumni/events', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const status = text(req.query.status);
  const rows = await execQ(getPool(), `SELECT e.*, (SELECT count(*) FROM school_alumni_event_registration r WHERE r.event_id=e.id AND r.status='confirmed') as reg_count FROM school_alumni_event e WHERE e.app_id=$1 AND e.deleted_at IS NULL ${status ? 'AND e.status=$2' : ''} ORDER BY e.start_dt`, [appIdOf(req), status].filter(Boolean));
  res.json({ ok: true, events: rows });
}));
alumniRouter.post('/alumni/events', route(async (req, res) => {
  if (!guard(req, res, 'alumni.events')) return;
  const b = req.body || {};
  if (!text(b.title) || !b.startDt) fail(400, 'Title and start date required');
  const start = tsOf(b.startDt);
  const end = tsOf(b.endDt) || start;
  const rows = await execQ(getPool(), `
    INSERT INTO school_alumni_event (app_id, title, description, event_type, start_dt, end_dt, venue, max_capacity, registration_fee, reg_open_dt, reg_close_dt, status, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *
  `, [appIdOf(req), text(b.title), text(b.description), text(b.eventType) || 'meet', start, end, text(b.venue), num(b.maxCapacity), num(b.registrationFee) || 0, tsOf(b.regOpenDt), tsOf(b.regCloseDt), text(b.status) || 'draft', userOf(req)]);
  res.json({ ok: true, event: rows[0] });
}));

alumniRouter.put('/alumni/events/:id', route(async (req, res) => {
  if (!guard(req, res, 'alumni.events')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `
    UPDATE school_alumni_event SET
      title=coalesce($3,title), description=coalesce($4,description), event_type=coalesce($5,event_type),
      start_dt=coalesce($6,start_dt), end_dt=coalesce($7,end_dt), venue=coalesce($8,venue),
      max_capacity=coalesce($9,max_capacity), registration_fee=coalesce($10,registration_fee),
      reg_open_dt=coalesce($11,reg_open_dt), reg_close_dt=coalesce($12,reg_close_dt),
      status=coalesce($13,status), updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), id, text(b.title), text(b.description), text(b.eventType), tsOf(b.startDt), tsOf(b.endDt),
    text(b.venue), num(b.maxCapacity), num(b.registrationFee), tsOf(b.regOpenDt), tsOf(b.regCloseDt), text(b.status)]);
  if (!rows[0]) fail(404, 'Event not found');
  res.json({ ok: true, event: rows[0] });
}));

alumniRouter.delete('/alumni/events/:id', route(async (req, res) => {
  if (!guard(req, res, 'alumni.events')) return;
  const rows = await execQ(getPool(), 'UPDATE school_alumni_event SET deleted_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id', [appIdOf(req), num(req.params.id)]);
  if (!rows[0]) fail(404, 'Event not found');
  res.json({ ok: true });
}));
alumniRouter.post('/alumni/events/:id/register', route(async (req, res) => {
  if (!guard(req, res, 'alumni.events')) return;
  const eventId = num(req.params.id);
  const alumniId = num(req.body?.alumniId);
  if (!alumniId) fail(400, 'Alumni ID required');
  const event = (await execQ(getPool(), `SELECT * FROM school_alumni_event WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL`, [appIdOf(req), eventId]))[0];
  if (!event) fail(404, 'Event not found');
  if (event.reg_close_dt && new Date(event.reg_close_dt) < new Date()) fail(400, 'Registration closed');
  if (event.max_capacity) {
    const confirmed = (await execQ(getPool(), `SELECT count(*)::int as c FROM school_alumni_event_registration WHERE app_id=$1 AND event_id=$2 AND status='confirmed'`, [appIdOf(req), eventId]))[0].c;
    if (confirmed >= event.max_capacity) fail(400, 'Event full');
  }
  const paymentStatus = event.registration_fee > 0 ? 'pending' : 'not_required';
  const rows = await execQ(getPool(), `
    INSERT INTO school_alumni_event_registration (app_id, event_id, alumni_id, status, payment_status)
    VALUES ($1,$2,$3,'confirmed',$4) RETURNING *
  `, [appIdOf(req), eventId, alumniId, paymentStatus]);
  res.json({ ok: true, registration: rows[0], paymentRequired: paymentStatus === 'pending' });
}));
// Jobs
alumniRouter.get('/alumni/jobs', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const status = text(req.query.status);
  const rows = await execQ(getPool(), `SELECT j.*, p.company as alumni_company FROM school_job_posting j LEFT JOIN school_alumni_profile p ON p.alumni_id=j.posted_by_alumni_id WHERE j.app_id=$1 AND j.deleted_at IS NULL ${status ? 'AND j.status=$2' : ''} ORDER BY j.created_at DESC LIMIT 200`, [appIdOf(req), status].filter(Boolean));
  res.json({ ok: true, jobs: rows });
}));
alumniRouter.post('/alumni/jobs', route(async (req, res) => {
  if (!guard(req, res, 'alumni.jobs')) return;
  const b = req.body || {};
  if (!text(b.company) || !text(b.title)) fail(400, 'Company and title required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_job_posting (app_id, posted_by_alumni_id, company, title, description, employment_type, experience_required, qualification, skills, location, salary_min, salary_max, deadline, contact_email, apply_url, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'draft') RETURNING *
  `, [appIdOf(req), num(b.postedByAlumniId), text(b.company), text(b.title), text(b.description) || '', text(b.employmentType) || 'full_time', text(b.experienceRequired), text(b.qualification), skillsOf(b.skills), text(b.location), num(b.salaryMin), num(b.salaryMax), tsOf(b.deadline) || new Date(Date.now() + 30 * 864e5).toISOString(), text(b.contactEmail), text(b.applyUrl)]);
  res.json({ ok: true, job: rows[0] });
}));
alumniRouter.put('/alumni/jobs/:id', route(async (req, res) => {
  if (!guard(req, res, 'alumni.jobs')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `
    UPDATE school_job_posting SET
      company=coalesce($3,company), title=coalesce($4,title), description=coalesce($5,description),
      employment_type=coalesce($6,employment_type), experience_required=coalesce($7,experience_required),
      qualification=coalesce($8,qualification), skills=coalesce($9,skills), location=coalesce($10,location),
      salary_min=coalesce($11,salary_min), salary_max=coalesce($12,salary_max), deadline=coalesce($13,deadline),
      contact_email=coalesce($14,contact_email), apply_url=coalesce($15,apply_url), updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), id, text(b.company), text(b.title), text(b.description), text(b.employmentType),
    text(b.experienceRequired), text(b.qualification), skillsOf(b.skills), text(b.location),
    num(b.salaryMin), num(b.salaryMax), tsOf(b.deadline), text(b.contactEmail), text(b.applyUrl)]);
  if (!rows[0]) fail(404, 'Job not found');
  res.json({ ok: true, job: rows[0] });
}));
alumniRouter.delete('/alumni/jobs/:id', route(async (req, res) => {
  if (!guard(req, res, 'alumni.jobs')) return;
  const rows = await execQ(getPool(), 'UPDATE school_job_posting SET deleted_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id', [appIdOf(req), num(req.params.id)]);
  if (!rows[0]) fail(404, 'Job not found');
  res.json({ ok: true });
}));
alumniRouter.post('/alumni/jobs/:id/approve', route(async (req, res) => {
  if (!guard(req, res, 'alumni.jobs')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  const status = text(b.status);
  if (!['active','rejected'].includes(status)) fail(400, 'Invalid status');
  const rows = await execQ(getPool(), `UPDATE school_job_posting SET status=$3, approved_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *`, [appIdOf(req), id, status === 'active' ? 'active' : 'rejected']);
  if (!rows[0]) fail(404, 'Job not found');
  res.json({ ok: true, job: rows[0] });
}));
alumniRouter.get('/alumni/jobs/listings', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const location = text(req.query.location);
  const type = text(req.query.type);
  const rows = await execQ(getPool(), `SELECT * FROM school_job_posting WHERE app_id=$1 AND status='active' AND deadline >= now() ${location ? 'AND location ILIKE $2' : ''} ${type ? 'AND employment_type=$3' : ''} ORDER BY deadline`, [appIdOf(req), location, type].filter(Boolean));
  res.json({ ok: true, jobs: rows });
}));
// Donations
alumniRouter.get('/alumni/donations/campaigns', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const status = text(req.query.status);
  const rows = await execQ(getPool(), `SELECT c.*, (SELECT count(*) FROM school_donation d WHERE d.campaign_id=c.id AND d.status='successful') as donor_count FROM school_donation_campaign c WHERE c.app_id=$1 AND c.deleted_at IS NULL ${status ? 'AND c.status=$2' : ''} ORDER BY c.start_dt`, [appIdOf(req), status].filter(Boolean));
  res.json({ ok: true, campaigns: rows });
}));
alumniRouter.post('/alumni/donations/campaigns', route(async (req, res) => {
  if (!guard(req, res, 'alumni.donations')) return;
  const b = req.body || {};
  if (!text(b.title)) fail(400, 'Title required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_donation_campaign (app_id, title, description, category, target_amount, start_dt, end_dt, status, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
  `, [appIdOf(req), text(b.title), text(b.description), text(b.category) || 'general', num(b.targetAmount) || 0, dayOf(b.startDt) || dayOf(new Date()), dayOf(b.endDt), text(b.status) || 'draft', userOf(req)]);
  res.json({ ok: true, campaign: rows[0] });
}));

alumniRouter.put('/alumni/donations/campaigns/:id', route(async (req, res) => {
  if (!guard(req, res, 'alumni.donations')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `
    UPDATE school_donation_campaign SET
      title=coalesce($3,title), description=coalesce($4,description), category=coalesce($5,category),
      target_amount=coalesce($6,target_amount), start_dt=coalesce($7,start_dt), end_dt=coalesce($8,end_dt),
      status=coalesce($9,status), updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), id, text(b.title), text(b.description), text(b.category), num(b.targetAmount),
    dayOf(b.startDt), dayOf(b.endDt), text(b.status)]);
  if (!rows[0]) fail(404, 'Campaign not found');
  res.json({ ok: true, campaign: rows[0] });
}));

alumniRouter.delete('/alumni/donations/campaigns/:id', route(async (req, res) => {
  if (!guard(req, res, 'alumni.donations')) return;
  const rows = await execQ(getPool(), 'UPDATE school_donation_campaign SET deleted_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id', [appIdOf(req), num(req.params.id)]);
  if (!rows[0]) fail(404, 'Campaign not found');
  res.json({ ok: true });
}));
alumniRouter.post('/alumni/donations/campaigns/:id/donate', route(async (req, res) => {
  if (!guard(req, res, 'alumni.donations')) return;
  const b = req.body || {};
  const campaignId = num(req.params.id);
  if (!num(b.amount) || num(b.amount) <= 0) fail(400, 'Amount required');
  const campaign = (await execQ(getPool(), `SELECT * FROM school_donation_campaign WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL`, [appIdOf(req), campaignId]))[0];
  if (!campaign) fail(404, 'Campaign not found');
  const donorId = num(b.donorId);
  const donorType = text(b.donorType) || 'alumni';
  const rows = await execQ(getPool(), `
    INSERT INTO school_donation (app_id, campaign_id, donor_id, donor_type, donor_name, donor_email, donor_phone, amount, payment_mode, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'initiated') RETURNING *
  `, [appIdOf(req), campaignId, donorId, text(b.donorType) || 'alumni', text(b.donorName), text(b.donorEmail), text(b.donorPhone), num(b.amount), text(b.paymentMode) || 'online']);
  // Simulate payment success
  await execQ(getPool(), `UPDATE school_donation SET status='successful', donated_at=now(), payment_ref=$3 WHERE app_id=$1 AND id=$2`, [appIdOf(req), rows[0].id, 'pay_' + Date.now()]);
  // Generate receipt
  const receiptNo = `RCP-${Date.now()}`;
  await execQ(getPool(), `INSERT INTO school_donation_receipt (app_id, donation_id, receipt_no, generated_by) VALUES ($1,$2,$3,$4)`, [appIdOf(req), rows[0].id, receiptNo, userOf(req)]);
  res.json({ ok: true, donation: rows[0], receiptNo });
}));
export { alumniRouter };