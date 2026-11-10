# Events & PTM — Frontend Screens

**Stack:** React 18, Vite, Bootstrap 5, React Router  
**Base Path:** `/school/events`  
**Dispatch:** From `src/components/SchoolPage.jsx` → `module === 'events'`

---

## Routes

| Route | File | Tab Key |
|---|---|---|
| `/school/events/calendar` | `Calendar.jsx` | `calendar` |
| `/school/events/list` | `EventManagement.jsx` | `list` |
| `/school/events/registration/:id` | `Registration.jsx` | `registration` |
| `/school/events/participants/:id` | `Participants.jsx` | `participants` |
| `/school/events/attendance/:id` | `Attendance.jsx` | `attendance` |
| `/school/events/ptm` | `PTMSchedule.jsx` | `ptm` |
| `/school/events/ptm/availability/:id` | `TeacherAvailability.jsx` | `ptm-availability` |
| `/school/events/ptm/booking` | `ParentBooking.jsx` | `ptm-booking` |
| `/school/events/ptm/history` | `PTMHistory.jsx` | `ptm-history` |
| `/school/events/ptm/remarks/:id` | `PTMRemarks.jsx` | `ptm-remarks` |
| `/school/events/gallery/albums` | `Albums.jsx` | `gallery-albums` |
| `/school/events/gallery/:id` | `GalleryView.jsx` | `gallery-view` |

---

## Shared Helpers

`src/pages/school/events/shared.jsx` exports:
```js
export { PageShell, Empty, Loading, Badge, fmtDate, fmtDateTime, downloadCsv };
```

---

## Screen Details

### 1. Calendar `Calendar.jsx` — `/school/events/calendar`

**Tabs:**
- **Month** — FullCalendar month view
- **Week** — FullCalendar week view
- **Day** — FullCalendar day view
- **List** — Upcoming events list

**KPI Strip:** Upcoming (7d), This Month, Registrations Open, Pending PTMs

**UI Components:**
- `EventCalendar` (FullCalendar wrapper)
- `EventPopover` — click event → quick actions
- `EventFormModal` — create/edit event
- `AudienceSelector` — class/section/audience multi-select

**Flow:**
1. Month view loads events via `/api/school/events/calendar?start=...&end=...`
2. Click date → open `EventFormModal` (pre-filled date)
3. Click event → `EventPopover` with View/Edit/Register/Delete
4. Create/Edit → POST/PUT `/api/school/events/events`

**Permissions:** `events.view` (read), `events.calendar` (write)

---

### 2. Event Management `EventManagement.jsx` — `/school/events/list`

**Tabs:**
- **All Events** — Searchable, paginated table
- **Drafts** — Filter status=draft
- **Published** — Filter status=published
- **Archived** — Filter status=cancelled/archived

**Table Columns:** Title, Category, Start–End, Venue, Status, Registrations, Actions

**Actions:** View, Edit, Duplicate, Status (Publish/Archive/Cancel), Delete

**Modal:** `EventFormModal` (shared with Calendar)

**Permissions:** `events.view` (read), `events.calendar` (write)

---

### 3. Registration `Registration.jsx` — `/school/events/registration/:id`

**Sections:**
- **Event Header** — Title, date, venue, capacity bar
- **Register Form** — Student search, parent contact, submit
- **Waitlist Notice** — If full, show waitlist option
- **My Registrations** — List current user's registrations

**Flow:**
1. Search student by name/admission no
2. Select student → shows class, parent contact
3. Submit → POST `/api/school/events/events/:id/registrations`
4. Success → toast, update list

**Permissions:** `events.view` (read), self-registration allowed

---

### 4. Participants `Participants.jsx` — `/school/events/participants/:id`

**Tabs:**
- **Confirmed** — Table: Student, Class, Parent, Registered At
- **Waitlisted** — Table with position, Promote button
- **Cancelled** — Table with reason

**Actions:**
- Export CSV
- Promote waitlisted (admin)
- Send reminder (Communication module)

**Permissions:** `events.view`

---

### 5. Attendance `Attendance.jsx` — `/school/events/attendance/:id`

**Sections:**
- **Event Info** — Title, date, venue
- **Mark Attendance** — Student list with Present/Absent/Excused radios
- **Bulk Actions** — Mark all present, clear
- **Summary** — Present/Absent counts

**Flow:**
1. Load registrations for event
2. Mark each student
3. Save → POST `/api/school/events/events/:id/attendance`
4. Export CSV

**Permissions:** `events.view` (read), `events.calendar` (write)

---

### 6. PTM Schedule `PTMSchedule.jsx` — `/school/events/ptm`

