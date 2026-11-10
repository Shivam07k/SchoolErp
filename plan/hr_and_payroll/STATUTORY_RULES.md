# HR and Payroll Module — Statutory Rules Configuration

**Version 1.0** · Based on DESIGN.md · 2 November 2026

---

## Overview

All statutory rules are stored as **versioned settings** in `school_statutory_rule` with effective dates. Each payroll run records the rule versions used. Rules are **configurable, not hardcoded**.

---

## 1. Provident Fund (PF)

### Rule Code: `PF`

### Configuration Schema
```json
{
  "wage_base_components": ["basic", "da", "retaining"],
  "employee_rate": 12.00,
  "employer_rate": 12.00,
  "employer_eps_rate": 8.33,
  "employer_epf_rate": 3.67,
  "wage_ceiling": 15000,
  "admin_charges_rate": 0.50,
  "edli_charges_rate": 0.00,
  "edli_admin_rate": 0.00,
  "voluntary_pf_allowed": true,
  "vpf_rate": 12.00
}
```

### Calculation
1. **Wage Base** = Sum of components marked `is_wage_base=true` in salary structure
2. **Capped Wage** = MIN(Wage Base, wage_ceiling)
3. **Employee PF** = Capped Wage × employee_rate%
4. **Employer PF** = Capped Wage × employer_epf_rate% (to EPF) + Capped Wage × employer_eps_rate% (to EPS, capped at wage_ceiling)
5. **Admin Charges** = Capped Wage × admin_charges_rate%
6. **EDLI** = Capped Wage × edli_charges_rate%

### Versioning
- New version when: rates change, ceiling changes, wage base definition changes
- Effective from: 1st of month (typically)
- Payroll run records: `rule_versions.PF = 3`

### Compliance
- Monthly ECR (Electronic Challan cum Return) by 15th of following month
- Annual return by 25th April
- UAN linking mandatory

---

## 2. Employees' State Insurance (ESI)

### Rule Code: `ESI`

### Configuration Schema
```json
{
  "wage_base_components": ["basic", "da", "retaining", "hra", "conveyance", "other_allowances"],
  "employee_rate": 0.75,
  "employer_rate": 3.25,
  "eligibility_threshold": 21000,
  "contribution_periods": [
    { "period": "Apr-Sep", "due_by": "15-Nov" },
    { "period": "Oct-Mar", "due_by": "15-May" }
  ],
  "exempt_categories": ["apprentice", "casual"]
}
```

### Calculation
1. **Gross Wage** = Sum of components marked for ESI wage base
2. **Eligibility** = Gross Wage ≤ eligibility_threshold
3. If eligible:
   - **Employee ESI** = Gross Wage × employee_rate%
   - **Employer ESI** = Gross Wage × employer_rate%
4. If not eligible: 0

### Versioning
- Threshold changes (Central Govt notification)
- Rate changes (rare)
- Wage base definition changes (Labour Code 2025)

### Compliance
- Half-yearly returns
- ESI card issuance for new employees

---

## 3. Professional Tax (PT)

### Rule Code: `PT`

### Configuration Schema
```json
{
  "state": "MH",
  "slabs": [
    { "min": 0, "max": 7500, "monthly": 0, "annual": 0 },
    { "min": 7501, "max": 10000, "monthly": 175, "annual": 2100 },
    { "min": 10001, "max": 15000, "monthly": 200, "annual": 2400 },
    { "min": 15001, "max": 20000, "monthly": 300, "annual": 3600 },
    { "min": 20001, "max": null, "monthly": 400, "annual": 4800 }
  ],
  "adjustment_month": 3,
  "registration_number": "PT-MH-XXXXX",
  "filing_frequency": "monthly"
}
```

### State Examples

#### Maharashtra (MH)
| Monthly Salary | Monthly PT | Annual PT |
|----------------|------------|-----------|
| ≤ 7,500 | 0 | 0 |
| 7,501 - 10,000 | 175 | 2,100 |
| 10,001 - 15,000 | 200 | 2,400 |
| 15,001 - 20,000 | 300 | 3,600 |
| > 20,000 | 400 | 4,800 |

#### Karnataka (KA)
| Monthly Salary | Monthly PT |
|----------------|------------|
| ≤ 15,000 | 0 |
| 15,001 - 20,000 | 150 |
| 20,001 - 25,000 | 200 |
| 25,001 - 30,000 | 300 |
| > 30,000 | 200 (Feb: 300) |

