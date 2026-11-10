-- Fix ON CONFLICT to use the exact expression from the unique index
-- The unique index is: (app_id, user_id, role_id, COALESCE(campus_id, 0))
-- So we need to use COALESCE(campus_id, 0) in ON CONFLICT

DROP FUNCTION IF EXISTS sync_student_user(text, int, text);

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
  SELECT * INTO v_student 
  FROM school_students 
  WHERE app_id = p_app_id AND id = p_student_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found';
  END IF;
  
  v_username := gen_student_username(v_student.admission_no);
  v_password := dob_to_password(v_student.dob);
  v_role_id := get_role_id(p_app_id, 'student');
  
  SELECT * INTO v_existing_user
  FROM school_users
  WHERE app_id = p_app_id AND user_id = v_username
  LIMIT 1;
  
  IF FOUND THEN
    UPDATE school_users SET
      name = v_student.first_name || ' ' || v_student.last_name,
      email = v_student.guardian_email,
      phone = v_student.guardian_phone,
      status = v_student.status,
      campus_id = v_student.campus_id,
      updated_at = now()
    WHERE id = v_existing_user.id
    RETURNING id INTO v_user_id;
    
    INSERT INTO school_user_roles (app_id, user_id, role_id, campus_id, assigned_by)
    VALUES (p_app_id, v_existing_user.id, v_role_id, v_existing_user.campus_id, 'SYSTEM')
    ON CONFLICT (app_id, user_id, role_id, COALESCE(campus_id, 0)) DO NOTHING;
    
    RETURN v_existing_user.id;
  ELSE
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
    
    INSERT INTO school_user_roles (app_id, user_id, role_id, campus_id, assigned_by)
    VALUES (p_app_id, v_user_id, v_role_id, v_student.campus_id, 'SYSTEM')
    ON CONFLICT (app_id, user_id, role_id, COALESCE(campus_id, 0)) DO NOTHING;
    
    RETURN v_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS sync_staff_user(text, int, text);

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
  SELECT * INTO v_staff 
  FROM school_staff 
  WHERE app_id = p_app_id AND id = p_staff_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff not found';
  END IF;
  
  v_username := CASE 
    WHEN v_staff.employee_code IS NOT NULL AND v_staff.employee_code <> '' 
    THEN 'staff_' || v_staff.employee_code 
    ELSE 'staff_' || v_staff.id 
  END;
  
  v_password := dob_to_password(v_staff.date_of_birth);
  v_role_id := get_role_id(p_app_id, 'staff');
  
  SELECT * INTO v_existing_user
  FROM school_users
  WHERE app_id = p_app_id AND user_id = v_username
  LIMIT 1;
  
  IF FOUND THEN
    UPDATE school_users SET
      name = v_staff.name,
      email = v_staff.contact_email,
      phone = v_staff.contact_phone,
      status = v_staff.status,
      campus_id = v_staff.campus_id,
      updated_at = now()
    WHERE id = v_existing_user.id
    RETURNING id INTO v_user_id;
    
    INSERT INTO school_user_roles (app_id, user_id, role_id, campus_id, assigned_by)
    VALUES (p_app_id, v_existing_user.id, v_role_id, v_existing_user.campus_id, 'SYSTEM')
    ON CONFLICT (app_id, user_id, role_id, COALESCE(campus_id, 0)) DO NOTHING;
    
    RETURN v_existing_user.id;
  ELSE
    INSERT INTO school_users (
      app_id, user_id, name, email, phone, password_hash,
      status, campus_id, created_by
    ) VALUES (
      p_app_id, v_username,
      v_staff.name,
      v_staff.contact_email,
      v_staff.contact_phone,
      v_password,
      v_staff.status,
      v_staff.campus_id,
      'SYSTEM'
    ) RETURNING id INTO v_user_id;
    
    INSERT INTO school_user_roles (app_id, user_id, role_id, campus_id, assigned_by)
    VALUES (p_app_id, v_user_id, v_role_id, v_staff.campus_id, 'SYSTEM')
    ON CONFLICT (app_id, user_id, role_id, COALESCE(campus_id, 0)) DO NOTHING;
    
    RETURN v_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;