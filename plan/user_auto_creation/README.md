# Auto User Creation for Students & Staff — Plan

## Overview
When a Student or Staff is created/updated, automatically create/update a corresponding entry in `school_users` with:
- **Username**: `student_<admission_no>` or `staff_<employee_id>`
- **Initial Password**: DOB formatted as `DDMMYYYY` (e.g., `17122001`)
- **Group/Role**: `student` or `staff` (pre-defined roles)
- **Email/Phone**: From student/staff record
- **Status**: Synced with student/staff status
- **Campus**: From student/staff record

Users can change password in Settings → Users & Access.

Different dashboards for Student vs Staff with appropriate navigation links.

---

## Database Schema Changes

### 1. Add columns to `school_students`
```sql
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS user_id INT REFERENCES school_users(id) ON DELETE SET NULL;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS user_created_at TIMESTAMPTZ;
```

### 2. Add columns to `school_staff`
```sql
ALTER TABLE school_staff ADD COLUMN IF NOT EXISTS user_id INT REFERENCES school_users(id) ON DELETE SET NULL;
ALTER TABLE school_staff ADD COLUMN IF NOT EXISTS user_created_at TIMESTAMPTZ;
```

### 3. Add role codes (if not exist)
```sql
INSERT INTO school_roles (app_id, name, code, description, is_system)
VALUES 
  ('default', 'Student', 'student', 'Student portal access', true),
  ('default', 'Staff', 'staff', 'Staff portal access', true)
ON CONFLICT (app_id, code) DO NOTHING;
```

---

## Backend Implementation

### 1. Helper Functions (in `schoolFoundation.js` or shared util)

```javascript
// Generate username from admission_no or employee_id
const genStudentUsername = (admissionNo) => `student_${admissionNo}`;
const genStaffUsername = (empId) => `staff_${empId}`;

// Format DOB as DDMMYYYY
const dobToPassword = (dob) => {
  if (!dob) return null;
  const d = new Date(dob);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}${month}${year}`;
};

// Create or update user for student
async function syncStudentUser(pool, appId, student, actor) {
  const username = genStudentUsername(student.admission_no);
  const password = dobToPassword(student.dob);
  const role = await getRoleId(pool, appId, 'student');
  
  // Check if user exists
  const existing = await execQ(pool, 
    `SELECT * FROM school_users WHERE app_id=$1 AND user_id=$2`, 
    [appId, username]);
  
  if (existing.length) {
    // Update existing
    await client.query(`
      UPDATE school_users SET 
        name=$1, email=$2, phone=$3, status=$4, campus_id=$5, updated_at=now()
      WHERE id=$6
    `, [student.first_name + ' ' + student.last_name, student.guardian_email, student.guardian_phone, student.status, student.campus_id, existing[0].id]);
    
    // Ensure role assignment
    await client.query(`
      INSERT INTO school_user_roles (app_id, user_id, role_id, assigned_by)
      VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING
    `, [appId, existing[0].id, role, actor]);
    
    return existing[0].id;
  } else {
    // Create new
    const [row] = await client.query(`
      INSERT INTO school_users (app_id, user_id, name, email, phone, password_hash, status, campus_id, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id
    `, [appId, username, student.first_name + ' ' + student.last_name, student.guardian_email, student.guardian_phone, password, student.status, student.campus_id, actor]);
    
    await client.query(`
      INSERT INTO school_user_roles (app_id, user_id, role_id, assigned_by)
      VALUES ($1,$2,$3,$4)
    `, [appId, row.id, role, actor]);
    
    return row.id;
  }
}

