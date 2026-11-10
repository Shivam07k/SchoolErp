# Learning Management System — Build Plan

**Version 1.0** · Based on `DESIGN.md` · 4 November 2026

---

## Overview

The module is built in six sequential steps plus one optional later step. Each step delivers working, testable functionality.

**Dependencies**

- Students master (`school_students`, class, section, guardian fields)
- Academic (`school_class`, `school_section`, `school_subject`, `school_academic_year`, `school_term`)
- Staff (`school_staff` for teachers, subject assignments)
- Timetable (`school_timetable_slot` for period context)
- Exams (`school_exam`, `school_exam_paper` for quiz/exam linkage)
- Calendar (`school_calendar_event` for due dates, schedules)
- Fees (`school_fee_head`, `school_invoice` for paid course access)

**Migration files:** `sql/85_lms_core.sql`, `sql/86_lms_ops.sql`.

**Backend router:** `server/src/routes/school_lms.js`, mounted at `/api/school` **before** the legacy `school_comprehensive.js` router.

**Frontend routes:** `/school/lms/courses`, `/school/lms/assignments`, `/school/lms/quizzes`, `/school/lms/materials`, `/school/lms/progress`, `/school/lms/reports`.

---

## Step 1: Courses, Chapters, Topics

**Target:** Complete course hierarchy with publishing, scheduling, enrollment and teacher assignment.

### Database

- `school_lms_course` — course, code, subject, class/section, teacher, academic year/term, status (draft, published, archived), schedule, credits
- `school_lms_course_chapter` — chapter under course, sequence, title, description, estimated hours, release date, status
- `school_lms_course_topic` — topic under chapter, sequence, title, description, duration minutes, learning objectives, prerequisites, status
- Course enrollment: `school_lms_course_enrollment` — student, course, enrolled_at, status (enrolled, dropped, completed), progress_pct
- Teacher assignment: `school_lms_course_teacher` — course, teacher_staff_id, role (primary, co-teacher, ta), assigned_at

### Backend API (`/api/school/lms/*`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/courses` | GET/POST | List/create courses |
| `/courses/:id` | GET/PUT/DELETE | Course detail/update/archive |
| `/courses/:id/publish` | POST | Publish course |
| `/courses/:id/enroll` | POST | Enroll students (bulk by class/section) |
| `/courses/:id/enrollments` | GET | List enrollments |
| `/courses/:id/teachers` | GET/POST | Teacher assignments |
| `/chapters` | GET/POST | List/create chapters |
| `/chapters/:id` | GET/PUT/DELETE | Chapter detail/update/delete |
| `/chapters/:id/reorder` | POST | Reorder chapters |
| `/topics` | GET/POST | List/create topics |
| `/topics/:id` | GET/PUT/DELETE | Topic detail/update/delete |
| `/topics/:id/reorder` | POST | Reorder topics |
| `/courses/:id/tree` | GET | Full course → chapter → topic tree |
| `/my-courses` | GET | Student/teacher view of enrolled/assigned courses |

### Frontend Screens

| Screen | File | Route |
|---|---|---|
| Course Catalog | `Courses.jsx` (tab) | `/school/lms/courses` |
| Course Builder | `Courses.jsx` (tab) | — |
| Chapter Manager | `Courses.jsx` (tab) | — |
| Topic Manager | `Courses.jsx` (tab) | — |
| Enrollment Dashboard | `Courses.jsx` (tab) | — |

### Permission

- `lms.view` — read courses, chapters, topics
- `lms.manage` — create/edit course hierarchy, enroll, assign teachers
- `lms.teach` — manage own course content

### Done When

- Every course shows complete chapter/topic tree.
- Students see only published courses they are enrolled in.
- Teachers see courses they are assigned to.
- Enrollment respects class/section and academic year/term.

---

## Step 2: Assignments

**Target:** Assignment creation, submission, evaluation with rubrics, deadlines and late policies.

### Database

- `school_lms_assignment` — assignment, course_id, chapter_id, topic_id, title, description, type (homework, project, essay, practical), max_marks, weightage, release_at, due_at, late_policy (none, penalty_pct_per_day, hard_cutoff), allow_resubmission, max_resubmissions, status (draft, published, closed)
- `school_lms_assignment_file` — assignment_id, file_url, file_name, file_size, uploaded_by, uploaded_at
- `school_lms_assignment_submission` — assignment_id, student_id, content_text, submitted_at, status (submitted, late, resubmitted, graded, returned), attempt_no, is_late
- `school_lms_assignment_submission_file` — submission_id, file_url, file_name, file_size
- `school_lms_assignment_evaluation` — submission_id, evaluated_by, marks_obtained, feedback, rubric_scores (JSONB), evaluated_at, status (draft, published), grade

