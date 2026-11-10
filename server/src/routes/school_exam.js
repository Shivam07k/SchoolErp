/* M15 Examinations â€” Backend Routes */
import express from 'express';
import { randomUUID } from 'crypto';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';

const examRouter = express.Router();

/* ---- Helpers ---- */

function num(v) { return v === undefined || v === null || v === '' ? null : Number(v); }
function text(v) { return v === undefined || v === null ? null : String(v).trim(); }
function dayOf(v) { return v ? String(v).slice(0, 10) : null; }
function appIdOf(req) { return req.school?.appId || 'default'; }
function guard(req, res, perm) {
  if (!req.school || !req.user) return res.status(401).json({ error: 'Unauthorized' });
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm)) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

async function writeAudit(req, action, entity, entityId, before, after) {
  try {
    await execQ(getPool(), `
      INSERT INTO school_audit_log (app_id, user_id, action, entity, entity_id, before_json, after_json, ip)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, [
      appIdOf(req), text(req.user?.userid), action, entity, entityId === null || entityId === undefined ? null : String(entityId),
      before === undefined ? null : JSON.stringify(before), after === undefined ? null : JSON.stringify(after),
      text(req.ip || req.headers?.['x-forwarded-for']),
    ]);
  } catch {
    /* audit must never break the business action */
  }
}

const VALID_STATUS_CODES = new Set(['AB', 'EX', 'ML', 'UFM', 'WH']);

/* ============================================================
   1. TERMS
   ============================================================ */

examRouter.get('/terms', async (req, res) => {
  if (!guard(req, res, 'exam.setup')) return;
  const rows = await execQ(getPool(), `
    SELECT * FROM school_term
    WHERE app_id=$1 AND deleted_at IS NULL
    ORDER BY academic_year_id, start_date
  `, [appIdOf(req)]);
  res.json({ ok: true, terms: rows });
});

examRouter.post('/terms', async (req, res) => {
  if (!guard(req, res, 'exam.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    INSERT INTO school_term (app_id, academic_year_id, name, start_date, end_date, weightage)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
  `, [appIdOf(req), num(b.academicYearId), text(b.name), dayOf(b.startDate), dayOf(b.endDate), num(b.weightage)]);
  res.json({ ok: true, term: row[0] });
});

examRouter.put('/terms/:id', async (req, res) => {
  if (!guard(req, res, 'exam.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    UPDATE school_term SET
      name=$3, start_date=$4, end_date=$5, weightage=$6, is_active=$7, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), text(b.name), dayOf(b.startDate), dayOf(b.endDate), num(b.weightage), b.isActive !== false]);
  res.json({ ok: true, term: row[0] });
});

/* ============================================================
   2. EXAMS
   ============================================================ */

examRouter.get('/exams', async (req, res) => {
  if (!guard(req, res, 'exam.setup')) return;
  const termId = num(req.query.termId);
  const status = text(req.query.status);
  const where = ['e.app_id=$1', 'e.deleted_at IS NULL'];
  const vals = [appIdOf(req)];
  if (termId) { vals.push(termId); where.push(`e.term_id=$${vals.length}`); }
  if (status) { vals.push(status); where.push(`e.status=$${vals.length}`); }
  const rows = await execQ(getPool(), `
    SELECT e.*, t.name AS term_name
    FROM school_exam e
    LEFT JOIN school_term t ON t.id=e.term_id
    WHERE ${where.join(' AND ')}
    ORDER BY e.start_date NULLS LAST, e.name
  `, vals);
  res.json({ ok: true, exams: rows });
});

examRouter.post('/exams', async (req, res) => {
  if (!guard(req, res, 'exam.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    INSERT INTO school_exam (app_id, term_id, name, type, weightage, start_date, end_date, status, best_of_n, best_of_m, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
  `, [appIdOf(req), num(b.termId), text(b.name), text(b.type), num(b.weightage), dayOf(b.startDate), dayOf(b.endDate), text(b.status)||'draft', num(b.bestOfN), num(b.bestOfM), text(req.user.userid)]);
  res.json({ ok: true, exam: row[0] });
});

examRouter.put('/exams/:id', async (req, res) => {
  if (!guard(req, res, 'exam.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    UPDATE school_exam SET
      term_id=$3, name=$4, type=$5, weightage=$6, start_date=$7, end_date=$8, status=$9, best_of_n=$10, best_of_m=$11, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), num(b.termId), text(b.name), text(b.type), num(b.weightage), dayOf(b.startDate), dayOf(b.endDate), text(b.status), num(b.bestOfN), num(b.bestOfM)]);
  res.json({ ok: true, exam: row[0] });
});

examRouter.get('/exams/:id', async (req, res) => {
  if (!guard(req, res, 'exam.view')) return;
  const [exam] = await execQ(getPool(), `SELECT * FROM school_exam WHERE app_id=$1 AND id=$2`, [appIdOf(req), num(req.params.id)]);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });
  const papers = await execQ(getPool(), `
    SELECT p.*, c.name AS class_name, s.name AS subject_name
    FROM school_exam_paper p
    LEFT JOIN school_classes c ON c.id=p.class_id
    LEFT JOIN school_subjects s ON s.id=p.subject_id
    WHERE p.app_id=$1 AND p.exam_id=$2 AND p.deleted_at IS NULL
    ORDER BY c.sort_order NULLS LAST, c.name, s.name
  `, [appIdOf(req), exam.id]);
  for (const p of papers) {
    p.components = await execQ(getPool(), `
      SELECT * FROM school_paper_component WHERE app_id=$1 AND paper_id=$2 AND deleted_at IS NULL ORDER BY sort_order
    `, [appIdOf(req), p.id]);
  }
  exam.papers = papers;
  res.json({ ok: true, exam });
});

/* ============================================================
   3. PAPERS
   ============================================================ */

examRouter.get('/papers', async (req, res) => {
  if (!guard(req, res, 'exam.view')) return;
  const examId = num(req.query.examId);
  const classId = num(req.query.classId);
  const where = ['p.app_id=$1', 'p.deleted_at IS NULL'];
  const vals = [appIdOf(req)];
  if (examId) { vals.push(examId); where.push(`p.exam_id=$${vals.length}`); }
  if (classId) { vals.push(classId); where.push(`p.class_id=$${vals.length}`); }
  const rows = await execQ(getPool(), `
    SELECT p.*, c.name AS class_name, s.name AS subject_name, e.name AS exam_name
    FROM school_exam_paper p
    LEFT JOIN school_classes c ON c.id=p.class_id
    LEFT JOIN school_subjects s ON s.id=p.subject_id
    LEFT JOIN school_exam e ON e.id=p.exam_id
    WHERE ${where.join(' AND ')}
    ORDER BY e.start_date NULLS LAST, c.sort_order NULLS LAST, c.name, s.name
  `, vals);
  res.json({ ok: true, papers: rows });
});

examRouter.post('/papers', async (req, res) => {
  if (!guard(req, res, 'exam.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    INSERT INTO school_exam_paper (app_id, exam_id, class_id, subject_id, max_marks, pass_marks, grades_only, counts_in_total, optional_subject)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
  `, [appIdOf(req), num(b.examId), num(b.classId), num(b.subjectId), num(b.maxMarks), num(b.passMarks), b.gradesOnly===true, b.countsInTotal!==false, b.optionalSubject===true]);
  res.json({ ok: true, paper: row[0] });
});

examRouter.put('/papers/:id', async (req, res) => {
  if (!guard(req, res, 'exam.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    UPDATE school_exam_paper SET
      max_marks=$3, pass_marks=$4, grades_only=$5, counts_in_total=$6, optional_subject=$7, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), num(b.maxMarks), num(b.passMarks), b.gradesOnly===true, b.countsInTotal!==false, b.optionalSubject===true]);
  res.json({ ok: true, paper: row[0] });
});

/* Alias routes with /exam/ prefix for frontend compatibility */
examRouter.get('/exam/papers', async (req, res) => {
  if (!guard(req, res, 'exam.view')) return;
  const examId = num(req.query.examId);
  const classId = num(req.query.classId);
  const where = ['p.app_id=$1', 'p.deleted_at IS NULL'];
  const vals = [appIdOf(req)];
  if (examId) { vals.push(examId); where.push(`p.exam_id=$${vals.length}`); }
  if (classId) { vals.push(classId); where.push(`p.class_id=$${vals.length}`); }
  const rows = await execQ(getPool(), `
    SELECT p.*, c.name AS class_name, s.name AS subject_name, e.name AS exam_name
    FROM school_exam_paper p
    LEFT JOIN school_classes c ON c.id=p.class_id
    LEFT JOIN school_subjects s ON s.id=p.subject_id
    LEFT JOIN school_exam e ON e.id=p.exam_id
    WHERE ${where.join(' AND ')}
    ORDER BY e.start_date NULLS LAST, c.sort_order NULLS LAST, c.name, s.name
  `, vals);
  res.json({ ok: true, papers: rows });
});

examRouter.post('/exam/papers', async (req, res) => {
  if (!guard(req, res, 'exam.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    INSERT INTO school_exam_paper (app_id, exam_id, class_id, subject_id, max_marks, pass_marks, grades_only, counts_in_total, optional_subject)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
  `, [appIdOf(req), num(b.examId), num(b.classId), num(b.subjectId), num(b.maxMarks), num(b.passMarks), b.gradesOnly===true, b.countsInTotal!==false, b.optionalSubject===true]);
  res.json({ ok: true, paper: row[0] });
});

examRouter.put('/exam/papers/:id', async (req, res) => {
  if (!guard(req, res, 'exam.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    UPDATE school_exam_paper SET
      max_marks=$3, pass_marks=$4, grades_only=$5, counts_in_total=$6, optional_subject=$7, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), num(b.maxMarks), num(b.passMarks), b.gradesOnly===true, b.countsInTotal!==false, b.optionalSubject===true]);
  res.json({ ok: true, paper: row[0] });
});

examRouter.delete('/exam/papers/:id', async (req, res) => {
  if (!guard(req, res, 'exam.setup')) return;
  await execQ(getPool(), 'UPDATE school_exam_paper SET deleted_at=now() WHERE app_id=$1 AND id=$2', [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true });
});

examRouter.get('/exam/papers/:id/components', async (req, res) => {
  if (!guard(req, res, 'exam.view')) return;
  const rows = await execQ(getPool(), `
    SELECT * FROM school_paper_component WHERE app_id=$1 AND paper_id=$2 AND deleted_at IS NULL ORDER BY sort_order
  `, [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true, components: rows });
});

examRouter.post('/exam/papers/:id/components', async (req, res) => {
  if (!guard(req, res, 'exam.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    INSERT INTO school_paper_component (app_id, paper_id, name, max_marks, pass_minimum, is_mandatory, sort_order)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [appIdOf(req), num(req.params.id), text(b.name), num(b.maxMarks), num(b.passMinimum), b.isMandatory!==false, num(b.sortOrder)||0]);
  res.json({ ok: true, component: row[0] });
});

examRouter.put('/exam/papers/:paperId/components/:cid', async (req, res) => {
  if (!guard(req, res, 'exam.setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    UPDATE school_paper_component SET
      name=$3, max_marks=$4, pass_minimum=$5, is_mandatory=$6, sort_order=$7, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.cid), text(b.name), num(b.maxMarks), num(b.passMinimum), b.isMandatory!==false, num(b.sortOrder)||0]);
  res.json({ ok: true, component: row[0] });
});

/* ============================================================
   4. COMPONENTS
   ============================================================ */

examRouter.get('/student-subjects', async (req, res) => {
  if (!guard(req, res, 'exam.view')) return;
  const classId = num(req.query.classId);
  const yearId = num(req.query.academicYearId);
  const where = ['ss.app_id=$1', 'ss.deleted_at IS NULL'];
  const vals = [appIdOf(req)];
  if (classId) { vals.push(classId); where.push(`s.class_id=$${vals.length}`); }
  if (yearId) { vals.push(yearId); where.push(`ss.academic_year_id=$${vals.length}`); }
  const rows = await execQ(getPool(), `
    SELECT ss.*, s.admission_no, s.first_name, s.last_name, s.class_id, s.section_id, sub.name AS subject_name
    FROM school_student_subject ss
    JOIN school_students s ON s.id=ss.student_id AND s.app_id=ss.app_id
    JOIN school_subjects sub ON sub.id=ss.subject_id
    WHERE ${where.join(' AND ')}
    ORDER BY s.roll_no NULLS LAST, s.first_name, sub.name
  `, vals);
  res.json({ ok: true, studentSubjects: rows });
});

examRouter.post('/student-subjects', async (req, res) => {
  if (!guard(req, res, 'exam.setup')) return;
  const b = req.body || {};
  const items = Array.isArray(b.items) ? b.items : [b];
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const results = [];
    for (const item of items) {
      const row = await client.query(`
        INSERT INTO school_student_subject (app_id, student_id, subject_id, academic_year_id, is_optional, is_additional)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (app_id, student_id, subject_id, academic_year_id) DO UPDATE SET
          is_optional=EXCLUDED.is_optional, is_additional=EXCLUDED.is_additional, updated_at=now()
        RETURNING *
      `, [appIdOf(req), num(item.studentId), num(item.subjectId), num(item.academicYearId), item.isOptional===true, item.isAdditional===true]);
      results.push(row[0]);
    }
    await client.query('COMMIT');
    res.json({ ok: true, studentSubjects: results });
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});

/* Alias routes with /exam/ prefix for frontend compatibility */
examRouter.get('/exam/student-subjects', async (req, res) => {
  if (!guard(req, res, 'exam.view')) return;
  const classId = num(req.query.classId);
  const yearId = num(req.query.academicYearId);
  const where = ['ss.app_id=$1', 'ss.deleted_at IS NULL'];
  const vals = [appIdOf(req)];
  if (classId) { vals.push(classId); where.push(`s.class_id=$${vals.length}`); }
  if (yearId) { vals.push(yearId); where.push(`ss.academic_year_id=$${vals.length}`); }
  const rows = await execQ(getPool(), `
    SELECT ss.*, s.admission_no, s.first_name, s.last_name, s.class_id, s.section_id, sub.name AS subject_name
    FROM school_student_subject ss
    JOIN school_students s ON s.id=ss.student_id AND s.app_id=ss.app_id
    JOIN school_subjects sub ON sub.id=ss.subject_id
    WHERE ${where.join(' AND ')}
    ORDER BY s.roll_no NULLS LAST, s.first_name, sub.name
  `, vals);
  res.json({ ok: true, studentSubjects: rows });
});

examRouter.post('/exam/student-subjects', async (req, res) => {
  if (!guard(req, res, 'exam.setup')) return;
  const b = req.body || {};
  const items = Array.isArray(b.items) ? b.items : [b];
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const results = [];
    for (const item of items) {
      const row = await client.query(`
        INSERT INTO school_student_subject (app_id, student_id, subject_id, academic_year_id, is_optional, is_additional)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (app_id, student_id, subject_id, academic_year_id) DO UPDATE SET
          is_optional=EXCLUDED.is_optional, is_additional=EXCLUDED.is_additional, updated_at=now()
        RETURNING *
      `, [appIdOf(req), num(item.studentId), num(item.subjectId), num(item.academicYearId), item.isOptional===true, item.isAdditional===true]);
      results.push(row[0]);
    }
    await client.query('COMMIT');
    res.json({ ok: true, studentSubjects: results });
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});

/* ============================================================
   6. GRADE SCALES
   ============================================================ */

examRouter.get('/grade-scales', async (req, res) => {
  if (!guard(req, res, 'exam.grade_setup')) return;
  const yearId = num(req.query.academicYearId);
  const where = ['gs.app_id=$1', 'gs.deleted_at IS NULL'];
  const vals = [appIdOf(req)];
  if (yearId) { vals.push(yearId); where.push(`gs.academic_year_id=$${vals.length}`); }
  const rows = await execQ(getPool(), `
    SELECT gs.* FROM school_grade_scale gs WHERE ${where.join(' AND ')} ORDER BY gs.effective_from DESC, gs.name
  `, vals);
  res.json({ ok: true, gradeScales: rows });
});

examRouter.post('/grade-scales', async (req, res) => {
  if (!guard(req, res, 'exam.grade_setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    INSERT INTO school_grade_scale (app_id, academic_year_id, name, description, version, effective_from, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [appIdOf(req), num(b.academicYearId), text(b.name), text(b.description), num(b.version)||1, dayOf(b.effectiveFrom), text(req.user.userid)]);
  res.json({ ok: true, gradeScale: row[0] });
});

examRouter.get('/grade-scales/:id/bands', async (req, res) => {
  if (!guard(req, res, 'exam.grade_setup')) return;
  const rows = await execQ(getPool(), `
    SELECT * FROM school_grade_band WHERE app_id=$1 AND scale_id=$2 AND deleted_at IS NULL ORDER BY class_band, sort_order
  `, [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true, bands: rows });
});

examRouter.post('/grade-scales/:id/bands', async (req, res) => {
  if (!guard(req, res, 'exam.grade_setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    INSERT INTO school_grade_band (app_id, scale_id, class_band, min_percent, max_percent, grade, grade_points, remark, sort_order)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
  `, [appIdOf(req), num(req.params.id), text(b.classBand), num(b.minPercent), num(b.maxPercent), text(b.grade), num(b.gradePoints), text(b.remark), num(b.sortOrder)||0]);
  res.json({ ok: true, band: row[0] });
});

examRouter.put('/grade-bands/:id', async (req, res) => {
  if (!guard(req, res, 'exam.grade_setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    UPDATE school_grade_band SET
      min_percent=$3, max_percent=$4, grade=$5, grade_points=$6, remark=$7, sort_order=$8, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), num(b.minPercent), num(b.maxPercent), text(b.grade), num(b.gradePoints), text(b.remark), num(b.sortOrder)||0]);
  res.json({ ok: true, band: row[0] });
});

/* Alias routes with /exam/ prefix for frontend compatibility */
examRouter.get('/exam/grade-scales', async (req, res) => {
  if (!guard(req, res, 'exam.grade_setup')) return;
  const yearId = num(req.query.academicYearId);
  const where = ['gs.app_id=$1', 'gs.deleted_at IS NULL'];
  const vals = [appIdOf(req)];
  if (yearId) { vals.push(yearId); where.push(`gs.academic_year_id=$${vals.length}`); }
  const rows = await execQ(getPool(), `
    SELECT gs.* FROM school_grade_scale gs WHERE ${where.join(' AND ')} ORDER BY gs.effective_from DESC, gs.name
  `, vals);
  res.json({ ok: true, gradeScales: rows });
});

