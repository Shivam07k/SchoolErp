# HR and Payroll Module — Build Plan

**Version 1.0** · Based on DESIGN.md · 2 November 2026

---

## Overview

This plan breaks the HR and Payroll module into 8 sequential steps. Each step delivers working, testable functionality.

**Dependencies:** Payroll requires Staff Attendance (from Attendance module). Build Attendance first or in parallel.

---

## Step 1: Staff Directory

**Target:** Complete staff master with history, shared with Timetable.

### Database
- `school_staff` — core record
- `school_staff_employment` — effective-dated history
- `school_staff_qualification` — degrees, teachable subjects/class levels
- `school_staff_document` — documents with expiry
- `school_staff_bank` — bank details
- `school_staff_statutory` — PAN, PF, ESI, PT
- `school_staff_nominee` — nominees
- `school_staff_emergency_contact` — emergency contacts
- Unique indexes: employee_code, PAN, PF number, ESI number
- Soft delete (`deleted_at`) everywhere
- Audit triggers on all tables

### Backend API (`/api/school/hr/*`)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/staff` | GET | List with filters (dept, designation, type, status) |
| `/staff` | POST | Create staff + initial employment |
| `/staff/:id` | GET | Full profile (all tabs) |
| `/staff/:id` | PUT | Update personal details |
| `/staff/:id/employment` | GET | Employment history |
| `/staff/:id/employment` | POST | Add employment record (transfer, promotion, exit) |
| `/staff/:id/qualifications` | GET/POST | Qualifications & teachable subjects |
| `/staff/:id/documents` | GET/POST | Documents with expiry alerts |
| `/staff/:id/bank` | GET/PUT | Bank details |
| `/staff/:id/statutory` | GET/PUT | PAN, PF, ESI, PT |
| `/staff/:id/nominees` | GET/POST | Nominees |
| `/staff/:id/emergency` | GET/POST | Emergency contacts |
| `/staff/import` | POST | Excel import with validation |
| `/staff/check-duplicates` | POST | Pre-import duplicate check |

### Frontend Screens
| Screen | File | Route |
|--------|------|-------|
| Staff List | `StaffList.jsx` | `/school/hr/staff` |
| Staff Profile | `StaffProfile.jsx` | `/school/hr/staff/:id` |
| Employment History | (tab in profile) | — |
| Qualifications | (tab in profile) | — |
| Documents | (tab in profile) | — |
| Bank & Statutory | (tab in profile, restricted) | — |
| Onboarding Checklist | `OnboardingChecklist.jsx` | `/school/hr/onboarding` |
| Exit & Settlement | `ExitSettlement.jsx` | `/school/hr/exit` |
| Letters | `StaffLetters.jsx` | `/school/hr/letters` |

### Permission
- `hr.view` — view staff list and profiles
- `hr.manage` — create/edit staff, employment, documents
- `hr.payroll_view` — view pay tab in profile (restricted)
- `hr.payroll_manage` — manage salary structures, payroll runs

### Done When
- All existing staff loaded via import
- Timetable module can read `school_staff_qualification` for teacher eligibility
- Employment history immutable (new records only, old ones never updated)

---

## Step 2: Leave Management

**Target:** Leave engine feeding Attendance, Timetable, and Payroll.

### Database
- `school_leave_type` — types with policy config
- `school_leave_policy` — type × category rules
- `school_leave_balance_entry` — ledger (accrual, usage, adjustment, encashment)
- `school_leave_application` — applications with approver chain
- `school_comp_off` — comp-off earned/used/expired
- `school_holiday` — shared with Timetable/Attendance

