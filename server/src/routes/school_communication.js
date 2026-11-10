/* ============================================================
   Communication — backend routes
   Mounted at /api/school before the legacy comprehensive router.
   ============================================================ */
import express from 'express';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { ensureFoundation, loadAccess, writeAudit } from '../school/foundation.js';

const communicationRouter = express.Router();

communicationRouter.use(verifyToken);
communicationRouter.use(async (req, _res, next) => {
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
const tsOf = (v) => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString(); };
const slugCode = (v) => String(v || 'template').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'template';
const uniqueCode = (prefix, v) => `${prefix}_${slugCode(v)}_${Date.now().toString(36)}`;
const appIdOf = (req) => req.school?.appId || 'default';
const userOf = (req) => req.user?.userid || req.user?.id || 'system';
const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };

function guard(req, res, perm) {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('communication.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}
function guardView(req, res, perm = 'communication.view') {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('communication.view') || perms.includes('communication.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

async function withTx(fn) {
  const client = await getPool().connect();
  try { await client.query('BEGIN'); const out = await fn(client); await client.query('COMMIT'); return out; }
  catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; }
  finally { client.release(); }
}

// Dashboard
communicationRouter.get('/communication/dashboard', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const [summary] = await execQ(pool, `
    SELECT
      (SELECT count(*)::int FROM school_communication_template WHERE app_id=$1 AND deleted_at IS NULL) AS templates,
      (SELECT count(*)::int FROM school_communication_message WHERE app_id=$1 AND status IN ('queued','sending')) AS pending,
      (SELECT count(*)::int FROM school_communication_message WHERE app_id=$1 AND status='sent' AND sent_at >= CURRENT_DATE) AS sent_today,
      (SELECT count(*)::int FROM school_communication_message WHERE app_id=$1 AND status='failed') AS failed,
      (SELECT count(*)::int FROM school_notice_board WHERE app_id=$1 AND is_published AND deleted_at IS NULL) AS active_notices
  `, [appId]);
  res.json({ ok: true, summary });
}));

// Templates
communicationRouter.get('/communication/templates', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const channel = text(req.query.channel) || text(req.query.type);
  const rows = await execQ(getPool(), `SELECT * FROM school_communication_template WHERE app_id=$1 AND deleted_at IS NULL ${channel ? 'AND channel=$2' : ''} ORDER BY created_at DESC`, [appIdOf(req), channel].filter(Boolean));
  res.json({ ok: true, templates: rows });
}));

communicationRouter.post('/communication/templates', route(async (req, res) => {
  if (!guard(req, res, 'communication.templates')) return;
  const b = req.body || {};
  const channel = text(b.channel) || text(b.type) || 'sms';
  if (!text(b.name)) fail(400, 'Name is required');
  if (!['sms', 'email', 'push', 'notice'].includes(channel)) fail(400, 'Invalid channel');
  const bodyText = text(b.bodyText) || text(b.body) || text(b.content);
  const rows = await execQ(getPool(), `
    INSERT INTO school_communication_template
      (app_id, code, name, channel, subject, body_text, body_html, variables, language, is_active, description, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12) RETURNING *
  `, [appIdOf(req), text(b.code) || uniqueCode('tpl', b.name), text(b.name), channel,
    text(b.subject), bodyText, text(b.bodyHtml), JSON.stringify(Array.isArray(b.variables) ? b.variables : []),
    text(b.language) || 'en', bool(b.isActive, true), text(b.description), userOf(req)]);
  await writeAudit(getPool(), req, { action: 'communication.template.create', entity: 'school_communication_template', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, template: rows[0] });
}));

