import React, { useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../../../api';
import {
  Badge, Empty, ErrorBox, Loading, PageShell, StatusBadge, canManage, perform, today,
} from './shared';

const ROOM_TYPES = ['classroom', 'lab', 'library', 'hall', 'sports', 'other'];

const emptyForm = (campusId = '') => ({
  id: null,
  campusId: campusId ? String(campusId) : '',
  building: '',
  code: '',
  name: '',
  roomType: 'classroom',
  capacity: '40',
  facilities: '',
  isActive: true,
});

const emptyCheck = { roomId: '', dayOfWeek: '', periodNo: '', startTime: '', endTime: '', examDate: '' };

export default function Rooms({ me, campusId, onNavigate }) {
  const campuses = me?.campuses || [];
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(emptyForm(campusId || me?.defaultCampusId));
  const [check, setCheck] = useState(emptyCheck);
  const [checkResult, setCheckResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const manager = canManage(me);

  async function load() {
    const result = await apiGet('/school/rooms?includeInactive=true');
    if (!result?.ok) throw new Error(result?.error || 'Could not load rooms');
    setRooms(result.rooms || []);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    load()
      .catch((err) => { if (active) setError(err.message || 'Could not load rooms'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => rooms.filter((room) => {
    if (!showArchived && !room.is_active) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return String(room.code || '').toLowerCase().includes(needle)
      || String(room.name || '').toLowerCase().includes(needle)
      || String(room.building || '').toLowerCase().includes(needle);
  }), [rooms, showArchived, query]);

  const activeRooms = rooms.filter((room) => room.is_active);
  const totalCapacity = activeRooms.reduce((sum, room) => sum + Number(room.capacity || 0), 0);
  const bookedRooms = activeRooms.filter((room) => Number(room.timetable_bookings) + Number(room.exam_bookings) > 0).length;

  async function refresh() {
    await load();
  }

  async function submit(event) {
    event.preventDefault();
    if (!manager) return;
    const capacity = Number(form.capacity);
    if (!form.campusId) return window.alert('Choose a campus');
    if (!form.code.trim()) return window.alert('Room code is required');
    if (!form.name.trim()) return window.alert('Room name is required');
    if (!Number.isFinite(capacity) || capacity <= 0) return window.alert('Capacity must be greater than zero');
    setBusy(true);
    try {
      const body = {
        campusId: form.campusId,
        building: form.building.trim(),
        code: form.code.trim(),
        name: form.name.trim(),
        roomType: form.roomType,
        capacity,
        facilities: form.facilities.split(',').map((item) => item.trim()).filter(Boolean),
        isActive: form.isActive,
      };
      const result = form.id
        ? await perform(() => apiPut(`/school/rooms/${form.id}`, body), { success: 'Room updated', refresh })
        : await perform(() => apiPost('/school/rooms', body), { success: 'Room created', refresh });
      if (result) setForm(emptyForm(form.campusId));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(room) {
    if (!manager) return;
    if (!window.confirm(`${room.is_active ? 'Archive' : 'Restore'} ${room.code}?`)) return;
    setBusy(true);
    try {
      await perform(() => apiPut(`/school/rooms/${room.id}`, {
        campusId: room.campus_id,
        building: room.building || '',
        code: room.code,
        name: room.name,
        roomType: room.room_type,
        capacity: room.capacity,
        facilities: room.facilities || [],
        isActive: !room.is_active,
      }), { success: room.is_active ? 'Room archived' : 'Room restored', refresh });
    } finally {
      setBusy(false);
    }
  }

  async function remove(room) {
    if (!manager) return;
    if (!window.confirm(`Delete ${room.code}? This only succeeds when no timetable or exam booking uses it.`)) return;
    setBusy(true);
    try {
      await perform(() => apiDelete(`/school/rooms/${room.id}`), { success: 'Room deleted', refresh });
    } finally {
      setBusy(false);
    }
  }

  async function runCheck(event) {
    event.preventDefault();
    if (!check.roomId) return window.alert('Choose a room to check');
    const params = new URLSearchParams();
    if (check.dayOfWeek) params.set('dayOfWeek', check.dayOfWeek);
    if (check.periodNo) params.set('periodNo', check.periodNo);
    if (check.startTime) params.set('startTime', check.startTime);
    if (check.endTime) params.set('endTime', check.endTime);
    if (check.examDate) params.set('examDate', check.examDate);
    setChecking(true);
    setCheckResult(null);
    try {
      const result = await apiGet(`/school/rooms/${check.roomId}/conflicts?${params.toString()}`);
      if (!result?.ok) throw new Error(result?.error || 'Could not check availability');
      setCheckResult({ conflicts: result.conflicts || [], message: result.message });
    } catch (err) {
      setCheckResult({ conflicts: [], message: err.message || 'Could not check availability', error: true });
    } finally {
      setChecking(false);
    }
  }

  function edit(room) {
    setForm({
      id: room.id,
      campusId: room.campus_id ? String(room.campus_id) : '',
      building: room.building || '',
      code: room.code,
      name: room.name,
      roomType: room.room_type || 'classroom',
      capacity: String(room.capacity ?? 40),
      facilities: Array.isArray(room.facilities) ? room.facilities.join(', ') : '',
      isActive: room.is_active !== false,
    });
  }

  return (
    <PageShell
      title="Rooms"
      icon="bi-door-open"
      subtitle="Canonical academic rooms. Timetable and exam bookings reference the room ID, not free text."
      onNavigate={onNavigate}
      actions={(
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { load().catch((err) => setError(err.message)); }} disabled={loading || busy}>
          <i className="bi bi-arrow-clockwise me-1"></i>Refresh
        </button>
      )}
    >
      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Active rooms</div><div className="fs-5 fw-bold">{activeRooms.length}</div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Total seats</div><div className="fs-5 fw-bold">{totalCapacity}</div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Rooms with bookings</div><div className="fs-5 fw-bold">{bookedRooms}</div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Archived</div><div className="fs-5 fw-bold">{rooms.length - activeRooms.length}</div></div></div>
      </div>

      <ErrorBox message={error} onRetry={() => { setError(''); setLoading(true); load().catch((err) => setError(err.message)).finally(() => setLoading(false)); }} />

      <div className="row g-3">
        <div className="col-lg-4">
          <div className="border rounded p-3 mb-3">
            <h6 className="fw-bold">{form.id ? 'Edit room' : 'Add room'}</h6>
            <form onSubmit={submit}>
              <label className="form-label small">Campus *</label>
              <select className="form-select form-select-sm mb-2" value={form.campusId} onChange={(event) => setForm({ ...form, campusId: event.target.value })} disabled={!manager || busy}>
                <option value="">Choose campus</option>
                {campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}
              </select>

              <div className="row g-2">
                <div className="col-6">
                  <label className="form-label small">Room code *</label>
                  <input className="form-control form-control-sm mb-2" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} disabled={!manager || busy} />
                </div>
                <div className="col-6">
                  <label className="form-label small">Building</label>
                  <input className="form-control form-control-sm mb-2" value={form.building} onChange={(event) => setForm({ ...form, building: event.target.value })} disabled={!manager || busy} />
                </div>
              </div>

              <label className="form-label small">Room name *</label>
              <input className="form-control form-control-sm mb-2" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} disabled={!manager || busy} />

              <div className="row g-2">
                <div className="col-6">
                  <label className="form-label small">Type</label>
                  <select className="form-select form-select-sm mb-2" value={form.roomType} onChange={(event) => setForm({ ...form, roomType: event.target.value })} disabled={!manager || busy}>
                    {ROOM_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small">Capacity *</label>
                  <input type="number" className="form-control form-control-sm mb-2" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} disabled={!manager || busy} />
                </div>
              </div>

              <label className="form-label small">Facilities</label>
              <input className="form-control form-control-sm mb-2" placeholder="projector, smart board, AC" value={form.facilities} onChange={(event) => setForm({ ...form, facilities: event.target.value })} disabled={!manager || busy} />

              <div className="form-check form-switch mb-2">
                <input className="form-check-input" type="checkbox" id="room-active" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} disabled={!manager || busy} />
                <label className="form-check-label small" htmlFor="room-active">Active</label>
              </div>

              <div className="d-flex gap-2">
                <button className="btn btn-sm btn-primary" disabled={!manager || busy}><i className="bi bi-check2 me-1"></i>{form.id ? 'Save' : 'Create'}</button>
                {form.id && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setForm(emptyForm(form.campusId))} disabled={busy}>Cancel</button>}
              </div>
              {!manager && <div className="small text-muted mt-2">You have read-only access to academics.</div>}
            </form>
          </div>

          <div className="border rounded p-3">
            <h6 className="fw-bold">Availability check</h6>
            <form onSubmit={runCheck}>
              <label className="form-label small">Room *</label>
              <select className="form-select form-select-sm mb-2" value={check.roomId} onChange={(event) => setCheck({ ...check, roomId: event.target.value })}>
                <option value="">Choose room</option>
                {activeRooms.map((room) => <option key={room.id} value={room.id}>{room.code} Ã‚Â· {room.name}</option>)}
              </select>
              <div className="row g-2">
                <div className="col-6">
                  <label className="form-label small">Exam date</label>
                  <input type="date" className="form-control form-control-sm mb-2" value={check.examDate} onChange={(event) => setCheck({ ...check, examDate: event.target.value })} min={today()} />
                </div>
                <div className="col-6">
                  <label className="form-label small">Day of week</label>
                  <select className="form-select form-select-sm mb-2" value={check.dayOfWeek} onChange={(event) => setCheck({ ...check, dayOfWeek: event.target.value })}>
                    <option value="">None</option>
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((label, index) => (
                      <option key={label} value={index + 1}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small">Period</label>
                  <input type="number" className="form-control form-control-sm mb-2" value={check.periodNo} onChange={(event) => setCheck({ ...check, periodNo: event.target.value })} placeholder="e.g. 2" />
                </div>
                <div className="col-6">
                  <label className="form-label small">Start time</label>
                  <input type="time" className="form-control form-control-sm mb-2" value={check.startTime} onChange={(event) => setCheck({ ...check, startTime: event.target.value })} />
                </div>
                <div className="col-6">
                  <label className="form-label small">End time</label>
                  <input type="time" className="form-control form-control-sm mb-2" value={check.endTime} onChange={(event) => setCheck({ ...check, endTime: event.target.value })} />
                </div>
              </div>
              <button className="btn btn-sm btn-outline-primary" disabled={checking}><i className="bi bi-search me-1"></i>Check</button>
            </form>
            {checkResult && (
              <div className={`alert ${checkResult.conflicts.length ? 'alert-warning' : checkResult.error ? 'alert-danger' : 'alert-success'} small mt-3 mb-0`}>
                {checkResult.conflicts.length ? (
                  <>
                    <div className="fw-semibold">{checkResult.message}</div>
                    <ul className="mb-0 ps-3">
                      {checkResult.conflicts.map((conflict) => (
                        <li key={`${conflict.source}-${conflict.id}`}>
                          {conflict.source === 'exam'
                            ? `Exam on ${String(conflict.exam_date).slice(0, 10)} ${conflict.start_time || ''}Ã¢â‚¬â€œ${conflict.end_time || ''}`
                            : `Timetable day ${conflict.day_of_week}${conflict.period_no ? `, period ${conflict.period_no}` : ''} ${conflict.start_time || ''}Ã¢â‚¬â€œ${conflict.end_time || ''}`}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : checkResult.error ? checkResult.message : 'No conflicts for that room and slot.'}
              </div>
            )}
          </div>
        </div>

        <div className="col-lg-8">
          <div className="row g-2 mb-2">
            <div className="col-sm-6">
              <input className="form-control form-control-sm" placeholder="Search code, name or buildingÃ¢â‚¬Â¦" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <div className="col-sm-6 d-flex align-items-center">
              <div className="form-check form-switch mb-0">
                <input className="form-check-input" type="checkbox" id="rooms-show-archived" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
                <label className="form-check-label" htmlFor="rooms-show-archived">Show archived rooms</label>
              </div>
            </div>
          </div>

          {loading ? <Loading text="Loading roomsÃ¢â‚¬Â¦" /> : visible.length === 0 ? (
            <Empty icon="bi-door-open" text="No rooms match this view. Create a room before assigning timetable or exam venues." />
          ) : (
            <div className="table-responsive border rounded">
              <table className="table table-sm mb-0 align-middle">
                <thead><tr><th>Room</th><th>Campus / building</th><th>Type</th><th>Capacity</th><th>Bookings</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
                <tbody>
                  {visible.map((room) => (
                    <tr key={room.id}>
                      <td className="fw-semibold">{room.code}<div className="small text-muted fw-normal">{room.name}</div></td>
                      <td className="small">{room.campus_name || 'Ã¢â‚¬â€'}{room.building ? <div className="text-muted">{room.building}</div> : null}</td>
                      <td className="small">{room.room_type || 'Ã¢â‚¬â€'}</td>
                      <td>{room.capacity}</td>
                      <td className="small">
                        {Number(room.timetable_bookings) + Number(room.exam_bookings) > 0 ? (
                          <><Badge tone="info">{room.timetable_bookings} timetable</Badge> <Badge tone="secondary">{room.exam_bookings} exam</Badge></>
                        ) : <span className="text-muted">None</span>}
                      </td>
                      <td><StatusBadge active={room.is_active} /></td>
                      <td className="text-end">
                        <div className="d-flex gap-1 justify-content-end">
                          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => edit(room)} disabled={!manager || busy}><i className="bi bi-pencil"></i></button>
                          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => toggle(room)} disabled={!manager || busy}>{room.is_active ? 'Archive' : 'Restore'}</button>
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remove(room)} disabled={!manager || busy}><i className="bi bi-trash"></i></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="small text-muted mt-2">
            Room codes are unique per campus. Archiving keeps historical bookings readable while blocking new ones.
          </div>
        </div>
      </div>
    </PageShell>
  );
}

