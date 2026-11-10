# M09 — Student Support & Inclusion

**Package ID:** M09.

**Priority:** Core capability; local IEP rules are conditional. **Starting status:** partial capabilities, no complete case-management flow verified.

## Submodules

Health/nurse profile and events; immunization/medication; counselor referrals/cases; IEP/accommodations; MTSS/intervention plan; goals/services/progress; family follow-up.

## How it must work

Authorized professionals record case information and follow-up. Teachers receive only approved accommodations; general dashboards/reports never expose private case notes. Track who changed and accessed sensitive information.

## Dependencies and links

M07 student → support case → M14 attendance/M15 assessment accommodations → M08 family contact. Protected files use M11; M30 reports receive only permitted aggregates.

## Files

- Existing student health/discipline screens: `src/pages/school/students/Health.jsx`, `Discipline.jsx`, `src/components/StudentProfile.jsx`.
- Proposed screens: `src/pages/school/support/HealthServices.jsx`, `CounselingCases.jsx`, `IEPPlans.jsx`, `Interventions.jsx`.
- API candidates: `server/src/routes/school_students_complete.js`, `school_more.js`; isolate new case flows in `school_support.js` if needed.

## QA plan

- Health officer/counselor/specialist roles can access only their assigned data.
- Teacher receives approved accommodation summary, not private clinical/counseling notes.
- Parent sees only released records; unauthorized file and export access is denied.
- Test referral, assessment, goal, service, follow-up, and closure state changes plus audit/retention.

**Acceptance:** sensitive records remain protected while authorized support actions link correctly to student learning and care workflows.
