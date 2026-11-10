import { Router } from 'express';
import { getPool } from '../db/pool.js';
import { execFn, execFnTx, execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { appendSqlLog, sqlCall, SQL_TOKEN } from '../logging/sql.js';

export const dashRouter = Router();

const QUERY_TIMEOUT_MS = 15000;
const QUERY_MAX_ROWS = 5000;

/* Every save/delete goes through here, so the administrator rule is stated once.
   ADMIN, a group flagged IsAdmin, or GRP mentioning ADMIN all count. */
async function requireAdmin(req, res) {
  const pool = await getPool();
  const uid = req.user?.userid || '';
  const rows = await execQ(pool,
    `SELECT (
        lower(btrim(u."UserId")) = 'admin'
        OR coalesce(u."GRP",'') ILIKE '%ADMIN%'
        OR EXISTS (SELECT 1 FROM "tblSecUserGrp" x
                     JOIN "tblSecGroup" g ON g."GrpId" = x."GrpId"
                    WHERE x."UserId" = u."UserId" AND g."IsAdmin")
      ) AS is_admin
       FROM "tblHO_User" u
      WHERE lower(btrim(u."UserId")) = lower(btrim($1)) LIMIT 1`,
    [uid]);
  if (!rows.length || !rows[0].is_admin) {
    res.status(403).json({ error: 'Only an administrator can change this' });
    return null;
  }
  return true;
}

/* The stored procedures answer with a status/message pair. Surface that as an
   HTTP error instead of pretending the save worked. */
function fail(res, rows) {
  const r = (rows || [])[0] || {};
  if (r.status && r.status !== 'ok') {
    res.status(400).json({ error: r.message || 'Save failed', status: r.status });
    return true;
  }
  return false;
}

function log(req, fn, args) {
  appendSqlLog('_DASH', req.user?.company || '', 'dashbuilder', req.user?.sessionToken || '',
    req.user?.userid || '', sqlCall(fn, args, req.user?.userid));
}

/* Several columns are jsonb, so a label like "grid" would be a syntax error.
   Accept either a parsed object or a JSON string and always send valid JSON. */
function asJson(v, fallback = {}) {
  if (v == null || v === '') return JSON.stringify(fallback);
  if (typeof v === 'string') {
    try { JSON.parse(v); return v; } catch { return JSON.stringify(fallback); }
  }
  return JSON.stringify(v);
}

/* The stored functions disagree on casing: sp_dash_page_list answers in
   PascalCase, sp_dash_page_get in snake_case, and the save functions return a
   capitalised "Id". Normalise every row to camelCase so the client never has
   to guess which function produced it. */
function camelRow(r) {
  if (!r || typeof r !== 'object') return r;
  const o = {};
  for (const [k, v] of Object.entries(r)) {
    o[k.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase())
      .replace(/^[A-Z]/, (ch) => ch.toLowerCase())] = v;
  }
  return o;
}

const camelRows = (rows) => (rows || []).map(camelRow);

/* ------------------------------ read (any user) ----------------------------- */

