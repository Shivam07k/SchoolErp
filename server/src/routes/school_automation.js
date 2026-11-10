/* ============================================================
   Automation Center — Backend Routes
   Mounted at /api/school/automation
   ============================================================ */
import express from 'express';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { ensureFoundation, loadAccess, writeAudit } from '../school/foundation.js';

const automationRouter = express.Router();

automationRouter.use(verifyToken);
automationRouter.use(async (req, _res, next) => {
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
const bool = (v, def = false) => v === undefined || v === null ? def : (v === true || v === 'true' || v === 1 || v === '1');
const tsOf = (v) => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString(); };
const appIdOf = (req) => req.user?.company || DEFAULT_COMPANY_ID;
const userOf = (req) => req.user?.userid || req.user?.sub || 'SYSTEM';
const guardView = (req, res) => { if (!req.school?.permissions?.includes('automation.view') && !req.school?.isSuper) { res.status(403).json({ ok: false, error: 'Insufficient permissions' }); return false; } return true; };
const guard = (req, res, perm) => { if (!req.school?.permissions?.includes(perm) && !req.school?.isSuper) { res.status(403).json({ ok: false, error: 'Insufficient permissions' }); return false; } return true; };
const fail = (code, msg) => { const e = new Error(msg); e.statusCode = code; throw e; };

function route(fn) {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (e) {
      const code = e.statusCode || 500;
      res.status(code).json({ ok: false, error: e.message || 'Internal error' });
    }
  };
}

/* ---------- Dashboard Summary ---------- */
automationRouter.get('/dashboard', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const [rules, runs, logs, providers] = await Promise.all([
    execQ(pool, `SELECT count(*)::int as total, count(*) FILTER (WHERE is_active) as active FROM school_automation_rule WHERE app_id=$1 AND deleted_at IS NULL`, [appId]),
    execQ(pool, `SELECT count(*)::int as total, count(*) FILTER (WHERE status='completed') as completed, count(*) FILTER (WHERE status='failed') as failed FROM school_automation_run WHERE app_id=$1 AND started_at >= CURRENT_DATE`, [appId]),
    execQ(pool, `SELECT count(*)::int as total, count(*) FILTER (WHERE status='sent') as sent, count(*) FILTER (WHERE status='failed') as failed FROM school_automation_log WHERE app_id=$1 AND created_at >= CURRENT_DATE`, [appId]),
    execQ(pool, `SELECT count(*)::int as total, count(*) FILTER (WHERE is_active) as active FROM school_automation_provider WHERE app_id=$1 AND deleted_at IS NULL`, [appId]),
  ]);
  res.json({ ok: true, summary: { rules: rules[0], runs_today: runs[0], logs_today: logs[0], providers: providers[0] } });
}));

/* ---------- Rules ---------- */
automationRouter.get('/rules', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `SELECT * FROM school_automation_rule WHERE app_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC`, [appIdOf(req)]);
  res.json({ ok: true, rules: rows });
}));

automationRouter.post('/rules', route(async (req, res) => {
  if (!guard(req, res, 'automation.rules')) return;
  const b = req.body || {};
  if (!text(b.name) || !text(b.event_type)) fail(400, 'Name and event_type required');
  const code = text(b.code) || text(b.name).toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
  const rows = await execQ(getPool(), `
    INSERT INTO school_automation_rule (app_id, code, name, description, event_type, event_config, conditions, channels, templates, schedule_cron, schedule_timezone, is_active, created_by)
    VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9::jsonb,$10,$11,$12,$13) RETURNING *
  `, [appIdOf(req), code, text(b.name), text(b.description), text(b.event_type),
      JSON.stringify(b.event_config || {}), JSON.stringify(b.conditions || {}),
      Array.isArray(b.channels) ? b.channels : [], JSON.stringify(b.templates || {}),
      text(b.schedule_cron), text(b.schedule_timezone) || 'Asia/Kolkata', bool(b.is_active, true), userOf(req)]);
  await writeAudit(getPool(), req, { action: 'automation.rule.create', entity: 'school_automation_rule', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, rule: rows[0] });
}));

automationRouter.get('/rules/:id', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `SELECT * FROM school_automation_rule WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL`, [appIdOf(req), id]);
  if (!rows[0]) return fail(404, 'Rule not found');
  res.json({ ok: true, rule: rows[0] });
}));

