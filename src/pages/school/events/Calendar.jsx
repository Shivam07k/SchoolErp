import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

export default function EventsCalendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: '', startDt: '', endDt: '', venue: '', maxParticipants: '', registrationDeadline: '' });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    setLoading(true);
    try {
      const start = new Date();
      start.setMonth(start.getMonth() - 1);
      const end = new Date();
      end.setMonth(end.getMonth() + 2);
      const d = await apiGet(`/school/events/calendar?start=${start.toISOString().split('T')[0]}&end=${end.toISOString().split('T')[0]}`);
      if (d?.ok) setEvents(d.events || []);
      else toast(d?.error || 'Failed to load events', 'error');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title?.trim() || !form.startDt) return toast('Title and start date are required', 'error');
    try {
      const res = editingId
        ? await apiPut(`/school/events/${editingId}`, form)
        : await apiPost('/school/events', form);
      if (res?.ok) {
        toast(editingId ? 'Event updated' : 'Event created', 'success');
        setShowForm(false);
        setEditingId(null);
        setForm({ title: '', description: '', category: '', startDt: '', endDt: '', venue: '', maxParticipants: '', registrationDeadline: '' });
        loadEvents();
      } else toast(res?.error || 'Save failed', 'error');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function editEvent(ev) {
    setEditingId(ev.id);
    setForm({ title: ev.title, description: ev.description, category: ev.category, startDt: ev.start_dt ? ev.start_dt.slice(0,16) : '', endDt: ev.end_dt ? ev.end_dt.slice(0,16) : '', venue: ev.venue, maxParticipants: ev.max_participants, registrationDeadline: ev.registration_deadline ? ev.registration_deadline.slice(0,16) : '' });
    setShowForm(true);
  }

  async function deleteEvent(id) {
    if (!window.confirm('Delete this event?')) return;
    try {
      const res = await apiDelete(`/school/events/${id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadEvents(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <PageShell title="Event Calendar" icon="bi-calendar-event" subtitle={`${events.length} events`}>
      <div className="d-flex gap-2 mb-3">
        <button className="btn btn-sm btn-primary" onClick={() => { setEditingId(null); setForm({ title: '', description: '', category: '', startDt: '', endDt: '', venue: '', maxParticipants: '', registrationDeadline: '' }); setShowForm(true); }}>
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
            <label>Category<select className="form-select form-select-sm" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
              <option value="">Select category</option><option value="academic">Academic</option><option value="sports">Sports</option><option value="cultural">Cultural</option><option value="exam">Exam</option><option value="holiday">Holiday</option><option value="meeting">Meeting</option><option value="other">Other</option>
            </select></label>
            <label>Start *<input type="datetime-local" className="form-control form-control-sm" value={form.startDt} onChange={e => setForm({...form, startDt: e.target.value})} required /></label>
            <label>End<input type="datetime-local" className="form-control form-control-sm" value={form.endDt} onChange={e => setForm({...form, endDt: e.target.value})} /></label>
            <label>Venue<input className="form-control form-control-sm" value={form.venue} onChange={e => setForm({...form, venue: e.target.value})} /></label>
            <label>Max Participants<input type="number" className="form-control form-control-sm" value={form.maxParticipants} onChange={e => setForm({...form, maxParticipants: e.target.value})} /></label>
            <label>Registration Deadline<input type="datetime-local" className="form-control form-control-sm" value={form.registrationDeadline} onChange={e => setForm({...form, registrationDeadline: e.target.value})} /></label>
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
          <thead><tr><th>Title</th><th>Category</th><th>Start</th><th>End</th><th>Venue</th><th>Registrations</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="7"><Loading /></td></tr> :
            events.length === 0 ? <tr><td colSpan="7"><Empty text="No events yet" icon="bi-calendar-event" /></td></tr> :
            events.map(e => (
              <tr key={e.id}>
                <td><strong>{e.title}</strong></td>
                <td>{e.category || '—'}</td>
                <td>{e.start_dt ? fmtDate(e.start_dt) : '—'}</td>
                <td>{e.end_dt ? fmtDate(e.end_dt) : '—'}</td>
                <td>{e.venue || '—'}</td>
                <td>{e.confirmed_count || 0}</td>
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