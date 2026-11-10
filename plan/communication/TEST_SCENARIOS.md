# Communication — Test Scenarios

**Legend:** ✅ expected pass · ⛔ expected block · ⚠️ warning only

---

## A. Templates, Providers & Settings

| # | Scenario | Expected |
|---|---|---|
| A1 | Create SMS template with variables `{{student_name}}`, `{{amount}}` | Saved, variables extracted |
| A2 | Create email template with rich HTML body | Saved, HTML sanitized |
| A3 | Create push template without subject | ⛔ subject required for push |
| A4 | Preview template with sample data | Rendered output matches expected |
| A5 | Duplicate template code | ⛔ unique constraint |
| A6 | Configure Twilio provider with valid credentials | Saved, test SMS sends |
| A7 | Configure SendGrid provider with invalid API key | Saved, test email fails with provider error |
| A8 | Set provider as default for channel | Only one default per channel |
| A9 | Update SMS rate limit setting | New limit enforced on next send |
| A10 | Change opt-out keyword | New keyword recognized in webhook |
| A11 | Delete template used by automation | ⛔ foreign key RESTRICT |
| A12 | Soft-delete provider | Hidden from lists, not usable for new sends |

---

## B. SMS Sending

| # | Scenario | Expected |
|---|---|---|
| B1 | Send SMS to single student via template | Queued → sent → delivered, log created |
| B2 | Send SMS to filtered audience (class 10A) | All active students in 10A receive |
| B3 | Send SMS with custom phone list | Each number receives, custom recipients created |
| B4 | Schedule SMS for future | Status `queued` until scheduled_at, then sends |
| B5 | Cancel scheduled SMS before send | Status `cancelled`, no send attempted |
| B6 | Retry failed SMS recipients | Only failed recipients retried, new log entries |
| B7 | Primary provider fails, fallback succeeds | Fallback provider used, log shows fallback |
| B8 | All providers fail | Status `failed`, error logged, retry scheduled |
| B9 | Recipient opted out of SMS | Status `opted_out`, no provider call |
| B10 | Invalid phone number format | ⛔ validation error before queue |
| B11 | Send SMS with missing template variables | ⛔ validation error |
| B12 | Bulk SMS exceeds rate limit | 429 response, retry-after header |
| B13 | Webhook delivery receipt updates status | Recipient + log status → `delivered` |
| B14 | Webhook for undelivered updates status | Recipient + log status → `undelivered` |
| B15 | Duplicate webhook received | Idempotent, no duplicate log entries |

---

## C. Email Sending

| # | Scenario | Expected |
|---|---|---|
| C1 | Send email with HTML body and attachment | Sent, attachment included, log created |
| C2 | Send email to filtered audience (all parents) | All primary guardian emails receive |
| C3 | Schedule email for later | Queued until scheduled_at |
| C4 | Cancel scheduled email | Cancelled, no send |
| C5 | Retry bounced emails | Only bounced recipients retried |
| C6 | Primary email provider fails, fallback succeeds | Fallback used |
| C7 | Recipient opted out of email | Status `opted_out`, not sent |
| C8 | Invalid email format | ⛔ validation error |
| C9 | Attachment exceeds size limit | ⛔ validation error |
| C10 | Webhook: delivered → opened → clicked | Status progression in log |
| C11 | Webhook: bounce (hard) | Status `bounced`, recipient `bounced` |
| C12 | Webhook: spam complaint | Status `complained`, recipient `complained` |
| C13 | Duplicate webhook events | Idempotent |
| C14 | Email with CC/BCC (if supported) | All recipients logged separately |

---

## D. Notice Board

