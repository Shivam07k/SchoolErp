# Learning Management System — Integration Points

---

## 1. Students Master

| Source | Use |
|---|---|
| `school_students.id` | Learner identity across enrollments, submissions, attempts, progress |
| `first_name`, `last_name`, `admission_no` | Display, search, reports |
| `gender` | Future: differentiated content/paths |
| `class_id`, `section_id` | Bulk enrollment, class heatmap, learning path targeting |
| `guardian_name`, `guardian_phone`, `guardian_email` | Parent portal access, notifications, weekly digest |
| `status` | Only `active` students may enroll, submit, attempt |
| `deleted_at` | Deleted students excluded from all LMS views |

No student columns are modified. LMS reads only. Enrollment table is source of truth for course access.

---

## 2. Academic Structure

| Source | Use |
|---|---|
| `school_class.id`, `name` | Course targeting, bulk enrollment, class progress heatmap |
| `school_section.id`, `name` | Section-level enrollment, reports |
| `school_subject.id`, `name`, `code` | Course-subject link, question bank filter, competency mapping |
| `school_academic_year.id`, `name`, `start_date`, `end_date` | Course year, enrollment validity, scheduling |
| `school_term.id`, `name`, `start_date`, `end_date` | Course term, due dates, grading periods |
| `school_class_subject` (or `school_subject_class`) | Valid class-subject combinations for course creation |

Course creation validates that `class_id` + `subject_id` is a valid combination.
Enrollment auto-filters students by class/section/year/term.

---

## 3. Staff & Teacher Assignment

| Source | Use |
|---|---|
| `school_staff.id`, `first_name`, `last_name`, `employee_id` | Teacher identity, assignment, evaluation `evaluated_by` |
| `school_staff.designation` | Filter for teacher roles |
| `school_staff.status` | Only `active` staff assignable |
| `school_staff.department_id` | Subject-department alignment |

`school_lms_course_teacher` links course → staff with role.
Permission checks: teacher can only manage content for assigned courses.
HR leave/attendance does not affect LMS; substitute handling is manual.

---

## 4. Timetable

| Source | Use |
|---|---|
| `school_timetable_slot.id`, `class_id`, `section_id`, `subject_id`, `teacher_staff_id`, `day_of_week`, `period`, `start_time`, `end_time` | Context for "live" sessions, suggested release times, conflict detection |

Integration points:
- Course schedule (`school_lms_course.schedule`) can reference timetable slots.
- Assignment/quiz release can suggest "next period for this subject".
- Future: auto-create "classwork" assignments from timetable.
- No write-back to timetable from LMS.

---

## 5. Exams & Assessments

| Source | Use |
|---|---|
| `school_exam.id`, `name`, `type`, `academic_year_id`, `term_id` | Link summative quizzes to formal exams |
| `school_exam_paper.id`, `exam_id`, `subject_id`, `date`, `max_marks`, `duration_minutes` | Quiz can be created from exam paper; results feed exam marks |
| `school_exam_result` | LMS quiz scores can pre-fill or sync with exam results |

Behaviour:
- Quiz type `exam` can be linked to `school_exam_paper` via `settings.exam_paper_id`.
- On quiz publish/grade, option to push scores to `school_exam_result`.
- Exam module remains source of truth for report cards; LMS is formative/practice layer.
- Exam timetable can block LMS quiz schedules (prevent conflict).

---

## 6. Calendar

| Source | Use |
|---|---|
| `school_calendar_event.id`, `title`, `event_type`, `start_date`, `end_date`, `is_holiday`, `class_ids`, `section_ids` | Due date validation, holiday-aware scheduling, auto-release |

Integration:
- Assignment/quiz due dates warn if falling on holiday/vacation.
- `release_at` can be set to "next working day" via calendar.
- Course publish can auto-create calendar events for key dates.
- Calendar events with `event_type = 'exam'` block quiz scheduling.
- Future: vacation-aware progress targets.

---

## 7. Fees & Accounts

| Source | Use |
|---|---|
| `school_fee_head.id`, `name`, `type` | Paid course access: fee head type `course` or `lms` |
| `school_invoice`, `school_invoice_line` | Course enrollment gated by payment |
| `school_receipt`, `school_receipt_allocation` | Verify payment status |
| `school_concession_type`, `school_fine_rule` | Discounts on paid courses |

