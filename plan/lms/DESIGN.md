# Learning Management System (LMS) — Design

**Version 1.0** · 4 November 2026

---

## 1. Purpose and scope

This document describes a simple, fast and reliable Learning Management System for the school ERP. It reads students, teachers and classes from the Student, Staff and Academic modules, posts marks through the Exam module, uses the Timetable module for scheduling, and keeps in step with the school calendar.

**Submodules:** Courses, Assignments, Quizzes, Study Materials, Progress.

### Requirements

- Teachers create and manage courses with chapters, topics and learning objectives mapped to the curriculum.
- Assignments are created with due dates, rubrics and submission tracking; late submissions follow policy.
- Quizzes draw from a question bank with multiple question types, auto-grading and attempt limits.
- Study materials support documents, images, videos and links, organized by course and topic.
- Progress tracking shows course completion, assignment scores, quiz performance and learning gaps.
- Child safety and privacy are built in; sensitive actions are audited.
- Every common scenario is covered without making the module complex.

**Out of scope for the first release:** live virtual classrooms, AI-powered adaptive learning, LTI/SCORM integration, discussion forums, peer review, gamification (badges, leaderboards), certificate generation, mobile app offline sync, and third-party content marketplace. These are noted in Section 13 for future phases.

---

## 2. Recommended solution in brief

1. Model courses as Course → Subject → Chapter → Topic hierarchy with teacher assignments.
2. Keep assignments as effective-dated tasks linked to topics, with submissions timestamped and evaluated against rubrics.
3. Build quizzes from a tagged question bank; each attempt is a snapshot with auto-grading where possible.
4. Store study materials as versioned assets linked to courses and topics with access controls.
5. Calculate progress from completed topics, assignment scores, quiz results and time spent.
6. Require a reason and approver for every exception (late submission, extra attempt, grade override).
6. Build in the order of the five screens: Courses, Assignments, Quizzes, Study Materials, Progress.

---

## 3. What other school ERPs do

Reviewed public descriptions of school LMS modules:

- **Google Classroom / Microsoft Teams for Education:** class stream, assignments with rubrics, quiz forms, material library, gradebook, guardian summaries, integration with docs and meet.
- **Canvas / Moodle:** modules, assignments, quizzes with question banks, pages/files, outcomes, analytics, LTI, SCORM.
- **PowerSchool Schoology:** courses, assignments, assessments, resources, mastery, parent access.
- **Indian ERPs (Edumerge, Entab, MyClassboard, Fedena):** chapter-wise content, homework/assignments, online tests, e-content library, progress reports, parent app.
- **Orell / MasterSoft:** lesson plans, digital content, assignments, quizzes, performance tracking, remedial alerts.

**Conclusion.** The common pattern is course → content → assessment → progress. This design follows it and keeps curriculum mapping, rubric types and grading policies as settings because they vary by board and school.

---

## 4. Core design

### 4.1 Course structure

```
Course (e.g., "Grade 10 Mathematics")
  └── Subject (e.g., "Algebra", "Geometry") — mapped to curriculum code
      └── Chapter (e.g., "Quadratic Equations")
          └── Topic (e.g., "Factorization", "Quadratic Formula")
              ├── Learning Objectives
              ├── Study Materials
              ├── Assignments
              └── Quizzes
```

A course belongs to an academic year and class/section. Teachers are mapped to subjects. Students are enrolled via class/section.

### 4.2 Assignment lifecycle

1. **Draft** — teacher creates assignment, sets due date, rubric, allowed file types, max submissions.
2. **Published** — visible to enrolled students; notifications sent.
3. **Open for submission** — students submit files/text/links; each submission is timestamped.
4. **Closed** — after due date (+ grace period if configured); late submissions marked.
5. **Evaluated** — teacher grades against rubric; marks posted to Exam module.
6. **Returned** — feedback and marks visible to student and parent.

### 4.3 Quiz engine

