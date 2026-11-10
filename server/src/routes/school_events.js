/* ============================================================
   Events & PTM — backend routes
   Mounted at /api/school before the legacy comprehensive router.
   ============================================================ */
import express from 'express';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { ensureFoundation, loadAccess, writeAudit } from '../school/foundation.js';

const eventsRouter = express.Router();

eventsRouter.use(verifyToken);
eventsRouter.use(async (req, _res, next) => {
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
const appIdOf = (req) => req.school?.appId || 'default';
const userOf = (req) => req.user?.userid || req.user?.id || 'system';
const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };

function guard(req, res, perm) {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('events.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}
function guardView(req, res, perm = 'events.view') {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('events.view') || perms.includes('events.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

// Dashboard
eventsRouter.get('/events/dashboard', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const [summary] = await execQ(pool, `
    SELECT
      (SELECT count(*)::int FROM school_event WHERE app_id=$1 AND status='published' AND start_dt >= CURRENT_DATE) AS upcoming_events,
      (SELECT count(*)::int FROM school_event WHERE app_id=$1 AND status='registration_open') AS open_registrations,
      (SELECT count(*)::int FROM school_ptm_schedule WHERE app_id=$1 AND status='booking_open') AS open_ptm_bookings,
      (SELECT count(*)::int FROM school_gallery_album WHERE app_id=$1 AND deleted_at IS NULL) AS albums
  `, [appId]);
  res.json({ ok: true, summary });
}));

// Events
eventsRouter.get('/events/calendar', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const start = text(req.query.start);
  const end = text(req.query.end);
  const rows = await execQ(getPool(), `SELECT e.*, (SELECT count(*) FROM school_event_registration r WHERE r.event_id=e.id AND r.status='confirmed') as confirmed_count FROM school_event e WHERE e.app_id=$1 AND e.deleted_at IS NULL AND e.start_dt >= $2 AND e.start_dt <= $3 ORDER BY e.start_dt`, [appIdOf(req), start, end]);
  res.json({ ok: true, events: rows });
}));

eventsRouter.get('/events', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const status = text(req.query.status);
  const rows = await execQ(getPool(), `SELECT e.*, (SELECT count(*) FROM school_event_registration r WHERE r.event_id=e.id AND r.status='confirmed') as confirmed_count FROM school_event e WHERE e.app_id=$1 AND e.deleted_at IS NULL ${status ? 'AND e.status=$2' : ''} ORDER BY e.start_dt DESC LIMIT 200`, [appIdOf(req), status].filter(Boolean));
  res.json({ ok: true, events: rows });
}));

eventsRouter.post('/events', route(async (req, res) => {
  if (!guard(req, res, 'events.calendar')) return;
  const b = req.body || {};
  if (!text(b.title) || !b.startDt) fail(400, 'Title and start date required');
  const start = tsOf(b.startDt);
  const end = tsOf(b.endDt) || start;
  const rows = await execQ(getPool(), `
    INSERT INTO school_event (app_id, title, description, category, start_dt, end_dt, venue, organizer_id, max_participants, registration_deadline, status, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
  `, [appIdOf(req), text(b.title), text(b.description), text(b.category), start, end, text(b.venue), num(b.organizerId), num(b.maxParticipants), tsOf(b.registrationDeadline), text(b.status) || 'draft', userOf(req)]);
  await writeAudit(getPool(), req, { action: 'events.event.create', entity: 'school_event', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, event: rows[0] });
}));

