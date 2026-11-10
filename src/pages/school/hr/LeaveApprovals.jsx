import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, ErrorBox, Badge, canManageHR, fmtDate } from './shared';

const STATUS_TONE = { pending: 'warning', approved: 'success', rejected: 'danger', cancelled: 'secondary', taken: 'info' };

export default function LeaveApprovals({ me, onNavigate }) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ staff_id: '', leave_type_id: '', status: '', from_date: '', to_date: '' });
  const manager = canManageHR(me);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
      const d = await apiGet(`/school/hr/leave/applications?${params.toString()}`);
      if (d?.ok) setApplications(d.applications || []);
      else throw new Error(d?.error || 'Failed to load applications');
    } catch (err) { setError(err.message || 'Failed to load applications'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [filters]);

  async function handleAction(appId, action) {
    try {
      let res;
      if (action === 'approve') res = await apiPost(`/school/hr/leave/applications/${appId}/approve`, {});
      else if (action === 'reject') {
        const reason = window.prompt('Rejection reason') || '';
        res = await apiPost(`/school/hr/leave/applications/${appId}/reject`, { reason });
      } else if (action === 'cancel') res = await apiPost(`/school/hr/leave/applications/${appId}/cancel`, { reason: 'Cancelled by approver' });
      if (!res?.ok) throw new Error(res?.error || 'Action failed');
      toast(`Application ${action}d`, 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <PageShell title="Leave Approvals" icon="bi-check2-circle" subtitle="Approve or reject leave applications with balance preview and timetable coverage impact" onNavigate={onNavigate} actions={<button className="btn btn-sm btn-outline-secondary" onClick={load} disabled={loading}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>}>
      <ErrorBox message={error} onRetry={load} />

      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2">
            <div className="col-md-3"><input className="form-control form-control-sm" placeholder="Search staff..." value={filters.staff_id} onChange={e => setFilters({...filters, staff_id: e.target.value})} /></div>
            <div className="col-md-2"><select className="form-select form-select-sm" value={filters.leave_type_id} onChange={e => setFilters({...filters, leave_type_id: e.target.value})}><option value="">All Types</option><option value="1">Casual Leave</option><option value="2">Sick Leave</option><option value="3">Earned Leave</option></select></div>
            <div className="col-md-2"><select className="form-select form-select-sm" value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}><option value="">All Status</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option></select></div>
            <div className="col-md-2"><input type="date" className="form-control form-control-sm" value={filters.from_date} onChange={e => setFilters({...filters, from_date: e.target.value})} /></div>
            <div className="col-md-2"><input type="date" className="form-control form-control-sm" value={filters.to_date} onChange={e => setFilters({...filters, to_date: e.target.value})} /></div>
            <div className="col-md-1"><button className="btn btn-sm btn-primary w-100" onClick={load}><i className="bi bi-search me-1"></i>Filter</button></div>
          </div>
        </div>
      </div>

      {loading ? <div className="text-center py-4"><div className="spinner-border text-primary"></div></div> : !applications.length ? (
        <div className="text-center py-5"><i className="bi bi-inbox d-block mb-2 text-muted" style={{fontSize: 48}}></i><h5 className="fw-bold">No applications found</h5><p className="text-muted small">No leave applications match the current filters.</p></div>
      ) : (
        <div className="table-responsive"><table className="table table-hover align-middle mb-0"><thead className="table-light"><tr><th>Staff</th><th>Leave Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th><th>Applied</th><th>Reason</th><th className="text-end">Action</th></tr></thead><tbody>
          {applications.map(a => (
            <tr key={a.id}>
              <td><span className="fw-semibold">{a.staff_name}</span><div className="small text-muted">{a.employee_code}</div></td>
              <td><Badge tone="info">{a.type_code}</Badge> {a.type_name}</td>
              <td>{fmtDate(a.from_date)}</td>
              <td>{fmtDate(a.to_date)}</td>
              <td>{a.days}</td>
              <td><Badge tone={STATUS_TONE[a.status] || 'secondary'}>{a.status}</Badge></td>
              <td>{fmtDate(a.applied_at)}</td>
              <td className="small" style={{maxWidth: 200}}>{a.reason || 'Ã¢â‚¬â€'}</td>
              <td className="text-end">
                {a.status === 'pending' && (
                  <div className="btn-group btn-group-sm">
                    <button className="btn btn-outline-success" onClick={() => handleAction(a.id, 'approve')}>Approve</button>
                    <button className="btn btn-outline-danger" onClick={() => handleAction(a.id, 'reject')}>Reject</button>
                  </div>
                )}
                {a.status === 'approved' && (
                  <button className="btn btn-sm btn-outline-warning" onClick={() => handleAction(a.id, 'cancel')}>Cancel</button>
                )}
              </td>
            </tr>
          ))}
        </tbody></table></div>
      )}
    </PageShell>
  );
}
