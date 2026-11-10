import React, { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, ErrorBox, fmtDate, canManage, downloadCsv } from './shared';

export default function Terms({ me, onNavigate }) {
  const [terms, setTerms] = useState([]);
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ academicYearId: '', name: '', startDate: '', endDate: '', weightage: '' });
  const [editingId, setEditingId] = useState(null);
  const manager = canManage(me);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [termRes, yearRes] = await Promise.all([
        apiGet('/school/terms'),
        apiGet('/school/academic-years'),
      ]);
      if (!termRes?.ok) throw new Error(termRes?.error || 'Could not load terms');
      if (!yearRes?.ok) throw new Error(yearRes?.error || 'Could not load academic years');
      setTerms(termRes.terms || []);
      setYears(yearRes.academicYears || []);
    } catch (err) {
      setError(err.message || 'Failed to load terms');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function resetForm() {
    setForm({ academicYearId: '', name: '', startDate: '', endDate: '', weightage: '' });
    setEditingId(null);
  }

  function startEdit(term) {
    setForm({
      academicYearId: String(term.academic_year_id),
      name: term.name,
      startDate: term.start_date ? term.start_date.slice(0, 10) : '',
      endDate: term.end_date ? term.end_date.slice(0, 10) : '',
      weightage: term.weightage || '',
    });
    setEditingId(term.id);
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.academicYearId || !form.name || !form.startDate || !form.endDate) {
      return toast('All fields are required', 'warning');
    }
    const body = {
      academicYearId: Number(form.academicYearId),
      name: form.name,
      startDate: form.startDate,
      endDate: form.endDate,
      weightage: Number(form.weightage) || 0,
    };
    try {
      if (editingId) {
        await apiPut(`/school/terms/${editingId}`, body);
        toast('Term updated', 'success');
      } else {
        await apiPost('/school/terms', body);
        toast('Term created', 'success');
      }
      resetForm();
      load();
    } catch (err) {
      toast(err.message || 'Failed to save term', 'error');
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this term? This will also delete associated exams.')) return;
    try {
      await apiPut(`/school/terms/${id}`, { isActive: false }); // soft delete via update
      toast('Term deactivated', 'success');
      load();
    } catch (err) {
      toast(err.message || 'Failed to delete term', 'error');
    }
  }

  return (
    <PageShell
      title="Terms"
      icon="bi-calendar3"
      subtitle="Academic terms within a year (Term 1, Half Yearly, Annual)"
      onNavigate={onNavigate}
      actions={
        <button className="btn btn-sm btn-primary" onClick={resetForm}>
          <i className="bi bi-plus-lg me-1"></i>Add Term
        </button>
      }
    >
      <ErrorBox message={error} onRetry={load} />
      {loading ? <Loading /> : (
        <div className="row g-3">
          <div className="col-lg-4">
            <div className="border rounded p-3">
              <h6 className="fw-bold mb-3">{editingId ? 'Edit Term' : 'Add Term'}</h6>
              <form onSubmit={submit}>
                <div className="mb-2">
                  <label className="form-label small">Academic Year *</label>
                  <select className="form-select form-select-sm" value={form.academicYearId} onChange={(e) => setForm({ ...form, academicYearId: e.target.value })} required>
                    <option value="">Select year</option>
                    {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.is_active ? ' (active)' : ''}</option>)}
                  </select>
                </div>
                <div className="mb-2">
                  <label className="form-label small">Term Name *</label>
                  <input className="form-control form-control-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Term 1, Half Yearly" required />
                </div>
                <div className="row g-2 mb-2">
                  <div className="col-6"><label className="form-label small">Start Date *</label><input type="date" className="form-control form-control-sm" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required /></div>
                  <div className="col-6"><label className="form-label small">End Date *</label><input type="date" className="form-control form-control-sm" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required /></div>
                </div>
                <div className="mb-2">
                  <label className="form-label small">Weightage %</label>
                  <input type="number" step="0.01" min="0" max="100" className="form-control form-control-sm" value={form.weightage} onChange={(e) => setForm({ ...form, weightage: e.target.value })} />
                </div>
                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-sm btn-primary">{editingId ? 'Update' : 'Create'}</button>
                  {editingId && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetForm}>Cancel</button>}
                </div>
              </form>
            </div>
          </div>

          <div className="col-lg-8">
            <div className="border rounded">
              <div className="px-3 py-2 border-bottom d-flex justify-content-between align-items-center">
                <span className="fw-semibold small">Terms</span>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => downloadCsv('terms.csv', [
                  { label: 'Name', key: 'name' },
                  { label: 'Year', value: (r) => r.academic_year_name || 'Ã¢â‚¬â€' },
                  { label: 'Start', value: (r) => fmtDate(r.start_date) },
                  { label: 'End', value: (r) => fmtDate(r.end_date) },
                  { label: 'Weightage %', key: 'weightage' },
                  { label: 'Active', value: (r) => r.is_active ? 'Yes' : 'No' },
                ], terms)} disabled={!terms.length}>
                  <i className="bi bi-download me-1"></i>CSV
                </button>
              </div>
              {terms.length === 0 ? <Empty icon="bi-calendar3" text="No terms defined yet." /> : (
                <div className="table-responsive">
                  <table className="table table-sm mb-0 align-middle">
                    <thead><tr><th>Name</th><th>Year</th><th>Start</th><th>End</th><th>Weight %</th><th>Active</th><th className="text-end">Actions</th></tr></thead>
                    <tbody>
                      {terms.map((t) => (
                        <tr key={t.id}>
                          <td className="fw-semibold">{t.name}</td>
                          <td className="small">{t.academic_year_name || 'Ã¢â‚¬â€'}</td>
                          <td>{fmtDate(t.start_date)}</td>
                          <td>{fmtDate(t.end_date)}</td>
                          <td>{t.weightage || 0}%</td>
                          <td>{t.is_active ? <span className="badge bg-success">Yes</span> : <span className="badge bg-secondary">No</span>}</td>
                          <td className="text-end">
                            <div className="btn-group btn-group-sm">
                              <button className="btn btn-outline-primary" onClick={() => startEdit(t)}>Edit</button>
                              <button className="btn btn-outline-danger" onClick={() => remove(t.id)}>Deactivate</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
