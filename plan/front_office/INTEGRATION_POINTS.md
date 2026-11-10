# Front Office — Integration Points

---

## 1. Admissions

**Tables involved**
- `school_frontoffice_contact`
- `school_frontoffice_enquiry`
- `school_frontoffice_followup`
- `school_applications`
- `school_students`

**Data flow**
- Enquiry is captured in Front Office as `school_frontoffice_enquiry` linked to `school_frontoffice_contact`.
- Follow-ups are logged in `school_frontoffice_followup`. `stage` moves New → Contacted → Visit Scheduled → Applied → Admitted / Lost.
- On conversion, Front Office sets `enquiry.stage = 'Applied'`, creates/updates `school_applications` with `enquiry_id` and `admission_id`.
- Admission module owns application processing and student creation. Admission status updates flow back to read enquiry for reporting.

**Events**
- `enquiry.created`
- `enquiry.stage_changed`
- `enquiry.followup.logged`
- `enquiry.converted`
- `application.created`
- `student.admitted`

**How data is shared**
- Front Office writes enquiry and follow-up records. Admissions reads `enquiry_id` to create application and writes back `admission_id` on `school_frontoffice_enquiry`.
- Student master is read-only from Front Office. No student columns are modified by Front Office.

---

## 2. Student Master

**Tables involved**
- `school_students`
- `school_guardians`
- `school_frontoffice_authorised_person`
- `school_frontoffice_gatepass`
- `school_frontoffice_visit`
- `school_frontoffice_complaint`

**Data flow**
- Front Office reads `school_students.id`, `admission_no`, `first_name`, `last_name`, `class_id`, `section_id`, `guardian_name`, `guardian_phone`, `status` for visitor search, authorisation and gate pass validation.
- Authorised persons are stored in `school_frontoffice_authorised_person` per `student_id`.
- Gate passes are stored in `school_frontoffice_gatepass` and reference `student_id` and `taken_by_person_id`.
- Complaints can be raised for a `student_id` and linked to `school_frontoffice_contact`.

**Events**
- `student.created`
- `student.updated`
- `student.status_changed`
- `authorised_person.added/removed`
- `gatepass.created/approved`
- `complaint.raised`

**How data is shared**
- Student master is read-only. Front Office never updates `school_students` columns.
- `school_frontoffice_authorised_person` and `school_frontoffice_gatepass` are the source of truth for release authorisation. A release is blocked if the person is not in the authorised list and `status != 'active'`.

---

## 3. HR

**Tables involved**
- `school_staff`
- `school_frontoffice_appointment_hosts`
- `school_frontoffice_host_availability`
- `school_frontoffice_appointment`

**Data flow**
- Appointment hosts are staff. `school_frontoffice_appointment.host_user` references `school_staff.id` / `employee_code`.
- Host availability is maintained in `school_frontoffice_host_availability` and can be seeded from HR working hours.
- Front Office reads staff `name`, `designation`, `department`, `status`, `employee_code` for host selection and display.

**Events**
- `staff.created`
- `staff.updated`
- `staff.exited`
- `appointment.requested`
- `appointment.confirmed`

**How data is shared**
- HR owns `school_staff`. Front Office reads staff master read-only.
- Host mapping is maintained in Front Office tables. Double booking is prevented in Front Office; HR leave is not automatically mirrored but can be reflected via host availability blocks.
- Staff exit sets `status = 'exited'`; Front Office filters hosts to `status='active'`.

---

## 4. Transport

**Tables involved**
- `school_students`
- `school_transport_student`
- `school_transport_route`
- `school_frontoffice_gatepass`
- `school_frontoffice_authorised_person`

**Data flow**
- Front Office reads transport assignment for a student to validate pickup authorisation.
- Gate pass for child release to transport driver is created in `school_frontoffice_gatepass` with `reason = 'transport_pickup'` and `approved_by`.
- Authorised persons can include transport staff for specific students.

**Events**
- `transport.assignment.created/changed`
- `gatepass.created`
- `gatepass.approved`