### Backend API (`/api/school/hr/leave/*`)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/types` | GET/POST | Leave type CRUD |
| `/policies` | GET/POST | Leave policy CRUD |
| `/balances` | GET | Current balances per staff/type |
| `/accrual/run` | POST | Monthly/yearly accrual job |
| `/carry-forward` | POST | Year-end carry forward |
| `/encashment` | POST | Year-end encashment |
| `/applications` | GET/POST | List/create applications |
| `/applications/:id` | PUT | Update (cancel/modify) |
| `/applications/:id/approve` | POST | Approve with chain |
| `/applications/:id/reject` | POST | Reject with reason |
| `/calendar` | GET | Team calendar (who's out) |
| `/comp-off` | GET/POST | Comp-off CRUD |
| `/holidays` | GET/POST | Holiday calendar |

### Frontend Screens
| Screen | File | Route |
|--------|------|-------|
| Leave Types & Policies | `LeaveTypes.jsx` | `/school/hr/leave/types` |
| Leave Balances | `LeaveBalances.jsx` | `/school/hr/leave/balances` |
| Apply Leave | `ApplyLeave.jsx` | `/school/hr/leave/apply` |
| Approver Inbox | `LeaveApprovals.jsx` | `/school/hr/leave/approvals` |
| Team Calendar | `LeaveCalendar.jsx` | `/school/hr/leave/calendar` |
| Comp-Off | `CompOff.jsx` | `/school/hr/leave/compoff` |
| Holidays | `Holidays.jsx` | `/school/hr/leave/holidays` |

### Integration Points
1. **On approve:** Insert into `school_attendance_entry` (leave marks) + `school_timetable_unavailability` (for substitution board)
2. **On cancel:** Reverse both
3. **Payroll** reads `school_leave_balance_entry` for loss-of-pay calculation

### Permission
- `hr.leave_view` — view balances, calendar
- `hr.leave_manage` — manage types, policies, accrual
- `hr.leave_approve` — approve/reject (HOD, Principal)
- `staff.leave_self` — apply, view own

### Done When
- Approved leave appears in Attendance register and Timetable substitution board automatically
- Balance = sum of ledger entries
- Year-end job creates carry-forward/encashment entries

---

## Step 3: Payroll Setup

**Target:** Configurable salary structures and statutory rules.

### Database
- `school_salary_component` — components (earning/deduction/employer)
- `school_salary_structure` — structures with version
- `school_salary_structure_line` — structure × component
- `school_staff_salary` — staff → structure assignment
- `school_statutory_rule` — PF, ESI, PT, TDS, Gratuity, Bonus (versioned)
- `school_statutory_rule_slab` — slabs for PT, TDS, etc.

### Backend API (`/api/school/hr/payroll/setup/*`)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/components` | GET/POST | Component CRUD |
| `/components/:id` | PUT/DELETE | Update/delete |
| `/structures` | GET/POST | Structure CRUD |
| `/structures/:id/lines` | GET/POST/PUT/DELETE | Structure lines |
| `/structures/:id/clone` | POST | Clone structure |
| `/assignments` | GET/POST | Staff salary assignments |
| `/assignments/:id` | PUT | Update assignment |
| `/statutory` | GET/POST | Statutory rules CRUD |
| `/statutory/:rule` | GET | Get rule (PF, ESI, PT, TDS, Gratuity, Bonus) |
| `/statutory/:rule/slabs` | GET/POST | Slab management |
| `/validate-structure` | POST | Wage-base check before assign |

### Frontend Screens
| Screen | File | Route |
|--------|------|-------|
| Salary Components | `SalaryComponents.jsx` | `/school/hr/payroll/components` |
| Salary Structures | `SalaryStructures.jsx` | `/school/hr/payroll/structures` |
| Structure Builder | `StructureBuilder.jsx` | `/school/hr/payroll/structures/:id` |
| Staff Assignments | `SalaryAssignments.jsx` | `/school/hr/payroll/assignments` |
| Statutory Rules | `StatutoryRules.jsx` | `/school/hr/payroll/statutory` |
| PF/ESI/PT/TDS Config | (per rule tabs) | — |

### Key Features
- Component calculation types: fixed, percent of another, formula (JS expression)
- Flags: taxable, wage_base, prorate, employer_contribution
- Structure versioning with effective dates
- Wage-base validation on assignment (warn if structure fails current PF/ESI base)
- Opening balance import for migration (YTD tax, PF, leave)

### Permission
- `hr.payroll_setup` — manage components, structures, statutory rules
- `hr.payroll_assign` — assign structures to staff

### Done When
- Sample payslip for one staff matches manual calculation exactly
- All statutory rules configurable with effective dates
- Structure assignment records versions used

---

## Step 4: Payroll Run

**Target:** Monthly payroll lifecycle — compute, preview, approve, lock, pay, post.

### Database
- `school_payroll_run` — run header with status, versions, dates
- `school_payslip` — one per staff per run
- `school_payslip_line` — component breakdown
- `school_payroll_adjustment` — arrears, bonus, recovery, reimbursement
- `school_tax_declaration` — staff tax regime, investments

### Backend API (`/api/school/hr/payroll/run/*`)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/runs` | GET | List runs with status |
| `/runs` | POST | Create draft run for period |
| `/runs/:id` | GET | Run detail with payslips |
| `/runs/:id/checks` | GET | Checks panel data |
| `/runs/:id/compute` | POST | Compute run (idempotent) |
| `/runs/:id/preview` | GET | Preview with variance from last month |
| `/runs/:id/adjustments` | GET/POST | Adjustments CRUD |
| `/runs/:id/approve` | POST | Approve (maker/checker) |
| `/runs/:id/lock` | POST | Lock run |
| `/runs/:id/unlock` | POST | Unlock (super admin only) |
| `/runs/:id/payslips` | GET | All payslips |
| `/runs/:id/payslips/:staffId` | GET | Single payslip |
| `/runs/:id/payslips/generate` | POST | Generate PDF for all |
| `/runs/:id/bank-advice` | GET | Bank advice file (CSV/Excel) |
| `/runs/:id/post-to-accounts` | POST | Create vouchers in Fees & Accounts |
| `/runs/:id/mark-paid` | POST | Mark paid after bank transfer |
| `/runs/:id/statutory-reports` | GET | PF/ESI/PT/TDS reports |

### Frontend Screens
| Screen | File | Route |
|--------|------|-------|
| Payroll Runs List | `PayrollRuns.jsx` | `/school/hr/payroll/runs` |
| Run Wizard | `PayrollWizard.jsx` | `/school/hr/payroll/runs/:id/wizard` |
| Checks Panel | (step in wizard) | — |
| Preview & Variance | (step in wizard) | — |
| Adjustments | (step in wizard) | — |
| Approve & Lock | (step in wizard) | — |
| Payslip View | `PayslipView.jsx` | `/school/hr/payroll/payslips/:id` |
| Bank Advice | `BankAdvice.jsx` | `/school/hr/payroll/bank-advice` |
| Salary Register | `SalaryRegister.jsx` | `/school/hr/payroll/register` |
| Statutory Reports | `StatutoryReports.jsx` | `/school/hr/payroll/statutory-reports` |

### Computation Logic
1. **Staff list:** Active in period (joining ≤ period end, exit ≥ period start or null)
2. **Paid days:** Period basis days − LOP days (unpaid leave + unapproved absence + late marks per policy)
3. **Earnings:** For each structure line with type=earning:
   - Fixed: `value`
   - Percent: `value% × base_component`
   - Formula: evaluate expression (context: paid_days, basis_days, other components)
   - If prorate: `amount × paid_days / basis_days`
4. **Variable additions:** Overtime (from Attendance), extra periods (from Timetable), adjustments
5. **Statutory deductions:** Apply rule versions recorded on run
   - PF: employee% × wage_base (capped at ceiling)
   - ESI: employee% × gross (if eligible)
   - PT: state slab
   - TDS: monthly projection based on regime, declarations
6. **Other deductions:** Advance/loan installments (from schedule), recoveries
7. **Net pay:** Gross earnings − deductions
8. **Employer contributions:** PF employer%, ESI employer%, gratuity provision, bonus provision

### Checks Panel (before compute)
- Staff with missing attendance data
- New joiners/leavers in period
- Staff with missing bank/PAN/PF details
- Open adjustments from previous runs
- Negative net pay warnings
- Large variance (>20%) from last month

### Permission
- `hr.payroll_prepare` — create run, compute, preview, adjustments
- `hr.payroll_approve` — approve (Accounts head)
- `hr.payroll_lock` — lock (Accounts head)
- `hr.payroll_unlock` — unlock (Super admin only)
- `hr.payroll_post` — post to accounts
- `hr.payroll_payslip` — view payslips (restricted)

### Done When
- Full month (150 staff) runs in < 30 seconds
- Preview shows variance column vs last month
- Locked run cannot be modified
- Payslips generated as PDF, emailable
- Bank advice file matches payslip totals
- Post to Accounts creates balanced vouchers

---

## Step 5: Advances

**Target:** Advance/loan requests with automatic payroll recovery.

### Database
- `school_advance` — advance/loan header
- `school_repayment_schedule` — installment schedule
- `school_advance_ledger_entry` — disbursement, recovery, prepayment, write-off

### Backend API (`/api/school/hr/advances/*`)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/advances` | GET/POST | List/create advances |
| `/advances/:id` | GET/PUT | Detail, update |
| `/advances/:id/approve` | POST | Approve with chain |
| `/advances/:id/disburse` | POST | Disburse (create ledger entry) |
| `/advances/:id/schedule` | GET | Repayment schedule |
| `/advances/:id/prepay` | POST | Early closure/prepayment |
| `/advances/:id/writeoff` | POST | Write-off with approval |
| `/advances/dashboard` | GET | Outstanding dashboard |

### Frontend Screens
| Screen | File | Route |
|--------|------|-------|
| Advance List | `AdvanceList.jsx` | `/school/hr/advances` |
| Advance Request | `AdvanceRequest.jsx` | `/school/hr/advances/new` |
| Advance Detail | `AdvanceDetail.jsx` | `/school/hr/advances/:id` |
| Schedule Preview | (in detail) | — |
| Outstanding Dashboard | `AdvanceDashboard.jsx` | `/school/hr/advances/dashboard` |

### Integration
- **Payroll run** reads due installments from `school_repayment_schedule` where `due_month = run_period` and `status = 'pending'`
- Adds as deduction line on payslip
- On payslip generation: marks schedule lines `recovered_in_run = run_id`, `status = 'recovered'`
- Creates `school_advance_ledger_entry` type=recovery
- At exit: remaining balance → final settlement

### Permission
- `hr.advance_request` — request advances
- `hr.advance_approve` — approve (HR, Principal)
- `hr.advance_manage` — disburse, schedule, write-off

### Done When
- Each installment recovered exactly once
- Early closure recalculates schedule correctly
- Outstanding dashboard matches ledger sum
- Exit settlement includes advance balance

---

## Step 6: Statutory and Year-End

**Target:** Compliance reports and year-end closing.

### Backend API (`/api/school/hr/payroll/statutory/*`)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/pf-report` | GET | PF return data (ECR format) |
| `/esi-report` | GET | ESI return data |
| `/pt-report` | GET | Professional tax return |
| `/tds-report` | GET | TDS return (Form 24Q/26Q) |
| `/form16` | GET | Form 16 for staff |
| `/form16/bulk` | POST | Bulk generate Form 16 PDFs |
| `/gratuity-report` | GET | Gratuity liability report |
| `/bonus-report` | GET | Bonus eligibility and calculation |
| `/final-settlement/:staffId` | GET | Final settlement calculation |
| `/year-end/leave` | POST | Leave year-end (carry forward + encashment) |
| `/year-end/lock` | POST | Lock financial year (no more runs) |

### Frontend Screens
| Screen | File | Route |
|--------|------|-------|
| PF Report | `PFReport.jsx` | `/school/hr/payroll/statutory/pf` |
| ESI Report | `ESIReport.jsx` | `/school/hr/payroll/statutory/esi` |
| PT Report | `PTReport.jsx` | `/school/hr/payroll/statutory/pt` |
| TDS Report | `TDSReport.jsx` | `/school/hr/payroll/statutory/tds` |
| Form 16 | `Form16.jsx` | `/school/hr/payroll/statutory/form16` |
| Gratuity Report | `GratuityReport.jsx` | `/school/hr/payroll/statutory/gratuity` |
| Bonus Report | `BonusReport.jsx` | `/school/hr/payroll/statutory/bonus` |
| Final Settlement | `FinalSettlement.jsx` | `/school/hr/final-settlement/:id` |
| Year-End Jobs | `YearEndJobs.jsx` | `/school/hr/year-end` |

### Permission
- `hr.statutory_reports` — view/generate statutory reports
- `hr.form16` — generate Form 16
- `hr.year_end` — run year-end jobs

### Done When
- PF/ESI/PT/TDS export files match payroll registers exactly
- Form 16 generates from locked runs only
- Year-end leave job creates ledger entries
- Final settlement = pending salary + leave encashment + gratuity − advance balance

---

## Step 7: HR Reports and Hardening

**Target:** Complete report suite, alerts, field-level security, audit.

### Reports (all with filters + CSV/Excel export)

| Report | API Endpoint | Screen |
|--------|--------------|--------|
| Staff Strength | `/reports/staff-strength` | `StaffStrengthReport.jsx` |
| Attrition | `/reports/attrition` | `AttritionReport.jsx` |
| Directory Export | `/reports/directory` | (button in StaffList) |
| Document Expiry | `/reports/doc-expiry` | `DocExpiryReport.jsx` |
| Leave Balances | `/reports/leave-balances` | `LeaveBalancesReport.jsx` |
| Leave Taken | `/reports/leave-taken` | `LeaveTakenReport.jsx` |
| Absence Patterns | `/reports/absence-patterns` | `AbsencePatternsReport.jsx` |
| Salary Register | `/reports/salary-register` | `SalaryRegisterReport.jsx` |
| Salary Abstract | `/reports/salary-abstract` | `SalaryAbstractReport.jsx` |
| Payslips Bulk | `/reports/payslips` | (from payroll run) |
| Bank Advice | `/reports/bank-advice` | (from payroll run) |
| Dept Salary Cost | `/reports/dept-cost` | `DeptCostReport.jsx` |
| Month Variance | `/reports/month-variance` | `MonthVarianceReport.jsx` |
| Arrears | `/reports/arrears` | `ArrearsReport.jsx` |
| Advances Outstanding | `/reports/advances-outstanding` | `AdvancesOutstandingReport.jsx` |
| PF/ESI/PT/TDS Registers | `/reports/statutory-registers` | `StatutoryRegistersReport.jsx` |
| Form 16 | `/reports/form16` | (from statutory) |
| Gratuity Liability | `/reports/gratuity` | `GratuityLiabilityReport.jsx` |
| Overtime/Extra Periods | `/reports/overtime` | `OvertimeReport.jsx` |
| Substitution Impact | `/reports/substitution` | `SubstitutionImpactReport.jsx` |
| Salary Change Audit | `/reports/salary-audit` | `SalaryAuditReport.jsx` |
| Payroll Unlock Audit | `/reports/unlock-audit` | `UnlockAuditReport.jsx` |

### Security Hardening
- Field-level masking: PAN, PF, ESI, bank account, salary components
- Access logging: every view of payslip, salary tab, statutory detail logged
- Maker/checker enforcement: no self-approval for leave, advance, payroll
- Role-based column visibility in lists

### Alerts (implemented as notification rules)
| Alert | Trigger | Recipients |
|-------|---------|------------|
| Leave applied | New application | Approver |
| Leave approved/rejected | Status change | Staff, Timetable coordinator |
| Doc/contract/probation expiry | 30/15/7 days before | HR, Staff |
| Payroll ready | Run status = computed | Accounts head |
| Payslip released | Run locked | Staff |
| Advance approved | Advance status = approved | Staff, HR |
| Installment due | 3 days before payroll | Staff, HR |
| Statutory due | 7 days before due date | Accounts head |
| Missing bank/PAN | On payroll checks panel | HR |

### Permission
- `hr.reports` — view all reports
- `hr.audit` — view audit reports

### Done When
- Every report figure traces to source entries (payslip lines, ledger entries)
- All alerts fire correctly
- Field masking works in UI and API
- No self-approval possible

---

## Step 8: Later (Optional)

**Not in first release. Add only when needed.**

| Feature | Description |
|---------|-------------|
| Recruitment | Job postings, applications, interview scheduling, offer letters |
| Appraisals | KPIs, review cycles, ratings, promotion recommendations |
| Training | Training needs, courses, attendance, certificates |
| E-signed letters | Digital signature on appointment/experience letters |
| Device attendance | Biometric/RFID/GPS integration |
| Direct filing | PF/ESI/TDS portal API integration |
| Bank payment API | Direct salary credit via bank API |
| Expense claims | Staff expense submission and approval |

---

## Migration Checklist (for existing schools)

| Data | Source | Target Table |
|------|--------|--------------|
| Staff master | Existing HR | `school_staff`, `school_staff_employment` |
| Leave balances | Leave system | `school_leave_balance_entry` (opening) |
| Salary structures | Payroll system | `school_salary_structure`, lines |
| Staff assignments | Payroll system | `school_staff_salary` |
| YTD tax/PF/ESI | Payroll registers | `school_payroll_adjustment` (type=opening) |
| Advances/loans | Loan system | `school_advance`, `school_repayment_schedule` |
| Statutory numbers | PF/ESI/PT returns | `school_statutory_rule` (current version) |

---

## Timeline Estimate

| Step | Effort | Dependencies |
|------|--------|--------------|
| 1. Staff Directory | 2 weeks | — |
| 2. Leave Management | 2 weeks | Attendance (for integration) |
| 3. Payroll Setup | 1.5 weeks | Step 1 |
| 4. Payroll Run | 2.5 weeks | Steps 1, 2, 3 + Attendance |
| 5. Advances | 1 week | Steps 1, 4 |
| 6. Statutory/Year-End | 1.5 weeks | Steps 3, 4 |
| 7. Reports/Hardening | 1.5 weeks | Steps 1-6 |
| **Total** | **~12 weeks** | |

---

## Acceptance Criteria Summary

| Step | Key Acceptance |
|------|----------------|
| 1 | Timetable reads teachers from Staff Directory; employment history immutable |
| 2 | Approved leave → Attendance + Timetable Unavailability automatically |
| 3 | Sample payslip matches manual calc; statutory rules versioned |
| 4 | 150 staff run < 30s; locked run immutable; payslips PDF; bank advice balanced; posts to Accounts |
| 5 | Each installment recovered once; dashboard = ledger sum |
| 6 | Statutory exports match registers; Form 16 from locked runs; final settlement correct |
| 7 | All reports traceable; alerts fire; masking works; no self-approval |