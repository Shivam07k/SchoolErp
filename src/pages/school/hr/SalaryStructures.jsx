import React, { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, ErrorBox, Badge, canManageHR, fmtDate } from './shared';

export default function SalaryStructures({ me, onNavigate }) {
  const [structures, setStructures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', version: 1, effective_from: '', effective_to: '', description: '' });
  const [editingId, setEditingId] = useState(null);
  const manager = canManageHR(me);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const d = await apiGet('/school/hr/payroll/structures');
      if (d?.ok) setStructures(d.structures || []);
      else throw new Error(d?.error || 'Failed to load');
    } catch (err) { setError(err.message || 'Failed to load'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function resetForm() { setForm({ name: '', version: 1, effective_from: '', effective_to: '', description: '' }); setEditingId(null); setShowForm(false); }

  async function submit(e) {
    e.preventDefault();
    try {
      const body = { ...form, version: Number(form.version) || 1, effective_from: form.effective_from || null, effective_to: form.effective_to || null };
      if (editingId) {
        const res = await apiPut(`/school/hr/payroll/structures/${editingId}`, body);
        if (!res?.ok) throw new Error(res?.error || 'Failed to update');
        toast('Structure updated', 'success');
      } else {
        const res = await apiPost('/school/hr/payroll/structures', body);
        if (!res?.ok) throw new Error(res?.error || 'Failed to create');
        toast('Structure created', 'success');
      }
      resetForm();
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function cloneStruct(id) {
    if (!window.confirm('Clone this structure?')) return;
    try {
      const res = await apiPost(`/school/hr/payroll/structures/${id}/clone`, { name: '' });
      if (!res?.ok) throw new Error(res?.error || 'Failed to clone');
      toast('Structure cloned', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function remove(id) {
    if (!window.confirm('Delete this structure?')) return;
    try {
      const res = await apiPost(`/school/hr/payroll/structures/${id}/delete`, {});
      if (!res?.ok) throw new Error(res?.error || 'Failed to delete');
      toast('Structure deleted', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <PageShell title="Salary Structures" icon="bi-diagram-3" subtitle="Create and manage salary structures with versioning and effective dates" onNavigate={onNavigate} actions={
      <>
        <button className="btn btn-sm btn-outline-secondary" onClick={load}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>
        {canManageHR(me) && <button className="btn btn-sm btn-primary" onClick={() => { setForm({ name: '', version: 1, effective_from: '', effective_to: '', description: '' }); setEditingId(null); setShowForm(true); }}><i className="bi bi-plus-lg me-1"></i>New Structure</button>}
      </>
    }>
      <ErrorBox message={error} onRetry={load} />

      {canManageHR(me) && showForm && (
        <div className="card mb-3">
          <div className="card-header"><h6 className="mb-0">{editingId ? 'Edit' : 'Create'} Structure</h6></div>
          <div className="card-body">
            <form onSubmit={submit} className="row g-2">
              <div className="col-md-4"><label className="form-label small">Name *</label><input className="form-control form-control-sm" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
              <div className="col-md-2"><label className="form-label small">Version *</label><input type="number" className="form-control form-control-sm" value={form.version} onChange={e => setForm({...form, version: Number(e.target.value)})} required /></div>
              <div className="col-md-3"><label className="form-label small">Effective From *</label><input type="date" className="form-control form-control-sm" value={form.effective_from} onChange={e => setForm({...form, effective_from: e.target.value})} required /></div>
              <div className="col-md-3"><label className="form-label small">Effective To</label><input type="date" className="form-control form-control-sm" value={form.effective_to} onChange={e => setForm({...form, effective_to: e.target.value})} /></div>
              <div className="col-md-8"><label className="form-label small">Description</label><input className="form-control form-control-sm" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
              <div className="col-12 d-flex gap-2 mt-3">
                <button type="submit" className="btn btn-sm btn-primary">{editingId ? 'Update' : 'Create'}</button>
                {editingId && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setForm({ name: '', version: 1, effective_from: '', effective_to: '', description: '' }); setEditingId(null); setShowForm(false); }}>Cancel</button>}
              </div>
            </form>
          </div>
        </div>
      )}

      {!structures.length ? <div className="text-center py-5"><i className="bi bi-diagram-3 d-block mb-2 text-muted" style={{fontSize: 48}}></i><h5 className="fw-bold">No salary structures defined</h5><p className="text-muted small">Create your first salary structure to get started.</p></div> : (
        <div className="table-responsive"><table className="table table-sm align-middle mb-0"><thead><tr><th>Name</th><th>Version</th><th>Effective From</th><th>Effective To</th><th>Active</th><th className="text-end">Actions</th></tr></thead><tbody>
          {structures.map(s => (
            <tr key={s.id}>
              <td className="fw-semibold">{s.name}</td>
              <td>v{s.version}</td>
              <td>{fmtDate(s.effective_from)}</td>
              <td>{fmtDate(s.effective_to)}</td>
              <td>{s.is_active ? <Badge tone="success">Yes</Badge> : <Badge tone="secondary">No</Badge>}</td>
              <td className="text-end">
                {canManageHR(me) && <button className="btn btn-sm btn-outline-primary" onClick={() => { setForm(s); setEditingId(s.id); setShowForm(true); }}>Edit</button>}
                {canManageHR(me) && <button className="btn btn-sm btn-outline-info ms-1" onClick={() => cloneStruct(s.id)}>Clone</button>}
                {canManageHR(me) && <button className="btn btn-sm btn-outline-danger ms-1" onClick={() => remove(s.id)}>Delete</button>}
              </td>
            </tr>
          ))}
        </tbody></table></div>
      )}
    </PageShell>
  );
}
