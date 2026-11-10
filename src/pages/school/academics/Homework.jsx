import React, { useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../../../api';
import { toast } from '../../../toast';
import {
  Badge, Empty, ErrorBox, Loading, PageShell, canManage, fmtDate, perform, today,
} from './shared';

const emptyForm = (allocationId = '') => ({
  id: null,
  allocationId: allocationId ? String(allocationId) : '',
  title: '',
  description: '',
  assignedDate: today(),
  dueDate: '',
  maxMarks: '',
  attachmentUrl: '',
});

const STATUS_TONE = { draft: 'secondary', published: 'success', closed: 'dark', archived: 'warning' };

function SubmissionRow({ submission, maxMarks, busy, manager, onGrade }) {
  const [marks, setMarks] = useState(submission.marks ?? '');
  const [feedback, setFeedback] = useState(submission.feedback || '');

  return (
    <tr>
      <td className="fw-semibold">
        {submission.first_name} {submission.last_name}
        <div className="small text-muted fw-normal">{submission.admission_no}{submission.roll_no ? ` Ã‚Â· roll ${submission.roll_no}` : ''}</div>
      </td>
      <td className="small">
        {submission.submission_text || <span className="text-muted">No text</span>}
        {submission.attachment_url && <div><a href={submission.attachment_url} target="_blank" rel="noreferrer">Attachment</a></div>}
      </td>
      <td className="small text-nowrap">{fmtDate(submission.submitted_at)}</td>
      <td><Badge tone={submission.status === 'graded' ? 'success' : submission.status === 'late' ? 'warning' : 'info'}>{submission.status}</Badge></td>
      <td>
        <div className="d-flex gap-1 align-items-start">
          <input type="number" className="form-control form-control-sm" style={{ width: 72 }} value={marks} onChange={(event) => setMarks(event.target.value)} disabled={!manager || busy} placeholder="Marks" />
          <input className="form-control form-control-sm" value={feedback} onChange={(event) => setFeedback(event.target.value)} disabled={!manager || busy} placeholder="Feedback" />
          <button type="button" className="btn btn-sm btn-outline-primary text-nowrap" onClick={() => onGrade(submission, marks, feedback)} disabled={!manager || busy}>
            Save{maxMarks ? ` / ${maxMarks}` : ''}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function Homework({ me, onNavigate, academicYearId }) {
  const [allocations, setAllocations] = useState([]);
  const [homework, setHomework] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [filters, setFilters] = useState({ year: academicYearId ? String(academicYearId) : '', class: '', status: '' });
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState({ submissions: [], students: [] });
  const [detailLoading, setDetailLoading] = useState(false);
  const [submissionForm, setSubmissionForm] = useState({ studentId: '', text: '', attachmentUrl: '' });
  const manager = canManage(me);

  async function load() {
    const [allocationResult, homeworkResult] = await Promise.all([
      apiGet('/school/subject-allocations?includeInactive=true'),
      apiGet('/school/homework?includeInactive=true'),
    ]);
    if (!homeworkResult?.ok) throw new Error(homeworkResult?.error || 'Could not load homework');
    if (!allocationResult?.ok) throw new Error(allocationResult?.error || 'Could not load subject allocations');
    setAllocations(allocationResult.allocations || []);
    setHomework(homeworkResult.homework || []);
  }

  async function loadDetail(id) {
    if (!id) { setDetail({ submissions: [], students: [] }); return; }
    setDetailLoading(true);
    try {
      const [submissionResult, studentResult] = await Promise.all([
        apiGet(`/school/homework/${id}/submissions`),
        apiGet(`/school/homework/${id}/eligible-students`),
      ]);
      setDetail({
        submissions: submissionResult?.ok ? submissionResult.submissions || [] : [],
        students: studentResult?.ok ? studentResult.students || [] : [],
      });
      if (!submissionResult?.ok) toast(submissionResult?.error || 'Could not load submissions', 'error');
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    load()
      .catch((err) => { if (active) setError(err.message || 'Could not load homework'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    loadDetail(selectedId);
  }, [selectedId]);

  const years = useMemo(() => {
    const map = new Map();
    homework.forEach((item) => { if (item.academic_year_id) map.set(String(item.academic_year_id), item.academic_year_name); });
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [homework]);

  const classes = useMemo(() => {
    const map = new Map();
    homework.forEach((item) => { if (item.class_id) map.set(String(item.class_id), item.class_name); });
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [homework]);

  const visible = useMemo(() => homework.filter((item) => {
    if (filters.year && String(item.academic_year_id) !== filters.year) return false;
    if (filters.class && String(item.class_id) !== filters.class) return false;
    if (filters.status && item.status !== filters.status) return false;
    return true;
  }), [homework, filters]);

  const selected = homework.find((item) => String(item.id) === String(selectedId)) || null;
  const selectedAllocation = allocations.find((item) => String(item.id) === String(form.allocationId)) || null;

  const selectableAllocations = allocations.filter((item) => (
    item.is_active && !item.academic_year_closed
  ) || String(item.id) === String(form.allocationId));

  const counts = useMemo(() => ({
    draft: homework.filter((item) => item.status === 'draft').length,
    published: homework.filter((item) => item.status === 'published').length,
    closed: homework.filter((item) => item.status === 'closed').length,
    archived: homework.filter((item) => item.status === 'archived').length,
  }), [homework]);

  async function refresh() {
    await load();
    if (selectedId) await loadDetail(selectedId);
  }

  async function submit(event) {
    event.preventDefault();
    if (!manager) return;
    if (!form.allocationId) return window.alert('Choose a subject allocation');
    if (!form.title.trim()) return window.alert('Homework title is required');
    if (!form.dueDate) return window.alert('Due date is required');
    if (form.dueDate < form.assignedDate) return window.alert('Due date cannot be before the assigned date');
    const maxMarks = form.maxMarks === '' ? null : Number(form.maxMarks);
    if (maxMarks !== null && (!Number.isFinite(maxMarks) || maxMarks <= 0)) {
      return window.alert('Max marks must be greater than zero');
    }
    setBusy(true);
    try {
      const body = {
        allocationId: form.allocationId,
        title: form.title.trim(),
        description: form.description.trim(),
        assignedDate: form.assignedDate,
        dueDate: form.dueDate,
        maxMarks,
        attachmentUrl: form.attachmentUrl.trim(),
      };
      const result = form.id
        ? await perform(() => apiPut(`/school/homework/${form.id}`, body), { success: 'Homework updated', refresh })
        : await perform(() => apiPost('/school/homework', body), { success: 'Homework draft created', refresh });
      if (result) {
        setForm(emptyForm(form.allocationId));
        if (!form.id && result.homework?.id) setSelectedId(result.homework.id);
      }
    } finally {
      setBusy(false);
    }
  }

  async function lifecycle(item, action, success) {
    if (!manager) return;
    if (!window.confirm(`${success} Ã¢â‚¬Å“${item.title}Ã¢â‚¬Â?`)) return;
    setBusy(true);
    try {
      await perform(() => apiPost(`/school/homework/${item.id}/${action}`, {}), { success, refresh });
    } finally {
      setBusy(false);
    }
  }

  async function remove(item) {
    if (!manager) return;
    if (!window.confirm(`Delete Ã¢â‚¬Å“${item.title}Ã¢â‚¬Â? Only drafts without submissions can be deleted.`)) return;
    setBusy(true);
    try {
      const result = await perform(() => apiDelete(`/school/homework/${item.id}`), { success: 'Homework deleted', refresh });
      if (result && String(selectedId) === String(item.id)) setSelectedId(null);
    } finally {
      setBusy(false);
    }
  }

  async function grade(submission, marksValue, feedback) {
    if (!manager) return;
    const marks = Number(marksValue);
    if (marksValue === '' || !Number.isFinite(marks) || marks < 0) return toast('Marks must be zero or greater', 'error');
    if (selected?.max_marks != null && marks > Number(selected.max_marks)) {
      return toast(`Marks cannot exceed the homework maximum of ${selected.max_marks}`, 'error');
    }
    setBusy(true);
    try {
      await perform(() => apiPost(`/school/homework/submissions/${submission.id}/grade`, { marks, feedback }), {
        success: 'Submission graded',
        refresh: () => loadDetail(selectedId),
      });
    } finally {
      setBusy(false);
    }
  }

  async function recordSubmission(event) {
    event.preventDefault();
    if (!selected) return;
    if (!submissionForm.studentId) return window.alert('Choose a student');
    setBusy(true);
    try {
      const result = await perform(() => apiPost(`/school/homework/${selected.id}/submit`, {
        studentId: submissionForm.studentId,
        submissionText: submissionForm.text,
        attachmentUrl: submissionForm.attachmentUrl,
      }), { success: 'Submission recorded', refresh: () => loadDetail(selected.id) });
      if (result) setSubmissionForm({ studentId: '', text: '', attachmentUrl: '' });
    } finally {
      setBusy(false);
    }
  }

  function edit(item) {
    setSelectedId(item.id);
    setForm({
      id: item.id,
      allocationId: String(item.allocation_id || ''),
      title: item.title || '',
      description: item.description || '',
      assignedDate: item.assigned_date ? String(item.assigned_date).slice(0, 10) : today(),
      dueDate: item.due_date ? String(item.due_date).slice(0, 10) : '',
      maxMarks: item.max_marks == null ? '' : String(item.max_marks),
      attachmentUrl: item.attachment_url || '',
    });
  }

  function allocationLabel(allocation) {
    return `${allocation.academic_year_name} Ã‚Â· ${allocation.class_name} ${allocation.section_name} Ã‚Â· ${allocation.subject_name}${allocation.teacher_display ? ` Ã¢â‚¬â€ ${allocation.teacher_display}` : ''}`;
  }

  return (
    <PageShell
      title="Homework"
      icon="bi-journal-text"
      subtitle="Draft, publish, close and archive assignments. Eligible students come from enrollment, not typed IDs."
      onNavigate={onNavigate}
      actions={(
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { load().catch((err) => setError(err.message)); }} disabled={loading || busy}>
          <i className="bi bi-arrow-clockwise me-1"></i>Refresh
        </button>
      )}
    >
      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Drafts</div><div className="fs-5 fw-bold">{counts.draft}</div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Published</div><div className="fs-5 fw-bold">{counts.published}</div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Closed</div><div className="fs-5 fw-bold">{counts.closed}</div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Archived</div><div className="fs-5 fw-bold">{counts.archived}</div></div></div>
      </div>

      <ErrorBox message={error} onRetry={() => { setError(''); setLoading(true); load().catch((err) => setError(err.message)).finally(() => setLoading(false)); }} />

      <div className="row g-3">
        <div className="col-lg-4">
          <div className="border rounded p-3">
            <h6 className="fw-bold">{form.id ? 'Edit homework' : 'Create homework draft'}</h6>
            <form onSubmit={submit}>
              <label className="form-label small">Subject allocation *</label>
              <select className="form-select form-select-sm mb-2" value={form.allocationId} onChange={(event) => setForm({ ...form, allocationId: event.target.value })} disabled={!manager || busy || Boolean(form.id && selected?.status !== 'draft')}>
                <option value="">Choose year/class/section/subject</option>
                {selectableAllocations.map((allocation) => (
                  <option key={allocation.id} value={allocation.id}>{allocationLabel(allocation)}</option>
                ))}
              </select>
              {selectedAllocation && (
                <div className="small text-muted mb-2">
                  {selectedAllocation.academic_year_name} Ã‚Â· {selectedAllocation.class_name} {selectedAllocation.section_name}
                  {selectedAllocation.academic_year_closed ? ' Ã‚Â· closed year' : ''}
                </div>
              )}

              <label className="form-label small">Title *</label>
              <input className="form-control form-control-sm mb-2" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} disabled={!manager || busy} />

              <label className="form-label small">Instructions</label>
              <textarea className="form-control form-control-sm mb-2" rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} disabled={!manager || busy}></textarea>

              <div className="row g-2">
                <div className="col-6">
                  <label className="form-label small">Assigned date</label>
                  <input type="date" className="form-control form-control-sm mb-2" value={form.assignedDate} onChange={(event) => setForm({ ...form, assignedDate: event.target.value })} disabled={!manager || busy} />
                </div>
                <div className="col-6">
                  <label className="form-label small">Due date *</label>
                  <input type="date" className="form-control form-control-sm mb-2" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} disabled={!manager || busy} />
                </div>
              </div>

              <label className="form-label small">Max marks (optional)</label>
              <input type="number" className="form-control form-control-sm mb-2" value={form.maxMarks} onChange={(event) => setForm({ ...form, maxMarks: event.target.value })} disabled={!manager || busy} />

              <label className="form-label small">Attachment URL (optional)</label>
              <input className="form-control form-control-sm mb-2" value={form.attachmentUrl} onChange={(event) => setForm({ ...form, attachmentUrl: event.target.value })} disabled={!manager || busy} />

              <div className="d-flex gap-2 flex-wrap">
                <button className="btn btn-sm btn-primary" disabled={!manager || busy}><i className="bi bi-check2 me-1"></i>{form.id ? 'Save' : 'Create draft'}</button>
                {form.id && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setForm(emptyForm())} disabled={busy}>New</button>}
              </div>
              {!manager && <div className="small text-muted mt-2">You have read-only access to academics.</div>}
            </form>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="row g-2 mb-2">
            <div className="col-6 col-md-4">
              <select className="form-select form-select-sm" value={filters.year} onChange={(event) => setFilters({ ...filters, year: event.target.value })}>
                <option value="">All years</option>
                {years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-4">
              <select className="form-select form-select-sm" value={filters.class} onChange={(event) => setFilters({ ...filters, class: event.target.value })}>
                <option value="">All classes</option>
                {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="col-12 col-md-4">
              <select className="form-select form-select-sm" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
                <option value="">All statuses</option>
                {['draft', 'published', 'closed', 'archived'].map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
          </div>

          {loading ? <Loading text="Loading homeworkÃ¢â‚¬Â¦" /> : visible.length === 0 ? (
            <Empty icon="bi-journal-text" text="No homework matches this view. Create a draft from an active subject allocation." />
          ) : (
            <div className="table-responsive border rounded">
              <table className="table table-sm mb-0 align-middle">
                <thead><tr><th>Assignment</th><th>Class / subject</th><th>Dates</th><th>Submissions</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
                <tbody>
                  {visible.map((item) => (
                    <tr key={item.id} className={String(item.id) === String(selectedId) ? 'table-active' : ''}>
                      <td>
                        <button type="button" className="btn btn-link p-0 fw-semibold text-decoration-none" onClick={() => setSelectedId(item.id)}>{item.title}</button>
                        <div className="small text-muted">{item.academic_year_name} Ã‚Â· {item.teacher_display}</div>
                      </td>
                      <td className="small">{item.class_name} {item.section_name}<div className="text-muted">{item.subject_name}</div></td>
                      <td className="small text-nowrap">{fmtDate(item.assigned_date)} Ã¢â€ â€™ {fmtDate(item.due_date)}</td>
                      <td className="small">{item.submission_count} <span className="text-muted">({item.graded_count} graded)</span></td>
                      <td><Badge tone={STATUS_TONE[item.status] || 'secondary'}>{item.status}</Badge></td>
                      <td className="text-end">
                        <div className="d-flex gap-1 justify-content-end flex-wrap">
                          {(item.status === 'draft' || item.status === 'published') && (
                            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => edit(item)} disabled={!manager || busy}><i className="bi bi-pencil"></i></button>
                          )}
                          {item.status === 'draft' && <button type="button" className="btn btn-sm btn-outline-success" onClick={() => lifecycle(item, 'publish', 'Publish')} disabled={!manager || busy}>Publish</button>}
                          {item.status === 'published' && <button type="button" className="btn btn-sm btn-outline-dark" onClick={() => lifecycle(item, 'close', 'Close')} disabled={!manager || busy}>Close</button>}
                          {item.status !== 'archived' && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => lifecycle(item, 'archive', 'Archive')} disabled={!manager || busy}>Archive</button>}
                          {item.status === 'draft' && <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remove(item)} disabled={!manager || busy}><i className="bi bi-trash"></i></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selected && (
            <div className="border rounded p-3 mt-3">
              <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap mb-2">
                <div>
                  <div className="fw-bold">{selected.title}</div>
                  <div className="small text-muted">
                    {selected.class_name} {selected.section_name} Ã‚Â· {selected.subject_name} Ã‚Â· max {selected.max_marks ?? 'Ã¢â‚¬â€'} marks
                  </div>
                </div>
                <Badge tone={STATUS_TONE[selected.status] || 'secondary'}>{selected.status}</Badge>
              </div>

              {selected.description && <p className="small mb-2">{selected.description}</p>}
              {selected.attachment_url && <p className="small mb-2"><a href={selected.attachment_url} target="_blank" rel="noreferrer">Open attachment</a></p>}

              {detailLoading ? <Loading text="Loading submissionsÃ¢â‚¬Â¦" /> : (
                <>
                  <div className="small text-muted mb-2">
                    {detail.students.length} eligible student(s) Ã‚Â· {detail.submissions.length} submission(s)
                    {selected.status !== 'published' && ' Ã‚Â· submissions are accepted only while published'}
                  </div>

                  <div className="table-responsive border rounded mb-3">
                    <table className="table table-sm mb-0 align-middle">
                      <thead><tr><th>Student</th><th>Submission</th><th>Submitted</th><th>Status</th><th>Grade</th></tr></thead>
                      <tbody>
                        {detail.submissions.map((submission) => (
                          <SubmissionRow
                            key={submission.id}
                            submission={submission}
                            maxMarks={selected.max_marks}
                            busy={busy}
                            manager={manager}
                            onGrade={grade}
                          />
                        ))}
                        {!detail.submissions.length && (
                          <tr><td colSpan="5" className="text-muted small">No submissions yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {selected.status === 'published' && (
                    <form onSubmit={recordSubmission} className="border rounded p-2">
                      <div className="fw-semibold small mb-2">Record a submission (front office)</div>
                      <div className="row g-2">
                        <div className="col-12 col-md-4">
                          <select className="form-select form-select-sm" value={submissionForm.studentId} onChange={(event) => setSubmissionForm({ ...submissionForm, studentId: event.target.value })} disabled={busy}>
                            <option value="">Choose eligible student</option>
                            {detail.students.map((student) => (
                              <option key={student.id} value={student.id}>{student.first_name} {student.last_name} ({student.admission_no})</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-12 col-md-4">
                          <input className="form-control form-control-sm" placeholder="Submission text" value={submissionForm.text} onChange={(event) => setSubmissionForm({ ...submissionForm, text: event.target.value })} disabled={busy} />
                        </div>
                        <div className="col-12 col-md-2">
                          <input className="form-control form-control-sm" placeholder="Attachment URL" value={submissionForm.attachmentUrl} onChange={(event) => setSubmissionForm({ ...submissionForm, attachmentUrl: event.target.value })} disabled={busy} />
                        </div>
                        <div className="col-12 col-md-2">
                          <button className="btn btn-sm btn-outline-primary w-100" disabled={busy}>Record</button>
                        </div>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

