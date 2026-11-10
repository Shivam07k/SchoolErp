/* Reset school_erp operational data while preserving configuration + access.
   Run: node scripts/_reset_school_erp.mjs          (dry run)
        node scripts/_reset_school_erp.mjs --apply  (execute in one transaction)

   Scope: students, guardians, staff/teachers, and all transactional rows for
   tenant school_erp. Base HO/master tables (tblHO_User etc.) are never touched.
*/
import { getPoolFor } from '../src/db/pool.js';

const APPLY = process.argv.includes('--apply');
const APP = 'school_erp';
const pool = getPoolFor(APP);
const q = async (sql, p = []) => (await pool.query(sql, p)).rows;

const PRESERVE = new Set([
  'school_settings', 'school_campuses', 'school_academic_years', 'school_classes', 'school_sections',
  'school_subjects', 'school_rooms', 'school_periods', 'school_fee_head', 'school_fee_heads',
  'school_attendance_policy', 'school_attendance_settings', 'school_statutory_rule', 'school_statutory_rule_slab',
  'school_leave_policy', 'school_leave_type', 'school_salary_component', 'school_document_types',
  'school_approval_flows', 'school_integrations', 'school_groups', 'school_roles', 'school_permissions',
  'school_role_permissions', 'school_group_permissions', 'school_subscription', 'school_financial_year',
  'school_hostel_setting', 'school_hr_setting', 'school_library_setting', 'school_lms_setting',
  'school_frontoffice_setting', 'school_alumni_setting', 'school_analytics_template', 'school_analytics_schedule',
  'school_users', 'school_user_roles', 'school_audit_log', 'school_automation_rules', 'school_document_template',
  'school_hostel_mess_plan', 'school_calendar_event',
]);

