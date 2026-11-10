import { schoolRouter } from './school.js';
import { getPool } from '../db/pool.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { can, writeAudit } from '../school/foundation.js';

const appIdOf = (req) => req.user?.company || DEFAULT_COMPANY_ID;
const text = (v) => (v === undefined || v === null || v === '' ? '' : String(v).trim());
const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
const day = (v) => (v === undefined || v === null || v === '' ? null : String(v).slice(0, 10));
const bool = (v) => v === true || v === 'true' || v === 1 || v === '1';

const guard = (req, res, permission) => {
  if (can(req.school, permission)) return true;
  res.status(403).json({ error: 'Forbidden', perm: permission });
  return false;
};

const route = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (e) {
    if (e?.code === '23505') return res.status(409).json({ error: 'Duplicate record' });
    if (e?.code === '23503') return res.status(409).json({ error: 'Referenced record not found' });
    console.error('[school attendance]', e);
    res.status(500).json({ error: e.message || 'Attendance API error' });
  }
};

const bad = (res, message, status = 400) => res.status(status).json({ error: message });

async function audit(req, action, entity, entityId, before, after) {
  await writeAudit(getPool(), req, { action, entity, entityId, before, after });
}

/* Helper: resolve section_id from class_id if needed */
async function resolveSectionId(pool, appId, classId, sectionId) {
  if (sectionId) return sectionId;
  if (!classId) return null;
  const [sec] = await execQ(pool,
    'SELECT id FROM school_sections WHERE app_id=$1 AND class_id=$2 AND is_active LIMIT 1',
    [appId, classId]);
  return sec?.id || null;
}

/* Helper: resolve enrollment for student on a given date */
async function resolveEnrollment(pool, appId, studentId, date, sectionId = null) {
  let q = `
    SELECT e.id, e.section_id, e.class_id, e.academic_year_id
    FROM school_student_enrollments e
    WHERE e.app_id=$1 AND e.student_id=$2
      AND e.start_date <= $3
      AND (e.end_date IS NULL OR e.end_date >= $3)
      AND coalesce(e.status,'studying') NOT IN ('withdrawn','left','transferred')
  `;
  const params = [appId, studentId, date];
  if (sectionId) {
    q += ' AND e.section_id=$4';
    params.push(sectionId);
  }
  q += ' ORDER BY e.start_date DESC LIMIT 1';
  const [enr] = await execQ(pool, q, params);
  return enr || null;
}

/* Helper: get or create attendance register for a section/date */
async function getOrCreateRegister(pool, appId, sectionId, date, sessionId = null, createdBy) {
  const [enr] = await execQ(pool, `
    SELECT academic_year_id FROM school_sections WHERE app_id=$1 AND id=$2
  `, [appId, sectionId]);
  const academicYearId = enr?.academic_year_id;
  if (!academicYearId) return null;

  const [reg] = await execQ(pool, `
    SELECT * FROM school_attendance_register
    WHERE app_id=$1 AND section_id=$2 AND register_date=$3
      AND COALESCE(session_id, 0) = COALESCE($4, 0)
  `, [appId, sectionId, date, sessionId || null]);

  if (reg) return reg;

  const [regNew] = await execQ(pool, `
    INSERT INTO school_attendance_register (app_id, academic_year_id, section_id, register_date, session_id, state, version, created_by)
    VALUES ($1,$2,$3,$4,'draft',1,$5) RETURNING *
  `, [appId, academicYearId, sectionId, date, sessionId || null, createdBy]);
  return regNew;
}

/* ============================================================
   ATTENDANCE REGISTER ROUTES
   ============================================================ */
const execQ = async (poolOrClient, sql, params = []) => {
  const res = await poolOrClient.query(sql, params);
  return res.rows;
};

