# Communication — Build Plan

**Version 1.0** · Based on `DESIGN.md` · 4 November 2026

---

## Overview

The Communication module is built in four sequential steps. Each step delivers working, testable functionality.

**Dependencies**

- Students master (`school_students`, guardian contacts)
- Parents/Guardians (`school_guardian` if separate, or embedded in students)
- Staff master (`school_staff` for sender identity)
- Fees & Accounts (`school_invoice`, `school_fee_head` for fee reminders)
- Exam (`school_exam`, `school_exam_result` for result notifications)
- Attendance (`school_attendance` for absence alerts)
- Timetable (`school_timetable` for schedule changes)
- Admission (`school_admission` for admission updates)

**Migration files:** `sql/90_communication_core.sql`, `sql/91_communication_logs.sql`.

**Backend router:** `server/src/routes/school_communication.js`, mounted at `/api/school/communication` **before** the legacy `school_comprehensive.js` router.

**Frontend routes:** `/school/communication/dashboard`, `/school/communication/sms`, `/school/communication/email`, `/school/communication/notice-board`, `/school/communication/app-notifications`, `/school/communication/templates`, `/school/communication/logs`, `/school/communication/providers`.

---

## Step 1: Templates, Providers & Settings

**Target:** Complete template management with variable substitution, provider configuration (SMS gateway, email SMTP, push service), and global communication settings.

### Database

- `school_communication_template` — template code, name, channel (sms/email/push/notice), subject, body with variables, language
- `school_communication_provider` — provider code, type (twilio, msg91, sendgrid, mailgun, firebase, onesignal), config JSON, priority, is_active
- `school_communication_setting` — key-value settings (default_from, default_sender_id, rate limits, retry policy, opt-out handling)

### Backend API (`/api/school/communication/*`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/templates` | GET/POST | List/create templates |
| `/templates/:id` | GET/PUT/DELETE | Template detail/update/soft-delete |
| `/templates/:id/preview` | POST | Render template with sample data |
| `/providers` | GET/POST | List/create providers |
| `/providers/:id` | GET/PUT/DELETE | Provider detail/update/soft-delete |
| `/providers/:id/test` | POST | Send test message via provider |
| `/settings` | GET/PUT | Global communication settings |

### Frontend Screens

| Screen | File | Route |
|---|---|---|
| Template Manager | `Templates.jsx` | `/school/communication/templates` |
| Provider Setup | `Providers.jsx` | `/school/communication/providers` |
| Settings | `Settings.jsx` | `/school/communication/settings` |

### Permission

- `communication.view` — read templates, providers, settings
- `communication.manage` — create/edit templates, providers, settings
- `communication.send` — send messages (covered in Step 2–3)

### Done When

- Templates render correctly with sample data for all channels.
- At least one SMS provider and one email provider can be configured and tested.
- Settings persist and are respected by the send engine.

---

## Step 2: SMS & Email Engine

**Target:** Queue-based sending with provider fallback, delivery receipts, opt-out handling, and detailed logs.

### Database

- `school_communication_message` — message_id, template_id, channel, subject, body, recipient_count, status, scheduled_at, sent_at, created_by
- `school_communication_recipient` — message_id, recipient_type (student/parent/staff/custom), recipient_id, contact_value (phone/email/device_token), status, provider_id, provider_message_id, error, sent_at, delivered_at, clicked_at
- `school_sms_log` — message_id, recipient_id, to_number, from_number, body, provider, provider_message_id, status, segments, cost, error, sent_at, delivered_at
- `school_email_log` — message_id, recipient_id, to_email, from_email, subject, body_text, body_html, provider, provider_message_id, status, error, sent_at, delivered_at, opened_at, clicked_at, bounced_at, complaint_at

### Backend API

| Endpoint | Method | Purpose |
|---|---|---|
| `/sms/send` | POST | Send SMS (immediate or scheduled) |
| `/sms/send-bulk` | POST | Send SMS to list / filter |
| `/email/send` | POST | Send email (immediate or scheduled) |
| `/email/send-bulk` | POST | Send email to list / filter |
| `/messages` | GET | List messages with filters |
| `/messages/:id` | GET | Message detail with recipient status |
| `/messages/:id/cancel` | POST | Cancel scheduled message |
| `/messages/:id/retry` | POST | Retry failed recipients |
| `/sms/logs` | GET | SMS delivery logs |
| `/email/logs` | GET | Email delivery logs |
| `/webhooks/sms/:provider` | POST | Provider delivery receipt webhook |
| `/webhooks/email/:provider` | POST | Provider event webhook (delivered, open, click, bounce, complaint) |

### Frontend Screens

| Screen | File | Route |
|---|---|---|
| Send SMS | `SendSms.jsx` | `/school/communication/sms` |
| Send Email | `SendEmail.jsx` | `/school/communication/email` |
| Message Logs | `Logs.jsx` (tab) | `/school/communication/logs` |

### Permission

- `communication.send` — send SMS/email
- `communication.logs` — view delivery logs

### Done When

- SMS and email can be sent to filtered recipient lists (class, section, all parents, staff, custom).
- Provider fallback works when primary fails.
- Delivery receipts update log status in real time.
- Opt-out list is respected.
- Logs show sent/delivered/failed with provider details.

