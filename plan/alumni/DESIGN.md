# Alumni & Placement Management — Design Document

**Version 1.0** · 4 November 2026  
**Module ID:** M27  
**Package ID:** M27  
**Status:** Design – Plan

---

## 1. Purpose

Maintain a centralized database of former students, create an alumni network, organize alumni events, publish employment opportunities and manage donations through a unified module that connects with Student, Communication, Fee and File Management modules.

## 2. Scope

**In scope**
- Alumni Directory (registration, verification, profiles)
- Alumni Events (creation, registration, participation)
- Job Postings (creation, approval, applications)
- Donations (campaigns, payments, receipts)

**Out of scope – Phase 1**
- Alumni social networking
- Internal recruitment management
- AI-based job matching
- Advanced donor analytics
- Mentorship program

## 3. Submodules

1. **Alumni Directory** – `school_alumni`, `school_alumni_profile`, `school_alumni_education`
2. **Alumni Events** – `school_alumni_event`, `school_alumni_event_registration`
3. **Job Postings** – `school_job_posting`, `school_job_application`
4. **Donations** – `school_donation_campaign`, `school_donation`, `school_donation_receipt`

## 4. Requirements

### Functional
- Convert former students to alumni records (auto on TC/left status)
- Alumni self-registration with verification
- Profile: company, designation, industry, location, education
- Events: create, register, attend, feedback
- Jobs: alumni/school post → approval → publish → expire
- Donations: campaigns, payments, receipts, donor history
- Integration with Communication for notifications
- Search and filters for directory

### Non-functional
- Tenant-scoped, RLS enforced
- Alumni link to historical student records
- Verification before "Verified" status
- Job approval workflow with expiry
- Donation payment integration
- Audit trail for all changes
- <2s directory search with 5000 alumni
- Full RBAC per action

## 5. Recommended Solution

Reuse existing ERP engine:
- **Backend:** Express router `server/src/routes/school_alumni.js` mounted before `schoolCompRouter`
- **Frontend:** React pages `src/pages/school/alumni/*.jsx` under Alumni menu
- **Forms engine:** For registration, events, jobs, donations; custom UI for directory
- **Database:** PostgreSQL with tables prefixed `school_alumni_*`, `school_job_*`, `school_donation_*`. Migrations: `sql/80_alumni_core.sql`, `sql/81_alumni_ops.sql`
- **Permissions:** `alumni.view`, `alumni.manage`, `alumni.directory`, `alumni.events`, `alumni.jobs`, `alumni.donations`, `alumni.reports`
- **Integration:** Student (history), Communication (notifications), Fee (donations), File Management (media)

## 6. Core Design

### 6.1 Alumni Directory

**Auto-conversion:** When student status becomes "Left/Transferred" (via TC), create alumni record with `status='Pending Registration'`.

**Registration flow:**
1. Alumni receives invitation (email/SMS)
2. Clicks link → pre-filled form from student record
3. Updates: current company, designation, industry, location, higher education
3. Submits → status "Pending Verification"
4. Admin verifies → "Verified" or "Active"

**Profile sections:**
| Section | Fields |
|---|---|
| Personal | Name, Admission No, Graduation Year, Last Class, Session, Photo |
| Professional | Company, Designation, Industry, Location, LinkedIn |
| Education | Qualification, Institution, Passing Year (multiple) |
| Contact | Email, Phone, Address, City, Country |
| Privacy | Profile visibility (Public, Alumni Only, Private) |

**Search/Filter:** Name, batch, company, industry, location, designation.

### 6.2 Alumni Events

**Event types:** Annual Meet, Reunion, Guest Lecture, Career Guidance, Workshop.

**Workflow:**
1. Admin creates event (title, description, date, venue, max capacity)
2. Set registration: open/close dates, fee (optional)
3. Publish → notifications to eligible alumni (by batch/location)
4. Alumni registers → confirmation
5. On event day → attendance marking
6. Post-event → feedback form, photos

**Registration:** Optional fee with payment integration.

### 6.3 Job Postings

**Sources:** Alumni (referral), School (placement cell), External employers.

**Workflow:**
1. Poster submits job (company, title, description, type, experience, qualification, skills, location, salary range, deadline, contact, application URL)
2. Admin reviews → Approve/Reject with remarks
3. Approved → visible to eligible alumni (filters by industry, location, experience)
4. Expired → auto-inactive
5. Application: external link or internal form
6. If internal: track status (Applied, Shortlisted, Interviewed, Selected, Rejected)

