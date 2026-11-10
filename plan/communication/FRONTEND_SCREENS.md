# Communication — Frontend Screens

**Stack:** React + Bootstrap 5, using `PageShell`, `Loading`, `Empty`, `Badge`,
`downloadCsv`, `fmtDate`, `money`, `maskPhone`, `maskEmail` from
`src/pages/school/fee/shared.jsx` and the `apiGet/apiPost/apiPut/apiDelete`
helpers.

All screens live in `src/pages/school/communication/` and are dispatched from
`src/components/SchoolPage.jsx` when `module === 'communication'`.

---

## Routes

| Route | Component | Menu label |
|---|---|---|
| `/school/communication/dashboard` | `Dashboard.jsx` | Communication Dashboard |
| `/school/communication/sms` | `SendSms.jsx` | Send SMS |
| `/school/communication/email` | `SendEmail.jsx` | Send Email |
| `/school/communication/notice-board` | `NoticeBoard.jsx` | Notice Board |
| `/school/communication/app-notifications` | `AppNotifications.jsx` | App Notifications |
| `/school/communication/templates` | `Templates.jsx` | Templates |
| `/school/communication/logs` | `Logs.jsx` | Message Logs |
| `/school/communication/reports` | `Reports.jsx` | Reports |
| `/school/communication/providers` | `Providers.jsx` | Providers |
| `/school/communication/settings` | `Settings.jsx` | Settings |
| `/school/communication/automations` | `Automations.jsx` | Automations |

`src/pages/school/communication/shared.jsx` exports shared helpers:
`canCommView`, `canCommSend`, `canCommManage`, `canCommNotice`, `canCommPush`,
`canCommLogs`, `canCommReports`, `canCommAutomation`, `canCommAudit`,
`CHANNEL_BADGE`, `STATUS_BADGE`, `PRIORITY_BADGE`, `AUDIENCE_LABEL`,
`formatRecipient`, `variablePicker`, `richTextEditor`, `attachmentUploader`.

---

## 1. Communication Dashboard (`Dashboard.jsx`)

KPI strip (cards):
- SMS: sent today, delivered %, failed, cost
- Email: sent today, delivered %, opened %, bounced %
- Push: sent today, delivered %, read %
- Notices: published this month, total recipients, read rate
- Opt-outs: SMS, email, push counts

Charts (Recharts or Chart.js):
- 7-day volume trend per channel
- Delivery rate trend per channel
- Top 5 templates by usage
- Recent messages table (last 10, status badges, quick view)

Quick actions:
- Send SMS button → `/sms`
- Send Email button → `/email`
- Create Notice button → `/notice-board` (modal)
- Send Push button → `/app-notifications` (modal)

Permission: `communication.view`

---

## 2. Send SMS (`SendSms.jsx`)

Tabs: **Compose**, **Scheduled**, **History**

### Compose Tab

- Template selector (dropdown, filtered to `channel=sms`, shows preview)
- Variable editor: auto-detects `{{vars}}` from template, shows input fields
- Recipient selector:
  - Radio: `Filtered Audience` / `Custom List`
  - Filtered: audience type (class, section, all students, all parents, all staff, hostel, fee defaulters), cascading dropdowns
  - Custom: textarea for phone numbers (one per line) or CSV upload
  - Shows estimated recipient count
- Schedule: `Send Now` / `Schedule for later` (datetime picker)
- Provider override (optional): dropdown of active SMS providers
- Preview pane: renders template with first recipient's variables
- Buttons: `Save as Draft`, `Send` / `Schedule`

### Scheduled Tab

- Table: message_id, template, recipient_count, scheduled_at, status, actions (view, cancel, edit if not sent)
- Bulk cancel

### History Tab

- Same as Logs SMS tab but filtered to current user's sends
- Search by message_id, template, date range, status
- Export CSV

Permission: `communication.send`

---

## 3. Send Email (`SendEmail.jsx`)

Tabs: **Compose**, **Scheduled**, **History**

### Compose Tab

- Template selector (filtered to `channel=email`)
- Variable editor (same as SMS)
- Recipient selector (same as SMS, but collects emails)
- Attachments: drag-drop zone, multiple files, shows file name/size, remove button
- Schedule: `Send Now` / `Schedule for later`
- Provider override (optional)
- Preview pane: shows subject, HTML body (iframe), text body
- Buttons: `Save as Draft`, `Send` / `Schedule`

### Scheduled & History Tabs

