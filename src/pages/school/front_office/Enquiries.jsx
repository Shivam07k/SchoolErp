import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

export default function Enquiries() {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ contactName: '', phone: '', email: '', relation: '', childName: '', classSought: '', address: '', sourceId: '', nextFollowUp: '', notes: '' });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => { loadEnquiries(); }, []);

  async function loadEnquiries() {
    setLoading(true);
    const d = await apiGet('/school/frontoffice/enquiries');
    if (d?.ok) setEnquiries(d.enquiries || []);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.contactName?.trim() || !form.phone?.trim()) return toast('Contact name and phone are required', 'error');
    try {
      const res = editingId
        ? await apiPut(`/school/frontoffice/enquiries/${editingId}`, form)
        : await apiPost('/school/frontoffice/enquiries', form);
      if (res?.ok) {
        toast(editingId ? 'Enquiry updated' : 'Enquiry created', 'success');
        setShowForm(false); setEditingId(null);
        setForm({ contactName: '', phone: '', email: '', relation: '', childName: '', classSought: '', address: '', sourceId: '', nextFollowUp: '', notes: '' });
        loadEnquiries();
      } else toast(res?.error || 'Save failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  function editEnquiry(e) {
    setForm({ contactName: e.contact_name || '', phone: e.phone || '', email: e.email || '', relation: e.relation || '', childName: e.child_name || '', classSought: e.class_sought || '', address: '', sourceId: e.source_id || '', nextFollowUp: e.next_follow_up_date || '', notes: '' });
    setEditingId(e.id);
    setShowForm(true);
  }

  async function deleteEnquiry(e) {
    if (!window.confirm(`Delete enquiry for "${e.contact_name}"?`)) return;
    try {
      const res = await apiDelete(`/school/frontoffice/enquiries/${e.id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadEnquiries(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <PageShell title="Front Office Enquiries" icon="bi-person-plus" subtitle={`${enquiries.length} enquiries`}>
      <div className="mb-3">
        <button className="btn btn-sm btn-primary" onClick={() => { setForm({ contactName: '', phone: '', email: '', relation: '', childName: '', classSought: '', address: '', sourceId: '', nextFollowUp: '', notes: '' }); setEditingId(null); setShowForm(true); }}>
          <i className="bi bi-plus"></i> New Enquiry
        </button>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>{editingId ? 'Edit Enquiry' : 'New Enquiry'}</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>Contact Name *<input className="form-control form-control-sm" value={form.contactName} onChange={e => setForm({...form, contactName: e.target.value})} required /></label>
            <label>Phone *<input className="form-control form-control-sm" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required /></label>
            <label>Email<input type="email" className="form-control form-control-sm" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></label>
            <label>Relation<input className="form-control form-control-sm" value={form.relation} onChange={e => setForm({...form, relation: e.target.value})} /></label>
            <label>Child Name<input className="form-control form-control-sm" value={form.childName} onChange={e => setForm({...form, childName: e.target.value})} /></label>
            <label>Class Sought<input className="form-control form-control-sm" value={form.classSought} onChange={e => setForm({...form, classSought: e.target.value})} /></label>
            <label>Source ID<input className="form-control form-control-sm" value={form.sourceId} onChange={e => setForm({...form, sourceId: e.target.value})} /></label>
            <label>Next Follow-up<input type="date" className="form-control form-control-sm" value={form.nextFollowUp} onChange={e => setForm({...form, nextFollowUp: e.target.value})} /></label>
            <label className="span-2">Address<textarea className="form-control form-control-sm" rows="2" value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></label>
            <label className="span-2">Notes<textarea className="form-control form-control-sm" rows="2" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></label>
            <div className="span-2 d-flex gap-2">
              <button className="btn btn-sm btn-primary" type="submit"><i className="bi bi-check"></i> {editingId ? 'Save' : 'Create'}</button>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Contact</th><th>Phone</th><th>Child</th><th>Class</th><th>Stage</th><th>Next Follow-up</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="7"><Loading /></td></tr> :
            enquiries.length === 0 ? <tr><td colSpan="7"><Empty text="No enquiries yet" /></td></tr> :
            enquiries.map(e => (
              <tr key={e.id}>
                <td>{e.contact_name || 'Ã¢â‚¬â€'}</td>
                <td>{e.phone || 'Ã¢â‚¬â€'}</td>
                <td>{e.child_name || 'Ã¢â‚¬â€'}</td>
                <td>{e.class_sought || 'Ã¢â‚¬â€'}</td>
                <td><Badge status={e.stage?.toLowerCase() || 'new'}>{e.stage}</Badge></td>
                <td>{fmtDate(e.next_follow_up_date)}</td>
                <td className="text-end no-print">
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editEnquiry(e)}><i className="bi bi-pencil"></i></button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => deleteEnquiry(e)}><i className="bi bi-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
