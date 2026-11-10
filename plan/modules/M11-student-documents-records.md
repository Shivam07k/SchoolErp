# M11 — Student Documents & Records

**Package ID:** M11.

**Priority:** Core. **Starting status:** enhanced upload/version/review features exist; full QA remains.

## Submodules

Document types/requirements; upload; verification/rejection; version history; expiry; missing-document report; protected viewing/download.

## How it must work

Each file belongs to one tenant/student/context. Replacement creates a new version, not destructive overwrite. Rejection includes a reason. Prior versions and audit remain discoverable according to retention rules.

## Dependencies and links

M06 admission checklist ↔ M07 profile ↔ M09/M10 protected contexts ↔ M28 certificates. Uses M03 retention policy and upload service.

## Files

- Frontend: `src/pages/school/students/Documents.jsx`, `src/components/StudentProfile.jsx`.
- Backend: document routes in `server/src/routes/school.js`, `school_students_complete.js`, `school_uploads.js`; `server/src/uploads/`.
- Schema: student document/version tables in `sql/27_student_module_phase1_migrations.sql` and related earlier migrations.

## QA plan

- Accept allowed file; reject unsupported type, oversize, malformed content, and wrong context.
- Replace document and verify current/prior versions, verification state, and audit.
- Test rejection reason, expiry and missing-document report against fixtures.
- Tamper with tenant/student/file key; unauthorized download must fail.

**Acceptance:** UI, API, database, and protected storage all agree on document owner, type, status, and version.
