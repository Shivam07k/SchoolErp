-- Add debug logging to sync_student_user
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
  RAISE NOTICE 'sync_student_user called with app_id=%, student_id=%, actor=%', p_app_id, p_student_id, p_actor;
  
  SELECT * INTO v_student 
  FROM school_students 
  WHERE app_id = p_app_id AND id = p_student_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found';
  END IF;
  
  RAISE NOTICE 'Student found: %', v_student.admission_no;
  
  v_username := gen_student_username(v_student.admission_no);
  v_password := dob_to_password(v_student.dob);
  v_role_id := get_role_id(p_app_id, 'student');
  
  RAISE NOTICE 'role_id: %', v_role_id;
  
  SELECT * INTO v_existing_user
  FROM school_users
  WHERE app_id = p_app_id AND user_id = v_username
  LIMIT 1;
  
  IF FOUND THEN
    RAISE NOTICE 'Existing user found: %', v_existing_user.id;
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