# Communication Module — Design

**Version 1.0** · 4 November 2026

---

## 1. Purpose and scope

This document describes a simple, fast and reliable communication module for the school ERP. It enables the school to send timely, trackable messages to students, parents, and staff through multiple channels — SMS, Email, Notice Board, and App Notifications — while maintaining a complete audit trail in Message Logs.

**Submodules:** SMS, Email, Notice Board, App Notifications, Message Logs.

### Requirements

- **Multi-channel delivery:** One message can be sent via SMS, email, app push, and notice board simultaneously or selectively.
- **Template-driven:** Reusable templates with placeholders (student name, class, fee amount, exam date, etc.) for consistent communication.
- **Scheduled and recurring:** Messages can be scheduled for future delivery or set to recur (e.g., fee reminders on the 1st of each month).
- **Delivery tracking:** Every message logs status — queued, sent, delivered, failed, read — with timestamps and provider responses.
- **Role-based targeting:** Send to individuals, groups (class, section, house, bus route), roles (all parents of Class 10), or custom filters.
- **Opt-in/opt-out compliance:** Respect parent/staff communication preferences and regulatory opt-out (TRAI/DND for SMS, unsubscribe for email).
- **Cost control:** SMS credits tracked per provider; email via configured SMTP/provider; in-app and notice board are free.
- **Audit and privacy:** Immutable message logs, PII masking in exports, retention policies, and access logs.
- **Integration first:** Triggered by events in Student, Parent, Staff, Fees, Exam, Attendance, Timetable, Admission modules.

**Out of scope for the first release:** WhatsApp Business API, voice calls, IVR, chatbot, social media posting, multilingual translation engine, rich media in SMS (MMS), email newsletter designer (drag-drop), advanced analytics dashboards, A/B testing, and dedicated parent communication app. Section 14 shows where each fits later.

---

## 2. Recommended solution in brief

1. **Unified message composer** — One screen to compose, preview, target, schedule, and send across all channels.
2. **Template engine** — Handlebars-style templates with module-specific placeholders, versioned and approved.
3. **Channel adapters** — Pluggable providers: SMS (Twilio, MSG91, Gupshup, local), Email (SMTP, SendGrid, Amazon SES, Brevo), Push (Firebase, OneSignal), Notice Board (internal DB).
4. **Queue and retry** — Background job queue with exponential backoff, dead-letter queue, and manual retry.
5. **Message Log** — Single source of truth: one row per recipient per channel, with status timeline.
6. **Preference centre** — Parent/staff portal to manage channel opt-in, frequency, and quiet hours.
7. **Event hooks** — Other modules emit events (fee_due, exam_scheduled, attendance_low, admit_card_released) that trigger predefined templates.
8. **Build order:** Templates → SMS → Email → Notice Board → App Notifications → Message Logs → Preferences → Event Integrations → Reports → Hardening.

---

## 3. What other school ERPs do

Reviewed public descriptions of communication modules in major school ERPs:

- **Edumerge:** Multi-channel (SMS, email, app push), template library, scheduling, delivery reports, parent app inbox, fee reminders, attendance alerts, circulars on notice board.
- **OpenEduCat:** Mass mailing, SMS gateway integration, notification templates, event-based triggers, parent portal messages, delivery tracking.
- **MasterSoft / IITMS:** SMS and email with multiple gateway support, circulars, notice board, auto alerts for fees/attendance/exams, parent app notifications.
- **Orell:** Bulk SMS/email, template management, scheduling, delivery reports, notice board, mobile app push, communication logs.
- **EDU ERP:** Multi-channel, template editor, provider failover, opt-out management, event-driven alerts, audit trail.
- **Campus 365 / Teachmint / LEAD:** WhatsApp Business (later), rich notifications, read receipts, announcement feed, targeted groups.

**Conclusion.** The common pattern is a central composer, template engine, multiple channel adapters, event-driven triggers, delivery tracking, and a unified log. This design follows that pattern and keeps provider choice configurable because schools use different local SMS gateways.

---

## 4. Core design

### 4.1 Message lifecycle

```
DRAFT → VALIDATED → QUEUED → SENDING → SENT → DELIVERED / FAILED → READ (where supported)
                      ↘ RETRY (max 3) → DEAD_LETTER
```

