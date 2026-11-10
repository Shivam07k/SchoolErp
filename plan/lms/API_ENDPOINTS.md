# Learning Management System — API Endpoints

All endpoints are under `/api/school/lms`. The router is mounted in
`server/src/index.js` **before** `schoolCompRouter` so the richer LMS
handlers are not shadowed by the legacy module.

Authentication: `Authorization: Bearer <token>`. Tenant scope comes from
`req.school.appId`.

---

## Permissions

| Permission | Used for |
|---|---|
| `lms.view` | All GET endpoints (scoped to own data for students/parents) |
| `lms.manage` | Superset for all write endpoints |
| `lms.teach` | Manage own course content, evaluate, view class progress |
| `lms.grade` | Publish/change grades, manual quiz grading |
| `lms.reports` | Reports and exports |
| `lms.audit` | Audit and retention settings |

---

## 1. Courses, Chapters, Topics

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/courses` | view | List courses (filter: class, section, subject, year, term, status) |
| POST | `/courses` | manage | Create course |
| GET | `/courses/:id` | view | Course detail with chapter/topic tree |
| PUT | `/courses/:id` | manage | Update course |
| DELETE | `/courses/:id` | manage | Soft-delete/archive course |
| POST | `/courses/:id/publish` | manage | Publish course |
| POST | `/courses/:id/enroll` | manage | Bulk enroll by class/section/student list |
| GET | `/courses/:id/enrollments` | view | List enrollments with progress |
| PUT | `/courses/:id/enrollments/:enrollmentId` | manage | Update enrollment status (drop/complete) |
| GET | `/courses/:id/teachers` | view | Teacher assignments |
| POST | `/courses/:id/teachers` | manage | Assign teacher |
| DELETE | `/courses/:id/teachers/:teacherId` | manage | Remove teacher assignment |
| GET | `/chapters` | view | List chapters (filter: course) |
| POST | `/chapters` | manage/teach | Create chapter |
| GET | `/chapters/:id` | view | Chapter detail with topics |
| PUT | `/chapters/:id` | manage/teach | Update chapter |
| DELETE | `/chapters/:id` | manage/teach | Delete chapter |
| POST | `/chapters/:id/reorder` | manage/teach | Reorder chapters |
| GET | `/topics` | view | List topics (filter: chapter) |
| POST | `/topics` | manage/teach | Create topic |
| GET | `/topics/:id` | view | Topic detail |
| PUT | `/topics/:id` | manage/teach | Update topic |
| DELETE | `/topics/:id` | manage/teach | Delete topic |
| POST | `/topics/:id/reorder` | manage/teach | Reorder topics |
| GET | `/courses/:id/tree` | view | Full course → chapter → topic tree |
| GET | `/my-courses` | view | Student/teacher enrolled/assigned courses |

### Hard rules enforced here
- Only `active` students can be enrolled.
- Enrollment respects class/section and academic year/term.
- Teacher must be active staff.
- Publish requires at least one chapter with published topics.

---

## 2. Assignments

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/assignments` | view | List assignments (filter: course, chapter, status, due date) |
| POST | `/assignments` | teach | Create assignment |
| GET | `/assignments/:id` | view | Assignment detail with files |
| PUT | `/assignments/:id` | teach | Update assignment |
| DELETE | `/assignments/:id` | teach | Archive assignment |
| POST | `/assignments/:id/publish` | teach | Publish assignment |
| GET | `/assignments/:id/files` | view | Attachment files |
| POST | `/assignments/:id/files` | teach | Upload attachment |
| DELETE | `/assignments/:id/files/:fileId` | teach | Remove attachment |
| POST | `/assignments/:id/submit` | view | Student submission (creates attempt_no) |
| GET | `/assignments/:id/submissions` | teach | List submissions (filter: status, student) |
| GET | `/submissions/:id` | view/teach | Submission detail with files and evaluation |
| POST | `/submissions/:id/files` | view | Upload submission files |
| POST | `/submissions/:id/evaluate` | teach | Evaluate with marks, feedback, rubric |
| GET | `/submissions/:id/evaluation` | view/teach | Evaluation detail |
| PUT | `/submissions/:id/evaluation` | grade | Update evaluation (draft only) |
| POST | `/submissions/:id/evaluation/publish` | grade | Publish grade |
| POST | `/submissions/:id/evaluation/correct` | grade | Correct published grade with reason |
| POST | `/submissions/:id/return` | teach | Return to student for revision |
| POST | `/submissions/:id/resubmit` | view | Student resubmission (if allowed) |
| GET | `/my-assignments` | view | Student view: upcoming, submitted, graded |
| GET | `/assignments/:id/rubric` | view | Rubric template |
| POST | `/assignments/:id/rubric` | teach | Save rubric template |

