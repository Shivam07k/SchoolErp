import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, moneyOrDash, fmtDate } from './shared';
import { apiGet } from '../../../api';
import { toast } from '../../../toast';

export default function Reports() {
  const [circulation, setCirculation] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadCirculation(), loadOverdue()]).finally(() => setLoading(false));
  }, []);

  async function loadCirculation() {
    const d = await apiGet('/school/library/reports/circulation');
    if (d?.ok) setCirculation(d.circulation || []);
  }

  async function loadOverdue() {
    const d = await apiGet('/school/library/reports/overdue');
    if (d?.ok) setOverdue(d.overdue || []);
  }

  return (
    <PageShell title="Library Reports" icon="bi-graph-up">
      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header"><h6 className="mb-0">Circulation (Last 24 Months)</h6></div>
            <div className="card-body">
              {loading ? <Loading /> :
              circulation.length === 0 ? <Empty text="No circulation data" icon="bi-bar-chart" /> :
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead><tr><th>Month</th><th>Loans</th></tr></thead>
                  <tbody>
                    {circulation.map(c => (
                      <tr key={c.month}><td>{fmtDate(c.month)}</td><td>{c.loans}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>}
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card">
            <div className="card-header"><h6 className="mb-0">Overdue Books</h6></div>
            <div className="card-body">
              {loading ? <Loading /> :
              overdue.length === 0 ? <Empty text="No overdue books" icon="bi-book" /> :
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead><tr><th>Title</th><th>Member</th><th>Barcode</th><th>Due</th><th>Days Overdue</th></tr></thead>
                  <tbody>
                    {overdue.map(o => (
                      <tr key={o.id}>
                        <td>{o.title || 'Ã¢â‚¬â€'}</td>
                        <td>{o.member_name || 'Ã¢â‚¬â€'}</td>
                        <td><code>{o.barcode || 'Ã¢â‚¬â€'}</code></td>
                        <td>{fmtDate(o.due_at)}</td>
                        <td className="text-danger fw-bold">
                          {o.due_at ? Math.ceil((new Date() - new Date(o.due_at)) / 86400000) : 'Ã¢â‚¬â€'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
