import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../../api';
import { toast } from '../../toast';

const today = () => new Date().toISOString().slice(0, 10);

function ListPage({ formId, config }) {
  const TITLE = config?.title || 'Attendance';
  const [classes, setClasses] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [date, setDate] = useState(today());
  const [filters, setFilters] = useState({ classId: '', sectionId: '' });
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [register, setRegister] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const loadClasses = async () => {
    try {
      const d = await apiGet('/school/classes');
      if (d?.ok) setClasses(d.classes || []);
    } catch { /* silent */ }
  };

  const loadPolicies = async () => {
    try {
      const d = await apiGet('/school/attendance/policies');
      if (d?.ok) {
        const ordered = [...d.policies].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        setPolicies(ordered);
      }
    } catch { /* silent */ }
  };

  const load = async () => {
    if (!filters.classId || !filters.sectionId) return;
    setNotice('');
    try {
      // Try to find an existing register for this section/date
      const d = await apiGet(`/school/attendance/registers?date=${date}&sectionId=${filters.sectionId}`);
      if (d?.ok && d.registers?.length) {
        setRegister(d.registers[0]);
        await loadRegisterEntries(d.registers[0].id);
      } else {
        setRegister(null);
        setRows([]);
        setCounts({});
      }
    } catch { toast('Failed to load attendance', 'error'); }
  };

  const loadRegisterEntries = async (registerId) => {
    try {
      const d = await apiGet(`/school/attendance/registers/${registerId}`);
      if (d?.ok) {
        setRegister(d.register);
        const entries = d.entries || [];
        const rowMap = {};
        entries.forEach((e) => {
          rowMap[e.student_id] = {
            id: e.student_id,
            admission_no: e.admission_no,
            first_name: e.first_name,
            last_name: e.last_name,
            roll_no: e.roll_no,
            status: e.status_code || '',
            statusLabel: e.status_label,
            statusCategory: e.status_category,
            countsAsPresent: e.counts_as_present,
            lateMinutes: e.late_minutes || 0,
            partialMinutes: e.partial_minutes || 0,
            remark: e.remark || '',
            source: e.source || '',
          };
        });
        const rowsList = Object.values(rowMap).sort((a, b) => {
          const ra = a.roll_no || '';
          const rb = b.roll_no || '';
          return ra.localeCompare(rb) || a.first_name.localeCompare(b.first_name);
        });
        setRows(rowsList);
        recomputeCounts(rowsList);
      }
    } catch { toast('Failed to load register entries', 'error'); }
  };

  const recomputeCounts = (list) => {
    const c = { present: 0, absent: 0, late: 0, excused: 0, activity: 0, partial: 0, unmarked: 0, total: list.length };
    list.forEach((r) => {
      if (!r.status) { c.unmarked++; return; }
      if (r.statusCategory === 'present') c.present++;
      else if (r.statusCategory === 'absent') c.absent++;
      else if (r.statusCategory === 'late') c.late++;
      else if (r.statusCategory === 'excused') c.excused++;
      else if (r.statusCategory === 'activity') c.activity++;
      else if (r.statusCategory === 'partial') c.partial++;
    });
    setCounts(c);
  };

  useEffect(() => { loadClasses(); loadPolicies(); }, []);
  useEffect(() => { load(); }, [date, filters.classId, filters.sectionId]);

  const classOptions = useMemo(() => classes.map((c) => ({ id: c.id, name: c.name, sections: c.sections || [] })), [classes]);
  const sectionOptions = classOptions.find((c) => String(c.id) === String(filters.classId))?.sections || [];

  const policyOptions = useMemo(() => (
    [...policies]
      .filter((p) => p.is_active !== false)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || String(a.code).localeCompare(String(b.code)))
  ), [policies]);

  const mark = (id, statusCode) => setRows((r) => {
    const next = r.map((x) => (x.id === id ? {
      ...x,
      status: statusCode,
      statusCategory: policies.find((p) => p.code === statusCode)?.category || x.statusCategory,
    } : x));
    recomputeCounts(next);
    return next;
  });

  const markAllPresent = () => {
    const present = policies.find((p) => p.code === 'P') || policies.find((p) => p.category === 'present' && p.is_active !== false);
    if (!present) return toast('No present status is configured', 'error');
    const next = rows.map((r) => (
      r.source === 'system_premark'
        ? r
        : { ...r, status: present.code, statusCategory: present.category }
    ));
    setRows(next);
    recomputeCounts(next);
  };

  const ensureRegister = async () => {
    if (!filters.classId || !filters.sectionId) return null;
    if (register) return register.id;
    try {
      const d = await apiPost('/school/attendance/registers', { date, sectionId: filters.sectionId });
      if (d?.ok) {
        setRegister(d.register);
        await loadRegisterEntries(d.register.id);
        return d.register.id;
      }
      /* A register already exists (409): open it instead of dropping the roster. */
      if (d?.registerId) {
        await loadRegisterEntries(d.registerId);
        return d.registerId;
      }
      const message = d?.error || 'Failed to create register';
      setNotice(message);
      toast(message, /instructional day/i.test(message) ? 'warning' : 'error');
      return null;
    } catch { toast('Failed to create register', 'error'); return null; }
  };

  const createRegister = async () => {
    if (!filters.classId || !filters.sectionId) return toast('Select class and section', 'error');
    setBusy(true);
    try {
      const id = await ensureRegister();
      if (id) toast('Register created. Approved leave, holidays and events are pre-marked.', 'success');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!filters.classId || !filters.sectionId) return toast('Select class and section', 'error');
    if (!register) return toast('Start the register first', 'warning');
    if (register.state !== 'draft') return toast('This register is locked. Use Corrections to change it.', 'warning');
    const entries = rows.filter((r) => r.status).map((r) => ({
      studentId: r.id,
      statusCode: r.status,
      lateMinutes: r.lateMinutes || 0,
      partialMinutes: r.partialMinutes || 0,
      remark: r.remark || null,
    }));
    if (!entries.length) return toast('Mark at least one student before saving', 'warning');

    setSaving(true);
    try {
      const res = await apiPost(`/school/attendance/registers/${register.id}/entries`, { entries, version: register.version });
      if (res?.ok) {
        toast(`Saved ${res.saved} attendance record${res.saved === 1 ? '' : 's'}`, 'success');
        await loadRegisterEntries(res.registerId || register.id);
      } else {
        toast(res?.error || 'Failed to save', 'error');
      }
    } catch { toast('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const submit = async () => {
    if (!register) return;
    setSubmitting(true);
    try {
      const res = await apiPost(`/school/attendance/registers/${register.id}/submit`, { version: register.version });
      if (res?.ok) {
        toast(`Attendance submitted. ${res.notificationsQueued || 0} notification(s) queued.`, 'success');
        await loadRegisterEntries(register.id);
      } else {
        toast(res?.error || 'Failed to submit', 'error');
      }
    } catch { toast('Failed to submit', 'error'); }
    finally { setSubmitting(false); }
  };

  const fullName = (s) => `${s.first_name || ''} ${s.last_name || ''}`.trim();

  const setRow = (id, field, value) => setRows((r) => {
    const next = r.map((x) => (x.id === id ? { ...x, [field]: value } : x));
    return next;
  });

  return (
    <div className="page-content animate-fade">
      <div className="card mb-3">
        <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div className="card-title mb-0"><i className="bi bi-calendar-check me-2"></i>{TITLE}</div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <input type="date" className="form-control form-control-sm" style={{ width: 150 }} value={date} onChange={(e) => setDate(e.target.value)} />
            <select className="form-select form-select-sm" style={{ width: 160 }} value={filters.classId} onChange={(e) => setFilters({ classId: e.target.value, sectionId: '' })}>
              <option value="">Select class</option>
              {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="form-select form-select-sm" style={{ width: 140 }} value={filters.sectionId} onChange={(e) => setFilters({ ...filters, sectionId: e.target.value })}>
              <option value="">Select section</option>
              {sectionOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={load} title="Refresh"><i className="bi bi-arrow-clockwise"></i></button>
            {!register && filters.sectionId && (
              <button type="button" className="btn btn-sm btn-primary" onClick={createRegister} disabled={busy}>
                <i className="bi bi-plus-lg"></i> {busy ? 'Starting…' : 'Start Register'}
              </button>
            )}
            {register && register.state === 'draft' && (
              <>
                <button type="button" className="btn btn-sm btn-outline-success" onClick={markAllPresent} disabled={saving || submitting}>
                  <i className="bi bi-check2-all"></i> All Present
                </button>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={save} disabled={saving || submitting}>
                  <i className="bi bi-save"></i> {saving ? 'Saving…' : 'Save Draft'}
                </button>
                <button type="button" className="btn btn-sm btn-success" onClick={submit} disabled={saving || submitting || !counts.total}>
                  <i className="bi bi-check-lg"></i> {submitting ? 'Submitting…' : 'Submit'}
                </button>
              </>
            )}
            {register && register.state !== 'draft' && (
              <span className="badge bg-info text-dark align-self-center">
                <i className="bi bi-lock me-1"></i>{register.state} · use Corrections to change
              </span>
            )}
          </div>
        </div>
        {notice && (
          <div className="alert alert-warning rounded-0 border-start-0 border-end-0 mb-0 py-2 small">
            <i className="bi bi-exclamation-triangle me-2"></i>{notice}
          </div>
        )}
        {register && (
          <div className="card-body py-2 d-flex gap-3 small text-muted flex-wrap">
            <span>State: <strong className="text-body">{register.state}</strong></span>
            <span>Present: <strong className="text-success">{counts.present || 0}</strong></span>
            <span>Absent: <strong className="text-danger">{counts.absent || 0}</strong></span>
            <span>Late: <strong className="text-warning">{counts.late || 0}</strong></span>
            <span>Excused: <strong className="text-info">{counts.excused || 0}</strong></span>
            <span>Unmarked: <strong className="text-body">{counts.unmarked || 0}</strong></span>
            <span>Roster: <strong className="text-body">{counts.total || 0}</strong></span>
          </div>
        )}
      </div>
      <div className="card">
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>#</th>
                <th>Student</th>
                <th>Admission No</th>
                <th>Roll</th>
                <th className="text-center" style={{ width: 170 }}>Status</th>
                <th style={{ width: 100 }}>Late min</th>
                <th style={{ width: 100 }}>Partial min</th>
                <th>Remark</th>
              </tr>
            </thead>
            <tbody>
              {(!filters.classId || !filters.sectionId) && (
                <tr><td colSpan={8} className="text-center text-muted py-3">Select class and section to mark attendance</td></tr>
              )}
              {filters.classId && filters.sectionId && !register && (
                <tr><td colSpan={8} className="text-center text-muted py-3">
                  No register for this date. Choose <strong>Start Register</strong> to load the enrolled roster and pre-mark approved leave.
                </td></tr>
              )}
              {register && rows.length === 0 && (
                <tr><td colSpan={8} className="text-center text-muted py-3">No students found for this section</td></tr>
              )}
              {rows.map((r, idx) => {
                const rowPolicy = policies.find((p) => p.code === r.status);
                const locked = !register || register.state !== 'draft';
                return (
                  <tr key={r.id} className={rowPolicy?.category === 'absent' ? 'table-danger' : ''}>
                    <td>{idx + 1}</td>
                    <td>
                      <strong>{fullName(r)}</strong>
                      {r.source === 'system_premark' && <span className="badge bg-info text-dark ms-2">pre-marked</span>}
                    </td>
                    <td><code>{r.admission_no}</code></td>
                    <td>{r.roll_no || '-'}</td>
                    <td className="text-center">
                      <select
                        className="form-select form-select-sm"
                        value={r.status || ''}
                        onChange={(e) => mark(r.id, e.target.value)}
                        disabled={locked}
                      >
                        <option value="">Not marked</option>
                        {policyOptions.map((p) => (
                          <option key={p.code} value={p.code}>{p.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        className="form-control form-control-sm"
                        value={r.lateMinutes ?? ''}
                        onChange={(e) => setRow(r.id, 'lateMinutes', e.target.value)}
                        disabled={locked || !rowPolicy || !['late', 'partial'].includes(rowPolicy.category)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        className="form-control form-control-sm"
                        value={r.partialMinutes ?? ''}
                        onChange={(e) => setRow(r.id, 'partialMinutes', e.target.value)}
                        disabled={locked || rowPolicy?.category !== 'partial'}
                      />
                    </td>
                    <td>
                      <input
                        className="form-control form-control-sm"
                        value={r.remark || ''}
                        placeholder={rowPolicy?.requires_reason ? 'Reason required' : 'Optional'}
                        onChange={(e) => setRow(r.id, 'remark', e.target.value)}
                        disabled={locked}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ListPage;