1. **Question Bank** — questions tagged by subject, chapter, topic, difficulty, bloom level, type (MCQ, MSQ, True/False, Fill, Short, Long, Code, File upload).
2. **Quiz Builder** — select questions (manual or random from tags), set time limit, attempt limit, shuffle, show/hide answers, passing score.
3. **Attempt** — student starts; timer runs server-side; answers saved per question; auto-submit on timeout.
4. **Evaluation** — auto-grade for objective types; teacher grades subjective; marks posted to Exam module.
5. **Review** — after configured delay, student sees correct answers and explanations.

### 4.4 Study material library

- Assets: PDF, DOCX, PPTX, images, video (MP4/WebM, streamed), audio, external links (YouTube, Vimeo, Drive).
- Versioned: each upload creates a new version; previous versions retained.
- Tagged by course, subject, chapter, topic.
- Access: enrolled students, assigned teachers, parents (read-only), admins.
- Analytics: view count, completion (for video/audio), download count.

### 4.5 Progress tracking

For each student in a course:
- **Topic completion** — marked when student views all materials and attempts linked assessments.
- **Assignment score** — weighted average of evaluated assignments.
- **Quiz score** — weighted average of best/last quiz attempts per topic.
- **Overall progress** — configurable formula (e.g., 30% topics, 35% assignments, 35% quizzes).
- **Learning gaps** — topics with score below threshold flagged for remedial action.

---

## 5. Why this is fast and reliable

**Speed.** The data is moderate. For example, 1,000 students × 6 subjects × 10 chapters × 5 topics = 300,000 topic enrollments. Assignments and quizzes per topic are few. A teacher grading 30 submissions takes minutes. Queries are indexed by course, student, date.

| Risk | Protection |
|---|---|
| Student submits after deadline | Server-side timestamp; late flag; policy blocks or penalizes |
| Teacher grades wrong student | Submission linked to enrollment; teacher sees only their courses |
| Quiz answers leaked | Answers hidden until review window; attempt snapshot immutable |
| Extra quiz attempts | Attempt counter checked server-side; override needs approval |
| Grade changed after publish | Grade override requires reason and approver; audit log |
| Unauthorized course access | Enrollment checked on every read; RBAC on write |
| Large video uploads | Chunked upload; streaming; CDN-ready paths |
| Duplicate question in bank | Tag-based search; duplicate detection on create |
| Progress calculation drift | Recalculated on demand; stored snapshot for reports |
| Bad import | Validate first, row-wise errors, save only if clean |

---

## 6. Data model

### 6.1 Courses

| Table | Key fields |
|---|---|
| Course | academic_year, class, section, name, code, description, status |
| Subject | course, name, code, curriculum_code, teacher, display_order |
| Chapter | subject, name, code, description, display_order, learning_outcomes |
| Topic | chapter, name, code, description, display_order, estimated_hours, objectives (JSON) |
| CourseTeacher | subject, teacher, role (primary, co-teacher), from, to |
| Enrollment | student, course, subject, enrolled_date, status |

### 6.2 Assignments

| Table | Key fields |
|---|---|
| Assignment | topic, title, description, instructions, due_date, grace_hours, max_submissions, allowed_types, max_file_size, rubric_id, status, published_at |
| Rubric | name, criteria (JSON: criterion, weight, levels), total_marks |
| Submission | assignment, student, content (text/files/links), submitted_at, is_late, attempt_no |
| Evaluation | submission, teacher, criterion_scores (JSON), total_marks, feedback, evaluated_at, status |
| AssignmentAttachment | submission, file_path, original_name, mime_type, size |

### 6.3 Quizzes

| Table | Key fields |
|---|---|
| Question | subject, chapter, topic, type, stem, options (JSON), correct_answer, explanation, difficulty, bloom_level, tags, status, created_by |
| Quiz | topic, title, description, time_limit_min, max_attempts, shuffle_questions, shuffle_options, show_answers_after, passing_score, status, published_at |
| QuizQuestion | quiz, question, marks, display_order |
| QuizAttempt | quiz, student, started_at, submitted_at, score, status, ip_address |
| AttemptAnswer | attempt, question, student_answer, is_correct, marks_awarded, teacher_feedback, graded_by, graded_at |
| QuestionTag | question, tag (e.g., "CBSE", "HOTS", "NCERT_Ex1.2") |

### 6.4 Study Materials

