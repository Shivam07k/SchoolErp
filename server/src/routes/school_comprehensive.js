import express from 'express';
import { getPool } from '../db/pool.js';
import { schoolRouter } from './school.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { safeErrorMessage } from '../middleware/error.js';

const appIdOf = (req) => req.user?.company || DEFAULT_COMPANY_ID;

const execQ = async (poolOrClient, sql, params=[]) => {
  const res = await poolOrClient.query(sql, params);
  return res.rows;
};

const text = (v) => (v === undefined || v === null || v === '') ? null : String(v);
const num = (v) => (v === undefined || v === null || v === '') ? null : Number(v);
const day = (v) => (v === undefined || v === null || v === '') ? null : (v instanceof Date ? v.toISOString().slice(0,10) : String(v).slice(0,10));

const guard = (req, res, perm) => {
  // Use the resolved school access context (roles + permissions) rather than the
  // login token payload, so super admins and role-granted permissions agree with
  // every other school route group.
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm)) return true;
  res.status(403).json({ error: 'Forbidden', perm });
  return false;
};

const route = (fn) => async (req, res, next) => {
  try { await fn(req, res, next); } catch (e) { console.error(e); res.status(500).json({ error: safeErrorMessage(e, 'School API error') }); }
};

const writeAudit = async (pool, appId, user, meta = {}, reqObj = {}) => {
  const inTransaction = typeof pool?.release === 'function';
  try {
    if (inTransaction) await pool.query('SAVEPOINT school_audit');
    await pool.query(
      `INSERT INTO school_audit_log
         (app_id, user_id, action, entity, entity_id, before_json, after_json, ip, device)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)`,
      [appId,
       String(user?.UserId || user?.userid || user?.id || '') || null,
       meta.action || 'unknown',
       meta.entity || null,
       meta.entityId === null || meta.entityId === undefined ? null : String(meta.entityId),
       meta.before ? JSON.stringify(meta.before) : null,
       meta.after ? JSON.stringify(meta.after) : null,
       reqObj?.ip || null,
       String(reqObj?.headers?.['user-agent'] || '').slice(0, 300) || null],
    );
    if (inTransaction) await pool.query('RELEASE SAVEPOINT school_audit');
  } catch (e) {
    if (inTransaction) {
      await pool.query('ROLLBACK TO SAVEPOINT school_audit').catch(() => {});
      await pool.query('RELEASE SAVEPOINT school_audit').catch(() => {});
    }
    console.error('[school audit]', e.message);
  }
};

export const schoolCompRouter = express.Router();

