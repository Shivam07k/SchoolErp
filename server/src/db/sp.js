import { getPool, getPoolFor, pg } from './pool.js';

/* ============================================================
   PostgreSQL execution engine — parameterized, never concatenated.

   Business logic lives in PL/pgSQL functions named sp_*.
   A single function call is:   SELECT * FROM sp_name($1,$2,...)
   A batched multi-dataset call runs each function sequentially on
   ONE pooled connection (same transaction scope as xErp's
   multi-recordset `EXEC ... \n EXEC ...` batch) and returns an
   array of row arrays — index-aligned to form.json dataset names.
   ============================================================ */

const FN_NAME_RE = /^sp_[A-Za-z0-9_]+$/;

export function validateFnName(name) {
  if (!name || !FN_NAME_RE.test(name)) throw new Error(`Invalid function name: ${name}`);
  return name;
}

function callText(name, argCount) {
  /* quote the name: xErp proc names are mixed case (sp_frmhsn_SAVE) and an
     unquoted identifier folds to lower case, silently binding to a stale
     same-name overload with a different signature. */
  const n = `"${String(name).replace(/"/g, '""')}"`;
  const ph = argCount > 0 ? Array.from({ length: argCount }, (_, i) => `$${i + 1}`).join(',') : '';
  return ph ? `SELECT * FROM ${n}(${ph})` : `SELECT * FROM ${n}()`;
}

function toArgs(args) {
  return (args || []).map((v) => (v === null || v === undefined ? null : String(v)));
}

/* Run ONE function, returning rows (array). */
export async function execFn(pool, name, args = []) {
  validateFnName(name);
  const text = callText(name, args.length);
  const { rows } = await pool.query({ text, values: toArgs(args) });
  return rows;
}

/* Run ONE function inside a transaction, rolling back if anything goes wrong.

   A function that reports a problem by returning a status row has usually
   already written something before it noticed, so "the answer was no" has to be
   able to undo the attempt. Callers get the rows either way and decide from the
   status, exactly as with execFn, but nothing survives a refusal. */
export async function execFnTx(pool, name, args = []) {
  validateFnName(name);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query({ text: callText(name, args.length), values: toArgs(args) });
    const bad = (rows || [])[0]?.status && rows[0].status !== 'ok';
    if (bad) await client.query('ROLLBACK');
    else await client.query('COMMIT');
    return rows;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/* Run several functions on one connection; returns [rows, rows, ...]
   in the same order as the supplied calls. */
export async function execBatch(pool, calls) {
  const client = await pool.connect();
  const results = [];
  try {
    for (const c of calls) {
      const { name, args = [] } = c;
      validateFnName(name);
      const text = callText(name, args.length);
      const r = await client.query({ text, values: toArgs(args) });
      results.push(r.rows);
    }
    return results;
  } finally {
    client.release();
  }
}

/* Ad-hoc parameterized query (route-level helpers only — business
   reads/writes go through sp_ functions). */
export async function execQ(pool, text, values = []) {
  const { rows } = await pool.query({ text, values });
  return rows;
}

export { getPool, getPoolFor, pg };