- **Draft:** Composed, not yet validated. Editable.
- **Validated:** Targets resolved, templates rendered, credits checked, opt-outs filtered. Immutable once queued.
- **Queued:** Persisted in outbox table, picked up by workers.
- **Sending:** Worker calls provider API.
- **Sent:** Provider accepted (HTTP 2xx / message ID returned).
- **Delivered:** Provider webhook confirms delivery (SMS DLR, email bounce/delivered, push ack).
- **Read:** App push / notice board view tracked; email open pixel (optional, privacy-friendly).
- **Failed:** Provider rejected or max retries exhausted. Moved to dead-letter with reason.
- **Cancelled:** Admin cancels before sending; queued items marked cancelled.

### 4.2 Template rendering

- Syntax: `{{student.first_name}}`, `{{fee.amount_due}}`, `{{exam.date|date:'DD MMM'}}`.
- Context built per recipient from module data (Student, Fees, Exam, etc.).
- Fallback values: `{{fee.amount_due|default:'—'}}`.
- Versioned templates: `v1`, `v2`… only approved versions usable.
- Preview panel in composer shows 3 sample recipients.

### 4.3 Target resolution

| Target type | Resolution |
|-------------|------------|
| Individual | Direct student/parent/staff ID |
| Class/Section | All active students in class-section |
| House | All students in house |
| Bus Route | Students assigned to route |
| Role | All parents / all staff / all teachers |
| Custom filter | SQL-like builder: class=10 AND fee_status=overdue |
| Admission enquiry | Leads in Admission module |
| Event attendees | From Exam/Timetable/Event module |

Resolution happens at queue time (not compose time) so lists are fresh.

### 4.4 Channel specifics

| Channel | Provider interface | Cost tracking | Opt-out | Delivery receipt |
|---------|-------------------|---------------|---------|------------------|
| SMS | HTTP POST to gateway; webhook for DLR | Credits per segment | DND registry + local opt-out table | Yes (DLR) |
| Email | SMTP or HTTP API; webhook for bounce/delivered | Per email (provider bill) | Unsubscribe link + local table | Yes (webhook) |
| App Push | Firebase/OneSignal REST; token per device | Free (tier limits) | Device token revocation + local table | Yes (ack) |
| Notice Board | Internal DB write | Free | Role-based visibility | View log |

### 4.5 Quiet hours and frequency caps

- **Quiet hours:** Configurable per school (default 21:00–07:00). Messages scheduled in quiet hours hold until window opens.
- **Frequency caps:** Max SMS per parent per day (default 3), max email per day (default 5), max push per day (default 10). Exempt: emergency/alert templates.

### 4.6 Emergency/alert bypass

Templates tagged `alert: true` bypass quiet hours, frequency caps, and opt-outs (except hard DND). Requires principal/super-admin approval to create.

---

## 5. Why this is fast and reliable

**Speed.** Message volume is modest. Example: 2,000 students × 4 channels × 10 messages/month = 80,000 sends/month. Queue workers process ~1,000/min. Composer renders preview in <500 ms.

| Risk | Protection |
|------|------------|
| Provider downtime | Queue holds; retry with backoff; failover to secondary SMS gateway |
| Duplicate sends | Idempotency key per (message_id, recipient, channel); DB unique constraint |
| Wrong recipient | Target resolution at queue time; preview shows count; confirm modal before send |
| PII leak in logs | Mask phone/email in UI exports; full only for super-admin/auditor |
| Runaway costs | SMS credit wallet with low-balance alert; hard stop at zero |
| Spam complaints | Opt-out enforced at queue; frequency caps; unsubscribe in every email |
| Template error | Validation step renders for 3 samples; syntax errors block queue |
| Stuck messages | Dead-letter dashboard with retry/discard; alert after 1 hour in dead-letter |
| Lost delivery receipts | Webhook idempotency; periodic reconciliation job |
| Unauthorised send | Role-based send permission; alert template needs second approver |

---

## 6. Data model

### 6.1 Templates

| Table | Key fields |
|-------|------------|
| `comm_template` | id, code, name, channel (sms/email/push/notice/all), subject, body, placeholders (JSON), version, status (draft/approved/archived), approved_by, approved_at, is_alert, category, created_by |
| `comm_template_version` | template_id, version, subject, body, placeholders, changed_by, changed_at |