/* transport */
schoolCompRouter.get('/transport/vehicles', route(async (req,res)=>{
  if(!guard(req,res,'transport.view'))return;
  const pool=getPool(); const appId=appIdOf(req);
  const rows=await execQ(pool,`SELECT * FROM school_transport_vehicles WHERE app_id=$1 ORDER BY id`,[appId]);
  res.json({ok:true,vehicles:rows});
}));
schoolCompRouter.post('/transport/vehicles', route(async (req,res)=>{
  if(!guard(req,res,'transport.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const b=req.body||{};
  const [row]=await execQ(pool,`INSERT INTO school_transport_vehicles (app_id,vehicle_no,vehicle_type,capacity,driver_name,driver_phone,attendant_name,insurance_expiry,fitness_expiry,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[appId,text(b.vehicleNo||b.vehicle_no),text(b.vehicleType||b.vehicle_type),num(b.capacity),text(b.driverName||b.driver_name),text(b.driverPhone||b.driver_phone),text(b.attendantName||b.attendant_name),day(b.insuranceExpiry||b.insurance_expiry),day(b.fitnessExpiry||b.fitness_expiry),text(b.status)||'active']);
  await writeAudit(pool,appId,req.user,{action:'transport.vehicle.create',entity:'school_transport_vehicles',entityId:row.id});
  res.json({ok:true,vehicle:row});
}));
schoolCompRouter.get('/transport/routes', route(async (req,res)=>{
  if(!guard(req,res,'transport.view'))return;
  const pool=getPool(); const appId=appIdOf(req);
  const rows=await execQ(pool,`SELECT r.*, v.vehicle_no FROM school_transport_routes r LEFT JOIN school_transport_vehicles v ON v.id=r.vehicle_id WHERE r.app_id=$1 ORDER BY r.id`,[appId]);
  res.json({ok:true,routes:rows});
}));
schoolCompRouter.post('/transport/routes', route(async (req,res)=>{
  if(!guard(req,res,'transport.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const b=req.body||{};
  const [row]=await execQ(pool,`INSERT INTO school_transport_routes (app_id,route_name,vehicle_id,start_point,end_point,fare,status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[appId,text(b.routeName||b.route_name),num(b.vehicleId||b.vehicle_id),text(b.startPoint||b.start_point),text(b.endPoint||b.end_point),num(b.fare)||0,text(b.status)||'active']);
  await writeAudit(pool,appId,req.user,{action:'transport.route.create',entity:'school_transport_routes',entityId:row.id});
  res.json({ok:true,route:row});
}));
schoolCompRouter.get('/transport/allocations', route(async (req,res)=>{
  if(!guard(req,res,'transport.view'))return;
  const pool=getPool(); const appId=appIdOf(req);
  const rows=await execQ(pool,`SELECT a.*, s.first_name,s.last_name,s.admission_no,r.route_name FROM school_transport_allocations a LEFT JOIN school_students s ON s.id=a.student_id LEFT JOIN school_transport_routes r ON r.id=a.route_id WHERE a.app_id=$1 ORDER BY a.id`,[appId]);
  res.json({ok:true,allocations:rows});
}));
schoolCompRouter.post('/transport/allocations', route(async (req,res)=>{
  if(!guard(req,res,'transport.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const b=req.body||{};
  const [row]=await execQ(pool,`INSERT INTO school_transport_allocations (app_id,student_id,route_id,stop_id,academic_year_id,status) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (student_id,academic_year_id) DO UPDATE SET route_id=EXCLUDED.route_id,stop_id=EXCLUDED.stop_id RETURNING *`,[appId,num(b.studentId||b.student_id),num(b.routeId||b.route_id),num(b.stopId||b.stop_id),num(b.academicYearId||b.academic_year_id),text(b.status)||'active']);
  await writeAudit(pool,appId,req.user,{action:'transport.allocate',entity:'school_transport_allocations',entityId:row.id});
  res.json({ok:true,allocation:row});
}));

/* library */
schoolCompRouter.get('/library/books', route(async (req,res)=>{
  if(!guard(req,res,'library.view'))return;
  const pool=getPool(); const appId=appIdOf(req);
  const rows=await execQ(pool,`SELECT * FROM school_library_books WHERE app_id=$1 ORDER BY id`,[appId]);
  res.json({ok:true,books:rows});
}));
schoolCompRouter.post('/library/books', route(async (req,res)=>{
  if(!guard(req,res,'library.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const b=req.body||{};
  const [row]=await execQ(pool,`INSERT INTO school_library_books (app_id,book_code,title,author,publisher,category,isbn,copies,available,rack_no,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[appId,text(b.bookCode||b.book_code),text(b.title),text(b.author),text(b.publisher),text(b.category),text(b.isbn),num(b.copies)||1,num(b.copies)||1,text(b.rackNo||b.rack_no),text(b.status)||'available']);
  await writeAudit(pool,appId,req.user,{action:'library.book.add',entity:'school_library_books',entityId:row.id});
  res.json({ok:true,book:row});
}));
schoolCompRouter.get('/library/issues', route(async (req,res)=>{
  if(!guard(req,res,'library.view'))return;
  const pool=getPool(); const appId=appIdOf(req);
  const rows=await execQ(pool,`SELECT i.*, b.title,b.book_code,s.first_name,s.last_name,s.admission_no FROM school_library_issues i LEFT JOIN school_library_books b ON b.id=i.book_id LEFT JOIN school_students s ON s.id=i.student_id WHERE i.app_id=$1 ORDER BY i.issue_date DESC`,[appId]);
  res.json({ok:true,issues:rows});
}));
schoolCompRouter.post('/library/issues', route(async (req,res)=>{
  if(!guard(req,res,'library.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const b=req.body||{};
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const bookRes=await client.query(`SELECT * FROM school_library_books WHERE app_id=$1 AND id=$2 FOR UPDATE`,[appId,num(b.bookId||b.book_id)]);
    const book=bookRes.rows[0]; if(!book||Number(book.available)<=0) throw new Error('Book not available');
    await client.query(`UPDATE school_library_books SET available=available-1 WHERE id=$1`,[book.id]);
    const [row]=await execQ(client,`INSERT INTO school_library_issues (app_id,book_id,student_id,issue_date,due_date,status,issued_by) VALUES ($1,$2,$3,current_date,$4,'issued',$5) RETURNING *`,[appId,book.id,num(b.studentId||b.student_id),day(b.dueDate||b.due_date),req.user?.UserId]);
    await client.query('COMMIT');
    await writeAudit(pool,appId,req.user,{action:'library.issue',entity:'school_library_issues',entityId:row.id});
    res.json({ok:true,issue:row});
  }catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message});}finally{client.release();}
}));
schoolCompRouter.post('/library/returns/:id', route(async (req,res)=>{
  if(!guard(req,res,'library.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const id=num(req.params.id); const b=req.body||{};
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const issRes=await client.query(`SELECT * FROM school_library_issues WHERE app_id=$1 AND id=$2 FOR UPDATE`,[appId,id]);
    const iss=issRes.rows[0]; if(!iss||iss.status==='returned') throw new Error('Invalid issue');
    await client.query(`UPDATE school_library_books SET available=available+1 WHERE app_id=$1 AND id=$2`,[appId,iss.book_id]);
    const [row]=await execQ(client,`UPDATE school_library_issues SET return_date=current_date, fine_amount=$3, status='returned' WHERE app_id=$1 AND id=$2 RETURNING *`,[appId,id,num(b.fineAmount||b.fine_amount)||0]);
    await client.query('COMMIT');
    await writeAudit(pool,appId,req.user,{action:'library.return',entity:'school_library_issues',entityId:id});
    res.json({ok:true,issue:row});
  }catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message});}finally{client.release();}
}));

/* hostel */
schoolCompRouter.get('/hostel/blocks', route(async (req,res)=>{
  if(!guard(req,res,'hostel.view'))return;
  const pool=getPool(); const appId=appIdOf(req);
  const rows=await execQ(pool,`SELECT * FROM school_hostel_blocks WHERE app_id=$1 ORDER BY id`,[appId]);
  res.json({ok:true,blocks:rows});
}));
schoolCompRouter.post('/hostel/blocks', route(async (req,res)=>{
  if(!guard(req,res,'hostel.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const b=req.body||{};
  const [row]=await execQ(pool,`INSERT INTO school_hostel_blocks (app_id,block_name,warden_id,status) VALUES ($1,$2,$3,$4) RETURNING *`,[appId,text(b.blockName||b.block_name),text(b.wardenId||b.warden_id),text(b.status)||'active']);
  await writeAudit(pool,appId,req.user,{action:'hostel.block.create',entity:'school_hostel_blocks',entityId:row.id});
  res.json({ok:true,block:row});
}));
schoolCompRouter.get('/hostel/rooms', route(async (req,res)=>{
  if(!guard(req,res,'hostel.view'))return;
  const pool=getPool(); const appId=appIdOf(req);
  const rows=await execQ(pool,`SELECT r.*, b.block_name FROM school_hostel_rooms r LEFT JOIN school_hostel_blocks b ON b.id=r.block_id WHERE r.app_id=$1 ORDER BY r.id`,[appId]);
  res.json({ok:true,rooms:rows});
}));
schoolCompRouter.post('/hostel/allocations', route(async (req,res)=>{
  if(!guard(req,res,'hostel.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const b=req.body||{};
  const [row]=await execQ(pool,`INSERT INTO school_hostel_allocations (app_id,student_id,block_id,room_id,bed_no,status) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (student_id) DO UPDATE SET block_id=EXCLUDED.block_id,room_id=EXCLUDED.room_id,bed_no=EXCLUDED.bed_no,vacate_date=NULL RETURNING *`,[appId,num(b.studentId||b.student_id),num(b.blockId||b.block_id),num(b.roomId||b.room_id),text(b.bedNo||b.bed_no),text(b.status)||'active']);
  await writeAudit(pool,appId,req.user,{action:'hostel.allocate',entity:'school_hostel_allocations',entityId:row.id});
  res.json({ok:true,allocation:row});
}));

/* inventory */
schoolCompRouter.get('/inventory/items', route(async (req,res)=>{
  if(!guard(req,res,'inventory.view'))return;
  const pool=getPool(); const appId=appIdOf(req);
  const rows=await execQ(pool,`SELECT * FROM school_inventory_items WHERE app_id=$1 ORDER BY id`,[appId]);
  res.json({ok:true,items:rows});
}));
schoolCompRouter.post('/inventory/items', route(async (req,res)=>{
  if(!guard(req,res,'inventory.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const b=req.body||{};
  const [row]=await execQ(pool,`INSERT INTO school_inventory_items (app_id,item_code,item_name,category,unit,current_stock,reorder_level,unit_price,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[appId,text(b.itemCode||b.item_code),text(b.itemName||b.item_name),text(b.category),text(b.unit),num(b.currentStock||b.current_stock)||0,num(b.reorderLevel||b.reorder_level)||0,num(b.unitPrice||b.unit_price)||0,text(b.status)||'active']);
  await writeAudit(pool,appId,req.user,{action:'inventory.item.create',entity:'school_inventory_items',entityId:row.id});
  res.json({ok:true,item:row});
}));
schoolCompRouter.post('/inventory/issues', route(async (req,res)=>{
  if(!guard(req,res,'inventory.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const b=req.body||{};
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const itRes=await client.query(`SELECT * FROM school_inventory_items WHERE app_id=$1 AND id=$2 FOR UPDATE`,[appId,num(b.itemId||b.item_id)]);
    const it=itRes.rows[0]; if(!it||Number(it.current_stock)<Number(b.quantity||0)) throw new Error('Insufficient stock');
    await client.query(`UPDATE school_inventory_items SET current_stock=current_stock-$2 WHERE id=$1`,[it.id,num(b.quantity||0)]);
    const [row]=await execQ(client,`INSERT INTO school_inventory_issues (app_id,item_id,issued_to,quantity,issue_date,issued_by,remarks) VALUES ($1,$2,$3,$4,current_date,$5,$6) RETURNING *`,[appId,it.id,text(b.issuedTo||b.issued_to),num(b.quantity||0),req.user?.UserId,text(b.remarks)]);
    await client.query('COMMIT');
    await writeAudit(pool,appId,req.user,{action:'inventory.issue',entity:'school_inventory_issues',entityId:row.id});
    res.json({ok:true,issue:row});
  }catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message});}finally{client.release();}
}));

/* HR */
schoolCompRouter.get('/hr/employees', route(async (req,res)=>{
  if(!guard(req,res,'hr.view'))return;
  const pool=getPool(); const appId=appIdOf(req);
  const rows=await execQ(pool,`SELECT * FROM school_hr_employees WHERE app_id=$1 ORDER BY id`,[appId]);
  res.json({ok:true,employees:rows});
}));
schoolCompRouter.post('/hr/employees', route(async (req,res)=>{
  if(!guard(req,res,'hr.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const b=req.body||{};
  const [row]=await execQ(pool,`INSERT INTO school_hr_employees (app_id,employee_no,first_name,last_name,dob,gender,phone,email,designation,department,joining_date,reporting_manager,status,salary_basic) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,[appId,text(b.employeeNo||b.employee_no)||('EMP-'+Date.now()),text(b.firstName||b.first_name),text(b.lastName||b.last_name),day(b.dob),text(b.gender),text(b.phone),text(b.email),text(b.designation),text(b.department),day(b.joiningDate||b.joining_date),text(b.reportingManager||b.reporting_manager),text(b.status)||'active',num(b.salaryBasic||b.salary_basic)||0]);
  await writeAudit(pool,appId,req.user,{action:'hr.employee.create',entity:'school_hr_employees',entityId:row.id});
  res.json({ok:true,employee:row});
}));

/* circulars */
schoolCompRouter.get('/circulars', route(async (req,res)=>{
  const pool=getPool(); const appId=appIdOf(req);
  const rows=await execQ(pool,`SELECT * FROM school_circulars WHERE app_id=$1 ORDER BY publish_date DESC,id DESC`,[appId]);
  res.json({ok:true,circulars:rows});
}));
schoolCompRouter.post('/circulars', route(async (req,res)=>{
  if(!guard(req,res,'communication.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const b=req.body||{};
  const [row]=await execQ(pool,`INSERT INTO school_circulars (app_id,title,body,target_type,target_ids,attachment_url,issued_by,publish_date,status,requires_ack) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[appId,text(b.title),text(b.body),text(b.targetType||b.target_type)||'all',JSON.stringify(b.targetIds||b.target_ids||[]),text(b.attachmentUrl||b.attachment_url),req.user?.UserId,day(b.publishDate||b.publish_date)||new Date().toISOString().slice(0,10),text(b.status)||'published',!!b.requiresAck]);
  await writeAudit(pool,appId,req.user,{action:'circular.create',entity:'school_circulars',entityId:row.id});
  res.json({ok:true,circular:row});
}));

/* PTM */
schoolCompRouter.get('/ptm/slots', route(async (req,res)=>{
  const pool=getPool(); const appId=appIdOf(req);
  const rows=await execQ(pool,`SELECT * FROM school_ptm_slots WHERE app_id=$1 ORDER BY slot_date,start_time`,[appId]);
  res.json({ok:true,slots:rows});
}));
schoolCompRouter.post('/ptm/slots', route(async (req,res)=>{
  if(!guard(req,res,'communication.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const b=req.body||{};
  const [row]=await execQ(pool,`INSERT INTO school_ptm_slots (app_id,teacher_id,slot_date,start_time,end_time,status) VALUES ($1,$2,$3,$4,$5,'available') RETURNING *`,[appId,text(b.teacherId||b.teacher_id),day(b.slotDate||b.slot_date),b.startTime||b.start_time,b.endTime||b.end_time]);
  res.json({ok:true,slot:row});
}));
schoolCompRouter.post('/ptm/slots/:id/book', route(async (req,res)=>{
  const pool=getPool(); const appId=appIdOf(req); const id=num(req.params.id); const b=req.body||{};
  const [row]=await execQ(pool,`UPDATE school_ptm_slots SET status='booked', booked_by=$3, student_id=$4 WHERE app_id=$1 AND id=$2 AND status='available' RETURNING *`,[appId,id,req.user?.UserId,num(b.studentId||b.student_id)]);
  if(!row) return res.status(400).json({error:'Slot not available'});
  res.json({ok:true,slot:row});
}));

/* helpdesk */
schoolCompRouter.get('/helpdesk/tickets', route(async (req,res)=>{
  const pool=getPool(); const appId=appIdOf(req);
  const rows=await execQ(pool,`SELECT * FROM school_helpdesk_tickets WHERE app_id=$1 ORDER BY id DESC`,[appId]);
  res.json({ok:true,tickets:rows});
}));
schoolCompRouter.post('/helpdesk/tickets', route(async (req,res)=>{
  const pool=getPool(); const appId=appIdOf(req); const b=req.body||{};
  const ticketNo='TKT-'+Date.now();
  const [row]=await execQ(pool,`INSERT INTO school_helpdesk_tickets (app_id,ticket_no,raised_by,user_type,category,subject,description,priority,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'open') RETURNING *`,[appId,ticketNo,req.user?.UserId,text(b.userType||b.user_type)||'parent',text(b.category),text(b.subject),text(b.description),text(b.priority)||'normal']);
  res.json({ok:true,ticket:row});
}));
schoolCompRouter.post('/helpdesk/tickets/:id/resolve', route(async (req,res)=>{
  if(!guard(req,res,'communication.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const id=num(req.params.id); const b=req.body||{};
  const [row]=await execQ(pool,`UPDATE school_helpdesk_tickets SET status='resolved', assigned_to=$3, resolution=$4, resolved_at=now() WHERE app_id=$1 AND id=$2 RETURNING *`,[appId,id,req.user?.UserId,text(b.resolution)]);
  res.json({ok:true,ticket:row});
}));

/* surveys */
schoolCompRouter.get('/surveys', route(async (req,res)=>{
  const pool=getPool(); const appId=appIdOf(req);
  const rows=await execQ(pool,`SELECT * FROM school_surveys WHERE app_id=$1 ORDER BY id DESC`,[appId]);
  res.json({ok:true,surveys:rows});
}));
schoolCompRouter.post('/surveys', route(async (req,res)=>{
  if(!guard(req,res,'communication.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const b=req.body||{};
  const [row]=await execQ(pool,`INSERT INTO school_surveys (app_id,title,description,questions,target_type,start_date,end_date,status,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[appId,text(b.title),text(b.description),JSON.stringify(b.questions||[]),text(b.targetType||b.target_type)||'all',day(b.startDate||b.start_date),day(b.endDate||b.end_date),text(b.status)||'active',req.user?.UserId]);
  res.json({ok:true,survey:row});
}));
schoolCompRouter.post('/surveys/:id/respond', route(async (req,res)=>{
  const pool=getPool(); const appId=appIdOf(req); const id=num(req.params.id); const b=req.body||{};
  const [row]=await execQ(pool,`INSERT INTO school_survey_responses (app_id,survey_id,respondent_id,respondent_type,responses) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (survey_id,respondent_id) DO UPDATE SET responses=EXCLUDED.responses RETURNING *`,[appId,id,req.user?.UserId,text(b.respondentType||b.respondent_type)||'parent',JSON.stringify(b.responses||{})]);
  res.json({ok:true,response:row});
}));

/* events */
schoolCompRouter.get('/events', route(async (req,res)=>{
  const pool=getPool(); const appId=appIdOf(req);
  const rows=await execQ(pool,`SELECT * FROM school_events WHERE app_id=$1 ORDER BY start_date DESC`,[appId]);
  res.json({ok:true,events:rows});
}));
schoolCompRouter.post('/events', route(async (req,res)=>{
  if(!guard(req,res,'communication.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const b=req.body||{};
  const [row]=await execQ(pool,`INSERT INTO school_events (app_id,title,event_type,start_date,end_date,start_time,end_time,venue,description,target_audience,status,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,[appId,text(b.title),text(b.eventType||b.event_type),day(b.startDate||b.start_date),day(b.endDate||b.end_date),b.startTime||b.start_time,b.endTime||b.end_time,text(b.venue),text(b.description),text(b.targetAudience||b.target_audience),text(b.status)||'planned',req.user?.UserId]);
  res.json({ok:true,event:row});
}));

/* certificates */
schoolCompRouter.get('/certificates', route(async (req,res)=>{
  if(!guard(req,res,'certificates.view'))return;
  const pool=getPool(); const appId=appIdOf(req);
  const rows=await execQ(pool,`SELECT c.*, s.first_name,s.last_name,s.admission_no FROM school_certificates c LEFT JOIN school_students s ON s.id=c.student_id WHERE c.app_id=$1 ORDER BY c.issue_date DESC`,[appId]);
  res.json({ok:true,certificates:rows});
}));
schoolCompRouter.post('/certificates', route(async (req,res)=>{
  if(!guard(req,res,'certificates.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const b=req.body||{};
  const certNo=text(b.certificateNo||b.certificate_no)||('CERT-'+Date.now());
  const [row]=await execQ(pool,`INSERT INTO school_certificates (app_id,certificate_no,student_id,certificate_type,issue_date,purpose,issued_by,qr_code,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[appId,certNo,num(b.studentId||b.student_id),text(b.certificateType||b.certificate_type),day(b.issueDate||b.issue_date)||new Date().toISOString().slice(0,10),text(b.purpose),req.user?.UserId,text(b.qrCode||b.qr_code),text(b.status)||'issued']);
  await writeAudit(pool,appId,req.user,{action:'certificate.issue',entity:'school_certificates',entityId:row.id});
  res.json({ok:true,certificate:row});
}));

/* houses */
schoolCompRouter.get('/houses', route(async (req,res)=>{
  const pool=getPool(); const appId=appIdOf(req);
  const rows=await execQ(pool,`SELECT * FROM school_houses WHERE app_id=$1 ORDER BY id`,[appId]);
  res.json({ok:true,houses:rows});
}));
schoolCompRouter.post('/houses', route(async (req,res)=>{
  if(!guard(req,res,'settings.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const b=req.body||{};
  const [row]=await execQ(pool,`INSERT INTO school_houses (app_id,name,color) VALUES ($1,$2,$3) ON CONFLICT (app_id,name) DO UPDATE SET color=EXCLUDED.color RETURNING *`,[appId,text(b.name),text(b.color)]);
  res.json({ok:true,house:row});
}));

