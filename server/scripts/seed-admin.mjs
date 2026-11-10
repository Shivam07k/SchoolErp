/* Create or reset the bootstrap administrator account.

   Usage:
     ADMIN_PASSWORD="choose-a-strong-password" npm --prefix server run db:seed-admin

   The password is read from the environment so it never lands in shell
   history or git. The user is inserted into tblHO_User and the school
   SUPER_ADMIN role is granted by ensureFoundation.
   ============================================================ */
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { getCompanyDb, DEFAULT_COMPANY_ID } from '../src/config/companies.js';
import { ensureFoundation } from '../src/school/foundation.js';

function connectionConfig() {
  const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (url) return { connectionString: url, ssl: { rejectUnauthorized: false }, application_name: 'school-erp-admin' };
  const db = getCompanyDb(DEFAULT_COMPANY_ID);
  if (!db) throw new Error(`No database configured for company '${DEFAULT_COMPANY_ID}'.`);
  return {
    host: db.host,
    port: db.port,
    user: db.user,
    password: db.password,
    database: db.database,
    ssl: db.ssl,
    application_name: 'school-erp-admin',
  };
}

async function main() {
  const userid = process.env.ADMIN_USERID || 'ADMIN';
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error('Set ADMIN_PASSWORD before running this script.');
  }
  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters.');
  }

  const client = new pg.Client(connectionConfig());
  await client.connect();

  const hash = await bcrypt.hash(password, 10);
  await client.query(
    `INSERT INTO "tblHO_User" ("UserId", "UserName", "PasswordHash", "Designation", "GRP", "Status")
     VALUES ($1, 'Administrator', $2, 'System Admin', 'ADMIN', '1')
     ON CONFLICT ("UserId") DO UPDATE
       SET "PasswordHash" = EXCLUDED."PasswordHash",
           "UserName" = EXCLUDED."UserName",
           "Designation" = EXCLUDED."Designation",
           "GRP" = EXCLUDED."GRP",
           "Status" = '1',
           "token" = NULL`,
    [userid, hash],
  );

  await ensureFoundation(client, DEFAULT_COMPANY_ID);

  /* School users are a separate catalogue used by the Users & Access screen.
     Make sure the admin exists there too, without overwriting an existing row. */
  const { rows: [{ exists }] } = await client.query(`SELECT to_regclass('public.school_users') IS NOT NULL AS exists`);
  if (exists) {
    await client.query(
      `INSERT INTO school_users (app_id, user_id, name, email, password_hash, status)
       SELECT $1, $2, 'Administrator', '', $3, 'active'
        WHERE NOT EXISTS (SELECT 1 FROM school_users WHERE app_id=$1 AND user_id=$2)`,
      [DEFAULT_COMPANY_ID, userid, hash],
    ).catch((error) => {
      /* Older schemas may not have every column; the tblHO_User login is the
         important part, so report and continue. */
      console.warn(`[seed-admin] school_users insert skipped: ${error.message}`);
    });
  }

  await client.end();
  console.log(`Admin '${userid}' is ready. Sign in with the password you supplied.`);
}

main().catch((error) => {
  console.error('SEED FAILED:', error.message);
  process.exit(1);
});