**How data is shared**
- Transport module owns assignments. Front Office reads `student_id` → `route_id` mapping for display and validation.
- Front Office writes gate passes only; no transport tables are modified.
- Release is blocked if the person picking up is not authorised for that student.

---

## 5. Canteen / Library

**Tables involved**
- `school_students`
- `school_frontoffice_complaint`
- `school_frontoffice_complaint_category`
- `school_frontoffice_contact`

**Data flow**
- Complaints raised via Front Office can be categorised for Canteen or Library. `school_frontoffice_complaint.category_id` routes ownership.
- Front Office reads student `status` and `class_id` to determine Canteen/Library eligibility for visitor guest access.
- Contact master is shared for notifications.

**Events**
- `complaint.raised`
- `complaint.assigned`
- `complaint.resolved`

**How data is shared**
- Front Office is the ticket entry point. Canteen/Library teams own resolution and update status in `school_frontoffice_complaint`.
- No Canteen/Library inventory or loan tables are modified by Front Office.
- For reporting, Front Office aggregates complaint counts by category.

---

## 6. Timetable & Calendar

**Tables involved**
- `school_calendar_event`
- `school_timetable`
- `school_frontoffice_appointment`
- `school_frontoffice_setting`

**Data flow**
- `school_calendar_event` vacations/holidays are read by Front Office to close reception hours and block appointments.
- Appointment booking checks host availability against working hours and blocks created from calendar events.
- Front Office stores `school_frontoffice_setting` keys for visitor hours, pre-registration requirement and appointment reminder lead time.

**Events**
- `calendar.holiday_created`
- `calendar.holiday.updated`
- `appointment.blocked_by_calendar`
- `appointment.confirmed`

**How data is shared**
- Calendar is read-only for Front Office.
- Front Office does not write timetable tables. Appointments are independent but must not overlap host working hours.

---

## 7. Fees

**Tables involved**
- `school_frontoffice_enquiry`
- `school_applications`
- `school_fee_head`
- `school_invoice`
- `school_receipt`

**Data flow**
- On enquiry conversion to admission, Admissions creates fee invoices using existing Fees engine. Front Office provides `enquiry_id` reference for traceability.
- Front Office may display fee due status for a student during gate pass or complaint handling by reading `school_invoice` summary via student_id.
- No new invoices are created by Front Office.

**Events**
- `enquiry.converted`
- `application.admitted`
- `invoice.created`

**How data is shared**
- Front Office is read-only for Fees. Admission/Fees owns billing and collection.
- `school_applications.admission_id` links back to student and fee assignment.

---

## 8. Notifications

**Tables involved**
- `school_frontoffice_notification`
- `school_notification`
- `school_frontoffice_appointment`
- `school_frontoffice_visit`
- `school_frontoffice_complaint`
- `school_frontoffice_enquiry`

**Data flow**
- Front Office writes notifications for visitor check-in, appointment reminders, complaint updates, enquiry follow-up overdue.
- Delivery is handled by the central communication/automation engine which reads `school_frontoffice_notification` and sends SMS/Email/Push.

**Events**
- `visitor.checked_in`
- `visitor.checked_out`
- `appointment.confirmed`
- `appointment.reminder_due`
- `complaint.assigned`
- `complaint.due_soon`
- `enquiry.followup_overdue`

**How data is shared**
- Front Office creates notification records with `kind`, `recipient`, `title`, `message`, `severity`.
- Central Notifications owns delivery channels, templates and retry logic.
- Alerts are surfaced in Reception Dashboard widgets.

---

## 9. Audit

- Every sensitive Front Office action calls `writeAudit` from `server/src/school/foundation.js`.
- Audited actions: enquiry create/update/convert, visitor check-in/out, blacklist/authorized list changes, gate pass create/approve, complaint create/assign/close, call log create, appointment create/cancel, host availability change.
- Corrections create audit entries; original rows are immutable.

---

## 10. Privacy and retention

- Visitor ID numbers are masked in list responses; full ID is stored only for check-in.
- Photos are referenced by URL only.
- Retention settings for visitor logs, gate passes and call logs are stored in `school_frontoffice_setting`.
- Role-based access controls Front Office screens per Receptionist, Admission Counselor, Host and Manager.
