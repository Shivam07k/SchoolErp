# Front Office — Build Plan

**Version 1.0** · 4 November 2026

## Overview

School ERP Front Office module operates the reception desk, enquiries, visitors, complaints, call log and appointments. First point of contact for parents, students, staff and external visitors. Ensures safe and auditable campus movement and feeds leads into Admissions and issues into Student, HR and Communication.

**Submodules:** Enquiry, Visitors, Complaints / Helpdesk, Call Log, Appointments

## Dependencies

- Core foundation: `server/src/school/foundation.js` permissions
- Migration registry: `server/_schoolsetup.mjs`
- Admissions link: `school_enquiries` ↔ `school_applications` ↔ `school_students`
- Student/Family: authorised visitors, gate pass, child release
- HR: hosts for appointments, staff availability
- Communication: notifications for appointments, complaints, follow-ups
- Audit: all front office actions write `school_audit_events`

## Migrations

- `sql/80_frontoffice_core.sql` — Core tables and constraints
- `sql/81_frontoffice_ops.sql` — Operational tables, views, indexes

Core tables introduced:
- `school_enquiries`, `school_enquiry_followups`
- `school_visitors`, `school_authorised_visitors`, `school_visitor_blacklist`, `school_gate_passes`
- `school_complaints`, `school_complaint_updates`
- `school_call_logs`
- `school_appointments`, `school_appointment_hosts`

## Backend router

`server/src/routes/school_frontoffice.js`

Mounted in `server/src/index.js` before `schoolCompRouter`. All routes under `schoolRouter` prefix `/school/frontoffice/*`. Guarded by `hasPermission` and tenant scoped by `app_id`.

Example base:
```
schoolRouter.get('/frontoffice/dashboard', ...)
schoolRouter.post('/frontoffice/enquiries', ...)
```

## Frontend routes

Base path `/school/frontoffice/*`

- `/school/frontoffice/dashboard` — Reception Dashboard
- `/school/frontoffice/enquiry` — Enquiry list / capture / convert
- `/school/frontoffice/visitors` — Check-in/out, daily log, badge
- `/school/frontoffice/visitors/authorised` — Authorised visitors
- `/school/frontoffice/visitors/blacklist` — Blacklist
- `/school/frontoffice/visitors/gatepass` — Gate passes
- `/school/frontoffice/complaints` — Tickets
- `/school/frontoffice/calls` — Call Log fast capture
- `/school/frontoffice/appointments` — Host calendar / booking
- `/school/frontoffice/reports` — Reports

Menu entry via `src/school/menu.js` and module dispatch `src/components/SchoolPage.jsx`.

## Permissions

| Permission | Purpose |
|---|---|
| `frontoffice.view` | Read all front office screens |
| `frontoffice.manage` | Full setup and operations superset |
| `frontoffice.enquiry` | Enquiry pipeline and conversion |
| `frontoffice.visitors` | Visitor check-in/out, gate passes |
| `frontoffice.complaints` | Complaint tickets |
| `frontoffice.calls` | Call log |
| `frontoffice.appointments` | Appointments |
| `frontoffice.reports` | Reports and exports |
| `frontoffice.audit` | Audit and retention |

Role mapping:
- Front Office Manager → `frontoffice.manage`
- Receptionist → `frontoffice.view`, `frontoffice.enquiry`, `frontoffice.visitors`, `frontoffice.calls`, `frontoffice.appointments`
- Admission Counselor → `frontoffice.enquiry`
- Host → `frontoffice.appointments` read own
- Complaint Owner → `frontoffice.complaints`
- Principal/Admin → all

## Hard rules

Always blocked:
- Visitor entering without check-in
- Visitor on blacklist
- Child released to unauthorized person without approval
- Double booking of host slot
- Complaint closed without resolution note
- Editing closed visit/call; corrections audited
- Approving own pickup exception
- Deleting enquiry with follow-up history

Warn only:
- Follow-up overdue
- Complaint near due date
- Visitor overstaying
- Repeat complaint
- Host overloaded
- Enquiry without follow-up date

## Build Steps

### Step 1 — Enquiry

**Done when:** Enquiry converts to admission without re-entry

**Database tables**
- `school_enquiries` id, app_id, enquiry_no, first_name, last_name, phone, email, class_applied, source, status, assigned_to, follow_up_date, remarks, created_at, updated_at
- `school_enquiry_followups` enquiry_id, follow_up_date, outcome, next_action, logged_by, logged_at
- `school_applications` link via enquiry_id

**Backend API endpoints**
- `GET /school/frontoffice/enquiries` — list with filters
- `POST /school/frontoffice/enquiries` — create enquiry
- `PUT /school/frontoffice/enquiries/:id` — update status/assign/follow-up
- `POST /school/frontoffice/enquiries/:id/followup` — log follow-up
- `POST /school/frontoffice/enquiries/:id/convert` — convert to application
- `GET /school/frontoffice/enquiries/:id/timeline` — history

**Frontend screens**
- `/school/frontoffice/enquiry` list with filters
- Enquiry capture form
- Follow-up timeline
- Convert to application wizard

**Permissions**
- `frontoffice.enquiry` create/update/convert
- `frontoffice.view` read

### Step 2 — Visitors

**Done when:** Desk shows who is inside at any time