eventsRouter.put('/events/:id', route(async (req, res) => {
  if (!guard(req, res, 'events.calendar')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `
    UPDATE school_event SET title=coalesce($3,title), description=coalesce($4,description), category=coalesce($5,category), start_dt=coalesce($6,start_dt), end_dt=coalesce($7,end_dt), venue=coalesce($8,venue), organizer_id=coalesce($9,organizer_id), max_participants=coalesce($10,max_participants), registration_deadline=coalesce($11,registration_deadline), updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), id, text(b.title), text(b.description), text(b.category), tsOf(b.startDt), tsOf(b.endDt), text(b.venue), num(b.organizerId), num(b.maxParticipants), tsOf(b.registrationDeadline)]);
  if (!rows[0]) fail(404, 'Event not found');
  await writeAudit(getPool(), req, { action: 'events.event.update', entity: 'school_event', entityId: id, after: rows[0] });
  res.json({ ok: true, event: rows[0] });
}));

eventsRouter.put('/events/:id/status', route(async (req, res) => {
  if (!guard(req, res, 'events.calendar')) return;
  const status = text(req.body?.status);
  if (!['draft','published','registration_open','registration_closed','completed','cancelled'].includes(status)) fail(400, 'Invalid status');
  const id = num(req.params.id);
  const rows = await execQ(getPool(), 'UPDATE school_event SET status=$3, updated_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *', [appIdOf(req), id, status]);
  if (!rows[0]) fail(404, 'Event not found');
  await writeAudit(getPool(), req, { action: 'events.event.status', entity: 'school_event', entityId: id, after: rows[0] });
  res.json({ ok: true, event: rows[0] });
}));

eventsRouter.delete('/events/:id', route(async (req, res) => {
  if (!guard(req, res, 'events.calendar')) return;
  const id = num(req.params.id);
  const rows = await execQ(getPool(), 'UPDATE school_event SET deleted_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id', [appIdOf(req), id]);
  if (!rows[0]) fail(404, 'Event not found');
  await writeAudit(getPool(), req, { action: 'events.event.delete', entity: 'school_event', entityId: id });
  res.json({ ok: true });
}));

// Audience
eventsRouter.get('/events/:id/audience', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `SELECT * FROM school_event_audience WHERE app_id=$1 AND event_id=$2`, [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true, audience: rows });
}));

eventsRouter.post('/events/:id/audience', route(async (req, res) => {
  if (!guard(req, res, 'events.calendar')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), `INSERT INTO school_event_audience (app_id, event_id, audience_type, class_id, section_id) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [appIdOf(req), num(req.params.id), text(b.audienceType) || 'all', num(b.classId), num(b.sectionId)]);
  res.json({ ok: true, audience: rows[0] });
}));

eventsRouter.delete('/events/:id/audience/:audId', route(async (req, res) => {
  if (!guard(req, res, 'events.calendar')) return;
  const audId = num(req.params.audId);
  const rows = await execQ(getPool(), 'DELETE FROM school_event_audience WHERE app_id=$1 AND id=$2 RETURNING id', [appIdOf(req), audId]);
  if (!rows[0]) fail(404, 'Audience not found');
  res.json({ ok: true });
}));

// Registrations
eventsRouter.get('/events/:id/registrations', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `SELECT r.*, s.first_name, s.last_name, s.admission_no, cl.name as class_name FROM school_event_registration r LEFT JOIN school_students s ON s.id=r.student_id LEFT JOIN school_classes cl ON cl.id=s.class_id WHERE r.app_id=$1 AND r.event_id=$2 ORDER BY r.registered_at`, [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true, registrations: rows });
}));

eventsRouter.post('/events/:id/registrations', route(async (req, res) => {
  if (!guard(req, res, 'events.view')) return;
  const b = req.body || {};
  const eventId = num(req.params.id);
  const studentId = num(b.studentId);
  if (!studentId) fail(400, 'Student required');
  const event = (await execQ(getPool(), `SELECT * FROM school_event WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL`, [appIdOf(req), eventId]))[0];
  if (!event) fail(404, 'Event not found');
  if (event.max_participants) {
    const confirmed = (await execQ(getPool(), `SELECT count(*)::int as c FROM school_event_registration WHERE app_id=$1 AND event_id=$2 AND status='confirmed'`, [appIdOf(req), eventId]))[0].c;
    if (confirmed >= event.max_participants) {
      const waitlistPos = (await execQ(getPool(), `SELECT count(*)::int as c FROM school_event_registration WHERE app_id=$1 AND event_id=$2 AND status='waitlisted'`, [appIdOf(req), eventId]))[0].c + 1;
      const rows = await execQ(getPool(), `INSERT INTO school_event_registration (app_id, event_id, student_id, status, waitlist_pos) VALUES ($1,$2,$3,'waitlisted',$4) RETURNING *`, [appIdOf(req), eventId, studentId, waitlistPos]);
      return res.json({ ok: true, registration: rows[0], waitlisted: true, position: waitlistPos });
    }
  }
  const rows = await execQ(getPool(), `INSERT INTO school_event_registration (app_id, event_id, student_id, status) VALUES ($1,$2,$3,'confirmed') RETURNING *`, [appIdOf(req), eventId, studentId]);
  res.json({ ok: true, registration: rows[0] });
}));

