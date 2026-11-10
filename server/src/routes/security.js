import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getPool } from '../db/pool.js';
import { execFn, execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { appendSqlLog, sqlCall } from '../logging/sql.js';

export const securityRouter = Router();

const SAFE = /^[A-Za-z0-9_\- ]*$/;
const SCOPE_RE = /^[UGD]$/;

/* The security screens speak a small REST dialect rather than the Grid2
   one: they POST a named master (not a recordset) and expect {status,
   message}. Results are a single row, so a plain SELECT is enough. */
function resultOf(rows) {
  const r = rows && rows[0];
  return r ? String(r.status || '').toLowerCase() : '';
}

function ok(res, rows, fallback) {
  const status = resultOf(rows);
  if (status && status !== 'ok' && status !== 'success') {
    return res.status(400).json({ ok: false, error: (rows[0] && rows[0].message) || 'Save failed', result: rows[0] || {} });
  }
  return res.json({ ok: true, status: 'ok', result: rows[0] || {}, message: (rows[0] && rows[0].message) || fallback });
}

/* ============================ users ============================ */

securityRouter.get('/users', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    const rows = await execFn(pool, 'sp_sec_user_list', []);
    appendSqlLog('_SEC_USERS', '', 'security', '', '', 'sp_sec_user_list()');
    res.json({ ok: true, users: rows });
  } catch (err) {
    console.error('Users error:', err.message);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

/* frmSecUser/AddEditPage reads the header plus the two membership lists. */
securityRouter.get('/user/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!SAFE.test(userId)) return res.status(400).json({ error: 'Invalid user id' });
    const pool = await getPool();
    const rows = await execFn(pool, 'sp_sec_user_get', [userId]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const { depts, grps, hasPassword, ...hdr } = rows[0];
    res.json({ ok: true, hdr, depts: depts || [], grps: grps || [], hasPassword: !!hasPassword });
  } catch (err) {
    console.error('User load error:', err.message);
    res.status(500).json({ error: 'Failed to load user' });
  }
});

async function saveUser(req, res) {
  try {
    const { userId, userName, designation, status, deptsCsv, grpsCsv, password, passwordHash } = req.body;
    if (!userId || !SAFE.test(String(userId))) return res.status(400).json({ error: 'Invalid user id' });
    const pool = await getPool();
    /* sp_sec_user_save stores the hash verbatim and keeps the old one when the
       argument is NULL, so "password left blank" must arrive as NULL - not as
       an empty string, which would wipe the hash and lock the user out. */
    let hash = passwordHash || null;
    if (password) hash = await bcrypt.hash(String(password), 10);
    if (hash && !String(hash).startsWith('$2')) hash = await bcrypt.hash(String(hash), 10);
    const saveArgs = [
      req.user?.userid || 'ADMIN', String(userId).trim(), userName || '', hash,
      designation || '', status || '1', deptsCsv || '', grpsCsv || '',
    ];
    const user = await execFn(pool, 'sp_sec_user_save', saveArgs);
    appendSqlLog('_SEC_USER_SAVE', '', 'security', req.user?.sessionToken || '', userId,
      sqlCall('sp_sec_user_save', saveArgs.map((a, i) => (i === 3 && a ? '<hashed>' : a)), userId));
    res.json({ ok: true, result: user[0] || {} });
  } catch (err) {
    console.error('User save error:', err.message);
    res.status(500).json({ error: 'Failed to save user' });
  }
}

securityRouter.post('/user', verifyToken, saveUser);
securityRouter.post('/users/save', verifyToken, saveUser);

/* ======================== departments ======================== */

securityRouter.get('/departments', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    res.json({ ok: true, departments: await execFn(pool, 'sp_sec_dept_list', []) });
  } catch (err) {
    console.error('Departments error:', err.message);
    res.status(500).json({ error: 'Failed to load departments' });
  }
});

securityRouter.post('/department', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    return ok(res, await execFn(pool, 'sp_sec_dept_save', [req.body.deptName || '']), 'Added');
  } catch (err) {
    console.error('Department save error:', err.message);
    res.status(500).json({ error: 'Failed to save department' });
  }
});

securityRouter.post('/department/delete', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    return ok(res, await execFn(pool, 'sp_sec_dept_delete', [req.body.deptId]), 'Deleted');
  } catch (err) {
    console.error('Department delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

/* =========================== groups =========================== */

securityRouter.get('/groups', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    res.json({ ok: true, groups: await execFn(pool, 'sp_sec_grp_list', []) });
  } catch (err) {
    console.error('Groups error:', err.message);
    res.status(500).json({ error: 'Failed to load groups' });
  }
});

securityRouter.post('/group', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    return ok(res, await execFn(pool, 'sp_sec_grp_save', [req.body.groupName || '', !!req.body.isAdmin]), 'Added');
  } catch (err) {
    console.error('Group save error:', err.message);
    res.status(500).json({ error: 'Failed to save group' });
  }
});

securityRouter.post('/group/delete', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    return ok(res, await execFn(pool, 'sp_sec_grp_delete', [req.body.grpId]), 'Deleted');
  } catch (err) {
    console.error('Group delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

/* ============================ links =========================== */

securityRouter.get('/links', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    res.json({ ok: true, links: await execFn(pool, 'sp_sec_link_list', []) });
  } catch (err) {
    console.error('Links error:', err.message);
    res.status(500).json({ error: 'Failed to load links' });
  }
});

