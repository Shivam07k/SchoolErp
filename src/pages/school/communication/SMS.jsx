import React, { useEffect, useMemo, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDateTime } from './shared';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';

const EMPTY_FORM = { channel: 'sms', content: '', templateId: '', scheduledAt: '' };

export default function CommunicationSMS() {
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
      const d = await apiGet('/school/communication/messages?channel=sms');
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
      const d = await apiGet('/school/communication/templates?channel=sms');
      if (d?.ok) setTemplates(d.templates || []);
    } catch (e) {
      console.error(e);
    }
  }

  function pickTemplate(id) {
    const tpl = templates.find(t => String(t.id) === String(id));
    setForm({ ...form, templateId: id, content: tpl?.body_text || form.content });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.content?.trim()) return toast('Content is required', 'error');
    setSending(true);
    try {
      const res = await apiPost('/school/communication/messages', form);
      if (res?.ok) {
        toast('SMS queued for sending', 'success');
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
    return messages.filter(m => [m.body_text, m.subject, m.status].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [messages, search]);

  return (
    <PageShell title="SMS" icon="bi-chat-left-text" subtitle={`${messages.length} messages`}>
      <div className="d-flex gap-2 mb-3">
        <input className="form-control form-control-sm" style={{ width: 300 }} placeholder="Search messages..." value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-sm btn-primary" onClick={() => { setForm(EMPTY_FORM); setShowForm(true); }}>
          <i className="bi bi-plus"></i> Compose SMS
        </button>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>Compose SMS</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label className="span-2">Template<select className="form-select form-select-sm" value={form.templateId} onChange={e => pickTemplate(e.target.value)}>
              <option value="">Select template (optional)</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select></label>
            <label className="span-2">Scheduled for<input type="datetime-local" className="form-control form-control-sm" value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} /></label>
            <label className="span-2">Message *<textarea className="form-control form-control-sm" rows="3" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} required placeholder="Enter message... Use {{student_name}}, {{parent_name}}, etc." /></label>
            <div className="span-2 d-flex gap-2">
              <button className="btn btn-sm btn-primary" type="submit" disabled={sending}><i className="bi bi-send"></i> {sending ? 'Sending...' : 'Send SMS'}</button>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Recipients</th><th>Channel</th><th>Content</th><th>Status</th><th>Scheduled</th><th>Sent At</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6}><Loading /></td></tr> :
            filtered.length === 0 ? <tr><td colSpan={6}><Empty text={search ? 'No matching messages' : 'No SMS messages yet'} icon="bi-chat-left-text" /></td></tr> :
            filtered.map(m => (
              <tr key={m.id}>
                <td>{m.recipient_count ? `${m.recipient_count} recipient(s)` : '—'}</td>
                <td><Badge status={m.channel}>{m.channel}</Badge></td>
                <td style={{ maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.body_text || m.subject || '—'}</td>
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
