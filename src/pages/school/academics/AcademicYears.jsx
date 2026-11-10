import React, { useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../../../api';
import {
  Badge, Empty, ErrorBox, Loading, PageShell, canManage, fmtDate, perform,
} from './shared';

const emptyForm = { id: null, name: '', startDate: '', endDate: '', isClosed: false };

export default function AcademicYears({ me, onNavigate, onRefreshMe }) {
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const manager = canManage(me);

  async function load() {
    const result = await apiGet('/school/academic-years');
    if (!result?.ok) throw new Error(result?.error || 'Could not load academic years');
    setYears(result.years || []);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    load()
      .catch((err) => { if (active) setError(err.message || 'Could not load academic years'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function refresh() {
    await load();
    try { await onRefreshMe?.(); } catch (err) { /* the shell refresh is a convenience */ }
  }

  async function submit(event) {
    event.preventDefault();
    if (!manager) return;
    const name = form.name.trim();
    if (!name) return window.alert('Academic year name is required');
    if (!form.startDate || !form.endDate) return window.alert('Start and end dates are required');
    if (form.endDate < form.startDate) return window.alert('End date cannot be before the start date');
    setBusy(true);
    try {
      const body = { name, startDate: form.startDate, endDate: form.endDate, isClosed: form.isClosed };
      const result = form.id
        ? await perform(() => apiPut(`/school/academic-years/${form.id}`, body), { success: 'Academic year updated', refresh })
        : await perform(() => apiPost('/school/academic-years', body), { success: 'Academic year created', refresh });
      if (result) setForm(emptyForm);
    } finally {
      setBusy(false);
    }
  }

  async function action(year, verb, success) {
    if (!manager) return;
    if (!window.confirm(`${success} ${year.name}?`)) return;
    setBusy(true);
    try {
      await perform(() => apiPost(`/school/academic-years/${year.id}/${verb}`, {}), { success, refresh });
    } finally {
      setBusy(false);
    }
  }

  async function remove(year) {
    if (!manager) return;
    if (!window.confirm(`Delete ${year.name}? This only succeeds when no records use the year.`)) return;
    setBusy(true);
    try {
      await perform(() => apiDelete(`/school/academic-years/${year.id}`), { success: 'Academic year deleted', refresh });
    } finally {
      setBusy(false);
    }
  }

  const activeYear = years.find((year) => year.is_active);

  return (
    <PageShell
      title="Academic Years"
      icon="bi-calendar3"
      subtitle="One active year at a time. Closing a year freezes new records but keeps history readable."
      onNavigate={onNavigate}
      actions={(
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { load().catch((err) => setError(err.message)); }} disabled={loading || busy}>
          <i className="bi bi-arrow-clockwise me-1"></i>Refresh
        </button>
      )}
    >
      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Years</div><div className="fs-5 fw-bold">{years.length}</div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Active year</div><div className="fs-6 fw-bold">{activeYear?.name || 'None'}</div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Closed</div><div className="fs-5 fw-bold">{years.filter((year) => year.is_closed).length}</div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Unused</div><div className="fs-5 fw-bold">{years.filter((year) => !year.enrollments && !year.allocations && !year.homework).length}</div></div></div>
      </div>

      <ErrorBox message={error} onRetry={() => { setError(''); setLoading(true); load().catch((err) => setError(err.message)).finally(() => setLoading(false)); }} />

      <div className="row g-3">
        <div className="col-lg-4">
          <div className="border rounded p-3">
            <h6 className="fw-bold">{form.id ? 'Edit academic year' : 'Add academic year'}</h6>
            <form onSubmit={submit}>
              <label className="form-label small">Name *</label>
              <input className="form-control form-control-sm mb-2" placeholder={`e.g. ${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(2)}`} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} disabled={!manager || busy} />

              <label className="form-label small">Start date *</label>
              <input type="date" className="form-control form-control-sm mb-2" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} disabled={!manager || busy} />

              <label className="form-label small">End date *</label>
              <input type="date" className="form-control form-control-sm mb-2" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} disabled={!manager || busy} />

              {form.id && (
                <div className="form-check form-switch mb-2">
                  <input className="form-check-input" type="checkbox" id="year-closed" checked={form.isClosed} onChange={(event) => setForm({ ...form, isClosed: event.target.checked })} disabled={!manager || busy} />
                  <label className="form-check-label small" htmlFor="year-closed">Closed for new records</label>
                </div>
              )}

              <div className="d-flex gap-2">
                <button className="btn btn-sm btn-primary" disabled={!manager || busy}><i className="bi bi-check2 me-1"></i>{form.id ? 'Save' : 'Create'}</button>
                {form.id && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setForm(emptyForm)} disabled={busy}>Cancel</button>}
              </div>
              {!manager && <div className="small text-muted mt-2">You have read-only access to academics.</div>}
            </form>
          </div>
        </div>

        <div className="col-lg-8">
          {loading ? <Loading text="Loading academic yearsÃ¢â‚¬Â¦" /> : years.length === 0 ? (
            <Empty icon="bi-calendar3" text="No academic years yet. Create the first year before enrolling students." />
          ) : (
            <div className="table-responsive border rounded">
              <table className="table table-sm mb-0 align-middle">
                <thead><tr><th>Year</th><th>Dates</th><th>Usage</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
                <tbody>
                  {years.map((year) => (
                    <tr key={year.id}>
                      <td className="fw-semibold">{year.name}</td>
                      <td className="text-nowrap">{fmtDate(year.start_date)} Ã¢â€ â€™ {fmtDate(year.end_date)}</td>
                      <td className="small text-muted">
                        {year.enrollments} enrollment(s) Ã‚Â· {year.allocations} allocation(s) Ã‚Â· {year.homework} homework
                      </td>
                      <td>
                        {year.is_active && <Badge tone="success">Active</Badge>}
                        {year.is_closed && <Badge tone="dark">Closed</Badge>}
                        {!year.is_active && !year.is_closed && <Badge tone="secondary">Open</Badge>}
                      </td>
                      <td className="text-end">
                        <div className="d-flex gap-1 justify-content-end flex-wrap">
                          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setForm({
                            id: year.id, name: year.name,
                            startDate: String(year.start_date).slice(0, 10),
                            endDate: String(year.end_date).slice(0, 10),
                            isClosed: Boolean(year.is_closed),
                          })} disabled={!manager || busy}><i className="bi bi-pencil"></i></button>
                          {!year.is_active && !year.is_closed && (
                            <button type="button" className="btn btn-sm btn-outline-success" onClick={() => action(year, 'activate', 'Activate')} disabled={!manager || busy}>Activate</button>
                          )}
                          {!year.is_closed && (
                            <button type="button" className="btn btn-sm btn-outline-dark" onClick={() => action(year, 'close', 'Close')} disabled={!manager || busy}>Close</button>
                          )}
                          {year.is_closed && (
                            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => action(year, 'reopen', 'Reopen')} disabled={!manager || busy}>Reopen</button>
                          )}
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remove(year)} disabled={!manager || busy}><i className="bi bi-trash"></i></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="small text-muted mt-2">
            A year is protected from date edits and deletion as soon as enrollments, allocations, homework or exams reference it.
            Use Close instead.
          </div>
        </div>
      </div>
    </PageShell>
  );
}

