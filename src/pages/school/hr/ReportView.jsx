import React, { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Loading, ErrorBox, Badge, canViewHR, fmtDate, downloadCsv } from './shared';

const money = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

const REPORT_DEFS = {
  'staff-strength': {
    title: 'Staff Strength', icon: 'bi-people',
    endpoint: () => '/school/hr/reports/staff-strength',
    filters: [],
    columns: [
      { key: 'department', label: 'Department' },
      { key: 'designation', label: 'Designation' },
      { key: 'type', label: 'Type' },
      { key: 'staff_count', label: 'Count' },
    ],
  },
  attrition: {
    title: 'Attrition Analysis', icon: 'bi-graph-down',
    endpoint: () => '/school/hr/reports/attrition',
    filters: [],
    columns: [
      { key: 'month', label: 'Month', format: fmtDate },
      { key: 'exits', label: 'Exits' },
      { key: 'resignations', label: 'Resignations' },
      { key: 'terminations', label: 'Terminations' },
      { key: 'retirements', label: 'Retirements' },
    ],
  },
  'doc-expiry': {
    title: 'Document Expiry', icon: 'bi-file-earmark-excel',
    endpoint: () => '/school/hr/reports/doc-expiry',
    filters: ['days'],
    columns: [
      { key: 'name', label: 'Staff' },
      { key: 'employee_code', label: 'Code' },
      { key: 'department', label: 'Department' },
      { key: 'type', label: 'Document' },
      { key: 'expiry_date', label: 'Expiry', format: fmtDate },
      { key: 'days_until_expiry', label: 'Days Left' },
    ],
  },
  'leave-balances': {
    title: 'Leave Balances', icon: 'bi-calendar-check',
    endpoint: () => '/school/hr/reports/leave-balances',
    filters: ['staff', 'leaveType'],
    columns: [
      { key: 'staff_name', label: 'Staff' },
      { key: 'employee_code', label: 'Code' },
      { key: 'type_name', label: 'Leave Type' },
      { key: 'opening', label: 'Opening' },
      { key: 'accrued', label: 'Accrued' },
      { key: 'used', label: 'Used' },
      { key: 'adjusted', label: 'Adjusted' },
      { key: 'carried_forward', label: 'Carried Fwd' },
      { key: 'balance', label: 'Balance', money: true },
    ],
  },
  'leave-taken': {
    title: 'Leave Taken', icon: 'bi-calendar-event',
    endpoint: () => '/school/hr/reports/leave-taken',
    filters: ['from', 'to', 'staff', 'leaveType'],
    columns: [
      { key: 'staff_name', label: 'Staff' },
      { key: 'employee_code', label: 'Code' },
      { key: 'department', label: 'Department' },
      { key: 'leave_type', label: 'Leave Type' },
      { key: 'from_date', label: 'From', format: fmtDate },
      { key: 'to_date', label: 'To', format: fmtDate },
      { key: 'days', label: 'Days' },
      { key: 'status', label: 'Status' },
    ],
  },
  'absence-patterns': {
    title: 'Absence Patterns', icon: 'bi-exclamation-triangle',
    endpoint: () => '/school/hr/reports/absence-patterns',
    filters: ['from', 'to', 'threshold'],
    columns: [
      { key: 'name', label: 'Staff' },
      { key: 'employee_code', label: 'Code' },
      { key: 'department', label: 'Department' },
      { key: 'absent_days', label: 'Absent' },
      { key: 'late_days', label: 'Late' },
      { key: 'half_days', label: 'Half Day' },
      { key: 'incident_count', label: 'Total Incidents' },
    ],
  },
  'salary-register': {
    title: 'Salary Register', icon: 'bi-journal-text',
    endpoint: () => '/school/hr/reports/salary-register',
    filters: ['run'],
    columns: [
      { key: 'employee_code', label: 'Code' },
      { key: 'staff_name', label: 'Name' },
      { key: 'designation', label: 'Designation' },
      { key: 'department', label: 'Department' },
      { key: 'paid_days', label: 'Paid Days' },
      { key: 'lop_days', label: 'LOP Days' },
      { key: 'gross_earnings', label: 'Gross', money: true },
      { key: 'total_deductions', label: 'Deductions', money: true },
      { key: 'net_pay', label: 'Net Pay', money: true },
      { key: 'employer_contrib', label: 'Employer', money: true },
    ],
  },
  'salary-abstract': {
    title: 'Salary Abstract', icon: 'bi-file-earmark-text',
    endpoint: () => '/school/hr/reports/salary-abstract',
    filters: ['run'],
    custom: 'abstract',
  },
  'dept-cost': {
    title: 'Department Cost', icon: 'bi-building',
    endpoint: () => '/school/hr/reports/dept-cost',
    filters: [],
    columns: [
      { key: 'department', label: 'Department' },
      { key: 'staff_count', label: 'Staff' },
      { key: 'total_gross', label: 'Gross', money: true },
      { key: 'total_deductions', label: 'Deductions', money: true },
      { key: 'employer_contrib', label: 'Employer', money: true },
      { key: 'net_pay', label: 'Net', money: true },
    ],
  },
  'month-variance': {
    title: 'Month Variance', icon: 'bi-graph-up',
    endpoint: () => '/school/hr/reports/month-variance',
    filters: ['run', 'prevRun'],
    columns: [
      { key: 'employee_code', label: 'Code' },
      { key: 'name', label: 'Name' },
      { key: 'current_gross', label: 'Current Gross', money: true },
      { key: 'prev_gross', label: 'Prev Gross', money: true },
      { key: 'gross_variance', label: 'Gross Var', money: true },
      { key: 'gross_pct_change', label: 'Gross %' },
      { key: 'current_net', label: 'Current Net', money: true },
      { key: 'prev_net', label: 'Prev Net', money: true },
      { key: 'net_variance', label: 'Net Var', money: true },
      { key: 'net_pct_change', label: 'Net %' },
    ],
  },
  arrears: {
    title: 'Arrears & Adjustments', icon: 'bi-currency-exchange',
    endpoint: () => '/school/hr/reports/arrears',
    filters: [],
    columns: [
      { key: 'staff_name', label: 'Staff' },
      { key: 'employee_code', label: 'Code' },
      { key: 'period_start', label: 'Period Start', format: fmtDate },
      { key: 'period_end', label: 'Period End', format: fmtDate },
      { key: 'amount', label: 'Amount', money: true },
      { key: 'reason', label: 'Reason' },
      { key: 'status', label: 'Status' },
    ],
  },
  'advances-outstanding': {
    title: 'Advances Outstanding', icon: 'bi-cash-stack',
    endpoint: () => '/school/hr/reports/advances-outstanding',
    filters: [],
    columns: [
      { key: 'staff_name', label: 'Staff' },
      { key: 'employee_code', label: 'Code' },
      { key: 'type', label: 'Type' },
      { key: 'amount', label: 'Amount', money: true },
      { key: 'installments', label: 'Installments' },
      { key: 'status', label: 'Status' },
      { key: 'outstanding', label: 'Outstanding', money: true },
    ],
  },
  'advances-aging': {
    title: 'Advances Aging', icon: 'bi-hourglass',
    endpoint: () => '/school/hr/reports/advances-aging',
    filters: [],
    custom: 'aging',
    columns: [
      { key: 'staff_name', label: 'Staff' },
      { key: 'employee_code', label: 'Code' },
      { key: 'type', label: 'Type' },
      { key: 'amount', label: 'Amount', money: true },
      { key: 'disbursed_at', label: 'Disbursed', format: fmtDate },
      { key: 'outstanding', label: 'Outstanding', money: true },
      { key: 'next_due', label: 'Next Due', format: fmtDate },
    ],
  },
  'statutory-registers': {
    title: 'Statutory Registers', icon: 'bi-shield-lock',
    endpoint: () => '/school/hr/reports/statutory-registers',
    filters: ['period'],
    custom: 'statutory',
  },
  form16: {
    title: 'Form 16', icon: 'bi-file-earmark-text',
    endpoint: () => '/school/hr/reports/form16',
    filters: ['financialYear'],
    columns: [
      { key: 'employee_code', label: 'Code' },
      { key: 'name', label: 'Name' },
      { key: 'pan', label: 'PAN' },
      { key: 'total_gross', label: 'Total Gross', money: true },
      { key: 'total_tds', label: 'Total TDS', money: true },
    ],
  },
  'gratuity-liability': {
    title: 'Gratuity Liability', icon: 'bi-currency-rupee',
    endpoint: () => '/school/hr/reports/gratuity-liability',
    filters: [],
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'employee_code', label: 'Code' },
      { key: 'designation', label: 'Designation' },
      { key: 'joining_date', label: 'Joining Date', format: fmtDate },
      { key: 'years_of_service', label: 'Years' },
      { key: 'eligibility', label: 'Eligibility' },
    ],
  },
  overtime: {
    title: 'Overtime / Extra Periods', icon: 'bi-clock',
    endpoint: () => '/school/hr/reports/overtime',
    filters: ['run'],
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'employee_code', label: 'Code' },
      { key: 'department', label: 'Department' },
      { key: 'overtime_amount', label: 'Overtime', money: true },
      { key: 'calculation_details', label: 'Details', format: (v) => (v ? JSON.stringify(v) : 'Ã¢â‚¬â€') },
    ],
  },
  'substitution-impact': {
    title: 'Substitution Impact', icon: 'bi-person-lines-fill',
    endpoint: () => '/school/hr/reports/substitution-impact',
    filters: ['from', 'to'],
    columns: [
      { key: 'teacher_name', label: 'Substitute Teacher' },
      { key: 'employee_code', label: 'Code' },
      { key: 'substitution_count', label: 'Substitutions' },
      { key: 'completed_count', label: 'Completed' },
    ],
  },
  'salary-audit': {
    title: 'Salary Change Audit', icon: 'bi-journal-text',
    endpoint: () => '/school/hr/reports/salary-audit',
    filters: ['from', 'to'],
    columns: [
      { key: 'created_at', label: 'Timestamp', format: (v) => (v ? new Date(v).toLocaleString('en-IN') : 'Ã¢â‚¬â€') },
      { key: 'user_id', label: 'User' },
      { key: 'action', label: 'Action' },
      { key: 'entity', label: 'Entity' },
      { key: 'entity_id', label: 'Entity ID' },
      { key: 'staff_name', label: 'Staff' },
      { key: 'employee_code', label: 'Code' },
    ],
  },
  'unlock-audit': {
    title: 'Payroll Unlock Audit', icon: 'bi-lock',
    endpoint: () => '/school/hr/reports/unlock-audit',
    filters: [],
    columns: [
      { key: 'created_at', label: 'Timestamp', format: (v) => (v ? new Date(v).toLocaleString('en-IN') : 'Ã¢â‚¬â€') },
      { key: 'user_id', label: 'User ID' },
      { key: 'unlocked_by', label: 'Unlocked By' },
      { key: 'entity_id', label: 'Run ID' },
    ],
  },
  'bank-advice': {
    title: 'Bank Advice', icon: 'bi-bank',
    endpoint: () => '/school/hr/reports/bank-advice',
    filters: ['run'],
    custom: 'bankAdvice',
    columns: [
      { key: 'employee_code', label: 'Code' },
      { key: 'staff_name', label: 'Beneficiary' },
      { key: 'account_holder_name', label: 'Account Holder' },
      { key: 'bank_name', label: 'Bank' },
      { key: 'account_number', label: 'Account Number' },
      { key: 'ifsc_code', label: 'IFSC' },
      { key: 'net_pay', label: 'Amount', money: true },
    ],
  },
};

