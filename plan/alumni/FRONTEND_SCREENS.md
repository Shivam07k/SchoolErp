# Alumni & Placement — Frontend Screens

**Stack:** React 18, Vite, Bootstrap 5, React Router  
**Base Path:** `/school/alumni`  
**Dispatch:** From `src/components/SchoolPage.jsx` → `module === 'alumni'`

---

## Routes

| Route | File | Tab Key |
|---|---|---|
| `/school/alumni/dashboard` | `AlumniDashboard.jsx` | `dashboard` |
| `/school/alumni/register` | `AlumniRegistration.jsx` | `register` |
| `/school/alumni/directory` | `AlumniDirectory.jsx` | `directory` |
| `/school/alumni/profile/:id` | `AlumniProfile.jsx` | `profile` |
| `/school/alumni/verification` | `AlumniVerification.jsx` | `verification` |
| `/school/alumni/events` | `AlumniEvents.jsx` | `events` |
| `/school/alumni/events/registration/:id` | `EventRegistration.jsx` | `event-registration` |
| `/school/alumni/jobs` | `JobPostings.jsx` | `jobs` |
| `/school/alumni/jobs/approve` | `JobApproval.jsx` | `jobs-approve` |
| `/school/alumni/jobs/listings` | `JobListings.jsx` | `jobs-listings` |
| `/school/alumni/donations/campaigns` | `DonationCampaigns.jsx` | `donations-campaigns` |
| `/school/alumni/donations/manage` | `DonationManagement.jsx` | `donations-manage` |
| `/school/alumni/donations/receipts` | `DonationReceipts.jsx` | `donations-receipts` |

---

## Shared Helpers

`src/pages/school/alumni/shared.jsx` exports:
```js
export { PageShell, Empty, Loading, Badge, fmtDate, fmtDateTime, moneyOrDash, downloadCsv };
```

---

## Screen Details

### 1. Alumni Dashboard `AlumniDashboard.jsx` — `/school/alumni/dashboard`

**KPI Strip:** Total Alumni, Verified, Pending Verification, Events This Month, Active Jobs, Donations This Month

**Quick Actions:** Register Alumni, Create Event, Post Job, Create Campaign

**Recent Activity:** Latest registrations, event signups, job applications, donations

**Permissions:** `alumni.view`

---

### 2. Alumni Registration `AlumniRegistration.jsx` — `/school/alumni/register`

**For:** Alumni self-registration (public or invite link)

**Sections:**
- **Student Link** — Pre-filled from student record (if invite token valid)
- **Professional Info** — Company, Designation, Industry, Location, LinkedIn
- **Education** — Qualification, Institution, Passing Year (multiple)
- **Contact** — Email, Phone, Address, City, Country
- **Privacy** — Profile visibility (Public/Alumni Only/Private)

**Flow:**
1. Enter admission number or use invite token
2. System fetches student record → pre-fills name, batch, class
3. Alumni fills professional details
4. Submit → status=pending_registration
4. Admin verifies → status=verified

**Permissions:** Public (with token) or `alumni.directory`

---

### 3. Alumni Directory `AlumniDirectory.jsx` — `/school/alumni/directory`

**Tabs:**
- **Verified Alumni** — Filter status=verified
- **Pending Verification** — Admin only
- **All** — Admin only

**Search/Filters:**
- Name, Admission No
- Batch/Passing Year
- Company, Industry, Designation
- Location (City, Country)
- Verification Status

**Table Columns:** Name, Batch, Company, Designation, Location, Status, Actions

**Actions:** View Profile, Verify (admin), Edit (self), Export CSV

**Alumni Card View:** Grid with photo, name, batch, company, location

**Permissions:** `alumni.view` (read), `alumni.directory` (verify)

---

### 4. Alumni Profile `AlumniProfile.jsx` — `/school/alumni/profile/:id`

**Tabs:**
- **Overview** — Photo, name, batch, company, designation, location
- **Professional** — Company, designation, industry, LinkedIn, skills
- **Education** — Higher education entries (add/edit/delete)
- **Contact** — Email, phone, address (per privacy)
- **Activity** — Events attended, jobs applied, donations made

**Actions (self):** Edit Profile, Add Education, Update Privacy

**Actions (admin):** Verify, Edit, Delete

**Permissions:** `alumni.view` (read own), `alumni.directory` (verify/admin)

---

### 5. Alumni Verification `AlumniVerification.jsx` — `/school/alumni/verification`

**Table:** Pending verifications with: Name, Batch, Student ID, Submitted, Actions

**Actions:** View Profile, Approve, Reject (with reason)

**Bulk Actions:** Approve Selected, Reject Selected

**Filters:** Date range, Batch

**Permissions:** `alumni.directory` (admin)

---

### 6. Alumni Events `AlumniEvents.jsx` — `/school/alumni/events`

**Tabs:**
- **All Events** — Searchable table
- **Upcoming** — Filter start_dt > now
- **Past** — Filter end_dt < now
- **Drafts** — Admin only

**Table Columns:** Title, Type, Date, Venue, Capacity, Registrations, Status, Actions

**Actions:** View, Edit, Delete, Registrations, Attendance, Feedback, Photos

