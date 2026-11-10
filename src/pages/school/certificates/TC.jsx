import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate, moneyOrDash } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

export default function CertificatesTC() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ studentId: '', leavingDate: '', reason: '' });
  const [students, setStudents] = useState([]);

  useEffect(() => {
    loadRequests();
    loadStudents();
  }, [statusFilter]);

  async function loadRequests() {
    setLoading(true);
    try {
      const d = await apiGet(`/school/certificates/tc/requests?${statusFilter ? `status=${statusFilter}` : ''}`);
      if (d?.ok) setRequests(d.requests || []);
      else toast(d?.error || 'Failed to load', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  async function loadStudents() {
    const d = await apiGet('/school/students?status=active');
    if (d?.ok) setStudents(d.students || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.studentId || !form.leavingDate || !form.reason) return toast('All fields required', 'error');
    try {
      const res = await apiPost('/school/certificates/tc/apply', form);
      if (res?.ok) { toast('TC application submitted', 'success'); setShowForm(false); setForm({ studentId: '', leavingDate: '', reason: '' }); loadRequests(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function approveRequest(id) {
    if (!window.confirm('Approve this TC request?')) return;
    try {
      const res = await apiPost(`/school/certificates/tc/requests/${id}/approve`);
      if (res?.ok) { toast('TC approved and generated', 'success'); loadRequests(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function rejectRequest(id) {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    try {
      const res = await apiPost(`/school/certificates/tc/requests/${id}/reject`, { reason });
      if (res?.ok) { toast('Rejected', 'success'); loadRequests(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <PageShell title="TC Certificate" icon="bi-award" subtitle={`${requests.length} requests`}>
      <div className="d-flex gap-2 mb-3">
        <select className="form-select form-select-sm" style={{width:180}} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="submitted">Submitted</option>
          <option value="clearance_pending">Clearance Pending</option>
          <option value="cleared">Cleared</option>
          <option value="approved">Approved</option>
          <option value="generated">Generated</option>
          <option value="rejected">Rejected</option>
        </select>
        <button className="btn btn-sm btn-primary" onClick={() => { setForm({ studentId: '', leavingDate: '', reason: '' }); setShowForm(true); }}>
          <i className="bi bi-plus"></i> New TC Request
        </button>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>New TC Request</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>Student *<select className="form-select form-select-sm" value={form.studentId} onChange={e => setForm({...form, studentId: e.target.value})} required>
              <option value="">Select student</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.admission_no})</option>)}
            </select></label>
            <label>Leaving Date *<input type="date" className="form-control form-control-sm" value={form.leavingDate} onChange={e => setForm({...form, leavingDate: e.target.value})} required /></label>
            <label>Reason *<textarea className="form-control form-control-sm" rows="2" value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} required /></label>
            <div className="span-2 d-flex gap-2">
              <button className="btn btn-sm btn-primary" type="submit"><i className="bi bi-send"></i> Submit</button>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Student</th><th>Admission</th><th>Class</th><th>Leaving Date</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="7"><Loading /></td></tr> :
            requests.length === 0 ? <tr><td colSpan="7"><Empty text="No TC requests" icon="bi-award" /></td></tr> :
            requests.map(r => (
              <tr key={r.id}>
                <td>{r.first_name} {r.last_name}</td>
                <td>{r.admission_no}</td>
                <td>{r.class_name || '—'}</td>
                <td>{fmtDate(r.leaving_date)}</td>
                <td style={{maxWidth:200, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{r.reason}</td>
                <td><Badge status={r.status}>{r.status}</Badge></td>
                <td className="text-end no-print">
                  {['submitted', 'clearance_pending', 'cleared'].includes(r.status) && <button className="btn btn-sm btn-success me-1" onClick={() => approveRequest(r.id)}><i className="bi bi-check"></i> Approve &amp; Generate</button>}
                  {['submitted', 'clearance_pending', 'cleared'].includes(r.status) && <button className="btn btn-sm btn-danger me-1" onClick={() => rejectRequest(r.id)}><i className="bi bi-x"></i> Reject</button>}
                  {r.status === 'generated' && <span className="badge bg-success-subtle text-success">TC issued</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}