automationRouter.put('/rules/:id', route(async (req, res) => {
  if (!guard(req, res, 'automation.rules')) return;
  const id = num(req.params.id);
  const b = req.body || {};
  const rows = await execQ(getPool(), `
    UPDATE school_automation_rule SET
      name=coalesce($3,name), description=coalesce($4,description), event_type=coalesce($5,event_type),
      event_config=coalesce($6::jsonb,event_config), conditions=coalesce($7::jsonb,conditions),
      channels=coalesce($8,channels), templates=coalesce($9::jsonb,templates),
      schedule_cron=coalesce($10,schedule_cron), schedule_timezone=coalesce($11,schedule_timezone),
      is_active=coalesce($12,is_active), updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), id, text(b.name), text(b.description), text(b.event_type),
      b.event_config ? JSON.stringify(b.event_config) : null, b.conditions ? JSON.stringify(b.conditions) : null,
      Array.isArray(b.channels) ? b.channels : null, b.templates ? JSON.stringify(b.templates) : null,
      text(b.schedule_cron), text(b.schedule_timezone), b.isActive === undefined ? null : bool(b.isActive)]);
  if (!rows[0]) return fail(404, 'Rule not found');
  await writeAudit(getPool(), req, { action: 'automation.rule.update', entity: 'school_automation_rule', entityId: id, after: rows[0] });
  res.json({ ok: true, rule: rows[0] });
}));

automationRouter.post('/rules/:id/toggle', route(async (req, res) => {
  if (!guard(req, res, 'automation.rules')) return;
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `UPDATE school_automation_rule SET is_active = NOT is_active, updated_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id, is_active`, [appIdOf(req), id]);
  if (!rows[0]) return fail(404, 'Rule not found');
  await writeAudit(getPool(), req, { action: 'automation.rule.toggle', entity: 'school_automation_rule', entityId: id, after: rows[0] });
  res.json({ ok: true, rule: rows[0] });
}));

automationRouter.post('/rules/:id/test', route(async (req, res) => {
  if (!guard(req, res, 'automation.rules')) return;
  const id = num(req.params.id);
  const testPayload = req.body || {};
  // TODO: Implement test run logic
  res.json({ ok: true, message: 'Test run queued (not implemented yet)', testPayload });
}));

automationRouter.delete('/rules/:id', route(async (req, res) => {
  if (!guard(req, res, 'automation.rules')) return;
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `UPDATE school_automation_rule SET deleted_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id`, [appIdOf(req), id]);
  if (!rows[0]) return fail(404, 'Rule not found');
  await writeAudit(getPool(), req, { action: 'automation.rule.delete', entity: 'school_automation_rule', entityId: id });
  res.json({ ok: true });
}));

/* ---------- Runs ---------- */
automationRouter.get('/runs', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const { ruleId, status, limit } = req.query;
  let sql = `SELECT r.*, ru.name AS rule_name FROM school_automation_run r LEFT JOIN school_automation_rule ru ON ru.id = r.rule_id WHERE r.app_id=$1`;
  const params = [appIdOf(req)];
  let paramIdx = 2;
  if (ruleId) { sql += ` AND r.rule_id=$${paramIdx}`; params.push(num(ruleId)); paramIdx++; }
  if (status) { sql += ` AND r.status=$${paramIdx}`; params.push(text(status)); paramIdx++; }
  sql += ` ORDER BY r.started_at DESC LIMIT ${Math.min(num(limit) || 50, 200)}`;
  const rows = await execQ(getPool(), sql, params);
  res.json({ ok: true, runs: rows });
}));

automationRouter.get('/runs/:id', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `SELECT * FROM school_automation_run WHERE app_id=$1 AND id=$2`, [appIdOf(req), id]);
  if (!rows[0]) return fail(404, 'Run not found');
  res.json({ ok: true, run: rows[0] });
}));

/* ---------- Logs ---------- */
automationRouter.get('/logs', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const { runId, channel, status, limit } = req.query;
  let sql = `SELECT l.*, r.name AS rule_name FROM school_automation_log l LEFT JOIN school_automation_rule r ON r.id = l.rule_id WHERE l.app_id=$1`;
  const params = [appIdOf(req)];
  let paramIdx = 2;
  if (runId) { sql += ` AND l.run_id=$${paramIdx}`; params.push(num(runId)); paramIdx++; }
  if (channel) { sql += ` AND l.channel=$${paramIdx}`; params.push(text(channel)); paramIdx++; }
  if (status) { sql += ` AND l.status=$${paramIdx}`; params.push(text(status)); paramIdx++; }
  sql += ` ORDER BY l.created_at DESC LIMIT ${Math.min(num(limit) || 100, 500)}`;
  const rows = await execQ(getPool(), sql, params);
  res.json({ ok: true, logs: rows });
}));

/* ---------- Templates ---------- */
automationRouter.get('/templates', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const { channel } = req.query;
  const rows = await execQ(getPool(), `SELECT * FROM school_automation_template WHERE app_id=$1 AND deleted_at IS NULL ${channel ? 'AND channel=$2' : ''} ORDER BY channel, name`, [appIdOf(req), channel].filter(Boolean));
  res.json({ ok: true, templates: rows });
}));

automationRouter.post('/templates', route(async (req, res) => {
  if (!guard(req, res, 'automation.templates')) return;
  const b = req.body || {};
  if (!text(b.name) || !text(b.channel)) fail(400, 'Name and channel required');
  if (!['sms', 'email', 'push', 'in_app', 'webhook'].includes(text(b.channel))) fail(400, 'Invalid channel');
  const code = text(b.code) || text(b.name).toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
  const rows = await execQ(getPool(), `
    INSERT INTO school_automation_template (app_id, code, name, channel, subject, body_text, body_html, variables, webhook_url, webhook_method, webhook_headers, is_active, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11::jsonb,$12,$13) RETURNING *
  `, [appIdOf(req), code, text(b.name), text(b.channel), text(b.subject), text(b.body_text), text(b.body_html),
      JSON.stringify(Array.isArray(b.variables) ? b.variables : []), text(b.webhook_url), text(b.webhook_method) || 'POST',
      JSON.stringify(b.webhook_headers || {}), bool(b.isActive, true), userOf(req)]);
  await writeAudit(getPool(), req, { action: 'automation.template.create', entity: 'school_automation_template', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, template: rows[0] });
}));

automationRouter.get('/templates/:id', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `SELECT * FROM school_automation_template WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL`, [appIdOf(req), id]);
  if (!rows[0]) return fail(404, 'Template not found');
  res.json({ ok: true, template: rows[0] });
}));

automationRouter.put('/templates/:id', route(async (req, res) => {
  if (!guard(req, res, 'automation.templates')) return;
  const id = num(req.params.id);
  const b = req.body || {};
  const rows = await execQ(getPool(), `
    UPDATE school_automation_template SET
      name=coalesce($3,name), channel=coalesce($4,channel), subject=coalesce($5,subject),
      body_text=coalesce($6,body_text), body_html=coalesce($7,body_html),
      variables=coalesce($8::jsonb,variables), webhook_url=coalesce($9,webhook_url),
      webhook_method=coalesce($10,webhook_method), webhook_headers=coalesce($11::jsonb,webhook_headers),
      is_active=coalesce($12,is_active), updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), id, text(b.name), text(b.channel), text(b.subject), text(b.body_text), text(b.body_html),
      b.variables ? JSON.stringify(b.variables) : null, text(b.webhook_url), text(b.webhook_method),
      b.webhook_headers ? JSON.stringify(b.webhook_headers) : null, b.isActive === undefined ? null : bool(b.isActive)]);
  if (!rows[0]) return fail(404, 'Template not found');
  await writeAudit(getPool(), req, { action: 'automation.template.update', entity: 'school_automation_template', entityId: id, after: rows[0] });
  res.json({ ok: true, template: rows[0] });
}));

