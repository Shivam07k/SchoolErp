# Student Section Plan

This plan is based on the provided SCOPE, field inventories, business rules, and test cases. The goal is to make the Student module complete, coherent, and aligned with the workbook requirements.

## Current State Assessment

### What exists
- **Frontend**: `src/components/SchoolPage.jsx` has basic inline tabs (Overview/Students/Classes/Attendance/Fees/Automations). Student list with add/edit/delete (archive) via `POST/PUT/DELETE /school/students`. `StudentProfile.jsx` shows Overview/Guardians/Fees/Attendance/Documents/Audit. 
- **Backend**: `server/src/routes/school.js` has core student CRUD, guardians, documents (basic), enrollments on create/update, dashboard stats. `server/src/routes/school_students_complete.js` has enhanced APIs for admissions/enhanced, promotions, transfers, documents/enhanced, health, discipline.
- **Menu**: `src/school/menu.js` defines full Student submodules (All Students, New Admission, Promotion, Transfer & Exit, Documents, Health Records, Discipline) - all marked `built: true` but UI isn't fully wired.
- **Sidebar**: `SchoolSidebar.jsx` reads from menu and supports groups/children; routing is hash-based via `App.jsx`.

### Gaps (vs requirements)
- **Admissions**: Currently creates student directly via `POST /school/students`. Missing Inquiry → Application → Review/Approval workflow. No waitlist, lost reasons, approval flow creating student only on approval.
- **Student Master**: Missing many fields (name as per certificate, birth certificate details/scans, Aadhaar, emergency contact, pickup authorized persons, siblings linking, proper photo/signature handling, address proof, etc.). 
- **Enrollments**: Treated as secondary; promotion/inserts not fully enforced as "never overwrite history". Need enrollment as hub with one per (student_id, academic_year_id).
- **Promotion**: Backend exists but no UI in main flow. Missing preview, eligibility checks (attendance/exam/fees), class mapping, detained in same grade with new enrollment, idempotency.
- **Transfer/Exit/TC**: Backend exists but no UI. Missing clearance workflow, no-dues integration, TC numbering, signed scan tracking, re-admission.
- **Documents**: Basic metadata only. Missing versioning, verification workflow with reasons, content validation, context-based size limits (5MB app vs 20MB docs), expiry reminders, missing docs report.
- **Health**: Backend exists but no UI. Missing profile + observations history, events with parent-informed timestamps, privacy controls, emergency flags.
- **Discipline**: Backend exists but no UI. Missing incident participants/roles, evidence, actions with suspension date ranges synced to attendance, appeals, repeat-offender alerts.
- **Uploads**: No standardized upload service (just fileUrl strings). Missing validation, EXIF stripping, secure storage, auth-protected access.
- **Audit/Permissions**: Some audit exists but needs to cover all mutations and sensitive reads; permissions need to be enforced server-side consistently.

## Target Architecture

### Routing
- Keep hash routing as-is. Extend `App.jsx` to pass `module/sub` properly.
- In `SchoolPage.jsx`, route by module: `admission` → Admission module, `students` → Students module with subroutes.
- Create `src/school/students/` feature folder with layout and subpages.

### Feature Structure
```
src/school/students/
├── StudentsLayout.jsx      # Shell with subnav for All Students, New Admission, Promotion, Transfer/Exit, Documents, Health, Discipline
├── StudentsList.jsx        # All Students list with filters
├── Admission/
│   ├── InquiryForm.jsx
│   ├── ApplicationWizard.jsx  # Multi-step application
│   ├── AdmissionReview.jsx   # Approve/Reject/Waitlist
│   └── AdmissionFees.jsx
├── Promotion/
│   ├── PromotionRuns.jsx
│   ├── PromotionPreview.jsx
│   └── PromotionExecute.jsx
├── TransferExit/
│   ├── TransferRequests.jsx
│   ├── Clearances.jsx
│   └── TCIssuance.jsx
├── Documents/
│   ├── DocumentList.jsx
│   ├── DocumentUpload.jsx
│   └── DocumentVerify.jsx
├── Health/
│   ├── HealthProfile.jsx
│   ├── HealthEvents.jsx
│   └── Vaccinations.jsx
├── Discipline/
│   ├── IncidentList.jsx
│   ├── IncidentForm.jsx
│   └── IncidentActions.jsx
└── components/
    ├── UploadDropzone.jsx
    ├── GuardianEditor.jsx
    ├── EnrollmentHistory.jsx
    ├── AuditTrail.jsx
    └── StudentCard.jsx
```

