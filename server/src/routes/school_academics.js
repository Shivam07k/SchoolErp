import { schoolRouter } from './school.js';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { can, writeAudit } from '../school/foundation.js';
import { findRoomConflicts, roomRow, roomConflictError } from '../school/rooms.js';
import { resolveTeacher } from '../school/staff.js';
import { safeErrorMessage } from '../middleware/error.js';

/* ============================================================
   Academics section API - plan/academics
   Academic years, subject allocation, rooms, homework lifecycle.
   Classes/sections/subjects keep their legacy routes in school.js, with
   validation and archive/restrict behavior added there.
   ============================================================ */

const appIdOf = (req) => req.user?.company || DEFAULT_COMPANY_ID;
const text = (v) => (v === null || v === undefined ? '' : String(v).trim());
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const day = (v) => (v === undefined || v === null || v === '') ? null : (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
const bool = (v) => v === true || v === 'true' || v === 1 || v === '1';

function guard(req, res, permission) {
  if (can(req.school, permission)) return true;
  res.status(403).json({ error: 'You do not have permission for this action' });
  return false;
}

function route(fn) {
  return (req, res) => {
    Promise.resolve(fn(req, res)).catch((err) => {
      if (err?.code === '23505') return res.status(409).json({ error: 'This record already exists' });
      if (err?.code === '23503') return res.status(409).json({ error: 'This record is still referenced' });
      console.error('[school academics]', err.message);
      return res.status(500).json({ error: safeErrorMessage(err, 'Academics API error') });
    });
  };
}

const bad = (res, message, status = 400) => res.status(status).json({ error: message });

async function audit(req, action, entity, entityId, before, after) {
  await writeAudit(getPool(), req, { action, entity, entityId, before, after });
}

/* Full homework management is an office/admin capability. Teachers get the
   granular create/publish/close/archive/grade keys instead of homework.manage. */
function isHomeworkManager(req) {
  return can(req.school, 'academics.manage') || can(req.school, 'homework.manage');
}

/* A teacher account may be linked to an HR employee row, while older records
   store the raw user id as the teacher reference. Accept both identities. */
async function teacherScopeIds(pool, appId, userId) {
  const rows = await execQ(pool, `
    SELECT id::text AS id FROM school_hr_employees
     WHERE app_id=$1 AND user_id=$2 AND coalesce(status, 'active')='active'
  `, [appId, String(userId || '')]);
  const ids = new Set(rows.map((row) => row.id));
  ids.add(String(userId || ''));
  return [...ids];
}

async function canAuthorHomework(pool, appId, req, teacherId) {
  if (isHomeworkManager(req)) return true;
  const ids = await teacherScopeIds(pool, appId, req.user?.userid);
  return ids.includes(String(teacherId ?? ''));
}

/* ---------------- academic years ---------------- */

schoolRouter.get('/academic-years', route(async (req, res) => {
  if (!guard(req, res, 'academics.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const years = await execQ(pool, `
    SELECT y.*,
           (SELECT count(*) FROM school_student_enrollments e
             WHERE e.app_id=y.app_id AND e.academic_year_id=y.id)::int AS enrollments,
           (SELECT count(*) FROM school_subject_allocations a
             WHERE a.app_id=y.app_id AND a.academic_year_id=y.id)::int AS allocations,
           (SELECT count(*) FROM school_homework h
             WHERE h.app_id=y.app_id AND h.academic_year_id=y.id)::int AS homework
      FROM school_academic_years y
     WHERE y.app_id=$1
     ORDER BY y.start_date DESC, y.id DESC
  `, [appId]);
  res.json({ ok: true, years });
}));

function yearInput(body) {
  const name = text(body?.name);
  const startDate = day(body?.startDate || body?.start_date);
  const endDate = day(body?.endDate || body?.end_date);
  if (!name) return { error: 'Academic year name is required' };
  if (!startDate || !endDate) return { error: 'Start and end dates are required' };
  if (Number.isNaN(new Date(startDate).getTime()) || Number.isNaN(new Date(endDate).getTime())) {
    return { error: 'Start and end dates must be valid dates' };
  }
  if (endDate < startDate) return { error: 'End date cannot be before start date' };
  return { data: { name, startDate, endDate } };
}

async function yearOverlap(pool, appId, startDate, endDate, excludeId = null) {
  const params = [appId, startDate, endDate];
  let q = `SELECT id, name FROM school_academic_years
            WHERE app_id=$1 AND start_date <= $3 AND end_date >= $2`;
  if (excludeId) {
    params.push(excludeId);
    q += ` AND id <> $${params.length}`;
  }
  return execQ(pool, q + ' ORDER BY id LIMIT 1', params);
}

schoolRouter.post('/academic-years', route(async (req, res) => {
  if (!guard(req, res, 'academics.manage')) return;
  const input = yearInput(req.body);
  if (input.error) return bad(res, input.error);
  const pool = getPool();
  const appId = appIdOf(req);
  const overlap = await yearOverlap(pool, appId, input.data.startDate, input.data.endDate);
  if (overlap.length) return bad(res, `Dates overlap the existing year ${overlap[0].name}`, 409);
  const [year] = await execQ(pool, `
    INSERT INTO school_academic_years (app_id, name, start_date, end_date, is_active, is_closed)
    VALUES ($1,$2,$3,$4,false,false) RETURNING *
  `, [appId, input.data.name, input.data.startDate, input.data.endDate]);
  await audit(req, 'academic_year.create', 'school_academic_years', year.id, null, year);
  res.json({ ok: true, year });
}));

schoolRouter.put('/academic-years/:id', route(async (req, res) => {
  if (!guard(req, res, 'academics.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [before] = await execQ(pool,
    'SELECT * FROM school_academic_years WHERE app_id=$1 AND id=$2', [appId, id]);
  if (!before) return bad(res, 'Academic year not found', 404);

  const nextClosed = req.body?.isClosed === undefined && req.body?.is_closed === undefined
    ? before.is_closed
    : bool(req.body.isClosed ?? req.body.is_closed);
  const input = yearInput({
    name: req.body?.name ?? before.name,
    startDate: req.body?.startDate ?? req.body?.start_date ?? before.start_date,
    endDate: req.body?.endDate ?? req.body?.end_date ?? before.end_date,
  });
  if (input.error) return bad(res, input.error);
  const changedDates = input.data.startDate !== day(before.start_date) || input.data.endDate !== day(before.end_date);
  if (changedDates) {
    const [{ n }] = await execQ(pool, `
      SELECT (
        (SELECT count(*) FROM school_student_enrollments WHERE app_id=$1 AND academic_year_id=$2) +
        (SELECT count(*) FROM school_subject_allocations WHERE app_id=$1 AND academic_year_id=$2) +
        (SELECT count(*) FROM school_homework WHERE app_id=$1 AND academic_year_id=$2) +
        (SELECT count(*) FROM school_exam_schedules WHERE app_id=$1 AND academic_year_id=$2) +
        (SELECT count(*) FROM school_exam_timetable et
          JOIN school_exam_schedules es ON es.id=et.schedule_id AND es.app_id=et.app_id
         WHERE et.app_id=$1 AND es.academic_year_id=$2)
      )::int AS n
    `, [appId, id]);
    if (n > 0) return bad(res, 'Dates cannot be changed for a year already used by academic records; close it instead', 409);
    const overlap = await yearOverlap(pool, appId, input.data.startDate, input.data.endDate, id);
    if (overlap.length) return bad(res, `Dates overlap the existing year ${overlap[0].name}`, 409);
  }
  const [year] = await execQ(pool, `
    UPDATE school_academic_years
       SET name=$3, start_date=$4, end_date=$5,
           is_closed=$6,
           closed_at=CASE WHEN $6 THEN coalesce(closed_at, now()) ELSE NULL END,
           is_active=CASE WHEN $6 THEN false ELSE is_active END,
           updated_at=now()
     WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appId, id, input.data.name, input.data.startDate, input.data.endDate, nextClosed]);
  await audit(req, 'academic_year.update', 'school_academic_years', id, before, year);
  res.json({ ok: true, year });
}));

schoolRouter.post('/academic-years/:id/activate', route(async (req, res) => {
  if (!guard(req, res, 'academics.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const [year] = await execQ(client,
      'SELECT * FROM school_academic_years WHERE app_id=$1 AND id=$2 FOR UPDATE', [appId, id]);
    if (!year) { await client.query('ROLLBACK'); return bad(res, 'Academic year not found', 404); }
    if (year.is_closed) { await client.query('ROLLBACK'); return bad(res, 'A closed year cannot be activated; reopen it first', 409); }
    await client.query('UPDATE school_academic_years SET is_active=false, updated_at=now() WHERE app_id=$1 AND is_active', [appId]);
    const [active] = await execQ(client,
      'UPDATE school_academic_years SET is_active=true, is_closed=false, closed_at=NULL, updated_at=now() WHERE app_id=$1 AND id=$2 RETURNING *', [appId, id]);
    await client.query('COMMIT');
    await audit(req, 'academic_year.activate', 'school_academic_years', id, null, active);
    res.json({ ok: true, year: active });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}));

schoolRouter.post('/academic-years/:id/close', route(async (req, res) => {
  if (!guard(req, res, 'academics.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [before] = await execQ(pool,
    'SELECT * FROM school_academic_years WHERE app_id=$1 AND id=$2', [appId, id]);
  if (!before) return bad(res, 'Academic year not found', 404);
  const [year] = await execQ(pool, `
    UPDATE school_academic_years
       SET is_active=false, is_closed=true, closed_at=coalesce(closed_at, now()), updated_at=now()
     WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appId, id]);
  await audit(req, 'academic_year.close', 'school_academic_years', id, before, year);
  res.json({ ok: true, year });
}));

schoolRouter.post('/academic-years/:id/reopen', route(async (req, res) => {
  if (!guard(req, res, 'academics.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [year] = await execQ(pool, `
    UPDATE school_academic_years
       SET is_closed=false, closed_at=NULL, updated_at=now()
     WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appId, id]);
  if (!year) return bad(res, 'Academic year not found', 404);
  await audit(req, 'academic_year.reopen', 'school_academic_years', id, null, year);
  res.json({ ok: true, year });
}));

schoolRouter.delete('/academic-years/:id', route(async (req, res) => {
  if (!guard(req, res, 'academics.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [{ n }] = await execQ(pool, `
    SELECT (
      (SELECT count(*) FROM school_student_enrollments WHERE app_id=$1 AND academic_year_id=$2) +
      (SELECT count(*) FROM school_subject_allocations WHERE app_id=$1 AND academic_year_id=$2) +
      (SELECT count(*) FROM school_homework WHERE app_id=$1 AND academic_year_id=$2) +
      (SELECT count(*) FROM school_exam_schedules WHERE app_id=$1 AND academic_year_id=$2) +
      (SELECT count(*) FROM school_exam_timetable et
        JOIN school_exam_schedules es ON es.id=et.schedule_id AND es.app_id=et.app_id
       WHERE et.app_id=$1 AND es.academic_year_id=$2)
    )::int AS n
  `, [appId, id]);
  if (n > 0) return bad(res, 'This year has academic records; close it instead of deleting it', 409);
  const [year] = await execQ(pool, 'SELECT is_active FROM school_academic_years WHERE app_id=$1 AND id=$2', [appId, id]);
  if (!year) return bad(res, 'Academic year not found', 404);
  if (year.is_active) {
    const [{ activeCount }] = await execQ(pool, 'SELECT count(*)::int AS "activeCount" FROM school_academic_years WHERE app_id=$1 AND is_active', [appId]);
    if (activeCount <= 1) return bad(res, 'Cannot delete the only active academic year; activate another year first', 409);
  }
  const rows = await execQ(pool, 'DELETE FROM school_academic_years WHERE app_id=$1 AND id=$2 RETURNING id', [appId, id]);
  await audit(req, 'academic_year.delete', 'school_academic_years', id);
  res.json({ ok: true });
}));

/* ---------------- teacher choices ---------------- */

schoolRouter.get('/academics/teachers', route(async (req, res) => {
  if (!guard(req, res, 'academics.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const employees = await execQ(pool, `
    SELECT e.id::text AS id, trim(e.first_name || ' ' || coalesce(e.last_name, '')) AS name,
           e.designation, 'employee' AS source,
           s.id AS staff_id, s.employee_code
      FROM school_hr_employees e
      LEFT JOIN school_staff s
        ON s.app_id = e.app_id AND s.hr_employee_id = e.id AND s.deleted_at IS NULL
     WHERE e.app_id=$1 AND coalesce(e.status, 'active')='active'
     ORDER BY e.first_name, e.last_name
  `, [appId]);
  const users = await execQ(pool, `
    SELECT "UserId"::text AS id, "UserName" AS name, "Designation" AS designation, 'user' AS source
      FROM "tblHO_User"
     WHERE coalesce("Status", '1')='1'
     ORDER BY "UserName"
  `);
  res.json({ ok: true, teachers: [...employees, ...users] });
}));

/* ---------------- subject catalog read ---------------- */

schoolRouter.get('/subjects', route(async (req, res) => {
  if (!guard(req, res, 'academics.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const where = ['s.app_id=$1'];
  const params = [appId];
  if (!bool(req.query.includeInactive)) where.push('s.is_active=true');
  if (text(req.query.q)) {
    params.push(`%${text(req.query.q)}%`);
    where.push(`(s.name ILIKE $${params.length} OR coalesce(s.code, '') ILIKE $${params.length})`);
  }
  const classId = num(req.query.classId || req.query.class_id);
  if (classId) {
    params.push(classId);
    where.push(`(s.class_id IS NULL OR s.class_id=$${params.length})`);
  }
  const subjects = await execQ(pool, `
    SELECT s.*, c.name AS class_name
      FROM school_subjects s
      LEFT JOIN school_classes c ON c.id=s.class_id AND c.app_id=s.app_id
     WHERE ${where.join(' AND ')}
     ORDER BY s.is_active DESC, c.sort_order NULLS LAST, s.name
  `, params);
  res.json({ ok: true, subjects });
}));

/* ---------------- subject allocation ---------------- */

async function allocationInput(pool, appId, body, existing = null, allowClosed = false) {
  const academicYearId = num(body?.academicYearId ?? body?.academic_year_id) ?? existing?.academic_year_id ?? null;
  const classId = num(body?.classId ?? body?.class_id) ?? existing?.class_id ?? null;
  const sectionId = num(body?.sectionId ?? body?.section_id) ?? existing?.section_id ?? null;
  const subjectId = num(body?.subjectId ?? body?.subject_id) ?? existing?.subject_id ?? null;
  const teacherId = text(body?.teacherId ?? body?.teacher_id) || text(existing?.teacher_id);
  const effectiveFrom = day(body?.effectiveFrom ?? body?.effective_from) || day(existing?.effective_from) || new Date().toISOString().slice(0, 10);
  const effectiveTo = body?.effectiveTo === undefined && body?.effective_to === undefined
    ? (existing?.effective_to ? day(existing.effective_to) : null)
    : day(body.effectiveTo ?? body.effective_to);

  if (!academicYearId) return { error: 'Academic year is required' };
  if (!classId) return { error: 'Class is required' };
  if (!sectionId) return { error: 'Section is required' };
  if (!subjectId) return { error: 'Subject is required' };
  if (!teacherId) return { error: 'Teacher is required' };
  if (effectiveTo && effectiveTo < effectiveFrom) return { error: 'Effective end date cannot be before the start date' };

  const [year] = await execQ(pool, 'SELECT * FROM school_academic_years WHERE app_id=$1 AND id=$2', [appId, academicYearId]);
  if (!year) return { error: 'Academic year not found' };
  if (year.is_closed && !allowClosed) return { error: 'This academic year is closed; new allocations are blocked', status: 409 };

  const [classRow] = await execQ(pool, 'SELECT * FROM school_classes WHERE app_id=$1 AND id=$2', [appId, classId]);
  if (!classRow) return { error: 'Class not found' };
  if (!classRow.is_active) return { error: 'Class is archived' };

  const [section] = await execQ(pool, 'SELECT * FROM school_sections WHERE app_id=$1 AND id=$2', [appId, sectionId]);
  if (!section) return { error: 'Section not found' };
  if (Number(section.class_id) !== Number(classId)) return { error: 'Selected section does not belong to the selected class' };
  if (!section.is_active) return { error: 'Section is archived' };

  const [subject] = await execQ(pool, 'SELECT * FROM school_subjects WHERE app_id=$1 AND id=$2', [appId, subjectId]);
  if (!subject) return { error: 'Subject not found' };
  if (!subject.is_active) return { error: 'Subject is archived' };
  if (subject.class_id && Number(subject.class_id) !== Number(classId)) {
    return { error: 'Subject is not eligible for the selected class' };
  }

  const teacher = await resolveTeacher(pool, appId, teacherId);
  if (!teacher) return { error: 'Teacher not found or inactive' };

  const params = [appId, academicYearId, classId, sectionId, subjectId, teacherId];
  let duplicateQuery = `SELECT id FROM school_subject_allocations
     WHERE app_id=$1 AND academic_year_id=$2 AND class_id=$3 AND section_id=$4
       AND subject_id=$5 AND teacher_id=$6 AND is_active`;
  if (existing?.id) {
    params.push(existing.id);
    duplicateQuery += ` AND id <> $${params.length}`;
  }
  const duplicate = await execQ(pool, duplicateQuery, params);
  if (duplicate.length) return { error: 'An active allocation already exists for this year/class/section/subject/teacher', status: 409 };

  return {
    data: {
      academicYearId, classId, sectionId, subjectId, teacherId,
      teacherName: text(body?.teacherName ?? body?.teacher_name) || teacher.name || '',
      effectiveFrom, effectiveTo,
      isActive: body?.isActive === undefined && body?.is_active === undefined
        ? (existing?.is_active ?? true)
        : bool(body.isActive ?? body.is_active),
    },
  };
}

schoolRouter.get('/subject-allocations', route(async (req, res) => {
  if (!guard(req, res, 'academics.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const where = ['a.app_id=$1'];
  const params = [appId];
  if (!bool(req.query.includeInactive)) where.push('a.is_active=true');
  for (const [queryKey, column] of [
    ['academicYearId', 'academic_year_id'], ['classId', 'class_id'],
    ['sectionId', 'section_id'], ['subjectId', 'subject_id'],
  ]) {
    const value = num(req.query[queryKey]);
    if (value) { params.push(value); where.push(`a.${column}=$${params.length}`); }
  }
  if (text(req.query.teacherId)) {
    params.push(text(req.query.teacherId));
    where.push(`a.teacher_id=$${params.length}`);
  }
  const allocations = await execQ(pool, `
    SELECT a.*, y.name AS academic_year_name, y.is_closed AS academic_year_closed,
           c.name AS class_name, sec.name AS section_name,
           sub.name AS subject_name, sub.code AS subject_code,
           coalesce(nullif(a.teacher_name, ''), nullif(trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')), ''), u."UserName", a.teacher_id) AS teacher_display
      FROM school_subject_allocations a
      JOIN school_academic_years y ON y.id=a.academic_year_id AND y.app_id=a.app_id
      JOIN school_classes c ON c.id=a.class_id AND c.app_id=a.app_id
      JOIN school_sections sec ON sec.id=a.section_id AND sec.app_id=a.app_id
      JOIN school_subjects sub ON sub.id=a.subject_id AND sub.app_id=a.app_id
      LEFT JOIN school_hr_employees e ON e.id::text=a.teacher_id AND e.app_id=a.app_id
      LEFT JOIN "tblHO_User" u ON u."UserId"::text=a.teacher_id
     WHERE ${where.join(' AND ')}
     ORDER BY a.is_active DESC, y.start_date DESC, c.sort_order, sec.name, sub.name
  `, params);
  res.json({ ok: true, allocations });
}));

schoolRouter.post('/subject-allocations', route(async (req, res) => {
  if (!guard(req, res, 'academics.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const input = await allocationInput(pool, appId, req.body);
  if (input.error) return bad(res, input.error, input.status || 400);
  const d = input.data;
  const [allocation] = await execQ(pool, `
    INSERT INTO school_subject_allocations
      (app_id, academic_year_id, class_id, section_id, subject_id, teacher_id, teacher_name,
       effective_from, effective_to, is_active, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
  `, [appId, d.academicYearId, d.classId, d.sectionId, d.subjectId, d.teacherId, d.teacherName,
      d.effectiveFrom, d.effectiveTo, d.isActive, String(req.user?.userid || '')]);
  await audit(req, 'subject_allocation.create', 'school_subject_allocations', allocation.id, null, allocation);
  res.json({ ok: true, allocation });
}));

schoolRouter.put('/subject-allocations/:id', route(async (req, res) => {
  if (!guard(req, res, 'academics.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [existing] = await execQ(pool,
    'SELECT * FROM school_subject_allocations WHERE app_id=$1 AND id=$2', [appId, id]);
  if (!existing) return bad(res, 'Subject allocation not found', 404);
  const nextActive = req.body?.isActive === undefined && req.body?.is_active === undefined
    ? existing.is_active
    : bool(req.body.isActive ?? req.body.is_active);
  const input = await allocationInput(pool, appId, req.body, existing, !nextActive);
  if (input.error) return bad(res, input.error, input.status || 400);
  const d = input.data;
  const [allocation] = await execQ(pool, `
    UPDATE school_subject_allocations
       SET academic_year_id=$3, class_id=$4, section_id=$5, subject_id=$6,
           teacher_id=$7, teacher_name=$8, effective_from=$9, effective_to=$10,
           is_active=$11, updated_at=now()
     WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appId, id, d.academicYearId, d.classId, d.sectionId, d.subjectId, d.teacherId,
      d.teacherName, d.effectiveFrom, d.effectiveTo, d.isActive]);
  await audit(req, 'subject_allocation.update', 'school_subject_allocations', id, existing, allocation);
  res.json({ ok: true, allocation });
}));

schoolRouter.delete('/subject-allocations/:id', route(async (req, res) => {
  if (!guard(req, res, 'academics.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [{ n }] = await execQ(pool, `
    SELECT (
      (SELECT count(*) FROM school_timetables WHERE app_id=$1 AND allocation_id=$2) +
      (SELECT count(*) FROM school_exam_timetable WHERE app_id=$1 AND allocation_id=$2) +
      (SELECT count(*) FROM school_homework WHERE app_id=$1 AND allocation_id=$2)
    )::int AS n
  `, [appId, id]);
  if (n > 0) return bad(res, 'This allocation is used by timetable, exam or homework records; deactivate it instead', 409);
  const rows = await execQ(pool,
    'DELETE FROM school_subject_allocations WHERE app_id=$1 AND id=$2 RETURNING id', [appId, id]);
  if (!rows.length) return bad(res, 'Subject allocation not found', 404);
  await audit(req, 'subject_allocation.delete', 'school_subject_allocations', id);
  res.json({ ok: true });
}));

/* ---------------- rooms ---------------- */

function facilitiesList(v) {
  if (Array.isArray(v)) return v.map(text).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map(text).filter(Boolean);
  return [];
}

async function roomInput(pool, appId, body, existing = null) {
  const campusId = num(body?.campusId ?? body?.campus_id) ?? existing?.campus_id ?? null;
  const code = text(body?.code ?? existing?.code);
  const name = text(body?.name ?? existing?.name);
  const roomType = text(body?.roomType ?? body?.room_type) || existing?.room_type || 'classroom';
  const capacity = num(body?.capacity ?? existing?.capacity) ?? 40;
  if (!campusId) return { error: 'Campus is required' };
  if (!code) return { error: 'Room code is required' };
  if (!name) return { error: 'Room name is required' };
  if (!Number.isFinite(capacity) || capacity <= 0) return { error: 'Capacity must be greater than zero' };
  const [campus] = await execQ(pool,
    'SELECT id FROM school_campuses WHERE app_id=$1 AND id=$2', [appId, campusId]);
  if (!campus) return { error: 'Campus not found' };
  const params = [appId, campusId, code];
  let duplicate = `SELECT id FROM school_rooms
     WHERE app_id=$1 AND coalesce(campus_id,0)=coalesce($2,0) AND lower(code)=lower($3)`;
  if (existing?.id) {
    params.push(existing.id);
    duplicate += ` AND id <> $${params.length}`;
  }
  const dup = await execQ(pool, duplicate, params);
  if (dup.length) return { error: 'A room with this code already exists on the campus', status: 409 };
  return {
    data: {
      campusId, code, name, roomType, capacity,
      building: text(body?.building ?? existing?.building) || null,
      facilities: facilitiesList(body?.facilities ?? existing?.facilities),
      isActive: body?.isActive === undefined && body?.is_active === undefined
        ? (existing?.is_active ?? true)
        : bool(body.isActive ?? body.is_active),
    },
  };
}

schoolRouter.get('/rooms', route(async (req, res) => {
  if (!guard(req, res, 'academics.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const where = ['r.app_id=$1'];
  const params = [appId];
  if (!bool(req.query.includeInactive)) where.push('r.is_active=true');
  const campusId = num(req.query.campusId);
  if (campusId) { params.push(campusId); where.push(`r.campus_id=$${params.length}`); }
  if (text(req.query.q)) {
    params.push(`%${text(req.query.q)}%`);
    where.push(`(r.code ILIKE $${params.length} OR r.name ILIKE $${params.length})`);
  }
  const rooms = await execQ(pool, `
    SELECT r.*, cp.name AS campus_name,
           (SELECT count(*) FROM school_timetables t
             WHERE t.app_id=r.app_id AND t.room_id=r.id)::int AS timetable_bookings,
           (SELECT count(*) FROM school_exam_timetable et
             WHERE et.app_id=r.app_id AND et.room_id=r.id)::int AS exam_bookings
      FROM school_rooms r
      LEFT JOIN school_campuses cp ON cp.id=r.campus_id AND cp.app_id=r.app_id
     WHERE ${where.join(' AND ')}
     ORDER BY r.is_active DESC, cp.name, r.code
  `, params);
  res.json({ ok: true, rooms });
}));

schoolRouter.post('/rooms', route(async (req, res) => {
  if (!guard(req, res, 'academics.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const input = await roomInput(pool, appId, req.body);
  if (input.error) return bad(res, input.error, input.status || 400);
  const d = input.data;
  const [room] = await execQ(pool, `
    INSERT INTO school_rooms
      (app_id, campus_id, building, code, name, room_type, capacity, facilities, is_active)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) RETURNING *
  `, [appId, d.campusId, d.building, d.code, d.name, d.roomType, d.capacity,
      JSON.stringify(d.facilities), d.isActive]);
  await audit(req, 'room.create', 'school_rooms', room.id, null, room);
  res.json({ ok: true, room });
}));

schoolRouter.put('/rooms/:id', route(async (req, res) => {
  if (!guard(req, res, 'academics.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [existing] = await execQ(pool, 'SELECT * FROM school_rooms WHERE app_id=$1 AND id=$2', [appId, id]);
  if (!existing) return bad(res, 'Room not found', 404);
  const input = await roomInput(pool, appId, req.body, existing);
  if (input.error) return bad(res, input.error, input.status || 400);
  const d = input.data;
  const [room] = await execQ(pool, `
    UPDATE school_rooms
       SET campus_id=$3, building=$4, code=$5, name=$6, room_type=$7,
           capacity=$8, facilities=$9::jsonb, is_active=$10, updated_at=now()
     WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appId, id, d.campusId, d.building, d.code, d.name, d.roomType,
      d.capacity, JSON.stringify(d.facilities), d.isActive]);
  await audit(req, 'room.update', 'school_rooms', id, existing, room);
  res.json({ ok: true, room });
}));

schoolRouter.get('/rooms/:id/conflicts', route(async (req, res) => {
  if (!guard(req, res, 'academics.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const roomId = num(req.params.id);
  const room = await roomRow(pool, appId, roomId);
  if (!room) return bad(res, 'Room not found', 404);
  const conflicts = await findRoomConflicts(pool, appId, {
    roomId,
    dayOfWeek: req.query.dayOfWeek ?? req.query.day_of_week,
    periodNo: req.query.periodNo ?? req.query.period_no,
    startTime: req.query.startTime ?? req.query.start_time,
    endTime: req.query.endTime ?? req.query.end_time,
    examDate: req.query.examDate ?? req.query.exam_date,
    excludeTimetableId: req.query.excludeTimetableId,
    excludeExamId: req.query.excludeExamId,
  });
  res.json({ ok: true, conflicts, message: roomConflictError(conflicts) });
}));

schoolRouter.delete('/rooms/:id', route(async (req, res) => {
  if (!guard(req, res, 'academics.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [{ n }] = await execQ(pool, `
    SELECT ((SELECT count(*) FROM school_timetables WHERE app_id=$1 AND room_id=$2) +
            (SELECT count(*) FROM school_exam_timetable WHERE app_id=$1 AND room_id=$2))::int AS n
  `, [appId, id]);
  if (n > 0) return bad(res, 'This room is used by timetable or exam bookings; archive it instead', 409);
  const rows = await execQ(pool,
    'DELETE FROM school_rooms WHERE app_id=$1 AND id=$2 RETURNING id', [appId, id]);
  if (!rows.length) return bad(res, 'Room not found', 404);
  await audit(req, 'room.delete', 'school_rooms', id);
  res.json({ ok: true });
}));

/* ---------------- homework lifecycle ---------------- */

async function allocationScope(pool, appId, allocationId) {
  const [row] = await execQ(pool, `
    SELECT a.*, y.name AS academic_year_name, y.is_closed,
           c.name AS class_name, c.is_active AS class_active,
           sec.name AS section_name, sec.is_active AS section_active,
           sub.name AS subject_name, sub.code AS subject_code,
           sub.max_marks AS subject_max_marks, sub.is_active AS subject_active
      FROM school_subject_allocations a
      JOIN school_academic_years y ON y.id=a.academic_year_id AND y.app_id=a.app_id
      JOIN school_classes c ON c.id=a.class_id AND c.app_id=a.app_id
      JOIN school_sections sec ON sec.id=a.section_id AND sec.app_id=a.app_id
      JOIN school_subjects sub ON sub.id=a.subject_id AND sub.app_id=a.app_id
     WHERE a.app_id=$1 AND a.id=$2
  `, [appId, num(allocationId)]);
  return row || null;
}

function homeworkInput(body, existing, allocation) {
  const title = text(body?.title ?? existing?.title);
  const description = text(body?.description ?? body?.instructions ?? existing?.description);
  const assignedDate = day(body?.assignedDate ?? body?.assigned_date)
    || (existing?.assigned_date ? day(existing.assigned_date) : new Date().toISOString().slice(0, 10));
  const dueDate = day(body?.dueDate ?? body?.due_date)
    || (existing?.due_date ? day(existing.due_date) : null);
  const maxMarks = num(body?.maxMarks ?? body?.max_marks) ?? (existing?.max_marks != null ? Number(existing.max_marks) : null);
  if (!title) return { error: 'Homework title is required' };
  if (!dueDate) return { error: 'Due date is required' };
  if (dueDate < assignedDate) return { error: 'Due date cannot be before the assigned date' };
  if (maxMarks !== null && (!Number.isFinite(maxMarks) || maxMarks <= 0)) return { error: 'Max marks must be greater than zero' };
  return {
    data: {
      title, description,
      assignedDate, dueDate, maxMarks,
      attachmentUrl: text(body?.attachmentUrl ?? body?.attachment_url ?? existing?.attachment_url) || null,
      allocation,
    },
  };
}

const HW_TRANSITIONS = {
  draft: ['draft', 'published', 'archived'],
  published: ['published', 'closed', 'archived', 'draft'],
  closed: ['closed', 'archived'],
  archived: ['archived'],
};

function publishBlock(allocation) {
  if (!allocation) return { error: 'A valid subject allocation is required', status: 400 };
  if (!allocation.is_active) return { error: 'Homework can only be published against an active allocation', status: 409 };
  if (allocation.is_closed) return { error: 'Homework can only be published in an open academic year', status: 409 };
  return null;
}

async function applyHomeworkStatus(pool, appId, homework, nextStatus) {
  const allowed = HW_TRANSITIONS[homework.status] || ['draft'];
  if (!allowed.includes(nextStatus)) {
    return { error: `Cannot change a ${homework.status} homework to ${nextStatus}`, status: 409 };
  }
  if (nextStatus === 'draft' && homework.status === 'published') {
    const [{ n }] = await execQ(pool,
      'SELECT count(*)::int AS n FROM school_homework_submissions WHERE app_id=$1 AND homework_id=$2', [appId, homework.id]);
    if (n > 0) return { error: 'Homework with submissions cannot return to draft', status: 409 };
  }
  const [updated] = await execQ(pool, `
    UPDATE school_homework
       SET status=$3,
           published_at=CASE WHEN $3='published' THEN coalesce(published_at, now()) ELSE published_at END,
           closed_at=CASE WHEN $3='closed' THEN coalesce(closed_at, now()) ELSE closed_at END,
           archived_at=CASE WHEN $3='archived' THEN coalesce(archived_at, now()) ELSE archived_at END,
           updated_at=now()
     WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appId, homework.id, nextStatus]);
  return { data: updated };
}

schoolRouter.get('/homework', route(async (req, res) => {
  if (!guard(req, res, 'homework.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const where = ['h.app_id=$1'];
  const params = [appId];
  if (!bool(req.query.includeInactive)) where.push(`h.status <> 'archived'`);
  if (text(req.query.status)) { params.push(text(req.query.status)); where.push(`h.status=$${params.length}`); }
  for (const [queryKey, column] of [
    ['academicYearId', 'academic_year_id'], ['classId', 'class_id'],
    ['sectionId', 'section_id'], ['subjectId', 'subject_id'],
    ['allocationId', 'allocation_id'],
  ]) {
    const value = num(req.query[queryKey]);
    if (value) { params.push(value); where.push(`h.${column}=$${params.length}`); }
  }
  if (text(req.query.q)) {
    params.push(`%${text(req.query.q)}%`);
    where.push(`h.title ILIKE $${params.length}`);
  }

  if (!isHomeworkManager(req)) {
    const userId = String(req.user?.userid || '');
    const [linked] = await execQ(pool, `
      SELECT s.id, s.class_id, s.section_id
        FROM school_students s
        JOIN school_users u ON u.app_id=s.app_id
         AND (u.id::text=s.user_id::text OR (s.user_id::text !~ '^[0-9]+$' AND u.user_id=s.user_id::text))
       WHERE s.app_id=$1 AND u.user_id=$2 AND s.status='active' AND s.deleted_at IS NULL
    `, [appId, userId]);
    if (linked) {
      params.push(linked.class_id);
      where.push(`h.class_id=$${params.length}`);
      if (linked.section_id !== null && linked.section_id !== undefined) {
        params.push(linked.section_id);
        where.push(`h.section_id=$${params.length}`);
      }
      where.push(`h.status IN ('published', 'closed')`);
    } else {
      const ids = await teacherScopeIds(pool, appId, userId);
      params.push(ids);
      where.push(`h.allocation_id IN (
        SELECT id FROM school_subject_allocations
         WHERE app_id=$1 AND teacher_id = ANY($${params.length}::text[])
      )`);
    }
  }

  const homework = await execQ(pool, `
    SELECT h.*, y.name AS academic_year_name,
           c.name AS class_name, sec.name AS section_name,
           sub.name AS subject_name, sub.code AS subject_code,
           coalesce(nullif(trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')), ''), u."UserName", h.teacher_id) AS teacher_display,
           (SELECT count(*) FROM school_homework_submissions hs
             WHERE hs.app_id=h.app_id AND hs.homework_id=h.id)::int AS submission_count,
           (SELECT count(*) FROM school_homework_submissions hs
             WHERE hs.app_id=h.app_id AND hs.homework_id=h.id AND hs.status='graded')::int AS graded_count
      FROM school_homework h
      LEFT JOIN school_academic_years y ON y.id=h.academic_year_id AND y.app_id=h.app_id
      LEFT JOIN school_classes c ON c.id=h.class_id AND c.app_id=h.app_id
      LEFT JOIN school_sections sec ON sec.id=h.section_id AND sec.app_id=h.app_id
      LEFT JOIN school_subjects sub ON sub.id=h.subject_id AND sub.app_id=h.app_id
      LEFT JOIN school_hr_employees e ON e.id::text=h.teacher_id AND e.app_id=h.app_id
      LEFT JOIN "tblHO_User" u ON u."UserId"::text=h.teacher_id
     WHERE ${where.join(' AND ')}
     ORDER BY h.status='archived', h.assigned_date DESC NULLS LAST, h.id DESC
  `, params);
  res.json({ ok: true, homework });
}));

schoolRouter.get('/homework/:id', route(async (req, res) => {
  if (!guard(req, res, 'homework.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const [homework] = await execQ(pool,
    'SELECT * FROM school_homework WHERE app_id=$1 AND id=$2', [appId, num(req.params.id)]);
  if (!homework) return bad(res, 'Homework not found', 404);

  if (!isHomeworkManager(req)) {
    const userId = String(req.user?.userid || '');
    const [linked] = await execQ(pool, `
      SELECT s.id, s.class_id, s.section_id
        FROM school_students s
        JOIN school_users u ON u.app_id=s.app_id
         AND (u.id::text=s.user_id::text OR (s.user_id::text !~ '^[0-9]+$' AND u.user_id=s.user_id::text))
       WHERE s.app_id=$1 AND u.user_id=$2 AND s.status='active' AND s.deleted_at IS NULL
    `, [appId, userId]);
    if (linked) {
      const sameClass = Number(homework.class_id) === Number(linked.class_id);
      const sameSection = homework.section_id === null || homework.section_id === undefined
        || Number(homework.section_id) === Number(linked.section_id);
      if (!sameClass || !sameSection || !['published', 'closed'].includes(homework.status)) {
        return bad(res, 'Homework not found', 404);
      }
    } else if (!(await canAuthorHomework(pool, appId, req, homework.teacher_id))) {
      return bad(res, 'Homework not found', 404);
    }
  }
  res.json({ ok: true, homework });
}));

schoolRouter.post('/homework', route(async (req, res) => {
  if (!guard(req, res, 'homework.create')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const allocation = await allocationScope(pool, appId, req.body?.allocationId ?? req.body?.allocation_id);
  if (!allocation) return bad(res, 'A valid subject allocation is required');
  if (!allocation.is_active) return bad(res, 'The selected allocation is inactive', 409);
  if (allocation.is_closed) return bad(res, 'The selected academic year is closed', 409);
  if (!(await canAuthorHomework(pool, appId, req, allocation.teacher_id))) {
    return bad(res, 'You can only create homework for your own subject allocations', 403);
  }
  const input = homeworkInput(req.body, null, allocation);
  if (input.error) return bad(res, input.error);
  const d = input.data;
  const [homework] = await execQ(pool, `
    INSERT INTO school_homework
      (app_id, allocation_id, academic_year_id, class_id, section_id, subject_id, teacher_id,
       title, description, attachment_url, assigned_date, due_date, max_marks, status, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'draft',$14) RETURNING *
  `, [appId, allocation.id, allocation.academic_year_id, allocation.class_id, allocation.section_id,
      allocation.subject_id, allocation.teacher_id, d.title, d.description, d.attachmentUrl,
      d.assignedDate, d.dueDate, d.maxMarks, String(req.user?.userid || '')]);
  await audit(req, 'homework.create', 'school_homework', homework.id, null, homework);
  res.json({ ok: true, homework });
}));

schoolRouter.put('/homework/:id', route(async (req, res) => {
  if (!guard(req, res, 'homework.create')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [existing] = await execQ(pool, 'SELECT * FROM school_homework WHERE app_id=$1 AND id=$2', [appId, id]);
  if (!existing) return bad(res, 'Homework not found', 404);
  if (existing.status === 'archived') return bad(res, 'Archived homework cannot be edited', 409);
  const nextStatus = text(req.body?.status) || existing.status;
  if (existing.status === 'closed' && nextStatus !== 'archived') {
    return bad(res, 'Closed homework cannot be edited; archive it or reopen it through a new assignment', 409);
  }
  const requestedAllocationId = req.body?.allocationId ?? req.body?.allocation_id;
  const allocationId = requestedAllocationId ?? existing.allocation_id;
  const allocation = await allocationScope(pool, appId, allocationId);
  if (!allocation) return bad(res, 'A valid subject allocation is required');
  if (!(await canAuthorHomework(pool, appId, req, existing.teacher_id))) {
    return bad(res, 'You can only edit homework for your own subject allocations', 403);
  }
  if (Number(allocation.id) !== Number(existing.allocation_id)
      && !(await canAuthorHomework(pool, appId, req, allocation.teacher_id))) {
    return bad(res, 'You can only move homework to your own subject allocations', 403);
  }
  if (Number(allocation.id) !== Number(existing.allocation_id)) {
    if (existing.status !== 'draft') return bad(res, 'The allocation cannot change after homework is published', 409);
    if (!allocation.is_active) return bad(res, 'The selected allocation is inactive', 409);
    if (allocation.is_closed) return bad(res, 'The selected academic year is closed', 409);
  }
  if (nextStatus === 'published' && existing.status !== 'published') {
    const block = publishBlock(allocation);
    if (block) return bad(res, block.error, block.status);
  }
  const input = homeworkInput(req.body, existing, allocation);
  if (input.error) return bad(res, input.error);
  const d = input.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const statusResult = await applyHomeworkStatus(client, appId, existing, nextStatus);
    if (statusResult.error) {
      await client.query('ROLLBACK');
      return bad(res, statusResult.error, statusResult.status || 409);
    }
    const [homework] = await execQ(client, `
      UPDATE school_homework
         SET allocation_id=$3, academic_year_id=$4, class_id=$5, section_id=$6,
             subject_id=$7, teacher_id=$8, title=$9, description=$10, attachment_url=$11,
             assigned_date=$12, due_date=$13, max_marks=$14, updated_at=now()
       WHERE app_id=$1 AND id=$2 RETURNING *
    `, [appId, id, allocation.id, allocation.academic_year_id, allocation.class_id,
        allocation.section_id, allocation.subject_id, allocation.teacher_id,
        d.title, d.description, d.attachmentUrl, d.assignedDate, d.dueDate, d.maxMarks]);
    await client.query('COMMIT');
    await audit(req, 'homework.update', 'school_homework', id, existing, homework);
    res.json({ ok: true, homework });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}));

for (const [action, target] of [['publish', 'published'], ['close', 'closed'], ['archive', 'archived']]) {
  schoolRouter.post(`/homework/:id/${action}`, route(async (req, res) => {
    if (!guard(req, res, `homework.${action}`)) return;
    const pool = getPool();
    const appId = appIdOf(req);
    const id = num(req.params.id);
    const [existing] = await execQ(pool, 'SELECT * FROM school_homework WHERE app_id=$1 AND id=$2', [appId, id]);
    if (!existing) return bad(res, 'Homework not found', 404);
    if (!isHomeworkManager(req)) {
      const allocated = await allocationScope(pool, appId, existing.allocation_id);
      if (!allocated || !(await canAuthorHomework(pool, appId, req, allocated.teacher_id))) {
        return bad(res, 'You can only change homework for your own subject allocations', 403);
      }
    }
    if (target === 'published') {
      const allocation = await allocationScope(pool, appId, existing.allocation_id);
      const block = publishBlock(allocation);
      if (block) return bad(res, block.error, block.status);
    }
    const result = await applyHomeworkStatus(pool, appId, existing, target);
    if (result.error) return bad(res, result.error, result.status || 409);
    await audit(req, `homework.${action}`, 'school_homework', id, existing, result.data);
    res.json({ ok: true, homework: result.data });
  }));
}

schoolRouter.delete('/homework/:id', route(async (req, res) => {
  if (!guard(req, res, 'homework.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [existing] = await execQ(pool, 'SELECT * FROM school_homework WHERE app_id=$1 AND id=$2', [appId, id]);
  if (!existing) return bad(res, 'Homework not found', 404);
  const [{ n }] = await execQ(pool,
    'SELECT count(*)::int AS n FROM school_homework_submissions WHERE app_id=$1 AND homework_id=$2', [appId, id]);
  if (existing.status !== 'draft' || n > 0) {
    return bad(res, 'Homework with a published state or submissions must be archived, not deleted', 409);
  }
  await execQ(pool, 'DELETE FROM school_homework WHERE app_id=$1 AND id=$2', [appId, id]);
  await audit(req, 'homework.delete', 'school_homework', id, existing);
  res.json({ ok: true });
}));

async function eligibleStudentRows(pool, appId, homework, studentId = null) {
  const params = [appId, num(homework.academic_year_id), num(homework.class_id),
    num(homework.section_id)];
  let q = `
    SELECT s.id, s.admission_no, s.first_name, s.last_name, s.roll_no,
           c.name AS class_name, sec.name AS section_name
      FROM school_students s
      LEFT JOIN school_classes c ON c.id=s.class_id AND c.app_id=s.app_id
      LEFT JOIN school_sections sec ON sec.id=s.section_id AND sec.app_id=s.app_id
     WHERE s.app_id=$1 AND s.status='active' AND s.deleted_at IS NULL
       AND CASE
         WHEN $2::int IS NOT NULL THEN (
           EXISTS (
             SELECT 1 FROM school_student_enrollments e
              WHERE e.app_id=s.app_id AND e.student_id=s.id AND e.academic_year_id=$2
                AND coalesce(e.status, 'studying') NOT IN ('withdrawn', 'left', 'transferred')
                AND coalesce(e.class_id, s.class_id)=$3
                AND ($4::int IS NULL OR coalesce(e.section_id, s.section_id)=$4)
           )
           OR (
             NOT EXISTS (
               SELECT 1 FROM school_student_enrollments e2
                WHERE e2.app_id=s.app_id AND e2.student_id=s.id AND e2.academic_year_id=$2
             )
             AND s.class_id=$3
             AND ($4::int IS NULL OR s.section_id=$4)
           )
         )
         ELSE (s.class_id=$3 AND ($4::int IS NULL OR s.section_id=$4))
       END`;
  if (num(studentId)) {
    params.push(num(studentId));
    q += ` AND s.id=$${params.length}`;
  }
  return execQ(pool, q + ' ORDER BY s.roll_no NULLS LAST, s.first_name, s.last_name', params);
}

schoolRouter.get('/homework/:id/eligible-students', route(async (req, res) => {
  if (!guard(req, res, 'homework.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const [homework] = await execQ(pool,
    'SELECT * FROM school_homework WHERE app_id=$1 AND id=$2', [appId, num(req.params.id)]);
  if (!homework) return bad(res, 'Homework not found', 404);
  const userId = String(req.user?.userid || '');
  const isManager = isHomeworkManager(req);
  const [linkedStudent] = await execQ(pool,
    `SELECT s.id FROM school_students s
      JOIN school_users u ON u.app_id=s.app_id
       AND (u.id::text=s.user_id::text OR (s.user_id::text !~ '^[0-9]+$' AND u.user_id=s.user_id::text))
     WHERE s.app_id=$1 AND u.user_id=$2 AND s.status='active' AND s.deleted_at IS NULL`,
    [appId, userId]);
  let students;
  if (linkedStudent && !isManager) {
    // Student user - only show themselves if they're in the eligible list
    students = await eligibleStudentRows(pool, appId, homework, linkedStudent.id);
  } else if (isManager) {
    // Teacher/admin - show full eligible roster
    students = await eligibleStudentRows(pool, appId, homework);
  } else {
    // Teacher with view-only - filter to classes they teach via allocation
    const teacherIds = await teacherScopeIds(pool, appId, userId);
    const teacherAllocations = await execQ(pool, `
      SELECT DISTINCT class_id, section_id FROM school_subject_allocations
       WHERE app_id=$1 AND teacher_id = ANY($2::text[]) AND is_active
    `, [appId, teacherIds]);
    if (teacherAllocations.length === 0) {
      students = [];
    } else {
      // Build OR conditions for class/section pairs
      const conditions = teacherAllocations.map((a, idx) => 
        `(s.class_id = $${idx * 2 + 2} AND s.section_id = $${idx * 2 + 3})`
      ).join(' OR ');
      const flatParams = teacherAllocations.flatMap((a) => [a.class_id, a.section_id]);
      students = await execQ(pool, `
        SELECT s.id, s.admission_no, s.first_name, s.last_name, s.roll_no,
               c.name AS class_name, sec.name AS section_name
          FROM school_students s
          LEFT JOIN school_classes c ON c.id=s.class_id AND c.app_id=s.app_id
          LEFT JOIN school_sections sec ON sec.id=s.section_id AND sec.app_id=s.app_id
         WHERE s.app_id=$1 AND s.status='active' AND s.deleted_at IS NULL
           AND (${conditions})
         ORDER BY s.roll_no NULLS LAST, s.first_name, s.last_name
      `, [appId, ...flatParams]);
    }
  }
  res.json({ ok: true, students });
}));

schoolRouter.get('/homework/:id/submissions', route(async (req, res) => {
  const canGrade = can(req.school, 'homework.grade');
  if (!guard(req, res, canGrade ? 'homework.grade' : 'homework.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const homeworkId = num(req.params.id);
  const [homework] = await execQ(pool,
    'SELECT * FROM school_homework WHERE app_id=$1 AND id=$2', [appId, homeworkId]);
  if (!homework) return bad(res, 'Homework not found', 404);
  const userId = String(req.user?.userid || '');
  const isManager = isHomeworkManager(req);
  const [linkedStudent] = await execQ(pool,
    `SELECT s.id FROM school_students s
      JOIN school_users u ON u.app_id=s.app_id
       AND (u.id::text=s.user_id::text OR (s.user_id::text !~ '^[0-9]+$' AND u.user_id=s.user_id::text))
     WHERE s.app_id=$1 AND u.user_id=$2 AND s.status='active' AND s.deleted_at IS NULL`,
    [appId, userId]);
  
  let where = 'hs.app_id=$1 AND hs.homework_id=$2';
  const params = [appId, homeworkId];
  
  if (linkedStudent && !isManager) {
    // Student user - only see their own submissions
    params.push(linkedStudent.id);
    where += ` AND hs.student_id=$${params.length}`;
  } else if (!isManager) {
    // Teacher with view-only - filter to classes they teach via allocation
    const teacherIds = await teacherScopeIds(pool, appId, userId);
    const teacherAllocations = await execQ(pool, `
      SELECT DISTINCT id FROM school_subject_allocations
       WHERE app_id=$1 AND teacher_id = ANY($2::text[]) AND is_active
    `, [appId, teacherIds]);
    const allocationIds = teacherAllocations.map((a) => a.id);
    if (allocationIds.length === 0) {
      return res.json({ ok: true, submissions: [] });
    }
    // Homework must be for one of their allocations
    params.push(allocationIds);
    where += ` AND hs.homework_id IN (
      SELECT id FROM school_homework WHERE app_id=$1 AND allocation_id = ANY($${params.length})
    )`;
    // And only students in those classes/sections
    where += ` AND hs.student_id IN (
      SELECT s.id FROM school_students s
      WHERE s.app_id=$1 AND s.status='active' AND s.deleted_at IS NULL
        AND s.class_id IN (
          SELECT class_id FROM school_subject_allocations WHERE id = ANY($${params.length})
        )
    )`;
  }
  // Teacher/admin (isManager) sees all submissions - no extra filter
  
  const submissions = await execQ(pool, `
    SELECT hs.*, s.first_name, s.last_name, s.admission_no, s.roll_no
      FROM school_homework_submissions hs
      JOIN school_students s ON s.id=hs.student_id AND s.app_id=hs.app_id
     WHERE ${where}
     ORDER BY s.first_name, s.last_name, hs.id
  `, params);
  res.json({ ok: true, submissions });
}));

schoolRouter.post('/homework/:id/submit', route(async (req, res) => {
  const canManage = can(req.school, 'homework.manage');
  const canSubmit = can(req.school, 'homework.submit');
  if (!guard(req, res, canManage ? 'homework.manage' : canSubmit ? 'homework.submit' : 'homework.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const homeworkId = num(req.params.id);
  const [homework] = await execQ(pool,
    'SELECT * FROM school_homework WHERE app_id=$1 AND id=$2', [appId, homeworkId]);
  if (!homework) return bad(res, 'Homework not found', 404);
  if (homework.status !== 'published') return bad(res, 'Only published homework can receive submissions', 409);
  const userId = String(req.user?.userid || '');
  const isManager = isHomeworkManager(req);
  const [linkedStudent] = await execQ(pool,
    `SELECT s.id FROM school_students s
      JOIN school_users u ON u.app_id=s.app_id
       AND (u.id::text=s.user_id::text OR (s.user_id::text !~ '^[0-9]+$' AND u.user_id=s.user_id::text))
     WHERE s.app_id=$1 AND u.user_id=$2 AND s.status='active' AND s.deleted_at IS NULL`,
    [appId, userId]);
  let studentId;
  if (linkedStudent && !isManager) {
    // Student user - can only submit for themselves
    studentId = linkedStudent.id;
  } else if (isManager) {
    // Teacher/admin with manage - can submit for any eligible student (front-office use)
    studentId = num(req.body?.studentId ?? req.body?.student_id);
    if (!studentId) return bad(res, 'studentId is required for teacher submissions');
  } else {
    // Teacher with view-only - can submit for students in their classes via allocation
    // Verify the teacher is assigned to this homework's allocation
    if (!homework.allocation_id) {
      return bad(res, 'Homework has no allocation assigned', 403);
    }
    const teacherIds = await teacherScopeIds(pool, appId, userId);
    const teacherAllocation = await execQ(pool, `
      SELECT id FROM school_subject_allocations
       WHERE app_id=$1 AND teacher_id = ANY($2::text[]) AND is_active AND id=$3
    `, [appId, teacherIds, homework.allocation_id]);
    if (!teacherAllocation.length) {
      return bad(res, 'You are not assigned to this homework\'s allocation', 403);
    }
    studentId = num(req.body?.studentId ?? req.body?.student_id);
    if (!studentId) return bad(res, 'studentId is required for teacher submissions');
    // Verify the student is in the class/section for this homework
    const studentInClass = await execQ(pool, `
      SELECT 1 FROM school_students s
       WHERE s.app_id=$1 AND s.id=$2 AND s.status='active' AND s.deleted_at IS NULL
         AND s.class_id=$3
         AND ($4::int IS NULL OR s.section_id=$4)
    `, [appId, studentId, homework.class_id, homework.section_id]);
    if (!studentInClass.length) {
      return bad(res, 'Student is not in the class/section for this homework', 403);
    }
  }
  const eligible = await eligibleStudentRows(pool, appId, homework, studentId);
  if (!eligible.length) return bad(res, 'Student is not actively enrolled in this homework class/section/year', 403);
  const [existing] = await execQ(pool, `
    SELECT * FROM school_homework_submissions
     WHERE app_id=$1 AND homework_id=$2 AND student_id=$3
  `, [appId, homeworkId, studentId]);
  if (existing?.status === 'graded') return bad(res, 'Graded work cannot be resubmitted', 409);
  const late = homework.due_date && new Date().toISOString().slice(0, 10) > day(homework.due_date);
  const submission = existing
    ? (await execQ(pool, `
        UPDATE school_homework_submissions
           SET submission_text=$4, attachment_url=$5, submitted_at=now(),
               status=$6, revision=revision+1, updated_at=now()
         WHERE app_id=$1 AND homework_id=$2 AND student_id=$3 RETURNING *
      `, [appId, homeworkId, studentId,
          text(req.body?.submissionText ?? req.body?.submission_text),
          text(req.body?.attachmentUrl ?? req.body?.attachment_url) || null,
          late ? 'late' : 'submitted']))[0]
    : (await execQ(pool, `
        INSERT INTO school_homework_submissions
          (app_id, homework_id, student_id, submission_text, attachment_url, status)
        VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
      `, [appId, homeworkId, studentId,
          text(req.body?.submissionText ?? req.body?.submission_text),
          text(req.body?.attachmentUrl ?? req.body?.attachment_url) || null,
          late ? 'late' : 'submitted']))[0];
  await audit(req, 'homework.submit', 'school_homework_submissions', submission.id, existing, submission);
  res.json({ ok: true, submission });
}));

schoolRouter.post('/homework/submissions/:id/grade', route(async (req, res) => {
  if (!guard(req, res, 'homework.grade')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [submission] = await execQ(pool, `
    SELECT hs.*, h.max_marks, h.title, h.status AS homework_status,
           h.allocation_id, h.teacher_id AS homework_teacher_id
      FROM school_homework_submissions hs
      JOIN school_homework h ON h.id=hs.homework_id AND h.app_id=hs.app_id
     WHERE hs.app_id=$1 AND hs.id=$2
  `, [appId, id]);
  if (!submission) return bad(res, 'Submission not found', 404);
  if (submission.homework_status === 'archived') return bad(res, 'Archived homework cannot be graded', 409);
  if (!isHomeworkManager(req)
      && !(await canAuthorHomework(pool, appId, req, submission.homework_teacher_id))) {
    return bad(res, 'You can only grade submissions for your own subject allocations', 403);
  }
  const marks = num(req.body?.marks);
  if (marks === null || !Number.isFinite(marks) || marks < 0) return bad(res, 'Marks must be zero or greater');
  if (submission.max_marks !== null && marks > Number(submission.max_marks)) {
    return bad(res, `Marks cannot exceed the homework maximum of ${submission.max_marks}`);
  }
  const [graded] = await execQ(pool, `
    UPDATE school_homework_submissions
       SET marks=$3, feedback=$4, graded_at=now(), graded_by=$5,
           status='graded', updated_at=now()
     WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appId, id, marks, text(req.body?.feedback) || null, String(req.user?.userid || '')]);
  await audit(req, 'homework.grade', 'school_homework_submissions', id, submission, graded);
  res.json({ ok: true, submission: graded });
}));