Behaviour:
- Course can have `fee_head_id` and `course_fee` in `settings`.
- Enrollment checks: if course has fee, student must have paid invoice for that fee head in current year/term.
- Free courses: no fee head required.
- Fee collection screen unchanged; LMS only reads payment status.
- No accounting entries from LMS.

---

## 8. Attendance

| Source | Use |
|---|---|
| `school_attendance`, `school_attendance_register` | Correlation: attendance vs LMS engagement |
| `school_leave` | Student leave dates → auto-extend assignment due dates |

Integration:
- LMS never writes to attendance.
- Teacher view: show attendance % alongside LMS progress.
- Approved leave (`school_leave.status = 'approved'`) extends assignment due date by leave days (configurable).
- Quiz due dates respect leave (optional per quiz setting).
- Future: "classwork" assignment auto-marked complete if student present in period.

---

## 9. Notifications & Communication

| Source | Use |
|---|---|
| `school_notification`, `school_notification_recipient` | Delivery channel for LMS alerts |
| `school_communication_template` | Templates for assignment due, quiz release, grade published, progress alert |
| `school_automation_rule` | Trigger rules: "assignment due in 24h → notify student/parent" |

LMS creates notification records via `writeNotification(pool, req, { ... })` from `server/src/school/foundation.js`.
Types: `assignment_released`, `assignment_due_soon`, `assignment_overdue`, `grade_published`, `quiz_released`, `quiz_results_available`, `progress_alert`, `material_released`.
Delivery: in-app, email, SMS, push (handled by existing infrastructure).

---

## 10. Audit

| Source | Use |
|---|---|
| `school_audit_log` (via `writeAudit`) | Every sensitive LMS action |

Audited actions:
- Course publish/archive, chapter/topic publish
- Assignment publish, grade publish/correct
- Quiz publish, result release, manual grade adjust
- Material publish, version update
- Enrollment create/drop/complete
- Teacher assignment add/remove
- Learning path create/enroll
- Competency mapping change
- Progress alert acknowledge
- Settings change

Roll calls not applicable; submissions, attempts, access logs are immutable rows; corrections create audit entries and keep original.

---

## 11. Inventory & Assets (optional)

| Source | Use |
|---|---|
| `school_inv_asset` | Lab equipment, kits linked to practical assignments |
| `school_inv_asset_issue` | Issue tracking for assignment materials |

Integration:
- Assignment type `practical` / `lab_report` can reference `asset_ids` in `settings`.
- Teacher checks availability before scheduling.
- No write-back; inventory module manages stock.

---

## 12. Parent Portal

| Source | Use |
|---|---|
| `school_students.guardian_*` | Parent access to child's LMS data |
| `school_parent_portal_access` (if exists) | Permission toggle |

Parent views (read-only):
- My Assignments: upcoming, submitted, graded
- Quiz Results: scores, pass/fail
- Progress Dashboard: overall %, competency radar
- Material Access: what child viewed, time spent
- Alerts: at-risk notifications
- Weekly digest email (via automation)

No write access for parents.

---

## 13. Privacy and Retention

- Student PII (admission_no, guardian_phone) masked in list exports.
- Role-based access: student (own), parent (child), teacher (assigned classes), admin (all).
- Retention settings (in `school_lms_setting` or `school_setting`):
  - `retention_submission_days` (default 2555 = 7 years)
  - `retention_attempt_days` (default 2555)
  - `retention_access_log_days` (default 365)
  - `retention_analytics_snapshot_days` (default 1095)
- Cleanup job (cron) enforces retention; anonymizes rather than deletes where referential integrity needed.
- Photos/files referenced by URL only; LMS does not store binaries.
- SCORM/Content packages served via signed URLs with expiry.

---

## 14. Offline & Sync

- Quiz attempts: `source = 'offline'` flag, `ip_address`, `user_agent` captured.
- Offline attempt stored locally (IndexedDB) → sync when online via `/attempts/:id/sync`.
- Material access: heartbeat queued offline → batch sync.
- Assignment draft: auto-save to localStorage → submit when online.
- Sync conflicts: server wins; local changes preserved in `conflict_data` JSONB.
- Teacher can force "offline mode" for class (e.g., exam hall) → all attempts marked `source = 'offline'`.