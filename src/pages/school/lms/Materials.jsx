import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

const EMPTY_FORM = { courseId: '', title: '', description: '', type: 'document', sourceUrl: '', fileUrl: '', isPublished: true, accessLevel: 'enrolled' };

export default function LMSMaterials() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    loadMaterials();
    loadCourses();
  }, []);

  async function loadMaterials() {
    setLoading(true);
    try {
      const d = await apiGet('/school/lms/materials');
      if (d?.ok) setMaterials(d.materials || []);
      else toast(d?.error || 'Failed to load', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  async function loadCourses() {
    const d = await apiGet('/school/lms/courses');
    if (d?.ok) setCourses(d.courses || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title?.trim() || !form.courseId) return toast('Title and course required', 'error');
    if (!form.sourceUrl?.trim() && !form.fileUrl?.trim()) return toast('Provide a source URL or file URL', 'error');
    try {
      const res = editingId
        ? await apiPut(`/school/lms/materials/${editingId}`, form)
        : await apiPost('/school/lms/materials', form);
      if (res?.ok) { toast(editingId ? 'Updated' : 'Created', 'success'); setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); loadMaterials(); }
      else toast(res?.error || 'Save failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  function editMaterial(m) {
    setEditingId(m.id);
    setForm({
      courseId: m.course_id,
      title: m.title,
      description: m.description || '',
      type: m.type || 'document',
      sourceUrl: m.source_url || '',
      fileUrl: m.file_url || '',
      isPublished: Boolean(m.is_published),
      accessLevel: m.access_level || 'enrolled'
    });
    setShowForm(true);
  }

  async function deleteMaterial(id) {
    if (!window.confirm('Delete this material?')) return;
    try {
      const res = await apiDelete(`/school/lms/materials/${id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadMaterials(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <PageShell title="Study Materials" icon="bi-folder" subtitle={`${materials.length} materials`}>
      <div className="d-flex gap-2 mb-3">
        <button className="btn btn-sm btn-primary" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); }}>
          <i className="bi bi-plus"></i> Add Material
        </button>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>{editingId ? 'Edit Material' : 'Add Material'}</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>Course *<select className="form-select form-select-sm" value={form.courseId} onChange={e => setForm({ ...form, courseId: e.target.value })} required>
              <option value="">Select course</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name || c.title}</option>)}
            </select></label>
            <label>Title *<input className="form-control form-control-sm" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></label>
            <label>Type<select className="form-select form-select-sm" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="document">Document</option><option value="pdf">PDF</option><option value="video">Video</option>
              <option value="audio">Audio</option><option value="link">Link</option><option value="image">Image</option><option value="other">Other</option>
            </select></label>
            <label>Access Level<select className="form-select form-select-sm" value={form.accessLevel} onChange={e => setForm({ ...form, accessLevel: e.target.value })}>
              <option value="enrolled">Enrolled students</option><option value="public">Public</option>
              <option value="teacher_only">Teacher only</option><option value="parent">Parents</option>
            </select></label>
            <label>Source URL<input className="form-control form-control-sm" value={form.sourceUrl} onChange={e => setForm({ ...form, sourceUrl: e.target.value })} placeholder="https://..." /></label>
            <label>File URL<input className="form-control form-control-sm" value={form.fileUrl} onChange={e => setForm({ ...form, fileUrl: e.target.value })} placeholder="https://..." /></label>
            <label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input" checked={form.isPublished} onChange={e => setForm({ ...form, isPublished: e.target.checked })} /> Published</label>
            <label className="span-2">Description<textarea className="form-control form-control-sm" rows="2" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
            <div className="span-2 d-flex gap-2">
              <button className="btn btn-sm btn-primary" type="submit"><i className="bi bi-check"></i> {editingId ? 'Save' : 'Create'}</button>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Title</th><th>Course</th><th>Type</th><th>Access</th><th>Published</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7}><Loading /></td></tr> :
            materials.length === 0 ? <tr><td colSpan={7}><Empty text="No materials yet" icon="bi-folder" /></td></tr> :
            materials.map(m => (
              <tr key={m.id}>
                <td>
                  <strong>{m.title}</strong>
                  {(m.file_url || m.source_url) && <div className="small"><a href={m.file_url || m.source_url} target="_blank" rel="noreferrer">Open</a></div>}
                </td>
                <td>{m.course_title || '—'}</td>
                <td><Badge status={m.type}>{m.type}</Badge></td>
                <td>{m.access_level || '—'}</td>
                <td>{m.is_published ? 'Yes' : 'No'}</td>
                <td>{m.created_at ? fmtDate(m.created_at) : '—'}</td>
                <td className="text-end no-print">
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editMaterial(m)}><i className="bi bi-pencil"></i></button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => deleteMaterial(m.id)}><i className="bi bi-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