// Create or update user for staff
async function syncStaffUser(pool, appId, staff, actor) {
  const username = genStaffUsername(staff.employee_id || staff.id);
  const password = dobToPassword(staff.dob);
  const role = await getRoleId(pool, appId, 'staff');
  
  // Similar logic to student...
}
```

### 2. Hook into Student/Staff CRUD

**When creating/updating Student** (in `school_students_complete.js` or wherever student is saved):
```javascript
// After student insert/update
const userId = await syncStudentUser(pool, appId, student, actor);
await execQ(pool, `UPDATE school_students SET user_id=$1, user_created_at=COALESCE(user_created_at, now()) WHERE id=$2`, [userId, student.id]);
```

**When creating/updating Staff** (in `school_hr_staff.js`):
```javascript
// After staff insert/update
const userId = await syncStaffUser(pool, appId, staff, actor);
await execQ(pool, `UPDATE school_staff SET user_id=$1, user_created_at=COALESCE(user_created_at, now()) WHERE id=$2`, [userId, staff.id]);
```

### 3. Sync on Status Change
When student/staff status changes → update `school_users.status` accordingly.

---

## Frontend Changes

### 1. Users & Access Tab
- Show "Sync All Students" and "Sync All Staff" buttons for bulk creation
- Password column shows "••••••••" with "Reset to DOB" action
- Role badge shows "student" / "staff" with appropriate icon

### 2. Student/Staff Forms
- Show "User Account" section with link to Users tab
- Display generated username and "Reset Password to DOB" button

### 3. Role-Based Dashboard (in `SchoolPage.jsx` / `App.jsx`)

```javascript
// After login, check user's role from school_user_roles
// Redirect to appropriate dashboard:

const ROLE_DASHBOARDS = {
  student: '/school/student/dashboard',
  staff: '/school/staff/dashboard',
  // Admin/super falls through to main dashboard
};

// Student Dashboard Components
- My Profile (read-only)
- My Attendance
- My Fees (view only)
- My Timetable
- My Exam Results
- My Assignments (LMS)
- My Certificates

// Staff Dashboard Components
- My Profile
- My Classes / Timetable
- Mark Attendance
- Enter Marks
- My Leave Balance
- My Payroll / Payslips
- My Students (if class teacher)
```

### 4. Navigation/Menu per Role
```javascript
const STUDENT_MENU = [
  { label: 'My Dashboard', path: '/school/student/dashboard' },
  { label: 'My Attendance', path: '/school/student/attendance' },
  { label: 'My Fees', path: '/school/student/fees' },
  { label: 'My Timetable', path: '/school/student/timetable' },
  { label: 'My Results', path: '/school/student/results' },
  { label: 'My Assignments', path: '/school/student/assignments' },
];

const STAFF_MENU = [
  { label: 'My Dashboard', path: '/school/staff/dashboard' },
  { label: 'My Classes', path: '/school/staff/classes' },
  { label: 'Mark Attendance', path: '/school/staff/attendance' },
  { label: 'Enter Marks', path: '/school/staff/marks' },
  { label: 'My Leave', path: '/school/staff/leave' },
  { label: 'My Payslips', path: '/school/staff/payslips' },
];
```

---

## Implementation Order

1. **Database Migration** (`sql/83_user_sync.sql`)
   - Add `user_id` columns to students/staff
   - Add `student` and `staff` roles
   - Create indexes

2. **Backend Helpers** (in `schoolFoundation.js` or new `school_user_sync.js`)
   - `genStudentUsername`, `genStaffUsername`, `dobToPassword`
   - `syncStudentUser`, `syncStaffUser`
   - `getRoleId` helper

3. **Hook into Student CRUD** (`school_students_complete.js`)
   - Call `syncStudentUser` on create/update
   - Update `school_students.user_id`

4. **Hook into Staff CRUD** (`school_hr_staff.js`)
   - Call `syncStaffUser` on create/update
   - Update `school_staff.user_id`

4. **Bulk Sync Endpoint** 
   - `POST /school/users/sync-students` - sync all students
   - `POST /school/users/sync-staff` - sync all staff

5. **Frontend - Users Tab**
   - Add "Sync All Students" / "Sync All Staff" buttons
   - Add "Reset Password to DOB" action
   - Show role badges

6. **Frontend - Role-Based Dashboards**
   - Create `StudentDashboard.jsx`, `StaffDashboard.jsx`
   - Create role-based menu config
   - Update `SchoolPage.jsx` / `App.jsx` to route based on role

7. **Role-Based Navigation**
   - Update `SchoolSidebar.jsx` to show menu based on user's role
   - Add role detection in `App.jsx` after login

---

## Testing Checklist

- [ ] Create student → user auto-created with DOB password
- [ ] Update student status → user status synced
- [ ] Create staff → user auto-created with DOB password
- [ ] Bulk sync creates users for all existing students/staff
- [ ] Student login works with DOB password
- [ ] Student sees student dashboard with correct links
- [ ] Staff login works with DOB password
- [ ] Staff sees staff dashboard with correct links
- [ ] Password change in Users tab works
- [ ] Reset to DOB action works
- [ ] Role-based menu filtering works