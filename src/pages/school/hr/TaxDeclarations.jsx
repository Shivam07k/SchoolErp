import React, { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Loading, ErrorBox, Badge, canManageHR, canViewHR, fmtDate, downloadCsv } from './shared';

export default function TaxDeclarations({ me, onNavigate }) {
  const [declarations, setDeclarations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ staff_id: '', financial_year_id: '', regime: 'new', section_80c: '', section_80d: '', section_80ccd1b: '', section_24b: '', professional_tax: '', other_deductions: '{}' });
  const [editingId, setEditingId] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [fyList, setFyList] = useState([]);
  const [fyDraft, setFyDraft] = useState(null);
  const [savingFy, setSavingFy] = useState(false);
  const manager = canManageHR(me, 'hr.payroll_setup');
  const viewer = canViewHR(me, 'hr.payroll_view');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const d = await apiGet('/school/hr/payroll/tax-declarations');
      if (d?.ok) setDeclarations(d.declarations || []);
      else throw new Error(d?.error || 'Failed to load');
    } catch (err) { setError(err.message || 'Failed to load'); }
    finally { setLoading(false); }
  }

  async function loadLookups() {
    try {
      const [s, fy] = await Promise.all([
        apiGet('/school/hr/staff?status=active'),
        apiGet('/school/hr/payroll/financial-years'),
      ]);
      if (s?.ok) setStaffList(s.staff || []);
      if (fy?.ok) setFyList(fy.years || []);
    } catch (err) { console.warn('Lookups failed', err); }
  }

  useEffect(() => { load(); loadLookups(); }, []);

  async function createFinancialYear(e) {
    e.preventDefault();
    if (!fyDraft) return;
    setSavingFy(true);
    try {
      const res = await apiPost('/school/hr/payroll/financial-years', fyDraft);
      if (!res?.ok) throw new Error(res?.error || 'Could not create financial year');
      toast('Financial year created', 'success');
      setFyList((list) => [...list, res.year].sort((a, b) => String(b.name).localeCompare(String(a.name))));
      setForm((f) => ({ ...f, financial_year_id: String(res.year.id) }));
      setFyDraft(null);
    } catch (err) { toast(err.message, 'error'); }
    finally { setSavingFy(false); }
  }

  function resetForm() { setForm({ staff_id: '', financial_year_id: '', regime: 'new', section_80c: '', section_80d: '', section_80ccd1b: '', section_24b: '', professional_tax: '', other_deductions: '{}' }); setEditingId(null); setShowForm(false); }

  async function submit(e) {
    e.preventDefault();
    try {
      const body = { staff_id: Number(form.staff_id), financial_year_id: Number(form.financial_year_id), regime: form.regime, section_80c: Number(form.section_80c) || 0, section_80d: Number(form.section_80d) || 0, section_80ccd1b: Number(form.section_80ccd1b) || 0, section_24b: Number(form.section_24b) || 0, professional_tax: Number(form.professional_tax) || 0, other_deductions: JSON.parse(form.other_deductions || '{}') };
      if (editingId) {
        const res = await apiPut(`/school/hr/payroll/tax-declarations/${editingId}`, body);
        if (!res?.ok) throw new Error(res?.error || 'Failed to update');
        toast('Declaration updated', 'success');
      } else {
        const res = await apiPost('/school/hr/payroll/tax-declarations', body);
        if (!res?.ok) throw new Error(res?.error || 'Failed to create');
        toast('Declaration created', 'success');
      }
      resetForm();
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function deleteDecl(id) {
    if (!window.confirm('Delete this declaration?')) return;
    try {
      const res = await apiPost(`/school/hr/payroll/tax-declarations/${id}/delete`, {});
      if (!res?.ok) throw new Error(res?.error || 'Failed');
      toast('Deleted', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <PageShell title="Tax Declarations" icon="bi-calculator" subtitle="Staff tax regime and investment declarations for TDS computation" onNavigate={onNavigate} actions={
      <>
        <button className="btn btn-sm btn-outline-secondary" onClick={load}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>
        {manager && <button className="btn btn-sm btn-outline-secondary" onClick={() => setFyDraft({ name: '2026-27', start_date: '2026-04-01', end_date: '2027-03-31' })}><i className="bi bi-calendar-plus me-1"></i>Add FY</button>}
        {manager && <button className="btn btn-sm btn-primary" onClick={() => { setForm({ staff_id: '', financial_year_id: '', regime: 'new', section_80c: '', section_80d: '', section_80ccd1b: '', section_24b: '', professional_tax: '', other_deductions: '{}' }); setEditingId(null); setShowForm(true); }}><i className="bi bi-plus-lg me-1"></i>New Declaration</button>}
      </>
    }>
      <ErrorBox message={error} onRetry={load} />

      {manager && fyDraft && (
        <div className="card mb-3 border-info">
          <div className="card-header d-flex align-items-center justify-content-between">
            <h6 className="mb-0"><i className="bi bi-calendar-plus me-1"></i>Add Financial Year</h6>
            <button type="button" className="btn btn-sm btn-link text-muted p-0" onClick={() => setFyDraft(null)}><i className="bi bi-x-lg"></i></button>
          </div>
          <div className="card-body">
            <form onSubmit={createFinancialYear} className="row g-2 align-items-end">
              <div className="col-md-3"><label className="form-label small">Name *</label><input className="form-control form-control-sm" value={fyDraft.name} onChange={e => setFyDraft({ ...fyDraft, name: e.target.value })} placeholder="2026-27" required /></div>
              <div className="col-md-3"><label className="form-label small">Start Date *</label><input type="date" className="form-control form-control-sm" value={fyDraft.start_date} onChange={e => setFyDraft({ ...fyDraft, start_date: e.target.value })} required /></div>
              <div className="col-md-3"><label className="form-label small">End Date *</label><input type="date" className="form-control form-control-sm" value={fyDraft.end_date} onChange={e => setFyDraft({ ...fyDraft, end_date: e.target.value })} required /></div>
              <div className="col-md-3 d-flex gap-2">
                <button type="submit" className="btn btn-sm btn-primary" disabled={savingFy}>{savingFy ? 'SavingÃ¢â‚¬Â¦' : 'Save FY'}</button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setFyDraft(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {manager && showForm && (
        <div className="card mb-3">
          <div className="card-header"><h6 className="mb-0">{editingId ? 'Edit' : 'Create'} Tax Declaration</h6></div>
          <div className="card-body">
            <form onSubmit={submit} className="row g-2">
              <div className="col-md-3"><label className="form-label small">Staff *</label><select className="form-select form-select-sm" value={form.staff_id} onChange={e => setForm({...form, staff_id: e.target.value})} required><option value="">Select</option>{staffList.map(s => <option key={s.id} value={s.id}>{s.employee_code} - {s.name}</option>)}</select></div>
              <div className="col-md-3"><label className="form-label small">Financial Year *</label><select className="form-select form-select-sm" value={form.financial_year_id} onChange={e => setForm({...form, financial_year_id: e.target.value})} required><option value="">Select</option>{fyList.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
              <div className="col-md-2"><label className="form-label small">Regime *</label><select className="form-select form-select-sm" value={form.regime} onChange={e => setForm({...form, regime: e.target.value})} required><option value="new">New</option><option value="old">Old</option></select></div>
              <div className="col-md-2"><label className="form-label small">80C</label><input type="number" step="0.01" className="form-control form-control-sm" value={form.section_80c} onChange={e => setForm({...form, section_80c: e.target.value})} placeholder="150000" /></div>
              <div className="col-md-2"><label className="form-label small">80D</label><input type="number" step="0.01" className="form-control form-control-sm" value={form.section_80d} onChange={e => setForm({...form, section_80d: e.target.value})} placeholder="25000" /></div>
              <div className="col-md-2"><label className="form-label small">80CCD(1B)</label><input type="number" step="0.01" className="form-control form-control-sm" value={form.section_80ccd1b} onChange={e => setForm({...form, section_80ccd1b: e.target.value})} placeholder="50000" /></div>
              <div className="col-md-2"><label className="form-label small">24B</label><input type="number" step="0.01" className="form-control form-control-sm" value={form.section_24b} onChange={e => setForm({...form, section_24b: e.target.value})} placeholder="200000" /></div>
              <div className="col-md-2"><label className="form-label small">Prof Tax</label><input type="number" step="0.01" className="form-control form-control-sm" value={form.professional_tax} onChange={e => setForm({...form, professional_tax: e.target.value})} /></div>
              <div className="col-md-6"><label className="form-label small">Other Deductions (JSON)</label><input className="form-control form-control-sm" value={form.other_deductions} onChange={e => setForm({...form, other_deductions: e.target.value})} placeholder='{"donation_80g": 10000}' /></div>
              <div className="col-12 d-flex gap-2 mt-3">
                <button type="submit" className="btn btn-sm btn-primary">{editingId ? 'Update' : 'Create'}</button>
                {editingId && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetForm}>Cancel</button>}
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? <Loading /> : !declarations.length ? (
        <div className="text-center py-5"><i className="bi bi-calculator d-block mb-2 text-muted" style={{fontSize: 48}}></i><h5 className="fw-bold">No tax declarations</h5><p className="text-muted small">Add tax declarations for staff to enable accurate TDS computation.</p></div>
      ) : (
        <div className="table-responsive"><table className="table table-sm align-middle mb-0"><thead><tr><th>Staff</th><th>FY</th><th>Regime</th><th className="text-end">80C</th><th className="text-end">80D</th><th className="text-end">80CCD(1B)</th><th className="text-end">24B</th><th className="text-end">Prof Tax</th><th>Status</th><th className="text-end">Actions</th></tr></thead><tbody>
          {declarations.map(d => (
            <tr key={d.id}>
              <td>{d.employee_code} Ã¢â‚¬â€ {d.staff_name}</td>
              <td>{d.fy_name}</td>
              <td><Badge tone={d.regime === 'new' ? 'info' : 'warning'}>{d.regime.toUpperCase()}</Badge></td>
              <td className="text-end">{Number(d.section_80c || 0).toLocaleString('en-IN')}</td>
              <td className="text-end">{Number(d.section_80d || 0).toLocaleString('en-IN')}</td>
              <td className="text-end">{Number(d.section_80ccd1b || 0).toLocaleString('en-IN')}</td>
              <td className="text-end">{Number(d.section_24b || 0).toLocaleString('en-IN')}</td>
              <td className="text-end">{Number(d.professional_tax || 0).toLocaleString('en-IN')}</td>
              <td><Badge tone={d.status === 'verified' ? 'success' : d.status === 'submitted' ? 'info' : d.status === 'rejected' ? 'danger' : 'secondary'}>{d.status}</Badge></td>
              <td className="text-end">
                {manager && <button className="btn btn-sm btn-outline-primary" onClick={() => { setForm(d); setEditingId(d.id); setShowForm(true); }}>Edit</button>}
                {manager && <button className="btn btn-sm btn-outline-danger ms-1" onClick={() => deleteDecl(d.id)}>Delete</button>}
              </td>
            </tr>
          ))}
        </tbody></table></div>
      )}
    </PageShell>
  );
}