### Hard rules enforced here
- Only enrolled students can submit.
- Submission after `due_at` → `is_late = true`; penalty per `late_policy`.
- Resubmission only if `allow_resubmission` and `attempt_no < max_resubmissions`.
- Teacher must be assigned to course (`school_lms_course_teacher`).
- Evaluation: draft → published is one-way; correction requires reason and audit.
- File size ≤ `max_file_size_mb`; type in `allowed_file_types` if specified.

---

## 3. Question Bank

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/questions` | view | Question bank (filter: subject, chapter, topic, type, difficulty, status, tags) |
| POST | `/questions` | teach | Create question |
| GET | `/questions/:id` | view | Question detail with options |
| PUT | `/questions/:id` | teach | Update question |
| DELETE | `/questions/:id` | teach | Archive question |
| POST | `/questions/bulk-import` | teach | Import from CSV/JSON |
| POST | `/questions/:id/clone` | teach | Clone question |
| GET | `/questions/:id/options` | view | Options for MCQ types |
| POST | `/questions/:id/options` | teach | Add option |
| PUT | `/questions/:id/options/:optionId` | teach | Update option |
| DELETE | `/questions/:id/options/:optionId` | teach | Remove option |
| GET | `/questions/stats` | teach | Usage stats per question (times used, avg score, discrimination) |

### Question types and auto-grade
- `mcq_single`, `mcq_multi`, `true_false`, `fill_blank`, `matching`, `ordering` → auto-graded
- `short_answer`, `essay`, `hotspot`, `drag_drop` → manual grade required

---

## 4. Quizzes

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/quizzes` | view | List quizzes (filter: course, chapter, type, status) |
| POST | `/quizzes` | teach | Create quiz |
| GET | `/quizzes/:id` | view | Quiz detail with questions |
| PUT | `/quizzes/:id` | teach | Update quiz |
| DELETE | `/quizzes/:id` | teach | Archive quiz |
| POST | `/quizzes/:id/publish` | teach | Publish quiz |
| GET | `/quizzes/:id/questions` | view | Ordered question list for attempt |
| POST | `/quizzes/:id/questions` | teach | Add question(s) to quiz |
| DELETE | `/quizzes/:id/questions/:questionId` | teach | Remove question from quiz |
| POST | `/quizzes/:id/questions/reorder` | teach | Reorder quiz questions |
| POST | `/quizzes/:id/start` | view | Start attempt (student) — returns attempt_id |
| GET | `/attempts/:id` | view | Attempt detail with questions (answers hidden if in_progress) |
| POST | `/attempts/:id/answer` | view | Save answer (auto-save, idempotent by question_id) |
| POST | `/attempts/:id/submit` | view | Submit and auto-grade objective questions |
| GET | `/attempts/:id/review` | view | Student review: answers, correct, explanation, marks |
| GET | `/quizzes/:id/attempts` | teach | All attempts for quiz (filter: student, status) |
| POST | `/attempts/:id/grade` | grade | Manual grade for non-auto questions |
| PUT | `/attempts/:id/answers/:answerId` | grade | Adjust marks for specific answer |
| GET | `/quizzes/:id/analytics` | teach | Item analysis: difficulty, discrimination, distractor analysis |
| POST | `/quizzes/:id/duplicate` | teach | Duplicate quiz to another course/chapter |

### Hard rules enforced here
- Only enrolled students can attempt.
- `attempt_no` ≤ `max_attempts`.
- Timer server-side; expiry at `started_at + time_limit_minutes` auto-submits.
- `due_at` hard cutoff: no new attempts after due_at.
- Auto-grade for objective types; manual grade for subjective.
- Results visibility per `show_results`:
  - `immediate`: after submit
  - `after_deadline`: after `due_at`
  - `manual`: after teacher publishes
  - `never`: students never see results
- Once submitted, answers immutable; only manual grade adjusts marks.

---