#### Tamil Nadu (TN)
| Half-yearly Salary | Half-yearly PT |
|--------------------|----------------|
| ≤ 21,000 | 0 |
| 21,001 - 30,000 | 100 |
| 30,001 - 45,000 | 235 |
| 45,001 - 60,000 | 510 |
| 60,001 - 75,000 | 760 |
| > 75,000 | 1,095 |

### Calculation
1. Determine applicable slab based on **gross monthly salary** (or half-yearly for TN)
2. Deduct PT amount from salary
3. In adjustment month (typically March), true-up annual vs deducted

### Versioning
- State slab changes (state budget announcements)
- Adjustment month changes

### Compliance
- Monthly/quarterly payment to state treasury
- Annual return
- Registration certificate display

---

## 4. Tax Deducted at Source (TDS)

### Rule Code: `TDS`

### Configuration Schema
```json
{
  "financial_year": "2026-27",
  "regimes": {
    "old": {
      "slabs": [
        { "min": 0, "max": 250000, "rate": 0 },
        { "min": 250001, "max": 500000, "rate": 5 },
        { "min": 500001, "max": 1000000, "rate": 20 },
        { "min": 1000001, "max": null, "rate": 30 }
      ],
      "rebate_87a": { "max_income": 500000, "amount": 12500 },
      "standard_deduction": 50000,
      "deductions": {
        "80C": 150000,
        "80D": 25000,
        "80CCD1B": 50000,
        "24B": 200000
      }
    },
    "new": {
      "slabs": [
        { "min": 0, "max": 300000, "rate": 0 },
        { "min": 300001, "max": 600000, "rate": 5 },
        { "min": 600001, "max": 900000, "rate": 10 },
        { "min": 900001, "max": 1200000, "rate": 15 },
        { "min": 1200001, "max": 1500000, "rate": 20 },
        { "min": 1500001, "max": null, "rate": 30 }
      ],
      "rebate_87a": { "max_income": 700000, "amount": 25000 },
      "standard_deduction": 75000,
      "deductions": {}
    }
  },
  "surcharge": [
    { "min": 5000000, "max": 10000000, "rate": 10 },
    { "min": 10000001, "max": 20000000, "rate": 15 },
    { "min": 20000001, "max": 50000000, "rate": 25 },
    { "min": 50000001, "max": null, "rate": 37 }
  ],
  "health_cess": 4,
  "tds_on_salary_section": "192",
  "form16_due_date": "15-Jun",
  "quarterly_return_dates": ["31-Jul", "31-Oct", "31-Jan", "31-May"]
}
```

### Calculation (Monthly Projection)
1. **Annual Gross** = (Monthly Gross × 12) + adjustments
2. **Exemptions**: HRA (calc), LTA, etc. (per component `is_taxable=false`)
3. **Deductions**: Based on regime + staff declaration (80C, 80D, etc.)
4. **Taxable Income** = Annual Gross - Exemptions - Standard Deduction - Deductions
5. **Tax** = Apply slabs + surcharge + health cess
6. **Monthly TDS** = Tax / 12 (adjust for prior months)
7. **True-up** in final months based on actuals

### Versioning
- Budget changes (slabs, rates, deductions)
- New regime defaults
- Form 16 format changes

### Compliance
- Monthly deposit by 7th of following month
- Quarterly returns (Form 24Q)
- Form 16 by 15th June
- Form 12BA for perquisites

---

## 5. Gratuity

### Rule Code: `GRATUITY`

### Configuration Schema
```json
{
  "eligibility_years": 5,
  "formula": "15/26 * last_drawn_wage * completed_years",
  "wage_components": ["basic", "da"],
  "max_limit": 2000000,
  "completion_of_year": "240_days",
  "death_disability_exemption": true
}
```

### Calculation
1. **Eligibility** = Completed years ≥ eligibility_years (or death/disability)
2. **Last Drawn Wage** = Basic + DA (last month)
3. **Completed Years** = Floor(total days / 365) or per 240 days rule
4. **Gratuity** = (15/26) × Last Drawn Wage × Completed Years
5. **Capped** at max_limit (₹20 lakhs)

### Accounting
- **Provision**: Monthly expense = Gratuity / remaining service years
- **Payment**: On exit, debit Gratuity Payable, credit Bank
- **Actuarial**: Optional annual valuation for large schools

### Versioning
- Limit changes (Central Govt notification)
- Formula changes (Labour Code)

---

## 6. Bonus

### Rule Code: `BONUS`

### Configuration Schema
```json
{
  "eligibility_months": 30,
  "pay_ceiling": 21000,
  "minimum_bonus": 8.33,
  "maximum_bonus": 20,
  "calculation_base": "basic + da",
  "payment_deadline": "31-Dec",
  "disqualification": ["fraud", "riotous_behaviour", "theft"]
}
```

