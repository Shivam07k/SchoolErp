# Events & PTM — API Endpoints

**Base Path:** `/api/school/events`  
**Authentication:** Bearer token, tenant-scoped via `app_id`  
**Permissions:** See permissions table below

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

---

## Dashboard

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/dashboard` | `events.view` | Summary: upcoming events, pending PTMs, gallery stats |

---

## Events

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/calendar` | `events.view` | Calendar feed for month/week/day |
| GET | `/events` | `events.view` | List events with filters |
| POST | `/events` | `events.calendar` | Create event |
| GET | `/events/:id` | `events.view` | Event detail |
| PUT | `/events/:id` | `events.calendar` | Update event |
| DELETE | `/events/:id` | `events.calendar` | Soft-delete event |
| PUT | `/events/:id/status` | `events.calendar` | Publish/archive/cancel |
| GET | `/events/:id/audience` | `events.view` | List audience targeting |
| POST | `/events/:id/audience` | `events.calendar` | Add audience target |
| PUT | `/events/:id/audience/:audId` | `events.calendar` | Update audience target |
| DELETE | `/events/:id/audience/:audId` | `events.calendar` | Remove audience target |

---

## Event Registration

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/events/:id/registrations` | `events.view` | List registrations |
| POST | `/events/:id/registrations` | `events.view` | Register student/parent |
| PUT | `/events/:id/registrations/:regId` | `events.calendar` | Update status (confirm/waitlist/cancel) |

---

## Event Attendance

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/events/:id/attendance` | `events.view` | List attendance |
| POST | `/events/:id/attendance` | `events.calendar` | Mark attendance |
| GET | `/events/:id/participants` | `events.view` | Export participant list |

---

## PTM Schedule

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/ptm/schedules` | `events.view` | List PTM sessions |
| POST | `/ptm/schedules` | `events.ptm` | Create PTM session |
| GET | `/ptm/schedules/:id` | `events.view` | Session detail |
| PUT | `/ptm/schedules/:id` | `events.ptm` | Update session |
| PUT | `/ptm/schedules/:id/status` | `events.ptm` | Open/close availability/booking |
| DELETE | `/ptm/schedules/:id` | `events.ptm` | Soft-delete |

---

## PTM Slots (Teacher Availability)

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/ptm/schedules/:id/slots` | `events.view` | List teacher slots |
| POST | `/ptm/schedules/:id/slots` | `events.ptm` | Create slot (teacher submits availability) |
| PUT | `/ptm/slots/:id` | `events.ptm` | Update slot |
| DELETE | `/ptm/slots/:id` | `events.ptm` | Delete slot |

---

## PTM Booking (Parent)

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/ptm/bookings` | `events.view` | List bookings (parent/teacher/admin) |
| POST | `/ptm/slots/:id/book` | `events.ptm` | Atomic booking (row lock) |
| PUT | `/ptm/bookings/:id` | `events.ptm` | Reschedule (release old, book new) |
| PUT | `/ptm/bookings/:id/cancel` | `events.ptm` | Cancel booking |

---

## PTM Remarks

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/ptm/bookings/:id/remarks` | `events.view` | Get remarks |
| POST | `/ptm/bookings/:id/remarks` | `events.ptm` | Teacher records remarks |
| PUT | `/ptm/remarks/:id` | `events.ptm` | Update remarks |

---

## Photo Gallery

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/gallery/albums` | `events.view` | List albums |
| POST | `/gallery/albums` | `events.gallery` | Create album |
| GET | `/gallery/albums/:id` | `events.view` | Album detail |
| PUT | `/gallery/albums/:id` | `events.gallery` | Update album |
| DELETE | `/gallery/albums/:id` | `events.gallery` | Soft-delete album |
| GET | `/gallery/albums/:id/media` | `events.view` | List media |
| POST | `/gallery/albums/:id/media` | `events.gallery` | Upload media |
| PUT | `/gallery/media/:id/approve` | `events.gallery` | Approve/reject media |
| GET | `/gallery/albums/:id/download` | `events.view` | ZIP download |

---

## Reports

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/reports/upcoming` | `events.reports` | Upcoming events |
| GET | `/reports/completed` | `events.reports` | Completed events |
| GET | `/reports/participation` | `events.reports` | Event-wise participation |
| GET | `/reports/attendance` | `events.reports` | Student event attendance |
| GET | `/reports/ptm/bookings` | `events.reports` | PTM booking report |
| GET | `/reports/ptm/teacher-schedule` | `events.reports` | Teacher-wise PTM schedule |
| GET | `/reports/ptm/parent-attendance` | `events.reports` | Parent meeting attendance |
| GET | `/reports/ptm/pending` | `events.reports` | Pending PTM appointments |
| GET | `/reports/registration` | `events.reports` | Event registration report |

---

## Settings & Notifications

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/settings` | `events.manage` | Get settings |
| PUT | `/settings` | `events.manage` | Update settings |
| GET | `/notifications` | `events.view` | Notification history |

---

## Default Policy Settings

```json
{
  "default_reminder_days": [1, 3, 7],
  "ptm_slot_minutes": 15,
  "booking_deadline_days": 2,
  "max_waitlist_size": 10,
  "gallery_approval_required": true,
  "media_max_size_mb": 10,
  "allow_parent_ptm_booking": true,
  "auto_cancel_waitlist_on_event_cancel": true
}
```