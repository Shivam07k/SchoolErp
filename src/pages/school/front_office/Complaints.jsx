import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate, moneyOrDash } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

export default function Complaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ contactId: '', studentId: '', categoryId: '', priority: 'medium', description: '', channel: 'walk-in', owner: '', dueDate: '', confidential: false });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => { loadComplaints(); }, []);

  async function loadComplaints() {
    setLoading(true);
    const d = await apiGet('/school/frontoffice/complaints');
    if (d?.ok) setComplaints(d.complaints || []);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.description?.trim()) return toast('Description is required', 'error');
    try {
      const res = editingId
        ? await apiPut(`/school/frontoffice/complaints/${editingId}`, form)
        : await apiPost('/school/frontoffice/complaints', form);
      if (res?.ok) {
        toast(editingId ? 'Complaint updated' : 'Complaint created', 'success');
        setShowForm(false); setEditingId(null);
        setForm({ contactId: '', studentId: '', categoryId: '', priority: 'medium', description: '', channel: 'walk-in', owner: '', dueDate: '', confidential: false });
        loadComplaints();
      } else toast(res?.error || 'Save failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  function editComplaint(c) {
    setForm({ contactId: c.contact_id || '', studentId: c.student_id || '', categoryId: c.category_id || '', priority: c.priority, description: c.description, channel: c.channel, owner: c.owner, dueDate: c.due_date || '', confidential: c.confidential });
    setEditingId(c.id);
    setShowForm(true);
  }

  async function deleteComplaint(c) {
    if (!window.confirm(`Delete complaint?`)) return;
    try {
      const res = await apiDelete(`/school/frontoffice/complaints/${c.id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadComplaints(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <PageShell title="Front Office Complaints" icon="bi-exclamation-triangle" subtitle={`${complaints.length} complaints`}>
      <div className="mb-3">
        <button className="btn btn-sm btn-primary" onClick={() => { setForm({ contactId: '', studentId: '', categoryId: '', priority: 'medium', description: '', channel: 'walk-in', owner: '', dueDate: '', confidential: false }); setEditingId(null); setShowForm(true); }}>
          <i className="bi bi-plus"></i> New Complaint
        </button>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>{editingId ? 'Edit Complaint' : 'New Complaint'}</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>Contact ID<input className="form-control form-control-sm" value={form.contactId} onChange={e => setForm({...form, contactId: e.target.value})} /></label>
            <label>Student ID<input className="form-control form-control-sm" value={form.studentId} onChange={e => setForm({...form, studentId: e.target.value})} /></label>
            <label>Category ID<input className="form-control form-control-sm" value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})} /></label>
            <label>Priority<select className="form-select form-select-sm" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
            </select></label>
            <label>Channel<select className="form-select form-select-sm" value={form.channel} onChange={e => setForm({...form, channel: e.target.value})}>
              <option value="walk-in">Walk-in</option><option value="phone">Phone</option><option value="email">Email</option><option value="app">App</option>
            </select></label>
            <label>Owner<input className="form-control form-control-sm" value={form.owner} onChange={e => setForm({...form, owner: e.target.value})} /></label>
            <label>Due Date<input type="date" className="form-control form-control-sm" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} /></label>
            <label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input" checked={form.confidential} onChange={e => setForm({...form, confidential: e.target.checked})} /> Confidential</label>
            <label className="span-2">Description<textarea className="form-control form-control-sm" rows="3" value={form.description} onChange={e => setForm({...form, description: e.target.value})} required /></label>
            <div className="span-2 d-flex gap-2">
              <button className="btn btn-sm btn-primary" type="submit"><i className="bi bi-check"></i> {editingId ? 'Save' : 'Create'}</button>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Contact</th><th>Category</th><th>Priority</th><th>Description</th><th>Status</th><th>Owner</th><th>Due</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="8"><Loading /></td></tr> :
            complaints.length === 0 ? <tr><td colSpan="8"><Empty text="No complaints yet" /></td></tr> :
            complaints.map(c => (
              <tr key={c.id}>
                <td>{c.contact_name || `ID: ${c.contact_id || c.student_id || '—'}`}</td>
                <td>{c.category_name || c.category_id || '—'}</td>
                <td><Badge status={c.priority}>{c.priority}</Badge></td>
                <td style={{maxWidth:300, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{c.description}</td>
                <td><Badge status={c.status?.toLowerCase() || 'open'}>{c.status}</Badge></td>
                <td>{c.owner || '—'}</td>
                <td>{fmtDate(c.due_date)}</td>
                <td className="text-end no-print">
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editComplaint(c)}><i className="bi bi-pencil"></i></button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => deleteComplaint(c)}><i className="bi bi-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}