**Job fields:** Company, Title, Description, Employment Type (Full-time, Part-time, Internship, Contract), Required Experience, Qualification, Skills (tags), Location, Salary Range (optional), Application Deadline, Contact Email/Phone, Application URL, Status (Draft, Pending Approval, Active, Expired, Closed).

### 6.4 Donations

**Campaign types:** General, Infrastructure, Scholarship, Library, Sports, Custom.

**Workflow:**
1. Admin creates campaign (title, description, target amount, start/end date, category)
2. Publish → visible to alumni, parents, public
3. Donor initiates: amount, payment mode, anonymous option
4. Payment gateway → on success:
   - Create donation record
   - Generate receipt with unique number
   - Update campaign collection
   - Send receipt to donor
5. Failed → record failed, notify donor
6. Refund: if needed, record with reason, update collection

**Payment modes:** Online (gateway), Bank Transfer, Cheque, Cash.

**Receipt:** Unique number, donor details, amount, date, campaign, 80G details (if applicable).

## 7. Data Model

| Table | Key Fields |
|---|---|
| `school_alumni` | `id`, `student_id`, `passing_year`, `last_class_id`, `session_id`, `status`, `registered_at`, `verified_at`, `verified_by` |
| `school_alumni_profile` | `alumni_id`, `company`, `designation`, `industry`, `location`, `linkedin_url`, `privacy_level` |
| `school_alumni_education` | `alumni_id`, `qualification`, `institution`, `passing_year` |
| `school_alumni_event` | `id`, `title`, `description`, `event_type`, `start_dt`, `end_dt`, `venue`, `max_capacity`, `registration_fee`, `reg_open_dt`, `reg_close_dt`, `status`, `created_by` |
| `school_alumni_event_registration` | `event_id`, `alumni_id`, `registered_at`, `status`, `payment_status`, `attended` |
| `school_job_posting` | `id`, `posted_by_alumni_id`, `company`, `title`, `description`, `employment_type`, `experience_required`, `qualification`, `skills`, `location`, `salary_min`, `salary_max`, `deadline`, `contact_email`, `apply_url`, `status`, `approved_by`, `approved_at` |
| `school_job_application` | `job_id`, `alumni_id`, `applied_at`, `status`, `resume_file_id`, `cover_letter` |
| `school_donation_campaign` | `id`, `title`, `description`, `category`, `target_amount`, `start_dt`, `end_dt`, `status`, `created_by` |
| `school_donation` | `id`, `campaign_id`, `donor_id`, `donor_type` (alumni/parent/other), `amount`, `payment_mode`, `payment_ref`, `status`, `is_anonymous`, `donated_at` |
| `school_donation_receipt` | `donation_id`, `receipt_no`, `issue_date`, `file_id`, `generated_by` |

All tables: `app_id`, `created_at`, `updated_at`, `deleted_at`.

## 8. Rules and Policies

### Hard rules
- Alumni record must link to student history
- Duplicate alumni registration prevented
- Unverified profiles not shown as verified
- Job postings require approval
- Jobs auto-expire on deadline
- Donations linked to payment records
- Successful donations generate receipts
- Donation records immutable after financial posting
- Donor info restricted to authorized roles

### Soft rules
- Low verification rate warning
- Expired jobs not cleaned
- Campaign below target warning

### Configurable settings
| Setting | Options |
|---|---|
| Auto-create alumni on TC | Yes/No |
| Alumni verification required | Yes/No |
| Job approval required | Yes/No |
| Job auto-expire on deadline | Yes/No |
| Donation payment gateway | Provider config |
| Receipt format | Template |
| 80G details on receipt | Yes/No |

## 9. Screens

