-- ============================================================
-- Advanced RBAC - Groups & Granular Permissions
-- Groups, Group Permissions, User-Group Assignments
-- ============================================================

-- ============================================================
-- Groups (replaces/extends roles)
-- ============================================================
CREATE TABLE IF NOT EXISTS school_groups (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  code              TEXT NOT NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  type              TEXT NOT NULL DEFAULT 'custom',  -- 'system', 'custom'
  is_active         BOOLEAN DEFAULT true,
  is_system         BOOLEAN DEFAULT false,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (app_id, code)
);

CREATE INDEX IF NOT EXISTS idx_school_groups_app ON school_groups (app_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_school_groups_type ON school_groups (app_id, type) WHERE deleted_at IS NULL;

-- ============================================================
-- Group Permissions (granular: module → action)
-- ============================================================
CREATE TABLE IF NOT EXISTS school_group_permissions (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  group_id          INT NOT NULL REFERENCES school_groups(id) ON DELETE CASCADE,
  module            TEXT NOT NULL,           -- 'students', 'fees', 'attendance', etc.
  action            TEXT NOT NULL,           -- 'read', 'write', 'delete', 'update', 'export', 'print', 'approve'
  scope             TEXT NOT NULL DEFAULT 'campus',  -- 'own', 'campus', 'global'
  conditions        JSONB DEFAULT '{}',      -- optional: {'class_id': [1,2], 'section_id': [3]}
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (group_id, module, action, scope)
);

CREATE INDEX IF NOT EXISTS idx_school_group_perms_group ON school_group_permissions (group_id);
CREATE INDEX IF NOT EXISTS idx_school_group_perms_module ON school_group_permissions (group_id, module);

-- ============================================================
-- User-Group Assignments (many-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS school_user_groups (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  user_id           INT NOT NULL REFERENCES school_users(id) ON DELETE CASCADE,
  group_id          INT NOT NULL REFERENCES school_groups(id) ON DELETE CASCADE,
  campus_id         INT,                     -- optional campus scope
  assigned_by       TEXT,
  assigned_at       TIMESTAMPTZ DEFAULT now(),
  expires_at        TIMESTAMPTZ,             -- optional expiry
  UNIQUE (app_id, user_id, group_id, campus_id)
);

CREATE INDEX IF NOT EXISTS idx_school_user_groups_user ON school_user_groups (app_id, user_id);
CREATE INDEX IF NOT EXISTS idx_school_user_groups_group ON school_user_groups (group_id);

-- ============================================================
-- Seed System Groups
-- ============================================================
INSERT INTO school_groups (app_id, code, name, description, type, is_system, is_active, created_by)
VALUES
  ('default', 'super_admin', 'Super Administrator', 'Full system access', 'system', true, true, 'SYSTEM'),
  ('default', 'admin', 'Administrator', 'School administration', 'system', true, true, 'SYSTEM'),
  ('default', 'accountant', 'Accountant', 'Fee management, reports', 'system', true, true, 'SYSTEM'),
  ('default', 'class_teacher', 'Class Teacher', 'Attendance, marks, student info', 'system', true, true, 'SYSTEM'),
  ('default', 'fee_collector', 'Fee Collector', 'Collect fees, issue receipts', 'system', true, true, 'SYSTEM'),
  ('default', 'librarian', 'Librarian', 'Book issue/return, fines', 'system', true, true, 'SYSTEM'),
  ('default', 'hr_manager', 'HR Manager', 'Staff, payroll, leave', 'system', true, true, 'SYSTEM'),
  ('default', 'exam_controller', 'Exam Controller', 'Exams, marks, results', 'system', true, true, 'SYSTEM'),
  ('default', 'parent', 'Parent Portal', 'View child info, fees, attendance', 'system', true, true, 'SYSTEM'),
  ('default', 'student', 'Student Portal', 'View own info, submit assignments', 'system', true, true, 'SYSTEM')
ON CONFLICT (app_id, code) DO NOTHING;

-- ============================================================
-- Seed System Group Permissions using a simpler approach
-- ============================================================

-- Get super_admin group id
DO $$
DECLARE
  v_super_admin_id INT;
  v_admin_id INT;
  v_accountant_id INT;
  v_class_teacher_id INT;
  v_fee_collector_id INT;
  v_librarian_id INT;
  v_hr_manager_id INT;
  v_exam_controller_id INT;
  v_parent_id INT;
  v_student_id INT;
BEGIN
  -- Get group IDs
  SELECT id INTO v_super_admin_id FROM school_groups WHERE app_id = 'default' AND code = 'super_admin';
  SELECT id INTO v_admin_id FROM school_groups WHERE app_id = 'default' AND code = 'admin';
  SELECT id INTO v_accountant_id FROM school_groups WHERE app_id = 'default' AND code = 'accountant';
  SELECT id INTO v_class_teacher_id FROM school_groups WHERE app_id = 'default' AND code = 'class_teacher';
  SELECT id INTO v_fee_collector_id FROM school_groups WHERE app_id = 'default' AND code = 'fee_collector';
  SELECT id INTO v_librarian_id FROM school_groups WHERE app_id = 'default' AND code = 'librarian';
  SELECT id INTO v_hr_manager_id FROM school_groups WHERE app_id = 'default' AND code = 'hr_manager';
  SELECT id INTO v_exam_controller_id FROM school_groups WHERE app_id = 'default' AND code = 'exam_controller';
  SELECT id INTO v_parent_id FROM school_groups WHERE app_id = 'default' AND code = 'parent';
  SELECT id INTO v_student_id FROM school_groups WHERE app_id = 'default' AND code = 'student';

  -- Super Admin: all modules, all actions, global scope
  INSERT INTO school_group_permissions (app_id, group_id, module, action, scope)
  SELECT 'default', v_super_admin_id, perm.module, perm.action, 'global'
  FROM (VALUES 
    ('students', 'read'), ('students', 'write'), ('students', 'delete'), ('students', 'update'),
    ('students', 'export'), ('students', 'import'), ('students', 'promote'), ('students', 'transfer'),
    ('fees', 'read'), ('fees', 'write'), ('fees', 'delete'), ('fees', 'update'),
    ('fees', 'export'), ('fees', 'collect'), ('fees', 'refund'), ('fees', 'waive'), ('fees', 'configure'),
    ('attendance', 'read'), ('attendance', 'write'), ('attendance', 'delete'), ('attendance', 'update'),
    ('attendance', 'export'), ('attendance', 'approve'), ('attendance', 'configure'),
    ('examinations', 'read'), ('examinations', 'write'), ('examinations', 'delete'), ('examinations', 'update'),
    ('examinations', 'export'), ('examinations', 'schedule'), ('examinations', 'enter_marks'), ('examinations', 'publish_results'),
    ('timetable', 'read'), ('timetable', 'write'), ('timetable', 'delete'), ('timetable', 'update'),
    ('timetable', 'export'), ('timetable', 'configure'),
    ('staff', 'read'), ('staff', 'write'), ('staff', 'delete'), ('staff', 'update'),
    ('staff', 'export'), ('staff', 'approve_leave'), ('staff', 'payroll'),
    ('inventory', 'read'), ('inventory', 'write'), ('inventory', 'delete'), ('inventory', 'update'),
    ('inventory', 'export'), ('inventory', 'purchase'), ('inventory', 'issue'), ('inventory', 'stock_take'),
    ('library', 'read'), ('library', 'write'), ('library', 'delete'), ('library', 'update'),
    ('library', 'export'), ('library', 'issue'), ('library', 'return'), ('library', 'fine'),
    ('transport', 'read'), ('transport', 'write'), ('transport', 'delete'), ('transport', 'update'),
    ('transport', 'export'), ('transport', 'track'), ('transport', 'allocate'),
    ('hostel', 'read'), ('hostel', 'write'), ('hostel', 'delete'), ('hostel', 'update'),
    ('hostel', 'export'), ('hostel', 'allocate'), ('hostel', 'visitors'),
    ('communication', 'read'), ('communication', 'write'), ('communication', 'delete'), ('communication', 'update'),
    ('communication', 'send_sms'), ('communication', 'send_email'), ('communication', 'send_push'), ('communication', 'templates'),
    ('reports', 'read'), ('reports', 'export'), ('reports', 'schedule'), ('reports', 'configure'),
    ('settings', 'read'), ('settings', 'write'), ('settings', 'delete'), ('settings', 'update'), ('settings', 'configure'),
    ('automation', 'read'), ('automation', 'write'), ('automation', 'delete'), ('automation', 'update'),
    ('automation', 'export'), ('automation', 'configure'),
    ('admissions', 'read'), ('admissions', 'write'), ('admissions', 'delete'), ('admissions', 'update'),
    ('admissions', 'export'), ('admissions', 'configure'),
    ('lms', 'read'), ('lms', 'write'), ('lms', 'delete'), ('lms', 'update'),
    ('lms', 'export'), ('lms', 'configure')
) AS perm(module, action)
WHERE NOT EXISTS (
  SELECT 1 FROM school_group_permissions gp 
  WHERE gp.group_id = v_super_admin_id AND gp.module = perm.module AND gp.action = perm.action AND gp.scope = 'global'
);

  -- Admin: most modules, campus scope
  INSERT INTO school_group_permissions (app_id, group_id, module, action, scope)
  SELECT 'default', v_admin_id, perm.module, perm.action, 'campus'
  FROM (VALUES 
    ('students', 'read'), ('students', 'write'), ('students', 'update'), ('students', 'export'),
    ('students', 'promote'), ('students', 'transfer'),
    ('fees', 'read'), ('fees', 'write'), ('fees', 'update'), ('fees', 'export'),
    ('fees', 'collect'), ('fees', 'refund'), ('fees', 'waive'), ('fees', 'configure'),
    ('attendance', 'read'), ('attendance', 'write'), ('attendance', 'update'), ('attendance', 'export'),
    ('attendance', 'approve'), ('attendance', 'configure'),
    ('examinations', 'read'), ('examinations', 'write'), ('examinations', 'update'), ('examinations', 'export'),
    ('examinations', 'schedule'), ('examinations', 'enter_marks'), ('examinations', 'publish_results'),
    ('timetable', 'read'), ('timetable', 'write'), ('timetable', 'update'), ('timetable', 'export'),
    ('timetable', 'configure'),
    ('staff', 'read'), ('staff', 'write'), ('staff', 'update'), ('staff', 'export'),
    ('staff', 'approve_leave'), ('staff', 'payroll'),
    ('inventory', 'read'), ('inventory', 'write'), ('inventory', 'update'), ('inventory', 'export'),
    ('inventory', 'purchase'), ('inventory', 'issue'), ('inventory', 'stock_take'),
    ('library', 'read'), ('library', 'write'), ('library', 'update'), ('library', 'export'),
    ('library', 'issue'), ('library', 'return'), ('library', 'fine'),
    ('transport', 'read'), ('transport', 'write'), ('transport', 'update'), ('transport', 'export'),
    ('transport', 'track'), ('transport', 'allocate'),
    ('hostel', 'read'), ('hostel', 'write'), ('hostel', 'update'), ('hostel', 'export'),
    ('hostel', 'allocate'), ('hostel', 'visitors'),
    ('communication', 'read'), ('communication', 'write'), ('communication', 'update'),
    ('communication', 'send_sms'), ('communication', 'send_email'), ('communication', 'send_push'), ('communication', 'templates'),
    ('reports', 'read'), ('reports', 'export'), ('reports', 'schedule'), ('reports', 'configure'),
    ('settings', 'read'), ('settings', 'write'), ('settings', 'update'), ('settings', 'configure'),
    ('automation', 'read'), ('automation', 'write'), ('automation', 'update'),
    ('automation', 'export'), ('automation', 'configure'),
    ('admissions', 'read'), ('admissions', 'write'), ('admissions', 'update'), ('admissions', 'export'),
    ('admissions', 'configure'),
    ('lms', 'read'), ('lms', 'write'), ('lms', 'update'), ('lms', 'export'), ('lms', 'configure')
  ) AS perm(module, action)
  WHERE NOT EXISTS (
    SELECT 1 FROM school_group_permissions gp 
    WHERE gp.group_id = v_admin_id AND gp.module = perm.module AND gp.action = perm.action AND gp.scope = 'campus'
  );

  -- Accountant: fees, reports
  INSERT INTO school_group_permissions (app_id, group_id, module, action, scope)
  SELECT 'default', v_accountant_id, perm.module, perm.action, 'campus'
  FROM (VALUES 
    ('fees', 'read'), ('fees', 'write'), ('fees', 'update'), ('fees', 'export'),
    ('fees', 'collect'), ('fees', 'refund'), ('fees', 'waive'), ('fees', 'configure'),
    ('students', 'read'), ('students', 'export'),
    ('reports', 'read'), ('reports', 'export'), ('reports', 'schedule'), ('reports', 'configure'),
    ('settings', 'read')
  ) AS perm(module, action)
  WHERE NOT EXISTS (
    SELECT 1 FROM school_group_permissions gp 
    WHERE gp.group_id = v_accountant_id AND gp.module = perm.module AND gp.action = perm.action AND gp.scope = 'campus'
  );

  -- Class Teacher: students, attendance, examinations, lms
  INSERT INTO school_group_permissions (app_id, group_id, module, action, scope)
  SELECT 'default', v_class_teacher_id, perm.module, perm.action, 'campus'
  FROM (VALUES 
    ('students', 'read'), ('students', 'write'), ('students', 'update'), ('students', 'export'),
    ('students', 'promote'), ('students', 'transfer'),
    ('attendance', 'read'), ('attendance', 'write'), ('attendance', 'update'), ('attendance', 'export'),
    ('attendance', 'approve'),
    ('examinations', 'read'), ('examinations', 'write'), ('examinations', 'update'), ('examinations', 'export'),
    ('examinations', 'schedule'), ('examinations', 'enter_marks'), ('examinations', 'publish_results'),
    ('lms', 'read'), ('lms', 'write'), ('lms', 'update'), ('lms', 'export'), ('lms', 'configure'),
    ('reports', 'read'), ('reports', 'export')
  ) AS perm(module, action)
  WHERE NOT EXISTS (
    SELECT 1 FROM school_group_permissions gp 
    WHERE gp.group_id = v_class_teacher_id AND gp.module = perm.module AND gp.action = perm.action AND gp.scope = 'campus'
  );

  -- Fee Collector: fees, students (read)
  INSERT INTO school_group_permissions (app_id, group_id, module, action, scope)
  SELECT 'default', v_fee_collector_id, perm.module, perm.action, 'campus'
  FROM (VALUES 
    ('fees', 'read'), ('fees', 'write'), ('fees', 'update'), ('fees', 'export'),
    ('fees', 'collect'), ('fees', 'refund'), ('fees', 'waive'),
    ('students', 'read'), ('students', 'export')
  ) AS perm(module, action)
  WHERE NOT EXISTS (
    SELECT 1 FROM school_group_permissions gp 
    WHERE gp.group_id = v_fee_collector_id AND gp.module = perm.module AND gp.action = perm.action AND gp.scope = 'campus'
  );

  -- Librarian: library
  INSERT INTO school_group_permissions (app_id, group_id, module, action, scope)
  SELECT 'default', v_librarian_id, perm.module, perm.action, 'campus'
  FROM (VALUES 
    ('library', 'read'), ('library', 'write'), ('library', 'update'), ('library', 'export'),
    ('library', 'issue'), ('library', 'return'), ('library', 'fine'),
    ('students', 'read')
  ) AS perm(module, action)
  WHERE NOT EXISTS (
    SELECT 1 FROM school_group_permissions gp 
    WHERE gp.group_id = v_librarian_id AND gp.module = perm.module AND gp.action = perm.action AND gp.scope = 'campus'
  );

  -- HR Manager: staff, settings (partial)
  INSERT INTO school_group_permissions (app_id, group_id, module, action, scope)
  SELECT 'default', v_hr_manager_id, perm.module, perm.action, 'campus'
  FROM (VALUES 
    ('staff', 'read'), ('staff', 'write'), ('staff', 'update'), ('staff', 'export'),
    ('staff', 'approve_leave'), ('staff', 'payroll'),
    ('settings', 'read'), ('settings', 'write'), ('settings', 'update'),
    ('reports', 'read'), ('reports', 'export'), ('reports', 'schedule')
  ) AS perm(module, action)
  WHERE NOT EXISTS (
    SELECT 1 FROM school_group_permissions gp 
    WHERE gp.group_id = v_hr_manager_id AND gp.module = perm.module AND gp.action = perm.action AND gp.scope = 'campus'
  );

  -- Exam Controller: examinations, students (read)
  INSERT INTO school_group_permissions (app_id, group_id, module, action, scope)
  SELECT 'default', v_exam_controller_id, perm.module, perm.action, 'campus'
  FROM (VALUES 
    ('examinations', 'read'), ('examinations', 'write'), ('examinations', 'update'), ('examinations', 'export'),
    ('examinations', 'schedule'), ('examinations', 'enter_marks'), ('examinations', 'publish_results'),
    ('students', 'read'), ('students', 'export')
  ) AS perm(module, action)
  WHERE NOT EXISTS (
    SELECT 1 FROM school_group_permissions gp 
    WHERE gp.group_id = v_exam_controller_id AND gp.module = perm.module AND gp.action = perm.action AND gp.scope = 'campus'
  );

  -- Parent: read-only access to own child
  INSERT INTO school_group_permissions (app_id, group_id, module, action, scope, conditions)
  SELECT 'default', v_parent_id, perm.module, perm.action, 'own', '{"student_id": "current_user_child"}'::jsonb
  FROM (VALUES 
    ('students', 'read'), ('fees', 'read'), ('attendance', 'read'),
    ('examinations', 'read'), ('library', 'read'), ('transport', 'read')
  ) AS perm(module, action)
  WHERE NOT EXISTS (
    SELECT 1 FROM school_group_permissions gp 
    WHERE gp.group_id = v_parent_id AND gp.module = perm.module AND gp.action = perm.action AND gp.scope = 'own'
  );

  -- Student: own info, lms, library
  INSERT INTO school_group_permissions (app_id, group_id, module, action, scope, conditions)
  SELECT 'default', v_student_id, perm.module, perm.action, 'own', '{}'::jsonb
  FROM (VALUES 
    ('students', 'read'), ('lms', 'read'), ('lms', 'write'), ('library', 'read')
  ) AS perm(module, action)
  WHERE NOT EXISTS (
    SELECT 1 FROM school_group_permissions gp 
    WHERE gp.group_id = v_student_id AND gp.module = perm.module AND gp.action = perm.action AND gp.scope = 'own'
  );
END $$;