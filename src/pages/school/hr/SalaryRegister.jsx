import React, { useEffect, useState } from 'react';
import { apiGet } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Loading, ErrorBox, canManageHR, canViewHR, fmtDate, downloadCsv } from './shared';

export default function SalaryRegister({ me, onNavigate }) {
  const [runId, setRunId] = useState('');
  const [run, setRun] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [runs, setRuns] = useState([]);
  const [summary, setSummary] = useState(null);
  const [deptSummary, setDeptSummary] = useState([]);
  const [compSummary, setCompSummary] = useState([]);
  const manager = canManageHR(me);
  const viewer = canViewHR(me);

  async function loadRuns() {
    try {
      const d = await apiGet('/school/hr/payroll/runs');
      if (d?.ok) setRuns(d.runs || []);
    } catch (err) { console.warn('Failed to load runs', err); }
  }

  async function loadRegister() {
    if (!runId) return;
    setLoading(true);
    setError('');
    try {
      const [reg, abs, ds, cs] = await Promise.all([
        apiGet(`/school/hr/reports/salary-register?run_id=${runId}`),
        apiGet(`/school/hr/reports/salary-abstract?run_id=${runId}`),
        apiGet(`/school/hr/reports/dept-cost`),
        apiGet(`/school/hr/payroll/runs/${runId}/statutory-reports`),
      ]);
      if (reg?.ok) setRows(reg.data || []);
      if (abs?.ok) { setSummary(abs.summary); setDeptSummary(abs.deptSummary || []); setCompSummary(abs.compSummary || []); }
      if (cs?.ok) setRun(cs.run);
    } catch (err) { setError(err.message || 'Failed to load'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadRuns(); }, []);

  function exportCsv(data, filename, cols) {
    if (!data?.length) return toast('No data to export', 'warning');
    downloadCsv(filename, cols, data);
  }

  return (
    <PageShell title="Salary Register" icon="bi-journal-text" subtitle="View salary register and abstract for a payroll run" onNavigate={onNavigate} actions={
      <button className="btn btn-sm btn-outline-secondary" onClick={loadRuns}><i className="bi bi-arrow-clockwise me-1"></i>Refresh Runs</button>
    }>
      <ErrorBox message={error} onRetry={() => loadRegister()} />

      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-md-4">
              <label className="form-label small">Payroll Run *</label>
              <select className="form-select form-select-sm" value={runId} onChange={e => setRunId(e.target.value)}>
                <option value="">Select a run</option>
                {runs.map(r => <option key={r.id} value={r.id}>{r.period_name} ({fmtDate(r.period_start)} Ã¢â‚¬â€œ {fmtDate(r.period_end)}) Ã¢â‚¬â€ {r.status}</option>)}
              </select>
            </div>
            <div className="col-md-2 d-grid">
              <button className="btn btn-sm btn-primary" onClick={loadRegister} disabled={!runId || loading}>
                {loading ? <span className="spinner-border spinner-border-sm"></span> : 'Load'}
              </button>
            </div>
            <div className="col-md-2 d-grid">
              <button className="btn btn-sm btn-outline-secondary" onClick={() => exportCsv(rows, `salary-register-${run?.period_name || 'export'}.csv`, [
                { key: 'employee_code', label: 'Code' }, { key: 'staff_name', label: 'Name' }, { key: 'designation', label: 'Designation' },
                { key: 'department', label: 'Department' }, { key: 'paid_days', label: 'Paid' }, { key: 'lop_days', label: 'LOP' },
                { key: 'gross_earnings', label: 'Gross' }, { key: 'total_deductions', label: 'Deductions' }, { key: 'net_pay', label: 'Net' }, { key: 'employer_contrib', label: 'Employer' }
              ])} disabled={!rows.length}><i className="bi bi-download me-1"></i>Register CSV</button>
            </div>
            <div className="col-md-2 d-grid">
              <button className="btn btn-sm btn-outline-secondary" onClick={() => exportCsv(compSummary, `salary-abstract-${run?.period_name || 'export'}.csv`, [
                { key: 'component_code', label: 'Code' }, { key: 'component_name', label: 'Component' }, { key: 'component_type', label: 'Type' }, { key: 'total_amount', label: 'Total' }
              ])} disabled={!compSummary.length}><i className="bi bi-download me-1"></i>Abstract CSV</button>
            </div>
          </div>
        </div>
      </div>

      {run && (
        <div className="row g-3 mb-3">
          <div className="col-md-3"><div className="card"><div className="card-body text-center"><div className="fw-bold fs-4">{summary?.total_payslips || 0}</div><div className="text-muted small">Payslips</div></div></div></div>
          <div className="col-md-3"><div className="card"><div className="card-body text-center"><div className="fw-bold fs-4">{Number(summary?.total_gross || 0).toLocaleString('en-IN', {minimumFractionDigits: 0})}</div><div className="text-muted small">Total Gross</div></div></div></div>
          <div className="col-md-3"><div className="card"><div className="card-body text-center"><div className="fw-bold fs-4">{Number(summary?.total_deductions || 0).toLocaleString('en-IN', {minimumFractionDigits: 0})}</div><div className="text-muted small">Total Deductions</div></div></div></div>
          <div className="col-md-3"><div className="card"><div className="card-body text-center"><div className="fw-bold fs-4 text-success">{Number(summary?.total_net_pay || 0).toLocaleString('en-IN', {minimumFractionDigits: 0})}</div><div className="text-muted small">Total Net Pay</div></div></div></div>
        </div>
      )}

      {rows.length && (
        <div className="card mb-3">
          <div className="card-header"><h6 className="mb-0">Salary Register</h6></div>
          <div className="card-body p-0">
            <div className="table-responsive"><table className="table table-sm mb-0"><thead className="table-light"><tr>
              <th>Code</th><th>Name</th><th>Designation</th><th>Department</th><th className="text-end">Paid</th><th className="text-end">LOP</th>
              <th className="text-end">Gross</th><th className="text-end">Deductions</th><th className="text-end">Net</th><th className="text-end">Employer</th>
            </tr></thead><tbody>
              {rows.map(r => (
                <tr key={r.employee_code}>
                  <td>{r.employee_code}</td><td>{r.staff_name}</td><td>{r.designation || 'Ã¢â‚¬â€'}</td><td>{r.department || 'Ã¢â‚¬â€'}</td>
                  <td className="text-end">{r.paid_days}</td><td className="text-end">{r.lop_days}</td>
                  <td className="text-end">{Number(r.gross_earnings || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                  <td className="text-end">{Number(r.total_deductions || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                  <td className="text-end fw-bold">{Number(r.net_pay || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                  <td className="text-end">{Number(r.employer_contrib || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                </tr>
              ))}
              <tr className="table-active fw-bold">
                <td colSpan={5} className="text-end">Totals</td>
                <td className="text-end">{Number(summary?.total_gross || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                <td className="text-end">{Number(summary?.total_deductions || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                <td className="text-end">{Number(summary?.total_net_pay || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                <td className="text-end">{Number(summary?.total_employer_contrib || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
              </tr>
            </tbody></table></div>
          </div>
        </div>
      )}

      {deptSummary.length && (
        <div className="card mb-3">
          <div className="card-header"><h6 className="mb-0">Department Cost Summary</h6></div>
          <div className="card-body p-0">
            <div className="table-responsive"><table className="table table-sm mb-0"><thead className="table-light"><tr>
              <th>Department</th><th className="text-end">Staff</th><th className="text-end">Gross</th><th className="text-end">Net</th>
            </tr></thead><tbody>
              {deptSummary.map(d => (
                <tr key={d.department}><td>{d.department || 'Unassigned'}</td><td className="text-end">{d.staff_count}</td><td className="text-end">{Number(d.total_gross || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td><td className="text-end">{Number(d.total_net || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td></tr>
              ))}
            </tbody></table></div>
          </div>
        </div>
      )}

      {compSummary.length && (
        <div className="card">
          <div className="card-header"><h6 className="mb-0">Component Summary</h6></div>
          <div className="card-body p-0">
            <div className="table-responsive"><table className="table table-sm mb-0"><thead className="table-light"><tr>
              <th>Code</th><th>Component</th><th>Type</th><th className="text-end">Total</th>
            </tr></thead><tbody>
              {compSummary.map(c => (
                <tr key={c.component_code}><td>{c.component_code}</td><td>{c.component_name}</td><td><span className="badge bg-{c.component_type === 'earning' ? 'success' : c.component_type === 'deduction' ? 'danger' : 'info'}">{c.component_type}</span></td><td className="text-end">{Number(c.total_amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td></tr>
              ))}
            </tbody></table></div>
          </div>
        </div>
      )}

      {!runId && (
        <div className="text-center py-5"><i className="bi bi-journal-text d-block mb-2 text-muted" style={{fontSize: 48}}></i>
          <h5 className="fw-bold">Select a payroll run</h5>
          <p className="text-muted small">Choose a payroll run to view its salary register and abstract.</p>
        </div>
      )}
    </PageShell>
  );
}
