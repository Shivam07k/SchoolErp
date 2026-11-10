# Hostel & Residential Life — Design

**Version 1.0** · 4 November 2026

---

## 1. Purpose and scope

This document describes a simple, fast and reliable hostel module for the school ERP. It reads students from the student master, posts fees through the Fees and Accounts module, uses wardens from HR, locates room assets through Inventory and Assets, and keeps in step with school attendance and the school calendar.

**Submodules:** Hostel Rooms, Allocation, Hostel Fees, Hostel Attendance, Visitors.

### Requirements

- Every resident has one bed. Rooms, beds and capacity are visible at any time, and boys' and girls' hostels stay separate.
- Allocation, room change and vacating are quick and recorded, with clearance before the deposit is returned.
- Hostel fees (rent, mess, extras, deposit) reach the student ledger, and mess rebates for days away are automatic.
- Roll calls and gate movements are recorded, and late returns and absences alert the warden and the guardian.
- Visitors are registered, checked against an authorised list, and logged in and out.
- Child safety and privacy are built in, and every sensitive action is audited.
- Every common scenario is covered without making the module complex.

**Out of scope for the first release:** mess menu and stock management, laundry service, biometric or face-recognition gate hardware, CCTV integration, and patrol checkpoints. Section 11 of the source plan shows where each fits later.

---

## 2. Recommended solution in brief

1. Model the building as hostel, block, floor, room, bed. The bed is the unit of allocation.
2. Keep allocation as an effective-dated link between a student and a bed, with rule checks for gender, capacity, bed status, guardian consent and deposit.
3. Build the hostel fee from room category and mess plan through the Fees module, and calculate mess rebates from approved days away.
4. Record attendance by roll call sessions (morning, evening, night) on the warden's phone. Leave passes with guardian OTP approval and the gate log feed the same record.
5. Control visitors with pre-registration, an authorised list for each student, ID and photo, in and out times, hostel visiting rules and a blacklist.
6. Require a reason and an approver for every exception. Logs are immutable and corrections are audited.
7. Collect the minimum sensitive data, restrict access by role, and set retention limits.
8. Build in the order of the five screens: Hostel Rooms, Allocation, Hostel Fees, Hostel Attendance, Visitors.

---

## 3. What other school ERPs do

Reviewed public descriptions of school and college hostel modules:

- **edumerge:** manual and automatic room allotment, approval hierarchy, room changes, gate passes, QR-based hostel and mess attendance, gate entry/exit logs, night attendance, visitor registration/blacklisting, occupancy and night-attendance reports.
- **OpenEduCat:** room allocation and capacity, portal leave requests approved by wardens and parents, timestamped movements with late-return alerts, mess charges posted to the student account, visitor/security log, parent view of room, leave and mess attendance.
- **IITMS / MasterSoft:** check-in/check-out attendance, fees with refunds and deposits, housekeeping/repair requests, guest and visitor records, mess and stock, automatic room allocation.
- **Orell:** hostel/room/bed assignment, entry/exit monitoring, mess attendance, student-wise fees, guardian alerts, occupant/reservation/login/fee reports.
- **Other Indian ERPs:** digital leave approved by warden and parent with automatic attendance and re-entry check; layered fees (rent, mess, laundry, caution and breakage deposits); visitor photo/ID with warden approval; incident and discipline logs; complaint tracking with escalation.
- **EDU ERP:** OTP leave approvals and access logs, room inventory and asset tracking, links to admissions, HR, payroll, finance and transport.

**Conclusion.** The common pattern is bed-level allocation, fees in the same ledger as tuition, digital leave with guardian approval, timestamped movements, roll calls and visitor logs. This design follows it and keeps safety rules as settings because they vary by state and type of hostel.

---

## 4. Core design

### 4.1 How a resident's status for a day is worked out

1. An active allocation on that date puts the student on the hostel roll.
2. The school calendar (vacation, holiday) and approved home-leave or vacation passes mark the student **Away**, with a return date.
3. An approved outpass, outing or medical leave marks the student **Out** for the pass window.
4. Roll call sessions (morning, evening, night) record **Present, Absent, On leave, Sick bay or Late**. The gate log adds actual out and in times.
5. Mismatches (absent with no pass, out past the return time) raise alerts that escalate by steps.
6. Days away beyond the minimum feed the mess rebate.
7. The day summary is saved, and later changes are audited corrections.

