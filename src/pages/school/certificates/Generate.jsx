import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate, fmtDateTime } from './shared';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';

const EMPTY_FORM = { templateId: '', studentId: '', isReissue: false, notes: '' };
const EMPTY_BULK = { templateId: '', classId: '', sectionId: '', isReissue: false };

export default function CertificatesGenerate() {
  const [templates, setTemplates] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [bulk, setBulk] = useState(EMPTY_BULK);
  const [bulkResult, setBulkResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadTemplates();
    loadStudents();
    loadClasses();
    loadHistory();
  }, []);

  async function loadTemplates() {
    setLoading(true);
    try {
      const d = await apiGet('/school/certificates/templates');
      if (d?.ok) setTemplates(d.templates || []);
      else toast(d?.error || 'Failed to load templates', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  async function loadStudents() {
    const d = await apiGet('/school/students?status=active');
    if (d?.ok) setStudents(d.students || []);
  }

  async function loadClasses() {
    const d = await apiGet('/school/classes');
    if (d?.ok) setClasses(d.classes || []);
  }

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const d = await apiGet('/school/certificates/generated');
      if (d?.ok) setHistory(d.documents || []);
      else toast(d?.error || 'Failed to load history', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setHistoryLoading(false); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.templateId || !form.studentId) return toast('Template and student required', 'error');
    setBusy(true);
    try {
      const res = await apiPost('/school/certificates/generate', form);
      if (res?.ok) {
        toast(`Certificate ${res.document?.certificate_no || ''} generated`, 'success');
        setShowForm(false);
        setForm(EMPTY_FORM);
        loadHistory();
      } else toast(res?.error || 'Failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  }

  async function handleBulk(e) {
    e.preventDefault();
    if (!bulk.templateId) return toast('Select a template', 'error');
    if (!bulk.classId) return toast('Select a class for bulk generation', 'error');
    setBusy(true);
    setBulkResult(null);
    try {
      const res = await apiPost('/school/certificates/generate/bulk', bulk);
      if (res?.ok) {
        setBulkResult(res);
        toast(`${res.generated} certificate(s) generated${res.failed ? `, ${res.failed} failed` : ''}`, res.failed ? 'warning' : 'success');
        loadHistory();
      } else toast(res?.error || 'Bulk generation failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  }

  const selectedClass = classes.find(c => String(c.id) === String(bulk.classId));

  return (
    <PageShell title="Generate Certificates" icon="bi-magic" subtitle={`${history.length} documents generated`}>
      <div className="d-flex gap-2 mb-3">
        <button className="btn btn-sm btn-primary" onClick={() => { setForm(EMPTY_FORM); setShowForm(true); }}>
          <i className="bi bi-plus"></i> Generate Certificate
        </button>
        <button className="btn btn-sm btn-outline-secondary" onClick={loadHistory} disabled={historyLoading}>
          <i className="bi bi-arrow-clockwise"></i> Refresh History
        </button>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>Generate Certificate</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>Template *<select className="form-select form-select-sm" value={form.templateId} onChange={e => setForm({ ...form, templateId: e.target.value })} required>
              <option value="">Select template</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.type})</option>)}
            </select></label>
            <label>Student *<select className="form-select form-select-sm" value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })} required>
              <option value="">Select student</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.admission_no})</option>)}
            </select></label>
            <label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input" checked={form.isReissue} onChange={e => setForm({ ...form, isReissue: e.target.checked })} /> Reissue</label>
            <label>Notes<input className="form-control form-control-sm" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
            <div className="span-2 d-flex gap-2">
              <button className="btn btn-sm btn-primary" type="submit" disabled={busy}><i className="bi bi-magic"></i> {busy ? 'Generating…' : 'Generate'}</button>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <form className="school-form-card mb-3" onSubmit={handleBulk}>
        <div className="school-form-head">
          <h6>Bulk Generate</h6>
          <span className="text-muted small">Generate the same certificate for every active student in a class</span>
        </div>
        <div className="school-form-grid">
          <label>Template *<select className="form-select form-select-sm" value={bulk.templateId} onChange={e => setBulk({ ...bulk, templateId: e.target.value })} required>
            <option value="">Select template</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.type})</option>)}
          </select></label>
          <label>Class *<select className="form-select form-select-sm" value={bulk.classId} onChange={e => setBulk({ ...bulk, classId: e.target.value, sectionId: '' })} required>
            <option value="">Select class</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
          <label>Section<select className="form-select form-select-sm" value={bulk.sectionId} onChange={e => setBulk({ ...bulk, sectionId: e.target.value })} disabled={!bulk.classId}>
            <option value="">All sections</option>
            {(selectedClass?.sections || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></label>
          <label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input" checked={bulk.isReissue} onChange={e => setBulk({ ...bulk, isReissue: e.target.checked })} /> Reissue</label>
          <div className="span-2 d-flex gap-2 align-items-center">
            <button className="btn btn-sm btn-primary" type="submit" disabled={busy}><i className="bi bi-collection"></i> {busy ? 'Generating…' : 'Bulk Generate'}</button>
            {bulkResult && <span className="small text-muted">Generated {bulkResult.generated}, failed {bulkResult.failed}</span>}
          </div>
        </div>
      </form>

      <div className="school-table-wrap">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h6 className="mb-0">Generation History</h6>
          <span className="text-muted small">{history.length} record(s)</span>
        </div>
        <table className="table table-sm school-table">
          <thead><tr><th>Certificate No</th><th>Student</th><th>Class</th><th>Template</th><th>Type</th><th>Generated At</th><th>Status</th></tr></thead>
          <tbody>
            {historyLoading ? <tr><td colSpan={7}><Loading /></td></tr> :
            history.length === 0 ? <tr><td colSpan={7}><Empty text="No certificates generated yet" icon="bi-magic" /></td></tr> :
            history.map(d => (
              <tr key={d.id}>
                <td><strong>{d.certificate_no}</strong></td>
                <td>{[d.first_name, d.last_name].filter(Boolean).join(' ') || '—'}{d.admission_no ? <div className="text-muted small">{d.admission_no}</div> : null}</td>
                <td>{d.class_name || '—'}</td>
                <td>{d.template_name || '—'}</td>
                <td>{d.document_type || d.template_type || '—'}</td>
                <td>{d.generated_at ? fmtDateTime(d.generated_at) : '—'}</td>
                <td><Badge status={d.status}>{d.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