- Same structure as SMS

Permission: `communication.send`

---

## 4. Notice Board (`NoticeBoard.jsx`)

Tabs: **Published**, **Drafts**, **Archived**, **Read Reports**

### Published Tab

- List: title, priority badge, audience badge, publish_at, expire_at, pinned badge, read count / total, actions
- Toolbar: search, filter by audience/priority, date range
- `Create Notice` button → modal

### Drafts Tab

- Same list, shows draft notices
- Actions: edit, delete, publish

### Archived Tab

- Soft-deleted notices, restore/delete permanently

### Read Reports Tab

- Select a notice → shows read report table: user_type, user_name, read_at, unread count
- Export CSV

### Create/Edit Notice Modal

- Title (required)
- Rich text editor (body_html): toolbar for bold, italic, lists, links, images, tables
- Priority: low/normal/high/urgent (badge preview)
- Audience: radio group (all, students, parents, staff, class, section, custom)
  - Class/section: cascading dropdowns
  - Custom: multi-select students/parents/staff with search
- Schedule: publish_at (default now), expire_at (optional)
- Pin toggle
- Attachments: upload multiple files (PDF, images, docx), shows list with remove
- Push notification opt-in: checkbox `Send push notification`, with push title/body fields
- Buttons: `Save Draft`, `Publish` (if draft), `Update` (if published), `Cancel`

Permission: `communication.view`; writes require `communication.notice`

---

## 5. App Notifications (`AppNotifications.jsx`)

Tabs: **Send**, **History**, **In-App Centre** (for logged-in user)

### Send Tab

- Template selector (filtered to `channel=push`)
- Variable editor
- Recipient selector (same as SMS/email but for push tokens)
- Channel: `push` / `in_app` / `both`
- Priority: low/normal/high/urgent
- Data payload: JSON editor (key-value) for deep linking
- Schedule: `Send Now` / `Schedule`
- Preview: shows how it looks on mobile
- Buttons: `Send` / `Schedule`

### History Tab

- Table: notification_id, title, user_type, user_count, channel, status, sent_at, read_rate
- Drill down: click → recipient list with status (sent/delivered/read/clicked/failed)
- Export CSV

### In-App Centre Tab

- Current user's notifications (all types)
- Tabs: `Unread`, `All`
- List: title, body, time, read badge, click action (navigate via `data_json.screen`)
- Mark all read button
- Infinite scroll

Permission: `communication.view`; send requires `communication.push`

---

## 6. Templates (`Templates.jsx`)

Tabs: **SMS**, **Email**, **Push**, **Notice**, **All**

- Table: code, name, channel, language, variables count, active badge, updated_at, actions
- Toolbar: search by code/name, filter channel/language/active
- `Create Template` button → drawer/modal

### Create/Edit Template Drawer

- Code (unique, slug format: `fee_due_reminder`)
- Name
- Channel: sms/email/push/notice
- Language
- Subject (required for email/push/notice)
- Body: text area for SMS/push, rich text editor for email/notice
- Variables panel: auto-extracted from subject/body, editable list (name, type, description, required)
- `Preview` button → modal with sample data inputs
- Buttons: `Save`, `Save & Create Another`, `Cancel`

Permission: `communication.view`; writes require `communication.manage`

---

## 7. Message Logs (`Logs.jsx`)

Tabs: **SMS**, **Email**, **Push**, **All Messages**

### SMS Tab

- Table: message_id, template, to_number (masked), status, provider, segments, cost, sent_at, delivered_at
- Filters: date range, status, provider, template, search by phone (masked)
- Row click → detail drawer: full body, recipient list, webhook payload
- Export CSV

### Email Tab

- Table: message_id, template, to_email (masked), subject, status, provider, sent_at, delivered_at, opened_at, clicked_at
- Filters: same + bounce/complaint
- Row click → detail: headers, body preview, webhook events timeline

### Push Tab

- Table: notification_id, title, user_type, user_id, channel, status, sent_at, delivered_at, read_at
- Filters: user_type, status, channel
- Row click → detail: data payload, device info

### All Messages Tab

- Unified view of `school_communication_message` with channel badge
- Links to respective log tabs

Permission: `communication.logs`

---

## 8. Reports (`Reports.jsx`)

Report cards with date range picker (presets: today, 7d, 30d, this month, last month, custom) and CSV export:

### Summary Card