### 6.2 Messages and queue

| Table | Key fields |
|-------|------------|
| `comm_message` | id, template_id, template_version, name, channels (JSON array), target_type, target_filter (JSON), scheduled_at, status (draft/validated/queued/sending/sent/partial_failed/failed/cancelled), total_recipients, sent_count, delivered_count, failed_count, created_by, created_at, sent_at |
| `comm_message_recipient` | id, message_id, recipient_type (student/parent/staff/lead), recipient_id, channel, status (queued/sending/sent/delivered/failed/read/cancelled), provider_message_id, provider_response (JSON), error_code, error_message, queued_at, sent_at, delivered_at, read_at, retry_count, idempotency_key |
| `comm_outbox` | id, message_recipient_id, payload (JSON), attempts, next_retry_at, last_error, created_at |

### 6.3 Providers and credentials

| Table | Key fields |
|-------|------------|
| `comm_provider` | id, name, channel (sms/email/push), type (twilio/msg91/gupshup/smtp/sendgrid/ses/brevo/firebase/onesignal), config (JSON encrypted), is_primary, is_active, priority, daily_limit, monthly_limit, current_month_used |
| `comm_provider_credential` | provider_id, key, value_encrypted, description |

### 6.4 Preferences and opt-outs

| Table | Key fields |
|-------|------------|
| `comm_preference` | user_type (parent/staff), user_id, channel, opted_in, quiet_start, quiet_end, frequency_cap_daily, updated_at |
| `comm_opt_out` | channel, identifier (phone/email/token), reason, source (user/admin/dnd_registry), created_at |
| `comm_dnd_registry` | phone, registered_at, source (trai) |

### 6.5 Notice Board

| Table | Key fields |
|-------|------------|
| `comm_notice` | id, title, body, category, target_roles (JSON), target_classes (JSON), priority (normal/high/urgent), published_at, expires_at, attachment_urls (JSON), created_by, status (draft/published/archived) |
| `comm_notice_view` | notice_id, user_type, user_id, viewed_at |

### 6.6 Event triggers (integration points)

| Table | Key fields |
|-------|------------|
| `comm_event_trigger` | id, event_code (fee_due, exam_schedule, attendance_low, admit_card, admission_enquiry, timetable_change, result_published, fee_receipt, leave_approved, visitor_arrival), template_id, channel, conditions (JSON), is_active, created_by |
| `comm_event_log` | id, event_code, payload (JSON), trigger_id, message_id, status (processed/failed), created_at |

### 6.7 System tables

`comm_audit_log`, `comm_setting`, `comm_sms_credit_wallet` (balance, last_topup, alert_threshold).

---

## 7. Rules and policies

### Hard rules (always blocked)

- Send without an approved template (except super-admin raw send for testing).
- Send to a recipient who has opted out of that channel (except alert templates).
- Exceed SMS credit wallet balance.
- Send SMS to a number on TRAI DND registry (unless alert + principal override).
- Send email without unsubscribe link (unless alert).
- Exceed frequency cap for non-alert messages.
- Modify a queued/processing message.
- Delete a template version that has been used.
- Approve your own template (needs second approver).
- Send to inactive/deleted students/parents/staff.

### Soft rules (warn only)

- Target list > 5,000 recipients (confirm modal).
- SMS segments > 3 per message (cost warning).
- Email without plain-text version.
- Template unchanged for > 1 year (review reminder).
- Provider success rate < 95% in last 7 days.
- Quiet hours active for scheduled send.

### Policy settings the school can change

| Setting | Options |
|---------|---------|
| Default SMS provider | Primary + fallback |
| Default email provider | Primary + fallback |
| SMS credit alert threshold | Default 100 credits |
| Quiet hours | Default 21:00–07:00 |
| Frequency caps (SMS/Email/Push per day) | Default 3/5/10 |
| Alert template approvers | Principal + Super-admin |
| Retention: message logs | Default 365 days |
| Retention: notice views | Default 180 days |
| Email open tracking | On/Off (privacy) |
| Push notification sound | Default/custom |
| Notice board categories | Circular, Event, Exam, Fee, Holiday, Emergency, General |

---

## 8. Screens

