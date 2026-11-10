# Events & PTM — Test Scenarios

**Version 1.0** · 4 November 2026

---

## Test Structure

```
test/
├── events/
│   ├── calendar/
│   ├── registration/
│   ├── ptm/
│   ├── gallery/
│   └── reports/
├── factories/
│   ├── eventFactory.js
│   ├── studentFactory.js
│   ├── teacherFactory.js
│   └── albumFactory.js
└── helpers/
    ├── auth.js
    └── api.js
```

---

## A. Event Calendar

| ID | Scenario | Given | When | Then |
|---|---|---|---|---|
| A1 | Create draft event | Admin logged in | Fill form, save as draft | Event status=draft, not visible to parents |
| A2 | Publish event | Draft event exists | Click Publish | Status=published, notifications sent to audience |
| A3 | Event audience targeting | Event created | Select class 10A, section A | Only 10A students see event |
| A4 | Event registration settings | Event published | Set max=50, deadline tomorrow | Registration closes at deadline |
| A4 | Event category filter | 5 events different categories | Filter by "Sports" | Only sports events shown |
| A5 | Calendar month view | 10 events in month | Open month view | All events rendered on correct dates |
| A6 | Event conflict warning | Exam on same date | Create event same day | Warning shown, not blocked |
| A7 | Cancel event | Published event with registrations | Cancel event | Status=cancelled, notifications sent to registrants |
| A8 | Duplicate event check | Event exists same title/date | Create duplicate | Warning shown |
| A9 | Event organizer assignment | Staff list loaded | Select organizer | Organizer_id saved |
| A10 | Event recurrence (later) | - | - | Skipped in v1 |

---

## B. Event Registration

| ID | Scenario | Given | When | Then |
|---|---|---|---|---|
| B1 | Register student | Event published, capacity available | Parent registers child | Registration confirmed, notification sent |
| B2 | Register at capacity | Event at max_participants | Parent registers | Added to waitlist, position=1 |
| B3 | Waitlist promotion | Registration cancelled, waitlist exists | Cancellation processed | Next waitlisted promoted, notified |
| B4 | Duplicate registration | Already registered | Register again | Error: already registered |
| B5 | Register after deadline | Past registration_deadline | Attempt register | Error: registration closed |
| B6 | Cancel registration | Confirmed registration | Parent cancels | Status=cancelled, slot freed |
| B7 | Waitlist position | 3 on waitlist | Check position | Shows position=3 |
| B8 | Bulk registration | Admin registers class | Select class, submit | All students registered |
| B9 | Registration with fee | Fee-enabled event | Register | Invoice created in Fees module |
| B10 | Cancel event with waitlist | Event cancelled | Process cancellation | All registrations cancelled, waitlist notified |

---

## C. Event Attendance

| ID | Scenario | Given | When | Then |
|---|---|---|---|---|
| C1 | Mark present | Event day, registered student | Mark present | Attendance=present, timestamp saved |
| C2 | Mark absent | Event day | Mark absent | Attendance=absent |
| C3 | Mark excused | Event day | Mark excused | Attendance=excused |
| C4 | Bulk mark present | 50 registered | Click "Mark All Present" | All set to present |
| C5 | Attendance after event | Event ended yesterday | Try mark | Warning: event ended, allow with note |
| C6 | Export attendance | Attendance marked | Click Export CSV | CSV downloaded with student, status, time |
| C7 | Duplicate attendance | Already marked | Try mark again | Updates existing record |
| C8 | Attendance permission | Teacher not assigned | Try mark | Forbidden |

---

## D. PTM Schedule