| # | Scenario | Expected |
|---|---|---|
| D1 | Create draft notice with rich text and attachment | Saved as draft, not visible to audience |
| D2 | Publish notice to all students | `is_published=true`, push sent if opted |
| D3 | Publish notice to class 10A only | Only 10A students see it |
| D4 | Pin notice | Appears at top of published list |
| D5 | Set expire_at in past | Notice not published / auto-unpublished |
| D6 | Student reads notice | `school_notice_read` row created |
| D7 | Read report shows correct counts | Read / total matches recipients |
| D8 | Unpublish notice | Hidden from audience, draft restored |
| D9 | Delete published notice | Soft-deleted, read data retained |
| D10 | Restore soft-deleted notice | Back in drafts |
| D11 | Attachment upload > max size | ⛔ validation error |
| D12 | Attachment with disallowed MIME type | ⛔ validation error |
| D13 | Push notification sent on publish | `school_app_notification` rows created |
| D14 | Audience = custom (multi-select staff) | Only selected staff see notice |

---

## E. App Notifications (Push)

| # | Scenario | Expected |
|---|---|---|
| E1 | Send push to single parent via FCM | Delivered, status `delivered` |
| E2 | Send push to filtered audience (section 10B) | All parents of 10B students receive |
| E3 | Send in-app only (no push) | `channel=in_app`, no provider call |
| E4 | Send both push and in-app | Two notification rows, same data |
| E5 | Push to device with invalid token | Provider returns error, status `failed` |
| E6 | User reads in-app notification | Status `read`, `read_at` set |
| E7 | User clicks notification (deep link) | Status `clicked`, `clicked_at` set, nav works |
| E8 | Schedule push for later | Queued until scheduled_at |
| E9 | Cancel scheduled push | Cancelled |
| E10 | Bulk push exceeds provider rate limit | Batched, retried with backoff |
| E11 | OneSignal webhook: delivered → opened | Status progression |
| E12 | Firebase webhook: token invalid | Token marked invalid, future sends skip |

---

## F. Message Logs & Reports

| # | Scenario | Expected |
|---|---|---|
| F1 | SMS logs filter by status `failed` | Only failed logs shown |
| F2 | Email logs filter by provider `sendgrid` | Only SendGrid logs |
| F3 | SMS log export CSV | All columns, masked phone |
| F4 | Email log export CSV | All columns, masked email |
| F5 | Summary report for date range | Correct aggregates per channel |
| F6 | SMS report shows cost per provider | Cost summed correctly |
| F7 | Email report shows open/click rates | Rates calculated correctly |
| F8 | Notice report shows read rate | Read / recipients × 100 |
| F9 | Push report shows delivery/read rates | Rates calculated correctly |
| F10 | Template usage report | Counts messages per template |
| F11 | Report with no data | Empty state, not error |

---

## G. Automations

| # | Scenario | Expected |
|---|---|---|
| G1 | Create automation for `fee.due_soon` with SMS template | Saved, active |
| G2 | Fee module emits `fee.due_soon` event | Automation triggers, SMS queued |
| G3 | Automation filter: class_ids=[5] | Only class 5 students receive |
| G4 | Automation filter: fee_head_ids=[10,11] | Only matching fee heads trigger |
| G5 | Test automation with sample payload | Preview shows rendered message |
| G6 | Disable automation | No triggers while disabled |
| G7 | Automation last_run_at updated | Timestamp set after each run |
| G8 | Automation last_run_count > 0 | Count of messages sent |
| G9 | Automation with invalid template_id | ⛔ FK constraint |
| G10 | Multiple automations for same event | All fire independently |
| G11 | Automation variable mapping from payload | Payload fields → template variables |

---

## H. Opt-out & Compliance

| # | Scenario | Expected |
|---|---|---|
| H1 | Parent replies STOP to SMS | Opt-out record created, future SMS blocked |
| H2 | Parent clicks unsubscribe link in email | Opt-out record created, future email blocked |
| H3 | Opt-out SMS but not email | SMS blocked, email still sends |
| H4 | Re-opt-in via API | Opt-out record removed, sends resume |
| H5 | Opt-out checked before every send | No send to opted-out contacts |
| H6 | Opt-out list export | CSV with contact, channel, date |

---

## I. Permissions

