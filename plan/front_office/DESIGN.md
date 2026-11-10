# Front Office — Design

**Version 1.0** · 4 November 2026

---

## 1. Purpose and scope

This document describes the School ERP Front Office module that operates the reception desk, enquiries, visitors, complaints, call log and appointments. It provides the first point of contact for parents, students, staff and external visitors, ensures safe and auditable movement on campus, and feeds leads into Admissions and issues into Student, HR and Communication.

**Submodules**
- Enquiry
- Visitors
- Complaints / Helpdesk
- Call Log
- Appointments

**In scope**
Reception dashboard, enquiry capture and conversion, visitor check-in/out and gate passes, appointment booking with hosts, call logging, complaint tickets with ownership and SLA, authorised visitor lists and blacklist, audit and reporting.

**Out of scope for first release**
Telephony integration, facial recognition, chatbot, postal/courier tracking, certificate/TC workflow, ID card requests. These are deferred to later steps.

---

## 2. Requirements

- Enquiry to admission conversion without re-entry.
- Reception can see who is inside at any time and close open visits at day end.
- Every complaint has owner, status, due date and closure note.
- Call logged in under 15 seconds with caller, topic and follow-up.
- No host has two bookings in the same slot.
- Visitor cannot enter without check-in; blacklist and authorised list enforced.
- Child release and gate pass require authorised person and approval.
- Audit trail for all sensitive front office actions.
- Privacy by default; minimal personal data collected for visitors.
- Role based access and tenant scoping.

---

## 3. Recommended solution in brief

1. Keep Enquiry as the lead master linked to Applications and Students.
2. Model visitors as persons with check-in/out, badge, host and purpose; maintain authorised visitor list per student/family and a global blacklist.
3. Treat complaints as tickets with category, priority, owner, due date and closure evidence.
4. Call log as a fast capture form with tags and follow-up date.
5. Appointments are host-slot bookings with double-book prevention and reminders.
6. Front desk day workflow is a single dashboard with live widgets for open visits, overdue follow-ups, open complaints and today's appointments.
7. All modules post events to notifications and audit.

---

## 4. Core design

### 4.1 Front desk day workflow

**Open desk**
1. Reception opens the dashboard → sees open visits, today's appointments, overdue enquiries, open complaints.
2. Walk-in visitor → quick search by name/phone → pre-register or register on the spot → ID check → badge print → check-in → notify host.
3. Visitor checkout → badge return → check-out time logged → daily log closed.
4. Enquiry call/walk-in → capture enquiry → assign counselor → set follow-up.
5. Complaint received → create ticket → assign owner → set due date → notify owner.
6. Appointment booking → select date/time/host → check availability → confirm → send reminder.
7. End of day → system flags open visits, unclosed calls and overdue follow-ups.

### 4.2 Mechanisms

| Mechanism | Coverage |
|---|---|
| Lead pipeline | Enquiry → Follow-up → Application → Admission |
| Visitor control | Authorised list, blacklist, check-in/out, badge, gate pass |
| Ticketing | Complaint owner, SLA, escalation, closure evidence |
| Contact capture | Call log with tags, disposition, next action |
| Slot booking | Host calendar, conflict prevention, reminders |
| Audit | Immutable logs, corrections audited |

**Lifecycles**
- Enquiry: New → Assigned → Contacted → Qualified → Converted / Closed.
- Visitor: Pre-registered → Checked in → Checked out / Denied.
- Complaint: Raised → Assigned → In progress → Resolved → Closed.
- Call: Logged → Categorised → Follow-up set → Closed.
- Appointment: Requested → Confirmed → Completed / Cancelled / No-show.

---

## 5. Data model

### 5.1 Enquiry
| Table | Key fields |
|---|---|
| school_enquiries | id, app_id, enquiry_no, first_name, last_name, phone, email, class_applied, source, status, assigned_to, follow_up_date, remarks, created_at, updated_at |
| school_enquiry_followups | enquiry_id, follow_up_date, outcome, next_action, logged_by, logged_at |
| school_applications | id, app_id, enquiry_id, student_id, application_no, first_name, last_name, status, test_date, offer_sent_at, admitted_at |

### 5.2 Visitors
| Table | Key fields |
|---|---|
| school_visitors | id, app_id, visitor_name, phone, id_type, id_number_masked, photo, purpose, to_meet, host_id, in_time, out_time, badge_no, status |
| school_authorised_visitors | id, app_id, student_id, visitor_name, phone, relation, valid_till, added_by |
| school_visitor_blacklist | id, app_id, visitor_name, phone, reason, added_by, added_at |
| school_gate_passes | id, app_id, student_id, issued_by, reason, out_time, return_time, picked_by, status |

### 5.3 Complaints
| Table | Key fields |
|---|---|
| school_complaints | id, app_id, complaint_no, raised_by, category, priority, subject, description, status, assigned_to, due_date, resolved_at, resolution_note, created_at, updated_at |
| school_complaint_updates | complaint_id, note, updated_by, updated_at |

### 5.4 Call Log
| Table | Key fields |
|---|---|
| school_call_logs | id, app_id, caller_name, phone, call_type, topic, disposition, summary, follow_up_date, logged_by, logged_at |

### 5.5 Appointments
| Table | Key fields |
|---|---|
| school_appointments | id, app_id, appointment_no, visitor_name, phone, host_id, host_name, meeting_type, start_time, end_time, status, notes, created_by, created_at |
| school_appointment_hosts | id, app_id, staff_id, name, working_hours, capacity_per_slot |

