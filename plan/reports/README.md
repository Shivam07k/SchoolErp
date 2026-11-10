# Reports & Analytics Module Plan

## Overview
Centralized reporting module that aggregates data from Students, Attendance, Fees, Examinations, and other modules. Provides pre-built reports and a custom report builder.

## Menu Structure (Intelligence group)
- Student Reports → `/school/reports/student`
- Attendance Reports → `/school/reports/attendance`
- Fee Reports → `/school/reports/fees`
- Exam Reports → `/school/reports/exam`
- Custom Reports → `/school/reports/custom`

## Backend Requirements

### Database Schema (sql/80_reports_core.sql)
New tables:
- `school_report_template` - Saved report definitions
- `school_report_schedule` - Scheduled report runs
- `school_report_execution` - Execution history/logs
- `school_dashboard_widget` - User dashboard widgets

### API Routes (server/src/routes/school_reports.js)
Mounted at `/api/school/reports`

| Endpoint | Method | Description |
|---|---|---|
| `/student` | GET | Student demographics, enrollment, performance summary |
| `/attendance` | GET | Attendance summaries by class/section/student/date range |
| `/fees` | GET | Fee collection, dues, ageing, defaulters |
| `/exam` | GET | Exam results, rankings, subject-wise performance |
| `/custom` | GET/POST | Custom report builder - save/execute templates |
| `/custom/:id` | GET/PUT/DELETE | Manage saved custom reports |
| `/custom/:id/run` | POST | Execute a custom report |
| `/templates` | GET/POST | List/create report templates |
| `/templates/:id` | GET/PUT/DELETE | Manage templates |
| `/schedule` | GET/POST | List/create scheduled reports |
| `/executions` | GET | Execution history |

### Data Sources (existing tables)
- `school_students` - student master
- `school_attendance_register` + `school_attendance_entry` - attendance
- `school_fee_invoice` + `school_fee_payment` - fees
- `school_exam_term` + `school_exam_result` + `school_exam_marks` - exams
- `school_classes` + `school_sections` - academic structure

## Frontend Requirements

### Shared Components (src/pages/school/reports/shared.jsx)
- `PageShell`, `Empty`, `Loading`, `Badge`
- `downloadCsv`, `fmtDate`, `fmtDateTime`, `moneyOrDash`
- Report filter bar component (date range, class, section, student)
- Export buttons (CSV, PDF, Excel)

### Screens

#### 1. Student Reports (`StudentReports.jsx`)
Tabs:
- **Enrollment** - Admissions by month, class/section strength, gender ratio
- **Demographics** - Category, religion, blood group, transport/hostel stats
- **Performance** - Average marks by class/subject, promotion rates
- **Attendance** - Student-wise attendance %, chronic absentees
- **Fees** - Fee status per student, dues summary

#### 2. Attendance Reports (`AttendanceReports.jsx`)
Tabs:
- **Daily Summary** - Present/absent/late by date, class, section
- **Monthly Summary** - Working days, attendance % by class/section
- **Student-wise** - Individual attendance %, leaves, late arrivals
- **Teacher-wise** - Classes marked, pending registers
- **Chronic Absentees** - Students below threshold (configurable)

#### 3. Fee Reports (`FeeReports.jsx`)
Tabs:
- **Collection** - Daily/monthly collection by fee head, payment mode
- **Outstanding** - Dues by class/section/student, ageing buckets
- **Defaulters** - Students with overdue > X days
- **Refunds** - Refund requests, status, amounts
- **Reconciliation** - Cashier/day, gateway, bank, cheque summaries
- **Receipts** - Receipt register, cancelled receipts

#### 4. Exam Reports (`ExamReports.jsx`)
Tabs:
- **Results** - Pass/fail by class/term, subject-wise pass %
- **Rankings** - Class/section/overall rank lists
- **Subject Analysis** - Average, highest, lowest per subject
- **Student Report Card** - Individual marksheet preview
- **Comparative** - Term-over-term, class-over-class trends

#### 5. Custom Reports (`CustomReports.jsx`)
- **Builder UI** - Drag-drop or form-based: select data source, columns, filters, grouping, sorting
- **Saved Reports** - List with run/edit/delete
- **Execution** - Run with parameters, preview, export
- **Scheduling** - Cron-like schedule, email/notification on completion

## Permissions
- `reports.view` - View all reports
- `reports.student` - Student reports
- `reports.attendance` - Attendance reports
- `reports.fees` - Fee reports
- `reports.exam` - Exam reports
- `reports.custom` - Custom report builder
- `reports.schedule` - Schedule reports

## Implementation Order
1. SQL migration (`sql/80_reports_core.sql`)
2. Backend routes (`server/src/routes/school_reports.js`)
3. Register route in `server/src/index.js`
4. Frontend shared + 5 screens
5. Wire in `SchoolPage.jsx`
6. Update menu permissions if needed
7. Test with browser check