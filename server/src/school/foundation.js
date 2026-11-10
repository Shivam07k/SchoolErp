import { execQ } from '../db/sp.js';

/* ============================================================
   School ERP foundation
   - module permission catalogue
   - per-tenant campuses, branding, roles and document types
   - audit trail helper
   - access resolution for menu filtering and route guards
   ============================================================ */

export const SCHOOL_MODULES = [
  ['dashboard', 'Dashboard'],
  ['admission', 'Admission & CRM'],
  ['students', 'Students'],
  ['health', 'Health Records'],
  ['discipline', 'Discipline'],
  ['academics', 'Academics'],
  ['timetable', 'Timetable'],
  ['attendance', 'Attendance'],
  ['exams', 'Examinations'],
  ['fees', 'Fees & Accounts'],
  ['hr', 'HR & Payroll'],
  ['transport', 'Transport'],
  ['hostel', 'Hostel'],
  ['library', 'Library'],
  ['inventory', 'Inventory & Assets'],
  ['canteen', 'Canteen'],
  ['frontoffice', 'Front Office'],
  ['communication', 'Communication'],
  ['lms', 'Learning (LMS)'],
  ['events', 'Events & PTM'],
  ['certificates', 'Certificates & ID'],
  ['alumni', 'Alumni & Placement'],
  ['reports', 'Reports & Analytics'],
  ['automation', 'Automation Center'],
  ['import', 'Import & Export'],
  ['ai', 'AI Assistant'],
  ['settings', 'Settings'],
  ['platform', 'Platform / Super Admin'],
  ['homework', 'Homework'],
];

export const PERMISSIONS = SCHOOL_MODULES.flatMap(([key, label]) => ([
  { key: `${key}.view`, module: key, description: `View ${label}` },
  { key: `${key}.manage`, module: key, description: `Manage ${label}` },
]));

// Additional granular permissions for homework beyond view/manage
const HOMEWORK_PERMISSIONS = [
  { key: 'homework.create', module: 'homework', description: 'Create and edit homework drafts' },
  { key: 'homework.publish', module: 'homework', description: 'Publish homework to students' },
  { key: 'homework.close', module: 'homework', description: 'Close published homework' },
  { key: 'homework.archive', module: 'homework', description: 'Archive homework' },
  { key: 'homework.grade', module: 'homework', description: 'Grade student submissions' },
  { key: 'homework.submit', module: 'homework', description: 'Submit homework as a student' },
  { key: 'homework.manage', module: 'homework', description: 'Full homework management (delete, front-office submit)' },
];

// Filter out duplicates (homework.view and homework.manage are already in PERMISSIONS)
export const HOMEWORK_UNIQUE = HOMEWORK_PERMISSIONS.filter((p) => 
  !['homework.view', 'homework.manage'].includes(p.key)
);

/* Granular hostel permissions. hostel.manage stays the superset so existing
   role grants keep working. */
const HOSTEL_PERMISSIONS = [
  { key: 'hostel.allocate', module: 'hostel', description: 'Applications, allocations, room changes and vacating' },
  { key: 'hostel.rollcall', module: 'hostel', description: 'Roll calls, gate log and duty roster' },
  { key: 'hostel.leave_approve', module: 'hostel', description: 'Approve or reject hostel leave passes' },
  { key: 'hostel.visitor', module: 'hostel', description: 'Visitor check-in, check-out and blacklist' },
  { key: 'hostel.fees', module: 'hostel', description: 'Hostel fee rules, billing and deposits' },
  { key: 'hostel.reports', module: 'hostel', description: 'Hostel reports and exports' },
  { key: 'hostel.audit', module: 'hostel', description: 'Hostel audit and retention' },
];

/* Teachers need a permission that distinguishes "my timetable" from the
   student/parent timetable view, which also uses timetable.view. */
const TIMETABLE_PERMISSIONS = [
  { key: 'timetable.teacher', module: 'timetable', description: 'View own teacher timetable' },
];

