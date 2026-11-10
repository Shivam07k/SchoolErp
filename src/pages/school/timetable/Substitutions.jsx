import React, { useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../../../api';
import {
  Badge, Empty, ErrorBox, Loading, PageShell, StatusBadge, canManage, fmtDate, fmtTime, perform,
} from './shared';

const emptyForm = {
  id: null,
  timetableId: '',
  subDate: '',
  absentTeacherId: '',
  substituteTeacherId: '',
  classId: '',
  sectionId: '',
  subjectId: '',
  periodNo: '',
};

export default function Substitutions({ me, onNavigate }) {
  const [timetable, setTimetable] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [substitutions, setSubstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({ teacher: '', status: '' });
  const manager = canManage(me);

  async function load() {
    const [teacherResult, subResult] = await Promise.all([
      apiGet('/school/academics/teachers'),
      apiGet('/school/substitutions'),
    ]);
    if (!teacherResult?.ok) throw new Error(teacherResult?.error || 'Could not load teachers');
    if (!subResult?.ok) throw new Error(subResult?.error || 'Could not load substitutions');
    setTeachers(teacherResult.teachers || []);
    setSubstitutions(subResult.substitutions || []);
  }

  async function loadTimetable() {
    const result = await apiGet('/school/timetable');
    if (result?.ok) setTimetable(result.timetable || []);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([load(), loadTimetable()])
      .catch((err) => { if (active) setError(err.message || 'Could not load substitutions'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => substitutions.filter((s) => {
    if (filters.teacher && String(s.absent_teacher_id) !== filters.teacher && String(s.substitute_teacher_id) !== filters.teacher) return false;
    if (filters.status && s.status !== filters.status) return false;
    return true;
  }), [substitutions, filters]);

  async function refresh() {
    await load();
    await loadTimetable();
  }

  async function submit(event) {
    event.preventDefault();
    if (!manager) return;
    if (!form.timetableId) return window.alert('Choose a timetable entry');
    if (!form.subDate) return window.alert('Choose a substitution date');
    if (!form.absentTeacherId) return window.alert('Choose the absent teacher');
    if (!form.substituteTeacherId) return window.alert('Choose the substitute teacher');
    if (!form.classId || !form.sectionId || !form.subjectId || !form.periodNo) {
      return window.alert('Timetable entry must provide class, section, subject, and period');
    }
    if (form.absentTeacherId === form.substituteTeacherId) {
      return window.alert('Absent and substitute teacher cannot be the same');
    }
    setBusy(true);
    try {
      const body = {
        timetableId: form.timetableId,
        absentTeacherId: form.absentTeacherId,
        substituteTeacherId: form.substituteTeacherId,
        classId: form.classId,
        sectionId: form.sectionId,
        subjectId: form.subjectId,
        periodNo: Number(form.periodNo),
        subDate: form.subDate,
      };
      const result = form.id
        ? await perform(() => apiPut(`/school/substitutions/${form.id}`, body), { success: 'Substitution updated', refresh })
        : await perform(() => apiPost('/school/substitutions', body), { success: 'Substitution created', refresh });
      if (result) setForm(emptyForm);
    } finally {
      setBusy(false);
    }
  }

  async function remove(sub) {
    if (!manager) return;
    if (!window.confirm('Cancel this substitution?')) return;
    setBusy(true);
    try {
      await perform(() => apiDelete(`/school/substitutions/${sub.id}`), { success: 'Substitution cancelled', refresh });
    } finally {
      setBusy(false);
    }
  }

  function edit(sub) {
    const tt = timetable.find((t) => t.id === sub.timetable_id);
    setForm({
      id: sub.id,
      timetableId: String(sub.timetable_id || ''),
      subDate: sub.sub_date,
      absentTeacherId: sub.absent_teacher_id,
      substituteTeacherId: sub.substitute_teacher_id,
      classId: String(sub.class_id || ''),
      sectionId: String(sub.section_id || ''),
      subjectId: String(sub.subject_id || ''),
      periodNo: String(sub.period_no || ''),
    });
  }

  return (
    <PageShell
      title="Substitutions"
      icon="bi-person-lines-fill"
      subtitle="Assign a substitute teacher for a specific timetable occurrence. The original entry is preserved."
      onNavigate={onNavigate}
      actions={(
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { load().catch((err) => setError(err.message)); loadTimetable().catch((err) => setError(err.message)); }} disabled={loading || busy}>
          <i className="bi bi-arrow-clockwise me-1"></i>Refresh
        </button>
      )}
    >
      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Total</div><div className="fs-5 fw-bold">{substitutions.length}</div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Assigned</div><div className="fs-5 fw-bold">{substitutions.filter((s) => s.status === 'assigned').length}</div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Completed</div><div className="fs-5 fw-bold">{substitutions.filter((s) => s.status === 'completed').length}</div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Cancelled</div><div className="fs-5 fw-bold">{substitutions.filter((s) => s.status === 'cancelled').length}</div></div></div>
      </div>

      <ErrorBox message={error} onRetry={() => { setError(''); setLoading(true); load().catch((err) => setError(err.message)).finally(() => setLoading(false)); }} />

      <div className="row g-3">
        <div className="col-lg-4">
          <div className="border rounded p-3">
            <h6 className="fw-bold">{form.id ? 'Edit substitution' : 'Create substitution'}</h6>
            <form onSubmit={submit}>
              <label className="form-label small">Timetable entry *</label>
              <select className="form-select form-select-sm mb-2" value={form.timetableId} onChange={(e) => {
                const selected = timetable.find((t) => String(t.id) === e.target.value);
                setForm({ ...form, timetableId: e.target.value, classId: selected?.class_id ? String(selected.class_id) : '', sectionId: selected?.section_id ? String(selected.section_id) : '', subjectId: selected?.subject_id ? String(selected.subject_id) : '', periodNo: selected?.period_no ? String(selected.period_no) : '' });
              }} disabled={!manager || busy}>
                <option value="">Choose timetable entry</option>
                {timetable.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.class_name} {t.section_name} Ã¢â‚¬â€œ {t.subject_name} (Day {t.day_of_week}, P{t.period_no} {t.start_time}Ã¢â‚¬â€œ{t.end_time}) {t.teacher_display ? ` [${t.teacher_display}]` : ''}
                  </option>
                ))}
              </select>

              <label className="form-label small">Substitution date *</label>
              <input type="date" className="form-control form-control-sm mb-2" value={form.subDate} onChange={(e) => setForm({ ...form, subDate: e.target.value })} min={new Date().toISOString().slice(0, 10)} disabled={!manager || busy} />

              <label className="form-label small">Absent teacher *</label>
              <select className="form-select form-select-sm mb-2" value={form.absentTeacherId} onChange={(e) => setForm({ ...form, absentTeacherId: e.target.value })} disabled={!manager || busy || form.id}>
                <option value="">Choose absent teacher</option>
                {teachers.map((t) => <option key={`${t.source}-${t.id}`} value={t.id}>{t.name}{t.designation ? ` Ã‚Â· ${t.designation}` : ''}</option>)}
              </select>

              <label className="form-label small">Substitute teacher *</label>
              <select className="form-select form-select-sm mb-2" value={form.substituteTeacherId} onChange={(e) => setForm({ ...form, substituteTeacherId: e.target.value })} disabled={!manager || busy || form.id}>
                <option value="">Choose substitute teacher</option>
                {teachers.map((t) => <option key={`${t.source}-${t.id}`} value={t.id}>{t.name}{t.designation ? ` Ã‚Â· ${t.designation}` : ''}</option>)}
              </select>

              <div className="d-flex gap-2">
                <button className="btn btn-sm btn-primary" disabled={!manager || busy}><i className="bi bi-check2 me-1"></i>{form.id ? 'Save' : 'Create'}</button>
                {form.id && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setForm(emptyForm)} disabled={busy}>Cancel</button>}
              </div>
              {!manager && <div className="small text-muted mt-2">You have read-only access to substitutions.</div>}
            </form>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="row g-2 mb-2">
            <div className="col-6 col-md-4">
              <select className="form-select form-select-sm" value={filters.teacher} onChange={(e) => setFilters({ ...filters, teacher: e.target.value })}>
                <option value="">All teachers</option>
                {teachers.map((t) => <option key={`${t.source}-${t.id}`} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="col-12 col-md-4">
              <select className="form-select form-select-sm" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                <option value="">All statuses</option>
                <option value="assigned">Assigned</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {loading ? <Loading text="Loading substitutionsÃ¢â‚¬Â¦" /> : visible.length === 0 ? (
            <Empty icon="bi-person-lines-fill" text="No substitutions match this view. Create one from an active timetable entry." />
          ) : (
            <div className="table-responsive border rounded">
              <table className="table table-sm mb-0 align-middle">
                <thead><tr><th>Date</th><th>Class / Section</th><th>Subject</th><th>Period</th><th>Absent Teacher</th><th>Substitute Teacher</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
                <tbody>
                  {visible.map((s) => (
                    <tr key={s.id}>
                      <td className="text-nowrap">{fmtDate(s.sub_date)}</td>
                      <td className="fw-semibold">{s.class_name || s.class_id} {s.section_name || s.section_id}</td>
                      <td>{s.subject_name || s.subject_id}</td>
                      <td className="text-center">{s.period_no}</td>
                      <td>{s.absent_teacher_display || s.absent_teacher_id}</td>
                      <td>{s.substitute_teacher_display || s.substitute_teacher_id}</td>
                      <td><StatusBadge active={s.status === 'assigned'} labels={['Assigned', s.status]}/></td>
                      <td className="text-end">
                        <div className="d-flex gap-1 justify-content-end">
                          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => edit(s)} disabled={!manager || busy}><i className="bi bi-pencil"></i></button>
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remove(s)} disabled={!manager || busy}><i className="bi bi-trash"></i></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="small text-muted mt-2">
            A substitution modifies a specific dated occurrence. The original timetable record is unchanged.
          </div>
        </div>
      </div>
    </PageShell>
  );
}
