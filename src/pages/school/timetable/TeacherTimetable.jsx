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

export default function TeacherTimetable({ me, onNavigate, initialTeacherId }) {
  const [entries, setEntries] = useState([]);
  const [substitutions, setSubstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [versionId, setVersionId] = useState('');
  const [versions, setVersions] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [teacherId, setTeacherId] = useState(initialTeacherId ? String(initialTeacherId) : '');
  const manager = canManage(me);

  const teacherNames = useMemo(() => {
    const map = {};
    teachers.forEach((t) => { map[String(t.id)] = t.name; });
    return map;
  }, [teachers]);

  function selectedVersion() {
    return versions.find((v) => String(v.id) === String(versionId));
  }

  async function loadVersions() {
    const result = await apiGet('/school/timetable/versions');
    if (result?.ok) setVersions(result.versions || []);
  }

  async function loadTeachers() {
    if (!manager) return;
    const result = await apiGet('/school/academics/teachers');
    if (result?.ok) {
      const list = result.teachers || [];
      setTeachers(list);
      setTeacherId((cur) => cur || (list[0] ? String(list[0].id) : ''));
    }
  }

  async function loadTimetable() {
    const params = new URLSearchParams();
    params.set('date', weekStart);
    if (manager && versionId) params.set('versionId', versionId);
    if (manager && teacherId) params.set('teacherId', teacherId);
    const result = await apiGet(`/school/timetable?${params.toString()}`);
    if (result?.ok) setEntries(result.timetable || []);
  }

  async function loadSubstitutions() {
    const params = new URLSearchParams();
    params.set('date', weekStart);
    if (manager && versionId) params.set('versionId', versionId);
    if (manager && teacherId) params.set('teacherId', teacherId);
    const result = await apiGet(`/school/substitutions?${params.toString()}`);
    if (result?.ok) setSubstitutions(result.substitutions || []);
  }

  useEffect(() => {
    Promise.all([loadVersions(), loadTeachers()]).catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialTeacherId) setTeacherId(String(initialTeacherId));
  }, [initialTeacherId]);

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      loadTimetable().catch((err) => setError(err.message)),
      loadSubstitutions().catch((err) => setError(err.message)),
    ]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, versionId, teacherId, manager]);

  async function refresh() {
    await Promise.all([loadTimetable(), loadSubstitutions()]);
  }

  const shiftWeek = (delta) => {
    const d = new Date(`${weekStart}T00:00:00`);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(d.toISOString().slice(0, 10));
  };

  const teacherLabel = teacherNames[String(teacherId)] || '';
  const versionLabel = selectedVersion()?.name || '';

  return (
    <PageShell
      title="Teacher Timetable"
      icon="bi-calendar3-week"
      subtitle={manager
        ? 'Read-only weekly schedule. Pick a teacher to see exactly what they would see; substitutions are shown in place of the original entry.'
        : 'Your published weekly schedule. Substitutions are shown in place of the original entry.'}
      onNavigate={onNavigate}
      actions={(
        <>
          {manager && (
            <select
              className="form-select form-select-sm"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              style={{ width: 'auto', maxWidth: 210 }}
              disabled={loading}
              aria-label="Teacher"
            >
              <option value="">All teachers</option>
              {teachers.map((t) => (
                <option key={`${t.source}-${t.id}`} value={t.id}>{t.name}{t.designation ? ` Ã‚Â· ${t.designation}` : ''}</option>
              ))}
            </select>
          )}
          {manager && (
            <select
              className="form-select form-select-sm"
              value={versionId}
              onChange={(e) => setVersionId(e.target.value)}
              style={{ width: 'auto', maxWidth: 200 }}
              disabled={loading}
              aria-label="Timetable version"
            >
              <option value="">All versions (by date)</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>{v.name} (v{v.version}, {v.status})</option>
              ))}
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
            <div className="text-muted small">{manager ? 'Teacher' : 'Your classes'}</div>
            <div className="fs-6 fw-bold">{manager ? (teacherLabel || 'All teachers') : new Set(entries.map((e) => e.class_id)).size}</div>
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
            <div className="text-muted small">Version</div>
            <div className="fs-6 fw-bold">{versionLabel || 'Auto'}</div>
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

      <div className="d-flex gap-2 mb-3">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => shiftWeek(-1)}><i className="bi bi-chevron-left"></i> Prev Week</button>
        <span className="d-flex align-items-center px-3 small text-muted">
          {fmtDate(weekStart)} Ã¢â‚¬â€œ {fmtDate(new Date(new Date(`${weekStart}T00:00:00`).getTime() + 6 * 86400000))}
        </span>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => shiftWeek(1)}>Next Week <i className="bi bi-chevron-right"></i></button>
        <button type="button" className="btn btn-sm btn-outline-secondary ms-auto" onClick={() => setWeekStart(currentWeekStart())}><i className="bi bi-calendar-check me-1"></i>This Week</button>
      </div>

      {loading ? <Loading text="Loading timetableÃ¢â‚¬Â¦" /> : entries.length === 0 ? (
        <Empty
          icon="bi-calendar3-week"
          text={manager
            ? 'No timetable entries for the selected teacher and week.'
            : 'No published schedule for your assignments.'}
        />
      ) : (
        <TimetableWeekGrid
          entries={entries}
          substitutions={substitutions}
          weekStart={weekStart}
          resolveTeacher={(id) => teacherNames[String(id)]}
        />
      )}
      <div className="small text-muted mt-2">
        {manager
          ? 'Managers see draft entries as well. Teachers and students only ever see published entries for their own assignment.'
          : 'Showing only published entries for your assigned allocations. Substitutions appear in place of the original teacher.'}
      </div>
    </PageShell>
  );
}

