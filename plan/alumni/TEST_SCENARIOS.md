# Alumni & Placement — Test Scenarios

**Version 1.0** · 4 November 2026

---

## Test Structure

```
test/
├── alumni/
│   ├── directory/
│   ├── events/
│   ├── jobs/
│   ├── donations/
│   └── reports/
├── factories/
│   ├── studentFactory.js
│   ├── alumniFactory.js
│   ├── eventFactory.js
│   ├── jobFactory.js
│   └── donationFactory.js
└── helpers/
    ├── auth.js
    ├── payment.js
    └── pdf.js
```

---

## A. Alumni Directory

| ID | Scenario | Given | When | Then |
|---|---|---|---|---|
| A1 | Auto-create alumni | Student status=left | TC generated | Alumni record created, status=pending_registration |
| A2 | Self-registration | Alumni invite token | Submit form | Pre-filled from student, status=pending_registration |
| A3 | Duplicate registration | Alumni record exists | Try register again | Error: already registered |
| A4 | Admin verification | Pending alumni | Admin clicks Approve | Status=verified, alumni notified |
| A5 | Reject verification | Pending alumni | Admin clicks Reject | Status=rejected, alumni notified with reason |
| A6 | Profile privacy | Privacy=alumni_only | Other alumni views | Profile visible |
| A7 | Profile privacy | Privacy=private | Other alumni views | Profile not visible |
| A8 | Profile privacy | Privacy=public | Public views | Profile visible |
| A9 | Search by batch | 100 alumni | Filter passing_year=2020 | Only 2020 batch |
| A10 | Search by company | 50 alumni at Google | Filter company=Google | Only Google employees |
| A11 | Search by location | 30 alumni in Bangalore | Filter location=Bangalore | Only Bangalore alumni |
| A12 | Profile edit | Verified alumni | Edit company, designation | Updated, timestamp saved |
| A13 | Education add | Verified alumni | Add MBA, IIM, 2022 | Entry added, listed in profile |
| A14 | Duplicate prevention | Student left twice | Two TCs | Only one alumni record |

---

## B. Alumni Events

| ID | Scenario | Given | When | Then |
|---|---|---|---|---|
| B1 | Create event | Admin | Fill title, date, venue, capacity=100 | Event created, status=draft |
| B2 | Publish event | Draft event | Click Publish | Status=published, notifications sent |
| B3 | Register for event | Published event, capacity=50 | Alumni registers | Registration confirmed, count=1 |
| B4 | Capacity limit | Event capacity=50, 50 registered | 51st registers | Added to waitlist |
| B5 | Waitlist promotion | Registration cancelled | Waitlist exists | Next promoted, notified |
| B5 | Registration fee | Event fee=500 | Register | Payment required, confirmed after payment |
| B6 | Cancel registration | Confirmed registration | Alumni cancels | Status=cancelled, slot freed |
| B7 | Attendance marking | Event day | Admin marks attendance | Attendance recorded |
| B8 | Feedback submission | Event completed | Alumni submits feedback | Saved, rating recorded |
| B9 | Photo upload | Event completed | Admin uploads photos | Photos in album, approval if public |
| B10 | Event cancellation | Published with registrations | Cancel | All registrations cancelled, notified |

---

## C. Job Postings

| ID | Scenario | Given | When | Then |
|---|---|---|---|---|
| C1 | Post job | Verified alumni | Fill form, submit | Status=draft, awaits approval |
| C2 | School posts job | Admin | Fill form, submit | Status=pending_approval |
| C3 | Approve job | Pending job | Admin approves | Status=active, visible to alumni |
| C4 | Reject job | Pending job | Admin rejects with reason | Status=rejected, poster notified |
| C5 | Job expiry | Active job, deadline passed | Scheduled job runs | Status=expired, not visible |
| C6 | Apply for job | Active job, verified alumni | Click Apply, upload resume | Application created, poster notified |
| C7 | Apply without resume | Job requires resume | Apply without | Warning, optional |
| C8 | Application status | Application exists | Poster updates status | Status updated, applicant notified |
| C9 | Job search | 100 jobs | Filter: location=Bangalore, type=full_time | Filtered results |
| C10 | Skill filter | Jobs with skills | Filter skills=React,Node | Matching jobs |
| C11 | Expired job cleanup | 50 expired jobs | Scheduled job | Status=expired, hidden from listings |

---

## D. Donations

| ID | Scenario | Given | When | Then |
|---|---|---|---|---|
| D1 | Create campaign | Admin | Fill title, target=100000, dates | Campaign created, status=draft |
| D2 | Publish campaign | Draft campaign | Click Publish | Status=active, visible to donors |
| D3 | Donate online | Active campaign | Alumni donates 5000 | Payment initiated, status=pending |
| D4 | Payment success | Payment gateway success | Webhook received | Donation=successful, receipt generated |
| D5 | Payment failure | Payment gateway fails | Webhook received | Donation=failed, no receipt |
| D6 | Receipt generation | Donation successful | Auto-trigger | Receipt PDF with unique number |
| D7 | Refund donation | Successful donation | Admin refunds | Donation=refunded, receipt voided |
| D8 | Campaign target | Campaign target=100000, collected=100000 | Auto-check | Status=completed, admin notified |
| D9 | Anonymous donation | Campaign active | Donor checks anonymous | Donor hidden in reports |
| D10 | Refund tracking | Refund processed | Check audit | Original transaction preserved |

---

## E. Reports