dashRouter.get('/dash/bootstrap', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    const me = req.user?.userid || '';
    const [pages, widgets, sets, items, links, dyn, boards] = await Promise.all([
      execFn(pool, 'sp_dash_page_list', []),
      execFn(pool, 'sp_dash_widget_list', ['']),
      execFn(pool, 'sp_dash_menu_set_list', []),
      execFn(pool, 'sp_dash_menu_item_list', [0]),
      execFn(pool, 'sp_dash_link_list', []),
      execFn(pool, 'sp_dyn_page_list', []),
      execFn(pool, 'sp_dash_board_list', []),
    ]);
    let myMenus = [];
    try { myMenus = await execFn(pool, 'sp_dash_menu_tree', [me]); } catch { myMenus = []; }
    res.json({
      ok: true, me,
      pages: camelRows(pages), widgets: camelRows(widgets), menuSets: camelRows(sets),
      menuItems: camelRows(items), links: camelRows(links), dynPages: camelRows(dyn),
      boards: camelRows(boards),
      myMenus: camelRows(myMenus),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

dashRouter.get('/dash/menu-items/:setId', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    const id = Number(req.params.setId);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid menu' });
    res.json({ ok: true, items: camelRows(await execFn(pool, 'sp_dash_menu_item_list', [id])) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

dashRouter.get('/dash/page/:slug', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    const slug = String(req.params.slug || '');
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(slug)) return res.status(400).json({ error: 'Invalid slug' });
    const page = await execFn(pool, 'sp_dash_page_get', [slug]);
    const widgets = await execFn(pool, 'sp_dash_widget_list', [slug]);
    res.json({ ok: true, page: camelRow((page || [])[0] || null), widgets: camelRows(widgets) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

dashRouter.get('/dash/dyn/:slug', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    const slug = String(req.params.slug || '');
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(slug)) return res.status(400).json({ error: 'Invalid slug' });
    const page = await execFn(pool, 'sp_dyn_page_get', [slug]);
    if (!(page || []).length) return res.status(404).json({ error: 'Page not found' });
    res.json({ ok: true, page: camelRow(page[0]) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ---------------------------- metadata for the builder ---------------------- */

dashRouter.get('/dash/tables', verifyToken, async (_req, res) => {
  try {
    const pool = await getPool();
    const rows = await execQ(pool,
      `SELECT table_name FROM information_schema.tables
        WHERE table_type='BASE TABLE' AND table_schema='public'
        ORDER BY table_name`);
    res.json({ ok: true, tables: rows.map((r) => r.table_name) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

dashRouter.get('/dash/columns/:table', verifyToken, async (req, res) => {
  try {
    const t = String(req.params.table || '');
    if (!/^[A-Za-z0-9_]+$/.test(t)) return res.status(400).json({ error: 'Invalid table name' });
    const pool = await getPool();
    const rows = await execQ(pool,
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1
        ORDER BY ordinal_position`, [t]);
    res.json({ ok: true, columns: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Distinct values, on demand, so a filter dropdown is never a full table scan. */
dashRouter.get('/dash/distinct/:table/:column', verifyToken, async (req, res) => {
  try {
    const t = String(req.params.table || '');
    const c = String(req.params.column || '');
    if (!/^[A-Za-z0-9_]+$/.test(t) || !/^[A-Za-z0-9_]+$/.test(c)) {
      return res.status(400).json({ error: 'Invalid name' });
    }
    const pool = await getPool();
    const rows = await execQ(pool,
      `SELECT public.sp_dash_resolve_table($1) AS real`, [t]);
    if (!rows.length || !rows[0].real) return res.status(400).json({ error: 'Unknown table' });
    const realTable = rows[0].real;
    const cols = await execQ(pool,
      `SELECT public.sp_dash_resolve_column($1, $2) AS real`, [realTable, c]);
    if (!cols.length || !cols[0].real) return res.status(400).json({ error: 'Unknown column' });
    /* Qualify with a table alias: a bare "public.tbl"."col" would be read as a
       three-part database.schema.table name and rejected. */
    const out = await execQ(pool,
      `SELECT DISTINCT x."${cols[0].real}"::text AS v FROM public."${realTable}" AS x
        WHERE x."${cols[0].real}" IS NOT NULL ORDER BY 1 LIMIT 500`, []);
    res.json({ ok: true, values: out.map((r) => r.v) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ------------------------------- run a query ------------------------------- */

/* A dedicated client, because the whole thing must be one read-only transaction:
   even if a future guard were wrong, the database itself refuses to write. */
dashRouter.post('/dash/query', verifyToken, async (req, res) => {
  try {
    /* Any signed-in person can run a dashboard KPI. It is a read-only,
       whitelisted query (the function resolves tables and columns against the
       schema before touching them), so a viewer does not need rights that a
       dashboard card should not need. */
    const spec = req.body?.spec;
    if (!spec || typeof spec !== 'object') return res.status(400).json({ error: 'Nothing to run' });

    const maxRows = Math.min(
      Math.max(Number(req.body?.maxRows) || 500, 1), QUERY_MAX_ROWS);

    const pool = await getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET TRANSACTION READ ONLY');
      await client.query(`SET LOCAL statement_timeout = ${QUERY_TIMEOUT_MS}`);
      const { rows } = await client.query(
        'SELECT * FROM public.sp_dash_query_run($1::jsonb, $2::int)',
        [JSON.stringify(spec), maxRows]);
      await client.query('COMMIT');
      log(req, 'sp_dash_query_run', [JSON.stringify(spec).slice(0, 400)]);
      const r = rows[0] || {};
      if (r.status !== 'ok') {
        return res.status(400).json({
          error: r.message || 'Query failed', sql: r.sql, status: r.status,
        });
      }
      res.json({
        ok: true, columns: r.columns || [], rows: r.rows || [],
        sql: r.sql, rowCount: Number(r.row_count) || 0,
      });
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      res.status(400).json({ error: e.message });
    } finally {
      client.release();
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ------------------------------ writes (admin) ----------------------------- */

dashRouter.post('/dash/page/save', verifyToken, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const b = req.body || {};
    const pool = await getPool();
    const args = [b.slug || '', b.title || '', b.description || '', b.kind || 'page',
      !!b.isHome, asJson(b.layout), asJson(b.style), Number(b.sort) || 0, req.user?.userid || ''];
    const rows = await execFn(pool, 'sp_dash_page_save', args);
    if (fail(res, rows)) return;
    log(req, 'sp_dash_page_save', args.slice(0, 4));
    res.json({ ok: true, id: rows[0]?.Id ?? null, message: rows[0]?.message || 'Saved' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

dashRouter.delete('/dash/page/:slug', verifyToken, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const slug = String(req.params.slug || '');
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(slug)) return res.status(400).json({ error: 'Invalid slug' });
    const pool = await getPool();
    const rows = await execFn(pool, 'sp_dash_page_delete', [slug]);
    if (fail(res, rows)) return;
    log(req, 'sp_dash_page_delete', [slug]);
    res.json({ ok: true, message: rows[0]?.message || 'Deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

dashRouter.post('/dash/widget/save', verifyToken, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const b = req.body || {};
    const pool = await getPool();
    const args = [b.pageSlug || '', b.id ? Number(b.id) : null, b.name || '',
      b.chartType || 'kpi', asJson(b.layout), asJson(b.query), asJson(b.style),
      Number(b.sort) || 0];
    const rows = await execFn(pool, 'sp_dash_widget_save', args);
    if (fail(res, rows)) return;
    log(req, 'sp_dash_widget_save', [b.pageSlug, b.name]);
    res.json({ ok: true, id: rows[0]?.Id ?? null, message: rows[0]?.message || 'Saved' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

dashRouter.delete('/dash/widget/:id', verifyToken, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const pool = await getPool();
    const rows = await execFn(pool, 'sp_dash_widget_delete', [id]);
    if (fail(res, rows)) return;
    log(req, 'sp_dash_widget_delete', [id]);
    res.json({ ok: true, message: rows[0]?.message || 'Deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

dashRouter.post('/dash/menu-set/save', verifyToken, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const b = req.body || {};
    const pool = await getPool();
    const args = [b.id ? Number(b.id) : null, b.name || '', b.description || '',
      !!b.isActive, req.user?.userid || '', b.isAvailable !== false];
    const rows = await execFn(pool, 'sp_dash_menu_set_save', args);
    if (fail(res, rows)) return;
    log(req, 'sp_dash_menu_set_save', args.slice(0, 4));
    res.json({ ok: true, id: rows[0]?.Id ?? null, message: rows[0]?.message || 'Saved' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

dashRouter.delete('/dash/menu-set/:id', verifyToken, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const pool = await getPool();
    const rows = await execFn(pool, 'sp_dash_menu_set_delete', [id]);
    if (fail(res, rows)) return;
    log(req, 'sp_dash_menu_set_delete', [id]);
    res.json({ ok: true, message: rows[0]?.message || 'Deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

dashRouter.post('/dash/menu-item/save', verifyToken, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const b = req.body || {};
    const pool = await getPool();
    const args = [Number(b.setId) || 0, b.id ? Number(b.id) : null,
      b.parentId ? Number(b.parentId) : null, b.label || '', b.icon || '',
      b.kind || 'form', b.target || '', !!b.openNew, b.color || '',
      Number(b.sort) || 0, b.visible !== false];
    const rows = await execFn(pool, 'sp_dash_menu_item_save', args);
    if (fail(res, rows)) return;
    log(req, 'sp_dash_menu_item_save', [b.setId, b.label]);
    res.json({ ok: true, id: rows[0]?.Id ?? null, message: rows[0]?.message || 'Saved' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

dashRouter.delete('/dash/menu-item/:id', verifyToken, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const pool = await getPool();
    const rows = await execFn(pool, 'sp_dash_menu_item_delete', [id]);
    if (fail(res, rows)) return;
    log(req, 'sp_dash_menu_item_delete', [id]);
    res.json({ ok: true, message: rows[0]?.message || 'Deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Which menu a person sees. is_available decides who may pick it. */
dashRouter.post('/dash/menu/select', verifyToken, async (req, res) => {
  try {
    const setId = Number(req.body?.setId) || 0;
    const pool = await getPool();
    const rows = await execFn(pool, 'sp_dash_menu_select', [setId, req.user?.userid || '']);
    if (fail(res, rows)) return;
    log(req, 'sp_dash_menu_select', [setId]);
    res.json({ ok: true, message: rows[0]?.message || 'Saved' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

dashRouter.post('/dash/link/save', verifyToken, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const b = req.body || {};
    const pool = await getPool();
    const args = [b.id ? Number(b.id) : null, b.section || 'General', b.label || '',
      b.icon || '', b.kind || 'url', b.target || '', !!b.openNew, b.color || '',
      Number(b.sort) || 0, b.visible !== false];
    const rows = await execFn(pool, 'sp_dash_link_save', args);
    if (fail(res, rows)) return;
    log(req, 'sp_dash_link_save', [b.section, b.label]);
    res.json({ ok: true, id: rows[0]?.Id ?? null, message: rows[0]?.message || 'Saved' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

dashRouter.delete('/dash/link/:id', verifyToken, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const pool = await getPool();
    const rows = await execFn(pool, 'sp_dash_link_delete', [id]);
    if (fail(res, rows)) return;
    log(req, 'sp_dash_link_delete', [id]);
    res.json({ ok: true, message: rows[0]?.message || 'Deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

dashRouter.post('/dash/dyn/save', verifyToken, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const b = req.body || {};
    const pool = await getPool();
    const args = [b.slug || '', b.title || '', b.icon || '', b.description || '',
      b.mode || 'builder', asJson(b.config), asJson(b.style),
      Number(b.sort) || 0, req.user?.userid || ''];
    const rows = await execFn(pool, 'sp_dyn_page_save', args);
    if (fail(res, rows)) return;
    log(req, 'sp_dyn_page_save', args.slice(0, 2));
    res.json({ ok: true, id: rows[0]?.Id ?? null, message: rows[0]?.message || 'Saved' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

dashRouter.delete('/dash/dyn/:slug', verifyToken, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const slug = String(req.params.slug || '');
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(slug)) return res.status(400).json({ error: 'Invalid slug' });
    const pool = await getPool();
    const rows = await execFn(pool, 'sp_dyn_page_delete', [slug]);
    if (fail(res, rows)) return;
    log(req, 'sp_dyn_page_delete', [slug]);
    res.json({ ok: true, message: rows[0]?.message || 'Deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ------------------------- sidebar menu: links and assignment ------------------------- */

/* Everything that can be dragged into a menu, for the right-hand box of the
   builder. Forms come from the same table the original sidebar is built from,
   so a link offered here is a link the app can really open, and it carries the
   friendly title ("Customer Master") rather than the form id. Dashboard and
   dynamic pages are offered too. */
dashRouter.get('/dash/menu-catalog', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    const fcode = String(req.query.fcode || 'HO');

    const forms = await execQ(pool,
      `SELECT m."WebPage", m."MenuTitle", m."DisplayIcon",
              m."MainGroup", m."SubGroup", m."MenuOrder"
         FROM "tblWebMenus" m
        WHERE m."FCODE" = $1 AND m."ShowStatus"
        ORDER BY m."MainGroup", m."SubGroup", m."MenuOrder", m."MenuTitle"`,
      [fcode]);

    /* The form id is the part the app navigates by, so pull it out of
       "frmCustomer.aspx" the same way the original menu did. */
    const formId = (webPage) => {
      const m = String(webPage || '').match(/(?:frm|rpt)(\w+)/i);
      if (!m) return String(webPage || '').replace(/\.aspx?$/i, '');
      const prefix = String(webPage).match(/^(frm|rpt)/i)?.[0]?.toLowerCase() || 'frm';
      return prefix + m[1].replace(/_JQ|_AE|_AEG|_SS/gi, '');
    };

    const links = forms.map((r) => ({
      kind: 'form',
      target: formId(r.WebPage),
      title: r.MenuTitle,
      icon: r.DisplayIcon || 'bi-file-earmark-text',
      group: r.MainGroup || 'MAIN',
      subGroup: r.SubGroup || '-',
      order: r.MenuOrder ?? 0,
    })).filter((l) => l.target);

    const pages = await execFn(pool, 'sp_dash_page_list', []);
    for (const p of pages || []) {
      links.push({
        kind: 'page', target: p.slug, title: p.title, icon: 'bi-grid-1x2',
        group: 'Dashboard', subGroup: '-', order: 100 + (p.sortOrder ?? 0),
      });
    }
    const dyn = await execFn(pool, 'sp_dyn_page_list', []);
    for (const p of dyn || []) {
      links.push({
        kind: 'dyn', target: p.slug, title: p.title, icon: p.icon || 'bi-table',
        group: 'Dynamic Pages', subGroup: '-', order: 200 + (p.sortOrder ?? 0),
      });
    }

    res.json({ ok: true, links });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Save the whole menu at once. The builder sends the finished tree, so a drag
   is one request and one transaction rather than a write per row. */
dashRouter.post('/dash/menu-items/replace', verifyToken, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const setId = Number(req.body?.setId);
    if (!Number.isFinite(setId) || setId <= 0) return res.status(400).json({ error: 'Invalid menu set' });
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length > 500) return res.status(400).json({ error: 'A menu can hold at most 500 links' });
    const pool = await getPool();
    /* A refused save must leave the menu exactly as it was, so a bad payload
       cannot half-apply. */
    const rows = await execFnTx(pool, 'sp_dash_menu_item_replace',
      [setId, JSON.stringify(items)]);
    if (fail(res, rows)) return;
    log(req, 'sp_dash_menu_item_replace', [setId, items.length]);
    /* The sidebar is cached client side, so tell the app to pick the new menu up. */
    res.json({ ok: true, count: rows[0]?.count ?? items.length, message: rows[0]?.message || 'Menu saved' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Who this menu is pinned to. */
dashRouter.get('/dash/menu/assignments/:setId', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    const setId = Number(req.params.setId);
    if (!Number.isFinite(setId)) return res.status(400).json({ error: 'Invalid menu' });
    const rows = await execFn(pool, 'sp_dash_menu_assignment_list', [setId]);
    res.json({ ok: true, assignments: camelRows(rows) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

dashRouter.post('/dash/menu/assign', verifyToken, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const b = req.body || {};
    const pool = await getPool();
    const rows = await execFn(pool, 'sp_dash_menu_assign',
      [Number(b.setId) || 0, String(b.subjectType || 'user'), String(b.subjectId || ''),
        req.user?.userid || 'ADMIN']);
    if (fail(res, rows)) return;
    log(req, 'sp_dash_menu_assign', [b.setId, b.subjectType, b.subjectId]);
    res.json({ ok: true, message: rows[0]?.message || 'Assigned' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

dashRouter.post('/dash/menu/assign/delete', verifyToken, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = Number(req.body?.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const pool = await getPool();
    const rows = await execFn(pool, 'sp_dash_menu_unassign', [id]);
    if (fail(res, rows)) return;
    log(req, 'sp_dash_menu_unassign', [id]);
    res.json({ ok: true, message: rows[0]?.message || 'Removed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Put the three example menus in place. Safe to run more than once: a menu
   that already exists is left exactly as it is. */
dashRouter.post('/dash/menu/seed-examples', verifyToken, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const pool = await getPool();
    const rows = await execFn(pool, 'sp_dash_menu_seed_examples', []);
    res.json({ ok: true, message: rows[0]?.message || 'Done' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Drop the example menus, but only ones that still look untouched, so a menu
   somebody has edited by hand is never deleted out from under them. */
dashRouter.post('/dash/menu/remove-examples', verifyToken, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const pool = await getPool();
    const gone = await execQ(pool,
      `DELETE FROM public.dash_menu_set s
        WHERE s.name IN ('Sales Desk','Purchase & Stock','Administration')
          AND NOT EXISTS (SELECT 1 FROM public.dash_menu_assignment a WHERE a.set_id = s.id)
          AND NOT EXISTS (SELECT 1 FROM public.dash_menu_user_choice c WHERE c.set_id = s.id)
        RETURNING s.id`);
    res.json({ ok: true, removed: gone.rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Which menu the sidebar should show this person, and why. The client uses it
   to label the menu in the builder, and tests use it to prove the precedence. */
dashRouter.get('/dash/menu/resolved', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    const who = String(req.query.user || req.user?.userid || '');
    if (!/^[A-Za-z0-9_.@-]{1,64}$/.test(who)) return res.status(400).json({ error: 'Invalid user' });
    const rows = await execFn(pool, 'sp_dash_menu_resolve', [who, req.query.grp || null]);
    res.json({ ok: true, resolved: camelRows(rows) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* --------------------------- dashboard boards --------------------------- */

/* Everything on the destination of a "who sees this?" and the view: boards,
   items and assignments use the same shape as the menu feature, so a board
   built in the Customize screen is stored per-company and read by anyone
   the resolver picks for it. */

dashRouter.get('/dash/board-items/:id', verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid board' });
    const pool = await getPool();
    const rows = await execFn(pool, 'sp_dash_board_item_list', [id]);
    res.json({ ok: true, items: camelRows(rows) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

dashRouter.post('/dash/board/save', verifyToken, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const b = req.body || {};
    const pool = await getPool();
    const args = [b.id ? Number(b.id) : null, b.name || '', b.description || '',
      !!b.isActive, req.user?.userid || '', b.isAvailable !== false];
    const rows = await execFn(pool, 'sp_dash_board_save', args);
    if (fail(res, rows)) return;
    log(req, 'sp_dash_board_save', args.slice(0, 3));
    res.json({ ok: true, id: rows[0]?.Id ?? null, message: rows[0]?.message || 'Saved' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

dashRouter.delete('/dash/board/:id', verifyToken, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const pool = await getPool();
    const rows = await execFn(pool, 'sp_dash_board_delete', [id]);
    if (fail(res, rows)) return;
    log(req, 'sp_dash_board_delete', [id]);
    res.json({ ok: true, message: rows[0]?.message || 'Deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Save the whole board layout at once, in one transaction, exactly like the
   menu tree: drag zero + save once. */
dashRouter.post('/dash/board-items/replace', verifyToken, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const boardId = Number(req.body?.boardId);
    if (!Number.isFinite(boardId) || boardId <= 0) return res.status(400).json({ error: 'Invalid board' });
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length > 500) return res.status(400).json({ error: 'A board can hold at most 500 items' });
    const pool = await getPool();
    const rows = await execFnTx(pool, 'sp_dash_board_item_replace',
      [boardId, JSON.stringify(items)]);
    if (fail(res, rows)) return;
    log(req, 'sp_dash_board_item_replace', [boardId, items.length]);
    res.json({ ok: true, count: rows[0]?.count ?? items.length, message: rows[0]?.message || 'Board saved' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

dashRouter.get('/dash/board/assignments/:id', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid board' });
    const rows = await execFn(pool, 'sp_dash_board_assignment_list', [id]);
    res.json({ ok: true, assignments: camelRows(rows) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

dashRouter.post('/dash/board/assign', verifyToken, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const b = req.body || {};
    const pool = await getPool();
    const rows = await execFn(pool, 'sp_dash_board_assign',
      [Number(b.boardId) || 0, String(b.subjectType || 'user'), String(b.subjectId || ''),
        req.user?.userid || 'ADMIN']);
    if (fail(res, rows)) return;
    log(req, 'sp_dash_board_assign', [b.boardId, b.subjectType, b.subjectId]);
    res.json({ ok: true, message: rows[0]?.message || 'Assigned' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

dashRouter.post('/dash/board/assign/delete', verifyToken, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = Number(req.body?.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const pool = await getPool();
    const rows = await execFn(pool, 'sp_dash_board_unassign', [id]);
    if (fail(res, rows)) return;
    log(req, 'sp_dash_board_unassign', [id]);
    res.json({ ok: true, message: rows[0]?.message || 'Removed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* The person's own board, for "your own dashboard". An administrator's pin
   always wins, and clearing it falls back to the company default. */
dashRouter.post('/dash/board/select', verifyToken, async (req, res) => {
  try {
    const boardId = req.body?.boardId == null ? null : Number(req.body.boardId);
    const pool = await getPool();
    const rows = await execFn(pool, 'sp_dash_board_select', [boardId, req.user?.userid || '']);
    if (fail(res, rows)) return;
    log(req, 'sp_dash_board_select', [boardId]);
    res.json({ ok: true, message: rows[0]?.message || 'Saved' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Which board the dashboard view should draw for this person, and why. */
dashRouter.get('/dash/board/resolved', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    const who = String(req.query.user || req.user?.userid || '');
    if (!/^[A-Za-z0-9_.@-]{1,64}$/.test(who)) return res.status(400).json({ error: 'Invalid user' });
    const rows = await execFn(pool, 'sp_dash_board_resolve', [who, req.query.grp || null]);
    res.json({ ok: true, resolved: camelRows(rows) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

dashRouter.post('/dash/board/seed-examples', verifyToken, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const pool = await getPool();
    const rows = await execFn(pool, 'sp_dash_board_seed_examples', []);
    res.json({ ok: true, message: rows[0]?.message || 'Done' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