securityRouter.post('/links', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    const pool = await getPool();
    return ok(res, await execFn(pool, 'sp_sec_link_save', [
      b.linkId || 0, b.linkName || '', b.linkType || 'FORM', b.formId || '',
      b.url || '', b.icon || '', Number(b.menuOrder) || 0, b.active !== false,
    ]), 'Saved');
  } catch (err) {
    console.error('Link save error:', err.message);
    res.status(500).json({ error: 'Failed to save link' });
  }
});

securityRouter.post('/links/delete', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    return ok(res, await execFn(pool, 'sp_sec_link_delete', [req.body.linkId]), 'Deleted');
  } catch (err) {
    console.error('Link delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete link' });
  }
});

/* =========================== menus =========================== */

securityRouter.get('/menus', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    res.json({ ok: true, menus: await execFn(pool, 'sp_sec_menu_list', [req.query.fcode || '']) });
  } catch (err) {
    console.error('Menus error:', err.message);
    res.status(500).json({ error: 'Failed to load menus' });
  }
});

securityRouter.post('/menus', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    const pool = await getPool();
    return ok(res, await execFn(pool, 'sp_sec_menu_save', [
      b.id || 0, b.menuTitle || '', b.subGroup || '', b.icon || '',
      Number(b.menuOrder) || 99, b.show !== false, b.showOnDashboard !== false, !!b.adminOnly,
    ]), 'Saved');
  } catch (err) {
    console.error('Menu save error:', err.message);
    res.status(500).json({ error: 'Failed to save menu' });
  }
});

securityRouter.get('/menu-scope', verifyToken, async (req, res) => {
  try {
    const { scopeType = '', scopeId = '' } = req.query;
    if (!SCOPE_RE.test(String(scopeType))) return res.status(400).json({ error: 'Invalid scope type' });
    const pool = await getPool();
    res.json({ ok: true, scopes: await execFn(pool, 'sp_sec_menu_scope_get', [scopeType, String(scopeId)]) });
  } catch (err) {
    console.error('Menu scope error:', err.message);
    res.status(500).json({ error: 'Failed to load menu scope' });
  }
});

securityRouter.post('/menu-scope', verifyToken, async (req, res) => {
  try {
    const { scopeType, scopeId, items } = req.body || {};
    if (!SCOPE_RE.test(String(scopeType || ''))) return res.status(400).json({ error: 'Invalid scope type' });
    const pool = await getPool();
    return ok(res, await execFn(pool, 'sp_sec_menu_scope_save', [scopeType, String(scopeId || ''), JSON.stringify(items || [])]), 'Saved');
  } catch (err) {
    console.error('Menu scope save error:', err.message);
    res.status(500).json({ error: 'Failed to save menu scope' });
  }
});

/* ========================= permissions ========================= */

securityRouter.get('/perm', verifyToken, async (req, res) => {
  try {
    const { scopeType = '', scopeId = '', formId = '' } = req.query;
    if (!SCOPE_RE.test(String(scopeType))) return res.status(400).json({ error: 'Invalid scope type' });
    const pool = await getPool();
    const rows = await execQ(pool, `SELECT * FROM sp_sec_perm_get($1,$2,$3)`, [scopeType, String(scopeId), String(formId)]);
    res.json({ ok: true, perm: rows[0] || {} });
  } catch (err) {
    console.error('Perm load error:', err.message);
    res.status(500).json({ error: 'Failed to load permission' });
  }
});

securityRouter.get('/perm/:scopeType/:scopeId/:formId', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    const rows = await execQ(pool,
      `SELECT * FROM sp_sec_perm_get($1,$2,$3)`, [req.params.scopeType, req.params.scopeId, req.params.formId]);
    res.json({ ok: true, perm: rows[0] || {} });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load permission' });
  }
});

securityRouter.post('/perm', verifyToken, async (req, res) => {
  try {
    /* the screen posts the flag set as "flags"; older callers post "json" */
    const { scopeType, scopeId, formId, flags, json } = req.body || {};
    if (!SCOPE_RE.test(String(scopeType || ''))) return res.status(400).json({ error: 'Invalid scope type' });
    const pool = await getPool();
    const payload = flags || json || {};
    const rows = await execQ(pool,
      `SELECT * FROM sp_sec_perm_save($1,$2,$3,$4)`, [scopeType, String(scopeId), formId, JSON.stringify(payload)]);
    const r = rows[0] || {};
    if (String(r.status || '').toLowerCase() === 'error') {
      return res.status(400).json({ ok: false, error: r.message || 'Save failed', result: r });
    }
    res.json({ ok: true, result: r });
  } catch (err) {
    console.error('Perm save error:', err.message);
    res.status(500).json({ error: 'Failed to save permissions' });
  }
});

/* ========================== companies ========================== */

securityRouter.get('/companies', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    const rows = await execFn(pool, 'sp_company_list', []);
    appendSqlLog('_SEC_COMPANIES', '', 'security', '', '', 'sp_company_list()');
    res.json({ ok: true, companies: rows });
  } catch (err) {
    console.error('Companies error:', err.message);
    res.status(500).json({ error: 'Failed to load companies' });
  }
});

securityRouter.post('/companies', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    const pool = await getPool();
    return ok(res, await execFn(pool, 'sp_company_save', [
      b.id || 0, b.franchiseeCode || '', b.company || '', b.name || '', b.status || '1',
    ]), 'Saved');
  } catch (err) {
    console.error('Company save error:', err.message);
    res.status(500).json({ error: 'Failed to save company' });
  }
});
