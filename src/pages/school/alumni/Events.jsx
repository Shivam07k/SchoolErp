import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate, fmtDateTime } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

export default function AlumniEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', eventType: 'meet', startDt: '', endDt: '', venue: '', maxCapacity: '', registrationFee: 0, regOpenDt: '', regCloseDt: '' });
  const [editingId, setEditingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => { loadEvents(); }, [statusFilter]);

  async function loadEvents() {
    setLoading(true);
    try {
      const d = await apiGet(`/school/alumni/events?${statusFilter ? `status=${statusFilter}` : ''}`);
      if (d?.ok) setEvents(d.events || []);
      else toast(d?.error || 'Failed to load', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title?.trim() || !form.startDt) return toast('Title and start date required', 'error');
    try {
      const res = editingId
        ? await apiPut(`/school/alumni/events/${editingId}`, form)
        : await apiPost('/school/alumni/events', form);
      if (res?.ok) { toast(editingId ? 'Event updated' : 'Event created', 'success'); setShowForm(false); setEditingId(null); setForm({ title: '', description: '', eventType: 'meet', startDt: '', endDt: '', venue: '', maxCapacity: '', registrationFee: 0, regOpenDt: '', regCloseDt: '' }); loadEvents(); }
      else toast(res?.error || 'Save failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  function editEvent(e) {
    setEditingId(e.id);
    setForm({ title: e.title, description: e.description, eventType: e.event_type, startDt: e.start_dt ? e.start_dt.slice(0,16) : '', endDt: e.end_dt ? e.end_dt.slice(0,16) : '', venue: e.venue, maxCapacity: e.max_capacity, registrationFee: e.registration_fee, regOpenDt: e.reg_open_dt ? e.reg_open_dt.slice(0,16) : '', regCloseDt: e.reg_close_dt ? e.reg_close_dt.slice(0,16) : '' });
    setShowForm(true);
  }

  async function deleteEvent(id) {
    if (!window.confirm('Delete this event?')) return;
    try {
      const res = await apiDelete(`/school/alumni/events/${id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadEvents(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <PageShell title="Alumni Events" icon="bi-calendar-event" subtitle={`${events.length} events`}>
      <div className="d-flex gap-2 mb-3">
        <select className="form-select form-select-sm" style={{width:180}} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="draft">Draft</option><option value="published">Published</option>
          <option value="registration_open">Registration Open</option><option value="registration_closed">Registration Closed</option>
          <option value="completed">Completed</option><option value="cancelled">Cancelled</option>
        </select>
        <button className="btn btn-sm btn-primary" onClick={() => { setEditingId(null); setForm({ title: '', description: '', eventType: 'meet', startDt: '', endDt: '', venue: '', maxCapacity: '', registrationFee: 0, regOpenDt: '', regCloseDt: '' }); setShowForm(true); }}>
          <i className="bi bi-plus"></i> New Event
        </button>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>{editingId ? 'Edit Event' : 'New Event'}</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>Title *<input className="form-control form-control-sm" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required /></label>
            <label>Type<select className="form-select form-select-sm" value={form.eventType} onChange={e => setForm({...form, eventType: e.target.value})}>
              <option value="meet">Annual Meet</option><option value="reunion">Reunion</option><option value="guest_lecture">Guest Lecture</option>
              <option value="career_guidance">Career Guidance</option><option value="workshop">Workshop</option><option value="custom">Custom</option>
            </select></label>
            <label>Start *<input type="datetime-local" className="form-control form-control-sm" value={form.startDt} onChange={e => setForm({...form, startDt: e.target.value})} required /></label>
            <label>End<input type="datetime-local" className="form-control form-control-sm" value={form.endDt} onChange={e => setForm({...form, endDt: e.target.value})} /></label>
            <label>Venue<input className="form-control form-control-sm" value={form.venue} onChange={e => setForm({...form, venue: e.target.value})} /></label>
            <label>Capacity<input type="number" className="form-control form-control-sm" value={form.maxCapacity} onChange={e => setForm({...form, maxCapacity: e.target.value})} /></label>
            <label>Fee<input type="number" step="0.01" className="form-control form-control-sm" value={form.registrationFee} onChange={e => setForm({...form, registrationFee: e.target.value})} /></label>
            <label>Reg Open<input type="datetime-local" className="form-control form-control-sm" value={form.regOpenDt} onChange={e => setForm({...form, regOpenDt: e.target.value})} /></label>
            <label>Reg Close<input type="datetime-local" className="form-control form-control-sm" value={form.regCloseDt} onChange={e => setForm({...form, regCloseDt: e.target.value})} /></label>
            <label className="span-2">Description<textarea className="form-control form-control-sm" rows="2" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></label>
            <div className="span-2 d-flex gap-2">
              <button className="btn btn-sm btn-primary" type="submit"><i className="bi bi-check"></i> {editingId ? 'Save' : 'Create'}</button>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Title</th><th>Type</th><th>Start</th><th>End</th><th>Venue</th><th>Reg Fee</th><th>Capacity</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="9"><Loading /></td></tr> :
            events.length === 0 ? <tr><td colSpan="9"><Empty text="No events yet" icon="bi-calendar-event" /></td></tr> :
            events.map(e => (
              <tr key={e.id}>
                <td><strong>{e.title}</strong></td>
                <td>{e.event_type}</td>
                <td>{e.start_dt ? fmtDateTime(e.start_dt) : '—'}</td>
                <td>{e.end_dt ? fmtDateTime(e.end_dt) : '—'}</td>
                <td>{e.venue || '—'}</td>
                <td>{Number(e.registration_fee) > 0 ? `₹${Number(e.registration_fee).toFixed(2)}` : 'Free'}</td>
                <td>{e.max_capacity || 'Unlimited'}</td>
                <td><Badge status={e.status}>{e.status}</Badge></td>
                <td className="text-end no-print">
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editEvent(e)}><i className="bi bi-pencil"></i></button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => deleteEvent(e.id)}><i className="bi bi-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}