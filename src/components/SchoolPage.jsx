import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, apiPut, apiDelete, apiUpload } from '../api';
import { toast } from '../toast';
import StudentProfile from './StudentProfile';
import StudentPhoto from './StudentPhoto';
import PrintButton from './PrintButton';
import SchoolSettings from './SchoolSettings';
import Admissions from '../school/students/Admissions';
import Promotion from '../pages/school/students/Promotion';
import TransferExit from '../pages/school/students/TransferExit';
import Documents from '../pages/school/students/Documents';
import Health from '../pages/school/students/Health';
import Discipline from '../pages/school/students/Discipline';
import ClassesSections from '../pages/school/academics/ClassesSections';
import Subjects from '../pages/school/academics/Subjects';
import AcademicYears from '../pages/school/academics/AcademicYears';
import SubjectAllocation from '../pages/school/academics/SubjectAllocation';
import Rooms from '../pages/school/academics/Rooms';
import Homework from '../pages/school/academics/Homework';
import TimetableMaster from '../pages/school/timetable/TimetableMaster';
import TeacherTimetable from '../pages/school/timetable/TeacherTimetable';
import StudentTimetable from '../pages/school/timetable/StudentTimetable';
import Substitutions from '../pages/school/timetable/Substitutions';
import MarkAttendance from '../pages/school/attendance/MarkAttendance';
import AttendanceRegister from '../pages/school/attendance/Register';
import Corrections from '../pages/school/attendance/Corrections';
import StaffAttendance from '../pages/school/attendance/StaffAttendance';
import AttendanceReports from '../pages/school/attendance/Reports';
import CollectionDashboard from '../pages/school/fee/CollectionDashboard';
import FeeSetupDashboard from '../pages/school/fee/FeeSetupDashboard';
import FeeHeads from '../pages/school/fee/FeeHeads';
import FeeCategories from '../pages/school/fee/FeeCategories';
import FeeStructures, { Installments, FineRules, ConcessionTypes, StudentAssignments, Families, CounterCollection, ReceiptsList, InvoicesList, Cheques, OnlinePaymentsDashboard, CashierDay } from '../pages/school/fee/PlaceholderComponents.jsx';
import DuesDashboard from '../pages/school/fee/DuesDashboard';
import RefundsDashboard from '../pages/school/fee/RefundsDashboard';
import ReconciliationDashboard from '../pages/school/fee/ReconciliationDashboard';
import AccountsDashboard from '../pages/school/fee/AccountsDashboard';
import { AgeingReport, DefaultersList, Reminders, FollowUps, PaymentPlans, BlockPolicies, RefundRequests, RefundRules, CreditNotes, Deposits, CashierReconciliation, ChequeReconciliation, GatewayReconciliation, BankReconciliation, ExceptionsList, FeeReportsDashboard } from '../pages/school/fee/PlaceholderComponents.jsx';
import StaffList from '../pages/school/hr/StaffList';
import StaffProfile from '../pages/school/hr/StaffProfile';
import StaffForm from '../pages/school/hr/StaffForm';
import OnboardingChecklist from '../pages/school/hr/OnboardingChecklist';
import ExitSettlement from '../pages/school/hr/ExitSettlement';
import StaffLetters from '../pages/school/hr/StaffLetters';
import LeaveTypes from '../pages/school/hr/LeaveTypes';
import LeavePolicies from '../pages/school/hr/LeavePolicies';
import LeaveBalances from '../pages/school/hr/LeaveBalances';
import ApplyLeave from '../pages/school/hr/ApplyLeave';
import LeaveApprovals from '../pages/school/hr/LeaveApprovals';
import LeaveCalendar from '../pages/school/hr/LeaveCalendar';
import CompOff from '../pages/school/hr/CompOff';
import Holidays from '../pages/school/hr/Holidays';
import SalaryComponents from '../pages/school/hr/SalaryComponents';
import SalaryStructures from '../pages/school/hr/SalaryStructures';
import StructureBuilder from '../pages/school/hr/StructureBuilder';
import SalaryAssignments from '../pages/school/hr/SalaryAssignments';
import StatutoryRules from '../pages/school/hr/StatutoryRules';
import PayrollRuns from '../pages/school/hr/PayrollRuns';
import PayrollWizard from '../pages/school/hr/PayrollWizard';
import PayslipView from '../pages/school/hr/PayslipView';
import BankAdvice from '../pages/school/hr/BankAdvice';
import SalaryRegister from '../pages/school/hr/SalaryRegister';
import StatutoryReports from '../pages/school/hr/StatutoryReports';
import TaxDeclarations from '../pages/school/hr/TaxDeclarations';
import AdvanceList from '../pages/school/hr/AdvanceList';
import AdvanceRequest from '../pages/school/hr/AdvanceRequest';
import AdvanceDetail from '../pages/school/hr/AdvanceDetail';
import AdvanceDashboard from '../pages/school/hr/AdvanceDashboard';
import ReportsDashboard from '../pages/school/hr/ReportsDashboard';
import ReportView from '../pages/school/hr/ReportView';
import HRSettings from '../pages/school/hr/HRSettings';
import Notifications from '../pages/school/hr/Notifications';
import SelfProfile from '../pages/school/hr/SelfProfile';
import SelfLeave from '../pages/school/hr/SelfLeave';
import SelfPayslips from '../pages/school/hr/SelfPayslips';
import SelfTax from '../pages/school/hr/SelfTax';
import SelfAdvances from '../pages/school/hr/SelfAdvances';
import SelfDocuments from '../pages/school/hr/SelfDocuments';
import ExamDashboard from '../pages/school/examinations/ExamDashboard';
import ExamSetup from '../pages/school/examinations/ExamSetup';
import Terms from '../pages/school/examinations/Terms';
import GradeSetup from '../pages/school/examinations/GradeSetup';
import MarksDashboard from '../pages/school/examinations/MarksDashboard';
import MarksEntry from '../pages/school/examinations/MarksEntry';
import MarksTools from '../pages/school/examinations/MarksTools';
import ResultsDashboard from '../pages/school/examinations/ResultsDashboard';
import ReportCardsDashboard from '../pages/school/examinations/ReportCardsDashboard';
import ReportCardTemplates from '../pages/school/examinations/ReportCardTemplates';
import ExamSchedule from '../pages/school/examinations/ExamSchedule';
import ScheduleTools from '../pages/school/examinations/ScheduleTools';
import ExamReports from '../pages/school/examinations/Reports';
import InventoryItems from '../pages/school/inventory/Items';
import InventoryPurchase from '../pages/school/inventory/Purchase';
import InventoryIssueReturn from '../pages/school/inventory/IssueReturn';
import InventoryAssets from '../pages/school/inventory/Assets';
import InventoryStockReport from '../pages/school/inventory/StockReport';
import TransportRoutes from '../pages/school/transport/Routes';
import TransportVehicles from '../pages/school/transport/Vehicles';
import TransportAllocation from '../pages/school/transport/Allocation';
import TransportFees from '../pages/school/transport/TransportFees';
import TransportTracking from '../pages/school/transport/Tracking';
import HostelRooms from '../pages/school/hostel/Rooms';
import HostelAllocation from '../pages/school/hostel/Allocation';
import HostelFees from '../pages/school/hostel/Fees';
import HostelAttendance from '../pages/school/hostel/Attendance';
import HostelVisitors from '../pages/school/hostel/Visitors';
import HostelReports from '../pages/school/hostel/Reports';
import LibraryBooks from '../pages/school/library/Books';
import LibraryCounter from '../pages/school/library/Counter';
import LibraryMembers from '../pages/school/library/Members';
import LibraryFines from '../pages/school/library/Fines';
import LibraryReports from '../pages/school/library/Reports';
import CanteenMenu from '../pages/school/canteen/Menu';
import CanteenOrders from '../pages/school/canteen/Orders';
import CanteenBilling from '../pages/school/canteen/Billing';
import CanteenInventory from '../pages/school/canteen/Inventory';
import FrontOfficeEnquiries from '../pages/school/front_office/Enquiries';
import FrontOfficeVisitors from '../pages/school/front_office/Visitors';
import FrontOfficeComplaints from '../pages/school/front_office/Complaints';
import FrontOfficeCallLog from '../pages/school/front_office/CallLog';
import FrontOfficeAppointments from '../pages/school/front_office/Appointments';
import CommunicationDashboard from '../pages/school/communication/Dashboard';
import CommunicationSMS from '../pages/school/communication/SMS';
import CommunicationEmail from '../pages/school/communication/Email';
import CommunicationNotice from '../pages/school/communication/Notice';
import CommunicationApp from '../pages/school/communication/App';
import CommunicationTemplates from '../pages/school/communication/Templates';
import CommunicationLogs from '../pages/school/communication/Logs';
import CommunicationReports from '../pages/school/communication/Reports';
import CommunicationProviders from '../pages/school/communication/Providers';
import CommunicationAutomations from '../pages/school/communication/Automations';
import LMSCourses from '../pages/school/lms/Courses';
import LMSAssignments from '../pages/school/lms/Assignments';
import LMSQuizzes from '../pages/school/lms/Quizzes';
import LMSMaterials from '../pages/school/lms/Materials';
import LMSProgress from '../pages/school/lms/Progress';
import LMSReports from '../pages/school/lms/Reports';
import EventsCalendar from '../pages/school/events/Calendar';
import EventsList from '../pages/school/events/List';
import EventsPTM from '../pages/school/events/PTM';
import EventsGallery from '../pages/school/events/Gallery';
import CertificatesTemplates from '../pages/school/certificates/Templates';
import CertificatesGenerate from '../pages/school/certificates/Generate';
import CertificatesIDCards from '../pages/school/certificates/IDCards';
import CertificatesTC from '../pages/school/certificates/TC';
import CertificatesRegister from '../pages/school/certificates/Register';
import CertificatesVerify from '../pages/school/certificates/Verify';
import AlumniDashboard from '../pages/school/alumni/Dashboard';
import AlumniRegistration from '../pages/school/alumni/Registration';
import AlumniDirectory from '../pages/school/alumni/Directory';
import AlumniProfile from '../pages/school/alumni/Profile';
import AlumniVerification from '../pages/school/alumni/Verification';
import AlumniEvents from '../pages/school/alumni/Events';
import AlumniJobs from '../pages/school/alumni/Jobs';
import AlumniDonations from '../pages/school/alumni/Donations';
import StudentReports from '../pages/school/reports/StudentReports';
import ReportsAttendanceReports from '../pages/school/reports/AttendanceReports';
import FeeReports from '../pages/school/reports/FeeReports';
import ReportsExamReports from '../pages/school/reports/ExamReports';
import CustomReports from '../pages/school/reports/CustomReports';
import AutomationRules from '../pages/school/automation/Rules';
import AutomationTemplates from '../pages/school/automation/Templates';
import AutomationProviders from '../pages/school/automation/Providers';
import ImportStudents from '../pages/school/import/ImportStudents';
import ImportFees from '../pages/school/import/ImportFees';
import ImportAttendance from '../pages/school/import/ImportAttendance';
import ExportData from '../pages/school/import/ExportData';

const TABS = [
  ['overview', 'Overview', 'bi-grid-1x2'],
  ['students', 'Students', 'bi-people'],
  ['classes', 'Classes & Subjects', 'bi-diagram-3'],
  ['attendance', 'Attendance', 'bi-calendar-check'],
  ['fees', 'Fees', 'bi-cash-coin'],
  ['automations', 'Automations', 'bi-lightning-charge'],
];

const TAB_PATH = {
  overview: '/school/dashboard',
  students: '/school/students',
  classes: '/school/academics/classes',
  attendance: '/school/attendance',
  fees: '/school/fees',
  automations: '/school/automation',
};

const TAB_FOR = {
  dashboard: 'overview',
  students: 'students',
  academics: 'classes',
  attendance: 'attendance',
  fees: 'fees',
  automation: 'automations',
  admission: 'admission',
  timetable: 'timetable',
  exams: 'exams',
  hr: 'hr',
  transport: 'transport',
  hostel: 'hostel',
  library: 'library',
  canteen: 'canteen',
  frontoffice: 'frontoffice',
  communication: 'communication',
  lms: 'lms',
  events: 'events',
  certificates: 'certificates',
  alumni: 'alumni',
  reports: 'reports',
  import: 'import',
  ai: 'ai',
  platform: 'platform',
  inventory: 'inventory',
};