## 5. Study Materials

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/materials` | view | List materials (filter: course, chapter, topic, folder, type, published) |
| POST | `/materials` | teach | Create material (upload or link) |
| GET | `/materials/:id` | view | Material detail with access info |
| PUT | `/materials/:id` | teach | Update material |
| DELETE | `/materials/:id` | teach | Archive material |
| POST | `/materials/:id/publish` | teach | Publish material |
| POST | `/materials/:id/access` | view | Record access/heartbeat (progress, position) |
| GET | `/materials/:id/access` | teach | Access logs for material |
| POST | `/materials/:id/bookmark` | view | Student bookmark |
| GET | `/materials/:id/bookmark` | view | Get student bookmark |
| GET | `/folders` | view | List folders (filter: course, parent) |
| POST | `/folders` | teach | Create folder |
| GET | `/folders/:id` | view | Folder detail with children |
| PUT | `/folders/:id` | teach | Update folder |
| DELETE | `/folders/:id` | teach | Delete folder (recursive) |
| POST | `/folders/:id/reorder` | teach | Reorder folders |
| GET | `/folders/:id/tree` | view | Folder tree for course |
| GET | `/my-materials` | view | Student view with progress per material |
| GET | `/materials/:id/stats` | teach | Engagement: views, unique students, avg duration, completion rate |

### Access control
- `access_level = 'enrolled'` → only enrolled students
- `access_level = 'public'` → anyone with link
- `access_level = 'teacher_only'` → course teachers only
- `access_level = 'parent'` → parents of enrolled students
- `is_published = false` → only teachers see
- `release_at` / `expiry_at` time window enforced

---

## 6. Progress Tracking & Learning Paths

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/progress/student/:studentId` | view | Student progress across all courses |
| GET | `/progress/course/:courseId` | teach | Course progress for all enrolled students |
| GET | `/progress/student/:studentId/course/:courseId` | view | Detailed student-course progress (chapters, topics, activities) |
| GET | `/progress/student/:studentId/competencies` | view | Competency mastery report |
| GET | `/progress/class/:classId/section/:sectionId` | teach | Class heatmap |
| POST | `/progress/sync` | teach | Recalculate progress from activities |
| GET | `/progress/export` | reports | CSV export of progress data |
| GET | `/learning-paths` | view | List learning paths |
| POST | `/learning-paths` | manage | Create learning path |
| GET | `/learning-paths/:id` | view | Path detail with steps |
| PUT | `/learning-paths/:id` | manage | Update path |
| DELETE | `/learning-paths/:id` | manage | Delete path |
| GET | `/learning-paths/:id/steps` | view | Path steps with courses |
| POST | `/learning-paths/:id/steps` | manage | Add step (course + unlock condition) |
| PUT | `/learning-paths/:id/steps/:stepId` | manage | Update step |
| DELETE | `/learning-paths/:id/steps/:stepId` | manage | Remove step |
| POST | `/learning-paths/:id/enroll` | manage | Enroll students (by class/section/list) |
| GET | `/learning-paths/:id/enrollments` | view | Path enrollments with progress |
| GET | `/competencies` | view | List competencies (filter: subject) |
| POST | `/competencies` | manage | Create competency |
| GET | `/competencies/:id/mappings` | view | Competency → activity mappings |
| POST | `/competencies/:id/mappings` | manage | Map competency to course/chapter/topic/assignment/quiz |
| GET | `/alerts` | teach | Progress alerts for teacher/admin |
| POST | `/alerts/:id/acknowledge` | teach | Acknowledge alert |
| GET | `/alerts/student/:studentId` | view | Alerts for specific student |

### Unlock conditions (JSONB)
```json
{
  "type": "all_previous" | "specific_steps" | "score_threshold" | "date",
  "steps": [1, 2],
  "min_score_pct": 70,
  "unlock_at": "2026-01-15T00:00:00Z"
}
```

---

## 7. Reports and Settings

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/reports/enrollment` | reports | Course enrollment and completion rates |
| GET | `/reports/assignments` | reports | Submission and grading statistics |
| GET | `/reports/quizzes` | reports | Quiz attempt analytics |
| GET | `/reports/materials` | reports | Material engagement |
| GET | `/reports/progress` | reports | Student progress (individual/cohort) |
| GET | `/reports/competencies` | reports | Competency mastery by class/section |
| GET | `/reports/learning-paths` | reports | Learning path completion |
| GET | `/reports/teacher-workload` | reports | Assignments created, evaluations pending |
| GET | `/reports/at-risk` | reports | At-risk student list |
| GET | `/reports/audit` | audit | Sensitive action audit trail |
| GET | `/settings` | view | Policy settings |
| PUT | `/settings` | manage | Update policy settings |

### Default policy settings

| Key | Default |
|---|---|
| `allow_late_submission` | `true` |
| `default_late_penalty_pct` | `10` |
| `default_grace_hours` | `24` |
| `quiz_auto_submit_on_expiry` | `true` |
| `show_quiz_results_default` | `immediate` |
| `material_access_tracking` | `true` |
| `progress_auto_calc` | `true` |
| `alert_inactivity_days` | `7` |
| `alert_low_score_pct` | `40` |
| `retention_submission_days` | `2555` |
| `retention_attempt_days` | `2555` |
| `retention_access_log_days` | `365` |