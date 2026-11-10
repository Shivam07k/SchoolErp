import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, ErrorBox, canManage, downloadCsv, fmtDateTime } from './shared';

const STATUS_CODES = ['AB', 'ML', 'EX', 'UFM', 'WH'];
const MODES = [
  { key: 'import', label: 'CSV Import', icon: 'bi-upload' },
  { key: 'corrections', label: 'Corrections', icon: 'bi-pencil-square' },
  { key: 'moderation', label: 'Moderation', icon: 'bi-sliders' },
];

const TEMPLATE_CSV = 'admission_no,component,marks,status_code\nADM001,Theory,72,\nADM002,Theory,,AB\n';

export default function MarksTools({ me, onNavigate, mode = 'import', query = {} }) {
  const active = MODES.some((m) => m.key === mode) ? mode : 'import';
  const [exams, setExams] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [examId, setExamId] = useState(query.examId || '');
  const [sheetId, setSheetId] = useState(query.sheetId || '');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [csv, setCsv] = useState(TEMPLATE_CSV);
  const [preview, setPreview] = useState(null);

  const [corrections, setCorrections] = useState([]);
  const [correctionForm, setCorrectionForm] = useState({ entryId: '', newMarks: '', newStatusCode: '', reason: '' });

  const [moderation, setModeration] = useState({ method: 'add', parameter: '5', reason: '' });
  const [moderationResult, setModerationResult] = useState(null);

  const manager = canManage(me, 'exam.marks.entry');
  const canCorrect = canManage(me, 'exam.marks.correct');
  const canLock = canManage(me, 'exam.marks.lock');

  async function boot() {
    setLoading(true);
    setError('');
    try {
      const res = await apiGet('/school/exams');
      if (res?.ok) setExams(res.exams || []);
      await loadSheets(query.examId || '');
    } catch (err) {
      setError(err.message || 'Failed to load exams');
    } finally {
      setLoading(false);
    }
    if (query.sheetId) loadDetail(query.sheetId);
  }

  async function loadSheets(nextExamId) {
    try {
      const res = await apiGet(`/school/marks-sheets${nextExamId ? `?examId=${nextExamId}` : ''}`);
      if (res?.ok) setSheets(res.marksSheets || []);
    } catch (err) {
      toast(err.message || 'Could not load marks sheets', 'error');
    }
  }

  async function loadDetail(id) {
    if (!id) { setDetail(null); setCorrections([]); return; }
    setBusy(true);
    setError('');
    try {
      const res = await apiGet(`/school/marks-sheets/${id}`);
      if (!res?.ok) throw new Error(res?.error || 'Could not load sheet');
      setDetail(res);
      if (active === 'corrections') {
        const list = await apiGet(`/school/marks-sheets/${id}/corrections`);
        setCorrections(list?.corrections || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load marks sheet');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { boot(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [active]);

  useEffect(() => { if (sheetId) loadDetail(sheetId); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sheetId]);

  function changeExam(value) {
    setExamId(value);
    setSheetId('');
    setDetail(null);
    setPreview(null);
    loadSheets(value);
  }

  const sheet = detail?.sheet;
  const grid = detail?.grid || [];
  const components = detail?.components || [];
  const entryRows = useMemo(() => {
    const rows = [];
    grid.forEach((row) => {
      (row.components || []).forEach((cell) => {
        rows.push({
          student: row.student,
          component: cell.component,
          entryId: cell.entry_id,
          marks: cell.marks,
          statusCode: cell.status_code,
        });
      });
    });
    return rows;
  }, [grid]);

  async function previewImport() {
    if (!sheetId) return toast('Select a marks sheet first', 'warning');
    setBusy(true);
    setError('');
    setPreview(null);
    try {
      const res = await apiPost('/school/marks-sheets/preview-import', { sheetId, csv });
      if (!res?.ok) throw new Error(res?.error || 'Preview failed');
      setPreview(res.preview);
      if (res.preview?.invalid) toast(`${res.preview.invalid} row(s) have errors`, 'warning');
    } catch (err) {
      setError(err.message || 'Preview failed');
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!sheetId || !preview?.valid) return toast('Run a successful preview first', 'warning');
    if (!window.confirm(`Import ${preview.valid} valid row(s)? Existing entries for the same student and component will be replaced.`)) return;
    setBusy(true);
    try {
      const res = await apiPost(`/school/marks-sheets/${sheetId}/import`, { csv });
      if (!res?.ok) throw new Error(res?.error || 'Import failed');
      toast(`Imported ${res.imported} row(s)`, 'success');
      setPreview(null);
      loadDetail(sheetId);
    } catch (err) {
      setError(err.message || 'Import failed');
      toast(err.message || 'Import failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function createCorrection() {
    if (!correctionForm.entryId) return toast('Pick an entry row first', 'warning');
    if (!correctionForm.reason.trim()) return toast('A reason is mandatory', 'warning');
    setBusy(true);
    try {
      const res = await apiPost('/school/marks-sheets/corrections', {
        entryId: Number(correctionForm.entryId),
        newMarks: correctionForm.newStatusCode ? null : correctionForm.newMarks === '' ? null : Number(correctionForm.newMarks),
        newStatusCode: correctionForm.newStatusCode || null,
        reason: correctionForm.reason,
      });
      if (!res?.ok) throw new Error(res?.error || 'Could not request correction');
      toast('Correction requested', 'success');
      setCorrectionForm({ entryId: '', newMarks: '', newStatusCode: '', reason: '' });
      loadDetail(sheetId);
    } catch (err) {
      toast(err.message || 'Could not request correction', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function decide(correction, decision) {
    const decisionReason = window.prompt(`${decision === 'approved' ? 'Approve' : 'Reject'} correction Ã¢â‚¬â€ reason (audited):`);
    if (!decisionReason) return;
    setBusy(true);
    try {
      const res = await apiPut(`/school/marks-sheets/corrections/${correction.id}`, { decision, decisionReason });
      if (!res?.ok) throw new Error(res?.error || 'Could not update correction');
      toast(`Correction ${decision}`, 'success');
      loadDetail(sheetId);
    } catch (err) {
      toast(err.message || 'Could not update correction', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function applyModeration() {
    if (!sheetId) return toast('Select a marks sheet first', 'warning');
    if (!moderation.reason.trim()) return toast('A moderation reason is mandatory', 'warning');
    const parameter = Number(moderation.parameter);
    if (!Number.isFinite(parameter)) return toast('Enter a numeric parameter', 'warning');
    const parameters = moderation.method === 'scale' ? { factor: parameter } : moderation.method === 'add' ? { amount: parameter } : { max: parameter };
    if (!window.confirm(`Apply ${moderation.method} to every numeric entry in this sheet?`)) return;
    setBusy(true);
    setModerationResult(null);
    try {
      const res = await apiPost(`/school/marks-sheets/${sheetId}/moderate`, { method: moderation.method, parameters, reason: moderation.reason });
      if (!res?.ok) throw new Error(res?.error || 'Moderation failed');
      setModerationResult(res);
      toast(`Moderation applied to ${res.affected} entr${res.affected === 1 ? 'y' : 'ies'}`, 'success');
      loadDetail(sheetId);
    } catch (err) {
      setError(err.message || 'Moderation failed');
      toast(err.message || 'Moderation failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  function exportTemplate() {
    downloadCsv('marks-import-template.csv', [
      { label: 'admission_no', value: (r) => r.student.admission_no },
      { label: 'component', value: (r) => r.component.name },
      { label: 'marks', value: () => '' },
      { label: 'status_code', value: () => '' },
    ], entryRows);
  }

  return (
    <PageShell
      title={active === 'import' ? 'Import Marks' : active === 'corrections' ? 'Mark Corrections' : 'Moderation'}
      icon={MODES.find((m) => m.key === active)?.icon}
      subtitle={active === 'import' ? 'Validate a CSV before writing anything' : active === 'corrections' ? 'Locked marks change only through a reason and approval' : 'Apply an audited scale, addition or cap to a sheet'}
      onNavigate={onNavigate}
      actions={
        <>
          <button className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/examinations/marks')}>
            <i className="bi bi-arrow-left me-1"></i>Dashboard
          </button>
          {active === 'import' && <button className="btn btn-sm btn-outline-secondary" onClick={exportTemplate} disabled={!entryRows.length}>Template</button>}
        </>
      }
    >
      <ErrorBox message={error} onRetry={boot} />

      <div className="d-flex flex-wrap gap-2 mb-3">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            className={`btn btn-sm ${active === m.key ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => onNavigate(`/school/examinations/marks/${m.key}`)}
          >
            <i className={`bi ${m.icon} me-1`}></i>{m.label}
          </button>
        ))}
      </div>

      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <label className="form-label small">Exam</label>
          <select className="form-select form-select-sm" value={examId} onChange={(e) => changeExam(e.target.value)}>
            <option value="">All exams</option>
            {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div className="col-md-5">
          <label className="form-label small">Marks sheet</label>
          <select className="form-select form-select-sm" value={sheetId} onChange={(e) => { setSheetId(e.target.value); setPreview(null); }}>
            <option value="">Select a sheet</option>
            {sheets.map((s) => (
              <option key={s.id} value={s.id}>{s.exam_name} Ã‚Â· {s.class_name}/{s.section_name} Ã‚Â· {s.subject_name} ({s.state})</option>
            ))}
          </select>
        </div>
        <div className="col-md-3 d-flex align-items-end">
          {sheet && <span className="small text-muted">Sheet state: <strong>{sheet.state}</strong> Ã‚Â· {entryRows.length} entries</span>}
        </div>
      </div>

      {busy && <Loading text="WorkingÃ¢â‚¬Â¦" />}

      {!busy && active === 'import' && (
        <div className="row g-3">
          <div className="col-lg-7">
            <div className="border rounded p-3">
              <label className="form-label small">CSV rows Ã¢â‚¬â€ columns: admission_no, component, marks, status_code</label>
              <textarea className="form-control form-control-sm font-monospace" rows={12} value={csv} onChange={(e) => { setCsv(e.target.value); setPreview(null); }} spellCheck={false} />
              <div className="d-flex gap-2 mt-2">
                <button className="btn btn-sm btn-outline-primary" onClick={previewImport} disabled={!sheetId}>Preview</button>
                <button className="btn btn-sm btn-primary" onClick={runImport} disabled={!preview?.valid}>Import {preview?.valid || 0} rows</button>
              </div>
            </div>
          </div>
          <div className="col-lg-5">
            <div className="border rounded p-3">
              <h6 className="fw-semibold small mb-2">Validation</h6>
              {!preview ? <Empty icon="bi-clipboard-check" text="Preview validates every row without writing to the database." /> : (
                <>
                  <div className="d-flex gap-3 mb-2 small">
                    <span className="text-success">Valid: <strong>{preview.valid}</strong></span>
                    <span className="text-danger">Invalid: <strong>{preview.invalid}</strong></span>
                  </div>
                  {preview.invalid > 0 && (
                    <div className="border rounded" style={{ maxHeight: 260, overflow: 'auto' }}>
                      <table className="table table-sm mb-0"><thead><tr><th>Line</th><th>Error</th></tr></thead>
                        <tbody>{preview.errors.map((e, i) => <tr key={i}><td>{e.line}</td><td className="small text-danger">{e.error}</td></tr>)}</tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {!busy && active === 'corrections' && (
        <div className="row g-3">
          <div className="col-lg-6">
            <div className="border rounded">
              <div className="px-3 py-2 border-bottom fw-semibold small">Request a correction</div>
              {!sheet ? <Empty icon="bi-pencil-square" text="Select a marks sheet to see its entries." /> : (
                <div className="p-3">
                  <div className="table-responsive mb-2" style={{ maxHeight: 260 }}>
                    <table className="table table-sm mb-0 align-middle">
                      <thead><tr><th>Student</th><th>Component</th><th>Current</th><th></th></tr></thead>
                      <tbody>
                        {entryRows.map((r) => (
                          <tr key={`${r.student.id}-${r.component.id}`} className={String(correctionForm.entryId) === String(r.entryId) ? 'table-primary' : ''}>
                            <td className="small">{r.student.admission_no} Ã‚Â· {r.student.first_name} {r.student.last_name}</td>
                            <td className="small">{r.component.name}</td>
                            <td className="small">{r.statusCode || (r.marks ?? 'Ã¢â‚¬â€')}</td>
                            <td className="text-end">
                              <button className="btn btn-sm btn-outline-primary" disabled={!r.entryId} onClick={() => setCorrectionForm({ entryId: r.entryId, newMarks: r.marks ?? '', newStatusCode: r.statusCode || '', reason: '' })}>Pick</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="row g-2">
                    <div className="col-4"><label className="form-label small">New marks</label><input type="number" className="form-control form-control-sm" value={correctionForm.newMarks} disabled={!!correctionForm.newStatusCode} onChange={(e) => setCorrectionForm((p) => ({ ...p, newMarks: e.target.value }))} /></div>
                    <div className="col-4"><label className="form-label small">Status</label><select className="form-select form-select-sm" value={correctionForm.newStatusCode} onChange={(e) => setCorrectionForm((p) => ({ ...p, newStatusCode: e.target.value }))}><option value="">Marks</option>{STATUS_CODES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                    <div className="col-12"><label className="form-label small">Reason (mandatory)</label><input className="form-control form-control-sm" value={correctionForm.reason} onChange={(e) => setCorrectionForm((p) => ({ ...p, reason: e.target.value }))} /></div>
                    <div className="col-12"><button className="btn btn-sm btn-primary" onClick={createCorrection} disabled={!canCorrect || !correctionForm.entryId}>Request correction</button></div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="col-lg-6">
            <div className="border rounded">
              <div className="px-3 py-2 border-bottom fw-semibold small">Corrections for this sheet</div>
              {!corrections.length ? <Empty icon="bi-list-check" text="No corrections requested for this sheet." /> : (
                <div className="table-responsive" style={{ maxHeight: 420 }}>
                  <table className="table table-sm mb-0 align-middle">
                    <thead><tr><th>Student</th><th>Change</th><th>Reason</th><th>Status</th><th className="text-end"></th></tr></thead>
                    <tbody>
                      {corrections.map((c) => (
                        <tr key={c.id}>
                          <td className="small">{c.admission_no} Ã‚Â· {c.first_name} {c.last_name}<div className="text-muted" style={{ fontSize: 11 }}>{c.component_name}</div></td>
                          <td className="small">{c.old_status_code || (c.old_marks ?? 'Ã¢â‚¬â€')} Ã¢â€ â€™ {c.new_status_code || (c.new_marks ?? 'Ã¢â‚¬â€')}</td>
                          <td className="small">{c.reason}<div className="text-muted" style={{ fontSize: 11 }}>{fmtDateTime(c.requested_at)} Ã‚Â· {c.requested_by}</div></td>
                          <td className="small">{c.decision ? <span className={`badge bg-${c.decision === 'approved' ? 'success' : 'danger'}`}>{c.decision}</span> : <span className="badge bg-warning">pending</span>}</td>
                          <td className="text-end">
                            {!c.decision && canCorrect && (
                              <div className="btn-group btn-group-sm">
                                <button className="btn btn-outline-success" onClick={() => decide(c, 'approved')}>Approve</button>
                                <button className="btn btn-outline-danger" onClick={() => decide(c, 'rejected')}>Reject</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!busy && active === 'moderation' && (
        <div className="row g-3">
          <div className="col-lg-5">
            <div className="border rounded p-3">
              <h6 className="fw-semibold small mb-3">Apply moderation</h6>
              {!sheet ? <Empty icon="bi-sliders" text="Select a marks sheet first." /> : (
                <div className="d-grid gap-2">
                  <div>
                    <label className="form-label small">Method</label>
                    <select className="form-select form-select-sm" value={moderation.method} onChange={(e) => setModeration((p) => ({ ...p, method: e.target.value }))}>
                      <option value="add">Add marks</option>
                      <option value="scale">Scale by factor</option>
                      <option value="cap">Cap at maximum</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label small">{moderation.method === 'scale' ? 'Factor (1.1 = +10%)' : moderation.method === 'add' ? 'Marks to add' : 'Cap value'}</label>
                    <input type="number" className="form-control form-control-sm" value={moderation.parameter} onChange={(e) => setModeration((p) => ({ ...p, parameter: e.target.value }))} />
                  </div>
                  <div>
                    <label className="form-label small">Reason (mandatory)</label>
                    <input className="form-control form-control-sm" value={moderation.reason} onChange={(e) => setModeration((p) => ({ ...p, reason: e.target.value }))} />
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={applyModeration} disabled={!canLock}>Apply moderation</button>
                  <div className="text-muted" style={{ fontSize: 12 }}>Only numeric entries change. Status codes are untouched. Every change is audited.</div>
                </div>
              )}
            </div>
          </div>
          <div className="col-lg-7">
            <div className="border rounded p-3">
              <h6 className="fw-semibold small mb-3">Result</h6>
              {!moderationResult ? <Empty icon="bi-info-circle" text="The affected count and moderation record will appear here." /> : (
                <div className="small">
                  <div>Affected entries: <strong>{moderationResult.affected}</strong></div>
                  <div>Method: <strong>{moderationResult.moderation?.method}</strong></div>
                  <div>Recorded by: <strong>{moderationResult.moderation?.applied_by}</strong></div>
                  <pre className="bg-light border rounded p-2 mt-2" style={{ fontSize: 11 }}>{JSON.stringify(moderationResult.moderation?.parameters || {}, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