export const ALL_PERMISSIONS = [...PERMISSIONS, ...HOMEWORK_UNIQUE, ...TIMETABLE_PERMISSIONS, ...HOSTEL_PERMISSIONS];

const ALL = ALL_PERMISSIONS.map((p) => p.key);
const VIEW = PERMISSIONS.filter((p) => p.key.endsWith('.view')).map((p) => p.key);
const keysFor = (...modules) => modules.flatMap((m) => [`${m}.view`, `${m}.manage`]);
const viewsFor = (...modules) => modules.map((m) => `${m}.view`);
const homeworkKeys = ['homework.create', 'homework.publish', 'homework.close', 'homework.archive', 'homework.grade'];

const ROLE_DEFS = [
  { code: 'SUPER_ADMIN', name: 'Super Admin', description: 'Full platform access including tenant administration.', perms: ALL },
  { code: 'OWNER', name: 'Owner / Trustee', description: 'Institution owner with full operational access.', perms: ALL.filter((p) => !p.startsWith('platform.')) },
  { code: 'PRINCIPAL', name: 'Principal', description: 'Academic and operational head of the institution.', perms: ALL.filter((p) => !p.startsWith('platform.') && p !== 'settings.manage') },
  { code: 'ADMIN_OFFICER', name: 'Admin Officer', description: 'Admissions, student records, academics and front office.', perms: [
    ...keysFor('admission', 'students', 'academics', 'timetable', 'attendance', 'exams', 'communication', 'frontoffice', 'events', 'certificates', 'homework'),
    ...homeworkKeys,
    ...viewsFor('dashboard', 'fees', 'reports', 'automation', 'import'),
  ] },
  { code: 'ACCOUNTANT', name: 'Accountant', description: 'Fees, receipts, dues and accounts.', perms: [
    ...keysFor('fees', 'reports'),
    ...viewsFor('dashboard', 'students'),
  ] },
  { code: 'TEACHER', name: 'Teacher', description: 'Classroom delivery, attendance, homework and marks.', perms: [
    ...keysFor('attendance', 'exams', 'lms', 'communication'),
    'homework.view',
    ...homeworkKeys,
    'timetable.teacher',
    ...viewsFor('dashboard', 'students', 'academics', 'timetable', 'events', 'reports'),
  ] },
  { code: 'CLASS_TEACHER', name: 'Class Teacher', description: 'Teacher with class-level student and attendance control.', perms: [
    ...keysFor('attendance', 'exams', 'lms', 'communication', 'students'),
    'homework.view',
    ...homeworkKeys,
    'timetable.teacher',
    ...viewsFor('dashboard', 'academics', 'timetable', 'events', 'reports', 'fees'),
  ] },
  { code: 'ADMISSION_COUNSELOR', name: 'Admission Counselor', description: 'Enquiry pipeline, follow-ups and applications.', perms: [
    ...keysFor('admission', 'communication'),
    ...viewsFor('dashboard', 'students', 'reports', 'frontoffice'),
  ] },
  { code: 'HEALTH_OFFICER', name: 'Health Records Officer', description: 'Manage confidential student health records and events.', perms: [
    ...keysFor('health'),
    ...viewsFor('dashboard', 'students'),
  ] },
  { code: 'DISCIPLINE_OFFICER', name: 'Discipline Officer', description: 'Manage student incident records and actions.', perms: [
    ...keysFor('discipline'),
    ...viewsFor('dashboard', 'students', 'attendance'),
  ] },
  { code: 'HR_MANAGER', name: 'HR Manager', description: 'Staff records, recruitment, leave and payroll.', perms: keysFor('hr') },
  { code: 'LIBRARIAN', name: 'Librarian', description: 'Catalogue, circulation, reservations and fines.', perms: keysFor('library') },
  { code: 'TRANSPORT_MANAGER', name: 'Transport Manager', description: 'Vehicles, routes, trips and transport allocation.', perms: keysFor('transport') },
  { code: 'HOSTEL_WARDEN', name: 'Hostel Warden', description: 'Hostel allocation, roll call, gate pass and mess.', perms: [...keysFor('hostel'), 'hostel.allocate', 'hostel.rollcall', 'hostel.leave_approve', 'hostel.visitor', 'hostel.reports'] },
  { code: 'FRONT_OFFICE', name: 'Front Office', description: 'Visitors, calls, appointments and requests.', perms: [
    ...keysFor('frontoffice'),
    ...viewsFor('dashboard', 'students', 'communication'),
  ] },
  { code: 'INVENTORY_MANAGER', name: 'Inventory Manager', description: 'Stock, purchase, suppliers and assets.', perms: keysFor('inventory') },
  { code: 'CANTEEN_MANAGER', name: 'Canteen Manager', description: 'Canteen POS, menu, wallets and limits.', perms: keysFor('canteen') },
  { code: 'PARENT', name: 'Parent', description: 'Parent portal for attendance, fees, results and communication.', perms: viewsFor('dashboard', 'students', 'attendance', 'exams', 'fees', 'communication', 'lms', 'events', 'certificates', 'homework') },
  { code: 'STUDENT', name: 'Student', description: 'Student portal for timetable, homework, results and learning.', perms: [...viewsFor('dashboard', 'academics', 'timetable', 'attendance', 'exams', 'fees', 'communication', 'lms', 'events', 'library'), 'homework.view', 'homework.submit'] },
  { code: 'ALUMNI', name: 'Alumni', description: 'Alumni directory, events and donation history.', perms: viewsFor('dashboard', 'alumni', 'events', 'communication') },
];

