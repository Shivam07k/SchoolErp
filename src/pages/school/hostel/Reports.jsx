import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPut } from '../../../api';
import { toast } from '../../../toast';
import {
  PageShell, Loading, Empty, Badge, Tabs, Kpi, statusBadge,
  fmtDate, money, canHostelManage, downloadCsv, studentName, ROLLCALL_STATUS_TONE,
} from './shared';

const TABS = [
  ['occupancy', 'Occupancy', 'bi-building'],
  ['attendance', 'Attendance', 'bi-calendar-check'],
  ['visitors', 'Visitors', 'bi-person-badge'],
  ['fees', 'Fees', 'bi-cash-coin'],
  ['audit', 'Audit', 'bi-shield-lock'],
  ['settings', 'Settings', 'bi-gear'],
];

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

export default function HostelReports({ me, onNavigate }) {
  const manage = canHostelManage(me, 'hostel.manage');
  const [tab, setTab] = useState('occupancy');
  const [loading, setLoading] = useState(true);
  const [occupancy, setOccupancy] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [visitors, setVisitors] = useState(null);
  const [fees, setFees] = useState(null);
  const [audit, setAudit] = useState([]);
  const [settings, setSettings] = useState(null);
  const [range, setRange] = useState({ from: daysAgo(30), to: today() });

  async function loadOccupancy() {
    setLoading(true);
    try {
      const res = await apiGet('/school/hostel/reports/occupancy');
      if (res?.ok) setOccupancy(res);
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  async function loadAttendance() {
    setLoading(true);
    try {
      const res = await apiGet(`/school/hostel/reports/attendance?from=${range.from}&to=${range.to}`);
      if (res?.ok) setAttendance(res.attendance || []);
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  async function loadVisitors() {
    setLoading(true);
    try {
      const res = await apiGet(`/school/hostel/reports/visitors?from=${range.from}&to=${range.to}`);
      if (res?.ok) setVisitors(res);
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  async function loadFees() {
    setLoading(true);
    try {
      const res = await apiGet('/school/hostel/reports/fees');
      if (res?.ok) setFees(res);
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  async function loadAudit() {
    setLoading(true);
    try {
      const res = await apiGet(`/school/hostel/reports/audit?from=${range.from}&to=${range.to}`);
      if (res?.ok) setAudit(res.audit || []);
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  async function loadSettings() {
    setLoading(true);
    try {
      const res = await apiGet('/school/hostel/settings');
      if (res?.ok) setSettings(res.settings || {});
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (tab === 'occupancy') loadOccupancy();
    else if (tab === 'attendance') loadAttendance();
    else if (tab === 'visitors') loadVisitors();
    else if (tab === 'fees') loadFees();
    else if (tab === 'audit') loadAudit();
    else if (tab === 'settings') loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const occupancyTotals = useMemo(() => {
    const rows = occupancy?.byHostel || [];
    return {
      beds: rows.reduce((n, r) => n + Number(r.beds || 0), 0),
      residents: rows.reduce((n, r) => n + Number(r.residents || 0), 0),
      rooms: rows.reduce((n, r) => n + Number(r.rooms || 0), 0),
      vacant: (occupancy?.vacancy || []).length,
    };
  }, [occupancy]);

  async function saveSettings(e) {
    e.preventDefault();
    try {
      const res = await apiPut('/school/hostel/settings', { settings });
      if (res?.ok) { toast('Settings saved', 'success'); setSettings(res.settings || settings); }
      else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  function exportOccupancy() {
    downloadCsv('hostel-occupancy.csv', [
      { label: 'Hostel', key: 'hostel_name' }, { label: 'Type', key: 'type' },
      { label: 'Rooms', key: 'rooms' }, { label: 'Beds', key: 'beds' }, { label: 'Residents', key: 'residents' },
    ], occupancy?.byHostel || []);
  }
  function exportAttendance() {
    downloadCsv('hostel-attendance.csv', [
      { label: 'Date', value: (r) => String(r.call_date || '').slice(0, 10) }, { label: 'Session', key: 'session' },
      { label: 'Hostel', key: 'hostel_name' }, { label: 'Status', key: 'status' },
      { label: 'Total', key: 'total' }, { label: 'Present', key: 'present' }, { label: 'Absent', key: 'absent' },
      { label: 'On leave', key: 'on_leave' }, { label: 'Sick bay', key: 'sick_bay' }, { label: 'Late', key: 'late' },
    ], attendance);
  }
  function exportVisitors() {
    downloadCsv('hostel-visitors.csv', [
      { label: 'Date', value: (r) => String(r.created_at || '').slice(0, 10) }, { label: 'Visitor', key: 'visitor_name' },
      { label: 'Student', value: (r) => `${r.first_name || ''} ${r.last_name || ''}`.trim() },
      { label: 'Admission no', key: 'admission_no' }, { label: 'Status', key: 'status' },
    ], visitors?.entries || []);
  }
  function exportFees() {
    downloadCsv('hostel-bills.csv', [
      { label: 'Period start', value: (r) => String(r.period_start || '').slice(0, 10) },
      { label: 'Period end', value: (r) => String(r.period_end || '').slice(0, 10) },
      { label: 'Student', value: (r) => `${r.first_name || ''} ${r.last_name || ''}`.trim() },
      { label: 'Admission no', key: 'admission_no' }, { label: 'Rent', key: 'rent_amount' },
      { label: 'Mess', key: 'mess_amount' }, { label: 'Rebate', key: 'rebate_amount' },
      { label: 'Total', key: 'total_amount' }, { label: 'Status', key: 'status' }, { label: 'Invoice', key: 'invoice_number' },
    ], fees?.bills || []);
  }
  function exportAudit() {
    downloadCsv('hostel-audit.csv', [
      { label: 'When', key: 'created_at' }, { label: 'User', key: 'user_id' }, { label: 'Action', key: 'action' },
      { label: 'Entity', key: 'entity' }, { label: 'Entity id', key: 'entity_id' },
    ], audit);
  }

  return (
    <PageShell title="Hostel Reports" icon="bi-graph-up" subtitle="Occupancy, attendance, visitors, fees and audit" onNavigate={onNavigate}>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {(tab === 'attendance' || tab === 'visitors' || tab === 'audit') && (
        <div className="d-flex flex-wrap gap-2 align-items-end mb-3">
          <div><label className="form-label small mb-0">From</label><input type="date" className="form-control form-control-sm" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></div>
          <div><label className="form-label small mb-0">To</label><input type="date" className="form-control form-control-sm" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
          <button className="btn btn-sm btn-primary" onClick={() => (tab === 'attendance' ? loadAttendance() : tab === 'visitors' ? loadVisitors() : loadAudit())}>Apply</button>
        </div>
      )}

      {loading && <Loading />}

      {!loading && tab === 'occupancy' && occupancy && (
        <>
          <div className="row g-2 mb-3">
            <div className="col-6 col-md-3"><Kpi label="Rooms" value={occupancyTotals.rooms} icon="bi-door-open" /></div>
            <div className="col-6 col-md-3"><Kpi label="Beds" value={occupancyTotals.beds} icon="bi-layout-three-columns" tone="secondary" /></div>
            <div className="col-6 col-md-3"><Kpi label="Residents" value={occupancyTotals.residents} icon="bi-person-check" tone="info" /></div>
            <div className="col-6 col-md-3"><Kpi label="Vacant beds" value={occupancyTotals.vacant} icon="bi-person-dash" tone="success" /></div>
          </div>
          <div className="card mb-3"><div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-2"><h6 className="mb-0">Occupancy by Hostel</h6><button className="btn btn-sm btn-outline-secondary" onClick={exportOccupancy}><i className="bi bi-download me-1"></i>CSV</button></div>
            <div className="table-responsive"><table className="table table-sm"><thead><tr><th>Hostel</th><th>Type</th><th>Rooms</th><th>Beds</th><th>Residents</th><th>Occupancy</th></tr></thead><tbody>
              {(occupancy.byHostel || []).length === 0 && <tr><td colSpan="6"><Empty icon="bi-building" text="No hostels" /></td></tr>}
              {(occupancy.byHostel || []).map((r) => (
                <tr key={r.id}>
                  <td className="fw-semibold">{r.hostel_name}</td><td className="text-capitalize">{r.type}</td>
                  <td>{r.rooms}</td><td>{r.beds}</td><td>{r.residents}</td>
                  <td>{r.beds ? `${Math.round((Number(r.residents) / Number(r.beds)) * 100)}%` : 'Ã¢â‚¬â€'}</td>
                </tr>
              ))}
            </tbody></table></div>
          </div></div>
          <div className="row g-3">
            <div className="col-lg-6"><div className="card"><div className="card-body">
              <h6>Vacant Beds</h6>
              <div className="table-responsive" style={{ maxHeight: 320, overflowY: 'auto' }}><table className="table table-sm"><thead><tr><th>Hostel</th><th>Room</th><th>Bed</th><th>Type</th></tr></thead><tbody>
                {(occupancy.vacancy || []).length === 0 && <tr><td colSpan="4"><Empty icon="bi-person-dash" text="No vacant beds" /></td></tr>}
                {(occupancy.vacancy || []).map((v, i) => <tr key={`${v.room_number}-${v.bed_no}-${i}`}><td>{v.hostel_name}</td><td>{v.room_number}</td><td>{v.bed_no}</td><td className="text-capitalize">{v.room_type}</td></tr>)}
              </tbody></table></div>
            </div></div></div>
            <div className="col-lg-6"><div className="card"><div className="card-body">
              <h6>Waiting List</h6>
              <div className="table-responsive" style={{ maxHeight: 320, overflowY: 'auto' }}><table className="table table-sm"><thead><tr><th>Student</th><th>Class</th><th>Priority</th></tr></thead><tbody>
                {(occupancy.waiting || []).length === 0 && <tr><td colSpan="3"><Empty icon="bi-hourglass" text="No waitlist" /></td></tr>}
                {(occupancy.waiting || []).map((w) => <tr key={w.id}><td>{studentName(w)}<div className="small text-muted">{w.admission_no}</div></td><td>{w.class_name || 'Ã¢â‚¬â€'}</td><td>{w.priority}</td></tr>)}
              </tbody></table></div>
            </div></div></div>
          </div>
        </>
      )}

      {!loading && tab === 'attendance' && (
        <div className="card"><div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-2"><h6 className="mb-0">Roll Call Summary</h6><button className="btn btn-sm btn-outline-secondary" onClick={exportAttendance}><i className="bi bi-download me-1"></i>CSV</button></div>
          <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Date</th><th>Session</th><th>Hostel</th><th>Status</th><th>Total</th><th>Present</th><th>Absent</th><th>On leave</th><th>Sick bay</th><th>Late</th></tr></thead><tbody>
            {attendance.length === 0 && <tr><td colSpan="10"><Empty icon="bi-calendar-check" text="No roll calls in this period" /></td></tr>}
            {attendance.map((r, i) => (
              <tr key={`${r.call_date}-${r.session}-${r.hostel_name}-${i}`}>
                <td className="small">{fmtDate(r.call_date)}</td><td className="text-capitalize">{r.session}</td>
                <td>{r.hostel_name}</td><td><Badge tone={r.status === 'submitted' || r.status === 'locked' ? 'success' : 'warning'}>{r.status}</Badge></td>
                <td>{r.total}</td><td>{r.present}</td><td className={Number(r.absent) ? 'text-danger fw-semibold' : ''}>{r.absent}</td>
                <td>{r.on_leave}</td><td>{r.sick_bay}</td><td>{r.late}</td>
              </tr>
            ))}
          </tbody></table></div>
        </div></div>
      )}

      {!loading && tab === 'visitors' && visitors && (
        <div className="row g-3">
          <div className="col-lg-8"><div className="card"><div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-2"><h6 className="mb-0">Visits in Period</h6><button className="btn btn-sm btn-outline-secondary" onClick={exportVisitors}><i className="bi bi-download me-1"></i>CSV</button></div>
            <div className="table-responsive"><table className="table table-sm"><thead><tr><th>When</th><th>Visitor</th><th>Student</th><th>Status</th></tr></thead><tbody>
              {(visitors.entries || []).length === 0 && <tr><td colSpan="4"><Empty icon="bi-person-badge" text="No visits" /></td></tr>}
              {(visitors.entries || []).map((v) => (
                <tr key={v.id}>
                  <td className="small">{fmtDate(v.created_at)}</td><td>{v.visitor_name}<div className="small text-muted">{v.phone || 'Ã¢â‚¬â€'}</div></td>
                  <td>{studentName(v)}<div className="small text-muted">{v.admission_no}</div></td>
                  <td><Badge tone={v.status === 'checked_out' ? 'success' : v.status === 'checked_in' ? 'primary' : v.status === 'denied' ? 'danger' : 'warning'}>{v.status}</Badge></td>
                </tr>
              ))}
            </tbody></table></div>
          </div></div></div>
          <div className="col-lg-4">
            <div className="card mb-3"><div className="card-body">
              <h6>Currently Inside ({(visitors.open || []).length})</h6>
              {(visitors.open || []).length === 0 && <div className="small text-muted">None</div>}
              {(visitors.open || []).map((v) => <div key={v.id} className="small mb-1">{v.visitor_name} Ã¢â€ â€™ {studentName(v)}</div>)}
            </div></div>
            <div className="card"><div className="card-body">
              <h6>Active Blacklist ({(visitors.blacklist || []).length})</h6>
              {(visitors.blacklist || []).length === 0 && <div className="small text-muted">None</div>}
              {(visitors.blacklist || []).map((b) => <div key={b.id} className="small mb-1">{b.visitor_name}<div className="text-muted">{b.reason}</div></div>)}
            </div></div>
          </div>
        </div>
      )}

      {!loading && tab === 'fees' && fees && (
        <>
          <div className="row g-2 mb-3">
            <div className="col-6 col-md-3"><Kpi label="Billed" value={money(fees.summary?.billed)} icon="bi-receipt" /></div>
            <div className="col-6 col-md-3"><Kpi label="Deposits held" value={money(fees.summary?.deposits_held)} icon="bi-shield-check" tone="info" /></div>
            <div className="col-6 col-md-3"><Kpi label="Rebates" value={money(fees.summary?.rebates)} icon="bi-percent" tone="warning" /></div>
            <div className="col-6 col-md-3"><Kpi label="Outstanding invoices" value={(fees.dues || []).length} icon="bi-exclamation-circle" tone="danger" /></div>
          </div>
          <div className="card mb-3"><div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-2"><h6 className="mb-0">Bills</h6><button className="btn btn-sm btn-outline-secondary" onClick={exportFees}><i className="bi bi-download me-1"></i>CSV</button></div>
            <div className="table-responsive"><table className="table table-sm"><thead><tr><th>Period</th><th>Student</th><th>Rent</th><th>Mess</th><th>Rebate</th><th>Total</th><th>Status</th></tr></thead><tbody>
              {(fees.bills || []).length === 0 && <tr><td colSpan="7"><Empty icon="bi-receipt" text="No bills" /></td></tr>}
              {(fees.bills || []).map((b) => (
                <tr key={b.id}>
                  <td className="small">{fmtDate(b.period_start)} Ã¢â‚¬â€œ {fmtDate(b.period_end)}</td>
                  <td>{studentName(b)}<div className="small text-muted">{b.admission_no}</div></td>
                  <td>{money(b.rent_amount)}</td><td>{money(b.mess_amount)}</td><td>{money(b.rebate_amount)}</td>
                  <td className="fw-semibold">{money(b.total_amount)}</td>
                  <td><Badge tone={b.status === 'issued' ? 'info' : 'secondary'}>{b.status}</Badge></td>
                </tr>
              ))}
            </tbody></table></div>
          </div></div>
          <div className="card"><div className="card-body">
            <h6>Outstanding Hostel Invoices</h6>
            <div className="table-responsive"><table className="table table-sm"><thead><tr><th>Invoice</th><th>Student</th><th>Due</th><th>Total</th><th>Balance</th></tr></thead><tbody>
              {(fees.dues || []).length === 0 && <tr><td colSpan="5"><Empty icon="bi-check-circle" text="No outstanding dues" /></td></tr>}
              {(fees.dues || []).map((d) => <tr key={d.id}><td className="small">{d.number}</td><td>{studentName(d)}<div className="small text-muted">{d.admission_no}</div></td><td className="small">{fmtDate(d.due_date)}</td><td>{money(d.total_amount)}</td><td className="text-danger fw-semibold">{money(d.balance)}</td></tr>)}
            </tbody></table></div>
          </div></div>
        </>
      )}

      {!loading && tab === 'audit' && (
        <div className="card"><div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-2"><h6 className="mb-0">Hostel Audit Trail</h6><button className="btn btn-sm btn-outline-secondary" onClick={exportAudit}><i className="bi bi-download me-1"></i>CSV</button></div>
          <div className="table-responsive"><table className="table table-sm"><thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Entity id</th></tr></thead><tbody>
            {audit.length === 0 && <tr><td colSpan="5"><Empty icon="bi-shield-lock" text="No audit entries in this period" /></td></tr>}
            {audit.map((a) => (
              <tr key={a.id}>
                <td className="small">{fmtDate(a.created_at)}</td><td className="small">{a.user_id || 'Ã¢â‚¬â€'}</td>
                <td className="small fw-semibold">{a.action}</td><td className="small">{a.entity}</td><td className="small">{a.entity_id || 'Ã¢â‚¬â€'}</td>
              </tr>
            ))}
          </tbody></table></div>
        </div></div>
      )}

      {!loading && tab === 'settings' && settings && (
        <div className="card"><div className="card-body">
          <h6>Hostel Settings</h6>
          <form onSubmit={saveSettings} className="row g-3">
            <div className="col-md-6">
              <div className="form-check form-switch"><input className="form-check-input" type="checkbox" id="sConsent" checked={Boolean(settings.require_guardian_consent)} onChange={(e) => setSettings({ ...settings, require_guardian_consent: e.target.checked })} /><label className="form-check-label" htmlFor="sConsent">Require guardian consent before check-in</label></div>
              <div className="form-check form-switch"><input className="form-check-input" type="checkbox" id="sDeposit" checked={Boolean(settings.require_deposit)} onChange={(e) => setSettings({ ...settings, require_deposit: e.target.checked })} /><label className="form-check-label" htmlFor="sDeposit">Require deposit before check-in</label></div>
              <div className="form-check form-switch"><input className="form-check-input" type="checkbox" id="sOtp" checked={Boolean(settings.leave_require_guardian_otp)} onChange={(e) => setSettings({ ...settings, leave_require_guardian_otp: e.target.checked })} /><label className="form-check-label" htmlFor="sOtp">Require guardian OTP for leave</label></div>
              <div className="form-check form-switch"><input className="form-check-input" type="checkbox" id="sVisitor" checked={Boolean(settings.visitor_require_approval)} onChange={(e) => setSettings({ ...settings, visitor_require_approval: e.target.checked })} /><label className="form-check-label" htmlFor="sVisitor">Require approval for all visitors</label></div>
              <div className="form-check form-switch"><input className="form-check-input" type="checkbox" id="sOvernight" checked={Boolean(settings.allow_overnight_guests)} onChange={(e) => setSettings({ ...settings, allow_overnight_guests: e.target.checked })} /><label className="form-check-label" htmlFor="sOvernight">Allow overnight guests</label></div>
            </div>
            <div className="col-md-6">
              <label className="form-label small">Deposit amount (Ã¢â€šÂ¹)</label>
              <input type="number" min="0" className="form-control form-control-sm mb-2" value={settings.deposit_amount ?? 0} onChange={(e) => setSettings({ ...settings, deposit_amount: Number(e.target.value) })} />
              <label className="form-label small">Mid-month billing rule</label>
              <select className="form-select form-select-sm mb-2" value={settings.mid_month_rule || 'daily'} onChange={(e) => setSettings({ ...settings, mid_month_rule: e.target.value })}>
                <option value="daily">Daily pro-rata</option><option value="full_month">Full month</option><option value="half_month">Half month</option>
              </select>
              <label className="form-label small">Roll call grace (minutes)</label>
              <input type="number" min="0" className="form-control form-control-sm mb-2" value={settings.rollcall_grace_minutes ?? 15} onChange={(e) => setSettings({ ...settings, rollcall_grace_minutes: Number(e.target.value) })} />
              <label className="form-label small">Gate log retention (days)</label>
              <input type="number" min="30" className="form-control form-control-sm mb-2" value={settings.retention_gate_days ?? 365} onChange={(e) => setSettings({ ...settings, retention_gate_days: Number(e.target.value) })} />
              <label className="form-label small">Visitor log retention (days)</label>
              <input type="number" min="30" className="form-control form-control-sm" value={settings.retention_visitor_days ?? 365} onChange={(e) => setSettings({ ...settings, retention_visitor_days: Number(e.target.value) })} />
            </div>
            {manage ? <div className="col-12"><button className="btn btn-sm btn-primary">Save Settings</button></div>
              : <div className="col-12"><div className="alert alert-info py-2 small mb-0">You have read-only access to hostel settings.</div></div>}
          </form>
        </div></div>
      )}
    </PageShell>
  );
}

