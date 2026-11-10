import React, { useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../../../api';
import {
  Badge, Empty, ErrorBox, Loading, PageShell, StatusBadge, canManage, fmtDate, perform, today,
} from './shared';

const emptyForm = (yearId = '') => ({
  id: null,
  academicYearId: yearId ? String(yearId) : '',
  classId: '',
  sectionId: '',
  subjectId: '',
  teacherId: '',
  effectiveFrom: today(),
  effectiveTo: '',
  isActive: true,
});

export default function SubjectAllocation({ me, onNavigate, academicYearId }) {
  const [years, setYears] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [filters, setFilters] = useState({ year: '', class: '', teacher: '' });
  const [form, setForm] = useState(emptyForm(academicYearId));
  const manager = canManage(me);

  async function load() {
    const [yearResult, classResult, subjectResult, teacherResult, allocationResult] = await Promise.all([
      apiGet('/school/academic-years'),
      apiGet('/school/classes?includeInactive=true'),
      apiGet('/school/subjects?includeInactive=true'),
      apiGet('/school/academics/teachers'),
      apiGet('/school/subject-allocations?includeInactive=true'),
    ]);
    if (!yearResult?.ok) throw new Error(yearResult?.error || 'Could not load academic years');
    if (!allocationResult?.ok) throw new Error(allocationResult?.error || 'Could not load allocations');
    setYears(yearResult.years || []);
    if (classResult?.ok) setClasses(classResult.classes || []);
    if (subjectResult?.ok) setSubjects(subjectResult.subjects || []);
    if (teacherResult?.ok) setTeachers(teacherResult.teachers || []);
    setAllocations(allocationResult.allocations || []);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    load()
      .catch((err) => { if (active) setError(err.message || 'Could not load allocations'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!form.academicYearId && academicYearId) {
      setForm((current) => (current.academicYearId ? current : { ...current, academicYearId: String(academicYearId) }));
    }
  }, [academicYearId, form.academicYearId]);

  useEffect(() => {
    if (!filters.year && academicYearId) setFilters((current) => ({ ...current, year: String(academicYearId) }));
  }, [academicYearId, filters.year]);

  const selectedClass = classes.find((item) => String(item.id) === String(form.classId));
  const sections = selectedClass?.sections || [];
  const eligibleSubjects = subjects.filter((subject) => (
    subject.is_active || String(subject.id) === String(form.subjectId)
  ) && (!subject.class_id || String(subject.class_id) === String(form.classId)));

  const visible = useMemo(() => allocations.filter((allocation) => {
    if (!showInactive && !allocation.is_active) return false;
    if (filters.year && String(allocation.academic_year_id) !== String(filters.year)) return false;
    if (filters.class && String(allocation.class_id) !== String(filters.class)) return false;
    if (filters.teacher && String(allocation.teacher_id) !== String(filters.teacher)) return false;
    return true;
  }), [allocations, showInactive, filters]);

  const activeCount = allocations.filter((allocation) => allocation.is_active).length;
  const usedSections = new Set(allocations.filter((allocation) => allocation.is_active)
    .map((allocation) => `${allocation.class_id}/${allocation.section_id}`)).size;

  async function refresh() {
    await load();
  }

  function changeClass(classId) {
    setForm((current) => {
      const next = { ...current, classId, sectionId: '', subjectId: '' };
      const nextClass = classes.find((item) => String(item.id) === String(classId));
      const stillEligible = subjects.some((subject) => (
        String(subject.id) === String(current.subjectId)
        && (!subject.class_id || String(subject.class_id) === String(classId))
      ));
      if (!stillEligible) next.subjectId = '';
      if (nextClass && (nextClass.sections || []).length === 1) next.sectionId = String(nextClass.sections[0].id);
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (!manager) return;
    if (!form.academicYearId) return window.alert('Choose an academic year');
    if (!form.classId) return window.alert('Choose a class');
    if (!form.sectionId) return window.alert('Choose a section');
    if (!form.subjectId) return window.alert('Choose a subject eligible for the class');
    if (!form.teacherId) return window.alert('Choose a teacher');
    if (form.effectiveTo && form.effectiveTo < form.effectiveFrom) {
      return window.alert('Effective end date cannot be before the start date');
    }
    setBusy(true);
    try {
      const body = {
        academicYearId: form.academicYearId,
        classId: form.classId,
        sectionId: form.sectionId,
        subjectId: form.subjectId,
        teacherId: form.teacherId,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        isActive: form.isActive,
      };
      const result = form.id
        ? await perform(() => apiPut(`/school/subject-allocations/${form.id}`, body), { success: 'Allocation updated', refresh })
        : await perform(() => apiPost('/school/subject-allocations', body), { success: 'Allocation created', refresh });
      if (result) setForm(emptyForm(form.academicYearId));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(allocation) {
    if (!manager) return;
    if (!window.confirm(`${allocation.is_active ? 'Deactivate' : 'Reactivate'} this allocation?`)) return;
    setBusy(true);
    try {
      await perform(() => apiPut(`/school/subject-allocations/${allocation.id}`, {
        isActive: !allocation.is_active,
      }), { success: allocation.is_active ? 'Allocation deactivated' : 'Allocation reactivated', refresh });
    } finally {
      setBusy(false);
    }
  }

  async function remove(allocation) {
    if (!manager) return;
    if (!window.confirm('Delete this allocation? This only succeeds when timetable, exams and homework do not use it.')) return;
    setBusy(true);
    try {
      await perform(() => apiDelete(`/school/subject-allocations/${allocation.id}`), { success: 'Allocation deleted', refresh });
    } finally {
      setBusy(false);
    }
  }

  function edit(allocation) {
    setForm({
      id: allocation.id,
      academicYearId: String(allocation.academic_year_id),
      classId: String(allocation.class_id),
      sectionId: String(allocation.section_id),
      subjectId: String(allocation.subject_id),
      teacherId: String(allocation.teacher_id),
      effectiveFrom: allocation.effective_from ? String(allocation.effective_from).slice(0, 10) : today(),
      effectiveTo: allocation.effective_to ? String(allocation.effective_to).slice(0, 10) : '',
      isActive: allocation.is_active !== false,
    });
  }

  return (
    <PageShell
      title="Subject Allocation"
      icon="bi-diagram-2"
      subtitle="Year-scoped teaching assignments that timetable, exams and homework consume."
      onNavigate={onNavigate}
      actions={(
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { load().catch((err) => setError(err.message)); }} disabled={loading || busy}>
          <i className="bi bi-arrow-clockwise me-1"></i>Refresh
        </button>
      )}
    >
      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Active allocations</div><div className="fs-5 fw-bold">{activeCount}</div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Sections covered</div><div className="fs-5 fw-bold">{usedSections}</div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Inactive</div><div className="fs-5 fw-bold">{allocations.length - activeCount}</div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Teachers</div><div className="fs-5 fw-bold">{new Set(allocations.filter((item) => item.is_active).map((item) => item.teacher_id)).size}</div></div></div>
      </div>

      <ErrorBox message={error} onRetry={() => { setError(''); setLoading(true); load().catch((err) => setError(err.message)).finally(() => setLoading(false)); }} />

      <div className="row g-3">
        <div className="col-lg-4">
          <div className="border rounded p-3">
            <h6 className="fw-bold">{form.id ? 'Edit allocation' : 'Add allocation'}</h6>
            <form onSubmit={submit}>
              <label className="form-label small">Academic year *</label>
              <select className="form-select form-select-sm mb-2" value={form.academicYearId} onChange={(event) => setForm({ ...form, academicYearId: event.target.value })} disabled={!manager || busy}>
                <option value="">Choose year</option>
                {years.map((year) => (
                  <option key={year.id} value={year.id} disabled={year.is_closed && String(year.id) !== String(form.academicYearId)}>
                    {year.name}{year.is_closed ? ' (closed)' : ''}{year.is_active ? ' Ã‚Â· active' : ''}
                  </option>
                ))}
              </select>

              <label className="form-label small">Class *</label>
              <select className="form-select form-select-sm mb-2" value={form.classId} onChange={(event) => changeClass(event.target.value)} disabled={!manager || busy}>
                <option value="">Choose class</option>
                {classes.filter((item) => item.is_active || String(item.id) === String(form.classId)).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}{item.stream ? ` Ã‚Â· ${item.stream}` : ''}</option>
                ))}
              </select>

              <label className="form-label small">Section *</label>
              <select className="form-select form-select-sm mb-2" value={form.sectionId} onChange={(event) => setForm({ ...form, sectionId: event.target.value })} disabled={!manager || busy || !form.classId}>
                <option value="">{form.classId ? 'Choose section' : 'Choose class first'}</option>
                {sections.filter((item) => item.is_active || String(item.id) === String(form.sectionId)).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>

              <label className="form-label small">Subject *</label>
              <select className="form-select form-select-sm mb-2" value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: event.target.value })} disabled={!manager || busy || !form.classId}>
                <option value="">{form.classId ? 'Choose subject' : 'Choose class first'}</option>
                {eligibleSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}{subject.code ? ` (${subject.code})` : ''}</option>
                ))}
              </select>

              <label className="form-label small">Teacher *</label>
              <select className="form-select form-select-sm mb-2" value={form.teacherId} onChange={(event) => setForm({ ...form, teacherId: event.target.value })} disabled={!manager || busy}>
                <option value="">Choose teacher</option>
                {teachers.map((teacher) => (
                  <option key={`${teacher.source}-${teacher.id}`} value={teacher.id}>
                    {teacher.name}{teacher.designation ? ` Ã‚Â· ${teacher.designation}` : ''}{teacher.source === 'user' ? ' (user)' : ''}
                  </option>
                ))}
              </select>

              <div className="row g-2">
                <div className="col-6">
                  <label className="form-label small">Effective from</label>
                  <input type="date" className="form-control form-control-sm mb-2" value={form.effectiveFrom} onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} disabled={!manager || busy} />
                </div>
                <div className="col-6">
                  <label className="form-label small">Effective to</label>
                  <input type="date" className="form-control form-control-sm mb-2" value={form.effectiveTo} onChange={(event) => setForm({ ...form, effectiveTo: event.target.value })} disabled={!manager || busy} />
                </div>
              </div>

              <div className="form-check form-switch mb-2">
                <input className="form-check-input" type="checkbox" id="allocation-active" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} disabled={!manager || busy} />
                <label className="form-check-label small" htmlFor="allocation-active">Active</label>
              </div>

              <div className="d-flex gap-2">
                <button className="btn btn-sm btn-primary" disabled={!manager || busy}><i className="bi bi-check2 me-1"></i>{form.id ? 'Save' : 'Create'}</button>
                {form.id && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setForm(emptyForm(form.academicYearId))} disabled={busy}>Cancel</button>}
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
              <select className="form-select form-select-sm" value={filters.teacher} onChange={(event) => setFilters({ ...filters, teacher: event.target.value })}>
                <option value="">All teachers</option>
                {teachers.map((teacher) => <option key={`${teacher.source}-${teacher.id}`} value={teacher.id}>{teacher.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-check form-switch mb-3">
            <input className="form-check-input" type="checkbox" id="allocations-show-inactive" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
            <label className="form-check-label" htmlFor="allocations-show-inactive">Show inactive allocations</label>
          </div>

          {loading ? <Loading text="Loading allocationsÃ¢â‚¬Â¦" /> : visible.length === 0 ? (
            <Empty icon="bi-diagram-2" text="No allocations match this view. Allocate a subject to a section first." />
          ) : (
            <div className="table-responsive border rounded">
              <table className="table table-sm mb-0 align-middle">
                <thead><tr><th>Year</th><th>Class / section</th><th>Subject</th><th>Teacher</th><th>Effective</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
                <tbody>
                  {visible.map((allocation) => (
                    <tr key={allocation.id}>
                      <td className="small">{allocation.academic_year_name}{allocation.academic_year_closed && <div><Badge tone="dark">closed</Badge></div>}</td>
                      <td className="fw-semibold">{allocation.class_name} Ã‚Â· {allocation.section_name}</td>
                      <td>{allocation.subject_name}{allocation.subject_code ? <div className="small text-muted">{allocation.subject_code}</div> : null}</td>
                      <td>{allocation.teacher_display || allocation.teacher_name || allocation.teacher_id}</td>
                      <td className="small text-nowrap">
                        {fmtDate(allocation.effective_from)}{allocation.effective_to ? ` Ã¢â€ â€™ ${fmtDate(allocation.effective_to)}` : ''}
                      </td>
                      <td><StatusBadge active={allocation.is_active} labels={['Active', 'Inactive']} /></td>
                      <td className="text-end">
                        <div className="d-flex gap-1 justify-content-end">
                          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => edit(allocation)} disabled={!manager || busy}><i className="bi bi-pencil"></i></button>
                          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => toggle(allocation)} disabled={!manager || busy}>{allocation.is_active ? 'Deactivate' : 'Reactivate'}</button>
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remove(allocation)} disabled={!manager || busy}><i className="bi bi-trash"></i></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="small text-muted mt-2">
            Changing the class resets the section and subject so stale references cannot be submitted. Closed years reject new allocations.
          </div>
        </div>
      </div>
    </PageShell>
  );
}

