/* ============================================================
   Staff Directory -> Timetable bridge

   The HR & Payroll module owns the staff master in school_staff, while
   Timetable, Attendance, Exams and class-teacher links key off
   school_hr_employees. This migration adds an explicit mapping column and
   backfills it so both modules resolve the same person.

   Safe to re-run: every object uses IF NOT EXISTS and the backfill only
   touches rows that are not mapped yet.
   ============================================================ */

BEGIN;

/* 1. Mapping column: one Staff Directory row -> one operational employee row. */
ALTER TABLE school_staff
  ADD COLUMN IF NOT EXISTS hr_employee_id INT
    REFERENCES school_hr_employees(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_school_staff_hr_employee
  ON school_staff (app_id, hr_employee_id)
  WHERE hr_employee_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_school_staff_hr_employee
  ON school_staff (hr_employee_id);

COMMENT ON COLUMN school_staff.hr_employee_id IS
  'Operational employee row used by Timetable, Attendance, Exams and class-teacher links';

/* 2. Backfill existing mappings by employee code. */
UPDATE school_staff s
   SET hr_employee_id = e.id,
       updated_at = now()
  FROM school_hr_employees e
 WHERE s.hr_employee_id IS NULL
   AND s.deleted_at IS NULL
   AND e.app_id = s.app_id
   AND e.employee_no = s.employee_code;

/* 3. Create the missing operational employee row for any unmapped staff.
   Designation, department and joining date come from the latest employment
   record. Names are split into the first token + remainder because
   school_hr_employees stores first_name and last_name separately. */
WITH latest_employment AS (
  SELECT DISTINCT ON (app_id, staff_id)
         app_id, staff_id, designation, department, joining_date
    FROM school_staff_employment
   WHERE deleted_at IS NULL
   ORDER BY app_id, staff_id, effective_from DESC, id DESC
),
new_employees AS (
  INSERT INTO school_hr_employees
    (app_id, employee_no, first_name, last_name, dob, gender, phone, email,
     designation, department, joining_date, status, salary_basic, user_id)
  SELECT s.app_id,
         s.employee_code,
         split_part(btrim(s.name), ' ', 1),
         NULLIF(btrim(substr(btrim(s.name), length(split_part(btrim(s.name), ' ', 1)) + 1)), ''),
         s.date_of_birth,
         s.gender,
         s.contact_phone,
         s.contact_email,
         le.designation,
         le.department,
         le.joining_date,
         CASE WHEN s.status IN ('active', 'on_leave') THEN 'active' ELSE 'inactive' END,
         0,
         s.user_id
    FROM school_staff s
    LEFT JOIN latest_employment le
      ON le.app_id = s.app_id AND le.staff_id = s.id
   WHERE s.hr_employee_id IS NULL
     AND s.deleted_at IS NULL
   ORDER BY s.id
  RETURNING id, app_id, employee_no
)
UPDATE school_staff s
   SET hr_employee_id = ne.id,
       updated_at = now()
  FROM new_employees ne
 WHERE s.hr_employee_id IS NULL
   AND s.deleted_at IS NULL
   AND s.app_id = ne.app_id
   AND s.employee_code = ne.employee_no;

COMMIT;
