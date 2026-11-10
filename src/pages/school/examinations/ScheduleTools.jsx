import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, apiPut, apiDelete, getToken } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, ErrorBox, canManage, fmtDate, fmtTime, fmtDateTime, today } from './shared';

const MODES = [
  { key: 'date-sheet', label: 'Date Sheet', icon: 'bi-calendar3-week' },
  { key: 'seating', label: 'Seating', icon: 'bi-grid' },
  { key: 'invigilation', label: 'Invigilation', icon: 'bi-people' },
  { key: 'hall-tickets', label: 'Hall Tickets', icon: 'bi-card-checklist' },
];

async function openAuthorized(url) {
  const tab = window.open('about:blank', '_blank');
  if (!tab) return toast('Allow pop-ups to open this document', 'warning');
  try {
    const res = await fetch(`/api${url}`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) throw new Error(`Could not open document: ${res.status}`);
    const objectUrl = URL.createObjectURL(await res.blob());
    tab.location.href = objectUrl;
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (err) {
    tab.close();
    toast(err.message, 'error');
  }
}

export default function ScheduleTools({ me, onNavigate, mode = 'date-sheet', query = {} }) {
  const active = MODES.some((m) => m.key === mode) ? mode : 'date-sheet';
  const [exams, setExams] = useState([]);
  const [papers, setPapers] = useState([]);
  const [slots, setSlots] = useState([]);
  const [halls, setHalls] = useState([]);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [examId, setExamId] = useState(query.examId || '');
  const [slotId, setSlotId] = useState(query.slot || '');
  const [sectionId, setSectionId] = useState('');
  const [allocations, setAllocations] = useState([]);
  const [duties, setDuties] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const manager = canManage(me, 'exam.schedule');

  const [slotForm, setSlotForm] = useState({ paperId: '', sectionId: '', date: today(), startTime: '09:00', endTime: '12:00', status: 'draft' });
  const [dutyForm, setDutyForm] = useState({ teacherId: '', hallId: '', role: 'invigilator' });
  const [ticketForm, setTicketForm] = useState({ sectionId: '', withholdFees: false, withholdAttendance: false, minAttendance: 75 });
  const [selectedHalls, setSelectedHalls] = useState([]);

  async function loadBase() {
    setLoading(true);
    setError('');
    try {
      const [examRes, hallRes, classRes, teacherRes] = await Promise.all([
        apiGet('/school/exams'),
        apiGet('/school/exam/schedule/halls'),
        apiGet('/school/classes'),
        apiGet('/school/academics/teachers'),
      ]);
      if (examRes?.ok) setExams(examRes.exams || []);
      if (hallRes?.ok) setHalls(hallRes.halls || []);
      if (classRes?.ok) setClasses(classRes.classes || []);
      if (teacherRes?.ok) setTeachers((teacherRes.employees || teacherRes.teachers || []).filter((t) => t.source !== 'user' || t.source === undefined));
    } catch (err) {
      setError(err.message || 'Failed to load schedule setup');
    } finally {
      setLoading(false);
    }
  }

  async function loadExamData(nextExamId = examId) {
    if (!nextExamId) { setSlots([]); setPapers([]); return; }
    try {
      const [slotRes, paperRes] = await Promise.all([
        apiGet(`/school/exam/schedule/slots?examId=${nextExamId}`),
        apiGet(`/school/exam/papers?examId=${nextExamId}`),
      ]);
      if (slotRes?.ok) setSlots(slotRes.slots || []);
      if (paperRes?.ok) setPapers(paperRes.papers || []);
    } catch (err) {
      toast(err.message || 'Could not load exam schedule', 'error');
    }
  }

  async function loadModeData() {
    if (active === 'seating' && slotId) {
      const res = await apiGet(`/school/exam/schedule/seating?slotId=${slotId}`);
      setAllocations(res?.allocations || []);
    }
    if (active === 'invigilation' && slotId) {
      const res = await apiGet(`/school/exam/schedule/invigilation?slotId=${slotId}`);
      setDuties(res?.duties || []);
    }
    if (active === 'hall-tickets' && examId) {
      const res = await apiGet(`/school/exam/schedule/hall-tickets?examId=${examId}${sectionId ? `&sectionId=${sectionId}` : ''}`);
      setTickets(res?.tickets || []);
    }
  }

  useEffect(() => { loadBase(); }, []);
  useEffect(() => { loadExamData(examId); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [examId]);
  useEffect(() => { loadModeData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [active, slotId, examId, sectionId]);

  const sections = useMemo(() => {
    if (!examId) return [];
    const classIds = new Set(papers.map((p) => p.class_id));
    return classes.filter((c) => classIds.has(c.id)).flatMap((c) => (c.sections || []).map((s) => ({ ...s, class_name: c.name })));
  }, [classes, papers, examId]);

  const selectedExam = exams.find((e) => String(e.id) === String(examId));

  async function createSlot() {
    if (!examId || !slotForm.paperId) return toast('Select an exam and paper first', 'warning');
    setBusy(true);
    try {
      const res = await apiPost('/school/exam/schedule/slots', {
        examId: Number(examId),
        paperId: Number(slotForm.paperId),
        sectionId: slotForm.sectionId ? Number(slotForm.sectionId) : null,
        date: slotForm.date,
        startTime: slotForm.startTime,
        endTime: slotForm.endTime,
        status: slotForm.status,
      });
      if (!res?.ok) throw new Error(res?.error || 'Could not create slot');
      toast('Slot added to the date sheet', 'success');
      loadExamData();
    } catch (err) {
      toast(err.message || 'Could not create slot', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function autoFill() {
    if (!examId || !papers.length) return toast('No papers to schedule', 'warning');
    if (!window.confirm(`Create draft slots for ${papers.length} paper(s), one per day from the exam start date?`)) return;
    setBusy(true);
    try {
      const start = selectedExam?.start_date ? new Date(selectedExam.start_date) : new Date();
      const existing = new Set(slots.map((s) => `${s.paper_id}-${String(s.date).slice(0, 10)}`));
      let created = 0;
      let day = 0;
      for (const paper of papers) {
        for (let attempt = 0; attempt < 60; attempt++) {
          const date = new Date(start);
          date.setDate(start.getDate() + day + attempt);
          const iso = date.toISOString().slice(0, 10);
          if (existing.has(`${paper.id}-${iso}`)) continue;
          const res = await apiPost('/school/exam/schedule/slots', {
            examId: Number(examId),
            paperId: paper.id,
            date: iso,
            startTime: '09:00',
            endTime: '12:00',
            status: 'draft',
          });
          if (res?.ok) { created++; day += attempt + 1; }
          break;
        }
      }
      toast(`Created ${created} draft slot(s)`, 'success');
      loadExamData();
    } catch (err) {
      toast(err.message || 'Auto-fill failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function updateSlotStatus(slot, status) {
    try {
      const res = await apiPut(`/school/exam/schedule/slots/${slot.id}`, {
        date: String(slot.date).slice(0, 10),
        startTime: String(slot.start_time).slice(0, 8),
        endTime: String(slot.end_time).slice(0, 8),
        status,
      });
      if (!res?.ok) throw new Error(res?.error || 'Could not update slot');
      toast(`Slot ${status}`, 'success');
      loadExamData();
    } catch (err) {
      toast(err.message || 'Could not update slot', 'error');
    }
  }

  async function deleteSlot(slot) {
    if (!window.confirm('Remove this slot from the date sheet?')) return;
    const res = await apiDelete(`/school/exam/schedule/slots/${slot.id}`);
    if (res?.ok) { toast('Slot removed', 'success'); loadExamData(); }
    else toast(res?.error || 'Could not delete slot', 'error');
  }

  async function generateSeating() {
    if (!slotId) return toast('Select a slot first', 'warning');
    if (!window.confirm('Regenerate seating for this slot? Existing seat allocations will be replaced.')) return;
    setBusy(true);
    try {
      const res = await apiPost('/school/exam/schedule/seating/generate', { slotId: Number(slotId), hallIds: selectedHalls.map(Number) });
      if (!res?.ok) throw new Error(res?.error || 'Could not generate seating');
      toast(`Seated ${res.created} student(s) across ${res.halls} hall(s)`, 'success');
      loadModeData();
    } catch (err) {
      toast(err.message || 'Could not generate seating', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function removeAllocation(id) {
    const res = await apiDelete(`/school/exam/schedule/seating/${id}`);
    if (res?.ok) { toast('Seat released', 'success'); loadModeData(); }
  }

  async function assignDuty() {
    if (!slotId) return toast('Select a slot first', 'warning');
    if (!dutyForm.teacherId) return toast('Select a teacher', 'warning');
    setBusy(true);
    try {
      const res = await apiPost('/school/exam/schedule/invigilation', {
        slotId: Number(slotId),
        teacherId: Number(dutyForm.teacherId),
        hallId: dutyForm.hallId ? Number(dutyForm.hallId) : null,
        role: dutyForm.role,
      });
      if (!res?.ok) throw new Error(res?.error || 'Could not assign duty');
      toast('Invigilation duty assigned', 'success');
      loadModeData();
    } catch (err) {
      toast(err.message || 'Could not assign duty', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function removeDuty(id) {
    const res = await apiDelete(`/school/exam/schedule/invigilation/${id}`);
    if (res?.ok) { toast('Duty removed', 'success'); loadModeData(); }
  }

  async function generateTickets() {
    if (!examId) return toast('Select an exam first', 'warning');
    setBusy(true);
    try {
      const res = await apiPost('/school/exam/schedule/hall-tickets/generate', {
        examId: Number(examId),
        sectionId: sectionId ? Number(sectionId) : null,
        withholdFees: ticketForm.withholdFees,
        withholdAttendance: ticketForm.withholdAttendance,
        minAttendance: Number(ticketForm.minAttendance),
      });
      if (!res?.ok) throw new Error(res?.error || 'Could not generate hall tickets');
      toast(`Issued ${res.issued}, blocked ${res.blocked} of ${res.total}`, 'success');
      loadModeData();
    } catch (err) {
      toast(err.message || 'Could not generate hall tickets', 'error');
    } finally {
      setBusy(false);
    }
  }

  function toggleHall(id) {
    setSelectedHalls((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  const groupedAllocations = useMemo(() => {
    const map = new Map();
    allocations.forEach((a) => {
      if (!map.has(a.hall_name)) map.set(a.hall_name, []);
      map.get(a.hall_name).push(a);
    });
    return [...map.entries()];
  }, [allocations]);

  return (
    <PageShell
      title={MODES.find((m) => m.key === active)?.label}
      icon={MODES.find((m) => m.key === active)?.icon}
      subtitle={active === 'date-sheet' ? 'Draft and publish a clash-free date sheet' : active === 'seating' ? 'Assign students to halls and seats per slot' : active === 'invigilation' ? 'Assign invigilators and chief duties' : 'Generate eligible hall tickets with seat details'}
      onNavigate={onNavigate}
      actions={
        <button className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/examinations/schedule')}>
          <i className="bi bi-arrow-left me-1"></i>Schedule
        </button>
      }
    >
      <ErrorBox message={error} onRetry={loadBase} />

      <div className="d-flex flex-wrap gap-2 mb-3">
        {MODES.map((m) => (
          <button key={m.key} type="button" className={`btn btn-sm ${active === m.key ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => onNavigate(`/school/examinations/schedule/${m.key}`)}>
            <i className={`bi ${m.icon} me-1`}></i>{m.label}
          </button>
        ))}
      </div>

      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <label className="form-label small">Exam</label>
          <select className="form-select form-select-sm" value={examId} onChange={(e) => { setExamId(e.target.value); setSlotId(''); setSectionId(''); }}>
            <option value="">Select exam</option>
            {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        {(active === 'seating' || active === 'invigilation') && (
          <div className="col-md-5">
            <label className="form-label small">Slot</label>
            <select className="form-select form-select-sm" value={slotId} onChange={(e) => setSlotId(e.target.value)}>
              <option value="">Select slot</option>
              {slots.map((s) => <option key={s.id} value={s.id}>{fmtDate(s.date)} Ã‚Â· {fmtTime(s.start_time)} Ã‚Â· {s.subject_name || s.paper_id} Ã‚Â· {s.section_name || 'All sections'}</option>)}
            </select>
          </div>
        )}
        {active === 'hall-tickets' && (
          <div className="col-md-5">
            <label className="form-label small">Section</label>
            <select className="form-select form-select-sm" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">All sections of this exam</option>
              {classes.flatMap((c) => (c.sections || []).map((s) => <option key={s.id} value={s.id}>{c.name} / {s.name}</option>))}
            </select>
          </div>
        )}
      </div>

      {loading || busy ? <Loading text={busy ? 'WorkingÃ¢â‚¬Â¦' : 'LoadingÃ¢â‚¬Â¦'} /> : (
        <>
          {active === 'date-sheet' && (
            <div className="row g-3">
              <div className="col-lg-4">
                <div className="border rounded p-3">
                  <h6 className="fw-semibold small mb-3">Add slot</h6>
                  <div className="d-grid gap-2">
                    <div><label className="form-label small">Paper</label><select className="form-select form-select-sm" value={slotForm.paperId} onChange={(e) => setSlotForm((p) => ({ ...p, paperId: e.target.value }))}><option value="">Select paper</option>{papers.map((p) => <option key={p.id} value={p.id}>{p.subject_name} Ã‚Â· {p.class_name}</option>)}</select></div>
                    <div><label className="form-label small">Section (blank = all)</label><select className="form-select form-select-sm" value={slotForm.sectionId} onChange={(e) => setSlotForm((p) => ({ ...p, sectionId: e.target.value }))}><option value="">All sections</option>{sections.map((s) => <option key={s.id} value={s.id}>{s.class_name} / {s.name}</option>)}</select></div>
                    <div className="row g-2">
                      <div className="col-12"><label className="form-label small">Date</label><input type="date" className="form-control form-control-sm" value={slotForm.date} onChange={(e) => setSlotForm((p) => ({ ...p, date: e.target.value }))} /></div>
                      <div className="col-6"><label className="form-label small">Start</label><input type="time" className="form-control form-control-sm" value={slotForm.startTime} onChange={(e) => setSlotForm((p) => ({ ...p, startTime: e.target.value }))} /></div>
                      <div className="col-6"><label className="form-label small">End</label><input type="time" className="form-control form-control-sm" value={slotForm.endTime} onChange={(e) => setSlotForm((p) => ({ ...p, endTime: e.target.value }))} /></div>
                    </div>
                    <button className="btn btn-sm btn-primary" onClick={createSlot} disabled={!manager}>Add to date sheet</button>
                    <button className="btn btn-sm btn-outline-primary" onClick={autoFill} disabled={!manager || !papers.length}><i className="bi bi-magic me-1"></i>Auto-fill drafts</button>
                  </div>
                </div>
              </div>
              <div className="col-lg-8">
                <div className="border rounded">
                  <div className="px-3 py-2 border-bottom d-flex justify-content-between align-items-center"><span className="fw-semibold small">Date sheet ({slots.length})</span>{selectedExam && <span className="text-muted small">{fmtDate(selectedExam.start_date)} Ã¢â‚¬â€œ {fmtDate(selectedExam.end_date)}</span>}</div>
                  {!slots.length ? <Empty icon="bi-calendar3" text="No slots yet. Add one or auto-fill drafts." /> : (
                    <div className="table-responsive">
                      <table className="table table-sm mb-0 align-middle">
                        <thead><tr><th>Date</th><th>Time</th><th>Paper</th><th>Section</th><th>Status</th><th className="text-end"></th></tr></thead>
                        <tbody>
                          {slots.map((s) => (
                            <tr key={s.id}>
                              <td className="small">{fmtDate(s.date)}</td>
                              <td className="small">{fmtTime(s.start_time)} Ã¢â‚¬â€œ {fmtTime(s.end_time)}</td>
                              <td className="small">{s.subject_name} Ã‚Â· {s.class_name}</td>
                              <td className="small">{s.section_name || 'All'}</td>
                              <td><span className={`badge bg-${s.status === 'published' ? 'success' : s.status === 'cancelled' ? 'danger' : 'secondary'}`}>{s.status}</span></td>
                              <td className="text-end">
                                {manager && (
                                  <div className="btn-group btn-group-sm">
                                    {s.status !== 'published' && <button className="btn btn-outline-success" onClick={() => updateSlotStatus(s, 'published')}>Publish</button>}
                                    {s.status === 'draft' && <button className="btn btn-outline-danger" onClick={() => updateSlotStatus(s, 'cancelled')}>Cancel</button>}
                                    <button className="btn btn-outline-secondary" onClick={() => deleteSlot(s)}>Delete</button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {active === 'seating' && (
            <div className="row g-3">
              <div className="col-lg-4">
                <div className="border rounded p-3">
                  <h6 className="fw-semibold small mb-3">Generate seating</h6>
                  <div className="mb-2">
                    <label className="form-label small">Halls (blank = all active halls)</label>
                    {halls.map((h) => (
                      <div className="form-check" key={h.id}>
                        <input className="form-check-input" type="checkbox" id={`hall-${h.id}`} checked={selectedHalls.includes(h.id)} onChange={() => toggleHall(h.id)} />
                        <label className="form-check-label small" htmlFor={`hall-${h.id}`}>{h.name || h.room_name || `Hall ${h.id}`} Ã‚Â· {h.capacity} seats</label>
                      </div>
                    ))}
                  </div>
                  <button className="btn btn-sm btn-primary w-100" onClick={generateSeating} disabled={!manager || !slotId}>Generate seating</button>
                  <div className="text-muted mt-2" style={{ fontSize: 12 }}>Six seats per row, labelled A1Ã¢â‚¬Â¦ Students are filled hall by hall in roll order.</div>
                </div>
              </div>
              <div className="col-lg-8">
                <div className="border rounded">
                  <div className="px-3 py-2 border-bottom fw-semibold small">Seating ({allocations.length})</div>
                  {!allocations.length ? <Empty icon="bi-grid" text="No seat allocations for this slot yet." /> : groupedAllocations.map(([hall, rows]) => (
                    <div key={hall} className="border-bottom">
                      <div className="px-3 py-2 bg-light small fw-semibold">{hall} Ã‚Â· {rows.length} students</div>
                      <div className="table-responsive">
                        <table className="table table-sm mb-0 align-middle">
                          <thead><tr><th>Seat</th><th>Student</th><th>Class / Section</th><th>Roll</th><th className="text-end"></th></tr></thead>
                          <tbody>
                            {rows.map((a) => (
                              <tr key={a.id}>
                                <td className="small fw-semibold">{a.seat_no}</td>
                                <td className="small">{a.admission_no} Ã‚Â· {a.first_name} {a.last_name}</td>
                                <td className="small">{a.class_name} / {a.section_name}</td>
                                <td className="small">{a.roll_no || 'Ã¢â‚¬â€'}</td>
                                <td className="text-end">{manager && <button className="btn btn-sm btn-outline-danger" onClick={() => removeAllocation(a.id)}>Release</button>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {active === 'invigilation' && (
            <div className="row g-3">
              <div className="col-lg-4">
                <div className="border rounded p-3">
                  <h6 className="fw-semibold small mb-3">Assign duty</h6>
                  <div className="d-grid gap-2">
                    <div><label className="form-label small">Teacher</label><select className="form-select form-select-sm" value={dutyForm.teacherId} onChange={(e) => setDutyForm((p) => ({ ...p, teacherId: e.target.value }))}><option value="">Select teacher</option>{teachers.map((t) => <option key={`${t.source}-${t.id}`} value={t.source === 'employee' ? t.id : ''} disabled={t.source !== 'employee'}>{t.name} {t.source !== 'employee' ? '(user, not staff)' : ''}</option>)}</select></div>
                    <div><label className="form-label small">Hall (optional)</label><select className="form-select form-select-sm" value={dutyForm.hallId} onChange={(e) => setDutyForm((p) => ({ ...p, hallId: e.target.value }))}><option value="">Any / all halls</option>{halls.map((h) => <option key={h.id} value={h.id}>{h.name || h.room_name || `Hall ${h.id}`}</option>)}</select></div>
                    <div><label className="form-label small">Role</label><select className="form-select form-select-sm" value={dutyForm.role} onChange={(e) => setDutyForm((p) => ({ ...p, role: e.target.value }))}><option value="invigilator">Invigilator</option><option value="relieving">Relieving</option><option value="chief">Chief</option></select></div>
                    <button className="btn btn-sm btn-primary" onClick={assignDuty} disabled={!manager || !slotId}>Assign</button>
                  </div>
                </div>
              </div>
              <div className="col-lg-8">
                <div className="border rounded">
                  <div className="px-3 py-2 border-bottom fw-semibold small">Duties ({duties.length})</div>
                  {!duties.length ? <Empty icon="bi-people" text="No invigilation duties for this slot yet." /> : (
                    <div className="table-responsive">
                      <table className="table table-sm mb-0 align-middle">
                        <thead><tr><th>Teacher</th><th>Employee No</th><th>Hall</th><th>Role</th><th>Status</th><th className="text-end"></th></tr></thead>
                        <tbody>
                          {duties.map((d) => (
                            <tr key={d.id}>
                              <td className="small">{d.teacher_name}</td>
                              <td className="small">{d.employee_no || 'Ã¢â‚¬â€'}</td>
                              <td className="small">{d.hall_name || 'Any'}</td>
                              <td className="small">{d.role}</td>
                              <td className="small"><span className={`badge bg-${d.status === 'confirmed' ? 'success' : d.status === 'cancelled' ? 'danger' : 'secondary'}`}>{d.status}</span></td>
                              <td className="text-end">{manager && <button className="btn btn-sm btn-outline-danger" onClick={() => removeDuty(d.id)}>Remove</button>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {active === 'hall-tickets' && (
            <div className="row g-3">
              <div className="col-lg-4">
                <div className="border rounded p-3">
                  <h6 className="fw-semibold small mb-3">Generate hall tickets</h6>
                  <div className="d-grid gap-2">
                    <div className="form-check"><input className="form-check-input" type="checkbox" id="ht-fees" checked={ticketForm.withholdFees} onChange={(e) => setTicketForm((p) => ({ ...p, withholdFees: e.target.checked }))} /><label className="form-check-label small" htmlFor="ht-fees">Block students with fee dues</label></div>
                    <div className="form-check"><input className="form-check-input" type="checkbox" id="ht-att" checked={ticketForm.withholdAttendance} onChange={(e) => setTicketForm((p) => ({ ...p, withholdAttendance: e.target.checked }))} /><label className="form-check-label small" htmlFor="ht-att">Block students below the attendance threshold</label></div>
                    <div><label className="form-label small">Minimum attendance %</label><input type="number" className="form-control form-control-sm" value={ticketForm.minAttendance} onChange={(e) => setTicketForm((p) => ({ ...p, minAttendance: e.target.value }))} disabled={!ticketForm.withholdAttendance} /></div>
                    <button className="btn btn-sm btn-primary" onClick={generateTickets} disabled={!manager || !examId}>Generate</button>
                  </div>
                </div>
              </div>
              <div className="col-lg-8">
                <div className="border rounded">
                  <div className="px-3 py-2 border-bottom d-flex justify-content-between"><span className="fw-semibold small">Hall tickets ({tickets.length})</span><span className="small text-muted">{tickets.filter((t) => t.status === 'blocked').length} blocked</span></div>
                  {!tickets.length ? <Empty icon="bi-card-checklist" text="No hall tickets generated for this exam yet." /> : (
                    <div className="table-responsive">
                      <table className="table table-sm mb-0 align-middle">
                        <thead><tr><th>Student</th><th>Class / Section</th><th>Roll</th><th>Status</th><th>Reason</th><th className="text-end"></th></tr></thead>
                        <tbody>
                          {tickets.map((t) => (
                            <tr key={t.id}>
                              <td className="small">{t.admission_no} Ã‚Â· {t.first_name} {t.last_name}</td>
                              <td className="small">{t.class_name} / {t.section_name}</td>
                              <td className="small">{t.roll_no || 'Ã¢â‚¬â€'}</td>
                              <td><span className={`badge bg-${t.status === 'issued' ? 'success' : t.status === 'blocked' ? 'danger' : 'secondary'}`}>{t.status}</span></td>
                              <td className="small">{t.blocked_reason || 'Ã¢â‚¬â€'}</td>
                              <td className="text-end"><button className="btn btn-sm btn-outline-primary" onClick={() => openAuthorized(`/school/exam/schedule/hall-tickets/${t.id}/preview`)}>Preview</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}