---

## Step 3: Notice Board & App Notifications

**Target:** Rich notice board with attachments, read tracking, and push notifications to mobile app.

### Database

- `school_notice_board` — notice_id, title, body_html, priority (low/normal/high/urgent), audience (all/students/parents/staff/class/section/custom), target_ids JSON, publish_at, expire_at, pinned, created_by
- `school_notice_attachment` — notice_id, file_name, file_url, file_size, mime_type, sort_order
- `school_notice_read` — notice_id, user_type (student/parent/staff), user_id, read_at
- `school_app_notification` — notification_id, user_type, user_id, title, body, data_json, channel (push/in_app), priority, status, sent_at, read_at, clicked_at

### Backend API

| Endpoint | Method | Purpose |
|---|---|---|
| `/notices` | GET/POST | List/create notices |
| `/notices/:id` | GET/PUT/DELETE | Notice detail/update/soft-delete |
| `/notices/:id/publish` | POST | Publish notice (send push) |
| `/notices/:id/unpublish` | POST | Unpublish notice |
| `/notices/:id/attachments` | GET/POST | Manage attachments |
| `/notices/:id/read` | POST | Mark as read (recipient) |
| `/notices/:id/read-report` | GET | Read receipt report |
| `/app-notifications/send` | POST | Send push/in-app notification |
| `/app-notifications/send-bulk` | POST | Bulk push to filtered audience |
| `/app-notifications` | GET | Notification history |
| `/app-notifications/:id/read` | POST | Mark push as read |

### Frontend Screens

| Screen | File | Route |
|---|---|---|
| Notice Board | `NoticeBoard.jsx` | `/school/communication/notice-board` |
| Create/Edit Notice | (modal in `NoticeBoard.jsx`) | — |
| App Notifications | `AppNotifications.jsx` | `/school/communication/app-notifications` |

### Permission

- `communication.notice` — create/edit/publish notices
- `communication.notice_read` — view read reports
- `communication.push` — send app notifications

### Done When

- Notices support rich text, attachments, scheduling, pinning, expiry.
- Read tracking works for students, parents, and staff.
- Push notifications deliver to mobile app (Firebase/OneSignal).
- In-app notification centre shows history with read status.

---

## Step 4: Reports, Automation & Hardening

**Target:** Communication analytics, automated triggers from other modules, retention, audit, and permissions hardening.

### Database

- Add indexes and partition large log tables by month if volume demands.
- `school_communication_automation` — trigger_event, template_id, channel, filter_json, is_active, last_run_at

### Backend API

| Endpoint | Method | Purpose |
|---|---|---|
| `/reports/summary` | GET | Channel-wise volume, delivery rate, cost |
| `/reports/sms` | GET | SMS report with filters |
| `/reports/email` | GET | Email report with filters |
| `/reports/notice` | GET | Notice read rates |
| `/reports/push` | GET | Push delivery/read rates |
| `/automations` | GET/POST | List/create automation rules |
| `/automations/:id` | GET/PUT/DELETE | Automation detail |
| `/automations/:id/test` | POST | Test automation with sample data |
| `/settings/retention` | GET/PUT | Log retention policy |
| `/audit` | GET | Communication audit log |

### Frontend Screens

| Screen | File | Route |
|---|---|---|
| Reports | `Reports.jsx` | `/school/communication/reports` |
| Automations | `Automations.jsx` | `/school/communication/automations` |

### Automation Triggers (examples)

| Event | Module | Example Use |
|---|---|---|
| `student.admitted` | Admission | Welcome SMS/email |
| `fee.due_soon` | Fees | Fee reminder (3 days before) |
| `fee.overdue` | Fees | Overdue notice |
| `exam.result_published` | Exam | Result notification |
| `attendance.absent` | Attendance | Daily absence alert to parent |
| `timetable.changed` | Timetable | Schedule change notice |
| `hostel.leave_approved` | Hostel | Leave confirmation |

### Hardening

- Rate limiting per provider and per sender.
- PII masking in logs (phone, email masked in list views).
- Retention policy: SMS/email logs 365 days, notice reads 2 years, push 90 days.
- Audit every send, template change, provider config change, automation change.
- Export CSV from every report.
- Role-based access: admin, teacher (class-level), accounts (fee comms), principal.

### Done When

- Reports show volume, delivery %, cost per channel.
- At least 5 automation rules work end-to-end.
- Retention cleanup job runs without data loss.
- Audit log captures all sensitive actions.
- Permissions prevent cross-role misuse.

---

## Permissions Summary

| Permission | Purpose |
|---|---|
| `communication.view` | Read dashboard, templates, providers, settings |
| `communication.manage` | Full template/provider/settings CRUD |
| `communication.send` | Send SMS and email |
| `communication.logs` | View SMS/email delivery logs |
| `communication.notice` | Create, edit, publish, unpublish notices |
| `communication.notice_read` | View notice read reports |
| `communication.push` | Send app push notifications |
| `communication.reports` | View communication reports |
| `communication.automation` | Manage automation rules |
| `communication.audit` | View audit log |

`communication.manage` is a superset for backward compatibility.