# Learning Management System — Frontend Screens

**Stack:** React + Bootstrap 5, using `PageShell`, `Loading`, `Empty`, `Badge`,
`downloadCsv`, `fmtDate`, `fmtMoney` from `src/pages/school/fee/shared.jsx` and the
`apiGet/apiPost/apiPut/apiDelete` helpers.

All screens live in `src/pages/school/lms/` and are dispatched from
`src/components/SchoolPage.jsx` when `module === 'lms'`.

---

## Routes

| Route | Component | Menu label |
|---|---|---|
| `/school/lms/courses` | `Courses.jsx` | LMS Courses |
| `/school/lms/assignments` | `Assignments.jsx` | Assignments |
| `/school/lms/quizzes` | `Quizzes.jsx` | Quizzes & Question Bank |
| `/school/lms/materials` | `Materials.jsx` | Study Materials |
| `/school/lms/progress` | `Progress.jsx` | Progress & Analytics |
| `/school/lms/reports` | `Reports.jsx` | LMS Reports |

`src/pages/school/lms/shared.jsx` exports the shared LMS helpers:
`canLmsView`, `canLmsManage`, `canLmsTeach`, `canLmsGrade`, `TAB_BUTTON`,
status tone maps, `today`, `weekStart`, `monthStart`, `studentName`, `money`,
`Placeholder`, `ProgressRing`, `DifficultyBadge`, `TypeBadge`.

---

## 1. LMS Courses (`Courses.jsx`)

Tabs: **Catalog**, **Builder**, **Chapters**, **Topics**, **Enrollment**, **Teachers**.

### Catalog Tab
- Filter bar: academic year, term, class, section, subject, status.
- KPI strip: total courses, published, draft, archived, total enrollments.
- Card grid: course code, name, subject, class/section, teacher, status badge, progress avg, actions.
- Actions: View, Edit, Publish, Archive, Duplicate, Delete.
- Create course modal: code, name, description, subject, class/section, year/term, credits, schedule, thumbnail.

### Builder Tab
- Course selector (published courses).
- Left panel: chapter list (draggable reorder).
- Chapter card: title, sequence, status, topic count, estimated hours.
- Add chapter modal: title, description, estimated hours, release date, learning objectives.
- Chapter actions: Edit, Publish/Hide, Delete, Add Topic.

### Chapters Tab (alternate view)
- Table view of all chapters across courses.
- Inline edit: title, sequence, status, release date.
- Bulk publish/hide.

### Topics Tab
- Chapter selector → topic list.
- Topic card: title, sequence, duration, status, objectives, prerequisites.
- Add topic modal: title, description, duration, objectives, prerequisites (multi-select from same chapter).
- Drag-drop reorder.

### Enrollment Tab
- Course selector → enrolled students table.
- Columns: student, admission no, class/section, enrolled date, status, progress %, actions.
- Bulk enroll: pick class/section, filter by subject, confirm.
- Drop/Complete actions with reason.
- CSV export.

### Teachers Tab
- Course selector → assigned teachers.
- Assign teacher modal: staff search, role (primary/co-teacher/ta/grader).
- Remove assignment.

Permission: `lms.view`; writes require `lms.manage` or `lms.teach` (own courses).

---

## 2. Assignments (`Assignments.jsx`)

Tabs: **List**, **Builder**, **Submissions**, **Evaluation**, **My Assignments** (student).

### List Tab
- Filter: course, chapter, type, status, due date range.
- Table: title, course, chapter, type, max marks, weightage, release/due, status, submissions/expected, actions.
- Create assignment modal (see Builder).
- Bulk actions: Publish, Close, Delete.

### Builder Tab
- Step 1: Basics — course, chapter, topic, title, description, type, max marks, weightage.
- Step 2: Schedule — release at, due at, late policy (none/penalty/hard cutoff/grace), penalty %, grace hours.
- Step 3: Submission — allowed types (text/file/both), max file size, allowed extensions, resubmission policy.
- Step 4: Rubric — criterion rows: name, description, max points, levels (excellent/good/fair/poor).
- Preview and publish.

### Submissions Tab (Teacher)
- Assignment selector → submissions table.
- Columns: student, attempt, submitted at, status (submitted/late/resubmitted/graded/returned), late penalty, actions.
- Status badges with tone.
- Filter: status, late only, ungraded only.
- Bulk: Download all files, Export grades CSV.

### Evaluation Tab (Teacher)
- Submission selector (from Submissions tab or direct link).
- Split view: left — submission content/files; right — evaluation panel.
- Rubric scoring: click level per criterion → auto-sum.
- Marks override, feedback textarea (rich text).
- Buttons: Save Draft, Publish Grade, Return for Revision.
- Published grades: show "Correct Grade" with reason modal.

### My Assignments Tab (Student)
- Tabs: **Upcoming**, **Submitted**, **Graded**, **Overdue**.
- Upcoming: cards with due countdown, submit button.
- Submitted: status, late badge, resubmit if allowed.
- Graded: marks, grade, feedback, rubric breakdown.
- File upload with drag-drop, progress bar.

