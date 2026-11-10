# School HR and Payroll Module — Design and Scenario Document

**Design document** · Version 1.0 · 2 November 2026

---

## 1. Purpose and scope

This document describes a simple, fast and reliable HR and payroll module for the school ERP. It shares the staff master with the Timetable module, takes attendance from the Attendance module, and posts salaries to the Fees and Accounts module.

**Submodules:** Staff Directory, Leave Management, Payroll, Advances, HR Reports.

**Requirements**
- One record per staff member, with history of every change.
- A leave is approved once and then reflected in attendance, the timetable and payroll.
- A monthly payroll run takes minutes, shows a preview, and never goes wrong silently.
- Statutory rules (PF, ESI, professional tax, TDS, gratuity, bonus) are settings, not code.
- Advances and loans are recovered automatically.
- Every change to staff, leave and pay is audited, and salary data is visible only to those who need it.

**Out of scope for the first release:** recruitment, appraisals and KPIs, training, e-signed letters, and direct filing of statutory returns. Section 11 shows where they fit later.

---

## 2. Recommended solution in brief

1. **Keep one staff record** with effective-dated history (designation, department, type, pay).
2. **Build pay from a salary structure** of components (earnings, deductions, employer contributions) with formulas, assigned to each staff member from an effective date.
3. **Run a leave policy engine:** leave types, accrual, and balances kept as ledger entries. Approved leave flows by itself to Staff Attendance, Timetable Unavailability and payroll.
4. **Treat the monthly payroll as a run** with a lifecycle: compute, preview, approve, lock, pay, post. Corrections after the lock are adjustments in the next run.
5. **Handle advances and loans** as a repayment schedule recovered through payroll.
6. **Keep every statutory rule** as a versioned setting with effective dates, including the definition of the wage base.
7. **Never overwrite history.** Payroll runs and payslips are versioned and locked.
8. **Build in this order:** directory, leave, payroll setup, payroll run, advances, statutory and year-end, reports.

---

## 3. What other school ERPs do

Reviewed: Entab CampusCare, Class ON, EduTinker, eSchoolApp, Weblink, IITMS, Cybrosys HRMS.

**Common pattern:** central staff record, leave and attendance feeding a formula-driven payroll, loans and advances recovered in payroll, payslips and statutory reports at month end. This design follows it, and keeps statutory rules configurable because they change.

---

## 4. Core design

### 4.1 How a month's salary is worked out

1. The staff list is every active staff member in the period, respecting joining and exit dates.
2. Paid days = days in the month's basis minus loss-of-pay days. Loss of pay comes from unpaid leave and unapproved absence in Staff Attendance.
3. Each earning component of the assigned structure is calculated (fixed, percentage of another component, or formula), prorated by paid days where flagged.
4. Variable items added: overtime, extra-period or substitution allowance, bonus, arrears, reimbursements.
5. Statutory deductions from versioned rules and wage base: PF, ESI, professional tax, TDS.
6. Other deductions: advance and loan installments, recoveries.
7. Net pay = earnings − deductions. Employer contributions tracked separately.
8. Result is a draft payroll run. Previewed with change from last month, approved, then locked.

### 4.2 The four mechanisms behind almost every scenario

| Mechanism | What it covers |
|-----------|----------------|
| Staff record with effective-dated history | Joining, confirmation, transfer, promotion, revision, exit, re-joining |
| Salary structure and formulas | Components, proration, statutory flags, assignment by date |
| Leave policy and balance ledger | Types, accrual, carry forward, encashment, approvals |
| Payroll run lifecycle | Draft, previewed, approved, locked, paid, posted; adjustments after lock |

**Lifecycles:**
- **Leave:** Applied → Approved/Rejected → Taken/Cancelled
- **Advance:** Requested → Approved → Disbursed → Recovering → Closed
- **Payroll run:** Draft → Reviewed → Approved → Locked → Paid → Posted

---

## 5. Why this is fast and reliable

**Speed:** Data is small. 150 staff over 12 months = 1,800 payslips/year. A whole run calculates in seconds.

