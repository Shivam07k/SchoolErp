import { Router } from 'express';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from '../db/pool.js';
import { execFn } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { appendSqlLog, sqlCall, SQL_TOKEN } from '../logging/sql.js';
import { als } from '../logging/als.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '../../..');
const FORMS_DIR = path.join(PROJECT_ROOT, 'src/forms');
const FORM_ID_RE = /^[a-zA-Z0-9_\-]+$/;
const SP_NAME_RE = /^sp_[a-zA-Z0-9_]+$/;

export const crudRouter = Router();

/* ---------- config cache (base form.json, old xErp: config.sp) ---------- */
const configCache = new Map();
const CONFIG_TTL = 15_000;

/* ---------- filtered-grid row-total cache ---------- */
const countCache = new Map();
const COUNT_TTL = Number(process.env.GRID_COUNT_TTL_MS || 15_000);
const countCacheGet = (k) => {
  const e = countCache.get(k);
  if (!e) return null;
  if (Date.now() - e.at > COUNT_TTL) { countCache.delete(k); return null; }
  return e;
};

export function clearConfigCache(formId) {
  configCache.delete(formId);
}

async function readJson(fp) {
  try { return JSON.parse(await fs.readFile(fp, 'utf-8')); } catch { return null; }
}

async function loadFormConfig(formId, appId) {
  if (!FORM_ID_RE.test(formId)) throw new Error('Invalid form ID');
  const key = `${appId || ''}:${formId}`;
  const hit = configCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.cfg;
  if (appId && FORM_ID_RE.test(appId)) {
    let cfg = await readJson(path.join(PROJECT_ROOT, 'server', 'src', 'schools', appId, 'forms', formId, 'form.json'));
    if (!cfg) cfg = await readJson(path.join(PROJECT_ROOT, 'server', 'src', 'schools', appId, 'forms', formId, 'schema.json'));
    if (cfg) {
      configCache.set(key, { cfg, expires: Date.now() + CONFIG_TTL });
      return cfg;
    }
  }
  let cfg = await readJson(path.join(FORMS_DIR, formId, 'form.json'));
  if (!cfg) cfg = await readJson(path.join(FORMS_DIR, formId, 'schema.json'));
  if (!cfg) throw new Error('Form config not found');
  configCache.set(key, { cfg, expires: Date.now() + CONFIG_TTL });
  return cfg;
}

/* xErp form.json spells the grid proc key either "grid" or "search"; brand and
   most forms use "grid". */
function spName(cfg, formId, keys, fallback) {
  for (const k of [].concat(keys)) {
    if (cfg.sp?.[k]) {
      const name = cfg.sp[k];
      if (!SP_NAME_RE.test(name)) throw new Error(`Invalid stored procedure name: ${name}`);
      return name;
    }
  }
  const name = `sp_${formId}_${fallback}`;
  if (!SP_NAME_RE.test(name)) throw new Error(`Invalid stored procedure name: ${name}`);
  return name;
}

/* ---------- positional field order ----------
   The sp_* contract is positional, so the argument list must follow the
   form's declared field order. A page that omits a field would otherwise
   shift every later argument into the wrong slot, so fill the gap with ''.
   Header and line-item procs have different orders, hence the kind.

   The base order comes from the shared contract, but a company can add or
   move fields relative to it in src/companies/<companyId>/fieldOrder.json.
   That is what makes a company-specific column possible: the company ships
   its own sp_* signature with the extra parameter, and this file is what
   decides where in the argument list the value has to be sent. Because the
   answer depends on which database the request reached, the resolved order
   is cached per company, and keyed on the same company id getPool() uses so
   the two can never disagree. */
const fieldOrderCache = new Map();

function readContractOrder() {
  const order = { header: new Map(), det: new Map() };
  try {
    const c = JSON.parse(fsSync.readFileSync(path.join(PROJECT_ROOT, 'server/_contract.json'), 'utf-8'));
    for (const [id, f] of Object.entries(c?.forms || {})) {
      order.header.set(id, (f.headerFields || []).map((x) => x.name));
      order.det.set(id, (f.detFields || []).map((x) => x.name));
    }
  } catch { /* contract unavailable: fall back to payload order */ }
  return order;
}

