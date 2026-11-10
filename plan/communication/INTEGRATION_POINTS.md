# Communication — Integration Points

---

## 1. Students Master

| Source | Use |
|---|---|
| `school_students.id` | Primary recipient identity |
| `first_name`, `last_name`, `admission_no` | Display, search, template variables |
| `gender` | Gender-specific communications |
| `class_id`, `section_id` | Audience filtering (class/section broadcasts) |
| `phone`, `email` | Primary contact for SMS/email |
| `guardian_name`, `guardian_phone`, `guardian_email` | Parent/guardian contact for communications |
| `status` | Only `active` students receive comms |
| `deleted_at` | Deleted students excluded |
| `hostel_id` | Hostel-specific communications |
| `bus_route_id` | Transport communications |

**Template variables available:** `{{student_name}}`, `{{admission_no}}`, `{{class_name}}`, `{{section_name}}`, `{{guardian_name}}`, `{{guardian_phone}}`, `{{student_phone}}`, `{{student_email}}`.

No student columns are modified. Communication module reads only.

---

## 2. Parents / Guardians

If separate `school_guardian` table exists:

| Source | Use |
|---|---|
| `school_guardian.id` | Recipient identity |
| `student_id` | Link to student |
| `name`, `phone`, `email` | Contact details |
| `relation` | Father/Mother/Guardian — for personalisation |
| `is_primary` | Primary contact preference |
| `receive_sms`, `receive_email`, `receive_push` | Channel opt-in flags |

If embedded in `school_students`, uses guardian fields directly.

**Template variables:** `{{guardian_name}}`, `{{guardian_phone}}`, `{{guardian_email}}`, `{{relation}}`.

---

## 3. Staff Master

| Source | Use |
|---|---|
| `school_staff.id` | Sender identity (`created_by`), recipient for staff comms |
| `first_name`, `last_name`, `employee_id` | Display, search |
| `phone`, `email` | Contact for staff communications |
| `role_id`, `department_id` | Audience filtering (role/dept broadcasts) |
| `status` | Only `active` staff receive comms |
| `deleted_at` | Deleted staff excluded |
| `fcm_token`, `expo_push_token` | Push notification device tokens |

**Template variables:** `{{staff_name}}`, `{{employee_id}}`, `{{department_name}}`, `{{role_name}}`.

---

## 4. Fees & Accounts

**Tables read:**
- `school_fee_head` (type = `fee`, `hostel`, `transport`, `fine`, `discount`)
- `school_invoice`, `school_invoice_line`
- `school_receipt`, `school_receipt_allocation`
- `school_concession_type`, `school_fine_rule`

**Automation triggers emitted by Fees module:**

| Event | Payload | Typical Template |
|---|---|---|
| `fee.invoice_created` | `student_id`, `invoice_id`, `amount`, `due_date`, `fee_heads[]` | Fee invoice notification |
| `fee.due_soon` | `student_id`, `invoice_id`, `amount`, `due_date`, `days_until` | Fee reminder (3/7 days before) |
| `fee.overdue` | `student_id`, `invoice_id`, `amount`, `due_date`, `days_overdue` | Overdue notice |
| `fee.payment_received` | `student_id`, `invoice_id`, `amount`, `receipt_no`, `mode` | Payment receipt |
| `fee.payment_failed` | `student_id`, `invoice_id`, `amount`, `error` | Payment failure alert |
| `fee.concession_approved` | `student_id`, `concession_type`, `amount` | Concession confirmation |
| `fee.fine_applied` | `student_id`, `fine_rule`, `amount` | Fine notification |

**Template variables:** `{{invoice_no}}`, `{{amount}}`, `{{due_date}}`, `{{fee_head_name}}`, `{{receipt_no}}`, `{{payment_mode}}`, `{{balance_due}}`, `{{concession_name}}`, `{{fine_reason}}`.

Fees module calls `communication.emitEvent('fee.due_soon', payload)` — Communication module listens and queues messages per automation rules.

---

## 5. Exam

**Tables read:**
- `school_exam`, `school_exam_subject`, `school_exam_timetable`
- `school_exam_result`, `school_exam_marks`
- `school_grade_scale`

