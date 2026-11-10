import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate, downloadCsv } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

const DATA_SOURCES = [
  { value: 'students', label: 'Students' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'fees', label: 'Fees' },
  { value: 'exams', label: 'Exams' },
  { value: 'custom_sql', label: 'Custom SQL' },
];

const CATEGORIES = [
  { value: 'student', label: 'Student' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'fees', label: 'Fees' },
  { value: 'exam', label: 'Exam' },
  { value: 'custom', label: 'Custom' },
];

export default function CustomReports() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [executions, setExecutions] = useState([]);
  const [execLoading, setExecLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: '', code: '', category: 'custom', data_source: 'students',
    description: '', query_config: { columns: [], filters: {}, groupBy: [] },
    ui_config: { chartType: 'table' }
  });
  const [runTemplateId, setRunTemplateId] = useState(null);
  const [runParams, setRunParams] = useState({});
  const [runResults, setRunResults] = useState(null);
  const [runError, setRunError] = useState(null);
  const [runLoading, setRunLoading] = useState(false);

  useEffect(() => { loadTemplates(); loadExecutions(); }, []);

  async function loadTemplates() {
    try {
      const d = await apiGet('/school/reports/templates');
      if (d?.ok) setTemplates(d.templates || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function loadExecutions() {
    try {
      const d = await apiGet('/school/reports/executions?limit=50');
      if (d?.ok) setExecutions(d.executions || []);
    } catch (e) { console.error(e); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name?.trim()) return toast('Name is required', 'error');
    try {
      const res = editingId
        ? await apiPut(`/school/reports/templates/${editingId}`, form)
        : await apiPost('/school/reports/templates', form);
      if (res?.ok) {
        toast(editingId ? 'Template updated' : 'Template created', 'success');
        setShowForm(false);
        setEditingId(null);
        setForm({ name: '', code: '', category: 'custom', data_source: 'students', description: '', query_config: { columns: [], filters: {}, groupBy: [] }, ui_config: { chartType: 'table' } });
        loadTemplates();
      } else toast(res?.error || 'Save failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  function editTemplate(t) {
    setEditingId(t.id);
    setForm({
      name: t.name || '',
      code: t.code || '',
      category: t.category || 'custom',
      data_source: t.data_source || 'students',
      description: t.description || '',
      query_config: t.query_config || { columns: [], filters: {}, groupBy: [] },
      ui_config: t.ui_config || { chartType: 'table' }
    });
    setShowForm(true);
  }

  async function deleteTemplate(id) {
    if (!window.confirm('Delete this template?')) return;
    try {
      const res = await apiDelete(`/school/reports/templates/${id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadTemplates(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function runTemplate(t) {
    setRunTemplateId(t.id);
    setRunParams({});
    setRunResults(null);
    setRunError(null);
  }

  async function executeRun() {
    setRunLoading(true);
    setRunError(null);
    try {
      const res = await apiPost(`/school/reports/templates/${runTemplateId}/run`, { parameters: runParams });
      if (res?.ok) {
        setRunResults({ data: res.data, execution: res.execution });
        toast('Report executed', 'success');
        loadExecutions();
      } else {
        setRunError(res?.error || 'Execution failed');
        toast(res?.error || 'Execution failed', 'error');
      }
    } catch (e) { setRunError(e.message); toast(e.message, 'error'); }
    finally { setRunLoading(false); }
  }

  function handleExport() {
    if (!runResults?.data?.length) return;
    const headers = Object.keys(runResults.data[0]);
    const rows = runResults.data.map(r => headers.map(h => r[h]));
    downloadCsv([headers, ...rows], 'custom_report.csv');
  }

  const tpl = templates.find(t => t.id === runTemplateId);
  const columns = tpl?.query_config?.columns || [];

  return (
    <PageShell title="Custom Reports" icon="bi-file-earmark-bar-graph" subtitle={`${templates.length} templates`}>
      <div className="row g-3">
        <div className="col-lg-7">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h6 className="mb-0">Saved Templates</h6>
              <button className="btn btn-sm btn-primary" onClick={() => { setEditingId(null); setForm({ name: '', code: '', category: 'custom', data_source: 'students', description: '', query_config: { columns: [], filters: {}, groupBy: [] }, ui_config: { chartType: 'table' } }); setShowForm(true); }}><i className="bi bi-plus"></i> New</button>
            </div>
            <div className="card-body">
              {showForm && (
                <form className="mb-3" onSubmit={handleSubmit}>
                  <div className="row g-2 mb-2">
                    <div className="col-md-6"><label className="form-label small">Name *</label><input className="form-control form-control-sm" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
                    <div className="col-md-6"><label className="form-label small">Category</label><select className="form-select form-select-sm" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>{CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-md-6"><label className="form-label small">Data Source</label><select className="form-select form-select-sm" value={form.data_source} onChange={e => setForm({...form, data_source: e.target.value})}>{DATA_SOURCES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}</select></div>
                    <div className="col-md-6"><label className="form-label small">Code</label><input className="form-control form-control-sm" value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="Auto-generated" disabled={Boolean(editingId)} /></div>
                  </div>
                  <div className="mb-2"><label className="form-label small">Description</label><textarea className="form-control form-control-sm" rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
                  <div className="mb-2">
                    <label className="form-label small">Columns (comma-separated)</label>
                    <input className="form-control form-control-sm" value={Array.isArray(form.query_config.columns) ? form.query_config.columns.join(', ') : ''} onChange={e => setForm({...form, query_config: {...form.query_config, columns: e.target.value.split(',').map(s => s.trim()).filter(Boolean)}}) } placeholder="class_name, section_name, gender, category, count" />
                  </div>
                  <div className="mb-2">
                    <label className="form-label small">Group By (comma-separated)</label>
                    <input className="form-control form-control-sm" value={Array.isArray(form.query_config.groupBy) ? form.query_config.groupBy.join(', ') : ''} onChange={e => setForm({...form, query_config: {...form.query_config, groupBy: e.target.value.split(',').map(s => s.trim()).filter(Boolean)}}) } placeholder="class_name, section_name" />
                  </div>
                  <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-primary" type="submit"><i className="bi bi-check"></i> {editingId ? 'Save' : 'Create'}</button>
                    <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
                  </div>
                </form>
              )}

              <div className="school-table-wrap">
                <table className="table table-sm school-table">
                  <thead><tr><th>Name</th><th>Category</th><th>Data Source</th><th>System</th><th>Created</th><th></th></tr></thead>
                  <tbody>
                    {loading ? <tr><td colSpan={6}><Loading /></td></tr> :
                    templates.length === 0 ? <tr><td colSpan={6}><Empty text="No templates yet" /></td></tr> :
                    templates.map(t => (
                      <tr key={t.id}>
                        <td><strong>{t.name}</strong>{t.code && <div className="text-muted small">{t.code}</div>}</td>
                        <td>{t.category}</td>
                        <td>{t.data_source}</td>
                        <td>{t.is_system ? 'Yes' : 'No'}</td>
                        <td>{fmtDate(t.created_at)}</td>
                        <td className="text-end no-print">
                          <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editTemplate(t)}><i className="bi bi-pencil"></i></button>
                          <button className="btn btn-sm btn-outline-primary me-1" onClick={() => runTemplate(t)}><i className="bi bi-play"></i> Run</button>
                          {!t.is_system && <button className="btn btn-sm btn-outline-danger" onClick={() => deleteTemplate(t.id)}><i className="bi bi-trash"></i></button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h6 className="mb-0">Execution History</h6>
              <button className="btn btn-sm btn-outline-secondary" onClick={loadExecutions}><i className="bi bi-arrow-clockwise"></i></button>
            </div>
            <div className="card-body">
              <div className="school-table-wrap">
                <table className="table table-sm school-table">
                  <thead><tr><th>Template</th><th>Triggered</th><th>Status</th><th>Rows</th><th>Time</th></tr></thead>
                  <tbody>
                    {executions.length === 0 ? <tr><td colSpan={5}><Empty text="No executions yet" /></td></tr> :
                    executions.map(e => (
                      <tr key={e.id}>
                        <td>{e.template_name || `ID: ${e.template_id}`}</td>
                        <td>{fmtDate(e.started_at)}</td>
                        <td><Badge status={e.status}>{e.status}</Badge></td>
                        <td>{e.row_count || 0}</td>
                        <td>{e.completed_at ? new Date(e.completed_at).toLocaleTimeString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {runTemplateId && (
          <div className="col-12">
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h6 className="mb-0">Run Report: {tpl?.name || ''}</h6>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => { setRunTemplateId(null); setRunResults(null); setRunError(null); }}><i className="bi bi-x"></i></button>
              </div>
              <div className="card-body">
                {columns.length && (
                  <div className="mb-3">
                    <label className="form-label small">Parameters</label>
                    <div className="row g-2">
                      {columns.map((col, i) => (
                        <div key={i} className="col-md-4">
                          <input className="form-control form-control-sm" placeholder={col} value={runParams[col] || ''} onChange={e => setRunParams({...runParams, [col]: e.target.value})} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="d-flex gap-2 mb-3">
                  <button className="btn btn-primary" onClick={executeRun} disabled={runLoading}><i className="bi bi-play"></i> {runLoading ? 'Running...' : 'Execute'}</button>
                  {runResults && <button className="btn btn-outline-secondary" onClick={handleExport}><i className="bi bi-download"></i> Export CSV</button>}
                </div>

                {runError && <div className="alert alert-danger">{runError}</div>}

                {runResults && (
                  <div className="school-table-wrap" style={{ maxHeight: 400, overflow: 'auto' }}>
                    <table className="table table-sm school-table">
                      <thead><tr>{Object.keys(runResults.data[0] || {}).map(k => <th key={k}>{k}</th>)}</tr></thead>
                      <tbody>
                        {runResults.data.slice(0, 100).map((r, i) => (
                          <tr key={i}>{Object.values(r).map((v, j) => <td key={j}>{v === null || v === undefined ? '—' : v}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                    {runResults.data.length > 100 && <div className="text-muted small">Showing first 100 rows of {runResults.data.length}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}