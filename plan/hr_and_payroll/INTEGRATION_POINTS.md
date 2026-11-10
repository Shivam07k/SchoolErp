# HR and Payroll Module — Integration Points

**Version 1.0** · Based on DESIGN.md · 2 November 2026

---

## Overview

The HR and Payroll module integrates with three core modules:
1. **Timetable** — shares staff master, receives teacher eligibility, sends leave unavailability
2. **Attendance** — receives leave marks, sends paid days/LOP/overtime to payroll
3. **Fees & Accounts** — receives payroll/advance vouchers, sends chart of accounts

---

## 1. Timetable Integration

### Data Flow: HR → Timetable

| Event | HR Action | Timetable Consumes |
|-------|-----------|-------------------|
| Staff created/updated | `school_staff` row; API mirrors it into `school_hr_employees` via `school_staff.hr_employee_id` | Teacher list for allocation (`GET /school/academics/teachers`) |
| Subject/class eligibility changed | `school_staff_qualification.teachable_subjects`, `teachable_classes` | Subject allocation validation |
| Employment status changed | `school_staff.status` → mirrored employee `status` (`exited`/`inactive` become `inactive`) | Availability for timetable |
| Staff exited | `school_staff.status = 'exited'` | Remove from teacher dropdowns |

### Data Flow: HR → Timetable (Leave)

| Event | HR Action | Timetable Action |
|-------|-----------|------------------|
| Leave approved | Insert `school_leave_application` (status=approved) | Create `school_timetable_unavailability` for each day |
| Leave cancelled | Update `school_leave_application` (status=cancelled) | Delete corresponding `school_timetable_unavailability` |
| Comp-off used | Update `school_comp_off.used_on` | Create unavailability |

**Timetable Unavailability Schema** (in Timetable module):
```sql
CREATE TABLE school_timetable_unavailability (
  id SERIAL PRIMARY KEY,
  app_id TEXT,
  staff_id INT REFERENCES school_staff(id),
  date DATE NOT NULL,
  session TEXT, -- 'forenoon', 'afternoon', 'full'
  reason TEXT,  -- 'leave', 'comp_off', 'od'
  source_type TEXT, -- 'leave_application', 'comp_off'
  source_id INT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### API Contract

**HR posts to Timetable:**
```
POST /api/school/timetable/unavailability
{
  "staff_id": 123,
  "from_date": "2026-11-15",
  "to_date": "2026-11-17",
  "session": "full",
  "reason": "leave",
  "source_type": "leave_application",
  "source_id": 456
}
```

**Timetable reads from HR:**
```
GET /api/school/hr/staff?status=active&type=permanent,contract,part_time
→ Returns staff with teachable_subjects, teachable_classes

GET /api/school/hr/staff/:id/qualifications
→ Returns degrees, teachable subjects/classes
```

### HR UI → Timetable Links
- Staff Profile → "View Timetable" button → `/school/timetable/teacher/:hr_employee_id`
- Leave Approvals → "Substitution Board" link → `/school/timetable/substitutions?date=:date`

### Staff ↔ Teacher Identity Bridge

The HR master (`school_staff`) and the operational teacher table (`school_hr_employees`) are separate `SERIAL` sequences, so raw ids must never be mixed across modules.

- `school_staff.hr_employee_id` is the explicit one-to-one mapping (`sql/65_staff_teacher_bridge.sql`).
- Staff create/update, employment changes and bulk import call `syncStaffToEmployee()`, which upserts the employee row keyed by `employee_code` and refreshes the mapping.
- Soft-deleting a staff record only sets the employee `status='inactive'`; timetable, attendance and exam history keep their foreign keys.
- `resolveTeacher()` and `GET /school/academics/teachers` expose both the employee id (used by timetable) and `staff_id`/`employee_code` for display.

---

## 2. Attendance Integration

### Data Flow: HR → Attendance (Leave Marks)

| Event | HR Action | Attendance Action |
|-------|-----------|-------------------|
| Leave approved | `school_leave_application` approved | For each day in range: insert `school_attendance_entry` with policy=leave, leave_application_id |
| Leave cancelled | `school_leave_application` cancelled | Delete corresponding `school_attendance_entry` where leave_application_id |
| Comp-off used | `school_comp_off` marked used | Insert attendance entry with policy=comp_off |

**Attendance Entry Schema** (existing):
```sql
school_attendance_entry:
  register_id, student_id, policy_id, status, leave_application_id, comp_off_id
```

**Attendance Policy** (existing) must have leave policies:
```sql
school_attendance_policy:
  id, name, category -- 'present', 'absent', 'leave', 'comp_off', 'od', 'late'
