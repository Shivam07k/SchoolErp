# Library Module — Integration Points

---

## 1. Student master

| Source | Use |
|---|---|
| `school_students.id` | Library member identity via `school_library_member.person_id` |
| `admission_no`, `first_name`, `last_name` | Member code generation and search |
| `class_id`, `section_id` | Category eligibility, reports |
| `guardian_phone`, `guardian_email` | Overdue and reservation notifications |
| `status` | Only `active` students can be issued; member status synced to `active/inactive` |
| `deleted_at` | Deleted students cannot be issued; member auto-inactivated |

Data flow
- On enrollment/activation: HR/Admission creates `school_library_member` with `member_type='student'`, `person_id = school_students.id`, category assigned by class.
- On status change, exit or TC: member status set to `inactive`/`blocked` and new issues prevented.
- No student columns are modified by Library. `school_library_member` is the source of truth for library eligibility.

Tables involved
- `school_students`
- `school_library_member`
- `school_library_member_category`
- `school_library_loan`

Events
- `student.created` → create library member
- `student.status.changed` → sync member status
- `student.exited` → block issues, require clearance

---

## 2. HR staff

| Source | Use |
|---|---|
| `school_staff.id` | Library member identity via `school_library_member.person_id` |
| `employee_code`, `first_name`, `last_name` | Member code and search |
| `designation`, `department` | Staff member category selection |
| `status` | Active staff only allowed to issue; member synced |
| `email`, `phone` | Notifications |

Data flow
- On joining: create `school_library_member` with `member_type='staff'`.
- On exit/termination: member set to `inactive`, pending loans flagged for return.
- Warden/librarian actions reference `school_staff.id` in `school_library_loan.issued_by/returned_by`.

Tables involved
- `school_staff`
- `school_library_member`
- `school_library_member_category`
- `school_library_loan`

Events
- `staff.created` → create library member
- `staff.status.changed` → sync member status
- `staff.exited` → block new issues, clearance check

---

## 3. Fees & Accounts

**Tables reused**
- `school_fee_head` with type `library_fine`, `library_lost`, `library_damage`
- `school_invoice`, `school_invoice_line`
- `school_receipt`, `school_receipt_allocation`
- `school_ledger`, `school_ledger_entries`
- `school_library_fine`, `school_library_fine_payment`
- `school_library_loan`

**Behaviour**
- Overdue fines calculated on return are stored in `school_library_fine`.
- On first return with overdue, fine is posted to Fees by creating a `school_invoice` with fee head `Library Fine`. `school_library_fine.posted_to_fees = true`, `fee_invoice_id` filled.
- Lost/damaged replacement cost is raised as a separate invoice line `Library Lost/Damage`.
- Fine waiver updates `school_library_fine.waived_amount` and creates a credit note/adjustment invoice line with audit.
- Payments collected via existing Fees collection screens update `school_receipt` and allocate to `school_library_fine` via `fine_payment` table.
- Transfer certificate exit is blocked if unpaid library fines exist.

**Accounting entries**

Fine posting on return
| Event | Debit | Credit | Narration |
|---|---|---|---|
| Fine income recognition | Student Fees Receivable / Library Fine Receivable | Library Fine Income | Fine for loan L-XXXX overdue |
| Fine payment collected | Bank / Cash | Student Fees Receivable / Library Fine Receivable | Fine receipt R-XXXX |

Fine waiver
| Event | Debit | Credit | Narration |
|---|---|---|---|
| Waiver reversal | Library Fine Income | Student Fees Receivable / Library Fine Receivable | Fine waived for loan L-XXXX by [approver] |

Lost / Damaged replacement
| Event | Debit | Credit | Narration |
|---|---|---|---|
| Replacement charge | Student Fees Receivable | Library Lost/Damage Income | Lost book title XXX |
| Payment collected | Bank / Cash | Student Fees Receivable | Replacement receipt |

Idempotency: fine posting is one-time per `school_library_fine.id`. Re-returns do not duplicate invoices.

Events
- `library.return.overdue` → create fine + post invoice
- `library.fine.waived` → reversal entry + audit
- `library.lost.reported` → raise replacement invoice
- `fees.receipt.posted` → update `school_library_fine_payment`

