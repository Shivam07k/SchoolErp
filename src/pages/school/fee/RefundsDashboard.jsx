import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, ErrorBox, Badge, canManage, fmtDate } from './shared';

const inr = (v) => `Ã¢â€šÂ¹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const TONE = { pending: 'warning', approved: 'info', paid: 'success', rejected: 'danger', cancelled: 'secondary' };
const REASONS = ['withdrawal', 'excess', 'cancelled_admission', 'deposit_return', 'transport_change', 'concession_late'];

export default function RefundsDashboard({ me, onNavigate }) {
  const [data, setData] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('requests');
  const [form, setForm] = useState({ studentId: '', reasonType: 'withdrawal', reasonText: '', requestedAmount: '', deductions: '0' });
  const [busy, setBusy] = useState(false);
  const manager = canManage(me) || me?.permissions?.includes('fees.manage');

  async function load() {
    setLoading(true); setError('');
    try {
      const [d, s] = await Promise.all([apiGet('/school/fee/refunds'), apiGet('/school/students?status=active')]);
      if (d?.ok) setData(d); else throw new Error(d?.error || 'Failed to load refunds');
      if (s?.ok) setStudents(s.students || []);
    } catch (err) { setError(err.message || 'Failed to load refunds'); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiPost('/school/fee/refunds', form);
      if (!res?.ok) throw new Error(res?.error || 'Failed to create refund');
      toast('Refund request created', 'success');
      setForm({ studentId: '', reasonType: 'withdrawal', reasonText: '', requestedAmount: '', deductions: '0' });
      load();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function act(id, action) {
    let body = {};
    if (action === 'reject') body = { reason: window.prompt('Rejection reason') || '' };
    if (action === 'pay') body = { payoutMode: window.prompt('Payout mode (cash/bank_transfer/cheque/upi)', 'bank_transfer') || 'bank_transfer', payoutReference: window.prompt('Payout reference') || '' };
    const res = await apiPost(`/school/fee/refunds/${id}/${action}`, body);
    if (!res?.ok) return toast(res?.error || `Failed to ${action} refund`, 'error');
    toast(`Refund ${action === 'pay' ? 'paid' : action + 'd'}`, 'success');
    load();
  }

  const summary = data?.summary || {};
  const requests = data?.requests || [];

  return (
    <PageShell
      title="Refunds"
      icon="bi-arrow-return-left"
      subtitle="Refund requests, approval chain, credit notes and deposits"
      onNavigate={onNavigate}
      actions={<button className="btn btn-sm btn-outline-secondary" onClick={load}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>}
    >
      <ErrorBox message={error} onRetry={load} />
      {loading ? <Loading /> : (
        <>
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-3"><div className="border rounded p-3 h-100"><div className="text-muted small">Total requests</div><div className="fs-5 fw-bold">{summary.total || 0}</div></div></div>
            <div className="col-6 col-md-3"><div className="border rounded p-3 h-100"><div className="text-muted small">Pending</div><div className="fs-5 fw-bold text-warning">{summary.pending || 0}</div></div></div>
            <div className="col-6 col-md-3"><div className="border rounded p-3 h-100"><div className="text-muted small">Open value</div><div className="fs-5 fw-bold text-warning">{inr(summary.open_amount)}</div><div className="small text-muted">{summary.approved || 0} approved</div></div></div>
            <div className="col-6 col-md-3"><div className="border rounded p-3 h-100"><div className="text-muted small">Paid out</div><div className="fs-5 fw-bold text-success">{inr(summary.paid_amount)}</div><div className="small text-muted">{summary.paid || 0} refunds</div></div></div>
          </div>

          {manager && (
            <div className="border rounded p-3 mb-4 bg-light">
              <h6 className="fw-bold mb-3"><i className="bi bi-plus-circle me-1"></i>New refund request</h6>
              <form className="row g-2" onSubmit={create}>
                <div className="col-md-4"><label className="form-label small">Student *</label><select className="form-select form-select-sm" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} required><option value="">Select student</option>{students.map((s) => <option key={s.id} value={s.id}>{s.admission_no} Ã¢â‚¬â€ {s.first_name} {s.last_name}</option>)}</select></div>
                <div className="col-md-3"><label className="form-label small">Reason</label><select className="form-select form-select-sm" value={form.reasonType} onChange={(e) => setForm({ ...form, reasonType: e.target.value })}>{REASONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}</select></div>
                <div className="col-md-2"><label className="form-label small">Requested *</label><input type="number" min="0.01" step="0.01" className="form-control form-control-sm" value={form.requestedAmount} onChange={(e) => setForm({ ...form, requestedAmount: e.target.value })} required /></div>
                <div className="col-md-3"><label className="form-label small">Deductions</label><input type="number" min="0" step="0.01" className="form-control form-control-sm" value={form.deductions} onChange={(e) => setForm({ ...form, deductions: e.target.value })} /></div>
                <div className="col-md-9"><label className="form-label small">Reason details</label><input className="form-control form-control-sm" value={form.reasonText} onChange={(e) => setForm({ ...form, reasonText: e.target.value })} placeholder="Why is this refund due?" /></div>
                <div className="col-md-3"><label className="form-label small">Net refund</label><div className="form-control form-control-sm bg-white">{inr(Number(form.requestedAmount || 0) - Number(form.deductions || 0))}</div></div>
                <div className="col-12"><button className="btn btn-sm btn-primary" disabled={busy}>{busy ? 'SavingÃ¢â‚¬Â¦' : 'Submit request'}</button></div>
              </form>
            </div>
          )}

          <ul className="nav nav-tabs mb-3">
            {[['requests', `Requests (${requests.length})`], ['rules', `Refund rules (${data?.rules?.length || 0})`], ['credit-notes', `Credit notes (${data?.creditNotes?.length || 0})`], ['deposits', `Deposits (${data?.deposits?.length || 0})`]].map(([k, label]) => <li className="nav-item" key={k}><button className={`nav-link ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{label}</button></li>)}
          </ul>

          {tab === 'requests' && (!requests.length ? <Empty icon="bi-arrow-return-left" text="No refund requests raised yet." /> : (
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Student</th><th>Reason</th><th className="text-end">Requested</th><th className="text-end">Deductions</th><th className="text-end">Net</th><th>Status</th><th>Requested</th><th className="text-end">Actions</th></tr></thead><tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td><span className="fw-semibold">{r.first_name} {r.last_name}</span><div className="small text-muted">{r.admission_no}{r.class_name ? ` Ã‚Â· ${r.class_name}` : ''}</div></td>
                  <td>{(r.reason_type || '').replace(/_/g, ' ')}<div className="small text-muted">{r.reason_text || ''}</div></td>
                  <td className="text-end">{inr(r.requested_amount)}</td>
                  <td className="text-end">{inr(r.deductions)}</td>
                  <td className="text-end fw-semibold">{inr(r.net_amount)}</td>
                  <td><Badge tone={TONE[r.status] || 'secondary'}>{r.status}</Badge></td>
                  <td>{fmtDate(r.requested_at)}<div className="small text-muted">{r.requested_by}</div></td>
                  <td className="text-end">
                    {manager && r.status === 'pending' && <div className="btn-group btn-group-sm"><button className="btn btn-outline-success" onClick={() => act(r.id, 'approve')}>Approve</button><button className="btn btn-outline-danger" onClick={() => act(r.id, 'reject')}>Reject</button></div>}
                    {manager && r.status === 'approved' && <button className="btn btn-sm btn-outline-primary" onClick={() => act(r.id, 'pay')}>Mark paid</button>}
                    {r.status === 'paid' && <span className="small text-muted">{r.payout_mode || ''} {r.payout_reference || ''}</span>}
                  </td>
                </tr>
              ))}
            </tbody></table></div>
          ))}

          {tab === 'rules' && (!(data?.rules || []).length ? <Empty icon="bi-rulers" text="No refund rules configured." /> : (
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Reason</th><th>Head</th><th>Category</th><th className="text-end">Refundable %</th><th className="text-end">Notice days</th><th>Approval</th></tr></thead><tbody>
              {data.rules.map((r) => <tr key={r.id}><td className="fw-semibold">{(r.reason_type || '').replace(/_/g, ' ')}</td><td>{r.head_name || 'All'}</td><td>{r.category_name || 'All'}</td><td className="text-end">{r.refundable_percent}%</td><td className="text-end">{r.notice_days || 0}</td><td>{r.requires_approval ? <span className="badge bg-warning">Required</span> : <span className="badge bg-success">Not required</span>}</td></tr>)}
            </tbody></table></div>
          ))}

          {tab === 'credit-notes' && (!(data?.creditNotes || []).length ? <Empty icon="bi-file-earmark-plus" text="No credit notes issued." /> : (
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Student</th><th className="text-end">Amount</th><th className="text-end">Used</th><th>Reason</th><th>Status</th><th>Expiry</th></tr></thead><tbody>
              {data.creditNotes.map((c) => <tr key={c.id}><td>{c.first_name ? `${c.first_name} ${c.last_name || ''}` : 'Ã¢â‚¬â€'}<div className="small text-muted">{c.admission_no}</div></td><td className="text-end">{inr(c.amount)}</td><td className="text-end">{inr(c.used_amount)}</td><td>{c.reason}</td><td><Badge tone={c.status === 'active' ? 'success' : 'secondary'}>{c.status}</Badge></td><td>{fmtDate(c.expiry_date)}</td></tr>)}
            </tbody></table></div>
          ))}

          {tab === 'deposits' && (!(data?.deposits || []).length ? <Empty icon="bi-bank" text="No deposits held." /> : (
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Student</th><th>Head</th><th className="text-end">Amount</th><th>Status</th><th>Return date</th></tr></thead><tbody>
              {data.deposits.map((d) => <tr key={d.id}><td>{d.first_name ? `${d.first_name} ${d.last_name || ''}` : 'Ã¢â‚¬â€'}<div className="small text-muted">{d.admission_no}</div></td><td>{d.head_name || 'Ã¢â‚¬â€'}</td><td className="text-end">{inr(d.amount)}</td><td><Badge tone={d.status === 'held' ? 'warning' : d.status === 'returned' ? 'success' : 'secondary'}>{d.status}</Badge></td><td>{fmtDate(d.return_date)}</td></tr>)}
            </tbody></table></div>
          ))}
        </>
      )}
    </PageShell>
  );
}

