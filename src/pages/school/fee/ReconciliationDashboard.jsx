import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, ErrorBox, Badge, canManage, fmtDate } from './shared';

const inr = (v) => `Ã¢â€šÂ¹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const TONE = { open: 'warning', closing: 'info', closed: 'success', pending: 'warning', deposited: 'info', cleared: 'success', bounced: 'danger', cancelled: 'secondary', imported: 'info', matched: 'success', exceptions: 'danger', resolved: 'success', ignored: 'secondary' };

export default function ReconciliationDashboard({ me, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('cashier');
  const manager = canManage(me) || me?.permissions?.includes('fees.manage');

  async function load() {
    setLoading(true); setError('');
    try {
      const d = await apiGet('/school/fee/reconciliation');
      if (d?.ok) setData(d); else throw new Error(d?.error || 'Failed to load reconciliation');
    } catch (err) { setError(err.message || 'Failed to load reconciliation'); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function openDay() {
    const opening = window.prompt('Opening cash', '0');
    if (opening === null) return;
    const res = await apiPost('/school/fee/cashier-days', { openingCash: opening });
    if (!res?.ok) return toast(res?.error || 'Failed to open cashier day', 'error');
    toast('Cashier day opened', 'success'); load();
  }

  async function closeDay(day) {
    const closing = window.prompt(`Closing cash for ${fmtDate(day.date)} (opening ${inr(day.opening_cash)})`, String(day.closing_cash ?? day.opening_cash ?? 0));
    if (closing === null) return;
    const res = await apiPost(`/school/fee/cashier-days/${day.id}/close`, { closingCash: closing });
    if (!res?.ok) return toast(res?.error || 'Failed to close cashier day', 'error');
    toast('Cashier day closed', 'success'); load();
  }

  async function chequeStatus(ch) {
    const status = window.prompt('New cheque status: deposited / cleared / bounced / cancelled', ch.status);
    if (!status) return;
    const res = await apiPost(`/school/fee/cheques/${ch.id}/status`, { status });
    if (!res?.ok) return toast(res?.error || 'Failed to update cheque', 'error');
    toast('Cheque updated', 'success'); load();
  }

  async function resolveException(ex) {
    const note = window.prompt('Resolution note') || '';
    const res = await apiPost(`/school/fee/exceptions/${ex.id}/resolve`, { note });
    if (!res?.ok) return toast(res?.error || 'Failed to resolve exception', 'error');
    toast('Exception resolved', 'success'); load();
  }

  const summary = data?.summary || {};

  return (
    <PageShell
      title="Reconciliation"
      icon="bi-arrow-left-right"
      subtitle="Cashier closing, cheque clearing, gateway settlement, bank matching and exceptions"
      onNavigate={onNavigate}
      actions={
        <>
          <button className="btn btn-sm btn-outline-secondary" onClick={load}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>
          {manager && <button className="btn btn-sm btn-primary" onClick={openDay}><i className="bi bi-cash-coin me-1"></i>Open Cashier Day</button>}
        </>
      }
    >
      <ErrorBox message={error} onRetry={load} />
      {loading ? <Loading /> : (
        <>
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-3"><div className="border rounded p-3 h-100"><div className="text-muted small">Open cashier days</div><div className="fs-5 fw-bold text-warning">{summary.open_cashier_days || 0}</div></div></div>
            <div className="col-6 col-md-3"><div className="border rounded p-3 h-100"><div className="text-muted small">Cheques in hand</div><div className="fs-5 fw-bold">{inr(summary.cheques_in_hand)}</div><div className="small text-danger">{summary.bounced_cheques || 0} bounced</div></div></div>
            <div className="col-6 col-md-3"><div className="border rounded p-3 h-100"><div className="text-muted small">Gateway settled</div><div className="fs-5 fw-bold text-success">{inr(summary.settled_amount)}</div><div className="small text-muted">{summary.unmatched_settlements || 0} unmatched</div></div></div>
            <div className="col-6 col-md-3"><div className="border rounded p-3 h-100"><div className="text-muted small">Open exceptions</div><div className="fs-5 fw-bold text-danger">{summary.open_exceptions || 0}</div><div className="small text-muted">{summary.unmatched_bank_lines || 0} unmatched bank lines</div></div></div>
          </div>

          <ul className="nav nav-tabs mb-3">
            {[['cashier', `Cashier days (${data?.cashierDays?.length || 0})`], ['cheques', `Cheques (${data?.cheques?.length || 0})`], ['gateway', `Gateway (${data?.settlements?.length || 0})`], ['bank', `Bank lines (${data?.bankLines?.length || 0})`], ['exceptions', `Exceptions (${data?.exceptions?.length || 0})`]].map(([k, label]) => <li className="nav-item" key={k}><button className={`nav-link ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{label}</button></li>)}
          </ul>

          {tab === 'cashier' && (!(data?.cashierDays || []).length ? <Empty icon="bi-cash-coin" text="No cashier days opened yet." /> : (
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Date</th><th>Cashier</th><th className="text-end">Opening</th><th className="text-end">Expected</th><th className="text-end">Closing</th><th className="text-end">Difference</th><th>Status</th><th className="text-end">Action</th></tr></thead><tbody>
              {data.cashierDays.map((d) => (
                <tr key={d.id} className={Number(d.difference) !== 0 && d.status === 'closed' ? 'table-warning' : ''}>
                  <td className="fw-semibold">{fmtDate(d.date)}</td><td>{d.cashier_id}</td><td className="text-end">{inr(d.opening_cash)}</td><td className="text-end">{inr(d.expected_cash)}</td><td className="text-end">{inr(d.closing_cash)}</td><td className={`text-end ${Number(d.difference) < 0 ? 'text-danger' : Number(d.difference) > 0 ? 'text-warning' : ''}`}>{d.difference == null ? 'Ã¢â‚¬â€' : inr(d.difference)}</td><td><Badge tone={TONE[d.status] || 'secondary'}>{d.status}</Badge></td><td className="text-end">{manager && d.status !== 'closed' && <button className="btn btn-sm btn-outline-primary" onClick={() => closeDay(d)}>Close day</button>}</td>
                </tr>
              ))}
            </tbody></table></div>
          ))}

          {tab === 'cheques' && (!(data?.cheques || []).length ? <Empty icon="bi-check2-square" text="No cheques recorded." /> : (
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Cheque</th><th>Bank</th><th>Student</th><th>Date</th><th className="text-end">Amount</th><th>Status</th><th className="text-end">Action</th></tr></thead><tbody>
              {data.cheques.map((c) => <tr key={c.id}><td className="fw-semibold">{c.number}<div className="small text-muted">{c.receipt_number || ''}</div></td><td>{c.bank_name || 'Ã¢â‚¬â€'}<div className="small text-muted">{c.branch || ''}</div></td><td>{c.first_name ? `${c.first_name} ${c.last_name || ''}` : 'Ã¢â‚¬â€'}<div className="small text-muted">{c.admission_no}</div></td><td>{fmtDate(c.cheque_date)}</td><td className="text-end">{inr(c.amount)}</td><td><Badge tone={TONE[c.status] || 'secondary'}>{c.status}</Badge></td><td className="text-end">{manager && <button className="btn btn-sm btn-outline-primary" onClick={() => chequeStatus(c)}>Update</button>}</td></tr>)}
            </tbody></table></div>
          ))}

          {tab === 'gateway' && (!(data?.settlements || []).length ? <Empty icon="bi-credit-card" text="No gateway settlements imported." /> : (
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Gateway</th><th>Settlement</th><th>Date</th><th className="text-end">Gross</th><th className="text-end">Fee</th><th className="text-end">Net</th><th>Status</th></tr></thead><tbody>
              {data.settlements.map((s) => <tr key={s.id}><td className="fw-semibold">{s.gateway}</td><td>{s.settlement_id}</td><td>{fmtDate(s.settlement_date)}</td><td className="text-end">{inr(s.gross_amount)}</td><td className="text-end">{inr(Number(s.gateway_fee) + Number(s.tax_on_fee))}</td><td className="text-end">{inr(s.net_amount)}</td><td><Badge tone={TONE[s.status] || 'secondary'}>{s.status}</Badge></td></tr>)}
            </tbody></table></div>
          ))}

          {tab === 'bank' && (!(data?.bankLines || []).length ? <Empty icon="bi-bank" text="No bank statement lines imported." /> : (
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Date</th><th>Narration</th><th>Reference</th><th className="text-end">Debit</th><th className="text-end">Credit</th><th>Matched</th></tr></thead><tbody>
              {data.bankLines.map((b) => <tr key={b.id}><td>{fmtDate(b.date)}</td><td>{b.narration || 'Ã¢â‚¬â€'}</td><td>{b.reference || 'Ã¢â‚¬â€'}</td><td className="text-end">{inr(b.debit)}</td><td className="text-end">{inr(b.credit)}</td><td>{b.matched_flag ? <span className="badge bg-success">Yes</span> : <span className="badge bg-warning">No</span>}</td></tr>)}
            </tbody></table></div>
          ))}

          {tab === 'exceptions' && (!(data?.exceptions || []).length ? <Empty icon="bi-exclamation-triangle" text="No reconciliation exceptions." /> : (
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Type</th><th>Source</th><th className="text-end">Difference</th><th>Status</th><th>Created</th><th>Resolution</th><th className="text-end">Action</th></tr></thead><tbody>
              {data.exceptions.map((x) => <tr key={x.id}><td className="fw-semibold">{(x.exception_type || '').replace(/_/g, ' ')}</td><td>{x.source_type} #{x.source_id}</td><td className="text-end">{x.amount_diff == null ? 'Ã¢â‚¬â€' : inr(x.amount_diff)}</td><td><Badge tone={TONE[x.status] || 'secondary'}>{x.status}</Badge></td><td>{fmtDate(x.created_at)}</td><td className="small">{x.resolution_note || 'Ã¢â‚¬â€'}</td><td className="text-end">{manager && x.status === 'open' && <button className="btn btn-sm btn-outline-success" onClick={() => resolveException(x)}>Resolve</button>}</td></tr>)}
            </tbody></table></div>
          ))}
        </>
      )}
    </PageShell>
  );
}

