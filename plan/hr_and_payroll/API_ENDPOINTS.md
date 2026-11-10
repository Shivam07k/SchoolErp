# HR and Payroll Module — API Endpoints

**Version 1.0** · Based on DESIGN.md and BUILD_PLAN.md · 2 November 2026

---

## Base Path

All endpoints mounted at `/api/school/hr/*`

Router files:
- `school_hr_staff.js` — Staff Directory
- `school_hr_leave.js` — Leave Management
- `school_hr_payroll_setup.js` — Payroll Setup
- `school_hr_payroll_run.js` — Payroll Run
- `school_hr_advances.js` — Advances
- `school_hr_reports.js` — Reports
- `school_hr_settings.js` — Settings & Notifications

---

## 1. Staff Directory (`/api/school/hr/staff`)

| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/staff` | List staff with filters | `hr.view` |
| POST | `/staff` | Create staff + initial employment | `hr.manage` |
| GET | `/staff/:id` | Get full profile (all tabs) | `hr.view` / `hr.payroll_view` |
| PUT | `/staff/:id` | Update personal details | `hr.manage` |
| DELETE | `/staff/:id` | Soft delete (exit) | `hr.manage` |
| GET | `/staff/:id/employment` | Employment history | `hr.view` |
| POST | `/staff/:id/employment` | Add employment record | `hr.manage` |
| PUT | `/staff/:id/employment/:empId` | Update employment | `hr.manage` |
| GET | `/staff/:id/qualifications` | Qualifications & subjects | `hr.view` |
| POST | `/staff/:id/qualifications` | Add qualification | `hr.manage` |
| PUT | `/staff/:id/qualifications/:qId` | Update qualification | `hr.manage` |
| DELETE | `/staff/:id/qualifications/:qId` | Delete qualification | `hr.manage` |
| GET | `/staff/:id/documents` | Documents with expiry | `hr.view` |
| POST | `/staff/:id/documents` | Upload document | `hr.manage` |
| PUT | `/staff/:id/documents/:dId` | Update document | `hr.manage` |
| DELETE | `/staff/:id/documents/:dId` | Delete document | `hr.manage` |
| GET | `/staff/:id/bank` | Bank details | `hr.payroll_view` |
| PUT | `/staff/:id/bank` | Update bank details | `hr.manage` |
| GET | `/staff/:id/statutory` | PAN, PF, ESI, PT | `hr.payroll_view` |
| PUT | `/staff/:id/statutory` | Update statutory | `hr.manage` |
| GET | `/staff/:id/nominees` | Nominees | `hr.view` |
| POST | `/staff/:id/nominees` | Add nominee | `hr.manage` |
| GET | `/staff/:id/emergency` | Emergency contacts | `hr.view` |
| POST | `/staff/:id/emergency` | Add emergency contact | `hr.manage` |
| POST | `/staff/import` | Excel import (validate + save) | `hr.manage` |
| POST | `/staff/check-duplicates` | Pre-import duplicate check | `hr.manage` |
| GET | `/staff/export` | Export to Excel/CSV | `hr.view` |

### Query Parameters (List)
- `department`, `designation`, `type`, `status` — filters
- `q` — search (name, code, phone, email)
- `page`, `limit` — pagination
- `sort`, `order` — sorting

---

## 2. Leave Management (`/api/school/hr/leave`)

### Leave Types & Policies
| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/types` | List leave types | `hr.leave_view` |
| POST | `/types` | Create leave type | `hr.leave_manage` |
| PUT | `/types/:id` | Update leave type | `hr.leave_manage` |
| DELETE | `/types/:id` | Delete leave type | `hr.leave_manage` |
| GET | `/policies` | List leave policies | `hr.leave_view` |
| POST | `/policies` | Create policy | `hr.leave_manage` |
| PUT | `/policies/:id` | Update policy | `hr.leave_manage` |

### Balances & Accrual
| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/balances` | Current balances (staff × type) | `hr.leave_view` |
| GET | `/balances/:staffId` | Single staff balances | `hr.leave_view` / `staff.leave_self` |
| POST | `/accrual/run` | Run monthly accrual job | `hr.leave_manage` |
| POST | `/carry-forward` | Year-end carry forward | `hr.leave_manage` |
| POST | `/encashment` | Year-end encashment | `hr.leave_manage` |
| GET | `/balance-ledger/:staffId` | Ledger entries for staff | `hr.leave_view` |

### Applications
| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/applications` | List applications (with filters) | `hr.leave_view` / `hr.leave_approve` |
| POST | `/applications` | Create application | `staff.leave_self` / `hr.leave_manage` |
| GET | `/applications/:id` | Get application detail | `hr.leave_view` |
| PUT | `/applications/:id` | Update (cancel/modify) | `staff.leave_self` / `hr.leave_manage` |
| POST | `/applications/:id/approve` | Approve (with chain) | `hr.leave_approve` |
| POST | `/applications/:id/reject` | Reject with reason | `hr.leave_approve` |
| POST | `/applications/:id/cancel` | Cancel approved leave | `staff.leave_self` / `hr.leave_manage` |

