/* ============================================================
   Reports & Analytics — Backend Routes
   Mounted at /api/school/reports before the legacy comprehensive router.
   ============================================================ */
import express from 'express';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { ensureFoundation, loadAccess, writeAudit } from '../school/foundation.js';

const reportsRouter = express.Router();

reportsRouter.use(verifyToken);
reportsRouter.use(async (req, _res, next) => {
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
const dayOf = (v) => { if (!v) return null; if (v instanceof Date) { const y = v.getFullYear(); const m = String(v.getMonth() + 1).padStart(2, '0'); const d = String(v.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; } return String(v).slice(0, 10); };
const appIdOf = (req) => req.user?.company || DEFAULT_COMPANY_ID;
const userOf = (req) => req.user?.userid || req.user?.sub || 'SYSTEM';
const guardView = (req, res) => { if (!req.school?.permissions?.includes('reports.view') && !req.school?.isSuper) { res.status(403).json({ ok: false, error: 'Insufficient permissions' }); return false; } return true; };
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

/* ---------- Pre-built Report Endpoints ---------- */

// Student Reports
reportsRouter.get('/student', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const { classId, sectionId, status, gender, category, from, to } = req.query;
  const appId = appIdOf(req);
  const where = ['s.deleted_at IS NULL', 's.app_id = $1'];
  const params = [appId];
  let paramIdx = 2;

  if (classId) { where.push(`s.class_id = $${paramIdx}`); params.push(num(classId)); paramIdx++; }
  if (sectionId) { where.push(`s.section_id = $${paramIdx}`); params.push(num(sectionId)); paramIdx++; }
  if (status) { where.push(`s.status = $${paramIdx}`); params.push(text(status)); paramIdx++; }
  if (gender) { where.push(`s.gender = $${paramIdx}`); params.push(text(gender)); paramIdx++; }
  if (category) { where.push(`s.category = $${paramIdx}`); params.push(text(category)); paramIdx++; }
  if (from) { where.push(`s.admission_date >= $${paramIdx}`); params.push(from); paramIdx++; }
  if (to) { where.push(`s.admission_date <= $${paramIdx}`); params.push(to); paramIdx++; }

  const sql = `
    SELECT
      c.name AS class_name,
      sec.name AS section_name,
      s.gender,
      s.category,
      s.status,
      COUNT(*)::int AS count
    FROM school_students s
    LEFT JOIN school_classes c ON c.id = s.class_id
    LEFT JOIN school_sections sec ON sec.id = s.section_id
    WHERE ${where.join(' AND ')}
    GROUP BY c.name, sec.name, s.gender, s.category, s.status
    ORDER BY c.name, sec.name
    LIMIT 5000
  `;
  const rows = await execQ(getPool(), sql, params);
  res.json({ ok: true, data: rows });
}));

// Attendance Reports
reportsRouter.get('/attendance', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const { classId, sectionId, date_from, date_to, status_category } = req.query;
  const appId = appIdOf(req);
  const where = ['ar.cancelled_at IS NULL', 'ar.app_id = $1'];
  const params = [appId];
  let paramIdx = 2;

  if (classId) { where.push(`sec.class_id = $${paramIdx}`); params.push(num(classId)); paramIdx++; }
  if (sectionId) { where.push(`ar.section_id = $${paramIdx}`); params.push(num(sectionId)); paramIdx++; }
  if (date_from) { where.push(`ar.register_date >= $${paramIdx}`); params.push(date_from); paramIdx++; }
  if (date_to) { where.push(`ar.register_date <= $${paramIdx}`); params.push(date_to); paramIdx++; }
  if (status_category) { where.push(`ap.category = $${paramIdx}`); params.push(text(status_category)); paramIdx++; }

  const sql = `
    SELECT
      ar.register_date AS date,
      c.name AS class_name,
      sec.name AS section_name,
      ap.category AS status_category,
      COUNT(*)::int AS count
    FROM school_attendance_entry ae
    JOIN school_attendance_register ar ON ar.id = ae.register_id
    JOIN school_sections sec ON sec.id = ar.section_id
    JOIN school_classes c ON c.id = sec.class_id
    JOIN school_attendance_policy ap ON ap.id = ae.policy_id
    WHERE ${where.join(' AND ')}
    GROUP BY ar.register_date, c.name, sec.name, ap.category
    ORDER BY ar.register_date DESC, c.name, sec.name
    LIMIT 5000
  `;
  const rows = await execQ(getPool(), sql, params);
  res.json({ ok: true, data: rows });
}));

