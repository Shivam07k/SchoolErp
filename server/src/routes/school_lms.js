/* ============================================================
   LMS — backend routes
   Mounted at /api/school before the legacy comprehensive router.
   ============================================================ */
import express from 'express';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { ensureFoundation, loadAccess, writeAudit } from '../school/foundation.js';

const lmsRouter = express.Router();

lmsRouter.use(verifyToken);
lmsRouter.use(async (req, _res, next) => {
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
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('lms.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}
function guardView(req, res, perm = 'lms.view') {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('lms.view') || perms.includes('lms.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

const courseSelect = `SELECT c.*, c.name AS title,
  s.name AS subject_name, cl.name AS class_name, sec.name AS section_name,
  (SELECT string_agg(st.name, ', ' ORDER BY st.name)
     FROM school_lms_course_teacher ct
     JOIN school_staff st ON st.id = ct.staff_id
    WHERE ct.course_id = c.id AND ct.removed_at IS NULL) AS teacher_name,
  (SELECT json_agg(json_build_object('id', ct.staff_id, 'name', st.name))
     FROM school_lms_course_teacher ct
     LEFT JOIN school_staff st ON st.id = ct.staff_id
    WHERE ct.course_id = c.id AND ct.removed_at IS NULL) AS teachers
FROM school_lms_course c
LEFT JOIN school_subjects s ON s.id = c.subject_id
LEFT JOIN school_classes cl ON cl.id = c.class_id
LEFT JOIN school_sections sec ON sec.id = c.section_id`;

async function assignTeacher(appId, courseId, staffId) {
  if (!staffId) {
    await execQ(getPool(), `UPDATE school_lms_course_teacher SET removed_at=now()
      WHERE app_id=$1 AND course_id=$2 AND role='primary' AND removed_at IS NULL`, [appId, courseId]);
    return;
  }
  await execQ(getPool(), `INSERT INTO school_lms_course_teacher (app_id, course_id, staff_id, role)
    VALUES ($1,$2,$3,'primary')
    ON CONFLICT (course_id, staff_id, role) DO UPDATE SET removed_at=NULL`, [appId, courseId, staffId]);
}

// Courses
lmsRouter.get('/lms/courses', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `${courseSelect}
    WHERE c.app_id=$1 AND c.deleted_at IS NULL ORDER BY c.created_at DESC`, [appIdOf(req)]);
  res.json({ ok: true, courses: rows });
}));

lmsRouter.post('/lms/courses', route(async (req, res) => {
  if (!guard(req, res, 'lms.courses')) return;
  const b = req.body || {};
  if (!text(b.title) || !num(b.subjectId)) fail(400, 'Title and subject required');
  const appId = appIdOf(req);
  const code = text(b.code) || `CRS-${Date.now()}`;
  const rows = await execQ(getPool(), `
    INSERT INTO school_lms_course (app_id, code, name, description, subject_id, class_id, section_id, status, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
  `, [appId, code, text(b.title), text(b.description), num(b.subjectId), num(b.classId), num(b.sectionId), text(b.status) || 'draft', userOf(req)]);
  await assignTeacher(appId, rows[0].id, num(b.teacherId));
  await writeAudit(getPool(), req, { action: 'lms.course.create', entity: 'school_lms_course', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, course: { ...rows[0], title: rows[0].name } });
}));

lmsRouter.put('/lms/courses/:id', route(async (req, res) => {
  if (!guard(req, res, 'lms.courses')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  const appId = appIdOf(req);
  const rows = await execQ(getPool(), `
    UPDATE school_lms_course SET
      name=coalesce($3,name), description=coalesce($4,description), subject_id=coalesce($5,subject_id),
      class_id=coalesce($6,class_id), section_id=coalesce($7,section_id), status=coalesce($8,status), updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appId, id, text(b.title), text(b.description), num(b.subjectId), num(b.classId), num(b.sectionId), text(b.status)]);
  if (!rows[0]) fail(404, 'Course not found');
  if (b.teacherId !== undefined) await assignTeacher(appId, id, num(b.teacherId));
  await writeAudit(getPool(), req, { action: 'lms.course.update', entity: 'school_lms_course', entityId: id, after: rows[0] });
  res.json({ ok: true, course: { ...rows[0], title: rows[0].name } });
}));

lmsRouter.delete('/lms/courses/:id', route(async (req, res) => {
  if (!guard(req, res, 'lms.courses')) return;
  const id = num(req.params.id);
  const rows = await execQ(getPool(), 'UPDATE school_lms_course SET deleted_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id', [appIdOf(req), id]);
  if (!rows[0]) fail(404, 'Course not found');
  await writeAudit(getPool(), req, { action: 'lms.course.delete', entity: 'school_lms_course', entityId: id });
  res.json({ ok: true });
}));

// Chapters
lmsRouter.get('/lms/courses/:courseId/chapters', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `SELECT * FROM school_lms_course_chapter WHERE app_id=$1 AND course_id=$2 AND deleted_at IS NULL ORDER BY sequence`, [appIdOf(req), num(req.params.courseId)]);
  res.json({ ok: true, chapters: rows });
}));

lmsRouter.post('/lms/courses/:courseId/chapters', route(async (req, res) => {
  if (!guard(req, res, 'lms.courses')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), `INSERT INTO school_lms_course_chapter (app_id, course_id, title, description, sequence, estimated_hours, status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [appIdOf(req), num(req.params.courseId), text(b.title), text(b.description), num(b.sequence) || 0, num(b.estimatedHours), text(b.status) || 'draft']);
  res.json({ ok: true, chapter: rows[0] });
}));

// Topics
lmsRouter.get('/lms/chapters/:chapterId/topics', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `SELECT * FROM school_lms_course_topic WHERE app_id=$1 AND chapter_id=$2 AND deleted_at IS NULL ORDER BY sequence`, [appIdOf(req), num(req.params.chapterId)]);
  res.json({ ok: true, topics: rows });
}));

lmsRouter.post('/lms/chapters/:chapterId/topics', route(async (req, res) => {
  if (!guard(req, res, 'lms.courses')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), `INSERT INTO school_lms_course_topic (app_id, chapter_id, title, description, duration_minutes, learning_objectives, sequence, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [appIdOf(req), num(req.params.chapterId), text(b.title), text(b.description) || text(b.content), num(b.durationMinutes), text(b.learningObjectives), num(b.sequence) || 0, text(b.status) || 'published']);
  res.json({ ok: true, topic: rows[0] });
}));

// Assignments
lmsRouter.get('/lms/assignments', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const courseId = num(req.query.courseId);
  const rows = await execQ(getPool(), `SELECT a.*, c.name AS course_title,
      a.due_at AS due_date,
      ('file' = ANY(a.submission_types)) AS allow_file_submit,
      ('text' = ANY(a.submission_types)) AS allow_text_submit
    FROM school_lms_assignment a
    LEFT JOIN school_lms_course c ON c.id=a.course_id
    WHERE a.app_id=$1 AND a.deleted_at IS NULL ${courseId ? 'AND a.course_id=$2' : ''}
    ORDER BY a.due_at`, [appIdOf(req), courseId].filter(Boolean));
  res.json({ ok: true, assignments: rows });
}));

function submissionTypes(b, existing) {
  if (b.allowFileSubmit === undefined && b.allowTextSubmit === undefined) return existing || ['text', 'file'];
  const types = [];
  if (b.allowTextSubmit !== false) types.push('text');
  if (b.allowFileSubmit !== false) types.push('file');
  return types.length ? types : ['text'];
}

lmsRouter.post('/lms/assignments', route(async (req, res) => {
  if (!guard(req, res, 'lms.assignments')) return;
  const b = req.body || {};
  if (!num(b.courseId) || !text(b.title)) fail(400, 'Course and title required');
  const due = tsOf(b.dueDate) || new Date(Date.now() + 7 * 86400000).toISOString();
  const rows = await execQ(getPool(), `
    INSERT INTO school_lms_assignment (app_id, course_id, title, description, max_marks, due_at, submission_types, late_penalty_pct, status, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'published',$9) RETURNING *
  `, [appIdOf(req), num(b.courseId), text(b.title), text(b.description), num(b.maxMarks) || 100, due, submissionTypes(b), num(b.latePenaltyPercent) || 0, userOf(req)]);
  res.json({ ok: true, assignment: rows[0] });
}));

lmsRouter.put('/lms/assignments/:id', route(async (req, res) => {
  if (!guard(req, res, 'lms.assignments')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  const before = (await execQ(getPool(), 'SELECT * FROM school_lms_assignment WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appIdOf(req), id]))[0];
  if (!before) fail(404, 'Assignment not found');
  const rows = await execQ(getPool(), `
    UPDATE school_lms_assignment SET
      course_id=coalesce($3,course_id), title=coalesce($4,title), description=coalesce($5,description),
      max_marks=coalesce($6,max_marks), due_at=coalesce($7,due_at), submission_types=$8,
      late_penalty_pct=coalesce($9,late_penalty_pct), status=coalesce($10,status), updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), id, num(b.courseId), text(b.title), text(b.description), num(b.maxMarks), tsOf(b.dueDate), submissionTypes(b, before.submission_types), num(b.latePenaltyPercent), text(b.status)]);
  res.json({ ok: true, assignment: rows[0] });
}));

