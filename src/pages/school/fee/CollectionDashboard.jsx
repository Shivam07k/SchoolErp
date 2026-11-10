import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, ErrorBox, Badge, canManage, fmtDate, downloadCsv } from './shared';

const STATUS_TONE = { draft: 'secondary', issued: 'warning', partly_paid: 'info', paid: 'success', cancelled: 'danger', written_off: 'dark' };
const inr = (v) => `Ã¢â€šÂ¹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function CollectionDashboard({ me, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('invoices');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ studentId: '', headId: '', amount: '', dueDate: '', date: '', concessionAmount: '', fineAmount: '' });
  const [payFor, setPayFor] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', mode: 'cash', reference: '', date: '' });
  const [busy, setBusy] = useState(false);
  const manager = canManage(me) || me?.permissions?.includes('fees.manage');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const q = new URLSearchParams();
      if (status) q.set('status', status);
      if (search.trim()) q.set('search', search.trim());
      const d = await apiGet(`/school/fee/collection?${q.toString()}`);
      if (d?.ok) setData(d);
      else throw new Error(d?.error || 'Failed to load collection data');
    } catch (err) {
      setError(err.message || 'Failed to load collection data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [status]);

  async function createInvoice(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiPost('/school/fee/invoices', {
        studentId: invoiceForm.studentId,
        headId: invoiceForm.headId || undefined,
        amount: invoiceForm.amount,
        dueDate: invoiceForm.dueDate,
        date: invoiceForm.date || undefined,
        concessionAmount: invoiceForm.concessionAmount || 0,
        fineAmount: invoiceForm.fineAmount || 0,
      });
      if (!res?.ok) throw new Error(res?.error || 'Failed to create invoice');
      toast('Invoice created', 'success');
      setShowInvoice(false);
      setInvoiceForm({ studentId: '', headId: '', amount: '', dueDate: '', date: '', concessionAmount: '', fineAmount: '' });
      load();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function collect(e) {
    e.preventDefault();
    if (!payFor) return;
    setBusy(true);
    try {
      const res = await apiPost('/school/fee/receipts', {
        invoiceId: payFor.id,
        amount: payForm.amount,
        mode: payForm.mode,
        reference: payForm.reference || undefined,
        date: payForm.date || undefined,
      });
      if (!res?.ok) throw new Error(res?.error || 'Failed to record payment');
      toast('Payment receipt recorded', 'success');
      setPayFor(null);
      setPayForm({ amount: '', mode: 'cash', reference: '', date: '' });
      load();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function cancelInvoice(inv) {
    if (!window.confirm(`Cancel invoice ${inv.number}?`)) return;
    const reason = window.prompt('Cancellation reason') || '';
    const res = await apiPost(`/school/fee/invoices/${inv.id}/cancel`, { reason });
    if (!res?.ok) return toast(res?.error || 'Failed to cancel invoice', 'error');
    toast('Invoice cancelled', 'success');
    load();
  }

  const summary = data?.summary || {};
  const invoices = useMemo(() => data?.invoices || [], [data]);
  const receipts = data?.receipts || [];

  return (
    <PageShell
      title="Invoices & Collection"
      icon="bi-receipt-cutoff"
      subtitle="Raise invoices, collect fees and track receipts"
      onNavigate={onNavigate}
      actions={
        <>
          <button className="btn btn-sm btn-outline-secondary" onClick={load}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>
          {manager && <button className="btn btn-sm btn-primary" onClick={() => setShowInvoice((v) => !v)}><i className="bi bi-plus-lg me-1"></i>New Invoice</button>}
        </>
      }
    >
      <ErrorBox message={error} onRetry={load} />

      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3"><div className="border rounded p-3 h-100"><div className="text-muted small">Billed</div><div className="fs-5 fw-bold">{inr(summary.billed)}</div><div className="small text-muted">{summary.total_invoices || 0} invoices</div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-3 h-100"><div className="text-muted small">Collected</div><div className="fs-5 fw-bold text-success">{inr(summary.collected)}</div><div className="small text-muted">Today {inr(data?.today?.amount)}</div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-3 h-100"><div className="text-muted small">Outstanding</div><div className="fs-5 fw-bold text-warning">{inr(summary.outstanding)}</div><div className="small text-muted">{summary.partly_paid || 0} partly paid</div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-3 h-100"><div className="text-muted small">Overdue</div><div className="fs-5 fw-bold text-danger">{inr(summary.overdue)}</div><div className="small text-muted">{summary.issued || 0} issued</div></div></div>
      </div>

      <div className="d-flex gap-2 mb-3 flex-wrap">
        <button className="btn btn-sm btn-outline-primary" onClick={() => onNavigate('/school/fees/setup')}><i className="bi bi-gear me-1"></i>Fee Setup</button>
        <button className="btn btn-sm btn-outline-primary" onClick={() => onNavigate('/school/fees/dues')}><i className="bi bi-graph-up me-1"></i>Dues & Follow-up</button>
        <button className="btn btn-sm btn-outline-primary" onClick={() => onNavigate('/school/fees/refunds')}><i className="bi bi-arrow-return-left me-1"></i>Refunds</button>
        <button className="btn btn-sm btn-outline-primary" onClick={() => onNavigate('/school/fees/reconcile')}><i className="bi bi-arrow-left-right me-1"></i>Reconciliation</button>
        <button className="btn btn-sm btn-outline-primary" onClick={() => onNavigate('/school/fees/accounts')}><i className="bi bi-journal-text me-1"></i>Accounts</button>
      </div>

      {showInvoice && manager && (
        <div className="border rounded p-3 mb-3 bg-light">
          <h6 className="fw-bold mb-3">Create invoice</h6>
          <form className="row g-2" onSubmit={createInvoice}>
            <div className="col-md-3"><label className="form-label small">Student ID *</label><input className="form-control form-control-sm" value={invoiceForm.studentId} onChange={(e) => setInvoiceForm({ ...invoiceForm, studentId: e.target.value })} placeholder="Student id" required /></div>
            <div className="col-md-3"><label className="form-label small">Fee head</label><select className="form-select form-select-sm" value={invoiceForm.headId} onChange={(e) => setInvoiceForm({ ...invoiceForm, headId: e.target.value })}><option value="">No head</option>{(data?.heads || []).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
            <div className="col-md-2"><label className="form-label small">Amount *</label><input type="number" min="0.01" step="0.01" className="form-control form-control-sm" value={invoiceForm.amount} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} required /></div>
            <div className="col-md-2"><label className="form-label small">Due date *</label><input type="date" className="form-control form-control-sm" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })} required /></div>
            <div className="col-md-2"><label className="form-label small">Invoice date</label><input type="date" className="form-control form-control-sm" value={invoiceForm.date} onChange={(e) => setInvoiceForm({ ...invoiceForm, date: e.target.value })} /></div>
            <div className="col-md-2"><label className="form-label small">Concession</label><input type="number" min="0" step="0.01" className="form-control form-control-sm" value={invoiceForm.concessionAmount} onChange={(e) => setInvoiceForm({ ...invoiceForm, concessionAmount: e.target.value })} /></div>
            <div className="col-md-2"><label className="form-label small">Fine</label><input type="number" min="0" step="0.01" className="form-control form-control-sm" value={invoiceForm.fineAmount} onChange={(e) => setInvoiceForm({ ...invoiceForm, fineAmount: e.target.value })} /></div>
            <div className="col-12 d-flex gap-2 mt-3"><button className="btn btn-sm btn-primary" disabled={busy}>{busy ? 'SavingÃ¢â‚¬Â¦' : 'Create invoice'}</button><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowInvoice(false)}>Cancel</button></div>
          </form>
        </div>
      )}

      {payFor && (
        <div className="border rounded p-3 mb-3 bg-light">
          <h6 className="fw-bold mb-1">Collect payment Ã¢â‚¬â€ {payFor.number}</h6>
          <div className="small text-muted mb-3">{payFor.first_name} {payFor.last_name} Ã‚Â· Balance {inr(payFor.balance_due)}</div>
          <form className="row g-2" onSubmit={collect}>
            <div className="col-md-2"><label className="form-label small">Amount *</label><input type="number" min="0.01" step="0.01" max={payFor.balance_due} className="form-control form-control-sm" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} required /></div>
            <div className="col-md-2"><label className="form-label small">Mode</label><select className="form-select form-select-sm" value={payForm.mode} onChange={(e) => setPayForm({ ...payForm, mode: e.target.value })}>{['cash', 'cheque', 'dd', 'upi', 'card', 'bank_transfer', 'online'].map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
            <div className="col-md-3"><label className="form-label small">Reference</label><input className="form-control form-control-sm" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} placeholder="Txn / cheque no." /></div>
            <div className="col-md-2"><label className="form-label small">Date</label><input type="date" className="form-control form-control-sm" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} /></div>
            <div className="col-12 d-flex gap-2 mt-3"><button className="btn btn-sm btn-success" disabled={busy}>{busy ? 'SavingÃ¢â‚¬Â¦' : 'Record receipt'}</button><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setPayFor(null)}>Cancel</button></div>
          </form>
        </div>
      )}

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item"><button className={`nav-link ${tab === 'invoices' ? 'active' : ''}`} onClick={() => setTab('invoices')}>Invoices <span className="badge bg-secondary ms-1">{invoices.length}</span></button></li>
        <li className="nav-item"><button className={`nav-link ${tab === 'receipts' ? 'active' : ''}`} onClick={() => setTab('receipts')}>Receipts <span className="badge bg-secondary ms-1">{receipts.length}</span></button></li>
      </ul>

      {loading ? <Loading /> : tab === 'invoices' ? (
        <>
          <div className="d-flex gap-2 mb-2 flex-wrap">
            <input className="form-control form-control-sm" style={{ maxWidth: 260 }} placeholder="Search student or invoiceÃ¢â‚¬Â¦" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
            <select className="form-select form-select-sm" style={{ maxWidth: 170 }} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>{['issued', 'partly_paid', 'paid', 'cancelled', 'written_off'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
            <button className="btn btn-sm btn-outline-primary" onClick={load}>Apply</button>
            <button className="btn btn-sm btn-outline-secondary ms-auto" disabled={!invoices.length} onClick={() => downloadCsv('invoices.csv', [
              { label: 'Invoice', key: 'number' }, { label: 'Student', value: (r) => `${r.first_name} ${r.last_name || ''}`.trim() },
              { label: 'Admission', key: 'admission_no' }, { label: 'Class', key: 'class_name' }, { label: 'Due', value: (r) => fmtDate(r.due_date) },
              { label: 'Total', key: 'total_amount' }, { label: 'Paid', key: 'paid_amount' }, { label: 'Balance', key: 'balance_due' }, { label: 'Status', key: 'status' },
            ], invoices)}><i className="bi bi-download me-1"></i>CSV</button>
          </div>
          {!invoices.length ? <Empty icon="bi-file-earmark-text" text="No invoices match these filters." /> : (
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead><tr><th>Invoice</th><th>Student</th><th>Class</th><th>Due</th><th className="text-end">Total</th><th className="text-end">Paid</th><th className="text-end">Balance</th><th>Status</th><th className="text-end">Action</th></tr></thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className={inv.is_overdue ? 'table-warning' : ''}>
                      <td className="fw-semibold">{inv.number}{inv.is_overdue && <span className="badge bg-danger ms-2">overdue</span>}</td>
                      <td>{inv.first_name} {inv.last_name}<div className="small text-muted">{inv.admission_no}</div></td>
                      <td>{inv.class_name || 'Ã¢â‚¬â€'}{inv.section_name ? ` / ${inv.section_name}` : ''}</td>
                      <td>{fmtDate(inv.due_date)}</td>
                      <td className="text-end">{inr(inv.total_amount)}</td>
                      <td className="text-end text-success">{inr(inv.paid_amount)}</td>
                      <td className="text-end fw-semibold">{inr(inv.balance_due)}</td>
                      <td><Badge tone={STATUS_TONE[inv.status] || 'secondary'}>{(inv.status || '').replace('_', ' ')}</Badge></td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          {manager && !['paid', 'cancelled', 'written_off'].includes(inv.status) && <button className="btn btn-outline-success" onClick={() => { setPayFor(inv); setPayForm({ amount: inv.balance_due, mode: 'cash', reference: '', date: '' }); }}>Collect</button>}
                          {manager && !['paid', 'cancelled', 'written_off'].includes(inv.status) && <button className="btn btn-outline-danger" onClick={() => cancelInvoice(inv)}>Cancel</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        !receipts.length ? <Empty icon="bi-receipt" text="No receipts recorded yet." /> : (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead><tr><th>Receipt</th><th>Student</th><th>Date</th><th>Mode</th><th>Reference</th><th className="text-end">Amount</th><th>Status</th></tr></thead>
              <tbody>{receipts.map((r) => (
                <tr key={r.id}><td className="fw-semibold">{r.number}</td><td>{r.first_name} {r.last_name}<div className="small text-muted">{r.admission_no}</div></td><td>{fmtDate(r.date)}</td><td><span className="badge bg-info">{r.mode}</span></td><td>{r.reference || 'Ã¢â‚¬â€'}</td><td className="text-end text-success">{inr(r.amount)}</td><td><Badge tone={r.status === 'cancelled' ? 'danger' : 'success'}>{r.status}</Badge></td></tr>
              ))}</tbody>
            </table>
          </div>
        )
      )}
    </PageShell>
  );
}