const DOCUMENT_TYPES = [
  'Birth Certificate', 'National ID', 'Transfer Certificate', 'Previous Marksheet',
  'Passport Photo', 'Medical Record', 'Address Proof', 'Caste Certificate',
  'Income Certificate', 'Migration Certificate',
];

/* Cache completion per pool (i.e. per company database) rather than globally:
   one process can serve several databases, and tenant app_ids may coincide. */
const seededByPool = new WeakMap();

export async function ensureFoundation(pool, appId) {
  const seeded = seededByPool.get(pool) || new Set();
  seededByPool.set(pool, seeded);
  if (seeded.has(appId)) return;

  // Insert/reconcile the permission catalogue every time. school_permissions
  // has no app_id, so this is global; ON CONFLICT keeps it idempotent and also
  // heals databases where a migration added only part of the catalogue.
  await execQ(pool, `
    INSERT INTO school_permissions (key, module, description)
    SELECT * FROM unnest($1::text[], $2::text[], $3::text[])
    ON CONFLICT (key) DO NOTHING
  `, [ALL_PERMISSIONS.map((p) => p.key), ALL_PERMISSIONS.map((p) => p.module), ALL_PERMISSIONS.map((p) => p.description)]);

  const [{ n: campuses }] = await execQ(pool,
    'SELECT count(*)::int AS n FROM school_campuses WHERE app_id=$1', [appId]);
  if (!campuses) {
    await execQ(pool, `
      INSERT INTO school_campuses (app_id, name, code, type, status)
      VALUES ($1,'Main Campus','MAIN','campus','active'),
             ($1,'North Campus','NORTH','branch','active')
      ON CONFLICT (app_id, code) DO NOTHING
    `, [appId]);
  }

  await execQ(pool, `
    INSERT INTO school_attendance_policy
      (app_id, code, label, category, is_active, requires_reason, counts_as_present, sort_order)
    VALUES
      ($1, 'P',  'Present',          'present',  true, false, true,  1),
      ($1, 'A',  'Absent',           'absent',   true, false, false, 2),
      ($1, 'L',  'Late',             'late',     true, false, true,  3),
      ($1, 'E',  'Excused',          'excused',  true, true,  false, 4),
      ($1, 'EA', 'Early Departure',  'partial',  true, false, true,  5),
      ($1, 'SA', 'School Activity',  'activity', true, true,  true,  6),
      ($1, 'EL', 'Excused Late',     'late',     true, false, true, 7),
      ($1, 'O',  'Other',            'other',    true, false, false, 8)
    ON CONFLICT (app_id, code) DO NOTHING
  `, [appId]);

  const branding = {
    instituteName: 'School ERP',
    shortName: 'School',
    tagline: 'One campus, one connected experience',
    address: '',
    phone: '',
    email: '',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    logoUrl: '',
    primaryColor: '#1d4ed8',
    accentColor: '#0f766e',
  };
  await execQ(pool, `
    INSERT INTO school_settings (app_id, campus_id, key, value)
    VALUES ($1, NULL, 'branding', $2::jsonb)
    ON CONFLICT (app_id, (coalesce(campus_id, 0)), key) DO NOTHING
  `, [appId, JSON.stringify(branding)]);

  await execQ(pool, `
    INSERT INTO school_document_types (app_id, name, required_for, sort_order)
    SELECT $1, name, 'student', ord - 1
      FROM unnest($2::text[]) WITH ORDINALITY AS t(name, ord)
    ON CONFLICT (app_id, name) DO NOTHING
  `, [appId, DOCUMENT_TYPES]);
  await execQ(pool, `
    UPDATE school_document_types
       SET code=coalesce(code, upper(regexp_replace(name, '[^A-Za-z0-9]+', '_', 'g'))),
           is_mandatory=(name = ANY($2::text[])),
           applicable_to=CASE WHEN name = ANY($2::text[]) THEN 'admission' ELSE 'all' END
     WHERE app_id=$1
  `, [appId, ['Birth Certificate', 'Address Proof', 'Passport Photo']]);

  for (const role of ROLE_DEFS) {
    const [row] = await execQ(pool, `
      INSERT INTO school_roles (app_id, name, code, description, is_system)
      VALUES ($1,$2,$3,$4,true)
      ON CONFLICT (app_id, code) DO UPDATE SET name=excluded.name, description=excluded.description
      RETURNING id
    `, [appId, role.name, role.code, role.description]);
    if (row?.id) {
      await execQ(pool, `
        INSERT INTO school_role_permissions (role_id, permission_key, scope)
        SELECT DISTINCT $1::int, key, 'campus' FROM unnest($2::text[]) AS key
        ON CONFLICT (role_id, permission_key) DO NOTHING
      `, [row.id, role.perms || []]);
    }
  }

  /* Existing databases already have role rows, and the insert above only adds
     missing grants. Reconcile the hostel grants that are safe for the
     operational roles so the new module is usable without re-seeding. */
  const HOSTEL_ROLE_GRANTS = {
    HOSTEL_WARDEN: ['hostel.allocate', 'hostel.rollcall', 'hostel.leave_approve', 'hostel.visitor', 'hostel.reports'],
    FRONT_OFFICE: ['hostel.view', 'hostel.visitor'],
    ACCOUNTANT: ['hostel.view', 'hostel.fees'],
  };
  for (const [code, perms] of Object.entries(HOSTEL_ROLE_GRANTS)) {
    await execQ(pool, `
      INSERT INTO school_role_permissions (role_id, permission_key, scope)
      SELECT r.id, key, 'campus'
        FROM school_roles r
        CROSS JOIN unnest($3::text[]) AS key
       WHERE r.app_id=$1 AND r.code=$2
      ON CONFLICT (role_id, permission_key) DO NOTHING
    `, [appId, code, perms]);
  }

  const [superRole] = await execQ(pool,
    'SELECT id FROM school_roles WHERE app_id=$1 AND code=$2', [appId, 'SUPER_ADMIN']);
  if (superRole?.id) {
    await execQ(pool, `
      INSERT INTO school_user_roles (app_id, user_id, role_id)
      SELECT $1, u."UserId", $2::int
        FROM "tblHO_User" u
       WHERE upper(coalesce(u."GRP",'')) IN ('ADMIN','SUPERADMIN','SUPER ADMIN','OWNER')
      ON CONFLICT DO NOTHING
    `, [appId, superRole.id]);
  }

  await execQ(pool, `
    INSERT INTO school_approval_flows (app_id, entity_type, steps)
    VALUES
      ($1, 'fee_refund',  '[{"role":"ACCOUNTANT","label":"Accounts verification"},{"role":"PRINCIPAL","label":"Principal approval"}]'::jsonb),
      ($1, 'student_tc',  '[{"role":"ADMIN_OFFICER","label":"Records verification"},{"role":"PRINCIPAL","label":"Principal sign-off"}]'::jsonb),
      ($1, 'expense',     '[{"role":"ACCOUNTANT","label":"Budget check"},{"role":"OWNER","label":"Owner approval"}]'::jsonb)
    ON CONFLICT (app_id, entity_type) DO NOTHING
  `, [appId]);

  const [main] = await execQ(pool,
    'SELECT id FROM school_campuses WHERE app_id=$1 ORDER BY id LIMIT 1', [appId]);
  if (main?.id) {
    await execQ(pool,
      'UPDATE school_students SET campus_id=$2 WHERE app_id=$1 AND campus_id IS NULL', [appId, main.id]).catch(() => {});
  }

  seeded.add(appId);
}