lmsRouter.delete('/lms/assignments/:id', route(async (req, res) => {
  if (!guard(req, res, 'lms.assignments')) return;
  const id = num(req.params.id);
  const rows = await execQ(getPool(), 'UPDATE school_lms_assignment SET deleted_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id', [appIdOf(req), id]);
  if (!rows[0]) fail(404, 'Assignment not found');
  res.json({ ok: true });
}));

// Submissions
lmsRouter.post('/lms/assignments/:id/submit', route(async (req, res) => {
  if (!guard(req, res, 'lms.assignments')) return;
  const b = req.body || {};
  const assignmentId = num(req.params.id);
  const studentId = num(b.studentId) || (await execQ(getPool(), `
    SELECT s.id FROM school_students s
    JOIN school_users u ON u.app_id=s.app_id
     AND (u.id::text=s.user_id::text OR (s.user_id::text !~ '^[0-9]+$' AND u.user_id=s.user_id::text))
    WHERE s.app_id=$1 AND u.user_id=$2 AND s.deleted_at IS NULL
  `, [appIdOf(req), userOf(req)]))?.[0]?.id;
  if (!studentId) fail(400, 'Student not found');
  const rows = await execQ(getPool(), `
    INSERT INTO school_lms_assignment_submission (app_id, assignment_id, student_id, content_text, status, submitted_at)
    VALUES ($1,$2,$3,$4,'submitted',now()) RETURNING *
  `, [appIdOf(req), assignmentId, studentId, text(b.text)]);
  res.json({ ok: true, submission: rows[0] });
}));

