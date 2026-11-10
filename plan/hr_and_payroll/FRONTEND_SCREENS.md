# HR and Payroll Module — Frontend Screens

**Version 1.0** · Based on DESIGN.md and BUILD_PLAN.md · 2 November 2026

---

## Screen Architecture

All screens in `src/pages/school/hr/` following existing patterns:
- `PageShell` from `../fee/shared.jsx` (shared utilities)
- `apiGet`, `apiPost`, `apiPut`, `apiDelete` from `../../../api`
- Role-based rendering via `canManage`, `canView` helpers
- Bootstrap 5 + Bootstrap Icons

---

## Directory Structure

```
src/pages/school/hr/
├── shared.jsx                    # Shared components, helpers
├── staff/
│   ├── StaffList.jsx             # /school/hr/staff
│   ├── StaffProfile.jsx          # /school/hr/staff/:id
│   ├── EmploymentTab.jsx         # Employment history tab
│   ├── QualificationsTab.jsx     # Qualifications tab
│   ├── DocumentsTab.jsx          # Documents tab
│   ├── BankStatutoryTab.jsx      # Bank & Statutory tab (restricted)
│   ├── LeaveTab.jsx              # Leave tab
│   ├── AdvancesTab.jsx           # Advances tab
│   ├── TimelineTab.jsx           # Audit timeline tab
│   ├── OnboardingChecklist.jsx   # /school/hr/onboarding
│   ├── ExitSettlement.jsx        # /school/hr/exit
│   ├── StaffLetters.jsx          # /school/hr/letters
│   └── StaffImport.jsx           # Import modal
├── leave/
│   ├── LeaveTypes.jsx            # /school/hr/leave/types
│   ├── LeavePolicies.jsx         # /school/hr/leave/policies
│   ├── LeaveBalances.jsx         # /school/hr/leave/balances
│   ├── ApplyLeave.jsx            # /school/hr/leave/apply
│   ├── LeaveApprovals.jsx        # /school/hr/leave/approvals
│   ├── LeaveCalendar.jsx         # /school/hr/leave/calendar
│   ├── CompOff.jsx               # /school/hr/leave/compoff
│   └── Holidays.jsx              # /school/hr/leave/holidays
├── payroll/
│   ├── setup/
│   │   ├── SalaryComponents.jsx  # /school/hr/payroll/components
│   │   ├── SalaryStructures.jsx  # /school/hr/payroll/structures
│   │   ├── StructureBuilder.jsx  # /school/hr/payroll/structures/:id
│   │   ├── SalaryAssignments.jsx # /school/hr/payroll/assignments
│   │   └── StatutoryRules.jsx    # /school/hr/payroll/statutory
│   ├── run/
│   │   ├── PayrollRuns.jsx       # /school/hr/payroll/runs
│   │   ├── PayrollWizard.jsx     # /school/hr/payroll/runs/:id/wizard
│   │   ├── ChecksPanel.jsx       # Wizard step 1
│   │   ├── PreviewVariance.jsx   # Wizard step 2
│   │   ├── AdjustmentsPanel.jsx  # Wizard step 3
│   │   ├── ApproveLockPanel.jsx  # Wizard step 4
│   │   ├── PayslipView.jsx       # /school/hr/payroll/payslips/:id
│   │   ├── BankAdvice.jsx        # /school/hr/payroll/bank-advice
│   │   ├── SalaryRegister.jsx    # /school/hr/payroll/register
│   │   └── StatutoryReports.jsx  # /school/hr/payroll/statutory-reports
│   └── tax/
│       └── TaxDeclarations.jsx   # /school/hr/payroll/tax-declarations
├── advances/
│   ├── AdvanceList.jsx           # /school/hr/advances
│   ├── AdvanceRequest.jsx        # /school/hr/advances/new
│   ├── AdvanceDetail.jsx         # /school/hr/advances/:id
│   └── AdvanceDashboard.jsx      # /school/hr/advances/dashboard
├── reports/
│   ├── ReportShell.jsx           # Base report component
│   ├── StaffStrengthReport.jsx
│   ├── AttritionReport.jsx
│   ├── DocExpiryReport.jsx
│   ├── LeaveBalancesReport.jsx
│   ├── LeaveTakenReport.jsx
│   ├── AbsencePatternsReport.jsx
│   ├── SalaryRegisterReport.jsx
│   ├── SalaryAbstractReport.jsx
│   ├── DeptCostReport.jsx
│   ├── MonthVarianceReport.jsx
│   ├── ArrearsReport.jsx
│   ├── AdvancesOutstandingReport.jsx
│   ├── StatutoryRegistersReport.jsx
│   ├── Form16Report.jsx
│   ├── GratuityLiabilityReport.jsx
│   ├── OvertimeReport.jsx
│   ├── SubstitutionImpactReport.jsx
│   ├── SalaryAuditReport.jsx
│   └── UnlockAuditReport.jsx
├── settings/
│   ├── HRSettings.jsx            # /school/hr/settings
│   └── Notifications.jsx         # /school/hr/notifications
└── self/
    ├── SelfProfile.jsx           # /school/hr/self/profile
    ├── SelfLeave.jsx             # /school/hr/self/leave
    ├── SelfPayslips.jsx          # /school/hr/self/payslips
    ├── SelfTax.jsx               # /school/hr/self/tax
    ├── SelfAdvances.jsx          # /school/hr/self/advances
    └── SelfDocuments.jsx         # /school/hr/self/documents
```

