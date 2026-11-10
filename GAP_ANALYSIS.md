# School ERP Gap Analysis (vs provided document)

## Schema
- [x] Core foundation (campuses, settings, families, guardians, roles/permissions, audit)
- [x] Students with extended fields
- [x] Classes/sections/subjects/enrollments/academic years
- [x] Attendance, fees, notifications, automation
- [x] Documents, approvals, options
- [x] Lesson plans, homework + submissions
- [x] Exams (schedules/timetable/marks), promotions, TC
- [x] Visitors, gate passes, health records, discipline
- [x] Leaves, substitutions
- [x] Extended audit

## Menu/Forms
- [x] All 30 modules visible
- [x] Forms structure for all modules
- [x] School-only shell with campus/year

## API/Routes
Done: dashboard, students CRUD+guardians+documents, classes/sections/subjects, attendance, fees, automations, foundation, options.
Missing/partial: admission pipeline, homework/exam/marks UI+APIs, timetable builder+substitutions, front office flows, health/discipline, leaves, promotion+TC with no-dues, transport/hostel/library/inventory/canteen/hr/payroll/full comms/LMS/events/certificates/alumni/reports/import/AI/platform workflows.

## 16 Automatic Links
Tables exist for most; enforcement/workflows mostly missing in routes.

## Recommendation
Prioritize: (1) Admission pipeline + student enrollment flow, (2) Homework+Exams+Marks+Report cards, (3) Timetable+Substitutions, (4) Fees reminders/fines/blocks, (5) Leaves+approvals+substitutions, (6) Promotion+TC with no-dues checks across modules.