| Table | Key fields |
|---|---|
| Material | topic, title, description, type (document, video, audio, link, embed), source_url, file_path, mime_type, size, duration_sec, version, status, uploaded_by |
| MaterialView | material, student, viewed_at, progress_percent (for video/audio), completed |
| MaterialDownload | material, student, downloaded_at |

### 6.5 Progress

| Table | Key fields |
|---|---|
| TopicProgress | student, topic, status (not_started, in_progress, completed), completed_at, time_spent_sec |
| CourseProgress | student, course, subject, overall_percent, topic_percent, assignment_percent, quiz_percent, last_calculated |
| LearningGap | student, topic, gap_type (low_quiz, low_assignment, not_attempted), severity, identified_at, resolved_at |

### 6.6 System tables

Notification, AuditLog, Setting, User and Role (shared with foundation).

---

## 7. Rules and policies

### Hard rules (always blocked)

- Students accessing courses they are not enrolled in.
- Teachers managing courses/subjects they are not assigned to.
- Assignment submissions without server-side timestamps.
- Late submissions when policy blocks them (grace period exhausted).
- Quiz answers visible before the configured review window.
- Exceeding maximum quiz attempts without approved override.
- Changing published quiz results or assignment marks without authorization and audit trail.
- Assignment marks posted to Exam module without a linked evaluation.
- Deleting a question used in a published quiz.
- Publishing a quiz with zero questions.

### Soft rules (warn only)

- Low assignment submission rate for a class (< 70%).
- High quiz failure rate for a topic (> 50% below passing).
- Incomplete study material coverage (topic with no materials).
- Course progress calculation anomalies (percent > 100 or < 0).
- Teacher has not published any assignment in 2 weeks.
- Student has not attempted any quiz in a subject for 3 weeks.

### Policy settings the school can change

| Setting | Options |
|---|---|
| Curriculum mapping | Board codes (CBSE, ICSE, State, IB, Cambridge), custom codes |
| Assignment late policy | Block / allow with penalty (percentage per day) / allow no penalty |
| Grace period | Minutes/hours after due date |
| Rubric types | Analytic, holistic, single-point, custom JSON schema |
| Quiz attempt policy | Best score / last score / average of all |
| Quiz review window | Immediately / after deadline / after manual release / never |
| Question types enabled | Per school; default all |
| Passing score default | Percentage; overridable per quiz |
| Progress formula | Weights for topics, assignments, quizzes; per subject overridable |
| Learning gap threshold | Score below X% triggers gap |
| Material types allowed | Per school; default all |
| Video completion threshold | Percentage watched to mark complete |
| Parent access level | View only / view + download / none |
| Data retention | Days to keep submissions, attempt logs, view logs |

---

## 8. Screens

1. **Courses** — Course/Subject/Chapter/Topic tree with drag-drop reorder. Teacher mapping panel. Curriculum code editor. Bulk import from CSV (course, subject, chapter, topic). Enrollment sync from Academic module.
2. **Subject Detail** — Chapters and topics grid. Per-topic: learning objectives, material count, assignment count, quiz count. Quick actions: add material, create assignment, build quiz.
3. **Assignment Builder** — Form with due date, grace, rubric picker/builder, allowed types, file size. Preview student view. Clone from another topic/course. Schedule publish.
4. **Assignment List** — Filter by course, subject, status (draft, published, closed). Submission counts, late counts, evaluated counts. Bulk actions: extend deadline, reopen.
5. **Submission Review** — Split view: student list with submission status; selected submission with content viewer, rubric scorer, feedback box. Keyboard shortcuts for speed. Bulk grade with same score/feedback.
6. **Question Bank** — Searchable, filterable table (subject, chapter, topic, type, difficulty, tags). Inline create/edit. Bulk tag. Import from CSV/Excel (stem, options, answer, explanation, tags). Duplicate detection.
7. **Quiz Builder** — Two-pane: question bank (left) and quiz canvas (right). Drag questions. Random block: pick N from tag filter. Settings panel: time, attempts, shuffle, review window, passing score. Preview as student.
8. **Quiz Monitor** — Live attempts: student, started, time remaining, questions answered. Force-submit. View completed attempts with scores. Regrade subjective questions.
9. **Attempt Review (Student)** — After review window: question, student answer, correct answer, explanation, marks. Flag for teacher review.
10. **Study Material Library** — Grid/list by topic. Upload (chunked for large files). Version history. Replace file (new version). External link with embed preview. Bulk download as ZIP.
11. **Material Detail** — Viewer: PDF in-browser, video player with resume, audio player, image zoom. Access log: who viewed, when, completion. Download button (if permitted).
12. **Progress Dashboard (Teacher)** — Class-level: topic completion heatmap, assignment score distribution, quiz score trend, learning gaps list. Drill to student. Export CSV.
13. **Progress Dashboard (Student/Parent)** — My courses: circular progress per subject. Topic checklist. Upcoming assignments. Recent quiz scores. Gap alerts. Time spent chart.