// Attendance
eventsRouter.get('/events/:id/attendance', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `SELECT a.*, s.first_name, s.last_name, s.admission_no FROM school_event_attendance a LEFT JOIN school_students s ON s.id=a.student_id WHERE a.app_id=$1 AND a.event_id=$2`, [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true, attendance: rows });
}));

eventsRouter.post('/events/:id/attendance', route(async (req, res) => {
  if (!guard(req, res, 'events.calendar')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), `
    INSERT INTO school_event_attendance (app_id, event_id, student_id, attendance_status, marked_by)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (app_id, event_id, student_id) DO UPDATE SET attendance_status=$4, marked_by=$5, marked_at=now() RETURNING *
  `, [appIdOf(req), num(req.params.id), num(b.studentId), text(b.status) || 'present', userOf(req)]);
  res.json({ ok: true, attendance: rows[0] });
}));

// PTM Schedule
eventsRouter.get('/events/ptm/schedules', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `SELECT p.*, cl.name as class_name, sec.name as section_name,
      (SELECT count(*)::int FROM school_ptm_slot s WHERE s.schedule_id=p.id AND s.deleted_at IS NULL) AS slot_count,
      (SELECT count(*)::int FROM school_ptm_booking b JOIN school_ptm_slot s ON s.id=b.slot_id
        WHERE s.schedule_id=p.id AND b.status='booked' AND b.deleted_at IS NULL) AS booked_count
    FROM school_ptm_schedule p
    LEFT JOIN school_classes cl ON cl.id=p.class_id
    LEFT JOIN school_sections sec ON sec.id=p.section_id
    WHERE p.app_id=$1 AND p.deleted_at IS NULL ORDER BY p.ptm_date DESC`, [appIdOf(req)]);
  res.json({ ok: true, schedules: rows });
}));

async function defaultSessionId(appId) {
  const rows = await execQ(getPool(), `SELECT id FROM school_academic_years WHERE app_id=$1 AND is_active=true ORDER BY id DESC LIMIT 1`, [appId]);
  if (rows[0]) return rows[0].id;
  const any = await execQ(getPool(), `SELECT id FROM school_academic_years WHERE app_id=$1 ORDER BY id DESC LIMIT 1`, [appId]);
  return any[0]?.id || null;
}

eventsRouter.post('/events/ptm/schedules', route(async (req, res) => {
  if (!guard(req, res, 'events.ptm')) return;
  const b = req.body || {};
  if (!b.ptmDate || !num(b.classId)) fail(400, 'Date and class required');
  const appId = appIdOf(req);
  const sessionId = num(b.sessionId) || await defaultSessionId(appId);
  if (!sessionId) fail(400, 'Academic session required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_ptm_schedule (app_id, session_id, ptm_date, class_id, section_id, booking_deadline, status, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
  `, [appId, sessionId, dayOf(b.ptmDate), num(b.classId), num(b.sectionId), dayOf(b.bookingDeadline), text(b.status) || 'draft', userOf(req)]);
  res.json({ ok: true, schedule: rows[0] });
}));

eventsRouter.put('/events/ptm/schedules/:id', route(async (req, res) => {
  if (!guard(req, res, 'events.ptm')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `
    UPDATE school_ptm_schedule SET
      ptm_date=coalesce($3,ptm_date), class_id=coalesce($4,class_id), section_id=coalesce($5,section_id),
      booking_deadline=coalesce($6,booking_deadline), status=coalesce($7,status), updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), id, dayOf(b.ptmDate), num(b.classId), num(b.sectionId), dayOf(b.bookingDeadline), text(b.status)]);
  if (!rows[0]) fail(404, 'Schedule not found');
  res.json({ ok: true, schedule: rows[0] });
}));

