# Certificates & ID — Test Scenarios

**Version 1.0** · 4 November 2026

---

## Test Structure

```
test/
├── certificates/
│   ├── templates/
│   ├── idcards/
│   ├── tc/
│   ├── generation/
│   └── verification/
├── factories/
│   ├── studentFactory.js
│   ├── templateFactory.js
│   └── tcFactory.js
└── helpers/
    ├── auth.js
    └── pdf.js
```

---

## A. Template Designer

| ID | Scenario | Given | When | Then |
|---|---|---|---|---|
| A1 | Create ID front template | Admin in designer | Add student.name, student.photo, school.logo, qr_code | Template saved, fields positioned |
| A2 | Dynamic field config | Field dropped | Set source=school_students, field=first_name | Preview shows student first name |
| A3 | Field transform | Dynamic field | Set transform=uppercase | Preview shows UPPERCASE name |
| A4 | Template versioning | Template v1 exists | Click "New Version" | v2 created, v1 immutable |
| A5 | Template clone | Template v1 | Click Clone | v2 created with same fields |
| A6 | Template preview | Template with fields | Open preview, select student | Live data rendered |
| A7 | Template type filter | 5 templates | Filter by "tc" | Only TC templates shown |
| A8 | Background image | Template edit | Upload background | Image set, rendered in canvas |
| A9 | Field properties | Field selected | Change font, size, color | Canvas updates live |
| A10 | QR/Barcode field | Add system field | Select qr_code | QR rendered in preview |

---

## B. Document Generation

| ID | Scenario | Given | When | Then |
|---|---|---|---|---|
| B1 | Generate ID card individual | Template ID front/back, student | Generate | PDF downloaded, front/back correct |
| B2 | Generate TC individual | TC approved, template | Generate | PDF with TC number, QR valid |
| B3 | Bulk ID cards | Class 10A, 40 students | Generate bulk | Job completes, 40 PDFs in ZIP |
| B4 | Bulk progress | 200 students | Generate bulk | Progress bar updates, no timeout |
| B5 | Reissue ID card | Lost card, reason=lost | Reissue | New card issued, history logged |
| B6 | Template change protection | ID card generated, template changed | View old ID card | Old card unchanged |
| B7 | Certificate number unique | 2 TC generated same session | Check numbers | TC-2026-00001, TC-2026-00002 |
| B8 | Certificate register entry | TC generated | Check register | Entry with cert_no, student, date |
| B9 | Reissue marks original | Reissue ID card | Check history | Original=reissued, new=active |
| B10 | Download generated | Document generated | Click download | PDF downloads, correct content |

---

## C. ID Card Management

| ID | Scenario | Given | When | Then |
|---|---|---|---|---|
| C1 | List ID cards | 50 ID cards | Open list | Paginated, filterable |
| C2 | Filter by session | ID cards across sessions | Filter session=2026-27 | Only that session |
| C3 | Filter by status | Mixed statuses | Filter status=lost | Only lost cards |
| C4 | Reissue lost | ID card status=active | Reissue reason=lost | Status=reissued, new card created |
| C5 | Reissue damaged | ID card status=active | Reissue reason=damaged | New card, history logged |
| C6 | Reprint | ID card active | Click Reprint | PDF generated |
| C7 | Bulk print | 20 ID cards selected | Bulk print | PDF with crop marks, 10 per page |
| C8 | Student photo missing | Student no photo | Generate ID card | Fallback placeholder or error |
| C9 | ID card expiry | Expiry date set | Check status | Status=expired after date |
| C10 | History log | Reissued card | View history | Shows issued→reissued with reason |

---

## D. TC Certificate Workflow

| ID | Scenario | Given | When | Then |
|---|---|---|---|---|
| D1 | Apply TC | Parent logged in | Fill leaving date, reason, submit | Request created, status=submitted |
| D2 | Clearance check auto | Request submitted | System checks | Fee✓, Library✓, Hostel✗, Lab✓ |
| D3 | Clearance pending blocks | One clearance pending | Try approve | Blocked, shows pending items |
| D4 | All clear → approve | All clearances ✓ | Principal approves | Status=approved, auto-generate triggered |
| D5 | Reject with reason | Request pending | Principal rejects with reason | Status=rejected, parent notified |
| D6 | TC number format | First TC of session | Generate | TC-2026-00001 |
| D7 | Duplicate TC prevented | TC generated | Try generate again | Error: already generated |
| D7 | Student status update | TC generated | Check student | Status=left/transferred |
| D8 | Register entry | TC generated | Check register | Entry with TC-2026-00001 |
| D9 | Parent view | Parent logged in | View TC requests | Sees status, download if generated |
| D10 | Cancel request | Request pending | Parent cancels | Status=cancelled, admin notified |

