import React, { useEffect, useState } from 'react';
import { apiGet } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Loading, ErrorBox, canManageHR, canViewHR, fmtDate, downloadCsv } from './shared';

export default function StatutoryReports({ me, onNavigate }) {
  const [runId, setRunId] = useState('');
  const [run, setRun] = useState(null);
  const [data, setData] = useState({ pf: [], esi: [], pt: [], tds: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [runs, setRuns] = useState([]);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0,7));
  const manager = canManageHR(me);
  const viewer = canViewHR(me);

  async function loadRuns() {
    try {
      const d = await apiGet('/school/hr/payroll/runs');
      if (d?.ok) setRuns(d.runs || []);
    } catch (err) { console.warn('Failed to load runs', err); }
  }

  async function loadReports() {
    if (!runId && !period) return;
    setLoading(true);
    setError('');
    try {
      if (runId) {
        const d = await apiGet(`/school/hr/payroll/runs/${runId}/statutory-reports`);
        if (d?.ok) { setRun(d.run); setData(d.rows); }
      } else {
        const d = await apiGet(`/school/hr/reports/statutory-registers?period=${period}`);
        if (d?.ok) { setData({ pf: d.pf || [], esi: d.esi || [], pt: d.pt || [], tds: d.tds || [] }); setPeriod(d.period); }
      }
    } catch (err) { setError(err.message || 'Failed to load'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadRuns(); }, []);

  function exportCsv(items, filename) {
    if (!items?.length) return toast('No data to export', 'warning');
    downloadCsv(filename, [
      { key: 'employee_code', label: 'Code' }, { key: 'staff_name', label: 'Name' },
      { key: 'gross_earnings', label: 'Gross' },
      { key: 'pf_employee', label: 'PF Employee' }, { key: 'pf_employer', label: 'PF Employer' },
      { key: 'esi_employee', label: 'ESI Employee' }, { key: 'esi_employer', label: 'ESI Employer' },
      { key: 'pt', label: 'PT' }, { key: 'tds', label: 'TDS' },
    ], items);
  }

  const tabs = [
    { key: 'pf', label: 'PF', color: 'success' },
    { key: 'esi', label: 'ESI', color: 'info' },
    { key: 'pt', label: 'PT', color: 'warning' },
    { key: 'tds', label: 'TDS', color: 'danger' },
  ];

  return (
    <PageShell title="Statutory Reports" icon="bi-shield-lock" subtitle="PF, ESI, PT, TDS registers for a payroll period" onNavigate={onNavigate} actions={
      <>
        <button className="btn btn-sm btn-outline-secondary" onClick={loadRuns}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>
      </>
    }>
      <ErrorBox message={error} onRetry={loadReports} />

      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-md-4">
              <label className="form-label small">Payroll Run</label>
              <select className="form-select form-select-sm" value={runId} onChange={e => { setRunId(e.target.value); setPeriod(''); }}>
                <option value="">By Run</option>
                {runs.map(r => <option key={r.id} value={r.id}>{r.period_name} ({r.status})</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label small">Or Period (YYYY-MM)</label>
              <input type="month" className="form-control form-control-sm" value={period} onChange={e => { setPeriod(e.target.value); setRunId(''); }} />
            </div>
            <div className="col-md-2 d-grid">
              <button className="btn btn-sm btn-primary" onClick={loadReports} disabled={(!runId && !period) || loading}>
                {loading ? <span className="spinner-border spinner-border-sm"></span> : 'Load'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {run && <div className="alert alert-info small mb-3">Run: {run.period_name} ({fmtDate(run.period_start)} Ã¢â‚¬â€œ {fmtDate(run.period_end)}) Ã¢â‚¬â€ Status: {run.status}</div>}

      <ul className="nav nav-tabs mb-3" role="tablist">
        {tabs.map(t => (
          <li key={t.key} className="nav-item" role="presentation">
            <button className={`nav-link ${t.key === 'pf' ? 'active' : ''}`} data-bs-toggle="tab" data-bs-target={`#stat-${t.key}`} type="button">{t.label}</button>
          </li>
        ))}
      </ul>

      <div className="tab-content">
        {tabs.map(t => (
          <div key={t.key} className={`tab-pane fade ${t.key === 'pf' ? 'show active' : ''}`} id={`stat-${t.key}`} role="tabpanel">
            <div className="card">
              <div className="card-header d-flex justify-content-between">
                <span>{t.label} Register</span>
                {data[t.key]?.length && <button className="btn btn-sm btn-outline-secondary" onClick={() => exportCsv(data[t.key], `${t.key}-register-${run?.period_name || period}.csv`)}>Export CSV</button>}
              </div>
              <div className="card-body p-0">
                {data[t.key]?.length ? (
                  <div className="table-responsive"><table className="table table-sm mb-0"><thead className="table-light"><tr>
                    <th>Code</th><th>Name</th><th className="text-end">Gross</th>
                    {t.key === 'pf' && <> <th className="text-end">PF Emp</th><th className="text-end">PF Empr</th> </>}
                    {t.key === 'esi' && <> <th className="text-end">ESI Emp</th><th className="text-end">ESI Empr</th> </>}
                    {t.key === 'pt' && <th className="text-end">PT</th>}
                    {t.key === 'tds' && <th className="text-end">TDS</th>}
                  </tr></thead><tbody>
                    {data[t.key].map(r => (
                      <tr key={r.employee_code}>
                        <td>{r.employee_code}</td><td>{r.staff_name}</td><td className="text-end">{Number(r.gross_earnings || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                        {t.key === 'pf' && <> <td className="text-end">{Number(r.pf_employee || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td><td className="text-end">{Number(r.pf_employer || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td> </>}
                        {t.key === 'esi' && <> <td className="text-end">{Number(r.esi_employee || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td><td className="text-end">{Number(r.esi_employer || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td> </>}
                        {t.key === 'pt' && <td className="text-end">{Number(r.pt || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>}
                        {t.key === 'tds' && <td className="text-end">{Number(r.tds || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>}
                      </tr>
                    ))}
                    <tr className="table-active fw-bold">
                      <td colSpan={t.key === 'pf' || t.key === 'esi' ? 3 : 2} className="text-end">Totals</td>
                      {t.key === 'pf' && <> <td className="text-end">{data.pf.reduce((a, r) => a + Number(r.pf_employee || 0), 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td><td className="text-end">{data.pf.reduce((a, r) => a + Number(r.pf_employer || 0), 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td> </>}
                      {t.key === 'esi' && <> <td className="text-end">{data.esi.reduce((a, r) => a + Number(r.esi_employee || 0), 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td><td className="text-end">{data.esi.reduce((a, r) => a + Number(r.esi_employer || 0), 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td> </>}
                      {t.key === 'pt' && <td className="text-end">{data.pt.reduce((a, r) => a + Number(r.pt || 0), 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>}
                      {t.key === 'tds' && <td className="text-end">{data.tds.reduce((a, r) => a + Number(r.tds || 0), 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>}
                    </tr>
                  </tbody></table></div>
                ) : (
                  <div className="text-center py-4 text-muted">No data</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {!runId && !period && (
        <div className="text-center py-5"><i className="bi bi-shield-lock d-block mb-2 text-muted" style={{fontSize: 48}}></i>
          <h5 className="fw-bold">Select a run or period</h5>
          <p className="text-muted small">Choose a payroll run or enter a period (YYYY-MM) to view statutory registers.</p>
        </div>
      )}
    </PageShell>
  );
}
