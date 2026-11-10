/* ============================================================
   Certificates & ID — backend routes
   Mounted at /api/school before the legacy comprehensive router.
   ============================================================ */
import express from 'express';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { ensureFoundation, loadAccess, writeAudit } from '../school/foundation.js';

const certificatesRouter = express.Router();

certificatesRouter.use(verifyToken);
certificatesRouter.use(async (req, _res, next) => {
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

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };

function guard(req, res, perm) {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('certificates.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}
function guardView(req, res, perm = 'certificates.view') {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('certificates.view') || perms.includes('certificates.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

// Templates
certificatesRouter.get('/certificates/templates', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const type = text(req.query.type);
  const rows = await execQ(getPool(), `SELECT * FROM school_document_template WHERE app_id=$1 AND deleted_at IS NULL ${type ? 'AND type=$2' : ''} ORDER BY created_at DESC`, [appIdOf(req), type].filter(Boolean));
  res.json({ ok: true, templates: rows });
}));

certificatesRouter.post('/certificates/templates', route(async (req, res) => {
  if (!guard(req, res, 'certificates.templates')) return;
  const b = req.body || {};
  if (!text(b.name) || !text(b.type)) fail(400, 'Name and type required');
  const appId = appIdOf(req);
  const rows = await execQ(getPool(), `
    INSERT INTO school_document_template (app_id, name, type, category, background_file_id, canvas_json, status, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
  `, [appId, text(b.name), text(b.type), text(b.category), num(b.backgroundFileId), b.canvasJson ? JSON.stringify(b.canvasJson) : '{}', text(b.status) || 'active', userOf(req)]);
  await writeAudit(getPool(), req, { action: 'certificates.template.create', entity: 'school_document_template', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, template: rows[0] });
}));

certificatesRouter.put('/certificates/templates/:id', route(async (req, res) => {
  if (!guard(req, res, 'certificates.templates')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  const appId = appIdOf(req);
  const before = (await execQ(getPool(), 'SELECT * FROM school_document_template WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, id]))[0];
  if (!before) fail(404, 'Template not found');
  const rows = await execQ(getPool(), `
    UPDATE school_document_template SET name=coalesce($3,name), type=coalesce($4,type), category=coalesce($5,category), background_file_id=coalesce($6,background_file_id), canvas_json=coalesce($7::jsonb,canvas_json), status=coalesce($8,status), updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appId, id, text(b.name), text(b.type), text(b.category), num(b.backgroundFileId), b.canvasJson ? JSON.stringify(b.canvasJson) : null, text(b.status)]);
  await writeAudit(getPool(), req, { action: 'certificates.template.update', entity: 'school_document_template', entityId: id, before, after: rows[0] });
  res.json({ ok: true, template: rows[0] });
}));

certificatesRouter.delete('/certificates/templates/:id', route(async (req, res) => {
  if (!guard(req, res, 'certificates.templates')) return;
  const id = num(req.params.id);
  const appId = appIdOf(req);
  const rows = await execQ(getPool(), 'UPDATE school_document_template SET deleted_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id', [appId, id]);
  if (!rows[0]) fail(404, 'Template not found');
  await writeAudit(getPool(), req, { action: 'certificates.template.delete', entity: 'school_document_template', entityId: id });
  res.json({ ok: true });
}));

// Template Fields
certificatesRouter.get('/certificates/templates/:id/fields', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `SELECT * FROM school_template_field WHERE app_id=$1 AND template_id=$2 ORDER BY id`, [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true, fields: rows });
}));

certificatesRouter.post('/certificates/templates/:id/fields', route(async (req, res) => {
  if (!guard(req, res, 'certificates.templates')) return;
  const b = req.body || {};
  const appId = appIdOf(req);
  const rows = await execQ(getPool(), `
    INSERT INTO school_template_field (app_id, template_id, field_key, x, y, width, height, font_family, font_size, font_weight, font_style, color, alignment, is_dynamic, source_table, source_field, transform, default_value)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *
  `, [appId, num(req.params.id), text(b.fieldKey), num(b.x), num(b.y), num(b.width), num(b.height), text(b.fontFamily) || 'Arial', num(b.fontSize) || 12, text(b.fontWeight) || 'normal', text(b.fontStyle) || 'normal', text(b.color) || '#000000', text(b.alignment) || 'left', bool(b.isDynamic), text(b.sourceTable), text(b.sourceField), text(b.transform), text(b.defaultValue)]);
  res.json({ ok: true, field: rows[0] });
}));

certificatesRouter.put('/certificates/templates/:id/fields/:fieldId', route(async (req, res) => {
  if (!guard(req, res, 'certificates.templates')) return;
  const b = req.body || {};
  const appId = appIdOf(req);
  const rows = await execQ(getPool(), `
    UPDATE school_template_field SET field_key=coalesce($3,field_key), x=coalesce($4,x), y=coalesce($5,y), width=coalesce($6,width), height=coalesce($7,height), font_family=coalesce($8,font_family), font_size=coalesce($9,font_size), font_weight=coalesce($10,font_weight), font_style=coalesce($11,font_style), color=coalesce($12,color), alignment=coalesce($13,alignment), is_dynamic=coalesce($14,is_dynamic), source_table=coalesce($15,source_table), source_field=coalesce($16,source_field), transform=coalesce($17,transform), default_value=coalesce($18,default_value), updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appId, num(req.params.fieldId), text(b.fieldKey), num(b.x), num(b.y), num(b.width), num(b.height), text(b.fontFamily) || 'Arial', num(b.fontSize) || 12, text(b.fontWeight) || 'normal', text(b.fontStyle) || 'normal', text(b.color) || '#000000', text(b.alignment) || 'left', bool(b.isDynamic), text(b.sourceTable), text(b.sourceField), text(b.transform), text(b.defaultValue)]);
  res.json({ ok: true, field: rows[0] });
}));

certificatesRouter.delete('/certificates/templates/:id/fields/:fieldId', route(async (req, res) => {
  if (!guard(req, res, 'certificates.templates')) return;
  const appId = appIdOf(req);
  const rows = await execQ(getPool(), 'DELETE FROM school_template_field WHERE app_id=$1 AND id=$2 RETURNING id', [appId, num(req.params.fieldId)]);
  if (!rows[0]) fail(404, 'Field not found');
  res.json({ ok: true });
}));

// Template Preview
certificatesRouter.get('/certificates/templates/:id/preview', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const studentId = num(req.query.studentId);
  const template = (await execQ(getPool(), `SELECT * FROM school_document_template WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL`, [appIdOf(req), num(req.params.id)]))[0];
  if (!template) fail(404, 'Template not found');
  res.json({ ok: true, template, sampleStudentId: studentId });
}));

// Generation
const CERT_TYPES = ['id_card', 'tc', 'bonafide', 'character', 'migration', 'custom'];
function registerType(templateType) {
  if (templateType === 'id_front' || templateType === 'id_back') return 'id_card';
  return CERT_TYPES.includes(templateType) ? templateType : 'custom';
}
function docNumber(prefix) {
  return `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
}

async function generateOne(appId, user, template, studentId, opts = {}) {
  const certNo = docNumber(opts.prefix || 'GEN');
  const docRows = await execQ(getPool(), `
    INSERT INTO school_generated_document
      (app_id, request_id, certificate_no, template_id, template_version, file_id, generated_by,
       is_reissue, student_id, document_type, status, notes)
    VALUES ($1,NULL,$2,$3,$4,NULL,$5,$6,$7,$8,'generated',$9) RETURNING *
  `, [appId, certNo, template?.id || null, template?.version || 1, user, Boolean(opts.isReissue),
    studentId, template?.type || opts.documentType || 'custom', text(opts.notes)]);
  await execQ(getPool(), `
    INSERT INTO school_certificate_register
      (app_id, student_id, certificate_no, certificate_type, template_id, template_version, issue_date, status, generated_by)
    VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE,'issued',$7)
    ON CONFLICT (app_id, certificate_no) DO NOTHING
  `, [appId, studentId, certNo, registerType(template?.type || opts.documentType), template?.id || null, template?.version || 1, user]);
  return docRows[0];
}

certificatesRouter.get('/certificates/generated', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const studentId = num(req.query.studentId);
  const templateId = num(req.query.templateId);
  const status = text(req.query.status);
  const params = [appIdOf(req)];
  const filters = [];
  if (studentId) { params.push(studentId); filters.push(`d.student_id=$${params.length}`); }
  if (templateId) { params.push(templateId); filters.push(`d.template_id=$${params.length}`); }
  if (status) { params.push(status); filters.push(`d.status=$${params.length}`); }
  const rows = await execQ(getPool(), `
    SELECT d.*, t.name AS template_name, t.type AS template_type,
      s.first_name, s.last_name, s.admission_no, cl.name AS class_name
    FROM school_generated_document d
    LEFT JOIN school_document_template t ON t.id=d.template_id
    LEFT JOIN school_students s ON s.id=d.student_id
    LEFT JOIN school_classes cl ON cl.id=s.class_id
    WHERE d.app_id=$1 ${filters.length ? 'AND ' + filters.join(' AND ') : ''}
    ORDER BY d.generated_at DESC NULLS LAST, d.id DESC LIMIT 500
  `, params);
  res.json({ ok: true, documents: rows });
}));

certificatesRouter.post('/certificates/generate', route(async (req, res) => {
  if (!guard(req, res, 'certificates.templates')) return;
  const b = req.body || {};
  if (!num(b.templateId) || !num(b.studentId)) fail(400, 'Template and student required');
  const appId = appIdOf(req);
  const template = (await execQ(getPool(), `SELECT * FROM school_document_template WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL`, [appId, num(b.templateId)]))[0];
  if (!template) fail(404, 'Template not found');
  const student = (await execQ(getPool(), `SELECT * FROM school_students WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL`, [appId, num(b.studentId)]))[0];
  if (!student) fail(404, 'Student not found');
  const document = await generateOne(appId, userOf(req), template, student.id, { isReissue: b.isReissue, notes: b.notes });
  await writeAudit(getPool(), req, { action: 'certificates.generate', entity: 'school_generated_document', entityId: document.id, after: document });
  res.json({ ok: true, document });
}));

certificatesRouter.post('/certificates/generate/bulk', route(async (req, res) => {
  if (!guard(req, res, 'certificates.templates')) return;
  const b = req.body || {};
  if (!num(b.templateId)) fail(400, 'Template required');
  const appId = appIdOf(req);
  const template = (await execQ(getPool(), `SELECT * FROM school_document_template WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL`, [appId, num(b.templateId)]))[0];
  if (!template) fail(404, 'Template not found');
  let students = [];
  if (Array.isArray(b.studentIds) && b.studentIds.length) {
    students = await execQ(getPool(), `SELECT * FROM school_students WHERE app_id=$1 AND deleted_at IS NULL AND id = ANY($2::int[])`, [appId, b.studentIds.map(Number).filter(Boolean)]);
  } else if (num(b.classId)) {
    students = await execQ(getPool(), `SELECT * FROM school_students WHERE app_id=$1 AND deleted_at IS NULL AND status='active' AND class_id=$2 ${num(b.sectionId) ? 'AND section_id=$3' : ''} ORDER BY first_name`, [appId, num(b.classId), num(b.sectionId)].filter(Boolean));
  } else {
    students = await execQ(getPool(), `SELECT * FROM school_students WHERE app_id=$1 AND deleted_at IS NULL AND status='active' ORDER BY first_name LIMIT 1000`, [appId]);
  }
  if (!students.length) fail(400, 'No students matched the selection');
  const documents = [];
  const errors = [];
  for (const student of students) {
    try {
      documents.push(await generateOne(appId, userOf(req), template, student.id, { isReissue: b.isReissue, notes: b.notes }));
    } catch (e) {
      errors.push({ studentId: student.id, error: e.message });
    }
  }
  await writeAudit(getPool(), req, { action: 'certificates.generate.bulk', entity: 'school_generated_document', after: { templateId: template.id, generated: documents.length, failed: errors.length } });
  res.json({ ok: true, generated: documents.length, failed: errors.length, documents, errors });
}));

certificatesRouter.delete('/certificates/generated/:id', route(async (req, res) => {
  if (!guard(req, res, 'certificates.templates')) return;
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `UPDATE school_generated_document SET status='cancelled' WHERE app_id=$1 AND id=$2 RETURNING id`, [appIdOf(req), id]);
  if (!rows[0]) fail(404, 'Document not found');
  res.json({ ok: true });
}));

// ID Cards
certificatesRouter.get('/certificates/idcards', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const sessionId = num(req.query.sessionId);
  const status = text(req.query.status);
  const rows = await execQ(getPool(), `SELECT i.*, s.first_name, s.last_name, s.admission_no, cl.name as class_name FROM school_id_card i LEFT JOIN school_students s ON s.id=i.student_id LEFT JOIN school_classes cl ON cl.id=s.class_id WHERE i.app_id=$1 AND i.deleted_at IS NULL ${sessionId ? 'AND i.session_id=$2' : ''} ${status ? 'AND i.status=$3' : ''} ORDER BY i.issue_date DESC LIMIT 500`, [appIdOf(req), sessionId, status].filter(Boolean));
  res.json({ ok: true, idcards: rows });
}));

async function defaultSessionId(appId) {
  const rows = await execQ(getPool(), `SELECT id FROM school_academic_years WHERE app_id=$1 AND is_active=true ORDER BY id DESC LIMIT 1`, [appId]);
  if (rows[0]) return rows[0].id;
  const any = await execQ(getPool(), `SELECT id FROM school_academic_years WHERE app_id=$1 ORDER BY id DESC LIMIT 1`, [appId]);
  return any[0]?.id || null;
}

certificatesRouter.post('/certificates/idcards', route(async (req, res) => {
  if (!guard(req, res, 'certificates.idcards')) return;
  const b = req.body || {};
  if (!num(b.studentId)) fail(400, 'Student required');
  const appId = appIdOf(req);
  const sessionId = num(b.sessionId) || await defaultSessionId(appId);
  const existing = await execQ(getPool(), `SELECT id FROM school_id_card WHERE app_id=$1 AND student_id=$2 AND session_id=$3 AND status IN ('active','reissued') AND deleted_at IS NULL`, [appId, num(b.studentId), sessionId]);
  if (existing[0]) fail(409, 'An active ID card already exists for this student and session');
  const rows = await execQ(getPool(), `
    INSERT INTO school_id_card (app_id, student_id, session_id, front_template_id, back_template_id, issue_date, status, issued_by)
    VALUES ($1,$2,$3,$4,$5,$6,'active',$7) RETURNING *
  `, [appId, num(b.studentId), sessionId, num(b.frontTemplateId), num(b.backTemplateId), dayOf(b.issueDate) || dayOf(new Date()), userOf(req)]);
  await execQ(getPool(), `INSERT INTO school_id_card_history (app_id, id_card_id, action, action_by) VALUES ($1,$2,'issued',$3)`, [appId, rows[0].id, userOf(req)]);
  await writeAudit(getPool(), req, { action: 'certificates.idcard.create', entity: 'school_id_card', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, idcard: rows[0] });
}));

certificatesRouter.post('/certificates/idcards/bulk', route(async (req, res) => {
  if (!guard(req, res, 'certificates.idcards')) return;
  const b = req.body || {};
  const appId = appIdOf(req);
  const sessionId = num(b.sessionId) || await defaultSessionId(appId);
  if (!sessionId) fail(400, 'Academic session required');
  let students = [];
  if (Array.isArray(b.studentIds) && b.studentIds.length) {
    students = await execQ(getPool(), `SELECT id FROM school_students WHERE app_id=$1 AND deleted_at IS NULL AND id = ANY($2::int[])`, [appId, b.studentIds.map(Number).filter(Boolean)]);
  } else if (num(b.classId)) {
    students = await execQ(getPool(), `SELECT id FROM school_students WHERE app_id=$1 AND deleted_at IS NULL AND status='active' AND class_id=$2 ${num(b.sectionId) ? 'AND section_id=$3' : ''} ORDER BY first_name`, [appId, num(b.classId), num(b.sectionId)].filter(Boolean));
  } else {
    students = await execQ(getPool(), `SELECT id FROM school_students WHERE app_id=$1 AND deleted_at IS NULL AND status='active' ORDER BY first_name LIMIT 1000`, [appId]);
  }
  if (!students.length) fail(400, 'No students matched the selection');
  const cards = [];
  let skipped = 0;
  for (const student of students) {
    const existing = await execQ(getPool(), `SELECT id FROM school_id_card WHERE app_id=$1 AND student_id=$2 AND session_id=$3 AND status IN ('active','reissued') AND deleted_at IS NULL`, [appId, student.id, sessionId]);
    if (existing[0]) { skipped += 1; continue; }
    const rows = await execQ(getPool(), `
      INSERT INTO school_id_card (app_id, student_id, session_id, front_template_id, back_template_id, issue_date, status, issued_by)
      VALUES ($1,$2,$3,$4,$5,CURRENT_DATE,'active',$6) RETURNING *
    `, [appId, student.id, sessionId, num(b.frontTemplateId), num(b.backTemplateId), userOf(req)]);
    await execQ(getPool(), `INSERT INTO school_id_card_history (app_id, id_card_id, action, action_by) VALUES ($1,$2,'issued',$3)`, [appId, rows[0].id, userOf(req)]);
    cards.push(rows[0]);
  }
  res.json({ ok: true, generated: cards.length, skipped, idcards: cards });
}));

certificatesRouter.put('/certificates/idcards/:id', route(async (req, res) => {
  if (!guard(req, res, 'certificates.idcards')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `
    UPDATE school_id_card SET status=coalesce($3,status), expiry_date=coalesce($4,expiry_date), updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), id, text(b.status), dayOf(b.expiryDate)]);
  if (!rows[0]) fail(404, 'ID card not found');
  res.json({ ok: true, idcard: rows[0] });
}));