**Tabs:**
- **Sessions** — List PTM sessions with status badges
- **Create Session** — Form: date, classes, sections, booking deadline

**Session Card Actions:**
- View → detail
- Manage Availability → `/ptm/availability/:id`
- Open/Close Booking
- View Bookings
- Delete

**Permissions:** `events.view` (read), `events.ptm` (write)

---

### 7. Teacher Availability `TeacherAvailability.jsx` — `/school/events/ptm/availability/:id`

**Sections:**
- **Session Info** — Date, classes, sections
- **Teacher List** — Each teacher with current slots
- **Add Slot Modal** — Teacher select, start/end time, max bookings

**Validation:**
- No overlapping slots for same teacher
- Slot within reasonable hours (8am–6pm)
- Max bookings per slot (default 1)

**Flow:**
1. Teacher clicks "Add Availability"
2. Select time range
3. Submit → POST `/api/school/events/ptm/schedules/:id/slots`
3. Real-time conflict check

**Permissions:** `events.view` (read own), `events.ptm` (write)

---

### 8. Parent Booking `ParentBooking.jsx` — `/school/events/ptm/booking`

**Sections:**
- **My Children** — Cards per student with class/section
- **Available Slots** — Per child, grouped by teacher
- **Booked Slots** — Current bookings with reschedule/cancel

**Flow:**
1. Select child
2. View teacher's available slots
3. Click "Book" → atomic POST `/api/school/events/ptm/slots/:id/book`
4. Success → slot moves to Booked, confirmation sent

**Edge Cases:**
- Slot full → not shown
- Already booked → show "Reschedule"
- Deadline passed → disable booking

**Permissions:** `events.ptm` (parent role)

---

### 9. PTM History `PTMHistory.jsx` — `/school/events/ptm/history`

**Tabs:**
- **Past Sessions** — Completed PTMs with attendance
- **My Bookings History** — All bookings with status

**Table:** Date, Teacher, Student, Status, Remarks link

**Permissions:** `events.view`

---

### 10. PTM Remarks `PTMRemarks.jsx` — `/school/events/ptm/remarks/:id`

**Sections:**
- **Booking Info** — Student, Teacher, Date, Time
- **Remarks Editor** — Rich text (remarks, follow-up date)
- **Previous Remarks** — History if rescheduled

**Flow:**
1. Teacher opens after meeting
2. Enters discussion points, follow-up
3. Save → POST `/api/school/events/ptm/bookings/:id/remarks`
4. Parent notified

**Permissions:** `events.ptm` (teacher of booking)

---

### 11. Albums `Albums.jsx` — `/school/events/gallery/albums`

**Tabs:**
- **My Albums** — Created by current user
- **Public** — visibility=public
- **School** — visibility=school
- **Class** — visibility=class (user's classes)

**Table:** Title, Event, Visibility, Media Count, Created, Actions

**Actions:** View, Edit, Upload Media, Approve Media, Download ZIP, Delete

**Create/Edit Modal:** Title, Description, Event (optional), Visibility, Class/Section (if class)

**Permissions:** `events.view` (read), `events.gallery` (write)

---

### 12. Gallery View `GalleryView.jsx` — `/school/events/gallery/:id`

**Views:**
- **Grid** — Masonry layout, lazy load
- **List** — Table with thumbnails

**Features:**
- Click → lightbox (image) / video player
- Download (if permitted)
- Approve/Reject (admin for public albums)
- Upload more media
- Bulk select → download ZIP

**Lightbox:** Navigation, zoom, download, metadata

**Permissions:** `events.view` (read per visibility), `events.gallery` (upload/approve)

---

## UI Components Library

`src/pages/school/events/components/`:

| Component | Purpose |
|---|---|
| `EventCalendar` | FullCalendar wrapper with event sources |
| `EventFormModal` | Create/edit event with audience selector |
| `EventPopover` | Quick actions on event click |
| `AudienceSelector` | Multi-select class/section/audience |
| `SlotGrid` | Teacher availability visual grid |
| `BookingCard` | Parent booking card with actions |
| `AlbumGrid` | Masonry gallery grid |
| `MediaLightbox` | Image/video viewer |
| `MediaUploader` | Drag-drop multi-file upload |
| `ApprovalBadge` | Status badge with actions |

---

## State Management

- React Query for server state (caching, invalidation)
- Local state for forms and UI
- WebSocket (optional) for real-time booking updates

---

## Responsive Breakpoints

- Calendar: Stack on <768px, list view on mobile
- Gallery: 1 col <576px, 2 col <768px, 3 col <992px, 4 col ≥992px
- PTM Booking: Accordion on mobile
- Tables: Horizontal scroll on mobile with sticky first col