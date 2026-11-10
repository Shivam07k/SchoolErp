# Library Module – Test Scenarios

**Version 1.0** · 4 November 2026

## Scenario Coverage

### A11.1 Books
| Scenario | How it is handled | Expected |
|---|---|---|
| New book purchased | Purchase entry creates title and copies with accession numbers | Title + copies created, accession unique |
| Same title, many copies | One title, many copies | Multiple copies linked to title |
| New edition | New title linked as edition | Separate title record |
| Book without ISBN | Manual entry; internal code | Title saved |
| Reference not issuable | Category flag blocks issue | Issue blocked |
| Barcode damaged | Reprint label | New barcode generated |
| Book donated | Entry with source donation nil cost | Copy created cost 0 |
| Book withdrawn | Withdraw with reason; history kept | Status withdrawn |
| Bulk upload | Excel import with row-wise errors | Valid rows saved, errors reported |
| Digital books | Later | Not implemented |

### A11.2 Issue and return
| Scenario | How it is handled | Expected |
|---|---|---|
| Normal issue | Scan member and copy | Loan created, copy issued |
| Renewal | Allowed if not reserved | Due date extended |
| Return after holiday | Due dates skip holidays | Fine correct |
| Return by friend | Allowed; loan closes against member | Status returned |
| Member at limit | Blocked | Error message |
| Overdue book | Warn/block by policy | Warning shown |
| Copy returned damaged | Condition recorded, damage charge | Fine created |
| Book lost | Lost charge, copy withdrawn | Copy withdrawn, charge posted |
| Book found after lost | Charge reversed by approval | Fine reversed |
| Issue to class set | Bulk loan to teacher | Multiple loans |
| Student leaves | Clearance blocks TC | TC blocked |
| Vacation issue | Longer loan days | Due date extended |

### A11.3 Members
| Scenario | How it is handled | Expected |
|---|---|---|
| New student admitted | Member created automatically | Member with category |
| Class promotion | Category rules follow class | Rules updated |
| Lost ID card | Reissue card; old blocked | New card active |
| Staff member | Staff category longer limits | Correct limits |
| Staff resigns | Pending loans listed | Clearance alert |
| Suspended member | Status blocks issue | Issue blocked |
| Alumni/guest | Later | Not implemented |

### A11.4 Fines
| Scenario | How it is handled | Expected |
|---|---|---|
| Late fine | Calculated per day with grace/cap | Fine amount correct |
| Fine on holiday | Skipped by setting | Days not counted |
| Fine waived | Reason and approver recorded | Waiver audited |
| Part payment | Payment records balance carried | Balance updated |
| Fine posted to fees | Charged in student ledger | Invoice created |
| Lost book charge | Price plus fee or replacement | Charge correct |
| Fine above cap | Capped | Amount capped |
| Hardship waiver | Waiver with approval | Approved |

### A11.5 Stock and reports
| Scenario | How it is handled | Expected |
|---|---|---|
| Yearly verification | Scan racks, list missing/extra | Report generated |
| Copy missing | Marked missing, later lost/found | Status updated |
| Never issued | Report guides purchases | List shown |
| Audit changes | Audit log | Changes tracked |
| Demand for title | Reservation count report | Report shows queue |

## Rule Matrix
- Hard rules always blocked
- Soft rules warn only
- Permissions enforced per action
- Audit log for all state changes
