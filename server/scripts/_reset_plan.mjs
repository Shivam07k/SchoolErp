import { getPoolFor } from '../src/db/pool.js';

const pool = getPoolFor('school_erp');
const q = async (sql, p = []) => (await pool.query(sql, p)).rows;

const tables = await q(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
const all = tables.map(t => t.tablename);

const appCols = await q(`SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='app_id'`);
const hasApp = new Set(appCols.map(r => r.table_name));

const fks = await q(`
  SELECT tc.table_name AS child, kcu.column_name AS child_col,
         ccu.table_name AS parent, ccu.column_name AS parent_col,
         tc.constraint_name AS name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'
  ORDER BY tc.table_name, tc.constraint_name
`);

const PRESERVE = new Set([
  'school_settings','school_campuses','school_academic_years','school_classes','school_sections',
  'school_subjects','school_rooms','school_periods','school_fee_head','school_fee_heads',
  'school_attendance_policy','school_attendance_settings','school_statutory_rule','school_statutory_rule_slab',
  'school_leave_policy','school_leave_type','school_salary_component','school_document_types',
  'school_approval_flows','school_integrations','school_groups','school_roles','school_permissions',
  'school_role_permissions','school_group_permissions','school_subscription','school_financial_year',
  'school_hostel_setting','school_hr_setting','school_library_setting','school_lms_setting',
  'school_frontoffice_setting','school_alumni_setting','school_analytics_template','school_analytics_schedule',
  'school_users','school_user_roles','school_audit_log','school_automation_rules','school_document_template',
  'school_hostel_mess_plan','school_calendar_event'
]);

const nonZero = [];
for (const t of all) {
  try {
    const c = (await q(`SELECT count(*)::int c FROM "${t}"`))[0].c;
    if (!c) continue;
    const apps = hasApp.has(t) ? await q(`SELECT app_id,count(*)::int c FROM "${t}" GROUP BY app_id`) : [];
    const se = apps.find(a => a.app_id === 'school_erp')?.c || 0;
    nonZero.push({ t, c, se, noApp: !hasApp.has(t), apps });
  } catch {}
}

console.log('=== SCHOOL_ERP NON-ZERO TABLES ===');
const inScope = [];
for (const r of nonZero) {
  if (r.se > 0 || (r.noApp && r.c > 0)) {
    const tag = PRESERVE.has(r.t) ? 'PRESERVE' : 'DELETE';
    if (tag === 'DELETE' && (r.se > 0 || r.noApp)) inScope.push(r.t);
    console.log(`${tag.padEnd(9)} app=${String(r.se).padStart(4)} total=${String(r.c).padStart(4)} ${r.t}${r.noApp ? ' (no app_id)' : ''}`);
  }
}

/* Tables with no app_id that reference an in-scope table must also be cleared. */
const inScopeSet = new Set(inScope);
let changed = true;
const extra = [];
while (changed) {
  changed = false;
  for (const f of fks) {
    if (inScopeSet.has(f.child)) continue;
    if (inScopeSet.has(f.parent) && !hasApp.has(f.child)) {
      const c = (await q(`SELECT count(*)::int c FROM "${f.child}"`))[0].c;
      if (c > 0 && !PRESERVE.has(f.child)) {
        inScopeSet.add(f.child); extra.push(f.child); changed = true;
      } else if (c > 0 && PRESERVE.has(f.child)) {
        console.log(`!! PRESERVED CHILD references in-scope parent: ${f.child}.${f.child_col} -> ${f.parent}`);
      }
    }
  }
}
if (extra.length) console.log('\n=== IMPLIED CHILD TABLES (no app_id) ===\n' + extra.join('\n'));

/* Topological order: children before parents. */
const parentsOf = new Map();
for (const f of fks) {
  if (!inScopeSet.has(f.child) || !inScopeSet.has(f.parent)) continue;
  if (!parentsOf.has(f.child)) parentsOf.set(f.child, new Set());
  parentsOf.get(f.child).add(f.parent);
}
const order = [];
const temp = new Set(), done = new Set();
function visit(t, stack) {
  if (done.has(t)) return;
  if (temp.has(t)) { return; } // cycle: handled by repeated passes at runtime
  temp.add(t);
  for (const p of parentsOf.get(t) || []) if (p !== t) visit(p, stack.concat(t));
  temp.delete(t);
  done.add(t);
  order.push(t);
}
for (const t of inScopeSet) visit(t, []);

/* Reverse so children come first. */
order.reverse();

console.log('\n=== DELETE ORDER (children first) ===');
order.forEach((t, i) => console.log(`${String(i + 1).padStart(3)}. ${t}`));

/* Show preserved tables that point at in-scope tables and need nulling. */
console.log('\n=== FK FROM PRESERVED TABLE -> IN-SCOPE TABLE (null these first) ===');
for (const f of fks) {
  if (!inScopeSet.has(f.parent)) continue;
  if (!PRESERVE.has(f.child)) continue;
  const c = (await q(`SELECT count(*)::int c FROM "${f.child}" WHERE "${f.child_col}" IS NOT NULL`))[0].c;
  console.log(`${f.child}.${f.child_col} -> ${f.parent}.${f.parent_col}  (non-null rows: ${c})`);
}

/* Sanity: config rows in preserved tables worth cleaning. */
console.log('\n=== TEST ARTIFACTS IN PRESERVED TABLES ===');
const artifacts = [
  ['school_academic_years', `SELECT id,name,is_active FROM school_academic_years WHERE app_id='school_erp' AND (name LIKE 'QA\\_%' OR name ILIKE 'ZZ%')`],
  ['school_classes', `SELECT id,name FROM school_classes WHERE app_id='school_erp' AND name ILIKE 'ZZ%'`],
  ['school_sections', `SELECT s.id,s.name,c.name class FROM school_sections s JOIN school_classes c ON c.id=s.class_id WHERE s.app_id='school_erp' AND c.name ILIKE 'ZZ%'`],
  ['school_groups', `SELECT id,code,name FROM school_groups WHERE app_id='school_erp' AND (code ILIKE '%test%' OR name ILIKE '%test%')`],
  ['school_salary_component', `SELECT id,code,name FROM school_salary_component WHERE app_id='school_erp' AND (code ILIKE '%TEST%' OR code ILIKE '%SMOKE%')`],
  ['school_leave_type', `SELECT id,code,name FROM school_leave_type WHERE app_id='school_erp' AND (name ILIKE '%test%' OR code ILIKE '%TEST%')`],
  ['school_document_template', `SELECT id,name,type,deleted_at FROM school_document_template WHERE app_id='school_erp'`],
];
for (const [t, sql] of artifacts) {
  try { console.log(`\n-- ${t}`); console.table(await q(sql)); } catch (e) { console.log('ERR', e.message); }
}

/* Inspect ambiguous tables */
for (const t of ['school_automation_rules','school_hostel_mess_plan','school_calendar_event','school_financial_year','school_fee_head','school_fee_heads','school_salary_structure','school_leave_policy','school_document_types','school_approval_flows']) {
  if (!all.includes(t)) continue;
  console.log(`\n=== ${t} ===`);
  try { console.table(await q(`SELECT * FROM "${t}" LIMIT 15`)); } catch (e) { console.log('ERR', e.message); }
}

await pool.end();
