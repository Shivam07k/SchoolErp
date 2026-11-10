# Certificates & ID — Frontend Screens

**Stack:** React 18, Vite, Bootstrap 5, Fabric.js (canvas), React Router  
**Base Path:** `/school/certificates`  
**Dispatch:** From `src/components/SchoolPage.jsx` → `module === 'certificates'`

---

## Routes

| Route | File | Tab Key |
|---|---|---|
| `/school/certificates/templates` | `Templates.jsx` | `templates` |
| `/school/certificates/templates/designer/:id` | `TemplateDesigner.jsx` | `template-designer` |
| `/school/certificates/templates/preview/:id` | `TemplatePreview.jsx` | `template-preview` |
| `/school/certificates/generate` | `Generate.jsx` | `generate` |
| `/school/certificates/idcards` | `IDCards.jsx` | `idcards` |
| `/school/certificates/idcards/print` | `IDCardPrint.jsx` | `idcards-print` |
| `/school/certificates/tc/apply` | `TCApplication.jsx` | `tc-apply` |
| `/school/certificates/tc/approve` | `TCApproval.jsx` | `tc-approve` |
| `/school/certificates/tc/generate` | `TCGeneration.jsx` | `tc-generate` |
| `/school/certificates/register` | `CertificateRegister.jsx` | `register` |
| `/school/certificates/verify` | `DocumentVerification.jsx` | `verify` |

---

## Shared Helpers

`src/pages/school/certificates/shared.jsx` exports:
```js
export { PageShell, Empty, Loading, Badge, fmtDate, downloadCsv };
export { TemplateCanvas, FieldPalette, FieldProperties, DynamicFieldConfig };
```

---

## Screen Details

### 1. Templates `Templates.jsx` — `/school/certificates/templates`

**Tabs:**
- **All Templates** — Searchable table: Name, Type, Version, Status, Actions
- **Active** — Filter status=active
- **Archived** — Filter status=archived

**Table Columns:** Name, Type, Version, Status, Created, Actions

**Actions:** View, Edit, Preview, Clone, Version, Delete

**Create/Edit Modal:** Name, Type, Category, Background upload

**Permissions:** `certificates.view` (read), `certificates.templates` (write)

---

### 2. Template Designer `TemplateDesigner.jsx` — `/school/certificates/templates/designer/:id`

**Layout:** 3-pane layout
- **Left:** `FieldPalette` — Draggable fields grouped by category
- **Center:** `TemplateCanvas` — Fabric.js canvas, A4/ID card size
- **Right:** `FieldProperties` + `DynamicFieldConfig`

**FieldPalette Groups:**
- **Student:** name, admission_no, class, section, dob, gender, photo, blood_group, address, father_name, mother_name, contact
- **Parent:** father_name, mother_name, occupation, contact, email, address
- **Academic:** session, stream, subjects, grades, attendance_pct, rank
- **Fee:** clearance_status, due_amount, last_payment
- **School:** name, address, logo, affiliation_no, principal_name, contact, seal
- **Staff:** principal_name, class_teacher_name, signature
- **System:** certificate_no, issue_date, qr_code, barcode

**Canvas Features:**
- Drag-drop from palette
- Click field → `FieldProperties` panel
- Dynamic field → `DynamicFieldConfig` panel (source table/field, transform)
- Rulers, grid, snap-to-grid
- Zoom, pan
- Undo/redo

**Template Types:** A4 (TC, Bonafide), ID Card (54×86mm), Custom

**Save:** PUT `/api/school/certificates/templates/:id` with canvas JSON + fields

**Permissions:** `certificates.templates`

---

### 3. Template Preview `TemplatePreview.jsx` — `/school/certificates/templates/preview/:id`

**Features:**
- Live render with sample student data
- Switch sample student (dropdown)
- Toggle dynamic/static field highlight
- Download sample PDF

**Flow:**
1. GET `/api/school/certificates/templates/:id/preview?studentId=123`
2. Render canvas with merged data
2. Show field boundaries on hover

**Permissions:** `certificates.view`

---

### 4. Generate `Generate.jsx` — `/school/certificates/generate`

**Tabs:**
- **Individual** — Single document
- **Bulk** — Class/section filters

**Individual Form:**
- Template select (filtered by type)
- Student search (name, admission no)
- Preview button → opens `TemplatePreview` modal
- Generate → POST `/generate` → download PDF

**Bulk Form:**
- Template select
- Class/Section/Session multi-select
- Student count preview
- Generate → POST `/generate/bulk` → job ID
- Progress bar → polls `/generate/status/:jobId`
- Complete → download ZIP or individual PDFs

**Permissions:** `certificates.templates` (generate), `certificates.view` (preview)

---

### 5. ID Cards `IDCards.jsx` — `/school/certificates/idcards`

**Tabs:**
- **All** — Searchable table: Student, Class, Session, Status, Issue Date, Actions
- **Active** — Filter status=active
- **Reissued** — Filter status=reissued
- **Lost/Damaged** — Filter status=lost/damaged

**Table Columns:** Student, Admission No, Class, Session, Status, Issue Date, Actions