### 4.2 The four mechanisms behind almost every scenario

| Mechanism | What it covers |
|---|---|
| Layout and bed status | Hostel, block, floor, room, bed; vacant, occupied, reserved, maintenance |
| Effective-dated allocation | Student to bed, waiting list, room changes, vacating with clearance |
| Leave pass and movement log | Passes with guardian consent, gate log, roll calls, late-return alerts |
| Authorised visitor control | Authorised list, visiting rules, in and out log, blacklist |

**Lifecycles**

- Application: Submitted → Approved / Rejected → Allocated / Waitlisted.
- Allocation: Reserved → Active → Changed → Vacated (clearance pending → cleared).
- Leave pass: Requested → Guardian-approved → Warden-approved → Out → Returned / Overdue.
- Visit: Pre-registered → Checked in → Checked out / Denied.

---

## 5. Why this is fast and reliable

**Speed.** The data is small. For example, 300 residents in 150 rooms with 3 roll calls a day is about 900 entries a day, roughly 330,000 a year. A roll call is *All Present* plus a few taps for exceptions, about a minute for a floor.

| Risk | Protection |
|---|---|
| Bed double-booked | One active allocation per bed and per student |
| Wrong gender or hostel | Hostel gender rule checked at allocation |
| Altered evidence | Roll calls, gate logs and visitor logs are immutable; fixes are audited corrections |
| Fake leave approval | Guardian OTP, approver identity and audit entry |
| Missed night roll call | Reminder, escalation and a dashboard of sessions not taken |
| Visitor never checked out | Open visits flagged at day close |
| Unauthorised pick-up | Authorised list and ID check; outpass needed to take a child out |
| No signal in the hostel | Offline roll call that syncs later, flagged by source |
| Exposure of sensitive data | Masked ID numbers, role-based access, access logs, retention limits |
| Fee does not match stay | Fee calculated from allocation and approved leave days |
| Deposit mishandled | Deposit held as a liability and settled only after clearance |
| Bad import | Validate first, row-wise errors, save only if clean |

---

## 6. Data model

### 6.1 Hostel Rooms

| Table | Key fields |
|---|---|
| Hostel | name, type (boys, girls, coed), campus, chief warden, capacity |
| Block and Floor | hostel, name, level |
| Room | hostel, floor, number, type, capacity, amenities, status, fee category, accessibility |
| Bed | room, bed number, status (vacant, occupied, reserved, maintenance) |
| RoomInspection | room, date, by, findings, condition, damage |
| MaintenanceRequest | room, issue, reported by, status, cost |
| Room assets | inventory asset records located by room |

### 6.2 Allocation

| Table | Key fields |
|---|---|
| HostelApplication | student, requested room type, preferences, guardian consent, documents, status, approvals |
| Allocation | student, bed, from, to, status, deposit paid, check-in date |
| WaitingList | student, priority, requested type, date |
| RoomChange | allocation, from bed, to bed, reason, approver, effective date |
| Vacate | allocation, date, reason, clearance checklist (dues, assets, keys, damage, deposit settlement) |

### 6.3 Hostel Fees

| Table | Key fields |
|---|---|
| HostelFeeRule | room category, fee head, amount, frequency, months billed, effective from |
| MessPlan | name, amount per month, rebate rule (minimum days away, rate) |
| MessRebate | allocation, from, to, days, amount, reason |
| Deposit | allocation, amount, status (held, adjusted, refunded, forfeited) |
| Bill | allocation, period, rent, mess, extras, rebate, invoice link |

Fee heads, installments, concessions and student fee assignment are shared with Fees and Accounts.

### 6.4 Hostel Attendance

| Table | Key fields |
|---|---|
| RollCall and entries | hostel, date, session, taken by, time, status; student, status, remark |
| LeavePass | student, type, from, to, destination, guardian OTP, approved by, status, actual out and in |
| GateLog | student, out time, in time, source, guard |
| WardenDuty | warden, hostel, date, shift |
| Incident | student or room, date, type, description, action, severity, reported by, visibility |
| Complaint | raised by, category, status, escalation |

### 6.5 Visitors

