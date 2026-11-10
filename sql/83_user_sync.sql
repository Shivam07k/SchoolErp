-- ============================================================
-- User Auto-Creation for Students & Staff
-- Adds user_id linkage and creates student/staff roles
-- ============================================================

-- Add user_id to students
ALTER TABLE school_students 
ADD COLUMN IF NOT EXISTS user_id INT REFERENCES school_users(id) ON DELETE SET NULL;

ALTER TABLE school_students 
ADD COLUMN IF NOT EXISTS user_created_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_school_students_user ON school_students (user_id) WHERE user_id IS NOT NULL;

-- Add user_id to staff
ALTER TABLE school_staff 
ADD COLUMN IF NOT EXISTS user_id INT REFERENCES school_users(id) ON DELETE SET NULL;

ALTER TABLE school_staff 
ADD COLUMN IF NOT EXISTS user_created_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_school_staff_user ON school_staff (user_id) WHERE user_id IS NOT NULL;

-- Create student and staff roles
INSERT INTO school_roles (app_id, name, code, description, is_system)
VALUES 
  ('default', 'Student', 'student', 'Student portal access', true),
  ('default', 'Staff', 'staff', 'Staff portal access', true)
ON CONFLICT (app_id, code) DO NOTHING;

-- Grant basic permissions to student role
INSERT INTO school_role_permissions (role_id, permission_key, scope)
SELECT r.id, p.key, 'campus'
FROM school_roles r
JOIN school_permissions p ON p.module IN ('student', 'attendance', 'fees', 'exam', 'lms', 'events', 'certificates')
WHERE r.code = 'student' AND r.app_id = 'default'
ON CONFLICT DO NOTHING;

-- Grant basic permissions to staff role
INSERT INTO school_role_permissions (role_id, permission_key, scope)
SELECT r.id, p.key, 'campus'
FROM school_roles r
JOIN school_permissions p ON p.module IN ('student', 'attendance', 'fees', 'exam', 'lms', 'events', 'certificates', 'timetable', 'academics', 'hr')
WHERE r.code = 'staff' AND r.app_id = 'default'
ON CONFLICT DO NOTHING;

-- ============================================================
-- Sync Functions
-- ============================================================

-- Helper: Get role ID by code
CREATE OR REPLACE FUNCTION get_role_id(p_app_id TEXT, p_code TEXT)
RETURNS INT AS $$
DECLARE v_id INT;
BEGIN
  SELECT id INTO v_id FROM school_roles WHERE app_id = p_app_id AND code = p_code LIMIT 1;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Helper: Generate student username
