import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, ErrorBox, canManage, marksSheetTone } from './shared';

const STATUS_CODES = [
  { code: 'AB', label: 'Absent', tone: 'danger' },
  { code: 'ML', label: 'Medical Leave', tone: 'warning' },
  { code: 'EX', label: 'Exempted', tone: 'secondary' },
  { code: 'UFM', label: 'Unfair Means', tone: 'dark' },
  { code: 'WH', label: 'Withheld', tone: 'dark' },
];

function cellKey(studentId, componentId) {
  return `${studentId}:${componentId}`;
}

export default function MarksEntry({ me, onNavigate, sheetId }) {
  const [data, setData] = useState(null);
  const [cells, setCells] = useState({});
  const [initial, setInitial] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [rowErrors, setRowErrors] = useState({});
  const [lastSaved, setLastSaved] = useState(null);
  const dirtyRef = useRef(null);
  const manager = canManage(me, 'exam.marks.entry');
  const canLock = canManage(me, 'exam.marks.lock');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await apiGet(`/school/marks-sheets/${sheetId}`);
      if (!res?.ok) throw new Error(res?.error || 'Could not load marks sheet');
      const next = {};
      (res.grid || []).forEach((row) => {
        (row.components || []).forEach((cell) => {
          next[cellKey(row.student.id, cell.component.id)] = {
            marks: cell.marks === null || cell.marks === undefined ? '' : String(cell.marks),
            code: cell.status_code || '',
            rowVersion: cell.row_version || 1,
          };
        });
      });
      setData(res);
      setCells(next);
      setInitial(JSON.parse(JSON.stringify(next)));
      setRowErrors({});
    } catch (err) {
      setError(err.message || 'Failed to load marks sheet');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sheetId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetId]);

  const dirty = useMemo(() => {
    const out = {};
    for (const [key, value] of Object.entries(cells)) {
      const before = initial[key] || {};
      const changed = String(value.marks ?? '') !== String(before.marks ?? '') || String(value.code ?? '') !== String(before.code ?? '');
      if (changed) out[key] = value;
    }
    return out;
  }, [cells, initial]);
  dirtyRef.current = dirty;

  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (Object.keys(dirtyRef.current || {}).length) save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validateCell(studentId, component, next) {
    if (next.code) return null;
    if (next.marks === '' || next.marks === null || next.marks === undefined) return null;
    const value = Number(next.marks);
    if (!Number.isFinite(value)) return 'Enter a number or pick a status code';
    if (value < 0 || value > Number(component.max_marks)) return `Max is ${component.max_marks}`;
    return null;
  }

  function updateCell(rowIndex, colIndex, studentId, component, patch) {
    const key = cellKey(studentId, component.id);
    setCells((prev) => {
      const current = prev[key] || { marks: '', code: '', rowVersion: 1 };
      const next = { ...current, ...patch };
      if (patch.code !== undefined && patch.code) next.marks = '';
      if (patch.marks !== undefined && String(patch.marks) !== '') next.code = '';
      return { ...prev, [key]: next };
    });
    setRowErrors((prev) => {
      if (!prev[key]) return prev;
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    if (patch.marks !== undefined) {
      const message = validateCell(studentId, component, { marks: patch.marks, code: '' });
      if (message) setRowErrors((prev) => ({ ...prev, [key]: message }));
    }
  }

  function focusCell(rowIndex, colIndex) {
    const node = document.querySelector(`[data-cell="${rowIndex}-${colIndex}"]`);
    if (node) {
      node.focus();
      if (node.select) node.select();
    }
  }

  function onCellKeyDown(event, rowIndex, colIndex) {
    if (event.key === 'Enter') {
      event.preventDefault();
      focusCell(rowIndex + 1, colIndex);
    } else if (event.key === 'ArrowDown' && !event.shiftKey) {
      event.preventDefault();
      focusCell(rowIndex + 1, colIndex);
    } else if (event.key === 'ArrowUp' && !event.shiftKey) {
      event.preventDefault();
      focusCell(rowIndex - 1, colIndex);
    } else if (event.key === 'ArrowRight' && event.target.selectionStart === event.target.value.length) {
      event.preventDefault();
      focusCell(rowIndex, colIndex + 1);
    } else if (event.key === 'ArrowLeft' && event.target.selectionStart === 0) {
      event.preventDefault();
      focusCell(rowIndex, colIndex - 1);
    }
  }

  async function save() {
    const entries = Object.entries(dirtyRef.current || {}).map(([key, value]) => {
      const [studentId, componentId] = key.split(':').map(Number);
      return {
        studentId,
        componentId,
        marks: value.code ? null : value.marks === '' ? null : Number(value.marks),
        statusCode: value.code || null,
        rowVersion: value.rowVersion,
      };
    });
    if (!entries.length) return toast('Nothing to save', 'info');
    setSaving(true);
    setError('');
    try {
      const res = await apiPost(`/school/marks-sheets/${sheetId}/entries`, { entries });
      if (!res?.ok) {
        if (Array.isArray(res?.errors)) {
          const map = {};
          res.errors.forEach((item) => { map[cellKey(item.studentId, item.componentId)] = item.error; });
          setRowErrors(map);
        }
        throw new Error(res?.error || 'Could not save marks');
      }
      toast(`Saved ${res.saved} mark entr${res.saved === 1 ? 'y' : 'ies'}`, 'success');
      setLastSaved(new Date().toISOString());
      await load();
    } catch (err) {
      setError(err.message || 'Failed to save marks');
      toast(err.message || 'Failed to save marks', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    if (Object.keys(dirty).length && !window.confirm('You have unsaved changes. Save them before submitting?')) return;
    if (Object.keys(dirty).length) return;
    if (!window.confirm('Submit this sheet for verification? You can no longer edit it until it is reopened.')) return;
    try {
      await apiPost(`/school/marks-sheets/${sheetId}/submit`, {});
      toast('Sheet submitted', 'success');
      load();
    } catch (err) {
      toast(err.message || 'Could not submit sheet', 'error');
    }
  }

  async function verify() {
    if (!window.confirm('Verify this submitted sheet?')) return;
    try {
      await apiPost(`/school/marks-sheets/${sheetId}/verify`, {});
      toast('Sheet verified', 'success');
      load();
    } catch (err) {
      toast(err.message || 'Could not verify sheet', 'error');
    }
  }

  async function lock() {
    if (!window.confirm('Lock this sheet? Marks can then only change through an approved correction.')) return;
    try {
      await apiPost(`/school/marks-sheets/${sheetId}/lock`, {});
      toast('Sheet locked', 'success');
      load();
    } catch (err) {
      toast(err.message || 'Could not lock sheet', 'error');
    }
  }

  async function reopen() {
    const reason = window.prompt('Reason for reopening this sheet (audited):');
    if (!reason) return;
    try {
      await apiPost(`/school/marks-sheets/${sheetId}/reopen`, { reason });
      toast('Sheet reopened', 'success');
      load();
    } catch (err) {
      toast(err.message || 'Could not reopen sheet', 'error');
    }
  }

  const sheet = data?.sheet;
  const grid = data?.grid || [];
  const components = data?.components || [];
  const editable = sheet && ['not_started', 'draft', 'reopened'].includes(sheet.state) && manager;
  const componentMaxTotal = components.reduce((sum, c) => sum + Number(c.max_marks || 0), 0);

  function rowTotal(row) {
    return (row.components || []).reduce((sum, cell) => {
      const state = cells[cellKey(row.student.id, cell.component.id)];
      if (!state || state.code) return sum;
      const value = Number(state.marks);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
  }

  return (
    <PageShell
      title="Marks Entry"
      icon="bi-grid-3x3-gap"
      subtitle={sheet ? `${sheet.exam_name || 'Exam'} Ã‚Â· ${sheet.subject_name || 'Subject'} Ã‚Â· ${sheet.class_name || ''} ${sheet.section_name || ''}` : 'Enter raw marks or status codes'}
      onNavigate={onNavigate}
      actions={
        <>
          <button className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/examinations/marks')}>
            <i className="bi bi-arrow-left me-1"></i>Dashboard
          </button>
          <button className="btn btn-sm btn-outline-secondary" onClick={load} disabled={saving}>
            <i className="bi bi-arrow-clockwise me-1"></i>Reload
          </button>
          {editable && (
            <button className="btn btn-sm btn-primary" onClick={save} disabled={saving || !Object.keys(dirty).length}>
              <i className="bi bi-save me-1"></i>{saving ? 'SavingÃ¢â‚¬Â¦' : `Save${Object.keys(dirty).length ? ` (${Object.keys(dirty).length})` : ''}`}
            </button>
          )}
          {editable && sheet.state !== 'not_started' && (
            <button className="btn btn-sm btn-success" onClick={submit} disabled={saving || Object.keys(dirty).length > 0}>
              <i className="bi bi-send me-1"></i>Submit
            </button>
          )}
          {manager && sheet?.state === 'submitted' && (
            <button className="btn btn-sm btn-primary" onClick={verify}>Verify</button>
          )}
          {canLock && ['submitted', 'verified'].includes(sheet?.state) && (
            <button className="btn btn-sm btn-success" onClick={lock}>Lock</button>
          )}
          {canLock && ['locked', 'verified'].includes(sheet?.state) && (
            <button className="btn btn-sm btn-warning" onClick={reopen}>Reopen</button>
          )}
        </>
      }
    >
      <ErrorBox message={error} onRetry={load} />

      {loading ? <Loading text="Loading marks sheetÃ¢â‚¬Â¦" /> : !sheet ? (
        <Empty icon="bi-table" text="Marks sheet not found." />
      ) : (
        <>
          <div className="d-flex flex-wrap gap-3 align-items-center mb-3">
            <span className={`badge bg-${marksSheetTone(sheet.state)}`}>{sheet.state}</span>
            <span className="small text-muted">Max total: <strong>{componentMaxTotal}</strong></span>
            <span className="small text-muted">Students: <strong>{grid.length}</strong></span>
            <span className="small text-muted">Components: <strong>{components.length}</strong></span>
            <span className="small text-muted">Unsaved: <strong className={Object.keys(dirty).length ? 'text-warning' : ''}>{Object.keys(dirty).length}</strong></span>
            {lastSaved && <span className="small text-muted">Last saved {new Date(lastSaved).toLocaleTimeString()}</span>}
            {!editable && <span className="small text-danger">Read-only Ã¢â‚¬â€ {sheet.state === 'locked' ? 'use a correction to change marks' : 'this sheet is not editable in its current state'}.</span>}
          </div>

          {!components.length ? (
            <Empty icon="bi-list-check" text="This paper has no components. Add Theory / Internal components in Exam Setup first." />
          ) : !grid.length ? (
            <Empty icon="bi-people" text="No active students are enrolled in this section." />
          ) : (
            <div className="border rounded">
              <div className="table-responsive" style={{ maxHeight: '66vh' }}>
                <table className="table table-sm table-bordered mb-0 align-middle marks-entry-table">
                  <thead className="table-light" style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                    <tr>
                      <th style={{ minWidth: 44 }}>#</th>
                      <th style={{ minWidth: 170 }}>Student</th>
                      {components.map((component) => (
                        <th key={component.id} className="text-center" style={{ minWidth: 130 }}>
                          <div className="small fw-semibold">{component.name}</div>
                          <div className="text-muted" style={{ fontSize: 11 }}>Max {component.max_marks}</div>
                        </th>
                      ))}
                      <th className="text-center" style={{ minWidth: 90 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grid.map((row, rowIndex) => (
                      <tr key={row.student.id}>
                        <td className="small text-muted">{rowIndex + 1}</td>
                        <td className="small">
                          <div className="fw-semibold">{row.student.first_name} {row.student.last_name}</div>
                          <div className="text-muted" style={{ fontSize: 11 }}>{row.student.admission_no} Ã‚Â· Roll {row.student.roll_no || 'Ã¢â‚¬â€'}</div>
                        </td>
                        {components.map((component, colIndex) => {
                          const key = cellKey(row.student.id, component.id);
                          const state = cells[key] || { marks: '', code: '', rowVersion: 1 };
                          const message = rowErrors[key];
                          return (
                            <td key={component.id} className={message ? 'table-danger' : ''}>
                              <div className="d-flex flex-column gap-1">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  className="form-control form-control-sm text-end"
                                  data-cell={`${rowIndex}-${colIndex}`}
                                  value={state.code ? '' : state.marks}
                                  min="0"
                                  max={component.max_marks}
                                  step="0.5"
                                  disabled={!editable}
                                  placeholder={state.code ? state.code : ''}
                                  onChange={(e) => updateCell(rowIndex, colIndex, row.student.id, component, { marks: e.target.value })}
                                  onKeyDown={(e) => onCellKeyDown(e, rowIndex, colIndex)}
                                />
                                <select
                                  className="form-select form-select-sm"
                                  value={state.code || ''}
                                  disabled={!editable}
                                  onChange={(e) => updateCell(rowIndex, colIndex, row.student.id, component, { code: e.target.value })}
                                  title="Status code"
                                >
                                  <option value="">Marks</option>
                                  {STATUS_CODES.map((c) => <option key={c.code} value={c.code}>{c.code} Ã¢â‚¬â€ {c.label}</option>)}
                                </select>
                                {message && <div className="text-danger" style={{ fontSize: 11 }}>{message}</div>}
                              </div>
                            </td>
                          );
                        })}
                        <td className="text-center fw-semibold small">
                          {rowTotal(row)}
                          <div className="text-muted" style={{ fontSize: 11 }}>{componentMaxTotal ? `${((rowTotal(row) / componentMaxTotal) * 100).toFixed(1)}%` : ''}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="d-flex flex-wrap gap-3 mt-3 text-muted small">
            <span><i className="bi bi-keyboard me-1"></i>Enter / Ã¢â€ â€œ moves down, Ã¢â€ Â / Ã¢â€ â€™ moves across, Ctrl+S saves.</span>
            {STATUS_CODES.map((c) => (
              <span key={c.code}><span className={`badge bg-${c.tone} me-1`}>{c.code}</span>{c.label}</span>
            ))}
          </div>
          <div className="text-muted small mt-2">
            Raw marks and status codes only. Subject totals, grades, ranks and report cards are calculated from these entries Ã¢â‚¬â€ never typed in.
          </div>
        </>
      )}
    </PageShell>
  );
}

