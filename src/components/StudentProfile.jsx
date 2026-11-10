import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, apiPut, apiDelete, openApiFile } from '../api';
import { toast } from '../toast';
import PrintButton from './PrintButton';
import StudentPhoto from './StudentPhoto';

const money = (v) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
}).format(Number(v || 0));
const d = (v) => (v ? new Date(v).toLocaleDateString('en-IN') : '-');
const dt = (v) => (v ? new Date(v).toLocaleString('en-IN') : '-');
const fullName = (s) => `${s?.first_name || ''} ${s?.last_name || ''}`.trim() || 'Student';
const cls = (s) => [s?.class_name, s?.section_name].filter(Boolean).join(' - ') || 'Unassigned';

const TABS = [
  ['overview', 'Overview', 'bi-person-vcard'],
  ['guardians', 'Guardians', 'bi-people'],
  ['enrollments', 'Enrollments', 'bi-mortarboard'],
  ['fees', 'Fees', 'bi-receipt'],
  ['attendance', 'Attendance', 'bi-calendar-check'],
  ['documents', 'Documents', 'bi-folder2-open'],
  ['health', 'Health', 'bi-heart-pulse'],
  ['discipline', 'Discipline', 'bi-shield-exclamation'],
  ['audit', 'Audit', 'bi-clock-history'],
];

const blankGuardian = {
  name: '', relation: 'Parent', phone: '', email: '', occupation: '',
  isPrimary: false, isEmergency: false, canPickup: true, isFeePayer: false,
};
const blankDoc = { documentTypeId: '', fileName: '', fileUrl: '', status: 'pending', expiresOn: '' };

