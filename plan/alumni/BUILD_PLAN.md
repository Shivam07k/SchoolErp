# Alumni & Placement — Build Plan

**Version 1.0** · Based on `DESIGN.md` · 4 November 2026

---

## Overview

The module is built in five sequential steps plus one optional hardening step.

**Dependencies**
- Students master (`school_students` for auto-conversion)
- Communication (`school_communication_*` for notifications)
- Fee module (`school_fee_*` for donation payments)
- File management (`school_files` for resumes, receipts, photos)
- Staff/HR (`school_staff` for job posters, placement officer)

**Migration files:** `sql/80_alumni_core.sql`, `sql/81_alumni_ops.sql`

**Backend router:** `server/src/routes/school_alumni.js`, mounted at `/api/school` **before** `school_comp_router`.

**Frontend routes:** `/school/alumni/dashboard`, `/school/alumni/directory`, `/school/alumni/events`, `/school/alumni/jobs`, `/school/alumni/donations`.

---

## Build steps

| Step | Deliverable | Done when |
|---|---|---|
| 1 | Alumni Directory | Auto-conversion, registration, verification, profiles, search |
| 2 | Alumni Events | Events, registrations, attendance, feedback |
| 3 | Job Postings | Creation, approval, listings, applications |
| 4 | Donations | Campaigns, payments, receipts, refunds |
| 5 | Reports & Hardening | Roles, audit, exports, testing |
| 6 | Later (optional) | Social networking, internal recruitment, AI matching |

---

## Step 1: Alumni Directory

**Target:** Auto-conversion from student, registration, verification, profiles, search.

### Database
- `school_alumni` – core record linked to student
- `school_alumni_profile` – professional info
- `school_alumni_education` – higher education
- Indexes on `passing_year`, `status`, `verified_at`

### Backend API (`/api/school/alumni/*`)
| Endpoint | Method | Purpose |
|---|---|---|
| `/directory` | GET | Search, filter, paginate alumni |
| `/directory/:id` | GET | Alumni profile detail |
| `/register` | POST | Self-registration (pre-filled from student) |
| `/profile/:id` | GET/PUT | View/update own profile |
| `/verification` | GET | Admin queue: pending verifications |
| `/verification/:id` | POST | Approve/reject verification |
| `/stats` | GET | Dashboard stats |

### Frontend Screens
| Screen | File | Route |
|---|---|---|
| Alumni Dashboard | `AlumniDashboard.jsx` | `/school/alumni/dashboard` |
| Alumni Registration | `AlumniRegistration.jsx` | `/school/alumni/register` |
| Alumni Directory | `AlumniDirectory.jsx` | `/school/alumni/directory` |
| Alumni Profile | `AlumniProfile.jsx` | `/school/alumni/profile/:id` |
| Alumni Verification | `AlumniVerification.jsx` | `/school/alumni/verification` |

### Hard rules
- Auto-create alumni on student "left/transferred" status
- Duplicate registration prevented by student_id
- Unverified profiles not in verified directory
- Profile visibility per privacy settings

### Done When
- Student left → alumni record created
- Self-registration pre-fills from student record
- Admin verifies → profile visible in directory
- Search filters by batch, company, location work

---

## Step 2: Alumni Events

**Target:** Events, registrations, attendance, feedback.

### Database
- `school_alumni_event` – event metadata
- `school_alumni_event_registration` – registrations
- `school_alumni_event_feedback` – post-event feedback

### Backend API
| Endpoint | Method | Purpose |
|---|---|---|
| `/events` | GET/POST | List/create events |
| `/events/:id` | GET/PUT/DELETE | Detail/update/soft-delete |
| `/events/:id/register` | POST | Alumni registers |
| `/events/:id/registrations` | GET | List registrations |
| `/events/:id/attendance` | POST | Mark attendance |
| `/events/:id/feedback` | POST | Submit feedback |
| `/events/:id/photos` | POST | Upload event photos |

### Frontend Screens
| Screen | File | Route |
|---|---|---|
| Alumni Events | `AlumniEvents.jsx` | `/school/alumni/events` |
| Event Registration | `EventRegistration.jsx` | `/school/alumni/events/registration/:id` |

