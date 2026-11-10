import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDateTime } from './shared';
import { apiGet, apiPost, apiPut } from '../../../api';
import { toast } from '../../../toast';

const EMPTY_FORM = { userId: '', userType: 'staff', title: '', body: '', priority: 'normal', data: {} };

export default function CommunicationApp() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [readFilter, setReadFilter] = useState('');

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    setLoading(true);
    try {
      const d = await apiGet('/school/communication/app-notifications');
      if (d?.ok) setNotifications(d.notifications || []);
      else toast(d?.error || 'Failed to load', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title?.trim() || !form.userId || !form.body?.trim()) return toast('Title, user and body are required', 'error');
    setSending(true);
    try {
      const res = await apiPost('/school/communication/app-notifications', form);
      if (res?.ok) { toast('Notification sent', 'success'); setShowForm(false); setForm(EMPTY_FORM); loadNotifications(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setSending(false); }
  }

  async function markRead(id) {
    try {
      const res = await apiPut(`/school/communication/app-notifications/${id}/read`);
      if (res?.ok) loadNotifications();
      else toast(res?.error || 'Failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  const visible = notifications.filter(n => {
    if (readFilter === 'read') return n.is_read;
    if (readFilter === 'unread') return !n.is_read;
    return true;
  });

  return (
    <PageShell title="App Notifications" icon="bi-bell" subtitle={`${notifications.length} notifications`}>
      <div className="d-flex gap-2 mb-3">
        <button className="btn btn-sm btn-primary" onClick={() => { setForm(EMPTY_FORM); setShowForm(true); }}>
          <i className="bi bi-plus"></i> Send Notification
        </button>
        <select className="form-select form-select-sm" style={{ width: 160 }} value={readFilter} onChange={e => setReadFilter(e.target.value)}>
          <option value="">All</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>Send Notification</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>User Type<select className="form-select form-select-sm" value={form.userType} onChange={e => setForm({ ...form, userType: e.target.value })}>
              <option value="staff">Staff</option><option value="student">Student</option><option value="parent">Parent</option>
            </select></label>
            <label>User ID *<input type="number" className="form-control form-control-sm" value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} required /></label>
            <label>Title *<input className="form-control form-control-sm" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></label>
            <label>Priority<select className="form-select form-select-sm" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
            </select></label>
            <label className="span-2">Body *<textarea className="form-control form-control-sm" rows="3" value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} required /></label>
            <div className="span-2 d-flex gap-2">
              <button className="btn btn-sm btn-primary" type="submit" disabled={sending}><i className="bi bi-send"></i> {sending ? 'Sending...' : 'Send'}</button>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>User</th><th>Title</th><th>Body</th><th>Priority</th><th>Status</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7}><Loading /></td></tr> :
            visible.length === 0 ? <tr><td colSpan={7}><Empty text="No notifications" icon="bi-bell" /></td></tr> :
            visible.map(n => (
              <tr key={n.id}>
                <td>{n.user_type || 'staff'} #{n.user_id}</td>
                <td>{n.title}</td>
                <td style={{ maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.body}</td>
                <td><Badge status={n.priority}>{n.priority}</Badge></td>
                <td><Badge status={n.is_read ? 'active' : 'pending'}>{n.is_read ? 'Read' : n.status || 'Unread'}</Badge></td>
                <td>{n.created_at ? fmtDateTime(n.created_at) : '—'}</td>
                <td className="text-end no-print">
                  {!n.is_read && <button className="btn btn-sm btn-outline-secondary" onClick={() => markRead(n.id)}><i className="bi bi-check2"></i> Mark read</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