export default function StudentProfile({ studentId, onClose, onEdit }) {
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [types, setTypes] = useState([]);
  const [health, setHealth] = useState({ profile: null, events: [], observations: [], vaccinations: [] });
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardian, setGuardian] = useState(blankGuardian);
  const [editingGuardianId, setEditingGuardianId] = useState(null);
  const [doc, setDoc] = useState(blankDoc);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        apiGet(`/school/students/${studentId}`),
        apiGet('/school/document-types'),
      ]);
      if (!a?.ok) throw new Error(a?.error || 'Could not load student');
      setData(a);
      setTypes(b?.types || []);
    } catch (e) {
      toast(e.message || 'Could not load student', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [studentId]);

  useEffect(() => {
    let active = true;
    if (tab === 'health') {
      setHealth({ profile: null, events: [], observations: [], vaccinations: [] });
      Promise.all([
        apiGet(`/school/health/profiles?studentId=${studentId}`),
        apiGet(`/school/health/events?studentId=${studentId}`),
        apiGet(`/school/health/observations?studentId=${studentId}`),
        apiGet(`/school/health/vaccinations?studentId=${studentId}`),
      ]).then(([profiles, events, observations, vaccinations]) => {
        if (!active) return;
        const failed = [profiles, events, observations, vaccinations].find((result) => !result?.ok);
        if (failed) throw new Error(failed.error || 'Could not load health records');
        setHealth({
          profile: profiles.profiles?.[0] || null,
          events: events.events || [],
          observations: observations.observations || [],
          vaccinations: vaccinations.vaccinations || [],
        });
      }).catch((error) => toast(error.message, 'error'));
    }
    if (tab === 'discipline') {
      apiGet(`/school/discipline/incidents?studentId=${studentId}`).then((result) => {
        if (!active) return;
        if (!result?.ok) throw new Error(result?.error || 'Could not load discipline records');
        setIncidents(result.incidents || []);
      }).catch((error) => toast(error.message, 'error'));
    }
    return () => { active = false; };
  }, [tab, studentId]);

  const s = data?.student;
  const feeSummary = useMemo(() => {
    const inv = data?.invoices || [];
    return inv.reduce((acc, i) => {
      acc.billed += Number(i.amount || 0);
      acc.paid += Number(i.paid_amount || 0);
      acc.balance += Number(i.amount || 0) - Number(i.paid_amount || 0);
      return acc;
    }, { billed: 0, paid: 0, balance: 0 });
  }, [data]);

  const attendanceSummary = useMemo(() => {
    const out = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
    for (const r of data?.attendance || []) {
      out[r.status] = Number(r.n || 0);
      out.total += Number(r.n || 0);
    }
    return out;
  }, [data]);

  const healthSummary = health.profile || s;
  const hasHealthSummary = Boolean(healthSummary && [
    healthSummary.blood_group, healthSummary.allergies, healthSummary.chronic_conditions,
    healthSummary.medical_conditions, healthSummary.regular_medications,
    healthSummary.doctor_name, healthSummary.doctor_contact, healthSummary.height_cm,
    healthSummary.weight_kg, healthSummary.preferred_hospital,
  ].some(Boolean));

  async function addGuardian(e) {
    e.preventDefault();
    if (!guardian.name.trim()) return toast('Guardian name is required', 'error');
    setSaving(true);
    try {
      const res = editingGuardianId
        ? await apiPut(`/school/students/${studentId}/guardians/${editingGuardianId}`, guardian)
        : await apiPost(`/school/students/${studentId}/guardians`, guardian);
      if (!res?.ok) throw new Error(res?.error || (editingGuardianId ? 'Could not update guardian' : 'Could not add guardian'));
      toast(editingGuardianId ? 'Guardian updated' : 'Guardian linked', 'success');
      setGuardian(blankGuardian);
      setEditingGuardianId(null);
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally { setSaving(false); }
  }

  function editGuardian(g) {
    setEditingGuardianId(g.id);
    setGuardian({
      name: g.name || '',
      relation: g.link_relation || g.relation || 'Guardian',
      phone: g.phone || '',
      email: g.email || '',
      occupation: g.occupation || '',
      isPrimary: !!g.is_primary,
      isEmergency: !!g.is_emergency,
      canPickup: !!g.can_pickup,
      isFeePayer: !!g.is_fee_payer,
    });
  }

  async function removeGuardian(g) {
    if (!window.confirm(`Remove ${g.name} from this student's guardians?`)) return;
    try {
      const res = await apiDelete(`/school/students/${studentId}/guardians/${g.id}`);
      if (!res?.ok) throw new Error(res?.error || 'Could not remove guardian');
      toast('Guardian removed', 'success');
      await load();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function addDocument(e) {
    e.preventDefault();
    if (!doc.fileName.trim()) return toast('File name is required', 'error');
    setSaving(true);
    try {
      const res = await apiPost(`/school/students/${studentId}/documents`, doc);
      if (!res?.ok) throw new Error(res?.error || 'Could not add document');
      toast('Document added', 'success');
      setDoc(blankDoc);
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally { setSaving(false); }
  }

  async function removeDocument(row) {
    if (!window.confirm(`Remove ${row.file_name}?`)) return;
    try {
      const res = await apiDelete(`/school/students/${studentId}/documents/${row.id}`);
      if (!res?.ok) throw new Error(res?.error || 'Could not remove document');
      toast('Document removed', 'success');
      await load();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  return (
    <div className="student-profile-overlay" id="student-profile-print-target" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="student-profile" role="dialog" aria-modal="true">
        <div className="student-profile-head">
          <StudentPhoto photoUrl={s?.photo_url} name={fullName(s)} className="student-profile-avatar" />
          <div className="student-profile-title">
            <h5>{s ? fullName(s) : 'Loading...'}</h5>
            <span>{s ? `${s.admission_no} · ${cls(s)} · ${s.campus_name || 'Main campus'}` : ''}</span>
          </div>
          {s && <span className={`badge school-badge ${s.status}`}>{s.status}</span>}
          <div className="ms-auto d-flex gap-2">
            <PrintButton targetId="student-profile-print-target" />
            {s && <button className="btn btn-sm btn-outline-secondary" onClick={() => onEdit(s)}><i className="bi bi-pencil"></i> Edit</button>}
            <button className="btn btn-sm btn-outline-secondary no-print" onClick={onClose} aria-label="Close"><i className="bi bi-x-lg"></i></button>
          </div>
        </div>

        <div className="student-profile-tabs no-print">
          {TABS.map(([id, label, icon]) => (
            <button key={id} className={`school-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              <i className={`bi ${icon}`}></i><span>{label}</span>
            </button>
          ))}
        </div>

        <div className="student-profile-body">
          {loading && <div className="school-loading"><div className="spinner-border spinner-border-sm text-primary"></div> Loading profile...</div>}
          {!loading && !s && <div className="school-empty"><i className="bi bi-person-x"></i><span>Student not found</span></div>}

          {!loading && s && tab === 'overview' && (
            <div className="student-profile-grid">
              <section className="school-card">
                <header><h6>Personal details</h6></header>
                <dl className="profile-dl">
                  <dt>Admission no</dt><dd>{s.admission_no}</dd>
                  <dt>Class</dt><dd>{cls(s)}</dd>
                  <dt>Campus</dt><dd>{s.campus_name || '-'}</dd>
                  <dt>Gender</dt><dd>{s.gender || '-'}</dd>
                  <dt>Date of birth</dt><dd>{d(s.dob)}</dd>
                  <dt>Blood group</dt><dd>{s.blood_group || '-'}</dd>
                  <dt>Category</dt><dd>{s.category || '-'}</dd>
                  <dt>Nationality</dt><dd>{s.nationality || '-'}</dd>
                  <dt>House</dt><dd>{s.house || '-'}</dd>
                  <dt>National ID</dt><dd>{s.national_id || '-'}</dd>
                  <dt>Previous school</dt><dd>{s.previous_school || '-'}</dd>
                  <dt>Admission date</dt><dd>{d(s.admission_date)}</dd>
                  <dt>Address</dt><dd>{s.address || '-'}</dd>
                </dl>
              </section>

              <section className="school-card">
                <header><h6>Family & contacts</h6></header>
                <dl className="profile-dl">
                  <dt>Family</dt><dd>{s.family_name || '-'}</dd>
                  <dt>Primary guardian</dt><dd>{s.guardian_name || '-'}</dd>
                  <dt>Phone</dt><dd>{s.guardian_phone || '-'}</dd>
                  <dt>Email</dt><dd>{s.guardian_email || '-'}</dd>
                </dl>
                <header className="mt-3"><h6>Enrollment history</h6></header>
                <div className="school-table-wrap">
                  <table className="table table-sm school-table mb-0">
                    <thead><tr><th>Year</th><th>Class</th><th>Status</th></tr></thead>
                    <tbody>
                      {(data.enrollments || []).length === 0 && <tr><td colSpan="3" className="school-muted">No enrollment records</td></tr>}
                      {(data.enrollments || []).map((e) => (
                        <tr key={e.id}>
                          <td>{e.academic_year || '-'}</td>
                          <td>{[e.class_name, e.section_name].filter(Boolean).join(' - ') || '-'}</td>
                          <td><span className="badge school-badge">{e.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="school-card span-2">
                <header><h6>Siblings</h6></header>
                {(data.siblings || []).length === 0 ? (
                  <div className="school-muted">No siblings linked to this family.</div>
                ) : (
                  <div className="school-chip-row">
                    {data.siblings.map((x) => (
                      <span className="school-chip" key={x.id}>
                        <i className="bi bi-person"></i> {fullName(x)} <span className="school-muted">{x.admission_no}</span>
                      </span>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {!loading && s && tab === 'guardians' && (
            <div className="student-profile-grid">
              <section className="school-card span-2">
                <header><h6>Linked guardians</h6><span className="school-muted">{data.guardians.length} contact(s)</span></header>
                <div className="guardian-grid">
                  {(data.guardians || []).length === 0 && <div className="school-muted">No guardians linked yet.</div>}
                  {(data.guardians || []).map((g) => (
                    <div className="guardian-card" key={g.id}>
                      <div className="guardian-avatar">{(g.name || '?')[0]}</div>
                      <div className="guardian-main">
                        <strong>{g.name}</strong>
                        <span>{g.relation || g.link_relation || 'Guardian'}</span>
                        <div className="school-muted">{g.phone || '-'} · {g.email || '-'}</div>
                        <div className="guardian-flags">
                          {g.is_primary && <span className="badge school-badge present">Primary</span>}
                          {g.is_emergency && <span className="badge school-badge late">Emergency</span>}
                          {g.is_fee_payer && <span className="badge school-badge partial">Fee payer</span>}
                          {g.can_pickup && <span className="badge school-badge">Pickup</span>}
                        </div>
                      </div>
                      <div className="d-flex gap-1 no-print">
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => editGuardian(g)} title="Edit guardian">
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => removeGuardian(g)} title="Unlink guardian">
                          <i className="bi bi-x-lg"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <form className="school-card span-2" onSubmit={addGuardian}>
                <header><h6>{editingGuardianId ? 'Edit guardian' : 'Link another guardian'}</h6></header>
                <div className="school-form-grid">
                  <label>Name *<input className="form-control form-control-sm" value={guardian.name} required onChange={(e) => setGuardian({ ...guardian, name: e.target.value })} /></label>
                  <label>Relation<select className="form-select form-select-sm" value={guardian.relation} onChange={(e) => setGuardian({ ...guardian, relation: e.target.value })}>
                    <option>Parent</option><option>Mother</option><option>Father</option><option>Guardian</option><option>Grandparent</option><option>Uncle</option><option>Aunt</option><option>Sibling</option>
                  </select></label>
                  <label>Phone<input className="form-control form-control-sm" value={guardian.phone} onChange={(e) => setGuardian({ ...guardian, phone: e.target.value })} /></label>
                  <label>Email<input type="email" className="form-control form-control-sm" value={guardian.email} onChange={(e) => setGuardian({ ...guardian, email: e.target.value })} /></label>
                  <label>Occupation<input className="form-control form-control-sm" value={guardian.occupation} onChange={(e) => setGuardian({ ...guardian, occupation: e.target.value })} /></label>
                  <label className="d-flex align-items-end gap-2 pb-1">
                    <input type="checkbox" className="form-check-input" checked={guardian.isPrimary} onChange={(e) => setGuardian({ ...guardian, isPrimary: e.target.checked })} />
                    Make primary guardian
                  </label>
                  <label className="d-flex align-items-end gap-2 pb-1">
                    <input type="checkbox" className="form-check-input" checked={guardian.isEmergency} onChange={(e) => setGuardian({ ...guardian, isEmergency: e.target.checked })} />
                    Emergency contact
                  </label>
                  <label className="d-flex align-items-end gap-2 pb-1">
                    <input type="checkbox" className="form-check-input" checked={guardian.canPickup} onChange={(e) => setGuardian({ ...guardian, canPickup: e.target.checked })} />
                    Authorized for pickup
                  </label>
                  <label className="d-flex align-items-end gap-2 pb-1">
                    <input type="checkbox" className="form-check-input" checked={guardian.isFeePayer} onChange={(e) => setGuardian({ ...guardian, isFeePayer: e.target.checked })} />
                    Fee payer
                  </label>
                </div>
                <div className="school-form-actions">
                  <button className="btn btn-sm btn-primary" type="submit" disabled={saving}><i className="bi bi-link-45deg"></i> {editingGuardianId ? 'Save changes' : 'Link guardian'}</button>
                  {editingGuardianId && <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => { setEditingGuardianId(null); setGuardian(blankGuardian); }}>Cancel</button>}
                </div>
              </form>
            </div>
          )}

          {!loading && s && tab === 'enrollments' && (
            <section className="school-card">
              <header><h6>Enrollment history</h6><span className="school-muted">{data.enrollments?.length || 0} record(s)</span></header>
              <div className="school-table-wrap">
                <table className="table table-sm school-table">
                  <thead><tr><th>Academic year</th><th>Class</th><th>Roll no</th><th>Joined</th><th>Left</th><th>Status</th></tr></thead>
                  <tbody>
                    {(data.enrollments || []).map((row) => (
                      <tr key={row.id}><td>{row.academic_year || '-'}</td><td>{[row.class_name, row.section_name].filter(Boolean).join(' - ') || '-'}</td><td>{row.roll_no || '-'}</td><td>{d(row.joined_on || row.start_date)}</td><td>{d(row.left_on || row.end_date)}</td><td>{row.status}</td></tr>
                    ))}
                    {!data.enrollments?.length && <tr><td colSpan="6" className="school-muted">No enrollment records.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {!loading && s && tab === 'fees' && (
            <div className="student-profile-grid">
              <div className="school-stats span-2">
                <div className="school-stat tone-blue"><div className="school-stat-icon"><i className="bi bi-receipt"></i></div><div><div className="school-stat-value">{money(feeSummary.billed)}</div><div className="school-stat-label">Billed</div></div></div>
                <div className="school-stat tone-green"><div className="school-stat-icon"><i className="bi bi-cash-stack"></i></div><div><div className="school-stat-value">{money(feeSummary.paid)}</div><div className="school-stat-label">Paid</div></div></div>
                <div className="school-stat tone-amber"><div className="school-stat-icon"><i className="bi bi-exclamation-circle"></i></div><div><div className="school-stat-value">{money(feeSummary.balance)}</div><div className="school-stat-label">Balance</div></div></div>
                <div className="school-stat tone-teal"><div className="school-stat-icon"><i className="bi bi-wallet2"></i></div><div><div className="school-stat-value">{data.payments.length}</div><div className="school-stat-label">Payments</div></div></div>
              </div>
              <section className="school-card span-2">
                <header><h6>Invoices</h6></header>
                <div className="school-table-wrap">
                  <table className="table table-sm school-table">
                    <thead><tr><th>#</th><th>Title</th><th>Due</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
                    <tbody>
                      {(data.invoices || []).length === 0 && <tr><td colSpan="7" className="school-muted">No invoices raised.</td></tr>}
                      {(data.invoices || []).map((i) => (
                        <tr key={i.id}>
                          <td><code>INV-{i.id}</code></td><td>{i.title}</td><td>{d(i.due_date)}</td>
                          <td>{money(i.amount)}</td><td>{money(i.paid_amount)}</td>
                          <td><strong>{money(Number(i.amount) - Number(i.paid_amount))}</strong></td>
                          <td><span className={`badge school-badge ${i.status}`}>{i.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="school-card span-2">
                <header><h6>Payments</h6></header>
                <div className="school-table-wrap">
                  <table className="table table-sm school-table">
                    <thead><tr><th>#</th><th>Invoice</th><th>Amount</th><th>Method</th><th>Reference</th><th>Date</th></tr></thead>
                    <tbody>
                      {(data.payments || []).length === 0 && <tr><td colSpan="6" className="school-muted">No payments recorded.</td></tr>}
                      {(data.payments || []).map((p) => (
                        <tr key={p.id}><td><code>PAY-{p.id}</code></td><td>{p.title}</td><td>{money(p.amount)}</td><td className="text-capitalize">{p.method}</td><td>{p.reference || '-'}</td><td>{d(p.paid_at)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {!loading && s && tab === 'attendance' && (
            <div className="student-profile-grid">
              <div className="school-stats span-2">
                <div className="school-stat tone-green"><div className="school-stat-icon"><i className="bi bi-check2-circle"></i></div><div><div className="school-stat-value">{attendanceSummary.present}</div><div className="school-stat-label">Present</div></div></div>
                <div className="school-stat tone-amber"><div className="school-stat-icon"><i className="bi bi-x-circle"></i></div><div><div className="school-stat-value">{attendanceSummary.absent}</div><div className="school-stat-label">Absent</div></div></div>
                <div className="school-stat tone-blue"><div className="school-stat-icon"><i className="bi bi-clock"></i></div><div><div className="school-stat-value">{attendanceSummary.late}</div><div className="school-stat-label">Late</div></div></div>
                <div className="school-stat tone-slate"><div className="school-stat-icon"><i className="bi bi-calendar-check"></i></div><div><div className="school-stat-value">{attendanceSummary.total}</div><div className="school-stat-label">Days marked</div></div></div>
              </div>
              <section className="school-card span-2">
                <header><h6>Recent attendance</h6><span className="school-muted">last 30 records</span></header>
                <div className="school-table-wrap">
                  <table className="table table-sm school-table">
                    <thead><tr><th>Date</th><th>Status</th><th>Remarks</th></tr></thead>
                    <tbody>
                      {(data.attendanceRecent || []).length === 0 && <tr><td colSpan="3" className="school-muted">No attendance recorded.</td></tr>}
                      {(data.attendanceRecent || []).map((a) => (
                        <tr key={a.attendance_date}><td>{d(a.attendance_date)}</td><td><span className={`badge school-badge ${a.status}`}>{a.status}</span></td><td>{a.remarks || '-'}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {!loading && s && tab === 'documents' && (
            <div className="student-profile-grid">
              <section className="school-card span-2">
                <header><h6>Document vault</h6><span className="school-muted">{data.documents.length} file(s)</span></header>
                <div className="school-table-wrap">
                  <table className="table table-sm school-table">
                    <thead><tr><th>Type</th><th>File</th><th>Status</th><th>Expires</th><th>Added</th><th></th></tr></thead>
                    <tbody>
                      {(data.documents || []).length === 0 && <tr><td colSpan="6" className="school-muted">No documents uploaded.</td></tr>}
                      {(data.documents || []).map((row) => (
                        <tr key={row.id}>
                          <td>{row.type_name || '-'}</td>
                          <td>
                            {row.file_url
                              ? <a href={row.file_url} onClick={(e) => { e.preventDefault(); openApiFile(row.file_url).catch((error) => toast(error.message, 'error')); }}>{row.file_name}</a>
                              : row.file_name}
                          </td>
                          <td><span className={`badge school-badge ${row.status}`}>{row.status}</span></td>
                          <td>{d(row.expires_on)}</td><td>{d(row.created_at)}</td>
                          <td className="text-end"><button className="btn btn-sm btn-outline-danger" onClick={() => removeDocument(row)}><i className="bi bi-trash"></i></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <form className="school-card span-2" onSubmit={addDocument}>
                <header><h6>Add document</h6></header>
                <div className="school-form-grid">
                  <label>Type<select className="form-select form-select-sm" value={doc.documentTypeId} onChange={(e) => setDoc({ ...doc, documentTypeId: e.target.value })}>
                    <option value="">Unclassified</option>
                    {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select></label>
                  <label>File name *<input className="form-control form-control-sm" value={doc.fileName} required placeholder="birth-certificate.pdf" onChange={(e) => setDoc({ ...doc, fileName: e.target.value })} /></label>
                  <label>File link<input className="form-control form-control-sm" value={doc.fileUrl} placeholder="https://... or /uploads/..." onChange={(e) => setDoc({ ...doc, fileUrl: e.target.value })} /></label>
                  <label>Status<select className="form-select form-select-sm" value={doc.status} onChange={(e) => setDoc({ ...doc, status: e.target.value })}>
                    <option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="expired">Expired</option>
                  </select></label>
                  <label>Expires on<input type="date" className="form-control form-control-sm" value={doc.expiresOn} onChange={(e) => setDoc({ ...doc, expiresOn: e.target.value })} /></label>
                  <div className="align-self-end"><button className="btn btn-sm btn-primary w-100" type="submit" disabled={saving}><i className="bi bi-upload"></i> Add document</button></div>
                </div>
                <div className="school-alert-note mt-3 mb-0">
                  <i className="bi bi-info-circle"></i>
                  Store the file with your document service or upload folder, then paste its link here. The 360° profile keeps the metadata, status and expiry.
                </div>
              </form>
            </div>
          )}

          {!loading && s && tab === 'health' && (
            <div className="student-profile-grid">
              <section className="school-card span-2">
                <header><h6>Health profile</h6>{healthSummary?.allergies && <span className="badge school-badge absent">Allergy alert</span>}</header>
                {hasHealthSummary ? (
                  <dl className="profile-dl">
                    <dt>Blood group</dt><dd>{healthSummary.blood_group || '-'}</dd>
                    <dt>Height</dt><dd>{healthSummary.height_cm ? `${healthSummary.height_cm} cm` : '-'}</dd>
                    <dt>Weight</dt><dd>{healthSummary.weight_kg ? `${healthSummary.weight_kg} kg` : '-'}</dd>
                    <dt>Allergies</dt><dd>{healthSummary.allergies || 'None recorded'}</dd>
                    <dt>Conditions</dt><dd>{Array.isArray(healthSummary.chronic_conditions) ? healthSummary.chronic_conditions.join(', ') : healthSummary.chronic_conditions || healthSummary.medical_conditions || '-'}</dd>
                    <dt>Medication</dt><dd>{healthSummary.regular_medications || '-'}</dd>
                    <dt>Emergency doctor</dt><dd>{healthSummary.doctor_name || '-'}</dd>
                    <dt>Doctor contact</dt><dd>{healthSummary.doctor_contact || '-'}</dd>
                    <dt>Preferred hospital</dt><dd>{healthSummary.preferred_hospital || '-'}</dd>
                    <dt>Medical fitness certificate</dt><dd>{healthSummary.medical_fitness_url ? <a href={healthSummary.medical_fitness_url} onClick={(event) => { event.preventDefault(); openApiFile(healthSummary.medical_fitness_url).catch((error) => toast(error.message, 'error')); }}>Open certificate</a> : '-'}</dd>
                  </dl>
                ) : <div className="school-muted">No health profile available or permission was not granted.</div>}
              </section>
              <section className="school-card span-2">
                <header><h6>Health event history</h6></header>
                <div className="school-table-wrap">
                  <table className="table table-sm school-table">
                    <thead><tr><th>Date</th><th>Complaint</th><th>Treatment</th><th>Action</th><th>Parent informed</th></tr></thead>
                    <tbody>
                      {health.events.map((row) => <tr key={row.id}><td>{dt(row.event_datetime)}</td><td>{row.symptom_complaint}</td><td>{row.treatment_given || '-'}</td><td>{row.action_taken || '-'}</td><td>{row.parent_informed ? 'Yes' : 'No'}</td></tr>)}
                      {!health.events.length && <tr><td colSpan="5" className="school-muted">No health events.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="school-card span-2">
                <header><h6>Growth observations</h6></header>
                <div className="school-table-wrap">
                  <table className="table table-sm school-table">
                    <thead><tr><th>Date</th><th>Measurement</th><th>Value</th><th>Notes</th></tr></thead>
                    <tbody>
                      {health.observations.map((row) => <tr key={row.id}><td>{String(row.observed_at || '').slice(0, 10) || '-'}</td><td>{row.observation_type}</td><td>{row.value} {row.unit}</td><td>{row.notes || '-'}</td></tr>)}
                      {!health.observations.length && <tr><td colSpan="4" className="school-muted">No growth observations.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="school-card span-2">
                <header><h6>Vaccinations</h6></header>
                <div className="school-table-wrap">
                  <table className="table table-sm school-table">
                    <thead><tr><th>Vaccine</th><th>Dose</th><th>Date</th><th>Next due</th><th>Certificate</th></tr></thead>
                    <tbody>
                      {health.vaccinations.map((row) => <tr key={row.id}>
                        <td>{row.vaccine_name}</td><td>{row.dose_number || '-'}</td>
                        <td>{String(row.vaccination_date || '').slice(0, 10) || '-'}</td>
                        <td>{String(row.next_due_date || '').slice(0, 10) || '-'}</td>
                        <td>{row.certificate_url && <a href={row.certificate_url} onClick={(event) => { event.preventDefault(); openApiFile(row.certificate_url).catch((error) => toast(error.message, 'error')); }}>Open</a>}</td>
                      </tr>)}
                      {!health.vaccinations.length && <tr><td colSpan="5" className="school-muted">No vaccinations.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {!loading && s && tab === 'discipline' && (
            <section className="school-card">
              <header><h6>Discipline history</h6><span className="school-muted">{incidents.length} incident(s)</span></header>
              <div className="school-table-wrap">
                <table className="table table-sm school-table">
                  <thead><tr><th>Date</th><th>Incident</th><th>Severity</th><th>Location</th><th>Status</th></tr></thead>
                  <tbody>
                    {incidents.map((row) => <tr key={row.id}><td>{dt(row.incident_datetime)}</td><td>{row.incident_type}<div className="school-muted">{row.description}</div></td><td>{row.severity}</td><td>{row.location}</td><td>{row.status}</td></tr>)}
                    {!incidents.length && <tr><td colSpan="5" className="school-muted">No discipline incidents.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {!loading && s && tab === 'audit' && (
            <section className="school-card">
              <header><h6>Change history</h6></header>
              <div className="audit-timeline">
                {(data.audit || []).length === 0 && <div className="school-muted">No changes recorded yet.</div>}
                {(data.audit || []).map((a) => (
                  <div className="audit-entry" key={a.id}>
                    <span className="audit-dot"></span>
                    <div>
                      <strong>{a.action}</strong>
                      <div className="school-muted">{a.user_id || 'system'} · {dt(a.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
