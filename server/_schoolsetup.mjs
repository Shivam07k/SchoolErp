/* School ERP schema/migration runner.

   Usage:
     node _schoolsetup.mjs                apply school migrations to the default company
     node _schoolsetup.mjs school_erp     apply to one configured company
     node _schoolsetup.mjs --all          apply to every configured company

   Only the idempotent school migrations (19-28) are applied. Base ERP tables
   and user seeds are left to setup.mjs, and no passwords or demo data are
   touched, so this is safe to run against an existing tenant.
*/
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { getCompanies, getCompanyDb, DEFAULT_COMPANY_ID } from './src/config/companies.js';
import { ensureFoundation } from './src/school/foundation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQL_DIR = path.join(__dirname, '../sql');

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let i = 0;
  const n = sql.length;

  while (i < n) {
    const ch = sql[i];
    const next = sql[i + 1] || '';

    // Single-line comment
    if (ch === '-' && next === '-') {
      while (i < n && sql[i] !== '\n') i += 1;
      continue;
    }

    // Block comment
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < n && !(sql[i] === '*' && sql[i + 1] === '/')) i += 1;
      i += 2;
      current += ' ';
      continue;
    }

    // Single-quoted string ('' escapes a quote)
    if (ch === "'") {
      current += ch;
      i += 1;
      while (i < n) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          current += "''";
          i += 2;
          continue;
        }
        current += sql[i];
        if (sql[i] === "'") {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }

    // Double-quoted identifier ("" escapes a quote)
    if (ch === '"') {
      current += ch;
      i += 1;
      while (i < n) {
        if (sql[i] === '"' && sql[i + 1] === '"') {
          current += '""';
          i += 2;
          continue;
        }
        current += sql[i];
        if (sql[i] === '"') {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }

    // Dollar-quoted string ($$ ... $$ or $tag$ ... $tag$)
    if (ch === '$') {
      const match = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) {
        const tag = match[0];
        const end = sql.indexOf(tag, i + tag.length);
        if (end === -1) {
          current += sql.slice(i);
          i = n;
          continue;
        }
        current += sql.slice(i, end + tag.length);
        i = end + tag.length;
        continue;
      }
    }

    // Statement terminator
    if (ch === ';') {
      if (current.trim()) statements.push(current.trim());
      current = '';
      i += 1;
      continue;
    }

    current += ch;
    i += 1;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

const files = [
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

const args = process.argv.slice(2);
const all = args.includes('--all');
const requested = args.find((a) => !a.startsWith('--'));

const companyIds = all
  ? getCompanies().map((c) => c.id)
  : [requested || DEFAULT_COMPANY_ID];

if (!companyIds.length) {
  console.error('No companies are configured in server/config/companies.json.');
  process.exit(1);
}

async function applyCompany(companyId) {
  const db = getCompanyDb(companyId);
  if (!db) throw new Error(`Unknown company '${companyId}'. Check server/config/companies.json.`);

  const client = new pg.Client({
    host: db.host,
    port: db.port,
    user: db.user,
    password: db.password,
    database: db.database,
    ssl: db.ssl,
  });
  await client.connect();
  console.log(`\n[${companyId}] ${db.database}@${db.host}:${db.port}`);
  try {
    for (const file of files) {
      const sql = readFileSync(path.join(SQL_DIR, file), 'utf-8').replace(/^\uFEFF/, '');
      process.stdout.write(`  ${file} ... `);
      // Parse SQL statements properly, handling dollar quotes, strings, comments
      const statements = splitSqlStatements(sql);
      try {
        for (let idx = 0; idx < statements.length; idx += 1) {
          const stmt = statements[idx];
          if (!stmt.trim()) continue;
          try {
            await client.query(stmt);
          } catch (error) {
            error.message = `${error.message} [${file} statement ${idx + 1}: ${stmt.slice(0, 160)}]`;
            throw error;
          }
        }
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      }
      console.log('ok');
    }

    // Seed the app-specific foundation (roles, permission grants, campuses)
    // when the base ERP user table is present. This is idempotent and makes a
    // clean database usable immediately after setup.
    const { rows: [{ exists }] } = await client.query(
      `SELECT to_regclass('public."tblHO_User"') IS NOT NULL AS exists`,
    );
    if (exists) {
      process.stdout.write('  foundation roles/permissions ... ');
      await ensureFoundation(client, companyId);
      console.log('ok');
    } else {
      console.log('  foundation roles/permissions ... skipped (run setup.mjs first)');
    }
  } finally {
    await client.end();
  }
}

let failed = 0;
for (const companyId of companyIds) {
  try {
    await applyCompany(companyId);
  } catch (error) {
    failed += 1;
    console.error(`  FAILED (${companyId}): ${error.message}`);
  }
}

if (failed) {
  console.error(`\nSchool setup failed for ${failed} of ${companyIds.length} company database(s).`);
  process.exit(1);
}

console.log('\nSchool setup complete.');
