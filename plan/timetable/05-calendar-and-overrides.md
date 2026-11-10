# Calendar and Date Overrides

## Goal

Represent one-day changes without editing the repeating weekly timetable.
Teacher, student, and room views must call the same server-side date resolver.

## Resolution order

For a requested school-local date:

1. Find the published timetable version effective on that date.
2. Apply calendar-day rules (holiday/closure, half-day, exam day, event).
3. Mark slots affected by teacher, room, or section unavailability.
4. Apply confirmed date overrides.
5. Return the resolved slots plus original-slot and override metadata for views,
   attendance, and reports.

No client should independently reconstruct this resolution.

## Calendar data

- Support date, scope (`school`, campus, class, section), day type, affected
  periods, note, creator, and audit timestamps.
- MVP day types: normal, holiday/closure, and half-day. Add exam/event behavior
  only when the Examinations/Events modules provide authoritative records.
- Store school dates as `date`, not midnight UTC timestamps. Use the school's
  configured IANA timezone when translating actual instants for notifications.
- Keep resource references enforceable: use typed foreign keys or separate
  resource-specific relations; avoid an unchecked `resource_type` plus
  `resource_id` pair that can point to a nonexistent teacher, room, or section.
- Define conflict precedence explicitly; a full closure suppresses all normal
  periods, and a half-day suppresses periods after its configured cutoff.

## Override data and operations

An override references a date, timetable version/slot, operation type, status,
reason, creator, and audit history. Store only changed values; do not copy the
entire weekly slot into an override.

First release operations:

- Cancel one lesson for one date.
- Replace teacher or room for one date.
- Add an extra/remedial lesson in a free slot.
- Copy overrides from one date to another with full revalidation.

Each operation is validated and persisted atomically. Swaps or multi-slot
changes are one transaction; failed validation must leave every affected slot
unchanged. Merge sections and complex combined lessons are later work.

## QA and acceptance

- Holiday, half-day, and normal days resolve correctly for each audience.
- Override applies only to its date and never changes the weekly base.
- Teacher, class/section, and room conflicts are checked against the resolved
  date, including another override in the same transaction.
- Version change effective dates select the correct schedule before and after
  the boundary.
- Tenant, campus, and scope filters cannot be forged.

**Acceptance:** all views and downstream consumers return the same effective
schedule for a date, with an auditable link back to its weekly source.