| Risk | Protection |
|------|------------|
| Wrong salary | Checks panel before approval: missing attendance, new joiners/leavers, negative net pay, large changes from last month |
| Rule changes | Structures and statutory rules versioned with effective dates; each run records versions used |
| Double payment | One payslip per staff per period; paid flag; bank advice made once |
| Leave balance errors | Balance = sum of ledger entries (accruals, usage, adjustments) |
| Double recovery of installment | Each schedule line recovered once, by one payroll run |
| Changes after payment | Locked runs immutable; fixes are arrears/recoveries in next run |
| Exposure of salary data | Role-based and field-level access; every view of pay logged |
| Sensitive identity data | ID and bank numbers masked on screen, restricted by role |
| Self-approval | Maker and checker must be different people |
| Bad import | Validate first, row-wise errors, save only if clean |
| Deleted staff | Soft delete only; history kept |

---

## 6. Data model

### 6.1 Staff Directory

| Table | Key fields |
|-------|------------|
| **Staff** | employee_code, name, date_of_birth, contact, address, photo, status |
| **Employment** | staff, designation, department, type (permanent, contract, part-time, visiting), joining_date, confirmation_date, reports_to, exit_date, exit_reason, effective_from, effective_to |
| **Qualification** | staff, degree, subject, institute, year; teachable subjects and class levels (shared with Timetable) |
| **Document** | staff, type, file, expiry |
| **BankDetail** | staff, bank, account, IFSC |
| **StatutoryDetail** | staff, PAN, PF_number, ESI_number, professional_tax_flag |
| **Nominee** | staff, name, relation, share, phone |
| **EmergencyContact** | staff, name, relation, phone |

### 6.2 Leave Management

| Table | Key fields |
|-------|------------|
| **LeaveType** | name, paid/unpaid, accrual_rule, carry_forward, encashable, half_day_allowed, document_needed |
| **LeavePolicy** | leave_type, staff_category, yearly_quota, rules |
| **LeaveBalanceEntry** | staff, leave_type, date, change, source (accrual, usage, adjustment, encashment) |
| **LeaveApplication** | staff, type, from, to, half_day, days, reason, attachment, status, approver_chain |
| **CompOff** | earned_date, expiry, used_on |
| **Holiday** | shared calendar with Timetable and Attendance |

### 6.3 Payroll

| Table | Key fields |
|-------|------------|
| **SalaryComponent** | name, type (earning, deduction, employer_contribution), calculation (fixed, percent, formula), taxable, wage_base_flag, prorate_flag, account |
| **SalaryStructure** | name, version, effective_date |
| **SalaryStructureLine** | structure, component, value_or_formula |
| **StaffSalary** | staff, structure, overrides, effective_from |
| **StatutoryRule** | rule (PF, ESI, professional_tax, TDS, gratuity, bonus), wage_base_definition, slabs, version, effective_date |
| **PayrollRun** | period, status, rule_versions, run_by, run_at, approved_by, approved_at |
| **Payslip** | run, staff, paid_days, gross, deductions, net, status, file |
| **PayslipLine** | payslip, component, amount |
| **PayrollAdjustment** | staff, period, component, amount, reason, type (arrears, bonus, recovery, reimbursement) |
| **TaxDeclaration** | staff, regime, investments, proofs |

### 6.4 Advances

| Table | Key fields |
|-------|------------|
| **Advance** | staff, type (salary_advance, loan), amount, reason, installments, interest, status, approvals |
| **RepaymentSchedule** | advance, due_month, amount, status, recovered_in_run |
| **AdvanceLedgerEntry** | advance, date, type (disbursement, recovery, prepayment, write_off), amount |

### 6.5 System tables

AuditLog, Notification, Setting, User and Role.

---

## 7. Rules and policies

### Hard rules (always blocked)
- Two payslips for one staff member in a period
- Editing a locked run
- Leave that overlaps another leave
- Leave before joining or after exit
- Leave beyond balance unless policy allows loss of pay
- Salary structure change without effective date and approval
- Advance above limit without higher approval
- Approving your own leave, advance or payroll

### Soft rules (warn only)
- Large month-on-month change in pay
- Missing bank or PAN details
- New advance while one is open
- Long run of leave days
- Leave on a staff member's exam duty

### Policy settings the school can change

| Setting | Options |
|---------|---------|
| Leave year | Academic year, financial year or calendar year |
| Accrual, carry forward, encashment | By leave type and staff category |
| Weekly offs and holidays inside a leave | Counted as leave or not |
| Loss of pay | Unapproved absence and late marks (e.g., three lates = half-day) |
| Salary day basis | Calendar days, 30 days or working days |
| Proration for joiners and leavers | Daily rate on the basis above |
| Extra-period and overtime rate | Per period or per hour |
| Advance limits | Months of salary, maximum installment as share of net pay, interest |
| Recovery when net pay is short | Carry forward, or part recovery |
| Payroll lock | Date, and who can unlock |
| Payslip release | On approval, or on payment |

