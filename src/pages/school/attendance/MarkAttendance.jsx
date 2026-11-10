import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';
import PrintButton from '../../../components/PrintButton';
import {
  Badge, Empty, ErrorBox, Loading, PageShell, activePolicies, canMark, categoryTone,
  fmtDate, sectionsFor, stateTone, today,
} from './shared';

function draftFromEntries(entries) {
  const map = {};
  (entries || []).forEach((entry) => {
    if (!entry.status_code) return;
    map[entry.student_id] = {
      statusCode: entry.status_code,
      remark: entry.remark || '',
      lateMinutes: entry.late_minutes ?? '',
      partialMinutes: entry.partial_minutes ?? '',
    };
  });
  return map;
}

export default function MarkAttendance({ me, onNavigate }) {
  const [date, setDate] = useState(today());
  const [classes, setClasses] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [register, setRegister] = useState(null);
  const [entries, setEntries] = useState([]);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const manager = canMark(me);

  const sections = useMemo(() => sectionsFor(classes, classId), [classes, classId]);
  const editable = Boolean(manager && register && register.state === 'draft');

  const summary = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;
    let other = 0;
    let unmarked = 0;
    entries.forEach((entry) => {
      const code = draft[entry.student_id]?.statusCode ?? entry.status_code;
      if (!code) { unmarked += 1; return; }
      const policy = policies.find((p) => p.code === code);
      if (policy?.category === 'present') present += 1;
      else if (policy?.category === 'absent') absent += 1;
      else if (policy?.category === 'late') late += 1;
      else if (policy?.category === 'excused') excused += 1;
      else other += 1;
    });
    return {
      total: entries.length,
      marked: entries.length - unmarked,
      unmarked,
      present,
      absent,
      late,
      excused,
      other,
      premarked: entries.filter((e) => e.source === 'system_premark').length,
    };
  }, [entries, draft, policies]);

  async function loadReference() {
    const [classResult, policyResult] = await Promise.all([
      apiGet('/school/classes'),
      apiGet('/school/attendance/policies'),
    ]);
    if (!classResult?.ok) throw new Error(classResult?.error || 'Could not load classes');
    setClasses(classResult.classes || []);
    if (policyResult?.ok) setPolicies(activePolicies(policyResult.policies));
  }

  async function fetchDetail(id) {
    const result = await apiGet(`/school/attendance/registers/${id}`);
    if (!result?.ok) throw new Error(result?.error || 'Could not load the register');
    setRegister(result.register);
    setEntries(result.entries || []);
    setDraft(draftFromEntries(result.entries));
    return result;
  }

  async function loadRegister() {
    if (!sectionId) {
      setRegister(null);
      setEntries([]);
      setDraft({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const params = new URLSearchParams({ date, sectionId });
      const result = await apiGet(`/school/attendance/registers?${params.toString()}`);
      if (!result?.ok) throw new Error(result?.error || 'Could not load the register');
      const found = (result.registers || [])[0];
      if (found) await fetchDetail(found.id);
      else {
        setRegister(null);
        setEntries([]);
        setDraft({});
      }
    } catch (err) {
      setError(err.message || 'Could not load the register');
    } finally {
      setLoading(false);
    }
  }

  async function ensureRegister() {
    if (register) return fetchDetail(register.id);
    const result = await apiPost('/school/attendance/registers', { date, sectionId });
    if (result?.ok && result.register) {
      toast(`Register started for ${result.rosterCount} students`, 'success');
      return fetchDetail(result.register.id);
    }
    if (result?.registerId) return fetchDetail(result.registerId);
    throw new Error(result?.error || 'Could not start the register');
  }

  async function startRegister() {
    setBusy(true);
    setNotice('');
    try {
      const detail = await ensureRegister();
      if (detail.register?.state !== 'draft') {
        setNotice(`This register is ${detail.register.state}. Corrections must be requested from the Corrections screen.`);
      }
    } catch (err) {
      setNotice(err.message || 'Could not start the register');
    } finally {
      setBusy(false);
    }
  }

  async function markAllPresent() {
    setBusy(true);
    setNotice('');
    try {
      const present = policies.find((p) => p.code === 'P') || policies.find((p) => p.category === 'present');
      if (!present) throw new Error('No "present" status is configured');
      const detail = await ensureRegister();
      if (detail.register?.state !== 'draft') {
        throw new Error(`Register is ${detail.register.state}; reopen it before marking`);
      }
      const list = detail.entries || [];
      setEntries(list);
      setDraft((current) => {
        const next = { ...current };
        list.forEach((entry) => {
          /* Approved leave / holiday premarks are kept until explicitly changed. */
          if (entry.source === 'system_premark') return;
          const prior = current[entry.student_id] || {};
          next[entry.student_id] = {
            statusCode: present.code,
            remark: prior.remark ?? entry.remark ?? '',
            lateMinutes: prior.lateMinutes ?? entry.late_minutes ?? '',
            partialMinutes: prior.partialMinutes ?? entry.partial_minutes ?? '',
          };
        });
        return next;
      });
      const marked = list.filter((e) => e.source !== 'system_premark').length;
      toast(`${marked} student${marked === 1 ? '' : 's'} set to ${present.label}`, 'success');
    } catch (err) {
      setNotice(err.message || 'Could not mark all present');
    } finally {
      setBusy(false);
    }
  }

  function setRow(studentId, field, value) {
    setDraft((current) => {
      const prior = current[studentId] || { statusCode: '', remark: '', lateMinutes: '', partialMinutes: '' };
      return { ...current, [studentId]: { ...prior, [field]: value } };
    });
  }

  async function saveDraft({ silent = false } = {}) {
    if (!register) return null;
    const payload = entries
      .filter((entry) => draft[entry.student_id]?.statusCode)
      .map((entry) => {
        const row = draft[entry.student_id];
        return {
          studentId: entry.student_id,
          statusCode: row.statusCode,
          remark: row.remark || '',
          lateMinutes: Number(row.lateMinutes) || 0,
          partialMinutes: Number(row.partialMinutes) || 0,
        };
      });
    if (!payload.length) {
      if (!silent) toast('Mark at least one student before saving', 'warning');
      return null;
    }
    const result = await apiPost(`/school/attendance/registers/${register.id}/entries`, {
      entries: payload,
      version: register.version,
    });
    if (result?.ok) {
      setRegister((current) => current && current.id === register.id
        ? { ...current, version: result.version }
        : current);
      if (!silent) toast(`Saved ${result.saved} attendance record${result.saved === 1 ? '' : 's'}`, 'success');
      return result;
    }
    if (Array.isArray(result?.errors) && result.errors.length) {
      toast(result.errors.slice(0, 3).map((e) => e.error).join(' Ã‚Â· '), 'error');
    } else {
      toast(result?.error || 'Could not save attendance', 'error');
    }
    return null;
  }

  async function saveDraftAction() {
    setBusy(true);
    try {
      await saveDraft();
    } catch (err) {
      toast(err.message || 'Could not save attendance', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function submitRegister() {
    setBusy(true);
    try {
      const saved = await saveDraft({ silent: true });
      if (!saved) return;
      const result = await apiPost(`/school/attendance/registers/${register.id}/submit`, { version: saved.version });
      if (!result?.ok) return toast(result?.error || 'Could not submit the register', 'error');
      toast(`Register submitted. ${result.notificationsQueued || 0} parent notification(s) queued.`, 'success');
      await loadRegister();
    } catch (err) {
      toast(err.message || 'Could not submit the register', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function finalizeRegister() {
    if (!window.confirm('Finalize this register? Only corrections with a reason can change it afterwards.')) return;
    setBusy(true);
    try {
      const result = await apiPost(`/school/attendance/registers/${register.id}/finalize`, { version: register.version });
      if (!result?.ok) return toast(result?.error || 'Could not finalize the register', 'error');
      toast('Register finalized', 'success');
      await loadRegister();
    } catch (err) {
      toast(err.message || 'Could not finalize the register', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function reopenRegister() {
    const reason = window.prompt('Reason for reopening this register (required):');
    if (!reason) return;
    setBusy(true);
    try {
      const result = await apiPost(`/school/attendance/registers/${register.id}/reopen`, { reason });
      if (!result?.ok) return toast(result?.error || 'Could not reopen the register', 'error');
      toast('Register reopened as a draft. All changes are audited.', 'success');
      await loadRegister();
    } catch (err) {
      toast(err.message || 'Could not reopen the register', 'error');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadReference()
      .catch((err) => setError(err.message || 'Could not load attendance settings'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (classId || !classes.length) return;
    const first = classes.find((c) => (c.sections || []).length > 0) || classes[0];
    setClassId(String(first.id));
    setSectionId(String((first.sections || [])[0]?.id || ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes]);

  useEffect(() => {
    loadRegister();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, sectionId]);

  return (
    <PageShell
      title="Mark Attendance"
      icon="bi-calendar-check"
      subtitle="One daily register per section. Mark exceptions, then submit. Every save is one transaction."
      onNavigate={onNavigate}
      actions={(
        <>
          <PrintButton targetId="attendance-mark-print" label="Print register" />
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadRegister()} disabled={loading || busy}>
            <i className="bi bi-arrow-clockwise me-1"></i>Refresh
          </button>
        </>
      )}
    >
      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3">
          <label className="form-label small mb-1">Date</label>
          <input type="date" className="form-control form-control-sm" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small mb-1">Class</label>
          <select className="form-select form-select-sm" value={classId} onChange={(e) => {
            const next = e.target.value;
            setClassId(next);
            setSectionId(String((sectionsFor(classes, next)[0] || {}).id || ''));
          }} disabled={busy}>
            <option value="">Choose class</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small mb-1">Section</label>
          <select className="form-select form-select-sm" value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={busy || !classId}>
            <option value="">Choose section</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="col-6 col-md-3 d-flex align-items-end gap-2">
          {!register && (
            <button type="button" className="btn btn-sm btn-primary w-100" onClick={startRegister} disabled={!manager || !sectionId || busy}>
              <i className="bi bi-plus-lg me-1"></i>Start register
            </button>
          )}
          {register && <span className={`badge bg-${stateTone(register.state)} w-100 py-2`}>{register.state.toUpperCase()} Ã‚Â· v{register.version}</span>}
        </div>
      </div>

      <ErrorBox message={error} onRetry={() => { setError(''); loadRegister(); }} />
      {notice && <div className="alert alert-warning py-2"><i className="bi bi-exclamation-triangle me-2"></i>{notice}</div>}

      {loading ? <Loading text="Loading registerÃ¢â‚¬Â¦" /> : !sectionId ? (
        <Empty icon="bi-calendar2-x" text="Choose a class and section to open its daily register." />
      ) : !register ? (
        <div className="border rounded p-4 text-center">
          <i className="bi bi-journal-plus d-block mb-2 text-muted" style={{ fontSize: 28 }}></i>
          <div className="fw-semibold">No register for {fmtDate(date)}</div>
          <p className="text-muted small mb-3">
            Starting the register resolves the enrolled roster and pre-marks approved leave, holidays and events.
          </p>
          <button type="button" className="btn btn-sm btn-primary" onClick={startRegister} disabled={!manager || busy}>
            <i className="bi bi-plus-lg me-1"></i>Start register
          </button>
        </div>
      ) : (
        <div id="attendance-mark-print">
          <div className="row g-2 mb-3">
            <div className="col-6 col-md-2"><div className="border rounded p-2"><div className="text-muted small">Roster</div><div className="fs-5 fw-bold">{summary.total}</div></div></div>
            <div className="col-6 col-md-2"><div className="border rounded p-2"><div className="text-muted small">Marked</div><div className="fs-5 fw-bold">{summary.marked}</div></div></div>
            <div className="col-6 col-md-2"><div className="border rounded p-2"><div className="text-muted small">Present</div><div className="fs-5 fw-bold text-success">{summary.present}</div></div></div>
            <div className="col-6 col-md-2"><div className="border rounded p-2"><div className="text-muted small">Absent</div><div className="fs-5 fw-bold text-danger">{summary.absent}</div></div></div>
            <div className="col-6 col-md-2"><div className="border rounded p-2"><div className="text-muted small">Late</div><div className="fs-5 fw-bold text-warning">{summary.late}</div></div></div>
            <div className="col-6 col-md-2"><div className="border rounded p-2"><div className="text-muted small">Pre-marked</div><div className="fs-5 fw-bold">{summary.premarked}</div></div></div>
          </div>

          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            <div className="small text-muted">
              {register.class_name} Ã‚Â· {register.section_name} Ã‚Â· {fmtDate(register.register_date)} Ã‚Â· {register.academic_year || ''}
            </div>
            <div className="ms-auto d-flex flex-wrap gap-2">
              <button type="button" className="btn btn-sm btn-outline-success" onClick={markAllPresent} disabled={!editable || busy}>
                <i className="bi bi-check2-all me-1"></i>All present
              </button>
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={saveDraftAction} disabled={!editable || busy}>
                <i className="bi bi-save me-1"></i>Save draft
              </button>
              <button type="button" className="btn btn-sm btn-primary" onClick={submitRegister} disabled={!editable || busy || summary.marked < summary.total}>
                <i className="bi bi-send me-1"></i>Submit
              </button>
              {register.state === 'submitted' && (
                <button type="button" className="btn btn-sm btn-success" onClick={finalizeRegister} disabled={!manager || busy}>
                  <i className="bi bi-lock me-1"></i>Finalize
                </button>
              )}
              {(register.state === 'submitted' || register.state === 'finalized') && (
                <button type="button" className="btn btn-sm btn-outline-warning" onClick={reopenRegister} disabled={!manager || busy}>
                  <i className="bi bi-unlock me-1"></i>Reopen
                </button>
              )}
            </div>
          </div>

          {register.state !== 'draft' && (
            <div className="alert alert-info py-2 small">
              <i className="bi bi-lock me-1"></i>
              This register is {register.state}. Changes must go through <strong>Corrections</strong> so old and new values stay auditable.
            </div>
          )}
          {!manager && (
            <div className="alert alert-secondary py-2 small">You have read-only access to attendance.</div>
          )}

          <div className="table-responsive border rounded">
            <table className="table table-sm mb-0 align-middle">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Roll</th>
                  <th>Student</th>
                  <th style={{ width: 180 }}>Status</th>
                  <th style={{ width: 110 }}>Late min</th>
                  <th style={{ width: 110 }}>Partial min</th>
                  <th>Remark</th>
                  <th style={{ width: 90 }}>Source</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 && <tr><td colSpan="7"><Empty icon="bi-people" text="No enrolled students were found for this section and date." /></td></tr>}
                {entries.map((entry) => {
                  const row = draft[entry.student_id] || {};
                  const code = row.statusCode ?? entry.status_code ?? '';
                  const policy = policies.find((p) => p.code === code);
                  const premarked = entry.source === 'system_premark';
                  return (
                    <tr key={entry.student_id} className={policy?.category === 'absent' ? 'table-danger' : ''}>
                      <td>{entry.roll_no || 'Ã¢â‚¬â€'}</td>
                      <td>
                        <div className="fw-semibold">{entry.first_name} {entry.last_name || ''}</div>
                        <div className="small text-muted">{entry.admission_no}</div>
                      </td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={code}
                          onChange={(e) => setRow(entry.student_id, 'statusCode', e.target.value)}
                          disabled={!editable || busy}
                        >
                          <option value="">Not marked</option>
                          {policies.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
                        </select>
                        {policy && <Badge tone={categoryTone(policy.category)}>{policy.category}</Badge>}
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          className="form-control form-control-sm"
                          value={row.lateMinutes ?? ''}
                          onChange={(e) => setRow(entry.student_id, 'lateMinutes', e.target.value)}
                          disabled={!editable || busy || !policy || !['late', 'partial'].includes(policy.category)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          className="form-control form-control-sm"
                          value={row.partialMinutes ?? ''}
                          onChange={(e) => setRow(entry.student_id, 'partialMinutes', e.target.value)}
                          disabled={!editable || busy || policy?.category !== 'partial'}
                        />
                      </td>
                      <td>
                        <input
                          className="form-control form-control-sm"
                          value={row.remark ?? ''}
                          placeholder={policy?.requires_reason ? 'Reason required' : 'Optional'}
                          onChange={(e) => setRow(entry.student_id, 'remark', e.target.value)}
                          disabled={!editable || busy}
                        />
                      </td>
                      <td>
                        {premarked ? <Badge tone="info">pre-marked</Badge> : entry.is_marked || row.statusCode ? <Badge tone="success">marked</Badge> : <Badge tone="secondary">new</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="small text-muted mt-2">
            Approved leave, holidays and events are pre-marked when the register is created. Those rows stay marked until you deliberately change them.
            Marking is one transactional save; notifications are queued and never block the save.
          </div>
        </div>
      )}
    </PageShell>
  );
}