---

## Screen Details

### 1. Staff Directory

#### StaffList (`/school/hr/staff`)
- **Layout**: Filter bar (dept, designation, type, status, search) + paginated table
- **Table columns**: Employee Code, Name, Department, Designation, Type, Status, Joining Date, Actions
- **Actions**: View (→ Profile), Edit (hr.manage), Exit (hr.manage)
- **Toolbar**: Import, Export, New Staff
- **Permission**: `hr.view` for list, `hr.manage` for actions

#### StaffProfile (`/school/hr/staff/:id`)
- **Tabs**: Personal, Employment, Qualifications, Documents, Bank & Statutory (restricted), Leave, Advances, Timeline
- **Header**: Name, code, status badge, photo, quick actions
- **Personal tab**: Editable fields (name, DOB, contact, address) with change request flow
- **Employment tab**: Timeline of employment records, Add button (transfer/promotion/exit)
- **Qualifications tab**: Degree list + teachable subjects/classes (multi-select from Subjects/Classes)
- **Documents tab**: Document list with expiry alerts (color-coded), upload, verify
- **Bank & Statutory tab**: Only visible with `hr.payroll_view` — masked PAN/bank on view, reveal on click
- **Leave tab**: Current balances, recent applications
- **Advances tab**: Active advances, schedule
- **Timeline tab**: Audit log filtered to this staff (employment changes, salary changes, leave, advances)

#### OnboardingChecklist (`/school/hr/onboarding`)
- Checklist per staff: personal details, documents, bank, statutory, structure assignment, leave balances
- Progress bar, overdue alerts

#### ExitSettlement (`/school/hr/exit`)
- Exit form: resignation date, notice period, last working day, reason
- Settlement computation: pending salary, leave encashment, gratuity, advance recovery
- Generate settlement letter

#### StaffLetters (`/school/hr/letters`)
- Templates: Appointment, Experience, Salary Certificate, Relieving
- Merge fields from staff record
- PDF generation, print, email

---

### 2. Leave Management

#### LeaveTypes (`/school/hr/leave/types`)
- Card grid: name, code, paid/unpaid, half-day, document threshold, active toggle
- Create/Edit modal: all policy fields (accrual rule JSON editor, carry forward, encashment)

#### LeavePolicies (`/school/hr/leave/policies`)
- Matrix: Leave Type × Staff Category → yearly quota, accrual frequency, rules

