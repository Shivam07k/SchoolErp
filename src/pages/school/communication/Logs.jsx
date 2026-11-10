import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate } from './shared';
import { apiGet } from '../../../api';
import { toast } from '../../../toast';

export default function CommunicationLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');

  useEffect(() => {
    loadLogs();
  }, [statusFilter, channelFilter]);

  async function loadLogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (channelFilter) params.append('channel', channelFilter);
      const d = await apiGet(`/school/communication/messages?${params.toString()}`);
      if (d?.ok) setLogs(d.messages || []);
      else toast(d?.error || 'Failed to load', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  return (
    <PageShell title="Message Logs" icon="bi-journal-text" subtitle={`${logs.length} messages`}>
      <div className="d-flex gap-2 mb-3">
        <select className="form-select form-select-sm" style={{width:150}} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="queued">Queued</option><option value="sending">Sending</option>
          <option value="sent">Sent</option><option value="failed">Failed</option>
          <option value="draft">Draft</option><option value="cancelled">Cancelled</option>
        </select>
        <select className="form-select form-select-sm" style={{width:150}} value={channelFilter} onChange={e => setChannelFilter(e.target.value)}>
          <option value="">All Channels</option>
          <option value="sms">SMS</option><option value="email">Email</option>
          <option value="push">Push</option><option value="notice">Notice</option>
        </select>
      </div>

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Channel</th><th>Content</th><th>Status</th><th>Recipients</th><th>Scheduled</th><th>Sent</th><th>Error</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="7"><Loading /></td></tr> :
            logs.length === 0 ? <tr><td colSpan="7"><Empty text="No messages" icon="bi-journal-text" /></td></tr> :
            logs.map(m => (
              <tr key={m.id}>
                <td><Badge status={m.channel}>{m.channel}</Badge></td>
                <td style={{maxWidth:300, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{m.content || m.body_text || m.subject || '—'}</td>
                <td><Badge status={m.status}>{m.status}</Badge></td>
                <td>{m.recipient_count || 0}</td>
                <td>{m.scheduled_at ? new Date(m.scheduled_at).toLocaleString() : '—'}</td>
                <td>{m.sent_at ? new Date(m.sent_at).toLocaleString() : '—'}</td>
                <td>{m.error_summary || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}