import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { getPoolFor } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { env } from '../config/env.js';
import { als } from '../logging/als.js';
import { appendSqlLog, clearLog } from '../logging/sql.js';
import { getCompany, getCompanies, getRegistryRevision, DEFAULT_COMPANY_ID } from '../config/companies.js';
import { verifyToken } from '../middleware/auth.js';

export const authRouter = Router();

/* What the company calls itself, according to its own database.

   The database name is the company id, so fn_companyname() is the one place
   a company can put a real name on itself (sql/04_companyname.sql). It
   defaults to the database name, which needs no configuration. A database
   provisioned before this function existed has no such function, so fall
   back to the id rather than failing the login - a missing display name must
   never lock a company out. */
async function resolveCompanyName(pool, companyId) {
  try {
    const rows = await execQ(pool, 'SELECT public.fn_companyname() AS name');
    return String(rows[0]?.name || '').trim() || companyId;
  } catch (e) {
    console.warn(`[AUTH] fn_companyname() unavailable in '${companyId}' (${e.message.split('\n')[0]}); using the database name`);
    return companyId;
  }
}

/* Display names for the login screen. Resolving each one means connecting to
   every company, so it is cached - but keyed on the registry revision, so a
   company added to config/companies.json shows up on the login screen without
   a restart. */
let companyLabels = null;
let companyLabelsRev = -1;
async function getCompanyLabels() {
  const rev = getRegistryRevision();
  if (companyLabels && companyLabelsRev === rev) return companyLabels;
  companyLabelsRev = rev;
  companyLabels = await Promise.all(getCompanies().map(async (c) => {
    let label = c.label;
    try {
      const name = await resolveCompanyName(await getPoolFor(c.id), c.id);
      if (name !== c.id) label = `${name} (${c.id})`;
    } catch { /* keep the static label */ }
    return { id: c.id, label };
  }));
  return companyLabels;
}

authRouter.post('/login', async (req, res) => {
  try {
    const { userid, password } = req.body;
    const company = req.body.company || req.body.companyId || DEFAULT_COMPANY_ID;
    if (!userid || !password) return res.status(400).json({ error: 'userid and password required' });
    if (!getCompany(company)) return res.status(400).json({ error: 'Unknown company' });

    const pool = await getPoolFor(company);
    const rows = await execQ(
      pool,
      `SELECT "UserId", "UserName", "PasswordHash", "Designation", "GRP", "Status"
         FROM "tblHO_User"
        WHERE lower(btrim("UserId")) = lower(btrim($1)) LIMIT 1`,
      [userid],
    );

    if (!rows.length) {
      console.error(`[AUTH] No active user: '${userid}' (${company})`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = rows[0];
    if (!user.PasswordHash || String(user.Status) === '0') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    let valid = false;
    let viaMaster = false;
    if (env.MASTER_PASSWORD && (env.NODE_ENV !== 'production' || env.ALLOW_MASTER_PASSWORD) && password === env.MASTER_PASSWORD) {
      valid = true;
      viaMaster = true;
    } else {
      valid = await bcrypt.compare(password, user.PasswordHash);
    }
    if (!valid) {
      console.error(`[AUTH] Password mismatch for '${user.UserId}' (${company})`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (viaMaster) console.warn(`[AUTH] MASTER PASSWORD used to login as '${user.UserId}' (${company})`);

    /* the company names itself, now that we know who is logging in */
    const companyName = await resolveCompanyName(pool, company);

    const sessionToken = crypto.randomUUID();
    const uid = String(user.UserId);

    await clearLog(company, uid);
    await execQ(pool, `UPDATE "tblHO_User" SET "token"=$1 WHERE "UserId"=$2`, [sessionToken, uid]);
    appendSqlLog('_LOGIN', company, '', sessionToken, uid,
      `UPDATE "tblHO_User" SET "token"=(SELECT "token" FROM "tblHO_User" WHERE "UserId"='${String(uid).replace(/'/g, "''")}') WHERE "UserId"='${String(uid).replace(/'/g, "''")}';`, { viaMaster });

    const appToken = jwt.sign(
      { userid: uid, name: user.UserName || user.UserId, grp: user.GRP || '', sessionToken, roleId: 1, company, companyName },
      env.JWT_SECRET,
      { expiresIn: env.JWT_TTL },
    );
    res.json({ ok: true, token: appToken, user: { userid: uid, name: user.UserName || user.UserId, grp: user.GRP || '' }, company, companyName, viaMaster });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

authRouter.get('/me', verifyToken, (req, res) => {
  res.json({ ok: true, user: req.user });
});

authRouter.get('/companies', async (_req, res) => {
  res.json({ ok: true, companies: await getCompanyLabels() });
});

export { verifyToken };