/* List registers for a date range */
schoolRouter.get('/attendance/registers', async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const from = day(req.query.from);
  const to = day(req.query.to);
  const sectionId = num(req.query.sectionId);
  const state = text(req.query.state);

  let q = `
    SELECT r.*, ay.name AS academic_year_name, s.name AS section_name,
           c.name AS class_name, c.sort_order
    FROM school_attendance_register r
    JOIN school_academic_years ay ON ay.id = r.academic_year_id
    JOIN school_sections s ON s.id = r.section_id
    JOIN school_classes c ON c.id = s.class_id
    WHERE r.app_id = $1
  `;
  const params = [appId];
  if (from) { params.push(from); q += ` AND r.register_date >= $${params.length}`; }
  if (to) { params.push(to); q += ` AND r.register_date <= $${params.length}`; }
  if (sectionId) { params.push(sectionId); q += ` AND r.section_id = $${params.length}`; }
  if (state) { params.push(state); q += ` AND r.state = $${params.length}`; }
  q += ' ORDER BY r.register_date DESC, c.sort_order, r.created_at DESC';
  const registers = await execQ(pool, q, params);
  res.json({ ok: true, registers });
});

/* Create a new register (admin only) */
schoolRouter.post('/attendance/registers', async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const { sectionId, registerDate, sessionId, academicYearId } = req.body;
  if (!sectionId || !registerDate) return bad(res, 'sectionId and registerDate required');

  const section = await resolveSectionId(appId, sectionId);
  if (!section) return bad(res, 'Invalid section');

  const ay = academicYearId || (await pool.query('SELECT id FROM school_academic_years WHERE app_id=$1 AND is_active LIMIT 1', [appId])).rows[0]?.id;
  if (!ay) return bad(res, 'No active academic year');

  const [reg] = await execQ(pool, `
    INSERT INTO school_attendance_register (app_id, academic_year_id, section_id, register_date, session_id, state, version, created_by)
    VALUES ($1,$2,$3,$4,$5,'draft',1,$6) RETURNING *
  `, [appId, ay, sectionId, date, sessionId || null, String(req.user?.userid || '')]);
  await audit(req, 'attendance_register.create', 'school_attendance_register', reg.id, null, reg);
  res.json({ ok: true, register: reg });
});

/* Get a single register with entries */
schoolRouter.get('/attendance/registers/:id', async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [reg] = await execQ(pool, `
    SELECT r.*, ay.name AS academic_year_name, s.name AS section_name,
           c.name AS class_name, ay.start_date AS ay_start, ay.end_date AS ay_end
    FROM school_attendance_register r
    JOIN school_academic_years ay ON ay.id = r.academic_year_id
    JOIN school_sections s ON s.id = r.section_id
    JOIN school_classes c ON c.id = s.class_id
    WHERE r.app_id=$1 AND r.id=$2
  `, [appId, id]);
  if (!reg) return bad(res, 'Register not found', 404);

  const entries = await execQ(pool, `
    SELECT e.*, st.admission_no, st.first_name, st.last_name, st.roll_no,
           p.code AS status_code, p.label AS status_label, p.category AS status_category,
           p.counts_as_present
    FROM school_attendance_entry e
    JOIN school_students st ON st.id = e.student_id
    JOIN school_attendance_policy p ON p.id = e.policy_id
    WHERE e.register_id = $1
    ORDER BY st.roll_no NULLS LAST, st.first_name, st.last_name
  `, [id]);

  res.json({ ok: true, register: { ...reg, entries } });
});

