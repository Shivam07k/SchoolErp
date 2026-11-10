import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../../api';
import { toast } from '../../../toast';
import {
  PageShell, Loading, Empty, Badge, Tabs, Kpi, Modal, statusBadge,
  fmtDate, fmtDateTime, money, canHostelManage, ALLOCATION_TONE, studentName,
} from './shared';

const TABS = [
  ['allocations', 'Allocations', 'bi-person-check'],
  ['applications', 'Applications', 'bi-file-earmark-text'],
  ['waitlist', 'Waitlist', 'bi-hourglass-split'],
];

const today = () => new Date().toISOString().slice(0, 10);

const emptyAlloc = {
  studentId: '', bedId: '', applicationId: '', fromDate: today(), status: 'active',
  guardianConsent: false, depositPaid: 0, notes: '',
};

const emptyApp = {
  studentId: '', requestedHostelId: '', requestedRoomType: 'double', guardianConsent: false, notes: '',
};

export default function HostelAllocation({ me, onNavigate }) {
  const manage = canHostelManage(me, 'hostel.allocate') || canHostelManage(me, 'hostel.manage');
  const [tab, setTab] = useState('allocations');
  const [loading, setLoading] = useState(true);
  const [allocations, setAllocations] = useState([]);
  const [applications, setApplications] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [students, setStudents] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [status, setStatus] = useState('');

  const [allocForm, setAllocForm] = useState(emptyAlloc);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [appForm, setAppForm] = useState(emptyApp);
  const [studentQuery, setStudentQuery] = useState('');

  const [detail, setDetail] = useState(null);
  const [changeForm, setChangeForm] = useState({ allocation: null, toBedId: '', effectiveDate: today(), reason: '' });
  const [changeSuggestions, setChangeSuggestions] = useState([]);
  const [vacateForm, setVacateForm] = useState({ allocation: null, vacateDate: today(), reason: '', duesCleared: false, assetsCleared: false, keysReturned: false, damageAmount: 0 });
  const [clearForm, setClearForm] = useState({ allocation: null, duesCleared: true, assetsCleared: true, keysReturned: true, damageAmount: 0, settlementAmount: '', depositStatus: 'refunded', notes: '' });

  async function load() {
    setLoading(true);
    try {
      const [a, ap, w, h] = await Promise.all([
        apiGet(`/school/hostel/allocations${status ? `?status=${status}` : ''}`),
        apiGet('/school/hostel/applications'),
        apiGet('/school/hostel/waitlist'),
        apiGet('/school/hostel/hostels'),
      ]);
      if (a?.ok) setAllocations(a.allocations || []);
      if (ap?.ok) setApplications(ap.applications || []);
      if (w?.ok) setWaitlist(w.waitlist || []);
      if (h?.ok) setHostels(h.hostels || []);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadStudents(q = '') {
    try {
      const res = await apiGet(`/school/hostel/students?q=${encodeURIComponent(q)}`);
      if (res?.ok) setStudents(res.students || []);
    } catch (e) { toast(e.message, 'error'); }
  }

  useEffect(() => { load(); }, [status]);
  useEffect(() => { loadStudents(); }, []);

  const selectedStudent = useMemo(
    () => students.find((s) => String(s.id) === String(allocForm.studentId)) || null,
    [students, allocForm.studentId],
  );

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => `${s.first_name} ${s.last_name} ${s.admission_no}`.toLowerCase().includes(q));
  }, [students, studentQuery]);

  const counts = useMemo(() => ({
    active: allocations.filter((a) => a.status === 'active').length,
    reserved: allocations.filter((a) => a.status === 'reserved').length,
    vacated: allocations.filter((a) => a.status === 'vacated').length,
    waiting: waitlist.length,
  }), [allocations, waitlist]);

  async function loadSuggestions(gender, hostelId) {
    if (!gender) { setSuggestions([]); return; }
    setSuggestLoading(true);
    try {
      const params = new URLSearchParams();
      const g = String(gender).toLowerCase();
      params.set('gender', g.startsWith('f') ? 'female' : g.startsWith('m') ? 'male' : '');
      if (hostelId) params.set('hostelId', hostelId);
      const res = await apiGet(`/school/hostel/bed-suggestions?${params.toString()}`);
      if (res?.ok) setSuggestions(res.beds || []);
    } catch (e) { toast(e.message, 'error'); }
    finally { setSuggestLoading(false); }
  }

  function pickStudent(id) {
    const s = students.find((x) => String(x.id) === String(id));
    setAllocForm((f) => ({ ...f, studentId: id, bedId: '' }));
    setSuggestions([]);
    if (s) loadSuggestions(s.gender);
  }

  async function createAllocation(e) {
    e.preventDefault();
    try {
      const res = await apiPost('/school/hostel/allocations', allocForm);
      if (res?.ok) {
        toast('Bed allocated', 'success');
        setAllocForm({ ...emptyAlloc, studentId: allocForm.studentId });
        setSuggestions([]);
        load();
      } else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function createApplication(e) {
    e.preventDefault();
    try {
      const res = await apiPost('/school/hostel/applications', appForm);
      if (res?.ok) {
        toast(`Application ${res.application.application_no} created`, 'success');
        setAppForm(emptyApp);
        load();
      } else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function decideApplication(app, action) {
    const label = { approve: 'Approve', reject: 'Reject', waitlist: 'Waitlist' }[action];
    let reason = '';
    if (action === 'reject') {
      reason = window.prompt(`Reason for rejecting ${studentName(app)}?`) || '';
      if (!reason) return;
    }
    try {
      const res = await apiPost(`/school/hostel/applications/${app.id}/${action}`, action === 'reject' ? { reason } : {});
      if (res?.ok) { toast(`Application ${label.toLowerCase()}ed`, 'success'); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function openDetail(a) {
    setDetail({ allocation: a, loading: true });
    try {
      const res = await apiGet(`/school/hostel/allocations/${a.id}`);
      setDetail(res?.ok ? res : { allocation: a });
    } catch (err) {
      toast(err.message, 'error');
      setDetail({ allocation: a });
    }
  }

  async function openChange(a) {
    setChangeForm({ allocation: a, toBedId: '', effectiveDate: today(), reason: '' });
    setChangeSuggestions([]);
    try {
      const res = await apiGet(`/school/hostel/bed-suggestions?gender=${encodeURIComponent(String(a.gender || '').toLowerCase().startsWith('f') ? 'female' : 'male')}`);
      if (res?.ok) setChangeSuggestions(res.beds || []);
    } catch (err) { toast(err.message, 'error'); }
  }

  async function submitChange(e) {
    e.preventDefault();
    if (!changeForm.toBedId) { toast('Choose a new bed', 'error'); return; }
    try {
      const res = await apiPost(`/school/hostel/allocations/${changeForm.allocation.id}/change`, {
        toBedId: changeForm.toBedId, effectiveDate: changeForm.effectiveDate, reason: changeForm.reason,
      });
      if (res?.ok) { toast('Room changed', 'success'); setChangeForm({ allocation: null }); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function submitVacate(e) {
    e.preventDefault();
    try {
      const res = await apiPost(`/school/hostel/allocations/${vacateForm.allocation.id}/vacate`, {
        vacateDate: vacateForm.vacateDate, reason: vacateForm.reason,
        duesCleared: vacateForm.duesCleared, assetsCleared: vacateForm.assetsCleared,
        keysReturned: vacateForm.keysReturned, damageAmount: vacateForm.damageAmount,
      });
      if (res?.ok) { toast('Vacate recorded Ã¢â‚¬â€ clearance pending', 'success'); setVacateForm({ allocation: null }); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function submitClearance(e) {
    e.preventDefault();
    try {
      const res = await apiPost(`/school/hostel/allocations/${clearForm.allocation.id}/clearance`, {
        duesCleared: clearForm.duesCleared, assetsCleared: clearForm.assetsCleared,
        keysReturned: clearForm.keysReturned, damageAmount: clearForm.damageAmount,
        settlementAmount: clearForm.settlementAmount === '' ? undefined : clearForm.settlementAmount,
        depositStatus: clearForm.depositStatus, notes: clearForm.notes,
      });
      if (res?.ok) {
        toast(`Clearance complete Ã¢â‚¬â€ deposit ${res.depositStatus} (${money(res.settlement)})`, 'success');
        setClearForm({ allocation: null });
        load();
      } else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  if (loading) return <Loading />;

  return (
    <PageShell title="Hostel Allocation" icon="bi-person-check" subtitle="Applications, bed allocation, room changes and vacating" onNavigate={onNavigate}>
      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3"><Kpi label="Active residents" value={counts.active} icon="bi-person-check" /></div>
        <div className="col-6 col-md-3"><Kpi label="Reserved" value={counts.reserved} icon="bi-bookmark" tone="warning" /></div>
        <div className="col-6 col-md-3"><Kpi label="Vacated" value={counts.vacated} icon="bi-box-arrow-right" tone="secondary" /></div>
        <div className="col-6 col-md-3"><Kpi label="On waitlist" value={counts.waiting} icon="bi-hourglass-split" tone="info" /></div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'allocations' && (
        <div className="row g-3">
          {manage && (
            <div className="col-xl-4">
              <div className="card"><div className="card-body">
                <h6 className="mb-2"><i className="bi bi-person-plus me-1"></i>Allocate a Bed</h6>
                <form onSubmit={createAllocation} className="row g-2">
                  <div className="col-12">
                    <input className="form-control form-control-sm mb-1" placeholder="Search studentÃ¢â‚¬Â¦" value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} />
                    <select className="form-select form-select-sm" value={allocForm.studentId} onChange={(e) => pickStudent(e.target.value)} required>
                      <option value="">Select student</option>
                      {filteredStudents.map((s) => (
                        <option key={s.id} value={s.id} disabled={Boolean(s.allocation_id)}>
                          {s.admission_no} Ã‚Â· {s.first_name} {s.last_name}{s.allocation_id ? ' (allocated)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedStudent && (
                    <div className="col-12 small text-muted">
                      {selectedStudent.class_name || 'Ã¢â‚¬â€'} Ã‚Â· Gender: {selectedStudent.gender || 'Ã¢â‚¬â€'}
                    </div>
                  )}
                  <div className="col-12">
                    <select className="form-select form-select-sm" value={allocForm.bedId} onChange={(e) => setAllocForm({ ...allocForm, bedId: e.target.value })} required>
                      <option value="">{suggestLoading ? 'Loading bedsÃ¢â‚¬Â¦' : suggestions.length ? 'Select bed' : 'Select student to see beds'}</option>
                      {suggestions.map((b) => (
                        <option key={b.bed_id} value={b.bed_id}>
                          {b.hostel_name} Ã‚Â· Room {b.room_number} Ã‚Â· Bed {b.bed_no} ({b.room_type})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-6"><label className="form-label small mb-0">From</label><input type="date" className="form-control form-control-sm" value={allocForm.fromDate} onChange={(e) => setAllocForm({ ...allocForm, fromDate: e.target.value })} /></div>
                  <div className="col-6"><label className="form-label small mb-0">Status</label>
                    <select className="form-select form-select-sm" value={allocForm.status} onChange={(e) => setAllocForm({ ...allocForm, status: e.target.value })}>
                      <option value="active">Active (check-in)</option>
                      <option value="reserved">Reserved</option>
                    </select>
                  </div>
                  <div className="col-12"><label className="form-label small mb-0">Deposit paid</label><input type="number" min="0" className="form-control form-control-sm" value={allocForm.depositPaid} onChange={(e) => setAllocForm({ ...allocForm, depositPaid: e.target.value })} /></div>
                  <div className="col-12 form-check ms-1">
                    <input className="form-check-input" type="checkbox" id="guardianConsent" checked={allocForm.guardianConsent} onChange={(e) => setAllocForm({ ...allocForm, guardianConsent: e.target.checked })} />
                    <label className="form-check-label small" htmlFor="guardianConsent">Guardian consent obtained</label>
                  </div>
                  <div className="col-12"><textarea className="form-control form-control-sm" rows="2" placeholder="Notes" value={allocForm.notes} onChange={(e) => setAllocForm({ ...allocForm, notes: e.target.value })} /></div>
                  <div className="col-12"><button className="btn btn-sm btn-primary w-100" disabled={!allocForm.bedId}>Allocate</button></div>
                </form>
                <div className="small text-muted mt-2">
                  One bed per resident is enforced. Boys and girls hostels are separated automatically by gender.
                </div>
              </div></div>
            </div>
          )}

          <div className={manage ? 'col-xl-8' : 'col-12'}>
            <div className="card"><div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="mb-0">Allocations</h6>
                <select className="form-select form-select-sm w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="reserved">Reserved</option>
                  <option value="vacated">Vacated</option>
                  <option value="changed">Changed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle">
                  <thead><tr><th>Student</th><th>Hostel / Room / Bed</th><th>From</th><th>Deposit</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {allocations.length === 0 && <tr><td colSpan="6"><Empty icon="bi-person-check" text="No allocations" /></td></tr>}
                    {allocations.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <div className="fw-semibold">{studentName(a)}</div>
                          <div className="small text-muted">{a.admission_no} Ã‚Â· {a.class_name || 'Ã¢â‚¬â€'}</div>
                        </td>
                        <td>
                          <div>{a.hostel_name}</div>
                          <div className="small text-muted">Room {a.room_number} Ã‚Â· Bed {a.bed_no}</div>
                        </td>
                        <td className="small">{fmtDate(a.from_date)}</td>
                        <td className="small">{money(a.deposit_paid)}</td>
                        <td>{statusBadge(ALLOCATION_TONE, a.status)}</td>
                        <td className="text-end">
                          <div className="btn-group btn-group-sm">
                            <button className="btn btn-outline-secondary" onClick={() => openDetail(a)}>View</button>
                            {manage && ['active', 'reserved'].includes(a.status) && (
                              <>
                                <button className="btn btn-outline-primary" onClick={() => openChange(a)}>Change</button>
                                <button className="btn btn-outline-warning" onClick={() => setVacateForm({ allocation: a, vacateDate: today(), reason: '', duesCleared: false, assetsCleared: false, keysReturned: false, damageAmount: 0 })}>Vacate</button>
                              </>
                            )}
                            {manage && a.status === 'vacated' && (
                              <button className="btn btn-outline-success" onClick={() => setClearForm({ allocation: a, duesCleared: true, assetsCleared: true, keysReturned: true, damageAmount: 0, settlementAmount: '', depositStatus: 'refunded', notes: '' })}>Clearance</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div></div>
          </div>
        </div>
      )}

      {tab === 'applications' && (
        <div className="row g-3">
          {manage && (
            <div className="col-xl-4"><div className="card"><div className="card-body">
              <h6 className="mb-2"><i className="bi bi-file-earmark-plus me-1"></i>New Application</h6>
              <form onSubmit={createApplication} className="row g-2">
                <div className="col-12">
                  <select className="form-select form-select-sm" value={appForm.studentId} onChange={(e) => setAppForm({ ...appForm, studentId: e.target.value })} required>
                    <option value="">Student</option>
                    {students.map((s) => <option key={s.id} value={s.id}>{s.admission_no} Ã‚Â· {s.first_name} {s.last_name}</option>)}
                  </select>
                </div>
                <div className="col-12">
                  <select className="form-select form-select-sm" value={appForm.requestedHostelId} onChange={(e) => setAppForm({ ...appForm, requestedHostelId: e.target.value })}>
                    <option value="">Preferred hostel (optional)</option>
                    {hostels.map((h) => <option key={h.id} value={h.id}>{h.name} ({h.type})</option>)}
                  </select>
                </div>
                <div className="col-6">
                  <select className="form-select form-select-sm" value={appForm.requestedRoomType} onChange={(e) => setAppForm({ ...appForm, requestedRoomType: e.target.value })}>
                    <option value="single">Single</option><option value="double">Double</option><option value="triple">Triple</option><option value="dormitory">Dormitory</option>
                  </select>
                </div>
                <div className="col-6 form-check ms-1 mt-4">
                  <input className="form-check-input" type="checkbox" id="appConsent" checked={appForm.guardianConsent} onChange={(e) => setAppForm({ ...appForm, guardianConsent: e.target.checked })} />
                  <label className="form-check-label small" htmlFor="appConsent">Guardian consent</label>
                </div>
                <div className="col-12"><textarea className="form-control form-control-sm" rows="2" placeholder="Notes" value={appForm.notes} onChange={(e) => setAppForm({ ...appForm, notes: e.target.value })} /></div>
                <div className="col-12"><button className="btn btn-sm btn-primary w-100">Submit Application</button></div>
              </form>
            </div></div></div>
          )}
          <div className={manage ? 'col-xl-8' : 'col-12'}><div className="card"><div className="card-body">
            <h6>Applications</h6>
            <div className="table-responsive"><table className="table table-sm align-middle">
              <thead><tr><th>No.</th><th>Student</th><th>Requested</th><th>Consent</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {applications.length === 0 && <tr><td colSpan="6"><Empty icon="bi-file-earmark-text" text="No applications" /></td></tr>}
                {applications.map((a) => (
                  <tr key={a.id}>
                    <td className="small">{a.application_no}</td>
                    <td><div className="fw-semibold">{studentName(a)}</div><div className="small text-muted">{a.admission_no} Ã‚Â· {a.class_name || 'Ã¢â‚¬â€'}</div></td>
                    <td className="small">{a.requested_hostel_name || 'Any'} Ã‚Â· {a.requested_room_type || 'Ã¢â‚¬â€'}</td>
                    <td>{a.guardian_consent ? <Badge tone="success">Yes</Badge> : <Badge tone="secondary">No</Badge>}</td>
                    <td><Badge tone={a.status === 'approved' || a.status === 'allocated' ? 'success' : a.status === 'rejected' ? 'danger' : a.status === 'waitlisted' ? 'warning' : 'info'}>{a.status}</Badge></td>
                    <td className="text-end">
                      {manage && ['submitted', 'waitlisted'].includes(a.status) && (
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-success" onClick={() => decideApplication(a, 'approve')}>Approve</button>
                          <button className="btn btn-outline-warning" onClick={() => decideApplication(a, 'waitlist')}>Waitlist</button>
                          <button className="btn btn-outline-danger" onClick={() => decideApplication(a, 'reject')}>Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div></div></div>
        </div>
      )}

      {tab === 'waitlist' && (
        <div className="card"><div className="card-body">
          <h6>Waiting List</h6>
          <div className="table-responsive"><table className="table table-sm align-middle">
            <thead><tr><th>Student</th><th>Class</th><th>Priority</th><th>Requested type</th><th>Since</th><th>Status</th></tr></thead>
            <tbody>
              {waitlist.length === 0 && <tr><td colSpan="6"><Empty icon="bi-hourglass-split" text="Nobody is waiting" /></td></tr>}
              {waitlist.map((w) => (
                <tr key={w.id}>
                  <td><div className="fw-semibold">{studentName(w)}</div><div className="small text-muted">{w.admission_no}</div></td>
                  <td>{w.class_name || 'Ã¢â‚¬â€'}</td>
                  <td>{w.priority}</td>
                  <td className="text-capitalize">{w.requested_type || 'Ã¢â‚¬â€'}</td>
                  <td className="small">{fmtDate(w.created_at)}</td>
                  <td><Badge tone={w.status === 'offered' ? 'info' : 'warning'}>{w.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div></div>
      )}

      {detail && (
        <Modal title={`Allocation Ã‚Â· ${studentName(detail.allocation)}`} onClose={() => setDetail(null)}>
          {detail.loading ? <Loading /> : (
            <>
              <div className="row g-2 mb-3">
                <div className="col-6"><div className="small text-muted">Student</div><div className="fw-semibold">{studentName(detail.allocation)}</div><div className="small">{detail.allocation.admission_no}</div></div>
                <div className="col-6"><div className="small text-muted">Bed</div><div className="fw-semibold">{detail.allocation.hostel_name} Ã‚Â· {detail.allocation.room_number} Ã‚Â· {detail.allocation.bed_no}</div></div>
                <div className="col-6"><div className="small text-muted">From</div><div>{fmtDate(detail.allocation.from_date)}</div></div>
                <div className="col-6"><div className="small text-muted">Status</div>{statusBadge(ALLOCATION_TONE, detail.allocation.status)}</div>
                <div className="col-6"><div className="small text-muted">Guardian</div><div>{detail.allocation.guardian_name || 'Ã¢â‚¬â€'} {detail.allocation.guardian_phone ? `Ã‚Â· ${detail.allocation.guardian_phone}` : ''}</div></div>
                <div className="col-6"><div className="small text-muted">Deposit</div><div>{money(detail.deposit?.amount ?? detail.allocation.deposit_paid)} <Badge tone={detail.deposit?.status === 'held' ? 'info' : detail.deposit?.status === 'refunded' ? 'success' : 'secondary'}>{detail.deposit?.status || detail.allocation.deposit_status}</Badge></div></div>
              </div>
              <h6 className="small text-uppercase text-muted">Room changes</h6>
              <div className="table-responsive mb-3"><table className="table table-sm"><thead><tr><th>Effective</th><th>From bed</th><th>To bed</th><th>Reason</th></tr></thead><tbody>
                {(detail.changes || []).length === 0 && <tr><td colSpan="4" className="text-muted small">No room changes</td></tr>}
                {(detail.changes || []).map((c) => <tr key={c.id}><td>{fmtDate(c.effective_date)}</td><td>{c.from_bed_id}</td><td>{c.to_bed_id}</td><td>{c.reason || 'Ã¢â‚¬â€'}</td></tr>)}
              </tbody></table></div>
              <h6 className="small text-uppercase text-muted">Vacating / clearance</h6>
              <div className="table-responsive"><table className="table table-sm"><thead><tr><th>Date</th><th>Reason</th><th>Clearance</th><th>Settlement</th></tr></thead><tbody>
                {(detail.vacates || []).length === 0 && <tr><td colSpan="4" className="text-muted small">No vacate record</td></tr>}
                {(detail.vacates || []).map((v) => (
                  <tr key={v.id}><td>{fmtDate(v.vacate_date)}</td><td>{v.reason || 'Ã¢â‚¬â€'}</td><td><Badge tone={v.status === 'cleared' ? 'success' : 'warning'}>{v.status}</Badge></td><td>{money(v.deposit_settlement)}</td></tr>
                ))}
              </tbody></table></div>
            </>
          )}
        </Modal>
      )}

      {changeForm.allocation && (
        <Modal title={`Change bed Ã‚Â· ${studentName(changeForm.allocation)}`} onClose={() => setChangeForm({ allocation: null })} size="md">
          <form onSubmit={submitChange} className="row g-2">
            <div className="col-12">
              <label className="form-label small mb-0">New bed</label>
              <select className="form-select form-select-sm" value={changeForm.toBedId} onChange={(e) => setChangeForm({ ...changeForm, toBedId: e.target.value })} required>
                <option value="">Select vacant bed</option>
                {changeSuggestions.filter((b) => String(b.bed_id) !== String(changeForm.allocation.bed_id)).map((b) => (
                  <option key={b.bed_id} value={b.bed_id}>{b.hostel_name} Ã‚Â· Room {b.room_number} Ã‚Â· Bed {b.bed_no}</option>
                ))}
              </select>
            </div>
            <div className="col-6"><label className="form-label small mb-0">Effective date</label><input type="date" className="form-control form-control-sm" value={changeForm.effectiveDate} onChange={(e) => setChangeForm({ ...changeForm, effectiveDate: e.target.value })} /></div>
            <div className="col-12"><input className="form-control form-control-sm" placeholder="Reason" value={changeForm.reason} onChange={(e) => setChangeForm({ ...changeForm, reason: e.target.value })} /></div>
            <div className="col-12 text-end"><button className="btn btn-sm btn-primary">Move resident</button></div>
          </form>
        </Modal>
      )}

      {vacateForm.allocation && (
        <Modal title={`Vacate Ã‚Â· ${studentName(vacateForm.allocation)}`} onClose={() => setVacateForm({ allocation: null })} size="md">
          <form onSubmit={submitVacate} className="row g-2">
            <div className="col-6"><label className="form-label small mb-0">Vacate date</label><input type="date" className="form-control form-control-sm" value={vacateForm.vacateDate} onChange={(e) => setVacateForm({ ...vacateForm, vacateDate: e.target.value })} /></div>
            <div className="col-6"><label className="form-label small mb-0">Damage Ã¢â€šÂ¹</label><input type="number" min="0" className="form-control form-control-sm" value={vacateForm.damageAmount} onChange={(e) => setVacateForm({ ...vacateForm, damageAmount: e.target.value })} /></div>
            <div className="col-12"><input className="form-control form-control-sm" placeholder="Reason" value={vacateForm.reason} onChange={(e) => setVacateForm({ ...vacateForm, reason: e.target.value })} /></div>
            <div className="col-12 d-flex flex-wrap gap-3">
              <div className="form-check"><input className="form-check-input" type="checkbox" id="vDues" checked={vacateForm.duesCleared} onChange={(e) => setVacateForm({ ...vacateForm, duesCleared: e.target.checked })} /><label className="form-check-label small" htmlFor="vDues">Dues cleared</label></div>
              <div className="form-check"><input className="form-check-input" type="checkbox" id="vAssets" checked={vacateForm.assetsCleared} onChange={(e) => setVacateForm({ ...vacateForm, assetsCleared: e.target.checked })} /><label className="form-check-label small" htmlFor="vAssets">Assets cleared</label></div>
              <div className="form-check"><input className="form-check-input" type="checkbox" id="vKeys" checked={vacateForm.keysReturned} onChange={(e) => setVacateForm({ ...vacateForm, keysReturned: e.target.checked })} /><label className="form-check-label small" htmlFor="vKeys">Keys returned</label></div>
            </div>
            <div className="col-12 small text-muted">Deposit refund is blocked until clearance is completed.</div>
            <div className="col-12 text-end"><button className="btn btn-sm btn-warning">Record vacate</button></div>
          </form>
        </Modal>
      )}

      {clearForm.allocation && (
        <Modal title={`Clearance Ã‚Â· ${studentName(clearForm.allocation)}`} onClose={() => setClearForm({ allocation: null })} size="md">
          <form onSubmit={submitClearance} className="row g-2">
            <div className="col-12 d-flex flex-wrap gap-3">
              <div className="form-check"><input className="form-check-input" type="checkbox" id="cDues" checked={clearForm.duesCleared} onChange={(e) => setClearForm({ ...clearForm, duesCleared: e.target.checked })} /><label className="form-check-label small" htmlFor="cDues">Dues cleared</label></div>
              <div className="form-check"><input className="form-check-input" type="checkbox" id="cAssets" checked={clearForm.assetsCleared} onChange={(e) => setClearForm({ ...clearForm, assetsCleared: e.target.checked })} /><label className="form-check-label small" htmlFor="cAssets">Assets cleared</label></div>
              <div className="form-check"><input className="form-check-input" type="checkbox" id="cKeys" checked={clearForm.keysReturned} onChange={(e) => setClearForm({ ...clearForm, keysReturned: e.target.checked })} /><label className="form-check-label small" htmlFor="cKeys">Keys returned</label></div>
            </div>
            <div className="col-6"><label className="form-label small mb-0">Damage Ã¢â€šÂ¹</label><input type="number" min="0" className="form-control form-control-sm" value={clearForm.damageAmount} onChange={(e) => setClearForm({ ...clearForm, damageAmount: e.target.value })} /></div>
            <div className="col-6"><label className="form-label small mb-0">Settlement Ã¢â€šÂ¹ (blank = auto)</label><input type="number" min="0" className="form-control form-control-sm" value={clearForm.settlementAmount} onChange={(e) => setClearForm({ ...clearForm, settlementAmount: e.target.value })} /></div>
            <div className="col-6"><label className="form-label small mb-0">Deposit status</label>
              <select className="form-select form-select-sm" value={clearForm.depositStatus} onChange={(e) => setClearForm({ ...clearForm, depositStatus: e.target.value })}>
                <option value="refunded">Refunded</option><option value="adjusted">Adjusted</option><option value="forfeited">Forfeited</option>
              </select>
            </div>
            <div className="col-6"><label className="form-label small mb-0">Notes</label><input className="form-control form-control-sm" value={clearForm.notes} onChange={(e) => setClearForm({ ...clearForm, notes: e.target.value })} /></div>
            <div className="col-12 text-end"><button className="btn btn-sm btn-success">Complete clearance</button></div>
          </form>
        </Modal>
      )}
    </PageShell>
  );
}

