import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

export default function Members() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ memberType: 'student', memberRefId: '', name: '', email: '', phone: '', status: 'active' });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => { loadMembers(); }, []);

  async function loadMembers() {
    setLoading(true);
    const d = await apiGet('/school/library/members');
    if (d?.ok) setMembers(d.members || []);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name?.trim()) return toast('Name is required', 'error');
    try {
      const res = editingId
        ? await apiPut(`/school/library/members/${editingId}`, form)
        : await apiPost('/school/library/members', form);
      if (res?.ok) {
        toast(editingId ? 'Member updated' : 'Member created', 'success');
        setShowForm(false); setEditingId(null);
        setForm({ memberType: 'student', memberRefId: '', name: '', email: '', phone: '', status: 'active' });
        loadMembers();
      } else toast(res?.error || 'Save failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  function editMember(m) {
    setForm({ memberType: m.member_type, memberRefId: m.member_ref_id || '', name: m.name, email: m.email || '', phone: m.phone || '', status: m.status });
    setEditingId(m.id);
    setShowForm(true);
  }

  async function deleteMember(m) {
    if (!window.confirm(`Delete "${m.name}"?`)) return;
    try {
      const res = await apiDelete(`/school/library/members/${m.id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadMembers(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <PageShell title="Library Members" icon="bi-people" subtitle={`${members.length} members`}>
      <div className="mb-3">
        <button className="btn btn-sm btn-primary" onClick={() => { setForm({ memberType: 'student', memberRefId: '', name: '', email: '', phone: '', status: 'active' }); setEditingId(null); setShowForm(true); }}>
          <i className="bi bi-plus"></i> Add Member
        </button>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>{editingId ? 'Edit Member' : 'New Member'}</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>Type<select className="form-select form-select-sm" value={form.memberType} onChange={e => setForm({...form, memberType: e.target.value})}>
              <option value="student">Student</option><option value="staff">Staff</option><option value="other">Other</option>
            </select></label>
            <label>Reference ID<input className="form-control form-control-sm" value={form.memberRefId} onChange={e => setForm({...form, memberRefId: e.target.value})} placeholder="Student/Staff ID" /></label>
            <label>Name *<input className="form-control form-control-sm" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></label>
            <label>Email<input type="email" className="form-control form-control-sm" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></label>
            <label>Phone<input className="form-control form-control-sm" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></label>
            <label>Status<select className="form-select form-select-sm" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
              <option value="active">Active</option><option value="inactive">Inactive</option>
            </select></label>
            <div className="span-2 d-flex gap-2">
              <button className="btn btn-sm btn-primary" type="submit"><i className="bi bi-check"></i> {editingId ? 'Save' : 'Create'}</button>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Name</th><th>Type</th><th>Ref ID</th><th>Email</th><th>Phone</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="7"><Loading /></td></tr> :
            members.length === 0 ? <tr><td colSpan="7"><Empty text="No members yet" /></td></tr> :
            members.map(m => (
              <tr key={m.id}>
                <td><strong>{m.name}</strong></td>
                <td>{m.member_type}</td>
                <td>{m.member_ref_id || 'Ã¢â‚¬â€'}</td>
                <td>{m.email || 'Ã¢â‚¬â€'}</td>
                <td>{m.phone || 'Ã¢â‚¬â€'}</td>
                <td><Badge status={m.status}>{m.status}</Badge></td>
                <td className="text-end no-print">
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editMember(m)}><i className="bi bi-pencil"></i></button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => deleteMember(m)}><i className="bi bi-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