const FILTER_META = {
  run: { key: 'run_id', label: 'Payroll Run', type: 'run' },
  prevRun: { key: 'prev_run_id', label: 'Previous Run', type: 'run' },
  from: { key: 'from', label: 'From', type: 'date' },
  to: { key: 'to', label: 'To', type: 'date' },
  days: { key: 'days', label: 'Within (days)', type: 'number', placeholder: '30' },
  threshold: { key: 'threshold', label: 'Min Incidents', type: 'number', placeholder: '3' },
  period: { key: 'period', label: 'Period (YYYY-MM)', type: 'month' },
  financialYear: { key: 'financial_year', label: 'Financial Year', type: 'text', placeholder: '2026-27' },
  staff: { key: 'staff_id', label: 'Staff', type: 'staff' },
  leaveType: { key: 'leave_type_id', label: 'Leave Type', type: 'leaveType' },
};

export default function ReportView({ me, onNavigate, reportKey }) {
  const def = REPORT_DEFS[reportKey] || REPORT_DEFS['staff-strength'];
  const [filters, setFilters] = useState({ period: new Date().toISOString().slice(0, 7), financial_year: '2026-27' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [runs, setRuns] = useState([]);
  const [staff, setStaff] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [statTab, setStatTab] = useState('pf');
  const viewer = canViewHR(me, 'hr.reports');

  const needsRuns = def.filters.includes('run') || def.filters.includes('prevRun');
  const needsStaff = def.filters.includes('staff');
  const needsLeaveTypes = def.filters.includes('leaveType');

  useEffect(() => {
    if (needsRuns) apiGet('/school/hr/payroll/runs').then((d) => d?.ok && setRuns(d.runs || [])).catch(() => {});
    if (needsStaff) apiGet('/school/hr/staff?status=active').then((d) => d?.ok && setStaff(d.staff || [])).catch(() => {});
    if (needsLeaveTypes) apiGet('/school/hr/leave/types').then((d) => d?.ok && setLeaveTypes(d.types || [])).catch(() => {});
  }, [reportKey]);

  useEffect(() => { setData(null); setError(''); }, [reportKey]);

  async function load() {
    if (!viewer) return;
    const missingRun = def.filters.includes('run') && !filters.run_id;
    if (missingRun) { setError('Select a payroll run to load this report.'); return; }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      def.filters.forEach((token) => {
        const meta = FILTER_META[token];
        if (meta && filters[meta.key] !== undefined && filters[meta.key] !== '') params.set(meta.key, filters[meta.key]);
      });
      const qs = params.toString();
      const d = await apiGet(`${def.endpoint()}${qs ? `?${qs}` : ''}`);
      if (!d?.ok) throw new Error(d?.error || 'Failed to load report');
      setData(d);
    } catch (err) { setError(err.message || 'Failed to load report'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [reportKey]);

  const rows = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.rows)) return data.rows;
    return [];
  }, [data]);

  function exportCsv() {
    if (!rows.length) return toast('No data to export', 'warning');
    downloadCsv(`${reportKey}-${new Date().toISOString().slice(0, 10)}.csv`, def.columns || [], rows);
  }

  function renderCell(col, row) {
    const v = row[col.key];
    if (col.format) return col.format(v, row);
    if (col.money) return money(v);
    if (v === null || v === undefined || v === '') return 'Ã¢â‚¬â€';
    return v;
  }

  function renderFilters() {
    if (!def.filters.length) return null;
    return (
      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            {def.filters.map((token) => {
              const meta = FILTER_META[token];
              if (!meta) return null;
              const val = filters[meta.key] ?? '';
              const onChange = (e) => setFilters({ ...filters, [meta.key]: e.target.value });
              return (
                <div className="col-md-3" key={token}>
                  <label className="form-label small">{meta.label}</label>
                  {meta.type === 'run' ? (
                    <select className="form-select form-select-sm" value={val} onChange={onChange}>
                      <option value="">Select run</option>
                      {runs.map((r) => <option key={r.id} value={r.id}>{r.period_name} Ã¢â‚¬â€ {r.status}</option>)}
                    </select>
                  ) : meta.type === 'staff' ? (
                    <select className="form-select form-select-sm" value={val} onChange={onChange}>
                      <option value="">All staff</option>
                      {staff.map((s) => <option key={s.id} value={s.id}>{s.employee_code} Ã¢â‚¬â€ {s.name}</option>)}
                    </select>
                  ) : meta.type === 'leaveType' ? (
                    <select className="form-select form-select-sm" value={val} onChange={onChange}>
                      <option value="">All types</option>
                      {leaveTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  ) : (
                    <input
                      type={meta.type === 'number' ? 'number' : meta.type}
                      className="form-control form-control-sm"
                      value={val}
                      placeholder={meta.placeholder}
                      onChange={onChange}
                    />
                  )}
                </div>
              );
            })}
            <div className="col-md-2 d-grid">
              <button className="btn btn-sm btn-primary" onClick={load} disabled={loading}>
                {loading ? <span className="spinner-border spinner-border-sm"></span> : 'Load'}
              </button>
            </div>
            <div className="col-md-2 d-grid">
              <button className="btn btn-sm btn-outline-secondary" onClick={exportCsv} disabled={!rows.length}>
                <i className="bi bi-download me-1"></i>Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderTable(cols, list, emptyText = 'No data') {
    if (!list.length) return <div className="text-center py-4 text-muted">{emptyText}</div>;
    return (
      <div className="table-responsive">
        <table className="table table-sm align-middle mb-0">
          <thead className="table-light"><tr>{cols.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
          <tbody>
            {list.map((row, i) => (
              <tr key={row.id || row.employee_code || i}>
                {cols.map((c) => <td key={c.key}>{renderCell(c, row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderCustom() {
    if (!data) return null;
    if (def.custom === 'abstract') {
      const s = data.summary || {};
      return (
        <>
          <div className="row g-3 mb-3">
            {[
              ['Payslips', s.total_payslips || 0, false],
              ['Total Gross', s.total_gross, true],
              ['Deductions', s.total_deductions, true],
              ['Employer', s.total_employer_contrib, true],
              ['Net Pay', s.total_net_pay, true],
            ].map(([label, value, isMoney]) => (
              <div className="col-md-3 col-lg" key={label}>
                <div className="card"><div className="card-body text-center">
                  <div className="fw-bold fs-5">{isMoney ? money(value) : value}</div>
                  <div className="text-muted small">{label}</div>
                </div></div>
              </div>
            ))}
          </div>
          <div className="card mb-3">
            <div className="card-header"><h6 className="mb-0">Department Summary</h6></div>
            <div className="card-body p-0">
              {renderTable([
                { key: 'department', label: 'Department' },
                { key: 'staff_count', label: 'Staff' },
                { key: 'total_gross', label: 'Gross', money: true },
                { key: 'total_net', label: 'Net', money: true },
              ], data.deptSummary || [])}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h6 className="mb-0">Component Summary</h6></div>
            <div className="card-body p-0">
              {renderTable([
                { key: 'component_code', label: 'Code' },
                { key: 'component_name', label: 'Component' },
                { key: 'component_type', label: 'Type' },
                { key: 'total_amount', label: 'Total', money: true },
              ], data.compSummary || [])}
            </div>
          </div>
        </>
      );
    }

    if (def.custom === 'aging') {
      const buckets = data.aging || {};
      return (
        <>
          <div className="row g-2 mb-3">
            {Object.entries(buckets).map(([k, v]) => (
              <div className="col-6 col-md-2" key={k}>
                <div className="card"><div className="card-body text-center py-2">
                  <div className="fw-bold">{money(v)}</div>
                  <div className="text-muted small">{k === 'current' ? 'Current' : `${k} days`}</div>
                </div></div>
              </div>
            ))}
          </div>
          <div className="card"><div className="card-body p-0">{renderTable(def.columns, rows)}</div></div>
        </>
      );
    }

    if (def.custom === 'statutory') {
      const tabs = [
        { key: 'pf', label: 'PF', cols: [
          { key: 'employee_code', label: 'Code' }, { key: 'name', label: 'Name' },
          { key: 'gross_earnings', label: 'Gross', money: true },
          { key: 'pf_employee', label: 'PF Employee', money: true },
          { key: 'pf_employer', label: 'PF Employer', money: true },
        ] },
        { key: 'esi', label: 'ESI', cols: [
          { key: 'employee_code', label: 'Code' }, { key: 'name', label: 'Name' },
          { key: 'gross_earnings', label: 'Gross', money: true },
          { key: 'esi_employee', label: 'ESI Employee', money: true },
          { key: 'esi_employer', label: 'ESI Employer', money: true },
        ] },
        { key: 'pt', label: 'PT', cols: [
          { key: 'employee_code', label: 'Code' }, { key: 'name', label: 'Name' },
          { key: 'gross_earnings', label: 'Gross', money: true },
          { key: 'pt', label: 'PT', money: true },
        ] },
        { key: 'tds', label: 'TDS', cols: [
          { key: 'employee_code', label: 'Code' }, { key: 'name', label: 'Name' },
          { key: 'gross_earnings', label: 'Gross', money: true },
          { key: 'tds', label: 'TDS', money: true },
        ] },
      ];
      const current = tabs.find((t) => t.key === statTab) || tabs[0];
      return (
        <>
          <ul className="nav nav-tabs mb-3">
            {tabs.map((t) => (
              <li className="nav-item" key={t.key}>
                <button type="button" className={`nav-link ${t.key === statTab ? 'active' : ''}`} onClick={() => setStatTab(t.key)}>{t.label}</button>
              </li>
            ))}
          </ul>
          <div className="card"><div className="card-body p-0">{renderTable(current.cols, data[current.key] || [])}</div></div>
        </>
      );
    }

    if (def.custom === 'bankAdvice') {
      const total = rows.reduce((a, r) => a + Number(r.net_pay || 0), 0);
      const missing = rows.filter((r) => !r.account_number).length;
      return (
        <>
          <div className="alert alert-info small">Total: {money(total)} Ã‚Â· {rows.length} employees Ã‚Â· {missing} missing bank details</div>
          <div className="card"><div className="card-body p-0">
            {rows.length ? (
              <div className="table-responsive"><table className="table table-sm mb-0">
                <thead className="table-light"><tr>{def.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.employee_code || i} style={{ background: !r.account_number ? '#fff3cd' : '' }}>
                      {def.columns.map((c) => <td key={c.key}>{renderCell(c, r)}</td>)}
                    </tr>
                  ))}
                  <tr className="table-active fw-bold"><td colSpan={def.columns.length - 1} className="text-end">Total</td><td>{money(total)}</td></tr>
                </tbody>
              </table></div>
            ) : <div className="text-center py-4 text-muted">No data</div>}
          </div></div>
        </>
      );
    }

    return null;
  }

  const actions = (
    <>
      <button className="btn btn-sm btn-outline-secondary" onClick={load}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>
      <button className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/hr/reports')}><i className="bi bi-grid me-1"></i>All Reports</button>
    </>
  );

  return (
    <PageShell title={def.title} icon={def.icon} subtitle="HR report with filters and CSV export" onNavigate={onNavigate} actions={actions}>
      <ErrorBox message={error} onRetry={load} />
      {renderFilters()}
      {loading ? <Loading /> : !data ? (
        <div className="text-center py-5 text-muted">Select filters and click Load to view this report.</div>
      ) : def.custom ? renderCustom() : (
        <div className="card"><div className="card-body p-0">{renderTable(def.columns, rows)}</div></div>
      )}
    </PageShell>
  );
}

