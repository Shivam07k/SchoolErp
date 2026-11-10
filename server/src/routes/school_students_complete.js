import express from 'express';
import { getPool } from '../db/pool.js';
import { schoolRouter } from './school.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { safeErrorMessage } from '../middleware/error.js';

const appIdOf = (req) => req.user?.company || DEFAULT_COMPANY_ID;
const execQ = async (poolOrClient, sql, params=[]) => { const res = await poolOrClient.query(sql, params); return res.rows; };
const text = (v) => (v === undefined || v === null || v === '') ? null : String(v);
const num = (v) => (v === undefined || v === null || v === '') ? null : Number(v);
const day = (v) => (v === undefined || v === null || v === '') ? null : (v instanceof Date ? v.toISOString().slice(0,10) : String(v).slice(0,10));
const dt = (v) => (v === undefined || v === null || v === '') ? null : v;
const validFileUrl = (v) => /^https:\/\/[^\s]+$/i.test(v) || /^\/uploads\/[^\s]+$/i.test(v) || /^\/api\/school\/uploads\/[^\s]+$/i.test(v);
const validPrivateUpload = (url, key, appId, context) =>
  typeof key === 'string' &&
  typeof url === 'string' &&
  url === `/api/school/uploads/${key}` &&
  key.startsWith(`${appId}/`) &&
  new RegExp(`^${appId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/\\d{4}/${context}/[0-9a-f-]{36}\\.(pdf|jpg|png|webp|mp4)$`, 'i').test(key);
