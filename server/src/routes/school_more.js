import { getPool } from '../db/pool.js';
import { schoolRouter } from './school.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { can } from '../school/foundation.js';
import { findRoomConflicts, roomRow, groupStrength, roomConflictError } from '../school/rooms.js';
import { resolveTeacher } from '../school/staff.js';
import { safeErrorMessage } from '../middleware/error.js';

const appIdOf = (req) => req.user?.company || DEFAULT_COMPANY_ID;

const execQ = async (poolOrClient, sql, params = []) => {
  const res = await poolOrClient.query(sql, params);
  return res.rows;
};

const text = (v) => (v === undefined || v === null || v === '') ? null : String(v);
const num = (v) => (v === undefined || v === null || v === '') ? null : Number(v);
const day = (v) => (v === undefined || v === null || v === '') ? null : (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

const guard = (req, res, perm) => {
  if (can(req.school, perm)) return true;
  res.status(403).json({ error: 'Forbidden', perm });
  return false;
};

const route = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: safeErrorMessage(e, 'School API error') });
  }
};

/* Audit writes must never abort the caller's transaction: a failure is logged
   and rolled back to a savepoint, leaving the business write intact. */
const writeAudit = async (pool, appId, user, meta = {}, reqObj = {}) => {
  const inTransaction = typeof pool?.release === 'function';
  try {
    if (inTransaction) await pool.query('SAVEPOINT school_audit');
    await pool.query(
      `INSERT INTO school_audit_log
         (app_id, user_id, action, entity, entity_id, before_json, after_json, ip, device)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)`,
      [appId,
       String(user?.UserId || user?.userid || user?.id || '') || null,
       meta.action || 'unknown',
       meta.entity || null,
       meta.entityId === null || meta.entityId === undefined ? null : String(meta.entityId),
       meta.before ? JSON.stringify(meta.before) : null,
       meta.after ? JSON.stringify(meta.after) : null,
       reqObj?.ip || null,
       String(reqObj?.headers?.['user-agent'] || '').slice(0, 300) || null],
    );
    if (inTransaction) await pool.query('RELEASE SAVEPOINT school_audit');
  } catch (e) {
    if (inTransaction) {
      await pool.query('ROLLBACK TO SAVEPOINT school_audit').catch(() => {});
      await pool.query('RELEASE SAVEPOINT school_audit').catch(() => {});
    }
    console.error('[school audit]', e.message);
  }
};

/* ---------- timetable locking + audience scope ---------- */

/* All timetable/substitution writes take the same transaction-scoped advisory
   lock. A check followed by an insert is therefore serialized across workers:
   two requests for the same room/teacher/class slot cannot both pass the check
   and commit. */
