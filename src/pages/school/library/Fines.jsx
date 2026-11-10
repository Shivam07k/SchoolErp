import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate, moneyOrDash } from './shared';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';

export default function Fines() {
  const [fines, setFines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadFines(); }, []);

  async function loadFines() {
    setLoading(true);
    const d = await apiGet('/school/library/fines');
    if (d?.ok) setFines(d.fines || []);
    setLoading(false);
  }

  async function collectFine(fine) {
    const res = await apiPost('/school/library/fines/collect', { fineId: fine.id });
    if (res?.ok) { toast('Fine collected', 'success'); loadFines(); }
    else toast(res?.error || 'Collect failed', 'error');
  }

  async function waiveFine(fine) {
    if (!window.confirm(`Waive fine of ${moneyOrDash(fine.fine_amount)} for ${fine.member_name}?`)) return;
    const res = await apiPost('/school/library/fines/waive', { fineId: fine.id });
    if (res?.ok) { toast('Fine waived', 'success'); loadFines(); }
    else toast(res?.error || 'Waive failed', 'error');
  }

  return (
    <PageShell title="Library Fines" icon="bi-cash-coin" subtitle={`${fines.length} fines`}>
      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Member</th><th>Loan</th><th>Amount</th><th>Days</th><th>Status</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="7"><Loading /></td></tr> :
            fines.length === 0 ? <tr><td colSpan="7"><Empty text="No fines" /></td></tr> :
            fines.map(f => (
              <tr key={f.id}>
                <td>{f.member_name || '—'}</td>
                <td>{f.loan_id || '—'}</td>
                <td>{moneyOrDash(f.fine_amount)}</td>
                <td>{f.fine_days || 0}</td>
                <td><Badge status={f.status || 'pending'}>{f.status || 'pending'}</Badge></td>
                <td>{fmtDate(f.created_at)}</td>
                <td className="text-end no-print">
                  {(f.status === 'pending' || !f.status) && (
                    <>
                      <button className="btn btn-sm btn-outline-success me-1" onClick={() => collectFine(f)}><i className="bi bi-cash"></i> Collect</button>
                      <button className="btn btn-sm btn-outline-warning" onClick={() => waiveFine(f)}><i className="bi bi-slash-circle"></i> Waive</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}