**Database tables**
- `school_visitors` id, app_id, visitor_name, phone, id_type, id_number_masked, purpose, to_meet, host_id, in_time, out_time, badge_no, status
- `school_authorised_visitors` id, app_id, student_id, visitor_name, phone, relation, valid_till, added_by
- `school_visitor_blacklist` id, app_id, visitor_name, phone, reason, added_by, added_at
- `school_gate_passes` id, app_id, student_id, issued_by, reason, out_time, return_time, picked_by, status

**Backend API endpoints**
- `GET /school/frontoffice/visitors/open` — currently inside
- `POST /school/frontoffice/visitors/checkin` — check-in
- `POST /school/frontoffice/visitors/checkout` — check-out
- `GET /school/frontoffice/visitors` — search/history
- `POST /school/frontoffice/visitors/authorised` / `PUT` / `DELETE`
- `POST /school/frontoffice/visitors/blacklist` / `DELETE`
- `POST /school/frontoffice/visitors/gatepass` — create gate pass
- `PUT /school/frontoffice/visitors/gatepass/:id/approve`

**Frontend screens**
- `/school/frontoffice/visitors` check-in/out
- Daily log with live inside list
- Authorised visitors management
- Blacklist management
- Gate pass creation & approval

**Permissions**
- `frontoffice.visitors` full
- `frontoffice.view` read

### Step 3 — Complaints

**Done when:** No complaint stays open without owner/due date

**Database tables**
- `school_complaints` id, app_id, complaint_no, raised_by, category, priority, subject, description, status, assigned_to, due_date, resolved_at, resolution_note, created_at, updated_at
- `school_complaint_updates` complaint_id, note, updated_by, updated_at

**Backend API endpoints**
- `GET /school/frontoffice/complaints`
- `POST /school/frontoffice/complaints`
- `PUT /school/frontoffice/complaints/:id/assign`
- `POST /school/frontoffice/complaints/:id/update`
- `PUT /school/frontoffice/complaints/:id/resolve`
- `GET /school/frontoffice/complaints/sla`

**Frontend screens**
- `/school/frontoffice/complaints` ticket list
- Create ticket
- SLA widget, due date alerts
- Updates timeline
- Closure with mandatory resolution note

**Permissions**
- `frontoffice.complaints` create/update/close
- `frontoffice.view` read

### Step 4 — Call Log

**Done when:** Call logged in under 15 seconds

**Database tables**
- `school_call_logs` id, app_id, caller_name, phone, call_type, topic, disposition, summary, follow_up_date, logged_by, logged_at

**Backend API endpoints**
- `GET /school/frontoffice/calls`
- `POST /school/frontoffice/calls` — fast capture
- `PUT /school/frontoffice/calls/:id`
- `GET /school/frontoffice/calls/summary`

**Frontend screens**
- `/school/frontoffice/calls` fast capture form
- History with tags and follow-up reminders

**Permissions**
- `frontoffice.calls` create/update
- `frontoffice.view` read

### Step 5 — Appointments

**Done when:** No host has two bookings in one slot

**Database tables**
- `school_appointments` id, app_id, appointment_no, visitor_name, phone, host_id, host_name, meeting_type, start_time, end_time, status, notes, created_by, created_at
- `school_appointment_hosts` id, app_id, staff_id, name, working_hours, capacity_per_slot

**Backend API endpoints**
- `GET /school/frontoffice/appointments`
- `GET /school/frontoffice/appointments/hosts/:id/availability`
- `POST /school/frontoffice/appointments`
- `PUT /school/frontoffice/appointments/:id`
- `POST /school/frontoffice/appointments/:id/checkin`
- `POST /school/frontoffice/appointments/:id/cancel`

**Frontend screens**
- `/school/frontoffice/appointments` host calendar
- Booking form with conflict check
- Confirm/cancel/no-show
- Reminder view

**Permissions**
- `frontoffice.appointments` manage
- Host role view own

### Step 6 — Reports & Hardening

**Done when:** Conversion and complaint reports ready

**Deliverables**
- Reports: enquiry conversion funnel, visitor daily/monthly, complaint SLA, call volume by topic, appointment utilisation, gate pass audit
- Hardening: audit trails, immutable corrections, blacklist enforcement, double-booking prevention, validation on close
- Retention policies for visitor photos/logs
- Dashboard widgets for overdue follow-ups, open visits, open complaints, today appointments

**Backend API endpoints**
- `GET /school/frontoffice/reports/conversion`
- `GET /school/frontoffice/reports/visitors`
- `GET /school/frontoffice/reports/complaints`
- `GET /school/frontoffice/reports/calls`
- `GET /school/frontoffice/reports/appointments`

**Frontend screens**
- `/school/frontoffice/reports`
- Export CSV/PDF

**Permissions**
- `frontoffice.reports` view/export
- `frontoffice.audit` audit logs

### Step 7 — Later optional

**Deliverables**
- Face recognition check-in
- Telephony integration for call log
- Chatbot for enquiry triage
- Postal/courier tracking
- Certificate/TC workflow
- ID card requests

**Done when:** Scoped and approved for future release.

---

**Notes**
- All actions scoped by `app_id` and audited.
- Soft warnings displayed on dashboard; hard rules enforced server side.
- No data deletion for records with history; corrections are audited inserts.
