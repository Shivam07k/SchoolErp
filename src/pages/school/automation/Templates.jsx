import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate, downloadCsv } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

const CHANNELS = ['sms', 'email', 'push', 'in_app', 'webhook'];

export default function AutomationTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: '', code: '', channel: 'sms', subject: '', body_text: '', body_html: '',
    variables: '', webhook_url: '', webhook_method: 'POST', webhook_headers: '', isActive: true
  });
  const [channelFilter, setChannelFilter] = useState('');

  useEffect(() => { loadTemplates(); }, [channelFilter]);

  async function loadTemplates() {
    setLoading(true);
    try {
      const d = await apiGet(`/school/automation/templates${channelFilter ? `?channel=${channelFilter}` : ''}`);
      if (d?.ok) setTemplates(d.templates || []);
      else toast(d?.error || 'Failed to load', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name?.trim() || !form.channel) return toast('Name and channel required', 'error');
    const payload = {
      ...form,
      variables: form.variables ? form.variables.split(',').map(v => v.trim()).filter(Boolean) : [],
      webhook_headers: form.webhook_headers ? JSON.parse(form.webhook_headers) : {}
    };
    try {
      const res = editingId
        ? await apiPut(`/school/automation/templates/${editingId}`, payload)
        : await apiPost('/school/automation/templates', payload);
      if (res?.ok) {
        toast(editingId ? 'Template updated' : 'Template created', 'success');
        setShowForm(false);
        setEditingId(null);
        setForm({ name: '', code: '', channel: 'sms', subject: '', body_text: '', body_html: '', variables: '', webhook_url: '', webhook_method: 'POST', webhook_headers: '', isActive: true });
        loadTemplates();
      } else toast(res?.error || 'Save failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  function editTemplate(t) {
    setEditingId(t.id);
    setForm({
      name: t.name || '', code: t.code || '', channel: t.channel || 'sms',
      subject: t.subject || '', body_text: t.body_text || '', body_html: t.body_html || '',
      variables: Array.isArray(t.variables) ? t.variables.join(', ') : '',
      webhook_url: t.webhook_url || '', webhook_method: t.webhook_method || 'POST',
      webhook_headers: t.webhook_headers ? JSON.stringify(t.webhook_headers, null, 2) : '',
      isActive: Boolean(t.is_active)
    });
    setShowForm(true);
  }

  async function deleteTemplate(id) {
    if (!window.confirm('Delete this template?')) return;
    try {
      const res = await apiDelete(`/school/automation/templates/${id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadTemplates(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <PageShell title="Message Templates" icon="bi-file-earmark-text" subtitle={`${templates.length} templates`}>
      <div className="d-flex gap-2 mb-3">
        <button className="btn btn-primary" onClick={() => { setEditingId(null); setForm({ name: '', code: '', channel: 'sms', subject: '', body_text: '', body_html: '', variables: '', webhook_url: '', webhook_method: 'POST', webhook_headers: '', isActive: true }); setShowForm(true); }}><i className="bi bi-plus"></i> New Template</button>
        <select className="form-select form-select-sm" style={{ width: 160 }} value={channelFilter} onChange={e => setChannelFilter(e.target.value)}>
          <option value="">All channels</option>
          {CHANNELS.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
        </select>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>{editingId ? 'Edit Template' : 'New Template'}</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>Name *<input className="form-control form-control-sm" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></label>
            <label>Channel<select className="form-select form-select-sm" value={form.channel} onChange={e => setForm({...form, channel: e.target.value})} disabled={Boolean(editingId)}>
              {CHANNELS.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
            </select></label>
            <label>Code<input className="form-control form-control-sm" value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="Auto-generated" disabled={Boolean(editingId)} /></label>
            <label className="span-2">Subject<input className="form-control form-control-sm" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} placeholder="For email/push" /></label>
            <label className="span-2">Body (Text) *<textarea className="form-control form-control-sm" rows="4" value={form.body_text} onChange={e => setForm({...form, body_text: e.target.value})} required placeholder="Use {{variable_name}} for placeholders" /></label>
            <label className="span-2">Body (HTML)<textarea className="form-control form-control-sm" rows="2" value={form.body_html} onChange={e => setForm({...form, body_html: e.target.value})} placeholder="For email channel" /></label>
            <label>Variables (comma-separated)<input className="form-control form-control-sm" value={form.variables} onChange={e => setForm({...form, variables: e.target.value})} placeholder="parent_name, student_name, amount" /></label>
            <label>Webhook URL<input className="form-control form-control-sm" value={form.webhook_url} onChange={e => setForm({...form, webhook_url: e.target.value})} placeholder="For webhook channel" /></label>
            <label>Webhook Method<select className="form-select form-select-sm" value={form.webhook_method} onChange={e => setForm({...form, webhook_method: e.target.value})}>
              <option value="POST">POST</option><option value="GET">GET</option><option value="PUT">PUT</option>
            </select></label>
            <label className="span-2">Webhook Headers (JSON)<textarea className="form-control form-control-sm" rows="2" value={form.webhook_headers} onChange={e => setForm({...form, webhook_headers: e.target.value})} placeholder='{"Authorization": "Bearer token"}' /></label>
            <label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input" checked={form.isActive} onChange={e => setForm({...form, isActive: e.target.checked})} /> Active</label>
            <div className="span-2 d-flex gap-2">
              <button className="btn btn-primary" type="submit"><i className="bi bi-check"></i> {editingId ? 'Save' : 'Create'}</button>
              <button className="btn btn-outline-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Name</th><th>Channel</th><th>Subject</th><th>Body Preview</th><th>System</th><th>Active</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8}><Loading /></td></tr> :
            templates.length === 0 ? <tr><td colSpan={8}><Empty text="No templates yet" /></td></tr> :
            templates.map(t => (
              <tr key={t.id}>
                <td><strong>{t.name}</strong>{t.code && <div className="text-muted small">{t.code}</div>}</td>
                <td><Badge status={t.channel}>{t.channel.toUpperCase()}</Badge></td>
                <td>{t.subject || '—'}</td>
                <td style={{ maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.body_text || '—'}</td>
                <td>{t.is_system ? 'Yes' : 'No'}</td>
                <td>{t.is_active ? 'Yes' : 'No'}</td>
                <td>{fmtDate(t.created_at)}</td>
                <td className="text-end no-print">
                  {!t.is_system && <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editTemplate(t)}><i className="bi bi-pencil"></i></button>}
                  {!t.is_system && <button className="btn btn-sm btn-outline-danger" onClick={() => deleteTemplate(t.id)}><i className="bi bi-trash"></i></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}