import React, { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, ErrorBox, Badge, canManageHR, fmtDate, downloadCsv } from './shared';

const STATUS_TONE = { active: 'success', inactive: 'secondary', on_leave: 'warning', exited: 'danger' };
const TYPE_TONE = { permanent: 'success', contract: 'info', part_time: 'warning', visiting: 'info', probation: 'warning' };

export default function StaffProfile({ me, onNavigate, staffId }) {
  const [staff, setStaff] = useState(null);
  const [employment, setEmployment] = useState([]);
  const [qualifications, setQualifications] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [bank, setBank] = useState([]);
  const [statutory, setStatutory] = useState(null);
  const [nominees, setNominees] = useState([]);
  const [emergency, setEmergency] = useState([]);
  const [activeTab, setActiveTab] = useState('personal');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const manager = canManageHR(me);

  async function load() {
    if (!staffId) return;
    setLoading(true);
    setError('');
    try {
      const [s, emp, qual, docs, bnk, stat, nom, emg] = await Promise.all([
        apiGet(`/school/hr/staff/${staffId}`),
        apiGet(`/school/hr/staff/${staffId}/employment`),
        apiGet(`/school/hr/staff/${staffId}/qualifications`),
        apiGet(`/school/hr/staff/${staffId}/documents`),
        apiGet(`/school/hr/staff/${staffId}/bank`),
        apiGet(`/school/hr/staff/${staffId}/statutory`),
        apiGet(`/school/hr/staff/${staffId}/nominees`),
        apiGet(`/school/hr/staff/${staffId}/emergency`),
      ]);
      if (s?.ok) setStaff(s);
      if (emp?.ok) setEmployment(emp.employment || []);
      if (qual?.ok) setQualifications(qual.qualifications || []);
      if (docs?.ok) setDocuments(docs.documents || []);
      if (bnk?.ok) setBank(bnk.bank || []);
      if (stat?.ok) setStatutory(stat.statutory?.[0] || null);
      if (nom?.ok) setNominees(nom.nominees || []);
      if (emg?.ok) setEmergency(emg.emergency || []);
    } catch (err) { setError(err.message || 'Failed to load profile'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [staffId]);

  const tabs = [
    ['personal', 'Personal', 'bi-person'],
    ['employment', 'Employment', 'bi-briefcase'],
    ['qualifications', 'Qualifications', 'bi-mortarboard'],
    ['documents', 'Documents', 'bi-file-earmark'],
    ['bank', 'Bank & Statutory', 'bi-bank'],
    ['nominees', 'Nominees', 'bi-people'],
    ['emergency', 'Emergency', 'bi-exclamation-triangle'],
  ];

  if (loading) return <PageShell title="Loading..." icon="bi-hourglass" subtitle="Loading staff profile..." onNavigate={onNavigate}><Loading /></PageShell>;
  if (error) return <PageShell title="Error" icon="bi-exclamation-triangle" subtitle={error} onNavigate={onNavigate}><ErrorBox message={error} onRetry={load} /></PageShell>;
  if (!staff) return <PageShell title="Not Found" icon="bi-person-x" subtitle="Staff not found" onNavigate={onNavigate}><Empty icon="bi-person-x" text="Staff member not found." /></PageShell>;

  return (
    <PageShell
      title={staff.name}
      icon="bi-person-badge"
      subtitle={staff.employee_code}
      onNavigate={onNavigate}
      backPath="/school/hr/staff"
      actions={
        <>
          {staff.hr_employee_id && (
            <button className="btn btn-sm btn-outline-primary" onClick={() => onNavigate(`/school/timetable/teacher/${staff.hr_employee_id}`)}>
              <i className="bi bi-calendar3-week me-1"></i>View Timetable
            </button>
          )}
          {manager && <>
            <button className="btn btn-sm btn-outline-primary" onClick={() => onNavigate(`/school/hr/staff/${staffId}/employment/new`)}><i className="bi bi-briefcase me-1"></i>New Employment</button>
            <button className="btn btn-sm btn-outline-primary" onClick={() => onNavigate(`/school/hr/staff/${staffId}/documents/new`)}><i className="bi bi-file-earmark-plus me-1"></i>Add Document</button>
          </>}
        </>
      }
    >
      <div className="row g-3 mb-4">
        <div className="col-md-2 text-center">
          <div className="bg-light rounded-circle d-inline-flex align-items-center justify-content-center" style={{width: 80, height: 80}}>
            <i className="bi bi-person-fill text-muted" style={{fontSize: 40}}></i>
          </div>
        </div>
        <div className="col-md-10">
          <h4 className="mb-1">{staff.name}</h4>
          <div className="d-flex flex-wrap gap-3 small text-muted">
            <span><Badge tone={TYPE_TONE[staff.employment?.[0]?.type] || 'secondary'}>{staff.employment?.[0]?.type || 'Ã¢â‚¬â€'}</Badge></span>
            <span>{staff.employment?.[0]?.designation || 'Ã¢â‚¬â€'}</span>
            <span>{staff.employment?.[0]?.department || 'Ã¢â‚¬â€'}</span>
            <span>Joined: {fmtDate(staff.employment?.[0]?.joining_date)}</span>
            <span><Badge tone={STATUS_TONE[staff.status] || 'secondary'}>{staff.status}</Badge></span>
          </div>
        </div>
      </div>

      <ul className="nav nav-tabs mb-3" role="tablist">
        {tabs.map(([key, label, icon]) => (
          <li className="nav-item" key={key}>
            <button className={`nav-link ${activeTab === key ? 'active' : ''}`} onClick={() => setActiveTab(key)}>
              <i className={`bi ${icon} me-1`}></i>{label}
            </button>
          </li>
        ))}
      </ul>

      {activeTab === 'personal' && (
        <div className="row g-3">
          <div className="col-md-4"><label className="form-label small">Employee Code</label><input className="form-control form-control-sm" value={staff.employee_code} readOnly /></div>
          <div className="col-md-4"><label className="form-label small">Name</label><input className="form-control form-control-sm" value={staff.name} readOnly /></div>
          <div className="col-md-4"><label className="form-label small">Date of Birth</label><input className="form-control form-control-sm" value={fmtDate(staff.date_of_birth)} readOnly /></div>
          <div className="col-md-4"><label className="form-label small">Gender</label><input className="form-control form-control-sm" value={staff.gender || 'Ã¢â‚¬â€'} readOnly /></div>
          <div className="col-md-4"><label className="form-label small">Phone</label><input className="form-control form-control-sm" value={staff.contact_phone || 'Ã¢â‚¬â€'} readOnly /></div>
          <div className="col-md-4"><label className="form-label small">Email</label><input className="form-control form-control-sm" value={staff.contact_email || 'Ã¢â‚¬â€'} readOnly /></div>
          <div className="col-md-6"><label className="form-label small">Address</label><input className="form-control form-control-sm" value={staff.address || 'Ã¢â‚¬â€'} readOnly /></div>
        </div>
      )}

      {activeTab === 'employment' && (
        <>
          {manager && <button className="btn btn-sm btn-outline-primary mb-3" onClick={() => onNavigate(`/school/hr/staff/${staffId}/employment/new`)}><i className="bi bi-plus-lg me-1"></i>Add Employment Record</button>}
          {!employment.length ? <Empty icon="bi-briefcase" text="No employment records." /> : (
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Designation</th><th>Department</th><th>Type</th><th>Joining</th><th>Confirmation</th><th>Exit</th><th>Reports To</th><th>Effective</th></tr></thead><tbody>
              {employment.map(e => <tr key={e.id}><td className="fw-semibold">{e.designation}</td><td>{e.department}</td><td><Badge tone={TYPE_TONE[e.type] || 'secondary'}>{e.type}</Badge></td><td>{fmtDate(e.joining_date)}</td><td>{fmtDate(e.confirmation_date)}</td><td>{fmtDate(e.exit_date)}</td><td>{e.reports_to || 'Ã¢â‚¬â€'}</td><td>{fmtDate(e.effective_from)} - {fmtDate(e.effective_to)}</td></tr>)}
            </tbody></table></div>
          )}
        </>
      )}

      {activeTab === 'qualifications' && (
        <>
          {manager && <button className="btn btn-sm btn-outline-primary mb-3" onClick={() => onNavigate(`/school/hr/staff/${staffId}/qualifications/new`)}><i className="bi bi-plus-lg me-1"></i>Add Qualification</button>}
          {!qualifications.length ? <Empty icon="bi-mortarboard" text="No qualifications recorded." /> : (
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Degree</th><th>Subject</th><th>Institute</th><th>Year</th><th>Teachable Subjects</th><th>Teachable Classes</th></tr></thead><tbody>
              {qualifications.map(q => <tr key={q.id}><td>{q.degree}</td><td>{q.subject || 'Ã¢â‚¬â€'}</td><td>{q.institute || 'Ã¢â‚¬â€'}</td><td>{q.year || 'Ã¢â‚¬â€'}</td><td>{(q.teachable_subjects || []).length}</td><td>{(q.teachable_classes || []).length}</td></tr>)}
            </tbody></table></div>
          )}
        </>
      )}

      {activeTab === 'documents' && (
        <>
          {manager && <button className="btn btn-sm btn-outline-primary mb-3" onClick={() => onNavigate(`/school/hr/staff/${staffId}/documents/new`)}><i className="bi bi-plus-lg me-1"></i>Upload Document</button>}
          {!documents.length ? <Empty icon="bi-file-earmark" text="No documents uploaded." /> : (
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Type</th><th>File</th><th>Expiry</th><th>Verified</th><th>Verified By</th><th>Verified At</th></tr></thead><tbody>
              {documents.map(d => <tr key={d.id}><td>{d.type}</td><td><a href={d.file_url} target="_blank" rel="noopener">{d.file_url}</a></td><td>{fmtDate(d.expiry_date)} {d.expiry_date && new Date(d.expiry_date) < new Date() ? <Badge tone="danger" className="ms-2">Expired</Badge> : ''}</td><td>{d.verified ? <Badge tone="success">Yes</Badge> : <Badge tone="secondary">No</Badge>}</td><td>{d.verified_by || 'Ã¢â‚¬â€'}</td><td>{fmtDate(d.verified_at)}</td></tr>)}
            </tbody></table></div>
          )}
        </>
      )}

      {activeTab === 'bank' && (
        <>
          {bank.length ? (
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Bank</th><th>Account</th><th>IFSC</th><th>Holder</th><th>Primary</th></tr></thead><tbody>
              {bank.map(b => <tr key={b.id}><td>{b.bank_name}</td><td>{b.account_number}</td><td>{b.ifsc_code}</td><td>{b.account_holder_name || 'Ã¢â‚¬â€'}</td><td>{b.is_primary ? <Badge tone="success">Primary</Badge> : <Badge tone="secondary">Secondary</Badge>}</td></tr>)}
            </tbody></table></div>
          ) : <Empty icon="bi-bank" text="No bank details on file." />}
        </>
      )}

      {activeTab === 'nominees' && (
        <>
          {!nominees.length ? <Empty icon="bi-people" text="No nominees recorded." /> : (
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Name</th><th>Relation</th><th>Share %</th><th>Phone</th></tr></thead><tbody>
              {nominees.map(n => <tr key={n.id}><td>{n.name}</td><td>{n.relation}</td><td>{n.share_percent}%</td><td>{n.phone || 'Ã¢â‚¬â€'}</td></tr>)}
            </tbody></table></div>
          )}
        </>
      )}

      {activeTab === 'emergency' && (
        <>
          {!emergency.length ? <Empty icon="bi-exclamation-triangle" text="No emergency contacts recorded." /> : (
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Name</th><th>Relation</th><th>Phone</th><th>Primary</th></tr></thead><tbody>
              {emergency.map(e => <tr key={e.id}><td>{e.name}</td><td>{e.relation}</td><td>{e.phone}</td><td>{e.is_primary ? <Badge tone="success">Yes</Badge> : <Badge tone="secondary">No</Badge>}</td></tr>)}
            </tbody></table></div>
          )}
        </>
      )}

      {['bank', 'nominees', 'emergency'].includes(activeTab) && !staff && <div className="text-center py-3 text-muted">Loading...</div>}
    </PageShell>
  );
}
