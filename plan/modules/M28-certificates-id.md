# M28 — Certificates & ID

**Package ID:** M28.

**Priority:** Core records; ID card scope varies. **Starting status:** partial/verify.

## Submodules

Templates; student/staff ID cards; certificate generation; TC; numbering; reprint/revoke; secure download/print.

## How it must work

Generated documents use authoritative student/enrollment data. Serials are unique. TC generation requires completed exit workflow. Reprint/revocation is audited and downloaded files are protected.

## Dependencies and links

M07 student/enrollment/M12 exit → template → protected file/print and M30 reporting/audit.

## Files

- Form candidate: `src/forms/frmSchoolCertificates/`.
- Backend candidates: `server/src/routes/school_comprehensive.js`, `school_students_complete.js`.
- File access via `server/src/routes/school_uploads.js`.

## QA plan

- Concurrent numbering, missing required data, stale enrollment.
- Unauthorized print/download; revoke and reprint.
- TC cannot bypass M12 clearances; confirm certificate values match student source.
- Verify QR/barcode resolves only permitted data.

**Acceptance:** generated IDs/certificates are correct, uniquely numbered, auditable, and access-controlled.