**Automation triggers:**

| Event | Payload | Typical Template |
|---|---|---|
| `exam.timetable_published` | `exam_id`, `exam_name`, `class_id`, `section_id`, `timetable_url` | Exam schedule |
| `exam.timetable_changed` | `exam_id`, `exam_name`, `changes[]`, `effective_date` | Schedule change alert |
| `exam.result_published` | `student_id`, `exam_id`, `exam_name`, `result_url`, `percentage`, `grade` | Result notification |
| `exam.marks_entered` | `student_id`, `exam_id`, `subject_id`, `marks`, `max_marks` | Marks update (optional) |
| `exam.admit_card_ready` | `student_id`, `exam_id`, `admit_card_url` | Admit card |

**Template variables:** `{{exam_name}}`, `{{exam_date}}`, `{{subject_name}}`, `{{marks}}`, `{{max_marks}}`, `{{percentage}}`, `{{grade}}`, `{{rank}}`, `{{timetable_url}}`, `{{result_url}}`, `{{admit_card_url}}`.

---

## 6. Attendance

**Tables read:**
- `school_attendance`, `school_attendance_register`
- `school_leave_application`, `school_leave_type`

**Automation triggers:**

| Event | Payload | Typical Template |
|---|---|---|
| `attendance.absent` | `student_id`, `date`, `period`, `subject`, `teacher_name` | Daily absence alert to parent |
| `attendance.late` | `student_id`, `date`, `period`, `minutes_late` | Late arrival alert |
| `attendance.half_day` | `student_id`, `date`, `reason` | Half-day notification |
| `attendance.leave_applied` | `student_id`, `leave_type`, `from_date`, `to_date`, `reason` | Leave application received |
| `attendance.leave_approved` | `student_id`, `leave_type`, `from_date`, `to_date`, `approved_by` | Leave approved |
| `attendance.leave_rejected` | `student_id`, `leave_type`, `from_date`, `to_date`, `reason` | Leave rejected |
| `attendance.low_percentage` | `student_id`, `percentage`, `threshold`, `period` | Attendance warning |

**Template variables:** `{{date}}`, `{{period}}`, `{{subject_name}}`, `{{teacher_name}}`, `{{leave_type}}`, `{{from_date}}`, `{{to_date}}`, `{{reason}}`, `{{attendance_percentage}}`, `{{threshold}}`.

Attendance module emits events; Communication module does not write attendance.

---

## 7. Timetable

**Tables read:**
- `school_timetable`, `school_timetable_entry`
- `school_subject`, `school_teacher_subject`

**Automation triggers:**

| Event | Payload | Typical Template |
|---|---|---|
| `timetable.published` | `class_id`, `section_id`, `effective_from`, `timetable_url` | New timetable |
| `timetable.changed` | `class_id`, `section_id`, `date`, `changes[]` | Schedule change |
| `timetable.substitution` | `class_id`, `section_id`, `date`, `period`, `original_teacher`, `substitute_teacher`, `subject` | Substitution notice |

**Template variables:** `{{class_name}}`, `{{section_name}}`, `{{effective_date}}`, `{{subject_name}}`, `{{teacher_name}}`, `{{substitute_teacher}}`, `{{period}}`, `{{timetable_url}}`, `{{change_details}}`.

---

## 8. Admission

**Tables read:**
- `school_admission`, `school_admission_form`
- `school_admission_document`, `school_admission_fee`

**Automation triggers:**

| Event | Payload | Typical Template |
|---|---|---|
| `admission.enquiry` | `enquiry_id`, `student_name`, `parent_name`, `phone`, `email`, `class_applied` | Enquiry acknowledgment |
| `admission.form_submitted` | `admission_id`, `admission_no`, `student_name`, `parent_name`, `class_applied` | Form received |
| `admission.document_pending` | `admission_id`, `missing_documents[]` | Document reminder |
| `admission.fee_due` | `admission_id`, `admission_no`, `amount`, `due_date` | Admission fee reminder |
| `admission.approved` | `admission_id`, `admission_no`, `student_name`, `class_allotted`, `section_allotted` | Admission confirmed |
| `admission.rejected` | `admission_id`, `admission_no`, `reason` | Admission regret |
| `admission.waitlisted` | `admission_id`, `admission_no`, `position` | Waitlist notification |

