import React, { useEffect, useState } from 'react';
import { apiGet } from '../../../api';
import { PageShell, Empty, Loading, ErrorBox, canManage, fmtDate } from './shared';

const CARDS = [
  ['heads', 'Fee Heads', 'bi-tag', '/school/fees/heads'],
  ['categories', 'Categories', 'bi-people', '/school/fees/categories'],
  ['structures', 'Structures', 'bi-diagram-3', '/school/fees/structures'],
  ['installments', 'Installments', 'bi-calendar3', '/school/fees/installments'],
  ['fine_rules', 'Fine Rules', 'bi-exclamation-triangle', '/school/fees/fine-rules'],
  ['concessions', 'Concessions', 'bi-percent', '/school/fees/concession-types'],
  ['assignments', 'Student Assignments', 'bi-person-gear', '/school/fees/student-assignments'],
  ['families', 'Families', 'bi-house-heart', '/school/fees/families'],
];

export default function FeeSetupDashboard({ me, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const manager = canManage(me) || me?.permissions?.includes('fees.manage');

  async function load() {
    setLoading(true); setError('');
    try {
      const d = await apiGet('/school/fee/setup-overview');
      if (d?.ok) setData(d); else throw new Error(d?.error || 'Failed to load fee setup');
    } catch (err) { setError(err.message || 'Failed to load fee setup'); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const counts = data?.counts || {};

  return (
    <PageShell
      title="Fee Setup"
      icon="bi-gear-wide-connected"
      subtitle="Master data behind invoices: heads, structures, installments and policies"
      onNavigate={onNavigate}
      actions={
        <>
          <button className="btn btn-sm btn-outline-secondary" onClick={load}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>
          {manager && <button className="btn btn-sm btn-primary" onClick={() => onNavigate('/school/fees/heads')}><i className="bi bi-plus-lg me-1"></i>New Head</button>}
        </>
      }
    >
      <ErrorBox message={error} onRetry={load} />
      {loading ? <Loading /> : (
        <>
          <div className="row g-3 mb-4">
            {CARDS.map(([key, label, icon, path]) => (
              <div className="col-6 col-md-3" key={key}>
                <button className="border rounded p-3 w-100 text-start bg-white h-100" onClick={() => onNavigate(path)}>
                  <div className="d-flex justify-content-between align-items-start">
                    <div><div className="text-muted small">{label}</div><div className="fs-4 fw-bold">{counts[key] ?? 0}</div></div>
                    <i className={`bi ${icon} text-primary fs-4`}></i>
                  </div>
                  <div className="small text-primary mt-2">Manage <i className="bi bi-arrow-right"></i></div>
                </button>
              </div>
            ))}
          </div>

          <div className="row g-3">
            <div className="col-lg-6">
              <div className="border rounded h-100">
                <div className="px-3 py-2 border-bottom d-flex justify-content-between align-items-center"><span className="fw-semibold">Recent fee heads</span><button className="btn btn-sm btn-outline-primary" onClick={() => onNavigate('/school/fees/heads')}>Open</button></div>
                {!(data?.recentHeads || []).length ? <Empty icon="bi-tag" text="No fee heads defined yet." /> : (
                  <table className="table table-sm mb-0"><thead><tr><th>Name</th><th>Type</th><th>Active</th></tr></thead><tbody>
                    {data.recentHeads.map((h) => <tr key={h.id}><td className="fw-semibold">{h.name}</td><td><span className="badge bg-info">{h.type}</span></td><td>{h.is_active ? <span className="badge bg-success">Yes</span> : <span className="badge bg-secondary">No</span>}</td></tr>)}
                  </tbody></table>
                )}
              </div>
            </div>
            <div className="col-lg-6">
              <div className="border rounded h-100">
                <div className="px-3 py-2 border-bottom d-flex justify-content-between align-items-center"><span className="fw-semibold">Fee structures</span><button className="btn btn-sm btn-outline-primary" onClick={() => onNavigate('/school/fees/structures')}>Open</button></div>
                {!(data?.structures || []).length ? <Empty icon="bi-diagram-3" text="No fee structures created yet." /> : (
                  <table className="table table-sm mb-0"><thead><tr><th>Structure</th><th>Version</th><th>Effective</th><th className="text-end">Lines</th></tr></thead><tbody>
                    {data.structures.map((s) => <tr key={s.id}><td className="fw-semibold">{s.name}</td><td>v{s.version}</td><td>{fmtDate(s.effective_from)}</td><td className="text-end">{s.line_count}</td></tr>)}
                  </tbody></table>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}

