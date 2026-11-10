import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate, fmtDateTime } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

export default function CallLog() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ direction: 'in', contactId: '', number: '', callTime: new Date().toISOString().slice(0,16), duration: 0, purpose: '', outcome: '', linkedEnquiryId: '', linkedComplaintId: '' });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => { loadCalls(); }, []);

  async function loadCalls() {
    setLoading(true);
    const d = await apiGet('/school/frontoffice/calls');
    if (d?.ok) setCalls(d.calls || []);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.purpose?.trim()) return toast('Purpose is required', 'error');
    try {
      const res = editingId
        ? await apiPut(`/school/frontoffice/calls/${editingId}`, form)
        : await apiPost('/school/frontoffice/calls', form);
      if (res?.ok) {
        toast(editingId ? 'Call log updated' : 'Call logged', 'success');
        setShowForm(false); setEditingId(null);
        setForm({ direction: 'in', contactId: '', number: '', callTime: new Date().toISOString().slice(0,16), duration: 0, purpose: '', outcome: '', linkedEnquiryId: '', linkedComplaintId: '' });
        loadCalls();
      } else toast(res?.error || 'Save failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  function editCall(c) {
    setForm({ direction: c.direction, contactId: c.contact_id || '', number: c.number || '', callTime: c.call_time ? c.call_time.slice(0,16) : new Date().toISOString().slice(0,16), duration: c.duration || 0, purpose: c.purpose, outcome: c.outcome || '', linkedEnquiryId: c.linked_enquiry_id || '', linkedComplaintId: c.linked_complaint_id || '' });
    setEditingId(c.id);
    setShowForm(true);
  }

  async function deleteCall(c) {
    if (!window.confirm(`Delete call log?`)) return;
    try {
      const res = await apiDelete(`/school/frontoffice/calls/${c.id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadCalls(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <PageShell title="Front Office Call Log" icon="bi-telephone" subtitle={`${calls.length} calls`}>
      <div className="mb-3">
        <button className="btn btn-sm btn-primary" onClick={() => { setForm({ direction: 'in', contactId: '', number: '', callTime: new Date().toISOString().slice(0,16), duration: 0, purpose: '', outcome: '', linkedEnquiryId: '', linkedComplaintId: '' }); setEditingId(null); setShowForm(true); }}>
          <i className="bi bi-plus"></i> Log Call
        </button>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>{editingId ? 'Edit Call Log' : 'Log Call'}</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>Direction<select className="form-select form-select-sm" value={form.direction} onChange={e => setForm({...form, direction: e.target.value})}>
              <option value="in">Incoming</option><option value="out">Outgoing</option>
            </select></label>
            <label>Contact ID<input className="form-control form-control-sm" value={form.contactId} onChange={e => setForm({...form, contactId: e.target.value})} /></label>
            <label>Number<input className="form-control form-control-sm" value={form.number} onChange={e => setForm({...form, number: e.target.value})} /></label>
            <label>Time<input type="datetime-local" className="form-control form-control-sm" value={form.callTime} onChange={e => setForm({...form, callTime: e.target.value})} /></label>
            <label>Duration (sec)<input type="number" className="form-control form-control-sm" value={form.duration} onChange={e => setForm({...form, duration: e.target.value})} /></label>
            <label>Purpose *<input className="form-control form-control-sm" value={form.purpose} onChange={e => setForm({...form, purpose: e.target.value})} required /></label>
            <label>Outcome<input className="form-control form-control-sm" value={form.outcome} onChange={e => setForm({...form, outcome: e.target.value})} /></label>
            <label>Linked Enquiry ID<input className="form-control form-control-sm" value={form.linkedEnquiryId} onChange={e => setForm({...form, linkedEnquiryId: e.target.value})} /></label>
            <label>Linked Complaint ID<input className="form-control form-control-sm" value={form.linkedComplaintId} onChange={e => setForm({...form, linkedComplaintId: e.target.value})} /></label>
            <div className="span-2 d-flex gap-2">
              <button className="btn btn-sm btn-primary" type="submit"><i className="bi bi-check"></i> {editingId ? 'Save' : 'Log'}</button>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Dir</th><th>Contact</th><th>Number</th><th>Time</th><th>Duration</th><th>Purpose</th><th>Outcome</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="8"><Loading /></td></tr> :
            calls.length === 0 ? <tr><td colSpan="8"><Empty text="No calls logged yet" /></td></tr> :
            calls.map(c => (
              <tr key={c.id}>
                <td><Badge status={c.direction === 'in' ? 'info' : 'success'}>{c.direction === 'in' ? 'In' : 'Out'}</Badge></td>
                <td>{c.contact_name || `ID: ${c.contact_id || 'Ã¢â‚¬â€'}`}</td>
                <td>{c.number || 'Ã¢â‚¬â€'}</td>
                <td>{fmtDateTime(c.call_time)}</td>
                <td>{c.duration}s</td>
                <td style={{maxWidth:250, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{c.purpose}</td>
                <td>{c.outcome || 'Ã¢â‚¬â€'}</td>
                <td className="text-end no-print">
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editCall(c)}><i className="bi bi-pencil"></i></button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => deleteCall(c)}><i className="bi bi-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
