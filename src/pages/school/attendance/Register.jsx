import React, { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../../../api';
import PrintButton from '../../../components/PrintButton';
import {
  Badge, Empty, ErrorBox, Loading, PageShell, categoryTone, fmtDate, fmtDateTime,
  sectionsFor, stateTone, today,
} from './shared';

export default function Register({ me, onNavigate }) {
  const [date, setDate] = useState(today());
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [state, setState] = useState('');
  const [registers, setRegisters] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  const sections = useMemo(() => sectionsFor(classes, classId), [classes, classId]);

  async function loadDetail(id) {
    if (!id) { setDetail(null); return; }
    setDetailLoading(true);
    try {
      const result = await apiGet(`/school/attendance/registers/${id}`);
      if (!result?.ok) throw new Error(result?.error || 'Could not load the register');
      setDetail(result);
      setSelectedId(String(id));
    } catch (err) {
      setError(err.message || 'Could not load the register');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (date) params.set('date', date);
      if (sectionId) params.set('sectionId', sectionId);
      if (state) params.set('state', state);
      const result = await apiGet(`/school/attendance/registers?${params.toString()}`);
      if (!result?.ok) throw new Error(result?.error || 'Could not load registers');
      const list = result.registers || [];
      setRegisters(list);
      const keep = list.find((r) => String(r.id) === String(selectedId));
      const pick = keep || list[0];
      if (pick) await loadDetail(pick.id);
      else { setSelectedId(''); setDetail(null); }
    } catch (err) {
      setError(err.message || 'Could not load registers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    apiGet('/school/classes')
      .then((result) => {
        if (result?.ok) setClasses(result.classes || []);
      })
      .catch((err) => setError(err.message || 'Could not load classes'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, sectionId, state]);

  const counts = detail?.counts || { total: 0, marked: 0, unmarked: 0, premarked: 0 };
  const register = detail?.register;
  const entries = detail?.entries || [];

  return (
    <PageShell
      title="Attendance Register"
      icon="bi-journal-text"
      subtitle="Read-only view of daily registers: who marked them, how they were submitted, and which students are still unmarked."
      onNavigate={onNavigate}
      actions={(
        <>
          <PrintButton targetId="attendance-register-print" label="Print register" />
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => load()} disabled={loading}>
            <i className="bi bi-arrow-clockwise me-1"></i>Refresh
          </button>
        </>
      )}
    >
      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3">
          <label className="form-label small mb-1">Date</label>
          <input type="date" className="form-control form-control-sm" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small mb-1">Class</label>
          <select className="form-select form-select-sm" value={classId} onChange={(e) => {
            const next = e.target.value;
            setClassId(next);
            setSectionId(String((sectionsFor(classes, next)[0] || {}).id || ''));
          }}>
            <option value="">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small mb-1">Section</label>
          <select className="form-select form-select-sm" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            <option value="">All sections</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small mb-1">State</label>
          <select className="form-select form-select-sm" value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">All states</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="finalized">Finalized</option>
            <option value="reopened">Reopened (draft)</option>
          </select>
        </div>
      </div>

      <ErrorBox message={error} onRetry={() => { setError(''); load(); }} />

      <div className="row g-3">
        <div className="col-lg-5">
          <div className="border rounded">
            <div className="px-3 py-2 border-bottom fw-semibold small">
              Registers {date ? `on ${fmtDate(date)}` : ''} Ã‚Â· {registers.length}
            </div>
            {loading ? <Loading text="Loading registersÃ¢â‚¬Â¦" /> : registers.length === 0 ? (
              <Empty icon="bi-journal-x" text="No registers match these filters." />
            ) : (
              <div className="table-responsive">
                <table className="table table-sm table-hover mb-0 align-middle">
                  <thead><tr><th>Date</th><th>Class / Section</th><th>State</th><th>Entries</th></tr></thead>
                  <tbody>
                    {registers.map((r) => (
                      <tr key={r.id} role="button" onClick={() => loadDetail(r.id)} className={String(r.id) === String(selectedId) ? 'table-active' : ''}>
                        <td className="text-nowrap">{fmtDate(r.register_date)}</td>
                        <td>{r.class_name || 'Ã¢â‚¬â€'} {r.section_name || ''}</td>
                        <td><Badge tone={stateTone(r.state)}>{r.state}</Badge></td>
                        <td>{r.entry_count ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="col-lg-7">
          {detailLoading ? <Loading text="Loading registerÃ¢â‚¬Â¦" /> : !register ? (
            <div className="border rounded">
              <Empty icon="bi-journal-text" text="Select a register to see its roster and audit details." />
            </div>
          ) : (
            <div id="attendance-register-print">
              <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                <div>
                  <div className="fw-bold">{register.class_name || 'Ã¢â‚¬â€'} {register.section_name || ''}</div>
                  <div className="small text-muted">{fmtDate(register.register_date)} Ã‚Â· {register.academic_year || ''} Ã‚Â· v{register.version}</div>
                </div>
                <Badge tone={stateTone(register.state)}>{register.state}</Badge>
              </div>

              <div className="row g-2 mb-3">
                <div className="col-3"><div className="border rounded p-2"><div className="text-muted small">Roster</div><div className="fw-bold">{counts.total}</div></div></div>
                <div className="col-3"><div className="border rounded p-2"><div className="text-muted small">Marked</div><div className="fw-bold">{counts.marked}</div></div></div>
                <div className="col-3"><div className="border rounded p-2"><div className="text-muted small">Unmarked</div><div className="fw-bold text-danger">{counts.unmarked}</div></div></div>
                <div className="col-3"><div className="border rounded p-2"><div className="text-muted small">Pre-marked</div><div className="fw-bold">{counts.premarked}</div></div></div>
              </div>

              <div className="small text-muted mb-3">
                Created by {register.created_by || 'Ã¢â‚¬â€'} on {fmtDateTime(register.created_at)}
                {register.submitted_by ? ` Ã‚Â· Submitted by ${register.submitted_by} on ${fmtDateTime(register.submitted_at)}` : ''}
                {register.finalized_by ? ` Ã‚Â· Finalized by ${register.finalized_by} on ${fmtDateTime(register.finalized_at)}` : ''}
              </div>

              <div className="table-responsive border rounded">
                <table className="table table-sm mb-0 align-middle">
                  <thead><tr><th>Roll</th><th>Student</th><th>Status</th><th>Remark</th><th>Marked by</th><th>Source</th></tr></thead>
                  <tbody>
                    {entries.length === 0 && <tr><td colSpan="6"><Empty icon="bi-people" text="No distinct roster could be resolved for this date." /></td></tr>}
                    {entries.map((entry) => (
                      <tr key={`${entry.student_id}-${entry.id || 'new'}`} className={entry.status_category === 'absent' ? 'table-danger' : ''}>
                        <td>{entry.roll_no || 'Ã¢â‚¬â€'}</td>
                        <td><div className="fw-semibold">{entry.first_name} {entry.last_name || ''}</div><div className="small text-muted">{entry.admission_no}</div></td>
                        <td>
                          {entry.status_code ? <Badge tone={categoryTone(entry.status_category)}>{entry.status_label || entry.status_code}</Badge> : <Badge tone="secondary">unmarked</Badge>}
                        </td>
                        <td className="small">{entry.remark || 'Ã¢â‚¬â€'}</td>
                        <td className="small">{entry.marked_by || 'Ã¢â‚¬â€'}<div className="text-muted">{entry.marked_at ? fmtDateTime(entry.marked_at) : ''}</div></td>
                        <td className="small">{entry.source || 'Ã¢â‚¬â€'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

