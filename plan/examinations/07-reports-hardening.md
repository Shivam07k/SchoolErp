# Step 7 — Reports, Roles, Notifications, Hardening

**Deliverable:** Analysis reports, notifications, roles, soft delete, transactional publish, archiving.  
**Exit:** Audit trail and reports complete.

## Reports

### Academic Reports
| Report | Description | Filters |
|--------|-------------|---------|
| Date Sheet by Class | PDF/HTML per class | exam, class |
| Teacher Duty Chart | Invigilation assignments | exam, date, teacher |
| Seating Plan | Hall-wise seating | exam, date, hall |
| Marks Entry Status | Sheets pending/submitted/verified/locked | exam, section, state |
| Consolidated Mark Sheet | Student-wise all subjects | version, class, section |
| Absentees in Exams | Students with AB/ML per paper | exam, date |
| Class Result Sheet | Pass/fail/grade per student | version, class |
| Subject-wise Analysis | Pass%, average, highest, lowest | version, subject |
| Merit List / Toppers | Rank 1-10 per class/section | version, class |
| Fail & Compartment List | Students below pass | version, class |
| Grace Marks Report | Students given grace, how much | version, class |
| Teacher-wise Pass % | Pass% per teacher's subjects | version, teacher |
| Term Comparison | Current vs previous term | student, terms |
| Student Performance History | All exams for one student | student |
| Re-evaluation Report | Requests, outcomes, mark changes | exam, status |
| Promotion List | Promoted/detained/conditional | academic year |
| Board Export | CBSE/ICSE/State format | version, class |

### Report API
```javascript
// Generic report endpoint
GET /school/exam/reports/:reportType?versionId=&classId=&sectionId=&format=pdf|csv|html

// Response: { data: [...], meta: { generatedAt, generatedBy, filters } }
// If format=pdf → streams PDF
// If format=csv → streams CSV
// If format=html → returns HTML for preview
```

## Notifications

### Events → Outbox (uses existing `school_attendance_outbox` pattern)
| Event | Recipients | Template |
|-------|------------|----------|
| Date sheet published | Students, parents, teachers | EXAM_SCHEDULE_PUBLISHED |
| Hall ticket ready | Student, parent | HALL_TICKET_READY |
| Marks deadline near (3 days) | Subject teacher, coordinator | MARKS_DEADLINE_REMINDER |
| Sheets pending verification | HOD, coordinator | SHEETS_PENDING_VERIFY |
| Sheet returned by verifier | Subject teacher | SHEET_RETURNED |
| Correction requested | Coordinator, teacher | CORRECTION_REQUESTED |
| Correction approved | Teacher, coordinator | CORRECTION_APPROVED |
| Result processed | Principal, coordinator | RESULT_PROCESSED |
| Result published | Parents, students | RESULT_PUBLISHED |
| Report card ready | Parents, students | REPORT_CARD_READY |
| Re-evaluation outcome | Parent, student, teacher | REEVALUATION_OUTCOME |

### Notification Channels
- App (in-app notification)
- Email (if configured)
- SMS (if configured)

## Roles & Permissions

| Role | Permissions |
|------|-------------|
| **Super Admin** | All setup, grade rules, final corrections, version management |
| **Principal** | Review/approve results, publish, approve exceptions, view all reports |
| **Exam Coordinator** | Schedule, open/lock sheets, process results, manage re-eval, publish |
| **HOD** | Verify marks sheets of department, view dept reports |
| **Class Teacher** | Verify own section, enter remarks, view results, hall tickets |
| **Subject Teacher** | Enter marks for own sections, request corrections |
| **Parent/Student** | View published date sheet, results, report cards, hall tickets only |

### Permission Keys
```javascript
// In school_permissions table
'exam.setup', 'exam.schedule', 'exam.marks.entry', 'exam.marks.verify',
'exam.marks.lock', 'exam.marks.correct', 'exam.results.process',
'exam.results.publish', 'exam.results.revaluate', 'exam.reports.view',
'exam.reportcards.generate', 'exam.reportcards.publish',
'exam.halltickets.generate', 'exam.promotion.decide'
```

## Soft Delete & Archiving
- All exam tables: `deleted_at TIMESTAMPTZ`, `deleted_by TEXT`
- Unique indexes: `WHERE deleted_at IS NULL`
- Archive job: move >3 year old data to archive schema
- Restore: admin action with audit

## Transactional Publish
```sql
-- Result publish
BEGIN;
  UPDATE school_result_version SET status='published', published_by=..., published_at=now()
  WHERE id=$1 AND status='processed';
  
  INSERT INTO school_notification_outbox (event_type, ...)
  SELECT 'result.published', ... FROM school_student_result WHERE version_id=$1;
  
  -- Trigger report card generation job
  INSERT INTO school_job_queue (job_type, payload, status)
  VALUES ('reportcard.generate', '{"version_id": $1}', 'pending');
COMMIT;
```

## Audit Trail
- Every marks/result change → `school_audit_log`
- Fields: action, entity, entity_id, before, after, actor, timestamp, ip
- Indexed by entity+entity_id for history view

## Data Integrity Hardening
| Risk | Protection |
|------|------------|
| Two teachers edit same sheet | Row version (optimistic lock) |
| Half-published results | Publish in single transaction |
| Deleted student loses history | Soft delete only |
| Bad Excel import | Validate all rows first, atomic save |
| Rules changed after exams | Versioned rules, result stores rule_version_id |
| Calculation bugs | One engine, unit tests, preview matches |
| Unauthorized access | Server-side permission check on every endpoint |
| Concurrent corrections | Separation of duties setting |

## Performance
- Indexes on: exam_id, student_id, version_id, paper_id, section_id, date
- Materialized views for: result summaries, rank tables
- Pagination on all list endpoints (default 50, max 200)
- PDF generation async via job queue

## Backup & Recovery
- Daily DB backup
- Exam data export (JSON) for migration
- Point-in-time recovery via WAL

## Acceptance
- All 16 reports render correctly in PDF/CSV/HTML
- Notifications: 100% delivery for test events, retries on failure
- Roles: each permission key tested for allow/deny
- Soft delete: deleted exam still queryable in history, not in active lists
- Publish: transaction rolls back on any failure; no partial state
- Audit: every marks/result change traceable to actor+timestamp
- Load test: 2400 students, 8 papers, 3 components → all queries < 200ms