---

## 9. Workflows

### 9.1 Course setup to delivery

1. Admin creates course for academic year, links class/section.
2. HOD adds subjects, maps curriculum codes, assigns teachers.
3. Teachers build chapter/topic structure with objectives.
4. Teachers upload study materials per topic.
5. Teachers create assignments and quizzes per topic.
6. Students access via enrolled courses; parents see in portal.
7. Progress auto-calculates; gaps flagged; teacher intervenes.

### 9.2 Assignment workflow

1. Teacher creates assignment in draft, sets rubric, schedules publish.
2. On publish, notifications to students and parents.
3. Student submits (multiple files/text/links allowed up to max).
4. System timestamps; late flag if past due+grace.
5. Teacher evaluates against rubric; saves draft; publishes marks.
6. Marks pushed to Exam module as assignment component.
7. Student/parent sees feedback and marks.

### 9.3 Quiz workflow

1. Teacher builds quiz from question bank; publishes.
2. Student starts attempt; server timer begins; answers auto-saved.
3. On submit or timeout, objective questions auto-graded.
4. Subjective questions queued for teacher grading.
5. Teacher grades subjective; final score computed.
6. After review window, student sees review with explanations.
7. Marks pushed to Exam module as quiz component.

### 9.4 Progress calculation

1. Nightly job (or on-demand) recalculates CourseProgress for all enrollments.
2. TopicProgress: completed when all materials viewed (video > threshold) AND at least one assignment submitted AND at least one quiz attempted for that topic.
3. Weights applied per policy; overall percent stored.
4. LearningGap rows created/updated for topics below threshold.
5. Teacher dashboard refreshes; parent/student portal updates.

### 9.5 Links with other modules

| Module | What flows |
|---|---|
| Student | Enrollment, class/section, parent contacts for notifications |
| Staff | Teacher assignments, user accounts, permissions |
| Academic | Academic year, class/section, curriculum codes, subject master |
| Timetable | Period mapping for topic pacing; assignment due dates avoid exam weeks |
| Exam | Assignment and quiz marks posted as components; progress feeds report cards |
| Calendar | Holidays/vacations exclude from due dates; academic year boundaries |
| Communication | Notifications for publish, due soon, graded, gap alerts |
| Fees | Course fees (if separate) — future |

### Accounting entries (when course fees apply)

| Event | Debit | Credit |
|---|---|---|
| Course fee invoiced | Fees receivable | Course fee income |
| Course fee paid | Bank/Cash | Fees receivable |
| Course fee concession | Fee concession expense | Fees receivable |
| Refund on withdrawal | Fees receivable | Bank/Cash |

---

## 10. Roles, alerts and reports

### Roles

| Role | Allowed actions |
|---|---|
| Super admin | Setup, policies, all access |
| Principal | View all, approve overrides, progress review |
| Academic coordinator | Course/subject structure, curriculum mapping, teacher mapping |
| Subject teacher | Own subjects: topics, materials, assignments, quizzes, evaluation, progress |
| Co-teacher | Assist: materials, assignments, evaluation (no publish quiz) |
| Student | Enrolled courses: view materials, submit assignments, attempt quizzes, view progress |
| Parent | Own children: view materials (read), assignments, quiz results, progress, gaps |
| Exam coordinator | Receive marks from LMS; verify before report card |
| Auditor | Read-only access to all LMS data and audit logs |