async function withTimetableLock(pool, appId, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${appId}:timetable`]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function linkedTeacherId(pool, appId, userId) {
  const [row] = await execQ(pool, `
    SELECT id::text AS id
      FROM school_hr_employees
     WHERE app_id=$1 AND user_id=$2 AND coalesce(status, 'active')='active'
     LIMIT 1
  `, [appId, String(userId || '')]);
  if (row) return row.id;
  const [user] = await execQ(pool, `
    SELECT "UserId"::text AS id FROM "tblHO_User"
     WHERE "UserId"=$1 AND coalesce("Status",'1')='1' LIMIT 1
  `, [String(userId || '')]);
  return user?.id || null;
}

async function linkedStudent(pool, appId, userId) {
  const [row] = await execQ(pool, `
    SELECT s.id, s.class_id, s.section_id
      FROM school_students s
      JOIN school_users u ON u.app_id=s.app_id
       AND (u.id::text=s.user_id::text OR (s.user_id::text !~ '^[0-9]+$' AND u.user_id=s.user_id::text))
     WHERE s.app_id=$1 AND u.user_id=$2 AND s.status='active' AND s.deleted_at IS NULL
     LIMIT 1
  `, [appId, String(userId || '')]);
  return row || null;
}

/* A timetable/substitution audience is either a manager, a linked teacher, or
   a linked student. Anything else fails closed instead of falling back to
   caller-supplied filters. */
async function audienceScope(req, pool, appId) {
  const userId = String(req.user?.userid || '');
  if (can(req.school, 'timetable.manage')) return { kind: 'manager', userId };
  if (can(req.school, 'timetable.teacher')) {
    const teacherId = await linkedTeacherId(pool, appId, userId);
    if (!teacherId) return { kind: 'unlinked-teacher', error: 'No active teacher profile is linked to this account' };
    return { kind: 'teacher', userId, teacherId };
  }
  const student = await linkedStudent(pool, appId, userId);
  if (!student) return { kind: 'unlinked-student', student: null };
  return { kind: 'student', userId, student };
}

/* ---------- lesson plans ---------- */
schoolRouter.get('/lesson-plans', route(async (req, res) => {
  if (!guard(req, res, 'academics.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const rows = await execQ(pool, `SELECT lp.*, c.name class_name, s.name section_name, sub.name subject_name FROM school_lesson_plans lp LEFT JOIN school_classes c ON c.id=lp.class_id LEFT JOIN school_sections s ON s.id=lp.section_id LEFT JOIN school_subjects sub ON sub.id=lp.subject_id WHERE lp.app_id=$1 ORDER BY lp.id DESC LIMIT 200`, [appId]);
  res.json({ ok: true, lessonPlans: rows });
}));

schoolRouter.post('/lesson-plans', route(async (req, res) => {
  if (!guard(req, res, 'academics.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  const [row] = await execQ(pool, `INSERT INTO school_lesson_plans (app_id,class_id,section_id,subject_id,teacher_id,academic_year_id,topic,objectives,activities,materials,homework,planned_date,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`, [appId, num(b.classId||b.class_id), num(b.sectionId||b.section_id), num(b.subjectId||b.subject_id), req.user?.UserId, num(b.academicYearId||b.academic_year_id), text(b.topic), text(b.objectives), text(b.activities), text(b.materials), text(b.homework), day(b.plannedDate||b.planned_date), text(b.status)||'planned']);
  await writeAudit(pool, appId, req.user, { action: 'lessonplan.create', entity: 'school_lesson_plans', entityId: row.id });
  res.json({ ok: true, lessonPlan: row });
}));

/* ---------- exam timetable & marks list ---------- */

const clock = (v) => {
  const value = text(v);
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return undefined;
  return `${match[1]}:${match[2]}:${match[3] || '00'}`;
};

function validateSlot(startInput, endInput) {
  const start = clock(startInput);
  const end = clock(endInput);
  if (start === undefined || end === undefined) return { error: 'Times must use HH:MM format' };
  if (start && !end) return { error: 'An end time is required when a start time is set' };
  if (!start && end) return { error: 'A start time is required when an end time is set' };
  if (start && end && end <= start) return { error: 'End time must be after start time' };
  return { start, end };
}

async function scopeRow(pool, table, appId, id) {
  if (!num(id)) return null;
  const [row] = await execQ(pool, `SELECT * FROM ${table} WHERE app_id=$1 AND id=$2`, [appId, num(id)]);
  return row || null;
}

/* Validate one timetable slot against its allocation, room and every overlap
   rule. Called inside withTimetableLock so the check and write are atomic. */
async function timetableValues(pool, appId, input, excludeTimetableId = null, versionId = null) {
  if (!versionId) return { error: 'versionId is required', status: 400 };
  const version = await scopeRow(pool, 'school_timetable_versions', appId, versionId);
  if (!version) return { error: 'Timetable version not found', status: 400 };
  if (version.status === 'archived') return { error: 'Cannot modify an archived version', status: 409 };
  if (version.status === 'published' && excludeTimetableId === null) {
    return { error: 'Cannot add entries directly to a published version; create a draft version first', status: 409 };
  }
  // Prevent editing existing entries in published versions, but allow version status changes
  if (version.status === 'published' && excludeTimetableId !== null && !input.versionStatusOnly) {
    return { error: 'Cannot edit entries in a published version; clone to a draft first', status: 409 };
  }

  const classId = num(input.classId);
  if (!classId) return { error: 'Class is required', status: 400 };
  const schoolClass = await scopeRow(pool, 'school_classes', appId, classId);
  if (!schoolClass) return { error: 'Class not found', status: 400 };
  if (!schoolClass.is_active) return { error: 'The selected class is archived', status: 409 };

  const sectionId = num(input.sectionId);
  let section = null;
  if (sectionId) {
    section = await scopeRow(pool, 'school_sections', appId, sectionId);
    if (!section) return { error: 'Section not found', status: 400 };
    if (Number(section.class_id) !== Number(classId)) {
      return { error: 'The section does not belong to the selected class', status: 400 };
    }
    if (!section.is_active) return { error: 'The selected section is archived', status: 409 };
  }

  const dayOfWeek = num(input.dayOfWeek);
  if (dayOfWeek === null || !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return { error: 'Day of week must be between 0 (Sunday) and 6 (Saturday)', status: 400 };
  }
  const periodNo = num(input.periodNo);
  if (periodNo === null || !Number.isInteger(periodNo) || periodNo <= 0) {
    return { error: 'Period number must be a whole number greater than zero', status: 400 };
  }
  /* Resolve period_id from period_no for the version's campus (or first campus) */
  const periodId = num(input.periodId);
  let resolvedPeriodId = periodId;
  if (!resolvedPeriodId) {
    const [period] = await execQ(pool, `
      SELECT p.id, p.sort_order FROM school_periods p
      WHERE p.app_id=$1 AND p.is_active AND p.sort_order=$2
      ORDER BY p.campus_id NULLS FIRST LIMIT 1
    `, [appId, periodNo]);
    if (!period) return { error: `Period ${periodNo} not found for this school`, status: 400 };
    resolvedPeriodId = period.id;
  } else {
    const [period] = await execQ(pool, 'SELECT id, sort_order FROM school_periods WHERE app_id=$1 AND id=$2 AND is_active', [appId, resolvedPeriodId]);
    if (!period) return { error: 'Invalid period_id', status: 400 };
    if (period.sort_order !== periodNo) {
      return { error: 'period_id and period_no do not match', status: 400 };
    }
  }
  const slot = validateSlot(input.startTime, input.endTime);
  if (slot.error) return { error: slot.error, status: 400 };

  const allocationId = num(input.allocationId);
  if (!allocationId) return { error: 'Subject allocation is required', status: 400 };
  const allocation = await scopeRow(pool, 'school_subject_allocations', appId, allocationId);
  if (!allocation) return { error: 'Subject allocation not found', status: 400 };
  if (!allocation.is_active) return { error: 'The selected allocation is inactive', status: 409 };
  if (Number(allocation.class_id) !== Number(classId)) {
    return { error: 'The allocation does not belong to the selected class', status: 400 };
  }
  if (allocation.section_id && !sectionId) {
    return { error: 'Section is required for this allocation', status: 400 };
  }
  if (sectionId && Number(allocation.section_id) !== Number(sectionId)) {
    return { error: 'The allocation does not belong to the selected section', status: 400 };
  }
  const [allocationYear] = await execQ(pool,
    'SELECT id, name, is_closed FROM school_academic_years WHERE app_id=$1 AND id=$2',
    [appId, allocation.academic_year_id]);
  if (!allocationYear) return { error: 'The allocation academic year was not found', status: 400 };
  if (allocationYear.is_closed) {
    return { error: 'The selected allocation belongs to a closed academic year', status: 409 };
  }
  if (Number(version.academic_year_id) !== Number(allocation.academic_year_id)) {
    return { error: 'Version and allocation must belong to the same academic year', status: 400 };
  }

  const subjectId = allocation.subject_id;
  const teacherId = allocation.teacher_id;
  const subject = await scopeRow(pool, 'school_subjects', appId, subjectId);
  if (!subject) return { error: 'Subject not found', status: 400 };
  if (!subject.is_active) return { error: 'The selected subject is archived', status: 409 };
  if (subject.class_id && Number(subject.class_id) !== Number(classId)) {
    return { error: 'The subject is not eligible for the selected class', status: 400 };
  }

  const roomId = num(input.roomId);
  if (!roomId) return { error: 'Room is required', status: 400 };
  const room = await roomRow(pool, appId, roomId);
  if (!room) return { error: 'Room not found', status: 400 };
  if (!room.is_active) return { error: 'The selected room is archived', status: 409 };
  const strength = await groupStrength(pool, appId, classId, sectionId);
  if (strength > room.capacity) {
    return { error: `Room capacity ${room.capacity} is below the group strength ${strength}`, status: 409 };
  }
  const conflicts = await findRoomConflicts(pool, appId, {
    roomId, dayOfWeek, periodNo, startTime: slot.start, endTime: slot.end,
    excludeTimetableId,
    versionId,
  });
  if (conflicts.length) return { error: roomConflictError(conflicts), status: 409, conflicts };

  if (teacherId) {
    const params = [appId, versionId, teacherId, dayOfWeek];
    let teacherQuery = `SELECT id FROM school_timetables
       WHERE app_id=$1 AND version_id=$2 AND teacher_id=$3 AND day_of_week=$4
         AND start_time < $5 AND end_time > $6`;
    params.push(slot.end, slot.start);
    if (num(excludeTimetableId)) { params.push(num(excludeTimetableId)); teacherQuery += ` AND id <> $${params.length}`; }
    const teacherConflicts = await execQ(pool, teacherQuery, params);
    if (teacherConflicts.length) return { error: 'Teacher already has a class at this time', status: 409 };
  }

  const classParams = [appId, versionId, classId, sectionId, dayOfWeek];
  let classQuery = `SELECT id FROM school_timetables
     WHERE app_id=$1 AND version_id=$2 AND class_id=$3 AND section_id IS NOT DISTINCT FROM $4
       AND day_of_week=$5
       AND start_time < $6 AND end_time > $7`;
  classParams.push(slot.end, slot.start);
  if (num(excludeTimetableId)) { classParams.push(num(excludeTimetableId)); classQuery += ` AND id <> $${classParams.length}`; }
  const classConflicts = await execQ(pool, classQuery, classParams);
  if (classConflicts.length) return { error: 'Class/section already has a class at this time', status: 409 };

  return {
    data: {
      classId, sectionId, dayOfWeek, periodNo,
      startTime: slot.start, endTime: slot.end,
      allocationId, allocation, allocationYear,
      subjectId, teacherId, roomId, room,
      academicYearId: allocation.academic_year_id,
      versionId,
      periodId: resolvedPeriodId,
    },
  };
}

schoolRouter.post('/exams/timetable', route(async (req, res) => {
  if (!guard(req, res, 'exams.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  const scheduleId = num(b.scheduleId || b.schedule_id);
  if (!scheduleId) return res.status(400).json({ error: 'Exam schedule is required' });
  const schedule = await scopeRow(pool, 'school_exam_schedules', appId, scheduleId);
  if (!schedule) return res.status(400).json({ error: 'Exam schedule not found' });
  let scheduleYear = null;
  if (schedule.academic_year_id) {
    [scheduleYear] = await execQ(pool,
      'SELECT id, name, is_closed FROM school_academic_years WHERE app_id=$1 AND id=$2',
      [appId, schedule.academic_year_id]);
    if (!scheduleYear) return res.status(400).json({ error: 'Exam schedule academic year not found' });
    if (scheduleYear.is_closed) return res.status(409).json({ error: 'The exam schedule belongs to a closed academic year' });
  }
  const examDate = day(b.examDate || b.exam_date);
  if (!examDate || Number.isNaN(new Date(`${examDate}T00:00:00Z`).getTime())) {
    return res.status(400).json({ error: 'A valid exam date is required' });
  }
  const slot = validateSlot(b.startTime || b.start_time, b.endTime || b.end_time);
  if (slot.error) return res.status(400).json({ error: slot.error });
  const maxMarks = num(b.maxMarks || b.max_marks);
  if (maxMarks !== null && (!Number.isInteger(maxMarks) || maxMarks <= 0)) {
    return res.status(400).json({ error: 'Maximum marks must be a whole number greater than zero' });
  }

  const allocationId = num(b.allocationId || b.allocation_id);
  if (!allocationId) return res.status(400).json({ error: 'Subject allocation is required' });
  const allocation = await scopeRow(pool, 'school_subject_allocations', appId, allocationId);
  if (!allocation) return res.status(400).json({ error: 'Subject allocation not found' });
  if (!allocation.is_active) return res.status(409).json({ error: 'The selected allocation is inactive' });
  if (schedule.class_id && Number(allocation.class_id) !== Number(schedule.class_id)) {
    return res.status(400).json({ error: 'The allocation does not belong to the exam class' });
  }
  if (schedule.academic_year_id && Number(allocation.academic_year_id) !== Number(schedule.academic_year_id)) {
    return res.status(400).json({ error: 'The allocation does not belong to the exam schedule academic year' });
  }
  const subjectId = allocation.subject_id;
  const subject = await scopeRow(pool, 'school_subjects', appId, subjectId);
  if (!subject) return res.status(400).json({ error: 'Subject not found' });
  if (!subject.is_active) return res.status(409).json({ error: 'The selected subject is archived' });

  const roomId = num(b.roomId || b.room_id);
  if (!roomId) return res.status(400).json({ error: 'Room is required' });
  const room = await roomRow(pool, appId, roomId);
  if (!room) return res.status(400).json({ error: 'Room not found' });
  if (!room.is_active) return res.status(409).json({ error: 'The selected room is archived' });
  if (schedule.class_id) {
    const strength = await groupStrength(pool, appId, schedule.class_id, null);
    if (strength > room.capacity) {
      return res.status(409).json({ error: `Room capacity ${room.capacity} is below the class strength ${strength}` });
    }
  }
  const dayOfWeek = new Date(`${examDate}T00:00:00Z`).getUTCDay();
  const conflicts = await findRoomConflicts(pool, appId, {
    roomId, examDate, dayOfWeek,
    startTime: slot.start, endTime: slot.end,
  });
  if (conflicts.length) {
    return res.status(409).json({ error: roomConflictError(conflicts), conflicts });
  }

  const [row] = await execQ(pool, `
    INSERT INTO school_exam_timetable
      (app_id, schedule_id, subject_id, exam_date, start_time, end_time, max_marks, room_no, room_id, allocation_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
  `, [appId, scheduleId, subjectId, examDate, slot.start, slot.end, maxMarks ?? 100,
      room.code, roomId, allocationId]);
  await writeAudit(pool, appId, req.user, { action: 'exam.timetable.add', entity: 'school_exam_timetable', entityId: row.id });
  res.json({ ok: true, entry: row });
}));

schoolRouter.get('/exams/marks', route(async (req, res) => {
  if (!guard(req, res, 'exams.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const examId = num(req.query.examId||req.query.exam_id);
  if (!examId) return res.json({ ok: true, marks: [] });
  const rows = await execQ(pool, `SELECT m.*, s.first_name, s.last_name, s.admission_no FROM school_marks m LEFT JOIN school_students s ON s.id=m.student_id WHERE m.app_id=$1 AND m.exam_id=$2 ORDER BY s.admission_no, s.first_name`, [appId, examId]);
  res.json({ ok: true, marks: rows });
}));

/* ---------- report card ---------- */
schoolRouter.get('/exams/report-card/:studentId', route(async (req, res) => {
  if (!guard(req, res, 'exams.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const sid = num(req.params.studentId);
  const examId = num(req.query.examId||req.query.exam_id);
  const student = (await execQ(pool, `SELECT * FROM school_students WHERE app_id=$1 AND id=$2`, [appId, sid]))[0];
  let marks = [];
  if (examId) {
    marks = await execQ(pool, `SELECT m.*, sub.name subject_name FROM school_marks m LEFT JOIN school_subjects sub ON sub.id=m.subject_id WHERE m.app_id=$1 AND m.student_id=$2 AND m.exam_id=$3 ORDER BY sub.name`, [appId, sid, examId]);
  } else {
    marks = await execQ(pool, `SELECT m.*, sub.name subject_name, e.exam_name FROM school_marks m LEFT JOIN school_subjects sub ON sub.id=m.subject_id LEFT JOIN school_exam_schedules e ON e.id=m.exam_id WHERE m.app_id=$1 AND m.student_id=$2 ORDER BY e.id, sub.name`, [appId, sid]);
  }
  res.json({ ok: true, student, marks });
}));

/* Resolve the effective version for a date/academic year for non-manager viewers
   Uses same boundary logic as the exclusion constraint (daterange is [inclusive, exclusive)) */
async function resolveEffectiveVersion(pool, appId, academicYearId, date) {
  const d = date || new Date().toISOString().slice(0, 10);
  const [version] = await execQ(pool, `
    SELECT id FROM school_timetable_versions
    WHERE app_id=$1 AND academic_year_id=$2 AND status='published'
      AND effective_from <= $3 AND (effective_to IS NULL OR effective_to > $3)
    ORDER BY effective_from DESC LIMIT 1
  `, [appId, academicYearId, d]);
  return version?.id || null;
}

/* ---------- timetable ---------- */
schoolRouter.get('/timetable', route(async (req, res) => {
  if (!guard(req, res, 'timetable.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const scope = await audienceScope(req, pool, appId);
  if (scope.error) return res.status(403).json({ error: scope.error });
  if (scope.kind === 'unlinked-student') {
    return res.json({ ok: true, timetable: [], reason: 'no_enrollment', scope: scope.kind, enrolled: false });
  }

  const academicYearId = num(req.query.academicYearId || req.query.academic_year_id);
  const versionId = num(req.query.versionId || req.query.version_id);
  const queryDate = day(req.query.date);
  let classId = null;
  let sectionId = null;
  let teacherId = null;
  let effectiveVersionId = null;

  if (scope.kind === 'teacher') {
    teacherId = scope.teacherId;
    // For teacher, resolve version from the academic year that contains the query date
    if (!effectiveVersionId && queryDate) {
      const [allocYear] = await execQ(pool, `
        SELECT DISTINCT academic_year_id FROM school_subject_allocations
        WHERE app_id=$1 AND teacher_id=$2 AND is_active
          AND academic_year_id IN (
            SELECT id FROM school_academic_years
            WHERE app_id=$1 AND start_date <= $3::date AND end_date >= $3::date
          )
        LIMIT 1
      `, [appId, scope.teacherId, queryDate]);
      if (allocYear) {
        effectiveVersionId = await resolveEffectiveVersion(pool, appId, allocYear.academic_year_id, queryDate);
      }
    }
    // Non-managers cannot override version - ignore provided versionId
  } else if (scope.kind === 'student') {
    let enrollmentClassId = null;
    let enrollmentSectionId = null;
    // For student, resolve version from enrollment academic year that contains the query date
    if (!effectiveVersionId && academicYearId) {
      effectiveVersionId = await resolveEffectiveVersion(pool, appId, academicYearId, queryDate);
    } else if (!effectiveVersionId && queryDate) {
      // Try to get from current enrollment that matches the query date
      const [enr] = await execQ(pool, `
        SELECT e.academic_year_id, e.class_id, e.section_id FROM school_student_enrollments e
        JOIN school_academic_years ay ON ay.id = e.academic_year_id AND ay.app_id = e.app_id
        WHERE e.app_id=$1 AND e.student_id=$2 
          AND coalesce(e.status,'studying') NOT IN ('withdrawn','left','transferred')
          AND ay.start_date <= $3::date AND ay.end_date >= $3::date
        ORDER BY ay.start_date DESC LIMIT 1
      `, [appId, scope.student.id, queryDate]);
      if (enr) {
        effectiveVersionId = await resolveEffectiveVersion(pool, appId, enr.academic_year_id, queryDate);
        enrollmentClassId = enr.class_id;
        enrollmentSectionId = enr.section_id;
      }
    }
    // Use enrollment class/section for the query date, fall back to current
    classId = enrollmentClassId || scope.student.class_id;
    sectionId = enrollmentSectionId || scope.student.section_id;
    if (classId === null || classId === undefined) {
      return res.json({ ok: true, timetable: [], reason: 'no_enrollment' });
    }
    // Non-managers cannot override version - ignore provided versionId
  } else if (scope.kind === 'manager') {
    classId = num(req.query.classId || req.query.class_id);
    sectionId = num(req.query.sectionId || req.query.section_id);
    teacherId = text(req.query.teacherId || req.query.teacher_id);
    effectiveVersionId = versionId; // Only managers can explicitly choose version
  }

  // If no effective version found for non-managers, return empty (don't fall back to unfiltered)
  if (scope.kind !== 'manager' && !effectiveVersionId) {
    return res.json({ ok: true, timetable: [], reason: 'no_effective_version' });
  }

  let q = `SELECT t.*, v.name AS version_name, v.status AS version_status, v.version AS version_number,
                  r.code AS room_code, r.name AS room_name, r.capacity AS room_capacity,
                  c.name AS class_name, sec.name AS section_name, sub.name AS subject_name,
                  ay.name AS academic_year_name, ay.is_closed AS academic_year_closed,
                  t.is_published, t.published_at
             FROM school_timetables t
             LEFT JOIN school_timetable_versions v ON v.id=t.version_id AND v.app_id=t.app_id
             LEFT JOIN school_rooms r ON r.id=t.room_id AND r.app_id=t.app_id
             LEFT JOIN school_classes c ON c.id=t.class_id AND c.app_id=t.app_id
             LEFT JOIN school_sections sec ON sec.id=t.section_id AND sec.app_id=t.app_id
             LEFT JOIN school_subjects sub ON sub.id=t.subject_id AND sub.app_id=t.app_id
             LEFT JOIN school_academic_years ay ON ay.id=t.academic_year_id AND ay.app_id=t.app_id
            WHERE t.app_id=$1`;
  const params = [appId];
  if (scope.kind !== 'manager') q += ` AND (t.is_published=true OR v.status='published')`;
  if (effectiveVersionId) { params.push(effectiveVersionId); q += ` AND t.version_id=$${params.length}`; }
  else if (scope.kind === 'manager' && academicYearId) { params.push(academicYearId); q += ` AND t.academic_year_id=$${params.length}`; }
  if (classId) { params.push(classId); q += ` AND t.class_id=$${params.length}`; }
  if (sectionId) { params.push(sectionId); q += ` AND t.section_id=$${params.length}`; }
  if (teacherId) { params.push(teacherId); q += ` AND t.teacher_id=$${params.length}`; }
  q += ` ORDER BY t.day_of_week, t.period_no`;
  const rows = await execQ(pool, q, params);
  res.json({ ok: true, timetable: rows, scope: scope.kind, enrolled: scope.kind !== 'student' || classId != null, versionId: effectiveVersionId });
}));

schoolRouter.post('/timetable', route(async (req, res) => {
  if (!guard(req, res, 'timetable.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  const versionId = num(b.versionId ?? b.version_id);
  if (!versionId) return res.status(400).json({ error: 'versionId is required' });

  const outcome = await withTimetableLock(pool, appId, async (client) => {
    const checked = await timetableValues(client, appId, {
      classId: b.classId ?? b.class_id,
      sectionId: b.sectionId ?? b.section_id,
      allocationId: b.allocationId ?? b.allocation_id,
      roomId: b.roomId ?? b.room_id,
      dayOfWeek: b.dayOfWeek ?? b.day_of_week,
      periodNo: b.periodNo ?? b.period_no,
      periodId: b.periodId ?? b.period_id,
      startTime: b.startTime ?? b.start_time,
      endTime: b.endTime ?? b.end_time,
    }, null, versionId);
    if (checked.error) return { status: checked.status || 400, body: { error: checked.error, conflicts: checked.conflicts } };

    const d = checked.data;
    const [row] = await execQ(client, `
      INSERT INTO school_timetables
        (app_id, version_id, class_id, section_id, subject_id, teacher_id, allocation_id, room_id, room_no,
         day_of_week, period_no, period_id, start_time, end_time, academic_year_id, is_published, published_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,false,NULL) RETURNING *
    `, [appId, versionId, d.classId, d.sectionId, d.subjectId, d.teacherId || null, d.allocationId, d.roomId,
        d.room.code, d.dayOfWeek, d.periodNo, d.periodId, d.startTime, d.endTime, d.academicYearId]);
    await writeAudit(client, appId, req.user, { action: 'timetable.create', entity: 'school_timetables', entityId: row.id });
    return { status: 200, body: { ok: true, entry: row } };
  });
  res.status(outcome.status).json(outcome.body);
}));

schoolRouter.put('/timetable/:id', route(async (req, res) => {
  if (!guard(req, res, 'timetable.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};

  const outcome = await withTimetableLock(pool, appId, async (client) => {
    const [existing] = await execQ(client, `SELECT * FROM school_timetables WHERE app_id=$1 AND id=$2`, [appId, id]);
    if (!existing) return { status: 404, body: { error: 'Timetable entry not found' } };

    const versionId = num(b.versionId ?? b.version_id ?? existing.version_id);
    if (!versionId) return { status: 400, body: { error: 'versionId is required' } };

    const checked = await timetableValues(client, appId, {
      classId: b.classId ?? b.class_id ?? existing.class_id,
      sectionId: b.sectionId ?? b.section_id ?? existing.section_id,
      allocationId: b.allocationId ?? b.allocation_id ?? existing.allocation_id,
      roomId: b.roomId ?? b.room_id ?? existing.room_id,
      dayOfWeek: b.dayOfWeek ?? b.day_of_week ?? existing.day_of_week,
      periodNo: b.periodNo ?? b.period_no ?? existing.period_no,
      periodId: b.periodId ?? b.period_id ?? existing.period_id,
      startTime: b.startTime ?? b.start_time ?? existing.start_time,
      endTime: b.endTime ?? b.end_time ?? existing.end_time,
    }, id, versionId);
    if (checked.error) return { status: checked.status || 400, body: { error: checked.error, conflicts: checked.conflicts } };

    const d = checked.data;
    const [row] = await execQ(client, `
      UPDATE school_timetables
         SET version_id=$3, class_id=$4, section_id=$5, subject_id=$6, teacher_id=$7, allocation_id=$8,
             room_id=$9, room_no=$10, day_of_week=$11, period_no=$12, period_id=$13, start_time=$14,
             end_time=$15, academic_year_id=$16, updated_at=now()
       WHERE app_id=$1 AND id=$2 RETURNING *
    `, [appId, id, versionId, d.classId, d.sectionId, d.subjectId, d.teacherId || null, d.allocationId,
        d.roomId, d.room.code, d.dayOfWeek, d.periodNo, d.periodId, d.startTime, d.endTime, d.academicYearId]);
    await writeAudit(client, appId, req.user, { action: 'timetable.update', entity: 'school_timetables', entityId: id, before: existing, after: row });
    return { status: 200, body: { ok: true, entry: row } };
  });
  res.status(outcome.status).json(outcome.body);
}));

for (const [action, target] of [['publish', true], ['unpublish', false]]) {
  schoolRouter.post(`/timetable/:id/${action}`, route(async (req, res) => {
    if (!guard(req, res, 'timetable.manage')) return;
    const pool = getPool();
    const appId = appIdOf(req);
    const id = num(req.params.id);
    const [existing] = await execQ(pool, `SELECT * FROM school_timetables WHERE app_id=$1 AND id=$2`, [appId, id]);
    if (!existing) return res.status(404).json({ error: 'Timetable entry not found' });
    if (existing.is_published === target) return res.status(409).json({ error: `Timetable entry is already ${action}ed` });
    
    const [row] = await execQ(pool, `
      UPDATE school_timetables
         SET is_published=$3, published_at=CASE WHEN $3 THEN coalesce(published_at, now()) ELSE NULL END, updated_at=now()
      WHERE app_id=$1 AND id=$2 RETURNING *
    `, [appId, id, target]);
    await writeAudit(pool, appId, req.user, { action: `timetable.${action}`, entity: 'school_timetables', entityId: id, before: existing, after: row });
    res.json({ ok: true, entry: row });
  }));
}

schoolRouter.delete('/timetable/:id', route(async (req, res) => {
  if (!guard(req, res, 'timetable.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);

  const outcome = await withTimetableLock(pool, appId, async (client) => {
    const [existing] = await execQ(client, `SELECT * FROM school_timetables WHERE app_id=$1 AND id=$2`, [appId, id]);
    if (!existing) return { status: 404, body: { error: 'Timetable entry not found' } };

    // Assigned substitutions are live commitments; cancel them first so the
    // timetable history is never silently orphaned.
    const subCountRows = await execQ(client,
      `SELECT count(*)::int AS n FROM school_substitutions WHERE app_id=$1 AND timetable_id=$2 AND status='assigned'`,
      [appId, id]);
    if ((subCountRows[0]?.n ?? 0) > 0) {
      return { status: 409, body: { error: 'Timetable entry has active substitutions; cancel them first' } };
    }

    await execQ(client, `DELETE FROM school_timetables WHERE app_id=$1 AND id=$2`, [appId, id]);
    await writeAudit(client, appId, req.user, { action: 'timetable.delete', entity: 'school_timetables', entityId: id, before: existing });
    return { status: 200, body: { ok: true } };
  });
  res.status(outcome.status).json(outcome.body);
}));

/* ---------- periods ---------- */

schoolRouter.get('/periods', route(async (req, res) => {
  if (!guard(req, res, 'timetable.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const campusId = num(req.query.campusId);
  let q = `SELECT * FROM school_periods WHERE app_id=$1 AND is_active`;
  const params = [appId];
  if (campusId) { params.push(campusId); q += ` AND (campus_id IS NULL OR campus_id=$${params.length})`; }
  q += ` ORDER BY sort_order`;
  const periods = await execQ(pool, q, params);
  res.json({ ok: true, periods });
}));

schoolRouter.post('/periods', route(async (req, res) => {
  if (!guard(req, res, 'timetable.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  const campusId = num(b.campusId);
  const code = text(b.code);
  const label = text(b.label);
  const startTime = text(b.startTime ?? b.start_time);
  const endTime = text(b.endTime ?? b.end_time);
  const sortOrder = num(b.sortOrder ?? b.sort_order) ?? 0;
  if (!code || !label || !startTime || !endTime) return res.status(400).json({ error: 'code, label, startTime, endTime are required' });
  const [period] = await execQ(pool, `
    INSERT INTO school_periods (app_id, campus_id, code, label, start_time, end_time, sort_order)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [appId, campusId, code, label, startTime, endTime, sortOrder]);
  await writeAudit(pool, appId, req.user, { action: 'period.create', entity: 'school_periods', entityId: period.id, after: period });
  res.json({ ok: true, period });
}));