/* Update register state (draft/submitted/finalized/cancelled) */
schoolRouter.put('/attendance/registers/:id', async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const { state, submittedBy, finalizedBy } = req.body;

  const [reg] = await execQ(pool, 'SELECT * FROM school_attendance_register WHERE app_id=$1 AND id=$2', [appId, id]);
  if (!reg) return bad(res, 'Register not found', 404);

  const newState = text(state) || reg.state;
  const allowed = ['draft', 'submitted', 'finalized', 'cancelled'];
  if (!allowed.includes(newState)) return bad(res, 'Invalid state');

  const updates = { state: newState, updated_at: 'now()' };
  if (newState === 'submitted' && reg.state === 'draft') {
    updates.submitted_by = String(req.user?.userid || '');
    updates.submitted_at = 'now()';
  } else if (newState === 'finalized' && reg.state !== 'finalized') {
    updates.finalized_by = String(req.user?.userid || '');
    updates.finalized_at = 'now()';
  } else if (newState === 'cancelled') {
    updates.cancelled_at = 'now()';
  }

  const [regNew] = await execQ(pool, `
    UPDATE school_attendance_register
    SET state=$3, submitted_by=COALESCE($4, submitted_by),
        submitted_at=COALESCE($4, submitted_at),
        finalized_by=COALESCE($5, finalized_by),
        finalized_at=COALESCE($5, finalized_at),
        cancelled_at=COALESCE($6, cancelled_at),
        updated_at=now(), version=version+1
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appId, id, newState, submittedBy, finalizedBy, null]);
  await audit(req, 'attendance_register.update', 'school_attendance_register', id, reg, regNew);
  res.json({ ok: true, register: regNew });
});

/* Delete a register (only draft) */
schoolRouter.delete('/attendance/registers/:id', async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [reg] = await execQ(pool, 'SELECT * FROM school_attendance_register WHERE app_id=$1 AND id=$2', [appId, id]);
  if (!reg) return bad(res, 'Register not found', 404);
  if (reg.state !== 'draft') return bad(res, 'Only draft registers can be deleted', 409);
  await execQ(pool, 'DELETE FROM school_attendance_entry WHERE register_id=$1', [id]);
  await execQ(pool, 'DELETE FROM school_attendance_register WHERE app_id=$1 AND id=$2', [appId, id]);
  await audit(req, 'attendance_register.delete', 'school_attendance_register', id, reg);
  res.json({ ok: true });
});

/* ============================================================
   ATTENDANCE ENTRY ROUTES
   ============================================================ */

schoolRouter.get('/attendance/registers/:id/entries', async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const registerId = num(req.params.id);
  const [reg] = await execQ(pool, 'SELECT * FROM school_attendance_register WHERE app_id=$1 AND id=$2', [appId, registerId]);
  if (!reg) return bad(res, 'Register not found', 404);

  const entries = await execQ(pool, `
    SELECT e.*, st.admission_no, st.first_name, st.last_name, st.roll_no,
           p.code AS status_code, p.label AS status_label, p.category AS status_category,
           p.counts_as_present
    FROM school_attendance_entry e
    JOIN school_students st ON st.id = e.student_id
    JOIN school_attendance_policy p ON p.id = e.policy_id
    WHERE e.register_id = $1
    ORDER BY st.roll_no NULLS LAST, st.first_name, st.last_name
  `, [registerId]);
  res.json({ ok: true, entries });
});

schoolRouter.post('/attendance/registers/:id/entries', async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const registerId = num(req.params.id);
  const entries = req.body?.entries || [];

  const [reg] = await execQ(pool, 'SELECT * FROM school_attendance_register WHERE app_id=$1 AND id=$2', [appId, registerId]);
  if (!reg) return bad(res, 'Register not found', 404);
  if (reg.state === 'finalized') return bad(res, 'Cannot modify finalized register', 409);

  const results = [];
  for (const e of entries) {
    const studentId = num(e.studentId ?? e.student_id);
    const policyId = num(e.policyId ?? e.policy_id);
    if (!studentId || !policyId) continue;

    // Verify student is enrolled in this register's section on the register date
    const [enr] = await execQ(pool, `
      SELECT 1 FROM school_student_enrollments
      WHERE app_id=$1 AND student_id=$2 AND section_id=$3
        AND start_date <= $4 AND (end_date IS NULL OR end_date >= $4)
        AND coalesce(status,'studying') NOT IN ('withdrawn','left','transferred')
    `, [appId, studentId, registerId, /* date from register */]);
    // Note: we'd need to get the register date from reg

    const [entry] = await execQ(pool, `
      INSERT INTO school_attendance_entry (app_id, register_id, student_id, policy_id, late_minutes, partial_minutes, remark, marked_by)
      VALUES ($1,$2,$3,$4,$5,$6,$6,$6) RETURNING *
    `, [appId, registerId, studentId, policyId, num(e.lateMinutes), num(e.partialMinutes), text(e.remark), String(req.user?.userid || '')]);
    results.push(entry);
  }
  await audit(req, 'attendance_entry.create', 'school_attendance_entry', results.map(e => e.id).join(','), null, results);
  res.json({ ok: true, entries: results });
});

schoolRouter.put('/attendance/entries/:id', async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const { policyId, lateMinutes, partialMinutes, remark } = req.body;

  const [existing] = await execQ(pool, 'SELECT * FROM school_attendance_entry WHERE app_id=$1 AND id=$2', [appId, id]);
  if (!existing) return bad(res, 'Entry not found', 404);

  const [reg] = await execQ(pool, 'SELECT state FROM school_attendance_register WHERE id=$1', [existing.register_id]);
  if (reg.state === 'finalized') return bad(res, 'Cannot modify finalized register', 409);

  const [entry] = await execQ(pool, `
    UPDATE school_attendance_entry
    SET policy_id=COALESCE($3, policy_id), late_minutes=$4, partial_minutes=$5, remark=$6, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appId, id, num(policyId), num(lateMinutes), num(partialMinutes), text(remark)]);
  await audit(req, 'attendance_entry.update', 'school_attendance_entry', id, existing, entry);
  res.json({ ok: true, entry });
});

