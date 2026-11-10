# Communication — API Endpoints

All endpoints are under `/api/school/communication`. The router is mounted in
`server/src/index.js` **before** `schoolCompRouter` so the richer communication
handlers are not shadowed by the legacy module.

Authentication: `Authorization: Bearer <token>`. Tenant scope comes from
`req.school.appId`.

---

## Permissions

| Permission | Used for |
|---|---|
| `communication.view` | All GET endpoints (dashboard, templates, providers, settings) |
| `communication.manage` | Template/provider/settings CRUD |
| `communication.send` | Send SMS, email, push |
| `communication.logs` | SMS/email delivery logs |
| `communication.notice` | Create, edit, publish, unpublish notices |
| `communication.notice_read` | View notice read reports |
| `communication.push` | Send app push notifications |
| `communication.reports` | Communication reports |
| `communication.automation` | Manage automation rules |
| `communication.audit` | View audit log |

---

## Dashboard

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/dashboard` | view | KPIs: SMS/email/push volume, delivery rates, notice count, opt-outs |

---

## Templates

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/templates` | view | List templates (filter: channel, language, active) |
| POST | `/templates` | manage | Create template |
| GET | `/templates/:id` | view | Template detail |
| PUT | `/templates/:id` | manage | Update template |
| DELETE | `/templates/:id` | manage | Soft-delete template |
| POST | `/templates/:id/preview` | view | Render with sample variables |
| POST | `/templates/:id/clone` | manage | Duplicate template |

### Template Variable Format

Variables use `{{variable_name}}` syntax in subject/body.  
`variables` column is JSONB array: `[{"name": "student_name", "type": "string", "description": "Student full name"}, ...]`

Supported types: `string`, `number`, `date`, `currency`, `boolean`.

---

## Providers

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/providers` | view | List providers (filter: channel, active) |
| POST | `/providers` | manage | Create provider |
| GET | `/providers/:id` | view | Provider detail (config masked in list) |
| PUT | `/providers/:id` | manage | Update provider |
| DELETE | `/providers/:id` | manage | Soft-delete provider |
| POST | `/providers/:id/test` | manage | Send test message via provider |
| PUT | `/providers/:id/set-default` | manage | Set as default for channel |

### Provider Config Schemas

**SMS (Twilio):**
```json
{
  "account_sid": "ACxxx",
  "auth_token": "***",
  "from_number": "+15551234567",
  "messaging_service_sid": "MGxxx"
}
```

**SMS (MSG91):**
```json
{
  "auth_key": "***",
  "sender_id": "SCHOOL",
  "route": "4",
  "template_id": "TMPL_123"
}
```

**Email (SendGrid):**
```json
{
  "api_key": "***",
  "from_email": "noreply@school.edu",
  "from_name": "School ERP",
  "ip_pool": "school_pool"
}
```

**Email (Mailgun):**
```json
{
  "api_key": "***",
  "domain": "mg.school.edu",
  "from_email": "noreply@school.edu",
  "from_name": "School ERP"
}
```

**Push (Firebase):**
```json
{
  "project_id": "school-erp",
  "service_account": "***",
  "default_topic": "all_users"
}
```

**Push (OneSignal):**
```json
{
  "app_id": "xxx",
  "rest_api_key": "***",
  "default_segment": "Subscribed Users"
}
```

---

## Settings

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/settings` | view | All communication settings |
| PUT | `/settings` | manage | Update settings (bulk) |
| PUT | `/settings/:key` | manage | Update single setting |

---

## SMS Sending

| Method | Path | Permission | Purpose |
|---|---|---|---|
| POST | `/sms/send` | send | Send single SMS |
| POST | `/sms/send-bulk` | send | Send SMS to filtered audience |
| POST | `/sms/schedule` | send | Schedule SMS for later |

### Send SMS Request

```json
{
  "template_id": 12,
  "recipients": [
    {"type": "student", "id": 45, "contact": "+919876543210"},
    {"type": "parent", "id": 45, "contact": "+919876543211"}
  ],
  "variables": {"student_name": "Aarav Sharma", "amount": "5000"},
  "scheduled_at": "2026-11-05T09:00:00Z",
  "provider_id": 3
}
```

### Send SMS Bulk Request

```json
{
  "template_id": 12,
  "audience": {"type": "class", "class_id": 5, "section_id": 2},
  "variables": {"student_name": "{{student_name}}", "fee_due": "{{fee_due}}"},
  "scheduled_at": "2026-11-05T09:00:00Z"
}
```

