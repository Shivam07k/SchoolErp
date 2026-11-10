import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

const EMPTY_FORM = { studentId: '', sessionId: '', frontTemplateId: '', backTemplateId: '', issueDate: '', status: 'active' };

export default function CertificatesIDCards() {
  const [idcards, setIdcards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [bulk, setBulk] = useState({ sessionId: '', classId: '', sectionId: '', frontTemplateId: '', backTemplateId: '' });
  const [classes, setClasses] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadIdcards();
    loadRefs();
  }, []);

  async function loadIdcards() {
    setLoading(true);
    try {
      const d = await apiGet('/school/certificates/idcards');
      if (d?.ok) setIdcards(d.idcards || []);
      else toast(d?.error || 'Failed to load', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  async function loadRefs() {
    const [studs, sess, tmpls, cls] = await Promise.all([
      apiGet('/school/students?status=active'),
      apiGet('/school/academic-years'),
      apiGet('/school/certificates/templates'),
      apiGet('/school/classes')
    ]);
    if (studs?.ok) setStudents(studs.students || []);
    if (sess?.ok) setSessions(sess.years || []);
    if (tmpls?.ok) setTemplates(tmpls.templates || []);
    if (cls?.ok) setClasses(cls.classes || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!editingId && (!form.studentId || !form.sessionId || !form.frontTemplateId)) return toast('Student, session and front template required', 'error');
    setBusy(true);
    try {
      const res = editingId
        ? await apiPut(`/school/certificates/idcards/${editingId}`, { status: form.status })
        : await apiPost('/school/certificates/idcards', form);
      if (res?.ok) {
        toast(editingId ? 'Updated' : 'ID card issued', 'success');
        setShowForm(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
        loadIdcards();
      } else toast(res?.error || 'Save failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  }

  function editIdcard(i) {
    setEditingId(i.id);
    setForm({ studentId: i.student_id, sessionId: i.session_id, frontTemplateId: i.front_template_id, backTemplateId: i.back_template_id, issueDate: i.issue_date ? String(i.issue_date).slice(0, 10) : '', status: i.status });
    setShowForm(true);
  }

  async function deleteIdcard(id) {
    if (!window.confirm('Delete this ID card?')) return;
    try {
      const res = await apiDelete(`/school/certificates/idcards/${id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadIdcards(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function reissueIdcard(id) {
    if (!window.confirm('Reissue this ID card?')) return;
    try {
      const res = await apiPost(`/school/certificates/idcards/${id}/reissue`, { reason: 'reissue' });
      if (res?.ok) { toast('Reissued', 'success'); loadIdcards(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleBulk(e) {
    e.preventDefault();
    if (!bulk.sessionId || !bulk.classId || !bulk.frontTemplateId) return toast('Session, class and front template required', 'error');
    setBusy(true);
    try {
      const res = await apiPost('/school/certificates/idcards/bulk', bulk);
      if (res?.ok) {
        toast(`${res.generated} card(s) issued${res.skipped ? `, ${res.skipped} skipped` : ''}`, 'success');
        loadIdcards();
      } else toast(res?.error || 'Bulk issue failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  }

  const selectedClass = classes.find(c => String(c.id) === String(bulk.classId));
  const sessionName = (id) => sessions.find(s => s.id === id)?.name || (id ? `Session ${id}` : '—');
  const frontTemplates = templates.filter(t => t.type === 'id_front' || t.type === 'custom');
  const backTemplates = templates.filter(t => t.type === 'id_back' || t.type === 'custom');

  return (
    <PageShell title="ID Cards" icon="bi-card-heading" subtitle={`${idcards.length} cards`}>
      <div className="d-flex gap-2 mb-3">
        <button className="btn btn-sm btn-primary" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); }}>
          <i className="bi bi-plus"></i> Issue ID Card
        </button>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>{editingId ? 'Edit ID Card' : 'Issue ID Card'}</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>Student *<select className="form-select form-select-sm" value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })} required disabled={Boolean(editingId)}>
              <option value="">Select student</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.admission_no})</option>)}
            </select></label>
            <label>Session *<select className="form-select form-select-sm" value={form.sessionId} onChange={e => setForm({ ...form, sessionId: e.target.value })} required disabled={Boolean(editingId)}>
              <option value="">Select session</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
            <label>Front Template *<select className="form-select form-select-sm" value={form.frontTemplateId} onChange={e => setForm({ ...form, frontTemplateId: e.target.value })} required disabled={Boolean(editingId)}>
              <option value="">Select</option>
              {frontTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select></label>
            <label>Back Template<select className="form-select form-select-sm" value={form.backTemplateId} onChange={e => setForm({ ...form, backTemplateId: e.target.value })} disabled={Boolean(editingId)}>
              <option value="">Select</option>
              {backTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select></label>
            <label>Issue Date<input type="date" className="form-control form-control-sm" value={form.issueDate} onChange={e => setForm({ ...form, issueDate: e.target.value })} disabled={Boolean(editingId)} /></label>
            {editingId && <label>Status<select className="form-select form-select-sm" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option><option value="reissued">Reissued</option><option value="lost">Lost</option><option value="damaged">Damaged</option><option value="expired">Expired</option>
            </select></label>}
            <div className="span-2 d-flex gap-2">
              <button className="btn btn-sm btn-primary" type="submit" disabled={busy}><i className="bi bi-check"></i> {editingId ? 'Save' : 'Create'}</button>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <form className="school-form-card mb-3" onSubmit={handleBulk}>
        <div className="school-form-head">
          <h6>Bulk Issue ID Cards</h6>
          <span className="text-muted small">Issue cards for every active student in a class</span>
        </div>
        <div className="school-form-grid">
          <label>Session *<select className="form-select form-select-sm" value={bulk.sessionId} onChange={e => setBulk({ ...bulk, sessionId: e.target.value })} required>
            <option value="">Select session</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></label>
          <label>Class *<select className="form-select form-select-sm" value={bulk.classId} onChange={e => setBulk({ ...bulk, classId: e.target.value, sectionId: '' })} required>
            <option value="">Select class</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
          <label>Section<select className="form-select form-select-sm" value={bulk.sectionId} onChange={e => setBulk({ ...bulk, sectionId: e.target.value })} disabled={!bulk.classId}>
            <option value="">All sections</option>
            {(selectedClass?.sections || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></label>
          <label>Front Template *<select className="form-select form-select-sm" value={bulk.frontTemplateId} onChange={e => setBulk({ ...bulk, frontTemplateId: e.target.value })} required>
            <option value="">Select</option>
            {frontTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select></label>
          <label>Back Template<select className="form-select form-select-sm" value={bulk.backTemplateId} onChange={e => setBulk({ ...bulk, backTemplateId: e.target.value })}>
            <option value="">Select</option>
            {backTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select></label>
          <div className="d-flex align-items-end">
            <button className="btn btn-sm btn-primary" type="submit" disabled={busy}><i className="bi bi-collection"></i> {busy ? 'Issuing…' : 'Bulk Issue'}</button>
          </div>
        </div>
      </form>

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Student</th><th>Admission</th><th>Class</th><th>Session</th><th>Status</th><th>Issued</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7}><Loading /></td></tr> :
            idcards.length === 0 ? <tr><td colSpan={7}><Empty text="No ID cards issued" icon="bi-card-heading" /></td></tr> :
            idcards.map(i => (
              <tr key={i.id}>
                <td><strong>{i.first_name} {i.last_name}</strong></td>
                <td>{i.admission_no || '—'}</td>
                <td>{i.class_name || '—'}</td>
                <td>{sessionName(i.session_id)}</td>
                <td><Badge status={i.status}>{i.status}</Badge></td>
                <td>{i.issue_date ? fmtDate(i.issue_date) : '—'}</td>
                <td className="text-end no-print">
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editIdcard(i)}><i className="bi bi-pencil"></i></button>
                  <button className="btn btn-sm btn-outline-warning me-1" onClick={() => reissueIdcard(i.id)}><i className="bi bi-arrow-repeat"></i> Reissue</button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => deleteIdcard(i.id)}><i className="bi bi-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