| ID | Scenario | Given | When | Then |
|---|---|---|---|---|
| D1 | Create PTM session | Admin, academic session active | Fill date, classes, deadline | Session created, status=draft |
| D2 | Open availability | PTM session draft | Click "Open Availability" | Teachers notified, status=availability_open |
| D3 | Teacher submits availability | Availability open | Teacher adds slots | Slots created, no overlaps allowed |
| D4 | Overlapping slots | Teacher has 10-11am slot | Add 10:30-11:30am | Error: overlap detected |
| D5 | Open booking | Slots submitted | Admin opens booking | Status=booking_open, parents notified |
| D5 | Booking deadline | Deadline passed | Try book | Booking disabled, countdown shows |
| D6 | Auto-close booking | Deadline reached | Scheduled job runs | Status=completed, booking disabled |
| D7 | Cancel PTM session | Bookings exist | Cancel session | Bookings cancelled, parents+teachers notified |

---

## E. PTM Booking (Parent)

| ID | Scenario | Given | When | Then |
|---|---|---|---|---|
| E1 | Book slot | Slots available, deadline not passed | Parent clicks Book | Atomic booking, slot=booked, confirmation sent |
| E2 | Double booking | Slot already booked by same parent | Try book again | Error: already booked |
| E3 | Slot full | Max bookings reached | Try book | Slot not shown / error |
| E4 | Book for wrong child | Parent has 2 children | Book for child A | Slot linked to child A only |
| E5 | Reschedule | Booking exists, before deadline | Click Reschedule, pick new slot | Old slot freed, new booked, both notified |
| E6 | Reschedule after deadline | After booking deadline | Try reschedule | Disabled |
| E7 | Cancel booking | Booking exists | Click Cancel | Slot freed, parent+teacher notified |
| E7 | Concurrent booking | Two parents click same slot | Simultaneous | Only one succeeds (row lock) |
| E8 | Booking for absent teacher | Teacher marked unavailable | Slot exists | Slot not shown / blocked |

---

## F. PTM Remarks

| ID | Scenario | Given | When | Then |
|---|---|---|---|---|
| F1 | Teacher adds remarks | Meeting completed | Teacher enters remarks | Remarks saved, parent notified |
| F2 | Remarks visibility | Remarks added | Parent views booking | Remarks visible |
| F3 | Remarks edit | Remarks exist, same day | Teacher edits | Updated, parent re-notified |
| F4 | Remarks by wrong teacher | Teacher not assigned | Try add | Forbidden |
| F5 | Follow-up date | Remarks with follow-up | Date set | Follow-up shown in dashboard |

---

## G. Photo Gallery

| ID | Scenario | Given | When | Then |
|---|---|---|---|---|
| G1 | Create album | Staff logged in | Fill title, visibility=class, select 10A | Album created, visible to 10A |
| G2 | Upload images | Album exists | Drag 5 images | Uploaded, thumbnails generated |
| G3 | Approval workflow | Public album, images uploaded | Admin reviews | Approve/Reject per image |
| G4 | Approved images visible | Approved | Parent views album | Only approved images shown |
| G5 | Rejected images hidden | Rejected | Parent views album | Not shown, uploader notified |
| G6 | Download ZIP | Album with 10 images | Click Download ZIP | ZIP downloaded with all approved |
| G7 | Class visibility | Album visibility=class, class=10A | Student 10B views | Not visible |
| G7 | School visibility | visibility=school | Any logged-in user | Visible |
| G8 | Private visibility | visibility=private | Any non-owner | Not visible |
| G9 | Media approval | Public album, upload | Auto-approve if setting off | Approved=true automatically |
| G10 | Media type | Upload video | Media_type=video | Player shown in gallery |

---

## H. Reports

| ID | Scenario | Given | When | Then |
|---|---|---|---|---|
| H1 | Upcoming events | Events in next 30 days | Run report | List with dates, registrations |
| H2 | Completed events | Past events | Run report | List with attendance stats |
| H3 | Event participation | Event with registrations | Run report | Counts: confirmed, waitlisted, attended |
| H4 | Student attendance | Student attended events | Run report | List events attended |
| H5 | PTM bookings | PTM sessions with bookings | Run report | Teacher, slots, booked, pending |
| H6 | Teacher PTM schedule | Teacher has slots | Run report | Slots with student names |
| H7 | Parent PTM attendance | PTM completed | Run report | Booked vs attended |
| H8 | Pending PTM | Booking open, unbooked slots | Run report | Slots with 0 bookings |
| H9 | Event registration | Event with waitlist | Run report | Confirmed, waitlist positions |
| H10 | Export CSV | Any report | Click Export | CSV downloaded |

