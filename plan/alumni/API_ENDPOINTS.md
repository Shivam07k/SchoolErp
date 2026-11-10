# Alumni & Placement — API Endpoints

**Base Path:** `/api/school/alumni`  
**Authentication:** Bearer token, tenant-scoped  
**Permissions:** `alumni.view`, `alumni.directory`, `alumni.events`, `alumni.jobs`, `alumni.donations`, `alumni.reports`, `alumni.manage`

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

---

## Dashboard

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/dashboard` | `alumni.view` | Stats: total alumni, verified, events, jobs, donations |

---

## Alumni Directory

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/directory` | `alumni.view` | Search, filter, paginate |
| GET | `/directory/:id` | `alumni.view` | Profile detail |
| POST | `/register` | `alumni.directory` | Self-registration (pre-filled) |
| GET | `/profile/:id` | `alumni.directory` | Own profile |
| PUT | `/profile/:id` | `alumni.directory` | Update own profile |
| GET | `/verification` | `alumni.directory` | Admin: pending verifications |
| POST | `/verification/:id` | `alumni.directory` | Approve/reject |
| GET | `/stats` | `alumni.view` | Dashboard stats |

---

## Alumni Events

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/events` | `alumni.view` | List events (filters) |
| POST | `/events` | `alumni.events` | Create event |
| GET | `/events/:id` | `alumni.view` | Event detail |
| PUT | `/events/:id` | `alumni.events` | Update event |
| DELETE | `/events/:id` | `alumni.events` | Soft-delete |
| PUT | `/events/:id/status` | `alumni.events` | Publish/close/cancel |
| POST | `/events/:id/register` | `alumni.events` | Register for event |
| GET | `/events/:id/registrations` | `alumni.events` | List registrations |
| POST | `/events/:id/attendance` | `alumni.events` | Mark attendance |
| POST | `/events/:id/feedback` | `alumni.events` | Submit feedback |
| POST | `/events/:id/photos` | `alumni.events` | Upload photos |

---

## Job Postings

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/jobs` | `alumni.view` | List jobs (filters) |
| POST | `/jobs` | `alumni.jobs` | Create job posting |
| GET | `/jobs/:id` | `alumni.view` | Job detail |
| PUT | `/jobs/:id` | `alumni.jobs` | Update job |
| DELETE | `/jobs/:id` | `alumni.jobs` | Soft-delete |
| POST | `/jobs/:id/approve` | `alumni.jobs` | Approve/reject |
| POST | `/jobs/:id/apply` | `alumni.jobs` | Apply for job |
| GET | `/jobs/:id/applications` | `alumni.jobs` | List applications |
| GET | `/jobs/listings` | `alumni.view` | Public listings (filters) |

---

## Donations

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/donations/campaigns` | `alumni.view` | List campaigns |
| POST | `/donations/campaigns` | `alumni.donations` | Create campaign |
| GET | `/donations/campaigns/:id` | `alumni.view` | Campaign detail |
| PUT | `/donations/campaigns/:id` | `alumni.donations` | Update campaign |
| DELETE | `/donations/campaigns/:id` | `alumni.donations` | Soft-delete |
| POST | `/donations/campaigns/:id/donate` | `alumni.donations` | Initiate donation |
| GET | `/donations` | `alumni.donations` | List donations (admin) |
| GET | `/donations/receipts` | `alumni.donations` | Receipts list |
| GET | `/donations/receipts/:id` | `alumni.donations` | Download receipt |
| POST | `/donations/refund` | `alumni.donations` | Process refund |

---

## Reports

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/reports/year-wise` | `alumni.reports` | Year-wise alumni |
| GET | `/reports/class-wise` | `alumni.reports` | Class-wise alumni |
| GET | `/reports/employment` | `alumni.reports` | Employment report |
| GET | `/reports/company-wise` | `alumni.reports` | Company-wise alumni |
| GET | `/reports/event-participation` | `alumni.reports` | Event participation |
| GET | `/reports/job-postings` | `alumni.reports` | Job postings |
| GET | `/reports/job-applications` | `alumni.reports` | Job applications |
| GET | `/reports/donation-collection` | `alumni.reports` | Donation collection |
| GET | `/reports/campaign-wise` | `alumni.reports` | Campaign-wise donations |
| GET | `/reports/donor-history` | `alumni.reports` | Donor history |

---

## Settings & Notifications

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/settings` | `alumni.manage` | Get settings |
| PUT | `/settings` | `alumni.manage` | Update settings |
| GET | `/notifications` | `alumni.view` | Notification history |

---

## Default Settings

```json
{
  "auto_create_alumni_on_tc": true,
  "alumni_verification_required": true,
  "job_approval_required": true,
  "job_auto_expire_on_deadline": true,
  "donation_payment_gateway": "razorpay",
  "receipt_template_id": 1,
  "include_80g_on_receipt": true
}
```