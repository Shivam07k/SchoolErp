# Learning Management System — Test Scenarios

**Legend:** ✅ expected pass · ⛔ expected block · ⚠️ warning only

---

## A. Course Hierarchy

| # | Scenario | Expected |
|---|---|---|
| A1 | Create course with valid class/subject/year/term | Saved, appears in catalog |
| A2 | Create course with invalid class-subject combo | ⛔ validation error |
| A3 | Publish course with no chapters | ⛔ requires at least one published chapter |
| A4 | Add chapter to published course | Chapter created as draft |
| A5 | Publish chapter with no topics | ⚠️ allowed but warned |
| A6 | Add topic with prerequisites from same chapter | Saved, prerequisite enforced in player |
| A7 | Reorder chapters via drag-drop | Sequence updated, persists |
| A8 | Reorder topics across chapters | ⛔ not allowed |
| A9 | Archive course with active enrollments | ⛔ block or warn; enrollments must be dropped first |
| A10 | Soft-delete chapter with topics | Topics also soft-deleted |
| A11 | Bulk enroll class/section into course | All active students enrolled, progress 0% |
| A12 | Enroll inactive student | ⛔ blocked |
| A13 | Drop enrolled student with submissions | ⚠️ allowed with confirmation; submissions retained |
| A14 | Assign teacher not in subject department | ⚠️ warning only |
| A15 | Assign same teacher as primary and co-teacher | ⛔ unique constraint |
| A16 | Student views course tree | Only published chapters/topics visible |
| A17 | Teacher views own course tree | All chapters/topics including drafts |
| A18 | Course schedule JSON validation | Invalid JSON rejected |

---

## B. Assignments

| # | Scenario | Expected |
|---|---|---|
| B1 | Create assignment with all types (homework, project, essay, practical) | Saved with type-specific defaults |
| B2 | Publish assignment with past due date | ⚠️ allowed, shows overdue immediately |
| B3 | Student submits before release_at | ⛔ not visible to student |
| B4 | Student submits after due_at (late_policy = penalty) | Submitted, `is_late=true`, penalty calculated |
| B5 | Student submits after due_at (late_policy = hard_cutoff) | ⛔ submission rejected |
| B6 | Student submits after due_at (late_policy = grace_period) | Submitted, no penalty if within grace |
| B7 | Resubmission allowed, student resubmits | New attempt_no, previous retained |
| B8 | Resubmission not allowed, student tries | ⛔ blocked |
| B9 | Max resubmissions reached | ⛔ blocked |
| B10 | File upload exceeds max_file_size_mb | ⛔ rejected with error |
| B11 | File type not in allowed_file_types | ⛔ rejected |
| B12 | Teacher evaluates with rubric | Marks auto-sum, feedback saved as draft |
| B13 | Teacher publishes grade | Student sees grade, grade immutable |
| B14 | Teacher corrects published grade | Requires reason, audit entry, student notified |
| B15 | Teacher returns for revision | Status `returned`, student can resubmit |
| B16 | Non-assigned teacher tries to evaluate | ⛔ 403 |
| B17 | Student views own submission | Sees content, files, status, evaluation (if published) |
| B18 | Parent views child's assignment | Sees status, grade (if published), no content |
| B19 | Bulk download submission files | ZIP with student-named folders |
| B20 | Export grades CSV | Columns: student, admission_no, marks, grade, feedback, submitted_at |

---

## C. Question Bank

| # | Scenario | Expected |
|---|---|---|
| C1 | Create MCQ single with 4 options, 1 correct | Saved, auto-grade enabled |
| C2 | Create MCQ multi with 2+ correct | Saved, partial credit per option |
| C3 | Create true/false | Saved |
| C4 | Create fill_blank with 3 accepted answers | Saved, case-insensitive by default |
| C5 | Create short_answer with sample answer | Saved, manual grade required |
| C6 | Create essay with rubric | Saved |
| C7 | Create matching with 5 pairs | Saved, auto-grade |
| C8 | Create ordering with 6 items | Saved, auto-grade |
| C9 | Question with invalid option count (MCQ single < 2) | ⛔ validation |
| C10 | Question with no correct option (MCQ) | ⛔ validation |
| C11 | Bulk import CSV with 50 questions | All imported, usage_count = 0 |
| C12 | Bulk import with duplicate stem | ⚠️ skip or update per option |
| C13 | Clone question | New question with copied content, new ID |
| C14 | Filter bank by subject, chapter, type, difficulty, tags | Results match all filters |
| C15 | Archive question used in published quiz | ⚠️ allowed, quiz still works |
| C16 | Delete question not in any quiz | Hard delete |
| C17 | Question stats: used in 3 quizzes, avg score 65% | Stats computed correctly |
| C18 | Tag-based search | Returns questions with any selected tag |

