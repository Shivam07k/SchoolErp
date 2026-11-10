# HR and Payroll Module â€” Test Scenarios

**Version 1.0** Â· Based on DESIGN.md Section 11 Â· 2 November 2026

---

## Test Organization

| Category | File | Scenarios |
|----------|------|-----------|
| Staff Directory | `test_staff_directory.md` | 18 |
| Leave Management | `test_leave_management.md` | 25 |
| Payroll | `test_payroll.md` | 28 |
| Advances | `test_advances.md` | 13 |
| Reports/Compliance | `test_reports_compliance.md` | 8 |
| **Total** | | **92** |

---

## 1. Staff Directory & Lifecycle (18 scenarios)

| ID | Scenario | Steps | Expected Result |
|----|----------|-------|-----------------|
| SD-01 | New joining mid-month | 1. Create staff with joining date 15th<br>2. Assign salary structure effective 15th<br>3. Run payroll for month | Pay prorated for 16 days (15th-30th) |
| SD-02 | Documents missing/expiring | 1. Upload document with expiry 30 days out<br>2. Run expiry report | Alert shows in 30/15/7 day buckets |
| SD-03 | Contract teacher | 1. Create staff type=contract<br>2. Assign per-period structure<br>3. Create timetable periods<br>4. Run payroll | Pay = periods taught Ã— rate |
| SD-04 | Probation confirmation | 1. Set probation end date<br>2. Run daily alert job | Alert fires 7 days before |
| SD-05 | Transfer + promotion | 1. Add employment record: new dept, designation, effective date<br>2. Verify history | Old record effective_to = day before new effective_from |
| SD-06 | Subject change | 1. Update teachable_subjects in qualifications<br>2. Open Timetable allocation | New subjects available for allocation |
| SD-07 | Salary revision with arrears | 1. Assign new structure effective 1st of previous month<br>2. Run payroll for current month | Arrears adjustment created for previous month |
| SD-08 | Resignation with notice | 1. Add employment record: exit_date, reason=resignation<br>2. Run exit settlement | Settlement includes notice period pay |
| SD-09 | Termination | 1. Add employment record: exit_date, reason=termination<br>2. Run settlement | Settlement per policy (no notice pay) |
| SD-10 | Final settlement | 1. Exit staff with pending salary, leave balance, advance<br>2. Generate settlement | Total = salary + leave encashment + gratuity - advance |
| SD-11 | Re-joining | 1. Exit staff<br>2. Add new employment record on same staff_id<br>3. Verify history | Both employment records visible, new joining_date |
| SD-12 | Duplicate employee code | 1. Try create staff with existing code | Blocked with "Employee code exists" |
| SD-13 | Staff change request | 1. Staff submits address change<br>2. HR approves<br>3. Verify audit | Change recorded with before/after, approved_by |
| SD-14 | Bank detail change | 1. Update bank account<br>2. Run payroll<br>3. Verify bank advice | New account in bank advice |
| SD-15 | Excel import valid | 1. Import 50 staff with all fields<br>2. Verify all created | 50 staff, 50 employment records |
| SD-16 | Excel import invalid | 1. Import with duplicate code, missing required<br>2. Verify row errors | Row-wise errors shown, no partial save |
| SD-17 | Soft delete | 1. Delete staff<br>2. Query with deleted_at IS NULL | Staff not in list, history preserved |
| SD-18 | Timetable reads staff | 1. Create staff with teachable subjects<br>2. Open Timetable allocation | Staff appears with correct subjects |

---

## 2. Leave Management (25 scenarios)