### Alerts

| Event | Who is notified |
|---|---|
| Assignment published | Enrolled students, parents |
| Assignment due in 24h | Students with no submission, parents |
| Assignment overdue | Student, parent, teacher |
| Submission received | Teacher |
| Evaluation published | Student, parent |
| Quiz published | Enrolled students, parents |
| Quiz attempt started/completed | Teacher (optional) |
| Quiz results released | Student, parent |
| Learning gap identified | Teacher, parent (configurable) |
| Progress below threshold | Teacher, parent, academic coordinator |
| Material uploaded | Enrolled students (optional digest) |
| Grade override requested | Approver (HOD/Principal) |
| Bulk import completed/failed | Initiator |

### Reports

1. **Course Coverage** — Topics completed vs planned per subject/class.
2. **Assignment Summary** — Submission rate, average score, late rate per assignment/class.
3. **Quiz Performance** — Attempt count, score distribution, question analysis (difficulty, discrimination) per quiz.
4. **Student Progress** — Per student: overall %, topic checklist, assignment avg, quiz avg, gaps.
5. **Class Progress Heatmap** — Grid: students × topics, colored by status/score.
6. **Learning Gaps** — Topics with >30% students below threshold; suggested remedial.
7. **Material Usage** — Views, completions, downloads per material; unused materials.
8. **Teacher Workload** — Assignments created, quizzes built, submissions evaluated per teacher.
9. **Audit Trail** — All publish, grade, override, delete actions with user, time, reason.

---

## 11. Scenario coverage

The Step column refers to the build plan in section 12.

### 11.1 Courses

| Scenario | How it is handled | Step |
|---|---|---|
| New academic year | Clone course structure; update year; re-enroll | 1 |
| Split/merge sections | Enrollment sync from Academic; topic progress preserved | 1 |
| Teacher change mid-year | CourseTeacher end date + new record; materials stay | 1 |
| Curriculum update | Curriculum code on subject/chapter; versioned | 1 |
| Elective subjects | Separate course per elective; optional enrollment | 1 |
| Multi-teacher subject | Co-teacher role; shared edit rights on drafts | 1 |
| Topic reorder | Drag-drop; display_order updated | 1 |
| Archive old course | Status = archived; read-only; progress retained | 1 |

### 11.2 Assignments

| Scenario | How it is handled | Step |
|---|---|---|
| Differentiated assignment | Separate assignment per group; linked to same topic | 2 |
| Group assignment | One submission per group; all members get same grade | 2 |
| Peer review | Not in v1; flagged for later | Later |
| Rubric with custom levels | Rubric JSON schema supports any levels | 2 |
| Offline submission (paper) | Teacher creates submission on behalf; marked offline | 2 |
| Resubmission allowed | Max submissions > 1; latest graded by default | 2 |
| Plagiarism check | Not in v1; integration point for later | Later |
| Parent acknowledges | Not in v1; notification only | 2 |

### 11.3 Quizzes

| Scenario | How it is handled | Step |
|---|---|---|
| Formative quiz (unlimited practice) | Max attempts = 0 (unlimited); no marks posted | 3 |
| Summative quiz (graded) | Max attempts = 1; marks posted to Exam | 3 |
| Adaptive quiz | Not in v1; question bank tags enable later | Later |
| Proctored quiz | Not in v1; IP log, full-screen, tab-switch detect later | Later |
| Offline quiz (paper) | Teacher enters scores manually; creates attempt record | 3 |
| Extra attempt for illness | Override with reason and approver; audit logged | 3 |
| Regrade after key error | Teacher edits question correct_answer; regrade job | 3 |
| Quiz password | Not in v1; publish timing controls access | 3 |

### 11.4 Study Materials

| Scenario | How it is handled | Step |
|---|---|---|
| Large video (2GB) | Chunked upload; streaming via signed URL; CDN | 4 |
| YouTube/Drive link | Embed preview; track clicks as views | 4 |
| Replace wrong file | New version; old retained; students see latest | 4 |
| Material for parents only | Visibility flag; students don't see | 4 |
| SCORM package | Not in v1; upload as ZIP; player later | Later |
| Accessibility (captions, alt text) | Fields on material; video captions file upload | 4 |
| Copyright / DRM | Not in v1; watermark on PDF later | Later |