### Calculation
1. **Eligibility** = Worked ≥ eligibility_months days in year
2. **Wage** = Basic + DA (capped at pay_ceiling)
3. **Bonus %** = Between minimum_bonus% and maximum_bonus% (typically 8.33%)
4. **Bonus Amount** = Wage × Bonus% × (months worked / 12)
5. **Cap**: If wage > pay_ceiling, use pay_ceiling for calculation

### Versioning
- Ceiling changes (Payment of Bonus Act amendment)
- Eligibility changes

### Compliance
- Payment by 31st December
- Register maintenance
- Set-off/set-on provisions

---

## 7. Labour Code 2025 Impact (Effective 21 Nov 2025)

### New Wage Definition
```
Wage = Basic Pay + Dearness Allowance + Retaining Allowance
     + (Any other allowance > 50% of total remuneration)
```

### Excluded from Wage (if ≤ 50% of total):
- HRA
- Conveyance
- Overtime
- Commission
- Bonus
- PF employer contribution
- Gratuity
- Leave encashment

### Affected Calculations
| Statutory | Old Base | New Base (Labour Code) |
|-----------|----------|------------------------|
| PF | Basic + DA | Wage (as defined) |
| ESI | Gross - excluded | Wage (as defined) |
| Gratuity | Basic + DA | Wage (as defined) |
| Bonus | Basic + DA | Wage (as defined) |

### Implementation in System
1. Each `school_salary_component` has `is_wage_base` flag
2. `school_statutory_rule.config.wage_base_components` lists component codes
3. On Labour Code change: update rule version, add new components to wage base
3. Payroll run records rule version used
4. Historical runs unaffected

### Migration for Existing Schools
```sql
-- Update PF rule to new wage base
UPDATE school_statutory_rule 
SET config = jsonb_set(config, '{wage_base_components}', '["basic", "da", "retaining", "hra", "conveyance", "special"]'::jsonb)
WHERE rule_code = 'PF' AND is_active = true;
```

---

## 8. Rule Versioning Workflow

### Creating New Version
1. HR opens Statutory Rules screen
2. Clicks "New Version" on PF/ESI/PT/TDS/Gratuity/Bonus
3. System copies current config, increments version
4. HR edits config, sets effective date
5. Saves → new version created, old version remains for historical runs

### Payroll Run Uses Rule Versions
```json
// On payroll run creation:
{
  "rule_versions": {
    "PF": 3,
    "ESI": 2,
    "PT": 1,
    "TDS": 4,
    "GRATUITY": 1,
    "BONUS": 1
  }
}
```

### Audit Trail
- `school_statutory_rule` has `created_by`, `created_at`, `effective_from`
- `school_payroll_run.rule_versions` locks versions per run
- Report: "Statutory Rule Changes" shows version history with impact

---

## 9. State-Specific Professional Tax

### Multi-State Support
Schools with staff in multiple states need state-specific PT rules.

```json
// school_statutory_rule for PT with state override
{
  "state": "MH",
  "slabs": [...],
  "state_overrides": {
    "KA": { "slabs": [...] },
    "TN": { "slabs": [...], "frequency": "half_yearly" },
    "DL": { "slabs": [...] }
  }
}
```

### Staff State Determination
- `school_staff_statutory.pt_state` = state for PT
- Defaults to school's state
- Override for remote staff

---

## 10. Compliance Calendar (Annual)

| Month | PF | ESI | PT | TDS | Gratuity | Bonus |
|-------|----|-----|-----|-----|----------|-------|
| Apr | Monthly return | - | Monthly | Monthly deposit | - | - |
| May | Monthly return | Half-yearly return (Oct-Mar) | Monthly | Monthly deposit | - | - |
| Jun | Monthly return | - | Monthly | Monthly deposit + **Form 16** | - | - |
| Jul | Monthly return | - | Monthly | Quarterly return (Q1) | - | - |
| Aug | Monthly return | - | Monthly | Monthly deposit | - | - |
| Sep | Monthly return | - | Monthly | Monthly deposit | - | - |
| Oct | Monthly return | - | Monthly | Quarterly return (Q2) | - | - |
| Nov | Monthly return | Half-yearly return (Apr-Sep) | Monthly | Monthly deposit | - | - |
| Dec | Monthly return | - | Monthly | Monthly deposit | - | **Bonus payment** |
| Jan | Monthly return | - | Monthly | Quarterly return (Q3) | - | - |
| Feb | Monthly return | - | Monthly | Monthly deposit | - | - |
| Mar | Monthly return | - | **Annual adjustment** | Quarterly return (Q4) | - | - |