Permission: `lms.view`; writes require `lms.teach` (own courses) or `lms.manage`; grading requires `lms.grade`.

---

## 3. Quizzes & Question Bank (`Quizzes.jsx`)

Tabs: **Question Bank**, **Quiz Builder**, **Quiz Player**, **Attempt Review**, **Analytics**.

### Question Bank Tab
- Filter sidebar: subject, chapter, topic, type, difficulty, status, tags (multi-select).
- Table: stem preview, type badge, difficulty badge, marks, status, usage count, last used, actions.
- Create question modal:
  - Type selector (changes form fields).
  - MCQ: stem, options (add/remove, mark correct, feedback per option), explanation.
  - True/False: stem, correct, explanation.
  - Fill blank: stem with `[blank]`, accepted answers (array), case sensitive toggle.
  - Short answer/Essay: stem, sample answer, rubric.
  - Matching: left/right pairs.
  - Ordering: items to order.
- Bulk import: CSV/JSON template download, upload, preview, confirm.
- Clone question button.

### Quiz Builder Tab
- Quiz list with filter: course, chapter, type, status.
- Create quiz modal:
  - Basics: course, chapter, title, description, type, time limit, max attempts.
  - Behavior: shuffle questions, shuffle options, show results (immediate/after deadline/manual/never), allow review, show correct answers.
  - Schedule: release at, due at, passing score %.
  - Questions: add from bank (multi-select with search/filter), reorder, override marks per question.
- Publish button.

### Quiz Player Tab (Student)
- Available quizzes: cards with type, time limit, attempts left, release/due.
- Start attempt → full-screen player:
  - Header: timer (server-synced), question navigator (1-N, colored by answered/flagged), progress bar.
  - Question area: stem, options/inputs per type.
  - Actions: Flag, Save (auto-save every 10s), Previous/Next, Submit.
  - Warning modal at 5 min, 1 min, auto-submit on expiry.
- Post-submit: score, pass/fail, review link (per `show_results`).

### Attempt Review Tab (Student)
- Attempt selector → review view:
  - Question list with icons: correct/incorrect/partial/unanswered.
  - Per question: student answer, correct answer, explanation, marks awarded.
  - Summary: total score, percentage, time spent, percentile (if enabled).