System tables: Notification, AuditLog, User, Role.

---

## 6. Rules and policies

**Hard rules**
- Visitor entering without check-in is blocked.
- Visitor on blacklist is blocked.
- Child release requires authorised person and approval.
- Double booking of host slot is blocked.
- Complaint cannot be closed without resolution note.
- Editing closed visit/call is blocked; corrections are audited.
- Approving own pickup exception is blocked.
- Deleting enquiry with follow-up history is blocked.

**Soft rules**
- Follow-up overdue → warn.
- Complaint near due date → warn.
- Visitor overstaying → warn.
- Repeat complaint for same issue → warn.
- Host overloaded → warn.
- Enquiry without follow-up date → warn.

**Policy settings**
- Visitor visiting hours, pre-registration required, ID needed.
- Gate pass approval chain.
- Complaint SLA by category.
- Call log retention.
- Appointment reminder lead time.
- Blacklist retention.

---

## 7. Screens

- **Reception Dashboard**: open visits, today's appointments, overdue enquiries, open complaints, quick actions.
- **Enquiry**: list, capture, assign, follow-up timeline, convert to application, source reports.
- **Visitors**: check-in/out, search, badge preview, authorised list, blacklist, daily log, gate pass.
- **Complaints**: ticket list, create, assign, SLA widget, updates, closure with note, reports.
- **Call Log**: fast capture form, history, tags, follow-up reminders.
- **Appointments**: host calendar, book, confirm/cancel, check-in, no-show marking, reminders.
- **Reports**: conversion, visitor, complaint SLA, call volume, appointment utilisation.

---

## 8. Workflows

### 8.1 Enquiry to admission
Enquiry captured → assigned → follow-up logged → qualified → converted to application → application processed → admission.

### 8.2 Visitor check-in/out
Pre-register or walk-in → ID verified → blacklist check → authorised check → badge issued → host notified → check-out → log saved.

### 8.3 Complaint
Raise complaint → auto assign by category → owner acts → updates logged → due date monitored → resolved with note → closed.

### 8.4 Call log
Call received → log caller, topic, disposition → set follow-up → reminder sent → closed.

### 8.5 Appointment
Request booking → availability check → confirm → reminder sent → host check-in → complete/cancel → feedback.

### 8.6 Links with other modules
- Admissions: enquiry conversion, application link.
- Student/Family: visitor authorisation, gate pass, child release.
- HR: hosts for appointments, staff verification.
- Communication: notifications for appointments, complaints, follow-ups.
- Notifications: alerts for overdue items.

---

## 9. Integration points

- **Admissions**: Enquiry → Application → Student creation. Admission status updates enquiry.
- **Student/Family**: Student lookup, authorised visitors, gate pass, guardian contacts.
- **HR**: Host mapping, staff availability, duty roster.
- **Communication**: SMS/Email for appointment reminders, follow-ups, complaint updates.
- **Notifications**: Real-time alerts for open visits, overdue complaints, appointment check-in.
- **Audit**: All front office actions write AuditLog.

---

## 10. Roles, alerts and reports

| Role | Allowed actions |
|---|---|
| Front Office Manager | Full setup and operations |
| Receptionist | Check-in/out, call log, appointments, enquiry capture |
| Admission Counselor | Enquiry pipeline, conversion |
| Host | View own appointments, confirm/cancel |
| Complaint Owner | Update and close assigned tickets |
| Principal/Admin | Approve exceptions, view all reports |

**Alerts**
- Visitor checked in → notify host.
- Overdue follow-up → counselor.
- Complaint near due → owner and manager.
- Appointment reminder → visitor and host.
- Open visit at day close → reception.
- Blacklist hit → reception and security.

**Reports**
- Enquiry conversion funnel.
- Visitor log daily/monthly.
- Complaint SLA and closure time.
- Call volume by topic and disposition.
- Appointment utilisation by host.
- Gate pass and pickup audit.

---

## 11. Scenario coverage

| Scenario | Handling | Step |
|---|---|---|
| Walk-in visitor | Immediate check-in with badge | 2 |
| Pre-registered visitor | Fast check-in | 2 |
| Visitor on blacklist | Blocked | 2 |
| Authorised parent pickup | Gate pass with approval | 2 |
| Enquiry from website | Auto capture, assign | 1 |
| Follow-up overdue | Dashboard warning | 1 |
| Complaint escalation | Auto escalate past due | 3 |
| Double appointment | Blocked at booking | 5 |
| Call with follow-up | Log and reminder | 4 |
| Child released to unauthorised | Blocked | 2 |
| Editing closed record | Blocked, audited correction | 6 |

---

## 12. Build plan

| Step | Deliverable | Done when |
|---|---|---|
| 1 | Enquiry | Enquiry converts to admission without re-entry |
| 2 | Visitors | Desk shows who is inside at any time |
| 3 | Complaints | No complaint stays open without owner/due date |
| 4 | Call Log | Call logged in under 15 seconds |
| 5 | Appointments | No host has two bookings in one slot |
| 6 | Reports & Hardening | Conversion and complaint reports ready |
| 7 | Later | Face recognition, telephony, chatbot |

---

## 13. Open decisions

1. Visitor ID capture: photo mandatory or optional?
2. Badge printing: thermal printer integration or digital QR only?
3. Complaint categories and SLA defaults per school.
4. Appointment host calendars: per staff or per department?
5. Call log telephony integration timeline.
6. Retention periods for visitor photos and logs.
7. Gate pass approval chain depth.
8. Enquiry sources taxonomy.
