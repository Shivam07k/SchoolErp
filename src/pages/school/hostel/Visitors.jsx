import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';
import {
  PageShell, Loading, Empty, Badge, Tabs, Kpi, Modal, statusBadge,
  fmtDate, fmtDateTime, fmtTime, canHostelManage, VISIT_TONE, studentName,
} from './shared';

const TABS = [
  ['entries', 'Visitor Log', 'bi-person-badge'],
  ['master', 'Visitors', 'bi-people'],
  ['authorised', 'Authorised List', 'bi-person-check'],
  ['rules', 'Visit Rules', 'bi-sliders'],
  ['blacklist', 'Blacklist', 'bi-slash-circle'],
];

const today = () => new Date().toISOString().slice(0, 10);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const emptyVisitor = { name: '', phone: '', idType: 'Aadhaar', idNumber: '', relation: '', address: '' };
const emptyEntry = { studentId: '', visitorId: '', visitorName: '', visitorPhone: '', idNumber: '', purpose: 'visit', arrivalTime: '', overnight: false, itemsCarried: '', badgeNo: '' };

export default function HostelVisitors({ me, onNavigate }) {
  const manage = canHostelManage(me, 'hostel.visitor') || canHostelManage(me, 'hostel.manage');
  const [tab, setTab] = useState('entries');
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [authorised, setAuthorised] = useState([]);
  const [rules, setRules] = useState([]);
  const [blacklist, setBlacklist] = useState([]);
  const [openVisits, setOpenVisits] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [students, setStudents] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');

  const [visitorForm, setVisitorForm] = useState(emptyVisitor);
  const [entryForm, setEntryForm] = useState(emptyEntry);
  const [authForm, setAuthForm] = useState({ studentId: '', visitorId: '', relation: '', validTill: '' });
  const [ruleForm, setRuleForm] = useState({ hostelId: '', days: ['1', '2', '3', '4', '5'], startTime: '09:00', endTime: '18:00', maxDurationMin: 60, maxVisitors: 3, idRequired: true, allowOvernight: false, notes: '' });
  const [blacklistForm, setBlacklistForm] = useState({ visitorId: '', reason: '', notes: '' });
  const [denyForm, setDenyForm] = useState({ entry: null, reason: '' });

  async function load() {
    setLoading(true);
    try {
      const [e, v, a, r, bl, ov, h, s] = await Promise.all([
        apiGet(`/school/hostel/visitor-entries${statusFilter ? `?status=${statusFilter}` : ''}`),
        apiGet('/school/hostel/visitors'),
        apiGet('/school/hostel/authorised-visitors'),
        apiGet('/school/hostel/visit-rules'),
        apiGet('/school/hostel/blacklist'),
        apiGet('/school/hostel/open-visits'),
        apiGet('/school/hostel/hostels'),
        apiGet('/school/hostel/students'),
      ]);
      if (e?.ok) setEntries(e.entries || []);
      if (v?.ok) setVisitors(v.visitors || []);
      if (a?.ok) setAuthorised(a.authorised || []);
      if (r?.ok) setRules(r.rules || []);
      if (bl?.ok) setBlacklist(bl.blacklist || []);
      if (ov?.ok) setOpenVisits(ov.visits || []);
      if (h?.ok) setHostels(h.hostels || []);
      if (s?.ok) setStudents(s.students || []);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [statusFilter]);

  const stats = useMemo(() => ({
    today: entries.filter((e) => String(e.created_at).slice(0, 10) === today()).length,
    pending: entries.filter((e) => e.status === 'pre_registered').length,
    inside: openVisits.length,
    blacklisted: blacklist.filter((b) => b.is_active).length,
  }), [entries, openVisits, blacklist]);

  async function saveVisitor(e) {
    e.preventDefault();
    try {
      const res = await apiPost('/school/hostel/visitors', visitorForm);
      if (res?.ok) { toast('Visitor registered', 'success'); setVisitorForm(emptyVisitor); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function removeVisitor(v) {
    if (!window.confirm(`Remove visitor ${v.name}?`)) return;
    try {
      const res = await apiDelete(`/school/hostel/visitors/${v.id}`);
      if (res?.ok) { toast('Visitor removed', 'success'); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function createEntry(e) {
    e.preventDefault();
    try {
      const res = await apiPost('/school/hostel/visitor-entries', entryForm);
      if (res?.ok) {
        toast(res.needsApproval ? 'Visit pre-registered Ã¢â‚¬â€ awaiting approval' : 'Visit approved', 'success');
        setEntryForm({ ...emptyEntry, studentId: entryForm.studentId });
        load();
      } else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function entryAction(entry, action) {
    try {
      if (action === 'deny') { setDenyForm({ entry, reason: '' }); return; }
      const res = await apiPost(`/school/hostel/visitor-entries/${entry.id}/${action}`, {});
      if (res?.ok) { toast(`Visit ${action.replace('-', ' ')} recorded`, 'success'); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function submitDeny(e) {
    e.preventDefault();
    try {
      const res = await apiPost(`/school/hostel/visitor-entries/${denyForm.entry.id}/deny`, { reason: denyForm.reason });
      if (res?.ok) { toast('Visit denied', 'success'); setDenyForm({ entry: null, reason: '' }); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function saveAuthorised(e) {
    e.preventDefault();
    try {
      const res = await apiPost('/school/hostel/authorised-visitors', authForm);
      if (res?.ok) { toast('Visitor authorised', 'success'); setAuthForm({ studentId: '', visitorId: '', relation: '', validTill: '' }); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function removeAuthorised(a) {
    try {
      const res = await apiDelete(`/school/hostel/authorised-visitors/${a.id}`);
      if (res?.ok) { toast('Authorisation removed', 'success'); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function saveRule(e) {
    e.preventDefault();
    try {
      const res = await apiPost('/school/hostel/visit-rules', ruleForm);
      if (res?.ok) { toast('Visit rule saved', 'success'); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function saveBlacklist(e) {
    e.preventDefault();
    try {
      const res = await apiPost('/school/hostel/blacklist', blacklistForm);
      if (res?.ok) { toast('Visitor blacklisted', 'success'); setBlacklistForm({ visitorId: '', reason: '', notes: '' }); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function liftBlacklist(row) {
    const notes = window.prompt('Reason for lifting the blacklist entry') || '';
    if (!notes) return;
    try {
      const res = await apiPut(`/school/hostel/blacklist/${row.id}`, { isActive: false, notes });
      if (res?.ok) { toast('Blacklist lifted', 'success'); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  function toggleRuleDay(day) {
    setRuleForm((f) => ({ ...f, days: f.days.includes(day) ? f.days.filter((d) => d !== day) : [...f.days, day] }));
  }

  function editRule(rule) {
    setRuleForm({
      hostelId: String(rule.hostel_id),
      days: (rule.days || []).map(String),
      startTime: fmtTime(rule.start_time),
      endTime: fmtTime(rule.end_time),
      maxDurationMin: rule.max_duration_min,
      maxVisitors: rule.max_visitors,
      idRequired: rule.id_required,
      allowOvernight: rule.allow_overnight,
      notes: rule.notes || '',
    });
  }

  if (loading) return <Loading />;

  return (
    <PageShell title="Hostel Visitors" icon="bi-person-badge" subtitle="Visitor authorisation, gate checks and blacklist" onNavigate={onNavigate}>
      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3"><Kpi label="Visits today" value={stats.today} icon="bi-calendar-day" /></div>
        <div className="col-6 col-md-3"><Kpi label="Awaiting approval" value={stats.pending} icon="bi-hourglass" tone="warning" /></div>
        <div className="col-6 col-md-3"><Kpi label="Currently inside" value={stats.inside} icon="bi-person-check" tone="info" /></div>
        <div className="col-6 col-md-3"><Kpi label="Blacklisted" value={stats.blacklisted} icon="bi-slash-circle" tone="danger" /></div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'entries' && (
        <div className="row g-3">
          {manage && (
            <div className="col-xl-4">
              <div className="card mb-3"><div className="card-body">
                <h6>Log a Visit</h6>
                <form onSubmit={createEntry} className="row g-2">
                  <div className="col-12"><select className="form-select form-select-sm" value={entryForm.studentId} onChange={(e) => setEntryForm({ ...entryForm, studentId: e.target.value })} required><option value="">Student</option>{students.filter((s) => s.allocation_id).map((s) => <option key={s.id} value={s.id}>{s.admission_no} Ã‚Â· {s.first_name} {s.last_name}</option>)}</select></div>
                  <div className="col-12"><select className="form-select form-select-sm" value={entryForm.visitorId} onChange={(e) => setEntryForm({ ...entryForm, visitorId: e.target.value })}><option value="">New / unregistered visitor</option>{visitors.map((v) => <option key={v.id} value={v.id}>{v.name}{v.relation ? ` (${v.relation})` : ''}</option>)}</select></div>
                  {!entryForm.visitorId && (
                    <>
                      <div className="col-6"><input className="form-control form-control-sm" placeholder="Visitor name" value={entryForm.visitorName} onChange={(e) => setEntryForm({ ...entryForm, visitorName: e.target.value })} /></div>
                      <div className="col-6"><input className="form-control form-control-sm" placeholder="Phone" value={entryForm.visitorPhone} onChange={(e) => setEntryForm({ ...entryForm, visitorPhone: e.target.value })} /></div>
                    </>
                  )}
                  <div className="col-6"><input className="form-control form-control-sm" placeholder="ID number" value={entryForm.idNumber} onChange={(e) => setEntryForm({ ...entryForm, idNumber: e.target.value })} /></div>
                  <div className="col-6"><input type="time" className="form-control form-control-sm" value={entryForm.arrivalTime} onChange={(e) => setEntryForm({ ...entryForm, arrivalTime: e.target.value })} /></div>
                  <div className="col-12"><input className="form-control form-control-sm" placeholder="Items carried (optional)" value={entryForm.itemsCarried} onChange={(e) => setEntryForm({ ...entryForm, itemsCarried: e.target.value })} /></div>
                  <div className="col-12 form-check ms-1"><input className="form-check-input" type="checkbox" id="overnight" checked={entryForm.overnight} onChange={(e) => setEntryForm({ ...entryForm, overnight: e.target.checked })} /><label className="form-check-label small" htmlFor="overnight">Overnight stay</label></div>
                  <div className="col-12"><button className="btn btn-sm btn-primary w-100">Register Visit</button></div>
                </form>
                <div className="small text-muted mt-2">Unlisted or out-of-hours visitors require warden approval. Blacklisted visitors are blocked automatically.</div>
              </div></div>
            </div>
          )}

          <div className={manage ? 'col-xl-8' : 'col-12'}>
            <div className="card mb-3"><div className="card-body">
              <h6>Currently Inside ({openVisits.length})</h6>
              {openVisits.length === 0 && <div className="text-muted small">No open visits</div>}
              <div className="d-flex flex-wrap gap-2">
                {openVisits.map((v) => (
                  <div key={v.id} className="border rounded p-2 small">
                    <div className="fw-semibold">{v.visitor_name} Ã¢â€ â€™ {studentName(v)}</div>
                    <div className="text-muted">Badge {v.badge_no || 'Ã¢â‚¬â€'} Ã‚Â· in {fmtTime(v.in_time)}</div>
                    {manage && <button className="btn btn-sm btn-outline-success mt-1 py-0" onClick={() => entryAction(v, 'check-out')}>Check out</button>}
                  </div>
                ))}
              </div>
            </div></div>

            <div className="card"><div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="mb-0">Visitor Log</h6>
                <select className="form-select form-select-sm w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">All</option><option value="pre_registered">Pre-registered</option><option value="approved">Approved</option><option value="checked_in">Checked in</option><option value="checked_out">Checked out</option><option value="denied">Denied</option>
                </select>
              </div>
              <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Visitor</th><th>Student</th><th>When</th><th>Status</th><th></th></tr></thead><tbody>
                {entries.length === 0 && <tr><td colSpan="5"><Empty icon="bi-person-badge" text="No visits recorded" /></td></tr>}
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td><div className="fw-semibold">{e.visitor_name}</div><div className="small text-muted">{e.phone || 'Ã¢â‚¬â€'}{e.badge_no ? ` Ã‚Â· Badge ${e.badge_no}` : ''}</div></td>
                    <td><div>{studentName(e)}</div><div className="small text-muted">{e.admission_no}</div></td>
                    <td className="small">{fmtDate(e.created_at)}<div className="text-muted">{fmtTime(e.in_time)} Ã¢â€ â€™ {fmtTime(e.out_time)}</div></td>
                    <td>{statusBadge(VISIT_TONE, e.status)}</td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        {manage && e.status === 'pre_registered' && <button className="btn btn-outline-success" onClick={() => entryAction(e, 'approve')}>Approve</button>}
                        {manage && ['pre_registered', 'approved'].includes(e.status) && <button className="btn btn-outline-primary" onClick={() => entryAction(e, 'check-in')}>Check in</button>}
                        {manage && e.status === 'checked_in' && <button className="btn btn-outline-success" onClick={() => entryAction(e, 'check-out')}>Check out</button>}
                        {manage && ['pre_registered', 'approved'].includes(e.status) && <button className="btn btn-outline-danger" onClick={() => entryAction(e, 'deny')}>Deny</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody></table></div>
            </div></div>
          </div>
        </div>
      )}

      {tab === 'master' && (
        <div className="row g-3">
          {manage && (
            <div className="col-xl-4"><div className="card"><div className="card-body">
              <h6>Register Visitor</h6>
              <form onSubmit={saveVisitor} className="row g-2">
                <div className="col-12"><input className="form-control form-control-sm" placeholder="Full name" value={visitorForm.name} onChange={(e) => setVisitorForm({ ...visitorForm, name: e.target.value })} required /></div>
                <div className="col-6"><input className="form-control form-control-sm" placeholder="Phone" value={visitorForm.phone} onChange={(e) => setVisitorForm({ ...visitorForm, phone: e.target.value })} /></div>
                <div className="col-6"><input className="form-control form-control-sm" placeholder="Relation" value={visitorForm.relation} onChange={(e) => setVisitorForm({ ...visitorForm, relation: e.target.value })} /></div>
                <div className="col-5"><select className="form-select form-select-sm" value={visitorForm.idType} onChange={(e) => setVisitorForm({ ...visitorForm, idType: e.target.value })}><option>Aadhaar</option><option>PAN</option><option>Driving Licence</option><option>Passport</option><option>Other</option></select></div>
                <div className="col-7"><input className="form-control form-control-sm" placeholder="ID number" value={visitorForm.idNumber} onChange={(e) => setVisitorForm({ ...visitorForm, idNumber: e.target.value })} /></div>
                <div className="col-12"><input className="form-control form-control-sm" placeholder="Address" value={visitorForm.address} onChange={(e) => setVisitorForm({ ...visitorForm, address: e.target.value })} /></div>
                <div className="col-12"><button className="btn btn-sm btn-primary w-100">Register Visitor</button></div>
              </form>
              <div className="small text-muted mt-2">ID numbers are masked in list views for privacy.</div>
            </div></div></div>
          )}
          <div className={manage ? 'col-xl-8' : 'col-12'}><div className="card"><div className="card-body">
            <h6>Registered Visitors</h6>
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Name</th><th>Phone</th><th>ID</th><th>Relation</th><th>Status</th><th></th></tr></thead><tbody>
              {visitors.length === 0 && <tr><td colSpan="6"><Empty icon="bi-people" text="No visitors registered" /></td></tr>}
              {visitors.map((v) => (
                <tr key={v.id}>
                  <td className="fw-semibold">{v.name}</td><td className="small">{v.phone || 'Ã¢â‚¬â€'}</td>
                  <td className="small">{v.id_type ? `${v.id_type}: ` : ''}{v.id_number || 'Ã¢â‚¬â€'}</td>
                  <td className="small">{v.relation || 'Ã¢â‚¬â€'}</td>
                  <td><Badge tone={v.is_active ? 'success' : 'secondary'}>{v.is_active ? 'active' : 'inactive'}</Badge></td>
                  <td className="text-end">
                    {manage && <button className="btn btn-sm btn-outline-warning me-1" onClick={() => setBlacklistForm({ visitorId: String(v.id), reason: '', notes: '' })}>Blacklist</button>}
                    {manage && <button className="btn btn-sm btn-outline-danger" onClick={() => removeVisitor(v)}><i className="bi bi-trash"></i></button>}
                  </td>
                </tr>
              ))}
            </tbody></table></div>
          </div></div></div>
        </div>
      )}

      {tab === 'authorised' && (
        <div className="row g-3">
          {manage && (
            <div className="col-xl-4"><div className="card"><div className="card-body">
              <h6>Authorise a Visitor</h6>
              <form onSubmit={saveAuthorised} className="row g-2">
                <div className="col-12"><select className="form-select form-select-sm" value={authForm.studentId} onChange={(e) => setAuthForm({ ...authForm, studentId: e.target.value })} required><option value="">Student</option>{students.filter((s) => s.allocation_id).map((s) => <option key={s.id} value={s.id}>{s.admission_no} Ã‚Â· {s.first_name} {s.last_name}</option>)}</select></div>
                <div className="col-12"><select className="form-select form-select-sm" value={authForm.visitorId} onChange={(e) => setAuthForm({ ...authForm, visitorId: e.target.value })} required><option value="">Visitor</option>{visitors.map((v) => <option key={v.id} value={v.id}>{v.name}{v.relation ? ` (${v.relation})` : ''}</option>)}</select></div>
                <div className="col-6"><input className="form-control form-control-sm" placeholder="Relation" value={authForm.relation} onChange={(e) => setAuthForm({ ...authForm, relation: e.target.value })} /></div>
                <div className="col-6"><input type="date" className="form-control form-control-sm" value={authForm.validTill} onChange={(e) => setAuthForm({ ...authForm, validTill: e.target.value })} title="Valid till" /></div>
                <div className="col-12"><button className="btn btn-sm btn-primary w-100">Add Authorisation</button></div>
              </form>
              <div className="small text-muted mt-2">Only authorised visitors can be checked in without warden approval.</div>
            </div></div></div>
          )}
          <div className={manage ? 'col-xl-8' : 'col-12'}><div className="card"><div className="card-body">
            <h6>Authorised Visitors</h6>
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Student</th><th>Visitor</th><th>Relation</th><th>Valid till</th><th></th></tr></thead><tbody>
              {authorised.length === 0 && <tr><td colSpan="5"><Empty icon="bi-person-check" text="No authorised visitors" /></td></tr>}
              {authorised.map((a) => (
                <tr key={a.id}>
                  <td><div className="fw-semibold">{studentName(a)}</div><div className="small text-muted">{a.admission_no}</div></td>
                  <td>{a.visitor_name}<div className="small text-muted">{a.phone || 'Ã¢â‚¬â€'}</div></td>
                  <td className="small">{a.relation || a.visitor_relation || 'Ã¢â‚¬â€'}</td>
                  <td className="small">{a.valid_till ? fmtDate(a.valid_till) : 'No expiry'}</td>
                  <td className="text-end">{manage && <button className="btn btn-sm btn-outline-danger" onClick={() => removeAuthorised(a)}>Remove</button>}</td>
                </tr>
              ))}
            </tbody></table></div>
          </div></div></div>
        </div>
      )}

      {tab === 'rules' && (
        <div className="row g-3">
          {manage && (
            <div className="col-xl-4"><div className="card"><div className="card-body">
              <h6>Visiting Policy</h6>
              <form onSubmit={saveRule} className="row g-2">
                <div className="col-12"><select className="form-select form-select-sm" value={ruleForm.hostelId} onChange={(e) => setRuleForm({ ...ruleForm, hostelId: e.target.value })} required><option value="">Hostel</option>{hostels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
                <div className="col-12">
                  <div className="small text-muted mb-1">Allowed days</div>
                  <div className="d-flex flex-wrap gap-1">
                    {DAYS.map((d, i) => (
                      <button type="button" key={d} className={`btn btn-sm ${ruleForm.days.includes(String(i)) ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => toggleRuleDay(String(i))}>{d}</button>
                    ))}
                  </div>
                </div>
                <div className="col-6"><label className="form-label small mb-0">Start</label><input type="time" className="form-control form-control-sm" value={ruleForm.startTime} onChange={(e) => setRuleForm({ ...ruleForm, startTime: e.target.value })} /></div>
                <div className="col-6"><label className="form-label small mb-0">End</label><input type="time" className="form-control form-control-sm" value={ruleForm.endTime} onChange={(e) => setRuleForm({ ...ruleForm, endTime: e.target.value })} /></div>
                <div className="col-6"><input type="number" min="5" className="form-control form-control-sm" placeholder="Max minutes" value={ruleForm.maxDurationMin} onChange={(e) => setRuleForm({ ...ruleForm, maxDurationMin: e.target.value })} /></div>
                <div className="col-6"><input type="number" min="1" className="form-control form-control-sm" placeholder="Max visitors" value={ruleForm.maxVisitors} onChange={(e) => setRuleForm({ ...ruleForm, maxVisitors: e.target.value })} /></div>
                <div className="col-6 form-check ms-1"><input className="form-check-input" type="checkbox" id="idReq" checked={ruleForm.idRequired} onChange={(e) => setRuleForm({ ...ruleForm, idRequired: e.target.checked })} /><label className="form-check-label small" htmlFor="idReq">ID required</label></div>
                <div className="col-6 form-check ms-1"><input className="form-check-input" type="checkbox" id="allowOver" checked={ruleForm.allowOvernight} onChange={(e) => setRuleForm({ ...ruleForm, allowOvernight: e.target.checked })} /><label className="form-check-label small" htmlFor="allowOver">Overnight</label></div>
                <div className="col-12"><button className="btn btn-sm btn-primary w-100">Save Policy</button></div>
              </form>
            </div></div></div>
          )}
          <div className={manage ? 'col-xl-8' : 'col-12'}><div className="card"><div className="card-body">
            <h6>Hostel Visit Rules</h6>
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Hostel</th><th>Days</th><th>Hours</th><th>Limits</th><th>Overnight</th><th></th></tr></thead><tbody>
              {rules.length === 0 && <tr><td colSpan="6"><Empty icon="bi-sliders" text="No visiting policy configured" /></td></tr>}
              {rules.map((r) => (
                <tr key={r.id}>
                  <td className="fw-semibold">{r.hostel_name}</td>
                  <td className="small">{(r.days || []).map((d) => DAYS[Number(d)]).join(', ') || 'Ã¢â‚¬â€'}</td>
                  <td className="small">{fmtTime(r.start_time)} Ã¢â‚¬â€œ {fmtTime(r.end_time)}</td>
                  <td className="small">{r.max_duration_min} min Ã‚Â· max {r.max_visitors}</td>
                  <td><Badge tone={r.allow_overnight ? 'warning' : 'secondary'}>{r.allow_overnight ? 'allowed' : 'not allowed'}</Badge></td>
                  <td className="text-end">{manage && <button className="btn btn-sm btn-outline-primary" onClick={() => editRule(r)}>Edit</button>}</td>
                </tr>
              ))}
            </tbody></table></div>
          </div></div></div>
        </div>
      )}

      {tab === 'blacklist' && (
        <div className="row g-3">
          {manage && (
            <div className="col-xl-4"><div className="card"><div className="card-body">
              <h6>Blacklist a Visitor</h6>
              <form onSubmit={saveBlacklist} className="row g-2">
                <div className="col-12"><select className="form-select form-select-sm" value={blacklistForm.visitorId} onChange={(e) => setBlacklistForm({ ...blacklistForm, visitorId: e.target.value })} required><option value="">Visitor</option>{visitors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
                <div className="col-12"><input className="form-control form-control-sm" placeholder="Reason" value={blacklistForm.reason} onChange={(e) => setBlacklistForm({ ...blacklistForm, reason: e.target.value })} required /></div>
                <div className="col-12"><textarea className="form-control form-control-sm" rows="2" placeholder="Notes" value={blacklistForm.notes} onChange={(e) => setBlacklistForm({ ...blacklistForm, notes: e.target.value })} /></div>
                <div className="col-12"><button className="btn btn-sm btn-danger w-100">Blacklist Visitor</button></div>
              </form>
            </div></div></div>
          )}
          <div className={manage ? 'col-xl-8' : 'col-12'}><div className="card"><div className="card-body">
            <h6>Blacklist</h6>
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Visitor</th><th>Reason</th><th>Since</th><th>Status</th><th></th></tr></thead><tbody>
              {blacklist.length === 0 && <tr><td colSpan="5"><Empty icon="bi-slash-circle" text="Nobody is blacklisted" /></td></tr>}
              {blacklist.map((b) => (
                <tr key={b.id}>
                  <td><div className="fw-semibold">{b.visitor_name}</div><div className="small text-muted">{b.phone || 'Ã¢â‚¬â€'}</div></td>
                  <td className="small">{b.reason}</td>
                  <td className="small">{fmtDate(b.blacklisted_at)}</td>
                  <td><Badge tone={b.is_active ? 'danger' : 'secondary'}>{b.is_active ? 'active' : 'lifted'}</Badge></td>
                  <td className="text-end">{manage && b.is_active && <button className="btn btn-sm btn-outline-success" onClick={() => liftBlacklist(b)}>Lift</button>}</td>
                </tr>
              ))}
            </tbody></table></div>
          </div></div></div>
        </div>
      )}

      {denyForm.entry && (
        <Modal title={`Deny visit Ã‚Â· ${denyForm.entry.visitor_name}`} onClose={() => setDenyForm({ entry: null, reason: '' })} size="md">
          <form onSubmit={submitDeny}>
            <textarea className="form-control form-control-sm mb-2" rows="3" placeholder="Reason for denial (required)" value={denyForm.reason} onChange={(e) => setDenyForm({ ...denyForm, reason: e.target.value })} required />
            <div className="text-end"><button className="btn btn-sm btn-danger">Deny visit</button></div>
          </form>
        </Modal>
      )}
    </PageShell>
  );
}