**Create/Edit Modal:**
- Title, Description, Type
- Date/Time, Venue
- Capacity, Fee
- Registration open/close dates
- Visibility (all alumni / specific batches / locations)

**Permissions:** `alumni.view` (read), `alumni.events` (write)

---

### 7. Event Registration `EventRegistration.jsx` — `/school/alumni/events/registration/:id`

**For:** Alumni self-registration

**Sections:**
- **Event Info** — Title, date, venue, capacity
- **Register Form** — Alumni select (if multiple), guest count
- **Payment** — If fee > 0, payment gateway
- **Confirmation** — Ticket with QR code

**Flow:**
1. Check capacity, registration dates
2. Select alumni profile
3. If fee → payment gateway
4. Confirm → POST `/events/:id/register`
5. Ticket generated with QR

**Permissions:** `alumni.events` (alumni)

---

### 8. Job Postings `JobPostings.jsx` — `/school/alumni/jobs`

**Tabs:**
- **My Postings** — Posted by current user
- **Pending Approval** — Admin only
- **Active** — status=active
- **Expired** — deadline passed

**Table Columns:** Company, Title, Type, Location, Deadline, Status, Actions

**Actions:** View, Edit, Delete, Approve/Reject (admin), View Applications

**Create/Edit Modal:**
- Company, Title, Description
- Employment Type, Experience, Qualification
- Skills (tags), Location
- Salary Range (optional)
- Deadline, Contact, Apply URL

**Permissions:** `alumni.view` (read), `alumni.jobs` (write), `alumni.jobs` approve (admin)

---

### 9. Job Approval `JobApproval.jsx` — `/school/alumni/jobs/approve`

**Table:** Pending approval jobs with: Company, Title, Posted By, Submitted, Actions

**Actions:** View, Approve, Reject (with reason)

**Bulk Actions:** Approve Selected, Reject Selected

**Filters:** Date range, Company

**Permissions:** `alumni.jobs` (admin)

---

### 10. Job Listings `JobListings.jsx` — `/school/alumni/jobs/listings`

**For:** Verified alumni browsing opportunities

**Filters:**
- Employment Type
- Experience Range
- Location
- Industry/Skills
- Salary Range
- Deadline (active only)

**Card View:** Company, Title, Location, Type, Deadline, Apply Button

**Apply Flow:**
1. Click Apply
2. Select alumni profile (if multiple)
3. Upload resume (optional)
4. Cover letter (optional)
5. Submit → POST `/jobs/:id/apply`
6. Confirmation

**Permissions:** `alumni.jobs` (verified alumni)

---

### 11. Donation Campaigns `DonationCampaigns.jsx` — `/school/alumni/donations/campaigns`

**Tabs:**
- **Active** — status=active
- **Completed** — status=completed
- **Draft** — Admin only

**Table Columns:** Title, Category, Target, Collected, Progress Bar, Start/End, Status, Actions

**Actions:** View, Edit, Delete, Donate, View Donors

**Create/Edit Modal:**
- Title, Description, Category
- Target Amount, Start/End Date
- Visibility (public/alumni/private)

**Progress Bar:** Collected/Target with percentage

**Permissions:** `alumni.view` (read), `alumni.donations` (write)

---

### 12. Donation Management `DonationManagement.jsx` — `/school/alumni/donations/manage`

**Tabs:**
- **All Donations** — Admin view
- **My Donations** — Alumni view
- **Pending** — status=pending/failed
- **Refunds** — Refunded donations

**Table Columns:** Campaign, Donor, Amount, Mode, Status, Date, Actions

**Actions:** View, Generate Receipt, Refund (admin)

**Filters:** Campaign, Date range, Status, Donor type

**Export:** CSV

**Permissions:** `alumni.donations` (admin), `alumni.view` (own)

---

### 13. Donation Receipts `DonationReceipts.jsx` — `/school/alumni/donations/receipts`

**Table:** Receipt No, Donation, Donor, Amount, Issue Date, Actions

**Actions:** Download PDF, Resend Email

**Bulk Actions:** Download ZIP, Resend Selected

**Filters:** Campaign, Date range

**Permissions:** `alumni.donations` (admin), `alumni.view` (own)

---

## UI Components Library

`src/pages/school/alumni/components/`:

| Component | Purpose |
|---|---|
| `AlumniCard` | Grid card with photo, name, batch, company |
| `AlumniSearch` | Multi-filter search |
| `VerificationBadge` | Status badge (pending/verified) |
| `PrivacySelector` | Public/Alumni Only/Private |
| `EventCard` | Event summary with register button |
| `JobCard` | Job summary with apply button |
| `CampaignCard` | Campaign with progress bar |
| `DonationForm` | Payment integration |
| `ReceiptPDF` | PDF generator for receipts |
| `SkillTags` | Editable skill tags for jobs |

---

## State Management

- React Query for server state
- Local state for forms
- Payment gateway integration (Razorpay/Stripe)

---

## Responsive Breakpoints

- Directory: 1 col <576px, 2 col <768px, 3 col <992px, 4 col ≥992px
- Tables: Horizontal scroll on mobile
- Forms: Stack on mobile
- Job/Event cards: 1 col mobile, 2 col tablet, 3 col desktop