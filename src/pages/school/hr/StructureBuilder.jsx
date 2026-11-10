import React, { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Loading, ErrorBox, Badge, canManageHR, downloadCsv } from './shared';

const TYPE_TONE = { earning: 'success', deduction: 'danger', employer_contribution: 'info' };
const CALC_TONE = { fixed: 'primary', percent: 'warning', formula: 'info' };

export default function StructureBuilder({ me, onNavigate, structureId }) {
  const [structure, setStructure] = useState(null);
  const [lines, setLines] = useState([]);
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showLineForm, setShowLineForm] = useState(false);
  const [lineForm, setLineForm] = useState({ component_id: '', value: '', percent: '', formula: '', condition: '', sort_order: 0 });
  const [editingLineId, setEditingLineId] = useState(null);
  const manager = canManageHR(me, 'hr.payroll_setup');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [s, l, c] = await Promise.all([
        apiGet(`/school/hr/payroll/structures/${structureId}`),
        apiGet(`/school/hr/payroll/structures/${structureId}/lines`),
        apiGet('/school/hr/payroll/components'),
      ]);
      if (s?.ok) setStructure(s.structure);
      if (l?.ok) setLines(l.lines || []);
      if (c?.ok) setComponents(c.components || []);
      else throw new Error(s?.error || l?.error || c?.error || 'Failed to load');
    } catch (err) { setError(err.message || 'Failed to load'); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (structureId) load(); }, [structureId]);

  function resetLineForm() { setLineForm({ component_id: '', value: '', percent: '', formula: '', condition: '', sort_order: 0 }); setEditingLineId(null); setShowLineForm(false); }

  async function addLine(e) {
    e.preventDefault();
    try {
      const body = { component_id: Number(lineForm.component_id), value: lineForm.value ? Number(lineForm.value) : null, percent: lineForm.percent ? Number(lineForm.percent) : null, formula: lineForm.formula || null, condition: lineForm.condition || null, sort_order: Number(lineForm.sort_order) || 0 };
      if (editingLineId) {
        const res = await apiPut(`/school/hr/payroll/structures/lines/${editingLineId}`, body);
        if (!res?.ok) throw new Error(res?.error || 'Failed to update');
        toast('Line updated', 'success');
      } else {
        const res = await apiPost(`/school/hr/payroll/structures/${structureId}/lines`, body);
        if (!res?.ok) throw new Error(res?.error || 'Failed to create');
        toast('Line added', 'success');
      }
      resetLineForm();
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function deleteLine(id) {
    if (!window.confirm('Delete this line?')) return;
    try {
      const res = await apiPost(`/school/hr/payroll/structures/lines/${id}/delete`, {});
      if (!res?.ok) throw new Error(res?.error || 'Failed');
      toast('Deleted', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function validateStructure() {
    try {
      const res = await apiPost('/school/hr/payroll/validate-structure', { structure_id: Number(structureId) });
      if (!res?.ok) throw new Error(res?.error || 'Validation failed');
      toast(res.valid ? 'Structure is valid' : 'Structure has errors: ' + res.errors.join(', '), res.valid ? 'success' : 'warning');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function cloneStructure() {
    if (!window.confirm('Clone this structure?')) return;
    try {
      const res = await apiPost(`/school/hr/payroll/structures/${structureId}/clone`, { name: '' });
      if (!res?.ok) throw new Error(res?.error || 'Failed to clone');
      toast('Structure cloned', 'success');
      onNavigate(`/school/hr/payroll/structures/${res.structure.id}`);
    } catch (err) { toast(err.message, 'error'); }
  }

  if (loading) return <PageShell title="Structure Builder" icon="bi-diagram-3" subtitle="Loading..." onNavigate={onNavigate}><Loading /></PageShell>;
  if (error) return <PageShell title="Structure Builder" icon="bi-diagram-3" subtitle="Error" onNavigate={onNavigate}><ErrorBox message={error} onRetry={load} /></PageShell>;
  if (!structure) return <PageShell title="Structure Builder" icon="bi-diagram-3" subtitle="Not found" onNavigate={onNavigate}><div className="text-center py-5">Structure not found</div></PageShell>;

  return (
    <PageShell title="Structure Builder" icon="bi-diagram-3" subtitle={`${structure.name} v${structure.version}`} onNavigate={onNavigate} actions={
      <>
        <button className="btn btn-sm btn-outline-secondary" onClick={load}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>
        {manager && <button className="btn btn-sm btn-outline-primary" onClick={validateStructure}><i className="bi bi-shield-check me-1"></i>Validate</button>}
        {manager && <button className="btn btn-sm btn-outline-info" onClick={cloneStructure}><i className="bi bi-files me-1"></i>Clone</button>}
        <button className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/hr/payroll/structures')}><i className="bi bi-arrow-left me-1"></i>Back</button>
      </>
    }>
      <ErrorBox message={error} onRetry={load} />

      <div className="card mb-3">
        <div className="card-header"><h6 className="mb-0">Structure Details</h6></div>
        <div className="card-body">
          <div className="row g-2 text-muted small">
            <div className="col-md-3"><strong>Name:</strong> {structure.name}</div>
            <div className="col-md-2"><strong>Version:</strong> {structure.version}</div>
            <div className="col-md-3"><strong>Effective:</strong> {structure.effective_from ? new Date(structure.effective_from).toLocaleDateString('en-IN') : 'Ã¢â‚¬â€'}</div>
            <div className="col-md-2"><strong>To:</strong> {structure.effective_to ? new Date(structure.effective_to).toLocaleDateString('en-IN') : 'Ã¢â‚¬â€'}</div>
            <div className="col-md-2"><strong>Active:</strong> {structure.is_active ? <Badge tone="success">Yes</Badge> : <Badge tone="secondary">No</Badge>}</div>
          </div>
        </div>
      </div>

      {manager && showLineForm && (
        <div className="card mb-3">
          <div className="card-header"><h6 className="mb-0">{editingLineId ? 'Edit' : 'Add'} Structure Line</h6></div>
          <div className="card-body">
            <form onSubmit={addLine} className="row g-2">
              <div className="col-md-3"><label className="form-label small">Component *</label><select className="form-select form-select-sm" value={lineForm.component_id} onChange={e => setLineForm({...lineForm, component_id: e.target.value})} required><option value="">Select</option>{components.map(c => <option key={c.id} value={c.id}>{c.code} Ã¢â‚¬â€ {c.name} ({c.type})</option>)}</select></div>
              <div className="col-md-2"><label className="form-label small">Value (Fixed)</label><input type="number" step="0.01" className="form-control form-control-sm" value={lineForm.value} onChange={e => setLineForm({...lineForm, value: e.target.value})} /></div>
              <div className="col-md-2"><label className="form-label small">Percent</label><input type="number" step="0.01" className="form-control form-control-sm" value={lineForm.percent} onChange={e => setLineForm({...lineForm, percent: e.target.value})} /></div>
              <div className="col-md-5"><label className="form-label small">Formula (JS)</label><input className="form-control form-control-sm" value={lineForm.formula} onChange={e => setLineForm({...lineForm, formula: e.target.value})} placeholder="e.g. min(wage_base, 15000) * 0.12" /></div>
              <div className="col-md-4"><label className="form-label small">Condition</label><input className="form-control form-control-sm" value={lineForm.condition} onChange={e => setLineForm({...lineForm, condition: e.target.value})} placeholder="e.g. designation='Principal'" /></div>
              <div className="col-md-2"><label className="form-label small">Sort Order</label><input type="number" className="form-control form-control-sm" value={lineForm.sort_order} onChange={e => setLineForm({...lineForm, sort_order: Number(e.target.value)})} /></div>
              <div className="col-12 d-flex gap-2 mt-3">
                <button type="submit" className="btn btn-sm btn-primary">{editingLineId ? 'Update' : 'Add'}</button>
                {editingLineId && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetLineForm}>Cancel</button>}
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card mb-3">
        <div className="card-header d-flex justify-content-between">
          <h6 className="mb-0">Structure Lines ({lines.length})</h6>
          {manager && <button className="btn btn-sm btn-primary" onClick={() => { setLineForm({ component_id: '', value: '', percent: '', formula: '', condition: '', sort_order: 0 }); setEditingLineId(null); setShowLineForm(true); }}><i className="bi bi-plus-lg me-1"></i>Add Line</button>}
        </div>
        <div className="card-body p-0">
          {lines.length ? (
            <div className="table-responsive"><table className="table table-sm mb-0"><thead className="table-light"><tr>
              <th>#</th><th>Component</th><th>Type</th><th>Calc</th><th>Value</th><th>%</th><th>Formula</th><th>Condition</th><th>Wage Base</th><th className="text-end">Actions</th>
            </tr></thead><tbody>
              {lines.map((l, i) => (
                <tr key={l.id}>
                  <td>{l.sort_order || i + 1}</td>
                  <td>{l.component_code} Ã¢â‚¬â€ {l.component_name}</td>
                  <td><Badge tone={TYPE_TONE[l.component_type] || 'secondary'}>{l.component_type}</Badge></td>
                  <td><Badge tone={CALC_TONE[l.calculation] || 'secondary'}>{l.calculation}</Badge></td>
                  <td>{l.value !== null && l.value !== undefined ? Number(l.value).toLocaleString('en-IN') : 'Ã¢â‚¬â€'}</td>
                  <td>{l.percent !== null && l.percent !== undefined ? Number(l.percent).toFixed(2) + '%' : 'Ã¢â‚¬â€'}</td>
                  <td className="text-muted small" style={{maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{l.formula || 'Ã¢â‚¬â€'}</td>
                  <td className="text-muted small">{l.condition || 'Ã¢â‚¬â€'}</td>
                  <td>{l.is_wage_base ? <Badge tone="warning">Yes</Badge> : <Badge tone="secondary">No</Badge>}</td>
                  <td className="text-end">
                    {manager && <button className="btn btn-sm btn-outline-primary" onClick={() => { setLineForm(l); setEditingLineId(l.id); setShowLineForm(true); }}>Edit</button>}
                    {manager && <button className="btn btn-sm btn-outline-danger ms-1" onClick={() => deleteLine(l.id)}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody></table></div>
          ) : (
            <div className="text-center py-4 text-muted">No lines defined. Add components to this structure.</div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h6 className="mb-0">Available Components (for reference)</h6></div>
        <div className="card-body p-0">
          <div className="table-responsive"><table className="table table-sm mb-0"><thead className="table-light"><tr>
            <th>Code</th><th>Name</th><th>Type</th><th>Calc</th><th>Taxable</th><th>Wage Base</th><th>Proratable</th><th>Variable</th>
          </tr></thead><tbody>
            {components.map(c => (
              <tr key={c.id}>
                <td className="fw-semibold">{c.code}</td><td>{c.name}</td>
                <td><Badge tone={TYPE_TONE[c.type] || 'secondary'}>{c.type}</Badge></td>
                <td><Badge tone={CALC_TONE[c.calculation] || 'secondary'}>{c.calculation}</Badge></td>
                <td>{c.is_taxable ? <Badge tone="success">Yes</Badge> : <Badge tone="secondary">No</Badge>}</td>
                <td>{c.is_wage_base ? <Badge tone="warning">Yes</Badge> : <Badge tone="secondary">No</Badge>}</td>
                <td>{c.is_proratable ? <Badge tone="success">Yes</Badge> : <Badge tone="secondary">No</Badge>}</td>
                <td>{c.is_variable ? <Badge tone="info">Yes</Badge> : <Badge tone="secondary">No</Badge>}</td>
              </tr>
            ))}
          </tbody></table></div>
        </div>
      </div>
    </PageShell>
  );
}