| ID | Scenario | Given | When | Then |
|---|---|---|---|---|
| E1 | Year-wise alumni | 5 years data | Run report | Count per year |
| E2 | Class-wise alumni | 10 classes | Run report | Count per class |
| E3 | Employment report | 200 alumni | Run report | Company, designation, industry |
| E4 | Company-wise alumni | 50 companies | Run report | Count per company |
| E5 | Event participation | 10 events | Run report | Registrations, attendance per event |
| E6 | Job postings | 20 jobs | Run report | Posted, active, expired, applications |
| E7 | Job applications | 50 applications | Run report | Status distribution |
| E8 | Donation collection | 100 donations | Run report | Total, by campaign, by month |
| E9 | Campaign-wise donation | 5 campaigns | Run report | Target vs collected |
| E10 | Donor history | 50 donors | Run report | Total given, campaigns, receipts |

---

## F. Permissions

| ID | Scenario | Given | When | Then |
|---|---|---|---|---|
| F1 | Alumni cannot verify | Alumni role | Try verify | 403 |
| F2 | Alumni cannot approve job | Alumni role | Try approve | 403 |
| F3 | Parent cannot create campaign | Parent role | Try POST /campaigns | 403 |
| F4 | Admin can all | Super Admin | All actions | 200 |
| F5 | Placement officer approves job | Placement Officer role | Approve job | 200 |
| F6 | Auditor read-only | Auditor role | Try write | 403 |
| F7 | Alumni views own donations only | Alumni | View donations | Only own |
| F8 | Alumni applies for job | Verified alumni | Apply | Success |
| F9 | Unverified alumni cannot apply | Unverified alumni | Try apply | 403 |

---

## G. Edge Cases & Stress

| ID | Scenario | Given | When | Then |
|---|---|---|---|---|
| G1 | 500 concurrent donations | Campaign target=100000 | Simultaneous donate | All processed, collected correct |
| G2 | Large alumni directory | 10000 alumni | Search | <2s response |
| G3 | Large event | Capacity 5000 | 5000 register | No deadlock, waitlist correct |
| G4 | Payment gateway timeout | Donation pending | Timeout | Status=failed, retryable |
| G5 | Network failure | Mid-donation | Disconnect | Idempotent, no double charge |
| G6 | Deleted alumni | Alumni deleted | View event registration | Shows "Deleted Alumni" |
| G7 | Job poster deleted | Job posted by alumni | Poster deleted | Job remains, poster="Deleted Alumni" |
| G8 | Campaign deleted | Donations exist | Soft-delete campaign | Donations retained, campaign hidden |

---

## H. Integration Tests

| ID | Scenario | Modules |
|---|---|---|
| H1 | Student left → alumni created | Alumni + Students |
| H2 | Donation → fee payment recorded | Alumni + Fees |
| H3 | Event registration → notification sent | Alumni + Communication |
| H4 | Job posted → notification to alumni | Alumni + Communication |
| H5 | Alumni profile photo → file upload | Alumni + Files |
| H6 | Donation receipt → PDF generation | Alumni + Files |
| H7 | Alumni event → school event cross-reg | Alumni + Events |

---

## Test Data Factories

```javascript
// factories/alumniFactory.js
export const createAlumni = (overrides = {}) => ({
  student_id: 1,
  passing_year: 2020,
  status: 'verified',
  ...overrides
});

export const createAlumniProfile = (overrides = {}) => ({
  alumni_id: 1,
  company: 'Tech Corp',
  designation: 'Software Engineer',
  industry: 'IT',
  location: 'Bangalore',
  privacy_level: 'alumni_only',
  ...overrides
});

// factories/eventFactory.js
export const createAlumniEvent = (overrides = {}) => ({
  title: 'Annual Alumni Meet 2026',
  event_type: 'reunion',
  start_dt: addDays(new Date(), 30),
  end_dt: addDays(new Date(), 30, 4),
  venue: 'School Auditorium',
  max_capacity: 200,
  registration_fee: 500,
  reg_open_dt: addDays(new Date(), 1),
  reg_close_dt: addDays(new Date(), 25),
  status: 'published',
  ...overrides
});

// factories/jobFactory.js
export const createJobPosting = (overrides = {}) => ({
  company: 'Tech Corp',
  title: 'Senior Developer',
  employment_type: 'full_time',
  experience_required: '3-5 years',
  qualification: 'B.Tech',
  skills: ['React', 'Node.js'],
  location: 'Bangalore',
  salary_min: 1500000,
  salary_max: 2500000,
  deadline: addDays(new Date(), 30),
  status: 'active',
  ...overrides
});

// factories/donationFactory.js
export const createDonationCampaign = (overrides = {}) => ({
  title: 'School Infrastructure Fund',
  category: 'infrastructure',
  target_amount: 1000000,
  start_dt: new Date(),
  end_dt: addDays(new Date(), 90),
  status: 'active',
  ...overrides
});

export const createDonation = (overrides = {}) => ({
  campaign_id: 1,
  donor_id: 1,
  donor_type: 'alumni',
  amount: 5000,
  payment_mode: 'online',
  status: 'successful',
  ...overrides
});
```

---

## Test Execution

```bash
# Unit tests
npm test -- --testPathPattern=alumni

# Integration tests
npm run test:integration -- alumni

# E2E tests
npm run test:e2e -- --spec="alumni/**"

# Load test donations
npm run test:load -- donation-concurrent
```

---

## CI/CD Gates

| Gate | Criteria |
|---|---|
| Unit tests | ≥90% coverage on alumni module |
| Integration tests | All H scenarios pass |
| Load test | 500 concurrent donations <2s p99 |
| Security | No permission bypasses, payment idempotency |
| Audit | All write actions logged |
| Payment | PCI DSS compliance for gateway |