eventsRouter.delete('/events/ptm/schedules/:id', route(async (req, res) => {
  if (!guard(req, res, 'events.ptm')) return;
  const rows = await execQ(getPool(), 'UPDATE school_ptm_schedule SET deleted_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id', [appIdOf(req), num(req.params.id)]);
  if (!rows[0]) fail(404, 'Schedule not found');
  res.json({ ok: true });
}));

eventsRouter.put('/events/ptm/schedules/:id/status', route(async (req, res) => {
  if (!guard(req, res, 'events.ptm')) return;
  const status = text(req.body?.status);
  if (!['draft','availability_open','booking_open','completed','cancelled'].includes(status)) fail(400, 'Invalid status');
  const id = num(req.params.id);
  const rows = await execQ(getPool(), 'UPDATE school_ptm_schedule SET status=$3, updated_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *', [appIdOf(req), id, status]);
  if (!rows[0]) fail(404, 'Schedule not found');
  res.json({ ok: true, schedule: rows[0] });
}));

// PTM Slots
eventsRouter.get('/events/ptm/schedules/:id/slots', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `SELECT s.*, st.name as teacher_name,
      (SELECT count(*)::int FROM school_ptm_booking b WHERE b.slot_id=s.id AND b.status='booked' AND b.deleted_at IS NULL) AS booked_count
    FROM school_ptm_slot s
    LEFT JOIN school_staff st ON st.id=s.teacher_id
    WHERE s.app_id=$1 AND s.schedule_id=$2 AND s.deleted_at IS NULL ORDER BY s.start_time`, [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true, slots: rows });
}));

eventsRouter.post('/events/ptm/schedules/:id/slots', route(async (req, res) => {
  if (!guard(req, res, 'events.ptm')) return;
  const b = req.body || {};
  if (!num(b.teacherId) || !b.startTime || !b.endTime) fail(400, 'Teacher, start and end time required');
  // Check overlap
  const overlap = await execQ(getPool(), `SELECT 1 FROM school_ptm_slot WHERE app_id=$1 AND schedule_id=$2 AND teacher_id=$3 AND status!='blocked' AND deleted_at IS NULL AND (start_time < $4 AND end_time > $5) LIMIT 1`, [appIdOf(req), num(req.params.id), num(b.teacherId), b.endTime, b.startTime]);
  if (overlap[0]) fail(400, 'Teacher has overlapping slot');
  const rows = await execQ(getPool(), `INSERT INTO school_ptm_slot (app_id, schedule_id, teacher_id, start_time, end_time, max_bookings, status) VALUES ($1,$2,$3,$4,$5,$6,'available') RETURNING *`, [appIdOf(req), num(req.params.id), num(b.teacherId), b.startTime, b.endTime, num(b.maxBookings) || 1]);
  res.json({ ok: true, slot: rows[0] });
}));

eventsRouter.delete('/events/ptm/slots/:id', route(async (req, res) => {
  if (!guard(req, res, 'events.ptm')) return;
  const rows = await execQ(getPool(), 'UPDATE school_ptm_slot SET deleted_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id', [appIdOf(req), num(req.params.id)]);
  if (!rows[0]) fail(404, 'Slot not found');
  res.json({ ok: true });
}));