#### LeaveBalances (`/school/hr/leave/balances`)
- Table: Staff, Leave Type, Opening, Accrued, Used, Encashed, Carried Forward, Current Balance
- Filters: staff, type, leave year
- Actions: Manual adjustment (hr.leave_manage), View ledger

#### ApplyLeave (`/school/hr/leave/apply`)
- Form: leave type, from/to date, half-day, reason, attachment
- Real-time: shows balance, warns if insufficient, calculates days per policy
- Shows periods needing cover (from Timetable)

#### LeaveApprovals (`/school/hr/leave/approvals`)
- Inbox for approvers: pending applications with balance, days, cover periods
- Actions: Approve (with comment), Reject (with reason), Delegate
- Filters: department, leave type, date range

#### LeaveCalendar (`/school/hr/leave/calendar`)
- Monthly calendar view: color-coded leaves per staff
- Click day → list of staff on leave
- Filters: department, leave type

#### CompOff (`/school/hr/leave/compoff`)
- List: earned date, reason, expiry, status, used on
- Actions: Create (hr.leave_manage), Cancel, Mark used

#### Holidays (`/school/hr/leave/holidays`)
- List with recurring rule editor
- Applicable to: staff, students, or both

---

### 3. Payroll Setup

#### SalaryComponents (`/school/hr/payroll/components`)
- Table: Code, Name, Type, Calculation, Taxable, Wage Base, Proratable, Account
- Create/Edit: Formula editor with autocomplete (component codes), validation

#### SalaryStructures (`/school/hr/payroll/structures`)
- List: Name, Version, Effective From/To, Active
- Actions: View/Edit, Clone, Assign

#### StructureBuilder (`/school/hr/payroll/structures/:id`)
- Two-pane: left = available components, right = structure lines (drag-drop reorder)
- Line editor: override value/percent/formula, condition
- Preview: sample calculation for given paid days

#### SalaryAssignments (`/school/hr/payroll/assignments`)
- Table: Staff, Current Structure, Effective From/To, Overrides
- Assign modal: structure picker, effective date, overrides editor
- Wage-base validation warning banner

#### StatutoryRules (`/school/hr/payroll/statutory`)
- Tabs per rule: PF, ESI, PT, TDS, Gratuity, Bonus
- Versioned list with effective dates
- Config editor: JSON with schema validation
- Slab management for PT/TDS (state-specific)

---

### 4. Payroll Run

#### PayrollRuns (`/school/hr/payroll/runs`)
- List: Period, Status, Staff Count, Gross, Net, Run By, Run At, Actions
- Actions: New Run, Open Wizard (if draft/computed), View (if locked)

#### PayrollWizard (`/school/hr/payroll/runs/:id/wizard`)
**Stepper**: Checks → Compute → Preview → Adjustments → Approve → Lock

**ChecksPanel** (Step 1):
- Cards: Missing Attendance, New Joiners/Leavers, Missing Bank/PAN, Open Adjustments
- Each card: count, "View" link → filtered list
- "Re-check" button

**PreviewVariance** (Step 2):
- Table: Staff, Gross (Current), Gross (Last Month), Variance %, Net (Current), Net (Last Month), Variance %
- Filters: show only >20% variance, negative net
- "Recalculate" button

**AdjustmentsPanel** (Step 3):
- List existing adjustments (arrears, bonus, recovery, reimbursement)
- Add adjustment modal: staff, component, amount, reason, type
- "Recalculate" updates preview

**ApproveLockPanel** (Step 4):
- Maker/checker: current user shown as maker, requires different approver
- "Approve" → status=approved, "Lock" → status=locked
- Lock confirmation modal with warning

#### PayslipView (`/school/hr/payroll/payslips/:id`)
- Header: Staff, Period, Status, Paid Days, LOP Days
- Earnings table: Component, Amount
- Deductions table: Component, Amount
- Employer Contributions table
- Totals: Gross, Deductions, Net, Employer Total
- Actions: Download PDF, Email, WhatsApp, View PDF preview