| Table | Key fields |
|---|---|
| Visitor | name, phone, ID type and masked number, photo, relation |
| AuthorisedVisitor | student, visitor, relation, allowed days, valid till |
| VisitorEntry | visitor, student visited, purpose, pre-registered by, approved by, in time, out time, badge, items carried, area, status |
| VisitRule | hostel, days, hours, maximum duration, maximum visitors, areas allowed |
| Blacklist | visitor, reason, by, date |

### 6.6 System tables

Notification, AuditLog, Setting, User and Role.

---

## 7. Rules and policies

**Hard rules (always blocked):**

- One student on one bed at a time.
- A student in a hostel that does not match their gender.
- Allocation above room capacity or to a bed under maintenance.
- Allocation without guardian consent or, by policy, without the deposit.
- A student who is not enrolled.
- A leave pass that has not been approved by the guardian and warden before the student leaves.
- A visitor who is blacklisted.
- Entry of visitors outside the rules without approval.
- Deposit refund before clearance.
- Editing a locked roll call without a reason.
- Approving your own exception.

**Soft rules (warn only):**

- A room near capacity.
- A large age or class gap between roommates.
- A late return.
- Absence at night roll call.
- A visitor staying past the allowed time.
- Frequent leave.
- An unusual number of visitors for one student.
- Unpaid hostel dues.

### Policy settings the school can change

| Setting | Options |
|---|---|
| Allocation rules | Gender, class group together, siblings together, preferences |
| Deposit | Amount, when due, refund conditions |
| Fee model | By room category or bed; monthly or term; months billed; mid-month rule |
| Mess rebate | Minimum days away, daily rate |
| Roll call sessions | Names, times, grace |
| Escalation | Minutes before warden, chief warden, principal and guardian are alerted |
| Leave rules | Who approves, guardian OTP, curfew, passes per month, home-leave days |
| Visiting rules | Days, hours, duration, areas, ID needed, overnight guests |
| Non-payment | Reminders only; removal from the hostel needs principal approval |
| Retention | Days to keep gate logs, visitor logs, photos and incident records |

### 7.1 Safety rules

Rules differ by state, board and type of hostel. Examples in police directions, court orders and child-protection studies include: registration of the hostel with local authorities; a resident warden, and a woman warden in girls' hostels; verification of all hostel staff; a visitor register with name, phone and ID; a visitors' room, with no male entry into girls' residential areas; night roll calls; CCTV at entrances and common areas with limited access to recordings; fire and electrical safety; first aid and medical records; and complaint and incident records. Keep these as settings and confirm what applies with the education department and the child-rights authority. Treat children's data with care: collect only what is needed, limit access, and keep CCTV out of private areas.

---

## 8. Screens

- **Hostel Rooms:** a layout builder (hostel, block, floor, room, beds) with a visual grid of beds coloured by status. The room card shows occupants, assets, amenities, inspections and maintenance requests. Bulk room creation, Excel import and an occupancy dashboard.
- **Allocation:** applications from parents or the office, eligibility check and approval, automatic bed suggestions or drag a student onto a bed, waiting list, room change requests, reservation for a new term, and a vacate wizard with a clearance checklist. Allotment letter and rules acknowledgement to print.
- **Hostel Fees:** fee rules by room category, mess plans, a preview of a resident's monthly bill, billing with the school fee invoices, a rebate calculator from leave days, deposits, damage recovery, dues and refunds on vacating.
- **Hostel Attendance:** the warden's app. Choose the session, tap *All Present*, then mark exceptions (Absent, On leave, Sick bay, Late) and save. Leave pass inbox with guardian OTP status, gate log, late-return and absence alerts, duty roster, incident and complaint log, and a night-compliance view.
- **Visitors:** pre-registration, front desk check-in with photo, ID, purpose and the student to meet, host approval, badge, check-out, and a list of open visits. Authorised visitor setup per student, blacklist, visit rules and the daily log.
- **Parent portal:** room details, leave requests and OTP approval, attendance and gate summary, visitor pre-registration, fee status and notices.
- **Student portal:** apply for leave, raise complaints, and view own attendance if enabled.

---

## 9. Workflows

### 9.1 Admission to vacating

