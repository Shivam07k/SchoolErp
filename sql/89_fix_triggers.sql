-- Disable triggers during sync to avoid recursion
-- Drop existing triggers
DROP TRIGGER IF EXISTS trg_student_user_sync ON school_students;
DROP TRIGGER IF EXISTS trg_staff_user_sync ON school_staff;

-- Create new triggers that use a flag to avoid recursion
CREATE OR REPLACE FUNCTION trg_student_user_sync()
RETURNS TRIGGER AS $$
BEGIN
  -- Use a session variable to prevent recursion
  IF current_setting('app.sync_in_progress', true) = 'true' THEN
    RETURN NEW;
  END IF;
  
  -- Set flag to prevent recursion
  PERFORM set_config('app.sync_in_progress', 'true', false);
  
  PERFORM sync_student_user(NEW.app_id, NEW.id, COALESCE(current_setting('app.current_user', true), 'SYSTEM'));
  
  -- Reset flag
  PERFORM set_config('app.sync_in_progress', 'false', false);
  
  -- Update user_id on student record
  UPDATE school_students 
  SET user_id = (SELECT id FROM school_users WHERE app_id = NEW.app_id AND user_id = gen_student_username(NEW.admission_no))
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_staff_user_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.sync_in_progress', true) = 'true' THEN
    RETURN NEW;
  END IF;
  
  PERFORM set_config('app.sync_in_progress', 'true', false);
  
  PERFORM sync_staff_user(NEW.app_id, NEW.id, COALESCE(current_setting('app.current_user', true), 'SYSTEM'));
  
  PERFORM set_config('app.sync_in_progress', 'false', false);
  
  UPDATE school_staff 
  SET user_id = (
    SELECT id FROM school_users 
    WHERE app_id = NEW.app_id 
    AND user_id = CASE 
      WHEN NEW.employee_code IS NOT NULL AND NEW.employee_code <> '' 
      THEN 'staff_' || NEW.employee_code 
      ELSE 'staff_' || NEW.id 
    END
  )
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers
CREATE TRIGGER trg_student_user_sync
AFTER INSERT OR UPDATE ON school_students
FOR EACH ROW EXECUTE FUNCTION trg_student_user_sync();

CREATE TRIGGER trg_staff_user_sync
AFTER INSERT OR UPDATE ON school_staff
FOR EACH ROW EXECUTE FUNCTION trg_staff_user_sync();