#### BankAdvice (`/school/hr/payroll/bank-advice`)
- Table: Staff, Account, IFSC, Net Pay
- Summary: Total amount, count
- Export: CSV (bank format), Excel
- Generate after lock, before payment

#### SalaryRegister (`/school/hr/payroll/register`)
- Detailed register: Staff, Designation, Dept, Paid Days, each component, Gross, Deductions, Net
- Filters: department, designation
- Export: Excel with formatting

#### StatutoryReports (`/school/hr/payroll/statutory-reports`)
- Tabs: PF (ECR), ESI, PT, TDS, Gratuity, Bonus
- Each: preview table, export (statutory format), download

#### TaxDeclarations (`/school/hr/payroll/tax-declarations`)
- List: Staff, Regime, 80C, 80D, 80CCD(1B), 24B, Status
- Actions: Verify, Reject, View proofs
- Staff self-service: own declaration form with investment fields

---

### 5. Advances

#### AdvanceList (`/school/hr/advances`)
- Table: Staff, Type, Amount, Installments, Interest, Status, Requested, Actions
- Filters: type, status, date range
- Actions: View, Approve/Reject (if requested), Disburse (if approved)

#### AdvanceRequest (`/school/hr/advances/new`)
- Form: Type, Amount, Reason, Installments, Interest
- Preview: installment schedule with amounts, due months
- Policy warnings: limit check, existing advance check

#### AdvanceDetail (`/school/hr/advances/:id`)
- Header: Staff, Type, Amount, Status, Progress bar
- Schedule table: Installment, Due Month, Principal, Interest, Total, Status, Recovered In
- Ledger: Disbursement, Recoveries, Prepayments, Write-offs
- Actions: Disburse, Prepay, Write-off, Skip installment

#### AdvanceDashboard (`/school/hr/advances/dashboard`)
- Cards: Total Outstanding, Due This Month, Overdue, Written Off
- Charts: Outstanding by type, Recovery trend
- Table: Staff with outstanding > 0

---

### 6. Reports

#### ReportShell (base component)
- Props: title, icon, filters, data, columns, export handlers
- Filter bar: date range, department, staff type, etc.
- Toolbar: Refresh, Export CSV, Export Excel, Print
- Table: sortable, paginated, responsive
- Empty state, loading, error handling

#### Key Reports
- **StaffStrengthReport**: Dept × Designation × Type matrix
- **AttritionReport**: Monthly join/exit, attrition rate
- **DocExpiryReport**: Expiring in 30/60/90 days, probation due, contract due
- **LeaveBalancesReport**: Staff × Type with current balance
- **LeaveTakenReport**: Leave taken by type, month, department
- **AbsencePatternsReport**: Late marks, unapproved absences, patterns
- **SalaryRegisterReport**: Full register with all components
- **SalaryAbstractReport**: Summary by department
- **DeptCostReport**: Department-wise cost with employer contributions
- **MonthVarianceReport**: Current vs previous month per staff
- **ArrearsReport**: Arrears adjustments with source run
- **AdvancesOutstandingReport**: Outstanding advances with aging
- **StatutoryRegistersReport**: PF/ESI/PT/TDS registers per month
- **Form16Report**: Form 16 data per staff
- **GratuityLiabilityReport**: Eligible staff, years, liability amount
- **OvertimeReport**: Overtime hours, extra periods, substitution pay
- **SubstitutionImpactReport**: Substitution periods, cost
- **SalaryAuditReport**: All salary changes with before/after
- **UnlockAuditReport**: Payroll unlock events with reason

---

### 7. Settings & Notifications

#### HRSettings (`/school/hr/settings`)
- Sections: Leave, Payroll, Advances, Statutory
- Each setting: label, input (select, number, JSON editor), description
- Save → updates `school_hr_setting` table

#### Notifications (`/school/hr/notifications`)
- Inbox: unread badge, filter by type
- List: type, subject, time, read status
- Actions: Mark read, View reference