### Backend Structure
- Extend `server/src/routes/school.js` for core student operations (hardened)
- Use `server/src/routes/school_admissions.js` for inquiry/application/approval
- Use/enhance `server/src/routes/school_students_complete.js` for promotions/transfers/documents/health/discipline
- Add `server/src/routes/uploads.js` for secure uploads
- Add migration scripts in `server/sql/migrations/`

## Implementation Plan

### Phase 0: Database Schema & Migrations (P0)
**Goal:** Create/extend schema to support full student module per requirements.

**Tasks:**
- [ ] Create migration `001_students_core.sql` - extend students table with required fields (student_code, official_name, birth_certificate_no, aadhaar_no, etc.)
- [ ] Create migration `002_admissions.sql` - inquiries, applications, admissions tables
- [ ] Create migration `003_enrollments_promotions.sql` - enrollments (with constraints), promotion_runs, promotion_run_items
- [ ] Create migration `004_transfers_exits.sql` - exit_requests, exit_clearances, transfer_certificates
- [ ] Create migration `005_documents_enhanced.sql` - document_types, student_documents (enhanced), document_versions
- [ ] Create migration `006_health.sql` - health_profiles, health_observations, health_events, vaccinations
- [ ] Create migration `007_discipline.sql` - incidents, incident_participants, incident_actions, incident_evidence, incident_appeals
- [ ] Create migration `008_guardians_pickup.sql` - guardians enhancement, student_guardians, pickup_authorized
- [ ] Create migration `009_audit_indexes.sql` - audit_events enhancements, indexes, constraints
- [ ] Update `server/setup.mjs` to run migrations
- [ ] Seed default data (document types, inquiry sources, exit reasons, roles/permissions)

**Acceptance:** Schema matches model, constraints in place, migrations run cleanly.

### Phase 1: Upload Service & Secure Storage (P0)
**Goal:** Standardized, secure file uploads.

**Tasks:**
- [ ] Create `server/src/uploads/` service with multer configuration
- [ ] Add file type validation (MIME + magic bytes) using file-type library or similar
- [ ] Implement size limits per context (photo 2MB, signature 1MB, app scans 5MB, docs 20MB, video 50MB)
- [ ] EXIF stripping for images (using sharp)
- [ ] Randomized storage keys, organize by school/year/module
- [ ] Create auth-protected upload endpoint `POST /api/school/uploads`
- [ ] Create auth-protected download endpoint `GET /api/school/uploads/:key`
- [ ] Add upload middleware to routes

**Acceptance:** Can upload with validation, files stored securely, access controlled.

### Phase 2: Admissions Module (Inquiry → Approval) (P0)
**Goal:** Implement full admissions workflow.

**Backend:**
- [ ] Create `server/src/routes/school_admissions.js`
- [ ] `POST /api/school/admissions/inquiries` - create inquiry
- [ ] `GET /api/school/admissions/inquiries` - list inquiries
- [ ] `PUT /api/school/admissions/inquiries/:id` - update/transition inquiry
- [ ] `POST /api/school/admissions/applications` - create application from inquiry
- [ ] `PUT /api/school/admissions/applications/:id` - update application
- [ ] `POST /api/school/admissions/applications/:id/submit` - submit application
- [ ] `POST /api/school/admissions/applications/:id/approve` - approve (transaction: create student + admission + enrollment)
- [ ] `POST /api/school/admissions/applications/:id/reject` - reject with reason
- [ ] `POST /api/school/admissions/applications/:id/waitlist` - waitlist
- [ ] Add validation, state machine, duplicate checks, audit logging

**Frontend:**
- [ ] Create `src/school/students/Admission/InquiryForm.jsx`
- [ ] Create `src/school/students/Admission/ApplicationWizard.jsx` (multi-step)
- [ ] Create `src/school/students/Admission/AdmissionReview.jsx`
- [ ] Create `src/school/students/StudentsLayout.jsx` with subnav
- [ ] Wire routing in `SchoolPage.jsx` for admission module
- [ ] Update sidebar to use new routes