- Channel-wise volume, delivery rate, cost
- Bar chart: volume by day
- Line chart: delivery rate by day

### SMS Report

- Table: date, sent, delivered, failed, cost, delivery_rate
- Drill down by provider

### Email Report

- Table: date, sent, delivered, opened, clicked, bounced, complained, open_rate, click_rate
- Drill down by provider

### Notice Report

- Table: notice_id, title, audience, published_at, total_recipients, read_count, read_rate
- Drill down → read report

### Push Report

- Table: date, sent, delivered, read, clicked, delivery_rate, read_rate
- Drill down by provider

### Template Usage Report

- Table: template_code, template_name, channel, times_used, last_used
- Identifies unused templates

Permission: `communication.reports`

---

## 9. Providers (`Providers.jsx`)

Tabs: **SMS**, **Email**, **Push**

Each tab:

- Table: code, name, type, channel, priority, active badge, default badge, rate limits
- `Add Provider` button → modal

### Add/Edit Provider Modal

- Code, Name
- Type: dropdown (Twilio, MSG91, Gupshup, SendGrid, Mailgun, SES, Postmark, Firebase, OneSignal, Expo, Custom)
- Channel: auto-set by type, editable for custom
- Config: JSON editor with schema validation per type (see API_ENDPOINTS.md)
- Priority (number, lower = higher priority)
- Active toggle
- Default toggle (only one default per channel)
- Rate limits per min/day
- Webhook URL display (auto-generated: `/api/school/communication/webhooks/sms/:code`)
- `Test` button → sends test message to configured test recipient
- Buttons: `Save`, `Cancel`

Permission: `communication.view`; writes require `communication.manage`

---

## 10. Settings (`Settings.jsx`)

Sections (accordion or tabs):

### General

- Default SMS sender ID
- Default email from address/name
- Default push topic/segment

### Rate Limits

- SMS per minute / per day (global)
- Email per minute / per day
- Push per minute / per day

### Retry Policy

- Max retry attempts
- Retry delay (minutes)

### Opt-out

- SMS opt-out keyword
- Opt-out confirmation message template

### Retention

- SMS log retention days
- Email log retention days
- Push log retention days
- Notice read retention days

Each setting: label, description, input (number, text, select), current value, `Save` button per section or global `Save All`.

Permission: `communication.view`; writes require `communication.manage`

---

## 11. Automations (`Automations.jsx`)

Tabs: **Active**, **Inactive**, **All**

- Table: code, name, trigger_event, template, channel, filter summary, last_run_at, last_run_count, last_run_status, active badge
- `Create Automation` button → drawer

### Create/Edit Automation Drawer

- Code, Name
- Trigger event: dropdown (see API_ENDPOINTS.md for list)
- Template: dropdown (filtered to matching channel)
- Channel: auto from template
- Filter JSON: code editor with schema hints (class_ids, section_ids, etc.)
- Active toggle
- `Test` button → modal with sample payload, shows rendered message
- Buttons: `Save`, `Cancel`

### Automation Log (click row)

- Side panel: recent runs with timestamp, recipient_count, status, error

Permission: `communication.view`; writes require `communication.automation`

---

## Shared Components

### `variablePicker` (in shared.jsx)

- Scans template subject/body for `{{var}}` patterns
- Renders form fields per variable with type-appropriate input (text, number, date, currency, select)
- Provides `getValues()` for submit

### `richTextEditor`

- Wrapper around `react-quill` or `TipTap` with toolbar: bold, italic, underline, strikethrough, lists, link, image, table, code block, undo/redo
- Sanitizes HTML on submit (DOMPurify)

### `attachmentUploader`

- Drag-drop + click to select
- Multiple files, max size from settings
- Progress bars, remove button
- Returns array of `{file_name, file_url, file_size, mime_type}`

### `formatRecipient`

- Input: `{type, id, contact}`
- Output: masked display string
  - SMS: `+91 98*** 4321`
  - Email: `pa***@example.com`
  - Push: `Parent of Aarav Sharma (ID: 45)`

### `CHANNEL_BADGE`, `STATUS_BADGE`, `PRIORITY_BADGE`, `AUDIENCE_LABEL`

- Consistent badge colors across all screens

---

## Permission Guards

```jsx
// In each screen or route guard
import { usePermissions } from '@/hooks/usePermissions';

const { can } = usePermissions();
if (!can('communication.send')) return <AccessDenied />;
```

Permission hooks check `req.user.permissions` from JWT or context.