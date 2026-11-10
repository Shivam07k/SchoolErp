import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from '../db/pool.js';
import { execFn } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';

export const customFieldRouter = Router();

customFieldRouter.use(verifyToken);

/* The entity -> table map is read from the same contract the generated SQL was
   built from, so a custom field can only ever be attached to a table the form
   layer already knows about. A caller-supplied table name never reaches the
   dynamic SQL in sp_cf_*. */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT_FILE = path.join(HERE, '..', '..', '_contract.json');
/* Read lazily and never throw: a missing catalog must not stop the whole API
   from booting. Without the map every custom-field call is rejected as an
   unknown entity, which is the safe failure - no dynamic SQL runs at all. */
let TBL = {};
try {
  const contract = JSON.parse(fs.readFileSync(CONTRACT_FILE, 'utf8'));
  TBL = contract.entities || {};
} catch (err) {
  console.warn(
    `[customfields] ${CONTRACT_FILE} unavailable (${err.code || err.message}); custom fields are disabled`,
  );
}

const TYPES = ['text', 'number', 'date', 'bool', 'lookup'];
/* <entity>.<field>: the entity segment keeps the form's real casing, the
   field segment is lower snake. Lowercasing the whole key would reject every
   camelCase form (frmItemNoDyn, fromProcess), and the equality check below
   pins the prefix to a real entity. */
const KEY_RE = /^[A-Za-z][A-Za-z0-9_]*\.[a-z0-9_]+$/;

const entityOf = (req) => String(req.query.entity || req.body?.entity || '').trim();
const tableFor = (entity) => TBL[entity] || null;

/* One client-facing shape for the catalog. sp_cf_defs returns the table's own
   column names; sp_cf_save_def has to return f_key/f_label/f_type because a
   plpgsql OUT param named "Label" would shadow the column in its ON CONFLICT
   target list. Normalising here keeps that detail out of the API. */
const shapeDef = (r) => ({
  field_key: r.Field_Key ?? r.f_key,
  label: r.Label ?? r.f_label,
  data_type: r.Data_Type ?? r.f_type,
  options: r.Options ?? null,
  required: !!r.Required,
  ordinal: r.Ordinal ?? 100,
});

/* A scalar-returning sp_* yields a one-column row named after the function, so
   read it positionally rather than by a column name that changes with every
   rename of the function. */
const scalar = (row) => (row ? Object.values(row)[0] : undefined);

/* The sp_cf_* functions raise 22023 for anything the caller got wrong (bad
   value for a declared type, malformed key, unknown table). Translate that
   into a 400 instead of letting it surface as a 500 - a client sending a bad
   payload is not a server fault and should not trip error alerting. */
const BAD_REQUEST = new Set(['22023', '23514', '22P02', 'P0001']);

const asHttpError = (err, res, next) => {
  if (BAD_REQUEST.has(err?.code)) return res.status(400).json({ error: err.message });
  return next(err);
};

/* sp_cf_ensure is idempotent, so calling it on every touch is cheap and means a
   newly supported entity needs no migration - the column appears on first use. */
async function ready(req, res, entity) {
  const table = tableFor(entity);
  if (!table) {
    res.status(400).json({ error: `Unknown entity: ${entity || '(missing)'}` });
    return null;
  }
  await execFn(getPool(), 'sp_cf_ensure', [table]);
  return table;
}

/* ---------- catalog ---------- */

customFieldRouter.get('/defs', async (req, res, next) => {
  try {
    const entity = entityOf(req);
    if (!tableFor(entity)) return res.status(400).json({ error: `Unknown entity: ${entity || '(missing)'}` });
    const rows = await execFn(getPool(), 'sp_cf_defs', [entity]);
    return res.json({ status: 'Success', entity, defs: rows.map(shapeDef) });
  } catch (e) { return asHttpError(e, res, next); }
});

