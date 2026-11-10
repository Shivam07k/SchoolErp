import { Router } from 'express';
import { getPool } from '../db/pool.js';
import { execFn, execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { appendSqlLog, sqlCall, SQL_TOKEN } from '../logging/sql.js';

export const menuRouter = Router();

menuRouter.get('/menu', verifyToken, async (req, res) => {
  try {
    const fcode = req.query.fcode || 'HO';
    const pool = await getPool();
    const sess = req.user?.sessionToken || null;
    const userid = req.user?.userid || '';

    /* A menu pinned for this person wins. Anything unresolved falls through to
       the original menu below, so turning every custom menu off puts the app
       back exactly as it was.

       The custom menu is sent as a flat ordered list carrying its own parent
       and depth rather than being forced into the original two-level shape:
       it nests to any depth, and squeezing it into {group:{subgroup:[..]}}
       would lose the structure the person built. */
    try {
      const custom = await execFn(pool, 'sp_dash_menu_tree', [userid, null]);
      if (custom && custom.length) {
        const resolve = await execFn(pool, 'sp_dash_menu_resolve', [userid, null]);
        return res.json({
          ok: true,
          menu: {},
          source: 'custom',
          setId: resolve[0]?.SetId ?? null,
          setName: resolve[0]?.Name || '',
          reason: resolve[0]?.Reason || '',
          custom: custom.map((r) => ({
            id: r.Id,
            parentId: r.ParentId,
            label: r.Label,
            kind: r.Kind,
            target: r.Target,
            icon: r.Icon,
            openNew: !!r.OpenNew,
            color: r.Color,
            sortOrder: r.SortOrder,
            depth: r.Depth,
          })),
        });
      }
    } catch (e) {
      /* no custom menu tables or no set resolved: use the original menu */
    }

    const rows = await execFn(pool, 'sp_get_menus', [fcode, sess]);
    appendSqlLog('_MENU', req.user?.company || '', 'menu', sess || '', userid,
      sqlCall('sp_get_menus', [fcode, sess ? SQL_TOKEN : null], userid));

    const tree = {};
    for (const item of rows) {
      const mg = item.MainGroup || 'Other';
      if (!tree[mg]) tree[mg] = {};
      const sg = item.SubGroup || '-';
      if (!tree[mg][sg]) tree[mg][sg] = [];
      tree[mg][sg].push({
        title: item.MenuTitle,
        formId: extractFormId(item.WebPage),
        webPage: item.WebPage,
        icon: item.DisplayIcon,
        visible: item.ShowStatus,
      });
    }
    res.json({ ok: true, menu: tree, source: 'original' });
  } catch (err) {
    console.error('Menu error:', err.message);
    res.json({ ok: true, menu: {}, source: 'original' });
  }
});

menuRouter.get('/dashboard', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    let stats = {};
    try {
      const rows = await execFn(pool, 'sp_dashboard_stats', []);
      for (const r of rows) stats[r.key] = r.val;
      appendSqlLog('_DASH_STATS', req.user?.company || '', 'dashboard', req.user?.sessionToken || '', req.user?.userid || '', 'sp_dashboard_stats()');
    } catch (e) { console.error('Dashboard stats error:', e.message); }

    let links = [];
    try {
      links = await execFn(pool, 'sp_dashboard_links', ['admin', req.user?.sessionToken || null]);
      appendSqlLog('_DASH_LINKS', req.user?.company || '', 'dashboard', req.user?.sessionToken || '', req.user?.userid || '',
        sqlCall('sp_dashboard_links', ['admin', req.user?.sessionToken ? SQL_TOKEN : null], req.user?.userid));
    } catch (e) { console.error('Dashboard links error:', e.message); }

    res.json({ ok: true, stats, links, forms: [] });
  } catch (err) {
    console.error('Dashboard error:', err.message);
    res.json({ ok: true, stats: {}, links: [], forms: [] });
  }
});

menuRouter.get('/tables', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    const rows = await execQ(pool,
      `SELECT table_name FROM information_schema.tables
        WHERE table_type='BASE TABLE' AND table_schema='public'
        ORDER BY table_name`);
    res.json({ ok: true, tables: rows.map((r) => r.table_name) });
  } catch {
    res.status(500).json({ error: 'Failed to list tables' });
  }
});

menuRouter.get('/columns/:table', verifyToken, async (req, res) => {
  try {
    const table = req.params.table;
    if (!/^[A-Za-z0-9_]+$/.test(table)) return res.status(400).json({ error: 'Invalid table name' });
    const pool = await getPool();
    const rows = await execQ(pool,
      `SELECT column_name, data_type, character_maximum_length, is_nullable
         FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position`, [table]);
    res.json({ ok: true, columns: rows });
  } catch {
    res.status(500).json({ error: 'Failed to load columns' });
  }
});

function extractFormId(webPage) {
  if (!webPage) return '';
  const m = webPage.match(/(?:frm|rpt)(\w+)/i);
  if (!m) return String(webPage).replace(/\.aspx?$/i, '');
  const prefix = webPage.match(/^(frm|rpt)/i)?.[0]?.toLowerCase() || 'frm';
  return prefix + m[1].replace(/_JQ|_AE|_AEG|_SS/gi, '');
}