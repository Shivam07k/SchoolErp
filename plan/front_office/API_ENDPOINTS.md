# Front Office — API Endpoints

All endpoints are under `/api/school/frontoffice`. The router is mounted in
`server/src/index.js` with front office handlers.

Authentication: `Authorization: Bearer <token>`. Tenant scope comes from
`req.school.appId`.

---

## Permissions

| Permission | Used for |
|---|---|
| `frontoffice.view` | All GET endpoints |
| `frontoffice.manage` | Superset for all write endpoints |
| `frontoffice.enquiry` | Enquiries and follow-ups |
| `frontoffice.visitor` | Visitors, gate passes, authorised persons, blacklist |
| `frontoffice.complaint` | Complaints, actions, escalations |
| `frontoffice.call` | Call log |
| `frontoffice.appointment` | Appointments and host availability |

---

## Dashboard

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/dashboard` | view | Front office summary: enquiries today, open visits, pending complaints, appointments today |
| GET | `/dashboard/today` | view | Today's counts and SLA breaches |
| GET | `/dashboard/kpis` | view | Conversion rate, first response time, visit footfall |

---

## Contacts

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/contacts` | view | List contacts with filters |
| GET | `/contacts/:id` | view | Contact detail |
| POST | `/contacts` | manage | Create contact |
| PUT | `/contacts/:id` | manage | Update contact |
| DELETE | `/contacts/:id` | manage | Soft delete contact |
| POST | `/contacts/import` | manage | Bulk import contacts |

---

## Enquiries

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/enquiries` | view | List enquiries |
| GET | `/enquiries/:id` | view | Enquiry detail |
| POST | `/enquiries` | enquiry | Create enquiry |
| PUT | `/enquiries/:id` | enquiry | Update enquiry |
| POST | `/enquiries/:id/assign` | enquiry | Assign to counsellor |
| POST | `/enquiries/:id/convert` | enquiry | Convert to admission lead |
| POST | `/enquiries/:id/close` | enquiry | Close enquiry with reason |
| GET | `/enquiries/sources` | view | Enquiry sources |
| POST | `/enquiries/sources` | manage | Manage sources |

---

## Follow-ups

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/follow-ups` | view | List follow-ups |
| GET | `/follow-ups/overdue` | view | Overdue follow-ups |
| POST | `/follow-ups` | enquiry | Create follow-up |
| PUT | `/follow-ups/:id` | enquiry | Update follow-up |
| POST | `/follow-ups/:id/complete` | enquiry | Mark completed |
| POST | `/follow-ups/:id/reschedule` | enquiry | Reschedule follow-up |

---

## Visits

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/visits` | view | Visitor log |
| GET | `/visits/open` | view | Open visits not checked out |
| POST | `/visits` | visitor | Pre-register or walk-in visitor |
| GET | `/visits/:id` | view | Visit detail |
| POST | `/visits/:id/check-in` | visitor | Check in visitor and issue badge |
| POST | `/visits/:id/check-out` | visitor | Check out visitor |
| POST | `/visits/:id/deny` | visitor | Deny entry with reason |

---

## Gate Passes

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/gate-passes` | view | Gate pass requests |
| POST | `/gate-passes` | visitor | Create gate pass request |
| GET | `/gate-passes/:id` | view | Gate pass detail |
| PUT | `/gate-passes/:id` | visitor | Update request |
| POST | `/gate-passes/:id/approve` | visitor | Approve gate pass |
| POST | `/gate-passes/:id/deny` | visitor | Deny gate pass |
| POST | `/gate-passes/:id/issue` | visitor | Issue physical pass |

---

## Authorised Persons

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/authorised-persons` | view | Authorised persons list |
| POST | `/authorised-persons` | visitor | Add authorised person |
| GET | `/authorised-persons/:id` | view | Detail |
| PUT | `/authorised-persons/:id` | visitor | Update |
| DELETE | `/authorised-persons/:id` | visitor | Remove |

---

## Blacklist

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/blacklist` | view | Blacklisted visitors |
| POST | `/blacklist` | visitor | Add to blacklist |
| GET | `/blacklist/:id` | view | Detail |
| PUT | `/blacklist/:id` | visitor | Update / lift |
| DELETE | `/blacklist/:id` | visitor | Remove |

---

## Complaints

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/complaints` | view | List complaints |
| GET | `/complaints/:id` | view | Complaint detail |
| POST | `/complaints` | complaint | Raise complaint |
| PUT | `/complaints/:id` | complaint | Update complaint |
| POST | `/complaints/:id/assign` | complaint | Assign to staff |
| POST | `/complaints/:id/resolve` | complaint | Resolve complaint |
| POST | `/complaints/:id/close` | complaint | Close complaint |

---

## Complaint Actions

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/complaint-actions` | view | Actions log for complaints |
| POST | `/complaint-actions` | complaint | Add action note |
| PUT | `/complaint-actions/:id` | complaint | Update action |

---

## Escalations

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/escalations` | view | Escalated complaints |
| POST | `/escalations` | complaint | Escalate complaint |
| PUT | `/escalations/:id` | complaint | Update escalation |
| POST | `/escalations/:id/resolve` | complaint | Resolve escalation |

---

## Call Log

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/call-log` | view | Call log entries |
| POST | `/call-log` | call | Log incoming/outgoing call |
| GET | `/call-log/:id` | view | Call detail |
| PUT | `/call-log/:id` | call | Update call outcome |
| GET | `/call-log/summary` | view | Call summary by staff/date |

---

## Appointments

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/appointments` | view | List appointments |
| GET | `/appointments/today` | view | Today's appointments |
| POST | `/appointments` | appointment | Create appointment |
| GET | `/appointments/:id` | view | Appointment detail |
| PUT | `/appointments/:id` | appointment | Update appointment |
| DELETE | `/appointments/:id` | appointment | Cancel appointment |
| POST | `/appointments/:id/confirm` | appointment | Confirm appointment |
| POST | `/appointments/:id/check-in` | appointment | Check in attendee |

---

## Host Availability

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/hosts` | view | Front office staff hosts |
| GET | `/host-availability` | view | Availability slots |
| GET | `/host-availability/:hostId` | view | Availability for host |
| PUT | `/host-availability` | manage | Set availability |
| POST | `/host-availability/block` | manage | Block slot |
| DELETE | `/host-availability/block/:id` | manage | Unblock slot |

---

## Reports and Settings

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/reports/enquiries` | view | Enquiry conversion report |
| GET | `/reports/visits` | view | Visit footfall report |
| GET | `/reports/complaints` | view | Complaint trends |
| GET | `/reports/call-log` | view | Call metrics |
| GET | `/settings` | view | Front office policy settings |
| PUT | `/settings` | manage | Update settings |

### Default policy settings

| Key | Default |
|---|---|
| `visitor_require_approval` | `true` |
| `gate_pass_valid_hours` | `09:00-17:00` |
| `appointment_buffer_minutes` | `15` |
| `complaint_sla_hours` | `48` |
| `enquiry_followup_days` | `3` |
