import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../../api';
import { toast } from '../../../toast';
import {
  PageShell, Loading, Empty, Badge, Tabs, Kpi, Modal, statusBadge,
  fmtDate, fmtDateTime, fmtTime, canHostelManage, LEAVE_TONE, ROLLCALL_STATUS_TONE, studentName,
} from './shared';

const TABS = [
  ['rollcalls', 'Roll Calls', 'bi-clipboard-check'],
  ['leaves', 'Leave & Gate Pass', 'bi-door-open'],
  ['gate', 'Gate Log', 'bi-signpost-split'],
  ['duty', 'Duty & Alerts', 'bi-shield-check'],
  ['incidents', 'Incidents & Complaints', 'bi-exclamation-triangle'],
];

const today = () => new Date().toISOString().slice(0, 10);
const ROLL_STATUSES = ['present', 'absent', 'on_leave', 'sick_bay', 'late'];

export default function HostelAttendance({ me, onNavigate }) {
  const manage = canHostelManage(me, 'hostel.rollcall') || canHostelManage(me, 'hostel.manage');
  const approve = canHostelManage(me, 'hostel.leave_approve') || canHostelManage(me, 'hostel.manage');
  const [tab, setTab] = useState('rollcalls');
  const [loading, setLoading] = useState(true);
  const [hostels, setHostels] = useState([]);
  const [students, setStudents] = useState([]);
  const [rollCalls, setRollCalls] = useState([]);
  const [passes, setPasses] = useState([]);
  const [gateLog, setGateLog] = useState([]);
  const [duty, setDuty] = useState([]);
  const [staff, setStaff] = useState([]);
  const [alerts, setAlerts] = useState({});
  const [compliance, setCompliance] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [complaints, setComplaints] = useState([]);

  const [rcForm, setRcForm] = useState({ hostelId: '', date: today(), session: 'night' });
  const [activeCall, setActiveCall] = useState(null);
  const [activeEntries, setActiveEntries] = useState([]);
  const [correction, setCorrection] = useState({ open: false, reason: '' });

  const [leaveForm, setLeaveForm] = useState({ studentId: '', type: 'outpass', fromDate: today(), toDate: today(), fromTime: '', toTime: '', destination: '', reason: '' });
  const [gateForm, setGateForm] = useState({ studentId: '', direction: 'out', notes: '' });
  const [dutyForm, setDutyForm] = useState({ hostelId: '', staffId: '', dutyDate: today(), shift: 'night', notes: '' });
  const [incidentForm, setIncidentForm] = useState({ type: '', description: '', severity: 'low', studentId: '', actionTaken: '' });
  const [complaintForm, setComplaintForm] = useState({ description: '', category: 'general', studentId: '' });

  async function load() {
    setLoading(true);
    try {
      const [h, s, rc, lp, gl, d, a, nc, inc, cmp] = await Promise.all([
        apiGet('/school/hostel/hostels'),
        apiGet('/school/hostel/students'),
        apiGet('/school/hostel/roll-calls'),
        apiGet('/school/hostel/leave-passes'),
        apiGet('/school/hostel/gate-log'),
        apiGet('/school/hostel/duty'),
        apiGet('/school/hostel/alerts'),
        apiGet('/school/hostel/night-compliance'),
        apiGet('/school/hostel/incidents'),
        apiGet('/school/hostel/complaints'),
      ]);
      if (h?.ok) setHostels(h.hostels || []);
      if (s?.ok) setStudents(s.students || []);
      if (rc?.ok) setRollCalls(rc.rollCalls || []);
      if (lp?.ok) setPasses(lp.passes || []);
      if (gl?.ok) setGateLog(gl.gateLog || []);
      if (d?.ok) setDuty(d.duty || []);
      if (a?.ok) setAlerts(a);
      if (nc?.ok) setCompliance(nc.compliance || []);
      if (inc?.ok) setIncidents(inc.incidents || []);
      if (cmp?.ok) setComplaints(cmp.complaints || []);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    apiGet('/school/hr/staff')
      .then((r) => { if (r?.ok) setStaff(r.staff || []); })
      .catch(() => {});
  }, []);

  const counts = useMemo(() => ({
    calls: rollCalls.filter((r) => r.call_date && String(r.call_date).slice(0, 10) === today()).length,
    pendingLeaves: passes.filter((p) => ['requested', 'guardian_approved'].includes(p.status)).length,
    out: passes.filter((p) => p.status === 'out').length,
    overdue: passes.filter((p) => p.status === 'overdue').length,
    openVisits: alerts.openVisits?.length || 0,
  }), [rollCalls, passes, alerts]);

  async function createRollCall(e) {
    e.preventDefault();
    try {
      const res = await apiPost('/school/hostel/roll-calls', rcForm);
      if (res?.ok) {
        toast('Roll call ready', 'success');
        setActiveCall(res.rollCall);
        setActiveEntries(res.entries || []);
        load();
      } else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function openRollCall(rc) {
    try {
      const res = await apiGet(`/school/hostel/roll-calls/${rc.id}`);
      if (res?.ok) { setActiveCall(res.rollCall); setActiveEntries(res.entries || []); }
    } catch (e) { toast(e.message, 'error'); }
  }

  function setEntryStatus(studentId, status) {
    setActiveEntries((rows) => rows.map((r) => (String(r.student_id) === String(studentId) ? { ...r, status } : r)));
  }

  async function saveRollCall() {
    if (!activeCall) return;
    try {
      const res = await apiPut(`/school/hostel/roll-calls/${activeCall.id}`, {
        entries: activeEntries.map((r) => ({ studentId: r.student_id, status: r.status, remark: r.remark })),
      });
      if (res?.ok) { toast('Roll call saved', 'success'); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function submitRollCall() {
    if (!activeCall) return;
    try {
      const res = await apiPost(`/school/hostel/roll-calls/${activeCall.id}/submit`, {});
      if (res?.ok) {
        toast(`Submitted${res.absentAlerts ? ` Ã‚Â· ${res.absentAlerts} absence alert(s)` : ''}`, 'success');
        setActiveCall(res.rollCall);
        load();
      } else toast(res?.error || 'Failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function submitCorrection() {
    if (!activeCall || !correction.reason.trim()) { toast('Correction reason is required', 'error'); return; }
    try {
      const res = await apiPost(`/school/hostel/roll-calls/${activeCall.id}/correct`, {
        reason: correction.reason,
        entries: activeEntries.map((r) => ({ studentId: r.student_id, status: r.status, remark: r.remark })),
      });
      if (res?.ok) { toast('Correction recorded and audited', 'success'); setCorrection({ open: false, reason: '' }); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function createLeave(e) {
    e.preventDefault();
    try {
      const res = await apiPost('/school/hostel/leave-passes', leaveForm);
      if (res?.ok) { toast(`Leave pass ${res.pass.pass_no} requested`, 'success'); setLeaveForm({ ...leaveForm, studentId: '', reason: '' }); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function leaveAction(pass, action) {
    try {
      if (action === 'otp') {
        const otp = window.prompt('Enter guardian OTP');
        if (!otp) return;
        const res = await apiPost(`/school/hostel/leave-passes/${pass.id}/guardian-otp`, { otp });
        if (res?.ok) toast('Guardian OTP verified', 'success');
        else toast(res?.error || 'Failed', 'error');
      } else if (action === 'reject') {
        const reason = window.prompt('Reason for rejecting the leave pass') || '';
        if (!reason) return;
        const res = await apiPost(`/school/hostel/leave-passes/${pass.id}/reject`, { reason });
        if (res?.ok) toast('Leave pass rejected', 'success');
        else toast(res?.error || 'Failed', 'error');
      } else {
        const res = await apiPost(`/school/hostel/leave-passes/${pass.id}/${action}`, {});
        if (res?.ok) toast(`Leave pass ${action.replace('-', ' ')} recorded`, 'success');
        else toast(res?.error || 'Failed', 'error');
      }
      load();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function addGateEntry(e) {
    e.preventDefault();
    try {
      const res = await apiPost('/school/hostel/gate-log', gateForm);
      if (res?.ok) { toast('Gate entry logged', 'success'); setGateForm({ ...gateForm, studentId: '', notes: '' }); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function saveDuty(e) {
    e.preventDefault();
    try {
      const res = await apiPost('/school/hostel/duty', dutyForm);
      if (res?.ok) { toast('Duty scheduled', 'success'); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function saveIncident(e) {
    e.preventDefault();
    try {
      const res = await apiPost('/school/hostel/incidents', incidentForm);
      if (res?.ok) { toast('Incident logged', 'success'); setIncidentForm({ type: '', description: '', severity: 'low', studentId: '', actionTaken: '' }); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function saveComplaint(e) {
    e.preventDefault();
    try {
      const res = await apiPost('/school/hostel/complaints', complaintForm);
      if (res?.ok) { toast('Complaint logged', 'success'); setComplaintForm({ description: '', category: 'general', studentId: '' }); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function closeComplaint(c) {
    try {
      const res = await apiPut(`/school/hostel/complaints/${c.id}`, { status: 'resolved', resolution: 'Resolved by warden' });
      if (res?.ok) { toast('Complaint resolved', 'success'); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  if (loading) return <Loading />;

  return (
    <PageShell title="Hostel Attendance" icon="bi-calendar-check" subtitle="Roll calls, leave passes, gate log and duty" onNavigate={onNavigate}>
      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3 col-xl-2"><Kpi label="Roll calls today" value={counts.calls} icon="bi-clipboard-check" /></div>
        <div className="col-6 col-md-3 col-xl-2"><Kpi label="Pending leaves" value={counts.pendingLeaves} icon="bi-hourglass" tone="warning" /></div>
        <div className="col-6 col-md-3 col-xl-2"><Kpi label="Students out" value={counts.out} icon="bi-door-open" tone="info" /></div>
        <div className="col-6 col-md-3 col-xl-2"><Kpi label="Overdue" value={counts.overdue} icon="bi-exclamation-triangle" tone="danger" /></div>
        <div className="col-6 col-md-3 col-xl-2"><Kpi label="Open visits" value={counts.openVisits} icon="bi-person-badge" tone="secondary" /></div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'rollcalls' && (
        <div className="row g-3">
          <div className="col-xl-4">
            {manage && (
              <div className="card mb-3"><div className="card-body">
                <h6>Start Roll Call</h6>
                <form onSubmit={createRollCall} className="row g-2">
                  <div className="col-12"><select className="form-select form-select-sm" value={rcForm.hostelId} onChange={(e) => setRcForm({ ...rcForm, hostelId: e.target.value })} required><option value="">Hostel</option>{hostels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
                  <div className="col-6"><input type="date" className="form-control form-control-sm" value={rcForm.date} onChange={(e) => setRcForm({ ...rcForm, date: e.target.value })} /></div>
                  <div className="col-6"><select className="form-select form-select-sm" value={rcForm.session} onChange={(e) => setRcForm({ ...rcForm, session: e.target.value })}><option value="morning">Morning</option><option value="evening">Evening</option><option value="night">Night</option></select></div>
                  <div className="col-12"><button className="btn btn-sm btn-primary w-100">Open Roll Call</button></div>
                </form>
              </div></div>
            )}
            <div className="card"><div className="card-body">
              <h6>Recent Roll Calls</h6>
              <div className="list-group list-group-flush">
                {rollCalls.length === 0 && <Empty icon="bi-clipboard" text="No roll calls" />}
                {rollCalls.map((rc) => (
                  <button key={rc.id} type="button" className="list-group-item list-group-item-action px-0 py-2" onClick={() => openRollCall(rc)}>
                    <div className="d-flex justify-content-between">
                      <span className="fw-semibold small">{rc.hostel_name}</span>
                      <Badge tone={rc.status === 'submitted' || rc.status === 'locked' ? 'success' : 'warning'}>{rc.status}</Badge>
                    </div>
                    <div className="small text-muted">{fmtDate(rc.call_date)} Ã‚Â· {rc.session} Ã‚Â· {rc.present}/{rc.total} present{rc.absent ? ` Ã‚Â· ${rc.absent} absent` : ''}</div>
                  </button>
                ))}
              </div>
            </div></div>
          </div>

          <div className="col-xl-8"><div className="card"><div className="card-body">
            {!activeCall ? <Empty icon="bi-clipboard-check" text="Open a roll call to mark attendance" /> : (
              <>
                <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                  <div>
                    <h6 className="mb-0">{activeCall.hostel_name} Ã‚Â· {activeCall.session}</h6>
                    <div className="small text-muted">{fmtDate(activeCall.call_date)} Ã‚Â· {activeEntries.length} residents</div>
                  </div>
                  <div className="d-flex gap-2">
                    {manage && activeCall.status === 'draft' && (
                      <>
                        <button className="btn btn-sm btn-outline-secondary" onClick={saveRollCall}>Save</button>
                        <button className="btn btn-sm btn-primary" onClick={submitRollCall}>Submit</button>
                      </>
                    )}
                    {manage && activeCall.status !== 'draft' && <button className="btn btn-sm btn-outline-warning" onClick={() => setCorrection({ open: true, reason: '' })}>Correct</button>}
                  </div>
                </div>
                {activeCall.status !== 'draft' && <div className="alert alert-info py-1 small">This roll call is immutable. Use <strong>Correct</strong> to record an audited change.</div>}
                <div className="table-responsive">
                  <table className="table table-sm align-middle">
                    <thead><tr><th>Student</th><th>Room / Bed</th><th>Status</th></tr></thead>
                    <tbody>
                      {activeEntries.map((r) => (
                        <tr key={r.id || r.student_id}>
                          <td><div className="fw-semibold">{studentName(r)}</div><div className="small text-muted">{r.admission_no}</div></td>
                          <td className="small">{r.room_number || 'Ã¢â‚¬â€'} / {r.bed_no || 'Ã¢â‚¬â€'}</td>
                          <td>
                            {activeCall.status === 'draft' && manage ? (
                              <select className="form-select form-select-sm w-auto" value={r.status} onChange={(e) => setEntryStatus(r.student_id, e.target.value)}>
                                {ROLL_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                              </select>
                            ) : statusBadge(ROLLCALL_STATUS_TONE, r.status)}
                            {r.correction_reason && <div className="small text-muted">Correction: {r.correction_reason}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div></div></div>
        </div>
      )}

      {tab === 'leaves' && (
        <div className="row g-3">
          {manage && (
            <div className="col-xl-4"><div className="card"><div className="card-body">
              <h6>New Leave Pass</h6>
              <form onSubmit={createLeave} className="row g-2">
                <div className="col-12"><select className="form-select form-select-sm" value={leaveForm.studentId} onChange={(e) => setLeaveForm({ ...leaveForm, studentId: e.target.value })} required><option value="">Student</option>{students.filter((s) => s.allocation_id).map((s) => <option key={s.id} value={s.id}>{s.admission_no} Ã‚Â· {s.first_name} {s.last_name}</option>)}</select></div>
                <div className="col-6"><select className="form-select form-select-sm" value={leaveForm.type} onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}><option value="outpass">Outpass</option><option value="home_leave">Home leave</option><option value="medical">Medical</option><option value="vacation">Vacation</option></select></div>
                <div className="col-6"><input className="form-control form-control-sm" placeholder="Destination" value={leaveForm.destination} onChange={(e) => setLeaveForm({ ...leaveForm, destination: e.target.value })} /></div>
                <div className="col-6"><label className="form-label small mb-0">From</label><input type="date" className="form-control form-control-sm" value={leaveForm.fromDate} onChange={(e) => setLeaveForm({ ...leaveForm, fromDate: e.target.value })} /></div>
                <div className="col-6"><label className="form-label small mb-0">To</label><input type="date" className="form-control form-control-sm" value={leaveForm.toDate} onChange={(e) => setLeaveForm({ ...leaveForm, toDate: e.target.value })} /></div>
                <div className="col-6"><input type="time" className="form-control form-control-sm" value={leaveForm.fromTime} onChange={(e) => setLeaveForm({ ...leaveForm, fromTime: e.target.value })} /></div>
                <div className="col-6"><input type="time" className="form-control form-control-sm" value={leaveForm.toTime} onChange={(e) => setLeaveForm({ ...leaveForm, toTime: e.target.value })} /></div>
                <div className="col-12"><textarea className="form-control form-control-sm" rows="2" placeholder="Reason" value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} /></div>
                <div className="col-12"><button className="btn btn-sm btn-primary w-100">Request Leave</button></div>
              </form>
              <div className="small text-muted mt-2">Guardian OTP and warden approval are enforced before gate-out.</div>
            </div></div></div>
          )}
          <div className={manage ? 'col-xl-8' : 'col-12'}><div className="card"><div className="card-body">
            <h6>Leave Passes</h6>
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Pass</th><th>Student</th><th>Period</th><th>Status</th><th></th></tr></thead><tbody>
              {passes.length === 0 && <tr><td colSpan="5"><Empty icon="bi-door-open" text="No leave passes" /></td></tr>}
              {passes.map((p) => (
                <tr key={p.id}>
                  <td className="small">{p.pass_no}<div className="text-muted text-capitalize">{p.type?.replace('_', ' ')}</div></td>
                  <td><div className="fw-semibold">{studentName(p)}</div><div className="small text-muted">{p.admission_no} Ã‚Â· {p.hostel_name || 'Ã¢â‚¬â€'} {p.room_number || ''}</div></td>
                  <td className="small">{fmtDate(p.from_date)} Ã¢â‚¬â€œ {fmtDate(p.to_date)}<div className="text-muted">{fmtTime(p.from_time)} Ã¢â‚¬â€œ {fmtTime(p.to_time)}</div></td>
                  <td>{statusBadge(LEAVE_TONE, p.status)}</td>
                  <td className="text-end">
                    <div className="btn-group btn-group-sm">
                      {manage && p.status === 'requested' && <button className="btn btn-outline-info" onClick={() => leaveAction(p, 'otp')}>OTP</button>}
                      {approve && ['requested', 'guardian_approved'].includes(p.status) && (
                        <>
                          <button className="btn btn-outline-success" onClick={() => leaveAction(p, 'approve')}>Approve</button>
                          <button className="btn btn-outline-danger" onClick={() => leaveAction(p, 'reject')}>Reject</button>
                        </>
                      )}
                      {manage && p.status === 'approved' && <button className="btn btn-outline-primary" onClick={() => leaveAction(p, 'gate-out')}>Gate out</button>}
                      {manage && ['out', 'overdue'].includes(p.status) && <button className="btn btn-outline-success" onClick={() => leaveAction(p, 'gate-in')}>Gate in</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody></table></div>
          </div></div></div>
        </div>
      )}

      {tab === 'gate' && (
        <div className="row g-3">
          {manage && (
            <div className="col-xl-4"><div className="card"><div className="card-body">
              <h6>Manual Gate Entry</h6>
              <form onSubmit={addGateEntry} className="row g-2">
                <div className="col-12"><select className="form-select form-select-sm" value={gateForm.studentId} onChange={(e) => setGateForm({ ...gateForm, studentId: e.target.value })} required><option value="">Student</option>{students.filter((s) => s.allocation_id).map((s) => <option key={s.id} value={s.id}>{s.admission_no} Ã‚Â· {s.first_name} {s.last_name}</option>)}</select></div>
                <div className="col-6"><select className="form-select form-select-sm" value={gateForm.direction} onChange={(e) => setGateForm({ ...gateForm, direction: e.target.value })}><option value="out">Out</option><option value="in">In</option></select></div>
                <div className="col-6"><input className="form-control form-control-sm" placeholder="Notes" value={gateForm.notes} onChange={(e) => setGateForm({ ...gateForm, notes: e.target.value })} /></div>
                <div className="col-12"><button className="btn btn-sm btn-primary w-100">Log Entry</button></div>
              </form>
              <div className="small text-muted mt-2">Gate logs are append-only. Corrections are recorded through audit.</div>
            </div></div></div>
          )}
          <div className={manage ? 'col-xl-8' : 'col-12'}><div className="card"><div className="card-body">
            <h6>Gate Log <span className="text-muted small">(last 7 days)</span></h6>
            <div className="table-responsive"><table className="table table-sm"><thead><tr><th>Time</th><th>Student</th><th>Hostel</th><th>Direction</th><th>Source</th><th>Notes</th></tr></thead><tbody>
              {gateLog.length === 0 && <tr><td colSpan="6"><Empty icon="bi-signpost" text="No gate entries" /></td></tr>}
              {gateLog.map((g) => (
                <tr key={g.id}>
                  <td className="small">{fmtDateTime(g.log_time)}</td>
                  <td><div className="fw-semibold">{studentName(g)}</div><div className="small text-muted">{g.admission_no}</div></td>
                  <td className="small">{g.hostel_name || 'Ã¢â‚¬â€'}</td>
                  <td><Badge tone={g.direction === 'out' ? 'warning' : 'success'}>{g.direction}</Badge></td>
                  <td className="small">{g.source}</td><td className="small">{g.notes || 'Ã¢â‚¬â€'}</td>
                </tr>
              ))}
            </tbody></table></div>
          </div></div></div>
        </div>
      )}

      {tab === 'duty' && (
        <div className="row g-3">
          <div className="col-xl-4">
            {manage && (
              <div className="card mb-3"><div className="card-body">
                <h6>Schedule Duty</h6>
                <form onSubmit={saveDuty} className="row g-2">
                  <div className="col-12"><select className="form-select form-select-sm" value={dutyForm.hostelId} onChange={(e) => setDutyForm({ ...dutyForm, hostelId: e.target.value })} required><option value="">Hostel</option>{hostels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
                  <div className="col-12"><select className="form-select form-select-sm" value={dutyForm.staffId} onChange={(e) => setDutyForm({ ...dutyForm, staffId: e.target.value })} required><option value="">Staff</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                  <div className="col-6"><input type="date" className="form-control form-control-sm" value={dutyForm.dutyDate} onChange={(e) => setDutyForm({ ...dutyForm, dutyDate: e.target.value })} /></div>
                  <div className="col-6"><select className="form-select form-select-sm" value={dutyForm.shift} onChange={(e) => setDutyForm({ ...dutyForm, shift: e.target.value })}><option value="morning">Morning</option><option value="evening">Evening</option><option value="night">Night</option></select></div>
                  <div className="col-12"><button className="btn btn-sm btn-primary w-100">Schedule</button></div>
                </form>
              </div></div>
            )}
            <div className="card"><div className="card-body">
              <h6>Night Roll Call Compliance</h6>
              {compliance.length === 0 && <div className="text-muted small">No hostels</div>}
              {compliance.map((c) => (
                <div key={c.hostel_id} className="mb-2">
                  <div className="d-flex justify-content-between small"><span>{c.hostel_name}</span><span>{c.compliance_pct}%</span></div>
                  <div className="progress" style={{ height: 6 }}><div className={`progress-bar bg-${Number(c.compliance_pct) >= 90 ? 'success' : Number(c.compliance_pct) >= 60 ? 'warning' : 'danger'}`} style={{ width: `${Math.min(Number(c.compliance_pct) || 0, 100)}%` }}></div></div>
                  <div className="small text-muted">{c.taken}/{c.expected} nights</div>
                </div>
              ))}
            </div></div>
          </div>

          <div className="col-xl-8">
            <div className="card mb-3"><div className="card-body">
              <h6>Duty Roster</h6>
              <div className="table-responsive"><table className="table table-sm"><thead><tr><th>Date</th><th>Hostel</th><th>Shift</th><th>Staff</th><th>Status</th></tr></thead><tbody>
                {duty.length === 0 && <tr><td colSpan="5"><Empty icon="bi-shield" text="No duty scheduled" /></td></tr>}
                {duty.map((d) => <tr key={d.id}><td className="small">{fmtDate(d.duty_date)}</td><td>{d.hostel_name}</td><td className="text-capitalize">{d.shift}</td><td>{d.staff_name}{d.substitute_name ? ` (sub: ${d.substitute_name})` : ''}</td><td><Badge tone={d.status === 'completed' ? 'success' : 'info'}>{d.status}</Badge></td></tr>)}
              </tbody></table></div>
            </div></div>

            <div className="card"><div className="card-body">
              <h6>Alerts</h6>
              <div className="row g-2">
                <div className="col-md-6">
                  <div className="small text-uppercase text-muted mb-1">Overdue passes ({(alerts.overduePasses || []).length})</div>
                  {(alerts.overduePasses || []).length === 0 && <div className="small text-muted">None</div>}
                  {(alerts.overduePasses || []).map((p) => <div key={p.id} className="small">{studentName(p)} Ã‚Â· due {fmtDate(p.to_date)}</div>)}
                </div>
                <div className="col-md-6">
                  <div className="small text-uppercase text-muted mb-1">Unexplained absences ({(alerts.absences || []).length})</div>
                  {(alerts.absences || []).length === 0 && <div className="small text-muted">None</div>}
                  {(alerts.absences || []).map((a) => <div key={a.id} className="small">{studentName(a)} Ã‚Â· {fmtDate(a.call_date)} {a.session}</div>)}
                </div>
                <div className="col-md-6">
                  <div className="small text-uppercase text-muted mb-1">Missing night roll calls ({(alerts.missingNightRollCalls || []).length})</div>
                  {(alerts.missingNightRollCalls || []).length === 0 && <div className="small text-muted">None</div>}
                  {(alerts.missingNightRollCalls || []).map((h) => <div key={h.id} className="small">{h.name}</div>)}
                </div>
                <div className="col-md-6">
                  <div className="small text-uppercase text-muted mb-1">Open visits ({(alerts.openVisits || []).length})</div>
                  {(alerts.openVisits || []).length === 0 && <div className="small text-muted">None</div>}
                  {(alerts.openVisits || []).map((v) => <div key={v.id} className="small">{v.visitor_name} Ã¢â€ â€™ {studentName(v)}</div>)}
                </div>
              </div>
            </div></div>
          </div>
        </div>
      )}

      {tab === 'incidents' && (
        <div className="row g-3">
          <div className="col-xl-4">
            {manage && (
              <>
                <div className="card mb-3"><div className="card-body">
                  <h6>Log Incident</h6>
                  <form onSubmit={saveIncident} className="row g-2">
                    <div className="col-12"><input className="form-control form-control-sm" placeholder="Type (e.g. bullying, medical)" value={incidentForm.type} onChange={(e) => setIncidentForm({ ...incidentForm, type: e.target.value })} required /></div>
                    <div className="col-8"><select className="form-select form-select-sm" value={incidentForm.severity} onChange={(e) => setIncidentForm({ ...incidentForm, severity: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
                    <div className="col-4"><select className="form-select form-select-sm" value={incidentForm.studentId} onChange={(e) => setIncidentForm({ ...incidentForm, studentId: e.target.value })}><option value="">Student</option>{students.map((s) => <option key={s.id} value={s.id}>{s.first_name}</option>)}</select></div>
                    <div className="col-12"><textarea className="form-control form-control-sm" rows="2" placeholder="Description" value={incidentForm.description} onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })} required /></div>
                    <div className="col-12"><button className="btn btn-sm btn-primary w-100">Log Incident</button></div>
                  </form>
                </div></div>
                <div className="card"><div className="card-body">
                  <h6>Log Complaint</h6>
                  <form onSubmit={saveComplaint} className="row g-2">
                    <div className="col-6"><input className="form-control form-control-sm" placeholder="Category" value={complaintForm.category} onChange={(e) => setComplaintForm({ ...complaintForm, category: e.target.value })} /></div>
                    <div className="col-6"><select className="form-select form-select-sm" value={complaintForm.studentId} onChange={(e) => setComplaintForm({ ...complaintForm, studentId: e.target.value })}><option value="">Student</option>{students.map((s) => <option key={s.id} value={s.id}>{s.first_name}</option>)}</select></div>
                    <div className="col-12"><textarea className="form-control form-control-sm" rows="2" placeholder="Complaint" value={complaintForm.description} onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value })} required /></div>
                    <div className="col-12"><button className="btn btn-sm btn-outline-primary w-100">Log Complaint</button></div>
                  </form>
                </div></div>
              </>
            )}
          </div>
          <div className="col-xl-8">
            <div className="card mb-3"><div className="card-body">
              <h6>Incidents</h6>
              <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Date</th><th>Type</th><th>Student</th><th>Severity</th><th>Status</th></tr></thead><tbody>
                {incidents.length === 0 && <tr><td colSpan="5"><Empty icon="bi-exclamation-triangle" text="No incidents" /></td></tr>}
                {incidents.map((i) => (
                  <tr key={i.id}>
                    <td className="small">{fmtDate(i.incident_date)}</td>
                    <td>{i.type}<div className="small text-muted">{i.description}</div></td>
                    <td className="small">{i.admission_no ? `${i.first_name} ${i.last_name}` : 'Ã¢â‚¬â€'}</td>
                    <td><Badge tone={i.severity === 'critical' || i.severity === 'high' ? 'danger' : i.severity === 'medium' ? 'warning' : 'secondary'}>{i.severity}</Badge></td>
                    <td><Badge tone={i.status === 'closed' ? 'success' : 'info'}>{i.status}</Badge></td>
                  </tr>
                ))}
              </tbody></table></div>
            </div></div>
            <div className="card"><div className="card-body">
              <h6>Complaints</h6>
              <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Student</th><th>Category</th><th>Complaint</th><th>Status</th><th></th></tr></thead><tbody>
                {complaints.length === 0 && <tr><td colSpan="5"><Empty icon="bi-chat-left-text" text="No complaints" /></td></tr>}
                {complaints.map((c) => (
                  <tr key={c.id}>
                    <td className="small">{c.admission_no ? `${c.first_name} ${c.last_name}` : c.raised_by || 'Ã¢â‚¬â€'}</td>
                    <td className="text-capitalize small">{c.category}</td>
                    <td className="small">{c.description}</td>
                    <td><Badge tone={c.status === 'resolved' || c.status === 'closed' ? 'success' : c.status === 'escalated' ? 'danger' : 'warning'}>{c.status}</Badge></td>
                    <td className="text-end">{manage && !['resolved', 'closed'].includes(c.status) && <button className="btn btn-sm btn-outline-success" onClick={() => closeComplaint(c)}>Resolve</button>}</td>
                  </tr>
                ))}
              </tbody></table></div>
            </div></div>
          </div>
        </div>
      )}

      {correction.open && (
        <Modal title="Correct submitted roll call" onClose={() => setCorrection({ open: false, reason: '' })} size="md">
          <div className="alert alert-warning py-2 small">Corrections are permanent and audited. Adjust the statuses in the table first, then record a reason.</div>
          <textarea className="form-control form-control-sm mb-2" rows="3" placeholder="Reason for correction (required)" value={correction.reason} onChange={(e) => setCorrection({ ...correction, reason: e.target.value })} />
          <div className="text-end"><button className="btn btn-sm btn-warning" onClick={submitCorrection}>Record Correction</button></div>
        </Modal>
      )}
    </PageShell>
  );
}