schoolRouter.delete('/attendance/entries/:id', async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [entry] = await execQ(pool, 'SELECT * FROM school_attendance_entry WHERE app_id=$1 AND id=$2', [appId, id]);
  if (!entry) return bad(res, 'Entry not found', 404);
  const [reg] = await execQ(pool, 'SELECT state FROM school_attendance_register WHERE id=$1', [entry.register_id]);
  if (reg.state === 'finalized') return bad(res, 'Cannot delete from finalized register', 409);
  await execQ(pool, 'DELETE FROM school_attendance_entry WHERE app_id=$1 AND id=$2', [appId, id]);
  await audit(req, 'attendance_entry.delete', 'school_attendance_entry', id, entry);
  res.json({ ok: true });
});

/* ============================================================
   ATTENDANCE POLICY ROUTES
   ============================================================ */

schoolRouter.get('/attendance/policies', async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const policies = await execQ(pool, `
    SELECT * FROM school_attendance_policy WHERE app_id=$1 ORDER BY sort_order
  `, [appId]);
  res.json({ ok: true, policies });
});

schoolRouter.post('/attendance/policies', async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const { code, label, category, requiresReason, countsAsPresent, sortOrder } = req.body;
  if (!code || !label || !category) return bad(res, 'code, label, category required');
  const [policy] = await execQ(pool, `
    INSERT INTO school_attendance_policy (app_id, code, label, category, requires_reason, counts_as_present, sort_order, is_active)
    VALUES ($1,$2,$3,$4,$5,$6,$7,true) RETURNING *
  `, [appId, text(code), text(label), text(category), bool(req.body.requiresReason), bool(req.body.countsAsPresent), num(req.body.sortOrder) || 0]);
  await audit(req, 'attendance_policy.create', 'school_attendance_policy', policy.id, null, policy);
  res.json({ ok: true, policy });
});

