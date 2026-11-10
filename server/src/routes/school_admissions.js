import { getPool } from '../db/pool.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { schoolRouter } from './school.js';

const appIdOf = (req) => req.user?.company || DEFAULT_COMPANY_ID;
const value = (input) => (input === undefined || input === null ? '' : String(input).trim());
const date = (input) => (value(input) ? value(input).slice(0, 10) : null);
const integer = (input) => (input === undefined || input === null || input === '' ? null : Number(input));
const hasPermission = (req, permission) => {
  const permissions = req.school?.permissions || [];
  return req.school?.isSuper || permissions.includes('*') || permissions.includes(permission);
};

function guard(req, res, permission) {
  if (hasPermission(req, permission)) return true;
  res.status(403).json({ error: 'You do not have permission for this action' });
  return false;
}

function route(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
}

async function audit(client, req, appId, entity, entityId, action, details = {}) {
  await client.query(
    `INSERT INTO school_audit_events
       (app_id, actor_id, actor_name, entity, entity_id, action, module, changes_json, ip_address, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,'admission',$7::jsonb,$8,$9)`,
    [
      appId,
      value(req.user?.userid) || null,
      value(req.user?.name) || null,
      entity,
      String(entityId),
      action,
      JSON.stringify(details),
      req.ip || null,
      req.headers['user-agent'] || null,
    ],
  );
}

async function nextCode(client, table, prefix) {
  const sequence = await client.query(
    `SELECT nextval(pg_get_serial_sequence($1, 'id')) AS id`,
    [table],
  );
  const id = Number(sequence.rows[0].id);
  return { id, code: `${prefix}-${new Date().getFullYear()}-${String(id).padStart(6, '0')}` };
}

const editableApplicationFields = {
  classApplied: ['class_applied', integer],
  studentFirstName: ['student_first_name', value],
  studentMiddleName: ['student_middle_name', value],
  studentLastName: ['student_last_name', value],
  officialName: ['official_name', value],
  dob: ['dob', date],
  gender: ['gender', value],
  bloodGroup: ['blood_group', value],
  nationality: ['nationality', value],
  religion: ['religion', value],
  category: ['category', value],
  motherTongue: ['mother_tongue', value],
  birthCertificateNo: ['birth_certificate_no', value],
  birthCertificateUrl: ['birth_certificate_url', value],
  tcUrl: ['tc_url', value],
  reportCardUrl: ['report_card_url', value],
  addressProofUrl: ['address_proof_url', value],
  studentPhotoUrl: ['student_photo_url', value],
  parentPhotoUrl: ['parent_photo_url', value],
  parentSignatureUrl: ['parent_signature_url', value],
  declarationFormUrl: ['declaration_form_url', value],
  previousSchool: ['previous_school', value],
  lastClassPassed: ['last_class_passed', value],
  applicationFeeAmount: ['application_fee_amount', integer],
  applicationFeePaid: ['application_fee_paid', (v) => v === true || v === 'true'],
  applicationFeeReceiptNo: ['application_fee_receipt_no', value],
  applicationFeeDate: ['application_fee_date', date],
  interviewScore: ['interview_score', integer],
  fatherName: ['father_name', value],
  fatherOccupation: ['father_occupation', value],
  fatherContact: ['father_contact', value],
  fatherEmail: ['father_email', value],
  motherName: ['mother_name', value],
  motherOccupation: ['mother_occupation', value],
  motherContact: ['mother_contact', value],
  motherEmail: ['mother_email', value],
  guardianName: ['guardian_name', value],
  guardianRelation: ['guardian_relation', value],
  guardianContact: ['guardian_contact', value],
  currentAddress: ['current_address', value],
  permanentAddress: ['permanent_address', value],
  transportNeeded: ['transport_needed', (v) => v === true],
  remarks: ['remarks', value],
};