### Calendar & Comp-Off
| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/calendar` | Team calendar (who's out) | `hr.leave_view` |
| GET | `/calendar/:staffId` | Single staff calendar | `staff.leave_self` |
| GET | `/comp-off` | List comp-off | `hr.leave_view` |
| POST | `/comp-off` | Create comp-off | `hr.leave_manage` |
| PUT | `/comp-off/:id` | Update comp-off | `hr.leave_manage` |
| GET | `/holidays` | Holiday calendar | `hr.leave_view` |
| POST | `/holidays` | Add holiday | `hr.leave_manage` |
| PUT | `/holidays/:id` | Update holiday | `hr.leave_manage` |
| DELETE | `/holidays/:id` | Delete holiday | `hr.leave_manage` |

### Filters (Applications)
- `staff_id`, `leave_type_id`, `status`, `from_date`, `to_date`
- `approver_id` — for approver inbox

---

## 3. Payroll Setup (`/api/school/hr/payroll/setup`)

### Salary Components
| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/components` | List components | `hr.payroll_setup` |
| POST | `/components` | Create component | `hr.payroll_setup` |
| GET | `/components/:id` | Get component | `hr.payroll_setup` |
| PUT | `/components/:id` | Update component | `hr.payroll_setup` |
| DELETE | `/components/:id` | Delete component | `hr.payroll_setup` |

### Salary Structures
| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/structures` | List structures | `hr.payroll_setup` |
| POST | `/structures` | Create structure | `hr.payroll_setup` |
| GET | `/structures/:id` | Get structure with lines | `hr.payroll_setup` |
| PUT | `/structures/:id` | Update structure | `hr.payroll_setup` |
| DELETE | `/structures/:id` | Delete structure | `hr.payroll_setup` |
| POST | `/structures/:id/clone` | Clone structure | `hr.payroll_setup` |
| GET | `/structures/:id/lines` | Structure lines | `hr.payroll_setup` |
| POST | `/structures/:id/lines` | Add line | `hr.payroll_setup` |
| PUT | `/structures/:id/lines/:lineId` | Update line | `hr.payroll_setup` |
| DELETE | `/structures/:id/lines/:lineId` | Delete line | `hr.payroll_setup` |

### Staff Assignments
| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/assignments` | List assignments | `hr.payroll_assign` |
| POST | `/assignments` | Assign structure to staff | `hr.payroll_assign` |
| GET | `/assignments/:id` | Get assignment | `hr.payroll_assign` |
| PUT | `/assignments/:id` | Update assignment | `hr.payroll_assign` |
| DELETE | `/assignments/:id` | Delete assignment | `hr.payroll_assign` |
| POST | `/validate-structure` | Wage-base validation | `hr.payroll_assign` |

### Statutory Rules
| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/statutory` | List all rules | `hr.payroll_setup` |
| GET | `/statutory/:ruleCode` | Get rule (PF, ESI, PT, TDS, GRATUITY, BONUS) | `hr.payroll_setup` |
| POST | `/statutory` | Create rule version | `hr.payroll_setup` |
| PUT | `/statutory/:id` | Update rule | `hr.payroll_setup` |
| GET | `/statutory/:ruleCode/slabs` | Get slabs (PT, TDS) | `hr.payroll_setup` |
| POST | `/statutory/:ruleCode/slabs` | Add slab | `hr.payroll_setup` |
| PUT | `/statutory/:ruleCode/slabs/:slabId` | Update slab | `hr.payroll_setup` |
| DELETE | `/statutory/:ruleCode/slabs/:slabId` | Delete slab | `hr.payroll_setup` |

---

## 4. Payroll Run (`/api/school/hr/payroll/run`)

### Run Lifecycle
| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/runs` | List runs | `hr.payroll_prepare` |
| POST | `/runs` | Create draft run | `hr.payroll_prepare` |
| GET | `/runs/:id` | Run detail with payslips | `hr.payroll_prepare` |
| GET | `/runs/:id/checks` | Checks panel data | `hr.payroll_prepare` |
| POST | `/runs/:id/compute` | Compute run (idempotent) | `hr.payroll_prepare` |
| GET | `/runs/:id/preview` | Preview with variance | `hr.payroll_prepare` |
| POST | `/runs/:id/adjustments` | Add adjustment | `hr.payroll_prepare` |
| PUT | `/runs/:id/adjustments/:adjId` | Update adjustment | `hr.payroll_prepare` |
| DELETE | `/runs/:id/adjustments/:adjId` | Delete adjustment | `hr.payroll_prepare` |
| POST | `/runs/:id/approve` | Approve (maker/checker) | `hr.payroll_approve` |
| POST | `/runs/:id/lock` | Lock run | `hr.payroll_lock` |
| POST | `/runs/:id/unlock` | Unlock (super admin) | `hr.payroll_unlock` |
| POST | `/runs/:id/mark-paid` | Mark paid | `hr.payroll_post` |
| POST | `/runs/:id/post-to-accounts` | Post vouchers to Accounts | `hr.payroll_post` |
| POST | `/runs/:id/cancel` | Cancel draft run | `hr.payroll_prepare` |