### 11.5 Progress

| Scenario | How it is handled | Step |
|---|---|---|
| Transfer student joins mid-term | Enrollment date; prior progress not imported (manual entry if needed) | 5 |
| Remedial class | Teacher marks gap resolved; LearningGap resolved_at | 5 |
| Parent wants detailed report | Export Student Progress report (PDF/CSV) | 5 |
| Progress weight change mid-year | New formula applies prospectively; history unchanged | 5 |
| Topic skipped by teacher | Teacher marks topic "optional"; excluded from denominator | 5 |
| Board exam prep mode | Filter topics by tag "board_exam"; separate progress view | 5 |

---

## 12. Build plan

| Step | Deliverable | Done when |
|---|---|---|
| 1. LMS Courses | Courses, subjects, chapters, topics, teacher mapping, curriculum codes, enrollment sync, import/export | Course tree built; teachers assigned; students enrolled |
| 2. Assignments | Assignment builder, rubric engine, submission portal, evaluation UI, marks push to Exam, late policy, notifications | Teachers create/grade; students submit; marks flow to Exam |
| 3. Quizzes | Question bank, quiz builder, attempt engine, auto-grade, subjective grading, review window, marks push to Exam | Quizzes run; scores flow to Exam; review works |
| 4. Study Materials | Upload (chunked), versioning, viewer (PDF, video, audio), external links, access control, analytics | Materials uploaded; students view; usage tracked |
| 5. Progress | Topic progress, course progress, learning gaps, dashboards (teacher, student, parent), export, nightly job | Progress calculates; gaps flagged; dashboards render |
| 6. Reports & Hardening | 9 reports, roles/permissions, audit log, settings, data retention, import validation, performance indexes, test coverage | Inspector can run all reports; roles enforced; audits pass |

---

## 13. Open decisions

1. **Curriculum:** Which boards (CBSE, ICSE, State, IB, Cambridge)? Custom curriculum codes?
2. **Grading:** Marks vs grades vs both? Rubric score to percentage mapping?
3. **Assignment policy:** Late penalty percentage per day? Grace period default? Max submissions default?
4. **Quiz policy:** Default attempt limit? Review window default? Shuffle default? Passing score default?
5. **Progress formula:** Default weights (topics/assignments/quizzes)? Per-subject override process?
6. **Learning gap threshold:** Default percentage? Auto-resolve when score improves?
7. **Material types:** Allow all by default? Block executable files? Max file size default?
8. **Video hosting:** Self-hosted vs CDN (Bunny, Cloudflare, AWS)? Signed URL TTL?
9. **Parent access:** View materials? Download? See quiz questions after review?
10. **Notifications:** Email, SMS, in-app, push? Digest frequency? Opt-out per type?
11. **Data retention:** How long keep submissions, attempt logs, view logs, old versions?
12. **Integration with Exam:** Assignment/quiz as separate components or merged? Weight in final report card?
13. **Timetable link:** Auto-create assignment due dates from timetable? Avoid exam weeks?
14. **Offline sync:** Mobile app offline submission/attempt? Conflict resolution?
15. **Accessibility:** WCAG level target? Screen reader testing? Caption requirements?
16. **Multi-language:** UI only or content too? RTL support?
17. **Backup/Restore:** Course content backup? Point-in-time restore?
18. **Analytics depth:** Heatmaps, cohort comparison, predictive alerts?
19. **Third-party content:** Integration with NCERT, DIKSHA, Khan Academy, others?

---

## 14. Out of scope (v1)

- Live virtual classrooms (Zoom/Meet/Teams integration)
- AI-powered adaptive learning paths
- LTI/SCORM/xAPI compliance
- Discussion forums and peer collaboration
- Peer review workflows
- Gamification (badges, leaderboards, streaks)
- Certificate generation
- Mobile app offline synchronization
- Third-party content marketplace
- Plagiarism detection (Turnitin, Copyleaks integration)
- Proctoring (webcam, browser lockdown)
- Advanced analytics (predictive, cohort, ML-based)
- Multi-tenancy (school groups, franchises)
- White-labeling / theming per school

