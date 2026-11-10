# HR and Payroll Module — Complete Plan Index

**Version 1.0** · 2 November 2026

---

## Plan Directory Structure

```
plan/hr_and_payroll/
├── DESIGN.md              # Complete design document (from user)
├── BUILD_PLAN.md          # 8-step build plan with deliverables
├── DATABASE_SCHEMA.sql    # 5 migration files (60-64)
├── API_ENDPOINTS.md       # All REST endpoints with permissions
├── FRONTEND_SCREENS.md    # 40+ React components with routes
├── INTEGRATION_POINTS.md  # Timetable, Attendance, Accounts contracts
├── STATUTORY_RULES.md     # PF, ESI, PT, TDS, Gratuity, Bonus configs
├── TEST_SCENARIOS.md      # 92 test cases + automation structure
└── README.md              # This file
```

---

## Quick Reference

### Build Steps (12 weeks)

| Step | Deliverable | Key Files |
|------|-------------|-----------|
| 1 | Staff Directory | `school_staff*`, `StaffList`, `StaffProfile`, `/hr/staff` |
| 2 | Leave Management | `school_leave*`, `LeaveApprovals`, `LeaveCalendar`, `/hr/leave/*` |
| 3 | Payroll Setup | `school_salary*`, `school_statutory_rule`, `SalaryStructures`, `/hr/payroll/setup` |
| 4 | Payroll Run | `school_payroll_run`, `school_payslip`, `PayrollWizard`, `/hr/payroll/runs` |
| 5 | Advances | `school_advance*`, `AdvanceList`, `/hr/advances` |
| 6 | Statutory/Year-End | PF/ESI/PT/TDS reports, Form 16, `/hr/payroll/statutory` |
| 7 | Reports/Hardening | 22 reports, alerts, field masking, audit |
| 8 | Later (optional) | Recruitment, appraisal, training, e-sign |

### Key Database Tables (28 new tables)

| Domain | Tables |
|--------|--------|
| Staff | `school_staff`, `school_staff_employment`, `school_staff_qualification`, `school_staff_document`, `school_staff_bank`, `school_staff_statutory`, `school_staff_nominee`, `school_staff_emergency_contact` |
| Leave | `school_leave_type`, `school_leave_policy`, `school_leave_balance_entry`, `school_leave_application`, `school_comp_off`, `school_holiday` |
| Payroll | `school_salary_component`, `school_salary_structure`, `school_salary_structure_line`, `school_staff_salary`, `school_statutory_rule`, `school_payroll_run`, `school_payslip`, `school_payslip_line`, `school_payroll_adjustment`, `school_tax_declaration` |
| Advances | `school_advance`, `school_repayment_schedule`, `school_advance_ledger_entry` |
| System | `school_hr_notification`, `school_hr_setting` |

### API Endpoints (120+)

| Router | Base Path | Count |
|--------|-----------|-------|
| `school_hr_staff` | `/api/school/hr/staff` | 25 |
| `school_hr_leave` | `/api/school/hr/leave` | 20 |
| `school_hr_payroll_setup` | `/api/school/hr/payroll/setup` | 15 |
| `school_hr_payroll_run` | `/api/school/hr/payroll/run` | 25 |
| `school_hr_advances` | `/api/school/hr/advances` | 12 |
| `school_hr_reports` | `/api/school/hr/reports` | 22 |
| `school_hr_settings` | `/api/school/hr/settings` | 4 |
| `school_hr_self` | `/api/school/hr/self` | 10 |

### Frontend Screens (40+)

| Category | Screens |
|----------|---------|
| Staff | StaffList, StaffProfile (8 tabs), Onboarding, Exit, Letters, Import |
| Leave | Types, Policies, Balances, Apply, Approvals, Calendar, CompOff, Holidays |
| Payroll Setup | Components, Structures, Builder, Assignments, Statutory |
| Payroll Run | Runs, Wizard (5 steps), PayslipView, BankAdvice, Register, StatutoryReports, TaxDeclarations |
| Advances | List, Request, Detail, Dashboard |
| Reports | 22 report components + ReportShell |
| Settings | HRSettings, Notifications |
| Self-Service | Profile, Leave, Payslips, Tax, Advances, Documents |

### Integration Points

| Module | HR → Module | Module → HR |
|--------|-------------|-------------|
| **Timetable** | Staff master, teachable subjects, leave unavailability | Teacher allocation reads staff qualifications |
| **Attendance** | Leave marks (approved leave → attendance entries) | Paid days, LOP, overtime, extra periods for payroll |
| **Fees & Accounts** | Payroll vouchers, advance vouchers, statutory payment vouchers | Chart of accounts for component mapping |

### Statutory Rules (6 versioned)