### Backend API

| Endpoint | Method | Purpose |
|---|---|---|
| `/assignments` | GET/POST | List/create assignments |
| `/assignments/:id` | GET/PUT/DELETE | Assignment detail/update/archive |
| `/assignments/:id/publish` | POST | Publish assignment |
| `/assignments/:id/files` | GET/POST | Attachment files |
| `/assignments/:id/submit` | POST | Student submission |
| `/assignments/:id/submissions` | GET | List submissions (teacher view) |
| `/submissions/:id` | GET | Submission detail with files |
| `/submissions/:id/files` | POST | Upload submission files |
| `/submissions/:id/evaluate` | POST | Evaluate with marks, feedback, rubric |
| `/submissions/:id/evaluation` | GET/PUT | Evaluation detail/update |
| `/submissions/:id/return` | POST | Return to student |
| `/submissions/:id/resubmit` | POST | Student resubmission |
| `/my-assignments` | GET | Student view: upcoming, submitted, graded |
| `/assignments/:id/rubric` | GET/POST | Rubric template for assignment |

### Frontend Screens

| Screen | File | Route |
|---|---|---|
| Assignment List | `Assignments.jsx` (tab) | `/school/lms/assignments` |
| Assignment Builder | `Assignments.jsx` (tab) | — |
| Submission Inbox | `Assignments.jsx` (tab) | — |
| Evaluation Workbench | `Assignments.jsx` (tab) | — |
| Student Assignment Dashboard | `Assignments.jsx` (tab) | — |

### Hard rules enforced by API

- Only enrolled students can submit.
- Submission after due_at marks `is_late = true`; penalty applied per policy.
- Resubmission allowed only if `allow_resubmission` and `attempt_no < max_resubmissions`.
- Teacher must be assigned to course to evaluate.
- Evaluation draft → published is one-way; published grades are immutable without correction audit.

### Done When

- Students submit and see status (submitted/late/graded).
- Teachers evaluate with rubric, return feedback.
- Late penalty auto-calculated.
- Grades flow to progress tracking.

---

## Step 3: Quizzes & Question Bank

**Target:** Question bank with categories, quiz assembly, timed attempts, auto-grading, review.

### Database

- `school_lms_question_bank` — question, subject_id, chapter_id, topic_id, type (mcq_single, mcq_multi, true_false, fill_blank, short_answer, essay, matching, ordering), difficulty (easy, medium, hard), marks, stem, explanation, tags (JSONB), status (draft, approved, archived), created_by
- `school_lms_question_option` — question_id, option_text, is_correct, sequence, feedback
- `school_lms_quiz` — quiz, course_id, chapter_id, title, description, type (practice, formative, summative, exam), time_limit_minutes, max_attempts, shuffle_questions, shuffle_options, show_results (immediate, after_deadline, manual), release_at, due_at, passing_score_pct, status (draft, published, closed)
- `school_lms_quiz_question` — quiz_id, question_id, marks_override, sequence
- `school_lms_quiz_attempt` — quiz_id, student_id, started_at, submitted_at, time_spent_seconds, score, max_score, status (in_progress, submitted, graded, abandoned), attempt_no
- `school_lms_quiz_answer` — attempt_id, question_id, answer_data (JSONB), marks_awarded, auto_graded (boolean), graded_by, graded_at

### Backend API

| Endpoint | Method | Purpose |
|---|---|---|
| `/questions` | GET/POST | Question bank list/create |
| `/questions/:id` | GET/PUT/DELETE | Question detail/update/archive |
| `/questions/bulk-import` | POST | Import from CSV/JSON |
| `/questions/:id/options` | GET/POST | Options for MCQ |
| `/quizzes` | GET/POST | List/create quizzes |
| `/quizzes/:id` | GET/PUT/DELETE | Quiz detail/update/archive |
| `/quizzes/:id/publish` | POST | Publish quiz |
| `/quizzes/:id/questions` | GET/POST | Add/remove/reorder questions |
| `/quizzes/:id/start` | POST | Start attempt (student) |
| `/attempts/:id` | GET | Attempt detail with questions |
| `/attempts/:id/answer` | POST | Save answer (auto-save) |
| `/attempts/:id/submit` | POST | Submit and auto-grade |
| `/attempts/:id/review` | GET | Student review (answers, correct, explanation) |
| `/quizzes/:id/attempts` | GET | Teacher view: all attempts |
| `/attempts/:id/grade` | POST | Manual grade for non-auto questions |
| `/question-bank/stats` | GET | Usage stats per question |

