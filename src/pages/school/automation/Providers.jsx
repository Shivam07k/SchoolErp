import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate, downloadCsv } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

const PROVIDER_TYPES = {
  sms: ['twilio', 'msg91', 'textlocal', 'custom'],
  email: ['sendgrid', 'mailgun', 'smtp', 'custom'],
  push: ['fcm', 'onesignal', 'custom'],
};

export default function AutomationProviders() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: '', code: '', channel: 'sms', provider_type: 'custom', config: {},
    isDefault: false, isActive: true, isTestMode: false
  });

  useEffect(() => { loadProviders(); }, []);

  async function loadProviders() {
    setLoading(true);
    try {
      const d = await apiGet('/school/automation/providers');
      if (d?.ok) setProviders(d.providers || []);
      else toast(d?.error || 'Failed to load', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name?.trim() || !form.channel || !form.provider_type) return toast('Name, channel, and provider type required', 'error');
    let config = form.config;
    if (typeof config === 'string') {
      try { config = JSON.parse(config); } catch { config = {}; }
    }
    const payload = { ...form, config };
    try {
      const res = editingId
        ? await apiPut(`/school/automation/providers/${editingId}`, payload)
        : await apiPost('/school/automation/providers', payload);
      if (res?.ok) {
        toast(editingId ? 'Provider updated' : 'Provider created', 'success');
        setShowForm(false);
        setEditingId(null);
        setForm({ name: '', code: '', channel: 'sms', provider_type: 'custom', config: {}, isDefault: false, isActive: true, isTestMode: false });
        loadProviders();
      } else toast(res?.error || 'Save failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  function editProvider(p) {
    setEditingId(p.id);
    setForm({
      name: p.name || '', code: p.code || '', channel: p.channel || 'sms',
      provider_type: p.provider_type || 'custom', config: p.config || {},
      isDefault: Boolean(p.is_default), isActive: Boolean(p.is_active), isTestMode: Boolean(p.is_test_mode)
    });
    setShowForm(true);
  }

  async function deleteProvider(id) {
    if (!window.confirm('Delete this provider?')) return;
    try {
      const res = await apiDelete(`/school/automation/providers/${id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadProviders(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function testProvider(p) {
    const testTo = window.prompt('Enter test recipient (phone/email/token):');
    if (!testTo) return;
    try {
      const res = await apiPost(`/school/automation/providers/${p.id}/test`, { test_to: testTo });
      if (res?.ok) toast('Test sent', 'success');
      else toast(res?.error || 'Test failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  const channelTypes = (channel) => PROVIDER_TYPES[channel] || ['custom'];

  return (
    <PageShell title="Channel Providers" icon="bi-box-arrow-up-right" subtitle={`${providers.length} providers`}>
      <div className="d-flex gap-2 mb-3">
        <button className="btn btn-primary" onClick={() => { setEditingId(null); setForm({ name: '', code: '', channel: 'sms', provider_type: 'custom', config: {}, isDefault: false, isActive: true, isTestMode: false }); setShowForm(true); }}><i className="bi bi-plus"></i> New Provider</button>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>{editingId ? 'Edit Provider' : 'New Channel Provider'}</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>Name *<input className="form-control form-control-sm" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></label>
            <label>Channel<select className="form-select form-select-sm" value={form.channel} onChange={e => setForm({...form, channel: e.target.value, provider_type: ''})} disabled={Boolean(editingId)}>
              <option value="sms">SMS</option><option value="email">Email</option><option value="push">Push</option>
            </select></label>
            <label>Provider Type<select className="form-select form-select-sm" value={form.provider_type} onChange={e => setForm({...form, provider_type: e.target.value})} disabled={Boolean(editingId)}>
              {channelTypes(form.channel).map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select></label>
            <label>Code<input className="form-control form-control-sm" value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="Auto-generated" disabled={Boolean(editingId)} /></label>
            <label className="span-2">Config (JSON)<textarea className="form-control form-control-sm" rows="6" value={typeof form.config === 'string' ? form.config : JSON.stringify(form.config, null, 2)} onChange={e => { try { setForm({...form, config: JSON.parse(e.target.value)}); } catch { setForm({...form, config: e.target.value}); } }} placeholder='{"account_sid": "", "auth_token": "", "from_number": ""}' /></label>
            <label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input" checked={form.isDefault} onChange={e => setForm({...form, isDefault: e.target.checked})} /> Default for channel</label>
            <label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input" checked={form.isActive} onChange={e => setForm({...form, isActive: e.target.checked})} /> Active</label>
            <label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input" checked={form.isTestMode} onChange={e => setForm({...form, isTestMode: e.target.checked})} /> Test mode</label>
            <div className="span-2 d-flex gap-2">
              <button className="btn btn-primary" type="submit"><i className="bi bi-check"></i> {editingId ? 'Save' : 'Create'}</button>
              <button className="btn btn-outline-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Name</th><th>Channel</th><th>Type</th><th>Default</th><th>Active</th><th>Test Mode</th><th>Last Tested</th><th>Test Status</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={9}><Loading /></td></tr> :
            providers.length === 0 ? <tr><td colSpan={9}><Empty text="No providers yet" /></td></tr> :
            providers.map(p => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong>{p.code && <div className="text-muted small">{p.code}</div>}</td>
                <td><Badge status={p.channel}>{p.channel.toUpperCase()}</Badge></td>
                <td>{p.provider_type}</td>
                <td>{p.is_default ? 'Yes' : 'No'}</td>
                <td>{p.is_active ? 'Yes' : 'No'}</td>
                <td>{p.is_test_mode ? 'Yes' : 'No'}</td>
                <td>{p.last_tested_at ? fmtDate(p.last_tested_at) : '—'}</td>
                <td>{p.test_status ? <Badge status={p.test_status === 'success' ? 'active' : 'failed'}>{p.test_status}</Badge> : '—'}</td>
                <td className="text-end no-print">
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editProvider(p)}><i className="bi bi-pencil"></i></button>
                  <button className="btn btn-sm btn-outline-info me-1" onClick={() => testProvider(p)}><i className="bi bi-flask"></i> Test</button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => deleteProvider(p.id)}><i className="bi bi-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}