### 7.1 Statutory rules, kept as versioned settings

| Rule | What the setting holds |
|------|------------------------|
| **PF** | Wage base, employee/employer rates, wage ceiling, admin charges |
| **ESI** | Eligibility threshold, contribution rates and periods |
| **Professional tax** | State slabs and month of adjustment |
| **TDS** | Regime, projection, declarations and proofs, Form 16 |
| **Gratuity** | Eligibility and formula |
| **Bonus** | Eligibility, pay ceiling, percentage |

> **Note:** India's labour codes took effect 21 Nov 2025. Basic pay, dearness allowance and retaining allowance form the wage base, and excluded allowances above half of total pay are added back. This affects PF, ESI, gratuity and bonus. Central rules notified in 2026; some state dates differ. Keep wage base and rates as settings with effective dates, confirm with school's accountant.

---

## 8. Screens

### 8.1 Staff Directory
- List with filters (department, designation, type, status) and search
- Profile tabs: personal details, employment history, qualifications/subjects, documents with expiry alerts, bank/statutory details, pay (restricted), leave, advances, timeline
- Onboarding checklist, exit and final settlement, appointment/experience letters, Excel import

### 8.2 Leave Management
- Staff apply on portal or phone
- Approver inbox shows balance and periods needing cover
- Team calendar of who is out
- Policy setup, comp-off, holidays, encashment, cancel/modify

### 8.3 Payroll
- Setup: components, structures, statutory rules
- Assignment of structures
- Monthly run wizard: select period → checks panel → compute → preview with variance → adjustments → approve → lock
- Payslips: PDF, email, WhatsApp, portal
- Bank advice file
- Salary register and abstract
- Posting to Accounts
- Statutory reports, Form 16, arrears and revisions

### 8.4 Advances
- Request, approval, disbursement
- Repayment schedule and installment preview
- Early closure, outstanding dashboard
- Recovery in payroll
- Write-off with approval

### 8.5 HR Reports (section 10)

### 8.6 Staff self-service
- Profile change requests, leave, payslips, tax declarations, advances, documents

---

## 9. Workflows

### 9.1 Joining to exit
1. HR creates staff record, uploads documents, assigns department, designation, type
2. Salary structure assigned with effective date, opening leave balances set
3. Subjects/class levels added for teachers → Timetable uses them
4. Changes (transfer, promotion, revision) = new effective-dated records
5. On exit: HR records resignation, notice, last working day. Final settlement covers pending salary, leave encashment, gratuity, advance recovery. Staff becomes inactive, history kept.

### 9.2 Leave
1. Staff applies → system checks balance, overlaps, policy, shows periods needing cover
2. Approver (HOD/Principal) approves/rejects with reason
3. On approval: Staff Attendance marks leave, Timetable gets Unavailability row → Substitution board proposes cover
4. Cancellation reverses all three. Unapproved absences = loss of pay at payroll.

### 9.3 Monthly payroll run
1. HR opens period → checks panel: missing attendance, new joiners/leavers, missing bank details, open adjustments
2. System computes run → preview with change from last month
3. HR adds adjustments (arrears, bonus, recoveries) → re-runs as needed
4. Accounts head approves → run locked
5. Payslips released, bank advice generated → after payment: run marked Paid, posted to Accounts

### 9.4 Advance or loan
1. Staff/HR raises request with amount, reason, installments
2. System shows installment preview against limits → approvers approve → disbursed
3. Each month installment recovered in payroll run. Early closure/prepayment allowed
4. At exit: balance recovered in final settlement

### 9.5 Links with other modules

| Module | What flows |
|--------|------------|
| **Attendance** | Paid days, unpaid leave, late marks, overtime |
| **Timetable** | Leave/absence → Unavailability; teachers' subjects; extra-period/substitution counts → allowances |
| **Fees and Accounts** | Payroll/advance vouchers; bank payment |

**Accounting entries:**

| Event | Debit | Credit |
|-------|-------|--------|
| Payroll approved | Salary expense, employer contributions | Salary payable, PF/ESI/PT/TDS payable, staff advances receivable |
| Salary paid | Salary payable | Bank |
| Advance disbursed | Staff advances receivable | Bank/cash |
| Statutory payment | PF/ESI/PT/TDS payable | Bank |

