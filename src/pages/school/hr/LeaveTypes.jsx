import React, { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, ErrorBox, Badge, canManageHR, fmtDate } from './shared';

export default function LeaveTypes({ me, onNavigate }) {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', is_paid: true, half_day_allowed: true, document_required_after_days: 3, requires_approval: true, approval_roles: [], is_active: true, sort_order: 0 });
  const [editingId, setEditingId] = useState(null);
  const manager = canManageHR(me);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const d = await apiGet('/school/hr/leave/types');
      if (d?.ok) setTypes(d.types || []);
      else throw new Error(d?.error || 'Failed to load types');
    } catch (err) { setError(err.message || 'Failed to load types'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function resetForm() { setForm({ name: '', code: '', is_paid: true, half_day_allowed: true, document_required_after_days: 3, requires_approval: true, approval_roles: [], is_active: true, sort_order: 0 }); setEditingId(null); setShowForm(false); }

  async function submit(e) {
    e.preventDefault();
    try {
      if (editingId) {
        const res = await apiPut(`/school/hr/leave/types/${editingId}`, form);
        if (!res?.ok) throw new Error(res?.error || 'Failed to update');
        toast('Leave type updated', 'success');
      } else {
        const res = await apiPost('/school/hr/leave/types', form);
        if (!res?.ok) throw new Error(res?.error || 'Failed to create');
        toast('Leave type created', 'success');
      }
      resetForm();
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function remove(id) {
    if (!window.confirm('Delete this leave type?')) return;
    try {
      const res = await apiPost(`/school/hr/leave/types/${id}/delete`, {});
      if (!res?.ok) throw new Error(res?.error || 'Failed to delete');
      toast('Leave type deleted', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <PageShell title="Leave Types" icon="bi-calendar-x" subtitle="Configure leave types, codes, accrual rules, carry forward and encashment settings" onNavigate={onNavigate} actions={
      <>
        <button className="btn btn-sm btn-outline-secondary" onClick={load}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>
        {manager && <button className="btn btn-sm btn-primary" onClick={() => { resetForm(); setShowForm(true); }}><i className="bi bi-plus-lg me-1"></i>New Type</button>}
      </>
    }>
      <ErrorBox message={error} onRetry={load} />

      {showForm && manager && (
        <div className="card mb-3">
          <div className="card-header"><h6 className="mb-0">{editingId ? 'Edit' : 'Create'} Leave Type</h6></div>
          <div className="card-body">
            <form onSubmit={submit} className="row g-2">
              <div className="col-md-4"><label className="form-label small">Name *</label><input className="form-control form-control-sm" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
              <div className="col-md-2"><label className="form-label small">Code *</label><input className="form-control form-control-sm" value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} required /></div>
              <div className="col-md-2"><label className="form-label small">Sort Order</label><input type="number" className="form-control form-control-sm" value={form.sort_order} onChange={e => setForm({...form, sort_order: Number(e.target.value)})} /></div>
              <div className="col-md-2"><div className="form-check mt-4"><input type="checkbox" className="form-check-input" id="is_paid" checked={form.is_paid} onChange={e => setForm({...form, is_paid: e.target.checked})} /><label className="form-check-label small" htmlFor="is_paid">Paid</label></div></div>
              <div className="col-md-2"><div className="form-check mt-4"><input type="checkbox" className="form-check-input" id="half_day_allowed" checked={form.half_day_allowed} onChange={e => setForm({...form, half_day_allowed: e.target.checked})} /><label className="form-check-label small" htmlFor="half_day_allowed">Half Day</label></div></div>
              <div className="col-md-3"><label className="form-label small">Doc Required After (days)</label><input type="number" className="form-control form-control-sm" value={form.document_required_after_days} onChange={e => setForm({...form, document_required_after_days: Number(e.target.value)})} /></div>
              <div className="col-md-3"><div className="form-check mt-4"><input type="checkbox" className="form-check-input" id="requires_approval" checked={form.requires_approval} onChange={e => setForm({...form, requires_approval: e.target.checked})} /><label className="form-check-label small" htmlFor="requires_approval">Requires Approval</label></div></div>
              <div className="col-md-3"><div className="form-check mt-4"><input type="checkbox" className="form-check-input" id="is_active" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} /><label className="form-check-label small" htmlFor="is_active">Active</label></div></div>
              <div className="col-12 d-flex gap-2 mt-3">
                <button type="submit" className="btn btn-sm btn-primary">{editingId ? 'Update' : 'Create'}</button>
                {editingId && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetForm}>Cancel</button>}
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-responsive"><table className="table table-sm align-middle mb-0"><thead><tr><th>Name</th><th>Code</th><th>Paid</th><th>Half Day</th><th>Doc After (days)</th><th>Approval</th><th>Active</th><th>Sort</th><th className="text-end">Actions</th></tr></thead><tbody>
        {types.map(t => (
          <tr key={t.id}>
            <td className="fw-semibold">{t.name}</td>
            <td><Badge tone="info">{t.code}</Badge></td>
            <td>{t.is_paid ? <Badge tone="success">Yes</Badge> : <Badge tone="secondary">No</Badge>}</td>
            <td>{t.half_day_allowed ? <Badge tone="success">Yes</Badge> : <Badge tone="secondary">No</Badge>}</td>
            <td>{t.document_required_after_days}</td>
            <td>{t.requires_approval ? <Badge tone="warning">Required</Badge> : <Badge tone="success">Auto</Badge>}</td>
            <td>{t.is_active ? <Badge tone="success">Yes</Badge> : <Badge tone="secondary">No</Badge>}</td>
            <td>{t.sort_order}</td>
            <td className="text-end">
              {manager && <button className="btn btn-sm btn-outline-primary" onClick={() => { setForm(t); setEditingId(t.id); setShowForm(true); }}>Edit</button>}
              {manager && <button className="btn btn-sm btn-outline-danger ms-1" onClick={() => remove(t.id)}>Delete</button>}
            </td>
          </tr>
        ))}
      </tbody></table></div>
    </PageShell>
  );
}
