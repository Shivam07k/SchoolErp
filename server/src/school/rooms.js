import { execQ } from '../db/sp.js';

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const text = (v) => (v === null || v === undefined ? '' : String(v).trim());

/* A room booking is identified by room + day/date + period/time interval.
   This helper is shared by the room API, timetable and exam timetable so all
   three enforce the same conflict rule. */

function timeClause(prefix, params, startTime, endTime) {
  const start = text(startTime);
  const end = text(endTime);
  if (!start || !end) return '';
  params.push(start, end);
  return ` AND ${prefix}start_time IS NOT NULL AND ${prefix}end_time IS NOT NULL
           AND ${prefix}start_time < $${params.length} AND ${prefix}end_time > $${params.length - 1}`;
}

export async function findRoomConflicts(pool, appId, booking = {}) {
  const roomId = num(booking.roomId);
  if (!roomId) return [];
  const conflicts = [];

  const versionId = num(booking.versionId);

  const dayOfWeek = num(booking.dayOfWeek);
  if (dayOfWeek !== null) {
    const params = [appId, roomId, dayOfWeek];
    let q = `SELECT t.id, 'timetable' AS source, t.class_id, t.section_id, t.subject_id,
                    t.period_no, t.period_id, t.start_time, t.end_time, t.day_of_week
               FROM school_timetables t
              WHERE t.app_id=$1 AND t.room_id=$2 AND t.day_of_week=$3`;
    if (versionId) {
      params.push(versionId);
      q += ` AND t.version_id=$${params.length}`;
    }
    const excludeTimetableId = num(booking.excludeTimetableId);
    if (excludeTimetableId) {
      params.push(excludeTimetableId);
      q += ` AND t.id <> $${params.length}`;
    }
    // Always check time-range overlaps for accurate conflict detection
    q += timeClause('t.', params, booking.startTime, booking.endTime);
    conflicts.push(...await execQ(pool, q + ' ORDER BY t.id', params));
  }

  const examDate = text(booking.examDate);
  if (examDate) {
    const params = [appId, roomId, examDate];
    let q = `SELECT e.id, 'exam' AS source, e.schedule_id, e.subject_id,
                    e.exam_date, e.start_time, e.end_time
               FROM school_exam_timetable e
              WHERE e.app_id=$1 AND e.room_id=$2 AND e.exam_date=$3`;
    const excludeExamId = num(booking.excludeExamId);
    if (excludeExamId) {
      params.push(excludeExamId);
      q += ` AND e.id <> $${params.length}`;
    }
    q += timeClause('e.', params, booking.startTime, booking.endTime);
    conflicts.push(...await execQ(pool, q + ' ORDER BY e.id', params));
  }

  return conflicts;
}

export async function roomRow(pool, appId, roomId) {
  const [room] = await execQ(pool,
    'SELECT * FROM school_rooms WHERE app_id=$1 AND id=$2', [appId, num(roomId)]);
  return room || null;
}

/* Student strength for the exact section when available, otherwise the class. */
export async function groupStrength(pool, appId, classId, sectionId) {
  const params = [appId];
  let where = `app_id=$1 AND status='active' AND deleted_at IS NULL`;
  if (num(sectionId)) {
    params.push(num(sectionId));
    where += ` AND section_id=$${params.length}`;
  } else if (num(classId)) {
    params.push(num(classId));
    where += ` AND class_id=$${params.length}`;
  } else {
    return 0;
  }
  const [row] = await execQ(pool, `SELECT count(*)::int AS n FROM school_students WHERE ${where}`, params);
  return row?.n || 0;
}

export function roomConflictError(conflicts) {
  if (!conflicts.length) return null;
  const first = conflicts[0];
  return first.source === 'exam'
    ? `Room is already booked for an exam on ${String(first.exam_date).slice(0, 10)}`
    : `Room is already booked on day ${first.day_of_week}${first.period_no ? `, period ${first.period_no}` : ''}`;
}