// Evaluations
lmsRouter.post('/lms/submissions/:id/evaluate', route(async (req, res) => {
  if (!guard(req, res, 'lms.assignments')) return;
  const b = req.body || {};
  const submissionId = num(req.params.id);
  const rows = await execQ(getPool(), `
    INSERT INTO school_lms_assignment_evaluation (app_id, submission_id, marks_obtained, feedback, evaluated_by, status)
    VALUES ($1,$2,$3,$4,$5,'published')
    ON CONFLICT (submission_id) DO UPDATE SET marks_obtained=$3, feedback=$4, evaluated_by=$5, evaluated_at=now()
    RETURNING *
  `, [appIdOf(req), submissionId, num(b.marks) || 0, text(b.feedback), userOf(req)]);
  await execQ(getPool(), 'UPDATE school_lms_assignment_submission SET status=$3, graded_at=now(), graded_by=$4 WHERE app_id=$1 AND id=$2', [appIdOf(req), submissionId, 'graded', userOf(req)]);
  res.json({ ok: true, evaluation: rows[0] });
}));

// Quizzes
lmsRouter.get('/lms/quizzes', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const courseId = num(req.query.courseId);
  const rows = await execQ(getPool(), `SELECT q.*, c.name AS course_title,
      q.time_limit_minutes AS duration_minutes,
      q.release_at AS start_time,
      q.due_at AS end_time
    FROM school_lms_quiz q
    LEFT JOIN school_lms_course c ON c.id=q.course_id
    WHERE q.app_id=$1 AND q.deleted_at IS NULL ${courseId ? 'AND q.course_id=$2' : ''}
    ORDER BY q.created_at DESC`, [appIdOf(req), courseId].filter(Boolean));
  res.json({ ok: true, quizzes: rows });
}));