Audience types: `all_students`, `all_parents`, `all_staff`, `class`, `section`, `hostel`, `custom_ids`.

---

## Email Sending

| Method | Path | Permission | Purpose |
|---|---|---|---|
| POST | `/email/send` | send | Send single email |
| POST | `/email/send-bulk` | send | Send email to filtered audience |
| POST | `/email/schedule` | send | Schedule email for later |

### Send Email Request

```json
{
  "template_id": 8,
  "recipients": [
    {"type": "parent", "id": 45, "contact": "parent@example.com"}
  ],
  "variables": {"student_name": "Aarav Sharma", "exam_name": "Mid Term"},
  "attachments": [
    {"file_name": "report.pdf", "file_url": "https://cdn.school.edu/report.pdf", "mime_type": "application/pdf"}
  ],
  "scheduled_at": "2026-11-05T10:00:00Z"
}
```

---

## Messages & Recipients

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/messages` | send | List messages (filter: channel, status, date, template) |
| GET | `/messages/:id` | send | Message detail with recipient status breakdown |
| POST | `/messages/:id/cancel` | send | Cancel scheduled message |
| POST | `/messages/:id/retry` | send | Retry failed recipients |
| GET | `/messages/:id/recipients` | send | Paginated recipient list with status |

### Message Statuses

`draft` → `queued` → `sending` → `sent` / `partial` / `failed` / `cancelled`

### Recipient Statuses

`pending` → `queued` → `sent` → `delivered` / `failed` / `bounced` / `complained` / `opted_out` / `cancelled`

---

## SMS Logs

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/sms/logs` | logs | Paginated SMS logs (filter: status, provider, date, to_number) |
| GET | `/sms/logs/:id` | logs | Single log detail |
| GET | `/sms/logs/export` | logs | CSV export |

### SMS Log Statuses

`queued`, `sent`, `delivered`, `failed`, `undelivered`, `rejected`

---

## Email Logs

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/email/logs` | logs | Paginated email logs (filter: status, provider, date, to_email) |
| GET | `/email/logs/:id` | logs | Single log detail |
| GET | `/email/logs/export` | logs | CSV export |

### Email Log Statuses

`queued`, `sent`, `delivered`, `opened`, `clicked`, `bounced`, `complained`, `failed`, `rejected`

---

## Webhooks (Provider Callbacks)

| Method | Path | Purpose |
|---|---|---|
| POST | `/webhooks/sms/:provider` | SMS delivery receipt (Twilio, MSG91, Gupshup) |
| POST | `/webhooks/email/:provider` | Email events (SendGrid, Mailgun, SES, Postmark) |
| POST | `/webhooks/push/:provider` | Push events (Firebase, OneSignal) |

Webhooks are **unauthenticated** but validated via `webhook_secret` in provider config.  
They update `school_communication_recipient`, `school_sms_log`, `school_email_log`, `school_app_notification` status.

---

## Notice Board

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/notices` | view | List notices (filter: published, audience, date) |
| POST | `/notices` | notice | Create notice (draft) |
| GET | `/notices/:id` | view | Notice detail with attachments, read summary |
| PUT | `/notices/:id` | notice | Update notice |
| DELETE | `/notices/:id` | notice | Soft-delete notice |
| POST | `/notices/:id/publish` | notice | Publish notice (sends push to audience) |
| POST | `/notices/:id/unpublish` | notice | Unpublish notice |
| GET | `/notices/:id/attachments` | view | List attachments |
| POST | `/notices/:id/attachments` | notice | Add attachment (upload handled separately) |
| DELETE | `/notices/:id/attachments/:att_id` | notice | Remove attachment |
| POST | `/notices/:id/read` | view | Mark as read (current user) |
| GET | `/notices/:id/read-report` | notice_read | Paginated read receipts |

### Publish Notice Request

```json
{
  "send_push": true,
  "push_title": "New Notice: Exam Schedule",
  "push_body": "Mid-term exam schedule published"
}
```

---

## App Notifications

| Method | Path | Permission | Purpose |
|---|---|---|---|
| POST | `/app-notifications/send` | push | Send push/in-app to single user |
| POST | `/app-notifications/send-bulk` | push | Send push/in-app to filtered audience |
| GET | `/app-notifications` | push | Notification history (filter: user_type, status, date) |
| GET | `/app-notifications/:id` | push | Notification detail |
| POST | `/app-notifications/:id/read` | view | Mark as read (recipient) |
| POST | `/app-notifications/mark-all-read` | view | Mark all as read for current user |