| ID | Scenario | Steps | Expected Result |
|----|----------|-------|-----------------|
| LM-01 | Full-day leave | 1. Apply CL for 1 day<br>2. Approve | Status=approved, balance -1 |
| LM-02 | Half-day leave | 1. Apply SL half-day forenoon<br>2. Approve | Status=approved, balance -0.5 |
| LM-03 | Insufficient balance | 1. Apply leave > balance<br>2. Approve (policy allows LOP) | Status=approved, balance negative, LOP marked |
| LM-04 | Overlapping applications | 1. Apply CL 1-3<br>2. Apply SL 2-4 | Second blocked: "Overlaps existing leave" |
| LM-05 | Leave touching holiday | 1. Apply leave Fri-Mon (Sat/Sun weekly off)<br>2. Policy: count_weekly_off=false | Days = 2 (Fri, Mon) |
| LM-06 | Leave across month end | 1. Apply leave 28th Mar - 3rd Apr<br>2. Approve | Split: Mar balance -2, Apr balance -3 |
| LM-07 | Back-dated emergency leave | 1. Apply leave for yesterday<br>2. Approver adds note "emergency"<br>3. Approve | Allowed within 3-day window |
| LM-08 | Sick leave certificate | 1. Apply SL 5 days<br>2. Attach medical cert<br>3. Approve | Required after 3 days per policy |
| LM-09 | Maternity leave | 1. Apply ML 180 days<br>2. Approve | Special type, separate balance, auto-extend if needed |
| LM-10 | Cancel approved leave | 1. Approve leave<br>2. Cancel before start date | Attendance entries removed, balance restored |
| LM-11 | Leave during exam duty | 1. Staff has exam duty on leave date<br>2. Apply leave<br>3. Approve with coordinator note | Warning shown, coordinator approval recorded |
| LM-12 | Approver absent | 1. Set delegate approver<br>2. Apply leave<br>3. Delegate approves | Approved by delegate, chain shows delegation |
| LM-13 | Leave rejected | 1. Apply leave<br>2. Reject with reason "exams" | Status=rejected, reason stored, staff notified |
| LM-14 | Year-end carry forward | 1. Run year-end job<br>2. Verify balances | CL carried forward up to max, EL up to max, SL lapsed |
| LM-15 | Year-end encashment | 1. Run encashment job<br>2. Verify ledger | Encashment entries created, balance reduced |
| LM-16 | Joiner accrual pro-rata | 1. Staff joins 15th<br>2. Run monthly accrual | Accrual = half of monthly quota |
| LM-16 | Comp-off earned | 1. Staff works on holiday<br>2. HR creates comp-off | Comp-off available, expires in 60 days |
| LM-17 | Comp-off used | 1. Apply leave using comp-off<br>2. Approve | Comp-off status=used, leave balance unchanged |
| LM-18 | Unapproved absence | 1. No attendance marked for day<br>2. Run payroll | Day counted as LOP |
| LM-19 | Late marks â†’ LOP | 1. Mark 3 lates in month<br>2. Policy: 3 lates = 0.5 LOP<br>3. Run payroll | 0.5 LOP day added |
| LM-20 | Exit with leave balance | 1. Staff exits with EL balance 15<br>2. Policy: encash on exit | Encashment in final settlement |
| LM-21 | Leave approval chain | 1. Apply leave â†’ HOD approves â†’ Principal approves<br>2. Verify chain | Both approvals recorded with timestamps |
| LM-22 | Leave policy per category | 1. Permanent: EL 20, CL 12<br>2. Contract: CL 12 only<br>3. Verify balances | Different quotas applied correctly |
| LM-23 | Half-day session | 1. Apply half-day afternoon<br>2. Verify attendance | Attendance entry: session=afternoon |
| LM-24 | Leave balance ledger | 1. Query ledger for staff<br>2. Sum entries | Sum = current balance |
| LM-25 | Calendar view | 1. Open team calendar<br>2. Verify leaves shown | Color-coded by type, click shows details |

---

## 3. Payroll (28 scenarios)