communicationRouter.put('/communication/templates/:id', route(async (req, res) => {
  if (!guard(req, res, 'communication.templates')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  const channel = text(b.channel) || text(b.type);
  const bodyText = text(b.bodyText) || text(b.body) || text(b.content);
  const rows = await execQ(getPool(), `
    UPDATE school_communication_template SET
      name=coalesce($3,name), channel=coalesce($4,channel), subject=coalesce($5,subject),
      body_text=coalesce($6,body_text), body_html=coalesce($7,body_html),
      variables=coalesce($8::jsonb,variables), language=coalesce($9,language),
      is_active=coalesce($10,is_active), description=coalesce($11,description), updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), id, text(b.name), channel, text(b.subject), bodyText, text(b.bodyHtml),
    Array.isArray(b.variables) ? JSON.stringify(b.variables) : null, text(b.language),
    b.isActive === undefined ? null : bool(b.isActive), text(b.description)]);
  if (!rows[0]) fail(404, 'Template not found');
  await writeAudit(getPool(), req, { action: 'communication.template.update', entity: 'school_communication_template', entityId: id, after: rows[0] });
  res.json({ ok: true, template: rows[0] });
}));

communicationRouter.delete('/communication/templates/:id', route(async (req, res) => {
  if (!guard(req, res, 'communication.templates')) return;
  const id = num(req.params.id);
  const rows = await execQ(getPool(), 'UPDATE school_communication_template SET deleted_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id', [appIdOf(req), id]);
  if (!rows[0]) fail(404, 'Template not found');
  await writeAudit(getPool(), req, { action: 'communication.template.delete', entity: 'school_communication_template', entityId: id });
  res.json({ ok: true });
}));

// Messages (SMS/Email/Push)
communicationRouter.get('/communication/messages', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const status = text(req.query.status);
  const channel = text(req.query.channel);
  const rows = await execQ(getPool(), `
    SELECT m.*
    FROM school_communication_message m
    WHERE m.app_id=$1 AND m.deleted_at IS NULL
    ${status ? 'AND m.status=$2' : ''}
    ${channel ? 'AND m.channel=$' + (status ? '3' : '2') : ''}
    ORDER BY m.created_at DESC LIMIT 500
  `, [appIdOf(req), status, channel].filter(Boolean));
  res.json({ ok: true, messages: rows });
}));

communicationRouter.post('/communication/messages', route(async (req, res) => {
  if (!guard(req, res, 'communication.sms')) return;
  const b = req.body || {};
  const content = text(b.bodyText) || text(b.body) || text(b.content);
  const channel = text(b.channel);
  if (!content || !channel) fail(400, 'Content and channel required');
  if (!['sms', 'email', 'push', 'notice'].includes(channel)) fail(400, 'Invalid channel');
  const rows = await execQ(getPool(), `
    INSERT INTO school_communication_message
      (app_id, message_id, template_id, channel, subject, body_text, body_html, recipient_count, status, scheduled_at, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'queued',$9,$10) RETURNING *
  `, [appIdOf(req), uniqueCode('msg', channel), num(b.templateId), channel, text(b.subject), content,
    text(b.bodyHtml), num(b.recipientCount) || 0, tsOf(b.scheduledAt), userOf(req)]);
  res.json({ ok: true, message: rows[0] });
}));

// Notice Board
const NOTICE_AUDIENCES = ['all', 'students', 'parents', 'staff', 'class', 'section', 'custom'];
const NOTICE_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
function noticeAudience(v) {
  const a = text(v);
  if (a === 'classes') return 'class';
  if (a === 'sections') return 'section';
  return NOTICE_AUDIENCES.includes(a) ? a : 'all';
}
function noticePriority(v) {
  const p = text(v);
  if (p === 'important') return 'high';
  return NOTICE_PRIORITIES.includes(p) ? p : 'normal';
}

communicationRouter.get('/communication/notices', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const status = text(req.query.status);
  const filter = status === 'published' ? 'AND n.is_published=true' : status === 'draft' ? 'AND n.is_published=false' : '';
  const rows = await execQ(getPool(), `
    SELECT n.*, n.body_html AS description,
      CASE WHEN n.is_published THEN 'published' ELSE 'draft' END AS status
    FROM school_notice_board n
    WHERE n.app_id=$1 AND n.deleted_at IS NULL ${filter}
    ORDER BY n.is_pinned DESC, n.publish_at DESC NULLS LAST, n.created_at DESC LIMIT 200
  `, [appIdOf(req)]);
  res.json({ ok: true, notices: rows });
}));

communicationRouter.post('/communication/notices', route(async (req, res) => {
  if (!guard(req, res, 'communication.notice')) return;
  const b = req.body || {};
  if (!text(b.title)) fail(400, 'Title required');
  const isPublished = b.isPublished !== undefined ? bool(b.isPublished) : text(b.status) === 'published';
  const targetIds = Array.isArray(b.targetIds) ? b.targetIds.map(Number).filter(Boolean)
    : (num(b.targetId) ? [num(b.targetId)] : []);
  const rows = await execQ(getPool(), `
    INSERT INTO school_notice_board
      (app_id, notice_id, title, body_html, priority, audience, target_ids, publish_at, expire_at,
       is_pinned, is_published, published_at, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13) RETURNING *
  `, [appIdOf(req), uniqueCode('notice', b.title), text(b.title), text(b.description) || text(b.bodyHtml) || '',
    noticePriority(b.priority), noticeAudience(b.audience || b.audienceType), JSON.stringify(targetIds),
    tsOf(b.publishAt || b.publishDate) || new Date().toISOString(), tsOf(b.expireAt || b.expiryDate),
    bool(b.isPinned), isPublished, isPublished ? new Date().toISOString() : null, userOf(req)]);
  await writeAudit(getPool(), req, { action: 'communication.notice.create', entity: 'school_notice_board', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, notice: rows[0] });
}));

communicationRouter.put('/communication/notices/:id', route(async (req, res) => {
  if (!guard(req, res, 'communication.notice')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  const isPublished = b.isPublished !== undefined ? bool(b.isPublished)
    : (b.status === undefined ? null : text(b.status) === 'published');
  const targetIds = Array.isArray(b.targetIds) ? JSON.stringify(b.targetIds.map(Number).filter(Boolean))
    : (num(b.targetId) ? JSON.stringify([num(b.targetId)]) : null);
  const rows = await execQ(getPool(), `
    UPDATE school_notice_board SET
      title=coalesce($3,title), body_html=coalesce($4,body_html), priority=coalesce($5,priority),
      audience=coalesce($6,audience), target_ids=coalesce($7::jsonb,target_ids),
      publish_at=coalesce($8,publish_at), expire_at=coalesce($9,expire_at),
      is_pinned=coalesce($10,is_pinned), is_published=coalesce($11,is_published),
      published_at=CASE WHEN $11::boolean IS TRUE THEN coalesce(published_at, now()) ELSE published_at END,
      updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), id, text(b.title), text(b.description) || text(b.bodyHtml),
    b.priority === undefined ? null : noticePriority(b.priority),
    (b.audience === undefined && b.audienceType === undefined) ? null : noticeAudience(b.audience || b.audienceType),
    targetIds, tsOf(b.publishAt || b.publishDate), tsOf(b.expireAt || b.expiryDate),
    b.isPinned === undefined ? null : bool(b.isPinned), isPublished]);
  if (!rows[0]) fail(404, 'Notice not found');
  await writeAudit(getPool(), req, { action: 'communication.notice.update', entity: 'school_notice_board', entityId: id, after: rows[0] });
  res.json({ ok: true, notice: rows[0] });
}));