---

## 4. Inventory & Assets

**Tables involved**
- `school_library_purchase_entry`
- `school_library_copy`
- `school_library_title`
- `school_inv_asset` optional
- `school_inv_stock_movement` optional

Data flow
- Acquisition workflow creates `school_library_purchase_entry` with supplier, PO, qty, unit_cost.
- On receipt, `school_library_copy` rows are created linked to `purchase_entry_id` and `title_id`.
- Optional posting to Inventory & Assets: books can be recorded as assets category `Library Books` with `school_inv_asset.book_id` referencing `school_library_title.id` and quantity = number of copies.
- Damage/loss found during stock verification updates `school_library_copy.status` and can trigger write-off in Inventory.
- Asset write-off stays in Inventory module; Library retains circulation history.

**Accounting entries for purchases**
| Event | Debit | Credit | Narration |
|---|---|---|---|
| Book purchase accrual | Library Assets / Books Inventory | Accounts Payable / Supplier | PO-XXXX receipt |
| Payment to supplier | Accounts Payable / Supplier | Bank / Cash | Payment for PO-XXXX |

Events
- `library.purchase.received` → copies created, inventory posted
- `library.copy.damaged/lost` → asset condition update, potential charge to Fees
- `library.stock.verified` → variance logged in `school_library_stock_verification`

---

## 5. Timetable calendar

| Source | Use |
|---|---|
| `school_calendar_event` type `holiday`, `vacation`, `exam` | Due date and fine calculation adjustments |
| `school_calendar_event.date` | Close library operations, skip reminder jobs |

Data flow
- Holidays and vacations are read from `school_calendar_event` to exclude from fine calculation grace/overdue days.
- Vacations trigger automatic due-date extensions per policy and mess-agnostic library closure flags.
- Future enhancement: library desk hours can be tied to calendar events.
- Library never writes to calendar; read-only consumption.

Tables involved
- `school_calendar_event`
- `school_library_setting` for `holiday_excludes_fine`
- `school_library_loan`

Events
- `calendar.holiday.published` → fine engine excludes date
- `calendar.vacation.started` → suspend due reminders

---

## 6. Transfer certificate

| Source | Use |
|---|---|
| `school_student_transfer_certificate` / exit request | Clearance check |
| `school_students.status` | Exit workflow trigger |

Data flow
- On TC request initiation, Front Office queries Library for pending items:
  - Active loans: `school_library_loan.status='issued'` for member
  - Unpaid fines: `school_library_fine.posted_to_fees=true` and no full payment
- If any pending, TC is blocked with error list.
- On clearance, Library updates member status and logs audit.
- On successful TC, Library marks member `inactive` and closes future issues.

Tables involved
- `school_library_member`
- `school_library_loan`
- `school_library_fine`
- `school_library_fine_payment`
- Front Office TC tables

Events
- `tc.request.created` → library clearance check
- `tc.approved` → deactivate member, archive loans
- `library.clearance.granted` → TC can proceed

---

## 7. Notifications

**Tables involved**
- `school_library_notification`
- `school_notification` / Automation Rule Engine

Data flow
- Issue, return, due reminder, overdue, reservation fulfillment, fine posted, waiver approved generate rows in `school_library_notification`.
- Delivery uses existing communication infrastructure: WhatsApp/Email/Push via Automation Rule 5.
- Member contact sourced from Student master / HR staff.

Events
- `library.issue.created` → issue slip sent
- `library.due.reminder` → 2 days before due
- `library.overdue` → daily batch on overdue
- `library.reservation.fulfilled` → copy available alert
- `library.fine.posted` → fine invoice notification
- `library.fine.waived` → waiver confirmation

No external gateway changes required for Phase 1.

---

## 8. Audit

- Every sensitive action calls `writeAudit(pool, req, { action, entity, entityId, before, after })`.
- Audited actions: member create/update, category change, issue/return/renew, reservation, fine create/waive/post, lost/damaged, purchase receipt, copy status change, clearance.
- `school_library_audit` retains immutable history with tenant scope.

---
