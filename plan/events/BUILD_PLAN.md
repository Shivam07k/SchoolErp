# Events & PTM — Build Plan

**Version 1.0** · Based on `DESIGN.md` · 4 November 2026

---

## Overview

The module is built in five sequential steps plus one optional hardening step. Each step delivers working, testable functionality.

**Dependencies**
- Students master (`school_students`, guardian fields)
- Staff/HR (`school_staff` for teachers)
- Timetable (`school_timetable` for scheduling context)
- Communication (`school_communication_*` for notifications)
- Calendar (`school_calendar_event` for holiday/exam awareness)

**Migration files:** `sql/80_events_core.sql`, `sql/81_events_ops.sql`

**Backend router:** `server/src/routes/school_events.js`, mounted at `/api/school` **before** the legacy `school_comp_router`.

**Frontend routes:** `/school/events/calendar`, `/school/events/list`, `/school/events/registration`, `/school/events/ptm`, `/school/events/gallery`.

---

## Build steps

| Step | Deliverable | Done when |
|---|---|---|
| 1 | Event Calendar | Events appear to correct audience; registration opens/closes on schedule |
| 2 | Events List & Registration | Waitlist works; attendance marks persist; waitlist promotion notifies |
| 3 | PTM Schedule | Teacher availability slots created; parent booking is atomic; no overlaps |
| 4 | Photo Gallery | Albums created; media upload with approval; visibility enforced |
| 5 | Reports & Hardening | Inspector-ready reports; roles, audit, retention enforced |
| 6 | Later (optional) | Live streaming, ticket payments, video gallery, AI recommendations |

---

## Step 1: Event Calendar

**Target:** Full event CRUD with audience targeting, registration settings, and calendar views.

### Database
- `school_event` – core event record
- `school_event_audience` – class/section/audience targeting
- Indexes on `start_dt`, `status`, `app_id`

### Backend API (`/api/school/events/*`)
| Endpoint | Method | Purpose |
|---|---|---|
| `/calendar` | GET | Calendar feed for month/week/day |
| `/events` | GET/POST | List/create events |
| `/events/:id` | GET/PUT/DELETE | Detail/update/soft-delete |
| `/events/:id/audience` | GET/POST/PUT | Manage audience targeting |
| `/events/:id/status` | PUT | Publish/archive/cancel |

### Frontend Screens
| Screen | File | Route |
|---|---|---|
| Calendar View | `Calendar.jsx` | `/school/events/calendar` |
| Event Management | `EventManagement.jsx` | `/school/events/list` |
| Event Form | (modal in `EventManagement.jsx`) | — |

### Permission
- `events.view` — read calendar and list
- `events.manage` — create/edit events, manage audience
- `events.calendar` — alias for manage

### Done When
- Events appear on calendar for correct audience
- Registration opens/closes per schedule
- Draft/published/archived/cancelled states work

---

## Step 2: Events List & Registration

**Target:** Registration with waitlist, attendance marking, participant lists.

### Database
- `school_event_registration` – student/parent registration
- `school_event_attendance` – attendance marking
- Unique index on `(event_id, student_id)` for registration

### Backend API
| Endpoint | Method | Purpose |
|---|---|---|
| `/events/:id/registrations` | GET/POST | List/register |
| `/events/:id/registrations/:regId` | PUT | Update status (confirm/waitlist/cancel) |
| `/events/:id/attendance` | GET/POST | List/mark attendance |
| `/events/:id/participants` | GET | Export participant list |

### Frontend Screens
| Screen | File | Route |
|---|---|---|
| Registration | `Registration.jsx` | `/school/events/registration/:id` |
| Participant List | `Participants.jsx` | `/school/events/participants/:id` |
| Attendance | `Attendance.jsx` | `/school/events/attendance/:id` |

### Hard rules enforced by API
- Registration blocked after `max_participants` reached
- Waitlist auto-promotes on cancellation
- Attendance only on event date ±1 day
- Duplicate registration prevented

### Done When
- Waitlist works and promotes correctly
- Attendance marks persist and export
- Waitlist promotion sends notification

