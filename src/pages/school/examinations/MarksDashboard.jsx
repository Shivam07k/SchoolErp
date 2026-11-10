import React, { useEffect, useState, useMemo } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, ErrorBox, marksSheetTone, fmtDate, canManage } from './shared';

export default function MarksDashboard({ me, onNavigate }) {
  const [sheets, setSheets] = useState([]);
  const [exams, setExams] = useState([]);
  const [filterExamId, setFilterExamId] = useState('');
  const [filterState, setFilterState] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const manager = canManage(me);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [sheetRes, examRes] = await Promise.all([
        apiGet('/school/marks-sheets'),
        apiGet('/school/exams'),
      ]);
      if (!sheetRes?.ok) throw new Error(sheetRes?.error || 'Could not load marks sheets');
      if (!examRes?.ok) throw new Error(examRes?.error || 'Could not load exams');
      setSheets(sheetRes.marksSheets || []);
      setExams(examRes.exams || []);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function ensureSheets(examId) {
    if (!examId) return toast('Select an exam first', 'warning');
    try {
      const res = await apiPost('/school/marks-sheets/ensure', { examId: Number(examId) });
      if (!res?.ok) throw new Error(res?.error || 'Failed to create sheets');
      toast(`Created ${res.created} marks sheets`, 'success');
      load();
    } catch (err) { toast(err.message || 'Failed to create sheets', 'error'); }
  }

  async function changeState(sheet, newState) {
    let reason;
    if (newState === 'reopen') {
      reason = window.prompt('Reason for reopening this sheet (audited):');
      if (!reason) return;
    } else if (!window.confirm(`Change sheet state to ${newState}?`)) {
      return;
    }
    try {
      const res = await apiPost(`/school/marks-sheets/${sheet.id}/${newState}`, reason ? { reason } : {});
      if (!res?.ok) throw new Error(res?.error || 'Failed to change state');
      toast(`Sheet ${newState}`, 'success');
      load();
    } catch (err) { toast(err.message || 'Failed to change state', 'error'); }
  }

  const filtered = useMemo(() => sheets.filter(s => (!filterExamId || s.exam_id === Number(filterExamId)) && (!filterState || s.state === filterState)), [sheets, filterExamId, filterState]);

  return (
    <PageShell
      title="Marks Entry Dashboard"
      icon="bi-pencil-square"
      subtitle="Create marks sheets, track progress, and manage sheet lifecycle"
      onNavigate={onNavigate}
      actions={
        <>
          <button className="btn btn-sm btn-outline-secondary" onClick={load}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>
          {manager && <button className="btn btn-sm btn-primary" onClick={() => onNavigate('/school/examinations/marks/import')}><i className="bi bi-upload me-1"></i>Import</button>}
        </>
      }
    >
      <ErrorBox message={error} onRetry={load} />

      <div className="row g-3 mb-3">
        <div className="col-6 col-md-3"><label className="form-label small">Filter by Exam</label><select className="form-select form-select-sm" value={filterExamId} onChange={(e) => setFilterExamId(e.target.value)}><option value="">All Exams</option>{exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
        <div className="col-6 col-md-3"><label className="form-label small">Filter by State</label><select className="form-select form-select-sm" value={filterState} onChange={(e) => setFilterState(e.target.value)}><option value="">All States</option><option value="not_started">Not Started</option><option value="draft">Draft</option><option value="submitted">Submitted</option><option value="verified">Verified</option><option value="locked">Locked</option><option value="reopened">Reopened</option></select></div>
      </div>

      {loading ? <Loading /> : (
        <>
          <div className="row g-3 mb-4">
            <div className="col-md-3"><div className="border rounded p-3"><div className="text-muted small">Total Sheets</div><div className="fs-4 fw-bold">{sheets.length}</div></div></div>
            <div className="col-md-3"><div className="border rounded p-3"><div className="text-muted small">Not Started</div><div className="fs-4 fw-bold">{sheets.filter(s => s.state === 'not_started').length}</div></div></div>
            <div className="col-md-3"><div className="border rounded p-3"><div className="text-muted small">Draft</div><div className="fs-4 fw-bold text-warning">{sheets.filter(s => s.state === 'draft').length}</div></div></div>
            <div className="col-md-3"><div className="border rounded p-3"><div className="text-muted small">Locked</div><div className="fs-4 fw-bold text-success">{sheets.filter(s => s.state === 'locked').length}</div></div></div>
          </div>

          <div className="row g-3">
            <div className="col-lg-8">
              <div className="border rounded">
                <div className="px-3 py-2 border-bottom d-flex justify-content-between align-items-center">
                  <span className="fw-semibold small">Marks Sheets</span>
                  <div className="d-flex gap-2">
                    <select className="form-select form-select-sm" style={{ width: 'auto' }} value={filterExamId} onChange={(e) => setFilterExamId(e.target.value)}><option value="">All Exams</option>{exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
                    {manager && <button className="btn btn-sm btn-primary" onClick={() => ensureSheets(filterExamId)} disabled={!filterExamId}><i className="bi bi-plus-lg me-1"></i>Ensure Sheets</button>}
                  </div>
                </div>
                {filtered.length === 0 ? <Empty icon="bi-table" text="No marks sheets match the current filters." /> : (
                  <div className="table-responsive">
                    <table className="table table-sm mb-0 align-middle">
                      <thead><tr><th>Exam</th><th>Class / Section</th><th>Subject</th><th>State</th><th>Deadline</th><th>Submitted</th><th>Verified</th><th>Locked</th><th className="text-end">Actions</th></tr></thead>
                      <tbody>
                        {filtered.map((s) => (
                          <tr key={s.id}>
                            <td className="small">{s.exam_name}</td>
                            <td className="small">{s.class_name} / {s.section_name}</td>
                            <td className="small">{s.subject_name}</td>
                            <td><span className={`badge bg-${marksSheetTone(s.state)}`}>{s.state}</span></td>
                            <td className="small">{s.deadline ? fmtDate(s.deadline) : 'Ã¢â‚¬â€'}</td>
                            <td className="small">{s.submitted_at ? fmtDate(s.submitted_at) : 'Ã¢â‚¬â€'}</td>
                            <td className="small">{s.verified_at ? fmtDate(s.verified_at) : 'Ã¢â‚¬â€'}</td>
                            <td className="small">{s.locked_at ? fmtDate(s.locked_at) : 'Ã¢â‚¬â€'}</td>
                            <td className="text-end">
                              <div className="btn-group btn-group-sm">
                                <button className="btn btn-outline-primary" onClick={() => onNavigate(`/school/examinations/marks/sheet/${s.id}`)}>Open</button>
                                {manager && (
                                  <>
                                    {['draft', 'reopened'].includes(s.state) && <button className="btn btn-outline-success" onClick={() => changeState(s, 'submitted')} disabled={s.state !== 'draft' && s.state !== 'reopened'}>Submit</button>}
                                    {s.state === 'submitted' && <button className="btn btn-outline-primary" onClick={() => changeState(s, 'verified')}>Verify</button>}
                                    {['submitted', 'verified'].includes(s.state) && <button className="btn btn-outline-success" onClick={() => changeState(s, 'locked')}>Lock</button>}
                                    {s.state === 'locked' && <button className="btn btn-outline-warning" onClick={() => changeState(s, 'reopened')}>Reopen</button>}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="col-lg-4">
              <div className="border rounded p-3">
                <h6 className="fw-bold mb-3">Quick Actions</h6>
                <div className="d-grid gap-2">
                  <button className="btn btn-outline-primary" onClick={() => onNavigate('/school/examinations/marks/import')}><i className="bi bi-upload me-2"></i>Import Marks (CSV)</button>
                  <button className="btn btn-outline-primary" onClick={() => onNavigate('/school/examinations/marks/corrections')}><i className="bi bi-pencil-square me-2"></i>Corrections</button>
                  <button className="btn btn-outline-primary" onClick={() => onNavigate('/school/examinations/marks/moderation')}><i className="bi bi-sliders me-2"></i>Moderation</button>
                </div>
              </div>
              <div className="border rounded p-3 mt-3">
                <h6 className="fw-bold mb-3">Status Legend</h6>
                <div className="small">
                  <div className="d-flex justify-content-between mb-1"><span>Not Started</span><span className="badge bg-secondary">not_started</span></div>
                  <div className="d-flex justify-content-between mb-1"><span>Draft</span><span className="badge bg-secondary">draft</span></div>
                  <div className="d-flex justify-content-between mb-1"><span>Submitted</span><span className="badge bg-info">submitted</span></div>
                  <div className="d-flex justify-content-between mb-1"><span>Verified</span><span className="badge bg-primary">verified</span></div>
                  <div className="d-flex justify-content-between mb-1"><span>Locked</span><span className="badge bg-success">locked</span></div>
                  <div className="d-flex justify-content-between"><span>Reopened</span><span className="badge bg-warning">reopened</span></div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