---

## D. Quizzes

| # | Scenario | Expected |
|---|---|---|
| D1 | Create practice quiz, no time limit, unlimited attempts | Saved |
| D2 | Create summative quiz, 60 min, 1 attempt, due date | Saved |
| D3 | Publish quiz with no questions | ⛔ blocked |
| D4 | Student starts attempt before release_at | ⛔ not available |
| D5 | Student starts attempt after due_at | ⛔ blocked |
| D6 | Student starts 2nd attempt (max_attempts=1) | ⛔ blocked |
| D7 | Timer expires during attempt | Auto-submit, status `expired`, answers graded |
| D8 | Student closes browser mid-attempt | Status `abandoned`, can resume if time left |
| D9 | Auto-grade MCQ single/multi/true_false/fill_blank/matching/ordering | Marks awarded, `auto_graded=true` |
| D10 | Short answer/essay require manual grade | `auto_graded=false`, marks 0 until graded |
| D11 | Teacher manually grades subjective | Marks updated, `graded_by`, `graded_at` set |
| D12 | show_results = immediate | Student sees review after submit |
| D13 | show_results = after_deadline | Review locked until due_at passes |
| D14 | show_results = manual | Review locked until teacher publishes |
| D15 | show_results = never | Student never sees review |
| D16 | Student reviews with correct answers shown | Sees own answer, correct, explanation, marks |
| D17 | Student reviews with correct answers hidden | Sees own answer, marks only |
| D18 | Shuffle questions enabled | Different order per attempt |
| D19 | Shuffle options enabled | Different order per attempt per question |
| D20 | Passing score 70%, student scores 65% | Pass/fail = fail, shows in review |
| D21 | Analytics: difficulty index (p-value) per question | Computed from all attempts |
| D22 | Analytics: discrimination index | Point-biserial correlation computed |
| D23 | Duplicate quiz to another course | New quiz with copied questions, new IDs |
| D24 | Offline attempt sync | `source=offline`, answers synced, graded |

---

## E. Study Materials

| # | Scenario | Expected |
|---|---|---|
| E1 | Upload PDF, auto-detect pages | Material created, page count in metadata |
| E2 | Upload video, auto-detect duration | Duration saved, thumbnail generated |
| E3 | Add YouTube link as embed | Material type `embed`, iframe preview |
| E4 | Upload SCORM package | Manifest parsed, launch URL stored |
| E5 | Create folder hierarchy 3 levels deep | Tree renders correctly |
| E6 | Move material between folders | Folder_id updated, tree refreshes |
| E7 | Publish material with future release_at | Visible to teachers, hidden from students until release |
| E8 | Material expiry_at passed | Status `expired`, hidden from students |
| E9 | Access level = enrolled, unenrolled student tries | ⛔ 403 |
| E10 | Access level = public, anonymous tries | ⛔ auth required but no enrollment check |
| E11 | Access level = teacher_only, student tries | ⛔ 403 |
| E12 | Student opens PDF, scrolls 50% | Heartbeat sends progress_pct=50 |
| E13 | Student watches video to 80% | Heartbeat sends progress_pct=80 |
| E14 | SCORM package reports completion | `completed_at` set, progress_pct=100 |
| E15 | Student bookmarks page 5 of PDF | Bookmark saved with position_data |
| E16 | Teacher views material stats | Views, unique students, avg duration, completion % |
| E17 | Version upload (replace file) | Version incremented, old file accessible via history |
| E18 | Bulk upload 20 PDFs | All created, auto-assigned to folder |
| E19 | Student "Continue Learning" jumps to next incomplete | Correct material opened |
| E20 | Download material (if allowed) | File served with signed URL |

---

## F. Progress & Learning Paths