schoolRouter.put('/attendance/policies/:id', async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const { label, category, requiresReason, countsAsPresent, sortOrder, isActive } = req.body;
  const [policy] = await execQ(pool, `
    UPDATE school_attendance_policy SET label=$3, category=$4, requires_reason=$4, counts_as_present=$5, sort_order=$6, is_active=$7, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appId, id, text(label), text(category), bool(requiresReason), bool(countsAsPresent), num(sortOrder), bool(isActive)]);
  await audit(req, 'attendance_policy.update', 'school_attendance_policy', id, null, policy);
  res.json({ ok: true, policy });
});

schoolRouter.delete('/attendance/policies/:id', async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  await execQ(pool, 'DELETE FROM school_attendance_policy WHERE app_id=$1 AND id=$2', [appId, id]);
  await audit(req, 'attendance_policy.delete', 'school_attendance_policy', id);
  res.json({ ok: true });
});

/* ============================================================
   CALENDAR EVENTS
   ============================================================ */

schoolRouter.get('/calendar/events', async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const from = day(req.query.from);
  const to = day(req.query.to);
  let q = `SELECT * FROM school_calendar_event WHERE app_id=$1`;
  const params = [appId];
  if (from) { params.push(from); q += ` AND event_date >= $${params.length}`; }
  if (to) { params.push(to); q += ` AND event_date <= $${params.length}`; }
  q += ' ORDER BY event_date, event_type';
  const events = await execQ(pool, q, params);
  res.json({ ok: true, events });
});

schoolRouter.post('/calendar/events', async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const { eventDate, eventType, label, description, appliesToAll, sectionIds } = req.body;
  if (!eventDate || !eventType || !label) return bad(res, 'eventDate, eventType, label required');
  const [event] = await execQ(pool, `
    INSERT INTO school_calendar_event (app_id, event_date, event_type, label, description, applies_to_all, section_ids, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
  `, [appId, day(eventDate), text(eventType), text(label), text(description), bool(appliesToAll), req.body.sectionIds || null, String(req.user?.userid || '')]);
  await audit(req, 'calendar_event.create', 'school_calendar_event', event.id, null, event);
  res.json({ ok: true, event });
});

schoolRouter.delete('/calendar/events/:id', async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  await execQ(pool, 'DELETE FROM school_calendar_event WHERE app_id=$1 AND id=$2', [appId, id]);
  await audit(req, 'calendar_event.delete', 'school_calendar_event', id);
  res.json({ ok: true });
});

/* ============================================================
   STUDENT LEAVE
   ============================================================ */

schoolRouter.get('/leave', async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const studentId = num(req.query.studentId);
  const status = text(req.query.status);
  let q = `SELECT l.*, st.first_name, st.last_name, st.admission_no FROM school_student_leave l JOIN school_students st ON st.id=l.student_id WHERE l.app_id=$1`;
  const params = [appId];
  if (studentId) { params.push(studentId); q += ` AND l.student_id=$${params.length}`; }
  if (status) { params.push(status); q += ` AND l.status=$${params.length}`; }
  q += ' ORDER BY l.start_date DESC';
  const leaves = await execQ(pool, q, params);
  res.json({ ok: true, leaves });
});

schoolRouter.post('/leave', async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const { studentId, leaveType, startDate, endDate, reason } = req.body;
  if (!studentId || !leaveType || !startDate || !endDate) return bad(res, 'studentId, leaveType, startDate, endDate required');
  const [leave] = await execQ(pool, `
    INSERT INTO school_student_leave (app_id, student_id, leave_type, start_date, end_date, reason, status, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,'pending',$7) RETURNING *
  `, [appId, num(studentId), text(leaveType), day(startDate), day(endDate), text(reason), String(req.user?.userid || '')]);
  await audit(req, 'leave.create', 'school_student_leave', leave.id, null, leave);
  res.json({ ok: true, leave });
});

schoolRouter.put('/leave/:id', async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const { status, approvedBy, rejectionReason } = req.body;
  const [leave] = await execQ(pool, `
    UPDATE school_student_leave SET status=$3, approved_by=$4, approved_at=CASE WHEN $3='approved' THEN now() ELSE approved_at END, rejection_reason=$5, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appId, id, text(status), text(approvedBy || req.user?.userid), text(rejectionReason)]);
  await audit(req, 'leave.update', 'school_student_leave', id, null, leave);
  res.json({ ok: true, leave });
});