communicationRouter.delete('/communication/notices/:id', route(async (req, res) => {
  if (!guard(req, res, 'communication.notice')) return;
  const id = num(req.params.id);
  const rows = await execQ(getPool(), 'UPDATE school_notice_board SET deleted_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id', [appIdOf(req), id]);
  if (!rows[0]) fail(404, 'Notice not found');
  await writeAudit(getPool(), req, { action: 'communication.notice.delete', entity: 'school_notice_board', entityId: id });
  res.json({ ok: true });
}));

// App Notifications
communicationRouter.get('/communication/app-notifications', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const userId = num(req.query.userId);
  const rows = await execQ(getPool(), `
    SELECT n.*, (n.status='read' OR n.read_at IS NOT NULL) AS is_read
    FROM school_app_notification n
    WHERE n.app_id=$1 ${userId ? 'AND n.user_id=$2' : ''}
    ORDER BY n.created_at DESC LIMIT 200
  `, [appIdOf(req), userId].filter(Boolean));
  res.json({ ok: true, notifications: rows });
}));

communicationRouter.post('/communication/app-notifications', route(async (req, res) => {
  if (!guard(req, res, 'communication.app')) return;
  const b = req.body || {};
  const userType = ['student', 'parent', 'staff'].includes(text(b.userType)) ? text(b.userType) : 'staff';
  if (!text(b.title) || !num(b.userId) || !text(b.body)) fail(400, 'Title, user and body are required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_app_notification
      (app_id, notification_id, user_type, user_id, title, body, data_json, channel, priority, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'in_app',$8,'sent') RETURNING *
  `, [appIdOf(req), uniqueCode('ntf', b.title), userType, num(b.userId), text(b.title), text(b.body),
    JSON.stringify(b.data || {}), ['low', 'normal', 'high', 'urgent'].includes(text(b.priority)) ? text(b.priority) : 'normal']);
  res.json({ ok: true, notification: rows[0] });
}));

communicationRouter.put('/communication/app-notifications/:id/read', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `UPDATE school_app_notification SET status='read', read_at=now(), updated_at=now() WHERE app_id=$1 AND id=$2 RETURNING *, true AS is_read`, [appIdOf(req), id]);
  if (!rows[0]) fail(404, 'Notification not found');
  res.json({ ok: true, notification: rows[0] });
}));

export { communicationRouter };