| ID | Scenario | Steps | Expected Result |
|----|----------|-------|-----------------|
| PR-01 | Joiner mid-month | 1. Staff joins 15th<br>2. Run payroll | Paid days = 16, pay prorated |
| PR-02 | Leaver mid-month | 1. Staff exits 20th<br>2. Run payroll | Paid days = 20, pay prorated |
| PR-03 | Loss of pay | 1. Staff has 2 unpaid leave + 1 unapproved absent<br>2. Run payroll | LOP days = 3, paid days reduced |
| PR-04 | Half-day LOP | 1. 3 late marks â†’ 0.5 LOP<br>2. Run payroll | Paid days = basis - 0.5 |
| PR-05 | Overtime | 1. Attendance: 10 overtime hours<br>2. OT component = rate Ã— hours<br>3. Run payroll | OT amount in earnings |
| PR-06 | Extra periods | 1. Timetable: 5 extra periods<br>2. Extra period component = rate Ã— periods<br>3. Run payroll | Extra period amount in earnings |
| PR-07 | Substitution pay | 1. Substitution count = 8<br>3. Substitution component = rate Ã— count<br>3. Run payroll | Substitution amount in earnings |
| PR-08 | Bonus | 1. Add bonus adjustment<br>2. Run payroll | Bonus in earnings, taxable |
| PR-09 | Reimbursement | 1. Add reimbursement adjustment<br>2. Run payroll | Reimbursement in earnings, non-taxable |
| PR-10 | Arrears (back-dated revision) | 1. New structure effective 2 months ago<br>2. Run payroll | Arrears adjustment for 2 months |
| PR-11 | Salary on hold | 1. Mark payslip hold=true<br>2. Lock run<br>3. Release hold next month | Payable in next run |
| PR-12 | Negative net pay | 1. Deductions > earnings<br>2. Run payroll | Blocked until approved, shortfall carried forward |
| PR-13 | Attendance changed after run | 1. Lock run<br>2. Correct attendance<br>3. Re-run before lock | Updated payslip |
| PR-14 | Attendance changed after lock | 1. Lock run<br>2. Correct attendance<br>3. Create adjustment | Arrears/recovery in next run |
| PR-15 | Wrong salary after payment | 1. Run paid<br>2. Discover error<br>3. Create adjustment | Adjustment in next run with reason |
| PR-16 | Bank payment returned | 1. Mark paid<br>2. Bank returns<br>3. Update account, re-pay | New payment voucher, audit trail |
| PR-17 | PF with current wage base | 1. Set PF rule v3 effective this month<br>2. Run payroll | PF calculated on new base, version=3 recorded |
| PR-18 | ESI eligibility | 1. Staff gross crosses 21,000<br>2. Run payroll | ESI starts/stops automatically |
| PR-19 | PT by state | 1. Staff in MH, KA, TN<br>2. Run payroll | Correct slab per state |
| PR-20 | TDS projection | 1. Staff declares 80C 1.5L<br>2. Run monthly | Monthly TDS = annual tax / 12 |
| PR-21 | TDS regime switch | 1. Staff switches regime mid-year<br>2. Run payroll | New regime from declaration date |
| PR-22 | Form 16 generation | 1. Lock all 12 months<br>2. Generate Form 16 | Form 16 matches annual registers |
| PR-23 | Gratuity provision | 1. Staff eligible (5+ years)<br>2. Run payroll | Monthly provision = liability / remaining years |
| PR-24 | Bonus calculation | 1. Staff eligible, wage â‰¤ 21,000<br>2. Run payroll with bonus | Bonus = 8.33% of wage |
| PR-25 | Wage-base check on assign | 1. Assign structure where basic < 50% total<br>2. Warning shown | "Structure may not meet PF wage base" |
| PR-26 | Payslip dispute | 1. Staff disputes payslip<br>2. HR reviews<br>3. Creates adjustment | Adjustment with reason="dispute" |
| PR-27 | Salary certificate | 1. Generate from locked runs | Certificate shows gross, deductions, net |
| PR-28 | Mid-year migration | 1. Import opening balances: YTD tax, PF, leave<br>2. Run payroll | YTD figures correct in Form 16 |

---

## 4. Advances (13 scenarios)

