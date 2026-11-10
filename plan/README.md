# School ERP Implementation Plan

This folder contains the build order, individual module specifications, implementation gaps, and QA execution documents for the School ERP.

## Plan documents

- [`ALL_MODULES_QA_PLAN.md`](ALL_MODULES_QA_PLAN.md) — overall scope, 31 planning domains, research basis, current file/route map, build order, integration graph, and release gates.
- [`modules/00-index.md`](modules/00-index.md) — index of all 33 independently testable work packages and the shared QA contract.
- [`academics/README.md`](academics/README.md) — Academics section overview and six separate module plans with implementation order, linkage contracts, and QA cases.
- [`academics/REMAINING.md`](academics/REMAINING.md) — latest Academics audit findings and release blockers.
- [`attendance/README.md`](attendance/README.md) — M14 Attendance roadmap, current baseline, student/staff workflows, integrations, and acceptance gates.
- [`timetable/README.md`](timetable/README.md) — phased Timetable roadmap, current baseline, architecture decisions, QA gates, and research references.
- [`QA_GAPS.md`](QA_GAPS.md) — known and unverified implementation/test gaps, prioritized for closure.
- [`TEST_EXECUTION.md`](TEST_EXECUTION.md) — safe test environment, test layers, and execution sequence.
- [`IMPLEMENTATION_TRACKER.md`](IMPLEMENTATION_TRACKER.md) — per-work-package status and sign-off checklist.

## Build rule

Build one package at a time in dependency order. A module is not complete because its screen renders or its API returns `200`; require module-specific tests, permission/tenant checks, database integrity, and every applicable `LINK-*` scenario. Do not run mutation/setup scripts against a valuable or production database.
