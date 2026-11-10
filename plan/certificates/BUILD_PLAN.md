# Certificates & ID Management — Build Plan

**Version 1.0** · Based on `DESIGN.md` · 4 November 2026

---

## Overview

The module is built in four sequential steps plus one optional hardening step. Each step delivers working, testable functionality.

**Dependencies**
- Students master (`school_students`, guardian, photo)
- Parent/Guardian master (`school_guardians`)
- Academic (`school_academic_years`, `school_classes`, `school_sections`)
- Staff/HR (`school_staff` for signatures)
- Fee module (`school_fee_invoice`, clearance check)
- File management (`school_files` for templates, PDFs, photos)
- Communication (notifications for TC/ID events)

**Migration files:** `sql/80_certificates_core.sql`, `sql/81_certificates_ops.sql`

**Backend router:** `server/src/routes/school_certificates.js`, mounted at `/api/school` **before** `school_comp_router`.

**Frontend routes:** `/school/certificates/templates`, `/school/certificates/generate`, `/school/certificates/idcards`, `/school/certificates/tc`.

---

## Build steps

| Step | Deliverable | Done when |
|---|---|---|
| 1 | Templates | Designer works, dynamic fields populate, versioning |
| 2 | ID Cards | Individual/bulk generation, front/back, print, reissue |
| 3 | TC Certificate | Request → clearance → approval → generation → register |
| 4 | Reports & Hardening | Roles, audit, exports, testing |
| 5 | Later (optional) | Digital signatures, blockchain, multi-lang, verification portal |

---

## Step 1: Templates

**Target:** Visual designer with dynamic fields, preview, versioning.

### Database
- `school_document_template` – template metadata
- `school_template_field` – field positions, dynamic config
- Indexes on `type`, `status`, `version`

### Backend API (`/api/school/certificates/*`)
| Endpoint | Method | Purpose |
|---|---|---|
| `/templates` | GET/POST | List/create templates |
| `/templates/:id` | GET/PUT/DELETE | Detail/update/soft-delete |
| `/templates/:id/version` | POST | Create new version |
| `/templates/:id/fields` | GET/POST/PUT | Manage dynamic fields |
| `/templates/:id/preview` | GET | Live preview with sample data |
| `/templates/:id/clone` | POST | Clone template |

### Frontend Screens
| Screen | File | Route |
|---|---|---|
| Template Management | `Templates.jsx` | `/school/certificates/templates` |
| Template Designer | `TemplateDesigner.jsx` | `/school/certificates/templates/designer/:id` |
| Template Preview | `TemplatePreview.jsx` | `/school/certificates/templates/preview/:id` |

### UI Components
- `TemplateCanvas` – Fabric.js/Canvas for drag-drop
- `FieldPalette` – Draggable field list (Student, Parent, Academic, School, Staff, System)
- `FieldProperties` – Position, font, size, color, alignment
- `DynamicFieldConfig` – Source table/field mapper
- `TemplatePreview` – Live render with sample data

### Permission
- `certificates.view` — read templates
- `certificates.templates` — create/edit/version

### Done When
- Designer creates template with dynamic fields
- Preview renders live student data
- Versioning creates immutable copies
- Template types: ID Front, ID Back, TC, Bonafide, Custom

---

## Step 2: ID Cards

**Target:** Individual/bulk generation, front/back, print, reissue.

### Database
- `school_id_card` – issued ID card record
- `school_id_card_history` – reissue tracking
- Foreign keys to templates, student, session

### Backend API
| Endpoint | Method | Purpose |
|---|---|---|
| `/idcards` | GET/POST | List/generate individual |
| `/idcards/bulk` | POST | Bulk generate (class/section filters) |
| `/idcards/:id` | GET/PUT | Detail/reprint |
| `/idcards/:id/reissue` | POST | Reissue with reason |
| `/idcards/print` | GET | Batch PDF with crop marks |
| `/idcards/history/:id` | GET | Reissue history |

### Frontend Screens
| Screen | File | Route |
|---|---|---|
| ID Card Management | `IDCards.jsx` | `/school/certificates/idcards` |
| ID Card Print | `IDCardPrint.jsx` | `/school/certificates/idcards/print` |