certificatesRouter.delete('/certificates/idcards/:id', route(async (req, res) => {
  if (!guard(req, res, 'certificates.idcards')) return;
  const id = num(req.params.id);
  const rows = await execQ(getPool(), 'UPDATE school_id_card SET deleted_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id', [appIdOf(req), id]);
  if (!rows[0]) fail(404, 'ID card not found');
  res.json({ ok: true });
}));

certificatesRouter.post('/certificates/idcards/:id/reissue', route(async (req, res) => {
  if (!guard(req, res, 'certificates.idcards')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  const reason = text(b.reason) || 'reissue';
  const rows = await execQ(getPool(), `
    UPDATE school_id_card SET status='reissued', updated_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), id]);
  if (!rows[0]) fail(404, 'ID card not found');
  const oldCard = rows[0];
  const newRows = await execQ(getPool(), `
    INSERT INTO school_id_card (app_id, student_id, session_id, front_template_id, back_template_id, issue_date, status, issued_by)
    VALUES ($1,$2,$3,$4,$5,$6,'active',$7) RETURNING *
  `, [appIdOf(req), oldCard.student_id, oldCard.session_id, oldCard.front_template_id, oldCard.back_template_id, dayOf(new Date()), userOf(req)]);
  await execQ(getPool(), `INSERT INTO school_id_card_history (app_id, id_card_id, action, reason, action_by) VALUES ($1,$2,'reissued',$3,$4)`, [appIdOf(req), id, reason, userOf(req)]);
  res.json({ ok: true, idcard: newRows[0] });
}));

// TC Certificate
certificatesRouter.post('/certificates/tc/apply', route(async (req, res) => {
  if (!guard(req, res, 'certificates.tc')) return;
  const b = req.body || {};
  if (!num(b.studentId) || !b.leavingDate) fail(400, 'Student and leaving date required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_tc_request (app_id, student_id, leaving_date, reason, requested_by)
    VALUES ($1,$2,$3,$4,$5) RETURNING *
  `, [appIdOf(req), num(b.studentId), dayOf(b.leavingDate), text(b.reason), userOf(req)]);
  res.json({ ok: true, request: rows[0] });
}));

certificatesRouter.get('/certificates/tc/requests', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const status = text(req.query.status);
  const rows = await execQ(getPool(), `SELECT t.*, s.first_name, s.last_name, s.admission_no, cl.name AS class_name FROM school_tc_request t LEFT JOIN school_students s ON s.id=t.student_id LEFT JOIN school_classes cl ON cl.id=s.class_id WHERE t.app_id=$1 AND t.deleted_at IS NULL ${status ? 'AND t.status=$2' : ''} ORDER BY t.requested_at DESC`, [appIdOf(req), status].filter(Boolean));
  res.json({ ok: true, requests: rows });
}));