### Hard rules
- Registration closes at `reg_close_dt`
- Capacity limit enforced
- Fee events: payment required for confirmation
- Attendance only on event date

### Done When
- Events created with registration
- Alumni register and pay (if any)
- Attendance marked, feedback collected

---

## Step 3: Job Postings

**Target:** Creation, approval, listings, applications.

### Database
- `school_job_posting` – job details
- `school_job_application` – applications

### Backend API
| Endpoint | Method | Purpose |
|---|---|---|
| `/jobs` | GET/POST | List/create job postings |
| `/jobs/:id` | GET/PUT/DELETE | Detail/update/soft-delete |
| `/jobs/:id/approve` | POST | Admin approve/reject |
| `/jobs/:id/apply` | POST | Alumni apply |
| `/jobs/:id/applications` | GET | List applications |
| `/jobs/listings` | GET | Public listings (filters) |

### Frontend Screens
| Screen | File | Route |
|---|---|---|
| Job Postings | `JobPostings.jsx` | `/school/alumni/jobs` |
| Job Approval | `JobApproval.jsx` | `/school/alumni/jobs/approve` |
| Job Listings | `JobListings.jsx` | `/school/alumni/jobs/listings` |

### Hard rules
- Job requires approval before publish
- Auto-expire on deadline
- Only verified alumni can apply (optional)

### Done When
- Alumni/school post jobs
- Admin approves → visible to alumni
- Applications received and tracked

---

## Step 4: Donations

**Target:** Campaigns, payments, receipts, refunds.

### Database
- `school_donation_campaign` – campaigns
- `school_donation` – individual donations
- `school_donation_receipt` – receipts

### Backend API
| Endpoint | Method | Purpose |
|---|---|---|
| `/donations/campaigns` | GET/POST | List/create campaigns |
| `/donations/campaigns/:id` | GET/PUT/DELETE | Detail/update/soft-delete |
| `/donations/campaigns/:id/donate` | POST | Initiate donation |
| `/donations` | GET | List donations (admin) |
| `/donations/receipts` | GET | Receipts list |
| `/donations/receipts/:id` | GET | Download receipt |
| `/donations/refund` | POST | Process refund |

### Frontend Screens
| Screen | File | Route |
|---|---|---|
| Donation Campaigns | `DonationCampaigns.jsx` | `/school/alumni/donations/campaigns` |
| Donation Management | `DonationManagement.jsx` | `/school/alumni/donations/manage` |
| Donation Receipts | `DonationReceipts.jsx` | `/school/alumni/donations/receipts` |

### Hard rules
- Payment idempotency
- Successful payment → receipt generated
- Receipt immutable after generation
- Refund records original transaction

### Done When
- Campaigns created with target tracking
- Donations processed with receipts
- Refunds processed with audit trail

---

## Step 5: Reports & Hardening

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

### Hardening
- Mask PII in exports for non-admins
- Role-based access: admin, placement officer, alumni
- Retention settings for applications, donations
- Audit every write action
- Export CSV from every report
- Rate limit on public endpoints

### Done When
- Inspector can see alumni stats
- Sensitive actions audited
- Retention and masking enforced

---

## Step 6: Later (optional)

Alumni social networking, internal recruitment, AI job matching, advanced donor analytics, mentorship program.

---

## Permissions

| Permission | Purpose |
|---|---|
| `alumni.view` | Read all alumni screens |
| `alumni.manage` | Full setup and operations (superset) |
| `alumni.directory` | Alumni directory management |
| `alumni.events` | Alumni events management |
| `alumni.jobs` | Job postings management |
| `alumni.donations` | Donation management |
| `alumni.reports` | Reports and exports |

`alumni.manage` is a superset for backward compatibility.

---

## Quick start

```bash
node server/_schoolsetup.mjs school_erp
npm run dev
```

Login as `ADMIN` to see **Alumni & Placement** in the menu: Alumni Directory, Alumni Events, Job Postings, Donations.