// Fee Reports
reportsRouter.get('/fees', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const { classId, sectionId, duesStatus, date_from, date_to } = req.query;
  const appId = appIdOf(req);
  const where = ['s.deleted_at IS NULL', 'fi.app_id = $1'];
  const params = [appId];
  let paramIdx = 2;

  if (classId) { where.push(`s.class_id = $${paramIdx}`); params.push(num(classId)); paramIdx++; }
  if (sectionId) { where.push(`s.section_id = $${paramIdx}`); params.push(num(sectionId)); paramIdx++; }
  if (date_from) { where.push(`fi.created_at >= $${paramIdx}`); params.push(date_from); paramIdx++; }
  if (date_to) { where.push(`fi.created_at <= $${paramIdx}`); params.push(date_to); paramIdx++; }
  if (duesStatus) {
    const status = text(duesStatus);
    if (status === 'paid') where.push(`fi.status = 'paid'`);
    else if (status === 'overdue') where.push(`fi.due_date < CURRENT_DATE AND fi.status != 'paid'`);
    else if (status === 'due_soon') where.push(`fi.due_date <= CURRENT_DATE + 7 AND fi.status != 'paid'`);
    else if (status === 'pending') where.push(`fi.due_date > CURRENT_DATE + 7 AND fi.status != 'paid'`);
  }

  const sql = `
    SELECT
      fi.created_at::date AS invoice_date,
      fi.status,
      COUNT(*)::int AS count,
      SUM(fi.amount)::numeric AS total_amount,
      SUM(fi.paid_amount)::numeric AS total_paid,
      SUM(fi.amount - fi.paid_amount)::numeric AS total_balance
    FROM school_fee_invoices fi
    JOIN school_students s ON s.id = fi.student_id
    LEFT JOIN school_classes c ON c.id = s.class_id
    LEFT JOIN school_sections sec ON sec.id = s.section_id
    WHERE ${where.join(' AND ')}
    GROUP BY fi.created_at::date, fi.status
    ORDER BY fi.created_at::date DESC
    LIMIT 5000
  `;
  const rows = await execQ(getPool(), sql, params);
  res.json({ ok: true, data: rows });
}));

// Exam Reports
reportsRouter.get('/exam', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const { classId, sectionId, termId } = req.query;
  const appId = appIdOf(req);
  const where = ['e.deleted_at IS NULL', 'e.app_id = $1'];
  const params = [appId];
  let paramIdx = 2;

  if (classId) { where.push(`s.class_id = $${paramIdx}`); params.push(num(classId)); paramIdx++; }
  if (sectionId) { where.push(`s.section_id = $${paramIdx}`); params.push(num(sectionId)); paramIdx++; }
  if (termId) { where.push(`e.id = $${paramIdx}`); params.push(num(termId)); paramIdx++; }

  const sql = `
    SELECT
      e.name AS term_name,
      c.name AS class_name,
      COUNT(*)::int AS count,
      ROUND(AVG(CASE WHEN m.max_marks > 0 THEN (m.marks_obtained::numeric / m.max_marks) * 100 ELSE 0 END), 2) AS avg_percentage
    FROM school_marks m
    JOIN school_students s ON s.id = m.student_id
    JOIN school_exam e ON e.id = m.exam_id
    LEFT JOIN school_classes c ON c.id = s.class_id
    LEFT JOIN school_sections sec ON sec.id = s.section_id
    WHERE ${where.join(' AND ')}
    GROUP BY e.name, c.name
    ORDER BY e.name, c.name
    LIMIT 5000
  `;
  const rows = await execQ(getPool(), sql, params);
  res.json({ ok: true, data: rows });
}));

/* ---------- Custom Report Templates ---------- */

// List templates
reportsRouter.get('/templates', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const category = text(req.query.category);
  const rows = await execQ(getPool(), `SELECT * FROM school_analytics_template WHERE app_id=$1 AND deleted_at IS NULL ${category ? 'AND category=$2' : ''} ORDER BY is_system DESC, name`, [appIdOf(req), category].filter(Boolean));
  res.json({ ok: true, templates: rows });
}));

