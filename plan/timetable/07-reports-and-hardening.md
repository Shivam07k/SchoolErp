# Reports and Operational Hardening

## Reports

Build reports from the same version/date resolver as the timetable views:

- Teacher workload and assigned periods.
- Teacher absences, cover counts, and fairness distribution.
- Class coverage: taught, covered, cancelled, and missed lessons.
- Room utilization and unavailable-room impact.
- Unplaced curriculum demand and conflict diagnostics.
- Version/change audit and academic-year archive.

Define report filters and permissions before exposing student/teacher identity
or cross-campus information.

## Notifications and imports

- Write a transactional outbox row with the business update; send only after
  commit and use an idempotency key for retries.
- Notify only affected teachers/classes/guardians after the effective schedule
  is resolved. Avoid notifications for rolled-back changes.
- Add CSV/Excel import only after a preview/validation workflow exists. Show
  row-level errors and commit the import atomically only when valid.
- Calendar export is read-only and uses the same server-side audience scope.

## Operational controls

- Preserve published versions and substitution/override history.
- Archive old years read-only; use restore/replace flows instead of hard delete
  where history is referenced.
- Record actor, reason, before/after, and timestamp for publish, override,
  substitution, import, and administrative conflict override.
- Use row-version checks to detect two administrators editing stale drafts.
- Monitor conflict rejections, solver timeouts, notification retries, and
  unresolved slots without logging sensitive student data.

## Release QA

- Verify cross-tenant/campus privacy for views and every report.
- Test publish transaction rollback, outbox retry idempotency, stale edit
  rejection, archive/restore, and import atomicity.
- Verify attendance and reports consume the same resolved date and override
  state as Teacher/Student/Room views.
- Keep browser route, navigation, responsive, print, and timezone-boundary
  checks distinct from API workflow tests.

**Acceptance:** operations can explain every effective slot and every change,
recover from failures, and notify only the users affected by committed changes.