### Frontend Screens

| Screen | File | Route |
|---|---|---|
| Question Bank | `Quizzes.jsx` (tab) | `/school/lms/quizzes` |
| Quiz Builder | `Quizzes.jsx` (tab) | — |
| Quiz Player (Student) | `Quizzes.jsx` (tab) | — |
| Attempt Review | `Quizzes.jsx` (tab) | — |
| Quiz Analytics | `Quizzes.jsx` (tab) | — |

### Hard rules enforced by API

- Only enrolled students can attempt.
- Attempt count ≤ `max_attempts`.
- Timer server-side; expiry auto-submits.
- Auto-grade for mcq_single, mcq_multi, true_false, fill_blank, matching, ordering.
- Manual grade required for short_answer, essay.
- Results visibility per `show_results` setting.
- Once submitted, answers immutable; only manual grade can adjust marks.

### Done When

- Question bank supports all types with options.
- Quizzes enforce time limits and attempt limits.
- Auto-grading works for objective types.
- Students review with explanations after results released.
- Analytics show item analysis (difficulty, discrimination).

---

## Step 4: Study Materials

**Target:** Rich content library with folders, versioning, access control, engagement tracking.

### Database

- `school_lms_study_material` — material, course_id, chapter_id, topic_id, folder_id, title, description, type (pdf, video, audio, document, link, embed, scorm, html_package), source_url, file_url, file_size, mime_type, duration_seconds, version, is_published, release_at, expiry_at, access_level (enrolled, public, teacher_only), tags, metadata (JSONB), created_by, created_at, updated_at, deleted_at
- `school_lms_material_folder` — folder, course_id, parent_folder_id, name, sequence, description
- `school_lms_material_access` — material_id, student_id, accessed_at, duration_seconds, progress_pct, completed_at
- `school_lms_material_bookmark` — material_id, student_id, position_data (JSONB), created_at

### Backend API

| Endpoint | Method | Purpose |
|---|---|---|
| `/materials` | GET/POST | List/create materials |
| `/materials/:id` | GET/PUT/DELETE | Material detail/update/archive |
| `/materials/:id/publish` | POST | Publish material |
| `/materials/:id/access` | POST | Record access/heartbeat |
| `/materials/:id/bookmark` | POST/GET | Student bookmark |
| `/folders` | GET/POST | List/create folders |
| `/folders/:id` | GET/PUT/DELETE | Folder detail/update/delete |
| `/folders/:id/tree` | GET | Folder tree for course |
| `/my-materials` | GET | Student view with progress |
| `/materials/:id/stats` | GET | Engagement stats (views, avg duration, completion) |

### Frontend Screens

| Screen | File | Route |
|---|---|---|
| Material Library | `Materials.jsx` (tab) | `/school/lms/materials` |
| Folder Manager | `Materials.jsx` (tab) | — |
| Material Viewer | `Materials.jsx` (tab) | — |
| Student Material Dashboard | `Materials.jsx` (tab) | — |

### Permission

- `lms.view` — read published materials
- `lms.manage` — create/edit folders, upload, publish
- `lms.teach` — manage materials in own courses

### Done When

- Materials organized in folder tree per course.
- Students track progress (video watch %, PDF scroll, SCORM completion).
- Teachers see engagement analytics.
- Access control by enrollment and publish status.

---

## Step 5: Progress Tracking & Learning Path

**Target:** Real-time progress dashboards, competency mapping, learning paths, at-risk alerts.

### Database

