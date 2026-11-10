import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Loading, ErrorBox, Badge, canManageHR, fmtDate, downloadCsv, PAYROLL_STATUS_TONE } from './shared';

const STEPS = [
  { key: 'checks', label: 'Checks', icon: 'bi-shield-check' },
  { key: 'compute', label: 'Compute', icon: 'bi-cpu' },
  { key: 'preview', label: 'Preview & Variance', icon: 'bi-graph-up' },
  { key: 'adjustments', label: 'Adjustments', icon: 'bi-sliders' },
  { key: 'approve', label: 'Approve & Lock', icon: 'bi-lock' },
];

export default function PayrollWizard({ me, onNavigate, runId }) {
  const [run, setRun] = useState(null);
  const [step, setStep] = useState('checks');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checks, setChecks] = useState(null);
  const [preview, setPreview] = useState(null);
  const [adjustments, setAdjustments] = useState([]);
  const [newAdj, setNewAdj] = useState({ staff_id: '', component_id: '', amount: '', reason: '', type: 'other', period_start: '', period_end: '' });
  const [staffList, setStaffList] = useState([]);
  const [components, setComponents] = useState([]);
  const manager = canManageHR(me, 'hr.payroll_manage');
  const viewer = canViewHR(me, 'hr.payroll_view');

  async function loadRun() {
    setLoading(true);
    setError('');
    try {
      const d = await apiGet(`/school/hr/payroll/runs/${runId}`);
      if (d?.ok) { setRun(d.run); }
      else throw new Error(d?.error || 'Failed to load run');
    } catch (err) { setError(err.message || 'Failed to load'); }
    finally { setLoading(false); }
  }

  async function loadChecks() {
    try {
      const d = await apiGet(`/school/hr/payroll/runs/${runId}/checks`);
      if (d?.ok) { setChecks(d.checks); setChecks((c) => ({ ...c, counts: d.counts })); }
      else throw new Error(d?.error || 'Failed to load checks');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function loadPreview() {
    try {
      const d = await apiGet(`/school/hr/payroll/runs/${runId}/preview`);
      if (d?.ok) { setPreview({ payslips: d.payslips, prevRun: d.prevRun }); }
      else throw new Error(d?.error || 'Failed to load preview');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function loadAdjustments() {
    try {
      const d = await apiGet(`/school/hr/payroll/runs/${runId}/adjustments`);
      if (d?.ok) setAdjustments(d.adjustments || []);
    } catch (err) { toast(err.message, 'error'); }
  }

  async function loadLookups() {
    try {
      const [s, c] = await Promise.all([
        apiGet('/school/hr/staff?status=active'),
        apiGet('/school/hr/payroll/components'),
      ]);
      if (s?.ok) setStaffList(s.staff || []);
      if (c?.ok) setComponents(c.components || []);
    } catch (err) { console.warn('Lookups failed', err); }
  }

  useEffect(() => {
    loadRun();
    loadLookups();
  }, [runId]);

  useEffect(() => {
    if (step === 'checks') loadChecks();
    if (step === 'preview') loadPreview();
    if (step === 'adjustments') loadAdjustments();
  }, [step]);

  async function doCompute() {
    try {
      const res = await apiPost(`/school/hr/payroll/runs/${runId}/compute`, {});
      if (!res?.ok) throw new Error(res?.error || 'Compute failed');
      toast(`Computed ${res.computed} payslips`, 'success');
      loadRun();
      setStep('preview');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function doApprove() {
    if (!window.confirm('Approve this payroll run?')) return;
    try {
      const res = await apiPost(`/school/hr/payroll/runs/${runId}/approve`, {});
      if (!res?.ok) throw new Error(res?.error || 'Approve failed');
      toast('Approved', 'success');
      loadRun();
      setStep('approve');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function doLock() {
    if (!window.confirm('Lock this payroll run?')) return;
    try {
      const res = await apiPost(`/school/hr/payroll/runs/${runId}/lock`, {});
      if (!res?.ok) throw new Error(res?.error || 'Lock failed');
      toast('Locked', 'success');
      loadRun();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function addAdjustment(e) {
    e.preventDefault();
    try {
      const res = await apiPost(`/school/hr/payroll/runs/${runId}/adjustments`, newAdj);
      if (!res?.ok) throw new Error(res?.error || 'Failed to add');
      toast('Adjustment added', 'success');
      setNewAdj({ staff_id: '', component_id: '', amount: '', reason: '', type: 'other', period_start: '', period_end: '' });
      loadAdjustments();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function deleteAdjustment(id) {
    if (!window.confirm('Delete this adjustment?')) return;
    try {
      const res = await apiPost(`/school/hr/payroll/adjustments/${id}/delete`, {});
      if (!res?.ok) throw new Error(res?.error || 'Failed');
      toast('Deleted', 'success');
      loadAdjustments();
    } catch (err) { toast(err.message, 'error'); }
  }

  function statusBadge(s) {
    return <Badge tone={PAYROLL_STATUS_TONE[s] || 'secondary'}>{s}</Badge>;
  }

  if (loading) return <PageShell title="Payroll Wizard" icon="bi-magic" subtitle={run?.period_name} onNavigate={onNavigate}><Loading /></PageShell>;

  if (error) return <PageShell title="Payroll Wizard" icon="bi-magic" subtitle={run?.period_name} onNavigate={onNavigate}><ErrorBox message={error} onRetry={loadRun} /></PageShell>;

  if (!run) return <PageShell title="Payroll Wizard" icon="bi-magic" subtitle="Run not found" onNavigate={onNavigate}><div className="text-center py-5">Run not found</div></PageShell>;

  const currentIdx = STEPS.findIndex(s => s.key === step);
  const canProceed = {
    checks: run.status !== 'draft',
    compute: run.status === 'draft',
    preview: ['computed', 'previewed', 'approved', 'locked', 'paid', 'posted'].includes(run.status),
    adjustments: ['computed', 'previewed', 'approved'].includes(run.status),
    approve: ['computed', 'previewed'].includes(run.status),
  }[step] || false;

  return (
    <PageShell title="Payroll Wizard" icon="bi-magic" subtitle={`${run.period_name} Ã¢â‚¬â€ ${run.status}`} onNavigate={onNavigate} actions={
      <div className="d-flex gap-1 flex-wrap">
        {STEPS.map((s, i) => (
          <button key={s.key} className={`btn btn-sm ${step === s.key ? 'btn-primary' : 'btn-outline-secondary'}`} disabled={!viewer || (i > currentIdx && !canProceed)} onClick={() => setStep(s.key)}>
            <i className={`bi ${s.icon} me-1`}></i>{s.label}
          </button>
        ))}
      </div>
    }>
      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2 text-muted small">
            <div className="col-md-3"><strong>Period:</strong> {fmtDate(run.period_start)} Ã¢â‚¬â€œ {fmtDate(run.period_end)}</div>
            <div className="col-md-3"><strong>Basis/Wage Days:</strong> {run.basis_days} / {run.wage_base_days}</div>
            <div className="col-md-3"><strong>Status:</strong> {statusBadge(run.status)}</div>
            <div className="col-md-3"><strong>Rule Versions:</strong> {run.rule_versions ? JSON.stringify(run.rule_versions) : 'Ã¢â‚¬â€'}</div>
          </div>
        </div>
      </div>

      {step === 'checks' && (
        <div className="row g-3">
          {checks?.counts && (
            <div className="col-12">
              <div className="card"><div className="card-header small">Check Summary</div><div className="card-body">
                <div className="row g-2 text-center">
                  {Object.entries(checks.counts).map(([k, v]) => (
                    <div key={k} className="col-6 col-md-3"><div className="fw-bold fs-5">{v}</div><div className="text-muted small">{k.replace(/_/g, ' ')}</div></div>
                  ))}
                </div>
              </div></div>
            </div>
          )}
          {checks && Object.entries(checks).filter(([k]) => k !== 'counts').map(([key, items]) => (
            <div key={key} className="col-12">
              <div className="card"><div className="card-header small">{key.replace(/_/g, ' ')} ({items?.length || 0})</div>
                <div className="card-body p-0">{items?.length ? (
                  <div className="table-responsive"><table className="table table-sm mb-0"><thead><tr>
                    <th>ID</th><th>Name</th><th>Code</th>
                    {key === 'newJoiners' && <th>Joining</th>}
                    {key === 'leavers' && <th>Exit</th>}
                    {key === 'openAdjustments' && <> <th>Type</th><th>Amount</th><th>Reason</th> </>}
                  </tr></thead><tbody>
                    {items.map(i => (
                      <tr key={i.id}><td>{i.id}</td><td>{i.name}</td><td>{i.employee_code}</td>
                        {key === 'newJoiners' && <td>{fmtDate(i.joining_date)}</td>}
                        {key === 'leavers' && <td>{fmtDate(i.exit_date)}</td>}
                        {key === 'openAdjustments' && <>
                          <td>{i.type}</td><td>{i.amount}</td><td>{i.reason}</td>
                        </>}
                      </tr>
                    ))}
                  </tbody></table></div>
                ) : <div className="text-center py-3 text-muted small">No issues</div>}</div>
              </div>
            </div>
          ))}
          {run.status === 'draft' && manager && <div className="col-12 text-end"><button className="btn btn-success" onClick={doCompute}><i className="bi bi-cpu me-1"></i>Compute Payroll</button></div>}
        </div>
      )}

      {step === 'compute' && (
        <div className="text-center py-5">
          <i className="bi bi-cpu d-block mb-3" style={{fontSize: 48}}></i>
          <h5>Ready to compute</h5>
          <p className="text-muted small">Click <strong>Compute Payroll</strong> on the Checks step to calculate all payslips.</p>
        </div>
      )}

      {step === 'preview' && preview && (
        <div>
          {preview.prevRun && <div className="alert alert-info small mb-3">Comparing with previous run: {preview.prevRun.period_name} ({preview.prevRun.id})</div>}
          <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr>
            <th>Code</th><th>Name</th><th className="text-end">Gross</th><th className="text-end">Prev Gross</th><th className="text-end">Var</th><th className="text-end">%</th>
            <th className="text-end">Net</th><th className="text-end">Prev Net</th><th className="text-end">Var</th><th className="text-end">%</th>
          </tr></thead><tbody>
            {preview.payslips.map(p => (
              <tr key={p.staff_id} style={{background: n0(p.net_pct_change) > 20 ? '#fff3cd' : n0(p.net_pct_change) < -20 ? '#f8d7da' : ''}}>
                <td>{p.employee_code}</td><td>{p.staff_name}</td>
                <td className="text-end">{p.gross_earnings?.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                <td className="text-end">{p.prev_gross?.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                <td className="text-end">{p.gross_variance?.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                <td className="text-end">{p.gross_pct_change?.toFixed(2)}%</td>
                <td className="text-end">{p.net_pay?.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                <td className="text-end">{p.prev_net?.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                <td className="text-end">{p.net_variance?.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                <td className="text-end">{p.net_pct_change?.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody></table></div>
          {manager && <div className="text-end mt-3"><button className="btn btn-primary" onClick={() => setStep('adjustments')}><i className="bi bi-sliders me-1"></i>Manage Adjustments</button></div>}
        </div>
      )}

      {step === 'adjustments' && (
        <div>
          <div className="card mb-3">
            <div className="card-header"><h6 className="mb-0">Add Adjustment</h6></div>
            <div className="card-body">
              <form onSubmit={addAdjustment} className="row g-2">
                <div className="col-md-2"><label className="form-label small">Staff</label><select className="form-select form-select-sm" value={newAdj.staff_id} onChange={e => setNewAdj({...newAdj, staff_id: e.target.value})} required><option value="">Select</option>{staffList.map(s => <option key={s.id} value={s.id}>{s.employee_code} - {s.name}</option>)}</select></div>
                <div className="col-md-2"><label className="form-label small">Component</label><select className="form-select form-select-sm" value={newAdj.component_id} onChange={e => setNewAdj({...newAdj, component_id: e.target.value})} required><option value="">Select</option>{components.map(c => <option key={c.id} value={c.id}>{c.code} ({c.type})</option>)}</select></div>
                <div className="col-md-2"><label className="form-label small">Amount</label><input type="number" step="0.01" className="form-control form-control-sm" value={newAdj.amount} onChange={e => setNewAdj({...newAdj, amount: e.target.value})} required /></div>
                <div className="col-md-2"><label className="form-label small">Type</label><select className="form-select form-select-sm" value={newAdj.type} onChange={e => setNewAdj({...newAdj, type: e.target.value})}><option value="arrears">Arrears</option><option value="bonus">Bonus</option><option value="recovery">Recovery</option><option value="reimbursement">Reimbursement</option><option value="advance_recovery">Advance Recovery</option><option value="other">Other</option></select></div>
                <div className="col-md-2"><label className="form-label small">Period Start</label><input type="date" className="form-control form-control-sm" value={newAdj.period_start} onChange={e => setNewAdj({...newAdj, period_start: e.target.value})} /></div>
                <div className="col-md-2"><label className="form-label small">Period End</label><input type="date" className="form-control form-control-sm" value={newAdj.period_end} onChange={e => setNewAdj({...newAdj, period_end: e.target.value})} /></div>
                <div className="col-md-4"><label className="form-label small">Reason</label><input className="form-control form-control-sm" value={newAdj.reason} onChange={e => setNewAdj({...newAdj, reason: e.target.value})} required /></div>
                <div className="col-12 d-flex gap-2"><button type="submit" className="btn btn-sm btn-primary">Add</button></div>
              </form>
            </div>
          </div>
          <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Staff</th><th>Component</th><th>Type</th><th className="text-end">Amount</th><th>Reason</th><th>Status</th><th className="text-end">Actions</th></tr></thead><tbody>
            {adjustments.map(a => (
              <tr key={a.id}>
                <td>{a.staff_name} ({a.employee_code})</td><td>{a.component_code}</td><td>{a.type}</td>
                <td className="text-end">{n0(a.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td><td>{a.reason}</td>
                <td><Badge tone={a.status === 'applied' ? 'success' : a.status === 'cancelled' ? 'danger' : 'warning'}>{a.status}</Badge></td>
                <td className="text-end">{a.status === 'pending' && manager && <button className="btn btn-sm btn-outline-danger" onClick={() => deleteAdjustment(a.id)}>Delete</button>}</td>
              </tr>
            ))}
          </tbody></table></div>
          {manager && run.status !== 'draft' && <div className="text-end mt-3"><button className="btn btn-warning" onClick={() => setStep('approve')}><i className="bi bi-lock me-1"></i>Approve & Lock</button></div>}
        </div>
      )}

      {step === 'approve' && (
        <div className="card">
          <div className="card-body text-center py-5">
            <i className="bi bi-lock d-block mb-3" style={{fontSize: 48}}></i>
            <h5>Approve & Lock Payroll</h5>
            <p className="text-muted small mb-4">Review the preview and adjustments before approving.</p>
            {run.status === 'computed' || run.status === 'previewed' ? (
              <div className="d-flex gap-2 justify-content-center">
                {manager && <button className="btn btn-warning btn-lg" onClick={doApprove}><i className="bi bi-check-circle me-2"></i>Approve</button>}
              </div>
            ) : run.status === 'approved' ? (
              <div className="d-flex gap-2 justify-content-center">
                {manager && <button className="btn btn-primary btn-lg" onClick={doLock}><i className="bi bi-lock-fill me-2"></i>Lock</button>}
              </div>
            ) : (
              <Badge tone="success" style={{fontSize: 16}}>{run.status}</Badge>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}