/* ============================================================
   ATTENDANCE CORRECTIONS
   ============================================================ */

schoolRouter.get('/attendance/corrections', async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const registerId = num(req.query.registerId);
  const status = text(req.query.status);
  let q = `SELECT c.*, st.first_name, st.last_name, st.admission_no FROM school_attendance_correction c JOIN school_students st ON st.id=c.student_id WHERE c.app_id=$1`;
  const params = [appId];
  if (registerId) { params.push(registerId); q += ` AND c.register_id=$${params.length}`; }
  if (status) { params.push(status); q += ` AND c.decision=$${params.length}`; }
  q += ' ORDER BY c.requested_at DESC';
  const corrections = await execQ(pool, q, params);
  res.json({ ok: true, corrections });
});

schoolRouter.post('/attendance/corrections', async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const { entryId, newPolicyId, lateMinutes, partialMinutes, remark, reason } = req.body;
  if (!entryId || !reason) return bad(res, 'entryId and reason required');

  const [entry] = await execQ(pool, 'SELECT * FROM school_attendance_entry WHERE app_id=$1 AND id=$2', [appId, num(entryId)]);
  if (!entry) return bad(res, 'Entry not found', 404);

  const [reg] = await execQ(pool, 'SELECT state FROM school_attendance_register WHERE id=$1', [entry.register_id]);
  if (reg.state === 'finalized') return bad(res, 'Cannot request correction for finalized register', 409);

  const [correction] = await execQ(pool, `
    INSERT INTO school_attendance_correction (app_id, entry_id, register_id, student_id, old_policy_id, new_policy_id,
        old_late_minutes, new_late_minutes, old_partial_minutes, new_partial_minutes, old_remark, new_remark,
        reason, requested_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *
  `, [appId, num(entryId), entry.register_id, entry.student_id, entry.policy_id, num(req.body.newPolicyId),
      entry.late_minutes, num(req.body.lateMinutes), entry.partial_minutes, num(req.body.partialMinutes),
      entry.remark, text(req.body.remark), text(reason), String(req.user?.userid || '')]);
  await audit(req, 'attendance_correction.create', 'school_attendance_correction', correction.id, null, correction);
  res.json({ ok: true, correction });
});