---

### 8. Staff Self-Service

#### SelfProfile (`/school/hr/self/profile`)
- View personal details, employment, qualifications
- Change request form: field, new value, reason
- Document upload

#### SelfLeave (`/school/hr/self/leave`)
- Balance card per type
- Apply leave form (same as ApplyLeave but pre-filled staff)
- History: past applications with status

#### SelfPayslips (`/school/hr/self/payslips`)
- List: Period, Gross, Deductions, Net, Status, Download PDF
- Filter: financial year

#### SelfTax (`/school/hr/self/tax`)
- Declaration form: regime, investments per section
- Submit for verification
- View Form 16 when available

#### SelfAdvances (`/school/hr/self/advances`)
- Active advances with schedule
- Request new advance
- Prepayment option

#### SelfDocuments (`/school/hr/self/documents`)
- Own documents with expiry alerts
- Upload new documents

---

## Navigation Integration

Add to `src/school/menu.js`:

```javascript
{
  group: 'Finance',
  key: 'hr', label: 'HR & Payroll', icon: 'bi-people',
  perm: 'hr.view', built: true,
  children: [
    // Staff
    { key: 'staff', label: 'Staff Directory', path: '/school/hr/staff', built: true },
    { key: 'onboarding', label: 'Onboarding', path: '/school/hr/onboarding', built: true },
    { key: 'exit', label: 'Exit & Settlement', path: '/school/hr/exit', built: true },
    { key: 'letters', label: 'Letters', path: '/school/hr/letters', built: true },
    // Leave
    { key: 'leave-types', label: 'Leave Types', path: '/school/hr/leave/types', built: true },
    { key: 'leave-balances', label: 'Leave Balances', path: '/school/hr/leave/balances', built: true },
    { key: 'leave-apply', label: 'Apply Leave', path: '/school/hr/leave/apply', built: true },
    { key: 'leave-approvals', label: 'Approvals', path: '/school/hr/leave/approvals', built: true },
    { key: 'leave-calendar', label: 'Calendar', path: '/school/hr/leave/calendar', built: true },
    { key: 'compoff', label: 'Comp-Off', path: '/school/hr/leave/compoff', built: true },
    { key: 'holidays', label: 'Holidays', path: '/school/hr/leave/holidays', built: true },
    // Payroll
    { key: 'payroll-components', label: 'Salary Components', path: '/school/hr/payroll/components', built: true },
    { key: 'payroll-structures', label: 'Structures', path: '/school/hr/payroll/structures', built: true },
    { key: 'payroll-assignments', label: 'Assignments', path: '/school/hr/payroll/assignments', built: true },
    { key: 'payroll-statutory', label: 'Statutory Rules', path: '/school/hr/payroll/statutory', built: true },
    { key: 'payroll-runs', label: 'Payroll Runs', path: '/school/hr/payroll/runs', built: true },
    { key: 'payroll-register', label: 'Salary Register', path: '/school/hr/payroll/register', built: true },
    { key: 'payroll-bank-advice', label: 'Bank Advice', path: '/school/hr/payroll/bank-advice', built: true },
    { key: 'payroll-statutory-reports', label: 'Statutory Reports', path: '/school/hr/payroll/statutory-reports', built: true },
    { key: 'tax-declarations', label: 'Tax Declarations', path: '/school/hr/payroll/tax-declarations', built: true },
    // Advances
    { key: 'advances', label: 'Advances', path: '/school/hr/advances', built: true },
    { key: 'advance-dashboard', label: 'Advance Dashboard', path: '/school/hr/advances/dashboard', built: true },
    // Reports
    { key: 'hr-reports', label: 'HR Reports', path: '/school/hr/reports', built: true },
    // Settings
    { key: 'hr-settings', label: 'Settings', path: '/school/hr/settings', built: true },
    { key: 'hr-notifications', label: 'Notifications', path: '/school/hr/notifications', built: true },
  ],
},
```

