# Events & PTM — Design Document

**Version 1.0** · 4 November 2026  
**Module ID:** M25  
**Package ID:** M25  
**Status:** Design – Plan

---

## 1. Purpose

Provide a unified system for managing school activities, events, academic programs, parent meetings and event-related photographs through one centralized module that connects with the Student, Staff, Timetable and Communication modules.

## 2. Scope

**In scope**
- Event Calendar (monthly, weekly, daily views)
- Events List with registration and attendance
- PTM Schedule with teacher availability and parent booking
- Photo Gallery with albums and media management

**Out of scope – Phase 1**
- Live streaming of events
- Ticket payment integration
- Video gallery
- AI-based event recommendations

## 3. Submodules

1. **Event Calendar** – `school_event`, `school_event_audience`
2. **Events List** – `school_event_registration`, `school_event_attendance`
3. **PTM Schedule** – `school_ptm_schedule`, `school_ptm_slot`, `school_ptm_booking`, `school_ptm_remarks`
4. **Photo Gallery** – `school_gallery_album`, `school_gallery_media`

## 4. Requirements

### Functional
- Create and manage events with full metadata
- Class/section targeting for events and PTMs
- Registration limits with waitlist
- Teacher availability slots with no overlaps
- Parent self-service PTM booking
- Photo album with visibility controls
- Integration with Communication for notifications

### Non-functional
- Tenant-scoped, RLS enforced
- Concurrent PTM booking: only one succeeds per slot
- Idempotent registration and attendance
- Audit trail for all changes
- <2s calendar load with 500 events
- Full RBAC per action

## 5. Recommended Solution

Reuse existing ERP engine:
- **Backend:** Express router `server/src/routes/school_events.js` mounted before `schoolCompRouter`
- **Frontend:** React pages `src/pages/school/events/*.jsx` under Events menu
- **Forms engine:** For event creation and PTM scheduling; custom UI for calendar and gallery
- **Database:** PostgreSQL with tables prefixed `school_event_*`, `school_ptm_*`, `school_gallery_*`. Migrations: `sql/80_events_core.sql`, `sql/81_events_ops.sql`
- **Permissions:** `events.view`, `events.manage`, `events.calendar`, `events.ptm`, `events.gallery`, `events.reports`
- **Integration:** Communication via Automation Rule 5; Timetable for scheduling; Student/Staff for targeting

## 6. Core Design

### 6.1 Event Calendar

**Event creation flow:**
1. Fill event details (title, description, dates, venue, category)
2. Select target audience (all, specific classes/sections, staff, parents)
3. Set registration requirements (optional, required, max participants, deadline)
4. Set reminders (days before, channel)
5. Save as Draft or Publish

**Calendar views:** Month, Week, Day, List. Filter by category, audience, status.

### 6.2 Events List

**Registration flow:**
1. Parent/student views published events
2. Click Register – system checks capacity
3. If full: offer waitlist
4. Confirmation notification sent
5. Organizer sees registration list

**Attendance tracking:** Mark present/absent on event day, export list.

### 6.3 PTM Schedule

**Setup flow:**
1. Admin creates PTM session (date, classes/sections)
2. Teachers receive availability request
3. Teachers define time slots (start, end, max per slot)
4. System validates no overlaps
5. Publish slots to parents

**Booking flow:**
1. Parent sees available slots for their child's teacher
2. Selects one slot – atomic reservation with row lock
3. Confirmation sent to parent and teacher
4. Reschedule: releases old slot, books new (if before deadline)
5. Teacher records remarks after meeting

### 6.4 Photo Gallery

**Album management:**
1. Create album (title, description, event link, visibility)
2. Upload media (images, optional videos)
3. Approval workflow for public albums
4. Class/session filtering
5. Download permissions per album

## 7. Data Model

| Table | Key Fields |
|---|---|
| `school_event` | `id`, `title`, `description`, `start_dt`, `end_dt`, `venue`, `category`, `status`, `organizer_id`, `max_participants`, `registration_deadline` |
| `school_event_audience` | `event_id`, `audience_type`, `class_id`, `section_id` |
| `school_event_registration` | `event_id`, `student_id`, `parent_id`, `registered_at`, `status` |
| `school_event_attendance` | `event_id`, `student_id`, `attendance_status`, `marked_by` |
| `school_ptm_schedule` | `id`, `session_id`, `date`, `class_id`, `section_id`, `status` |
| `school_ptm_slot` | `id`, `schedule_id`, `teacher_id`, `start_time`, `end_time`, `max_bookings`, `status` |
| `school_ptm_booking` | `slot_id`, `student_id`, `parent_id`, `booked_at`, `status`, `remarks` |
| `school_ptm_remarks` | `booking_id`, `teacher_id`, `remarks`, `followup_dt` |
| `school_gallery_album` | `id`, `event_id`, `title`, `description`, `visibility`, `created_by` |
| `school_gallery_media` | `album_id`, `file_id`, `media_type`, `uploaded_by`, `approved` |

All tables: `app_id`, `created_at`, `updated_at`, `deleted_at`.

## 8. Rules and Policies

### Hard rules (always blocked)
- Registration exceeding `max_participants`
- Parent booking PTM slot for another class
- Teacher with overlapping slots
- Booking same slot twice
- Reschedule after deadline
- Publishing public album without approval
- Accessing PTM remarks without authorization

