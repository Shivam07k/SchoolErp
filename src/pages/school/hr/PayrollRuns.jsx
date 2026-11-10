import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Loading, ErrorBox, Badge, canManageHR, canViewHR, fmtDate, downloadCsv, PAYROLL_STATUS_TONE } from './shared';

export default function PayrollRuns({ me, onNavigate }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ period_start: '', period_end: '', period_name: '', basis_days: 30, wage_base_days: 30 });
  const manager = canManageHR(me, 'hr.payroll_manage');
  const viewer = canViewHR(me, 'hr.payroll_view');

  async function load() {
    if (!viewer) return;
    setLoading(true);
    setError('');
    try {
      const d = await apiGet('/school/hr/payroll/runs');
      if (d?.ok) setRuns(d.runs || []);
      else throw new Error(d?.error || 'Failed to load');
    } catch (err) { setError(err.message || 'Failed to load'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function resetForm() { setForm({ period_start: '', period_end: '', period_name: '', basis_days: 30, wage_base_days: 30 }); setShowForm(false); }

  async function submit(e) {
    e.preventDefault();
    try {
      const body = { period_start: form.period_start, period_end: form.period_end, period_name: form.period_name, basis_days: Number(form.basis_days) || 30, wage_base_days: Number(form.wage_base_days) || 30 };
      const res = await apiPost('/school/hr/payroll/runs', body);
      if (!res?.ok) throw new Error(res?.error || 'Failed to create');
      toast('Payroll run created', 'success');
      resetForm();
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function compute(id) {
    if (!window.confirm('Compute this payroll run?')) return;
    try {
      const res = await apiPost(`/school/hr/payroll/runs/${id}/compute`, {});
      if (!res?.ok) throw new Error(res?.error || 'Compute failed');
      toast('Payroll computed', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function approve(id) {
    if (!window.confirm('Approve this payroll run?')) return;
    try {
      const res = await apiPost(`/school/hr/payroll/runs/${id}/approve`, {});
      if (!res?.ok) throw new Error(res?.error || 'Approve failed');
      toast('Payroll approved', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function lock(id) {
    if (!window.confirm('Lock this payroll run?')) return;
    try {
      const res = await apiPost(`/school/hr/payroll/runs/${id}/lock`, {});
      if (!res?.ok) throw new Error(res?.error || 'Lock failed');
      toast('Payroll locked', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function markPaid(id) {
    if (!window.confirm('Mark as paid?')) return;
    try {
      const res = await apiPost(`/school/hr/payroll/runs/${id}/mark-paid`, {});
      if (!res?.ok) throw new Error(res?.error || 'Failed');
      toast('Marked as paid', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function postToAccounts(id) {
    if (!window.confirm('Post to accounts?')) return;
    try {
      const res = await apiPost(`/school/hr/payroll/runs/${id}/post-to-accounts`, {});
      if (!res?.ok) throw new Error(res?.error || 'Post failed');
      toast('Posted to accounts', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function cancelRun(id) {
    if (!window.confirm('Cancel this payroll run?')) return;
    try {
      const res = await apiPost(`/school/hr/payroll/runs/${id}/cancel`, {});
      if (!res?.ok) throw new Error(res?.error || 'Cancel failed');
      toast('Payroll cancelled', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  const canCompute = (s) => manager && ['draft'].includes(s);
  const canPreview = (s) => viewer && ['computed', 'previewed', 'approved', 'locked', 'paid', 'posted'].includes(s);
  const canApprove = (s) => manager && ['computed', 'previewed'].includes(s);
  const canLock = (s) => manager && ['approved'].includes(s);
  const canUnlock = (s) => manager && ['locked'].includes(s);
  const canMarkPaid = (s) => manager && ['locked'].includes(s);
  const canPost = (s) => manager && ['paid'].includes(s);
  const canCancel = (s) => manager && ['draft', 'computed'].includes(s);
  const canDelete = (s) => manager && ['draft', 'cancelled'].includes(s);
  const canWizard = (s) => manager && ['draft', 'computed', 'previewed', 'approved'].includes(s);

  return (
    <PageShell title="Payroll Runs" icon="bi-calendar-check" subtitle="Manage monthly payroll run lifecycle: compute, preview, approve, lock, pay and post" onNavigate={onNavigate} actions={
      <>
        <button className="btn btn-sm btn-outline-secondary" onClick={load}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>
        {manager && <button className="btn btn-sm btn-primary" onClick={() => setShowForm(true)}><i className="bi bi-plus-lg me-1"></i>New Payroll Run</button>}
      </>
    }>
      <ErrorBox message={error} onRetry={load} />

      {manager && showForm && (
        <div className="card mb-3">
          <div className="card-header"><h6 className="mb-0">New Payroll Run</h6></div>
          <div className="card-body">
            <form onSubmit={submit} className="row g-2">
              <div className="col-md-3"><label className="form-label small">Period Start *</label><input type="date" className="form-control form-control-sm" value={form.period_start} onChange={e => setForm({...form, period_start: e.target.value})} required /></div>
              <div className="col-md-3"><label className="form-label small">Period End *</label><input type="date" className="form-control form-control-sm" value={form.period_end} onChange={e => setForm({...form, period_end: e.target.value})} required /></div>
              <div className="col-md-3"><label className="form-label small">Period Name (e.g. 2026-11)</label><input type="text" className="form-control form-control-sm" value={form.period_name} onChange={e => setForm({...form, period_name: e.target.value})} /></div>
              <div className="col-md-2"><label className="form-label small">Basis Days</label><input type="number" className="form-control form-control-sm" value={form.basis_days} onChange={e => setForm({...form, basis_days: Number(e.target.value)})} /></div>
              <div className="col-md-2"><label className="form-label small">Wage Base Days</label><input type="number" className="form-control form-control-sm" value={form.wage_base_days} onChange={e => setForm({...form, wage_base_days: Number(e.target.value)})} /></div>
              <div className="col-12 d-flex gap-2 mt-3">
                <button type="submit" className="btn btn-sm btn-primary">Create</button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? <Loading /> : !runs.length ? (
        <div className="text-center py-5"><i className="bi bi-calendar-check d-block mb-2 text-muted" style={{fontSize: 48}}></i><h5 className="fw-bold">No payroll runs</h5><p className="text-muted small">Create your first payroll run to get started.</p></div>
      ) : (
        <div className="table-responsive"><table className="table table-sm align-middle mb-0">
          <thead><tr><th>Period</th><th>Name</th><th>Basis/Wage Days</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
          <tbody>
            {runs.map(r => (
              <tr key={r.id}>
                <td>{fmtDate(r.period_start)} Ã¢â‚¬â€œ {fmtDate(r.period_end)}</td>
                <td className="fw-semibold">{r.period_name}</td>
                <td>{r.basis_days} / {r.wage_base_days}</td>
                <td><Badge tone={PAYROLL_STATUS_TONE[r.status] || 'secondary'}>{r.status}</Badge></td>
                <td className="text-end">
                  {canWizard(r.status) && <button className="btn btn-sm btn-outline-primary" onClick={() => onNavigate(`/school/hr/payroll/runs/${r.id}/wizard`)}>Wizard</button>}
                  {canPreview(r.status) && <button className="btn btn-sm btn-outline-info ms-1" onClick={() => onNavigate(`/school/hr/payroll/runs/${r.id}`)}>View</button>}
                  {canCompute(r.status) && <button className="btn btn-sm btn-success ms-1" onClick={() => compute(r.id)}>Compute</button>}
                  {canApprove(r.status) && <button className="btn btn-sm btn-warning ms-1" onClick={() => approve(r.id)}>Approve</button>}
                  {canLock(r.status) && <button className="btn btn-sm btn-primary ms-1" onClick={() => lock(r.id)}>Lock</button>}
                  {canUnlock(r.status) && <button className="btn btn-sm btn-outline-warning ms-1" onClick={async () => { try { const res = await apiPost(`/school/hr/payroll/runs/${r.id}/unlock`, {}); if (res?.ok) { toast('Unlocked', 'success'); load(); } else throw new Error(res?.error); } catch (e) { toast(e.message, 'error'); } }}>Unlock</button>}
                  {canMarkPaid(r.status) && <button className="btn btn-sm btn-success ms-1" onClick={() => markPaid(r.id)}>Mark Paid</button>}
                  {canPost(r.status) && <button className="btn btn-sm btn-primary ms-1" onClick={() => postToAccounts(r.id)}>Post to Accounts</button>}
                  {canCancel(r.status) && <button className="btn btn-sm btn-outline-danger ms-1" onClick={() => cancelRun(r.id)}>Cancel</button>}
                  {canDelete(r.status) && <button className="btn btn-sm btn-outline-danger ms-1" onClick={async () => { if (window.confirm('Delete this run?')) try { const res = await apiPost(`/school/hr/payroll/runs/${r.id}/delete`, {}); if (res?.ok) { toast('Deleted', 'success'); load(); } else throw new Error(res?.error); } catch (e) { toast(e.message, 'error'); } }}>Delete</button>}
                  <button className="btn btn-sm btn-outline-secondary ms-1" onClick={async () => { try { const res = await apiPost(`/school/hr/payroll/runs/${r.id}/payslips/generate`, {}); if (res?.ok) toast(`Generated ${res.generated} payslip PDFs`, 'success'); else throw new Error(res?.error); } catch (e) { toast(e.message, 'error'); } }}>Gen PDFs</button>
                  <button className="btn btn-sm btn-outline-secondary ms-1" onClick={() => onNavigate(`/school/hr/payroll/bank-advice?run_id=${r.id}`)}>Bank Advice</button>
                  <button className="btn btn-sm btn-outline-secondary ms-1" onClick={() => onNavigate(`/school/hr/payroll/register?run_id=${r.id}`)}>Salary Register</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </PageShell>
  );
}
