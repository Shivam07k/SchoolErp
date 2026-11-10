# Alumni & Placement — Integration Points

---

## 1. Student Master

**Tables:** `school_students`, `school_guardians`, `school_student_enrollments`

**Data Flow:**
- Auto-conversion: `student.status = 'left' OR 'transferred'` → INSERT INTO `school_alumni`
- Read-only: name, admission_no, passing_year, last_class, session, photo
- Alumni registration pre-fills from student record
- Alumni profile links back to student record

**Events:**
- `student.status_changed` → if left/transferred, create alumni record
- `student.photo_updated` → sync to alumni profile
- `student.contact_changed` → sync to alumni profile

---

## 2. Communication Module

**Tables:** `school_communication_*`, `school_notification`

**Data Flow:**
- Alumni registration submitted → notify admin
- Alumni verified → notify alumni
- Event registration confirmed → notify alumni
- Job posted → notify eligible alumni (by industry/location)
- Job application received → notify poster
- Donation successful → notify donor, accounts
- Campaign target reached → notify admin

**Channels:** SMS, Email, App Push, Notice Board

---

## 3. Fee & Accounts Module

**Tables:** `school_fee_invoice`, `school_fee_payment`, `school_fee_head`

**Data Flow:**
- Event registration fee → create fee invoice
- Donation payment → create fee payment / direct gateway
- Donation receipt → link to payment record
- Refund → credit note in fee module

**Events:**
- `fee.payment_received` → update donation status
- `fee.refund_processed` → update donation status

---

## 4. File Management

**Tables:** `school_files`

**Data Flow:**
- Alumni profile photo → upload to files
- Event photos → upload to files
- Job resume → upload to files
- Donation receipt PDF → store in files, reference in `school_donation_receipt.file_id`
- Event documents → upload to files

---

## 5. Staff/HR Module

**Tables:** `school_staff`, `school_staff_employment`

**Data Flow:**
- Job posting by school → posted_by = staff_id
- Job approval → approved_by = staff_id
- Placement officer role for job management

---

## 6. Events Module (School Events)

**Tables:** `school_event`, `school_event_registration`

**Data Flow:**
- School events open to alumni → cross-module visibility
- Alumni can register for school events (if allowed)
- Shared photo gallery for joint events

---

## 7. Communication Module (Inbound)

**Tables:** `school_notice_board`, `school_app_notification`

**Data Flow:**
- Alumni event announcement → notice board
- Job opportunity alert → app notification
- Donation campaign → notice + app notification

---

## 8. Notification Events Summary

| Event | Trigger | Recipients | Channels |
|---|---|---|---|
| Alumni registration submitted | `school_alumni` status=pending_registration | Admin | SMS, Email, App, Notice |
| Alumni verified | `school_alumni` status=verified | Alumni | SMS, Email, App |
| Event registration confirmed | `school_alumni_event_registration` created | Alumni | SMS, Email, App |
| Event reminder | Scheduled job (1 day before) | Registered alumni | SMS, Email, App |
| Job posted | `school_job_posting` status=active | Eligible alumni | SMS, Email, App, Notice |
| Job application received | `school_job_application` created | Poster | SMS, Email, App |
| Donation successful | `school_donation` status=successful | Donor, Accounts | SMS, Email, App |
| Donation receipt generated | `school_donation_receipt` created | Donor | Email, App |
| Campaign target reached | `school_donation_campaign` collected >= target | Admin | App, Email |

---

## 9. Audit & Retention

**Tables:** `school_alumni_audit`, `school_alumni_notification`

**Audit Actions:**
- Alumni registration/verification
- Profile updates
- Event create/register/attend
- Job post/approve/apply
- Donation initiate/success/refund
- Campaign create/update
- Settings change

**Retention Settings (configurable):**
| Data | Default Retention |
|---|---|
| Alumni profiles | Permanent |
| Event registrations | 5 years |
| Job applications | 3 years |
| Donation records | 10 years |
| Receipts | 10 years |
| Notification logs | 3 years |
| Audit logs | 7 years |

**Privacy:**
- Alumni PII protected per privacy_level setting
- Donor info in exports masked for non-admins
- Resume files access-controlled
- Contact info not in public job listings

---

## 10. Module Linking

| From Module | To Module | Link Field |
|---|---|---|
| Alumni | Students | `school_alumni.student_id` |
| Alumni | Communication | All notification triggers |
| Alumni | Fees | Donation payments, event fees |
| Alumni | Files | Photos, resumes, receipts, event photos |
| Alumni | Staff | Job approval, posting |
| Alumni | Events (School) | Cross-registration |
| Alumni | Communication | Notices, notifications |