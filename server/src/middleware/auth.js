import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { als } from '../logging/als.js';
import { DEFAULT_COMPANY_ID, getCompany } from '../config/companies.js';
import { getPoolFor } from '../db/pool.js';
import { execQ } from '../db/sp.js';

export async function verifyToken(req, res, next) {
  const token = req.headers['authorization']?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'No token provided' });
  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const company = decoded?.company || DEFAULT_COMPANY_ID;
  if (!decoded?.userid || !decoded?.sessionToken || !getCompany(company)) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  try {
    const rows = await execQ(
      getPoolFor(company),
      `SELECT 1
         FROM "tblHO_User"
        WHERE lower(btrim("UserId")) = lower(btrim($1))
          AND "Status" <> '0'
          AND "token" = $2
        LIMIT 1`,
      [decoded.userid, decoded.sessionToken],
    );
    if (!rows.length) return res.status(401).json({ error: 'Session expired' });
    req.user = decoded;
    try {
      const store = als.getStore();
      if (store) {
        store.userId = decoded?.userid || decoded?.id || '';
        store.company = decoded?.company || DEFAULT_COMPANY_ID;
      }
    } catch { /* no store */ }
    next();
  } catch (error) {
    return next(error);
  }
}