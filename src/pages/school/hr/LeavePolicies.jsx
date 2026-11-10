import React, { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, ErrorBox, Badge, canManageHR, fmtDate } from './shared';

export default function LeavePolicies({ me, onNavigate }) {
  const [policies, setPolicies] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ leave_type_id: '', staff_category: 'permanent', yearly_quota: 0, accrual_frequency: 'monthly', rules: {} });
  const [editingId, setEditingId] = useState(null);
  const manager = canManageHR(me);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [p, t] = await Promise.all([
        apiGet('/school/hr/leave/policies'),
        apiGet('/school/hr/leave/types'),
      ]);
      if (p?.ok) setPolicies(p.policies || []);
      if (t?.ok) setTypes(t.types || []);
      else throw new Error('Failed to load');
    } catch (err) { setError(err.message || 'Failed to load policies'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function resetForm() { setForm({ leave_type_id: '', staff_category: 'permanent', yearly_quota: 0, accrual_frequency: 'monthly', rules: {} }); setEditingId(null); setShowForm(false); }

  async function submit(e) {
    e.preventDefault();
    try {
      if (editingId) {
        const res = await apiPut(`/school/hr/leave/policies/${editingId}`, form);
        if (!res?.ok) throw new Error(res?.error || 'Failed to update');
        toast('Policy updated', 'success');
      } else {
        const res = await apiPost('/school/hr/leave/policies', form);
        if (!res?.ok) throw new Error(res?.error || 'Failed to create');
        toast('Policy created', 'success');
      }
      resetForm();
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function remove(id) {
    if (!window.confirm('Delete this policy?')) return;
    try {
      const res = await apiPost(`/school/hr/leave/policies/${id}/delete`, {});
      if (!res?.ok) throw new Error(res?.error || 'Failed to delete');
      toast('Policy deleted', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <PageShell title="Leave Policies" icon="bi-file-earmark-rule" subtitle="Define leave policies per type and staff category with quotas and accrual rules" onNavigate={onNavigate} actions={
      <>
        <button className="btn btn-sm btn-outline-secondary" onClick={load}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>
        {manager && <button className="btn btn-sm btn-primary" onClick={() => { resetForm(); setShowForm(true); }}><i className="bi bi-plus-lg me-1"></i>New Policy</button>}
      </>
    }>
      <ErrorBox message={error} onRetry={load} />

      {showForm && manager && (
        <div className="card mb-3">
          <div className="card-header"><h6 className="mb-0">{editingId ? 'Edit' : 'Create'} Policy</h6></div>
          <div className="card-body">
            <form onSubmit={submit} className="row g-2">
              <div className="col-md-3"><label className="form-label small">Leave Type *</label><select className="form-select form-select-sm" value={form.leave_type_id} onChange={e => setForm({...form, leave_type_id: e.target.value})} required><option value="">Select Type</option>{types.map(t => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}</select></div>
              <div className="col-md-3"><label className="form-label small">Staff Category *</label><select className="form-select form-select-sm" value={form.staff_category} onChange={e => setForm({...form, staff_category: e.target.value})} required><option value="permanent">Permanent</option><option value="contract">Contract</option><option value="part_time">Part-time</option><option value="visiting">Visiting</option></select></div>
              <div className="col-md-2"><label className="form-label small">Yearly Quota *</label><input type="number" step="0.5" className="form-control form-control-sm" value={form.yearly_quota} onChange={e => setForm({...form, yearly_quota: Number(e.target.value)})} required /></div>
              <div className="col-md-2"><label className="form-label small">Accrual Frequency</label><select className="form-select form-select-sm" value={form.accrual_frequency} onChange={e => setForm({...form, accrual_frequency: e.target.value})}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option><option value="on_join">On Join</option></select></div>
              <div className="col-12 d-flex gap-2 mt-3">
                <button type="submit" className="btn btn-sm btn-primary">{editingId ? 'Update' : 'Create'}</button>
                {editingId && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetForm}>Cancel</button>}
              </div>
            </form>
          </div>
        </div>
      )}

      {!policies.length ? <Empty icon="bi-file-earmark-rule" text="No leave policies configured." /> : (
        <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Leave Type</th><th>Category</th><th className="text-end">Quota</th><th>Accrual</th><th>Rules</th><th className="text-end">Actions</th></tr></thead><tbody>
          {policies.map(p => (
            <tr key={p.id}>
              <td>{p.type_name} <Badge tone="info">{p.type_code}</Badge></td>
              <td>{p.staff_category}</td>
              <td className="text-end">{p.yearly_quota}</td>
              <td>{p.accrual_frequency}</td>
              <td className="small">{JSON.stringify(p.rules || {})}</td>
              <td className="text-end">
                {manager && <button className="btn btn-sm btn-outline-primary" onClick={() => { setForm(p); setEditingId(p.id); setShowForm(true); }}>Edit</button>}
                {manager && <button className="btn btn-sm btn-outline-danger ms-1" onClick={() => remove(p.id)}>Delete</button>}
              </td>
            </tr>
          ))}
        </tbody></table></div>
      )}
    </PageShell>
  );
}
