import React, { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, ErrorBox, canManage, fmtDate, downloadCsv } from './shared';

export default function FeeHeads({ me, onNavigate }) {
  const [heads, setHeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', type: 'tuition', isTaxable: false, taxRate: 0, incomeAccountId: '', isRefundable: false, isActive: true, sortOrder: 0 });
  const [editingId, setEditingId] = useState(null);
  const manager = (me?.isSuper || me?.permissions?.includes('*') || me?.permissions?.includes('fee.manage'));

  async function load() {
    setLoading(true);
    setError('');
    try {
      const d = await (await fetch('/api/school/fee/heads', { headers: { Authorization: `Bearer ${localStorage.getItem('xerp_token')}` } })).json();
      if (d?.ok) setHeads(d.heads || []);
      else throw new Error(d?.error || 'Failed to load heads');
    } catch (err) {
      setError(err.message || 'Failed to load heads');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function resetForm() { setForm({ name: '', type: 'tuition', isTaxable: false, taxRate: 0, incomeAccountId: '', isRefundable: false, isActive: true, sortOrder: 0 }); setEditingId(null); }

  async function submit(e) {
    e.preventDefault();
    try {
      if (editingId) {
        await fetch(`/api/school/fee/heads/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('xerp_token')}` }, body: JSON.stringify(form) });
        toast('Head updated', 'success');
      } else {
        await fetch('/api/school/fee/heads', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('xerp_token')}` }, body: JSON.stringify(form) });
        toast('Head created', 'success');
      }
      resetForm();
      load();
    } catch (err) { toast(err.message || 'Failed to save head', 'error'); }
  }

  async function remove(id) {
    if (!window.confirm('Delete this head?')) return;
    try {
      await fetch(`/api/school/fee/heads/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('xerp_token')}` } });
      toast('Head deleted', 'success');
      load();
    } catch (err) { toast(err.message || 'Failed to delete head', 'error'); }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={load} />;

  return (
    <PageShell
      title="Fee Heads"
      icon="bi-tag"
      subtitle="Define fee heads with income account mapping"
      onNavigate={onNavigate}
      actions={
        <button className="btn btn-sm btn-primary" onClick={resetForm}>
          <i className="bi bi-plus-lg me-1"></i>New Head
        </button>
      }
    >
      <ErrorBox message={error} onRetry={load} />
      <div className="row g-3 mb-4">
        <div className="col-lg-4">
          <div className="border rounded p-3">
            <h6 className="fw-bold mb-3">{editingId ? 'Edit Head' : 'Create Head'}</h6>
            <form onSubmit={submit}>
              <div className="mb-2"><label className="form-label small">Name *</label><input className="form-control form-control-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="mb-2"><label className="form-label small">Type *</label><select className="form-select form-select-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required>
                <option value="tuition">Tuition</option>
                <option value="transport">Transport</option>
                <option value="hostel">Hostel</option>
                <option value="exam">Exam</option>
                <option value="admission">Admission</option>
                <option value="deposit">Deposit</option>
                <option value="other">Other</option>
              </select></div>
              <div className="mb-2"><label className="form-label small">Taxable</label><div className="form-check"><input type="checkbox" className="form-check-input" checked={form.isTaxable} onChange={(e) => setForm({ ...form, isTaxable: e.target.checked })} id="isTaxable" /><label className="form-check-label small" htmlFor="isTaxable">Taxable</label></div></div>
              <div className="mb-2"><label className="form-label small">Tax Rate %</label><input type="number" step="0.01" min="0" className="form-control form-control-sm" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) })} /></div>
              <div className="mb-2"><label className="form-label small">Income Account</label><select className="form-select form-select-sm" value={form.incomeAccountId} onChange={(e) => setForm({ ...form, incomeAccountId: e.target.value })}><option value="">Select account</option></select></div>
              <div className="mb-2"><div className="form-check"><input type="checkbox" className="form-check-input" checked={form.isRefundable} onChange={(e) => setForm({ ...form, isRefundable: e.target.checked })} id="isRefundable" /><label className="form-check-label small" htmlFor="isRefundable">Refundable</label></div></div>
              <div className="mb-2"><div className="form-check"><input type="checkbox" className="form-check-input" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} id="isActive" /><label className="form-check-label small" htmlFor="isActive">Active</label></div></div>
              <div className="mb-2"><label className="form-label small">Sort Order</label><input type="number" className="form-control form-control-sm" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></div>
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-sm btn-primary">{editingId ? 'Update' : 'Create'}</button>
                {editingId && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetForm}>Cancel</button>}
              </div>
            </form>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="border rounded">
            <div className="px-3 py-2 border-bottom d-flex justify-content-between align-items-center">
              <span className="fw-semibold small">Fee Heads</span>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => downloadCsv('fee-heads.csv', [
                { label: 'Name', key: 'name' },
                { label: 'Type', key: 'type' },
                { label: 'Taxable', value: (r) => r.is_taxable ? 'Yes' : 'No' },
                { label: 'Tax Rate', key: 'tax_rate' },
                { label: 'Refundable', value: (r) => r.is_refundable ? 'Yes' : 'No' },
                { label: 'Active', value: (r) => r.is_active ? 'Yes' : 'No' },
                { label: 'Sort', key: 'sort_order' },
              ], heads)} disabled={!heads.length}>
                <i className="bi bi-download me-1"></i>CSV
              </button>
            </div>
            {heads.length === 0 ? <Empty icon="bi-tag" text="No fee heads defined yet." /> : (
              <div className="table-responsive">
                <table className="table table-sm mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Taxable</th>
                      <th>Tax %</th>
                      <th>Refundable</th>
                      <th>Active</th>
                      <th>Sort</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {heads.map((h) => (
                      <tr key={h.id}>
                        <td className="fw-semibold">{h.name}</td>
                        <td><span className="badge bg-info">{h.type}</span></td>
                        <td>{h.is_taxable ? 'Yes' : 'No'}</td>
                        <td>{h.tax_rate}%</td>
                        <td>{h.is_refundable ? 'Yes' : 'No'}</td>
                        <td>{h.is_active ? <span className="badge bg-success">Yes</span> : <span className="badge bg-secondary">No</span>}</td>
                        <td>{h.sort_order}</td>
                        <td className="text-end">
                          <div className="btn-group btn-group-sm">
                            <button className="btn btn-outline-primary" onClick={() => { setForm(h); setEditingId(h.id); }}>Edit</button>
                            <button className="btn btn-outline-danger" onClick={() => remove(h.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