### Soft rules (warn only)
- Event with <10% registration
- Teacher with >6 PTM hours in one day
- Album approaching storage limit

### Configurable settings
| Setting | Options |
|---|---|
| Event categories | Custom list |
| Default reminder days | 1, 3, 7 |
| PTM slot duration | 10, 15, 20 min |
| Booking deadline | Days before PTM |
| Max waitlist size | Per event |
| Gallery approval required | Yes/No |
| Media size limits | Configurable |

## 9. Screens

| Screen | Route | Key Features |
|---|---|---|
| Event Calendar | `/school/events/calendar` | Month/week/day views, filters, create event |
| Event Management | `/school/events/list` | CRUD, audience, registration settings |
| Event Registration | `/school/events/registration/:id` | Register, waitlist, confirm |
| Participant List | `/school/events/participants/:id` | List, export, attendance |
| Event Attendance | `/school/events/attendance/:id` | Mark present/absent |
| PTM Schedule | `/school/events/ptm` | Create sessions, teacher availability |
| Teacher Availability | `/school/events/ptm/availability/:id` | Define slots |
| Parent Appointment | `/school/events/ptm/booking` | Book/reschedule slots |
| PTM History | `/school/events/ptm/history` | Past meetings, remarks |
| PTM Remarks | `/school/events/ptm/remarks/:id` | Record discussion notes |
| Photo Albums | `/school/events/gallery/albums` | CRUD, visibility, approval |
| Gallery View | `/school/events/gallery/:id` | Grid view, download, upload |

## 10. Workflows

**W1: Event to registration to attendance**
1. Event published → notifications sent
2. Parents register → waitlist if full
3. On event day → attendance marked
4. Post-event → feedback request

**W2: PTM schedule to booking to remarks**
1. Admin creates schedule → teachers notified
2. Teachers submit availability → admin publishes
3. Parents book slots → confirmations sent
4. Meeting day → teacher records remarks
5. Remarks available to parent

**W3: Gallery upload to approval to view**
1. Staff uploads media to album
2. If public → approval queue
3. Approved → visible to audience
4. Download per permissions

## 11. Roles, Alerts and Reports

### Roles
| Role | Actions |
|---|---|
| Super Admin | All |
| Principal | Approve, view all |
| School Admin | Create events, manage PTM, approve gallery |
| Teacher | PTM availability, remarks, event attendance |
| Class Teacher | Class events, PTM slots |
| Student | View events, register, book PTM (if allowed) |
| Parent | Register events, book PTM, view gallery |
| Auditor | Read-only |

### Alerts
| Event | Recipients |
|---|---|
| Event published | Target audience |
| Registration confirmed | Parent |
| Waitlist promoted | Parent |
| Event reminder | Registered |
| PTM slots open | Parents |
| PTM booking confirmed | Parent, teacher |
| PTM reminder | Parent, teacher |
| Photo approved | Uploader |

### Reports
- Upcoming events
- Completed events
- Event-wise participation
- Student event attendance
- PTM booking report
- Teacher-wise PTM schedule
- Parent meeting attendance
- Pending PTM appointments
- Event registration report

## 12. Scenario Coverage

| Scenario | Handling | Step |
|---|---|---|
| Create school event | Form with audience, category, registration | 1 |
| Register for event | Click register, capacity check | 1 |
| Participant limit reached | Waitlist option | 1 |
| Cancel event | Notify registrants | 1 |
| Parent books PTM | Atomic slot reservation | 2 |
| Two parents same slot | Only one succeeds | 2 |
| Teacher overlapping PTM | Blocked | 2 |
| Reschedule PTM | Release old, book new | 2 |
| Upload gallery images | Approval for public | 3 |

## 13. Performance, Security, Reliability

- Pagination for all lists
- Server-side filtering by class/section/session
- Centralized file storage for media
- File type/size validation
- Authenticated URLs for media access
- Background jobs for bulk notifications
- Retry mechanism for failed notifications
- Duplicate prevention for bookings/registrations
- Audit logs for important changes
- RBAC on all endpoints
- Historical academic-session data accessible
- DB transactions for multi-step operations
- Student/parent PII protection
- Backups of media and records

## 14. Out of Scope (Phase 1)

- Live streaming
- Ticket payment integration
- Video gallery
- AI-based event recommendations

## 15. Open Decisions

1. Which event categories are standard?
2. Will event registration support online payments?
3. Will parents select PTM slots or will school assign?
4. Will event registration and PTM booking use the same notification templates?
5. Will parents be allowed to download photographs?
6. What consent and visibility rules for student photos?

## 15. Build Strategy

**Phase 1 — Event Calendar** (Week 1-2): Calendar, event CRUD, audience targeting, registration
**Phase 2 — Events List** (Week 3): Registration, waitlist, attendance, notifications
**Phase 3 — PTM Schedule** (Week 4-5): Teacher availability, slots, parent booking, remarks
**Phase 4 — Photo Gallery** (Week 6): Albums, media, approval, permissions
**Phase 5 — Integration & Hardening** (Week 7): Notifications, reports, roles, audit, testing

---

*End of Document*