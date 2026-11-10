import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../../api';
import { toast } from '../../../toast';
import {
  PageShell, Loading, Empty, Badge, Tabs, Kpi, statusBadge,
  fmtDate, money, canHostelManage, monthStart, monthEnd, studentName,
} from './shared';

const TABS = [
  ['billing', 'Billing', 'bi-receipt'],
  ['plans', 'Fee Plans', 'bi-sliders'],
  ['rebates', 'Rebates', 'bi-percent'],
  ['deposits', 'Deposits & Damage', 'bi-shield-check'],
  ['dues', 'Dues', 'bi-exclamation-circle'],
];

const BILL_TONE = { issued: 'info', cancelled: 'secondary', paid: 'success' };

export default function HostelFees({ me, onNavigate }) {
  const manage = canHostelManage(me, 'hostel.fees') || canHostelManage(me, 'hostel.manage');
  const [tab, setTab] = useState('billing');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({});
  const [bills, setBills] = useState([]);
  const [rules, setRules] = useState([]);
  const [messPlans, setMessPlans] = useState([]);
  const [feePlans, setFeePlans] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [rebates, setRebates] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [damage, setDamage] = useState([]);
  const [dues, setDues] = useState([]);

  const [period, setPeriod] = useState({ start: monthStart(), end: monthEnd() });
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [runForm, setRunForm] = useState({ hostelId: '', studentId: '', dueDate: '' });
  const [ruleForm, setRuleForm] = useState({ hostelId: '', roomType: '', amount: '', frequency: 'monthly', feeHeadId: '', effectiveFrom: new Date().toISOString().slice(0, 10) });
  const [messForm, setMessForm] = useState({ name: '', amountPerMonth: '', rebateMinDays: 0, rebateDailyRate: '' });
  const [planForm, setPlanForm] = useState({ allocationId: '', feeRuleId: '', messPlanId: '', monthlyRent: '', monthlyMess: '', effectiveFrom: new Date().toISOString().slice(0, 10) });
  const [rebateForm, setRebateForm] = useState({ allocationId: '', fromDate: new Date().toISOString().slice(0, 10), toDate: new Date().toISOString().slice(0, 10), amount: '', reason: '' });
  const [depositForm, setDepositForm] = useState({ allocation: null, amount: '', status: 'held', notes: '' });
  const [damageForm, setDamageForm] = useState({ allocationId: '', description: '', amount: '', chargeNow: true });

  async function load() {
    setLoading(true);
    try {
      const [s, b, r, mp, fp, al, h, rb, dp, dm, du] = await Promise.all([
        apiGet('/school/hostel/fee-summary'),
        apiGet('/school/hostel/bills'),
        apiGet('/school/hostel/fee-rules'),
        apiGet('/school/hostel/mess-plans'),
        apiGet('/school/hostel/fee-plans'),
        apiGet('/school/hostel/allocations?status=active'),
        apiGet('/school/hostel/hostels'),
        apiGet('/school/hostel/rebates'),
        apiGet('/school/hostel/deposits'),
        apiGet('/school/hostel/damage'),
        apiGet('/school/hostel/dues'),
      ]);
      if (s?.ok) setSummary(s.summary || {});
      if (b?.ok) setBills(b.bills || []);
      if (r?.ok) setRules(r.rules || []);
      if (mp?.ok) setMessPlans(mp.plans || []);
      if (fp?.ok) setFeePlans(fp.plans || []);
      if (al?.ok) setAllocations(al.allocations || []);
      if (h?.ok) setHostels(h.hostels || []);
      if (rb?.ok) setRebates(rb.rebates || []);
      if (dp?.ok) setDeposits(dp.deposits || []);
      if (dm?.ok) setDamage(dm.damage || []);
      if (du?.ok) setDues(du.dues || []);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const allocationOptions = useMemo(
    () => allocations.map((a) => ({ id: a.id, label: `${studentName(a)} Ã‚Â· ${a.hostel_name} ${a.room_number}/${a.bed_no}` })),
    [allocations],
  );

  async function loadPreview() {
    setPreviewLoading(true);
    try {
      const res = await apiGet(`/school/hostel/billing/preview?periodStart=${period.start}&periodEnd=${period.end}`);
      if (res?.ok) setPreview(res.preview || []);
      else toast(res?.error || 'Preview failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setPreviewLoading(false); }
  }

  async function runBilling() {
    if (!window.confirm(`Generate hostel bills for ${fmtDate(period.start)} Ã¢â‚¬â€œ ${fmtDate(period.end)}?`)) return;
    try {
      const res = await apiPost('/school/hostel/billing/run', { periodStart: period.start, periodEnd: period.end, ...runForm });
      if (res?.ok) {
        toast(`${res.created} bill(s) created`, 'success');
        setPreview(null);
        load();
      } else toast(res?.error || 'Failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function cancelBill(bill) {
    const reason = window.prompt(`Reason for cancelling bill #${bill.id}?`) || '';
    if (!reason) return;
    try {
      const res = await apiPost(`/school/hostel/bills/${bill.id}/cancel`, { reason });
      if (res?.ok) { toast('Bill cancelled', 'success'); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function saveRule(e) {
    e.preventDefault();
    try {
      const res = await apiPost('/school/hostel/fee-rules', ruleForm);
      if (res?.ok) { toast('Fee rule saved', 'success'); setRuleForm({ ...ruleForm, amount: '' }); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function saveMess(e) {
    e.preventDefault();
    try {
      const res = await apiPost('/school/hostel/mess-plans', messForm);
      if (res?.ok) { toast('Mess plan saved', 'success'); setMessForm({ name: '', amountPerMonth: '', rebateMinDays: 0, rebateDailyRate: '' }); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function savePlan(e) {
    e.preventDefault();
    try {
      const res = await apiPost('/school/hostel/fee-plans', planForm);
      if (res?.ok) { toast('Fee plan assigned', 'success'); setPlanForm({ ...planForm, allocationId: '', monthlyRent: '', monthlyMess: '' }); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function saveRebate(e) {
    e.preventDefault();
    try {
      const res = await apiPost('/school/hostel/rebates', rebateForm);
      if (res?.ok) { toast('Rebate created', 'success'); setRebateForm({ ...rebateForm, amount: '', reason: '' }); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function approveRebate(r) {
    try {
      const res = await apiPost(`/school/hostel/rebates/${r.id}/approve`, {});
      if (res?.ok) { toast('Rebate approved', 'success'); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function autoRebates() {
    try {
      const res = await apiPost('/school/hostel/mess-rebates/auto', { fromDate: period.start, toDate: period.end });
      if (res?.ok) { toast(`${res.created ?? 0} rebate(s) generated`, 'success'); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function saveDeposit(e) {
    e.preventDefault();
    try {
      const res = await apiPut(`/school/hostel/allocations/${depositForm.allocation.id}/deposit`, depositForm);
      if (res?.ok) { toast('Deposit updated', 'success'); setDepositForm({ allocation: null }); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function saveDamage(e) {
    e.preventDefault();
    try {
      const res = await apiPost('/school/hostel/damage', damageForm);
      if (res?.ok) { toast('Damage recorded', 'success'); setDamageForm({ allocationId: '', description: '', amount: '', chargeNow: true }); load(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }

  if (loading) return <Loading />;

  return (
    <PageShell title="Hostel Fees" icon="bi-cash-coin" subtitle="Billing, fee plans, rebates, deposits and dues" onNavigate={onNavigate}>
      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3 col-xl-2"><Kpi label="Invoiced" value={money(summary.invoiced)} icon="bi-receipt" /></div>
        <div className="col-6 col-md-3 col-xl-2"><Kpi label="Collected" value={money(summary.collected)} icon="bi-cash" tone="success" /></div>
        <div className="col-6 col-md-3 col-xl-2"><Kpi label="Outstanding" value={money(summary.outstanding)} icon="bi-exclamation-circle" tone="danger" /></div>
        <div className="col-6 col-md-3 col-xl-2"><Kpi label="Deposits held" value={money(summary.deposits_held)} icon="bi-shield-check" tone="info" /></div>
        <div className="col-6 col-md-3 col-xl-2"><Kpi label="Rebates" value={money(summary.rebates)} icon="bi-percent" tone="warning" /></div>
        <div className="col-6 col-md-3 col-xl-2"><Kpi label="Issued bills" value={summary.bills} icon="bi-journal-text" tone="secondary" /></div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'billing' && (
        <div className="row g-3">
          <div className="col-xl-4"><div className="card"><div className="card-body">
            <h6><i className="bi bi-calendar-range me-1"></i>Billing Period</h6>
            <div className="row g-2 mb-2">
              <div className="col-6"><label className="form-label small mb-0">From</label><input type="date" className="form-control form-control-sm" value={period.start} onChange={(e) => setPeriod({ ...period, start: e.target.value })} /></div>
              <div className="col-6"><label className="form-label small mb-0">To</label><input type="date" className="form-control form-control-sm" value={period.end} onChange={(e) => setPeriod({ ...period, end: e.target.value })} /></div>
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-outline-primary flex-grow-1" onClick={loadPreview} disabled={previewLoading}>{previewLoading ? 'CalculatingÃ¢â‚¬Â¦' : 'Preview'}</button>
              {manage && <button className="btn btn-sm btn-primary flex-grow-1" onClick={runBilling}>Run Billing</button>}
            </div>
            <hr />
            <h6 className="small text-uppercase text-muted">Filters for run</h6>
            <select className="form-select form-select-sm mb-2" value={runForm.hostelId} onChange={(e) => setRunForm({ ...runForm, hostelId: e.target.value })}>
              <option value="">All hostels</option>
              {hostels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
            <input type="date" className="form-control form-control-sm" value={runForm.dueDate} onChange={(e) => setRunForm({ ...runForm, dueDate: e.target.value })} title="Due date (optional)" />
            <div className="small text-muted mt-2">Daily pro-rata applies to mid-month join/exit. One invoice is created per resident per period.</div>
          </div></div></div>

          <div className="col-xl-8"><div className="card"><div className="card-body">
            <h6>{preview ? `Preview (${preview.length})` : 'Bills'}</h6>
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  {preview
                    ? <tr><th>Student</th><th>Room</th><th>Days</th><th>Rent</th><th>Mess</th><th>Rebate</th><th>Total</th></tr>
                    : <tr><th>Period</th><th>Student</th><th>Rent</th><th>Mess</th><th>Rebate</th><th>Total</th><th>Invoice</th><th></th></tr>}
                </thead>
                <tbody>
                  {preview && preview.length === 0 && <tr><td colSpan="7"><Empty icon="bi-receipt" text="Nothing to bill for this period" /></td></tr>}
                  {preview && preview.map((p) => (
                    <tr key={p.allocation_id}>
                      <td><div className="fw-semibold">{studentName(p)}</div><div className="small text-muted">{p.admission_no}</div></td>
                      <td className="small">{p.hostel_name} Ã‚Â· {p.room_number}/{p.bed_no}</td>
                      <td>{p.days}</td><td>{money(p.rent)}</td><td>{money(p.mess)}</td><td>{money(p.rebate)}</td>
                      <td className="fw-semibold">{money(p.total)}</td>
                    </tr>
                  ))}
                  {!preview && bills.length === 0 && <tr><td colSpan="8"><Empty icon="bi-receipt" text="No bills generated yet" /></td></tr>}
                  {!preview && bills.map((b) => (
                    <tr key={b.id}>
                      <td className="small">{fmtDate(b.period_start)} Ã¢â‚¬â€œ {fmtDate(b.period_end)}</td>
                      <td><div className="fw-semibold">{studentName(b)}</div><div className="small text-muted">{b.admission_no}</div></td>
                      <td>{money(b.rent_amount)}</td><td>{money(b.mess_amount)}</td><td>{money(b.rebate_amount)}</td>
                      <td className="fw-semibold">{money(b.total_amount)}</td>
                      <td className="small">{b.invoice_number || 'Ã¢â‚¬â€'}<div>{statusBadge(BILL_TONE, b.status)}</div></td>
                      <td className="text-end">{manage && b.status === 'issued' && <button className="btn btn-sm btn-outline-danger" onClick={() => cancelBill(b)}>Cancel</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div></div></div>
        </div>
      )}

      {tab === 'plans' && (
        <div className="row g-3">
          {manage && (
            <div className="col-xl-4">
              <div className="card mb-3"><div className="card-body">
                <h6>Fee Rule</h6>
                <form onSubmit={saveRule} className="row g-2">
                  <div className="col-6"><select className="form-select form-select-sm" value={ruleForm.hostelId} onChange={(e) => setRuleForm({ ...ruleForm, hostelId: e.target.value })}><option value="">All hostels</option>{hostels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
                  <div className="col-6"><select className="form-select form-select-sm" value={ruleForm.roomType} onChange={(e) => setRuleForm({ ...ruleForm, roomType: e.target.value })}><option value="">All room types</option><option value="single">Single</option><option value="double">Double</option><option value="triple">Triple</option><option value="dormitory">Dormitory</option></select></div>
                  <div className="col-6"><input type="number" min="0" className="form-control form-control-sm" placeholder="Amount Ã¢â€šÂ¹" value={ruleForm.amount} onChange={(e) => setRuleForm({ ...ruleForm, amount: e.target.value })} required /></div>
                  <div className="col-6"><select className="form-select form-select-sm" value={ruleForm.frequency} onChange={(e) => setRuleForm({ ...ruleForm, frequency: e.target.value })}><option value="monthly">Monthly</option><option value="term">Term</option><option value="annual">Annual</option><option value="one_time">One-time</option></select></div>
                  <div className="col-12"><input type="date" className="form-control form-control-sm" value={ruleForm.effectiveFrom} onChange={(e) => setRuleForm({ ...ruleForm, effectiveFrom: e.target.value })} /></div>
                  <div className="col-12"><button className="btn btn-sm btn-primary w-100">Save Fee Rule</button></div>
                </form>
              </div></div>

              <div className="card mb-3"><div className="card-body">
                <h6>Mess Plan</h6>
                <form onSubmit={saveMess} className="row g-2">
                  <div className="col-12"><input className="form-control form-control-sm" placeholder="Plan name" value={messForm.name} onChange={(e) => setMessForm({ ...messForm, name: e.target.value })} required /></div>
                  <div className="col-6"><input type="number" min="0" className="form-control form-control-sm" placeholder="Monthly Ã¢â€šÂ¹" value={messForm.amountPerMonth} onChange={(e) => setMessForm({ ...messForm, amountPerMonth: e.target.value })} /></div>
                  <div className="col-6"><input type="number" min="0" className="form-control form-control-sm" placeholder="Rebate min days" value={messForm.rebateMinDays} onChange={(e) => setMessForm({ ...messForm, rebateMinDays: e.target.value })} /></div>
                  <div className="col-12"><input type="number" min="0" className="form-control form-control-sm" placeholder="Rebate daily Ã¢â€šÂ¹" value={messForm.rebateDailyRate} onChange={(e) => setMessForm({ ...messForm, rebateDailyRate: e.target.value })} /></div>
                  <div className="col-12"><button className="btn btn-sm btn-outline-primary w-100">Save Mess Plan</button></div>
                </form>
              </div></div>

              <div className="card"><div className="card-body">
                <h6>Assign Fee Plan</h6>
                <form onSubmit={savePlan} className="row g-2">
                  <div className="col-12"><select className="form-select form-select-sm" value={planForm.allocationId} onChange={(e) => setPlanForm({ ...planForm, allocationId: e.target.value })} required><option value="">Resident</option>{allocationOptions.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></div>
                  <div className="col-6"><select className="form-select form-select-sm" value={planForm.feeRuleId} onChange={(e) => setPlanForm({ ...planForm, feeRuleId: e.target.value })}><option value="">Fee rule</option>{rules.map((r) => <option key={r.id} value={r.id}>{r.hostel_name || 'All'} Ã‚Â· {r.room_type || 'any'} Ã‚Â· {money(r.amount)}</option>)}</select></div>
                  <div className="col-6"><select className="form-select form-select-sm" value={planForm.messPlanId} onChange={(e) => setPlanForm({ ...planForm, messPlanId: e.target.value })}><option value="">Mess plan</option>{messPlans.map((p) => <option key={p.id} value={p.id}>{p.name} Ã‚Â· {money(p.amount_per_month)}</option>)}</select></div>
                  <div className="col-6"><input type="number" min="0" className="form-control form-control-sm" placeholder="Monthly rent Ã¢â€šÂ¹" value={planForm.monthlyRent} onChange={(e) => setPlanForm({ ...planForm, monthlyRent: e.target.value })} /></div>
                  <div className="col-6"><input type="number" min="0" className="form-control form-control-sm" placeholder="Monthly mess Ã¢â€šÂ¹" value={planForm.monthlyMess} onChange={(e) => setPlanForm({ ...planForm, monthlyMess: e.target.value })} /></div>
                  <div className="col-12"><button className="btn btn-sm btn-success w-100">Assign Plan</button></div>
                </form>
              </div></div>
            </div>
          )}

          <div className={manage ? 'col-xl-8' : 'col-12'}>
            <div className="card mb-3"><div className="card-body">
              <h6>Fee Rules</h6>
              <div className="table-responsive"><table className="table table-sm"><thead><tr><th>Hostel</th><th>Room type</th><th>Amount</th><th>Frequency</th><th>Effective from</th></tr></thead><tbody>
                {rules.length === 0 && <tr><td colSpan="5"><Empty icon="bi-sliders" text="No fee rules" /></td></tr>}
                {rules.map((r) => <tr key={r.id}><td>{r.hostel_name || 'All'}</td><td className="text-capitalize">{r.room_type || 'any'}</td><td>{money(r.amount)}</td><td className="text-capitalize">{r.frequency}</td><td className="small">{fmtDate(r.effective_from)}</td></tr>)}
              </tbody></table></div>
            </div></div>
            <div className="card"><div className="card-body">
              <h6>Assigned Fee Plans</h6>
              <div className="table-responsive"><table className="table table-sm"><thead><tr><th>Student</th><th>Mess plan</th><th>Rent</th><th>Mess</th><th>Active</th></tr></thead><tbody>
                {feePlans.length === 0 && <tr><td colSpan="5"><Empty icon="bi-sliders" text="No fee plans assigned" /></td></tr>}
                {feePlans.map((p) => (
                  <tr key={p.id}>
                    <td><div className="fw-semibold">{studentName(p)}</div><div className="small text-muted">{p.admission_no}</div></td>
                    <td>{p.mess_plan_name || 'Ã¢â‚¬â€'}</td><td>{money(p.monthly_rent)}</td><td>{money(p.monthly_mess)}</td>
                    <td><Badge tone={p.is_active ? 'success' : 'secondary'}>{p.is_active ? 'active' : 'ended'}</Badge></td>
                  </tr>
                ))}
              </tbody></table></div>
            </div></div>
          </div>
        </div>
      )}

      {tab === 'rebates' && (
        <div className="row g-3">
          {manage && (
            <div className="col-xl-4"><div className="card"><div className="card-body">
              <h6>New Rebate</h6>
              <form onSubmit={saveRebate} className="row g-2">
                <div className="col-12"><select className="form-select form-select-sm" value={rebateForm.allocationId} onChange={(e) => setRebateForm({ ...rebateForm, allocationId: e.target.value })} required><option value="">Resident</option>{allocationOptions.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></div>
                <div className="col-6"><input type="date" className="form-control form-control-sm" value={rebateForm.fromDate} onChange={(e) => setRebateForm({ ...rebateForm, fromDate: e.target.value })} /></div>
                <div className="col-6"><input type="date" className="form-control form-control-sm" value={rebateForm.toDate} onChange={(e) => setRebateForm({ ...rebateForm, toDate: e.target.value })} /></div>
                <div className="col-6"><input type="number" min="0" className="form-control form-control-sm" placeholder="Amount Ã¢â€šÂ¹" value={rebateForm.amount} onChange={(e) => setRebateForm({ ...rebateForm, amount: e.target.value })} /></div>
                <div className="col-6"><input className="form-control form-control-sm" placeholder="Reason" value={rebateForm.reason} onChange={(e) => setRebateForm({ ...rebateForm, reason: e.target.value })} /></div>
                <div className="col-12"><button className="btn btn-sm btn-primary w-100">Add Rebate</button></div>
              </form>
              <button className="btn btn-sm btn-outline-secondary w-100 mt-2" onClick={autoRebates}>Auto-generate from approved leave</button>
            </div></div></div>
          )}
          <div className={manage ? 'col-xl-8' : 'col-12'}><div className="card"><div className="card-body">
            <h6>Mess Rebates</h6>
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Student</th><th>Period</th><th>Days</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>
              {rebates.length === 0 && <tr><td colSpan="6"><Empty icon="bi-percent" text="No rebates" /></td></tr>}
              {rebates.map((r) => (
                <tr key={r.id}>
                  <td><div className="fw-semibold">{studentName(r)}</div><div className="small text-muted">{r.admission_no}</div></td>
                  <td className="small">{fmtDate(r.from_date)} Ã¢â‚¬â€œ {fmtDate(r.to_date)}</td>
                  <td>{r.days}</td><td>{money(r.amount)}</td>
                  <td><Badge tone={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'}>{r.status}</Badge></td>
                  <td className="text-end">{manage && r.status === 'pending' && <button className="btn btn-sm btn-outline-success" onClick={() => approveRebate(r)}>Approve</button>}</td>
                </tr>
              ))}
            </tbody></table></div>
          </div></div></div>
        </div>
      )}

      {tab === 'deposits' && (
        <div className="row g-3">
          <div className="col-xl-8">
            <div className="card mb-3"><div className="card-body">
              <h6>Deposits</h6>
              <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Student</th><th>Amount</th><th>Status</th><th>Held</th><th></th></tr></thead><tbody>
                {deposits.length === 0 && <tr><td colSpan="5"><Empty icon="bi-shield-check" text="No deposits" /></td></tr>}
                {deposits.map((d) => (
                  <tr key={d.id}>
                    <td><div className="fw-semibold">{studentName(d)}</div><div className="small text-muted">{d.admission_no}</div></td>
                    <td>{money(d.amount)}</td>
                    <td><Badge tone={d.status === 'held' ? 'info' : d.status === 'refunded' ? 'success' : d.status === 'forfeited' ? 'danger' : 'secondary'}>{d.status}</Badge></td>
                    <td className="small">{fmtDate(d.held_at)}</td>
                    <td className="text-end">{manage && <button className="btn btn-sm btn-outline-primary" onClick={() => setDepositForm({ allocation: { id: d.allocation_id, student_id: d.student_id, first_name: d.first_name, last_name: d.last_name, admission_no: d.admission_no }, amount: d.amount, status: d.status, notes: d.notes || '' })}>Update</button>}</td>
                  </tr>
                ))}
              </tbody></table></div>
            </div></div>

            <div className="card"><div className="card-body">
              <h6>Damage Recovery</h6>
              <div className="table-responsive"><table className="table table-sm"><thead><tr><th>Room</th><th>Student</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead><tbody>
                {damage.length === 0 && <tr><td colSpan="5"><Empty icon="bi-tools" text="No damage records" /></td></tr>}
                {damage.map((d) => <tr key={d.id}><td>{d.room_number || 'Ã¢â‚¬â€'}</td><td>{d.admission_no ? `${d.first_name} ${d.last_name}` : 'Ã¢â‚¬â€'}</td><td>{d.description}</td><td>{money(d.amount)}</td><td><Badge tone={d.status === 'charged' ? 'warning' : 'secondary'}>{d.status}</Badge></td></tr>)}
              </tbody></table></div>
            </div></div>
          </div>

          {manage && (
            <div className="col-xl-4">
              <div className="card mb-3"><div className="card-body">
                <h6>Update Deposit</h6>
                {!depositForm.allocation ? <div className="text-muted small">Pick a deposit to update.</div> : (
                  <form onSubmit={saveDeposit} className="row g-2">
                    <div className="col-12 small text-muted">{studentName(depositForm.allocation)} Ã‚Â· {depositForm.allocation.admission_no}</div>
                    <div className="col-6"><input type="number" min="0" className="form-control form-control-sm" placeholder="Amount Ã¢â€šÂ¹" value={depositForm.amount} onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })} /></div>
                    <div className="col-6"><select className="form-select form-select-sm" value={depositForm.status} onChange={(e) => setDepositForm({ ...depositForm, status: e.target.value })}><option value="held">Held</option><option value="pending">Pending</option><option value="refunded">Refunded</option><option value="adjusted">Adjusted</option><option value="forfeited">Forfeited</option></select></div>
                    <div className="col-12"><input className="form-control form-control-sm" placeholder="Notes" value={depositForm.notes} onChange={(e) => setDepositForm({ ...depositForm, notes: e.target.value })} /></div>
                    <div className="col-12"><button className="btn btn-sm btn-primary w-100">Save Deposit</button></div>
                    <div className="col-12 small text-muted">Refund/adjustment is blocked until clearance is completed.</div>
                  </form>
                )}
              </div></div>

              <div className="card"><div className="card-body">
                <h6>Record Damage</h6>
                <form onSubmit={saveDamage} className="row g-2">
                  <div className="col-12"><select className="form-select form-select-sm" value={damageForm.allocationId} onChange={(e) => setDamageForm({ ...damageForm, allocationId: e.target.value })} required><option value="">Resident</option>{allocationOptions.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></div>
                  <div className="col-12"><input className="form-control form-control-sm" placeholder="Description" value={damageForm.description} onChange={(e) => setDamageForm({ ...damageForm, description: e.target.value })} required /></div>
                  <div className="col-12"><input type="number" min="0" className="form-control form-control-sm" placeholder="Amount Ã¢â€šÂ¹" value={damageForm.amount} onChange={(e) => setDamageForm({ ...damageForm, amount: e.target.value })} required /></div>
                  <div className="col-12 form-check ms-1"><input className="form-check-input" type="checkbox" id="chargeNow" checked={damageForm.chargeNow} onChange={(e) => setDamageForm({ ...damageForm, chargeNow: e.target.checked })} /><label className="form-check-label small" htmlFor="chargeNow">Charge now (create invoice)</label></div>
                  <div className="col-12"><button className="btn btn-sm btn-outline-danger w-100">Record Damage</button></div>
                </form>
              </div></div>
            </div>
          )}
        </div>
      )}

      {tab === 'dues' && (
        <div className="card"><div className="card-body">
          <h6>Outstanding Hostel Dues</h6>
          <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Invoice</th><th>Student</th><th>Class</th><th>Due date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>
            {dues.length === 0 && <tr><td colSpan="8"><Empty icon="bi-check-circle" text="No outstanding hostel dues" /></td></tr>}
            {dues.map((d) => (
              <tr key={d.id}>
                <td className="small">{d.number}</td>
                <td><div className="fw-semibold">{studentName(d)}</div><div className="small text-muted">{d.admission_no}</div></td>
                <td>{d.class_name || 'Ã¢â‚¬â€'}</td><td className="small">{fmtDate(d.due_date)}</td>
                <td>{money(d.total_amount)}</td><td>{money(d.paid_amount)}</td>
                <td className="fw-semibold text-danger">{money(d.balance)}</td>
                <td><Badge tone={d.status === 'partly_paid' ? 'warning' : 'info'}>{d.status}</Badge></td>
              </tr>
            ))}
          </tbody></table></div>
        </div></div>
      )}

    </PageShell>
  );
}