**Template variables:** `{{admission_no}}`, `{{student_name}}`, `{{parent_name}}`, `{{class_applied}}`, `{{class_allotted}}`, `{{section_allotted}}`, `{{amount}}`, `{{due_date}}`, `{{missing_documents}}`, `{{waitlist_position}}`.

---

## 9. Hostel

**Tables read:**
- `school_hostel_application`, `school_hostel_allocation`
- `school_hostel_leave_pass`, `school_hostel_visitor_entry`
- `school_hostel_bill`, `school_hostel_damage`

**Automation triggers:**

| Event | Payload | Typical Template |
|---|---|---|
| `hostel.application_submitted` | `application_id`, `student_id`, `hostel_name` | Application received |
| `hostel.allocation_confirmed` | `allocation_id`, `student_id`, `hostel_name`, `room_no`, `bed_no`, `checkin_date` | Allocation confirmation |
| `hostel.leave_approved` | `leave_pass_id`, `student_id`, `from_date`, `to_date`, `reason` | Leave approved |
| `hostel.leave_rejected` | `leave_pass_id`, `student_id`, `reason` | Leave rejected |
| `hostel.visitor_checkin` | `visitor_entry_id`, `student_id`, `visitor_name`, `relation` | Visitor arrived |
| `hostel.visitor_checkout` | `visitor_entry_id`, `student_id`, `visitor_name` | Visitor departed |
| `hostel.fee_due` | `student_id`, `bill_id`, `amount`, `due_date` | Hostel fee reminder |
| `hostel.damage_charged` | `student_id`, `damage_id`, `description`, `amount` | Damage charge |

**Template variables:** `{{hostel_name}}`, `{{room_no}}`, `{{bed_no}}`, `{{checkin_date}}`, `{{leave_from}}`, `{{leave_to}}`, `{{visitor_name}}`, `{{relation}}`, `{{bill_amount}}`, `{{damage_amount}}`.

---

## 10. Transport

**Tables read:**
- `school_transport_route`, `school_transport_vehicle`
- `school_transport_student`, `school_transport_attendance`

**Automation triggers:**

| Event | Payload | Typical Template |
|---|---|---|
| `transport.route_changed` | `route_id`, `route_name`, `changes[]`, `effective_date` | Route change |
| `transport.vehicle_breakdown` | `vehicle_id`, `route_id`, `estimated_delay` | Breakdown alert |
| `transport.student_boarded` | `student_id`, `route_id`, `stop_name`, `time` | Boarding confirmation |
| `transport.student_alighted` | `student_id`, `route_id`, `stop_name`, `time` | Alighting confirmation |
| `transport.late_arrival` | `route_id`, `stop_name`, `scheduled_time`, `actual_time`, `delay_minutes` | Bus late alert |

**Template variables:** `{{route_name}}`, `{{vehicle_no}}`, `{{stop_name}}`, `{{scheduled_time}}`, `{{actual_time}}`, `{{delay_minutes}}`, `{{boarding_time}}`, `{{alighting_time}}`.

---

## 11. Library

**Tables read:**
- `school_library_book`, `school_library_issue`, `school_library_fine`

**Automation triggers:**

| Event | Payload | Typical Template |
|---|---|---|
| `library.book_issued` | `student_id`, `book_title`, `author`, `due_date` | Book issued |
| `library.book_due_soon` | `student_id`, `book_title`, `due_date`, `days_left` | Return reminder |
| `library.book_overdue` | `student_id`, `book_title`, `due_date`, `days_overdue`, `fine_amount` | Overdue notice |
| `library.book_returned` | `student_id`, `book_title`, `return_date` | Return confirmation |
| `library.fine_charged` | `student_id`, `book_title`, `fine_amount`, `reason` | Fine notification |

**Template variables:** `{{book_title}}`, `{{author}}`, `{{due_date}}`, `{{return_date}}`, `{{days_overdue}}`, `{{fine_amount}}`.

