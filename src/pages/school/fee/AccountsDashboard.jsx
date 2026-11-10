import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, ErrorBox, Badge, canManage, fmtDate } from './shared';

const inr = (v) => `Ã¢â€šÂ¹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const TYPES = ['asset', 'liability', 'income', 'expense', 'equity'];

export default function AccountsDashboard({ me, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('accounts');
  const [showAccount, setShowAccount] = useState(false);
  const [showVoucher, setShowVoucher] = useState(false);
  const [accountForm, setAccountForm] = useState({ code: '', name: '', type: 'asset', isCashOrBank: false, openingBalance: '0' });
  const [voucherForm, setVoucherForm] = useState({ date: '', narration: '', debitAccountId: '', creditAccountId: '', amount: '' });
  const [busy, setBusy] = useState(false);
  const manager = canManage(me) || me?.permissions?.includes('fees.manage');

  async function load() {
    setLoading(true); setError('');
    try {
      const d = await apiGet('/school/fee/accounts');
      if (d?.ok) setData(d); else throw new Error(d?.error || 'Failed to load accounts');
    } catch (err) { setError(err.message || 'Failed to load accounts'); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function createAccount(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiPost('/school/fee/accounts', accountForm);
      if (!res?.ok) throw new Error(res?.error || 'Failed to create account');
      toast('Account saved', 'success');
      setShowAccount(false);
      setAccountForm({ code: '', name: '', type: 'asset', isCashOrBank: false, openingBalance: '0' });
      load();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function createVoucher(e) {
    e.preventDefault();
    const amount = Number(voucherForm.amount);
    if (!voucherForm.debitAccountId || !voucherForm.creditAccountId || !(amount > 0)) return toast('Select both accounts and a positive amount', 'error');
    if (voucherForm.debitAccountId === voucherForm.creditAccountId) return toast('Debit and credit accounts must differ', 'error');
    setBusy(true);
    try {
      const res = await apiPost('/school/fee/vouchers', {
        date: voucherForm.date || undefined,
        narration: voucherForm.narration,
        status: 'posted',
        lines: [
          { accountId: voucherForm.debitAccountId, debit: amount, narration: voucherForm.narration },
          { accountId: voucherForm.creditAccountId, credit: amount, narration: voucherForm.narration },
        ],
      });
      if (!res?.ok) throw new Error(res?.error || 'Failed to post voucher');
      toast('Voucher posted', 'success');
      setShowVoucher(false);
      setVoucherForm({ date: '', narration: '', debitAccountId: '', creditAccountId: '', amount: '' });
      load();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  const summary = data?.summary || {};
  const accounts = data?.accounts || [];
  const vouchers = data?.vouchers || [];
  const trial = data?.trial || {};

  return (
    <PageShell
      title="Accounts"
      icon="bi-journal-bookmark"
      subtitle="Chart of accounts, double-entry vouchers and trial balance"
      onNavigate={onNavigate}
      actions={
        <>
          <button className="btn btn-sm btn-outline-secondary" onClick={load}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>
          {manager && <button className="btn btn-sm btn-outline-primary" onClick={() => setShowAccount((v) => !v)}><i className="bi bi-plus-lg me-1"></i>Account</button>}
          {manager && <button className="btn btn-sm btn-primary" onClick={() => setShowVoucher((v) => !v)}><i className="bi bi-journal-plus me-1"></i>Voucher</button>}
        </>
      }
    >
      <ErrorBox message={error} onRetry={load} />
      {loading ? <Loading /> : (
        <>
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-3"><div className="border rounded p-3 h-100"><div className="text-muted small">Accounts</div><div className="fs-5 fw-bold">{summary.accounts || 0}</div><div className="small text-muted">{summary.posted || 0} posted vouchers</div></div></div>
            <div className="col-6 col-md-3"><div className="border rounded p-3 h-100"><div className="text-muted small">Cash & bank</div><div className="fs-5 fw-bold">{inr(summary.cash_and_bank)}</div></div></div>
            <div className="col-6 col-md-3"><div className="border rounded p-3 h-100"><div className="text-muted small">Income balance</div><div className="fs-5 fw-bold text-success">{inr(summary.income_balance)}</div></div></div>
            <div className="col-6 col-md-3"><div className="border rounded p-3 h-100"><div className="text-muted small">Trial balance</div><div className="fs-6 fw-bold">{inr(trial.total_debit)} / {inr(trial.total_credit)}</div><div className="small text-muted">Debit / Credit</div></div></div>
          </div>

          {showAccount && manager && (
            <div className="border rounded p-3 mb-3 bg-light">
              <h6 className="fw-bold mb-3">New account</h6>
              <form className="row g-2" onSubmit={createAccount}>
                <div className="col-md-2"><label className="form-label small">Code *</label><input className="form-control form-control-sm" value={accountForm.code} onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })} required /></div>
                <div className="col-md-4"><label className="form-label small">Name *</label><input className="form-control form-control-sm" value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} required /></div>
                <div className="col-md-3"><label className="form-label small">Type *</label><select className="form-select form-select-sm" value={accountForm.type} onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
                <div className="col-md-2"><label className="form-label small">Opening balance</label><input type="number" step="0.01" className="form-control form-control-sm" value={accountForm.openingBalance} onChange={(e) => setAccountForm({ ...accountForm, openingBalance: e.target.value })} /></div>
                <div className="col-md-1 d-flex align-items-end"><div className="form-check mb-1"><input className="form-check-input" type="checkbox" id="cashbank" checked={accountForm.isCashOrBank} onChange={(e) => setAccountForm({ ...accountForm, isCashOrBank: e.target.checked })} /><label className="form-check-label small" htmlFor="cashbank">Cash/bank</label></div></div>
                <div className="col-12 d-flex gap-2 mt-3"><button className="btn btn-sm btn-primary" disabled={busy}>{busy ? 'SavingÃ¢â‚¬Â¦' : 'Save account'}</button><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowAccount(false)}>Cancel</button></div>
              </form>
            </div>
          )}

          {showVoucher && manager && (
            <div className="border rounded p-3 mb-3 bg-light">
              <h6 className="fw-bold mb-3">Post voucher</h6>
              {accounts.length < 2 ? <div className="text-muted small">Create at least two accounts before posting a voucher.</div> : (
                <form className="row g-2" onSubmit={createVoucher}>
                  <div className="col-md-2"><label className="form-label small">Date</label><input type="date" className="form-control form-control-sm" value={voucherForm.date} onChange={(e) => setVoucherForm({ ...voucherForm, date: e.target.value })} /></div>
                  <div className="col-md-5"><label className="form-label small">Narration</label><input className="form-control form-control-sm" value={voucherForm.narration} onChange={(e) => setVoucherForm({ ...voucherForm, narration: e.target.value })} placeholder="Receipt, payment or journal entry" /></div>
                  <div className="col-md-2"><label className="form-label small">Amount *</label><input type="number" min="0.01" step="0.01" className="form-control form-control-sm" value={voucherForm.amount} onChange={(e) => setVoucherForm({ ...voucherForm, amount: e.target.value })} required /></div>
                  <div className="col-md-3"><label className="form-label small">Debit account *</label><select className="form-select form-select-sm" value={voucherForm.debitAccountId} onChange={(e) => setVoucherForm({ ...voucherForm, debitAccountId: e.target.value })} required><option value="">Select</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.code} Ã¢â‚¬â€ {a.name}</option>)}</select></div>
                  <div className="col-md-3"><label className="form-label small">Credit account *</label><select className="form-select form-select-sm" value={voucherForm.creditAccountId} onChange={(e) => setVoucherForm({ ...voucherForm, creditAccountId: e.target.value })} required><option value="">Select</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.code} Ã¢â‚¬â€ {a.name}</option>)}</select></div>
                  <div className="col-12 d-flex gap-2 mt-3"><button className="btn btn-sm btn-primary" disabled={busy}>{busy ? 'PostingÃ¢â‚¬Â¦' : 'Post voucher'}</button><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowVoucher(false)}>Cancel</button></div>
                </form>
              )}
            </div>
          )}

          <ul className="nav nav-tabs mb-3">
            {[['accounts', `Chart of accounts (${accounts.length})`], ['vouchers', `Vouchers (${vouchers.length})`]].map(([k, label]) => <li className="nav-item" key={k}><button className={`nav-link ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{label}</button></li>)}
          </ul>

          {tab === 'accounts' && (!accounts.length ? <Empty icon="bi-journal-bookmark" text="No accounts in the chart of accounts yet." /> : (
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Code</th><th>Account</th><th>Group</th><th>Type</th><th>Cash / bank</th><th className="text-end">Opening</th><th className="text-end">Current</th></tr></thead><tbody>
              {accounts.map((a) => <tr key={a.id}><td className="fw-semibold">{a.code}</td><td>{a.name}</td><td>{a.group_name || 'Ã¢â‚¬â€'}</td><td><span className="badge bg-info">{a.type}</span></td><td>{a.is_cash_or_bank ? <span className="badge bg-success">Yes</span> : 'Ã¢â‚¬â€'}</td><td className="text-end">{inr(a.opening_balance)}</td><td className="text-end fw-semibold">{inr(a.current_balance)}</td></tr>)}
            </tbody></table></div>
          ))}

          {tab === 'vouchers' && (!vouchers.length ? <Empty icon="bi-journal-text" text="No vouchers posted yet." /> : (
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Voucher</th><th>Date</th><th>Type</th><th>Narration</th><th className="text-end">Debit</th><th className="text-end">Credit</th><th>Status</th><th className="text-end">Lines</th></tr></thead><tbody>
              {vouchers.map((v) => <tr key={v.id}><td className="fw-semibold">{v.number}</td><td>{fmtDate(v.date)}</td><td>{v.type_name || v.source_type}</td><td className="small">{v.narration || 'Ã¢â‚¬â€'}</td><td className="text-end">{inr(v.total_debit)}</td><td className="text-end">{inr(v.total_credit)}</td><td><Badge tone={v.status === 'posted' ? 'success' : v.status === 'draft' ? 'warning' : 'secondary'}>{v.status}</Badge></td><td className="text-end">{v.line_count}</td></tr>)}
            </tbody></table></div>
          ))}
        </>
      )}
    </PageShell>
  );
}