1. The parent or office applies. The application is approved, then a bed is allocated or the student is waitlisted.
2. The deposit is paid and guardian consent is recorded.
3. At check-in, room inventory and keys are handed over and the hostel rules are acknowledged.
4. During the stay, fees are billed and attendance is recorded.
5. On vacating, the clearance checklist is completed (dues, assets, keys, damage), the room is inspected and the deposit is settled.

### 9.2 Leave pass

1. The student or parent requests a pass with dates and destination.
2. The guardian approves by OTP, then the warden approves.
3. The gate logs the out time and later the return time.
4. Attendance shows *On leave* automatically. An overdue return alerts the warden and the guardian.
5. Long absences feed the mess rebate.

### 9.3 Roll call

1. The warden opens the session. Students on active passes are pre-marked *On leave*.
2. The warden taps *All Present* and marks the exceptions, then submits.
3. Unexplained absences alert the guardian and escalate by the configured steps.
4. The day summary is saved. Late changes are audited corrections.

### 9.4 Visitor

1. The visitor is pre-registered, or walks in and is registered at the desk with photo and ID.
2. If the person is on the student's authorised list, the host is notified. If not, the warden or guardian approves first.
3. The visitor receives a badge and meets the student in the visiting area.
4. At check-out the badge is returned. Open visits are flagged at closing.
5. Taking a child out needs an approved pass and an authorised person.

### 9.5 Room change and maintenance

1. A resident or guardian requests a change, or a room needs repair.
2. The approver approves and the student moves to the new bed.
3. The old room is inspected, and any damage is charged by policy.

### 9.6 Links with other modules

| Module | What flows |
|---|---|
| Fees and Accounts | Hostel fee heads, deposits, rebates, refunds, defaulter policy and postings |
| Inventory and Assets | Room furniture as assets by room; bedding issued and returned; damage write-offs |
| HR and Payroll | Wardens as staff; duty roster; leave of a warden prompts cover; payroll |
| Attendance | Approved hostel leave and sickness reflect in school attendance; classes still take day attendance |
| Calendar | Vacations and holidays set when the hostel opens and closes |

### Accounting entries

| Event | Debit | Credit |
|---|---|---|
| Hostel fee invoiced | Fees receivable | Hostel fee income |
| Mess charge invoiced | Fees receivable | Mess income |
| Mess rebate | Mess income (rebate) | Fees receivable |
| Security deposit received | Cash or Bank | Hostel deposit liability |
| Damage recovery | Fees receivable | Damage recovery income |
| Deposit refunded | Hostel deposit liability | Bank or Cash |
| Deposit adjusted against dues | Hostel deposit liability | Fees receivable |
| Utilities, repairs, housekeeping | Hostel running expense | Vendor payable |
| Warden and staff salary | Hostel staff expense | Salary payable |

---

## 10. Roles, alerts and reports

| Role | Allowed actions |
|---|---|
| Super admin | Setup, policies |
| Principal | Approve exceptions, view all, approve removal from the hostel |
| Chief warden | Rooms, allocation, leave and escalations |
| Warden or assistant warden | Roll calls, leave passes, gate log, incidents |
| Front desk or security | Visitor check-in and check-out, gate log |
| Hostel clerk | Allocation entry, fee preparation |
| Accounts head | Hostel fees, deposits and expenses |
| Parent | Own child's room, leave approval, attendance, visitors, fees |
| Student | Apply for leave, raise complaints |
| Auditor | Read-only access |

### Alerts

| Event | Who is notified |
|---|---|
| Application approved or waitlisted, bed allocated | Parent |
| Leave requested (OTP) or decided | Guardian, student, warden |
| Student out, student returned | Guardian |
| Late return, unexplained absence | Warden, then escalation steps, guardian |
| Night roll call not taken | Chief warden |
| Visitor arrived | Student, warden |
| Unauthorised visitor attempt | Warden, chief warden |
| Incident logged | Guardian and chief warden, by severity |
| Maintenance request update | Requester |
| Fee due, deposit refunded, clearance pending | Parent |

### Reports

Occupancy by hostel, block, floor and room; vacancy and waiting list; allocation history; hostel fee collection and dues; mess rebates; deposits held; attendance by date and session; night-attendance compliance; leave passes and late returns; gate log; visitor log and blacklist; incident and discipline log; maintenance requests and cost; inspections; warden duty roster; audit.

