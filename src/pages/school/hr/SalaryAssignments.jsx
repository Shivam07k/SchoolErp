import React, { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Loading, ErrorBox, Badge, canManageHR, fmtDate, downloadCsv } from './shared';

export default function SalaryAssignments({ me, onNavigate }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ staff_id: '', structure_id: '', overrides: '{}', effective_from: '', effective_to: '', approved_by: '' });
  const [editingId, setEditingId] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [structures, setStructures] = useState([]);
  const manager = canManageHR(me, 'hr.payroll_assign');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const d = await apiGet('/school/hr/payroll/assignments');
      if (d?.ok) setAssignments(d.assignments || []);
      else throw new Error(d?.error || 'Failed to load');
    } catch (err) { setError(err.message || 'Failed to load'); }
    finally { setLoading(false); }
  }

  async function loadLookups() {
    try {
      const [s, st] = await Promise.all([
        apiGet('/school/hr/staff?status=active'),
        apiGet('/school/hr/payroll/structures'),
      ]);
      if (s?.ok) setStaffList(s.staff || []);
      if (st?.ok) setStructures(st.structures || []);
    } catch (err) { console.warn('Lookups failed', err); }
  }

  useEffect(() => { load(); loadLookups(); }, []);

  function resetForm() { setForm({ staff_id: '', structure_id: '', overrides: '{}', effective_from: '', effective_to: '', approved_by: '' }); setEditingId(null); setShowForm(false); }

  async function submit(e) {
    e.preventDefault();
    try {
      const body = { ...form, staff_id: Number(form.staff_id), structure_id: Number(form.structure_id), overrides: JSON.parse(form.overrides || '{}'), effective_from: form.effective_from || null, effective_to: form.effective_to || null };
      if (editingId) {
        const res = await apiPut(`/school/hr/payroll/assignments/${editingId}`, body);
        if (!res?.ok) throw new Error(res?.error || 'Failed to update');
        toast('Assignment updated', 'success');
      } else {
        const res = await apiPost('/school/hr/payroll/assignments', body);
        if (!res?.ok) throw new Error(res?.error || 'Failed to create');
        toast('Assignment created', 'success');
      }
      resetForm();
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function deleteAssign(id) {
    if (!window.confirm('Delete this assignment?')) return;
    try {
      const res = await apiPost(`/school/hr/payroll/assignments/${id}/delete`, {});
      if (!res?.ok) throw new Error(res?.error || 'Failed');
      toast('Deleted', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <PageShell title="Staff Salary Assignments" icon="bi-person-badge" subtitle="Assign salary structures to staff with effective dates and overrides" onNavigate={onNavigate} actions={
      <>
        <button className="btn btn-sm btn-outline-secondary" onClick={load}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>
        {manager && <button className="btn btn-sm btn-primary" onClick={() => { setForm({ staff_id: '', structure_id: '', overrides: '{}', effective_from: '', effective_to: '', approved_by: '' }); setEditingId(null); setShowForm(true); }}><i className="bi bi-plus-lg me-1"></i>New Assignment</button>}
      </>
    }>
      <ErrorBox message={error} onRetry={load} />

      {manager && showForm && (
        <div className="card mb-3">
          <div className="card-header"><h6 className="mb-0">{editingId ? 'Edit' : 'Create'} Assignment</h6></div>
          <div className="card-body">
            <form onSubmit={submit} className="row g-2">
              <div className="col-md-3"><label className="form-label small">Staff *</label><select className="form-select form-select-sm" value={form.staff_id} onChange={e => setForm({...form, staff_id: e.target.value})} required><option value="">Select</option>{staffList.map(s => <option key={s.id} value={s.id}>{s.employee_code} - {s.name}</option>)}</select></div>
              <div className="col-md-3"><label className="form-label small">Structure *</label><select className="form-select form-select-sm" value={form.structure_id} onChange={e => setForm({...form, structure_id: e.target.value})} required><option value="">Select</option>{structures.map(st => <option key={st.id} value={st.id}>{st.name} v{st.version} ({fmtDate(st.effective_from)})</option>)}</select></div>
              <div className="col-md-2"><label className="form-label small">Effective From *</label><input type="date" className="form-control form-control-sm" value={form.effective_from} onChange={e => setForm({...form, effective_from: e.target.value})} required /></div>
              <div className="col-md-2"><label className="form-label small">Effective To</label><input type="date" className="form-control form-control-sm" value={form.effective_to} onChange={e => setForm({...form, effective_to: e.target.value})} /></div>
              <div className="col-md-6"><label className="form-label small">Overrides (JSON)</label><textarea className="form-control form-control-sm" rows={2} value={form.overrides} onChange={e => setForm({...form, overrides: e.target.value})} placeholder='{"BASIC": 50000, "HRA": 20000}' /></div>
              <div className="col-md-3"><label className="form-label small">Approved By</label><input className="form-control form-control-sm" value={form.approved_by} onChange={e => setForm({...form, approved_by: e.target.value})} /></div>
              <div className="col-12 d-flex gap-2 mt-3">
                <button type="submit" className="btn btn-sm btn-primary">{editingId ? 'Update' : 'Create'}</button>
                {editingId && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetForm}>Cancel</button>}
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? <Loading /> : !assignments.length ? (
        <div className="text-center py-5"><i className="bi bi-person-badge d-block mb-2 text-muted" style={{fontSize: 48}}></i><h5 className="fw-bold">No salary assignments</h5><p className="text-muted small">Assign salary structures to staff to process payroll.</p></div>
      ) : (
        <div className="table-responsive"><table className="table table-sm align-middle mb-0"><thead><tr><th>Staff</th><th>Structure</th><th>Effective From</th><th>Effective To</th><th>Approved By</th><th>Overrides</th><th className="text-end">Actions</th></tr></thead><tbody>
          {assignments.map(a => (
            <tr key={a.id}>
              <td>{a.employee_code} Ã¢â‚¬â€ {a.staff_name}</td>
              <td>{a.structure_name} v{a.version}</td>
              <td>{fmtDate(a.effective_from)}</td>
              <td>{fmtDate(a.effective_to)}</td>
              <td>{a.approved_by || 'Ã¢â‚¬â€'}</td>
              <td className="text-muted small">{a.overrides && Object.keys(a.overrides).length ? JSON.stringify(a.overrides) : 'Ã¢â‚¬â€'}</td>
              <td className="text-end">
                {manager && <button className="btn btn-sm btn-outline-primary" onClick={() => { setForm(a); setEditingId(a.id); setShowForm(true); }}>Edit</button>}
                {manager && <button className="btn btn-sm btn-outline-danger ms-1" onClick={() => deleteAssign(a.id)}>Delete</button>}
              </td>
            </tr>
          ))}
        </tbody></table></div>
      )}
    </PageShell>
  );
}
