import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

export default function LMSAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ courseId: '', title: '', description: '', maxMarks: 100, dueDate: '', allowFileSubmit: true, allowTextSubmit: true });
  const [editingId, setEditingId] = useState(null);
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    loadAssignments();
    loadCourses();
  }, []);

  async function loadAssignments() {
    setLoading(true);
    try {
      const d = await apiGet('/school/lms/assignments');
      if (d?.ok) setAssignments(d.assignments || []);
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
    try {
      const res = editingId
        ? await apiPut(`/school/lms/assignments/${editingId}`, form)
        : await apiPost('/school/lms/assignments', form);
      if (res?.ok) { toast(editingId ? 'Updated' : 'Created', 'success'); setShowForm(false); setEditingId(null); setForm({ courseId: '', title: '', description: '', maxMarks: 100, dueDate: '', allowFileSubmit: true, allowTextSubmit: true }); loadAssignments(); }
      else toast(res?.error || 'Save failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  function editAssignment(a) {
    setEditingId(a.id);
    setForm({ courseId: a.course_id, title: a.title, description: a.description, maxMarks: a.max_marks, dueDate: a.due_date ? a.due_date.slice(0,10) : '', allowFileSubmit: a.allow_file_submit, allowTextSubmit: a.allow_text_submit });
    setShowForm(true);
  }

  async function deleteAssignment(id) {
    if (!window.confirm('Delete this assignment?')) return;
    try {
      const res = await apiDelete(`/school/lms/assignments/${id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadAssignments(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <PageShell title="Assignments" icon="bi-journal-plus" subtitle={`${assignments.length} assignments`}>
      <div className="d-flex gap-2 mb-3">
        <button className="btn btn-sm btn-primary" onClick={() => { setEditingId(null); setForm({ courseId: '', title: '', description: '', maxMarks: 100, dueDate: '', allowFileSubmit: true, allowTextSubmit: true }); setShowForm(true); }}>
          <i className="bi bi-plus"></i> New Assignment
        </button>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>{editingId ? 'Edit Assignment' : 'New Assignment'}</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>Course *<select className="form-select form-select-sm" value={form.courseId} onChange={e => setForm({...form, courseId: e.target.value})} required>
              <option value="">Select course</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title} ({c.subject_name})</option>)}
            </select></label>
            <label>Title *<input className="form-control form-control-sm" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required /></label>
            <label>Max Marks<input type="number" className="form-control form-control-sm" value={form.maxMarks} onChange={e => setForm({...form, maxMarks: e.target.value})} /></label>
            <label>Due Date<input type="date" className="form-control form-control-sm" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} /></label>
            <label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input" checked={form.allowFileSubmit} onChange={e => setForm({...form, allowFileSubmit: e.target.checked})} /> Allow file submit</label>
            <label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input" checked={form.allowTextSubmit} onChange={e => setForm({...form, allowTextSubmit: e.target.checked})} /> Allow text submit</label>
            <label className="span-2">Description<textarea className="form-control form-control-sm" rows="2" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></label>
            <div className="span-2 d-flex gap-2">
              <button className="btn btn-sm btn-primary" type="submit"><i className="bi bi-check"></i> {editingId ? 'Save' : 'Create'}</button>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Title</th><th>Course</th><th>Due Date</th><th>Max Marks</th><th>File</th><th>Text</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="7"><Loading /></td></tr> :
            assignments.length === 0 ? <tr><td colSpan="7"><Empty text="No assignments yet" icon="bi-journal-plus" /></td></tr> :
            assignments.map(a => (
              <tr key={a.id}>
                <td><strong>{a.title}</strong></td>
                <td>{a.course_title || '—'}</td>
                <td>{a.due_date ? fmtDate(a.due_date) : '—'}</td>
                <td>{a.max_marks}</td>
                <td>{a.allow_file_submit ? 'Yes' : 'No'}</td>
                <td>{a.allow_text_submit ? 'Yes' : 'No'}</td>
                <td className="text-end no-print">
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editAssignment(a)}><i className="bi bi-pencil"></i></button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => deleteAssignment(a.id)}><i className="bi bi-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}