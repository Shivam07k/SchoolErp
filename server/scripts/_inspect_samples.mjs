import { getPoolFor } from '../src/db/pool.js';
const pool = getPoolFor('school_erp');
const q = async (sql, params = []) => (await pool.query(sql, params)).rows;

async function dump(label, sql, params = []) {
  console.log(`\n=== ${label} ===`);
  try { console.table(await q(sql, params)); } catch (e) { console.log('ERR', e.message); }
}

await dump('tblHO_User', `SELECT "UserId","UserName","Designation","GRP","Status" FROM "tblHO_User" ORDER BY "UserId"`);
await dump('school_users', `SELECT id,app_id,user_id,name,email,phone,status,campus_id FROM school_users ORDER BY app_id,user_id`);
await dump('roles', `SELECT id,app_id,code,name,is_system FROM school_roles ORDER BY app_id,id`);
await dump('campuses', `SELECT * FROM school_campuses ORDER BY id`);
await dump('academic_years', `SELECT id,app_id,name,start_date,end_date,is_active,is_closed FROM school_academic_years ORDER BY id`);
await dump('classes', `SELECT id,app_id,name,is_active FROM school_classes ORDER BY app_id,id`);
await dump('staff', `SELECT id,app_id,employee_no,first_name,last_name,designation,status,hr_employee_id,campus_id FROM school_staff ORDER BY app_id,id`);
await dump('hr_employees', `SELECT id,app_id,employee_no,first_name,last_name,designation,status,user_id FROM school_hr_employees ORDER BY app_id,id`);
await dump('students', `SELECT id,app_id,admission_no,first_name,last_name,status,class_id,section_id,campus_id,family_id FROM school_students ORDER BY app_id,id`);
await dump('module_records schema', `SELECT column_name,data_type FROM information_schema.columns WHERE table_name='school_module_records' ORDER BY ordinal_position`);
await dump('module_records', `SELECT app_id,module,count(*)::int AS n FROM school_module_records GROUP BY app_id,module ORDER BY app_id,module`);
await dump('module_records sample', `SELECT id,app_id,module,record_key,title FROM school_module_records ORDER BY id LIMIT 30`);
await dump('settings', `SELECT * FROM school_settings`);
await dump('groups', `SELECT id,app_id,code,name,type,is_system FROM school_groups ORDER BY app_id,id`);
await dump('fee heads', `SELECT * FROM school_fee_heads ORDER BY id`);
await dump('subscription', `SELECT * FROM school_subscription`);
await dump('integrations', `SELECT id,app_id,type,name,provider,is_active FROM school_integrations ORDER BY id`);
await dump('approval flows', `SELECT id,app_id,entity_type,name,is_active FROM school_approval_flows ORDER BY id`);

console.log('\n=== NON-ZERO TABLE LIST ===');
const tables = await q(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
for (const { tablename } of tables) {
  try {
    const cols = await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [tablename]);
    const hasApp = cols.some(c => c.column_name === 'app_id');
    const c = (await q(`SELECT count(*)::int c FROM "${tablename}"`))[0].c;
    if (c > 0) {
      const apps = hasApp ? (await q(`SELECT app_id,count(*)::int c FROM "${tablename}" GROUP BY app_id`)) : [];
      console.log(`${c}\t${tablename}\t${hasApp ? apps.map(a => `${a.app_id}=${a.c}`).join(',') : '(no app_id)'}`);
    }
  } catch (e) { console.log(`ERR\t${tablename}\t${e.message}`); }
}
await pool.end();