| ID | Scenario | Steps | Expected Result |
|----|----------|-------|-----------------|
| AD-01 | Salary advance | 1. Request 1 month salary<br>2. Approve, disburse<br>3. Next payroll | Installment recovered in next run |
| AD-02 | Loan with installments | 1. Request loan 12 installments<br>2. Approve, disburse<br>3. Monthly payroll | Each installment recovered monthly |
| AD-03 | Interest-bearing loan | 1. Set interest 10% flat<br>2. Verify schedule | Interest included in each installment |
| AD-04 | Advance above limit | 1. Request > 3 months salary<br>2. Requires Principal approval | Approval chain: HR â†’ Principal |
| AD-05 | Early closure | 1. Prepay remaining balance<br>2. Verify schedule closed | Schedule status=closed, ledger entry type=prepayment |
| AD-06 | Exit with balance | 1. Staff exits with advance balance<br>2. Run final settlement | Balance deducted from settlement |
| AD-07 | Skipped installment | 1. Approve skip for 1 month<br>2. Verify schedule extended | Installment moved to next month |
| AD-08 | Second advance | 1. Request advance while one open<br>2. Warning shown, requires approval | Both advances tracked separately |
| AD-09 | Net pay too low | 1. Net pay < installment<br>2. Policy: part recovery | Partial recovery, balance carried forward |
| AD-10 | Write-off | 1. Advance unrecoverable<br>2. Approve write-off<br>3. Ledger entry | Ledger: type=write_off, advance closed |
| AD-11 | Advance ledger | 1. Query ledger for advance<br>2. Sum entries | Disbursement - Recoveries = Outstanding |
| AD-12 | Installment recovery once | 1. Run payroll twice<br>2. Verify schedule | Each installment recovered exactly once |
| AD-13 | Dashboard | 1. Open advance dashboard<br>2. Verify totals | Outstanding = sum of pending installments |

---

## 5. Reports, Compliance & Data (8 scenarios)

| ID | Scenario | Steps | Expected Result |
|----|----------|-------|-----------------|
| RC-01 | PF return data | 1. Generate PF report<br>2. Verify ECR format | Matches payroll register totals |
| RC-02 | ESI return | 1. Generate ESI report<br>2. Verify format | Eligible staff only, correct wages |
| RC-03 | PT return | 1. Generate PT report<br>2. Verify state format | Correct slab per staff |
| RC-04 | TDS return | 1. Generate Form 24Q<br>2. Verify challans | Monthly deposits match |
| RC-05 | Form 16 | 1. Generate Form 16 for staff<br>2. Verify against locked runs | All 12 months, correct deductions |
| RC-06 | Audit trail | 1. Query salary audit report<br>2. Verify changes | Every pay change: before, after, by, at, reason |
| RC-07 | Data privacy | 1. Login as Teacher<br>2. Try access payslip | Blocked (403), access logged |
| RC-08 | Year-end close | 1. Run leave year-end<br>2. Lock financial year<br>3. Verify no new runs | Leave balances carried forward, no runs allowed |

---

## Automated Test Suite Structure

```
tests/hr_payroll/
â”œâ”€â”€ staff/
â”‚   â”œâ”€â”€ test_staff_crud.py
â”‚   â”œâ”€â”€ test_employment_history.py
â”‚   â”œâ”€â”€ test_import.py
â”‚   â””â”€â”€ test_timetable_integration.py
â”œâ”€â”€ leave/
â”‚   â”œâ”€â”€ test_leave_application.py
â”‚   â”œâ”€â”€ test_leave_approval.py
â”‚   â”œâ”€â”€ test_leave_balance.py
â”‚   â”œâ”€â”€ test_accrual_carryforward.py
â”‚   â””â”€â”€ test_attendance_timetable_sync.py
â”œâ”€â”€ payroll/
â”‚   â”œâ”€â”€ test_payroll_computation.py
â”‚   â”œâ”€â”€ test_statutory_calculation.py
â”‚   â”œâ”€â”€ test_payslip_generation.py
â”‚   â”œâ”€â”€ test_payroll_lifecycle.py
â”‚   â”œâ”€â”€ test_adjustments.py
â”‚   â””â”€â”€ test_accounts_posting.py
â”œâ”€â”€ advances/
â”‚   â”œâ”€â”€ test_advance_lifecycle.py
â”‚   â”œâ”€â”€ test_recovery.py
â”‚   â””â”€â”€ test_exit_settlement.py
â”œâ”€â”€ reports/
â”‚   â”œâ”€â”€ test_statutory_reports.py
â”‚   â”œâ”€â”€ test_audit_trail.py
â”‚   â””â”€â”€ test_data_privacy.py
â””â”€â”€ integration/
    â”œâ”€â”€ test_hr_timetable.py
    â”œâ”€â”€ test_hr_attendance.py
    â””â”€â”€ test_hr_accounts.py
```