### Send Push Request

```json
{
  "user_type": "parent",
  "user_id": 45,
  "title": "Fee Due",
  "body": "Your ward's fee of ₹5,000 is due on 2026-11-10",
  "data": {"screen": "fees", "invoice_id": 123},
  "channel": "push",
  "priority": "high"
}
```

### Send Push Bulk Request

```json
{
  "audience": {"type": "section", "section_id": 15},
  "title": "Timetable Change",
  "body": "Tomorrow's Math class moved to 10 AM",
  "data": {"screen": "timetable", "date": "2026-11-05"},
  "channel": "both",
  "priority": "normal"
}
```

---

## Reports

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/reports/summary` | reports | Channel-wise volume, delivery %, cost (date range) |
| GET | `/reports/sms` | reports | SMS report (filter: provider, status, date) |
| GET | `/reports/email` | reports | Email report (filter: provider, status, date) |
| GET | `/reports/notice` | reports | Notice read rates by audience |
| GET | `/reports/push` | reports | Push delivery/read rates |
| GET | `/reports/export` | reports | CSV export for any report |

### Summary Report Response

```json
{
  "period": {"from": "2026-10-01", "to": "2026-10-31"},
  "sms": {"sent": 1250, "delivered": 1180, "failed": 70, "cost": 375.50},
  "email": {"sent": 3200, "delivered": 3100, "opened": 1850, "clicked": 420, "bounced": 80, "cost": 0},
  "push": {"sent": 5100, "delivered": 4950, "read": 3800, "clicked": 1200},
  "notice": {"published": 12, "total_recipients": 2450, "read": 1980, "read_rate": 80.8}
}
```

---

## Automations

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/automations` | automation | List automation rules |
| POST | `/automations` | automation | Create automation rule |
| GET | `/automations/:id` | automation | Automation detail |
| PUT | `/automations/:id` | automation | Update automation rule |
| DELETE | `/automations/:id` | automation | Soft-delete automation rule |
| POST | `/automations/:id/test` | automation | Test with sample trigger data |
| POST | `/automations/:id/enable` | automation | Enable rule |
| POST | `/automations/:id/disable` | automation | Disable rule |

### Automation Trigger Events

| Event | Source Module | Payload Example |
|---|---|---|
| `student.admitted` | Admission | `{"student_id": 123, "admission_no": "ADM-2026-001"}` |
| `fee.due_soon` | Fees | `{"student_id": 123, "invoice_id": 456, "due_date": "2026-11-10", "amount": 5000}` |
| `fee.overdue` | Fees | `{"student_id": 123, "invoice_id": 456, "days_overdue": 5, "amount": 5000}` |
| `exam.result_published` | Exam | `{"student_id": 123, "exam_id": 78, "result_url": "..."}` |
| `attendance.absent` | Attendance | `{"student_id": 123, "date": "2026-11-04", "period": "morning"}` |
| `timetable.changed` | Timetable | `{"class_id": 5, "section_id": 2, "date": "2026-11-05", "changes": [...]}` |
| `hostel.leave_approved` | Hostel | `{"student_id": 123, "leave_pass_id": 89, "from_date": "...", "to_date": "..."}` |

### Automation Filter JSON

```json
{
  "class_ids": [5, 6],
  "section_ids": [2],
  "hostel_ids": [1],
  "fee_head_ids": [10, 11],
  "template_variables": {"custom_field": "value"}
}
```

---

## Retention & Audit

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/settings/retention` | view | Current retention policies |
| PUT | `/settings/retention` | manage | Update retention policies |
| GET | `/audit` | audit | Communication audit log (action, entity, user, before, after, timestamp) |

---

## Rate Limiting

- Per-provider limits enforced by `rate_limit_per_min` and `rate_limit_per_day` in provider config.
- Global defaults in `school_communication_setting`.
- Exceeding returns `429 Too Many Requests` with `Retry-After` header.

---

## Error Responses

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid recipient contact",
  "details": [
    {"field": "recipients[1].contact", "message": "Invalid email format"}
  ]
}
```

Common error codes: `VALIDATION_ERROR`, `PROVIDER_ERROR`, `RATE_LIMITED`, `TEMPLATE_NOT_FOUND`, `PROVIDER_NOT_CONFIGURED`, `OPTED_OUT`, `UNAUTHORIZED`, `FORBIDDEN`.