---

## 11. Scenario coverage

The Step column refers to the build plan in section 12. *Later* means step 7.

### 11.1 Hostel rooms

| Scenario | How it is handled | Step |
|---|---|---|
| New hostel or block | Create hostel, blocks, floors, rooms and beds | 1 |
| Boys' and girls' hostels | Hostel type; gender rule at allocation | 1, 2 |
| Room under maintenance | Status blocks allocation; occupants moved by room change | 1 |
| Bed broken or removed | Bed status; capacity updated | 1 |
| Capacity changed | Edit with effective date; checked against occupants | 1 |
| Warden or guest room | Room type that is not allocatable | 1 |
| Rooms closed in vacation | Calendar closes beds for the dates | 1 |
| Inspection finds damage | Inspection record; charge by policy | 1, 3 |
| Room assets missing | Asset check against the room's records | 1 |
| Accessible room needed | Room flag for ground floor or accessibility | 1 |

### 11.2 Allocation

| Scenario | How it is handled | Step |
|---|---|---|
| New application | Application, approval, allocation | 2 |
| Hostel full | Waiting list by priority; offered when a bed frees up | 2 |
| Gender mismatch | Blocked | 2 |
| Roommate preference | Preference noted; suggested but not guaranteed | 2 |
| Siblings together | Allocation rule | 2 |
| Class or age group | Allocation rule | 2 |
| Mid-year admission | Effective date; fees prorated | 2, 3 |
| Room change or bed swap | Request, approval, effective date | 2 |
| Short stay (exam camp) | Temporary allocation with end date | 2 |
| Promoted to the next class | Keep the bed or re-allocate by yearly policy | 2 |
| Vacate mid-term or at year end | Vacate wizard with clearance | 2 |
| Suspended or removed | Approval by principal; clearance and deposit by policy | 2 |
| Dues pending at vacating | Deposit adjusted; balance followed up | 2, 3 |
| Assets or keys not returned | Clearance blocks until resolved or charged | 2 |
| Damage found | Charged to the student by policy | 2, 3 |
| Re-admission next year | Reservation for the new term | 2 |
| Guardian changes | Updated with verification | 2 |

### 11.3 Hostel fees

| Scenario | How it is handled | Step |
|---|---|---|
| Rent by room category | Fee rule per category | 3 |
| Mess plan | Mess plan with monthly amount | 3 |
| Monthly or term billing, months billed | Frequency and months in the rule | 3 |
| Joins mid-month | Proration by policy | 3 |
| Away for several days | Mess rebate from approved leave days | 3, 4 |
| Long illness | Rebate by policy with approval | 3 |
| Fee increase mid-year | New rule from an effective date | 3 |
| Room category changes | Difference charged or credited | 3 |
| Deposit | Held as a liability | 3 |
| Damage charges, laundry, extras | Additional fee heads | 3 |
| Personal appliance charge | Extra charge head | 3 |
| Sibling or staff-ward concession, scholarship | Concession types in Fees | 3 |
| Fee unpaid | Reminders; removal from the hostel needs principal approval | 3 |
| Refund on vacating | Deposit settlement through Fees | 3 |
| Advance payment, late fine | Advance credit; same fine rule as school fees | 3 |

### 11.4 Hostel attendance

| Scenario | How it is handled | Step |
|---|---|---|
| Morning, evening and night roll call | Sessions with times and grace | 4 |
| Absent without a pass | Alert to guardian and escalation | 4 |
| Approved outpass | Pre-marked On leave | 4 |
| Home leave or vacation | Pass with return date; calendar link | 4 |
| Sick in sick bay or hospital | Sick bay status; guardian informed; reflected in school attendance | 4 |
| Late return | Alert after the grace time | 4 |
| Did not return from leave | Escalation by steps | 4 |
| Roll call not taken | Reminder and alert to the chief warden | 4 |
| Warden absent | Substitute warden on the duty roster | 4 |
| Leave without guardian consent | Blocked until guardian OTP | 4 |
| Emergency leave by phone | Warden records it after verifying the guardian | 4 |
| Leave during exams | Warning; approval | 4 |
| Frequent leave | Flagged in reports | 4 |
| Leaving with an unauthorised person | Blocked; authorised list and ID | 4 |
| Gate log and roll call disagree | Mismatch report | 4 |
| No signal | Offline roll call that syncs later | 6 |
| Correction after lock | Audited correction with a reason | 4 |
| Incident or discipline matter | Incident log with severity and action | 4 |
| Complaint | Complaint with escalation | 4 |
| Biometric or QR attendance | Later | Later |