// Create template
reportsRouter.post('/templates', route(async (req, res) => {
  if (!guard(req, res, 'reports.custom')) return;
  const b = req.body || {};
  if (!text(b.name) || !text(b.category) || !text(b.data_source)) fail(400, 'Name, category, and data_source required');
  const code = text(b.code) || text(b.name).toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
  const rows = await execQ(getPool(), `
    INSERT INTO school_analytics_template (app_id, code, name, description, category, data_source, query_config, ui_config, is_system, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,false,$9) RETURNING *
  `, [appIdOf(req), code, text(b.name), text(b.description), text(b.category), text(b.data_source), JSON.stringify(b.query_config || {}), JSON.stringify(b.ui_config || {}), userOf(req)]);
  await writeAudit(getPool(), req, { action: 'report.template.create', entity: 'school_analytics_template', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, template: rows[0] });
}));

// Get single template
reportsRouter.get('/templates/:id', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `SELECT * FROM school_analytics_template WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL`, [appIdOf(req), id]);
  if (!rows[0]) return fail(404, 'Template not found');
  res.json({ ok: true, template: rows[0] });
}));

// Update template
reportsRouter.put('/templates/:id', route(async (req, res) => {
  if (!guard(req, res, 'reports.custom')) return;
  const id = num(req.params.id);
  const b = req.body || {};
  const rows = await execQ(getPool(), `
    UPDATE school_analytics_template SET
      name=coalesce($3,name), description=coalesce($4,description), category=coalesce($5,category),
      data_source=coalesce($6,data_source), query_config=coalesce($7::jsonb,query_config),
      ui_config=coalesce($8::jsonb,ui_config), is_active=coalesce($9,is_active), updated_at=now()
    WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), id, text(b.name), text(b.description), text(b.category), text(b.data_source),
      b.query_config ? JSON.stringify(b.query_config) : null, b.ui_config ? JSON.stringify(b.ui_config) : null,
      b.isActive === undefined ? null : bool(b.isActive)]);
  if (!rows[0]) return fail(404, 'Template not found');
  await writeAudit(getPool(), req, { action: 'report.template.update', entity: 'school_analytics_template', entityId: id, after: rows[0] });
  res.json({ ok: true, template: rows[0] });
}));

// Delete template
reportsRouter.delete('/templates/:id', route(async (req, res) => {
  if (!guard(req, res, 'reports.custom')) return;
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `UPDATE school_analytics_template SET deleted_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL AND is_system=false RETURNING id`, [appIdOf(req), id]);
  if (!rows[0]) return fail(404, 'Template not found or is a system template');
  await writeAudit(getPool(), req, { action: 'report.template.delete', entity: 'school_analytics_template', entityId: id });
  res.json({ ok: true });
}));

// Run custom report (execute template)
reportsRouter.post('/templates/:id/run', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const id = num(req.params.id);
  const runtimeParams = req.body?.parameters || {};

  const tplRows = await execQ(getPool(), `SELECT * FROM school_analytics_template WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL AND is_active=true`, [appIdOf(req), id]);
  if (!tplRows[0]) return fail(404, 'Template not found or inactive');
  const tpl = tplRows[0];

  // Build execution record
  const execRows = await execQ(getPool(), `
    INSERT INTO school_analytics_execution (app_id, template_id, triggered_by, triggered_by_id, status, parameters)
    VALUES ($1,$2,'manual',$3,'running',$4::jsonb) RETURNING *
  `, [appIdOf(req), id, userOf(req), JSON.stringify(runtimeParams)]);
  const execution = execRows[0];

  try {
    let data = [];
    if (tpl.data_source === 'custom_sql') {
      const sql = text(tpl.query_config?.sql);
      if (!sql) throw new Error('Custom SQL not configured');
      if (!/^\s*select\s/i.test(sql)) throw new Error('Only SELECT queries allowed');
      const pool = getPool();
      const result = await pool.query(sql, [appIdOf(req), ...Object.values(runtimeParams)]);
      data = result.rows;
    } else {
      const viewMap = { students: 'school_v_student_summary', attendance: 'school_v_attendance_summary', fees: 'school_v_fee_summary', exams: 'school_v_exam_summary' };
      const view = viewMap[tpl.data_source];
      if (!view) throw new Error(`Unknown data source: ${tpl.data_source}`);
      const qcfg = tpl.query_config || {};
      const { columns = [], groupBy = [], filters = {} } = qcfg;
      const mergedFilters = { ...filters, ...runtimeParams };
      const selectCols = columns.length ? columns.map(c => `"${c}"`).join(', ') : '*';
      const where = ['app_id = $1'];
      const params = [appIdOf(req)];
      let paramIdx = 2;
      for (const [key, value] of Object.entries(mergedFilters)) {
        if (value === undefined || value === null || value === '') continue;
        if (Array.isArray(value) && value.length) {
          where.push(`"${key}" = ANY($${paramIdx})`);
          params.push(value);
        } else {
          where.push(`"${key}" = $${paramIdx}`);
          params.push(value);
        }
        paramIdx++;
      }
      let sql = `SELECT ${selectCols} FROM ${view} WHERE ${where.join(' AND ')}`;
      if (groupBy.length) sql += ` GROUP BY ${groupBy.map(c => `"${c}"`).join(', ')}`;
      sql += ` LIMIT 5000`;
      data = await execQ(getPool(), sql, params);
    }

    await execQ(getPool(), `UPDATE school_analytics_execution SET status='completed', row_count=$1, completed_at=now() WHERE id=$2`, [data.length, execution.id]);
    res.json({ ok: true, execution: { ...execution, status: 'completed', row_count: data.length }, data });
  } catch (e) {
    await execQ(getPool(), `UPDATE school_analytics_execution SET status='failed', error_message=$1, completed_at=now() WHERE id=$2`, [e.message, execution.id]);
    res.status(500).json({ ok: false, error: e.message });
  }
}));

/* ---------- Report Schedules ---------- */

reportsRouter.get('/schedules', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `SELECT s.*, t.name AS template_name FROM school_analytics_schedule s JOIN school_analytics_template t ON t.id = s.template_id WHERE s.app_id=$1 ORDER BY s.next_run_at`, [appIdOf(req)]);
  res.json({ ok: true, schedules: rows });
}));

reportsRouter.post('/schedules', route(async (req, res) => {
  if (!guard(req, res, 'reports.schedule')) return;
  const b = req.body || {};
  if (!num(b.templateId) || !text(b.cronExpression)) fail(400, 'Template ID and cron expression required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_analytics_schedule (app_id, template_id, name, cron_expression, timezone, parameters, recipients, format, created_by)
    VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9) RETURNING *
  `, [appIdOf(req), num(b.templateId), text(b.name), text(b.cronExpression), text(b.timezone) || 'Asia/Kolkata',
      JSON.stringify(b.parameters || {}), JSON.stringify(b.recipients || []), text(b.format) || 'csv', userOf(req)]);
  res.json({ ok: true, schedule: rows[0] });
}));