```

### Data Flow: Attendance → Payroll (Paid Days Calculation)

Payroll reads from Attendance at compute time:

```sql
-- For each staff in payroll run period:
SELECT 
  COUNT(*) FILTER (WHERE policy.category = 'present') AS present_days,
  COUNT(*) FILTER (WHERE policy.category = 'leave' AND leave_type.is_paid = true) AS paid_leave_days,
  COUNT(*) FILTER (WHERE policy.category = 'leave' AND leave_type.is_paid = false) AS unpaid_leave_days,
  COUNT(*) FILTER (WHERE policy.category = 'comp_off') AS comp_off_days,
  COUNT(*) FILTER (WHERE policy.category = 'absent' AND NOT EXISTS (leave_application)) AS unapproved_absent_days,
  COUNT(*) FILTER (WHERE policy.category = 'late') AS late_days
FROM school_attendance_entry e
JOIN school_attendance_register r ON r.id = e.register_id
JOIN school_attendance_policy p ON p.id = e.policy_id
LEFT JOIN school_leave_application la ON la.id = e.leave_application_id
LEFT JOIN school_leave_type lt ON lt.id = la.leave_type_id
WHERE r.app_id = $1 
  AND r.register_date BETWEEN $period_start AND $period_end
  AND e.staff_id = $staff_id
  AND r.status IN ('submitted', 'finalized')
```

### Payroll Uses Attendance For:

| Payroll Component | Attendance Source |
|-------------------|-------------------|
| Paid days | Present + Paid leave + Comp-off |
| Loss of pay (LOP) | Unpaid leave + Unapproved absent + Late marks (per policy) |
| Overtime allowance | `policy.category = 'overtime'` entries |
| Extra period allowance | `policy.category = 'extra_period'` entries (from Timetable) |
| Substitution allowance | Substitution count from Timetable |

### Late Marks Policy (configurable in HR Settings)
```json
{
  "late_marks_as_half_day": 3,
  "late_grace_minutes": 10,
  "unapproved_absence_is_lop": true
}
```
- 3 late marks = 0.5 LOP day
- Configurable per school

### API Contract

**Payroll reads from Attendance:**
```
GET /api/school/attendance/payroll-summary?period_start=2026-11-01&period_end=2026-11-30
→ Returns per-staff: present_days, paid_leave_days, unpaid_leave_days, unapproved_absent_days, late_days, overtime_hours, extra_periods
```

**Attendance exposes for Payroll:**
```
GET /api/school/attendance/staff/:staffId/month-summary?year=2026&month=11
```

---

## 3. Fees & Accounts Integration

### Data Flow: Payroll → Accounts (Voucher Posting)

When payroll run is **locked** and **posted to accounts**:

| Event | Debit | Credit | Narration |
|-------|-------|--------|-----------|
| Salary expense | Salary expense accounts (per component) | Salary payable | "Salary for Nov 2026" |
| Employer PF | PF expense | PF payable | "Employer PF Nov 2026" |
| Employer ESI | ESI expense | ESI payable | "Employer ESI Nov 2026" |
| Professional Tax | PT expense | PT payable | "PT Nov 2026" |
| TDS | TDS expense | TDS payable | "TDS Nov 2026" |
| Gratuity provision | Gratuity expense | Gratuity payable | "Gratuity provision Nov 2026" |
| Bonus provision | Bonus expense | Bonus payable | "Bonus provision Nov 2026" |
| Staff advances recovery | Staff advances receivable | Salary payable | "Advance recovery Nov 2026" |

**Voucher Structure:**
- One voucher per payroll run (type: "Payroll")
- Lines: one per component (earnings, deductions, employer contributions)
- Reference: `source_type='payroll_run', source_id=run_id`

### Data Flow: Advance Disbursement → Accounts

When advance is **disbursed**:

| Event | Debit | Credit | Narration |
|-------|-------|--------|-----------|
| Advance disbursed | Staff advances receivable | Bank/Cash | "Salary advance - [Staff]" |

### Data Flow: Statutory Payment → Accounts

When statutory dues are **paid** (PF, ESI, PT, TDS):

| Event | Debit | Credit | Narration |
|-------|-------|--------|-----------|
| PF paid | PF payable | Bank | "PF payment Nov 2026" |
| ESI paid | ESI payable | Bank | "ESI payment Nov 2026" |
| PT paid | PT payable | Bank | "PT payment Nov 2026" |
| TDS paid | TDS payable | Bank | "TDS payment Nov 2026" |

### Chart of Accounts Required (in Fees & Accounts)

| Account Code | Name | Type | Cash/Bank |
|--------------|------|------|-----------|
| 2101 | Salary Payable | Liability | No |
| 2102 | PF Payable - Employee | Liability | No |
| 2103 | PF Payable - Employer | Liability | No |
| 2104 | ESI Payable - Employee | Liability | No |
| 2105 | ESI Payable - Employer | Liability | No |
| 2106 | Professional Tax Payable | Liability | No |
| 2107 | TDS Payable - Salary | Liability | No |
| 2108 | Gratuity Payable | Liability | No |
| 2109 | Bonus Payable | Liability | No |
| 2110 | Staff Advances Receivable | Asset | No |
| 4101 | Salary Expense - Basic | Expense | No |
| 4102 | Salary Expense - Allowances | Expense | No |
| 4103 | PF Expense - Employer | Expense | No |
| 4104 | ESI Expense - Employer | Expense | No |
| 4105 | Professional Tax Expense | Expense | No |
| 4106 | Gratuity Expense | Expense | No |
| 4107 | Bonus Expense | Expense | No |

### API Contract

**Payroll posts to Accounts:**
```
POST /api/school/fee/vouchers
{
  "date": "2026-11-30",
  "narration": "Payroll Nov 2026",
  "status": "posted",
  "source_type": "payroll_run",
  "source_id": 123,
  "lines": [
    { "account_id": 4101, "debit": 500000, "credit": 0, "narration": "Basic Pay" },
    { "account_id": 2101, "debit": 0, "credit": 450000, "narration": "Salary Payable" },
    { "account_id": 2102, "debit": 0, "credit": 30000, "narration": "PF Employee" },
    { "account_id": 4103, "debit": 30000, "credit": 0, "narration": "PF Employer" },
    { "account_id": 2103, "debit": 0, "credit": 30000, "narration": "PF Employer Payable" },
    ...
  ]
}
```

**Response:**
```json
{ "ok": true, "voucher": { "id": 456, "number": "VCH-20261130-0001" } }
```

**Payroll marks run as posted:**
```
POST /api/school/hr/payroll/run/123/post-to-accounts
→ Calls above, then updates run.posted_at, run.posted_by, run.status='posted'
```

### Bank Advice → Payment

```
GET /api/school/hr/payroll/run/123/bank-advice
→ Returns CSV: staff_id, employee_code, name, account_number, ifsc, net_pay

