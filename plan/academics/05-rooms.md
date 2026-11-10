# Academics 5 - Rooms

**Menu path:** `/school/academics/rooms`  
**Priority:** High for scheduling; define campus/building scope before migration.  
**Starting status:** no canonical academic room table or CRUD API was identified; timetable and exam schemas currently use free-text room values.

## Goal and behavior

Maintain a canonical room record with stable ID, campus/building, room code/name, room type, capacity, facilities/accessibility, and active/archive status. Room code is unique within its agreed campus scope.

Room selection in timetable and examination records must reference the room ID. Validate capacity and availability for the selected date/period; simultaneous bookings for the same room must conflict, while separate rooms or non-overlapping times remain valid. Room master data must connect to Facilities/Maintenance without creating a second competing room catalog.

## Current inventory

- `sql/23_school_full.sql` shows timetable/exam room data as text (for example `room_no`); a canonical `school_rooms` table was not found in the academic schema search.
- No dedicated `/school/academics/rooms` screen or room CRUD endpoint was identified.
- Hostel rooms are a separate residential asset and must not be used as academic rooms without an explicit shared-facility design.
- Planned screen: `src/pages/school/academics/Rooms.jsx`; planned route/API/schema changes require a versioned migration and compatibility plan for existing text values.

## Linkage and dependencies

Depends on campus/building setup and the agreed period/date model. Feeds timetable, exam schedules, facilities reservations, maintenance tickets, and room-utilization reports.

## Implementation sequence

1. Decide if room records are owned by Academics or a shared Facilities module; define campus/building parent IDs and room code uniqueness.
2. Inventory and map existing timetable/exam free-text room values before any foreign-key migration.
3. Add canonical room CRUD and archive behavior; retain legacy labels where no mapping exists.
4. Add server-side overlap/capacity checks using the same normalized time/period source as timetable and exams.
5. Ensure facilities updates (closed/under maintenance) disable new bookings without corrupting completed schedules.

## QA cases

- **AC-ROOM-01 CRUD:** create, list, update, and archive rooms with campus/building, code, capacity, type, and features.
- **AC-ROOM-02 validation:** reject blank/duplicate campus room code, invalid capacity, missing campus, and invalid building ownership.
- **AC-ROOM-03 conflict:** reject overlapping use by two classes/exams in the same room; allow a different room or non-overlapping time.
- **AC-ROOM-04 capacity:** reject booking a class/group larger than capacity, or require the documented authorized override.
- **AC-ROOM-05 availability:** inactive or maintenance-closed rooms cannot receive new bookings; existing/past schedule history remains readable.
- **AC-ROOM-06 migration:** map known `room_no` values and report unmapped values; compare timetable/exam rows before and after migration.
- **AC-ROOM-07 permissions/tenant:** verify view/manage, campus scope, direct API authorization, and no foreign-tenant room lookup.
- **AC-ROOM-08 reporting:** room utilization agrees with published timetable/exam bookings and excludes drafts or canceled sessions as specified.

## Linkage tests

Run `AC-LINK-04`, `AC-LINK-07`, and `AC-LINK-08` from the [section plan](README.md).

**Acceptance:** room IDs are authoritative for new bookings, historical text is migrated or explicitly retained, and schedule conflicts are enforced server-side.