---

## 15. Performance, Security, Reliability

### Performance

- Indexes on: enrollment(student, course), submission(assignment, student), attempt(quiz, student), progress(student, course), material(topic).
- Pagination on all lists (default 20, max 100).
- Chunked upload for files > 50MB; streaming for video.
- Material views/use materialized view for dashboard queries.
- Nightly progress job batched by course; idempotent.

### Security

- RBAC on every endpoint; enrollment check on read; teacher assignment check on write.
- File upload: type whitelist, size limit, virus scan (ClamAV), stored outside webroot, signed URLs for access.
- Quiz answers never sent to client before review window; attempt snapshot stored server-side.
- Audit log on: publish, grade, override, delete, permission change, bulk import.
- PII: student names, parent contacts masked in logs; export requires permission.
- CSP headers; XSS protection on rich text (DOMPurify).

### Reliability

- Idempotent submission (client token prevents double-submit).
- Quiz attempt: answers saved per question; recover on network loss.
- Progress calculation: transactional; rollback on error; re-runnable.
- Soft delete on courses, assignments, quizzes, materials; purge after retention.
- Backup: daily DB, weekly file storage; point-in-time recovery tested quarterly.
- Health checks: DB, file storage, queue workers, scheduled jobs.

---

## 16. Scenario Coverage tables (cross-module)

### 16.1 Communication

| Scenario | LMS touchpoint | Handled in |
|---|---|---|
| Assignment published notification | Push to student/parent | Communication module |
| Grade published notification | Push with deep link to feedback | Communication module |
| Quiz results released | Push with score summary | Communication module |
| Learning gap alert | Digest to teacher/parent | Communication module |
| Material available | Optional daily digest | Communication module |
| Parent queries teacher | Thread linked to assignment/quiz | Communication module |

### 16.2 LMS (self)

| Scenario | Handled in |
|---|---|
| Teacher creates course structure | Step 1 |
| Student submits assignment | Step 2 |
| Auto-graded quiz | Step 3 |
| Video material streaming | Step 4 |
| Progress dashboard | Step 5 |

### 16.3 Events

| Scenario | LMS touchpoint | Handled in |
|---|---|---|
| Annual day / sports day | Assignment due dates avoid event week | Timetable/Calendar |
| Exam schedule published | Quiz/assignment scheduling respects exam block | Timetable/Exam |
| PTM | Progress report generated for parent meeting | Progress + Communication |

### 16.4 Certificates

| Scenario | LMS touchpoint | Handled in |
|---|---|---|
| Course completion certificate | Not in v1; progress data available for Certificates module | Later |
| Quiz mastery badge | Not in v1; gamification out of scope | Later |

### 16.5 Alumni

| Scenario | LMS touchpoint | Handled in |
|---|---|---|
| Alumni accesses old course material | Read-only archive; progress retained | Data retention policy |
| Alumni transcript includes LMS progress | Progress data exported to transcript | Exam/Report card |

---

## 17. Build Strategy

**Phase 1 (Weeks 1-3):** Core schema, Courses screen, enrollment sync, teacher mapping, import/export.

**Phase 2 (Weeks 4-6):** Assignments — builder, rubric, submission, evaluation, Exam push, notifications.

**Phase 3 (Weeks 7-9):** Quizzes — question bank, builder, attempt engine, auto-grade, subjective grading, review, Exam push.

**Phase 4 (Weeks 10-12):** Study Materials — upload, versioning, viewers, links, analytics, access control.

**Phase 5 (Weeks 13-15):** Progress — calculation engine, gaps, dashboards (teacher, student, parent), exports.

**Phase 6 (Weeks 16-18):** Reports (9), roles hardening, audit, settings, retention, performance indexes, test matrix, documentation.

**Phase 7 (Week 19):** UAT, bug fix, deploy to staging, train admins/teachers, go-live.

**Parallel tracks:** UI components (shared), notification templates, API contracts, permission matrix, migration scripts.

---

*End of document*