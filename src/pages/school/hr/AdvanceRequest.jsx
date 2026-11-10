import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Loading, ErrorBox, Badge, canManageHR, fmtDate, moneyOrDash } from './shared';

export default function AdvanceRequest({ me, onNavigate }) {
  const [staffList, setStaffList] = useState([]);
  const [form, setForm] = useState({ staff_id: '', type: 'salary_advance', amount: '', reason: '', installments: 1, interest_rate: 0, interest_type: 'flat' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const manager = canManageHR(me, 'hr.advance_manage');

  useEffect(() => {
    apiGet('/school/hr/staff?status=active').then(d => d?.ok && setStaffList(d.staff || []));
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!form.staff_id || !form.amount || !form.installments) return toast('Fill required fields', 'warning');
    setLoading(true);
    try {
      const body = { staff_id: Number(form.staff_id), type: form.type, amount: Number(form.amount), reason: form.reason, installments: Number(form.installments), interest_rate: Number(form.interest_rate) || 0, interest_type: form.interest_type };
      const res = await apiPost('/school/hr/advances', body);
      if (!res?.ok) throw new Error(res?.error || 'Failed');
      toast('Advance requested', 'success');
      onNavigate('/school/hr/advances');
    } catch (err) { toast(err.message, 'error'); }
    finally { setLoading(false); }
  }

  return (
    <PageShell title="New Advance Request" icon="bi-plus-circle" subtitle="Request a salary advance or loan for a staff member" onNavigate={onNavigate} actions={
      <button className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/hr/advances')}><i className="bi bi-arrow-left me-1"></i>Back</button>
    }>
      <ErrorBox message={error} />

      <div className="card">
        <div className="card-header"><h6 className="mb-0">Advance Details</h6></div>
        <div className="card-body">
          <form onSubmit={submit} className="row g-3">
            <div className="col-md-4"><label className="form-label">Staff *</label><select className="form-select" value={form.staff_id} onChange={e => setForm({...form, staff_id: e.target.value})} required><option value="">Select Staff</option>{staffList.map(s => <option key={s.id} value={s.id}>{s.employee_code} Ã¢â‚¬â€ {s.name}</option>)}</select></div>
            <div className="col-md-4"><label className="form-label">Type *</label><select className="form-select" value={form.type} onChange={e => setForm({...form, type: e.target.value})} required><option value="salary_advance">Salary Advance</option><option value="loan">Loan</option></select></div>
            <div className="col-md-2"><label className="form-label">Amount *</label><input type="number" step="0.01" className="form-control" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required /></div>
            <div className="col-md-2"><label className="form-label">Installments *</label><input type="number" className="form-control" value={form.installments} onChange={e => setForm({...form, installments: Math.max(1, Number(e.target.value))})} required min="1" /></div>
            <div className="col-md-3"><label className="form-label">Interest Rate %</label><input type="number" step="0.01" className="form-control" value={form.interest_rate} onChange={e => setForm({...form, interest_rate: e.target.value})} /></div>
            <div className="col-md-3"><label className="form-label">Interest Type</label><select className="form-select" value={form.interest_type} onChange={e => setForm({...form, interest_type: e.target.value})}><option value="flat">Flat</option><option value="reducing">Reducing</option></select></div>
            <div className="col-12"><label className="form-label">Reason *</label><textarea className="form-control" rows={3} value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} required placeholder="Purpose of advance..."></textarea></div>
            <div className="col-12 d-flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? <span className="spinner-border spinner-border-sm"></span> : 'Submit Request'}</button>
              <button type="button" className="btn btn-outline-secondary" onClick={() => onNavigate('/school/hr/advances')}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </PageShell>
  );
}
