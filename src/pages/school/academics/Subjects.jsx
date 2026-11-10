import React, { useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../../../api';
import {
  Badge, Empty, ErrorBox, Loading, PageShell, StatusBadge, canManage, perform,
} from './shared';

const emptyForm = { id: null, name: '', code: '', classId: '', maxMarks: '100', isActive: true };

export default function Subjects({ me, onNavigate }) {
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [form, setForm] = useState(emptyForm);
  const manager = canManage(me);

  async function load() {
    const [subjectResult, classResult] = await Promise.all([
      apiGet('/school/subjects?includeInactive=true'),
      apiGet('/school/classes?includeInactive=true'),
    ]);
    if (!subjectResult?.ok) throw new Error(subjectResult?.error || 'Could not load subjects');
    setSubjects(subjectResult.subjects || []);
    if (classResult?.ok) setClasses(classResult.classes || []);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    load()
      .catch((err) => { if (active) setError(err.message || 'Could not load subjects'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => subjects.filter((subject) => {
    if (!showArchived && !subject.is_active) return false;
    if (classFilter && String(subject.class_id || '') !== String(classFilter)) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return String(subject.name || '').toLowerCase().includes(needle)
      || String(subject.code || '').toLowerCase().includes(needle);
  }), [subjects, showArchived, classFilter, query]);

  const activeCount = subjects.filter((subject) => subject.is_active).length;
  const globalCount = subjects.filter((subject) => subject.is_active && !subject.class_id).length;
  const classCount = activeCount - globalCount;

  async function refresh() {
    await load();
  }

  async function submit(event) {
    event.preventDefault();
    if (!manager) return;
    const name = form.name.trim();
    const maxMarks = Number(form.maxMarks);
    if (!name) return window.alert('Subject name is required');
    if (!Number.isInteger(maxMarks) || maxMarks <= 0) {
      return window.alert('Maximum marks must be a whole number greater than zero');
    }
    setBusy(true);
    try {
      const body = {
        name,
        code: form.code.trim().toUpperCase(),
        classId: form.classId,
        maxMarks,
        isActive: form.isActive,
      };
      const result = form.id
        ? await perform(() => apiPut(`/school/subjects/${form.id}`, body), { success: 'Subject updated', refresh })
        : await perform(() => apiPost('/school/subjects', body), { success: 'Subject created', refresh });
      if (result) setForm(emptyForm);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(subject) {
    if (!manager) return;
    if (!window.confirm(`${subject.is_active ? 'Archive' : 'Restore'} ${subject.name}?`)) return;
    setBusy(true);
    try {
      await perform(() => apiPut(`/school/subjects/${subject.id}`, {
        name: subject.name,
        code: subject.code || '',
        classId: subject.class_id,
        maxMarks: subject.max_marks,
        isActive: !subject.is_active,
      }), { success: subject.is_active ? 'Subject archived' : 'Subject restored', refresh });
    } finally {
      setBusy(false);
    }
  }

  async function remove(subject) {
    if (!manager) return;
    if (!window.confirm(`Delete ${subject.name}? This only succeeds when nothing references it.`)) return;
    setBusy(true);
    try {
      await perform(() => apiDelete(`/school/subjects/${subject.id}`), { success: 'Subject deleted', refresh });
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      title="Subjects"
      icon="bi-book"
      subtitle="The canonical subject catalog. Teaching assignments belong in Subject Allocation."
      onNavigate={onNavigate}
      actions={(
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { load().catch((err) => setError(err.message)); }} disabled={loading || busy}>
          <i className="bi bi-arrow-clockwise me-1"></i>Refresh
        </button>
      )}
    >
      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Active subjects</div><div className="fs-5 fw-bold">{activeCount}</div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">School-wide</div><div className="fs-5 fw-bold">{globalCount}</div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Class-restricted</div><div className="fs-5 fw-bold">{classCount}</div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Archived</div><div className="fs-5 fw-bold">{subjects.length - activeCount}</div></div></div>
      </div>

      <ErrorBox message={error} onRetry={() => { setError(''); setLoading(true); load().catch((err) => setError(err.message)).finally(() => setLoading(false)); }} />

      <div className="row g-3">
        <div className="col-lg-4">
          <div className="border rounded p-3">
            <h6 className="fw-bold">{form.id ? 'Edit subject' : 'Add subject'}</h6>
            <form onSubmit={submit}>
              <label className="form-label small">Subject name *</label>
              <input className="form-control form-control-sm mb-2" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} disabled={!manager || busy} />

              <label className="form-label small">Code</label>
              <input className="form-control form-control-sm mb-2" value={form.code} placeholder="e.g. MATH-6" onChange={(event) => setForm({ ...form, code: event.target.value })} disabled={!manager || busy} />
              <div className="form-text small mt-0 mb-2">Letters, numbers, dot, dash and underscore only. Codes are unique per school.</div>

              <label className="form-label small">Eligibility</label>
              <select className="form-select form-select-sm mb-2" value={form.classId} onChange={(event) => setForm({ ...form, classId: event.target.value })} disabled={!manager || busy}>
                <option value="">School-wide (all classes)</option>
                {classes.filter((item) => item.is_active || String(item.id) === String(form.classId)).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}{item.stream ? ` Ã‚Â· ${item.stream}` : ''}</option>
                ))}
              </select>

              <label className="form-label small">Default max marks</label>
              <input type="number" className="form-control form-control-sm mb-2" value={form.maxMarks} onChange={(event) => setForm({ ...form, maxMarks: event.target.value })} disabled={!manager || busy} />

              <div className="form-check form-switch mb-2">
                <input className="form-check-input" type="checkbox" id="subject-active" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} disabled={!manager || busy} />
                <label className="form-check-label small" htmlFor="subject-active">Active</label>
              </div>

              <div className="d-flex gap-2">
                <button className="btn btn-sm btn-primary" disabled={!manager || busy}><i className="bi bi-check2 me-1"></i>{form.id ? 'Save' : 'Create'}</button>
                {form.id && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setForm(emptyForm)} disabled={busy}>Cancel</button>}
              </div>
              {!manager && <div className="small text-muted mt-2">You have read-only access to academics.</div>}
            </form>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="row g-2 mb-2">
            <div className="col-sm-6">
              <input className="form-control form-control-sm" placeholder="Search name or codeÃ¢â‚¬Â¦" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <div className="col-sm-6">
              <select className="form-select form-select-sm" value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
                <option value="">All eligibility</option>
                {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-check form-switch mb-3">
            <input className="form-check-input" type="checkbox" id="subjects-show-archived" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
            <label className="form-check-label" htmlFor="subjects-show-archived">Show archived subjects</label>
          </div>

          {loading ? <Loading text="Loading subjectsÃ¢â‚¬Â¦" /> : visible.length === 0 ? (
            <Empty icon="bi-book" text="No subjects match this view. Create a subject to start the catalog." />
          ) : (
            <div className="table-responsive border rounded">
              <table className="table table-sm mb-0 align-middle">
                <thead><tr><th>Subject</th><th>Code</th><th>Eligibility</th><th>Max marks</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
                <tbody>
                  {visible.map((subject) => (
                    <tr key={subject.id}>
                      <td className="fw-semibold">{subject.name}</td>
                      <td>{subject.code || <span className="text-muted">Ã¢â‚¬â€</span>}</td>
                      <td>{subject.class_name || <Badge tone="info">School-wide</Badge>}</td>
                      <td>{subject.max_marks ?? 'Ã¢â‚¬â€'}</td>
                      <td><StatusBadge active={subject.is_active} /></td>
                      <td className="text-end">
                        <div className="d-flex gap-1 justify-content-end">
                          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setForm({
                            id: subject.id,
                            name: subject.name,
                            code: subject.code || '',
                            classId: subject.class_id ? String(subject.class_id) : '',
                            maxMarks: String(subject.max_marks ?? 100),
                            isActive: subject.is_active !== false,
                          })} disabled={!manager || busy}><i className="bi bi-pencil"></i></button>
                          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => toggle(subject)} disabled={!manager || busy}>{subject.is_active ? 'Archive' : 'Restore'}</button>
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remove(subject)} disabled={!manager || busy}><i className="bi bi-trash"></i></button>
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
    </PageShell>
  );
}

