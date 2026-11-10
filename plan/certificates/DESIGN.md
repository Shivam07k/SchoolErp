# Certificates & ID Management — Design Document

**Version 1.0** · 4 November 2026  
**Module ID:** M26  
**Package ID:** M26  
**Status:** Design – Plan

---

## 1. Purpose

Provide a centralized document generation system to create student identity cards, transfer certificates and other official school documents using predefined templates that pull live data from Student, Parent, Academic and Fee modules.

## 2. Scope

**In scope**
- Template Management (designer, dynamic fields, versioning)
- Document Generation (individual and bulk)
- ID Card Management (front/back, bulk print, reissue)
- TC Certificate Workflow (request, approval, generation, register)

**Out of scope – Phase 1**
- Digital signatures
- Blockchain verification
- Multi-language templates
- Online certificate verification portal

## 3. Submodules

1. **Templates** – `school_document_template`, `school_template_field`
2. **Generate** – `school_certificate_request`, `school_generated_document`
3. **ID Cards** – `school_id_card`, `school_id_card_history`
4. **TC Certificate** – `school_tc_request`, `school_tc_approval`

## 4. Requirements

### Functional
- Visual template designer with drag-and-drop fields
- Dynamic fields populated from Student, Parent, Academic, Fee, Staff modules
- Individual and bulk generation (class/section/session filters)
- PDF generation with QR code for verification
- ID card front/back design with barcode/QR
- TC workflow: request → clearance check → approval → generation
- Certificate register with unique numbering
- Reprint and reissue tracking

### Non-functional
- Tenant-scoped, RLS enforced
- Generated documents immutable after approval
- Template changes don't affect issued documents
- Audit trail for every generation/reissue
- <3s PDF generation for single document
- <30s bulk generation for 200 documents
- Full RBAC per action

## 5. Recommended Solution

Reuse existing ERP engine:
- **Backend:** Express router `server/src/routes/school_certificates.js` mounted before `schoolCompRouter`
- **Frontend:** React pages `src/pages/school/certificates/*.jsx` under Certificates menu
- **Forms engine:** For template and request forms; custom UI for designer and preview
- **Database:** PostgreSQL with tables prefixed `school_document_*`, `school_certificate_*`, `school_tc_*`, `school_id_*`. Migrations: `sql/80_certificates_core.sql`, `sql/81_certificates_ops.sql`
- **Permissions:** `certificates.view`, `certificates.manage`, `certificates.templates`, `certificates.idcards`, `certificates.tc`, `certificates.reports`
- **Integration:** Student, Parent, Academic, Fee, Admission, File Management

## 6. Core Design

### 6.1 Templates

**Template structure:**
- Background image (optional)
- Static text elements
- Dynamic fields (position, font, size, color, alignment)
- QR/Barcode placeholder (auto-filled)
- Signature placeholder (auto-filled from Staff)
- Version history (immutable versions)

**Dynamic fields available:**
| Category | Fields |
|---|---|
| Student | Name, Admission No, Class, Section, DOB, Gender, Father Name, Mother Name, Address, Contact, Photo, Blood Group |
| Parent | Father Name, Mother Name, Occupation, Contact, Email, Address |
| Academic | Session, Stream, Subjects, Grades, Attendance %, Rank |
| Fee | Clearance status, Due amount, Last payment date |
| School | Name, Address, Logo, Affiliation No, Principal Name, Contact, Seal |
| Staff | Principal Name, Class Teacher Name, Signature |
| System | Certificate No, Issue Date, QR Code, Barcode |

**Template types:** ID Card Front, ID Card Back, TC Certificate, Bonafide, Character, Migration, Custom.

### 6.2 Document Generation

**Individual generation:**
1. Select template
2. Select student
3. Preview with live data
4. Generate → creates record in `school_generated_document`
4. PDF stored in file system, metadata in DB
5. Download/Print options

**Bulk generation:**
1. Select template
2. Filter by class/section/session
3. Preview sample
4. Generate all → background job
5. Progress tracking
6. ZIP download or individual access

**Reprint/Reissue:**
- Mark original as reissued
- Generate new with same data or updated
- Track in history

### 6.3 ID Cards

**Design:** Separate front/back templates
- Front: Photo, Name, Admission No, Class, Section, DOB, Blood Group, School Logo, QR Code
- Back: Address, Parent Contacts, Emergency Contact, School Address, Barcode, Validity

**Generation:**
- Individual: From student profile
- Bulk: Class/section filter → background job
- Reissue: Lost/damaged → track in history with reason

**Print:** PDF with crop marks, batch print support

### 6.4 TC Certificate

**Workflow:**
1. Student/Parent submits TC request (reason, leaving date)
2. System auto-checks:
   - Fee clearance (configurable: full/partial)
   - Library clearance
   - Hostel clearance
   - Lab equipment return
3. If clearance pending → block with reasons
4. Submit for approval → Principal/Authorized
5. On approval:
   - Generate unique TC number
   - Populate template with student data
   - Generate PDF
   - Update student status to "Left/Transferred"
   - Store in certificate register

**TC fields:**
- Certificate No (auto: TC-{SESSION}-{SEQ})
- Student details (auto)
- Admission date, Leaving date
- Last class attended
- Reason for leaving
- Attendance (if maintained)
- Academic result (last exam)
- Conduct character remarks
- Fee clearance status
- Principal signature (auto from template)
- QR code for verification

## 7. Data Model