1. **Template Library** — List, search, filter by channel/category. Create/edit with live preview (3 sample recipients). Version history. Approve/reject workflow.
2. **Compose Message** — Select template or raw (admin), choose channels, target resolver with count preview, schedule/recur options, cost estimate, confirm and send.
3. **Message Dashboard** — Cards: Queued, Sending, Sent (24h), Failed (24h), Dead-letter. Filters by channel, date, template. Drill to message detail.
4. **Message Detail** — Per-recipient status table with pagination, search, export. Retry failed, cancel queued, view provider response.
5. **SMS Credit Wallet** — Balance, top-up history, low-balance alert config, provider usage charts.
6. **Provider Management** — Add/edit providers, test connection, set primary/fallback, view success rates.
7. **Preference Centre (Admin view)** — Bulk view of parent/staff opt-ins, override if needed.
8. **Notice Board** — Create/edit notices with rich text, target roles/classes, schedule publish/expire, pin urgent, attachment upload. Public view for parents/students.
9. **Event Triggers** — Map event codes to templates, conditions, channels. Test trigger with sample payload.
10. **Communication Logs (Audit)** — Immutable log of all sends, template changes, provider config changes, preference changes. Filter, export.
11. **Parent/Staff Portal – Preferences** — Self-service opt-in/out per channel, quiet hours, frequency caps.
12. **Parent/Staff Portal – Inbox** — Unified view of SMS, email, push, notices received. Mark read, search, filter.

---

## 9. Workflows

### 9.1 Compose and send (ad-hoc)

1. Admin opens Compose, picks template or writes raw (admin only).
2. Selects channels, builds target (class 10A + bus route 3).
3. System resolves targets, filters opt-outs, renders preview for 3 samples.
4. Shows cost estimate (SMS credits), schedule options, confirm modal.
5. On confirm: message row created, recipients resolved, outbox rows queued.
6. Workers pick up, call providers, update statuses.
7. Webhooks update delivered/read; dead-letter on max retries.

### 9.2 Scheduled / recurring

1. Compose with `scheduled_at` future date or `recurrence` (cron-like: monthly 1st 09:00).
2. At scheduled time, same queue process runs.
3. Recurring creates new message instance each run (linked to parent schedule).

### 9.3 Event-driven (automatic)

