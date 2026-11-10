# Academics 1 - Classes & Sections

**Menu path:** `/school/academics/classes`  
**Priority:** Foundational.  
**Starting status:** partial; CRUD routes and a combined Classes/Sections screen exist, but linkage, delete safety, route ownership, and end-to-end behavior require verification.

## Goal and behavior

- Create, edit, list, sort, and archive school classes with a stable tenant-scoped ID, display name, optional stream, and sort order.
- Create sections only under an existing class. A section has a unique name within its class, positive capacity, and an assigned class teacher selected from valid staff records.
- Show section occupancy and class totals from authoritative active enrollment data. Do not let a cached count be the source of truth for admissions or attendance.
- Prevent class/section changes from silently invalidating current or historical enrollment. A student's section must belong to the same class in the same tenant and academic-year enrollment.
- Use restrict/archive behavior for referenced classes and sections; do not permit silent cascades to erase student, timetable, attendance, exam, or homework history.

## Current inventory

- UI: `src/components/SchoolPage.jsx` contains class and section forms/cards; `src/forms/frmSchoolClasses/` is a legacy configurable form candidate.
- API: `GET/POST/PUT/DELETE /school/classes`, `POST/PUT/DELETE /school/sections` in `server/src/routes/school.js`.
- Schema: `school_classes` and `school_sections` in `sql/19_school_core.sql`.
- Risks to resolve: section `class_teacher` is currently text; parent-class ownership and duplicate behavior on create need server-side verification; current schema declares delete cascades/sets null that may not be safe for referenced historical records.

## Linkage and dependencies

Depends on tenant/campus setup and academic-year context. Feeds admissions, student enrollment, attendance, subject eligibility/allocation, timetable, homework, examinations, and reports. The class-section relationship is the required parent constraint for every dependent form.

## Implementation sequence

1. Specify campus scope, class and section naming, teacher identity, capacity meaning, and archive/delete policy.
2. Validate tenant ownership and `section.class_id` on every write; use a staff foreign key or an explicitly maintained staff identifier instead of unvalidated teacher text.
3. Define uniqueness and conflict responses; add indexes/constraints through a versioned migration only after checking existing duplicates.
4. Ensure screens refresh counts and selector options after successful writes; surface post-save refresh failure separately.
5. Wire direct route and back/forward behavior; make the child path render only this module.

## QA cases

- **AC-CLS-01 CRUD:** create, retrieve, update, and archive a class; confirm order and stream persist after reload.
- **AC-CLS-02 CRUD:** create, retrieve, update, and archive a section under a class; verify capacity and assigned teacher persist.
- **AC-CLS-03 validation:** reject blank names, whitespace-only names, invalid capacity, missing parent class, and invalid teacher IDs.
- **AC-CLS-04 uniqueness:** duplicate class names within one tenant and duplicate section names within one class return a clear conflict; same names in separate tenants/classes remain isolated as policy permits.
- **AC-CLS-05 relationship:** reject a section update or student enrollment whose class and section do not match.
- **AC-CLS-06 capacity:** test at, below, and above capacity; define whether over-capacity enrollment is blocked or requires an authorized override, and test the selected policy.
- **AC-CLS-07 referential integrity:** attempt to delete/archive a class or section with enrollments, attendance, timetable, exams, and homework; no history is silently lost.
- **AC-CLS-08 permissions:** view-only can list but cannot mutate; unauthorized direct API calls return `403`.
- **AC-CLS-09 tenant:** foreign-tenant class/section IDs are rejected; list/count queries never include another tenant.
- **AC-CLS-10 UX:** empty/loading/error states, direct path, refresh, edit cancellation, repeated submit, and accurate class/section counts.

## Linkage tests

Run `AC-LINK-01`, `AC-LINK-02`, `AC-LINK-03`, `AC-LINK-05`, and `AC-LINK-07` from the [section plan](README.md).

**Acceptance:** class and section IDs form a valid, stable hierarchy used consistently by enrollment and downstream academic records, with safe referenced-record behavior.