---

## I. Permissions

| ID | Scenario | Given | When | Then |
|---|---|---|---|---|
| I1 | Parent cannot create event | Parent role | Try POST /events | 403 Forbidden |
| I2 | Teacher cannot open PTM booking | Teacher role | Try PUT /ptm/schedules/:id/status | 403 |
| I3 | Student cannot mark attendance | Student role | Try POST /attendance | 403 |
| I3 | Admin can do all | Super Admin | All actions | 200 OK |
| I4 | Class teacher sees own class events | Class Teacher | View events | Only class events visible |
| I5 | Auditor read-only | Auditor role | Try write | 403 |
| I6 | Parent books PTM for other child | Parent has 2 children | Try book for child B | Allowed (own children only) |

---

## J. Edge Cases & Stress

| ID | Scenario | Given | When | Then |
|---|---|---|---|---|
| J1 | 500 concurrent PTM bookings | 500 parents, 100 slots | Simultaneous book | No double-bookings, all atomic |
| J2 | Large event registration | 1000 students, capacity 200 | Simultaneous register | Waitlist positions correct |
| J3 | Large gallery | Album with 500 images | Load gallery | Lazy load, no crash |
| J4 | Scheduled job failure | Reminder job fails | Retry | Retried with backoff |
| J5 | Network timeout | Slow API | User clicks | Toast: retry, no duplicate |
| J6 | Deleted student | Student deleted | View event registration | Shows "Deleted Student" |
| J7 | Teacher resigned | Teacher has PTM slots | Resignation processed | Slots blocked, bookings reassigned |

---

## K. Integration Tests

| ID | Scenario | Modules |
|---|---|---|
| K1 | Event published → notification sent | Events + Communication |
| K2 | Registration → fee invoice created | Events + Fees |
| K3 | PTM booking → calendar event for teacher | Events + Timetable |
| K4 | Gallery upload → file storage | Events + Files |
| K5 | Event reminder job → scheduled notification | Events + Communication |
| K6 | Student left → removed from future events | Events + Students |
| K7 | Teacher resigned → PTM slots handled | Events + HR |

---

## Test Data Factories

```javascript
// factories/eventFactory.js
export const createEvent = (overrides = {}) => ({
  title: 'Annual Sports Day',
  category: 'sports',
  start_dt: addDays(new Date(), 30),
  end_dt: addDays(new Date(), 30, 4), // 4 hours
  venue: 'School Ground',
  max_participants: 200,
  registration_deadline: addDays(new Date(), 25),
  status: 'published',
  ...overrides
});

// factories/ptmFactory.js
export const createPTMSession = (overrides = {}) => ({
  session_id: 1,
  ptm_date: addDays(new Date(), 14),
  class_id: 1,
  section_id: 1,
  booking_deadline: addDays(new Date(), 10),
  status: 'booking_open',
  ...overrides
});

export const createPTMSlot = (overrides = {}) => ({
  schedule_id: 1,
  teacher_id: 5,
  start_time: '09:00',
  end_time: '09:15',
  max_bookings: 1,
  status: 'available',
  ...overrides
});
```

---

## Test Execution

```bash
# Unit tests
npm test -- --testPathPattern=events

# Integration tests
npm run test:integration -- events

# E2E tests
npm run test:e2e -- --spec="events/**"

# Load test PTM booking
npm run test:load -- ptm-booking
```

---

## CI/CD Gates

| Gate | Criteria |
|---|---|
| Unit tests | ≥90% coverage on events module |
| Integration tests | All K scenarios pass |
| Load test | 500 concurrent PTM bookings <2s p99 |
| Security | No permission bypasses |
| Audit | All write actions logged |