| Table | Key Fields |
|---|---|
| `school_document_template` | `id`, `name`, `type`, `category`, `version`, `background_file_id`, `status`, `created_by` |
| `school_template_field` | `template_id`, `field_key`, `x`, `y`, `width`, `height`, `font_family`, `font_size`, `color`, `alignment`, `is_dynamic`, `source_table`, `source_field` |
| `school_certificate_request` | `id`, `student_id`, `template_id`, `request_type`, `reason`, `status`, `requested_by`, `requested_at` |
| `school_certificate_approval` | `request_id`, `approver_id`, `status`, `remarks`, `approved_at` |
| `school_generated_document` | `id`, `request_id`, `certificate_no`, `template_id`, `version`, `file_id`, `generated_by`, `generated_at` |
| `school_id_card` | `id`, `student_id`, `session_id`, `front_template_id`, `back_template_id`, `issue_date`, `status` |
| `school_id_card_history` | `id_card_id`, `action`, `action_date`, `reason`, `action_by` |
| `school_tc_request` | `id`, `student_id`, `leaving_date`, `reason`, `status`, `requested_by` |
| `school_tc_approval` | `request_id`, `approver_id`, `clearance_status`, `tc_number`, `approved_at` |

All tables: `app_id`, `created_at`, `updated_at`, `deleted_at`.

## 8. Rules and Policies

### Hard rules
- Every certificate has unique number
- Issued documents immutable
- Template changes don't affect issued
- TC requires clearance checks
- TC requires approval
- Bulk generation respects filters
- Reissue marks original

### Soft rules
- Missing student photo warning
- Template version mismatch
- Low generation rate

### Configurable settings
| Setting | Options |
|---|---|
| Certificate number format | TC-{SESSION}-{SEQ} |
| ID card validity | Months/Years |
| TC clearance checks | Fee, Library, Hostel, Lab |
| TC approval required | Yes/No |
| Default TC template | Template ID |
| QR code on ID cards | Yes/No |

## 9. Screens

| Screen | Route | Key Features |
|---|---|---|
| Template Management | `/school/certificates/templates` | List, create, version history |
| Template Designer | `/school/certificates/templates/designer/:id` | Drag-drop, preview, dynamic fields |
| Template Preview | `/school/certificates/templates/preview/:id` | Live data preview |
| Document Generation | `/school/certificates/generate` | Individual, filters, preview |
| Bulk Generation | `/school/certificates/bulk` | Class/section, progress, ZIP |
| ID Card Management | `/school/certificates/idcards` | List, individual, bulk, reissue |
| ID Card Print | `/school/certificates/idcards/print` | Batch PDF with crop marks |
| TC Application | `/school/certificates/tc/apply` | Request, clearance check |
| TC Approval | `/school/certificates/tc/approve` | Review, approve/reject |
| TC Generation | `/school/certificates/tc/generate` | Auto on approval |
| Certificate Register | `/school/certificates/register` | Search, filter, export |
| Document Verification | `/school/certificates/verify` | QR scan, public verify |

## 10. Workflows

**W1: Template to generation**
1. Admin designs template with dynamic fields
2. Saves version
3. Teacher selects template + student
4. Preview → Generate → PDF stored

**W2: TC request to certificate**
1. Parent submits TC request
2. System checks clearances
3. If clear → submit for approval
4. Principal approves
5. Auto-generate TC number + PDF
6. Update student status

**W3: ID card bulk generation**
1. Admin selects template + class/section
2. Background job generates all
3. Progress tracking
4. ZIP download or print queue

## 11. Roles, Alerts, Reports

### Roles
| Role | Actions |
|---|---|
| Super Admin | All |
| Principal | TC approval, view all |
| School Admin | Templates, generation, ID cards |
| Teacher | View student certificates |
| Student | View own certificates, download |
| Parent | TC request, view certificates |
| Auditor | Read-only register |

### Alerts
| Event | Recipients |
|---|---|
| TC requested | Principal, Admin |
| TC approved | Parent, Student, Admin |
| ID cards generated | Requester |
| Certificate reissued | Parent, Admin |

### Reports
- ID card generation report
- Pending ID card report
- Lost/reissued ID card report
- TC issued report
- Pending TC approval
- Class-wise certificate report
- Certificate number register
- Duplicate certificate report

## 12. Scenario Coverage

| Scenario | Handling | Step |
|---|---|---|
| Generate one ID card | Correct data displayed | 2 |
| Bulk ID cards | All selected processed | 2 |
| Missing photo | Fallback or validation | 2 |
| Generate TC | Data populated correctly | 3 |
| TC approval pending | Blocked | 3 |
| Duplicate TC | Recorded as reissue | 3 |
| Template change | Issued docs unchanged | 1 |
| Verify QR | Correct record shown | 4 |

## 13. Performance, Security, Reliability

- PDF generation offloaded to background jobs
- File storage with authenticated URLs
- File type/size validation
- Template versioning immutable
- Certificate numbers sequential per session
- Audit trail for every generation
- RBAC on all endpoints
- Student/parent PII protection
- Backups of templates and documents
- DB transactions for TC workflow

## 14. Out of Scope (Phase 1)

- Digital signatures
- Blockchain verification
- Multi-language templates
- Online verification portal

## 15. Open Decisions

1. Certificate number format?
2. ID card validity period?
3. Which TC clearance checks mandatory?
3. Is TC approval required or auto-approve?
4. Default TC template?
5. QR code on ID cards?
6. Which certificate formats/templates required?

## 16. Build Strategy

**Phase 1 — Templates** (Week 1-2): Designer, dynamic fields, preview, versioning
**Phase 2 — ID Cards** (Week 3): Individual/bulk, front/back, print, reissue
**Phase 3 — TC Certificate** (Week 4): Request, clearance, approval, generation, register
**Phase 4 — Integration & Hardening** (Week 5): Verification, reports, roles, audit, testing

---

*End of Document*