import React, { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../../../api';
import {
  Empty, ErrorBox, Loading, PageShell, canManage, fmtDate,
} from './shared';
import TimetableWeekGrid from './TimetableWeekGrid';

function currentWeekStart() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

export default function StudentTimetable({ me, onNavigate }) {
  const [entries, setEntries] = useState([]);
  const [substitutions, setSubstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [student, setStudent] = useState(null);
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [teachers, setTeachers] = useState([]);
  const manager = canManage(me);

  const teacherNames = useMemo(() => {
    const map = {};
    teachers.forEach((t) => { map[String(t.id)] = t.name; });
    return map;
  }, [teachers]);

  const selectedClass = classes.find((c) => String(c.id) === String(classId));
  const sections = selectedClass?.sections || [];

  async function loadStudent() {
    const result = await apiGet('/school/me');
    if (result?.ok && result.student) setStudent(result.student);
  }

  async function loadClasses() {
    if (!manager) return;
    const result = await apiGet('/school/classes');
    if (result?.ok) setClasses(result.classes || []);
  }

  async function loadTeachers() {
    if (!manager) return;
    const result = await apiGet('/school/academics/teachers');
    if (result?.ok) setTeachers(result.teachers || []);
  }

  async function loadTimetable() {
    const params = new URLSearchParams();
    params.set('date', weekStart);
    if (manager) {
      if (classId) params.set('classId', classId);
      if (sectionId) params.set('sectionId', sectionId);
    }
    const result = await apiGet(`/school/timetable?${params.toString()}`);
    if (result?.ok) setEntries(result.timetable || []);
  }

  async function loadSubstitutions() {
    const params = new URLSearchParams();
    params.set('date', weekStart);
    if (manager) {
      if (classId) params.set('classId', classId);
      if (sectionId) params.set('sectionId', sectionId);
    }
    const result = await apiGet(`/school/substitutions?${params.toString()}`);
    if (result?.ok) setSubstitutions(result.substitutions || []);
  }

  useEffect(() => {
    Promise.all([loadStudent(), loadClasses(), loadTeachers()]).catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Managers need a concrete class/section because there is no linked student. */
  useEffect(() => {
    if (!manager || classId || !classes.length) return;
    const withSections = classes.find((c) => (c.sections || []).length > 0) || classes[0];
    if (withSections) {
      setClassId(String(withSections.id));
      setSectionId(String((withSections.sections || [])[0]?.id || ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes, manager]);

  useEffect(() => {
    if (!manager && !student) return undefined;
    if (manager && !classId) return undefined;
    setLoading(true);
    setError('');
    Promise.all([
      loadTimetable().catch((err) => setError(err.message)),
      loadSubstitutions().catch((err) => setError(err.message)),
    ]).finally(() => setLoading(false));
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student, manager, classId, sectionId, weekStart]);

  useEffect(() => {
    if (sectionId && !sections.some((s) => String(s.id) === String(sectionId))) {
      setSectionId(String(sections[0]?.id || ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  async function refresh() {
    await Promise.all([loadTimetable(), loadSubstitutions()]);
  }

  const shiftWeek = (delta) => {
    const d = new Date(`${weekStart}T00:00:00`);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(d.toISOString().slice(0, 10));
  };

  const classLabel = manager
    ? `${selectedClass?.name || 'Ã¢â‚¬â€'} ${sections.find((s) => String(s.id) === String(sectionId))?.name || ''}`.trim()
    : `${student?.class_name || 'Ã¢â‚¬â€'} ${student?.section_name || ''}`.trim();

  return (
    <PageShell
      title="Student Timetable"
      icon="bi-calendar3-week"
      subtitle={manager
        ? 'Read-only schedule a student in the selected class and section would see. Choose a class/section to preview it.'
        : 'Your published weekly schedule for your enrolled class and section.'}
      onNavigate={onNavigate}
      actions={(
        <>
          {manager && (
            <select
              className="form-select form-select-sm"
              value={classId}
              onChange={(e) => { setClassId(e.target.value); setSectionId(''); }}
              style={{ width: 'auto', maxWidth: 170 }}
              aria-label="Class"
            >
              <option value="">Choose class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {manager && (
            <select
              className="form-select form-select-sm"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              style={{ width: 'auto', maxWidth: 130 }}
              disabled={!classId}
              aria-label="Section"
            >
              <option value="">Choose section</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { refresh().catch((err) => setError(err.message)); }} disabled={loading}>
            <i className="bi bi-arrow-clockwise me-1"></i>Refresh
          </button>
        </>
      )}
    >
      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3">
          <div className="border rounded p-2">
            <div className="text-muted small">{manager ? 'Preview class' : 'Your class'}</div>
            <div className="fs-6 fw-bold">{classLabel || 'Ã¢â‚¬â€'}</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="border rounded p-2">
            <div className="text-muted small">Total periods</div>
            <div className="fs-5 fw-bold">{entries.length}</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="border rounded p-2">
            <div className="text-muted small">This week</div>
            <div className="fs-6 fw-bold">{fmtDate(weekStart)}</div>
          </div>
        </div>
      </div>

      <ErrorBox message={error} onRetry={() => { setError(''); refresh().catch((err) => setError(err.message)); }} />

      {!manager && !student ? (
        <div className="text-center text-muted py-4">
          <i className="bi bi-person-x d-block mb-2" style={{ fontSize: 26 }}></i>
          <span>No active student enrollment found for this account.</span>
        </div>
      ) : loading ? (
        <Loading text="Loading timetableÃ¢â‚¬Â¦" />
      ) : entries.length === 0 ? (
        <Empty icon="bi-calendar3-week" text="No published schedule for this class/section and week." />
      ) : (
        <>
          <div className="d-flex gap-2 mb-3">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => shiftWeek(-1)}><i className="bi bi-chevron-left"></i> Prev Week</button>
            <span className="d-flex align-items-center px-3 small text-muted">
              {fmtDate(weekStart)} Ã¢â‚¬â€œ {fmtDate(new Date(new Date(`${weekStart}T00:00:00`).getTime() + 6 * 86400000))}
            </span>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => shiftWeek(1)}>Next Week <i className="bi bi-chevron-right"></i></button>
            <button type="button" className="btn btn-sm btn-outline-secondary ms-auto" onClick={() => setWeekStart(currentWeekStart())}><i className="bi bi-calendar-check me-1"></i>This Week</button>
          </div>
          <TimetableWeekGrid
            entries={entries}
            substitutions={substitutions}
            weekStart={weekStart}
            resolveTeacher={(id) => teacherNames[String(id)]}
          />
        </>
      )}
      <div className="small text-muted mt-2">
        Only published entries for the selected class and section are shown. Substitutions appear in place of the original teacher.
      </div>
    </PageShell>
  );
}

