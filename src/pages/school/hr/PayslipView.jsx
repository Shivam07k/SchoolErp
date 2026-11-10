import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Loading, ErrorBox, Badge, canManageHR, canViewHR, fmtDate, moneyOrDash } from './shared';

export default function PayslipView({ me, onNavigate, payslipId }) {
  const [payslip, setPayslip] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const manager = canManageHR(me, 'hr.payroll_payslip');
  const viewer = canViewHR(me, 'hr.payroll_view');

  async function load() {
    if (!payslipId) return;
    setLoading(true);
    setError('');
    try {
      const d = await apiGet(`/school/hr/payroll/payslips/${payslipId}`);
      if (d?.ok) { setPayslip(d.payslip); setLines(d.lines || []); }
      else throw new Error(d?.error || 'Failed to load');
    } catch (err) { setError(err.message || 'Failed to load'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [payslipId]);

  async function genPdf() {
    try {
      const res = await apiPost(`/school/hr/payroll/payslips/${payslipId}/generate-pdf`, {});
      if (!res?.ok) throw new Error(res?.error || 'Failed');
      toast('PDF generated', 'success');
      if (res.pdf_url) window.open(res.pdf_url, '_blank');
    } catch (err) { toast(err.message, 'error'); }
  }

  function printPayslip() {
    window.open(`/api/school/hr/payroll/payslips/${payslipId}/print`, '_blank');
  }

  if (loading) return <PageShell title="Payslip" icon="bi-file-earmark-text" subtitle="Loading..." onNavigate={onNavigate}><Loading /></PageShell>;
  if (error) return <PageShell title="Payslip" icon="bi-file-earmark-text" subtitle="Error" onNavigate={onNavigate}><ErrorBox message={error} onRetry={load} /></PageShell>;
  if (!payslip) return <PageShell title="Payslip" icon="bi-file-earmark-text" subtitle="Not found" onNavigate={onNavigate}><div className="text-center py-5">Payslip not found</div></PageShell>;

  const money = (n) => n === null || n === undefined ? 'Ã¢â‚¬â€' : Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  return (
    <PageShell title="Payslip" icon="bi-file-earmark-text" subtitle={`${payslip.staff_name} Ã¢â‚¬â€ ${payslip.period_name}`} onNavigate={onNavigate} actions={
      <>
        {manager && <button className="btn btn-sm btn-outline-primary" onClick={genPdf}><i className="bi bi-file-earmark-pdf me-1"></i>Generate PDF</button>}
        <button className="btn btn-sm btn-outline-secondary" onClick={printPayslip}><i className="bi bi-printer me-1"></i>Print</button>
      </>
    }>
      <ErrorBox message={error} onRetry={load} />

      <div className="row g-3 mb-4">
        <div className="col-md-3"><div className="small text-muted">Employee</div><div className="fw-bold">{payslip.staff_name} ({payslip.employee_code})</div></div>
        <div className="col-md-3"><div className="small text-muted">Period</div><div className="fw-bold">{payslip.period_name}</div></div>
        <div className="col-md-2"><div className="small text-muted">Paid / LOP Days</div><div className="fw-bold">{payslip.paid_days} / {payslip.lop_days}</div></div>
        <div className="col-md-2"><div className="small text-muted">Status</div><div className="fw-bold">{payslip.status}</div></div>
        <div className="col-md-2"><div className="small text-muted">Run</div><div className="fw-bold">{payslip.run_status}</div></div>
      </div>

      <div className="table-responsive"><table className="table table-sm align-middle"><thead className="table-light"><tr>
        <th>Component</th><th>Type</th><th className="text-end">Amount</th><th>Details</th>
      </tr></thead><tbody>
        {lines.filter(l => l.component_type !== 'employer_contribution').map(l => (
          <tr key={l.id}>
            <td>{l.component_name} <span className="text-muted small">({l.component_code})</span></td>
            <td><Badge tone={l.component_type === 'earning' ? 'success' : 'danger'}>{l.component_type}</Badge></td>
            <td className="text-end">{money(l.amount)}</td>
            <td className="text-muted small">
              {l.calculation_details ? (
                <pre style={{margin: 0, fontSize: '0.7rem'}}>{JSON.stringify(l.calculation_details, null, 2)}</pre>
              ) : 'Ã¢â‚¬â€'}
            </td>
          </tr>
        ))}
        <tr className="table-active fw-bold">
          <td>Gross Earnings</td><td></td><td className="text-end">{money(payslip.gross_earnings)}</td><td></td>
        </tr>
        <tr className="table-active fw-bold">
          <td>Total Deductions</td><td></td><td className="text-end">{money(payslip.total_deductions)}</td><td></td>
        </tr>
        <tr className="table-success fw-bold fs-5">
          <td>Net Pay</td><td></td><td className="text-end">{money(payslip.net_pay)}</td><td></td>
        </tr>
        {lines.some(l => l.component_type === 'employer_contribution') && (
          <tr className="table-info fw-bold">
            <td>Employer Contributions</td><td></td><td className="text-end">{money(payslip.employer_contrib)}</td><td></td>
          </tr>
        )}
      </tbody></table></div>

      {lines.some(l => l.component_type === 'employer_contribution') && (
        <div className="mt-3"><h6>Employer Contribution Breakdown</h6>
          <div className="table-responsive"><table className="table table-sm"><thead><tr><th>Component</th><th className="text-end">Amount</th></tr></thead><tbody>
            {lines.filter(l => l.component_type === 'employer_contribution').map(l => (
              <tr key={l.id}><td>{l.component_name} ({l.component_code})</td><td className="text-end">{money(l.amount)}</td></tr>
            ))}
          </tbody></table></div>
        </div>
      )}
    </PageShell>
  );
}