// PTM Bookings
eventsRouter.get('/events/ptm/bookings', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const scheduleId = num(req.query.scheduleId);
  const rows = await execQ(getPool(), `SELECT b.*, s.start_time, s.end_time, s.schedule_id,
      st.name as teacher_name, stu.first_name, stu.last_name, stu.admission_no
    FROM school_ptm_booking b
    LEFT JOIN school_ptm_slot s ON s.id=b.slot_id
    LEFT JOIN school_staff st ON st.id=s.teacher_id
    LEFT JOIN school_students stu ON stu.id=b.student_id
    WHERE b.app_id=$1 AND b.deleted_at IS NULL ${scheduleId ? 'AND s.schedule_id=$2' : ''}
    ORDER BY s.start_time`, [appIdOf(req), scheduleId].filter(Boolean));
  res.json({ ok: true, bookings: rows });
}));

// PTM Booking
eventsRouter.post('/events/ptm/slots/:id/book', route(async (req, res) => {
  if (!guard(req, res, 'events.ptm')) return;
  const slotId = num(req.params.id);
  const studentId = num(req.body?.studentId);
  if (!studentId) fail(400, 'Student required');
  // Atomic booking with row lock
  const result = await execQ(getPool(), `
    WITH slot AS (
      SELECT * FROM school_ptm_slot WHERE app_id=$1 AND id=$2 AND status='available' AND deleted_at IS NULL FOR UPDATE
    ),
    existing AS (
      SELECT 1 FROM school_ptm_booking WHERE app_id=$1 AND slot_id=$2 AND student_id=$3 AND status='booked' AND deleted_at IS NULL
    ),
    insert_booking AS (
      INSERT INTO school_ptm_booking (app_id, slot_id, student_id, status)
      SELECT $1,$2,$3,'booked'
      WHERE NOT EXISTS (SELECT 1 FROM existing)
      RETURNING *
    )
    SELECT * FROM insert_booking
  `, [appIdOf(req), slotId, studentId]);
  if (!result[0]) fail(400, 'Slot unavailable or already booked');
  res.json({ ok: true, booking: result[0] });
}));