---

## E. Certificate Register & Verification

| ID | Scenario | Given | When | Then |
|---|---|---|---|---|
| E1 | Register search | 100 certificates | Search by student | Filtered results |
| E2 | Filter by type | Mixed types | Filter type=tc | Only TC certificates |
| E3 | Filter by date | 6 months data | Date range last month | Correct subset |
| E4 | Export CSV | 500 certificates | Click Export | CSV with all columns |
| E5 | Verify valid TC | TC-2026-00001 exists | Verify page | Shows valid, student name, date |
| E6 | Verify invalid TC | TC-99999 not exist | Verify page | Shows invalid |
| E7 | Verify revoked | TC cancelled | Verify page | Shows revoked |
| E8 | QR scan | TC with QR | Camera scan | Auto-fills cert number, verifies |
| E9 | Rate limit | 15 requests/min | Rapid requests | 429 after 10 |
| E10 | No sensitive data | Verify valid | Check response | No parent contacts, address |

---

## F. Permissions

| ID | Scenario | Given | When | Then |
|---|---|---|---|---|
| F1 | Parent cannot design template | Parent role | Open designer | 403 |
| F2 | Teacher cannot approve TC | Teacher role | Try approve | 403 |
| F3 | Student cannot generate ID | Student role | Try generate | 403 |
| F4 | Admin can all | Super Admin | All actions | 200 |
| F5 | Principal approves TC | Principal role | Approve | 200 |
| F6 | Auditor read-only | Auditor role | Try generate | 403 |
| F7 | Parent views own TC only | Parent with 2 children | View requests | Only own children |
| F8 | Parent applies TC for child | Parent | Submit for child A | Success |
| F9 | Parent cannot apply for other | Parent | Try submit for child B (not theirs) | 403 |

---

## G. Edge Cases & Stress

| ID | Scenario | Given | When | Then |
|---|---|---|---|---|
| G1 | 200 bulk ID cards | Class 10A, 200 students | Generate | Completes <30s, all valid |
| G2 | Concurrent TC generation | 2 admins approve same time | Simultaneous | Sequential, numbers sequential |
| G3 | Large template | 100 dynamic fields | Generate | <3s per document |
| G4 | PDF generation failure | Disk full | Generate | Error logged, status=failed, retry |
| G5 | Network timeout | Slow generation | User waits | Toast: processing, no duplicate |
| G6 | Deleted student | Student deleted | View TC request | Shows "Deleted Student" |
| G7 | Template deleted | Template archived | View generated doc | Shows archived template data |
| G8 | Session change | New academic year | Generate ID cards | Uses new session |

---

## H. Integration Tests

| ID | Scenario | Modules |
|---|---|---|
| H1 | TC approved → fee clearance checked | Certificates + Fees |
| H2 | TC approved → library clearance checked | Certificates + Library |
| H3 | TC approved → student status updated | Certificates + Students |
| H4 | ID card generated → notification sent | Certificates + Communication |
| H4 | TC generated → student status=left | Certificates + Students |
| H5 | Template background → file upload | Certificates + Files |
| H6 | Student photo → ID card photo | Certificates + Students |
| H7 | TC verification → public page | Certificates + Web |

---

## Test Data Factories

```javascript
// factories/templateFactory.js
export const createTemplate = (overrides = {}) => ({
  name: 'TC Certificate Standard',
  type: 'tc',
  version: 1,
  status: 'active',
  canvas_json: { objects: [], background: '' },
  ...overrides
});

// factories/tcFactory.js
export const createTCRequest = (overrides = {}) => ({
  student_id: 1,
  leaving_date: addDays(new Date(), 30),
  reason: 'Transfer to another city',
  status: 'submitted',
  ...overrides
});

export const createTCApproval = (overrides = {}) => ({
  tc_request_id: 1,
  clearance_fee: true,
  clearance_library: true,
  clearance_hostel: true,
  clearance_lab: true,
  status: 'approved',
  tc_number: 'TC-2026-00001',
  ...overrides
});
```

---

## Test Execution

```bash
# Unit tests
npm test -- --testPathPattern=certificates

# Integration tests
npm run test:integration -- certificates

# E2E tests
npm run test:e2e -- --spec="certificates/**"

# Load test bulk generation
npm run test:load -- idcard-bulk
```

---

## CI/CD Gates

| Gate | Criteria |
|---|---|
| Unit tests | ≥90% coverage on certificates module |
| Integration tests | All H scenarios pass |
| Load test | 200 bulk ID cards <30s |
| Security | No permission bypasses, rate limiting on verify |
| Audit | All write actions logged |
| PDF quality | Visual regression on sample outputs |