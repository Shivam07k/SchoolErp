/* pg-xerp setup — apply SQL migrations + seed bcrypt hashes + optional demo load
   Usage:  node setup.mjs            (schema + seed)
           node setup.mjs --demo     (also load 100k brands) */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { env } from './src/config/env.js';
import { getCompanyDb, DEFAULT_COMPANY_ID } from './src/config/companies.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQL_DIR = path.join(__dirname, '../sql');

const files = [
  '01_schema.sql',
  '02_functions.sql',
  '03_seed.sql',
  '13_dashbuilder_tables.sql',
  '14_dashbuilder_fn.sql',
  '16_dashboards.sql',
  '19_school_core.sql',
  '20_school_foundation.sql',
  '21_school_modules.sql',
  '22_school_photo_options.sql',
  '23_school_full.sql',
  '24_admission_enquiry.sql',
  '25_school_comprehensive.sql',
  '26_student_modules_complete.sql',
  '27_student_module_phase1_migrations.sql',
  '28_academics_plan.sql',
];
const demo = process.argv.includes('--demo');
/* Optional company id: node setup.mjs school_erp
   With no argument the registry's default company is used. */
const companyId = process.argv.slice(2).find((a) => !a.startsWith('--')) || DEFAULT_COMPANY_ID;
const companyDb = getCompanyDb(companyId);
if (!companyDb) {
  console.error(`Unknown company '${companyId}'. Check server/config/companies.json.`);
  process.exit(1);
}

async function main() {
  const client = new pg.Client({
    host: companyDb.host,
    port: companyDb.port,
    user: companyDb.user,
    password: companyDb.password,
    database: companyDb.database,
    ssl: companyDb.ssl,
  });
  await client.connect();
  console.log(`Connected to ${companyDb.database}@${companyDb.host}:${companyDb.port} as ${companyDb.user} (company ${companyId})`);

  for (const f of files) {
    const sql = readFileSync(path.join(SQL_DIR, f), 'utf-8');
    console.log(`applying ${f} ...`);
    await client.query(sql);
  }

  /* bcrypt hashes — never store plaintext */
  const hashAdmin = await bcrypt.hash('admin123', 10);
  const hashLoad = await bcrypt.hash('test123', 10);
  await client.query(`UPDATE "tblHO_User" SET "PasswordHash"=$1 WHERE "UserId"='ADMIN'`, [hashAdmin]);
  await client.query(`UPDATE "tblHO_User" SET "PasswordHash"=$1 WHERE "UserId"='LOADTEST'`, [hashLoad]);
  console.log('passwords: ADMIN/admin123, LOADTEST/test123');

  if (demo) {
    const demoSql = readFileSync(path.join(SQL_DIR, '10_demo_load.sql'), 'utf-8');
    console.log('applying 10_demo_load.sql (100k brands) ...');
    const t0 = Date.now();
    await client.query(demoSql);
    console.log(`demo load done in ${Date.now() - t0}ms`);
  }

  await client.end();
  console.log('setup complete.');
}

main().catch((e) => {
  console.error('SETUP FAILED:', e.message);
  process.exit(1);
});