### Test Data Fixtures

```python
# conftest.py
@pytest.fixture
def school_app():
    app = create_app()
    with app.app_context():
        yield app

@pytest.fixture
def hr_staff(school_app):
    """Create test staff with employment, qualifications, bank"""
    staff = StaffFactory(
        employee_code="T001",
        name="Test Teacher",
        status="active"
    )
    EmploymentFactory(staff=staff, type="permanent", joining_date=date(2020,6,1))
    BankFactory(staff=staff, account="1234567890", ifsc="SBIN0001234")
    StatutoryFactory(staff=staff, pan="ABCDE1234F", pf_number="MH/BAN/12345")
    return staff

@pytest.fixture
def salary_structure(school_app):
    """Create test salary structure with components"""
    basic = ComponentFactory(code="BASIC", type="earning", calculation="fixed", is_wage_base=True)
    da = ComponentFactory(code="DA", type="earning", calculation="percent", base_component=basic, percent=50)
    hra = ComponentFactory(code="HRA", type="earning", calculation="percent", base_component=basic, percent=40)
    pf = ComponentFactory(code="PF", type="deduction", calculation="formula", formula="min(wage_base, 15000)*0.12")
    structure = StructureFactory(name="Teacher Pay", version=1)
    StructureLineFactory(structure=structure, component=basic, value=25000)
    StructureLineFactory(structure=structure, component=da)
    StructureLineFactory(structure=structure, component=hra)
    StructureLineFactory(structure=structure, component=pf)
    return structure

@pytest.fixture
def payroll_run(school_app, hr_staff, salary_structure):
    """Create computed payroll run"""
    run = PayrollRunFactory(period_start=date(2026,11,1), period_end=date(2026,11,30))
    AssignmentFactory(staff=hr_staff, structure=salary_structure)
    run.compute()
    return run
```

---

## CI/CD Pipeline

```yaml
# .github/workflows/hr-payroll-tests.yml
name: HR Payroll Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:18
        env:
          POSTGRES_DB: school_erp_test
          POSTGRES_USER: xerp
          POSTGRES_PASSWORD: <local-db-password>
        ports: ["5432:5432"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - name: Install deps
        run: |
          npm ci
          pip install -r requirements-test.txt
      - name: Run migrations
        run: cd server && node _schoolsetup.mjs --test
      - name: Backend tests
        run: pytest tests/hr_payroll/ -v --tb=short
      - name: Frontend tests
        run: npm run test:hr-payroll
      - name: Build
        run: npm run build
```

---

## Manual Test Checklist (Pre-Release)

| Area | Test | Pass/Fail |
|------|------|-----------|
| Staff | Create 5 staff types | |
| Staff | Import 100 staff from Excel | |
| Staff | Transfer + promotion history | |
| Staff | Exit + re-join same staff_id | |
| Leave | All leave types + half-day | |
| Leave | Overlap, balance, holiday policies | |
| Leave | Approve â†’ Attendance + Timetable sync | |
| Leave | Cancel â†’ reverse sync | |
| Leave | Year-end carry forward + encashment | |
| Payroll | Joiner/leaver mid-month | |
| Payroll | LOP, late marks, OT, extra periods | |
| Payroll | Arrears from back-dated revision | |
| Payroll | Negative net pay handling | |
| Payroll | Lock â†’ immutable, unlock â†’ super admin | |
| Payroll | Payslip PDF, email, WhatsApp | |
| Payroll | Bank advice CSV matches payslips | |
| Payroll | Post to Accounts â†’ balanced voucher | |
| Payroll | PF/ESI/PT/TDS calculations | |
| Payroll | Form 16 generation | |
| Advances | Advance + loan + interest | |
| Advances | Recovery exactly once per run | |
| Advances | Exit settlement includes advance | |
| Reports | All 22 reports generate + export | |
| Security | Field masking, no self-approval | |
| Integration | Leave â†’ Attendance + Timetable | |
| Integration | Payroll â†’ Accounts | |
| Integration | Attendance â†’ Payroll paid days | |
| Performance | 150 staff payroll < 30s | |