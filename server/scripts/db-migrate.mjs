/* ============================================================
   Apply the School ERP schema to a fresh PostgreSQL database.

   Designed for Supabase (or any managed PostgreSQL) but works against a
   local database too. It records every applied file in schema_migrations,
   so re-running is safe and only new migrations are applied.

   Usage:
     # uses PG_* from .env / the environment
     npm --prefix server run db:migrate

     # or override the whole connection
     SUPABASE_DB_URL="postgresql://..." npm --prefix server run db:migrate

   The first run also seeds the permission/role catalogue and gives the
   database a display name. It does NOT set the admin password - run
   seed-admin.mjs afterwards.
   ============================================================ */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { env } from '../src/config/env.js';
import { getCompanyDb, DEFAULT_COMPANY_ID } from '../src/config/companies.js';
import { ensureFoundation } from '../src/school/foundation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQL_DIR = path.join(__dirname, '../../sql');

/* Base platform files first, then the school files in the same order used by
   _schoolsetup.mjs. Legacy sales-ERP form SQL (03_frm*, 06_frm*, 07_frm*,
   10_forms_all) is deliberately excluded. */
const files = [
  // Base platform: users, security, custom fields, dashboard builder.
  '01_schema.sql',
  '02_functions.sql',
  '03_seed.sql',
  '04_companyname.sql',
  '11_security.sql',
  '12_customfields.sql',
  '13_dashbuilder_tables.sql',
  '14_dashbuilder_fn.sql',
  '16_dashboards.sql',

  // School ERP.
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
  '29_timetable_periods_versions.sql',
  '30_attendance_core.sql',
  '31_attendance_source.sql',
  '32_attendance_completion.sql',
  '40_exam_setup.sql',
  '41_exam_schedule.sql',
  '42_grade_setup.sql',
  '43_marks_entry.sql',
  '44_results.sql',
  '45_report_cards.sql',
  '55_accounts_core.sql',
  '50_fee_setup.sql',
  '51_invoices_collection.sql',
  '56_online_payments.sql',
  '52_dues_followup.sql',
  '53_refunds.sql',
  '54_reconciliation.sql',
  '57_reports_hardening.sql',
  '60_hr_staff.sql',
  '61_hr_leave.sql',
  '62_hr_payroll.sql',
  '63_hr_advances.sql',
  '64_hr_audit.sql',
  '65_staff_teacher_bridge.sql',
  '70_inventory_core.sql',
  '71_inventory_ops.sql',
  '72_transport_core.sql',
  '80_hostel_core.sql',
  '81_hostel_ops.sql',
  '80_library_core.sql',
  '81_library_ops.sql',
  '80_canteen_core.sql',
  '81_canteen_ops.sql',
  '80_frontoffice_core.sql',
  '81_frontoffice_ops.sql',
  '80_communication_core.sql',
  '81_communication_ops.sql',
  '80_lms_core.sql',
  '81_lms_ops.sql',
  '80_events_core.sql',
  '81_events_ops.sql',
  '80_certificates_core.sql',
  '81_certificates_ops.sql',
  '80_alumni_core.sql',
  '81_alumni_ops.sql',
  '80_reports_core.sql',
  '80_automation_core.sql',
  '80_import_core.sql',
  '81_settings_ext.sql',
  '82_module_fixes.sql',
  '83_user_sync.sql',
  '84_add_password_hash.sql',
  '85_add_campus_to_users.sql',
  '86_fix_user_roles.sql',
  '87_fix_user_roles_conflict.sql',
  '88_fix_user_roles_conflict_v2.sql',
  '89_fix_triggers.sql',
  '90_fix_sync_functions.sql',
  '91_debug_sync.sql',
  '92_debug_sync_staff.sql',
  '93_fix_role_lookup.sql',
  '94_advanced_rbac_groups.sql',
];

function connectionConfig() {
  const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (url) {
    return {
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      application_name: 'school-erp-migrate',
    };
  }

  const db = getCompanyDb(DEFAULT_COMPANY_ID);
  if (!db) {
    throw new Error(`No database configured for company '${DEFAULT_COMPANY_ID}'. Check server/config/companies.json.`);
  }
  return {
    host: db.host,
    port: db.port,
    user: db.user,
    password: db.password,
    database: db.database,
    ssl: db.ssl,
    application_name: 'school-erp-migrate',
  };
}

function quoteLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function main() {
  const config = connectionConfig();
  const client = new pg.Client(config);
  const companyId = DEFAULT_COMPANY_ID;

  await client.connect();
  console.log(`Connected to ${config.database || config.connectionString?.replace(/:[^:@/]+@/, ':***@') || 'database'} as ${config.user || 'connection string user'}`);
  console.log(`Tenant app_id: ${companyId}`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const { rows } = await client.query('SELECT filename FROM schema_migrations');
  const applied = new Set(rows.map((row) => row.filename));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  ${file} ... already applied`);
      continue;
    }

    const sql = readFileSync(path.join(SQL_DIR, file), 'utf8').replace(/^\uFEFF/, '');
    process.stdout.write(`  ${file} ... `);
    try {
      /* Each file runs as a single simple query. Files that manage their own
         BEGIN/COMMIT keep that behaviour; the rest are effectively one DDL
         batch. If a statement fails, roll back any open transaction. */
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
      console.log('ok');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('failed');
      throw new Error(`${file}: ${error.message}`);
    }
  }

  console.log('Seeding roles, permissions, campuses and attendance policies ...');
  await ensureFoundation(client, companyId);

  const companyName = process.env.COMPANY_NAME || 'School ERP';
  await client.query(`
    CREATE OR REPLACE FUNCTION public.fn_companyname()
    RETURNS text LANGUAGE sql STABLE
    AS $fn$ SELECT ${quoteLiteral(companyName.replaceAll('$fn$', ''))}::text $fn$
  `);
  console.log(`Company display name set to "${companyName}".`);

  await client.end();
  console.log('\nMigration complete. Next: npm --prefix server run db:seed-admin');
}

main().catch((error) => {
  console.error('\nMIGRATION FAILED:', error.message);
  process.exit(1);
});