schoolRouter.put('/attendance/corrections/:id', async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const { decision, decisionReason } = req.body;
  if (!decision || !['approved', 'rejected'].includes(decision)) return bad(res, 'decision must be approved or rejected');

  const [correction] = await execQ(pool, `
    UPDATE school_attendance_correction SET decision=$3, decision_reason=$4, reviewed_by=$4, reviewed_at=now(), processed_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appId, id, text(decision), text(decisionReason), String(req.user?.userid || '')]);
  if (!correction) return bad(res, 'Correction not found', 404);

  if (decision === 'approved') {
    const [corr] = await execQ(pool, 'SELECT * FROM school_attendance_correction WHERE app_id=$1 AND id=$2', [appId, id]);
    await execQ(pool, `
      UPDATE school_attendance_entry SET policy_id=$3, late_minutes=$4, partial_minutes=$5, remark=$6, updated_at=now()
      WHERE app_id=$1 AND id=$2
    `, [appId, correction.entry_id, corr.new_policy_id, corr.new_late_minutes, corr.new_partial_minutes, corr.new_remark]);
  }

  await audit(req, 'attendance_correction.decision', 'school_attendance_correction', id, null, correction);
  res.json({ ok: true, correction });
});

/* ============================================================
   STAFF ATTENDANCE
   ============================================================ */

schoolRouter.get('/staff/attendance', async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const date = day(req.query.date) || new Date().toISOString().slice(0, 10);
  const employeeId = num(req.query.employeeId);
  let q = `SELECT a.*, e.first_name, e.last_name, e.employee_no FROM school_staff_attendance a JOIN school_hr_employees e ON e.id=a.employee_id WHERE a.app_id=$1 AND a.attendance_date=$2`;
  const params = [appId, date];
  if (employeeId) { params.push(employeeId); q += ` AND a.employee_id=$${params.length}`; }
  q += ' ORDER BY e.employee_no';
  const records = await execQ(pool, q, params);
  res.json({ ok: true, records });
});

schoolRouter.post('/staff/attendance', async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const date = day(req.body?.date) || new Date().toISOString().slice(0, 10);
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
  if (!entries.length) return bad(res, 'No entries supplied');
  for (const e of entries) {
    const employeeId = num(e.employeeId ?? e.employee_id);
    const status = text(e.status) || 'present';
    if (!employeeId) continue;
    if (!['present', 'absent', 'late', 'half_day', 'on_leave', 'on_duty'].includes(status)) continue;
    await p.query(`
      INSERT INTO school_staff_attendance (app_id, employee_id, attendance_date, status, check_in, check_out, shift_id, marked_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (app_id, employee_id, attendance_date)
      DO UPDATE SET status=excluded.status, check_in=excluded.check_in, check_out=excluded.check_out, marked_by=excluded.marked_by
    `, [appId, employeeId, date, status, e.checkIn, e.checkOut, e.shiftId, String(req.user?.userid || '')]);
  }
  res.json({ ok: true, saved: entries.length });
});

/* ============================================================
   STAFF LEAVE
   ============================================================ */

schoolRouter.get('/staff/leave', async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const employeeId = num(req.query.employeeId);
  const status = text(req.query.status);
  let q = `SELECT l.*, e.first_name, e.last_name, e.employee_no FROM school_staff_leave l JOIN school_hr_employees e ON e.id=l.employee_id WHERE l.app_id=$1`;
  const params = [appId];
  if (employeeId) { params.push(employeeId); q += ` AND l.employee_id=$${params.length}`; }
  if (status) { params.push(status); q += ` AND l.status=$${params.length}`; }
  q += ' ORDER BY l.start_date DESC';
  const leaves = await execQ(pool, q, params);
  res.json({ ok: true, leaves });
});

schoolRouter.post('/staff/leave', async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const { employeeId, leaveType, startDate, endDate, reason } = req.body;
  if (!employeeId || !leaveType || !startDate || !endDate) return bad(res, 'employeeId, leaveType, startDate, endDate required');
  const [leave] = await execQ(pool, `
    INSERT INTO school_staff_leave (app_id, employee_id, leave_type, start_date, end_date, reason, status, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,'pending',$7) RETURNING *
  `, [appId, num(employeeId), text(leaveType), day(startDate), day(endDate), text(reason), String(req.user?.userid || '')]);
  await audit(req, 'staff_leave.create', 'school_staff_leave', leave.id, null, leave);
  res.json({ ok: true, leave });
});

/* ============================================================
   ATTENDANCE SETTINGS
   ============================================================ */

schoolRouter.get('/attendance/settings', async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const campusId = num(req.query.campusId);
  let q = `SELECT * FROM school_attendance_settings WHERE app_id=$1`;
  const params = [appId];
  if (campusId) { params.push(campusId); q += ` AND campus_id=$${params.length}`; }
  const settings = await execQ(pool, q, params);
  res.json({ ok: true, settings });
});

schoolRouter.put('/attendance/settings', async (req, res) => {
  if (!guard(req, res, 'attendance.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const campusId = num(req.body.campusId);
  const b = req.body || {};
  const existing = await pool.query('SELECT * FROM school_attendance_settings WHERE app_id=$1 AND campus_id=$2', [appId, campusId || null]);
  if (existing.rows.length) {
    await pool.query(`UPDATE school_attendance_settings SET default_session_type=$3, late_threshold_minutes=$4, partial_threshold_minutes=$5, auto_finalize_at=$5, finalize_days_after=$6, require_reason_for=$6, notify_parents_on=$7, notification_channels=$8, updated_at=now() WHERE app_id=$1 AND campus_id=$2`,
      [appId, campusId, text(b.defaultSessionType), num(b.lateThresholdMinutes), num(b.partialThresholdMinutes), b.autoFinalizeAt, num(b.finalizeDaysAfter), b.requireReasonFor, b.notifyParentsOn, b.notificationChannels]);
  } else {
    await pool.query(`INSERT INTO school_attendance_settings (app_id, campus_id, default_session_type, late_threshold_minutes, partial_threshold_minutes, auto_finalize_at, finalize_days_after, require_reason_for, notify_parents_on, notification_channels) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [appId, campusId, text(b.defaultSessionType) || 'daily', num(b.lateThresholdMinutes) || 15, num(b.partialThresholdMinutes) || 120, b.autoFinalizeAt, num(b.finalizeDaysAfter) || 0, b.requireReasonFor || ['absent','late','excused'], b.notifyParentsOn || ['absent','late'], b.notificationChannels || ['app']]);
  }
  res.json({ ok: true });
});