**Acceptance:** Can create inquiry → application → approve creates student with enrollment atomically.

### Phase 3: Student Master & Profile Enhancement (P0)
**Goal:** Complete student master data and profile.

**Backend:**
- [ ] Extend `GET /school/students/:id` to return full data (enrollments history, guardians with roles, pickup, documents, health summary, discipline summary)
- [ ] Extend `POST/PUT /school/students` with new fields and validation
- [ ] Add `GET /school/students/:id/siblings` lookup
- [ ] Add guardian management with roles (primary/emergency/pickup/fee payer)
- [ ] Add pickup authorized persons CRUD
- [ ] Enforce enrollment rules (unique per year, don't overwrite history)

**Frontend:**
- [ ] Enhance student form in `SchoolPage.jsx` with all required fields
- [ ] Enhance `StudentProfile.jsx` with new tabs (Enrollments, Health, Discipline) and sections
- [ ] Create `GuardianEditor.jsx` component
- [ ] Create `EnrollmentHistory.jsx` component
- [ ] Add sibling lookup

**Acceptance:** All master fields captured, profile shows complete information.

### Phase 4: Promotions Module (P0)
**Goal:** Implement promotion runs with preview and execution.

**Backend:**
- [ ] Harden promotion APIs in `school_students_complete.js`
- [ ] `POST /api/school/students/promotions/runs` - create run
- [ ] `GET /api/school/students/promotions/runs/:id/preview` - preview with eligibility
- [ ] `POST /api/school/students/promotions/runs/:id/execute` - execute transactionally
- [ ] Add class mapping logic
- [ ] Add eligibility checks (attendance %, fees, exams)
- [ ] Add detained logic (new enrollment in same grade)
- [ ] Add idempotency and audit

**Frontend:**
- [ ] Create `src/school/students/Promotion/PromotionRuns.jsx`
- [ ] Create `src/school/students/Promotion/PromotionPreview.jsx`
- [ ] Wire to StudentsLayout

**Acceptance:** Can create run, preview eligibility, execute promotions safely with detained handling.

### Phase 5: Transfer & Exit / TC Module (P0)
**Goal:** Implement exit workflow with clearances.

**Backend:**
- [ ] Harden transfer APIs
- [ ] `POST /api/school/students/exit/requests` - create request
- [ ] `GET /api/school/students/exit/requests` - list requests
- [ ] `POST /api/school/students/exit/requests/:id/clearance` - mark clearance
- [ ] `POST /api/school/students/exit/requests/:id/issue-tc` - issue TC (check all clearances)
- [ ] `POST /api/school/students/exit/requests/:id/close` - close
- [ ] TC numbering with atomic sequence
- [ ] Update student status on TC issue

**Frontend:**
- [ ] Create `src/school/students/TransferExit/TransferRequests.jsx`
- [ ] Create `src/school/students/TransferExit/Clearances.jsx`
- [ ] Create `src/school/students/TransferExit/TCIssuance.jsx`

**Acceptance:** TC blocked until all clearances, numbered correctly, student status updated.

### Phase 6: Enhanced Documents Module (P0)
**Goal:** Complete document management with versioning.

**Backend:**
- [ ] Enhance document APIs
- [ ] `GET /api/school/students/documents/types` - document types
- [ ] `POST /api/school/students/documents/upload` - upload with validation
- [ ] `POST /api/school/students/documents/:id/verify` - verify/reject with reason
- [ ] `POST /api/school/students/documents/:id/replace` - replace creating new version
- [ ] `GET /api/school/students/documents/missing` - missing documents report
- [ ] Versioning, expiry tracking

**Frontend:**
- [ ] Create `src/school/students/Documents/DocumentList.jsx`
- [ ] Create `src/school/students/Documents/DocumentUpload.jsx`
- [ ] Create `src/school/students/Documents/DocumentVerify.jsx`
- [ ] Add missing documents report

**Acceptance:** Versioning works, verification requires reason on reject, expiry tracked.

### Phase 7: Health Records Module (P1)
**Goal:** Implement health management with privacy.

**Backend:**
- [ ] Enhance health APIs with proper permissions
- [ ] Health profile CRUD
- [ ] Observations (height/weight) with history
- [ ] Health events with parent informed tracking
- [ ] Vaccinations
- [ ] Privacy controls (minimum necessary)

**Frontend:**
- [ ] Create `src/school/students/Health/HealthProfile.jsx`
- [ ] Create `src/school/students/Health/HealthEvents.jsx`
- [ ] Create `src/school/students/Health/Vaccinations.jsx`

**Acceptance:** Privacy enforced, history preserved, allergies flagged.

### Phase 8: Discipline Module (P1)
**Goal:** Implement discipline tracking.

**Backend:**
- [ ] Enhance discipline APIs
- [ ] Incident CRUD with participants/roles
- [ ] Evidence upload
- [ ] Actions with suspension date ranges
- [ ] Sync suspension to attendance
- [ ] Appeals
- [ ] Repeat offender detection

**Frontend:**
- [ ] Create `src/school/students/Discipline/IncidentList.jsx`
- [ ] Create `src/school/students/Discipline/IncidentForm.jsx`
- [ ] Create `src/school/students/Discipline/IncidentActions.jsx`

**Acceptance:** Suspension syncs to attendance, roles tracked correctly.

### Phase 9: Integration, Testing & Hardening (P0)
**Goal:** Complete integration and testing.

**Tasks:**
- [ ] Add audit logging for all mutations
- [ ] Add permission checks server-side
- [ ] Add integration outbox for events
- [ ] Implement all test cases from TC-001 to TC-064
- [ ] Add validation helpers
- [ ] Performance optimization
- [ ] Documentation updates
- [ ] Run release acceptance gates

**Acceptance:** All gates pass, tests pass.

## File Changes Required

### New Files
**Frontend:**
- `src/school/students/StudentsLayout.jsx`
- `src/school/students/StudentsList.jsx`
- `src/school/students/Admission/*` (4 files)
- `src/school/students/Promotion/*` (3 files)
- `src/school/students/TransferExit/*` (3 files)
- `src/school/students/Documents/*` (3 files)
- `src/school/students/Health/*` (3 files)
- `src/school/students/Discipline/*` (3 files)
- `src/school/students/components/*` (5 files)

**Backend:**
- `server/src/routes/school_admissions.js`
- `server/src/routes/uploads.js`
- `server/src/uploads/service.js`
- `server/src/uploads/middleware.js`
- `server/sql/migrations/001-009_*.sql`

### Modified Files
**Frontend:**
- `src/components/SchoolPage.jsx` - major refactor for routing
- `src/components/StudentProfile.jsx` - enhance
- `src/components/SchoolSidebar.jsx` - minor updates if needed

**Backend:**
- `server/src/index.js` - mount new routes
- `server/src/routes/school.js` - harden
- `server/src/routes/school_students_complete.js` - enhance
- `server/setup.mjs` - run migrations

## Implementation Guidelines

### Code Standards
- Follow existing patterns (ES modules, async/await, error handling)
- Use existing API client (`apiGet`, `apiPost`, etc.)
- Follow Bootstrap 5 styling patterns
- Add proper validation on both client and server
- Use transactions for multi-step operations

### Security
- All routes protected with `verifyToken`
- Permission checks on every mutation
- File upload validation (type, size, content)
- Auth-protected file access
- Audit logging
- No hard deletes for referenced entities

### Data Integrity
- Use database transactions
- Enforce constraints
- Idempotency where needed
- Version control for documents
- Preserve history (never overwrite enrollments)

## Timeline Estimate
- Phase 0-1: 2-3 days (Schema + Uploads)
- Phase 2-3: 3-4 days (Admissions + Master)
- Phase 4-5: 2-3 days (Promotions + Transfers)
- Phase 6-8: 3-4 days (Documents + Health + Discipline)
- Phase 9: 1-2 days (Testing + Hardening)

**Total:** ~11-16 days

## Success Criteria
- [ ] All 7 student submodules functional per spec
- [ ] Admission workflow works end-to-end
- [ ] Promotions handle all cases correctly
- [ ] TC issuance blocked until clearances
- [ ] Documents have versioning and verification
- [ ] Health/Discipline respect privacy
- [ ] All test cases pass
- [ ] All release gates satisfied
- [ ] No regression in existing functionality

## Next Steps
1. Review and approve this plan
2. Start with Phase 0 (migrations)
3. Create feature branches per phase
4. Test incrementally
5. Follow plan strictly as requested