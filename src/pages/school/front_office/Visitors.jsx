import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate, fmtDateTime } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

export default function Visitors() {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ contactId: '', purpose: '', hostUser: '', expected: false, idType: '', photo: '', itemsCarried: '' });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => { loadVisits(); }, []);

  async function loadVisits() {
    setLoading(true);
    const d = await apiGet('/school/frontoffice/visits');
    if (d?.ok) setVisits(d.visits || []);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.purpose?.trim()) return toast('Purpose is required', 'error');
    try {
      const res = editingId
        ? await apiPut(`/school/frontoffice/visits/${editingId}`, form)
        : await apiPost('/school/frontoffice/visits', form);
      if (res?.ok) {
        toast(editingId ? 'Visit updated' : 'Visit created', 'success');
        setShowForm(false); setEditingId(null);
        setForm({ contactId: '', purpose: '', hostUser: '', expected: false, idType: '', photo: '', itemsCarried: '' });
        loadVisits();
      } else toast(res?.error || 'Save failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function checkIn(id) {
    const res = await apiPost(`/school/frontoffice/visits/${id}/check-in`, {});
    if (res?.ok) { toast('Checked in', 'success'); loadVisits(); }
    else toast(res?.error || 'Check-in failed', 'error');
  }

  async function checkOut(id) {
    const res = await apiPost(`/school/frontoffice/visits/${id}/check-out`, {});
    if (res?.ok) { toast('Checked out', 'success'); loadVisits(); }
    else toast(res?.error || 'Check-out failed', 'error');
  }

  async function deleteVisit(v) {
    if (!window.confirm(`Delete visit record?`)) return;
    try {
      const res = await apiDelete(`/school/frontoffice/visits/${v.id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadVisits(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <PageShell title="Front Office Visitors" icon="bi-door-open" subtitle={`${visits.length} visits`}>
      <div className="mb-3">
        <button className="btn btn-sm btn-primary" onClick={() => { setForm({ contactId: '', purpose: '', hostUser: '', expected: false, idType: '', photo: '', itemsCarried: '' }); setEditingId(null); setShowForm(true); }}>
          <i className="bi bi-plus"></i> New Visit
        </button>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>{editingId ? 'Edit Visit' : 'New Visit'}</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>Contact ID<input className="form-control form-control-sm" value={form.contactId} onChange={e => setForm({...form, contactId: e.target.value})} placeholder="Contact ID" /></label>
            <label>Purpose *<input className="form-control form-control-sm" value={form.purpose} onChange={e => setForm({...form, purpose: e.target.value})} required /></label>
            <label>Host User<input className="form-control form-control-sm" value={form.hostUser} onChange={e => setForm({...form, hostUser: e.target.value})} /></label>
            <label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input" checked={form.expected} onChange={e => setForm({...form, expected: e.target.checked})} /> Expected</label>
            <label>ID Type<input className="form-control form-control-sm" value={form.idType} onChange={e => setForm({...form, idType: e.target.value})} /></label>
            <label>Photo URL<input className="form-control form-control-sm" value={form.photo} onChange={e => setForm({...form, photo: e.target.value})} /></label>
            <label>Items Carried<input className="form-control form-control-sm" value={form.itemsCarried} onChange={e => setForm({...form, itemsCarried: e.target.value})} /></label>
            <div className="span-2 d-flex gap-2">
              <button className="btn btn-sm btn-primary" type="submit"><i className="bi bi-check"></i> {editingId ? 'Save' : 'Create'}</button>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Contact</th><th>Purpose</th><th>Host</th><th>Status</th><th>Check-in</th><th>Check-out</th><th>Pass</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="8"><Loading /></td></tr> :
            visits.length === 0 ? <tr><td colSpan="8"><Empty text="No visits yet" /></td></tr> :
            visits.map(v => (
              <tr key={v.id}>
                <td>{v.contact_name || `ID: ${v.contact_id}`}</td>
                <td>{v.purpose}</td>
                <td>{v.host_user || 'Ã¢â‚¬â€'}</td>
                <td><Badge status={v.status}>{v.status}</Badge></td>
                <td>{v.check_in ? fmtDateTime(v.check_in) : 'Ã¢â‚¬â€'}</td>
                <td>{v.check_out ? fmtDateTime(v.check_out) : 'Ã¢â‚¬â€'}</td>
                <td>{v.pass_number || 'Ã¢â‚¬â€'}</td>
                <td className="text-end no-print">
                  {v.status === 'expected' && <button className="btn btn-sm btn-outline-success me-1" onClick={() => checkIn(v.id)}><i className="bi bi-box-arrow-in-right"></i> Check-in</button>}
                  {v.status === 'checked_in' && <button className="btn btn-sm btn-outline-warning me-1" onClick={() => checkOut(v.id)}><i className="bi bi-box-arrow-right"></i> Check-out</button>}
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => { setForm({ contactId: v.contact_id, purpose: v.purpose, hostUser: v.host_user, expected: v.expected, idType: v.id_type, photo: v.photo, itemsCarried: v.items_carried }); setEditingId(v.id); setShowForm(true); }}><i className="bi bi-pencil"></i></button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => deleteVisit(v)}><i className="bi bi-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
