import React, { useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../../../api';
import {
  Badge, Empty, ErrorBox, Loading, PageShell, StatusBadge, canManage, perform,
} from './shared';

const emptyClass = { id: null, name: '', stream: '', sortOrder: '0', isActive: true };
const emptySection = { id: null, classId: '', name: 'A', capacity: 40, classTeacherId: '', isActive: true };

export default function ClassesSections({ me, onNavigate }) {
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [classForm, setClassForm] = useState(emptyClass);
  const [sectionForm, setSectionForm] = useState(emptySection);
  const manager = canManage(me);

  async function load() {
    const [classResult, teacherResult] = await Promise.all([
      apiGet('/school/classes?includeInactive=true'),
      apiGet('/school/academics/teachers'),
    ]);
    if (!classResult?.ok) throw new Error(classResult?.error || 'Could not load classes');
    setClasses(classResult.classes || []);
    setSubjects(classResult.subjects || []);
    if (teacherResult?.ok) setTeachers(teacherResult.teachers || []);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    load()
      .catch((err) => { if (active) setError(err.message || 'Could not load classes'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visibleClasses = useMemo(
    () => classes.filter((item) => showArchived || item.is_active),
    [classes, showArchived],
  );
  const sectionCount = classes.reduce((sum, item) => sum + (item.sections || []).length, 0);
  const studentCount = classes.reduce((sum, item) => sum + Number(item.students || 0), 0);
  const activeSectionCount = classes.reduce(
    (sum, item) => sum + (item.sections || []).filter((section) => section.is_active).length, 0,
  );

  async function refresh() {
    await load();
  }

  async function submitClass(event) {
    event.preventDefault();
    if (!manager) return;
    const sortOrder = Number(classForm.sortOrder || 0);
    if (!classForm.name.trim()) return window.alert('Class name is required');
    if (!Number.isInteger(sortOrder)) return window.alert('Sort order must be a whole number');
    setBusy(true);
    try {
      const body = {
        name: classForm.name.trim(),
        stream: classForm.stream.trim(),
        sortOrder,
        isActive: classForm.isActive,
      };
      const result = classForm.id
        ? await perform(() => apiPut(`/school/classes/${classForm.id}`, body), { success: 'Class updated', refresh })
        : await perform(() => apiPost('/school/classes', body), { success: 'Class created', refresh });
      if (result) setClassForm(emptyClass);
    } finally {
      setBusy(false);
    }
  }

  async function submitSection(event) {
    event.preventDefault();
    if (!manager) return;
    const capacity = Number(sectionForm.capacity);
    if (!sectionForm.classId) return window.alert('Choose a class for the section');
    if (!sectionForm.name.trim()) return window.alert('Section name is required');
    if (!Number.isInteger(capacity) || capacity <= 0) return window.alert('Capacity must be a whole number greater than zero');
    setBusy(true);
    try {
      const body = {
        classId: sectionForm.classId,
        name: sectionForm.name.trim(),
        capacity,
        classTeacherId: sectionForm.classTeacherId || null,
        isActive: sectionForm.isActive,
      };
      const result = sectionForm.id
        ? await perform(() => apiPut(`/school/sections/${sectionForm.id}`, body), { success: 'Section updated', refresh })
        : await perform(() => apiPost('/school/sections', body), { success: 'Section created', refresh });
      if (result) setSectionForm({ ...emptySection, classId: sectionForm.classId });
    } finally {
      setBusy(false);
    }
  }

  async function toggleClass(item) {
    if (!manager) return;
    if (!window.confirm(`${item.is_active ? 'Archive' : 'Restore'} ${item.name}?`)) return;
    setBusy(true);
    try {
      await perform(() => apiPut(`/school/classes/${item.id}`, {
        name: item.name, stream: item.stream || '', sortOrder: item.sort_order, isActive: !item.is_active,
      }), { success: item.is_active ? 'Class archived' : 'Class restored', refresh });
    } finally { setBusy(false); }
  }

  async function removeClass(item) {
    if (!manager) return;
    if (!window.confirm(`Delete ${item.name}? This only succeeds when nothing references it.`)) return;
    setBusy(true);
    try {
      await perform(() => apiDelete(`/school/classes/${item.id}`), { success: 'Class deleted', refresh });
    } finally { setBusy(false); }
  }

  async function toggleSection(item) {
    if (!manager) return;
    if (!window.confirm(`${item.is_active ? 'Archive' : 'Restore'} section ${item.name}?`)) return;
    setBusy(true);
    try {
      await perform(() => apiPut(`/school/sections/${item.id}`, {
        classId: item.classId || item.class_id,
        name: item.name,
        capacity: item.capacity,
        classTeacherId: item.classTeacherId || item.classTeacher || item.class_teacher_id || null,
        isActive: !item.is_active,
      }), { success: item.is_active ? 'Section archived' : 'Section restored', refresh });
    } finally { setBusy(false); }
  }

  async function removeSection(item) {
    if (!manager) return;
    if (!window.confirm(`Delete section ${item.name}? This only succeeds when nothing references it.`)) return;
    setBusy(true);
    try {
      await perform(() => apiDelete(`/school/sections/${item.id}`), { success: 'Section deleted', refresh });
    } finally { setBusy(false); }
  }

  function editSection(classId, section) {
    setSectionForm({
      id: section.id,
      classId,
      name: section.name,
      capacity: section.capacity,
      classTeacherId: section.classTeacherId || section.classTeacher || section.class_teacher_id || '',
      isActive: section.is_active !== false,
    });
  }

  return (
    <PageShell
      title="Classes & Sections"
      icon="bi-diagram-3"
      subtitle="The class hierarchy every enrollment, timetable, exam and homework record depends on."
      onNavigate={onNavigate}
      actions={<button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { load().catch((err) => setError(err.message)); }} disabled={loading || busy}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>}
    >
      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Classes</div><div className="fs-5 fw-bold">{classes.filter((item) => item.is_active).length}</div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Sections</div><div className="fs-5 fw-bold">{activeSectionCount}</div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Active students</div><div className="fs-5 fw-bold">{studentCount}</div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Subject records</div><div className="fs-5 fw-bold">{subjects.length}</div></div></div>
      </div>

      <ErrorBox message={error} onRetry={() => { setError(''); setLoading(true); load().catch((err) => setError(err.message)).finally(() => setLoading(false)); }} />

      <div className="form-check form-switch mb-3">
        <input className="form-check-input" type="checkbox" id="classes-show-archived" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
        <label className="form-check-label" htmlFor="classes-show-archived">Show archived classes and sections</label>
      </div>

      <div className="row g-3">
        <div className="col-lg-4">
          <div className="border rounded p-3 mb-3">
            <h6 className="fw-bold">{classForm.id ? 'Edit class' : 'Add class'}</h6>
            <form onSubmit={submitClass}>
              <label className="form-label small">Class name *</label>
              <input className="form-control form-control-sm mb-2" value={classForm.name} onChange={(event) => setClassForm({ ...classForm, name: event.target.value })} disabled={!manager || busy} />
              <label className="form-label small">Stream</label>
              <input className="form-control form-control-sm mb-2" value={classForm.stream} onChange={(event) => setClassForm({ ...classForm, stream: event.target.value })} placeholder="e.g. Science" disabled={!manager || busy} />
              <label className="form-label small">Sort order</label>
              <input type="number" className="form-control form-control-sm mb-2" value={classForm.sortOrder} onChange={(event) => setClassForm({ ...classForm, sortOrder: event.target.value })} disabled={!manager || busy} />
              <div className="form-check form-switch mb-2">
                <input className="form-check-input" type="checkbox" id="class-active" checked={classForm.isActive} onChange={(event) => setClassForm({ ...classForm, isActive: event.target.checked })} disabled={!manager || busy} />
                <label className="form-check-label small" htmlFor="class-active">Active</label>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-sm btn-primary" disabled={!manager || busy}><i className="bi bi-check2 me-1"></i>{classForm.id ? 'Save' : 'Create'}</button>
                {classForm.id && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setClassForm(emptyClass)} disabled={busy}>Cancel</button>}
              </div>
              {!manager && <div className="small text-muted mt-2">You have read-only access to academics.</div>}
            </form>
          </div>

          <div className="border rounded p-3">
            <h6 className="fw-bold">{sectionForm.id ? 'Edit section' : 'Add section'}</h6>
            <form onSubmit={submitSection}>
              <label className="form-label small">Class *</label>
              <select className="form-select form-select-sm mb-2" value={sectionForm.classId} onChange={(event) => setSectionForm({ ...sectionForm, classId: event.target.value })} disabled={!manager || busy}>
                <option value="">Choose class</option>
                {classes.filter((item) => item.is_active || String(item.id) === String(sectionForm.classId)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <label className="form-label small">Section name *</label>
              <input className="form-control form-control-sm mb-2" value={sectionForm.name} onChange={(event) => setSectionForm({ ...sectionForm, name: event.target.value })} disabled={!manager || busy} />
              <label className="form-label small">Capacity *</label>
              <input type="number" className="form-control form-control-sm mb-2" value={sectionForm.capacity} onChange={(event) => setSectionForm({ ...sectionForm, capacity: event.target.value })} disabled={!manager || busy} />
              <label className="form-label small">Class teacher</label>
              <select className="form-select form-select-sm mb-2" value={sectionForm.classTeacherId} onChange={(event) => setSectionForm({ ...sectionForm, classTeacherId: event.target.value })} disabled={!manager || busy}>
                <option value="">Not assigned</option>
                {teachers.map((teacher) => <option key={`${teacher.source}-${teacher.id}`} value={teacher.id}>{teacher.name}{teacher.designation ? ` Ã‚Â· ${teacher.designation}` : ''}</option>)}
              </select>
              <div className="form-check form-switch mb-2">
                <input className="form-check-input" type="checkbox" id="section-active" checked={sectionForm.isActive} onChange={(event) => setSectionForm({ ...sectionForm, isActive: event.target.checked })} disabled={!manager || busy} />
                <label className="form-check-label small" htmlFor="section-active">Active</label>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-sm btn-primary" disabled={!manager || busy}><i className="bi bi-check2 me-1"></i>{sectionForm.id ? 'Save' : 'Create'}</button>
                {sectionForm.id && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSectionForm(emptySection)} disabled={busy}>Cancel</button>}
              </div>
            </form>
          </div>
        </div>

        <div className="col-lg-8">
          {loading ? <Loading text="Loading classesÃ¢â‚¬Â¦" /> : visibleClasses.length === 0 ? (
            <Empty icon="bi-diagram-3" text="No classes yet. Create the first class to start structuring academics." />
          ) : visibleClasses.map((item) => (
            <div className="border rounded mb-3" key={item.id}>
              <div className="d-flex justify-content-between align-items-start gap-2 p-3 border-bottom flex-wrap">
                <div>
                  <div className="fw-bold">
                    {item.name} {item.stream && <span className="text-muted small">Ã‚Â· {item.stream}</span>}
                    {' '}<StatusBadge active={item.is_active} />
                  </div>
                  <div className="text-muted small">
                    Sort {item.sort_order} Ã‚Â· {item.students} active student(s) Ã‚Â· {(item.sections || []).length} section(s)
                  </div>
                </div>
                <div className="d-flex gap-1 flex-wrap">
                  <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setClassForm({ id: item.id, name: item.name, stream: item.stream || '', sortOrder: String(item.sort_order ?? 0), isActive: item.is_active !== false })} disabled={!manager || busy}><i className="bi bi-pencil"></i></button>
                  <button type="button" className="btn btn-sm btn-outline-success" onClick={() => setSectionForm({ ...emptySection, classId: String(item.id) })} disabled={!manager || busy}><i className="bi bi-plus-lg"></i> Section</button>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => toggleClass(item)} disabled={!manager || busy}>{item.is_active ? 'Archive' : 'Restore'}</button>
                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeClass(item)} disabled={!manager || busy}><i className="bi bi-trash"></i></button>
                </div>
              </div>
              <div className="table-responsive">
                <table className="table table-sm mb-0 align-middle">
                  <thead><tr><th>Section</th><th>Class teacher</th><th>Strength</th><th>Capacity</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
                  <tbody>
                    {(item.sections || []).filter((section) => showArchived || section.is_active).map((section) => (
                      <tr key={section.id}>
                        <td className="fw-semibold">{section.name}</td>
                        <td>{section.classTeacherName || <span className="text-muted">Not assigned</span>}</td>
                        <td>{section.students}</td>
                        <td>{section.capacity}{Number(section.students) > Number(section.capacity) && <Badge tone="danger">over</Badge>}</td>
                        <td><StatusBadge active={section.is_active} /></td>
                        <td className="text-end">
                          <div className="d-flex gap-1 justify-content-end">
                            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => editSection(item.id, section)} disabled={!manager || busy}><i className="bi bi-pencil"></i></button>
                            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => toggleSection({ ...section, classId: item.id })} disabled={!manager || busy}>{section.is_active ? 'Archive' : 'Restore'}</button>
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeSection(section)} disabled={!manager || busy}><i className="bi bi-trash"></i></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!(item.sections || []).filter((section) => showArchived || section.is_active).length && (
                      <tr><td colSpan="6" className="text-muted small">No sections in this class yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}