- `school_lms_student_progress` — student_id, course_id, chapter_id, topic_id, assignment_id, quiz_id, material_id, activity_type (course, chapter, topic, assignment, quiz, material), status (not_started, in_progress, completed, mastered), score_pct, time_spent_seconds, last_accessed_at, completed_at, mastery_level (novice, developing, proficient, advanced)
- `school_lms_learning_path` — path, name, description, class_id, section_id, subject_id, academic_year_id, is_active
- `school_lms_learning_path_step` — path_id, course_id, sequence, is_required, unlock_condition (JSONB)
- `school_lms_competency` — competency, subject_id, code, description, bloom_level (remember, understand, apply, analyze, evaluate, create)
- `school_lms_competency_mapping` — competency_id, course_id, chapter_id, topic_id, assignment_id, quiz_id, weightage
- `school_lms_student_competency` — student_id, competency_id, mastery_pct, evidence_count, last_updated_at
- `school_lms_progress_alert` — student_id, course_id, alert_type (stuck, falling_behind, missed_deadline, low_score, inactivity), severity (info, warning, critical), message, acknowledged_at, acknowledged_by, created_at

### Backend API

| Endpoint | Method | Purpose |
|---|---|---|
| `/progress/student/:studentId` | GET | Student progress across all courses |
| `/progress/course/:courseId` | GET | Course progress for all enrolled students |
| `/progress/student/:studentId/course/:courseId` | GET | Detailed student-course progress |
| `/progress/student/:studentId/competencies` | GET | Competency mastery report |
| `/learning-paths` | GET/POST | List/create learning paths |
| `/learning-paths/:id` | GET/PUT/DELETE | Path detail/update |
| `/learning-paths/:id/steps` | GET/POST | Path steps |
| `/learning-paths/:id/enroll` | POST | Enroll students in path |
| `/alerts` | GET | Progress alerts for teacher/admin |
| `/alerts/:id/acknowledge` | POST | Acknowledge alert |
| `/progress/sync` | POST | Recalculate progress from activities |
| `/progress/export` | GET | CSV export of progress data |

### Frontend Screens

| Screen | File | Route |
|---|---|---|
| Student Progress Dashboard | `Progress.jsx` (tab) | `/school/lms/progress` |
| Class Progress Heatmap | `Progress.jsx` (tab) | — |
| Competency Tracker | `Progress.jsx` (tab) | — |
| Learning Path Builder | `Progress.jsx` (tab) | — |
| Alert Center | `Progress.jsx` (tab) | — |

### Permission

- `lms.view` — read own progress (student) / class progress (teacher)
- `lms.manage` — build learning paths, configure competencies
- `lms.teach` — view assigned class progress, acknowledge alerts

### Done When

- Heatmap shows chapter/topic completion per student.
- Competency mastery calculated from mapped activities.
- Learning paths enforce prerequisites and unlock conditions.
- Alerts notify teachers of at-risk students in real time.

---

## Step 6: Reports, Analytics & Hardening

**Target:** Inspector-ready reports, role controls, privacy, retention and audit.

### Reports

- Course enrollment and completion rates
- Assignment submission and grading statistics
- Quiz attempt analytics (item analysis, discrimination index)
- Material engagement (views, completion, time spent)
- Student progress reports (individual and cohort)
- Competency mastery by class/section
- Learning path completion
- Teacher workload (assignments created, evaluations pending)
- At-risk student list
- Audit trail of grade changes, content modifications

### Hardening

- Mask student PII in list exports (admission_no, guardian_phone).
- Role-based access: student (own), parent (child), teacher (assigned), admin (all).
- Retention settings for submissions, attempts, access logs, analytics snapshots.
- Audit every sensitive action: course publish, grade publish/change, quiz result release, material publish, competency update, alert acknowledge.
- Submissions, attempts, access logs are immutable; corrections create audit entries.
- Export CSV from every report.
- Offline quiz attempt source flag (`online`, `offline`) and later sync.

### Done When

- An inspector can see enrollment, submissions, quiz results, progress.
- Sensitive actions are audited with before/after.
- Retention and masking settings are enforced.
- All reports export to CSV.

---

## Step 7: Later (optional)

AI-generated quiz questions, adaptive learning paths, LTI integration, SCORM Cloud, video streaming with DRM, peer review, discussion forums, badges/certificates, mobile offline sync, parent portal with weekly digest. Add only when needed.

---

## Permissions

| Permission | Purpose |
|---|---|
| `lms.view` | Read all LMS screens (own data for students/parents) |
| `lms.manage` | Setup, courses, question bank, learning paths, competencies |
| `lms.teach` | Manage own course content, evaluate, view class progress |
| `lms.grade` | Publish/change grades, manual quiz grading |
| `lms.reports` | Reports and exports |
| `lms.audit` | Audit and retention settings |

`lms.manage` is a superset for backward compatibility.