| Screen | Route | Key Features |
|---|---|---|
| Alumni Dashboard | `/school/alumni/dashboard` | Stats, recent, quick actions |
| Alumni Registration | `/school/alumni/register` | Form with pre-fill, verification |
| Alumni Directory | `/school/alumni/directory` | Search, filters, pagination |
| Alumni Profile | `/school/alumni/profile/:id` | View/edit, verification |
| Alumni Verification | `/school/alumni/verification` | Admin queue, approve/reject |
| Alumni Events | `/school/alumni/events` | CRUD, registration, attendance |
| Event Registration | `/school/alumni/events/registration/:id` | Register, pay, confirm |
| Job Postings | `/school/alumni/jobs` | CRUD, approval, expiry |
| Job Approval | `/school/alumni/jobs/approve` | Review, approve/reject |
| Job Listings | `/school/alumni/jobs/listings` | Filters, apply |
| Donation Campaigns | `/school/alumni/donations/campaigns` | CRUD, target tracking |
| Donation Management | `/school/alumni/donations/manage` | Records, receipts, refunds |
| Donation Receipts | `/school/alumni/donations/receipts` | Generate, download |
| Alumni Analytics | `/school/alumni/analytics` | Year-wise, employment, donations |

## 10. Workflows

**W1: Student → Alumni**
1. Student leaves (TC/left status)
2. Auto-create alumni record (Pending Registration)
3. Send invitation
4. Alumni completes profile
5. Admin verifies

**W2: Alumni Event**
1. Admin creates event
2. Notifications sent (by batch/location)
5. Alumni registers (payment if any)
6. Attendance on event day
7. Feedback + photos

**W3: Job Posting**
1. Alumni/school posts job
2. Admin approves
3. Visible to eligible alumni
4. Applications received
5. Job expires → inactive

**W4: Donation**
1. Admin creates campaign
2. Donor initiates
3. Payment success → record + receipt
4. Campaign total updated
5. Refund if needed

## 11. Roles, Alerts, Reports

### Roles
| Role | Actions |
|---|---|
| Super Admin | All |
| Principal | Approve jobs, view analytics |
| School Admin | Directory, events, jobs, campaigns |
| Placement Officer | Jobs, placements |
| Alumni | Profile, events, jobs, donations |
| Auditor | Read-only |

### Alerts
| Event | Recipients |
|---|---|
| Alumni registration submitted | Admin |
| Alumni verified | Alumni |
| Event registration confirmed | Alumni |
| Job posted | Eligible alumni |
| Job application received | Poster |
| Donation successful | Donor, Accounts |
| Campaign target reached | Admin |

### Reports
- Year-wise alumni report
- Class-wise alumni report
- Alumni employment report
- Company-wise alumni report
- Alumni event participation
- Job posting report
- Job application report
- Donation collection report
- Campaign-wise donation report
- Donor history

## 12. Scenario Coverage

| Scenario | Handling | Step |
|---|---|---|
| Convert former student | Auto-link to student history | 1 |
| Duplicate alumni registration | Prevented | 1 |
| Unverified profile | Not shown as verified | 1 |
| Create alumni event | Visible to eligible alumni | 2 |
| Submit job posting | Waits for approval | 3 |
| Job reaches deadline | Auto-inactive | 3 |
| Submit donation | Payment status recorded | 4 |
| Payment fails | No receipt issued | 4 |
| Successful payment | Receipt generated | 4 |
| Refund donation | History retained | 4 |

## 13. Performance, Security, Reliability

- Pagination for directory
- Server-side filtering by batch/location/industry
- File storage for resumes, receipts
- File type/size validation
- Authenticated URLs for documents
- Background jobs for bulk notifications
- Retry mechanism for failed notifications
- Duplicate prevention for registrations/applications
- Payment idempotency
- Audit logs for all changes
- RBAC on all endpoints
- Alumni PII protection per privacy settings
- Historical data retention
- DB transactions for payment operations
- Backups of records and documents

## 14. Out of Scope (Phase 1)

- Alumni social networking
- Internal recruitment management
- AI-based job matching
- Advanced donor analytics
- Mentorship program

## 15. Open Decisions

1. Auto-create alumni on TC or manual?
2. Alumni verification required or auto-approve?
3. Job approval required or auto-publish?
4. Job auto-expire on deadline?
5. Donation payment gateway provider?
6. Receipt format and 80G details?
7. Privacy: consent rules for alumni data visibility?
8. Will alumni self-register or admin-only?

## 16. Build Strategy

**Phase 1 — Alumni Directory** (Week 1-2): Auto-conversion, registration, verification, profiles, search
**Phase 2 — Alumni Events** (Week 3): CRUD, registration, attendance, feedback
**Phase 3 — Job Postings** (Week 4): Creation, approval, listings, applications
**Phase 4 — Donations** (Week 5): Campaigns, payments, receipts, refunds
**Phase 5 — Integration & Hardening** (Week 6): Notifications, analytics, roles, audit, testing

---

*End of Document*