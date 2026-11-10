import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate, fmtDateTime } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ contactId: '', studentId: '', hostUser: '', purpose: '', appointmentDate: new Date().toISOString().slice(0,10), slotTime: '', notes: '' });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => { loadAppointments(); }, []);

  async function loadAppointments() {
    setLoading(true);
    const d = await apiGet('/school/frontoffice/appointments');
    if (d?.ok) setAppointments(d.appointments || []);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.purpose?.trim()) return toast('Purpose is required', 'error');
    try {
      const res = editingId
        ? await apiPut(`/school/frontoffice/appointments/${editingId}`, form)
        : await apiPost('/school/frontoffice/appointments', form);
      if (res?.ok) {
        toast(editingId ? 'Appointment updated' : 'Appointment created', 'success');
        setShowForm(false); setEditingId(null);
        setForm({ contactId: '', studentId: '', hostUser: '', purpose: '', appointmentDate: new Date().toISOString().slice(0,10), slotTime: '', notes: '' });
        loadAppointments();
      } else toast(res?.error || 'Save failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  function editAppointment(a) {
    setForm({ contactId: a.contact_id || '', studentId: a.student_id || '', hostUser: a.host_user || '', purpose: a.purpose, appointmentDate: a.appointment_date || '', slotTime: a.slot_time || '', notes: a.notes || '' });
    setEditingId(a.id);
    setShowForm(true);
  }

  async function deleteAppointment(a) {
    if (!window.confirm(`Delete appointment?`)) return;
    try {
      const res = await apiDelete(`/school/frontoffice/appointments/${a.id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadAppointments(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <PageShell title="Front Office Appointments" icon="bi-calendar-event" subtitle={`${appointments.length} appointments`}>
      <div className="mb-3">
        <button className="btn btn-sm btn-primary" onClick={() => { setForm({ contactId: '', studentId: '', hostUser: '', purpose: '', appointmentDate: new Date().toISOString().slice(0,10), slotTime: '', notes: '' }); setEditingId(null); setShowForm(true); }}>
          <i className="bi bi-plus"></i> New Appointment
        </button>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>{editingId ? 'Edit Appointment' : 'New Appointment'}</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>Contact ID<input className="form-control form-control-sm" value={form.contactId} onChange={e => setForm({...form, contactId: e.target.value})} /></label>
            <label>Student ID<input className="form-control form-control-sm" value={form.studentId} onChange={e => setForm({...form, studentId: e.target.value})} /></label>
            <label>Host User *<input className="form-control form-control-sm" value={form.hostUser} onChange={e => setForm({...form, hostUser: e.target.value})} required /></label>
            <label>Purpose *<input className="form-control form-control-sm" value={form.purpose} onChange={e => setForm({...form, purpose: e.target.value})} required /></label>
            <label>Date<input type="date" className="form-control form-control-sm" value={form.appointmentDate} onChange={e => setForm({...form, appointmentDate: e.target.value})} /></label>
            <label>Slot Time<input type="time" className="form-control form-control-sm" value={form.slotTime} onChange={e => setForm({...form, slotTime: e.target.value})} /></label>
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
          <thead><tr><th>Contact</th><th>Host</th><th>Purpose</th><th>Date</th><th>Time</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="7"><Loading /></td></tr> :
            appointments.length === 0 ? <tr><td colSpan="7"><Empty text="No appointments yet" /></td></tr> :
            appointments.map(a => (
              <tr key={a.id}>
                <td>{a.contact_name || `ID: ${a.contact_id || a.student_id || 'Ã¢â‚¬â€'}`}</td>
                <td>{a.host_user || 'Ã¢â‚¬â€'}</td>
                <td style={{maxWidth:250, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{a.purpose}</td>
                <td>{fmtDate(a.appointment_date)}</td>
                <td>{a.slot_time}</td>
                <td><Badge status={a.status?.toLowerCase() || 'requested'}>{a.status}</Badge></td>
                <td className="text-end no-print">
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editAppointment(a)}><i className="bi bi-pencil"></i></button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => deleteAppointment(a)}><i className="bi bi-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
