import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

const EMPTY_FORM = { ptmDate: '', classId: '', sectionId: '', bookingDeadline: '', status: 'draft' };
const EMPTY_SLOT = { teacherId: '', startTime: '', endTime: '', maxBookings: 1 };

export default function EventsPTM() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [active, setActive] = useState(null);
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [slotForm, setSlotForm] = useState(EMPTY_SLOT);
  const [panel, setPanel] = useState('slots');

  useEffect(() => {
    loadSchedules();
    loadRefs();
  }, []);

  async function loadSchedules() {
    setLoading(true);
    try {
      const d = await apiGet('/school/events/ptm/schedules');
      if (d?.ok) setSchedules(d.schedules || []);
      else toast(d?.error || 'Failed to load', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  async function loadRefs() {
    const [cls, tchs] = await Promise.all([
      apiGet('/school/classes'),
      apiGet('/school/academics/teachers')
    ]);
    if (cls?.ok) setClasses(cls.classes || []);
    if (tchs?.ok) setTeachers(tchs.teachers || []);
  }

  async function openPanel(schedule, which) {
    setActive(schedule);
    setPanel(which);
    if (which === 'slots') {
      const d = await apiGet(`/school/events/ptm/schedules/${schedule.id}/slots`);
      setSlots(d?.ok ? (d.slots || []) : []);
    } else {
      const d = await apiGet(`/school/events/ptm/bookings?scheduleId=${schedule.id}`);
      setBookings(d?.ok ? (d.bookings || []) : []);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.ptmDate || !form.classId) return toast('Date and class required', 'error');
    try {
      const res = editingId
        ? await apiPut(`/school/events/ptm/schedules/${editingId}`, form)
        : await apiPost('/school/events/ptm/schedules', form);
      if (res?.ok) { toast(editingId ? 'Session updated' : 'Session created', 'success'); setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); loadSchedules(); }
      else toast(res?.error || 'Save failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  function editSchedule(s) {
    setEditingId(s.id);
    setForm({
      ptmDate: s.ptm_date ? String(s.ptm_date).slice(0, 10) : '',
      classId: s.class_id || '',
      sectionId: s.section_id || '',
      bookingDeadline: s.booking_deadline ? String(s.booking_deadline).slice(0, 10) : '',
      status: s.status || 'draft'
    });
    setShowForm(true);
  }

  async function changeStatus(s, status) {
    try {
      const res = await apiPut(`/school/events/ptm/schedules/${s.id}/status`, { status });
      if (res?.ok) { toast('Status updated', 'success'); loadSchedules(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function deleteSchedule(id) {
    if (!window.confirm('Delete this PTM session?')) return;
    try {
      const res = await apiDelete(`/school/events/ptm/schedules/${id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadSchedules(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function addSlot(e) {
    e.preventDefault();
    if (!active) return;
    if (!slotForm.teacherId || !slotForm.startTime || !slotForm.endTime) return toast('Teacher, start and end required', 'error');
    try {
      const res = await apiPost(`/school/events/ptm/schedules/${active.id}/slots`, slotForm);
      if (res?.ok) { toast('Slot added', 'success'); setSlotForm(EMPTY_SLOT); openPanel(active, 'slots'); }
      else toast(res?.error || 'Failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function deleteSlot(id) {
    try {
      const res = await apiDelete(`/school/events/ptm/slots/${id}`);
      if (res?.ok) { toast('Slot removed', 'success'); openPanel(active, 'slots'); }
      else toast(res?.error || 'Failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  const selectedClass = classes.find(c => String(c.id) === String(form.classId));

  return (
    <PageShell title="PTM Schedule" icon="bi-calendar-check" subtitle={`${schedules.length} sessions`}>
      <div className="d-flex gap-2 mb-3">
        <button className="btn btn-sm btn-primary" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); }}>
          <i className="bi bi-plus"></i> New PTM Session
        </button>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>{editingId ? 'Edit PTM Session' : 'New PTM Session'}</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>PTM Date *<input type="date" className="form-control form-control-sm" value={form.ptmDate} onChange={e => setForm({ ...form, ptmDate: e.target.value })} required /></label>
            <label>Class *<select className="form-select form-select-sm" value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value, sectionId: '' })} required>
              <option value="">Select class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
            <label>Section<select className="form-select form-select-sm" value={form.sectionId} onChange={e => setForm({ ...form, sectionId: e.target.value })} disabled={!form.classId}>
              <option value="">All sections</option>
              {(selectedClass?.sections || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
            <label>Booking Deadline<input type="date" className="form-control form-control-sm" value={form.bookingDeadline} onChange={e => setForm({ ...form, bookingDeadline: e.target.value })} /></label>
            <label>Status<select className="form-select form-select-sm" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="draft">Draft</option><option value="availability_open">Availability open</option>
              <option value="booking_open">Booking open</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
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
          <thead><tr><th>Date</th><th>Class</th><th>Section</th><th>Slots</th><th>Booked</th><th>Status</th><th>Booking Deadline</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8}><Loading /></td></tr> :
            schedules.length === 0 ? <tr><td colSpan={8}><Empty text="No PTM sessions yet" icon="bi-calendar-check" /></td></tr> :
            schedules.map(s => (
              <tr key={s.id}>
                <td>{s.ptm_date ? fmtDate(s.ptm_date) : '—'}</td>
                <td>{s.class_name || '—'}</td>
                <td>{s.section_name || 'All'}</td>
                <td>{s.slot_count || 0}</td>
                <td>{s.booked_count || 0}</td>
                <td>
                  <select className="form-select form-select-sm" style={{ minWidth: 140 }} value={s.status} onChange={e => changeStatus(s, e.target.value)}>
                    <option value="draft">Draft</option><option value="availability_open">Availability open</option>
                    <option value="booking_open">Booking open</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
                  </select>
                </td>
                <td>{s.booking_deadline ? fmtDate(s.booking_deadline) : '—'}</td>
                <td className="text-end no-print">
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => openPanel(s, 'slots')}><i className="bi bi-clock"></i> Slots</button>
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => openPanel(s, 'bookings')}><i className="bi bi-people"></i> Bookings</button>
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editSchedule(s)}><i className="bi bi-pencil"></i></button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => deleteSchedule(s.id)}><i className="bi bi-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {active && (
        <div className="school-form-card mt-3">
          <div className="school-form-head">
            <h6>{panel === 'slots' ? 'Slots' : 'Bookings'} — {active.class_name} {active.section_name ? `/ ${active.section_name}` : ''} ({fmtDate(active.ptm_date)})</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setActive(null)}>Close</button>
          </div>

          {panel === 'slots' ? (
            <>
              <form className="school-form-grid mb-3" onSubmit={addSlot}>
                <label>Teacher *<select className="form-select form-select-sm" value={slotForm.teacherId} onChange={e => setSlotForm({ ...slotForm, teacherId: e.target.value })} required>
                  <option value="">Select teacher</option>
                  {teachers.map(t => <option key={t.staff_id || t.id} value={t.staff_id || t.id}>{t.name}</option>)}
                </select></label>
                <label>Start *<input type="time" className="form-control form-control-sm" value={slotForm.startTime} onChange={e => setSlotForm({ ...slotForm, startTime: e.target.value })} required /></label>
                <label>End *<input type="time" className="form-control form-control-sm" value={slotForm.endTime} onChange={e => setSlotForm({ ...slotForm, endTime: e.target.value })} required /></label>
                <label>Max Bookings<input type="number" min="1" className="form-control form-control-sm" value={slotForm.maxBookings} onChange={e => setSlotForm({ ...slotForm, maxBookings: e.target.value })} /></label>
                <div className="d-flex align-items-end"><button className="btn btn-sm btn-primary" type="submit"><i className="bi bi-plus"></i> Add Slot</button></div>
              </form>
              <div className="school-table-wrap">
                <table className="table table-sm school-table">
                  <thead><tr><th>Teacher</th><th>Start</th><th>End</th><th>Max</th><th>Booked</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {slots.length === 0 ? <tr><td colSpan={7}><Empty text="No slots yet" icon="bi-clock" /></td></tr> :
                    slots.map(sl => (
                      <tr key={sl.id}>
                        <td>{sl.teacher_name || '—'}</td>
                        <td>{sl.start_time}</td>
                        <td>{sl.end_time}</td>
                        <td>{sl.max_bookings}</td>
                        <td>{sl.booked_count || 0}</td>
                        <td><Badge status={sl.status}>{sl.status}</Badge></td>
                        <td className="text-end"><button className="btn btn-sm btn-outline-danger" onClick={() => deleteSlot(sl.id)}><i className="bi bi-trash"></i></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="school-table-wrap">
              <table className="table table-sm school-table">
                <thead><tr><th>Student</th><th>Admission No</th><th>Teacher</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
                <tbody>
                  {bookings.length === 0 ? <tr><td colSpan={6}><Empty text="No bookings yet" icon="bi-people" /></td></tr> :
                  bookings.map(b => (
                    <tr key={b.id}>
                      <td>{[b.first_name, b.last_name].filter(Boolean).join(' ') || '—'}</td>
                      <td>{b.admission_no || '—'}</td>
                      <td>{b.teacher_name || '—'}</td>
                      <td>{b.start_time || '—'}</td>
                      <td>{b.end_time || '—'}</td>
                      <td><Badge status={b.status}>{b.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