const namesIn = (v) => (Array.isArray(v) ? v.filter((n) => typeof n === 'string' && n) : null);

function applyCompanyOrder(order, spec) {
  if (!spec || typeof spec !== 'object') return;
  for (const [formId, kinds] of Object.entries(spec)) {
    if (!kinds || typeof kinds !== 'object') continue;
    for (const kind of ['header', 'det']) {
      const s = kinds[kind];
      if (!s || typeof s !== 'object') continue;
      const base = order[kind].get(formId);
      /* An override for a form the contract does not know about cannot be
         merged: there is no base list to extend, and a partial order would
         silently shift every later argument into the wrong column. */
      if (!base?.length) {
        console.warn(`[fieldOrder] ${formId} (${kind}) is not in _contract.json, ignoring override`);
        continue;
      }
      let names = base;
      const replace = namesIn(s.replace);
      const prepend = namesIn(s.prepend);
      const append = namesIn(s.append);
      if (replace) names = replace;
      if (prepend) names = [...prepend, ...names];
      if (append) names = [...names, ...append];
      order[kind].set(formId, names);
    }
  }
}

/* mtime-keyed so editing fieldOrder.json (or registering a new company) takes
   effect on the next request, the same way config/companies.json hot-reloads.
   Without this a new company field would need a server restart to show up. */
function loadFieldOrder() {
  const company = als.getStore()?.company || DEFAULT_COMPANY_ID;
  const fp = path.join(PROJECT_ROOT, 'src/companies', company, 'fieldOrder.json');
  let mtime = 0;
  try { mtime = fsSync.statSync(fp).mtimeMs; } catch { /* no override for this company */ }
  const hit = fieldOrderCache.get(company);
  if (hit && hit.mtime === mtime) return hit.order;
  const order = readContractOrder();
  if (mtime) {
    try { applyCompanyOrder(order, JSON.parse(fsSync.readFileSync(fp, 'utf-8'))); }
    catch (e) { console.warn(`[fieldOrder] ${company}: ${e.message}`); }
  }
  fieldOrderCache.set(company, { order, mtime });
  return order;
}

/* Drop cached orders when a company's override is edited or removed. */
export function clearFieldOrderCache(companyId) {
  if (companyId) fieldOrderCache.delete(companyId);
  else fieldOrderCache.clear();
}

function orderedParams(formId, params, kind = 'header') {
  const order = loadFieldOrder()[kind].get(formId);
  if (!order?.length) return Object.values(params || {});
  return order.map((n) => {
    const v = params?.[n];
    return v === undefined || v === null ? '' : v;
  });
}

