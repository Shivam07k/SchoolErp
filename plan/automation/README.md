# Automation Center Module Plan

## Overview
Rule-based automation engine for fee reminders, attendance alerts, birthday wishes, report scheduling, and custom workflows. Replaces the stub in Communication → Automations with a full module.

## Menu Structure (Intelligence group)
- Rules & Runs → `/school/automation` (already mapped to automation module)
- Message Templates → `/school/automation/templates` (NEW - separate from Communication templates)
- Channel Providers → `/school/automation/providers` (NEW)

## Backend Requirements

### Database Schema (sql/80_automation_core.sql)
New tables:
- `school_automation_rule` - Automation rules (trigger, conditions, actions)
- `school_automation_run` - Execution log of rule runs
- `school_automation_log` - Individual notification/action logs
- `school_message_template` - Automation-specific templates (distinct from communication templates)
- `school_channel_provider` - SMS/Email/Push provider configs (Twilio, SendGrid, Firebase, etc.)
- `school_automation_schedule` - Scheduled rule executions

### API Routes (server/src/routes/school_automation.js)
Mounted at `/api/school/automation`

| Endpoint | Method | Description |
|---|---|---|
| `/rules` | GET/POST | List/create automation rules |
| `/rules/:id` | GET/PUT/DELETE | Manage single rule |
| `/rules/:id/toggle` | POST | Enable/disable rule |
| `/rules/:id/test` | POST | Test run a rule |
| `/runs` | GET | Execution history with filters |
| `/runs/:id` | GET | Single run details |
| `/logs` | GET | Notification/action logs |
| `/templates` | GET/POST | List/create automation templates |
| `/templates/:id` | GET/PUT/DELETE | Manage templates |
| `/providers` | GET/POST | List/create channel providers |
| `/providers/:id` | GET/PUT/DELETE | Manage providers |
| `/providers/:id/test` | POST | Test provider connection |
| `/run` | POST | Manual trigger (fee reminders, absence alerts, etc.) |
| `/schedule` | GET/POST | Scheduled executions |
| `/dashboard` | GET | Summary stats for dashboard |

### Rule Engine Design
**Trigger Types** (event_type):
- `fee.due_soon` - Fee due in N days
- `fee.overdue` - Fee overdue by N days
- `attendance.absent` - Student absent N consecutive days
- `attendance.late` - Student late N times in period
- `student.birthday` - Student birthday
- `student.admission_anniversary` - Admission anniversary
- `exam.result_published` - Results published
- `schedule.daily` - Daily cron
- `schedule.weekly` - Weekly cron
- `manual` - Manual trigger only

**Conditions** (JSON config):
- Class/section filters
- Student status filters
- Fee head filters
- Date ranges
- Custom SQL WHERE fragments (sanitized)

**Actions** (channels array):
- `sms` - Send SMS via provider
- `email` - Send email via provider
- `push` - Send push notification
- `in_app` - Create in-app notification
- `webhook` - Call external webhook

### Channel Providers
Pre-configured providers:
- **SMS**: Twilio, MSG91, TextLocal, Generic HTTP
- **Email**: SendGrid, Mailgun, SMTP, Generic HTTP
- **Push**: Firebase FCM, OneSignal, Generic HTTP
- **Webhook**: Generic HTTP with auth headers

## Frontend Requirements

### Shared Components (src/pages/school/automation/shared.jsx)
- `PageShell`, `Empty`, `Loading`, `Badge`
- `downloadCsv`, `fmtDate`, `fmtDateTime`
- Rule editor form components (trigger selector, condition builder, action selector)
- Provider config forms per type

### Screens

#### 1. Rules & Runs (`Rules.jsx` - main screen at `/school/automation`)
- **Rules Tab** - List with enable/disable, edit, test, delete
  - Columns: Name, Trigger, Channels, Enabled, Last Run, Next Run
  - Create/Edit modal with:
    - Basic info (name, description)
    - Trigger selector (dropdown with dynamic fields)
    - Condition builder (visual or JSON)
    - Actions (multi-select channels + template per channel)
    - Schedule (optional cron expression)
- **Runs Tab** - Execution history
  - Columns: Rule, Triggered At, Status, Actions Executed, Errors
  - Drill-down to see individual notifications sent
- **Dashboard Stats** - Total rules, active, runs today, success rate

#### 2. Message Templates (`Templates.jsx` at `/school/automation/templates`)
- Separate from Communication templates - these are for automation rules
- Variables: `{{student_name}}`, `{{parent_name}}`, `{{amount}}`, `{{due_date}}`, `{{days_overdue}}`, `{{class_name}}`, `{{section_name}}`, `{{school_name}}`, etc.
- Per-channel content (SMS plain text, Email HTML, Push title/body)
- Preview with sample data

#### 3. Channel Providers (`Providers.jsx` at `/school/automation/providers`)
- List configured providers with status (tested/untested)
- Add provider wizard:
  - Select type (SMS/Email/Push/Webhook)
  - Select preset (Twilio, SendGrid, etc.) or Custom
  - Config fields based on preset
  - Test button (sends test message)
- Default provider per channel type

## Permissions
- `automation.view` - View dashboard/rules
- `automation.rules` - Manage rules
- `automation.templates` - Manage templates
- `automation.providers` - Manage providers
- `automation.run` - Manual trigger

## Implementation Order
1. SQL migration (`sql/80_automation_core.sql`)
2. Backend routes (`server/src/routes/school_automation.js`)
3. Register route in `server/src/index.js`
4. Frontend shared + 3 screens
5. Wire in `SchoolPage.jsx` (module `automation`)
6. Update menu: change `built: true` for templates/providers, fix paths
7. Test with browser check