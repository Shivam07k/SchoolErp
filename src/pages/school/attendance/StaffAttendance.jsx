import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../../api';
import { toast } from '../../../toast';
import {
  Badge, Empty, ErrorBox, Loading, PageShell, canMark, fmtDate, fmtDateTime, fmtTime, today,
} from './shared';

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
  { value: 'half_day', label: 'Half day' },
  { value: 'on_leave', label: 'On leave' },
  { value: 'on_duty', label: 'On duty' },
];

const LEAVE_TYPES = ['casual', 'sick', 'earned', 'maternity', 'paternity', 'study', 'other'];

const clock = (value) => {
  if (!value) return 'Ã¢â‚¬â€';
  const text = String(value);
  const match = text.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : text.slice(0, 5);
};
const utcInput = (value) => (value ? String(value).slice(0, 16) : '');
const utcIso = (value) => {
  if (!value) return '';
  const [day, time] = value.split('T');
  return `${day}T${time.length === 5 ? `${time}:00` : time}Z`;
};

function statusTone(status) {
  return {
    present: 'success',
    absent: 'danger',
    late: 'warning',
    half_day: 'info',
    on_leave: 'primary',
    on_duty: 'secondary',
  }[status] || 'secondary';
}

export default function StaffAttendance({ me, onNavigate, campusId }) {
  const manager = canMark(me);
  const [date, setDate] = useState(today());
  const [view, setView] = useState('daily');
  const [employees, setEmployees] = useState([]);
  const [staff, setStaff] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [staffLeave, setStaffLeave] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [outbox, setOutbox] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    employeeId: '', attendanceDate: '', checkIn: '', checkOut: '', status: 'present', shiftId: '', leaveId: '',
  });
  const [shiftForm, setShiftForm] = useState({
    name: 'General shift', startTime: '08:00', endTime: '16:00', graceMinutes: 10,
    halfDayAfterMinutes: 240, expectedMinutes: 480, effectiveFrom: today(),
  });
  const [leaveForm, setLeaveForm] = useState({
    employeeId: '', leaveType: 'casual', startDate: today(), endDate: today(), reason: '',
  });

  const todayRows = useMemo(() => {
    const map = {};
    staff.forEach((row) => { map[String(row.employee_id)] = row; });
    return map;
  }, [staff]);

  const approvedLeaveFor = (employeeId) => staffLeave.filter((leave) => (
    String(leave.employee_id) === String(employeeId)
    && leave.status === 'approved'
    && String(leave.start_date).slice(0, 10) <= date
    && String(leave.end_date).slice(0, 10) >= date
  ));

  async function loadEmployees() {
    const hr = await apiGet('/school/hr/employees');
    if (hr?.ok) {
      setEmployees((hr.employees || []).filter((e) => String(e.status || 'active') !== 'inactive'));
      return;
    }
    const teachers = await apiGet('/school/academics/teachers');
    if (teachers?.ok) {
      setEmployees((teachers.teachers || [])
        .filter((t) => t.source === 'employee')
        .map((t) => ({
          id: t.id, employee_no: t.id, first_name: t.name, last_name: '', designation: t.designation,
        })));
    }
  }

  async function loadData(forDate = date) {
    const params = new URLSearchParams({ date: forDate });
    const shiftParams = new URLSearchParams();
    if (campusId) shiftParams.set('campusId', String(campusId));
    const [staffResult, shiftResult, leaveResult, availabilityResult, outboxResult] = await Promise.all([
      apiGet(`/school/attendance/staff?${params.toString()}`),
      apiGet(`/school/attendance/staff-shifts${shiftParams.size ? `?${shiftParams}` : ''}`),
      apiGet('/school/attendance/staff-leave'),
      apiGet(`/school/attendance/staff-availability?${params.toString()}`),
      apiGet('/school/attendance/outbox?status=pending'),
    ]);
    if (!staffResult?.ok) throw new Error(staffResult?.error || 'Could not load staff attendance');
    setStaff(staffResult.staff || []);
    setShifts(shiftResult?.ok ? shiftResult.shifts || [] : []);
    setStaffLeave(leaveResult?.ok ? leaveResult.staffLeave || [] : []);
    setAvailability(availabilityResult?.ok ? availabilityResult.availability || [] : []);
    setOutbox(outboxResult?.ok ? outboxResult.outbox || [] : []);
  }

  useEffect(() => {
    loadEmployees()
      .catch((err) => setError(err.message || 'Could not load employees'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setForm((current) => ({ ...current, attendanceDate: date }));
    setLoading(true);
    loadData(date)
      .catch((err) => setError(err.message || 'Could not load staff attendance'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    if (form.employeeId || !employees.length) return;
    setForm((current) => ({ ...current, employeeId: String(employees[0].id) }));
    setLeaveForm((current) => ({ ...current, employeeId: String(employees[0].id) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees]);

  function startMark(employee) {
    const row = todayRows[String(employee.id)];
    setForm({
      employeeId: String(employee.id),
      attendanceDate: date,
      checkIn: utcInput(row?.check_in),
      checkOut: utcInput(row?.check_out),
      status: row?.status || 'present',
      shiftId: row?.shift_id ? String(row.shift_id) : '',
      leaveId: row?.leave_id ? String(row.leave_id) : '',
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveAttendance(event) {
    event.preventDefault();
    if (!form.employeeId) return toast('Choose a staff member', 'warning');
    setBusy(true);
    try {
      const body = {
        employeeId: Number(form.employeeId),
        attendanceDate: form.attendanceDate || date,
        status: form.status,
      };
      if (form.checkIn) body.checkIn = utcIso(form.checkIn);
      if (form.checkOut) body.checkOut = utcIso(form.checkOut);
      if (form.shiftId) body.shiftId = Number(form.shiftId);
      if (form.leaveId) body.leaveId = Number(form.leaveId);
      const result = await apiPost('/school/attendance/staff', body);
      if (!result?.ok) return toast(result?.error || 'Could not save staff attendance', 'error');
      toast(result.availabilityType
        ? `Saved as ${result.staff.status}. Availability signal "${result.availabilityType}" is ready to publish.`
        : `Saved as ${result.staff.status}`, 'success');
      await loadData(date);
    } catch (err) {
      toast(err.message || 'Could not save staff attendance', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function createShift(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const body = {
        name: shiftForm.name,
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        graceMinutes: Number(shiftForm.graceMinutes),
        halfDayAfterMinutes: Number(shiftForm.halfDayAfterMinutes),
        expectedMinutes: Number(shiftForm.expectedMinutes),
        effectiveFrom: shiftForm.effectiveFrom,
      };
      if (campusId) body.campusId = Number(campusId);
      const result = await apiPost('/school/attendance/staff-shifts', body);
      if (!result?.ok) return toast(result?.error || 'Could not create the shift', 'error');
      toast('Shift policy created', 'success');
      await loadData(date);
    } catch (err) {
      toast(err.message || 'Could not create the shift', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function createLeave(event) {
    event.preventDefault();
    if (!leaveForm.employeeId) return toast('Choose a staff member', 'warning');
    setBusy(true);
    try {
      const result = await apiPost('/school/attendance/staff-leave', {
        employeeId: Number(leaveForm.employeeId),
        leaveType: leaveForm.leaveType,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        reason: leaveForm.reason,
      });
      if (!result?.ok) return toast(result?.error || 'Could not create staff leave', 'error');
      toast('Staff leave requested', 'success');
      setLeaveForm((current) => ({ ...current, reason: '' }));
      await loadData(date);
    } catch (err) {
      toast(err.message || 'Could not request staff leave', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function decideLeave(leave, status) {
    if (!window.confirm(`${status === 'approved' ? 'Approve' : 'Reject'} this leave request?`)) return;
    setBusy(true);
    try {
      const result = await apiPut(`/school/attendance/staff-leave/${leave.id}`, { status });
      if (!result?.ok) return toast(result?.error || 'Could not record the decision', 'error');
      toast(status === 'approved'
        ? `Leave approved. ${result.availabilityPublished} availability day(s) queued for publication.`
        : `Leave ${status}`, 'success');
      await loadData(date);
    } catch (err) {
      toast(err.message || 'Could not record the leave decision', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function publishAvailability() {
    setBusy(true);
    try {
      const result = await apiPost('/school/attendance/staff-availability/publish', { date });
      if (!result?.ok) return toast(result?.error || 'Could not publish availability', 'error');
      toast(`${result.published} availability record(s) published`, 'success');
      await loadData(date);
    } catch (err) {
      toast(err.message || 'Could not publish availability', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function processOutbox() {
    setBusy(true);
    try {
      const result = await apiPost('/school/attendance/outbox/process', { limit: 50 });
      if (!result?.ok) return toast(result?.error || 'Could not process notifications', 'error');
      const deliveryNote = result.error ? ` (${result.error})` : '';
      toast(`Processed ${result.processed}: ${result.delivered} delivered, ${result.failed} failed${deliveryNote}`, result.failed ? 'warning' : 'success');
      await loadData(date);
    } catch (err) {
      toast(err.message || 'Could not process notifications', 'error');
    } finally {
      setBusy(false);
    }
  }

  const markedToday = staff.length;
  const absentToday = staff.filter((s) => s.status === 'absent').length;
  const lateToday = staff.filter((s) => s.status === 'late').length;

  return (
    <PageShell
      title="Staff Attendance"
      icon="bi-person-badge"
      subtitle="Separate from student attendance. Mark daily staff status, derive late/early/worked minutes from the effective shift, and publish availability for substitution."
      onNavigate={onNavigate}
      actions={(
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setLoading(true); loadData(date).catch((err) => setError(err.message)).finally(() => setLoading(false)); }} disabled={loading || busy}>
          <i className="bi bi-arrow-clockwise me-1"></i>Refresh
        </button>
      )}
    >
      <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
        <div>
          <label className="form-label small mb-1">Date</label>
          <input type="date" className="form-control form-control-sm" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <ul className="nav nav-pills nav-sm ms-auto">
          {[
            ['daily', 'Daily marking'],
            ['leave', 'Staff leave'],
            ['availability', 'Availability'],
            ['outbox', `Notifications${outbox.length ? ` (${outbox.length})` : ''}`],
          ].map(([key, label]) => (
            <li className="nav-item" key={key}>
              <button type="button" className={`nav-link py-1 px-3 ${view === key ? 'active' : ''}`} onClick={() => setView(key)}>{label}</button>
            </li>
          ))}
        </ul>
      </div>

      <ErrorBox message={error} onRetry={() => { setError(''); loadData(date).catch((err) => setError(err.message)); }} />

      {loading ? <Loading text="Loading staff attendanceÃ¢â‚¬Â¦" /> : (
        <>
          {view === 'daily' && (
            <>
              <div className="row g-2 mb-3">
                <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Active staff</div><div className="fs-5 fw-bold">{employees.length}</div></div></div>
                <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Marked today</div><div className="fs-5 fw-bold">{markedToday}</div></div></div>
                <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Absent</div><div className="fs-5 fw-bold text-danger">{absentToday}</div></div></div>
                <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Late</div><div className="fs-5 fw-bold text-warning">{lateToday}</div></div></div>
              </div>

              <div className="row g-3">
                <div className="col-lg-4">
                  <div className="border rounded p-3">
                    <h6 className="fw-bold">Mark staff attendance</h6>
                    <form onSubmit={saveAttendance}>
                      <label className="form-label small">Staff member *</label>
                      <select className="form-select form-select-sm mb-2" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value, leaveId: '' })} disabled={!manager || busy}>
                        <option value="">Choose staff</option>
                        {employees.map((e) => (
                          <option key={e.id} value={e.id}>{e.first_name} {e.last_name || ''}{e.employee_no ? ` Ã‚Â· ${e.employee_no}` : ''}</option>
                        ))}
                      </select>
                      <div className="row g-2">
                        <div className="col-6">
                          <label className="form-label small">Check-in</label>
                          <input type="datetime-local" className="form-control form-control-sm mb-2" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} disabled={!manager || busy} />
                        </div>
                        <div className="col-6">
                          <label className="form-label small">Check-out</label>
                          <input type="datetime-local" className="form-control form-control-sm mb-2" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} disabled={!manager || busy} />
                        </div>
                      </div>
                      <label className="form-label small">Status</label>
                      <select className="form-select form-select-sm mb-2" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} disabled={!manager || busy}>
                        {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                      <label className="form-label small">Shift</label>
                      <select className="form-select form-select-sm mb-2" value={form.shiftId} onChange={(e) => setForm({ ...form, shiftId: e.target.value })} disabled={!manager || busy}>
                        <option value="">Auto (effective shift)</option>
                        {shifts.filter((s) => s.is_active !== false).map((s) => (
                          <option key={s.id} value={s.id}>{s.name} ({fmtTime(s.start_time)}Ã¢â‚¬â€œ{fmtTime(s.end_time)})</option>
                        ))}
                      </select>
                      <label className="form-label small">Approved leave</label>
                      <select className="form-select form-select-sm mb-3" value={form.leaveId} onChange={(e) => setForm({ ...form, leaveId: e.target.value, status: e.target.value ? 'on_leave' : form.status })} disabled={!manager || busy}>
                        <option value="">None</option>
                        {approvedLeaveFor(form.employeeId).map((leave) => (
                          <option key={leave.id} value={leave.id}>{leave.leave_type} Ã‚Â· {fmtDate(leave.start_date)}Ã¢â‚¬â€œ{fmtDate(leave.end_date)}</option>
                        ))}
                      </select>
                      <button type="submit" className="btn btn-sm btn-primary" disabled={!manager || busy}>
                        <i className="bi bi-check2 me-1"></i>Save attendance
                      </button>
                      {!manager && <div className="small text-muted mt-2">Read-only access.</div>}
                    </form>
                  </div>

                  <details className="border rounded p-3 mt-3">
                    <summary className="fw-bold small">Shift policy</summary>
                    <form className="mt-2" onSubmit={createShift}>
                      <input className="form-control form-control-sm mb-2" value={shiftForm.name} onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })} placeholder="Shift name" disabled={!manager || busy} />
                      <div className="row g-2">
                        <div className="col-6"><input type="time" className="form-control form-control-sm mb-2" value={shiftForm.startTime} onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })} disabled={!manager || busy} /></div>
                        <div className="col-6"><input type="time" className="form-control form-control-sm mb-2" value={shiftForm.endTime} onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })} disabled={!manager || busy} /></div>
                        <div className="col-4"><input type="number" min="0" className="form-control form-control-sm mb-2" value={shiftForm.graceMinutes} onChange={(e) => setShiftForm({ ...shiftForm, graceMinutes: e.target.value })} title="Grace minutes" disabled={!manager || busy} /></div>
                        <div className="col-4"><input type="number" min="0" className="form-control form-control-sm mb-2" value={shiftForm.halfDayAfterMinutes} onChange={(e) => setShiftForm({ ...shiftForm, halfDayAfterMinutes: e.target.value })} title="Half-day threshold" disabled={!manager || busy} /></div>
                        <div className="col-4"><input type="number" min="0" className="form-control form-control-sm mb-2" value={shiftForm.expectedMinutes} onChange={(e) => setShiftForm({ ...shiftForm, expectedMinutes: e.target.value })} title="Expected minutes" disabled={!manager || busy} /></div>
                      </div>
                      <input type="date" className="form-control form-control-sm mb-2" value={shiftForm.effectiveFrom} onChange={(e) => setShiftForm({ ...shiftForm, effectiveFrom: e.target.value })} disabled={!manager || busy} />
                      <button type="submit" className="btn btn-sm btn-outline-primary" disabled={!manager || busy}>Create shift</button>
                    </form>
                    <div className="small text-muted mt-2">{shifts.length} shift polic{shifts.length === 1 ? 'y' : 'ies'} configured.</div>
                  </details>
                </div>

                <div className="col-lg-8">
                  <div className="table-responsive border rounded">
                    <table className="table table-sm mb-0 align-middle">
                      <thead><tr><th>Staff</th><th>Designation</th><th>Status</th><th>In / Out</th><th>Late / Early / Worked</th><th className="text-end">Action</th></tr></thead>
                      <tbody>
                        {employees.length === 0 && <tr><td colSpan="6"><Empty icon="bi-person-badge" text="No active staff found." /></td></tr>}
                        {employees.map((employee) => {
                          const row = todayRows[String(employee.id)];
                          return (
                            <tr key={employee.id}>
                              <td>
                                <div className="fw-semibold">{employee.first_name} {employee.last_name || ''}</div>
                                <div className="small text-muted">{employee.employee_no || employee.id}</div>
                              </td>
                              <td className="small">{employee.designation || 'Ã¢â‚¬â€'}</td>
                              <td>{row ? <Badge tone={statusTone(row.status)}>{row.status.replace('_', ' ')}</Badge> : <Badge tone="secondary">not marked</Badge>}</td>
                              <td className="small">{clock(row?.check_in)} / {clock(row?.check_out)}</td>
                              <td className="small">
                                {row ? `${row.late_minutes || 0} / ${row.early_minutes || 0} / ${row.worked_minutes || 0} min` : 'Ã¢â‚¬â€'}
                              </td>
                              <td className="text-end">
                                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => startMark(employee)} disabled={!manager || busy}>
                                  {row ? 'Edit' : 'Mark'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="small text-muted mt-2">
                    Late, early and worked minutes are derived from the effective shift. Raw check-in/check-out values are preserved.
                  </div>
                </div>
              </div>
            </>
          )}

          {view === 'leave' && (
            <div className="row g-3">
              <div className="col-lg-4">
                <div className="border rounded p-3">
                  <h6 className="fw-bold">Request staff leave</h6>
                  <form onSubmit={createLeave}>
                    <select className="form-select form-select-sm mb-2" value={leaveForm.employeeId} onChange={(e) => setLeaveForm({ ...leaveForm, employeeId: e.target.value })} disabled={!manager || busy}>
                      <option value="">Choose staff</option>
                      {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name || ''}</option>)}
                    </select>
                    <select className="form-select form-select-sm mb-2" value={leaveForm.leaveType} onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })} disabled={!manager || busy}>
                      {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div className="row g-2">
                      <div className="col-6"><input type="date" className="form-control form-control-sm mb-2" value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} disabled={!manager || busy} /></div>
                      <div className="col-6"><input type="date" className="form-control form-control-sm mb-2" value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} disabled={!manager || busy} /></div>
                    </div>
                    <input className="form-control form-control-sm mb-2" value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="Reason" disabled={!manager || busy} />
                    <button type="submit" className="btn btn-sm btn-primary" disabled={!manager || busy}>Request leave</button>
                  </form>
                </div>
              </div>
              <div className="col-lg-8">
                <div className="table-responsive border rounded">
                  <table className="table table-sm mb-0 align-middle">
                    <thead><tr><th>Staff</th><th>Type</th><th>Dates</th><th>Reason</th><th>Status</th><th className="text-end">Decision</th></tr></thead>
                    <tbody>
                      {staffLeave.length === 0 && <tr><td colSpan="6"><Empty icon="bi-calendar-x" text="No staff leave requests yet." /></td></tr>}
                      {staffLeave.map((leave) => (
                        <tr key={leave.id}>
                          <td className="small fw-semibold">{leave.employee_name}</td>
                          <td className="small">{leave.leave_type}</td>
                          <td className="small text-nowrap">{fmtDate(leave.start_date)} Ã¢â‚¬â€œ {fmtDate(leave.end_date)}</td>
                          <td className="small">{leave.reason || 'Ã¢â‚¬â€'}</td>
                          <td><Badge tone={statusTone(leave.status === 'approved' ? 'on_leave' : leave.status === 'rejected' ? 'absent' : 'late')}>{leave.status}</Badge></td>
                          <td className="text-end">
                            {leave.status === 'pending' && (
                              <div className="d-flex gap-1 justify-content-end">
                                <button type="button" className="btn btn-sm btn-success" onClick={() => decideLeave(leave, 'approved')} disabled={!manager || busy}>Approve</button>
                                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => decideLeave(leave, 'rejected')} disabled={!manager || busy}>Reject</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="small text-muted mt-2">Approving leave publishes daily unavailability signals. It does not create substitutions.</div>
              </div>
            </div>
          )}

          {view === 'availability' && (
            <>
              <div className="d-flex align-items-center gap-2 mb-3">
                <div className="small text-muted">Unavailability for {fmtDate(date)} feeds the substitution workflow.</div>
                <button type="button" className="btn btn-sm btn-primary ms-auto" onClick={publishAvailability} disabled={!manager || busy || availability.length === 0}>
                  <i className="bi bi-broadcast me-1"></i>Publish availability
                </button>
              </div>
              <div className="table-responsive border rounded">
                <table className="table table-sm mb-0 align-middle">
                  <thead><tr><th>Staff</th><th>Type</th><th>Source</th><th>Note</th><th>Published</th></tr></thead>
                  <tbody>
                    {availability.length === 0 && <tr><td colSpan="5"><Empty icon="bi-broadcast" text="No availability signals for this date." /></td></tr>}
                    {availability.map((row) => (
                      <tr key={row.id}>
                        <td className="small fw-semibold">{row.employee_name}<div className="text-muted">{row.employee_no}</div></td>
                        <td><Badge tone={statusTone(row.availability_type === 'leave' ? 'on_leave' : row.availability_type)}>{row.availability_type}</Badge></td>
                        <td className="small">{row.source}</td>
                        <td className="small">{row.note || 'Ã¢â‚¬â€'}</td>
                        <td>{row.published ? <Badge tone="success">published</Badge> : <Badge tone="warning">pending</Badge>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {view === 'outbox' && (
            <>
              <div className="d-flex align-items-center gap-2 mb-3">
                <div className="small text-muted">Notifications are queued in a durable outbox and never block attendance marking.</div>
                <button type="button" className="btn btn-sm btn-primary ms-auto" onClick={processOutbox} disabled={!manager || busy || outbox.length === 0}>
                  <i className="bi bi-send me-1"></i>Process pending
                </button>
              </div>
              <div className="table-responsive border rounded">
                <table className="table table-sm mb-0 align-middle">
                  <thead><tr><th>Created</th><th>Event</th><th>Recipient</th><th>Channel</th><th>Attempts</th><th>Status</th><th>Last error</th></tr></thead>
                  <tbody>
                    {outbox.length === 0 && <tr><td colSpan="7"><Empty icon="bi-send" text="No pending notifications." /></td></tr>}
                    {outbox.map((event) => (
                      <tr key={event.id}>
                        <td className="small text-nowrap">{fmtDateTime(event.created_at)}</td>
                        <td className="small">{event.event_type}</td>
                        <td className="small">{event.recipient || 'Ã¢â‚¬â€'}</td>
                        <td className="small">{event.channel}</td>
                        <td className="small">{event.attempts || 0}</td>
                        <td><Badge tone={event.status === 'delivered' ? 'success' : event.status === 'failed' ? 'danger' : 'warning'}>{event.status}</Badge></td>
                        <td className="small text-danger">{event.last_error || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </PageShell>
  );
}
