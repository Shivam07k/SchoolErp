import { getPoolFor } from '../src/db/pool.js';
const pool = getPoolFor('school_erp');
const q = async (sql, params = []) => (await pool.query(sql, params)).rows;
async function dump(label, sql, params = []) {
  console.log(`\n=== ${label} ===`);
  try { console.table(await q(sql, params)); } catch (e) { console.log('ERR', e.message); }
}
await dump('module records by module', `SELECT module_key, sub_key, count(*)::int AS n FROM school_module_records WHERE app_id='school_erp' GROUP BY module_key, sub_key ORDER BY module_key, sub_key`);
await dump('module records sample', `SELECT id,module_key,sub_key,title,status,ref_no,amount,record_date FROM school_module_records WHERE app_id='school_erp' ORDER BY id LIMIT 25`);
await dump('staff columns', `SELECT column_name,data_type FROM information_schema.columns WHERE table_name='school_staff' ORDER BY ordinal_position`);
await dump('staff rows', `SELECT * FROM school_staff WHERE app_id='school_erp' ORDER BY id`);
await dump('user roles', `SELECT ur.id,ur.app_id,ur.user_id,ur.role_id,ur.campus_id,r.code,r.name FROM school_user_roles ur LEFT JOIN school_roles r ON r.id=ur.role_id ORDER BY ur.app_id,ur.user_id`);
await dump('student guardians', `SELECT * FROM school_student_guardians`);
await dump('guardians', `SELECT * FROM school_guardians`);
await dump('families', `SELECT * FROM school_families`);
await dump('integrations cols', `SELECT column_name,data_type FROM information_schema.columns WHERE table_name='school_integrations' ORDER BY ordinal_position`);
await dump('integrations rows', `SELECT * FROM school_integrations ORDER BY id`);
await dump('approval flows cols', `SELECT column_name,data_type FROM information_schema.columns WHERE table_name='school_approval_flows' ORDER BY ordinal_position`);
await dump('approval flows rows', `SELECT * FROM school_approval_flows ORDER BY id`);
await dump('sections teacher refs', `SELECT id,app_id,class_id,name,class_teacher_id FROM school_sections WHERE class_teacher_id IS NOT NULL ORDER BY id`);
await dump('classes all cols sample', `SELECT * FROM school_classes WHERE app_id='school_erp' ORDER BY id LIMIT 3`);
await dump('audit log apps', `SELECT app_id,action,entity,count(*)::int n FROM school_audit_log GROUP BY app_id,action,entity ORDER BY n DESC`);
await dump('tblHO users school links', `SELECT * FROM school_users WHERE app_id='school_erp' ORDER BY id`);
await dump('school_users cols', `SELECT column_name,data_type FROM information_schema.columns WHERE table_name='school_users' ORDER BY ordinal_position`);
await dump('permissions sample', `SELECT * FROM school_permissions ORDER BY module,key LIMIT 10`);
await dump('role_permissions counts', `SELECT role_id,count(*)::int n FROM school_role_permissions GROUP BY role_id ORDER BY role_id`);
await dump('doc templates', `SELECT * FROM school_document_template WHERE app_id='school_erp'`);
await dump('leave types', `SELECT * FROM school_leave_type WHERE app_id='school_erp'`);
await dump('salary components', `SELECT id,app_id,code,name FROM school_salary_component WHERE app_id='school_erp' ORDER BY id`);
await dump('attendance policy', `SELECT * FROM school_attendance_policy WHERE app_id='school_erp' ORDER BY id LIMIT 20`);
await dump('fee invoices', `SELECT id,app_id,invoice_no,student_id,title,amount,status,due_date FROM school_fee_invoices WHERE app_id='school_erp' ORDER BY id`);
await dump('receipts', `SELECT * FROM school_receipt WHERE app_id='school_erp'`);
await dump('fee payments', `SELECT * FROM school_fee_payments WHERE app_id='school_erp'`);
await dump('payroll runs', `SELECT * FROM school_payroll_run WHERE app_id='school_erp'`);
await dump('exam schedules', `SELECT * FROM school_exam_schedules WHERE app_id='school_erp'`);
await dump('timetables', `SELECT * FROM school_timetables WHERE app_id='school_erp' ORDER BY id LIMIT 10`);
await dump('exports/import jobs', `SELECT id,app_id,status FROM school_import_job ORDER BY id`);
await pool.end();