---

## Step 3: PTM Schedule

**Target:** Teacher availability → parent booking → remarks recording.

### Database
- `school_ptm_schedule` – PTM session (date, classes)
- `school_ptm_slot` – teacher time slots
- `school_ptm_booking` – parent bookings
- `school_ptm_remarks` – teacher remarks post-meeting
- Unique index on `(slot_id, student_id)` for booking

### Backend API
| Endpoint | Method | Purpose |
|---|---|---|
| `/ptm/schedules` | GET/POST | List/create PTM sessions |
| `/ptm/schedules/:id` | GET/PUT | Detail/update |
| `/ptm/schedules/:id/slots` | GET/POST | Teacher availability slots |
| `/ptm/slots/:id/book` | POST | Atomic parent booking |
| `/ptm/bookings/:id` | PUT | Reschedule/cancel |
| `/ptm/bookings/:id/remarks` | POST | Teacher records remarks |

### Frontend Screens
| Screen | File | Route |
|---|---|---|
| PTM Schedule | `PTMSchedule.jsx` | `/school/events/ptm` |
| Teacher Availability | `TeacherAvailability.jsx` | `/school/events/ptm/availability/:id` |
| Parent Booking | `ParentBooking.jsx` | `/school/events/ptm/booking` |
| PTM History | `PTMHistory.jsx` | `/school/events/ptm/history` |
| PTM Remarks | `PTMRemarks.jsx` | `/school/events/ptm/remarks/:id` |

### Hard rules enforced by API
- Teacher cannot have overlapping slots
- One booking per student per slot
- Booking atomic with row lock
- Reschedule only before deadline
- Remarks only by assigned teacher

### Done When
- Teacher availability slots created without overlaps
- Parent booking is atomic; no double-bookings
- Remarks recorded and visible to parent

---

## Step 4: Photo Gallery

**Target:** Albums with media upload, approval workflow, visibility controls.

### Database
- `school_gallery_album` – album metadata
- `school_gallery_media` – images/videos
- `approved` flag on media for public albums

### Backend API
| Endpoint | Method | Purpose |
|---|---|---|
| `/gallery/albums` | GET/POST | List/create albums |
| `/gallery/albums/:id` | GET/PUT/DELETE | Detail/update/soft-delete |
| `/gallery/albums/:id/media` | GET/POST | List/upload media |
| `/gallery/media/:id/approve` | PUT | Approve/reject media |
| `/gallery/albums/:id/download` | GET | ZIP download |

### Frontend Screens
| Screen | File | Route |
|---|---|---|
| Album Management | `Albums.jsx` | `/school/events/gallery/albums` |
| Gallery View | `GalleryView.jsx` | `/school/events/gallery/:id` |

### Done When
- Albums created with visibility settings
- Media upload with approval for public albums
- Download permissions enforced

---

## Step 5: Reports & Hardening

**Target:** Inspector-ready reports, role controls, retention, audit.

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

### Hardening
- Mask student names in participant exports for non-admins
- Role-based access for teacher, admin, parent, auditor
- Retention settings for attendance, bookings, media
- Audit every sensitive action: event create, booking, remark, approval
- Export CSV from every report
- Pagination on all lists

### Done When
- Inspector can see event participation, PTM attendance, gallery stats
- Sensitive actions audited
- Retention and masking enforced

---

## Step 6: Later (optional)

Live streaming, ticket payment integration, video gallery, AI-based event recommendations. Add only when needed.

---

## Permissions

| Permission | Purpose |
|---|---|
| `events.view` | Read all events screens |
| `events.manage` | Full setup and operations (superset) |
| `events.calendar` | Event creation and management |
| `events.ptm` | PTM schedule and booking |
| `events.gallery` | Photo gallery management |
| `events.reports` | Reports and exports |

`events.manage` is a superset for backward compatibility.

---

## Quick start

```bash
node server/_schoolsetup.mjs school_erp
npm run dev
```

Login as `ADMIN` to see **Events & PTM** in the menu: Event Calendar, Events List, PTM Schedule, Photo Gallery.