import React, { useEffect, useState } from 'react';
import { apiGet } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Loading, ErrorBox, Badge, canManageHR, canViewHR, fmtDate, downloadCsv, ADVANCE_STATUS_TONE } from './shared';

export default function AdvanceDashboard({ me, onNavigate }) {
  const [summary, setSummary] = useState({});
  const [byType, setByType] = useState([]);
  const [dueSoon, setDueSoon] = useState([]);
  const [aging, setAging] = useState({ current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 });
  const [agingDetails, setAgingDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const viewer = canViewHR(me, 'hr.advance_view');

  async function loadDashboard() {
    try {
      const d = await apiGet('/school/hr/advances/dashboard');
      if (d?.ok) { setSummary(d.summary || {}); setByType(d.byType || []); setDueSoon(d.dueSoon || []); }
    } catch (err) { console.warn('Dashboard load failed', err); }
  }

  async function loadAging() {
    try {
      const d = await apiGet('/school/hr/advances/aging');
      if (d?.ok) { setAging(d.aging || {}); setAgingDetails(d.advances || []); }
    } catch (err) { console.warn('Aging load failed', err); }
  }

  useEffect(() => { loadDashboard(); loadAging(); }, []);

  function exportAging() {
    if (!agingDetails.length) return toast('No data', 'warning');
    downloadCsv('advances-aging.csv', [
      { key: 'staff_name', label: 'Staff' }, { key: 'employee_code', label: 'Code' }, { key: 'type', label: 'Type' },
      { key: 'amount', label: 'Amount' }, { key: 'outstanding', label: 'Outstanding' }, { key: 'next_due', label: 'Next Due' }
    ], agingDetails);
  }

  if (loading) return <PageShell title="Advances Dashboard" icon="bi-graph-up" subtitle="Outstanding advances overview" onNavigate={onNavigate}><Loading /></PageShell>;

  return (
    <PageShell title="Advances Dashboard" icon="bi-graph-up" subtitle="Outstanding advances and repayment tracking" onNavigate={onNavigate} actions={
      <button className="btn btn-sm btn-outline-secondary" onClick={() => { loadDashboard(); loadAging(); }}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>
    }>
      <ErrorBox message={error} />

      <div className="row g-3 mb-4">
        <div className="col-md-3"><div className="card"><div className="card-body text-center"><div className="fw-bold fs-3">{summary.active_count || 0}</div><div className="text-muted small">Active Advances</div></div></div></div>
        <div className="col-md-3"><div className="card"><div className="card-body text-center"><div className="fw-bold fs-3 text-warning">{Number(summary.total_outstanding || 0).toLocaleString('en-IN', {minimumFractionDigits: 0})}</div><div className="text-muted small">Total Outstanding</div></div></div></div>
        <div className="col-md-3"><div className="card"><div className="card-body text-center"><div className="fw-bold fs-3">{summary.requested_count || 0}</div><div className="text-muted small">Pending Approval</div></div></div></div>
        <div className="col-md-3"><div className="card"><div className="card-body text-center"><div className="fw-bold fs-3">{dueSoon.length}</div><div className="text-muted small">Due This Month</div></div></div></div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <div className="card"><div className="card-header"><h6 className="mb-0">By Type</h6></div><div className="card-body">
            {byType.length ? (
              <div className="table-responsive"><table className="table table-sm mb-0"><thead><tr><th>Type</th><th className="text-end">Count</th><th className="text-end">Total</th></tr></thead><tbody>
                {byType.map(t => <tr key={t.type}><td>{t.type}</td><td className="text-end">{t.count}</td><td className="text-end">{Number(t.total_amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td></tr>)}
              </tbody></table></div>
            ) : <div className="text-muted small">No data</div>}
          </div></div>
        </div>
        <div className="col-md-6">
          <div className="card"><div className="card-header d-flex justify-content-between"><h6 className="mb-0">Aging Buckets</h6><button className="btn btn-sm btn-outline-secondary" onClick={exportAging}>Export CSV</button></div><div className="card-body">
            <div className="row text-center">
              {Object.entries(aging).map(([k, v]) => (
                <div key={k} className="col-6 col-md-2 mb-2"><div className="fw-bold fs-5">{Number(v).toLocaleString('en-IN', {minimumFractionDigits: 0})}</div><div className="text-muted small">{k === '90+' ? '90+ days' : k === 'current' ? 'Current' : k + ' days'}</div></div>
              ))}
            </div>
          </div></div>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-header"><h6 className="mb-0">Installments Due Soon (Next 30 Days)</h6></div>
        <div className="card-body p-0">
          {dueSoon.length ? (
            <div className="table-responsive"><table className="table table-sm mb-0"><thead className="table-light"><tr><th>Staff</th><th>Advance</th><th className="text-end">Installment</th><th>Due</th><th className="text-end">Outstanding</th></tr></thead><tbody>
              {dueSoon.map(s => (
                <tr key={s.id}><td>{s.employee_code} Ã¢â‚¬â€ {s.staff_name}</td><td>{s.advance_type} (#{s.advance_id})</td><td className="text-end">{Number(s.total_amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td><td>{s.due_month ? new Date(s.due_month).toLocaleDateString('en-IN', {year: 'numeric', month: 'short'}) : 'Ã¢â‚¬â€'}</td><td className="text-end">{Number(s.outstanding || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td></tr>
              ))}
            </tbody></table></div>
          ) : (
            <div className="text-center py-3 text-muted">No installments due soon</div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header d-flex justify-content-between"><h6 className="mb-0">Aging Details</h6><button className="btn btn-sm btn-outline-secondary" onClick={exportAging}>Export CSV</button></div>
        <div className="card-body p-0">
          {agingDetails.length ? (
            <div className="table-responsive"><table className="table table-sm mb-0"><thead className="table-light"><tr><th>Staff</th><th>Type</th><th className="text-end">Principal</th><th className="text-end">Outstanding</th><th>Next Due</th></tr></thead><tbody>
              {agingDetails.map(a => (
                <tr key={a.id}><td>{a.employee_code} Ã¢â‚¬â€ {a.staff_name}</td><td>{a.type}</td><td className="text-end">{Number(a.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td><td className="text-end">{Number(a.outstanding).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td><td>{a.next_due ? new Date(a.next_due).toLocaleDateString('en-IN', {year: 'numeric', month: 'short'}) : 'Ã¢â‚¬â€'}</td></tr>
              ))}
            </tbody></table></div>
          ) : <div className="text-center py-3 text-muted">No aging data</div>}
        </div>
      </div>
    </PageShell>
  );
}
