import React, { useEffect, useMemo, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDateTime } from './shared';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';

const EMPTY_FORM = { channel: 'email', subject: '', body: '', templateId: '', scheduledAt: '' };

export default function CommunicationEmail() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [templates, setTemplates] = useState([]);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadMessages();
    loadTemplates();
  }, []);

  async function loadMessages() {
    setLoading(true);
    try {
      const d = await apiGet('/school/communication/messages?channel=email');
      if (d?.ok) setMessages(d.messages || []);
      else toast(d?.error || 'Failed to load messages', 'error');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadTemplates() {
    try {
      const d = await apiGet('/school/communication/templates?channel=email');
      if (d?.ok) setTemplates(d.templates || []);
    } catch (e) {
      console.error(e);
    }
  }

  function pickTemplate(id) {
    const tpl = templates.find(t => String(t.id) === String(id));
    setForm({ ...form, templateId: id, subject: tpl?.subject || form.subject, body: tpl?.body_text || form.body });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.subject?.trim() || !form.body?.trim()) return toast('Subject and body are required', 'error');
    setSending(true);
    try {
      const res = await apiPost('/school/communication/messages', form);
      if (res?.ok) {
        toast('Email queued for sending', 'success');
        setShowForm(false);
        setForm(EMPTY_FORM);
        loadMessages();
      } else toast(res?.error || 'Failed to send', 'error');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSending(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(m => [m.subject, m.body_text, m.status].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [messages, search]);

  return (
    <PageShell title="Email" icon="bi-envelope" subtitle={`${messages.length} emails`}>
      <div className="d-flex gap-2 mb-3">
        <input className="form-control form-control-sm" style={{ width: 300 }} placeholder="Search emails..." value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-sm btn-primary" onClick={() => { setForm(EMPTY_FORM); setShowForm(true); }}>
          <i className="bi bi-plus"></i> Compose Email
        </button>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>Compose Email</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label className="span-2">Template<select className="form-select form-select-sm" value={form.templateId} onChange={e => pickTemplate(e.target.value)}>
              <option value="">Select template (optional)</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select></label>
            <label className="span-2">Subject *<input className="form-control form-control-sm" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} required /></label>
            <label className="span-2">Scheduled for<input type="datetime-local" className="form-control form-control-sm" value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} /></label>
            <label className="span-2">Body *<textarea className="form-control form-control-sm" rows="5" value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} required placeholder="Use {{student_name}}, {{parent_name}}, etc." /></label>
            <div className="span-2 d-flex gap-2">
              <button className="btn btn-sm btn-primary" type="submit" disabled={sending}><i className="bi bi-send"></i> {sending ? 'Sending...' : 'Send Email'}</button>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Recipients</th><th>Subject</th><th>Body</th><th>Status</th><th>Scheduled</th><th>Sent At</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6}><Loading /></td></tr> :
            filtered.length === 0 ? <tr><td colSpan={6}><Empty text={search ? 'No matching emails' : 'No emails yet'} icon="bi-envelope" /></td></tr> :
            filtered.map(m => (
              <tr key={m.id}>
                <td>{m.recipient_count ? `${m.recipient_count} recipient(s)` : '—'}</td>
                <td>{m.subject || '—'}</td>
                <td style={{ maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.body_text || '—'}</td>
                <td><Badge status={m.status}>{m.status}</Badge></td>
                <td>{m.scheduled_at ? fmtDateTime(m.scheduled_at) : '—'}</td>
                <td>{m.sent_at ? fmtDateTime(m.sent_at) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