---

## 12. Inventory & Assets

**Tables read:**
- `school_inv_asset`, `school_inv_issue`

**Automation triggers:**

| Event | Payload | Typical Template |
|---|---|---|
| `inventory.asset_issued` | `student_id`/`staff_id`, `asset_name`, `asset_code`, `return_date` | Asset issued |
| `inventory.asset_due_soon` | `student_id`/`staff_id`, `asset_name`, `return_date`, `days_left` | Return reminder |
| `inventory.asset_overdue` | `student_id`/`staff_id`, `asset_name`, `days_overdue` | Overdue asset |

---

## 13. HR & Payroll

**Tables read:**
- `school_staff`, `school_payroll`, `school_payslip`
- `school_leave_balance`, `school_leave_application` (staff)

**Automation triggers:**

| Event | Payload | Typical Template |
|---|---|---|
| `hr.payslip_generated` | `staff_id`, `month`, `year`, `net_pay`, `payslip_url` | Payslip ready |
| `hr.salary_credited` | `staff_id`, `amount`, `date`, `mode` | Salary credited |
| `hr.leave_approved` | `staff_id`, `leave_type`, `from_date`, `to_date` | Leave approved |
| `hr.leave_rejected` | `staff_id`, `leave_type`, `from_date`, `to_date`, `reason` | Leave rejected |
| `hr.document_expiry` | `staff_id`, `document_type`, `expiry_date`, `days_left` | Document expiry |

---

## 14. Calendar

**Tables read:**
- `school_calendar_event`

**Automation triggers:**

| Event | Payload | Typical Template |
|---|---|---|
| `calendar.event_created` | `event_id`, `title`, `description`, `start_date`, `end_date`, `audience` | Event notification |
| `calendar.event_reminder` | `event_id`, `title`, `start_date`, `hours_before` | Event reminder |
| `calendar.event_cancelled` | `event_id`, `title`, `reason` | Event cancelled |

---

## 15. Communication Module Internals

**Event emission pattern (for other modules to call):**

```javascript
// In server/src/school/communication/events.js
export async function emitEvent(pool, appId, eventName, payload) {
  const automations = await pool.query(
    `SELECT * FROM school_communication_automation
     WHERE app_id = $1 AND trigger_event = $2 AND is_active = true`,
    [appId, eventName]
  );
  for (const auto of automations.rows) {
    await queueAutomation(pool, auto, payload);
  }
}
```

**Modules import and call:**
```javascript
import { emitEvent } from '../communication/events.js';
await emitEvent(pool, req.school.appId, 'fee.due_soon', payload);
```

**No direct table writes** by other modules into communication tables. All goes through automation engine or explicit API calls.

---

## 16. Notification Delivery Infrastructure

| Channel | Primary | Fallback | Webhook |
|---|---|---|---|
| SMS | Twilio | MSG91 / Gupshup | `/webhooks/sms/:provider` |
| Email | SendGrid | Mailgun / SES / Postmark | `/webhooks/email/:provider` |
| Push | Firebase (FCM) | OneSignal / Expo | `/webhooks/push/:provider` |

Providers configured in `school_communication_provider`.  
Communication module handles provider selection, fallback, retry, rate limiting.

---

## 17. Opt-out & Compliance

- `school_communication_opt_out` table checked before every send.
- SMS: `STOP` keyword triggers opt-out via webhook.
- Email: List-unsubscribe header + unsubscribe link in footer.
- Push: Device token invalidated on uninstall (handled by provider webhook).
- Opt-out respected per channel independently.

---

## 18. Audit Trail

Every sensitive action calls:
```javascript
await writeAudit(pool, req, {
  action: 'communication.send',
  entity: 'school_communication_message',
  entityId: messageId,
  before: null,
  after: { channel, recipient_count, template_id }
});
```

Audited actions:
- Message send/schedule/cancel/retry
- Template create/update/delete
- Provider create/update/delete/test
- Notice publish/unpublish/delete
- Automation create/update/delete/enable/disable
- Settings change
- Opt-out add/remove