---

## Routing in SchoolPage.jsx

```javascript
if (module === 'hr') {
  // Staff
  if (!sub || sub === 'staff') return <StaffList me={me} onNavigate={onNavigate} />;
  if (sub === 'staff' && rest[0]) return <StaffProfile me={me} onNavigate={onNavigate} staffId={rest[0]} />;
  if (sub === 'onboarding') return <OnboardingChecklist me={me} onNavigate={onNavigate} />;
  if (sub === 'exit') return <ExitSettlement me={me} onNavigate={onNavigate} />;
  if (sub === 'letters') return <StaffLetters me={me} onNavigate={onNavigate} />;
  
  // Leave
  if (sub === 'leave-types') return <LeaveTypes me={me} onNavigate={onNavigate} />;
  if (sub === 'leave-policies') return <LeavePolicies me={me} onNavigate={onNavigate} />;
  if (sub === 'leave-balances') return <LeaveBalances me={me} onNavigate={onNavigate} />;
  if (sub === 'leave-apply') return <ApplyLeave me={me} onNavigate={onNavigate} />;
  if (sub === 'leave-approvals') return <LeaveApprovals me={me} onNavigate={onNavigate} />;
  if (sub === 'leave-calendar') return <LeaveCalendar me={me} onNavigate={onNavigate} />;
  if (sub === 'compoff') return <CompOff me={me} onNavigate={onNavigate} />;
  if (sub === 'holidays') return <Holidays me={me} onNavigate={onNavigate} />;
  
  // Payroll Setup
  if (sub === 'payroll-components') return <SalaryComponents me={me} onNavigate={onNavigate} />;
  if (sub === 'payroll-structures') return <SalaryStructures me={me} onNavigate={onNavigate} />;
  if (sub === 'payroll-structures' && rest[0]) return <StructureBuilder me={me} onNavigate={onNavigate} structureId={rest[0]} />;
  if (sub === 'payroll-assignments') return <SalaryAssignments me={me} onNavigate={onNavigate} />;
  if (sub === 'payroll-statutory') return <StatutoryRules me={me} onNavigate={onNavigate} />;
  
  // Payroll Run
  if (sub === 'payroll-runs') return <PayrollRuns me={me} onNavigate={onNavigate} />;
  if (sub === 'payroll-runs' && rest[0] === 'wizard' && rest[1]) return <PayrollWizard me={me} onNavigate={onNavigate} runId={rest[1]} />;
  if (sub === 'payroll-payslips' && rest[0]) return <PayslipView me={me} onNavigate={onNavigate} payslipId={rest[0]} />;
  if (sub === 'payroll-bank-advice') return <BankAdvice me={me} onNavigate={onNavigate} />;
  if (sub === 'payroll-register') return <SalaryRegister me={me} onNavigate={onNavigate} />;
  if (sub === 'payroll-statutory-reports') return <StatutoryReports me={me} onNavigate={onNavigate} />;
  if (sub === 'tax-declarations') return <TaxDeclarations me={me} onNavigate={onNavigate} />;
  
  // Advances
  if (sub === 'advances') return <AdvanceList me={me} onNavigate={onNavigate} />;
  if (sub === 'advances' && rest[0] === 'new') return <AdvanceRequest me={me} onNavigate={onNavigate} />;
  if (sub === 'advances' && rest[0]) return <AdvanceDetail me={me} onNavigate={onNavigate} advanceId={rest[0]} />;
  if (sub === 'advance-dashboard') return <AdvanceDashboard me={me} onNavigate={onNavigate} />;
  
  // Reports
  if (sub === 'reports' || sub === 'hr-reports') return <ReportsDashboard me={me} onNavigate={onNavigate} />;
  
  // Settings
  if (sub === 'settings') return <HRSettings me={me} onNavigate={onNavigate} />;
  if (sub === 'notifications') return <Notifications me={me} onNavigate={onNavigate} />;
  
  // Self-service
  if (sub === 'self') {
    if (!rest[0] || rest[0] === 'profile') return <SelfProfile me={me} onNavigate={onNavigate} />;
    if (rest[0] === 'leave') return <SelfLeave me={me} onNavigate={onNavigate} />;
    if (rest[0] === 'payslips') return <SelfPayslips me={me} onNavigate={onNavigate} />;
    if (rest[0] === 'tax') return <SelfTax me={me} onNavigate={onNavigate} />;
    if (rest[0] === 'advances') return <SelfAdvances me={me} onNavigate={onNavigate} />;
    if (rest[0] === 'documents') return <SelfDocuments me={me} onNavigate={onNavigate} />;
  }
  
  return <FeesFallback sub={sub} onNavigate={onNavigate} />; // reuse fallback pattern
}
```