export async function loadAccess(pool, appId, user) {
  const userId = String(user?.userid || '');
  const grp = String(user?.grp || '').toUpperCase();
  const roles = await execQ(pool, `
    SELECT r.id, r.code, r.name, ur.campus_id, ur.valid_from, ur.valid_to
      FROM school_user_roles ur
      JOIN school_roles r ON r.id = ur.role_id
     WHERE ur.app_id=$1 AND ur.user_id=$2
       AND (ur.valid_from IS NULL OR ur.valid_from <= current_date)
       AND (ur.valid_to   IS NULL OR ur.valid_to   >= current_date)
     ORDER BY r.code
  `, [appId, userId]);

  const isSuper = grp === 'ADMIN' || roles.some((r) => ['SUPER_ADMIN', 'OWNER'].includes(r.code));
  const perms = isSuper ? ['*'] : (await execQ(pool, `
    SELECT DISTINCT rp.permission_key, rp.scope
      FROM school_user_roles ur
      JOIN school_role_permissions rp ON rp.role_id = ur.role_id
     WHERE ur.app_id=$1 AND ur.user_id=$2
  `, [appId, userId])).map((r) => r.permission_key);

  const campuses = await execQ(pool, `
    SELECT id, name, code, type, status
      FROM school_campuses WHERE app_id=$1 AND status='active' ORDER BY id
  `, [appId]);
  const academicYears = await execQ(pool, `
    SELECT id, name, start_date, end_date, is_active
      FROM school_academic_years WHERE app_id=$1 ORDER BY start_date DESC
  `, [appId]);
  const [branding] = await execQ(pool, `
    SELECT value FROM school_settings WHERE app_id=$1 AND campus_id IS NULL AND key='branding'
  `, [appId]);

  return {
    appId,
    userId,
    isSuper,
    roles: roles.map((r) => ({ id: r.id, code: r.code, name: r.name, campusId: r.campus_id })),
    permissions: perms,
    permissionSet: new Set(perms),
    campuses,
    academicYears,
    branding: branding?.value || {},
    defaultCampusId: campuses[0]?.id || null,
    activeAcademicYearId: academicYears.find((y) => y.is_active)?.id || academicYears[0]?.id || null,
  };
}

export function can(access, permission) {
  if (!access) return false;
  if (access.isSuper || access.permissionSet.has('*')) return true;
  return access.permissionSet.has(permission);
}

export async function writeAudit(pool, req, { action, entity, entityId, before, after }) {
  try {
    await execQ(pool, `
      INSERT INTO school_audit_log
        (app_id, user_id, action, entity, entity_id, before_json, after_json, ip, device)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)
    `, [
      req.user?.company || 'default',
      String(req.user?.userid || ''),
      action,
      entity,
      entityId === null || entityId === undefined ? null : String(entityId),
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
      req.ip || null,
      String(req.headers['user-agent'] || '').slice(0, 300),
    ]);
  } catch (e) {
    console.error('[school audit]', e.message);
  }
}
