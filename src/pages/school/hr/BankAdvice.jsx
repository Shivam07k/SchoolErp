import React, { useEffect, useState } from 'react';
import { apiGet } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Loading, ErrorBox, canManageHR, canViewHR, fmtDate, downloadCsv } from './shared';

export default function BankAdvice({ me, onNavigate }) {
  const [runId, setRunId] = useState('');
  const [run, setRun] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [runs, setRuns] = useState([]);
  const manager = canManageHR(me);
  const viewer = canViewHR(me);

  async function loadRuns() {
    try {
      const d = await apiGet('/school/hr/payroll/runs?status=locked,paid,posted');
      if (d?.ok) setRuns(d.runs || []);
    } catch (err) { console.warn('Failed to load runs', err); }
  }

  async function loadAdvice() {
    if (!runId) return;
    setLoading(true);
    setError('');
    try {
      const d = await apiGet(`/school/hr/payroll/runs/${runId}/bank-advice`);
      if (d?.ok) { setRun(d.run); setRows(d.rows || []); }
      else throw new Error(d?.error || 'Failed to load');
    } catch (err) { setError(err.message || 'Failed to load'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadRuns(); }, []);

  function exportCsv() {
    if (!rows.length) return toast('No data to export', 'warning');
    const cols = [
      { key: 'employee_code', label: 'Employee Code' },
      { key: 'staff_name', label: 'Beneficiary' },
      { key: 'account_holder_name', label: 'Account Holder' },
      { key: 'bank_name', label: 'Bank' },
      { key: 'account_number', label: 'Account Number' },
      { key: 'ifsc_code', label: 'IFSC' },
      { key: 'net_pay', label: 'Amount' },
    ];
    downloadCsv(`bank-advice-${run?.period_name || 'export'}.csv`, cols, rows);
  }

  return (
    <PageShell title="Bank Advice" icon="bi-bank" subtitle="Generate bank advice file for payroll payments" onNavigate={onNavigate} actions={
      <button className="btn btn-sm btn-outline-secondary" onClick={loadRuns}><i className="bi bi-arrow-clockwise me-1"></i>Refresh Runs</button>
    }>
      <ErrorBox message={error} onRetry={() => loadAdvice()} />

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
              <button className="btn btn-sm btn-primary" onClick={loadAdvice} disabled={!runId || loading}>
                {loading ? <span className="spinner-border spinner-border-sm"></span> : 'Load'}
              </button>
            </div>
            <div className="col-md-2 d-grid">
              <button className="btn btn-sm btn-outline-secondary" onClick={exportCsv} disabled={!rows.length}><i className="bi bi-download me-1"></i>Export CSV</button>
            </div>
          </div>
        </div>
      </div>

      {run && (
        <div className="card mb-3">
          <div className="card-header d-flex justify-content-between">
            <span>{run.period_name} Ã¢â‚¬â€ {fmtDate(run.period_start)} to {fmtDate(run.period_end)}</span>
            <span className="text-muted small">Total: {rows.length} employees, {rows.filter(r => !r.account_number).length} missing bank details</span>
          </div>
          <div className="card-body p-0">
            {rows.length ? (
              <div className="table-responsive"><table className="table table-sm mb-0"><thead className="table-light"><tr>
                <th>Code</th><th>Name</th><th>Account Holder</th><th>Bank</th><th>Account Number</th><th>IFSC</th><th className="text-end">Amount</th>
              </tr></thead><tbody>
                {rows.map(r => (
                  <tr key={r.employee_code} style={{background: !r.account_number ? '#fff3cd' : ''}}>
                    <td>{r.employee_code}</td><td>{r.staff_name}</td>
                    <td>{r.account_holder_name || 'Ã¢â‚¬â€'}</td><td>{r.bank_name || 'Ã¢â‚¬â€'}</td>
                    <td>{r.account_number || <span className="text-danger">Missing</span>}</td>
                    <td>{r.ifsc_code || 'Ã¢â‚¬â€'}</td><td className="text-end">{Number(r.net_pay || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                  </tr>
                ))}
                <tr className="table-active fw-bold"><td colSpan={6} className="text-end">Total</td><td className="text-end">{rows.reduce((a, r) => a + Number(r.net_pay || 0), 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td></tr>
              </tbody></table></div>
            ) : (
              <div className="text-center py-4 text-muted">No payslips found</div>
            )}
          </div>
        </div>
      )}

      {!runId && (
        <div className="text-center py-5"><i className="bi bi-bank d-block mb-2 text-muted" style={{fontSize: 48}}></i>
          <h5 className="fw-bold">Select a payroll run</h5>
          <p className="text-muted small">Choose a locked, paid, or posted payroll run to generate bank advice.</p>
        </div>
      )}
    </PageShell>
  );
}
