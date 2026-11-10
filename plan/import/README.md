# Import & Export Module Plan

## Overview
Bulk data import/export for Students, Fees, Attendance, and generic table exports. Supports CSV/Excel with validation, preview, error reporting, and rollback.

## Menu Structure (Intelligence group)
- Import Students → `/school/import/students`
- Import Fees → `/school/import/fees`
- Import Attendance → `/school/import/attendance`
- Export Data → `/school/import/export`

## Backend Requirements

### Database Schema (sql/80_import_core.sql)
New tables:
- `school_import_job` - Import job tracking
- `school_import_row` - Per-row results (success/error/data)
- `school_export_job` - Export job tracking
- `school_export_template` - Saved export configurations

### API Routes (server/src/routes/school_import.js)
Mounted at `/api/school/import`

| Endpoint | Method | Description |
|---|---|---|
| `/students/template` | GET | Download CSV template for students |
| `/students/validate` | POST | Validate CSV (dry run) - returns errors/warnings |
| `/students/commit` | POST | Commit validated import |
| `/students/history` | GET | Import job history |
| `/fees/template` | GET | Download CSV template for fees |
| `/fees/validate` | POST | Validate fee import |
| `/fees/commit` | POST | Commit fee import |
| `/fees/history` | GET | Fee import history |
| `/attendance/template` | GET | Download CSV template for attendance |
| `/attendance/validate` | POST | Validate attendance import |
| `/attendance/commit` | POST | Commit attendance import |
| `/attendance/history` | GET | Attendance import history |
| `/export/templates` | GET/POST | List/create export templates |
| `/export/templates/:id` | GET/PUT/DELETE | Manage templates |
| `/export/run` | POST | Start export job (async) |
| `/export/status/:jobId` | GET | Poll export status |
| `/export/download/:jobId` | GET | Download completed export |
| `/export/history` | GET | Export job history |

### Import Flow
1. User downloads template (CSV with headers + sample row)
2. User fills data, uploads file
3. **Validate** - Server parses, validates each row against schema:
   - Required fields present
   - Foreign keys exist (class_id, section_id, student_id, fee_head_id, etc.)
   - Data types, formats, ranges
   - Business rules (no duplicate admission_no, valid dates, etc.)
4. Returns preview: valid rows count, errors per row with details
5. User reviews, clicks **Commit**
6. **Commit** - Transactional insert/update, returns job ID with summary
7. History shows all jobs with status, counts, error download

### Export Flow
1. User selects template or builds ad-hoc:
   - Data source (table/view)
   - Columns
   - Filters (date range, class, section, status)
   - Format (CSV, XLSX, PDF)
2. **Run** - Creates job, returns jobId
3. **Poll** - Frontend polls status until complete
4. **Download** - Streams file

### Templates (Pre-defined)
**Students**: Admission import, Profile update, Promotion, TC request
**Fees**: Invoice creation, Payment import, Concession assignment
**Attendance**: Daily register, Correction import
**Generic**: Any table with `school_` prefix (via template builder)

## Frontend Requirements

### Shared Components (src/pages/school/import/shared.jsx)
- `PageShell`, `Empty`, `Loading`, `Badge`
- `downloadCsv`, `fmtDate`, `fmtDateTime`
- File upload zone (drag-drop + click)
- Validation results table (expandable rows for errors)
- Progress bar for commit/export
- Job history table with status badges

### Screens

#### 1. Import Students (`ImportStudents.jsx`)
- Download template button
- File upload zone
- **Validate** → shows preview table with:
  - Summary cards: Total rows, Valid, Errors, Warnings
  - Expandable rows showing field-level errors
  - Option to download error-only CSV for fixing
- **Commit** button (enabled only when valid rows > 0)
- History tab with job list, status, download errors

#### 2. Import Fees (`ImportFees.jsx`)
Same pattern as students, template includes:
- Student identifier (admission_no / student_id)
- Fee head, amount, due_date, invoice_date, description
- Optional: invoice_no (for updates), concession_code

#### 3. Import Attendance (`ImportAttendance.jsx`)
Template includes:
- Date, Section identifier
- Student identifier (admission_no / roll_no / student_id)
- Status code (P/A/L/E), remarks, late_minutes
- Validation checks: section exists, date is working day, student in section

#### 4. Export Data (`ExportData.jsx`)
- **Template Builder** (saved templates):
  - Select data source (dropdown: Students, Attendance, Fees, Exams, Custom SQL)
  - Column picker (multi-select with search)
  - Filter builder (visual: field, operator, value)
  - Format: CSV / XLSX / PDF
  - Save as template
- **Ad-hoc Export**:
  - Quick selectors for common exports
  - Run → poll → download
- **History**: Job list with status, row count, file size, download

## Permissions
- `import.view` - Access import/export
- `import.students` - Import students
- `import.fees` - Import fees
- `import.attendance` - Import attendance
- `import.export` - Export data
- `import.templates` - Manage templates

## Implementation Order
1. SQL migration (`sql/80_import_core.sql`)
2. Backend routes (`server/src/routes/school_import.js`)
3. Register route in `server/src/index.js`
4. Frontend shared + 4 screens
5. Wire in `SchoolPage.jsx` (module `import`)
6. Update menu paths to match
7. Test with browser check