examRouter.post('/exam/grade-scales', async (req, res) => {
  if (!guard(req, res, 'exam.grade_setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    INSERT INTO school_grade_scale (app_id, academic_year_id, name, description, version, effective_from, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [appIdOf(req), num(b.academicYearId), text(b.name), text(b.description), num(b.version)||1, dayOf(b.effectiveFrom), text(req.user.userid)]);
  res.json({ ok: true, gradeScale: row[0] });
});

examRouter.get('/exam/grade-scales/:id/bands', async (req, res) => {
  if (!guard(req, res, 'exam.grade_setup')) return;
  const rows = await execQ(getPool(), `
    SELECT * FROM school_grade_band WHERE app_id=$1 AND scale_id=$2 AND deleted_at IS NULL ORDER BY class_band, sort_order
  `, [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true, bands: rows });
});

examRouter.post('/exam/grade-scales/:id/bands', async (req, res) => {
  if (!guard(req, res, 'exam.grade_setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    INSERT INTO school_grade_band (app_id, scale_id, class_band, min_percent, max_percent, grade, grade_points, remark, sort_order)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
  `, [appIdOf(req), num(req.params.id), text(b.classBand), num(b.minPercent), num(b.maxPercent), text(b.grade), num(b.gradePoints), text(b.remark), num(b.sortOrder)||0]);
  res.json({ ok: true, band: row[0] });
});

/* ============================================================
   7. RESULT RULES
   ============================================================ */

examRouter.get('/result-rules', async (req, res) => {
  if (!guard(req, res, 'exam.grade_setup')) return;
  const yearId = num(req.query.academicYearId);
  const where = ['app_id=$1', 'deleted_at IS NULL'];
  const vals = [appIdOf(req)];
  if (yearId) { vals.push(yearId); where.push(`academic_year_id=$${vals.length}`); }
  const rows = await execQ(getPool(), `
    SELECT * FROM school_result_rule WHERE ${where.join(' AND ')} ORDER BY class_band, version DESC
  `, vals);
  res.json({ ok: true, resultRules: rows });
});

examRouter.post('/result-rules', async (req, res) => {
  if (!guard(req, res, 'exam.grade_setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    INSERT INTO school_result_rule (app_id, academic_year_id, class_band, version, effective_from, weightage_scheme, best_of_rule, pass_rule, grace_rule, compartment_rule, rounding_rule, rank_rule, optional_subject_rule, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *
  `, [appIdOf(req), num(b.academicYearId), text(b.classBand), num(b.version)||1, dayOf(b.effectiveFrom), b.weightageScheme ? JSON.stringify(b.weightageScheme) : '{}', b.bestOfRule ? JSON.stringify(b.bestOfRule) : null, b.passRule ? JSON.stringify(b.passRule) : '{}', b.graceRule ? JSON.stringify(b.graceRule) : null, b.compartmentRule ? JSON.stringify(b.compartmentRule) : null, text(b.roundingRule)||'nearest', b.rankRule ? JSON.stringify(b.rankRule) : null, b.optionalSubjectRule ? JSON.stringify(b.optionalSubjectRule) : null, text(req.user.userid)]);
  res.json({ ok: true, resultRule: row[0] });
});

examRouter.put('/result-rules/:id', async (req, res) => {
  if (!guard(req, res, 'exam.grade_setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    UPDATE school_result_rule SET
      weightage_scheme=$3, best_of_rule=$4, pass_rule=$5, grace_rule=$6, compartment_rule=$7, rounding_rule=$8, rank_rule=$9, optional_subject_rule=$10, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), b.weightageScheme ? JSON.stringify(b.weightageScheme) : '{}', b.bestOfRule ? JSON.stringify(b.bestOfRule) : null, b.passRule ? JSON.stringify(b.passRule) : '{}', b.graceRule ? JSON.stringify(b.graceRule) : null, b.compartmentRule ? JSON.stringify(b.compartmentRule) : null, text(b.roundingRule)||'nearest', b.rankRule ? JSON.stringify(b.rankRule) : null, b.optionalSubjectRule ? JSON.stringify(b.optionalSubjectRule) : null]);
  res.json({ ok: true, resultRule: row[0] });
});

examRouter.post('/result-rules/preview', async (req, res) => {
  if (!guard(req, res, 'exam.grade_setup')) return;
  // TODO: implement preview calculation engine
  res.json({ ok: true, preview: { message: 'Preview engine not yet implemented' } });
});

/* Alias routes with /exam/ prefix for frontend compatibility */
examRouter.get('/exam/result-rules', async (req, res) => {
  if (!guard(req, res, 'exam.grade_setup')) return;
  const yearId = num(req.query.academicYearId);
  const where = ['app_id=$1', 'deleted_at IS NULL'];
  const vals = [appIdOf(req)];
  if (yearId) { vals.push(yearId); where.push(`academic_year_id=$${vals.length}`); }
  const rows = await execQ(getPool(), `
    SELECT * FROM school_result_rule WHERE ${where.join(' AND ')} ORDER BY class_band, version DESC
  `, vals);
  res.json({ ok: true, resultRules: rows });
});

examRouter.post('/exam/result-rules', async (req, res) => {
  if (!guard(req, res, 'exam.grade_setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    INSERT INTO school_result_rule (app_id, academic_year_id, class_band, version, effective_from, weightage_scheme, best_of_rule, pass_rule, grace_rule, compartment_rule, rounding_rule, rank_rule, optional_subject_rule, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *
  `, [appIdOf(req), num(b.academicYearId), text(b.classBand), num(b.version)||1, dayOf(b.effectiveFrom), b.weightageScheme ? JSON.stringify(b.weightageScheme) : '{}', b.bestOfRule ? JSON.stringify(b.bestOfRule) : null, b.passRule ? JSON.stringify(b.passRule) : '{}', b.graceRule ? JSON.stringify(b.graceRule) : null, b.compartmentRule ? JSON.stringify(b.compartmentRule) : null, text(b.roundingRule)||'nearest', b.rankRule ? JSON.stringify(b.rankRule) : null, b.optionalSubjectRule ? JSON.stringify(b.optionalSubjectRule) : null, text(req.user.userid)]);
  res.json({ ok: true, resultRule: row[0] });
});

examRouter.put('/exam/result-rules/:id', async (req, res) => {
  if (!guard(req, res, 'exam.grade_setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    UPDATE school_result_rule SET
      weightage_scheme=$3, best_of_rule=$4, pass_rule=$5, grace_rule=$6, compartment_rule=$7, rounding_rule=$8, rank_rule=$9, optional_subject_rule=$10, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), b.weightageScheme ? JSON.stringify(b.weightageScheme) : '{}', b.bestOfRule ? JSON.stringify(b.bestOfRule) : null, b.passRule ? JSON.stringify(b.passRule) : '{}', b.graceRule ? JSON.stringify(b.graceRule) : null, b.compartmentRule ? JSON.stringify(b.compartmentRule) : null, text(b.roundingRule)||'nearest', b.rankRule ? JSON.stringify(b.rankRule) : null, b.optionalSubjectRule ? JSON.stringify(b.optionalSubjectRule) : null]);
  res.json({ ok: true, resultRule: row[0] });
});

examRouter.post('/exam/result-rules/preview', async (req, res) => {
  if (!guard(req, res, 'exam.grade_setup')) return;
  res.json({ ok: true, preview: { message: 'Preview engine not yet implemented' } });
});

/* ============================================================
   8. REPORT TEMPLATES
   ============================================================ */

examRouter.get('/report-templates', async (req, res) => {
  if (!guard(req, res, 'exam.report_setup')) return;
  const yearId = num(req.query.academicYearId);
  const where = ['app_id=$1', 'deleted_at IS NULL'];
  const vals = [appIdOf(req)];
  if (yearId) { vals.push(yearId); where.push(`academic_year_id=$${vals.length}`); }
  const rows = await execQ(getPool(), `
    SELECT * FROM school_report_template WHERE ${where.join(' AND ')} ORDER BY class_band, name
  `, vals);
  res.json({ ok: true, templates: rows });
});

examRouter.post('/report-templates', async (req, res) => {
  if (!guard(req, res, 'exam.report_setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    INSERT INTO school_report_template (app_id, academic_year_id, class_band, name, layout, is_default, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [appIdOf(req), num(b.academicYearId), text(b.classBand), text(b.name), b.layout ? JSON.stringify(b.layout) : '{}', b.isDefault===true, text(req.user.userid)]);
  res.json({ ok: true, template: row[0] });
});

examRouter.put('/report-templates/:id', async (req, res) => {
  if (!guard(req, res, 'exam.report_setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    UPDATE school_report_template SET
      class_band=$3, name=$4, layout=$5, is_default=$6, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), text(b.classBand), text(b.name), b.layout ? JSON.stringify(b.layout) : '{}', b.isDefault===true]);
  res.json({ ok: true, template: row[0] });
});

/* Alias routes with /exam/ prefix for frontend compatibility */
examRouter.get('/exam/report-templates', async (req, res) => {
  if (!guard(req, res, 'exam.report_setup')) return;
  const yearId = num(req.query.academicYearId);
  const where = ['app_id=$1', 'deleted_at IS NULL'];
  const vals = [appIdOf(req)];
  if (yearId) { vals.push(yearId); where.push(`academic_year_id=$${vals.length}`); }
  const rows = await execQ(getPool(), `
    SELECT * FROM school_report_template WHERE ${where.join(' AND ')} ORDER BY class_band, name
  `, vals);
  res.json({ ok: true, templates: rows });
});

examRouter.post('/exam/report-templates', async (req, res) => {
  if (!guard(req, res, 'exam.report_setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    INSERT INTO school_report_template (app_id, academic_year_id, class_band, name, layout, is_default, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [appIdOf(req), num(b.academicYearId), text(b.classBand), text(b.name), b.layout ? JSON.stringify(b.layout) : '{}', b.isDefault===true, text(req.user.userid)]);
  res.json({ ok: true, template: row[0] });
});

examRouter.put('/exam/report-templates/:id', async (req, res) => {
  if (!guard(req, res, 'exam.report_setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    UPDATE school_report_template SET
      class_band=$3, name=$4, layout=$5, is_default=$6, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), text(b.classBand), text(b.name), b.layout ? JSON.stringify(b.layout) : '{}', b.isDefault===true]);
  res.json({ ok: true, template: row[0] });
});

/* ============================================================
   12. MARKS DASHBOARD
   ============================================================ */

examRouter.get('/marks-sheets/dashboard', async (req, res) => {
  if (!guard(req, res, 'exam.marks.view')) return;
  const examId = num(req.query.examId);
  const where = ['ms.app_id=$1', 'ms.deleted_at IS NULL'];
  const vals = [appIdOf(req)];
  if (examId) { vals.push(examId); where.push(`ms.exam_id=$${vals.length}`); }
  const rows = await execQ(getPool(), `
    SELECT 
      ms.state,
      COUNT(*) AS count,
      e.name AS exam_name,
      c.name AS class_name,
      sec.name AS section_name,
      s.name AS subject_name
    FROM school_marks_sheet ms
    JOIN school_exam_paper p ON p.id=ms.paper_id
    JOIN school_classes c ON c.id=p.class_id
    JOIN school_sections sec ON sec.id=ms.section_id
    JOIN school_subjects s ON s.id=p.subject_id
    JOIN school_exam e ON e.id=ms.exam_id
    WHERE ${where.join(' AND ')}
    GROUP BY ms.state, e.name, e.start_date, c.name, c.sort_order, sec.name, s.name
    ORDER BY e.start_date NULLS LAST, c.sort_order NULLS LAST, c.name, sec.name, s.name
  `, vals);
  res.json({ ok: true, dashboard: rows });
});

/* ============================================================
   9. MARKS SHEETS
   ============================================================ */

examRouter.get('/marks-sheets', async (req, res) => {
  if (!guard(req, res, 'exam.marks.view')) return;
  const examId = num(req.query.examId);
  const sectionId = num(req.query.sectionId);
  const state = text(req.query.state);
  const where = ['ms.app_id=$1', 'ms.deleted_at IS NULL'];
  const vals = [appIdOf(req)];
  if (examId) { vals.push(examId); where.push(`ms.exam_id=$${vals.length}`); }
  if (sectionId) { vals.push(sectionId); where.push(`ms.section_id=$${vals.length}`); }
  if (state) { vals.push(state); where.push(`ms.state=$${vals.length}`); }
  const rows = await execQ(getPool(), `
    SELECT ms.*, p.max_marks, p.pass_marks, c.name AS class_name, sec.name AS section_name, s.name AS subject_name, e.name AS exam_name
    FROM school_marks_sheet ms
    JOIN school_exam_paper p ON p.id=ms.paper_id
    JOIN school_classes c ON c.id=p.class_id
    JOIN school_sections sec ON sec.id=ms.section_id
    JOIN school_subjects s ON s.id=p.subject_id
    JOIN school_exam e ON e.id=ms.exam_id
    WHERE ${where.join(' AND ')}
    ORDER BY e.start_date NULLS LAST, c.sort_order NULLS LAST, c.name, sec.name, s.name
  `, vals);
  res.json({ ok: true, marksSheets: rows });
});

async function ensureMarksSheetsForExam(req, examId) {
  if (!examId) throw new Error('examId is required');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const appId = appIdOf(req);
    const [exam] = (await client.query('SELECT * FROM school_exam WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, examId])).rows;
    if (!exam) throw new Error('Exam not found');
    const papers = (await client.query('SELECT * FROM school_exam_paper WHERE app_id=$1 AND exam_id=$2 AND deleted_at IS NULL', [appId, examId])).rows;
    let created = 0;
    for (const paper of papers) {
      const sectionQuery = paper.class_id
        ? `SELECT DISTINCT sec.* FROM school_sections sec
           JOIN school_students s ON s.section_id=sec.id
           WHERE s.app_id=$1 AND s.class_id=$2 AND s.status='active' AND s.deleted_at IS NULL AND sec.is_active=true`
        : `SELECT DISTINCT sec.* FROM school_sections sec
           JOIN school_students s ON s.section_id=sec.id
           WHERE s.app_id=$1 AND s.status='active' AND s.deleted_at IS NULL AND sec.is_active=true`;
      const sections = (await client.query(sectionQuery, paper.class_id ? [appId, paper.class_id] : [appId])).rows;
      for (const sec of sections) {
        const exists = await client.query(
          'SELECT 1 FROM school_marks_sheet WHERE app_id=$1 AND paper_id=$2 AND section_id=$3 AND deleted_at IS NULL',
          [appId, paper.id, sec.id]
        );
        if (!exists.rowCount) {
          await client.query(`
            INSERT INTO school_marks_sheet (app_id, exam_id, paper_id, section_id, state, created_by)
            VALUES ($1,$2,$3,$4,'not_started',$5)
          `, [appId, examId, paper.id, sec.id, text(req.user.userid)]);
          created++;
        }
      }
    }
    await client.query('COMMIT');
    await writeAudit(req, 'marks_sheets.ensure', 'school_exam', examId, null, { created, examId });
    return created;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

examRouter.post('/marks-sheets/ensure', async (req, res) => {
  if (!guard(req, res, 'exam.marks.manage')) return;
  try {
    const created = await ensureMarksSheetsForExam(req, num((req.body || {}).examId));
    res.json({ ok: true, created });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

examRouter.get('/marks-sheets/:id', async (req, res) => {
  if (!guard(req, res, 'exam.marks.view')) return;
  const [sheet] = await execQ(getPool(), `
    SELECT ms.*, p.class_id AS class_id, p.max_marks, p.pass_marks, p.grades_only,
           c.name AS class_name, sec.name AS section_name, s.name AS subject_name,
           e.name AS exam_name, e.id AS exam_id
    FROM school_marks_sheet ms
    JOIN school_exam_paper p ON p.id=ms.paper_id
    JOIN school_classes c ON c.id=p.class_id
    JOIN school_sections sec ON sec.id=ms.section_id
    JOIN school_subjects s ON s.id=p.subject_id
    JOIN school_exam e ON e.id=ms.exam_id
    WHERE ms.app_id=$1 AND ms.id=$2
  `, [appIdOf(req), num(req.params.id)]);
  if (!sheet) return res.status(404).json({ error: 'Marks sheet not found' });
  
  const components = await execQ(getPool(), `
    SELECT * FROM school_paper_component WHERE app_id=$1 AND paper_id=$2 AND deleted_at IS NULL ORDER BY sort_order
  `, [appIdOf(req), sheet.paper_id]);
  
  // Get enrolled students for this section+subject
  const students = await execQ(getPool(), `
    SELECT s.id, s.admission_no, s.first_name, s.last_name, s.roll_no, s.section_id, s.class_id
    FROM school_students s
    WHERE s.app_id=$1 AND s.section_id=$2 AND s.status='active' AND s.deleted_at IS NULL
      AND s.class_id=$3
    ORDER BY s.roll_no NULLS LAST, s.first_name
  `, [appIdOf(req), sheet.section_id, sheet.class_id]);
  
  const entries = await execQ(getPool(), `
    SELECT me.*, pc.name AS component_name, pc.max_marks, pc.pass_minimum, pc.is_mandatory, pc.sort_order
    FROM school_mark_entry me
    JOIN school_paper_component pc ON pc.id=me.component_id
    WHERE me.sheet_id=$1 AND me.deleted_at IS NULL
  `, [sheet.id]);
  
  const entryMap = {};
  entries.forEach(e => { entryMap[`${e.student_id}-${e.component_id}`] = e; });
  
  const grid = students.map(st => {
    const row = { student: st, components: [] };
    components.forEach(c => {
      const key = `${st.id}-${c.id}`;
      const e = entryMap[key];
      row.components.push({
        component: c,
        entry_id: e?.id ?? null,
        marks: e?.marks ?? null,
        status_code: e?.status_code ?? null,
        row_version: e?.row_version ?? 1
      });
    });
    return row;
  });
  
  res.json({ ok: true, sheet, grid, components });
});

examRouter.post('/marks-sheets/:id/entries', async (req, res) => {
  if (!guard(req, res, 'exam.marks.entry')) return;
  const b = req.body || {};
  const entries = Array.isArray(b.entries) ? b.entries : [];
  if (!entries.length) return res.json({ ok: true, saved: 0, audits: [] });
  const appId = appIdOf(req);
  const client = await getPool().connect();
  const auditRows = [];
  try {
    await client.query('BEGIN');
    const sheet = (await client.query('SELECT * FROM school_marks_sheet WHERE app_id=$1 AND id=$2 FOR UPDATE', [appId, num(req.params.id)])).rows[0];
    if (!sheet) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Sheet not found' });
    }
    if (!['not_started', 'draft', 'reopened'].includes(sheet.state)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Sheet is locked. Use corrections to change marks.', state: sheet.state });
    }
    const components = (await client.query(
      'SELECT * FROM school_paper_component WHERE app_id=$1 AND paper_id=$2 AND deleted_at IS NULL', [appId, sheet.paper_id]
    )).rows;
    const componentMap = new Map(components.map((c) => [Number(c.id), c]));
    if (!components.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This paper has no components. Add components in Exam Setup before entering marks.' });
    }
    const roster = (await client.query(
      `SELECT id FROM school_students WHERE app_id=$1 AND section_id=$2 AND status='active' AND deleted_at IS NULL`,
      [appId, sheet.section_id]
    )).rows;
    const rosterSet = new Set(roster.map((r) => Number(r.id)));
    const existing = (await client.query(
      'SELECT * FROM school_mark_entry WHERE app_id=$1 AND sheet_id=$2 AND deleted_at IS NULL', [appId, sheet.id]
    )).rows;
    const existingMap = new Map(existing.map((r) => [`${r.student_id}-${r.component_id}`, r]));

    const errors = [];
    const prepared = [];
    for (const raw of entries) {
      const studentId = num(raw.studentId);
      const componentId = num(raw.componentId);
      const component = componentMap.get(Number(componentId));
      if (!rosterSet.has(Number(studentId))) {
        errors.push({ studentId, componentId, error: 'Student is not enrolled in this section' });
        continue;
      }
      if (!component) {
        errors.push({ studentId, componentId, error: 'Component does not belong to this paper' });
        continue;
      }
      const code = text(raw.statusCode);
      if (code && !VALID_STATUS_CODES.has(code)) {
        errors.push({ studentId, componentId, error: `Invalid status code: ${code}` });
        continue;
      }
      let marks = null;
      if (!code && raw.marks !== undefined && raw.marks !== null && raw.marks !== '') {
        marks = num(raw.marks);
        if (!Number.isFinite(marks)) {
          errors.push({ studentId, componentId, error: 'Marks must be a number' });
          continue;
        }
        if (marks < 0 || marks > Number(component.max_marks)) {
          errors.push({ studentId, componentId, error: `Marks must be between 0 and ${component.max_marks}` });
          continue;
        }
      }
      const key = `${studentId}-${componentId}`;
      const prior = existingMap.get(key);
      if (raw.rowVersion !== undefined && raw.rowVersion !== null && prior && Number(raw.rowVersion) !== Number(prior.row_version)) {
        errors.push({ studentId, componentId, error: 'This row changed elsewhere. Reload the sheet and try again.', rowVersion: prior.row_version });
        continue;
      }
      prepared.push({ studentId, componentId, marks, code, prior });
    }
    if (errors.length) {
      await client.query('ROLLBACK');
      return res.status(422).json({ error: `${errors.length} row(s) failed validation`, errors });
    }

    let saved = 0;
    for (const item of prepared) {
      const row = (await client.query(`
        INSERT INTO school_mark_entry (app_id, sheet_id, student_id, component_id, marks, status_code, entered_by, row_version)
        VALUES ($1,$2,$3,$4,$5,$6,$7,1)
        ON CONFLICT (sheet_id, student_id, component_id) WHERE deleted_at IS NULL DO UPDATE SET
          marks=EXCLUDED.marks, status_code=EXCLUDED.status_code, entered_by=EXCLUDED.entered_by,
          updated_at=now(), row_version=school_mark_entry.row_version+1
        RETURNING *
      `, [appId, sheet.id, item.studentId, item.componentId, item.marks, item.code, text(req.user.userid)])).rows[0];
      saved++;
      auditRows.push({
        action: item.prior ? 'mark_entry.update' : 'mark_entry.create',
        entityId: row.id,
        before: item.prior ? { marks: item.prior.marks, status_code: item.prior.status_code } : null,
        after: { marks: row.marks, status_code: row.status_code, student_id: row.student_id, component_id: row.component_id },
      });
    }
    await client.query(`UPDATE school_marks_sheet SET state='draft', updated_at=now() WHERE id=$1`, [sheet.id]);
    await client.query('COMMIT');
    for (const audit of auditRows) {
      await writeAudit(req, audit.action, 'school_mark_entry', audit.entityId, audit.before, audit.after);
    }
    res.json({ ok: true, saved });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

examRouter.post('/marks-sheets/:id/submit', async (req, res) => {
  if (!guard(req, res, 'exam.marks.entry')) return;
  const appId = appIdOf(req);
  const [sheet] = await execQ(getPool(),'SELECT * FROM school_marks_sheet WHERE app_id=$1 AND id=$2', [appId, num(req.params.id)]);
  if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
  if (sheet.state !== 'draft' && sheet.state !== 'reopened') return res.status(409).json({ error: 'Only draft/reopened sheets can be submitted', state: sheet.state });
  const missing = (await execQ(getPool(), `
    SELECT COUNT(*)::int AS c
    FROM school_students st
    CROSS JOIN school_paper_component pc
    WHERE st.app_id=$1 AND st.section_id=$2 AND st.status='active' AND st.deleted_at IS NULL
      AND pc.app_id=$1 AND pc.paper_id=$3 AND pc.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM school_mark_entry me
        WHERE me.app_id=$1 AND me.sheet_id=$4 AND me.student_id=st.id AND me.component_id=pc.id AND me.deleted_at IS NULL
          AND (me.marks IS NOT NULL OR me.status_code IS NOT NULL)
      )
  `, [appId, sheet.section_id, sheet.paper_id, sheet.id]))[0];
  if (missing && missing.c > 0) {
    return res.status(422).json({ error: `${missing.c} mark entry(ies) are still missing for this sheet. Enter marks or assign a status code for every student and component.` });
  }
  await execQ(getPool(),'UPDATE school_marks_sheet SET state=\'submitted\', submitted_by=$1, submitted_at=now(), updated_at=now() WHERE id=$2', [text(req.user.userid), sheet.id]);
  await writeAudit(req, 'marks_sheet.submit', 'school_marks_sheet', sheet.id, { state: sheet.state }, { state: 'submitted' });
  res.json({ ok: true, sheet: { ...sheet, state: 'submitted', submitted_by: req.user.userid, submitted_at: new Date().toISOString() } });
});

examRouter.post('/marks-sheets/:id/verify', async (req, res) => {
  if (!guard(req, res, 'exam.marks.verify')) return;
  const [sheet] = await execQ(getPool(),'SELECT * FROM school_marks_sheet WHERE app_id=$1 AND id=$2', [appIdOf(req), num(req.params.id)]);
  if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
  if (sheet.state !== 'submitted') return res.status(409).json({ error: 'Only submitted sheets can be verified', state: sheet.state });
  await execQ(getPool(),'UPDATE school_marks_sheet SET state=\'verified\', verified_by=$1, verified_at=now(), updated_at=now() WHERE id=$2', [text(req.user.userid), sheet.id]);
  await writeAudit(req, 'marks_sheet.verify', 'school_marks_sheet', sheet.id, { state: sheet.state }, { state: 'verified' });
  res.json({ ok: true, sheet: { ...sheet, state: 'verified', verified_by: req.user.userid, verified_at: new Date().toISOString() } });
});

examRouter.post('/marks-sheets/:id/lock', async (req, res) => {
  if (!guard(req, res, 'exam.marks.lock')) return;
  const [sheet] = await execQ(getPool(),'SELECT * FROM school_marks_sheet WHERE app_id=$1 AND id=$2', [appIdOf(req), num(req.params.id)]);
  if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
  if (sheet.state !== 'submitted' && sheet.state !== 'verified') return res.status(409).json({ error: 'Sheet must be submitted or verified to lock', state: sheet.state });
  await execQ(getPool(),'UPDATE school_marks_sheet SET state=\'locked\', locked_by=$1, locked_at=now(), updated_at=now() WHERE id=$2', [text(req.user.userid), sheet.id]);
  await writeAudit(req, 'marks_sheet.lock', 'school_marks_sheet', sheet.id, { state: sheet.state }, { state: 'locked' });
  res.json({ ok: true, sheet: { ...sheet, state: 'locked', locked_by: req.user.userid, locked_at: new Date().toISOString() } });
});

examRouter.post('/marks-sheets/:id/reopen', async (req, res) => {
  if (!guard(req, res, 'exam.marks.lock')) return;
  const b = req.body || {};
  const reason = text(b.reason);
  if (!reason) return res.status(400).json({ error: 'Reopen reason is required' });
  const [sheet] = await execQ(getPool(),'SELECT * FROM school_marks_sheet WHERE app_id=$1 AND id=$2', [appIdOf(req), num(req.params.id)]);
  if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
  if (sheet.state !== 'locked' && sheet.state !== 'verified') return res.status(409).json({ error: 'Only locked or verified sheets can be reopened', state: sheet.state });
  await execQ(getPool(),'UPDATE school_marks_sheet SET state=\'draft\', reopened_by=$1, reopened_at=now(), reopen_reason=$2, updated_at=now() WHERE id=$3', [text(req.user.userid), reason, sheet.id]);
  await writeAudit(req, 'marks_sheet.reopen', 'school_marks_sheet', sheet.id, { state: sheet.state }, { state: 'draft', reason });
  res.json({ ok: true, sheet: { ...sheet, state: 'draft', reopened_by: req.user.userid, reopened_at: new Date().toISOString(), reopen_reason: reason } });
});

/* ============================================================
   10. MARKS CORRECTIONS
   ============================================================ */

examRouter.get('/marks-sheets/:id/corrections', async (req, res) => {
  if (!guard(req, res, 'exam.marks.view')) return;
  const rows = await execQ(getPool(), `
    SELECT mc.*, s.admission_no, s.first_name, s.last_name, pc.name AS component_name
    FROM school_mark_correction mc
    JOIN school_students s ON s.id=mc.student_id
    JOIN school_paper_component pc ON pc.id=(SELECT component_id FROM school_mark_entry WHERE id=mc.entry_id)
    WHERE mc.app_id=$1 AND mc.sheet_id=$2 AND mc.deleted_at IS NULL
    ORDER BY mc.requested_at DESC
  `, [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true, corrections: rows });
});

examRouter.post('/marks-sheets/corrections', async (req, res) => {
  if (!guard(req, res, 'exam.marks.correct')) return;
  const b = req.body || {};
  const [entry] = await execQ(getPool(),'SELECT * FROM school_mark_entry WHERE app_id=$1 AND id=$2', [appIdOf(req), num(b.entryId)]);
  if (!entry) return res.status(404).json({ error: 'Mark entry not found' });
  const [sheet] = await execQ(getPool(),'SELECT * FROM school_marks_sheet WHERE app_id=$1 AND id=$2', [appIdOf(req), entry.sheet_id]);
  if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
  // Separation of duties check
  if (sheet.state === 'locked' && req.school.separationOfDuties && entry.entered_by === text(req.user.userid) && !b.override) {
    return res.status(403).json({ error: 'Separation of duties: you cannot correct your own locked entry. Admin override required.' });
  }
  const row = await execQ(getPool(), `
    INSERT INTO school_mark_correction (app_id, entry_id, sheet_id, student_id, old_marks, new_marks, old_status_code, new_status_code, reason, requested_by, override)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
  `, [appIdOf(req), entry.id, sheet.id, entry.student_id, entry.marks, b.newMarks !== undefined ? num(b.newMarks) : null, entry.status_code, text(b.newStatusCode), text(b.reason), text(req.user.userid), b.override===true]);
  res.json({ ok: true, correction: row[0] });
});

examRouter.put('/marks-sheets/corrections/:id', async (req, res) => {
  if (!guard(req, res, 'exam.marks.correct')) return;
  const b = req.body || {};
  const decision = text(b.decision);
  if (!decision || !['approved', 'rejected'].includes(decision)) return res.status(400).json({ error: 'decision must be approved or rejected' });
  const [corr] = await execQ(getPool(),'SELECT * FROM school_mark_correction WHERE app_id=$1 AND id=$2', [appIdOf(req), num(req.params.id)]);
  if (!corr) return res.status(404).json({ error: 'Correction not found' });
  if (corr.decision) return res.status(409).json({ error: 'Correction already decided', decision: corr.decision });
  if (decision === 'approved') {
    await execQ(getPool(),'UPDATE school_mark_entry SET marks=$1, status_code=$2, updated_by=$3, updated_at=now(), row_version=row_version+1 WHERE id=$4', [corr.new_marks, corr.new_status_code, text(req.user.userid), corr.entry_id]);
  }
  await execQ(getPool(),'UPDATE school_mark_correction SET decision=$1, reviewed_by=$2, reviewed_at=now(), decision_reason=$3, processed_at=now() WHERE id=$4', [decision, text(req.user.userid), text(b.decisionReason), corr.id]);
  await writeAudit(req, `mark_correction.${decision}`, 'school_mark_correction', corr.id,
    { marks: corr.old_marks, status_code: corr.old_status_code },
    { marks: decision === 'approved' ? corr.new_marks : corr.old_marks, status_code: decision === 'approved' ? corr.new_status_code : corr.old_status_code, decision, reason: text(b.decisionReason) });
  res.json({ ok: true, correctionId: corr.id, decision });
});

/* ============================================================
   11. MARKS IMPORT
   ============================================================ */

function parseCsvText(csv) {
  const lines = String(csv || '').split(/\r?\n/).filter((line) => line.trim() !== '');
  if (!lines.length) return { header: [], rows: [] };
  const split = (line) => {
    const out = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') { cell += '"'; i++; }
        else quoted = !quoted;
      } else if (ch === ',' && !quoted) { out.push(cell.trim()); cell = ''; }
      else cell += ch;
    }
    out.push(cell.trim());
    return out;
  };
  const header = split(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
  const rows = lines.slice(1).map((line) => {
    const cells = split(line);
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']));
  });
  return { header, rows };
}

async function resolveImportRows(req, sheetId, input) {
  const appId = appIdOf(req);
  const sheet = (await execQ(getPool(), 'SELECT * FROM school_marks_sheet WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, sheetId]))[0];
  if (!sheet) throw new Error('Marks sheet not found');
  const [components, students] = await Promise.all([
    execQ(getPool(), 'SELECT * FROM school_paper_component WHERE app_id=$1 AND paper_id=$2 AND deleted_at IS NULL ORDER BY sort_order', [appId, sheet.paper_id]),
    execQ(getPool(), `SELECT id, admission_no FROM school_students WHERE app_id=$1 AND section_id=$2 AND status='active' AND deleted_at IS NULL`, [appId, sheet.section_id]),
  ]);
  const componentById = new Map(components.map((c) => [Number(c.id), c]));
  const componentByName = new Map(components.map((c) => [String(c.name).toLowerCase(), c]));
  const studentByAdmission = new Map(students.map((s) => [String(s.admission_no).toLowerCase(), s]));
  let rawRows = [];
  if (Array.isArray(input.rows) && input.rows.length) {
    rawRows = input.rows;
  } else if (input.csv) {
    rawRows = parseCsvText(input.csv).rows;
  }
  const valid = [];
  const errors = [];
  for (const [index, raw] of rawRows.entries()) {
    const line = index + 2;
    const admission = text(raw.admission_no ?? raw.admissionno ?? raw.admno ?? raw.admission ?? raw.student);
    let student = studentByAdmission.get(String(admission || '').toLowerCase());
    if (!student && raw.student_id) {
      student = students.find((s) => Number(s.id) === Number(raw.student_id));
    }
    if (!student) { errors.push({ line, error: `Unknown admission number: ${admission || '(blank)'}` }); continue; }
    const componentKey = text(raw.component ?? raw.component_name ?? raw.component_id);
    const component = componentById.get(Number(componentKey)) || componentByName.get(String(componentKey || '').toLowerCase());
    if (!component) { errors.push({ line, admissionNo: admission, error: `Unknown component: ${componentKey || '(blank)'}` }); continue; }
    const code = text(raw.status_code ?? raw.statuscode ?? raw.code);
    if (code && !VALID_STATUS_CODES.has(code)) { errors.push({ line, admissionNo: admission, error: `Invalid status code: ${code}` }); continue; }
    const markText = raw.marks ?? raw.mark ?? raw.score;
    let marks = null;
    if (!code && markText !== undefined && markText !== null && String(markText).trim() !== '') {
      marks = Number(markText);
      if (!Number.isFinite(marks) || marks < 0 || marks > Number(component.max_marks)) {
        errors.push({ line, admissionNo: admission, error: `Marks must be between 0 and ${component.max_marks}` });
        continue;
      }
    }
    valid.push({ studentId: student.id, componentId: component.id, marks, statusCode: code || null, line });
  }
  return { sheet, valid, errors, components };
}

examRouter.post('/marks-sheets/preview-import', async (req, res) => {
  if (!guard(req, res, 'exam.marks.entry')) return;
  const b = req.body || {};
  const sheetId = num(b.sheetId ?? b.sheet_id);
  if (!sheetId) return res.status(400).json({ error: 'sheetId is required' });
  try {
    const result = await resolveImportRows(req, sheetId, b);
    res.json({ ok: true, preview: { valid: result.valid.length, invalid: result.errors.length, errors: result.errors, rows: result.valid } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

examRouter.post('/marks-sheets/:id/import', async (req, res) => {
  if (!guard(req, res, 'exam.marks.entry')) return;
  const b = req.body || {};
  const sheetId = num(req.params.id);
  try {
    const result = await resolveImportRows(req, sheetId, b);
    if (result.errors.length) {
      return res.status(422).json({ error: `${result.errors.length} row(s) failed validation. Nothing was imported.`, errors: result.errors });
    }
    if (!result.valid.length) return res.status(400).json({ error: 'No valid rows found to import' });
    if (!['not_started', 'draft', 'reopened'].includes(result.sheet.state)) {
      return res.status(409).json({ error: 'Sheet is locked; reopen it before importing marks.', state: result.sheet.state });
    }
    const client = await getPool().connect();
    const audits = [];
    try {
      await client.query('BEGIN');
      for (const row of result.valid) {
        const inserted = (await client.query(`
          INSERT INTO school_mark_entry (app_id, sheet_id, student_id, component_id, marks, status_code, entered_by, row_version)
          VALUES ($1,$2,$3,$4,$5,$6,$7,1)
          ON CONFLICT (sheet_id, student_id, component_id) WHERE deleted_at IS NULL DO UPDATE SET
            marks=EXCLUDED.marks, status_code=EXCLUDED.status_code, entered_by=EXCLUDED.entered_by,
            updated_at=now(), row_version=school_mark_entry.row_version+1
          RETURNING *
        `, [appIdOf(req), sheetId, row.studentId, row.componentId, row.marks, row.statusCode, text(req.user.userid)])).rows[0];
        audits.push(inserted);
      }
      await client.query(`UPDATE school_marks_sheet SET state='draft', updated_at=now() WHERE id=$1`, [sheetId]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    for (const row of audits) await writeAudit(req, 'mark_entry.import', 'school_mark_entry', row.id, null, row);
    res.json({ ok: true, imported: result.valid.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* Alias routes with /exam/ prefix for frontend compatibility */
examRouter.get('/exam/report-templates', async (req, res) => {
  if (!guard(req, res, 'exam.report_setup')) return;
  const yearId = num(req.query.academicYearId);
  const where = ['app_id=$1', 'deleted_at IS NULL'];
  const vals = [appIdOf(req)];
  if (yearId) { vals.push(yearId); where.push(`academic_year_id=$${vals.length}`); }
  const rows = await execQ(getPool(), `
    SELECT * FROM school_report_template WHERE ${where.join(' AND ')} ORDER BY class_band, name
  `, vals);
  res.json({ ok: true, templates: rows });
});

examRouter.post('/exam/report-templates', async (req, res) => {
  if (!guard(req, res, 'exam.report_setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    INSERT INTO school_report_template (app_id, academic_year_id, class_band, name, layout, is_default, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [appIdOf(req), num(b.academicYearId), text(b.classBand), text(b.name), b.layout ? JSON.stringify(b.layout) : '{}', b.isDefault===true, text(req.user.userid)]);
  res.json({ ok: true, template: row[0] });
});

examRouter.put('/exam/report-templates/:id', async (req, res) => {
  if (!guard(req, res, 'exam.report_setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    UPDATE school_report_template SET
      class_band=$3, name=$4, layout=$5, is_default=$6, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), text(b.classBand), text(b.name), b.layout ? JSON.stringify(b.layout) : '{}', b.isDefault===true]);
  res.json({ ok: true, template: row[0] });
});

/* ============================================================
   12. MARKS DASHBOARD
   ============================================================ */

examRouter.get('/marks-sheets/dashboard', async (req, res) => {
  if (!guard(req, res, 'exam.marks.view')) return;
  const examId = num(req.query.examId);
  const where = ['ms.app_id=$1', 'ms.deleted_at IS NULL'];
  const vals = [appIdOf(req)];
  if (examId) { vals.push(examId); where.push(`ms.exam_id=$${vals.length}`); }
  const rows = await execQ(getPool(), `
    SELECT 
      ms.state,
      COUNT(*) AS count,
      e.name AS exam_name,
      c.name AS class_name,
      sec.name AS section_name,
      s.name AS subject_name
    FROM school_marks_sheet ms
    JOIN school_exam_paper p ON p.id=ms.paper_id
    JOIN school_classes c ON c.id=p.class_id
    JOIN school_sections sec ON sec.id=ms.section_id
    JOIN school_subjects s ON s.id=p.subject_id
    JOIN school_exam e ON e.id=ms.exam_id
    WHERE ${where.join(' AND ')}
    GROUP BY ms.state, e.name, c.name, sec.name, s.name
    ORDER BY e.start_date NULLS LAST, c.sort_order NULLS LAST, c.name, sec.name, s.name
  `, vals);
  res.json({ ok: true, dashboard: rows });
});

/* Alias routes with /exam/ prefix for frontend compatibility */
examRouter.get('/exam/marks-sheets', async (req, res) => {
  if (!guard(req, res, 'exam.marks.view')) return;
  const examId = num(req.query.examId);
  const sectionId = num(req.query.sectionId);
  const state = text(req.query.state);
  const where = ['ms.app_id=$1', 'ms.deleted_at IS NULL'];
  const vals = [appIdOf(req)];
  if (examId) { vals.push(examId); where.push(`ms.exam_id=$${vals.length}`); }
  if (sectionId) { vals.push(sectionId); where.push(`ms.section_id=$${vals.length}`); }
  if (state) { vals.push(state); where.push(`ms.state=$${vals.length}`); }
  const rows = await execQ(getPool(), `
    SELECT ms.*, p.max_marks, p.pass_marks, c.name AS class_name, sec.name AS section_name, s.name AS subject_name, e.name AS exam_name
    FROM school_marks_sheet ms
    JOIN school_exam_paper p ON p.id=ms.paper_id
    JOIN school_classes c ON c.id=p.class_id
    JOIN school_sections sec ON sec.id=ms.section_id
    JOIN school_subjects s ON s.id=p.subject_id
    JOIN school_exam e ON e.id=ms.exam_id
    WHERE ${where.join(' AND ')}
    ORDER BY e.start_date NULLS LAST, c.sort_order NULLS LAST, c.name, sec.name, s.name
  `, vals);
  res.json({ ok: true, marksSheets: rows });
});

examRouter.post('/exam/marks-sheets/ensure', async (req, res) => {
  if (!guard(req, res, 'exam.marks.manage')) return;
  try {
    const created = await ensureMarksSheetsForExam(req, num((req.body || {}).examId));
    res.json({ ok: true, created });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

examRouter.get('/exam/marks-sheets/dashboard', async (req, res) => {
  if (!guard(req, res, 'exam.marks.view')) return;
  const examId = num(req.query.examId);
  const where = ['ms.app_id=$1', 'ms.deleted_at IS NULL'];
  const vals = [appIdOf(req)];
  if (examId) { vals.push(examId); where.push(`ms.exam_id=$${vals.length}`); }
  const rows = await execQ(getPool(), `
    SELECT 
      ms.state,
      COUNT(*) AS count,
      e.name AS exam_name,
      c.name AS class_name,
      sec.name AS section_name,
      s.name AS subject_name
    FROM school_marks_sheet ms
    JOIN school_exam_paper p ON p.id=ms.paper_id
    JOIN school_classes c ON c.id=p.class_id
    JOIN school_sections sec ON sec.id=ms.section_id
    JOIN school_subjects s ON s.id=p.subject_id
    JOIN school_exam e ON e.id=ms.exam_id
    WHERE ${where.join(' AND ')}
    GROUP BY ms.state, e.name, e.start_date, c.name, c.sort_order, sec.name, s.name
    ORDER BY e.start_date NULLS LAST, c.sort_order NULLS LAST, c.name, sec.name, s.name
  `, vals);
  res.json({ ok: true, dashboard: rows });
});

examRouter.get('/exam/report-cards', async (req, res) => {
  if (!guard(req, res, 'exam.reportcards.generate')) return;
  const appId = appIdOf(req);
  const versionId = num(req.query.versionId);
  const templateId = num(req.query.templateId);
  const sectionId = num(req.query.sectionId);
  const copyNo = num(req.query.copyNo) || 1;
  const vals = [appId];
  const where = ['rc.app_id=$1', 'rc.deleted_at IS NULL'];
  if (versionId) where.push(`rc.version_id=${bind(vals, versionId)}`);
  if (templateId) where.push(`rc.template_id=${bind(vals, templateId)}`);
  if (sectionId) where.push(`st.section_id=${bind(vals, sectionId)}`);
  where.push(`rc.copy_no=${bind(vals, copyNo)}`);
  const rows = await execQ(getPool(), `
    SELECT rc.*, st.admission_no, st.first_name || ' ' || st.last_name AS student,
           c.name AS class_name, sec.name AS section_name, rv.exam_id, e.name AS exam_name
    FROM school_report_card rc
    JOIN school_students st ON st.id=rc.student_id
    LEFT JOIN school_classes c ON c.id=st.class_id
    LEFT JOIN school_sections sec ON sec.id=st.section_id
    LEFT JOIN school_result_version rv ON rv.id=rc.version_id
    LEFT JOIN school_exam e ON e.id=rv.exam_id
    WHERE ${where.join(' AND ')}
    ORDER BY c.sort_order NULLS LAST, sec.name, st.roll_no NULLS LAST, st.first_name
  `, vals);
  res.json({ ok: true, reportCards: rows });
});

/* ============================================================
   13. MODERATION
   ============================================================ */

examRouter.post('/marks-sheets/:id/moderate', async (req, res) => {
  if (!guard(req, res, 'exam.marks.lock')) return;
  const b = req.body || {};
  const appId = appIdOf(req);
  const [sheet] = await execQ(getPool(),'SELECT * FROM school_marks_sheet WHERE app_id=$1 AND id=$2', [appId, num(req.params.id)]);
  if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
  const method = text(b.method);
  if (!['scale', 'add', 'cap'].includes(method)) return res.status(400).json({ error: 'method must be scale, add or cap' });
  const parameters = b.parameters && typeof b.parameters === 'object' ? b.parameters : {};
  const reason = text(b.reason);
  if (!reason) return res.status(400).json({ error: 'Moderation reason is required' });

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const rows = (await client.query(`
      SELECT me.*, pc.max_marks
      FROM school_mark_entry me
      JOIN school_paper_component pc ON pc.id=me.component_id
      WHERE me.app_id=$1 AND me.sheet_id=$2 AND me.deleted_at IS NULL AND me.marks IS NOT NULL
      FOR UPDATE OF me
    `, [appId, sheet.id])).rows;
    let changed = 0;
    for (const row of rows) {
      const original = Number(row.marks);
      let next = original;
      if (method === 'scale') {
        const factor = Number(parameters.factor ?? (parameters.percent !== undefined ? 1 + Number(parameters.percent) / 100 : 1));
        if (!Number.isFinite(factor) || factor < 0) throw new Error('scale requires a non-negative factor or percent');
        next = original * factor;
      } else if (method === 'add') {
        const amount = Number(parameters.amount ?? parameters.marks ?? 0);
        if (!Number.isFinite(amount)) throw new Error('add requires a numeric amount');
        next = original + amount;
      } else {
        const cap = Number(parameters.max ?? parameters.cap ?? 0);
        if (!Number.isFinite(cap)) throw new Error('cap requires a numeric max');
        next = Math.min(original, cap);
      }
      next = Math.max(0, Math.min(Number(row.max_marks), Number(next.toFixed(2))));
      if (next === original) continue;
      await client.query(
        'UPDATE school_mark_entry SET marks=$1, updated_by=$2, updated_at=now(), row_version=row_version+1 WHERE id=$3',
        [next, text(req.user.userid), row.id]
      );
      changed++;
    }
    const moderation = (await client.query(`
      INSERT INTO school_moderation (app_id, paper_id, section_id, method, parameters, reason, applied_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [appId, sheet.paper_id, sheet.section_id, method, JSON.stringify({ ...parameters, affected: changed }), reason, text(req.user.userid)])).rows[0];
    await client.query('COMMIT');
    await writeAudit(req, 'marks_sheet.moderate', 'school_marks_sheet', sheet.id,
      { entries: rows.length }, { method, parameters, affected: changed, reason });
    res.json({ ok: true, moderation, affected: changed });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

/* ============================================================
   14. EXAM SCHEDULE
   ============================================================ */

examRouter.get('/exam/schedule/slots', async (req, res) => {
  if (!guard(req, res, 'exam.schedule')) return;
  const examId = num(req.query.examId);
  const where = ['s.app_id=$1', 's.deleted_at IS NULL'];
  const vals = [appIdOf(req)];
  if (examId) { vals.push(examId); where.push(`s.exam_id=$${vals.length}`); }
  const rows = await execQ(getPool(), `
    SELECT s.*, sub.name AS subject_name, c.name AS class_name, sec.name AS section_name
    FROM school_exam_slot s
    JOIN school_exam_paper p ON p.id=s.paper_id
    LEFT JOIN school_subjects sub ON sub.id=p.subject_id
    LEFT JOIN school_classes c ON c.id=p.class_id
    LEFT JOIN school_sections sec ON sec.id=s.section_id
    WHERE ${where.join(' AND ')}
    ORDER BY s.date, s.start_time
  `, vals);
  res.json({ ok: true, slots: rows });
});

examRouter.post('/exam/schedule/slots', async (req, res) => {
  if (!guard(req, res, 'exam.schedule')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    INSERT INTO school_exam_slot (app_id, exam_id, paper_id, section_id, date, start_time, end_time, status, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
  `, [appIdOf(req), num(b.examId), num(b.paperId), num(b.sectionId) || null, dayOf(b.date), text(b.startTime), text(b.endTime), text(b.status) || 'draft', text(req.user.userid)]);
  res.json({ ok: true, slot: row[0] });
});

examRouter.put('/exam/schedule/slots/:id', async (req, res) => {
  if (!guard(req, res, 'exam.schedule')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    UPDATE school_exam_slot SET
      date=$3, start_time=$4, end_time=$5, status=$6, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), dayOf(b.date), text(b.startTime), text(b.endTime), text(b.status)]);
  res.json({ ok: true, slot: row[0] });
});

examRouter.delete('/exam/schedule/slots/:id', async (req, res) => {
  if (!guard(req, res, 'exam.schedule')) return;
  await execQ(getPool(), 'UPDATE school_exam_slot SET deleted_at=now() WHERE app_id=$1 AND id=$2', [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true });
});

examRouter.get('/exam/schedule/halls', async (req, res) => {
  if (!guard(req, res, 'exam.schedule')) return;
  const rows = await execQ(getPool(), `
    SELECT h.*, r.name AS room_name
    FROM school_exam_hall h
    LEFT JOIN school_rooms r ON r.id=h.room_id
    WHERE h.app_id=$1 AND h.deleted_at IS NULL
    ORDER BY h.name
  `, [appIdOf(req)]);
  res.json({ ok: true, halls: rows });
});

examRouter.post('/exam/schedule/halls', async (req, res) => {
  if (!guard(req, res, 'exam.schedule')) return;
  const b = req.body || {};
  if (!num(b.capacity)) return res.status(400).json({ error: 'Hall capacity is required' });
  const row = await execQ(getPool(), `
    INSERT INTO school_exam_hall (app_id, room_id, name, capacity, is_active)
    VALUES ($1,$2,$3,$4,true) RETURNING *
  `, [appIdOf(req), num(b.roomId), text(b.name) || null, num(b.capacity)]);
  res.json({ ok: true, hall: row[0] });
});

examRouter.put('/exam/schedule/halls/:id', async (req, res) => {
  if (!guard(req, res, 'exam.schedule')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    UPDATE school_exam_hall SET room_id=$3, name=$4, capacity=$5, is_active=$6, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), num(b.roomId), text(b.name) || null, num(b.capacity), b.isActive !== false]);
  res.json({ ok: true, hall: row[0] });
});

/* ---- Seating ---- */

examRouter.get('/exam/schedule/seating', async (req, res) => {
  if (!guard(req, res, 'exam.schedule')) return;
  const vals = [appIdOf(req)];
  const where = ['sa.app_id=$1', 'sa.deleted_at IS NULL'];
  if (req.query.slotId) where.push(`sa.slot_id=${bind(vals, num(req.query.slotId))}`);
  if (req.query.hallId) where.push(`sa.hall_id=${bind(vals, num(req.query.hallId))}`);
  const rows = await execQ(getPool(), `
    SELECT sa.*, h.name AS hall_name, h.capacity,
           st.admission_no, st.first_name, st.last_name, st.roll_no,
           c.name AS class_name, sec.name AS section_name,
           s.date, s.start_time, s.end_time, sub.name AS subject_name
    FROM school_seat_allocation sa
    JOIN school_exam_hall h ON h.id=sa.hall_id
    JOIN school_students st ON st.id=sa.student_id
    LEFT JOIN school_classes c ON c.id=st.class_id
    LEFT JOIN school_sections sec ON sec.id=st.section_id
    LEFT JOIN school_exam_slot s ON s.id=sa.slot_id
    LEFT JOIN school_exam_paper p ON p.id=s.paper_id
    LEFT JOIN school_subjects sub ON sub.id=p.subject_id
    WHERE ${where.join(' AND ')}
    ORDER BY h.name, sa.row_no, sa.col_no, sa.seat_no
  `, vals);
  res.json({ ok: true, allocations: rows });
});

examRouter.post('/exam/schedule/seating/generate', async (req, res) => {
  if (!guard(req, res, 'exam.schedule')) return;
  const appId = appIdOf(req);
  const b = req.body || {};
  const slotId = num(b.slotId);
  if (!slotId) return res.status(400).json({ error: 'slotId is required' });
  const slot = (await execQ(getPool(), `
    SELECT s.*, p.class_id FROM school_exam_slot s
    JOIN school_exam_paper p ON p.id=s.paper_id
    WHERE s.app_id=$1 AND s.id=$2 AND s.deleted_at IS NULL
  `, [appId, slotId]))[0];
  if (!slot) return res.status(404).json({ error: 'Exam slot not found' });

  const students = slot.section_id
    ? await execQ(getPool(), `
        SELECT * FROM school_students
        WHERE app_id=$1 AND section_id=$2 AND status='active' AND deleted_at IS NULL
        ORDER BY roll_no NULLS LAST, first_name
      `, [appId, slot.section_id])
    : await execQ(getPool(), `
        SELECT * FROM school_students
        WHERE app_id=$1 AND class_id=$2 AND status='active' AND deleted_at IS NULL
        ORDER BY section_id, roll_no NULLS LAST, first_name
      `, [appId, slot.class_id]);
  if (!students.length) return res.status(400).json({ error: 'No active students match this slot.' });

  const hallIds = Array.isArray(b.hallIds) ? b.hallIds.map(Number).filter(Boolean) : [];
  const halls = hallIds.length
    ? await execQ(getPool(), `SELECT * FROM school_exam_hall WHERE app_id=$1 AND deleted_at IS NULL AND is_active=true AND id = ANY($2::int[]) ORDER BY capacity DESC, name`, [appId, hallIds])
    : await execQ(getPool(), `SELECT * FROM school_exam_hall WHERE app_id=$1 AND deleted_at IS NULL AND is_active=true ORDER BY capacity DESC, name`, [appId]);
  if (!halls.length) return res.status(400).json({ error: 'Create at least one active exam hall first.' });
  const capacity = halls.reduce((sum, h) => sum + Number(h.capacity || 0), 0);
  if (students.length > capacity) {
    return res.status(400).json({ error: `Only ${capacity} seats available for ${students.length} students. Add halls or capacity.` });
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE school_seat_allocation SET deleted_at=now() WHERE app_id=$1 AND slot_id=$2 AND deleted_at IS NULL', [appId, slotId]);
    let index = 0;
    let created = 0;
    for (const hall of halls) {
      for (let seat = 1; seat <= Number(hall.capacity) && index < students.length; seat++, index++) {
        const rowNo = Math.ceil(seat / 6);
        const colNo = ((seat - 1) % 6) + 1;
        const seatNo = `${String.fromCharCode(65 + ((rowNo - 1) % 26))}${colNo}`;
        await client.query(`
          INSERT INTO school_seat_allocation (app_id, slot_id, hall_id, student_id, seat_no, row_no, col_no)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
        `, [appId, slotId, hall.id, students[index].id, seatNo, rowNo, colNo]);
        created++;
      }
      if (index >= students.length) break;
    }
    await client.query('COMMIT');
    await writeAudit(req, 'seating.generate', 'school_exam_slot', slotId, null, { created, hallIds: halls.map((h) => h.id) });
    res.json({ ok: true, created, students: students.length, halls: halls.length });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

examRouter.delete('/exam/schedule/seating/:id', async (req, res) => {
  if (!guard(req, res, 'exam.schedule')) return;
  await execQ(getPool(), 'UPDATE school_seat_allocation SET deleted_at=now() WHERE app_id=$1 AND id=$2', [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true });
});

/* ---- Invigilation ---- */

examRouter.get('/exam/schedule/invigilation', async (req, res) => {
  if (!guard(req, res, 'exam.schedule')) return;
  const vals = [appIdOf(req)];
  const where = ['i.app_id=$1', 'i.deleted_at IS NULL'];
  if (req.query.slotId) where.push(`i.slot_id=${bind(vals, num(req.query.slotId))}`);
  if (req.query.examId) where.push(`s.exam_id=${bind(vals, num(req.query.examId))}`);
  if (req.query.teacherId) where.push(`i.teacher_id=${bind(vals, num(req.query.teacherId))}`);
  const rows = await execQ(getPool(), `
    SELECT i.*, COALESCE(NULLIF(TRIM(t.first_name || ' ' || COALESCE(t.last_name,'')), ''), i.user_id, 'â€”') AS teacher_name,
           t.employee_no, h.name AS hall_name, s.date, s.start_time, s.end_time,
           sub.name AS subject_name, sec.name AS section_name
    FROM school_invigilation i
    LEFT JOIN school_hr_employees t ON t.id=i.teacher_id
    LEFT JOIN school_exam_hall h ON h.id=i.hall_id
    LEFT JOIN school_exam_slot s ON s.id=i.slot_id
    LEFT JOIN school_exam_paper p ON p.id=s.paper_id
    LEFT JOIN school_subjects sub ON sub.id=p.subject_id
    LEFT JOIN school_sections sec ON sec.id=s.section_id
    WHERE ${where.join(' AND ')}
    ORDER BY s.date, s.start_time, h.name, teacher_name
  `, vals);
  res.json({ ok: true, duties: rows });
});

examRouter.post('/exam/schedule/invigilation', async (req, res) => {
  if (!guard(req, res, 'exam.schedule')) return;
  const b = req.body || {};
  const slotId = num(b.slotId);
  const teacherId = num(b.teacherId);
  const hallId = num(b.hallId);
  if (!slotId || (!teacherId && !text(b.userId))) return res.status(400).json({ error: 'slotId and a teacher (or user) are required' });
  const role = text(b.role) || 'invigilator';
  if (!['invigilator', 'relieving', 'chief'].includes(role)) return res.status(400).json({ error: 'Invalid invigilation role' });
  try {
    const row = await execQ(getPool(), `
      INSERT INTO school_invigilation (app_id, slot_id, hall_id, teacher_id, user_id, role, assigned_by, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'assigned') RETURNING *
    `, [appIdOf(req), slotId, hallId || null, teacherId || null, text(b.userId), role, text(req.user.userid)]);
    await writeAudit(req, 'invigilation.assign', 'school_invigilation', row[0].id, null, row[0]);
    res.json({ ok: true, duty: row[0] });
  } catch (e) {
    res.status(409).json({ error: 'This teacher is already assigned to that slot.' });
  }
});

examRouter.put('/exam/schedule/invigilation/:id', async (req, res) => {
  if (!guard(req, res, 'exam.schedule')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    UPDATE school_invigilation SET hall_id=$3, role=$4, status=$5, updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), num(req.params.id), num(b.hallId) || null, text(b.role) || 'invigilator', text(b.status) || 'assigned']);
  res.json({ ok: true, duty: row[0] });
});

examRouter.delete('/exam/schedule/invigilation/:id', async (req, res) => {
  if (!guard(req, res, 'exam.schedule')) return;
  await execQ(getPool(), 'UPDATE school_invigilation SET deleted_at=now(), status=\'cancelled\' WHERE app_id=$1 AND id=$2', [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true });
});

/* ---- Hall Tickets ---- */

examRouter.get('/exam/schedule/hall-tickets', async (req, res) => {
  if (!guard(req, res, 'exam.schedule')) return;
  const vals = [appIdOf(req)];
  const where = ['ht.app_id=$1', 'ht.deleted_at IS NULL'];
  if (req.query.examId) where.push(`ht.exam_id=${bind(vals, num(req.query.examId))}`);
  if (req.query.sectionId) where.push(`st.section_id=${bind(vals, num(req.query.sectionId))}`);
  if (req.query.studentId) where.push(`ht.student_id=${bind(vals, num(req.query.studentId))}`);
  if (req.query.status) where.push(`ht.status=${bind(vals, text(req.query.status))}`);
  const rows = await execQ(getPool(), `
    SELECT ht.*, st.admission_no, st.first_name, st.last_name, st.roll_no,
           c.name AS class_name, sec.name AS section_name, e.name AS exam_name, h.name AS hall_name
    FROM school_hall_ticket ht
    JOIN school_students st ON st.id=ht.student_id
    LEFT JOIN school_classes c ON c.id=st.class_id
    LEFT JOIN school_sections sec ON sec.id=st.section_id
    LEFT JOIN school_exam e ON e.id=ht.exam_id
    LEFT JOIN school_exam_hall h ON h.id=ht.hall_id
    WHERE ${where.join(' AND ')}
    ORDER BY c.sort_order NULLS LAST, sec.name, st.roll_no NULLS LAST, st.first_name
  `, vals);
  res.json({ ok: true, tickets: rows });
});

examRouter.post('/exam/schedule/hall-tickets/generate', async (req, res) => {
  if (!guard(req, res, 'exam.schedule')) return;
  const appId = appIdOf(req);
  const b = req.body || {};
  const examId = num(b.examId);
  const sectionId = num(b.sectionId);
  if (!examId) return res.status(400).json({ error: 'examId is required' });
  const exam = (await execQ(getPool(), 'SELECT * FROM school_exam WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, examId]))[0];
  if (!exam) return res.status(404).json({ error: 'Exam not found' });
  const withholdFees = b.withholdFees === true;
  const withholdAttendance = b.withholdAttendance === true;
  const minAttendance = Number(b.minAttendance ?? 75);

  const students = sectionId
    ? await execQ(getPool(), `SELECT * FROM school_students WHERE app_id=$1 AND section_id=$2 AND status='active' AND deleted_at IS NULL ORDER BY roll_no NULLS LAST, first_name`, [appId, sectionId])
    : await execQ(getPool(), `
        SELECT DISTINCT st.* FROM school_students st
        JOIN school_exam_paper p ON p.class_id=st.class_id AND p.exam_id=$2 AND p.deleted_at IS NULL
        WHERE st.app_id=$1 AND st.status='active' AND st.deleted_at IS NULL
        ORDER BY st.class_id, st.section_id, st.roll_no NULLS LAST, st.first_name
      `, [appId, examId]);
  if (!students.length) return res.status(400).json({ error: 'No active students found for this exam.' });

  const ids = students.map((s) => s.id);
  const [dues, attendance] = await Promise.all([
    withholdFees ? feeDuesMap(appId, ids) : Promise.resolve(new Map()),
    withholdAttendance ? attendanceSummary(appId, ids) : Promise.resolve(new Map()),
  ]);

  const client = await getPool().connect();
  let issued = 0;
  let blocked = 0;
  try {
    await client.query('BEGIN');
    for (const student of students) {
      const reasons = [];
      if (withholdFees && (dues.get(student.id) || 0) > 0) reasons.push('fees');
      if (withholdAttendance) {
        const att = attendance.get(student.id);
        if (att && att.total_days > 0) {
          const pct = (att.present_days / att.total_days) * 100;
          if (pct < minAttendance) reasons.push('attendance');
        }
      }
      const status = reasons.length ? 'blocked' : 'issued';
      const existing = (await client.query(`
        SELECT id FROM school_hall_ticket
        WHERE app_id=$1 AND student_id=$2 AND exam_id=$3 AND slot_id IS NULL AND deleted_at IS NULL
        ORDER BY id DESC LIMIT 1
      `, [appId, student.id, examId])).rows[0];
      if (existing) {
        await client.query(`
          UPDATE school_hall_ticket SET status=$3, blocked_reason=$4, issued_at=CASE WHEN $3='issued' THEN now() ELSE issued_at END, updated_at=now()
          WHERE app_id=$1 AND id=$2
        `, [appId, existing.id, status, reasons.join(', ') || null]);
      } else {
        await client.query(`
          INSERT INTO school_hall_ticket (app_id, student_id, exam_id, slot_id, status, blocked_reason, issued_at)
          VALUES ($1,$2,$3,NULL,$4,$5,CASE WHEN $4='issued' THEN now() ELSE NULL END)
        `, [appId, student.id, examId, status, reasons.join(', ') || null]);
      }
      if (status === 'issued') issued++; else blocked++;
    }
    await client.query('COMMIT');
    await writeAudit(req, 'hall_tickets.generate', 'school_exam', examId, null, { issued, blocked, sectionId, withholdFees, withholdAttendance });
    res.json({ ok: true, total: students.length, issued, blocked });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

examRouter.post('/exam/schedule/hall-tickets/:id/block', async (req, res) => {
  if (!guard(req, res, 'exam.schedule')) return;
  const reason = text((req.body || {}).reason);
  if (!reason) return res.status(400).json({ error: 'A block reason is required' });
  const row = await execQ(getPool(), `
    UPDATE school_hall_ticket SET status='blocked', blocked_reason=$3, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), reason]);
  await writeAudit(req, 'hall_ticket.block', 'school_hall_ticket', num(req.params.id), null, { reason });
  res.json({ ok: true, ticket: row[0] });
});

examRouter.get('/exam/schedule/hall-tickets/:id/preview', async (req, res) => {
  if (!guard(req, res, 'exam.schedule')) return;
  const appId = appIdOf(req);
  const ticket = (await execQ(getPool(), `
    SELECT ht.*, st.admission_no, st.first_name, st.last_name, st.roll_no, st.class_id, st.section_id,
           c.name AS class_name, sec.name AS section_name, e.name AS exam_name, e.start_date, e.end_date, h.name AS hall_name
    FROM school_hall_ticket ht
    JOIN school_students st ON st.id=ht.student_id
    LEFT JOIN school_classes c ON c.id=st.class_id
    LEFT JOIN school_sections sec ON sec.id=st.section_id
    LEFT JOIN school_exam e ON e.id=ht.exam_id
    LEFT JOIN school_exam_hall h ON h.id=ht.hall_id
    WHERE ht.app_id=$1 AND ht.id=$2
  `, [appId, num(req.params.id)]))[0];
  if (!ticket) return res.status(404).send('Hall ticket not found');
  const slots = await execQ(getPool(), `
    SELECT s.date, s.start_time, s.end_time, sub.name AS subject_name, sec.name AS section_name,
           h.name AS hall_name, sa.seat_no
    FROM school_exam_slot s
    JOIN school_exam_paper p ON p.id=s.paper_id
    LEFT JOIN school_subjects sub ON sub.id=p.subject_id
    LEFT JOIN school_sections sec ON sec.id=s.section_id
    LEFT JOIN school_seat_allocation sa ON sa.slot_id=s.id AND sa.student_id=$3 AND sa.deleted_at IS NULL
    LEFT JOIN school_exam_hall h ON h.id=sa.hall_id
    WHERE s.app_id=$1 AND s.exam_id=$2 AND s.deleted_at IS NULL
      AND (s.section_id IS NULL OR s.section_id=$4)
    ORDER BY s.date, s.start_time
  `, [appId, ticket.exam_id, ticket.student_id, ticket.section_id]);
  const rows = slots.map((s) => `
    <tr><td>${escapeHtml(s.date)}</td><td>${escapeHtml(String(s.start_time).slice(0, 5))} â€“ ${escapeHtml(String(s.end_time).slice(0, 5))}</td>
    <td>${escapeHtml(s.subject_name || 'â€”')}</td><td>${escapeHtml(s.hall_name || 'â€”')}</td><td>${escapeHtml(s.seat_no || 'â€”')}</td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Hall Ticket â€” ${escapeHtml(ticket.first_name)}</title>
  <style>body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:24px;color:#1f2937}.ticket{max-width:760px;margin:0 auto;border:1px solid #94a3b8;border-radius:10px;padding:24px}
  .head{text-align:center;border-bottom:2px solid #0d6efd;padding-bottom:10px;margin-bottom:14px}.head h1{margin:0;font-size:20px;color:#0b3d91}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;font-size:13px;margin-bottom:14px}
  table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}th{background:#eff6ff}
  .blocked{color:#b91c1c;font-weight:700}.sig{display:flex;justify-content:space-between;margin-top:40px;font-size:12px}
  @media print{.no-print{display:none}}</style></head><body><div class="ticket">
  <div class="head"><h1>${escapeHtml(ticket.exam_name || 'Examination')}</h1><div>Hall Ticket</div></div>
  <div class="grid"><div><strong>Student:</strong> ${escapeHtml(ticket.first_name)} ${escapeHtml(ticket.last_name)}</div>
  <div><strong>Admission No:</strong> ${escapeHtml(ticket.admission_no)}</div>
  <div><strong>Class / Section:</strong> ${escapeHtml(ticket.class_name || 'â€”')} / ${escapeHtml(ticket.section_name || 'â€”')}</div>
  <div><strong>Roll No:</strong> ${escapeHtml(ticket.roll_no || 'â€”')}</div>
  <div><strong>Exam dates:</strong> ${escapeHtml(ticket.start_date || 'â€”')} to ${escapeHtml(ticket.end_date || 'â€”')}</div>
  <div><strong>Status:</strong> ${escapeHtml(ticket.status)}</div></div>
  ${ticket.status === 'blocked' ? `<div class="blocked">Blocked: ${escapeHtml(ticket.blocked_reason || '')}</div>` : ''}
  <table><thead><tr><th>Date</th><th>Time</th><th>Subject</th><th>Hall</th><th>Seat</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="5">No scheduled papers</td></tr>'}</tbody></table>
  <div class="sig"><div>Student Signature</div><div>Principal</div></div>
  <div class="no-print" style="margin-top:16px;text-align:center"><button onclick="window.print()">Print / Save as PDF</button></div>
  </div></body></html>`;
  res.type('html').send(html);
});

/* ============================================================
   15. RESULT VERSIONS
   ============================================================ */

function classBandFromSort(sortOrder) {
  const sort = Number(sortOrder);
  if (!Number.isFinite(sort)) return 'senior';
  if (sort <= 5) return 'primary';
  if (sort <= 9) return 'middle';
  return 'senior';
}

function roundPercent(value, roundingRule) {
  const n = Number(value) || 0;
  if (roundingRule === 'up') return Math.ceil(n);
  if (roundingRule === 'none') return Number(n.toFixed(2));
  return Math.round(n);
}

function pickGrade(percentage, bands) {
  const p = Number(percentage);
  if (!Number.isFinite(p) || !bands.length) return { grade: null, grade_points: null };
  const exact = bands.find((b) => p >= Number(b.min_percent) && p <= Number(b.max_percent));
  const found = exact || bands.filter((b) => p >= Number(b.min_percent)).sort((a, b) => Number(b.min_percent) - Number(a.min_percent))[0] || bands[0];
  return { grade: found.grade, grade_points: found.grade_points === null ? null : Number(found.grade_points) };
}

async function latestResultRule(appId, classBand) {
  return (await execQ(getPool(), `
    SELECT * FROM school_result_rule
    WHERE app_id=$1 AND class_band=$2 AND deleted_at IS NULL
    ORDER BY version DESC, effective_from DESC NULLS LAST, id DESC LIMIT 1
  `, [appId, classBand]))[0] || null;
}

async function gradeBandsFor(appId, classBand) {
  const scale = (await execQ(getPool(), `
    SELECT * FROM school_grade_scale
    WHERE app_id=$1 AND is_active=true AND deleted_at IS NULL
    ORDER BY effective_from DESC NULLS LAST, version DESC, id DESC LIMIT 1
  `, [appId]))[0] || null;
  if (!scale) return [];
  const exact = await execQ(getPool(), `
    SELECT * FROM school_grade_band
    WHERE app_id=$1 AND scale_id=$2 AND class_band=$3 AND deleted_at IS NULL
    ORDER BY min_percent DESC
  `, [appId, scale.id, classBand]);
  if (exact.length) return exact;
  return execQ(getPool(), `
    SELECT * FROM school_grade_band
    WHERE app_id=$1 AND scale_id=$2 AND deleted_at IS NULL
    ORDER BY min_percent DESC
  `, [appId, scale.id]);
}

async function buildResultChecks(appId, version) {
  const checks = [];
  if (!version?.exam_id) {
    checks.push({ severity: 'error', code: 'no_exam', message: 'This version is not linked to an exam.' });
    return { checks, ok: false };
  }
  const sheets = await execQ(getPool(), `
    SELECT ms.id, ms.state, ms.section_id, ms.paper_id, c.name AS class_name, sec.name AS section_name,
           sub.name AS subject_name, p.max_marks
    FROM school_marks_sheet ms
    JOIN school_exam_paper p ON p.id=ms.paper_id
    JOIN school_classes c ON c.id=p.class_id
    JOIN school_sections sec ON sec.id=ms.section_id
    JOIN school_subjects sub ON sub.id=p.subject_id
    WHERE ms.app_id=$1 AND ms.exam_id=$2 AND ms.deleted_at IS NULL
    ORDER BY c.name, sec.name, sub.name
  `, [appId, version.exam_id]);
  const unlocked = sheets.filter((s) => s.state !== 'locked');
  if (!sheets.length) {
    checks.push({ severity: 'error', code: 'no_sheets', message: 'No marks sheets exist for this exam. Create sheets and enter marks first.', count: 0, items: [] });
  } else if (unlocked.length) {
    checks.push({
      severity: 'error', code: 'unlocked_sheets', message: `${unlocked.length} marks sheet(s) are not locked.`,
      count: unlocked.length,
      items: unlocked.slice(0, 25).map((s) => `${s.class_name} / ${s.section_name} / ${s.subject_name} (${s.state})`),
    });
  }
  const [missing] = await execQ(getPool(), `
    SELECT COUNT(*)::int AS c
    FROM school_students st
    JOIN school_exam_paper p ON p.class_id=st.class_id AND p.exam_id=$2 AND p.deleted_at IS NULL
    CROSS JOIN school_paper_component pc
    WHERE st.app_id=$1 AND st.status='active' AND st.deleted_at IS NULL
      AND pc.app_id=$1 AND pc.paper_id=p.id AND pc.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM school_marks_sheet ms
        JOIN school_mark_entry me ON me.sheet_id=ms.id AND me.student_id=st.id AND me.component_id=pc.id
        WHERE ms.app_id=$1 AND ms.exam_id=$2 AND ms.paper_id=p.id AND ms.section_id=st.section_id
          AND ms.deleted_at IS NULL AND me.deleted_at IS NULL
          AND (me.marks IS NOT NULL OR me.status_code IS NOT NULL)
      )
  `, [appId, version.exam_id]);
  if (missing?.c) checks.push({ severity: 'warning', code: 'missing_marks', message: `${missing.c} mark entry(ies) are missing.`, count: missing.c, items: [] });
  const [resultCount] = await execQ(getPool(), 'SELECT COUNT(*)::int AS c FROM school_student_result WHERE app_id=$1 AND version_id=$2 AND deleted_at IS NULL', [appId, version.id]);
  if (!resultCount?.c) checks.push({ severity: 'error', code: 'no_results', message: 'No student results have been processed for this version.', count: 0, items: [] });
  return { checks, ok: !checks.some((c) => c.severity === 'error') };
}

async function processResultVersion(req, versionId) {
  const appId = appIdOf(req);
  const version = (await execQ(getPool(), 'SELECT * FROM school_result_version WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, versionId]))[0];
  if (!version) return { status: 404, body: { error: 'Result version not found' } };
  if (['published', 'frozen'].includes(version.status)) return { status: 409, body: { error: 'Published/frozen versions cannot be reprocessed. Create a new version instead.', version } };
  if (!version.exam_id) return { status: 400, body: { error: 'Result processing currently requires a version linked to an exam.' } };

  const checksBefore = await buildResultChecks(appId, version);
  const hardErrors = checksBefore.checks.filter((c) => c.severity === 'error' && c.code !== 'no_results');
  if (hardErrors.length) return { status: 409, body: { error: hardErrors[0].message, checks: checksBefore.checks } };

  const ruleRow = version.rule_version_id
    ? (await execQ(getPool(), 'SELECT * FROM school_result_rule WHERE app_id=$1 AND id=$2', [appId, version.rule_version_id]))[0]
    : await latestResultRule(appId, version.class_band);
  const rule = ruleRow || {};
  const passRule = rule.pass_rule || { per_subject: 33, aggregate: 33, both_required: true };
  const graceRule = rule.grace_rule || { enabled: false };
  const compartmentRule = rule.compartment_rule || { allowed: true, max_failed_subjects: 2 };
  const rankRule = rule.rank_rule || { enabled: true, scope: 'section', tie: 'same_rank' };
  const roundingRule = rule.rounding_rule || 'nearest';
  const bands = await gradeBandsFor(appId, version.class_band);

  const papers = await execQ(getPool(), `
    SELECT p.*, sub.name AS subject_name, c.sort_order AS class_sort
    FROM school_exam_paper p
    LEFT JOIN school_subjects sub ON sub.id=p.subject_id
    LEFT JOIN school_classes c ON c.id=p.class_id
    WHERE p.app_id=$1 AND p.exam_id=$2 AND p.deleted_at IS NULL
    ORDER BY c.sort_order NULLS LAST, sub.name
  `, [appId, version.exam_id]);
  const components = await execQ(getPool(), `
    SELECT pc.* FROM school_paper_component pc
    JOIN school_exam_paper p ON p.id=pc.paper_id
    WHERE pc.app_id=$1 AND p.exam_id=$2 AND pc.deleted_at IS NULL
    ORDER BY pc.sort_order, pc.id
  `, [appId, version.exam_id]);
  const componentsByPaper = new Map();
  for (const c of components) {
    if (!componentsByPaper.has(c.paper_id)) componentsByPaper.set(c.paper_id, []);
    componentsByPaper.get(c.paper_id).push(c);
  }
  const students = await execQ(getPool(), `
    SELECT DISTINCT st.id, st.admission_no, st.first_name, st.last_name, st.roll_no, st.class_id, st.section_id
    FROM school_students st
    JOIN school_exam_paper p ON p.class_id=st.class_id AND p.exam_id=$2 AND p.deleted_at IS NULL
    WHERE st.app_id=$1 AND st.status='active' AND st.deleted_at IS NULL
    ORDER BY st.class_id, st.section_id, st.roll_no NULLS LAST, st.first_name
  `, [appId, version.exam_id]);
  if (!students.length) return { status: 400, body: { error: 'No active students are enrolled in the classes covered by this exam.' } };

  const entries = await execQ(getPool(), `
    SELECT me.student_id, me.component_id, me.marks, me.status_code, ms.paper_id
    FROM school_mark_entry me
    JOIN school_marks_sheet ms ON ms.id=me.sheet_id
    WHERE me.app_id=$1 AND ms.exam_id=$2 AND me.deleted_at IS NULL AND ms.deleted_at IS NULL
  `, [appId, version.exam_id]);
  const entryMap = new Map(entries.map((e) => [`${e.paper_id}|${e.student_id}|${e.component_id}`, e]));
  const subjectChoices = await execQ(getPool(), 'SELECT * FROM school_student_subject WHERE app_id=$1 AND deleted_at IS NULL', [appId]);
  const choiceMap = new Map(subjectChoices.map((s) => [`${s.student_id}|${s.subject_id}`, s]));

  const processed = [];
  for (const student of students) {
    const studentPapers = papers.filter((p) => Number(p.class_id) === Number(student.class_id));
    const subjects = [];
    let graceTotal = 0;
    let withheld = false;
    let incomplete = false;

    for (const paper of studentPapers) {
      const comps = componentsByPaper.get(paper.id) || [];
      let marks = 0;
      let missing = false;
      let blocked = false;
      let worstCode = null;
      if (!comps.length) {
        missing = true;
      } else {
        for (const comp of comps) {
          const entry = entryMap.get(`${paper.id}|${student.id}|${comp.id}`);
          if (!entry || (entry.marks === null && !entry.status_code)) { missing = true; continue; }
          if (entry.status_code) {
            blocked = true;
            if (!worstCode || ['WH', 'UFM'].includes(entry.status_code)) worstCode = entry.status_code;
          } else {
            marks += Number(entry.marks || 0);
          }
        }
      }
      let outcome = 'pass';
      if (blocked) {
        outcome = ['WH', 'UFM'].includes(worstCode) ? 'withheld' : 'incomplete';
      } else if (missing) {
        outcome = 'incomplete';
      } else if (marks < Number(paper.pass_marks || passRule.per_subject || 0)) {
        outcome = 'fail';
      }
      let grace = 0;
      if (outcome === 'fail' && graceRule.enabled) {
        const maxPer = Number(graceRule.max_per_subject || 0);
        const maxTotal = Number(graceRule.max_total || 0);
        const threshold = Number(graceRule.close_threshold || 0);
        const needed = Number(paper.pass_marks || passRule.per_subject || 0) - marks;
        if (needed > 0 && needed <= threshold && graceTotal < maxTotal) {
          grace = Math.min(needed, maxPer, maxTotal - graceTotal);
          if (grace > 0) {
            marks += grace;
            graceTotal += grace;
            if (marks >= Number(paper.pass_marks || passRule.per_subject || 0)) outcome = 'pass';
          }
        }
      }
      if (outcome === 'withheld') withheld = true;
      if (outcome === 'incomplete') incomplete = true;
      const maxMarks = Number(paper.max_marks) || 0;
      const percentage = maxMarks ? Number(((marks / maxMarks) * 100).toFixed(2)) : 0;
      const grade = pickGrade(percentage, bands);
      const choice = choiceMap.get(`${student.id}|${paper.subject_id}`);
      subjects.push({
        paper_id: paper.id,
        subject_id: paper.subject_id,
        marks_obtained: Number(marks.toFixed(2)),
        max_marks: maxMarks,
        percentage,
        grade: grade.grade,
        grade_points: grade.grade_points,
        outcome,
        grace_marks: grace,
        is_additional: Boolean(choice?.is_additional),
        counts_in_total: paper.counts_in_total !== false && paper.optional_subject !== true && !choice?.is_additional,
      });
    }

    const counted = subjects.filter((s) => s.counts_in_total);
    const total = counted.reduce((sum, s) => sum + s.marks_obtained, 0);
    const maxTotal = counted.reduce((sum, s) => sum + s.max_marks, 0);
    const percentage = roundPercent(maxTotal ? (total / maxTotal) * 100 : 0, roundingRule);
    const failed = counted.filter((s) => s.outcome === 'fail').length;
    const aggregatePass = Number(passRule.aggregate || 0);
    let outcome = 'pass';
    if (withheld) outcome = 'withheld';
    else if (incomplete) outcome = 'incomplete';
    else if (failed === 0 && (percentage >= aggregatePass || !aggregatePass)) outcome = 'pass';
    else if (compartmentRule.allowed !== false && failed <= Number(compartmentRule.max_failed_subjects || 0) && percentage >= aggregatePass) outcome = 'compartment';
    else outcome = 'fail';
    const grade = pickGrade(percentage, bands);
    processed.push({
      student_id: student.id,
      section_id: student.section_id,
      class_id: student.class_id,
      total_marks: Number(total.toFixed(2)),
      max_total_marks: maxTotal,
      percentage,
      grade: grade.grade,
      grade_points: grade.grade_points,
      outcome,
      grace_total: Number(graceTotal.toFixed(2)),
      subjects,
      rank: null,
    });
  }

  // Rank within the configured scope. Ties share the same rank.
  if (rankRule.enabled !== false) {
    const scope = rankRule.scope || 'section';
    const groups = new Map();
    for (const row of processed) {
      if (['withheld', 'incomplete'].includes(row.outcome)) continue;
      const key = scope === 'school' ? 'school' : scope === 'class' ? String(row.class_id) : `${row.class_id}-${row.section_id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    for (const group of groups.values()) {
      group.sort((a, b) => b.total_marks - a.total_marks || b.percentage - a.percentage);
      let lastTotal = null;
      let lastRank = 0;
      group.forEach((row, index) => {
        if (lastTotal !== null && row.total_marks === lastTotal) row.rank = lastRank;
        else { row.rank = index + 1; lastRank = row.rank; lastTotal = row.total_marks; }
      });
    }
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM school_student_result WHERE app_id=$1 AND version_id=$2', [appId, version.id]);
    for (const row of processed) {
      const inserted = (await client.query(`
        INSERT INTO school_student_result
          (app_id, version_id, student_id, total_marks, max_total_marks, percentage, grade, grade_points, rank, outcome, grace_total)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id
      `, [appId, version.id, row.student_id, row.total_marks, row.max_total_marks, row.percentage, row.grade, row.grade_points, row.rank, row.outcome, row.grace_total])).rows[0];
      for (const subject of row.subjects) {
        const subjectRow = (await client.query(`
          INSERT INTO school_subject_result
            (app_id, student_result_id, paper_id, subject_id, marks_obtained, max_marks, percentage, grade, grade_points, outcome, grace_marks, is_additional, counts_in_total)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id
        `, [appId, inserted.id, subject.paper_id, subject.subject_id, subject.marks_obtained, subject.max_marks, subject.percentage, subject.grade, subject.grade_points, subject.outcome, subject.grace_marks, subject.is_additional, subject.counts_in_total])).rows[0];
        if (subject.grace_marks > 0) {
          await client.query(`
            INSERT INTO school_grace_mark (app_id, subject_result_id, marks, rule_applied, reason, approved_by)
            VALUES ($1,$2,$3,$4,$5,$6)
          `, [appId, subjectRow.id, subject.grace_marks, 'auto_grace', 'Applied by result engine within configured grace rule', text(req.user?.userid)]);
        }
      }
    }
    await client.query(`
      UPDATE school_result_version
      SET status='processed', checks_passed=true, rule_version_id=COALESCE(rule_version_id,$3),
          processed_by=$1, processed_at=now(), updated_at=now()
      WHERE app_id=$2 AND id=$4
    `, [text(req.user?.userid), appId, ruleRow?.id || null, version.id]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  const summary = processed.reduce((agg, row) => {
    agg[row.outcome] = (agg[row.outcome] || 0) + 1;
    return agg;
  }, { pass: 0, fail: 0, compartment: 0, withheld: 0, incomplete: 0 });
  await writeAudit(req, 'result_version.process', 'school_result_version', version.id,
    { status: version.status }, { status: 'processed', students: processed.length, summary });
  return {
    status: 200,
    body: {
      ok: true,
      processed: processed.length,
      summary,
      rule_version_id: ruleRow?.id || null,
      checks: (await buildResultChecks(appId, { ...version, status: 'processed' })).checks,
    },
  };
}

examRouter.get('/exam/result-versions', async (req, res) => {
  if (!guard(req, res, 'exam.results')) return;
  const examId = num(req.query.examId);
  const where = ['rv.app_id=$1', 'rv.deleted_at IS NULL'];
  const vals = [appIdOf(req)];
  if (examId) { vals.push(examId); where.push(`rv.exam_id=$${vals.length}`); }
  const rows = await execQ(getPool(), `
    SELECT rv.*, e.name AS exam_name, t.name AS term_name
    FROM school_result_version rv
    LEFT JOIN school_exam e ON e.id=rv.exam_id
    LEFT JOIN school_term t ON t.id=rv.term_id
    WHERE ${where.join(' AND ')}
    ORDER BY rv.created_at DESC
  `, vals);
  res.json({ ok: true, versions: rows });
});

examRouter.post('/exam/result-versions', async (req, res) => {
  if (!guard(req, res, 'exam.results')) return;
  const b = req.body || {};
  const appId = appIdOf(req);
  const examId = num(b.examId);
  if (!examId) return res.status(400).json({ error: 'examId is required' });
  const exam = (await execQ(getPool(), 'SELECT * FROM school_exam WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, examId]))[0];
  if (!exam) return res.status(404).json({ error: 'Exam not found' });
  const firstClass = (await execQ(getPool(), `
    SELECT c.sort_order FROM school_exam_paper p JOIN school_classes c ON c.id=p.class_id
    WHERE p.app_id=$1 AND p.exam_id=$2 AND p.deleted_at IS NULL
    ORDER BY c.sort_order NULLS LAST, c.name LIMIT 1
  `, [appId, examId]))[0];
  const classBand = text(b.classBand) || classBandFromSort(firstClass?.sort_order);
  const versionNo = (await execQ(getPool(), 'SELECT COALESCE(MAX(version_no),0)+1 AS next FROM school_result_version WHERE app_id=$1 AND exam_id=$2', [appId, examId]))[0]?.next || 1;
  const rule = await latestResultRule(appId, classBand);
  const row = (await execQ(getPool(), `
    INSERT INTO school_result_version (app_id, exam_id, term_id, class_band, version_no, rule_version_id, status)
    VALUES ($1,$2,$3,$4,$5,$6,'draft') RETURNING *
  `, [appId, examId, exam.term_id, classBand, versionNo, rule?.id || null]))[0];
  await writeAudit(req, 'result_version.create', 'school_result_version', row.id, null, { examId, classBand, versionNo });
  res.json({ ok: true, version: row });
});

examRouter.get('/exam/result-versions/:id', async (req, res) => {
  if (!guard(req, res, 'exam.results')) return;
  const [version] = await execQ(getPool(), `
    SELECT rv.*, e.name AS exam_name, t.name AS term_name, r.weightage_scheme, r.best_of_rule, r.pass_rule, r.grace_rule, r.rounding_rule, r.rank_rule
    FROM school_result_version rv
    LEFT JOIN school_exam e ON e.id=rv.exam_id
    LEFT JOIN school_term t ON t.id=rv.term_id
    LEFT JOIN school_result_rule r ON r.id=rv.rule_version_id
    WHERE rv.app_id=$1 AND rv.id=$2
  `, [appIdOf(req), num(req.params.id)]);
  if (!version) return res.status(404).json({ error: 'Result version not found' });
  res.json({ ok: true, version });
});

examRouter.get('/exam/result-versions/:id/students', async (req, res) => {
  if (!guard(req, res, 'exam.results')) return;
  const versionId = num(req.params.id);
  const [version] = await execQ(getPool(), 'SELECT * FROM school_result_version WHERE app_id=$1 AND id=$2', [appIdOf(req), versionId]);
  if (!version) return res.status(404).json({ error: 'Result version not found' });
  const rows = await execQ(getPool(), `
    SELECT sr.*, s.admission_no, s.first_name, s.last_name, s.roll_no, s.section_id
    FROM school_student_result sr
    JOIN school_students s ON s.id=sr.student_id AND s.app_id=sr.app_id
    WHERE sr.app_id=$1 AND sr.version_id=$2
    ORDER BY s.roll_no NULLS LAST, s.first_name
  `, [appIdOf(req), versionId]);
  res.json({ ok: true, students: rows });
});

examRouter.get('/exam/result-versions/:id/subject-results', async (req, res) => {
  if (!guard(req, res, 'exam.results')) return;
  const appId = appIdOf(req);
  const versionId = num(req.params.id);
  const vals = [appId, versionId];
  const where = ['subres.app_id=$1', 'sr.version_id=$2', 'subres.deleted_at IS NULL'];
  if (req.query.studentId) where.push(`sr.student_id=${bind(vals, num(req.query.studentId))}`);
  if (req.query.sectionId) where.push(`st.section_id=${bind(vals, num(req.query.sectionId))}`);
  const rows = await execQ(getPool(), `
    SELECT subres.*, sub.name AS subject_name, p.max_marks AS paper_max_marks, sr.student_id,
           st.admission_no, st.first_name, st.last_name, st.roll_no
    FROM school_subject_result subres
    JOIN school_student_result sr ON sr.id=subres.student_result_id
    JOIN school_students st ON st.id=sr.student_id AND st.app_id=sr.app_id
    LEFT JOIN school_subjects sub ON sub.id=subres.subject_id
    LEFT JOIN school_exam_paper p ON p.id=subres.paper_id
    WHERE ${where.join(' AND ')}
    ORDER BY st.roll_no NULLS LAST, st.first_name, sub.name
  `, vals);
  res.json({ ok: true, subjectResults: rows });
});

examRouter.get('/exam/result-versions/:id/checks', async (req, res) => {
  if (!guard(req, res, 'exam.results')) return;
  const appId = appIdOf(req);
  const version = (await execQ(getPool(), 'SELECT * FROM school_result_version WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, num(req.params.id)]))[0];
  if (!version) return res.status(404).json({ error: 'Result version not found' });
  const checks = await buildResultChecks(appId, version);
  res.json({ ok: true, ...checks, version });
});

examRouter.post('/exam/result-versions/:id/process', async (req, res) => {
  if (!guard(req, res, 'exam.results')) return;
  try {
    const result = await processResultVersion(req, num(req.params.id));
    res.status(result.status).json(result.body);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Result processing failed' });
  }
});

examRouter.post('/exam/result-versions/:id/publish', async (req, res) => {
  if (!guard(req, res, 'exam.results')) return;
  const appId = appIdOf(req);
  const versionId = num(req.params.id);
  const version = (await execQ(getPool(), 'SELECT * FROM school_result_version WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, versionId]))[0];
  if (!version) return res.status(404).json({ error: 'Result version not found' });
  if (version.status === 'published') return res.json({ ok: true, alreadyPublished: true, version });
  if (version.status === 'frozen') return res.status(409).json({ error: 'Frozen versions cannot be published again.' });
  if (version.status !== 'processed') return res.status(409).json({ error: 'Process results before publishing.', status: version.status });
  const checks = await buildResultChecks(appId, version);
  if (!checks.ok) return res.status(409).json({ error: 'Pre-publish checks failed', checks: checks.checks });

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const updated = (await client.query(`
      UPDATE school_result_version
      SET status='published', published_by=$1, published_at=now(), checks_passed=true, updated_at=now()
      WHERE app_id=$2 AND id=$3 AND status='processed' RETURNING *
    `, [text(req.user.userid), appId, versionId])).rows[0];
    if (!updated) throw new Error('Version changed while publishing. Reload and try again.');
    if (version.exam_id) {
      await client.query(`UPDATE school_exam SET status='published', updated_at=now() WHERE app_id=$1 AND id=$2`, [appId, version.exam_id]);
    }
    await client.query(`
      INSERT INTO school_integration_outbox (app_id, event_type, aggregate_type, aggregate_id, payload, status)
      VALUES ($1,'result.published','school_result_version',$2,$3,'pending')
    `, [appId, String(versionId), JSON.stringify({ versionId, examId: version.exam_id, classBand: version.class_band, publishedBy: req.user.userid })]);
    await client.query('COMMIT');
    await writeAudit(req, 'result_version.publish', 'school_result_version', versionId, { status: 'processed' }, { status: 'published' });
    res.json({ ok: true, published: true, version: updated, checks: checks.checks });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

/* ============================================================
   15. REPORTS
   ============================================================ */

const EXAM_REPORT_CATALOG = [
  { key: 'date-sheet', title: 'Date Sheet by Class', group: 'Schedule' },
  { key: 'teacher-duty', title: 'Teacher Duty Chart', group: 'Schedule' },
  { key: 'seating-plan', title: 'Seating Plan', group: 'Schedule' },
  { key: 'marks-entry-status', title: 'Marks Entry Status', group: 'Marks' },
  { key: 'consolidated-marks', title: 'Consolidated Mark Sheet', group: 'Marks' },
  { key: 'absentees', title: 'Absentees in Exams', group: 'Marks' },
  { key: 'class-result-sheet', title: 'Class Result Sheet', group: 'Results' },
  { key: 'subject-analysis', title: 'Subject-wise Analysis', group: 'Results' },
  { key: 'merit-list', title: 'Merit List / Toppers', group: 'Results' },
  { key: 'fail-compartment-list', title: 'Fail & Compartment List', group: 'Results' },
  { key: 'grace-marks', title: 'Grace Marks Report', group: 'Results' },
  { key: 'teacher-pass-percent', title: 'Teacher-wise Pass %', group: 'Results' },
  { key: 'term-comparison', title: 'Term Comparison', group: 'Analysis' },
  { key: 'student-performance-history', title: 'Student Performance History', group: 'Analysis' },
  { key: 're-evaluation', title: 'Re-evaluation Report', group: 'Analysis' },
  { key: 'promotion-list', title: 'Promotion List', group: 'Analysis' },
  { key: 'board-export', title: 'Board Export', group: 'Analysis' },
];

function reportMeta(req, filters = {}) {
  const clean = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== null && value !== undefined && value !== ''));
  return { generatedAt: new Date().toISOString(), generatedBy: req.user?.userid || null, filters: clean };
}

function bind(vals, value) {
  vals.push(value);
  return `$${vals.length}`;
}

async function findReportVersion(req, query) {
  const appId = appIdOf(req);
  if (query.versionId) {
    return (await execQ(getPool(), 'SELECT * FROM school_result_version WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, num(query.versionId)]))[0] || null;
  }
  if (query.examId) {
    return (await execQ(getPool(), `
      SELECT * FROM school_result_version WHERE app_id=$1 AND exam_id=$2 AND deleted_at IS NULL
      ORDER BY CASE status WHEN 'published' THEN 0 WHEN 'processed' THEN 1 ELSE 2 END, version_no DESC LIMIT 1
    `, [appId, num(query.examId)]))[0] || null;
  }
  return (await execQ(getPool(), `
    SELECT * FROM school_result_version WHERE app_id=$1 AND deleted_at IS NULL
    ORDER BY CASE status WHEN 'published' THEN 0 WHEN 'processed' THEN 1 ELSE 2 END, created_at DESC LIMIT 1
  `, [appId]))[0] || null;
}

examRouter.get('/exam/reports', async (req, res) => {
  if (!guard(req, res, 'exam.results')) return;
  res.json({ ok: true, reportTypes: EXAM_REPORT_CATALOG });
});

examRouter.get('/exam/reports/:reportType', async (req, res) => {
  if (!guard(req, res, 'exam.results')) return;
  const type = text(req.params.reportType);
  const known = EXAM_REPORT_CATALOG.find((r) => r.key === type);
  if (!known) return res.status(404).json({ error: `Unknown report type: ${type}` });
  const appId = appIdOf(req);
  const q = req.query || {};
  const filters = {
    examId: num(q.examId), versionId: num(q.versionId), classId: num(q.classId), sectionId: num(q.sectionId),
    fromDate: dayOf(q.fromDate), toDate: dayOf(q.toDate), studentId: num(q.studentId), hallId: num(q.hallId),
  };

  try {
    let columns = [];
    let rows = [];

    if (type === 'date-sheet') {
      const vals = [appId];
      const where = ['s.app_id=$1', 's.deleted_at IS NULL'];
      if (filters.examId) where.push(`s.exam_id=${bind(vals, filters.examId)}`);
      if (filters.classId) where.push(`p.class_id=${bind(vals, filters.classId)}`);
      if (filters.sectionId) where.push(`s.section_id=${bind(vals, filters.sectionId)}`);
      if (filters.fromDate) where.push(`s.date >= ${bind(vals, filters.fromDate)}`);
      if (filters.toDate) where.push(`s.date <= ${bind(vals, filters.toDate)}`);
      rows = await execQ(getPool(), `
        SELECT s.id, e.name AS exam, c.name AS class_name, sec.name AS section_name, sub.name AS subject,
               s.date, s.start_time, s.end_time, s.status
        FROM school_exam_slot s
        JOIN school_exam e ON e.id=s.exam_id
        JOIN school_exam_paper p ON p.id=s.paper_id
        LEFT JOIN school_classes c ON c.id=p.class_id
        LEFT JOIN school_sections sec ON sec.id=s.section_id
        LEFT JOIN school_subjects sub ON sub.id=p.subject_id
        WHERE ${where.join(' AND ')}
        ORDER BY s.date, s.start_time, c.sort_order NULLS LAST, sec.name, sub.name
      `, vals);
      columns = [
        ['exam', 'Exam'], ['class_name', 'Class'], ['section_name', 'Section'], ['subject', 'Subject'],
        ['date', 'Date'], ['start_time', 'Start'], ['end_time', 'End'], ['status', 'Status'],
      ].map(([key, label]) => ({ key, label }));
    } else if (type === 'teacher-duty') {
      const vals = [appId];
      const where = ['i.app_id=$1', 'i.deleted_at IS NULL', 's.deleted_at IS NULL'];
      if (filters.examId) where.push(`s.exam_id=${bind(vals, filters.examId)}`);
      if (filters.fromDate) where.push(`s.date >= ${bind(vals, filters.fromDate)}`);
      if (filters.toDate) where.push(`s.date <= ${bind(vals, filters.toDate)}`);
      rows = await execQ(getPool(), `
        SELECT i.id, COALESCE(NULLIF(TRIM(t.first_name || ' ' || t.last_name), ''), i.user_id, 'â€”') AS teacher,
               t.employee_no, s.date, s.start_time, s.end_time, h.name AS hall, sub.name AS subject,
               i.role, i.status
        FROM school_invigilation i
        JOIN school_exam_slot s ON s.id=i.slot_id
        JOIN school_exam_paper p ON p.id=s.paper_id
        LEFT JOIN school_subjects sub ON sub.id=p.subject_id
        LEFT JOIN school_exam_hall h ON h.id=i.hall_id
        LEFT JOIN school_hr_employees t ON t.id=i.teacher_id
        WHERE ${where.join(' AND ')}
        ORDER BY s.date, s.start_time, teacher
      `, vals);
      columns = [
        ['date', 'Date'], ['start_time', 'Start'], ['end_time', 'End'], ['teacher', 'Teacher'],
        ['employee_no', 'Employee No'], ['hall', 'Hall'], ['subject', 'Subject'], ['role', 'Role'], ['status', 'Status'],
      ].map(([key, label]) => ({ key, label }));
    } else if (type === 'seating-plan') {
      const vals = [appId];
      const where = ['sa.app_id=$1', 'sa.deleted_at IS NULL', 's.deleted_at IS NULL'];
      if (filters.examId) where.push(`s.exam_id=${bind(vals, filters.examId)}`);
      if (filters.sectionId) where.push(`s.section_id=${bind(vals, filters.sectionId)}`);
      if (filters.hallId) where.push(`sa.hall_id=${bind(vals, filters.hallId)}`);
      if (filters.fromDate) where.push(`s.date >= ${bind(vals, filters.fromDate)}`);
      if (filters.toDate) where.push(`s.date <= ${bind(vals, filters.toDate)}`);
      rows = await execQ(getPool(), `
        SELECT sa.id, s.date, sub.name AS subject, h.name AS hall, sa.seat_no, sa.row_no, sa.col_no,
               st.admission_no, st.first_name || ' ' || st.last_name AS student, c.name AS class_name, sec.name AS section_name
        FROM school_seat_allocation sa
        JOIN school_exam_slot s ON s.id=sa.slot_id
        JOIN school_exam_paper p ON p.id=s.paper_id
        LEFT JOIN school_subjects sub ON sub.id=p.subject_id
        LEFT JOIN school_exam_hall h ON h.id=sa.hall_id
        JOIN school_students st ON st.id=sa.student_id
        LEFT JOIN school_classes c ON c.id=st.class_id
        LEFT JOIN school_sections sec ON sec.id=st.section_id
        WHERE ${where.join(' AND ')}
        ORDER BY s.date, s.start_time, h.name, sa.row_no, sa.col_no
      `, vals);
      columns = [
        ['date', 'Date'], ['subject', 'Subject'], ['hall', 'Hall'], ['seat_no', 'Seat'], ['admission_no', 'Admission No'],
        ['student', 'Student'], ['class_name', 'Class'], ['section_name', 'Section'],
      ].map(([key, label]) => ({ key, label }));
    } else if (type === 'marks-entry-status') {
      const vals = [appId];
      const where = ['ms.app_id=$1', 'ms.deleted_at IS NULL'];
      if (filters.examId) where.push(`ms.exam_id=${bind(vals, filters.examId)}`);
      if (filters.sectionId) where.push(`ms.section_id=${bind(vals, filters.sectionId)}`);
      if (filters.classId) where.push(`p.class_id=${bind(vals, filters.classId)}`);
      rows = await execQ(getPool(), `
        SELECT ms.id, e.name AS exam, c.name AS class_name, sec.name AS section_name, sub.name AS subject,
               p.max_marks, ms.state, ms.deadline,
               (SELECT COUNT(*) FROM school_mark_entry me WHERE me.sheet_id=ms.id AND me.deleted_at IS NULL) AS entries,
               ms.submitted_at, ms.verified_at, ms.locked_at
        FROM school_marks_sheet ms
        JOIN school_exam e ON e.id=ms.exam_id
        JOIN school_exam_paper p ON p.id=ms.paper_id
        JOIN school_classes c ON c.id=p.class_id
        JOIN school_sections sec ON sec.id=ms.section_id
        JOIN school_subjects sub ON sub.id=p.subject_id
        WHERE ${where.join(' AND ')}
        ORDER BY e.start_date NULLS LAST, c.sort_order NULLS LAST, c.name, sec.name, sub.name
      `, vals);
      columns = [
        ['exam', 'Exam'], ['class_name', 'Class'], ['section_name', 'Section'], ['subject', 'Subject'],
        ['max_marks', 'Max'], ['state', 'State'], ['entries', 'Entries'], ['deadline', 'Deadline'],
        ['submitted_at', 'Submitted'], ['verified_at', 'Verified'], ['locked_at', 'Locked'],
      ].map(([key, label]) => ({ key, label }));
    } else if (type === 'consolidated-marks') {
      const version = await findReportVersion(req, q);
      if (!version) return res.status(400).json({ error: 'No result version found for the selected filters' });
      rows = await execQ(getPool(), `
        SELECT sr.id, st.admission_no, st.first_name || ' ' || st.last_name AS student,
               c.name AS class_name, sec.name AS section_name, sub.name AS subject,
               subres.max_marks, subres.marks_obtained, subres.grace_marks, subres.percentage,
               subres.grade, subres.outcome,
               sr.total_marks, sr.max_total_marks, sr.percentage AS overall_percentage, sr.grade AS overall_grade,
               sr.rank, sr.outcome AS overall_outcome
        FROM school_subject_result subres
        JOIN school_student_result sr ON sr.id=subres.student_result_id
        JOIN school_students st ON st.id=sr.student_id
        LEFT JOIN school_classes c ON c.id=st.class_id
        LEFT JOIN school_sections sec ON sec.id=st.section_id
        LEFT JOIN school_exam_paper p ON p.id=subres.paper_id
        LEFT JOIN school_subjects sub ON sub.id=COALESCE(subres.subject_id, p.subject_id)
        WHERE subres.app_id=$1 AND sr.version_id=$2 AND subres.deleted_at IS NULL
        ORDER BY c.sort_order NULLS LAST, sec.name, st.roll_no NULLS LAST, st.first_name, sub.name
      `, [appId, version.id]);
      columns = [
        ['admission_no', 'Admission No'], ['student', 'Student'], ['class_name', 'Class'], ['section_name', 'Section'],
        ['subject', 'Subject'], ['max_marks', 'Max'], ['marks_obtained', 'Marks'], ['grace_marks', 'Grace'],
        ['percentage', 'Subject %'], ['grade', 'Subject Grade'], ['outcome', 'Subject Outcome'],
        ['total_marks', 'Total'], ['max_total_marks', 'Max Total'], ['overall_percentage', 'Overall %'],
        ['overall_grade', 'Overall Grade'], ['rank', 'Rank'], ['overall_outcome', 'Overall Outcome'],
      ].map(([key, label]) => ({ key, label }));
    } else if (type === 'absentees') {
      const vals = [appId];
      const where = [`me.app_id=$1`, `me.deleted_at IS NULL`, `me.status_code IN ('AB','ML','EX','UFM','WH')`];
      if (filters.examId) where.push(`ms.exam_id=${bind(vals, filters.examId)}`);
      if (filters.sectionId) where.push(`ms.section_id=${bind(vals, filters.sectionId)}`);
      rows = await execQ(getPool(), `
        SELECT me.id, e.name AS exam, c.name AS class_name, sec.name AS section_name, sub.name AS subject,
               pc.name AS component, st.admission_no, st.first_name || ' ' || st.last_name AS student,
               me.status_code, me.updated_by, me.updated_at
        FROM school_mark_entry me
        JOIN school_marks_sheet ms ON ms.id=me.sheet_id
        JOIN school_exam e ON e.id=ms.exam_id
        JOIN school_exam_paper p ON p.id=ms.paper_id
        JOIN school_classes c ON c.id=p.class_id
        JOIN school_sections sec ON sec.id=ms.section_id
        JOIN school_subjects sub ON sub.id=p.subject_id
        LEFT JOIN school_paper_component pc ON pc.id=me.component_id
        JOIN school_students st ON st.id=me.student_id
        WHERE ${where.join(' AND ')}
        ORDER BY e.start_date NULLS LAST, c.name, sec.name, student, sub.name
      `, vals);
      columns = [
        ['exam', 'Exam'], ['class_name', 'Class'], ['section_name', 'Section'], ['subject', 'Subject'],
        ['component', 'Component'], ['admission_no', 'Admission No'], ['student', 'Student'],
        ['status_code', 'Code'], ['updated_by', 'Updated By'], ['updated_at', 'Updated At'],
      ].map(([key, label]) => ({ key, label }));
    } else if (type === 'class-result-sheet' || type === 'fail-compartment-list' || type === 'merit-list' || type === 'board-export') {
      const version = await findReportVersion(req, q);
      if (!version) return res.status(400).json({ error: 'No result version found for the selected filters' });
      const vals = [appId, version.id];
      const where = ['sr.app_id=$1', 'sr.version_id=$2', 'sr.deleted_at IS NULL'];
      if (filters.studentId) where.push(`sr.student_id=${bind(vals, filters.studentId)}`);
      if (filters.classId) where.push(`st.class_id=${bind(vals, filters.classId)}`);
      if (filters.sectionId) where.push(`st.section_id=${bind(vals, filters.sectionId)}`);
      if (type === 'fail-compartment-list') where.push(`sr.outcome IN ('fail','compartment')`);
      rows = await execQ(getPool(), `
        SELECT sr.id, st.admission_no, st.roll_no, st.first_name || ' ' || st.last_name AS student,
               c.name AS class_name, sec.name AS section_name, sr.total_marks, sr.max_total_marks,
               sr.percentage, sr.grade, sr.grade_points, sr.rank, sr.grace_total, sr.outcome, sr.promotion_decision
        FROM school_student_result sr
        JOIN school_students st ON st.id=sr.student_id
        LEFT JOIN school_classes c ON c.id=st.class_id
        LEFT JOIN school_sections sec ON sec.id=st.section_id
        WHERE ${where.join(' AND ')}
        ORDER BY ${type === 'merit-list' ? 'sr.rank NULLS LAST, sr.percentage DESC' : 'c.sort_order NULLS LAST, sec.name, st.roll_no NULLS LAST, st.first_name'}
        ${type === 'merit-list' ? 'LIMIT 100' : ''}
      `, vals);
      columns = [
        ['rank', 'Rank'], ['admission_no', 'Admission No'], ['roll_no', 'Roll No'], ['student', 'Student'],
        ['class_name', 'Class'], ['section_name', 'Section'], ['total_marks', 'Total'], ['max_total_marks', 'Max'],
        ['percentage', 'Percentage'], ['grade', 'Grade'], ['grade_points', 'Grade Points'], ['grace_total', 'Grace'],
        ['outcome', 'Outcome'], ['promotion_decision', 'Promotion'],
      ].map(([key, label]) => ({ key, label }));
      if (type === 'board-export') {
        columns = columns.filter((c) => !['rank', 'grace_total', 'promotion_decision'].includes(c.key));
      }
    } else if (type === 'subject-analysis') {
      const version = await findReportVersion(req, q);
      if (!version) return res.status(400).json({ error: 'No result version found for the selected filters' });
      rows = await execQ(getPool(), `
        SELECT sub.name AS subject, c.name AS class_name,
               COUNT(*)::int AS appeared,
               COUNT(*) FILTER (WHERE subres.outcome='pass')::int AS passed,
               ROUND(100.0 * COUNT(*) FILTER (WHERE subres.outcome='pass') / NULLIF(COUNT(*),0), 2) AS pass_percent,
               ROUND(AVG(subres.marks_obtained), 2) AS average_marks,
               MAX(subres.marks_obtained) AS highest_marks,
               MIN(subres.marks_obtained) AS lowest_marks
        FROM school_subject_result subres
        JOIN school_student_result sr ON sr.id=subres.student_result_id
        JOIN school_students st ON st.id=sr.student_id
        LEFT JOIN school_classes c ON c.id=st.class_id
        LEFT JOIN school_exam_paper p ON p.id=subres.paper_id
        LEFT JOIN school_subjects sub ON sub.id=COALESCE(subres.subject_id, p.subject_id)
        WHERE subres.app_id=$1 AND sr.version_id=$2 AND subres.deleted_at IS NULL
        GROUP BY sub.name, c.name, c.sort_order
        ORDER BY c.sort_order NULLS LAST, sub.name
      `, [appId, version.id]);
      columns = [
        ['class_name', 'Class'], ['subject', 'Subject'], ['appeared', 'Appeared'], ['passed', 'Passed'],
        ['pass_percent', 'Pass %'], ['average_marks', 'Average'], ['highest_marks', 'Highest'], ['lowest_marks', 'Lowest'],
      ].map(([key, label]) => ({ key, label }));
    } else if (type === 'grace-marks') {
      const vals = [appId];
      const where = ['gm.app_id=$1', 'gm.deleted_at IS NULL'];
      if (filters.versionId) where.push(`sr.version_id=${bind(vals, filters.versionId)}`);
      rows = await execQ(getPool(), `
        SELECT gm.id, st.admission_no, st.first_name || ' ' || st.last_name AS student,
               sub.name AS subject, gm.marks, gm.rule_applied, gm.reason, gm.approved_by, gm.approved_at,
               subres.marks_obtained, subres.grace_marks, subres.outcome
        FROM school_grace_mark gm
        JOIN school_subject_result subres ON subres.id=gm.subject_result_id
        JOIN school_student_result sr ON sr.id=subres.student_result_id
        JOIN school_students st ON st.id=sr.student_id
        LEFT JOIN school_exam_paper p ON p.id=subres.paper_id
        LEFT JOIN school_subjects sub ON sub.id=COALESCE(subres.subject_id, p.subject_id)
        WHERE ${where.join(' AND ')}
        ORDER BY st.first_name, sub.name
      `, vals);
      columns = [
        ['admission_no', 'Admission No'], ['student', 'Student'], ['subject', 'Subject'], ['marks', 'Grace'],
        ['marks_obtained', 'Marks'], ['rule_applied', 'Rule'], ['reason', 'Reason'], ['approved_by', 'Approved By'], ['approved_at', 'Approved At'],
      ].map(([key, label]) => ({ key, label }));
    } else if (type === 'teacher-pass-percent') {
      const version = await findReportVersion(req, q);
      if (!version) return res.status(400).json({ error: 'No result version found for the selected filters' });
      rows = await execQ(getPool(), `
        SELECT COALESCE(NULLIF(sa.teacher_name, ''), sa.teacher_id, 'Unassigned') AS teacher,
               sub.name AS subject, c.name AS class_name,
               COUNT(*)::int AS appeared,
               COUNT(*) FILTER (WHERE subres.outcome='pass')::int AS passed,
               ROUND(100.0 * COUNT(*) FILTER (WHERE subres.outcome='pass') / NULLIF(COUNT(*),0), 2) AS pass_percent
        FROM school_subject_result subres
        JOIN school_student_result sr ON sr.id=subres.student_result_id
        JOIN school_students st ON st.id=sr.student_id
        LEFT JOIN school_exam_paper p ON p.id=subres.paper_id
        LEFT JOIN school_subjects sub ON sub.id=COALESCE(subres.subject_id, p.subject_id)
        LEFT JOIN school_classes c ON c.id=st.class_id
        LEFT JOIN LATERAL (
          SELECT * FROM school_subject_allocations a
          WHERE a.app_id=$1 AND a.class_id=st.class_id AND a.subject_id=COALESCE(subres.subject_id,p.subject_id)
            AND a.is_active=true AND a.deleted_at IS NULL
          ORDER BY a.effective_from DESC NULLS LAST, a.id DESC LIMIT 1
        ) sa ON true
        WHERE subres.app_id=$1 AND sr.version_id=$2 AND subres.deleted_at IS NULL
        GROUP BY teacher, sub.name, c.name, c.sort_order
        ORDER BY teacher, c.sort_order NULLS LAST, sub.name
      `, [appId, version.id]);
      columns = [
        ['teacher', 'Teacher'], ['class_name', 'Class'], ['subject', 'Subject'], ['appeared', 'Appeared'],
        ['passed', 'Passed'], ['pass_percent', 'Pass %'],
      ].map(([key, label]) => ({ key, label }));
    } else if (type === 'term-comparison' || type === 'student-performance-history') {
      const vals = [appId];
      const where = ['rv.app_id=$1', 'rv.deleted_at IS NULL', 'sr.deleted_at IS NULL'];
      if (filters.studentId) where.push(`sr.student_id=${bind(vals, filters.studentId)}`);
      if (filters.examId) where.push(`rv.exam_id=${bind(vals, filters.examId)}`);
      if (filters.classId) where.push(`st.class_id=${bind(vals, filters.classId)}`);
      if (filters.sectionId) where.push(`st.section_id=${bind(vals, filters.sectionId)}`);
      rows = await execQ(getPool(), `
        SELECT sr.id, st.admission_no, st.first_name || ' ' || st.last_name AS student,
               e.name AS exam, t.name AS term, rv.version_no, rv.status,
               sr.total_marks, sr.max_total_marks, sr.percentage, sr.grade, sr.rank, sr.outcome, rv.published_at
        FROM school_student_result sr
        JOIN school_result_version rv ON rv.id=sr.version_id
        JOIN school_students st ON st.id=sr.student_id
        LEFT JOIN school_exam e ON e.id=rv.exam_id
        LEFT JOIN school_term t ON t.id=rv.term_id
        WHERE ${where.join(' AND ')}
        ORDER BY st.admission_no, rv.created_at
      `, vals);
      columns = [
        ['admission_no', 'Admission No'], ['student', 'Student'], ['exam', 'Exam'], ['term', 'Term'],
        ['version_no', 'Version'], ['status', 'Status'], ['total_marks', 'Total'], ['max_total_marks', 'Max'],
        ['percentage', 'Percentage'], ['grade', 'Grade'], ['rank', 'Rank'], ['outcome', 'Outcome'], ['published_at', 'Published'],
      ].map(([key, label]) => ({ key, label }));
    } else if (type === 're-evaluation') {
      const vals = [appId];
      const where = ['rr.app_id=$1', 'rr.deleted_at IS NULL'];
      if (filters.studentId) where.push(`rr.student_id=${bind(vals, filters.studentId)}`);
      if (filters.examId) where.push(`rv.exam_id=${bind(vals, filters.examId)}`);
      rows = await execQ(getPool(), `
        SELECT rr.id, st.admission_no, st.first_name || ' ' || st.last_name AS student, sub.name AS subject,
               rr.old_marks, rr.new_marks, rr.old_status_code, rr.new_status_code, rr.status,
               rr.reason, rr.decision_reason, rr.requested_by, rr.requested_at, rr.reviewed_by, rr.reviewed_at
        FROM school_revaluation_request rr
        JOIN school_students st ON st.id=rr.student_id
        LEFT JOIN school_exam_paper p ON p.id=rr.paper_id
        LEFT JOIN school_subjects sub ON sub.id=p.subject_id
        LEFT JOIN school_result_version rv ON rv.id=rr.version_id
        WHERE ${where.join(' AND ')}
        ORDER BY rr.requested_at DESC
      `, vals);
      columns = [
        ['admission_no', 'Admission No'], ['student', 'Student'], ['subject', 'Subject'], ['old_marks', 'Old'],
        ['new_marks', 'New'], ['old_status_code', 'Old Code'], ['new_status_code', 'New Code'], ['status', 'Status'],
        ['reason', 'Reason'], ['decision_reason', 'Decision'], ['requested_by', 'Requested By'], ['requested_at', 'Requested'],
        ['reviewed_by', 'Reviewed By'], ['reviewed_at', 'Reviewed'],
      ].map(([key, label]) => ({ key, label }));
    } else if (type === 'promotion-list') {
      const vals = [appId];
      const where = ['pd.app_id=$1', 'pd.deleted_at IS NULL'];
      if (filters.studentId) where.push(`pd.student_id=${bind(vals, filters.studentId)}`);
      rows = await execQ(getPool(), `
        SELECT pd.id, st.admission_no, st.first_name || ' ' || st.last_name AS student,
               fc.name AS from_class, tc.name AS to_class, ts.name AS to_section,
               pd.decision, pd.decided_by, pd.decided_at, rv.version_no, rv.status AS version_status
        FROM school_promotion_decision pd
        JOIN school_students st ON st.id=pd.student_id
        LEFT JOIN school_classes fc ON fc.id=pd.from_class_id
        LEFT JOIN school_classes tc ON tc.id=pd.to_class_id
        LEFT JOIN school_sections ts ON ts.id=pd.to_section_id
        LEFT JOIN school_result_version rv ON rv.id=pd.based_on_version_id
        WHERE ${where.join(' AND ')}
        ORDER BY st.admission_no
      `, vals);
      columns = [
        ['admission_no', 'Admission No'], ['student', 'Student'], ['from_class', 'From Class'], ['to_class', 'To Class'],
        ['to_section', 'To Section'], ['decision', 'Decision'], ['version_no', 'Version'], ['decided_by', 'Decided By'], ['decided_at', 'Decided At'],
      ].map(([key, label]) => ({ key, label }));
    }

    res.json({
      ok: true,
      reportType: type,
      title: known.title,
      columns,
      rows,
      meta: reportMeta(req, filters),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Report failed' });
  }
});

/* ============================================================
   16. REPORT TEMPLATES
   ============================================================ */

examRouter.get('/exam/report-templates', async (req, res) => {
  if (!guard(req, res, 'exam.report_setup')) return;
  const yearId = num(req.query.academicYearId);
  const where = ['app_id=$1', 'deleted_at IS NULL'];
  const vals = [appIdOf(req)];
  if (yearId) { vals.push(yearId); where.push(`academic_year_id=$${vals.length}`); }
  const rows = await execQ(getPool(), `
    SELECT * FROM school_report_template WHERE ${where.join(' AND ')} ORDER BY class_band, name
  `, vals);
  res.json({ ok: true, templates: rows });
});

examRouter.post('/exam/report-templates', async (req, res) => {
  if (!guard(req, res, 'exam.report_setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    INSERT INTO school_report_template (app_id, academic_year_id, class_band, name, layout, is_default, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [appIdOf(req), num(b.academicYearId), text(b.classBand), text(b.name), b.layout ? JSON.stringify(b.layout) : '{}', b.isDefault===true, text(req.user.userid)]);
  res.json({ ok: true, template: row[0] });
});

examRouter.put('/exam/report-templates/:id', async (req, res) => {
  if (!guard(req, res, 'exam.report_setup')) return;
  const b = req.body || {};
  const row = await execQ(getPool(), `
    UPDATE school_report_template SET
      class_band=$3, name=$4, layout=$5, is_default=$6, updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), text(b.classBand), text(b.name), b.layout ? JSON.stringify(b.layout) : '{}', b.isDefault===true]);
  res.json({ ok: true, template: row[0] });
});

/* ============================================================
   17. REPORT CARDS
   ============================================================ */

const reportCardJobs = new Map();

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function attendanceSummary(appId, studentIds) {
  if (!studentIds.length) return new Map();
  const rows = await execQ(getPool(), `
    SELECT a.student_id,
           COUNT(*)::int AS total_days,
           COUNT(*) FILTER (WHERE COALESCE(p.counts_as_present, a.status IN ('present','late','half_day')))::int AS present_days
    FROM school_attendance a
    LEFT JOIN school_attendance_policy p ON p.app_id=a.app_id AND p.code=a.status
    WHERE a.app_id=$1 AND a.student_id = ANY($2::int[])
    GROUP BY a.student_id
  `, [appId, studentIds]);
  return new Map(rows.map((r) => [r.student_id, r]));
}

async function feeDuesMap(appId, studentIds) {
  if (!studentIds.length) return new Map();
  const rows = await execQ(getPool(), `
    SELECT student_id, COALESCE(SUM(amount - COALESCE(paid_amount,0)),0) AS due
    FROM school_fee_invoices
    WHERE app_id=$1 AND student_id = ANY($2::int[]) AND COALESCE(status,'') NOT IN ('paid','cancelled','waived')
    GROUP BY student_id
  `, [appId, studentIds]);
  return new Map(rows.map((r) => [r.student_id, Number(r.due)]));
}

examRouter.post('/exam/report-cards/generate', async (req, res) => {
  if (!guard(req, res, 'exam.reportcards.generate')) return;
  const appId = appIdOf(req);
  const b = req.body || {};
  const versionId = num(b.versionId ?? b.version_id);
  const templateId = num(b.templateId ?? b.template_id);
  const sectionId = num(b.sectionId ?? b.section_id);
  const copyNo = Math.max(1, num(b.copyNo ?? b.copy_no) || 1);
  const withholdFees = b.withholdFees === true || b.withhold_fees === true;
  const withholdAttendance = b.withholdAttendance === true || b.withhold_attendance === true;
  if (!versionId || !templateId || !sectionId) return res.status(400).json({ error: 'versionId, templateId and sectionId are required' });

  const version = (await execQ(getPool(), 'SELECT * FROM school_result_version WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, versionId]))[0];
  if (!version) return res.status(404).json({ error: 'Result version not found' });
  if (version.status !== 'published') return res.status(409).json({ error: 'Report cards can only be generated from a published result version.', status: version.status });
  const template = (await execQ(getPool(), 'SELECT * FROM school_report_template WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, templateId]))[0];
  if (!template) return res.status(404).json({ error: 'Report template not found' });

  const students = await execQ(getPool(), `
    SELECT st.id, st.admission_no, st.first_name, st.last_name, st.roll_no, st.section_id,
           sr.id AS result_id, sr.total_marks, sr.percentage, sr.grade, sr.rank, sr.outcome
    FROM school_students st
    LEFT JOIN school_student_result sr ON sr.student_id=st.id AND sr.version_id=$2 AND sr.deleted_at IS NULL
    WHERE st.app_id=$1 AND st.section_id=$3 AND st.status='active' AND st.deleted_at IS NULL
    ORDER BY st.roll_no NULLS LAST, st.first_name
  `, [appId, versionId, sectionId]);
  if (!students.length) return res.status(400).json({ error: 'No active students in the selected section.' });

  const jobId = randomUUID();
  reportCardJobs.set(jobId, { status: 'processing', startedAt: new Date().toISOString(), total: students.length, generated: 0, withheld: 0 });

  const ids = students.map((s) => s.id);
  const [dues, attendance] = await Promise.all([
    withholdFees ? feeDuesMap(appId, ids) : Promise.resolve(new Map()),
    withholdAttendance ? attendanceSummary(appId, ids) : Promise.resolve(new Map()),
  ]);

  const generated = [];
  const withheld = [];
  const skipped = [];
  for (const student of students) {
    if (!student.result_id) {
      skipped.push({ studentId: student.id, admissionNo: student.admission_no, reason: 'No result snapshot for this version' });
      continue;
    }
    const reasons = [];
    if (withholdFees && (dues.get(student.id) || 0) > 0) reasons.push(`Fee dues pending: â‚¹${Number(dues.get(student.id)).toFixed(2)}`);
    if (withholdAttendance) {
      const att = attendance.get(student.id);
      if (att && att.total_days > 0) {
        const pct = (att.present_days / att.total_days) * 100;
        if (pct < 75) reasons.push(`Attendance below 75%: ${pct.toFixed(1)}%`);
      }
    }
    const status = reasons.length ? 'withheld' : 'generated';
    const reason = reasons.join('; ') || null;
    const existing = (await execQ(getPool(), `
      SELECT * FROM school_report_card
      WHERE app_id=$1 AND student_id=$2 AND version_id=$3 AND copy_no=$4 AND deleted_at IS NULL
      ORDER BY id DESC LIMIT 1
    `, [appId, student.id, versionId, copyNo]))[0];
    const filePath = `/school/exam/report-cards/preview/${student.id}/${versionId}?copy=${copyNo}`;
    let card;
    if (existing) {
      card = (await execQ(getPool(), `
        UPDATE school_report_card
        SET template_id=$2, file_path=$3, status=$4, withheld_reason=$5, generated_by=$6, generated_at=now(), updated_at=now()
        WHERE app_id=$1 AND id=$7 RETURNING *
      `, [appId, templateId, filePath, status, reason, text(req.user.userid), existing.id]))[0];
    } else {
      card = (await execQ(getPool(), `
        INSERT INTO school_report_card
          (app_id, student_id, version_id, template_id, file_path, copy_no, generated_by, status, withheld_reason)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
      `, [appId, student.id, versionId, templateId, filePath, copyNo, text(req.user.userid), status, reason]))[0];
    }
    if (status === 'withheld') withheld.push({ ...card, student_name: `${student.first_name} ${student.last_name}`, reason });
    else generated.push({ ...card, student_name: `${student.first_name} ${student.last_name}` });
  }

  const summary = { total: students.length, generated: generated.length, withheld: withheld.length, skipped: skipped.length };
  reportCardJobs.set(jobId, { status: 'completed', completedAt: new Date().toISOString(), ...summary });
  await writeAudit(req, 'report_cards.generate', 'school_result_version', versionId, null,
    { templateId, sectionId, copyNo, withholdFees, withholdAttendance, ...summary });
  res.json({ ok: true, jobId, status: 'completed', ...summary, cards: generated, withheldCards: withheld, skipped });
});

examRouter.get('/exam/report-cards/status/:jobId', async (req, res) => {
  if (!guard(req, res, 'exam.reportcards.generate')) return;
  const job = reportCardJobs.get(req.params.jobId);
  if (!job) {
    return res.json({ ok: true, status: 'completed', jobId: req.params.jobId, note: 'Job completed; generated cards are available in the report card list.' });
  }
  res.json({ ok: true, jobId: req.params.jobId, ...job });
});

examRouter.get('/exam/report-cards/remarks', async (req, res) => {
  if (!guard(req, res, 'exam.reportcards.generate')) return;
  const appId = appIdOf(req);
  const vals = [appId];
  const where = ['r.app_id=$1', 'r.deleted_at IS NULL'];
  if (req.query.versionId) where.push(`r.version_id=${bind(vals, num(req.query.versionId))}`);
  if (req.query.studentId) where.push(`r.student_id=${bind(vals, num(req.query.studentId))}`);
  if (req.query.sectionId) where.push(`st.section_id=${bind(vals, num(req.query.sectionId))}`);
  const rows = await execQ(getPool(), `
    SELECT r.*, st.admission_no, st.first_name || ' ' || st.last_name AS student, cb.text AS comment_text
    FROM school_remark r
    JOIN school_students st ON st.id=r.student_id
    LEFT JOIN school_comment_bank cb ON cb.id=r.comment_bank_id
    WHERE ${where.join(' AND ')}
    ORDER BY st.roll_no NULLS LAST, st.first_name, r.remark_type
  `, vals);
  res.json({ ok: true, remarks: rows });
});

examRouter.post('/exam/report-cards/remarks', async (req, res) => {
  if (!guard(req, res, 'exam.reportcards.generate')) return;
  const appId = appIdOf(req);
  const b = req.body || {};
  const studentId = num(b.studentId ?? b.student_id);
  const versionId = num(b.versionId ?? b.version_id);
  const remarkType = text(b.remarkType ?? b.remark_type) || 'class_teacher';
  if (!studentId || !versionId) return res.status(400).json({ error: 'studentId and versionId are required' });
  if (!['class_teacher', 'principal', 'subject_teacher'].includes(remarkType)) return res.status(400).json({ error: 'Invalid remark type' });
  await execQ(getPool(), `UPDATE school_remark SET deleted_at=now() WHERE app_id=$1 AND student_id=$2 AND version_id=$3 AND remark_type=$4 AND deleted_at IS NULL`, [appId, studentId, versionId, remarkType]);
  const row = (await execQ(getPool(), `
    INSERT INTO school_remark (app_id, student_id, version_id, remark_type, author_id, text, comment_bank_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [appId, studentId, versionId, remarkType, text(req.user.userid), text(b.text), num(b.commentBankId ?? b.comment_bank_id)]))[0];
  await writeAudit(req, 'remark.save', 'school_remark', row.id, null, row);
  res.json({ ok: true, remark: row });
});

examRouter.get('/exam/report-cards/comment-bank', async (req, res) => {
  if (!guard(req, res, 'exam.reportcards.generate')) return;
  const vals = [appIdOf(req)];
  const where = ['app_id=$1', 'deleted_at IS NULL'];
  if (req.query.category) where.push(`category=${bind(vals, text(req.query.category))}`);
  const rows = await execQ(getPool(), `SELECT * FROM school_comment_bank WHERE ${where.join(' AND ')} ORDER BY category, text`, vals);
  res.json({ ok: true, comments: rows });
});

examRouter.post('/exam/report-cards/comment-bank', async (req, res) => {
  if (!guard(req, res, 'exam.reportcards.generate')) return;
  const b = req.body || {};
  if (!text(b.text)) return res.status(400).json({ error: 'Comment text is required' });
  const row = (await execQ(getPool(), `
    INSERT INTO school_comment_bank (app_id, category, text, is_active, created_by)
    VALUES ($1,$2,$3,true,$4) RETURNING *
  `, [appIdOf(req), text(b.category) || 'general', text(b.text), text(req.user.userid)]))[0];
  res.json({ ok: true, comment: row });
});

examRouter.get('/exam/report-cards/co-scholastic', async (req, res) => {
  if (!guard(req, res, 'exam.reportcards.generate')) return;
  const appId = appIdOf(req);
  const vals = [appId];
  const where = ['g.app_id=$1', 'g.deleted_at IS NULL'];
  if (req.query.versionId) where.push(`g.version_id=${bind(vals, num(req.query.versionId))}`);
  if (req.query.sectionId) where.push(`st.section_id=${bind(vals, num(req.query.sectionId))}`);
  const [areas, grades] = await Promise.all([
    execQ(getPool(), 'SELECT * FROM school_co_scholastic_area WHERE app_id=$1 AND deleted_at IS NULL AND is_active=true ORDER BY sort_order, name', [appId]),
    execQ(getPool(), `
      SELECT g.*, st.admission_no, st.first_name || ' ' || st.last_name AS student, a.name AS area_name
      FROM school_co_scholastic_grade g
      JOIN school_students st ON st.id=g.student_id
      LEFT JOIN school_co_scholastic_area a ON a.id=g.area_id
      WHERE ${where.join(' AND ')}
      ORDER BY st.roll_no NULLS LAST, st.first_name, a.sort_order
    `, vals),
  ]);
  res.json({ ok: true, areas, grades });
});

examRouter.post('/exam/report-cards/co-scholastic', async (req, res) => {
  if (!guard(req, res, 'exam.reportcards.generate')) return;
  const appId = appIdOf(req);
  const b = req.body || {};
  const studentId = num(b.studentId ?? b.student_id);
  const versionId = num(b.versionId ?? b.version_id);
  const areaId = num(b.areaId ?? b.area_id);
  if (!studentId || !versionId || !areaId) return res.status(400).json({ error: 'studentId, versionId and areaId are required' });
  const existing = (await execQ(getPool(), `
    SELECT * FROM school_co_scholastic_grade
    WHERE app_id=$1 AND student_id=$2 AND version_id=$3 AND area_id=$4 AND deleted_at IS NULL
  `, [appId, studentId, versionId, areaId]))[0];
  let row;
  if (existing) {
    row = (await execQ(getPool(), `
      UPDATE school_co_scholastic_grade SET grade=$2, grade_points=$3, teacher_id=$4, updated_at=now()
      WHERE app_id=$1 AND id=$5 RETURNING *
    `, [appId, text(b.grade), num(b.gradePoints ?? b.grade_points), text(req.user.userid), existing.id]))[0];
  } else {
    row = (await execQ(getPool(), `
      INSERT INTO school_co_scholastic_grade (app_id, student_id, version_id, area_id, grade, grade_points, teacher_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [appId, studentId, versionId, areaId, text(b.grade), num(b.gradePoints ?? b.grade_points), text(req.user.userid)]))[0];
  }
  res.json({ ok: true, grade: row });
});

examRouter.post('/exam/report-cards/co-scholastic/areas', async (req, res) => {
  if (!guard(req, res, 'exam.report_setup')) return;
  const b = req.body || {};
  if (!text(b.name)) return res.status(400).json({ error: 'Area name is required' });
  const row = (await execQ(getPool(), `
    INSERT INTO school_co_scholastic_area (app_id, name, grading_type, class_bands, sort_order, is_active)
    VALUES ($1,$2,$3,$4,$5,true) RETURNING *
  `, [appIdOf(req), text(b.name), text(b.gradingType) || 'grade', Array.isArray(b.classBands) ? b.classBands : [], num(b.sortOrder) || 0]))[0];
  res.json({ ok: true, area: row });
});

examRouter.post('/exam/report-cards/publish', async (req, res) => {
  if (!guard(req, res, 'exam.reportcards.generate')) return;
  const appId = appIdOf(req);
  const b = req.body || {};
  const versionId = num(b.versionId ?? b.version_id);
  const sectionId = num(b.sectionId ?? b.section_id);
  if (!versionId) return res.status(400).json({ error: 'versionId is required' });
  const vals = [appId, versionId, text(req.user.userid)];
  let where = `app_id=$1 AND version_id=$2 AND status='generated' AND deleted_at IS NULL`;
  if (sectionId) {
    vals.push(sectionId);
    where += ` AND student_id IN (SELECT id FROM school_students WHERE app_id=$1 AND section_id=$4 AND deleted_at IS NULL)`;
  }
  const rows = await execQ(getPool(), `
    UPDATE school_report_card SET status='published', published_at=now(), published_by=$3, updated_at=now()
    WHERE ${where} RETURNING *
  `, vals);
  await writeAudit(req, 'report_cards.publish', 'school_result_version', versionId, null, { published: rows.length, sectionId });
  res.json({ ok: true, published: rows.length, cards: rows });
});

examRouter.post('/exam/report-cards/withhold', async (req, res) => {
  if (!guard(req, res, 'exam.reportcards.generate')) return;
  const appId = appIdOf(req);
  const b = req.body || {};
  const studentId = num(b.studentId ?? b.student_id);
  const versionId = num(b.versionId ?? b.version_id);
  const reason = text(b.reason);
  if (!studentId || !versionId || !reason) return res.status(400).json({ error: 'studentId, versionId and reason are required' });
  const existing = (await execQ(getPool(), `
    SELECT * FROM school_report_card WHERE app_id=$1 AND student_id=$2 AND version_id=$3 AND deleted_at IS NULL ORDER BY id DESC LIMIT 1
  `, [appId, studentId, versionId]))[0];
  let row;
  if (existing) {
    row = (await execQ(getPool(), `
      UPDATE school_report_card SET status='withheld', withheld_reason=$2, updated_at=now()
      WHERE app_id=$1 AND id=$3 RETURNING *
    `, [appId, reason, existing.id]))[0];
  } else {
    row = (await execQ(getPool(), `
      INSERT INTO school_report_card (app_id, student_id, version_id, status, withheld_reason, generated_by)
      VALUES ($1,$2,$3,'withheld',$4,$5) RETURNING *
    `, [appId, studentId, versionId, reason, text(req.user.userid)]))[0];
  }
  await writeAudit(req, 'report_card.withhold', 'school_report_card', row.id, existing || null, row);
  res.json({ ok: true, card: row });
});

examRouter.get('/exam/report-cards/preview/:studentId/:versionId', async (req, res) => {
  if (!guard(req, res, 'exam.reportcards.generate')) return;
  const appId = appIdOf(req);
  const studentId = num(req.params.studentId);
  const versionId = num(req.params.versionId);
  try {
    const student = (await execQ(getPool(), `
      SELECT st.*, c.name AS class_name, sec.name AS section_name
      FROM school_students st
      LEFT JOIN school_classes c ON c.id=st.class_id
      LEFT JOIN school_sections sec ON sec.id=st.section_id
      WHERE st.app_id=$1 AND st.id=$2
    `, [appId, studentId]))[0];
    if (!student) return res.status(404).send('Student not found');
    const version = (await execQ(getPool(), `
      SELECT rv.*, e.name AS exam_name, t.name AS term_name
      FROM school_result_version rv
      LEFT JOIN school_exam e ON e.id=rv.exam_id
      LEFT JOIN school_term t ON t.id=rv.term_id
      WHERE rv.app_id=$1 AND rv.id=$2
    `, [appId, versionId]))[0];
    if (!version) return res.status(404).send('Result version not found');
    const result = (await execQ(getPool(), `
      SELECT * FROM school_student_result WHERE app_id=$1 AND version_id=$2 AND student_id=$3 AND deleted_at IS NULL
    `, [appId, versionId, studentId]))[0];
    if (!result) return res.status(404).send('Result not found for this student');
    const [subjects, remarks, coScholastic, card] = await Promise.all([
      execQ(getPool(), `
        SELECT subres.*, sub.name AS subject_name, p.max_marks AS paper_max
        FROM school_subject_result subres
        LEFT JOIN school_exam_paper p ON p.id=subres.paper_id
        LEFT JOIN school_subjects sub ON sub.id=COALESCE(subres.subject_id, p.subject_id)
        WHERE subres.app_id=$1 AND subres.student_result_id=$2 AND subres.deleted_at IS NULL
        ORDER BY sub.name
      `, [appId, result.id]),
      execQ(getPool(), `SELECT * FROM school_remark WHERE app_id=$1 AND student_id=$2 AND version_id=$3 AND deleted_at IS NULL`, [appId, studentId, versionId]),
      execQ(getPool(), `
        SELECT g.*, a.name AS area_name FROM school_co_scholastic_grade g
        LEFT JOIN school_co_scholastic_area a ON a.id=g.area_id
        WHERE g.app_id=$1 AND g.student_id=$2 AND g.version_id=$3 AND g.deleted_at IS NULL
        ORDER BY a.sort_order
      `, [appId, studentId, versionId]),
      execQ(getPool(), `SELECT * FROM school_report_card WHERE app_id=$1 AND student_id=$2 AND version_id=$3 AND deleted_at IS NULL ORDER BY id DESC LIMIT 1`, [appId, studentId, versionId]),
    ]);
    const classTeacher = remarks.find((r) => r.remark_type === 'class_teacher');
    const principal = remarks.find((r) => r.remark_type === 'principal');
    const attendance = (await attendanceSummary(appId, [studentId])).get(studentId);
    const attendanceText = attendance && attendance.total_days
      ? `${attendance.present_days} / ${attendance.total_days} (${((attendance.present_days / attendance.total_days) * 100).toFixed(1)}%)`
      : 'Not available';
    const cardStatus = card[0];
    const subjectRows = subjects.map((s) => `
      <tr>
        <td>${escapeHtml(s.subject_name || 'â€”')}</td>
        <td class="num">${escapeHtml(s.max_marks ?? s.paper_max ?? '')}</td>
        <td class="num">${escapeHtml(s.marks_obtained)}</td>
        <td class="num">${escapeHtml(s.grace_marks || 0)}</td>
        <td class="num">${escapeHtml(s.percentage)}%</td>
        <td>${escapeHtml(s.grade || 'â€”')}</td>
        <td>${escapeHtml(s.outcome || 'â€”')}</td>
      </tr>`).join('');
    const coRows = coScholastic.map((c) => `<tr><td>${escapeHtml(c.area_name)}</td><td>${escapeHtml(c.grade || 'â€”')}</td></tr>`).join('');
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Report Card â€” ${escapeHtml(student.first_name)} ${escapeHtml(student.last_name)}</title>
<style>
  body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:24px;color:#1f2937}
  .card{max-width:820px;margin:0 auto;border:1px solid #cbd5e1;border-radius:10px;padding:24px;position:relative}
  .head{text-align:center;border-bottom:2px solid #0d6efd;padding-bottom:10px;margin-bottom:16px}
  .head h1{margin:0;font-size:22px;color:#0b3d91}
  .muted{color:#64748b;font-size:12px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;font-size:13px;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px}
  th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}
  th{background:#eff6ff}
  .num{text-align:right}
  .totals{background:#f8fafc;font-weight:600}
  .sig{display:flex;justify-content:space-between;margin-top:40px;font-size:12px}
  .watermark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:64px;color:rgba(220,38,38,.13);font-weight:800;transform:rotate(-24deg);pointer-events:none}
  @media print{body{margin:0}.card{border:none}.no-print{display:none}}
</style></head><body>
<div class="card">
  ${cardStatus?.status === 'withheld' ? `<div class="watermark">WITHHELD</div>` : ''}
  <div class="head"><h1>School ERP</h1><div class="muted">${escapeHtml(version.exam_name || '')}${version.term_name ? ` Â· ${escapeHtml(version.term_name)}` : ''}</div></div>
  <div class="grid">
    <div><strong>Student:</strong> ${escapeHtml(student.first_name)} ${escapeHtml(student.last_name)}</div>
    <div><strong>Admission No:</strong> ${escapeHtml(student.admission_no)}</div>
    <div><strong>Class / Section:</strong> ${escapeHtml(student.class_name || 'â€”')} / ${escapeHtml(student.section_name || 'â€”')}</div>
    <div><strong>Roll No:</strong> ${escapeHtml(student.roll_no || 'â€”')}</div>
    <div><strong>Attendance:</strong> ${escapeHtml(attendanceText)}</div>
    <div><strong>Result Version:</strong> v${escapeHtml(version.version_no)} (${escapeHtml(version.status)})</div>
  </div>
  <table><thead><tr><th>Subject</th><th class="num">Max</th><th class="num">Marks</th><th class="num">Grace</th><th class="num">%</th><th>Grade</th><th>Outcome</th></tr></thead>
    <tbody>${subjectRows || '<tr><td colspan="7">No subject results</td></tr>'}</tbody>
    <tfoot><tr class="totals"><td colspan="2">Grand Total</td><td class="num">${escapeHtml(result.total_marks)} / ${escapeHtml(result.max_total_marks)}</td><td class="num">${escapeHtml(result.grace_total || 0)}</td><td class="num">${escapeHtml(result.percentage)}%</td><td>${escapeHtml(result.grade || 'â€”')}</td><td>${escapeHtml(result.outcome || 'â€”')}</td></tr></tfoot>
  </table>
  <div class="grid">
    <div><strong>Rank:</strong> ${escapeHtml(result.rank ?? 'â€”')}</div>
    <div><strong>Grade Points:</strong> ${escapeHtml(result.grade_points ?? 'â€”')}</div>
  </div>
  ${coRows ? `<table><thead><tr><th>Co-Scholastic Area</th><th>Grade</th></tr></thead><tbody>${coRows}</tbody></table>` : ''}
  <div style="font-size:13px;margin-top:10px"><strong>Class Teacher Remark:</strong> ${escapeHtml(classTeacher?.text || 'â€”')}</div>
  <div style="font-size:13px;margin-top:6px"><strong>Principal Remark:</strong> ${escapeHtml(principal?.text || 'â€”')}</div>
  ${cardStatus?.status === 'withheld' ? `<div style="margin-top:12px;color:#b91c1c;font-size:12px"><strong>Withheld:</strong> ${escapeHtml(cardStatus.withheld_reason || '')}</div>` : ''}
  <div class="sig"><div>Class Teacher</div><div>Principal</div><div>Parent</div></div>
  <div class="no-print" style="margin-top:16px;text-align:center"><button onclick="window.print()">Print / Save as PDF</button></div>
</div></body></html>`;
    res.type('html').send(html);
  } catch (err) {
    res.status(500).send(`Report card preview failed: ${escapeHtml(err.message)}`);
  }
});

export const schoolExamRouter = examRouter;