lmsRouter.post('/lms/quizzes', route(async (req, res) => {
  if (!guard(req, res, 'lms.quizzes')) return;
  const b = req.body || {};
  if (!num(b.courseId) || !text(b.title)) fail(400, 'Course and title required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_lms_quiz (app_id, course_id, title, description, type, time_limit_minutes, max_attempts,
      shuffle_questions, shuffle_options, release_at, due_at, passing_score_pct, status, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *
  `, [appIdOf(req), num(b.courseId), text(b.title), text(b.description), text(b.type) || 'formative',
    num(b.durationMinutes) || 30, num(b.maxAttempts) || 1, bool(b.shuffleQuestions), bool(b.shuffleOptions),
    tsOf(b.startTime) || new Date().toISOString(), tsOf(b.endTime), num(b.passingScore) || 0,
    text(b.status) || 'draft', userOf(req)]);
  res.json({ ok: true, quiz: rows[0] });
}));

lmsRouter.put('/lms/quizzes/:id', route(async (req, res) => {
  if (!guard(req, res, 'lms.quizzes')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `
    UPDATE school_lms_quiz SET
      course_id=coalesce($3,course_id), title=coalesce($4,title), description=coalesce($5,description),
      type=coalesce($6,type), time_limit_minutes=coalesce($7,time_limit_minutes), max_attempts=coalesce($8,max_attempts),
      shuffle_questions=coalesce($9,shuffle_questions), shuffle_options=coalesce($10,shuffle_options),
      release_at=coalesce($11,release_at), due_at=coalesce($12,due_at), passing_score_pct=coalesce($13,passing_score_pct),
      status=coalesce($14,status), updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), id, num(b.courseId), text(b.title), text(b.description), text(b.type), num(b.durationMinutes),
    num(b.maxAttempts), b.shuffleQuestions === undefined ? null : bool(b.shuffleQuestions),
    b.shuffleOptions === undefined ? null : bool(b.shuffleOptions), tsOf(b.startTime), tsOf(b.endTime),
    num(b.passingScore), text(b.status)]);
  if (!rows[0]) fail(404, 'Quiz not found');
  res.json({ ok: true, quiz: rows[0] });
}));

lmsRouter.delete('/lms/quizzes/:id', route(async (req, res) => {
  if (!guard(req, res, 'lms.quizzes')) return;
  const id = num(req.params.id);
  const rows = await execQ(getPool(), 'UPDATE school_lms_quiz SET deleted_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id', [appIdOf(req), id]);
  if (!rows[0]) fail(404, 'Quiz not found');
  res.json({ ok: true });
}));

// Question Bank
lmsRouter.get('/lms/questions', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const subjectId = num(req.query.subjectId);
  const rows = await execQ(getPool(), `SELECT q.*, s.name as subject_name FROM school_lms_question_bank q LEFT JOIN school_subjects s ON s.id=q.subject_id WHERE q.app_id=$1 AND q.deleted_at IS NULL ${subjectId ? 'AND q.subject_id=$2' : ''} ORDER BY q.created_at DESC`, [appIdOf(req), subjectId].filter(Boolean));
  res.json({ ok: true, questions: rows });
}));

lmsRouter.post('/lms/questions', route(async (req, res) => {
  if (!guard(req, res, 'lms.quizzes')) return;
  const b = req.body || {};
  if (!text(b.stem) && !text(b.questionText)) fail(400, 'Question text required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_lms_question_bank (app_id, subject_id, type, stem, explanation, difficulty, marks, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
  `, [appIdOf(req), num(b.subjectId), text(b.questionType) || 'mcq_single', text(b.stem) || text(b.questionText), text(b.explanation), text(b.difficulty) || 'medium', num(b.marks) || 1, userOf(req)]);
  const questionId = rows[0].id;
  if (b.options && Array.isArray(b.options)) {
    for (const opt of b.options) {
      await execQ(getPool(), `INSERT INTO school_lms_question_option (app_id, question_id, option_text, is_correct, sequence) VALUES ($1,$2,$3,$4,$5)`, [appIdOf(req), questionId, text(opt.text), bool(opt.isCorrect), opt.sequence || 0]);
    }
  }
  res.json({ ok: true, question: { ...rows[0], options: b.options || [] } });
}));

// Study Materials
lmsRouter.get('/lms/materials', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const courseId = num(req.query.courseId);
  const rows = await execQ(getPool(), `SELECT m.*, c.name AS course_title
    FROM school_lms_study_material m
    LEFT JOIN school_lms_course c ON c.id=m.course_id
    WHERE m.app_id=$1 AND m.deleted_at IS NULL ${courseId ? 'AND m.course_id=$2' : ''}
    ORDER BY m.created_at DESC`, [appIdOf(req), courseId].filter(Boolean));
  res.json({ ok: true, materials: rows });
}));

lmsRouter.post('/lms/materials', route(async (req, res) => {
  if (!guard(req, res, 'lms.materials')) return;
  const b = req.body || {};
  if (!num(b.courseId) || !text(b.title)) fail(400, 'Course and title required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_lms_study_material (app_id, course_id, title, description, type, source_url, file_url, is_published, access_level, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
  `, [appIdOf(req), num(b.courseId), text(b.title), text(b.description), text(b.materialType) || text(b.type) || 'document',
    text(b.sourceUrl), text(b.fileUrl), bool(b.isPublished, true), text(b.accessLevel) || 'enrolled', userOf(req)]);
  res.json({ ok: true, material: rows[0] });
}));