automationRouter.delete('/templates/:id', route(async (req, res) => {
  if (!guard(req, res, 'automation.templates')) return;
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `UPDATE school_automation_template SET deleted_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL AND is_system=false RETURNING id`, [appIdOf(req), id]);
  if (!rows[0]) return fail(404, 'Template not found or is a system template');
  await writeAudit(getPool(), req, { action: 'automation.template.delete', entity: 'school_automation_template', entityId: id });
  res.json({ ok: true });
}));

/* ---------- Providers ---------- */
automationRouter.get('/providers', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `SELECT * FROM school_automation_provider WHERE app_id=$1 AND deleted_at IS NULL ORDER BY channel, name`, [appIdOf(req)]);
  res.json({ ok: true, providers: rows });
}));

automationRouter.post('/providers', route(async (req, res) => {
  if (!guard(req, res, 'automation.providers')) return;
  const b = req.body || {};
  if (!text(b.name) || !text(b.channel) || !text(b.provider_type)) fail(400, 'Name, channel, and provider_type required');
  if (!['sms', 'email', 'push'].includes(text(b.channel))) fail(400, 'Invalid channel');
  const code = text(b.code) || text(b.name).toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
  const rows = await execQ(getPool(), `
    INSERT INTO school_automation_provider (app_id, code, name, channel, provider_type, config, is_default, is_active, is_test_mode, created_by)
    VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10) RETURNING *
  `, [appIdOf(req), code, text(b.name), text(b.channel), text(b.provider_type), JSON.stringify(b.config || {}),
      bool(b.isDefault), bool(b.isActive, true), bool(b.isTestMode), userOf(req)]);
  res.json({ ok: true, provider: rows[0] });
}));

