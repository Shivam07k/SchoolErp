import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Loading, ErrorBox, Badge, canManageHR, canViewHR, fmtDate, ADVANCE_STATUS_TONE } from './shared';

export default function AdvanceDetail({ me, onNavigate, advanceId }) {
  const [advance, setAdvance] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [prepayAmount, setPrepayAmount] = useState('');
  const [writeoffReason, setWriteoffReason] = useState('');
  const manager = canManageHR(me, 'hr.advance_manage');
  const viewer = canViewHR(me, 'hr.advance_view');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const d = await apiGet(`/school/hr/advances/${advanceId}`);
      if (d?.ok) { setAdvance(d.advance); setSchedule(d.schedule || []); setLedger(d.ledger || []); }
      else throw new Error(d?.error || 'Failed to load');
    } catch (err) { setError(err.message || 'Failed to load'); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (advanceId) load(); }, [advanceId]);

  async function approve() {
    try { const res = await apiPost(`/school/hr/advances/${advanceId}/approve`, {}); if (!res?.ok) throw new Error(res?.error); toast('Approved', 'success'); load(); } catch (err) { toast(err.message, 'error'); }
  }
  async function reject() {
    const reason = window.prompt('Rejection reason:'); if (!reason) return;
    try { const res = await apiPost(`/school/hr/advances/${advanceId}/reject`, { rejection_reason: reason }); if (!res?.ok) throw new Error(res?.error); toast('Rejected', 'success'); load(); } catch (err) { toast(err.message, 'error'); }
  }
  async function disburse() {
    try { const res = await apiPost(`/school/hr/advances/${advanceId}/disburse`, { disbursement_mode: 'bank' }); if (!res?.ok) throw new Error(res?.error); toast('Disbursed', 'success'); load(); } catch (err) { toast(err.message, 'error'); }
  }
  async function prepay() {
    if (!prepayAmount) return toast('Enter amount', 'warning');
    try { const res = await apiPost(`/school/hr/advances/${advanceId}/prepay`, { amount: Number(prepayAmount) }); if (!res?.ok) throw new Error(res?.error); toast('Prepaid', 'success'); setPrepayAmount(''); load(); } catch (err) { toast(err.message, 'error'); }
  }
  async function writeoff() {
    if (!window.confirm('Write off this advance?')) return;
    try { const res = await apiPost(`/school/hr/advances/${advanceId}/writeoff`, { reason: writeoffReason || 'Written off' }); if (!res?.ok) throw new Error(res?.error); toast('Written off', 'success'); load(); } catch (err) { toast(err.message, 'error'); }
  }

  if (loading) return <PageShell title="Advance Detail" icon="bi-cash-stack" subtitle="Loading..." onNavigate={onNavigate}><Loading /></PageShell>;
  if (error) return <PageShell title="Advance Detail" icon="bi-cash-stack" subtitle="Error" onNavigate={onNavigate}><ErrorBox message={error} onRetry={load} /></PageShell>;
  if (!advance) return <PageShell title="Advance Detail" icon="bi-cash-stack" subtitle="Not found" onNavigate={onNavigate}><div className="text-center py-5">Advance not found</div></PageShell>;

  const outstanding = schedule.filter(s => ['pending', 'partially_recovered'].includes(s.status)).reduce((a, s) => a + Number(s.total_amount || 0) - Number(s.recovered_amount || 0), 0);

  return (
    <PageShell title="Advance Detail" icon="bi-cash-stack" subtitle={`${advance.staff_name} Ã¢â‚¬â€ ${advance.type}`} onNavigate={onNavigate} actions={
      <>
        {viewer && <button className="btn btn-sm btn-outline-secondary" onClick={load}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>}
        <button className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/hr/advances')}><i className="bi bi-arrow-left me-1"></i>Back</button>
      </>
    }>
      <ErrorBox message={error} onRetry={load} />

      <div className="row g-3 mb-4">
        <div className="col-md-3"><div className="card"><div className="card-body text-center"><div className="fw-bold fs-4">{Number(advance.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</div><div className="text-muted small">Principal</div></div></div></div>
        <div className="col-md-3"><div className="card"><div className="card-body text-center"><div className="fw-bold fs-4">{outstanding.toLocaleString('en-IN', {minimumFractionDigits: 2})}</div><div className="text-muted small">Outstanding</div></div></div></div>
        <div className="col-md-3"><div className="card"><div className="card-body text-center"><div className="fw-bold fs-4"><Badge tone={ADVANCE_STATUS_TONE[advance.status] || 'secondary'}>{advance.status}</Badge></div><div className="text-muted small">Status</div></div></div></div>
        <div className="col-md-3"><div className="card"><div className="card-body text-center"><div className="fw-bold fs-4">{advance.installments}</div><div className="text-muted small">Installments</div></div></div></div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-md-4"><div className="small text-muted">Staff</div><div className="fw-bold">{advance.employee_code} Ã¢â‚¬â€ {advance.staff_name}</div></div>
        <div className="col-md-4"><div className="small text-muted">Type</div><div className="fw-bold"><Badge tone={advance.type === 'salary_advance' ? 'info' : 'warning'}>{advance.type}</Badge></div></div>
        <div className="col-md-4"><div className="small text-muted">Interest</div><div className="fw-bold">{advance.interest_rate}% ({advance.interest_type})</div></div>
        <div className="col-md-4"><div className="small text-muted">Requested</div><div>{fmtDate(advance.requested_at)}</div></div>
        <div className="col-md-4"><div className="small text-muted">Approved</div><div>{fmtDate(advance.approved_at)}</div></div>
        <div className="col-md-4"><div className="small text-muted">Disbursed</div><div>{fmtDate(advance.disbursed_at)}</div></div>
        <div className="col-12"><div className="small text-muted">Reason</div><div>{advance.reason}</div></div>
      </div>

      {manager && (
        <div className="card mb-3">
          <div className="card-header"><h6 className="mb-0">Actions</h6></div>
          <div className="card-body">
            <div className="d-flex flex-wrap gap-2">
              {advance.status === 'requested' && <button className="btn btn-success" onClick={approve}><i className="bi bi-check me-1"></i>Approve</button>}
              {advance.status === 'requested' && <button className="btn btn-danger" onClick={reject}><i className="bi bi-x me-1"></i>Reject</button>}
              {advance.status === 'approved' && <button className="btn btn-primary" onClick={disburse}><i className="bi bi-bank me-1"></i>Disburse</button>}
              {['disbursed', 'recovering'].includes(advance.status) && <>
                <div className="d-flex align-items-center gap-2"><input type="number" step="0.01" className="form-control form-control-sm" style={{width: 150}} placeholder="Amount" value={prepayAmount} onChange={e => setPrepayAmount(e.target.value)} /><button className="btn btn-warning" onClick={prepay}><i className="bi bi-arrow-up-circle me-1"></i>Prepay</button></div>
                <div className="d-flex align-items-center gap-2"><input type="text" className="form-control form-control-sm" style={{width: 200}} placeholder="Reason" value={writeoffReason} onChange={e => setWriteoffReason(e.target.value)} /><button className="btn btn-outline-danger" onClick={writeoff}><i className="bi bi-trash me-1"></i>Write Off</button></div>
              </>}
            </div>
          </div>
        </div>
      )}

      <div className="card mb-3">
        <div className="card-header"><h6 className="mb-0">Repayment Schedule</h6></div>
        <div className="card-body p-0">
          {schedule.length ? (
            <div className="table-responsive"><table className="table table-sm mb-0"><thead className="table-light"><tr><th>#</th><th>Due Month</th><th className="text-end">Principal</th><th className="text-end">Interest</th><th className="text-end">Total</th><th className="text-end">Recovered</th><th className="text-end">Outstanding</th><th>Status</th></tr></thead><tbody>
              {schedule.map(s => {
                const out = Number(s.total_amount || 0) - Number(s.recovered_amount || 0);
                return (
                  <tr key={s.id} style={{background: s.status === 'recovered' ? '#e8f5e9' : s.status === 'partially_recovered' ? '#fff3e0' : ''}}>
                    <td>{s.installment_no}</td>
                    <td>{s.due_month ? new Date(s.due_month).toLocaleDateString('en-IN', {year: 'numeric', month: 'short'}) : 'Ã¢â‚¬â€'}</td>
                    <td className="text-end">{Number(s.principal_amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                    <td className="text-end">{Number(s.interest_amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                    <td className="text-end">{Number(s.total_amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                    <td className="text-end">{Number(s.recovered_amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                    <td className="text-end">{out.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                    <td><Badge tone={s.status === 'recovered' ? 'success' : s.status === 'partially_recovered' ? 'warning' : s.status === 'skipped' ? 'secondary' : 'secondary'}>{s.status}</Badge></td>
                  </tr>
                );
              })}
            </tbody></table></div>
          ) : (
            <div className="text-center py-3 text-muted">No schedule</div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h6 className="mb-0">Ledger</h6></div>
        <div className="card-body p-0">
          {ledger.length ? (
            <div className="table-responsive"><table className="table table-sm mb-0"><thead className="table-light"><tr><th>Date</th><th>Type</th><th className="text-end">Amount</th><th className="text-end">Balance After</th><th>Remarks</th></tr></thead><tbody>
              {ledger.map(l => (
                <tr key={l.id}>
                  <td>{fmtDate(l.date)}</td>
                  <td><Badge tone={l.type === 'disbursement' ? 'success' : l.type === 'recovery' ? 'warning' : l.type === 'prepayment' ? 'info' : l.type === 'write_off' ? 'danger' : 'secondary'}>{l.type}</Badge></td>
                  <td className="text-end">{Number(l.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                  <td className="text-end">{Number(l.balance_after).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                  <td className="text-muted small">{l.remarks}</td>
                </tr>
              ))}
            </tbody></table></div>
          ) : (
            <div className="text-center py-3 text-muted">No ledger entries</div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