lmsRouter.put('/lms/materials/:id', route(async (req, res) => {
  if (!guard(req, res, 'lms.materials')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `
    UPDATE school_lms_study_material SET
      course_id=coalesce($3,course_id), title=coalesce($4,title), description=coalesce($5,description),
      type=coalesce($6,type), source_url=coalesce($7,source_url), file_url=coalesce($8,file_url),
      is_published=coalesce($9,is_published), access_level=coalesce($10,access_level), updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), id, num(b.courseId), text(b.title), text(b.description),
    text(b.materialType) || text(b.type), text(b.sourceUrl), text(b.fileUrl),
    b.isPublished === undefined ? null : bool(b.isPublished), text(b.accessLevel)]);
  if (!rows[0]) fail(404, 'Material not found');
  res.json({ ok: true, material: rows[0] });
}));

lmsRouter.delete('/lms/materials/:id', route(async (req, res) => {
  if (!guard(req, res, 'lms.materials')) return;
  const id = num(req.params.id);
  const rows = await execQ(getPool(), 'UPDATE school_lms_study_material SET deleted_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id', [appIdOf(req), id]);
  if (!rows[0]) fail(404, 'Material not found');
  res.json({ ok: true });
}));

// Progress (derived from course enrollments + assignment/quiz activity)
lmsRouter.get('/lms/progress', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const appId = appIdOf(req);
  const studentId = num(req.query.studentId) || (await execQ(getPool(), `
    SELECT s.id FROM school_students s
    JOIN school_users u ON u.app_id=s.app_id
     AND (u.id::text=s.user_id::text OR (s.user_id::text !~ '^[0-9]+$' AND u.user_id=s.user_id::text))
    WHERE s.app_id=$1 AND u.user_id=$2 AND s.deleted_at IS NULL
  `, [appId, userOf(req)]))?.[0]?.id;
  const courseId = num(req.query.courseId);
  const filters = [];
  const params = [appId];
  if (studentId) { params.push(studentId); filters.push(`e.student_id=$${params.length}`); }
  if (courseId) { params.push(courseId); filters.push(`e.course_id=$${params.length}`); }
  const rows = await execQ(getPool(), `
    SELECT e.id, e.student_id, e.course_id, e.status AS enrollment_status,
      e.progress_pct AS completion_percent, e.updated_at,
      c.name AS course_title,
      s.first_name, s.last_name, s.admission_no,
      (SELECT count(*)::int FROM school_lms_assignment a
        WHERE a.app_id=e.app_id AND a.course_id=e.course_id AND a.deleted_at IS NULL) AS assignments_total,
      (SELECT count(*)::int FROM school_lms_assignment_submission sub
        JOIN school_lms_assignment a ON a.id=sub.assignment_id
        WHERE a.app_id=e.app_id AND a.course_id=e.course_id AND sub.student_id=e.student_id
          AND sub.status IN ('submitted','late','resubmitted','graded')) AS assignments_completed,
      (SELECT count(*)::int FROM school_lms_quiz q
        WHERE q.app_id=e.app_id AND q.course_id=e.course_id AND q.deleted_at IS NULL) AS quizzes_total,
      (SELECT count(*)::int FROM school_lms_quiz_attempt at
        JOIN school_lms_quiz q ON q.id=at.quiz_id
        WHERE q.app_id=e.app_id AND q.course_id=e.course_id AND at.student_id=e.student_id
          AND at.status IN ('submitted','graded')) AS quizzes_completed
    FROM school_lms_course_enrollment e
    LEFT JOIN school_lms_course c ON c.id=e.course_id
    LEFT JOIN school_students s ON s.id=e.student_id
    WHERE e.app_id=$1 AND e.deleted_at IS NULL ${filters.length ? 'AND ' + filters.join(' AND ') : ''}
    ORDER BY e.updated_at DESC
  `, params);
  res.json({ ok: true, progress: rows });
}));

export { lmsRouter };