eventsRouter.put('/events/ptm/bookings/:id', route(async (req, res) => {
  if (!guard(req, res, 'events.ptm')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  if (b.newSlotId) {
    // Reschedule: atomic swap
    const result = await execQ(getPool(), `
      WITH old_booking AS (
        SELECT * FROM school_ptm_booking WHERE app_id=$1 AND id=$2 AND status='booked' FOR UPDATE
      ),
      new_slot AS (
        SELECT * FROM school_ptm_slot WHERE app_id=$1 AND id=$3 AND status='available' AND deleted_at IS NULL FOR UPDATE
      ),
      update_old AS (
        UPDATE school_ptm_booking SET status='cancelled', updated_at=now() WHERE app_id=$1 AND id=$2 RETURNING *
      ),
      insert_new AS (
        INSERT INTO school_ptm_booking (app_id, slot_id, student_id, status, rescheduled_from)
        SELECT $1,$3,student_id,'booked',$2 FROM old_booking
        RETURNING *
      )
      SELECT * FROM insert_new
    `, [appIdOf(req), id, num(b.newSlotId)]);
    if (!result[0]) fail(400, 'Cannot reschedule');
    return res.json({ ok: true, booking: result[0] });
  }
  const rows = await execQ(getPool(), 'UPDATE school_ptm_booking SET status=coalesce($3,status), updated_at=now() WHERE app_id=$1 AND id=$2 RETURNING *', [appIdOf(req), id, text(b.status)]);
  if (!rows[0]) fail(404, 'Booking not found');
  res.json({ ok: true, booking: rows[0] });
}));

// PTM Remarks
eventsRouter.post('/events/ptm/bookings/:id/remarks', route(async (req, res) => {
  if (!guard(req, res, 'events.ptm')) return;
  const b = req.body || {};
  const teacherId = num(b.teacherId);
  if (!teacherId) fail(400, 'Teacher required');
  const rows = await execQ(getPool(), `INSERT INTO school_ptm_remarks (app_id, booking_id, teacher_id, remarks, followup_dt) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [appIdOf(req), num(req.params.id), teacherId, text(b.remarks), dayOf(b.followupDt)]);
  res.json({ ok: true, remarks: rows[0] });
}));

// Gallery
eventsRouter.get('/events/gallery/albums', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `SELECT a.*, (SELECT count(*) FROM school_gallery_media m WHERE m.album_id=a.id AND m.approved) as media_count FROM school_gallery_album a WHERE a.app_id=$1 AND a.deleted_at IS NULL ORDER BY a.created_at DESC`, [appIdOf(req)]);
  res.json({ ok: true, albums: rows });
}));

eventsRouter.post('/events/gallery/albums', route(async (req, res) => {
  if (!guard(req, res, 'events.gallery')) return;
  const b = req.body || {};
  if (!text(b.title)) fail(400, 'Title required');
  const rows = await execQ(getPool(), `INSERT INTO school_gallery_album (app_id, event_id, title, description, visibility, class_id, section_id, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [appIdOf(req), num(b.eventId), text(b.title), text(b.description), text(b.visibility) || 'private', num(b.classId), num(b.sectionId), userOf(req)]);
  res.json({ ok: true, album: rows[0] });
}));

eventsRouter.put('/events/gallery/albums/:id', route(async (req, res) => {
  if (!guard(req, res, 'events.gallery')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `
    UPDATE school_gallery_album SET
      title=coalesce($3,title), description=coalesce($4,description), visibility=coalesce($5,visibility),
      event_id=coalesce($6,event_id), class_id=coalesce($7,class_id), section_id=coalesce($8,section_id),
      updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), id, text(b.title), text(b.description), text(b.visibility), num(b.eventId), num(b.classId), num(b.sectionId)]);
  if (!rows[0]) fail(404, 'Album not found');
  res.json({ ok: true, album: rows[0] });
}));

eventsRouter.delete('/events/gallery/albums/:id', route(async (req, res) => {
  if (!guard(req, res, 'events.gallery')) return;
  const rows = await execQ(getPool(), 'UPDATE school_gallery_album SET deleted_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id', [appIdOf(req), num(req.params.id)]);
  if (!rows[0]) fail(404, 'Album not found');
  res.json({ ok: true });
}));

eventsRouter.get('/events/gallery/albums/:id/media', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `SELECT m.*, f.original_name, f.storage_path FROM school_gallery_media m LEFT JOIN school_files f ON f.id=m.file_id WHERE m.app_id=$1 AND m.album_id=$2 AND m.deleted_at IS NULL ORDER BY m.created_at DESC`, [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true, media: rows });
}));

eventsRouter.delete('/events/gallery/media/:id', route(async (req, res) => {
  if (!guard(req, res, 'events.gallery')) return;
  const rows = await execQ(getPool(), 'UPDATE school_gallery_media SET deleted_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id', [appIdOf(req), num(req.params.id)]);
  if (!rows[0]) fail(404, 'Media not found');
  res.json({ ok: true });
}));

eventsRouter.post('/events/gallery/albums/:id/media', route(async (req, res) => {
  if (!guard(req, res, 'events.gallery')) return;
  const b = req.body || {};
  if (!num(b.fileId)) fail(400, 'File required');
  const rows = await execQ(getPool(), `INSERT INTO school_gallery_media (app_id, album_id, file_id, media_type, uploaded_by, approved) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [appIdOf(req), num(req.params.id), num(b.fileId), text(b.mediaType) || 'image', userOf(req), bool(b.approved)]);
  res.json({ ok: true, media: rows[0] });
}));

eventsRouter.put('/events/gallery/media/:id/approve', route(async (req, res) => {
  if (!guard(req, res, 'events.gallery')) return;
  const approved = bool(req.body?.approved);
  const rows = await execQ(getPool(), `UPDATE school_gallery_media SET approved=$3, approved_by=$4, approved_at=now() WHERE app_id=$1 AND id=$2 RETURNING *`, [appIdOf(req), num(req.params.id), approved, userOf(req)]);
  if (!rows[0]) fail(404, 'Media not found');
  res.json({ ok: true, media: rows[0] });
}));

export { eventsRouter };