automationRouter.get('/providers/:id', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `SELECT * FROM school_automation_provider WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL`, [appIdOf(req), id]);
  if (!rows[0]) return fail(404, 'Provider not found');
  res.json({ ok: true, provider: rows[0] });
}));

automationRouter.put('/providers/:id', route(async (req, res) => {
  if (!guard(req, res, 'automation.providers')) return;
  const id = num(req.params.id);
  const b = req.body || {};
  const rows = await execQ(getPool(), `
    UPDATE school_automation_provider SET
      name=coalesce($3,name), channel=coalesce($4,channel), provider_type=coalesce($5,provider_type),
      config=coalesce($6::jsonb,config), is_default=coalesce($7,is_default),
      is_active=coalesce($8,is_active), is_test_mode=coalesce($9,is_test_mode), updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), id, text(b.name), text(b.channel), text(b.provider_type),
      b.config ? JSON.stringify(b.config) : null, b.isDefault === undefined ? null : bool(b.isDefault),
      b.isActive === undefined ? null : bool(b.isActive), b.isTestMode === undefined ? null : bool(b.isTestMode)]);
  if (!rows[0]) return fail(404, 'Provider not found');
  res.json({ ok: true, provider: rows[0] });
}));

automationRouter.post('/providers/:id/test', route(async (req, res) => {
  if (!guard(req, res, 'automation.providers')) return;
  const id = num(req.params.id);
  const testTo = text(req.body?.test_to);
  const testSubject = text(req.body?.test_subject) || 'Test from School ERP';
  const testBody = text(req.body?.test_body) || 'This is a test message from School ERP Automation.';

  const pRows = await execQ(getPool(), `SELECT * FROM school_automation_provider WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL`, [appIdOf(req), id]);
  if (!pRows[0]) return fail(404, 'Provider not found');
  const provider = pRows[0];

  // TODO: Implement actual provider test sending
  // For now just update test status
  await execQ(getPool(), `UPDATE school_automation_provider SET last_tested_at=now(), test_status='pending', test_message='Test initiated' WHERE id=$1`, [id]);
  res.json({ ok: true, message: 'Test queued (provider test implementation pending)', provider });
}));

automationRouter.delete('/providers/:id', route(async (req, res) => {
  if (!guard(req, res, 'automation.providers')) return;
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `UPDATE school_automation_provider SET deleted_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id`, [appIdOf(req), id]);
  if (!rows[0]) return fail(404, 'Provider not found');
  res.json({ ok: true });
}));

/* ---------- Manual Run Trigger ---------- */
automationRouter.post('/run', route(async (req, res) => {
  if (!guard(req, res, 'automation.run')) return;
  const b = req.body || {};
  // Trigger fee reminders, absence alerts, etc.
  // For now return mock response
  res.json({ ok: true, feeReminders: 0, absenceAlerts: 0, message: 'Manual run triggered (implementation pending)' });
}));

export { automationRouter };