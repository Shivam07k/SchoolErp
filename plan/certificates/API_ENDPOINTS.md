# Certificates & ID — API Endpoints

**Base Path:** `/api/school/certificates`  
**Authentication:** Bearer token, tenant-scoped  
**Permissions:** `certificates.view`, `certificates.templates`, `certificates.idcards`, `certificates.tc`, `certificates.reports`, `certificates.manage`

---

## Templates

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/templates` | `certificates.view` | List templates (filter by type, status) |
| POST | `/templates` | `certificates.templates` | Create template |
| GET | `/templates/:id` | `certificates.view` | Template detail with fields |
| PUT | `/templates/:id` | `certificates.templates` | Update template |
| DELETE | `/templates/:id` | `certificates.templates` | Soft-delete |
| POST | `/templates/:id/version` | `certificates.templates` | Create new version |
| GET | `/templates/:id/fields` | `certificates.view` | List dynamic fields |
| POST | `/templates/:id/fields` | `certificates.templates` | Add field |
| PUT | `/templates/:id/fields/:fieldId` | `certificates.templates` | Update field |
| DELETE | `/templates/:id/fields/:fieldId` | `certificates.templates` | Delete field |
| GET | `/templates/:id/preview` | `certificates.view` | Live preview with sample student |
| POST | `/templates/:id/clone` | `certificates.templates` | Clone template |

---

## Document Generation

| Method | Path | Permission | Purpose |
|---|---|---|---|
| POST | `/generate` | `certificates.templates` | Generate individual document |
| POST | `/generate/bulk` | `certificates.templates` | Bulk generate (class/section filters) |
| GET | `/generate/status/:jobId` | `certificates.view` | Bulk job progress |
| GET | `/generated` | `certificates.view` | List generated documents |
| GET | `/generated/:id` | `certificates.view` | Document detail |
| GET | `/generated/:id/download` | `certificates.view` | Download PDF |
| POST | `/generated/:id/reissue` | `certificates.templates` | Reissue with reason |

---

## ID Cards

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/idcards` | `certificates.view` | List ID cards (filter by student, session, status) |
| POST | `/idcards` | `certificates.idcards` | Generate individual ID card |
| POST | `/idcards/bulk` | `certificates.idcards` | Bulk generate (class/section/session) |
| GET | `/idcards/:id` | `certificates.view` | ID card detail |
| PUT | `/idcards/:id` | `certificates.idcards` | Update (reprint) |
| POST | `/idcards/:id/reissue` | `certificates.idcards` | Reissue (lost/damaged) |
| GET | `/idcards/print` | `certificates.idcards` | Batch PDF with crop marks |
| GET | `/idcards/history/:id` | `certificates.view` | Reissue history |

---

## TC Certificate

| Method | Path | Permission | Purpose |
|---|---|---|---|
| POST | `/tc/apply` | `certificates.tc` | Submit TC request (parent) |
| GET | `/tc/requests` | `certificates.tc` | List requests (filter by status) |
| GET | `/tc/requests/:id` | `certificates.tc` | Request detail with clearance |
| GET | `/tc/requests/:id/clearance` | `certificates.tc` | Clearance check details |
| POST | `/tc/requests/:id/approve` | `certificates.tc` | Principal approve |
| POST | `/tc/requests/:id/reject` | `certificates.tc` | Reject with reason |
| POST | `/tc/generate/:id` | `certificates.tc` | Generate TC (auto on approve) |
| GET | `/tc/register` | `certificates.reports` | Certificate register |
| GET | `/tc/verify/:certNo` | `public` | Public verification (rate-limited) |

---

## Reports

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/reports/idcards` | `certificates.reports` | ID card generation report |
| GET | `/reports/idcards/pending` | `certificates.reports` | Pending ID cards |
| GET | `/reports/idcards/reissued` | `certificates.reports` | Lost/reissued report |
| GET | `/reports/tc` | `certificates.reports` | TC issued report |
| GET | `/reports/tc/pending` | `certificates.reports` | Pending TC approvals |
| GET | `/reports/class` | `certificates.reports` | Class-wise certificate report |
| GET | `/reports/register` | `certificates.reports` | Certificate number register |
| GET | `/reports/duplicates` | `certificates.reports` | Duplicate certificate report |

---

## Settings & Notifications

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/settings` | `certificates.manage` | Get settings |
| PUT | `/settings` | `certificates.manage` | Update settings |
| GET | `/notifications` | `certificates.view` | Notification history |

---

## Default Settings

```json
{
  "certificate_number_format": "TC-{SESSION}-{SEQ:05d}",
  "id_card_validity_months": 12,
  "tc_clearance_fee": true,
  "tc_clearance_library": true,
  "tc_clearance_hostel": true,
  "tc_clearance_lab": true,
  "tc_approval_required": true,
  "default_tc_template_id": 1,
  "id_card_qr_enabled": true,
  "id_card_barcode_enabled": true,
  "photo_required_for_id": true,
  "photo_fallback_placeholder": true
}
```