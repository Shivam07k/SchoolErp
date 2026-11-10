import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Loading, ErrorBox, Badge, canManageHR, canViewHR, fmtDate, downloadCsv, ADVANCE_STATUS_TONE } from './shared';

export default function AdvanceList({ me, onNavigate }) {
  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ status: '', type: '', staff_id: '' });
  const manager = canManageHR(me, 'hr.advance_manage');
  const viewer = canViewHR(me, 'hr.advance_view');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.type) params.set('type', filters.type);
      if (filters.staff_id) params.set('staff_id', filters.staff_id);
      const d = await apiGet(`/school/hr/advances?${params}`);
      if (d?.ok) setAdvances(d.advances || []);
      else throw new Error(d?.error || 'Failed to load');
    } catch (err) { setError(err.message || 'Failed to load'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [filters]);

  async function approve(id) {
    if (!window.confirm('Approve this advance?')) return;
    try {
      const res = await apiPost(`/school/hr/advances/${id}/approve`, {});
      if (!res?.ok) throw new Error(res?.error || 'Failed');
      toast('Approved', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function reject(id) {
    const reason = window.prompt('Rejection reason:');
    if (!reason) return;
    try {
      const res = await apiPost(`/school/hr/advances/${id}/reject`, { rejection_reason: reason });
      if (!res?.ok) throw new Error(res?.error || 'Failed');
      toast('Rejected', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function disburse(id) {
    if (!window.confirm('Disburse this advance?')) return;
    try {
      const res = await apiPost(`/school/hr/advances/${id}/disburse`, { disbursement_mode: 'bank' });
      if (!res?.ok) throw new Error(res?.error || 'Failed');
      toast('Disbursed', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function writeoff(id) {
    if (!window.confirm('Write off this advance?')) return;
    try {
      const res = await apiPost(`/school/hr/advances/${id}/writeoff`, { reason: 'Written off' });
      if (!res?.ok) throw new Error(res?.error || 'Failed');
      toast('Written off', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function deleteAdvance(id) {
    if (!window.confirm('Delete this advance?')) return;
    try {
      const res = await apiPost(`/school/hr/advances/${id}/delete`, {});
      if (!res?.ok) throw new Error(res?.error || 'Failed');
      toast('Deleted', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <PageShell title="Advances & Loans" icon="bi-cash-stack" subtitle="Manage salary advances and loans with repayment schedules" onNavigate={onNavigate} actions={
      <>
        <button className="btn btn-sm btn-outline-secondary" onClick={load}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>
        {manager && <button className="btn btn-sm btn-primary" onClick={() => onNavigate('/school/hr/advances/new')}><i className="bi bi-plus-lg me-1"></i>New Advance</button>}
        <button className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/hr/advances/dashboard')}><i className="bi bi-graph-up me-1"></i>Dashboard</button>
      </>
    }>
      <ErrorBox message={error} onRetry={load} />

      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2">
            <div className="col-md-3"><label className="form-label small">Status</label><select className="form-select form-select-sm" value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}><option value="">All</option><option value="requested">Requested</option><option value="approved">Approved</option><option value="disbursed">Disbursed</option><option value="recovering">Recovering</option><option value="closed">Closed</option><option value="written_off">Written Off</option><option value="rejected">Rejected</option></select></div>
            <div className="col-md-3"><label className="form-label small">Type</label><select className="form-select form-select-sm" value={filters.type} onChange={e => setFilters({...filters, type: e.target.value})}><option value="">All</option><option value="salary_advance">Salary Advance</option><option value="loan">Loan</option></select></div>
            <div className="col-md-3"><label className="form-label small">Staff</label><input type="text" className="form-control form-control-sm" placeholder="Search staff..." value={filters.staff_id} onChange={e => setFilters({...filters, staff_id: e.target.value})} /></div>
            <div className="col-md-3 d-flex gap-2 align-items-end"><button className="btn btn-sm btn-outline-secondary" onClick={() => setFilters({ status: '', type: '', staff_id: '' })}>Clear</button></div>
          </div>
        </div>
      </div>

      {loading ? <Loading /> : !advances.length ? (
        <div className="text-center py-5"><i className="bi bi-cash-stack d-block mb-2 text-muted" style={{fontSize: 48}}></i><h5 className="fw-bold">No advances</h5><p className="text-muted small">Create a new advance request to get started.</p></div>
      ) : (
        <div className="table-responsive"><table className="table table-sm align-middle mb-0"><thead><tr><th>ID</th><th>Staff</th><th>Type</th><th className="text-end">Amount</th><th>Installments</th><th>Status</th><th>Requested</th><th className="text-end">Actions</th></tr></thead><tbody>
          {advances.map(a => (
            <tr key={a.id}>
              <td>{a.id}</td>
              <td>{a.employee_code} Ã¢â‚¬â€ {a.staff_name}</td>
              <td><Badge tone={a.type === 'salary_advance' ? 'info' : 'warning'}>{a.type}</Badge></td>
              <td className="text-end">{Number(a.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
              <td>{a.installments}</td>
              <td><Badge tone={ADVANCE_STATUS_TONE[a.status] || 'secondary'}>{a.status}</Badge></td>
              <td>{fmtDate(a.requested_at)}</td>
              <td className="text-end">
                {viewer && <button className="btn btn-sm btn-outline-info" onClick={() => onNavigate(`/school/hr/advances/${a.id}`)}>View</button>}
                {manager && a.status === 'requested' && <button className="btn btn-sm btn-outline-success ms-1" onClick={() => approve(a.id)}>Approve</button>}
                {manager && a.status === 'requested' && <button className="btn btn-sm btn-outline-danger ms-1" onClick={() => reject(a.id)}>Reject</button>}
                {manager && a.status === 'approved' && <button className="btn btn-sm btn-outline-primary ms-1" onClick={() => disburse(a.id)}>Disburse</button>}
                {manager && ['disbursed', 'recovering'].includes(a.status) && <button className="btn btn-sm btn-outline-warning ms-1" onClick={() => writeoff(a.id)}>Write Off</button>}
                {manager && ['requested', 'rejected'].includes(a.status) && <button className="btn btn-sm btn-outline-danger ms-1" onClick={() => deleteAdvance(a.id)}>Delete</button>}
              </td>
            </tr>
          ))}
        </tbody></table></div>
      )}
    </PageShell>
  );
}