---

## 10. Roles, alerts and reports

### Roles

| Role | Allowed actions |
|------|-----------------|
| Super admin | Setup, policies, unlock payroll |
| Principal | Approve HOD leave, advances, exceptions |
| HR officer | Staff records, leave, payroll preparation |
| Accounts head | Approve/lock payroll, payments, statutory |
| HOD | Approve leave in department |
| Staff | Self-service: own profile, leave, payslips, advances |
| Auditor | Read-only access |

### Alerts

| Event | Who is notified |
|-------|-----------------|
| Leave applied/approved/rejected | Approver, staff, Timetable coordinator |
| Document/contract/probation expiring | HR, staff |
| Payroll ready for approval | Accounts head |
| Payslip released | Staff |
| Advance approved, installment due | Staff, HR |
| Statutory due dates | Accounts head |
| Missing bank or PAN details | HR |

### Reports
- Staff strength by department, type, designation
- Joining and exit (attrition)
- Directory export
- Document expiry, probation and contract renewals
- Leave balances and leave taken
- Absence and late patterns
- Salary register and abstract
- Payslips
- Bank advice
- Department-wise salary cost
- Month-on-month variance
- Arrears
- Advances outstanding and recovery
- PF, ESI, professional tax, TDS and Form 16
- Gratuity liability
- Overtime and extra periods
- Substitution impact
- Audit of salary changes and payroll unlocks

---

## 11. Scenario coverage

The Step column refers to the build plan in section 12. 'Later' = step 8.

### 11.1 Staff directory and lifecycle
| Scenario | How handled | Step |
|----------|-------------|------|
| New joining, or joining mid-month | Staff record; pay prorated for days worked | 1, 4 |
| Documents missing or expiring | Checklist and expiry alerts | 1 |
| Contract, part-time or visiting teacher | Employment type; pay can be per period from Timetable | 1, 3 |
| Probation and confirmation | Dates on record, alert on due date | 1 |
| Transfer, promotion, designation change | New effective-dated employment record | 1 |
| Change of subject or class level | Updates teacher's eligibility in Timetable | 1 |
| Increment or salary revision | New structure from effective date; arrears if back-dated | 3, 4 |
| Resignation, notice, last day | Exit record and checklist | 1 |
| Termination or absconding | Exit with reason; settlement by policy | 6 |
| Final settlement | Pending salary, leave encashment, gratuity, advance recovery | 6 |
| Re-joining | New employment record on same staff record | 1 |
| Duplicate staff record | Blocked by unique keys; merge tool keeps history | 1 |
| Staff changes own details | Change request approved by HR | 1 |
| Bank or ID details change | Verified before use in payroll | 1 |

### 11.2 Leave
| Scenario | How handled | Step |
|----------|-------------|------|
| Full-day or half-day leave | Application with days calculated by policy | 2 |
| Not enough balance | Loss of pay or negative balance, by policy | 2 |
| Overlapping applications | Blocked | 2 |
| Leave touching a holiday or weekly off | Counted or not by policy setting | 2 |
| Leave across month end | Split by month for payroll | 2, 4 |
| Back-dated or emergency leave | Allowed within window with approver's note | 2 |
| Sick leave needing certificate | Attachment required above set days | 2 |
| Maternity/paternity, long leave | Special leave types with own rules | 2 |
| Cancel approved leave | Reverses attendance, Timetable and balance | 2 |
| Leave during exam duty | Warning; coordinator approval | 2 |
| Approver absent | Delegate approver | 2 |
| Leave rejected | Reason recorded; staff notified | 2 |
| Year-end carry forward/encashment | Year-end job by policy, as ledger entries | 2, 6 |
| Accrual for joiners | Pro-rata from joining date | 2 |
| Comp-off for working on holiday | Earned, expires, can be used | 2 |
| Unapproved absence | Loss of pay at payroll | 4 |
| Late marks | Converted to half-day by policy | 4 |
| Staff leaves with balance | Encash or lapse by policy | 6 |

