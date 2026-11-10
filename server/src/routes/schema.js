import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyToken } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '../../..');
const FORMS_DIR = path.join(PROJECT_ROOT, 'src/forms');
const COMPANIES_DIR = path.join(PROJECT_ROOT, 'src/companies');
const FORM_ID_RE = /^[a-zA-Z0-9_\-]+$/;

export const schemaRouter = Router();

async function readJson(fp) {
  try { return JSON.parse(await fs.readFile(fp, 'utf-8')); } catch { return null; }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/* Company override merge.
   A company override is a PARTIAL form.json: it states only what differs from
   the common form, so it is deep-merged over the base rather than replacing
   it. That is what lets src/companies/bke/forms/frmDeptSale3/form.json contain
   four lines and hide one field, instead of a 100-line copy that has to be
   re-merged by hand every time the common form changes.

   Arrays whose entries all carry a "name" are merged by name, so an override
   can flip `hidden` on a field the base already declares - and can add a field
   the base does not have. Every other array is replaced wholesale. */
function mergeConfig(base, over) {
  if (Array.isArray(over)) {
    const keyed = over.length > 0 && over.every((e) => isPlainObject(e) && 'name' in e);
    if (keyed && Array.isArray(base)) {
      const out = base.slice();
      for (const o of over) {
        const i = out.findIndex((b) => isPlainObject(b) && b.name === o.name);
        if (i >= 0) out[i] = mergeConfig(out[i], o);
        else out.push(o);
      }
      return out;
    }
    return over.slice();
  }
  if (isPlainObject(over)) {
    const out = isPlainObject(base) ? { ...base } : {};
    for (const [k, v] of Object.entries(over)) out[k] = mergeConfig(out[k], v);
    return out;
  }
  return over === undefined ? base : over;
}

/* list of available form packages */
schemaRouter.get('/forms', verifyToken, async (_req, res) => {
  let dirs = [];
  try { dirs = await fs.readdir(FORMS_DIR); } catch { dirs = []; }
  const forms = [];
  for (const d of dirs) {
    if (!FORM_ID_RE.test(d)) continue;
    const cfg = await readJson(path.join(FORMS_DIR, d, 'form.json')) || await readJson(path.join(FORMS_DIR, d, 'schema.json'));
    if (cfg) forms.push({ formId: d, title: cfg.title || d, formType: cfg.formType || 'master' });
  }
  res.json({ ok: true, forms });
});

/* single form config: common form, overlaid with this company's partial
   override when it has one.

   Registered on two paths. /:formId is the one src/formRegistry.js requests
   (/api/form-config/frmDeptSale3); the /form-config/:formId alias keeps the
   older doubled-up URL working, since this router is also mounted at
   /api/schema and existing callers still use that shape. */
async function formConfig(req, res) {
  const formId = req.params.formId;
  if (!FORM_ID_RE.test(formId || '')) return res.status(400).json({ error: 'Invalid form ID' });
  const base = await readJson(path.join(FORMS_DIR, formId, 'form.json'))
    || await readJson(path.join(FORMS_DIR, formId, 'schema.json'));
  if (!base) return res.status(404).json({ error: 'Form config not found' });

  /* which company is asking. It comes from the token client-side, so it is
     whitelisted exactly like a form id - it is used to build a path. A form
     the company has not overridden is served unchanged. */
  const appId = String(req.query.appId || '').trim();
  let config = base;
  let appliedOverride = null;
  if (appId) {
    if (!FORM_ID_RE.test(appId)) return res.status(400).json({ error: 'Invalid appId' });
    const override = await readJson(path.join(COMPANIES_DIR, appId, 'forms', formId, 'form.json'));
    if (override) {
      config = mergeConfig(base, override);
      appliedOverride = appId;
    }
  }

  return res.json({ ok: true, config, appliedOverride, isCommon: appliedOverride === null });
}

schemaRouter.get('/:formId', verifyToken, formConfig);
schemaRouter.get('/form-config/:formId', verifyToken, formConfig);