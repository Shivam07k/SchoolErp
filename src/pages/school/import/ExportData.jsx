import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate, fmtDateTime, downloadCsv } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

const EXPORT_TYPES = [
  { value: 'students', label: 'Students', description: 'Complete student list with demographics' },
  { value: 'attendance', label: 'Attendance', description: 'Daily attendance records' },
  { value: 'fees', label: 'Fees', description: 'Outstanding and paid fee invoices' },
  { value: 'exams', label: 'Exams', description: 'Exam results and marks' },
  { value: 'custom_sql', label: 'Custom SQL', description: 'Advanced users only - custom query' },
];

const EXPORT_TYPE_FIELDS = {
  students: { defaultColumns: ['admission_no','first_name','last_name','gender','dob','class_name','section_name','roll_no','status','admission_date'], availableColumns: ['admission_no','first_name','last_name','middle_name','gender','dob','class_name','section_name','roll_no','status','admission_date','guardian_name','guardian_phone','address','blood_group','category','father_name','mother_name'] },
  attendance: { defaultColumns: ['date','class_name','section_name','admission_no','first_name','last_name','roll_no','status_code','late_minutes','remark'], availableColumns: ['date','class_name','section_name','admission_no','first_name','last_name','roll_no','status_code','late_minutes','remark'] },
  fees: { defaultColumns: ['invoice_no','admission_no','first_name','last_name','class_name','section_name','fee_head_name','amount','paid_amount','balance','due_date','status','days_overdue'], availableColumns: ['invoice_no','admission_no','first_name','last_name','class_name','section_name','fee_head_name','amount','paid_amount','balance','due_date','invoice_date','status','days_overdue'] },
  exams: { defaultColumns: ['term_name','class_name','section_name','admission_no','first_name','last_name','subject_name','marks_obtained','max_marks','percentage','grade'], availableColumns: ['term_name','class_name','section_name','admission_no','first_name','last_name','subject_name','marks_obtained','max_marks','percentage','grade'] },
};

