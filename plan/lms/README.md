# Learning Management System (LMS) — Plan Index

**Version 1.0** · 4 November 2026

---

## Plan directory

```
plan/lms/
├── DESIGN.md              # Complete design (from supplied plan)
├── BUILD_PLAN.md          # Build steps
├── DATABASE_SCHEMA.sql    # Core schema (sql/80_lms_core.sql)
├── API_ENDPOINTS.md       # REST endpoints and permissions
├── FRONTEND_SCREENS.md    # React screens, tabs and routes
├── INTEGRATION_POINTS.md  # Student, Staff, Academic, Timetable, Exam
├── TEST_SCENARIOS.md      # Scenario and rule test matrix
└── README.md              # This file
```

Runtime files:
| Area | Files |
|---|---|
| Migrations | `sql/80_lms_core.sql`, `sql/81_lms_ops.sql` |
| Migration registry | `server/_schoolsetup.mjs` |
| Backend router | `server/src/routes/school_lms.js` |
| Router mount | `server/src/index.js` (before `schoolCompRouter`) |
| Permissions | `server/src/school/foundation.js` |
| Frontend | `src/pages/school/lms/*.jsx` |
| Menu | `src/school/menu.js` |
| Module dispatch | `src/components/SchoolPage.jsx` |

---

## Build steps

| Step | Deliverable | Done when |
|---|---|---|
| 1 | LMS Courses | Courses, subjects, chapters, topics, teacher mapping |
| 2 | Assignments | Assignment creation, submission, evaluation |
| 3 | Quizzes | Question bank, quiz builder, attempts, evaluation |
| 4 | Study Materials | Document, image, video library |
| 5 | Progress | Course progress, performance, parent dashboard |
| 6 | Reports & Hardening | Roles, permissions, audit, exports, testing |

---

## Core rules

**Always blocked**
- Students accessing unauthorized courses
- Teachers managing unauthorized courses
- Assignment submissions without timestamps
- Late submissions violating policy
- Quiz answers visible before submission
- Exceeding max quiz attempts
- Changing published quiz results without authorization
- Unlinked assignment marks

**Warn only**
- Low assignment submission rate
- High quiz failure rate
- Incomplete study material coverage
- Course progress calculation anomalies

---

## Permissions

| Permission | Purpose |
|---|---|
| `lms.view` | Read all LMS screens |
| `lms.manage` | Full setup and operations (superset) |
| `lms.courses` | Course, chapter, topic management |
| `lms.assignments` | Assignment creation, evaluation |
| `lms.quizzes` | Question bank, quiz management |
| `lms.materials` | Study material library |
| `lms.progress` | Progress tracking and reports |

---

## Quick start

```bash
node server/_schoolsetup.mjs school_erp
npm run dev
```

Login as `ADMIN` to see **Learning (LMS)** in the menu:
Courses, Assignments, Quizzes, Study Materials, Progress.