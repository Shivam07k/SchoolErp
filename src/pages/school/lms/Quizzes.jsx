import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

const EMPTY_FORM = { courseId: '', title: '', description: '', type: 'formative', durationMinutes: 30, maxAttempts: 1, passingScore: 0, startTime: '', endTime: '', shuffleQuestions: false, shuffleOptions: false, status: 'draft' };

export default function LMSQuizzes() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    loadQuizzes();
    loadCourses();
  }, []);

  async function loadQuizzes() {
    setLoading(true);
    try {
      const d = await apiGet('/school/lms/quizzes');
      if (d?.ok) setQuizzes(d.quizzes || []);
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
        ? await apiPut(`/school/lms/quizzes/${editingId}`, form)
        : await apiPost('/school/lms/quizzes', form);
      if (res?.ok) { toast(editingId ? 'Updated' : 'Created', 'success'); setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); loadQuizzes(); }
      else toast(res?.error || 'Save failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  function editQuiz(q) {
    setEditingId(q.id);
    setForm({
      courseId: q.course_id,
      title: q.title,
      description: q.description || '',
      type: q.type || 'formative',
      durationMinutes: q.time_limit_minutes || q.duration_minutes || 30,
      maxAttempts: q.max_attempts || 1,
      passingScore: q.passing_score_pct || 0,
      startTime: q.release_at ? String(q.release_at).slice(0, 16) : '',
      endTime: q.due_at ? String(q.due_at).slice(0, 16) : '',
      shuffleQuestions: Boolean(q.shuffle_questions),
      shuffleOptions: Boolean(q.shuffle_options),
      status: q.status || 'draft'
    });
    setShowForm(true);
  }

  async function deleteQuiz(id) {
    if (!window.confirm('Delete this quiz?')) return;
    try {
      const res = await apiDelete(`/school/lms/quizzes/${id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadQuizzes(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <PageShell title="Quizzes" icon="bi-question-circle" subtitle={`${quizzes.length} quizzes`}>
      <div className="d-flex gap-2 mb-3">
        <button className="btn btn-sm btn-primary" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); }}>
          <i className="bi bi-plus"></i> New Quiz
        </button>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>{editingId ? 'Edit Quiz' : 'New Quiz'}</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>Course *<select className="form-select form-select-sm" value={form.courseId} onChange={e => setForm({ ...form, courseId: e.target.value })} required>
              <option value="">Select course</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name || c.title}</option>)}
            </select></label>
            <label>Title *<input className="form-control form-control-sm" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></label>
            <label>Type<select className="form-select form-select-sm" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="practice">Practice</option><option value="formative">Formative</option>
              <option value="summative">Summative</option><option value="exam">Exam</option><option value="diagnostic">Diagnostic</option>
            </select></label>
            <label>Duration (min)<input type="number" className="form-control form-control-sm" value={form.durationMinutes} onChange={e => setForm({ ...form, durationMinutes: e.target.value })} /></label>
            <label>Passing Score (%)<input type="number" step="0.01" className="form-control form-control-sm" value={form.passingScore} onChange={e => setForm({ ...form, passingScore: e.target.value })} /></label>
            <label>Max Attempts<input type="number" className="form-control form-control-sm" value={form.maxAttempts} onChange={e => setForm({ ...form, maxAttempts: e.target.value })} /></label>
            <label>Start Time<input type="datetime-local" className="form-control form-control-sm" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} /></label>
            <label>End Time<input type="datetime-local" className="form-control form-control-sm" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} /></label>
            <label>Status<select className="form-select form-select-sm" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="draft">Draft</option><option value="published">Published</option><option value="closed">Closed</option>
            </select></label>
            <label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input" checked={form.shuffleQuestions} onChange={e => setForm({ ...form, shuffleQuestions: e.target.checked })} /> Shuffle Questions</label>
            <label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input" checked={form.shuffleOptions} onChange={e => setForm({ ...form, shuffleOptions: e.target.checked })} /> Shuffle Options</label>
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
          <thead><tr><th>Title</th><th>Course</th><th>Type</th><th>Duration</th><th>Attempts</th><th>Start</th><th>End</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={9}><Loading /></td></tr> :
            quizzes.length === 0 ? <tr><td colSpan={9}><Empty text="No quizzes yet" icon="bi-question-circle" /></td></tr> :
            quizzes.map(q => (
              <tr key={q.id}>
                <td><strong>{q.title}</strong></td>
                <td>{q.course_title || '—'}</td>
                <td>{q.type}</td>
                <td>{q.time_limit_minutes ? `${q.time_limit_minutes} min` : '—'}</td>
                <td>{q.max_attempts}</td>
                <td>{q.release_at ? new Date(q.release_at).toLocaleString() : '—'}</td>
                <td>{q.due_at ? new Date(q.due_at).toLocaleString() : '—'}</td>
                <td><Badge status={q.status}>{q.status}</Badge></td>
                <td className="text-end no-print">
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editQuiz(q)}><i className="bi bi-pencil"></i></button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => deleteQuiz(q.id)}><i className="bi bi-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
