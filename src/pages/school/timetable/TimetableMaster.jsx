import React, { useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../../../api';
import {
  Badge, Empty, ErrorBox, Loading, PageShell, StatusBadge, canManage, canView, fmtDate, fmtTime, perform,
  DAYS,
} from './shared';

const emptyForm = {
  id: null,
  versionId: '',
  classId: '',
  sectionId: '',
  allocationId: '',
  roomId: '',
  dayOfWeek: 1,
  periodId: '',
  startTime: '08:00',
  endTime: '08:45',
};

export default function TimetableMaster({ me, onNavigate, academicYearId }) {
  const [years, setYears] = useState([]);
  const [versions, setVersions] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [classes, setClasses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({ version: '', class: '', day: '', teacher: '' });
  const manager = canManage(me);
  const viewer = canView(me);

  async function load() {
    const [yearResult, classResult, roomResult, allocationResult, versionResult, periodResult, entryResult] = await Promise.all([
      apiGet('/school/academic-years'),
      apiGet('/school/classes?includeInactive=true'),
      apiGet('/school/rooms?includeInactive=true'),
      apiGet('/school/subject-allocations?includeInactive=true'),
      apiGet('/school/timetable/versions'),
      apiGet('/school/periods'),
      apiGet('/school/timetable'),
    ]);
    if (!yearResult?.ok) throw new Error(yearResult?.error || 'Could not load years');
    if (!versionResult?.ok) throw new Error(versionResult?.error || 'Could not load versions');
    if (!periodResult?.ok) throw new Error(periodResult?.error || 'Could not load periods');
    if (!entryResult?.ok) throw new Error(entryResult?.error || 'Could not load timetable');
    setYears(yearResult.years || []);
    setVersions(versionResult.versions || []);
    setPeriods(periodResult.periods || []);
    if (classResult?.ok) setClasses(classResult.classes || []);
    if (roomResult?.ok) setRooms(roomResult.rooms || []);
    if (allocationResult?.ok) setAllocations(allocationResult.allocations || []);
    setEntries(entryResult.timetable || []);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    load()
      .catch((err) => { if (active) setError(err.message || 'Could not load timetable'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!filters.version && versions.length > 0) {
      const draft = versions.find((v) => v.status === 'draft');
      const published = versions.find((v) => v.status === 'published');
      const defaultVersion = draft || published || versions[0];
      if (defaultVersion) setFilters((cur) => ({ ...cur, version: String(defaultVersion.id) }));
    }
  }, [versions]);

  const selectedClass = classes.find((c) => String(c.id) === String(form.classId));
  const sections = selectedClass?.sections || [];
  const eligibleAllocations = useMemo(() => {
    if (!form.classId) return [];
    return allocations.filter((a) => (
      a.is_active && !a.academic_year_closed &&
      String(a.class_id) === String(form.classId) &&
      (!form.sectionId || String(a.section_id) === String(form.sectionId))
    ));
  }, [allocations, form.classId, form.sectionId]);

  const selectedVersion = versions.find((v) => String(v.id) === String(filters.version));
  const versionPeriods = useMemo(() => {
    if (!selectedVersion) return [];
    return periods.filter((p) => p.app_id === selectedVersion.app_id && p.is_active);
  }, [periods, selectedVersion]);

  const visible = useMemo(() => entries.filter((e) => {
    if (filters.version && String(e.version_id) !== filters.version) return false;
    if (filters.class && String(e.class_id) !== filters.class) return false;
    if (filters.day !== '' && Number(e.day_of_week) !== Number(filters.day)) return false;
    if (filters.teacher && String(e.teacher_id) !== filters.teacher) return false;
    return true;
  }), [entries, filters]);

  const activeYear = years.find((y) => y.is_active);

  async function refresh() {
    await load();
  }

  function changeClass(classId) {
    setForm((cur) => ({ ...cur, classId, sectionId: '', allocationId: '', roomId: '', periodId: '' }));
  }

  function changeSection(sectionId) {
    setForm((cur) => ({ ...cur, sectionId, allocationId: '', roomId: '', periodId: '' }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!manager) return;
    if (!form.versionId) return window.alert('Choose a timetable version');
    if (!form.classId) return window.alert('Choose a class');
    if (!form.sectionId) return window.alert('Choose a section');
    if (!form.allocationId) return window.alert('Choose a subject allocation');
    if (!form.roomId) return window.alert('Choose a room');
    if (form.dayOfWeek === '' || form.dayOfWeek === null) return window.alert('Choose a day of week');
    if (!form.periodId) return window.alert('Choose a period');
    if (!form.startTime || !form.endTime) return window.alert('Enter start and end times');
    if (form.endTime <= form.startTime) return window.alert('End time must be after start time');
    setBusy(true);
    try {
      const body = {
        versionId: form.versionId,
        classId: form.classId,
        sectionId: form.sectionId,
        allocationId: form.allocationId,
        roomId: form.roomId,
        dayOfWeek: Number(form.dayOfWeek),
        periodId: form.periodId,
        startTime: form.startTime,
        endTime: form.endTime,
      };
      const result = form.id
        ? await perform(() => apiPut(`/school/timetable/${form.id}`, body), { success: 'Timetable entry updated', refresh })
        : await perform(() => apiPost('/school/timetable', body), { success: 'Timetable entry created', refresh });
      if (result) setForm(emptyForm);
    } finally {
      setBusy(false);
    }
  }

  async function remove(entry) {
    if (!manager) return;
    if (!window.confirm('Delete this timetable entry?')) return;
    setBusy(true);
    try {
      await perform(() => apiDelete(`/school/timetable/${entry.id}`), { success: 'Timetable entry deleted', refresh });
    } finally {
      setBusy(false);
    }
  }

  function edit(entry) {
    setForm({
      id: entry.id,
      versionId: String(entry.version_id || ''),
      classId: String(entry.class_id),
      sectionId: String(entry.section_id || ''),
      allocationId: String(entry.allocation_id || ''),
      roomId: String(entry.room_id || ''),
      dayOfWeek: Number(entry.day_of_week),
      periodId: String(entry.period_id || ''),
      startTime: entry.start_time || '08:00',
      endTime: entry.end_time || '08:45',
    });
  }

  return (
    <PageShell
      title="Timetable Master"
      icon="bi-calendar3-week"
      subtitle="Author the weekly schedule by version. Drafts are hidden from teacher/student views until published."
      onNavigate={onNavigate}
      actions={(
        <>
          <select className="form-select form-select-sm" value={filters.version} onChange={(e) => setFilters({ ...filters, version: e.target.value })} style={{ width: 'auto', maxWidth: 280 }} disabled={!manager || busy}>
            <option value="">Choose version</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id} disabled={v.status === 'archived' && String(v.id) !== String(filters.version)}>
                {v.name} {v.status !== 'draft' ? `Ã‚Â· ${v.status}` : ''} (v{v.version})
              </option>
            ))}
          </select>
          {!selectedVersion && manager && (
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => {
              const name = window.prompt('Version name:', `Schedule ${new Date().getFullYear()}-${new Date().getFullYear()+1}`);
              if (name) {
                apiPost('/school/timetable/versions', {
                  academicYearId: activeYear?.id || years[0]?.id,
                  name,
                  effectiveFrom: new Date().toISOString().slice(0,10),
                  status: 'draft'
                }).then(r => r.ok && load()).catch(err => setError(err.message));
              }
            }}>
              <i className="bi bi-plus-circle me-1"></i>Create Version
            </button>
          )}
          {selectedVersion && manager && (
            <>
              {selectedVersion.status === 'published' && (
                <button type="button" className="btn btn-sm btn-outline-warning" onClick={() => { if (window.confirm('Clone published version to a new draft?')) { apiPost(`/school/timetable/versions/${selectedVersion.id}/clone`, { name: `${selectedVersion.name} (copy)`, effectiveFrom: new Date().toISOString().slice(0,10) }).then(r => r.ok && load()).catch(err => setError(err.message)); } }}>
                  <i className="bi bi-copy me-1"></i>Clone to Draft
                </button>
              )}
              {selectedVersion.status === 'draft' && (
                <button type="button" className="btn btn-sm btn-outline-success" onClick={() => { if (window.confirm('Publish this version? This will make it visible to teachers and students.')) { apiPut(`/school/timetable/versions/${selectedVersion.id}`, { status: 'published' }).then(r => r.ok && load()).catch(err => setError(err.message)); } }}>
                  <i className="bi bi-check-circle me-1"></i>Publish
                </button>
              )}
              {selectedVersion.status !== 'archived' && (
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => { if (window.confirm('Archive this version? It will no longer be selectable for new entries.')) { apiPut(`/school/timetable/versions/${selectedVersion.id}`, { status: 'archived' }).then(r => r.ok && load()).catch(err => setError(err.message)); } }}>
                  <i className="bi bi-archive me-1"></i>Archive
                </button>
              )}
            </>
          )}
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { load().catch((err) => setError(err.message)); }} disabled={loading || busy}>
            <i className="bi bi-arrow-clockwise me-1"></i>Refresh
          </button>
        </>
      )}
    >
      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Selected version</div><div className="fs-6 fw-bold">{selectedVersion?.name || 'Choose a version'}</div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Status</div><div className="fs-6 fw-bold"><StatusBadge active={selectedVersion?.status === 'published'} labels={[selectedVersion?.status || 'Ã¢â‚¬â€', 'Draft']} /></div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Effective</div><div className="fs-6 fw-bold">{selectedVersion ? `${fmtDate(selectedVersion.effective_from)} Ã¢â€ â€™ ${selectedVersion.effective_to ? fmtDate(selectedVersion.effective_to) : 'open'}` : 'Ã¢â‚¬â€'}</div></div></div>
        <div className="col-6 col-md-3"><div className="border rounded p-2"><div className="text-muted small">Entries</div><div className="fs-5 fw-bold">{visible.length}</div></div></div>
      </div>

      <ErrorBox message={error} onRetry={() => { setError(''); setLoading(true); load().catch((err) => setError(err.message)).finally(() => setLoading(false)); }} />

      <div className="row g-3">
        <div className="col-lg-4">
          <div className="border rounded p-3">
            <h6 className="fw-bold">{form.id ? 'Edit entry' : 'Add timetable entry'}</h6>
            <form onSubmit={submit}>
              <label className="form-label small">Version *</label>
              <select className="form-select form-select-sm mb-2" value={form.versionId} onChange={(e) => setForm({ ...form, versionId: e.target.value, periodId: '' })} disabled={!manager || busy || form.id}>
                <option value="">Choose version</option>
                {versions.filter((v) => v.status === 'draft' || (v.status === 'published' && form.id && String(v.id) === String(form.versionId))).map((v) => (
                  <option key={v.id} value={v.id} disabled={v.status === 'archived' && String(v.id) !== String(form.versionId)}>
                    {v.name} {v.status !== 'draft' ? `Ã‚Â· ${v.status}` : ''}
                  </option>
                ))}
              </select>

              <label className="form-label small">Class *</label>
              <select className="form-select form-select-sm mb-2" value={form.classId} onChange={(e) => changeClass(e.target.value)} disabled={!manager || busy || form.id}>
                <option value="">Choose class</option>
                {classes.filter((c) => c.is_active || String(c.id) === String(form.classId)).map((c) => <option key={c.id} value={c.id}>{c.name}{c.stream ? ` Ã‚Â· ${c.stream}` : ''}</option>)}
              </select>

              <label className="form-label small">Section *</label>
              <select className="form-select form-select-sm mb-2" value={form.sectionId} onChange={(e) => changeSection(e.target.value)} disabled={!manager || busy || !form.classId || form.id}>
                <option value="">{form.classId ? 'Choose section' : 'Choose class first'}</option>
                {sections.filter((s) => s.is_active || String(s.id) === String(form.sectionId)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>

              <label className="form-label small">Subject allocation *</label>
              <select className="form-select form-select-sm mb-2" value={form.allocationId} onChange={(e) => setForm({ ...form, allocationId: e.target.value })} disabled={!manager || busy || form.id || !form.classId}>
                <option value="">{form.classId ? 'Choose allocation' : 'Choose class first'}</option>
                {eligibleAllocations.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.academic_year_name} Ã‚Â· {a.class_name} {a.section_name} Ã‚Â· {a.subject_name}{a.teacher_display ? ` Ã¢â‚¬â€ ${a.teacher_display}` : ''}
                  </option>
                ))}
              </select>

              <label className="form-label small">Room *</label>
              <select className="form-select form-select-sm mb-2" value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })} disabled={!manager || busy || form.id}>
                <option value="">Choose room</option>
                {rooms.filter((r) => r.is_active || String(r.id) === String(form.roomId)).map((r) => <option key={r.id} value={r.id}>{r.code} Ã‚Â· {r.name} (cap {r.capacity})</option>)}
              </select>

              <div className="row g-2 mb-2">
                <div className="col-4">
                  <label className="form-label small">Day *</label>
                  <select className="form-select form-select-sm" value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })} disabled={!manager || busy}>
                    {DAYS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                </div>
                <div className="col-4">
                  <label className="form-label small">Period *</label>
                  <select className="form-select form-select-sm" value={form.periodId} onChange={(e) => {
                    const periodId = e.target.value;
                    const period = periods.find((p) => p.id === periodId);
                    setForm({ ...form, periodId, startTime: period?.start_time || '08:00', endTime: period?.end_time || '08:45' });
                  }} disabled={!manager || busy || !selectedVersion}>
                    <option value="">Choose period</option>
                    {versionPeriods.sort((a,b) => a.sort_order - b.sort_order).map((p) => (
                      <option key={p.id} value={p.id}>{p.label} ({fmtTime(p.start_time)}Ã¢â‚¬â€œ{fmtTime(p.end_time)})</option>
                    ))}
                  </select>
                </div>
                <div className="col-4">
                  <label className="form-label small">Start *</label>
                  <input type="time" className="form-control form-control-sm" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} disabled={!manager || busy} />
                </div>
                <div className="col-4">
                  <label className="form-label small">End *</label>
                  <input type="time" className="form-control form-control-sm" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} disabled={!manager || busy} />
                </div>
              </div>

              <div className="d-flex gap-2">
                <button className="btn btn-sm btn-primary" disabled={!manager || busy}><i className="bi bi-check2 me-1"></i>{form.id ? 'Save' : 'Create'}</button>
                {form.id && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setForm(emptyForm)} disabled={busy}>Cancel</button>}
              </div>
              {!manager && <div className="small text-muted mt-2">You have read-only access to timetable.</div>}
            </form>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="row g-2 mb-2">
            <div className="col-6 col-md-3">
              <select className="form-select form-select-sm" value={filters.class} onChange={(e) => setFilters({ ...filters, class: e.target.value })}>
                <option value="">All classes</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-3">
              <select className="form-select form-select-sm" value={filters.day} onChange={(e) => setFilters({ ...filters, day: e.target.value })}>
                <option value="">All days</option>
                {DAYS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-3">
              <select className="form-select form-select-sm" value={filters.teacher} onChange={(e) => setFilters({ ...filters, teacher: e.target.value })}>
                <option value="">All teachers</option>
                {[...new Map(entries.filter((e) => e.teacher_id).map((e) => [String(e.teacher_id), e.teacher_display || e.teacher_id])).entries()].map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? <Loading text="Loading timetableÃ¢â‚¬Â¦" /> : visible.length === 0 ? (
            <Empty icon="bi-calendar3-week" text={selectedVersion ? 'No entries in this version. Add one from an active subject allocation.' : 'Select a version to view or create entries.'} />
          ) : (
            <div className="table-responsive border rounded">
              <table className="table table-sm mb-0 align-middle">
                <thead><tr><th>Day</th><th>Period</th><th>Time</th><th>Class / Section</th><th>Subject / Teacher</th><th>Room</th><th>Version</th><th className="text-end">Actions</th></tr></thead>
                <tbody>
                  {visible.map((e) => {
                    const period = periods.find((p) => p.id === e.period_id);
                    return (
                      <tr key={e.id}>
                        <td>{DAYS[e.day_of_week]?.label || `Day ${e.day_of_week}`}</td>
                        <td>{period?.label || e.period_no}</td>
                        <td className="text-nowrap">{fmtTime(e.start_time)} Ã¢â‚¬â€œ {fmtTime(e.end_time)}</td>
                        <td className="fw-semibold">{e.class_name} {e.section_name}</td>
                        <td>{e.subject_name}<div className="small text-muted">{e.teacher_display || e.teacher_id}</div></td>
                        <td>{e.room_code}<div className="small text-muted">{e.room_name}</div></td>
                        <td className="small">{e.version_name || e.academic_year_name}</td>
                        <td className="text-end">
                          <div className="d-flex gap-1 justify-content-end">
                            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => edit(e)} disabled={!manager || busy}><i className="bi bi-pencil"></i></button>
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remove(e)} disabled={!manager || busy}><i className="bi bi-trash"></i></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="small text-muted mt-2">
            Entries belong to a version. Only published versions are visible to teachers/students. Draft versions can be edited freely; published versions must be cloned to make changes.
          </div>
        </div>
      </div>
    </PageShell>
  );
}
