# Events & PTM — Integration Points

---

## 1. Student Master

**Tables:** `school_students`, `school_guardians`, `school_student_enrollments`

**Data Flow:**
- Read-only: student name, class, section, admission_no, guardian contact
- Event registration writes to `school_event_registration`
- PTM booking writes to `school_ptm_booking`
- Attendance writes to `school_event_attendance`

**Events:**
- `student.created` → auto-add to class events
- `student.class_changed` → re-evaluate event audience
- `student.status_changed` → block if inactive/left

---

## 2. Staff / HR

**Tables:** `school_staff`, `school_staff_employment`

**Data Flow:**
- Read-only: teacher name, employee_code, department
- Event organizer → `school_event.organizer_id`
- PTM slots → `school_ptm_slot.teacher_id`
- PTM remarks → `school_ptm_remarks.teacher_id`

**Events:**
- `staff.created` → available for PTM/organizer
- `staff.employment_changed` → re-evaluate PTM eligibility
- `staff.resigned` → block future PTM slots, reassign events

---

## 3. Timetable & Calendar

**Tables:** `school_timetable`, `school_calendar_event`, `school_academic_years`

**Data Flow:**
- Read-only: class schedules, exam dates, holidays
- Event scheduling → avoid exam dates/holidays
- PTM date → check academic session active

**Events:**
- `calendar_event.created` → auto-block event scheduling
- `timetable.published` → update teacher availability windows

---

## 4. Communication Module

**Tables:** `school_communication_*`, `school_notification`

**Data Flow:**
- Event published → send notification to audience
- Registration confirmed → send to parent/student
- Waitlist promoted → send notification
- Event reminder (scheduled job) → send at configured days
- PTM slots open → notify parents
- PTM booking confirmed → notify parent + teacher
- PTM reminder (1 day before) → notify parent + teacher
- Photo approved → notify uploader

**Channels:** SMS, Email, App Push, Notice Board

---

## 5. Communication Module (Inbound)

**Tables:** `school_notice_board`, `school_app_notification`

**Data Flow:**
- Event announcement → create notice board entry
- PTM announcement → create notice + app notification
- Emergency event cancellation → urgent notice + SMS

---

## 6. File Management

**Tables:** `school_files`

**Data Flow:**
- Event banner/image → upload to files, reference in `school_event`
- Gallery media → upload to files, reference in `school_gallery_media`
- PTM documents (if any) → upload to files

---

## 6. Fee Module (Optional)

**Tables:** `school_fee_invoice`, `school_fee_payment`

**Data Flow:**
- Event with registration fee → create fee invoice on registration
- Payment status → update registration status
- Refund on cancellation → create credit note

---

## 7. Examination Module (Read-only)

**Tables:** `school_exam_timetable`

**Data Flow:**
- Read exam dates to avoid scheduling conflicts
- PTM scheduling → avoid exam weeks

---

## 8. Attendance Module (Optional)

**Tables:** `school_attendance_register`

**Data Flow:**
- Event attendance could sync to daily attendance (configurable)
- PTM attendance tracking (separate from daily)

---

## 9. Notification Events Summary

| Event | Trigger | Recipients | Channels |
|---|---|---|---|
| Event published | `school_event` status=published | Target audience | SMS, Email, App, Notice |
| Registration confirmed | `school_event_registration` created | Parent, Student | SMS, Email, App |
| Waitlist promoted | `school_event_registration` waitlist_pos=1 | Parent | SMS, Email, App |
| Event reminder | Scheduled job (days before) | Registered | SMS, Email, App |
| Event cancelled | `school_event` status=cancelled | Registered | SMS, Email, App, Notice |
| PTM slots open | `school_ptm_schedule` status=booking_open | Parents of class | SMS, Email, App, Notice |
| PTM booking confirmed | `school_ptm_booking` created | Parent, Teacher | SMS, Email, App |
| PTM reminder | Scheduled job (1 day before) | Parent, Teacher | SMS, Email, App |
| Photo approved | `school_gallery_media` approved=true | Uploader | App, Email |
| Gallery new album | `school_gallery_album` created | Target audience | App, Notice |

---

## 10. Audit & Retention

**Tables:** `school_events_audit`, `school_events_notification`

**Audit Actions:**
- Event create/update/delete
- Registration create/update
- Attendance mark
- PTM schedule/slot/booking/remarks
- Album/media create/approve/delete
- Settings change

**Retention Settings (configurable):**
| Data | Default Retention |
|---|---|
| Event registrations | 3 years |
| Attendance records | 5 years |
| PTM bookings | 3 years |
| PTM remarks | 5 years |
| Gallery media | 7 years |
| Notification logs | 2 years |
| Audit logs | 7 years |

**Privacy:**
- Student names masked in exports for non-admins
- Parent contact info not in participant exports
- Gallery media with student faces → require consent for public

---

## 11. Module Linking

| From Module | To Module | Link Field |
|---|---|---|
| Events | Communication | `school_event` → notification triggers |
| Events | Students | `school_event_registration.student_id` |
| Events | Staff | `school_event.organizer_id`, `school_ptm_slot.teacher_id` |
| Events | Calendar | `school_event.start_dt` avoids `school_calendar_event` |
| PTM | Students | `school_ptm_booking.student_id` |
| PTM | Staff | `school_ptm_slot.teacher_id` |
| Gallery | Events | `school_gallery_album.event_id` |
| Gallery | Files | `school_gallery_media.file_id` |