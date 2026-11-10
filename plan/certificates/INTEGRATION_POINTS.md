# Certificates & ID — Integration Points

---

## 1. Student Master

**Tables:** `school_students`, `school_guardians`, `school_student_enrollments`

**Data Flow:**
- Read-only: student name, admission_no, class, section, dob, gender, photo, guardian contacts, address
- ID card generation reads student data
- TC request auto-fills student data
- Certificate register links to student

**Events:**
- `student.created` → available for ID card
- `student.class_changed` → ID card reissue may be needed
- `student.status_changed` → TC blocks if not active, ID card status update
- `student.photo_updated` → next ID card uses new photo
- `student.left` → TC request allowed, ID card expired

---

## 2. Parent/Guardian Master

**Tables:** `school_guardians`

**Data Flow:**
- Read-only: parent names, contacts, occupation
- TC request: parent submits, parent contact on TC
- ID card: parent contacts on back
- Notifications: TC status, ID card generated

**Events:**
- `guardian.contact_changed` → next document uses new contact

---

## 3. Academic Module

**Tables:** `school_academic_years`, `school_classes`, `school_sections`, `school_subjects`, `school_grades`

**Data Flow:**
- Read-only: session, class, section, stream, subjects
- TC: leaving date, last class, academic session
- ID card: session validity, class/section
- Certificate register: academic context

**Events:**
- `academic_year.changed` → new session for ID cards
- `class_section.changed` → ID card reissue may be needed

---

## 4. Fee Module

**Tables:** `school_fee_invoice`, `school_fee_payment`, `school_fee_head`

**Data Flow:**
- TC clearance check: reads fee invoices, payments
- Fee clearance status on TC approval panel
- Fee head for TC fee (if applicable)

**Events:**
- `fee.payment_received` → re-check TC clearance
- `fee.invoice_created` → may affect clearance

---

## 5. Library Module (Optional)

**Tables:** `school_library_loan`, `school_library_fine`

**Data Flow:**
- TC clearance check: library fines, pending books
- Library clearance status on TC approval panel

---

## 6. Hostel Module (Optional)

**Tables:** `school_hostel_allocation`, `school_hostel_deposit`

**Data Flow:**
- TC clearance check: hostel dues, deposit refund
- Hostel clearance status on TC approval panel

---

## 7. Staff/HR Module

**Tables:** `school_staff`, `school_staff_employment`

**Data Flow:**
- Read-only: principal name, class teacher name, signatures
- TC approval: principal approves
- Template: staff signature placeholder
- TC approval action logged with approver_id

**Events:**
- `staff.principal_changed` → update template signatures
- `staff.resigned` → reassign approval authority

---

## 8. File Management

**Tables:** `school_files`

**Data Flow:**
- Template background images → upload, reference in `school_document_template.background_file_id`
- Student photos → `school_students.photo_url` (or file_id)
- Generated PDFs → store in files, reference in `school_generated_document.file_id`, `school_certificate_register`
- ID card photos → student photo or separate upload

**Events:**
- `file.uploaded` → available for templates
- `file.deleted` → check references, prevent if in use

---

## 9. Communication Module

**Tables:** `school_communication_message`, `school_notification`

**Data Flow:**
- TC request submitted → notify parent, admin
- TC approved → notify parent, student, admin
- TC generated → notify parent with download link
- ID card generated → notify parent
- ID card reissued → notify parent
- TC rejected → notify parent with reason

**Channels:** SMS, Email, App Push, Notice Board

---

## 10. Admission Module

**Tables:** `school_applications`, `school_students` (via admission)

**Data Flow:**
- New admission → auto-create ID card request (configurable)
- Admission number used in certificates

---

## 11. Examination Module (Optional)

**Tables:** `school_exam_result`, `school_report_card`

**Data Flow:**
- TC: last exam result, grades (if required)
- Academic performance on TC

---

## 12. Notification Events Summary

| Event | Trigger | Recipients | Channels |
|---|---|---|---|
| ID card generated | `school_id_card` created | Parent | SMS, Email, App |
| ID card reissued | `school_id_card` reissue action | Parent | SMS, Email, App |
| TC request submitted | `school_tc_request` status=submitted | Admin, Parent | SMS, Email, App, Notice |
| TC clearance updated | Clearance check changes | Admin | App |
| TC approved | `school_tc_request` status=approved | Parent, Student, Admin | SMS, Email, App |
| TC generated | `school_generated_document` for TC | Parent, Student | SMS, Email, App |
| TC rejected | `school_tc_request` status=rejected | Parent | SMS, Email, App |
| ID card ready for print | Bulk generation complete | Admin | App, Email |

---

## 13. Audit & Retention

**Tables:** `school_certificates_audit`, `school_certificates_notification`

**Audit Actions:**
- Template create/update/version/clone
- Document generate/reissue
- ID card issue/reissue/reprint
- TC request submit/approve/reject/generate
- Certificate register entry
- Settings change

**Retention Settings (configurable):**
| Data | Default Retention |
|---|---|
| Generated PDFs | 10 years |
| ID card history | 10 years |
| TC requests | 10 years |
| Certificate register | Permanent |
| Audit logs | 7 years |
| Notification logs | 3 years |

**Privacy:**
- Student photos in ID cards → consent required
- Certificate data in public verification → minimal (name, type, date, status)
- Parent contacts on ID card back → encrypted in storage

---

## 14. Module Linking

| From Module | To Module | Link Field |
|---|---|---|
| Certificates | Students | `school_certificate_request.student_id`, `school_id_card.student_id`, `school_tc_request.student_id` |
| Certificates | Guardians | TC request by parent, ID card parent contacts |
| Certificates | Academic | TC leaving date, session, class; ID card session validity |
| Certificates | Fees | TC fee clearance check |
| Certificates | Library | TC library clearance check |
| Certificates | Hostel | TC hostel clearance check |
| Certificates | Staff | TC approval by principal, template signatures |
| Certificates | Files | Templates, generated PDFs, photos |
| Certificates | Communication | All notification triggers |
| Certificates | Admission | Admission number on certificates |