| # | Scenario | Expected |
|---|---|---|
| F1 | Student completes all topics in chapter | Chapter status `completed`, progress 100% |
| F2 | Student scores 90% on quiz, mastery threshold 80% | Topic mastery `proficient` |
| F3 | Student inactive 7 days (alert_inactivity_days=7) | Alert `inactivity` created, severity `warning` |
| F4 | Student scores 35% on assignment (alert_low_score_pct=40) | Alert `low_score` created, severity `critical` |
| F5 | Teacher acknowledges alert | `acknowledged_at`, `acknowledged_by` set |
| F6 | Learning path with unlock_condition: all_previous | Step 2 locked until step 1 completed |
| F7 | Learning path with unlock_condition: score_threshold (70%) | Next step unlocks only after 70% on quiz |
| F8 | Learning path with unlock_condition: date | Step unlocks on unlock_at regardless of progress |
| F9 | Enroll class in learning path | All students enrolled, progress tracked per step |
| F10 | Competency mapped to quiz and assignment | Mastery calculated from both evidence |
| F11 | Student mastery: 3 evidence, scores 80, 85, 90 | Mastery_pct = 85, level `proficient` |
| F12 | Progress sync recalculates from activities | Progress matches actual submissions/attempts/access |
| F13 | Class heatmap: 30 students × 10 topics | Grid renders, colors match status |
| F14 | Export progress CSV | All students, all courses, chapter/topic/activity progress |
| F15 | At-risk report: students with >2 alerts | Listed with alert details |

---

## G. Permissions & Audit

| # | Scenario | Expected |
|---|---|---|
| G1 | `lms.view` user opens course catalog | Read-only, no create/edit |
| G2 | `lms.teach` user creates assignment in own course | ✅ |
| G3 | `lms.teach` user creates assignment in other's course | ⛔ 403 |
| G4 | `lms.manage` user creates course | ✅ |
| G5 | `lms.grade` user publishes grade | ✅ |
| G6 | `lms.view` user tries to publish grade | ⛔ 403 |
| G7 | `lms.reports` user accesses reports | ✅ |
| G8 | `lms.audit` user accesses audit report | ✅ |
| G9 | Course publish → audit entry | Action `course.publish`, before/after status |
| G10 | Grade correction → audit entry | Action `grade.correct`, reason, before/after marks |
| G11 | Quiz result release → audit entry | Action `quiz.release_results` |
| G12 | Material publish → audit entry | Action `material.publish` |
| G13 | Enrollment drop → audit entry | Action `enrollment.drop`, reason |
| G14 | Teacher assignment add → audit entry | Action `teacher.assign` |
| G15 | Learning path create → audit entry | Action `learning_path.create` |
| G16 | Competency mapping change → audit entry | Action `competency.map`, before/after |
| G17 | Alert acknowledge → audit entry | Action `alert.acknowledge` |
| G18 | Settings change → audit entry | Action `settings.update`, key, before/after |

---

## H. Integration Points

| # | Scenario | Expected |
|---|---|---|
| H1 | Course with fee_head, unpaid student enrolls | ⛔ blocked, payment required |
| H2 | Course with fee_head, paid student enrolls | ✅ enrolled |
| H3 | Assignment due on holiday (calendar) | ⚠️ warning on create, auto-extend option |
| H4 | Student on approved leave, assignment due | Due extended by leave days |
| H5 | Quiz linked to exam paper, scores sync | Exam result pre-filled |
| H6 | Timetable slot exists for course subject | Schedule suggestion in course builder |
| H7 | Notification sent on assignment release | `school_notification` record created |
| H8 | Parent views child's progress | Read-only, no edit |
| H9 | Offline quiz attempt in exam hall | `source=offline`, synced after |
| H10 | Retention cleanup runs | Submissions > 7y anonymized, access logs > 1y deleted |

---

## Automation Structure

```
tests/lms/
├── courses.test.js           # A1–A18
├── assignments.test.js       # B1–B20
├── questions.test.js         # C1–C18
├── quizzes.test.js           # D1–D24
├── materials.test.js         # E1–E20
├── progress.test.js          # F1–F15
├── permissions.test.js       # G1–G18
└── integration.test.js       # H1–H10
```

Each test seeds its own course/chapter/topic/student/teacher fixture, calls the API
with a role-scoped token, and asserts both the HTTP response and the database
state. Destructive cases run inside a transaction that is rolled back.