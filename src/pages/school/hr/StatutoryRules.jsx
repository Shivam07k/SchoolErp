import React, { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Loading, ErrorBox, Badge, canManageHR, fmtDate, downloadCsv } from './shared';

const RULE_CODES = ['PF', 'ESI', 'PT', 'TDS', 'GRATUITY', 'BONUS'];

export default function StatutoryRules({ me, onNavigate }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ rule_code: 'PF', name: '', version: 1, effective_from: '', effective_to: '', config: '{}' });
  const [editingId, setEditingId] = useState(null);
  const [slabs, setSlabs] = useState([]);
  const [currentRuleCode, setCurrentRuleCode] = useState('');
  const manager = canManageHR(me, 'hr.payroll_setup');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const d = await apiGet('/school/hr/payroll/statutory');
      if (d?.ok) setRules(d.rules || []);
      else throw new Error(d?.error || 'Failed to load');
    } catch (err) { setError(err.message || 'Failed to load'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function resetForm() { setForm({ rule_code: 'PF', name: '', version: 1, effective_from: '', effective_to: '', config: '{}' }); setEditingId(null); setShowForm(false); }

  async function submit(e) {
    e.preventDefault();
    try {
      const body = { ...form, version: Number(form.version) || 1, effective_from: form.effective_from || null, effective_to: form.effective_to || null, config: JSON.parse(form.config || '{}') };
      if (editingId) {
        const res = await apiPut(`/school/hr/payroll/statutory/${editingId}`, body);
        if (!res?.ok) throw new Error(res?.error || 'Failed to update');
        toast('Rule updated', 'success');
      } else {
        const res = await apiPost('/school/hr/payroll/statutory', body);
        if (!res?.ok) throw new Error(res?.error || 'Failed to create');
        toast('Rule created', 'success');
      }
      resetForm();
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function loadSlabs(ruleCode) {
    setCurrentRuleCode(ruleCode);
    try {
      const d = await apiGet(`/school/hr/payroll/statutory/${ruleCode}/slabs`);
      if (d?.ok) setSlabs(d.slabs || []);
      else setSlabs([]);
    } catch (err) { setSlabs([]); }
  }

  async function saveSlab(slab) {
    try {
      const body = { min_amount: Number(slab.min_amount), max_amount: slab.max_amount ? Number(slab.max_amount) : null, rate: Number(slab.rate) || 0, fixed_amount: Number(slab.fixed_amount) || 0 };
      if (slab.id) {
        const res = await apiPut(`/school/hr/payroll/statutory/${currentRuleCode}/slabs/${slab.id}`, body);
        if (!res?.ok) throw new Error(res?.error || 'Failed to update');
        toast('Slab updated', 'success');
      } else {
        const res = await apiPost(`/school/hr/payroll/statutory/${currentRuleCode}/slabs`, body);
        if (!res?.ok) throw new Error(res?.error || 'Failed to create');
        toast('Slab created', 'success');
      }
      loadSlabs(currentRuleCode);
    } catch (err) { toast(err.message, 'error'); }
  }

  async function deleteSlab(id) {
    if (!window.confirm('Delete this slab?')) return;
    try {
      const res = await apiPost(`/school/hr/payroll/statutory/${currentRuleCode}/slabs/${id}/delete`, {});
      if (!res?.ok) throw new Error(res?.error || 'Failed');
      toast('Deleted', 'success');
      loadSlabs(currentRuleCode);
    } catch (err) { toast(err.message, 'error'); }
  }

  async function deleteRule(id) {
    if (!window.confirm('Delete this statutory rule?')) return;
    try {
      const res = await apiPost(`/school/hr/payroll/statutory/${id}/delete`, {});
      if (!res?.ok) throw new Error(res?.error || 'Failed');
      toast('Deleted', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  const presets = {
    PF: { wage_ceiling: 15000, employee_rate: 12, employer_rate: 12, wage_base_components: ['BASIC', 'DA'] },
    ESI: { wage_ceiling: 21000, employee_rate: 0.75, employer_rate: 3.25, wage_base_components: ['BASIC', 'DA', 'HRA'] },
    PT: { state: 'MH', slabs: [{ min: 0, max: 7500, monthly: 0 }, { min: 7501, max: 10000, monthly: 175 }, { min: 10001, max: 15000, monthly: 200 }, { min: 15001, max: 20000, monthly: 300 }, { min: 20001, max: 999999999, monthly: 400 }] },
    TDS: { default_regime: 'new' },
    GRATUITY: { rate: 4.81 },
    BONUS: { pay_ceiling: 21000, rate: 8.33 },
  };

  return (
    <PageShell title="Statutory Rules" icon="bi-shield-check" subtitle="Configure PF, ESI, PT, TDS, Gratuity and Bonus rules with versioning" onNavigate={onNavigate} actions={
      <>
        <button className="btn btn-sm btn-outline-secondary" onClick={load}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>
        {manager && <button className="btn btn-sm btn-primary" onClick={() => { setForm({ rule_code: 'PF', name: '', version: 1, effective_from: '', effective_to: '', config: '{}' }); setEditingId(null); setShowForm(true); }}><i className="bi bi-plus-lg me-1"></i>New Rule</button>}
      </>
    }>
      <ErrorBox message={error} onRetry={load} />

      {manager && showForm && (
        <div className="card mb-3">
          <div className="card-header"><h6 className="mb-0">{editingId ? 'Edit' : 'Create'} Statutory Rule</h6></div>
          <div className="card-body">
            <form onSubmit={submit} className="row g-2">
              <div className="col-md-2"><label className="form-label small">Rule Code *</label><select className="form-select form-select-sm" value={form.rule_code} onChange={e => { const code = e.target.value; setForm({...form, rule_code: code, config: JSON.stringify(presets[code] || {}, null, 2) }); }} required><option value="PF">PF</option><option value="ESI">ESI</option><option value="PT">PT</option><option value="TDS">TDS</option><option value="GRATUITY">Gratuity</option><option value="BONUS">Bonus</option></select></div>
              <div className="col-md-3"><label className="form-label small">Name *</label><input className="form-control form-control-sm" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
              <div className="col-md-2"><label className="form-label small">Version *</label><input type="number" className="form-control form-control-sm" value={form.version} onChange={e => setForm({...form, version: Number(e.target.value)})} required /></div>
              <div className="col-md-3"><label className="form-label small">Effective From *</label><input type="date" className="form-control form-control-sm" value={form.effective_from} onChange={e => setForm({...form, effective_from: e.target.value})} required /></div>
              <div className="col-md-2"><label className="form-label small">Effective To</label><input type="date" className="form-control form-control-sm" value={form.effective_to} onChange={e => setForm({...form, effective_to: e.target.value})} /></div>
              <div className="col-12"><label className="form-label small">Config (JSON)</label><textarea className="form-control form-control-sm" rows={4} value={form.config} onChange={e => setForm({...form, config: e.target.value})} placeholder='{"wage_ceiling": 15000, "employee_rate": 12, "employer_rate": 12}' /></div>
              <div className="col-12 d-flex gap-2 mt-3">
                <button type="submit" className="btn btn-sm btn-primary">{editingId ? 'Update' : 'Create'}</button>
                {editingId && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetForm}>Cancel</button>}
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? <Loading /> : !rules.length ? (
        <div className="text-center py-5"><i className="bi bi-shield-check d-block mb-2 text-muted" style={{fontSize: 48}}></i><h5 className="fw-bold">No statutory rules</h5><p className="text-muted small">Create statutory rules for PF, ESI, PT, TDS, Gratuity, Bonus.</p></div>
      ) : (
        <div className="row g-3">
          {RULE_CODES.map(code => {
            const ruleList = rules.filter(r => r.rule_code === code);
            return (
              <div key={code} className="col-12 col-md-6 col-lg-4">
                <div className="card h-100">
                  <div className="card-header d-flex justify-content-between">
                    <span className="fw-bold">{code}</span>
                    {manager && <button className="btn btn-sm btn-outline-primary" onClick={() => { const r = ruleList[0]; if (r) { setForm(r); setEditingId(r.id); setShowForm(true); } }}>Edit</button>}
                  </div>
                  <div className="card-body">
                    {ruleList.map(r => (
                      <div key={r.id} className="mb-2 p-2 border rounded small">
                        <div className="d-flex justify-content-between"><span>v{r.version}</span><span className={r.is_active ? 'text-success' : 'text-muted'}>Effective: {fmtDate(r.effective_from)} Ã¢â‚¬â€œ {fmtDate(r.effective_to)}</span></div>
                        <pre className="mb-0" style={{fontSize: '0.7rem', maxHeight: 120, overflow: 'auto'}}>{JSON.stringify(r.config, null, 2)}</pre>
                        {['PT', 'TDS'].includes(code) && <button className="btn btn-sm btn-outline-info mt-1" onClick={() => loadSlabs(code)}>Manage Slabs</button>}
                        {manager && <button className="btn btn-sm btn-outline-danger mt-1 ms-1" onClick={() => deleteRule(r.id)}>Delete</button>}
                      </div>
                    ))}
                    {!ruleList.length && <div className="text-muted small">No rule defined for {code}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {currentRuleCode && slabs.length >= 0 && (
        <div className="card mt-3">
          <div className="card-header d-flex justify-content-between">
            <span>{currentRuleCode} Slabs</span>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => { setCurrentRuleCode(''); setSlabs([]); }}>Close</button>
          </div>
          <div className="card-body">
            <div className="mb-3">
              <button className="btn btn-sm btn-outline-primary" onClick={() => { const newSlab = { min_amount: '', max_amount: '', rate: 0, fixed_amount: 0, isNew: true }; setSlabs([...slabs, newSlab]); }}>Add Slab</button>
            </div>
            <div className="table-responsive"><table className="table table-sm"><thead><tr><th>Min</th><th>Max</th><th>Rate %</th><th>Fixed</th><th className="text-end">Actions</th></tr></thead><tbody>
              {slabs.map((s, i) => (
                <tr key={s.id || i}>
                  <td><input type="number" step="0.01" className="form-control form-control-sm" value={s.min_amount} onChange={e => { const ns = [...slabs]; ns[i] = {...s, min_amount: e.target.value}; setSlabs(ns); }} /></td>
                  <td><input type="number" step="0.01" className="form-control form-control-sm" value={s.max_amount} onChange={e => { const ns = [...slabs]; ns[i] = {...s, max_amount: e.target.value || null}; setSlabs(ns); }} /></td>
                  <td><input type="number" step="0.01" className="form-control form-control-sm" value={s.rate} onChange={e => { const ns = [...slabs]; ns[i] = {...s, rate: Number(e.target.value)}; setSlabs(ns); }} /></td>
                  <td><input type="number" step="0.01" className="form-control form-control-sm" value={s.fixed_amount} onChange={e => { const ns = [...slabs]; ns[i] = {...s, fixed_amount: Number(e.target.value)}; setSlabs(ns); }} /></td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-success" onClick={() => saveSlab(s)}>Save</button>
                    {s.id && <button className="btn btn-sm btn-outline-danger ms-1" onClick={() => deleteSlab(s.id)}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody></table></div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