**Actions:** View, Reprint, Reissue, History

**Bulk Generate Button:** Opens `BulkGenerateModal`

**BulkGenerateModal:**
- Front/Back template select
- Class/Section/Session filters
- Student count
- Generate → progress → download ZIP/print queue

**ReissueModal:**
- Reason select (lost/damaged)
- Template re-select (optional)
- Confirm → POST `/idcards/:id/reissue`

**Permissions:** `certificates.view` (read), `certificates.idcards` (write)

---

### 6. ID Card Print `IDCardPrint.jsx` — `/school/certificates/idcards/print`

**Features:**
- Batch PDF with crop marks
- Layout: 10 cards per A4 (5×2)
- Front/back alignment
- QR/barcode verification
- Download or print directly

**Flow:**
1. Select ID cards (checkboxes or bulk job)
2. Configure layout (crop marks, spacing)
3. Generate PDF → download

**Permissions:** `certificates.idcards`

---

### 7. TC Application `TCApplication.jsx` — `/school/certificates/tc/apply`

**Form Sections:**
- **Student Search** — Auto-fill from current login (parent) or search
- **TC Details** — Leaving date (required), Reason (dropdown + text)
- **Clearance Preview** — Real-time checks:
  - Fee clearance (✓/✗)
  - Library clearance (✓/✗)
  - Hostel clearance (✓/✗)
  - Lab clearance (✓/✗)
- **Submit** — POST `/tc/apply` → request ID

**Parent View:**
- My requests table: Student, Status, Submitted, Actions
- Actions: View, Cancel (if pending)

**Permissions:** Parent role, `certificates.tc`

---

### 8. TC Approval `TCApproval.jsx` — `/school/certificates/tc/approve`

**Tabs:**
- **Pending** — Submitted, clearance done
- **Approved** — Ready for generation
- **Rejected** — With reasons

**Table Columns:** Student, Class, Leaving Date, Clearance Status, Actions

**Actions:**
- **View** — Detail modal with clearance breakdown
- **Approve** → POST `/tc/requests/:id/approve` → auto-generate
- **Reject** → Modal for reason → POST `/tc/requests/:id/reject`

**Clearance Modal:**
- Fee: ✓/✗ (click → fee detail)
- Library: ✓/✗
- Hostel: ✓/✗
- Lab: ✓/✗
- Custom: configurable

**Permissions:** Principal/Admin, `certificates.tc`

---

### 9. TC Generation `TCGeneration.jsx` — `/school/certificates/tc/generate`

**Auto-triggered** on approval, but manual override available.

**Sections:**
- **Pending Generation** — Approved requests not yet generated
- **Generate Button** — POST `/tc/generate/:id`
- **Generated List** — Certificate No, Student, Date, Download

**Auto-flow:**
1. On approval → background job calls `/tc/generate/:id`
2. Generates TC number: `TC-{SESSION}-{SEQ:05d}`
3. Renders template with student data
4. Creates PDF, stores file
4. Updates register
5. Updates student status → "Left/Transferred"
6. Notifies parent

**Manual Override:** Admin can regenerate if template changed

**Permissions:** `certificates.tc`

---

### 10. Certificate Register `CertificateRegister.jsx` — `/school/certificates/register`

**Tabs:**
- **All** — Searchable table
- **ID Cards**
- **TC Certificates**
- **Other**

**Table Columns:** Certificate No, Student, Type, Issue Date, Status, Actions

**Filters:** Type, Date range, Class, Session, Status

**Actions:** View, Download, Verify QR, Reissue

**Export:** CSV/Excel

**Permissions:** `certificates.reports`

---

### 11. Document Verification `DocumentVerification.jsx` — `/school/certificates/verify`

**Public Page** (no auth required, rate-limited)

**Features:**
- Input certificate number
- QR scan (camera)
- Verify button → GET `/tc/verify/:certNo`
- Result: Valid/Invalid/Revoked
- If valid: Show student name, certificate type, issue date, status
- No sensitive data exposed

**Rate Limit:** 10 requests/minute/IP

**Permissions:** Public

---

## UI Components Library

`src/pages/school/certificates/components/`:

| Component | Purpose |
|---|---|
| `TemplateCanvas` | Fabric.js wrapper, drag-drop, zoom, rulers |
| `FieldPalette` | Draggable field groups |
| `FieldProperties` | Position, font, color, alignment |
| `DynamicFieldConfig` | Source table/field, transform |
| `TemplatePreview` | Live render modal |
| `StudentSearch` | Search by name/admission no |
| `ClearancePanel` | Fee, Library, Hostel, Lab status |
| `IDCardPreview` | Front/back side-by-side |
| `BulkProgress` | Progress bar, cancel, download |
| `CertificateQR` | QR code generator/verifier |

---

## State Management

- React Query for server state
- Local state for canvas, forms
- Background job polling for bulk/TC generation

---

## Responsive Breakpoints

- Designer: Full screen on ≥1200px, sidebar collapsible on <1200px
- Tables: Horizontal scroll on mobile
- Preview: Full screen modal
- Verification: Mobile-first