| # | Scenario | Expected |
|---|---|---|
| I1 | User with `communication.view` opens dashboard | ✅ read-only |
| I2 | User with `communication.send` sends SMS | ✅ |
| I3 | User with `communication.send` tries to manage template | ⛔ 403 |
| I4 | User with `communication.notice` publishes notice | ✅ |
| I5 | User with `communication.push` sends push | ✅ |
| I6 | User with `communication.logs` views SMS logs | ✅ |
| I7 | User with `communication.reports` views reports | ✅ |
| I8 | User with `communication.automation` creates automation | ✅ |
| I9 | User with `communication.audit` views audit log | ✅ |
| I10 | User without any comm permission accesses `/communication` | ⛔ 403 |
| I11 | Teacher with class-scoped permission sends to own class | ✅ |
| I12 | Teacher tries to send to other class | ⛔ 403 |

---

## J. Retention & Cleanup

| # | Scenario | Expected |
|---|---|---|
| J1 | SMS logs older than retention_days deleted | Cleanup job removes, count matches |
| J2 | Email logs older than retention_days deleted | Cleanup job removes |
| J3 | Push logs older than retention_days deleted | Cleanup job removes |
| J4 | Notice reads older than retention_days deleted | Cleanup job removes |
| J5 | Retention setting change applies to future cleanup | New cutoff used |
| J6 | Cleanup job does not delete referenced data | FK constraints respected |

---

## K. Edge Cases & Stress

| # | Scenario | Expected |
|---|---|---|
| K1 | Send 10,000 SMS in one bulk | Batched, rate limited, all queued |
| K2 | Send email with 50 attachments | ⛔ attachment count/size limit |
| K3 | Template with 50 variables | All rendered, performance OK |
| K4 | Notice with 100 attachments | ⛔ attachment limit |
| K5 | Concurrent sends to same recipient | Deduplication or sequential, no duplicate |
| K6 | Provider webhook storm (1000/sec) | Processed async, no data loss |
| K7 | Database connection loss during send | Transaction rollback, message stays `queued` |
| K8 | Template variable references deleted student | Variable renders as empty/placeholder |
| K9 | Automation triggers during maintenance window | Queued, runs after window |
| K10 | Mixed channel send (SMS + email + push) | Three separate messages, linked by campaign_id |

---

## Automation Structure

```
tests/communication/
├── templates.test.js        # A1–A12
├── sms_send.test.js         # B1–B15
├── email_send.test.js       # C1–C14
├── notice_board.test.js     # D1–D14
├── push_notifications.test.js # E1–E12
├── logs_reports.test.js     # F1–F11
├── automations.test.js      # G1–G11
├── opt_out.test.js          # H1–H6
├── permissions.test.js      # I1–I12
├── retention.test.js        # J1–J6
└── stress.test.js           # K1–K10
```

Each test seeds its own fixtures (templates, providers, recipients), calls the API
with a role-scoped token, and asserts both the HTTP response and the database
state. Destructive cases run inside a transaction that is rolled back.

---

## Test Data Factories

```javascript
// tests/factories/communication.js
export const createTemplate = async (pool, appId, overrides = {}) => {
  const code = overrides.code || `test_tpl_${Date.now()}`;
  const { rows } = await pool.query(
    `INSERT INTO school_communication_template (app_id, code, name, channel, subject, body_text, variables)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [appId, code, overrides.name || 'Test Template', overrides.channel || 'sms',
     overrides.subject, overrides.body_text || 'Hello {{name}}', JSON.stringify(overrides.variables || [])]
  );
  return rows[0];
};

export const createProvider = async (pool, appId, overrides = {}) => {
  const code = overrides.code || `test_prov_${Date.now()}`;
  const { rows } = await pool.query(
    `INSERT INTO school_communication_provider (app_id, code, name, type, channel, config, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [appId, code, overrides.name || 'Test Provider', overrides.type || 'twilio',
     overrides.channel || 'sms', JSON.stringify(overrides.config || {}), true]
  );
  return rows[0];
};

export const createRecipient = (type, id, contact) => ({ type, id, contact });
```