### 11.3 Payroll
| Scenario | How handled | Step |
|----------|-------------|------|
| Joiner/leaver in the month | Daily-rate proration | 4 |
| Loss of pay and half-days | Paid days reduced | 4 |
| Overtime, extra periods, substitution pay | Variable components from Attendance/Timetable | 4 |
| Bonus, ex-gratia, reimbursement | Adjustment lines | 4 |
| Arrears after back-dated revision | Arrears adjustment from effective date | 4 |
| Salary on hold | Hold flag; paid in later run | 4 |
| Net pay negative | Blocked until approved; shortfall carried forward | 4 |
| Attendance changed after run | Re-run before lock; adjustment after | 4 |
| Wrong salary found after payment | Adjustment in next run, with reason | 4 |
| Payment returned by bank | Re-pay with new details; audited | 4 |
| PF with current wage base | Rule version with effective date | 3, 6 |
| ESI eligibility and contribution periods | ESI rule setting | 3, 6 |
| Professional tax by state | State slabs in rule | 3, 6 |
| TDS, tax regime, declarations, proofs | Monthly projection; Form 16 at year end | 6 |
| Gratuity and bonus | Rule-based calculation and reports | 6 |
| Salary structure fails wage-base check | Warning when assigning structure | 3 |
| Payslip dispute | Review, then correction by adjustment | 4 |
| Salary certificate or Form 16 | Generated from locked runs | 6 |
| Migration mid-year | Opening balances, YTD tax and PF amounts imported | 3 |

### 11.4 Advances
| Scenario | How handled | Step |
|----------|-------------|------|
| Salary advance within the month | Recovered in next run | 5 |
| Loan with installments | Schedule recovered monthly | 5 |
| Interest-free or with interest | Interest setting on advance | 5 |
| Above the limit | Needs higher approval | 5 |
| Early closure or part prepayment | Schedule recalculated; ledger entry | 5 |
| Staff resigns with balance | Recovered in final settlement | 5, 6 |
| Skipped installment | Approved skip; schedule extended | 5 |
| Second advance while one open | Warning and approval | 5 |
| Net pay too low for installment | Part recovery or carry forward by policy | 5 |
| Write-off | Approval, then write-off entry | 5 |

### 11.5 Reports, compliance and data
| Scenario | How handled | Step |
|----------|-------------|------|
| Data for PF, ESI, PT, TDS returns | Statutory reports with export | 6 |
| Audit of pay changes | Audit log and report | 7 |
| Privacy of staff data | Masking, field-level access, access logs | 7 |
| Year-end close | Form 16, leave year-end, lock of the year | 6 |
| Recruitment, appraisal, training, e-signed letters | Later modules | Later |

---

## 12. Build plan

Payroll depends on Staff Attendance from the Attendance module, so build that first or alongside.

| Step | Deliverable | Done when |
|------|-------------|-----------|
| **1. Staff Directory** | Staff, employment history, qualifications/subjects, documents, bank/statutory details, Excel import | All staff loaded; Timetable reads teachers from it |
| **2. Leave Management** | Types, policies, balances, applications, approvals, calendar, links to Attendance and Timetable | Approved leave appears in attendance and on Substitution board |
| **3. Payroll setup** | Components, structures, staff assignment, statutory settings, opening balances | Sample payslip matches manual calculation |
| **4. Payroll run** | Checks panel, compute, preview, adjustments, approve, lock, payslips, bank advice, posting to Accounts | Full month runs in minutes with no manual calculation |
| **5. Advances** | Requests, approvals, schedules, recovery in payroll, ledger | Installments recovered exactly once |
| **6. Statutory and year-end** | PF, ESI, PT, TDS reports, Form 16, gratuity, final settlement | Returns data matches payroll registers |
| **7. HR Reports and hardening** | All reports, alerts, roles, field-level security, audit | Every figure traces to its entries |
| **8. Later (optional)** | Recruitment, appraisal, training, e-signed letters, device/location attendance, direct filing, bank payment API, expense claims | Added only when needed |

---

## 13. Open decisions

1. **Statutory coverage:** Which of PF, ESI, professional tax, TDS, gratuity, bonus apply based on headcount, pay levels, state. Confirm with accountant, including wage-base rules.
2. **Salary day basis:** Calendar days, 30 days, or working days.
3. **Leave policy:** Leave year, types, accrual, carry forward, encashment.
4. **Loss-of-pay policy:** How unapproved absence and late marks are treated.
5. **Pay method:** Bank advice file or manual transfer; which banks.
6. **Staff categories:** Whether part-time/visiting teachers paid per period from timetable.
7. **Advance policy:** Limits, interest, maximum installment.
8. **Approvals:** Who approves leave, advances, payroll.
9. **Migration:** Existing salary data, YTD tax and PF figures, leave balances.