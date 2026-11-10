import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

const EMPTY_FORM = { name: '', code: '', channel: 'sms', subject: '', bodyText: '', bodyHtml: '', description: '', language: 'en', variables: '', isActive: true };

export default function CommunicationTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [channelFilter, setChannelFilter] = useState('');

  useEffect(() => { loadTemplates(); }, [channelFilter]);

  async function loadTemplates() {
    setLoading(true);
    try {
      const d = await apiGet(`/school/communication/templates${channelFilter ? `?channel=${channelFilter}` : ''}`);
      if (d?.ok) setTemplates(d.templates || []);
      else toast(d?.error || 'Failed to load templates', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name?.trim()) return toast('Name is required', 'error');
    const payload = {
      ...form,
      variables: form.variables ? form.variables.split(',').map(v => v.trim()).filter(Boolean) : []
    };
    try {
      const res = editingId
        ? await apiPut(`/school/communication/templates/${editingId}`, payload)
        : await apiPost('/school/communication/templates', payload);
      if (res?.ok) {
        toast(editingId ? 'Template updated' : 'Template created', 'success');
        setShowForm(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
        loadTemplates();
      } else toast(res?.error || 'Save failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  function editTemplate(t) {
    setEditingId(t.id);
    setForm({
      name: t.name || '',
      code: t.code || '',
      channel: t.channel || 'sms',
      subject: t.subject || '',
      bodyText: t.body_text || '',
      bodyHtml: t.body_html || '',
      description: t.description || '',
      language: t.language || 'en',
      variables: Array.isArray(t.variables) ? t.variables.join(', ') : '',
      isActive: Boolean(t.is_active)
    });
    setShowForm(true);
  }

  async function deleteTemplate(id) {
    if (!window.confirm('Delete this template?')) return;
    try {
      const res = await apiDelete(`/school/communication/templates/${id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadTemplates(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <PageShell title="Message Templates" icon="bi-file-earmark-text" subtitle={`${templates.length} templates`}>
      <div className="d-flex gap-2 mb-3">
        <button className="btn btn-sm btn-primary" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); }}>
          <i className="bi bi-plus"></i> New Template
        </button>
        <select className="form-select form-select-sm" style={{ width: 160 }} value={channelFilter} onChange={e => setChannelFilter(e.target.value)}>
          <option value="">All channels</option>
          <option value="sms">SMS</option><option value="email">Email</option>
          <option value="push">Push</option><option value="notice">Notice</option>
        </select>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>{editingId ? 'Edit Template' : 'New Template'}</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>Name *<input className="form-control form-control-sm" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></label>
            <label>Channel<select className="form-select form-select-sm" value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })}>
              <option value="sms">SMS</option><option value="email">Email</option><option value="push">Push</option><option value="notice">Notice</option>
            </select></label>
            <label>Code<input className="form-control form-control-sm" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="Auto-generated if blank" disabled={Boolean(editingId)} /></label>
            <label>Language<input className="form-control form-control-sm" value={form.language} onChange={e => setForm({ ...form, language: e.target.value })} /></label>
            <label className="span-2">Subject<input className="form-control form-control-sm" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></label>
            <label className="span-2">Body *<textarea className="form-control form-control-sm" rows="4" value={form.bodyText} onChange={e => setForm({ ...form, bodyText: e.target.value })} required placeholder="Use {{student_name}}, {{parent_name}}, etc." /></label>
            <label className="span-2">HTML Body<textarea className="form-control form-control-sm" rows="2" value={form.bodyHtml} onChange={e => setForm({ ...form, bodyHtml: e.target.value })} /></label>
            <label>Variables<input className="form-control form-control-sm" value={form.variables} onChange={e => setForm({ ...form, variables: e.target.value })} placeholder="student_name, parent_name" /></label>
            <label>Description<input className="form-control form-control-sm" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
            <label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} /> Active</label>
            <div className="span-2 d-flex gap-2">
              <button className="btn btn-sm btn-primary" type="submit"><i className="bi bi-check"></i> {editingId ? 'Save' : 'Create'}</button>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Name</th><th>Channel</th><th>Subject</th><th>Body</th><th>Active</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7}><Loading /></td></tr> :
            templates.length === 0 ? <tr><td colSpan={7}><Empty text="No templates yet" icon="bi-file-earmark-text" /></td></tr> :
            templates.map(t => (
              <tr key={t.id}>
                <td><strong>{t.name}</strong>{t.code ? <div className="text-muted small">{t.code}</div> : null}</td>
                <td><Badge status={t.channel}>{t.channel}</Badge></td>
                <td>{t.subject || '—'}</td>
                <td style={{ maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.body_text || '—'}</td>
                <td>{t.is_active ? 'Yes' : 'No'}</td>
                <td>{t.created_at ? fmtDate(t.created_at) : '—'}</td>
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