const tables = (await q(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`)).map(r => r.tablename);
const appTables = new Set((await q(`SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='app_id'`)).map(r => r.table_name));

const inScope = new Map(); // table -> count
for (const t of tables) {
  if (!t.startsWith('school_') || PRESERVE.has(t) || !appTables.has(t)) continue;
  const r = await q(`SELECT count(*)::int c FROM "${t}" WHERE app_id=$1`, [APP]);
  if (r[0].c > 0) inScope.set(t, r[0].c);
}
// Tables without app_id that belong to this tenant's operational data.
for (const t of ['school_student_guardians']) {
  if (!tables.includes(t)) continue;
  const r = await q(`SELECT count(*)::int c FROM "${t}"`);
  if (r[0].c > 0) inScope.set(t, r[0].c);
}
// Add any no-app school_* child that references an in-scope parent and has rows.
const fks = await q(`
  SELECT tc.table_name AS child, kcu.column_name AS child_col, ccu.table_name AS parent
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name AND ccu.table_schema=tc.table_schema
  WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'`);
let grew = true;
while (grew) {
  grew = false;
  for (const f of fks) {
    if (inScope.has(f.child) || PRESERVE.has(f.child) || appTables.has(f.child)) continue;
    if (!inScope.has(f.parent)) continue;
    const r = await q(`SELECT count(*)::int c FROM "${f.child}"`);
    if (r[0].c > 0) { inScope.set(f.child, r[0].c); grew = true; }
  }
}

// FK from preserved table into in-scope table -> null it before delete.
const nullTargets = [];
for (const f of fks) {
  if (!inScope.has(f.parent)) continue;
  if (!PRESERVE.has(f.child) || !appTables.has(f.child)) continue;
  const r = await q(`SELECT count(*)::int c FROM "${f.child}" WHERE "${f.child_col}" IS NOT NULL`);
  if (r[0].c > 0) nullTargets.push({ ...f, rows: r[0].c });
}

console.log(`MODE: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
console.log(`\n=== IN-SCOPE TABLES (${inScope.size}) ===`);
for (const [t, c] of [...inScope.entries()].sort()) console.log(`${String(c).padStart(5)}  ${t}`);

console.log('\n=== PRESERVED FK COLUMNS TO NULL ===');
if (!nullTargets.length) console.log('(none)');
for (const n of nullTargets) console.log(`${n.rows}  ${n.child}.${n.child_col} -> ${n.parent}.${n.parent_col}`);

if (!APPLY) { await pool.end(); process.exit(0); }

const client = await pool.connect();
const deleted = new Map();
try {
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout = '15s'");
  await client.query("SET LOCAL statement_timeout = '10min'");

  for (const n of nullTargets) {
    await client.query(`UPDATE "${n.child}" SET "${n.child_col}"=NULL WHERE "${n.child_col}" IS NOT NULL`);
  }

  // Delete in retry passes so children are cleared before parents.
  let remaining = new Map(inScope);
  let passes = 0;
  while (remaining.size && passes < 10) {
    passes++;
    const next = new Map();
    let progress = 0;
    for (const [t] of remaining) {
      const where = appTables.has(t) ? `WHERE app_id=$1` : '';
      try {
        await client.query('SAVEPOINT del');
        const r = await client.query(`DELETE FROM "${t}" ${where}`, appTables.has(t) ? [APP] : []);
        await client.query('RELEASE SAVEPOINT del');
        deleted.set(t, (deleted.get(t) || 0) + r.rowCount);
        progress++;
      } catch (e) {
        await client.query('ROLLBACK TO SAVEPOINT del');
        await client.query('RELEASE SAVEPOINT del');
        next.set(t, (next.get(t) || 0) + 1);
      }
    }
    if (!progress) break;
    remaining = next;
  }
  if (remaining.size) {
    throw new Error('Could not delete (FK cycle): ' + [...remaining.keys()].join(', '));
  }

  // ---- targeted cleanup of test artifacts in preserved config ----
  const cleanup = [
    ['stale QA/smoke academic years', `DELETE FROM school_academic_years WHERE app_id=$1 AND (name LIKE 'QA\\_%' OR name ILIKE 'ZZ%')`],
    ['smoke classes + cascaded sections', `DELETE FROM school_classes WHERE app_id=$1 AND name ILIKE 'ZZ%'`],
    ['test groups', `DELETE FROM school_groups WHERE app_id=$1 AND (code ILIKE '%test%' OR name ILIKE '%test%')`],
    ['test salary components', `DELETE FROM school_salary_component WHERE app_id=$1 AND (code IN ('TEST','SMOKE_ALLOW') OR name ILIKE '%test%' OR name ILIKE '%smoke%')`],
    ['test leave types', `DELETE FROM school_leave_type WHERE app_id=$1 AND (code='TL2' OR name ILIKE '%test%')`],
    ['soft-deleted document templates', `DELETE FROM school_document_template WHERE app_id=$1 AND deleted_at IS NOT NULL`],
    ['smoke hostel mess plan', `DELETE FROM school_hostel_mess_plan WHERE app_id=$1 AND name ILIKE '%smoke%'`],
    ['test subjects', `DELETE FROM school_subjects WHERE app_id=$1 AND (code ILIKE 'TTSUB%' OR code ILIKE 'ZZ%' OR name ILIKE '%smoke%' OR name ILIKE '%test%')`],
    ['test rooms', `DELETE FROM school_rooms WHERE app_id=$1 AND (code ILIKE 'TT%' OR code ILIKE 'ZZ%' OR name ILIKE '%smoke%' OR name ILIKE '%test%')`],
    ['student login roles', `DELETE FROM school_user_roles WHERE app_id=$1 AND user_id IN (SELECT id::text FROM school_users WHERE app_id=$1 AND user_id LIKE 'student\\_%')`],
    ['student login accounts', `DELETE FROM school_users WHERE app_id=$1 AND user_id LIKE 'student\\_%'`],
    ['school_erp audit log', `DELETE FROM school_audit_log WHERE app_id=$1`],
  ];
  for (const [label, sql] of cleanup) {
    const r = await client.query(sql, [APP]);
    deleted.set(label, r.rowCount);
  }

  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  console.error('\nRESET FAILED — rolled back:', e.message);
  client.release();
  await pool.end();
  process.exit(1);
}
client.release();

console.log('\n=== DELETED ===');
for (const [t, c] of [...deleted.entries()].sort()) if (c) console.log(`${String(c).padStart(5)}  ${t}`);

// ---- verification ----
console.log('\n=== VERIFY REMAINING SCHOOL_ERP OPERATIONAL ROWS ===');
let bad = 0;
for (const t of inScope.keys()) {
  const hasApp = appTables.has(t);
  const r = await q(`SELECT count(*)::int c FROM "${t}" ${hasApp ? 'WHERE app_id=$1' : ''}`, hasApp ? [APP] : []);
  if (r[0].c > 0) { bad++; console.log(`${r[0].c}  ${t}`); }
}
if (!bad) console.log('OK: no operational rows remain.');

console.log('\n=== PRESERVED SNAPSHOT ===');
for (const t of ['school_academic_years','school_classes','school_sections','school_subjects','school_rooms','school_periods','school_fee_heads','school_fee_head','school_attendance_policy','school_campuses','school_roles','school_permissions','school_role_permissions','school_groups','school_users','school_user_roles','school_hr_employees','school_staff','school_students','school_leave_type','school_salary_component']) {
  const hasApp = appTables.has(t);
  const r = await q(`SELECT count(*)::int c FROM "${t}" ${hasApp ? 'WHERE app_id=$1' : ''}`, hasApp ? [APP] : []);
  console.log(`${String(r[0].c).padStart(5)}  ${t}`);
}
console.log('\nADMIN login rows:');
console.table(await q(`SELECT "UserId","UserName","GRP","Status" FROM "tblHO_User" ORDER BY "UserId"`));

await pool.end();