CREATE OR REPLACE FUNCTION gen_student_username(p_admission_no TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN 'student_' || p_admission_no;
END;
$$ LANGUAGE plpgsql;

-- Helper: Generate staff username
CREATE OR REPLACE FUNCTION gen_staff_username(p_employee_id TEXT, p_id INT)
RETURNS TEXT AS $$
BEGIN
  IF p_employee_id IS NOT NULL AND p_employee_id <> '' THEN
    RETURN 'staff_' || p_employee_id;
  END IF;
  RETURN 'staff_' || p_id;
END;
$$ LANGUAGE plpgsql;

-- Helper: DOB to DDMMYYYY password
CREATE OR REPLACE FUNCTION dob_to_password(p_dob DATE)
RETURNS TEXT AS $$
BEGIN
  IF p_dob IS NULL THEN RETURN NULL; END IF;
  RETURN to_char(p_dob, 'DDMMYYYY');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Sync Student User
-- ============================================================
CREATE OR REPLACE FUNCTION sync_student_user(
  p_app_id TEXT,
  p_student_id INT,
  p_actor TEXT DEFAULT 'SYSTEM'
)
RETURNS INT AS $$
DECLARE
  v_student RECORD;
  v_username TEXT;
  v_password TEXT;
  v_role_id INT;
  v_user_id INT;
  v_existing_user RECORD;
BEGIN
  -- Get student data
  SELECT * INTO v_student 
  FROM school_students 
  WHERE app_id = p_app_id AND id = p_student_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found';
  END IF;
  
  v_username := gen_student_username(v_student.admission_no);
  v_password := dob_to_password(v_student.dob);
  v_role_id := get_role_id(p_app_id, 'student');
  
  -- Check if user already exists
  SELECT * INTO v_existing_user
  FROM school_users
  WHERE app_id = p_app_id AND user_id = v_username
  LIMIT 1;
  
  IF FOUND THEN
    -- Update existing user
    UPDATE school_users SET
      name = v_student.first_name || ' ' || v_student.last_name,
      email = v_student.guardian_email,
      phone = v_student.guardian_phone,
      status = v_student.status,
      campus_id = v_student.campus_id,
      updated_at = now()
    WHERE id = v_existing_user.id
    RETURNING id INTO v_user_id;
    
    -- Ensure role assignment
    INSERT INTO school_user_roles (app_id, user_id, role_id, assigned_by)
    VALUES (p_app_id, v_existing_user.id, v_role_id, 'SYSTEM')
    ON CONFLICT (app_id, user_id, role_id) DO NOTHING;
    
    RETURN v_existing_user.id;
  ELSE
    -- Create new user
    INSERT INTO school_users (
      app_id, user_id, name, email, phone, password_hash, 
      status, campus_id, created_by
    ) VALUES (
      p_app_id, gen_student_username(v_student.admission_no),
      v_student.first_name || ' ' || v_student.last_name,
      v_student.guardian_email,
      v_student.guardian_phone,
      v_password,
      v_student.status,
      v_student.campus_id,
      'SYSTEM'
    ) RETURNING id INTO v_user_id;
    
    INSERT INTO school_user_roles (app_id, user_id, role_id, assigned_by)
    VALUES (p_app_id, v_user_id, v_role_id, 'SYSTEM');
    
    RETURN v_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Sync Staff User
-- ============================================================
CREATE OR REPLACE FUNCTION sync_staff_user(
  p_app_id TEXT,
  p_staff_id INT,
  p_actor TEXT DEFAULT 'SYSTEM'
)
RETURNS INT AS $$
DECLARE
  v_staff RECORD;
  v_username TEXT;
  v_password TEXT;
  v_role_id INT;
  v_user_id INT;
  v_existing_user RECORD;
BEGIN
  -- Get staff data
  SELECT * INTO v_staff 
  FROM school_staff 
  WHERE app_id = p_app_id AND id = p_staff_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff not found';
  END IF;
  
  -- Generate username from employee_id or id
  v_username := CASE 
    WHEN v_staff.employee_id IS NOT NULL AND v_staff.employee_id <> '' 
    THEN 'staff_' || v_staff.employee_id 
    ELSE 'staff_' || v_staff.id 
  END;
  
  v_password := dob_to_password(v_staff.dob);
  v_role_id := get_role_id(p_app_id, 'staff');
  
  -- Check if user already exists
  SELECT * INTO v_existing_user
  FROM school_users
  WHERE app_id = p_app_id AND user_id = v_username
  LIMIT 1;
  
  IF FOUND THEN
    -- Update existing user
    UPDATE school_users SET
      name = v_staff.name,
      email = v_staff.email,
      phone = v_staff.phone,
      status = v_staff.status,
      campus_id = v_staff.campus_id,
      updated_at = now()
    WHERE id = v_existing_user.id
    RETURNING id INTO v_user_id;
    
    INSERT INTO school_user_roles (app_id, user_id, role_id, assigned_by)
    VALUES (p_app_id, v_existing_user.id, v_role_id, 'SYSTEM')
    ON CONFLICT (app_id, user_id, role_id) DO NOTHING;
    
    RETURN v_existing_user.id;
  ELSE
    INSERT INTO school_users (
      app_id, user_id, name, email, phone, password_hash,
      status, campus_id, created_by
    ) VALUES (
      p_app_id, v_username,
      v_staff.name,
      v_staff.email,
      v_staff.phone,
      v_password,
      v_staff.status,
      v_staff.campus_id,
      'SYSTEM'
    ) RETURNING id INTO v_user_id;
    
    INSERT INTO school_user_roles (app_id, user_id, role_id, assigned_by)
    VALUES (p_app_id, v_user_id, v_role_id, 'SYSTEM');
    
    RETURN v_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Trigger Functions
-- ============================================================

-- Trigger: After student insert/update
CREATE OR REPLACE FUNCTION trg_student_user_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM sync_student_user(NEW.app_id, NEW.id, COALESCE(current_setting('app.current_user', true), 'SYSTEM'));
    
    -- Update user_id on student record
    UPDATE school_students 
    SET user_id = (SELECT id FROM school_users WHERE app_id = NEW.app_id AND user_id = gen_student_username(NEW.admission_no))
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: After staff insert/update
CREATE OR REPLACE FUNCTION trg_staff_user_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM sync_staff_user(NEW.app_id, NEW.id, COALESCE(current_setting('app.current_user', true), 'SYSTEM'));
    
    UPDATE school_staff 
    SET user_id = (
      SELECT id FROM school_users 
      WHERE app_id = NEW.app_id 
      AND user_id = CASE 
        WHEN NEW.employee_id IS NOT NULL AND NEW.employee_id <> '' 
        THEN 'staff_' || NEW.employee_id 
        ELSE 'staff_' || NEW.id 
      END
    )
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers
DROP TRIGGER IF EXISTS trg_student_user_sync ON school_students;
CREATE TRIGGER trg_student_user_sync
AFTER INSERT OR UPDATE ON school_students
FOR EACH ROW EXECUTE FUNCTION trg_student_user_sync();

DROP TRIGGER IF EXISTS trg_staff_user_sync ON school_staff;
CREATE TRIGGER trg_staff_user_sync
AFTER INSERT OR UPDATE ON school_staff
FOR EACH ROW EXECUTE FUNCTION trg_staff_user_sync();

-- ============================================================
-- Bulk Sync Functions (for manual/initial sync)
-- ============================================================

-- Sync all students
CREATE OR REPLACE FUNCTION sync_all_students(p_app_id TEXT, p_actor TEXT DEFAULT 'SYSTEM')
RETURNS TABLE(student_id INT, user_id INT, username TEXT) AS $$
DECLARE
  v_student RECORD;
BEGIN
  FOR v_student IN 
    SELECT id, admission_no FROM school_students WHERE app_id = p_app_id AND deleted_at IS NULL
  LOOP
    PERFORM sync_student_user(p_app_id, v_student.id, p_actor);
    RETURN QUERY SELECT v_student.id, u.id, u.user_id
    FROM school_users u
    WHERE u.app_id = p_app_id AND u.user_id = gen_student_username(v_student.admission_no);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Sync all staff
CREATE OR REPLACE FUNCTION sync_all_staff(p_app_id TEXT, p_actor TEXT DEFAULT 'SYSTEM')
RETURNS TABLE(staff_id INT, user_id INT, username TEXT) AS $$
DECLARE
  v_staff RECORD;
  v_username TEXT;
BEGIN
  FOR v_staff IN 
    SELECT id, employee_code FROM school_staff WHERE app_id = p_app_id AND deleted_at IS NULL
  LOOP
    PERFORM sync_staff_user(p_app_id, v_staff.id, p_actor);
    v_username := CASE 
      WHEN v_staff.employee_code IS NOT NULL AND v_staff.employee_code <> '' 
      THEN 'staff_' || v_staff.employee_code 
      ELSE 'staff_' || v_staff.id 
    END;
    RETURN QUERY SELECT v_staff.id, u.id, u.user_id
    FROM school_users u
    WHERE u.app_id = p_app_id AND u.user_id = v_username;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Initial Bulk Sync (run once after migration)
-- ============================================================
-- SELECT * FROM sync_all_students('default', 'MIGRATION');
-- SELECT * FROM sync_all_staff('default', 'MIGRATION');