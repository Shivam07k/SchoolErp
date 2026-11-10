import React, { useEffect, useState } from 'react';
import { apiGet } from '../../../api';
import { PageShell, Badge, canManageHR, canViewHR } from './shared';

const REPORT_GROUPS = [
  {
    label: 'Staff & Organization',
    reports: [
      { key: 'staff-strength', label: 'Staff Strength', desc: 'Headcount by department/designation', icon: 'bi-people' },
      { key: 'attrition', label: 'Attrition Analysis', desc: 'Monthly exits by reason', icon: 'bi-graph-down' },
      { key: 'doc-expiry', label: 'Document Expiry', desc: 'Expiring contracts, visas, certifications', icon: 'bi-file-earmark-excel' },
    ],
  },
  {
    label: 'Leave & Attendance',
    reports: [
      { key: 'leave-balances', label: 'Leave Balances', desc: 'Current balances with accrual/usage breakdown', icon: 'bi-calendar-check' },
      { key: 'leave-taken', label: 'Leave Taken', desc: 'Approved leave records with filters', icon: 'bi-calendar-event' },
      { key: 'absence-patterns', label: 'Absence Patterns', desc: 'Staff with frequent absences/lates', icon: 'bi-exclamation-triangle' },
    ],
  },
  {
    label: 'Payroll & Salary',
    reports: [
      { key: 'salary-register', label: 'Salary Register', desc: 'Run-wise detailed payslip register', icon: 'bi-journal-text' },
      { key: 'salary-abstract', label: 'Salary Abstract', desc: 'Run summary with component totals', icon: 'bi-file-earmark-text' },
      { key: 'dept-cost', label: 'Department Cost', desc: 'Gross/net by department across runs', icon: 'bi-building' },
      { key: 'month-variance', label: 'Month Variance', desc: 'Current vs previous month comparison', icon: 'bi-graph-up' },
      { key: 'arrears', label: 'Arrears & Adjustments', desc: 'Pending and applied adjustments', icon: 'bi-currency-exchange' },
      { key: 'overtime', label: 'Overtime / Extra Periods', desc: 'Variable earnings from payroll runs', icon: 'bi-clock' },
    ],
  },
  {
    label: 'Advances & Loans',
    reports: [
      { key: 'advances-outstanding', label: 'Advances Outstanding', desc: 'Active advances with balances', icon: 'bi-cash-stack' },
      { key: 'advances-aging', label: 'Advances Aging', desc: 'Outstanding by aging buckets', icon: 'bi-hourglass' },
    ],
  },
  {
    label: 'Statutory & Compliance',
    reports: [
      { key: 'statutory-registers', label: 'PF/ESI/PT/TDS Registers', desc: 'Statutory deduction registers per period', icon: 'bi-shield-lock' },
      { key: 'form16', label: 'Form 16', desc: 'Annual TDS certificates', icon: 'bi-file-earmark-text' },
      { key: 'gratuity-liability', label: 'Gratuity Liability', desc: 'Eligibility and provision', icon: 'bi-currency-rupee' },
    ],
  },
  {
    label: 'Audit & Governance',
    reports: [
      { key: 'salary-audit', label: 'Salary Change Audit', desc: 'Audit trail for salary changes', icon: 'bi-journal-text' },
      { key: 'unlock-audit', label: 'Payroll Unlock Audit', desc: 'Payroll run unlock history', icon: 'bi-lock' },
      { key: 'substitution-impact', label: 'Substitution Impact', desc: 'Teacher substitution workload', icon: 'bi-person-lines-fill' },
    ],
  },
];

export default function ReportsDashboard({ me, onNavigate }) {
  const [permissions, setPermissions] = useState({});
  const viewer = canViewHR(me, 'hr.reports');
  const manager = canManageHR(me, 'hr.reports');

  useEffect(() => {
    const perms = me?.permissions || [];
    const has = (p) => perms.includes('*') || perms.includes(p) || perms.includes('hr.reports') || perms.includes('hr.audit') || perms.includes('hr.statutory_reports') || perms.includes('hr.form16');
    setPermissions({
      reports: has('hr.reports'),
      audit: has('hr.audit'),
      statutory: has('hr.statutory_reports'),
      form16: has('hr.form16'),
    });
  }, [me]);

  const canView = (key) => {
    if (['salary-audit', 'unlock-audit'].includes(key)) return permissions.audit;
    if (['statutory-registers', 'form16'].includes(key)) return permissions.statutory;
    if (key === 'form16') return permissions.form16;
    return permissions.reports;
  };

  return (
    <PageShell title="HR Reports" icon="bi-graph-up" subtitle="All HR and payroll reports with filters and CSV export" onNavigate={onNavigate}>
      <div className="row g-3">
        {REPORT_GROUPS.map(group => (
          <div key={group.label} className="col-12 col-md-6 col-lg-4">
            <div className="card h-100">
              <div className="card-header"><h6 className="mb-0">{group.label}</h6></div>
              <div className="card-body">
                <div className="d-flex flex-column gap-2">
                  {group.reports.filter(r => canView(r.key)).map(r => (
                    <button key={r.key} className="btn btn-outline-secondary text-start p-3" onClick={() => onNavigate(`/school/hr/reports/${r.key}`)}>
                      <div className="d-flex align-items-center gap-3">
                        <i className={`bi ${r.icon} fs-4 text-primary`}></i>
                        <div>
                          <div className="fw-bold">{r.label}</div>
                          <div className="text-muted small">{r.desc}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card mt-3">
        <div className="card-header"><h6 className="mb-0">Quick Access</h6></div>
        <div className="card-body">
          <div className="d-flex flex-wrap gap-2">
            <button className="btn btn-sm btn-outline-primary" onClick={() => onNavigate('/school/hr/payroll/runs')}>Payroll Runs</button>
            <button className="btn btn-sm btn-outline-primary" onClick={() => onNavigate('/school/hr/payroll/register')}>Salary Register</button>
            <button className="btn btn-sm btn-outline-primary" onClick={() => onNavigate('/school/hr/payroll/bank-advice')}>Bank Advice</button>
            <button className="btn btn-sm btn-outline-primary" onClick={() => onNavigate('/school/hr/payroll/statutory-reports')}>Statutory Reports</button>
            <button className="btn btn-sm btn-outline-primary" onClick={() => onNavigate('/school/hr/advances/dashboard')}>Advances Dashboard</button>
            <button className="btn btn-sm btn-outline-primary" onClick={() => onNavigate('/school/hr/reports/salary-register')}>Leave Reports</button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