customFieldRouter.post('/defs', async (req, res, next) => {
  try {
    const b = req.body || {};
    const entity = String(b.entity || '').trim();
    const table = await ready(req, res, entity);
    if (!table) return undefined;

    const key = String(b.field_key || b.fieldKey || '').trim();
    const label = String(b.label || '').trim();
    const type = String(b.data_type || b.dataType || 'text').trim();

    if (!KEY_RE.test(key)) {
      return res.status(400).json({ error: 'field_key must look like entity.field_name, lower snake case' });
    }
    if (key.split('.')[0] !== entity) {
      return res.status(400).json({ error: `field_key must start with the entity name "${entity}"` });
    }
    if (!label) return res.status(400).json({ error: 'A label is required' });
    if (!TYPES.includes(type)) return res.status(400).json({ error: `data_type must be one of ${TYPES.join(', ')}` });

    const ordinal = Number.isFinite(Number(b.ordinal)) ? Number(b.ordinal) : 100;
    const opts = b.options && typeof b.options === 'object' ? JSON.stringify(b.options) : null;

    const rows = await execFn(getPool(), 'sp_cf_save_def',
      [key, entity, label, type, opts, b.required === true, ordinal]);
    return res.json({ status: 'Success', def: shapeDef(rows[0]) });
  } catch (e) { return asHttpError(e, res, next); }
});

/* Deactivate rather than delete: stored values outlive the definition in other
   installs that share the catalog, and a hard delete would strand them. */
customFieldRouter.delete('/defs/:key', async (req, res, next) => {
  try {
    const key = String(req.params.key || '').trim();
    if (!KEY_RE.test(key)) return res.status(400).json({ error: 'field_key must look like entity.field_name' });
    const { rows } = await getPool().query(
      'UPDATE "tblFieldDef" SET "Active" = false WHERE "Field_Key" = $1 RETURNING "Field_Key"', [key]);
    if (!rows.length) return res.status(404).json({ error: 'No such field' });
    return res.json({ status: 'Success', field_key: key, active: false });
  } catch (e) { return asHttpError(e, res, next); }
});

/* ---------- values ---------- */

/* Read path for a grid page: the grid returns ids, this returns the matching
   values keyed by id, and the client merges them onto the rows it already has.
   Deliberately not folded into the generated Grid2 - that would mean a
   different compiled artifact per company, which is the thing this design
   exists to avoid. */
customFieldRouter.get('/values', async (req, res, next) => {
  try {
    const entity = entityOf(req);
    const table = await ready(req, res, entity);
    if (!table) return undefined;

    const ids = String(req.query.ids || '').split(',').map((s) => s.trim()).filter(Boolean).map(Number)
      .filter((n) => Number.isSafeInteger(n) && n > 0).slice(0, 500);
    if (!ids.length) return res.json({ status: 'Success', entity, values: {} });

    const rows = await execFn(getPool(), 'sp_cf_values', [table, `{${ids.join(',')}}`]);
    return res.json({ status: 'Success', entity, values: scalar(rows[0]) || {} });
  } catch (e) { return asHttpError(e, res, next); }
});

customFieldRouter.put('/values', async (req, res, next) => {
  try {
    const b = req.body || {};
    const entity = String(b.entity || '').trim();
    const table = await ready(req, res, entity);
    if (!table) return undefined;

    const id = Number(b.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'A numeric record id is required' });
    const values = b.values && typeof b.values === 'object' && !Array.isArray(b.values) ? b.values : null;
    if (!values) return res.status(400).json({ error: 'values must be an object of field_key -> value' });

    const rows = await execFn(getPool(), 'sp_cf_save_values', [entity, table, id, JSON.stringify(values)]);
    const r = String(scalar(rows[0]) ?? '');
    if (r.startsWith('no such')) return res.status(404).json({ error: 'No such record' });
    return res.json({ status: 'Success', id, result: r });
  } catch (e) { return asHttpError(e, res, next); }
});


