# Canteen Module – Test Scenarios

**Version 1.0** · 4 November 2026

## B11 Scenario Coverage

### B11.1 Menu and orders
| Scenario | How it is handled | Expected |
|---|---|---|
| New item | Add with price/category | Item created |
| Price change | New price effective date | History kept |
| Item sold out today | Day override unavailable | Item hidden |
| Weekly rotation | Weekly pattern by weekday | Menu correct |
| Special menu event | Day override | Override applied |
| Closed holiday | Calendar closes canteen | No sales |
| Combo meal | Combo price | Correct total |
| Staff only items | Customer type flag | Filtered view |
| Healthy only policy | School blocked categories | Blocked |
| Counter order | Scan ID pick items | Bill created |
| Parent pre-order | Held in wallet | Kitchen list shows |
| Cancel before cutoff | Wallet released | Refund processed |
| Uncollected order | Refund/charge by policy | Wallet adjusted |
| Bulk order class | Bulk order approved | Billed |
| Subscription | Daily orders auto | Orders generated |
| Guest purchase | Guest cash/UPI | Bill created |
| Student without ID | Search name/roll | Order created |

### B11.2 Billing and wallets
| Scenario | How it is handled | Expected |
|---|---|---|
| Top-up parent | Online/cash | Balance increased |
| Low balance | Pay rest cash/UPI or block | Payment accepted/blocked |
| Daily limit | Block/warn | Enforced |
| Blocked item | Sale blocked | Alert sent |
| Allergy flag | Warn/block | Enforced |
| Wrong item billed | Reversal before closing | Bill corrected |
| Refund leaving | Clearance refund | Balance returned |
| Staff monthly account | Recovered salary | Ledger entry |
| Lost ID card | Wallet moved | Balance preserved |
| Cash difference | Recorded | Closing shows difference |
| Discount scholarship | Concession type | Price reduced |
| Rush break | Fast counter mode | <5 sec bill |

### B11.3 Inventory, compliance
| Scenario | How it is handled | Expected |
|---|---|---|
| Purchase supplier | Purchase entry | Stock increased |
| Stock reduces sales | By recipe/item | Stock updated |
| Wastage spoilage | Wastage entry | Stock reduced |
| Count differs | Adjustment approval | Stock corrected |
| Low stock | Alert | Manager notified |
| Return supplier | Return movement credit | Stock adjusted |
| Expired packed item | Written off | Loss recorded |
| FSSAI expiring | Alerts | Warn/block |
| Food handler medical lapsed | Warning | Staff flagged |
| Inspection authority | Compliance report | Report generated |
| Profit month | Income vs cost | Profit calculated |
| Audit changes | Audit log | Trail kept |

## Rule Matrix
- Hard rules always blocked
- Soft rules warn only
- Permissions enforced
- Audit trail for sensitive actions