After bank transfer:
POST /api/school/hr/payroll/run/123/mark-paid
{
  "paid_by": "accountant",
  "payment_ref": "NEFT-20261130-001",
  "paid_at": "2026-11-30T14:30:00Z"
}
→ Creates payment voucher in Accounts: Salary Payable → Bank
```

---

## 4. Shared Data Contracts

### Staff Master (HR owns, others read)

| Field | HR | Timetable | Attendance | Payroll |
|-------|----|-----------|------------|---------|
| employee_code | ✅ RW | ✅ R | ✅ R | ✅ R |
| name | ✅ RW | ✅ R | ✅ R | ✅ R |
| designation | ✅ RW | ✅ R | — | ✅ R |
| department | ✅ RW | — | — | ✅ R |
| type (perm/contract/etc.) | ✅ RW | ✅ R | — | ✅ R |
| joining_date | ✅ RW | — | ✅ R | ✅ R |
| exit_date | ✅ RW | ✅ R | ✅ R | ✅ R |
| teachable_subjects | ✅ RW | ✅ R | — | — |
| teachable_classes | ✅ RW | ✅ R | — | — |
| bank_account | ✅ RW | — | — | ✅ R |
| pan, pf, esi | ✅ RW | — | — | ✅ R |

### Leave Application (HR owns, Attendance/Timetable react)

| Field | HR | Attendance | Timetable |
|-------|----|------------|-----------|
| staff_id | ✅ RW | ✅ R | ✅ R |
| leave_type_id | ✅ RW | ✅ R | — |
| from_date, to_date | ✅ RW | ✅ R | ✅ R |
| days | ✅ RW | ✅ R | ✅ R |
| status | ✅ RW | ✅ R (sync) | ✅ R (sync) |
| approved_by/at | ✅ RW | — | — |

### Attendance Entry (Attendance owns, Payroll reads)

| Field | Attendance | Payroll |
|-------|------------|---------|
| register_id | ✅ RW | ✅ R |
| staff_id | ✅ RW | ✅ R |
| policy_id (category) | ✅ RW | ✅ R |
| leave_application_id | ✅ RW (FK) | ✅ R (for LOP calc) |
| comp_off_id | ✅ RW (FK) | ✅ R |

### Payroll Run (HR owns, Accounts receives)

| Field | HR | Accounts |
|-------|----|----------|
| period_start/end | ✅ RW | ✅ R (for voucher date) |
| status | ✅ RW | ✅ R (only post locked) |
| rule_versions | ✅ RW | — |
| total_gross, net, employer | ✅ RW | ✅ R (voucher amounts) |

---

## 5. Integration Test Scenarios

| Scenario | Modules Involved | Test Steps |
|----------|------------------|------------|
| New teacher joins | HR → Timetable | 1. Create staff in HR with teachable subjects<br>2. Verify teacher appears in Timetable allocation |
| Teacher transferred | HR → Timetable | 1. Update employment record in HR<br>2. Verify new department/subjects in Timetable |
| Leave approved | HR → Attendance, Timetable | 1. Approve leave in HR<br>2. Verify attendance entries created<br>3. Verify unavailability in Timetable substitution board |
| Leave cancelled | HR → Attendance, Timetable | 1. Cancel leave in HR<br>2. Verify attendance entries removed<br>3. Verify unavailability removed |
| Payroll compute | HR, Attendance → Payroll | 1. Run payroll compute<br>2. Verify paid days = present + paid leave<br>3. Verify LOP = unpaid leave + unapproved absent + late marks |
| Overtime in payroll | Attendance → Payroll | 1. Mark overtime in Attendance<br>2. Run payroll<br>3. Verify overtime component calculated |
| Extra period in payroll | Timetable → Payroll | 1. Assign extra periods in Timetable<br>2. Run payroll<br>3. Verify extra period allowance |
| Payroll post | HR → Accounts | 1. Lock payroll run<br>2. Post to Accounts<br>3. Verify balanced voucher created |
| Advance disbursed | HR → Accounts | 1. Disburse advance<br>2. Verify voucher: Advances Receivable → Bank |
| Statutory paid | HR → Accounts | 1. Mark PF paid<br>2. Verify voucher: PF Payable → Bank |
| Salary paid | HR → Accounts | 1. Mark run paid<br>2. Verify voucher: Salary Payable → Bank |

---

## 6. Event-Driven Architecture (Future)

For real-time sync, consider event bus:

| Event | Publisher | Subscribers |
|-------|-----------|-------------|
| `staff.created` | HR | Timetable, Attendance |
| `staff.employment.updated` | HR | Timetable, Payroll |
| `staff.exited` | HR | Timetable, Attendance, Payroll |
| `leave.approved` | HR | Attendance, Timetable |
| `leave.cancelled` | HR | Attendance, Timetable |
| `payroll.locked` | Payroll | Accounts (async) |
| `advance.disbursed` | Advances | Accounts |
| `statutory.paid` | Payroll | Accounts |

Implementation: PostgreSQL `NOTIFY/LISTEN` or Redis pub/sub.

---

## 7. Migration Checklist (Existing Data)

| Data | Source Module | Target Table | Validation |
|------|---------------|--------------|------------|
| Staff master | Existing HR | `school_staff` | Unique employee_code |
| Employment history | Existing HR | `school_staff_employment` | No gaps in effective dates |
| Qualifications | Existing HR | `school_staff_qualification` | Subject IDs match `school_subjects` |
| Documents | Existing HR | `school_staff_document` | File URLs accessible |
| Bank details | Existing Payroll | `school_staff_bank` | IFSC valid |
| Statutory details | Existing Payroll | `school_staff_statutory` | PAN format valid |
| Leave balances | Existing Leave | `school_leave_balance_entry` (source=opening) | Sum = current balance |
| Leave applications | Existing Leave | `school_leave_application` | Status consistent |
| Salary structures | Existing Payroll | `school_salary_structure` + lines | Components exist |
| Staff assignments | Existing Payroll | `school_staff_salary` | Structure IDs valid |
| Statutory rules | Existing Payroll | `school_statutory_rule` | Current version marked |
| Payroll history | Existing Payroll | `school_payroll_run` + payslips | Locked runs immutable |
| Advances/loans | Existing Loan | `school_advance` + schedule | Schedule matches disbursement |
| Chart of accounts | Existing Accounts | `school_account` | Required accounts exist |

---

## 8. Permission Matrix Across Modules

| Action | HR Role | Timetable Role | Attendance Role | Accounts Role |
|--------|---------|----------------|-----------------|---------------|
| View staff | ✅ | ✅ (teachers) | ✅ | ✅ (payroll) |
| Edit staff | ✅ | — | — | — |
| Manage teachable subjects | ✅ | ✅ (read) | — | — |
| Approve leave | ✅ (HOD/Principal) | — | — | — |
| View leave calendar | ✅ | ✅ (substitution) | ✅ | — |
| Mark attendance | — | — | ✅ (teachers) | — |
| View attendance | ✅ (HR) | — | ✅ | ✅ (payroll) |
| Run payroll | ✅ (HR/Accounts) | — | — | ✅ (approve) |
| Post vouchers | — | — | — | ✅ |
| Pay salary | — | — | — | ✅ |
| Pay statutory | — | — | — | ✅ |