const guard = (req, res, perm) => {
  const access = req.school;
  const perms = access?.permissions || [];
  if (access?.isSuper || perms.includes('*') || perms.includes(perm)) return true;
  res.status(403).json({ error: 'You do not have permission for this action' });
  return false;
};
const route = (fn) => async (req, res, next) => { try { await fn(req, res, next); } catch (e) { console.error(e); res.status(500).json({ error: safeErrorMessage(e, 'Student API error') }); } };
const writeAudit = async (pool, appId, req, meta={}) => {
  try {
    await pool.query(
      `INSERT INTO school_audit_log_enhanced
         (app_id,module,action,record_id,user_id,user_name,ip_address,user_agent,before_data,after_data,details)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        appId, meta.module||null, meta.action||'unknown',
        meta.recordId?String(meta.recordId):null, req?.user?.userid||null,
        req?.user?.name||null, req?.ip||null, req?.headers?.['user-agent']||null,
        meta.before?JSON.stringify(meta.before):null, meta.after?JSON.stringify(meta.after):null,
        JSON.stringify(meta.details||{}),
      ],
    );
  } catch (error) {
    console.error('[student module audit]', error.message);
  }
};

export const schoolStudentsCompleteRouter = express.Router();

/* ---------- Enhanced Admissions ---------- */
schoolStudentsCompleteRouter.get('/admissions/enhanced', route(async (req,res)=>{
  if(!guard(req,res,'admission.view'))return;
  const pool=getPool(); const appId=appIdOf(req);
  const rows = await execQ(pool, `SELECT * FROM school_admissions_enhanced WHERE app_id=$1 ORDER BY id DESC`, [appId]);
  res.json({ok:true,admissions:rows});
}));
schoolStudentsCompleteRouter.post('/admissions/enhanced', route(async (req,res)=>{
  if(!guard(req,res,'admission.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const b=req.body||{};
  const inquiryNo = b.inquiryNo || `INQ-${Date.now()}`;
  const [row] = await execQ(pool, `INSERT INTO school_admissions_enhanced (app_id,inquiry_no,inquiry_date,inquiry_source,class_interested,parent_contact,follow_up_date,inquiry_status,lost_reason,first_name,middle_name,last_name,name_as_per_certificate,dob,gender,blood_group,birth_certificate_no,birth_certificate_url,previous_school,last_class_passed,last_year_marks,last_year_percentage,tc_url,report_card_url,address_proof_url,parent_photo_url,parent_signature_url,declaration_form_url,sibling_student_id,second_language,transport_needed,route_id,stop_id,discount_scholarship_code,application_fee_paid,application_fee_receipt_no,application_fee_receipt_url,interview_score,documents_checklist,application_status,waitlist_number,remarks) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42) RETURNING *`, [appId,inquiryNo,day(b.inquiryDate)||new Date().toISOString().slice(0,10),text(b.inquirySource),num(b.classInterested),text(b.parentContact),day(b.followUpDate),text(b.inquiryStatus)||'new',text(b.lostReason),text(b.firstName),text(b.middleName),text(b.lastName),text(b.nameAsPerCertificate),day(b.dob),text(b.gender),text(b.bloodGroup),text(b.birthCertificateNo),text(b.birthCertificateUrl),text(b.previousSchool),text(b.lastClassPassed),num(b.lastYearMarks),num(b.lastYearPercentage),text(b.tcUrl),text(b.reportCardUrl),text(b.addressProofUrl),text(b.parentPhotoUrl),text(b.parentSignatureUrl),text(b.declarationFormUrl),num(b.siblingStudentId),text(b.secondLanguage),b.transportNeeded===true, num(b.routeId), num(b.stopId), text(b.discountScholarshipCode), b.applicationFeePaid===true, text(b.applicationFeeReceiptNo), text(b.applicationFeeReceiptUrl), num(b.interviewScore), JSON.stringify(b.documentsChecklist||[]), text(b.applicationStatus)||'applied', num(b.waitlistNumber), text(b.remarks)]);
  await writeAudit(pool,appId,req,{module:'admissions',action:'admission.inquiry.create',recordId:row.id,after:row});
  res.json({ok:true,admission:row});
}));
schoolStudentsCompleteRouter.post('/admissions/enhanced/:id/enroll', route(async (req,res)=>{
  if(!guard(req,res,'admission.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const id=num(req.params.id);
  const client = await pool.connect();
  try{
    await client.query('BEGIN');
    const admRes = await client.query(`SELECT * FROM school_admissions_enhanced WHERE app_id=$1 AND id=$2 FOR UPDATE`,[appId,id]);
    const adm = admRes.rows[0]; if(!adm) throw new Error('Admission not found');
    const yearRes = await client.query(`SELECT id FROM school_academic_years WHERE app_id=$1 ORDER BY is_active DESC LIMIT 1`,[appId]);
    const ayId = yearRes.rows[0]?.id;
    const classRes = await client.query(`SELECT id FROM school_classes WHERE app_id=$1 AND id=$2`,[appId, adm.class_interested]);
    const secRes = await client.query(`SELECT id FROM school_sections WHERE app_id=$1 AND class_id=$2 ORDER BY id LIMIT 1`,[appId, adm.class_interested]);
    const countRes = await client.query(`SELECT COUNT(*)::int n FROM school_students WHERE app_id=$1`,[appId]);
    const studentCode = `STU-${new Date().getFullYear()}-${String((countRes.rows[0]?.n||0)+1).padStart(4,'0')}`;
    const admissionNo = adm.inquiry_no || `ADM-${Date.now()}`;
    const stuRes = await client.query(`INSERT INTO school_students (app_id,student_code,admission_no,first_name,middle_name,last_name,name_as_per_certificate,dob,gender,blood_group,birth_certificate_no,photo_url,class_id,section_id,previous_school,father_name,mother_name,father_contact,mother_contact,guardian_name,guardian_phone,address,status,admission_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,current_date) RETURNING *`,[appId,studentCode,admissionNo,adm.first_name,adm.middle_name,adm.last_name,adm.name_as_per_certificate,adm.dob,adm.gender,adm.blood_group,adm.birth_certificate_no,adm.student_photo_url,adm.class_interested,secRes.rows[0]?.id,adm.previous_school,null,null,null,null,null,null,null,'active']);
    const student = stuRes.rows[0];
    await client.query(`UPDATE school_admissions_enhanced SET student_id=$3, application_status='enrolled', enrolled_at=now(), updated_at=now() WHERE app_id=$1 AND id=$2`,[appId,id,student.id]);
    if(ayId && adm.class_interested){ await client.query(`INSERT INTO school_student_enrollments (app_id,student_id,academic_year_id,class_id,section_id,status,joined_on) VALUES ($1,$2,$3,$4,$5,'studying',current_date) ON CONFLICT DO NOTHING`,[appId,student.id,ayId,adm.class_interested,secRes.rows[0]?.id]); }
    await client.query('COMMIT');
    await writeAudit(pool,appId,req,{module:'admissions',action:'admission.enroll',recordId:id,after:{studentId:student.id}});
    res.json({ok:true,student});
  }catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message});}finally{client.release();}
}));

/* ---------- Promotions ---------- */
schoolStudentsCompleteRouter.get('/promotions/runs', route(async (req,res)=>{
  if(!guard(req,res,'students.manage'))return;
  const pool=getPool(); const appId=appIdOf(req);
  const rows = await execQ(pool, `SELECT * FROM school_promotion_runs WHERE app_id=$1 ORDER BY id DESC`, [appId]);
  res.json({ok:true,runs:rows});
}));
schoolStudentsCompleteRouter.post('/promotions/runs', route(async (req,res)=>{
  if(!guard(req,res,'students.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const b=req.body||{};
  const fromYear=num(b.fromAcademicYearId), toYear=num(b.toAcademicYearId);
  const fromClass=num(b.fromClassId), toClass=num(b.toClassId);
  if(!fromYear||!toYear||fromYear===toYear||!fromClass||!toClass) return res.status(400).json({error:'Different source and target academic years and both classes are required'});
  const years=await execQ(pool,`SELECT id FROM school_academic_years WHERE app_id=$1 AND id=ANY($2::int[])`,[appId,[fromYear,toYear]]);
  const classes=await execQ(pool,`SELECT id FROM school_classes WHERE app_id=$1 AND id=ANY($2::int[])`,[appId,[fromClass,toClass]]);
  if(years.length!==2||classes.length!==new Set([fromClass,toClass]).size) return res.status(400).json({error:'Selected academic year or class was not found'});
  for(const [sectionId,classId] of [[num(b.fromSectionId),fromClass],[num(b.toSectionId),toClass]]){
    if(sectionId){
      const section=await execQ(pool,`SELECT id FROM school_sections WHERE app_id=$1 AND class_id=$2 AND id=$3`,[appId,classId,sectionId]);
      if(!section.length) return res.status(400).json({error:'Selected section does not belong to its class'});
    }
  }
  const [row] = await execQ(pool, `INSERT INTO school_promotion_runs (app_id,from_academic_year_id,to_academic_year_id,from_class_id,to_class_id,from_section_id,to_section_id,status,run_by) VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',$8) RETURNING *`,[appId,num(b.fromAcademicYearId),num(b.toAcademicYearId),num(b.fromClassId),num(b.toClassId),num(b.fromSectionId),num(b.toSectionId),req.user?.userid]);
  await writeAudit(pool,appId,req,{module:'promotions',action:'promotion.run.create',recordId:row.id,after:row});
  res.json({ok:true,run:row});
}));
schoolStudentsCompleteRouter.get('/promotions/runs/:id/items', route(async (req,res)=>{
  if(!guard(req,res,'students.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const runId=num(req.params.id);
  const rows = await execQ(pool, `SELECT pi.*, s.first_name,s.last_name,s.admission_no,s.student_code FROM school_promotion_items pi JOIN school_students s ON s.id=pi.student_id WHERE pi.app_id=$1 AND pi.run_id=$2 ORDER BY s.first_name`,[appId,runId]);
  res.json({ok:true,items:rows});
}));
schoolStudentsCompleteRouter.post('/promotions/runs/:id/generate', route(async (req,res)=>{
  if(!guard(req,res,'students.manage'))return;
  const pool=getPool(), appId=appIdOf(req), runId=num(req.params.id), client=await pool.connect();
  let count=0;
  try{
    await client.query('BEGIN');
    const runRes=await client.query(`SELECT * FROM school_promotion_runs WHERE app_id=$1 AND id=$2 FOR UPDATE`,[appId,runId]);
    const run=runRes.rows[0];
    if(!run){await client.query('ROLLBACK');return res.status(404).json({error:'Run not found'});}
    if(run.status!=='draft'){await client.query('ROLLBACK');return res.status(409).json({error:'Only draft promotion runs can be generated'});}
    const students=await client.query(`
      SELECT s.id,
             COALESCE((SELECT SUM(i.amount-i.paid_amount) FROM school_fee_invoices i
                        WHERE i.app_id=$1 AND i.student_id=s.id AND i.status<>'paid'),0) AS dues
        FROM school_students s
        JOIN school_student_enrollments e ON e.app_id=s.app_id AND e.student_id=s.id AND e.status='studying'
       WHERE s.app_id=$1 AND e.academic_year_id=$2 AND e.class_id=$3
         AND ($4::int IS NULL OR e.section_id=$4) AND s.status='active' AND s.deleted_at IS NULL
    `,[appId,run.from_academic_year_id,run.from_class_id,run.from_section_id]);
    for(const student of students.rows){
      await client.query(`
        INSERT INTO school_promotion_items
          (app_id,run_id,student_id,result,attendance_percent,fee_dues,blocked,block_reason)
        SELECT $1,$2,$3,CASE WHEN $4::numeric>0 THEN 'detained' ELSE 'promoted' END,
               0,$4,($4::numeric>0),CASE WHEN $4::numeric>0 THEN 'Fee dues pending' ELSE NULL END
         WHERE NOT EXISTS (
           SELECT 1 FROM school_promotion_items WHERE app_id=$1 AND run_id=$2 AND student_id=$3
         )
      `,[appId,runId,student.id,student.dues]);
    }
    const total=await client.query(`SELECT count(*)::int AS n FROM school_promotion_items WHERE app_id=$1 AND run_id=$2`,[appId,runId]);
    count=total.rows[0].n;
    await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  await writeAudit(pool,appId,req,{module:'promotions',action:'promotion.run.generate',recordId:runId,details:{count}});
  res.json({ok:true,count});
}));
schoolStudentsCompleteRouter.post('/promotions/runs/:id/promote', route(async (req,res)=>{
  if(!guard(req,res,'students.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const runId=num(req.params.id);
  const b=req.body||{};
  const items = Array.isArray(b.items)?b.items:[];
  if(!items.length) return res.status(400).json({error:'No promotion results supplied'});
  const client = await pool.connect();
  try{
    await client.query('BEGIN');
    const runRes = await execQ(client, `SELECT * FROM school_promotion_runs WHERE app_id=$1 AND id=$2 FOR UPDATE`,[appId,runId]);
    const run = runRes[0];
    if(!run){await client.query('ROLLBACK');return res.status(404).json({error:'Run not found'});}
    if(run.status!=='draft'){await client.query('ROLLBACK');return res.status(409).json({error:'Promotion run has already been executed'});}
    if(!run.to_academic_year_id){await client.query('ROLLBACK');return res.status(400).json({error:'Target academic year is required'});}
    let promoted=0, detained=0;
    const processed=new Set();
    for(const it of items){
      const sid=num(it.studentId); const result=text(it.result)||'promoted';
      if(!sid||processed.has(sid)) throw new Error('Invalid or duplicate student result');
      processed.add(sid);
      if(!['promoted','detained'].includes(result)) throw new Error('Result must be promoted or detained');
      const itemRes=await client.query(
        `SELECT * FROM school_promotion_items WHERE app_id=$1 AND run_id=$2 AND student_id=$3 FOR UPDATE`,
        [appId,runId,sid],
      );
      const item=itemRes.rows[0];
      if(!item) throw new Error('Student is not part of this promotion run');
      if(item.blocked&&result==='promoted') throw new Error(`Student ${sid} is blocked: ${item.block_reason||'eligibility checks failed'}`);
      const targetClass=result==='detained'?run.from_class_id:run.to_class_id;
      const targetSection=result==='detained'?run.from_section_id:run.to_section_id;
      if(!targetClass) throw new Error('Promotion class mapping is incomplete');
      const sectionId=targetSection || (await client.query(
        `SELECT id FROM school_sections WHERE app_id=$1 AND class_id=$2 ORDER BY id LIMIT 1`,
        [appId,targetClass],
      )).rows[0]?.id || null;
      const inserted=await client.query(`
        INSERT INTO school_student_enrollments
          (app_id,student_id,academic_year_id,class_id,section_id,status,joined_on)
        VALUES ($1,$2,$3,$4,$5,'studying',current_date)
        ON CONFLICT (app_id,student_id,academic_year_id) DO NOTHING
        RETURNING id
      `,[appId,sid,run.to_academic_year_id,targetClass,sectionId]);
      if(!inserted.rows[0]) throw new Error(`Student ${sid} already has an enrollment in the target academic year`);
      await client.query(
        `UPDATE school_students SET class_id=$3,section_id=$4 WHERE app_id=$1 AND id=$2`,
        [appId,sid,targetClass,sectionId],
      );
      await client.query(
        `UPDATE school_promotion_items
            SET result=$4,promoted_on=current_date,promoted_by=$5
          WHERE app_id=$1 AND run_id=$2 AND student_id=$3`,
        [appId,runId,sid,result,req.user?.userid],
      );
      if(result==='detained') detained++;
      else promoted++;
    }
    await client.query(`UPDATE school_promotion_runs SET status='executed',run_at=now() WHERE app_id=$1 AND id=$2`,[appId,runId]);
    await client.query('COMMIT');
    await writeAudit(pool,appId,req,{module:'promotions',action:'promotion.run.execute',recordId:runId,details:{promoted}});
    res.json({ok:true,promoted,detained});
  }catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message});}finally{client.release();}
}));

/* ---------- Transfer & Exit ---------- */
schoolStudentsCompleteRouter.get('/exit/requests', route(async (req,res)=>{
  if(!guard(req,res,'students.view'))return;
  const rows=await execQ(getPool(),`
    SELECT r.*,s.first_name,s.middle_name,s.last_name,s.admission_no,s.student_code,
           cls.name AS class_name,sec.name AS section_name,
           COALESCE(json_agg(json_build_object(
             'id',c.id,'department',c.department,'status',c.status,'notes',c.notes,
             'clearedBy',c.cleared_by,'clearedAt',c.cleared_at
           ) ORDER BY c.department) FILTER (WHERE c.id IS NOT NULL),'[]'::json) AS clearances,
           tc.tc_no,tc.signed_scan_url,tc.character_cert_url
      FROM school_exit_requests r
      JOIN school_students s ON s.id=r.student_id AND s.app_id=r.app_id
      LEFT JOIN school_exit_clearances c ON c.app_id=r.app_id AND c.request_id=r.id
      LEFT JOIN school_transfer_certificates tc ON tc.app_id=r.app_id AND tc.request_id=r.id
      LEFT JOIN school_classes cls ON cls.id=s.class_id AND cls.app_id=s.app_id
      LEFT JOIN school_sections sec ON sec.id=s.section_id AND sec.app_id=s.app_id
     WHERE r.app_id=$1
     GROUP BY r.id,s.id,tc.tc_no,tc.signed_scan_url,tc.character_cert_url,cls.name,sec.name
     ORDER BY r.id DESC
  `,[appIdOf(req)]);
  res.json({ok:true,requests:rows});
}));
schoolStudentsCompleteRouter.post('/exit/requests', route(async (req,res)=>{
  if(!guard(req,res,'students.manage'))return;
  const pool=getPool(),appId=appIdOf(req),b=req.body||{},studentId=num(b.studentId);
  const exitType=text(b.exitType),reason=text(b.reasonLeaving);
  if(!studentId||!['Transfer','Dropout','Expelled','Left without TC'].includes(exitType)||!reason) {
    return res.status(400).json({error:'Student, valid exit type, and reason are required'});
  }
  const client=await pool.connect();
  let row;
  try{
    await client.query('BEGIN');
    const student=await client.query(
      `SELECT id,class_id FROM school_students WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL AND status='active' FOR UPDATE`,
      [appId,studentId],
    );
    if(!student.rows[0]){await client.query('ROLLBACK');return res.status(404).json({error:'Active student not found'});}
    const existing=await client.query(
      `SELECT id FROM school_exit_requests WHERE app_id=$1 AND student_id=$2 AND status NOT IN ('closed','cancelled')`,
      [appId,studentId],
    );
    if(existing.rows.length){await client.query('ROLLBACK');return res.status(409).json({error:'An open exit request already exists for this student'});}
    const idResult=await client.query(`SELECT nextval(pg_get_serial_sequence('school_exit_requests','id')) AS id`);
    const id=Number(idResult.rows[0].id);
    const requestNo=`EXIT-${new Date().getFullYear()}-${String(id).padStart(6,'0')}`;
    const inserted=await client.query(`
      INSERT INTO school_exit_requests
        (id,app_id,request_no,student_id,exit_type,reason_leaving,reason_detail,
         destination_school,destination_city,requested_by,last_class_attended,conduct_on_tc,remarks)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *
    `,[id,appId,requestNo,studentId,exitType,reason,text(b.reasonDetail),text(b.destinationSchool),
      text(b.destinationCity),req.user?.userid||null,student.rows[0].class_id,
      text(b.conductOnTc)||'good',text(b.remarks)]);
    row=inserted.rows[0];
    await client.query(`
      INSERT INTO school_exit_clearances (app_id,request_id,department)
      VALUES ($1,$2,'Fees'),($1,$2,'Library'),($1,$2,'Sports'),($1,$2,'Lab')
      ON CONFLICT (request_id,department) DO NOTHING
    `,[appId,row.id]);
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  await writeAudit(pool,appId,req,{module:'transfers',action:'exit.request.create',recordId:row.id,after:row});
  res.status(201).json({ok:true,request:row});
}));
schoolStudentsCompleteRouter.post('/exit/requests/:id/clearance', route(async (req,res)=>{
  if(!guard(req,res,'students.manage'))return;
  const pool=getPool(),appId=appIdOf(req),id=num(req.params.id),b=req.body||{};
  const department=text(b.department),status=text(b.status)||'cleared';
  if(!['Fees','Library','Sports','Lab'].includes(department)||!['cleared','pending','rejected'].includes(status)) {
    return res.status(400).json({error:'Valid department and clearance status are required'});
  }
  if(status==='rejected'&&!text(b.notes)) return res.status(400).json({error:'A note is required when rejecting clearance'});
  const request=await execQ(pool,`SELECT id FROM school_exit_requests WHERE app_id=$1 AND id=$2 AND status='requested'`,[appId,id]);
  if(!request.length) return res.status(404).json({error:'Open exit request not found'});
  if(department==='Fees'&&status==='cleared'){
    const due=await execQ(pool,`
      SELECT COALESCE(SUM(amount-paid_amount),0)::numeric AS balance
        FROM school_fee_invoices WHERE app_id=$1 AND student_id=(
          SELECT student_id FROM school_exit_requests WHERE app_id=$1 AND id=$2
        ) AND status<>'paid'
    `,[appId,id]);
    if(Number(due[0]?.balance||0)>0) return res.status(409).json({error:'Outstanding fee balance prevents fee clearance'});
  }
  const [row]=await execQ(pool,`
    UPDATE school_exit_clearances
       SET status=$3,cleared_by=CASE WHEN $3='cleared' THEN $4 ELSE NULL END,
           cleared_at=CASE WHEN $3='cleared' THEN now() ELSE NULL END,notes=$5
     WHERE app_id=$1 AND request_id=$2 AND department=$6 RETURNING *
  `,[appId,id,status,req.user?.userid||null,text(b.notes),department]);
  if(!row) return res.status(404).json({error:'Clearance department not found'});
  await writeAudit(pool,appId,req,{module:'transfers',action:'exit.clearance.update',recordId:row.id,after:row});
  res.json({ok:true,clearance:row});
}));
schoolStudentsCompleteRouter.post('/exit/requests/:id/issue-tc', route(async (req,res)=>{
  if(!guard(req,res,'students.manage'))return;
  const pool=getPool(),appId=appIdOf(req),id=num(req.params.id);
  for(const [url,key] of [[text(req.body?.signedScanUrl),text(req.body?.signedScanStorageKey)],[text(req.body?.characterCertificateUrl),text(req.body?.characterCertificateStorageKey)]]){
    if(url?.startsWith('/api/school/uploads/')&&!validPrivateUpload(url,key,appId,'document')){
      return res.status(400).json({error:'TC attachment upload key is invalid for this school'});
    }
  }
  const client=await pool.connect();
  let result;
  try{
    await client.query('BEGIN');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`,[appId]);
    const request=await client.query(
      `SELECT * FROM school_exit_requests WHERE app_id=$1 AND id=$2 FOR UPDATE`,[appId,id],
    );
    const exit=request.rows[0];
    if(!exit){await client.query('ROLLBACK');return res.status(404).json({error:'Exit request not found'});}
    const existing=await client.query(`SELECT * FROM school_transfer_certificates WHERE app_id=$1 AND request_id=$2`,[appId,id]);
    if(existing.rows[0]){await client.query('COMMIT');return res.json({ok:true,certificate:existing.rows[0],alreadyIssued:true});}
    if(exit.status!=='requested') throw new Error('Only open exit requests can issue a TC');
    const clearance=await client.query(
      `SELECT department,status FROM school_exit_clearances WHERE app_id=$1 AND request_id=$2`,[appId,id],
    );
    const required=['Fees','Library','Sports','Lab'];
    const ready=required.every((department)=>clearance.rows.some((item)=>item.department===department&&item.status==='cleared'));
    if(!ready) throw new Error('All Fees, Library, Sports, and Lab clearances must be cleared before TC issuance');
    const feeBalance=await client.query(`
      SELECT COALESCE(SUM(amount-paid_amount),0)::numeric AS balance
        FROM school_fee_invoices WHERE app_id=$1 AND student_id=$2 AND status<>'paid'
    `,[appId,exit.student_id]);
    if(Number(feeBalance.rows[0]?.balance||0)>0) throw new Error('Outstanding fee balance prevents TC issuance');
    const tcCount=await client.query(`
      SELECT COALESCE(MAX(regexp_replace(tc_no,'^.*-','')::int),0)+1 AS n
        FROM school_transfer_certificates
       WHERE app_id=$1 AND tc_no ~ $2
    `,[appId,`^TC-${new Date().getFullYear()}-[0-9]+$`]);
    const tcNo=`TC-${new Date().getFullYear()}-${String(tcCount.rows[0].n).padStart(6,'0')}`;
    const cert=await client.query(`
      INSERT INTO school_transfer_certificates
        (app_id,request_id,tc_no,student_id,issue_date,issued_by,conduct,tc_content,signed_scan_url,character_cert_url,remarks)
      VALUES ($1,$2,$3,$4,current_date,$5,$6,$7,$8,$9,$10) RETURNING *
    `,[appId,id,tcNo,exit.student_id,req.user?.userid||null,exit.conduct_on_tc||'good',
      JSON.stringify({requestNo:exit.request_no,exitType:exit.exit_type,reason:exit.reason_leaving,
        lastClassAttended:exit.last_class_attended,destinationSchool:exit.destination_school,
        destinationCity:exit.destination_city}),
      text(req.body?.signedScanUrl),text(req.body?.characterCertificateUrl),text(req.body?.remarks)]);
    const studentStatus=exit.exit_type==='Transfer'?'transferred':exit.exit_type==='Expelled'?'expelled':'left';
    await client.query(`UPDATE school_exit_requests SET status='tc_issued',tc_issue_date=current_date,approved_by=$3,approved_at=now(),updated_at=now() WHERE app_id=$1 AND id=$2`,[appId,id,req.user?.userid||null]);
    await client.query(`UPDATE school_students SET status=$3,leaving_date=current_date WHERE app_id=$1 AND id=$2`,[appId,exit.student_id,studentStatus]);
    await client.query(`UPDATE school_student_enrollments SET status='left',left_on=COALESCE(left_on,current_date) WHERE app_id=$1 AND student_id=$2 AND status='studying'`,[appId,exit.student_id]);
    result=cert.rows[0];
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');return res.status(409).json({error:error.message});}
  finally{client.release();}
  await writeAudit(pool,appId,req,{module:'transfers',action:'exit.tc.issue',recordId:id,after:result});
  res.json({ok:true,certificate:result});
}));
schoolStudentsCompleteRouter.post('/exit/requests/:id/close', route(async (req,res)=>{
  if(!guard(req,res,'students.manage'))return;
  const pool=getPool(),appId=appIdOf(req),id=num(req.params.id);
  const [row]=await execQ(pool,`
    UPDATE school_exit_requests
       SET status='closed',closed_at=now(),updated_at=now()
     WHERE app_id=$1 AND id=$2 AND status='tc_issued' RETURNING *
  `,[appId,id]);
  if(!row) return res.status(409).json({error:'Only requests with an issued TC can be closed'});
  await writeAudit(pool,appId,req,{module:'transfers',action:'exit.request.close',recordId:id,after:row});
  res.json({ok:true,request:row});
}));
schoolStudentsCompleteRouter.get('/transfers', route(async (req,res)=>{
  if(!guard(req,res,'students.manage'))return;
  const pool=getPool(); const appId=appIdOf(req);
  const rows = await execQ(pool, `SELECT t.*, s.first_name,s.last_name,s.admission_no,s.student_code FROM school_transfers t JOIN school_students s ON s.id=t.student_id WHERE t.app_id=$1 ORDER BY t.id DESC`,[appId]);
  res.json({ok:true,transfers:rows});
}));
schoolStudentsCompleteRouter.post('/transfers', route(async (req,res)=>{
  if(!guard(req,res,'students.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const b=req.body||{};
  const studentId=num(b.studentId), exitType=text(b.exitType), reason=text(b.reasonLeaving);
  if(!studentId||!['Transfer','Dropout','Expelled','Left without TC'].includes(exitType)||!reason) return res.status(400).json({error:'Student, valid exit type, and reason are required'});
  const client=await pool.connect();
  let row;
  try{
    await client.query('BEGIN');
    const student=await client.query(`SELECT id FROM school_students WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL AND status='active' FOR UPDATE`,[appId,studentId]);
    if(!student.rows[0]){await client.query('ROLLBACK');return res.status(404).json({error:'Active student not found'});}
    const next=await client.query(`SELECT nextval(pg_get_serial_sequence('school_transfers','id')) AS id`);
    const id=Number(next.rows[0].id);
    const transferNo=text(b.transferNo)||`EXIT-${new Date().getFullYear()}-${String(id).padStart(6,'0')}`;
    const inserted=await client.query(`
      INSERT INTO school_transfers
        (id,app_id,transfer_no,student_id,exit_type,application_date,tc_issue_date,reason_leaving,
         reason_detail,destination_school,destination_city,conduct_on_tc,last_class_attended,
         last_attendance_date,no_dues_checklist,no_dues_certificate_url,tc_signed_copy_url,
         character_certificate_url,refund_due,parent_acknowledgement_url,status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,'pending')
      RETURNING *
    `,[id,appId,transferNo,studentId,exitType,day(b.applicationDate)||new Date().toISOString().slice(0,10),day(b.tcIssueDate),reason,text(b.reasonDetail),text(b.destinationSchool),text(b.destinationCity),text(b.conductOnTc)||'good',num(b.lastClassAttended),day(b.lastAttendanceDate),JSON.stringify(b.noDuesChecklist||{"fees":false,"library":false,"sports":false,"lab":false}),text(b.noDuesCertificateUrl),text(b.tcSignedCopyUrl),text(b.characterCertificateUrl),num(b.refundDue)||0,text(b.parentAcknowledgementUrl)]);
    row=inserted.rows[0];
    await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  await writeAudit(pool,appId,req,{module:'transfers',action:'transfer.create',recordId:row.id,after:row});
  res.json({ok:true,transfer:row});
}));
schoolStudentsCompleteRouter.post('/transfers/:id/issue-tc', route(async (req,res)=>{
  if(!guard(req,res,'students.manage'))return;
  res.status(409).json({error:'TC issuance now requires department clearances. Create or complete the request in Transfer & Exit.'});
}));

/* ---------- Documents Enhanced ---------- */
schoolStudentsCompleteRouter.get('/students/documents/types', route(async (req,res)=>{
  if(!guard(req,res,'students.view'))return;
  const rows = await execQ(getPool(), `
    SELECT id,name,code,is_mandatory,applicable_to,sort_order
      FROM school_document_types WHERE app_id=$1 ORDER BY sort_order,name
  `,[appIdOf(req)]);
  res.json({ok:true,types:rows});
}));
schoolStudentsCompleteRouter.get('/documents/enhanced', route(async (req,res)=>{
  if(!guard(req,res,'students.view'))return;
  const pool=getPool(); const appId=appIdOf(req); const sid=num(req.query.studentId);
  const rawClassId=text(req.query.classId);
  const classId=rawClassId && rawClassId !== 'unassigned' ? num(rawClassId) : null;
  if(rawClassId && rawClassId !== 'unassigned' && !classId) return res.status(400).json({error:'Invalid class ID'});
  let q = `SELECT d.*, s.first_name,s.middle_name,s.last_name,s.admission_no,s.student_code,
                  c.name AS class_name, sec.name AS section_name
             FROM school_student_documents_enhanced d
             JOIN school_students s ON s.id=d.student_id AND s.app_id=d.app_id
             LEFT JOIN school_classes c ON c.id=s.class_id AND c.app_id=s.app_id
             LEFT JOIN school_sections sec ON sec.id=s.section_id AND sec.app_id=s.app_id
            WHERE d.app_id=$1`;
  const p=[appId];
  if(sid){p.push(sid); q+=` AND d.student_id=$${p.length}`;}
  if(rawClassId === 'unassigned') q+=' AND s.class_id IS NULL';
  else if(classId){p.push(classId); q+=` AND s.class_id=$${p.length}`;}
  q+=` ORDER BY d.created_at DESC`;
  const rows = await execQ(pool,q,p);
  res.json({ok:true,documents:rows});
}));
schoolStudentsCompleteRouter.post('/documents/enhanced', route(async (req,res)=>{
  if(!guard(req,res,'students.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const b=req.body||{};
  const studentId=num(b.studentId), fileName=text(b.fileName), fileUrl=text(b.fileUrl);
  if(!studentId || !fileName || !fileUrl || !text(b.documentType)) return res.status(400).json({error:'Student, document type, file name, and file URL are required'});
  if(!validFileUrl(fileUrl)) return res.status(400).json({error:'Document URL must be HTTPS or an /uploads path'});
  if(fileUrl.startsWith('/api/school/uploads/')&&!validPrivateUpload(fileUrl,text(b.storageKey),appId,'document')) return res.status(400).json({error:'Document upload key is invalid for this school'});
  const student = await execQ(pool,`SELECT id FROM school_students WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL`,[appId,studentId]);
  if(!student.length) return res.status(404).json({error:'Student not found'});
  const client=await pool.connect();
  let row;
  try{
    await client.query('BEGIN');
    const inserted = await client.query(`
      INSERT INTO school_student_documents_enhanced
        (app_id,student_id,document_type_id,document_type,document_title,document_number,file_name,
         file_url,file_size,mime_type,issue_date,issuing_authority,expiry_date,
         verification_status,notes,uploaded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'submitted',$14,$15) RETURNING *
    `,[appId,studentId,num(b.documentTypeId),text(b.documentType),text(b.documentTitle)||text(b.documentType),text(b.documentNumber),fileName,fileUrl,num(b.fileSize),text(b.mimeType),day(b.issueDate),text(b.issuingAuthority),day(b.expiryDate),text(b.notes),req.user?.userid||null]);
    row=inserted.rows[0];
    const version=await client.query(`
      INSERT INTO school_document_versions
        (app_id,document_id,version_number,file_name,file_url,storage_key,file_size,mime_type,uploaded_by)
      VALUES ($1,$2,1,$3,$4,$5,$6,$7,$8) RETURNING id
    `,[appId,row.id,fileName,fileUrl,text(b.storageKey),num(b.fileSize),text(b.mimeType),req.user?.userid||null]);
    await client.query(`UPDATE school_student_documents_enhanced SET current_version_id=$3 WHERE app_id=$1 AND id=$2`,[appId,row.id,version.rows[0].id]);
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  await writeAudit(pool,appId,req,{module:'documents',action:'document.upload',recordId:row.id,after:row});
  res.json({ok:true,document:row});
}));
schoolStudentsCompleteRouter.post('/documents/enhanced/:id/verify', route(async (req,res)=>{
  if(!guard(req,res,'students.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const id=num(req.params.id); const b=req.body||{};
  const status=text(b.status);
  if(!['verified','rejected'].includes(status)) return res.status(400).json({error:'Status must be verified or rejected'});
  if(status==='rejected'&&!text(b.rejectionReason)) return res.status(400).json({error:'A rejection reason is required'});
  const [row] = await execQ(pool, `UPDATE school_student_documents_enhanced SET verification_status=$3, verified_by=$4, verified_at=now(), rejection_reason=$5, updated_at=now() WHERE app_id=$1 AND id=$2 RETURNING *`,[appId,id,status,req.user?.userid||null,status==='rejected'?text(b.rejectionReason):null]);
  if(!row) return res.status(404).json({error:'Document not found'});
  await writeAudit(pool,appId,req,{module:'documents',action:'document.verify',recordId:id,after:row});
  res.json({ok:true,document:row});
}));
schoolStudentsCompleteRouter.post('/documents/enhanced/:id/replace', route(async (req,res)=>{
  if(!guard(req,res,'students.manage'))return;
  const pool=getPool(), appId=appIdOf(req), id=num(req.params.id), b=req.body||{};
  const fileName=text(b.fileName), fileUrl=text(b.fileUrl);
  if(!fileName||!fileUrl) return res.status(400).json({error:'File name and file URL are required'});
  if(!validFileUrl(fileUrl)) return res.status(400).json({error:'Document URL must be HTTPS or an /uploads path'});
  if(fileUrl.startsWith('/api/school/uploads/')&&!validPrivateUpload(fileUrl,text(b.storageKey),appId,'document')) return res.status(400).json({error:'Document upload key is invalid for this school'});
  const client=await pool.connect();
  let row;
  try{
    await client.query('BEGIN');
    const current=await client.query(`SELECT * FROM school_student_documents_enhanced WHERE app_id=$1 AND id=$2 FOR UPDATE`,[appId,id]);
    if(!current.rows[0]){await client.query('ROLLBACK');return res.status(404).json({error:'Document not found'});}
    const next=await client.query(`SELECT COALESCE(MAX(version_number),0)+1 AS version FROM school_document_versions WHERE app_id=$1 AND document_id=$2`,[appId,id]);
    const updated=await client.query(`
      UPDATE school_student_documents_enhanced
         SET file_name=$3,file_url=$4,file_size=$5,mime_type=$6,verification_status='submitted',
             verified_by=NULL,verified_at=NULL,rejection_reason=NULL,updated_at=now()
       WHERE app_id=$1 AND id=$2 RETURNING *
    `,[appId,id,fileName,fileUrl,num(b.fileSize),text(b.mimeType)]);
    row=updated.rows[0];
    const version=await client.query(`
      INSERT INTO school_document_versions
        (app_id,document_id,version_number,file_name,file_url,storage_key,file_size,mime_type,uploaded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id
    `,[appId,id,next.rows[0].version,fileName,fileUrl,text(b.storageKey),num(b.fileSize),text(b.mimeType),req.user?.userid||null]);
    await client.query(`UPDATE school_student_documents_enhanced SET current_version_id=$3 WHERE app_id=$1 AND id=$2`,[appId,id,version.rows[0].id]);
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  await writeAudit(pool,appId,req,{module:'documents',action:'document.replace',recordId:id,after:row});
  res.json({ok:true,document:row});
}));

/* ---------- Health ---------- */
schoolStudentsCompleteRouter.get('/health/profiles', route(async (req,res)=>{
  if(!guard(req,res,'health.view'))return;
  const pool=getPool(); const appId=appIdOf(req); const sid=num(req.query.studentId);
  let q = `SELECT hp.*, s.first_name,s.middle_name,s.last_name,s.admission_no,s.student_code
             FROM school_health_profiles hp
             JOIN school_students s ON s.id=hp.student_id AND s.app_id=hp.app_id
            WHERE hp.app_id=$1`;
  const p=[appId];
  if(sid){p.push(sid); q+=` AND hp.student_id=$${p.length}`;}
  const rows = await execQ(pool,q,p);
  res.json({ok:true,profiles:rows});
}));
schoolStudentsCompleteRouter.post('/health/profiles', route(async (req,res)=>{
  if(!guard(req,res,'health.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const b=req.body||{};
  const studentId=num(b.studentId);
  if(!studentId) return res.status(400).json({error:'Student is required'});
  const student=await execQ(pool,`SELECT id FROM school_students WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL`,[appId,studentId]);
  if(!student.length) return res.status(404).json({error:'Student not found'});
  const [existingProfile]=await execQ(pool,`SELECT medical_fitness_url FROM school_health_profiles WHERE app_id=$1 AND student_id=$2`,[appId,studentId]);
  const h = num(b.heightCm); const w = num(b.weightKg);
  const medicalFitnessUrl=text(b.medicalFitnessUrl);
  if(medicalFitnessUrl?.startsWith('/api/school/uploads/')&&medicalFitnessUrl!==existingProfile?.medical_fitness_url&&!validPrivateUpload(medicalFitnessUrl,text(b.medicalFitnessStorageKey),appId,'health')) return res.status(400).json({error:'Medical certificate upload key is invalid for this school'});
  const bmi = h&&w ? (w/(h/100)/(h/100)) : null;
  const chronicConditions=JSON.stringify(Array.isArray(b.chronicConditions)?b.chronicConditions:[]);
  const values=[appId,studentId,text(b.bloodGroup),h,w,bmi,text(b.allergies),chronicConditions,text(b.regularMedications),text(b.doctorName),text(b.doctorContact),text(b.preferredHospital),text(b.vaccinationCardUrl),medicalFitnessUrl,day(b.medicalFitnessExpiry)];
  const client=await pool.connect();
  let row;
  try{
    await client.query('BEGIN');
    const saved=await client.query(`
      INSERT INTO school_health_profiles
        (app_id,student_id,blood_group,height_cm,weight_kg,bmi,allergies,chronic_conditions,
         regular_medications,doctor_name,doctor_contact,preferred_hospital,vaccination_card_url,
         medical_fitness_url,medical_fitness_expiry)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT (student_id) DO UPDATE SET
        blood_group=EXCLUDED.blood_group,height_cm=EXCLUDED.height_cm,weight_kg=EXCLUDED.weight_kg,
        bmi=EXCLUDED.bmi,allergies=EXCLUDED.allergies,chronic_conditions=EXCLUDED.chronic_conditions,
        regular_medications=EXCLUDED.regular_medications,doctor_name=EXCLUDED.doctor_name,
        doctor_contact=EXCLUDED.doctor_contact,preferred_hospital=EXCLUDED.preferred_hospital,
        vaccination_card_url=EXCLUDED.vaccination_card_url,medical_fitness_url=EXCLUDED.medical_fitness_url,
        medical_fitness_expiry=EXCLUDED.medical_fitness_expiry,updated_at=now()
      WHERE school_health_profiles.app_id=EXCLUDED.app_id
      RETURNING *
    `,values);
    row=saved.rows[0];
    if(!row){await client.query('ROLLBACK');return res.status(409).json({error:'Health profile is linked to a different school'});}
    await client.query(`
      UPDATE school_students
         SET blood_group=$3,height_cm=$4,weight_kg=$5,allergies=$6,chronic_conditions=$7::jsonb,
             regular_medications=$8,doctor_name=$9,doctor_contact=$10,preferred_hospital=$11,
             medical_conditions=$12,updated_at=now()
       WHERE app_id=$1 AND id=$2
    `,[appId,studentId,text(b.bloodGroup),h,w,text(b.allergies),chronicConditions,text(b.regularMedications),text(b.doctorName),text(b.doctorContact),text(b.preferredHospital),Array.isArray(b.chronicConditions)?b.chronicConditions.join(', '):null]);
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  await writeAudit(pool,appId,req,{module:'health',action:'health.profile.upsert',recordId:row.id,after:row});
  res.json({ok:true,profile:row});
}));
schoolStudentsCompleteRouter.get('/health/events', route(async (req,res)=>{
  if(!guard(req,res,'health.view'))return;
  const pool=getPool(); const appId=appIdOf(req); const sid=num(req.query.studentId);
  let q = `SELECT he.*, s.first_name,s.middle_name,s.last_name,s.admission_no
             FROM school_health_events he
             JOIN school_students s ON s.id=he.student_id AND s.app_id=he.app_id
            WHERE he.app_id=$1`;
  const p=[appId];
  if(sid){p.push(sid); q+=` AND he.student_id=$${p.length}`;}
  q+=` ORDER BY he.event_datetime DESC`;
  const rows = await execQ(pool,q,p);
  res.json({ok:true,events:rows});
}));
schoolStudentsCompleteRouter.post('/health/events', route(async (req,res)=>{
  if(!guard(req,res,'health.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const b=req.body||{};
  const studentId=num(b.studentId);
  if(!studentId) return res.status(400).json({error:'Student is required'});
  const student=await execQ(pool,`SELECT id FROM school_students WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL`,[appId,studentId]);
  if(!student.length) return res.status(404).json({error:'Student not found'});
  const [row] = await execQ(pool, `INSERT INTO school_health_events (app_id,student_id,event_datetime,symptom_complaint,treatment_given,action_taken,injury_photo_url,prescription_url,attending_staff,parent_informed,parent_informed_at,informed_by,severity,follow_up_required,follow_up_date,remarks) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,[appId,studentId,dt(b.eventDatetime)||new Date().toISOString(),text(b.symptomComplaint),text(b.treatmentGiven),text(b.actionTaken),text(b.injuryPhotoUrl),text(b.prescriptionUrl),text(b.attendingStaff),b.parentInformed===true, b.parentInformed===true?new Date().toISOString():null, text(b.informedBy), text(b.severity)||'minor', b.followUpRequired===true, day(b.followUpDate), text(b.remarks)]);
  await writeAudit(pool,appId,req,{module:'health',action:'health.event.create',recordId:row.id,after:row});
  res.json({ok:true,event:row});
}));
schoolStudentsCompleteRouter.get('/health/observations', route(async (req,res)=>{
  if(!guard(req,res,'health.view'))return;
  const appId=appIdOf(req),studentId=num(req.query.studentId);
  const rows=await execQ(getPool(),`
    SELECT o.*,s.first_name,s.last_name
      FROM school_health_observations o JOIN school_students s ON s.id=o.student_id AND s.app_id=o.app_id
     WHERE o.app_id=$1 AND ($2::int IS NULL OR o.student_id=$2)
     ORDER BY o.observed_at DESC,o.id DESC
  `,[appId,studentId]);
  res.json({ok:true,observations:rows});
}));
schoolStudentsCompleteRouter.post('/health/observations', route(async (req,res)=>{
  if(!guard(req,res,'health.manage'))return;
  const pool=getPool(),appId=appIdOf(req),b=req.body||{};
  const studentId=num(b.studentId),value=num(b.value),type=text(b.observationType);
  if(!studentId||!Number.isFinite(value)||value<=0||!['height','weight'].includes(type)) return res.status(400).json({error:'Student, positive value, and height or weight observation type are required'});
  const student=await execQ(pool,`SELECT id FROM school_students WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL`,[appId,studentId]);
  if(!student.length) return res.status(404).json({error:'Student not found'});
  const client=await pool.connect();
  let row;
  try{
    await client.query('BEGIN');
    const inserted=await client.query(`
      INSERT INTO school_health_observations
        (app_id,student_id,observation_type,value,unit,observed_at,observed_by,notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `,[appId,studentId,type,value,text(b.unit)||(type==='height'?'cm':'kg'),day(b.observedAt)||new Date().toISOString().slice(0,10),req.user?.userid||null,text(b.notes)]);
    row=inserted.rows[0];
    await client.query(`
      INSERT INTO school_health_profiles (app_id,student_id,height_cm,weight_kg,bmi)
      VALUES ($1,$2,CASE WHEN $3='height' THEN $4::numeric ELSE NULL END,
        CASE WHEN $3='weight' THEN $4::numeric ELSE NULL END,NULL)
      ON CONFLICT (student_id) DO UPDATE SET
        height_cm=CASE WHEN $3='height' THEN $4::numeric ELSE school_health_profiles.height_cm END,
        weight_kg=CASE WHEN $3='weight' THEN $4::numeric ELSE school_health_profiles.weight_kg END,
        bmi=CASE
          WHEN (CASE WHEN $3='height' THEN $4::numeric ELSE school_health_profiles.height_cm END)>0
           AND (CASE WHEN $3='weight' THEN $4::numeric ELSE school_health_profiles.weight_kg END)>0
          THEN (CASE WHEN $3='weight' THEN $4::numeric ELSE school_health_profiles.weight_kg END)
               / POWER((CASE WHEN $3='height' THEN $4::numeric ELSE school_health_profiles.height_cm END)/100,2)
          ELSE NULL END,
        updated_at=now()
    `,[appId,studentId,type,value]);
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  await writeAudit(pool,appId,req,{module:'health',action:'health.observation.create',recordId:row.id,after:row});
  res.status(201).json({ok:true,observation:row});
}));
schoolStudentsCompleteRouter.get('/health/vaccinations', route(async (req,res)=>{
  if(!guard(req,res,'health.view'))return;
  const appId=appIdOf(req),studentId=num(req.query.studentId);
  const rows=await execQ(getPool(),`
    SELECT v.*,s.first_name,s.last_name
      FROM school_vaccinations v JOIN school_students s ON s.id=v.student_id AND s.app_id=v.app_id
     WHERE v.app_id=$1 AND ($2::int IS NULL OR v.student_id=$2)
     ORDER BY v.vaccination_date DESC,v.id DESC
  `,[appId,studentId]);
  res.json({ok:true,vaccinations:rows});
}));
schoolStudentsCompleteRouter.post('/health/vaccinations', route(async (req,res)=>{
  if(!guard(req,res,'health.manage'))return;
  const pool=getPool(),appId=appIdOf(req),b=req.body||{},studentId=num(b.studentId),vaccineName=text(b.vaccineName);
  if(!studentId||!vaccineName||!day(b.vaccinationDate)) return res.status(400).json({error:'Student, vaccine name, and vaccination date are required'});
  if(text(b.certificateUrl)?.startsWith('/api/school/uploads/')&&!validPrivateUpload(text(b.certificateUrl),text(b.storageKey),appId,'health')) return res.status(400).json({error:'Vaccination certificate upload key is invalid for this school'});
  const student=await execQ(pool,`SELECT id FROM school_students WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL`,[appId,studentId]);
  if(!student.length) return res.status(404).json({error:'Student not found'});
  const [row]=await execQ(pool,`
    INSERT INTO school_vaccinations
      (app_id,student_id,vaccine_name,dose_number,vaccination_date,administered_by,batch_number,certificate_url,next_due_date)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
  `,[appId,studentId,vaccineName,text(b.doseNumber),day(b.vaccinationDate),text(b.administeredBy),text(b.batchNumber),text(b.certificateUrl),day(b.nextDueDate)]);
  await writeAudit(pool,appId,req,{module:'health',action:'health.vaccination.create',recordId:row.id,after:row});
  res.status(201).json({ok:true,vaccination:row});
}));

/* ---------- Discipline ---------- */
schoolStudentsCompleteRouter.get('/discipline/incidents', route(async (req,res)=>{
  if(!guard(req,res,'discipline.view'))return;
  const pool=getPool(); const appId=appIdOf(req); const studentId=num(req.query.studentId);
  const rows = await execQ(pool, `
    SELECT i.* FROM school_discipline_incidents i
     WHERE i.app_id=$1
       AND ($2::int IS NULL OR EXISTS (
         SELECT 1 FROM school_discipline_participants p
          WHERE p.app_id=i.app_id AND p.incident_id=i.id AND p.student_id=$2
       ))
     ORDER BY i.incident_datetime DESC
  `,[appId,studentId]);
  res.json({ok:true,incidents:rows});
}));
schoolStudentsCompleteRouter.post('/discipline/incidents', route(async (req,res)=>{
  if(!guard(req,res,'discipline.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const b=req.body||{};
  const participants=(Array.isArray(b.participants)?b.participants:[])
    .filter((participant)=>participant.studentId!==undefined&&participant.studentId!==null&&participant.studentId!=='')
    .map((participant)=>({studentId:num(participant.studentId),role:text(participant.role)||'Offender',remarks:text(participant.remarks)}));
  if(!text(b.location)||!text(b.reportedBy)||!text(b.incidentType)||!text(b.description)) return res.status(400).json({error:'Location, reporter, incident type, and description are required'});
  if(participants.some((participant)=>!Number.isInteger(participant.studentId)||!['Offender','Victim','Witness','Bystander'].includes(participant.role))) {
    return res.status(400).json({error:'Incident participants must use valid students and roles'});
  }
  if(participants.length){
    const studentIds=[...new Set(participants.map((participant)=>participant.studentId))];
    const found=await execQ(pool,`SELECT id FROM school_students WHERE app_id=$1 AND id=ANY($2::int[]) AND deleted_at IS NULL`,[appId,studentIds]);
    if(found.length!==studentIds.length) return res.status(400).json({error:'One or more selected students are invalid'});
  }
  const client=await pool.connect();
  let row;
  try{
    await client.query('BEGIN');
    const idResult=await client.query(`SELECT nextval(pg_get_serial_sequence('school_discipline_incidents','id')) AS id`);
    const incidentId=Number(idResult.rows[0].id);
    const incidentNo=text(b.incidentNo)||`INC-${new Date().getFullYear()}-${String(incidentId).padStart(6,'0')}`;
    const inserted=await client.query(`
      INSERT INTO school_discipline_incidents
        (id,app_id,incident_no,incident_datetime,location,reported_by,incident_type,severity,
         description,evidence_photos,cctv_clip_url,witness_statements,zero_tolerance,status,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'open',$14) RETURNING *
    `,[incidentId,appId,incidentNo,dt(b.incidentDatetime)||new Date().toISOString(),text(b.location),
      text(b.reportedBy),text(b.incidentType),text(b.severity)||'minor',text(b.description),
      JSON.stringify(b.evidencePhotos||[]),text(b.cctvClipUrl),text(b.witnessStatements),
      b.zeroTolerance===true,req.user?.userid]);
    row=inserted.rows[0];
    for(const participant of participants){
      await client.query(
        `INSERT INTO school_discipline_participants (app_id,incident_id,student_id,role,remarks) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [appId,row.id,participant.studentId,participant.role,participant.remarks],
      );
    }
    await writeAudit(client,appId,req,{module:'discipline',action:'discipline.incident.create',recordId:row.id,after:row});
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  res.json({ok:true,incident:row});
}));
schoolStudentsCompleteRouter.post('/discipline/incidents/:id/actions', route(async (req,res)=>{
  if(!guard(req,res,'discipline.manage'))return;
  const pool=getPool(); const appId=appIdOf(req); const id=num(req.params.id); const b=req.body||{};
  const sd = day(b.startDate), ed = day(b.endDate);
  if(sd&&ed&&ed<sd) return res.status(400).json({error:'End date must be on or after start date'});
  const suspension=String(b.actionType||'').toLowerCase().includes('suspension');
  if(suspension&&(!sd||!ed)) return res.status(400).json({error:'Suspension actions require start and end dates'});
  let days = null;
  if(sd && ed){ const s=new Date(sd), e=new Date(ed); days = Math.max(1, Math.ceil((e-s)/(1000*3600*24))+1); }
  if(days&&days>60) return res.status(400).json({error:'A suspension cannot exceed 60 days'});
  const incident=await execQ(pool,`SELECT id FROM school_discipline_incidents WHERE app_id=$1 AND id=$2`,[appId,id]);
  if(!incident.length) return res.status(404).json({error:'Incident not found'});
  const client=await pool.connect();
  let row;
  try{
    await client.query('BEGIN');
    const inserted=await client.query(
      `INSERT INTO school_discipline_actions (app_id,incident_id,action_type,action_letter_url,start_date,end_date,suspension_days,parent_notified,parent_notified_at,parent_acknowledgement_url,student_apology_url,counselor_note,action_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [appId,id,text(b.actionType),text(b.actionLetterUrl),sd,ed,days,b.parentNotified===true,b.parentNotified===true?new Date().toISOString():null,text(b.parentAcknowledgementUrl),text(b.studentApologyUrl),text(b.counselorNote),req.user?.userid],
    );
    row=inserted.rows[0];
    if(suspension){
      // Old table (backward compat)
      await client.query(`
        INSERT INTO school_attendance (app_id,student_id,attendance_date,status,remarks,marked_by)
        SELECT $1,p.student_id,d::date,'suspended',$4,$5
          FROM school_discipline_participants p
          CROSS JOIN generate_series($2::date,$3::date,interval '1 day') d
         WHERE p.app_id=$1 AND p.incident_id=$6 AND p.role='Offender'
         ON CONFLICT (app_id,student_id,attendance_date) DO NOTHING
      `,[appId,sd,ed,`Suspension under incident ${id}`,req.user?.userid||null,id]);

      // New model: find/created registers and insert entries
      const absentPolicy = await client.query(`
        SELECT id FROM school_attendance_policy WHERE app_id=$1 AND category='absent' AND is_active=true LIMIT 1
      `,[appId]);
      if(absentPolicy.rows[0]){
        const policyId = absentPolicy.rows[0].id;
        const markedBy = req.user?.userid||null;
        const students = await client.query(`
          SELECT DISTINCT p.student_id, s.section_id, s.campus_id
            FROM school_discipline_participants p
            JOIN school_students s ON s.id=p.student_id AND s.app_id=p.app_id
           WHERE p.app_id=$1 AND p.incident_id=$2 AND p.role='Offender'
        `,[appId,id]);
        for(const st of students.rows){
          if(!st.section_id) continue;
          const year = await client.query(`
            SELECT id FROM school_academic_years WHERE app_id=$1 AND $3::date BETWEEN start_date AND end_date
            ORDER BY is_active DESC, start_date DESC LIMIT 1
          `,[appId, ed]);
          const yearId = year.rows[0]?.id;
          if(!yearId) continue;
          for(let d = new Date(sd); d <= new Date(ed); d.setDate(d.getDate()+1)){
            const ds = d.toISOString().slice(0,10);
            const reg = await client.query(`
              INSERT INTO school_attendance_register
                (app_id, academic_year_id, campus_id, section_id, register_date, state, version, created_by)
              VALUES ($1,$2,$6,$3,$4,'finalized',1,$5)
              ON CONFLICT (app_id, academic_year_id, section_id, register_date, COALESCE(session_id,0)) DO NOTHING
              RETURNING id
            `,[appId, yearId, st.section_id, ds, markedBy, st.campus_id ?? null]);
            let regId = reg.rows[0]?.id;
            if(!regId){
              const found = await client.query(`
                SELECT id FROM school_attendance_register
                 WHERE app_id=$1 AND academic_year_id=$2 AND section_id=$3 AND register_date=$4 AND COALESCE(session_id,0)=0
              `,[appId, yearId, st.section_id, ds]);
              regId = found.rows[0]?.id;
            }
            if(regId){
              await client.query(`
                INSERT INTO school_attendance_entry
                  (app_id, register_id, student_id, policy_id, late_minutes, partial_minutes, remark, marked_by)
                VALUES ($1,$2,$3,$4,0,0,$5,$6)
                ON CONFLICT (register_id, student_id) DO NOTHING
              `,[appId, regId, st.student_id, policyId, `Suspension under incident ${id}`, markedBy]);
            }
          }
        }
      }
    }
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  await writeAudit(pool,appId,req,{module:'discipline',action:'discipline.action.create',recordId:row.id,after:row});
  res.json({ok:true,action:row});
}));
schoolStudentsCompleteRouter.get('/discipline/repeat-offenders', route(async (req,res)=>{
  if(!guard(req,res,'discipline.view'))return;
  const rows=await execQ(getPool(),`
    SELECT p.student_id,s.first_name,s.last_name,s.admission_no,count(DISTINCT p.incident_id)::int AS incident_count
      FROM school_discipline_participants p
      JOIN school_students s ON s.id=p.student_id AND s.app_id=p.app_id
     WHERE p.app_id=$1 AND p.role='Offender'
     GROUP BY p.student_id,s.first_name,s.last_name,s.admission_no
    HAVING count(DISTINCT p.incident_id)>=2
     ORDER BY incident_count DESC,s.last_name,s.first_name
  `,[appIdOf(req)]);
  res.json({ok:true,students:rows});
}));
schoolStudentsCompleteRouter.get('/discipline/incidents/:id/evidence', route(async (req,res)=>{
  if(!guard(req,res,'discipline.view'))return;
  const appId=appIdOf(req),id=num(req.params.id);
  const rows=await execQ(getPool(),`SELECT * FROM school_discipline_evidence WHERE app_id=$1 AND incident_id=$2 ORDER BY id DESC`,[appId,id]);
  res.json({ok:true,evidence:rows});
}));
schoolStudentsCompleteRouter.post('/discipline/incidents/:id/evidence', route(async (req,res)=>{
  if(!guard(req,res,'discipline.manage'))return;
  const pool=getPool(),appId=appIdOf(req),id=num(req.params.id),b=req.body||{};
  const incident=await execQ(pool,`SELECT id FROM school_discipline_incidents WHERE app_id=$1 AND id=$2`,[appId,id]);
  if(!incident.length) return res.status(404).json({error:'Incident not found'});
  if(!text(b.fileUrl)||!text(b.storageKey)||!text(b.fileName)) return res.status(400).json({error:'Uploaded evidence file is required'});
  if(!validPrivateUpload(text(b.fileUrl),text(b.storageKey),appId,'discipline')) return res.status(400).json({error:'Evidence upload key is invalid for this school'});
  const [row]=await execQ(pool,`
    INSERT INTO school_discipline_evidence
      (app_id,incident_id,evidence_type,file_name,file_url,storage_key,file_size,mime_type,uploaded_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
  `,[appId,id,text(b.evidenceType)||'document',text(b.fileName),text(b.fileUrl),text(b.storageKey),num(b.fileSize),text(b.mimeType),req.user?.userid||null]);
  await writeAudit(pool,appId,req,{module:'discipline',action:'discipline.evidence.upload',recordId:row.id,after:row});
  res.status(201).json({ok:true,evidence:row});
}));
schoolStudentsCompleteRouter.get('/discipline/appeals', route(async (req,res)=>{
  if(!guard(req,res,'discipline.view'))return;
  const rows=await execQ(getPool(),`
    SELECT a.*,i.incident_no,i.incident_type
      FROM school_discipline_appeals a JOIN school_discipline_incidents i ON i.id=a.incident_id AND i.app_id=a.app_id
     WHERE a.app_id=$1 ORDER BY a.created_at DESC
  `,[appIdOf(req)]);
  res.json({ok:true,appeals:rows});
}));
schoolStudentsCompleteRouter.post('/discipline/incidents/:id/appeals', route(async (req,res)=>{
  if(!guard(req,res,'discipline.manage'))return;
  const pool=getPool(),appId=appIdOf(req),id=num(req.params.id),b=req.body||{};
  const reason=text(b.appealReason);
  if(!reason) return res.status(400).json({error:'Appeal reason is required'});
  const incident=await execQ(pool,`SELECT id FROM school_discipline_incidents WHERE app_id=$1 AND id=$2`,[appId,id]);
  if(!incident.length) return res.status(404).json({error:'Incident not found'});
  if(num(b.actionId)){
    const action=await execQ(pool,`SELECT id FROM school_discipline_actions WHERE app_id=$1 AND incident_id=$2 AND id=$3`,[appId,id,num(b.actionId)]);
    if(!action.length) return res.status(400).json({error:'Action does not belong to this incident'});
  }
  const [row]=await execQ(pool,`
    INSERT INTO school_discipline_appeals (app_id,incident_id,action_id,appeal_reason)
    VALUES ($1,$2,$3,$4) RETURNING *
  `,[appId,id,num(b.actionId),reason]);
  await writeAudit(pool,appId,req,{module:'discipline',action:'discipline.appeal.create',recordId:row.id,after:row});
  res.status(201).json({ok:true,appeal:row});
}));
schoolStudentsCompleteRouter.post('/discipline/appeals/:id/review', route(async (req,res)=>{
  if(!guard(req,res,'discipline.manage'))return;
  const pool=getPool(),appId=appIdOf(req),id=num(req.params.id),b=req.body||{},status=text(b.status);
  if(!['approved','rejected'].includes(status)) return res.status(400).json({error:'Appeal status must be approved or rejected'});
  const [row]=await execQ(pool,`
    UPDATE school_discipline_appeals
       SET appeal_status=$3,reviewed_by=$4,reviewed_at=now(),review_notes=$5
     WHERE app_id=$1 AND id=$2 AND appeal_status='pending' RETURNING *
  `,[appId,id,status,req.user?.userid||null,text(b.reviewNotes)]);
  if(!row) return res.status(404).json({error:'Pending appeal not found'});
  await writeAudit(pool,appId,req,{module:'discipline',action:'discipline.appeal.review',recordId:id,after:row});
  res.json({ok:true,appeal:row});
}));

/* ---------- Missing documents report ---------- */
schoolStudentsCompleteRouter.get('/reports/missing-documents', route(async (req,res)=>{
  if(!guard(req,res,'students.view'))return;
  const pool=getPool(); const appId=appIdOf(req);
  const rows = await execQ(pool, `
    SELECT s.id,s.student_code,s.admission_no,s.first_name,s.last_name,s.class_id,
           c.name class_name,dt.id document_type_id,dt.name document_type
      FROM school_students s
      LEFT JOIN school_classes c ON c.id=s.class_id AND c.app_id=s.app_id
      CROSS JOIN school_document_types dt
     WHERE s.app_id=$1 AND s.status='active' AND s.deleted_at IS NULL
       AND dt.app_id=$1 AND dt.is_mandatory
       AND dt.applicable_to IN ('all','admission')
       AND NOT EXISTS (
         SELECT 1 FROM school_student_documents_enhanced d
          WHERE d.app_id=s.app_id AND d.student_id=s.id
            AND d.document_type_id=dt.id AND d.verification_status='verified'
       )
     ORDER BY s.id,dt.sort_order
  `,[appId]);
  res.json({ok:true,missing:rows});
}));

schoolRouter.use(schoolStudentsCompleteRouter);
