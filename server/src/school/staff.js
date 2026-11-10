import { execQ } from '../db/sp.js';

const text = (v) => (v === null || v === undefined ? '' : String(v).trim());

function splitName(name) {
  const full = text(name).replace(/\s+/g, ' ');
  if (!full) return { firstName: '', lastName: null };
  const idx = full.indexOf(' ');
  if (idx === -1) return { firstName: full, lastName: null };
  return { firstName: full.slice(0, idx), lastName: full.slice(idx + 1) };
}

function employeeStatus(status) {
  return ['inactive', 'exited'].includes(text(status).toLowerCase()) ? 'inactive' : 'active';
}

/* Staff identity resolves to either an HR employee id or a system user
   (tblHO_User.UserId). Both are validated against the active roster so a
   class teacher or subject allocation never stores unvalidated free text. */
export async function resolveTeacher(pool, appId, teacherId) {
  const id = text(teacherId);
  if (!id) return null;
  const [employee] = await execQ(pool, `
    SELECT e.id::text AS id,
           trim(e.first_name || ' ' || coalesce(e.last_name, '')) AS name,
           e.designation,
           s.id AS staff_id
      FROM school_hr_employees e
      LEFT JOIN school_staff s
        ON s.app_id = e.app_id AND s.hr_employee_id = e.id AND s.deleted_at IS NULL
     WHERE e.app_id=$1 AND e.id::text=$2 AND coalesce(e.status, 'active')='active'
  `, [appId, id]);
  if (employee) return { ...employee, employeeId: Number(employee.id), source: 'employee' };
  const [user] = await execQ(pool, `
    SELECT "UserId"::text AS id, "UserName" AS name, "Designation" AS designation
      FROM "tblHO_User"
     WHERE "UserId"::text=$1 AND coalesce("Status", '1')='1'
  `, [id]);
  return user ? { ...user, employeeId: null, source: 'user' } : null;
}

/* Mirror one Staff Directory record into the operational school_hr_employees
   row that Timetable, Attendance, Exams and class-teacher links use. This is
   the single bridge between the HR master (school_staff) and those modules.

   `db` may be a pool or a transaction client. Returns the employee id, or
   null when the staff row does not exist. */
export async function syncStaffToEmployee(db, appId, staffId) {
  const [staff] = await execQ(db, `
    SELECT s.*,
           e.designation, e.department, e.joining_date, e.exit_date
      FROM school_staff s
      LEFT JOIN LATERAL (
        SELECT designation, department, joining_date, exit_date
          FROM school_staff_employment
         WHERE app_id=s.app_id AND staff_id=s.id AND deleted_at IS NULL
         ORDER BY effective_from DESC, id DESC
         LIMIT 1
      ) e ON true
     WHERE s.app_id=$1 AND s.id=$2 AND s.deleted_at IS NULL
  `, [appId, staffId]);
  if (!staff) return null;

  const { firstName, lastName } = splitName(staff.name);
  const status = employeeStatus(staff.status);

  /* Prefer the natural key (employee code) so a stale mapping can never cause
     a duplicate employee_no, then fall back to the explicit mapping. */
  let employee = null;
  if (staff.employee_code) {
    [employee] = await execQ(db,
      'SELECT id FROM school_hr_employees WHERE app_id=$1 AND employee_no=$2',
      [appId, staff.employee_code]);
  }
  if (!employee && staff.hr_employee_id) {
    [employee] = await execQ(db,
      'SELECT id FROM school_hr_employees WHERE app_id=$1 AND id=$2',
      [appId, staff.hr_employee_id]);
  }

  let employeeId;
  if (employee) {
    employeeId = employee.id;
    await execQ(db, `
      UPDATE school_hr_employees
         SET employee_no=$3, first_name=$4, last_name=$5, dob=$6, gender=$7,
             phone=$8, email=$9, designation=$10, department=$11,
             joining_date=$12, status=$13, user_id=$14
       WHERE app_id=$1 AND id=$2
    `, [appId, employeeId, staff.employee_code, firstName, lastName, staff.date_of_birth,
        staff.gender, staff.contact_phone, staff.contact_email, staff.designation,
        staff.department, staff.joining_date, status, staff.user_id || null]);
  } else {
    const [created] = await execQ(db, `
      INSERT INTO school_hr_employees
        (app_id, employee_no, first_name, last_name, dob, gender, phone, email,
         designation, department, joining_date, status, salary_basic, user_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,0,$13)
      RETURNING id
    `, [appId, staff.employee_code, firstName, lastName, staff.date_of_birth,
        staff.gender, staff.contact_phone, staff.contact_email, staff.designation,
        staff.department, staff.joining_date, status, staff.user_id || null]);
    employeeId = created.id;
  }

  if (Number(staff.hr_employee_id) !== Number(employeeId)) {
    await execQ(db, `
      UPDATE school_staff SET hr_employee_id=$3, updated_at=now()
       WHERE app_id=$1 AND id=$2
    `, [appId, staffId, employeeId]);
  }

  return employeeId;
}

/* Soft-deleting a staff record must not delete the employee row: timetable
   history and attendance still reference it. Deactivate it instead so it
   disappears from teacher dropdowns. */
export async function deactivateStaffEmployee(db, appId, staffId) {
  await execQ(db, `
    UPDATE school_hr_employees
       SET status='inactive'
     WHERE app_id=$1
       AND id=(SELECT hr_employee_id FROM school_staff WHERE app_id=$1 AND id=$2)
  `, [appId, staffId]);
}