schoolRouter.post('/admissions/inquiries', route(async (req, res) => {
  if (!guard(req, res, 'admission.manage')) return;
  const body = req.body || {};
  const parentContact = value(body.parentContact);
  if (!parentContact) return res.status(400).json({ error: 'Parent contact is required' });

  const pool = getPool();
  const appId = appIdOf(req);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id, code } = await nextCode(client, 'school_inquiries', 'INQ');
    const inserted = await client.query(
      `INSERT INTO school_inquiries
         (id, app_id, inquiry_no, inquiry_date, inquiry_source, class_interested, parent_contact,
          parent_name, student_first_name, student_last_name, follow_up_date, inquiry_status,
          remarks, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'new',$12,$13)
       RETURNING *`,
      [
        id, appId, code, date(body.inquiryDate) || new Date().toISOString().slice(0, 10),
        value(body.inquirySource) || 'Walk-in', integer(body.classInterested), parentContact,
        value(body.parentName) || null, value(body.studentFirstName) || null,
        value(body.studentLastName) || null, date(body.followUpDate),
        value(body.remarks) || null, value(req.user?.userid) || null,
      ],
    );
    await audit(client, req, appId, 'school_inquiries', id, 'inquiry.create');
    await client.query('COMMIT');
    res.status(201).json({ ok: true, inquiry: inserted.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

schoolRouter.get('/admissions/inquiries', route(async (req, res) => {
  if (!guard(req, res, 'admission.view')) return;
  const result = await getPool().query(
    `SELECT i.*, c.name AS class_name
       FROM school_inquiries i
       LEFT JOIN school_classes c ON c.id=i.class_interested AND c.app_id=i.app_id
      WHERE i.app_id=$1
      ORDER BY i.created_at DESC
      LIMIT 500`,
    [appIdOf(req)],
  );
  res.json({ ok: true, inquiries: result.rows });
}));

schoolRouter.put('/admissions/inquiries/:id', route(async (req, res) => {
  if (!guard(req, res, 'admission.manage')) return;
  const appId = appIdOf(req);
  const body = req.body || {};
  const status = value(body.status);
  if (!['new', 'contacted', 'application', 'lost', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid inquiry status' });
  }
  if (status === 'lost' && !value(body.lostReason)) {
    return res.status(400).json({ error: 'A lost reason is required' });
  }
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE school_inquiries
          SET inquiry_status=$3, lost_reason=$4, follow_up_date=$5,
              assigned_to=$6, remarks=COALESCE($7,remarks), updated_at=now()
        WHERE app_id=$1 AND id=$2
        RETURNING *`,
      [
        appId, integer(req.params.id), status, value(body.lostReason) || null,
        date(body.followUpDate), value(body.assignedTo) || null,
        value(body.remarks) || null,
      ],
    );
    if (!updated.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Inquiry not found' });
    }
    await audit(client, req, appId, 'school_inquiries', req.params.id, 'inquiry.update', { status });
    await client.query('COMMIT');
    res.json({ ok: true, inquiry: updated.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

schoolRouter.get('/admissions/applications', route(async (req, res) => {
  if (!guard(req, res, 'admission.view')) return;
  const result = await getPool().query(
    `SELECT a.*, i.inquiry_no
       FROM school_applications a
    LEFT JOIN school_inquiries i ON i.id=a.school_inquiry_id AND i.app_id=a.app_id
      WHERE a.app_id=$1
      ORDER BY a.created_at DESC
      LIMIT 500`,
    [appIdOf(req)],
  );
  res.json({ ok: true, applications: result.rows });
}));

schoolRouter.post('/admissions/applications', route(async (req, res) => {
  if (!guard(req, res, 'admission.manage')) return;
  const appId = appIdOf(req);
  const inquiryId = integer(req.body?.inquiryId);
  if (!inquiryId) return res.status(400).json({ error: 'Inquiry is required' });
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inquiryResult = await client.query(
      `SELECT * FROM school_inquiries WHERE app_id=$1 AND id=$2 FOR UPDATE`,
      [appId, inquiryId],
    );
    const inquiry = inquiryResult.rows[0];
    if (!inquiry) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Inquiry not found' });
    }
    if (inquiry.inquiry_status === 'lost' || inquiry.inquiry_status === 'closed') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Closed or lost inquiries cannot become applications' });
    }
    const existing = await client.query(
      `SELECT id FROM school_applications WHERE app_id=$1 AND school_inquiry_id=$2 LIMIT 1`,
      [appId, inquiryId],
    );
    if (existing.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'An application already exists for this inquiry' });
    }

    const { id, code } = await nextCode(client, 'school_applications', 'APP');
    const firstName = inquiry.student_first_name || '';
    const lastName = inquiry.student_last_name || '';
    const inserted = await client.query(
      `INSERT INTO school_applications
         (id, app_id, school_inquiry_id, application_no, application_date, class_applied,
          first_name, last_name, student_first_name, student_last_name, official_name,
          phone, guardian_contact, application_status, status)
       VALUES ($1,$2,$3,$4,current_date,$5,$6,$7,$6,$7,$8,$9,$9,'draft','draft')
       RETURNING *`,
      [
        id, appId, inquiryId, code, inquiry.class_interested, firstName, lastName,
        [firstName, lastName].filter(Boolean).join(' '),
        inquiry.parent_contact,
      ],
    );
    await client.query(
      `UPDATE school_inquiries SET inquiry_status='application', updated_at=now()
        WHERE app_id=$1 AND id=$2`,
      [appId, inquiryId],
    );
    await audit(client, req, appId, 'school_applications', id, 'application.create');
    await client.query('COMMIT');
    res.status(201).json({ ok: true, application: inserted.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

schoolRouter.put('/admissions/applications/:id', route(async (req, res) => {
  if (!guard(req, res, 'admission.manage')) return;
  const appId = appIdOf(req);
  const fields = Object.entries(editableApplicationFields)
    .filter(([key]) => Object.hasOwn(req.body || {}, key));
  if (!fields.length) return res.status(400).json({ error: 'No editable application fields supplied' });
  for (const [key, [, convert]] of fields) {
    if (!['applicationFeeAmount', 'interviewScore'].includes(key)) continue;
    const raw = req.body[key];
    if (raw === '' || raw === null) continue;
    const numeric = convert(raw);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return res.status(400).json({ error: `${key} must be a non-negative number` });
    }
  }
  for (const [key] of fields) {
    if (!key.endsWith('Url') && !key.endsWith('PhotoUrl') && !key.endsWith('SignatureUrl')) continue;
    const url = value(req.body[key]);
    if (!url) continue;
    if (!/^https:\/\/[^\s]+$/i.test(url) && !url.startsWith('/api/school/uploads/')) {
      return res.status(400).json({ error: 'Application files must use HTTPS or a protected school upload' });
    }
    if (url.startsWith('/api/school/uploads/')) {
      const keyPath = url.slice('/api/school/uploads/'.length);
      const context = ['studentPhotoUrl', 'parentPhotoUrl'].includes(key) ? 'application-photo'
        : key === 'parentSignatureUrl' ? 'application-signature' : 'application';
      if (!keyPath.startsWith(`${appId}/`) || !new RegExp(`^${appId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/\\d{4}/${context}/[0-9a-f-]{36}\\.(pdf|jpg|png|webp)$`, 'i').test(keyPath)) {
        return res.status(400).json({ error: 'Application upload must belong to this school and application context' });
      }
    }
  }
  const assignments = fields.map(([key, [column]], index) => `${column}=$${index + 3}`);
  const values = fields.map(([key, [, convert]]) => {
    const raw = req.body[key];
    return convert === value && raw === '' ? null : convert(raw);
  });
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE school_applications
          SET ${assignments.join(',')}, first_name=COALESCE($${values.length + 3},first_name),
              last_name=COALESCE($${values.length + 4},last_name),
              phone=COALESCE($${values.length + 5},phone),
              updated_at=now()
        WHERE app_id=$1 AND id=$2 AND application_status='draft' AND status='draft'
        RETURNING *`,
      [
        appId, integer(req.params.id), ...values,
        req.body?.studentFirstName ? value(req.body.studentFirstName) : null,
        req.body?.studentLastName ? value(req.body.studentLastName) : null,
        req.body?.guardianContact ? value(req.body.guardianContact) : null,
      ],
    );
    if (!updated.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Draft application not found or no longer editable' });
    }
    await audit(client, req, appId, 'school_applications', req.params.id, 'application.update');
    await client.query('COMMIT');
    res.json({ ok: true, application: updated.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

schoolRouter.post('/admissions/applications/:id/submit', route(async (req, res) => {
  if (!guard(req, res, 'admission.manage')) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const updated = await pool.query(
    `UPDATE school_applications
        SET application_status='submitted', status='submitted', updated_at=now()
      WHERE app_id=$1 AND id=$2 AND application_status='draft' AND status='draft'
        AND class_applied IS NOT NULL
        AND NULLIF(trim(student_first_name),'') IS NOT NULL
        AND NULLIF(trim(student_last_name),'') IS NOT NULL
        AND NULLIF(trim(official_name),'') IS NOT NULL
        AND dob IS NOT NULL AND NULLIF(trim(gender),'') IS NOT NULL
        AND COALESCE(NULLIF(trim(guardian_contact),''), NULLIF(trim(phone),'')) IS NOT NULL
      RETURNING *`,
    [appId, integer(req.params.id)],
  );
  if (!updated.rows[0]) {
    return res.status(409).json({
      error: 'Application must be a draft with class, student name, official name, date of birth, gender, and parent contact',
    });
  }
  await pool.query(
    `INSERT INTO school_audit_events (app_id,actor_id,entity,entity_id,action,module)
     VALUES ($1,$2,'school_applications',$3,'application.submit','admission')`,
    [appId, value(req.user?.userid) || null, String(req.params.id)],
  );
  res.json({ ok: true, application: updated.rows[0] });
}));

schoolRouter.post('/admissions/applications/:id/approve', route(async (req, res) => {
  if (!guard(req, res, 'admission.manage')) return;
  const appId = appIdOf(req);
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const applicationResult = await client.query(
      `SELECT * FROM school_applications WHERE app_id=$1 AND id=$2 FOR UPDATE`,
      [appId, integer(req.params.id)],
    );
    const application = applicationResult.rows[0];
    if (!application) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Application not found' });
    }
    if (application.application_status === 'enrolled' && application.student_id) {
      await client.query('COMMIT');
      return res.json({ ok: true, studentId: application.student_id, alreadyEnrolled: true });
    }
    if (application.application_status !== 'submitted') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Only submitted applications can be approved' });
    }

    const duplicate = await client.query(
      `SELECT id FROM school_students
        WHERE app_id=$1 AND deleted_at IS NULL AND
          (($2::text IS NOT NULL AND birth_certificate_no=$2)
           OR (lower(coalesce(name_as_per_certificate,official_name,first_name))=lower($3)
               AND dob=$4::date))
        LIMIT 1`,
      [
        appId, application.birth_certificate_no || null,
        application.official_name, application.dob,
      ],
    );
    if (duplicate.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'A student with the same birth certificate or official name and date of birth already exists' });
    }

    const classResult = await client.query(
      `SELECT id FROM school_classes WHERE app_id=$1 AND id=$2`,
      [appId, application.class_applied],
    );
    if (!classResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Selected class is not available' });
    }
    const sectionId = integer(req.body?.sectionId);
    if (sectionId) {
      const sectionResult = await client.query(
        `SELECT id FROM school_sections WHERE app_id=$1 AND class_id=$2 AND id=$3`,
        [appId, application.class_applied, sectionId],
      );
      if (!sectionResult.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Selected section does not belong to the application class' });
      }
    }
    const yearResult = await client.query(
      `SELECT id FROM school_academic_years WHERE app_id=$1
        ORDER BY is_active DESC, start_date DESC LIMIT 1`,
      [appId],
    );
    if (!yearResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Create an academic year before approving an application' });
    }

    const { id: studentId } = await nextCode(client, 'school_students', 'ADM');
    const year = new Date().getFullYear();
    const admissionNo = `ADM-${year}-${String(studentId).padStart(6, '0')}`;
    const studentCode = `STU-${year}-${String(studentId).padStart(6, '0')}`;
    const studentResult = await client.query(
      `INSERT INTO school_students
         (id,app_id,student_code,admission_no,first_name,middle_name,last_name,
          official_name,name_as_per_certificate,dob,gender,blood_group,nationality,religion,
          category,mother_tongue,birth_certificate_no,previous_school,father_name,
          father_occupation,father_contact,father_email,mother_name,mother_occupation,
          mother_contact,mother_email,guardian_name,guardian_phone,address,permanent_address,
          class_id,section_id,transport_required,campus_id,photo_url,status,admission_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
              $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,'active',current_date)
       RETURNING id, admission_no, student_code`,
      [
        studentId, appId, studentCode, admissionNo,
        application.student_first_name, application.student_middle_name || null,
        application.student_last_name, application.official_name, application.dob,
        application.gender, application.blood_group, application.nationality,
        application.religion, application.category, application.mother_tongue,
        application.birth_certificate_no, application.previous_school,
        application.father_name, application.father_occupation,
        application.father_contact, application.father_email, application.mother_name,
        application.mother_occupation, application.mother_contact,
        application.mother_email, application.guardian_name,
        application.guardian_contact || application.phone, application.current_address,
        application.permanent_address, application.class_applied, sectionId,
        application.transport_needed === true, req.school?.defaultCampusId || null,
        application.student_photo_url || null,
      ],
    );
    const student = studentResult.rows[0];
    if (application.guardian_name) {
      const guardianPhone = application.guardian_contact || application.phone || null;
      const guardianFound = guardianPhone
        ? await client.query(
          `SELECT * FROM school_guardians WHERE app_id=$1 AND phone=$2 ORDER BY id LIMIT 1 FOR UPDATE`,
          [appId, guardianPhone],
        )
        : { rows: [] };
      let guardian = guardianFound.rows[0];
      if (guardian) {
        const updatedGuardian = await client.query(
          `UPDATE school_guardians
              SET name=$3, relation=$4, updated_at=now()
            WHERE app_id=$1 AND id=$2 RETURNING *`,
          [appId, guardian.id, application.guardian_name, application.guardian_relation || 'Parent'],
        );
        guardian = updatedGuardian.rows[0];
      } else {
        const insertedGuardian = await client.query(
          `INSERT INTO school_guardians (app_id,name,relation,phone,email,address)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [
            appId, application.guardian_name, application.guardian_relation || 'Parent',
            guardianPhone, application.email || application.father_email || null,
            application.current_address || null,
          ],
        );
        guardian = insertedGuardian.rows[0];
      }
      let familyId = guardian.family_id;
      if (!familyId) {
        const family = await client.query(
          `INSERT INTO school_families (app_id,name,primary_guardian_id)
           VALUES ($1,$2,$3) RETURNING id`,
          [appId, `${application.guardian_name} family`, guardian.id],
        );
        familyId = family.rows[0].id;
        await client.query(
          `UPDATE school_guardians SET family_id=$3 WHERE app_id=$1 AND id=$2`,
          [appId, guardian.id, familyId],
        );
      }
      await client.query(
        `INSERT INTO school_student_guardians
           (student_id,guardian_id,relation,is_primary,is_emergency,can_pickup,is_fee_payer)
         VALUES ($1,$2,$3,true,true,true,true)
         ON CONFLICT (student_id,guardian_id) DO NOTHING`,
        [student.id, guardian.id, application.guardian_relation || 'Parent'],
      );
      await client.query(
        `UPDATE school_students SET family_id=$3 WHERE app_id=$1 AND id=$2`,
        [appId, student.id, familyId],
      );
    }
    await client.query(
      `INSERT INTO school_student_enrollments
         (app_id,student_id,academic_year_id,class_id,section_id,status,joined_on)
       VALUES ($1,$2,$3,$4,$5,'studying',current_date)
       ON CONFLICT (app_id,student_id,academic_year_id) DO NOTHING`,
      [appId, student.id, yearResult.rows[0].id, application.class_applied, sectionId],
    );
    await client.query(
      `INSERT INTO school_admissions
         (app_id,application_id,student_id,admission_no,academic_year_id,class_id,section_id,approved_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        appId, application.id, student.id, admissionNo, yearResult.rows[0].id,
        application.class_applied, sectionId, value(req.user?.userid) || null,
      ],
    );
    await client.query(
      `UPDATE school_applications SET application_status='enrolled',status='admitted',
          student_id=$3,approved_by=$4,approved_at=now(),enrolled_at=now(),updated_at=now()
        WHERE app_id=$1 AND id=$2`,
      [appId, application.id, student.id, value(req.user?.userid) || null],
    );
    await audit(client, req, appId, 'school_applications', application.id, 'application.approve', {
      studentId: student.id,
    });
    await client.query('COMMIT');
    res.json({ ok: true, student });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

schoolRouter.post('/admissions/applications/:id/reject', route(async (req, res) => {
  if (!guard(req, res, 'admission.manage')) return;
  const reason = value(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'A rejection reason is required' });
  const pool = getPool();
  const result = await pool.query(
    `UPDATE school_applications SET application_status='rejected',status='rejected',
        rejection_reason=$3,updated_at=now()
      WHERE app_id=$1 AND id=$2 AND application_status='submitted'
      RETURNING *`,
    [appIdOf(req), integer(req.params.id), reason],
  );
  if (!result.rows[0]) return res.status(409).json({ error: 'Only submitted applications can be rejected' });
  await pool.query(
    `INSERT INTO school_audit_events
       (app_id,actor_id,entity,entity_id,action,module,changes_json)
     VALUES ($1,$2,'school_applications',$3,'application.reject','admission',$4::jsonb)`,
    [
      appIdOf(req), value(req.user?.userid) || null, String(req.params.id),
      JSON.stringify({ rejectionReason: reason }),
    ],
  );
  res.json({ ok: true, application: result.rows[0] });
}));

schoolRouter.post('/admissions/applications/:id/waitlist', route(async (req, res) => {
  if (!guard(req, res, 'admission.manage')) return;
  const appId = appIdOf(req);
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${appId}:admission-waitlist`]);
    const next = await client.query(
      `SELECT COALESCE(MAX(waitlist_number),0)+1 AS n FROM school_applications
        WHERE app_id=$1 AND application_status='waitlisted'`,
      [appId],
    );
    const result = await client.query(
      `UPDATE school_applications SET application_status='waitlisted',status='waitlisted',
          waitlist_number=$3,updated_at=now()
        WHERE app_id=$1 AND id=$2 AND application_status='submitted'
        RETURNING *`,
      [appId, integer(req.params.id), next.rows[0].n],
    );
    if (!result.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Only submitted applications can be waitlisted' });
    }
    await audit(client, req, appId, 'school_applications', req.params.id, 'application.waitlist', {
      waitlistNumber: result.rows[0].waitlist_number,
    });
    await client.query('COMMIT');
    res.json({ ok: true, application: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));