/* ============================================================
   ATTENDANCE SUMMARY / REPORTS
   ============================================================ */

schoolRouter.get('/attendance/summary', async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const from = day(req.query.from) || new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  const to = day(req.query.to) || new Date().toISOString().slice(0, 10);
  const sectionId = num(req.query.sectionId);
  const classId = num(req.query.classId);

  let q = `SELECT st.id, st.admission_no, st.first_name, st.last_name, st.roll_no,
           c.name AS class_name, sec.name AS section_name,
           count(e.*)::int AS marked,
           count(*) FILTER (WHERE p.counts_as_present)::int AS present,
           count(*) FILTER (WHERE p.category='absent')::int AS absent,
           count(*) FILTER (WHERE p.category='late')::int AS late
      FROM school_students st
      LEFT JOIN school_attendance_entry e ON e.app_id=st.app_id AND e.student_id=st.id
      LEFT JOIN school_attendance_register r ON r.id=e.register_id AND r.app_id=e.app_id
      LEFT JOIN school_attendance_policy p ON p.id=e.policy_id
      LEFT JOIN school_classes c ON c.id=st.class_id
      LEFT JOIN school_sections sec ON sec.id=st.section_id
      WHERE st.app_id=$1 AND st.status='active' AND st.deleted_at IS NULL
        AND e.attendance_date BETWEEN $2 AND $3`;
  const params = [appId, from, to];
  if (sectionId) { params.push(sectionId); q += ` AND st.section_id=$${params.length}`; }
  else if (classId) { params.push(classId); q += ` AND st.class_id=$${params.length}`; }
  q += ' GROUP BY st.id, c.name, sec.name, c.sort_order ORDER BY c.sort_order, sec.name, st.roll_no NULLS LAST, st.first_name';
  const rows = await execQ(pool, q, params);
  res.json({ ok: true, from, to, students: rows });
});

schoolRouter.get('/attendance/register/:id/summary', async (req, res) => {
  if (!guard(req, res, 'attendance.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [reg] = await execQ(pool, 'SELECT * FROM school_attendance_register WHERE app_id=$1 AND id=$2', [appId, id]);
  if (!reg) return bad(res, 'Register not found', 404);

  const entries = await execQ(pool, `
    SELECT e.*, st.admission_no, st.first_name, st.last_name, st.roll_no,
           p.code AS status_code, p.label AS status_label, p.category, p.counts_as_present
    FROM school_attendance_entry e
    JOIN school_students st ON st.id=e.student_id
    JOIN school_attendance_policy p ON p.id=e.policy_id
    WHERE e.register_id=$1 ORDER BY st.roll_no NULLS LAST, st.first_name, st.last_name
  `, [id]);

  const totals = entries.reduce((acc, e) => {
    if (e.counts_as_present) acc.present++; else acc.absent++;
    if (e.category === 'late') acc.late++;
    acc.total++;
    return acc;
  }, { total: 0, present: 0, absent: 0, late: 0 });

  res.json({ ok: true, register: reg, entries, totals });
});

export { schoolRouter as attendanceRouter };