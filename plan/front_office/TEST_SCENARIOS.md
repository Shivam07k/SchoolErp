# Front Office Module – Test Scenarios

**Version 1.0** · 4 November 2026

## C11 Scenario Coverage

### C11.1 Enquiry
| Scenario | How it is handled | Expected |
|---|---|---|
| Walk-in enquiry | Quick form phone search | Contact created/enquiry |
| Enquiry by phone | Call log creates enquiry | One click |
| Website campaign | Import/form feed | Source recorded |
| Same parent enquires | Existing contact shown | Child added |
| Sibling existing | Linked to student | Sibling flagged |
| School visit request | Visit scheduled appointment | Appointment created |
| No seat class | Waiting list note | Follow-up date set |
| Parent no response | Reminders then lost | Stage Lost |
| Enquiry converts | Admission pre-filled | Data carried |
| Referral | Source with referrer | Tracked |

### C11.2 Visitors
| Scenario | How it is handled | Expected |
|---|---|---|
| Walk-in visitor | Check-in pass host alert | Pass printed |
| Pre-approved visitor | Faster check-in | Approved |
| Vendor delivery | Purpose recorded items | Logged |
| Group visit | Head count | Visit logged |
| Forget checkout | Day-end list closed | Alert |
| Student leaves early | Gate pass authorised | Released |
| Unauthorised pickup | Blocked parent approval | Blocked |
| Blacklisted person | Blocked alert head | Denied |
| Parent-teacher meeting | Special hours slots | Managed |
| Face recognition | Later | Not implemented |

### C11.3 Complaints
| Scenario | How it is handled | Expected |
|---|---|---|
| Complaint by channel | Logged | Ticket created |
| Wrong department | Reassign | Owner updated |
| Overdue | Escalate to head | Escalation |
| Staff complaint | Confidential flag | Visible principal only |
| Safety/bullying | High priority alert | Immediate alert |
| Fee/transport | Routed to module | Owner set |
| Unhappy resolution | Reopened | Reopened |
| Repeat complaint | Warning earlier ticket | Linked |
| Anonymous suggestion | Suggestion category | Logged |
| Pattern | Category reports | Report generated |

### C11.4 Calls and Appointments
| Scenario | How it is handled | Expected |
|---|---|---|
| Incoming known | History shown | Context visible |
| Missed call | Logged callback due | Task created |
| Call becomes enquiry/complaint | One click carry | Linked |
| Outgoing follow-up | Logged against enquiry | History |
| Appointment principal | Free slots availability | No clash |
| Host on leave | Slots blocked | Notified |
| Cancel/no-show | Recorded | Status updated |
| Reschedule | New slot old freed | Updated |
| Online meeting | Link in confirmation | Sent |
| Telephony integration | Later | Not implemented |

## Rule Matrix
- Hard rules always blocked
- Soft rules warn only
- Permissions enforced
- Audit log for sensitive actions