const today = () => new Date().toISOString().slice(0, 10);
const money = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(v || 0));
const fullName = (s) => `${s?.first_name || ''} ${s?.last_name || ''}`.trim();
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-IN') : '—');
const toDateInput = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function Stat({ label, value, sub, icon, tone }) {
  return (
    <div className={`school-stat tone-${tone || 'slate'}`}>
      <div className="school-stat-icon"><i className={`bi ${icon}`}></i></div>
      <div>
        <div className="school-stat-value">{value}</div>
        <div className="school-stat-label">{label}</div>
        {sub && <div className="school-stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

function Empty({ icon = 'bi-inbox', text = 'Nothing here yet' }) {
  return (
    <div className="school-empty">
      <i className={`bi ${icon}`}></i>
      <span>{text}</span>
    </div>
  );
}

export default function SchoolPage({
  module = 'dashboard',
  sub = '',
  rest = [],
  me = null,
  campusId = '',
  academicYearId = '',
  onNavigate = () => {},
  onRefreshMe = () => {},
} = {}) {
  const initialTab = TAB_FOR[module] || 'overview';
  const [tab, setTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [dash, setDash] = useState(null);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [fees, setFees] = useState({ heads: [], invoices: [], payments: [], summary: {} });
  const [att, setAtt] = useState({ date: today(), students: [], counts: {}, policies: [], registerId: null, registerVersion: 1 });
  const [auto, setAuto] = useState({ rules: [], logs: [], counts: {} });

  const [studentForm, setStudentForm] = useState(null);
  const [studentPhotoFile, setStudentPhotoFile] = useState(null);
  const [studentPhotoPreviewUrl, setStudentPhotoPreviewUrl] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [classDraft, setClassDraft] = useState({ name: '', stream: '', sortOrder: '' });
  const [sectionDraft, setSectionDraft] = useState({ classId: '', name: 'A', capacity: 40, classTeacher: '' });
  const [subjectDraft, setSubjectDraft] = useState({ code: '', name: '', classId: '', maxMarks: 100 });
  const [editingClassId, setEditingClassId] = useState(null);
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [invoiceDraft, setInvoiceDraft] = useState({ studentId: '', title: 'Tuition Fee', amount: '', dueDate: today() });
  const [payDraft, setPayDraft] = useState({ invoiceId: '', amount: '', method: 'cash', reference: '' });
  const [filters, setFilters] = useState({ q: '', classId: '', sectionId: '', status: 'active' });
  const [attFilter, setAttFilter] = useState({ classId: '', sectionId: '' });

  useEffect(() => {
    if (!studentPhotoFile) {
      setStudentPhotoPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(studentPhotoFile);
    setStudentPhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [studentPhotoFile]);

  const classOptions = useMemo(
    () => classes.map((c) => ({ id: c.id, name: c.name, sections: c.sections || [] })),
    [classes],
  );
  const sectionOptions = useMemo(() => {
    const c = classOptions.find((x) => String(x.id) === String(studentForm?.classId || ''));
    return c ? c.sections : [];
  }, [classOptions, studentForm?.classId]);

  async function loadDash() {
    const d = await apiGet('/school/dashboard');
    if (!d?.ok) throw new Error(d?.error || 'Could not refresh the school dashboard');
    setDash(d);
  }
  async function loadStudents() {
    const p = new URLSearchParams();
    if (filters.q) p.set('q', filters.q);
    if (filters.classId) p.set('classId', filters.classId);
    if (filters.sectionId) p.set('sectionId', filters.sectionId);
    if (filters.status) p.set('status', filters.status);
    if (campusId) p.set('campusId', campusId);
    const d = await apiGet(`/school/students?${p.toString()}`);
    if (!d?.ok) throw new Error(d?.error || 'Could not refresh students');
    setStudents(d.students || []);
  }
  async function refreshStudentViews(action) {
    const results = await Promise.allSettled([loadStudents(), loadDash()]);
    const failures = results.flatMap((result, index) => (
      result.status === 'rejected'
        ? [`${index === 0 ? 'student list' : 'dashboard'} (${result.reason?.message || 'refresh failed'})`]
        : []
    ));
    if (failures.length) toast(`${action}, but ${failures.join(' and ')} could not be refreshed`, 'warning');
  }
  async function loadClasses() {
    const d = await apiGet('/school/classes');
    if (d?.ok) { setClasses(d.classes || []); setSubjects(d.subjects || []); }
  }
  async function loadAttendance(date = att.date, filtersIn = attFilter) {
    const p = new URLSearchParams({ date });
    if (filtersIn.sectionId) p.set('sectionId', filtersIn.sectionId);
    // Load policies for status options
    const pol = await apiGet('/school/attendance/policies');
    if (pol?.ok) setAtt((a) => ({ ...a, policies: pol.policies || [] }));
    // Find existing register
    const d = await apiGet(`/school/attendance/registers?${p.toString()}`);
    if (d?.ok && d.registers?.length) {
      const reg = d.registers[0];
      setAtt((a) => ({ ...a, registerId: reg.id, registerVersion: reg.version }));
      // Load entries
      const e = await apiGet(`/school/attendance/registers/${reg.id}`);
      if (e?.ok) {
        const entries = e.entries || [];
        const rowMap = {};
        entries.forEach((en) => {
          rowMap[en.student_id] = {
            id: en.student_id,
            admission_no: en.admission_no,
            first_name: en.first_name,
            last_name: en.last_name,
            roll_no: en.roll_no,
            status: en.status_code,
            remarks: en.remark || '',
          };
        });
        const rowsList = Object.values(rowMap).sort((a, b) => {
          const ra = a.roll_no || '';
          const rb = b.roll_no || '';
          return ra.localeCompare(rb) || a.first_name.localeCompare(b.first_name);
        });
        const c = { present: 0, absent: 0, late: 0, excused: 0, total: rowsList.length };
        rowsList.forEach((r) => {
          const pol2 = att.policies.find((x) => x.code === r.status);
          const cat = pol2 ? pol2.category : '';
          if (cat === 'present') c.present++;
          else if (cat === 'absent') c.absent++;
          else if (cat === 'late') c.late++;
          else if (cat === 'excused') c.excused++;
        });
        setAtt({ date, students: rowsList, counts: c, policies: att.policies, registerId: reg.id, registerVersion: reg.version });
      }
    } else {
      setAtt({ date, students: [], counts: {}, policies: att.policies, registerId: null, registerVersion: 1 });
    }
  }
  async function loadFees() {
    const d = await apiGet('/school/fees');
    if (d?.ok) setFees({ heads: d.heads || [], invoices: d.invoices || [], payments: d.payments || [], summary: d.summary || {} });
  }
  async function loadAutomations() {
    const d = await apiGet('/school/automations');
    if (d?.ok) setAuto({ rules: d.rules || [], logs: d.logs || [], counts: d.counts || {} });
  }

  async function reload() {
    setLoading(true);
    try {
      if (tab === 'overview') await loadDash();
      else if (tab === 'students') { await Promise.all([loadStudents(), loadClasses()]); }
      else if (tab === 'classes') await loadClasses();
      else if (tab === 'attendance') { await Promise.all([loadAttendance(), loadClasses()]); }
      else if (tab === 'fees') { await Promise.all([loadFees(), loadClasses(), loadStudents()]); }
      else if (tab === 'automations') await loadAutomations();
    } catch (e) {
      toast(e.message || 'Could not load school data', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const next = TAB_FOR[module] || 'overview';
    setTab(next);
  }, [module]);

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab]);

  useEffect(() => {
    if (tab !== 'students') return;
    const t = setTimeout(() => { loadStudents().catch((error) => toast(error.message, 'error')); }, 250);
    return () => clearTimeout(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [filters.q, filters.classId, filters.sectionId, filters.status, tab, campusId]);

  /* ---------- student actions ---------- */
  const blankStudent = () => ({
    admissionNo: '', firstName: '', lastName: '', middleName: '', gender: '', dob: '',
    classId: '', sectionId: '', rollNo: '', guardianName: '', guardianPhone: '',
    guardianEmail: '', address: '', admissionDate: today(), status: 'active',
    bloodGroup: '', nationality: '', category: '', previousSchool: '', nationalId: '', house: '', campusId: campusId || '',
    photoUrl: '', officialName: '', birthCertificateNo: '', aadhaarNo: '', passportNo: '',
    placeOfBirth: '', religion: '', motherTongue: '', emergencyContactName: '',
    emergencyContactPhone: '', fatherName: '', fatherOccupation: '', fatherContact: '',
    fatherEmail: '', motherName: '', motherOccupation: '', motherContact: '', motherEmail: '',
    permanentAddress: '', signatureUrl: '', pickupAuthorized: '', allergies: '',
    medicalConditions: '', regularMedications: '', doctorName: '', doctorContact: '',
    preferredHospital: '', transportRequired: false, hostelRequired: false,
  });

  function editStudent(s) {
    setStudentPhotoFile(null);
    setStudentForm({
      id: s.id, admissionNo: s.admission_no, firstName: s.first_name, lastName: s.last_name, middleName: s.middle_name || '',
      gender: s.gender || '', dob: toDateInput(s.dob), classId: s.class_id || '',
      sectionId: s.section_id || '', rollNo: s.roll_no || '', guardianName: s.guardian_name || '',
      guardianPhone: s.guardian_phone || '', guardianEmail: s.guardian_email || '',
      address: s.address || '', admissionDate: toDateInput(s.admission_date) || today(),
      status: s.status || 'active', bloodGroup: s.blood_group || '', nationality: s.nationality || '',
      category: s.category || '', previousSchool: s.previous_school || '', nationalId: s.national_id || '',
      house: s.house || '', campusId: s.campus_id || campusId || '',
      photoUrl: s.photo_url || '',
      officialName: s.official_name || s.name_as_per_certificate || '',
      birthCertificateNo: s.birth_certificate_no || '', aadhaarNo: s.aadhaar_no || '',
      passportNo: s.passport_no || '', placeOfBirth: s.place_of_birth || '',
      religion: s.religion || '', motherTongue: s.mother_tongue || '',
      emergencyContactName: s.emergency_contact_name || '',
      emergencyContactPhone: s.emergency_contact_phone || '',
      fatherName: s.father_name || '', fatherOccupation: s.father_occupation || '',
      fatherContact: s.father_contact || '', fatherEmail: s.father_email || '',
      motherName: s.mother_name || '', motherOccupation: s.mother_occupation || '',
      motherContact: s.mother_contact || '', motherEmail: s.mother_email || '',
      permanentAddress: s.permanent_address || '', signatureUrl: s.signature_url || '',
      pickupAuthorized: Array.isArray(s.pickup_authorized) ? s.pickup_authorized.join(', ') : '',
      allergies: s.allergies || '', medicalConditions: s.medical_conditions || '',
      regularMedications: s.regular_medications || '', doctorName: s.doctor_name || '',
      doctorContact: s.doctor_contact || '', preferredHospital: s.preferred_hospital || '',
      transportRequired: !!s.transport_required, hostelRequired: !!s.hostel_required,
    });
  }

  async function saveStudent(e) {
    e.preventDefault();
    if (!studentForm?.firstName?.trim()) return toast('First name is required', 'error');
    const isEditing = Boolean(studentForm.id);
    try {
      const photo = studentPhotoFile ? await apiUpload('/school/uploads', studentPhotoFile, 'photo') : null;
      const body = {
        ...studentForm,
        photoUrl: photo?.upload.fileUrl || studentForm.photoUrl,
        pickupAuthorized: studentForm.pickupAuthorized.split(',').map((name) => name.trim()).filter(Boolean),
      };
      if (!body.classId) body.classId = null;
      if (!body.sectionId) body.sectionId = null;
      const res = studentForm.id
        ? await apiPut(`/school/students/${studentForm.id}`, body)
        : await apiPost('/school/students', body);
      if (!res?.ok) throw new Error(res?.error || 'Could not save student');
    } catch (error) {
      toast(error.message || 'Could not save student', 'error');
      return;
    }

    toast(isEditing ? 'Student updated' : 'Student admitted', 'success');
    setStudentForm(null);
    setStudentPhotoFile(null);
    await refreshStudentViews('Student saved');
  }

  async function removeStudent(s) {
    if (!window.confirm(`Archive ${fullName(s)} (${s.admission_no})? This keeps history but hides the student from active lists.`)) return;
    try {
      const res = await apiDelete(`/school/students/${s.id}`);
      if (!res?.ok) throw new Error(res?.error || 'Could not archive student');
    } catch (error) {
      toast(error.message || 'Could not archive student', 'error');
      return;
    }
    toast('Student archived', 'success');
    await refreshStudentViews('Student archived');
  }

  /* ---------- class actions ---------- */
  async function addClass(e) {
    e.preventDefault();
    const res = editingClassId
      ? await apiPut(`/school/classes/${editingClassId}`, classDraft)
      : await apiPost('/school/classes', classDraft);
    if (res?.ok) {
      toast(editingClassId ? 'Class updated' : 'Class created', 'success');
      setClassDraft({ name: '', stream: '', sortOrder: '' });
      setEditingClassId(null);
      loadClasses();
    } else toast(res?.error || 'Could not save class', 'error');
  }
  async function addSection(e) {
    e.preventDefault();
    const res = editingSectionId
      ? await apiPut(`/school/sections/${editingSectionId}`, sectionDraft)
      : await apiPost('/school/sections', sectionDraft);
    if (res?.ok) {
      toast(editingSectionId ? 'Section updated' : 'Section added', 'success');
      setSectionDraft({ classId: '', name: 'A', capacity: 40, classTeacher: '' });
      setEditingSectionId(null);
      loadClasses();
    } else toast(res?.error || 'Could not save section', 'error');
  }
  function editClass(c) {
    setEditingClassId(c.id);
    setClassDraft({ name: c.name, stream: c.stream || '', sortOrder: c.sort_order ?? '' });
  }
  function editSection(section) {
    setEditingSectionId(section.id);
    setSectionDraft({
      classId: section.class_id,
      name: section.name,
      capacity: section.capacity,
      classTeacher: section.classTeacher || section.class_teacher || '',
    });
  }
  async function removeClass(c) {
    if (!window.confirm(`Delete ${c.name}? Its sections will be removed and students will be unassigned.`)) return;
    const res = await apiDelete(`/school/classes/${c.id}`);
    if (res?.ok) { toast('Class deleted', 'success'); loadClasses(); } else toast(res?.error || 'Could not delete', 'error');
  }
  async function removeSection(sec) {
    if (!window.confirm(`Delete section ${sec.name}?`)) return;
    const res = await apiDelete(`/school/sections/${sec.id}`);
    if (res?.ok) { toast('Section deleted', 'success'); loadClasses(); } else toast(res?.error || 'Could not delete', 'error');
  }
  async function addSubject(e) {
    e.preventDefault();
    const res = editingSubjectId
      ? await apiPut(`/school/subjects/${editingSubjectId}`, subjectDraft)
      : await apiPost('/school/subjects', subjectDraft);
    if (res?.ok) {
      toast(editingSubjectId ? 'Subject updated' : 'Subject added', 'success');
      setSubjectDraft({ code: '', name: '', classId: '', maxMarks: 100 });
      setEditingSubjectId(null);
      loadClasses();
    } else toast(res?.error || 'Could not save subject', 'error');
  }
  function editSubject(subject) {
    setEditingSubjectId(subject.id);
    setSubjectDraft({
      code: subject.code || '',
      name: subject.name,
      classId: subject.class_id || '',
      maxMarks: subject.max_marks,
    });
  }
  async function removeSubject(s) {
    if (!window.confirm(`Delete subject ${s.name}?`)) return;
    const res = await apiDelete(`/school/subjects/${s.id}`);
    if (res?.ok) { toast('Subject removed', 'success'); loadClasses(); } else toast(res?.error || 'Could not remove', 'error');
  }

  /* ---------- attendance actions ---------- */
  function setAttStatus(id, status) {
    setAtt((a) => ({ ...a, students: a.students.map((s) => (s.id === id ? { ...s, status } : s)) }));
  }
  function setAttRemark(id, remarks) {
    setAtt((a) => ({ ...a, students: a.students.map((s) => (s.id === id ? { ...s, remarks } : s)) }));
  }
  async function saveAttendance() {
    if (!attFilter.sectionId) return toast('Select a section first', 'error');
    // Ensure a register exists
    let regId = att.registerId;
    if (!regId) {
      const d = await apiPost('/school/attendance/registers', { date: att.date, sectionId: attFilter.sectionId });
      if (d?.ok) {
        regId = d.register.id;
        setAtt((a) => ({ ...a, registerId: regId, registerVersion: d.register.version }));
      } else {
        return toast(d?.error || 'Could not create register', 'error');
      }
    }
    const entries = att.students
      .filter((s) => s.status)
      .map((s) => ({ studentId: s.id, statusCode: s.status, lateMinutes: 0, partialMinutes: 0, remark: s.remarks || null }));
    if (!entries.length) return toast('Mark at least one student first', 'error');
    const res = await apiPost(`/school/attendance/registers/${regId}/entries`, { entries, version: att.registerVersion });
    if (res?.ok) { toast(`Attendance saved for ${res.saved} students`, 'success'); loadAttendance(); }
    else toast(res?.error || 'Could not save attendance', 'error');
  }
  function markAll(status) {
    setAtt((a) => ({ ...a, students: a.students.map((s) => ({ ...s, status })) }));
  }

  /* ---------- fee actions ---------- */
  async function createInvoice(e) {
    e.preventDefault();
    const res = await apiPost('/school/fees/invoices', invoiceDraft);
    if (res?.ok) {
      toast('Invoice created', 'success');
      setInvoiceDraft({ studentId: '', title: 'Tuition Fee', amount: '', dueDate: today() });
      loadFees(); loadDash();
    } else toast(res?.error || 'Could not create invoice', 'error');
  }
  function startPay(inv) {
    setPayDraft({ invoiceId: inv.id, amount: String(Number(inv.amount) - Number(inv.paid_amount)), method: 'cash', reference: '' });
  }
  async function recordPayment(e) {
    e.preventDefault();
    const res = await apiPost('/school/fees/payments', payDraft);
    if (res?.ok) {
      toast('Payment recorded', 'success');
      setPayDraft({ invoiceId: '', amount: '', method: 'cash', reference: '' });
      loadFees(); loadDash();
    } else toast(res?.error || 'Could not record payment', 'error');
  }

  /* ---------- automation actions ---------- */
  async function toggleRule(rule) {
    const res = await apiPost('/school/automations', {
      code: rule.code, name: rule.name, eventType: rule.event_type,
      channels: rule.channels, enabled: !rule.enabled, template: rule.template, config: rule.config,
    });
    if (res?.ok) { toast(`${rule.name} ${rule.enabled ? 'paused' : 'enabled'}`, 'success'); loadAutomations(); }
    else toast(res?.error || 'Could not update rule', 'error');
  }
  async function runAutomations() {
    setLoading(true);
    try {
      const res = await apiPost('/school/automations/run', {});
      if (res?.ok) {
        toast(`${res.feeReminders} fee reminder(s) + ${res.absenceAlerts} absence alert(s) queued (simulated)`, 'success');
        loadAutomations(); loadDash();
      } else toast(res?.error || 'Automation run failed', 'error');
    } finally { setLoading(false); }
  }
  async function clearLogs() {
    if (!window.confirm('Clear the notification log?')) return;
    const res = await apiDelete('/school/automations/logs');
    if (res?.ok) { toast('Notification log cleared', 'success'); loadAutomations(); }
  }

  const selectedStudentSections = useMemo(() => {
    const c = classOptions.find((x) => String(x.id) === String(studentForm?.classId || ''));
    return c ? c.sections : [];
  }, [classOptions, studentForm?.classId]);

  if (module === 'admission') {
    return (
      <Admissions
        mode={sub === 'applications' ? 'applications' : 'inquiries'}
        onNavigate={onNavigate}
      />
    );
  }

  if (module === 'students') {
    const backToStudents = () => onNavigate('/school/students');
    if (sub === 'new') return <Admissions mode="inquiries" onBack={backToStudents} />;
    if (sub === 'promotion') return <Promotion academicYears={me?.academicYears || []} onBack={backToStudents} />;
    if (sub === 'tc') return <TransferExit onBack={backToStudents} />;
    if (sub === 'documents') return <Documents onBack={backToStudents} />;
    if (sub === 'health') return <Health onBack={backToStudents} />;
    if (sub === 'discipline') return <Discipline onBack={backToStudents} />;
  }

  if (module === 'academics') {
    if (!sub || sub === 'classes') return <ClassesSections me={me} onNavigate={onNavigate} />;
    if (sub === 'subjects') return <Subjects me={me} onNavigate={onNavigate} />;
    if (sub === 'years') return <AcademicYears me={me} onNavigate={onNavigate} onRefreshMe={onRefreshMe} />;
    if (sub === 'allocation') return <SubjectAllocation me={me} onNavigate={onNavigate} academicYearId={academicYearId} />;
    if (sub === 'rooms') return <Rooms me={me} campusId={campusId} onNavigate={onNavigate} />;
    if (sub === 'homework') return <Homework me={me} onNavigate={onNavigate} academicYearId={academicYearId} />;
    return (
      <div className="page-content animate-fade">
        <div className="card">
          <div className="card-body text-center py-5">
            <i className="bi bi-cone-striped d-block mb-2" style={{ fontSize: 30 }}></i>
            <h6 className="fw-bold">Academic screen not built</h6>
            <p className="text-muted small mb-3">
              “{sub}” is not one of the six Academics screens, so nothing has been substituted for it.
            </p>
            <div className="d-flex gap-2 justify-content-center flex-wrap">
              <button type="button" className="btn btn-sm btn-primary" onClick={() => onNavigate('/school/academics/classes')}>Classes &amp; Sections</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/academics/subjects')}>Subjects</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/academics/years')}>Academic Years</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/academics/allocation')}>Subject Allocation</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/academics/rooms')}>Rooms</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/academics/homework')}>Homework</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (module === 'timetable') {
    if (!sub || sub === 'master') return <TimetableMaster me={me} onNavigate={onNavigate} academicYearId={academicYearId} />;
    if (sub === 'teacher') return <TeacherTimetable me={me} onNavigate={onNavigate} academicYearId={academicYearId} initialTeacherId={rest[0]} />;
    if (sub === 'student') return <StudentTimetable me={me} onNavigate={onNavigate} academicYearId={academicYearId} />;
    if (sub === 'substitution') return <Substitutions me={me} onNavigate={onNavigate} academicYearId={academicYearId} />;
    return (
      <div className="page-content animate-fade">
        <div className="card">
          <div className="card-body text-center py-5">
            <i className="bi bi-cone-striped d-block mb-2" style={{ fontSize: 30 }}></i>
            <h6 className="fw-bold">Timetable screen not built</h6>
            <p className="text-muted small mb-3">
              “{sub}” is not one of the four Timetable screens, so nothing has been substituted for it.
            </p>
            <div className="d-flex gap-2 justify-content-center flex-wrap">
              <button type="button" className="btn btn-sm btn-primary" onClick={() => onNavigate('/school/timetable/master')}>Timetable Master</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/timetable/teacher')}>Teacher Timetable</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/timetable/student')}>Student Timetable</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/timetable/substitution')}>Substitutions</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (module === 'attendance') {
    if (!sub || sub === 'mark') return <MarkAttendance me={me} onNavigate={onNavigate} />;
    if (sub === 'register') return <AttendanceRegister me={me} onNavigate={onNavigate} />;
    if (sub === 'corrections') return <Corrections me={me} onNavigate={onNavigate} />;
    if (sub === 'staff') return <StaffAttendance me={me} onNavigate={onNavigate} campusId={campusId} />;
    if (sub === 'reports') return <AttendanceReports me={me} onNavigate={onNavigate} />;
    return (
      <div className="page-content animate-fade">
        <div className="card">
          <div className="card-body text-center py-5">
            <i className="bi bi-cone-striped d-block mb-2" style={{ fontSize: 30 }}></i>
            <h6 className="fw-bold">Attendance screen not built</h6>
            <p className="text-muted small mb-3">
              “{sub}” is not one of the five Attendance screens, so nothing has been substituted for it.
            </p>
            <div className="d-flex gap-2 justify-content-center flex-wrap">
              <button type="button" className="btn btn-sm btn-primary" onClick={() => onNavigate('/school/attendance')}>Mark Attendance</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/attendance/register')}>Register</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/attendance/corrections')}>Corrections</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/attendance/staff')}>Staff Attendance</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/attendance/reports')}>Reports</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (module === 'fee' || module === 'fees') {
    if (!sub || sub === 'collect' || sub === 'invoices' || sub === 'collection') return <CollectionDashboard me={me} onNavigate={onNavigate} />;
    if (sub === 'setup') return <FeeSetupDashboard me={me} onNavigate={onNavigate} />;
    if (sub === 'heads') return <FeeHeads me={me} onNavigate={onNavigate} />;
    if (sub === 'categories') return <FeeCategories me={me} onNavigate={onNavigate} />;
    if (sub === 'structures') return <FeeStructures me={me} onNavigate={onNavigate} />;
    if (sub === 'installments') return <Installments me={me} onNavigate={onNavigate} />;
    if (sub === 'fine-rules') return <FineRules me={me} onNavigate={onNavigate} />;
    if (sub === 'concession-types') return <ConcessionTypes me={me} onNavigate={onNavigate} />;
    if (sub === 'student-assignments') return <StudentAssignments me={me} onNavigate={onNavigate} />;
    if (sub === 'families') return <Families me={me} onNavigate={onNavigate} />;
    if (sub === 'counter' || sub === 'collect-counter') return <CounterCollection me={me} onNavigate={onNavigate} />;
    if (sub === 'receipts') return <ReceiptsList me={me} onNavigate={onNavigate} />;
    if (sub === 'cheques') return <Cheques me={me} onNavigate={onNavigate} />;
    if (sub === 'online-payments' || sub === 'online') return <OnlinePaymentsDashboard me={me} onNavigate={onNavigate} />;
    if (sub === 'cashier-day') return <CashierDay me={me} onNavigate={onNavigate} />;
    if (sub === 'dues' || sub === 'follow-up' || sub === 'followups') return <DuesDashboard me={me} onNavigate={onNavigate} />;
    if (sub === 'ageing') return <AgeingReport me={me} onNavigate={onNavigate} />;
    if (sub === 'defaulters') return <DefaultersList me={me} onNavigate={onNavigate} />;
    if (sub === 'reminders') return <Reminders me={me} onNavigate={onNavigate} />;
    if (sub === 'follow-ups') return <FollowUps me={me} onNavigate={onNavigate} />;
    if (sub === 'payment-plans') return <PaymentPlans me={me} onNavigate={onNavigate} />;
    if (sub === 'block-policies') return <BlockPolicies me={me} onNavigate={onNavigate} />;
    if (sub === 'refunds') return <RefundsDashboard me={me} onNavigate={onNavigate} />;
    if (sub === 'refund-requests') return <RefundRequests me={me} onNavigate={onNavigate} />;
    if (sub === 'refund-rules') return <RefundRules me={me} onNavigate={onNavigate} />;
    if (sub === 'credit-notes') return <CreditNotes me={me} onNavigate={onNavigate} />;
    if (sub === 'deposits') return <Deposits me={me} onNavigate={onNavigate} />;
    if (sub === 'reconciliation' || sub === 'reconcile' || sub === 'bank-reconciliation' || sub === 'cashier-reconciliation' || sub === 'cheque-reconciliation' || sub === 'gateway-reconciliation' || sub === 'exceptions') {
      if (sub === 'cashier-reconciliation') return <CashierReconciliation me={me} onNavigate={onNavigate} />;
      if (sub === 'cheque-reconciliation') return <ChequeReconciliation me={me} onNavigate={onNavigate} />;
      if (sub === 'gateway-reconciliation') return <GatewayReconciliation me={me} onNavigate={onNavigate} />;
      if (sub === 'bank-reconciliation') return <BankReconciliation me={me} onNavigate={onNavigate} />;
      if (sub === 'exceptions') return <ExceptionsList me={me} onNavigate={onNavigate} />;
      return <ReconciliationDashboard me={me} onNavigate={onNavigate} />;
    }
    if (sub === 'accounts' || sub === 'ledgers' || sub === 'vouchers' || sub === 'trial-balance') return <AccountsDashboard me={me} onNavigate={onNavigate} />;
    if (sub === 'reports') return <FeeReportsDashboard me={me} onNavigate={onNavigate} />;
    return (
      <div className="page-content animate-fade">
        <div className="card">
          <div className="card-body text-center py-5">
            <i className="bi bi-cone-striped d-block mb-2" style={{ fontSize: 30 }}></i>
            <h6 className="fw-bold">Fees screen not built</h6>
            <p className="text-muted small mb-3">
              "{sub}" is not one of the Fees screens, so nothing has been substituted for it.
            </p>
            <div className="d-flex gap-2 justify-content-center flex-wrap">
              <button type="button" className="btn btn-sm btn-primary" onClick={() => onNavigate('/school/fees')}>Invoices & Collection</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/fees/setup')}>Fee Setup</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/fees/dues')}>Dues & Follow-up</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/fees/refunds')}>Refunds</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/fees/reconcile')}>Reconciliation</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/fees/accounts')}>Accounts</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (module === 'hr') {
    const r0 = rest[0] || '';
    const r1 = rest[1] || '';

    // Staff
    if (!sub || (sub === 'staff' && !r0)) return <StaffList me={me} onNavigate={onNavigate} />;
    if (sub === 'staff' && r0 === 'new') return <StaffForm me={me} onNavigate={onNavigate} />;
    if (sub === 'staff' && r0) return <StaffProfile me={me} onNavigate={onNavigate} staffId={r0} />;
    if (sub === 'onboarding') return <OnboardingChecklist me={me} onNavigate={onNavigate} />;
    if (sub === 'exit') return <ExitSettlement me={me} onNavigate={onNavigate} />;
    if (sub === 'letters') return <StaffLetters me={me} onNavigate={onNavigate} />;

    // Leave — supports /hr/leave/<screen> and legacy flattened keys
    if (sub === 'leave' || sub === 'leaves') {
      const key = r0 || 'balances';
      if (key === 'types') return <LeaveTypes me={me} onNavigate={onNavigate} />;
      if (key === 'policies') return <LeavePolicies me={me} onNavigate={onNavigate} />;
      if (key === 'apply') return <ApplyLeave me={me} onNavigate={onNavigate} />;
      if (key === 'approvals') return <LeaveApprovals me={me} onNavigate={onNavigate} />;
      if (key === 'calendar') return <LeaveCalendar me={me} onNavigate={onNavigate} />;
      if (key === 'compoff') return <CompOff me={me} onNavigate={onNavigate} />;
      if (key === 'holidays') return <Holidays me={me} onNavigate={onNavigate} />;
      return <LeaveBalances me={me} onNavigate={onNavigate} />;
    }
    if (sub === 'leave-types') return <LeaveTypes me={me} onNavigate={onNavigate} />;
    if (sub === 'leave-policies') return <LeavePolicies me={me} onNavigate={onNavigate} />;
    if (sub === 'leave-balances') return <LeaveBalances me={me} onNavigate={onNavigate} />;
    if (sub === 'leave-apply') return <ApplyLeave me={me} onNavigate={onNavigate} />;
    if (sub === 'leave-approvals') return <LeaveApprovals me={me} onNavigate={onNavigate} />;
    if (sub === 'leave-calendar') return <LeaveCalendar me={me} onNavigate={onNavigate} />;
    if (sub === 'compoff') return <CompOff me={me} onNavigate={onNavigate} />;
    if (sub === 'holidays') return <Holidays me={me} onNavigate={onNavigate} />;

    // Payroll — supports /hr/payroll/<screen> and legacy flattened keys
    if (!sub || sub === 'payroll') {
      const key = r0 || 'runs';
      if (key === 'components') return <SalaryComponents me={me} onNavigate={onNavigate} />;
      if (key === 'structures') {
        if (r1) return <StructureBuilder me={me} onNavigate={onNavigate} structureId={r1} />;
        return <SalaryStructures me={me} onNavigate={onNavigate} />;
      }
      if (key === 'assignments') return <SalaryAssignments me={me} onNavigate={onNavigate} />;
      if (key === 'statutory') return <StatutoryRules me={me} onNavigate={onNavigate} />;
      if (key === 'payslips' && r1) return <PayslipView me={me} onNavigate={onNavigate} payslipId={r1} />;
      if (key === 'bank-advice') return <BankAdvice me={me} onNavigate={onNavigate} />;
      if (key === 'register') return <SalaryRegister me={me} onNavigate={onNavigate} />;
      if (key === 'statutory-reports') return <StatutoryReports me={me} onNavigate={onNavigate} />;
      if (key === 'tax-declarations') return <TaxDeclarations me={me} onNavigate={onNavigate} />;
      if (key === 'runs') {
        if (r1 && rest[2] === 'wizard') return <PayrollWizard me={me} onNavigate={onNavigate} runId={r1} />;
        if (r1) return <PayrollWizard me={me} onNavigate={onNavigate} runId={r1} />;
        return <PayrollRuns me={me} onNavigate={onNavigate} />;
      }
      return <PayrollRuns me={me} onNavigate={onNavigate} />;
    }
    if (sub === 'payroll-components') return <SalaryComponents me={me} onNavigate={onNavigate} />;
    if (sub === 'payroll-structures') {
      if (r0) return <StructureBuilder me={me} onNavigate={onNavigate} structureId={r0} />;
      return <SalaryStructures me={me} onNavigate={onNavigate} />;
    }
    if (sub === 'payroll-assignments') return <SalaryAssignments me={me} onNavigate={onNavigate} />;
    if (sub === 'payroll-statutory') return <StatutoryRules me={me} onNavigate={onNavigate} />;
    if (sub === 'payroll-runs') {
      if (r0 === 'wizard' && r1) return <PayrollWizard me={me} onNavigate={onNavigate} runId={r1} />;
      if (r0) return <PayrollWizard me={me} onNavigate={onNavigate} runId={r0} />;
      return <PayrollRuns me={me} onNavigate={onNavigate} />;
    }
    if (sub === 'payroll-payslips' && r0) return <PayslipView me={me} onNavigate={onNavigate} payslipId={r0} />;
    if (sub === 'payroll-bank-advice') return <BankAdvice me={me} onNavigate={onNavigate} />;
    if (sub === 'payroll-register') return <SalaryRegister me={me} onNavigate={onNavigate} />;
    if (sub === 'payroll-statutory-reports') return <StatutoryReports me={me} onNavigate={onNavigate} />;
    if (sub === 'tax-declarations') return <TaxDeclarations me={me} onNavigate={onNavigate} />;

    // Advances — /hr/advances, /hr/advances/new, /hr/advances/dashboard, /hr/advances/:id
    if (sub === 'advances') {
      if (r0 === 'new') return <AdvanceRequest me={me} onNavigate={onNavigate} />;
      if (r0 === 'dashboard') return <AdvanceDashboard me={me} onNavigate={onNavigate} />;
      if (r0) return <AdvanceDetail me={me} onNavigate={onNavigate} advanceId={r0} />;
      return <AdvanceList me={me} onNavigate={onNavigate} />;
    }
    if (sub === 'advance-dashboard') return <AdvanceDashboard me={me} onNavigate={onNavigate} />;

    // Reports — /hr/reports and /hr/reports/<report-key>
    if (sub === 'reports' || sub === 'hr-reports') {
      if (r0) return <ReportView me={me} onNavigate={onNavigate} reportKey={r0} />;
      return <ReportsDashboard me={me} onNavigate={onNavigate} />;
    }
    if (sub === 'settings' || sub === 'hr-settings') return <HRSettings me={me} onNavigate={onNavigate} />;
    if (sub === 'notifications') return <Notifications me={me} onNavigate={onNavigate} />;
    if (sub === 'self') {
      if (!r0 || r0 === 'profile') return <SelfProfile me={me} onNavigate={onNavigate} />;
      if (r0 === 'leave') return <SelfLeave me={me} onNavigate={onNavigate} />;
      if (r0 === 'payslips') return <SelfPayslips me={me} onNavigate={onNavigate} />;
      if (r0 === 'tax') return <SelfTax me={me} onNavigate={onNavigate} />;
      if (r0 === 'advances') return <SelfAdvances me={me} onNavigate={onNavigate} />;
      if (r0 === 'documents') return <SelfDocuments me={me} onNavigate={onNavigate} />;
    }
    return (
      <div className="page-content animate-fade">
        <div className="card">
          <div className="card-body text-center py-5">
            <i className="bi bi-people d-block mb-2" style={{ fontSize: 30 }}></i>
            <h6 className="fw-bold">HR screen not built</h6>
            <p className="text-muted small mb-3">
              "{sub}" is not one of the HR screens, so nothing has been substituted for it.
            </p>
            <div className="d-flex gap-2 justify-content-center flex-wrap">
              <button type="button" className="btn btn-sm btn-primary" onClick={() => onNavigate('/school/hr/staff')}>Staff Directory</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/hr/leaves')}>Leave Management</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/hr/payroll')}>Payroll</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/hr/advances')}>Advances</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/hr/reports')}>Reports</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (module === 'hostel') {
    if (!sub || sub === 'rooms') return <HostelRooms me={me} onNavigate={onNavigate} />;
    if (sub === 'allocation') return <HostelAllocation me={me} onNavigate={onNavigate} />;
    if (sub === 'fees') return <HostelFees me={me} onNavigate={onNavigate} />;
    if (sub === 'attendance') return <HostelAttendance me={me} onNavigate={onNavigate} />;
    if (sub === 'visitors') return <HostelVisitors me={me} onNavigate={onNavigate} />;
    if (sub === 'reports') return <HostelReports me={me} onNavigate={onNavigate} />;
    return <HostelRooms me={me} onNavigate={onNavigate} />;
  }

  if (module === 'transport') {
    if (!sub || sub === 'routes') return <TransportRoutes me={me} onNavigate={onNavigate} />;
    if (sub === 'vehicles') return <TransportVehicles me={me} onNavigate={onNavigate} />;
    if (sub === 'allocation') return <TransportAllocation me={me} onNavigate={onNavigate} />;
    if (sub === 'fees') return <TransportFees me={me} onNavigate={onNavigate} />;
    if (sub === 'tracking') return <TransportTracking me={me} onNavigate={onNavigate} />;
    return <TransportRoutes me={me} onNavigate={onNavigate} />;
  }

  if (module === 'inventory') {
    if (!sub || sub === 'items') return <InventoryItems me={me} onNavigate={onNavigate} />;
    if (sub === 'purchase') return <InventoryPurchase me={me} onNavigate={onNavigate} />;
    if (sub === 'issue' || sub === 'issue-return' || sub === 'return') return <InventoryIssueReturn me={me} onNavigate={onNavigate} />;
    if (sub === 'assets') return <InventoryAssets me={me} onNavigate={onNavigate} />;
    if (sub === 'stock' || sub === 'stock-report') return <InventoryStockReport me={me} onNavigate={onNavigate} />;
    return <InventoryItems me={me} onNavigate={onNavigate} />;
  }

  if (module === 'library') {
    if (!sub || sub === 'books') return <LibraryBooks me={me} onNavigate={onNavigate} />;
    if (sub === 'issue' || sub === 'counter') return <LibraryCounter me={me} onNavigate={onNavigate} />;
    if (sub === 'members') return <LibraryMembers me={me} onNavigate={onNavigate} />;
    if (sub === 'fines') return <LibraryFines me={me} onNavigate={onNavigate} />;
    if (sub === 'reports') return <LibraryReports me={me} onNavigate={onNavigate} />;
    return <LibraryBooks me={me} onNavigate={onNavigate} />;
  }

  if (module === 'canteen') {
    if (!sub || sub === 'menu') return <CanteenMenu me={me} onNavigate={onNavigate} />;
    if (sub === 'orders') return <CanteenOrders me={me} onNavigate={onNavigate} />;
    if (sub === 'billing') return <CanteenBilling me={me} onNavigate={onNavigate} />;
    if (sub === 'inventory') return <CanteenInventory me={me} onNavigate={onNavigate} />;
    return <CanteenMenu me={me} onNavigate={onNavigate} />;
  }

  if (module === 'frontoffice') {
    if (!sub || sub === 'enquiry') return <FrontOfficeEnquiries me={me} onNavigate={onNavigate} />;
    if (sub === 'visitors') return <FrontOfficeVisitors me={me} onNavigate={onNavigate} />;
    if (sub === 'complaints') return <FrontOfficeComplaints me={me} onNavigate={onNavigate} />;
    if (sub === 'calls') return <FrontOfficeCallLog me={me} onNavigate={onNavigate} />;
    if (sub === 'appointments') return <FrontOfficeAppointments me={me} onNavigate={onNavigate} />;
    return <FrontOfficeEnquiries me={me} onNavigate={onNavigate} />;
  }

  if (module === 'communication') {
    if (!sub || sub === 'dashboard') return <CommunicationDashboard me={me} onNavigate={onNavigate} />;
    if (sub === 'sms') return <CommunicationSMS me={me} onNavigate={onNavigate} />;
    if (sub === 'email') return <CommunicationEmail me={me} onNavigate={onNavigate} />;
    if (sub === 'notice') return <CommunicationNotice me={me} onNavigate={onNavigate} />;
    if (sub === 'app') return <CommunicationApp me={me} onNavigate={onNavigate} />;
    if (sub === 'templates') return <CommunicationTemplates me={me} onNavigate={onNavigate} />;
    if (sub === 'logs') return <CommunicationLogs me={me} onNavigate={onNavigate} />;
    if (sub === 'reports') return <CommunicationReports me={me} onNavigate={onNavigate} />;
    if (sub === 'providers') return <CommunicationProviders me={me} onNavigate={onNavigate} />;
    if (sub === 'automations') return <CommunicationAutomations me={me} onNavigate={onNavigate} />;
    return <CommunicationDashboard me={me} onNavigate={onNavigate} />;
  }

  if (module === 'lms') {
    if (!sub || sub === 'courses') return <LMSCourses me={me} onNavigate={onNavigate} />;
    if (sub === 'assignments') return <LMSAssignments me={me} onNavigate={onNavigate} />;
    if (sub === 'quizzes') return <LMSQuizzes me={me} onNavigate={onNavigate} />;
    if (sub === 'materials') return <LMSMaterials me={me} onNavigate={onNavigate} />;
    if (sub === 'progress') return <LMSProgress me={me} onNavigate={onNavigate} />;
    if (sub === 'reports') return <LMSReports me={me} onNavigate={onNavigate} />;
    return <LMSCourses me={me} onNavigate={onNavigate} />;
  }

  if (module === 'events') {
    if (!sub || sub === 'calendar') return <EventsCalendar me={me} onNavigate={onNavigate} />;
    if (sub === 'list') return <EventsList me={me} onNavigate={onNavigate} />;
    if (sub === 'ptm') return <EventsPTM me={me} onNavigate={onNavigate} />;
    if (sub === 'gallery') return <EventsGallery me={me} onNavigate={onNavigate} />;
    return <EventsCalendar me={me} onNavigate={onNavigate} />;
  }

  if (module === 'certificates') {
    if (!sub || sub === 'templates') return <CertificatesTemplates me={me} onNavigate={onNavigate} />;
    if (sub === 'generate') return <CertificatesGenerate me={me} onNavigate={onNavigate} />;
    if (sub === 'idcards') return <CertificatesIDCards me={me} onNavigate={onNavigate} />;
    if (sub === 'tc') return <CertificatesTC me={me} onNavigate={onNavigate} />;
    if (sub === 'register') return <CertificatesRegister me={me} onNavigate={onNavigate} />;
    if (sub === 'verify') return <CertificatesVerify me={me} onNavigate={onNavigate} />;
    return <CertificatesTemplates me={me} onNavigate={onNavigate} />;
  }

  if (module === 'alumni') {
    if (!sub || sub === 'dashboard') return <AlumniDashboard me={me} onNavigate={onNavigate} />;
    if (sub === 'register') return <AlumniRegistration me={me} onNavigate={onNavigate} />;
    if (sub === 'directory') return <AlumniDirectory me={me} onNavigate={onNavigate} />;
    if (sub === 'profile') return <AlumniProfile me={me} onNavigate={onNavigate} />;
    if (sub === 'verification') return <AlumniVerification me={me} onNavigate={onNavigate} />;
    if (sub === 'events') return <AlumniEvents me={me} onNavigate={onNavigate} />;
    if (sub === 'jobs') return <AlumniJobs me={me} onNavigate={onNavigate} />;
    if (sub === 'donations') return <AlumniDonations me={me} onNavigate={onNavigate} />;
    return <AlumniDashboard me={me} onNavigate={onNavigate} />;
  }

  if (module === 'reports') {
    if (!sub || sub === 'student') return <StudentReports me={me} onNavigate={onNavigate} />;
    if (sub === 'attendance') return <ReportsAttendanceReports me={me} onNavigate={onNavigate} />;
    if (sub === 'fees') return <FeeReports me={me} onNavigate={onNavigate} />;
    if (sub === 'exam') return <ReportsExamReports me={me} onNavigate={onNavigate} />;
    if (sub === 'custom') return <CustomReports me={me} onNavigate={onNavigate} />;
    return <StudentReports me={me} onNavigate={onNavigate} />;
  }

  if (module === 'automation') {
    if (!sub || sub === 'rules') return <AutomationRules me={me} onNavigate={onNavigate} />;
    if (sub === 'templates') return <AutomationTemplates me={me} onNavigate={onNavigate} />;
    if (sub === 'providers') return <AutomationProviders me={me} onNavigate={onNavigate} />;
    return <AutomationRules me={me} onNavigate={onNavigate} />;
  }

  if (module === 'import') {
    if (!sub || sub === 'students') return <ImportStudents me={me} onNavigate={onNavigate} />;
    if (sub === 'fees') return <ImportFees me={me} onNavigate={onNavigate} />;
    if (sub === 'attendance') return <ImportAttendance me={me} onNavigate={onNavigate} />;
    if (sub === 'export') return <ExportData me={me} onNavigate={onNavigate} />;
    return <ImportStudents me={me} onNavigate={onNavigate} />;
  }

  if (module === 'examinations' || module === 'exam') {
    if (!sub || sub === 'dashboard') return <ExamDashboard me={me} onNavigate={onNavigate} />;
    if (sub === 'setup') return <ExamSetup me={me} onNavigate={onNavigate} />;
    if (sub === 'terms') return <Terms me={me} onNavigate={onNavigate} />;
    if (sub === 'grade-setup') return <GradeSetup me={me} onNavigate={onNavigate} />;
    if (sub === 'marks') {
      if (rest[0] === 'sheet' && rest[1]) return <MarksEntry me={me} onNavigate={onNavigate} sheetId={rest[1]} />;
      if (['import', 'corrections', 'moderation'].includes(rest[0])) {
        return <MarksTools me={me} onNavigate={onNavigate} mode={rest[0]} query={{}} />;
      }
      return <MarksDashboard me={me} onNavigate={onNavigate} />;
    }
    if (sub === 'results') return <ResultsDashboard me={me} onNavigate={onNavigate} />;
    if (sub === 'report-cards') {
      if (rest[0] === 'templates') return <ReportCardTemplates me={me} onNavigate={onNavigate} />;
      return <ReportCardsDashboard me={me} onNavigate={onNavigate} />;
    }
    if (sub === 'schedule') {
      if (['date-sheet', 'seating', 'invigilation', 'hall-tickets'].includes(rest[0])) {
        return <ScheduleTools me={me} onNavigate={onNavigate} mode={rest[0]} query={{}} />;
      }
      return <ExamSchedule me={me} onNavigate={onNavigate} />;
    }
    if (sub === 'reports') return <ExamReports me={me} onNavigate={onNavigate} />;
    return (
      <div className="page-content animate-fade">
        <div className="card">
          <div className="card-body text-center py-5">
            <i className="bi bi-cone-striped d-block mb-2" style={{ fontSize: 30 }}></i>
            <h6 className="fw-bold">Examinations screen not built</h6>
            <p className="text-muted small mb-3">
              “{sub}” is not one of the Examinations screens, so nothing has been substituted for it.
            </p>
            <div className="d-flex gap-2 justify-content-center flex-wrap">
              <button type="button" className="btn btn-sm btn-primary" onClick={() => onNavigate('/school/examinations')}>Dashboard</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/examinations/terms')}>Terms</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/examinations/grade-setup')}>Grade Setup</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/examinations/marks')}>Marks Entry</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/examinations/results')}>Results</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/examinations/report-cards')}>Report Cards</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/examinations/schedule')}>Schedule</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="school-page">
      {module === 'settings' ? (
        <SchoolSettings
          me={me}
          sub={sub}
          onNavigate={onNavigate}
          onRefreshMe={onRefreshMe}
        />
      ) : module === 'ai' ? (
        <div className="school-panel">
          <div className="school-card">
            <h5><i className="bi bi-stars me-2"></i>AI Assistant</h5>
            <p className="school-muted">Smart insights, report summaries, fee reminders and timetable suggestions.</p>
            <div className="row g-2 mt-2">
              <div className="col-md-6"><div className="border rounded p-3"><strong>Ask AI</strong><div className="text-muted small">"Show students with fee dues above 5000"</div></div></div>
              <div className="col-md-6"><div className="border rounded p-3"><strong>Generate Reports</strong><div className="text-muted small">Attendance, fees, performance summaries</div></div></div>
              <div className="col-md-6"><div className="border rounded p-3"><strong>Parent Communication</strong><div className="text-muted small">Draft notices and reminders</div></div></div>
              <div className="col-md-6"><div className="border rounded p-3"><strong>Smart Insights</strong><div className="text-muted small">Dropout risk, low attendance alerts</div></div></div>
            </div>
          </div>
        </div>
      ) : module === 'platform' ? (
        <div className="school-panel">
          <div className="school-card">
            <h5><i className="bi bi-shield-lock me-2"></i>Platform / Super Admin</h5>
            <p className="school-muted">Multi-tenant configuration, schools list, global roles, system health.</p>
            <div className="row g-2 mt-2">
              <div className="col-md-4"><div className="border rounded p-3"><strong>Schools</strong><div className="text-muted small">Manage tenant schools</div></div></div>
              <div className="col-md-4"><div className="border rounded p-3"><strong>Global Users</strong><div className="text-muted small">Cross-school access</div></div></div>
              <div className="col-md-4"><div className="border rounded p-3"><strong>Licensing</strong><div className="text-muted small">Plans &amp; modules</div></div></div>
              <div className="col-md-4"><div className="border rounded p-3"><strong>Audit Logs</strong><div className="text-muted small">Platform activity</div></div></div>
              <div className="col-md-4"><div className="border rounded p-3"><strong>System Config</strong><div className="text-muted small">Feature flags</div></div></div>
              <div className="col-md-4"><div className="border rounded p-3"><strong>Backups</strong><div className="text-muted small">Data management</div></div></div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="school-head">
            <div>
              <h4><i className="bi bi-mortarboard-fill me-2"></i>School ERP</h4>
              <p>Admissions, classes, attendance, fees and parent automations in one place.</p>
            </div>
            <button className="btn btn-sm btn-outline-secondary" onClick={reload} disabled={loading}>
              <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`}></i> Refresh
            </button>
          </div>

          <div className="school-tabs">
            {TABS.map(([id, label, icon]) => (
              <button
                key={id}
                className={`school-tab ${tab === id ? 'active' : ''}`}
                onClick={() => {
                  setTab(id);
                  const path = TAB_PATH[id];
                  if (path) onNavigate(path);
                }}
              >
                <i className={`bi ${icon}`}></i><span>{label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {loading && <div className="school-loading"><div className="spinner-border spinner-border-sm text-primary"></div> Loading…</div>}

      {/* ---------------- OVERVIEW ---------------- */}
      {tab === 'overview' && module !== 'settings' && module !== 'ai' && module !== 'platform' && dash && (
        <div className="school-panel">
          <div className="school-stats">
            <Stat label="Active students" value={dash.stats.students} icon="bi-people-fill" tone="blue" sub={`${dash.stats.classes} classes · ${dash.stats.sections} sections`} />
            <Stat label="Present today" value={dash.stats.presentToday} icon="bi-check2-circle" tone="green" sub={`${dash.stats.absentToday} absent`} />
            <Stat label="Fees collected today" value={money(dash.stats.collectedToday)} icon="bi-cash-stack" tone="teal" sub={`${money(dash.stats.outstanding)} outstanding`} />
            <Stat label="Alerts today" value={dash.stats.notificationsToday} icon="bi-bell-fill" tone="amber" sub="parent notifications queued" />
          </div>

          <div className="school-grid-2">
            <section className="school-card">
              <header><h6>Recent admissions</h6><button className="btn btn-sm btn-link" onClick={() => onNavigate('/school/students')}>All students</button></header>
              {dash.recentStudents.length === 0 ? <Empty text="No students admitted yet" icon="bi-person-plus" /> : (
                <div className="school-list">
                  {dash.recentStudents.map((s) => (
                    <div className="school-list-row" key={s.id}>
                      <div className="school-avatar">{(s.first_name || '?')[0]}</div>
                      <div className="school-list-main">
                        <strong>{fullName(s)}</strong>
                        <span>{s.admission_no} · {s.class_name || 'Unassigned'}{s.section_name ? `-${s.section_name}` : ''}</span>
                      </div>
                      <span className="school-muted">{fmtDate(s.admission_date)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="school-card">
              <header><h6>Recent fee payments</h6><button className="btn btn-sm btn-link" onClick={() => onNavigate('/school/fees')}>Open fees</button></header>
              {dash.recentPayments.length === 0 ? <Empty text="No payments recorded yet" icon="bi-receipt" /> : (
                <div className="school-list">
                  {dash.recentPayments.map((p) => (
                    <div className="school-list-row" key={p.id}>
                      <i className="bi bi-check-circle-fill school-ok"></i>
                      <div className="school-list-main">
                        <strong>{fullName(p)}</strong>
                        <span>{p.title} · {p.method}</span>
                      </div>
                      <div className="text-end">
                        <strong>{money(p.amount)}</strong>
                        <div className="school-muted">{fmtDate(p.paid_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="school-grid-2">
            <section className="school-card">
              <header><h6>Fee status</h6></header>
              <div className="school-bars">
                {dash.feeBuckets.length === 0 && <Empty text="No invoices raised yet" icon="bi-receipt-cutoff" />}
                {dash.feeBuckets.map((b) => (
                  <div className="school-bar" key={b.status}>
                    <span className={`badge school-badge ${b.status}`}>{b.status}</span>
                    <div className="school-bar-track"><div className={`school-bar-fill ${b.status}`} style={{ width: `${Math.min(100, Number(b.amount) / Math.max(1, dash.stats.outstanding + dash.feeBuckets.reduce((a, x) => a + (x.status === 'paid' ? Number(x.amount) : 0), 0))) * 100}%` }}></div></div>
                    <strong>{b.n}</strong><span className="school-muted">{money(b.amount)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="school-card">
              <header><h6>Attendance · last 7 days</h6><button className="btn btn-sm btn-link" onClick={() => onNavigate('/school/attendance')}>Mark today</button></header>
              {dash.attendanceTrend.length === 0 ? <Empty text="Attendance not marked yet" icon="bi-calendar2-x" /> : (
                <div className="school-bars">
                  {dash.attendanceTrend.map((d) => {
                    const total = d.present + d.absent || 1;
                    return (
                      <div className="school-bar" key={d.attendance_date}>
                        <span className="school-muted" style={{ width: 64 }}>{fmtDate(d.attendance_date).slice(0, 6)}</span>
                        <div className="school-bar-track"><div className="school-bar-fill present" style={{ width: `${(d.present / total) * 100}%` }}></div></div>
                        <strong>{d.present}</strong><span className="school-muted">{d.absent} absent</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {module !== 'settings' && module !== 'ai' && module !== 'platform' && selectedStudentId && (
        <StudentProfile
          studentId={selectedStudentId}
          onClose={() => setSelectedStudentId(null)}
          onEdit={(s) => { setSelectedStudentId(null); editStudent(s); }}
        />
      )}

      {/* ---------------- STUDENTS ---------------- */}
      {tab === 'students' && module !== 'settings' && module !== 'ai' && module !== 'platform' && (
        <div className="school-panel" id="school-student-list-print-target">
          <div className="school-toolbar">
            <div className="school-filters">
              <input className="form-control form-control-sm" placeholder="Search name, admission no, guardian." value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
              <select className="form-select form-select-sm" value={filters.classId} onChange={(e) => setFilters({ ...filters, classId: e.target.value, sectionId: '' })}>
                <option value="">All classes</option>
                {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="form-select form-select-sm" value={filters.sectionId} onChange={(e) => setFilters({ ...filters, sectionId: e.target.value })}>
                <option value="">All sections</option>
                {(classOptions.find((c) => String(c.id) === String(filters.classId))?.sections || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select className="form-select form-select-sm" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                <option value="">Any status</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="graduated">Graduated</option>
              </select>
            </div>
            <button className="btn btn-sm btn-primary" onClick={() => { setStudentPhotoFile(null); setStudentForm(blankStudent()); }}>
              <i className="bi bi-person-plus"></i> Add student
            </button>
            <PrintButton targetId="school-student-list-print-target" label="Print students" />
          </div>

          {studentForm && (
            <form className="school-form-card" onSubmit={saveStudent}>
              <div className="school-form-head">
                <h6>{studentForm.id ? 'Edit student' : 'New admission'}</h6>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setStudentPhotoFile(null); setStudentForm(null); }}>Cancel</button>
              </div>
              <div className="school-form-grid">
                <label>Admission no<input className="form-control form-control-sm" value={studentForm.admissionNo} placeholder="Auto-generated if blank"
                  onChange={(e) => setStudentForm({ ...studentForm, admissionNo: e.target.value })} /></label>
                <label>First name *<input className="form-control form-control-sm" value={studentForm.firstName}
                  onChange={(e) => setStudentForm({ ...studentForm, firstName: e.target.value })} required /></label>
                <label>Middle name<input className="form-control form-control-sm" value={studentForm.middleName || ''}
                  onChange={(e) => setStudentForm({ ...studentForm, middleName: e.target.value })} /></label>
                <label>Last name<input className="form-control form-control-sm" value={studentForm.lastName}
                  onChange={(e) => setStudentForm({ ...studentForm, lastName: e.target.value })} /></label>
                <label>Name as per certificate<input className="form-control form-control-sm" value={studentForm.officialName}
                  onChange={(e) => setStudentForm({ ...studentForm, officialName: e.target.value })} /></label>
                <label>Gender<select className="form-select form-select-sm" value={studentForm.gender}
                  onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value })}>
                  <option value="">—</option><option>Male</option><option>Female</option><option>Other</option>
                </select></label>
                <label>Date of birth<input type="date" className="form-control form-control-sm" value={studentForm.dob}
                  onChange={(e) => setStudentForm({ ...studentForm, dob: e.target.value })} /></label>
                <label>Class<select className="form-select form-select-sm" value={studentForm.classId}
                  onChange={(e) => setStudentForm({ ...studentForm, classId: e.target.value, sectionId: '' })}>
                  <option value="">Unassigned</option>
                  {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></label>
                <label>Section<select className="form-select form-select-sm" value={studentForm.sectionId}
                  onChange={(e) => setStudentForm({ ...studentForm, sectionId: e.target.value })}>
                  <option value="">—</option>
                  {selectedStudentSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select></label>
                <label>Roll no<input className="form-control form-control-sm" value={studentForm.rollNo}
                  onChange={(e) => setStudentForm({ ...studentForm, rollNo: e.target.value })} /></label>
                <label>Guardian name<input className="form-control form-control-sm" value={studentForm.guardianName}
                  onChange={(e) => setStudentForm({ ...studentForm, guardianName: e.target.value })} /></label>
                <label>Guardian phone<input className="form-control form-control-sm" value={studentForm.guardianPhone}
                  onChange={(e) => setStudentForm({ ...studentForm, guardianPhone: e.target.value })} /></label>
                <label>Guardian email<input type="email" className="form-control form-control-sm" value={studentForm.guardianEmail}
                  onChange={(e) => setStudentForm({ ...studentForm, guardianEmail: e.target.value })} /></label>
                <label>Admission date<input type="date" className="form-control form-control-sm" value={studentForm.admissionDate}
                  onChange={(e) => setStudentForm({ ...studentForm, admissionDate: e.target.value })} /></label>
                <label>Status<select className="form-select form-select-sm" value={studentForm.status}
                  onChange={(e) => setStudentForm({ ...studentForm, status: e.target.value })}>
                  <option value="active">Active</option><option value="inactive">Inactive</option><option value="graduated">Graduated</option>
                </select></label>
                <label>Blood group<input className="form-control form-control-sm" value={studentForm.bloodGroup || ''}
                  onChange={(e) => setStudentForm({ ...studentForm, bloodGroup: e.target.value })} /></label>
                <label>Birth certificate no<input className="form-control form-control-sm" value={studentForm.birthCertificateNo}
                  onChange={(e) => setStudentForm({ ...studentForm, birthCertificateNo: e.target.value })} /></label>
                <label>Aadhaar no<input className="form-control form-control-sm" value={studentForm.aadhaarNo}
                  onChange={(e) => setStudentForm({ ...studentForm, aadhaarNo: e.target.value })} /></label>
                <label>Passport no<input className="form-control form-control-sm" value={studentForm.passportNo}
                  onChange={(e) => setStudentForm({ ...studentForm, passportNo: e.target.value })} /></label>
                <label>Place of birth<input className="form-control form-control-sm" value={studentForm.placeOfBirth}
                  onChange={(e) => setStudentForm({ ...studentForm, placeOfBirth: e.target.value })} /></label>
                <label>Nationality<input className="form-control form-control-sm" value={studentForm.nationality || ''}
                  onChange={(e) => setStudentForm({ ...studentForm, nationality: e.target.value })} /></label>
                <label>Category<input className="form-control form-control-sm" value={studentForm.category || ''}
                  onChange={(e) => setStudentForm({ ...studentForm, category: e.target.value })} /></label>
                <label>Religion<input className="form-control form-control-sm" value={studentForm.religion}
                  onChange={(e) => setStudentForm({ ...studentForm, religion: e.target.value })} /></label>
                <label>Mother tongue<input className="form-control form-control-sm" value={studentForm.motherTongue}
                  onChange={(e) => setStudentForm({ ...studentForm, motherTongue: e.target.value })} /></label>
                <label>House<input className="form-control form-control-sm" value={studentForm.house || ''}
                  onChange={(e) => setStudentForm({ ...studentForm, house: e.target.value })} /></label>
                <label>National ID<input className="form-control form-control-sm" value={studentForm.nationalId || ''}
                  onChange={(e) => setStudentForm({ ...studentForm, nationalId: e.target.value })} /></label>
                <label>Previous school<input className="form-control form-control-sm" value={studentForm.previousSchool || ''}
                  onChange={(e) => setStudentForm({ ...studentForm, previousSchool: e.target.value })} /></label>
                <label>Father name<input className="form-control form-control-sm" value={studentForm.fatherName}
                  onChange={(e) => setStudentForm({ ...studentForm, fatherName: e.target.value })} /></label>
                <label>Father occupation<input className="form-control form-control-sm" value={studentForm.fatherOccupation}
                  onChange={(e) => setStudentForm({ ...studentForm, fatherOccupation: e.target.value })} /></label>
                <label>Father contact<input className="form-control form-control-sm" value={studentForm.fatherContact}
                  onChange={(e) => setStudentForm({ ...studentForm, fatherContact: e.target.value })} /></label>
                <label>Father email<input type="email" className="form-control form-control-sm" value={studentForm.fatherEmail}
                  onChange={(e) => setStudentForm({ ...studentForm, fatherEmail: e.target.value })} /></label>
                <label>Mother name<input className="form-control form-control-sm" value={studentForm.motherName}
                  onChange={(e) => setStudentForm({ ...studentForm, motherName: e.target.value })} /></label>
                <label>Mother occupation<input className="form-control form-control-sm" value={studentForm.motherOccupation}
                  onChange={(e) => setStudentForm({ ...studentForm, motherOccupation: e.target.value })} /></label>
                <label>Mother contact<input className="form-control form-control-sm" value={studentForm.motherContact}
                  onChange={(e) => setStudentForm({ ...studentForm, motherContact: e.target.value })} /></label>
                <label>Mother email<input type="email" className="form-control form-control-sm" value={studentForm.motherEmail}
                  onChange={(e) => setStudentForm({ ...studentForm, motherEmail: e.target.value })} /></label>
                <label>Emergency contact name<input className="form-control form-control-sm" value={studentForm.emergencyContactName}
                  onChange={(e) => setStudentForm({ ...studentForm, emergencyContactName: e.target.value })} /></label>
                <label>Emergency contact phone<input className="form-control form-control-sm" value={studentForm.emergencyContactPhone}
                  onChange={(e) => setStudentForm({ ...studentForm, emergencyContactPhone: e.target.value })} /></label>
                <label>Allergies<input className="form-control form-control-sm" value={studentForm.allergies}
                  onChange={(e) => setStudentForm({ ...studentForm, allergies: e.target.value })} /></label>
                <label>Medical conditions<input className="form-control form-control-sm" value={studentForm.medicalConditions}
                  onChange={(e) => setStudentForm({ ...studentForm, medicalConditions: e.target.value })} /></label>
                <label>Regular medications<input className="form-control form-control-sm" value={studentForm.regularMedications}
                  onChange={(e) => setStudentForm({ ...studentForm, regularMedications: e.target.value })} /></label>
                <label>Doctor name<input className="form-control form-control-sm" value={studentForm.doctorName}
                  onChange={(e) => setStudentForm({ ...studentForm, doctorName: e.target.value })} /></label>
                <label>Doctor contact<input className="form-control form-control-sm" value={studentForm.doctorContact}
                  onChange={(e) => setStudentForm({ ...studentForm, doctorContact: e.target.value })} /></label>
                <label>Preferred hospital<input className="form-control form-control-sm" value={studentForm.preferredHospital}
                  onChange={(e) => setStudentForm({ ...studentForm, preferredHospital: e.target.value })} /></label>
                <label>Student photo
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="form-control form-control-sm"
                    onChange={(e) => setStudentPhotoFile(e.target.files?.[0] || null)} />
                  <span className="school-muted">JPEG, PNG, or WebP; maximum 2 MB. Stored privately.</span>
                  <StudentPhoto
                    photoUrl={studentPhotoPreviewUrl || studentForm.photoUrl}
                    name={`${studentForm.firstName} ${studentForm.lastName}`}
                    className="student-photo-preview"
                  />
                </label>
                <label>Signature URL<input className="form-control form-control-sm" value={studentForm.signatureUrl}
                  onChange={(e) => setStudentForm({ ...studentForm, signatureUrl: e.target.value })} /></label>
                <label>Authorized pickup persons<input className="form-control form-control-sm" value={studentForm.pickupAuthorized}
                  placeholder="Comma-separated names" onChange={(e) => setStudentForm({ ...studentForm, pickupAuthorized: e.target.value })} /></label>
                <label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input" checked={studentForm.transportRequired}
                  onChange={(e) => setStudentForm({ ...studentForm, transportRequired: e.target.checked })} />Transport required</label>
                <label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input" checked={studentForm.hostelRequired}
                  onChange={(e) => setStudentForm({ ...studentForm, hostelRequired: e.target.checked })} />Hostel required</label>
                {!!me?.campuses?.length && (
                  <label>Campus<select className="form-select form-select-sm" value={studentForm.campusId || ''}
                    onChange={(e) => setStudentForm({ ...studentForm, campusId: e.target.value })}>
                    <option value="">Default</option>
                    {me.campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select></label>
                )}
                <label className="span-2">Address<textarea className="form-control form-control-sm" rows="2" value={studentForm.address}
                  onChange={(e) => setStudentForm({ ...studentForm, address: e.target.value })} /></label>
                <label className="span-2">Permanent address<textarea className="form-control form-control-sm" rows="2" value={studentForm.permanentAddress}
                  onChange={(e) => setStudentForm({ ...studentForm, permanentAddress: e.target.value })} /></label>
              </div>
              <div className="school-form-actions">
                <button className="btn btn-sm btn-primary" type="submit"><i className="bi bi-check2"></i> {studentForm.id ? 'Save changes' : 'Admit student'}</button>
              </div>
            </form>
          )}

          <div className="school-table-wrap">
            <table className="table table-sm school-table">
              <thead><tr><th>Admission</th><th>Student</th><th>Class</th><th>Guardian</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {students.length === 0 && <tr><td colSpan="6"><Empty icon="bi-people" text="No students match these filters" /></td></tr>}
                {students.map((s) => (
                  <tr key={s.id} className="clickable-row" onClick={() => setSelectedStudentId(s.id)}>
                    <td><code>{s.admission_no}</code></td>
                    <td><div className="student-list-identity"><StudentPhoto photoUrl={s.photo_url} name={fullName(s)} /><div><strong>{fullName(s)}</strong><div className="school-muted">{s.gender || '-'} · roll {s.roll_no || '-'}</div></div></div></td>
                    <td>{s.class_name || '-'}{s.section_name ? ` · ${s.section_name}` : ''}</td>
                    <td>{s.guardian_name || '-'}<div className="school-muted">{s.guardian_phone || s.guardian_email || ''}</div></td>
                    <td><span className={`badge school-badge ${s.status}`}>{s.status}</span></td>
                    <td className="text-end" onClick={(e) => e.stopPropagation()}>
                      <PrintButton targetId={`student-row-print-${s.id}`} label="Print" />
                      <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editStudent(s)} title="Edit"><i className="bi bi-pencil"></i></button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => removeStudent(s)} title="Archive"><i className="bi bi-archive"></i></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {students.map((s) => (
            <article id={`student-row-print-${s.id}`} className="student-row-print" key={`print-${s.id}`}>
              <h2>Student Record</h2>
              <h3>{fullName(s)}</h3>
              <table className="table table-sm">
                <tbody>
                  <tr><th>Admission number</th><td>{s.admission_no || '-'}</td></tr>
                  <tr><th>Class / Section</th><td>{s.class_name || 'Unassigned'}{s.section_name ? ` / ${s.section_name}` : ''}</td></tr>
                  <tr><th>Roll number</th><td>{s.roll_no || '-'}</td></tr>
                  <tr><th>Gender</th><td>{s.gender || '-'}</td></tr>
                  <tr><th>Guardian</th><td>{s.guardian_name || '-'}</td></tr>
                  <tr><th>Guardian contact</th><td>{s.guardian_phone || s.guardian_email || '-'}</td></tr>
                  <tr><th>Status</th><td>{s.status || '-'}</td></tr>
                </tbody>
              </table>
            </article>
          ))}
        </div>
      )}

      {/* ---------------- CLASSES ---------------- */}
      {tab === 'classes' && (
        <div className="school-panel" id="school-classes-print-target">
          <div className="school-toolbar justify-content-end">
            <PrintButton targetId="school-classes-print-target" label="Print classes" />
          </div>
          <div className="school-grid-3">
            <form className="school-card" onSubmit={addClass}>
              <header><h6>{editingClassId ? 'Edit class' : 'Add class'}</h6></header>
              <div className="school-form-grid one">
                <label>Name<input className="form-control form-control-sm" value={classDraft.name} required
                  onChange={(e) => setClassDraft({ ...classDraft, name: e.target.value })} /></label>
                <label>Stream<input className="form-control form-control-sm" value={classDraft.stream} placeholder="Science / Commerce (optional)"
                  onChange={(e) => setClassDraft({ ...classDraft, stream: e.target.value })} /></label>
                <label>Sort order<input type="number" className="form-control form-control-sm" value={classDraft.sortOrder}
                  onChange={(e) => setClassDraft({ ...classDraft, sortOrder: e.target.value })} /></label>
              </div>
              <div className="d-flex gap-2 mt-2">
                <button className="btn btn-sm btn-primary" type="submit"><i className="bi bi-plus-lg"></i> {editingClassId ? 'Save class' : 'Add class'}</button>
                {editingClassId && <button className="btn btn-sm btn-outline-secondary no-print" type="button" onClick={() => { setEditingClassId(null); setClassDraft({ name: '', stream: '', sortOrder: '' }); }}>Cancel</button>}
              </div>
            </form>

            <form className="school-card" onSubmit={addSection}>
              <header><h6>{editingSectionId ? 'Edit section' : 'Add section'}</h6></header>
              <div className="school-form-grid one">
                <label>Class<select className="form-select form-select-sm" value={sectionDraft.classId} required disabled={!!editingSectionId}
                  onChange={(e) => setSectionDraft({ ...sectionDraft, classId: e.target.value })}>
                  <option value="">Choose class</option>
                  {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></label>
                <label>Section name<input className="form-control form-control-sm" value={sectionDraft.name} required
                  onChange={(e) => setSectionDraft({ ...sectionDraft, name: e.target.value })} /></label>
                <label>Capacity<input type="number" className="form-control form-control-sm" value={sectionDraft.capacity}
                  onChange={(e) => setSectionDraft({ ...sectionDraft, capacity: e.target.value })} /></label>
                <label>Class teacher<input className="form-control form-control-sm" value={sectionDraft.classTeacher}
                  onChange={(e) => setSectionDraft({ ...sectionDraft, classTeacher: e.target.value })} /></label>
              </div>
              <div className="d-flex gap-2 mt-2">
                <button className="btn btn-sm btn-primary" type="submit"><i className="bi bi-plus-lg"></i> {editingSectionId ? 'Save section' : 'Add section'}</button>
                {editingSectionId && <button className="btn btn-sm btn-outline-secondary no-print" type="button" onClick={() => { setEditingSectionId(null); setSectionDraft({ classId: '', name: 'A', capacity: 40, classTeacher: '' }); }}>Cancel</button>}
              </div>
            </form>

            <form className="school-card" onSubmit={addSubject}>
              <header><h6>{editingSubjectId ? 'Edit subject' : 'Add subject'}</h6></header>
              <div className="school-form-grid one">
                <label>Class<select className="form-select form-select-sm" value={subjectDraft.classId}
                  onChange={(e) => setSubjectDraft({ ...subjectDraft, classId: e.target.value })}>
                  <option value="">All classes</option>
                  {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></label>
                <label>Code<input className="form-control form-control-sm" value={subjectDraft.code}
                  onChange={(e) => setSubjectDraft({ ...subjectDraft, code: e.target.value })} /></label>
                <label>Name<input className="form-control form-control-sm" value={subjectDraft.name} required
                  onChange={(e) => setSubjectDraft({ ...subjectDraft, name: e.target.value })} /></label>
                <label>Max marks<input type="number" className="form-control form-control-sm" value={subjectDraft.maxMarks}
                  onChange={(e) => setSubjectDraft({ ...subjectDraft, maxMarks: e.target.value })} /></label>
              </div>
              <div className="d-flex gap-2 mt-2">
                <button className="btn btn-sm btn-primary" type="submit"><i className="bi bi-plus-lg"></i> {editingSubjectId ? 'Save subject' : 'Add subject'}</button>
                {editingSubjectId && <button className="btn btn-sm btn-outline-secondary no-print" type="button" onClick={() => { setEditingSubjectId(null); setSubjectDraft({ code: '', name: '', classId: '', maxMarks: 100 }); }}>Cancel</button>}
              </div>
            </form>
          </div>

          <div className="school-class-grid">
            {classes.length === 0 && <Empty icon="bi-diagram-3" text="No classes yet" />}
            {classes.map((c) => (
              <div className="school-class-card" key={c.id}>
                <div className="school-class-head">
                  <div><strong>{c.name}</strong>{c.stream ? <span className="school-muted"> · {c.stream}</span> : null}<div className="school-muted">{c.students} students</div></div>
                <div className="d-flex gap-1 no-print">
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => editClass(c)} title="Edit class"><i className="bi bi-pencil"></i></button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => removeClass(c)} title="Delete class"><i className="bi bi-trash"></i></button>
                </div>
                </div>
                <div className="school-section-list">
                  {(c.sections || []).map((s) => (
                    <div className="school-section-chip" key={s.id}>
                      <span><strong>{s.name}</strong><span className="school-muted"> · {s.students}/{s.capacity}</span>{s.classTeacher ? <span className="school-muted"> · {s.classTeacher}</span> : null}</span>
                      <div className="d-flex gap-1 no-print">
                        <button className="btn btn-sm btn-link p-0" onClick={() => editSection({ ...s, class_id: c.id })} title="Edit section"><i className="bi bi-pencil"></i></button>
                        <button className="btn btn-sm btn-link text-danger p-0" onClick={() => removeSection(s)} title="Delete section"><i className="bi bi-x-lg"></i></button>
                      </div>
                    </div>
                  ))}
                  {(c.sections || []).length === 0 && <span className="school-muted">No sections</span>}
                </div>
              </div>
            ))}
          </div>

          <section className="school-card mt-3">
            <header><h6>Subjects</h6><span className="school-muted">{subjects.length} subject(s)</span></header>
            <div className="school-table-wrap">
              <table className="table table-sm school-table">
                <thead><tr><th>Code</th><th>Subject</th><th>Class</th><th>Max marks</th><th></th></tr></thead>
                <tbody>
                  {subjects.length === 0 && <tr><td colSpan="5"><Empty icon="bi-journal-bookmark" text="No subjects added" /></td></tr>}
                  {subjects.map((s) => (
                    <tr key={s.id}>
                      <td><code>{s.code || '—'}</code></td><td>{s.name}</td><td>{s.class_name || 'All'}</td><td>{s.max_marks}</td>
                      <td className="text-end no-print">
                        <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editSubject(s)} title="Edit subject"><i className="bi bi-pencil"></i></button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => removeSubject(s)} title="Delete subject"><i className="bi bi-trash"></i></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ---------------- ATTENDANCE ---------------- */}
      {tab === 'attendance' && (
        <div className="school-panel" id="school-attendance-print-target">
          <div className="school-toolbar">
            <div className="school-filters">
              <input type="date" className="form-control form-control-sm" value={att.date}
                onChange={(e) => { const date = e.target.value; setAtt({ ...att, date }); loadAttendance(date, attFilter); }} />
              <select className="form-select form-select-sm" value={attFilter.classId}
                onChange={(e) => { const f = { ...attFilter, classId: e.target.value, sectionId: '' }; setAttFilter(f); loadAttendance(att.date, f); }}>
                <option value="">All classes</option>
                {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="form-select form-select-sm" value={attFilter.sectionId}
                onChange={(e) => { const f = { ...attFilter, sectionId: e.target.value }; setAttFilter(f); loadAttendance(att.date, f); }}>
                <option value="">All sections</option>
                {(classOptions.find((c) => String(c.id) === String(attFilter.classId))?.sections || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <span className="school-muted">{att.students.length} students</span>
            </div>
            <div className="d-flex gap-2">
              <PrintButton targetId="school-attendance-print-target" label="Print list" />
              <button className="btn btn-sm btn-outline-success" onClick={() => markAll('P')}>Mark all present</button>
              <button className="btn btn-sm btn-primary" onClick={saveAttendance}><i className="bi bi-check2-all"></i> Save attendance</button>
            </div>
          </div>

          <div className="school-att-counts">
            <span className="badge school-badge present">Present · {att.counts.present || 0}</span>
            <span className="badge school-badge absent">Absent · {att.counts.absent || 0}</span>
            <span className="badge school-badge late">Late · {att.counts.late || 0}</span>
          </div>

          <div className="school-table-wrap">
            <table className="table table-sm school-table">
              <thead><tr><th>Roll</th><th>Student</th><th>Class</th><th>Status</th><th>Remarks</th></tr></thead>
              <tbody>
                {att.students.length === 0 && <tr><td colSpan="5"><Empty icon="bi-calendar2-x" text="No active students in this selection" /></td></tr>}
                {att.students.map((s) => (
                  <tr key={s.id} className={s.status === 'A' ? 'row-absent' : ''}>
                    <td>{s.roll_no || '—'}</td>
                    <td><strong>{fullName(s)}</strong><div className="school-muted">{s.admission_no}</div></td>
                    <td>{s.class_name || '—'}{s.section_name ? ` · ${s.section_name}` : ''}</td>
                    <td>
                      <select className={`form-select form-select-sm att-${s.status || 'none'}`} value={s.status || ''}
                        onChange={(e) => setAttStatus(s.id, e.target.value)}>
                        <option value="">Not marked</option>
                        {att.policies.map((p) => (
                          <option key={p.code} value={p.code}>{p.label}</option>
                        ))}
                      </select>
                    </td>
                    <td><input className="form-control form-control-sm" value={s.remarks || ''} placeholder="Optional"
                      onChange={(e) => setAttRemark(s.id, e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- FEES ---------------- */}
      {tab === 'fees' && (
        <div className="school-panel">
          <div className="school-stats">
            <Stat label="Billed" value={money(fees.summary.billed)} icon="bi-receipt" tone="blue" />
            <Stat label="Collected" value={money(fees.summary.collected)} icon="bi-cash-stack" tone="green" />
            <Stat label="Outstanding" value={money(fees.summary.outstanding)} icon="bi-exclamation-circle" tone="amber" sub={`${fees.summary.unpaid || 0} unpaid · ${fees.summary.partial || 0} partial`} />
            <Stat label="Invoices paid" value={fees.summary.paid || 0} icon="bi-check2-square" tone="teal" />
          </div>

          <div className="school-grid-2">
            <form className="school-card" onSubmit={createInvoice}>
              <header><h6>Raise invoice</h6></header>
              <div className="school-form-grid">
                <label className="span-2">Student<select className="form-select form-select-sm" value={invoiceDraft.studentId} required
                  onChange={(e) => setInvoiceDraft({ ...invoiceDraft, studentId: e.target.value })}>
                  <option value="">Choose student</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{fullName(s)} · {s.admission_no}</option>)}
                </select></label>
                <label>Title<input className="form-control form-control-sm" value={invoiceDraft.title} required
                  onChange={(e) => setInvoiceDraft({ ...invoiceDraft, title: e.target.value })} /></label>
                <label>Amount<input type="number" min="0" step="0.01" className="form-control form-control-sm" value={invoiceDraft.amount} required
                  onChange={(e) => setInvoiceDraft({ ...invoiceDraft, amount: e.target.value })} /></label>
                <label>Due date<input type="date" className="form-control form-control-sm" value={invoiceDraft.dueDate} required
                  onChange={(e) => setInvoiceDraft({ ...invoiceDraft, dueDate: e.target.value })} /></label>
                <div className="align-self-end"><button className="btn btn-sm btn-primary w-100" type="submit"><i className="bi bi-receipt"></i> Create invoice</button></div>
              </div>
            </form>

            <form className="school-card" onSubmit={recordPayment}>
              <header><h6>Record payment</h6></header>
              <div className="school-form-grid">
                <label className="span-2">Invoice<select className="form-select form-select-sm" value={payDraft.invoiceId} required
                  onChange={(e) => {
                    const inv = fees.invoices.find((i) => String(i.id) === e.target.value);
                    setPayDraft({ ...payDraft, invoiceId: e.target.value, amount: inv ? String(Number(inv.amount) - Number(inv.paid_amount)) : '' });
                  }}>
                  <option value="">Choose invoice</option>
                  {fees.invoices.filter((i) => i.status !== 'paid').map((i) => (
                    <option key={i.id} value={i.id}>{fullName(i)} · {i.title} · bal {money(Number(i.amount) - Number(i.paid_amount))}</option>
                  ))}
                </select></label>
                <label>Amount<input type="number" min="0" step="0.01" className="form-control form-control-sm" value={payDraft.amount} required
                  onChange={(e) => setPayDraft({ ...payDraft, amount: e.target.value })} /></label>
                <label>Method<select className="form-select form-select-sm" value={payDraft.method}
                  onChange={(e) => setPayDraft({ ...payDraft, method: e.target.value })}>
                  <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank">Bank transfer</option><option value="cheque">Cheque</option>
                </select></label>
                <label>Reference<input className="form-control form-control-sm" value={payDraft.reference}
                  onChange={(e) => setPayDraft({ ...payDraft, reference: e.target.value })} /></label>
                <div className="align-self-end"><button className="btn btn-sm btn-primary w-100" type="submit"><i className="bi bi-wallet2"></i> Record</button></div>
              </div>
            </form>
          </div>

          <section className="school-card mt-3">
            <header><h6>Invoices</h6><span className="school-muted">{fees.invoices.length} shown</span></header>
            <div className="school-table-wrap">
              <table className="table table-sm school-table">
                <thead><tr><th>#</th><th>Student</th><th>Title</th><th>Due</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {fees.invoices.length === 0 && <tr><td colSpan="9"><Empty icon="bi-receipt" text="No invoices yet" /></td></tr>}
                  {fees.invoices.map((i) => (
                    <tr key={i.id}>
                      <td><code>INV-{i.id}</code></td>
                      <td><strong>{fullName(i)}</strong><div className="school-muted">{i.class_name || ''}{i.section_name ? ` · ${i.section_name}` : ''}</div></td>
                      <td>{i.title}</td>
                      <td>{fmtDate(i.due_date)}</td>
                      <td>{money(i.amount)}</td>
                      <td>{money(i.paid_amount)}</td>
                      <td><strong>{money(i.balance)}</strong></td>
                      <td><span className={`badge school-badge ${i.status}`}>{i.status}</span></td>
                      <td className="text-end">{i.status !== 'paid' && <button className="btn btn-sm btn-outline-success" onClick={() => startPay(i)}>Pay</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="school-card mt-3">
            <header><h6>Recent payments</h6></header>
            <div className="school-table-wrap">
              <table className="table table-sm school-table">
                <thead><tr><th>#</th><th>Student</th><th>Invoice</th><th>Amount</th><th>Method</th><th>Reference</th><th>When</th></tr></thead>
                <tbody>
                  {fees.payments.length === 0 && <tr><td colSpan="7"><Empty icon="bi-wallet2" text="No payments recorded" /></td></tr>}
                  {fees.payments.map((p) => (
                    <tr key={p.id}>
                      <td><code>PAY-{p.id}</code></td><td>{fullName(p)}</td><td>{p.title}</td><td><strong>{money(p.amount)}</strong></td>
                      <td className="text-capitalize">{p.method}</td><td>{p.reference || '—'}</td><td>{fmtDate(p.paid_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ---------------- AUTOMATIONS ---------------- */}
      {tab === 'automations' && (
        <div className="school-panel">
          <div className="school-toolbar">
            <div>
              <strong>{auto.rules.filter((r) => r.enabled).length}</strong> active rule(s) · <span className="school-muted">{auto.counts.total || 0} notifications logged, {auto.counts.today || 0} today</span>
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-outline-secondary" onClick={clearLogs}>Clear log</button>
              <button className="btn btn-sm btn-primary" onClick={runAutomations} disabled={loading}>
                <i className="bi bi-play-fill"></i> Run automations
              </button>
            </div>
          </div>

          <div className="school-alert-note">
            <i className="bi bi-info-circle"></i>
            Provider credentials are not configured yet, so runs are safely <strong>simulated</strong>: every message is rendered and written to the notification log without contacting WhatsApp, email or push gateways.
          </div>

          <div className="school-grid-2">
            {auto.rules.map((r) => (
              <div className={`school-card rule-card ${r.enabled ? '' : 'off'}`} key={r.id}>
                <header>
                  <div>
                    <h6>{r.name}</h6>
                    <code>{r.code}</code>
                  </div>
                  <button className={`btn btn-sm ${r.enabled ? 'btn-outline-success' : 'btn-outline-secondary'}`} onClick={() => toggleRule(r)}>
                    {r.enabled ? 'Enabled' : 'Paused'}
                  </button>
                </header>
                <div className="school-rule-channels">
                  {String(r.channels).split(',').map((c) => <span className="badge school-badge channel" key={c}><i className={`bi ${c.trim() === 'email' ? 'bi-envelope' : c.trim() === 'push' ? 'bi-phone' : 'bi-whatsapp'}`}></i> {c.trim()}</span>)}
                </div>
                <p className="school-rule-template">{r.template}</p>
                <div className="school-muted">Config: {JSON.stringify(r.config || {})}</div>
              </div>
            ))}
          </div>

          <section className="school-card mt-3">
            <header><h6>Notification log</h6><span className="school-muted">latest 50</span></header>
            <div className="school-table-wrap">
              <table className="table table-sm school-table">
                <thead><tr><th>When</th><th>Rule</th><th>Student</th><th>Channel</th><th>Recipient</th><th>Message</th><th>Status</th></tr></thead>
                <tbody>
                  {auto.logs.length === 0 && <tr><td colSpan="7"><Empty icon="bi-bell-slash" text="No notifications yet — run automations to preview them" /></td></tr>}
                  {auto.logs.map((l) => (
                    <tr key={l.id}>
                      <td>{new Date(l.created_at).toLocaleString('en-IN')}</td>
                      <td><code>{l.rule_code}</code></td>
                      <td>{fullName(l) || '—'}</td>
                      <td className="text-capitalize">{l.channel}</td>
                      <td className="school-muted">{l.recipient || '—'}</td>
                      <td className="school-msg">{l.message}</td>
                      <td><span className={`badge school-badge ${l.status}`}>{l.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