### UI Components
- `IDCardList` — Table with student, status, actions
- `BulkGenerateModal` — Class/section/session filters, progress
- `IDCardPreview` — Front/back side-by-side
- `ReissueModal` — Reason, template selection
- `PrintQueue` — Batch PDF generator

### Hard rules enforced by API
- Student must have photo (configurable fallback)
- Active student only
- Bulk generation respects class/section filters
- Reissue marks original as reissued
- Certificate number unique per session

### Done When
- Individual ID card generates correct data
- Bulk generation processes 200 students <30s
- Front/back PDF with QR/barcode
- Reissue tracks history
- Batch print with crop marks

---

## Step 3: TC Certificate

**Target:** Request → clearance → approval → generation → register.

### Database
- `school_tc_request` – parent/student request
- `school_tc_approval` – clearance + approval
- `school_certificate_register` – master register

### Backend API
| Endpoint | Method | Purpose |
|---|---|---|
| `/tc/apply` | POST | Submit TC request |
| `/tc/requests` | GET | List requests (admin/parent) |
| `/tc/requests/:id` | GET | Detail with clearance status |
| `/tc/requests/:id/clearance` | GET | Clearance check details |
| `/tc/requests/:id/approve` | POST | Principal approval |
| `/tc/requests/:id/reject` | POST | Reject with reason |
| `/tc/generate/:id` | POST | Generate TC (auto on approval) |
| `/tc/register` | GET | Certificate register |
| `/tc/verify/:certNo` | GET | Public verification |

### Frontend Screens
| Screen | File | Route |
|---|---|---|
| TC Application | `TCApplication.jsx` | `/school/certificates/tc/apply` |
| TC Approval | `TCApproval.jsx` | `/school/certificates/tc/approve` |
| TC Generation | `TCGeneration.jsx` | `/school/certificates/tc/generate` |
| Certificate Register | `CertificateRegister.jsx` | `/school/certificates/register` |
| Document Verification | `DocumentVerification.jsx` | `/school/certificates/verify` |

### UI Components
- `TCApplyForm` — Reason, leaving date, auto-fetch student data
- `ClearancePanel` — Fee, Library, Hostel, Lab status
- `ApprovalCard` — Approve/Reject with remarks
- `TCPreview` — Live render with certificate number
- `RegisterTable` — Search, filter, export
- `VerificationPage` — Public QR scan

### Workflow Enforced by API
1. Parent submits request → status=submitted
2. System auto-checks clearances (Fee, Library, Hostel, Lab)
3. If any pending → block, show reasons
4. All clear → submit for approval
5. Principal approves → auto-generate TC number + PDF
6. Student status → "Left/Transferred"
7. Register updated

### Hard rules
- TC requires all clearance checks (configurable)
- TC requires approval (configurable)
- Certificate number unique per session
- Duplicate TC marked as reissue
- Student status updated only after approval

### Done When
- Parent submits request with auto clearance check
- Principal approves/rejects with audit
- TC auto-generates with unique number
- PDF renders correctly with QR
- Register searchable and exportable
- Public verification works

---

## Step 4: Reports & Hardening

### Reports
- ID card generation report
- Pending ID card report
- Lost/reissued ID card report
- TC issued report
- Pending TC approval
- Class-wise certificate report
- Certificate number register
- Duplicate certificate report

### Hardening
- Mask student data in exports for non-admins
- Role-based access: admin, principal, teacher, parent
- Retention settings for generated PDFs
- Audit every generation/reissue/approval
- Export CSV from every report
- Public verification rate-limited

### Done When
- Inspector can see certificate stats
- Sensitive actions audited
- Retention and masking enforced

---

## Step 5: Later (optional)

Digital signatures, blockchain verification, multi-language templates, online verification portal. Add only when needed.

---

## Permissions

| Permission | Purpose |
|---|---|
| `certificates.view` | Read all certificate screens |
| `certificates.manage` | Full setup and operations (superset) |
| `certificates.templates` | Template management |
| `certificates.idcards` | ID Card management |
| `certificates.tc` | TC Certificate workflow |
| `certificates.reports` | Reports and exports |

`certificates.manage` is a superset for backward compatibility.

---

## Quick start

```bash
node server/_schoolsetup.mjs school_erp
npm run dev
```

Login as `ADMIN` to see **Certificates & ID** in the menu: Templates, Generate, ID Cards, TC Certificate.