import React, { useEffect, useState } from 'react';
import { apiGet } from '../../../api';
import { PageShell, Empty, Loading, ErrorBox, Badge, canManageHR, fmtDate, downloadCsv } from './shared';

export default function LeaveBalances({ me, onNavigate }) {
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ staff_id: '', leave_type_id: '' });
  const manager = canManageHR(me);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
      const d = await apiGet(`/school/hr/leave/balances?${params.toString()}`);
      if (d?.ok) setBalances(d.balances || []);
      else throw new Error(d?.error || 'Failed to load balances');
    } catch (err) { setError(err.message || 'Failed to load balances'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [filters]);

  const leaveTypes = [
    { id: 1, name: 'Casual Leave', code: 'CL' },
    { id: 2, name: 'Sick Leave', code: 'SL' },
    { id: 3, name: 'Earned Leave', code: 'EL' },
  ];

  return (
    <PageShell
      title="Leave Balances"
      icon="bi-bar-chart"
      subtitle="View current leave balances, accrued, used, encashed and carried forward per staff and leave type"
      onNavigate={onNavigate}
      actions={
        <>
          <button className="btn btn-sm btn-outline-secondary" onClick={() => setFilters({})}><i className="bi bi-arrow-clockwise me-1"></i>Clear Filters</button>
          <button className="btn btn-sm btn-outline-secondary" disabled={!filters.staff_id && !filters.leave_type_id} onClick={() => downloadCsv('leave-balances.csv', [
            { label: 'Staff ID', key: 'staff_id' },
            { label: 'Leave Type', key: 'type_name' },
            { label: 'Code', key: 'type_code' },
            { label: 'Opening', key: 'opening' },
            { label: 'Accrued', key: 'accrued' },
            { label: 'Used', key: 'used' },
            { label: 'Adjusted', key: 'adjusted' },
            { label: 'Encashed', key: 'encashed' },
            { label: 'Carried Forward', key: 'carried_forward' },
            { label: 'Balance', key: 'balance' },
          ], balances)}><i className="bi bi-download me-1"></i>CSV</button>
        </>
      }
    >
      <div className="row g-2 mb-3">
        <div className="col-md-4"><select className="form-select form-select-sm" value={filters.staff_id} onChange={e => setFilters({...filters, staff_id: e.target.value})}><option value="">All Staff</option><option value="1">Rajesh Kumar (EMP001)</option><option value="2">Priya Sharma (EMP002)</option><option value="3">Amit Patel (EMP003)</option></select></div>
        <div className="col-md-4"><select className="form-select form-select-sm" value={filters.leave_type_id} onChange={e => setFilters({...filters, leave_type_id: e.target.value})}><option value="">All Leave Types</option><option value="1">Casual Leave (CL)</option><option value="2">Sick Leave (SL)</option><option value="3">Earned Leave (EL)</option></select></div>
        <div className="col-md-4"><button className="btn btn-sm btn-primary w-100" onClick={() => { setFilters({}); }}><i className="bi bi-arrow-clockwise me-1"></i>Clear Filters</button></div>
      </div>

      {!balances.length ? (
        <div className="text-center py-5"><i className="bi bi-bar-chart d-block mb-2 text-muted" style={{fontSize: 48}}></i><h5 className="fw-bold">No leave balances found</h5><p className="text-muted small">Run leave accrual or check staff assignments.</p></div>
      ) : (
        <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Staff</th><th>Leave Type</th><th>Opening</th><th>Accrued</th><th>Used</th><th>Adjusted</th><th>Encashed</th><th>Carried Fwd</th><th className="text-end">Balance</th></tr></thead><tbody>
          {balances.map(b => <tr key={`${b.staff_id}-${b.leave_type_id}`}><td>{b.staff_id}</td><td><Badge tone="info">{b.type_code}</Badge> {b.type_name}</td><td>{b.opening || 0}</td><td>{b.accrued || 0}</td><td>{b.used || 0}</td><td>{b.adjusted || 0}</td><td>{b.encashed || 0}</td><td>{b.carried_forward || 0}</td><td className="text-end fw-bold">{b.balance || 0}</td></tr>)}
        </tbody></table></div>
      )}
    </PageShell>
  );
}