1. Fees module emits `fee_due` event with payload: student_id, amount, due_date.
2. `comm_event_trigger` matches, evaluates conditions (e.g., `amount > 5000`).
3. If matched, renders template, resolves recipient (student's primary parent), queues message.
4. `comm_event_log` records linkage for traceability.

### 9.4 Notice board publish

1. Admin creates notice, sets targets (all parents, class 12), priority, publish/expire dates.
2. On publish: notice row status → published; push notification sent to target app users (if enabled).
3. Parents/students see in portal/app notice feed; view logged.

### 9.5 Preference management

1. Parent logs in, goes to Preferences.
2. Toggles SMS off, sets quiet hours 22:00–06:00.
3. Saved to `comm_preference`; next queue run respects it.
4. Admin can view/override in admin preference screen.

### 9.6 Provider failover (SMS)

1. Primary provider returns 5xx or timeout.
2. Worker retries 2× with backoff.
3. On 3rd failure, tries fallback provider (if configured).
4. Logs provider used per recipient.

---

## 10. Roles, alerts and reports

### Roles

| Role | Allowed actions |
|------|-----------------|
| Super Admin | All: templates, providers, send raw, audit, settings |
| Principal | Approve alert templates, view all logs, send to all |
| Communications Officer | Create/edit templates, compose/send, manage providers, view logs |
| Class Teacher | Send to own class/section (template only), view own sent |
| Fee Clerk | Trigger fee reminders (pre-approved templates only) |
| Exam Coordinator | Trigger exam alerts (pre-approved templates only) |
| Admission Counsellor | Send to leads/enquiries (pre-approved templates) |
| Warden/Hostel Staff | Send to hostel parents (pre-approved) |
| Parent | View inbox, manage preferences |
| Staff | View inbox, manage preferences |
| Auditor | Read-only: logs, audit trail, delivery reports |

### Alerts (internal, to staff)

| Event | Who is notified |
|-------|-----------------|
| SMS credits below threshold | Communications Officer, Principal |
| Provider success rate < 95% (7d) | Communications Officer |
| Dead-letter queue > 50 messages | Communications Officer |
| Template used but not approved | Principal |
| Mass send (>1000) initiated | Principal (info) |
| Recurring send failed 3× in a row | Communications Officer |
| Opt-out rate > 5% in a campaign | Communications Officer |

### Reports

1. **Delivery Summary** — By date, channel, template: sent, delivered, failed, read rates.
2. **Cost Report** — SMS credits used, cost per provider, per template, per month.
3. **Opt-out Report** — Opt-outs by channel, reason, trend.
4. **Engagement Report** — Email open/click, push read, notice views.
5. **Event Trigger Report** — Triggers fired, messages generated, success rate.
6. **Audit Trail** — All admin actions with timestamp, user, before/after.
7. **Failed Messages** — Detail with error codes, retry counts, recipient.
8. **Notice Board Analytics** — Views by notice, by role, by class.

---

## 11. Scenario coverage

The Step column refers to the build plan in section 12.

### 11.1 Templates

| Scenario | How it is handled | Step |
|----------|-------------------|------|
| Fee reminder with amount due | Template `fee_reminder` with `{{fee.amount_due}}`, `{{fee.due_date}}` | 1 |
| Exam schedule change | Template `exam_reschedule` with `{{exam.new_date}}`, `{{exam.subject}}` | 1 |
| Attendance alert (below 75%) | Template `attendance_low` with `{{attendance.percent}}` | 1 |
| Admission enquiry acknowledgement | Template `admission_ack` with `{{enquiry.reference_no}}` | 1 |
| Transport delay | Template `bus_delay` with `{{bus.route}}`, `{{bus.eta}}` | 1 |
| Result published | Template `result_published` with `{{result.term}}`, `{{result.portal_url}}` | 1 |
| Custom raw message (admin only) | Compose raw, bypass template (super-admin only) | 2 |
| Template version rollback | Version history, set previous as active | 1 |
| Multilingual template | Separate template per language, target by parent language pref | Later |

### 11.2 SMS

| Scenario | How it is handled | Step |
|----------|-------------------|------|
| Single gateway (MSG91) | Provider config, primary only | 2 |
| Primary + fallback (Twilio → Gupshup) | Priority order, auto-failover | 2 |
| DND number blocked | Check `comm_dnd_registry` + local opt-out at queue | 2 |
| Long message (>160 chars) | Auto-segment, cost = segments × rate | 2 |
| Unicode (Hindi/Tamil) | Detect, segment size 70, cost adjusted | 2 |
| Delivery receipt (DLR) | Webhook updates `delivered_at` | 2 |
| Failed DLR (no receipt in 24h) | Status stays `sent`, reconciliation job later | 2 |
| Low credit alert | Wallet balance < threshold → email to comm officer | 2 |
| Credit top-up | Manual entry + provider API sync | 2 |
| Scheduled SMS in quiet hours | Held until quiet hours end | 3 |

### 11.3 Email

| Scenario | How it is handled | Step |
|----------|-------------------|------|
| SMTP (school server) | Provider type `smtp`, config host/port/user/pass | 3 |
| Transactional API (SendGrid/SES/Brevo) | Provider type `http`, API key, template ID optional | 3 |
| Unsubscribe link auto-added | Footer injected if missing (non-alert) | 3 |
| Bounce/complaint webhook | Updates status `failed`, logs reason, auto opt-out on hard bounce | 3 |
| Open tracking (optional) | 1px pixel if setting on, logged as `read_at` | 3 |
| Attachment (fee receipt PDF) | Template placeholder `{{fee.receipt_url}}`, sent as link | 3 |
| Rich HTML + plain text | Both required; validator warns if plain text missing | 3 |
| Scheduled email in quiet hours | Held until window opens | 3 |

### 11.4 App Push Notifications

| Scenario | How it is handled | Step |
|----------|-------------------|------|
| Firebase (FCM) | Provider type `firebase`, service account JSON | 4 |
| OneSignal | Provider type `onesignal`, app ID + REST key | 4 |
| Device token management | App registers token on login; revoked on logout/uninstall | 4 |
| Topic-based (class 10A) | Subscribe tokens to topic; send to topic | 4 |
| Data payload + notification | Both sent; app handles foreground/background | 4 |
| Read receipt | App calls back `/push/read` on open | 4 |
| Quiet hours respected | Server holds push until window (FCM TTL) | 4 |
| Frequency cap | Per-user per-day count checked at queue | 4 |

### 11.5 Notice Board

| Scenario | How it is handled | Step |
|----------|-------------------|------|
| Circular to all parents | Target roles `["parent"]`, published now | 5 |
| Exam timetable for Class 12 | Target classes `["12A","12B"]`, category `exam` | 5 |
| Urgent holiday announcement | Priority `urgent`, push notification auto-sent | 5 |
| Pinned notice (fee deadline) | `pinned: true`, stays top until unpinned | 5 |
| Attachment (PDF circular) | Upload, stored in object storage, URL in notice | 5 |
| Expiry auto-archive | `expires_at` passed → status `archived` | 5 |
| View tracking | `comm_notice_view` row on open | 5 |
| Parent portal notice feed | API returns active notices for user's roles/classes | 5 |

### 11.6 Message Logs

| Scenario | How it is handled | Step |
|----------|-------------------|------|
| Search by parent phone | Filter recipient_id + channel=sms | 6 |
| Export failed SMS (last 7 days) | Filter status=failed, channel=sms, date range | 6 |
| Retry dead-letter | Select rows → Retry (re-queues with same idempotency key) | 6 |
| Audit trail for a message | `comm_audit_log` filtered by message_id | 6 |
| Reconciliation report | Compare sent count vs provider webhook count | 6 |

### 11.7 Preferences & Compliance

| Scenario | How it is handled | Step |
|----------|-------------------|------|
| Parent opts out of SMS | Portal toggle → `comm_preference` + `comm_opt_out` | 7 |
| Staff sets quiet hours | Portal → saved, respected at queue | 7 |
| TRAI DND sync | Weekly job pulls registry → `comm_dnd_registry` | 7 |
| Alert bypasses opt-out | Template `is_alert=true` + principal approval | 7 |
| Frequency cap hit | Queue skips recipient, logs `frequency_capped` | 7 |

### 11.8 Event Integrations

| Scenario | How it is handled | Step |
|----------|-------------------|------|
| Fee due → SMS + Email | Trigger `fee_due` → template `fee_reminder` → channels `["sms","email"]` | 8 |
| Exam scheduled → Push + Notice | Trigger `exam_schedule` → template `exam_schedule` → channels `["push","notice"]` | 8 |
| Attendance < 75% → SMS to parent | Trigger `attendance_low` (daily job) → template `attendance_low` | 8 |
| Admit card released → Email + Push | Trigger `admit_card` → template `admit_card_released` | 8 |
| Admission enquiry → Auto-reply | Trigger `admission_enquiry` → template `admission_ack` | 8 |
| Timetable change → Push to affected | Trigger `timetable_change` → target students in changed classes | 8 |
| Result published → Notice + Email | Trigger `result_published` → channels `["notice","email"]` | 8 |
| Fee receipt → Email (PDF) | Trigger `fee_receipt` → template with attachment link | 8 |
| Leave approved → SMS to parent | Trigger `leave_approved` → template `leave_status` | 8 |
| Visitor arrival → SMS to parent | Trigger `visitor_arrival` → template `visitor_notice` | 8 |

---

## 12. Build plan

| Step | Deliverable | Done when |
|------|-------------|-----------|
| 1. Template Engine | Template CRUD, versioning, approval workflow, placeholder resolver, preview with 3 samples, category/tagging | Templates can be created, approved, rendered for any context |
| 2. SMS Channel | Provider abstraction, 2+ providers configured, queue worker, DLR webhook, credit wallet, failover, quiet hours, frequency cap | SMS sends end-to-end with delivery tracking and cost control |
| 3. Email Channel | Provider abstraction (SMTP + 1 HTTP API), queue worker, bounce/complaint webhook, unsubscribe injection, open tracking (opt-in), quiet hours, frequency cap | Emails send with delivery/bounce tracking and compliance |
| 4. App Push Channel | Firebase/OneSignal provider, device token registry, topic subscription, data+notification payload, read receipt webhook, quiet hours, frequency cap | Push delivers to app users with read tracking |
| 5. Notice Board | Notice CRUD, rich text, targeting (roles/classes), publish/expire schedule, pin, attachments, view logging, parent/student feed API | Notices publish, expire, track views, appear in portal |
| 6. Message Logs & Dashboard | Unified log (message + recipient + channel), status timeline, search/filter/export, dead-letter dashboard with retry, reconciliation job, audit log | Every send traceable; failed messages recoverable |
| 7. Preference Centre | Admin view + parent/staff portal self-service, opt-in/out per channel, quiet hours, frequency caps, DND registry sync | Preferences enforced at queue time |
| 8. Event Integrations | Trigger registry for 10+ events (fee, exam, attendance, admission, timetable, result, receipt, leave, visitor), condition engine, test harness | Automatic messages fire from module events |
| 9. Compose & Send UI | Composer with target builder, cost estimate, schedule/recur, confirm modal, template picker, raw mode (admin) | Ad-hoc sends work smoothly |
| 10. Reports | 8 reports (delivery, cost, opt-out, engagement, trigger, audit, failed, notice analytics) with filters, export, scheduled email | Stakeholders get insights without SQL |
| 11. Roles & Permissions | RBAC matrix enforced on all screens/actions, alert template dual-approval | Right people do right things |
| 12. Hardening | Rate limiting, idempotency keys, encryption at rest for credentials, PII masking in exports, retention jobs, load test 10k sends | Production-ready reliability |
| 13. Parent/Staff Inbox | Unified inbox in portal/app: SMS, email, push, notices; search, filter, mark read | Recipients see all comms in one place |
| 14. Scheduled/Recurring | Cron-like scheduler, timezone-aware, recurrence instances linked to parent | Recurring fee reminders run automatically |
| 15. Multi-language (templates) | Template per language, parent language preference resolver | Hindi/Tamil templates selectable |
| 16. WhatsApp Business (optional) | Provider adapter, template approval (Meta), opt-in flow, session vs template messages | WhatsApp as additional channel |
| 17. Rich Media & Interactive | Email drag-drop designer (later), push rich media, notice board comments | Enhanced engagement |
| 18. Advanced Analytics | Funnel (sent→delivered→read→action), cohort, A/B test framework | Data-driven communication |
| 19. AI Assist (later) | Subject line optimizer, send-time optimizer, content suggestions | Smarter messaging |

---

## 13. Performance, Security, Reliability

### Performance

- **Queue throughput:** 1,000 messages/min per worker; horizontal scaling via worker count.
- **Target resolution:** Cached for 5 min during bulk send; max 5,000 recipients per message (soft limit).
- **Template rendering:** Compiled Handlebars templates cached; <5 ms per recipient.
- **Database indexes:** `comm_message_recipient(message_id, channel, status)`, `comm_outbox(next_retry_at, attempts)`, `comm_preference(user_type, user_id, channel)`.
- **Connection pooling:** Provider HTTP clients pooled; SMTP connection reused.

### Security

- **Credentials:** Encrypted at rest (AES-256); decrypted only in worker memory.
- **PII:** Phone/email masked in UI (last 4 digits); full only for super-admin/auditor with audit log.
- **Transport:** TLS 1.2+ for all provider APIs and webhooks.
- **Webhook verification:** Signature validation (Twilio X-Signature, SendGrid Signed Event, Firebase App Check).
- **Access control:** RBAC on every API endpoint; row-level for message logs (teacher sees only own class).
- **Audit:** All admin actions logged immutably (`comm_audit_log` append-only).
- **Retention:** Auto-purge message logs after configurable days (default 365); notice views 180 days.
- **Opt-out enforcement:** Checked at queue time; cannot be bypassed except alert templates with dual approval.

### Reliability

- **Idempotency:** `idempotency_key` per (message, recipient, channel); unique constraint prevents duplicates.
- **Retry policy:** Exponential backoff (1m, 5m, 15m, 1h, 6h, 24h); max 6 attempts.
- **Dead-letter:** After max retries → `dead_letter` status; dashboard for manual retry/discard.
- **Reconciliation:** Daily job compares `sent` count vs provider webhook `delivered` count; alerts on drift > 2%.
- **Failover:** SMS primary → fallback automatic; email primary → fallback on 5xx.
- **Graceful degradation:** If push provider down, queue holds; notice board and SMS/email unaffected.
- **Disaster recovery:** Outbox table survives app restart; workers resume from `next_retry_at`.

---

## 14. Out of scope (first release)

| Feature | Planned step |
|---------|--------------|
| WhatsApp Business API | 16 |
| Voice calls / IVR | Later |
| Chatbot / two-way SMS | Later |
| Social media posting (FB/Twitter) | Later |
| Multilingual auto-translation | Later |
| MMS / rich media in SMS | Later |
| Drag-drop email designer | 17 |
| Advanced analytics (funnels, cohorts, A/B) | 18 |
| AI send-time/content optimization | 19 |
| Dedicated parent communication mobile app | Later |
| Video/voice message in notice board | Later |
| Geo-fenced notifications | Later |
| Communication workflow builder (visual) | Later |

---

## 15. Open decisions

1. **SMS providers:** Which two gateways (MSG91, Twilio, Gupshup, local)? Contract and pricing?
2. **Email provider:** SMTP (school server) vs transactional API (SendGrid/SES/Brevo)? Volume estimate?
3. **Push provider:** Firebase (FCM) or OneSignal? Existing app uses which?
4. **Alert template approvers:** Principal only, or Principal + Chairman/Trustee?
5. **Quiet hours:** School-wide or per-parent configurable? Default 21:00–07:00 OK?
6. **Frequency caps:** Daily limits (SMS 3, Email 5, Push 10) — adjust per school policy?
7. **Retention periods:** Message logs 365 days, notice views 180 days — legal/compliance requirements?
8. **Email open tracking:** Enable by default? Privacy policy impact?
9. **DND registry sync:** TRAI API access? Frequency? Manual upload fallback?
10. **Template languages:** English + Hindi + Tamil + other? Who translates?
11. **Cost allocation:** SMS credits purchased centrally or per-branch? Wallet per branch?
12. **Integration event payloads:** Finalize JSON schema for each event code with module owners.
13. **Notice board categories:** Final list (Circular, Event, Exam, Fee, Holiday, Emergency, General, Academic, Sports, Transport)?
14. **Parent portal inbox:** Unified timeline or tabbed by channel?
15. **Scheduled send timezone:** School timezone or recipient timezone?
16. **Recurrence limits:** Max instances per schedule? End date required?
17. **Failure escalation:** Dead-letter alert after 1 hour — also create ticket in helpdesk?
18. **Audit log retention:** 7 years for compliance? Separate archive store?
19. **Load test baseline:** Target 10k sends in 10 min — infrastructure ready?

---

## 16. Build strategy

**Philosophy:** Ship channel by channel, each production-ready, with templates and logs from day one.

### Phase 1 — Foundation (Steps 1–3, Weeks 1–3)
- Template engine + SMS + Email.
- Why: Covers 80% of urgent needs (fee reminders, exam alerts, admission acknowledgements).
- Gate: Fee reminder SMS+Email works end-to-end with delivery tracking.

### Phase 2 — Reach (Steps 4–5, Weeks 4–5)
- App Push + Notice Board.
- Why: Reduces SMS cost; notice board replaces paper circulars.
- Gate: Push delivers to test devices; notice board visible in parent portal.

### Phase 3 — Intelligence (Steps 6–8, Weeks 6–8)
- Message Logs dashboard + Preferences + Event Integrations.
- Why: Observability, compliance, automation (no manual sends for routine events).
- Gate: 10 event triggers live; dead-letter < 1%; preferences enforced.

### Phase 4 — Polish (Steps 9–12, Weeks 9–11)
- Compose UI + Reports + Roles + Hardening.
- Why: Usable by non-tech staff; audit-ready; production reliability.
- Gate: Communications Officer sends 5 campaigns solo; load test passes.

### Phase 5 — Enhance (Steps 13–15, Weeks 12–14)
- Inbox + Scheduler + Multi-language.
- Why: Recipient experience; recurring automation; inclusivity.
- Gate: Parents view all comms in app; monthly fee reminder auto-runs.

### Phase 6 — Future (Steps 16–19, Post-launch)
- WhatsApp, Rich media, Analytics, AI.
- Driven by adoption metrics and school requests.

**Risk mitigation:**
- Provider contracts signed before Phase 1.
- Template placeholders reviewed with Fees/Exam/Attendance/Admission module owners before Phase 1.
- DND registry access confirmed before Phase 3.
- Load test environment mirrors production (queue workers, DB, provider sandbox).

---

*End of document*