schoolRouter.put('/periods/:id', route(async (req, res) => {
  if (!guard(req, res, 'timetable.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [existing] = await execQ(pool, 'SELECT * FROM school_periods WHERE app_id=$1 AND id=$2', [appId, id]);
  if (!existing) return res.status(404).json({ error: 'Period not found' });
  const b = req.body || {};
  const [period] = await execQ(pool, `
    UPDATE school_periods SET campus_id=$3, code=$4, label=$5, start_time=$6, end_time=$7, sort_order=$8, is_active=$9, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appId, id, num(b.campusId ?? existing.campus_id), text(b.code ?? existing.code), text(b.label ?? existing.label),
      text(b.startTime ?? b.start_time ?? existing.start_time), text(b.endTime ?? b.end_time ?? existing.end_time),
      num(b.sortOrder ?? b.sort_order ?? existing.sort_order), b.isActive === undefined ? existing.is_active : Boolean(b.isActive)]);
  await writeAudit(pool, appId, req.user, { action: 'period.update', entity: 'school_periods', entityId: id, before: existing, after: period });
  res.json({ ok: true, period });
}));

schoolRouter.delete('/periods/:id', route(async (req, res) => {
  if (!guard(req, res, 'timetable.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [{ n }] = await execQ(pool, 'SELECT count(*)::int AS n FROM school_timetables WHERE app_id=$1', [appId]);
  if (n > 0) return res.status(409).json({ error: 'Period is referenced by timetable entries; deactivate instead' });
  await execQ(pool, 'DELETE FROM school_periods WHERE app_id=$1 AND id=$2', [appId, id]);
  await writeAudit(pool, appId, req.user, { action: 'period.delete', entity: 'school_periods', entityId: id });
  res.json({ ok: true });
}));

/* ---------- timetable versions ---------- */

schoolRouter.get('/timetable/versions', route(async (req, res) => {
  if (!guard(req, res, 'timetable.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const academicYearId = num(req.query.academicYearId ?? req.query.academic_year_id);
  let q = `SELECT v.*, ay.name AS academic_year_name FROM school_timetable_versions v
           JOIN school_academic_years ay ON ay.id=v.academic_year_id AND ay.app_id=v.app_id
           WHERE v.app_id=$1`;
  const params = [appId];
  if (academicYearId) { params.push(academicYearId); q += ` AND v.academic_year_id=$${params.length}`; }
  q += ` ORDER BY v.effective_from DESC, v.version DESC`;
  const versions = await execQ(pool, q, params);
  res.json({ ok: true, versions });
}));

/* Check for overlapping published versions for the same academic year */
async function checkVersionOverlap(pool, appId, academicYearId, effectiveFrom, effectiveTo, excludeId = null) {
  let q = `SELECT id FROM school_timetable_versions
           WHERE app_id=$1 AND academic_year_id=$2 AND status='published'
             AND effective_from < $3 AND (effective_to IS NULL OR effective_to > $4)`;
  const params = [appId, academicYearId, effectiveTo || '9999-12-31', effectiveFrom];
  if (excludeId) {
    params.push(excludeId);
    q += ` AND id <> $${params.length}`;
  }
  const overlap = await execQ(pool, q, params);
  return overlap.length > 0;
}

schoolRouter.post('/timetable/versions', route(async (req, res) => {
  if (!guard(req, res, 'timetable.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  const academicYearId = num(b.academicYearId ?? b.academic_year_id);
  const name = text(b.name);
  const effectiveFrom = day(b.effectiveFrom ?? b.effective_from);
  const effectiveTo = day(b.effectiveTo ?? b.effective_to);
  const status = text(b.status) || 'draft';
  const parentVersionId = num(b.parentVersionId ?? b.parent_version_id);
  if (!academicYearId) return res.status(400).json({ error: 'academicYearId is required' });
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!effectiveFrom) return res.status(400).json({ error: 'effectiveFrom is required' });
  if (effectiveTo && effectiveTo < effectiveFrom) return res.status(400).json({ error: 'effectiveTo cannot be before effectiveFrom' });
  if (!['draft', 'published', 'archived'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  
  // Serialize concurrent publish operations for the same academic year
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${appId}:timetable_version:${academicYearId}`]);
    
    if (status === 'published') {
      const overlap = await checkVersionOverlap(client, appId, academicYearId, effectiveFrom, effectiveTo);
      if (overlap) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'A published version already exists for this date range' });
      }
    }
    
    const [version] = await execQ(client, `
      INSERT INTO school_timetable_versions (app_id, academic_year_id, name, effective_from, effective_to, status, parent_version_id, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [appId, academicYearId, name, effectiveFrom, effectiveTo, status, parentVersionId, String(req.user?.userid || '')]);
    await writeAudit(client, appId, req.user, { action: 'timetable_version.create', entity: 'school_timetable_versions', entityId: version.id, after: version });
    await client.query('COMMIT');
    res.json({ ok: true, version });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}));

schoolRouter.put('/timetable/versions/:id', route(async (req, res) => {
  if (!guard(req, res, 'timetable.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [existing] = await execQ(pool, 'SELECT * FROM school_timetable_versions WHERE app_id=$1 AND id=$2', [appId, id]);
  if (!existing) return res.status(404).json({ error: 'Version not found' });
  
  const b = req.body || {};
  const effectiveFrom = b.effectiveFrom === undefined && b.effective_from === undefined ? existing.effective_from : day(b.effectiveFrom ?? b.effective_from);
  const effectiveTo = b.effectiveTo === undefined && b.effective_to === undefined ? existing.effective_to : day(b.effectiveTo ?? b.effective_to);
  const status = text(b.status ?? existing.status);
  
  // Only allow status transitions for published versions; block other edits
  const isStatusOnly = Object.keys(b).length <= 2 && b.status !== undefined;
  if (existing.status === 'published' && !isStatusOnly) {
    return res.status(409).json({ error: 'Published versions cannot be edited; only status changes (publish/archive) are allowed. Clone to a draft to edit other fields.' });
  }
  
  if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) return res.status(400).json({ error: 'effectiveTo cannot be before effectiveFrom' });
  if (!['draft', 'published', 'archived'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  
  // Serialize concurrent status changes for the same academic year
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${appId}:timetable_version:${existing.academic_year_id}`]);
    
    if (status === 'published' && status !== existing.status) {
      const overlap = await checkVersionOverlap(client, appId, existing.academic_year_id, effectiveFrom, effectiveTo, id);
      if (overlap) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'A published version already exists for this date range' });
      }
    }
    
    const [version] = await execQ(client, `
      UPDATE school_timetable_versions SET name=$3, effective_from=$4, effective_to=$5, status=$6, updated_at=now()
      WHERE app_id=$1 AND id=$2 RETURNING *
    `, [appId, id, text(b.name ?? existing.name), effectiveFrom, effectiveTo, status]);
    await writeAudit(client, appId, req.user, { action: 'timetable_version.update', entity: 'school_timetable_versions', entityId: id, before: existing, after: version });
    await client.query('COMMIT');
    res.json({ ok: true, version });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}));