---

## 11. Testing Statutory Calculations

### Test Cases per Rule

#### PF
| Scenario | Gross | Basic | DA | Expected Employee PF | Expected Employer PF |
|----------|-------|-------|----|---------------------|---------------------|
| Below ceiling | 15,000 | 10,000 | 3,000 | 1,800 | 1,800 |
| Above ceiling | 25,000 | 15,000 | 5,000 | 1,800 | 1,800 |
| With HRA (excluded) | 20,000 | 10,000 | 3,000 | 1,560 | 1,560 |

#### ESI
| Scenario | Gross | Eligible | Employee ESI | Employer ESI |
|----------|-------|----------|--------------|--------------|
| Below threshold | 20,000 | Yes | 150 | 650 |
| Above threshold | 22,000 | No | 0 | 0 |

#### PT (Maharashtra)
| Monthly Gross | Monthly PT |
|---------------|------------|
| 7,000 | 0 |
| 8,000 | 175 |
| 12,000 | 200 |
| 18,000 | 300 |
| 25,000 | 400 |

#### TDS (Old Regime)
| Annual Gross | 80C | Taxable | Annual Tax | Monthly TDS |
|--------------|-----|---------|------------|-------------|
| 6,00,000 | 1,50,000 | 4,00,000 | 7,500 | 625 |
| 10,00,000 | 1,50,000 | 8,00,000 | 72,500 | 6,042 |

#### Gratuity
| Last Basic+DA | Years | Gratuity |
|---------------|-------|----------|
| 30,000 | 10 | 1,73,077 |
| 50,000 | 20 | 5,76,923 (capped at 20L) |

#### Bonus
| Monthly Wage | Months Worked | Bonus (8.33%) |
|--------------|---------------|---------------|
| 15,000 | 12 | 14,994 |
| 25,000 (capped 21,000) | 12 | 17,493 |

---

## 12. Integration with Payroll Components

Each `school_salary_component` maps to statutory treatment:

```sql
-- Example components
INSERT INTO school_salary_component (code, name, type, calculation, value, is_taxable, is_wage_base, is_proratable) VALUES
('BASIC', 'Basic Pay', 'earning', 'fixed', 0, true, true, true),
('DA', 'Dearness Allowance', 'earning', 'percent', 0, true, true, true, '{"base_component": "BASIC", "percent": 50}'),
('HRA', 'House Rent Allowance', 'earning', 'percent', 0, false, false, true, '{"base_component": "BASIC", "percent": 40}'),
('CONVEYANCE', 'Conveyance', 'earning', 'fixed', 1600, false, false, true),
('PF_EMP', 'PF Employee', 'deduction', 'formula', 0, false, false, false, '{"formula": "min(wage_base, 15000) * 0.12"}'),
('PF_EMPR', 'PF Employer', 'employer_contribution', 'formula', 0, false, false, false, '{"formula": "min(wage_base, 15000) * 0.12"}'),
('ESI_EMP', 'ESI Employee', 'deduction', 'formula', 0, false, false, false, '{"formula": "case when gross <= 21000 then gross * 0.0075 else 0 end"}'),
('PT', 'Professional Tax', 'deduction', 'formula', 0, false, false, false, '{"formula": "pt_slab(gross)"}'),
('TDS', 'TDS', 'deduction', 'formula', 0, false, false, false, '{"formula": "tds_monthly(annual_taxable)"}');
```

---

## 13. Open Decisions for Implementation

1. **PF wage ceiling**: Current ₹15,000 or proposed ₹21,000?
2. **ESI threshold**: ₹21,000 or state-specific?
3. **PT state**: School's state + any remote staff states?
4. **TDS default regime**: Old or New?
5. **Gratuity max limit**: ₹20L or higher?
6. **Bonus applicability**: Based on headcount (>20) or voluntary?
7. **Labour Code adoption**: Immediate or phased?
8. **Arrears calculation**: How to handle mid-year rule changes?

---

## 14. References

- EPF Scheme, 1952 (as amended 2025)
- ESI Act, 1948 (as amended 2025)
- State Professional Tax Acts
- Income Tax Act, 1961 (Finance Act 2026)
- Payment of Gratuity Act, 1972 (amended 2025)
- Payment of Bonus Act, 1965 (amended 2025)
- Code on Wages, 2019 (effective 21 Nov 2025)
- Code on Social Security, 2020 (effective 21 Nov 2025)
- Central/State Government notifications 2025-2026