---

## Shared Utilities (`src/pages/school/hr/shared.jsx`)

```javascript
// Re-export from fee/shared + HR-specific
export { PageShell, Empty, Loading, ErrorBox, Badge, downloadCsv, fmtDate, moneyOrDash } from '../fee/shared';

// HR-specific helpers
export function canManageHR(me, permission = 'hr.manage') {
  const perms = me?.permissions || [];
  return Boolean(me?.isSuper || perms.includes('*') || perms.includes(permission));
}

export function canViewHR(me, permission = 'hr.view') {
  const perms = me?.permissions || [];
  return Boolean(me?.isSuper || perms.includes('*') || perms.includes(permission));
}

export function maskPAN(pan) {
  if (!pan) return '—';
  return pan.slice(0, 3) + '*****' + pan.slice(-1);
}

export function maskBankAccount(acc) {
  if (!acc) return '—';
  return '****' + acc.slice(-4);
}

export const LEAVE_STATUS_TONE = {
  pending: 'warning', approved: 'success', rejected: 'danger', cancelled: 'secondary', taken: 'info'
};

export const ADVANCE_STATUS_TONE = {
  requested: 'warning', approved: 'info', rejected: 'danger',
  disbursed: 'primary', recovering: 'warning', closed: 'success', written_off: 'dark'
};

export const PAYROLL_STATUS_TONE = {
  draft: 'secondary', computed: 'info', previewed: 'primary',
  approved: 'warning', locked: 'success', paid: 'success', posted: 'success', cancelled: 'danger'
};
```

---

## Component Patterns

### Standard List Screen
```jsx
const MyList = ({ me, onNavigate }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const manager = canManageHR(me);
  
  useEffect(() => { load(); }, [filters]);
  
  return (
    <PageShell title="Title" icon="bi-icon" subtitle="..." onNavigate={onNavigate}
      actions={manager && <button onClick={...}>New</button>}
    >
      <FilterBar filters={filters} onChange={setFilters} />
      <Table data={data} loading={loading} columns={...} 
        onRowClick={(row) => onNavigate(`/school/hr/.../${row.id}`)} 
        actions={manager ? [(row) => <EditBtn />, (row) => <DeleteBtn />] : []}
      />
    </PageShell>
  );
};
```

### Wizard Step Pattern
```jsx
const WizardStep = ({ step, totalSteps, title, children, onBack, onNext, nextDisabled, nextLabel }) => (
  <div>
    <div className="mb-3">
      <div className="d-flex justify-content-between">
        <span>Step {step} of {totalSteps}</span>
        <span className="text-muted">{title}</span>
      </div>
      <div className="progress" style={{ height: 4 }}>
        <div className="progress-bar" style={{ width: `${(step/totalSteps)*100}%` }}></div>
      </div>
    </div>
    {children}
    <div className="d-flex justify-content-end gap-2 mt-4">
      {step > 1 && <button className="btn btn-outline-secondary" onClick={onBack}>Back</button>}
      <button className="btn btn-primary" onClick={onNext} disabled={nextDisabled}>
        {nextLabel || (step === totalSteps ? 'Finish' : 'Next')}
      </button>
    </div>
  </div>
);
```