schoolRouter.post('/timetable/versions/:id/clone', route(async (req, res) => {
  if (!guard(req, res, 'timetable.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [source] = await execQ(pool, 'SELECT * FROM school_timetable_versions WHERE app_id=$1 AND id=$2', [appId, id]);
  if (!source) return res.status(404).json({ error: 'Source version not found' });
  const b = req.body || {};
  const name = text(b.name) || `${source.name} (copy)`;
  const effectiveFrom = day(b.effectiveFrom ?? b.effective_from ?? new Date().toISOString().slice(0, 10));
  const effectiveTo = day(b.effectiveTo ?? b.effective_to ?? source.effective_to);
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Create new version
    const [newVersion] = await execQ(client, `
      INSERT INTO school_timetable_versions (app_id, academic_year_id, name, effective_from, effective_to, status, version, parent_version_id, created_by)
      VALUES ($1,$2,$3,$4,$5,'draft',$6,$7,$8) RETURNING *
    `, [appId, source.academic_year_id, name, effectiveFrom, effectiveTo, source.version + 1, source.id, String(req.user?.userid || '')]);
    
    // Copy timetable entries to new version
    await execQ(client, `
      INSERT INTO school_timetables (app_id, version_id, class_id, section_id, subject_id, teacher_id, allocation_id, room_id, room_no,
        day_of_week, period_no, period_id, start_time, end_time, academic_year_id, is_published, published_at)
      SELECT app_id, $1, class_id, section_id, subject_id, teacher_id, allocation_id, room_id, room_no,
        day_of_week, period_no, period_id, start_time, end_time, academic_year_id, false, NULL
      FROM school_timetables
      WHERE app_id=$2 AND version_id=$3
    `, [newVersion.id, appId, source.id]);
    
    await client.query('COMMIT');
    await writeAudit(pool, appId, req.user, { action: 'timetable_version.clone', entity: 'school_timetable_versions', entityId: newVersion.id, after: newVersion });
    res.json({ ok: true, version: newVersion });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}));

/* ---------- substitutions ---------- */

function validDate(value) {
  const text = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) return null;
  return text;
}

/* Validate one dated substitution against the exact timetable occurrence.
   Class, section, subject, period and the absent teacher are derived from the
   timetable row; caller-supplied values may only confirm them, never replace
   them. Runs inside withTimetableLock so availability cannot race a booking. */
async function substitutionValues(pool, appId, input, excludeSubstitutionId = null) {
  const timetableId = num(input.timetableId);
  if (!timetableId) return { error: 'Timetable entry is required', status: 400 };
  const timetable = await scopeRow(pool, 'school_timetables', appId, timetableId);
  if (!timetable) return { error: 'Timetable entry not found', status: 400 };
  if (!timetable.teacher_id) {
    return { error: 'The timetable entry has no assigned teacher to substitute', status: 409 };
  }
  if (timetable.day_of_week === null || timetable.day_of_week === undefined) {
    return { error: 'The timetable entry has no scheduled weekday', status: 409 };
  }
  if (!timetable.is_published) {
    return { error: 'Publish the timetable entry before assigning a substitution', status: 409 };
  }

  const subDate = validDate(input.subDate);
  if (!subDate) return { error: 'A valid substitution date (YYYY-MM-DD) is required', status: 400 };
  const weekday = new Date(`${subDate}T00:00:00Z`).getUTCDay();
  if (Number(weekday) !== Number(timetable.day_of_week)) {
    return { error: 'The substitution date does not fall on the timetable entry weekday', status: 409 };
  }

  const [year] = await execQ(pool,
    'SELECT id, name, start_date, end_date, is_closed FROM school_academic_years WHERE app_id=$1 AND id=$2',
    [appId, timetable.academic_year_id]);
  if (!year) return { error: 'The timetable academic year was not found', status: 400 };
  if (year.is_closed) return { error: 'Substitutions cannot be created in a closed academic year', status: 409 };
  if (day(year.start_date) && subDate < day(year.start_date)) {
    return { error: 'The substitution date is before the academic year starts', status: 409 };
  }
  if (day(year.end_date) && subDate > day(year.end_date)) {
    return { error: 'The substitution date is after the academic year ends', status: 409 };
  }

  for (const [label, provided, actual] of [
    ['Class', input.classId, timetable.class_id],
    ['Section', input.sectionId, timetable.section_id],
    ['Subject', input.subjectId, timetable.subject_id],
    ['Period', input.periodNo, timetable.period_no],
  ]) {
    if (provided === null || provided === undefined || provided === '') continue;
    if (String(provided) !== String(actual ?? '')) {
      return { error: `${label} does not match the timetable entry`, status: 400 };
    }
  }

  const absentTeacherId = text(input.absentTeacherId) || String(timetable.teacher_id);
  if (absentTeacherId !== String(timetable.teacher_id)) {
    return { error: 'Absent teacher does not match the timetable entry', status: 400 };
  }
  const absentTeacher = await resolveTeacher(pool, appId, absentTeacherId);
  if (!absentTeacher) return { error: 'The absent teacher is not an active staff member', status: 400 };

  const substituteTeacherId = text(input.substituteTeacherId);
  if (!substituteTeacherId) return { error: 'Substitute teacher is required', status: 400 };
  if (substituteTeacherId === absentTeacherId) {
    return { error: 'Absent and substitute teacher cannot be the same', status: 400 };
  }
  const substitute = await resolveTeacher(pool, appId, substituteTeacherId);
  if (!substitute) return { error: 'The substitute teacher is not an active staff member', status: 400 };
  if (substitute.employeeId) {
    const [availability] = await execQ(pool, `
      SELECT availability_type FROM school_staff_availability
       WHERE app_id=$1 AND employee_id=$2 AND availability_date=$3::date
         AND published=true AND availability_type IN ('absent','leave')
       LIMIT 1
    `, [appId, substitute.employeeId, subDate]);
    if (availability) {
      return { error: 'The selected substitute is marked unavailable by Attendance for this date', status: 409 };
    }
  }

  const periodNo = Number(timetable.period_no);
  const [duplicate] = await execQ(pool, `
    SELECT id FROM school_substitutions
     WHERE app_id=$1 AND timetable_id=$2 AND sub_date=$3 AND status='assigned'
       AND ($4::int IS NULL OR id <> $4::int)
     LIMIT 1
  `, [appId, timetableId, subDate, num(excludeSubstitutionId)]);
  if (duplicate) {
    return { error: 'A substitution already exists for this timetable entry on this date', status: 409 };
  }

  const [timetableConflict] = await execQ(pool, `
    SELECT id FROM school_timetables
     WHERE app_id=$1 AND teacher_id=$2 AND day_of_week=$3 AND period_no=$4
       AND id <> $5
     LIMIT 1
  `, [appId, substituteTeacherId, weekday, periodNo, timetableId]);
  if (timetableConflict) {
    return { error: 'Substitute teacher already has a class at this time', status: 409 };
  }

  const [substitutionConflict] = await execQ(pool, `
    SELECT id FROM school_substitutions
     WHERE app_id=$1 AND sub_date=$2 AND period_no=$3 AND status='assigned'
       AND (substitute_teacher_id=$4 OR absent_teacher_id=$4)
       AND ($5::int IS NULL OR id <> $5::int)
     LIMIT 1
  `, [appId, subDate, periodNo, substituteTeacherId, num(excludeSubstitutionId)]);
  if (substitutionConflict) {
    return { error: 'Substitute teacher is already engaged at this time', status: 409 };
  }

  return {
    data: {
      timetableId,
      timetable,
      subDate,
      absentTeacherId,
      substituteTeacherId,
      classId: timetable.class_id,
      sectionId: timetable.section_id,
      subjectId: timetable.subject_id,
      periodNo,
      academicYearId: timetable.academic_year_id,
    },
  };
}

schoolRouter.get('/substitutions', route(async (req, res) => {
  if (!guard(req, res, 'timetable.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const scope = await audienceScope(req, pool, appId);
  if (scope.error) return res.status(403).json({ error: scope.error });
  if (scope.kind === 'unlinked-student') {
    return res.json({ ok: true, substitutions: [], reason: 'no_enrollment', scope: scope.kind, enrolled: false });
  }

  const academicYearId = num(req.query.academicYearId || req.query.academic_year_id);
  let classId = null;
  let sectionId = null;
  let teacherId = null;

  if (scope.kind === 'teacher') {
    teacherId = scope.teacherId;
  } else if (scope.kind === 'student') {
    classId = scope.student.class_id;
    sectionId = scope.student.section_id;
    if (classId === null || classId === undefined) {
      return res.json({ ok: true, substitutions: [], reason: 'no_enrollment' });
    }
  } else if (scope.kind === 'manager') {
    classId = num(req.query.classId || req.query.class_id);
    sectionId = num(req.query.sectionId || req.query.section_id);
    teacherId = text(req.query.teacherId || req.query.teacher_id);
  }

  let q = `SELECT s.*, t.class_id, t.section_id, t.subject_id, t.day_of_week, t.period_no,
                  t.start_time, t.end_time, t.is_published,
                  c.name AS class_name, sec.name AS section_name, sub.name AS subject_name,
                  ay.name AS academic_year_name, ay.is_closed AS academic_year_closed,
                  coalesce(
                    nullif(trim(coalesce(ae.first_name, '') || ' ' || coalesce(ae.last_name, '')), ''),
                    au."UserName", s.absent_teacher_id
                  ) AS absent_teacher_display,
                  coalesce(
                    nullif(trim(coalesce(se.first_name, '') || ' ' || coalesce(se.last_name, '')), ''),
                    su."UserName", s.substitute_teacher_id
                  ) AS substitute_teacher_display
             FROM school_substitutions s
             LEFT JOIN school_timetables t ON t.id=s.timetable_id AND t.app_id=s.app_id
             LEFT JOIN school_classes c ON c.id=t.class_id AND c.app_id=t.app_id
             LEFT JOIN school_sections sec ON sec.id=t.section_id AND sec.app_id=t.app_id
             LEFT JOIN school_subjects sub ON sub.id=t.subject_id AND sub.app_id=t.app_id
             LEFT JOIN school_academic_years ay ON ay.id=t.academic_year_id AND ay.app_id=t.app_id
             LEFT JOIN school_hr_employees ae ON ae.id::text=s.absent_teacher_id AND ae.app_id=s.app_id
             LEFT JOIN school_hr_employees se ON se.id::text=s.substitute_teacher_id AND se.app_id=s.app_id
             LEFT JOIN "tblHO_User" au ON au."UserId"::text=s.absent_teacher_id
             LEFT JOIN "tblHO_User" su ON su."UserId"::text=s.substitute_teacher_id
            WHERE s.app_id=$1`;
  const params = [appId];
  if (scope.kind !== 'manager') q += ` AND t.is_published=true`;
  if (scope.kind === 'manager' && academicYearId) { params.push(academicYearId); q += ` AND t.academic_year_id=$${params.length}`; }
  if (classId) { params.push(classId); q += ` AND t.class_id=$${params.length}`; }
  if (sectionId) { params.push(sectionId); q += ` AND t.section_id=$${params.length}`; }
  if (teacherId) { params.push(teacherId); q += ` AND (s.absent_teacher_id=$${params.length} OR s.substitute_teacher_id=$${params.length})`; }
  q += ` ORDER BY s.sub_date DESC, s.period_no`;
  const rows = await execQ(pool, q, params);
  res.json({ ok: true, substitutions: rows, scope: scope.kind, enrolled: scope.kind !== 'student' || classId != null });
}));

schoolRouter.post('/substitutions', route(async (req, res) => {
  if (!guard(req, res, 'timetable.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};

  const outcome = await withTimetableLock(pool, appId, async (client) => {
    const checked = await substitutionValues(client, appId, {
      timetableId: b.timetableId ?? b.timetable_id,
      subDate: b.subDate ?? b.sub_date,
      absentTeacherId: b.absentTeacherId ?? b.absent_teacher_id,
      substituteTeacherId: b.substituteTeacherId ?? b.substitute_teacher_id,
      classId: b.classId ?? b.class_id,
      sectionId: b.sectionId ?? b.section_id,
      subjectId: b.subjectId ?? b.subject_id,
      periodNo: b.periodNo ?? b.period_no,
    });
    if (checked.error) return { status: checked.status || 400, body: { error: checked.error } };

    const d = checked.data;
    const [row] = await execQ(client, `
      INSERT INTO school_substitutions
        (app_id, timetable_id, absent_teacher_id, substitute_teacher_id, class_id,
         section_id, subject_id, period_no, sub_date, status, notified)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'assigned',false) RETURNING *
    `, [appId, d.timetableId, d.absentTeacherId, d.substituteTeacherId, d.classId,
        d.sectionId, d.subjectId, d.periodNo, d.subDate]);
    await writeAudit(client, appId, req.user, { action: 'substitution.assign', entity: 'school_substitutions', entityId: row.id });
    return { status: 200, body: { ok: true, substitution: row } };
  });
  res.status(outcome.status).json(outcome.body);
}));

schoolRouter.put('/substitutions/:id', route(async (req, res) => {
  if (!guard(req, res, 'timetable.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};

  const outcome = await withTimetableLock(pool, appId, async (client) => {
    const [existing] = await execQ(client, `SELECT * FROM school_substitutions WHERE app_id=$1 AND id=$2`, [appId, id]);
    if (!existing) return { status: 404, body: { error: 'Substitution not found' } };

    const nextStatus = text(b.status) || existing.status;
    const allowedTransitions = {
      assigned: ['assigned', 'cancelled', 'completed'],
      completed: ['completed'],
      cancelled: ['cancelled'],
    };
    if (!allowedTransitions[existing.status]?.includes(nextStatus)) {
      return { status: 409, body: { error: `Cannot change status from ${existing.status} to ${nextStatus}` } };
    }

    const checked = await substitutionValues(client, appId, {
      timetableId: b.timetableId ?? b.timetable_id ?? existing.timetable_id,
      subDate: b.subDate ?? b.sub_date ?? existing.sub_date,
      absentTeacherId: b.absentTeacherId ?? b.absent_teacher_id ?? existing.absent_teacher_id,
      substituteTeacherId: b.substituteTeacherId ?? b.substitute_teacher_id ?? existing.substitute_teacher_id,
      classId: b.classId ?? b.class_id,
      sectionId: b.sectionId ?? b.section_id,
      subjectId: b.subjectId ?? b.subject_id,
      periodNo: b.periodNo ?? b.period_no,
    }, id);
    if (checked.error) return { status: checked.status || 400, body: { error: checked.error } };

    const d = checked.data;
    const [row] = await execQ(client, `
      UPDATE school_substitutions
         SET timetable_id=$3, sub_date=$4, absent_teacher_id=$5, substitute_teacher_id=$6,
             class_id=$7, section_id=$8, subject_id=$9, period_no=$10, status=$11, updated_at=now()
      WHERE app_id=$1 AND id=$2 RETURNING *
    `, [appId, id, d.timetableId, d.subDate, d.absentTeacherId, d.substituteTeacherId,
        d.classId, d.sectionId, d.subjectId, d.periodNo, nextStatus]);
    await writeAudit(client, appId, req.user, { action: 'substitution.update', entity: 'school_substitutions', entityId: id, before: existing, after: row });
    return { status: 200, body: { ok: true, substitution: row } };
  });
  res.status(outcome.status).json(outcome.body);
}));

schoolRouter.delete('/substitutions/:id', route(async (req, res) => {
  if (!guard(req, res, 'timetable.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);

  const outcome = await withTimetableLock(pool, appId, async (client) => {
    const [existing] = await execQ(client, `SELECT * FROM school_substitutions WHERE app_id=$1 AND id=$2`, [appId, id]);
    if (!existing) return { status: 404, body: { error: 'Substitution not found' } };

    if (existing.status !== 'assigned') {
      return { status: 409, body: { error: 'Only assigned substitutions can be cancelled; use status update for other changes' } };
    }

    const [row] = await execQ(client, `
      UPDATE school_substitutions
         SET status='cancelled', updated_at=now()
      WHERE app_id=$1 AND id=$2 RETURNING *
    `, [appId, id]);
    await writeAudit(client, appId, req.user, { action: 'substitution.cancel', entity: 'school_substitutions', entityId: id, before: existing, after: row });
    return { status: 200, body: { ok: true, substitution: row } };
  });
  res.status(outcome.status).json(outcome.body);
}));

/* ---------- front office: visitors, gate passes ---------- */
schoolRouter.get('/visitors', route(async (req, res) => {
  if (!guard(req, res, 'frontoffice.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const rows = await execQ(pool, `SELECT * FROM school_visitors WHERE app_id=$1 ORDER BY in_time DESC LIMIT 200`, [appId]);
  res.json({ ok: true, visitors: rows });
}));

schoolRouter.post('/visitors', route(async (req, res) => {
  if (!guard(req, res, 'frontoffice.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  const [row] = await execQ(pool, `INSERT INTO school_visitors (app_id,visitor_name,phone,purpose,to_meet,id_proof,badge_no,remarks,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [appId, text(b.visitorName||b.visitor_name), text(b.phone), text(b.purpose), text(b.toMeet||b.to_meet), text(b.idProof||b.id_proof), text(b.badgeNo||b.badge_no), text(b.remarks), req.user?.UserId]);
  await writeAudit(pool, appId, req.user, { action: 'visitor.checkin', entity: 'school_visitors', entityId: row.id });
  res.json({ ok: true, visitor: row });
}));

schoolRouter.post('/visitors/:id/checkout', route(async (req, res) => {
  if (!guard(req, res, 'frontoffice.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [row] = await execQ(pool, `UPDATE school_visitors SET out_time=now() WHERE app_id=$1 AND id=$2 RETURNING *`, [appId, id]);
  await writeAudit(pool, appId, req.user, { action: 'visitor.checkout', entity: 'school_visitors', entityId: id });
  res.json({ ok: true, visitor: row });
}));

schoolRouter.get('/gate-passes', route(async (req, res) => {
  if (!guard(req, res, 'frontoffice.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const rows = await execQ(pool, `SELECT gp.*, s.first_name, s.last_name, s.admission_no FROM school_gate_passes gp LEFT JOIN school_students s ON s.id=gp.student_id WHERE gp.app_id=$1 ORDER BY gp.out_time DESC`, [appId]);
  res.json({ ok: true, gatePasses: rows });
}));

schoolRouter.post('/gate-passes', route(async (req, res) => {
  if (!guard(req, res, 'frontoffice.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  const [row] = await execQ(pool, `INSERT INTO school_gate_passes (app_id,student_id,issued_by,reason,picked_by,remarks,status) VALUES ($1,$2,$3,$4,$5,$6,'out') RETURNING *`, [appId, num(b.studentId||b.student_id), req.user?.UserId, text(b.reason), text(b.pickedBy||b.picked_by), text(b.remarks)]);
  await writeAudit(pool, appId, req.user, { action: 'gatepass.issue', entity: 'school_gate_passes', entityId: row.id });
  res.json({ ok: true, gatePass: row });
}));

schoolRouter.post('/gate-passes/:id/return', route(async (req, res) => {
  if (!guard(req, res, 'frontoffice.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [row] = await execQ(pool, `UPDATE school_gate_passes SET status='returned', return_time=now() WHERE app_id=$1 AND id=$2 RETURNING *`, [appId, id]);
  await writeAudit(pool, appId, req.user, { action: 'gatepass.return', entity: 'school_gate_passes', entityId: id });
  res.json({ ok: true, gatePass: row });
}));

/* ---------- health, discipline ---------- */
schoolRouter.get('/health', route(async (req, res) => {
  if (!guard(req, res, 'health.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const rows = await execQ(pool, `SELECT h.*, s.first_name, s.last_name, s.admission_no FROM school_health_records h LEFT JOIN school_students s ON s.id=h.student_id WHERE h.app_id=$1 ORDER BY h.visit_date DESC`, [appId]);
  res.json({ ok: true, healthRecords: rows });
}));

schoolRouter.post('/health', route(async (req, res) => {
  if (!guard(req, res, 'health.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  const [row] = await execQ(pool, `INSERT INTO school_health_records (app_id,student_id,visit_date,symptoms,treatment,medicines,referred_to,attended_by,remarks,notify_parent) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [appId, num(b.studentId||b.student_id), day(b.visitDate||b.visit_date)||new Date().toISOString().slice(0,10), text(b.symptoms), text(b.treatment), text(b.medicines), text(b.referredTo||b.referred_to), req.user?.UserId, text(b.remarks), !!b.notifyParent]);
  await writeAudit(pool, appId, req.user, { action: 'health.visit', entity: 'school_health_records', entityId: row.id });
  res.json({ ok: true, healthRecord: row });
}));

schoolRouter.get('/discipline', route(async (req, res) => {
  if (!guard(req, res, 'discipline.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const rows = await execQ(pool, `SELECT d.*, s.first_name, s.last_name, s.admission_no FROM school_discipline d LEFT JOIN school_students s ON s.id=d.student_id WHERE d.app_id=$1 ORDER BY d.incident_date DESC`, [appId]);
  res.json({ ok: true, discipline: rows });
}));

schoolRouter.post('/discipline', route(async (req, res) => {
  if (!guard(req, res, 'discipline.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  const [row] = await execQ(pool, `INSERT INTO school_discipline (app_id,student_id,incident_date,category,description,action_taken,reported_by,status,remarks) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [appId, num(b.studentId||b.student_id), day(b.incidentDate||b.incident_date)||new Date().toISOString().slice(0,10), text(b.category), text(b.description), text(b.actionTaken||b.action_taken), req.user?.UserId, text(b.status)||'open', text(b.remarks)]);
  await writeAudit(pool, appId, req.user, { action: 'discipline.create', entity: 'school_discipline', entityId: row.id });
  res.json({ ok: true, discipline: row });
}));

/* ---------- leaves ---------- */
schoolRouter.get('/leaves', route(async (req, res) => {
  if (!guard(req, res, 'leaves.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const rows = await execQ(pool, `SELECT * FROM school_leaves WHERE app_id=$1 ORDER BY id DESC`, [appId]);
  res.json({ ok: true, leaves: rows });
}));

schoolRouter.post('/leaves', route(async (req, res) => {
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  const [row] = await execQ(pool, `INSERT INTO school_leaves (app_id,applicant_type,applicant_id,student_id,from_date,to_date,reason,status) VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING *`, [appId, text(b.applicantType||b.applicant_type)||'staff', text(b.applicantId||b.applicant_id), num(b.studentId||b.student_id), day(b.fromDate||b.from_date), day(b.toDate||b.to_date), text(b.reason)]);
  await writeAudit(pool, appId, req.user, { action: 'leave.apply', entity: 'school_leaves', entityId: row.id });
  res.json({ ok: true, leave: row });
}));

schoolRouter.post('/leaves/:id/approve', route(async (req, res) => {
  if (!guard(req, res, 'leaves.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const [row] = await execQ(pool, `UPDATE school_leaves SET status='approved', approved_by=$3, approved_at=now() WHERE app_id=$1 AND id=$2 RETURNING *`, [appId, id, req.user?.UserId]);
  await writeAudit(pool, appId, req.user, { action: 'leave.approve', entity: 'school_leaves', entityId: id });
  res.json({ ok: true, leave: row });
}));

schoolRouter.post('/leaves/:id/reject', route(async (req, res) => {
  if (!guard(req, res, 'leaves.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};
  const [row] = await execQ(pool, `UPDATE school_leaves SET status='rejected', approved_by=$3, approved_at=now(), remarks=$4 WHERE app_id=$1 AND id=$2 RETURNING *`, [appId, id, req.user?.UserId, text(b.remarks)]);
  await writeAudit(pool, appId, req.user, { action: 'leave.reject', entity: 'school_leaves', entityId: id });
  res.json({ ok: true, leave: row });
}));

/* ---------- promotions & TC with no-dues ---------- */
schoolRouter.get('/promotions/candidates', route(async (req, res) => {
  if (!guard(req, res, 'students.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const classId = num(req.query.classId||req.query.class_id);
  const ayId = num(req.query.academicYearId||req.query.academic_year_id);
  let q = `SELECT st.*, e.class_id, e.section_id FROM school_students st LEFT JOIN school_student_enrollments e ON e.student_id=st.id AND e.status='active' WHERE st.app_id=$1 AND st.status='active'`;
  const params = [appId];
  if (classId) { params.push(classId); q += ` AND e.class_id=$${params.length}`; }
  if (ayId) { params.push(ayId); q += ` AND e.academic_year_id=$${params.length}`; }
  const rows = await execQ(pool, q, params);
  res.json({ ok: true, candidates: rows });
}));

schoolRouter.post('/promotions/bulk', route(async (req, res) => {
  if (!guard(req, res, 'students.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  const fromAy = num(b.fromAcademicYearId||b.from_academic_year_id);
  const toAy = num(b.toAcademicYearId||b.to_academic_year_id);
  const toClass = num(b.toClassId||b.to_class_id);
  const toSection = num(b.toSectionId||b.to_section_id);
  const items = Array.isArray(b.items) ? b.items : [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let done = 0;
    for (const it of items) {
      const sid = num(it.studentId||it.student_id);
      if (!sid) continue;
      await client.query(`INSERT INTO school_promotions (app_id,from_academic_year_id,to_academic_year_id,student_id,from_class_id,to_class_id,from_section_id,to_section_id,status,promoted_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'promoted',$9)`, [appId, fromAy, toAy, sid, num(it.fromClassId||it.from_class_id), toClass, num(it.fromSectionId||it.from_section_id), toSection, req.user?.UserId]);
      if (toAy && toClass) {
        await client.query(`INSERT INTO school_student_enrollments (app_id,student_id,academic_year_id,class_id,section_id,status) VALUES ($1,$2,$3,$4,$5,'active') ON CONFLICT DO NOTHING`, [appId, sid, toAy, toClass, toSection]);
      }
      done++;
    }
    await client.query('COMMIT');
    await writeAudit(pool, appId, req.user, { action: 'promotion.bulk', entity: 'school_promotions', meta: { count: done, toClass } });
    res.json({ ok: true, promoted: done });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
}));

schoolRouter.post('/tc/request', route(async (req, res) => {
  if (!guard(req, res, 'students.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const b = req.body || {};
  const sid = num(b.studentId||b.student_id);
  if (!sid) return res.status(400).json({ error: 'studentId required' });

  // no-dues checks
  const fees = (await execQ(pool, `SELECT COALESCE(SUM(amount_due - amount_paid),0) bal FROM school_fee_invoices WHERE app_id=$1 AND student_id=$2 AND status!='paid'`, [appId, sid]))[0];
  const bal = Number(fees?.bal||0);
  if (bal > 0) return res.status(400).json({ error: `Fee dues pending: ${bal.toFixed(2)}` });

  const tcNo = text(b.tcNo||b.tc_no)||(`TC-${Date.now()}`);
  const [row] = await execQ(pool, `INSERT INTO school_transfer_certificates (app_id,tc_no,student_id,issue_date,reason,issued_by,no_dues_checked,status) VALUES ($1,$2,$3,current_date,$4,$5,true,'issued') RETURNING *`, [appId, tcNo, sid, text(b.reason), req.user?.UserId]);
  await execQ(pool, `UPDATE school_students SET status='transferred' WHERE app_id=$1 AND id=$2`, [appId, sid]);
  await writeAudit(pool, appId, req.user, { action: 'tc.issue', entity: 'school_transfer_certificates', entityId: row.id, meta: { studentId: sid } });
  res.json({ ok: true, tc: row });
}));

/* ---------- quick stats for dashboard ---------- */
schoolRouter.get('/stats/overview', route(async (req, res) => {
  if (!guard(req, res, 'dashboard.view')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const students = (await execQ(pool, `SELECT COUNT(*) c FROM school_students WHERE app_id=$1 AND status='active' AND deleted_at IS NULL`, [appId]))[0]?.c||0;
  const enquiries = (await execQ(pool, `SELECT COUNT(*) c FROM school_enquiries WHERE app_id=$1 AND status='enquiry'`, [appId]))[0]?.c||0;
  const apps = (await execQ(pool, `SELECT COUNT(*) c FROM school_applications WHERE app_id=$1 AND status IN ('applied','offer_sent')`, [appId]))[0]?.c||0;
  const leaves = (await execQ(pool, `SELECT COUNT(*) c FROM school_leaves WHERE app_id=$1 AND status='pending'`, [appId]))[0]?.c||0;
  const visitors = (await execQ(pool, `SELECT COUNT(*) c FROM school_visitors WHERE app_id=$1 AND out_time IS NULL`, [appId]))[0]?.c||0;
  res.json({ ok: true, stats: { students, enquiries, applications: apps, pendingLeaves: leaves, activeVisitors: visitors } });
}));