### Payslips
| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/runs/:id/payslips` | All payslips for run | `hr.payroll_payslip` |
| GET | `/runs/:id/payslips/:staffId` | Single payslip | `hr.payroll_payslip` |
| POST | `/runs/:id/payslips/generate` | Generate PDFs | `hr.payroll_payslip` |
| GET | `/runs/:id/payslips/:staffId/pdf` | Download PDF | `hr.payroll_payslip` |
| POST | `/runs/:id/payslips/email` | Email payslips | `hr.payroll_payslip` |
| POST | `/runs/:id/payslips/whatsapp` | WhatsApp payslips | `hr.payroll_payslip` |

### Bank Advice & Reports
| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/runs/:id/bank-advice` | Bank advice file (CSV/Excel) | `hr.payroll_post` |
| GET | `/runs/:id/salary-register` | Salary register | `hr.reports` |
| GET | `/runs/:id/salary-abstract` | Salary abstract | `hr.reports` |
| GET | `/runs/:id/statutory-reports` | PF/ESI/PT/TDS reports | `hr.statutory_reports` |

### Tax Declarations
| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/tax-declarations` | List declarations | `hr.payroll_prepare` |
| POST | `/tax-declarations` | Create/update declaration | `staff.tax_self` / `hr.payroll_prepare` |
| GET | `/tax-declarations/:staffId` | Get declaration | `staff.tax_self` / `hr.payroll_prepare` |
| POST | `/tax-declarations/:staffId/submit` | Submit for verification | `staff.tax_self` |
| POST | `/tax-declarations/:staffId/verify` | Verify declaration | `hr.payroll_prepare` |

---

## 5. Advances (`/api/school/hr/advances`)

| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/advances` | List advances | `hr.advance_manage` |
| POST | `/advances` | Request advance | `hr.advance_request` |
| GET | `/advances/:id` | Advance detail | `hr.advance_manage` |
| PUT | `/advances/:id` | Update advance | `hr.advance_manage` |
| POST | `/advances/:id/approve` | Approve advance | `hr.advance_approve` |
| POST | `/advances/:id/reject` | Reject advance | `hr.advance_approve` |
| POST | `/advances/:id/disburse` | Disburse advance | `hr.advance_manage` |
| GET | `/advances/:id/schedule` | Repayment schedule | `hr.advance_manage` |
| POST | `/advances/:id/prepay` | Early closure/prepayment | `hr.advance_manage` |
| POST | `/advances/:id/writeoff` | Write-off | `hr.advance_manage` |
| GET | `/dashboard` | Outstanding dashboard | `hr.advance_manage` |

### Advance Filters
- `staff_id`, `type`, `status`, `from_date`, `to_date`

---

## 6. Reports (`/api/school/hr/reports`)

| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/staff-strength` | Staff strength by dept/type/designation | `hr.reports` |
| GET | `/attrition` | Joining/exit/attrition | `hr.reports` |
| GET | `/directory` | Directory export | `hr.reports` |
| GET | `/doc-expiry` | Document/probation/contract expiry | `hr.reports` |
| GET | `/leave-balances` | Leave balances | `hr.reports` |
| GET | `/leave-taken` | Leave taken | `hr.reports` |
| GET | `/absence-patterns` | Absence/late patterns | `hr.reports` |
| GET | `/salary-register` | Salary register | `hr.reports` |
| GET | `/salary-abstract` | Salary abstract | `hr.reports` |
| GET | `/dept-cost` | Department-wise salary cost | `hr.reports` |
| GET | `/month-variance` | Month-on-month variance | `hr.reports` |
| GET | `/arrears` | Arrears report | `hr.reports` |
| GET | `/advances-outstanding` | Advances outstanding | `hr.reports` |
| GET | `/statutory-registers` | PF/ESI/PT/TDS registers | `hr.statutory_reports` |
| GET | `/form16` | Form 16 data | `hr.form16` |
| GET | `/gratuity-liability` | Gratuity liability | `hr.reports` |
| GET | `/overtime` | Overtime/extra periods | `hr.reports` |
| GET | `/substitution-impact` | Substitution impact | `hr.reports` |
| GET | `/salary-audit` | Salary change audit | `hr.audit` |
| GET | `/unlock-audit` | Payroll unlock audit | `hr.audit` |

### Common Query Parameters
- `from_date`, `to_date` — period
- `department_id`, `designation`, `staff_type` — filters
- `format` — `json`, `csv`, `excel`
- `page`, `limit` — pagination

---

## 7. Settings & Notifications (`/api/school/hr/settings`)

| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/settings` | All HR settings | `hr.manage` |
| PUT | `/settings/:key` | Update setting | `hr.manage` |
| GET | `/notifications` | List notifications | `hr.view` |
| POST | `/notifications/:id/read` | Mark as read | `hr.view` |

---

## 8. Staff Self-Service (`/api/school/hr/self`)

| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/profile` | Own profile | `staff.self` |
| POST | `/profile/change-request` | Request profile change | `staff.self` |
| GET | `/leave/balance` | Own leave balance | `staff.leave_self` |
| POST | `/leave/apply` | Apply leave | `staff.leave_self` |
| GET | `/leave/history` | Own leave history | `staff.leave_self` |
| GET | `/payslips` | Own payslips | `staff.payslip_self` |
| GET | `/payslips/:id/pdf` | Download own payslip | `staff.payslip_self` |
| GET | `/tax/declaration` | Own tax declaration | `staff.tax_self` |
| POST | `/tax/declaration` | Submit tax declaration | `staff.tax_self` |
| GET | `/advances` | Own advances | `staff.advance_self` |
| POST | `/advances` | Request advance | `staff.advance_self` |
| GET | `/documents` | Own documents | `staff.self` |
| POST | `/documents` | Upload document | `staff.self` |

---

## Permission Summary

| Permission | Description |
|------------|-------------|
| `hr.view` | View staff list, profiles (no pay) |
| `hr.manage` | Full staff management |
| `hr.payroll_view` | View pay tab in profile |
| `hr.payroll_setup` | Manage components, structures, statutory |
| `hr.payroll_assign` | Assign structures to staff |
| `hr.payroll_prepare` | Create run, compute, preview, adjustments |
| `hr.payroll_approve` | Approve payroll run |
| `hr.payroll_lock` | Lock payroll run |
| `hr.payroll_unlock` | Unlock payroll run (super admin) |
| `hr.payroll_post` | Post to accounts, mark paid, bank advice |
| `hr.payroll_payslip` | View/generate payslips |
| `hr.leave_view` | View leave balances, calendar |
| `hr.leave_manage` | Manage types, policies, accrual |
| `hr.leave_approve` | Approve/reject leave |
| `hr.advance_request` | Request advance |
| `hr.advance_approve` | Approve/reject advance |
| `hr.advance_manage` | Disburse, schedule, write-off |
| `hr.reports` | View HR reports |
| `hr.statutory_reports` | View statutory reports |
| `hr.form16` | Generate Form 16 |
| `hr.audit` | View audit reports |
| `hr.year_end` | Run year-end jobs |
| `staff.self` | View own profile, documents |
| `staff.leave_self` | Apply/view own leave |
| `staff.payslip_self` | View/download own payslips |
| `staff.tax_self` | Submit/view tax declaration |
| `staff.advance_self` | Request/view own advances |

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "ok": false,
  "error": "Human-readable message",
  "code": "ERROR_CODE",          // optional
  "details": {}                  // optional, field-level errors
}
```

Common HTTP status codes:
- `200` — Success
- `201` — Created
- `400` — Validation error
- `401` — Unauthorized
- `403` — Forbidden (permission)
- `404` — Not found
- `409` — Conflict (duplicate, overlapping leave, etc.)
- `422` — Business rule violation (negative net pay, locked run, etc.)
- `500` — Server error

---

## Idempotency

- `POST /runs/:id/compute` — idempotent (re-running produces same result)
- `POST /accrual/run` — idempotent per month
- `POST /carry-forward` — idempotent per year
- Import endpoints validate first, save only if all rows clean