export default function ExportData() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [activeTab, setActiveTab] = useState('run');

  // Ad-hoc export state
  const [exportType, setExportType] = useState('students');
  const [format, setFormat] = useState('csv');
  const [columns, setColumns] = useState([]);
  const [filters, setFilters] = useState({});
  const [exporting, setExporting] = useState(false);

  // Template builder state
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [templateForm, setTemplateForm] = useState({
    name: '', code: '', export_type: 'students', description: '',
    query_config: { columns: [], filters: {}, orderBy: [] },
    format: 'csv'
  });

  useEffect(() => {
    loadTemplates();
    loadJobs();
  }, []);

  async function loadTemplates() {
    try {
      const res = await apiGet('/school/import/export/templates');
      if (res?.ok) setTemplates(res.templates || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function loadJobs() {
    try {
      const res = await apiGet('/school/import/export/history');
      if (res?.ok) setJobs(res.jobs || []);
    } catch (e) { console.error(e); }
  }

  async function handleTemplateSubmit(e) {
    e.preventDefault();
    if (!templateForm.name?.trim() || !templateForm.export_type) return toast('Name and export type required', 'error');
    const payload = { ...templateForm, query_config: { columns: templateForm.query_config.columns || [], filters: templateForm.query_config.filters || {} } };
    try {
      const res = editingTemplateId
        ? await apiPut(`/school/import/export/templates/${editingTemplateId}`, payload)
        : await apiPost('/school/import/export/templates', payload);
      if (res?.ok) {
        toast(editingTemplateId ? 'Template updated' : 'Template created', 'success');
        setShowTemplateForm(false);
        setEditingTemplateId(null);
        setTemplateForm({ name: '', code: '', export_type: 'students', description: '', query_config: { columns: [], filters: {} }, format: 'csv' });
        loadTemplates();
      } else toast(res?.error || 'Save failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  function editTemplate(t) {
    setEditingTemplateId(t.id);
    setTemplateForm({
      name: t.name || '', code: t.code || '', export_type: t.export_type || 'students',
      description: t.description || '', query_config: t.query_config || { columns: [], filters: {} },
      format: t.format || 'csv'
    });
    setShowTemplateForm(true);
  }

  async function deleteTemplate(id) {
    if (!window.confirm('Delete this template?')) return;
    try {
      const res = await apiDelete(`/school/import/export/templates/${id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadTemplates(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  // Ad-hoc export
  function onExportTypeChange(type) {
    setExportType(type);
    const fields = EXPORT_TYPE_FIELDS[type];
    if (fields) setColumns(fields.defaultColumns);
    setFilters({});
  }

  async function runExport() {
    if (!columns.length) return toast('Select at least one column', 'error');
    setExporting(true);
    try {
      const res = await apiPost('/school/import/export/run', {
        export_type: exportType,
        format,
        columns,
        filters,
        name: `Ad-hoc ${exportType} export`
      });
      if (res?.ok) {
        toast('Export completed', 'success');
        // Download the CSV
        const downloadRes = await apiGet(`/school/import/export/download/${res.job.id}`);
        const blob = new Blob([downloadRes], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${exportType}_export_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        loadJobs();
      } else toast(res?.error || 'Export failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setExporting(false); }
  }

  // Initialize columns on first load
  React.useEffect(() => {
    const fields = EXPORT_TYPE_FIELDS[exportType];
    if (fields && !columns.length) setColumns(fields.defaultColumns);
  }, []);

  return (
    <PageShell title="Export Data" icon="bi-download" subtitle={`${templates.length} templates, ${jobs.length} recent jobs`}>
      <ul className="nav nav-tabs mb-3" role="tablist">
        <li className="nav-item"><button className={`nav-link ${activeTab === 'run' ? 'active' : ''}`} onClick={() => setActiveTab('run')}>Run Export</button></li>
        <li className="nav-item"><button className={`nav-link ${activeTab === 'templates' ? 'active' : ''}`} onClick={() => setActiveTab('templates')}>Saved Templates</button></li>
        <li className="nav-item"><button className={`nav-link ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>History</button></li>
      </ul>

      {activeTab === 'run' && (
        <div className="row g-3">
          <div className="col-lg-5">
            <div className="card h-100">
              <div className="card-header"><h6 className="mb-0">Configure Export</h6></div>
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label small">Data Source</label>
                  <select className="form-select form-select-sm" value={exportType} onChange={e => onExportTypeChange(e.target.value)}>
                    {EXPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <div className="form-text">{EXPORT_TYPES.find(t => t.value === exportType)?.description}</div>
                </div>

                <div className="mb-3">
                  <label className="form-label small">Format</label>
                  <select className="form-select form-select-sm" value={format} onChange={e => setFormat(e.target.value)}>
                    <option value="csv">CSV</option>
                    <option value="xlsx">Excel (XLSX)</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label small">Columns</label>
                  <div className="row g-2">
                    {EXPORT_TYPE_FIELDS[exportType]?.availableColumns.map(col => (
                      <div key={col} className="col-md-4">
                        <label className="form-check">
                          <input className="form-check-input" type="checkbox" checked={columns.includes(col)} onChange={e => setColumns(e.target.checked ? [...columns, col] : columns.filter(c => c !== col))} />
                          <span className="form-check-label">{col}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="d-flex gap-2 mt-1">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setColumns(EXPORT_TYPE_FIELDS[exportType]?.availableColumns || [])}>Select All</button>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setColumns(EXPORT_TYPE_FIELDS[exportType]?.defaultColumns || [])}>Default</button>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setColumns([])}>Clear</button>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label small">Filters (JSON)</label>
                  <textarea className="form-control form-control-sm" rows="3" value={JSON.stringify(filters, null, 2)} onChange={e => { try { setFilters(JSON.parse(e.target.value)); } catch {} }} placeholder='{"class_name": "Class 1", "status": "active"}' />
                </div>

                <button className="btn btn-primary w-100" onClick={runExport} disabled={exporting || !columns.length}>
                  <i className="bi bi-download"></i> {exporting ? 'Exporting...' : 'Run Export'}
                </button>
              </div>
            </div>
          </div>

          <div className="col-lg-7">
            <div className="card h-100">
              <div className="card-header"><h6 className="mb-0">Available Columns: {EXPORT_TYPE_FIELDS[exportType]?.availableColumns?.length || 0}</h6></div>
              <div className="card-body">
                <div className="row g-1">
                  {EXPORT_TYPE_FIELDS[exportType]?.availableColumns.map(col => (
                    <div key={col} className="col-md-4">
                      <span className={`badge ${columns.includes(col) ? 'bg-primary' : 'bg-secondary'} me-1`}>{col}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <>
          <div className="d-flex gap-2 mb-3">
            <button className="btn btn-primary" onClick={() => { setEditingTemplateId(null); setTemplateForm({ name: '', code: '', export_type: 'students', description: '', query_config: { columns: [], filters: {} }, format: 'csv' }); setShowTemplateForm(true); }}><i className="bi bi-plus"></i> New Template</button>
          </div>

          {showTemplateForm && (
            <form className="school-form-card mb-3" onSubmit={handleTemplateSubmit}>
              <div className="school-form-head">
                <h6>{editingTemplateId ? 'Edit Template' : 'New Export Template'}</h6>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowTemplateForm(false); setEditingTemplateId(null); }}>Cancel</button>
              </div>
              <div className="school-form-grid">
                <label className="span-2">Name *<input className="form-control form-control-sm" value={templateForm.name} onChange={e => setTemplateForm({...templateForm, name: e.target.value})} required /></label>
                <label>Export Type<select className="form-select form-select-sm" value={templateForm.export_type} onChange={e => setTemplateForm({...templateForm, export_type: e.target.value})}>
                  {EXPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select></label>
                <label>Format<select className="form-select form-select-sm" value={templateForm.format} onChange={e => setTemplateForm({...templateForm, format: e.target.value})}>
                  <option value="csv">CSV</option><option value="xlsx">Excel</option>
                </select></label>
                <label className="span-2">Description<textarea className="form-control form-control-sm" rows="2" value={templateForm.description} onChange={e => setTemplateForm({...templateForm, description: e.target.value})} /></label>
                <label className="span-2">Columns (comma-separated)<input className="form-control form-control-sm" value={Array.isArray(templateForm.query_config.columns) ? templateForm.query_config.columns.join(', ') : ''} onChange={e => setTemplateForm({...templateForm, query_config: {...templateForm.query_config, columns: e.target.value.split(',').map(s => s.trim()).filter(Boolean)}}) } /></label>
                <label className="span-2">Filters (JSON)<textarea className="form-control form-control-sm" rows="2" value={JSON.stringify(templateForm.query_config.filters || {}, null, 2)} onChange={e => { try { setTemplateForm({...templateForm, query_config: {...templateForm.query_config, filters: JSON.parse(e.target.value)}}); } catch {} }} placeholder='{"class_name": "Class 1"}' /></label>
                <div className="span-2 d-flex gap-2">
                  <button className="btn btn-primary" type="submit"><i className="bi bi-check"></i> {editingTemplateId ? 'Save' : 'Create'}</button>
                  <button className="btn btn-outline-secondary" type="button" onClick={() => { setShowTemplateForm(false); setEditingTemplateId(null); }}>Cancel</button>
                </div>
              </div>
            </form>
          )}

          <div className="school-table-wrap">
            <table className="table table-sm school-table">
              <thead><tr><th>Name</th><th>Type</th><th>Format</th><th>System</th><th>Created</th><th></th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={6}><Loading /></td></tr> :
                templates.length === 0 ? <tr><td colSpan={6}><Empty text="No templates yet" /></td></tr> :
                templates.map(t => (
                  <tr key={t.id}>
                    <td><strong>{t.name}</strong>{t.code && <div className="text-muted small">{t.code}</div>}</td>
                    <td>{t.export_type}</td>
                    <td>{t.format}</td>
                    <td>{t.is_system ? 'Yes' : 'No'}</td>
                    <td>{fmtDate(t.created_at)}</td>
                    <td className="text-end no-print">
                      {!t.is_system && <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editTemplate(t)}><i className="bi bi-pencil"></i></button>}
                      {!t.is_system && <button className="btn btn-sm btn-outline-danger" onClick={() => deleteTemplate(t.id)}><i className="bi bi-trash"></i></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'history' && (
        <div className="school-table-wrap">
          <table className="table table-sm school-table">
            <thead><tr><th>Name</th><th>Type</th><th>Status</th><th>Format</th><th>Rows</th><th>Started</th><th>Completed</th><th></th></tr></thead>
            <tbody>
              {jobs.length === 0 ? <tr><td colSpan={8}><Empty text="No export jobs yet" /></td></tr> :
              jobs.map(j => (
                <tr key={j.id}>
                  <td><strong>{j.name}</strong></td>
                  <td>{j.export_type}</td>
                  <td><Badge status={j.status}>{j.status}</Badge></td>
                  <td>{j.format}</td>
                  <td>{j.row_count || 0}</td>
                  <td>{fmtDateTime(j.started_at)}</td>
                  <td>{j.completed_at ? fmtDateTime(j.completed_at) : '—'}</td>
                  <td className="text-end">
                    {j.status === 'completed' && <button className="btn btn-sm btn-outline-primary"><i className="bi bi-download"></i> Download</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}