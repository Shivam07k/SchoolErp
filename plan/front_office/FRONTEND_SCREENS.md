# Front Office — Frontend Screens

**Stack:** React + Bootstrap 5, using `PageShell`, `Loading`, `Empty`, `Badge`,
`downloadCsv`, `fmtDate` from `src/pages/school/fee/shared.jsx` and the
`apiGet/apiPost/apiPut/apiDelete` helpers.

All screens live in `src/pages/school/front_office/` and are dispatched from
`src/components/SchoolPage.jsx` when `module === 'frontoffice'`.

---

## Routes

| Route | Component | Menu label |
|---|---|---|
| `/school/frontoffice/enquiries` | `Enquiries.jsx` | Enquiries |
| `/school/frontoffice/visitors` | `Visitors.jsx` | Visitors |
| `/school/frontoffice/complaints` | `Complaints.jsx` | Complaints |
| `/school/frontoffice/call-log` | `CallLog.jsx` | Call Log |
| `/school/frontoffice/appointments` | `Appointments.jsx` | Appointments |

`src/pages/school/front_office/shared.jsx` exports the shared front office helpers:
`canFrontOfficeView`, `canFrontOfficeManage`, `TAB_BUTTON`, status tone maps, `today`,
`dateRange`, `phoneMask`, `BadgePrint`, `Placeholder`.

---

## 1. Enquiries (`Enquiries.jsx`)

Tabs: **Quick Entry**, **Enquiry Board**, **Follow-ups**, **Conversion**.

- Quick Entry form: first name, last name, phone, email, class applied, source,
  remarks, assign to counselor, follow-up date. Auto-generate `enquiry_no`.
- Enquiry Board: Kanban by status New → Assigned → Contacted → Qualified → Converted / Closed.
  Cards show name, phone, class, source, assigned to, days since created, next follow-up.
  Drag to change status, quick assign, set follow-up.
- Follow-ups timeline per enquiry: history of calls, notes, outcome, next action.
  Overdue follow-ups highlighted in amber, >3 days overdue in red.
- Conversion wizard: map enquiry fields to application, pre-fill student data,
  create `school_applications` linked to `enquiry_id`, status set to Draft/Submitted.
  Conversion history retained, enquiry marked Converted.
- Filters: source, class, assigned to, status, date range, search by name/phone.
- Bulk actions: assign, set follow-up date, export CSV.
- KPI strip: total enquiries, new today, overdue follow-ups, conversion rate.

Permission: `front_office.view`; writes require `front_office.enquiry` or `front_office.manage`.

---

## 2. Visitors (`Visitors.jsx`)

Tabs: **Check-in/Out**, **Pass Print**, **Expected**, **Pre-approvals**, **Authorised Persons**, **Blacklist**, **Live List**.

- Check-in/Out: search visitor by name/phone or scan ID, select student / host to meet,
  purpose dropdown, ID type/number capture, photo optional. Blacklist check blocks entry.
  Authorised check for student visits. Badge preview with QR, print pass.
  Check-in → status Checked In, host notified. Check-out logs `out_time`, badge returned.
- Pass Print: thermal / PDF badge generator, visitor name, purpose, to meet, in/out time,
  host signature placeholder.
- Expected: pre-registered visitors for today, arrival time, host, approval status.
- Pre-approvals: approve/reject pending visitor requests, reason, expiry.
- Authorised Persons: per student/family list with relation, phone, valid till, added by.
  Add/edit/remove, quick search.
- Blacklist: visitor name/phone, reason, added by/date, lift action. Search blocks check-in.
- Live List: who is currently inside, host, in time, purpose, overstay warning, quick check-out.
  Daily log export and day-end close checklist for open visits.

Permission: `front_office.view`; writes require `front_office.visitor` or `front_office.manage`.

---

## 3. Complaints (`Complaints.jsx`)

Tabs: **Ticket List**, **New Complaint**, **Actions**, **Escalation**.

- Ticket List: table with complaint_no, raised by, category, priority, subject, status,
  assigned to, due date, age. Filters by category, priority, status, owner, date range.
  SLA widget shows due in <24h amber, overdue red.
- New Complaint: raise by staff/parent/visitor, category, priority, subject, description,
  attachments optional, auto-assign by category rule.
- Actions: per ticket view with timeline of updates, assign/change owner, extend due date,
  add internal note, mark In Progress/Resolved, request closure evidence.
- Escalation: auto-escalate past due date, escalation chain, notify manager/principal.
  Escalation log visible, SLA breach count.
- Closure requires resolution note and resolved_at timestamp. Closed tickets read-only;
  corrections via audited update.
- Reports quick view: open by owner, SLA breach, closure time.

Permission: `front_office.view`; writes require `front_office.complaint` or `front_office.manage`.
Closure requires `front_office.complaint_close` or manage.

---

## 4. Call Log (`CallLog.jsx`)

Tabs: **Quick Log**, **Search**, **Link**.

- Quick Log: fast capture form under 15s: caller name, phone, call type In/Out/Missed,
  topic tags, disposition, summary, follow-up date, link to enquiry/complaint/appointment.
  Save creates `school_call_logs` entry.
- Search: filter by caller name/phone, topic, disposition, logged by, date range.
  Results table with summary, follow-up status.
- Link: attach call log to existing enquiry, complaint or appointment; reverse lookup from
  enquiry/complaint shows call history.
- Follow-up reminders list: upcoming follow-ups, overdue highlighted, quick dial button.
- Bulk export CSV for call volume reports.

Permission: `front_office.view`; writes require `front_office.call_log` or `front_office.manage`.

---

## 5. Appointments (`Appointments.jsx`)

Tabs: **Calendar**, **Booking**, **Reminders**.

- Calendar: host-wise monthly/week/day view, color coded by status Confirmed/Pending/Cancelled/No-show.
  Conflict prevention blocks double booking per host slot.
- Booking form: visitor name/phone, host selection, meeting type, date/time range,
  purpose/notes, created by. Availability check against host working hours and capacity.
  Generate `appointment_no`, send confirmation SMS/Email.
- Booking list: table with appointment_no, visitor, host, start/end, status, created date.
  Actions: confirm, reschedule, cancel, mark no-show, check-in.
- Reminders: auto-reminder lead time per policy, manual resend, reminder log.
- Host management panel: working hours, capacity per slot, holidays.
- Check-in at desk: quick search appointment_no, mark checked-in, late arrival flag.

Permission: `front_office.view`; writes require `front_office.appointment` or `front_office.manage`.
Host can view own appointments with `appointment.host` permission.

---
