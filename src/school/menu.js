/* The complete School ERP navigation. Items marked built are wired to a
   working route; the rest stay visible with a Soon badge until their module
   is implemented. Permissions map to the server catalogue. */

export const SCHOOL_MENU = [
  {
    group: 'Core',
    key: 'dashboard', label: 'Dashboard', icon: 'bi-speedometer2',
    perm: 'dashboard.view', path: '/school/dashboard', built: true,
  },
  {
    group: 'Core',
    key: 'admission', label: 'Admission & CRM', icon: 'bi-person-plus',
    perm: 'admission.view', built: true, path: '/school/admission',
    children: [
      { key: 'leads', label: 'Enquiry Leads', path: '/school/admission/leads', built: true },
      { key: 'applications', label: 'Applications', path: '/school/admission/applications', built: true },
      { key: 'counseling', label: 'Counseling', path: '/school/admission/counseling', built: false },
      { key: 'fees', label: 'Admission Fees', path: '/school/admission/fees', built: false },
      { key: 'reports', label: 'Admission Reports', path: '/school/admission/reports', built: false },
    ],
  },
  {
    group: 'Core',
    key: 'students', label: 'Students', icon: 'bi-people',
    perm: 'students.view', built: true,
    children: [
      { key: 'list', label: 'All Students', path: '/school/students', built: true },
      { key: 'new', label: 'New Admission', path: '/school/students/new', built: true },
      { key: 'promotion', label: 'Promotion', path: '/school/students/promotion', built: true },
      { key: 'tc', label: 'Transfer & Exit', path: '/school/students/tc', built: true },
      { key: 'documents', label: 'Documents', path: '/school/students/documents', built: true },
      { key: 'health', label: 'Health Records', path: '/school/students/health', built: true },
      { key: 'discipline', label: 'Discipline', path: '/school/students/discipline', built: true },
    ],
  },
  {
    group: 'Core',
    key: 'academics', label: 'Academics', icon: 'bi-diagram-3',
    perm: 'academics.view', built: true,
    children: [
      { key: 'classes', label: 'Classes & Sections', path: '/school/academics/classes', built: true },
      { key: 'subjects', label: 'Subjects', path: '/school/academics/subjects', built: true },
      { key: 'years', label: 'Academic Years', path: '/school/academics/years', built: true },
      { key: 'allocation', label: 'Subject Allocation', path: '/school/academics/allocation', built: true },
      { key: 'rooms', label: 'Rooms', path: '/school/academics/rooms', built: true },
      { key: 'homework', label: 'Homework', path: '/school/academics/homework', built: true },
    ],
  },
  {
    group: 'Core',
    key: 'timetable', label: 'Timetable', icon: 'bi-calendar3-week',
    perm: 'timetable.view', built: true,
    children: [
      { key: 'master', label: 'Timetable Master', path: '/school/timetable/master', built: true },
      { key: 'teacher', label: 'Teacher Timetable', path: '/school/timetable/teacher', built: true },
      { key: 'student', label: 'Student Timetable', path: '/school/timetable/student', built: true },
      { key: 'substitution', label: 'Substitutions', path: '/school/timetable/substitution', built: true },
    ],
  },
  {
    group: 'Core',
    key: 'attendance', label: 'Attendance', icon: 'bi-calendar-check',
    perm: 'attendance.view', built: true,
    children: [
      { key: 'mark', label: 'Mark Attendance', path: '/school/attendance', built: true },
      { key: 'register', label: 'Register', path: '/school/attendance/register', built: true },
      { key: 'corrections', label: 'Corrections', path: '/school/attendance/corrections', built: true },
      { key: 'staff', label: 'Staff Attendance', path: '/school/attendance/staff', built: true },
      { key: 'reports', label: 'Reports', path: '/school/attendance/reports', built: true },
    ],
  },
  {
    group: 'Core',
    key: 'examinations', label: 'Examinations', icon: 'bi-journal-check',
    perm: 'exams.view', built: true,
    children: [
      { key: 'dashboard', label: 'Dashboard', path: '/school/examinations', built: true },
      { key: 'setup', label: 'Exam Setup', path: '/school/examinations/setup', built: true },
      { key: 'terms', label: 'Terms', path: '/school/examinations/terms', built: true },
      { key: 'grade-setup', label: 'Grade Setup', path: '/school/examinations/grade-setup', built: true },
      { key: 'marks', label: 'Marks Entry', path: '/school/examinations/marks', built: true },
      { key: 'results', label: 'Results', path: '/school/examinations/results', built: true },
      { key: 'report-cards', label: 'Report Cards', path: '/school/examinations/report-cards', built: true },
      { key: 'schedule', label: 'Exam Schedule', path: '/school/examinations/schedule', built: true },
      { key: 'reports', label: 'Reports', path: '/school/examinations/reports', built: true },
    ],
  },
  {
    group: 'Finance',
    key: 'fees', label: 'Fees & Accounts', icon: 'bi-cash-coin',
    perm: 'fees.view', built: true,
    children: [
      { key: 'collect', label: 'Invoices & Collection', path: '/school/fees', built: true },
      { key: 'setup', label: 'Fee Setup', path: '/school/fees/setup', built: true },
      { key: 'dues', label: 'Dues & Follow-up', path: '/school/fees/dues', built: true },
      { key: 'refunds', label: 'Refunds', path: '/school/fees/refunds', built: true },
      { key: 'reconcile', label: 'Reconciliation', path: '/school/fees/reconcile', built: true },
      { key: 'accounts', label: 'Accounts', path: '/school/fees/accounts', built: true },
    ],
  },
  {
    group: 'Finance',
    key: 'hr', label: 'HR & Payroll', icon: 'bi-person-badge',
    perm: 'hr.view', built: true,
    children: [
      { key: 'staff', label: 'Staff Directory', path: '/school/hr/staff', built: true },
      { key: 'leaves', label: 'Leave Management', path: '/school/hr/leaves', built: true },
      { key: 'payroll', label: 'Payroll', path: '/school/hr/payroll', built: true },
      { key: 'advances', label: 'Advances', path: '/school/hr/advances', built: true },
      { key: 'reports', label: 'HR Reports', path: '/school/hr/reports', built: true },
    ],
  },
  {
    group: 'Finance',
    key: 'inventory', label: 'Inventory & Assets', icon: 'bi-box-seam',
    perm: 'inventory.view', built: true,
    children: [
      { key: 'items', label: 'Items', path: '/school/inventory/items', built: true },
      { key: 'purchase', label: 'Purchase', path: '/school/inventory/purchase', built: true },
      { key: 'issue', label: 'Issue/Return', path: '/school/inventory/issue', built: true },
      { key: 'assets', label: 'Assets', path: '/school/inventory/assets', built: true },
      { key: 'stock', label: 'Stock Report', path: '/school/inventory/stock', built: true },
    ],
  },
  {
    group: 'Operations',
    key: 'transport', label: 'Transport', icon: 'bi-bus-front',
    perm: 'transport.view', built: true,
    children: [
      { key: 'routes', label: 'Routes', path: '/school/transport/routes', built: true },
      { key: 'vehicles', label: 'Vehicles', path: '/school/transport/vehicles', built: true },
      { key: 'allocation', label: 'Student Allocation', path: '/school/transport/allocation', built: true },
      { key: 'fees', label: 'Transport Fees', path: '/school/transport/fees', built: true },
      { key: 'tracking', label: 'GPS/Tracking', path: '/school/transport/tracking', built: true },
    ],
  },
  {
    group: 'Operations',
    key: 'hostel', label: 'Hostel', icon: 'bi-building',
    perm: 'hostel.view', built: true,
    children: [
      { key: 'rooms', label: 'Hostel Rooms', path: '/school/hostel/rooms', built: true },
      { key: 'allocation', label: 'Allocation', path: '/school/hostel/allocation', built: true },
      { key: 'fees', label: 'Hostel Fees', path: '/school/hostel/fees', built: true },
      { key: 'attendance', label: 'Hostel Attendance', path: '/school/hostel/attendance', built: true },
      { key: 'visitors', label: 'Visitors', path: '/school/hostel/visitors', built: true },
      { key: 'reports', label: 'Reports', path: '/school/hostel/reports', built: true },
    ],
  },
  {
    group: 'Operations',
    key: 'library', label: 'Library', icon: 'bi-book',
    perm: 'library.view', built: true,
    children: [
      { key: 'books', label: 'Books', path: '/school/library/books', built: true },
      { key: 'issue', label: 'Issue/Return', path: '/school/library/issue', built: true },
      { key: 'members', label: 'Members', path: '/school/library/members', built: true },
      { key: 'fines', label: 'Fines', path: '/school/library/fines', built: true },
      { key: 'reports', label: 'Reports', path: '/school/library/reports', built: true },
    ],
  },
  {
    group: 'Operations',
    key: 'canteen', label: 'Canteen', icon: 'bi-cup-hot',
    perm: 'canteen.view', built: true,
    children: [
      { key: 'menu', label: 'Menu', path: '/school/canteen/menu', built: true },
      { key: 'orders', label: 'Orders', path: '/school/canteen/orders', built: true },
      { key: 'billing', label: 'Billing', path: '/school/canteen/billing', built: true },
      { key: 'inventory', label: 'Inventory', path: '/school/canteen/inventory', built: true },
    ],
  },
  {
    group: 'Operations',
    key: 'frontoffice', label: 'Front Office', icon: 'bi-door-open',
    perm: 'frontoffice.view', built: true,
    children: [
      { key: 'enquiry', label: 'Enquiry', path: '/school/frontoffice/enquiry', built: true },
      { key: 'visitors', label: 'Visitors', path: '/school/frontoffice/visitors', built: true },
      { key: 'complaints', label: 'Complaints', path: '/school/frontoffice/complaints', built: true },
      { key: 'calls', label: 'Call Log', path: '/school/frontoffice/calls', built: true },
      { key: 'appointments', label: 'Appointments', path: '/school/frontoffice/appointments', built: true },
    ],
  },
  {
    group: 'Engagement',
    key: 'communication', label: 'Communication', icon: 'bi-chat-dots',
    perm: 'communication.view', built: true,
    children: [
      { key: 'sms', label: 'SMS', path: '/school/communication/sms', built: true },
      { key: 'email', label: 'Email', path: '/school/communication/email', built: true },
      { key: 'notice', label: 'Notice Board', path: '/school/communication/notice', built: true },
      { key: 'app', label: 'App Notifications', path: '/school/communication/app', built: true },
      { key: 'logs', label: 'Message Logs', path: '/school/communication/logs', built: true },
    ],
  },
  {
    group: 'Engagement',
    key: 'lms', label: 'Learning (LMS)', icon: 'bi-mortarboard',
    perm: 'lms.view', built: true,
    children: [
      { key: 'courses', label: 'Courses', path: '/school/lms/courses', built: true },
      { key: 'assignments', label: 'Assignments', path: '/school/lms/assignments', built: true },
      { key: 'quizzes', label: 'Quizzes', path: '/school/lms/quizzes', built: true },
      { key: 'materials', label: 'Study Materials', path: '/school/lms/materials', built: true },
      { key: 'progress', label: 'Progress', path: '/school/lms/progress', built: true },
    ],
  },
  {
    group: 'Engagement',
    key: 'events', label: 'Events & PTM', icon: 'bi-calendar-event',
    perm: 'events.view', built: true,
    children: [
      { key: 'calendar', label: 'Event Calendar', path: '/school/events/calendar', built: true },
      { key: 'list', label: 'Events List', path: '/school/events/list', built: true },
      { key: 'ptm', label: 'PTM Schedule', path: '/school/events/ptm', built: true },
      { key: 'gallery', label: 'Photo Gallery', path: '/school/events/gallery', built: true },
    ],
  },
  {
    group: 'Engagement',
    key: 'certificates', label: 'Certificates & ID', icon: 'bi-award',
    perm: 'certificates.view', built: true,
    children: [
      { key: 'templates', label: 'Templates', path: '/school/certificates/templates', built: true },
      { key: 'generate', label: 'Generate', path: '/school/certificates/generate', built: true },
      { key: 'idcards', label: 'ID Cards', path: '/school/certificates/idcards', built: true },
      { key: 'tc', label: 'TC Certificate', path: '/school/certificates/tc', built: true },
    ],
  },
  {
    group: 'Engagement',
    key: 'alumni', label: 'Alumni & Placement', icon: 'bi-people-fill',
    perm: 'alumni.view', built: true,
    children: [
      { key: 'directory', label: 'Alumni Directory', path: '/school/alumni/directory', built: true },
      { key: 'events', label: 'Alumni Events', path: '/school/alumni/events', built: true },
      { key: 'jobs', label: 'Job Postings', path: '/school/alumni/jobs', built: true },
      { key: 'donations', label: 'Donations', path: '/school/alumni/donations', built: true },
    ],
  },
  {
    group: 'Intelligence',
    key: 'reports', label: 'Reports & Analytics', icon: 'bi-graph-up',
    perm: 'reports.view', built: true,
    children: [
      { key: 'student', label: 'Student Reports', path: '/school/reports/student', built: true },
      { key: 'attendance', label: 'Attendance Reports', path: '/school/reports/attendance', built: true },
      { key: 'fees', label: 'Fee Reports', path: '/school/reports/fees', built: true },
      { key: 'exam', label: 'Exam Reports', path: '/school/reports/exam', built: true },
      { key: 'custom', label: 'Custom Reports', path: '/school/reports/custom', built: true },
    ],
  },
  {
    group: 'Intelligence',
    key: 'automation', label: 'Automation Center', icon: 'bi-lightning-charge',
    perm: 'automation.view', built: true,
    children: [
      { key: 'rules', label: 'Rules & Runs', path: '/school/automation', built: true },
      { key: 'templates', label: 'Message Templates', path: '/school/automation/templates', built: true },
      { key: 'providers', label: 'Channel Providers', path: '/school/automation/providers', built: true },
    ],
  },
  {
    group: 'Intelligence',
    key: 'import', label: 'Import & Export', icon: 'bi-arrow-left-right',
    perm: 'import.view', built: true,
    children: [
      { key: 'students', label: 'Import Students', path: '/school/import/students', built: true },
      { key: 'fees', label: 'Import Fees', path: '/school/import/fees', built: true },
      { key: 'attendance', label: 'Import Attendance', path: '/school/import/attendance', built: true },
      { key: 'export', label: 'Export Data', path: '/school/import/export', built: true },
    ],
  },
  {
    group: 'Intelligence',
    key: 'ai', label: 'AI Assistant', icon: 'bi-stars',
    perm: 'ai.view', built: true,
    path: '/school/ai',
  },
  {
    group: 'Administration',
    key: 'settings', label: 'Settings', icon: 'bi-gear',
    perm: 'settings.view', built: true,
    children: [
      { key: 'institute', label: 'Institute Profile', path: '/school/settings/institute', built: true },
      { key: 'campuses', label: 'Campuses', path: '/school/settings/campuses', built: true },
      { key: 'roles', label: 'Roles & Permissions', path: '/school/settings/roles', built: true },
      { key: 'groups', label: 'Groups', path: '/school/settings/groups', built: true },
      { key: 'audit', label: 'Audit Trail', path: '/school/settings/audit', built: true },
      { key: 'users', label: 'Users & Access', path: '/school/settings/users', built: true },
      { key: 'approvals', label: 'Approvals', path: '/school/settings/approvals', built: true },
      { key: 'integrations', label: 'Integrations', path: '/school/settings/integrations', built: true },
      { key: 'subscription', label: 'Subscription', path: '/school/settings/subscription', built: true },
    ],
  },
  {
    group: 'Administration',
    key: 'platform', label: 'Platform / Super Admin', icon: 'bi-shield-lock',
    perm: 'platform.view', built: true, superOnly: true,
    path: '/school/platform',
  },
];

export const SCHOOL_GROUPS = ['Core', 'Finance', 'Operations', 'Engagement', 'Intelligence', 'Administration'];

export function canUse(me, item) {
  if (!item?.perm) return true;
  // Show built items even while me is loading; permissions enforced after me loads
  if (!me) return item.built !== false;
  if (item.superOnly && !me?.isSuper) return false;
  if (me.isSuper || me.permissions?.includes('*')) return true;
  return (me.permissions || []).includes(item.perm);
}

export function findRoute(moduleKey, subKey) {
  const mod = SCHOOL_MENU.find((m) => m.key === moduleKey);
  if (!mod) return null;
  if (!mod.children) return { module: mod, child: null };
  const child = mod.children.find((c) => c.key === subKey) || mod.children[0];
  return { module: mod, child };
}