| Rule | Key Config | Versioning |
|------|------------|------------|
| PF | wage_base_components, employee_rate (12%), employer_rate (12%), ceiling (15,000) | Rate/ceiling/base changes |
| ESI | wage_base_components, employee_rate (0.75%), employer_rate (3.25%), threshold (21,000) | Threshold/rate changes |
| PT | State slabs, adjustment_month | State budget changes |
| TDS | Old/new regime slabs, deductions, rebates | Budget changes |
| Gratuity | eligibility_years (5), formula (15/26), max_limit (20L) | Limit changes |
| Bonus | eligibility_months (30), pay_ceiling (21,000), min/max % | Act amendments |

### Permissions (25 HR-specific)

| Category | Permissions |
|----------|-------------|
| Staff | `hr.view`, `hr.manage`, `hr.payroll_view`, `hr.payroll_manage` |
| Leave | `hr.leave_view`, `hr.leave_manage`, `hr.leave_approve` |
| Payroll | `hr.payroll_setup`, `hr.payroll_assign`, `hr.payroll_prepare`, `hr.payroll_approve`, `hr.payroll_lock`, `hr.payroll_unlock`, `hr.payroll_post`, `hr.payroll_payslip` |
| Advances | `hr.advance_request`, `hr.advance_approve`, `hr.advance_manage` |
| Reports | `hr.reports`, `hr.statutory_reports`, `hr.form16`, `hr.audit`, `hr.year_end` |
| Self | `staff.self`, `staff.leave_self`, `staff.payslip_self`, `staff.tax_self`, `staff.advance_self` |

### Test Coverage (92 scenarios)

| Category | Count | Automation |
|----------|-------|------------|
| Staff Directory | 18 | ✅ pytest + Playwright |
| Leave Management | 25 | ✅ pytest + Playwright |
| Payroll | 28 | ✅ pytest + Playwright |
| Advances | 13 | ✅ pytest |
| Reports/Compliance | 8 | ✅ pytest |
| **Total** | **92** | |

---

## Migration Files (Run in Order)

```bash
# 1. Staff Directory
psql -f sql/60_hr_staff.sql

# 2. Leave Management
psql -f sql/61_hr_leave.sql

# 3. Payroll Core
psql -f sql/62_hr_payroll.sql

# 4. Advances
psql -f sql/63_hr_advances.sql

# 5. Audit & Settings
psql -f sql/64_hr_audit.sql
```

---

## Dependencies

### Must Build First
- **Attendance module** — provides paid days/LOP/overtime to payroll
- **Timetable module** — reads staff qualifications, receives unavailability
- **Fees & Accounts** — receives vouchers, provides chart of accounts

### Existing Tables Referenced
- `school_account` (chart of accounts for component mapping)
- `school_financial_year` (tax declarations)
- `school_academic_years` (leave year option)
- `school_subjects` / `school_classes` (teachable subjects)
- `school_attendance_policy` (leave categories)
- `school_audit_log` / `audit_fee_accounts_changes()` (audit triggers)

---

## Open Decisions (Confirm with School)

1. **Statutory coverage**: Which of PF/ESI/PT/TDS/Gratuity/Bonus apply?
2. **Salary day basis**: Calendar / 30-day / working days?
3. **Leave policy**: Year type, types, accrual, carry forward, encashment
4. **LOP policy**: Unapproved absence + late marks treatment
5. **Pay method**: Bank advice file format, which banks
6. **Staff categories**: Part-time/visiting paid per period from timetable?
7. **Advance policy**: Limits, interest, max installment % of net
8. **Approvers**: Who approves leave, advances, payroll (HOD/Principal/Accounts)
9. **Migration**: Existing salary data, YTD tax/PF, leave balances

---

## Next Actions

1. **Review DESIGN.md** with stakeholders
2. **Confirm open decisions** (Section 13 of DESIGN.md)
3. **Run migration 60** → verify staff import
4. **Build Step 1** (Staff Directory) → demo to Timetable team
5. **Build Step 2** (Leave) → integrate with Attendance + Timetable
6. **Build Steps 3-4** (Payroll) → integrate with Accounts
7. **Build Steps 5-7** → complete module
8. **UAT** with HR, Accounts, Principal
9. **Go live** with parallel run (1 month)

---

## Related Documents

| Document | Purpose |
|----------|---------|
| `DESIGN.md` | Full design from user |
| `BUILD_PLAN.md` | Step-by-step implementation |
| `DATABASE_SCHEMA.sql` | Ready-to-run migrations |
| `API_ENDPOINTS.md` | Backend contract |
| `FRONTEND_SCREENS.md` | Component tree + routes |
| `INTEGRATION_POINTS.md` | Module contracts |
| `STATUTORY_RULES.md` | PF/ESI/PT/TDS/Gratuity/Bonus configs |
| `TEST_SCENARIOS.md` | 92 test cases + automation |