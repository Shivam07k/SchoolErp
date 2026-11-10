# Student Section Remediation Plan

## Goal

Make the seven Student-section destinations reliable as one connected workflow: All Students, New Admission, Promotion, Transfer & Exit, Documents, Health Records, and Discipline. Preserve tenant boundaries, existing enrollment history, and permission checks while making the student identity explicit wherever records are created or viewed.

## Findings and scope

- **All Students:** the form accepts a manually entered photo URL, the roster has no photo, and its print action prints the whole list rather than one student's record.
- **New Admission:** admission photos use the private upload service; verify the photo remains linked when an application is admitted.
- **Promotion:** the UI accepts section IDs as free text. Replace this with section choices linked to the selected class, then verify only the intended enrollment changes.
- **Transfer & Exit:** use admission number and class/section alongside names in student choices and request history to distinguish duplicate names.
- **Documents:** records already link to a student and the API supports a `studentId` filter, but the UI displays same-name students without admission/class context and does not provide a student-focused view.
- **Health Records:** the APIs support student-filtered profile, event, observation, and vaccination queries, but the page loads every student's records and gives each form a separate student selector. The student profile Health tab omits observations and vaccinations.
- **Discipline:** retain its existing student linkage and permissions; check that records are identifiable and that student-profile history remains scoped to the selected student.
- **Student selection:** any workflow that targets a specific student must require choosing a class before showing that class's student list.
- **Promotion loading:** academic years are supplied by the existing school context; there is no `/school/foundation/academic-years` endpoint.

## Implementation plan

1. **Student photos and row printing**
   - Use the existing private `photo` upload context (JPEG, PNG, or WebP; 2 MB; `students.manage` upload and `students.view` read permissions).
   - Replace the free-text photo URL with a file picker, preview, and upload-on-save flow. Store the returned private file URL in the existing `school_students.photo_url` field; do not add a public file route or a database migration.
   - Show the protected image in the roster with an initials fallback when there is no image or it cannot be loaded.
   - Add a per-student print action that prints only that student's identifying roster details; keep the existing whole-list print action.

2. **Documents and identity**
   - Show admission number, class, and section in student selectors and document rows.
   - Add class-first student filtering and uploads; request document records by class and, optionally, by student.
   - Enrich the document-list query with class/section names so duplicate names remain distinguishable without extra client-side lookups.
   - Keep uploads and file reads under existing student-document permissions.

3. **Student-centered health records**
   - Make one selected student the context for the page and all profile/event/measurement/vaccination forms.
   - Fetch and display only that student's records through the existing `studentId` filters. Identify the selected student by name, admission number, and class/section.
   - Seed the health form from existing student health fields when no health profile exists, and keep the overlapping student summary fields in sync when the health profile is saved.
   - Show the complete linked health history in the student profile, including observations and vaccinations, and retain the existing permission-gated access to sensitive health details and files.
   - Do not expose clinical records in roster rows, general student printouts, or broad student searches.
   - Omit legacy health fields from student list/profile API responses without `health.view`; student edits without `health.manage` must preserve the stored values.

4. **Remaining student destinations**
   - Replace Promotion's free-text section IDs with class-dependent choices and preserve the distinction between previewing a run and applying it.
   - Add admission number and class/section context to Transfer & Exit student choices and request history.
   - Keep Discipline history scoped to the chosen student in the student profile; make any list-level student identities unambiguous.
   - Use class-first student selection in Health, both Documents selectors, Transfer & Exit, and each Discipline participant picker.
   - Populate Promotion academic-year choices from `me.academicYears`; do not call an unregistered endpoint.

## Acceptance and QA plan

### Student identity, photos, and print

- Create and edit a student with a valid image; confirm the private upload URL is saved and displayed in the roster and profile.
- Reject unsupported, oversized, or invalid image content; preserve the existing photo when no replacement is selected.
- Confirm missing or inaccessible photos use a fallback without breaking the roster.
- Print one row and verify no other student's data appears; print the full list and verify the existing list action remains usable.
- Use duplicate student names and confirm admission number and class/section distinguish them.

### Admissions, promotion, and transfer/exit linkage

- Admit an application with a photo and confirm its photo is present on the resulting student record.
- Choose source/destination class and section in Promotion; generate, review, and apply the run; verify the selected current enrollment changes and prior-year enrollment remains intact.
- Confirm Transfer & Exit choices and request rows identify the intended student; verify issuing a TC changes only that student's active enrollment after required clearances.

### Documents

- Upload a document to a selected student and confirm its list row shows the correct admission number, class, and section.
- Filter by student; verify records from other students, including same-name students, are excluded.
- Filter by class and confirm documents from other classes are excluded; then select a student and confirm only that student's documents remain.
- Confirm upload selection cannot choose a student until a class is selected, and changing classes clears the previous student selection.
- Verify/replace a document and confirm it remains attached to the same student and file access remains permission-protected.

### Health and discipline

- Select one student and confirm the profile, events, growth observations, and vaccinations shown all belong to that student.
- Confirm legacy student health values appear when no separate health profile exists, and saving updates the linked student summary without creating contradictory copies.
- Save each health record type and verify it appears under the same selected student and in that student's profile.
- Switch students and confirm no previously selected student's records remain visible or can be submitted under the wrong identity.
- Confirm Health, Transfer & Exit, and every Discipline participant selector require a class before listing students.
- Verify health and discipline access still respects their separate view/manage permissions; confirm the general roster and per-row print do not include sensitive health fields.
- With `students.view` but without `health.view`, confirm student list/profile responses omit health fields; with `students.manage` but without `health.manage`, confirm edits do not clear existing health fields.
- Simulate a list/dashboard refresh failure after a successful create, update, archive, or promotion; keep the save success and report only the refresh issue. Audit logging failures must be logged without returning a failed-save response after a committed mutation.

## Reference basis

Vendor documentation supports keeping student records and photos attached to the student identity and maintaining health information as a controlled, student-linked record. These references inform the workflow, not jurisdiction-specific compliance claims:

- [Gradelink Student Information](https://gradelink.com/student-information-3/)
- [Gradelink Medical Records](https://gradelink.com/medical-records/)
- [Alma SIS data guidance](https://www.getalma.com/what-data-does-a-student-information-system-store/)
- [U.S. Department of Education FERPA/HIPAA guidance](https://studentprivacy.ed.gov/resources/joint-guidance-application-ferpa-and-hipaa-student-health-records)
