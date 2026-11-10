# Leave, Corrections, and Notifications

## Student leave workflow

1. A parent/guardian or authorized office user submits a leave request for a student and date range, with leave type, reason, and optional protected evidence.
2. The request starts Pending. The policy determines how a pending request is displayed and calculated; it must not be silently treated as approved.
3. An authorized teacher/administrator approves or rejects with actor and timestamp. Rejection requires a reason.
4. Approved future leave appears as a visible pre-mark on applicable registers. It does not mark the student physically present.
5. If approval covers dates with submitted/finalized attendance, create a correction request for the affected entries. Do not rewrite the history in place.
6. Where a certificate is required, store it using the existing protected-file pattern and enforce role-based access and retention.

The first release may support parent submission only if a secure parent-to-student relationship and portal authorization are verified. Otherwise provide authorized office entry and add the parent portal after its identity/linkage controls are ready.

## Correction workflow

Correction reasons include wrong status, late arrival, early departure, missed attendance, verified leave, and wrong roster/session. Every request records:

- target register entry and the original accepted value;
- requested new value, reason, requester, and request time;
- optional protected evidence reference;
- approval state, reviewer, decision time, and rejection reason;
- the resulting effective value and audit event after approval.

Rules:

- No direct status edit on submitted/finalized registers. Draft entries may be edited only under marking permission.
- A requester cannot approve their own correction when separation of duties is required by policy.
- Bulk corrections are explicit, previewed, permission-checked, and individually attributable; they are not an unrestricted overwrite endpoint.
- A correction after a reporting/export cutoff is flagged and requires elevated permission; regenerate or version affected reports rather than hiding the change.
- Reports and student history show the latest approved effective value while preserving original and correction history.
- Notifications about a changed absence are sent only after the correction commits; channel, recipient, consent, and privacy rules are configurable.

## Notifications

Use the shared Communication module rather than sending SMS/email synchronously from attendance writes.

| Event | Candidate recipient | Guard |
|---|---|---|
| Student absence/late/partial day | Linked parent/guardian | Only after submitted attendance; school policy and channel consent apply. |
| Leave approved/rejected | Applicant/linked guardian and responsible school role | Send after decision; rejection includes the authorized reason. |
| Register not submitted | Assigned teacher/coordinator | Reminder schedule and cutoff are configurable and deduplicated. |
| Attendance threshold reached | Guardian and authorized staff | Threshold is configurable; message should encourage support, not label a student. |
| Approved correction changes an absence | Guardian and attendance administrator | Send after commit; suppress duplicate retry delivery. |
| Notification delivery failure | Communication/attendance administrator | Log attempt, next retry, final status, and provider error safely. |

Store notification event idempotency keys, recipient/channel, template/version, attempt history, and delivery outcome. Do not expose internal remarks, medical documents, or sensitive reason details in parent messages.

## Acceptance criteria

- Pending, approved, and rejected leave each have explicit outcomes; no pending request is mistaken for an approval.
- Future leave is visible in the correct roster; past leave changes attendance only through an approved, audited correction.
- Rejected requests and corrections retain the reason and decision history.
- An approved correction preserves original and new values and updates every relevant summary consistently.
- Parent notification creation is transactional with an outbox event; provider failure cannot fail marking or duplicate a notice on retry.
- Sensitive attachments and medical details are visible only to authorized roles and are not included in generic attendance exports/messages.