crudRouter.post('/', verifyToken, async (req, res) => {
  try {
    const { formId, action, id, params, csv, pagesize, pageno, FCODE } = req.body;
    if (!FORM_ID_RE.test(formId || '')) return res.json({ error: 'Invalid form ID' });

    let config;
    try { config = await loadFormConfig(formId, getAppId(req)); }
    catch (e) { return res.json({ error: e.message }); }

    const uid = req.user?.userid || req.user?.id || '';
    const sessionToken = req.user?.sessionToken || '';
    const authType = config.authType || 'token';
    const authVal = authType === 'userId' ? uid : sessionToken;
    const fcode = FCODE || req.user?.fcode || 'HO';
    const ps = parseInt(pagesize || 20, 10) || 20;
    const pn = Math.max(parseInt(pageno || 1, 10) || 1, 1);
    const searchFields = config.searchFields || [];
    const pool = await getPool();

    /* values are sent as text; NULL/'' both become '' */
    const A = (a = []) => a.map((v) => (v === undefined || v === null ? '' : v));
    const tok = () => SQL_TOKEN;
    const sig = (name, vals) => sqlCall(name, vals, uid);
    const log = (act, name, vals, extra = {}) =>
      appendSqlLog(act, req.user?.company || '', formId, sessionToken, uid, sig(name, vals), extra);

    switch ((action || '').toUpperCase()) {
      /* ---- (formId, auth, '') -> blank record ---- */
      case '_BOOT': {
        const sp = config.sp?.boot;
        if (!sp) return res.json({});
        const a = A([formId, authVal, '']);
        try {
          const rows = await execFn(pool, sp, a);
          log('_BOOT', sp, [formId, tok(), '']);
          return res.json(rows[0] || {});
        } catch { return res.json({}); }
      }

      /* ---- (pagesize, pageno, <one arg per searchField>, formId, FCODE, auth) ---- */
            case '_SEARCH_JSON': {
              const sp = spName(config, formId, ['grid', 'search'], 'Grid2');
              const filters = searchFields.map((f) => A([params?.[f.name] ?? ''])[0]);
              /* Reuse a recent row total instead of recounting. Counting matches
                 is the expensive half of a filtered grid (600ms over 1M rows vs
                 12ms to fetch the page) and the total only drives the pager, so
                 a few seconds of staleness costs nothing and never changes which
                 rows are returned. Unfiltered grids read the planner's row
                 estimate, which is already O(1), so only filtered searches are
                 cached. */
              const filtered = filters.some((v) => v !== '');
              const ck = filtered ? `${formId}|${fcode}|${filters.join('\u0000')}` : '';
              const hit = ck ? countCacheGet(ck) : null;
              const a = A([String(ps), String(pn), ...filters, formId, fcode, authVal, hit ? 'skip' : '']);
              log('_SEARCH_JSON', sp, [ps, pn, ...filters, formId, fcode, tok()], { ps, pn });
              let rows = [];
              try { rows = await execFn(pool, sp, a); } catch (e) { console.error('Grid error:', e.message); }
              let rc = 0;
              for (const r of rows) {
                if (r.rc !== undefined && r.rc !== null) { rc = Number(r.rc) || 0; }
                delete r.rc;
              }
              if (hit) rc = hit.rc;
              else if (ck) {
                if (countCache.size > 500) countCache.clear();
                countCache.set(ck, { rc, at: Date.now() });
              }
              const gridKey = (csv || 'grid1').split(',')[0].trim() || 'grid1';
              return res.json({ [gridKey]: rows, TotalPages: [{ TotalPages: rc }] });
            }

      /* ---- (id, formId, auth, '') -> flat hdr1 row + det1 line items ---- */
      case '_EDIT_JSON': {
        const dfe1 = spName(config, formId, 'dfe1', 'DFE1');
        const a = A([id, formId, authVal, '']);
        log('_EDIT_JSON', dfe1, [id, formId, tok(), '']);
        const out = { hdr1: [] };
        try { out.hdr1 = await execFn(pool, dfe1, a); }
        catch (e) { console.error('EDIT error:', e.message); return res.json(out); }
        /* master-detail pages render hdr1 + a line-item grid from det1 */
        if (config.formType === 'master-detail' && config.sp?.dfe2) {
          try { out.det1 = await execFn(pool, config.sp.dfe2, a); }
          catch (e) { console.error('DFE2 error:', e.message); out.det1 = []; }
        }
        return res.json(out);
      }

      /* ---- (<fields...>, formId, FCODE, auth, '') ---- */
      case '_SAVE': {
        const sp = spName(config, formId, 'save', 'SAVE');
          const vals = orderedParams(formId, params);
        const a = A([...vals, formId, fcode, authVal, '']);
        log('_SAVE', sp, [...vals, formId, fcode, tok(), '']);
        const rows = await execFn(pool, sp, a);
        return res.json({ det1: rows, sts: rows.filter((r) => r.status === 'Error' || r.Error) });
      }

      /* ---- (id, <fields...>, formId, FCODE, auth, '') ---- */
      case '_UPDATE': {
        const sp = spName(config, formId, 'update', 'UPDATE');
          const vals = orderedParams(formId, params);
        const a = A([id, ...vals, formId, fcode, authVal, '']);
        log('_UPDATE', sp, [id, ...vals, formId, fcode, tok(), '']);
        const rows = await execFn(pool, sp, a);
        return res.json({ det1: rows, sts: rows.filter((r) => r.status === 'Error' || r.Error) });
      }

      /* ---- (id, formId, auth, '') -> {hdr1, det1} for PrintPage.jsx ---- */
      case '_PRINT_ROW': {
        const sp = spName(config, formId, 'printRow', 'PRINT_ROW1');
        const a = A([id, formId, authVal, '']);
        log('_PRINT_ROW', sp, [id, formId, tok(), '']);
        const rows = await execFn(pool, sp, a);
        const row = rows[0] || {};
        const { det1, ...hdr } = row;
        return res.json({ hdr1: [hdr], det1: Array.isArray(det1) ? det1 : [] });
      }

      /* ---- run a whitelisted dynamic SP chosen by the page ---- */
      case '_EXEC_SP': {
        const name = params?._spName;
        if (!name || !SP_NAME_RE.test(name)) {
          return res.status(400).json({ error: 'Invalid stored procedure name' });
        }
        /* the page passes its own named args after _spName */
        const rest = Object.entries(params).filter(([k]) => k !== '_spName').map(([, v]) => A([v])[0]);
        log('_EXEC_SP', name, [...rest, tok()]);
        const rows = await execFn(pool, name, A([...rest, authVal]));
        return res.json({ result1: rows });
      }

      /* ---- line items: (<fields...>, formId, FCODE, auth, '') ---- */
      case '_DET_SAVE': {
        const sp = config.sp?.detSave;
        if (!sp) return res.json({ error: 'Form has no detail rows' });
        const vals = orderedParams(formId, params, 'det');
        const a = A([...vals, formId, fcode, authVal, '']);
        log('_DET_SAVE', sp, [...vals, formId, fcode, tok(), '']);
        const rows = await execFn(pool, sp, a);
        return res.json({ det1: rows, sts: rows.filter((r) => r.status === 'Error' || r.Error) });
      }

      /* ---- (id, <fields...>, formId, FCODE, auth, '') ---- */
      case '_DET_UPDATE': {
        const sp = config.sp?.detUpdate;
        if (!sp) return res.json({ error: 'Form has no detail rows' });
        const vals = orderedParams(formId, params, 'det');
        const a = A([id, ...vals, formId, fcode, authVal, '']);
        log('_DET_UPDATE', sp, [id, ...vals, formId, fcode, tok(), '']);
        const rows = await execFn(pool, sp, a);
        return res.json({ det1: rows, sts: rows.filter((r) => r.status === 'Error' || r.Error) });
      }

      case '_DET_DELETE': {
        const sp = config.sp?.detDelete;
        if (!sp) return res.json({ error: 'Form has no detail rows' });
        const a = A([id, formId, authVal, '']);
        log('_DET_DELETE', sp, [id, formId, tok(), '']);
        const rows = await execFn(pool, sp, a);
        return res.json({ det1: rows, sts: rows.filter((r) => r.status === 'Error' || r.Error) });
      }

      /* ---- (id, formId, auth, '') ---- */
      case '_DELETE':
      case '_DELETE_ROW': {
        const sp = spName(config, formId, 'delete', 'Delete1');
        const a = A([id, formId, authVal, '']);
        log('_DELETE', sp, [id, formId, tok(), '']);
        const rows = await execFn(pool, sp, a);
        if ((action || '').toUpperCase() === '_DELETE_ROW') return res.json({ det1: rows });
        return res.json({ ret: rows });
      }

      case '_LOCK': {
        const sp = spName(config, formId, 'lock', 'LockUnlock1');
        const a = A([id, formId, authVal, '']);
        log('_LOCK', sp, [id, formId, tok(), '']);
        const rows = await execFn(pool, sp, a);
        return res.json({ ret: rows, sts: rows });
      }

      /* ---- (formId, auth, '') -> blank row, or a new draft id on
             master-detail forms (their pages attach detail rows to it) ---- */
      case '_ADD_BLANK': {
        const sp = spName(config, formId, 'addBlank', 'AddBlank');
        const a = A([formId, authVal, '']);
        log('_ADD_BLANK', sp, [formId, tok(), '']);
        const rows = await execFn(pool, sp, a);
        return res.json(rows[0] || {});
      }

      default:
        return res.json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error('CRUD error:', err.message);
    res.json({ error: 'Request failed' });
  }
});
