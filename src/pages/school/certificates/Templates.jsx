import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

export default function CertificatesTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'tc', category: '', status: 'active' });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setLoading(true);
    try {
      const d = await apiGet('/school/certificates/templates');
      if (d?.ok) setTemplates(d.templates || []);
      else toast(d?.error || 'Failed to load templates', 'error');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name?.trim() || !form.type) return toast('Name and type are required', 'error');
    try {
      const res = editingId
        ? await apiPut(`/school/certificates/templates/${editingId}`, form)
        : await apiPost('/school/certificates/templates', form);
      if (res?.ok) {
        toast(editingId ? 'Template updated' : 'Template created', 'success');
        setShowForm(false);
        setEditingId(null);
        setForm({ name: '', type: 'tc', category: '', status: 'active' });
        loadTemplates();
      } else toast(res?.error || 'Save failed', 'error');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function editTemplate(t) {
    setEditingId(t.id);
    setForm({ name: t.name, type: t.type, category: t.category, status: t.status });
    setShowForm(true);
  }

  async function deleteTemplate(id) {
    if (!window.confirm('Delete this template?')) return;
    try {
      const res = await apiDelete(`/school/certificates/templates/${id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadTemplates(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <PageShell title="Certificate Templates" icon="bi-file-earmark-text" subtitle={`${templates.length} templates`}>
      <div className="d-flex gap-2 mb-3">
        <button className="btn btn-sm btn-primary" onClick={() => { setEditingId(null); setForm({ name: '', type: 'tc', category: '', status: 'active' }); setShowForm(true); }}>
          <i className="bi bi-plus"></i> New Template
        </button>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>{editingId ? 'Edit Template' : 'New Template'}</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>Name *<input className="form-control form-control-sm" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></label>
            <label>Type<select className="form-select form-select-sm" value={form.type} onChange={e => setForm({...form, type: e.target.value})} required>
              <option value="tc">TC Certificate</option><option value="id_front">ID Card Front</option><option value="id_back">ID Card Back</option><option value="bonafide">Bonafide</option><option value="character">Character</option><option value="migration">Migration</option><option value="custom">Custom</option>
            </select></label>
            <label>Category<input className="form-control form-control-sm" value={form.category} onChange={e => setForm({...form, category: e.target.value})} /></label>
            <label>Status<select className="form-select form-select-sm" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
              <option value="active">Active</option><option value="archived">Archived</option>
            </select></label>
            <div className="span-2 d-flex gap-2">
              <button className="btn btn-sm btn-primary" type="submit"><i className="bi bi-check"></i> {editingId ? 'Save' : 'Create'}</button>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Name</th><th>Type</th><th>Category</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="5"><Loading /></td></tr> :
            templates.length === 0 ? <tr><td colSpan="5"><Empty text="No templates yet" icon="bi-file-earmark-text" /></td></tr> :
            templates.map(t => (
              <tr key={t.id}>
                <td><strong>{t.name}</strong></td>
                <td>{t.type}</td>
                <td>{t.category || '—'}</td>
                <td><Badge status={t.status}>{t.status}</Badge></td>
                <td className="text-end no-print">
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editTemplate(t)}><i className="bi bi-pencil"></i></button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => deleteTemplate(t.id)}><i className="bi bi-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}