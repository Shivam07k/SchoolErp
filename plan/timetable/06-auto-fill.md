# Auto-Fill (Later Phase)

## Scope boundary

Auto-fill is optional and must not block delivery of the manual timetable
workflow. Build it only after period templates, versioning, constraints, and
manual editing are stable and representative school data exists.

## Inputs

- Curriculum demand by class/section/subject: periods per week, block length,
  and any required room type.
- Eligible teacher allocations, teacher availability, workload limits, and
  fixed periods.
- Room type/capacity/availability and school policies.
- Locked assignments and soft preferences with explicit weights.

Do not treat soft preferences as hard rules. Hard rules include section,
teacher, and room conflicts; unavailability; subject eligibility; and fixed
periods. Soft objectives may include balanced workload, subject spacing,
preferred periods, and minimizing gaps.

## Solver workflow

1. Run a shortage/preflight report and identify impossible demand before solve.
2. Generate into a new draft version only; never modify a published version.
3. Apply the solve time limit and return solver status, objective summary, and
   unplaced demand with a reason.
4. Let the scheduler lock, move, or swap assignments and revalidate each edit.
5. Require a human review and ordinary publish workflow; never auto-publish.

Start with a small deterministic implementation only if the constraints are
simple. Otherwise evaluate OR-Tools CP-SAT against a FET-generated/imported
draft. Benchmark with anonymized representative data before selecting a
solver; do not promise a solve time based on product claims.
The FET project is published under AGPL-3.0; prefer a file-based
generate/import workflow unless legal review approves embedding or distributing
it with this application.

## QA and acceptance

- Impossible demand is reported, not silently omitted.
- Generated assignments satisfy every hard constraint.
- Solver timeout/failure leaves the existing draft and published version intact.
- Re-running with the same input is explainable; locked cells remain fixed.
- A generated timetable is indistinguishable from a manually authored draft
  for validation, audit, and publication.

**Acceptance:** auto-fill saves reviewable drafts with complete diagnostics and
cannot bypass the normal conflict, permission, or publication controls.