certificatesRouter.get('/certificates/tc/requests/:id/clearance', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const id = num(req.params.id);
  const request = (await execQ(getPool(), `SELECT * FROM school_tc_request WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL`, [appIdOf(req), id]))[0];
  if (!request) return res.json({ ok: true, clearance: { fee: true, library: true, hostel: true, lab: true } });
  res.json({ ok: true, clearance: { fee: true, library: true, hostel: true, lab: true } });
}));

certificatesRouter.post('/certificates/tc/requests/:id/approve', route(async (req, res) => {
  if (!guard(req, res, 'certificates.tc')) return;
  const id = num(req.params.id);
  const appId = appIdOf(req);
  const request = (await execQ(getPool(), `SELECT * FROM school_tc_request WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL`, [appId, id]))[0];
  if (!request) fail(404, 'Request not found');
  const tcNumber = docNumber('TC');
  const rows = await execQ(getPool(), `
    UPDATE school_tc_request SET status='generated', processed_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appId, id]);
  await execQ(getPool(), `
    INSERT INTO school_tc_approval (app_id, tc_request_id, approver_id, clearance_fee, clearance_library, clearance_hostel, clearance_lab, status, tc_number, approved_at)
    VALUES ($1,$2,$3,true,true,true,true,'approved',$4,now())
    ON CONFLICT (app_id, tc_request_id) DO UPDATE SET status='approved', tc_number=$4, approved_at=now()
  `, [appId, id, num(req.body?.approverId), tcNumber]);
  const template = (await execQ(getPool(), `SELECT * FROM school_document_template WHERE app_id=$1 AND type='tc' AND deleted_at IS NULL ORDER BY id LIMIT 1`, [appId]))[0];
  const document = await generateOne(appId, userOf(req), template, request.student_id, { prefix: 'TC', documentType: 'tc', notes: `TC request #${id}` });
  await execQ(getPool(), 'UPDATE school_students SET status=\'left\' WHERE app_id=$1 AND id=$2', [appId, request.student_id]);
  await writeAudit(getPool(), req, { action: 'certificates.tc.approve', entity: 'school_tc_request', entityId: id, after: { tcNumber, documentId: document.id } });
  res.json({ ok: true, tcNumber, document });
}));

certificatesRouter.post('/certificates/tc/requests/:id/reject', route(async (req, res) => {
  if (!guard(req, res, 'certificates.tc')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `
    UPDATE school_tc_request SET status='rejected', processed_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), id]);
  if (!rows[0]) fail(404, 'Request not found');
  await execQ(getPool(), `
    INSERT INTO school_tc_approval (app_id, tc_request_id, approver_id, status, remarks)
    VALUES ($1,$2,$3,'rejected',$4)
    ON CONFLICT (app_id, tc_request_id) DO UPDATE SET status='rejected', remarks=$4
  `, [appIdOf(req), id, num(b.approverId), text(b.reason)]);
  res.json({ ok: true });
}));

certificatesRouter.get('/certificates/tc/register', route(async (req, res) => {
  if (!guardView(req, res, 'certificates.reports')) return;
  const rows = await execQ(getPool(), `SELECT r.*, s.first_name, s.last_name FROM school_certificate_register r LEFT JOIN school_students s ON s.id=r.student_id WHERE r.app_id=$1 ORDER BY r.issue_date DESC LIMIT 500`, [appIdOf(req)]);
  res.json({ ok: true, register: rows });
}));
certificatesRouter.get('/certificates/tc/verify/:certNo', route(async (req, res) => {
  const certNo = text(req.params.certNo);
  const row = (await execQ(getPool(), `SELECT certificate_no, certificate_type, issue_date, status FROM school_certificate_register WHERE app_id=$1 AND certificate_no=$2`, [appIdOf(req), certNo]))[0];
  if (!row) return res.json({ ok: true, valid: false, message: 'Certificate not found' });
  res.json({ ok: true, valid: row.status === 'issued', certificate: row });
}));
export { certificatesRouter };