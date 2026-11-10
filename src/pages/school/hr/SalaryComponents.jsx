import React, { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, ErrorBox, Badge, canManageHR, fmtDate } from './shared';

const TYPE_TONE = { earning: 'success', deduction: 'danger', employer_contribution: 'info' };
const CALC_TONE = { fixed: 'primary', percent: 'warning', formula: 'info' };

export default function SalaryComponents({ me, onNavigate }) {
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', type: 'earning', calculation: 'fixed', formula: '', base_component_id: '', value: '', percent: '', is_taxable: false, is_wage_base: false, is_proratable: true, is_variable: false, account_id: '', sort_order: 0 });
  const [editingId, setEditingId] = useState(null);
  const manager = canManageHR(me);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const d = await apiGet('/school/hr/payroll/components');
      if (d?.ok) setComponents(d.components || []);
      else throw new Error(d?.error || 'Failed to load');
    } catch (err) { setError(err.message || 'Failed to load'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function resetForm() { setForm({ name: '', code: '', type: 'earning', calculation: 'fixed', formula: '', base_component_id: '', value: '', percent: '', is_taxable: false, is_wage_base: false, is_proratable: true, is_variable: false, account_id: '', sort_order: 0 }); setEditingId(null); setShowForm(false); }

  async function submit(e) {
    e.preventDefault();
    try {
      const body = { ...form, value: form.value ? Number(form.value) : null, percent: form.percent ? Number(form.percent) : null, base_component_id: form.base_component_id ? Number(form.base_component_id) : null, account_id: form.account_id ? Number(form.account_id) : null, sort_order: Number(form.sort_order) || 0, is_taxable: form.is_taxable === true, is_wage_base: form.is_wage_base === true, is_proratable: form.is_proratable !== false, is_variable: form.is_variable === true };
      if (editingId) {
        const res = await apiPut(`/school/hr/payroll/components/${editingId}`, body);
        if (!res?.ok) throw new Error(res?.error || 'Failed to update');
        toast('Component updated', 'success');
      } else {
        const res = await apiPost('/school/hr/payroll/components', body);
        if (!res?.ok) throw new Error(res?.error || 'Failed to create');
        toast('Component created', 'success');
      }
      resetForm();
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <PageShell title="Salary Components" icon="bi-tags" subtitle="Define earning, deduction and employer contribution components with formulas and tax settings" onNavigate={onNavigate} actions={
      <>
        <button className="btn btn-sm btn-outline-secondary" onClick={load}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>
        {canManageHR(me) && <button className="btn btn-sm btn-primary" onClick={() => { setForm({ name: '', code: '', type: 'earning', calculation: 'fixed', formula: '', base_component_id: '', value: '', percent: '', is_taxable: false, is_wage_base: false, is_proratable: true, is_variable: false, account_id: '', sort_order: 0 }); setEditingId(null); setShowForm(true); }}><i className="bi bi-plus-lg me-1"></i>New Component</button>}
      </>
    }>
      <ErrorBox message={error} onRetry={load} />

      {showForm && canManageHR(me) && (
        <div className="card mb-3">
          <div className="card-header"><h6 className="mb-0">{editingId ? 'Edit' : 'Create'} Component</h6></div>
          <div className="card-body">
            <form onSubmit={submit} className="row g-2">
              <div className="col-md-3"><label className="form-label small">Name *</label><input className="form-control form-control-sm" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
              <div className="col-md-2"><label className="form-label small">Code *</label><input className="form-control form-control-sm" value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} required /></div>
              <div className="col-md-2"><label className="form-label small">Type *</label><select className="form-select form-select-sm" value={form.type} onChange={e => setForm({...form, type: e.target.value})} required><option value="earning">Earning</option><option value="deduction">Deduction</option><option value="employer_contribution">Employer Contribution</option></select></div>
              <div className="col-md-2"><label className="form-label small">Calculation *</label><select className="form-select form-select-sm" value={form.calculation} onChange={e => setForm({...form, calculation: e.target.value})} required><option value="fixed">Fixed</option><option value="percent">Percent of Base</option><option value="formula">Formula</option></select></div>
              <div className="col-md-3"><label className="form-label small">Base Component (for %)</label><select className="form-select form-select-sm" value={form.base_component_id} onChange={e => setForm({...form, base_component_id: e.target.value})}><option value="">None</option>{components.filter(c => c.calculation !== 'formula').map(c => <option key={c.id} value={c.id}>{c.code}</option>)}</select></div>
              <div className="col-md-2"><label className="form-label small">Value (Fixed)</label><input type="number" step="0.01" className="form-control form-control-sm" value={form.value} onChange={e => setForm({...form, value: e.target.value})} /></div>
              <div className="col-md-2"><label className="form-label small">Percent (for %)</label><input type="number" step="0.01" className="form-control form-control-sm" value={form.percent} onChange={e => setForm({...form, percent: e.target.value})} /></div>
              <div className="col-md-6"><label className="form-label small">Formula (JS)</label><textarea className="form-control form-control-sm" rows={2} value={form.formula} onChange={e => setForm({...form, formula: e.target.value})} placeholder="e.g. min(wage_base, 15000) * 0.12" /></div>
              <div className="col-md-2"><div className="form-check mt-4"><input type="checkbox" className="form-check-input" id="is_taxable" checked={form.is_taxable} onChange={e => setForm({...form, is_taxable: e.target.checked})} /><label className="form-check-label small" htmlFor="is_taxable">Taxable</label></div></div>
              <div className="col-md-2"><div className="form-check mt-4"><input type="checkbox" className="form-check-input" id="is_wage_base" checked={form.is_wage_base} onChange={e => setForm({...form, is_wage_base: e.target.checked})} /><label className="form-check-label small" htmlFor="is_wage_base">Wage Base</label></div></div>
              <div className="col-md-2"><div className="form-check mt-4"><input type="checkbox" className="form-check-input" id="is_proratable" checked={form.is_proratable} onChange={e => setForm({...form, is_proratable: e.target.checked})} /><label className="form-check-label small" htmlFor="is_proratable">Proratable</label></div></div>
              <div className="col-md-2"><div className="form-check mt-4"><input type="checkbox" className="form-check-input" id="is_variable" checked={form.is_variable} onChange={e => setForm({...form, is_variable: e.target.checked})} /><label className="form-check-label small" htmlFor="is_variable">Variable</label></div></div>
              <div className="col-md-2"><label className="form-label small">Account ID</label><input type="number" className="form-control form-control-sm" value={form.account_id} onChange={e => setForm({...form, account_id: e.target.value})} /></div>
              <div className="col-md-2"><label className="form-label small">Sort Order</label><input type="number" className="form-control form-control-sm" value={form.sort_order} onChange={e => setForm({...form, sort_order: Number(e.target.value)})} /></div>
              <div className="col-12 d-flex gap-2 mt-3">
                <button type="submit" className="btn btn-sm btn-primary">{editingId ? 'Update' : 'Create'}</button>
                {editingId && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setForm({ name: '', code: '', type: 'earning', calculation: 'fixed', formula: '', base_component_id: '', value: '', percent: '', is_taxable: false, is_wage_base: false, is_proratable: true, is_variable: false, account_id: '', sort_order: 0 }); setEditingId(null); setShowForm(false); }}>Cancel</button>}
              </div>
            </form>
          </div>
        </div>
      )}

      {!components.length ? <div className="text-center py-5"><i className="bi bi-tags d-block mb-2 text-muted" style={{fontSize: 48}}></i><h5 className="fw-bold">No salary components defined</h5><p className="text-muted small">Create your first salary component to get started.</p></div> : (
        <div className="table-responsive"><table className="table table-sm align-middle mb-0"><thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Calculation</th><th>Taxable</th><th>Wage Base</th><th>Proratable</th><th>Variable</th><th>Account</th><th>Sort</th><th className="text-end">Actions</th></tr></thead><tbody>
          {components.map(c => (
            <tr key={c.id}>
              <td className="fw-semibold">{c.code}</td>
              <td>{c.name}</td>
              <td><Badge tone={TYPE_TONE[c.type] || 'secondary'}>{c.type}</Badge></td>
              <td><Badge tone={CALC_TONE[c.calculation] || 'secondary'}>{c.calculation}</Badge></td>
              <td>{c.is_taxable ? <Badge tone="success">Yes</Badge> : <Badge tone="secondary">No</Badge>}</td>
              <td>{c.is_wage_base ? <Badge tone="warning">Yes</Badge> : <Badge tone="secondary">No</Badge>}</td>
              <td>{c.is_proratable ? <Badge tone="success">Yes</Badge> : <Badge tone="secondary">No</Badge>}</td>
              <td>{c.is_variable ? <Badge tone="info">Yes</Badge> : <Badge tone="secondary">No</Badge>}</td>
              <td>{c.account_id || 'Ã¢â‚¬â€'}</td>
              <td>{c.sort_order}</td>
              <td className="text-end">
                {canManageHR(me) && <button className="btn btn-sm btn-outline-primary" onClick={() => { setForm(c); setEditingId(c.id); setShowForm(true); }}>Edit</button>}
                {canManageHR(me) && <button className="btn btn-sm btn-outline-danger ms-1" onClick={() => { if (window.confirm('Delete?')) apiPost(`/school/hr/payroll/components/${c.id}/delete`, {}).then(r => r?.ok && toast('Deleted', 'success') && load()); }}>Delete</button>}
              </td>
            </tr>
          ))}
        </tbody></table></div>
      )}
    </PageShell>
  );
}