reportsRouter.put('/schedules/:id', route(async (req, res) => {
  if (!guard(req, res, 'reports.schedule')) return;
  const id = num(req.params.id);
  const b = req.body || {};
  const rows = await execQ(getPool(), `
    UPDATE school_analytics_schedule SET
      name=coalesce($3,name), cron_expression=coalesce($4,cron_expression), timezone=coalesce($5,timezone),
      parameters=coalesce($6::jsonb,parameters), recipients=coalesce($7::jsonb,recipients),
      format=coalesce($8,format), is_active=coalesce($9,is_active), updated_at=now()
    WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), id, text(b.name), text(b.cronExpression), text(b.timezone),
      b.parameters ? JSON.stringify(b.parameters) : null, b.recipients ? JSON.stringify(b.recipients) : null,
      text(b.format), b.isActive === undefined ? null : bool(b.isActive)]);
  if (!rows[0]) return fail(404, 'Schedule not found');
  res.json({ ok: true, schedule: rows[0] });
}));

reportsRouter.delete('/schedules/:id', route(async (req, res) => {
  if (!guard(req, res, 'reports.schedule')) return;
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `DELETE FROM school_analytics_schedule WHERE app_id=$1 AND id=$2 RETURNING id`, [appIdOf(req), id]);
  if (!rows[0]) return fail(404, 'Schedule not found');
  res.json({ ok: true });
}));

/* ---------- Execution History ---------- */

reportsRouter.get('/executions', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const { templateId, status, limit } = req.query;
  let sql = `SELECT e.*, t.name AS template_name FROM school_analytics_execution e LEFT JOIN school_analytics_template t ON t.id = e.template_id WHERE e.app_id=$1`;
  const params = [appIdOf(req)];
  let paramIdx = 2;
  if (templateId) { sql += ` AND e.template_id=$${paramIdx}`; params.push(num(templateId)); paramIdx++; }
  if (status) { sql += ` AND e.status=$${paramIdx}`; params.push(text(status)); paramIdx++; }
  sql += ` ORDER BY e.started_at DESC LIMIT ${Math.min(num(limit) || 50, 200)}`;
  const rows = await execQ(getPool(), sql, params);
  res.json({ ok: true, executions: rows });
}));

/* ---------- Dashboard Widgets ---------- */

reportsRouter.get('/widgets', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const userId = userOf(req);
  const rows = await execQ(getPool(), `SELECT w.*, t.name AS template_name, t.category FROM school_analytics_widget w LEFT JOIN school_analytics_template t ON t.id = w.template_id WHERE w.app_id=$1 AND w.user_id=$2 AND w.is_active=true ORDER BY w.position`, [appIdOf(req), userId]);
  res.json({ ok: true, widgets: rows });
}));

reportsRouter.post('/widgets', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const b = req.body || {};
  if (!num(b.templateId)) fail(400, 'Template ID required');
  const userId = userOf(req);
  const rows = await execQ(getPool(), `
    INSERT INTO school_analytics_widget (app_id, user_id, template_id, title, position, width, height, config)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING *
  `, [appIdOf(req), userId, num(b.templateId), text(b.title), num(b.position) || 0, num(b.width) || 6, num(b.height) || 4, JSON.stringify(b.config || {})]);
  res.json({ ok: true, widget: rows[0] });
}));

reportsRouter.put('/widgets/:id', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const id = num(req.params.id);
  const userId = userOf(req);
  const b = req.body || {};
  const rows = await execQ(getPool(), `
    UPDATE school_analytics_widget SET
      title=coalesce($3,title), position=coalesce($4,position), width=coalesce($5,width),
      height=coalesce($6,height), config=coalesce($7::jsonb,config), is_active=coalesce($8,is_active), updated_at=now()
    WHERE app_id=$1 AND id=$2 AND user_id=$3 RETURNING *
  `, [appIdOf(req), id, userId, text(b.title), num(b.position), num(b.width), num(b.height),
      b.config ? JSON.stringify(b.config) : null, b.isActive === undefined ? null : bool(b.isActive)]);
  if (!rows[0]) return fail(404, 'Widget not found');
  res.json({ ok: true, widget: rows[0] });
}));

reportsRouter.delete('/widgets/:id', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const id = num(req.params.id);
  const userId = userOf(req);
  const rows = await execQ(getPool(), `DELETE FROM school_analytics_widget WHERE app_id=$1 AND id=$2 AND user_id=$3 RETURNING id`, [appIdOf(req), id, userId]);
  if (!rows[0]) return fail(404, 'Widget not found');
  res.json({ ok: true });
}));

/* ---------- Dashboard Summary (for Reports landing page) ---------- */

reportsRouter.get('/dashboard', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const pool = getPool();
  const appId = appIdOf(req);

  const [students, attendance, fees, exams] = await Promise.all([
    execQ(pool, `SELECT count(*)::int as total, count(*) FILTER (WHERE status='active') as active FROM school_students WHERE app_id=$1 AND deleted_at IS NULL`, [appId]),
    execQ(pool, `SELECT count(*)::int as registers, count(*) FILTER (WHERE register_date >= CURRENT_DATE - 7) as recent FROM school_attendance_register WHERE app_id=$1 AND cancelled_at IS NULL`, [appId]),
    execQ(pool, `SELECT count(*)::int as invoices, sum(amount)::numeric as total_amount, sum(paid_amount)::numeric as total_paid, sum(amount - paid_amount)::numeric as total_balance FROM school_fee_invoices WHERE app_id=$1`, [appId]),
    execQ(pool, `SELECT count(*)::int as terms, count(*) FILTER (WHERE status='published') as published FROM school_exam WHERE app_id=$1 AND deleted_at IS NULL`, [appId]),
  ]);

  res.json({
    ok: true,
    summary: {
      students: students[0],
      attendance: attendance[0],
      fees: fees[0],
      exams: exams[0],
    }
  });
}));

export { reportsRouter };