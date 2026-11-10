import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

const EMPTY_FORM = { title: '', code: '', description: '', subjectId: '', classId: '', sectionId: '', teacherId: '', status: 'draft' };

export default function LMSCourses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);

  useEffect(() => {
    loadCourses();
    loadRefs();
  }, []);

  async function loadCourses() {
    setLoading(true);
    try {
      const d = await apiGet('/school/lms/courses');
      if (d?.ok) setCourses(d.courses || []);
      else toast(d?.error || 'Failed to load courses', 'error');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadRefs() {
    try {
      const [subs, cls, tchs] = await Promise.all([
        apiGet('/school/subjects'),
        apiGet('/school/classes'),
        apiGet('/school/academics/teachers')
      ]);
      if (subs?.ok) setSubjects(subs.subjects || []);
      if (cls?.ok) setClasses(cls.classes || []);
      if (tchs?.ok) setTeachers(tchs.teachers || []);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title?.trim() || !form.subjectId) return toast('Title and subject are required', 'error');
    try {
      const res = editingId
        ? await apiPut(`/school/lms/courses/${editingId}`, form)
        : await apiPost('/school/lms/courses', form);
      if (res?.ok) {
        toast(editingId ? 'Course updated' : 'Course created', 'success');
        setShowForm(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
        loadCourses();
      } else toast(res?.error || 'Save failed', 'error');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function editCourse(c) {
    setEditingId(c.id);
    setForm({
      title: c.name || c.title || '',
      code: c.code || '',
      description: c.description || '',
      subjectId: c.subject_id || '',
      classId: c.class_id || '',
      sectionId: c.section_id || '',
      teacherId: c.teachers?.[0]?.id || '',
      status: c.status || 'draft'
    });
    setShowForm(true);
  }

  async function deleteCourse(id) {
    if (!window.confirm('Delete this course?')) return;
    try {
      const res = await apiDelete(`/school/lms/courses/${id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadCourses(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  const selectedClass = classes.find(c => String(c.id) === String(form.classId));
  const sections = selectedClass?.sections || [];

  return (
    <PageShell title="Courses" icon="bi-book" subtitle={`${courses.length} courses`}>
      <div className="d-flex gap-2 mb-3">
        <button className="btn btn-sm btn-primary" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); }}>
          <i className="bi bi-plus"></i> Add Course
        </button>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>{editingId ? 'Edit Course' : 'New Course'}</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>Course Name *<input className="form-control form-control-sm" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></label>
            <label>Code<input className="form-control form-control-sm" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="Auto-generated if blank" /></label>
            <label>Subject *<select className="form-select form-select-sm" value={form.subjectId} onChange={e => setForm({ ...form, subjectId: e.target.value })} required>
              <option value="">Select subject</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
            <label>Class<select className="form-select form-select-sm" value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value, sectionId: '' })}>
              <option value="">Select class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
            <label>Section<select className="form-select form-select-sm" value={form.sectionId} onChange={e => setForm({ ...form, sectionId: e.target.value })} disabled={!form.classId}>
              <option value="">Select section</option>
              {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
            <label>Teacher<select className="form-select form-select-sm" value={form.teacherId} onChange={e => setForm({ ...form, teacherId: e.target.value })}>
              <option value="">Select teacher</option>
              {teachers.map(t => <option key={t.staff_id || t.id} value={t.staff_id || t.id}>{t.name}</option>)}
            </select></label>
            <label>Status<select className="form-select form-select-sm" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option>
            </select></label>
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
          <thead><tr><th>Course</th><th>Subject</th><th>Class</th><th>Teacher</th><th>Created</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7}><Loading /></td></tr> :
            courses.length === 0 ? <tr><td colSpan={7}><Empty text="No courses yet" icon="bi-book" /></td></tr> :
            courses.map(c => (
              <tr key={c.id}>
                <td><strong>{c.name || c.title}</strong>{c.code ? <div className="text-muted small">{c.code}</div> : null}</td>
                <td>{c.subject_name || '—'}</td>
                <td>{c.class_name || '—'}{c.section_name ? ` / ${c.section_name}` : ''}</td>
                <td>{c.teacher_name || '—'}</td>
                <td>{c.created_at ? fmtDate(c.created_at) : '—'}</td>
                <td><Badge status={c.status}>{c.status}</Badge></td>
                <td className="text-end no-print">
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editCourse(c)}><i className="bi bi-pencil"></i></button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => deleteCourse(c.id)}><i className="bi bi-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
