import assert from 'assert';
import { getPool } from '../src/db/pool.js';

const pool = getPool();
const appId = 'school_erp';

async function testTables(){
  const r = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'school_%' ORDER BY tablename");
  const tables = r.rows.map(x=>x.tablename);
  const required = ['school_students','school_enquiries','school_applications','school_homework','school_exam_schedules','school_marks','school_visitors','school_leaves','school_promotions','school_transfer_certificates','school_transport_vehicles','school_library_books','school_hostel_blocks','school_hr_employees','school_circulars'];
  for(const t of required){ assert(tables.includes(t), `Missing table ${t}`); }
  console.log('Tables OK:', required.length);
}

async function testBasicData(){
  const s = await pool.query('SELECT COUNT(*) c FROM school_students WHERE app_id=$1',[appId]);
  const c = await pool.query('SELECT COUNT(*) c FROM school_classes WHERE app_id=$1',[appId]);
  console.log('Counts:', {students:s.rows[0].c, classes:c.rows[0].c});
}

await testTables();
await testBasicData();
await pool.end();
console.log('ALL TESTS PASSED');