### 11.5 Visitors

| Scenario | How it is handled | Step |
|---|---|---|
| Parent visit within hours | Authorised list; check-in and check-out | 5 |
| Pre-registered visitor | Pre-registration speeds check-in | 5 |
| Walk-in or unknown visitor | Photo, ID and approval first | 5 |
| Visitor for several students | Separate entries per student | 5 |
| Visitor of the opposite gender | Designated visiting area only, not residential areas | 5 |
| Outside visiting hours | Warden approval with a reason | 5 |
| Emergency visit | Approval and a note | 5 |
| Overnight guest | Not allowed by default; policy and approval | 5 |
| Taking a child out | Approved pass and authorised person | 5 |
| Courier or delivery | Desk handover without hostel entry | 5 |
| Contractor or maintenance staff | Entry with purpose and escort | 5 |
| Official visitors | Entry with ID and host approval | 5 |
| Overstay or not checked out | Alert and open-visit list | 5 |
| Blacklisted visitor | Blocked | 5 |
| Lost badge | Badge record and replacement | 5 |
| Minors visiting | Only with an adult | 5 |

### 11.6 Safety, compliance and data

| Scenario | How it is handled | Step |
|---|---|---|
| Inspection by an authority | Reports of occupancy, rolls, visitors, incidents | 6 |
| Serious incident | Alert to guardian and in-charge; police step by policy | 4 |
| Staff verification records | Kept in HR documents | 6 |
| CCTV | Separate system; access rules in policy | Later |
| Data retention and privacy | Retention settings, masking, access logs | 6 |
| Audit of changes | Audit log | 6 |

---

## 12. Build plan

| Step | Deliverable | Done when |
|---|---|---|
| 1. Hostel Rooms | Hostels, blocks, floors, rooms, beds, statuses, import, inspections, maintenance requests, asset link | Every bed is created and shows its status |
| 2. Allocation | Applications, rules, waiting list, allocate, change, vacate, clearance, deposit link, parent view | No bed is double-booked and vacating follows clearance |
| 3. Hostel Fees | Fee rules, mess plans, billing through Fees, deposits, damage recovery, manual rebates | A resident's bill matches their stay |
| 4. Hostel Attendance | Roll calls, leave passes with guardian OTP, gate log, alerts, duty roster, incident and complaint log, automatic mess rebates | Absences and late returns alert the right people |
| 5. Visitors | Authorised list, pre-registration, check-in and check-out, rules, blacklist, logs | Every visitor is logged in and out |
| 6. Reports and hardening | Reports, roles, privacy controls, retention, audit, offline roll call | An inspector can see occupancy, rolls and visitor logs |
| 7. Later (optional) | Mess menu and stock, laundry, biometric, face or QR gate hardware, CCTV integration, patrol checkpoints | Added only when needed |

---

## 13. Open decisions

1. **Hostels:** boys' and girls' hostels, number of blocks, rooms and beds, and warden quarters.
2. **Safety requirements:** warden presence, staff verification, visitor register content, night attendance method and CCTV. Confirm with the education department and the child-rights authority.
3. **Fee model:** by room category or bed, mess billing (fixed monthly or per meal), rebate rules, deposit and refund conditions, vacation months, and the non-payment policy.
4. **Roll calls:** sessions and times, escalation steps and who is contacted.
5. **Leave and outings:** who approves, guardian OTP, curfew, limits and home-leave days.
6. **Visiting rules:** days, hours, areas, duration, ID and the overnight guest policy.
7. **Mess:** run in-house or contracted, and whether meal attendance is needed.
8. **Devices:** warden phones, QR or biometric at the gate or at night, and connectivity in the hostel.
9. **Health information:** whether a sick-bay log is kept and who may see it.
10. **Privacy:** retention of visitor logs, gate logs, incident records and photos.