### Analytics Tab (Teacher)
- Quiz selector → analytics dashboard:
  - Overview: attempts, avg score, pass rate, avg time, reliability (Cronbach's alpha).
  - Item analysis table: question, type, difficulty, discrimination index, p-value, point-biserial, distractor analysis (for MCQ).
  - Student performance: table with score, percentile, time, status.
  - Export CSV.

Permission: `lms.view` (student sees own); writes require `lms.teach` (own courses) or `lms.manage`; manual grading requires `lms.grade`.

---

## 4. Study Materials (`Materials.jsx`)

Tabs: **Library**, **Folders**, **Viewer**, **My Materials** (student).

### Library Tab
- Course selector → folder tree on left, material list on right.
- Material card: icon by type, title, chapter/topic, type badge, size/duration, status, release/expiry, actions.
- Create material modal:
  - Type selector (pdf/video/audio/document/link/embed/scorm/html_package/image).
  - Upload zone (drag-drop, progress) or URL input.
  - Metadata: title, description, chapter, topic, folder, tags, access level, release/expiry.
  - SCORM: upload zip, auto-detect manifest.
  - Video: duration auto-detected, thumbnail upload.
- Bulk upload: multiple files → auto-create materials.
- Actions: Publish/Unpublish, Move to folder, Replace file, Version history, Delete.

### Folders Tab
- Course selector → folder tree (drag-drop reorder, nest).
- Create folder modal: name, parent, description.
- Context menu: rename, move, delete (with contents), permissions.

### Viewer Tab (Student/Teacher)
- Material opens in modal or full page per type:
  - PDF: PDF.js viewer with progress tracking (scroll %).
  - Video: HTML5 player with heartbeat (every 30s), speed, captions, PiP.
  - Audio: HTML5 player with waveform.
  - Document: Office Online/Google Docs viewer or download.
  - Link/Embed: iframe with referrer policy.
  - SCORM: SCORM Cloud player or local runtime, reports completion/score.
  - HTML Package: unzip and serve index.html.
- Header: bookmark button, progress ring, download (if allowed), fullscreen.
- Auto-save position/bookmark.

### My Materials Tab (Student)
- Course tabs → folder tree with progress badges.
- Material list: progress ring (0-100%), status (not started/in progress/completed), last accessed, time spent.
- Filter: all, in progress, completed, bookmarked.
- Continue learning button → jumps to next incomplete.

Permission: `lms.view`; writes require `lms.teach` (own courses) or `lms.manage`.

---

## 5. Progress & Analytics (`Progress.jsx`)

Tabs: **Student Dashboard**, **Class Heatmap**, **Competency Tracker**, **Learning Paths**, **Alerts**.

### Student Dashboard Tab (Student)
- My courses: cards with overall progress ring, next activity, upcoming deadlines.
- Course detail: chapter/topic tree with status icons (locked/in progress/completed/mastered).
- Activity feed: recent submissions, quiz attempts, material access.
- Competency radar chart: mastery % per competency.
- Time spent this week/month.
- Achievements/badges (if enabled).

### Class Heatmap Tab (Teacher)
- Course selector → heatmap grid: students (rows) × chapters/topics (columns).
- Cell color: not started (grey), in progress (blue), completed (green), mastered (dark green).
- Hover: score %, time spent, last activity.
- Click cell → student detail modal.
- Filters: date range, activity type.
- Export PNG/CSV.

### Competency Tracker Tab (Teacher/Admin)
- Subject/class/section selector.
- Competency list: code, description, Bloom level, mapped activities count.
- Mastery distribution: stacked bar (novice/developing/proficient/advanced).
- Student table: competency mastery %, evidence count, trend.
- Drill-down: competency → mapped activities → student scores.
- Set mastery thresholds modal.

### Learning Paths Tab (Admin/Teacher)
- Path list: name, class/section, subject, status, enrolled, completion %.
- Create path modal: name, description, class/section, subject, year.
- Path builder: drag-drop courses into sequence.
- Step config: required/optional, unlock condition (all previous / specific steps / score threshold / date).
- Enroll students: by class/section or individual.
- Path progress: student × step matrix with lock/unlock status.

### Alerts Tab (Teacher)
- Alert feed: student, course, type (stuck/falling_behind/missed_deadline/low_score/inactivity), severity, message, date.
- Badge counts by severity.
- Actions: Acknowledge, View Student, Dismiss.
- Filter: severity, course, date range, acknowledged.
- Auto-refresh every 60s.

Permission: `lms.view` (student sees own); `lms.teach` for class heatmap, competency, alerts (assigned courses); `lms.manage` for learning paths, competency config.

---

## 6. Reports (`Reports.jsx`)

Report cards with date range picker, filters, CSV export button on each.

| Report | Description |
|---|---|
| Enrollment & Completion | Course, enrolled, dropped, completed, completion rate, avg progress |
| Assignment Statistics | Assignment, submissions, graded, avg score, late %, grade distribution |
| Quiz Analytics | Quiz, attempts, avg score, pass rate, reliability, item difficulty |
| Material Engagement | Material, views, unique students, avg duration, completion rate |
| Student Progress | Student, course, overall %, chapter %, competency %, last active |
| Competency Mastery | Class/section, competency, mastery distribution, students at each level |
| Learning Path Completion | Path, enrolled, in progress, completed, avg time to complete |
| Teacher Workload | Teacher, courses, assignments created, pending evaluations, avg grading time |
| At-Risk Students | Student, course, alert types, severity, days since activity |
| Audit Trail | Action, entity, entityId, user, before, after, timestamp |

Permission: `lms.reports` (audit report requires `lms.audit`).

---

## Shared Components (in `shared.jsx`)

```jsx
// Permission helpers
export const canLmsView = (perms) => perms.includes('lms.view');
export const canLmsManage = (perms) => perms.includes('lms.manage');
export const canLmsTeach = (perms) => perms.includes('lms.teach');
export const canLmsGrade = (perms) => perms.includes('lms.grade');
export const canLmsReports = (perms) => perms.includes('lms.reports');
export const canLmsAudit = (perms) => perms.includes('lms.audit');

// Status tone maps
export const COURSE_STATUS_TONE = {
  draft: 'secondary', published: 'success', archived: 'dark'
};
export const ASSIGNMENT_STATUS_TONE = {
  draft: 'secondary', published: 'primary', closed: 'dark'
};
export const SUBMISSION_STATUS_TONE = {
  submitted: 'info', late: 'warning', resubmitted: 'info',
  graded: 'success', returned: 'warning', draft: 'secondary'
};
export const QUIZ_STATUS_TONE = {
  draft: 'secondary', published: 'primary', closed: 'dark'
};
export const ATTEMPT_STATUS_TONE = {
  in_progress: 'info', submitted: 'primary', graded: 'success',
  abandoned: 'secondary', expired: 'warning'
};
export const MATERIAL_STATUS_TONE = {
  draft: 'secondary', published: 'success', expired: 'warning'
};
export const ALERT_SEVERITY_TONE = {
  info: 'info', warning: 'warning', critical: 'danger'
};
export const PROGRESS_STATUS_TONE = {
  not_started: 'secondary', in_progress: 'info',
  completed: 'success', mastered: 'primary'
};

// UI constants
export const TAB_BUTTON = { className: 'btn btn-outline-secondary px-3 py-2' };
export const ACTIVE_TAB_BUTTON = { className: 'btn btn-primary px-3 py-2' };

// Helpers
export const today = () => new Date().toISOString().split('T')[0];
export const weekStart = (d = new Date()) => { ... };
export const monthStart = (d = new Date()) => { ... };
export const studentName = (s) => `${s.first_name} ${s.last_name}`;
export const money = (n) => n?.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const Placeholder = ({ children }) => <div className="text-muted text-center py-5">{children}</div>;
export const ProgressRing = ({ value, size = 60, stroke = 6 }) => { ... };
export const DifficultyBadge = ({ difficulty }) => { ... };
export const TypeBadge = ({ type }) => { ... };
```